"""Unresolved admission work returned to the owner of an experiment question."""
from typing import Literal

from pydantic import Field, model_validator, model_serializer

from .types import FrozenMap, FrozenModel, Ref
from .operational_acquisition import OperationalConsciousnessNativeAcquisition
from .operational_engagement import OperationalConsciousnessEngagementReview
from .operational_information_opportunity import OperationalConsciousnessDeclaredQuestionBinding


class OperationalConsciousnessExperimentAdmissionObligation(FrozenModel):
    obligation_ref: Ref
    reason_ref: Ref
    measured_fields: tuple[Ref, ...] = Field(min_length=1)
    measured_values: FrozenMap
    grants_action: Literal[False] = False

    @model_validator(mode='after')
    def retain_exact_measurements(self):
        if (len(set(self.measured_fields)) != len(self.measured_fields)
                or set(self.measured_values) != set(self.measured_fields)):
            raise ValueError('admission obligation lost its exact measured domain')
        return self


class OperationalConsciousnessNativePreparationEvidence(FrozenModel):
    """Scoped reuse of actual premises and an existing Source viability assessment."""
    source_workflow_ref: Ref
    source_hash: Ref
    identity: FrozenMap
    epoch: int = Field(ge=0)
    scope_ref: Ref
    premise_versions: FrozenMap
    required_constraint_refs: tuple[Ref, ...]
    source_viability_ref: Ref
    source_viability_digest: Ref
    control_bound: bool
    measured_facts: FrozenMap
    projection_facts: FrozenMap
    policy_hash: Ref
    acquisition_contract: OperationalConsciousnessNativeAcquisition | None = None
    grants_action: Literal[False] = False
    schema_version: Literal['operational_consciousness_native_preparation_evidence.v1'] = 'operational_consciousness_native_preparation_evidence.v1'

    @model_serializer(mode='wrap')
    def preserve_prior_question_shape(self, handler):
        value = handler(self)
        if self.acquisition_contract is None:
            value.pop('acquisition_contract', None)
        return value

    def canonical_field_names(self):
        return tuple(name for name in type(self).model_fields
            if name != 'acquisition_contract' or self.acquisition_contract is not None)


class OperationalConsciousnessCommandBudgetInterval(FrozenModel):
    """Conditional remaining primitive units across the admitted rendering models."""
    lower: int = Field(ge=0)
    upper: int | None = Field(ge=0)
    intent_ref: Ref
    timeline_ref: Ref
    frame_ref: Ref
    solver_action_bound: int | None = Field(ge=0)
    measurement_ref: Ref
    measurement_digest: Ref
    proof_versions: FrozenMap
    policy_ref: Ref
    policy_hash: Ref
    unit: Literal['primitive_action'] = 'primitive_action'
    model_status: Literal['conditional_on_current_resource_models'] = 'conditional_on_current_resource_models'
    grants_action: Literal[False] = False
    schema_version: Literal['operational_consciousness_command_budget_interval.v1'] = 'operational_consciousness_command_budget_interval.v1'

    @model_validator(mode='after')
    def ordered_supported_bounds(self):
        if self.upper is not None and self.upper < self.lower:
            raise ValueError('command budget interval is inverted')
        if not self.proof_versions:
            raise ValueError('command budget interval lacks its exact quantity evidence')
        return self


class OperationalConsciousnessResponseQuestionEvidence(FrozenModel):
    """Availability of actual response data, not discovery of a general causal law."""
    source_workflow_ref: Ref
    source_hash: Ref
    identity: FrozenMap
    source_question_open: bool
    observations: FrozenMap
    measured_facts: FrozenMap
    projection_facts: FrozenMap
    policy_hash: Ref
    proves_causal_law: Literal[False] = False
    grants_action: Literal[False] = False
    schema_version: Literal['operational_consciousness_response_question_evidence.v1'] = 'operational_consciousness_response_question_evidence.v1'


class OperationalConsciousnessRecoveryEvidence(FrozenModel):
    """Requalified provenance of observed returns, never a promise of future recovery."""
    source_workflow_ref: Ref
    source_hash: Ref
    identity: FrozenMap
    native_review_ref: Ref
    native_review_digest: Ref
    owner_goal_ref: Ref
    nomination_ref: Ref
    domain_ref: Ref
    candidate_refs: tuple[Ref, ...]
    control_signature: FrozenMap
    observed_returns: FrozenMap
    measured_facts: FrozenMap
    projection_facts: FrozenMap
    policy_hash: Ref
    future_recovery_established: Literal[False] = False
    grants_action: Literal[False] = False
    schema_version: Literal['operational_consciousness_recovery_evidence.v1'] = 'operational_consciousness_recovery_evidence.v1'


class OperationalConsciousnessGoalContributionEvidence(FrozenModel):
    """Conditional contribution reasons tied to a current application and its owner."""
    source_workflow_ref: Ref
    source_hash: Ref
    identity: FrozenMap
    native_review_ref: Ref
    native_review_digest: Ref
    owner_goal_ref: Ref
    nomination_ref: Ref
    domain_ref: Ref
    candidate_refs: tuple[Ref, ...]
    control_signature: FrozenMap
    contribution_rows: FrozenMap
    prediction_contract: FrozenMap
    missing_candidate_refs: tuple[Ref, ...]
    policy_hash: Ref
    observed_goal_achievement: Literal[False] = False
    utility_established: Literal[False] = False
    grants_action: Literal[False] = False
    schema_version: Literal['operational_consciousness_goal_contribution_evidence.v1'] = 'operational_consciousness_goal_contribution_evidence.v1'

    def declared_possible_beneficiaries(self):
        """Read DRM attribution; ownership alone never supplies a utility reason."""
        declared = False
        for _, row in sorted(self.contribution_rows.items()):
            meaning = row.get('declared', FrozenMap())
            if meaning.get('possible_beneficiary_declared') is not True:
                continue
            reason = meaning.get('possible_beneficiary_reason_ref')
            if (row.get('measured', FrozenMap()).get('goal_ref') != self.owner_goal_ref
                    or not isinstance(reason, str) or not reason):
                raise ValueError('possible beneficiary lost its goal-owned DRM contribution reason')
            declared = True
        return (self.owner_goal_ref,) if declared else ()


class OperationalConsciousnessCuriosityAllowance(FrozenModel):
    """A scoped conditional trial ceiling, distinct from reservation and ACT."""
    continuation_review_ref: Ref
    experiment_ref: Ref
    measured_facts: FrozenMap
    projection_facts: FrozenMap
    policy_hash: Ref
    maximum_recovery_inclusive_cost: int | None = Field(ge=0)
    cost_scope_ref: Ref | None = None
    cost_scope_digest: Ref | None = None
    reserves_resource: Literal[False] = False
    grants_action: Literal[False] = False
    schema_version: Literal['operational_consciousness_curiosity_allowance.v1'] = 'operational_consciousness_curiosity_allowance.v1'

    @model_validator(mode='after')
    def scoped_ceiling(self):
        if (self.cost_scope_ref is None) != (self.cost_scope_digest is None):
            raise ValueError('curiosity cost scope requires its exact evidence digest')
        if self.cost_scope_ref is not None and self.maximum_recovery_inclusive_cost is None:
            raise ValueError('curiosity cost scope has no assigned ceiling')
        return self

    @model_serializer(mode='wrap')
    def preserve_prior_cost_scope_shape(self, handler):
        data = handler(self)
        for name in ('cost_scope_ref', 'cost_scope_digest'):
            if getattr(self, name) is None:
                data.pop(name, None)
        return data

    def canonical_field_names(self):
        return tuple(name for name in self.__class__.model_fields
            if name not in ('cost_scope_ref', 'cost_scope_digest') or getattr(self, name) is not None)


class OperationalConsciousnessNativeAdmissionWitness(FrozenModel):
    """One typed envelope for the existing native admission evidence variants."""
    preparation: OperationalConsciousnessNativePreparationEvidence | None
    command_budget: OperationalConsciousnessCommandBudgetInterval | None
    response_question: OperationalConsciousnessResponseQuestionEvidence | None
    recovery: OperationalConsciousnessRecoveryEvidence | None = None
    goal_contribution: OperationalConsciousnessGoalContributionEvidence | None = None
    grants_action: Literal[False] = False
    schema_version: Literal['operational_consciousness_native_admission_witness.v1'] = 'operational_consciousness_native_admission_witness.v1'

    @model_serializer(mode='wrap')
    def preserve_prior_witness_shape(self, handler):
        data = handler(self)
        for name in ('recovery', 'goal_contribution'):
            if name not in self.model_fields_set:
                data.pop(name, None)
        return data

    def canonical_field_names(self):
        return tuple(name for name in self.__class__.model_fields
            if name not in ('recovery', 'goal_contribution') or name in self.model_fields_set)


class OperationalConsciousnessSelectionFrontier(FrozenModel):
    """The finite Source selection domain, never all possible world solutions."""
    source_workflow_ref: Ref
    source_hash: Ref
    selection_policy_ref: Ref
    selection_policy_hash: Ref
    review_policy_hash: Ref
    timeline_ref: Ref
    frame_ref: Ref
    execution_scope: FrozenMap
    selected_candidate_ref: Ref
    action_ref: Ref
    action_data: FrozenMap
    effect_class: Ref
    contribution_digest: Ref
    question_ref: Ref | None
    reason_ref: Ref | None
    question_bindings: tuple[OperationalConsciousnessDeclaredQuestionBinding, ...] | None = None
    candidate_rows: FrozenMap
    candidate_domain_complete: bool
    incoming_engagement_present: bool | None
    incoming_engagement_consumed: bool | None
    incoming_engagement_review: OperationalConsciousnessEngagementReview | None = None
    premise_versions: FrozenMap
    establishes_validated_continuation: Literal[False] = False
    establishes_global_infeasibility: Literal[False] = False
    grants_action: Literal[False] = False

    @model_serializer(mode='wrap')
    def preserve_prior_engagement_shape(self, handler):
        value = handler(self)
        if self.incoming_engagement_review is None:
            value.pop('incoming_engagement_review', None)
        if self.question_bindings is None:
            value.pop('question_bindings', None)
        return value

    def canonical_field_names(self):
        return tuple(name for name in type(self).model_fields
            if name not in ('incoming_engagement_review', 'question_bindings') or getattr(self, name) is not None)
