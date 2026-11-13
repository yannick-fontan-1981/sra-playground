#!/usr/bin/env python3
"""Development oracle for the intact V6 WHY/ACT engine and actual router.src.

No model is substituted and no environment/solution is loaded. All supplied
facts are the upstream synthetic symbolic fixture. NeutralEngine's exact class
AST is isolated only to avoid importing that module's unrelated game transport.
"""
from pathlib import Path
from copy import deepcopy
import ast
import hashlib
import json
import sys
import tempfile
import types

ROOT = Path(__file__).resolve().parents[1]
COMMIT = "786dcf51ca57773d8e3a8948ce9ea3655e7baf8e"
SOURCE = ROOT / "reference/v6" / COMMIT / "source"
LAYA = SOURCE / "agents/yf_arc3_v6/laya_proto"
sys.path[:0] = [str(LAYA), str(SOURCE)]
from catalog import OPERATIONS, TREE, RECONCILIATION
from memory import Memory
from engine import Engine
from composition import CompositionEngine, validate_bundle, operation_admission
from composition_cases import state as upstream_state, bundle as upstream_bundle
from src_bridge import SrcBridge, plain

neutral_path = LAYA / "neutral_probe_runtime.py"
neutral_module = types.ModuleType("oracle_neutral_engine")
neutral_module.__file__ = str(neutral_path)
neutral_module.CompositionEngine = CompositionEngine
sys.modules[neutral_module.__name__] = neutral_module
neutral_ast = ast.parse(neutral_path.read_text(encoding="utf8"), filename=str(neutral_path))
neutral_class = next(node for node in neutral_ast.body if isinstance(node, ast.ClassDef) and node.name == "NeutralEngine")
exec(compile(ast.Module(body=[neutral_class], type_ignores=[]), str(neutral_path), "exec"), neutral_module.__dict__)
NeutralEngine = neutral_module.NeutralEngine


def fresh_state():
    value = upstream_state()
    value["level_epoch"] = 1
    return value


def bundle(operation="OP18", kind="analysis", composition="B"):
    value = upstream_bundle("B0", operation, kind, composition=composition)
    value["level_epoch"] = 1
    if kind != "analysis":
        value["outcome_guard"] = {"path": ["value"], "contains": "B0" if operation == "OP28" else composition}
    return value


def request(b=None):
    b = deepcopy(b if b is not None else bundle())
    return {"episode": "set-by-case", "policy": "code_only", "level_epoch": 1,
            "context": "Synthetic observation contract, no game state or evaluator label.",
            "bundles": {"B0": b}, "candidates": ["B0"], "relevant_compositions": ["B", "G", "A"]}


def mutate(value, path, replacement=None, delete=False):
    value = deepcopy(value)
    cursor = value
    for key in path[:-1]:
        cursor = cursor[key]
    if delete:
        del cursor[path[-1]]
    else:
        cursor[path[-1]] = deepcopy(replacement)
    return value


def outcome(call):
    try:
        return {"accepted": True, "value": plain(call())}
    except Exception as error:
        return {"accepted": False, "error": {"name": type(error).__name__, "message": str(error)}}


def export():
    db = Memory(Path(tempfile.mkdtemp(prefix="v6-why-act-")) / "oracle.sqlite")
    db.import_catalog()
    bridge_cases, prepare_cases, callback_cases, validation_cases, admission_cases = [], [], [], [], []
    engines = {"Engine": Engine, "CompositionEngine": CompositionEngine, "NeutralEngine": NeutralEngine}

    def seed(identity, s=None, revision=1, current_key=None):
        values = [{"episode": identity, "key": "state", "value": fresh_state() if s is None else deepcopy(s),
                   "evidence": "synthetic-upstream-symbolic-fixture", "revision": revision}]
        if current_key is not None:
            values.append({"episode": identity, "key": "current_key", "value": current_key,
                           "evidence": "prior-src-decision", "revision": revision})
        for fact in values:
            db.put(fact["episode"], fact["key"], fact["value"], fact["evidence"], fact["revision"])
        return values

    def records(identity):
        facts = [{"episode": row[0], "key": row[1], "value": json.loads(row[2]), "evidence": row[3], "revision": row[4]}
                 for row in db.db.execute("SELECT episode,k,v,evidence,revision FROM facts WHERE episode=? ORDER BY k", (identity,))]
        traces = [{"episode": row[0], "kind": row[1], "body": json.loads(row[2])}
                  for row in db.db.execute("SELECT episode,kind,body FROM traces WHERE episode=? ORDER BY id", (identity,))]
        return {"facts": facts, "traces": traces}

    def run(identity, r, *, cls="NeutralEngine", s=None, current_key=None, revision=1):
        r = deepcopy(r); r["episode"] = identity
        facts = seed(identity, s, revision, current_key)
        engine = engines[cls](db)
        prepared = engine.prepare(r)
        bridge = SrcBridge(engine, continuous=True)
        output = outcome(lambda: bridge.run(r))
        if output["accepted"]:
            output["value"].pop("total_ms")
        bridge_cases.append({"id": identity, "engine": cls, "seed": facts, "request": r,
                             "prepared": prepared, "outcome": output, "memory": records(identity),
                             "sequence": bridge.sequence})

    # Every actual operation is evaluated through the unmodified SRC bridge.
    for operation in OPERATIONS:
        run("analysis-" + operation, request(bundle(operation)))

    for operation, composition in [("OP14", "A"), ("OP18", "B"), ("OP28", "B")]:
        s = fresh_state()
        if operation == "OP28":
            s["bundles"] = [{"id": "B0", "composition_ref": "B", "admitted": True, "actions": ["ACTION1", "ACTION2"]}]
        run("release-" + operation, request(bundle(operation, "probe" if operation == "OP18" else "realize", composition)), s=s)

    release = request(bundle("OP18", "probe"))
    for name, path, value in [
        ("no-outcome-proof", ["bundles", "B0", "outcome_guard"], None),
        ("wrong-outcome-reference", ["bundles", "B0", "outcome_guard", "contains"], "G"),
        ("empty-contract-evidence", ["bundles", "B0", "evidence"], []),
        ("unpreserved-composition", ["bundles", "B0", "preservation_evidence"], {}),
        ("empty-preservation-evidence", ["bundles", "B0", "preservation_evidence", "A"], []),
        ("unmet-precondition", ["bundles", "B0", "preconditions"], {"free": False}),
        ("unknown-precondition", ["bundles", "B0", "preconditions"], {"never_measured": True}),
    ]:
        run(name, mutate(release, path, value))
    observed = fresh_state(); observed["compositions"][2]["observed"] = True
    run("operation-does-not-select", release, s=observed)
    run("unspecified-physical-contract", request(bundle("OP01", "realize")))
    run("analysis-with-unmet-release-premises", mutate(request(bundle("OP14")), ["bundles", "B0", "evidence"], []))

    ambiguous = request()
    ambiguous["bundles"]["B1"] = {**bundle("OP14"), "id": "B1"}
    ambiguous["candidates"] = ["B0", "B1"]
    run("ambiguous-code-only-abstains", ambiguous)
    hybrid_unique = request(); hybrid_unique["policy"] = "hybrid"
    run("unique-hybrid-is-formal", hybrid_unique)
    run("recalls-current-key", request(), current_key=OPERATIONS["OP31"]["authority_refs"][0])
    explicit = request(); explicit["current_key"] = OPERATIONS["OP14"]["authority_refs"][0]
    run("explicit-current-key-wins", explicit, current_key=OPERATIONS["OP31"]["authority_refs"][0])
    supplied = request(); supplied.update(state={"untrusted": "request"}, revision=999, tree_sha="stale-request", state_evidence="untrusted")
    run("recalls-current-state-and-source", supplied)

    base = {"episode": "set-by-case", "policy": "code_only", "context": "Synthetic symbolic selection", "candidates": ["OP14"]}
    run("base-operation-only", base, cls="Engine")
    symbolic = {**base, "action": {"action_ref": "ACTION1"}, "outcome_guard": {"path": ["value"], "contains": "A"},
                "safety": {"authorized": True, "evidence": ["symbolic-contract"]}}
    run("base-symbolic-release", symbolic, cls="Engine")
    for name, path, value in [
        ("base-false-guard", ["outcome_guard", "contains"], "missing"),
        ("base-missing-path", ["outcome_guard", "path"], ["not-a-field"]),
        ("base-invalid-index", ["outcome_guard", "path"], ["value", 40]),
        ("base-guard-negative-index", ["outcome_guard"], {"path": ["value", -1], "equals": "A_alias"}),
        ("base-no-safety-authority", ["safety", "authorized"], False),
        ("base-empty-authority-list", ["safety", "authorized"], []),
        ("base-empty-authority-map", ["safety", "authorized"], {}),
        ("base-no-safety-evidence", ["safety", "evidence"], {}),
    ]:
        run(name, mutate(symbolic, path, value), cls="Engine")
    typed = deepcopy(symbolic); typed["candidates"] = ["OP29"]
    typed["outcome_guard"] = {"path": ["value", "orientation", "observed"], "equals": True}
    run("base-python-bool-equality", typed, cls="Engine")
    empty_action = deepcopy(symbolic); empty_action["action"] = {}
    run("base-empty-action-is-not-persisted", empty_action, cls="Engine")

    jump = {"id": "J0", "target": OPERATIONS["OP18"]["authority_refs"][0], "relation": "explicit_reference", "revision": 1,
            "description": "Inspect related clause; no game undo."}
    nav = {**base, "candidates": ["J0"], "navigation": [jump]}
    run("base-navigation", nav, cls="Engine")
    run("base-navigation-continuation", {**nav, "after_navigation": {"candidates": ["OP14"]}}, cls="Engine")
    neutral_nav = deepcopy(release); neutral_nav.update(candidates=["J0"], navigation=[jump])
    run("neutral-navigation", neutral_nav)
    run("neutral-navigation-release", {**neutral_nav, "after_navigation": {"candidates": ["B0"]}})
    run("composition-engine-prepare", request(), cls="CompositionEngine")

    # Contract validation is deliberately separate from physical admission.
    def validate(identity, b, s=None, revision=1):
        s = fresh_state() if s is None else s
        validation_cases.append({"id": identity, "bundle": b, "state": s, "revision": revision,
                                 "outcome": outcome(lambda: validate_bundle(b, s, revision))})
    good = bundle("OP18", "probe")
    validate("valid", good)
    for key in ["id", "operation_key", "composition_ref", "objective_ref", "preserve_refs", "observation_revision", "kind", "actions", "purpose", "preconditions", "evidence"]:
        validate("missing-" + key, mutate(good, [key], delete=True))
    for identity, path, replacement in [
        ("unknown-composition", ["composition_ref"], "missing"), ("unknown-objective", ["objective_ref"], "missing"),
        ("unknown-preservation", ["preserve_refs"], ["missing"]), ("unknown-operation", ["operation_key"], "OP32"),
        ("stale", ["observation_revision"], 0), ("unknown-kind", ["kind"], "execute"),
        ("empty-probe", ["actions"], []), ("overlong-probe", ["actions"], ["ACTION1"] * 33),
        ("max-bound", ["actions"], ["ACTION1"] * 32), ("empty-evidence", ["evidence"], []),
        ("empty-preservation", ["preservation_evidence"], {}), ("false-preservation", ["preservation_evidence", "A"], False),
        ("false-fact", ["preconditions"], {"free": False}), ("missing-fact", ["preconditions"], {"missing": None}),
        ("bool-equals-int", ["preconditions"], {"free": 1}), ("bool-revision", ["observation_revision"], True),
    ]:
        validate(identity, mutate(good, path, replacement))
    validate("analysis-empty-actions", bundle())
    validate("analysis-unbounded-actions", {**bundle(), "actions": ["ACTION1"] * 40})

    for op in ["OP14", "OP18", "OP28", "OP01"]:
        b = bundle(op, "realize")
        expected = "B0" if op == "OP28" else "B"
        result = {"operation": op, "status": "complete_on_supplied_state", "value": [expected]}
        candidates = [("selected", b, result), ("missing-guard", mutate(b, ["outcome_guard"], delete=True), result),
                      ("extra-guard", {**b, "outcome_guard": {**b["outcome_guard"], "additional": True}}, result),
                      ("wrong-operation", b, {**result, "operation": "OP31"}),
                      ("incomplete", b, {**result, "status": "incomplete_on_supplied_state"}),
                      ("missing-reference", b, {**result, "value": []}), ("string-value", b, {**result, "value": expected})]
        for identity, given, supplied_result in candidates:
            admission_cases.append({"id": op + ":" + identity, "bundle": given, "result": supplied_result,
                                    "expected": operation_admission(given, supplied_result)})

    def prepare_case(identity, r, *, s=None, cls="NeutralEngine", current_key=None):
        r = deepcopy(r); r["episode"] = "prepare:" + identity
        facts = seed(r["episode"], s, current_key=current_key)
        engine = engines[cls](db)
        prepare_cases.append({"id": identity, "engine": cls, "seed": facts, "request": r,
                              "outcome": outcome(lambda: engine.prepare(r))})
    for identity, path, value in [
        ("expected-label", ["expected"], None), ("expected-choice-label", ["expected_choice"], "B0"),
        ("wrong-request-epoch", ["level_epoch"], 2), ("wrong-bundle-epoch", ["bundles", "B0", "level_epoch"], 2),
        ("stale-contract", ["bundles", "B0", "observation_revision"], 0),
        ("bundle-identity", ["bundles", "B0", "id"], "different"),
        ("undeclared-candidate", ["candidates"], ["UNDECLARED"]),
        ("stale-navigation", ["navigation"], [{**jump, "revision": 0}]),
        ("bool-epoch-equality", ["level_epoch"], True),
    ]:
        prepare_case(identity, mutate(request(), path, value))
    prepare_case("wrong-observed-revision", request(), s={**fresh_state(), "observation_revision": 2})
    prepare_case("request-epoch-missing", mutate(request(), ["level_epoch"], delete=True))
    prepare_case("bundle-epoch-missing", mutate(request(), ["bundles", "B0", "level_epoch"], delete=True))
    prepare_case("base-allows-expected-prefix", {**base, "expected_explanation": "ignored by original base Engine"}, cls="Engine")
    prepare_case("composition-recalls-current", request(), cls="CompositionEngine", current_key=jump["target"])

    def callback(identity, method, factory, *, cls="NeutralEngine", r=None):
        r = deepcopy(request() if r is None else r); r["episode"] = "callback:" + identity
        facts = seed(r["episode"])
        engine = engines[cls](db)
        prepared = engine.prepare(r)
        args = factory(engine, prepared)
        supplied = deepcopy(args)
        output = outcome(lambda: getattr(engine, method)(*args))
        callback_cases.append({"id": identity, "engine": cls, "seed": facts, "request": r,
                               "method": method, "arguments": supplied, "outcome": output})

    callback("empty-domain", "src_context", lambda e, p: [e.src_begin({**p, "candidates": []})])
    callback("duplicate-domain", "src_context", lambda e, p: [e.src_begin({**p, "candidates": ["B0", "B0"]})])
    callback("not-unique", "src_unique", lambda e, p: [e.src_begin({**p, "candidates": ["B0", "B1"]})])
    callback("wrong-choice", "src_apply", lambda e, p: [e.src_begin(p), {"key": "missing", "method": "formal_unique"}])
    callback("wrong-source", "src_apply", lambda e, p: [e.src_begin({**p, "tree_sha": "stale"}), {"key": "B0", "method": "formal_unique"}])
    callback("base-wrong-choice", "src_apply", lambda e, p: [e.src_begin(p), {"key": "OP31", "method": "formal_unique"}], cls="Engine", r=base)
    callback("base-wrong-source", "src_apply", lambda e, p: [e.src_begin({**p, "tree_sha": "stale"}), {"key": "OP14", "method": "formal_unique"}], cls="Engine", r=base)
    callback("abstention-does-not-release", "src_apply", lambda e, p: [e.src_begin({**p, "tree_sha": "stale"}), {"key": "ABSTAIN", "method": "code_abstention", "model_ms": 0}])
    callback("release-requires-src-guard", "src_release", lambda e, p: [{"release_allowed": False}])
    callback("base-release-requires-src-guard", "src_release", lambda e, p: [{"release_allowed": False}], cls="Engine", r=base)
    callback("stale-jump", "src_apply", lambda e, p: [e.src_begin({**p, "navigation": [{**jump, "revision": 0}]}), {"key": "J0", "method": "formal_unique"}], cls="Engine", r=nav)
    callback("absent-cached-jump", "src_apply", lambda e, p: [e.src_begin({**p, "navigation": [{**jump, "target": "not-cached"}]}), {"key": "J0", "method": "formal_unique"}], cls="Engine", r=nav)
    # This records a source-produced result for laya-labelled evidence, without
    # ever evaluating or substituting a model.
    callback("record-model-choice-evidence", "src_apply", lambda e, p: [e.src_begin(p), {"key": "B0", "method": "laya", "model_ms": 0, "usage": {"source": "symbolic-test-only"}}])

    files = [LAYA / name for name in ["engine.py", "composition.py", "neutral_probe_runtime.py", "src_bridge.py", "router.src", "operations.py", "memory.py", "catalog.py", "composition_cases.py", "fixtures.py"]] + [TREE, RECONCILIATION]
    data = {"schema": "logos-engine.v6.composition-engine.oracle.v1", "commit": COMMIT,
            "scope": "Unchanged original WHY/ACT code and original SRC scheduler over upstream synthetic fixtures; no game or model is loaded.",
            "sourceHashes": {str(path.relative_to(SOURCE)): hashlib.sha256(path.read_bytes()).hexdigest() for path in files},
            "neutralClassIsolation": "Exact class AST only; source path and implementation attestation retain the original file SHA256.",
            "modelBranches": {"available": False, "reason": "No Laya model or weights supplied; model branches must explicitly report unavailable."},
            "bridgeCases": bridge_cases, "prepareCases": prepare_cases, "callbackCases": callback_cases,
            "validationCases": validation_cases, "admissionCases": admission_cases}
    path = ROOT / "tests/fixtures/v6-composition-engine-reference.json"
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf8")
    db.close()
    print(json.dumps({"bridgeCases": len(bridge_cases), "prepareCases": len(prepare_cases), "callbackCases": len(callback_cases),
                      "validationCases": len(validation_cases), "admissionCases": len(admission_cases), "bytes": path.stat().st_size}))


if __name__ == "__main__":
    export()
