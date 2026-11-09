#!/usr/bin/env python3
"""Independent contracts from unchanged pinned FramedTransfer and V5 helpers.

No host or native implementation is run here. Retained public returns are
replayed through the original Python. Controlled cases are not game results.
Identity profiling observes calls and replaces no source function.
"""
from __future__ import annotations
from collections.abc import Mapping
import copy
import gzip
import importlib.util
import json
from pathlib import Path
import sys
from types import SimpleNamespace

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('framed_probe', Path(__file__).with_name('probe-v6-framed-transfer-original.py'))
helper = importlib.util.module_from_spec(spec); spec.loader.exec_module(helper)
from agents.yf_arc3_v6.morphology_policy.framed_transfer import geometry as g
from agents.yf_arc3_v6.morphology_policy.framed_transfer.family import FramedTransfer
from agents.yf_arc3_v6.morphology_policy.framed_transfer.policy import FramedPolicy
from agents.yf_arc3_v5.logos.types import stable_digest, canonical_json
from agents.yf_arc3_v5.drm.loader import production_drm_paths

ROOT = helper.ROOT
PROBE_PATHS = ['tests/fixtures/v6-framed-transfer-original-public.json.gz',
               'tests/fixtures/v6-framed-transfer-original-lkey-public.json.gz']
DISCOVERY_PATH = 'tests/fixtures/v6-linked-packet-initial-public.json.gz'
PROBES = [json.loads(gzip.decompress((ROOT / path).read_bytes())) for path in PROBE_PATHS]
DISCOVERY = json.loads(gzip.decompress((ROOT / DISCOVERY_PATH).read_bytes()))
POLICY = FramedPolicy()
MEMORY_FAMILY = FramedTransfer()
EMPTY_STATE = MEMORY_FAMILY.state()
CASES = []; MEMORY_CASES = []; POLICY_CASES = []; RECIPES = {}; PENDING = {}
SOURCE_FILES = {'geometry.py', 'point_motion_spans.py', 'framed_masks.py', 'framed_replacements.py', 'framed_reception_loci.py'}

def plain(value):
    if hasattr(value, 'model_dump'): return plain(value.model_dump())
    if isinstance(value, Mapping): return {str(k): plain(v) for k, v in value.items()}
    if isinstance(value, (tuple, list)): return [plain(v) for v in value]
    if isinstance(value, (set, frozenset)): return [plain(v) for v in sorted(value)]
    if isinstance(value, SimpleNamespace): return plain(vars(value))
    return value

def proof(path): return {'path': path, 'sha256': helper.hashed((ROOT / path).read_bytes())}
def source_canonical(value): return json.dumps(plain(value), sort_keys=True, separators=(',', ':'))
def finite_canonical(value):
    """Independent spelling for the observed safe-integer identity domain."""
    if value is None: return 'null'
    if value is True: return 'true'
    if value is False: return 'false'
    if isinstance(value, str): return json.dumps(value, ensure_ascii=True)
    if isinstance(value, int):
        assert abs(value) <= 9007199254740991
        return str(value)
    if isinstance(value, float): raise AssertionError(('Unqualified floating identity operand', value))
    if isinstance(value, (tuple, list)): return '[' + ','.join(finite_canonical(v) for v in value) + ']'
    if isinstance(value, Mapping): return '{' + ','.join(json.dumps(k, ensure_ascii=True) + ':' + finite_canonical(v) for k, v in sorted(value.items())) + '}'
    raise TypeError(type(value))

def profile(frame, event, arg):
    if frame.f_code not in (g.digest.__code__, stable_digest.__code__): return
    caller = frame.f_back
    if caller is None or Path(caller.f_code.co_filename).name not in SOURCE_FILES: return
    if event == 'call':
        value = frame.f_locals['v'] if frame.f_code is g.digest.__code__ else frame.f_locals['value']
        PENDING[id(frame)] = (copy.deepcopy(value), str(Path(caller.f_code.co_filename).relative_to(helper.SOURCE)) + ':' + str(caller.f_lineno),
                              'geometry.digest' if frame.f_code is g.digest.__code__ else 'v5.stable_digest')
    elif event == 'return':
        value, origin, function = PENDING.pop(id(frame))
        canonical = json.dumps(value, sort_keys=True, separators=(',', ':')) if function == 'geometry.digest' else canonical_json(value)
        native = finite_canonical(plain(value)); assert canonical == native, (origin, canonical, native)
        assert helper.hashed(canonical.encode()) == arg
        item = RECIPES.setdefault(arg, {'sourceHash': arg, 'sourceCanonical': canonical, 'value': plain(value),
                                      'nativeCanonical': native, 'nativeHash': helper.hashed(native.encode()), 'callers': [], 'functions': []})
        assert item['sourceCanonical'] == canonical
        if origin not in item['callers']: item['callers'].append(origin)
        if function not in item['functions']: item['functions'].append(function)

def capture(callback):
    try: return {'value': plain(callback())}
    except (ValueError, KeyError, TypeError, IndexError) as exc: return {'error': {'name': type(exc).__name__, 'message': str(exc)}}

def add(name, operation, arguments, callback):
    item = {'id': name, 'operation': operation, 'arguments': plain(arguments), **capture(callback)}
    CASES.append(item); return item.get('value')

def synthetic_observation(rows, revision=1, epoch=1):
    return {'observation_ref': f'controlled-framed:epoch:{epoch}:revision:{revision}:frame:' + helper.hashed(json.dumps(rows, separators=(',', ':')).encode())[:16],
            'frame_hash': helper.hashed(json.dumps(rows, separators=(',', ':')).encode())[:16], 'level_epoch': epoch,
            'levels_completed': epoch - 1, 'available_action_refs': ['ACTION6'], 'revision': revision, 'state': 'NOT_FINISHED'}

def extract_summary(rows, ref):
    frame, components, scene = g.extract(rows, ref)
    return {'rows': plain(frame.rows), 'components': [{'component_id': c.component_id, 'value': c.value, 'area': c.area,
            'bbox': plain(c.bbox), 'relative_pixels': plain(c.relative_pixels), 'pixels': plain(c.pixels)} for c in components],
            'entities': [{'entity_id': e.entity_id, 'component_id': e.component.component_id} for e in scene.entities], 'frame_ref': scene.frame_ref}

def temporal_summary(first, second, before, after, records):
    a, b, old, current, translations, correspondence = g.temporal_components(first, second, before, after, records)
    return {'beforeRows': plain(a.rows), 'afterRows': plain(b.rows),
            'beforeEntities': [{'entity_id': e.entity_id, 'component_id': e.component.component_id} for e in old.entities],
            'afterEntities': [{'entity_id': e.entity_id, 'component_id': e.component.component_id} for e in current.entities],
            'translations': plain(translations), 'correspondence': plain(correspondence)}

def scene(rows, obs, spans=(), receipts=(), attempts=None):
    frame, components, _ = g.extract(rows, obs['observation_ref'])
    bands = g.measure_parallel_solid_bands(components, POLICY.route['parallel_band_measurement_contract'])
    bindings, complete = g.measure_current_point_span_bindings(frame, spans, obs['level_epoch'], POLICY.route['point_motion_span_recall_contract'])
    regions = g.point_regions(frame, components, bands)
    receipt_rows = [{**r, 'mask_extent': tuple(r['mask_extent'])} for r in receipts]
    common = dict(frame=frame, components=components, records=receipt_rows, span_records=spans, context_epoch=obs['level_epoch'],
                  span_contract=POLICY.route['point_motion_span_recall_contract'], contract=POLICY.route['framed_reception_locus_contract'])
    loci = g.measure_framed_reception_loci(**common, mask_contract=POLICY.route['framed_reception_mask_contract'], band_facts=bands)
    regional = g.measure_regional_reception_loci(**common, mask_contract=POLICY.mask, operator_regions=regions)
    return {'bands': plain(bands), 'regions': plain(regions), 'bindings': plain([bindings, complete]),
            'masks': plain(g.measure_framed_mask_correspondences(frame, components, POLICY.mask)),
            'loci': plain(loci), 'regional': plain(regional),
            'candidates': plain(g.candidates(rows, obs, POLICY, spans, receipts, attempts or {}))}

def replay(probe):
    # Profiling only executes component behavior, not repeated DRM construction.
    profiler = sys.getprofile(); sys.setprofile(None)
    try: family, clone = FramedTransfer(), FramedTransfer()
    finally: sys.setprofile(profiler)
    cursor = boundary = 0; envelopes = []; measurements = []; transitions = []
    for prefix_index, original in enumerate(probe['prefixes']):
        first = probe['packets'][cursor]; obs = first['observation']; rows = first['packet']['frame_rows']
        before_state = plain(family.state()); assert before_state == original['beforeState']
        remaining = probe['budget']['levelActions'] - (cursor - boundary)
        proposal = family.propose(obs, rows, [], remaining)
        assert plain(proposal) == original['unboundProposal'], ('proposal', probe['game'], prefix_index)
        assert plain(family.state()) == original['afterPlanningState']
        clone.restore(before_state); analogy = clone.analogy(obs, rows, [], remaining)
        family.bind(proposal, None); assert plain(proposal) == original['proposal']
        measurement = scene(rows, obs, family.spans, family.receipts, family.attempts)
        measurements.append({'actionIndex': cursor, 'state': plain(family.state()), 'value': measurement})
        envelope = {'prefixIndex': prefix_index, 'actionIndex': cursor + 1, 'beforeState': before_state,
                    'afterPlanningState': plain(family.state()), 'proposal': plain(proposal), 'analogy': plain(analogy), 'steps': []}
        for index, command in enumerate(proposal['actions']):
            guard = family.before(proposal, index, SimpleNamespace(**first['packet']), obs)
            if not original['steps']:
                assert not guard['admitted'] and probe['reason'] == 'before_guard_refused'
                envelope['refusedGuard'] = plain(guard)
                offer = proposal['framed_transfer_plan']['offer']
                envelope['refusedMatchingCandidates'] = [o for o in measurement['candidates'] if o['candidate_ref'] == offer['candidate_ref'] and o['patches'] == offer['patches']]
                break
            step = original['steps'][index]; later = probe['packets'][cursor + 1]; after = later['observation']; second = later['packet']['frame_rows']
            assert plain(command) == later['command'] and plain(guard) == step['beforeGuard']
            temporal = temporal_summary(rows, second, obs, after, family.spans)
            transition = g.transition(rows, second, obs, after, command, POLICY, family.spans)
            transitions.append({'actionIndex': cursor + 1, 'records': plain(family.spans), 'temporal': temporal, 'value': plain(transition)})
            outcome = family.after(proposal, index, obs, after, rows, second)
            assert plain(outcome) == step['outcome']
            acquired = family.record(obs, after, command, rows, second, proposal, index)
            assert plain(acquired) == step['acquired'], ('acquired', probe['game'], cursor + 1)
            assert plain(family.state()) == step['afterState'], ('state', probe['game'], cursor + 1)
            envelope['steps'].append({'index': index, 'actionIndex': cursor + 1, 'beforeGuard': plain(guard),
                                      'outcome': plain(outcome), 'acquired': plain(acquired), 'afterState': plain(family.state())})
            cursor += 1
            if after['levels_completed'] > obs['levels_completed']: boundary = cursor
        envelopes.append(envelope)
    assert cursor == probe['actions'] and plain(family.state()) == probe['finalState']
    final = probe['packets'][-1]
    terminal_proposal = family.propose(final['observation'], final['packet']['frame_rows'], [], probe['budget']['levelActions'] - (cursor - boundary))
    if probe['reason'] == 'framed_transfer_component_abstained': assert terminal_proposal is None
    return {'game': probe['game'], 'envelopes': envelopes, 'measurements': measurements, 'transitions': transitions,
            'terminalProposal': plain(terminal_proposal), 'finalState': plain(family.state())}

def paint(rows, box, value):
    left, top, right, bottom = box
    for y in range(top, bottom + 1):
        for x in range(left, right + 1): rows[y][x] = value

def geometry_cases():
    blank = [[0] * 18 for _ in range(14)]
    paired = copy.deepcopy(blank)
    paint(paired, [2, 2, 13, 2], 7); paint(paired, [2, 4, 13, 4], 7)
    three = copy.deepcopy(paired); paint(three, [2, 6, 13, 6], 7)
    vertical = [list(row) for row in zip(*paired)]
    masks = [[0] * 22 for _ in range(14)]
    for x, v in [(2, 3), (12, 5)]:
        paint(masks, [x, 2, x + 4, 6], 7)
        for dy, dx in [(1,2),(2,1),(2,2),(2,3),(3,2)]: masks[2 + dy][x + dx] = v
    broken = copy.deepcopy(masks); broken[2][3] = 0
    scenes = [('blank', blank), ('paired', paired), ('three-ambiguous', three), ('vertical', vertical), ('same-mask', masks), ('broken-frame', broken)]
    for name, rows in scenes:
        obs = synthetic_observation(rows)
        add(name + '-extract', 'extract', {'rows': rows, 'ref': obs['observation_ref']}, lambda rows=rows, obs=obs: extract_summary(rows, obs['observation_ref']))
        add(name + '-scene', 'scene', {'rows': rows, 'obs': obs, 'spans': [], 'receipts': [], 'attempts': {}}, lambda rows=rows, obs=obs: scene(rows, obs))
    frame, components, _ = g.extract(paired, 'controlled:bands')
    for key in ['maximum_bands', 'maximum_pairs']:
        contract = {**POLICY.route['parallel_band_measurement_contract'], key: 0}
        add('bands-bound-' + key, 'bands', {'rows': paired, 'contract': contract}, lambda contract=contract: g.measure_parallel_solid_bands(components, contract))
    add('bands-no-contract', 'bands', {'rows': paired, 'contract': None}, lambda: g.measure_parallel_solid_bands(components, None))
    mf, mc, _ = g.extract(masks, 'controlled:masks')
    for key in ['maximum_frame_pixels', 'maximum_component_count', 'maximum_framed_occurrences', 'maximum_correspondences']:
        contract = {**POLICY.mask, key: 0}
        add('masks-bound-' + key, 'masks', {'rows': masks, 'contract': contract}, lambda contract=contract: g.measure_framed_mask_correspondences(mf, mc, contract))
    add('masks-no-contract', 'masks', {'rows': masks, 'contract': None}, lambda: g.measure_framed_mask_correspondences(mf, mc, None))
    # Two identical copies: cancel stationary copies before admitting one residue.
    first = copy.deepcopy(blank); paint(first, [2, 8, 3, 9], 9); paint(first, [9, 8, 10, 9], 9)
    unique = copy.deepcopy(blank); paint(unique, [2, 8, 3, 9], 9); paint(unique, [12, 8, 13, 9], 9)
    ambiguous = copy.deepcopy(blank); paint(ambiguous, [4, 8, 5, 9], 9); paint(ambiguous, [12, 8, 13, 9], 9)
    for name, second in [('stationary', first), ('unique-residual', unique), ('multiple-residuals', ambiguous)]:
        before = synthetic_observation(first); after = synthetic_observation(second, 2)
        args = {'first': first, 'second': second, 'before': before, 'after': after, 'records': []}
        add('temporal-' + name, 'temporal', args, lambda second=second, before=before, after=after: temporal_summary(first, second, before, after, []))
    patches = [[[8, 2, 9, 3], [[9,9],[9,9]]], [[8, 9, 9, 10], [[9,9],[9,9]]]]
    base = {'context_epoch': 1, 'source_claim_ref': 'claim:controlled', 'endpoint_refs': ['endpoint:a', 'endpoint:b'], 'endpoint_patches': patches}
    for name, records in [('shared-historical-identity', [{**base, 'endpoint_refs': ['endpoint:same', 'endpoint:same']}]),
                          ('conflicting-historical-identity', [base, {**base, 'endpoint_refs': ['endpoint:c', 'endpoint:d']}]),
                          ('old-epoch-not-current', [{**base, 'context_epoch': 0}]), ('unclaimed-not-current', [{**base, 'source_claim_ref': ''}])]:
        before = synthetic_observation(first); after = synthetic_observation(unique, 2)
        args = {'first': first, 'second': unique, 'before': before, 'after': after, 'records': records}
        add('temporal-' + name, 'temporal', args, lambda records=records: temporal_summary(first, unique, before, after, records))

def measured_cases(replays):
    for probe, replayed in zip(PROBES, replays):
        for item in replayed['transitions']:
            index = item['actionIndex']; a = probe['packets'][index-1]; b = probe['packets'][index]
            args = {'first': a['packet']['frame_rows'], 'second': b['packet']['frame_rows'], 'before': a['observation'],
                    'after': b['observation'], 'command': b['command'], 'records': item['records']}
            for policy_key, rows_key, result_index in [('policy.record_observed_point_motion_span','point_motion_span_rows',0),
                                                       ('policy.record_observed_framed_replacement','framed_replacement_rows',1)]:
                for row_index, row in enumerate(item['value'][result_index][rows_key]):
                    POLICY_CASES.append({'id': f'{probe["game"]}-{index}-{rows_key}-{row_index}', 'operation': 'record',
                                         'arguments': {'policy': policy_key, 'facts': row}, **capture(lambda row=row, policy_key=policy_key: POLICY.record(policy_key, row))})
            if index == 1:
                for key in ['maximum_translations', 'maximum_pairs', 'maximum_components', 'maximum_pixels', 'maximum_spans']:
                    modified = copy.deepcopy(POLICY.policies['policy.record_observed_point_motion_span']['configuration']['measurement_contract']); modified[key] = 0
                    def bounded(contract=modified):
                        aa, bb, old, current, translations, _ = g.temporal_components(args['first'], args['second'], args['before'], args['after'], args['records'])
                        return g.measure_point_motion_spans(before=old, after=current, before_frame=aa, after_frame=bb, translations=translations,
                            point=(args['command']['data']['y'], args['command']['data']['x']), action_ref=args['command']['action_ref'],
                            transition_ref='controlled:transition', candidate_ref='controlled:candidate', context_epoch=args['before']['level_epoch'], contract=contract)
                    add(f'{probe["game"]}-span-bound-{key}', 'spanBound', {**args, 'contract': modified}, bounded)
    # Literal current support and histories, including absent, excess and stale evidence.
    probe = PROBES[0]
    for index in [1, 5, 12]:
        packet = probe['packets'][index]; state = probe['prefixes'][min(index, len(probe['prefixes']) - 1)]['beforeState']
        rows = packet['packet']['frame_rows']; obs = packet['observation']; frame, _, _ = g.extract(rows, obs['observation_ref'])
        original = copy.deepcopy(state['spans'])
        variants = [('actual', original, obs['level_epoch'], POLICY.route['point_motion_span_recall_contract']),
                    ('stale-epoch', original, obs['level_epoch'] + 1, POLICY.route['point_motion_span_recall_contract']),
                    ('no-contract', original, obs['level_epoch'], None),
                    ('record-bound', original, obs['level_epoch'], {**POLICY.route['point_motion_span_recall_contract'], 'maximum_recall_records': 0})]
        if original:
            changed = copy.deepcopy(original); changed[0]['endpoint_patches'][0][1][0][0] += 1
            variants.append(('changed-literal-patch', changed, obs['level_epoch'], POLICY.route['point_motion_span_recall_contract']))
            changed = copy.deepcopy(original); changed[0]['endpoint_patches'][0][0][0] = -1
            variants.append(('outside-frame-patch', changed, obs['level_epoch'], POLICY.route['point_motion_span_recall_contract']))
        for name, records, epoch, contract in variants:
            add(f'bindings-{index}-{name}', 'bindings', {'rows': rows, 'records': records, 'epoch': epoch, 'contract': contract},
                lambda records=records, epoch=epoch, contract=contract, frame=frame: g.measure_current_point_span_bindings(frame, records, epoch, contract))

def policy_cases(replays):
    POLICY_CASES.append({'id': 'select-empty', 'operation': 'choose', 'arguments': {'rows': []}, **capture(lambda: POLICY.choose([]))})
    for replayed in replays:
        for item in replayed['measurements']:
            rows = item['value']['candidates']
            POLICY_CASES.append({'id': f'{replayed["game"]}-choose-{item["actionIndex"]}', 'operation': 'choose', 'arguments': {'rows': rows}, **capture(lambda rows=rows: POLICY.choose(rows))})
    first = copy.deepcopy(replays[0]['measurements'][0]['value']['candidates'][0])
    for name, rows in [('ties-in-current-order', [first, copy.deepcopy(first)]), ('no-mutual-support', [{**first, 'facts': {**first['facts'], 'parallel_solid_band_mutually_unique': False}}]),
                       ('executed-current-context', [{**first, 'facts': {**first['facts'], 'candidate_execution_count': 1}}]),
                       ('no-conditions', [{**first, 'facts': {}}])]:
        POLICY_CASES.append({'id': name, 'operation': 'choose', 'arguments': {'rows': rows}, **capture(lambda rows=rows: POLICY.choose(rows))})
    for projection_key, projection in POLICY.projections.items():
        facts = {'candidate_ref': 'controlled:offer', 'frame_ref': 'controlled:frame', 'component_ref': 'controlled:component'}
        POLICY_CASES.append({'id': 'projection-missing-' + projection_key, 'operation': 'projected',
                             'arguments': {'projection': projection, 'facts': facts}, **capture(lambda projection=projection: POLICY.projected(projection, facts))})
    for key, declaration in POLICY.policies.items():
        POLICY_CASES.append({'id': 'record-rejected-' + key, 'operation': 'record', 'arguments': {'policy': key, 'facts': {}}, **capture(lambda key=key: POLICY.record(key, {}))})
        derived = next((row for row in POLICY_CASES if row['operation'] == 'record' and row['arguments']['policy'] == key and row.get('value', [{}])[0].get('status') == 'derived'), None)
        if derived:
            for field in POLICY.rules[next(iter(declaration['meaning_template_ref_by_alternative'].values()))]['term_templates'][0]['required_fields']:
                facts = {k:v for k,v in derived['arguments']['facts'].items() if k != field}
                POLICY_CASES.append({'id': 'record-missing-' + key + '-' + field, 'operation': 'record',
                                     'arguments': {'policy': key, 'facts': facts}, **capture(lambda key=key, facts=facts: POLICY.record(key, facts))})

def memory_case(name, operation, seed, arguments, callback):
    family = MEMORY_FAMILY; family.restore(copy.deepcopy(seed)); before = plain(family.state())
    result = capture(lambda: callback(family))
    MEMORY_CASES.append({'id': name, 'operation': operation, 'seed': plain(seed), 'arguments': plain(arguments),
                         'beforeState': before, 'afterState': plain(family.state()), **result})

def memory_cases():
    probe = PROBES[0]; initial = probe['packets'][0]; obs = initial['observation']; rows = initial['packet']['frame_rows']; empty = copy.deepcopy(EMPTY_STATE)
    active = probe['prefixes'][5]['beforeState']
    for operation in ['propose', 'analogy']:
        for name, observation, remaining, selected_rows in [('initial', obs, 120, rows), ('zero-budget', obs, 0, rows),
                 ('no-point-action', {**obs, 'available_action_refs': ['ACTION1']}, 120, rows), ('empty-scene', obs, 120, [[0]*8 for _ in range(8)])]:
            args = {'obs': observation, 'rows': selected_rows, 'inputs': [], 'remaining': remaining}
            memory_case(operation + '-' + name, operation, empty, args, lambda f, args=args, operation=operation: getattr(f, operation)(**args))
    for name, seed, observation in [('same-epoch', active, probe['packets'][5]['observation']),
                                  ('new-epoch-portable', active, {**obs, 'level_epoch': 2}), ('no-records-no-portable', empty, obs)]:
        memory_case('scope-' + name, 'scope', seed, {'obs': observation}, lambda f, observation=observation: f.scope(observation))
    for name, state in [('partial-recognized', {'epoch': 9, 'last': {'controlled': True}}), ('ignored-unknown', {'extra': 'unused'}), ('deep-restored', active)]:
        memory_case('restore-' + name, 'restore', empty, {'state': state}, lambda f, state=state: f.restore(state))
    for prefix_index in [0, 5, 12]:
        prefix = probe['prefixes'][prefix_index]; packet = probe['packets'][prefix_index]; proposal = prefix['proposal']; obs = packet['observation']; rows = packet['packet']['frame_rows']; seed = prefix['afterPlanningState']
        variants = [('original', proposal, 0, obs, rows), ('index-changed', proposal, 1, obs, rows),
                    ('scope-changed', proposal, 0, {**obs, 'level_epoch': obs['level_epoch']+1}, rows),
                    ('observation-changed', proposal, 0, {**obs, 'observation_ref': 'different:public'}, rows),
                    ('frame-hash-changed', proposal, 0, {**obs, 'frame_hash': 'different'}, rows),
                    ('unavailable', proposal, 0, {**obs, 'available_action_refs': []}, rows),
                    ('changed-rows', proposal, 0, obs, [[0]*len(rows[0]) for _ in rows])]
        payload = copy.deepcopy(proposal); payload['actions'][0]['data']['x'] += 1; payload['steps'][0]['action'] = copy.deepcopy(payload['actions'][0])
        variants.append(('payload-changed', payload, 0, obs, rows))
        steps = copy.deepcopy(proposal); steps['steps'][0]['action'] = {'action_ref': 'ACTION1'}
        variants.append(('step-action-changed', steps, 0, obs, rows))
        for name, p, index, observation, rr in variants:
            args = {'proposal': p, 'index': index, 'obs': observation, 'rows': rr}
            memory_case(f'before-{prefix_index}-{name}', 'before', seed, args,
                        lambda f, p=p, index=index, observation=observation, rr=rr: f.before(p, index, SimpleNamespace(frame_rows=rr), observation))
        for name, p in [('original', proposal), ('inconsistent-steps', steps), ('no-actions', {**proposal, 'actions': []})]:
            memory_case(f'bind-{prefix_index}-{name}', 'bind', seed, {'proposal': p}, lambda f, p=p: f.bind(p, None))
    for index in [0, 1, 6, 7]:
        a, b = probe['packets'][index:index+2]; prefix = probe['prefixes'][index]; seed = prefix['afterPlanningState']
        base = {'before': a['observation'], 'after': b['observation'], 'command': b['command'], 'first': a['packet']['frame_rows'], 'second': b['packet']['frame_rows'], 'proposal': prefix['proposal'], 'index': 0}
        for name, args in [('actual', base), ('passive-public-transition', {**base, 'proposal': None}),
                           ('other-action-ref', {**base, 'command': {'action_ref': 'ACTION1'}}),
                           ('empty-payload', {**base, 'command': {'action_ref': 'ACTION6', 'data': {}}}),
                           ('no-change', {**base, 'second': base['first'], 'after': base['before']})]:
            memory_case(f'record-{index}-{name}', 'record', seed, args, lambda f, args=args: f.record(**args))
        memory_case(f'after-{index}', 'after', seed, base, lambda f, base=base: f.after(base['proposal'], 0, base['before'], base['after'], base['first'], base['second']))
    # Restoring source snapshots with short SRC receipts must not duplicate
    # records merely because native execution adds its interpreter annotations.
    a, b = probe['packets'][:2]; prefix = probe['prefixes'][0]
    repeated = {'before': a['observation'], 'after': b['observation'], 'command': b['command'],
                'first': a['packet']['frame_rows'], 'second': b['packet']['frame_rows'], 'proposal': prefix['proposal'], 'index': 0}
    restored = copy.deepcopy(prefix['steps'][0]['afterState'])
    memory_case('record-repeat-restored-source-receipt', 'record', restored, repeated, lambda f: f.record(**repeated))
    for name, mutate in [('unknown-workflow-field', lambda r: r['derivation']['workflow'].update(controlled_unknown=True)),
                         ('trace-outside-workflow', lambda r: r.update(trace=['controlled:evidence'])),
                         ('edited-outside-workflow', lambda r: r['derivation'].update(edited=True))]:
        changed = copy.deepcopy(restored)
        mutate(changed['spans'][0])
        memory_case('record-repeat-significant-' + name, 'record', changed, repeated, lambda f: f.record(**repeated))

    # Returned state is a detached snapshot; changing an exported snapshot cannot
    # turn portable historical claims into current permissions.
    family = MEMORY_FAMILY; family.restore(active); snapshot = family.state(); snapshot['spans'].clear(); snapshot['epoch'] = -1
    assert plain(family.state()) == plain(active)

# Integrate into export-v6-framed-transfer-reference.py after its first run.
# Native source is not read. All expectations call unchanged pinned Python.

def replacement_contract_result(arguments):
    a = arguments
    first, second, old, current, translations, _ = g.temporal_components(
        a['first'], a['second'], a['before'], a['after'], a['records'])
    span = g.measure_point_motion_spans(
        before=old, after=current, before_frame=first, after_frame=second,
        translations=translations, point=(a['command']['data']['y'], a['command']['data']['x']),
        action_ref=a['command']['action_ref'], transition_ref='controlled:replacement',
        candidate_ref='controlled:candidate', context_epoch=a['before']['level_epoch'],
        contract=POLICY.policies['policy.record_observed_point_motion_span']['configuration']['measurement_contract'])
    masks_before = g.measure_framed_mask_correspondences(first, old.entities, POLICY.mask)
    masks_after = g.measure_framed_mask_correspondences(second, current.entities, POLICY.mask)
    complete = masks_before['framed_mask_domain_complete'] and masks_after['framed_mask_domain_complete']
    if a.get('complete_override') is not None:
        complete = a['complete_override']
    authority = SimpleNamespace(**a['prior_authority']) if a.get('prior_authority') is not None else None
    return g.measure_framed_replacements(
        pairs=masks_before.get('framed_mask_pairs', ()), before=old, after=current,
        after_frame=second, complete=complete, action_ref=a['command']['action_ref'],
        transition_ref='controlled:replacement', context_epoch=a['before']['level_epoch'],
        contract=a['contract'], before_occurrences=masks_before.get('framed_mask_occurrences', ()),
        after_occurrences=masks_after.get('framed_mask_occurrences', ()),
        motion_spans=span['point_motion_span_rows'], prior_authority=authority)


def locus_contract_result(arguments):
    a = arguments
    frame, components, _ = g.extract(a['rows'], a['obs']['observation_ref'])
    bands = g.measure_parallel_solid_bands(components, POLICY.route['parallel_band_measurement_contract'])
    records = [{**r, 'mask_extent': tuple(r['mask_extent'])} for r in a['receipts']]
    common = dict(frame=frame, components=components, records=records,
                  span_records=a['spans'], context_epoch=a['context_epoch'],
                  mask_contract=a['mask_contract'], span_contract=a['span_contract'], contract=a['contract'])
    if a['regional']:
        return g.measure_regional_reception_loci(
            **common, operator_regions=g.point_regions(frame, components, bands),
            require_operator_value_match=a.get('require_operator_value_match', True))
    return g.measure_framed_reception_loci(**common, band_facts=bands)


def extra_mechanical_cases(replays):
    # Three different observed branches: uniform receiver, direct typed copy,
    # and nonuniform receiver. These are retained returns, never new play.
    probe = PROBES[0]
    replayed = next(item for item in replays if item['game'] == probe['game'])
    transitions = {item['actionIndex']: item for item in replayed['transitions']}
    contract = POLICY.policies['policy.record_observed_framed_replacement']['configuration']['measurement_contract']
    for index in (2, 4, 5):
        left = probe['packets'][index - 1]
        right = probe['packets'][index]
        base = {'first': left['packet']['frame_rows'], 'second': right['packet']['frame_rows'],
                'before': left['observation'], 'after': right['observation'],
                'command': right['command'], 'records': transitions[index]['records'],
                'contract': copy.deepcopy(contract), 'complete_override': None, 'prior_authority': None}
        measured = replacement_contract_result(base)
        assert measured['framed_replacement_rows'], ('expected retained replacement witness', index)
        variants = [('actual', base),
                    ('incomplete-masks', {**base, 'complete_override': False}),
                    ('no-contract', {**base, 'contract': None}),
                    ('prior-authority', {**base, 'prior_authority': {'active_goal_ref': 'controlled:goal', 'subgoal_ref': 'controlled:subgoal'}})]
        for name in ('maximum_components', 'maximum_pairs', 'maximum_occurrences', 'maximum_motion_spans', 'maximum_replacements'):
            variants.append(('bound-' + name, {**base, 'contract': {**contract, name: 0}}))
        for name, arguments in variants:
            add(f'replacement-{index}-{name}', 'replacementBound', arguments,
                lambda arguments=arguments: replacement_contract_result(arguments))

    # Both operator-support families use the same registered raster bridges;
    # the final retained scene contains the competing band/region description.
    measurements = {item['actionIndex']: item for item in replayed['measurements']}
    positive = {False: 0, True: 0}
    for index in (5, 12):
        packet = probe['packets'][index]
        state = measurements[index]['state']
        for regional in (False, True):
            base = {'rows': packet['packet']['frame_rows'], 'obs': packet['observation'],
                    'spans': state['spans'], 'receipts': state['receipts'],
                    'context_epoch': packet['observation']['level_epoch'], 'regional': regional,
                    'mask_contract': copy.deepcopy(POLICY.mask if regional else POLICY.route['framed_reception_mask_contract']),
                    'span_contract': copy.deepcopy(POLICY.route['point_motion_span_recall_contract']),
                    'contract': copy.deepcopy(POLICY.route['framed_reception_locus_contract']),
                    'require_operator_value_match': True}
            actual = locus_contract_result(base)
            positive[regional] += bool(actual[0])
            variants = [('actual', base), ('no-contract', {**base, 'contract': None}),
                        ('no-mask-contract', {**base, 'mask_contract': None}),
                        ('mask-pixel-bound', {**base, 'mask_contract': {**base['mask_contract'], 'maximum_frame_pixels': 0}}),
                        ('no-span-contract', {**base, 'span_contract': None}),
                        ('span-record-bound', {**base, 'span_contract': {**base['span_contract'], 'maximum_recall_records': 0}}),
                        ('stale-epoch', {**base, 'context_epoch': base['context_epoch'] + 1})]
            for name in ('maximum_records', 'maximum_relations', 'maximum_tasks', 'maximum_loci'):
                variants.append(('bound-' + name, {**base, 'contract': {**base['contract'], name: 0}}))
            if regional:
                variants.append(('operator-value-unrestricted', {**base, 'require_operator_value_match': False}))
            for name, arguments in variants:
                add(f'{"regional" if regional else "locus"}-{index}-{name}', 'locusBound', arguments,
                    lambda arguments=arguments: locus_contract_result(arguments))
    assert positive[True] > 0, ('regional locus cases need a retained positive witness', positive)


# Controlled transformation of a retained public scene. This is a mechanical
# contract, not a valid game state, action, observed receipt or game result.
# Expectations are obtained only from the unchanged pinned Python functions.

def positive_band_locus_cases():
    probe = PROBES[0]
    index = 12
    packet = probe['packets'][index]
    state = copy.deepcopy(probe['prefixes'][index]['beforeState'])
    offer = probe['prefixes'][index]['proposal']['framed_transfer_plan']['offer']
    row, column = offer['point']
    operator_value = offer['point_value']
    rows = copy.deepcopy(packet['packet']['frame_rows'])
    isolation_value = max(value for line in rows for value in line) + 1
    # Two isolated horizontal one-pixel bands at the measured regional point.
    # The literal recorded endpoint patches and intervening raster stay intact.
    for y in range(row - 2, row + 3):
        for x in range(column - 3, column + 4):
            rows[y][x] = isolation_value
    for y in (row - 1, row + 1):
        for x in range(column - 2, column + 3):
            rows[y][x] = operator_value
    obs = synthetic_observation(rows, revision=100, epoch=packet['observation']['level_epoch'])
    old_frame, _, _ = g.extract(packet['packet']['frame_rows'], packet['observation']['observation_ref'])
    frame, _, _ = g.extract(rows, obs['observation_ref'])
    recall = POLICY.route['point_motion_span_recall_contract']
    before_bindings = g.measure_current_point_span_bindings(old_frame, state['spans'], obs['level_epoch'], recall)
    after_bindings = g.measure_current_point_span_bindings(frame, state['spans'], obs['level_epoch'], recall)
    assert before_bindings == after_bindings and after_bindings[1]
    base = {'rows': rows, 'obs': obs, 'spans': state['spans'], 'receipts': state['receipts'],
            'context_epoch': obs['level_epoch'], 'regional': False,
            'mask_contract': copy.deepcopy(POLICY.route['framed_reception_mask_contract']),
            'span_contract': copy.deepcopy(recall), 'contract': copy.deepcopy(POLICY.route['framed_reception_locus_contract']),
            'require_operator_value_match': True}
    measured = locus_contract_result(base)
    assert measured[1] and len(measured[0]) == 2
    assert sorted(point for _, point, _ in measured[0]) == [(row - 1, column), (row + 1, column)]
    variants = [('actual', base), ('no-contract', {**base, 'contract': None}),
                ('no-mask-contract', {**base, 'mask_contract': None}),
                ('mask-pixel-bound', {**base, 'mask_contract': {**base['mask_contract'], 'maximum_frame_pixels': 0}}),
                ('no-span-contract', {**base, 'span_contract': None}),
                ('span-record-bound', {**base, 'span_contract': {**base['span_contract'], 'maximum_recall_records': 0}}),
                ('stale-epoch', {**base, 'context_epoch': base['context_epoch'] + 1})]
    for key in ('maximum_records', 'maximum_relations', 'maximum_tasks', 'maximum_loci'):
        variants.append(('bound-' + key, {**base, 'contract': {**base['contract'], key: 0}}))
    mismatched_rows = copy.deepcopy(rows)
    for y in (row - 1, row + 1):
        for x in range(column - 2, column + 3):
            mismatched_rows[y][x] = isolation_value + 1
    variants.append(('operator-value-mismatch', {**base, 'rows': mismatched_rows}))
    receipts = copy.deepcopy(state['receipts'])
    for record in receipts:
        for _, _, patch in record.get('gap_patches', ()):
            for line in patch:
                for x in range(len(line)):
                    line[x] = isolation_value + 2
    variants.append(('unmatched-registered-bridge', {**base, 'receipts': receipts}))
    for name, arguments in variants:
        add('controlled-positive-band-locus-' + name, 'locusBound', arguments,
            lambda arguments=arguments: locus_contract_result(arguments))


def main():
    before = helper.source_hashes(); assert len(helper.VERIFIED_PINNED_SOURCE) == 1786
    sys.setprofile(profile)
    try:
        replays = [replay(probe) for probe in PROBES]
        print(json.dumps({'phase': 'source_replays', 'games': [item['game'] for item in replays]}), flush=True)
        geometry_cases(); measured_cases(replays); extra_mechanical_cases(replays); positive_band_locus_cases(); policy_cases(replays)
        print(json.dumps({'phase': 'source_mechanics', 'cases': len(CASES), 'policyCases': len(POLICY_CASES)}), flush=True)
        memory_cases()
        print(json.dumps({'phase': 'source_memory', 'cases': len(MEMORY_CASES)}), flush=True)
        initial = []
        for item in DISCOVERY['games']:
            offers = g.candidates(item['packet']['frame_rows'], item['observation'], POLICY, [], [], {})
            initial.append({'game': item['game'], 'candidates': plain(offers), 'choice': plain(POLICY.choose(offers))})
    finally: sys.setprofile(None)
    assert not PENDING
    after = helper.source_hashes(); assert all(after.get(k) == v for k,v in before.items())
    assert helper.verify_source_manifest() == helper.VERIFIED_PINNED_SOURCE
    policy_paths = [*production_drm_paths(), helper.SOURCE/'agents/yf_arc3_v6/morphology_policy/framed_transfer/framed.drm', helper.SOURCE/'agents/yf_arc3_v6/morphology_policy/framed_transfer/framed.src']
    policy_hashes = {str(p.relative_to(helper.SOURCE)): helper.hashed(p.read_bytes()) for p in policy_paths}
    for path, digest in policy_hashes.items(): assert helper.VERIFIED_PINNED_SOURCE[path] == digest
    output = {'schema': 'logos-engine.v6.framed-transfer-reference.v1', 'sourceCommit': helper.COMMIT,
              'originalPublicProbes': [proof(path) for path in PROBE_PATHS], 'initialDiscovery': proof(DISCOVERY_PATH),
              'policy': {'config': plain(POLICY.config), 'route': plain(POLICY.route), 'mask': plain(POLICY.mask),
                         'projections': plain(POLICY.projections), 'policies': plain(POLICY.policies), 'rules': plain(POLICY.rules),
                         'drmHash': POLICY.loaded.source_hash},
              'qualification': {'sourceModified': False, 'gameHostRunByExporter': False, 'nativeResultsUsedAsExpectations': False,
                  'scope': 'Isolated unchanged source component and called V5 mechanics; not full original caller or Kernel parity.',
                  'failuresPreserved': 'GARE stops on its original uniqueness guard after 12 actions and one level; LKEY abstains after two actions and no level.',
                  'identityTracing': 'Python profiler observes actual digest calls and replaces no source function.',
                  'numerics': 'Exact JSON bytes and SHA256 for checked safe integer operands. No general Python float identity equivalence is claimed.',
                  'sourceCounts': 'sourceHashes includes actual imported Python modules plus the two explicit local policy files; loaded production DRM files are separately listed.'},
              'sourceHashes': after, 'policySourceHashes': dict(sorted(policy_hashes.items())),
              'importedSourceModuleCount': sum(path.endswith('.py') for path in after),
              'explicitLocalPolicyFileCount': sum(not path.endswith('.py') for path in after),
              'pinnedSourceFilesVerifiedBeforeImport': len(helper.VERIFIED_PINNED_SOURCE), 'pinnedSourceFilesVerifiedAfterRun': len(helper.VERIFIED_PINNED_SOURCE),
              'replays': replays, 'cases': CASES, 'policyCases': POLICY_CASES, 'memoryCases': MEMORY_CASES,
              'initialMeasurements': initial, 'identityRecipes': list(RECIPES.values()),
              'generator': str(Path(__file__).relative_to(ROOT)), 'generatorSha256': helper.hashed(Path(__file__).read_bytes())}
    destination = ROOT/'tests/fixtures/v6-framed-transfer-reference.json.gz'
    destination.write_bytes(gzip.compress(json.dumps(output, sort_keys=True, separators=(',', ':')).encode(), mtime=0))
    print(json.dumps({'output': str(destination.relative_to(ROOT)), 'cases': len(CASES), 'memoryCases': len(MEMORY_CASES),
                      'policyCases': len(POLICY_CASES), 'identities': len(RECIPES), 'initialScenes': len(initial),
                      'imports': output['importedSourceModuleCount'], 'localPolicyFiles': output['explicitLocalPolicyFileCount'],
                      'loadedDrmAndSrcFiles': len(policy_hashes)}))

if __name__ == '__main__': main()
