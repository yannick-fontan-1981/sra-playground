/** V6 geometric support scope and remote changes; no HUD or game roles. */
import { clone,digest,key,measure_contour_domain,revalidate_frame,type R } from './v6-inventory-measurements.ts';
import { pythonEqual as same,pythonTruthy as truth } from './v6-operations.ts';
import type { NativeRows } from './v6-native-types.ts';
export const inside=(b:readonly number[],o:readonly number[]):boolean=>o[0]!<=b[0]!&&b[0]!<=b[2]!&&b[2]!<=o[2]!&&o[1]!<=b[1]!&&b[1]!<=b[3]!&&b[3]!<=o[3]!;
const distinct=<T>(values:T[]):T[]=>[...new Set(values)];
export function measure(components:R,underlays:Map<string,R>,epoch:number|null,body:number[],observation:string):R|null{
 const candidates:R[]=[];
 for(const component of components.components){
  const box=[component.bbox.left,component.bbox.top,component.bbox.right,component.bbox.bottom];if(!inside(body,box))continue;
  const supports=[...underlays].map(([bbox,entry])=>[bbox.split(',').map(Number),entry] as [number[],R]).filter(([bbox,entry])=>entry.epoch===epoch&&truth(entry.evidence)&&new Set(entry.values??[]).size===1&&(entry.values??[]).includes(component.value)&&inside(bbox,box));
  if(new Set(supports.map(([bbox])=>key(bbox))).size<2)continue;
  const domain=measure_contour_domain(component);if(!domain?.exact_rectangular_domain)continue;
  const [l,t,r,b]=box,perimeter:number[][]=[];for(let y=t!;y<=b!;y++)for(let x=l!;x<=r!;x++)if(x===l||x===r||y===t||y===b)perimeter.push([x,y,component.value]);
  const points=new Set(component.relative_pixels.map(([r,c]:number[])=>key([component.bbox.left+c!,component.bbox.top+r!])));if(perimeter.some(([x,y])=>!points.has(key([x!,y!]))))continue;
  candidates.push({bbox:box,value:component.value,perimeter,level_epoch:epoch,observation_ref:observation,domain_digest:domain.domain_digest,entered_positions:supports.length,evidence:distinct([...supports.flatMap(([_bbox,e])=>e.evidence),observation]),qualification:'unique_closed_domain_of_repeated_entered_support_not_a_universal_playfield_or_collision_law'});
 }
 return candidates.length===1?candidates[0]!:null;
}
export function revalidate_domain(domain:R,rows:NativeRows,occluders:number[][]=[]):R|null{
 const frame={bbox:domain.bbox,palette_value:domain.value,corner_value:domain.value},perimeter=domain.current_perimeter??domain.perimeter,edits=perimeter.filter(([_x,_y,v]:number[])=>v!==domain.value).map(([x,y]:number[])=>[x,y,x,y]);
 const current=revalidate_frame(frame,rows,[...occluders,...edits]);if(!current)return null;
 for(const [x,y,value]of perimeter){if(occluders.some(([l,t,r,b])=>l!<=x&&x<=r!&&t!<=y&&y<=b!))continue;if(rows[y]![x]!==value)return null;}
 return {...current,retained_edits_revalidated:edits.length};
}
export function contrast(domain:R|null,before:R,after:R,first:NativeRows,second:NativeRows,allowed:number[][],body:number[]):R|null{
 if(!truth(domain)||domain!.level_epoch!==before.level_epoch||before.level_epoch!==after.level_epoch||!inside(body,domain!.bbox))return null;
 const before_contour=revalidate_domain(domain!,first,allowed.length>1?[allowed[1]!]:[]),after_contour=revalidate_domain(domain!,second,allowed);if(!before_contour||!after_contour)return null;
 const interior:number[][]=[],remote:number[][]=[];
 for(let y=0;y<first.length;y++)for(let x=0;x<first[y]!.length;x++){const v=first[y]![x]!;if(v===second[y]![x]||allowed.some(([l,t,r,b])=>l!<=x&&x<=r!&&t!<=y&&y<=b!))continue;(inside([x,y,x,y],domain!.bbox)?interior:remote).push([x,y,v,second[y]![x]!]);}
 if(!remote.length)return null;
 return {unauthorized_domain_changes:interior.length,remote_effects:{status:'unexplained_changes_outside_current_measured_support_domain',count:remote.length,bbox:[Math.min(...remote.map(p=>p[0]!)),Math.min(...remote.map(p=>p[1]!)),Math.max(...remote.map(p=>p[0]!)),Math.max(...remote.map(p=>p[1]!))],delta_sha256:digest(remote),evidence:[before.observation_ref,after.observation_ref],unknown:['role','causal_necessity','relation_to_goal']},domain_ref:domain!.domain_digest,current_contour_revalidation:{before:before_contour,after:after_contour,authorized_regions:allowed,qualification:'same_measured_domain_outside_current_authorized_contact_regions'}};
}
export function recall(record:R|null,scene:R,obs:R,rows:NativeRows):R|null{
 if(!truth(record)||!truth(record!.active))return null;const domain=record!.domain;
 if(domain.level_epoch!==obs.level_epoch){Object.assign(record!,{active:false,refutation:{reason:'scope_changed',observation_ref:obs.observation_ref}});return null;}
 if(record!.body_signature!==scene.body_signature||!inside(scene.body,domain.bbox))return null;
 const current=revalidate_domain(domain,rows,[scene.body]);if(!current){Object.assign(record!,{active:false,refutation:{reason:'current_visible_perimeter_contradiction_or_insufficient_anchor',observation_ref:obs.observation_ref}});return null;}
 return {...clone(domain),observation_ref:obs.observation_ref,evidence:distinct([...record!.evidence,obs.observation_ref]),retained_domain_revalidation:{source_observation:record!.after,current,status:'current_perimeter_revalidated_hypothesis'}};
}
export function retain(proposal:R,index:number,before:R,after:R,second:NativeRows,outcome:R,prior:R|null=null):R|null{
 if(before.level_epoch!==after.level_epoch)return null;const offer=proposal.inventory_plan?.offer??{},domain=offer.scene?.support_effect_scope;
 if(!truth(domain)||!(outcome.matched===true||outcome.preservation_matched===true))return null;
 const step=proposal.steps[index],expected=step.expected_after,body=truth(expected)?expected.body_bbox:step.body_before;if(domain.perimeter.some(([x,y]:number[])=>inside([x!,y!,x!,y!],body)))return null;
 const keys=['bbox','value','perimeter','level_epoch','domain_digest','qualification'],kept:R=Object.fromEntries(keys.map(k=>[k,clone(domain[k])]));kept.current_perimeter=domain.perimeter.map(([x,y]:number[])=>[x,y,second[y!]![x!]]);if(!revalidate_domain(kept,second))return null;
 let acquisition=clone(domain.acquisition??null);
 if(!truth(acquisition)&&truth(prior)&&truth(prior!.active)&&prior!.body_signature===offer.scene.body_signature&&['bbox','value','level_epoch','domain_digest'].every(k=>same(prior!.domain[k],domain[k])))acquisition=clone(prior!.domain.acquisition??null);
 if(!truth(acquisition)){if(truth(domain.retained_domain_revalidation))return null;const source=Object.fromEntries(keys.map(k=>[k,domain[k]]));acquisition={observation_ref:domain.observation_ref,evidence:clone(domain.evidence??[]),domain_digest:domain.domain_digest,source_measurement_sha256:digest(source),source_kind:'measured_complete_closed_support_contour'};}
 const recent=distinct([...(domain.revalidation_evidence??[]),before.observation_ref,after.observation_ref]).slice(-32),evidence=distinct([...acquisition.evidence,acquisition.observation_ref,...recent]);Object.assign(kept,{acquisition,revalidation_evidence:recent,evidence,observation_ref:after.observation_ref});
 return {active:true,domain:kept,body_signature:offer.scene.body_signature,evidence,after:after.observation_ref,qualification:'observed_authorized_effect_kept_separate_from_future_action_permission'};
}
