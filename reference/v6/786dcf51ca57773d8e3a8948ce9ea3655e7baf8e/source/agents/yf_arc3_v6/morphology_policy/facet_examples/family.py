from pathlib import Path
from copy import deepcopy
from terminal_composition import identity
from agents.yf_arc3_v5.drm.loader import load_drm_document
from agents.yf_arc3_v6.morphology_policy.src_runtime import SrcProgram
from .geometry import project,shape,center,box,inside
from .compound import plan as compound_plan,acquire_seed
HERE=Path(__file__).resolve().parent

class FacetExamples:
 def __init__(self):
  decl,=load_drm_document(HERE/'facet_examples.drm').document.declarations;self.config=dict(decl.configuration)
  self.failed=set();self.events=[];self.method=None;self.epoch=None;self.last=None
  self.portable=None;self.compound_cache={};self.compound_methods={};self.refuted_compounds=set()
  self.src=SrcProgram(HERE/'facet_examples.src','v6.facet_examples.choose',{'facet.measure':self.measure,'facet.bind':self.select})
 def measure(self,request):
  obs,rows,inputs,remaining=self.context
  if obs['level_epoch']!=self.epoch:self.epoch=obs['level_epoch'];self.method=None;self.failed=set();self.compound_methods={};self.refuted_compounds=set()
  self.current=project(obs,rows)
  if self.current is None and self.config.get('compound'):
   self.current=compound_plan(obs,rows,self.portable,self.compound_cache,self.config['compound'])
   if self.current and self.current['scope_ref'] in self.refuted_compounds:self.current=None
  return {'qualified':self.current is not None,'remaining':remaining}
 def select(self,measured):
  obs,rows,inputs,remaining=self.context
  if not measured['qualified'] or remaining<1 or 'ACTION6' not in obs['available_action_refs']:return {'selected':False}
  self.trial=identity([obs['level_epoch'],obs['frame_hash'],self.current['offer']['point']])
  return {'selected':self.trial not in self.failed}
 def propose(self,obs,rows,inputs,remaining):
  self.context=obs,rows,inputs,remaining;answer,receipt=self.src.run({'request':{'observation_ref':obs['observation_ref']}})
  if not answer['selected']:return None
  current=self.current;offer=current['offer'];x,y=offer['point'];support=offer['support'];action={'action_ref':'ACTION6','data':{'x':x,'y':y}};focus='composition:visible_contributions:'+identity([obs['observation_ref'],current['scope_ref']])[:20]
  evidence=[obs['observation_ref']];method=None
  if self.method and self.method['scope_ref']==current['scope_ref'] and self.method['cap_shape']==[list(p) for p in shape(support)] and self.method['cap_value']==support['palette_value']:
   method=self.method;evidence+=method['evidence']
  if current.get('compound'):
   evidence+=self.portable['evidence']+[self.portable['boundary_ref']]
   known=self.compound_methods.get(str(support['palette_value']))
   if known and known['model_ref']==current['compound']['model_ref']:
    method=known;evidence+=known['evidence'];current['compound']['port_status']='current_scope_stencil_extension_observed_and_current_render_revalidated'
  facts={'facet_example_current':True,'current_interior_bound':True}
  target=None;question=self.config['question']
  if current.get('compound'):
   c=current['compound'];facts['recalled_stencil_current']=True;question=self.config['compound']['question']
   target={'relative_stencil_origins':c['solution']['placements'],'current_prefix':c['prefix'],'sampling_alternatives':c['solution']['comparisons'],'port_status':c['port_status'],'preserve':'all current visible contributions consistent with the same compound reference','falsifiers':c['falsifiers'],'model_limits':c['limits']}
  return {'status':'proposed','kind':'public_facet_example','actions':[action],
   'steps':[{'action':action,'expected_before':{'level_epoch':obs['level_epoch'],'frame_hash':obs['frame_hash']},'expected_after':None,
    'point_binding':{'observation_ref':obs['observation_ref'],'entity_ref':support['id'],'signature':support['signature'],'bbox':support['bbox'],'level_epoch':obs['level_epoch'],'frame_hash':obs['frame_hash'],'point':[x,y],'palette_value':rows[y][x]}}],
   'facts':facts,'binding':{'observation_ref':obs['observation_ref'],'level_epoch':obs['level_epoch'],'levels_completed':obs['levels_completed'],'frame_hash':obs['frame_hash']},
   'facet_plan':{'projection':current,'trial':self.trial,'workflow':receipt,'method':deepcopy(method)},
   'compositions':[{'id':focus,'role':'information_question','observed':False,'things':['bounded_interiors','filled_example','separate_reference','visible_contributions'],
    'properties':{'offer':{k:v for k,v in offer.items() if k!='support'},'comparison_scale_hypothesis':current['scale_hypothesis'],'compound_target':target,'owner':'unknown_visible_support_only'},'relations':['contributes_to:G_official_completion'],'open_question':question}],
   'question':{'reason':question,'hypothesis_refs':evidence},'route_refs':evidence,
   'bundle_template':{'operation_key':'OP18','composition_ref':focus,'objective_ref':'G_official_completion','preserve_refs':[],'purpose':question,'preconditions':facts,'evidence':evidence,'actions':[action],'outcome_guard':{'path':['value'],'contains':focus}}}
 def bind(self,proposal,domain):
  for action,step in zip(proposal['actions'],proposal['steps'],strict=True):
   if step['point_binding']['point']!=[action['data']['x'],action['data']['y']]:raise ValueError('Unbound facet point')
 def before(self,proposal,index,public,obs):
  bind=proposal['binding'];cmd=proposal['actions'][index];step=proposal['steps'][index];point=cmd['data'];offer=proposal['facet_plan']['projection']['offer']
  ok=(public.level==bind['level_epoch'] and public.levels_completed==bind['levels_completed'] and public.frame_hash==bind['frame_hash'] and obs['observation_ref']==bind['observation_ref'] and cmd==step['action'] and cmd['action_ref'] in public.available_action_refs and [point['x'],point['y']]==offer['point'] and public.frame_rows[point['y']][point['x']]==step['point_binding']['palette_value'])
  return {'admitted':ok,'reason':'current_visible_face_bound' if ok else 'face_or_scope_changed'}
 def after(self,proposal,index,before,after,first,second):return {'matched':None,'seal_prefix':True,'reason':'observe_current_face_edit_without_assuming_owner'}
 def record(self,before,after,command,first,second,proposal,index):
  if command!=proposal['actions'][index] or before['observation_ref']!=proposal['binding']['observation_ref']:raise ValueError('Unbound facet response')
  old=proposal['facet_plan']['projection'];new=project(after,second);refs=[before['observation_ref'],after['observation_ref']]
  if after['levels_completed']>before['levels_completed']:
   event={'status':'official_boundary','evidence':refs,'scope':'visible-reference hypothesis corroborated, hidden occupancy not inferred'}
   if self.portable:self.portable['boundary_ref']=after['observation_ref']
  elif old.get('compound'):
   c=old['compound'];l,t,r,b=old['world'];actual=sorted([x,y,second[y][x]] for y in range(t+1,b) for x in range(l+1,r) if second[y][x] in c['palette'])
   preserved=all(first[y][x]==second[y][x] for y in range(len(first)) for x in range(len(first[y])) if not l<x<r or not t<y<b)
   matched=actual==c['expected_colored_pixels'] and preserved
   event={'status':('compound_seed_effect_matched' if c['prefix']==0 else 'compound_extension_effect_matched') if matched else 'compound_effect_refuted','prefix_before':c['prefix'],'expected_next_prefix':c['prefix']+1,'outside_preserved':preserved,'whole_colored_render_matched':matched,'evidence':refs,'claim':'visible_stencil_change_only; hidden_voxel_count_not_inferred'}
   if matched and c['prefix']>0:
    action=c['solution']['actions'][c['prefix']-1];self.compound_methods[str(action['port_value'])]={'model_ref':c['model_ref'],'offset':action['offset'],'evidence':refs,'scope':'current_epoch_local_face_extrusion'}
   if matched and c['prefix']+1==len(c['solution']['placements']):
    event['status']='compound_visual_candidate_not_accepted';event['comparison_status']='sampled_correspondence_insufficient_for_official_acceptance';self.refuted_compounds.add(old['scope_ref'])
   if not matched:self.refuted_compounds.add(old['scope_ref']);self.method=None
  elif before['frame_hash']==after['frame_hash']:
   event={'status':'no_visible_effect','evidence':refs};self.failed.add(proposal['facet_plan']['trial'])
  elif new and new['scope_ref']==old['scope_ref'] and new['offer']['kind']=='probe_visible_cap':
   l,t,r,b=old['world'];preserved=all(first[y][x]==second[y][x] for y in range(len(first)) for x in range(len(first[y])) if not l<x<r or not t<y<b)
   cap=new['offer']['support'];previous=old['offer']['support'];shift=[center(cap)[i]-center(previous)[i] for i in (0,1)]
   side_changes=[]
   if old['offer']['kind']=='probe_visible_cap':
    for value in {p['palette_value'] for p in old['example_parts']} - {cap['palette_value']}:
     a=[e for e in before['entities'] if e['palette_value']==value and inside(e['bbox'],old['world'])];b=[e for e in after['entities'] if e['palette_value']==value and inside(e['bbox'],old['world'])]
     if a and b:
      aa,bb=box(a),box(b);side_changes.append({'value':value,'before':aa,'after':bb,'vertical_extension':bb[1]<aa[1] and bb[3]==aa[3] and bb[0]==aa[0] and bb[2]==aa[2]})
   sides_extended=len(side_changes)==len(old['example_parts'])-1 and all(c['vertical_extension'] for c in side_changes)
   event={'status':'filled_example_correspondence' if old['offer']['kind']=='probe_congruent_empty_face' else 'observed_visible_cap_and_side_change' if sides_extended else 'cap_change_without_verified_side_extension','cap_shift':shift,'side_changes':side_changes,'outside_preserved':preserved,'evidence':refs}
   if preserved and sides_extended and old['offer']['kind']=='probe_visible_cap' and shift[0]==0 and shift[1]<0:
    self.method={'scope_ref':old['scope_ref'],'cap_shape':[list(p) for p in shape(cap)],'cap_value':cap['palette_value'],'shift':shift,'evidence':refs,'claim':'visible_cap_translation_after_this_interior_click; hidden_occurrence_count_unknown'}
    if self.portable:
     self.portable['up_shift']=shift;self.portable['evidence']=list(dict.fromkeys(self.portable['evidence']+refs))
   elif not preserved:self.method=None;event['status']='outside_contribution_changed'
   if preserved and old['offer']['kind']=='probe_congruent_empty_face':self.portable=acquire_seed(before,after,first,second,old)
  else:event={'status':'effect_not_yet_explained','evidence':refs};self.method=None
  self.events.append(event);return event
 def state(self):return {'failed':sorted(self.failed),'events':deepcopy(self.events),'method':deepcopy(self.method),'epoch':self.epoch,'portable':deepcopy(self.portable),'compound_methods':deepcopy(self.compound_methods),'refuted_compounds':sorted(self.refuted_compounds)}
 def restore(self,state):
  self.failed=set(state['failed']);self.events=deepcopy(state['events']);self.method=deepcopy(state['method']);self.epoch=state['epoch'];self.portable=deepcopy(state.get('portable'));self.compound_methods=deepcopy(state.get('compound_methods',{}));self.refuted_compounds=set(state.get('refuted_compounds',[]))
