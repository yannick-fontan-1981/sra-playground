"""Typed transport-only contracts for the single V5 environment boundary."""

from __future__ import annotations

from typing import Literal, Protocol

from pydantic import Field, model_validator, model_serializer
from agents.yf_arc3_v5.logos.operational_experiment_admission import OperationalConsciousnessSelectionFrontier

from agents.yf_arc3_v5.logos.operations import (
    ActionIntent,
    ActionReleasePermit,
    ViabilityAssessment,
)
from agents.yf_arc3_v5.logos.types import FrozenMap, FrozenModel, Ref, require_unique


class CompiledCalculationControllerOutcome(FrozenModel):
    """A canonical calculation result needs no fictitious activity context."""
    reasoning_outcome_ref: Ref
    source_workflow_ref: Ref
    source_hash: Ref
    workflow_instance_ref: Ref
    run_ref: Ref
    timeline_ref: Ref
    frame_ref: Ref
    boundary_kind: Literal['compiled_calculation'] = 'compiled_calculation'
    status: Literal['blocked', 'deferred', 'failed']
    kind: Literal['operational_consciousness_refusal', 'operational_consciousness_wait',
                  'operational_consciousness_failure']
    reason: Literal['source_calculation_returned'] = 'source_calculation_returned'
    exception_type_ref: Ref | None = None
    automatic_retry_authorized: Literal[False] = False
    grants_action: Literal[False] = False
    schema_version: Literal['compiled_calculation_controller_outcome.v1'] = 'compiled_calculation_controller_outcome.v1'

    @model_validator(mode='after')
    def preserve_calculation_status(self):
        expected = {'blocked': 'operational_consciousness_refusal',
                    'deferred': 'operational_consciousness_wait',
                    'failed': 'operational_consciousness_failure'}
        if self.kind != expected[self.status]:
            raise ValueError('calculation return changed its actual status')
        if (self.status == 'failed') != (self.exception_type_ref is not None):
            raise ValueError('calculation failure and technical cause disagree')
        return self


class OperationalConsciousnessControllerOutcome(FrozenModel):
    """Public identity of an existing reasoning outcome; it grants no retry."""
    reasoning_outcome_ref: Ref
    reasoning_context_ref: Ref
    source_workflow_ref: Ref
    source_hash: Ref
    workflow_instance_ref: Ref
    run_ref: Ref
    timeline_ref: Ref
    frame_ref: Ref
    boundary_kind: Literal['workflow_checkpoint', 'compiled_return']
    automatic_retry_authorized: Literal[False] = False
    grants_action: Literal[False] = False


class OperationalConsciousnessControllerWait(OperationalConsciousnessControllerOutcome):
    status: Literal['deferred'] = 'deferred'
    kind: Literal['operational_consciousness_wait'] = 'operational_consciousness_wait'
    reason: Literal['source_reasoning_deferred'] = 'source_reasoning_deferred'
    schema_version: Literal['operational_consciousness_controller_wait.v1'] = 'operational_consciousness_controller_wait.v1'


class OperationalConsciousnessControllerRefusal(OperationalConsciousnessControllerOutcome):
    status: Literal['blocked'] = 'blocked'
    kind: Literal['operational_consciousness_refusal'] = 'operational_consciousness_refusal'
    reason: Literal['source_reasoning_refused'] = 'source_reasoning_refused'
    reasoning_status: Literal['blocked', 'failed']
    schema_version: Literal['operational_consciousness_controller_refusal.v1'] = 'operational_consciousness_controller_refusal.v1'


class OperationalConsciousnessControllerFailure(OperationalConsciousnessControllerOutcome):
    """Canonical technical failure; neither world falsification nor permission."""
    status: Literal['failed'] = 'failed'
    kind: Literal['operational_consciousness_failure'] = 'operational_consciousness_failure'
    reason: Literal['source_reasoning_failed'] = 'source_reasoning_failed'
    reasoning_status: Literal['failed'] = 'failed'
    exception_type_ref: Ref
    schema_version: Literal['operational_consciousness_controller_failure.v1'] = 'operational_consciousness_controller_failure.v1'


class ObservedWorldInput(FrozenModel):
    raw_input_ref: Ref
    frame_id: Ref
    frame: tuple[tuple[int, ...], ...] = Field(min_length=1)
    available_action_refs: tuple[Ref, ...] = ()
    score: int = Field(default=0, ge=0, le=254)
    state: Ref = "NOT_FINISHED"
    metadata: FrozenMap = Field(default_factory=FrozenMap)
    schema_version: Ref = "yf_arc3_v5.observed_world_input.v1"

    @model_validator(mode="after")
    def validate_frame(self) -> "ObservedWorldInput":
        width = len(self.frame[0])
        if width < 1 or any(len(row) != width for row in self.frame):
            raise ValueError("observed frame must be a non-empty rectangle")
        require_unique(self.available_action_refs, "available action refs")
        return self


class EnvironmentActionRequest(FrozenModel):
    dispatch_id: Ref
    environment_adapter_ref: Ref
    workflow_definition_id: Ref
    workflow_instance_id: Ref
    timeline_id: Ref
    frame_id: Ref
    intent: ActionIntent
    permit: ActionReleasePermit
    world_context: FrozenMap
    request_digest: Ref
    schema_version: Ref = "yf_arc3_v5.environment_action_request.v1"


class EnvironmentActionResponse(FrozenModel):
    dispatch_id: Ref
    environment_action_event_ref: Ref
    action_intent_id: Ref
    action_release_permit_id: Ref
    raw_input: ObservedWorldInput
    response_digest: Ref
    transport_metadata: FrozenMap = Field(default_factory=FrozenMap)
    schema_version: Ref = "yf_arc3_v5.environment_action_response.v1"


class SessionBootstrapResponse(FrozenModel):
    raw_input: ObservedWorldInput
    session_metadata: FrozenMap = Field(default_factory=FrozenMap)
    schema_version: Ref = "yf_arc3_v5.session_bootstrap_response.v1"


class EnvironmentTransport(Protocol):
    def execute(self, request: EnvironmentActionRequest) -> EnvironmentActionResponse:
        """Execute exactly one already-authorized environment action."""


class SessionEnvironmentTransport(EnvironmentTransport, Protocol):
    def bootstrap(self) -> SessionBootstrapResponse:
        """Reset/select a session through the explicit bootstrap exception."""


class BoundaryDispatchResult(FrozenModel):
    workflow_instance_id: Ref
    dispatch_id: Ref
    environment_action_event_ref: Ref
    frame_id: Ref
    workflow_status: Ref
    state_revision: int
    reused: bool = False
    schema_version: Ref = "yf_arc3_v5.boundary_dispatch_result.v1"


class PreparedInteractionProbe(FrozenModel):
    """Mechanical envelope for one candidate already selected by SRC/DRM."""

    selected_candidate_ref: Ref
    viability: ViabilityAssessment
    intent: ActionIntent
    context: FrozenMap
    alternatives_preserved: tuple[Ref, ...] = ()
    selection_policy_ref: Ref = ""
    selection_source_ref: Ref = ""
    point_locus_authorized: bool = False
    selection_frontier: OperationalConsciousnessSelectionFrontier | None = None
    schema_version: Ref = "yf_arc3_v5.prepared_interaction_probe.v1"

    @model_serializer(mode='wrap')
    def preserve_prior_selection_shape(self, handler):
        data = handler(self)
        if 'selection_frontier' not in self.model_fields_set:
            data.pop('selection_frontier', None)
        return data

    def canonical_field_names(self):
        return tuple(name for name in self.__class__.model_fields
            if name != 'selection_frontier' or name in self.model_fields_set)
