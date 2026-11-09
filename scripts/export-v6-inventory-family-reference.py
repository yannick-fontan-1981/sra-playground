#!/usr/bin/env python3
"""Pinned original inventory family, policy and consumed caller-context contracts.

Inputs are synthetic public rasters, current observations and explicitly labeled
component checkpoints. No game, route oracle or native output supplies a result.
"""
from __future__ import annotations
from copy import deepcopy as clone
from collections import deque
import gzip
import hashlib
import importlib.util
import json
from pathlib import Path
import sys
from types import SimpleNamespace

ROOT = Path(__file__).resolve().parents[1]
sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('inventory_family_verified_source', ROOT / 'scripts/probe-v6-outline-service-original.py')
verified = importlib.util.module_from_spec(spec); spec.loader.exec_module(verified)
sys.path.insert(0, str(verified.SOURCE / 'agents/yf_arc3_v6/laya_proto'))
from neutral_observer import measure
from agents.yf_arc3_v6.morphology_policy.observed_inventory.family import ObservedInventory
from agents.yf_arc3_v6.morphology_policy.observed_inventory.policy import InventoryPolicy
from agents.yf_arc3_v6.morphology_policy.observed_meter import ObservedMeter, strips, single_line_supports
from agents.yf_arc3_v6.morphology_policy.collection_evidence import CollectionEvidence, participant, anchored
from agents.yf_arc3_v5.capabilities.contracts import FrameGrid, SceneTransitionMeasurementInput
from agents.yf_arc3_v5.capabilities.transition import _measure_pixel_packet, _boundary_adjacent_monotonic_strip_decrease
plain = verified.plain
cases, policies, meters, collections, primitives = [], [], [], [], []


def raster(body=(3,3), shift=(0,0), palette=None, motif=True, display=False, target=True):
    p = palette or list(range(16)); dx, dy = shift
    rows = [[p[0]] * (24 + dx) for _ in range(24 + dy)]
    for y in range(20 + dy, 24 + dy):
        for x in range(24 + dx): rows[y][x] = p[8]
    if motif:
        for x,y in [(7,5),(8,6)]: rows[y+dy][x+dx] = p[4]
    if display:
        for x,y in [(1,20),(2,21)]: rows[y+dy][x+dx] = p[4]
    if target:
        for y in range(5):
            for x in range(5):
                if (x,y) not in [(0,0),(1,1)]: rows[12+y+dy][12+x+dx] = p[4]
    if body is not None:
        l,t = body
        for y in range(3):
            for x in range(3):
                if y in (0,2) or x in (0,2): rows[t+y+dy][l+x+dx] = p[9]
    return rows


def observation(rows, revision=1, epoch=1, available=None):
    packet = SimpleNamespace(frame_rows=rows, frame_hash=hashlib.sha256(json.dumps(rows,separators=(',',':')).encode()).hexdigest()[:16],
        level=epoch, levels_completed=epoch-1, state='NOT_FINISHED', available_action_refs=tuple(available or ['ACTION1','ACTION2','ACTION3','ACTION4','ACTION5']))
    return measure(packet,revision,'inventory:synthetic')[0]


def family_case(name, operation, arguments, seed=None, context=None):
    family = ObservedInventory()
    if seed is not None: family.restore(clone(seed))
    if context is not None: family.context = clone(context)
    row = {'id':name,'operation':operation,'arguments':plain(arguments),'seedState':plain(family.state())}
    if context is not None: row['context'] = plain(context)
    args=clone(arguments)
    if operation=='before': args[2]=SimpleNamespace(**args[2])
    if operation=='proposeSource' and len(args)>6 and args[6] is not None:
        collection=CollectionEvidence()
        for event in args[6]['events']:collection.apply_event(event)
        args[6]=collection
    method={'recordSource':'record','proposeSource':'propose'}.get(operation,operation)
    try: row['value']=plain(getattr(family,method)(*args))
    except (ValueError, TypeError, KeyError, IndexError, AttributeError) as error:row['error']={'name':type(error).__name__,'message':str(error)}
    row['afterState']=plain(family.state());cases.append(row);return row


def meter_state(meter):
    pairs=lambda mapping: [[list(key),plain(value)] for key,value in sorted(mapping.items())]
    return {'epoch':meter.epoch,'recent':[[ref,pairs(value)] for ref,value in meter.recent],
        'hypotheses':pairs(meter.hypotheses),'peaks':pairs(meter.peaks),'last_ref':meter.last_ref,'previous_rows':plain(meter.previous_rows),
        'single_line_evidence':pairs(meter.single_line_evidence),'recent_steps':list(meter.recent_steps),'last_step_index':meter.last_step_index}


def strip_frame(length, thin=False, vertical=False, other=None):
    rows=[[0]*30 for _ in range(16)]
    for y in ([0] if thin else [2,3]):
        for x in range(2,2+length):rows[y][x]=6
    if other is not None:
        for x in range(2,2+other):rows[9][x]=rows[10][x]=7
    return [list(row) for row in zip(*rows)] if vertical else rows


def meter_case(name, steps):
    meter=ObservedMeter();out=[]
    for epoch,ref,rows,index in steps:
        meter.observe(epoch,ref,rows,primitive_index=index)
        out.append({'state':meter_state(meter),'forecast':plain(meter.forecast())})
    meters.append({'id':name,'steps':plain(steps),'values':out})


def collection_case(name, operation, arguments, seed=None):
    collection=CollectionEvidence()
    for event in (seed or {}).get('events',[]):collection.apply_event(clone(event))
    row={'id':name,'operation':operation,'arguments':plain(arguments),'seedState':plain(collection.retained_state())}
    if operation=='observe':
        args=clone(arguments);args['command']=args.pop('action');args.setdefault('meter_before',None);args.setdefault('mover',None)
        value=collection.observe(**args)
    else:value=getattr(collection,operation)(*clone(arguments))
    row.update(value=plain(value),afterState=plain(collection.retained_state()));collections.append(row);return row


def main():
    sys.setprofile(verified.source_profile)
    policy=InventoryPolicy()
    for rule in policy.config['rules']:
        facts={'current_scope_and_observation':True,**{c['field']:c['expected'] for c in rule['all_conditions']}}
        for label,measured in [('positive',facts),('unbound',{**facts,'current_scope_and_observation':False}),('missing',{k:v for k,v in facts.items() if k!=rule['all_conditions'][0]['field']})]:
            value,receipt=policy.evaluate(measured)
            policies.append({'id':rule['id']+':'+label,'facts':measured,'interpret':plain(policy.interpret(measured)),'evaluate':plain([value,receipt])})
    ambiguous={'current_scope_and_observation':True,'unassigned_endpoint_measured':True,'world_complement_unique':True,'local_source_retained':False,'display_transfer_current':False}
    policies.append({'id':'multiple_meanings_abstain','facts':ambiguous,'interpret':plain(policy.interpret(ambiguous)),'evaluate':plain(policy.evaluate(ambiguous))})
    assert policies[-1]['interpret']['status']=='ambiguous'

    a,b=raster(),raster((8,3));oa,ob=observation(a),observation(b,2);inputs=[{'action_ref':x} for x in ob['available_action_refs']]
    family_case('cold_period_hypothesis_without_correspondence','proposeSource',[oa,a,inputs,16])
    family_case('zero_budget_does_not_mutate','proposeSource',[oa,a,inputs,0])
    acquired=family_case('passive_axial_control_acquisition','recordSource',[oa,ob,{'action_ref':'ACTION4'},a,b])['afterState']
    assert acquired['tracker']['core'] and acquired['tracker']['controls']['ACTION4']['delta']==[5,0]
    for label,action,later in [('foreign_command',{'action_ref':'ACTION6'},b),('no_motion',{'action_ref':'ACTION4'},a),('point_payload',{'action_ref':'ACTION4','data':{'x':1}},b),('diagonal',{'action_ref':'ACTION4'},raster((8,8)))]:
        family_case('cold_'+label,'recordSource',[oa,observation(later,2),action,a,later])
    lower=raster((8,8));ol=observation(lower,3)
    acquired=family_case('passive_perpendicular_control_acquisition','recordSource',[ob,ol,{'action_ref':'ACTION2'},b,lower],acquired)['afterState']
    ob=observation(b,4)
    acquired=family_case('passive_return_control_acquisition','recordSource',[ol,ob,{'action_ref':'ACTION1'},lower,b],acquired)['afterState']
    chosen=family_case('observed_supplier_acquisition_proposal','proposeSource',[ob,b,inputs,16],acquired)
    assert chosen['value']['inventory_plan']['offer']['kind']=='acquisition_probe_candidate',chosen.get('error')
    proposal,remembered=chosen['value'],chosen['afterState']
    family_case('repeated_proposal_keeps_one_correspondence','proposeSource',[ob,b,inputs,16],remembered)
    family_case('unavailable_interaction_abstains','proposeSource',[ob,b,[a for a in inputs if a['action_ref']!='ACTION5'],16],acquired)
    for budget in [1,2]:family_case('short_budget_'+str(budget),'proposeSource',[ob,b,inputs,budget],acquired)
    for name,forecast in [('funded',{'steps_before_empty':8}),('exact_margin',{'steps_before_empty':2}),('underfunded',{'steps_before_empty':1}),('stale_ref',{'steps_before_empty':0,'observation_ref':'foreign'}),('stale_epoch',{'steps_before_empty':0,'level_epoch':2})]:
        forecast={'observation_ref':ob['observation_ref'],'level_epoch':1,**forecast}
        family_case('financing_'+name,'proposeSource',[ob,b,inputs,16,forecast],acquired)
    transfer=raster((8,3),motif=False,display=True);ot=observation(transfer,5)
    moved=family_case('selected_corresponding_transfer','recordSource',[ob,ot,{'action_ref':'ACTION5'},b,transfer,proposal,0],remembered)
    assert moved['value']['status']=='unique_corresponding_transfer',moved
    held=moved['afterState']
    family_case('current_display_preservation','preservation_obligations',[ot,transfer],held)
    family_case('changed_display_withdraws_preservation','preservation_obligations',[ot,b],held)
    family_case('foreign_scope_withdraws_preservation','preservation_obligations',[observation(transfer,4,2),transfer],held)
    access=family_case('held_correspondence_access_proposal','proposeSource',[ot,transfer,inputs,16],held)
    assert access.get('value') and access['value']['inventory_plan']['offer']['kind']=='access_probe_candidate', access.get('error')
    for label,p,obs,rows,state in [('acquire',proposal,ob,b,remembered),('access',access['value'],ot,transfer,held)]:
        public={'frame_rows':rows,'level':obs['level_epoch'],'levels_completed':obs['levels_completed'],'frame_hash':obs['frame_hash'],'available_action_refs':obs['available_action_refs']}
        for suffix,packet,current in [('current',public,obs),('stale_frame',{**public,'frame_hash':'foreign'},obs),('stale_scope',{**public,'level':2},obs),('missing_input',{**public,'available_action_refs':[]},obs),('stale_observation',public,{**obs,'observation_ref':'foreign'})]:
            family_case(label+'_before_'+suffix,'before',[p,0,packet,current],state)
        family_case(label+'_bind','bind',[p,None],state)
        changed=clone(p);changed['actions'][0]={'action_ref':'ACTION6'};family_case(label+'_bind_wrong_input','bind',[changed,None],state)
        changed=clone(p);del changed['steps'][0]['expected_after'];family_case(label+'_bind_missing_prediction','bind',[changed,None],state)
        family_case(label+'_after_static','after',[p,0,obs,observation(rows,obs['revision']+1),rows,rows],state)
        family_case(label+'_record_static','recordSource',[obs,observation(rows,obs['revision']+1),p['actions'][0],rows,rows,p,0],state)
    expected=access['value']['steps'][0]['expected_after']['body_bbox'];arrived=raster(tuple(expected[:2]),motif=False,display=True);on=observation(arrived,4)
    family_case('access_after_expected_arrival','after',[access['value'],0,ot,on,transfer,arrived],held)
    family_case('access_record_expected_arrival','recordSource',[ot,on,access['value']['actions'][0],transfer,arrived,access['value'],0],held)
    changed=clone(arrived);changed[17][17]=3
    family_case('access_after_unexplained_other_cell_change','after',[access['value'],0,ot,observation(changed,4),transfer,changed],held)
    restored=family_case('actual_scene_restoration_ends_local_receipts','recordSource',[ot,observation(a,4),{'action_ref':'ACTION3'},transfer,a],held)
    assert restored['value']['status']=='exact_observed_scene_restoration'
    family_case('official_boundary_captures_conditional_display','recordSource',[ot,observation(transfer,4,2),{'action_ref':'ACTION2'},transfer,transfer,access['value'],0],held)
    failed=clone(acquired);failed['failed']=[proposal['inventory_plan']['offer']['key']]
    family_case('known_failed_prefix_withdraws_offer','proposeSource',[ob,b,inputs,16],failed)
    for label,shift,palette in [('translated',(1,2),None),('palette_bijection',(0,0),[(i+5)%16 for i in range(16)])]:
        first,second=raster(shift=shift,palette=palette),raster((8,3),shift=shift,palette=palette)
        before,after=observation(first),observation(second,2)
        seed=family_case(label+'_passive_acquisition','recordSource',[before,after,{'action_ref':'ACTION4'},first,second])['afterState']
        positive=family_case(label+'_propose','proposeSource',[after,second,inputs,16],seed)
        assert positive.get('value') and positive['value']['inventory_plan']['offer']['kind']=='acquisition_probe_candidate'

    # Selection contract also exercises ties, deduplication and retained dependency.
    offer=clone(proposal['inventory_plan']['offer'])
    for label,options in [('empty',[]),('duplicate',[offer,clone(offer)]),('tie_other_target',[offer,{**clone(offer),'target':{**offer['target'],'competing':True}}]),('unfunded',[{**clone(offer),'financing':{**offer['financing'],'status':'lower_bound_exceeds_margin'}}])]:
        family_case('selection_'+label,'select',[{'options':options}],remembered,[ob,b,inputs,16,None,[],None])
    dep=clone(offer);dep['target']['dependency']={'status':'synthetic_measured_dependency'};dep['scene']['displayed_candidate']=clone(held['tracker']['displayed'])
    family_case('selection_retains_named_dependency','select',[{'options':[dep]}],held,[ot,transfer,inputs,16,None,[],None])

    # The Kernel fixture is explicitly component-only, after original measured acquisition.
    ko,ka=observation(b),observation(transfer,2);kf=ObservedInventory();kf.restore(clone(acquired));kp=kf.propose(ko,b,inputs,16)
    kr=kf.record(ko,ka,kp['actions'][0],b,transfer,kp,0)
    kernel={'qualification':'Synthetic post-control component checkpoint, never used to initialize a live game or campaign.',
        'rows':b,'afterRows':transfer,'observation':ko,'afterObservation':ka,'seedState':acquired,'proposal':plain(kp),'record':plain(kr),'afterState':plain(kf.state())}
    kernel['resumeProposal']=plain(kf.propose(ka,transfer,inputs,15));kernel['resumeState']=plain(kf.state())

    for thin,vertical in [(False,False),(True,False),(True,True)]:
        label=f'{thin}:{vertical}'
        steps=[[1,'meter:'+str(i),strip_frame(18-i*2,thin,vertical),i] for i in range(5)]
        meter_case('constant_loss:'+label,steps)
        assert meters[-1]['values'][-1]['forecast'] is not None
        meter_case('gain_and_refutation:'+label,steps+[[1,'meter:5',strip_frame(18,thin,vertical),5],[1,'meter:6',strip_frame(17,thin,vertical),6],[2,'meter:7',strip_frame(20,thin,vertical),7]])
        meter_case('duplicate_observation:'+label,steps+[steps[-1]])
    indices=[0,1,3,4,6];meter_case('thin_elapsed_steps',[[1,'elapsed:'+str(i),strip_frame(22-2*n,True),n] for i,n in enumerate(indices)])
    assert meters[-1]['values'][-1]['forecast']['loss_per_step']==2
    meter_case('incompatible_forecasts',[[1,'mixed:'+str(i),strip_frame(20-2*i,False,False,18-i),i] for i in range(5)])
    assert meters[-1]['values'][-1]['forecast'] is None
    for label,a,b in [('paired',strip_frame(16),strip_frame(14)),('thin',strip_frame(16,True),strip_frame(14,True)),('growth',strip_frame(14,True),strip_frame(16,True)),('static',strip_frame(14,True),strip_frame(14,True)),('all_removed',strip_frame(2,True),strip_frame(0,True))]:
        request=SceneTransitionMeasurementInput(before=FrameGrid(rows=a),after=FrameGrid(rows=b),transition_ref=label,boundary_search_band_px=2)
        primitives.append({'id':label,'first':a,'second':b,'strips':[[list(k),v] for k,v in sorted(strips(a).items())],
            'single':sorted([list(k) for k in single_line_supports(a,strips(a))]),'decrease':_boundary_adjacent_monotonic_strip_decrease(request,_measure_pixel_packet(request))})

    # Collection entries require a local, anchored arrival and then a real departure.
    def cframe(body=(3,6),length=8,site=True,remote=False):
        rows=[[0]*24 for _ in range(20)]
        for y in [0,1]:
            for x in range(2,2+length):rows[y][x]=6
        for x,y,v in [(2,17,2),(20,16,3),(20,3,4)]:rows[y][x]=v
        if site:rows[7][8]=6
        if body:
            for y in range(3):
                for x in range(3):
                    if x in [0,2] or y in [0,2]:rows[body[1]+y][body[0]+x]=9
        if remote:rows[12][12]=5
        return rows
    first,entered,departed=cframe(),cframe((8,6),14),cframe((13,6),12,False)
    before,after,later=observation(first),observation(entered,2),observation(departed,3)
    signature=next(e['signature'] for e in before['entities'] if e['palette_value']==9)
    meter_before={'observation_ref':before['observation_ref'],'level_epoch':1,'measured_strip':['x',0,6,'lo',2],'current_units':8,'loss_per_step':2}
    mover={'role_refs':[signature],'moves':{'ACTION4':[5,0]},'observation_ref':before['observation_ref'],'level_epoch':1}
    args={'before':before,'after':after,'first':first,'second':entered,'action':{'action_ref':'ACTION4'},'meter_before':meter_before,'mover':mover}
    entered_case=collection_case('gain_on_anchored_entry','observe',args)
    assert entered_case['value'] and entered_case['value'][0]['kind']=='gain_on_entry',entered_case
    seed=entered_case['afterState'];site_signature=entered_case['value'][0]['signature']
    collection_case('pending_evidence','evidence_for',[site_signature],seed)
    departed_case=collection_case('disappearance_on_departure','observe',{'before':after,'after':later,'first':entered,'second':departed,'action':{'action_ref':'ACTION4'},'mover':mover},seed)
    assert departed_case['value'][0]['kind']=='disappearance_confirmed'
    collection_case('confirmed_evidence','evidence_for',[site_signature],departed_case['afterState'])
    collection_case('entry_replay_is_idempotent','apply_event',[entered_case['value'][0]],seed)
    for label,changes in [('undeclared_input',{'action':{'action_ref':'ACTION2'}}),('unbound_meter',{'meter_before':{**meter_before,'observation_ref':'foreign'}}),('depletion_competes',{'meter_before':{**meter_before,'loss_per_step':8}}),('no_control',{'mover':{}}),('remote_change',{'second':cframe((8,6),14,True,True),'after':observation(cframe((8,6),14,True,True),2)})]:
        collection_case(label,'observe',{**args,**changes})
    persistence=cframe((13,6),12,True)
    collection_case('occurrence_persisted','observe',{'before':after,'after':observation(persistence,3),'first':entered,'second':persistence,'action':{'action_ref':'ACTION4'},'mover':mover},seed)
    collection_case('scope_ended','observe',{'before':after,'after':observation(departed,3,2),'first':entered,'second':departed,'action':{'action_ref':'ACTION4'},'mover':mover},seed)
    sys.setprofile(None)
    sources=verified.source_footprint()
    payload={'schema':'logos-engine.v6.inventory-family-reference.v1','referenceCommit':verified.COMMIT,
        'qualification':'Unchanged original Python on synthetic public rasters and explicit component state. No game dispatch or solved-level claim.',
        'sourceHashes':sources['importedSourceFiles']|sources['accessedSourceFiles'],'cases':cases,'policyCases':policies,'meterCases':meters,
        'collectionCases':collections,'contextPrimitives':primitives,'kernelControlled':plain(kernel)}
    out=ROOT/'tests/fixtures/v6-inventory-family-reference.json.gz';out.write_bytes(gzip.compress((json.dumps(payload,separators=(',',':'),ensure_ascii=False)+'\n').encode(),mtime=0))
    print(json.dumps({'path':str(out.relative_to(ROOT)),'familyCases':len(cases),'policyCases':len(policies),'meterCases':len(meters),'collectionCases':len(collections),'sha256':hashlib.sha256(out.read_bytes()).hexdigest()}))

if __name__=='__main__':main()
