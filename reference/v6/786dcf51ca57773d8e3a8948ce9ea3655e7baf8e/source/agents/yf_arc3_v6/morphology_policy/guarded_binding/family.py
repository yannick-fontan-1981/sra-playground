from pathlib import Path
from attention_memory import AttentionMemory
from copy import deepcopy
from agents.yf_arc3_v5.drm.loader import load_drm_document
from agents.yf_arc3_v6.morphology_policy.src_runtime import SrcProgram,plain
from .tracker import BindingTracker
from .planning import offers
from .geometry import digest,find_body,center,correspondence
HERE=Path(__file__).resolve().parent
class ObservedBinding:
 def __init__(self):
  self.config=plain(load_drm_document(HERE/'binding.drm').document.declarations[0].configuration);self.tracker=BindingTracker();self.selected=None;self.attention=AttentionMemory();self.owner="object_frame_binding"
  self.src=SrcProgram(HERE/'binding.src','v6.observed_binding.choose',{'binding.measure':self.measure,'binding.bind':self.select})
 def measure(self,request):
  obs,rows,remaining=self.context;return {'offers':offers(self.tracker,obs,rows,remaining,self.config)}
 def select(self,measured):
  plans=[p for p in measured['offers'] if p['kind'] in self.config['order']]
  obs=self.context[0];focus=self.attention.composition_for(self.owner,obs)
  if focus and self.config.get('continuity',{}).get('retain_selected_frame_until_effect_or_refutation'):
   plans=[p for p in plans if p['target']['frame']['ref']==focus['target_ref']]
  self.selected=min(plans,key=lambda p:(self.config['order'].index(p['kind']),p.get('residual_distance',p['distance']),len(p['actions']),p['target']['ref'],p['actions'][0]['action_ref'])) if plans else None
  return {'selected':self.selected is not None}
 def propose(self,obs,rows,inputs,remaining,attention=None):
  if attention is not None:self.attention=attention
  focus=self.attention.composition_for(self.owner,obs);admitted=self.tracker.admit_context(obs,rows)
  if focus:
   frame=(focus.get('binding') or {}).get('frame');measured=self.tracker.frame_contradiction(frame,obs,rows) if frame else None
   contradictions=[e for e in self.tracker.context_refutations if e.get('frame_ref')==focus['target_ref']]
   if measured:contradictions.append({'evidence':[obs['observation_ref']],'changed_corners':measured})
   if contradictions:self.attention.return_composition(self.owner,focus['target_ref'],'refuted',[obs['observation_ref']]+[x for e in contradictions for x in e['evidence']],obs)
  if not admitted or self.tracker.core is None:return None
  self.context=obs,rows,remaining;result,workflow=self.src.run({'request':{'observation_ref':obs['observation_ref']}})
  if not result['selected']:return None
  plan=deepcopy(self.selected);actions=plan['actions'];steps=[]
  focus=self.attention.composition_for(self.owner,obs);plan['composition_attention']=deepcopy(focus);plan['target_revalidation']={'frame_ref':plan['target']['frame']['ref'],'observation_ref':obs['observation_ref'],'level_epoch':obs['level_epoch'],'current_offer_bound':True,'release_authority':False}
  plan['preservation_regions']=[p['object']['bbox'] for p in correspondence(obs,rows,self.tracker.core['signature'],self.tracker.observed_frames.values()) if p['ref']!=plan['target']['ref'] and (not self.tracker.held or p['object']['palette_value']!=self.tracker.held['palette_value'])]
  for i,a in enumerate(actions):
   expected=None
   if 'delta' in plan:expected={'level_epoch':obs['level_epoch'],'body_center':[x+y for x,y in zip(plan['poses'][i],plan['delta'])],'conditional_model':'local_displacement_extension'}
   steps.append({'action':a,'body_before':plan['poses'][i],'expected_before':{'level_epoch':obs['level_epoch'],**({'frame_hash':obs['frame_hash']} if i==0 else {})},'expected_after':expected})
  focus='composition:binding:'+digest([obs['observation_ref'],plan['target']['ref'],plan['kind']]);facts={'current_object_frame_context_bound':True,'current_controlled_body_bound':True};evidence=plan['evidence']
  preserved=[{'id':'preserve:'+digest([focus,c]),'role':'preservation_constraint','observed':True,'things':[plan['target']['ref'],self.tracker.core['signature']],'properties':{'constraint':c,'guard':'compare_current_body_and_nonselected_objects'},'relations':['contributes_to:G_official_completion']} for c in plan['preserve']]
  return {'status':'proposed','kind':'public_observed_binding','actions':actions,'steps':steps,'facts':facts,'binding':{k:obs[k] for k in ('observation_ref','level_epoch','levels_completed','frame_hash')},'binding_plan':{'offer':plan,'workflow':workflow,'core':deepcopy(self.tracker.core),'evidence':evidence,'drm_hash':digest(self.config),'portable_methods':deepcopy(self.tracker.methods)},'compositions':[{'id':focus,'role':'information_question','observed':False,'things':[self.tracker.core['signature'],plan['target']['ref'],plan['target']['frame']['ref']],'properties':{'target':'object_bound_then_reception_correspondence_realized','hypotheses':plan['hypotheses'],'unknown':plan['unknown'],'risks':plan['risks'],'falsifiers':plan['falsifiers'],'conditional':True,'composition_attention':plan['composition_attention'],'target_revalidation':plan['target_revalidation'],'reception_evidence':plan.get('pending_reception'),'secondary_access':plan.get('secondary_access')},'relations':['contributes_to:G_official_completion'],'open_question':self.config['question']}]+preserved,'question':{'reason':self.config['question'],'hypothesis_refs':evidence},'route_refs':evidence,'bundle_template':{'operation_key':'OP18','composition_ref':focus,'objective_ref':'G_official_completion','purpose':self.config['question'],'preconditions':facts,'evidence':evidence,'actions':actions,'preserve_refs':[p['id'] for p in preserved],'preservation_evidence':{p['id']:{'observation_ref':obs['observation_ref'],'guard':p['properties']['guard'],'evidence':evidence} for p in preserved},'outcome_guard':{'path':['value'],'contains':focus}}}
 def before(self,proposal,index,public,obs):
  step=proposal['steps'][index];core=self.tracker.core;box=locate(public.frame_rows,core) if core else None
  ok=bool(box) and list(center(box))==step['body_before'] and public.level==proposal['binding']['level_epoch'] and public.levels_completed==proposal['binding']['levels_completed'] and step['action']['action_ref'] in public.available_action_refs
  if index==0:ok=ok and public.frame_hash==proposal['binding']['frame_hash'] and obs['observation_ref']==proposal['binding']['observation_ref']
  return {'admitted':ok,'reason':'body_current_scope_and_exact_prefix_bound' if ok else 'binding_changed'}
 def bind(self,proposal,domain):
  if proposal['actions']!=[s['action'] for s in proposal['steps']] or any('expected_after' not in s for s in proposal['steps']):raise ValueError('Unbound binding action set')
 def after(self,proposal,index,before,after,first,second):
  expected=proposal['steps'][index]['expected_after']
  if expected is None:return {'matched':None,'seal_prefix':True,'reason':'unknown_interaction_reconciles_before_continuation'}
  box=locate(second,proposal['binding_plan']['core']);matched=bool(box) and list(center(box))==expected['body_center']
  if matched:matched=all(first[y][x]==second[y][x] for l,t,r,b in proposal['binding_plan']['offer']['preservation_regions'] for y in range(t,b+1) for x in range(l,r+1))
  return {'matched':matched,'seal_prefix':not matched,'reason':'conditional_displacement_compared_nonlocal_effect_seals_prefix'}
 def record(self,before,after,command,first,second,proposal=None,index=0):
  event=self.tracker.record(before,after,command,first,second,proposal,index)
  focus=self.attention.composition_for(self.owner,before)
  if event and event.get('status')=='reception_confirmed_by_separation':
   self.attention.return_composition(self.owner,event['frame_ref'],'achieved',event['evidence'],after)
   return event
  if before['level_epoch']!=after['level_epoch'] or after['levels_completed']>before['levels_completed']:
   if focus:self.attention.return_composition(self.owner,focus['target_ref'],'boundary',[before['observation_ref'],after['observation_ref']],after)
  elif proposal and proposal.get('binding_plan') and self.config.get('continuity',{}).get('retain_selected_frame_until_effect_or_refutation'):
   plan=proposal['binding_plan']['offer'];target_ref=plan['target']['frame']['ref']
   self.attention.retain_composition(self.owner,target_ref,self.config['question'],list(dict.fromkeys(plan['evidence']+[before['observation_ref'],after['observation_ref']])),after,binding={'frame':deepcopy(plan['target']['frame'])})
  return event
 def state(self):return self.tracker.state()
 def restore(self,state):self.tracker.restore(state)

def locate(rows,core):
 from collections import deque
 candidates=[];seen=set();h=len(rows);w=len(rows[0]);value=core['palette_value']
 for y in range(h):
  for x in range(w):
   if (x,y) in seen or rows[y][x]!=value:continue
   q=deque([(x,y)]);seen.add((x,y));cells=[]
   while q:
    a,b=q.popleft();cells.append((a,b))
    for xx,yy in ((a-1,b),(a+1,b),(a,b-1),(a,b+1)):
     if 0<=xx<w and 0<=yy<h and (xx,yy) not in seen and rows[yy][xx]==value:seen.add((xx,yy));q.append((xx,yy))
   if len(cells)!=core['area']:continue
   box=[min(x for x,y in cells),min(y for x,y in cells),max(x for x,y in cells),max(y for x,y in cells)]
   offsets=sorted([[x-box[0],y-box[1]] for x,y in cells])
   if offsets==sorted(core['offsets']):candidates.append(box)
 return candidates[0] if len(candidates)==1 else None
