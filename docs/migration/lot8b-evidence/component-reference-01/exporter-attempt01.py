#!/usr/bin/env python3
"""Pinned BranchRouting on independently constructed small public rasters.

No game, game trace, native module, or native result is loaded. Pure geometry
and source object calls are captured without edits to the pinned modules.
Snapshot restoration is an explicit tuple/set representation adapter because
the original class has no state/restore API. Counterfactual seeds are marked.
"""
from __future__ import annotations

import argparse
from collections import Counter
from copy import deepcopy
from datetime import datetime, timezone
import hashlib
import importlib
import json
from pathlib import Path
import signal
import sys
import time
import traceback
from types import SimpleNamespace

ROOT = Path(__file__).resolve().parents[1]
COMMIT = '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e'
SOURCE = ROOT / 'reference/v6' / COMMIT / 'source'
MANIFEST = SOURCE.parent / 'manifest.json'
sys.dont_write_bytecode = True


def sha(path):
    d = hashlib.sha256()
    with Path(path).open('rb') as f:
        for block in iter(lambda: f.read(1024 * 1024), b''):
            d.update(block)
    return d.hexdigest()


def fp(path):
    path = Path(path)
    return {'path': path.relative_to(ROOT).as_posix(), 'bytes': path.stat().st_size, 'sha256': sha(path)}


def plain(value):
    if isinstance(value, dict): return {key: plain(child) for key, child in value.items()}
    if isinstance(value, (tuple, list)): return [plain(child) for child in value]
    if isinstance(value, (set, frozenset)): return [plain(child) for child in sorted(value)]
    if hasattr(value, 'tolist'): return plain(value.tolist())
    if hasattr(value, 'item'): return value.item()
    return value


def tupled(value):
    return tuple(tupled(child) for child in value) if isinstance(value, list) else value


def verify_sources():
    manifest = json.loads(MANIFEST.read_text())
    assert manifest['commit'] == COMMIT and len(manifest['files']) == 1786
    for name, record in manifest['files'].items():
        p = SOURCE / name
        assert p.stat().st_size == record['bytes'] and sha(p) == record['sha256'], name
    return len(manifest['files'])


def snapshot(owner):
    return {'format': 'native.branch_routing.v1', **{k: plain(v) for k, v in vars(owner).items()}}


def restore_source(value):
    owner = original.BranchRouting()
    for name, value in deepcopy(value).items():
        if name == 'format': continue
        if name == 'motion': value = {key: tuple(child) for key, child in value.items()}
        elif name == 'seen': value = {tupled(child) for child in value}
        elif name == 'verified': value = set(value)
        elif name == 'current': value = tupled(value)
        elif name == 'model' and value is not None:
            value['goals'] = tuple(value['goals']); value['sources'] = tuple(value['sources'])
            for bar in value['bars']: bar['position'] = tuple(bar['position'])
        elif name == 'events':
            for event in value:
                event['before'] = tupled(event['before'])
                if event['after'] is not None: event['after'] = tupled(event['after'])
        setattr(owner, name, value)
    return owner


def paint(rows, box, color):
    l, t, r, b = box
    assert 0 <= l <= r < len(rows[0]) and 0 <= t <= b < len(rows)
    for y in range(t, b + 1):
        for x in range(l, r + 1): rows[y][x] = color


def raster(positions=((8, 6),), selected=0, goals=(1, 4), source=3,
           missing=False, diagonal=False, extra_cavity_group=False):
    """Rectangle/cap/U construction only; movements are named interventions."""
    rows = [[0] * 26 for _ in range(28)]
    paint(rows, [0, source * 2, 1, source * 2 + 1], 6)
    paint(rows, [2, source * 2, 3, source * 2 + 1], 7)
    for goal in goals:
        y = goal * 2
        paint(rows, [20, y - 1, 22, y + 2], 8)
        paint(rows, [20, y, 21, y + 1], 0)
    if extra_cavity_group:
        for y in (14, 20):
            paint(rows, [20, y - 1, 22, y + 2], 9)
            paint(rows, [20, y, 21, y + 1], 0)
    if not missing:
        for i, (x, y) in enumerate(positions):
            paint(rows, [x, y, x + 1, y + 3], 4 if i == selected else 3)
    return rows


PLAIN_INPUTS = [{'action_ref': 'ACTION' + str(i)} for i in range(1, 6)]


def frame(label, rows, revision=1, epoch=1, completed=0, state='NOT_FINISHED', inputs=None):
    assert len(rows) <= 32 and len(rows[0]) <= 32
    commands = deepcopy(PLAIN_INPUTS if inputs is None else inputs)
    frame_hash = hashlib.sha256(json.dumps(rows, separators=(',', ':')).encode()).hexdigest()[:16]
    public = {'frame_rows': deepcopy(rows), 'frame_packet': [deepcopy(rows)], 'frame_hash': frame_hash,
              'level': epoch, 'levels_completed': completed, 'state': state, 'step_index': revision - 1,
              'available_action_refs': list(dict.fromkeys(c['action_ref'] for c in commands))}
    entities = [{
        'id': part['id'], 'bbox': part['bbox'], 'area': part['area'], 'mask': plain(part['mask']),
        'rectangular': part['rectangular'], 'palette_value': part['color'],
        'position': part['bbox'][:2],
    } for part in components(rows)]
    observation = {'observation_ref': 'O_synthetic_branches_' + label, 'frame_hash': frame_hash,
                   'level_epoch': epoch, 'levels_completed': completed, 'state': state,
                   'available_action_refs': public['available_action_refs'], 'entities': entities}
    return {'public': public, 'observation': observation, 'inputs': commands}


def checked_model(frame):
    m = original.layout(deepcopy(frame['observation']), deepcopy(frame['public']['frame_rows']), deepcopy(frame['inputs']))
    if m:
        assert len(m['bars']) <= 3 and m['limit'] <= 16
        product_size = 1
        for bar in m['bars']: product_size *= max(0, m['limit'] - bar['length'] + 1)
        assert product_size <= 4096
    return m


def run_scenario(label, specs, frames, initial=None, provenance=None):
    owner = original.BranchRouting() if initial is None else restore_source(initial)
    item = {'id': label, 'initialState': snapshot(owner), 'initialStateOrigin': provenance or {'kind': 'cold_original_constructor'}, 'steps': []}
    proposal = None
    for source_spec in specs:
        spec = deepcopy(source_spec); operation = spec['operation']; result = None
        if operation == 'propose':
            f = frames[spec['frame']]
            # The prospective Cartesian domains are checked before source search.
            m = checked_model(f) if f['observation']['level_epoch'] != owner.epoch else owner.model
            if m:
                assert len(m['bars']) <= 3 and m['limit'] <= 16
                matches = [sum(e['rectangular'] and e['bbox'][2] - e['bbox'][0] + 1 == m['unit'] * (b['length'] if m['tangent'] == 0 else 1)
                               and e['bbox'][3] - e['bbox'][1] + 1 == m['unit'] * (b['length'] if m['tangent'] == 1 else 1)
                               for e in f['observation']['entities']) for b in m['bars']]
                size = 1
                for n in matches: size *= n
                assert size <= 4096
            result = proposal = owner.propose(deepcopy(f['observation']), deepcopy(f['public']['frame_rows']),
                                             deepcopy(f['inputs']), spec.get('remaining', 16))
        elif operation == 'bind':
            assert proposal is not None
            f = frames[spec['frame']]
            records = [{'point': [c['data']['x'], c['data']['y']],
                        'binding': {'binding_id': 'B_branches_' + str(j), 'coordinate': [c['data']['x'], c['data']['y']],
                                    'observation_ref': f['observation']['observation_ref'],
                                    'arbitrary_witness': {'origin': 'independent_contract', 'index': j}}}
                       for j, c in enumerate(f['inputs']) if c.get('data')]
            spec['records'] = records
            domain = SimpleNamespace(bindings={(f['observation']['level_epoch'], f['observation']['frame_hash']):
                                              {tuple(r['point']): r['binding'] for r in records}})
            result = owner.bind(proposal, domain); spec['proposalAfter'] = plain(deepcopy(proposal))
        elif operation == 'before':
            assert proposal is not None
            f = frames[spec['frame']]; public, observed = deepcopy(f['public']), deepcopy(f['observation'])
            public.update(deepcopy(spec.get('publicPatch', {}))); observed.update(deepcopy(spec.get('observationPatch', {})))
            result = owner.before(proposal, spec.get('index', 0), SimpleNamespace(**public), observed)
        elif operation in ('after', 'record'):
            assert proposal is not None
            a, b = frames[spec['before']], frames[spec['after']]; i = spec.get('index', 0)
            args = [deepcopy(a['observation']), deepcopy(b['observation']),
                    deepcopy(a['public']['frame_rows']), deepcopy(b['public']['frame_rows'])]
            if operation == 'after': result = owner.after(proposal, i, *args)
            else: result = owner.record(args[0], args[1], deepcopy(proposal['actions'][i]), args[2], args[3], proposal, i)
        elif operation == 'restore': owner = restore_source(json.loads(json.dumps(snapshot(owner))))
        else: raise AssertionError(operation)
        spec['result'] = plain(deepcopy(result)); spec['afterState'] = snapshot(owner)
        item['steps'].append(spec)
    return item


def make_corpus():
    frames = {}
    def add(label, rows=None, **kwargs):
        frames[label] = frame(label, raster() if rows is None else rows, **kwargs)
        return frames[label]
    add('base'); add('north', raster(((8, 4),)), revision=2)
    add('south', revision=3); add('west', raster(((6, 6),)), revision=4); add('east', revision=5)
    add('aligned', raster(((8, 4),)), revision=6); add('propagation_no_score', raster(((8, 4),)), revision=7)
    add('next_epoch', revision=8, epoch=2, completed=1)
    add('diagonal', raster(((10, 8),)), revision=2)
    add('missing', raster(missing=True), revision=2)
    add('official_epoch', raster(((8, 4),)), revision=7, epoch=2)
    add('official_state', raster(((8, 4),)), revision=7, state='WIN')
    add('official_score', raster(((8, 4),)), revision=7, completed=1)
    add('empty_new_epoch', [[0] * 26 for _ in range(28)], revision=8, epoch=2, completed=1)
    add('missing_commit', inputs=PLAIN_INPUTS[:4])
    add('two_commits', inputs=PLAIN_INPUTS + [{'action_ref': 'ACTION7'}])
    add('unicode_refs', inputs=[{'action_ref': '\U00010000'}, {'action_ref': '\ue000'}])
    add('mirror', [list(reversed(row)) for row in raster()])
    add('transpose', list(map(list, zip(*raster()))))
    add('mirror_transpose', list(map(list, zip(*[list(reversed(row)) for row in raster()]))))
    rows = raster(); paint(rows, [20, 1, 22, 4], 0); paint(rows, [20, 2, 22, 5], 8); paint(rows, [20, 3, 21, 4], 0)
    add('non_unit_goal', rows)
    add('one_cavity', raster(goals=(1,)))
    add('two_highlights', raster(((6, 6), (12, 10)), selected=0))
    add('two_candidate_groups', raster(extra_cavity_group=True))
    rows = raster(); paint(rows, [0, 6, 3, 7], 0)
    paint(rows, [0, 7, 1, 8], 6); paint(rows, [2, 7, 3, 8], 7)
    add('source_off_phase', rows)
    rows = raster(((8, 2),)); paint(rows, [8, 10, 9, 13], 4); add('ambiguous_pose', rows)
    rows = raster(); paint(rows, [8, 6, 9, 9], 12); add('selection_missing', rows)
    click_inputs = deepcopy(PLAIN_INPUTS) + [
        {'action_ref': 'ACTION6', 'data': {'x': 7, 'y': 11}},
        {'action_ref': 'ACTION6', 'data': {'x': 6, 'y': 10}},
    ]
    triple = ((6, 10), (10, 0), (14, 12))
    for label, poses, selected, rev in [
        ('triple', triple, 2, 1), ('triple_north', ((6, 10), (10, 0), (14, 10)), 2, 2),
        ('triple_south', triple, 2, 3), ('triple_west', ((6, 10), (10, 0), (12, 12)), 2, 4),
        ('triple_east', triple, 2, 5), ('triple_selected', triple, 0, 6),
        ('triple_moved', ((6, 8), (10, 0), (14, 12)), 0, 7),
    ]:
        add(label, raster(poses, selected=selected, goals=(3, 6), source=4), revision=rev, inputs=click_inputs)
    models = {name: checked_model(frames[name]) for name in ('base', 'mirror', 'transpose', 'mirror_transpose', 'triple')}
    assert models['base'] and models['triple']
    geometry = []
    def geom(label, operation, args, result):
        geometry.append({'id': label, 'operation': operation, 'arguments': plain(args), 'result': plain(result)})
    for name in ('base', 'mirror', 'transpose', 'mirror_transpose', 'non_unit_goal', 'one_cavity', 'two_highlights', 'two_candidate_groups'):
        f = frames[name]
        geom(name, 'layout', {'frame': name}, checked_model(f))
    for name in ('base', 'transpose'):
        m = models[name]; pos = m['bars'][0]['position']
        geom(name, 'bbox', {'model': m, 'position': pos, 'length': 2}, original.bbox(pos, 2, m))
    for name, positions in [('base', ((8, 6),)), ('base', ((-1, 6),)), ('base', ((25, 6),))]:
        geom('read_' + str(len(geometry)), 'read_state', {'frame': name, 'model': models['base'], 'expected': positions},
             original.read_state(frames[name]['public']['frame_rows'], models['base'], positions))
    for name in ('base', 'ambiguous_pose', 'selection_missing'):
        geom(name, 'observed_state', {'frame': name, 'model': models['base'], 'prior': ((8, 6),)},
             original.observed_state(frames[name]['observation'], models['base'], ((8, 6),)))
    for label, starts, model in [('visible', (2,), models['base']), ('offscreen', (0,), {**models['base'], 'sources': (0,)})]:
        geom(label, 'propagated', {'model': model, 'starts': starts, 'withExits': True}, original.propagated(starts, model, with_exits=True))
    geom('source_off_phase', 'layout', {'frame': 'source_off_phase'}, checked_model(frames['source_off_phase']))
    box = [-4, -4, 28, 30]; cut = projection(frames['base']['public']['frame_rows'], box)
    geom('negative_clipped_numpy_projection', 'projection_digest', {'frame': 'base', 'box': box}, {'rows': cut, 'digest': rows_digest(cut)})
    assert len(geometry) == 20
    assert all(case['result'] is None for case in geometry[4:8])
    def op(operation, **kwargs): return {'operation': operation, **kwargs}
    def calibrate(prefix=''):
        names = [prefix + n for n in ('base', 'north', 'south', 'west', 'east')]
        if prefix: names[0] = 'triple'
        return [spec for a, b in zip(names, names[1:]) for spec in [op('propose', frame=a), op('record', before=a, after=b)]]
    cold = run_scenario('cold_four_calibrations_move_propagate_epoch', calibrate() + [
        op('propose', frame='east'), op('before', frame='east'), op('after', before='east', after='aligned'), op('record', before='east', after='aligned'),
        op('propose', frame='aligned'), op('before', frame='aligned'), op('after', before='aligned', after='propagation_no_score'),
        op('record', before='aligned', after='propagation_no_score'), op('propose', frame='propagation_no_score'), op('restore'),
        op('propose', frame='next_epoch'), op('restore'),
    ], frames)
    scenarios = [cold]
    acquired = deepcopy(cold['steps'][7]['afterState'])
    assert acquired['motion'] == {'ACTION1': [0, -2], 'ACTION2': [0, 2], 'ACTION3': [-2, 0], 'ACTION4': [2, 0]}
    assert [s['result']['steps'][0]['mode'] for s in cold['steps'] if s['operation'] == 'propose' and s['result']][:6] == ['calibrate'] * 4 + ['move', 'propagate']
    derived = {'kind': 'retained_original_acquisition', 'scenario': cold['id'], 'stepIndex': 7}
    triple = run_scenario('cold_equal_cost_select_first_point_bind_move', calibrate('triple_') + [
        op('propose', frame='triple_east'), op('bind', frame='triple_east'), op('before', frame='triple_east'),
        op('after', before='triple_east', after='triple_selected'), op('record', before='triple_east', after='triple_selected'),
        op('propose', frame='triple_selected'), op('before', frame='triple_selected'),
        op('after', before='triple_selected', after='triple_moved'), op('record', before='triple_selected', after='triple_moved'),
        op('propose', frame='triple_moved'),
    ], frames)
    assert triple['steps'][8]['result']['steps'][0]['mode'] == 'select'
    assert triple['steps'][8]['result']['actions'][0]['data'] == {'x': 7, 'y': 11}
    scenarios.append(triple)
    scenarios.append(run_scenario('guards_and_official_score_early_return', [
        op('propose', frame='aligned'), op('before', frame='aligned'),
        op('before', frame='aligned', publicPatch={'level': 2}), op('before', frame='aligned', publicPatch={'levels_completed': 1}),
        op('before', frame='aligned', publicPatch={'available_action_refs': []}),
        op('before', frame='aligned', observationPatch={'observation_ref': 'O_changed'}),
        op('before', frame='base', observationPatch={'observation_ref': frames['aligned']['observation']['observation_ref']}),
        op('after', before='aligned', after='official_epoch'), op('after', before='aligned', after='official_state'),
        op('after', before='aligned', after='official_score'), op('record', before='aligned', after='official_score'), op('restore'),
    ], frames, acquired, derived))
    scenarios.append(run_scenario('contrary_measured_move_revises_motion', [
        op('propose', frame='east'), op('before', frame='east'), op('after', before='east', after='diagonal'),
        op('record', before='east', after='diagonal'), op('propose', frame='diagonal'), op('restore'),
    ], frames, acquired, derived))
    scenarios.append(run_scenario('cold_diagonal_response_is_not_axial_acquisition', [
        op('propose', frame='base'), op('after', before='base', after='diagonal'), op('record', before='base', after='diagonal'),
        op('propose', frame='diagonal'), op('restore'),
    ], frames))
    scenarios.append(run_scenario('cold_missing_response_retains_unknown', [
        op('propose', frame='base'), op('record', before='base', after='missing'), op('propose', frame='missing'), op('restore'),
    ], frames))
    scenarios.append(run_scenario('remaining_and_unique_propagation_command', [
        op('propose', frame='east', remaining=0), op('propose', frame='east', remaining=1),
        op('propose', frame='missing_commit'), op('propose', frame='two_commits'),
    ], frames, acquired, derived))
    for label, change in [
        ('five_distinct_vectors_are_not_ready', lambda st: st['motion'].update({'ACTION7': [0, 4]})),
        ('four_non_unit_vectors_do_not_supply_unit_route', lambda st: st['motion'].update({'ACTION1': [0, -4]})),
        ('duplicate_route_vector_is_not_unique_key', lambda st: st['motion'].update({'ACTION7': [0, -2]})),
    ]:
        seed = deepcopy(acquired); change(seed)
        scenarios.append(run_scenario(label, [op('propose', frame='east'), op('restore')], frames, seed,
            {'kind': 'declared_retained_counterfactual', 'base': derived, 'changedField': 'motion',
             'purpose': label, 'newPhysicalAcquisitionClaim': False}))
    score_state = scenarios[2]['steps'][10]['afterState']
    scenarios.append(run_scenario('epoch_resets_current_authority_retains_learned_history', [
        op('propose', frame='empty_new_epoch'), op('restore'), op('propose', frame='empty_new_epoch'),
    ], frames, score_state, {'kind': 'retained_original_acquisition', 'scenario': scenarios[2]['id'], 'stepIndex': 10}))
    scenarios.append(run_scenario('unicode_control_order_and_python_digest', [op('propose', frame='unicode_refs'), op('restore')], frames))
    assert len(scenarios) == 12 and sum(len(s['steps']) for s in scenarios) <= 100
    assert scenarios[-1]['steps'][0]['result']['actions'][0]['action_ref'] == '\ue000'
    score = scenarios[2]['steps'][10]
    assert score['result']['status'] == 'official_boundary' and score['afterState']['finished'] is False
    assert len(score['afterState']['events']) == len(acquired['events'])
    assert cold['steps'][15]['afterState']['passed'] == []
    return {'frames': frames, 'geometry': geometry, 'scenarios': scenarios}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', required=True, type=Path)
    parser.add_argument('--receipt', required=True, type=Path)
    args = parser.parse_args()
    out, receipt = args.output.resolve(), args.receipt.resolve()
    assert not out.exists() and not receipt.exists()
    out.parent.mkdir(parents=True, exist_ok=True); receipt.parent.mkdir(parents=True, exist_ok=True)
    record = {'schema': 'logos-engine.v6.branch-routing-reference-execution.v1', 'status': 'running',
              'startedAt': datetime.now(timezone.utc).isoformat(), 'timeoutSeconds': 60,
              'maximumRasterWidth': 32, 'maximumRasterHeight': 32, 'maximumBars': 3,
              'maximumLimit': 16, 'maximumCartesianCandidatesPerCall': 4096,
              'maximumStatefulOperations': 100, 'globalLockAcquired': False, 'performanceMeasurement': False,
              'nativeImports': False, 'gamePayloadsInterpreted': 0, 'gameActionsDispatched': 0,
              'sourceModified': False, 'generator': fp(Path(__file__))}
    def write_receipt(): receipt.write_text(json.dumps(record, indent=2, ensure_ascii=False) + '\n')
    write_receipt(); start = time.monotonic(); before = None
    def timeout(signum, frame): raise TimeoutError('Bounded original reference execution exceeded60seconds')
    signal.signal(signal.SIGALRM, timeout); signal.alarm(60)
    try:
        before = verify_sources(); record['sourceBeforeCount'] = before
        sys.path.insert(0, str(SOURCE / 'agents/yf_arc3_v6/laya_proto'))
        global original, components, rows_digest, projection
        original = importlib.import_module('common_branch_routing')
        geometry_module = importlib.import_module('geometric_observer')
        shared = importlib.import_module('common_multiscale_constraints')
        components, rows_digest, projection = geometry_module.components, shared.rows_digest, shared.projection
        modules = [original, geometry_module, shared]
        assert all(Path(m.__file__).resolve().is_relative_to(SOURCE) for m in modules)
        executed = Counter(); prefix = str(SOURCE) + '/'
        def profile(frame, event, arg):
            name = frame.f_code.co_filename
            if event == 'call' and name.startswith(prefix): executed[(name[len(prefix):], frame.f_code.co_firstlineno, frame.f_code.co_qualname)] += 1
        sys.setprofile(profile)
        corpus = make_corpus()
        sys.setprofile(None)
        after = verify_sources(); record['sourceAfterCount'] = after
        fixture = {'schema': 'logos-engine.v6.branch-routing-reference.v1', 'referenceCommit': COMMIT,
                   'sourceModified': False, 'sourceFilesVerifiedBeforeAndAfter': [before, after],
                   'generator': fp(Path(__file__)), 'sourceManifest': fp(MANIFEST),
                   'sourceHashes': {Path(m.__file__).relative_to(SOURCE).as_posix(): sha(m.__file__) for m in modules},
                   'inputOrigin': {'kind': 'independently_constructed_contract_geometry', 'gamePayloadsInterpreted': 0,
                                   'gameActionsDispatched': 0, 'nativeOracleAnswersInProduction': False, 'opaqueOriginalManifestIntegrityOnly': True},
                   'normalization': {'tuples': 'JSONarrays', 'sets': 'sortedJSONarrays',
                                     'restoreAdapter': 'The source has no state/restore API; constructor plus exact detached source attributes restores tuple/set representations only.',
                                     'counterfactuals': 'Declared retained counterfactuals start from a previously observed original acquisition snapshot, modify only the disclosed motion field and never claim fresh physical acquisition.'},
                   'bounds': {k: record[k] for k in ['maximumRasterWidth', 'maximumRasterHeight', 'maximumBars', 'maximumLimit', 'maximumCartesianCandidatesPerCall', 'maximumStatefulOperations']},
                   'executedSourceFunctions': [{'path': p, 'line': line, 'function': name, 'calls': count} for (p, line, name), count in sorted(executed.items())],
                   'qualification': 'Small synthetic component corpus only; no game data, live dispatch, original caller integration or solved-level claim. Complete original searches on declared small domains do not qualify native interrupted-search adaptations.',
                   **corpus}
        raw = (json.dumps(fixture, ensure_ascii=False, separators=(',', ':'), allow_nan=False) + '\n').encode()
        with out.open('xb') as f: f.write(raw)
        record.update(status='passed', fixture=fp(out), geometryCount=len(corpus['geometry']), scenarioCount=len(corpus['scenarios']),
                      statefulOperationCount=sum(len(s['steps']) for s in corpus['scenarios']), frameCount=len(corpus['frames']),
                      sourceFilesVerifiedBeforeAndAfter=[before, after], sourceHashes=fixture['sourceHashes'])
    except BaseException as error:
        sys.setprofile(None)
        record.update(status='failed', error={'type': type(error).__name__, 'message': str(error), 'traceback': traceback.format_exc()})
        try: record['sourceAfterCount'] = verify_sources()
        except Exception as verification_error: record['sourceAfterError'] = str(verification_error)
        raise
    finally:
        signal.alarm(0)
        record.update(finishedAt=datetime.now(timezone.utc).isoformat(), elapsedSeconds=time.monotonic() - start)
        write_receipt()
        print(json.dumps({k: record.get(k) for k in ['status', 'geometryCount', 'scenarioCount', 'statefulOperationCount', 'frameCount', 'elapsedSeconds']}), flush=True)


if __name__ == '__main__': main()
