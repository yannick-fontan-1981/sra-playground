"""Bounded choice adapter; sequencing and release branches live in router.src.

This is an offline symbolic experiment, not a production action-release adapter.
Model choices carry evidence references, never acquire authority from confidence.
"""
from __future__ import annotations
import copy
import json
import time
from catalog import OPERATIONS, TREE, sha
from memory import pack
from operations import execute


class Engine:
    def __init__(self, memory, agent=None):
        self.memory, self.agent = memory, agent
        self.last_result = None
        self.tree_sha = sha(TREE)
        self.windows = {}

    def prepare(self, request):
        request = copy.deepcopy(request)
        if "expected" in request:
            raise ValueError("Evaluation label leaked into runtime")
        episode = request["episode"]
        # State is supplied to the persistent store before the measured call;
        # every request actually recalls it rather than relying on a Python cache.
        recalled = self.memory.get(episode, "state")
        request["state"] = recalled["value"]
        request["revision"] = recalled["revision"]
        request["state_evidence"] = recalled["evidence"]
        request["tree_sha"] = self.tree_sha
        key = request.get("current_key", OPERATIONS["OP01"]["authority_refs"][0])
        request["current_key"] = key
        self.windows[key] = self.memory.window(key)
        for candidate in request.get("navigation", []):
            self.windows[candidate["target"]] = self.memory.window(candidate["target"])
        request["window"] = self.windows[key]
        return request

    def src_begin(self, request):
        return {"request": request, "pending": True, "done": False, "progress": 0,
                "phase": "choice", "trace": [], "model_calls": [], "selected": None,
                "current_key": request["current_key"], "status": "pending", "action": None}

    def src_context(self, session):
        s = copy.deepcopy(session)
        r = s["request"]
        s["release_phase"] = s["phase"] == "release"
        s["navigation_phase"] = bool(r.get("navigation"))
        s["release_allowed"] = bool(s.get("guard_satisfied", False))
        s["code_only"] = r["policy"] == "code_only"
        s["can_force"] = len(r["candidates"]) == 1 and r["policy"] != "model_only"
        if not r["candidates"] or len(set(r["candidates"])) != len(r["candidates"]):
            raise ValueError("Invalid candidate domain")
        return s

    def src_unique(self, session):
        candidates = session["request"]["candidates"]
        if len(candidates) != 1:
            raise ValueError("No unique formal transition")
        return {"key": candidates[0], "method": "formal_unique", "model_ms": 0}

    def src_abstain(self, session):
        return {"key": "ABSTAIN", "method": "code_abstention", "model_ms": 0}

    def src_laya(self, session):
        import torch
        if self.agent is None:
            raise RuntimeError("Actual Laya required; no simulated model fallback")
        r = session["request"]
        labels, options = {}, {}
        navigation = {n["id"]: n for n in r.get("navigation", [])}
        for i, key in enumerate(r["candidates"]):
            label = f"T{i}"
            labels[label] = key
            if key in OPERATIONS:
                options[label] = OPERATIONS[key]["description"]
            else:
                n = navigation[key]
                options[label] = n["description"] + " Cible: " + n["target"]
        if len(options) == 1:
            labels["SKIP"] = "ABSTAIN"
            options["SKIP"] = "Aucune des transitions proposées ne convient."
        q = {"next": {"type": "choice", "instructions":
             "Choisir uniquement la prochaine opération utile à la situation, ou le déplacement demandé dans l'arbre.",
             "criteria": options}}
        w = r["window"]
        # Full catalog/history remains on disk. These are navigation excerpts,
        # not an assertion that every clause was read or is executable.
        state = pack({"situation": r["context"], "current": w["current"]["key"],
                      "neighbors": [{"relation": n["relation"], "key": n["key"]} for n in w["neighbors"][:2]],
                      "evidence": r["state_evidence"], "revision": r["revision"],
                      "memory_fact": r["state"].get("memory_hint", "faits symboliques disponibles sur demande")})
        internal = {k: self.agent._to_internal(v) for k, v in q.items()}
        encoded = self.agent._encode_state(state, list(q), internal, max_len=1024, head_max_len=384)
        stats = encoded["state_stats"] if isinstance(encoded, dict) else None
        torch.cuda.synchronize()
        started = time.perf_counter()
        answer = self.agent.system_one(state, q, max_len=1024, head_max_len=384)
        torch.cuda.synchronize()
        ms = (time.perf_counter() - started) * 1000
        usage = dict(answer["usage"])
        if usage.get("truncated") or usage.get("state_tokens_dropped", 0):
            raise RuntimeError("Silent context truncation forbidden: " + str(usage))
        result = answer["answers"]["next"]
        if result["choice"] not in labels:
            raise RuntimeError("Model returned out-of-domain choice")
        return {"key": labels[result["choice"]], "method": "laya", "model_ms": ms,
                "usage": usage, "probabilities": dict(result["probabilities"]),
                "confidence": result["confidence"], "answer_confidence": result["answer_confidence"],
                "prompt": state, "question": q, "state_stats": stats}

    def src_apply(self, session, choice):
        s = copy.deepcopy(session)
        r = s["request"]
        selected = choice["key"]
        s["progress"] += 1
        s["selected"] = selected
        s["trace"].append({"kind": "choice", "key": selected, "method": choice["method"],
                           "tree_sha": r["tree_sha"], "revision": r["revision"]})
        if choice["method"] == "laya":
            s["model_calls"].append(choice)
        if selected == "ABSTAIN":
            s.update(pending=False, done=True, status="abstained")
            return s
        if selected not in r["candidates"] or r["tree_sha"] != self.tree_sha:
            raise RuntimeError("Choice/source binding rejected")
        if selected in {n["id"] for n in r.get("navigation", [])}:
            n = next(n for n in r["navigation"] if n["id"] == selected)
            if n["revision"] != r["revision"] or n["target"] not in self.windows:
                raise RuntimeError("Stale or absent jump target")
            s["trace"].append({"kind": "cognitive_jump", "from": s["current_key"],
                               "to": n["target"], "relation": n["relation"], "game_undo": False})
            s["current_key"] = n["target"]
            s.update(pending=False, done=True, status="navigated")
            return s
        op = OPERATIONS[selected]
        target = op["authority_refs"][0]
        s["trace"].append({"kind": "cognitive_jump", "from": s["current_key"], "to": target,
                           "relation": "operation_reference", "game_undo": False,
                           "scope": "related_clause_not_production_implementation_proof"})
        s["current_key"] = target
        if "action" not in r:
            s.update(pending=False, done=True, status="operation_selected")
            return s
        output = execute(selected, r["state"])
        s["operation_result"] = output
        guard = r["outcome_guard"]
        value = output
        try:
            for part in guard["path"]:
                value = value[part]
            accepted = value == guard["equals"] if "equals" in guard else guard["contains"] in value
        except (KeyError, IndexError, TypeError):
            accepted = False
        safety = r["safety"]
        s["guard_satisfied"] = bool(accepted and safety["authorized"] and safety["evidence"])
        s["phase"] = "release"
        return s

    def src_navigate(self, session, choice):
        s = self.src_apply(session, choice)
        s["has_continuation"] = s["status"] == "navigated" and bool(s["request"].get("after_navigation"))
        return s

    def src_resume(self, session):
        s = copy.deepcopy(session)
        continuation = s["request"].pop("after_navigation")
        s["request"].pop("navigation")
        s["request"].update(continuation)
        s["request"]["window"] = self.windows[s["current_key"]]
        s.update(pending=True, done=False, status="pending", phase="choice")
        return s

    def src_complete_navigation(self, session):
        return session

    def src_release(self, session):
        if not session["release_allowed"]:
            raise RuntimeError("SRC release guard missing")
        s = copy.deepcopy(session)
        s["action"] = s["request"]["action"]
        # Symbolic application only. No real environment adapter is registered.
        s["symbolic_post_state"] = {"last_action": s["action"], "revision": s["request"]["revision"] + 1}
        s["trace"].append({"kind": "symbolic_action", "action": s["action"],
                           "guard_evidence": s["request"]["safety"]["evidence"], "game_io": False})
        s.update(pending=False, done=True, status="symbolic_action_applied", progress=s["progress"] + 1)
        return s

    def src_reject(self, session):
        s = copy.deepcopy(session)
        s.update(pending=False, done=True, status="action_guard_rejected", progress=s["progress"] + 1)
        return s

    def src_result(self, session):
        self.last_result = {k: v for k, v in session.items() if k not in {"request", "window"}}
        return self.last_result

    def persist(self, request, report):
        episode = request["episode"]
        self.memory.trace(episode, "src_decision", report)
        self.memory.put(episode, "current_key", report["decision"]["current_key"],
                        evidence="measured-src-prototype", revision=request["revision"])
        if report["decision"].get("action"):
            self.memory.put(episode, "symbolic_last_action", report["decision"]["action"],
                            evidence="symbolic-guard-not-real-game", revision=request["revision"] + 1)
