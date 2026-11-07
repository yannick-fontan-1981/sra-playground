"""Source-owned K23 questions derived from one immutable parent agenda."""
from typing import Literal
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenMap, FrozenModel, Ref
from .family_agenda_projection import FamilyAgendaSnapshot, FamilyAgendaDemand
from .coupled_value_contracts_c import CoupledValueRequestC, CoupledValueSourceReturnC
from .mechanical_request_contracts import MechanicalNormalizedReturn, MechanicalResponseInput
from .family_result_join import FamilyJoinGroup, FamilyJoinRequest, FamilyJoinResult

class CoupledLocalConstraintC(FrozenModel):
    constraint_ref: Ref
    anchor_ref: Ref
    reference_parameter_ref: Ref
    reference_value_ref: Ref | None
    kind: Literal["SAME", "DIFFERENT", "VALUES", "EXISTS", "ABSENT", "PROTECTED"]
    marked_offset: tuple[int, int]
    scale_numerator: tuple[int, int]
    scale_denominator: tuple[int, int]
    requested_values: tuple[Ref, ...]
    evidence_refs: tuple[Ref, ...]
    correlation_ref: Ref | None

class CoupledParentWhyC(FrozenModel):
    parent_goal_ref: Ref
    consumer_ref: Ref
    next_item_ref: Ref
    question_ref: Ref
    desired_future: FrozenMap
    utility_reason_ref: Ref
    usefulness_premise_refs: tuple[Ref, ...]
    morphology_premise_refs: tuple[Ref, ...]
    and_dependency_refs: tuple[Ref, ...]
    or_dependency_refs: tuple[Ref, ...]
    preservation_refs: tuple[Ref, ...]
    falsifier_ref: Ref
    episode_ref: Ref
    level_scope_ref: Ref
    temporal_scope_ref: Ref

class CoupledSolvingInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.coupled_solving_input_c.v1"
    why: CoupledParentWhyC
    agenda: FamilyAgendaSnapshot
    native_template: CoupledValueRequestC
    constraints: tuple[CoupledLocalConstraintC, ...] = Field(max_length=4096)
    field_goal_evidence_refs: tuple[Ref, ...]
    requested_question: Literal["MAPPING", "SETS", "EXISTENCE", "STENCILS", "ACTUAL_ACTIONS", "JOINT_REPAIR", "BINARY", "DIRECTIONAL", "NONBINARY", "CONTRADICTION", "MEASURE", "FIT", "PRECONDITION", "SUCCESSOR"]
    nonbinary_method: Literal["CSP", "DP"]
    retained_model_refs: tuple[Ref, ...]
    declared_stencil_offsets: tuple[tuple[int, int], ...] = Field(default=(), max_length=4096)
    stencil_geometry_evidence_refs: tuple[Ref, ...] = ()
    self_effect_status: Literal["UNKNOWN", "INCLUDED", "EXCLUDED"] = "UNKNOWN"
    self_effect_evidence_refs: tuple[Ref, ...] = ()
    mechanical_prerequisite_request_refs: tuple[Ref, ...] = Field(default=(), max_length=128)

class CoupledSolvingMeasurementC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.coupled_solving_measurement_c.v1"
    frozen_input: CoupledSolvingInputC
    facts: FrozenMap
    projected_constraints: tuple[FrozenMap, ...]
    missing_refs: tuple[Ref, ...]
    stencil_probe_facts: tuple[FrozenMap, ...] = ()

class CoupledSolvingMeasureInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.coupled_solving_measure_input_c.v1"
    request: CoupledSolvingInputC
    canonical_agenda_rows: tuple[FrozenMap, ...]

class CoupledSolvingQuestionC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.coupled_solving_question_c.v1"
    frozen_measurement: CoupledSolvingMeasurementC
    native_request: CoupledValueRequestC | None
    demand: FamilyAgendaDemand | None
    source_disposition_ref: Ref
    source_reason_ref: Ref
    missing_refs: tuple[Ref, ...]
    proposed_action: None = None

class CoupledSolvingBindInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.coupled_solving_bind_input_c.v1"
    measured: CoupledSolvingMeasurementC
    source_disposition_ref: Ref
    source_reason_ref: Ref

class CoupledSolvingReceiptInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.coupled_solving_receipt_input_c.v1"
    question: CoupledSolvingQuestionC
    returned: CoupledValueSourceReturnC
    current_agenda: FamilyAgendaSnapshot

class CoupledSolvingReceiptFactsC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.coupled_solving_receipt_facts_c.v1"
    frozen_input: CoupledSolvingReceiptInputC
    facts: FrozenMap
    missing_refs: tuple[Ref, ...]

class CoupledSolvingResponseInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.coupled_solving_response_input_c.v1"
    measured: CoupledSolvingReceiptFactsC
    source_status: Ref

class CoupledSolvingConsumedC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.coupled_solving_consumed_c.v1"
    frozen_input: CoupledSolvingReceiptInputC
    normalized: MechanicalNormalizedReturn | None
    receipt: FrozenMap
    next_item_ref: Ref
    parent_why: CoupledParentWhyC
    proposed_action: None = None

class CoupledSolvingConsumeInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.coupled_solving_consume_input_c.v1"
    measured: CoupledSolvingReceiptFactsC
    normalized: MechanicalNormalizedReturn | None

class CoupledSolvingExecutionInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.coupled_solving_execution_input_c.v1"
    question: CoupledSolvingQuestionC
    current_agenda: FamilyAgendaSnapshot

class CoupledSolvingAnswerInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.coupled_solving_answer_input_c.v1"
    request: CoupledSolvingExecutionInputC
    native_return: CoupledValueSourceReturnC | None
    consumed: CoupledSolvingConsumedC | None

class CoupledSolvingAnswerC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.coupled_solving_answer_c.v1"
    request: CoupledSolvingExecutionInputC
    native_return: CoupledValueSourceReturnC | None
    consumed: CoupledSolvingConsumedC | None
    missing_refs: tuple[Ref, ...]
    proposed_action: None = None

class CoupledSolvingJoinInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.coupled_solving_join_input_c.v1"
    answer: CoupledSolvingAnswerC
    join_request_ref: Ref
    candidate_prefix_ref: Ref
    peer_groups: tuple[FamilyJoinGroup, ...] = Field(max_length=127)
    max_pairs: int = Field(ge=0, le=65536)
    max_candidates: int = Field(ge=0, le=4096)

class CoupledSolvingJoinFactsC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.coupled_solving_join_facts_c.v1"
    frozen_input: CoupledSolvingJoinInputC
    request: FamilyJoinRequest | None
    facts: FrozenMap
    missing_refs: tuple[Ref, ...]

class CoupledSolvingJoinReturnInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.coupled_solving_join_return_input_c.v1"
    measured: CoupledSolvingJoinFactsC
    joined: FamilyJoinResult | None

class CoupledSolvingJoinedC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.coupled_solving_joined_c.v1"
    frozen_measurement: CoupledSolvingJoinFactsC
    joined: FamilyJoinResult | None
    next_item_ref: Ref
    proposed_action: None = None
