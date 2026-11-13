"""Thin host adapter around the original legacy ToolAgent decision loop."""
from __future__ import annotations

from dataclasses import asdict, is_dataclass
import hashlib
import json
import os
from pathlib import Path
import subprocess
import time

from .upstream_loader import load


class BudgetStop(RuntimeError):
    pass


def atomic_json(path, value):
    path = Path(path)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(value, indent=2, default=str) + "\n", encoding="utf-8")
    temporary.replace(path)


def source_binding():
    root = Path(__file__).parent
    files = {str(p.relative_to(root)).replace("\\", "/"): hashlib.sha256(p.read_bytes()).hexdigest()
             for p in sorted(root.rglob("*")) if p.suffix in {".py", ".json", ".sh"} and "__pycache__" not in p.parts}
    repo = root.parents[1]
    for name in ["agents/__init__.py", "agents/agent.py", "agents/structs.py",
                 "tools/yf_v5_env_bridge.py", "tools/official_instance_determinism.py"]:
        files["host:" + name] = hashlib.sha256((repo / name).read_bytes()).hexdigest()
    head = subprocess.check_output(["git", "rev-parse", "HEAD"], text=True, cwd=repo).strip()
    return {"files": files, "git_head": head,
            "sha256": hashlib.sha256(json.dumps({"files": files, "head": head}, sort_keys=True).encode()).hexdigest()}


class Baseline:
    def __init__(self, session, profile, output, *, analyzer_factory=None):
        self.session, self.profile = session, profile
        self.output = Path(output)
        self.output.mkdir(parents=True, exist_ok=False)
        self.started = time.monotonic()
        self.deadline = self.started + profile["duration_seconds"]
        if os.environ.get("YF_V6_DEADLINE_UNIX"):
            self.deadline = min(self.deadline, self.started + max(0, float(os.environ["YF_V6_DEADLINE_UNIX"]) - time.time()))
        self.actions = self.requests = self.turns = self.tools = 0
        self.history = []
        self.stop_reason = None
        self.fatal_error = None
        self.action_guard_hook = None
        self.lease_check = None
        self.state_path = self.output / "state.json"
        self.binding = source_binding()
        self.upstream = load("agent.tool_agent")
        self.runtime = load("agent.runtime_state")
        self.names = load("agent.action_names")
        self.analyzer = analyzer_factory(self) if analyzer_factory else self._make_analyzer()
        self.trace("start", profile=profile, source=self.binding["sha256"],
                   head=subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip(),
                   python=os.sys.executable)
        atomic_json(self.output / "source_binding.json", self.binding)
        atomic_json(self.output / "profile.json", profile)

    def trace(self, event, **payload):
        with (self.output / "events.jsonl").open("a", encoding="utf-8") as stream:
            stream.write(json.dumps({"event": event, "seconds": time.monotonic() - self.started,
                                     **payload}, default=str) + "\n")
            stream.flush()

    def _make_analyzer(self):
        host = self
        upstream = self.upstream

        class TraceAgent(upstream.ToolAgent):
            def _chat_completion(self, messages, **kwargs):
                if host.requests >= host.profile["max_requests"]:
                    host.stop_reason = "request_cap"
                    raise BudgetStop("request_cap")
                remaining = host.deadline - time.monotonic()
                if remaining <= 0:
                    host.stop_reason = "duration_cap"
                    raise BudgetStop("duration_cap")
                if any(isinstance(m.get("content"), list) and any(p.get("type") == "image_url" for p in m["content"]) for m in messages):
                    raise RuntimeError("Image payload forbidden by validated text profile")
                host.requests += 1
                host.trace("request", index=host.requests, messages=messages, tools=kwargs.get("tools"))
                kwargs["request_timeout_seconds"] = min(remaining, host.profile["request_seconds"])
                response = super()._chat_completion(messages, **kwargs)
                host.trace("response", index=host.requests,
                           response=asdict(response) if is_dataclass(response) else vars(response))
                return response

            def _dispatch_tool(self, state_path, name, arguments):
                host.tools += 1
                host.trace("tool_call", name=name, arguments=arguments)
                result = super()._dispatch_tool(state_path, name, arguments)
                host.trace("tool_result", result=asdict(result) if is_dataclass(result) else vars(result))
                return result

        return TraceAgent(model=self.profile["env"]["LOCAL_ANALYZER_MODEL_ID"],
                          provider=self.profile["env"]["LOCAL_ANALYZER_PROVIDER"],
                          base_url=self.profile["env"]["LOCAL_ANALYZER_BASE_URL"],
                          timeout=self.profile["request_seconds"], save_request_logs=True)

    def stopped(self):
        if self.lease_check:
            self.lease_check()
        if self.stop_reason:
            return True
        if time.monotonic() >= self.deadline:
            self.stop_reason = "duration_cap"
        elif self.actions >= self.profile["max_actions"]:
            self.stop_reason = "action_cap"
        return bool(self.stop_reason)

    def publish(self, observation, action=None, result=None):
        frame = self.runtime.Frame(grid=observation.frame_rows, step=self.actions, level=observation.level)
        if action is not None:
            self.history.append(self.runtime.HistoryEntry(action=action, frame=frame, result=result or {}))
        self.runtime.write_runtime_state(self.state_path, current_frame=frame, history=self.history)
        self.trace("observation", observation=asdict(observation) if is_dataclass(observation) else vars(observation))

    def valid_actions(self, observation):
        return self.names.to_model_actions(observation.available_action_refs)

    def step_env(self, arguments):
        try:
            return self._step_env(arguments)
        except Exception as exc:
            self.fatal_error = f"{type(exc).__name__}: {exc}"
            self.stop_reason = "action_error"
            self.trace("fatal_action_error", error=self.fatal_error)
            raise

    def _step_env(self, arguments):
        if "query" in arguments:
            return {"error": "Animation queries are disabled in the local text profile"}
        batch = arguments.get("actions")
        if not isinstance(batch, list) or not batch:
            raise ValueError("Expected a nonempty actions list")
        executed, verdicts, traces = [], [], []
        stop = None
        before = self.session.snapshot(include_frame=True)
        initial = before
        for index, item in enumerate(batch):
            if self.stopped():
                stop = self.stop_reason
                break
            if not isinstance(item, dict):
                raise ValueError("Action must be an object")
            name = self.names.to_engine_action(item.get("action"))
            if name not in before.available_action_refs:
                raise ValueError(f"Unavailable action: {name}")
            coordinates = {k: item[k] for k in ("row", "col") if k in item}
            data = {}
            if name == "ACTION6":
                if set(coordinates) != {"row", "col"} or any(type(v) is not int for v in coordinates.values()):
                    raise ValueError("MOUSE requires integer row and col")
                data = {"x": coordinates["col"], "y": coordinates["row"]}
                if not (0 <= data["x"] < before.frame_width and 0 <= data["y"] < before.frame_height):
                    raise ValueError("MOUSE coordinates outside frame")
            elif coordinates:
                raise ValueError("Coordinates supplied for a non-mouse action")
            if name == "RESET" and (not self.actions or self.history[-1].action == "RESET"):
                raise ValueError("RESET requires an intervening action")
            if self.action_guard_hook:
                blocked = self.action_guard_hook(before.frame_rows, name, coordinates, before.level)
                if blocked:
                    stop, detail = blocked
                    self.trace("action_refused", reason=stop, detail=detail, action=item)
                    break
            self.trace("action_requested", action=name, data=data)
            after = self.session.step(name, data=data)
            self.actions += 1
            changed = before.frame_rows != after.frame_rows
            gameplay_changed = self.upstream._interior_state_hash(before.frame_rows) != self.upstream._interior_state_hash(after.frame_rows)
            result = {"executed": True, "action_num": self.actions, "level": after.level,
                      "score": after.score, "state": after.state, "board_changed": changed,
                      "gameplay_changed": gameplay_changed,
                      "level_completed": after.levels_completed > before.levels_completed,
                      "game_over": after.state == "GAME_OVER", "run_complete": after.state == "WIN"}
            result["done"] = result["game_over"] or result["run_complete"]
            display = self.names.to_model_action(name)
            if coordinates:
                display += f"(row={coordinates['row']}, col={coordinates['col']})"
            self.publish(after, display, result)
            self.trace("action", action=name, data=data, result=result,
                       before_hash=before.frame_hash, after_hash=after.frame_hash)
            executed.append(item)
            verdicts.append(gameplay_changed)
            traces.append({"action": display, **result})
            before = after
            if result["done"] or result["level_completed"]:
                stop = "terminal_state" if result["done"] else "level_completed"
                break
            if not gameplay_changed and os.environ.get("ARC3_BATCH_NOOP_BLOCK") == "1":
                stop = "no_op"
                break
            if arguments.get("stale_after"):
                stop = "stale_state"
                break
        payload = {"executed": bool(executed), "executed_count": len(executed),
                   "requested_count": len(batch), "executed_actions": executed,
                   "action_trace": traces, "gameplay_changed_per_action": verdicts,
                   "action_num": self.actions, "level": before.level, "score": before.score,
                   "state": before.state, "board_changed": initial.frame_rows != before.frame_rows,
                   "gameplay_changed": any(verdicts), "valid_actions": self.valid_actions(before),
                   "level_completed": before.levels_completed > initial.levels_completed,
                   "done": before.state in {"WIN", "GAME_OVER"}, "game_over": before.state == "GAME_OVER",
                   "run_complete": before.state == "WIN", "stopped_early": len(executed) < len(batch),
                   "stop_reason": stop}
        return payload

    def run(self):
        error = None
        try:
            observation = self.session.snapshot(include_frame=True)
            self.publish(observation)
            while not self.stopped() and self.turns < self.profile["max_turns"]:
                if observation.state in {"WIN", "GAME_OVER"}:
                    self.stop_reason = observation.state.lower()
                    break
                self.turns += 1
                outcome = self.analyzer.analyze(self.state_path, action_num=self.actions,
                    valid_actions=self.valid_actions(observation), step_env=self.step_env,
                    transcript_path=self.output / "transcript.txt", analysis_step=self.turns,
                    should_stop=self.stopped,
                    request_timeout_seconds=min(self.profile["request_seconds"], self.deadline - time.monotonic()))
                if outcome is None:
                    if self.stopped():
                        break
                    raise RuntimeError("Analyzer returned no outcome; inspect transcript")
                if self.fatal_error:
                    raise RuntimeError(self.fatal_error)
                if outcome.retryable_failure:
                    if self.stopped():
                        break
                    raise RuntimeError("Model transport/analyzer failure; no automatic retry")
                self.trace("turn", outcome=asdict(outcome) if is_dataclass(outcome) else vars(outcome))
                observation = self.session.snapshot(include_frame=True)
            self.stop_reason = self.stop_reason or "turn_cap"
        except BudgetStop as exc:
            self.stop_reason = str(exc)
        except BaseException as exc:
            error = f"{type(exc).__name__}: {exc}"
            self.stop_reason = "error"
            self.trace("error", error=error)
        finally:
            self.analyzer.end_forks()
            unchanged = source_binding()["sha256"] == self.binding["sha256"]
            if not unchanged:
                error = "Source changed during execution"
                self.stop_reason = "source_changed"
            summary = {"v6_version": "0.1.0", "profile": self.profile["name"], "source_sha256": self.binding["sha256"],
                       "actions": self.actions, "requests": self.requests, "tools": self.tools, "turns": self.turns,
                       "elapsed_seconds": round(time.monotonic() - self.started, 3),
                       "stop_reason": self.stop_reason, "error": error, "source_unchanged": unchanged,
                       "server_total_tokens": self.analyzer.total_tokens,
                       "server_generated_tokens": self.analyzer.generated_tokens,
                       "final": self.session.snapshot().to_dict()}
            atomic_json(self.output / "summary.json", summary)
        return summary
