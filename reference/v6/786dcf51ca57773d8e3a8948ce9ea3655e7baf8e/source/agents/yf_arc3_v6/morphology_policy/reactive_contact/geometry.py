from agents.yf_arc3_v6.morphology_policy.src_runtime import plain
from collections import deque
from agents.yf_arc3_v5.capabilities.contracts import FrameGrid,BoundingBox,ComponentExtractionInput,InteractionProbeInput
from agents.yf_arc3_v5.capabilities.components import detect_components
from agents.yf_arc3_v5.capabilities.interaction import _action_quantized_route_grid_candidates,_retained_route_grid_candidate_from_recount
from agents.yf_arc3_v5.capabilities.reactive_pursuit_observation import measure_reactive_pursuit_observation
from agents.yf_arc3_v5.capabilities.navigation_transition_measurements import measure_current_translation_underlays
from agents.yf_arc3_v5.capabilities.rigid_grasp_geometry import translated_mask,support_collisions
from agents.yf_arc3_v5.capabilities.autonomous_consumption_d import ConsumptionGraphD,_consumption_paths,_consumption_path
import hashlib,json

def digest(x):return hashlib.sha256(json.dumps(x,sort_keys=True,separators=(',',':')).encode()).hexdigest()
def unique(obs):
 es=obs['entities'];return {e['signature']:e for e in es if sum(x['signature']==e['signature']for x in es)==1}
def patch(rows,b):return [row[b[0]:b[2]+1]for row in rows[b[1]:b[3]+1]]
def mask(e):return [(x,y)for y in range(e['bbox'][1],e['bbox'][3]+1)for x in range(e['bbox'][0],e['bbox'][2]+1)]
def movements(before,after):
 a,b=unique(before),unique(after);return [{'signature':k,'before':a[k],'after':b[k],'delta':[b[k]['bbox'][0]-a[k]['bbox'][0],b[k]['bbox'][1]-a[k]['bbox'][1]]}for k in a.keys()&b.keys()if a[k]['bbox']!=b[k]['bbox']and a[k]['area']>=4 and a[k]['area']==(a[k]['bbox'][2]-a[k]['bbox'][0]+1)*(a[k]['bbox'][3]-a[k]['bbox'][1]+1)]
def relative(before,after,first,second,core,quantum):
 u=unique(after);body=u.get(core)
 if body is None:return None
 f=FrameGrid(rows=second);cs=detect_components(ComponentExtractionInput(frame=f,connectivity=4));bybox={(c.bbox.left,c.bbox.top,c.bbox.right,c.bbox.bottom):c.component_id for c in cs.components};motion=movements(before,after);translations=tuple((bybox[tuple(m['after']['bbox'])],m['delta'][1],m['delta'][0])for m in motion if tuple(m['after']['bbox'])in bybox);l,t,r,b=body['bbox']
 # The canonical input owns defaults for every calculator field. Underlay is
 # prior visible matter at this exact translated component, never a floor role.
 body_ref=bybox.get(tuple(body['bbox']));body_deltas=[(dr,dc)for ref,dr,dc in translations if ref==body_ref]
 underlay=()
 if before['level_epoch']==after['level_epoch']and len(body_deltas)==1:
  measured=measure_current_translation_underlays(before=first,after=second)
  matches=[row for row in measured if row['component_ref']==body_ref and tuple(row['translation_delta'])==body_deltas[0]]
  if len(matches)==1:underlay=tuple(sorted({int(color)for _,_,color in matches[0]['observed_underlay_pixels']}))
 v=InteractionProbeInput(frame=f,available_action_refs=tuple(after['available_action_refs']),canonical_provisional_control_geometry_bboxes=(BoundingBox(left=l,top=t,right=r,bottom=b),),current_observation_frame_ref=after['observation_ref'],components=cs,current_exact_component_translations=translations,previous_action_observed_frame=FrameGrid(rows=first),current_input_aligned_underlay_values=underlay)
 return plain(measure_reactive_pursuit_observation(v,contact_quantum=quantum,contact_grid_current=True))
def scene(obs,rows,control,peer,floor):
 body=unique(obs).get(control['signature']);target=unique(obs).get(peer)if peer else None
 if body is None or target is None or floor is None:return None
 l,t,r,b=body['bbox'];f=FrameGrid(rows=rows);box=BoundingBox(left=l,top=t,right=r,bottom=b);cs=detect_components(ComponentExtractionInput(frame=f,connectivity=4));v=InteractionProbeInput(frame=f,components=cs,available_action_refs=tuple(obs['available_action_refs']),canonical_provisional_control_geometry_bboxes=(box,),input_aligned_entity_bboxes=(box,),known_action_translation_deltas=tuple((a,d[1],d[0])for a,d in control['commands'].items()),observed_input_aligned_action_translation=tuple(control['last_motion']['translation'])if control.get('last_motion',{}).get('after_ref')==obs['observation_ref']else None,retained_grid_geometry=tuple(control['grid'])if control.get('grid')else None)
 grids=_action_quantized_route_grid_candidates(v)
 if not grids and control.get("grid"):
  retained=_retained_route_grid_candidate_from_recount(v,quantum=control["grid"][4]);grids=(retained,)if retained is not None else ()
 if len(grids)!=1:return None
 g=grids[0];tiles={};pitch=g.row_pitch
 control['grid']=[getattr(g,k)for k in ('row_offset','col_offset','cell_height','cell_width','row_pitch','col_pitch','logical_rows','logical_columns')]
 if pitch!=g.col_pitch:return None
 for cell in g.cells:
  b=cell.bbox;k=f'{b.left},{b.top}';tiles[k]={'key':k,'box':[b.left,b.top,b.right,b.bottom],'patch':[list(row[b.left:b.right+1])for row in rows[b.top:b.bottom+1]],'center':[(b.left+b.right)//2,(b.top+b.bottom)//2]}
 def key(e):
  bs=e['bbox'];m=[k for k,v in tiles.items()if v['box'][0]<=bs[0]<=bs[2]<=v['box'][2]and v['box'][1]<=bs[1]<=bs[3]<=v['box'][3]];return m[0]if len(m)==1 else None
 bk,tk=key(body),key(target)
 if bk is None or tk is None:return None
 stones=[]
 for e in obs['entities']:
  if e['signature']in(control['signature'],peer)or e['area']!=body['area']or e['bbox'][2]-e['bbox'][0]!=body['bbox'][2]-body['bbox'][0]or e['bbox'][3]-e['bbox'][1]!=body['bbox'][3]-body['bbox'][1]:continue
  k=key(e)
  if k and all(rows[y][x]==floor for y in range(tiles[k]['box'][1],tiles[k]['box'][3]+1)for x in range(tiles[k]['box'][0],tiles[k]['box'][2]+1)if (x,y)not in mask(e)):stones.append({**e,'key':k})
 admitted={k for k,t in tiles.items()if all(v==floor for row in t['patch']for v in row)}|{bk,tk}
 return {'current_entities':obs['entities'],'body':body,'peer':target,'bodykey':bk,'peerkey':tk,'stones':stones,'tiles':tiles,'admitted':admitted,'pitch':pitch,'grid':{k:getattr(g,k)for k in('row_offset','col_offset','row_pitch','col_pitch','cell_height','cell_width')}}
def routes(scene,directions,excluded=(),part=None):
 allowed=scene['admitted']-set(excluded);allowed.add(scene['bodykey']);edges=[];order=[];actions={}
 for k in sorted(allowed):
  x,y=scene['tiles'][k]['box'][:2];ns=[]
  for a,(dx,dy)in directions.items():
   n=f'{x+dx*scene["pitch"]},{y+dy*scene["pitch"]}'
   if n in allowed:edges.append((k,n));ns.append(n);actions[k,n]=a
  order.append((k,tuple(ns)))
 class Budget:
  def __init__(self):self.count=0
  def visit(self,x):self.count+=1
 budget=Budget();graph=ConsumptionGraphD(node_refs=tuple(sorted(allowed)),directed_edges=tuple(edges),node_rooms=tuple((k,'current_support_hypothesis')for k in sorted(allowed)),neighbor_order=tuple(sorted(allowed)));parents,_,truncated=_consumption_paths(graph,scene['bodykey'],budget,max(1,len(allowed)))
 out={}
 for k in parents:
  path=_consumption_path(parents,k);out[k]=[{'action':{'action_ref':actions[a,b]},'before':a,'after':b}for a,b in zip(path,path[1:])]
 return out,{'nodes':len(allowed),'evaluations':budget.count,'truncated':truncated,'support_is_conditional':True}


def current_body_box(rows,body):
 cs=detect_components(ComponentExtractionInput(frame=FrameGrid(rows=rows),connectivity=4)).components
 b=body["bbox"];matches=[c for c in cs if c.value==body["palette_value"] and c.area==body["area"] and c.bbox.width==b[2]-b[0]+1 and c.bbox.height==b[3]-b[1]+1]
 return [matches[0].bbox.left,matches[0].bbox.top,matches[0].bbox.right,matches[0].bbox.bottom]if len(matches)==1 else None

def current_member_scene(rows,offer,expected_part=None):
 bodybox=current_body_box(rows,offer['body']);peerbox=current_body_box(rows,offer['peer']);expected_part=expected_part or offer['subject']['bbox'];cs=detect_components(ComponentExtractionInput(frame=FrameGrid(rows=rows),connectivity=4)).components;parts=[c for c in cs if [c.bbox.left,c.bbox.top,c.bbox.right,c.bbox.bottom]==expected_part and c.value==offer['subject']['palette_value'] and c.area==offer['subject']['area']];partbox=expected_part if len(parts)==1 else None
 if bodybox is None or peerbox is None:return None
 stones=[]
 if partbox is not None:stones.append({**offer['subject'],'bbox':partbox})
 for e in offer.get('guard_other_entities',[]):
  if any(c.value==e['palette_value'] and c.area==e['area'] and [c.bbox.left,c.bbox.top,c.bbox.right,c.bbox.bottom]==e['bbox']for c in cs):stones.append(e)
 body={**offer['body'],'bbox':bodybox};peer={**offer['peer'],'bbox':peerbox};tiles=offer['guard_tiles'];explained=set(mask(body)+mask(peer)+(mask(stones[0])if partbox is not None else[]));admitted=[k for k,v in tiles.items()if all(rows[y][x]==offer['guard_support_value']or (x,y)in explained for y in range(v['box'][1],v['box'][3]+1)for x in range(v['box'][0],v['box'][2]+1))]
 return {'body':body,'peer':peer,'stones':stones,'tiles':tiles,'admitted':admitted}

def bound_relative_peer_row(measured,observation,rows,peer_signature):
 peer=unique(observation).get(peer_signature)
 if peer is None:return None
 cs=detect_components(ComponentExtractionInput(frame=FrameGrid(rows=rows),connectivity=4)).components
 members=[c for c in cs if [c.bbox.left,c.bbox.top,c.bbox.right,c.bbox.bottom]==peer['bbox']and c.value==peer['palette_value']and c.area==peer['area']]
 if len(members)!=1:return None
 matches=[r for r in measured.get('relative_escape_transition_rows',[])if r.get('peer_component_ref')==members[0].component_id and r.get('frame_ref')==observation['observation_ref']]
 return matches[0]if len(matches)==1 else None
