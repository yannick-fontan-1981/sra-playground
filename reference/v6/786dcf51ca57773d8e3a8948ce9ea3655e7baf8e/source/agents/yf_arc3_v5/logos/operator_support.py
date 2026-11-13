"""A measured access target is not an authorization to operate there."""
from typing import Literal

from pydantic import Field, model_validator

from .types import FrozenMap, FrozenModel, Ref


class OperatorSurfaceAccessTarget(FrozenModel):
    """Transport observed support geometry; bind an experiment only on arrival."""

    target_kind: Literal["operator_surface_access_only"]
    access_target_ref: Ref
    context_epoch: int
    operator_action_ref: Ref
    recipe_token: Ref
    pose_origin: tuple[int, int]
    support_signatures: tuple[tuple[Ref, Ref], ...]
    coverage: tuple[FrozenMap, ...] = Field(min_length=1, max_length=2)
    evidence_refs: tuple[Ref, ...]
    simultaneous_composition_refs: tuple[Ref, ...] = ()
    composition_hypotheses: tuple[FrozenMap, ...] = ()
    predicted_experiment_context_ref: Ref | None = None
    requires_current_observation: Literal[True]
    operator_action_authorized: Literal[False]


class ObservedCompositionAccessReturn(FrozenModel):
    """An observed arrival consumed by a freshly authorized experiment."""

    dispatched_intent_ref: Ref
    access_target_ref: Ref
    current_context_ref: Ref
    operator_action_ref: Ref
    recipe_token: Ref
    comparisons: FrozenMap
    operator_effect_confirmed: Literal[False]
    action_authorized: Literal[False]

    @model_validator(mode="after")
    def require_complete_arrival_comparison(self):
        required = {'target_present', 'scope_matches', 'current_context_present',
                    'operator_matches', 'recipe_matches', 'pose_matches', 'support_matches'}
        if set(self.comparisons) != required or any(self.comparisons[key] is not True for key in required):
            raise ValueError('Composition access consumption requires every current arrival comparison')
        return self
