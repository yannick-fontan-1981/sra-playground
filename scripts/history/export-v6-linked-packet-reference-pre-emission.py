#!/usr/bin/env python3
"""Export unchanged Linked Packet contracts over already recorded public returns.

No game is run here. Full family acquisition is distinguished from selection by
the original global caller. Floating values are exported without quantization.
"""
from __future__ import annotations

import copy
import gzip
from importlib.util import module_from_spec, spec_from_file_location
import json
import math
from pathlib import Path
import sys
import time
from types import SimpleNamespace

sys.dont_write_bytecode = True
spec = spec_from_file_location('linked_probe', Path(__file__).with_name('probe-v6-linked-packet-original.py'))
helper = module_from_spec(spec)
spec.loader.exec_module(helper)
from common_observed_compositions import ObservedCompositionConstraint
from observed_input_domain import ObservedInputDomain
from linked_support_observation import merge_boxes, foreground_groups, phase, selection_recipient
from packet_line_observation import line_fit, measure_packet
from packet_ray_methods import lattice, estimate_phase, ratio

ROOT = helper.ROOT
PROBE_PATH = 'tests/fixtures/v6-linked-packet-original-public.json.gz'
DISCOVERY_PATH = 'tests/fixtures/v6-linked-packet-initial-public.json.gz'
PROBE = json.loads(gzip.decompress((ROOT / PROBE_PATH).read_bytes()))
CASES = []


def add(name, operation, arguments, result):
    CASES.append({'id': name, 'operation': operation, 'arguments': helper.plain(arguments), 'expected': helper.plain(result)})


def numerical_cases():
    for name, points in [
        ('empty', []), ('one_point', [[1, 1]]), ('horizontal', [[2, 3], [3, 3], [4, 3], [5, 3]]),
        ('vertical', [[3, 2], [3, 3], [3, 4], [3, 5]]), ('diagonal', [[1, 2], [2, 3], [3, 4], [4, 5]]),
        ('curved_rejected', [[0, 0], [1, 4], [5, 0]]), ('duplicate_rejected', [[2, 2], [2, 2]]),
        ('raster_staircase', [[0, 0], [1, 1], [2, 1], [3, 2], [4, 2], [5, 3]]),
    ]: add('line:' + name, 'line', {'points': points}, line_fit(points))
    for value in [-3.5, -2.5, -1.5, -0.5, 0.5, 1.5, 2.5, 3.5, 1.4999999999999998, 1.5000000000000002]:
        add('round:' + str(value), 'round', {'value': value}, round(value))
        add('ratio:' + str(value), 'ratio', {'value': value / 1000000}, ratio(value / 1000000))
    for name, boxes in [('empty', []), ('separate', [[0, 0, 2, 2], [5, 5, 7, 7]]),
                        ('transitive', [[0, 0, 2, 2], [6, 0, 8, 2], [3, 1, 5, 3]]),
                        ('duplicate', [[1, 1, 3, 3], [1, 1, 3, 3]])]:
        add('boxes:' + name, 'boxes', {'boxes': boxes}, merge_boxes(boxes))
    raster = [[0, 0, 0, 0, 0], [0, 1, 0, 0, 0], [0, 0, 2, 0, 0], [0, 0, 0, 0, 3], [0, 0, 0, 0, 0]]
    add('foreground:diagonal_connectivity', 'foreground', {'rows': raster, 'background': 0, 'bounds': [0, 0, 4, 4]}, foreground_groups(raster, 0, [0, 0, 4, 4]))
    control = {'point': [2, 2], 'radius': 1}
    add('phase:masked_center', 'phase', {'rows': raster, 'control': control, 'occlusion': [[0, 0]]}, phase(raster, control, [[0, 0]]))
    for name, outputs, steps in [
        ('missing', {}, {}), ('half_turn_rejected', {'a': {'angle': 0}}, {'ACTION1': {'status': 'candidate', 'delta': math.pi}}),
        ('candidate_circle', {'a': {'angle': math.pi/8}, 'b': {'angle': 3*math.pi/8}}, {'ACTION1': {'status': 'candidate', 'delta': math.pi/4}}),
        ('nonuniform_rejected', {'a': {'angle': 0}}, {'ACTION1': {'status': 'candidate', 'delta': .4}, 'ACTION2': {'status': 'candidate', 'delta': .9}}),
    ]: add('lattice:' + name, 'lattice', {'outputs': outputs, 'steps': steps}, lattice(outputs, steps))
    grid = {'step': math.pi / 4}
    steps = {'ACTION1': {'status': 'candidate', 'delta': math.pi / 4}}
    samples = [
        ('measured', 'a', {'a': {'angle': 0.0}}, []),
        ('forward', 'b', {'a': {'angle': 0.0}}, [{'before': 'a', 'after': 'b', 'action': 'ACTION1', 'evidence': 'e:1'}]),
        ('inverse', 'a', {'b': {'angle': math.pi / 4}}, [{'before': 'a', 'after': 'b', 'action': 'ACTION1', 'evidence': 'e:1'}]),
        ('unknown', 'a', {}, []),
        ('inconsistent_cycle', 'a', {'c': {'angle': 0.0}}, [
            {'before': 'a', 'after': 'b', 'action': 'ACTION1', 'evidence': 'e:1'},
            {'before': 'b', 'after': 'a', 'action': 'ACTION1', 'evidence': 'e:2'},
            {'before': 'b', 'after': 'c', 'action': 'ACTION1', 'evidence': 'e:3'},
        ]),
    ]
    for name, drawing, outputs, edges in samples:
        args = {'drawing': drawing, 'outputs': outputs, 'edges': edges, 'steps': steps, 'grid': grid}
        add('estimate:' + name, 'estimate', args, estimate_phase(**args))
    before = [[0]*5 for _ in range(5)]; after = copy.deepcopy(before)
    a = {'ref': 'a', 'point': [1, 1]}; b = {'ref': 'b', 'point': [3, 3]}
    before[1][1] = 2; after[1][1] = 3; before[3][3] = 3; after[3][3] = 2
    for name, affected, previous in [('single', [a], None), ('ambiguous', [a, b], None), ('reciprocal', [a, b], a)]:
        args = {'before': before, 'after': after, 'affected': affected, 'previous': previous}
        add('selection:' + name, 'selection', args, selection_recipient(**args))
    add('packet:no_frame', 'packet_literal', {'before': [[0]*4 for _ in range(4)], 'frames': [], 'observation_ref': 'literal', 'action_ref': 'ACTION1'},
        measure_packet([[0]*4 for _ in range(4)], [], observation_ref='literal', action_ref='ACTION1'))


def public_contracts():
    measurements = []
    for index in range(1, len(PROBE['packets'])):
        before = PROBE['packets'][index-1]; after = PROBE['packets'][index]
        if len(after['packet']['frame_packet']) < 3: continue
        measured = measure_packet(before['packet']['frame_rows'], after['packet']['frame_packet'],
                                  observation_ref=before['observation']['observation_ref'], action_ref=after['command']['action_ref'])
        measurements.append({'actionIndex': index, 'expected': helper.plain(measured)})
    family = ObservedCompositionConstraint(); domain = ObservedInputDomain(4096); boundary = 0; envelopes = []
    for index, prefix in enumerate(PROBE['prefixes']):
        before = PROBE['packets'][index]; after = PROBE['packets'][index+1]
        first, second = before['packet']['frame_rows'], after['packet']['frame_rows']
        obs, later = before['observation'], after['observation']
        remaining = PROBE['budget']['levelActions'] - (index-boundary)
        family.level_deadline = time.perf_counter()+600
        proposal = family.linked_propose(obs, first, domain.candidates(obs), remaining, PROBE['policy'])
        assert proposal, index
        unbound = copy.deepcopy(proposal); family.bind(proposal, domain)
        assert proposal == prefix['proposal'], index
        guard = family.before(proposal, 0, SimpleNamespace(**before['packet']), obs)
        outcome = family.after(proposal, 0, obs, later, first, second)
        receipt = family.record(obs, later, proposal['actions'][0], first, second, proposal, 0, frames=after['packet']['frame_packet'])
        envelopes.append({'actionIndex': index+1, 'remaining': remaining, 'proposal': helper.plain(unbound), 'boundProposal': helper.plain(proposal),
                          'beforeGuard': helper.plain(guard), 'outcome': helper.plain(outcome), 'record': helper.plain(copy.deepcopy(receipt)),
                          'state': helper.plain(copy.deepcopy(family.state())), 'linkedState': helper.state(family.memory)})
        if later['levels_completed'] > obs['levels_completed']: boundary = index+1
    return measurements, envelopes


def main():
    numerical_cases()
    measurements, envelopes = public_contracts()
    assert helper.verify_source_manifest() == helper.VERIFIED_PINNED_SOURCE
    output = {'schema': 'logos-engine.v6.linked-packet-reference.v1', 'sourceCommit': helper.COMMIT,
              'qualification': {'sourceModified': False, 'gameHostRunByExporter': False,
                  'commonEnvelope': 'True ObservedCompositionConstraint methods over recorded public returns; not original full common caller selection.',
                  'numerics': 'Unquantized Python floats exported. Native comparison requires structural equality and 1e-12 numerical tolerance; floating-derived digest strings are separately identified, not asserted source-identical.',
                  'mechanics': 'Existing exact internal ray/box FIRST_HIT only; no full optical state machine or certified physical receiver law.'},
              'pinnedSourceFilesVerifiedBeforeImport': len(helper.VERIFIED_PINNED_SOURCE), 'sourceHashes': helper.source_hashes(),
              'sourceMro': [cls.__name__ for cls in type(ObservedCompositionConstraint().memory).__mro__],
              'originalPublicProbe': {'path': PROBE_PATH, 'sha256': helper.hashed((ROOT/PROBE_PATH).read_bytes())},
              'initialDiscovery': {'path': DISCOVERY_PATH, 'sha256': helper.hashed((ROOT/DISCOVERY_PATH).read_bytes())},
              'policy': PROBE['policy'], 'cases': CASES, 'packetMeasurements': measurements, 'commonEnvelopes': envelopes,
              'generator': str(Path(__file__).relative_to(ROOT)), 'generatorSha256': helper.hashed(Path(__file__).read_bytes())}
    destination = ROOT / 'tests/fixtures/v6-linked-packet-reference.json.gz'
    if destination.exists(): raise FileExistsError(destination)
    destination.write_bytes(gzip.compress(json.dumps(output, sort_keys=True, separators=(',', ':')).encode(), mtime=0))
    print(json.dumps({'output': str(destination.relative_to(ROOT)), 'cases': len(CASES), 'packets': len(measurements),
                      'commonAcquisitions': len(envelopes), 'commonEvents': len(envelopes[-1]['state']['events']),
                      'sourceFiles': len(output['sourceHashes'])}), flush=True)


if __name__ == '__main__': main()
