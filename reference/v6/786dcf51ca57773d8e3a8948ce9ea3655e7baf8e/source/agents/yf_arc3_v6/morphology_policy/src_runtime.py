"""Small adapter for executing a real V5 SRC workflow against declared callbacks."""
from collections.abc import Mapping
from hashlib import sha256
from inspect import getsourcefile, signature
from pathlib import Path
from uuid import uuid4

from agents.yf_arc3_v5.logos.types import EffectClass
from agents.yf_arc3_v5.operators import OperatorAuthorityRegistry, OperatorRuntime
from agents.yf_arc3_v5.scheduler import SchedulerRuntimeRegistry, WorkflowStartRequest
from agents.yf_arc3_v5.scheduler.contracts import SRC_TERMINAL_BINDING_REF
from agents.yf_arc3_v5.scheduler.runtime import WorkflowScheduler
from agents.yf_arc3_v5.src.compiler import compile_source
from agents.yf_arc3_v5.src.registry import WorkflowRegistry
from agents.yf_arc3_v5.src.symbols import CompilerEnvironment, ParameterSpec, SymbolDefinition, SymbolKind, TypeSpec
from agents.yf_arc3_v5.state import EventStore


def plain(value):
    if isinstance(value, Mapping):
        return {k: plain(v) for k, v in value.items()}
    if isinstance(value, (tuple, list)):
        return [plain(v) for v in value]
    return value


class SrcProgram:
    def __init__(self, path, workflow_id, callbacks):
        self.workflow_id = workflow_id
        self.calls = SchedulerRuntimeRegistry()
        self.workflows = WorkflowRegistry()
        definitions = []
        for name, callback in callbacks.items():
            code_path = Path(getsourcefile(callback))
            definition = SymbolDefinition(id=name, kind=SymbolKind.WORKFLOW,
                parameters=tuple(ParameterSpec(name=k, type_spec=TypeSpec(name="Any"))
                                 for k in signature(callback).parameters),
                output_type=TypeSpec(name="Any"), effect_class=EffectClass.PURE,
                source_unit=str(code_path), source_hash=sha256(code_path.read_bytes()).hexdigest())
            definitions.append(definition)
            self.calls.register_call(definition, lambda ctx, fn=callback: fn(**plain(ctx.arguments)))
        environment = CompilerEnvironment(types=("Any","Boolean","Integer","String","Ref","List","Set","Map"),
                                          symbols=tuple(definitions))
        source = Path(path)
        self.module = compile_source(source.read_text(encoding="utf8"), source_name=str(source), environment=environment)
        self.entry = self.workflows.register(self.module)
        self.calls.validate_compiled_calls((self.module,), active_workflow_refs=(workflow_id,))
        self.calls.seal_qualified()

    def run(self, inputs):
        identity = "instance:" + uuid4().hex
        store = EventStore("run:" + identity.split(":")[1])
        scheduler = WorkflowScheduler(workflow_registry=self.workflows, runtime_registry=self.calls,
            operator_runtime=OperatorRuntime(store, OperatorAuthorityRegistry()))
        scheduler.start(WorkflowStartRequest(workflow_definition_id=self.workflow_id, workflow_instance_id=identity,
            run_id=store.run_id, timeline_id="timeline:policy", frame_id="frame:policy",
            expected_transitive_source_hash=self.entry.transitive_source_hash, inputs=inputs))
        step = scheduler.advance_bounded(identity, instruction_quantum=128, maximum_instructions=1024,
                                         durable_boundaries_only=True)
        checkpoint = step.checkpoint
        if checkpoint.status.value != "completed":
            raise ValueError(f"SRC {self.workflow_id}: {checkpoint.status.value}, {checkpoint.terminal_result}")
        bindings = checkpoint.local_bindings
        result = plain(bindings[bindings[SRC_TERMINAL_BINDING_REF]])
        receipt = dict(workflow=self.workflow_id, src_hash=self.entry.transitive_source_hash,
                       src_status=checkpoint.status.value, executed_statements=list(step.executed_statement_ids))
        return result, receipt
