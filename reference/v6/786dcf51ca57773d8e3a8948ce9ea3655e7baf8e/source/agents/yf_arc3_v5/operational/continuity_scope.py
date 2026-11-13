"""Current execution checks for a prepared operational context."""
from agents.yf_arc3_v5.logos.operational_responsibility import declared_action_constraints


def validate_current_action_responsibility_scope(intent, world_context=None):
    responsibility = intent.operational_consciousness.responsibility
    if world_context is not None:
        if any(world_context.get(key) != value for key, value in sorted(responsibility.execution_scope.items())):
            raise ValueError('operational responsibility: changed world execution scope')
        constraints = declared_action_constraints(intent, world_context)
        for field in ('preserve_constraint_refs', 'overshoot_constraint_refs'):
            if constraints[field] != getattr(responsibility.contribution, field):
                raise ValueError('operational responsibility: changed preservation contract')
    return intent
