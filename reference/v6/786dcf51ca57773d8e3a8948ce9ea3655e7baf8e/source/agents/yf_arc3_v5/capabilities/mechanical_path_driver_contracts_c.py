"""Finite PATH orchestration inputs, independent of physical action release."""
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenModel, FrozenMap, Ref
from .mechanical_contracts_b import MechanicalRequestB
from .mechanical_common_contracts_c import SimulationPathInputC, EventCompositionResultC
from .mechanical_step_contracts_c import ExternalStepDispatchResultC
from .mechanical_request_contracts import MechanicalNormalizedReturn


class PathPrimitiveC(FrozenModel):
    action_ref: Ref
    data: FrozenMap
    cost: int = Field(ge=0)


class PathDriverInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.path_driver_input_c.v1"
    path: SimulationPathInputC
    primitives: tuple[PathPrimitiveC, ...] = Field(default=(), max_length=1024)
    provider_template: MechanicalRequestB | None = None
    provider_kernel_ref: Ref | None = None


class PathDriverSessionC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.path_driver_session_c.v1"
    request: PathDriverInputC
    cursor: int = Field(ge=0)
    result: EventCompositionResultC
    last_return: MechanicalNormalizedReturn | None = None
    facts: FrozenMap


class PathNextStepInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.path_next_step_input_c.v1"
    session: PathDriverSessionC
    primitive: PathPrimitiveC


class PathStepFoldInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.path_step_fold_input_c.v1"
    session: PathDriverSessionC
    dispatched: ExternalStepDispatchResultC


class SourceReferenceEqualityInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.source_reference_equality_input_c.v1"
    left: Ref | None
    right: Ref


class SourceReferenceEqualityResultC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.source_reference_equality_result_c.v1"
    equal: bool


class PathDriverNativeInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.path_driver_native_input_c.v1"
    session: PathDriverSessionC
    source_status: Ref
    missing_cause: Ref | None
