"""Current geometry and Source-bound finite relations, never an action selector."""
from itertools import combinations, product
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenMap, FrozenModel, Ref, immutable_json_data, stable_digest
from .contracts import InteractionProbeInput, InteractionProbeAgenda
from .fill_cell_correspondence import _current_cell_support_matches
from .finite_search_contracts_c import FiniteVariableC, FiniteRelationC, FiniteSearchInputC, FiniteSearchFactsC
from .mechanical_request_contracts import MechanicalRequestIdentity
from .agenda_measurement_transport import append_candidate_measurements


class CellCoverageProposal(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.cell_coverage_proposal.v1"
    request: InteractionProbeInput
    agenda: InteractionProbeAgenda
    measurement_ref: Ref
    geometry: FrozenMap = Field(default_factory=FrozenMap)
    occupied_indices: tuple[int, ...] = ()
    ordered_prefix: tuple[int, ...] = ()
    head_index: int | None = None
    peers: tuple[FrozenMap, ...] = Field(default=(), max_length=32)
    boundary_bars: tuple[FrozenMap, ...] = Field(default=(), max_length=128)
    facts: FrozenMap


class CellCoverageMeasurementInput(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.cell_coverage_measurement_input.v1"
    request: InteractionProbeInput
    agenda: InteractionProbeAgenda


class CellCoverageScopeBinding(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.cell_coverage_scope_binding.v1"
    proposal: CellCoverageProposal
    source_disposition_ref: Ref
    source_alternative_facts: FrozenMap
    state_revision: int = Field(ge=0)


class CellCoverageReturn(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.cell_coverage_return.v1"
    proposal: CellCoverageProposal
    result: FiniteSearchFactsC
    facts: FrozenMap


class CellCoverageResultInput(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.cell_coverage_result_input.v1"
    proposal: CellCoverageProposal
    result: FiniteSearchFactsC


class CellCoverageAdmission(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.cell_coverage_admission.v1"
    calculation: CellCoverageReturn
    source_disposition_ref: Ref
    source_alternative_facts: FrozenMap


def _signature(component):
    box = component.bbox
    return (box.height, box.width,
            tuple(sorted((r - box.top, c - box.left) for r, c in component.pixels)))


def _support_chains(v, geometry, occupied, head):
    """Decode all monochrome crossings that form a unique head-ended chain."""
    if len(occupied) == 1:
        return (tuple(occupied),)
    frame = v.current_observed_frame or v.frame
    nc, pitch = int(geometry['column_count']), int(geometry['pitch'])
    support = frozenset(occupied)
    by_value = {}
    for first in occupied:
        r, c = divmod(first, nc)
        for dr, dc in ((0, 1), (1, 0)):
            rr, cc = r + dr, c + dc
            second = rr * nc + cc
            if not (rr < geometry['row_count'] and cc < nc and second in support):
                continue
            y = geometry['top'] + r * pitch + (pitch if dr else pitch // 2)
            x = geometry['left'] + c * pitch + (pitch if dc else pitch // 2)
            values = tuple(frame.rows[y + offset * dr][x + offset * dc] for offset in (-1, 0, 1))
            if len(set(values)) == 1:
                by_value.setdefault(values[0], []).append((first, second))
    orders = set()
    for _, edges in sorted(by_value.items()):
        if len(edges) != len(occupied) - 1:
            continue
        neighbors = {i: set() for i in occupied}
        for first, second in edges:
            neighbors[first].add(second)
            neighbors[second].add(first)
        ends = tuple(i for i in occupied if len(neighbors[i]) == 1)
        if len(ends) != 2 or head not in ends or any(len(neighbors[i]) not in (1, 2) for i in occupied):
            continue
        start = next(i for i in ends if i != head)
        order, previous = [start], None
        for _step in range(len(occupied)):
            if order[-1] == head:
                break
            following = tuple(sorted(neighbors[order[-1]] - {previous}))
            if len(following) != 1 or following[0] in order:
                break
            previous = order[-1]
            order.append(following[0])
        if len(order) == len(occupied) and order[-1] == head and set(order) == support:
            orders.add(tuple(order))
    return tuple(sorted(orders))


def _boundary_bars(v, geometry):
    """Measure solid thickened grid segments, without calling them obstacles."""
    pitch = int(geometry['pitch'])
    found = []
    for component in v.components.components:
        box = component.bbox
        if component.area != box.height * box.width:
            continue
        for horizontal in (True, False):
            major = box.width if horizontal else box.height
            minor = box.height if horizontal else box.width
            if major != pitch + 1 or not 1 < minor < pitch:
                continue
            start = box.left if horizontal else box.top
            origin = geometry['left'] if horizontal else geometry['top']
            if (start - origin) % pitch:
                continue
            cell = (start - origin) // pitch
            count = geometry['column_count'] if horizontal else geometry['row_count']
            if not 0 <= cell < count:
                continue
            for boundary in range(1, geometry['row_count'] if horizontal else geometry['column_count']):
                line = (geometry['top'] if horizontal else geometry['left']) + boundary * pitch
                low, high = (box.top, box.bottom) if horizontal else (box.left, box.right)
                if low < line < high:
                    first = ((boundary - 1) * geometry['column_count'] + cell if horizontal
                             else cell * geometry['column_count'] + boundary - 1)
                    second = first + (geometry['column_count'] if horizontal else 1)
                    found.append(FrozenMap({'first_index': first, 'second_index': second,
                        'component_ref': component.component_id, 'bbox': box.model_dump()}))
    return tuple(found)


def measure_cell_coverage_geometry(value: CellCoverageMeasurementInput) -> CellCoverageProposal:
    v = value.request
    matches = _current_cell_support_matches(v, v.canonical_cell_support_growth_facts)
    geometry, occupied, head, peers, orders, bars = FrozenMap(), (), None, [], (), ()
    if len(matches) == 1 and v.previous_action_observed_frame is not None:
        geometry, _, occupied, r, c, nr, nc = matches[0]
        head = r * nc + c
        orders = _support_chains(v, geometry, occupied, head)
        bars = _boundary_bars(v, geometry)
        boxes = tuple(v.canonical_provisional_control_geometry_bboxes) or tuple(v.input_aligned_entity_bboxes)
        bodies = tuple(x for x in v.components.components if x.bbox == boxes[0])
        if len(bodies) == 1:
            signature = _signature(bodies[0])
            for component in v.components.components:
                box = component.bbox
                if (box == boxes[0] or (box.height, box.width) != signature[:2] or _signature(component) != signature
                        or not all(v.previous_action_observed_frame.rows[y][x] == component.value
                                   for y, x in component.pixels)):
                    continue
                rr = (box.top + box.bottom - 2 * geometry['top']) // (2 * geometry['pitch'])
                cc = (box.left + box.right - 2 * geometry['left']) // (2 * geometry['pitch'])
                if (0 <= rr < nr and 0 <= cc < nc and rr * nc + cc not in occupied
                        and geometry['top'] + rr * geometry['pitch'] < box.top <= box.bottom
                        < geometry['top'] + (rr + 1) * geometry['pitch']
                        and geometry['left'] + cc * geometry['pitch'] < box.left <= box.right
                        < geometry['left'] + (cc + 1) * geometry['pitch']):
                    peers.append(FrozenMap({'component_ref': component.component_id, 'cell_index': rr * nc + cc,
                        'geometry_digest': stable_digest((box, signature))}))
    remaining = int(geometry.get('cell_count', 0)) - len(occupied)
    relation_count = remaining * (remaining - 1) // 2
    exceeded = len(peers) > 32 or len(bars) > 128
    measurable = bool(geometry and head is not None and len(peers) == 1 and len(orders) == 1
                      and remaining > 0 and remaining <= 128 and relation_count <= 128
                      and v.current_observation_ref and not exceeded)
    measurement = 'measurement.cell_coverage.' + stable_digest((v.current_observation_ref, geometry, occupied,
                                                              head, peers, orders, bars))
    facts = FrozenMap({'coverage_geometry_unique': bool(geometry), 'congruent_stationary_unoccupied_peer_count': len(peers),
        'finite_coverage_receiver_scope_measured': measurable, 'geometry_digest': geometry.get('geometry_digest'),
        'peer_digest': peers[0]['geometry_digest'] if len(peers) == 1 else None,
        'peer_component_ref': peers[0]['component_ref'] if len(peers) == 1 else None,
        'cell_count': geometry.get('cell_count', 0), 'occupied_count': len(occupied), 'remaining_count': remaining,
        'current_support_order_count': len(orders),
        'boundary_bar_count': len(bars),
        'geometry_measurement_bound_exceeded': exceeded,
        'committed_plan_present': value.agenda.context_facts.get('committed_plan_present'),
        'measurement_frame_ref': v.current_observation_ref, 'measurement_ref': measurement})
    return CellCoverageProposal(request=v, agenda=value.agenda, measurement_ref=measurement,
        geometry=geometry, occupied_indices=occupied, ordered_prefix=orders[0] if len(orders) == 1 else (),
        head_index=head, peers=tuple(peers) if not exceeded else (),
        boundary_bars=bars if not exceeded else (), facts=facts)


def measure_cell_coverage_peer_facts(v, agenda):
    """Expose current geometric witnesses for ordinary control qualification."""
    if not v.canonical_cell_support_growth_facts:
        return FrozenMap()
    p = measure_cell_coverage_geometry(CellCoverageMeasurementInput(request=v, agenda=agenda))
    return FrozenMap({'coverage_peer_current': p.facts['finite_coverage_receiver_scope_measured'],
        'coverage_peer_measurement_ref': p.measurement_ref,
        'coverage_peer_geometry_digest': p.facts['peer_digest'],
        'coverage_peer_order_digest': stable_digest(p.ordered_prefix),
        'coverage_peer_prefix_length': len(p.ordered_prefix),
        'coverage_peer_occupied_count': len(p.occupied_indices),
        'coverage_peer_cell_count': p.facts['cell_count'],
        'coverage_peer_cell_index': p.peers[0]['cell_index'] if len(p.peers) == 1 else None})


def bind_cell_coverage_relations(value: CellCoverageScopeBinding) -> FiniteSearchInputC:
    p = value.proposal
    if value.source_disposition_ref != 'coverage_relations.calculate_complete_candidate_words':
        raise ValueError('Source has not requested a finite coverage-word calculation')
    declared = value.source_alternative_facts[value.source_disposition_ref]
    if (not p.facts.get('finite_coverage_receiver_scope_measured') or len(p.peers) != 1
            or declared.get('append_distinct_supports_is_planning_constraint') is not True
            or declared.get('end_on_congruent_peer_is_goal_hypothesis') is not True
            or declared.get('world_single_visit_law_is_asserted') is not False
            or declared.get('avoid_boundary_bars_is_planning_constraint') is not True):
        raise ValueError('current geometry or Source model assumptions are not admitted')
    g, v = p.geometry, p.request
    nc = int(g['column_count'])
    remaining = tuple(sorted(set(range(int(g['cell_count']))) - set(p.occupied_indices)))
    peer = p.peers[0]['cell_index']
    cells = {i: f"cell:{g['geometry_digest']}:{i}" for i in range(int(g['cell_count']))}
    avoided = frozenset(tuple(sorted((bar['first_index'], bar['second_index']))) for bar in p.boundary_bars)
    def adjacent(a, b):
        ar, ac = divmod(a, nc)
        br, bc = divmod(b, nc)
        return abs(ar - br) + abs(ac - bc) == 1 and tuple(sorted((a, b))) not in avoided
    unavailable_first = set()
    no_effect = frozenset(v.current_context_no_effect_candidate_refs)
    hr, hc = divmod(p.head_index, nc)
    for action, dr, dc in v.interface_action_translation_deltas:
        if abs(dr) + abs(dc) == 1 and (action in no_effect or f'probe:discrete:{action}' in no_effect):
            unavailable_first.add((hr + dr) * nc + hc + dc)
    variables, domains = [], []
    for step in range(len(remaining)):
        domain = tuple(i for i in remaining
            if (i == peer if step == len(remaining) - 1 else i != peer)
            and (step != 0 or (adjacent(p.head_index, i) and i not in unavailable_first)))
        domains.append(domain)
        variables.append(FiniteVariableC(variable_ref=f'extension:{step}',
            values=tuple(cells[i] for i in domain), costs=FrozenMap({cells[i]: 1 for i in domain})))
    relations = []
    for i, j in combinations(range(len(variables)), 2):
        allowed = tuple((cells[a], cells[b]) for a, b in product(domains[i], domains[j])
                        if (adjacent(a, b) if j == i + 1 else a != b))
        relations.append(FiniteRelationC(relation_ref=f'constraint:{i}:{j}',
            variable_refs=(variables[i].variable_ref, variables[j].variable_ref), allowed_rows=allowed, domain_complete=True))
    variables, relations = tuple(variables), tuple(relations)
    order = tuple(x.variable_ref for x in variables)
    evidence = (g['term_ref'], v.current_observation_ref, p.measurement_ref)
    metric = str(declared['cost_metric_ref'])
    descriptor = (variables, relations, order, metric, True, evidence)
    request_ref = 'request.coverage_relations.' + stable_digest((p.measurement_ref, value.state_revision, declared))
    identity = MechanicalRequestIdentity(request_ref=request_ref,
        kernel_ref=declared['kernel_ref'], operation_ref=declared['operation_ref'], mode=declared['mode'],
        caller_ref=declared['caller_ref'], parent_contribution_ref=declared['parent_contribution_ref'],
        epoch=value.state_revision, input_revision_ref=v.current_observation_ref,
        model_assignments=FrozenMap({'append_distinct_supports_is_planning_constraint': True,
            'end_on_congruent_peer_is_goal_hypothesis': True, 'world_single_visit_law_is_asserted': False,
            'avoid_boundary_bars_is_planning_constraint': True, 'world_obstacle_law_is_asserted': False}),
        immutable_inputs=FrozenMap({'finite_relation_digest': stable_digest(immutable_json_data(descriptor)),
            'cost_metric_ref': metric, 'ordered_prefix': tuple(cells[i] for i in p.ordered_prefix),
            'occupied_support': tuple(cells[i] for i in p.occupied_indices),
            'avoided_boundary_bar_edges': tuple(sorted(avoided))}),
        actual_bounds=FrozenMap({'max_candidates': declared['max_candidates'], 'max_states': declared['max_states'],
                                'max_depth': declared['max_depth']}), expected_return_type='FiniteSearchFactsC')
    return FiniteSearchInputC(request=identity, variables=variables, relations=relations, variable_order=order,
        cost_metric_ref=metric, domain_complete=True, evidence_refs=evidence)


def measure_cell_coverage_return(value: CellCoverageResultInput) -> CellCoverageReturn:
    p, result = value.proposal, value.result
    current = (result.request.request.input_revision_ref == p.request.current_observation_ref
               and p.measurement_ref in result.request.evidence_refs)
    complete = bool(current and result.complete and not result.bounded and not result.missing_refs)
    return CellCoverageReturn(proposal=p, result=result, facts=FrozenMap.overlay({
        'finite_coverage_return_current': current, 'finite_coverage_return_complete': complete,
        'finite_coverage_completion_count': len(result.assignments) if complete else 0,
        'finite_coverage_return_bounded': result.bounded, 'measurement_ref': p.measurement_ref}, p.facts))


def append_cell_coverage_measurements(value: CellCoverageAdmission) -> InteractionProbeAgenda:
    q = value.calculation
    if (value.source_disposition_ref not in ('coverage_relations.admit_complete_word_witness',
                                           'coverage_relations.record_complete_empty_model')
            or q.facts.get('finite_coverage_return_complete') is not True):
        raise ValueError('Source has not admitted a complete current finite result')
    declared = value.source_alternative_facts[value.source_disposition_ref]
    p, result = q.proposal, q.result
    first = result.request.variable_order[0]
    nc = int(p.geometry['column_count'])
    hr, hc = divmod(p.head_index, nc)
    deltas = {ref: (dr, dc) for ref, dr, dc in p.request.interface_action_translation_deltas
              if abs(dr) + abs(dc) == 1}
    measurements = {}
    for candidate in p.agenda.candidates:
        delta = deltas.get(candidate.action_ref)
        count = 0
        if delta is not None:
            target = (hr + delta[0]) * nc + hc + delta[1]
            target_ref = f"cell:{p.geometry['geometry_digest']}:{target}"
            count = sum(row[first] == target_ref for row in result.assignments)
        measurements[candidate.candidate_ref] = FrozenMap({
            'coverage_completion_current': True, 'coverage_completion_witness_count': count,
            'coverage_completion_total_word_count': len(result.assignments),
            'coverage_completion_word_length': len(result.request.variable_order),
            'coverage_completion_geometry_digest': p.geometry['geometry_digest'],
            'coverage_completion_prefix_length': len(p.ordered_prefix),
            'coverage_completion_receiver_cell_index': p.peers[0]['cell_index'],
            'coverage_completion_measurement_ref': p.measurement_ref,
            'coverage_completion_model_ref': declared['model_ref'],
            'coverage_completion_proposed_subgoal_ref': declared['subgoal_ref'],
            'coverage_completion_proposed_principle_ref': declared['selection_principle_ref'],
            'coverage_completion_world_single_visit_law_asserted': False,
            'coverage_completion_request_ref': result.request.request.request_ref})
    return append_candidate_measurements(p.agenda, FrozenMap(measurements), FrozenMap({
        'coverage_completion_calculation': {'complete': result.complete, 'bounded': result.bounded,
            'completion_count': len(result.assignments), 'examined_count': result.examined_count,
            'measurement_ref': p.measurement_ref, 'hypothesis_model_ref': declared['model_ref']}}))
