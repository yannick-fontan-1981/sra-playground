/** V6 CellProjection: public action-conditioned cells and correspondence only. */
import { clone,digest,key,box,detect_components,find_body,moved_core,public_grid,_action_quantized_route_grid_candidates,_current_action_quantized_control_cell_retained_underlay_value_count,_edge_display_exact_complement_cell_measurements,type R } from './v6-inventory-measurements.ts';
import { measureCurrentSupportUnderlays } from './v6-support-measurements.ts';
import { current_material_layers } from './v6-inventory-material-layers.ts';
import { measure as measure_effect_scope } from './v6-inventory-effect-scope.ts';
import { transferred_shape,reverse_transfer,display_matches } from './v6-inventory-contrast.ts';
import { measurements } from './v6-inventory-control-revalidation.ts';
import { pythonEqual as same,pythonTruthy as truth } from './v6-operations.ts';
import { copyNativeValue } from './v6-native-owned.ts';
import type { NativeRows } from './v6-native-types.ts';

export class CellProjection {
 epoch:number|null=null;core:string|null=null;controls:R={};underlays=new Map<string,R>();events:R[]=[];last_motion:R|null=null;displayed:R|null=null;transfer_methods:R[]=[];initial_hash:string|null=null;initial_ref:string|null=null;scope_returns:R[]=[];metric_revalidation_epoch:number|null=null;
 observe_scope(obs:R,rows:NativeRows):void{
  if(this.epoch!==obs.level_epoch){const source_epoch=this.epoch,methods=clone(this.controls),transfers=clone(this.transfer_methods);Object.assign(this,new CellProjection());this.epoch=obs.level_epoch;this.controls=Object.fromEntries(Object.entries(methods).filter(([_k,v])=>!truth(v.contradictions)).map(([k,v])=>[k,{...v,recalled_hypothesis:true,recalled_from_epoch:source_epoch}]));this.transfer_methods=transfers;}
  if(this.initial_hash===null){this.initial_hash=digest(rows);this.initial_ref=obs.observation_ref;}
 }
 state():R{return clone({...this,underlays:[...this.underlays].map(([k,v])=>[k.split(',').map(Number),v])});}
 restore(state:R):void{const value=copyNativeValue(state);value.underlays=new Map((value.underlays??[]).map(([k,v]:[number[],R])=>[key(k),v]));Object.assign(this,value);}
 record(before:R,after:R,action:R,first:NativeRows,second:NativeRows,control_revalidation:((facts:R)=>R)|null=null):R|null{
  this.observe_scope(before,first);if(before.level_epoch!==after.level_epoch)return null;
  if(digest(second)===this.initial_hash&&!same(first,second)){this.underlays=new Map();this.displayed=null;this.last_motion=null;for(const control of Object.values(this.controls))control.recalled_hypothesis=true;
   const event={status:'exact_observed_scene_restoration',evidence:[this.initial_ref,before.observation_ref,after.observation_ref],qualification:'whole_public_image_equal_no_reset_command_or_universal_exhaustion_cause_inferred'};this.scope_returns.push(event);return event;}
  if(truth(action.data))return null;
  const moved=moved_core(before,after,1,4);
  if(!moved){
   if(truth(this.core)){
    const bf=this.measure(before,first),af=this.measure(after,second),result=transferred_shape(before,after,first,second,bf,af,action);
    if(result.status==='unique_corresponding_transfer'){const receipt={...result.matches[0],evidence:result.evidence,action,epoch:this.epoch,status:'observed_correspondence_possession_hypothesis'};this.displayed=receipt;this.transfer_methods.push(receipt);this.events.push(result);return result;}
    if(truth(this.displayed)){
     const inverse=reverse_transfer(this.displayed!,before,after,first,second,bf);
     if(inverse.status==='unique_reverse_correspondence'){
      const [bl,bt,br,bb]=bf.body,[cl,ct,cr,cb]=inverse.alternatives[0].cell_bbox,exterior:number[][]=[];
      for(let y=ct;y<=cb;y++)for(let x=cl;x<=cr;x++)if(!(bl<=x&&x<=br&&bt<=y&&y<=bb))exterior.push([x-cl,y-ct]);
      const prior_under=this.underlays.get(key(bf.body))??{},offset=inverse.alternatives[0].offset,material=this.displayed!.source_mask.map(([x,y]:number[])=>[x!+offset[0],y!+offset[1]]);
      if(!this.underlays.has(key(bf.body)))this.underlays.set(key(bf.body),{});
      this.underlays.get(key(bf.body))!.material_overlay={substrate_patch:same(prior_under.cell_bbox,[cl,ct,cr,cb])?clone(prior_under.patch??null):null,material_mask:material,material_value:this.displayed!.source_value,control_signature:this.core,entry_evidence:clone(prior_under.evidence??[]),level_epoch:before.level_epoch,cell_bbox:[cl,ct,cr,cb],body_bbox:bf.body,prior_exterior:exterior.map(([x,y])=>[x,y,first[ct+y!]![cl+x!]]),current_exterior:exterior.map(([x,y])=>[x,y,second[ct+y!]![cl+x!]]),evidence:[before.observation_ref,after.observation_ref],qualification:'retained_surface_under_observed_material_transfer_departure_still_conditional'};
      this.displayed=null;this.events.push(inverse);return inverse;
     }
    }
   }
   return null;
  }
  const [dx,dy]=moved.delta;if(Boolean(dx)===Boolean(dy)||!Number.isInteger(dx)||!Number.isInteger(dy))return null;if(truth(this.core)&&this.core!==moved.signature)return null;
  this.core=moved.signature;const cmd=action.action_ref,delta=[dx,dy],prior=this.controls[cmd],refs=[before.observation_ref,after.observation_ref];let rebound:R|null=null;
  if(truth(prior)&&!same(prior.delta,delta)){
   if(control_revalidation){const raw_underlays=measureCurrentSupportUnderlays(first,second),facts=measurements(prior,this.epoch,delta,moved,raw_underlays,second),meaning=control_revalidation(facts);
    if(meaning.status==='unique'&&meaning.conclusions[0].status==='current_quantum_revalidation_candidate'){
     rebound={status:'current_quantum_revalidation_candidate',evidence:refs,measurements:facts.measurement,rule_ref:meaning.conclusions[0].rule_ref,prior_scope_method:{scope:prior.recalled_from_epoch,delta:clone(prior.delta),evidence:clone(prior.evidence)}};
     this.controls[cmd]={delta,evidence:[refs],contradictions:[],recalled_hypothesis:true,current_scope_candidate:true,observed_epoch:this.epoch,parameter_revalidation:rebound};this.metric_revalidation_epoch=this.epoch;this.events.push(clone(rebound));
    }else if(meaning.status==='unique'&&meaning.conclusions[0].status==='foreign_metric_withdrawn_current_input_unresolved'){
     rebound={status:'foreign_metric_withdrawn_current_input_unresolved',evidence:refs,measurements:facts.measurement,rule_ref:meaning.conclusions[0].rule_ref,prior_scope_method:{scope:prior.recalled_from_epoch,delta:clone(prior.delta),evidence:clone(prior.evidence)}};
     prior.withdrawn_epoch=this.epoch;prior.unresolved_current_scope=rebound;this.events.push(clone(rebound));
    }
   }
   if(rebound===null){prior.contradictions.push([before.observation_ref,after.observation_ref,delta]);return null;}
  }
  this.last_motion={after:after.observation_ref,command:cmd,delta};
  if(rebound!==null){/* The source preserves the current parameter-revalidation receipt. */}
  else if(truth(prior)){prior.evidence.push(refs);prior.recalled_hypothesis=false;prior.observed_epoch=this.epoch;prior.current_scope_candidate=false;delete prior.withdrawn_epoch;delete prior.unresolved_current_scope;}
  else this.controls[cmd]={delta,evidence:[refs],contradictions:[],observed_epoch:this.epoch};
  const [l,t,r,b]=moved.bbox,measured_underlays=measureCurrentSupportUnderlays(first,second).filter(item=>same(item.bbox,[t,l,b,r])&&same(item.translation_delta,[dy,dx]));if(measured_underlays.length!==1)return null;
  const under=[...measured_underlays[0]!.underlay_values],previous=this.underlays.get(key(moved.bbox))??{},before_body=find_body(before,this.core),retained=current_material_layers(new Map([[key(moved.bbox),previous]]),this.epoch,first,before_body?.bbox??null,this.core);
  this.underlays.set(key(moved.bbox),{values:under,evidence:refs,epoch:this.epoch,measurement:measured_underlays[0]});if(retained.length)this.underlays.get(key(moved.bbox))!.material_overlay=clone(previous.material_overlay);
  const projected=this.measure(after,second);
  if((projected.grids??[]).length===1){const hits=projected.grids[0].cells.filter((c:R)=>c.bbox.left<=l&&c.bbox.right>=r&&c.bbox.top<=t&&c.bbox.bottom>=b);if(hits.length===1){const cell=hits[0].bbox;Object.assign(this.underlays.get(key(moved.bbox))!,{cell_bbox:[cell.left,cell.top,cell.right,cell.bottom],patch:first.slice(cell.top,cell.bottom+1).map(row=>[...row.slice(cell.left,cell.right+1)])});}}
  return{motion:delta,body_bbox:moved.bbox,entered_underlay_values:[...new Set<number>(under)].sort((a,b)=>a-b),evidence:refs,parameter_revalidation:rebound};
 }
 measure(obs:R,rows:NativeRows):R{return this.measure_with_input(obs,rows)[0];}
 measure_with_input(obs:R,rows:NativeRows):[R,R|null]{
  const out:R={observation_ref:obs.observation_ref,level_epoch:obs.level_epoch,status:'unbound',release_authority:false};if(obs.level_epoch!==this.epoch||!truth(this.core))return[out,null];
  const body=find_body(obs,this.core),controls:R=Object.fromEntries(Object.entries(this.controls).filter(([k,v])=>!truth(v.contradictions)&&v.withdrawn_epoch!==this.epoch&&obs.available_action_refs.includes(k)&&(this.metric_revalidation_epoch!==this.epoch||v.observed_epoch===this.epoch)));
  if(body===null||!truth(controls))return[out,null];
  const components=detect_components(rows),under=this.underlays.get(key(body.bbox))??{},bbox=box(body.bbox);
  const value:R={frame:rows,components,available_action_refs:obs.available_action_refs,canonical_provisional_control_geometry_bboxes:[bbox],input_aligned_entity_bboxes:[bbox],known_action_translation_deltas:Object.entries(controls).map(([k,v])=>[k,v.delta[1],v.delta[0]]),current_input_aligned_underlay_values:under.values??[],observed_input_aligned_action_translation:this.last_motion&&this.last_motion.after===obs.observation_ref?[this.last_motion.command,this.last_motion.delta[1],this.last_motion.delta[0]]:null,periodic_cell_grids:{candidates:[],enumeration_truncated:false,schema_version:'yf_arc3_v5.periodic_cell_grid_result.v1'}};
  const grids=_action_quantized_route_grid_candidates(value);value.periodic_cell_grids={...value.periodic_cell_grids,candidates:grids};const relations=_edge_display_exact_complement_cell_measurements(value,grids);
  out.unresolved_current_controls=Object.fromEntries(Object.entries(this.controls).filter(([_k,v])=>v.withdrawn_epoch===this.epoch&&truth(v.unresolved_current_scope)).map(([k,v])=>[k,clone(v.unresolved_current_scope)]));out.rejected_interface_commands=Object.entries(this.controls).filter(([_k,v])=>truth(v.contradictions)).map(([k])=>k);out.displayed_candidate=truth(this.displayed)&&display_matches(this.displayed!,rows)?clone(this.displayed):null;
  out.support_effect_scope=measure_effect_scope(components,this.underlays,this.epoch,body.bbox,obs.observation_ref);
  Object.assign(out,{status:grids.length===1?'measured':'ambiguous_lattice',body:body.bbox,body_signature:this.core,controls,grids:grids.map(public_grid),retained_underlay_value_count:_current_action_quantized_control_cell_retained_underlay_value_count(value),underlay_evidence:under,retained_material_surfaces:current_material_layers(this.underlays,this.epoch,rows,body.bbox,this.core),display_complements:relations});return[out,value];
 }
}
