"""Composition contract and bounded action-set choices. No hidden game policy."""
import copy
import time
from catalog import OPERATIONS, TREE, sha
from engine import Engine
from memory import pack
from operations import execute


def validate_bundle(bundle, state, revision):
    required = {"id", "operation_key", "composition_ref", "objective_ref", "preserve_refs",
                "observation_revision", "kind", "actions", "purpose", "preconditions", "evidence"}
    if required - bundle.keys():
        raise ValueError("Incomplete composition contract: " + str(sorted(required-bundle.keys())))
    domain = {c["id"] for c in state["compositions"]}
    refs = {bundle["composition_ref"], bundle["objective_ref"], *bundle["preserve_refs"]}
    if not refs <= domain or bundle["operation_key"] not in OPERATIONS:
        raise ValueError("Unknown composition or operation reference")
    if bundle["observation_revision"] != revision:
        raise ValueError("Stale composition contract")
    if bundle["kind"] not in {"analysis", "realize", "probe"}:
        raise ValueError("Unknown action-set kind")
    if bundle["kind"] != "analysis" and not 1 <= len(bundle["actions"]) <= 32:
        raise ValueError("Unbounded or empty action set")
    facts = state.get("facts", {})
    conditions = all(k in facts and facts[k] == v for k, v in bundle["preconditions"].items())
    preservation = set(bundle["preserve_refs"]) <= set(bundle.get("preservation_evidence", {}))
    preservation = preservation and all(bundle.get("preservation_evidence", {}).get(k) for k in bundle["preserve_refs"])
    return bool(conditions and preservation and bundle["evidence"])


def operation_admission(bundle, result):
    """Bind physical release to an actual operation result, not its invocation.

    This checks the symbolic producer/consumer link. It does not establish that
    supplied premises or a mechanism have been learned from the environment.
    Other operations remain available for analysis; physical release through
    them requires a separately specified result contract, never a fallback.
    """
    operation = bundle["operation_key"]
    if operation not in {"OP14", "OP18", "OP28"}:
        return {"accepted": False, "reason": "physical_operation_contract_unspecified"}
    expected = bundle["id"] if operation == "OP28" else bundle["composition_ref"]
    guard = {"path": ["value"], "contains": expected}
    if bundle.get("outcome_guard") != guard:
        return {"accepted": False, "reason": "missing_or_mismatched_outcome_guard"}
    values = result.get("value")
    accepted = (result.get("operation") == operation
                and result.get("status") == "complete_on_supplied_state"
                and isinstance(values, list) and expected in values)
    return {"accepted": bool(accepted), "reason": "operation_selected_reference" if accepted
            else "operation_did_not_select_reference", "guard": guard}


class CompositionEngine(Engine):
    def prepare(self, request):
        r = copy.deepcopy(request)
        if any(k.startswith("expected_") for k in r):
            raise ValueError("Evaluator labels must not enter runtime")
        if "current_key" not in r:
            try:
                r["current_key"] = self.memory.get(r["episode"], "current_key")["value"]
            except KeyError:
                pass
        r = super().prepare(r)
        r["admissions"] = {k: validate_bundle(b, r["state"], r["revision"]) for k, b in r["bundles"].items()}
        if any(k != b["id"] for k, b in r["bundles"].items()):
            raise ValueError("Bundle identity mismatch")
        for n in r.get("navigation", []):
            if n["revision"] != r["revision"]:
                raise ValueError("Stale navigation")
        if not set(r["candidates"]) <= (set(r["bundles"]) | {n["id"] for n in r.get("navigation", [])}):
            raise ValueError("Candidate outside declared domain")
        r["composition_context"] = [{k: c.get(k) for k in ["id", "things", "properties", "relations", "context", "knowledge_status", "role"]}
                                    for c in r["state"]["compositions"] if c["id"] in r["relevant_compositions"]]
        return r

    def src_laya(self, session):
        import torch
        r = session["request"]
        nav = {n["id"]: n for n in r.get("navigation", [])}
        labels, options = {}, {}
        for i, key in enumerate(r["candidates"]):
            label = "T" + str(i)
            labels[label] = key
            if key in nav:
                options[label] = nav[key]["description"]
            else:
                b = r["bundles"][key]
                options[label] = (OPERATIONS[b["operation_key"]]["description"] + ". Composition: " + b["composition_ref"]
                                  + ". But: " + b["purpose"] + ". Préserver: " + ",".join(b["preserve_refs"]))
        if len(options) == 1:
            labels["SKIP"] = "ABSTAIN"
            options["SKIP"] = "Aucune proposition ne convient."
        q = {"next": {"type": "choice", "instructions": "Choisir l'ensemble de travail utile à la composition cible. Un probe est un ensemble d'actions visant une information. Ne pas choisir une touche isolée.", "criteria": options}}
        state = pack({"question": r["context"], "compositions": r["composition_context"],
                      "revision": r["revision"], "current_key": session["current_key"],
                      "memory": r["state"].get("memory_hint", "")})
        torch.cuda.synchronize()
        start = time.perf_counter()
        answer = self.agent.system_one(state, q, max_len=1024, head_max_len=512)
        torch.cuda.synchronize()
        duration = (time.perf_counter()-start)*1000
        usage = answer["usage"]
        if usage.get("truncated") or usage.get("state_tokens_dropped") or usage.get("truncated_questions"):
            raise RuntimeError("Composition payload truncated")
        choice = answer["answers"]["next"]
        return {"key": labels[choice["choice"]], "method": "laya", "model_ms": duration,
                "usage": usage, "prompt": state, "question": q, "response": choice}

    def src_apply(self, session, choice):
        r = session["request"]
        if choice["key"] == "ABSTAIN" or choice["key"] in {n["id"] for n in r.get("navigation", [])}:
            return super().src_apply(session, choice)
        s = copy.deepcopy(session)
        key = choice["key"]
        if key not in r["candidates"] or r["tree_sha"] != self.tree_sha:
            raise RuntimeError("Source-bound choice rejected")
        b = r["bundles"][key]
        s["selected"] = key
        s["selected_bundle"] = b
        s["progress"] += 1
        s["trace"].append({"kind": "composition_choice", "bundle": key, "operation": b["operation_key"],
                           "composition_ref": b["composition_ref"], "revision": r["revision"]})
        if choice["method"] == "laya":
            s["model_calls"].append(choice)
        target = OPERATIONS[b["operation_key"]]["authority_refs"][0]
        s["trace"].append({"kind": "cognitive_jump", "from": s["current_key"], "to": target, "game_undo": False})
        s["current_key"] = target
        facts = {**r["state"], "focus": b["composition_ref"], "preserve_refs": b["preserve_refs"]}
        s["operation_result"] = execute(b["operation_key"], facts)
        if b["kind"] == "analysis":
            s.update(pending=False, done=True, status="composition_analysis")
        else:
            s["operation_admission"] = operation_admission(b, s["operation_result"])
            s["trace"].append({"kind": "operation_admission", "bundle": key,
                               **s["operation_admission"]})
            s["guard_satisfied"] = bool(r["admissions"][key]
                                        and s["operation_admission"]["accepted"])
            s["phase"] = "release"
        return s

    def src_release(self, session):
        if not session["release_allowed"]:
            raise RuntimeError("SRC release missing")
        s = copy.deepcopy(session)
        s["action_set"] = s["selected_bundle"]
        s["trace"].append({"kind": "action_set_release", "bundle": s["action_set"]["id"],
                           "actions": len(s["action_set"]["actions"]), "game_io": False})
        s.update(pending=False, done=True, status="action_set_released", progress=s["progress"]+1)
        return s

    def persist(self, request, report):
        super().persist(request, report)
        decision = report["decision"]
        if decision.get("selected_bundle"):
            b = decision["selected_bundle"]
            self.memory.put(request["episode"], "composition_contract", b,
                            evidence="SRC-selected-composition", revision=request["revision"])
        if decision["status"] == "composition_analysis" and decision["selected_bundle"]["operation_key"] == "OP30":
            for update in decision["operation_result"]["value"]:
                self.memory.put(request["episode"], "knowledge:"+update["composition_ref"]+":"+update["property"],
                                update["value"], evidence=update["evidence"], revision=update["revision"])
