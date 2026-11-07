"""Run offline, labelled symbolic shortcut experiments on the actual local GPU."""
from __future__ import annotations
import argparse
import contextlib
import hashlib
import importlib.metadata
import importlib.util
import json
import os
from pathlib import Path
import statistics
import subprocess
import sys
import time
import traceback

os.environ.update(USE_TF="0", TRANSFORMERS_NO_TF="1", HF_HUB_OFFLINE="1")
from catalog import OPERATIONS, REPO, TREE, RECONCILIATION, sha
from engine import Engine
from fixtures import routing_cases, symbolic_state, EXPECTED_VALUES, action_cases
from memory import Memory, pack
from operations import execute
from src_bridge import SrcBridge


def durable(path, value):
    path = Path(path)
    with path.open("x", encoding="utf-8") as stream:
        json.dump(value, stream, ensure_ascii=False, indent=2)
        stream.flush()
        os.fsync(stream.fileno())


def quantiles(values):
    if not values:
        return None
    ordered = sorted(values)
    return {"n": len(values), "p50_ms": statistics.median(values),
            "p95_ms": ordered[min(len(ordered)-1, int(.95 * len(ordered)))], "max_ms": max(values)}


def source_plan(*, include_neural=True):
    files = list(Path(__file__).parent.glob("*.py")) + list(Path(__file__).parent.glob("*.src"))
    files += [TREE, RECONCILIATION]
    if include_neural:
        files += [REPO / "runs/yf_arc3_v6/laya-model-identity-20261104.json",
                  REPO / "runs/yf_arc3_v6/laya-runtime-tokenizer-identity-20261104.json",
                  Path(importlib.util.find_spec("laya").origin).with_name("agent.py")]
    # Record actual imported production compiler/scheduler modules, not a claim
    # that every game workflow or every historical artifact was executed.
    imported_prefixes = ("agents.yf_arc3_v5",) if include_neural else ("agents",)
    files += [Path(m.__file__) for n, m in list(sys.modules.items())
              if any(n == prefix or n.startswith(prefix + ".") for prefix in imported_prefixes)
              and getattr(m, "__file__", None) and Path(m.__file__).suffix == ".py"]
    hashes = {str(p.resolve()): sha(p) for p in sorted(set(files))}
    head = subprocess.run(["git", "rev-parse", "HEAD"], cwd=REPO, capture_output=True, text=True, check=True).stdout.strip()
    return {"scope": "offline symbolic prototype; no production V5 speedup established", "head": head,
            "python": sys.executable, "python_version": sys.version, "cwd": str(Path.cwd()), "source": hashes,
            "source_bundle_sha256": hashlib.sha256(pack(hashes).encode()).hexdigest(),
            "neural_dependencies_included": include_neural,
            "versions": {n: importlib.metadata.version(n) for n in
                         (["laya", "torch", "transformers"] if include_neural else ["numpy", "pydantic", "python-dotenv"]) + ["arc-agi", "arcengine"]}}


def navigation_cases(memory):
    cases = []
    for op in ["OP03", "OP07", "OP17", "OP24"]:
        key = OPERATIONS[op]["authority_refs"][0]
        neighbors = memory.window(key)["neighbors"]
        candidates = [{"id": "N" + str(i), "target": n["key"], "relation": n["relation"], "revision": 1,
                       "description": {"previous_text": "Revenir à la clause documentaire précédente.",
                                       "next_text": "Avancer à la clause documentaire suivante.",
                                       "explicit_reference": "Suivre le renvoi explicite de la clause."}[n["relation"]]}
                      for i, n in enumerate(neighbors)]
        for relation, text in [("previous_text", "Revenir à la clause précédente pour relire son contexte sans annuler une action du jeu."),
                               ("next_text", "Afficher la clause suivante dans le document, en conservant tous les faits du jeu.")]:
            expected = next(n["id"] for n in candidates if n["relation"] == relation)
            cases.append({"id": f"nav-{op}-{relation}", "kind": "navigation", "current_key": key,
                          "navigation": candidates, "candidates": [n["id"] for n in candidates],
                          "context": text, "expected": expected})
    return cases


def mechanical_check():
    mismatches = []
    for key, expected in EXPECTED_VALUES.items():
        actual = execute(key, symbolic_state())["value"]
        if actual != expected:
            mismatches.append({"operation": key, "expected": expected, "actual": actual})
    return {"cases": len(EXPECTED_VALUES), "matched": len(EXPECTED_VALUES)-len(mismatches), "mismatches": mismatches}


def multihop_cases(memory):
    cases = []
    navigation = navigation_cases(memory)
    for i, action in enumerate(action_cases()[::3]):
        nav = navigation[i * 2]
        continuation = {k: v for k, v in action.items() if k not in {"id", "kind", "expected", "current_key"}}
        cases.append({**nav, "id": "multihop-" + action["id"], "kind": "navigation_then_action",
                      "after_navigation": continuation, "expected": action["expected"],
                      "expected_navigation": nav["expected"]})
    return cases


def run_case(bridge, memory, case, policy, prefix=""):
    request = {k: v for k, v in case.items() if not k.startswith("expected")}
    request.update(policy=policy, episode=prefix + policy + ":" + case["id"])
    state = symbolic_state()
    state["memory_hint"] = "Un fait inconnu reste inconnu. La navigation ne rembobine pas le jeu."
    memory.put(request["episode"], "state", state, evidence="labelled-synthetic-input;not-an-oracle")
    result = bridge.run(request)
    decision = result["decision"]
    choices = [t["key"] for t in decision["trace"] if t["kind"] == "choice"]
    nav_correct = not case.get("expected_navigation") or choices[0] == case["expected_navigation"]
    return {"case": case["id"], "kind": case.get("kind", "symbolic_action"), "policy": policy,
            "expected": case["expected"], "correct": decision["selected"] == case["expected"] and nav_correct, **result}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True)
    parser.add_argument("--control", action="store_true")
    args = parser.parse_args()
    out = Path(args.output).resolve()
    out.mkdir(parents=True, exist_ok=False)
    memory = None
    try:
        plan = source_plan()
        durable(out / "plan.json", plan)
        # Same existing single-session lease as the V6 caller; acquired after
        # the Source plan, retained through durable success/failure output.
        from agents.yf_arc3_v6.__main__ import session_slot
        with session_slot() as marker:
            durable(out / "lease.json", {"pid": os.getpid(), "lease": marker})
            try:
                check = mechanical_check()
                durable(out / "mechanical-check.json", check)
                if check["mismatches"]:
                    raise RuntimeError("Mechanical fixture divergence; unit stopped")
                memory = Memory(out / "memory.sqlite3")
                imported = memory.import_catalog()
                engine = Engine(memory)
                bridge = SrcBridge(engine)
                control_case = action_cases()[0]
                control_case["candidates"] = [control_case["expected"]]
                control = run_case(bridge, memory, control_case, "code_only", "control:")
                durable(out / "src-control.json", control)
                if control["decision"]["status"] != "symbolic_action_applied":
                    raise RuntimeError("Actual SRC action control failed")
                if args.control:
                    durable(out / "report.json", {"status": "control_passed", "mechanical": check,
                            "catalog": imported, "src_status": control["src_status"], "game_actions": 0})
                    print(pack({"status": "control_passed", "output": str(out)}), flush=True)
                    return
                import torch
                import laya
                if not torch.cuda.is_available():
                    raise RuntimeError("CUDA unavailable; no silent CPU fallback")
                model = REPO / ".local/qwen/laya-multilingual-1720e3e3"
                identity = json.loads((REPO / "runs/yf_arc3_v6/laya-model-identity-20261104.json").read_text())
                tokenizer_identity = json.loads((REPO / "runs/yf_arc3_v6/laya-runtime-tokenizer-identity-20261104.json").read_text())
                for name, info in identity["files"].items():
                    expected_digest = tokenizer_identity["effective_sha256"] if name == "tokenizer/tokenizer_config.json" else info["sha256"]
                    if sha(model / name) != expected_digest:
                        raise RuntimeError("Pinned model identity mismatch: " + name)
                started = time.perf_counter()
                agent = laya.load(str(model), device="cuda", backend="eager")
                torch.cuda.synchronize()
                load_ms = (time.perf_counter()-started)*1000
                engine.agent = agent
                archive = memory.seed_archive(agent.tok)
                memory.put("persistence", "sentinel", {"fact": "power remains unknown", "revision": 7}, "synthetic-provenance", 7)
                memory.close()
                # Independent Python process demonstrates process-lifetime
                # persistence rather than a surviving in-memory Python object.
                probe = subprocess.run([sys.executable, "-c",
                    "import sqlite3,json,sys;c=sqlite3.connect(sys.argv[1]);r=c.execute(\"SELECT v FROM facts WHERE episode='persistence' AND k='sentinel'\").fetchone();print(json.dumps({'sentinel':json.loads(r[0]),'archive_tokens':c.execute('SELECT SUM(tokens) FROM archive').fetchone()[0]}))",
                    str(out / "memory.sqlite3")], capture_output=True, text=True, check=True)
                persistence = json.loads(probe.stdout)
                memory = Memory(out / "memory.sqlite3")
                engine.memory = memory
                warmup = run_case(bridge, memory, routing_cases()[0], "hybrid", "warmup:")
                durable(out / "warmup.json", warmup)
                cases = routing_cases() + navigation_cases(memory) + action_cases() + multihop_cases(memory)
                rows = []
                with (out / "cases.jsonl").open("x", encoding="utf-8") as journal:
                    for policy in ["code_only", "model_only", "hybrid"]:
                        for case in cases:
                            row = run_case(bridge, memory, case, policy)
                            rows.append(row)
                            journal.write(pack(row) + "\n")
                            journal.flush()
                            os.fsync(journal.fileno())
                        print(pack({"progress": policy, "cases_completed": len(rows)}), flush=True)
                groups = []
                for policy in ["code_only", "model_only", "hybrid"]:
                    for kind in sorted({r["kind"] for r in rows}):
                        selected = [r for r in rows if r["policy"] == policy and r["kind"] == kind]
                        decisions = [r["decision"] for r in selected]
                        calls = [c for d in decisions for c in d["model_calls"]]
                        groups.append({"policy": policy, "kind": kind, "cases": len(selected),
                           "correct": sum(r["correct"] for r in selected),
                           "abstained": sum(d["status"] == "abstained" for d in decisions),
                           "wrong_choice": sum(not r["correct"] and r["decision"]["status"] != "abstained" for r in selected),
                           "actions_applied": sum(d["status"] == "symbolic_action_applied" for d in decisions),
                           "action_guard_rejected": sum(d["status"] == "action_guard_rejected" for d in decisions),
                           "model_calls": len(calls), "model_latency": quantiles([c["model_ms"] for c in calls]),
                           "end_to_end": quantiles([r["total_ms"] for r in selected]),
                           "successful_action_latency": quantiles([r["total_ms"] for r in selected if r["decision"]["status"] == "symbolic_action_applied"]),
                           "max_input_tokens": max((c["usage"].get("input_tokens", 0) for c in calls), default=0)})
                changed = [p for p, digest in plan["source"].items() if sha(p) != digest]
                if changed:
                    raise RuntimeError("Consumed source changed during run: " + str(changed))
                report = {"status": "completed", "scope": plan["scope"], "game_actions": 0,
                    "production_workflows_modified": False, "production_v5_speedup": "UNMEASURED",
                    "model": identity, "tokenizer_compatibility": tokenizer_identity,
                    "device": torch.cuda.get_device_name(), "load_ms": load_ms,
                    "peak_allocated_MiB": torch.cuda.max_memory_allocated()/1048576,
                    "catalog": imported, "archive": archive, "persistence": persistence,
                    "memory_stats": memory.stats(), "mechanical_cases": check["matched"],
                    "groups": groups, "training": "none; zero-shot",
                    "baseline_limitation": "Code baseline resolves unique formal transitions and abstains on semantic alternatives; not a competitive hand-built semantic solver.",
                    "quality_limitation": "Hand-labelled synthetic tasks, related clause references only; not evidence of real game reasoning or all normative mechanisms implemented.",
                    "timing_boundary": "recall + actual SRC scheduler + optional native CUDA choice + mechanical query + symbolic action + SQLite FULL commit; model load/catalog/archive excluded"}
                durable(out / "report.json", report)
                print(pack({"status": "completed", "cases": len(rows), "output": str(out)}), flush=True)
            except BaseException as exc:
                durable(out / "failure.json", {"status": "stopped", "error": repr(exc), "traceback": traceback.format_exc(), "game_actions": 0})
                raise
    except BaseException as exc:
        print(pack({"status": "stopped", "error": repr(exc), "output": str(out)}), flush=True)
        raise
    finally:
        if memory is not None:
            with contextlib.suppress(Exception):
                memory.close()


if __name__ == "__main__":
    main()
