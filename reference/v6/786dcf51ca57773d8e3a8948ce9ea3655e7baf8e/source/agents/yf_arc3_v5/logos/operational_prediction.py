"""Conditional physical consequences retained by operational consciousness."""
from typing import Literal
from pydantic import Field, model_validator, model_serializer
from .types import FrozenModel, FrozenMap, Ref


class OperationalConsciousnessTranslationRow(FrozenModel):
    candidate_ref: Ref
    historical_candidate_refs: tuple[Ref, ...] = Field(min_length=1)
    participant_refs: tuple[Ref, ...] = Field(min_length=1, max_length=16)
    current_bounds: tuple[tuple[int, int, int, int], ...]
    observed_deltas: tuple[tuple[int, int], ...]
    predicted_bounds: tuple[tuple[int, int, int, int], ...]

    @model_validator(mode='after')
    def exact_translation(self):
        if not (len(self.participant_refs) == len(self.current_bounds)
                == len(self.observed_deltas) == len(self.predicted_bounds)):
            raise ValueError('conditional translation lost a participant')
        for bounds, delta, future in zip(self.current_bounds, self.observed_deltas, self.predicted_bounds):
            dr, dc = delta
            if future != (bounds[0] + dr, bounds[1] + dc, bounds[2] + dr, bounds[3] + dc):
                raise ValueError('conditional translation differs from its measured displacement')
        return self


class OperationalConsciousnessContextTranslation(FrozenModel):
    entity_ref: Ref
    current_bounds: tuple[int, int, int, int]
    observed_delta: tuple[int, int]
    predicted_bounds: tuple[int, int, int, int]

    @model_validator(mode='after')
    def exact_translation(self):
        b, (dr, dc) = self.current_bounds, self.observed_delta
        if self.predicted_bounds != (b[0] + dr, b[1] + dc, b[2] + dr, b[3] + dc):
            raise ValueError('context translation differs from its observed displacement')
        return self


class OperationalConsciousnessSymbolicStateRow(FrozenModel):
    candidate_ref: Ref
    historical_candidate_refs: tuple[Ref, ...] = Field(min_length=1)
    participant_refs: tuple[Ref, ...] = Field(min_length=1, max_length=16)
    current_states: tuple[FrozenMap, ...]
    predicted_states: tuple[FrozenMap, ...]
    prediction_ref: Ref | None = None
    observation_refs: tuple[Ref, ...] = ()
    state_context: FrozenMap = Field(default_factory=FrozenMap)
    state_context_missing_refs: FrozenMap = Field(default_factory=FrozenMap)

    @model_validator(mode='after')
    def complete_state_binding(self):
        if not (len(self.participant_refs) == len(self.current_states) == len(self.predicted_states)):
            raise ValueError('symbolic transition lost a participant state')
        if self.prediction_ref is not None:
            if not self.observation_refs:
                raise ValueError('a symbolic response variant requires its observed witnesses')
            for ref, current, predicted in zip(self.participant_refs, self.current_states, self.predicted_states):
                if self.state_context.get(ref) != FrozenMap({'current_state': current, 'predicted_state': predicted}):
                    raise ValueError('symbolic response variant differs from its own context')
        return self

    @model_serializer(mode='wrap')
    def preserve_prior_shape(self, handler):
        data = handler(self)
        for name in ('prediction_ref', 'observation_refs', 'state_context', 'state_context_missing_refs'):
            if name not in self.model_fields_set:
                data.pop(name, None)
        return data

    def canonical_field_names(self):
        return tuple(name for name in self.__class__.model_fields if
            name not in ('prediction_ref', 'observation_refs', 'state_context', 'state_context_missing_refs') or name in self.model_fields_set)


class OperationalConsciousnessApplicationPrediction(FrozenModel):
    """A calculated hypothesis, with exact input binding and unresolved conditions."""
    domain_ref: Ref
    input_digest: Ref
    observation_ref: Ref
    historical_action_ref: Ref
    historical_action_data: FrozenMap
    historical_control_signature: FrozenMap
    hypothesis_ref: Ref
    condition_refs: tuple[Ref, ...] = Field(min_length=1)
    falsifier_refs: tuple[Ref, ...] = Field(min_length=1)
    rows: tuple[OperationalConsciousnessTranslationRow, ...] = Field(default=(), max_length=256)
    uncalculated_candidates: FrozenMap
    context_translations: tuple[OperationalConsciousnessContextTranslation, ...] = Field(default=(), max_length=64)
    context_translation_missing_refs: FrozenMap = Field(default_factory=FrozenMap)
    symbolic_state_rows: tuple[OperationalConsciousnessSymbolicStateRow, ...] = Field(default=(), max_length=256)
    symbolic_state_context: FrozenMap = Field(default_factory=FrozenMap)
    prediction_family_missing_refs: FrozenMap = Field(default_factory=FrozenMap)
    epistemic_status: Literal['conditional_prediction'] = 'conditional_prediction'
    current_control_and_payload_revalidated: Literal[False] = False
    collision_and_preservation_verified: Literal[False] = False
    goal_effect_established: Literal[False] = False
    grants_action: Literal[False] = False

    @model_validator(mode='after')
    def has_calculated_response(self):
        if not self.rows and not self.symbolic_state_rows:
            raise ValueError('an application prediction requires a calculated response')
        return self

    @model_serializer(mode='wrap')
    def preserve_prior_shape(self, handler):
        data = handler(self)
        for name in ('context_translations', 'context_translation_missing_refs', 'symbolic_state_rows',
                'symbolic_state_context', 'prediction_family_missing_refs'):
            if name not in self.model_fields_set:
                data.pop(name, None)
        return data

    def canonical_field_names(self):
        return tuple(name for name in self.__class__.model_fields if
            name not in ('context_translations', 'context_translation_missing_refs', 'symbolic_state_rows',
                'symbolic_state_context', 'prediction_family_missing_refs') or name in self.model_fields_set)
