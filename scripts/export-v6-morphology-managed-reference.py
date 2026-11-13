#!/usr/bin/env python3
"""Execute immutable V6 managed projection/search on public synthetic inputs.

Retained methods, collection events and meter forecasts are explicit consumer
boundary inputs, not claims that this exporter learned a whole game. Geometry
integration cases acquire their control and surfaces from observed rasters.
"""
from collections import Counter
from copy import deepcopy
import gzip
import hashlib
import json
from pathlib import Path
import sys
from types import SimpleNamespace

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
COMMIT = '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e'
SOURCE = ROOT / 'reference/v6' / COMMIT / 'source'
MANIFEST = SOURCE.parent / 'manifest.json'


def hashed(data): return hashlib.sha256(data).hexdigest()


def verify_source():
    result = {}
    for name, item in json.loads(MANIFEST.read_text())['files'].items():
        actual = hashed((SOURCE / name).read_bytes())
        assert actual == item['sha256'], name
        result[name] = actual
    return result


VERIFIED = verify_source()
sys.path[:0] = [str(SOURCE), str(SOURCE / 'agents/yf_arc3_v6/laya_proto')]
from terminal_composition import Snapshot, identity
from neutral_observer import measure
from geometric_observer import rotate
from agents.yf_arc3_v6.morphology_policy.managed_projection import project_layout, footprint
from agents.yf_arc3_v6.morphology_policy.managed_capacity import search_managed_access
from agents.yf_arc3_v6.morphology_policy.geometry import measure_routes, pairs, rigid_role, pair_key
from agents.yf_arc3_v6.morphology_policy.collection_evidence import CollectionEvidence
from agents.yf_arc3_v6.morphology_policy.orthogonal_features import compare_features

SCENES = {}; SNAPSHOTS = {}; PROJECTIONS = []; SEARCHES = []; GEOMETRY = []; EXECUTED = Counter()


def plain(value):
    if isinstance(value, dict): return {key: plain(child) for key, child in value.items()}
    if isinstance(value, (list, tuple, bytes)): return [plain(child) for child in value]
    if isinstance(value, (set, frozenset)): return [plain(child) for child in sorted(value)]
    return value


def profile(frame, event, _arg):
    if event == 'call' and frame.f_code.co_filename.startswith(str(SOURCE) + '/'):
        code = frame.f_code
        EXECUTED[(Path(code.co_filename).relative_to(SOURCE).as_posix(), code.co_firstlineno, code.co_qualname)] += 1


def scene(name, rows, epoch=2):
    prior = sys.getprofile(); sys.setprofile(None)
    packet = SimpleNamespace(frame_rows=rows, level=epoch, levels_completed=1,
        frame_hash=hashed(json.dumps(rows).encode())[:16], available_action_refs=['ACTION1', 'ACTION2', 'ACTION3', 'ACTION4', 'ACTION5'], state='NOT_FINISHED')
    observation, _ = measure(packet, len(SCENES) + 1, observation_scope='synthetic-managed-morphology')
    snapshot = Snapshot.from_public(observation, rows)
    SCENES[name] = {'rows': rows, 'observation': observation}; SNAPSHOTS[name] = snapshot
    sys.setprofile(prior)
    return name


def collection(events):
    if events is None: return None
    result = CollectionEvidence()
    for event in events: result.apply_event(event)
    return result


def capture_search(name, inputs, *, status=None, reason=None, error=None):
    args = deepcopy(inputs)
    try:
        expected = search_managed_access(args['layout'], args['meter'], args['orientation'],
            action_budget=args['actionBudget'], max_prefix=args.get('maxPrefix', 16), max_states=args.get('maxStates', 100000))
        assert error is None, name
        if status is not None: assert expected['status'] == status, (name, expected)
        if reason is not None: assert expected.get('reason') == reason, (name, expected)
        SEARCHES.append({'id': name, **args, 'expected': plain(expected)})
    except ValueError as exception:
        assert str(exception) == error, (name, exception)
        SEARCHES.append({'id': name, **args, 'expectedError': str(exception)})


def capture_projection(name, inputs, *, positive=False):
    args = deepcopy(inputs); current = SNAPSHOTS[args['current']]
    result = project_layout(current, args['pair'], args['origin'], args['size'],
        {k: tuple(v) for k, v in args['motions'].items()}, {tuple(v) for v in args['surfaces']},
        {(tuple(p), cmd, tuple(q), tuple(patch)): witness for (p, cmd, q, patch), witness in args['unresolvedEdges']},
        args['marks'], args['stations'], args['stationMethod'], args['roleRefs'], args['available'],
        collection(args['collectionEvents']), args['observation'], weak_moves=args.get('weakMoves'),
        feature_sites={tuple(p): site for p, site in args.get('featureSites', [])})
    assert bool(result[0]) == positive, name
    PROJECTIONS.append({'id': name, **args, 'expected': plain(result)})
    return result


def search_cases():
    def occurrence(name, positions, **extra): return {'id': name, 'sites': positions, 'evidence': ['public-ref'], **extra}
    layout = {'level_epoch': 2, 'observation_ref': 'public-ref', 'start': [0, 1],
        'cells': [[x, y] for x in range(7) for y in range(3)],
        'moves': {'step-east': [1, 0], 'step-west': [-1, 0], 'step-south': [0, 1], 'step-north': [0, -1]},
        'modifiers': [occurrence('turn', [[2, 1]])], 'peers': [occurrence('goal', [[6, 1]])],
        'charges': [occurrence('first', [[1, 1]], status='hypothesis'), occurrence('second', [[4, 1]], status='observed')],
        'edge_exclusions': [], 'uncertain_edges': [], 'speculative_moves': []}
    meter = {'level_epoch': 2, 'observation_ref': 'public-ref', 'steps_before_empty': 2, 'capacity_steps': 6}
    orientation = {'level_epoch': 2, 'observation_ref': 'public-ref', 'modulus': 4, 'residual': 3, 'entry_delta': 1,
                   'evidence': ['entry-after'], 'status': 'revalidated_transfer_hypothesis'}
    base = {'layout': layout, 'meter': meter, 'orientation': orientation, 'actionBudget': 30}
    capture_search('two-independent-charges-and-entry', base, status='conditional_options')
    changed = deepcopy(base); changed['meter']['steps_before_empty'] = 6; changed['layout']['charges'] = []
    capture_search('modifier-seals-prefix', changed, status='conditional_options')
    changed['maxPrefix'] = 1
    capture_search('intermediate-prefix-before-effect', changed, status='conditional_options')
    changed = deepcopy(base); changed['layout']['start'] = [5, 1]; changed['orientation']['residual'] = 0
    capture_search('aligned-peer-seals-prefix', changed, status='conditional_options')
    changed = deepcopy(base); changed['layout']['uncertain_edges'] = [{'from': [0, 1], 'to': [1, 1], 'evidence': ['prior-nonlocal']}]
    capture_search('conditional-crossing-precedes-charge', changed, status='conditional_options')
    changed = deepcopy(base); del changed['layout']['moves']['step-east']; changed['layout']['speculative_moves'] = [
        {'delta': [1, 0], 'test_commands': ['unknown-z', 'unknown-a', 'unknown-a', 'step-west'], 'evidence': ['current']}]
    capture_search('opposite-control-contrast', changed, status='conditional_options')
    changed['layout']['speculative_moves'].extend([
        {'delta': [0, 1], 'test_commands': ['ignored-known-vector'], 'evidence': ['current']},
        {'delta': [2, 0], 'test_commands': ['ignored-unbound-opposite'], 'evidence': ['current']},
        {'delta': [1, 0], 'test_commands': ['ignored-no-evidence'], 'evidence': []}])
    capture_search('unsupported-control-hypotheses-ignored', changed, status='conditional_options')
    changed = deepcopy(base); changed['layout']['charges'][0]['status'] = 'consumed'
    capture_search('consumed-occurrence-cannot-recharge', changed, status='no_complete_conditional_route')
    changed = deepcopy(base); changed['meter']['steps_before_empty'] = 0
    capture_search('empty-meter-is-complete-no-route', changed, status='no_complete_conditional_route')
    changed = deepcopy(base); changed['actionBudget'] = 1
    capture_search('primitive-budget-is-complete-no-route', changed, status='no_complete_conditional_route')
    changed = deepcopy(base); changed['maxStates'] = 1
    capture_search('state-bound-remains-incomplete', changed, status='search_incomplete')
    changed = deepcopy(base); changed['maxStates'] = 80
    capture_search('partial-options-retain-incomplete-flag', changed)
    changed = deepcopy(base); changed['layout']['peers'].append(occurrence('second-goal', [[6, 1]]))
    capture_search('multiple-corresponding-goals-preserve-order', changed, status='conditional_options')
    changed = deepcopy(base); changed['layout']['charges'].append(occurrence('third', [[5, 1]], status='hypothesis'))
    capture_search('third-independent-charge-is-pruned', changed, status='conditional_options')
    changed = deepcopy(base); changed['layout']['edge_exclusions'] = [{'from': [0, 1], 'to': [1, 1]}]
    capture_search('excluded-edge-is-not-traversed', changed, status='no_complete_conditional_route')
    color = deepcopy(base); color['meter']['steps_before_empty'] = 6
    color['layout']['color_state'] = {'initial': 3, 'wanted': 4, 'mobile_site': [10, 10, 12, 12], 'features': [
        {'id': 'palette', 'sites': [[3, 1]], 'uncertain_sources': [], 'effects': [
            {'from_color': 3, 'to_color': 4, 'mobile_site': [10, 10, 12, 12], 'before': 'palette-before', 'after': 'palette-after'},
            {'from_color': 4, 'to_color': 3, 'mobile_site': [10, 10, 12, 12], 'before': 'return-before', 'after': 'return-after'}]}]}
    capture_search('palette-repair-and-recovery', color, status='conditional_options')
    changed = deepcopy(color); changed['layout']['color_state']['features'][0]['uncertain_sources'] = [3]
    capture_search('uncertain-palette-does-not-yield-repair', changed, status='no_complete_conditional_route')
    changed = deepcopy(color); changed['layout']['color_state']['features'][0]['effects'].append(
        {'from_color': 3, 'to_color': 5, 'mobile_site': [10, 10, 12, 12]})
    capture_search('contradictory-palette-does-not-yield-repair', changed, status='no_complete_conditional_route')
    changed = deepcopy(base); changed['layout']['moves'] = {'déplace': [1, 0], '😀': [-1, 0], '\ue000': [0, 1], 'Ω': [0, -1]}
    capture_search('unicode-command-order-is-canonical', changed, status='conditional_options')
    changed = deepcopy(base); del changed['meter']['level_epoch']; changed['meter']['capacity_status'] = None; changed['layout']['peers'][0]['status'] = None
    capture_search('optional-scope-default-and-explicit-null-status', changed, status='conditional_options')
    for target, field, value, reason in [
        ('meter', 'observation_ref', 'stale', 'unbound_or_stale_measurements'),
        ('orientation', 'level_epoch', 9, 'unbound_or_stale_measurements'),
        ('orientation', 'evidence', [], 'no_current_orientation_effect_hypothesis'),
        ('orientation', 'status', 'unqualified', 'no_current_orientation_effect_hypothesis'),
        ('orientation', 'entry_delta', 0, 'invalid_finite_domain'),
        ('orientation', 'modulus', 1, 'invalid_finite_domain'),
        ('orientation', 'residual', -1, 'invalid_finite_domain'),
        ('meter', 'capacity_steps', 1, 'invalid_finite_domain'),
        ('meter', 'steps_before_empty', True, 'invalid_finite_domain'),
        ('layout', 'start', [99, 99], 'participant_not_bound'),
        ('layout', 'modifiers', [], 'missing_current_goal_or_modifier'),
        ('layout', 'moves', {}, 'no_bound_translation'),
        ('layout', 'moves', {'no-motion': [0, 0]}, 'no_bound_translation')]:
        changed = deepcopy(base); changed[target][field] = value
        capture_search('refuse-' + target + '-' + field + '-' + str(len(SEARCHES)), changed, status='abstained', reason=reason)
    for field, value in [('actionBudget', 0), ('maxPrefix', 0), ('maxPrefix', 17), ('maxStates', 0)]:
        changed = deepcopy(base); changed[field] = value
        capture_search('refuse-bound-' + field + '-' + str(value), changed, status='abstained', reason='invalid_finite_domain')
    changed = deepcopy(color); changed['layout']['color_state']['features'][0]['sites'] = [[2, 1]]
    capture_search('refuse-overlapping-palette-site', changed, status='abstained', reason='ambiguous_palette_site')
    changed = deepcopy(base); changed['layout']['charges'][0]['sites'] = [[2, 1]]
    capture_search('refuse-overlapping-capacity-modifier', changed, status='abstained', reason='ambiguous_effect_site')
    changed = deepcopy(base); changed['layout']['charges'] = [occurrence('extra-' + str(i), [[i % 7, i // 7]], status='hypothesis') for i in range(13)]
    changed['layout']['modifiers'][0]['sites'] = [[2, 2]]
    capture_search('refuse-overlarge-charge-inventory', changed, status='abstained', reason='charge_occurrence_inventory_too_large')
    for field, value, error in [
        ('start', [True, 1], 'Expected an integer position or displacement'),
        ('modifiers', [occurrence('bad', [[2, 1]], evidence=[])], 'Occurrence requires a current site and evidence'),
        ('modifiers', [occurrence('same', [[2, 1]]), occurrence('same', [[3, 1]])], 'Duplicate occurrence identities'),
        ('modifiers', [occurrence('outside', [[99, 1]])], 'Effect site outside the projected motion graph'),
        ('charges', [occurrence('unknown', [[1, 1]], status='assumed')], 'Unqualified charge status')]:
        changed = deepcopy(base); changed['layout'][field] = value
        capture_search('malformed-' + field + '-' + str(len(SEARCHES)), changed, error=error)


def projection_cases():
    rows = [[0] * 9 for _ in range(5)]; rows[2][1] = 9; rows[2][3] = 5; rows[2][5] = 13; rows[2][7] = 3
    current = scene('projection-current', rows); snapshot = SNAPSHOTS[current]; observation = SCENES[current]['observation']
    pair = {'sites': [[0, 0, 0, 0], [7, 2, 7, 2]], 'scales': [1, 2], 'quarter_turns': 1, 'palette_values': [3, 3]}
    method = {'after': 'retained-entry', 'site_surface': identity((5,)), 'size': [1, 1], 'role_refs': ['moving-role'],
        'peer_scale': 2, 'observed_scales': [1, 2], 'delta': 1}
    base = {'current': current, 'pair': pair, 'origin': [1, 2], 'size': [1, 1],
        'motions': {'east': [1, 0], 'west': [-1, 0], 'south': [0, 1], 'north': [0, -1]}, 'surfaces': [[0]],
        'unresolvedEdges': [], 'marks': [[5, 2, 5, 2]], 'stations': [], 'stationMethod': method, 'roleRefs': ['moving-role'],
        'available': ['east', 'west', 'south', 'north', 'unknown'], 'collectionEvents': [], 'observation': observation, 'featureSites': []}
    capture_projection('retained-method-current-public-layout', base, positive=True)
    charge_signature = next(e['signature'] for e in observation['entities'] if e['bbox'] == [5, 2, 5, 2])
    changed = deepcopy(base); changed['collectionEvents'] = [{'id': 'gain-proof', 'kind': 'disappearance_confirmed', 'epoch': 1,
        'bbox': [1, 1, 1, 1], 'signature': charge_signature}]
    capture_projection('real-collection-owner-qualifies-appearance', changed, positive=True)
    changed['collectionEvents'].append({'id': 'gain-rival', 'kind': 'occurrence_persisted', 'epoch': 1, 'bbox': [2, 1, 2, 1], 'signature': charge_signature})
    capture_projection('collection-counterexample-keeps-role-conditional', changed, positive=True)
    changed = deepcopy(base); changed['collectionEvents'] = None
    capture_projection('absence-of-collection-owner-is-hypothesis', changed, positive=True)
    changed = deepcopy(base); changed['marks'] = [{'bbox': [5, 2, 5, 2], 'signature': charge_signature}]
    capture_projection('explicit-mark-signature', changed, positive=True)
    changed = deepcopy(base); changed['stations'] = [{'site_surface': method['site_surface'], 'entries': [
        {'after': 'current-entry', 'delta': 1, 'peer_preserved': True}]}]
    capture_projection('one-current-selective-entry', changed, positive=True)
    changed['stations'][0]['entries'].append({'after': 'another-current-entry', 'delta': 1, 'peer_preserved': True})
    capture_projection('independent-current-entries', changed, positive=True)
    changed['stations'][0]['entries'].append({'after': 'same-duplicate', 'delta': -1, 'peer_preserved': True})
    capture_projection('conflicting-current-deltas-refuse', changed)
    changed = deepcopy(base); changed['stations'] = [{'site_surface': method['site_surface'], 'entries': [
        {'after': 'bad-entry', 'delta': 1, 'peer_preserved': False}]}]
    capture_projection('changed-peer-refuses-method', changed)
    changed = deepcopy(base); changed['unresolvedEdges'] = [
        [[[1, 2], 'east', [2, 2], [0]], {'before': 'nonlocal-before', 'after': 'nonlocal-after'}],
        [[[2, 2], 'east', [3, 2], [0]], {'before': 'stale-before', 'after': 'stale-after'}]]
    capture_projection('nonlocal-edge-revalidates-current-footprint', changed, positive=True)
    changed = deepcopy(base); changed['motions'] = {'west': [-1, 0]}; changed['available'] = ['east', 'west', 'rival']
    capture_projection('finite-lattice-with-unidentified-opposite', changed, positive=True)
    changed['weakMoves'] = {'east': [1, 0], 'rival': [0, 1]}
    capture_projection('weak-motion-removes-incompatible-rival', changed, positive=True)
    changed = deepcopy(base); changed['available'] = [{'action_ref': name, 'data': {}} for name in base['available']]
    changed['available'].append({'action_ref': 'parameterized', 'data': {'x': 1}})
    capture_projection('plain-actions-exclude-parameterized-input', changed, positive=True)
    changed = deepcopy(base); changed['pair']['palette_values'] = [3, 4]; changed['featureSites'] = [[[4, 2],
        {'id': 'palette-site', 'sites': [[4, 2]], 'effects': [{'from_color': 3, 'to_color': 4, 'mobile_site': pair['sites'][0]}], 'uncertain_sources': []}]]
    capture_projection('observed-palette-site-enters-product-state', changed, positive=True)
    changed['featureSites'][0][0] = [3, 2]
    capture_projection('palette-and-modifier-overlap-refuses', changed)
    changed = deepcopy(base); changed['marks'] = [[3, 2, 3, 2]]
    capture_projection('mark-and-modifier-overlap-refuses', changed)
    changed = deepcopy(base); changed['marks'] = [[7, 2, 7, 2]]
    capture_projection('mark-and-peer-overlap-refuses', changed)
    changed = deepcopy(base); changed['stations'] = [{'site': [1, 2], 'size': [1, 1], 'site_surface': method['site_surface'],
        'footprint': identity((9,)), 'entries': []}]
    capture_projection('occupied-origin-retains-revalidated-station', changed, positive=True)
    changed = deepcopy(base); changed['origin'] = [0, 0]
    capture_projection('zero-coordinate-origin-is-valid', changed, positive=True)
    for target, field, value in [
        ('observation', 'level_epoch', 99), ('observation', 'observation_ref', 'stale'),
        ('stationMethod', 'after', None), ('stationMethod', 'site_surface', None), ('stationMethod', 'size', [2, 2]),
        ('stationMethod', 'role_refs', ['unrelated-role']), ('stationMethod', 'peer_scale', 9),
        ('stationMethod', 'observed_scales', [1, 3]), ('stationMethod', 'delta', 0), ('stationMethod', 'delta', True),
        ('pair', 'scales', [2, 2])]:
        changed = deepcopy(base); changed[target][field] = value
        capture_projection('refuse-' + target + '-' + field + '-' + str(len(PROJECTIONS)), changed)
    for field, value in [('stationMethod', None), ('motions', {}), ('available', []), ('pair', None)]:
        changed = deepcopy(base); changed[field] = value
        capture_projection('missing-' + field, changed)
    # A two-pixel footprint crosses only a partly occluded frame rim. The
    # source loops over a set of vectors, so uncertain-edge array order is not
    # a semantic ordering; tests compare that projection field as a multiset.
    rows = [[0] * 10 for _ in range(6)]
    for x, y, value in [(0, 0, 9), (1, 0, 9), (0, 1, 9), (1, 1, 9),
        (2, 2, 5), (3, 2, 6), (2, 3, 6), (3, 3, 5), (6, 2, 3), (7, 2, 3), (6, 3, 3), (7, 3, 3)]: rows[y][x] = value
    current = scene('projection-partial-rim', rows); changed = deepcopy(base)
    changed.update(current=current, observation=SCENES[current]['observation'], origin=[0, 0], size=[2, 2], marks=[], surfaces=[[0, 0, 0, 0]])
    changed['stationMethod'].update(size=[2, 2], site_surface=identity((5, 6, 6, 5)))
    changed['pair']['sites'][1] = [6, 2, 7, 3]
    result = capture_projection('partial-frame-rim-retains-conditional-crossing', changed, positive=True)
    assert any(row.get('kind') == 'partially_occluded_peer_approach' for row in result[0]['uncertain_edges'])


def geometry_canvas(position=(6, 14)):
    rows = [[0] * 40 for _ in range(32)]
    pattern = {(0, 0), (0, 1), (0, 2), (1, 2), (2, 2)}
    for index, (left, top, scale) in enumerate(((2, 2, 1), (20, 2, 2))):
        side = 3 * scale + 4
        for y in range(top, top + side):
            for x in range(left, left + side): rows[y][x] = 2
        for x, y in rotate(pattern, index):
            for dy in range(scale):
                for dx in range(scale): rows[top + 2 + y * scale + dy][left + 2 + x * scale + dx] = 3
    for x, y, color in ((1, 20, 5), (37, 20, 6), (1, 29, 7)): rows[y][x] = color
    for x, y, value in [(16, 14, 10), (17, 14, 11), (16, 15, 11), (17, 15, 10)]: rows[y][x] = value
    for x in [12, 13]: rows[14][x] = rows[15][x] = 13
    for x in range(12): rows[30][x] = rows[31][x] = 13
    for y in range(position[1], position[1] + 2):
        for x in range(position[0], position[0] + 2): rows[y][x] = 9
    return rows


def geometry_cases():
    transitions = []
    for index, (a, command, b) in enumerate([
        ((4, 14), 'ACTION1', (6, 14)), ((8, 18), 'ACTION1', (10, 18)),
        ((6, 10), 'ACTION2', (6, 12)), ((10, 16), 'ACTION2', (10, 18)),
        ((8, 14), 'ACTION3', (6, 14)), ((12, 18), 'ACTION3', (10, 18)),
        ((6, 14), 'ACTION4', (6, 12)), ((10, 18), 'ACTION4', (10, 16)),
        ((18, 2), 'ACTION1', (20, 2)), ((18, 10), 'ACTION1', (20, 10))]):
        before = scene('geometry-before-' + str(index), geometry_canvas(a)); after = scene('geometry-after-' + str(index), geometry_canvas(b))
        transitions.append([before, command, after])
    current = scene('geometry-current', geometry_canvas()); snap = SNAPSHOTS[current]; obs = SCENES[current]['observation']
    pair_inventory, parts = pairs(snap.rows); assert len(pair_inventory) == 1
    control = rigid_role([(SNAPSHOTS[a], c, SNAPSHOTS[b]) for a, c, b in transitions], snap, parts); assert control
    method = {'after': 'public-retained-entry', 'site_surface': identity((10, 11, 11, 10)), 'size': [2, 2],
        'role_refs': control[0], 'peer_scale': 2, 'observed_scales': [1, 2], 'delta': 1}
    meter = {'level_epoch': snap.epoch, 'observation_ref': snap.ref, 'steps_before_empty': 6, 'capacity_steps': 24,
        'current_units': 12, 'loss_per_step': 2, 'capacity_status': 'largest_measured_value', 'measured_strip': ['x', 30, 13, 'lo', 0]}
    base = {'current': current, 'history': transitions, 'limit': 16, 'contacts': [], 'tried': [], 'available': ['ACTION1', 'ACTION2', 'ACTION3', 'ACTION4', 'ACTION5'],
        'actionBudget': 100, 'stationMethod': method, 'meterForecast': meter, 'collectionEvents': [], 'observation': obs, 'featureTrials': None}

    def capture(name, inputs, positive=False):
        args = deepcopy(inputs)
        facts, plans = measure_routes([(SNAPSHOTS[a], c, SNAPSHOTS[b]) for a, c, b in args['history']], SNAPSHOTS[args['current']], args['limit'],
            {(epoch, pkey): value for (epoch, pkey), value in args['contacts']}, set(args['tried']), set(args['available']),
            action_budget=args['actionBudget'], meter_forecast=args['meterForecast'], station_method=args['stationMethod'],
            collection_evidence=collection(args['collectionEvents']), observation=args['observation'], feature_trials=args['featureTrials'])
        assert ('managed_access' in plans) == positive, (name, facts.get('managed_search'), list(plans))
        GEOMETRY.append({'id': name, **args, 'expectedFacts': plain(facts), 'expectedPlans': plain(plans)})
        return facts, plans

    facts, plans = capture('retained-method-reaches-managed-capacity-prefix', base, True)
    changed = deepcopy(base); changed['tried'] = [plans['managed_access']['trial']]
    capture('tried-managed-obligation-does-not-repeat', changed, 'managed_access' in measure_routes(
        [(SNAPSHOTS[a], c, SNAPSHOTS[b]) for a, c, b in changed['history']], snap, 16, {}, set(changed['tried']), set(changed['available']),
        action_budget=100, meter_forecast=meter, station_method=method, collection_evidence=CollectionEvidence(), observation=obs)[1])
    changed = deepcopy(base); changed['limit'] = 1
    capture('managed-prefix-keeps-complete-composition-cost', changed, True)
    changed = deepcopy(base); changed['actionBudget'] = 2
    capture('insufficient-composition-budget-does-not-invent-plan', changed)
    changed = deepcopy(base); changed['stationMethod'] = None
    capture('absent-station-method-preserves-ordinary-routes', changed)
    changed = deepcopy(base); changed['stationMethod']['role_refs'] = ['unrelated-role']
    capture('unbound-retained-role-preserves-ordinary-routes', changed)
    changed = deepcopy(base); changed['stationMethod']['delta'] = 0
    capture('null-entry-effect-preserves-ordinary-routes', changed)
    changed = deepcopy(base); changed['available'].remove('ACTION1')
    capture('unavailable-translation-can-discriminate-unknown-opposite', changed, True)
    changed['available'].remove('ACTION5')
    capture('unavailable-translation-without-rival-refuses-managed-prefix', changed)
    changed = deepcopy(base); changed['meterForecast']['steps_before_empty'] = 0
    capture('zero-reserve-cannot-start-composition', changed)
    changed = deepcopy(base); changed['available'].remove('ACTION1')
    failed_before = scene('unknown-opposite-before', geometry_canvas()); failed_after = scene('unknown-opposite-after', geometry_canvas())
    changed['history'].append([failed_before, 'ACTION5', failed_after])
    capture('current-contrary-opposite-control-refuses-prefix', changed)
    changed = deepcopy(base); changed['available'].remove('ACTION1'); changed['available'].append('ACTION0')
    positive_before = scene('unknown-positive-before', geometry_canvas((4, 18)))
    positive_after = scene('unknown-positive-after', geometry_canvas((6, 18)))
    changed['history'].append([positive_before, 'ACTION5', positive_after])
    _, selected = capture('distinct-prior-positive-ranks-unknown-control', changed, True)
    assert selected['managed_access']['steps'][-1]['action_ref'] == 'ACTION5'

    def palette_rows(rows):
        result = deepcopy(rows)
        for y in range(2, 12):
            for x in range(20, 30):
                if result[y][x] == 3: result[y][x] = 4
        for x, y, value in [(10, 14, 3), (11, 14, 4), (10, 15, 4), (11, 15, 3)]: result[y][x] = value
        return result

    color = deepcopy(base); names = set([current] + [name for a, _, b in transitions for name in [a, b]])
    recolored = {name: scene('palette-' + name, palette_rows(SCENES[name]['rows'])) for name in sorted(names)}
    color['history'] = [[recolored[a], cmd, recolored[b]] for a, cmd, b in transitions]
    color['current'] = recolored[current]; color['observation'] = SCENES[color['current']]['observation']
    color['meterForecast']['observation_ref'] = SNAPSHOTS[color['current']].ref
    before = scene('palette-entry-before', palette_rows(geometry_canvas((8, 14))))
    after_rows = palette_rows(geometry_canvas((10, 14)))
    # The local moving footprint occludes its contact texture during entry.
    for y in [14, 15]:
        for x in [10, 11]: after_rows[y][x] = 9
    for y in range(2, 9):
        for x in range(2, 9):
            if after_rows[y][x] == 3: after_rows[y][x] = 4
    after = scene('palette-entry-after', after_rows)
    first_pair = pairs(SNAPSHOTS[before].rows)[0][0]; second_pair = pairs(SNAPSHOTS[after].rows)[0][0]
    outcome = compare_features(first_pair, second_pair); assert outcome['color_only_at_one_site']
    color['history'].append([before, 'ACTION1', after])
    color['featureTrials'] = {'public-palette-entry': {'arrived': True, 'before_ref': SNAPSHOTS[before].ref, 'after_ref': SNAPSHOTS[after].ref,
        'epoch': snap.epoch, 'pair_ref': identity([snap.epoch, pair_key(first_pair)]), 'site': [10, 14],
        'site_surface': identity(footprint(SNAPSHOTS[before].rows, (10, 14), (2, 2))), 'outcome': outcome}}
    color_facts, color_plans = capture('public-palette-repair-binds-feature-reaccess', color, True)
    assert color_facts['feature_reaccess_bound'] and color_plans['managed_access']['physical_effect'] == 'feature_probe'
    changed = deepcopy(color); changed['actionBudget'] = 4
    recovery_facts, recovery_plans = capture('palette-then-capacity-remains-valid-partial-composition', changed, True)
    assert recovery_plans['managed_access']['composition_objective'] == 'feature_then_recovery'
    changed = deepcopy(color); changed['featureTrials']['public-palette-entry']['outcome']['color_only_at_one_site'] = False
    capture('unqualified-palette-effect-refuses-managed-composition', changed)

    absent_rows = geometry_canvas()
    for y in [14, 15]:
        for x in [12, 13]: absent_rows[y][x] = 0
    absent = scene('no-current-capacity-mark', absent_rows)
    changed = deepcopy(base); changed['current'] = absent; changed['observation'] = SCENES[absent]['observation']
    changed['meterForecast'].update(observation_ref=SNAPSHOTS[absent].ref, steps_before_empty=20)
    changed['collectionEvents'] = [{'id': 'pending-visible-gain', 'kind': 'gain_on_entry', 'epoch': snap.epoch, 'signature': 'prior-mark', 'bbox': [12, 14, 13, 15]}]
    capture('pending-collection-enables-current-managed-search', changed, True)
    changed['collectionEvents'] = [{'id': 'confirmed-current-gain', 'kind': 'disappearance_confirmed', 'epoch': snap.epoch, 'signature': 'prior-mark', 'bbox': [12, 14, 13, 15]}]
    capture('confirmed-current-collection-enables-managed-search', changed, True)
    changed['collectionEvents'][0]['epoch'] = snap.epoch - 1
    capture('foreign-collection-without-current-marks-does-not-start-search', changed)


def main():
    sys.setprofile(profile)
    search_cases(); projection_cases(); geometry_cases()
    sys.setprofile(None)
    after = verify_source(); assert after == VERIFIED
    used = {path for path, _, _ in EXECUTED}
    result = {'schema': 'logos-engine.v6.morphology-managed-reference.v1', 'commit': COMMIT,
        'generator': {'path': Path(__file__).relative_to(ROOT).as_posix(), 'sha256': hashed(Path(__file__).read_bytes())},
        'sourceVerification': {'verifiedOriginalFilesBefore': len(VERIFIED), 'verifiedOriginalFilesAfter': len(after), 'manifestSha256': hashed(MANIFEST.read_bytes())},
        'method': {'sourceModified': False, 'astTransformed': False, 'monkeyPatched': False, 'nativeExecution': False,
            'inputs': 'Synthetic public rasters and explicit retained consumer-boundary records. Geometry acquires control and surfaces from public transitions.',
            'unorderedProjectionFields': ['uncertain_edges: source iterates an unordered vector set; compare as multiset only in direct projection checks']},
        'scope': 'Stateless managed projection, finite conditional capacity search and their exact geometry.measure_routes insertion; no complete caller or game-success claim.',
        'sourceHashes': {path: VERIFIED[path] for path in sorted(used)},
        'executedSourceFunctions': [{'path': path, 'line': line, 'function': name, 'calls': count} for (path, line, name), count in sorted(EXECUTED.items())],
        'scenes': SCENES, 'searches': SEARCHES, 'projections': PROJECTIONS, 'geometry': GEOMETRY}
    destination = ROOT / 'tests/fixtures/v6-morphology-managed-reference.json.gz'
    destination.write_bytes(gzip.compress((json.dumps(result, ensure_ascii=False, separators=(',', ':')) + '\n').encode(), mtime=0))
    print(json.dumps({'searches': len(SEARCHES), 'projections': len(PROJECTIONS), 'geometry': len(GEOMETRY),
        'sourceFilesVerified': len(VERIFIED), 'bytes': destination.stat().st_size}))


if __name__ == '__main__': main()
