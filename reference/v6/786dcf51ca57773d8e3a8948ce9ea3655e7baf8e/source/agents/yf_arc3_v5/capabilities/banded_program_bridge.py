"""Finite geometric program hypotheses and transport to the existing D service.

No hypothesis is selected here. Source/DRM must admit its arrow, track and
distinguished-destination interpretation before the inverse service is called.
"""
from itertools import permutations
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenMap, FrozenModel, Ref, stable_digest
from .contracts import InteractionProbeAgenda
from .fixed_program_origin import FixedProgramModel, FixedProgramRequest
from .mechanical_family_contracts_d import DMechanicalScope, DMechanicalResult
from .agenda_measurement_transport import append_candidate_measurements


class BandedProgramProposal(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.banded_program_proposal.v1'
    agenda: InteractionProbeAgenda
    models: tuple[FixedProgramModel, ...] = Field(default=(), max_length=32)
    measurement_ref: Ref
    points: FrozenMap = Field(default_factory=FrozenMap)
    facts: FrozenMap
    parent_goal_ref: Ref | None = None
    epoch: int = 0


class BandedProgramBindInput(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.banded_program_bind.v1'
    proposal: BandedProgramProposal
    source_disposition_ref: Ref
    source_alternative_facts: FrozenMap


class BandedProgramReturnInput(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.banded_program_return.v1'
    proposal: BandedProgramProposal
    result: DMechanicalResult


def _taper(pattern):
    rows, cols = tuple(pattern['row_counts']), tuple(pattern['column_counts'])
    results = []
    for axis, profile, symmetric in (
            ('row', rows, pattern['column_reflection_exact']),
            ('column', cols, pattern['row_reflection_exact'])):
        if not symmetric or min(profile) <= 0 or profile[0] == profile[-1]:
            continue
        if all(a >= b for a, b in zip(profile, profile[1:])):
            results.append(f'axis.{axis}.positive')
        if all(a <= b for a, b in zip(profile, profile[1:])):
            results.append(f'axis.{axis}.negative')
    return tuple(results)


def _geometry_models(family):
    cores = family['cores']
    framed = family['framed']
    bands = cores['bands']
    bi = {ref: i for i, band in enumerate(bands) for ref in band['ordered_core_refs']}
    frames = {f['frame_ref']: f for f in framed['frames']}
    symbols = {}
    for ref, frame in sorted(frames.items()):
        possibilities = tuple((p['pattern_ref'], axis) for p in frame['patterns'] for axis in _taper(p))
        if len(possibilities) != 1:
            return (), {'cause': 'AMBIGUOUS_OR_NON_TAPERED_INTERIOR'}
        symbols[ref] = possibilities[0][1]
    runs = []
    previous = None
    for sample in family['activations']['samples']:
        changed = tuple(sample['changed_border_refs'])
        if len(changed) != 1:
            break
        ref = changed[0]
        if ref != previous:
            if ref in {r for _, r in runs}:
                return (), {'cause': 'REPEATED_ACTIVATION_BEFORE_COMPLETE_WORD'}
            runs.append((sample['frame_index'], ref))
        previous = ref
    if set(ref for _, ref in runs) != set(frames):
        return (), {'cause': 'INCOMPLETE_ORDERED_FRAME_ACTIVATION'}
    tracks = family['tracks']['tracks']
    if len(tracks) != 1:
        return (), {'cause': 'NON_UNIQUE_COMPACT_NEW_PIGMENT_TRACK'}
    samples = tracks[0]['samples']
    prefix = family['track_prefix_count']
    def at_or_before(index):
        # An absent or tied marker never becomes a guessed logical position.
        matches = tuple(s for s in samples if s['frame_index'] <= index)
        if not matches:
            return None
        sample = matches[-1]
        refs = sample['nearest_core_refs']
        return refs[0] if (sample['frame_index'] == index and len(refs) == 1
            and sample['nearest_distance_twice'] <= 2) else None
    start = at_or_before(0)
    # The last active run ends at the first non-unique border, before any flash.
    stop = next((s['frame_index'] for s in family['activations']['samples']
                 if len(s['changed_border_refs']) != 1), len(family['activations']['samples']))
    endpoints = tuple(at_or_before((runs[i + 1][0] if i + 1 < len(runs)
        else stop) + prefix - 1) for i in range(len(runs)))
    if start is None or any(ref is None for ref in endpoints):
        return (), {'cause': 'UNSETTLED_OR_AMBIGUOUS_INSTRUCTION_ENDPOINT'}
    word = tuple(symbols[ref] for _, ref in runs)
    observations = tuple(zip((start, *endpoints[:-1]), word, endpoints))
    links = family['links']
    horizontal_classes = []
    for before, direction, after in observations:
        if '.column.' not in direction or bi[before] != bi[after]:
            continue
        pair = frozenset((before, after))
        values = {e['palette_value'] for e in links if frozenset(e['endpoints']) == pair}
        if values:
            horizontal_classes.append(values)
    horizontal_values = set.intersection(*horizontal_classes) if horizontal_classes else set()
    if len(horizontal_values) != 1:
        return (), {'cause': 'UNQUALIFIED_HORIZONTAL_GLYPH_TRACK_RELATION'}
    horizontal_value = next(iter(horizontal_values))
    cross_values = tuple(sorted({e['palette_value'] for e in links
        if abs(bi[e['endpoints'][0]] - bi[e['endpoints'][1]]) == 1}))
    if len(cross_values) > 3 or not cross_values:
        return (), {'cause': 'CROSS_BAND_PIGMENT_DOMAIN_OUTSIDE_BOUND'}
    targets = tuple(cores['singleton_value_core_refs'])
    if len(targets) != 1:
        return (), {'cause': 'NON_UNIQUE_DISTINGUISHED_SUPPORT'}
    band_nodes = tuple(tuple(b['ordered_core_refs']) for b in bands)
    wrap_directions = set()
    for before, direction, after in observations:
        if '.column.' not in direction or bi[before] != bi[after]:
            continue
        nodes = band_nodes[bi[before]]
        step = 1 if direction.endswith('.positive') else -1
        if nodes.index(before) + step not in range(len(nodes)) and nodes[(nodes.index(before) + step) % len(nodes)] == after:
            wrap_directions.add(direction)
    models = []
    for priority in permutations(cross_values):
        ports = []
        complete = True
        for node in bi:
            for direction in sorted(set(word)):
                step = 1 if direction.endswith('.positive') else -1
                if '.column.' in direction:
                    nodes = band_nodes[bi[node]]
                    offset = nodes.index(node) + step
                    if offset not in range(len(nodes)) and direction not in wrap_directions:
                        complete = False
                        break
                    destination = nodes[offset % len(nodes)]
                    if offset in range(len(nodes)):
                        pair = frozenset((node, destination))
                        if not any(e['palette_value'] == horizontal_value
                                and frozenset(e['endpoints']) == pair for e in links):
                            complete = False
                            break
                else:
                    adjacent = bi[node] + step
                    choices = []
                    for value in priority:
                        choices = sorted({other for e in links if e['palette_value'] == value
                            and node in e['endpoints'] for other in e['endpoints']
                            if bi[other] == adjacent})
                        if choices:
                            break
                    if adjacent in range(len(bands)) and len(choices) != 1:
                        complete = False
                        break
                    destination = choices[0] if choices else None
                ports.append((node, direction, destination))
            if not complete:
                break
        lookup = {(n, d): end for n, d, end in ports}
        if not complete or any(lookup.get((a, d), a) != b for a, d, b in observations):
            continue
        model_ref = f'measurement.banded_fixed_program_model.{stable_digest((tuple(ports), word, targets))}'
        models.append(FixedProgramModel(model_ref=model_ref, nodes=tuple(bi), ports=tuple(ports),
            word=word, placement_nodes=tuple(bi), placement_hits=tuple((n, n) for n in bi),
            target_nodes=targets, arrival_updates_memory=False, cancelled_updates_memory=False,
            closure_after_cancelled=False, closure_after_self_loop=False,
            launch_memory_law='clear_on_launch'))
    return tuple(models), {'cause': 'MEASURED_TRACE_FIT' if models else 'NO_COMPLETE_TRACE_COMPATIBLE_PORT_MODEL',
        'instruction_count': len(word), 'observed_step_count': len(observations),
        'observed_horizontal_wrap': bool(wrap_directions), 'support_count': len(bi),
        'horizontal_link_palette_values': (horizontal_value,),
        'vertical_link_palette_values': cross_values,
        'glyph_axis_palette_values': tuple((axis, tuple(sorted({p['palette_value']
            for f in frames.values() for p in f['patterns'] if axis in _taper(p)})))
            for axis in sorted(set(word))),
        'oriented_taper_and_track_axis_binding_measured': bool(models)}


def measure_banded_program_proposals(agenda: InteractionProbeAgenda) -> BandedProgramProposal:
    packet = agenda.context_facts.get('banded_program_packet_measurement', FrozenMap())
    models, diagnostics, points = [], [], {}
    for family in packet.get('families', ()):
        family_models, facts = _geometry_models(family)
        diagnostics.append(facts)
        models.extend(family_models)
        for core in family['cores']['cores']:
            top, left, bottom, right = core['box']
            points[core['core_ref']] = ((top + bottom) // 2, (left + right) // 2)
    complete = bool(models) and len(models) <= 32 and len(diagnostics) == 1
    complete = complete and packet.get('packet_frame_count') == packet.get('source_frame_count')
    ref = f'measurement.banded_program.{stable_digest(packet)}'
    return BandedProgramProposal(agenda=agenda, models=tuple(models) if complete else (),
        measurement_ref=ref, points=FrozenMap(points), epoch=packet.get('epoch', 0),
        parent_goal_ref=packet.get('parent_goal_ref'), facts=FrozenMap({
            'complete_trace_compatible_geometry_hypotheses': complete,
            'oriented_taper_and_track_axis_binding_measured': complete,
            'model_count': len(models), 'diagnostics': tuple(diagnostics),
            'packet_measurement_ref': ref}))


def bind_banded_program_request(value: BandedProgramBindInput) -> FixedProgramRequest:
    p = value.proposal
    if value.source_disposition_ref != 'banded_program.admit_observed_trace_hypothesis' or not p.models:
        raise ValueError('Source has not admitted the measured program hypothesis')
    declared = value.source_alternative_facts[value.source_disposition_ref]
    goal = p.parent_goal_ref or declared['goal_ref']
    scope = DMechanicalScope(request_ref=p.measurement_ref, caller_ref='arc3.interaction_probe_enumeration',
        parent_consumer_ref=goal, parent_goal_ref=goal, parent_contribution_ref=p.measurement_ref,
        caller_next_item_ref='item.fixed_program_safe_origins', epoch=p.epoch,
        evidence_revision_ref=p.measurement_ref, model_revision_ref=stable_digest(p.models),
        model_status_ref=declared['model_status_ref'], event_owner_ref=p.measurement_ref,
        input_domain_complete=True, assumption_refs=tuple(declared['assumption_refs']))
    return FixedProgramRequest(scope=scope, operation_ref='mechanics.fixed_program_origin.robust_origin_domain',
        mode_ref='DOMAIN', requested_result_type='DMechanicalResult',
        node_bound=100000, depth_bound=4096, domain_bound=4096, time_bound_ms=2000,
        models=p.models, observed_word=p.models[0].word)


def annotate_banded_program_return(value: BandedProgramReturnInput) -> InteractionProbeAgenda:
    p, result = value.proposal, value.result
    hits = (tuple(result.values.get('common_observable_hits', ()))
        if result.domain_complete and result.values.get('robust_domain_complete') is True else ())
    points = {tuple(p.points[ref]) for ref in hits if ref in p.points}
    facts = {ref: FrozenMap({
        'candidate_is_observed_fixed_program_safe_origin': candidate.point is not None
            and tuple(candidate.point) in points,
        'fixed_program_measurement_ref': p.measurement_ref,
        'fixed_program_model_refs': tuple(m.model_ref for m in p.models),
        'fixed_program_assumptions': result.scope.assumption_refs,
        'fixed_program_glyph_track_binding': p.facts.get('diagnostics', ()),
    }) for ref, candidate in
        ((candidate.candidate_ref, candidate) for candidate in p.agenda.candidates)}
    return append_candidate_measurements(p.agenda, FrozenMap(facts),
        FrozenMap({'fixed_program_inverse_return': {
            'status': result.status, 'cause': result.cause, 'domain_complete': result.domain_complete,
            'safe_hit_count': len(hits), 'measurement_ref': p.measurement_ref}}))
