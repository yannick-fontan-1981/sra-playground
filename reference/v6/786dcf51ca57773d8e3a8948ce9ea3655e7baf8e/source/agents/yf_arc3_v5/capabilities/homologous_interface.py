"""Bounded framed-field geometry and observed local edits; no assigned roles.

SRC/DRM owns the panel/consigne hypothesis, the next experiment and its release.
These measurements neither identify actors nor assert independent resources.
"""
from collections import defaultdict

from pydantic import Field

from ..logos.types import FrozenMap, FrozenModel, Ref, stable_digest
from .agenda_measurement_transport import append_candidate_measurements
from .components import detect_components
from .contracts import ComponentExtractionInput, InteractionProbeAgenda, InteractionProbeInput
from .framed_masks import measure_enclosed_frame_groups


class InterfaceObservation(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.InterfaceObservation.v1'
    request: InteractionProbeInput
    agenda: InteractionProbeAgenda
    prior_model_rows: tuple[FrozenMap, ...] = Field(default=(), max_length=16)
    enumerate_current: bool = True


class InterfaceProposal(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.InterfaceProposal.v1'
    request: InteractionProbeInput
    agenda: InteractionProbeAgenda
    facts: FrozenMap
    rows: FrozenMap = Field(default_factory=FrozenMap)
    evidence_refs: tuple[Ref, ...] = ()
    alternative_refs: tuple[Ref, ...] = ('interface.unknown',)
    descriptive_facts: FrozenMap = Field(default_factory=lambda: FrozenMap({
        'interface.unknown': FrozenMap({'interface_unknown': True})}))


class InterfaceAdmission(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.InterfaceAdmission.v1'
    proposal: InterfaceProposal
    source_description_ref: Ref
    source_alternative_facts: FrozenMap


def _inside(inner, outer):
    return (outer[0] < inner[0] <= inner[2] < outer[2]
            and outer[1] < inner[1] <= inner[3] < outer[3])


def _pattern(frame, box):
    t, l, b, r = box
    return tuple(tuple(frame.rows[y][x] for x in range(l, r+1)) for y in range(t, b+1))


def _translate(box, anchor):
    return box[0]+anchor[0], box[1]+anchor[1], box[2]+anchor[0], box[3]+anchor[1]


def _layouts(frame, components, cfg):
    measured = measure_enclosed_frame_groups(frame, components, cfg)
    if not measured['enclosed_frame_groups_complete']:
        return (), False
    boxes = tuple(tuple(row['frame_bbox']) for row in measured['enclosed_frame_groups'])
    groups = defaultdict(list)
    for box in boxes:
        if any(_inside(child, box) for child in boxes):
            groups[(box[2]-box[0], box[3]-box[1])].append(box)
    # All families remain measured. A strict greatest extent is a descriptive
    # property, not an interpretation of the enclosed items as actors/controls.
    families = []
    for extent, panes in sorted(groups.items()):
        panes = tuple(sorted(panes))
        if len(panes) < cfg['minimum_equal_frame_group']:
            continue
        if any(not (a[2] < b[0] or b[2] < a[0] or a[3] < b[1] or b[3] < a[1])
               for i, a in enumerate(panes) for b in panes[i+1:]):
            continue
        local = []
        for pane in panes:
            local.append({(b[0]-pane[0], b[1]-pane[1], b[2]-pane[0], b[3]-pane[1])
                          for b in boxes if _inside(b, pane)})
        common = set.intersection(*local)
        # A nested dot inside a framed field is a separate measurement; keep
        # maximal common fields so that a dot and its surrounding box do not
        # masquerade as two distinct control questions.
        fields = tuple(sorted(b for b in common if not any(_inside(b, a) for a in common)))
        if fields:
            families.append({'panes': panes, 'fields': fields, 'extent': extent})
    if len(families) > cfg['maximum_layout_count']:
        return (), False
    for family in families:
        h, w = family['extent']
        family['strict_greatest_extent'] = all(
            h >= other['extent'][0] and w >= other['extent'][1]
            and family['extent'] != other['extent']
            for other in families if other is not family)
    return tuple(families), True


def measure_homologous_interface(value: InterfaceObservation) -> InterfaceProposal:
    v = value.request
    cfg = v.route_generation_policy.get('homologous_interface_measurement_contract', {})
    agenda = append_candidate_measurements(value.agenda, FrozenMap(),
        FrozenMap({'homologous_interface_active': False}))
    scope = str(v.observed_level_index)
    base = {'scope_counter': scope, 'interface_geometry_complete': False,
            'interface_unique_greatest_family': False,
            'interface_point_available': cfg.get('point_action_ref') in v.available_action_refs,
            'interface_available_common_input_count': len(
                set(v.available_action_refs) - set(cfg.get('nontrigger_action_refs', ()))),
            'committed_plan_present': bool(agenda.context_facts.get('committed_plan_present')),
            'incoming_declared_route_engagement_present': bool(agenda.context_facts.get('incoming_declared_route_engagement_present'))}
    base['response_after_bound_transaction'] = False
    args = {'request': v, 'agenda': agenda, 'facts': FrozenMap(base)}
    if not value.enumerate_current or not cfg:
        return InterfaceProposal(**args)
    frame = v.current_observed_frame or v.frame
    before = v.previous_action_observed_frame
    before_hash = stable_digest(before.rows) if before else None
    base['response_after_bound_transaction'] = bool(v.retained_physical_transition_receipt and any(
        row['snapshot']['scope_counter'] == scope
        and row['snapshot']['frame_hash'] == before_hash
        and row['snapshot']['selected']['kind'] == 'transaction'
        and row['snapshot']['selected']['action_ref'] == v.last_action_ref
        for row in value.prior_model_rows))
    cs = detect_components(ComponentExtractionInput(frame=frame, connectivity=4)).components
    layouts, complete = _layouts(frame, cs, cfg)
    greatest = tuple(row for row in layouts if row['strict_greatest_extent'])
    base.update(interface_geometry_complete=complete,
                interface_unique_greatest_family=len(greatest) == 1)
    if not complete or len(greatest) != 1:
        return InterfaceProposal(**{**args, 'facts': FrozenMap(base)})
    layout = greatest[0]
    shape = (frame.height, frame.width)
    geometry_token = stable_digest((shape, layout['panes']))
    frame_hash = stable_digest(frame.rows)
    prior_rows = tuple(row for row in value.prior_model_rows
                  if row['snapshot']['geometry_token'] == geometry_token
                  and row['snapshot']['scope_counter'] == scope)
    same = tuple(row for row in prior_rows if row['snapshot']['frame_hash'] == frame_hash
                 and row['snapshot']['frame_ref'] == v.current_observation_ref)
    contiguous = tuple(row for row in prior_rows if row['snapshot']['frame_hash'] == before_hash)
    previous_row = max(same or contiguous, key=lambda row: row['snapshot']['generation']) if same or contiguous else None
    previous = previous_row['snapshot'] if previous_row else None
    source_trial = previous_row.get('trial_pattern') if previous_row else None
    source_trial = tuple(tuple(r) for r in source_trial) if source_trial is not None else None
    receipt = v.retained_physical_transition_receipt
    rows = {}
    evidence = tuple(x for x in (v.current_observation_ref,
        receipt.checkpoint_ref if receipt else None,
        previous_row['witness_claim_ref'] if previous_row else None) if x is not None)
    # Only the field family actually selected by Source is retained after its
    # first edit. No pixel signature is interpreted as a particular command.
    fields = (tuple(previous['field']),) if previous else layout['fields']
    for field_index, field in enumerate(fields):
        anchors = tuple(_translate(field, pane) for pane in layout['panes'])
        current = tuple(_pattern(frame, box) for box in anchors)
        records = dict(previous['observed_edits']) if previous else {}
        transaction_observed = bool(previous and previous['transaction_observed'])
        response_qualified = bool(previous)
        response_pattern = None
        if previous and not same:
            response_qualified = bool(receipt and before and previous['frame_hash'] == before_hash)
            selected = previous['selected']
            if selected['kind'] == 'edit':
                index = selected['pane_index']
                point = tuple(selected['point'])
                pane = layout['panes'][index]
                changes = tuple((y, x) for y in range(frame.height) for x in range(frame.width)
                    if before.rows[y][x] != frame.rows[y][x]) if before else ()
                local = bool(changes) and all(pane[0] <= y <= pane[2] and pane[1] <= x <= pane[3]
                                                   for y, x in changes)
                response_qualified = response_qualified and v.last_action_ref == cfg['point_action_ref'] \
                    and v.last_point_position == point and local
                if response_qualified:
                    records[str(index)] = current[index]
                    response_pattern = current[index]
            else:
                transaction_observed = response_qualified and v.last_action_ref == selected['action_ref']
        # A restored or changed display does not retain a stale configured flag.
        records = {k: p for k, p in sorted(records.items()) if tuple(tuple(r) for r in p) == current[int(k)]}
        all_observed = len(records) == len(anchors)
        snapshot = {'geometry_token': geometry_token, 'scope_counter': scope,
            'panes': layout['panes'], 'field': field, 'frame_shape': shape,
            'frame_ref': v.current_observation_ref, 'frame_hash': frame_hash,
            'field_patterns': current,
            'observed_edits': records, 'transaction_observed': transaction_observed,
            'generation': previous['generation']+int(not same) if previous else 1}
        for pane_index, box in enumerate(anchors):
            point = ((box[0]+box[2])//2, (box[1]+box[3])//2)
            ref = 'interface.edit.'+stable_digest((geometry_token, field, pane_index))
            rows[ref] = {'kind': 'edit', 'point': point, 'pane_index': pane_index,
                'action_ref': cfg['point_action_ref'], 'field_index': field_index,
                'field_top': field[0], 'field_left': field[1],
                'pane_order': pane_index, 'edit_unobserved': str(pane_index) not in records,
                'snapshot': {**snapshot, 'selected': {'kind': 'edit', 'point': point,
                                                   'pane_index': pane_index}},
                'current_response_qualified': response_qualified or previous is None,
                'source_trial_pattern_present': source_trial is not None,
                'prior_source_trial_pattern': source_trial,
                'observed_response_pattern_present': response_pattern is not None,
                'observed_response_pattern': response_pattern,
                'current_pattern_equals_source_trial': source_trial is not None and current[pane_index] == source_trial,
                'current_pattern_equals_observed_response': response_pattern is not None and current[pane_index] == response_pattern,
                'all_patterns_equal_source_trial': source_trial is not None and all(p == source_trial for p in current),
                'all_patterns_equal_observed_response': response_pattern is not None and all(p == response_pattern for p in current),
                'all_edits_observed': all_observed, 'transaction_observed': transaction_observed}
        keys = tuple(sorted(set(v.available_action_refs) - set(cfg['nontrigger_action_refs'])))
        if len(keys) == 1:
            ref = 'interface.transaction.'+stable_digest((geometry_token, field, keys))
            rows[ref] = {'kind': 'transaction', 'action_ref': keys[0], 'point': None,
                'field_index': field_index, 'field_top': field[0], 'field_left': field[1],
                'pane_order': 0, 'edit_unobserved': False,
                'snapshot': {**snapshot, 'selected': {'kind': 'transaction', 'action_ref': keys[0]}},
                'current_response_qualified': response_qualified,
                'source_trial_pattern_present': source_trial is not None,
                'prior_source_trial_pattern': source_trial,
                'observed_response_pattern_present': response_pattern is not None,
                'observed_response_pattern': response_pattern,
                'all_patterns_equal_source_trial': source_trial is not None and all(p == source_trial for p in current),
                'all_patterns_equal_observed_response': response_pattern is not None and all(p == response_pattern for p in current),
                'all_edits_observed': all_observed, 'transaction_observed': transaction_observed}
    if len(rows) > cfg['maximum_description_count']:
        return InterfaceProposal(**{**args, 'facts': FrozenMap(base)})
    descriptions = {'interface.unknown': FrozenMap({'interface_unknown': True})}
    for ref, row in sorted(rows.items()):
        token = stable_digest((row['snapshot'], ref))
        descriptions[ref] = FrozenMap({**base, **row, 'interface_unknown': False,
            'frame_ref': v.current_observation_ref, 'witness_token': token})
    return InterfaceProposal(**{**args, 'facts': FrozenMap(base),
        'rows': FrozenMap(rows), 'evidence_refs': evidence,
        'alternative_refs': tuple(sorted(descriptions)), 'descriptive_facts': FrozenMap(descriptions)})


def append_homologous_interface(value: InterfaceAdmission) -> InteractionProbeAgenda:
    p = value.proposal
    declared = value.source_alternative_facts[value.source_description_ref]
    if declared.get('interface_description_admitted') is not True or value.source_description_ref not in p.rows:
        raise ValueError('Source has not admitted the current homologous-field question')
    row = p.rows[value.source_description_ref]
    from .interaction import _point_candidates, _attach_current_open_cavity_measurements
    from .open_cavity import measure_open_cavity_stop_geometry
    candidates = {c.candidate_ref: c for c in p.agenda.candidates}
    facts = dict(p.agenda.alternative_facts)
    deltas = dict(p.agenda.descriptive_delta_facts)
    if row['kind'] == 'edit':
        for c, measured in _point_candidates(p.request,
            frozenset(p.request.current_context_no_effect_candidate_refs),
            frozenset(p.request.tested_candidate_refs_without_resolution_plan),
            dict(p.agenda.context_facts), {}, {}, {}, requested_points=(tuple(row['point']),)):
            if c.action_ref != row['action_ref'] or c.point != tuple(row['point']):
                continue
            candidates[c.candidate_ref] = c
            facts[c.candidate_ref] = FrozenMap.overlay(measured, p.agenda.context_facts)
            deltas[c.candidate_ref] = measured
    ordered = tuple(candidates[k] for k in sorted(candidates))
    if len(ordered) > 64:
        # This optional extension cannot fit the unchanged bounded container.
        # Expose the mechanical refusal and retain every original alternative;
        # Source/DRM still selects from that domain with ordinary WHY/ACT guards.
        # No uninserted candidate, action or permit is manufactured here.
        return append_candidate_measurements(p.agenda, FrozenMap(), FrozenMap({
            'interface_agenda_extension_fits': False,
            'interface_agenda_extension_count': len(ordered),
            'interface_agenda_capacity': 64,
        }))
    extended = p.agenda.model_copy(update={'candidates': ordered,
        'alternative_refs': tuple(c.candidate_ref for c in ordered),
        'alternative_facts': FrozenMap(facts), 'descriptive_delta_facts': FrozenMap(deltas),
        'has_candidates': bool(ordered)})
    contribution = {}
    for c in ordered:
        active = c.action_ref == row['action_ref'] and c.point == row['point']
        contribution[c.candidate_ref] = FrozenMap({
            'homologous_interface_input_proposed': active,
            'homologous_interface_transaction_question': row['kind'] == 'transaction',
            'interface_witness_claim_refs': (declared['interface_witness_claim_ref'],),
            'interface_trial_pattern': declared['trial_pattern'],
            'interface_trial_pattern_present': declared['trial_pattern_present'],
            **{k: declared[k] for k in ('interface_witness_claim_ref', 'interface_question_ref',
                                       'interface_expected_relation_ref', 'interface_falsifier_refs')}})
    annotated = append_candidate_measurements(extended, FrozenMap(contribution),
                                        FrozenMap({'homologous_interface_active': True,
            'interface_current_question_frame_ref': p.request.current_observation_ref,
            'interface_current_question_action_ref': row['action_ref'],
            'interface_current_question_point': row['point'],
            'interface_current_question_claim_ref': declared['interface_witness_claim_ref'],
            'interface_current_question_expected_relation_ref': declared['interface_expected_relation_ref'],
            'interface_current_question_falsifier_refs': declared['interface_falsifier_refs']}))
    # Appended points must receive the same current neutral geometry as the
    # initial agenda. Do not invent a false cavity flag to bypass this query.
    return _attach_current_open_cavity_measurements(annotated,
        FrozenMap(measure_open_cavity_stop_geometry(p.request)))
