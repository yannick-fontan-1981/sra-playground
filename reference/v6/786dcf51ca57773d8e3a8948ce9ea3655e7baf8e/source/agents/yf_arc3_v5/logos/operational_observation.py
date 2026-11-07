"""A witnessed dispatch/response interval, distinct from a learned effect."""
from typing import Literal
from pydantic import Field, model_validator, model_serializer
from .types import FrozenModel, FrozenMap, Ref, stable_digest


class OperationalConsciousnessParticipantMeasurement(FrozenModel):
    """Compact current geometry; a bbox is not an occupied-cell/collision model."""
    entity_ref: Ref
    component_ref: Ref
    bounds: tuple[int, int, int, int]
    pixel_area: int = Field(ge=1)
    observed_value: int
    relative_shape_digest: Ref
    identity_status: Ref
    match_kind: Ref
    possible_predecessor_entity_refs: tuple[Ref, ...] = ()
    full_occupancy_transported: Literal[False] = False

    @model_validator(mode='after')
    def valid_bounds(self):
        top, left, bottom, right = self.bounds
        if bottom < top or right < left:
            raise ValueError('participant measurement has reversed bounds')
        return self


class OperationalConsciousnessMeasuredEffect(FrozenModel):
    """Observed scene measurements, not a participant-specific causal law."""
    before_frame_ref: Ref
    after_frame_ref: Ref
    before_raw_input_ref: Ref
    after_raw_input_ref: Ref
    transition_ref: Ref
    action_ref: Ref
    action_data_digest: Ref
    measurement_digest: Ref
    observed_packet_digest: Ref | None = None
    packet_dimensions_consistent: bool
    intermediate_frame_count: int = Field(ge=0)
    changed_edges: int = Field(ge=0)
    final_changed_count: int = Field(ge=0)
    potential_nonzero_translation_count: int = Field(ge=0)
    final_scene_equivalent_with_intermediate_change: bool
    before_configuration_digest: Ref | None
    after_configuration_digest: Ref | None
    configuration_transition_changed: bool | None
    score_delta: int | None
    participant_causality_established: Literal[False] = False
    grants_action: Literal[False] = False

    @model_validator(mode='after')
    def exact_packet_summary(self):
        if self.observed_packet_digest is not None and (len(self.observed_packet_digest) != 64
                or any(char not in '0123456789abcdef' for char in self.observed_packet_digest)):
            raise ValueError('physical observation has an invalid ordered packet digest')
        if self.changed_edges > self.intermediate_frame_count + 1:
            raise ValueError('physical observation has more changed edges than frame pairs')
        if self.final_scene_equivalent_with_intermediate_change and (
                self.final_changed_count != 0 or not self.intermediate_frame_count or not self.changed_edges):
            raise ValueError('transient-only change lost its measured intermediate frame')
        return self

    @model_serializer(mode='wrap')
    def preserve_prior_measurement_shape(self, handler):
        data = handler(self)
        if self.observed_packet_digest is None:
            data.pop('observed_packet_digest', None)
        return data

    def canonical_field_names(self):
        return tuple(name for name in self.__class__.model_fields
            if name != 'observed_packet_digest' or self.observed_packet_digest is not None)


class OperationalConsciousnessObservedApplication(FrozenModel):
    schema_version: Literal['operational_consciousness_observed_application.v1'] = 'operational_consciousness_observed_application.v1'
    observation_ref: Ref
    intent_ref: Ref
    permit_ref: Ref
    dispatch_ref: Ref
    acquisition_ref: Ref
    timeline_ref: Ref
    world_context_ref: Ref
    before_frame_ref: Ref
    after_frame_ref: Ref
    action_ref: Ref
    action_data: FrozenMap
    dispatch_request_digest: Ref
    dispatch_response_digest: Ref
    control_signature: FrozenMap | None
    goal_frontier_digest: Ref | None
    physical_effect: OperationalConsciousnessMeasuredEffect | None = None
    physical_effect_record_ref: Ref | None = None
    physical_effect_missing_refs: tuple[Ref, ...] = ()
    effect_established: Literal[False] = False
    grants_action: Literal[False] = False

    @model_validator(mode='after')
    def preserve_measured_interval(self):
        effect = self.physical_effect
        if effect is not None and (not self.physical_effect_record_ref or self.physical_effect_missing_refs
                or effect.before_frame_ref != self.before_frame_ref or effect.after_frame_ref != self.after_frame_ref
                or effect.action_ref != self.action_ref or effect.action_data_digest != stable_digest(self.action_data)):
            raise ValueError('observed application changed its physical measurement interval')
        if effect is None and self.physical_effect_record_ref is not None:
            raise ValueError('physical observation reference has no measured value')
        if 'physical_effect' in self.model_fields_set and effect is None and not self.physical_effect_missing_refs:
            raise ValueError('physical observation requires a measurement or explicit missing evidence')
        return self

    @model_serializer(mode='wrap')
    def preserve_prior_observation_shape(self, handler):
        data = handler(self)
        for field in ('physical_effect', 'physical_effect_record_ref', 'physical_effect_missing_refs'):
            if field not in self.model_fields_set:
                data.pop(field, None)
        return data

    def canonical_field_names(self):
        return tuple(name for name in self.__class__.model_fields
            if name not in ('physical_effect', 'physical_effect_record_ref', 'physical_effect_missing_refs')
            or name in self.model_fields_set)


class OperationalConsciousnessApplicationAssociation(FrozenModel):
    """Exact pre-action candidate join; receiver membership is not slot order."""
    goal_ref: Ref
    review_ref: Ref
    observation_ref: Ref
    domain_ref: Ref | None = None
    mechanism_ref: Ref | None = None
    experiment_control_return_refs: tuple[Ref, ...] = ()
    acquisition_returns: FrozenMap = Field(default_factory=FrozenMap)
    assessment_read_failures: FrozenMap = Field(default_factory=FrozenMap)
    conditioning_signature_ref: Ref | None = None
    candidate_refs: tuple[Ref, ...] = ()
    missing_refs: tuple[Ref, ...] = ()
    operator_matches: bool | None = None
    addressed_control_matches: bool | None = None
    participant_order_ambiguous: bool = False
    effect_established: Literal[False] = False
    conditioning_revalidated: Literal[False] = False
    grants_action: Literal[False] = False

    @model_validator(mode='after')
    def exact_candidate_join(self):
        from .operational_assessment_read import OperationalConsciousnessAssessmentRead
        for receipt_ref, raw in sorted(self.assessment_read_failures.items()):
            reading = OperationalConsciousnessAssessmentRead.model_validate(raw)
            if (reading.receipt_ref != receipt_ref or reading.bound_return is not None
                    or not set(reading.failed_check_refs).issubset(self.missing_refs)):
                raise ValueError('application association lost its exact rejected assessment read')
        if len(set(self.candidate_refs)) != len(self.candidate_refs):
            raise ValueError('application association repeats a frozen candidate')
        if self.candidate_refs and (self.missing_refs or self.domain_ref is None
                or self.conditioning_signature_ref is None or self.operator_matches is not True
                or self.addressed_control_matches is not True):
            raise ValueError('application association has candidates without their exact binding')
        if self.participant_order_ambiguous and len(self.candidate_refs) < 2:
            raise ValueError('application ordering ambiguity lost its alternatives')
        if 'mechanism_ref' in self.model_fields_set and self.domain_ref is not None and self.mechanism_ref is None:
            raise ValueError('current application domain lost its explicit native mechanism')
        return self

    @model_serializer(mode='wrap')
    def preserve_prior_association_shape(self, handler):
        data = handler(self)
        for name in ('mechanism_ref', 'experiment_control_return_refs', 'acquisition_returns', 'assessment_read_failures'):
            if name not in self.model_fields_set:
                data.pop(name, None)
        return data

    def canonical_field_names(self):
        return tuple(name for name in self.__class__.model_fields
            if name not in ('mechanism_ref', 'experiment_control_return_refs', 'acquisition_returns', 'assessment_read_failures') or name in self.model_fields_set)
