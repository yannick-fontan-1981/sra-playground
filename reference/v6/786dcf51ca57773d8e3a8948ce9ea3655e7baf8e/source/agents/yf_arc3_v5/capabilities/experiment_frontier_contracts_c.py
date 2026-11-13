"""Current evidence, observable predictions and scoped experiment costs."""
from typing import Literal
from pydantic import Field, model_validator, model_serializer, field_validator
from agents.yf_arc3_v5.logos.types import FrozenModel, FrozenMap, Ref, stable_digest, immutable_json_data
from agents.yf_arc3_v5.logos.operational_engagement import OperationalConsciousnessEngagementReview
from agents.yf_arc3_v5.logos.operational_experiment_admission import (
    OperationalConsciousnessExperimentAdmissionObligation, OperationalConsciousnessNativePreparationEvidence,
    OperationalConsciousnessCommandBudgetInterval,
    OperationalConsciousnessResponseQuestionEvidence,
    OperationalConsciousnessRecoveryEvidence,
    OperationalConsciousnessGoalContributionEvidence,
    OperationalConsciousnessCuriosityAllowance,
)
from agents.yf_arc3_v5.logos.operational_acquisition import (
    OperationalExperimentAction, OperationalExperimentObservable, OperationalExperimentExecution, OperationalOpenResponseDomain,
)


class ProbePredictionC(FrozenModel):
    model_ref: Ref
    observable_signature: FrozenMap
    operation_effect: FrozenMap
    downstream_effect: FrozenMap
    assumptions: tuple[Ref, ...]
    falsifier_refs: tuple[Ref, ...]
    alternative_observable_signatures: tuple[FrozenMap, ...] = Field(default=(), max_length=255)
    observable_outcomes_complete: bool = True

    @model_serializer(mode='wrap')
    def preserve_prior_shape(self, handler):
        data = handler(self)
        for name in ('alternative_observable_signatures', 'observable_outcomes_complete'):
            if name not in self.model_fields_set:
                data.pop(name, None)
        return data

    def canonical_field_names(self):
        return tuple(name for name in self.__class__.model_fields if
            name not in ('alternative_observable_signatures', 'observable_outcomes_complete') or name in self.model_fields_set)


class RecalledProbeEvidenceC(FrozenModel):
    evidence_ref: Ref
    method_ref: Ref
    question_ref: Ref
    operation_ref: Ref
    context_signature: FrozenMap
    actual_sealed_observation: bool
    stored_epoch: int = Field(ge=0)
    rebound_epoch: int = Field(ge=0)
    rebound_revision: Ref
    rebound_scope_ref: Ref
    current_support_evidence_refs: tuple[Ref, ...]
    outcome_ref: Ref


class ExperimentUnknownC(FrozenModel):
    question_ref: Ref
    affects_identity: bool
    affects_payload: bool
    affects_authorization: bool
    affects_safety: bool
    affects_promised_use: bool


class ManualExperimentContractC(FrozenModel):
    authorization_ref: Ref
    epoch: int = Field(ge=0)
    scope_ref: Ref
    operation_ref: Ref
    precondition_refs: tuple[Ref, ...]
    recovery_scope_ref: Ref
    reset_operation_ref: Ref | None


class OperationalUnderstandingGoal(FrozenModel):
    """An explicit knowledge objective, without a fabricated game beneficiary."""
    schema_version: Literal['operational_understanding_goal.v1'] = 'operational_understanding_goal.v1'
    goal_ref: Ref
    question_ref: Ref
    scope_ref: Ref
    epoch: int = Field(ge=0)
    model_refs: tuple[Ref, ...] = Field(max_length=256)
    observable_field_refs: tuple[Ref, ...] = Field(min_length=1, max_length=256)
    information_reason_ref: Ref
    falsifier_refs: tuple[Ref, ...] = Field(min_length=1, max_length=256)
    preserve_constraint_refs: tuple[Ref, ...] = Field(max_length=256)
    stop_condition_refs: tuple[Ref, ...] = Field(max_length=256)
    maximum_recovery_inclusive_cost: int | None = Field(ge=0)
    cost_scope_ref: Ref | None = None
    cost_scope_digest: Ref | None = None
    timing: Literal['initial_exploration', 'blocked_resolution', 'continuation_dependency', 'not_examined', 'selected_information_opportunity']
    possible_beneficiary_goal_refs: tuple[Ref, ...] = Field(default=(), max_length=256)
    responsibility_owner_goal_ref: Ref | None = None
    open_response_domain: OperationalOpenResponseDomain | None = None
    benefit_established: Literal[False] = False
    grants_action: Literal[False] = False

    @model_validator(mode='after')
    def explicit_response_domain(self):
        if (self.cost_scope_ref is None) != (self.cost_scope_digest is None):
            raise ValueError('understanding cost scope lost its evidence digest')
        if self.cost_scope_ref is not None and self.maximum_recovery_inclusive_cost is None:
            raise ValueError('understanding cost scope requires its assigned ceiling')
        domain = self.open_response_domain
        if domain is None and not self.model_refs:
            raise ValueError('understanding requires declared models or an explicit open response domain')
        if domain is not None and (self.model_refs or domain.question_ref != self.question_ref
                or domain.observable_field_refs != self.observable_field_refs):
            raise ValueError('open understanding changed its question or invented models')
        return self

    @model_serializer(mode='wrap')
    def preserve_prior_goal_shape(self, handler):
        data = handler(self)
        if 'open_response_domain' not in self.model_fields_set:
            data.pop('open_response_domain', None)
        if self.responsibility_owner_goal_ref is None:
            data.pop('responsibility_owner_goal_ref', None)
        for name in ('cost_scope_ref', 'cost_scope_digest'):
            if getattr(self, name) is None:
                data.pop(name, None)
        return data

    def canonical_field_names(self):
        return tuple(name for name in self.__class__.model_fields
            if (name != 'open_response_domain' or name in self.model_fields_set)
            and (name != 'responsibility_owner_goal_ref' or self.responsibility_owner_goal_ref is not None)
            and (name not in ('cost_scope_ref', 'cost_scope_digest') or getattr(self, name) is not None))


class OperationalExperimentEvidence(FrozenModel):
    """Canonical admission, distinct from the experiment's predicted effects."""
    request_digest: Ref
    timeline_ref: Ref
    frame_ref: Ref
    dependency_versions: FrozenMap
    unavailable_refs: tuple[Ref, ...]
    admitted_recall_refs: tuple[Ref, ...]
    rejected_recall_refs: tuple[Ref, ...]
    observed_return_current: bool = False
    grants_action: Literal[False] = False

    @model_serializer(mode='wrap')
    def preserve_prior_evidence_shape(self, handler):
        data = handler(self)
        if 'observed_return_current' not in self.model_fields_set:
            data.pop('observed_return_current', None)
        return data

    def canonical_field_names(self):
        return tuple(name for name in self.__class__.model_fields
            if name != 'observed_return_current' or name in self.model_fields_set)


class UnderstandingObservedField(FrozenModel):
    field_ref: Ref
    term_ref: Ref
    support_claim_ref: Ref


class UnderstandingObservationInput(FrozenModel):
    assessment_ref: Ref
    scope_ref: Ref
    epoch: int = Field(ge=0)
    action_observed_refs: tuple[Ref, ...] = Field(min_length=1, max_length=256)
    fields: tuple[UnderstandingObservedField, ...] = Field(default=(), max_length=256)


class UnderstandingObservationMeasurement(FrozenModel):
    assessment_ref: Ref
    question_ref: Ref | None
    goal_ref: Ref | None
    observed_signature: FrozenMap
    matching_model_refs: tuple[Ref, ...]
    mismatching_model_refs: tuple[Ref, ...]
    unassessed_model_refs: tuple[Ref, ...]
    evidence_refs: tuple[Ref, ...]
    missing_refs: tuple[Ref, ...]
    facts: FrozenMap
    open_prediction_model_refs: tuple[Ref, ...] = ()

    @model_validator(mode='after')
    def preserve_observed_partitions(self):
        rows = self.matching_model_refs + self.mismatching_model_refs + self.unassessed_model_refs
        if len(rows) != len(set(rows)):
            raise ValueError('an observed model cannot belong to competing partitions')
        if self.missing_refs and (self.matching_model_refs or self.mismatching_model_refs):
            raise ValueError('incomplete observation cannot classify any model')
        if not self.missing_refs and not set(self.unassessed_model_refs) <= set(self.open_prediction_model_refs):
            raise ValueError('a complete observation can leave only open prediction domains unassessed')
        if (len(set(self.open_prediction_model_refs)) != len(self.open_prediction_model_refs)
                or not set(self.open_prediction_model_refs) <= set(rows)
                or set(self.open_prediction_model_refs) & set(self.mismatching_model_refs)):
            raise ValueError('an open outcome domain cannot be falsified by an unlisted response')
        return self

    @model_serializer(mode='wrap')
    def preserve_prior_shape(self, handler):
        data = handler(self)
        if 'open_prediction_model_refs' not in self.model_fields_set:
            data.pop('open_prediction_model_refs', None)
        return data

    def canonical_field_names(self):
        return tuple(name for name in self.__class__.model_fields if
            name != 'open_prediction_model_refs' or name in self.model_fields_set)


class UnderstandingObservationReturn(FrozenModel):
    request: UnderstandingObservationInput
    measured: UnderstandingObservationMeasurement
    source_disposition_ref: Ref
    source_policy_ref: Ref
    source_policy_hash: Ref
    record_ref: Ref | None = None
    answer_scope: Literal['observed_interval_only'] = 'observed_interval_only'
    followup_required: bool = True
    observed_stop_condition_refs: tuple[Ref, ...] = ()
    grants_action: Literal[False] = False

    @model_validator(mode='after')
    def preserve_question(self):
        if self.measured.assessment_ref != self.request.assessment_ref:
            raise ValueError('understanding observation return changed its question')
        return self

    @model_serializer(mode='wrap')
    def preserve_prior_observation_shape(self, handler):
        data = handler(self)
        if 'observed_stop_condition_refs' not in self.model_fields_set:
            data.pop('observed_stop_condition_refs', None)
        return data

    def canonical_field_names(self):
        return tuple(name for name in self.__class__.model_fields
            if name != 'observed_stop_condition_refs' or name in self.model_fields_set)


class ExperimentFrontierInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.experiment_frontier_input_c.v1"
    experiment_ref: Ref
    operation_ref: Ref
    purpose: Literal["MECHANISM", "USEFULNESS"]
    question_kind: Literal["OPERATION_VALIDATION", "BENEFIT_VALIDATION", "MODEL_DISCRIMINATION", "RESPONSE_ACQUISITION"]
    parent_goal_ref: Ref | None
    utility_reason_ref: Ref | None
    understanding_goal: OperationalUnderstandingGoal | None = None
    canonical_evidence: OperationalExperimentEvidence | None = None
    execution_contract: OperationalExperimentExecution | None = None
    observed_return: UnderstandingObservationReturn | None = None
    continuation_review: Literal['not_examined', 'no_valid_continuation',
        'validated_continuation_available', 'discovery_required_by_continuation',
        'continuation_requires_revalidation', 'no_declared_continuation_in_source_domain'] = 'not_examined'
    native_continuation_review_ref: Ref | None = None
    incoming_engagement_review: OperationalConsciousnessEngagementReview | None = None
    native_continuation_disposition: FrozenMap | None = None
    native_preparation_evidence: OperationalConsciousnessNativePreparationEvidence | None = None
    native_question_evidence: OperationalConsciousnessResponseQuestionEvidence | None = None
    native_recovery_evidence: OperationalConsciousnessRecoveryEvidence | None = None
    native_goal_contribution_evidence: OperationalConsciousnessGoalContributionEvidence | None = None
    native_curiosity_allowance: OperationalConsciousnessCuriosityAllowance | None = None
    preservation_evidence_by_constraint: FrozenMap = Field(default_factory=FrozenMap)
    observed_stop_condition_refs: tuple[Ref, ...] = Field(default=(), max_length=256)
    question_ref: Ref
    question_currently_unanswered: bool | None
    epoch: int = Field(ge=0)
    evidence_revision_ref: Ref
    scope_ref: Ref
    support_epoch: int = Field(ge=0)
    support_revision_ref: Ref
    support_scope_ref: Ref
    support_evidence_refs: tuple[Ref, ...]
    context_signature: FrozenMap
    model_refs: tuple[Ref, ...] = Field(max_length=256)
    open_response_domain: OperationalOpenResponseDomain | None = None
    predictions: tuple[ProbePredictionC, ...] = Field(default=(), max_length=256)
    observation_contract_ref: Ref
    observable_field_refs: tuple[Ref, ...]
    unknowns: tuple[ExperimentUnknownC, ...] = Field(default=(), max_length=256)
    recalled_evidence: tuple[RecalledProbeEvidenceC, ...] = Field(default=(), max_length=256)
    robust_contribution_ref: Ref | None
    robust_contribution_current: bool
    observed_whole_code_ref: Ref | None
    requested_code_scope: Literal["WHOLE", "SUPPORTED_SUB_OPERATION", "COMPOSITION"]
    composition_evidence_ref: Ref | None
    preconditions_current: bool
    protected_conditions_current: bool
    manual_contract: ManualExperimentContractC | None
    destructive: bool | None
    consumed_command_cost: int | None = Field(ge=0)
    lost_progress_cost: int | None = Field(ge=0)
    recovery_route_cost: int | None = Field(ge=0)
    irreversible_population_loss: int | None = Field(ge=0)
    irreversible_material_loss: int | None = Field(ge=0)
    remaining_command_budget: int | None = Field(ge=0)
    command_budget_interval: OperationalConsciousnessCommandBudgetInterval | None = None
    actual_costs_known: bool

    @model_validator(mode='after')
    def explicit_objective(self):
        if self.native_curiosity_allowance is not None and (
                self.understanding_goal is None or self.native_continuation_review_ref is None
                or self.native_curiosity_allowance.experiment_ref != self.experiment_ref
                or self.native_curiosity_allowance.continuation_review_ref != self.native_continuation_review_ref
                or self.understanding_goal.maximum_recovery_inclusive_cost != self.native_curiosity_allowance.maximum_recovery_inclusive_cost
                or self.understanding_goal.cost_scope_ref != self.native_curiosity_allowance.cost_scope_ref
                or self.understanding_goal.cost_scope_digest != self.native_curiosity_allowance.cost_scope_digest):
            raise ValueError('curiosity allowance lost its exact question, continuation review or assigned ceiling')
        if self.native_goal_contribution_evidence is not None:
            goal, evidence = self.understanding_goal, self.native_goal_contribution_evidence
            if goal is None or self.execution_contract is None or self.question_kind != 'RESPONSE_ACQUISITION':
                raise ValueError('native contribution review requires its understanding objective and response scope')
            if goal.responsibility_owner_goal_ref is None:
                # Preserve the historical contract without promoting it to the new ownership proof.
                if evidence.owner_goal_ref not in goal.possible_beneficiary_goal_refs:
                    raise ValueError('legacy contribution review lost its declared beneficiary')
            elif (goal.responsibility_owner_goal_ref != evidence.owner_goal_ref
                    or goal.possible_beneficiary_goal_refs != evidence.declared_possible_beneficiaries()):
                raise ValueError('native understanding changed its responsible owner or declared beneficiary evidence')
        if self.native_recovery_evidence is not None and (
                self.understanding_goal is None or self.execution_contract is None
                or self.question_kind != 'RESPONSE_ACQUISITION' or self.open_response_domain is None):
            raise ValueError('native recovery evidence needs its exact open acquisition execution')
        if self.native_question_evidence is not None and (
                self.understanding_goal is None or self.question_kind != 'RESPONSE_ACQUISITION'
                or self.open_response_domain is None):
            raise ValueError('native response-question evidence needs its exact open acquisition question')
        if self.command_budget_interval is not None and self.remaining_command_budget is not None and (
                self.command_budget_interval.lower != self.remaining_command_budget
                or self.command_budget_interval.upper != self.remaining_command_budget):
            raise ValueError('an exact command budget must agree with both interval bounds')
        domain = self.open_response_domain
        if domain is None and (not self.model_refs or self.question_kind == 'RESPONSE_ACQUISITION'):
            raise ValueError('an unmodeled response needs an explicit open domain')
        if domain is not None and (self.model_refs or self.predictions or self.purpose != 'MECHANISM'
                or self.question_kind != 'RESPONSE_ACQUISITION' or domain.question_ref != self.question_ref
                or domain.observation_contract_ref != self.observation_contract_ref
                or self.execution_contract is None or domain.execution_contract_digest != stable_digest(self.execution_contract)
                or domain.observable_field_refs != self.observable_field_refs
                or domain.context_signature != self.context_signature
                or not set(domain.support_evidence_refs).issubset(self.support_evidence_refs)):
            raise ValueError('open response request changed its context or asserted modeled outcomes')
        if self.understanding_goal is not None and self.understanding_goal.open_response_domain != domain:
            raise ValueError('understanding and experiment disagree about their response domain')
        if self.execution_contract is not None:
            fields = tuple(item.field_ref for item in self.execution_contract.observables)
            if len(set(fields)) != len(fields) or set(fields) != set(self.observable_field_refs):
                raise ValueError('execution observables must bind each predicted field exactly once')
        if (self.parent_goal_ref is None) != (self.utility_reason_ref is None):
            raise ValueError('an instrumental experiment requires both its parent and utility reason')
        if self.parent_goal_ref is None and self.understanding_goal is None:
            raise ValueError('an experiment requires an explicit instrumental or understanding objective')
        if self.understanding_goal is not None and (self.purpose != 'MECHANISM'
                or self.understanding_goal.question_ref != self.question_ref):
            raise ValueError('understanding must retain its exact mechanism question without asserting benefit')
        return self

    @model_serializer(mode='wrap')
    def preserve_prior_request_shape(self, handler):
        data = handler(self)
        for field in ('open_response_domain', 'native_continuation_review_ref', 'native_preparation_evidence', 'command_budget_interval', 'native_question_evidence', 'native_recovery_evidence', 'native_goal_contribution_evidence', 'native_curiosity_allowance', 'incoming_engagement_review', 'native_continuation_disposition'):
            if field not in self.model_fields_set:
                data.pop(field, None)
        return data

    def canonical_field_names(self):
        return tuple(name for name in self.__class__.model_fields
            if name not in ('open_response_domain', 'native_continuation_review_ref', 'native_preparation_evidence', 'command_budget_interval', 'native_question_evidence', 'native_recovery_evidence', 'native_goal_contribution_evidence', 'native_curiosity_allowance', 'incoming_engagement_review', 'native_continuation_disposition') or name in self.model_fields_set)


class ExperimentFrontierFactsC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.experiment_frontier_facts_c.v1"
    facts: FrozenMap
    observation_partitions: tuple[tuple[Ref, ...], ...]
    recalled_evidence_refs: tuple[Ref, ...]
    necessary_unknown_refs: tuple[Ref, ...]
    risk_cost: int | None


class ExperimentDecisionInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.experiment_decision_input_c.v2"
    request: ExperimentFrontierInputC
    measured: ExperimentFrontierFactsC
    source_disposition_ref: Ref
    source_policy_ref: Ref
    admission_projection: FrozenMap | None = None

    @field_validator('admission_projection', mode='before')
    @classmethod
    def transport_source_projection(cls, value):
        return immutable_json_data(value) if isinstance(value, FrozenModel) else value


class ExperimentDecisionC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.experiment_decision_c.v2"
    source_disposition_ref: Ref
    source_policy_ref: Ref
    frozen_request: ExperimentFrontierInputC
    frozen_measurement: ExperimentFrontierFactsC
    experiment_ref: Ref
    parent_goal_ref: Ref | None
    utility_reason_ref: Ref | None
    understanding_goal: OperationalUnderstandingGoal | None = None
    understanding_record_ref: Ref | None = None
    understanding_consumption_ref: Ref | None = None
    question_ref: Ref
    purpose: Ref
    observation_partitions: tuple[tuple[Ref, ...], ...]
    retained_model_refs: tuple[Ref, ...]
    recalled_evidence_refs: tuple[Ref, ...]
    necessary_unknown_refs: tuple[Ref, ...]
    risk_cost: int | None
    irreversible_population_loss: int | None
    irreversible_material_loss: int | None
    assumptions: tuple[Ref, ...]
    falsifier_refs: tuple[Ref, ...]
    proposed_action: None = None
    proposed_reset: None = None
    admission_obligations: tuple[OperationalConsciousnessExperimentAdmissionObligation, ...] = ()
    conscious_reasoning_basis_digest: Ref | None = None
    goal_contribution_review: FrozenMap | None = None
    understanding_objective: FrozenMap | None = None
    cost_funding_review: FrozenMap | None = None
    preparation_review: FrozenMap | None = None
    engagement_review: FrozenMap | None = None

    @model_serializer(mode='wrap')
    def preserve_prior_admission_shape(self, handler):
        data = handler(self)
        for name in ('admission_obligations', 'conscious_reasoning_basis_digest', 'goal_contribution_review', 'understanding_objective', 'cost_funding_review', 'preparation_review', 'engagement_review'):
            if name not in self.model_fields_set:
                data.pop(name, None)
        return data

    def canonical_field_names(self):
        return tuple(name for name in self.__class__.model_fields
            if name not in ('admission_obligations', 'conscious_reasoning_basis_digest', 'goal_contribution_review', 'understanding_objective', 'cost_funding_review', 'preparation_review', 'engagement_review') or name in self.model_fields_set)

    def validate_conscious_reasoning_transport(self):
        from .conscious_decision_basis import conscious_decision_basis, conscious_decision_basis_digest
        expected = conscious_decision_basis(self.frozen_request, self.frozen_measurement, self.source_disposition_ref)
        for name in ('understanding_objective', 'cost_funding_review', 'preparation_review', 'engagement_review'):
            if name not in expected and getattr(self, name) is not None:
                raise ValueError('operational consciousness: decision invented an absent reasoning contribution')
        if 'goal_contribution_review' not in expected and self.goal_contribution_review is not None:
            raise ValueError('operational consciousness: unmeasured goal contribution cannot enter the decision')
        if (any(getattr(self, name) != value for name, value in sorted(expected.items()))
                or self.conscious_reasoning_basis_digest != conscious_decision_basis_digest(
                    self.frozen_request, self.frozen_measurement, self.source_disposition_ref,
                    self.source_policy_ref, self.admission_obligations)):
            raise ValueError('operational consciousness: decision lost its exact scoped reasoning basis')
        return self

    @model_validator(mode='after')
    def preserve_understanding_objective(self):
        if 'conscious_reasoning_basis_digest' in self.model_fields_set:
            self.validate_conscious_reasoning_transport()
        refs = tuple(item.obligation_ref for item in self.admission_obligations)
        if len(set(refs)) != len(refs):
            raise ValueError('experiment admission repeats an obligation')
        for item in self.admission_obligations:
            if any(field not in self.frozen_measurement.facts
                    or item.measured_values[field] != self.frozen_measurement.facts[field]
                    for field in item.measured_fields):
                raise ValueError('experiment admission changed the evidence for its obligation')
        observed = self.frozen_request.observed_return
        if self.source_disposition_ref == 'experiment.review_observed_result':
            retained = tuple(ref for ref in self.frozen_request.model_refs if observed is not None
                and ref in (*observed.measured.matching_model_refs, *observed.measured.unassessed_model_refs))
            if (observed is None or observed.measured.missing_refs
                    or self.retained_model_refs != retained):
                raise ValueError('observed model review lost its exact scoped partition')
        if self.understanding_consumption_ref is not None and self.understanding_record_ref is None:
            raise ValueError('understanding consumption requires its canonical assessment reference')
        if self.understanding_goal is None and (self.understanding_record_ref is not None
                or self.understanding_consumption_ref is not None):
            raise ValueError('an understanding receipt requires its explicit knowledge objective')
        if (self.parent_goal_ref != self.frozen_request.parent_goal_ref
                or self.utility_reason_ref != self.frozen_request.utility_reason_ref
                or self.understanding_goal != self.frozen_request.understanding_goal):
            raise ValueError('experiment return changed or dropped its actual objective')
        return self
