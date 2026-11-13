"""24 bounded mechanical queries over supplied symbolic evidence.

These are prototype operators, not learned perception or complete implementations
of the normative game reasoning tree. No query invents a missing game law.
"""
from __future__ import annotations
import json


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"))


def execute(key, state):
    cs = state.get("compositions", [])
    facts = state.get("facts", {})
    focus = next((c for c in cs if c["id"] == state.get("focus")), cs[0] if cs else {})
    def verdict(c):
        return {k: "unknown" if k not in facts else facts[k] == v for k, v in c.get("requires", {}).items()}
    def ready(c):
        return all(x is True for x in verdict(c).values())
    def links(c):
        return [d["id"] for d in cs if d["id"] != c["id"] and any(
            k in c.get("effect", {}) and c["effect"][k] == v for k, v in d.get("requires", {}).items())]
    result = {"operation": key, "status": "complete_on_supplied_state", "synthetic_scope": True}
    if key == "OP01":
        groups = {}
        for c in cs:
            groups.setdefault(canonical({k: c.get(k) for k in ["kind", "requires", "effect", "things", "properties", "relations", "context"]}), []).append(c["id"])
        value = list(groups.values())
    elif key == "OP02":
        groups = {}
        for p in state.get("paths", []):
            # Includes resources, mechanism modes and phase: destination alone is insufficient.
            if p.get("post_state_complete") is not True:
                result["status"] = "incomplete"
                signature = {"unproved_equivalence": p["id"]}
            else:
                signature = {"post_state": p["post_state"], "path_constraints": p.get("constraints_verified")}
            groups.setdefault(canonical(signature), []).append(p["id"])
        value = list(groups.values())
    elif key == "OP03":
        value = {"composition": focus.get("id"), "preconditions": verdict(focus)}
    elif key == "OP04":
        value = {"composition": focus.get("id"), "opens": links(focus)}
    elif key == "OP05":
        groups = {}
        for c in cs:
            groups.setdefault(canonical(c.get("effect", {})), []).append(c["id"])
        value = [g for g in groups.values() if len(g) > 1]
    elif key == "OP06":
        expected = focus.get("effect", {})
        value = [o for o in state.get("observations", []) if o["composition"] == focus.get("id")
                 and any(o.get("after", {}).get(k) != v for k, v in expected.items())]
    elif key == "OP07":
        value = [x for x in state.get("frontiers", []) if x.get("reachable") is True
                 and x.get("visited") is not True and x.get("open_goal_evidence")]
    elif key == "OP08":
        value = [c["id"] for c in cs if focus.get("id") in links(c)]
    elif key == "OP09":
        alternatives = state.get("alternatives", [])
        if state.get("alternatives_complete") is not True or not alternatives:
            result["status"] = "incomplete"
            value = {"mandatory": None, "reason": "alternative domain not proven complete"}
        else:
            value = sorted(set.intersection(*(set(x) for x in alternatives)))
    elif key == "OP10":
        value = [g["composition"] for g in state.get("goals", []) if g.get("terminal")]
    elif key == "OP11":
        value = {c["id"]: links(c) for c in cs if links(c)}
    elif key == "OP12":
        by_id = {c["id"]: c for c in cs}
        todo, seen, unknown = [focus.get("id")], set(), {}
        while todo and len(seen) < 64:
            cid = todo.pop()
            if cid in seen or cid not in by_id:
                continue
            seen.add(cid)
            c = by_id[cid]
            unknown[cid] = [k for k, v in verdict(c).items() if v == "unknown"]
            todo.extend(c.get("depends_on", []))
        value = {"unknowns": {k: v for k, v in unknown.items() if v}, "visited": sorted(seen)}
        if todo:
            result["status"] = "incomplete"
    elif key == "OP13":
        value = {"observed_effects": [o.get("after") for o in state.get("observations", [])
                  if o["composition"] == focus.get("id")], "unobserved_extent": "unknown"}
    elif key == "OP14":
        value = [c["id"] for c in cs if ready(c) and all(
            c.get("effect", {}).get(k, facts.get(k)) == v for k, v in state.get("preserve", {}).items())]
    elif key == "OP15":
        value = [g["id"] for g in state.get("goals", []) if not g.get("terminal")
                 and not g.get("completed") and all(facts.get(k) == v for k, v in g.get("requires", {}).items())]
    elif key == "OP16":
        value = [x for x in state.get("deadlocks", []) if x.get("proof") and x.get("scope") == "global"]
        result["completeness"] = "only supplied proved deadlocks; absence does not prove safety"
    elif key == "OP17":
        value = [x for x in state.get("recovery", []) if x.get("authorized") is True
                 and x.get("preserve_verified") is True]
    elif key == "OP18":
        value = [c["id"] for c in cs if not c.get("observed") and c.get("open_question")]
    elif key == "OP19":
        value = []
        for step in state.get("forced", []):
            if not step.get("proof") or step.get("constraints_verified") is not True:
                result["status"] = "incomplete"
                break
            value.append(step["action"])
    elif key == "OP20":
        value = [{"entity": x["id"], "status": "utility_hypothesis", "question": x.get("question")}
                 for x in state.get("entities", []) if x.get("utility") == "unknown"]
    elif key == "OP21":
        value = [{"space": x["id"], "status": "utility_hypothesis", "question": x.get("question")}
                 for x in state.get("spaces", []) if x.get("utility") == "unknown"]
    elif key == "OP22":
        value = [x for x in state.get("remote_effects", []) if x.get("observation")]
    elif key == "OP23":
        value = []
        for e in state.get("entities", []):
            if e.get("cycle") and e.get("cycle_proof"):
                value.append({"entity": e["id"], "next": e["cycle"][(e.get("phase", 0) + 1) % len(e["cycle"])],
                              "evidence": e["cycle_proof"]})
            elif e.get("autonomous"):
                value.append({"entity": e["id"], "next": "unknown"})
    elif key == "OP24":
        target = state.get("desired_post_state")
        value = [p["id"] for p in state.get("paths", [])
                 if p["post_state"] == target and p.get("constraints_verified") is True]
    elif key == "OP25":
        value = [c["id"] for c in cs if c.get("candidate_objective") and c.get("feasibility") != "refuted"]
    elif key == "OP26":
        value = [p["id"] for p in state.get("accesses", []) if p.get("target") == focus.get("id")
                 and p.get("constraints_verified") is True]
    elif key == "OP27":
        protected = set(state.get("preserve_refs", []))
        value = [p["id"] for p in state.get("permutations", []) if p.get("target") == focus.get("id")
                 and p.get("constraints_verified") is True and protected <= set(p.get("preserved_refs", []))]
    elif key == "OP28":
        value = [b["id"] for b in state.get("bundles", []) if b.get("composition_ref") == focus.get("id")
                 and b.get("admitted") is True and b.get("actions")]
    elif key == "OP29":
        expected, observed = state.get("expected_properties", {}), state.get("observed_properties", {})
        value = {k: {"expected": v, "observed": observed.get(k),
                     "status": "unknown" if k not in observed else "confirmed" if observed[k] == v else "refuted"}
                 for k, v in expected.items()}
    elif key == "OP30":
        value = [u for u in state.get("knowledge_updates", []) if u.get("composition_ref") == focus.get("id")
                 and u.get("evidence") and u.get("revision") == state.get("observation_revision")]
    elif key == "OP31":
        value = [{"composition_ref": g["composition_ref"], "satisfied": g.get("satisfied", "unknown"),
                  "feasible": g.get("feasible", "unknown"), "new_evidence": g.get("new_evidence", [])}
                 for g in state.get("objective_assessments", [])]
    else:
        raise KeyError(key)
    result["value"] = value
    return result
