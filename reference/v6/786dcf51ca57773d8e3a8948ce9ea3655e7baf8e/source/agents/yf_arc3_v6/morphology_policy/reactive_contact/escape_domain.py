"""Partial, conditional geometry for a parent's reactive-contact question.

No game identifiers, dynamics, clock, action selection or primitive release.
Entity masks follow neutral_observer: local xy coordinates inside bbox xyxy.
The cardinal lattice below is a comparison prior, not an exhaustive response law.
"""
from collections import deque
from agents.yf_arc3_v5.capabilities.escape_topology import (
    EscapeTopologyDomain, EscapeTransition, measure_escape_topology,
)
from agents.yf_arc3_v5.capabilities.rigid_grasp_geometry import (
    occupied_union, translated_mask, support_collisions,
)
from agents.yf_arc3_v5.logos.types import thaw_json


class _Budget:
    def __init__(self): self.count = 0
    def visit(self, value): self.count += 1


def _mask(entity):
    box = entity['bbox']
    points = entity.get('mask')
    if not points:
        raise ValueError('exact occupied mask required; bbox is not a collision mask')
    result = tuple((box[0] + x, box[1] + y) for x, y in points)
    if any(not (box[0] <= x <= box[2] and box[1] <= y <= box[3]) for x, y in result):
        raise ValueError('mask is not local xy inside supplied bbox')
    return result


def _shift_box(box, delta):
    return [v + delta[i % 2] for i, v in enumerate(box)]


def project(scene, recipe, observation_ref, epoch):
    """Compare currently bound obstacle placements; incomplete means incomplete.

    ``free`` in V5 measurements means endpoint geometry clear under the supplied
    support prior only. No transition is declared physically complete. Missing
    support, unmodelled response kinds, sweeps and release mechanics stay unknown.
    """
    base = {'status': 'unknown', 'binding': {'observation_ref': observation_ref,
            'epoch': epoch}, 'current': None, 'placements': [], 'unknowns': [],
            'primitive_release_authorized': False, 'capture_established': False}
    if not scene or not observation_ref:
        return {**base, 'unknowns': ['current_scene_or_observation_missing']}
    tiles = scene['tiles']; pitch = scene['pitch']
    if not isinstance(pitch, int) or isinstance(pitch, bool) or pitch <= 0 or len(tiles) > 4096:
        return {**base, 'unknowns': ['unqualified_or_oversized_lattice']}
    body, peer = scene['body'], scene['peer']
    try:
        bm, pm = _mask(body), _mask(peer)
        stone_masks = [(s, _mask(s)) for s in scene['stones']]
    except (ValueError, KeyError, TypeError) as exc:
        return {**base, 'unknowns': ['occupied_mask_unavailable:' + str(exc)]}
    anchor = {k: (t['box'][0], t['box'][1]) for k, t in tiles.items()}
    by_anchor = {v: k for k, v in anchor.items()}
    if len(anchor) != len(by_anchor) or scene['bodykey'] not in tiles or scene['peerkey'] not in tiles:
        return {**base, 'unknowns': ['ambiguous_current_lattice_binding']}
    vectors = ((pitch, 0), (-pitch, 0), (0, pitch), (0, -pitch))
    support = {p: ('SUPPORTED', observation_ref) for k in scene['admitted']
               for p in ((x, y) for x in range(tiles[k]['box'][0], tiles[k]['box'][2] + 1)
                         for y in range(tiles[k]['box'][1], tiles[k]['box'][3] + 1))}
    # Occupied pixels are not silently turned into known terrain. Only a currently
    # revalidated common-translation method licenses a CONDITIONAL vacated support.
    matches = []
    # A current relation may have changed appearance and no longer be included
    # in the scene's discovery filter. Revalidate that known occurrence from
    # current measured entities, without lowering the filter for novel probes.
    candidates = list(stone_masks)
    for entity in scene.get('current_entities', ()):
        if any(list(entity['bbox']) == list(s['bbox']) and entity.get('signature') == s.get('signature') for s, _ in candidates):
            continue
        if recipe and list(entity['bbox']) == list(recipe.get('subject_box', ())):
            try: candidates.append((entity, _mask(entity)))
            except (ValueError, KeyError, TypeError): pass
    if recipe and recipe.get('status') == 'observed_nonpushing_common_translation' and recipe.get('scope') == epoch and recipe.get('evidence'):
        matches = [(s, m) for s, m in candidates
                   if list(s['bbox']) == list(recipe.get('subject_box', ()))
                   and s.get('palette_value') == recipe.get('subject_value', recipe.get('value'))
                   and list(recipe.get('offset', ())) == [s['bbox'][0] - body['bbox'][0], s['bbox'][1] - body['bbox'][1]]]
    subject = matches[0] if len(matches) == 1 else None
    if subject and (list(subject[0]['bbox']) == list(peer['bbox']) or list(subject[0]['bbox']) == list(body['bbox'])):
        subject = None
    if subject and not any(subject[0] is s for s, _ in stone_masks):
        stone_masks.append(subject)
    origin = anchor[scene['bodykey']]; peer_origin = anchor[scene['peerkey']]
    all_stones = occupied_union((), (), (p for _, m in stone_masks for p in m))

    def graph(obstacles, terrain, model_ref):
        edges = []; outgoing = {}; unknown = {}
        for key, (x, y) in anchor.items():
            outgoing[key] = []; unknown[key] = []
            at_origin = translated_mask(pm, (x - peer_origin[0], y - peer_origin[1]))
            origin_blocked, origin_missing = support_collisions(at_origin, (), terrain, obstacles)
            if origin_blocked or origin_missing:
                unknown[key].append({'reason': 'origin_configuration_not_geometrically_admitted'})
                continue
            for dx, dy in vectors:
                dest = by_anchor.get((x + dx, y + dy))
                if dest is None:
                    unknown[key].append({'delta': [dx, dy], 'reason': 'outside_observed_lattice'})
                    continue
                da = anchor[dest]; moved = translated_mask(pm, (da[0] - peer_origin[0], da[1] - peer_origin[1]))
                blocked, missing = support_collisions(moved, (), terrain, obstacles)
                status = 'blocked' if blocked else 'unknown' if missing else 'free'
                edges.append({'origin': key, 'destination': dest, 'status': status})
                if status == 'free': outgoing[key].append(dest)
                if status == 'unknown': unknown[key].append({'destination': dest, 'reason': 'unmeasured_support'})
        domain = EscapeTopologyDomain(model_ref=model_ref, actor_ref=peer['signature'],
            current_node_ref=scene['peerkey'], node_refs=tuple(sorted(tiles)),
            transitions=tuple(EscapeTransition(origin_ref=e['origin'], destination_ref=e['destination'],
                availability=e['status'], evidence_refs=(observation_ref,)) for e in edges),
            region_node_refs=tuple(sorted(tiles)), complete_successor_node_refs=(),
            completeness_evidence_refs=(), occupancy_scope='current_occupancy')
        budget = _Budget(); measured = thaw_json(measure_escape_topology(domain, budget))
        deadends = [{'node': k, 'sole_geometric_exit': v[0], 'unknown_successors': unknown[k],
                    'response_domain_complete': False} for k, v in outgoing.items() if len(v) == 1]
        return {'nodes': sorted(tiles), 'edges': edges, 'measurement': measured,
                'cul_de_sac_candidates': deadends, 'outgoing': outgoing,
                'unknown_successors': unknown, 'evaluations': budget.count,
                'scope': 'conditional_cardinal_endpoint_geometry_not_response_policy'}

    current = graph(occupied_union(bm, all_stones), support, 'escape.current.partial')
    base['current'] = current
    base['unknowns'] = ['peer_response_policy', 'response_clock_and_order',
        'noncardinal_or_unobserved_successors', 'swept_collision_between_endpoints',
        'support_below_opaque_occupants', 'detachment_or_deposit_effect', 'capture_condition']
    base['provenance'] = {'calculators': ['escape_topology.measure_escape_topology',
        'rigid_grasp_geometry.support_collisions', 'rigid_grasp_geometry.translated_mask',
        'rigid_grasp_geometry.occupied_union'], 'meaning_contract': 'policy.escape_topology_meaning',
        'model_prior': 'cardinal_lattice_endpoint_comparison_only',
        'evidence_refs': [observation_ref] + (list(recipe.get('evidence', ())) if subject else [])}
    if subject is None:
        return {**base, 'status': 'partial_geometry_only',
                'unknowns': base['unknowns'] + ['current_transport_recipe_not_uniquely_revalidated']}
    s, sm = subject
    # Conditional support at the vacated current occurrence; never asserted as a
    # newly observed floor law. Every offered placement keeps this falsifier.
    transport_support = dict(support)
    for p in sm: transport_support[p] = ('SUPPORTED', observation_ref)
    obstacles = occupied_union(pm, (), (p for other, m in stone_masks if other is not s for p in m))
    parents = {scene['bodykey']: None}; queue = deque(parents)
    while queue:
        key = queue.popleft(); x, y = anchor[key]
        for dx, dy in vectors:
            nxt = by_anchor.get((x + dx, y + dy))
            if nxt is None or nxt in parents: continue
            pos = anchor[nxt]; delta = (pos[0] - origin[0], pos[1] - origin[1])
            blocked, missing = support_collisions(translated_mask(bm, delta), translated_mask(sm, delta), transport_support, obstacles)
            if blocked or missing: continue
            parents[nxt] = key; queue.append(nxt)
    before = current['outgoing'][scene['peerkey']]
    for key in sorted(parents):
        if key == scene['bodykey']: continue
        pos = anchor[key]; delta = (pos[0] - origin[0], pos[1] - origin[1])
        body_box, subject_box = _shift_box(body['bbox'], delta), _shift_box(s['bbox'], delta)
        contained = [k for k, t in tiles.items() if t['box'][0] <= subject_box[0] <= subject_box[2] <= t['box'][2]
                     and t['box'][1] <= subject_box[1] <= subject_box[3] <= t['box'][3]]
        after = graph(occupied_union(translated_mask(bm, delta), translated_mask(sm, delta),
                      (p for other, m in stone_masks if other is not s for p in m)),
                      transport_support, 'escape.placement.' + key)
        route = [key]
        while parents[route[-1]] is not None: route.append(parents[route[-1]])
        route.reverse(); exits = after['outgoing'][scene['peerkey']]
        base['placements'].append({'body_key': key, 'subject_key': contained[0] if len(contained) == 1 else None,
            'body_box': body_box, 'subject_box': subject_box, 'delta': list(delta), 'route_keys': route,
            'geometry': {'peer_degree_before': len(before), 'peer_degree_after': len(exits),
                'removed_peer_destinations': sorted(set(before) - set(exits)),
                'added_peer_destinations': sorted(set(exits) - set(before)),
                'unknown_successors': after['unknown_successors'][scene['peerkey']]},
            'measurement': after['measurement'], 'cul_de_sac_candidates': after['cul_de_sac_candidates'],
            'conditional': True, 'release_authorized': False,
            'falsifiers': ['common_offset_changes', 'unexpected_occupancy_or_support',
                'peer_uses_unmodelled_transition', 'detachment_changes_geometry'],
            'scope': 'peer_held_at_current_pose_for_comparison_not_a_dynamics_prediction'})
    base['status'] = 'partial_geometry_with_conditional_placements'
    return base
