#!/usr/bin/env python3
"""Independent contracts from the unchanged public CrossedPrefix Python source.

Synthetic rasters exercise source contracts, not a game engine or a solution.
The optional initial-public scan is separately predeclared before source calls.
"""
from __future__ import annotations
import copy
from datetime import datetime, timedelta, timezone
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
from common_crossed_prefix import (CrossedPrefixAccess, CrossedPrefixConstraint,
    geometry, measure_controls, reference_present, cell, slot, input_candidates)
from common_supported_lines import SupportedLineAccess
from neutral_observer import measure as observe
from terminal_composition import identity
from src_bridge import plain

EVIDENCE = ROOT / 'docs/migration/lot3h-evidence/diagnostic'
AVAILABLE = ['ACTION' + str(i) for i in range(1, 7)]
INPUTS = [{'action_ref': action} for action in AVAILABLE if action != 'ACTION6']
OWN = {'crossed_prefix_state', 'crossed_prefix_pair', 'crossed_prefix_input'}
LOCAL = timezone(timedelta(hours=-3))


def sha(data): return hashlib.sha256(data).hexdigest()


def verify_source():
    for name, item in MANIFEST.items():
        assert sha((SOURCE / name).read_bytes()) == item['sha256'], name
    return len(MANIFEST)


def err(error): return {'type': type(error).__name__, 'message': str(error)}


def record(path):
    data = path.read_bytes()
    return {'path': path.relative_to(ROOT).as_posix(), 'bytes': len(data), 'sha256': sha(data)}


def raster(*, target=((2,3,2),(3,2,3),(2,3,2)), origin=(15,12), size=(3,3),
           pitch=(5,5), canvas=(44,40), scale=(1,1), sides=(-1,-1),
           row_color=2, column_color=3, alternatives=True, permutation=None):
    rows = [[0] * canvas[0] for _ in range(canvas[1])]
    nx, ny = len(target[0]), len(target)
    x0,y0=origin; cw,ch=size; dx,dy=pitch
    for j,line in enumerate(target):
        for i,value in enumerate(line):
            for y in range(2+j*scale[1], 2+(j+1)*scale[1]):
                for x in range(2+i*scale[0], 2+(i+1)*scale[0]): rows[y][x]=value
            for y in range(y0+j*dy, y0+j*dy+ch):
                for x in range(x0+i*dx, x0+i*dx+cw): rows[y][x]=1
    right=x0+(nx-1)*dx+cw; bottom=y0+(ny-1)*dy+ch
    for axis,count,color in [(0,ny,row_color),(1,nx,column_color)]:
        side=sides[axis]
        for lane in range(count):
            fixed=y0+lane*dy+(ch-1)//2 if axis==0 else x0+lane*dx+(cw-1)//2
            start=(x0-5 if side<0 else right+3) if axis==0 else (y0-4 if side<0 else bottom+3)
            for offset,value in [(0,color)]+([(4*side,3 if color==2 else 2)] if alternatives else []):
                for p in range(start+offset,start+offset+2):
                    if axis==0: rows[fixed][p]=value
                    else: rows[p][fixed]=value
    if permutation: rows=[[permutation.get(v,v) for v in row] for row in rows]
    return rows


def observation(rows, name, **changes):
    packet=SimpleNamespace(frame_rows=rows,
        frame_hash=sha(json.dumps(rows,separators=(',',':')).encode())[:16],
        level=changes.pop('level_epoch',1), levels_completed=changes.pop('levels_completed',0),
        state=changes.pop('state','NOT_FINISHED'),
        available_action_refs=changes.pop('available_action_refs',AVAILABLE))
    value,_=observe(packet,changes.pop('revision',0),'synthetic:crossed-prefix:'+name)
    value.update(changes)
    return plain(value)


def state(memory):
    return plain({'projection': {'cross_state': memory.cross_state,
        'cross_pairs': memory.cross_pairs,
        'cross_axis_inputs': {str(k):sorted(v) for k,v in memory.cross_axis_inputs.items()},
        'cross_events': memory.cross_events},
        'parentDigest': SupportedLineAccess.retained_digest(memory),
        'digest': memory.retained_digest()})


def instance(events=()):
    value=CrossedPrefixAccess()
    for event in copy.deepcopy(events): value.apply_event(event)
    return value


def change_slot(rows, layout, position, value, *, corner=None):
    later=copy.deepcopy(rows); i,j=position
    x=layout['origin'][0]+i*layout['pitch'][0]; y=layout['origin'][1]+j*layout['pitch'][1]
    for v in range(y,y+layout['size'][1]):
        for u in range(x,x+layout['size'][0]): later[v][u]=value
    if corner is not None: later[y][x]=corner
    return later


def run_export():
    verified_before=verify_source()
    geometry_cases=[]; control_cases=[]; helper_cases=[]; access_cases=[]
    guard_cases=[]; record_cases=[]; event_cases=[]; restore_cases=[]; chains=[]
    rows=raster(); obs=observation(rows,'initial'); layout=geometry(rows)
    assert layout and len(layout['controllers'])==6

    def pure(collection, name, data, call):
        item={'id':name, **plain(data)}
        try: item['expected']=plain(call())
        except Exception as error: item['error']=err(error)
        collection.append(item)
        return item.get('expected')

    variants={'canonical': rows,
        'translated':raster(origin=(20,16),canvas=(54,44)),
        'palette_permuted':raster(permutation={0:12,1:9,2:7,3:4}),
        'positive_sides':raster(sides=(1,1)),
        'mixed_sides':raster(sides=(1,-1)),
        'rectangular_slots':raster(size=(4,2),pitch=(6,4),scale=(2,1)),
        'two_by_three':raster(target=((2,3),(3,2),(2,3))),
        'no_alternatives':raster(alternatives=False),
        'all_controls_same_with_alternatives':raster(column_color=2),
        'blank':[[0]*20 for _ in range(20)],
        'empty':[], 'empty_row':[[]], 'ragged':[[0,0],[0]]}
    for name in ['duplicate_reference','different_reference','missing_row_control',
                 'both_row_sides_complete','partial_opposite_family','uniform_reference',
                 'filled_slot','unrelated_pixel','missing_slot','reference_connected_to_noise']:
        variants[name]=copy.deepcopy(rows)
    for j,line in enumerate(layout['reference']['values']):
        for i,value in enumerate(line):
            variants['duplicate_reference'][32+j][2+i]=value
            variants['different_reference'][32+j][2+i]=3 if value==2 else 2
            variants['uniform_reference'][2+j][2+i]=2
    for x in range(2,15): variants['missing_row_control'][13][x]=0
    for lane in range(3):
        for x in [31,32]: variants['both_row_sides_complete'][13+5*lane][x]=2
    for x in [31,32]: variants['partial_opposite_family'][13][x]=2
    variants['filled_slot']=change_slot(rows,layout,(0,0),2)
    variants['unrelated_pixel'][39][43]=8
    variants['missing_slot']=change_slot(rows,layout,(1,1),0)
    variants['reference_connected_to_noise'][2][5]=2
    # A 4x3 field keeps every lattice coordinate represented at exactly half density.
    half=raster(target=((2,3,2,3),(3,2,3,2),(2,3,2,3)),canvas=(52,40))
    half_layout=geometry(half); assert half_layout
    retained={(0,0),(2,0),(1,1),(3,1),(0,2),(3,2)}
    for j in range(3):
        for i in range(4):
            if (i,j) not in retained: half=change_slot(half,half_layout,(i,j),0)
    variants['exactly_half_density']=half
    variants['less_than_half_density']=change_slot(half,half_layout,(0,0),0)
    for name,pixels in variants.items():
        pure(geometry_cases,name,{'rows':pixels},lambda pixels=pixels:geometry(pixels))
    # Additional equally spaced supports extend the currently measured field.
    tied=copy.deepcopy(rows)
    for j in range(3):
        for y in range(12+j*5,15+j*5):
            for x in range(30,33): tied[y][x]=1
    pure(geometry_cases,'extra_equal_pitch_column',{'rows':tied},lambda:geometry(tied))
    # Actual modal-gap ties preserve Counter insertion order: 5 then 10 admits;
    # 10 then 5 chooses 10, whose alignment check rejects the 15-pixel span.
    wide=raster(target=((2,3,2,3),(3,2,3,2),(2,3,2,3)),canvas=(52,40))
    wide_layout=geometry(wide); assert wide_layout
    for name,missing in [('gap_tie_first_five_admitted',2),('gap_tie_first_ten_refused',1)]:
        pixels=copy.deepcopy(wide)
        for j in range(3):pixels=change_slot(pixels,wide_layout,(missing,j),0)
        expected=pure(geometry_cases,name,{'rows':pixels},lambda pixels=pixels:geometry(pixels))
        assert bool(expected)==(missing==2)

    for name in ['canonical','positive_sides','mixed_sides','missing_row_control',
                 'both_row_sides_complete','partial_opposite_family','all_controls_same_with_alternatives']:
        pixels=variants[name]; own_layout=geometry(pixels) or layout
        pure(control_cases,name,{'rows':pixels,'layout':own_layout},lambda p=pixels,l=own_layout:measure_controls(p,l))
    for name in ['canonical','unrelated_pixel','filled_slot','uniform_reference']:
        pixels=variants[name]
        pure(helper_cases,'reference:'+name,{'method':'reference_present','arguments':{'rows':pixels,'layout':layout}},lambda p=pixels:reference_present(p,layout))
    truncated=copy.deepcopy(rows[:3])
    pure(helper_cases,'reference:truncated',{'method':'reference_present','arguments':{'rows':truncated,'layout':layout}},lambda:reference_present(truncated,layout))
    for name in ['canonical','positive_sides']:
        own_layout=geometry(variants[name])
        for c in [own_layout['controllers'][0],own_layout['controllers'][-1]]:
            for k in [0,1,c['length']-1,-1,c['length']]:
                pure(helper_cases,'cell:'+name+':'+c['key']+':'+str(k),{'method':'cell','arguments':{'controller':c,'index':k,'layout':own_layout}},lambda c=c,k=k,l=own_layout:cell(c,k,l))
    for pos in [(0,0),(2,2),(-1,0),(0,-1),(3,0),(0,3)]:
        pure(helper_cases,'slot:'+str(pos),{'method':'slot','arguments':{'rows':rows,'layout':layout,'position':list(pos)}},lambda pos=pos:slot(rows,layout,pos))
    for name,available,pixels in [('full',AVAILABLE,rows),('unavailable',['ACTION1'],rows),('blank',AVAILABLE,variants['blank']),('positive',AVAILABLE,variants['positive_sides'])]:
        pure(helper_cases,'inputs:'+name,{'method':'input_candidates','arguments':{'rows':pixels,'available':available}},lambda p=pixels,a=available:input_candidates(p,a))

    def access(name, *, pixels=rows, value=obs, events=(), method='cross_question',remaining=1,config=None,limit=1):
        memory=instance(events)
        item={'id':name,'method':method,'rows':pixels,'observation':value,'inputs':INPUTS,
              'initialEvents':plain(events),'beforeState':state(memory)}
        try:
            if method=='cross_propose':
                item['remaining']=remaining; wrapper=CrossedPrefixConstraint();wrapper.memory=memory
                result=wrapper.cross_propose(value,pixels,INPUTS,remaining)
            elif method=='propose':
                item.update(config=config or {},limit=limit)
                result=memory.propose([],value,pixels,INPUTS,limit,config or {})
            else: result=memory.cross_question(value,pixels,INPUTS)
            item['expected']=plain(result)
        except Exception as error: item['error']=err(error)
        item['afterState']=state(memory);access_cases.append(item)
        return item.get('expected')

    fresh=access('fresh_select')
    common=access('common_fresh',method='cross_propose')
    assert fresh['crossed_prefix_plan']['mode']=='select' and common['point_support']
    access('no_point',value={**obs,'available_action_refs':['ACTION1']})
    for name in ['blank','filled_slot','all_controls_same_with_alternatives','positive_sides','duplicate_reference','different_reference']:
        pixels=variants[name];access(name,pixels=pixels,value=observation(pixels,name))
    for remaining in [0,-1,9]: access('common_remaining_'+str(remaining),method='cross_propose',remaining=remaining)
    for limit in [0,-1,1,99]: access('own_limit_'+str(limit),method='propose',limit=limit,config={'coupled_prefix_reference':True})
    access('configuration_disabled',method='propose',config={})
    access('configuration_empty_object_false',method='propose',config={'coupled_prefix_reference':{}})

    def record_case(name, *, p=fresh,pixels=rows,later=rows,before=obs,after=None,command=None,events=(),index=0):
        memory=instance(events); after=after or observation(later,name,revision=1)
        command=copy.deepcopy(p['actions'][0]) if command is None else command
        item={'id':name,'proposal':plain(p),'index':index,'rows':pixels,'later':later,
              'before':before,'after':after,'command':command,'initialEvents':plain(events),'beforeState':state(memory)}
        try:
            output=memory.record(before,command,after,pixels,later,copy.deepcopy(p),index)
            item['expectedOriginal']=plain(output)
            item['expectedOwnEvents']=plain([e for e in output if e['kind'] in OWN])
        except Exception as error:item['error']=err(error)
        item['afterState']=state(memory);item['expectedState']=item['afterState'];record_cases.append(item)
        return item

    selected=record_case('selection_no_visible_change')
    selected_events=selected['expectedOwnEvents']
    selected_obs=selected['after']
    advance=access('selected_advance',value=selected_obs,events=selected_events)
    assert advance['crossed_prefix_plan']['mode']=='advance'
    advance_common=access('common_selected_advance',value=selected_obs,events=selected_events,method='cross_propose')
    no_effect=record_case('advance_no_effect',p=advance,before=selected_obs,events=selected_events)
    blocked_events=selected_events+no_effect['expectedOwnEvents']
    access('blocked_context_tries_next_input',value=no_effect['after'],events=blocked_events)
    access('blocked_context_new_observation_still_blocked',value=observation(rows,'new-observation',revision=12),events=blocked_events)
    changed=change_slot(rows,layout,(0,0),2)
    advanced=record_case('one_cell_advance',p=advance,before=selected_obs,later=changed,events=selected_events)
    advanced_events=selected_events+advanced['expectedOwnEvents']
    next_select=access('opposite_selection_for_pending_crossing',pixels=changed,value=advanced['after'],events=advanced_events)
    opposite_selected=record_case('opposite_selection',p=next_select,pixels=changed,later=changed,before=advanced['after'],events=advanced_events)
    opposite_events=advanced_events+opposite_selected['expectedOwnEvents']
    opposite_advance=access('opposite_advance_avoids_known_axis_input',pixels=changed,value=opposite_selected['after'],events=opposite_events)
    assert opposite_advance['crossed_prefix_plan']['intent']['other_action']
    compatible=change_slot(changed,layout,(0,0),2,corner=3)
    paired=record_case('compatible_crossing_owner_zero',p=opposite_advance,pixels=changed,later=compatible,before=opposite_selected['after'],events=opposite_events)
    paired_events=opposite_events+paired['expectedOwnEvents']
    access('retained_pair_influences_next_selection',pixels=compatible,value=paired['after'],events=paired_events)
    # Source chooses a known current-axis input only after selection; own colour is not a fixed action meaning.
    for name,later in [('wrong_reference_center',change_slot(changed,layout,(0,0),3)),
                       ('owner_unknown_color',change_slot(changed,layout,(0,0),8)),
                       ('no_change',changed),('nonlocal_change',variants['unrelated_pixel'])]:
        record_case('crossing_'+name,p=opposite_advance,pixels=changed,later=later,before=opposite_selected['after'],events=opposite_events)
    nonlocal_rows=copy.deepcopy(rows);nonlocal_rows[39][43]=8
    record_case('advance_unexplained_nonlocal',p=advance,before=selected_obs,later=nonlocal_rows,events=selected_events)
    reference_changed=copy.deepcopy(rows);reference_changed[2][2]=3
    record_case('advance_reference_refuted',p=advance,before=selected_obs,later=reference_changed,events=selected_events)
    record_case('boundary_counts_advance_without_target_change',p=advance,before=selected_obs,later=variants['blank'],after=observation(variants['blank'],'boundary',level_epoch=2,levels_completed=1),events=selected_events)
    record_case('same_epoch_score_decrease_is_boundary',p=advance,before=selected_obs,after=observation(rows,'score-decrease',levels_completed=-1),events=selected_events)
    record_case('terminal_without_boundary_invalidates_advance',p=advance,before=selected_obs,after=observation(rows,'terminal',state='WIN'),events=selected_events)
    record_case('actual_command_is_retained',p=advance,before=selected_obs,later=changed,command={'action_ref':'ACTION5'},events=selected_events)
    recolor_rows=variants['all_controls_same_with_alternatives'];recolor_obs=observation(recolor_rows,'recolor')
    recolor=access('recolor_explicit',pixels=recolor_rows,value=recolor_obs)
    assert recolor['crossed_prefix_plan']['mode']=='recolor'
    recolor_bad=record_case('recolor_refuted',p=recolor,pixels=recolor_rows,later=recolor_rows,before=recolor_obs)
    recolor_good=copy.deepcopy(recolor_rows);c=recolor['crossed_prefix_plan']['controller'];px,py=c['point']
    desired=recolor['crossed_prefix_plan']['intent']['desired_color']
    if c['axis']==0:
        for x in [px,px+1]:recolor_good[py][x]=desired
    else:
        for y in [py,py+1]:recolor_good[y][px]=desired
    record_case('recolor_observed',p=recolor,pixels=recolor_rows,later=recolor_good,before=recolor_obs)
    access('invalid_state_stays_refused',pixels=recolor_rows,value=recolor_bad['after'],events=recolor_bad['expectedOwnEvents'])
    access('new_epoch_remeasures_state_but_retains_global_pairs',value=observation(rows,'new-epoch',level_epoch=2),events=paired_events)
    access('unchanged_reference_but_field_changed_uses_retained_layout',pixels=changed,value=observation(changed,'retained-layout'),events=selected_events)

    def seeded(name, mutate, *, source=fresh,events=(),pixels=rows,value=obs):
        s=copy.deepcopy(source['crossed_prefix_plan']['state_before']);mutate(s)
        e={'kind':'crossed_prefix_state','state':s,'evidence':'synthetic:explicit-component-seed','outcome':{'matched':None,'seal_prefix':True,'reason':'fixture_input'}}
        return access(name,pixels=pixels,value=value,events=list(events)+[e])
    seeded('selected_missing_controller_key',lambda s:s.__setitem__('selected','missing'))
    seeded('invalid_state',lambda s:s.__setitem__('invalid',True))
    seeded('missing_progress_key_source_exception',lambda s:s['progress'].pop('0:0:-1'))
    seeded('all_current_inputs_blocked',lambda s:(s.__setitem__('selected','0:0:-1'),s.__setitem__('blocked',[{'context':['0:0:-1',0,None],'action':a,'evidence':'blocked'} for a in AVAILABLE if a!='ACTION6'])))
    seeded('unrelated_block_does_not_block_here',lambda s:(s.__setitem__('selected','0:0:-1'),s.__setitem__('blocked',[{'context':['0:1:-1',0,None],'action':'ACTION1','evidence':'blocked'}])))
    pair={'kind':'crossed_prefix_pair','inputs':{'0':'ACTION4','1':'ACTION5'},'owner':0,'visible_palette':2,'evidence':['old-before','old-after'],'epoch':0,'scope':'source-compatible explicit component input'}
    seeded('prior_epoch_known_pair_preferred',lambda s:s.__setitem__('selected','0:0:-1'),events=[pair])
    pair_other={**pair,'owner':1}
    seeded('contrary_pair_input_deprioritized',lambda s:s.__setitem__('selected','0:0:-1'),events=[pair_other])
    seeded('all_prefixes_complete',lambda s:s.__setitem__('progress',{c['key']:c['length'] for c in s['layout']['controllers']}),events=[pair])
    ambiguous_pair={**pair,'owner':None}
    access('ambiguous_pair_not_used_as_known',events=[ambiguous_pair])

    def guard(name,method,p=common,*,pixels=rows,later=rows,meta=None,index=0,mutate=None,bindings=None):
        p=copy.deepcopy(p)
        if mutate:mutate(p)
        data={'method':method,'proposal':p,'rows':pixels,'index':index}
        if method=='before':
            data['meta']={'epoch':p['crossed_prefix_plan']['epoch'],'score':p['crossed_prefix_plan']['score'],'observation_ref':p['crossed_prefix_plan']['observation_ref'],'available':AVAILABLE,**(meta or {})}
            call=lambda:instance().before(p,index,pixels,**data['meta'])
        elif method=='after':
            data.update(later=later,meta={'epoch':p['crossed_prefix_plan']['epoch'],'score':p['crossed_prefix_plan']['score'],'state':'NOT_FINISHED',**(meta or {})})
            call=lambda:instance().after(p,index,pixels,later,**data['meta'])
        else:
            data['bindings']=bindings if bindings is not None else [[obs['level_epoch'],obs['frame_hash']]]
            def call():
                out=copy.deepcopy(p);CrossedPrefixConstraint().bind(out,SimpleNamespace(bindings={tuple(v) for v in data['bindings']}));return out
        return pure(guard_cases,name,data,call)
    guard('before:fresh','before')
    for name,meta in [('epoch',{'epoch':2}),('score',{'score':1}),('observation',{'observation_ref':'foreign'}),('unavailable',{'available':['ACTION1']})]:guard('before:'+name,'before',meta=meta)
    guard('before:index_one','before',index=1)
    guard('before:full_frame_changed','before',pixels=nonlocal_rows)
    guard('before:proposal_id_not_authenticated','before',mutate=lambda p:p.__setitem__('proposal_id','foreign'))
    guard('before:outer_action_not_authenticated','before',mutate=lambda p:p.__setitem__('actions',[{'action_ref':'ACTION1'}]))
    guard('before:bundle_not_authenticated','before',mutate=lambda p:p['bundle_template'].__setitem__('actions',[{'action_ref':'ACTION1'}]))
    guard('before:step_not_authenticated','before',mutate=lambda p:p['steps'][0].__setitem__('action',{'action_ref':'ACTION1'}))
    guard('before:plan_action_payload_not_authenticated','before',mutate=lambda p:p['crossed_prefix_plan']['action']['data'].__setitem__('x',0))
    guard('after:selection_unknown','after')
    for name,meta in [('epoch',{'epoch':2}),('score_increase',{'score':1}),('score_decrease',{'score':-1}),('win',{'state':'WIN'}),('game_over',{'state':'GAME_OVER'})]:guard('after:'+name,'after',p=advance,meta=meta)
    for name,later in [('unchanged',rows),('target_changed',changed),('nonlocal',nonlocal_rows),('reference_changed',reference_changed)]:guard('after:advance_'+name,'after',p=advance,later=later)
    guard('after:wrong_center_reference','after',p=opposite_advance,pixels=changed,later=change_slot(changed,layout,(0,0),3))
    guard('after:compatible_center','after',p=opposite_advance,pixels=changed,later=compatible)
    guard('after:recolor_observed','after',p=recolor,pixels=recolor_rows,later=recolor_good)
    guard('after:recolor_refuted','after',p=recolor,pixels=recolor_rows,later=recolor_rows)
    guard('bind:point','bind')
    guard('bind:domain_missing','bind',bindings=[])
    guard('bind:point_mismatch','bind',mutate=lambda p:p['point_support'].__setitem__('point',[0,0]))
    guard('bind:two_actions_rejected','bind',mutate=lambda p:p['actions'].append(copy.deepcopy(p['actions'][0])))
    guard('bind:palette_not_rechecked','bind',mutate=lambda p:p['point_support'].__setitem__('palette_value',99))
    guard('bind:nonpoint_no_domain_needed','bind',p=advance_common,bindings=[])
    guard('bind:nonpoint_missing_plan','bind',p=advance_common,bindings=[],mutate=lambda p:p.pop('crossed_prefix_plan'))
    guard('bind:nonpoint_actions_length_unchecked','bind',p=advance_common,bindings=[],mutate=lambda p:p['actions'].append({'action_ref':'ACTION5'}))

    for name,events in [('empty',[]),('selection',selected_events),('paired',paired_events),('duplicate_input',[{'kind':'crossed_prefix_input','axis':0,'action':'ACTION1','evidence':'e','epoch':1}]*2),('ambiguous_owner',[ambiguous_pair]),('missing_state',[{'kind':'crossed_prefix_state'}]),('foreign_event',[{'kind':'unknown'}])]:
        memory=instance();item={'id':name,'events':events,'beforeState':state(memory)}
        try:
            for event in copy.deepcopy(events):memory.apply_event(event)
            item['expected']=state(memory)
        except Exception as error:item['error']=err(error)
        item['afterState']=state(memory);event_cases.append(item)
    for name,events,corrupt in [('empty',[],False),('selection',selected_events,False),('blocked',blocked_events,False),('paired',paired_events,False),('corrupt_digest',paired_events,True),('invalid_event',[{'kind':'crossed_prefix_state'}],False)]:
        initial=instance(selected_events);wrapper=CrossedPrefixConstraint();wrapper.memory=initial;wrapper.events=copy.deepcopy(selected_events)
        snapshot={'events':copy.deepcopy(events),'digest':instance(events).retained_digest() if name!='invalid_event' else 'invalid'}
        if corrupt:snapshot['digest']='corrupt'
        item={'id':name,'snapshot':snapshot,'beforeState':state(wrapper.memory),'beforeEvents':copy.deepcopy(wrapper.events)}
        try:
            wrapper.restore(copy.deepcopy(snapshot));item['expectedState']=state(wrapper.memory);item['expectedEvents']=plain(wrapper.events)
        except Exception as error:item['error']=err(error)
        item['afterState']=state(wrapper.memory);item['afterEvents']=plain(wrapper.events);restore_cases.append(item)

    for name,recipe in [('compatible_pair',['select','advance','select','compatible']),('no_effect_then_next',['select','noop']),('refuted_crossing',['select','advance','select','incompatible'])]:
        memory=instance();pixels=copy.deepcopy(rows);value=observation(pixels,'chain-'+name);steps=[];events=[]
        initial=state(memory)
        for n,response in enumerate(recipe):
            p=memory.cross_question(value,pixels,INPUTS);assert p
            plan=p['crossed_prefix_plan'];later=copy.deepcopy(pixels)
            if response=='advance':later=change_slot(pixels,plan['state_before']['layout'],plan['intent']['cell'],plan['controller']['color'])
            elif response=='compatible':later=change_slot(pixels,plan['state_before']['layout'],plan['intent']['cell'],2,corner=3)
            elif response=='incompatible':later=change_slot(pixels,plan['state_before']['layout'],plan['intent']['cell'],3)
            after=observation(later,'chain-'+name+'-'+str(n),revision=n+1)
            output=memory.record(value,p['actions'][0],after,pixels,later,p,0);events.extend(output)
            rebuilt=instance(events)
            assert state(rebuilt)==state(memory)
            steps.append({'responseKind':response,'proposal':plain(p),'before':value,'after':after,'command':plain(p['actions'][0]),'rows':pixels,'later':later,'index':0,'expectedOriginal':plain(output),'expectedOwnEvents':plain([e for e in output if e['kind'] in OWN]),'afterState':state(memory),'restoredState':state(rebuilt)})
            pixels=later;value=after
        following=memory.cross_question(value,pixels,INPUTS)
        chains.append({'id':name,'initialState':initial,'initialEvents':[],'steps':steps,'events':plain(events),'following':plain(following),'finalState':state(memory),'scope':'Cold source component with explicitly supplied synthetic returns; no game runtime, learned seed or native output.'})

    paths=['agents/yf_arc3_v6/laya_proto/'+name for name in ['common_crossed_prefix.py','common_supported_lines.py','common_repeated_lines.py','geometric_observer.py','terminal_composition.py','neutral_observer.py']]
    fixture={'schema':'logos-engine.v6-crossed-prefix.original-contracts.v1','sourceCommit':COMMIT,
        'sourceFiles':{name:MANIFEST[name]['sha256'] for name in paths},
        'originalFilesVerifiedBefore':verified_before,'originalFilesVerifiedAfter':verify_source(),
        'geometryCases':geometry_cases,'controlCases':control_cases,'helperCases':helper_cases,
        'accessCases':access_cases,'guardCases':guard_cases,'recordCases':record_cases,
        'eventCases':event_cases,'restoreCases':restore_cases,'chains':chains,
        'qualifications':[
            'Own CrossedPrefix contracts only; inherited SupportedLine and RepeatedLine scopes are opaque parent digests, not FramedWindow ancestors.',
            'Synthetic responses are declared inputs; no game engine, specification, solution or native output is used.',
            'The source exhaustive cartesian assignment has no internal work or time bound.',
            'A selected controller remains hypothetical until advancement. Center-pixel owner is a conditional appearance relation, not a universal crossing law.',
            'Source malformed-domain exceptions and permissive envelope behavior are retained independently of stricter native validation.']}
    target=ROOT/'tests/fixtures/v6-crossed-prefix-reference.json.gz'
    data=json.dumps(fixture,separators=(',',':'),ensure_ascii=False).encode()
    target.write_bytes(gzip.compress(data,mtime=0))
    EVIDENCE.mkdir(parents=True,exist_ok=True)
    counts={key:len(fixture[key]) for key in ['geometryCases','controlCases','helperCases','accessCases','guardCases','recordCases','eventCases','restoreCases','chains']}
    receipt={'schema':'logos-engine.lot3h.source-oracle-export.v1','recordedAt':datetime.now(LOCAL).isoformat(),
        'status':'passed','sourceCommit':COMMIT,'sourceFiles':fixture['sourceFiles'],
        'generator':record(Path(__file__)),'fixture':record(target),'counts':counts,
        'sourceErrors':sum('error' in item for key in counts for item in fixture[key]),
        'originalFilesVerifiedBefore':verified_before,'originalFilesVerifiedAfter':fixture['originalFilesVerifiedAfter'],
        'gameExecutions':0,'gameEngineOrSpecificationReads':0,'nativeModuleExecutions':0,
        'qualification':'Source expectations exported without modification. Counts describe separate case collections, not one summed test suite. Source exceptions remain cases, not exporter failures.'}
    (EVIDENCE/'source-oracle-export.json').write_text(json.dumps(receipt,indent=2)+'\n')
    print(json.dumps({'status':'passed','counts':counts,'fixture':receipt['fixture'],'sourceErrors':receipt['sourceErrors']}))


def scan_public():
    EVIDENCE.mkdir(parents=True,exist_ok=True)
    corpus_path=ROOT/'tests/fixtures/v6-linked-packet-initial-public.json.gz'
    corpus=json.loads(gzip.decompress(corpus_path.read_bytes()))
    excluded=['CWSE','SK48','FOGW','VOIS']
    selected=[item for item in corpus['games'] if item['game'] not in excluded]
    assert len(selected)<=96 and corpus['sourceCommit']==COMMIT and corpus['actions']==corpus['levelJumps']==0
    plan={'schema':'logos-engine.lot3h.initial-public-scan-plan.v1','recordedAt':datetime.now(LOCAL).isoformat(),
        'sourceCommit':COMMIT,'corpus':record(corpus_path),'maximumViews':96,'selectedViews':len(selected),
        'excludedGames':excluded,'selectedGames':[item['game'] for item in selected],
        'sourceOperations':['common_crossed_prefix.geometry'],'commandsRead':False,'gameExecution':False,
        'scope':'Previously retained initial canonical public rasters only, exclusions before source calls. No target selected, no action, no level jump, no case-clock restart.'}
    path=EVIDENCE/'initial-public-scan-plan.json'
    if path.exists():
        old=json.loads(path.read_text());assert old['corpus']==plan['corpus'] and old['selectedGames']==plan['selectedGames']
        plan=old
    else:path.write_text(json.dumps(plan,indent=2)+'\n')
    before=verify_source();cases=[]
    for item in selected:
        packet=item['packet'];rows=packet['frame_rows'];assert packet['step_index']==packet['levels_completed']==0
        digest=sha(json.dumps(rows,separators=(',',':')).encode());assert digest[:16]==packet['frame_hash']
        case={'game':item['game'],'rowsSha256':digest,'availableActionRefs':packet['available_action_refs']}
        try:case['scene']=plain(geometry(rows))
        except Exception as error:case['scene']=None;case['error']=err(error)
        cases.append(case)
    result={'schema':'logos-engine.lot3h.initial-public-admission.v1','recordedAt':datetime.now(LOCAL).isoformat(),
        'sourceCommit':COMMIT,'plan':record(path),'corpus':record(corpus_path),'count':len(cases),'cases':cases,
        'admittedGames':[item['game'] for item in cases if item['scene']],
        'originalFilesVerifiedBefore':before,'originalFilesVerifiedAfter':verify_source(),
        'scope':plan['scope'],'sourceCalls':len(cases),'sourceErrors':sum('error' in item for item in cases)}
    (EVIDENCE/'crossed-prefix-public-admission.json').write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps({'publicCases':result['count'],'admittedGames':result['admittedGames'],'sourceErrors':result['sourceErrors']}))


if __name__=='__main__':
    if sys.argv[1:]==['--scan-public']:scan_public()
    elif not sys.argv[1:]:run_export()
    else:raise SystemExit('Usage: export-v6-crossed-prefix-reference.py [--scan-public]')
