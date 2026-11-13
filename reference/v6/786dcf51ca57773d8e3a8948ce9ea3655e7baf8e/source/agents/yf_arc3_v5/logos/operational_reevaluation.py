"""Durable, scope-qualified work derived from real reasoning consequences.

The agenda remembers obligations; Source executes them and DRM interprets them.
No item is an action permit, and a delivery is never a consumption receipt.
"""
from typing import Literal
from pydantic import Field, model_validator, model_serializer
from .operational_reasoning import OperationalConsciousnessReasoningContext
from .types import FrozenMap, FrozenModel, Ref, stable_digest
from .operational_propagation import OperationalConsciousnessPropagationBudget


class OperationalConsciousnessReevaluationDemand(FrozenModel):
    work_ref: Ref
    kind: Literal['goal_dependency_admission', 'family_dependency_admission', 'native_means_review', 'question_interpretation_review']
    problem_ref: Ref
    question_ref: Ref
    origin_context: OperationalConsciousnessReasoningContext
    execution_scope: FrozenMap
    dependency_versions: FrozenMap
    semantic_inputs: FrozenMap
    trigger_refs: tuple[Ref, ...] = Field(min_length=1)
    grants_action: Literal[False] = False
    schema_version: Literal['operational_consciousness_reevaluation_demand.v1', 'operational_consciousness_reevaluation_demand.v2'] = 'operational_consciousness_reevaluation_demand.v2'

    def responsibility_identity(self):
        """The obligation a successor must preserve while revising its premises.

        Source and dependency versions may change on a rebind. The question,
        work kind, problem and execution ownership may not change with them.
        This is a comparison key, not a new persisted identity or action permit.
        """
        return (self.kind, self.problem_ref, self.question_ref,
            self.origin_context.run_ref, self.origin_context.timeline_ref,
            self.execution_scope)

    def semantic_identity(self):
        # Frame, journal revision, trigger instance and workflow instance are
        # provenance, not reasons to execute the same semantic work again.
        return 'conscious-reevaluation:' + stable_digest((self.kind, self.problem_ref,
            self.question_ref, self.origin_context.run_ref, self.origin_context.timeline_ref,
            self.origin_context.source_workflow_ref, self.origin_context.source_hash,
            self.execution_scope, self.dependency_versions, self.semantic_inputs))

    @model_validator(mode='after')
    def stable_semantic_identity(self):
        if self.kind in ('native_means_review', 'question_interpretation_review') and self.schema_version.endswith('.v1'):
            raise ValueError('native means review requires the extended typed work contract')
        if self.work_ref != self.semantic_identity():
            raise ValueError('operational consciousness: reevaluation identity differs from its premises')
        return self

    @classmethod
    def bind(cls, **fields):
        provisional = cls.model_construct(work_ref='', **fields)
        return cls(work_ref=provisional.semantic_identity(), **fields)


class OperationalConsciousnessReevaluationState(FrozenModel):
    demand: OperationalConsciousnessReevaluationDemand
    latest_record_ref: Ref
    status: Literal['pending', 'consumed', 'waiting', 'superseded']
    consumption_ref: Ref | None = None
    wake_dependency_versions: FrozenMap | None = None
    wake_reason_ref: Ref | None = None
    successor_work_refs: tuple[Ref, ...] = ()


class OperationalConsciousnessGoalConsumptionUse(FrozenModel):
    """Exact consumed contribution carried from a selected goal into its action."""
    goal_ref: Ref
    action_goal_ref: Ref
    work_ref: Ref
    consumption_ref: Ref
    source_workflow_ref: Ref
    source_hash: Ref
    execution_scope: FrozenMap
    projection_digest: Ref
    grants_action: Literal[False] = False
    schema_version: Literal['operational_consciousness_goal_consumption_use.v1'] = 'operational_consciousness_goal_consumption_use.v1'

    @classmethod
    def from_record(cls, record, *, action_goal_ref):
        if (record.status != 'consumed' or record.demand.kind != 'goal_dependency_admission'
                or record.consumption_ref != record.id or record.projection_input_facts is None):
            raise ValueError('operational consciousness: goal use requires a consumed contribution with its basis')
        demand = record.demand
        facts = record.projection_facts['alternative_facts'].get(demand.problem_ref, FrozenMap())
        declared_owner = facts.get('active_goal_ref') or facts.get('goal_ref') or demand.problem_ref
        if action_goal_ref != declared_owner:
            raise ValueError('operational consciousness: goal use changed its declared action owner')
        return cls(goal_ref=demand.problem_ref, action_goal_ref=action_goal_ref,
            work_ref=demand.work_ref, consumption_ref=record.id,
            source_workflow_ref=demand.origin_context.source_workflow_ref,
            source_hash=demand.origin_context.source_hash, execution_scope=demand.execution_scope,
            projection_digest=record.projection_digest)


class OperationalConsciousnessDeliberationOutcome(FrozenModel):
    disposition: Literal['relative_stability', 'awaiting_evidence', 'work_bound_suspension', 'propagation_no_progress']
    propagation_budget: OperationalConsciousnessPropagationBudget | None = None
    propagation_stalled: bool = False
    discovered_goal_facts: FrozenMap = Field(default_factory=FrozenMap)
    goal_discovery_rejected_carriers: tuple[tuple[Ref, Ref], ...] = ()
    examined_work_refs: tuple[Ref, ...]
    pending_work_refs: tuple[Ref, ...]
    pending_goal_watch_refs: tuple[Ref, ...] = ()
    pending_native_means_goal_refs: tuple[Ref, ...] = ()
    pending_understanding_refs: tuple[Ref, ...] = ()
    waiting_understanding_refs: tuple[Ref, ...] = ()
    observed_understanding_return_refs: tuple[Ref, ...] = ()
    historical_understanding_return_refs: tuple[Ref, ...] = ()
    understanding_diagnostic_refs: tuple[Ref, ...] = ()
    pending_understanding_review_refs: tuple[Ref, ...] = ()
    waiting_understanding_review_refs: tuple[Ref, ...] = ()
    understanding_consumption_record_refs: tuple[Ref, ...] = ()
    understanding_review_diagnostic_refs: tuple[Ref, ...] = ()
    pending_admission_review_refs: tuple[Ref, ...] = ()
    waiting_admission_review_refs: tuple[Ref, ...] = ()
    admission_review_obligations: FrozenMap = Field(default_factory=FrozenMap)
    admission_review_diagnostic_refs: tuple[Ref, ...] = ()
    waiting_work_refs: tuple[Ref, ...]
    out_of_scope_work_refs: tuple[Ref, ...] = ()
    scope: FrozenMap
    grants_action: Literal[False] = False
    exhaustive_world_understanding: Literal[False] = False

    @model_serializer(mode='wrap')
    def preserve_pre_native_outcome_shape(self, handler):
        data = handler(self)
        for name in ('discovered_goal_facts', 'goal_discovery_rejected_carriers', 'propagation_budget', 'propagation_stalled', 'pending_native_means_goal_refs', 'pending_admission_review_refs',
                'waiting_admission_review_refs', 'admission_review_obligations', 'admission_review_diagnostic_refs'):
            if name not in self.model_fields_set:
                data.pop(name, None)
        return data

    def canonical_field_names(self):
        return tuple(name for name in self.__class__.model_fields
            if name not in ('discovered_goal_facts', 'goal_discovery_rejected_carriers', 'propagation_budget', 'propagation_stalled', 'pending_native_means_goal_refs', 'pending_admission_review_refs',
                'waiting_admission_review_refs', 'admission_review_obligations', 'admission_review_diagnostic_refs')
                or name in self.model_fields_set)

    @model_validator(mode='after')
    def suspension_is_not_stability(self):
        if self.propagation_budget is not None:
            if self.disposition == 'work_bound_suspension' and not self.propagation_budget.exhausted:
                raise ValueError('operational consciousness: pending work is not an exhausted budget')
            if self.propagation_stalled != (self.disposition == 'propagation_no_progress'):
                raise ValueError('operational consciousness: unprocessed work needs its explicit stopping reason')
        if self.disposition == 'relative_stability' and (self.pending_work_refs or self.waiting_work_refs or self.pending_goal_watch_refs
                or self.pending_native_means_goal_refs or self.pending_understanding_refs or self.waiting_understanding_refs
                or self.pending_understanding_review_refs or self.waiting_understanding_review_refs
                or self.pending_admission_review_refs or self.waiting_admission_review_refs):
            raise ValueError('operational consciousness: unconsumed work cannot attest local stability')
        if self.disposition in ('work_bound_suspension', 'propagation_no_progress') and not (self.pending_work_refs or self.pending_goal_watch_refs
                or self.pending_native_means_goal_refs or self.pending_understanding_refs or self.pending_understanding_review_refs
                or self.pending_admission_review_refs):
            raise ValueError('operational consciousness: work-bound suspension needs retained work')
        return self
