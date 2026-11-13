#!/usr/bin/env python3
"""Independent byte-verified V5/V6 inventory observation contracts.

Only synthetic public rasters and observation dictionaries are supplied. No
game source, game identifiers, private state, route answers or native outputs
are used to compute expected values.
"""
from __future__ import annotations
import copy
import gzip
import hashlib
import importlib.util
import json
from pathlib import Path
import sys

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('inventory_verified_source', ROOT / 'scripts/probe-v6-outline-service-original.py')
helper = importlib.util.module_from_spec(spec); spec.loader.exec_module(helper)
sys.path.insert(0, str(helper.SOURCE / 'agents/yf_arc3_v6/laya_proto'))
from agents.yf_arc3_v5.capabilities.contracts import FrameGrid, ComponentExtractionInput, InteractionProbeInput, BoundingBox, PeriodicCellGridResult
from agents.yf_arc3_v5.capabilities.components import detect_components
from agents.yf_arc3_v5.capabilities import interaction
from agents.yf_arc3_v5.capabilities.contour_domains import measure_contour_domain
from agents.yf_arc3_v5.capabilities.navigation_transition_measurements import measure_current_translation_underlays
from agents.yf_arc3_v6.morphology_policy.guarded_binding import geometry
from agents.yf_arc3_v6.morphology_policy.guarded_binding.family import locate
from agents.yf_arc3_v6.morphology_policy.observed_inventory.project import CellProjection
from agents.yf_arc3_v6.morphology_policy.observed_inventory import initial, contrast, material_layers, effect_scope, control_revalidation

plain = helper.plain
cases = []


def record(name, operation, args, callback):
    arguments = plain(copy.deepcopy(args))
    try:
        value = {'value': plain(callback())}
    except (ValueError, TypeError, KeyError, IndexError) as error:
        value = {'error': {'name': type(error).__name__, 'message': str(error)}}
    cases.append({'id': name, 'operation': operation, 'arguments': arguments, **value})
    return cases[-1].get('value')


def components(rows, connectivity=4):
    return detect_components(ComponentExtractionInput(frame=FrameGrid(rows=rows), connectivity=connectivity))


def observation(rows, ref='synthetic:observation', epoch=1):
    entities = []
    for c in components(rows).components:
        mask = sorted([[x, y] for y, x in c.relative_pixels])
        shape = [c.value, mask]
        entities.append({'signature': 'synthetic:shape:' + geometry.digest(shape), 'bbox': [c.bbox.left, c.bbox.top, c.bbox.right, c.bbox.bottom], 'palette_value': c.value, 'area': c.area, 'mask': mask})
    return {'observation_ref': ref, 'level_epoch': epoch, 'available_action_refs': ['ACTION1', 'ACTION2', 'ACTION3', 'ACTION4', 'ACTION5'], 'entities': entities}


def field(body=(3, 3), shift=(0, 0), palette=None, motif=True, display=False, size=20):
    palette = palette or {n: n for n in range(16)}
    sx, sy = shift
    rows = [[palette[0]] * size for _ in range(size)]
    if motif:
        for x, y in [(7, 2), (8, 3)]: rows[y + sy][x + sx] = palette[4]
    if display:
        for x, y in [(1, 15), (2, 16)]: rows[y + sy][x + sx] = palette[4]
    for y in range(3):
        for x in range(3):
            if x in (0, 2) or y in (0, 2): rows[body[1] + sy + y][body[0] + sx + x] = palette[9]
    return rows


def probe(args):
    args = copy.deepcopy(args)
    rows = args.pop('frame')
    for name in ('canonical_provisional_control_geometry_bboxes', 'input_aligned_entity_bboxes', 'visited_input_aligned_entity_bboxes'):
        if name in args: args[name] = tuple(BoundingBox(**box) for box in args[name])
    if 'periodic_cell_grids' in args: args['periodic_cell_grids'] = PeriodicCellGridResult.model_validate(args['periodic_cell_grids'])
    return InteractionProbeInput(frame=FrameGrid(rows=rows), components=components(rows), **args)


def projection_sequence(args):
    tracker = CellProjection()
    if args.get('state') is not None: tracker.restore(args['state'])
    out = []
    for step in args['steps']:
        op = step.get('operation', 'record')
        if op == 'scope':
            value = tracker.observe_scope(step['obs'], step['rows'])
        elif op == 'restore':
            saved = tracker.state(); tracker = CellProjection(); tracker.restore(saved); value = tracker.state()
        else:
            callback = None if step.get('meaning') is None else lambda _facts, meaning=step['meaning']: copy.deepcopy(meaning)
            value = tracker.record(step['before'], step['after'], step['action'], step['first'], step['second'], callback)
        current = step.get('after', step.get('obs'))
        measured = tracker.measure(current, step.get('second', step.get('rows'))) if current is not None else None
        out.append({'value': plain(value), 'measure': plain(measured), 'state': plain(tracker.state())})
    return out


def main():
    sys.setprofile(helper.source_profile)
    for shift in [(0, 0), (1, 2)]:
        for permutation in [False, True]:
            palette = {n: (n + 5) % 16 for n in range(16)} if permutation else None
            label = str(shift) + ':' + str(permutation)
            rows = field(shift=shift, palette=palette, size=24)
            obs = observation(rows, 'synthetic:initial:' + label)
            for connectivity in (4, 8):
                args = {'rows': rows, 'connectivity': connectivity}
                record('components:' + label + ':' + str(connectivity), 'components', args, lambda: components(**args))
            record('initial_candidates:' + label, 'initial_candidates', {'observation': obs, 'rows': rows}, lambda: initial.initial_candidates(obs, rows))
            record('provisional_scenes:' + label, 'provisional_scenes', {'observation': obs, 'rows': rows}, lambda: initial.provisional_scenes(obs, rows))
            frames = [field(body=p, shift=shift, palette=palette, size=24) for p in [(3, 3), (8, 3), (8, 8), (8, 3)]]
            frames += [field(body=(8, 3), shift=shift, palette=palette, motif=False, display=True, size=24), field(body=(8, 3), shift=shift, palette=palette, size=24), field(body=(8, 8), shift=shift, palette=palette, size=24), frames[0]]
            obs = [observation(rows, 'synthetic:frame:' + label + ':' + str(i)) for i, rows in enumerate(frames)]
            actions = ['ACTION4', 'ACTION2', 'ACTION1', 'ACTION5', 'ACTION5', 'ACTION2', 'ACTION3']
            steps = [{'before': obs[i], 'after': obs[i+1], 'action': {'action_ref': actions[i]}, 'first': frames[i], 'second': frames[i+1]} for i in range(len(actions))]
            steps.insert(3, {'operation': 'restore'})
            result = record('projection:' + label, 'projection_sequence', {'steps': steps}, lambda: projection_sequence({'steps': steps}))
            assert result[0]['value']['motion'] == [5, 0]
            assert result[4]['value']['status'] == 'unique_corresponding_transfer', result[4]['value']
            assert result[5]['value']['status'] == 'unique_reverse_correspondence', result[5]['value']
            assert result[-1]['value']['status'] == 'exact_observed_scene_restoration'
            # Independent geometry/core binding measurements on the same rasters.
            args = {'before': obs[0], 'after': obs[1], 'minimum_area': 1, 'preferred_minimum_area': 4}
            moved = record('moved_core:' + label, 'moved_core', args, lambda: geometry.moved_core(**args))
            entity = geometry.find_body(obs[1], moved['signature']); core = {'palette_value': entity['palette_value'], 'area': entity['area'], 'offsets': entity['mask']}
            record('locate:' + label, 'locate', {'rows': frames[1], 'core': core}, lambda: locate(frames[1], core))
            for conn in (4, 8):
                diag = [[0, 1, 0], [1, 0, 1], [0, 1, 0]]
                record('diagonal:' + label + ':' + str(conn), 'components', {'rows': diag, 'connectivity': conn}, lambda conn=conn: components(diag, conn))
            if shift == (0, 0) and not permutation:
                base = {'frames': frames, 'obs': obs, 'projection': result, 'core': core}

    # Direct guarded geometry abstains on ambiguous signatures and competing cores.
    first, second = base['obs'][:2]
    duplicate = copy.deepcopy(second); duplicate['entities'].append(copy.deepcopy(geometry.find_body(second, base['projection'][0]['state']['core'])))
    record('moved_core:duplicate', 'moved_core', {'before': first, 'after': duplicate}, lambda: geometry.moved_core(first, duplicate))
    record('moved_core:static', 'moved_core', {'before': first, 'after': first}, lambda: geometry.moved_core(first, first))
    record('locate:missing', 'locate', {'rows': [[0]*12 for _ in range(12)], 'core': base['core']}, lambda: locate([[0]*12 for _ in range(12)], base['core']))
    for stage in (4, 5, 6):
        state = base['projection'][stage]['state']; obs = base['obs'][stage if stage < 4 else stage-1]
        rows = base['frames'][stage if stage < 4 else stage-1]
        if stage == 6: rows = base['frames'][6]; obs = base['obs'][6]
        args = {'underlays': state['underlays'], 'epoch': state['epoch'], 'rows': rows, 'body': geometry.find_body(obs, state['core'])['bbox'], 'control_signature': state['core']}
        record('layers:stage:' + str(stage), 'current_material_layers', args, lambda: material_layers.current_material_layers({tuple(k):v for k,v in args['underlays']}, args['epoch'], args['rows'], args['body'], args['control_signature']))
    # Quantum changes are interpreted only through an injected policy conclusion.
    foreign_state = base['projection'][2]['state']
    a, b = field((3, 3), motif=False), field((6, 3), motif=False)
    before, after = observation(a, 'synthetic:foreign:first', 2), observation(b, 'synthetic:foreign:second', 2)
    for result_status in [None, 'current_quantum_revalidation_candidate', 'foreign_metric_withdrawn_current_input_unresolved']:
        meaning = None if result_status is None else {'status': 'unique', 'conclusions': [{'status': result_status, 'rule_ref': 'synthetic:rule:' + result_status}]}
        step = {'before': before, 'after': after, 'action': {'action_ref': 'ACTION4'}, 'first': a, 'second': b, 'meaning': meaning}
        record('projection:foreign:' + str(result_status), 'projection_sequence', {'state': foreign_state, 'steps': [step, {'operation':'restore'}]}, lambda: projection_sequence({'state': foreign_state, 'steps': [step, {'operation':'restore'}]}))
    for name, action, epoch in [('data', {'action_ref':'ACTION4','data':{'x':1}}, 1), ('empty-data', {'action_ref':'ACTION4','data':{}}, 1), ('scope-change', {'action_ref':'ACTION4'}, 2)]:
        after = copy.deepcopy(base['obs'][1]); after['level_epoch'] = epoch
        args = {'steps':[{'before':base['obs'][0], 'after':after, 'action':action, 'first':base['frames'][0], 'second':base['frames'][1]}]}
        record('projection:' + name, 'projection_sequence', args, lambda: projection_sequence(args))
    old = {'delta':[5,0], 'recalled_hypothesis':True, 'recalled_from_epoch':1, 'observed_epoch':1}
    moved = geometry.moved_core(before, observation(b,'synthetic:foreign:second',2),minimum_area=1,preferred_minimum_area=4)
    underlays = plain(measure_current_translation_underlays(before=tuple(map(tuple,a)), after=tuple(map(tuple,b))))
    for label, prior, delta, observed_rows, measurements in [('positive',old,[3,0],b,underlays), ('opposite',old,[-3,0],b,underlays), ('no-underlay',old,[3,0],b,[]), ('same-scope',{**old,'observed_epoch':2},[3,0],b,underlays)]:
        args = {'prior':prior,'epoch':2,'delta':delta,'moved':moved,'underlays':measurements,'rows':observed_rows}
        record('control_revalidation:' + label,'control_measurements',args,lambda: control_revalidation.measurements(**args))

    # A complete contour is established from two independently entered supports.
    rows = [[0]*18 for _ in range(18)]
    for y in range(3,15):
        for x in range(3,15):
            if x in (3,14) or y in (3,14):rows[y][x]=6
    under = {tuple([5,5,6,6]):{'epoch':1,'evidence':['synthetic:entry:a'],'values':[6]},tuple([9,9,10,10]):{'epoch':1,'evidence':['synthetic:entry:b'],'values':[6]}}
    args={'rows':rows,'underlays':[[list(k),v] for k,v in under.items()],'epoch':1,'body':[6,6,7,7],'observation':'synthetic:domain'}
    domain=record('effect:measure','measure_effect_scope',args,lambda:effect_scope.measure(components(rows),under,1,[6,6,7,7],'synthetic:domain'))
    assert domain is not None
    for component in components(rows).components:
        record('contour:' + component.component_id,'measure_contour_domain',plain(component),lambda component=component:measure_contour_domain(component))
    before={'level_epoch':1,'observation_ref':'synthetic:domain:before'};after={'level_epoch':1,'observation_ref':'synthetic:domain:after'}
    for name, changes in [('remote',[(1,1)]),('interior-only',[(8,8)]),('remote-and-interior',[(1,1),(8,8)]),('broken-contour',[(1,1),(3,6)]),('authorized-contour',[(1,1),(3,6)])]:
        second=copy.deepcopy(rows)
        for x,y in changes:second[y][x]=4
        allowed=[[3,6,3,6],[6,6,7,7]] if name=='authorized-contour' else [[6,6,7,7]]
        args={'domain':domain,'before':before,'after':after,'first':rows,'second':second,'allowed':allowed,'body':[6,6,7,7]}
        record('effect:contrast:'+name,'contrast_effect_scope',args,lambda:effect_scope.contrast(**args))
    proposal={'inventory_plan':{'offer':{'scene':{'support_effect_scope':domain,'body_signature':'synthetic:body'}}},'steps':[{'expected_after':{'body_bbox':[6,6,7,7]},'body_before':[5,6,6,7]}]}
    args={'proposal':proposal,'index':0,'before':before,'after':after,'second':rows,'outcome':{'matched':True}}
    retained=record('effect:retain','retain_effect_scope',args,lambda:effect_scope.retain(**args));assert retained is not None
    for name, epoch, pixels in [('current',1,rows),('foreign',2,rows),('broken',1,[[4 if (y,x)==(3,6) else v for x,v in enumerate(row)] for y,row in enumerate(rows)])]:
        args={'record':copy.deepcopy(retained),'scene':{'body_signature':'synthetic:body','body':[6,6,7,7]},'obs':{'level_epoch':epoch,'observation_ref':'synthetic:recalled'},'rows':pixels}
        def execute_recall(args=args):
            result=effect_scope.recall(**args);return {'value':result,'record':args['record']}
        record('effect:recall:'+name,'recall_effect_scope',args,execute_recall)

    # Direct transfer and reverse contracts include missing/ambiguous evidence.
    bf=base['projection'][2]['measure'];af=base['projection'][4]['measure']
    first,second=base['frames'][3:5];bo,ao=base['obs'][3:5]
    for name, facts in [('positive',bf),('no-entry',{**bf,'underlay_evidence':{}}),('wrong-observation',{**bf,'observation_ref':'foreign'})]:
        args={'before':bo,'after':ao,'first':first,'second':second,'first_facts':facts,'second_facts':af,'action':{'action_ref':'ACTION5'}}
        record('transfer:'+name,'transferred_shape',args,lambda:contrast.transferred_shape(**args))
    receipt=base['projection'][4]['state']['displayed']
    for name, pixels in [('present',second),('absent',first)]:record('display:'+name,'display_matches',{'receipt':receipt,'rows':pixels},lambda:contrast.display_matches(receipt,pixels))
    for name, facts in [('positive',af),('no-grid',{**af,'grids':[]}),('no-body',{**af,'body':None})]:
        args={'receipt':receipt,'before':base['obs'][4],'after':base['obs'][5],'first':base['frames'][4],'second':base['frames'][5],'facts':facts}
        record('reverse:'+name,'reverse_transfer',args,lambda:contrast.reverse_transfer(**args))
    # Exact world complement and edge-display complement, deliberately non-role-specific.
    rows=[[0]*20 for _ in range(20)]
    for y in range(4):
        for x in range(20):rows[y][x]=8
    for x,y in [(1,1),(2,1),(1,2)]:rows[y][x]=4
    for y in range(5):
        for x in range(5):
            if (x,y) not in [(1,1),(2,1),(1,2)]:rows[10+y][10+x]=4
    raw={'frame':rows,'available_action_refs':['ACTION1','ACTION2','ACTION3','ACTION4'],'canonical_provisional_control_geometry_bboxes':[{'left':6,'top':6,'right':8,'bottom':8}],'input_aligned_entity_bboxes':[{'left':6,'top':6,'right':8,'bottom':8}],'known_action_translation_deltas':[['ACTION4',0,5],['ACTION2',5,0]],'observed_input_aligned_action_translation':['ACTION4',0,5],'current_input_aligned_underlay_values':[0]}
    value=probe(raw);grids=interaction._action_quantized_route_grid_candidates(value)
    raw['periodic_cell_grids']=plain(PeriodicCellGridResult(candidates=grids));value=probe(raw)
    record('grid:quantum','translation_quantum',raw,lambda:interaction._unique_primitive_action_translation_quantum(value))
    record('grid:candidates','route_grid_candidates',raw,lambda:interaction._action_quantized_route_grid_candidates(value))
    record('grid:retained-values','retained_underlay_count',raw,lambda:interaction._current_action_quantized_control_cell_retained_underlay_value_count(value))
    relations=record('display:complement','edge_complements',raw,lambda:interaction._edge_display_exact_complement_cell_measurements(value,route_grids=grids));assert len(relations)>0
    args={'facts':{'grids':plain(grids),'observation_ref':'synthetic:complements','level_epoch':1},'rows':rows}
    complements=record('world:complement','world_complements',args,lambda:contrast.world_complements(**args));assert len(complements)>0
    for name, change in [('positive',{}),('no-controls',{'canonical_provisional_control_geometry_bboxes':[],'input_aligned_entity_bboxes':[]}),('no-directional-actions',{'available_action_refs':['ACTION5']}),('no-current-evidence',{'known_action_translation_deltas':[],'observed_input_aligned_action_translation':None})]:
        request={**raw,'action_conditioned_grid_evidence':True,'interface_action_translation_deltas':[['ACTION1',-1,0],['ACTION2',1,0],['ACTION3',0,-1],['ACTION4',0,1]],'visited_input_aligned_entity_bboxes':[{'left':1,'top':6,'right':3,'bottom':8}],**change};value=probe(request)
        record('endpoint:'+name,'provisional_object_terminating_routes',request,lambda:interaction._provisional_object_terminating_routes(value))
    sys.setprofile(None)
    paths=['agents/yf_arc3_v6/morphology_policy/observed_inventory/'+name+'.py' for name in ['project','initial','contrast','material_layers','effect_scope','control_revalidation']]
    paths += ['agents/yf_arc3_v6/morphology_policy/guarded_binding/geometry.py','agents/yf_arc3_v6/morphology_policy/guarded_binding/family.py']
    paths += ['agents/yf_arc3_v5/capabilities/'+name+'.py' for name in ['interaction','components','contour_domains','navigation_transition_measurements','frame','contracts']]
    document={'schema':'logos-engine.v6.inventory-observation-reference.v1','referenceCommit':helper.COMMIT,'qualification':'Unchanged verified original Python; exact six inventory modules and their consumed defaults. The production V5 InteractionProbe registry is not wholly translated.','sourceHashes':{p:helper.VERIFIED_SOURCE[p] for p in paths},'sourceFootprint':helper.source_footprint(),'cases':cases}
    destination=ROOT/'tests/fixtures/v6-inventory-observation-reference.json.gz'
    destination.parent.mkdir(parents=True,exist_ok=True)
    destination.write_bytes(gzip.compress(json.dumps(document,sort_keys=True,separators=(',',':')).encode(),mtime=0))
    print(json.dumps({'fixture':str(destination.relative_to(ROOT)),'cases':len(cases),'bytes':destination.stat().st_size,'errors':[c['id'] for c in cases if 'error' in c]}))


if __name__=='__main__':main()
