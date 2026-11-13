"""Acquired parent questions for K28; no physical execution authority."""
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenModel,FrozenMap,Ref
from .finite_instruction_device import DeviceRequest,DeviceEffect,DeviceActor
from .coupled_solving_contracts_c import CoupledParentWhyC
from .family_agenda_projection import FamilyAgendaSnapshot,FamilyAgendaDemand
from .articulated_solving_contracts_c import ArticulatedAcquiredFieldC
from .latent_solving_contracts_c import LatentCausalBindingC
from .mechanical_request_contracts import MechanicalNormalizedReturn
from .family_result_join import FamilyJoinRequest,FamilyJoinResult
from ..drm.meaning import DeclaredMeaningInstantiation
from .finite_search_contracts_c import FiniteSearchInputC,FiniteSearchFactsC
from .mechanical_search_driver_contracts_c import SearchPrimitiveC
from .family_effect_publication_contracts import FamilyEffectPublicationRequest,FamilyEffectPublicationResult
from .latent_solving_contracts_c import LatentOwnerPublicationBindingC
from .native_memory_owner_contracts_d import DNativeMemoryContext,DNativeMemoryOwnerRequest,DNativeMemoryOwnerReturn,DNativeMemoryReadRequest


class DeviceFieldBindingC(FrozenModel):
    native_field_ref: Ref
    acquisition: ArticulatedAcquiredFieldC


class DeviceReceptaclePropertyC(FrozenModel):
    property_ref: Ref
    acquisition: ArticulatedAcquiredFieldC


class DeviceReceptacleSourceC(FrozenModel):
    receptacle_ref: Ref
    target_ref: Ref
    target_term_ref: Ref
    target_claim_ref: Ref
    contract_field: ArticulatedAcquiredFieldC
    properties: tuple[DeviceReceptaclePropertyC,...] = Field(min_length=1,max_length=5)


class DeviceHazardSourceC(FrozenModel):
    schedule_field: ArticulatedAcquiredFieldC
    contact_field: ArticulatedAcquiredFieldC
    output_term_ref: Ref


class DeviceExecutionIndicatorContractC(FrozenModel):
    contract_ref: Ref
    region_ref: Ref
    completed_count_key: Ref
    busy_key: Ref
    checkpoint_key: Ref
    interference_key: Ref
    counts_completed_slots_in_program_order: bool
    resets_on_program_launch: bool
    observes_checkpoint_and_actor_interference: bool


class DeviceExecutionIndicatorSourceC(FrozenModel):
    contract: DeviceExecutionIndicatorContractC
    contract_binding: LatentCausalBindingC
    launch_field: ArticulatedAcquiredFieldC
    progress_field: ArticulatedAcquiredFieldC


class DeviceStageEditGroupC(FrozenModel):
    slot_ref: Ref
    trait_ref: Ref
    before: Ref
    after: Ref
    primitives: tuple[SearchPrimitiveC,...] = Field(min_length=1,max_length=64)


class DeviceStageCostPlanC(FrozenModel):
    variable_ref: Ref
    value_ref: Ref
    candidate_ref: Ref
    trial_ref: Ref | None = None
    edit_request: DeviceRequest
    edit_return: MechanicalNormalizedReturn
    edit_groups: tuple[DeviceStageEditGroupC,...] = Field(max_length=256)
    launch_primitives: tuple[SearchPrimitiveC,...] | None = Field(default=None,max_length=64)
    discovery_primitives: tuple[SearchPrimitiveC,...] | None = Field(default=None,max_length=256)
    route_primitives: tuple[SearchPrimitiveC,...] | None = Field(default=None,max_length=256)


class DeviceStageCostSourceC(FrozenModel):
    query: FiniteSearchInputC
    query_field: ArticulatedAcquiredFieldC
    plan_fields: tuple[ArticulatedAcquiredFieldC,...] = Field(min_length=1,max_length=128)


class DeviceReleasedPredictionC(FrozenModel):
    native_request: DeviceRequest
    returned: MechanicalNormalizedReturn


class DevicePrimitivePredictionC(DeviceReleasedPredictionC):
    primitive_ordinal: int = Field(ge=0,le=63)
    action_ref: Ref
    action_payload: FrozenMap
    edit_transition_field: ArticulatedAcquiredFieldC | None = None


class DeviceOperatorUnitsC(FrozenModel):
    coordinate_unit_ref: Ref
    horizontal_pitch: int = Field(ge=1)
    vertical_pitch: int = Field(ge=1)
    scale_numerator: tuple[int,int]
    scale_denominator: tuple[int,int]


class DeviceOperatorWitnessC(FrozenModel):
    effect: DeviceEffect
    before_signature: FrozenMap
    observation_refs: tuple[Ref,...] = Field(min_length=1,max_length=256)
    acquisition_context: FrozenMap | None = None
    world_preconditions: FrozenMap | None = None


class DeviceOperatorMethodC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.device_operator_method_c.v1"
    content_kind_ref: Ref = "WHOLE_DEVICE_OPERATOR_ALTERNATIVES"
    trait_order: tuple[Ref,...] = Field(min_length=1,max_length=16)
    units: DeviceOperatorUnitsC
    witnesses: tuple[DeviceOperatorWitnessC,...] = Field(min_length=1,max_length=1024)
    operator_status_promoted: bool = False
    real_world_legality_inferred: bool = False


class DeviceOperatorCaptureC(FrozenModel):
    context: DNativeMemoryContext
    memory_term_ref: Ref
    memory_claim_ref: Ref


class DeviceOperatorRecallC(FrozenModel):
    memory: DNativeMemoryReadRequest
    expected_content_digest: Ref


class DeviceCheckpointContinuationC(FrozenModel):
    candidate_ref: Ref
    preparatory_trial_ref: Ref | None = None
    checkpoint_request: DeviceRequest
    next_program_request: DeviceRequest
    edit_preservation_claim_ref: Ref


class DeviceCheckpointSourceC(FrozenModel):
    capacity_field: ArticulatedAcquiredFieldC
    plan_field: ArticulatedAcquiredFieldC


class DeviceCheckpointStrategySourceC(FrozenModel):
    request_field: ArticulatedAcquiredFieldC
    edit_preservation_claim_ref: Ref


class DeviceTraitActuatorC(FrozenModel):
    slot_ref: Ref
    trait_ref: Ref
    before: Ref
    after: Ref
    action_ref: Ref
    payload: FrozenMap
    hit_point: tuple[int,int]


class DeviceEditCompilerSourceC(FrozenModel):
    actuator_fields: tuple[ArticulatedAcquiredFieldC,...] = Field(max_length=256)


class DevicePhaseIndicatorContractC(FrozenModel):
    contract_ref: Ref
    phase_by_marker: FrozenMap
    ordinal_resets_on_launch: bool
    counts_completed_phases: bool


class DevicePhaseObservationC(FrozenModel):
    ordinal: int = Field(ge=0,le=4096)
    slot_ref: Ref
    phase_marker_ref: Ref
    code_ref: Ref
    actor: DeviceActor
    clock: int = Field(ge=0)
    remaining_budget: int = Field(ge=0)
    status: Ref


class DevicePhaseTraceSourceC(FrozenModel):
    contract: DevicePhaseIndicatorContractC
    contract_binding: LatentCausalBindingC
    phase_fields: tuple[ArticulatedAcquiredFieldC,...] = Field(min_length=1,max_length=256)
    boundary_field: ArticulatedAcquiredFieldC


class DeviceObservedIntervalC(FrozenModel):
    packet_term_ref: Ref
    packet_projection_contract_ref: Ref
    state_projection_contract_ref: Ref
    expected_packet_fields: FrozenMap
    transactions: tuple[FrozenMap,...] = Field(min_length=1,max_length=64)
    before_fields: tuple[ArticulatedAcquiredFieldC,...] = Field(min_length=1,max_length=64)
    after_fields: tuple[ArticulatedAcquiredFieldC,...] = Field(min_length=1,max_length=64)
    control_fields: tuple[ArticulatedAcquiredFieldC,...] = Field(min_length=1,max_length=64)
    released_prediction_field: ArticulatedAcquiredFieldC | None = None
    primitive_prediction_fields: tuple[ArticulatedAcquiredFieldC | None,...] = Field(default=(),max_length=64)
    phase_traces: tuple[DevicePhaseTraceSourceC | None,...] = Field(default=(),max_length=64)


class DeviceDemoSourceC(FrozenModel):
    packet_term_ref: Ref
    packet_projection_contract_ref: Ref
    state_projection_contract_ref: Ref
    expected_packet_fields: FrozenMap
    transactions: tuple[FrozenMap,...] = Field(min_length=1,max_length=64)
    before_fields: tuple[ArticulatedAcquiredFieldC,...] = Field(min_length=1,max_length=64)
    after_fields: tuple[ArticulatedAcquiredFieldC,...] = Field(min_length=1,max_length=64)
    focused_slot_ref: Ref
    execution_field: ArticulatedAcquiredFieldC
    execution_indicator: DeviceExecutionIndicatorSourceC | None = None
    isolation_phase_trace: DevicePhaseTraceSourceC | None = None


class DeviceSolvingInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.device_solving_input_c.v1"
    why: CoupledParentWhyC
    agenda: FamilyAgendaSnapshot
    demand: FamilyAgendaDemand
    native_request: DeviceRequest
    field_bindings: tuple[DeviceFieldBindingC,...] = Field(max_length=32)
    causal_bindings: tuple[LatentCausalBindingC,...] = Field(default=(),max_length=256)
    parent_maximum_evaluations: int = Field(default=65536,ge=1,le=65536)
    join_request: FamilyJoinRequest | None = None
    demo_sources: tuple[DeviceDemoSourceC,...] = Field(default=(),max_length=16)
    stage_cost_source: DeviceStageCostSourceC | None = None
    observed_intervals: tuple[DeviceObservedIntervalC,...] = Field(default=(),max_length=16)
    owner_publication_binding: LatentOwnerPublicationBindingC | None = None
    operator_units_field: ArticulatedAcquiredFieldC | None = None
    operator_capture: DeviceOperatorCaptureC | None = None
    operator_recalls: tuple[DeviceOperatorRecallC,...] = Field(default=(),max_length=16)
    checkpoint_source: DeviceCheckpointSourceC | None = None
    edit_compiler_source: DeviceEditCompilerSourceC | None = None
    instruction_capacity_field: ArticulatedAcquiredFieldC | None = None
    checkpoint_strategy_source: DeviceCheckpointStrategySourceC | None = None
    receptacle_source: DeviceReceptacleSourceC | None = None
    hazard_source: DeviceHazardSourceC | None = None


class DeviceSolvingFactsC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.device_solving_facts_c.v1"
    frozen_input: DeviceSolvingInputC
    facts: FrozenMap
    reasons: tuple[FrozenMap,...]
    missing_refs: tuple[Ref,...]
    acquisition_work: int = Field(default=0,ge=0)


class DeviceSolvingBindC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.device_solving_bind_c.v1"
    measured: DeviceSolvingFactsC


class DeviceIsolationJoinC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.device_isolation_join_c.v1"
    measured: DeviceSolvingFactsC
    meanings: tuple[FrozenMap,...]


class DeviceSolvingFinishC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.device_solving_finish_c.v1"
    measured: DeviceSolvingFactsC
    returned: MechanicalNormalizedReturn | None


class DeviceSolvingReturnC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.device_solving_return_c.v1"
    frozen_measurement: DeviceSolvingFactsC
    returned: MechanicalNormalizedReturn | None
    missing_refs: tuple[Ref,...]
    receipt: FrozenMap = Field(default_factory=FrozenMap)
    parent_return: FrozenMap = Field(default_factory=FrozenMap)
    joined: FamilyJoinResult | None = None
    proposed_action: None = None
    evidence_meanings: tuple[FrozenMap,...] = Field(default=(),max_length=128)
    stage_cost_result: FiniteSearchFactsC | None = None
    observed_effect_meanings: tuple[FrozenMap,...] = Field(default=(),max_length=128)


class DeviceJoinInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.device_join_input_c.v1"
    returned: DeviceSolvingReturnC


class DeviceJoinFactsC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.device_join_facts_c.v1"
    facts: FrozenMap
    missing_refs: tuple[Ref,...]


class DeviceJoinFinishC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.device_join_finish_c.v1"
    returned: DeviceSolvingReturnC
    measured: DeviceJoinFactsC
    joined: FamilyJoinResult | None


class DeviceEvidenceInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.device_evidence_input_c.v1"
    returned: DeviceSolvingReturnC


class DeviceEvidenceRowsC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.device_evidence_rows_c.v1"
    rows: tuple[FrozenMap,...] = Field(default=(),max_length=128)
    missing_refs: tuple[Ref,...] = ()
    accounted_evaluations: int = Field(default=0,ge=0)


class DeviceEvidenceAppendC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.device_evidence_append_c.v1"
    prior: tuple[FrozenMap,...] = Field(max_length=128)
    meaning: DeclaredMeaningInstantiation


class DeviceEvidenceSealC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.device_evidence_seal_c.v1"
    returned: DeviceSolvingReturnC
    measured: DeviceEvidenceRowsC
    meanings: tuple[FrozenMap,...] = Field(max_length=128)


class DeviceExecutionFactsC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.device_execution_facts_c.v1"
    request: DeviceSolvingInputC
    facts: FrozenMap
    rows: tuple[FrozenMap,...] = Field(default=(),max_length=16)
    missing_refs: tuple[Ref,...] = ()
    accounted_evaluations: int = Field(default=0,ge=0)


class DeviceExecutionJoinC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.device_execution_join_c.v1"
    measured: DeviceSolvingFactsC
    execution: DeviceExecutionFactsC


class DeviceStageCostFactsC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.device_stage_cost_facts_c.v1"
    returned: DeviceSolvingReturnC
    facts: FrozenMap
    rows: tuple[FrozenMap,...] = Field(default=(),max_length=128)
    missing_refs: tuple[Ref,...] = ()
    accounted_evaluations: int = Field(default=0,ge=0)


class DeviceStageCostFinishC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.device_stage_cost_finish_c.v1"
    measured: DeviceStageCostFactsC
    result: FiniteSearchFactsC | None


class DeviceObservedFactsC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.device_observed_facts_c.v1"
    returned: DeviceSolvingReturnC
    rows: tuple[FrozenMap,...] = Field(default=(),max_length=128)
    missing_refs: tuple[Ref,...] = ()
    accounted_evaluations: int = Field(default=0,ge=0)


class DeviceObservedSealC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.device_observed_seal_c.v1"
    returned: DeviceSolvingReturnC
    measured: DeviceObservedFactsC
    meanings: tuple[FrozenMap,...] = Field(max_length=128)


class DeviceOwnerPublicationFactsC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.device_owner_publication_facts_c.v1"
    publication_request: FamilyEffectPublicationRequest | None = None
    facts: FrozenMap
    missing_refs: tuple[Ref,...] = ()


class DeviceOwnerPublicationJoinC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.device_owner_publication_join_c.v1"
    returned: DeviceSolvingReturnC
    publication: DeviceOwnerPublicationFactsC
    published: FamilyEffectPublicationResult | None = None


class DeviceOperatorMethodFactsC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.device_operator_method_facts_c.v1"
    returned: DeviceSolvingReturnC
    method: DeviceOperatorMethodC | None = None
    missing_refs: tuple[Ref,...] = ()
    accounted_evaluations: int = Field(default=0,ge=0)


class DeviceOperatorMethodJoinC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.device_operator_method_join_c.v1"
    measured: DeviceOperatorMethodFactsC


class DeviceMemoryFactsC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.device_memory_facts_c.v1"
    returned: DeviceSolvingReturnC
    memory_request: DNativeMemoryOwnerRequest | None = None
    facts: FrozenMap
    missing_refs: tuple[Ref,...] = ()


class DeviceMemoryRequestC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.device_memory_request_c.v1"
    request: DNativeMemoryOwnerRequest


class DeviceMemoryJoinC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.device_memory_join_c.v1"
    measured: DeviceMemoryFactsC
    captured: DNativeMemoryOwnerReturn | None


class DeviceCheckpointFactsC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.device_checkpoint_facts_c.v1"
    returned: DeviceSolvingReturnC
    plan: DeviceCheckpointContinuationC | None = None
    facts: FrozenMap
    missing_refs: tuple[Ref,...] = ()
    accounted_evaluations: int = Field(default=0,ge=0)


class DeviceCheckpointInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.device_checkpoint_input_c.v1"
    measured: DeviceCheckpointFactsC
    checkpoint_return: MechanicalNormalizedReturn | None = None
    next_return: MechanicalNormalizedReturn | None = None


class DeviceCheckpointStrategyFactsC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.device_checkpoint_strategy_facts_c.v1"
    returned: DeviceSolvingReturnC
    next_queries: tuple[DeviceRequest,...] = Field(default=(),max_length=128)
    preparatory_rows: tuple[FrozenMap,...] = Field(default=(),max_length=128)
    result_rows: tuple[FrozenMap,...] = Field(default=(),max_length=128)
    facts: FrozenMap
    missing_refs: tuple[Ref,...] = ()
    accounted_evaluations: int = Field(default=0,ge=0)


class DeviceStrategyQuestionFactsC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.device_strategy_question_facts_c.v1"
    returned: DeviceSolvingReturnC
    facts: FrozenMap
    missing_refs: tuple[Ref,...] = ()
    accounted_evaluations: int = Field(default=0,ge=0)


class DeviceCheckpointTriggerC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.device_checkpoint_trigger_c.v1"
    returned: DeviceSolvingReturnC
    query: DeviceRequest | None = None
    facts: FrozenMap
    missing_refs: tuple[Ref,...] = ()
    accounted_evaluations: int = Field(default=0,ge=0)


class DeviceCheckpointTriggerInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.device_checkpoint_trigger_input_c.v1"
    measured: DeviceCheckpointTriggerC
    child_return: MechanicalNormalizedReturn | None = None


class DeviceReceptacleFactsC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.device_receptacle_facts_c.v1"
    request: DeviceSolvingInputC
    facts: FrozenMap
    missing_refs: tuple[Ref,...] = ()
    accounted_evaluations: int = Field(default=0,ge=0)


class DeviceReceptacleJoinC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.device_receptacle_join_c.v1"
    measured: DeviceSolvingFactsC
    receptacle: DeviceReceptacleFactsC


class DeviceCheckpointStrategyInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.device_checkpoint_strategy_input_c.v1"
    measured: DeviceCheckpointStrategyFactsC
    index: int = Field(default=0,ge=0,le=127)
    next_return: MechanicalNormalizedReturn | None = None
    meanings: tuple[FrozenMap,...] = Field(default=(),max_length=128)


class DeviceCheckpointNextFactsC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.device_checkpoint_next_facts_c.v1"
    measured: DeviceCheckpointFactsC
    checkpoint_return: MechanicalNormalizedReturn
    facts: FrozenMap
    missing_refs: tuple[Ref,...] = ()


class DeviceCheckpointNextInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.device_checkpoint_next_input_c.v1"
    measured: DeviceCheckpointNextFactsC
    next_return: MechanicalNormalizedReturn | None


class DeviceEditCompilerFactsC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.device_edit_compiler_facts_c.v1"
    returned: DeviceSolvingReturnC
    facts: FrozenMap
    groups: tuple[DeviceStageEditGroupC,...] = Field(default=(),max_length=256)
    missing_refs: tuple[Ref,...] = ()
    accounted_evaluations: int = Field(default=0,ge=0)
    chain_queries: tuple[FiniteSearchInputC,...] = Field(default=(),max_length=256)
    chain_metadata: tuple[FrozenMap,...] = Field(default=(),max_length=256)


class DeviceEditCompilerFinishC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.device_edit_compiler_finish_c.v1"
    measured: DeviceEditCompilerFactsC
    meaning: DeclaredMeaningInstantiation | None


class DeviceEditChainBindC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.device_edit_chain_bind_c.v1"
    measured: DeviceEditCompilerFactsC
    index: int = Field(ge=0,le=255)


class DeviceEditChainAppendC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.device_edit_chain_append_c.v1"
    measured: DeviceEditCompilerFactsC
    index: int = Field(ge=0,le=255)
    result: FiniteSearchFactsC
