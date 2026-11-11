#!/usr/bin/env python3
"""New recovery oracle for the unchanged pinned PreviewPacking component.

Only synthetic public raster interfaces, declared responses, finite calculus
inputs and explicitly labelled state/observation interventions are used. No
game, engine, private level, historical 6A receipt or native module is loaded.
The --calls mode evaluates a chronological native capture from a cold original
component; restore operations are explicit calls, never an injected initial
state. Tuple/list JSON transport is the only output normalization.
"""
from __future__ import annotations

import argparse
from copy import deepcopy
import datetime
import gzip
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import platform
import sys
import time
import traceback
from types import SimpleNamespace

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
COMMIT = '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e'
PIN = ROOT / 'reference/v6' / COMMIT
REF = PIN / 'source'
SCOPE = 'original-preview-packing-recovery-synthetic'


def fingerprint(path):
    data = path.read_bytes()
    return {'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}


def verify_original():
    manifest = json.loads((PIN / 'manifest.json').read_text())
    assert manifest['commit'] == COMMIT
    for name, expected in manifest['files'].items():
        actual = fingerprint(REF / name)
        assert actual == {k: expected[k] for k in ('bytes', 'sha256')}, name
    return {'commit': COMMIT, 'files': len(manifest['files']),
            'manifest': fingerprint(PIN / 'manifest.json'), 'unchanged': True}


SOURCE_BEFORE = verify_original()
sys.path[:0] = [str(REF / 'agents/yf_arc3_v6/laya_proto'), str(REF)]
from neutral_observer import measure
from observed_input_domain import ObservedInputDomain
from src_bridge import plain
from agents.yf_arc3_v6.morphology_policy.preview_packing.family import PreviewPacking
from agents.yf_arc3_v6.morphology_policy.preview_packing.donor import (
    normalized, measure_scene, point_for, input_candidates, sample, preview_pose, assignments)
from agents.yf_arc3_v5.capabilities.preview_piece_packing import _transform


def state(family):
    return plain(family.state())


def packet(rows, revision=0, epoch=1, completed=0, controls=None):
    return SimpleNamespace(frame_rows=deepcopy(rows), frame_packet=[deepcopy(rows)],
        level=epoch, levels_completed=completed, state='NOT_FINISHED', step_index=revision,
        available_action_refs=list(controls) if controls is not None else [f'ACTION{i}' for i in range(1, 7)],
        frame_hash=hashlib.sha256(json.dumps(rows, separators=(',', ':')).encode()).hexdigest()[:16])


def observe(public):
    return measure(public, public.step_index, SCOPE)[0]


class Interface:
    """Declared raster fixture, with no rule inferred from source proposals."""
    def __init__(self, kind='domino'):
        self.q = 3
        self.width, self.height = 36, 24
        self.origin = [3, 3]
        self.board_shape = [2, 2]
        self.background, self.empty, self.frame_color, self.preview_color = 0, 1, 8, 7
        self.pieces = [
            {'color': 4, 'anchor': [0, 4], 'mask': [[0, 0], [1, 0]]},
            {'color': 5, 'anchor': [0, 7], 'mask': [[0, 0], [1, 0]]}]
        if kind == 'elbows':
            self.board_shape = [2, 3]
            for piece in self.pieces:
                piece['mask'] = [[0, 0], [1, 0], [1, 1]]
        elif kind == 'fixed':
            self.board_shape = [2, 3]
            self.pieces = [
                {'color': 3, 'anchor': [0, 0], 'mask': [[0, 0], [0, 1], [1, 0]]},
                {'color': 4, 'anchor': [0, 5], 'mask': [[0, 0], [1, 0], [1, 1]]}]
        self.selected = None
        self.revision, self.epoch, self.completed = 0, 1, 0
        self.available = [f'ACTION{i}' for i in range(1, 7)]
        self.changes = []
        self.show_selection = True

    def rows(self):
        rows = [[self.background] * self.width for _ in range(self.height)]
        top, left = self.origin
        height, width = self.board_shape
        bottom, right = top + height * self.q, left + width * self.q
        for x in range(left - 1, right + 1):
            rows[top - 1][x] = rows[bottom][x] = self.frame_color
        for y in range(top - 1, bottom + 1):
            rows[y][left - 1] = rows[y][right] = self.frame_color
        for y in range(height):
            for x in range(width):
                for dy in range(self.q - 1):
                    for dx in range(self.q - 1):
                        rows[top + y * self.q + dy][left + x * self.q + dx] = self.empty
        for index, piece in enumerate(self.pieces):
            color = self.preview_color if self.selected == index and self.show_selection else piece['color']
            for y, x in piece['mask']:
                yy = top + (piece['anchor'][0] + y) * self.q
                xx = left + (piece['anchor'][1] + x) * self.q
                for dy in range(self.q):
                    for dx in range(self.q):
                        if 0 <= yy + dy < len(rows) and 0 <= xx + dx < len(rows[0]):
                            rows[yy + dy][xx + dx] = color
        for x, y, color in self.changes:
            rows[y][x] = color
        return rows

    def public(self):
        return packet(self.rows(), self.revision, self.epoch, self.completed, self.available)

    def respond(self, command, response):
        if response in ('select', 'select-unchanged'):
            assert command['action_ref'] == 'ACTION6'
            point = command['data']
            cell = [(point['y'] - self.origin[0]) // self.q, (point['x'] - self.origin[1]) // self.q]
            matches = [i for i, p in enumerate(self.pieces)
                if [cell[0] - p['anchor'][0], cell[1] - p['anchor'][1]] in p['mask']]
            assert len(matches) == 1
            self.selected = matches[0]
            self.show_selection = response != 'select-unchanged'
        elif response in ('left', 'right', 'up', 'down', 'two-left'):
            assert self.selected is not None
            delta = {'left': [0, -1], 'right': [0, 1], 'up': [-1, 0], 'down': [1, 0], 'two-left': [0, -2]}[response]
            self.pieces[self.selected]['anchor'] = [a + b for a, b in zip(self.pieces[self.selected]['anchor'], delta)]
        elif response in ('rotate_cw', 'rotate_ccw', 'reflect_rows', 'reflect_columns'):
            assert self.selected is not None
            # The response geometry is fixed by a named fixture intervention,
            # independent of the command name chosen by the component.
            mask = self.pieces[self.selected]['mask']
            if response == 'rotate_cw': points = [(x, -y) for y, x in mask]
            elif response == 'rotate_ccw': points = [(-x, y) for y, x in mask]
            elif response == 'reflect_rows': points = [(-y, x) for y, x in mask]
            else: points = [(y, -x) for y, x in mask]
            a = min(p[0] for p in points); b = min(p[1] for p in points)
            self.pieces[self.selected]['mask'] = sorted([[y - a, x - b] for y, x in points])
        elif response == 'boundary':
            self.epoch += 1; self.completed += 1; self.selected = None
        elif response == 'score-only':
            self.completed += 1
        elif response == 'different-palette':
            self.preview_color = 14
        elif response == 'missing-preview':
            self.show_selection = False
        elif response != 'unchanged':
            raise ValueError(response)
        self.revision += 1


def source_step(family, world, response=None, remaining=80):
    before = world.public(); obs = observe(before)
    inputs = ObservedInputDomain(250).candidates(obs)
    row = {'stateBefore': state(family), 'beforePublic': vars(before), 'beforeObservation': obs,
           'inputs': inputs, 'remaining': remaining}
    proposal = family.propose(obs, before.frame_rows, inputs, remaining)
    row.update(proposal=deepcopy(proposal), stateAfterPropose=state(family))
    if not proposal or proposal.get('status') != 'proposed' or response is None:
        return plain(row)
    family.bind(proposal, ObservedInputDomain(250))
    row.update(boundProposal=deepcopy(proposal), beforeGuard=family.before(proposal, 0, before, obs))
    command = deepcopy(proposal['actions'][0]); world.respond(command, response)
    after = world.public(); second = observe(after)
    row.update(command=command, response=response, afterPublic=vars(after), afterObservation=second,
        afterGuard=family.after(proposal, 0, obs, second, before.frame_rows, after.frame_rows),
        record=family.record(obs, second, command, before.frame_rows, after.frame_rows, proposal, 0),
        stateAfter=state(family))
    return plain(row)


def initial_cases():
    cases = []
    def add(label, world=None, remaining=80, corrupt=None, inputs_override=None):
        world = world or Interface(); family = PreviewPacking()
        public = world.public(); obs = observe(public)
        if corrupt:
            scene = measure_scene(public.frame_rows); point = point_for(scene, next(p for p in scene['pieces'] if p['movable']))
            owner = next(e for e in obs['entities'] if [point['x']-e['bbox'][0], point['y']-e['bbox'][1]] in [list(q) for q in e['mask']])
            if corrupt == 'duplicate-owner': obs['entities'].append({**deepcopy(owner), 'id': owner['id'] + ':duplicate'})
            elif corrupt == 'no-owner': obs['entities'].remove(owner)
        inputs = ObservedInputDomain(250).candidates(obs) if inputs_override is None else inputs_override
        result = family.propose(obs, public.frame_rows, inputs, remaining)
        cases.append(plain({'id': label, 'public': vars(public), 'observation': obs, 'inputs': inputs,
            'remaining': remaining, 'proposal': result, 'state': state(family),
            'observationMode': 'synthetic-observation-corruption' if corrupt else 'original-public-measurement'}))
    add('two-dominoes-source-piece-order')
    add('two-asymmetric-pieces-and-first-minimum', Interface('elbows'))
    add('fixed-interior-occurrence-is-preserved', Interface('fixed'))
    add('remaining-zero', remaining=0)
    add('remaining-one-bounds-prefix', remaining=1)
    add('candidate-click-list-is-not-eligibility', inputs_override=[])
    add('point-with-two-measured-owners', corrupt='duplicate-owner')
    add('point-with-no-measured-owner', corrupt='no-owner')
    w = Interface(); w.available = ['ACTION1', 'ACTION2']; add('selection-command-unavailable', w)
    w = Interface(); w.available = []; add('all-commands-unavailable', w)
    w = Interface(); w.pieces.pop(); add('outside-area-does-not-cover-residual', w)
    w = Interface(); w.changes = [[2, 2, 0]]; add('broken-frame-ring', w)
    w = Interface(); w.origin = [6, 6]; add('translated-public-lattice', w)
    w = Interface(); w.background, w.empty, w.frame_color, w.preview_color = 12, 14, 2, 11
    w.pieces[0]['color'], w.pieces[1]['color'] = 10, 3; add('permuted-palette-including-two-digit-values', w)
    return cases


def sessions():
    result = []
    plans = [
        ('selection-unit-translation-and-official-boundary', 'domino', ['select', 'left', 'left', 'boundary', None]),
        ('selection-without-recolor-is-not-observed-selection', 'domino', ['select-unchanged', None]),
        ('missing-preview-does-not-learn-a-control', 'domino', ['select', 'missing-preview', None]),
        ('nonunit-translation-retains-pose-but-not-unit-control', 'domino', ['select', 'two-left', None]),
        ('ambiguous-symmetric-transform-is-not-identified', 'domino', ['select', 'rotate_cw', None]),
        ('asymmetric-transform-fit', 'elbows', ['select', 'rotate_cw', None]),
        ('score-change-with-same-epoch-seals-but-records', 'domino', ['select', 'score-only', None]),
        ('contradictory-no-effect-keeps-source-control', 'domino', ['select', 'left', 'unchanged', None]),
        ('changed-preview-color-is-observed-from-current-frame', 'domino', ['select', 'different-palette', None])]
    for label, kind, responses in plans:
        family = PreviewPacking(); world = Interface(kind)
        steps = [source_step(family, world, response) for response in responses]
        result.append({'id': label, 'steps': steps})
    return result


def helper_cases():
    result = {'normalized': [], 'transforms': [], 'scenes': [], 'points': [], 'samples': [], 'poses': [], 'assignments': []}
    masks = [[[2, 4], [4, 4], [4, 5]], [[0, 0], [1, 0]], [[-3, -2], [-3, -1], [-2, -2]], [[0, 10], [2, 2], [1, 12]]]
    for i, mask in enumerate(masks):
        result['normalized'].append({'id': f'mask-{i}', 'points': mask, 'expected': plain(normalized(mask))})
        for name in ('rotate_cw', 'rotate_ccw', 'reflect_rows', 'reflect_columns'):
            result['transforms'].append({'id': f'mask-{i}-{name}', 'mask': mask, 'kind': name,
                'expected': plain(_transform(tuple(map(tuple, mask)), name))})
    for kind in ('domino', 'elbows', 'fixed'):
        world = Interface(kind); rows = world.rows(); scene = plain(measure_scene(rows))
        result['scenes'].append({'id': kind, 'rows': rows, 'expected': scene,
            'inputs': plain(input_candidates(rows, world.available))})
        result['assignments'].append({'id': kind, 'model': scene, 'expected': plain(assignments(scene))})
        for p in scene['pieces']:
            result['points'].append({'id': kind + '-' + p['id'], 'model': scene, 'piece': p, 'expected': point_for(scene, p)})
    for count in (10, 12):
        world = Interface(); world.board_shape = [4, count // 2]
        colors = [2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14]
        world.pieces = [{'color': colors[i], 'anchor': [0, 8 + 3*i], 'mask': [[0, 0], [1, 0]]} for i in range(count)]
        world.width = 3 + (10 + 3*count)*3
        rows = world.rows()
        result['scenes'].append({'id': f'dictionary-key-set-presize-{2*count}-cells', 'rows': rows,
            'expected': plain(measure_scene(rows)), 'inputs': plain(input_candidates(rows, world.available))})
    # Explicit calculus model: source sorts string occurrence refs lexically.
    m = deepcopy(result['scenes'][0]['expected'])
    for p, ref in zip(m['pieces'], ('piece:2', 'piece:10')): p['id'] = ref
    result['assignments'].append({'id': 'piece10-precedes-piece2-lexical-domain-order', 'model': m, 'expected': plain(assignments(m))})
    m = deepcopy(result['scenes'][0]['expected']); m['board'] = [[0, 0], [0, 1], [1, 0]]
    result['assignments'].append({'id': 'area-mismatch-is-exhaustive-conditional-calculation', 'model': m, 'expected': plain(assignments(m))})
    m = {'q': 2, 'offset': [0, 0]}; rows = [[12, 3], [3, 12]]
    result['samples'].append({'id': 'majority-tie-follows-first-raster-value', 'rows': rows, 'model': m, 'cell': [0, 0], 'expected': plain(sample(rows, m, (0, 0)))})
    w = Interface(); s = measure_scene(w.rows()); s.update(epoch=1, tried=[], evidence=['synthetic'])
    chosen = next(p for p in s['pieces'] if p['movable']); s['selected'] = chosen['id']; s['preview_color'] = w.preview_color
    w.respond({'action_ref': 'ACTION6', 'data': point_for(s, chosen)}, 'select')
    for label, response in [('selected', None), ('translated', 'left'), ('other-unexcluded-color', 'different-palette'), ('missing', 'missing-preview')]:
        if response: w.respond({'action_ref': 'ACTION1'}, response)
        result['poses'].append({'id': label, 'rows': w.rows(), 'model': deepcopy(s), 'expected': plain(preview_pose(w.rows(), s))})
    return plain(result)


def guards_and_records(all_sessions):
    row = all_sessions[0]['steps'][0]
    family = PreviewPacking(); family.restore(deepcopy(row['stateAfterPropose']))
    p, pub, obs = deepcopy(row['proposal']), deepcopy(row['beforePublic']), deepcopy(row['beforeObservation'])
    cases = []
    def add(label, proposal=None, public=None, observation=None):
        proposal = deepcopy(p if proposal is None else proposal)
        public = deepcopy(pub if public is None else public); observation = deepcopy(obs if observation is None else observation)
        cases.append(plain({'id': label, 'proposal': proposal, 'public': public, 'observation': observation,
            'index': 0, 'expected': family.before(proposal, 0, SimpleNamespace(**public), observation)}))
    add('current-binding')
    for key, value in [('level_epoch', 8), ('levels_completed', 9), ('observation_ref', 'foreign'), ('available_action_refs', ['ACTION5'])]:
        changed = deepcopy(obs); changed[key] = value; add('changed-' + key, observation=changed)
    changed = deepcopy(pub); changed['frame_rows'][0][0] = 11; add('initial-raster-changed', public=changed)
    for field in ('actions', 'steps', 'bundle_template', 'preview_policy_hash', 'preview_packing_plan'):
        changed = deepcopy(p)
        if field == 'actions': changed['actions'][0]['action_ref'] = 'ACTION5'
        elif field == 'steps': changed['steps'][0]['action']['action_ref'] = 'ACTION5'
        elif field == 'bundle_template': changed['bundle_template']['actions'][0]['action_ref'] = 'ACTION5'
        elif field == 'preview_policy_hash': changed[field] = 'wrong'
        else: changed[field]['chosen'] = 'foreign'
        add('tampered-' + field, proposal=changed)
    records = []
    for label, proposal in [('unselected-has-no-passive-return', None), ('foreign-selected-has-no-preview-return', {'kind': 'other'})]:
        family = PreviewPacking(); family.restore(deepcopy(row['stateAfterPropose']))
        output = family.record(row['beforeObservation'], row['afterObservation'], row['command'], row['beforePublic']['frame_rows'], row['afterPublic']['frame_rows'], proposal, 0)
        records.append(plain({'id': label, 'stateBefore': row['stateAfterPropose'], 'beforeObservation': row['beforeObservation'],
            'afterObservation': row['afterObservation'], 'command': row['command'], 'rows': row['beforePublic']['frame_rows'],
            'later': row['afterPublic']['frame_rows'], 'proposal': proposal, 'index': 0, 'expected': output, 'stateAfter': state(family)}))
    continuation = all_sessions[0]['steps'][2]
    cp = deepcopy(continuation['proposal']); cpub = deepcopy(continuation['afterPublic']); cobs = deepcopy(continuation['afterObservation'])
    cf = PreviewPacking(); cf.restore(deepcopy(continuation['stateAfterPropose']))
    continuation_cases = []
    for label, changed in [('known-preview-continuation', deepcopy(cpub)), ('unrelated-raster-change-after-first-action', deepcopy(cpub))]:
        if label.startswith('unrelated'): changed['frame_rows'][0][0] = 11
        continuation_cases.append(plain({'id': label, 'proposal': cp, 'public': changed, 'observation': cobs, 'index': 1,
            'expected': cf.before(cp, 1, SimpleNamespace(**changed), cobs)}))
    after_cases = []
    for label in ('known-preview-matches', 'unchanged-preview-diverges', 'epoch-boundary', 'score-only-boundary'):
        later = deepcopy(continuation['afterPublic']['frame_rows']); after = deepcopy(continuation['afterObservation'])
        if label == 'unchanged-preview-diverges': later = deepcopy(continuation['beforePublic']['frame_rows'])
        elif label == 'epoch-boundary': after['level_epoch'] += 1
        elif label == 'score-only-boundary': after['levels_completed'] += 1
        after_cases.append(plain({'id': label, 'proposal': cp, 'index': 0, 'beforeObservation': continuation['beforeObservation'],
            'afterObservation': after, 'rows': continuation['beforePublic']['frame_rows'], 'later': later,
            'expected': cf.after(cp, 0, continuation['beforeObservation'], after, continuation['beforePublic']['frame_rows'], later)}))
    return {'state': row['stateAfterPropose'], 'cases': cases, 'continuationState': continuation['stateAfterPropose'],
            'continuations': continuation_cases, 'after': after_cases}, records


def state_variants(all_sessions):
    row = all_sessions[0]['steps'][2]
    variants = []
    interventions = [('unchanged-state-after-acquisition', None), ('remove-only-learned-controls', 'packing_controls'),
                     ('remove-only-events-keeps-acquired-model', 'packing_events'), ('clear-scene-cache-keeps-current-model', '_packing_scene_cache')]
    for label, field in interventions:
        initial = deepcopy(row['stateBefore'])
        if field: initial[field] = [] if field == 'packing_events' else {}
        family = PreviewPacking(); family.restore(initial)
        proposal = family.propose(row['beforeObservation'], row['beforePublic']['frame_rows'], row['inputs'], row['remaining'])
        variants.append(plain({'id': label, 'origin': 'declared-synthetic-state-intervention', 'stateBefore': initial,
            'public': row['beforePublic'], 'observation': row['beforeObservation'], 'inputs': row['inputs'], 'remaining': row['remaining'],
            'proposal': proposal, 'stateAfter': state(family)}))
    def add(label, initial, public, observation):
        family = PreviewPacking(); family.restore(deepcopy(initial))
        inputs = ObservedInputDomain(250).candidates(observation)
        proposal = family.propose(observation, public['frame_rows'], inputs, 80)
        variants.append(plain({'id': label, 'origin': 'declared-synthetic-state-intervention', 'stateBefore': initial,
            'public': public, 'observation': observation, 'inputs': inputs, 'remaining': 80,
            'proposal': proposal, 'stateAfter': state(family)}))
    first = all_sessions[0]['steps'][0]
    initial = state(PreviewPacking()); initial['_packing_scene_cache'] = {'1': None}
    add('null-scene-cache-is-sticky-within-epoch', initial, first['beforePublic'], first['beforeObservation'])
    pub = deepcopy(first['beforePublic']); pub['level'] = 2
    add('new-epoch-remeasures-after-null-cache', initial, pub, observe(SimpleNamespace(**pub)))
    initial = deepcopy(first['stateAfter']); initial['packing_controls'] = {}
    m = initial['packing_model']; chosen = next(p for p in m['pieces'] if p['id'] == m['selected'])
    m['tried'] = [{'action': f'ACTION{i}', 'pose': [chosen['anchor'], chosen['mask']]} for i in range(1, 6)]
    add('exhausted-current-control-trials-block-unrelated-probe', initial, first['afterPublic'], first['afterObservation'])
    initial = deepcopy(first['stateAfter']); initial['packing_model']['board'] = [[0, 0], [0, 1], [1, 0]]
    add('missing-conditional-partition-blocks-unrelated-probe', initial, first['afterPublic'], first['afterObservation'])
    initial = deepcopy(first['stateAfter']); m = initial['packing_model']; solution = plain(assignments(m))['packing_assignments'][0]
    for piece in m['pieces']:
        pose = next(p for p in solution['poses'] if p['piece_ref'] == piece['id'])
        piece.update(anchor=pose['anchor'], mask=pose['mask'])
    add('geometric-partition-does-not-claim-official-completion', initial, first['afterPublic'], first['afterObservation'])
    return variants


def assertions(fixture):
    initial = {row['id']: row for row in fixture['initial']}
    for name in ('two-dominoes-source-piece-order', 'two-asymmetric-pieces-and-first-minimum', 'fixed-interior-occurrence-is-preserved',
                 'candidate-click-list-is-not-eligibility', 'translated-public-lattice', 'permuted-palette-including-two-digit-values'):
        assert initial[name]['proposal'] and initial[name]['proposal']['status'] == 'proposed', name
    for name in ('remaining-zero', 'selection-command-unavailable', 'all-commands-unavailable', 'outside-area-does-not-cover-residual', 'broken-frame-ring', 'point-with-two-measured-owners', 'point-with-no-measured-owner'):
        assert initial[name]['proposal'] is None, name
    first = fixture['sessions'][0]['steps']
    assert first[0]['record']['events'][0]['detail']['selection_observed'] is True
    assert first[1]['stateAfter']['packing_controls'], 'unit control genuinely acquired'
    assert first[3]['record']['boundary'] is True and first[3]['record']['events'] == []
    assert first[3]['stateAfter'] == first[3]['stateAfterPropose'], 'epoch boundary leaves source model unchanged'
    assert len(first[2]['proposal']['actions']) > 1, 'learned transport yields a real multi-action prefix'
    assert all(r['expected']['admitted'] is False for r in fixture['guards']['cases'][1:])
    assert all(r['expected']['admitted'] is True for r in fixture['guards']['continuations'])
    variants = {r['id']: r for r in fixture['stateVariants']}
    for name in ('exhausted-current-control-trials-block-unrelated-probe', 'missing-conditional-partition-blocks-unrelated-probe', 'geometric-partition-does-not-claim-official-completion'):
        assert variants[name]['proposal']['block_unrelated_probe'] is True, name
    assert variants['null-scene-cache-is-sticky-within-epoch']['proposal'] is None
    assert variants['new-epoch-remeasures-after-null-cache']['proposal']['status'] == 'proposed'
    for row in fixture['records']:
        assert row['expected'] is None and row['stateBefore'] == row['stateAfter']


def capture_calls(capture, include_ablations=True, require_prefixes=False):
    # Share the strict public-capture reader. In particular, native proposal
    # arguments and native restore values never initialize original methods.
    spec = importlib.util.spec_from_file_location('preview_cold_reader', ROOT / 'scripts/compare-preview-packing-public-parity.py')
    reader = importlib.util.module_from_spec(spec); spec.loader.exec_module(reader)
    oracle = SimpleNamespace(PreviewPacking=PreviewPacking, state=state, plain=plain, measure=measure,
        REF=REF, ObservedInputDomain=ObservedInputDomain)
    return reader.compare_capture(capture, oracle, include_ablations, require_prefixes)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out', type=Path, default=ROOT / 'tests/fixtures/v6-preview-packing/reference.json.gz')
    parser.add_argument('--receipt', type=Path, required=True)
    parser.add_argument('--calls', type=Path)
    parser.add_argument('--without-ablations', action='store_true')
    parser.add_argument('--require-prefixes', action='store_true')
    args = parser.parse_args()
    start = time.monotonic(); started = datetime.datetime.now(datetime.timezone.utc).isoformat()
    receipt = {'schema': 'sra.preview-packing-recovery-oracle-execution.v1', 'startedAt': started,
               'python': platform.python_version(), 'pythonHashSeed': os.environ.get('PYTHONHASHSEED'),
               'script': fingerprint(Path(__file__)), 'sourceBefore': SOURCE_BEFORE,
               'historicalReceiptsRecreated': False, 'gameExecution': False}
    exit_code = 0
    try:
        assert not args.receipt.exists(), 'Retain previous attempt receipt; choose a new receipt path'
        assert os.environ.get('PYTHONHASHSEED') == '0', 'Run with PYTHONHASHSEED=0'
        if args.calls:
            data = args.calls.read_bytes(); capture = json.loads(gzip.decompress(data) if args.calls.suffix == '.gz' else data)
            assert not args.out.exists(), 'Preserve the former capture comparison output'
            fixture = capture_calls(capture, not args.without_ablations, args.require_prefixes); receipt['capture'] = fingerprint(args.calls)
        else:
            family = PreviewPacking(); series = sessions(); guards, records = guards_and_records(series)
            fixture = {'provenance': {'commit': COMMIT, 'observationScope': SCOPE,
                'scope': 'Unchanged original component and consumed V5 calculus on synthetic public inputs, not router/game parity.',
                'normalization': 'JSON tuple/list transport only; no proposal, event, mask, piece, assignment, solution or control order normalized.',
                'recovery': 'Freshly generated after loss of former local6A; not a reconstruction of historical evidence.'},
                'configuration': plain(family.config), 'initial': initial_cases(), 'sessions': series,
                'helpers': helper_cases(), 'guards': guards, 'records': records, 'stateVariants': state_variants(series)}
            assertions(fixture)
        paths = {Path(m.__file__).resolve() for m in tuple(sys.modules.values()) if getattr(m, '__file__', None) and Path(m.__file__).resolve().is_relative_to(REF)}
        paths.add(REF / 'agents/yf_arc3_v6/morphology_policy/preview_packing/preview.drm')
        fixture.setdefault('provenance', {}).update(commit=COMMIT, sources={str(p.relative_to(REF)): fingerprint(p) for p in sorted(paths)})
        payload = (json.dumps(plain(fixture), separators=(',', ':')) + '\n').encode()
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_bytes(gzip.compress(payload, mtime=0) if args.out.suffix == '.gz' else payload)
        if args.calls:
            receipt['counts'] = fixture['counts']
            receipt['output'] = {'path': str(args.out.relative_to(ROOT)), **fingerprint(args.out)}
            assert fixture['status'] == 'passed', 'Cold original comparison failed; full result retained'
        receipt.update(status='passed', output={'path': str(args.out.relative_to(ROOT)), **fingerprint(args.out)}, rawBytes=len(payload),
            importedSourceFiles=len(paths), initialCases=len(fixture.get('initial', [])), sessions=len(fixture.get('sessions', [])),
            sourceSteps=sum(len(s['steps']) for s in fixture.get('sessions', [])),
            helpers={k: len(v) for k, v in fixture.get('helpers', {}).items()}, guards=len(fixture.get('guards', {}).get('cases', [])),
            records=len(fixture.get('records', [])), stateVariants=len(fixture.get('stateVariants', [])))
    except Exception as error:
        exit_code = 1
        receipt.update(status='failed', errorType=type(error).__name__, error=str(error), traceback=traceback.format_exc())
    finally:
        receipt['sourceAfter'] = verify_original()
        assert receipt['sourceAfter'] == receipt['sourceBefore']
        receipt.update(elapsedSeconds=time.monotonic()-start, finishedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(), exitCode=exit_code)
        args.receipt.parent.mkdir(parents=True, exist_ok=True)
        if not args.receipt.exists(): args.receipt.write_text(json.dumps(receipt, indent=2)+'\n')
        print(json.dumps(receipt, indent=2))
    return exit_code


if __name__ == '__main__':
    raise SystemExit(main())
