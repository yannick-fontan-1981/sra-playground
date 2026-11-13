"""Reuse the real SRC compiler/scheduler, isolated from production registration."""
from __future__ import annotations
import hashlib
from pathlib import Path
import sys
from catalog import REPO, sha

sys.path.insert(0, str(REPO))
from agents.yf_arc3_v5.logos.types import EffectClass, FrozenMap
from agents.yf_arc3_v5.operators import OperatorAuthorityRegistry, OperatorRuntime
from agents.yf_arc3_v5.scheduler import SchedulerRuntimeRegistry, WorkflowStartRequest
from agents.yf_arc3_v5.scheduler.runtime import WorkflowScheduler
from agents.yf_arc3_v5.src.compiler import compile_source
from agents.yf_arc3_v5.src.symbols import CompilerEnvironment, SymbolDefinition, SymbolKind, ParameterSpec, TypeSpec
from agents.yf_arc3_v5.src.registry import WorkflowRegistry
from agents.yf_arc3_v5.state import EventStore

SRC_PATH = Path(__file__).with_name("router.src")


def plain(value):
    if isinstance(value, (dict, FrozenMap)):
        return {str(k): plain(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [plain(v) for v in value]
    return value


class SrcBridge:
    def __init__(self, engine, continuous=False):
        self.engine = engine
        self.continuous = continuous
        self.continuous_store = EventStore("run:laya-continuous") if continuous else None
        names = ["begin", "context", "unique", "abstain", "laya", "apply", "navigate", "resume", "complete_navigation", "release", "reject", "result"]
        import inspect
        implementation_path = Path(inspect.getfile(type(engine)))
        definitions = []
        for name in names:
            args = ["request"] if name == "begin" else ["session", "choice"] if name in {"apply", "navigate"} else ["session"]
            definitions.append(SymbolDefinition(
                id="prototype." + name, kind=SymbolKind.WORKFLOW,
                parameters=tuple(ParameterSpec(name=arg, type_spec=TypeSpec(name="Any")) for arg in args),
                output_type=TypeSpec(name="Any"), effect_class=EffectClass.PURE,
                source_unit="prototype.laya_router.callbacks", source_hash=sha(implementation_path)))
        environment = CompilerEnvironment(types=("Any", "Boolean", "Integer", "String", "Ref", "List", "Set", "Map"),
                                          symbols=tuple(definitions))
        self.module = compile_source(SRC_PATH.read_text(encoding="utf-8"), source_name=str(SRC_PATH), environment=environment)
        self.workflows = WorkflowRegistry()
        self.entry = self.workflows.register(self.module)
        self.calls = SchedulerRuntimeRegistry()
        for definition in definitions:
            name = definition.id.split(".")[-1]
            callback = getattr(engine, "src_" + name)
            self.calls.register_call(definition, lambda ctx, fn=callback: fn(**plain(ctx.arguments)))
        self.calls.validate_compiled_calls((self.module,), active_workflow_refs=("prototype.laya_router.route",))
        self.calls.seal_qualified()
        self.sequence = 0

    def run(self, request):
        import time
        started = time.perf_counter()
        # Durable reads/writes surround the pure SRC computation. Pure callbacks
        # never mutate the game or SQLite. Timing includes both durable boundaries.
        request = self.engine.prepare(request)
        self.sequence += 1
        store = self.continuous_store if self.continuous else EventStore(f"run:laya-prototype-{self.sequence}")
        scheduler = WorkflowScheduler(workflow_registry=self.workflows, runtime_registry=self.calls,
                                     operator_runtime=OperatorRuntime(store, OperatorAuthorityRegistry()))
        identity = f"instance:laya-{self.sequence}"
        scheduler.start(WorkflowStartRequest(
            workflow_definition_id="prototype.laya_router.route", workflow_instance_id=identity,
            run_id=store.run_id, timeline_id="timeline:laya-continuous" if self.continuous else f"timeline:{self.sequence}", frame_id=f"frame:{self.sequence}",
            expected_transitive_source_hash=self.entry.transitive_source_hash, inputs={"request": request}))
        result = scheduler.advance_bounded(identity, instruction_quantum=128, maximum_instructions=1024,
                                           durable_boundaries_only=True)
        checkpoint = result.checkpoint
        if checkpoint.status.value != "completed":
            raise RuntimeError(f"SRC prototype did not complete: {checkpoint.status.value}")
        report = {"src_status": checkpoint.status.value,
                "src_hash": self.entry.transitive_source_hash,
                "src_statement_count_last_slice": len(result.executed_statement_ids),
                "decision": self.engine.last_result}
        self.engine.persist(request, report)
        report["total_ms"] = (time.perf_counter() - started) * 1000
        return report
