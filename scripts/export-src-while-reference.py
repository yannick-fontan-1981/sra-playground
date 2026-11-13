"""Execute bounded WHILE contracts on the pinned original V5 scheduler."""
from __future__ import annotations

import argparse
from collections.abc import Mapping
import hashlib
import json
from pathlib import Path
import sys


SITE = Path(__file__).resolve().parents[1]
COMMIT = "786dcf51ca57773d8e3a8948ce9ea3655e7baf8e"
SOURCE = """MODULE test.bounded_loop

WORKFLOW run(request: Any) -> Any
    STATE
        session: Any
    STEP begin
        CALL test.begin(request=request) -> session
        NEXT examine
    STEP examine
        WHILE test.condition(session=session)
            PROGRESS test.progress(session=session)
            STOP WHEN test.stop(session=session)
            MAX DEPTH DEPTH
            ON LIMIT DEFER unresolved
            DO
                CALL test.advance(session=session) -> session
        STOP session
"""


def plain(value):
    if isinstance(value, Mapping):
        return {str(key): plain(item) for key, item in value.items()}
    if isinstance(value, (tuple, list)):
        return [plain(item) for item in value]
    return value


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-root", type=Path, default=SITE / "reference/v6" / COMMIT / "source")
    parser.add_argument("--output", type=Path, default=SITE / "tests/fixtures/src-while-reference.json")
    args = parser.parse_args()
    root = args.source_root.resolve()
    sys.path.insert(0, str(root))
    from agents.yf_arc3_v5.logos.types import EffectClass
    from agents.yf_arc3_v5.operators import OperatorAuthorityRegistry, OperatorRuntime
    from agents.yf_arc3_v5.scheduler import SchedulerRuntimeRegistry, WorkflowStartRequest
    from agents.yf_arc3_v5.scheduler.contracts import SRC_TERMINAL_BINDING_REF
    from agents.yf_arc3_v5.scheduler.runtime import WorkflowScheduler
    from agents.yf_arc3_v5.src.compiler import compile_source
    from agents.yf_arc3_v5.src.registry import WorkflowRegistry
    from agents.yf_arc3_v5.src.symbols import CompilerEnvironment, ParameterSpec, SymbolDefinition, SymbolKind, TypeSpec
    from agents.yf_arc3_v5.state import EventStore

    manifest = json.loads((SITE / "reference/v6" / COMMIT / "manifest.json").read_text())
    checked = {}
    for name in ("agents/yf_arc3_v5/src/compiler.py", "agents/yf_arc3_v5/scheduler/runtime.py"):
        digest = hashlib.sha256((root / name).read_bytes()).hexdigest()
        if digest != manifest["files"][name]["sha256"]:
            raise ValueError("Reference source changed: " + name)
        checked[name] = digest
    callback_hash = hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
    definitions = tuple(SymbolDefinition(id="test." + name, kind=SymbolKind.WORKFLOW,
        parameters=(ParameterSpec(name="request" if name == "begin" else "session", type_spec=TypeSpec(name="Any")),),
        output_type=TypeSpec(name="Boolean" if name in ("condition", "stop") else "Integer" if name == "progress" else "Any"),
        effect_class=EffectClass.PURE, source_unit="test.bounded_loop.callbacks", source_hash=callback_hash)
        for name in ("begin", "advance", "condition", "stop", "progress"))
    environment = CompilerEnvironment(types=("Any", "Boolean", "Integer", "String", "Ref", "List", "Set", "Map"), symbols=definitions)
    programs = {}
    for depth in (1, 3, 8):
        module = compile_source(SOURCE.replace("DEPTH\n", str(depth) + "\n"), source_name=f"bounded-{depth}.src", environment=environment)
        programs[str(depth)] = module
    scenarios = [
        ("stops_on_last_admitted_iteration", 3, dict(pending=True, done=False, increment=1, finishAt=3, conditionAt=99)),
        ("condition_stops_before_depth", 8, dict(pending=True, done=False, increment=1, finishAt=99, conditionAt=2)),
        ("no_progress_precedes_false_condition", 8, dict(pending=True, done=False, increment=0, finishAt=99, conditionAt=1)),
        ("depth_precedes_false_condition", 1, dict(pending=True, done=False, increment=1, finishAt=99, conditionAt=1)),
        ("initial_stop_still_evaluates_condition", 8, dict(pending=True, done=True, increment=0, finishAt=99, conditionAt=99)),
        ("false_initial_condition_skips_progress", 8, dict(pending=False, done=False, increment=1, finishAt=99, conditionAt=99)),
    ]
    cases = []
    for identity, depth, request in scenarios:
        log = []

        def callback(name, arguments):
            args = plain(arguments)
            if name == "begin":
                log.append("begin")
                return dict(args["request"], index=0, progress=0)
            session = args["session"]
            log.append(f"{name}:{session['index']}")
            if name == "condition": return session["pending"]
            if name == "stop": return session["done"]
            if name == "progress": return session["progress"]
            index = session["index"] + 1
            return dict(session, index=index, progress=session["progress"] + session["increment"],
                        done=index >= session["finishAt"], pending=index < session["conditionAt"])

        workflows = WorkflowRegistry()
        module = programs[str(depth)]
        entry = workflows.register(module)
        calls = SchedulerRuntimeRegistry()
        for definition in definitions:
            name = definition.id.split(".")[-1]
            calls.register_call(definition, lambda ctx, name=name: callback(name, ctx.arguments))
        calls.validate_compiled_calls((module,), active_workflow_refs=("test.bounded_loop.run",))
        calls.seal_qualified()
        store = EventStore("run:" + identity)
        scheduler = WorkflowScheduler(workflow_registry=workflows, runtime_registry=calls,
            operator_runtime=OperatorRuntime(store, OperatorAuthorityRegistry()))
        scheduler.start(WorkflowStartRequest(workflow_definition_id="test.bounded_loop.run", workflow_instance_id="instance:" + identity,
            run_id=store.run_id, timeline_id="timeline:test", frame_id="frame:test",
            expected_transitive_source_hash=entry.transitive_source_hash, inputs={"request": request}))
        result = scheduler.advance("instance:" + identity, max_instructions=1024, durable_boundaries_only=True)
        checkpoint = result.checkpoint
        bindings = checkpoint.local_bindings
        value = plain(bindings[bindings[SRC_TERMINAL_BINDING_REF]]) if checkpoint.status.value == "completed" else checkpoint.terminal_result
        cases.append({"id": identity, "depth": depth, "inputs": {"request": request}, "expected": {
            "status": checkpoint.status.value, "value": value, "session": plain(bindings["session"]),
            "calls": log, "executedStatements": list(result.executed_statement_ids)}})
    args.output.write_text(json.dumps({"schema": "src.while.python-reference.v1", "commit": COMMIT, "sourceHashes": checked,
        "programs": {key: plain(module.model_dump(mode="json")) for key, module in programs.items()}, "cases": cases}, indent=2) + "\n")
    print(json.dumps({"cases": len(cases), "statuses": [case["expected"]["status"] for case in cases]}))


if __name__ == "__main__":
    main()
