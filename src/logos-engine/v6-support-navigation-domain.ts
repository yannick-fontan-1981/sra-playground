/** Finite support witnesses under the original explicitly supplied DRM models.
 * Transfer of V5 support_navigation_domain.measure_support_navigation_domain.
 * This geometric calculator neither grants roles nor authorizes an action.
 */
import { v6Canonical } from './v6-native-observer.ts';
import type { NativeRows } from './v6-native-types.ts';
import { contained, intersects, measureSupportOrthogonalBands, measureSupportTranslationLattices, measureSupportValuedMaskPoses,
  pointSet, rectangularPoints, sortedPoints, supportCompare, supportKey, supportParts, supportPoint, supportSame, supportShape,
  supportSignature } from './v6-support-measurements.ts';
import type { SupportRecord as R } from './v6-support-measurements.ts';
export interface SupportNavigationDomainInput {
  frame:NativeRows;components:readonly R[];memory:R;associations:readonly R[];contract:R;availableActions:readonly string[];
  currentInputAlignedUnderlayValues?:readonly number[];inputAlignedEntityBboxes?:readonly R[];currentTranslationUnderlayRows?:readonly R[];
}
export function measureSupportNavigationDomain(input:SupportNavigationDomainInput):R {
  let {frame}=input;const {components,memory,associations,contract,availableActions}=input;
  const empty={complete:false,witness_present:false},height=frame.length,width=frame[0]!.length;
  if(height*width>contract.maximum_pixels||components.length>contract.maximum_components)throw new TypeError('support dependency observation bound exceeded');
  if(frame.some(row=>row.length!==width))throw new TypeError('ragged observation');
  const byref=new Map(associations.map(r=>[r.term_ref,r])),moving=memory.moving_association_refs??[],fixed=memory.fixed_association_refs??[],controlRefs:string[]=memory.control_association_refs;
  if(moving.length!==1||fixed.length!==1||[...moving,...fixed,...controlRefs].some(ref=>!byref.has(ref)))return empty;
  const sprite=(c:R):number[][]=>c.valued_pixels?c.valued_pixels.map(([r,s,v]:number[])=>[r!-c.bbox.top,s!-c.bbox.left,v!]).sort(supportCompare):supportSignature(c);
  const shape=(c:R):number[][]=>sprite(c).map(([r,s])=>[r!,s!]);
  const matches=(row:R):R[]=>{
    const signature=row.normalized_valued_pixels;
    if(controlRefs.includes(row.term_ref)&&new Set(signature.map((p:number[])=>p[2])).size>1&&contract.composed_control_pose_model_ref)return measureSupportValuedMaskPoses(frame,signature,contract.composed_control_quarter_turns,contract.maximum_pixels,contract.maximum_components);
    return components.filter(c=>supportSame(sprite(c),signature));
  };
  const actors=matches(byref.get(moving[0])!),targets=matches(byref.get(fixed[0])!);if(actors.length!==1||targets.length!==1)return empty;
  const actor=actors[0]!,target=targets[0]!,h=actor.bbox.height,w=actor.bbox.width;
  let calibrations:R[]=memory.observed_lattice_calibration_rows??[];
  if(!calibrations.length&&contract.recalled_unit_translation_lattice_model_ref){const translations=memory.observed_command_translation_rows??[];
    if(translations.length&&translations.every((row:R)=>row.translation_is_unique===true&&supportSame(row.source_actor_extent??[],[h,w])&&(row.observed_delta_rows??[]).length===1&&row.dispatch_record_refs?.length))calibrations=measureSupportTranslationLattices([actor.bbox],translations.map((row:R)=>row.observed_delta_rows[0])).map(([rh,cw,rp,cp])=>({row_pitch:rh,col_pitch:cw,row_phase:rp,col_phase:cp}));
  }
  if(calibrations.length!==1)return empty;const cal=calibrations[0]!;
  if(!supportSame([cal.row_pitch,cal.col_pitch,cal.row_phase,cal.col_phase],[h,w,actor.bbox.top%h,actor.bbox.left%w]))return empty;
  const ro=cal.row_phase,co=cal.col_phase;if((target.bbox.top-ro)%h||(target.bbox.left-co)%w)return empty;
  const learnedControls=controlRefs.map(ref=>byref.get(ref)!),shapes=new Set(learnedControls.map(row=>v6Canonical(row.normalized_valued_pixels.map(([r,c]:number[])=>[r,c]))));
  const controls=[...components.filter(c=>shapes.has(v6Canonical(shape(c)))),...learnedControls.filter(row=>new Set(row.normalized_valued_pixels.map((p:number[])=>p[2])).size>1).flatMap(matches)];
  const excluded=pointSet(controls.flatMap(c=>c.pixels)),pointsByCell=new Map<string,number[][]>();
  for(let r=0;r<Math.floor((height-ro)/h);r++)for(let c=0;c<Math.floor((width-co)/w);c++){const points:number[][]=[];for(let dr=0;dr<h;dr++)for(let dc=0;dc<w;dc++)points.push([ro+r*h+dr,co+c*w+dc]);pointsByCell.set(supportKey([r,c]),points);}
  let patterns=new Map<string,number[]>([...pointsByCell].map(([p,points])=>[p,points.map(([r,c])=>frame[r!]![c!]!)]));
  const entered=new Set<string>((memory.observed_entered_surface_rows??[]).map((row:R)=>v6Canonical(row.before_pattern)));
  const models:string[]=contract.surface_models,actorPixels=pointSet(actor.pixels);let supportComponents=components;
  let underlay=[...(input.currentInputAlignedUnderlayValues??[])],underlayBound=supportSame(input.inputAlignedEntityBboxes??[],[actor.bbox]);
  if(models.includes('current_exact_translation_actor_underlay')){
    const actorBox=[actor.bbox.top,actor.bbox.left,actor.bbox.bottom,actor.bbox.right];const exact=(input.currentTranslationUnderlayRows??[]).filter(row=>row.component_ref===actor.component_id&&supportSame(row.bbox,actorBox));
    if(exact.length===1){underlay=[...exact[0]!.underlay_values];underlayBound=true;}
  }
  if(models.includes('current_measured_homogeneous_actor_underlay')&&underlay.length===1&&underlayBound&&underlay[0]!==actor.value&&entered.has(v6Canonical(Array(h*w).fill(underlay[0])))){
    const restored=frame.map(row=>[...row]);for(const [r,c]of actor.pixels)restored[r]![c]=underlay[0]!;frame=restored;supportComponents=supportParts(restored);if(supportComponents.length>contract.maximum_components)return empty;
    patterns=new Map([...pointsByCell].map(([p,points])=>[p,points.map(([r,c])=>frame[r!]![c!]!)]));
  }
  const rectangles:{component:R;pixels:Set<string>}[]=[];
  for(const c of supportComponents){const pixels=pointSet(c.pixels);if(pixels.size===actorPixels.size&&contained(pixels,actorPixels))continue;
    if(c.bbox.height%h||c.bbox.width%w||(c.bbox.top-ro)%h||(c.bbox.left-co)%w||intersects(pixels,excluded))continue;
    const box=pointSet(rectangularPoints(c.bbox)),missing=new Set([...box].filter(p=>!pixels.has(p)));
    const full=c.area===box.size&&models.includes('complete_rectangular_cell_union'),occluded=missing.size>0&&contained(missing,actorPixels)&&models.includes('actor_occluded_rectangle');
    if(full||occluded)rectangles.push({component:c,pixels:box});
  }
  for(const [p,points]of pointsByCell){const mask=pointSet(points);if(!intersects(mask,actorPixels))continue;const values=new Set(rectangles.filter(r=>contained(mask,r.pixels)).map(r=>r.component.value));if(values.size===1)patterns.set(p,Array(h*w).fill([...values][0]));}
  const rectanglePixels=new Set(rectangles.flatMap(r=>[...r.pixels]));
  const surface=new Set([...patterns].filter(([p,pat])=>models.includes('observed_entered_pattern')&&entered.has(v6Canonical(pat))||pointsByCell.get(p)!.every(q=>rectanglePixels.has(supportKey(q)))).map(([p])=>p));
  const start=[Math.floor((actor.bbox.top-ro)/h),Math.floor((actor.bbox.left-co)/w)],terminal=[Math.floor((target.bbox.top-ro)/h),Math.floor((target.bbox.left-co)/w)];surface.add(supportKey(terminal));
  const proxies:{ref:string;component:R}[]=[];
  if(contract.permission_models.includes('missing_control_smaller_same_palette_band_homologue_contact'))for(const row of learnedControls){if(matches(row).length)continue;
    const pixels=row.normalized_valued_pixels.map(([r,c]:number[])=>[r,c]),signature=measureSupportOrthogonalBands(pixels).oriented_signature,values=new Set(row.normalized_valued_pixels.map((p:number[])=>p[2]));if(values.size!==1)continue;
    for(const c of components)if(values.has(c.value)&&c.pixels.length<pixels.length&&measureSupportOrthogonalBands(c.pixels).oriented_signature===signature)proxies.push({ref:row.term_ref,component:c});
  }
  const proxyCells=new Map<string,Set<string>>();for(const {ref,component:c}of proxies){const cells=proxyCells.get(ref)??new Set<string>(),mask=pointSet(c.pixels);
    for(const [p,points]of pointsByCell){if(!points.some(q=>mask.has(supportKey(q))))continue;const remaining=new Set(points.filter(q=>!mask.has(supportKey(q))).map(([r,s])=>frame[r!]![s!]!));
      if(remaining.size===1&&entered.has(v6Canonical(Array(h*w).fill([...remaining][0])))&&models.includes('entered_pattern_occluded_by_homologous_item')){surface.add(p);cells.add(p);}}
    proxyCells.set(ref,cells);
  }
  const operators:R[]=[],effectModels:string[]=contract.effect_models;
  for(const row of learnedControls){const effects=(memory.observed_remote_effect_rows??[]).filter((e:R)=>e.control_association_ref===row.term_ref&&e.typed_transition_measurements).map((e:R)=>e.typed_transition_measurements);
    const fits=new Map<string,{key:any[];fit:R}>();for(const e of effects)if(e.rigid_fit_enumeration_complete)for(const f of e.rigid_fit_rows){const key=['changed_value','pivot_value','pivot_height','pivot_width','quarter_turns_clockwise'].map(k=>[k,f[k]]);fits.set(v6Canonical(key),{key,fit:f});}
    const present=matches(row);if(present.length>1)return empty;
    for(const {fit:f}of [...fits.values()].sort((a,b)=>supportCompare(a.key,b.key))){if(!effectModels.includes('observed_quarter_turn_fit'))continue;
      for(const {component:pivot}of rectangles){if(!supportSame([pivot.value,pivot.bbox.height,pivot.bbox.width],[f.pivot_value,f.pivot_height,f.pivot_width]))continue;
        const pixels=new Set(rectangles.filter(r=>r.component.value===f.changed_value).flatMap(r=>[...r.pixels]));
        if(pixels.size)operators.push({kind:'rotation',pivot,pixels,step:f.quarter_turns_clockwise,control:present[0]??null,required_ref:present.length?null:row.term_ref,period:4,model_ref:'observed_quarter_turn_fit',unobserved:false});
      }
    }
    const swaps=new Map<string,number[]>();for(const e of effects)for(const t of e.cell_transition_rows)if((entered.has(v6Canonical(t.before_pattern))||entered.has(v6Canonical(t.after_pattern)))&&new Set(t.before_pattern).size!==new Set(t.after_pattern).size)swaps.set(v6Canonical(t.before_pattern),t.after_pattern);
    const positions=new Set([...patterns].filter(([p,pat])=>swaps.has(v6Canonical(pat))&&!pointsByCell.get(p)!.some(q=>excluded.has(supportKey(q)))).map(([p])=>p));
    if(swaps.size&&positions.size&&present.length===1&&effectModels.includes('observed_cell_pattern_exchange')){
      if([...swaps].some(([p,pat])=>!supportSame(swaps.get(v6Canonical(pat))??null,JSON.parse(p))))continue;
      operators.push({kind:'pattern_swap',positions,swaps,control:present[0],required_ref:null,period:2,model_ref:'observed_cell_pattern_exchange',unobserved:false});
    }
  }
  const known=new Set(learnedControls.map(r=>v6Canonical(r.normalized_valued_pixels)));
  if(effectModels.includes('control_shape_and_pivot_palette_assembly_quarter_turn'))for(const control of controls){if(known.has(v6Canonical(sprite(control))))continue;
    for(const {component:pivot}of rectangles){if(pivot.value!==control.value)continue;const arms=rectangles.filter(({component:c})=>{
      const horizontal=c.bbox.top===pivot.bbox.top&&c.bbox.height===pivot.bbox.height&&(c.bbox.right+1===pivot.bbox.left||pivot.bbox.right+1===c.bbox.left);
      const vertical=c.bbox.left===pivot.bbox.left&&c.bbox.width===pivot.bbox.width&&(c.bbox.bottom+1===pivot.bbox.top||pivot.bbox.bottom+1===c.bbox.top);return horizontal||vertical;});
      if(arms.length===2&&arms[0]!.component.value===arms[1]!.component.value)operators.push({kind:'rotation',pivot,pixels:new Set(arms.flatMap(a=>[...a.pixels])),step:1,control,required_ref:null,period:4,model_ref:'control_shape_and_pivot_palette_assembly_quarter_turn',unobserved:true});
    }
  }
  if(!operators.length||operators.length>contract.maximum_operators)return empty;
  const requiredRefs=[...proxyCells.keys()].sort(),cache=new Map<string,Set<string>>();
  const supports=(config:number[]):Set<string>=>{const key=v6Canonical(config),cached=cache.get(key);if(cached)return cached;const cells=new Set(surface);
    for(const op of operators){const removed:Set<string>=op.kind==='pattern_swap'?op.positions:new Set(sortedPoints(op.pixels).map(([r,c])=>supportKey([Math.floor((r!-ro)/h),Math.floor((c!-co)/w)])));for(const p of removed)cells.delete(p);}
    for(let i=0;i<operators.length;i++){const op=operators[i]!,q=config[i]!;
      if(op.kind==='pattern_swap'){for(const p of op.positions){const pat=q===0?patterns.get(p):op.swaps.get(v6Canonical(patterns.get(p)));if(entered.has(v6Canonical(pat)))cells.add(p);}}
      else{const pivot=op.pivot,pr=pivot.bbox.top+pivot.bbox.bottom,pc=pivot.bbox.left+pivot.bbox.right,pixels=new Set<string>();for(const [r,c]of sortedPoints(op.pixels)){let rr=2*r!-pr,cc=2*c!-pc;for(let n=0;n<q;n++)[rr,cc]=[cc,-rr];if((rr+pr)%2||(cc+pc)%2)continue;pixels.add(supportKey([(rr+pr)/2,(cc+pc)/2]));}
        for(const [p,points]of pointsByCell)if(points.every(q=>pixels.has(supportKey(q))))cells.add(p);
      }
    }cache.set(key,cells);return cells;
  };
  type State={pos:number[];config:number[];acquired:bigint};type Edge=[string,string|number,number[]];
  const initial:State={pos:start,config:operators.map(()=>0),acquired:0n};if(!supports(initial.config).has(supportKey(start)))return empty;
  const stateKey=(s:State)=>`${supportKey(s.pos)}|${supportKey(s.config)}|${s.acquired.toString()}`;
  const search=(disabled:number|null=null,keepPath=false):[boolean,boolean,Edge[],number]=>{
    const pending:State[]=[initial],parents=new Map<string,{prior:string;edge:Edge}|null>([[stateKey(initial),null]]);let end:string|null=null;
    for(let head=0;head<pending.length;head++){
      const state=pending[head]!,{pos,config,acquired}=state;if(supportSame(pos,terminal)){end=stateKey(state);break;}
      const successors:{state:State;edge:Edge}[]=[];
      for(const [action,delta]of (Object.entries(contract.interface_steps) as [string,number[]][]).sort((a,b)=>supportCompare(a[0],b[0]))){if(!availableActions.includes(action))continue;const p=[pos[0]!+delta[0]!,pos[1]!+delta[1]!];if(supports(config).has(supportKey(p))){let flags=acquired;for(const [bit,ref]of requiredRefs.entries())if(proxyCells.get(ref)!.has(supportKey(p)))flags|=1n<<BigInt(bit);successors.push({state:{pos:p,config,acquired:flags},edge:['step',action,p]});}}
      for(const [i,op]of operators.entries()){if(disabled===i||!availableActions.includes(contract.point_action_ref))continue;const ref:string|null=op.required_ref,bit=ref?requiredRefs.indexOf(ref):-1;
        if(ref&&(bit<0||!(acquired&(1n<<BigInt(bit)))))continue;const following=[...config];following[i]=(following[i]!+(op.step??1))%op.period;
        if(supports(config).has(supportKey(pos))&&supports(following).has(supportKey(pos)))successors.push({state:{pos,config:following,acquired},edge:['transform',i,pos]});
      }
      for(const next of successors){const key=stateKey(next.state);if(parents.has(key))continue;if(parents.size>=contract.maximum_states)return [false,false,[],parents.size];parents.set(key,keepPath?{prior:stateKey(state),edge:next.edge}:null);pending.push(next.state);}
    }
    const found=end!==null,path:Edge[]=[];if(keepPath&&end!==null){let item=parents.get(end);while(item){path.push(item.edge);item=parents.get(item.prior);}path.reverse();}return [true,found,path,parents.size];
  };
  const [complete,found,path,states]=search(null,true);if(!complete||!found||!path.length)return {complete,witness_present:false,tested_states:states};
  const counterfactual:R[]=[];for(let i=0;i<operators.length;i++){const [done,reached,,count]=search(i);counterfactual.push({operation_index:i,complete:done,terminal_reachable_without_operation:reached,tested_states:count});}
  const first=path[0]!;let point:number[]|null=null,actionRef:string|number=first[1];if(first[0]==='transform'){const c=operators[first[1] as number]!.control;if(c===null)return empty;point=[c.bbox.left+Math.floor(c.bbox.width/2),c.bbox.top+Math.floor(c.bbox.height/2)];actionRef=contract.point_action_ref;}
  const witnessRequiredRefs=[...new Set(path.filter(row=>row[0]==='transform'&&operators[row[1] as number]!.required_ref).map(row=>operators[row[1] as number]!.required_ref))].sort();
  const actionRefs:string[]=[],payloads:R[]=[],seriesRows:Edge[]=[];let seriesBoundary='terminal';
  for(const row of path){if(actionRefs.length>=(contract.maximum_executable_series_actions??128)){seriesBoundary='declared_action_bound';break;}let action:string,payload:R;
    if(row[0]==='transform'){const control=operators[row[1] as number]!.control;if(control===null){seriesBoundary='unbound_control_payload';break;}action=contract.point_action_ref;payload={x:control.bbox.left+Math.floor(control.bbox.width/2),y:control.bbox.top+Math.floor(control.bbox.height/2)};}
    else {action=row[1] as string;payload={};}actionRefs.push(action);payloads.push(payload);seriesRows.push(row);
  }
  return {complete,witness_present:true,tested_states:states,configuration_count:cache.size,path_length:path.length,path_rows:path,first_action_ref:actionRef,first_point:point,first_operation_index:first[0]==='transform'?first[1]:null,first_destination_cell:first[2],actor_start_cell:start,terminal_cell:terminal,
    counterfactual_rows:counterfactual,proxy_count:proxies.length,witness_required_missing_control_refs:witnessRequiredRefs,executable_series_action_refs:actionRefs,executable_series_action_payloads:payloads,executable_series_path_rows:seriesRows,executable_series_boundary:seriesBoundary,executable_series_end_cell:seriesRows.at(-1)?.[2]??start,
    operation_rows:operators.map(o=>({model_ref:o.model_ref,unobserved:o.unobserved,required_association_ref:o.required_ref,currently_bound:o.control!==null}))};
}
