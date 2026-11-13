"""Measured local returns and borrowed gauge-mark projection; no action authority."""
from .contrast import display_matches
from .boundary import patch
from agents.yf_arc3_v6.morphology_policy.guarded_binding.family import locate
from agents.yf_arc3_v6.morphology_policy.geometry import gauge_related_marks

def access_measurements(proposal,index,before,after,first,second):
 offer=(proposal or {}).get('inventory_plan',{}).get('offer',{})
 if offer.get('kind')!='access_probe_candidate' or before['level_epoch']!=after['level_epoch'] or before['levels_completed']!=after['levels_completed']:return None
 step=proposal['steps'][index];expected=step.get('expected_after');display=offer['scene'].get('displayed_candidate')
 if not expected or not display or tuple(step['to_cell'])!=tuple(offer['route']['target_cell']):return None
 if before['observation_ref']!=proposal['binding']['observation_ref']:return None
 current_display=(display.get('current_observation_ref')==before['observation_ref'] and display.get('current_level_epoch')==before['level_epoch'] and patch(first,display['display_bbox'])==display.get('current_indicator_pattern')) if display.get('visibility') else display_matches(display,first)
 if not current_display:return None
 if locate(first,offer['core'])!=step['body_before'] or locate(second,offer['core'])!=expected['body_bbox']:return None
 cell=next((c for c in offer['scene']['grids'][0]['cells'] if (c['row'],c['col'])==tuple(offer['route']['target_cell'])),None)
 if not cell:return None
 box=[cell['bbox'][k] for k in ('left','top','right','bottom')]
 l,t,r,b=box;bl,bt,br,bb=expected['body_bbox']
 changed=sum(first[y][x]!=second[y][x] for y in range(t,b+1) for x in range(l,r+1) if not(bl<=x<=br and bt<=y<=bb))
 dl,dt,dr,db=display['display_bbox'];value=display['source_value']
 absent=(patch(second,display['display_bbox'])==display['absence_pattern']) if display.get('visibility') else not any(second[y][x]==value for y in range(dt,db+1) for x in range(dl,dr+1))
 return {'current_scope_and_observation':True,'entered_bound_partition':bool(l<=bl<=br<=r and t<=bt<=bb<=b),'partition_changed_outside_control':changed>0,'display_signature_disappeared':absent,'before':before['observation_ref'],'after':after['observation_ref'],'level_epoch':after['level_epoch'],'partition_bbox':box,'partition_changed_pixels':changed,'display_bbox':display['display_bbox'],'cleared_display_pattern':[list(row[dl:dr+1]) for row in second[dt:db+1]],'composition_ref':proposal['bundle_template']['composition_ref'],'objective_ref':proposal['bundle_template']['objective_ref'],'unknown':['universal_consumption','capacity','terminal_rule','new_resource_effect']}

def capacity_targets(scene,obs,forecast,returned):
 if not returned or returned['level_epoch']!=obs['level_epoch'] or not forecast or forecast.get('observation_ref')!=obs['observation_ref'] or forecast.get('level_epoch')!=obs['level_epoch']:return []
 if len(scene.get('grids',[]))!=1:return []
 grid=scene['grids'][0];parts=[{'bbox':e['bbox'],'color':e['palette_value']} for e in obs['entities']]
 # Reuse the already present gauge-related appearance measurement, sized to the
 # currently controlled footprint. Meaning remains a falsifiable DRM question.
 l,t,r,b=scene['body'];marks=gauge_related_marks(parts,forecast,(grid['cell_width'],grid['cell_height']),(scene['body'],))
 targets=[]
 for box in marks:
  cells=[c for c in grid['cells'] if c['bbox']['left']<=box[0]<=box[2]<=c['bbox']['right'] and c['bbox']['top']<=box[1]<=box[3]<=c['bbox']['bottom']]
  if len(cells)!=1:continue
  c=cells[0];targets.append(([c['row'],c['col']],{'current_scope_and_observation':True,'local_access_return_present':True,'current_gauge_related_mark':True},{'target_cell':[c['row'],c['col']],'target_bbox':[c['bbox'][k] for k in ('left','top','right','bottom')],'mark_bbox':box,'observation_ref':obs['observation_ref'],'dependency_return':returned,'appearance_relation_only':True}))
 return targets
