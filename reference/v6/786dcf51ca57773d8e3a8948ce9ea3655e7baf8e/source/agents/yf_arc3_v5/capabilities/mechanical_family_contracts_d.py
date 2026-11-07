"""Caller-owned immutable contracts for the mechanical families assigned to D."""

from __future__ import annotations

from time import monotonic
from typing import ClassVar

from pydantic import Field

from agents.yf_arc3_v5.logos.types import FrozenMap, FrozenModel, Ref, stable_digest, immutable_json_data


def d_map(value=None) -> FrozenMap:
    """Use the existing immutable projector, including typed model subtrees.

    An empty optional map is {}, not an unsupported tuple. This is representation
    transport only: no new JSON serializer, model/status selection or deepcopy.
    """
    if value is None or (type(value) is tuple and not value):
        value = {}
    projected = immutable_json_data(value)
    if not isinstance(projected, FrozenMap):
        raise TypeError('D descriptive map requires an immutable mapping')
    return projected


class DMechanicalScope(FrozenModel):
    request_ref: Ref
    caller_ref: Ref
    parent_consumer_ref: Ref
    parent_goal_ref: Ref
    parent_contribution_ref: Ref
    caller_next_item_ref: Ref
    epoch: int = Field(ge=0)
    evidence_revision_ref: Ref
    model_revision_ref: Ref
    model_status_ref: Ref
    event_owner_ref: Ref
    input_domain_complete: bool
    assumption_refs: tuple[Ref, ...] = Field(default=(), max_length=64)


class DMechanicalRequest(FrozenModel):
    scope: DMechanicalScope
    operation_ref: Ref
    mode_ref: Ref | None
    requested_result_type: Ref
    node_bound: int = Field(ge=1, le=100000)
    depth_bound: int = Field(ge=1, le=4096)
    domain_bound: int = Field(ge=1, le=4096)
    time_bound_ms: int = Field(ge=1, le=300000)
    observations: tuple[FrozenMap, ...] = Field(default=(), max_length=4096)
    resume_frontier: FrozenMap = Field(default_factory=FrozenMap)
    signature_pairs: ClassVar[tuple[tuple[str, str], ...]] = ()


class DMechanicalResult(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.d_mechanical_result.v1"
    scope: DMechanicalScope
    operation_ref: Ref
    mode_ref: Ref | None
    status: Ref
    cause: Ref
    values: FrozenMap = Field(default_factory=FrozenMap)
    domain_complete: bool = False
    examined_count: int = Field(default=0, ge=0)
    frontier: FrozenMap = Field(default_factory=FrozenMap)
    descriptive_facts: FrozenMap
    source_disposition_ref: Ref | None = None
    source_policy_ref: Ref | None = None


class DMechanicalSignatureFacts(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.d_mechanical_signature_facts.v1"
    descriptive_facts: FrozenMap


class DComputationInterrupted(Exception):
    def __init__(self, cause: str, frontier: FrozenMap):
        super().__init__(cause)
        self.cause = cause
        self.frontier = frontier


class DResumeMismatch(Exception):
    pass


class DWorkBudget:
    """Actual time/node bounds; a interruption never produces a complete receipt."""

    def __init__(self, request: DMechanicalRequest):
        self.request = request
        self.started = monotonic()
        self.examined = 0

    def visit(self, frontier=()):
        if self.examined >= self.request.node_bound:
            raise DComputationInterrupted("NODE_BOUND", d_map(frontier))
        if (monotonic() - self.started) * 1000 >= self.request.time_bound_ms:
            raise DComputationInterrupted("TIME_BOUND", d_map(frontier))
        self.examined += 1

    def finish(self):
        if (monotonic() - self.started) * 1000 >= self.request.time_bound_ms:
            raise DComputationInterrupted("TIME_BOUND", d_map())


def d_result(request, status, cause, *, values=(), complete=False, examined=0, frontier=(), descriptive_delta=()):
    # This is the declared bounded projection boundary, not a live-context copy.
    fact_values = {
        "request_ref": request.scope.request_ref, "caller_ref": request.scope.caller_ref,
        "parent_consumer_ref": request.scope.parent_consumer_ref,
        "parent_goal_ref": request.scope.parent_goal_ref,
        "parent_contribution_ref": request.scope.parent_contribution_ref,
        "caller_next_item_ref": request.scope.caller_next_item_ref,
        "epoch": request.scope.epoch, "evidence_revision_ref": request.scope.evidence_revision_ref,
        "model_revision_ref": request.scope.model_revision_ref,
        "event_owner_ref": request.scope.event_owner_ref,
        "operation_ref": request.operation_ref, "mode_ref": request.mode_ref,
        "status": status, "cause": cause, "domain_complete": complete,
        "examined_count": examined, "primitive_release_authorized": False,
        "retained_model_refs": tuple(model.model_ref for model in getattr(request, 'models', ())),
    }
    delta=d_map(descriptive_delta)
    if len(delta)>64 or set(delta)&set(fact_values):
        raise ValueError('descriptive audit delta is bounded and cannot replace the immutable return scope')
    fact_values.update(delta)
    facts=d_map(fact_values)
    return DMechanicalResult(scope=request.scope, operation_ref=request.operation_ref,
        mode_ref=request.mode_ref, status=status, cause=cause, values=d_map(values),
        domain_complete=complete, examined_count=examined, frontier=d_map(frontier),
        descriptive_facts=facts)


class DSourceAuditReturnInput(FrozenModel):
    schema_version: Ref='yf_arc3_v5.d_source_audit_return_input.v1'
    measurement: DMechanicalResult
    source_disposition_ref: Ref | None
    source_policy_ref: Ref


def d_source_audit_return(request: DSourceAuditReturnInput):
    """Transport the actual SRC/DRM result; never select or reconstruct its meaning."""
    return request.measurement.model_copy(update={'source_disposition_ref':request.source_disposition_ref,'source_policy_ref':request.source_policy_ref})


def d_signature_projection(request):
    return DMechanicalSignatureFacts(descriptive_facts=d_map({
        "operation_ref": request.operation_ref, "mode_ref": request.mode_ref,
        "requested_result_type": request.requested_result_type,
        "input_domain_complete": request.scope.input_domain_complete,
        "request_ref": request.scope.request_ref,
    }))


def d_signature_rejection(request):
    return d_result(request, "NOT_APPLICABLE", "SIGNATURE_MISMATCH")


def d_validate_request(request):
    if (request.operation_ref, request.mode_ref) not in request.signature_pairs:
        return d_signature_rejection(request)
    if request.requested_result_type != "DMechanicalResult":
        return d_signature_rejection(request)
    if not request.scope.input_domain_complete:
        return d_result(request, "NEEDS_EVIDENCE", "INPUT_DOMAIN_INCOMPLETE")
    if not all((request.scope.evidence_revision_ref, request.scope.model_revision_ref,
                request.scope.event_owner_ref, request.scope.caller_next_item_ref)):
        return d_result(request, "NEEDS_EVIDENCE", "REQUEST_SCOPE_INCOMPLETE")
    models = getattr(request, 'models', ())
    if len(set(model.model_ref for model in models)) != len(models):
        return d_result(request, 'NEEDS_EVIDENCE', 'DUPLICATE_MODEL_IDENTITY')
    return None


def d_input_digest(request):
    """A caller may extend compute bounds, never change the scoped world input."""
    return stable_digest(request.model_dump(exclude={
        'node_bound', 'depth_bound', 'domain_bound', 'time_bound_ms', 'resume_frontier'}))


def d_resume_rows(request, model_refs):
    """Reuse completed correlated models; restart the unfinished pure model.

    No partial result is committed. Restarting the unfinished model is explicit,
    not a claim that a partially simulated input can be released or reconciled.
    """
    if not request.resume_frontier:
        return []
    if request.resume_frontier.get('input_digest') != d_input_digest(request):
        raise DResumeMismatch('RESUME_INPUT_OR_REVISION_MISMATCH')
    rows = tuple(request.resume_frontier.get('completed_model_results', ()))
    if tuple(row['model_ref'] for row in rows) != tuple(model_refs[:len(rows)]):
        raise DResumeMismatch('RESUME_MODEL_PREFIX_MISMATCH')
    return list(rows)


def d_resumable_frontier(request, rows, model_ref, work=()):
    return d_map({'input_digest': d_input_digest(request),
        'completed_model_results': tuple(row for row in rows if row.get('model_ref') is not None),
        'unfinished_model_ref': model_ref,
        'work_frontier': d_map(work), 'resume_strategy': 'reuse_complete_prefix_restart_unfinished_pure_model',
        'caller_next_item_ref': request.scope.caller_next_item_ref,
        'evidence_revision_ref': request.scope.evidence_revision_ref,
        'model_revision_ref': request.scope.model_revision_ref})


def d_measure_layers(request, budget):
    """Only caller-declared supports; no object roles, graph ports or glyph law."""
    if request.frame is None or not request.layer_regions:
        raise DResumeMismatch('FRAME_OR_DECLARED_LAYER_REGIONS_MISSING')
    result = []
    for region in request.layer_regions:
        bounds = region.get('bounds')
        if not bounds or len(bounds) != 4 or not region.get('layer_ref'):
            raise DResumeMismatch('DECLARED_REGION_SCOPE_MISSING')
        if any(not isinstance(value, int) or isinstance(value, bool) for value in bounds):
            raise DResumeMismatch('DECLARED_REGION_BOUNDS_NOT_INTEGRAL')
        top, left, bottom, right = bounds
        if bottom < top or right < left:
            raise DResumeMismatch('DECLARED_REGION_BOUNDS_REVERSED')
        crop = []
        for row_index in range(max(0, top), min(request.frame.height, bottom + 1)):
            budget.visit({'layer_ref': region['layer_ref'], 'row_index': row_index})
            crop.append(tuple(request.frame.rows[row_index][column]
                for column in range(max(0, left), min(request.frame.width, right + 1))))
        crop = tuple(crop)
        result.append(d_map({'layer_ref': region['layer_ref'], 'bounds': bounds,
            'signature': stable_digest(crop), 'crop': crop, 'scale_ref': region.get('scale_ref'),
            'clipped': top < 0 or left < 0 or bottom >= request.frame.height or right >= request.frame.width,
            'symbolic_content_unresolved': True}))
    return tuple(result)
