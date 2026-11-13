#!/usr/bin/env python3
"""Independent unchanged-Python OrderedReaction measurement/policy contracts.

The synthetic rasters carry no game identity, route solution or engine state.
Every expected result is evaluated by byte-verified original V5/V6 Python.
"""
from __future__ import annotations
import copy
from dataclasses import asdict, is_dataclass
import gzip
import hashlib
import importlib.util
import itertools
import json
from pathlib import Path
import sys

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('verified_outline_source', ROOT / 'scripts/probe-v6-outline-service-original.py')
helper = importlib.util.module_from_spec(spec); spec.loader.exec_module(helper)
from agents.yf_arc3_v6.morphology_policy.ordered_reaction.policy import ReactionPolicy
from agents.yf_arc3_v6.morphology_policy.ordered_reaction import geometry
from agents.yf_arc3_v5.capabilities.ordered_tip_changes import measure_square_field, retain_distinct_ordered_square_packet
from agents.yf_arc3_v5.capabilities.cell_deltas import measure_cell_deltas
from agents.yf_arc3_v5.capabilities.contracts import FrameGrid


def plain(value):
    if is_dataclass(value): return plain(asdict(value))
    if hasattr(value, 'model_dump'): return plain(value.model_dump())
    if hasattr(value, 'items'): return {str(k): plain(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)): return [plain(v) for v in value]
    if isinstance(value, (set, frozenset)): return [plain(v) for v in sorted(value)]
    return value


def scene(*, shift=(0, 0), palette=None, ring=(15, 5), size=30):
    """Only oriented squares and an outline on an inferred stride-five lattice."""
    palette = palette or {x: x for x in range(16)}
    dr, dc = shift
    rows = [[palette[0]] * size for _ in range(size)]
    def square(top, left, body, marks):
        for r in range(3):
            for c in range(3): rows[top + r + dr][left + c + dc] = palette[9 if (r, c) in marks else body]
    square(10, 5, 2, {(1, 2)})
    square(5, 10, 3, {(2, 1)})
    square(10, 10, 3, {(0, 1), (2, 1), (1, 0), (1, 2), (1, 1)})
    square(15, 10, 3, {(2, 1)})
    square(20, 10, 6, {(2, 1)})
    # Equal relative masks above the local field: their count can be measured
    # against distinct loss ordinals, without assigning either a process law.
    for left in (4, 14):
        rows[1 + dr][left + dc] = palette[8]
        rows[1 + dr][left + dc + 1] = palette[8]
    if ring is not None:
        for r in range(3):
            for c in range(3): rows[ring[0] + r + dr][ring[1] + c + dc] = palette[7 if r in (0, 2) or c in (0, 2) else 0]
    return rows


def ordered_frames(rows, *, shift=(0, 0), palette=None, restore=False):
    palette = palette or {x: x for x in range(16)}
    dr, dc = shift
    first = copy.deepcopy(rows)
    for r in range(3):
        for c in range(3): first[10 + r + dr][5 + c + dc] = palette[0]
    second = copy.deepcopy(first)
    for r, c in [(0, 0), (0, 2), (2, 0), (2, 2)]: second[10 + r + dr][10 + c + dc] = palette[4]
    third = copy.deepcopy(second)
    for r in range(3):
        for c in range(3): third[5 + r + dr][10 + c + dc] = palette[0]
    return [first, second, third] + ([copy.deepcopy(rows)] if restore else [])


def rotate(rows):
    return [list(row) for row in zip(*rows[::-1])]


def main():
    policy = ReactionPolicy()
    local = 'agents/yf_arc3_v6/morphology_policy/ordered_reaction/reaction.drm'
    v5_source = 'agents/yf_arc3_v5/drm/interaction.drm'
    document = json.loads((helper.SOURCE / v5_source).read_text())
    projections = {p['id']: p for d in document['declarations'] for p in d.get('fact_projections', []) if p['id'] in policy.config['projections']}
    assert set(projections) == set(policy.config['projections'])
    subset = {'schema': 'logos-engine.v6.ordered-reaction-policy.v1', 'referenceCommit': helper.COMMIT,
        'scope': 'Exact three consumed V5 projection rows and complete local V6 ReactionPolicy; not the full V5 production DRM registry.',
        'sourceHashes': {p: helper.VERIFIED_SOURCE[p] for p in (local, v5_source)}, 'projections': projections}
    (ROOT / 'src/logos-engine/v6/ordered-reaction-policy.json').write_text(json.dumps(subset, ensure_ascii=False, indent=2) + '\n')
    cases = []
    def record(name, operation, args, callback):
        try: result = {'value': plain(callback())}
        except (ValueError, TypeError, KeyError, IndexError) as exc: result = {'error': {'name': type(exc).__name__, 'message': str(exc)}}
        cases.append({'id': name, 'operation': operation, 'arguments': plain(args), **result})

    valid_offers = []
    for kind in policy.config['priority']:
        rule = policy.config['rules'][kind]
        facts = {'candidate_ref': 'synthetic:é{literal}', 'untouched_evidence': {'observed': ['first', 'second']}}
        projection = policy.projections.get(rule.get('projection'), {})
        conditions = rule['conditions'] + projection.get('all_conditions', []) + projection.get('any_conditions', [])
        for c in conditions:
            field, operator = c['field'], c['operator']
            if operator == 'equals_reference_field': facts[field] = facts[c['reference_field']] = 'synthetic-process'
            elif operator == 'greater_than': facts[field] = c['expected'] + 1
            elif operator == 'equals': facts[field] = c['expected']
            else: raise AssertionError(('unhandled source condition', c))
        valid_offers.append({'kind': kind, 'facts': facts})
        record('choose:' + kind + ':valid', 'choose', [valid_offers[-1]], lambda offer=valid_offers[-1]: policy.choose([offer]))
        assert cases[-1]['value'][0]['status'] == 'selected'
        for field in dict.fromkeys([c['field'] for c in conditions] + ['candidate_ref']):
            for label, v in [('absent', ...), ('null', None), ('false', False), ('one', 1)]:
                changed = copy.deepcopy(facts)
                if v is ...: changed.pop(field)
                else: changed[field] = v
                request = [{'kind': kind, 'facts': changed}]
                record('choose:' + kind + ':' + field + ':' + label, 'choose', request, lambda request=request: policy.choose(request))
    for index in range(len(valid_offers)):
        request = list(reversed(valid_offers[index:]))
        record('choose:priority:' + str(index), 'choose', request, lambda request=request: policy.choose(request))
    for name, request in [('empty', []), ('unknown', [{'kind': 'unknown', 'facts': {}}]),
            ('prototype-name', [{'kind': 'toString', 'facts': {}}]), ('same-priority-first-offer', [valid_offers[0], copy.deepcopy(valid_offers[0])])]:
        record('choose:' + name, 'choose', request, lambda request=request: policy.choose(request))
    for value in [{}, ['é', '漢字', 'α', '😀'], {'b': [1, False, None], 'a': 'ordered'}, {'safe': 9007199254740991, 'negative': -9007199254740991}]:
        record('digest:' + str(len(cases)), 'digest', value, lambda value=value: geometry.digest(value))

    directions = policy.config['direction_prior']
    base, packet = None, None
    for shift, palette in itertools.product([(0, 0), (1, 2)], [None, {x: (x + 5) % 16 for x in range(16)}]):
        label = str(shift) + ':' + ('permuted' if palette else 'base')
        rows = scene(shift=shift, palette=palette)
        frames = ordered_frames(rows, shift=shift, palette=palette)
        record('field:' + label, 'measure_square_field', rows, lambda rows=rows: measure_square_field(FrameGrid(rows=rows)))
        for restore in (False, True):
            observed = frames + ([rows] if restore else [])
            args = {'first': rows, 'frames': observed, 'action': 'process:observed'}
            record('observe:' + label + ':' + str(restore), 'observe', args, lambda args=args: geometry.observe(**args))
            measured = cases[-1]['value']; assert measured is not None
            assert measured['distinct_loss_step_count'] == 2 and measured['equal_cardinality_external_component_group_count'] == 1
            current = observed[-1]
            args = {'rows': current, 'packets': [{'packet': measured}], 'directions': directions}
            record('measure:' + label + ':' + str(restore), 'measure', args, lambda args=args: geometry.measure(**args))
            assert cases[-1]['value'][0]['ordered_tip_temporal_incidence_count'] == 1
            assert cases[-1]['value'][0]['ordered_tip_route_present'] is True
        if shift == (0, 0) and palette is None: base, packet = rows, measured
    assert base is not None and packet is not None
    original_frames = ordered_frames(base)
    for turns in (1, 2, 3):
        rows, frames = copy.deepcopy(base), copy.deepcopy(original_frames)
        rotated_directions = copy.deepcopy(directions)
        for _ in range(turns):
            rows, frames = rotate(rows), [rotate(frame) for frame in frames]
            rotated_directions = {action: [dc, -dr] for action, (dr, dc) in rotated_directions.items()}
        observed = geometry.observe(rows, frames, 'process:rotated')
        args = {'first': rows, 'frames': frames, 'action': 'process:rotated'}
        record('observe:rotation:' + str(turns), 'observe', args, lambda args=args: geometry.observe(**args))
        args = {'rows': frames[-1], 'packets': [{'packet': observed}], 'directions': rotated_directions}
        record('measure:rotation:' + str(turns), 'measure', args, lambda args=args: geometry.measure(**args))
    for name, rows in [('no-field', [[0] * 8 for _ in range(8)]), ('no-ring', scene(ring=None)), ('ring-on-earlier-chain', scene(ring=(10, 5))), ('foreign-ring', scene(ring=(0, 25)))]:
        args = {'rows': rows, 'packets': [{'packet': packet}], 'directions': directions}
        record('measure:' + name, 'measure', args, lambda args=args: geometry.measure(**args))
    for name, rows in [('two-rings', scene()), ('blocked-route', scene())]:
        if name == 'two-rings':
            for r in range(3):
                for c in range(3): rows[15 + r][15 + c] = 7 if r in (0, 2) or c in (0, 2) else 0
        else:
            for top, left in [(10, 5), (20, 5), (15, 0), (15, 10)]:
                for r in range(3):
                    for c in range(3): rows[top + r][left + c] = 1
        args = {'rows': rows, 'packets': [{'packet': packet}], 'directions': directions}
        record('measure:' + name, 'measure', args, lambda args=args: geometry.measure(**args))
    for name, vector_map in [('renamed-inputs', {'north-input': [-1, 0], 'south-input': [1, 0], 'west-input': [0, -1], 'east-input': [0, 1]}), ('no-directions', {}), ('reversed-input-order', dict(reversed(list(directions.items()))))]:
        args = {'rows': base, 'packets': [{'packet': packet}], 'directions': vector_map}
        record('measure:' + name, 'measure', args, lambda args=args: geometry.measure(**args))
    for name, mutate in [('no-recolor', lambda p: [c.update(first_marker_preserving_recolor=None) for c in p['changes']]),
            ('simultaneous-losses', lambda p: [c.update(first_marker_loss=0) for c in p['changes'] if c['first_marker_loss'] is not None]),
            ('terminal-lost', lambda p: [c.update(first_marker_loss=3) for c in p['changes'] if c['square']['top'] == 20]),
            ('terminal-same-value', lambda p: [c['square'].update(value=3) for c in p['changes'] if c['square']['top'] == 20]),
            ('incompatible-scope', lambda p: p['field'].update(row_phase=1))]:
        changed = copy.deepcopy(packet); mutate(changed)
        args = {'rows': base, 'packets': [{'packet': changed}], 'directions': directions}
        record('measure:packet:' + name, 'measure', args, lambda args=args: geometry.measure(**args))
    for name, frames in [('none', []), ('unchanged', [base]), ('one-loss', original_frames[:1]),
            ('exact-frame-bound', original_frames + [original_frames[-1]] * 253), ('over-frame-bound', [base] * 257), ('dimension-change', [[[0] * 4 for _ in range(4)]])]:
        args = {'first': base, 'frames': frames, 'action': 'process:observed'}
        record('observe:' + name, 'observe', args, lambda args=args: geometry.observe(**args))
    for name, rows in [('over-lattice-bound', scene(size=90)), ('uniform', [[0] * 8 for _ in range(8)])]:
        record('field:' + name, 'measure_square_field', rows, lambda rows=rows: measure_square_field(FrameGrid(rows=rows)))
    for label, value in [('complete', packet), ('extra-ignored', {**packet, 'irrelevant': True})]:
        record('restore:' + label, 'packet_restore', value, lambda value=value: geometry.packet_restore(value))
    for count, limit, duplicate in [(0, 4, False), (4, 4, False), (5, 2, False), (4, 4, True), (1, 1, False)]:
        packets = [{**copy.deepcopy(packet), 'action_ref': 'observed:' + str(i)} for i in range(count)]
        current = copy.deepcopy(packets[0] if duplicate else packet)
        args = {'packets': packets, 'packet': current, 'limit': limit}
        record(f'retain:{count}:{limit}:{duplicate}', 'retain_distinct', args,
            lambda args=args: retain_distinct_ordered_square_packet(tuple(geometry.packet_restore(p) for p in args['packets']), geometry.packet_restore(args['packet']), args['limit']))
    before = [[(r + c) % 3 for c in range(8)] for r in range(8)]
    changed = copy.deepcopy(before); changed[1][1] = 9; changed[2][2] = 9; changed[6][6] = 9
    gap = copy.deepcopy(changed); gap[3][3] = 8
    for name, options in [('default', {}), ('phase', {'row_phase': 1, 'col_phase': 1}), ('cell-cap', {'max_cells': 3}),
            ('frame-cap', {'max_frames': 2}), ('size-guard', {'size': 0}), ('stride-guard', {'stride': 1})]:
        args = {'before': before, 'frames': [changed, gap, before], 'row_phase': 0, 'col_phase': 0, 'stride': 4, 'size': 3, **options}
        record('cells:' + name, 'measure_cell_deltas', args, lambda args=args: measure_cell_deltas(**args))
    for name, args in [('empty', {'before': [], 'frames': []}), ('ragged', {'before': [[0, 0], [0]], 'frames': []}),
            ('changed-dimensions', {'before': before, 'frames': [[[0]]]}), ('no-frames', {'before': before, 'frames': []})]:
        args = {'row_phase': 0, 'col_phase': 0, 'stride': 4, 'size': 3, **args}
        record('cells:' + name, 'measure_cell_deltas', args, lambda args=args: measure_cell_deltas(**args))
    paths = ['agents/yf_arc3_v6/morphology_policy/ordered_reaction/' + p for p in ['policy.py', 'geometry.py', 'reaction.drm', 'reaction.src']]
    paths += ['agents/yf_arc3_v5/capabilities/' + p for p in ['ordered_tip_changes.py', 'cell_deltas.py', 'physical_transition_contracts.py', 'components.py', 'contracts.py']]
    paths.append(v5_source)
    out = {'schema': 'logos-engine.v6.ordered-reaction-reference.v1', 'referenceCommit': helper.COMMIT,
        'qualification': 'Unchanged original Python on synthetic public raster/component contracts, not game results. Dataclass restoration and digests are compared in the exact JSON safe-integer/string/boolean domain; Python nominal repr and coercion-only inputs remain outside native runtime inputs.',
        'sourceHashes': {p: helper.VERIFIED_SOURCE[p] for p in paths}, 'cases': cases}
    target = ROOT / 'tests/fixtures/v6-ordered-reaction-reference.json.gz'
    with target.open('wb') as raw:
        with gzip.GzipFile(filename='', mode='wb', fileobj=raw, mtime=0) as stream:
            stream.write(json.dumps(out, ensure_ascii=False, separators=(',', ':'), allow_nan=False).encode())
    print(json.dumps({'cases': len(cases), 'fixture': str(target.relative_to(ROOT)), 'bytes': target.stat().st_size,
        'sha256': hashlib.sha256(target.read_bytes()).hexdigest()}))


if __name__ == '__main__': main()
