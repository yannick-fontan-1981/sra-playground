#!/usr/bin/env python3
"""Independent unchanged-Python contracts for the reactive policy/geometry.

Synthetic rasters and declared facts are component contracts, not game results.
The exporter never invokes a game engine or imports native TypeScript values.
"""
from __future__ import annotations
import copy, gzip, hashlib, importlib.util, itertools, json, sys
from pathlib import Path

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('verified_outline_source', ROOT / 'scripts/probe-v6-outline-service-original.py')
helper = importlib.util.module_from_spec(spec); spec.loader.exec_module(helper)
from agents.yf_arc3_v6.morphology_policy.reactive_contact.policy import ContactPolicy
from agents.yf_arc3_v6.morphology_policy.reactive_contact import geometry
from agents.yf_arc3_v5.capabilities import rigid_grasp_geometry as rigid
from agents.yf_arc3_v5.capabilities.reactive_pursuit_observation import measure_reactive_pursuit_observation
from agents.yf_arc3_v5.capabilities.contracts import FrameGrid, InteractionProbeInput, ComponentExtractionInput, BoundingBox
from agents.yf_arc3_v5.capabilities.components import detect_components

plain = helper.plain
CASES = []

def record(name, operation, arguments, callback):
    try: result = {'value': plain(callback())}
    except (TypeError, ValueError, KeyError) as exc: result = {'error': {'name': type(exc).__name__, 'message': str(exc)}}
    CASES.append({'id': name, 'operation': operation, 'arguments': plain(arguments), **result})

def fact_variants(base, fields):
    yield 'valid', copy.deepcopy(base)
    for field in fields:
        for label, value in [('false', False), ('numeric-one', 1), ('null', None), ('absent', ... )]:
            facts = copy.deepcopy(base)
            if value is ...: facts.pop(field, None)
            else: facts[field] = value
            yield field + ':' + label, facts

policy = ContactPolicy()
local = 'agents/yf_arc3_v6/morphology_policy/reactive_contact/contact.drm'
v5_source = 'agents/yf_arc3_v5/drm/interaction.drm'
original_document = json.loads((helper.SOURCE / v5_source).read_text())
original_projections = {p['id']:p for d in original_document['declarations'] for p in d.get('fact_projections',[]) if p['id'] in policy.config['contact_projections']}
assert set(original_projections) == set(policy.config['contact_projections'])
subset = {'schema':'logos-engine.v6.reactive-contact-policy.v1','referenceCommit':helper.COMMIT,
          'scope':'Exact two consumed V5 fact projections, full local V6 ContactPolicy; not the full production DRM registry.',
          'sourceHashes':{path:helper.VERIFIED_SOURCE[path] for path in (local,v5_source)},'projections':original_projections}
(ROOT/'src/logos-engine/v6/reactive-contact-policy.json').write_text(json.dumps(subset,ensure_ascii=False,indent=2)+'\n')
for name, facts in fact_variants({c['field']: True for c in policy.config['control_conditions']}, [c['field'] for c in policy.config['control_conditions']]):
    record('control:' + name, 'bind_control', facts, lambda facts=facts: policy.bind_control(facts))
ready = {c['field']: True for c in policy.config['source81_ready_operator_conditions']}
for name, facts in fact_variants(ready, list(ready)):
    record('ready:' + name, 'ready_operator', facts, lambda facts=facts: policy.ready_operator(facts))
offer_facts = {c['field']: True for c in policy.config['conditions'] + policy.config['parent_conditions']}
offers = [{'kind': kind, 'cost': 2, 'peer_distance': 5, 'facts': copy.deepcopy(offer_facts)} for kind in policy.config['priority']]
for i in range(len(offers)):
    selected = list(reversed(offers[i:]))
    record('select:priority:' + str(i), 'choose', selected, lambda selected=selected: policy.choose(selected))
for name, facts in fact_variants(offer_facts, list(offer_facts)):
    selected = [{'kind': 'parent_escape_configuration_access', 'cost': 2, 'peer_distance': 5, 'facts': facts}]
    record('select:' + name, 'choose', selected, lambda selected=selected: policy.choose(selected))
for name, selected in [('empty', []), ('unknown', [{'kind': 'unknown', 'cost': 0, 'peer_distance': 0, 'facts': offer_facts}]),
    ('cost-distance-index', [{'kind': 'binding_followup', 'cost': cost, 'peer_distance': distance, 'facts': offer_facts} for cost, distance in [(3, 1), (2, 9), (2, 2), (2, 2)]])]:
    record('select:' + name, 'choose', selected, lambda selected=selected: policy.choose(selected))

contact = {'candidate_ref': 'probe:synthetic{literal}', 'relative_escape_contact_component_refs': ['subject'], 'relative_escape_contact_witnesses': [{'frame_ref': 'frame'}], 'relative_escape_transition_rows': [{'frame_ref': 'before'}]}
for ref in policy.config['contact_projections']:
    for condition in policy.projections[ref]['all_conditions']:
        field, op, expected = condition['field'], condition['operator'], condition.get('expected')
        if field == 'current_contact_mechanism_probe': continue
        contact[field] = (not expected if isinstance(expected, bool) else 'other') if op == 'not_equals' else expected + 1 if op == 'greater_than' else expected
contact['incoming_declared_route_engagement_present'] = False
for name, facts in [('valid', contact), ('missing-bound', {k:v for k,v in contact.items() if k != 'relative_escape_contact_witnesses'}), ('missing-template', {k:v for k,v in contact.items() if k != 'candidate_ref'})]:
    record('contact:' + name, 'contact', facts, lambda facts=facts: policy.contact(facts))
for field in ['relative_escape_candidate_contact_input_available', 'relative_escape_contact_measurement_status', 'relative_escape_contact_component_count', 'relative_motion_controlled_approach_counteracted', 'current_context_no_effect_memory_match']:
    facts = {k:v for k,v in contact.items() if k != field}
    record('contact:absent:' + field, 'contact', facts, lambda facts=facts: policy.contact(facts))

receipt = {'epoch': 3, 'body_signature': 'controlled:é', 'subject_mask_digest': 'mask', 'subject_area': 4, 'operator_action_ref': 'ACTION5', 'operator_observation_refs': ['before:α', 'after:β'], 'transition_refs': ['move:1', 'move:2'], 'body_delta_xy': [0, -4], 'part_delta_xy': [0, -4]}
binding = {c['field']: True for c in policy.config['common_translation_claim']['conditions']}
for name, facts in fact_variants(binding, list(binding)):
    args = {'facts': facts, 'receipt': receipt}; record('binding:' + name, 'reconcile_binding', args, lambda args=args: policy.reconcile_binding(**args))
for field in policy.config['common_translation_claim']['required_receipt_fields']:
    args = {'facts': binding, 'receipt': {k:v for k,v in receipt.items() if k != field}}
    record('binding:receipt-absent:' + field, 'reconcile_binding', args, lambda args=args: policy.reconcile_binding(**args))
entry = {c['field']: True for c in policy.config['source81_entry']['conditions']}
for name, facts in fact_variants(entry, list(entry)):
    args = {'facts': facts, 'receipt': receipt, 'available_action_refs': ['ACTION1', 'ACTION5']}
    record('entry:' + name, 'source81_entry', args, lambda args=args: policy.source81_entry(args))
for available in [[], ['ACTION1'], ['ACTION5', 'ACTION7']]:
    args = {'facts': entry, 'receipt': receipt, 'available_action_refs': available}
    record('entry:available:' + str(available), 'source81_entry', args, lambda args=args: policy.source81_entry(args))

def entity(box, color, ref):
    left, top, right, bottom = box
    pixels = [[x,y] for y in range(bottom-top+1) for x in range(right-left+1)]
    return {'id':ref, 'signature':geometry.digest([right-left+1,bottom-top+1,color]),'bbox':list(box),'palette_value':color,'area':len(pixels),'mask':pixels}

def raster(entities, size=28, floor=0):
    rows=[[floor]*size for _ in range(size)]
    for e in entities:
        for x,y in e['mask']: rows[e['bbox'][1]+y][e['bbox'][0]+x]=e['palette_value']
    return rows

def observation(entities, index=1, epoch=1):
    return {'entities':entities,'level_epoch':epoch,'observation_ref':f'synthetic:{epoch}:{index}','available_action_refs':['ACTION1','ACTION2','ACTION3','ACTION4','ACTION5'],'frame_hash':'public:synthetic','levels_completed':epoch-1}

for shift, colors in itertools.product([(0,0),(2,1)], [(2,3,4),(8,7,1)]):
    dx,dy=shift
    for quantum, extent in [(4,2),(4,4),(3,3),(5,3),(4,3),(1,1)]:
        q=quantum
        initial=[entity([3+dx,3+dy,2+dx+extent,2+dy+extent],colors[0],'body'), entity([3+dx+3*q,3+dy,2+dx+3*q+extent,2+dy+extent],colors[1],'peer'), entity([3+dx+q,3+dy+q,2+dx+q+extent,2+dy+q+extent],colors[2],'subject')]
        if max(e['bbox'][2] for e in initial)>=28 or max(e['bbox'][3] for e in initial)>=28: continue
        first=raster(initial); later=copy.deepcopy(initial)
        for i,delta in [(0,[q,0]),(1,[0,q])]:
            later[i]['bbox']=[v+delta[j%2] for j,v in enumerate(later[i]['bbox'])]
        second=raster(later); before,after=observation(initial,1),observation(later,2)
        args={'before':before,'after':after,'first':first,'second':second,'core':later[0]['signature'],'quantum':q}
        record(f'relative:{shift}:{colors}:{q}:{extent}', 'relative', args, lambda args=args: geometry.relative(**args))
        for current in [True,False]:
            control={'signature':later[0]['signature'],'commands':{'ACTION4':[q,0]},'evidence':['before','after']}
            if current: control['last_motion']={'after_ref':after['observation_ref'],'translation':['ACTION4',0,q]}
            args={'obs':after,'rows':second,'control':control,'peer':later[1]['signature'],'floor':0}
            def measure(args=args):
                local=copy.deepcopy(args); result=geometry.scene(**local)
                return {'scene':plain(result),'control':local['control']}
            record(f'scene:{shift}:{colors}:{q}:{extent}:{current}', 'scene', args, measure)
        record(f'body:{shift}:{colors}:{q}:{extent}', 'current_body_box', {'rows':second,'body':later[0]}, lambda second=second,later=later: geometry.current_body_box(second,later[0]))

# An exact bound scene exercises source path ordering, support guards and current
# member rebinding without assigning any game or physical meaning to the raster.
es=[entity([3,3,4,4],2,'body'),entity([15,3,16,4],3,'peer'),entity([7,7,8,8],4,'part')]
rows=raster(es); obs=observation(es); control={'signature':es[0]['signature'],'commands':{'ACTION4':[4,0],'ACTION2':[0,4]},'evidence':['one','two']}
measured=geometry.scene(obs,rows,control,es[1]['signature'],0)
assert measured is not None
for excluded in [[],[measured['peerkey']],list(sorted(measured['admitted']))]:
    args={'scene':plain(measured),'directions':policy.config['direction_prior'],'excluded':excluded}
    record('routes:'+str(excluded), 'routes', args, lambda excluded=excluded: geometry.routes(measured,policy.config['direction_prior'],excluded))
offer={'body':es[0],'peer':es[1],'subject':es[2],'guard_tiles':{k:{'box':v['box']} for k,v in measured['tiles'].items()},'guard_support_value':0,'guard_other_entities':[]}
for name, current_rows, expected in [('same',rows,None),('subject-missing',raster(es[:2]),None),('foreign-expected',rows,[11,7,12,8])]:
    args={'rows':current_rows,'offer':offer,'expected_part':expected}
    record('member:'+name,'current_member_scene',args,lambda args=args: geometry.current_member_scene(**args))

for name, mutate in [
    ('renamed-inputs', lambda a: a['control'].update(commands={'east-input':[4,0],'south-input':[0,4]})),
    ('incompatible-quanta', lambda a: a['control'].update(commands={'ACTION4':[4,0],'ACTION2':[0,5]})),
    ('missing-floor', lambda a: a.update(floor=None)),
    ('missing-peer', lambda a: a.update(peer='missing')),
    ('duplicate-control', lambda a: a['obs']['entities'].append(copy.deepcopy(a['obs']['entities'][0]))),
]:
    args={'obs':copy.deepcopy(obs),'rows':copy.deepcopy(rows),'control':copy.deepcopy(control),'peer':es[1]['signature'],'floor':0}
    mutate(args)
    def measure(args=args):
        local=copy.deepcopy(args); result=geometry.scene(**local)
        return {'scene':plain(result),'control':local['control']}
    record('scene:domain:'+name,'scene',args,measure)

for label, subject_box in [('cell',[6,4,7,5]),('multicell',[6,4,9,5]),('unaligned-multicell',[6,3,9,4])]:
    entities=[entity([4,4,5,5],2,'actor'),entity(subject_box,3,'contact')]
    image=raster(entities,size=16)
    for variation in ['current','prior-missing','grid-unqualified','ambiguous-control','changed-subject']:
        fields={'canonical_provisional_control_geometry_bboxes':[[4,4,5,5]],'current_observation_frame_ref':'measured:contact','current_exact_component_translations':[],
                'previous_action_observed_frame':copy.deepcopy(image),'current_input_aligned_underlay_values':[0]}
        if variation=='prior-missing':fields['previous_action_observed_frame']=None
        if variation=='ambiguous-control':fields['canonical_provisional_control_geometry_bboxes'].append(subject_box)
        if variation=='changed-subject':fields['previous_action_observed_frame']=raster(entities[:1],size=16)
        options={'contact_quantum':2,'contact_grid_current':variation!='grid-unqualified'}
        def measured(fields=fields,image=image,options=options):
            kwargs=copy.deepcopy(fields)
            kwargs['canonical_provisional_control_geometry_bboxes']=tuple(BoundingBox(left=b[0],top=b[1],right=b[2],bottom=b[3]) for b in kwargs['canonical_provisional_control_geometry_bboxes'])
            if kwargs['previous_action_observed_frame'] is not None:kwargs['previous_action_observed_frame']=FrameGrid(rows=kwargs['previous_action_observed_frame'])
            frame=FrameGrid(rows=image)
            value=InteractionProbeInput(frame=frame,available_action_refs=('ACTION1','ACTION5'),components=detect_components(ComponentExtractionInput(frame=frame)),**kwargs)
            return measure_reactive_pursuit_observation(value,**options)
        record('pursuit:'+label+':'+variation,'pursuit',{'rows':image,'fields':fields,'options':options},measured)

for index,(carrier,part,extra,obstacles,terrain) in enumerate([
    ([[0,0],[1,0]],[[0,1]],[],[],[[[0,0],['SUPPORTED','e']],[[1,0],['SUPPORTED','e']],[[0,1],['SUPPORTED','e']]]),
    ([[0,0],[1,0]],[[0,1]],[[2,2]],[[1,0]],[[[0,0],['SUPPORTED','e']],[[0,1],['BLOCKED','e']],[[2,2],['SUPPORTED',None]]]),
    ([],[],[],[],[])]):
    args={'carrier':carrier,'part':part,'extra':extra,'obstacles':obstacles,'terrain':terrain}
    record('rigid:collisions:'+str(index),'support_collisions',args,lambda args=args: rigid.support_collisions(tuple(map(tuple,args['carrier'])),tuple(map(tuple,args['part'])),{tuple(p):v for p,v in args['terrain']},tuple(map(tuple,args['obstacles'])),tuple(map(tuple,args['extra']))))
for bound in [0,1,7,8,20]:
    args={'carrier_offsets':[[0,0],[1,0]],'part_cells':[[3,3],[4,3]],'vectors':[[1,0],[-1,0],[0,1],[0,-1]],'maximum_evaluations':bound}
    record('rigid:roots:'+str(bound),'candidate_grasp_roots',args,lambda args=args:rigid.candidate_grasp_roots(**args))

paths=['agents/yf_arc3_v6/morphology_policy/reactive_contact/'+n for n in ['policy.py','geometry.py','contact.drm','contact.src']]+['agents/yf_arc3_v5/capabilities/'+n for n in ['reactive_pursuit_observation.py','rigid_grasp_geometry.py','interaction.py','navigation_transition_measurements.py','autonomous_consumption_d.py']]
out={'schema':'logos-engine.v6.reactive-contact-reference.v1','referenceCommit':helper.COMMIT,'qualification':'Unchanged original Python component contracts; synthetic facts/rasters, not live games. Source set iteration order is compared only where semantically ordered. Hash identities are within exact JSON safe integer/string domain.','sourceHashes':{p:helper.VERIFIED_SOURCE[p] for p in paths},'cases':CASES}
target=ROOT/'tests/fixtures/v6-reactive-contact-reference.json.gz'
with target.open('wb') as raw:
    # Input mapping insertion order is part of source iterations such as tiles;
    # sorting a serialized argument would silently change that test input.
    with gzip.GzipFile(filename='',mode='wb',fileobj=raw,mtime=0) as stream: stream.write(json.dumps(out,ensure_ascii=False,separators=(',',':'),allow_nan=False).encode())
print(json.dumps({'cases':len(CASES),'fixture':str(target.relative_to(ROOT)),'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'bytes':target.stat().st_size}))
