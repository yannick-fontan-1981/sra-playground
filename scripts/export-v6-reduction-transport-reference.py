#!/usr/bin/env python3
"""Export exact source answers from public frames and small synthetic domains."""
from __future__ import annotations
import copy
import gzip
import json
from pathlib import Path
import sys
from types import SimpleNamespace

sys.dont_write_bytecode = True
from importlib.util import module_from_spec, spec_from_file_location
spec = spec_from_file_location('reduction_probe', Path(__file__).with_name('probe-v6-reduction-transport-original.py'))
helper = module_from_spec(spec)
spec.loader.exec_module(helper)
from common_reduction_transport import (ReductionTransport, layout, scan, state, moved, successors, route,
    pack_state, translated, visible_cells, merge_scene, align_scene, VECTORS)


def source_family(snapshot):
    f = ReductionTransport()
    for name, value in copy.deepcopy(snapshot).items():
        if name == 'model' and value is not None: value['phase'] = tuple(value['phase'])
        if name == 'motion': value = {k: tuple(v) for k, v in value.items()}
        if name == 'tested': value = {(k, (frozenset(map(tuple, s[0])), tuple(map(tuple, s[1])))) for k, s in value}
        if name == 'verified': value = set(value)
        if name in ('offset', 'selected') and value is not None: value = tuple(value)
        if name == 'scene' and value is not None: value = unpack_scene(value)
        setattr(f, name, value)
    return f


def unpack_scene(value):
    return {name: tuple(sorted(map(tuple, cells))) if name == 'carriers'
            else {(tuple(a), tuple(b)) for a, b in cells} if name == 'edges'
            else set(map(tuple, cells)) for name, cells in value.items()}


def source_proposal(value):
    proposal = copy.deepcopy(value)
    for step in proposal['steps']:
        for name in ('current', 'expected_after'):
            if step[name] is not None: step[name] = [list(map(tuple, cells)) for cells in step[name]]
        if 'cell' in step: step['cell'] = tuple(step['cell'])
        if 'vector_hypothesis' in step: step['vector_hypothesis'] = tuple(step['vector_hypothesis'])
    return proposal


def from_rows(rows, observation):
    raw = {'frame_rows': rows, 'frame_packet': [rows], 'level': observation['level_epoch'],
           'levels_completed': observation['levels_completed'], 'state': observation['state'], 'step_index': 0,
           'available_action_refs': observation['available_action_refs'],
           'frame_hash': helper.hashed(json.dumps(rows, separators=(',', ':')).encode())[:16]}
    observed, _ = helper.measure(SimpleNamespace(**raw), 1, 'reduction-transform-reference')
    return raw, observed


def main():
    trace_path = helper.ROOT / 'tests/fixtures/v6-reduction-transport-lf52-original-public.json.gz'
    trace = json.loads(gzip.decompress(trace_path.read_bytes()))
    initial = trace['packets'][0]
    original = initial['packet']['frame_rows']
    background = max(set(v for row in original for v in row), key=lambda color: sum(row.count(color) for row in original))
    translated_rows = [[background] * (len(original[0]) + 7) for _ in range(len(original) + 5)]
    for y, row in enumerate(original): translated_rows[y + 2][3:3 + len(row)] = row
    palette = lambda rows: [[(value * 5 + 37) % 256 for value in row] for row in rows]
    variants = {
        'public_initial': original,
        'palette_bijection': palette(original),
        'translation_new_canvas': translated_rows,
        'horizontal_reflection': [list(reversed(row)) for row in original],
        'vertical_reflection': list(reversed(original)),
        'transposition': [list(row) for row in zip(*original)],
        'uniform_scale_two': [[v for v in row for _ in range(2)] for row in original for _ in range(2)],
        'translated_reflected_palette': palette([list(reversed(row)) for row in translated_rows]),
    }
    model = layout(initial['observation'], original)
    erased = copy.deepcopy(original)
    changed_type = copy.deepcopy(original)
    tokens = [e for e in initial['observation']['entities'] if e['palette_value'] == model['token']
              and e['bbox'][2] - e['bbox'][0] + 1 == model['unit'] and e['area'] > model['unit'] ** 2 / 2]
    for e in tokens:
        for dx, dy in e['mask']: erased[e['position'][1] + dy][e['position'][0] + dx] = model['floor']
    replacement = next(v for v in range(256) if v not in {model['floor'], model['token'], background})
    for dx, dy in tokens[0]['mask']:
        changed_type[tokens[0]['position'][1] + dy][tokens[0]['position'][0] + dx] = replacement
    variants['no_repeated_population'] = erased
    variants['mixed_population_types'] = changed_type
    geometry = []
    for label, rows in variants.items():
        public, observed = from_rows(rows, initial['observation'])
        measured = layout(observed, rows)
        item = {'name': label, 'rows': rows, 'observation': observed, 'model': measured}
        if measured:
            local = scan(rows, measured)
            merged = merge_scene(None, local, measured, (0, 0))
            item.update(scene=helper.plain(local), merged=helper.plain(merged), visible=helper.plain(visible_cells(measured, (0, 0))),
                        translated=helper.plain(translated(local, (-2, 3))),
                        path=helper.plain(route(state(merged), merged, 16)),
                        aligned=helper.plain(align_scene(rows, observed, measured, merged, (0, 0))))
        geometry.append(item)

    def scene(floor=(), pegs=(), carriers=(), rails=(), edges=(), known=()):
        return {'floor': set(floor), 'pegs': set(pegs), 'carriers': tuple(sorted(carriers)),
                'rails': set(rails), 'edges': set(edges), 'known_cells': set(known)}
    straight = tuple((x, 0) for x in range(5))
    edges = tuple((p, q) for p in straight for q in straight if abs(p[0] - q[0]) == 1)
    examples = [
        ('one_jump', scene(floor=straight[:3], pegs=straight[:2]), 2, False),
        ('primitive_horizon_refuses', scene(floor=straight[:3], pegs=straight[:2]), 1, False),
        ('destination_support_absent', scene(floor=straight[:2], pegs=straight[:2]), 12, False),
        ('two_reductions', scene(floor=straight, pegs=((0, 0), (1, 0), (3, 0))), 4, False),
        ('moving_occupied_support', scene(floor=((0, 0), (2, 0)), pegs=((0, 0), (2, 0)), carriers=((2, 0),), rails=straight, edges=edges), 3, False),
        ('occupied_destination', scene(pegs=((2, 0),), carriers=((2, 0), (3, 0)), rails=straight, edges=edges), 4, True),
        ('reveal_requires_changed_state', scene(pegs=((2, 0),), carriers=((2, 0),), rails=straight, edges=edges), 1, True),
        ('known_frontier', scene(pegs=((2, 0),), carriers=((2, 0),), rails=straight, edges=edges, known=tuple((x, y) for x in range(-4, 9) for y in range(-4, 5))), 2, True),
        ('cardinality_target_already_met', scene(floor=straight, pegs=((0, 0),)), 0, False),
        ('no_population', scene(floor=straight), 4, False),
    ]
    mechanics = []
    for label, supplied, limit, reveal in examples:
        current = state(supplied)
        mechanics.append({'name': label, 'scene': helper.plain(supplied), 'current': pack_state(current),
                          'limit': limit, 'reveal': reveal, 'route': helper.plain(route(current, supplied, limit, reveal)),
                          'moved': [pack_state(moved(current, vector, supplied['edges'])) for vector in VECTORS],
                          'successors': [[pack_state(s), helper.plain(action), weight] for s, action, weight in successors(current, supplied)]})

    prefix = trace['prefixes'][0]
    before = trace['packets'][0]
    after = trace['packets'][1]
    guards = []
    for label in ('baseline', 'epoch_changed', 'completed_changed', 'observation_changed', 'action_unavailable', 'population_removed'):
        public = copy.deepcopy(before['packet'])
        observed = copy.deepcopy(before['observation'])
        if label == 'epoch_changed': public['level'] += 1
        if label == 'completed_changed': public['levels_completed'] += 1
        if label == 'observation_changed': observed['observation_ref'] += ':changed'
        if label == 'action_unavailable': public['available_action_refs'] = []
        if label == 'population_removed': public['frame_rows'] = erased
        f = source_family(prefix['beforeState'])
        guards.append({'name': label, 'snapshot': prefix['beforeState'], 'proposal': prefix['proposal'], 'index': 0,
                       'public': public, 'observation': observed, 'result': helper.plain(f.before(source_proposal(prefix['proposal']), 0, SimpleNamespace(**public), observed))})
    outcomes = []
    for label in ('actual_selection', 'unchanged_selection', 'official_score', 'official_epoch', 'official_state'):
        observed = copy.deepcopy(after['observation'])
        rows = after['packet']['frame_rows']
        if label == 'unchanged_selection': rows = before['packet']['frame_rows']
        if label == 'official_score': observed['levels_completed'] += 1
        if label == 'official_epoch': observed['level_epoch'] += 1
        if label == 'official_state': observed['state'] = 'WIN'
        f = source_family(prefix['beforeState'])
        outcomes.append({'name': label, 'snapshot': prefix['beforeState'], 'proposal': prefix['proposal'], 'index': 0,
                         'before': before['observation'], 'after': observed, 'first': before['packet']['frame_rows'], 'second': rows,
                         'result': helper.plain(f.after(source_proposal(prefix['proposal']), 0, before['observation'], observed, before['packet']['frame_rows'], rows))})
    result = {'schema': 'logos-engine.v6.reduction-transport-reference.v1', 'sourceCommit': helper.COMMIT,
              'sourceHashes': helper.source_hashes(), 'generator': str(Path(__file__).relative_to(helper.ROOT)),
              'generatorSha256': helper.hashed(Path(__file__).read_bytes()), 'publicTraceSha256': helper.hashed(trace_path.read_bytes()),
              'scope': 'Exact pinned component over recorded public screens, geometric counterfactuals and finite synthetic support domains; no hidden game definition.',
              'geometry': geometry, 'mechanics': mechanics, 'guards': guards, 'outcomes': outcomes}
    destination = helper.ROOT / 'tests/fixtures/v6-reduction-transport-reference.json.gz'
    destination.write_bytes(gzip.compress(json.dumps(result, sort_keys=True, separators=(',', ':')).encode(), mtime=0))
    print(json.dumps({'output': str(destination.relative_to(helper.ROOT)), 'geometry': len(geometry), 'mechanics': len(mechanics),
                      'guards': len(guards), 'outcomes': len(outcomes), 'sourceFiles': len(result['sourceHashes'])}), flush=True)


if __name__ == '__main__': main()
