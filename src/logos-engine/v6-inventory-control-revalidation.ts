/** V6 current quantum evidence; forward appearance does not prove collision. */
import { pythonEqual as same, pythonTruthy as truth } from './v6-operations.ts';
import type { R } from './v6-inventory-measurements.ts';
import type { NativeRows } from './v6-native-types.ts';
export function measurements(prior:R,epoch:number|null,delta:number[],moved:R,underlays:R[],rows:NativeRows):R{
 const [l,t,r,b]=moved.bbox,[dx,dy]=delta,old=prior.delta;
 const matches=underlays.filter(z=>same(z.bbox,[t,l,b,r])&&same(z.translation_delta,[dy,dx]));
 const values=new Set<number>(matches.length===1?matches[0]!.underlay_values:[]),ux=Math.sign(dx!),uy=Math.sign(dy!),points:number[][]=[];
 for(let y=t+uy;y<=b+uy;y++)for(let x=l+ux;x<=r+ux;x++)if(!(l<=x&&x<=r&&t<=y&&y<=b))points.push([x,y]);
 const visible=points.length>0&&points.every(([x,y])=>0<=y!&&y!<rows.length&&0<=x!&&x!<rows[y!]!.length),forward=visible&&values.size===1&&points.every(([x,y])=>values.has(rows[y!]![x!]!)),same_direction=(dx===0)===(old[0]===0)&&(dy===0)===(old[1]===0)&&dx!*old[0]+dy!*old[1]>0;
 return {current_scope_and_observation:true,prior_is_foreign_scope_hypothesis:truth(prior.recalled_hypothesis)&&prior.recalled_from_epoch!=null&&prior.recalled_from_epoch!==epoch&&prior.observed_epoch!==epoch,current_unique_axial_body_translation:(dx===0)!==(dy===0),current_direction_concordant:same_direction,current_entry_underlay_unique:matches.length===1&&values.size===1,forward_boundary_unindicated:forward,current_quantum_differs:!same(old,delta),current_quantum_candidate_supported:same_direction&&matches.length===1&&values.size===1&&forward,measurement:{current_delta:delta,prior_delta:old,body_bbox:[...moved.bbox],forward_strip_visible:visible,forward_strip_same_as_measured_entry:forward,unknown:['collision_law','universality_of_new_quantum','unobserved_directions']}};
}
