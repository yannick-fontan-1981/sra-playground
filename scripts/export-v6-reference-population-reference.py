#!/usr/bin/env python3
"""Export unchanged own ReferencePopulation and consumed V5 contracts.

Synthetic rasters describe the admitted visual grammar, not a game model.
The archived public projection scan executes no action and reads no game code.
"""
from __future__ import annotations
import copy
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
MANIFEST = json.loads((SOURCE.parent / 'manifest.json').read_text())['files']
sys.path[:0] = [str(SOURCE), str(SOURCE / 'agents/yf_arc3_v6/laya_proto')]
from reference_population_access import ReferencePopulationAccess, scene, point, paths, local_relations, input_candidates, inherited_inputs
from reception_service_access import ReceptionServiceAccess
from neutral_observer import measure
from terminal_composition import identity
from src_bridge import plain
from agents.yf_arc3_v5.capabilities.injective_matching import maximum_injective_matching
from agents.yf_arc3_v5.capabilities.neighborhood_pattern_construction import NeighborhoodOccurrence, NeighborhoodState, NeighborhoodInput, _physical
from agents.yf_arc3_v5.capabilities.mechanical_family_contracts_d import DWorkBudget

POLICY_PATH = 'agents/yf_arc3_v6/morphology_policy/strategy.drm'
POLICY = json.loads((SOURCE / POLICY_PATH).read_text())['declarations'][0]['configuration']['observed_composition_services']
INPUTS = [{'action_ref': 'ACTION' + str(i)} for i in range(1, 5)]
AVAILABLE = [a['action_ref'] for a in INPUTS] + ['ACTION6']
EVIDENCE = ROOT / 'docs/migration/lot3f-evidence/diagnostic'


def sha(data): return hashlib.sha256(data).hexdigest()
def verify_source():
    for name, expected in MANIFEST.items():
        assert sha((SOURCE / name).read_bytes()) == expected['sha256'], name
    return len(MANIFEST)


def raster(*, pitch=4, origin=(2, 2), zone=(3, 3), reference_origin=(40, 2),
           target=((0, 0, 5), (1, 1, 6)), bodies=((5, 4, 5), (5, 6, 6)),
           colors=None, separator=52, canvas=(64, 64), marker=None):
    """Draw independent public frames, square cells and optional marker pixels."""
    palette = {} if colors is None else colors
    paint = lambda value: palette.get(value, value)
    width, height = canvas
    rows = [[paint(0)] * width for _ in range(height)]
    size = pitch - 1
    def put(x, y, color): rows[y][x] = paint(color)
    def square(x, y, color):
        for dy in range(size):
            for dx in range(size): put(x + dx, y + dy, color)
    def frame(left, top, columns, lines):
        right, bottom = left + columns * pitch, top + lines * pitch
        for y in range(top, bottom + 1):
            for x in range(left, right + 1):
                if x in (left, right) or y in (top, bottom): put(x, y, 1)
    left, top = origin
    frame(left, top, zone[1], zone[0])
    for y in range(zone[0]):
        for x in range(zone[1]): square(left + 1 + x * pitch, top + 1 + y * pitch, 2)
    ref_x, ref_y = reference_origin
    frame(ref_x, ref_y, zone[1], zone[0])
    for y, x, color in target: square(ref_x + 1 + x * pitch, ref_y + 1 + y * pitch, color)
    oy, ox = (top + 1) % pitch, (left + 1) % pitch
    for y, x, color in bodies: square(ox + x * pitch, oy + y * pitch, color)
    if separator is not None:
        for x in range(width): put(x, separator, 8)
    if marker is not None:
        cell, dy, dx, color = marker
        put(ox + cell[1] * pitch + dx, oy + cell[0] * pitch + dy, color)
    return rows


def observation(rows, name='current', **changes):
    packet = SimpleNamespace(frame_rows=rows,
        frame_hash=sha(json.dumps(rows, separators=(',', ':')).encode())[:16],
        level=changes.pop('level_epoch', 1), levels_completed=changes.pop('levels_completed', 0),
        state=changes.pop('state', 'NOT_FINISHED'), available_action_refs=changes.pop('available_action_refs', AVAILABLE))
    value, _ = measure(packet, changes.pop('revision', 0), 'synthetic:reference-population:' + name)
    value.update(changes)
    return plain(value)


def state(memory):
    return {'projection': plain({'population_events': memory.population_events,
        'population_controls': memory.population_controls, 'population_state': memory.population_state}),
        'parentDigest': ReceptionServiceAccess.retained_digest(memory), 'digest': memory.retained_digest()}


def instance(seed=()):
    value = ReferencePopulationAccess()
    for event in copy.deepcopy(seed): value.apply_event(event)
    return value


def error_value(error):
    value = {'type': type(error).__name__}
    if hasattr(error, 'errors'):
        value['errors'] = [{'type': item['type'], 'loc': list(item['loc'])} for item in error.errors()]
    else: value['message'] = str(error)
    if hasattr(error, 'cause'): value['cause'] = error.cause
    return value


def scan_public():
    before = verify_source()
    corpus_path = 'tests/fixtures/v6-linked-packet-initial-public.json.gz'
    raw = (ROOT / corpus_path).read_bytes()
    corpus = json.loads(gzip.decompress(raw))
    excluded = ['CWSE', 'SK48', 'FOGW']
    cases = []
    for item in corpus['games']:
        if item['game'] in excluded: continue
        rows = item['packet']['frame_rows']
        record = {'game': item['game'], 'rowsSha256': sha(json.dumps(rows, separators=(',', ':')).encode())}
        try: record['scene'] = plain(scene(rows))
        except Exception as error: record['scene'] = None; record['sourceError'] = error_value(error)
        cases.append(record)
    data = {'schema': 'logos-engine.reference-population-public-admission.v1', 'sourceCommit': COMMIT,
        'sourcePath': 'agents/yf_arc3_v6/laya_proto/reference_population_access.py',
        'sourceSha256': MANIFEST['agents/yf_arc3_v6/laya_proto/reference_population_access.py']['sha256'],
        'corpus': {'path': corpus_path, 'sha256': sha(raw), 'actions': 0, 'levelJumps': 0, 'excludedGames': excluded},
        'cases': cases, 'count': len(cases), 'admittedGames': [item['game'] for item in cases if item['scene']],
        'originalFilesVerifiedBefore': before, 'originalFilesVerifiedAfter': verify_source(),
        'scope': 'Only already archived initial public pixels through the unchanged own source scene function. Exclusions are applied before calls. No game engine, specification, route or solution read; no game action, level jump or native proposal.'}
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    target = EVIDENCE / 'reference-population-public-admission.json'
    target.write_text(json.dumps(data, indent=2) + '\n')
    print(json.dumps({'path': target.relative_to(ROOT).as_posix(), 'cases': len(cases),
        'admittedGames': data['admittedGames'], 'sourceErrors': sum('sourceError' in c for c in cases),
        'sha256': sha(target.read_bytes())}))
    return data


def run_export():
    verified = verify_source()
    cases, guards, exceptions, matching_cases, physical_cases = [], [], [], [], []
    def add(name, operation, arguments, expected):
        cases.append({'id': name, 'operation': operation, 'arguments': plain(arguments), 'expected': plain(expected)})
        return expected
    def call_case(name, operation, arguments, call, seed=()):
        memory = instance(seed); before = state(memory)
        try: expected = call(memory)
        except Exception as error:
            exceptions.append({'id': name, 'operation': operation, 'arguments': plain(arguments),
                'seedEvents': plain(list(seed)), 'expectedError': error_value(error),
                'beforeState': before, 'afterState': state(memory)})
            return None
        cases.append({'id': name, 'operation': operation, 'arguments': plain(arguments),
            'seedEvents': plain(list(seed)), 'expected': plain(expected), 'beforeState': before, 'afterState': state(memory)})
        return expected
    rows = raster(); measured = scene(rows); assert measured is not None
    assert scene(rows, measured) == measured
    marked = raster(marker=((5, 4), 1, 1, 9))
    moved = raster(bodies=((4, 4, 5), (5, 6, 6)))
    prepared = raster(bodies=((0, 0, 5), (1, 1, 6)))
    blank = [[0] * 64 for _ in range(64)]
    variants = {
        'base': rows, 'translated': raster(origin=(6, 6), reference_origin=(44, 6)),
        'palette_permuted': raster(colors={0:12,1:9,2:11,5:1,6:7,8:0,9:4}),
        'pitch_three': raster(pitch=3, origin=(1,1), reference_origin=(39,1), separator=48),
        'pitch_five': raster(pitch=5, origin=(2,2), reference_origin=(40,2), separator=58),
        'one_target_and_body': raster(target=((1,1,5),), bodies=((5,4,5),)),
        'three_targets_and_bodies': raster(target=((0,0,5),(1,1,6),(2,2,7)), bodies=((5,4,5),(5,6,6),(7,4,7))),
        'missing_body': raster(bodies=((5,4,5),)), 'extra_body': raster(bodies=((5,4,5),(5,6,6),(7,4,7))),
        'no_targets': raster(target=()), 'no_separator': raster(separator=None),
        'fresh_unknown_marker': marked, 'body_color_changed': raster(bodies=((5,4,7),(5,6,6))),
        'moved': moved, 'prepared': prepared, 'blank': blank,
    }
    # Alterations are public pixels, not mutations of the original code.
    different_frame = copy.deepcopy(rows)
    for y in range(2,15):
        for x in range(40,53):
            if x in (40,52) or y in (2,14): different_frame[y][x] = 3
    variants['reference_frame_different_appearance'] = different_frame
    missing_square = copy.deepcopy(rows)
    for y in range(3,6):
        for x in range(3,6): missing_square[y][x] = 0
    variants['receiving_cell_missing'] = missing_square
    for name, pixels in variants.items(): add('scene:' + name, 'scene', {'rows': pixels, 'retained': None}, scene(pixels))
    # A tiny component on the earlier side of the raster changes encounter
    # order without supplying a semantic role or a fixed palette meaning.
    earlier = copy.deepcopy(rows); earlier[0][0] = 5
    add('scene:earlier_non_square_component', 'scene', {'rows': earlier, 'retained': None}, scene(earlier))
    marker_scene = copy.deepcopy(measured); marker_scene['observed_marker_overlays'] = [[1,1,9]]
    wrong_marker_scene = copy.deepcopy(measured); wrong_marker_scene['observed_marker_overlays'] = [[0,0,9]]
    altered_reference = copy.deepcopy(rows); altered_reference[3][41] = 7
    changed_border = copy.deepcopy(rows); changed_border[2][2] = 7
    for name, pixels, retained in [
        ('retained_base', rows, measured), ('retained_moved', moved, measured),
        ('retained_unknown_marker', marked, measured), ('retained_known_marker', marked, marker_scene),
        ('retained_wrong_marker_location', marked, wrong_marker_scene),
        ('retained_missing_population', variants['missing_body'], measured),
        ('retained_extra_population', variants['extra_body'], measured),
        ('retained_appearance_changed', variants['body_color_changed'], measured),
        ('retained_reference_changed', altered_reference, measured),
        ('retained_zone_corner_changed_source_keeps_geometry', changed_border, measured),
        ('retained_prepared', prepared, measured),
    ]: add('scene:' + name, 'scene', {'rows': pixels, 'retained': retained}, scene(pixels, retained))
    for name, pixels, retained in [('short_rows', rows[:8], measured), ('short_columns', [row[:8] for row in rows], measured)]:
        try: scene(pixels, retained)
        except Exception as error:
            exceptions.append({'id': 'scene:' + name, 'operation': 'scene',
                'arguments': {'rows': pixels, 'retained': retained}, 'expectedError': error_value(error)})
        else: raise AssertionError('Expected retained frame indexing exception: ' + name)
    for cell in ([5,4], [0,0], [1,1]): add('point:' + str(cell), 'point', {'scene': measured, 'cell': cell}, point(measured, cell))
    for available in [AVAILABLE, ['ACTION1'], [], ['ACTION6']]:
        inherited = inherited_inputs(rows, available)
        complete = input_candidates(rows, available)
        assert complete[:len(inherited)] == inherited
        own = complete[len(inherited):]
        add('inputs:' + ','.join(available), 'inputs', {'rows': rows, 'available': available}, own)
    for name, pixels, retained in [('base',rows,measured), ('adjacent',raster(bodies=((5,4,5),(5,5,6))),measured),
                                   ('appearance_changed',variants['body_color_changed'],measured)]:
        s = scene(pixels, retained); assert s is not None
        add('local_relations:' + name, 'local_relations', {'scene':s}, local_relations(s))
    plus = {'bodies':[{'cell':[1,1],'appearance':5},{'cell':[0,1],'appearance':6},
                      {'cell':[2,1],'appearance':7},{'cell':[1,0],'appearance':8},{'cell':[1,2],'appearance':9}]}
    add('local_relations:four_neighbors', 'local_relations', {'scene':plus}, local_relations(plus))
    controls = {'ACTION1':{'delta':[-1,0],'evidence':['old:a','old:b']},
                'ACTION2':{'delta':[0,-1],'evidence':['old:a','old:b']},
                'ACTION3':{'delta':[1,0],'evidence':['old:a','old:b']},
                'ACTION4':{'delta':[0,1],'evidence':['old:a','old:b']}}
    small_floor = [(y,x) for y in range(3) for x in range(4)]
    for name, origin, floor, occupied, moves in [
        ('complete', (1,1), small_floor, [(1,1),(1,2)], controls),
        ('opaque_action_order', (1,1), small_floor, [(1,1)], {'z':{'delta':[0,1]},'a':{'delta':[1,0]},'m':{'delta':[-1,0]}}),
        ('no_controls', (1,1), small_floor, [(1,1)], {}),
        ('disconnected', (0,0), [(0,0),(0,2)], [(0,0)], controls),
        ('occupied_wall', (1,1), small_floor, [(1,1),(0,1),(1,0),(1,2),(2,1)], controls),
        ('one_way', (0,0), small_floor, [(0,0)], {'opaque':{'delta':[0,1]}}),
        ('source_zero_delta', (1,1), small_floor, [(1,1)], {'opaque':{'delta':[0,0]}}),
        ('source_long_delta', (0,0), small_floor, [(0,0)], {'opaque':{'delta':[0,2]}}),
    ]:
        args = {'start':origin,'floor':floor,'occupied':occupied,'controls':moves}
        result = paths(origin,set(floor),set(occupied),moves)
        add('paths:' + name,'paths',args,[[cell,result[cell]] for cell in sorted(result)])
    def seeded_state(*, epoch=1, current_scene=None, active=None, pending=None, tried=(), evidence=('old:a','old:b'), acquired_controls=None):
        return [{'kind':'observed_reference_population',
            'state':{'epoch':epoch,'scene':copy.deepcopy(measured if current_scene is None else current_scene),
                     'active':active,'pending':pending,'tried':list(tried),'evidence':list(evidence)},
            'controls':copy.deepcopy(controls if acquired_controls is None else acquired_controls),
            'detail':{'synthetic_contract_seed':True},'observed_local_relations':[],
            'color_rule_status':'observed_samples_only_no_complete_law'}]
    def propose(name, pixels=rows, seed=(), limit=16, inputs=None, config=None, **changes):
        o = observation(pixels,name,**changes); conf = copy.deepcopy(POLICY)
        conf.update({'remaining_level_actions':600,'level_action_cap':600})
        if config is not None: conf.update(config)
        inputs = copy.deepcopy(INPUTS if inputs is None else inputs)
        args = {'observation':o,'rows':pixels,'inputs':inputs,'limit':limit,'config':conf}
        return call_case('propose:' + name,'propose',args,lambda m:m.propose_graph(o,pixels,inputs,limit,conf),seed)
    first = propose('initial_selection'); assert first['reference_population_plan']['mode']=='select'
    assert first['reference_population_plan']['chosen']==[5,4]
    propose('source_selection_offered_without_available_point',available_action_refs=['ACTION1'])
    pending_seed = seeded_state(pending=[5,4], acquired_controls={})
    pending = propose('pending_selection_probe',seed=pending_seed)
    assert pending['reference_population_plan']['mode']=='probe'
    propose('pending_source_empty_payload_probe',seed=pending_seed,inputs=[{'action_ref':'ACTION2','data':{}}])
    propose('pending_source_no_nonpoint_raises',seed=pending_seed,inputs=[{'action_ref':'ACTION6','data':{'x':20,'y':24}}])
    known = seeded_state(active=[5,4])
    planned = propose('learned_bottleneck_assignment',seed=known)
    assert planned['reference_population_plan']['mode']=='move'
    assert planned['reference_population_plan']['assignment_complete'] is True
    assert len(planned['actions']) > 1
    propose('learned_prefix_limit',seed=known,limit=2)
    propose('source_zero_limit_falls_back_to_selection',seed=known,limit=0)
    propose('source_negative_limit_slice',seed=known,limit=-1)
    propose('source_deadline_is_not_checked_in_own_method',seed=known,config={'level_deadline':-1})
    propose('source_remaining_not_checked_in_own_method',seed=known,config={'remaining_level_actions':0})
    propose('available_controls_filtered',seed=known,available_action_refs=['ACTION1','ACTION2','ACTION6'])
    propose('partial_matching_requires_unknown_control',seed=seeded_state(active=[5,4],acquired_controls={'ACTION1':controls['ACTION1']}))
    propose('least_untried_unknown_control',seed=seeded_state(active=[5,4],acquired_controls={},tried=[['ACTION1',[5,4]]]))
    propose('exhausted_unknowns_reselect',seed=seeded_state(active=[5,4],acquired_controls={},tried=[[a['action_ref'],[5,4]] for a in INPUTS]))
    propose('current_reference_missing_blocks',pixels=altered_reference,seed=known)
    propose('current_population_missing_blocks',pixels=variants['missing_body'],seed=known)
    propose('revalidation_missing_blocks_even_disabled',pixels=altered_reference,seed=known,config={'reference_population_question':None})
    prepared_scene = scene(prepared,measured); assert prepared_scene is not None
    propose('occupancy_prepared_terminal_unknown',pixels=prepared,seed=seeded_state(current_scene=prepared_scene,active=[0,0]))
    epoch_changed = propose('new_epoch_resets_state_keeps_controls',seed=known,level_epoch=2)
    assert epoch_changed['reference_population_plan']['state']['epoch']==2
    assert epoch_changed['reference_population_plan']['controls']==controls
    def record(name, proposal, pixels, later, seed=(), index=0, command=None, **changes):
        v = proposal['reference_population_plan']
        before_obs = observation(pixels,name+':before',level_epoch=v['epoch'])
        after_obs = observation(later,name+':after',revision=1,level_epoch=changes.pop('level_epoch',v['epoch']),**changes)
        command = copy.deepcopy(command or proposal['actions'][index])
        args = {'before':before_obs,'command':command,'after':after_obs,'rows':pixels,'later':later,'proposal':proposal,'index':index}
        return call_case('record:' + name,'record',args,
            lambda m:[event for event in m.record(before_obs,command,after_obs,pixels,later,proposal,index)
                      if event.get('kind')=='observed_reference_population'],seed)
    selection_events = record('selection_single_marker',first,rows,marked)
    assert selection_events[0]['state']['scene']['observed_marker_overlays']==[[1,1,9]]
    assert selection_events[0]['state']['pending']==[5,4]
    record('selection_no_pixel_change_still_pending',first,rows,rows)
    selected_probe = propose('after_actual_selection',marked,selection_events)
    moved_events = record('observed_cardinal_control',selected_probe,marked,moved,selection_events)
    assert moved_events[0]['controls']['ACTION1']['delta']==[-1,0]
    assert moved_events[0]['detail']['V5_physical_step_matches'] is True
    record('unknown_probe_stationary',pending,rows,rows,pending_seed)
    record('non_cardinal_displacement_not_acquired',pending,rows,raster(bodies=((4,3,5),(5,6,6))),pending_seed)
    record('two_cell_displacement_not_acquired',pending,rows,raster(bodies=((3,4,5),(5,6,6))),pending_seed)
    record('two_members_changed_not_attributed',pending,rows,raster(bodies=((4,4,5),(4,6,6))),pending_seed)
    record('appearance_change_observed_not_law',pending,rows,variants['body_color_changed'],pending_seed)
    record('missing_population_no_own_event',pending,rows,variants['missing_body'],pending_seed)
    record('changed_reference_no_own_event',pending,rows,altered_reference,pending_seed)
    record('epoch_boundary_no_own_event',pending,rows,blank,pending_seed,level_epoch=2,levels_completed=1)
    record('score_only_change_still_own_acquisition',pending,rows,moved,pending_seed,levels_completed=1)
    record('point_payload_does_not_acquire_control',pending,rows,moved,pending_seed,command={'action_ref':'ACTION6','data':{'x':20,'y':24}})
    expected_cell = planned['reference_population_plan']['expected'][0]
    planned_later = raster(bodies=((expected_cell[0],expected_cell[1],5),(5,6,6)))
    move_events = record('planned_move_matches',planned,rows,planned_later,known)
    record('planned_move_no_displacement_keeps_control',planned,rows,rows,known)
    record('new_epoch_state_acquired',epoch_changed,rows,rows,known)
    # A genuinely cold own chain: each proposal sees the exact before observation
    # later passed to record, and the next proposal sees the previous after.
    # This is public synthetic evidence, never an initialization for a live game.
    cold = instance(); cold_seed = []
    cold_before = observation(rows, 'common_cold_selection:before', revision=0)
    for revision, (name, pixels, later) in enumerate([
        ('common_cold_selection', rows, marked), ('common_cold_control', marked, moved),
    ]):
        conf = copy.deepcopy(POLICY)
        conf.update({'remaining_level_actions':600-revision,'level_action_cap':600})
        cold_before_state = state(cold)
        cold_proposal = cold.propose_graph(cold_before,pixels,copy.deepcopy(INPUTS),16,conf)
        assert cold_proposal['reference_population_plan']['observation_ref'] == cold_before['observation_ref']
        cold_after = observation(later,name+':after',revision=revision+1)
        cold_command = copy.deepcopy(cold_proposal['actions'][0])
        args = {'before':cold_before,'command':cold_command,'after':cold_after,'rows':pixels,
            'later':later,'proposal':cold_proposal,'index':0,'inputs':copy.deepcopy(INPUTS),
            'limit':16,'config':conf}
        cold_events = [event for event in cold.record(cold_before,cold_command,cold_after,
            pixels,later,cold_proposal,0) if event.get('kind') == 'observed_reference_population']
        cases.append({'id':'record:'+name,'operation':'record','arguments':plain(args),
            'seedEvents':plain(copy.deepcopy(cold_seed)),'expected':plain(cold_events),
            'beforeState':cold_before_state,'afterState':state(cold)})
        assert len(cold_events) == 1
        cold_seed += copy.deepcopy(cold_events)
        cold_before = cold_after
    assert cold_seed[-1]['controls']['ACTION1']['delta'] == [-1,0]
    assert cold_seed[-1]['detail']['V5_physical_step_matches'] is True
    all_events = selection_events + moved_events
    call_case('restoration:own_events','apply_events',{'events':all_events},lambda m:[m.apply_event(copy.deepcopy(e)) for e in all_events])
    call_case('restoration:duplicate_events_preserved','apply_events',{'events':move_events+move_events},lambda m:[m.apply_event(copy.deepcopy(e)) for e in move_events+move_events])
    for name, proposal, pixels, index, changes in [
        ('initial_selection',first,rows,0,{}),('wrong_epoch',first,rows,0,{'epoch':2}),
        ('wrong_score',first,rows,0,{'score':1}),('wrong_observation',first,rows,0,{'observation_ref':'stale'}),
        ('unavailable_point',first,rows,0,{'available':['ACTION1']}),('changed_initial_frame',first,marked,0,{}),
        ('missing_population',first,variants['missing_body'],0,{}),('changed_reference',first,altered_reference,0,{}),
        ('initial_move',planned,rows,0,{}),('continuation',planned,planned_later,1,{'observation_ref':'later:any'}),
        ('wrong_continuation_population',planned,rows,1,{}),
    ]:
        v=proposal['reference_population_plan']; meta={'epoch':v['epoch'],'score':v['score'],'observation_ref':v['observation_ref'],'available':AVAILABLE,**changes}
        guards.append({'id':'before:'+name,'phase':'before','proposal':plain(proposal),'index':index,'rows':pixels,'meta':meta,
            'expected':plain(instance().before(proposal,index,pixels,**meta))})
    continuation_border = copy.deepcopy(planned_later); continuation_border[2][2]=7
    meta={'epoch':1,'score':0,'observation_ref':'later:any','available':AVAILABLE}
    guards.append({'id':'before:source_continuation_zone_corner_not_revalidated','phase':'before','proposal':planned,'index':1,
        'rows':continuation_border,'meta':meta,'expected':plain(instance().before(planned,1,continuation_border,**meta))})
    for name in ['changed_actions','changed_bundle','changed_identity','changed_plan']:
        p=copy.deepcopy(first)
        if name=='changed_actions':p['actions']=[{'action_ref':'ACTION1'}]
        elif name=='changed_bundle':p['bundle_template']['actions']=[{'action_ref':'ACTION1'}]
        elif name=='changed_identity':p['proposal_id']='reference-population:stale'
        else:p['reference_population_plan']['state']['tried']=[['ACTION1',[9,9]]]
        meta={'epoch':1,'score':0,'observation_ref':first['reference_population_plan']['observation_ref'],'available':AVAILABLE}
        guards.append({'id':'before:'+name,'phase':'before','proposal':p,'index':0,'rows':rows,'meta':meta,
            'expected':plain(instance().before(p,0,rows,**meta))})
    for name,p,pixels,later,meta in [
        ('unknown_selection',first,rows,marked,{'epoch':1,'score':0}),
        ('unknown_probe',pending,rows,moved,{'epoch':1,'score':0}),
        ('move_matched',planned,rows,planned_later,{'epoch':1,'score':0}),
        ('move_refuted',planned,rows,rows,{'epoch':1,'score':0}),
        ('move_missing_population',planned,rows,variants['missing_body'],{'epoch':1,'score':0}),
        ('move_reference_changed',planned,rows,altered_reference,{'epoch':1,'score':0}),
        ('epoch_boundary',planned,rows,blank,{'epoch':2,'score':1}),
        ('score_boundary',planned,rows,planned_later,{'epoch':1,'score':1}),
    ]:
        guards.append({'id':'after:'+name,'phase':'after','proposal':p,'index':0,'rows':pixels,'later':later,'meta':meta,
            'expected':plain(instance().after(p,0,pixels,later,**meta))})
    for name, domains in [
        ('empty',[]),('one_empty',[[]]),('singleton',[[(0,0)]]),
        ('reassignment_witness',[[(0,0),(0,1)],[(0,0)]]),
        ('ordered_alternatives',[[(0,1),(0,0)],[(0,1),(0,0)]]),
        ('duplicate_edges', [[(0,0),(0,0),(0,1)],[(0,0)]]),
        ('insufficient_capacity',[[(0,0)],[(0,0)],[(0,1)]]),
        ('augmenting_chain',[[(0,0),(0,1)],[(0,1),(0,2)],[(0,0)]]),
        ('unfilled_witness_not_impossible_identity', [[],[(0,0)],[(0,0)]]),
        ('numeric_tuple_order',[[(10,0),(2,0)],[(2,0),(10,0)]]),
    ]:
        visits=[];expected=maximum_injective_matching(domains,lambda index,ref:visits.append([index,ref]))
        matching_cases.append({'id':'matching:'+name,'arguments':plain({'domains':domains}),
            'expected':plain(expected),'visits':plain(visits)})
    base_state={'occurrences':[{'occurrence_ref':'first','cell':[1,1]},{'occurrence_ref':'second','cell':[1,2]}],
        'active_occurrence_ref':'first','reserve':0,'terminated':False}
    base_model={'movement_cells':small_floor,'motion_law_ref':'collision_checked_cardinal_step'}
    base_bounds={'domain_bound':4096,'node_bound':100000,'time_bound_ms':2000}
    physical_inputs=[
        ('free_step',{}, {}, {'kind_ref':'move','delta':[-1,0]},{}),
        ('occupied_collision',{}, {}, {'kind_ref':'move','delta':[0,1]},{}),
        ('outside_collision',{'movement_cells':[(1,1),(1,2)]},{},{'kind_ref':'move','delta':[-1,0]},{}),
        ('terminated',{}, {'terminated':True},{'kind_ref':'move','delta':[-1,0]},{}),
        ('missing_active',{}, {'active_occurrence_ref':None},{'kind_ref':'move','delta':[-1,0]},{}),
        ('unknown_active',{}, {'active_occurrence_ref':'absent'},{'kind_ref':'move','delta':[-1,0]},{}),
        ('diagonal_unsupported',{}, {}, {'kind_ref':'move','delta':[-1,1]},{}),
        ('zero_unsupported',{}, {}, {'kind_ref':'move','delta':[0,0]},{}),
        ('long_step_unsupported',{}, {}, {'kind_ref':'move','delta':[-2,0]},{}),
        ('missing_motion_law',{'motion_law_ref':None},{},{'kind_ref':'move','delta':[-1,0]},{}),
        ('duplicate_floor',{'movement_cells':small_floor+[(0,0)]},{},{'kind_ref':'move','delta':[-1,0]},{}),
        ('domain_bound',{}, {}, {'kind_ref':'move','delta':[-1,0]},{'domain_bound':2}),
        ('node_zero',{}, {}, {'kind_ref':'move','delta':[-1,0]},{'node_bound':0}),
        ('node_one',{}, {}, {'kind_ref':'move','delta':[-1,0]},{'node_bound':1}),
        ('node_exact',{}, {}, {'kind_ref':'move','delta':[-1,0]},{'node_bound':2}),
        ('time_zero',{}, {}, {'kind_ref':'move','delta':[-1,0]},{'time_bound_ms':0}),
        ('duplicate_identity',{}, {'occurrences':[{'occurrence_ref':'first','cell':[1,1]},{'occurrence_ref':'first','cell':[1,2]}]}, {'kind_ref':'move','delta':[-1,0]},{}),
        ('duplicate_occupancy',{}, {'occurrences':[{'occurrence_ref':'first','cell':[1,1]},{'occurrence_ref':'second','cell':[1,1]}]}, {'kind_ref':'move','delta':[-1,0]},{}),
        ('occurrence_outside_floor',{}, {'occurrences':[{'occurrence_ref':'first','cell':[9,9]}]}, {'kind_ref':'move','delta':[-1,0]},{}),
    ]
    for name,model_change,state_change,primitive,bounds_change in physical_inputs:
        model={**copy.deepcopy(base_model),**model_change};value={**copy.deepcopy(base_state),**state_change};bounds={**base_bounds,**bounds_change}
        args=plain({'model':model,'state':value,'primitive':primitive,'bounds':bounds})
        item={'id':'physical:'+name,'arguments':args};budget=DWorkBudget(SimpleNamespace(**bounds))
        try:
            native_model=SimpleNamespace(**{**model,'movement_cells':tuple(map(tuple,model['movement_cells']))})
            source_state=NeighborhoodState(**value);source_input=NeighborhoodInput(**primitive)
            result=_physical(native_model,source_state,source_input,budget)
            item['expected']=plain({**result,'state':result['state'].model_dump()})
        except Exception as error:item['expectedError']=error_value(error)
        item['examined']=budget.examined;physical_cases.append(item)
    admission_path=EVIDENCE/'reference-population-public-admission.json'
    if not admission_path.exists():scan_public()
    admission_raw=admission_path.read_bytes();admission=json.loads(admission_raw)
    output={'schema':'logos-engine.v6.reference-population-source-reference.v1','sourceCommit':COMMIT,
        'sourceFiles':{name:MANIFEST[name]['sha256'] for name in [POLICY_PATH,
            'agents/yf_arc3_v6/laya_proto/reference_population_access.py',
            'agents/yf_arc3_v6/laya_proto/reception_service_access.py',
            'agents/yf_arc3_v6/laya_proto/common_observed_compositions.py',
            'agents/yf_arc3_v5/capabilities/injective_matching.py',
            'agents/yf_arc3_v5/capabilities/neighborhood_pattern_construction.py',
            'agents/yf_arc3_v5/capabilities/mechanical_family_contracts_d.py']},
        'config':plain(POLICY),'rasters':{'base':rows,'marked':marked,'moved':moved,'prepared':prepared,'blank':blank},
        'cases':cases,'guards':guards,'sourceExceptions':exceptions,'matchingCases':matching_cases,'physicalCases':physical_cases,
        'publicProjection':admission['cases'],'publicCorpus':admission['corpus'],
        'publicAdmissionReceipt':{'path':admission_path.relative_to(ROOT).as_posix(),'sha256':sha(admission_raw)},
        'originalFilesVerifiedBefore':verified,'originalFilesVerifiedAfter':verify_source(),
        'qualification':'Unmodified own ReferencePopulation contracts and consumed V5 tuple matcher / selected cardinal step. Own digest comparisons use an explicitly opaque original parent digest, not full inherited-caller parity. Scene retained-frame indexing errors, unavailable point offer, empty pending-input error, own limit/deadline behavior, retained controls across epochs and limited target-frame continuation are retained. No game action, engine, specification, route or solution. Synthetic control/state seeds are contract cases and never preinitialize a live campaign.'}
    target=ROOT/'tests/fixtures/v6-reference-population-reference.json.gz'
    raw=json.dumps(output,separators=(',',':'),sort_keys=True).encode();compressed=gzip.compress(raw,mtime=0)
    if not target.exists() or target.read_bytes()!=compressed:
        temporary=target.with_suffix('.gz.tmp');temporary.write_bytes(compressed);temporary.replace(target)
    receipt={'schema':'logos-engine.reference-population-source-oracle-export.v1','status':'passed',
        'generator':{'path':Path(__file__).relative_to(ROOT).as_posix(),'sha256':sha(Path(__file__).read_bytes())},
        'fixture':{'path':target.relative_to(ROOT).as_posix(),'bytes':target.stat().st_size,'sha256':sha(target.read_bytes())},
        'cases':len(cases),'guards':len(guards),'sourceExceptions':len(exceptions),
        'matchingCases':len(matching_cases),'physicalCases':len(physical_cases),
        'publicProjectionCases':len(admission['cases']),'admittedGames':admission['admittedGames'],
        'originalFilesVerifiedBefore':verified,'originalFilesVerifiedAfter':output['originalFilesVerifiedAfter'],
        'qualification':output['qualification']}
    EVIDENCE.mkdir(parents=True,exist_ok=True)
    (EVIDENCE/'source-oracle-export.json').write_text(json.dumps(receipt,indent=2)+'\n')
    print(json.dumps(receipt))


if __name__ == '__main__':
    if sys.argv[1:] == ['--scan-only']: scan_public()
    elif sys.argv[1:]: raise SystemExit('Usage: export-v6-reference-population-reference.py [--scan-only]')
    else: run_export()
