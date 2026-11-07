"""Measured pane correspondences routed to the existing recolor calculator.

DRM admits the interpretation of a small exemplar pane, a larger field and
uniform framed pigments. This module enumerates finite geometric alternatives,
binds the declared interpretation and transports measurements, never actions.
"""
from collections import Counter
from collections.abc import Mapping
from itertools import permutations
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenMap, FrozenModel, Ref, stable_digest
from .contracts import InteractionProbeInput, InteractionProbeAgenda
from .banded_framed_measurements import measure_framed_patterns
from .topological_region_recolor import RecolorRegion, RecolorModel, TopologicalRecolorRequest
from .mechanical_family_contracts_d import DMechanicalScope, DMechanicalResult
from .agenda_measurement_transport import append_candidate_measurements


class ObservedTopologyProposal(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.observed_topology_proposal.v1'
    request: InteractionProbeInput
    agenda: InteractionProbeAgenda
    measurement_ref: Ref
    frames: tuple[FrozenMap, ...] = Field(default=(), max_length=32)
    pane_triples: tuple[FrozenMap, ...] = Field(default=(), max_length=32)
    region_refs: tuple[Ref, ...] = Field(default=(), max_length=128)
    facts: FrozenMap


class ObservedTopologyScopeBinding(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.observed_topology_scope_binding.v1'
    proposal: ObservedTopologyProposal
    source_disposition_ref: Ref
    source_alternative_facts: FrozenMap


class ObservedTopologyMeasurementInput(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.observed_topology_measurement_input.v1'
    request: InteractionProbeInput
    agenda: InteractionProbeAgenda


class ObservedTopologyReturn(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.observed_topology_return.v1'
    proposal: ObservedTopologyProposal
    result: DMechanicalResult


class ObservedTopologyCorrespondence(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.observed_topology_correspondence.v1'
    proposal: ObservedTopologyProposal
    result: DMechanicalResult
    correspondences: tuple[FrozenMap, ...] = Field(default=(), max_length=32)
    facts: FrozenMap


class ObservedTopologyAdmission(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.observed_topology_admission.v1'
    correspondence: ObservedTopologyCorrespondence
    source_disposition_ref: Ref
    source_alternative_facts: FrozenMap


def _box(c):
    return c.bbox.top, c.bbox.left, c.bbox.bottom, c.bbox.right


def _contains(outer, inner):
    return outer[0] <= inner[0] <= inner[2] <= outer[2] and outer[1] <= inner[1] <= inner[3] <= outer[3]


def _disjoint(a, b):
    return a[2] < b[0] or b[2] < a[0] or a[3] < b[1] or b[3] < a[1]


def measure_observed_topology(value: ObservedTopologyMeasurementInput) -> ObservedTopologyProposal:
    request, agenda = value.request, value.agenda
    components = request.components.components
    families = measure_framed_patterns(request.frame, components, maximum_frames=32)
    uniform = tuple(f for f in families if f['domain_complete'] and all(len(x['patterns']) == 1 for x in f['frames']))
    pane_components = tuple(c for c in components if c.touches_frame_boundary and c.bbox.height >= 3 and c.bbox.width >= 3)
    complete = tuple(c for c in components if not c.touches_frame_boundary)
    triples, frames = [], ()
    if len(uniform) == 1 and len(pane_components) <= 16 and len(complete) <= 128:
        frames = tuple(FrozenMap(x) for x in uniform[0]['frames'])
        for palette in pane_components:
            if not all(_contains(_box(palette), x['box']) for x in frames):
                continue
            peers = tuple(c for c in pane_components if _disjoint(_box(c), _box(palette)))
            for left, right in permutations(peers, 2):
                if _disjoint(_box(left), _box(right)):
                    triples.append(FrozenMap({'frame_pane_ref': palette.component_id,
                        'left_pane_ref': left.component_id, 'right_pane_ref': right.component_id,
                        'left_box': _box(left), 'right_box': _box(right)}))
    bounded = len(triples) <= 32
    if not bounded:
        triples, frames = [], ()
    ref = 'measurement.observed_topology.' + stable_digest((request.frame, tuple(triples)))[:24]
    return ObservedTopologyProposal(request=request, agenda=agenda, measurement_ref=ref,
        frames=frames, pane_triples=tuple(triples), region_refs=tuple(c.component_id for c in complete) if triples else (),
        facts=FrozenMap({'separate_framed_pane_triples_measured': bool(triples) and bounded,
            'measured_uniform_frame_count': len(frames), 'complete_component_support_count': len(complete),
            'measurement_domain_complete': bounded}))


def bind_observed_topology_scope(value: ObservedTopologyScopeBinding) -> TopologicalRecolorRequest:
    p = value.proposal
    if value.source_disposition_ref != 'observed_topology.measure_current_pockets' or not p.pane_triples:
        raise ValueError('Source has not admitted the bounded pocket measurement')
    declared = value.source_alternative_facts[value.source_disposition_ref]
    components = {c.component_id: c for c in p.request.components.components}
    scope = DMechanicalScope(request_ref=p.measurement_ref, caller_ref='arc3.interaction_probe_enumeration',
        parent_consumer_ref=declared['goal_ref'], parent_goal_ref=declared['goal_ref'],
        parent_contribution_ref=p.measurement_ref, caller_next_item_ref='item.observed_topological_correspondences',
        epoch=p.request.current_context_epoch, evidence_revision_ref=p.measurement_ref,
        model_revision_ref=stable_digest(p.region_refs), model_status_ref=declared['model_status_ref'],
        event_owner_ref=p.measurement_ref, input_domain_complete=True,
        assumption_refs=tuple(declared['assumption_refs']))
    regions = tuple(RecolorRegion(region_ref=ref, support=components[ref].pixels,
        evidence_ref=p.measurement_ref, clipped=False, boundary_complete=True) for ref in p.region_refs)
    model = RecolorModel(model_ref=p.measurement_ref, connectivity=declared['component_connectivity'],
        pocket_connectivity=declared['pocket_connectivity'], regions=regions,
        editable_mask=tuple((r, c) for r in range(p.request.frame.height) for c in range(p.request.frame.width)))
    return TopologicalRecolorRequest(scope=scope, operation_ref='mechanics.topological_region_recolor.enclosed_pockets',
        mode_ref='MEASURE', requested_result_type='DMechanicalResult', node_bound=100000, depth_bound=4096,
        domain_bound=4096, time_bound_ms=2000, models=(model,))


def measure_observed_topology_correspondences(value: ObservedTopologyReturn) -> ObservedTopologyCorrespondence:
    p, result = value.proposal, value.result
    rows = tuple(result.values.get('model_correlated_results', ())) if result.domain_complete else ()
    pockets = tuple(rows[0]['result']['region_pockets']) if len(rows) == 1 else ()
    by_ref = {x['region_ref']: x for x in pockets}
    components = {c.component_id: c for c in p.request.components.components}
    palette_values = frozenset(f['patterns'][0]['palette_value'] for f in p.frames)
    pocket_sets = tuple(frozenset(mask) for x in pockets for mask in x['pocket_masks'])
    outer = tuple(ref for ref in p.region_refs if ref in by_ref
        and not any(frozenset(components[ref].pixels) <= mask for mask in pocket_sets))
    matches = []
    for triple in p.pane_triples:
        left = tuple(ref for ref in outer if _contains(triple['left_box'], _box(components[ref])))
        right = tuple(ref for ref in outer if _contains(triple['right_box'], _box(components[ref])))
        left_counts = tuple(by_ref[ref]['pocket_count'] for ref in left)
        if (not left or not right or len(set(left_counts)) != len(left_counts)
                or not all(components[ref].value in palette_values for ref in left)):
            continue
        by_count = {by_ref[ref]['pocket_count']: ref for ref in left}
        if not all(by_ref[ref]['pocket_count'] in by_count for ref in right):
            continue
        pairs = tuple(FrozenMap({'left_ref': by_count[by_ref[ref]['pocket_count']], 'right_ref': ref,
            'pocket_count': by_ref[ref]['pocket_count'], 'left_value': components[by_count[by_ref[ref]['pocket_count']]].value,
            'right_value': components[ref].value, 'right_area': components[ref].area,
            'pocket_refs': tuple('measurement.pocket.' + stable_digest(mask)[:24] for mask in by_ref[ref]['pocket_masks'])})
            for ref in right)
        matches.append(FrozenMap({'triple': triple, 'pairs': pairs, 'left_count': len(left),
            'correspondence_ref': 'measurement.topological_pairs.' + stable_digest((triple, pairs))[:24]}))
    bounded = len(matches) <= 32
    complete = result.domain_complete and len(pockets) == len(p.region_refs) and bounded
    return ObservedTopologyCorrespondence(proposal=p, result=result,
        correspondences=tuple(matches) if bounded else (), facts=FrozenMap({
            'pocket_correspondence_domain_complete': complete,
            'pocket_correspondence_count': len(matches),
            'matched_distinct_exemplar_count': matches[0]['left_count'] if len(matches) == 1 else 0}))


def append_observed_topology_loci(value: ObservedTopologyAdmission) -> InteractionProbeAgenda:
    q = value.correspondence
    p, v, agenda = q.proposal, q.proposal.request, q.proposal.agenda
    if value.source_disposition_ref != 'observed_topology.admit_reference_correspondence' or len(q.correspondences) != 1:
        raise ValueError('Source has not admitted a unique current reference correspondence')
    declared = value.source_alternative_facts[value.source_disposition_ref]
    model = q.correspondences[0]
    pairs = model['pairs']
    components = {c.component_id: c for c in v.components.components}
    from .interaction import (_point_candidates, _deep_axis_clearance_witness,
        _attach_current_open_cavity_measurements)
    points = tuple(((f['box'][0] + f['box'][2]) // 2, (f['box'][1] + f['box'][3]) // 2) for f in p.frames)
    points += tuple(_deep_axis_clearance_witness(components[x['right_ref']])[0] for x in pairs)
    added = _point_candidates(v, frozenset(v.current_context_no_effect_candidate_refs),
        frozenset(v.tested_candidate_refs_without_resolution_plan), dict(agenda.context_facts), {}, {}, {}, requested_points=points)
    candidates = {c.candidate_ref: c for c in agenda.candidates}
    facts, deltas = dict(agenda.alternative_facts), dict(agenda.descriptive_delta_facts)
    for candidate, measured in added:
        if candidate.candidate_ref not in candidates:
            candidates[candidate.candidate_ref] = candidate
            facts[candidate.candidate_ref] = FrozenMap.overlay(measured, agenda.context_facts)
            deltas[candidate.candidate_ref] = measured
    ordered = tuple(candidates.values())
    extended = agenda.model_copy(update={'candidates': ordered, 'alternative_refs': tuple(c.candidate_ref for c in ordered),
        'alternative_facts': FrozenMap(facts), 'descriptive_delta_facts': FrozenMap(deltas), 'has_candidates': bool(ordered)})
    borders = Counter(f['border_value'] for f in p.frames)
    distinctive = tuple(f for f in p.frames if borders[f['border_value']] == 1)
    active = distinctive[0]['patterns'][0]['palette_value'] if len(borders) == 2 and len(distinctive) == 1 else None
    remaining = Counter(x['left_value'] for x in pairs if x['left_value'] != x['right_value'])
    by_target = {x['right_ref']: x for x in pairs}
    wells = {((f['box'][0] + f['box'][2]) // 2, (f['box'][1] + f['box'][3]) // 2): f['patterns'][0]['palette_value'] for f in p.frames}
    measured_by_ref = {}
    for c in ordered:
        target = by_target.get(c.component_ref)
        well_value = wells.get(c.point) if c.point is not None else None
        pigment = target['left_value'] if target is not None else well_value
        measured_by_ref[c.candidate_ref] = FrozenMap({
            'topological_reference_hypothesis_admitted': True,
            'topological_reference_measurement_ref': p.measurement_ref,
            'topological_reference_correspondence_ref': model['correspondence_ref'],
            'topological_reference_assumption_refs': tuple(declared['assumption_refs']),
            'topological_locus_is_uniform_frame_interior': well_value is not None,
            'topological_locus_is_corresponding_support': target is not None and c.point is not None and c.point in components[target['right_ref']].pixels,
            'topological_current_support_equals_reference': bool(target is not None and target['left_value'] == target['right_value']),
            'topological_active_pigment_equals_reference': pigment is not None and active == pigment,
            'topological_current_pigment_is_distinguished': active is not None,
            'topological_current_unmatched_support_count': remaining.get(pigment, 0),
            'topological_current_unmatched_support_count_is_maximum': bool(remaining and remaining.get(pigment, 0) == max(remaining.values())),
            'topological_current_beneficiary_refs': tuple(x['right_ref'] for x in pairs
                if x['left_value'] == pigment and x['right_value'] != pigment),
            'topological_correspondence_pocket_count': target['pocket_count'] if target is not None else None,
            'topological_correspondence_support_area': target['right_area'] if target is not None else 0,
            'topological_expected_pigment_value': pigment,
            'topological_unchanged_pocket_refs': target['pocket_refs'] if target is not None else (),
        })
    annotated = append_candidate_measurements(extended, FrozenMap(measured_by_ref), FrozenMap({
        'observed_topological_calculation_return': {'status': q.result.status, 'cause': q.result.cause,
            'domain_complete': q.result.domain_complete, 'correspondence_count': len(q.correspondences),
            'pair_measurements': pairs}}))
    # New loci need the same current geometric membership projection as the
    # ordinary producer's loci. Reuse its evidence, never default a missing
    # strict release Boolean to False or copy a different candidate's proof.
    if 'open_cavity_nonreturn_first_action_refs' in agenda.context_facts:
        annotated = _attach_current_open_cavity_measurements(annotated, FrozenMap({
            'open_cavity_nonreturn_first_action_refs': agenda.context_facts['open_cavity_nonreturn_first_action_refs']}))
    coverage = agenda.context_facts.get('curiosity_frontier_coverage')
    if isinstance(coverage, Mapping):
        represented = frozenset(c.action_ref for c in ordered)
        coverage = FrozenMap.overlay({
            'candidate_count': len(ordered),
            'point_candidate_count': sum(c.point is not None for c in ordered),
            'object_candidate_count': sum(c.component_ref is not None for c in ordered),
            'represented_command_count': len(represented),
            'unrepresented_command_refs': tuple(ref for ref in v.available_action_refs if ref not in represented),
            'supplemental_point_scope_measurement_ref': p.measurement_ref,
        }, coverage)
        annotated = annotated.model_copy(update={'context_facts': FrozenMap.overlay(
            {'curiosity_frontier_coverage': coverage}, annotated.context_facts)})
    return annotated
