#!/usr/bin/env python3
"""Measure morphology facts/routes with byte-verified unchanged V5/V6.

All inputs are public rasters and primitive transition histories. No native
producer or game implementation supplies an expected result.
"""
from __future__ import annotations

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


def hashed(data):
    return hashlib.sha256(data).hexdigest()


def verify_source():
    verified = {}
    for path, item in json.loads(MANIFEST.read_text())['files'].items():
        digest = hashed((SOURCE / path).read_bytes())
        assert digest == item['sha256'], path
        verified[path] = digest
    return verified


VERIFIED = verify_source()
sys.path[:0] = [str(SOURCE), str(SOURCE / 'agents/yf_arc3_v6/laya_proto')]
from terminal_composition import Snapshot, identity, GoalAccessMemory
from neutral_observer import measure
from geometric_observer import rotate
from agents.yf_arc3_v6.morphology_policy.geometry import (
    pairs, pair_key, measure_routes, observed_selective_change, rigid_role)
from agents.yf_arc3_v6.morphology_policy.orthogonal_features import residuals, compare_features
from agents.yf_arc3_v6.morphology_policy.policy import MorphologyPolicy
from agents.yf_arc3_v6.morphology_policy.observed_meter import ObservedMeter
from agents.yf_arc3_v6.morphology_policy.adapter import MorphologyAdapter

SCENES = {}
SNAPSHOTS = {}
CASES = []
EXECUTED = Counter()
POLICY = MorphologyPolicy()


def plain(value):
    if isinstance(value, dict):
        return {key: plain(child) for key, child in value.items()}
    if isinstance(value, (list, tuple, bytes)):
        return [plain(child) for child in value]
    if isinstance(value, (set, frozenset)):
        return [plain(child) for child in sorted(value)]
    return value


def profile(frame, event, _arg):
    if event == 'call' and frame.f_code.co_filename.startswith(str(SOURCE) + '/'):
        code = frame.f_code
        EXECUTED[(Path(code.co_filename).relative_to(SOURCE).as_posix(), code.co_firstlineno, code.co_qualname)] += 1


def canvas(position=(6, 14), *, turn=1, other_color=3, modifier=True,
           modifier_position=(16, 14), extra_modifier=None, mark=None, pair_count=2,
           symmetric=False, pair_offset=(0, 0), meter_length=None):
    rows = [[0] * 40 for _ in range(32)]
    pattern = {(0, 0), (0, 1), (0, 2), (1, 2), (2, 2)}
    if symmetric:
        pattern = {(0, 0), (1, 0), (0, 1), (1, 1)}
    for index, (left, top) in enumerate(((2, 2), (24, 2), (24, 22))[:pair_count]):
        left += pair_offset[0]; top += pair_offset[1]
        shape = rotate(pattern, turn if index else 0)
        side = 6 if symmetric else 7
        for y in range(top, top + side):
            for x in range(left, left + side):
                rows[y][x] = 2
        for x, y in shape:
            rows[top + 2 + y][left + 2 + x] = other_color if index else 3
    for x, y, color in ((1, 20, 5), (37, 20, 6), (1, 29, 7)):
        rows[y][x] = color
    if modifier:
        for mx, my in [modifier_position] + ([extra_modifier] if extra_modifier else []):
            rows[my][mx] = 10
            rows[my][mx + 1] = 11
            rows[my + 1][mx] = 11
            rows[my + 1][mx + 1] = 10
    if mark:
        rows[mark[1]][mark[0]] = 13
    if meter_length is not None:
        for x in range(meter_length):
            rows[30][x] = rows[31][x] = 13
    if position is not None:
        for y in range(position[1], position[1] + 2):
            for x in range(position[0], position[0] + 2):
                rows[y][x] = 9
    return rows


def scene(name, position=(6, 14), *, transform=None, epoch=1, score=0,
          rows=None, available=None, **options):
    prior_profile = sys.getprofile()
    # Profile the producer calls, not the neutral observer's pixel loops. All
    # original observer files are still hash-verified before and after export.
    sys.setprofile(None)
    if rows is None:
        rows = canvas(position, **options)
    if transform:
        rows = transform(deepcopy(rows))
    available = available or ['ACTION1', 'ACTION2', 'ACTION3', 'ACTION4', 'ACTION5']
    packet = SimpleNamespace(frame_rows=rows, level=epoch, levels_completed=score,
                             frame_hash=hashed(json.dumps(rows).encode())[:16],
                             available_action_refs=available, state='NOT_FINISHED')
    observation, _ = measure(packet, len(SCENES) + 1, observation_scope='synthetic-morphology')
    snapshot = Snapshot.from_public(observation, rows)
    pair_inventory, parts = pairs(snapshot.rows)
    SCENES[name] = {'rows': rows, 'observation': observation,
                    'pairs': plain(pair_inventory), 'components': plain(parts)}
    SNAPSHOTS[name] = snapshot
    sys.setprofile(prior_profile)
    return name


def history(prefix, *, transform=None, epoch=1, score=0, **options):
    # Command names do not encode directions. Every learned displacement is
    # witnessed at two distinct positions; all frames are measured afresh.
    transitions = []
    for label, command, before, after in [
        ('right-a', 'ACTION1', (4, 14), (6, 14)),
        ('right-b', 'ACTION1', (8, 18), (10, 18)),
        ('down-a', 'ACTION2', (6, 10), (6, 12)),
        ('down-b', 'ACTION2', (10, 16), (10, 18)),
        ('left-a', 'ACTION3', (8, 14), (6, 14)),
        ('left-b', 'ACTION3', (12, 18), (10, 18)),
        ('up-a', 'ACTION4', (6, 14), (6, 12)),
        ('up-b', 'ACTION4', (10, 18), (10, 16)),
    ]:
        first = scene(prefix + ':' + label + ':before', before, transform=transform, epoch=epoch, score=score, **options)
        second = scene(prefix + ':' + label + ':after', after, transform=transform, epoch=epoch, score=score, **options)
        transitions.append([first, command, second])
    return transitions


def capture(name, transitions, current, *, contacts=None, tried=(), available=None,
            limit=16, action_budget=100, meter=None, station_method=None,
            feature_trials=None, expected_route=None, expected_plan=None):
    source_history = [(SNAPSHOTS[first], command, SNAPSHOTS[second]) for first, command, second in transitions]
    contacts = contacts or {}
    available = available or ['ACTION1', 'ACTION2', 'ACTION3', 'ACTION4', 'ACTION5']
    options = {'action_budget': action_budget, 'meter_forecast': meter,
               'station_method': station_method, 'feature_trials': feature_trials}
    facts, plans = measure_routes(source_history, SNAPSHOTS[current], limit,
                                 deepcopy(contacts), set(tried), set(available), **deepcopy(options))
    # This exact filtering is the source adapter boundary, not a new policy.
    admitted_facts = deepcopy(facts)
    for route in tuple(admitted_facts['routes']):
        if any(step['action_ref'] not in available for step in plans[route]['steps']):
            del admitted_facts['routes'][route]
    admitted_facts.update(meter_forecast=meter, extension_route=None, extension_kind=None)
    decision = plain(POLICY.evaluate(admitted_facts))
    if expected_route is not None:
        assert decision['route_key'] == expected_route, (name, decision, facts, plans)
    if expected_plan is not None:
        assert expected_plan in plans, (name, facts, plans)
    control = rigid_role(source_history, SNAPSHOTS[current], pairs(SNAPSHOTS[current].rows)[1])
    CASES.append({'id': name, 'history': transitions, 'current': current,
                  'contacts': [[list(key), plain(value)] for key, value in contacts.items()],
                  'tried': list(tried), 'available': list(available), 'limit': limit,
                  'actionBudget': action_budget, 'meterForecast': meter,
                  'stationMethod': station_method, 'featureTrials': plain(feature_trials), 'expectedFacts': plain(facts),
                  'expectedPlans': plain(plans), 'admittedFacts': plain(admitted_facts),
                  'expectedDecision': decision, 'sourceRigidControl': control is not None})
    return facts, plans, decision


def main():
    sys.setprofile(profile)
    base_history = history('base', meter_length=6)
    current = scene('base:current', meter_length=6)
    pairs.cache_clear()
    facts, plans, decision = capture('measured-modifier-access', base_history, current, expected_route='modifier')
    assert facts['control_attested'] and len(plans['modifier']['steps']) == 5
    capture('bounded-approach-retains-full-cost', base_history, current, limit=2, expected_route='modifier')
    capture('zero-prefix-budget', base_history, current, limit=0)
    capture('total-budget-cannot-reach-modifier', base_history, current, action_budget=3)
    capture('empty-history-does-not-attest-control', [], current)
    capture('one-position-per-axis-does-not-attest-control', base_history[::2], current)
    capture('no-current-pair', base_history, scene('no-pair', pair_count=1))
    capture('multiple-current-pairs-remain-ambiguous', base_history, scene('three-pairs', pair_count=3))
    capture('all-route-actions-must-remain-available', base_history, current, available=['ACTION2', 'ACTION3', 'ACTION4'])
    capture('already-tried-scoped-route', base_history, current, tried=[plans['modifier']['trial']])
    capture('foreign-trial-does-not-block-current-route', base_history, current, tried=['foreign-trial'], expected_route='modifier')
    capture('unknown-current-modifier-surface', base_history, scene('changed-modifier', modifier_position=(18, 14)))

    # The exact same approach prefix can fit while the full access does not.
    observed_meter = ObservedMeter()
    meter_scenes = [scene('meter:' + str(i), meter_length=length) for i, length in enumerate((14, 12, 10, 8))] + [current]
    forecasts = []
    for index, name in enumerate(meter_scenes):
        observed_meter.observe(1, SNAPSHOTS[name].ref, SNAPSHOTS[name].rows, primitive_index=index)
        forecasts.append(plain(observed_meter.forecast()))
    meter = observed_meter.forecast()
    assert meter['steps_before_empty'] == 3
    capture('short-prefix-does-not-falsify-full-access-cost', base_history, current, limit=2, meter=meter)
    assert CASES[-1]['expectedDecision']['route_key'] is None

    for label, transform in [
        ('rotated', lambda rows: [list(row) for row in zip(*rows[::-1])]),
        ('reflected', lambda rows: [row[::-1] for row in rows]),
        ('recolored', lambda rows: [[(value * 7 + 3) % 16 for value in row] for row in rows]),
        ('translated', lambda rows: [[0] * 44 for _ in range(2)] + [[0, 0] + row + [0, 0] for row in rows] + [[0] * 44 for _ in range(2)]),
    ]:
        moved = history(label, transform=transform)
        now = scene(label + ':current', transform=transform)
        capture('generic-' + label, moved, now, expected_route='modifier')

    # A real measured change in one framed pattern identifies the unchanged
    # peer. It is an observed contact witness, not a hand-written role flag.
    selective_before = scene('selective:before', (14, 14))
    selective_after = scene('selective:after', (16, 14), turn=0)
    peer = observed_selective_change(SNAPSHOTS[selective_before].rows, SNAPSHOTS[selective_after].rows,
                                     SCENES[selective_before]['pairs'][0])
    assert peer is not None
    aligned_history = history('aligned', turn=0)
    aligned_current = scene('aligned:current', (20, 10), turn=0)
    pair = SCENES[aligned_current]['pairs'][0]
    contacts = {(1, pair_key(pair)): {'peer': peer, 'observed': SNAPSHOTS[selective_after].ref}}
    capture('measured-selective-return-enables-peer-route', aligned_history, aligned_current,
            contacts=contacts, expected_route='peer')
    capture('aligned-without-selective-witness-retains-parent', aligned_history, aligned_current)
    capture('foreign-epoch-contact-is-not-a-current-peer', aligned_history, aligned_current,
            contacts={(2, pair_key(pair)): contacts[(1, pair_key(pair))]})

    # The complete source adapter is used as an oracle only on its base branch,
    # where continuation, station rearm and target extensions are not eligible.
    memory = GoalAccessMemory()
    memory.episode = [(SNAPSHOTS[a], cmd, SNAPSHOTS[b]) for a, cmd, b in base_history]
    adapter = MorphologyAdapter()
    commands = [{'action_ref': action} for action in ('ACTION1', 'ACTION2', 'ACTION3', 'ACTION4', 'ACTION5')]
    proposal = adapter.propose(memory, SCENES[current]['observation'], SCENES[current]['rows'], commands, 100)
    assert proposal and proposal['morphology']['target_extension'] is None
    sequence = [current] + [scene('family:step:' + str(i), (6 + 2 * i, 14), turn=0 if i == 5 else 1, meter_length=6) for i in range(1, 6)]
    def public(name):
        snapshot = SNAPSHOTS[name]
        return SimpleNamespace(frame_rows=snapshot.rows, frame_hash=snapshot.frame_hash,
                               level=snapshot.epoch, levels_completed=snapshot.score,
                               available_action_refs=SCENES[name]['observation']['available_action_refs'], state='NOT_FINISHED')
    family_steps = []
    for index, (first, second) in enumerate(zip(sequence, sequence[1:])):
        guard = adapter.before(proposal, index, public(first), SCENES[first]['observation'])
        response = adapter.after(proposal, index, public(second))
        event = adapter.record(proposal, index, public(first), public(second), SNAPSHOTS[second].ref, SNAPSHOTS[first].ref)
        family_steps.append({'before': first, 'after': second, 'guard': plain(guard),
                             'response': plain(response), 'event': plain(event)})
        assert guard['admitted']
    assert family_steps[-1]['event']['unchanged_peer'] is not None
    assert family_steps[-1]['event']['station_entry']['delta']
    alternative = scene('family:unchanged-return', (16, 14), turn=1, meter_length=6)
    other_adapter = MorphologyAdapter()
    contrary_event = other_adapter.record(proposal, 4, public(sequence[4]), public(alternative),
                                           SNAPSHOTS[alternative].ref, SNAPSHOTS[sequence[4]].ref)
    boundary = scene('family:boundary-return', (16, 14), turn=0, meter_length=6, epoch=2, score=1)
    boundary_adapter = MorphologyAdapter()
    boundary_event = boundary_adapter.record(proposal, 4, public(sequence[4]), public(boundary),
                                              SNAPSHOTS[boundary].ref, SNAPSHOTS[sequence[4]].ref)
    next_proposal = adapter.propose(memory, SCENES[sequence[-1]]['observation'], SCENES[sequence[-1]]['rows'], commands, 95)
    family = {'history': base_history, 'current': current, 'inputs': commands, 'remaining': 100,
              'proposal': plain(proposal), 'steps': family_steps,
              'expectedContacts': [[list(key), plain(value)] for key, value in adapter.contacts.items()],
              'expectedTried': sorted(adapter.tried), 'expectedFeatureTrials': plain(adapter.feature_trials), 'nextProposal': plain(next_proposal),
              'contrary': {'before': sequence[4], 'after': alternative, 'event': plain(contrary_event)},
              'boundary': {'before': sequence[4], 'after': boundary, 'event': plain(boundary_event)},
              'scope': 'Complete unchanged MorphologyAdapter base proposal, per-step guards/returns and selected contact acquisition; the historical state is supplied from independently measured public transitions.'}

    # Current station cycles require observed entry effects and a preserved
    # departure. Two real source acquisitions below provide those witnesses.
    station_adapter = MorphologyAdapter()
    station_before = sequence[4]
    station_first = scene('station:first-entry', (16, 14), turn=2, meter_length=6)
    entry_one = station_adapter.record(proposal, 4, public(station_before), public(station_first),
                                      SNAPSHOTS[station_first].ref, SNAPSHOTS[station_before].ref)
    station_exit = scene('station:preserved-exit', (14, 14), turn=2, meter_length=6)
    departures = station_adapter.observe_departures(SCENES[station_first]['observation'], SCENES[station_exit]['observation'],
                                                    SNAPSHOTS[station_first].rows, SNAPSHOTS[station_exit].rows,
                                                    {'action_ref': 'ACTION3'})
    assert len(departures) == 1 and departures[0]['preserved']
    station_history = base_history + [[station_before, 'ACTION1', station_first], [station_first, 'ACTION3', station_exit]]
    station_memory = GoalAccessMemory()
    station_memory.episode = [(SNAPSHOTS[a], cmd, SNAPSHOTS[b]) for a, cmd, b in station_history]
    reentry_proposal = station_adapter.propose(station_memory, SCENES[station_exit]['observation'], rows := SCENES[station_exit]['rows'], commands, 100)
    assert reentry_proposal and len(reentry_proposal['actions']) == 1
    station_current = scene('station:second-entry', (16, 14), turn=3, meter_length=6)
    entry_two = station_adapter.record(reentry_proposal, 0, public(station_exit), public(station_current),
                                      SNAPSHOTS[station_current].ref, SNAPSHOTS[station_exit].ref)
    station_history += [[station_exit, 'ACTION1', station_current]]
    station_memory.episode = [(SNAPSHOTS[a], cmd, SNAPSHOTS[b]) for a, cmd, b in station_history]
    station_facts, station_plans, _ = capture('observed-station-entry-departure-cycle', station_history, station_current,
             contacts=station_adapter.contacts, tried=station_adapter.tried, expected_route='modifier')
    assert len(station_plans['modifier']['steps']) == 2
    assert station_plans['modifier']['known_effectful_site']['hypothesis']
    station_proposal = station_adapter.propose(station_memory, SCENES[station_current]['observation'], SCENES[station_current]['rows'], commands, 100)
    assert station_proposal and len(station_proposal['actions']) == 2
    station = {'history': station_history, 'first': {'before': station_before, 'after': station_first, 'event': plain(entry_one)},
               'departure': {'before': station_first, 'after': station_exit, 'command': {'action_ref': 'ACTION3'}, 'events': plain(departures)},
               'second': {'before': station_exit, 'after': station_current, 'event': plain(entry_two), 'proposal': plain(reentry_proposal)},
               'current': station_current, 'proposal': plain(station_proposal)}

    # A participant can hide an observed border. It may never supply unseen
    # interior pixels or corners. Current visibility is remeasured each time.
    partial = scene('partial:border', (8, 4), turn=0)
    partial_facts, partial_plans, _ = capture('observed-border-occlusion-permits-one-interior-probe', aligned_history, partial,
                                            contacts=contacts, expected_route='peer')
    assert partial_facts['partial_correspondence'] and len(partial_plans['peer']['steps']) == 1
    capture('occluded-corner-cannot-be-imputed', aligned_history, scene('partial:corner', (8, 2), turn=0), contacts=contacts)
    assert not CASES[-1]['expectedFacts']['framed_pair']
    capture('occluded-interior-cannot-be-imputed', aligned_history, scene('partial:interior', (7, 4), turn=0), contacts=contacts)
    assert not CASES[-1]['expectedFacts']['framed_pair']

    # A measured selective palette return marks its actual surface as effectful;
    # ordinary traversability must not silently preserve a color it can change.
    feature_before = scene('feature:before', (14, 14), turn=1)
    feature_after = scene('feature:after', (16, 14), turn=1, other_color=4)
    feature_current = scene('feature:current', (6, 14), turn=1, other_color=4)
    feature_history = history('feature:motions', turn=1, other_color=4) + [[feature_before, 'ACTION1', feature_after]]
    from agents.yf_arc3_v6.morphology_policy.geometry import footprint
    delta = compare_features(SCENES[feature_before]['pairs'][0], SCENES[feature_after]['pairs'][0])
    assert delta['color_only_at_one_site'] and delta['orientation_preserved'] and delta['shape_preserved']
    feature_trial = {'arrived': footprint(SNAPSHOTS[feature_after].rows, (16, 14), (2, 2)) == footprint(SNAPSHOTS[feature_before].rows, (14, 14), (2, 2)),
                     'site': [16, 14], 'outcome': delta, 'epoch': 1,
                     'pair_ref': identity([1, pair_key(SCENES[feature_current]['pairs'][0])]),
                     'site_surface': identity(footprint(SNAPSHOTS[feature_before].rows, (16, 14), (2, 2))),
                     'before_ref': SNAPSHOTS[feature_before].ref, 'after_ref': SNAPSHOTS[feature_after].ref,
                     'scope': 'conditional_contact_witness'}
    capture('known-palette-effect-is-not-ordinary-transit', feature_history, feature_current,
            feature_trials={'observed-feature': feature_trial})
    assert len(CASES[-1]['expectedFacts']['observed_color_sites']) == 1 and not CASES[-1]['expectedPlans']
    capture('foreign-feature-effect-does-not-bind-current-site', feature_history, feature_current,
            feature_trials={'foreign-feature': {**feature_trial, 'epoch': 2}}, expected_route='modifier')
    assert not CASES[-1]['expectedFacts']['observed_color_sites']

    for name in ('base:current', 'three-pairs', 'no-pair'):
        assert plain(pairs(SNAPSHOTS[name].rows)[0]) == SCENES[name]['pairs']
    sys.setprofile(None)
    after = verify_source()
    assert after == VERIFIED
    used = {path for path, _, _ in EXECUTED}
    used.update(['agents/yf_arc3_v6/morphology_policy/morphology_policy.drm',
                 'agents/yf_arc3_v5/drm/morphology.drm'])
    result = {
        'schema': 'logos-engine.v6.morphology-measurements-reference.v1', 'commit': COMMIT,
        'generator': {'path': Path(__file__).relative_to(ROOT).as_posix(), 'sha256': hashed(Path(__file__).read_bytes())},
        'sourceVerification': {'verifiedOriginalFilesBefore': len(VERIFIED), 'verifiedOriginalFilesAfter': len(after),
                               'manifestSha256': hashed(MANIFEST.read_bytes())},
        'method': {'sourceModified': False, 'astTransformed': False, 'monkeyPatched': False,
                   'nativeExecution': False, 'inputs': 'Synthetic public raster observations and primitive histories, measured by the original neutral observer. No game or native decision source.'},
        'scope': 'Current pair measurements and current-state routes, measured local station cycles, border-only retention and selective feature-site exclusion. No remembered cross-epoch station method, general managed capacity or whole-common-caller parity claim.',
        'sourceHashes': {path: VERIFIED[path] for path in sorted(used)},
        'executedSourceFunctions': [{'path': path, 'line': line, 'function': name, 'calls': count}
                                  for (path, line, name), count in sorted(EXECUTED.items())],
        'scenes': SCENES, 'cases': CASES, 'family': family, 'station': station,
        'meter': {'scenes': meter_scenes, 'primitiveIndices': list(range(5)), 'forecasts': forecasts},
        'selective': {'before': selective_before, 'after': selective_after, 'pair': SCENES[selective_before]['pairs'][0], 'unchangedPeer': plain(peer)},
    }
    destination = ROOT / 'tests/fixtures/v6-morphology-measurements-reference.json.gz'
    destination.write_bytes(gzip.compress((json.dumps(result, ensure_ascii=False, separators=(',', ':')) + '\n').encode(), mtime=0))
    print(json.dumps({'cases': len(CASES), 'selected': sum(bool(row['expectedDecision']['route_key']) for row in CASES),
                      'scenes': len(SCENES), 'sourceFilesVerified': len(VERIFIED), 'bytes': destination.stat().st_size}))


if __name__ == '__main__':
    main()
