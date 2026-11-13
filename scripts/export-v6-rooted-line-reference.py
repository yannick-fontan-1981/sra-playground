#!/usr/bin/env python3
"""Execute pinned original RootedLine components on synthetic public rasters.

The renderer below describes the admitted visual grammar, not any game engine,
route, level, solution or physical law. Own-layer events are explicitly filtered;
ancestor digests are supplied as opaque source boundaries, never claimed as a
native proof of the entire inherited chain.
"""
from __future__ import annotations
import copy
import gzip
import hashlib
import json
from pathlib import Path
import sys

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
COMMIT = '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e'
SOURCE = ROOT / 'reference/v6' / COMMIT / 'source'
MANIFEST = json.loads((SOURCE.parent / 'manifest.json').read_text())['files']
sys.path[:0] = [str(SOURCE), str(SOURCE / 'agents/yf_arc3_v6/laya_proto')]
from rooted_line_access import RootedLineAccess
from panel_service_access import PanelServiceAccess
from rooted_line_projection import scene, physical, configuration, projected
from rooted_line_mechanics import effect, model, plan
from terminal_composition import identity
from src_bridge import plain

POLICY_PATH = 'agents/yf_arc3_v6/morphology_policy/strategy.drm'
POLICY = json.loads((SOURCE / POLICY_PATH).read_text())['declarations'][0]['configuration']['observed_composition_services']


def sha(data): return hashlib.sha256(data).hexdigest()
def verify_source():
    for name, expected in MANIFEST.items():
        assert sha((SOURCE / name).read_bytes()) == expected['sha256'], name
    return len(MANIFEST)


def raster(*, root_y=8, tip=12, pieces=None, order=(2,), root_x=2, split=42,
           colors=None, reference_y=45, field=(8, 4, 55, 39)):
    """A new raster of the measured grammar; no game implementation is used."""
    colors = {} if colors is None else colors
    paint = lambda value: colors.get(value, value)
    rows = [[paint(0)] * 64 for _ in range(64)]
    def rect(box, value, border=False):
        l,t,r,b = box
        for y in range(t,b+1):
            for x in range(l,r+1):
                if not border or y in (t,b) or x in (l,r): rows[y][x] = paint(value)
    rect(field,1)
    rows[split] = [paint(8)] * 64
    rect((root_x,root_y,root_x+5,root_y+5),6,True)
    rect((2,reference_y,7,reference_y+5),6,True)
    for i,color in enumerate(order): rect((12+i*7,reference_y+1,15+i*7,reference_y+4),color,True)
    for y in (root_y+2,root_y+3):
        for x in range(root_x+6,tip+1): rows[y][x] = paint(9)
    if pieces is None: pieces=[(2,(20,10,23,13))]
    for color,box in pieces: rect(box,color)
    return rows


def obs(rows, name='current', **changes):
    return {'level_epoch':1,'levels_completed':0,'observation_ref':'synthetic:rooted-line:'+name,
            'frame_hash':identity(rows)[:16],'available_action_refs':['ACTION1','ACTION2','ACTION3','ACTION4'],
            'state':'NOT_FINISHED', **changes}


def state(memory):
    return {'projection':plain({'line_memory':memory.line_memory,'line_events':memory.line_events}),
            'parentDigest':PanelServiceAccess.retained_digest(memory), 'digest':memory.retained_digest()}


def instance(seed=()):
    value=RootedLineAccess()
    for event in copy.deepcopy(seed):value.apply_event(event)
    return value


def run_export():
    before=verify_source(); cases=[]; guards=[]
    def add(name,op,args,expected):
        cases.append({'id':name,'operation':op,'arguments':plain(args),'expected':plain(expected)})
        return expected
    def mem(name,op,args,call,seed=()):
        m=instance(seed); initial=state(m); expected=call(m)
        cases.append({'id':name,'operation':op,'arguments':plain(args),'seedEvents':plain(list(seed)),
                      'expected':plain(expected),'beforeState':initial,'afterState':state(m)})
        return expected
    rows=raster(); s=scene(rows); assert s is not None
    add('scene:single_piece','scene',{'rows':rows},s)
    add('physical:single_piece','physical',{'scene':s},physical(s))
    c=configuration(s,'synthetic:configuration',1)
    add('configuration:single_piece','configuration',{'scene':s,'ref':'synthetic:configuration','epoch':1},c.model_dump())
    add('projected:configuration','projected',{'configuration':plain(c.model_dump())},projected(c))
    variants = {
        'two_pieces': raster(pieces=[(2,(20,10,23,13)),(3,(30,20,33,23))], order=(3,2)),
        'palette_permuted': raster(colors={0:11,1:0,2:7,6:4,8:5,9:12}),
        'root_translated': raster(root_y=12),
        'extent_extended': raster(tip=16),
        'extent_retracted': raster(tip=10),
        'no_piece': raster(pieces=[]),
        'duplicate_piece': raster(pieces=[(2,(20,10,23,13)),(2,(30,20,33,23))]),
        'duplicate_reference_type': raster(order=(2,2)),
        'blank': [[0]*64 for _ in range(64)],
    }
    twice=copy.deepcopy(rows);twice[35]=[8]*64;variants['two_dividers']=twice
    broken=copy.deepcopy(rows);broken[46][12]=0;variants['broken_reference_frame']=broken
    no_line=copy.deepcopy(rows)
    for y in (10,11,47,48):no_line[y][7]=1
    variants['no_admitted_axial_band']=no_line
    for name,pixels in variants.items():add('scene:'+name,'scene',{'rows':pixels},scene(pixels))
    controls={}
    for action,pixels in [('ACTION1',raster(root_y=10)),('ACTION4',raster(tip=17)),('ACTION3',raster(tip=10)),('ACTION2',raster(root_y=6))]:
        other=scene(pixels);assert other is not None
        refs=['synthetic:before','synthetic:after:'+action]
        result=effect(action,s,other,refs);assert result is not None
        controls[action]=plain(result.model_dump())
        add('effect:'+action,'effect',{'action':action,'before':s,'after':other,'refs':refs},result.model_dump())
    for name,other in [('unchanged',s),('layout_changed',{**s,'layout':'other'}),('horizontal_root',{**s,'root':[3,8,8,13]}),('combined_vertical_extent',{**s,'root':[2,9,7,14],'tip':14})]:
        result=effect('ACTION1',s,other,['a','b'])
        add('effect:reject_'+name,'effect',{'action':'ACTION1','before':s,'after':other,'refs':['a','b']},None if result is None else result.model_dump())
    cfg=copy.deepcopy(POLICY['rooted_line_question']);cfg.update(max_nodes=60,max_depth=8)
    add('model:declared','model',{'config':cfg},model(cfg).model_dump())
    def seed_memory(**changes):
        m=plain(instance().line_memory);m.update(changes)
        return [{'kind':'observed_rooted_line','memory':m,'detail':{'synthetic_contract_seed':True}}]
    def propose(name,pixels=rows,seed=(),limit=16,available=None,config=None,epoch=1):
        ob=obs(pixels,name,level_epoch=epoch)
        if available is not None:ob['available_action_refs']=available
        conf=copy.deepcopy(POLICY);conf['rooted_line_question']=copy.deepcopy(cfg)
        if config is not None:conf.update(config)
        args={'observation':ob,'rows':pixels,'inputs':[],'limit':limit,'config':conf}
        return mem('propose:'+name,'propose',args,lambda m:m.propose_graph(ob,pixels,[],limit,conf),seed)
    first=propose('initial_calibration')
    propose('available_control_order',available=['ACTION3','ACTION4'])
    propose('deadline',config={'level_deadline':-1})
    propose('all_tried_unresolved',seed=seed_memory(tried=['ACTION1','ACTION4','ACTION3','ACTION2'],epoch=1))
    propose('same_epoch_refutation',seed=seed_memory(refuted=[{'epoch':1}],epoch=1))
    propose('old_epoch_refutation_and_tried_reset',seed=seed_memory(refuted=[{'epoch':1}],tried=['ACTION1'],current=plain(c.model_dump()),epoch=1),epoch=2)
    known=seed_memory(controls=controls,epoch=1,evidence=['learned:one','learned:two'])
    solved_pixels=raster(tip=12,pieces=[(2,(19,10,22,13))]);solved_scene=scene(solved_pixels);assert solved_scene is not None
    planned=propose('conditional_composition',solved_pixels,known)
    assert planned.get('rooted_line_plan') is not None, planned
    limited=propose('conditional_prefix_limit',solved_pixels,known,limit=1)
    propose('max_depth_zero',solved_pixels,known,config={'rooted_line_question':{**cfg,'max_depth':0}})
    propose('max_nodes_one',solved_pixels,known,config={'rooted_line_question':{**cfg,'max_nodes':1}})
    propose('remaining_actions_zero',solved_pixels,known,config={'remaining_level_actions':0})
    propose('learned_effect_available_guard_separate',solved_pixels,known,available=['ACTION2'])
    _,result=plan(solved_scene,obs(solved_pixels,'plan'),controls,cfg)
    add('mechanics:plan','plan',{'scene':solved_scene,'observation':obs(solved_pixels,'plan'),'effects':controls,'config':cfg,'retained':None},{'configuration':configuration(solved_scene,'synthetic:rooted-line:plan',1).model_dump(),'result':result.model_dump()})
    retained=plain(configuration(solved_scene,'old:frame',1).model_dump());retained['configuration_ref']='retained:identity';retained['provenance']=['old:proof'];retained['pieces'][0]['support_refs']=['current_rod']
    for name,old in [('retained_physical_match',retained),('retained_physical_mismatch',{**retained,'root_footprints':[['current_root',[[2,2]]]]})]:
        conf,result=plan(solved_scene,obs(solved_pixels,name),controls,cfg,old)
        add('mechanics:'+name,'plan',{'scene':solved_scene,'observation':obs(solved_pixels,name),'effects':controls,'config':cfg,'retained':old},{'configuration':conf.model_dump(),'result':result.model_dump()})
    def record(name,proposal,pixels,later,seed=(),index=0,**changes):
        before_obs=obs(pixels,name+':before');after_obs=obs(later,name+':after',**changes);command=proposal['actions'][index]
        args={'before':before_obs,'command':command,'after':after_obs,'rows':pixels,'later':later,'proposal':proposal,'index':index}
        return mem('record:'+name,'record',args,lambda m:[e for e in m.record(before_obs,command,after_obs,pixels,later,proposal,index) if e.get('kind')=='observed_rooted_line'],seed)
    acquired=record('calibrated_translation',first,rows,raster(root_y=10))
    assert len(acquired)==1
    propose('after_calibrated_translation',raster(root_y=10),acquired)
    unchanged=record('calibration_without_effect',first,rows,rows)
    propose('after_failed_calibration',rows,unchanged)
    record('calibration_missing_scene',first,rows,variants['blank'])
    record('epoch_boundary',first,rows,variants['blank'],level_epoch=2,levels_completed=1)
    record('score_only_boundary_is_not_epoch_boundary',first,rows,raster(root_y=10),levels_completed=1)
    expected=planned['rooted_line_plan']['predictions'][0]
    later=raster(root_y=expected['root'][1],tip=expected['tip'],pieces=[(int(ref.split(':')[1]),box) for ref,box in expected['pieces']])
    assert scene(later) is not None and plain(physical(scene(later)))==plain(expected), {'expected':expected,'actual':None if scene(later) is None else physical(scene(later))}
    accepted=record('conditional_projection_match',planned,solved_pixels,later,known)
    contradicted=record('conditional_projection_refuted',planned,solved_pixels,solved_pixels,known)
    propose('after_conditional_refutation',solved_pixels,contradicted)
    record('conditional_missing_scene',planned,solved_pixels,variants['blank'],known)
    record('conditional_epoch_boundary',planned,solved_pixels,rows,known,level_epoch=2,levels_completed=1)
    mem('restoration:real_contract_events','apply_events',{'events':acquired+accepted},lambda m:[m.apply_event(copy.deepcopy(e)) for e in acquired+accepted])
    for name,proposal,pixels,index,changes in [
        ('initial_bound',first,rows,0,{}),('wrong_epoch',first,rows,0,{'epoch':2}),
        ('wrong_score',first,rows,0,{'score':1}),('wrong_observation',first,rows,0,{'observation_ref':'stale'}),
        ('unavailable_action',first,rows,0,{'available':[]}),('missing_scene',first,variants['blank'],0,{}),
        ('changed_raster',first,raster(root_y=10),0,{}),('conditional_initial',planned,solved_pixels,0,{}),
    ]:
        meta={'epoch':proposal['rooted_line_plan']['epoch'],'score':proposal['rooted_line_plan']['score'],'observation_ref':proposal['rooted_line_plan']['observation_ref'],'available':['ACTION1','ACTION2','ACTION3','ACTION4'],**changes}
        guards.append({'id':'before:'+name,'phase':'before','proposal':plain(proposal),'index':index,'rows':pixels,'meta':meta,'expected':plain(instance().before(proposal,index,pixels,**meta))})
    for name,proposal in [('action_mutated',copy.deepcopy(first)),('bundle_mutated',copy.deepcopy(first)),('identity_mutated',copy.deepcopy(first))]:
        if name=='action_mutated':proposal['actions']=[{'action_ref':'ACTION4'}]
        elif name=='bundle_mutated':proposal['bundle_template']['actions']=[{'action_ref':'ACTION4'}]
        else:proposal['proposal_id']='rooted-line:stale'
        meta={'epoch':1,'score':0,'observation_ref':first['rooted_line_plan']['observation_ref'],'available':['ACTION1','ACTION2','ACTION3','ACTION4']}
        guards.append({'id':'before:'+name,'phase':'before','proposal':proposal,'index':0,'rows':rows,'meta':meta,'expected':plain(instance().before(proposal,0,rows,**meta))})
    for name,proposal,pixels,later_pixels,meta in [
        ('calibration_unknown',first,rows,raster(root_y=10),{'epoch':1,'score':0}),
        ('conditional_match',planned,solved_pixels,later,{'epoch':1,'score':0}),
        ('conditional_refuted',planned,solved_pixels,solved_pixels,{'epoch':1,'score':0}),
        ('missing_scene',planned,solved_pixels,variants['blank'],{'epoch':1,'score':0}),
        ('epoch_boundary',planned,solved_pixels,rows,{'epoch':2,'score':1}),
        ('score_boundary',planned,solved_pixels,later,{'epoch':1,'score':1}),
    ]:
        guards.append({'id':'after:'+name,'phase':'after','proposal':plain(proposal),'index':0,'rows':pixels,'later':later_pixels,'meta':meta,'expected':plain(instance().after(proposal,0,pixels,later_pixels,**meta))})
    if len(planned['actions'])>1:
        for name,pixels in [('matching_previous_projection',later),('wrong_previous_projection',solved_pixels)]:
            meta={'epoch':1,'score':0,'observation_ref':'not_rechecked_on_continuation','available':['ACTION1','ACTION2','ACTION3','ACTION4']}
            guards.append({'id':'before:'+name,'phase':'before','proposal':plain(planned),'index':1,'rows':pixels,'meta':meta,'expected':plain(instance().before(planned,1,pixels,**meta))})
    corpus_path='tests/fixtures/v6-linked-packet-initial-public.json.gz';raw=(ROOT/corpus_path).read_bytes();corpus=json.loads(gzip.decompress(raw))
    assert corpus['actions']==corpus['levelJumps']==0
    public=[]
    for value in corpus['games']:
        if value['game']=='CWSE':continue
        pixels=value['packet']['frame_rows'];public.append({'game':value['game'],'rowsSha256':sha(json.dumps(pixels,separators=(',',':')).encode()),'expected':plain(scene(pixels))})
    assert len(public)==99
    output={'schema':'logos-engine.v6.rooted-line-source-reference.v1','sourceCommit':COMMIT,
            'sourceFiles':{n:MANIFEST[n]['sha256'] for n in [POLICY_PATH,
               'agents/yf_arc3_v6/laya_proto/rooted_line_access.py',
               'agents/yf_arc3_v6/laya_proto/rooted_line_projection.py',
               'agents/yf_arc3_v6/laya_proto/rooted_line_mechanics.py']},
            'config':plain(POLICY),'rasters':{'base':rows,'composition':solved_pixels},'cases':cases,'guards':guards,'publicCorpus':{'path':corpus_path,'sha256':sha(raw),'actions':0,'levelJumps':0,'excludedGames':['CWSE']},'publicProjection':public,
            'originalFilesVerifiedBefore':before,'originalFilesVerifiedAfter':verify_source(),
            'qualification':'Synthetic public-raster component contracts from unchanged original source. No game, game code, authored level or route is read or executed. Own-layer closure only; no full original caller equivalence or solved-game assertion.'}
    target=ROOT/'tests/fixtures/v6-rooted-line-reference.json.gz'
    data=json.dumps(output,separators=(',',':'),sort_keys=True).encode()
    target.write_bytes(gzip.compress(data,mtime=0))
    print(json.dumps({'path':str(target.relative_to(ROOT)),'cases':len(cases),'guards':len(guards),'bytes':target.stat().st_size,'sha256':sha(target.read_bytes()),'originalFilesVerified':before,'publicProjectionCases':len(public),'admittedPublicGames':[p['game'] for p in public if p['expected'] is not None]}))


if __name__=='__main__':run_export()
