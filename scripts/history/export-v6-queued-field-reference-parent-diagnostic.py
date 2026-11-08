#!/usr/bin/env python3
"""Export unchanged queue contracts and complete common envelopes on public returns.

The exporter does not run a game. Its source component replay consumes the cold
opaque-host packets retained by probe-v6-queued-field-original.py. Source MRO
acquisition is tested independently of original global caller selection.
"""
from __future__ import annotations

import copy
import gzip
from importlib.util import module_from_spec, spec_from_file_location
import json
from pathlib import Path
import sys
import time
from types import SimpleNamespace

sys.dont_write_bytecode = True
spec = spec_from_file_location('queue_probe', Path(__file__).with_name('probe-v6-queued-field-original.py'))
helper = module_from_spec(spec)
spec.loader.exec_module(helper)
from common_observed_compositions import ObservedCompositionConstraint
from observed_input_domain import ObservedInputDomain
from queued_field_observation import measure, board
from queued_field_methods import typed, values, models, placement, closure, receipt
from queued_field_models import active_member_count, portable_hypothesis, translation_premise
from queued_field_search import preparations, choose
from queued_field_access import QueuedFieldAccess, grid

ROOT = helper.ROOT
PROBE_PATH = 'tests/fixtures/v6-queued-field-original-public.json.gz'
DISCOVERY_PATH = 'tests/fixtures/v6-linked-packet-initial-public.json.gz'
PROBE = json.loads(gzip.decompress((ROOT / PROBE_PATH).read_bytes()))
DISCOVERY = json.loads(gzip.decompress((ROOT / DISCOVERY_PATH).read_bytes()))
CASES = []


def plain(value):
    return helper.plain(copy.deepcopy(value))


def add(name, operation, arguments, result):
    CASES.append({'id': name, 'operation': operation, 'arguments': plain(arguments), 'expected': plain(result)})


def controlled_cases():
    for shape in ([2, 2], [3, 4], [5, 3]):
        for gravity in (-1, 1):
            add(f'models:{shape}:{gravity}', 'models', {'shape': shape, 'gravity': gravity}, models(shape, gravity))
    empty = [[None] * 3 for _ in range(5)]
    ledge = copy.deepcopy(empty); ledge[3][1] = 7
    top = copy.deepcopy(empty); top[0][1] = 7
    bottom = copy.deepcopy(empty); bottom[-1][1] = 7
    for name, field, bundle, column, gravity in [
        ('down_order', empty, [2, 3], 1, 1), ('up_order', empty, [2, 3], 1, -1),
        ('ledge_down', ledge, [2, 3], 1, 1), ('ledge_up', ledge, [2, 3], 1, -1),
        ('spawn_blocked_down', top, [2, 3], 1, 1), ('spawn_blocked_up', bottom, [2, 3], 1, -1),
        ('left_outside', empty, [2], -1, 1), ('right_outside', empty, [2], 3, 1),
        ('empty_bundle', empty, [], 0, 1), ('too_many_members', empty, [2] * 6, 0, 1),
        ('full_height', empty, [2, 3, 4, 5, 6], 0, 1),
    ]:
        args = {'grid': field, 'bundle': bundle, 'column': column, 'gravity': gravity}
        add('placement:' + name, 'placement', args, placement(**args))
    for name, field, directions, minimum, gravity in [
        ('empty', [[None, None], [None, None]], [[0, 1]], 2, 1),
        ('horizontal', [[None] * 3, [2, 2, 2]], [[0, 1]], 3, 1),
        ('vertical', [[2, 3], [2, 4], [2, 5]], [[1, 0]], 3, 1),
        ('main_diagonal', [[2, None, None], [None, 2, None], [None, None, 2]], [[1, 1]], 3, 1),
        ('other_diagonal', [[None, None, 2], [None, 2, None], [2, None, None]], [[1, -1]], 3, 1),
        ('overlap_union', [[2, 2, 2], [2, 3, 4], [2, 5, 6]], [[0, 1], [1, 0]], 3, 1),
        ('cascade_down', [[3, None, 3], [2, 3, 2], [2, 2, 2]], [[0, 1]], 3, 1),
        ('cascade_up', [[2, 2, 2], [2, 3, 2], [3, None, 3]], [[0, 1]], 3, -1),
        ('different_values', [[2, 3, 4], [3, 4, 2]], [[0, 1], [1, 0]], 3, 1),
    ]:
        model = {'directions': directions, 'minimum_line': minimum, 'gravity': gravity}
        args = {'grid': field, 'model': model}
        add('closure:' + name, 'closure', args, closure(**args))
        add('receipt:' + name, 'receipt', {'obs': {'observation_ref': 'controlled-queue:' + name, 'level_epoch': 2},
                                         'grid': field, 'model': model, 'evidence': ['public-before', 'public-after']},
            receipt({'observation_ref': 'controlled-queue:' + name, 'level_epoch': 2}, field, model, ['public-before', 'public-after']))
    controls = {'ACTION1': {'kind': 'reorder', 'permutations': [[1, 0]]},
                'ACTION2': {'kind': 'translate', 'delta': -1}, 'ACTION3': {'kind': 'translate', 'delta': 1},
                'ACTION4': {'kind': 'receive'}}
    search_field = [[None] * 3 for _ in range(4)]
    for name, field, laws, state in [
        ('free', search_field, controls, None),
        ('repeated_members', search_field, controls, None),
        ('blocked_current_rows', [[7, None, None], [8, None, None], [None] * 3, [None] * 3], controls, None),
        ('ambiguous_permutation', search_field, {**controls, 'ACTION1': {'kind': 'reorder', 'permutations': [[0, 1], [1, 0]]}}, None),
        ('exact_refuted_displacement', search_field, controls, {'key': 'controlled-key', 'refuted_translations': [
            {'premise_ref': translation_premise('controlled-key', search_field, [2, 3], 1, 'ACTION2')}]}),
    ]:
        args = {'bundle': [2, 2] if name == 'repeated_members' else [2, 3], 'column': 1, 'controls': laws,
                'width': 3, 'field': field, 'active_rows': [0, 1], 'state': state}
        add('preparations:' + name, 'preparations', args, preparations(**args))
    scene = {'geometry': {'origin': [1, 1], 'shape': [3, 4], 'size': [2, 2], 'pitch': [4, 4]},
             'grid': [[0, 2, 0], [0, 3, 0], [0, 0, 0], [2, 0, 2]],
             'mark': {'column': 1, 'rows': [0, 1], 'values': [2, 3]},
             'preview_alternatives': [{'orientation': [True, True], 'members': [[2, 3], [3, 2]]}],
             'empty_appearance_hypothesis': 0}
    state = {'key': 'controlled-key', 'epoch': 1, 'geometry': scene['geometry'], 'controls': controls, 'gravity': 1,
             'empty': 0, 'closure_models': [{'directions': [[0, 1]], 'minimum_line': 2, 'gravity': 1}],
             'preview_orientations': [[True, True]], 'evidence': ['controlled-acquisition'],
             'restorations': [], 'attempts': [], 'refuted_translations': [], 'active_member_count': 2}
    add('board:remove_current_envelope', 'board', {'scene': scene, 'empty': 0}, board(scene, 0))
    for name, current, remaining, node_bound, depth_bound, expired in [
        ('three_receipts', state, 16, 24000, 3, False), ('one_receipt', state, 16, 24000, 1, False),
        ('one_action', state, 1, 24000, 3, False), ('zero_actions', state, 0, 24000, 3, False),
        ('exhausted_nodes', state, 16, 0, 3, False), ('bounded_one_node', state, 16, 1, 3, False),
        ('expired_deadline', state, 16, 24000, 3, True),
        ('incompatible_models', {**state, 'closure_incompatible': True}, 16, 24000, 3, False),
        ('two_receive_controls', {**state, 'controls': {**controls, 'ACTION5': {'kind': 'receive'}}}, 16, 24000, 3, False),
        ('unacquired_closure_alternatives', {k: v for k, v in state.items() if k != 'closure_models'}, 16, 24000, 2, False),
    ]:
        args = {'scene': scene, 'state': current, 'remaining': remaining, 'node_bound': node_bound,
                'depth_bound': depth_bound, 'deadline_expired': expired}
        add('choose:' + name, 'choose', args,
            choose(scene, current, remaining, 0 if expired else time.perf_counter() + 120, node_bound, depth_bound))
    for name, current in [('none', None), ('retained', state), ('unknown', {}),
                          ('ambiguous', {**state, 'active_member_count': 3})]:
        add('active_count:' + name, 'active_count', {'state': current}, active_member_count(current))
    observation = {'observation_ref': 'controlled-new-epoch', 'level_epoch': 2, 'available_action_refs': list(controls)}
    for name, previous, current_scene, obs in [
        ('accepted_conditional', state, scene, observation), ('same_epoch', state, scene, {**observation, 'level_epoch': 1}),
        ('different_cardinality', state, {**scene, 'mark': {**scene['mark'], 'values': [2, 3, 4]}}, observation),
        ('changed_pitch', state, {**scene, 'geometry': {**scene['geometry'], 'pitch': [5, 4]}}, observation),
        ('no_closure', {k: v for k, v in state.items() if k != 'closure_models'}, scene, observation),
        ('no_receiver', state, scene, {**observation, 'available_action_refs': ['ACTION1', 'ACTION2', 'ACTION3']}),
        ('unknown_empty', state, {**scene, 'empty_appearance_hypothesis': None}, observation),
    ]:
        add('portable:' + name, 'portable', {'previous': previous, 'scene': current_scene, 'observation': obs},
            portable_hypothesis(previous, current_scene, obs))


def public_contracts():
    family = ObservedCompositionConstraint()
    domain = ObservedInputDomain(4096)
    boundary = 0
    consumed = 0
    envelopes = []
    aliases = []
    assert PROBE['status'] == 'passed' and PROBE['sessionCount'] == 1
    for prefix_index, original in enumerate(PROBE['prefixes']):
        before = PROBE['packets'][consumed]
        observation, rows = before['observation'], before['packet']['frame_rows']
        remaining = PROBE['budget']['levelActions'] - (consumed - boundary)
        family.level_deadline = time.perf_counter() + 600
        proposal = family.queue_propose(observation, rows, domain.candidates(observation), remaining, PROBE['policy'])
        assert proposal is not None, prefix_index
        unbound = plain(proposal)
        family.bind(proposal, domain)
        assert plain(proposal) == original['proposal'], ('common proposal', prefix_index)
        assert helper.state(family.memory)['projection'] == original['beforeState']['projection'], ('before state', prefix_index)
        envelope = {'prefixIndex': prefix_index, 'firstAction': consumed + 1, 'unboundProposal': unbound,
                    'proposal': plain(proposal), 'beforeState': helper.state(family.memory), 'steps': []}
        envelopes.append(envelope)
        for step in original['steps']:
            index = step['index']
            before, after = PROBE['packets'][consumed], PROBE['packets'][consumed + 1]
            obs, later = before['observation'], after['observation']
            first, second = before['packet']['frame_rows'], after['packet']['frame_rows']
            prior_events = plain(family.memory.queue_events)
            guard = family.before(proposal, index, SimpleNamespace(**before['packet']), obs)
            outcome = family.after(proposal, index, obs, later, first, second)
            record = family.record(obs, later, proposal['actions'][index], first, second, proposal, index,
                                   frames=after['packet']['frame_packet'])
            assert guard == step['beforeGuard'] and outcome == step['outcome'], ('common guards', prefix_index, index)
            assert helper.state(family.memory)['projection'] == step['afterState']['projection'], ('common own state', prefix_index, index)
            for old_index, old_event in enumerate(prior_events):
                if old_event != plain(family.memory.queue_events[old_index]):
                    aliases.append({'actionIndex': consumed + 1, 'eventIndex': old_index,
                                    'before': old_event, 'after': plain(family.memory.queue_events[old_index])})
            envelope['steps'].append({'index': index, 'actionIndex': consumed + 1, 'beforeGuard': plain(guard),
                'outcome': plain(outcome), 'record': plain(record), 'state': plain(family.state()),
                'ownState': helper.state(family.memory), 'ownEvents': plain([e for e in record['events'] if e['kind'] == 'observed_queue_field_model'])})
            if later['levels_completed'] > obs['levels_completed']:
                boundary = consumed + 1
            consumed += 1
    assert consumed == PROBE['actions'] == 45
    return envelopes, aliases


def main():
    controlled_cases()
    envelopes, aliases = public_contracts()
    measurements = [{'game': item['game'], 'expected': plain(measure(item['packet']['frame_rows']))}
                    for item in DISCOVERY['games']]
    assert helper.verify_source_manifest() == helper.VERIFIED_PINNED_SOURCE
    result = {'schema': 'logos-engine.v6.queued-field-reference.v1', 'sourceCommit': helper.COMMIT,
              'qualification': {'sourceModified': False, 'gameHostRunByExporter': False,
                  'commonEnvelope': 'True ObservedCompositionConstraint methods over recorded public returns; not original full common caller selection.',
                  'numerics': 'Exact finite arithmetic values; Python mean rank has float spelling, including integral floats. Derived proposal identity is separately verified and is not asserted Python-identical.',
                  'mechanics': 'Occurrence-preserving placement and line union/compaction/cascade projection from the pinned V5 kernel. Conditional model predictions are not physical laws or official terminal proofs.'},
              'pinnedSourceFilesVerifiedBeforeImport': len(helper.VERIFIED_PINNED_SOURCE),
              'sourceHashes': helper.source_hashes(),
              'sourceMro': [cls.__name__ for cls in type(ObservedCompositionConstraint().memory).__mro__],
              'originalPublicProbe': {'path': PROBE_PATH, 'sha256': helper.hashed((ROOT / PROBE_PATH).read_bytes())},
              'initialDiscovery': {'path': DISCOVERY_PATH, 'sha256': helper.hashed((ROOT / DISCOVERY_PATH).read_bytes())},
              'policy': PROBE['policy'], 'cases': CASES, 'initialMeasurements': measurements,
              'commonEnvelopes': envelopes, 'sourceAliasing': aliases,
              'generator': str(Path(__file__).relative_to(ROOT)), 'generatorSha256': helper.hashed(Path(__file__).read_bytes())}
    destination = ROOT / 'tests/fixtures/v6-queued-field-reference.json.gz'
    if destination.exists():
        raise FileExistsError(destination)
    destination.write_bytes(gzip.compress(json.dumps(result, sort_keys=True, separators=(',', ':')).encode(), mtime=0))
    print(json.dumps({'output': str(destination.relative_to(ROOT)), 'cases': len(CASES), 'initialMeasurements': len(measurements),
                      'commonPrefixes': len(envelopes), 'commonAcquisitions': sum(len(item['steps']) for item in envelopes),
                      'ownEvents': len(envelopes[-1]['steps'][-1]['ownState']['projection']['queue_events']),
                      'sourceAliasMutations': len(aliases), 'sourceFiles': len(result['sourceHashes'])}), flush=True)


if __name__ == '__main__':
    main()
