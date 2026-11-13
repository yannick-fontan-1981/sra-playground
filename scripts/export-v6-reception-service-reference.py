#!/usr/bin/env python3
"""Run unchanged original ReceptionService contracts on synthetic public pixels.

The renderer is a neutral admitted visual grammar, never a game model. Source
alias and epoch/budget defects remain explicit counterexamples. Native ownership
adaptations are tested separately and are not substituted into this oracle.
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
from reception_service_access import ReceptionServiceAccess
from reception_service_projection import scene, carriers, path, sides
from rooted_line_access import RootedLineAccess
from exposed_reception_access import ExposedReceptionAccess
from residual_access import ResidualAccess
from neutral_observer import measure
from terminal_composition import identity
from src_bridge import plain
from agents.yf_arc3_v5.capabilities.reception_wait_contracts_d import ReceptionWaitBudgetD

POLICY_PATH = 'agents/yf_arc3_v6/morphology_policy/strategy.drm'
POLICY = json.loads((SOURCE / POLICY_PATH).read_text())['declarations'][0]['configuration']['observed_composition_services']
INPUTS = [{'action_ref':'ACTION'+str(i)} for i in range(1,5)]


def sha(data): return hashlib.sha256(data).hexdigest()
def verify_source():
    for name, expected in MANIFEST.items():
        assert sha((SOURCE / name).read_bytes()) == expected['sha256'], name
    return len(MANIFEST)


def raster(*, origin=(2,2), width=2, border_count=8, colors=None, carrier=(1,4),
           supports=None, request=True, body=True, shape=((0,0),(0,1),(1,1)),
           shape_origin=(17,17), canvas=(64,64)):
    """Measured lattice grammar only; no game implementation or route."""
    palette={} if colors is None else colors
    paint=lambda c:palette.get(c,c)
    rows=[[paint(0)]*canvas[0]for _ in range(canvas[1])]
    left,top=origin;pitch=width+2
    def put(x,y,c): rows[y][x]=paint(c)
    for gy in range(border_count):
        for gx in range(border_count):
            if gx not in (0,border_count-1) and gy not in (0,border_count-1): continue
            for dy in range(width):
                for dx in range(width):put(left+gx*pitch+dx,top+gy*pitch+dy,1)
    if supports is None:supports=[(0,0,3),(2,0,3),(0,2,3),(5,2,4)]
    for gx,gy,color in supports:
        x,y=left+pitch-1+gx*pitch,top+pitch-1+gy*pitch
        for dy in range(pitch):
            for dx in range(1,pitch):
                if dy in (0,pitch-1)or dx==pitch-1:put(x+dx,y+dy,color)
    if carrier is not None:
        gx,gy=carrier;x,y=left+pitch-1+gx*pitch,top+pitch-1+gy*pitch
        for dx,dy in ((0,0),(pitch-1,0),(0,pitch-1),(pitch-1,pitch-1)):put(x+dx,y+dy,5)
    if body:
        for dx,dy in shape:put(shape_origin[0]+dx,shape_origin[1]+dy,6)
    if request:
        for dx,dy in shape:put(left+3+dx,top+(border_count-1)*pitch+width+4+dy,7)
    return rows


def observation(rows, name='current', **changes):
    packet=SimpleNamespace(frame_rows=rows,frame_hash=sha(json.dumps(rows,separators=(',',':')).encode())[:16],
                           level=changes.pop('level_epoch',1),levels_completed=changes.pop('levels_completed',0),
                           state=changes.pop('state','NOT_FINISHED'),available_action_refs=[a['action_ref']for a in INPUTS])
    value,_=measure(packet,changes.pop('revision',0),'synthetic:reception-service:'+name)
    value.update(changes);return plain(value)


def state(memory):
    return {'projection':plain({'reception_memory':memory.reception_memory,'reception_events':memory.reception_events}),
            'parentDigest':RootedLineAccess.retained_digest(memory),'digest':memory.retained_digest()}


def instance(seed=()):
    value=ReceptionServiceAccess()
    for event in copy.deepcopy(seed):value.apply_event(event)
    return value


def error_value(error):
    value={'type':type(error).__name__}
    if hasattr(error,'errors'):
        value['errors']=[{'type':e['type'],'loc':list(e['loc'])} for e in error.errors()]
    else:value['message']=str(error)
    return value


def run_export():
    before=verify_source();cases=[];guards=[];exceptions=[];alias_cases=[];ledger_cases=[];residual_cases=[]
    def add(name,op,args,expected):
        cases.append({'id':name,'operation':op,'arguments':plain(args),'expected':plain(expected)})
        return expected
    def mem(name,op,args,call,seed=()):
        m=instance(seed);initial=state(m)
        try: expected=call(m)
        except Exception as error:
            exceptions.append({'id':name,'operation':op,'arguments':plain(args),'seedEvents':plain(list(seed)),
                               'expectedError':error_value(error),'beforeState':initial,'afterState':state(m)})
            return None
        cases.append({'id':name,'operation':op,'arguments':plain(args),'seedEvents':plain(list(seed)),
                      'expected':plain(expected),'beforeState':initial,'afterState':state(m)})
        return expected
    rows=raster();s=scene(rows);assert s is not None
    add('scene:base','scene',{'rows':rows,'retained':None},s)
    add('carriers:base','carriers',{'rows':rows,'scene':s},carriers(rows,s))
    variants={
        'translated':raster(origin=(4,5),shape_origin=(19,20)),
        'palette_permuted':raster(colors={0:12,1:9,3:11,4:1,5:7,6:2,7:0}),
        'pitch_five':raster(width=3), 'pitch_six':raster(width=4,shape_origin=(21,21)),
        'no_carrier':raster(carrier=None), 'no_support':raster(supports=[]),
        'three_supports':raster(supports=[(0,0,3),(2,0,3),(5,2,4)]),
        'all_repeated_supports':raster(supports=[(0,0,3),(2,0,3),(0,2,3),(5,2,3)]),
        'multiple_unique_supports':raster(supports=[(0,0,3),(2,0,3),(0,2,8),(5,2,4)]),
        'no_request':raster(request=False),'no_world_counterpart':raster(body=False),
        'blank':[[0]*64 for _ in range(64)], 'target_carrier':raster(carrier=(5,2)),
    }
    extra=copy.deepcopy(rows)
    for dx,dy in ((0,0),(3,0),(0,3),(3,3)):extra[21+dy][21+dx]=5
    variants['ambiguous_carriers']=extra
    bad=copy.deepcopy(rows);bad[21][10]=5;variants['filled_carrier_edge']=bad
    for name,pixels in variants.items():
        result=scene(pixels)
        add('scene:'+name,'scene',{'rows':pixels,'retained':None},result)
        if result is not None:add('carriers:'+name,'carriers',{'rows':pixels,'scene':result},carriers(pixels,result))
    twin_a=raster(canvas=(96,96));twin_b=raster(origin=(40,48),canvas=(96,96),shape_origin=(55,63))
    twins=[[twin_b[y][x] if twin_b[y][x] else twin_a[y][x] for x in range(96)]for y in range(96)]
    twin_scene=scene(twins);assert twin_scene is not None and twin_scene['box'][0]==40
    add('scene:equal_borders_python_tuple_max','scene',{'rows':twins,'retained':None},twin_scene)
    for name in ('no_request','no_world_counterpart','target_carrier','multiple_unique_supports'):
        pixels=variants[name];result=scene(pixels,s)
        add('scene:retained_'+name,'scene',{'rows':pixels,'retained':s},result)
        if result is not None:add('carriers:retained_'+name,'carriers',{'rows':pixels,'scene':result},carriers(pixels,result))
    tampered=copy.deepcopy(variants['target_carrier']);tampered[14][28]=0
    add('scene:retained_noncorner_refuted','scene',{'rows':tampered,'retained':s},scene(tampered,s))
    for name,box,color in [('concave',s['target']['bbox'],s['target']['color']),('border_square',[2,2,3,3],1),('blank',[40,40,43,42],8)]:
        add('sides:'+name,'sides',{'rows':rows,'box':box,'color':color},sides(rows,box,color))
    moves={'ACTION1':[0,-4],'ACTION2':[0,4],'ACTION3':[-4,0],'ACTION4':[4,0]}
    start=carriers(rows,s)[0]['anchor'];target=s['target']['anchor']
    for name,origin,dest,chosen,remaining in [
        ('complete',start,target,moves,40),('budget_too_short',start,target,moves,1),
        ('already_target',target,target,moves,0),('partial_one_direction',start,target,{'ACTION4':[4,0]},40),
        ('no_improvement',start,target,{'ACTION3':[-4,0]},40),('no_moves',start,target,{},40),
        ('support_avoidance',[13,5],[5,5],moves,40),
    ]:
        args={'rows':rows,'scene':s,'start':origin,'target':dest,'moves':chosen,'remaining':remaining}
        add('path:'+name,'path',args,path(rows,s,origin,dest,chosen,remaining))
    def seed_memory(**changes):
        m=plain(instance().reception_memory);m.update(changes)
        return [{'kind':'observed_reception_service','memory':m,'detail':{'synthetic_contract_seed':True}}]
    def propose(name,pixels=rows,seed=(),limit=16,inputs=None,config=None,**changes):
        o=observation(pixels,name,**changes);conf=copy.deepcopy(POLICY)
        conf.update({'remaining_level_actions':64,'level_action_cap':64})
        if config is not None:conf.update(config)
        inputs=copy.deepcopy(INPUTS if inputs is None else inputs)
        args={'observation':o,'rows':pixels,'inputs':inputs,'limit':limit,'config':conf}
        return mem('propose:'+name,'propose',args,lambda m:m.propose_graph(o,pixels,inputs,limit,conf),seed)
    first=propose('initial_control')
    assert first and first['reception_service_plan']['kind']=='control_probe'
    propose('current_input_order',inputs=[{'action_ref':'ACTION4'}])
    propose('point_payload_is_not_control',inputs=[{'action_ref':'ACTION1','data':{'x':5,'y':5}}])
    propose('empty_payload_is_control',inputs=[{'action_ref':'ACTION2','data':{}}])
    propose('deadline',config={'level_deadline':-1})
    propose('no_inputs',inputs=[])
    propose('least_tried_probe',seed=seed_memory(epoch=1,scene=s,trials={'ACTION1':3,'ACTION2':1}))
    known=seed_memory(epoch=1,scene=s,controls={k:{'delta':d,'evidence':['old:a','old:b'],'status':'provisional_observed_control'}for k,d in moves.items()},evidence=['old:a','old:b'])
    planned=propose('learned_access',seed=known)
    assert planned and planned['reception_service_plan']['kind']=='access'
    propose('prefix_limit',seed=known,limit=1)
    propose('remaining_actions_too_short',seed=known,config={'remaining_level_actions':1})
    propose('missing_control_partial_access',seed=seed_memory(epoch=1,scene=s,controls={'ACTION4':{'delta':[4,0],'evidence':['a','b']}}))
    propose('same_epoch_refuted',seed=seed_memory(epoch=1,scene=s,refuted=[{'epoch':1,'matched':False}]))
    old=seed_memory(epoch=1,scene=s,controls=known[0]['memory']['controls'],trials={'ACTION1':4},wait_spent=7,
                    refuted=[{'epoch':1,'matched':False}],stationary={'ACTION4':target},evidence=['prior:epoch'])
    changed=propose('new_epoch_tentative_reset',seed=old,level_epoch=2)
    assert changed['reception_service_plan']['memory']['epoch']==2
    assert changed['reception_service_plan']['memory']['stationary']=={'ACTION4':target}
    goal_rows=variants['target_carrier']
    waiting=propose('first_stationary_witness',goal_rows,known)
    assert waiting and waiting['reception_service_plan']['kind']=='reception_observation'
    stationary=seed_memory(**{**known[0]['memory'],'stationary':{'ACTION4':target},'wait_spent':5})
    batch=propose('confirmed_wait_batch',goal_rows,stationary)
    assert len(batch['actions'])==POLICY['reception_service_question']['wait_batch']
    propose('wait_remaining_limit',goal_rows,stationary,config={'remaining_level_actions':2})
    propose('wait_prefix_limit',goal_rows,stationary,limit=2)
    propose('wait_cumulative_limit',goal_rows,stationary,config={'level_action_cap':7})
    exhausted=seed_memory(**{**stationary[0]['memory'],'wait_spent':64})
    propose('wait_exhausted_no_missing_control',goal_rows,exhausted)
    incomplete=seed_memory(**{**exhausted[0]['memory'],'controls':{'ACTION4':known[0]['memory']['controls']['ACTION4']}})
    probe_after_wait=propose('source_wait_exhaustion_unrelated_probe',goal_rows,incomplete)
    assert probe_after_wait and probe_after_wait['reception_service_plan']['kind']=='reception_observation'
    # Source falls back to a new probe command but leaves the wait kind/why.
    assert probe_after_wait['actions']==[{'action_ref':'ACTION1'}]
    propose('source_600_action_ledger_rejected',goal_rows,stationary,config={'level_action_cap':600})
    propose('source_129_spent_rejected',goal_rows,seed_memory(**{**stationary[0]['memory'],'wait_spent':129}),config={'level_action_cap':128})
    propose('source_zero_remaining_first_wait',goal_rows,known,config={'remaining_level_actions':0})
    def record(name,proposal,pixels,later,seed=(),index=0,command=None,**changes):
        before_obs=observation(pixels,name+':before',level_epoch=proposal['reception_service_plan']['epoch'])
        after_obs=observation(later,name+':after',revision=1,level_epoch=changes.pop('level_epoch',before_obs['level_epoch']),**changes)
        command=copy.deepcopy(command or proposal['actions'][index])
        args={'before':before_obs,'command':command,'after':after_obs,'rows':pixels,'later':later,'proposal':proposal,'index':index}
        return mem('record:'+name,'record',args,lambda m:[e for e in m.record(before_obs,command,after_obs,pixels,later,proposal,index)if e.get('kind')=='observed_reception_service'],seed)
    acquired=record('observed_control_and_residual',first,rows,raster(carrier=(1,3)))
    assert acquired and acquired[0]['memory']['controls']['ACTION1']['delta']==[0,-4]
    assert acquired[0]['memory']['residual_events']
    propose('after_observed_control',raster(carrier=(1,3)),acquired)
    record('no_movement_trial',first,rows,rows)
    record('diagonal_not_control',first,rows,raster(carrier=(2,3)))
    record('nonpitch_not_control',first,rows,variants['ambiguous_carriers'])
    record('missing_later_scene',first,rows,variants['blank'])
    record('epoch_boundary',first,rows,variants['blank'],level_epoch=2,levels_completed=1)
    record('score_only_change',first,rows,raster(carrier=(1,3)),levels_completed=1)
    first_step=planned['reception_service_plan']['steps'][0]
    anchor=first_step['to'];later=raster(carrier=((anchor[0]-5)//4,(anchor[1]-5)//4))
    accepted=record('access_matched',planned,rows,later,known)
    contradicted=record('access_refuted',planned,rows,rows,known)
    propose('after_access_refutation',rows,contradicted)
    wait_event=record('stationary_confirmed',waiting,goal_rows,goal_rows,known)
    assert wait_event[0]['memory']['stationary']=={'ACTION4':target}
    assert wait_event[0]['memory']['wait_spent']==1
    record('waiting_moved_refutation',waiting,goal_rows,raster(carrier=(4,2)),known)
    record('waiting_missing_projection_still_spent',waiting,goal_rows,variants['blank'],known)
    record('waiting_epoch_boundary_not_spent',waiting,goal_rows,variants['blank'],known,level_epoch=2,levels_completed=1)
    epoch_event=record('source_new_epoch_record_keeps_old_memory',changed,rows,raster(carrier=(1,3)),old)
    assert epoch_event[0]['memory']['epoch']==1 and epoch_event[0]['memory']['wait_spent']==7
    assert epoch_event[0]['memory']['refuted']
    mem('restoration:own_events','apply_events',{'events':acquired+accepted},lambda m:[m.apply_event(copy.deepcopy(e))for e in acquired+accepted])
    # A preceding Exposed event shares the exact original list. Its effects on
    # initial Reception acquisition and both digest layers are retained as data.
    exposed={'kind':'observed_exposed_reception','state':{'epoch':1,'layout':'synthetic:other','evidence':['exposed:proof'],'probed':[],'dial_tried':[]},
             'controls':{},'models':{'coupled':{},'attached':{},'color_edges':[],'repulsion':{}},'detail':{'synthetic_contract_seed':True}}
    m=instance([exposed]);prior=state(m);args=next(c for c in cases if c['id']=='record:observed_control_and_residual')['arguments']
    own=[e for e in m.record(args['before'],args['command'],args['after'],args['rows'],args['later'],args['proposal'],0)if e['kind']=='observed_reception_service']
    assert own[0]['memory']['epoch'] is None
    alias_cases.append({'id':'inherited_exposed_prevents_initial_reception_reset','seedEvents':[exposed],
                        'arguments':copy.deepcopy(args),'expected':plain(own),'beforeState':prior,'afterState':state(m),
                        'sharedJournalKinds':[e['kind']for e in m.reception_events],
                        'exposedDigestAfterReception':ExposedReceptionAccess.retained_digest(m),
                        'qualification':'Original shared self.reception_events list, deliberately not the separate native owner contract.'})
    def residual_state(m):
        return {'projection':plain({'roles':m.roles,'controls':dict(m.controls),
                                    'visited':{k:sorted(v)for k,v in m.visited.items()},'failed':sorted(m.failed)}),
                'digest':m.retained_digest()}
    def residual_case(name,pixels,later_pixels,seed=(),proposal=None,command=None,changes=None):
        args={'before':observation(pixels,'residual:'+name+':before'),
              'after':observation(later_pixels,'residual:'+name+':after',revision=1,**(changes or {})),
              'command':command or {'action_ref':'ACTION1'},'rows':pixels,'later':later_pixels,
              'proposal':proposal or {},'index':0}
        m=ResidualAccess()
        for e in copy.deepcopy(seed):m.apply_event(e)
        prior=residual_state(m)
        expected=m.record(args['before'],args['command'],args['after'],pixels,later_pixels,args['proposal'],0)
        residual_cases.append({'id':'residual:'+name,'operation':'record','arguments':args,'seedEvents':plain(list(seed)),
                               'expected':plain(expected),'beforeState':prior,'afterState':residual_state(m)})
        return expected
    def residual_raster(actors=((5,9),)):
        # A separate small complete public image keeps this reducer oracle
        # independent of the Reception scene grammar and of inherited callers.
        pixels=[[0]*20 for _ in range(20)]
        for x,y in actors:
            for dx,dy in ((0,0),(3,0),(0,3),(3,3)):pixels[y+dy][x+dx]=5
        for x,y in ((1,1),(17,1)):pixels[y][x]=8
        return pixels
    r_first=residual_raster();r_moved=residual_raster(((5,5),));r_next=residual_raster(((5,1),))
    r_empty=residual_raster(());r_ambiguous=residual_raster(((5,5),(13,5)))
    first_residual=residual_case('new_role',r_first,r_moved)
    role=next(e for e in first_residual if e['kind']=='residual_role_shape')
    residual_case('known_role_moves',r_moved,r_next,first_residual)
    residual_case('stationary_known_role',r_moved,r_moved,first_residual)
    residual_case('missing_role',r_moved,r_empty,first_residual)
    residual_case('ambiguous_role',r_moved,r_ambiguous,first_residual)
    residual_case('point_payload_ignored',r_first,r_moved,command={'action_ref':'ACTION6','data':{'x':5,'y':9}})
    residual_case('epoch_boundary_without_plan',r_first,r_moved,first_residual,changes={'level_epoch':2,'levels_completed':1})
    residual_case('state_boundary_without_plan',r_first,r_moved,first_residual,changes={'state':'WIN','levels_completed':1})
    route={'residual_plan':{'role_ref':role['role_ref'],'prefix':[{'from':[5,5],'to':[5,1],'premise_ref':'synthetic:residual-premise'}]}}
    residual_case('selected_plan_matched',r_moved,r_next,first_residual,route)
    residual_case('selected_plan_refuted',r_moved,r_moved,first_residual,route)
    residual_case('selected_plan_unknown',r_moved,r_empty,first_residual,route)
    residual_case('selected_plan_boundary',r_moved,r_next,first_residual,route,changes={'level_epoch':2,'levels_completed':1})
    for name,proposal,pixels,index,changes in [
        ('initial',first,rows,0,{}),('wrong_epoch',first,rows,0,{'epoch':2}),('wrong_score',first,rows,0,{'score':1}),
        ('wrong_observation',first,rows,0,{'observation_ref':'stale'}),('unavailable',first,rows,0,{'available':[]}),
        ('changed_frame',first,raster(carrier=(1,3)),0,{}),('missing_scene',first,variants['blank'],0,{}),
        ('access_initial',planned,rows,0,{}),('wait_initial',waiting,goal_rows,0,{}),
        ('wait_continuation',batch,goal_rows,1,{'observation_ref':'later:current'}),
        ('wait_continuation_wrong_actor',batch,raster(carrier=(4,2)),1,{}),
    ]:
        p=proposal['reception_service_plan'];meta={'epoch':p['epoch'],'score':p['score'],'observation_ref':p['observation_ref'],'available':[a['action_ref']for a in INPUTS],**changes}
        guards.append({'id':'before:'+name,'phase':'before','proposal':plain(proposal),'index':index,'rows':pixels,'meta':meta,
                       'expected':plain(instance().before(proposal,index,pixels,**meta))})
    for name,p in [('changed_actions',copy.deepcopy(first)),('changed_bundle',copy.deepcopy(first)),('changed_identity',copy.deepcopy(first)),('changed_plan',copy.deepcopy(first))]:
        if name=='changed_actions':p['actions']=[{'action_ref':'ACTION2'}]
        elif name=='changed_bundle':p['bundle_template']['actions']=[{'action_ref':'ACTION2'}]
        elif name=='changed_identity':p['proposal_id']='reception-service:stale'
        else:p['reception_service_plan']['memory']['wait_spent']=999
        meta={'epoch':1,'score':0,'observation_ref':first['reception_service_plan']['observation_ref'],'available':[a['action_ref']for a in INPUTS]}
        guards.append({'id':'before:'+name,'phase':'before','proposal':p,'index':0,'rows':rows,'meta':meta,
                       'expected':plain(instance().before(p,0,rows,**meta))})
    if len(planned['actions'])>1:
        for name,pixels in [('access_continuation',later),('wrong_access_continuation',rows)]:
            meta={'epoch':1,'score':0,'observation_ref':'later:any','available':[a['action_ref']for a in INPUTS]}
            guards.append({'id':'before:'+name,'phase':'before','proposal':plain(planned),'index':1,'rows':pixels,'meta':meta,
                           'expected':plain(instance().before(planned,1,pixels,**meta))})
    for name,p,pixels,next_pixels,meta in [
        ('unknown_probe',first,rows,raster(carrier=(1,3)),{'epoch':1,'score':0}),
        ('matched',planned,rows,later,{'epoch':1,'score':0}),('refuted',planned,rows,rows,{'epoch':1,'score':0}),
        ('missing_scene',planned,rows,variants['blank'],{'epoch':1,'score':0}),
        ('ambiguous_carrier',planned,rows,variants['ambiguous_carriers'],{'epoch':1,'score':0}),
        ('epoch_boundary',planned,rows,later,{'epoch':2,'score':1}),('score_boundary',planned,rows,later,{'epoch':1,'score':1}),
        ('wait_match',waiting,goal_rows,goal_rows,{'epoch':1,'score':0}),('wait_move',waiting,goal_rows,raster(carrier=(4,2)),{'epoch':1,'score':0}),
    ]:
        guards.append({'id':'after:'+name,'phase':'after','proposal':plain(p),'index':0,'rows':pixels,'later':next_pixels,'meta':meta,
                       'expected':plain(instance().after(p,0,pixels,next_pixels,**meta))})
    ledger={'parent_goal_ref':'G_official_completion','parent_contribution_ref':'reception_support_experiment',
            'consumer_request_ref':'shape:synthetic','level_scope_ref':'1','restore_epoch':0,'observed_clock':0,
            'maximum_total_wait_primitives':128,'spent_wait_primitives':0,'ledger_claim_ref':'observed_wait:0'}
    for name,change in [('base',{}),('zero_budget',{'maximum_total_wait_primitives':0}),('fully_spent',{'spent_wait_primitives':128}),
                        ('spent_exceeds_budget_source_accepts',{'maximum_total_wait_primitives':4,'spent_wait_primitives':8}),
                        ('budget_129',{'maximum_total_wait_primitives':129}),('budget_600',{'maximum_total_wait_primitives':600}),
                        ('spent_129',{'spent_wait_primitives':129}),('negative_spent',{'spent_wait_primitives':-1}),
                        ('negative_epoch',{'restore_epoch':-1}),('negative_clock',{'observed_clock':-1})]:
        args={**ledger,**change};item={'id':'ledger:'+name,'arguments':args}
        try:item['expected']=plain(ReceptionWaitBudgetD(**args).model_dump())
        except Exception as error:item['expectedError']=error_value(error)
        ledger_cases.append(item)
    public_path='docs/migration/lot3e-evidence/diagnostic/reception-public-admission.json'
    public_raw=(ROOT/public_path).read_bytes();public=json.loads(public_raw)
    output={'schema':'logos-engine.v6.reception-service-source-reference.v1','sourceCommit':COMMIT,
            'sourceFiles':{n:MANIFEST[n]['sha256']for n in [POLICY_PATH,
              'agents/yf_arc3_v6/laya_proto/reception_service_access.py','agents/yf_arc3_v6/laya_proto/reception_service_projection.py',
              'agents/yf_arc3_v6/laya_proto/exposed_reception_access.py','agents/yf_arc3_v6/laya_proto/residual_access.py',
              'agents/yf_arc3_v5/capabilities/reception_wait_contracts_d.py']},
            'config':plain(POLICY),'rasters':{'base':rows,'moved':raster(carrier=(1,3)),'target':goal_rows},'cases':cases,'guards':guards,
            'sourceExceptions':exceptions,'sourceAliasCases':alias_cases,'ledgerCases':ledger_cases,
            'residualCases':residual_cases,
            'publicProjection':public['cases'],'publicCorpus':public['corpus'],
            'publicAdmissionReceipt':{'path':public_path,'sha256':sha(public_raw)},
            'originalFilesVerifiedBefore':before,'originalFilesVerifiedAfter':verify_source(),
            'qualification':'Unmodified original own-layer component contracts. Source inherited shared reception_events alias, stale epoch acquisition, retained stationary witness, <=128 ledger rejection and exhaustion fallback remain explicit counterexamples. Native separate ownership/current-scope/budget adaptations require their own tests and are not original full-caller parity. No new game actions or level jumps; no engine, specification or solution read.'}
    target_path=ROOT/'tests/fixtures/v6-reception-service-reference.json.gz'
    data=json.dumps(output,separators=(',',':'),sort_keys=True).encode()
    target_path.write_bytes(gzip.compress(data,mtime=0))
    print(json.dumps({'path':str(target_path.relative_to(ROOT)),'cases':len(cases),'guards':len(guards),
                      'sourceExceptions':len(exceptions),'sourceAliasCases':len(alias_cases),'ledgerCases':len(ledger_cases),
                      'residualCases':len(residual_cases),
                      'bytes':target_path.stat().st_size,'sha256':sha(target_path.read_bytes()),
                      'originalFilesVerified':before,'publicProjectionCases':len(public['cases'])}))


if __name__=='__main__':run_export()
