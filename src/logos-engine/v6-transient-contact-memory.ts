/** Exact current-frame relocation of retained public trajectory measurements.
 * Native transfer of transient_contact_memory.py; no inherited action license.
 */
import { supportParts,supportSame,supportCompare } from './v6-support-measurements.ts';
import { symbolicDigest } from './v6-hash.ts';
import { ballisticContactClick,measureScalarFillDisplay,transientCenterTwice } from './v6-transient-measurements.ts';
import type { NativeRows } from './v6-native-types.ts';
type R=Record<string,any>;
export const transientSignature=(c:R):string=>symbolicDigest([c.value,c.relative_pixels]);
const serialize=(c:R):R=>({...structuredClone(c),bbox:{top:c.bbox.top,left:c.bbox.left,bottom:c.bbox.bottom,right:c.bbox.right}});
const hydrate=(c:R):R=>({...c,bbox:{...c.bbox,height:c.bbox.bottom-c.bbox.top+1,width:c.bbox.right-c.bbox.left+1}});
const gcd=(a:number,b:number):number=>{while(b)[a,b]=[b,a%b];return a;};

export function acquireTransientCurve(rows:NativeRows,frames:readonly NativeRows[],measurement:R,epoch:number,evidence:readonly string[],command:R,retainedModels:readonly R[]=[]):R|null{
  if(!measurement.unique_moving_transient_component_path_present||!measurement.unique_transient_path_curved)return null;
  const components=supportParts(rows),old=new Map(components.map(c=>[c.component_id,c])),source=old.get(measurement.unique_transient_path_source_component_ref);let peer=old.get(measurement.unique_transient_path_source_morphology_peer_ref),binding='current_measured_peer';
  if(!peer){const signatures=new Set(retainedModels.map(m=>m.peer_signature)),matches=components.filter(c=>signatures.has(transientSignature(c))&&(!source||c.component_id!==source.component_id));if(matches.length===1){peer=matches[0]!;binding='retained_peer_exactly_revalidated_in_current_frame';}}
  if(!source||!peer)return null;const track:R[]=[];let expected=[measurement.unique_transient_path_start_center_row_twice,measurement.unique_transient_path_start_center_column_twice];
  for(const frame of frames){const candidates=supportParts(frame).filter(c=>c.value===measurement.unique_transient_path_palette_value&&!c.touches_frame_boundary&&c.area>0&&c.area<=128);if(!candidates.length)break;
    const distances=candidates.map(c=>{const p=transientCenterTwice(c);return{distance:(p[0]!-expected[0])**2+(p[1]!-expected[1])**2,c};}),distance=Math.min(...distances.map(v=>v.distance)),nearest=distances.filter(v=>v.distance===distance);if(nearest.length!==1)return null;const chosen=nearest[0]!.c;
    if(!track.length&&!supportSame(transientCenterTwice(chosen),expected))return null;track.push(chosen);expected=transientCenterTwice(chosen);
  }
  if(track.length!==measurement.unique_transient_path_frame_count)return null;const sourceCenter=transientCenterTwice(source),fill=measureScalarFillDisplay(rows),aim=[2*command.data.y-sourceCenter[0]!,2*command.data.x-sourceCenter[1]!];
  return{model_ref:'transient-fit:'+symbolicDigest([epoch,evidence]),acquisition_epoch:epoch,status:'conditional_model',source_signature:transientSignature(source),peer_signature:transientSignature(peer),peer_binding:binding,source_center_twice:sourceCenter,source_template:serialize(source),aim_delta_twice:aim,track:track.map(serialize),fill,evidence:[...evidence],scope:'Measured frame-order curve. Across epochs same recognizable occurrences and displayed parameter support only a falsifiable hypothesis, never inherited action authority.'};
}
export function transientSourceRoleProbe(model:R,rows:NativeRows):R|null{
  if(!('source_template'in model))return null;const current=supportParts(rows),peers=current.filter(c=>transientSignature(c)===model.peer_signature);if(peers.length!==1)return null;const old=hydrate(model.source_template),candidates=current.filter(c=>c.component_id!==peers[0]!.component_id&&c.value===old.value&&old.area*2<=c.area*3&&c.area*3<=old.area*5&&Math.max(c.bbox.width,c.bbox.height)<=Math.max(old.bbox.width,old.bbox.height)*2&&c.area*2>=c.bbox.width*c.bbox.height&&!c.touches_frame_boundary);if(candidates.length!==1)return null;
  const source=candidates[0]!,[dy,dx]=model.aim_delta_twice,divisor=gcd(Math.abs(dy),Math.abs(dx));if(!divisor)return null;const uy=dy/divisor,ux=dx/divisor,origin=transientCenterTwice(source),points:any[][]=[];
  for(let k=1;k<Math.max(rows.length,rows[0]!.length)*2;k++){const y=origin[0]!+k*uy,x=origin[1]!+k*ux;if(y%2||x%2)continue;if(y/2>=0&&y/2<rows.length&&x/2>=0&&x/2<rows[0]!.length)points.push([Math.abs(k-divisor),k,{x:x/2,y:y/2}]);}
  if(!points.length)return null;points.sort((a,b)=>supportCompare(a.slice(0,2),b.slice(0,2)));return{point:points[0]![2],source_candidate:source.component_id,recognized_peer:peers[0]!.component_id,source_identity:'unconfirmed_compatible_shape',acquired_model_ref:model.model_ref,scope:'Same retained material and compatible compact geometry near an exactly recognized peer suggest a source role only. The next transient origin must confirm or refute this candidate.'};
}
export function transientCalibration(model:R,rows:NativeRows):R|null{
  const current=supportParts(rows),sources=current.filter(c=>transientSignature(c)===model.source_signature),peers=current.filter(c=>transientSignature(c)===model.peer_signature);if(sources.length!==1||peers.length!==1)return null;const point=transientCenterTwice(sources[0]!).map((a,i)=>a+model.aim_delta_twice[i]);if(point.some(v=>v%2))return null;const[y,x]=point.map(v=>v/2);return y!>=0&&y!<rows.length&&x!>=0&&x!<rows[y!]!.length?{x,y}:null;
}
export function projectTransientCurve(model:R,rows:NativeRows):R{
  const current=supportParts(rows),sources=current.filter(c=>transientSignature(c)===model.source_signature),peers=current.filter(c=>transientSignature(c)===model.peer_signature);if(sources.length!==1||peers.length!==1)return{status:'unknown',reason:'current_source_peer_not_unique'};
  const fill=measureScalarFillDisplay(rows);if(fill.scalar_fill_count!==model.fill.scalar_fill_count||!fill.scalar_fill_display_present)return{status:'unknown',reason:'current_display_parameter_differs'};
  const source=sources[0]!,peer=peers[0]!,delta=transientCenterTwice(source).map((a,i)=>a-model.source_center_twice[i]);if(delta.some(v=>v%2))return{status:'unknown',reason:'nonintegral_retained_support_translation'};const[dy,dx]=delta.map(v=>v/2);
  const track=model.track.map((raw:R)=>{const c=hydrate(raw);return{...c,pixels:c.pixels.map(([y,x]:number[])=>[y!+dy!,x!+dx!]),bbox:{...c.bbox,top:c.bbox.top+dy!,left:c.bbox.left+dx!,bottom:c.bbox.bottom+dy!,right:c.bbox.right+dx!}};});
  const[contact,disclosure]=ballisticContactClick(track,source,peer,current,rows);return{status:'measured',contact_solution:contact,curve_disclosure:disclosure,source_ref:source.component_id,peer_ref:peer.component_id,model_ref:model.model_ref,acquisition_epoch:model.acquisition_epoch,scope:'Old measured curve translated to current recognized source; current terrain and peer recomputed. Model utility and terminal role remain hypotheses.'};
}
