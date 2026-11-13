"""31 operations, composition-bound bundles, persistent memory and official probe."""
import argparse
import copy
import json
import os
from pathlib import Path
import sys
import time
import traceback
from benchmark import durable, quantiles, source_plan
from catalog import OPERATIONS, REPO, sha
from composition import CompositionEngine, validate_bundle
from composition_cases import state, cases, bundle, NEW_EXPECTED
from fixtures import EXPECTED_VALUES
from memory import Memory, pack
from operations import execute
from src_bridge import SrcBridge


def check_operations():
    expected = {**EXPECTED_VALUES, **NEW_EXPECTED}
    failures = [k for k, v in expected.items() if execute(k, state())["value"] != v]
    if failures:
        raise RuntimeError("Operation mismatch: " + str(failures))
    return {"checked": len(expected), "matched": len(expected)}


def evaluate(bridge, memory, case, policy, prefix=""):
    request = {k: copy.deepcopy(v) for k, v in case.items() if not k.startswith("expected")}
    request.update(episode=prefix+policy+":"+case["id"], policy=policy)
    memory.put(request["episode"], "state", state(), evidence="synthetic-evaluation-input", revision=1)
    result = bridge.run(request)
    d = result["decision"]
    first_nav = next((t["key"] for t in d["trace"] if t["kind"] == "choice"), None)
    correct = d["selected"] == case["expected_choice"] and ("expected_navigation" not in case or first_nav == case["expected_navigation"])
    return {"id": case["id"], "kind": case["kind"], "policy": policy, "correct": correct,
            "expected_choice": case["expected_choice"], **result}


def enrich_cases(memory):
    result = cases()
    for case in result[:12]:
        forced = copy.deepcopy(case)
        forced.update(id="forced-"+case["id"], kind="formal_unique", candidates=[case["expected_choice"]])
        result.append(forced)
    for index, case in enumerate(cases()[-12::3]):
        nav = copy.deepcopy(case)
        current = OPERATIONS["OP03"]["authority_refs"][0]
        window = memory.window(current)
        neighbors = [n for n in window["neighbors"] if n["relation"] in {"previous_text", "next_text"}]
        if len(neighbors) != 2:
            raise RuntimeError("Documentary neighbors missing")
        options = [{"id": "N"+str(i), "target": n["key"], "relation": n["relation"], "revision": 1,
                    "description": "Revenir à la clause précédente" if n["relation"] == "previous_text" else "Avancer à la clause suivante"}
                   for i, n in enumerate(neighbors)]
        nav.update(id="nav-"+case["id"], kind="navigation_then_set", current_key=current,
                   context="Relire la clause précédente avant de poursuivre le choix d'une composition, sans annuler les actions du jeu.",
                   navigation=options, candidates=[n["id"] for n in options],
                   after_navigation={"context": case["context"], "candidates": case["candidates"]},
                   expected_navigation=next(n["id"] for n in options if n["relation"] == "previous_text"))
        result.append(nav)
    return result


def official_probe(bridge, memory, out):
    from tools.yf_v5_env_bridge import OfficialEnvSession
    env = OfficialEnvSession("ls20-9607627b")
    before = env.reset()
    durable(out / "ls20-before.json", before.to_dict())
    if before.level != 1 or before.levels_completed != 0:
        raise RuntimeError("Expected official LS20 initial L1")
    # No oracle input, coordinates, winning route, or inferred hidden mechanic.
    # This is a bounded input/observation calibration experiment, not a solver.
    comp = {"id": "C_control_observed", "things": ["scene", "input_channel"],
            "properties": {"control_effect": "unknown"}, "relations": ["input may change scene"],
            "context": "official LS20 initial observation", "knowledge_status": "hypothesized", "role": "information_objective"}
    live_state = {"compositions": [comp], "facts": {"calibration_authorized": True}, "observation_revision": 1,
                  "memory_hint": "Aucun mécanisme ni chemin gagnant n'est connu. Deux commandes constituent le probe entier."}
    proposals = {}
    for i, (actions, purpose) in enumerate([
        (["ACTION1", "ACTION2"], "Observer l'effet d'une paire de commandes directionnelles verticales opposées"),
        (["ACTION3", "ACTION4"], "Observer l'effet d'une paire de commandes directionnelles horizontales opposées")]):
        if all(a in before.available_action_refs for a in actions):
            proposals["P"+str(i)] = {"id": "P"+str(i), "operation_key": "OP18", "composition_ref": comp["id"],
                "objective_ref": comp["id"], "preserve_refs": [], "observation_revision": 1,
                "kind": "probe", "actions": actions, "purpose": purpose, "preconditions": {"calibration_authorized": True},
                "evidence": ["user-authorized-bounded-L1-probe", before.frame_hash], "preservation_evidence": {},
                "stop_on": ["official_level_boundary", "terminal", "unavailable_action"]}
    if len(proposals) < 2:
        raise RuntimeError("Official directional probe domain unavailable")
    episode = "official-ls20-probe"
    memory.put(episode, "state", live_state, evidence=before.frame_hash, revision=1)
    started = time.perf_counter()
    report = bridge.run({"episode": episode, "id": episode, "policy": "hybrid", "kind": "official_probe",
                         "context": "Choisir un ensemble de calibration directionnelle pour observer comment une entrée modifie la scène. Les effets sont inconnus.",
                         "bundles": proposals, "candidates": list(proposals), "relevant_compositions": [comp["id"]]})
    durable(out / "ls20-choice.json", report)
    d = report["decision"]
    if d["status"] != "action_set_released":
        raise RuntimeError("SRC did not release a probe")
    released = d["action_set"]
    if released != proposals[released["id"]] or env.snapshot().frame_hash != before.frame_hash:
        raise RuntimeError("Released action set/source observation mismatch")
    snapshots, first_action_ms = [], None
    # Mechanical execution of the exact frozen prefix, with no intervening
    # Laya choice or semantic analysis. Every observed packet stays local.
    with (out / "ls20-execution.jsonl").open("x", encoding="utf8") as stream:
        for action in released["actions"]:
            current = env.snapshot()
            if current.level != before.level or current.state in {"GAME_OVER", "WIN"}:
                break
            if action not in current.available_action_refs:
                break
            stream.write(pack({"event": "dispatch", "action": action, "bundle": released["id"]})+"\n")
            stream.flush()
            os.fsync(stream.fileno())
            after = env.step(action)
            if first_action_ms is None:
                first_action_ms = (time.perf_counter()-started)*1000
            snapshots.append(after.to_dict())
            stream.write(pack({"event": "observed", **after.to_dict()})+"\n")
            stream.flush()
            os.fsync(stream.fileno())
    final = env.snapshot()
    memory.put(episode, "probe_result", {"bundle": released["id"], "frames": snapshots,
               "interpretation": "unknown; pixel change alone does not establish control or reversibility"},
               evidence="official-environment-observations", revision=2)
    memory.put(episode, "state", {**live_state, "observation_revision": 2}, evidence=final.frame_hash, revision=2)
    return {"status": "probe_completed", "game": before.game_id, "actions": len(snapshots),
            "first_action_ms": first_action_ms, "full_set_ms": (time.perf_counter()-started)*1000,
            "choice_and_release_ms": report["total_ms"], "levels_completed": final.levels_completed,
            "l1_passed": final.levels_completed >= 1, "choice_quality": "unlabelled; both probes admissible",
            "initial_hash": before.frame_hash, "final_hash": final.frame_hash,
            "qualification": "official environment probe, not an autonomous L1 solving run"}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True)
    parser.add_argument("--official-probe", action="store_true")
    args = parser.parse_args()
    out = Path(args.output).resolve()
    out.mkdir(parents=True, exist_ok=False)
    memory = None
    from agents.yf_arc3_v6.__main__ import session_slot
    plan = source_plan()
    durable(out / "plan.json", plan)
    with session_slot() as lease:
        durable(out / "lease.json", {"pid": os.getpid(), "lease": lease})
        try:
            checked = check_operations()
            durable(out / "operations-check.json", checked)
            memory = Memory(out / "memory.sqlite3")
            catalog = memory.import_catalog()
            engine = CompositionEngine(memory)
            bridge = SrcBridge(engine)
            # Required contract controls, no model inference or invented oracle.
            example = copy.deepcopy(cases()[-6])
            bad = next(k for k, b in example["bundles"].items() if not b["preservation_evidence"])
            example.update(id="preservation-control", candidates=[bad], expected_choice=bad)
            rejection = evaluate(bridge, memory, example, "code_only", "control:")
            if rejection["decision"]["status"] != "action_guard_rejected":
                raise RuntimeError("Preservation guard accepted unsafe bundle")
            stale = bundle("stale", "OP18", "probe")
            stale["observation_revision"] = 0
            try:
                validate_bundle(stale, state(), 1)
            except ValueError:
                pass
            else:
                raise RuntimeError("Stale contract accepted")
            durable(out / "contract-check.json", {"preservation_rejected": True, "stale_rejected": True})
            import laya
            import torch
            if not torch.cuda.is_available():
                raise RuntimeError("Actual CUDA required")
            model = REPO / ".local/qwen/laya-multilingual-1720e3e3"
            identity = json.loads((REPO / "runs/yf_arc3_v6/laya-model-identity-20261104.json").read_text())
            tokenizer = json.loads((REPO / "runs/yf_arc3_v6/laya-runtime-tokenizer-identity-20261104.json").read_text())
            for name, info in identity["files"].items():
                expected = tokenizer["effective_sha256"] if name == "tokenizer/tokenizer_config.json" else info["sha256"]
                if sha(model/name) != expected:
                    raise RuntimeError("Model identity mismatch")
            started = time.perf_counter()
            engine.agent = laya.load(str(model), device="cuda", backend="eager")
            torch.cuda.synchronize()
            load_ms = (time.perf_counter()-started)*1000
            archive = memory.seed_archive(engine.agent.tok)
            memory.close()
            memory = Memory(out / "memory.sqlite3")
            engine.memory = memory
            warmup = evaluate(bridge, memory, cases()[0], "hybrid", "warmup:")
            durable(out / "warmup.json", warmup)
            rows = []
            with (out / "cases.jsonl").open("x", encoding="utf8") as journal:
                for policy in ["code_only", "hybrid"]:
                    for case in enrich_cases(memory):
                        row = evaluate(bridge, memory, case, policy)
                        rows.append(row)
                        journal.write(pack(row)+"\n")
                        journal.flush()
                        os.fsync(journal.fileno())
                    print(pack({"policy_completed": policy, "cases": len(rows)}), flush=True)
            groups = []
            for policy in ["code_only", "hybrid"]:
                for kind in sorted({r["kind"] for r in rows}):
                    rr = [r for r in rows if r["policy"] == policy and r["kind"] == kind]
                    released = [r for r in rr if r["decision"].get("action_set")]
                    calls = [c for r in rr for c in r["decision"]["model_calls"]]
                    groups.append({"policy": policy, "kind": kind, "cases": len(rr), "correct": sum(r["correct"] for r in rr),
                        "abstained": sum(r["decision"]["status"] == "abstained" for r in rr),
                        "released_sets": len(released), "wrong_released_sets": sum(not r["correct"] for r in released),
                        "guard_rejected": sum(r["decision"]["status"] == "action_guard_rejected" for r in rr),
                        "end_to_end": quantiles([r["total_ms"] for r in rr]),
                        "correct_release_latency": quantiles([r["total_ms"] for r in released if r["correct"]]),
                        "model_latency": quantiles([c["model_ms"] for c in calls]),
                        "max_input_tokens": max((c["usage"]["input_tokens"] for c in calls), default=0)})
            live = official_probe(bridge, memory, out) if args.official_probe else {"status": "NONRUN"}
            durable(out / "ls20-report.json", live)
            # Reopen the DB and retrieve a composition contract and an OP30 update.
            contract = memory.get("hybrid:operation-30-0", "composition_contract")
            memory.close()
            memory = Memory(out / "memory.sqlite3")
            persistence = memory.get("hybrid:operation-30-0", "composition_contract") == contract
            changed = [p for p, digest in plan["source"].items() if sha(p) != digest]
            if changed:
                raise RuntimeError("Source changed during unit")
            report = {"status": "completed", "operations": checked, "catalog": catalog,
                      "archive": archive, "composition_contract_survives_reopen": persistence,
                      "device": torch.cuda.get_device_name(), "load_ms": load_ms,
                      "groups": groups, "ls20": live, "training": "none; zero-shot",
                      "production_v5_modified": False, "production_v5_speedup": "UNMEASURED",
                      "limitations": ["Synthetic routing labels, no real-game success implied", "Candidates and action sets supplied, not discovered by Laya", "Code baseline abstains unless unique", "Admission guards do not prove semantic usefulness"]}
            durable(out / "report.json", report)
            print(pack({"status": "completed", "cases": len(rows), "ls20": live}), flush=True)
        except BaseException as exc:
            durable(out / "failure.json", {"error": repr(exc), "traceback": traceback.format_exc(), "status": "stopped"})
            raise
        finally:
            if memory is not None:
                memory.close()


if __name__ == "__main__":
    main()
