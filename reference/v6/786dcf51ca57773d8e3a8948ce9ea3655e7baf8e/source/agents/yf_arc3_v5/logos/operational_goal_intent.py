"""The declared destination of reasoning, without inventing its missing meaning."""
from typing import Literal
from pydantic import model_validator
from .types import FrozenModel, FrozenMap, Ref


OPERATIONAL_GOAL_INTENT_FIELDS = (
    'goal_kind', 'node_kind', 'epistemic_status', 'support_claim_refs', 'operational_goal_hypotheses',
    'concrete_target_ref', 'concrete_target_candidates',
    'target_binding_claim_refs', 'active_terminal_goal_ref', 'access_condition_refs',
    'access_state', 'expected_effect_signature_refs', 'expected_goal_delta_refs',
    'falsifier_refs', 'resource_budget_ref', 'reversibility_ref',
    'preserve_constraint_refs', 'overshoot_constraint_refs',
)
OPERATIONAL_GOAL_REFERENCE_FIELDS = (
    'support_claim_refs', 'concrete_target_ref', 'concrete_target_candidates', 'target_binding_claim_refs',
    'active_terminal_goal_ref', 'access_condition_refs', 'expected_effect_signature_refs',
    'expected_goal_delta_refs', 'falsifier_refs', 'resource_budget_ref', 'reversibility_ref',
    'preserve_constraint_refs', 'overshoot_constraint_refs',
)


class OperationalConsciousnessGoalIntent(FrozenModel):
    schema_version: Literal['operational_consciousness_goal_intent.v1'] = 'operational_consciousness_goal_intent.v1'
    goal_ref: Ref
    declarations: FrozenMap
    reference_versions: FrozenMap
    unresolved_refs: tuple[Ref, ...] = ()
    expired_claim_refs: tuple[Ref, ...] = ()
    # A missing definition is an unknown, not an automatically required action.
    grants_action: Literal[False] = False
    establishes_utility: Literal[False] = False

    @model_validator(mode='after')
    def preserve_declared_domain(self):
        from .operational_goal_hypothesis import read_goal_hypotheses
        read_goal_hypotheses(self.declarations.get('operational_goal_hypotheses') or (), goal_ref=self.goal_ref)
        if (not set(self.declarations).issubset(OPERATIONAL_GOAL_INTENT_FIELDS)
                or not set((*self.unresolved_refs, *self.expired_claim_refs)).issubset(self.reference_versions)):
            raise ValueError('operational goal intent lost its declared reference domain')
        return self
