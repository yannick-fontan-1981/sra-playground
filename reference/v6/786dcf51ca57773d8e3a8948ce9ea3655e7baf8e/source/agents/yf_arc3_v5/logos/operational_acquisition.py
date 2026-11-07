"""Shared action-conditioned observation contracts, with typed source adapters."""
from typing import Literal
from pydantic import Field, model_validator, model_serializer
from .types import FrozenModel, FrozenMap, Ref, stable_digest


class OperationalExperimentAction(FrozenModel):
    action_ref: Ref
    action_data: FrozenMap = Field(default_factory=FrozenMap)


class OperationalExperimentObservable(FrozenModel):
    field_ref: Ref
    attribute_path: tuple[str | int, ...] = Field(min_length=1, max_length=16)
    support_predicate: Ref
    acquired_source_kind_ref: Ref


class OperationalExperimentParticipantObservable(FrozenModel):
    """An exact tracked entity field, not a fabricated canonical TERM/CLAIM."""
    field_ref: Ref
    participant_ref: Ref
    measurement_field_ref: Literal['bounds', 'observed_value', 'relative_shape_digest', 'pixel_area']
    source_workflow_refs: tuple[Ref, ...] = Field(min_length=1, max_length=16)


class OperationalExperimentExecution(FrozenModel):
    actions: tuple[OperationalExperimentAction, ...] = Field(min_length=1, max_length=256)
    observables: tuple[OperationalExperimentObservable | OperationalExperimentParticipantObservable, ...] = Field(min_length=1, max_length=256)

    @model_validator(mode='after')
    def distinct_observation_slots(self):
        if len({item.field_ref for item in self.observables}) != len(self.observables):
            raise ValueError('acquisition contract repeats an observable identity')
        return self


class OperationalOpenResponseDomain(FrozenModel):
    """A scoped unknown response, not a placeholder causal model."""
    question_ref: Ref
    observation_contract_ref: Ref
    execution_contract_digest: Ref
    observable_field_refs: tuple[Ref, ...] = Field(min_length=1, max_length=256)
    context_signature: FrozenMap
    support_evidence_refs: tuple[Ref, ...] = Field(min_length=1, max_length=256)
    falsifier_refs: tuple[Ref, ...] = Field(min_length=1, max_length=256)
    causal_models_declared: Literal[False] = False
    response_domain_complete: Literal[False] = False
    grants_action: Literal[False] = False

    @model_validator(mode='after')
    def distinct_observables(self):
        if len(set(self.observable_field_refs)) != len(self.observable_field_refs):
            raise ValueError('open response domain repeats an observable')
        return self


class OperationalConsciousnessExperimentAssessmentLink(FrozenModel):
    """An examined native question; it never authorizes the accompanying action."""
    nomination_ref: Ref
    acquisition_contract_ref: Ref
    request_digest: Ref
    assessment_ref: Ref
    consumption_ref: Ref
    source_disposition_ref: Ref
    grants_action: Literal[False] = False
    accompanying_action_admitted_by_this_assessment: Literal[False] = False


class OperationalConsciousnessNativeAcquisition(FrozenModel):
    contract_ref: Ref
    question_ref: Ref
    goal_ref: Ref
    nomination_ref: Ref
    domain_ref: Ref
    timeline_ref: Ref
    before_frame_ref: Ref
    execution_scope: FrozenMap
    execution: OperationalExperimentExecution
    prior_observation_refs: tuple[Ref, ...]
    before_signature: FrozenMap
    before_missing_refs: tuple[Ref, ...]
    observation_policy_ref: Ref
    observation_policy_hash: Ref
    open_response_domain: OperationalOpenResponseDomain | None = None
    accompanies_current_action: Literal[True] = True
    independently_admitted_experiment: Literal[False] = False
    response_domain_complete: Literal[False] = False
    grants_action: Literal[False] = False

    @model_validator(mode='after')
    def one_observed_primitive(self):
        if len(self.execution.actions) != 1:
            raise ValueError('native acquisition currently binds one observed primitive')
        expected = {row.field_ref for row in self.execution.observables}
        if not set(self.before_signature).issubset(expected):
            raise ValueError('native acquisition has an undeclared pre-action observable')
        domain = self.open_response_domain
        if domain is not None and (domain.question_ref != self.question_ref
                or domain.observation_contract_ref != self.contract_ref
                or domain.execution_contract_digest != stable_digest(self.execution)
                or domain.observable_field_refs != tuple(row.field_ref for row in self.execution.observables)
                or domain.support_evidence_refs != self.prior_observation_refs):
            raise ValueError('native acquisition changed its open response question')
        return self

    @model_serializer(mode='wrap')
    def preserve_prior_domain_shape(self, handler):
        data = handler(self)
        if 'open_response_domain' not in self.model_fields_set:
            data.pop('open_response_domain', None)
        return data

    def canonical_field_names(self):
        return tuple(name for name in self.__class__.model_fields
            if name != 'open_response_domain' or name in self.model_fields_set)
