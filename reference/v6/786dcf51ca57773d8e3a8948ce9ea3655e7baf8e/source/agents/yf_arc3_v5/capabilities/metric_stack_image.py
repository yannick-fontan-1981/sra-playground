"""Pure bounded metric/top-stack mathematics, with no live action authority.

Each function implements one separately selected operation. SRC chooses the
case and the meaning of flags; these functions never dispatch another case.
"""
from __future__ import annotations

from collections import deque
from collections.abc import Mapping
from fractions import Fraction
import hashlib
import json
from time import perf_counter_ns

from agents.yf_arc3_v5.logos.types import FrozenMap
from agents.yf_arc3_v5.capabilities.metric_stack_contracts import (
    MetricStackRequest, MetricStackFacts, MetricStackCalculation,
    MetricStackAssemblyInput, MetricStackState, StackPrimitive,
)
from agents.yf_arc3_v5.capabilities.mechanical_request_contracts import (
    MechanicalResponseInput, MechanicalDomainReceipt,
)


OPERATIONS = {
    "grid_boundaries": "MEASURE", "stack_control_fit": "FIT",
    "visible_stack_projection": "PROJECT", "target_domain": "DOMAIN",
    "occurrence_assignment": "DOMAIN", "exposure_dependencies": "PRECONDITION",
    "stack_step": "STEP", "transport_schedule": "DOMAIN",
    "sealed_stack_compare": "COMPARE", "transport_lower_bound": "BOUND",
    "external_primitive": "STEP",
}


def metric_packet_fingerprint(request: MetricStackRequest) -> str:
    body = request.model_dump(mode="json", exclude={"resume_frontier"})
    # The binding carries this digest; including it would require a hash fixed
    # point. All other immutable inputs, laws, bounds and ownership remain bound.
    body["identity"]["immutable_inputs"].pop("metric_packet_fingerprint", None)
    return hashlib.sha256(json.dumps(body, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def measure_metric_stack_request(request: MetricStackRequest) -> MetricStackFacts:
    """Expose exact signature/presence/current-revision facts, not an operation."""
    identity = request.identity
    facts = {
        "kernel_matches": identity.kernel_ref == "mechanics.metric_stack_image",
        "return_type_matches": identity.expected_return_type == "metric_stack_image.result.v1",
        "packet_binding_matches": identity.immutable_inputs.get("metric_packet_fingerprint") == metric_packet_fingerprint(request),
        "has_current_evidence": bool(request.evidence_refs),
        "has_state": request.state is not None,
        "has_law": request.law is not None,
        "has_target": request.target is not None,
        "has_primitive": request.primitive is not None,
        "has_sealed_packet": request.sealed_packet_ref is not None,
        "sealed_inventory_comparable": bool(request.sealed_samples) and all(
            x.expected.inventory_complete_evidence_ref is not None
            and x.observed.inventory_complete_evidence_ref is not None for x in request.sealed_samples),
        "has_control_samples": bool(request.control_samples),
        "has_boundary_samples": bool(request.boundaries),
        "has_external_ownership": request.external_ownership is not None,
        "external_ownership_current": request.external_ownership is not None and request.law is not None
            and request.primitive is not None
            and request.external_ownership.contract_ref in request.evidence_refs
            and request.external_ownership.automatic_identity_evidence_ref in request.evidence_refs
            and request.external_ownership.event_owner_ref == request.law.event_owner_ref
            and request.external_ownership.primitive_ref == request.primitive.primitive_ref,
        "external_acceptance_law_present": request.law is not None
            and request.law.acceptance_checkpoint is not None,
        "bound_execution_scope_current": request.execution_scope_ref is not None
            and request.execution_scope_ref in request.evidence_refs
            and bool(request.execution_primitive_kinds)
            and "RESET" not in request.execution_primitive_kinds,
        "bound_inventory_current": request.state is not None
            and request.state.inventory_complete_evidence_ref in request.evidence_refs
            and all(o.color_ref is not None for stack in request.state.stacks for o in stack),
        "bound_target_domain_current": request.target_domain_complete_evidence_ref is not None
            and request.target_domain_complete_evidence_ref in request.evidence_refs,
        "law_dimension_supported": request.law is None or request.law.dimension_rule == "CELL_SUPPORT",
        "operation_ref": identity.operation_ref, "mode": identity.mode,
        "signature_declared": any(identity.operation_ref == "mechanics.metric_stack_image." + op
            and identity.mode == mode for op, mode in sorted(OPERATIONS.items())),
        "state_revision_matches": request.state is None or (
            identity.immutable_inputs.get("state_revision_ref") == request.state.state_revision_ref
            and identity.model_assignments.get("grid_revision_ref") == request.state.grid_revision_ref),
        "law_revision_matches": request.law is None or (
            identity.model_assignments.get("stack_law_revision_ref") == request.law.law_revision_ref
            and all(ref in request.evidence_refs for ref in request.law.evidence_refs)),
        "evidence_revision_matches": all(
            item.evidence_revision_ref == request.evidence_revision_ref
            and item.evidence_ref in request.evidence_refs
            for item in (*request.boundaries, *request.control_samples)),
    }
    facts.update(measure_metric_schedule_scope(request))
    from .metric_schedule_c import metric_schedule_resume_is_qualified
    facts["schedule_resume_current"] = metric_schedule_resume_is_qualified(request)
    return MetricStackFacts(facts=FrozenMap(facts))


def measure_metric_schedule_scope(request: MetricStackRequest):
    scope, identity = request.schedule_scope, request.identity
    ownership, state, law = request.external_ownership, request.state, request.law
    if scope is None:
        return {"schedule_scope_current": False, "schedule_inputs_current": False,
            "schedule_domain_declared": False, "schedule_phase_contract_complete": False}
    same = all(getattr(scope.search_identity, name) == getattr(identity, name)
        and getattr(scope.child_identity, name) == getattr(identity, name)
        for name in ("caller_ref", "parent_contribution_ref", "epoch", "input_revision_ref"))
    phase_names = tuple(row.phase for row in scope.phases)
    ordered = ("DIRECT", "AUTOMATIC", "COST", "ACCEPTANCE") if ownership is not None and (
        ownership.cost_acceptance_order == "COST_THEN_ACCEPTANCE") else ("DIRECT", "AUTOMATIC", "ACCEPTANCE", "COST")
    by_phase = {row.phase: row for row in scope.phases}
    ticks = tuple(by_phase[name].tick for name in ordered if name in by_phase)
    cells = {cell.cell_ref for cell in state.cells} if state is not None else set()
    bounds = scope.search_identity.actual_bounds
    restriction = (request.schedule_allowed_destination_refs is None or (
        request.schedule_restriction_evidence_ref is not None
        and request.schedule_restriction_evidence_ref in request.evidence_refs
        and set(request.schedule_allowed_destination_refs).issubset(cells)
        and len(set(request.schedule_allowed_destination_refs)) == len(request.schedule_allowed_destination_refs)))
    return {"schedule_scope_current": same and request.evidence_revision_ref == identity.input_revision_ref
        and identity.immutable_inputs.get("source_parent_goal_ref") == scope.parent_goal_ref
        and identity.immutable_inputs.get("source_goal_contract_ref") == scope.goal_contract_ref
        and scope.identity_contract_ref in request.evidence_refs
        and scope.phase_clock_contract_ref in request.evidence_refs
        and scope.search_identity.kernel_ref == "mechanics.bounded_route_search"
        and scope.search_identity.operation_ref == "mechanics.bounded_route_search"
        and scope.search_identity.mode == "ROUTE" and scope.search_identity.expected_return_type == "SearchResultC"
        and scope.search_identity.requested_domain_ref is not None
        and scope.child_identity.kernel_ref == "mechanics.metric_stack_image"
        and scope.child_identity.operation_ref == "mechanics.metric_stack_image.external_primitive"
        and scope.child_identity.mode == "STEP" and scope.child_identity.expected_return_type == "metric_stack_image.result.v1"
        and scope.child_identity.model_assignments == identity.model_assignments
        and scope.search_identity.model_assignments == FrozenMap({scope.model_ref: identity.model_assignments}),
        "schedule_inputs_current": state is not None and law is not None and request.target is not None
        and ownership is not None and not ownership.pre_terminal
        and ownership.contract_ref in request.evidence_refs
        and ownership.automatic_identity_evidence_ref in request.evidence_refs
        and ownership.event_owner_ref == law.event_owner_ref and law.acceptance_checkpoint is not None
        and state.inventory_complete_evidence_ref in request.evidence_refs,
        "schedule_domain_declared": restriction and request.execution_scope_ref in request.evidence_refs
        and set(bounds).issuperset({"max_states", "max_candidates", "max_depth", "max_events", "max_primitives"})
        and bounds.get("max_states", 0) <= identity.actual_bounds["nodes"]
        and bounds.get("max_candidates", 0) <= identity.actual_bounds["nodes"]
        and set(scope.child_identity.actual_bounds).issuperset({"nodes", "outputs", "time_ms"})
        and scope.child_identity.actual_bounds.get("nodes", 0) <= 4096
        and scope.child_identity.actual_bounds.get("outputs", 0) <= 128
        and scope.child_identity.actual_bounds.get("time_ms", 0) <= 60000
        and ("RESET" not in request.execution_primitive_kinds or (
            request.declared_restoration is not None and request.restoration_contract_ref in request.evidence_refs)),
        "schedule_phase_contract_complete": set(phase_names) == {"DIRECT", "AUTOMATIC", "COST", "ACCEPTANCE"}
        and len(set(phase_names)) == len(phase_names) and len({row.occurrence_ref for row in scope.phases}) == 4
        and len({row.snapshot_ref for row in scope.phases}) == 4
        and len({row.clock_ref for row in scope.phases}) == 1
        and len({row.temporal_scope_ref for row in scope.phases}) == 1 and ticks == tuple(sorted(ticks))}


class _Work:
    def __init__(self, request):
        self.limit = request.identity.actual_bounds["nodes"]
        self.output_limit = request.identity.actual_bounds["outputs"]
        self.count = 0
        self.hit = False
        self.started_ns = perf_counter_ns()
        retained = request.resume_frontier.get("work", {})
        retained_valid = isinstance(retained, Mapping)
        if not retained_valid:
            retained = {}
        prior_count = retained.get("node_visits", 0)
        prior_ns = retained.get("elapsed_ns", 0)
        self.invalid_resume = bool(request.resume_frontier) and (
            not retained_valid
            or request.resume_frontier.get("packet_fingerprint") != metric_packet_fingerprint(request)
            or type(prior_count) is not int or not 0 <= prior_count <= self.limit
            or type(prior_ns) is not int or prior_ns < 0)
        self.prior_count = prior_count if not self.invalid_resume else 0
        self.prior_ns = prior_ns if not self.invalid_resume else 0
        self.time_limit_ns = request.identity.actual_bounds["time_ms"] * 1_000_000

    def elapsed_ns(self):
        return self.prior_ns + perf_counter_ns() - self.started_ns

    def time_available(self):
        if self.invalid_resume or self.elapsed_ns() >= self.time_limit_ns:
            self.hit = True
            return False
        return True

    def visit(self):
        if not self.time_available() or self.prior_count + self.count >= self.limit:
            self.hit = True
            return False
        self.count += 1
        return True


def _result(request, work, values, *, unknown=(), contradiction=False, pending=0,
            frontier=None, domain_size=None, domain_examined=None, alternatives=()):
    work.time_available()
    contradiction = contradiction or work.invalid_resume
    if work.hit and "closure_complete" in values:
        values = {**values, "closure_complete": False}
    retained = dict(frontier or {})
    retained["packet_fingerprint"] = metric_packet_fingerprint(request)
    retained["work"] = {"node_visits": work.prior_count + work.count,
        "elapsed_ns": work.elapsed_ns()}
    values = {**values, "actual_node_visits": work.count,
        "actual_total_node_visits": work.prior_count + work.count,
        "declared_time_ms": request.identity.actual_bounds["time_ms"], "time_bound_enforced": True,
        "resume_identity_invalid": work.invalid_resume}
    return MetricStackCalculation(
        request_identity=request.identity, values=FrozenMap(values),
        facts=FrozenMap({"has_missing_observation": bool(unknown),
            "model_contradiction": contradiction, "bound_reached": work.hit,
            "empty_complete_domain": domain_size is not None and domain_size == domain_examined
                and not pending and not work.hit and not unknown and not contradiction
                and not values.get("candidates", ()),
            "missing_observation_refs": tuple(unknown)}),
        examined_count=work.count if domain_examined is None else domain_examined, declared_domain_size=domain_size,
        pending_count=pending, retained_frontier=FrozenMap(retained),
        retained_alternative_refs=tuple(alternatives)[:128])


def _fingerprint(state):
    return hashlib.sha256(json.dumps(state.model_dump(mode="json"), sort_keys=True,
        separators=(",", ":")).encode()).hexdigest()


def measure_metric_grid_boundaries(request: MetricStackRequest) -> MetricStackCalculation:
    work = _Work(request)
    groups = {}
    cursor = int(request.resume_frontier.get("cursor", 0))
    # Resume reuses only an identity-bound accumulated interval map.
    if request.resume_frontier:
        if request.resume_frontier.get("packet_fingerprint") != metric_packet_fingerprint(request):
            return _result(request, work, {"resume_mismatch": True}, contradiction=True)
        groups = {key: {**dict(value), "evidence_refs": list(value["evidence_refs"]),
            "spans": list(value["spans"])} for key, value in sorted(request.resume_frontier.get("groups", {}).items())}
        if not 0 <= cursor <= len(request.boundaries) or len(groups) > 256:
            raise ValueError("invalid bounded boundary resume packet")
    for i in range(cursor, len(request.boundaries)):
        if not work.visit():
            cursor = i
            break
        item = request.boundaries[i]
        key = item.model_ref + ":" + item.axis + ":" + item.cut_ref
        group = groups.setdefault(key, {"model_ref": item.model_ref, "axis": item.axis, "cut_ref": item.cut_ref,
            "lower": item.lower, "upper": item.upper, "evidence_refs": [], "spans": []})
        group["lower"] = max(group["lower"], item.lower)
        group["upper"] = min(group["upper"], item.upper)
        group["evidence_refs"].append(item.evidence_ref)
        group["spans"].append((item.span_start, item.span_end, item.occluded))
        cursor = i + 1
    ordered = tuple(groups[key] for key in sorted(groups))
    models = sorted({g["model_ref"] for g in ordered})
    refuted_models = {g["model_ref"] for g in ordered if g["lower"] > g["upper"]}
    contradiction = bool(models) and all(model in refuted_models for model in models)
    unresolved = tuple(g["cut_ref"] for g in ordered if g["lower"] != g["upper"]
        and g["model_ref"] not in refuted_models)
    # An unresolved cut might split a rectangle. Never collapse it into a cell.
    cells = []
    coverage_unknown = set()
    def covered(group, start, end):
        position = start
        for a, b, occluded in sorted(group["spans"]):
            if not work.visit():
                return False
            if occluded:
                continue
            if a > position:
                break
            position = max(position, b)
            if position >= end:
                return True
        coverage_unknown.add(group["cut_ref"])
        return False
    for model in models:
        if model in refuted_models:
            continue
        model_cuts = tuple(g for g in ordered if g["model_ref"] == model)
        xcuts = sorted({g["lower"] for g in model_cuts if g["axis"] == "X" and g["lower"] == g["upper"]})
        ycuts = sorted({g["lower"] for g in model_cuts if g["axis"] == "Y" and g["lower"] == g["upper"]})
        for left, right in zip(xcuts, xcuts[1:]):
            for top, bottom in zip(ycuts, ycuts[1:]):
                if len(cells) >= work.output_limit or not work.visit():
                    work.hit = True
                    break
                hidden_x = any(g["axis"] == "X" and g["lower"] < right and g["upper"] > left
                    and g["lower"] != g["upper"] for g in model_cuts)
                hidden_y = any(g["axis"] == "Y" and g["lower"] < bottom and g["upper"] > top
                    and g["lower"] != g["upper"] for g in model_cuts)
                bounded = all(any(g["axis"] == axis and g["lower"] == cut and g["upper"] == cut
                    and covered(g, start, end) for g in model_cuts)
                    for axis, cut, start, end in (("X", left, top, bottom), ("X", right, top, bottom),
                        ("Y", top, left, right), ("Y", bottom, left, right)))
                if work.hit:
                    break
                if not bounded:
                    coverage_unknown.add("metric_cell_boundary_continuity")
                if not hidden_x and not hidden_y and bounded and not contradiction:
                    cells.append((model, left, top, right, bottom))
            if work.hit:
                break
        if work.hit:
            break
    mappings = tuple((point, tuple(i for i, c in enumerate(cells)
        if c[1] <= point[0] < c[3] and c[2] <= point[1] < c[4])) for point in request.query_points)
    unresolved = tuple(sorted(set(unresolved) | coverage_unknown))
    return _result(request, work, {"boundary_intervals": ordered, "metric_rectangles": tuple(cells),
        "point_to_cell": mappings, "unresolved_boundaries": unresolved,
        "refuted_model_refs": tuple(sorted(refuted_models)),
        "hidden_tile_count_inferred": False}, contradiction=contradiction,
        unknown=unresolved, pending=len(request.boundaries) - cursor,
        frontier={"cursor": cursor, "groups": groups, "packet_fingerprint": metric_packet_fingerprint(request)},
        alternatives=tuple(model for model in models if model not in refuted_models))


def fit_metric_stack_control(request: MetricStackRequest) -> MetricStackCalculation:
    work = _Work(request)
    retained = request.resume_frontier
    cursor = retained.get("next_sample", 0)
    evidence = list(retained.get("evidence_refs", ()))
    displacements = list(retained.get("observed_displacements", ()))
    cycle_pairs = list(retained.get("observed_cycle_pairs", ()))
    compatible_dimension_models = set(retained.get("dimension_hypotheses",
        ("CELL_SUPPORT", "RIGID", "INDEPENDENT_DEFORMATION")))
    top_only = retained.get("top_only_consistent", True)
    buried_selection_seen = retained.get("buried_selection_observed", False)
    if (work.invalid_resume or type(cursor) is not int or not 0 <= cursor <= len(request.control_samples)
            or len(evidence) != cursor or len(displacements) != cursor
            or not compatible_dimension_models <= {"CELL_SUPPORT", "RIGID", "INDEPENDENT_DEFORMATION"}
            or type(top_only) is not bool or type(buried_selection_seen) is not bool):
        return _result(request, work, {"resume_mismatch": True}, contradiction=True)
    for sample in request.control_samples[cursor:]:
        if not work.visit():
            break
        before, after = sample.dimensions_before, sample.dimensions_after
        if before != sample.support_before or after != sample.support_after:
            compatible_dimension_models.discard("CELL_SUPPORT")
        if before != after:
            compatible_dimension_models.discard("RIGID")
        if sample.selection_accepted and not sample.was_accessible_top:
            top_only = False
            buried_selection_seen = True
        evidence.append(sample.evidence_ref)
        displacements.append((sample.occurrence_ref, sample.position_after[0] - sample.position_before[0],
            sample.position_after[1] - sample.position_before[1]))
        if sample.input_kind == "CYCLE":
            cycle_pairs.append((sample.physical_selection_before_ref, sample.physical_selection_after_ref, sample.selection_accepted))
        cursor += 1
    # Independent deformation remains possible until a scoped causal law rules it
    # out; matching cell dimensions alone cannot establish that law.
    return _result(request, work, {"dimension_hypotheses": tuple(sorted(compatible_dimension_models)),
        "observed_displacements": tuple(displacements),
        "top_only_consistent": top_only, "buried_selection_observed": buried_selection_seen,
        "cycling_is_unmeasured": not cycle_pairs, "observed_cycle_pairs": tuple(cycle_pairs),
        "top_access_hypotheses": ("TOP_ONLY", "BURIED_ACCESS_UNMEASURED") if top_only else ("BURIED_ACCESS_OBSERVED",),
        "evidence_refs": tuple(evidence),
        "conditional_only": True}, pending=len(request.control_samples) - cursor,
        frontier={"next_sample": cursor, "dimension_hypotheses": tuple(sorted(compatible_dimension_models)),
            "evidence_refs": tuple(evidence), "observed_displacements": tuple(displacements),
            "observed_cycle_pairs": tuple(cycle_pairs), "top_only_consistent": top_only,
            "buried_selection_observed": buried_selection_seen}, alternatives=tuple(sorted(compatible_dimension_models)))


def project_metric_visible_stacks(request: MetricStackRequest) -> MetricStackCalculation:
    work = _Work(request)
    state = request.state
    retained = request.resume_frontier
    cursor = retained.get("next_cell", 0)
    visible = list(retained.get("visible_rectangles", ()))
    unknown = list(retained.get("unknown_color_refs", ()))
    hidden = list(retained.get("hidden_identity_refs", ()))
    if (work.invalid_resume or type(cursor) is not int or not 0 <= cursor <= len(state.cells)
            or len(visible) != cursor):
        return _result(request, work, {"resume_mismatch": True}, contradiction=True)
    page_count = 0
    for cell, stack in zip(state.cells[cursor:], state.stacks[cursor:]):
        if page_count >= work.output_limit or not work.visit():
            work.hit = True
            break
        top = stack[-1] if stack else None
        if top is not None and top.color_ref is None:
            unknown.append(top.occurrence_ref)
        visible.append({"cell_ref": cell.cell_ref, "rectangle": (cell.left, cell.top, cell.right, cell.bottom),
            "top_occurrence_ref": top.occurrence_ref if top else None,
            "scored_color_ref": top.color_ref if top else None,
            "empty_background": top is None,
            "control_outline_occurrence_ref": state.physical_selection_ref
                if top and top.occurrence_ref == state.physical_selection_ref else None})
        hidden.extend(o.occurrence_ref for o in stack[:-1])
        cursor += 1
        page_count += 1
    residual = tuple(d.cell_ref for d in request.demands if not any(
        v["cell_ref"] == d.cell_ref and v["scored_color_ref"] == d.color_ref for v in visible))
    return _result(request, work, {"visible_rectangles": tuple(visible), "hidden_identity_refs": tuple(hidden),
        "target_residual_cell_refs": residual, "unknown_lower_inventory_inferred": False}, unknown=unknown,
        pending=len(state.cells) - cursor, frontier={"next_cell": cursor,
            "visible_rectangles": tuple(visible), "unknown_color_refs": tuple(unknown),
            "hidden_identity_refs": tuple(hidden)})


def enumerate_metric_target_domain(request: MetricStackRequest) -> MetricStackCalculation:
    work = _Work(request)
    state, target = request.state, request.target
    width, height = len(target.rows[0]), len(target.rows)
    choices = tuple((scale, anchor) for scale in target.licensed_scales for anchor in target.licensed_anchors)
    start = int(request.resume_frontier.get("cursor", 0))
    if request.resume_frontier and request.resume_frontier.get("packet_fingerprint") != metric_packet_fingerprint(request):
        return _result(request, work, {"resume_mismatch": True}, contradiction=True)
    candidates = []
    cursor = start
    for index in range(start, len(choices)):
        if len(candidates) >= work.output_limit or not work.visit():
            work.hit = True
            break
        (n, d), (ax, ay) = choices[index]
        scale = Fraction(n, d)
        bx, by = Fraction(ax) + width * scale, Fraction(ay) + height * scale
        requirements = []
        valid = True
        covered_area = Fraction(0)
        for cell in state.cells:
            if not work.visit():
                valid = False
                break
            left, top, right, bottom = map(Fraction, (cell.left, cell.top, cell.right, cell.bottom))
            overlap = max(left, ax) < min(right, bx) and max(top, ay) < min(bottom, by)
            if overlap and not (left >= ax and top >= ay and right <= bx and bottom <= by):
                valid = False
                break
            colors = set()
            if overlap:
                # Exact rational cuts, never approximate nearest-pixel sampling.
                for y in range(height):
                    if not work.visit():
                        valid = False
                        break
                    if max(top, ay + y * scale) >= min(bottom, ay + (y + 1) * scale):
                        continue
                    for x in range(width):
                        if not work.visit():
                            valid = False
                            break
                        if max(left, ax + x * scale) < min(right, ax + (x + 1) * scale):
                            colors.add(target.rows[y][x])
                    if work.hit:
                        break
                if work.hit:
                    break
                covered_area += (right - left) * (bottom - top)
            else:
                colors.add(target.outside_color_ref)
            if len(colors) != 1:
                valid = False
                break
            requirements.append((cell.cell_ref, next(iter(colors))))
        if work.hit:
            break
        if valid and covered_area == width * height * scale * scale:
            candidates.append({"scale": (n, d), "anchor": (ax, ay), "requirements": tuple(requirements),
                "inventory_available": None, "transport_accessible": None})
        cursor = index + 1
    return _result(request, work, {"candidates": tuple(candidates), "internal_background_preserved": True},
        pending=len(choices) - cursor, domain_size=len(choices) if start == 0 else None,
        domain_examined=cursor - start,
        frontier={"cursor": cursor, "packet_fingerprint": metric_packet_fingerprint(request)})


def assign_metric_occurrences(request: MetricStackRequest) -> MetricStackCalculation:
    work = _Work(request)
    state = request.state
    occurrences = tuple((o, cell.cell_ref, depth, len(stack) - depth - 1)
        for cell, stack in zip(state.cells, state.stacks) for depth, o in enumerate(stack))
    domains = tuple(tuple(i for i, (o, *_rest) in enumerate(occurrences) if o.color_ref == d.color_ref)
        for d in request.demands)
    # Exhaustive injective DFS with explicit retained branch stack, no greedy
    # provider choice. Unknown hidden providers stay outside the known domain.
    queue = [tuple()]
    if request.resume_frontier:
        if request.resume_frontier.get("packet_fingerprint") != metric_packet_fingerprint(request):
            return _result(request, work, {"resume_mismatch": True}, contradiction=True)
        queue = [tuple(x) for x in request.resume_frontier.get("pending_assignments", ())]
        if len(queue) > 8192 or any(len(row) > len(domains) or len(set(row)) != len(row)
                or any(type(p) is not int or p not in domains[i] for i, p in enumerate(row)) for row in queue):
            raise ValueError("invalid bounded injective assignment resume frontier")
    candidates = []
    while queue:
        if len(candidates) >= work.output_limit or not work.visit():
            work.hit = True
            break
        assignment = queue.pop()
        if len(assignment) == len(domains):
            candidates.append(tuple({"target_cell_ref": request.demands[i].cell_ref,
                "occurrence_ref": occurrences[p][0].occurrence_ref,
                "source_cell_ref": occurrences[p][1], "covers_to_remove": occurrences[p][3]}
                for i, p in enumerate(assignment)))
        else:
            for provider in reversed(domains[len(assignment)]):
                if provider not in assignment:
                    queue.append((*assignment, provider))
    unknown = tuple(o.occurrence_ref for o, *_rest in occurrences if o.color_ref is None)
    if state.inventory_complete_evidence_ref is None:
        unknown = (*unknown, "unknown_hidden_inventory")
    # A full maximum matching gives the deficit within known compatible
    # providers; it never establishes a total-inventory deficit.
    owner = {}
    def augment(index, seen):
        for provider in domains[index]:
            if not work.visit():
                return False
            if provider in seen:
                continue
            seen.add(provider)
            if provider not in owner or augment(owner[provider], seen):
                owner[provider] = index
                return True
        return False
    matched = sum(augment(i, set()) for i in range(len(domains)))
    return _result(request, work, {"candidates": tuple(candidates), "compatible_provider_domains": domains,
        "known_inventory_deficit": len(domains) - matched if not work.hit else None,
        "total_inventory_deficit": len(domains) - matched if not unknown and not work.hit else None,
        "interchangeable_providers_retained": True,
        "surplus_occurrence_refs": tuple(o.occurrence_ref for o, *_rest in occurrences
            if all(o.color_ref != demand.color_ref for demand in request.demands))},
        unknown=unknown, pending=len(queue),
        frontier={"pending_assignments": tuple(queue), "packet_fingerprint": metric_packet_fingerprint(request)})


def derive_metric_exposure_dependencies(request: MetricStackRequest) -> MetricStackCalculation:
    work = _Work(request)
    state = request.state
    retained = request.resume_frontier.get("exposure", {})
    if not isinstance(retained, Mapping):
        return _result(request, work, {"resume_mismatch": True}, contradiction=True)
    phase = retained.get("phase", "INVENTORY")
    cell_cursor = retained.get("cell_cursor", 0)
    depth_cursor = retained.get("depth_cursor", 0)
    required_cursor = retained.get("next_required_occurrence", 0)
    cover_cursor = retained.get("cover_cursor", 0)
    placement_cursor = retained.get("placement_cursor", 0)
    required_started = retained.get("required_started", False)
    locations = dict(retained.get("locations", {}))
    dependencies = list(retained.get("and_or_dependencies", ()))
    buffers = list(retained.get("buffer_reservations", ()))
    unknown = list(retained.get("unknown_refs", ()))
    cycles = list(retained.get("cycle_node_refs", ()))
    cycle_cursor = retained.get("cycle_cursor", 0)
    cycle_started = retained.get("cycle_started", False)
    cycle_pending = list(retained.get("cycle_pending", ()))
    cycle_seen = set(retained.get("cycle_seen", ()))
    buffer_cursor = retained.get("buffer_cursor", 0)
    invalid_buffers = list(retained.get("invalid_buffer_refs", ()))
    required = tuple(dict.fromkeys((*request.needed_occurrence_refs,
        *(p.occurrence_ref for p in request.placements))))
    cursors = (cell_cursor, depth_cursor, required_cursor, cover_cursor,
        placement_cursor, cycle_cursor, buffer_cursor)
    if (work.invalid_resume or phase not in {"INVENTORY", "DEPENDENCIES", "CYCLES", "BUFFERS", "COMPLETE"}
            or any(type(x) is not int or x < 0 for x in cursors)
            or cell_cursor > len(state.cells) or required_cursor > len(required)
            or placement_cursor > len(request.placements) or buffer_cursor > len(request.buffer_cell_refs)
            or type(required_started) is not bool or type(cycle_started) is not bool):
        return _result(request, work, {"resume_mismatch": True}, contradiction=True)
    # Inventory acquisition is counted too; empty cells have their own visit.
    while phase == "INVENTORY" and cell_cursor < len(state.cells):
        stack = state.stacks[cell_cursor]
        if depth_cursor > len(stack):
            return _result(request, work, {"resume_mismatch": True}, contradiction=True)
        if not work.visit():
            break
        if depth_cursor < len(stack):
            locations[stack[depth_cursor].occurrence_ref] = (cell_cursor, depth_cursor)
            depth_cursor += 1
        else:
            cell_cursor += 1
            depth_cursor = 0
    if phase == "INVENTORY" and cell_cursor == len(state.cells):
        phase = "DEPENDENCIES"
    while phase == "DEPENDENCIES" and required_cursor < len(required):
        ref = required[required_cursor]
        if not required_started:
            if not work.visit():
                break
            if ref not in locations:
                unknown.append(ref)
                required_cursor += 1
                continue
            required_started = True
        source_index, depth = locations[ref]
        cell_ref = state.cells[source_index].cell_ref
        above = tuple(o.occurrence_ref for o in reversed(state.stacks[source_index][depth + 1:]))
        if cover_cursor > len(above):
            return _result(request, work, {"resume_mismatch": True}, contradiction=True)
        while cover_cursor < len(above):
            if not work.visit():
                break
            cover = above[cover_cursor]
            dependencies.append({"kind": "AND", "consumer": "expose:" + ref,
                "need": "remove:" + cover, "source_cell_ref": cell_ref})
            if cover_cursor:
                dependencies.append({"kind": "AND", "consumer": "remove:" + cover,
                    "need": "remove:" + above[cover_cursor - 1]})
            buffers.append({"occurrence_ref": cover, "provider_kind": "OR",
                "licensed_buffer_cell_refs": tuple(x for x in request.buffer_cell_refs if x != cell_ref),
                "restoration_required": True})
            cover_cursor += 1
        if work.hit:
            break
        while placement_cursor < len(request.placements):
            if not work.visit():
                break
            placement = request.placements[placement_cursor]
            if placement.target_cell_ref == cell_ref and placement.occurrence_ref != ref:
                dependencies.append({"kind": "AND", "consumer": "close:" + cell_ref,
                    "need": "extract:" + ref})
            placement_cursor += 1
        if work.hit:
            break
        required_cursor += 1
        cover_cursor = placement_cursor = 0
        required_started = False
    if phase == "DEPENDENCIES" and required_cursor == len(required):
        phase = "CYCLES"
    edges = {(d["consumer"], d["need"]) for d in dependencies}
    nodes = sorted({ref for edge in edges for ref in edge})
    if cycle_cursor > len(nodes):
        return _result(request, work, {"resume_mismatch": True}, contradiction=True)
    while phase == "CYCLES" and cycle_cursor < len(nodes):
        node = nodes[cycle_cursor]
        if not cycle_started:
            cycle_pending = [b for a, b in sorted(edges) if a == node]
            cycle_seen = set()
            cycle_started = True
        while cycle_pending:
            if not work.visit():
                break
            current = cycle_pending.pop()
            if current == node:
                cycles.append(node)
                cycle_pending.clear()
                break
            if current not in cycle_seen:
                cycle_seen.add(current)
                cycle_pending.extend(b for a, b in sorted(edges) if a == current)
        if work.hit:
            break
        cycle_cursor += 1
        cycle_started = False
    if phase == "CYCLES" and cycle_cursor == len(nodes):
        phase = "BUFFERS"
    cell_refs = {c.cell_ref for c in state.cells}
    while phase == "BUFFERS" and buffer_cursor < len(request.buffer_cell_refs):
        if not work.visit():
            break
        ref = request.buffer_cell_refs[buffer_cursor]
        if ref not in cell_refs:
            invalid_buffers.append(ref)
        buffer_cursor += 1
    if phase == "BUFFERS" and buffer_cursor == len(request.buffer_cell_refs):
        phase = "COMPLETE"
    frontier = {"phase": phase, "cell_cursor": cell_cursor, "depth_cursor": depth_cursor,
        "locations": locations, "next_required_occurrence": required_cursor,
        "required_started": required_started, "cover_cursor": cover_cursor,
        "placement_cursor": placement_cursor, "and_or_dependencies": tuple(dependencies),
        "buffer_reservations": tuple(buffers), "unknown_refs": tuple(unknown),
        "cycle_node_refs": tuple(cycles), "cycle_cursor": cycle_cursor,
        "cycle_started": cycle_started, "cycle_pending": tuple(cycle_pending),
        "cycle_seen": tuple(sorted(cycle_seen)), "buffer_cursor": buffer_cursor,
        "invalid_buffer_refs": tuple(invalid_buffers)}
    return _result(request, work, {"and_or_dependencies": tuple(dependencies),
        "buffer_reservations": tuple(buffers), "cycle_node_refs": tuple(cycles),
        "invalid_buffer_refs": tuple(invalid_buffers), "invented_size_order": False,
        "dependency_phase": phase}, unknown=(*unknown, *invalid_buffers),
        pending=0 if phase == "COMPLETE" else max(1, len(required) - required_cursor),
        frontier={"exposure": frontier})


def _adjacent(a, b):
    return ((a.right == b.left or b.right == a.left) and max(a.top, b.top) < min(a.bottom, b.bottom)) or (
        (a.bottom == b.top or b.bottom == a.top) and max(a.left, b.left) < min(a.right, b.right))


def _stack_transition(state, law, primitive):
    cells = {c.cell_ref: i for i, c in enumerate(state.cells)}
    stacks = [list(stack) for stack in state.stacks]
    physical_selection = state.physical_selection_ref
    effects, cost, refusal = [], 0, None
    if primitive.kind == "SELECT":
        index = cells.get(primitive.cell_ref)
        if index is None or not stacks[index] or stacks[index][-1].occurrence_ref != primitive.occurrence_ref:
            refusal = "selection_requires_the_current_named_top"
        else:
            physical_selection = primitive.occurrence_ref
            cost = law.select_cost
            effects.append(("selection", physical_selection))
    elif primitive.kind == "CYCLE":
        if law.access != "CYCLE_TOPS" or not law.cycle_order or any(ref not in cells for ref in law.cycle_order):
            refusal = "missing_or_incompatible_selection_cycle"
        else:
            tops = [stacks[cells[ref]][-1].occurrence_ref for ref in law.cycle_order if stacks[cells[ref]]]
            if tops:
                physical_selection = tops[(tops.index(physical_selection) + 1) % len(tops)] if physical_selection in tops else tops[0]
                cost = law.cycle_cost
                effects.append(("selection", physical_selection))
            else:
                refusal = "no_selectable_top"
    elif primitive.kind == "TRANSFER":
        source = next((i for i, stack in enumerate(stacks) if stack and stack[-1].occurrence_ref == physical_selection), None)
        destination = cells.get(primitive.destination_ref)
        if source is None or physical_selection != primitive.occurrence_ref:
            refusal = "transfer_requires_the_selected_accessible_top"
        elif destination is None or source == destination:
            refusal = "incompatible_destination"
        elif (state.cells[source].cell_ref, primitive.destination_ref) not in law.transfer_edges:
            refusal = "transfer_edge_is_not_licensed"
        elif not _adjacent(state.cells[source], state.cells[destination]):
            refusal = "declared_edge_is_not_metric_adjacent"
        else:
            occurrence = stacks[source].pop()
            stacks[destination].append(occurrence)
            cost = law.transfer_cost
            effects.extend((("top_pop", occurrence.occurrence_ref), ("adjacent_push", primitive.destination_ref),
                ("support_rectangle", state.cells[destination].model_dump(mode="json"))))
    else:
        refusal = "reset_requires_the_independent_restoration_contract"
    successor = state.model_copy(update={"stacks": tuple(tuple(stack) for stack in stacks),
        "physical_selection_ref": physical_selection})
    return successor, tuple(effects), cost, refusal


def _acceptance(state, request, primitive):
    law = request.law
    if law.acceptance_checkpoint is None:
        return {"checked": False, "unknown_law": True, "terminal": None}
    check = law.acceptance_checkpoint == "AFTER_EACH_INPUT" or primitive.kind == "TRANSFER"
    if not check:
        return {"checked": False, "unknown_law": False, "terminal": None}
    if not request.demands or {d.cell_ref for d in request.demands} != {c.cell_ref for c in state.cells}:
        return {"checked": False, "unknown_law": True, "terminal": None}
    tops = {cell.cell_ref: stack[-1].color_ref if stack else law.empty_color_ref
        for cell, stack in zip(state.cells, state.stacks)}
    if any(ref not in tops for ref in (d.cell_ref for d in request.demands)):
        return {"checked": False, "unknown_law": True, "terminal": None}
    known_mismatch = any(tops[d.cell_ref] is not None and tops[d.cell_ref] != d.color_ref
        for d in request.demands)
    unknown = tuple(d.cell_ref for d in request.demands if tops[d.cell_ref] is None)
    if unknown and not known_mismatch:
        return {"checked": False, "unknown_law": True, "terminal": None,
            "unknown_color_cell_refs": unknown}
    return {"checked": True, "unknown_law": False,
        "terminal": not known_mismatch,
        "scope": "declared_exact_cell_requirements"}


def calculate_metric_stack_step(request: MetricStackRequest) -> MetricStackCalculation:
    work = _Work(request)
    if not work.visit():
        return _result(request, work, {}, pending=1)
    successor, effects, cost, refusal = _stack_transition(request.state, request.law, request.primitive)
    before_hidden = {o.occurrence_ref for stack in request.state.stacks for o in stack[:-1]}
    after_hidden = {o.occurrence_ref for stack in successor.stacks for o in stack[:-1]}
    acceptance = _acceptance(successor, request, request.primitive)
    return _result(request, work, {"successor": successor.model_dump(mode="json"), "effects": effects,
        "refusal": refusal, "cost": cost, "acceptance": acceptance,
        "newly_hidden_refs": tuple(sorted(after_hidden - before_hidden)),
        "newly_revealed_refs": tuple(sorted(before_hidden - after_hidden)),
        "underlying_identities_preserved": True},
        unknown=("acceptance_checkpoint_or_target_requirements",) if acceptance["unknown_law"] else ())


def compare_sealed_metric_stacks(request: MetricStackRequest) -> MetricStackCalculation:
    work = _Work(request)
    retained = request.resume_frontier
    comparisons = list(retained.get("comparisons", ()))
    first = retained.get("first_divergence")
    samples = sorted(request.sealed_samples, key=lambda x: (x.primitive_index, x.sample_ref))
    cursor = retained.get("next_sample", 0)
    if (work.invalid_resume or type(cursor) is not int or not 0 <= cursor <= len(samples)
            or len(comparisons) != cursor
            or (first is not None and not isinstance(first, Mapping))):
        return _result(request, work, {"resume_mismatch": True}, contradiction=True)
    page_count = 0
    for sample in samples[cursor:]:
        if page_count >= work.output_limit or not work.visit():
            work.hit = True
            break
        expected, observed = sample.expected, sample.observed
        dimensions = []
        if expected.cells != observed.cells or expected.grid_revision_ref != observed.grid_revision_ref:
            dimensions.append("metric_support")
        if expected.physical_selection_ref != observed.physical_selection_ref:
            dimensions.append("selection")
        if expected.stacks != observed.stacks:
            dimensions.append("stack_identity_color_order")
        entry = {"sample_ref": sample.sample_ref, "primitive_index": sample.primitive_index,
            "mismatch_dimensions": tuple(dimensions),
            "terminal_receipt_ref": sample.authoritative_terminal_receipt_ref}
        comparisons.append(entry)
        if dimensions and first is None:
            first = entry
        cursor += 1
        page_count += 1
    return _result(request, work, {"sealed_packet_ref": request.sealed_packet_ref,
        "comparisons": tuple(comparisons), "first_divergence": first,
        "repair_dependency_dimensions": first["mismatch_dimensions"] if first else (),
        "canonical_mutation": False, "physical_rollback": False},
        pending=len(samples) - cursor, frontier={"next_sample": cursor,
            "first_divergence": first, "comparisons": tuple(comparisons)})


def _uniform_metric_requirements(state, target, scale_pair, anchor, work):
    """Exact rational raster geometry for one explicitly licensed transform."""
    n, d = scale_pair
    ax, ay = anchor
    scale = Fraction(n, d)
    width, height = len(target.rows[0]), len(target.rows)
    bx, by = Fraction(ax) + width * scale, Fraction(ay) + height * scale
    requirements, covered_area = [], Fraction(0)
    for cell in state.cells:
        if not work.visit():
            return None
        left, top, right, bottom = map(Fraction, (cell.left, cell.top, cell.right, cell.bottom))
        overlap = max(left, ax) < min(right, bx) and max(top, ay) < min(bottom, by)
        colors = set()
        if overlap:
            if not (left >= ax and top >= ay and right <= bx and bottom <= by):
                colors.add(target.outside_color_ref)
            for y in range(height):
                if not work.visit():
                    return None
                if max(top, ay + y * scale) >= min(bottom, ay + (y + 1) * scale):
                    continue
                for x in range(width):
                    if not work.visit():
                        return None
                    if max(left, ax + x * scale) < min(right, ax + (x + 1) * scale):
                        colors.add(target.rows[y][x])
            covered_area += (min(right, bx) - max(left, ax)) * (min(bottom, by) - max(top, ay))
        else:
            colors.add(target.outside_color_ref)
        if len(colors) != 1:
            return None
        requirements.append((cell.cell_ref, next(iter(colors))))
    return tuple(requirements) if covered_area == width * height * scale * scale else None


def _uniform_metric_acceptance(state, request, work):
    if request.target is None:
        return {"checked": False, "terminal": None, "missing": ("metric_target",)}
    tops = {cell.cell_ref: stack[-1].color_ref if stack else request.law.empty_color_ref
        for cell, stack in zip(state.cells, state.stacks)}
    undecided = False
    examined = 0
    target = request.target
    for scale in target.licensed_scales:
        for anchor in target.licensed_anchors:
            if not work.visit():
                return {"checked": False, "terminal": None, "examined_transforms": examined,
                    "missing": ("bounded_uniform_target_comparison",)}
            requirements = _uniform_metric_requirements(state, target, scale, anchor, work)
            if work.hit:
                return {"checked": False, "terminal": None, "examined_transforms": examined,
                    "missing": ("bounded_uniform_target_comparison",)}
            examined += 1
            if requirements is None:
                continue
            known_mismatch = any(tops[ref] is not None and tops[ref] != color for ref, color in requirements)
            if known_mismatch:
                continue
            if any(tops[ref] is None for ref, _ in requirements):
                undecided = True
                continue
            return {"checked": True, "terminal": True, "scale": scale, "anchor": anchor,
                "scope": "exact_uniform_transform_of_declared_target", "examined_transforms": examined}
    complete = request.target_domain_complete_evidence_ref in request.evidence_refs
    if undecided or not complete:
        return {"checked": False, "terminal": None, "examined_transforms": examined,
            "missing": ("unknown_visible_color",) if undecided else ("target_domain_completeness",)}
    return {"checked": True, "terminal": False, "examined_transforms": examined,
        "scope": "all_declared_uniform_transforms"}


def calculate_metric_external_primitive(request: MetricStackRequest) -> MetricStackCalculation:
    """One owned primitive, immutable direct/automatic/cost/acceptance ledger."""
    work = _Work(request)
    ownership, state, law, primitive = request.external_ownership, request.state, request.law, request.primitive
    missing = []
    if ownership is None or state is None or law is None or primitive is None:
        return _result(request, work, {}, unknown=("native_external_inputs",), pending=1)
    if (ownership.contract_ref not in request.evidence_refs
            or ownership.automatic_identity_evidence_ref not in request.evidence_refs
            or ownership.event_owner_ref != law.event_owner_ref
            or ownership.primitive_ref != primitive.primitive_ref):
        return _result(request, work, {"ownership_mismatch": True}, contradiction=True)
    if ownership.budget_zero_terminates and ownership.budget_remaining == 0 and not ownership.pre_terminal:
        return _result(request, work, {"current_budget_terminal_contradiction": True}, contradiction=True)
    if request.resume_frontier:
        # STEP is atomic within its declared calculation bound. A retained
        # partial ledger does not authorize repeating direct effects or debit.
        return _result(request, work, {"atomic_step_reentry_refused": True},
            unknown=("new_source_qualified_atomic_step_scope",), pending=1)
    if not work.visit():
        return _result(request, work, {}, pending=1)
    if ownership.pre_terminal:
        return _result(request, work, {"successor": state.model_dump(mode="json"),
            "budget_remaining": ownership.budget_remaining, "cost": 0,
            "external_event_ledger": (), "termination": "preexisting_model_terminal",
            "closure_complete": True, "command_applied": False})
    if ownership.charged_cost > ownership.budget_remaining:
        return _result(request, work, {"command_applied": False},
            unknown=("input_cost_exceeds_current_budget",), pending=1)
    if primitive.kind == "RESET":
        if (request.declared_restoration is None or request.restoration_contract_ref is None
                or request.restoration_contract_ref not in request.evidence_refs):
            return _result(request, work, {"command_applied": False},
                unknown=("independent_reset_restoration",), pending=1)
        successor = request.declared_restoration
        effects = (("independent_reset", request.restoration_contract_ref),)
        refusal = None
    else:
        successor, effects, _, refusal = _stack_transition(state, law, primitive)
        declared_cost = {"SELECT": law.select_cost, "CYCLE": law.cycle_cost,
            "TRANSFER": law.transfer_cost}[primitive.kind]
        if ownership.charged_cost != declared_cost:
            return _result(request, work, {"cost_law_mismatch": True}, contradiction=True)
    budget_after = ownership.budget_remaining - ownership.charged_cost
    def snapshot(current, budget):
        return {"state": current.model_dump(mode="json"), "budget_remaining": budget}
    before, after_direct = snapshot(state, ownership.budget_remaining), snapshot(successor, ownership.budget_remaining)
    ledger = [{"phase": "DIRECT", "event_ref": primitive.primitive_ref + ":direct",
        "owner_ref": ownership.event_owner_ref, "before": before, "after": after_direct,
        "effects": effects, "refusal": refusal},
        {"phase": "AUTOMATIC", "event_ref": primitive.primitive_ref + ":automatic",
        "owner_ref": ownership.event_owner_ref, "before": after_direct, "after": after_direct,
        "identity_law_evidence_ref": ownership.automatic_identity_evidence_ref}]
    check_acceptance = (law.acceptance_checkpoint == "AFTER_EACH_INPUT"
        or law.acceptance_checkpoint == "AFTER_TRANSFER" and primitive.kind == "TRANSFER")
    if law.acceptance_checkpoint is None:
        missing.append("acceptance_checkpoint")
        acceptance = {"checked": False, "terminal": None}
    elif check_acceptance:
        acceptance = _uniform_metric_acceptance(successor, request, work)
        missing.extend(acceptance.get("missing", ()))
    else:
        acceptance = {"checked": False, "terminal": None, "skipped_by_declared_checkpoint": True}
    cost_entry = {"phase": "COST", "event_ref": primitive.primitive_ref + ":cost",
        "owner_ref": ownership.event_owner_ref, "before": after_direct,
        "after": snapshot(successor, budget_after), "debit": ownership.charged_cost}
    acceptance_budget = budget_after if ownership.cost_acceptance_order == "COST_THEN_ACCEPTANCE" else ownership.budget_remaining
    acceptance_snapshot = snapshot(successor, acceptance_budget)
    acceptance_entry = {"phase": "ACCEPTANCE", "event_ref": primitive.primitive_ref + ":acceptance",
        "owner_ref": ownership.event_owner_ref, "before": acceptance_snapshot,
        "after": acceptance_snapshot, "comparison": acceptance}
    if ownership.cost_acceptance_order == "COST_THEN_ACCEPTANCE":
        ledger.extend((cost_entry, acceptance_entry))
    else:
        ledger.extend((acceptance_entry, cost_entry))
    accepted = acceptance.get("terminal") is True
    depleted = ownership.budget_zero_terminates and budget_after == 0
    termination = ("accepted_target" if accepted and (not depleted or ownership.acceptance_precedes_budget_terminal)
        else "budget_terminal" if depleted else "accepted_target" if accepted else None)
    projection = tuple({"cell_ref": cell.cell_ref, "support": (cell.left, cell.top, cell.right, cell.bottom),
        "top_occurrence_ref": stack[-1].occurrence_ref if stack else None,
        "scored_color_ref": stack[-1].color_ref if stack else law.empty_color_ref}
        for cell, stack in zip(successor.cells, successor.stacks))
    return _result(request, work, {"successor": successor.model_dump(mode="json"),
        "budget_remaining": budget_after, "cost": ownership.charged_cost,
        "external_event_ledger": tuple(ledger), "visible_projection": projection,
        "acceptance": acceptance, "termination": termination, "refusal": refusal,
        "closure_complete": not missing and not work.hit,
        "direct_automatic_cost_acceptance_owner_ref": ownership.event_owner_ref,
        "additional_k03_phase_or_debit_allowed": False,
        "official_win_attested": False}, unknown=tuple(missing),
        pending=1 if missing or work.hit else 0,
        frontier={"atomic_step_completed": not missing and not work.hit,
            "external_event_ledger": tuple(ledger)})


def _metric_transfer_distances(request, work):
    cells = {c.cell_ref: c for c in request.state.cells}
    edges = {ref: [] for ref in cells}
    if "TRANSFER" in request.execution_primitive_kinds:
        for source, destination in request.law.transfer_edges:
            if not work.visit():
                return None
            if source in cells and destination in cells and _adjacent(cells[source], cells[destination]):
                edges[source].append(destination)
    distances = {}
    for source in cells:
        found, queue = {source: 0}, deque((source,))
        while queue:
            if not work.visit():
                return None
            current = queue.popleft()
            for destination in edges[current]:
                if not work.visit():
                    return None
                if destination not in found:
                    found[destination] = found[current] + 1
                    queue.append(destination)
        distances[source] = found
    return distances


def _metric_assignment_bound(request, requirements, occurrences, assignment, distances, work):
    mandatory, moved, transfer_count = set(), set(), 0
    for (cell_ref, _), provider in zip(requirements, assignment):
        if not work.visit():
            return None
        if provider == -1:
            stack = request.state.stacks[next(i for i, c in enumerate(request.state.cells) if c.cell_ref == cell_ref)]
            for occurrence in stack:
                if not work.visit():
                    return None
                mandatory.add(occurrence.occurrence_ref)
            continue
        occurrence, source, depth, stack = occurrences[provider]
        distance = distances[source].get(cell_ref)
        if distance is None:
            return None
        transfer_count += distance
        if distance:
            moved.add(occurrence.occurrence_ref)
        # A buried chosen top must be exposed even if it stays at its cell.
        for cover in stack[depth + 1:]:
            if not work.visit():
                return None
            mandatory.add(cover.occurrence_ref)
    mandatory.update(moved)
    # Cover/clearing movements counted here are disjoint from providers whose
    # shortest transfer distance was already charged. No double exposure debit.
    transfer_count += len(mandatory - moved)
    selection_costs = []
    if "SELECT" in request.execution_primitive_kinds:
        selection_costs.append(request.law.select_cost)
    if "CYCLE" in request.execution_primitive_kinds and request.law.access == "CYCLE_TOPS":
        selection_costs.append(request.law.cycle_cost)
    changes = max(0, len(mandatory) - int(request.state.physical_selection_ref in mandatory))
    if changes and not selection_costs:
        return None
    return transfer_count * request.law.transfer_cost + changes * min(selection_costs, default=0)


def _metric_witness_cost(request, work):
    ownership = request.external_ownership
    if ownership is None:
        return {"status": "UNVERIFIED_OWNERSHIP", "cost": None}
    if (ownership.contract_ref not in request.evidence_refs
            or ownership.automatic_identity_evidence_ref not in request.evidence_refs
            or ownership.event_owner_ref != request.law.event_owner_ref
            or ownership.pre_terminal or request.law.acceptance_checkpoint is None):
        return {"status": "INVALID_CURRENT_PHASE_CONTRACT", "cost": None}
    state, budget, cost = request.state, ownership.budget_remaining, 0
    # A matching pre-image is not an already checked acceptance checkpoint.
    # Only an actual modeled input can establish this nonterminal witness.
    for index, primitive in enumerate(request.witness_primitives):
        if primitive.kind not in request.execution_primitive_kinds or not work.visit():
            return {"status": "UNRESOLVED_OR_OUTSIDE_EXECUTION_SCOPE", "cost": None}
        state, _, debit, refusal = _stack_transition(state, request.law, primitive)
        if refusal or debit > budget:
            return {"status": "INVALID_MODEL_WITNESS", "cost": None, "primitive_index": index, "refusal": refusal}
        cost += debit
        budget -= debit
        checkpoint = (request.law.acceptance_checkpoint == "AFTER_EACH_INPUT"
            or request.law.acceptance_checkpoint == "AFTER_TRANSFER" and primitive.kind == "TRANSFER")
        acceptance = _uniform_metric_acceptance(state, request, work) if checkpoint else {"terminal": None}
        depleted = ownership.budget_zero_terminates and budget == 0
        if acceptance.get("terminal") is True and (not depleted or ownership.acceptance_precedes_budget_terminal):
            return {"status": "REALIZABLE_MODEL_WITNESS", "cost": cost, "consumed_primitives": index + 1,
                "trailing_primitives_not_executed": len(request.witness_primitives) - index - 1}
        if work.hit or acceptance.get("missing"):
            return {"status": "UNRESOLVED_WITNESS_ACCEPTANCE", "cost": None}
        if depleted:
            return {"status": "BUDGET_TERMINATED_BEFORE_GOAL", "cost": None}
    return {"status": "WITNESS_DID_NOT_ESTABLISH_GOAL", "cost": None}


def calculate_metric_transport_lower_bound(request: MetricStackRequest) -> MetricStackCalculation:
    """Omniscient execution relaxation, not a cost of learning the model."""
    work = _Work(request)
    facts = measure_metric_stack_request(request).facts
    if not facts.get("bound_execution_scope_current"):
        return _result(request, work, {}, unknown=("current_no_reset_execution_domain",), pending=1)
    if request.state is None or request.law is None or request.target is None:
        return _result(request, work, {}, unknown=("bound_state_law_and_target",), pending=1)
    if not facts.get("bound_inventory_current") or not facts.get("bound_target_domain_current"):
        return _result(request, work, {}, unknown=("complete_current_inventory_and_target_domain",), pending=1)
    retained = request.resume_frontier
    targets = list(retained.get("targets", ()))
    distances = retained.get("distances")
    best = retained.get("best_cost")
    best_assignment = retained.get("best_assignment", ())
    target_cursor = retained.get("target_cursor", 0)
    examined = retained.get("assignments_examined", 0)
    frames = [dict(x) for x in retained.get("frames", ())]
    domains = [list(row) for row in retained.get("current_domains", ())]
    provider_cursor = retained.get("provider_cursor", 0)
    domain_cursor = retained.get("domain_cursor", 0)
    if work.invalid_resume or (retained and retained.get("phase") != "ASSIGNMENTS"):
        return _result(request, work, {"resume_mismatch": True}, contradiction=True)
    if not retained:
        for scale in request.target.licensed_scales:
            for anchor in request.target.licensed_anchors:
                if not work.visit():
                    return _result(request, work, {"licensed_lower_bound": 0, "minimum_proved": False},
                        pending=1, frontier={"phase": "TARGET_DOMAIN_INCOMPLETE", "targets": tuple(targets)})
                requirements = _uniform_metric_requirements(request.state, request.target, scale, anchor, work)
                if work.hit:
                    return _result(request, work, {"licensed_lower_bound": 0, "minimum_proved": False},
                        pending=1, frontier={"phase": "TARGET_DOMAIN_INCOMPLETE", "targets": tuple(targets)})
                if requirements is not None:
                    targets.append({"scale": scale, "anchor": anchor, "requirements": requirements})
        distances = _metric_transfer_distances(request, work)
        if distances is None:
            return _result(request, work, {"licensed_lower_bound": 0, "minimum_proved": False},
                pending=1, frontier={"phase": "DISTANCES_INCOMPLETE", "targets": tuple(targets)})
    if (type(target_cursor) is not int or not 0 <= target_cursor <= len(targets)
            or type(examined) is not int or examined < 0 or not isinstance(distances, Mapping)
            or best is not None and (type(best) is not int or best < 0)):
        return _result(request, work, {"resume_mismatch": True}, contradiction=True)
    occurrences = tuple((o, cell.cell_ref, depth, stack)
        for cell, stack in zip(request.state.cells, request.state.stacks) for depth, o in enumerate(stack))
    returned = 0
    while target_cursor < len(targets):
        requirements = targets[target_cursor]["requirements"]
        if (type(provider_cursor) is not int or not 0 <= provider_cursor <= len(occurrences)
                or type(domain_cursor) is not int or not 0 <= domain_cursor <= len(requirements)
                or len(domains) not in {domain_cursor, min(domain_cursor + 1, len(requirements))}):
            return _result(request, work, {"resume_mismatch": True}, contradiction=True)
        while domain_cursor < len(requirements):
            if len(domains) == domain_cursor:
                domains.append([])
            ref, color = requirements[domain_cursor]
            while provider_cursor < len(occurrences):
                if not work.visit():
                    break
                occurrence, source, _, _ = occurrences[provider_cursor]
                if occurrence.color_ref == color and ref in distances[source]:
                    domains[-1].append(provider_cursor)
                provider_cursor += 1
            if work.hit:
                break
            if color == request.law.empty_color_ref:
                domains[-1].append(-1)
            provider_cursor = 0
            domain_cursor += 1
        if work.hit:
            break
        if not frames:
            frames = [{"assignment": (), "next_provider": 0}]
        while frames:
            if returned >= work.output_limit or not work.visit():
                work.hit = True
                break
            frame = frames[-1]
            assignment = tuple(frame["assignment"])
            if len(assignment) == len(domains):
                candidate = _metric_assignment_bound(request, requirements, occurrences, assignment, distances, work)
                if work.hit:
                    break
                if candidate is not None and (best is None or candidate < best):
                    best, best_assignment = candidate, tuple(assignment)
                frames.pop()
                examined += 1
                returned += 1
                continue
            depth = len(assignment)
            cursor = frame["next_provider"]
            if type(cursor) is not int or not 0 <= cursor <= len(domains[depth]):
                return _result(request, work, {"resume_mismatch": True}, contradiction=True)
            if cursor == len(domains[depth]):
                frames.pop()
                continue
            provider = domains[depth][cursor]
            frame["next_provider"] = cursor + 1
            if provider == -1 or provider not in assignment:
                frames.append({"assignment": (*assignment, provider), "next_provider": 0})
        if work.hit:
            break
        target_cursor += 1
        domains = []
        domain_cursor = provider_cursor = 0
    complete = target_cursor == len(targets) and not work.hit
    witness = _metric_witness_cost(request, work) if complete and request.witness_primitives else {"status": "NOT_SUPPLIED", "cost": None}
    witness_cost = witness["cost"]
    bound_falsified = best is not None and witness_cost is not None and best > witness_cost
    # A bounded prefix minimum is an upper estimate of the relaxation minimum,
    # so only zero is licensed until every retained target/assignment is closed.
    licensed = best if complete and not work.hit and not bound_falsified else 0
    minimum = (complete and not work.hit and best is not None and witness_cost == best
        and witness["status"] == "REALIZABLE_MODEL_WITNESS")
    return _result(request, work, {"licensed_lower_bound": licensed,
        "examined_assignment_minimum": best, "best_assignment": best_assignment,
        "all_declared_target_domains_compared": complete and not work.hit,
        "witness": witness, "witness_gap": witness_cost - best if witness_cost is not None and best is not None else None,
        "declared_witness_cost_matches": request.witness_cost == witness_cost if request.witness_cost is not None else None,
        "bound_falsified_by_realizable_witness": bound_falsified,
        "minimum_proved": minimum, "information_acquisition_cost_bound": False,
        "restricted_execution_scope_ref": request.execution_scope_ref,
        "reset_excluded_from_this_bound": True},
        contradiction=bound_falsified, pending=0 if complete and not work.hit else 1,
        frontier={"phase": "ASSIGNMENTS", "targets": tuple(targets), "distances": distances,
            "best_cost": best, "best_assignment": best_assignment, "target_cursor": target_cursor,
            "assignments_examined": examined, "frames": tuple(frames),
            "current_domains": tuple(tuple(row) for row in domains), "provider_cursor": provider_cursor,
            "domain_cursor": domain_cursor})


def assemble_metric_stack_response(request: MetricStackAssemblyInput) -> MechanicalResponseInput:
    """Copy only the status/cause constants selected by SRC/DRM."""
    packet, calculation = request.request, request.calculation
    receipt = None
    if calculation and calculation.declared_domain_size is not None and packet.identity.requested_domain_ref:
        receipt = MechanicalDomainReceipt(domain_ref=packet.identity.requested_domain_ref,
            input_revision_ref=packet.identity.input_revision_ref,
            declared_domain_size=calculation.declared_domain_size,
            examined_count=calculation.examined_count, pending_count=calculation.pending_count)
    return MechanicalResponseInput(request=packet.identity,
        returned_identity=calculation.request_identity if calculation else packet.identity,
        source_status=request.source_status, returned_type="metric_stack_image.result.v1",
        descriptive_values=calculation.values if calculation else FrozenMap({"operation_ref": packet.identity.operation_ref}),
        retained_alternative_refs=calculation.retained_alternative_refs if calculation else (),
        distinguishing_question_ref="metric_stack_image.current_prerequisites",
        missing_cause=None if request.cause == "NONE" else request.cause,
        domain_receipt=receipt, retained_frontier=calculation.retained_frontier if calculation else FrozenMap())
