#!/usr/bin/env python3
"""Unchanged-Python oracle for the public-occurrence entry point and its memory.

MEMO packets come from the real public game host. No oracle proposal or state is
an input to the native agent. Controlled cases below are unit evidence only.
This does not claim all other inherited series/program providers are ported.
"""
from __future__ import annotations
from pathlib import Path
from types import SimpleNamespace
import copy,hashlib,json,shutil,sys,tempfile,zipfile

ROOT=Path(__file__).resolve().parents[1]
COMMIT='786dcf51ca57773d8e3a8948ce9ea3655e7baf8e'
SOURCE=ROOT/'reference/v6'/COMMIT/'source'
LAYA=SOURCE/'agents/yf_arc3_v6/laya_proto'
sys.path[:0]=[str(SOURCE),str(LAYA)]
from common_occurrence_recall import OccurrenceRecallConstraint
from occurrence_recall_access import OccurrenceRecallAccess
from occurrence_scene import measure as occurrence_scene,candidates,context_scope
from neutral_observer import measure
from observed_input_domain import ObservedInputDomain
from marked_collection_access import collection_scene
from observed_program_effects import align_program_packet,residual_effect
from terminal_composition import identity
POLICY=json.loads((SOURCE/'agents/yf_arc3_v6/morphology_policy/strategy.drm').read_text())['declarations'][0]['configuration']['window_constraints']['occurrence_recall']
NAMES=['occurrence_scene','common_occurrence_recall','occurrence_recall_access','common_program_composition','program_respondent_access','program_composition_access','marked_collection_access','observed_program_effects','common_crossed_prefix','common_supported_lines','common_repeated_lines','terminal_composition','geometric_observer','neutral_observer','observed_input_domain']

def plain(value):
    if isinstance(value,dict):return {str(k):plain(v)for k,v in value.items()}
    if isinstance(value,(list,tuple)):return [plain(v)for v in value]
    if isinstance(value,(set,frozenset)):return [plain(v)for v in sorted(value)]
    if hasattr(value,'tolist'):return plain(value.tolist())
    if isinstance(value,SimpleNamespace):return plain(vars(value))
    return value

def raw_packet(e,index):
    rows=e['frame'];return SimpleNamespace(frame_rows=rows,frame_packet=e['frames'],level=e['level'],levels_completed=e['levelsCompleted'],state=e['state'],step_index=index,available_action_refs=[f'ACTION{x}'for x in e['availableActionIds']],frame_hash=hashlib.sha256(json.dumps(rows,separators=(',',':')).encode()).hexdigest()[:16])

def observe(rows,index=0,level=1,score=0,status='NOT_FINISHED',frames=None,available=None,session='occurrence-reference'):
    raw=SimpleNamespace(frame_rows=rows,frame_packet=frames or [rows],level=level,levels_completed=score,state=status,step_index=index,available_action_refs=available or ['ACTION6'],frame_hash=hashlib.sha256(json.dumps(rows,separators=(',',':')).encode()).hexdigest()[:16]);o,_=measure(raw,index+1,session)
    return {'rows':plain(rows),'public':plain(raw),'observation':plain(o)}

scenes={};cases=[];scenarios=[]
def add_scene(name,view):scenes[name]=view;return name
def case(name,operation,args,value):cases.append({'id':name,'operation':operation,'arguments':plain(args),'expected':plain(value)})

class Driver:
    def __init__(self,name):self.memory=OccurrenceRecallConstraint();self.proposal=None;self.domain=ObservedInputDomain(256);self.steps=[];self.name=name
    def step(self,op):
        kind=op['kind'];result=None
        if kind=='propose':
            v=scenes[op['scene']];self.domain=ObservedInputDomain(256);inputs=self.domain.candidates(v['observation']);self.proposal=self.memory.recall_propose(v['observation'],v['rows'],inputs,op.get('remaining',600),POLICY);result=self.proposal
        elif kind=='bind':self.memory.bind(self.proposal,self.domain);result=self.proposal
        elif kind=='before':
            v=scenes[op['scene']];result=self.memory.before(self.proposal,op.get('index',0),SimpleNamespace(**v['public']),v['observation'])
        elif kind=='after' or kind=='record':
            a=scenes[op['before']];b=scenes[op['after']];index=op.get('index',0)
            if kind=='after':result=self.memory.after(self.proposal,index,a['observation'],b['observation'],a['rows'],b['rows'])
            else:result=self.memory.record(a['observation'],b['observation'],op.get('command',self.proposal['actions'][index]if self.proposal.get('actions') else {'action_ref':'ACTION5'}),a['rows'],b['rows'],self.proposal,index,frames=b['public']['frame_packet'])
        elif kind=='proposal':self.proposal=copy.deepcopy(op['proposal']);result=self.proposal
        elif kind=='restore':self.memory.restore(op['state'])
        elif kind=='apply_event':
            self.memory.memory.apply_event(op['event']);self.memory.events.append(op['event'])
        else:raise ValueError(kind)
        self.steps.append({'operation':plain(op),'expected':{'result':copy.deepcopy(plain(result)),'digest':self.memory.state()['digest'],'eventCount':len(self.memory.events)}})
        return result
    def done(self):scenarios.append({'id':self.name,'steps':self.steps,'finalState':plain(self.memory.state())})

def main():
    hashes={};manifest=json.loads((ROOT/'reference/v6'/COMMIT/'manifest.json').read_text())
    for name in NAMES:
        p=LAYA/(name+'.py');path=str(p.relative_to(SOURCE));h=hashlib.sha256(p.read_bytes()).hexdigest();assert h==manifest['files'][path]['sha256'];hashes[path]=h
    coverage={name:set()for name in ('occurrence_scene','occurrence_recall_access','common_occurrence_recall')}
    paths={str(LAYA/(name+'.py')):name for name in coverage}
    def profile(frame,event,arg):
        if event=='call'and frame.f_code.co_filename in paths:coverage[paths[frame.f_code.co_filename]].add(frame.f_code.co_name)
    sys.setprofile(profile)
    with tempfile.TemporaryDirectory(prefix='v6-occurrence-oracle-')as tmp:
        directory=Path(tmp)
        for name in ('custom-games.zip','official-games.zip'):
            with zipfile.ZipFile(ROOT/'public/python'/name)as z:z.extractall(directory)
        for name in ('game_bridge.py','official_adapter.py','custom_level_navigation.py'):shutil.copy(ROOT/'public/python'/name,directory/name)
        sys.path.insert(0,str(directory));import game_bridge
        def send(kind,**kw):
            value=json.loads(game_bridge.dispatch(json.dumps({'type':kind,**kw})))
            if 'error'in value:raise RuntimeError(value['error'])
            return value
        engine=send('load',code='MEMO',level=1);driver=Driver('real_MEMO_three_levels_and_L4_refusal');actions=[];boundaries=[];cur=observe(engine['frame'],frames=engine['frames']);add_scene('memo:0',cur);i=0
        while i<300 and cur['public']['state']not in('WIN','GAME_OVER','LEVEL_COMPLETE'):
            name='memo:'+str(i);proposal=driver.step({'kind':'propose','scene':name})
            if not proposal:break
            driver.step({'kind':'bind'});guard=driver.step({'kind':'before','scene':name});assert guard['admitted']
            cmd=proposal['actions'][0];engine=send('action',actionId=int(cmd['action_ref'][6:]),data=cmd.get('data'));i+=1
            later=observe(engine['frame'],i,engine['level'],engine['levelsCompleted'],engine['state'],frames=engine['frames']);after=add_scene('memo:'+str(i),later)
            driver.step({'kind':'after','before':name,'after':after});record=driver.step({'kind':'record','before':name,'after':after})
            actions.append({'command':cmd,'beforeScene':name,'afterScene':after,'eventKinds':[e['kind']for e in record['events']]})
            if later['public']['levels_completed']>cur['public']['levels_completed']:boundaries.append({'levelsCompleted':later['public']['levels_completed'],'actions':i,'state':later['public']['state']})
            cur=later
        driver.done();game={'code':'MEMO','actions':actions,'boundaries':boundaries,'levelsCompleted':cur['public']['levels_completed'],'state':cur['public']['state']}
        print(json.dumps({'game':'MEMO','actions':len(actions),'boundaries':boundaries,'state':game['state']}),flush=True)
        for code in ('HANO','SYME','DNOI','SEQN','STCK'):
            engine=send('load',code=code,level=1);view=observe(engine['frame'],frames=engine['frames']);name=add_scene(code.lower()+':initial',view);fresh=Driver('refusal_'+code);fresh.step({'kind':'propose','scene':name});fresh.done()
    interface=json.loads((ROOT/'tests/fixtures/v6-interface-families-reference.json').read_text());add_scene('slot:initial',interface['scenes']['slot:initial']);slot=Driver('original_slot_preemption');p=slot.step({'kind':'propose','scene':'slot:initial'});assert p and p['kind']=='public_occurrence_recall';slot.step({'kind':'bind'});slot.step({'kind':'before','scene':'slot:initial'});slot.done()
    first=scenes['memo:0'];base_rows=first['rows'];base_obs=first['observation'];base=OccurrenceRecallConstraint();base_domain=ObservedInputDomain(256);base_proposal=base.recall_propose(base_obs,base_rows,base_domain.candidates(base_obs),600,POLICY);base.bind(base_proposal,base_domain)
    for field,value in [('level',2),('levels_completed',1),('available_action_refs',[])]:
        view=copy.deepcopy(first);view['public'][field]=value;name=add_scene('guard:'+field,view);case('guard_'+field,'before',{'proposal':base_proposal,'scene':name,'index':0},base.before(base_proposal,0,SimpleNamespace(**view['public']),view['observation']))
    view=copy.deepcopy(first);view['observation']['observation_ref']='changed';name=add_scene('guard:ref',view);case('guard_ref','before',{'proposal':base_proposal,'scene':name,'index':0},base.before(base_proposal,0,SimpleNamespace(**view['public']),view['observation']))
    view=copy.deepcopy(first);view['rows'][0][0]=(view['rows'][0][0]+1)%16;view['public']['frame_rows']=view['rows'];name=add_scene('guard:rows',view);case('guard_rows','before',{'proposal':base_proposal,'scene':name,'index':0},base.before(base_proposal,0,SimpleNamespace(**view['public']),view['observation']))
    changed=copy.deepcopy(base_proposal);changed['actions'][0]['data']['x']+=1;case('guard_payload','before',{'proposal':changed,'scene':'memo:0','index':0},base.before(changed,0,SimpleNamespace(**first['public']),base_obs))
    case('guard_index','before',{'proposal':base_proposal,'scene':'memo:0','index':1},base.before(base_proposal,1,SimpleNamespace(**first['public']),base_obs))
    blocked=Driver('no_effect_blocks_exact_context');blocked.step({'kind':'propose','scene':'memo:0'});blocked.step({'kind':'bind'});blocked.step({'kind':'record','before':'memo:0','after':'memo:0'});blocked.step({'kind':'propose','scene':'memo:0'});blocked.done()
    restored=Driver('restoration_restores_antecedent');restored.step({'kind':'propose','scene':'memo:0'});restored.step({'kind':'record','before':'memo:0','after':'memo:1'});restored.step({'kind':'propose','scene':'memo:1'});restored.step({'kind':'record','before':'memo:1','after':'memo:0'});restored.done()
    # Every inherited event reducer is checked independently; no game win is claimed.
    reducer=Driver('inherited_event_digest_layers')
    events=[{'kind':'repeated_line_trial','trial':'trial','epoch':1},{'kind':'repeated_line_scored','epoch':1},
      {'kind':'supported_insertion_observation','source':'source','epoch':1},{'kind':'supported_insertion_order','source':'source','epoch':1},
      {'kind':'supported_line_refutation','trial':'trial','epoch':1},{'kind':'crossed_prefix_state','state':{'epoch':1}},
      {'kind':'crossed_prefix_pair','owner':0},{'kind':'crossed_prefix_input','axis':0,'action':'ACTION2'},
      {'kind':'marked_collection_result','epoch':1},{'kind':'public_program_phase_alignment','alignment':{'status':'unknown'}},
      {'kind':'program_edit_sample','epoch':1},{'kind':'fitted_program_composition','model':{'epoch':1}},
      {'kind':'program_composition_reconciled','epoch':1,'refuted':True,'continuation':{'epoch':1}},
      {'kind':'respondent_probe_pending','epoch':1},{'kind':'respondent_probe_result','epoch':1},
      {'kind':'observed_respondent_order','epoch':1},{'kind':'respondent_composition_reconciled','epoch':1,'continuation':None,'stop_reason':'source_reason'},
      {'kind':'exact_program_extension_refusal','epoch':1},{'kind':'observed_input_support','epoch':1}]
    for event in events:reducer.step({'kind':'apply_event','event':event})
    reducer.done()
    # An inherited program animation is retained even though no recall proposal selected it.
    rows=[[0]*40 for _ in range(40)]
    def rect(frame,x,y,w,h,color):
        for b in range(y,y+h):
            for a in range(x,x+w):frame[b][a]=color
    for j,color in enumerate((2,3,4)):
        rect(rows,2,3+6*j,2,3,color)
        if j:rows[4+6*j][1]=7
    for j,color in enumerate((2,3,4)):
        x=10+7*j
        for a,b in ((0,0),(0,1),(0,2),(1,2),(2,2)):rows[28+b][x+a]=color
        if j:rows[29][x-1]=7
    rect(rows,22,5,2,2,5)
    scene=collection_scene(rows);assert scene is not None,scene
    packet=[]
    for active,pos in ((0,22),(0,23),(1,23),(1,24),(None,24)):
        frame=copy.deepcopy(rows);rect(frame,22,5,4,2,0);rect(frame,pos,5,2,2,5)
        if active is not None:rect(frame,2,3+6*active,2,3,9)
        packet.append(frame)
    a=add_scene('program:before',observe(rows,80));b=add_scene('program:after',observe(packet[-1],81,frames=packet));d=Driver('inherited_public_animation_observation');d.step({'kind':'proposal','proposal':{}});result=d.step({'kind':'record','before':a,'after':b,'command':{'action_ref':'ACTION5'}});assert any(e['kind']=='public_program_phase_alignment'for e in result['events']);d.done()
    case('collection_scene','collection_scene',{'scene':a},scene)
    case('phase_alignment','align_packet',{'before':a,'after':b,'members':scene['members'],'controls':scene['controls']},align_program_packet(rows,packet,members=scene['members'],controls=scene['controls'],observation_ref=scenes[a]['observation']['observation_ref'],epoch=1,command_ref='ACTION5',after_observation_ref=scenes[b]['observation']['observation_ref']))
    for name in ('memo:0','memo:1','memo:8','slot:initial','syme:initial'):
        v=scenes[name];case('measure_'+name,'measure',{'scene':name},occurrence_scene(v['rows'],v['observation']))
    calibrated=occurrence_scene(base_rows,base_obs)
    for name in ('memo:1','memo:2','memo:8'):
        v=scenes[name];case('calibrated_'+name,'measure',{'scene':name,'calibration':calibrated['calibration']},occurrence_scene(v['rows'],v['observation'],calibrated['calibration']))
    m=OccurrenceRecallAccess();one=occurrence_scene(base_rows,base_obs);two=occurrence_scene(scenes['memo:1']['rows'],scenes['memo:1']['observation'],one['calibration']);context={'previous':one,'chosen':one['occurrences'][0]['id'],'evidence_ref':one['source_ref']}
    for relation in POLICY['reference_families']:
        for comparison in POLICY['comparison_families']:case('candidates_'+relation+'_'+comparison,'candidates',{'scene':two,'context':context,'seen':one['occurrences'],'relation':relation,'comparison':comparison},candidates(two,context,one['occurrences'],relation,comparison))
    case('context_singleton','context_scope',{'context':context},context_scope(context));case('context_plural','context_scope',{'context':{'previous':{'occurrences':[{},{}]}}},context_scope({'previous':{'occurrences':[{},{}]}}))
    sys.setprofile(None)
    result={'provenance':{'commit':COMMIT,'sources':hashes,'scope':'Public-occurrence entry point, real MEMO family trajectory through its L4 refusal and controlled inherited observation/digest cases; not all other ObservedCompositionConstraint questions','pythonAgentRuntime':False,'coverage':{k:sorted(v)for k,v in coverage.items()}},'policy':plain(POLICY),'scenes':scenes,'cases':cases,'scenarios':scenarios,'realGame':game}
    output=ROOT/'tests/fixtures/v6-occurrence-reference.json';output.write_text(json.dumps(plain(result),separators=(',',':'))+'\n');print(json.dumps({'output':str(output),'bytes':output.stat().st_size,'cases':len(cases),'scenarios':len(scenarios),'operations':sum(len(s['steps'])for s in scenarios),'coverage':result['provenance']['coverage']}),flush=True)

if __name__=='__main__':main()
