#!/usr/bin/env python3
"""Original V6 visual-sequence differential fixtures; development only."""
from pathlib import Path
from types import SimpleNamespace
import hashlib,json,shutil,sys,tempfile,zipfile
ROOT=Path(__file__).resolve().parents[1];COMMIT='786dcf51ca57773d8e3a8948ce9ea3655e7baf8e'
REF=ROOT/'reference/v6'/COMMIT/'source';LAYA=REF/'agents/yf_arc3_v6/laya_proto'
sys.path[:0]=[str(LAYA),str(REF)]
from neutral_observer import measure
from observed_input_domain import ObservedInputDomain
from agents.yf_arc3_v6.morphology_policy.visual_sequences.family import VisualSequences
from agents.yf_arc3_v6.morphology_policy.visual_sequences.programs import numeric,cycle,fill_enclosed,mask_predictions

def synthetic_cases():
 def board(ambiguous=False):
  rows=[[0]*64 for _ in range(64)]
  def card(x,y,color=1,filled=True,ink=2,size=2):
   for j in range(8):
    for i in range(8):
     if i in (0,7)or j in (0,7):rows[y+j][x+i]=color
   if filled:
    for j in range(size):
     for i in range(size):rows[y+3+j][x+3+i]=ink
  for row,y in enumerate([3,15,27]):
   for col,x in enumerate([3,14,25,36,47]):card(x,y,9 if row==0 and col==2 else 1,col!=2)
  for i,x in enumerate([8,25,42]):card(x,44,1,True,2 if i!=2 else 4,2 if i==0 or ambiguous else 3)
  return rows
 def packet(rows,revision=0):
  return SimpleNamespace(frame_rows=rows,frame_packet=[rows],level=1,levels_completed=0,state='NOT_FINISHED',step_index=revision,available_action_refs=['ACTION6'],frame_hash=hashlib.sha256(json.dumps(rows,separators=(',',':')).encode()).hexdigest()[:16])
 results=[]
 for label,ambiguous,accept in [('unique-and-acquired',False,True),('ambiguous-is-refused',True,False),('failed-answer-is-retained',False,False)]:
  f=VisualSequences();p=packet(board(ambiguous));obs,_=measure(p,0,'synthetic-visual');d=ObservedInputDomain(250);inputs=d.candidates(obs);proposal=f.propose(obs,p.frame_rows,inputs,100)
  case={'id':label,'initial':{'public':vars(p),'observation':obs},'inputs':inputs,'proposal':proposal,'last':f.last,'state':f.state()}
  if proposal:
   first=f.before(proposal,0,p,obs);rows=[r.copy()for r in p.frame_rows]
   if accept:
    l,t,r,b=proposal['sequence_plan']['target_box'];raster=proposal['sequence_plan']['expected_raster']
    for j,row in enumerate(raster):rows[t+1+j][l+1:r]=list(row)
   second=packet(rows,1);after,_=measure(second,1,'synthetic-visual');action=proposal['actions'][0]
   event=f.record(obs,after,action,p.frame_rows,second.frame_rows,proposal,0)
   next_proposal=f.propose(after,rows,d.candidates(after),99)
   case.update(beforeGuard=first,afterPublic=vars(second),afterObservation=after,record=event,nextProposal=next_proposal,stateAfter=f.state())
  results.append(case)
 return results

def public(result,revision):
 rows=result['frame']
 return SimpleNamespace(frame_rows=rows,frame_packet=result['frames'],level=result['level'],levels_completed=result['levelsCompleted'],state=result['state'],step_index=revision,
  available_action_refs=[f'ACTION{n}'for n in result['availableActionIds']],frame_hash=hashlib.sha256(json.dumps(rows,separators=(',',':')).encode()).hexdigest()[:16])

def main():
 with tempfile.TemporaryDirectory(prefix='v6-sequence-reference-')as directory:
  root=Path(directory);assets=ROOT/'public/python'
  for name in ('custom-games.zip','official-games.zip'):
   with zipfile.ZipFile(assets/name)as z:z.extractall(root)
  for name in ('game_bridge.py','official_adapter.py','custom_level_navigation.py'):shutil.copy(assets/name,root/name)
  sys.path.insert(0,str(root));import game_bridge
  def send(kind,**payload):
   value=json.loads(game_bridge.dispatch(json.dumps({'type':kind,**payload})))
   if 'error'in value:raise RuntimeError(value['error'])
   return value
  cases=[]
  for code in ['SEQN','SYME']:
   family=VisualSequences();domain=ObservedInputDomain(250);current=public(send('load',code=code,level=1),0);obs,_=measure(current,0,'native-sequence-oracle')
   initial={'public':vars(current),'observation':obs};steps=[];revision=0
   while revision<160 and current.state not in ('WIN','GAME_OVER','GAMEOVER','LEVEL_COMPLETE'):
    inputs=domain.candidates(obs);proposal=family.propose(obs,current.frame_rows,inputs,160-revision)
    if proposal is None:break
    before_guard=family.before(proposal,0,current,obs)
    if not before_guard['admitted']:raise RuntimeError('Original family refused own proposal')
    action=proposal['actions'][0];result=send('action',actionId=int(action['action_ref'][6:]),data=action.get('data'))
    revision+=1;second=public(result,revision);after,_=measure(second,revision,'native-sequence-oracle')
    after_guard=family.after(proposal,0,obs,after,current.frame_rows,second.frame_rows)
    record=family.record(obs,after,action,current.frame_rows,second.frame_rows,proposal,0)
    steps.append({'inputs':inputs,'proposal':proposal,'beforeGuard':before_guard,'afterPublic':vars(second),'afterObservation':after,'afterGuard':after_guard,'record':record,'state':family.state()})
    current,obs=second,after
   cases.append({'game':code,'initial':initial,'steps':steps,'actions':revision,'levelsCompleted':current.levels_completed,'state':current.state})
  config=VisualSequences().config;numeric_cases=[]
  for values,index in [([1,2,None,4,5],2),([1,2,3,None,1],3),([2,None,2,2,2],1),([1,3,1,None,1,3],3),([1,None,3,2,1,2],1),([4,3,None,1,0],2)]:
   numeric_cases.append({'values':values,'index':index,'expected':numeric(values,index,config)})
  source_paths=[REF/'agents/yf_arc3_v6/morphology_policy/visual_sequences'/name for name in ['family.py','programs.py','measure.py','visual_sequences.drm','visual_sequences.src']]+[REF/'agents/yf_arc3_v5/capabilities/visual_sequence.py']
  sources={p.relative_to(REF).as_posix():{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}for p in source_paths}
  fixture={'provenance':{'commit':COMMIT,'sources':sources,'scope':'Original visual sequence family, not full V6 router equivalence'},'configuration':config,'numeric':numeric_cases,'synthetic':synthetic_cases(),'cases':cases}
  out=ROOT/'tests/fixtures/v6-sequence-reference.json';out.write_text(json.dumps(fixture,separators=(',',':'))+'\n')
  print(json.dumps({'file':str(out),'cases':[{'game':c['game'],'actions':c['actions'],'levelsCompleted':c['levelsCompleted'],'state':c['state']}for c in cases]},indent=2))
if __name__=='__main__':main()
