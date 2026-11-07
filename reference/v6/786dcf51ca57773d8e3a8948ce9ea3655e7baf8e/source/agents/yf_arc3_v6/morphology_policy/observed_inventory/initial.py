from agents.yf_arc3_v5.capabilities.contracts import FrameGrid,PeriodicCellGridInput
from agents.yf_arc3_v5.capabilities.frame import enumerate_periodic_cell_grids
from agents.yf_arc3_v6.morphology_policy.guarded_binding.geometry import unique

def initial_candidates(observation,rows):
 candidates=[]
 for signature,e in unique(observation).items():
  l,t,r,b=e['bbox'];w=r-l+1;h=b-t+1
  if w<3 or h<3 or w!=h or e['area']!=2*w+2*h-4:continue
  shape=set(map(tuple,e['mask']));perimeter={(x,y) for y in range(h) for x in range(w) if x in (0,w-1) or y in (0,h-1)}
  if shape!=perimeter:continue
  inner={rows[y][x] for y in range(t+1,b) for x in range(l+1,r)}
  if len(inner)!=1 or e['palette_value'] in inner:continue
  candidates.append({'signature':signature,'bbox':e['bbox'],'area':w*h,'status':'controlled_body_hypothesis_not_observed'})
 from agents.yf_arc3_v5.capabilities.contracts import PeriodicCellGridResult
 if not candidates:return [],PeriodicCellGridResult(candidates=())
 grids=enumerate_periodic_cell_grids(PeriodicCellGridInput(frame=FrameGrid(rows=tuple(map(tuple,rows)))))
 return candidates,grids

def provisional_scenes(observation,rows):
 from agents.yf_arc3_v5.capabilities.contracts import BoundingBox,InteractionProbeInput,ComponentExtractionInput
 from agents.yf_arc3_v5.capabilities.components import detect_components
 from agents.yf_arc3_v5.capabilities.interaction import _unique_action_conditioned_control_centered_grid_candidate
 bodies,raw=initial_candidates(observation,rows);frame=FrameGrid(rows=tuple(map(tuple,rows)));components=detect_components(ComponentExtractionInput(frame=frame))
 # A shared spatial period is a hypothesis here, never a fabricated translation.
 quanta={g.row_pitch for g in raw.candidates if g.row_pitch==g.col_pitch};out=[]
 for body in bodies:
  l,t,r,b=body['bbox'];box=BoundingBox(left=l,top=t,right=r,bottom=b)
  for q in quanta:
   value=InteractionProbeInput(frame=frame,components=components,available_action_refs=tuple(observation['available_action_refs']),canonical_provisional_control_geometry_bboxes=(box,))
   grid=_unique_action_conditioned_control_centered_grid_candidate(value,quantum=q)
   if grid is None:continue
   out.append({'status':'spatial_period_and_body_hypothesis','body':body['bbox'],'body_signature':body['signature'],'grids':[grid.model_dump(mode='json')],'controls':{},'observation_ref':observation['observation_ref'],'level_epoch':observation['level_epoch'],'evidence':[observation['observation_ref']],'grid_authority':'hypothesis_from_repeated_spatial_period_not_observed_action','release_authority':False})
 return out
