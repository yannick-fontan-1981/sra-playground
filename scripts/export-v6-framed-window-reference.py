#!/usr/bin/env python3
"""Export immutable original FramedWindow contracts and consumed exact candidates.

Every expectation comes from the pinned Python originals. Public selection only
reads previously retained initial pixels; no game host, engine or solution is read.
External deterministic clocks expose finite-calculation contracts, not wall cost.
"""
from __future__ import annotations
import copy
import gzip
import hashlib
import json
from pathlib import Path
import sys
from types import SimpleNamespace
from unittest.mock import patch

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
COMMIT = '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e'
SOURCE = ROOT / 'reference/v6' / COMMIT / 'source'
MANIFEST = json.loads((SOURCE.parent / 'manifest.json').read_text())['files']
sys.path[:0] = [str(SOURCE), str(SOURCE / 'agents/yf_arc3_v6/laya_proto')]
import framed_window_access as original_window
from framed_window_access import FramedWindowAccess, measure, certify
from common_framed_window import FramedWindowConstraint
from rooted_quota_access import RootedQuotaAccess
from neutral_observer import measure as observe
from terminal_composition import identity
from src_bridge import plain
from agents.yf_arc3_v5.capabilities.temporal_fragment_match import TemporalFragmentRequest, measure_temporal_fragment_match
from agents.yf_arc3_v5.capabilities import mechanical_family_contracts_d as mechanical

POLICY_PATH = 'agents/yf_arc3_v6/morphology_policy/strategy.drm'
POLICY = json.loads((SOURCE / POLICY_PATH).read_text())['declarations'][0]['configuration']['window_constraints']['framed_window_composition']
INPUTS = [{'action_ref': 'ACTION' + str(i)} for i in range(1, 5)]
AVAILABLE = [a['action_ref'] for a in INPUTS] + ['ACTION6']
EVIDENCE = ROOT / 'docs/migration/lot3g-evidence/diagnostic'
NOW_MS, DEADLINE_MS = 100000, 101000


def sha(data): return hashlib.sha256(data).hexdigest()


def verify_source():
    for name, expected in MANIFEST.items():
        assert sha((SOURCE / name).read_bytes()) == expected['sha256'], name
    return len(MANIFEST)


def error_value(error):
    result = {'type': type(error).__name__}
    if hasattr(error, 'errors'):
        result['errors'] = [{'type': item['type'], 'loc': list(item['loc'])} for item in error.errors()]
    else:
        result['message'] = str(error)
    return result


class Clock:
    def __init__(self, ticks=(NOW_MS,)):
        self.ticks = list(ticks)
        self.calls = 0

    def __call__(self):
        value = self.ticks[min(self.calls, len(self.ticks) - 1)]
        self.calls += 1
        return value / 1000


def raster(reference=((2, 3, 2), (3, 2, 3)), *, matches=((3, 2),),
           reference_origin=(2, 2), image_origin=(12, 2), image_size=(10, 8),
           canvas=(40, 20), reference_border=1, image_border=1, palette=None):
    rows = [[0] * canvas[0] for _ in range(canvas[1])]
    def frame(origin, pixels, border):
        left, top = origin
        width, height = len(pixels[0]), len(pixels)
        for y in range(height + 2):
            for x in range(width + 2):
                rows[top + y][left + x] = border if x in (0, width + 1) or y in (0, height + 1) else pixels[y - 1][x - 1]
    image = [[4] * image_size[0] for _ in range(image_size[1])]
    for x, y in matches:
        for dy, line in enumerate(reference):
            for dx, value in enumerate(line):
                image[y + dy][x + dx] = value
    frame(reference_origin, reference, reference_border)
    frame(image_origin, image, image_border)
    if palette is not None:
        rows = [[palette.get(value, value) for value in line] for line in rows]
    return rows


def observation(rows, name='current', **changes):
    packet = SimpleNamespace(frame_rows=rows,
        frame_hash=sha(json.dumps(rows, separators=(',', ':')).encode())[:16],
        level=changes.pop('level_epoch', 1), levels_completed=changes.pop('levels_completed', 0),
        state=changes.pop('state', 'NOT_FINISHED'), available_action_refs=changes.pop('available_action_refs', AVAILABLE))
    value, _ = observe(packet, changes.pop('revision', 0), 'synthetic:framed-window:' + name)
    value.update(changes)
    return plain(value)


def state(memory):
    return plain({'projection': {'window_events': memory.window_events, 'window_blocked': memory.window_blocked},
        'parentDigest': RootedQuotaAccess.retained_digest(memory), 'digest': memory.retained_digest()})


def instance(seed=()):
    result = FramedWindowAccess()
    for event in copy.deepcopy(seed): result.apply_event(event)
    return result


def clocked(call, *, ticks=(NOW_MS,), perf_ms=NOW_MS):
    clock = Clock(ticks)
    with patch.object(original_window.time, 'perf_counter', lambda: perf_ms / 1000), patch.object(mechanical, 'monotonic', clock):
        result = call()
    return result, clock.calls


def scan_public():
    before = verify_source()
    corpus_path = 'tests/fixtures/v6-linked-packet-initial-public.json.gz'
    raw = (ROOT / corpus_path).read_bytes()
    corpus = json.loads(gzip.decompress(raw))
    assert corpus['sourceCommit'] == COMMIT and corpus['actions'] == corpus['levelJumps'] == 0
    excluded, cases = ['CWSE', 'SK48', 'FOGW', 'VOIS'], []
    for item in corpus['games']:
        if item['game'] in excluded: continue
        packet = item['packet']; rows = packet['frame_rows']
        assert packet['step_index'] == packet['levels_completed'] == 0
        digest = sha(json.dumps(rows, separators=(',', ':')).encode())
        assert digest[:16] == packet['frame_hash']
        row = {'game': item['game'], 'rowsSha256': digest}
        try: row['scene'] = plain(measure(rows))
        except Exception as error: row['scene'] = None; row['sourceError'] = error_value(error)
        cases.append(row)
    data = {'schema': 'logos-engine.framed-window-public-admission.v1', 'sourceCommit': COMMIT,
        'sourcePath': 'agents/yf_arc3_v6/laya_proto/framed_window_access.py',
        'sourceSha256': MANIFEST['agents/yf_arc3_v6/laya_proto/framed_window_access.py']['sha256'],
        'corpus': {'path': corpus_path, 'sha256': sha(raw), 'actions': 0, 'levelJumps': 0, 'excludedGames': excluded},
        'cases': cases, 'count': len(cases), 'admittedGames': [item['game'] for item in cases if item['scene']],
        'originalFilesVerifiedBefore': before, 'originalFilesVerifiedAfter': verify_source(),
        'scope': 'Only previously archived initial public pixels through unchanged framed_window_access.measure. Exclusions precede calls. No game host, engine, specification, route, solution, action or level jump; no native proposal.'}
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    target = EVIDENCE / 'framed-window-public-admission.json'
    target.write_text(json.dumps(data, indent=2) + '\n')
    print(json.dumps({'publicProjectionCases': len(cases), 'admittedGames': data['admittedGames'], 'sourceErrors': sum('sourceError' in item for item in cases)}))
    return data


def run_export():
    before_verified = verify_source()
    cases, guards, exceptions, kernel_cases, restore_cases, cold_replays = [], [], [], [], [], []

    def add(name, operation, arguments, call, seed=()):
        memory = instance(seed)
        entry = {'id': name, 'operation': operation, 'arguments': plain(arguments),
            'seedEvents': plain(list(seed)), 'beforeState': state(memory)}
        try:
            expected, calls = clocked(lambda: call(memory))
            entry['expected'] = plain(expected); entry['sourceClockCalls'] = calls
            if operation in ('propose', 'common_propose'):
                entry['expectedOwn'] = plain(expected) if expected and 'framed_window_plan' in expected else None
            if operation == 'record':
                entry['expectedOriginal'] = plain(expected)
                entry['expectedOwnEvents'] = plain([e for e in expected if e['kind'] == 'framed_window_response'])
            entry['afterState'] = state(memory); cases.append(entry)
            return plain(expected)
        except Exception as error:
            entry['expectedError'] = error_value(error); entry['afterState'] = state(memory)
            exceptions.append(entry)
            return None

    rows, blank = raster(), [[0] * 40 for _ in range(20)]
    variants = {
        'base': rows,
        'translated': raster(reference_origin=(4, 4), image_origin=(15, 4)),
        'palette_permuted': raster(palette={0: 10, 1: 6, 2: 0, 3: 12, 4: 7}),
        'reference_even_dimensions': raster(reference=((2, 3), (3, 2))),
        'reference_one_row': raster(reference=((2, 3, 2),)),
        'reference_one_column': raster(reference=((2,), (3,), (2,))),
        'unique_at_top_left': raster(matches=((0, 0),)),
        'unique_at_bottom_right': raster(matches=((7, 6),)),
        'no_match': raster(matches=()),
        'multiple_matches': raster(matches=((0, 0), (6, 5))),
        'uniform_reference': raster(reference=((2, 2), (2, 2))),
        'different_border': raster(image_border=5),
        'same_area_frames': raster(image_size=(3, 2), matches=((0, 0),)),
        'reference_at_left_edge': raster(reference_origin=(0, 2)),
        'reference_at_top_edge': raster(reference_origin=(2, 0)),
        'image_at_right_edge': raster(image_origin=(28, 2)),
        'image_at_bottom_edge': raster(image_origin=(12, 10)),
        'blank': blank,
    }
    variants['missing_reference_border_pixel'] = copy.deepcopy(rows); variants['missing_reference_border_pixel'][2][4] = 0
    variants['missing_image_border_pixel'] = copy.deepcopy(rows); variants['missing_image_border_pixel'][2][17] = 0
    variants['reference_single_pixel_change'] = copy.deepcopy(rows); variants['reference_single_pixel_change'][3][3] = 5
    variants['matching_window_single_pixel_change'] = copy.deepcopy(rows); variants['matching_window_single_pixel_change'][5][16] = 5
    variants['unrelated_outer_pixel_change'] = copy.deepcopy(rows); variants['unrelated_outer_pixel_change'][16][30] = 7
    variants['border_component_has_extra_interior_pixel'] = copy.deepcopy(rows); variants['border_component_has_extra_interior_pixel'][3][14] = 1
    extra = copy.deepcopy(rows)
    ref = ((2, 3, 2), (3, 2, 3))
    for yy in range(4):
        for xx in range(5): extra[13 + yy][2 + xx] = 1 if xx in (0, 4) or yy in (0, 3) else ref[yy - 1][xx - 1]
    variants['two_compatible_reference_pairs'] = extra
    for name, value in variants.items():
        add('measure:' + name, 'measure', {'rows': value}, lambda _m, value=value: measure(value))
    for name, value in [('empty_rows', []), ('ragged_rows', [[0, 0], [0]]), ('measurement_domain', [[0] * 257 for _ in range(256)])]:
        add('measure:' + name, 'measure', {'rows': value}, lambda _m, value=value: measure(value))

    scene, obs = measure(rows), observation(rows)
    assert scene is not None
    captured = []
    def capture(request):
        captured.append(plain(request.model_dump()))
        return measure_temporal_fragment_match(request)
    with patch.object(original_window, 'measure_temporal_fragment_match', capture):
        receipt = add('certify:current_unique_window', 'certify', {'scene': scene, 'observation': obs, 'deadlineMs': DEADLINE_MS, 'nowMs': NOW_MS},
            lambda _m: certify(scene, obs, DEADLINE_MS / 1000))
    request_base = captured[0]
    for name, deadline in [('elapsed_deadline_clamped_to_one_ms', NOW_MS - 100), ('far_deadline_clamped_to_300000_ms', NOW_MS + 400000)]:
        add('certify:' + name, 'certify', {'scene': scene, 'observation': obs, 'deadlineMs': deadline, 'nowMs': NOW_MS},
            lambda _m, deadline=deadline: certify(scene, obs, deadline / 1000))

    def kernel(name, change=None, ticks=(NOW_MS,), raw=None):
        data = copy.deepcopy(request_base if raw is None else raw)
        if change: change(data)
        entry = {'id': 'kernel:' + name, 'clockMs': list(ticks)}
        try:
            typed = copy.deepcopy(data)
            # model_dump is the retained transport, not an implicit constructor
            # for the original nominal immutable maps. Reconstitute only those
            # declared map slots through the unchanged source projector.
            for key in ('resume_frontier', 'memory_owner_scope_values'):
                if key in typed: typed[key] = mechanical.d_map(typed[key])
            for key in ('observations', 'memory_items'):
                if key in typed: typed[key] = tuple(mechanical.d_map(item) for item in typed[key])
            request = TemporalFragmentRequest(**typed)
            entry['request'] = plain(request.model_dump())
            expected, calls = clocked(lambda: measure_temporal_fragment_match(request), ticks=ticks)
            entry['expected'] = plain(expected.model_dump()); entry['sourceClockCalls'] = calls
        except Exception as error:
            entry['requestInput'] = plain(data); entry['expectedError'] = error_value(error)
        kernel_cases.append(entry)
        return entry

    kernel('complete_exact', raw=request_base)
    kernel('first_pixel_difference', lambda r: r['photos'][0]['frame']['rows'][2].__setitem__(3, 9))
    kernel('last_pixel_difference', lambda r: r['photos'][0]['frame']['rows'][3].__setitem__(5, 9))
    kernel('empty_windows', lambda r: r.__setitem__('windows', []))
    kernel('empty_windows_missing_reference_is_vacuous', lambda r: (r.__setitem__('windows', []), r.__setitem__('reference', None), r.__setitem__('reference_revision_ref', None)))
    kernel('missing_models', lambda r: r.__setitem__('models', []))
    kernel('duplicate_models', lambda r: r['models'].append(copy.deepcopy(r['models'][0])))
    kernel('signature_operation', lambda r: r.__setitem__('operation_ref', 'mechanics.temporal_fragment_match.unknown'))
    kernel('signature_mode', lambda r: r.__setitem__('mode_ref', 'STEP'))
    kernel('signature_result', lambda r: r.__setitem__('requested_result_type', 'OtherResult'))
    kernel('input_domain_incomplete', lambda r: r['scope'].__setitem__('input_domain_complete', False))
    kernel('missing_scope_owner', lambda r: r['scope'].__setitem__('event_owner_ref', ''))
    kernel('missing_reference', lambda r: r.__setitem__('reference', None))
    kernel('missing_reference_revision', lambda r: r.__setitem__('reference_revision_ref', None))
    kernel('missing_photo', lambda r: r.__setitem__('photos', []))
    kernel('duplicate_photo', lambda r: r['photos'].append(copy.deepcopy(r['photos'][0])))
    kernel('inadmissible_photo_content', lambda r: r['photos'][0].__setitem__('content_kind_ref', 'reference_content'))
    kernel('window_outside', lambda r: r['windows'][0].__setitem__('left', 100))
    kernel('unknown_equality_law', lambda r: r['models'][0].__setitem__('equality_law_ref', None))
    kernel('palette_relation_missing', lambda r: r['models'][0].__setitem__('equality_law_ref', 'declared_palette_relation'))
    def palette_relation(r):
        r['models'][0]['equality_law_ref'] = 'declared_palette_relation'
        r['models'][0]['palette_relation'] = [[2, 6], [3, 5]]
        r['photos'][0]['frame']['rows'] = [[{2:6,3:5}.get(value,value) for value in line] for line in r['photos'][0]['frame']['rows']]
    kernel('declared_palette_relation', palette_relation)
    kernel('duplicate_window_ref', lambda r: r['windows'].append(copy.deepcopy(r['windows'][0])))
    def second_window(r):
        r['windows'].append({**copy.deepcopy(r['windows'][0]), 'window_ref': 'W_other', 'left': 0, 'top': 0})
    kernel('two_windows_one_nonmatch', second_window)
    kernel('domain_bound', lambda r: (second_window(r), r.__setitem__('domain_bound', 1)))
    kernel('node_bound_one', lambda r: r.__setitem__('node_bound', 1))
    kernel('node_bound_six', lambda r: r.__setitem__('node_bound', 6))
    kernel('node_bound_exact_seven', lambda r: r.__setitem__('node_bound', 7))
    kernel('time_bound_at_first_visit', lambda r: r.__setitem__('time_bound_ms', 1), ticks=(NOW_MS, NOW_MS + 2))
    kernel('time_bound_during_pixels_original_overlay_exception', lambda r: r.__setitem__('time_bound_ms', 1), ticks=(NOW_MS, NOW_MS, NOW_MS + 2))
    kernel('time_bound_at_finish', lambda r: r.__setitem__('time_bound_ms', 1), ticks=(NOW_MS,) * 8 + (NOW_MS + 2,))
    def with_state(r):
        r['state'] = {'scene_ref': r['photos'][0]['scene_ref'], 'film_revision_ref': r['photos'][0]['film_revision_ref'],
            'reference_revision_ref': r['reference_revision_ref'], 'current_index': 0}
    kernel('explicit_current_state', with_state)
    kernel('state_reference_changed', lambda r: (with_state(r), r['state'].__setitem__('reference_revision_ref', 'changed-reference')))
    kernel('state_scene_changed', lambda r: (with_state(r), r['state'].__setitem__('scene_ref', 'changed-scene')))
    kernel('state_film_changed', lambda r: (with_state(r), r['state'].__setitem__('film_revision_ref', 'changed-film')))
    def two_models(r): r['models'].append({**copy.deepcopy(r['models'][0]), 'model_ref': 'M_second'})
    kernel('two_models_complete', two_models)
    kernel('two_models_interrupted_inside_pixels_original_overlay_exception', lambda r: (two_models(r), r.__setitem__('node_bound', 8)))
    interrupted = kernel('two_models_interrupted', lambda r: (two_models(r), r.__setitem__('node_bound', 7)))
    resumed = copy.deepcopy(interrupted['request']); resumed['resume_frontier'] = interrupted['expected']['frontier']; resumed['node_bound'] = 100000
    kernel('resume_completed_prefix', raw=resumed)
    kernel('resume_changed_evidence', lambda r: r['scope'].__setitem__('evidence_revision_ref', 'changed-evidence'), raw=resumed)
    kernel('resume_wrong_model_prefix', lambda r: r['resume_frontier']['completed_model_results'][0].__setitem__('model_ref', 'not-first'), raw=resumed)
    kernel('validation_zero_node_bound', lambda r: r.__setitem__('node_bound', 0))
    kernel('validation_negative_window_coordinate', lambda r: r['windows'][0].__setitem__('left', -1))
    kernel('validation_ragged_reference', lambda r: r.__setitem__('reference', {'rows': [[1,2],[1]]}))

    def propose_case(name, *, pixels=rows, value=obs, config=POLICY, limit=1, seed=(), deadline=DEADLINE_MS, include_deadline=True):
        args = {'observation': value, 'rows': pixels, 'inputs': INPUTS, 'limit': limit, 'config': config, 'nowMs': NOW_MS}
        if include_deadline: args['deadlineMs'] = deadline
        cfg = {**copy.deepcopy(config), **({'level_deadline': None if deadline is None else deadline / 1000} if include_deadline else {})}
        return add('propose:' + name, 'propose', args, lambda m: m.propose([], value, pixels, INPUTS, limit, cfg), seed)

    proposal = propose_case('fresh')
    assert proposal and proposal.get('framed_window_plan')
    propose_case('zero_limit', limit=0)
    propose_case('negative_limit_is_truthy', limit=-1)
    propose_case('large_limit_still_single_action', limit=100)
    propose_case('no_configuration', config={})
    propose_case('empty_configuration', config={'framed_window_question': {}})
    propose_case('unavailable_point', value={**obs, 'available_action_refs': ['ACTION1']})
    propose_case('no_match', pixels=variants['no_match'], value=observation(variants['no_match'], 'no-match'))
    propose_case('ambiguous_match', pixels=variants['multiple_matches'], value=observation(variants['multiple_matches'], 'ambiguous'))
    propose_case('elapsed_deadline_still_one_ms', deadline=NOW_MS - 10)
    propose_case('missing_deadline', include_deadline=False)
    propose_case('null_deadline', deadline=None)
    add('window_proposal:direct_measured', 'window_proposal', {'observation': obs, 'rows': rows, 'scene': scene, 'receipt': receipt,
        'key': proposal['framed_window_plan']['trial_key'], 'cfg': POLICY['framed_window_question']},
        lambda m: m.window_proposal(obs, rows, scene, receipt, proposal['framed_window_plan']['trial_key'], POLICY['framed_window_question']))

    def common_case(name, *, pixels=rows, value=obs, remaining=3, config=POLICY, seed=(), deadline=DEADLINE_MS):
        args = {'observation': value, 'rows': pixels, 'inputs': INPUTS, 'remaining': remaining,
            'config': config, 'deadlineMs': deadline, 'nowMs': NOW_MS}
        def call(memory):
            c = FramedWindowConstraint(); c.memory = memory; c.level_deadline = None if deadline is None else deadline / 1000
            return c.window_propose(value, pixels, INPUTS, remaining, config)
        return add('common:' + name, 'common_propose', args, call, seed)
    common = common_case('fresh')
    common_case('no_remaining', remaining=0)
    common_case('negative_remaining', remaining=-1)
    common_case('large_remaining', remaining=100)
    common_case('no_point', value={**obs, 'available_action_refs': ['ACTION1']})
    common_case('blank', pixels=blank, value=observation(blank, 'blank'))
    common_case('no_configuration', config={})
    common_case('missing_deadline', deadline=None)

    before_meta = {'epoch': obs['level_epoch'], 'score': obs['levels_completed'], 'observation_ref': obs['observation_ref'], 'available': AVAILABLE}
    def before_case(name, mutate=None, *, pixels=rows, meta=None, index=0):
        p = copy.deepcopy(common)
        if mutate: mutate(p)
        kwargs = {**before_meta, **(meta or {})}
        try:
            result = instance().before(p, index, pixels, **kwargs)
            guards.append({'id': 'before:' + name, 'phase': 'before', 'proposal': p, 'index': index, 'rows': pixels, 'meta': kwargs, 'expected': plain(result)})
        except Exception as error:
            exceptions.append({'id': 'before:' + name, 'operation': 'before', 'arguments': {'proposal': p, 'index': index, 'rows': pixels, 'meta': kwargs}, 'expectedError': error_value(error)})
    before_case('fresh')
    before_case('index_one', index=1)
    before_case('index_negative', index=-1)
    before_case('epoch_changed', meta={'epoch': 2})
    before_case('score_changed', meta={'score': 1})
    before_case('observation_changed', meta={'observation_ref': 'other'})
    before_case('point_unavailable', meta={'available': ['ACTION1']})
    before_case('unrelated_pixel_changed', pixels=variants['unrelated_outer_pixel_change'])
    before_case('action_payload_changed', lambda p: p['actions'][0]['data'].__setitem__('x', 0))
    before_case('bundle_payload_changed', lambda p: p['bundle_template']['actions'][0]['data'].__setitem__('x', 0))
    before_case('action_list_extra', lambda p: p['actions'].append(copy.deepcopy(p['actions'][0])))
    before_case('plan_point_changed', lambda p: p['framed_window_plan']['point'].__setitem__(0, 0))
    before_case('proposal_id_not_authenticated', lambda p: p.__setitem__('proposal_id', 'foreign-id'))
    before_case('receipt_not_rechecked', lambda p: p['framed_window_plan'].__setitem__('method_receipt', {'status':'NEEDS_EVIDENCE'}))
    before_case('step_action_not_checked_here', lambda p: p['steps'][0].__setitem__('action', {'action_ref':'ACTION1'}))
    before_case('plan_action_not_checked_here', lambda p: p['framed_window_plan'].__setitem__('action', {'action_ref':'ACTION1'}))
    before_case('point_support_not_checked_here', lambda p: p['steps'][0]['point_support'].__setitem__('palette_value', 99))
    before_case('reference_digest_not_recomputed', lambda p: p['framed_window_plan'].__setitem__('reference_digest', 'foreign-reference'))
    before_case('coherently_rewritten_point_not_authenticated', lambda p: (p['framed_window_plan'].__setitem__('point', [1,1]), p.__setitem__('actions', [{'action_ref':'ACTION6','data':{'x':1,'y':1}}]), p['bundle_template'].__setitem__('actions', [{'action_ref':'ACTION6','data':{'x':1,'y':1}}])))
    before_case('actions_missing', lambda p: p.pop('actions'))
    for name, meta in [('no_progress', {'epoch':1,'score':0}), ('official_progress', {'epoch':2,'score':1}),
            ('epoch_without_score', {'epoch':2,'score':0}), ('score_decrease', {'epoch':1,'score':-1}), ('same_epoch_score_increase', {'epoch':1,'score':1})]:
        guards.append({'id':'after:'+name, 'phase':'after', 'proposal':common, 'index':0, 'rows':rows, 'later':blank, 'meta':meta,
            'expected':plain(instance().after(common,0,rows,blank,**meta))})

    bindings = [[obs['level_epoch'], obs['frame_hash']]]
    def bind_case(name, mutate=None, domain_bindings=bindings):
        p = copy.deepcopy(common)
        if mutate: mutate(p)
        args = {'proposal': p, 'bindings': domain_bindings}
        def call(_m):
            out = copy.deepcopy(p)
            FramedWindowConstraint().bind(out, SimpleNamespace(bindings={tuple(v) for v in domain_bindings}))
            return out
        return add('bind:' + name, 'bind', args, call)
    bind_case('fresh')
    bind_case('frame_not_bound', domain_bindings=[])
    bind_case('point_support_mismatch', lambda p: p['steps'][0]['point_support'].__setitem__('point', [0,0]))
    bind_case('palette_not_rechecked', lambda p: p['steps'][0]['point_support'].__setitem__('palette_value', 99))
    bind_case('steps_truncated_zip_no_binding', lambda p: p.__setitem__('steps', [p['steps'][0]]))
    bind_case('extra_action_not_zipped', lambda p: p['actions'].append({'action_ref':'ACTION6','data':{'x':0,'y':0}}))

    def record_case(name, later=rows, after=None, command=None, p=common, seed=()):
        value = observation(later, name, revision=1) if after is None else after
        cmd = copy.deepcopy(p['actions'][0]) if command is None else command
        args = {'before':obs, 'command':cmd, 'after':value, 'rows':rows, 'later':later, 'proposal':p, 'index':0}
        return add('record:' + name, 'record', args, lambda m: m.record(obs,cmd,value,rows,later,p,0), seed)
    negative = record_case('no_progress')
    negative_own = [e for e in negative if e['kind'] == 'framed_window_response']
    positive = record_case('official_progress', later=blank, after=observation(blank,'progress',revision=1,level_epoch=2,levels_completed=1))
    positive_own = [e for e in positive if e['kind'] == 'framed_window_response']
    record_case('changed_frame_without_progress', later=variants['unrelated_outer_pixel_change'])
    record_case('epoch_change_without_score', later=blank, after=observation(blank,'epoch-only',revision=1,level_epoch=2))
    record_case('foreign_actual_command_retained', command={'action_ref':'ACTION1'})
    record_case('duplicate_response_source_appends', seed=negative_own)
    propose_case('same_view_blocked_after_no_progress', seed=negative_own)
    propose_case('same_view_new_observation_still_blocked', seed=negative_own, value=observation(rows,'revision-only',revision=4))
    propose_case('same_view_new_score_still_blocked', seed=negative_own, value=observation(rows,'score-only',levels_completed=1))
    propose_case('new_epoch_can_retry', seed=negative_own, value=observation(rows,'next-epoch',level_epoch=2))
    propose_case('changed_full_frame_can_retry', seed=negative_own, pixels=variants['unrelated_outer_pixel_change'], value=observation(variants['unrelated_outer_pixel_change'],'changed-frame'))
    propose_case('progress_does_not_block_same_view', seed=positive_own)
    common_case('same_view_blocked', seed=negative_own)
    for name, events in [('empty', []), ('negative', negative_own), ('positive', positive_own), ('duplicate_negative', negative_own * 2), ('mixed', negative_own + positive_own)]:
        def apply(memory, events=events):
            for event in copy.deepcopy(events): memory.apply_event(event)
            return state(memory)['projection']
        add('apply:' + name, 'apply_events', {'events':events}, apply)

    for name, events, corrupt in [('empty', [], False), ('negative', negative, False), ('positive', positive, False), ('mixed', negative+positive, False), ('corrupt_digest', negative, True)]:
        memory = instance(events)
        snapshot = {'events':plain(events), 'digest':memory.retained_digest()}
        if corrupt: snapshot['digest'] = 'corrupt'
        original = FramedWindowConstraint(); original.memory = instance(positive_own); original.events = copy.deepcopy(positive_own)
        item = {'id':'restore:'+name,'snapshot':snapshot,'beforeState':state(original.memory),'beforeEvents':plain(original.events)}
        try:
            original.restore(copy.deepcopy(snapshot)); item['expectedState']=state(original.memory); item['expectedEvents']=plain(original.events)
        except Exception as error:
            item['expectedError']=error_value(error); item['afterErrorState']=state(original.memory); item['afterErrorEvents']=plain(original.events)
        restore_cases.append(item)

    for name, later, after in [('negative',rows,observation(rows,'cold-negative',revision=1)), ('positive',blank,observation(blank,'cold-positive',revision=1,level_epoch=2,levels_completed=1))]:
        memory=instance(); initial=state(memory)
        p,_=clocked(lambda: memory.propose([],obs,rows,INPUTS,1,{**POLICY,'level_deadline':DEADLINE_MS/1000}))
        events=memory.record(obs,p['actions'][0],after,rows,later,p,0)
        following,_=clocked(lambda: memory.propose([],after,later,INPUTS,1,{**POLICY,'level_deadline':DEADLINE_MS/1000}))
        restored=instance(events)
        cold_replays.append({'id':'cold:'+name,'before':obs,'after':after,'rows':rows,'later':later,'inputs':INPUTS,
            'config':plain(POLICY),'limit':1,'deadlineMs':DEADLINE_MS,'nowMs':NOW_MS,'initialState':initial,'proposal':plain(p),
            'events':plain(events),'ownEvents':plain([e for e in events if e['kind']=='framed_window_response']),
            'state':state(memory),'nextProposal':plain(following),'nextOwnProposal':plain(following) if following and 'framed_window_plan' in following else None,
            'restoredState':state(restored)})

    admission = scan_public()
    admission_path = EVIDENCE/'framed-window-public-admission.json'
    source_names = [POLICY_PATH,'agents/yf_arc3_v6/laya_proto/framed_window_access.py','agents/yf_arc3_v6/laya_proto/common_framed_window.py',
        'agents/yf_arc3_v6/laya_proto/rooted_quota_access.py','agents/yf_arc3_v6/laya_proto/geometric_observer.py',
        'agents/yf_arc3_v5/capabilities/temporal_fragment_match.py','agents/yf_arc3_v5/capabilities/mechanical_family_contracts_d.py']
    output = {'schema':'logos-engine.v6.framed-window-source-reference.v1','sourceCommit':COMMIT,
        'sourceFiles':{name:MANIFEST[name]['sha256'] for name in source_names},'config':plain(POLICY),
        'rasters':{'base':rows,'blank':blank,'unrelatedChanged':variants['unrelated_outer_pixel_change']},
        'cases':cases,'guards':guards,'sourceExceptions':exceptions,'kernelCases':kernel_cases,'restoreCases':restore_cases,'coldReplays':cold_replays,
        'publicProjection':admission['cases'],'publicCorpus':admission['corpus'],
        'publicAdmissionReceipt':{'path':admission_path.relative_to(ROOT).as_posix(),'sha256':sha(admission_path.read_bytes())},
        'originalFilesVerifiedBefore':before_verified,'originalFilesVerifiedAfter':verify_source(),
        'clockContract':{'externalSourcePerfCounterSeconds':NOW_MS/1000,'externalSourceMonotonicSeconds':NOW_MS/1000,
            'nativeClockUnit':'milliseconds','nativeNowMs':NOW_MS,'nativeDeadlineMs':DEADLINE_MS,
            'qualification':'Only external clock call sites are deterministically supplied. Source files and methods are unchanged. These finite-contract fixtures prove no physical duration or deadline performance.'},
        'qualification':'Original own FramedWindow measurement, certificate, proposal, full-frame guard, response and common point envelope; consumed V5 exact_candidates only. Parent RootedQuota digest is an explicit opaque boundary, and expectedOriginal retains ancestor fallback/acquisition where expectedOwn/expectedOwnEvents isolate the transferred own contract. Source guards do not authenticate proposal identity, receipt or coherent point rewriting; bind validates its frame membership and zipped support points only. Empty finite domains, source exceptions, failed-trial blocking, unknown laws and deadline clamp remain visible. Synthetic contract seeds never preinitialize a live campaign. No game host/engine/specification/solution/action is read or executed.'}
    target=ROOT/'tests/fixtures/v6-framed-window-reference.json.gz'
    raw=json.dumps(output,separators=(',',':'),sort_keys=True).encode()
    compressed=gzip.compress(raw,mtime=0)
    temporary=target.with_suffix('.gz.tmp');temporary.write_bytes(compressed);temporary.replace(target)
    receipt={'schema':'logos-engine.framed-window-source-oracle-export.v1','status':'passed',
        'generator':{'path':Path(__file__).relative_to(ROOT).as_posix(),'sha256':sha(Path(__file__).read_bytes())},
        'fixture':{'path':target.relative_to(ROOT).as_posix(),'bytes':len(compressed),'sha256':sha(compressed)},
        'cases':len(cases),'guards':len(guards),'sourceExceptions':len(exceptions),'kernelCases':len(kernel_cases),
        'restoreCases':len(restore_cases),'coldReplays':len(cold_replays),'publicProjectionCases':len(admission['cases']),
        'admittedGames':admission['admittedGames'],'originalFilesVerifiedBefore':before_verified,'originalFilesVerifiedAfter':output['originalFilesVerifiedAfter'],
        'qualification':output['qualification']}
    EVIDENCE.mkdir(parents=True,exist_ok=True)
    (EVIDENCE/'source-oracle-export.json').write_text(json.dumps(receipt,indent=2)+'\n')
    print(json.dumps(receipt))


if __name__ == '__main__':
    if sys.argv[1:]==['--scan-only']: scan_public()
    elif sys.argv[1:]: raise SystemExit('Usage: export-v6-framed-window-reference.py [--scan-only]')
    else: run_export()
