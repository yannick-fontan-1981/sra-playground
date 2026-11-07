"""Measured interface contrasts and bounded dependency projections.

No recipe, stock, coordinate or click is supplied by a creator/game identifier.
The caller's DRM labels contrast types and orders the resulting questions.
"""
from copy import deepcopy
from collections import Counter
import hashlib,json
from .geometry import frame
from agents.yf_arc3_v6.morphology_policy.guarded_binding.geometry import revalidate_frame
from agents.yf_arc3_v5.capabilities.symbolic_diagrams import _components,_solid_square,_rectangular_perimeter,measure_diagram_rows,measure_equal_row_pairs,measure_diagram_transition
from agents.yf_arc3_v5.capabilities.concentric_frames import measure_concentric_frames

def digest(x):return hashlib.sha256(json.dumps(x,sort_keys=True,separators=(',',':')).encode()).hexdigest()
def inside(point,box):return box[0]<point[0]<box[2] and box[1]<point[1]<box[3]
def signature(box):return [box['value'],box['box'][2]-box['box'][0]+1,box['box'][3]-box['box'][1]+1]
def pair_signature(pair):
 a,b=pair;return [a['outer'],a['width'],a['height'],b['outer'],b['width'],b['height'],b['point'][0]-a['point'][0],b['point'][1]-a['point'][1]]
def at(glyphs,point):return [g for g in glyphs if g['point']==list(point)]
def count_inside(glyphs,box):return sum(inside(g['point'],box) for g in glyphs)

def scene(rows,config):
 f=frame(rows);components=_components(f);diagrams=measure_diagram_rows(f);extents={r.symbol_extent for r in diagrams}
 glyphs=[];containers=[]
 for c in components:
  b=c.bbox;point=[(b.left+b.right)//2,(b.top+b.bottom)//2]
  if b.height==b.width and b.height in extents and (_solid_square(c) or _rectangular_perimeter(c)):
   glyphs.append({'point':point,'value':c.value,'size':b.height,'solid':_solid_square(c),'box':[b.left,b.top,b.right,b.bottom]})
  if min(b.height,b.width)>1 and all(rows[y][x]==c.value for y in range(b.top,b.bottom+1) for x in range(b.left,b.right+1) if y in (b.top,b.bottom) or x in (b.left,b.right)):
   containers.append({'value':c.value,'box':[b.left,b.top,b.right,b.bottom]})
 rects=measure_concentric_frames(f);tight=[{'point':[r.center[1],r.center[0]],'value':rows[r.center[0]][r.center[1]],'box':[r.left,r.top,r.right,r.bottom]} for r in rects if r.outer_value==config['palette_white_value'] and r.maximum_equal_padding==1]
 pairs=[[{'point':[r.center[1],r.center[0]],'value':rows[r.center[0]][r.center[1]],'outer':r.outer_value,'width':r.right-r.left+1,'height':r.bottom-r.top+1} for r in pair] for pair in measure_equal_row_pairs(f)]
 return {'glyphs':glyphs,'containers':containers,'tight':tight,'pairs':pairs,'diagrams':[{'left':list(r.left_values),'right':list(r.right_values),'branch':r.branch_value,'size':r.symbol_extent} for r in diagrams]}

class Interface:
 def __init__(self,config,holds):self.config=config;self.holds=holds;self.epoch=None;self.samples=[];self.contrasts=[];self.methods=[];self.refutations=[];self.bound=None
 def scope(self,epoch):
  if self.epoch!=epoch:self.epoch=epoch;self.samples=[];self.contrasts=[];self.bound=None
 def remember(self,sc,ref):
  self.samples.append({'scene':sc,'ref':ref});self.samples=self.samples[-24:]
 def record(self,before,after,command,first,second,proposal):
  self.scope(before['level_epoch']);a=scene(first,self.config);self.remember(a,before['observation_ref'])
  evidence=[before['observation_ref'],after['observation_ref']]
  if before['level_epoch']!=after['level_epoch']:
   method=self.build_method(evidence)
   if method and not any(m['id']==method['id'] for m in self.methods):self.methods.append(method);self.methods=self.methods[-8:]
   self.scope(after['level_epoch']);return {'status':'boundary_method_built' if method else 'boundary_method_incomplete','method_ref':method['id'] if method else None}
  b=scene(second,self.config);self.remember(b,after['observation_ref']);data=command.get('data',{})
  if set(data)!={'x','y'}:return None
  point=[data['x'],data['y']];ga=at(a['glyphs'],point);gb=at(b['glyphs'],point);selected=a['tight'][0] if len(a['tight'])==1 else None
  before_tight={tuple(x['point']) for x in a['tight']};after_tight={tuple(x['point']) for x in b['tight']};pair=next((p for p in a['pairs'] if any(s['point']==point for s in p)),None)
  facts={'clicked_solid_preserved_and_tight_added':len(ga)==len(gb)==1 and ga[0]['solid'] and ga[0]==gb[0] and tuple(point) in after_tight-before_tight,'selection_cleared_clicked_pair_takes_value':selected is not None and pair is not None and not b['tight'] and len(gb)==1 and gb[0]['solid'] and gb[0]['value']==selected['value'] and (len(ga)!=1 or ga[0]['value']!=gb[0]['value']),'diagram_transition_count':measure_diagram_transition(frame(first),frame(second)),'selection_cleared_matching_hollow_filled':selected is not None and not b['tight'] and len(ga)==len(gb)==1 and not ga[0]['solid'] and gb[0]['solid'] and ga[0]['value']==gb[0]['value']==selected['value']}
  accepted=[]
  for rule in self.config['interface_learning_rules']:
   if not self.holds(rule['all_conditions'],facts):continue
   kind=rule['static_facts']['interface_effect'];event={'kind':kind,'evidence':evidence,'scope':before['level_epoch'],'action_ref':command['action_ref'],'point':point,'glyph_before':ga,'glyph_after':gb,'selected_before':selected,'pair':pair,'facts':facts}
   if kind=='transform':
    matches=[p for p in a['pairs'] if any([x['value'] for x in p]==r['left'] for r in a['diagrams']) and any([x['point'] for x in q]==[x['point'] for x in p] and len({x['value'] for x in q})==1 for q in b['pairs'])]
    event['transform_pairs']=matches
   self.contrasts.append(event);accepted.append(kind)
  self.contrasts=self.contrasts[-32:]
  method=proposal.get('symbol_transaction_plan',{}).get('interface_offer')
  if method:
   previous=self.bound if self.bound and self.bound['epoch']==before['level_epoch'] and self.bound['method_ref']==method['method_ref'] else {}
   self.bound={'epoch':before['level_epoch'],'method_ref':method['method_ref'],'source':deepcopy(method['current_source']),'receiver':deepcopy(method['current_receiver']),'receipt_overlays':deepcopy(previous.get('receipt_overlays',[])),'evidence':evidence}
   box=method['current_receiver']['box'];ignore=point if method['expected_effect']=='receive' else None
   old_requests=[g for g in a['glyphs'] if inside(g['point'],box) and g['point']!=ignore];new_requests=[g for g in b['glyphs'] if inside(g['point'],box) and g['point']!=ignore]
   if old_requests!=new_requests:accepted=[]
   if 'receive' in accepted:
    additions=[c for c in b['containers'] if c not in a['containers'] and inside(point,c['box']) and box[0]<=c['box'][0]<=c['box'][2]<=box[2] and box[1]<=c['box'][1]<=c['box'][3]<=box[3] and any(first[y][x]!=second[y][x] for y in range(c['box'][1],c['box'][3]+1) for x in range(c['box'][0],c['box'][2]+1) if x in (box[0],box[2]) or y in (box[1],box[3]))]
    if len(additions)==1:
     overlay={'container':deepcopy(additions[0]),'point':point,'glyph':deepcopy(gb[0]),'evidence':evidence,'status':'new_perimeter_after_confirmed_receipt; hidden_parent_pixels_unknown'}
     self.bound['receipt_overlays']=(self.bound['receipt_overlays']+[overlay])[-8:]
  if method and method['expected_effect'] not in accepted:
   self.refutations.append({'method_ref':method['method_ref'],'epoch':before['level_epoch'],'evidence':evidence,'reason':'predicted_current_interface_contrast_absent','expected':method['expected_effect'],'observed':accepted});self.refutations=self.refutations[-32:]
  return {'status':'interface_contrasts','kinds':accepted,'evidence':evidence,'facts':facts}
 def build_method(self,boundary):
  by_kind={k:[e for e in self.contrasts if e['kind']==k] for k in self.config['interface_required_effects']}
  if any(not v for v in by_kind.values()):return None
  selected=[e['point'] for e in by_kind['select']];receipts=[e['point'] for e in by_kind['receive']]
  def containers(points,exclude):
   found={}
   for sample in self.samples:
    sc=sample['scene']
    for c in sc['containers']:
     if all(inside(p,c['box']) for p in points) and not any(inside(p,c['box']) for p in exclude) and count_inside(sc['glyphs'],c['box'])>1:found[digest(c)]=c
   if not found:return []
   size=min((c['box'][2]-c['box'][0]+1)*(c['box'][3]-c['box'][1]+1) for c in found.values());return [c for c in found.values() if (c['box'][2]-c['box'][0]+1)*(c['box'][3]-c['box'][1]+1)==size]
  source=containers(selected,receipts);sink=containers(receipts,selected)
  source_sigs={tuple(signature(c)) for c in source};sink_sigs={tuple(signature(c)) for c in sink};loads=by_kind['load'];transforms=by_kind['transform'];pair_sigs={tuple(pair_signature(e['pair'])) for e in loads if e['pair']}
  empty={g['value'] for e in loads for g in e['glyph_before']};actions={e['action_ref'] for v in by_kind.values() for e in v}
  if len(source_sigs)!=1 or len(sink_sigs)!=1 or len(pair_sigs)!=1 or len(empty)!=1 or len(actions)!=1:return None
  offsets=set()
  for e in transforms:
   if len(e['transform_pairs'])!=1:return None
   pair=e['transform_pairs'][0];offsets.add((2*e['point'][0]-sum(s['point'][0] for s in pair),2*e['point'][1]-sum(s['point'][1] for s in pair)))
  if len(offsets)!=1:return None
  payload={'source_signature':list(next(iter(source_sigs))),'receiver_signature':list(next(iter(sink_sigs))),'pair_signature':list(next(iter(pair_sigs))),'empty_value':next(iter(empty)),'action_ref':next(iter(actions)),'activation_offset_twice':list(next(iter(offsets))),'source_epoch':self.epoch,'evidence':list(dict.fromkeys([r for v in by_kind.values() for e in v for r in e['evidence']]+boundary)),'status':'observed_interface_method_requires_current_revalidation','terminal_scope':'receipt_contribution_and_boundary; not_universal_all_slots_law'}
  return {'id':'symbol_interface:'+digest({k:v for k,v in payload.items() if k not in ('source_epoch','evidence','status','terminal_scope')}),**payload}
 def options(self,obs,rows,inputs,remaining):
  self.scope(obs['level_epoch']);active=[m for m in self.methods if not any(r['method_ref']==m['id'] and r['epoch']==obs['level_epoch'] for r in self.refutations)]
  if not active:return []
  sc=scene(rows,self.config);offers=[]
  for method in active:
   sources=[c for c in sc['containers'] if signature(c)==method['source_signature']];receivers=[c for c in sc['containers'] if signature(c)==method['receiver_signature']];pairs=[p for p in sc['pairs'] if pair_signature(p)==method['pair_signature']]
   if not sources and self.bound and self.bound['epoch']==obs['level_epoch'] and self.bound['method_ref']==method['id'] and len(sc['tight'])==1:
    prior=self.bound['source'];box=prior['box'];overlay=sc['tight'][0]['box'];value=prior['value']
    if signature(prior)==method['source_signature'] and inside(sc['tight'][0]['point'],box) and all(rows[y][x]==value or (overlay[0]<=x<=overlay[2] and overlay[1]<=y<=overlay[3] and rows[y][x]==self.config['palette_white_value']) for y in range(box[1],box[3]+1) for x in range(box[0],box[2]+1) if y in (box[1],box[3]) or x in (box[0],box[2])):sources=[deepcopy(prior)]
   if not receivers and self.bound and self.bound['epoch']==obs['level_epoch'] and self.bound['method_ref']==method['id'] and self.bound.get('receiver'):
    prior=self.bound['receiver'];overlays=[]
    for record in self.bound.get('receipt_overlays',[]):
     c=record['container'];glyphs=at(sc['glyphs'],record['point'])
     if glyphs==[record['glyph']] and revalidate_frame({'bbox':c['box'],'palette_value':c['value'],'corner_value':c['value']},rows):overlays.append(record)
    if overlays and signature(prior)==method['receiver_signature']:
     rebound=revalidate_frame({'bbox':prior['box'],'palette_value':prior['value'],'corner_value':prior['value']},rows,[r['container']['box'] for r in overlays])
     if rebound:
      receivers=[{**deepcopy(prior),'visibility':rebound,'occlusion_evidence':deepcopy(overlays),'binding_evidence':deepcopy(self.bound['evidence']),'inference':'same recipient region under measured post-receipt perimeter; concealed parent pixels unknown'}]
   if len(sources)!=1 or len(receivers)!=1 or len(pairs)!=1 or len(sc['tight'])>1:continue
   source=sources[0];receiver=receivers[0];pair=pairs[0];inventory=[g for g in sc['glyphs'] if inside(g['point'],source['box'])];demands=[g for g in sc['glyphs'] if inside(g['point'],receiver['box']) and not g['solid']];selected=sc['tight'][0] if sc['tight'] and inside(sc['tight'][0]['point'],source['box']) else None
   if sc['tight'] and selected is None:continue
   loaded=[s['value'] for s in pair if s['value']!=method['empty_value']];empty_slots=[s for s in pair if s['value']==method['empty_value']];available={g['value'] for g in inventory if g['solid']};routes={}
   # Bounded backward relation projection. Every row remains a current displayed hypothesis.
   needed={g['value']:0 for g in demands}
   for depth in range(self.config['interface_dependency_depth']):
    for row in sc['diagrams']:
     if any(v in needed and needed[v]<=depth for v in row['right']):
      for value in row['left']:needed.setdefault(value,depth+1)
   useful=[r for r in sc['diagrams'] if len(r['left'])==len(pair) and any(v in needed for v in r['right']) and loaded==r['left'][:len(loaded)]]
   def add(kind,point,goal,expected,row=None):
    commands=[a for a in inputs if a['action_ref']==method['action_ref'] and a.get('data')=={'x':point[0],'y':point[1]}]
    entities=[e for e in obs['entities'] if any((x,y)==(point[0]-e['position'][0],point[1]-e['position'][1]) for x,y in e['mask'])]
    if len(commands)!=1 or len(entities)!=1:return
    if remaining<1:return
    facts={'interface_method_current':True,'offer_kind':kind,'target_y':goal[1],'target_x':goal[0],'source_y':point[1],'source_x':point[0],'recipe_dependency_depth':min((needed.get(v,99) for v in (row or {}).get('right',[])),default=0),'selected_present':selected is not None,'loaded_count':len(loaded)}
    data={'method_ref':method['id'],'evidence':method['evidence'],'expected_effect':expected,'current_source':source,'current_receiver':receiver,'current_pair':pair,'current_demands':demands,'displayed_row':row,'selected':selected,'unknown':['current_effect_requires_sealed_return','inventory_exact_multiplicities','recipe_generalization_to_untried_row'],'falsifiers':['predicted_interface_contrast_absent','other_request_changes','current_container_or_point_ambiguous','scope_changed']}
    offers.append({'action':commands[0],'facts':facts,'entities':entities,'point_entity':entities[0],'interface_offer':data})
   if selected:
    for demand in demands:
     if demand['value']==selected['value']:add('receive_selected',demand['point'],demand['point'],'receive')
    for row in useful:
     missing=Counter(row['left'])-Counter(loaded)
     if len(loaded)<len(row['left']) and selected['value']==row['left'][len(loaded)]:
      for slot in empty_slots:add('load_selected',slot['point'],slot['point'],'load',row)
   else:
    for row in useful:
     if Counter(loaded)==Counter(row['left']):
      xy=[sum(s['point'][i] for s in pair)+method['activation_offset_twice'][i] for i in range(2)]
      if all(v%2==0 for v in xy):add('activate_loaded',[v//2 for v in xy],[v//2 for v in xy],'transform',row)
    if not loaded:
     for demand in demands:
      for glyph in inventory:
       if glyph['solid'] and glyph['value']==demand['value']:add('select_direct',glyph['point'],demand['point'],'select')
    for row in useful:
     missing=Counter(row['left'])-Counter(loaded)
     if any(v not in available for v in missing):continue
     for glyph in inventory:
      if glyph['solid'] and len(loaded)<len(row['left']) and glyph['value']==row['left'][len(loaded)]:add('select_operand',glyph['point'],glyph['point'],'select',row)
  return offers
 def state(self):return deepcopy({'epoch':self.epoch,'samples':self.samples,'contrasts':self.contrasts,'methods':self.methods,'refutations':self.refutations,'bound':self.bound})
 def restore(self,state):
  for name in ('epoch','samples','contrasts','methods','refutations','bound'):
   if name in state:setattr(self,name,deepcopy(state[name]))
