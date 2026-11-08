/** Native transfer of common_support_navigation.py.
 * The public support coordinator retains conditional roles, counterexamples,
 * measured control responses and exact prefix guards. Its child families are
 * the same instances registered in the source router, not duplicated solvers.
 */
import frontierPolicy from './v6/frontier-policy.json' with { type:'json' };
import { ObservedInputDomain, v6Canonical } from './v6-native-observer.ts';
import { symbolicDigest } from './v6-hash.ts';
import { ControlDependencies } from './v6-transition-learning.ts';
import { measureSupportNavigationDomain } from './v6-support-navigation-domain.ts';
import { addressedSupportComponent, contained, currentReciprocalSupportFields, intersects, measureCurrentSupportUnderlays,
  measureRemoteSupportTransition, measureSupportOrthogonalBands, pointSet, rectangularPoints, sortedPoints, supportAssociation,
  supportBox, supportCompare, supportFieldAssociation, supportKey, supportParts, supportPoint, supportResidualCorrespondences,
  supportSame, supportShape, supportSignature, transformSupportPoints } from './v6-support-measurements.ts';
import type { SupportRecord as R } from './v6-support-measurements.ts';
import type { NativeFamily, NativeExecution, NativeObservation, NativeRows, NativeCommand, NativeProposal, NativePublicObservation,
  NativeBeforeResult, NativeAfterResult, NativeRecordResult, NativeRecord } from './v6-native-types.ts';

export const SUPPORT_COMPOSITION_ORDER = Object.freeze(['oriented_coupling','invited_reduction','joint_transport','configured_arrivals',
  'metric_composition','sliding_cavity','ordered_support_transfer','animated_contact','fixed_origin','subset_diagnosis',
  'contextual_compartments','periodic_sums','reflected_cover'] as const);
const hasData=(action:R):boolean=>action.data!=null&&Object.keys(action.data).length>0;
const clone=<T>(value:T):T=>structuredClone(value);
const sameSet=(a:Set<string>,b:Set<string>):boolean=>a.size===b.size&&contained(a,b);

export class SupportNavigation implements NativeFamily<any> {
  readonly id='support_navigation';
  readonly acquiredCompositions:Readonly<Record<string,NativeFamily<any>>>;
  readonly config:R;
  epoch:number|null=null; actorSignature:number[][]|null=null; targetSignature:number[][]|null=null;
  controls:R={}; directions:Record<string,number[]>={}; entered=new Set<string>(); effects:R[]=[]; tried:Record<string,number>={};
  blocked=new Set<string>(); events:R[]=[]; passed:R[]=[]; underlay:R|null=null;
  controlQuestions=new ControlDependencies();lastCalculation:R|null=null;equivalences:R[]=[];currentObservation:R|null=null;
  contactQuestion:R|null=null;contactAttempted=new Set<string>();controlIntroductions:R[]=[];serviceEdges:R[]=[];
  constructor(acquiredCompositions:Readonly<Record<string,NativeFamily<any>>>,policy:R=frontierPolicy){
    for(const name of Object.keys(acquiredCompositions))if(!(SUPPORT_COMPOSITION_ORDER as readonly string[]).includes(name))throw new TypeError(`Unknown support subcomposition: ${name}`);
    this.acquiredCompositions=Object.freeze(Object.fromEntries(SUPPORT_COMPOSITION_ORDER.filter(k=>acquiredCompositions[k]).map(k=>[k,acquiredCompositions[k]!])));
    this.config={...clone(policy.support_navigation),equivalence:clone(policy.support_navigation_equivalence),
      addressed_reciprocal_field_contact:policy.support_contact_question?.enabled??false,control_introduction_contact:policy.support_introduction_question?.enabled??false};
  }
  /** Missing implementations are declared, never replaced with always-refusing stubs. */
  get pendingSubcompositions():readonly string[]{return SUPPORT_COMPOSITION_ORDER.filter(k=>!this.acquiredCompositions[k]);}
  controlsIn(components:readonly R[]):R[]{
    const groups=new Map<string,R[]>();for(const item of components)if(item.area>1&&item.area<item.bbox.height*item.bbox.width){const key=v6Canonical(supportShape(item)),group=groups.get(key)??[];group.push(item);groups.set(key,group);}
    const repeated=[...groups.values()].filter(items=>items.length>=2&&new Set(items.map(item=>item.value)).size>=2);
    const known=new Set(Object.values(this.controls).map((row:R)=>v6Canonical(row.normalized_valued_pixels.map(([r,c]:number[])=>[r,c]))));
    return known.size?components.filter(item=>known.has(v6Canonical(supportShape(item)))):components.filter(item=>repeated.some(items=>items.includes(item)));
  }
  scene(rows:NativeRows):[R[],R,R,R[]]|null {
    const components=supportParts(rows),actors=components.filter(item=>supportSame(supportSignature(item),this.actorSignature)),targets=components.filter(item=>supportSame(supportSignature(item),this.targetSignature));
    if(actors.length!==1||targets.length!==1)return null;return [components,actors[0]!,targets[0]!,this.controlsIn(components)];
  }
  rememberUnderlay(before:R,after:R,first:NativeRows,second:NativeRows):void{
    const current=this.actorSignature?this.scene(second):null;if(!current){this.underlay=null;return;}
    const actor=current[1],box=[actor.bbox.top,actor.bbox.left,actor.bbox.bottom,actor.bbox.right],measured=measureCurrentSupportUnderlays(first,second);
    const matches=measured.filter(row=>row.component_ref===actor.component_id&&supportSame(row.bbox,box)&&row.underlay_values.length===1);
    if(matches.length===1)this.underlay={row:matches[0],source_before:before.observation_ref,source_after:after.observation_ref,observed_frame_hash:after.frame_hash,scope:'exact pre-translation pixels'};
    else if(this.underlay&&supportSame(this.underlay.row.bbox,box)){
      const value=this.underlay.row.underlay_values[0],mask=pointSet(actor.pixels),changed=new Set<number>();for(let y=0;y<first.length;y++)for(let x=0;x<first[0]!.length;x++)if(first[y]![x]!==second[y]![x]&&!mask.has(supportKey([y,x])))changed.add(first[y]![x]!);
      if(changed.has(value))this.underlay=null;else this.underlay.scope='retained under unchanged actor; no observed alteration of this support material, revisable';
    }else this.underlay=null;
  }
  /** Called once per witnessed transition, at the sealed prefix only. */
  async record(before:NativeObservation,after:NativeObservation,command:NativeCommand,first:NativeRows,second:NativeRows,proposal?:any,index?:number,frames:readonly NativeRows[]=[]):Promise<NativeRecordResult>{
    const additions:unknown[]=[];for(const provider of Object.values(this.acquiredCompositions)){
      const response=await provider.record(before,after,command,first,second,proposal,index as number,frames);additions.push(...response.events);
    }
    const retained=await this.recordExisting(before,after,command,first,second,proposal,index);
    return additions.length?{...retained,events:[...retained.events,...additions]}:retained;
  }
  async recordExisting(before:R,after:R,command:R,first:NativeRows,second:NativeRows,proposal?:R,index?:number):Promise<NativeRecordResult>{
    this.events=[];
    if(before.levels_completed!==after.levels_completed||before.level_epoch!==after.level_epoch){
      if(this.actorSignature)this.passed.push({score:after.levels_completed,observation_ref:after.observation_ref});
      this.epoch=after.level_epoch;this.blocked.clear();this.tried={};this.underlay=null;this.contactQuestion=null;return {status:'support_boundary_rebind_required',events:this.events};
    }
    this.epoch=before.level_epoch;
    if(hasData(command)){
      if(proposal?.support_plan?.contact_service_question){const question=proposal.support_plan.contact_service_question;this.contactAttempted.add(question.key);this.contactQuestion=null;
        this.events.push({kind:'addressed_contact_response_observed',question,before:before.observation_ref,after:after.observation_ref,scope:'Current context response only; no universal transport or useful outcome inferred.'});}
      const current=this.actorSignature?this.scene(first):null;
      if(current&&proposal?.support_plan?.control){const [components,actor,,controls]=current,selected=controls.filter(item=>supportSame(supportBox(item),proposal.support_plan.control.bbox));
        if(selected.length===1){const control=selected[0]!,row=supportAssociation(control,'control');this.controls[row.term_ref]=row;
          const measurement=measureRemoteSupportTransition(first,second,components,supportParts(second),control,actor),effect={control_association_ref:row.term_ref,typed_transition_measurements:measurement,before:before.observation_ref,after:after.observation_ref};
          this.effects.push(effect);this.tried[row.term_ref]=(this.tried[row.term_ref]??0)+1;this.events.push({kind:'remote_support_effect_measured',effect,usefulness:'unconfirmed'});
          const key=proposal.support_plan.experiment_key;if(key){this.controlQuestions.recordAttempt(key);this.events.push({kind:'contextual_control_question_closed',question_key:key,before:before.observation_ref,after:after.observation_ref,scope:'The same declared premises and input are no longer a new experiment; hidden equivalence is not established.'});}
        }
      }
      this.rememberUnderlay(before,after,first,second);const following=this.actorSignature?this.scene(second):null;
      if(current&&following&&!supportSame(supportBox(current[1]),supportBox(following[1]))){const edge={epoch:before.level_epoch,command:clone(command),origin:supportBox(current[1]),landing:supportBox(following[1]),before:before.observation_ref,after:after.observation_ref,field_question:clone(proposal?.support_plan?.contact_service_question??null),scope:'Observed contextual service edge, not an ordinary translation quantum or a universal transport rule.'};this.serviceEdges.push(edge);this.events.push({kind:'contextual_body_relocation',edge});}
      return {status:'support_control_observed',events:this.events};
    }
    const comparison=supportResidualCorrespondences(before,after,first,second),candidates=comparison.candidates.filter((item:R)=>item.before.rectangular&&item.before.area>1&&(this.actorSignature===null||item.before.palette_value===this.actorSignature[0]![2]));
    if(candidates.length===1){const {before:old,after:next}=candidates[0],dx=next.bbox[0]-old.bbox[0],dy=next.bbox[1]-old.bbox[1],h=old.bbox[3]-old.bbox[1]+1,w=old.bbox[2]-old.bbox[0]+1;
      if(dx===0&&Math.abs(dy)===h||dy===0&&Math.abs(dx)===w){const components=supportParts(first),actors=components.filter(item=>supportSame(supportBox(item),old.bbox)&&item.value===old.palette_value);
        if(actors.length===1){const actor=actors[0]!,homologues=components.filter(item=>supportSame(supportShape(item),supportShape(actor))&&item.value!==actor.value&&components.filter(peer=>supportSame(supportSignature(peer),supportSignature(item))).length===1);
          if(this.targetSignature!==null||homologues.length===1){this.actorSignature=supportSignature(actor);if(this.targetSignature===null)this.targetSignature=supportSignature(homologues[0]!);this.directions[command.action_ref]=[Math.floor(dy/h),Math.floor(dx/w)];
            const [x,y]=next.bbox,pattern:number[]=[];for(let yy=0;yy<h;yy++)for(let xx=0;xx<w;xx++)pattern.push(first[y+yy]![x+xx]!);this.entered.add(v6Canonical(pattern));
            this.events.push({kind:'unit_translation_and_support_observed',command:command.action_ref,delta:[dy,dx],before:before.observation_ref,after:after.observation_ref});}
        }
      }
    }else if(this.actorSignature){const current=this.scene(first),following=this.scene(second);if(current&&following&&supportSame(supportBox(current[1]),supportBox(following[1])))this.blocked.add(v6Canonical([supportBox(current[1]).slice(0,2),command.action_ref,symbolicDigest(first)]));}
    const current=this.actorSignature?this.scene(first):null,following=this.actorSignature?this.scene(second):null;
    if(current&&following){const oldShapes=new Set(current[3].map(item=>v6Canonical(supportSignature(item))));
      for(const control of following[3]){if(oldShapes.has(v6Canonical(supportSignature(control))))continue;const bands=measureSupportOrthogonalBands(control.pixels).oriented_signature;
        const markers=current[0].filter(item=>item.value===control.value&&item.area<control.area&&intersects(pointSet(item.pixels),pointSet(following[1].pixels))&&measureSupportOrthogonalBands(item.pixels).oriented_signature===bands);
        if(markers.length===1){const fact={control_shape:supportShape(control),marker_bands:bands,before:before.observation_ref,after:after.observation_ref,marker_bbox:supportBox(markers[0]!),body_bbox:supportBox(following[1]),scope:'One observed appearance after body contact; recall on another material is a hypothesis requiring its own response.'};this.controlIntroductions.push(fact);this.events.push({kind:'control_introduction_after_contact',fact});}
      }
      const pending=this.contactQuestion;if(pending&&pending.mode==='acquire_control'&&supportSame(supportBox(following[1]),pending.bbox)){this.contactAttempted.add(pending.key);this.contactQuestion=null;this.events.push({kind:'control_acquisition_contact_reconciled',question:pending,before:before.observation_ref,after:after.observation_ref,introduced:following[3].some(c=>!oldShapes.has(v6Canonical(supportSignature(c))))});}
    }
    this.rememberUnderlay(before,after,first,second);return {status:'support_motion_observed',events:this.events};
  }
  geometry(rows:NativeRows,actor:R,controls:readonly R[]):[Set<string>,Map<string,Set<number>>,number[]]{
    const h=actor.bbox.height,w=actor.bbox.width,ro=actor.bbox.top%h,co=actor.bbox.left%w,actorPixels=pointSet(actor.pixels),excluded=pointSet(controls.flatMap(item=>item.pixels));
    const support=new Set<string>(),owner=new Map<string,Set<number>>();let restored=rows;
    if(this.underlay&&supportSame(this.underlay.row.bbox,[actor.bbox.top,actor.bbox.left,actor.bbox.bottom,actor.bbox.right])){const copy=rows.map(row=>[...row]);for(const [y,x]of actor.pixels)copy[y]![x]=this.underlay.row.underlay_values[0];restored=copy;}
    for(const item of supportParts(restored)){if(supportSame(supportSignature(item),this.actorSignature)||intersects(pointSet(item.pixels),excluded))continue;
      if(item.bbox.height%h||item.bbox.width%w||(item.bbox.top-ro)%h||(item.bbox.left-co)%w)continue;const box=pointSet(rectangularPoints(item.bbox)),mask=pointSet(item.pixels),missing=new Set([...box].filter(p=>!mask.has(p)));
      if(contained(missing,actorPixels))for(const pixel of box){support.add(pixel);const values=owner.get(pixel)??new Set<number>();values.add(item.value);owner.set(pixel,values);}
    }
    const pointsFor=(r:number,c:number):number[][]=>{const a:number[][]=[];for(let dr=0;dr<h;dr++)for(let dc=0;dc<w;dc++)a.push([ro+r*h+dr,co+c*w+dc]);return a;};
    for(let r=0;r<Math.floor((rows.length-ro)/h);r++)for(let c=0;c<Math.floor((rows[0]!.length-co)/w);c++){const points=pointsFor(r,c);if(this.entered.has(v6Canonical(points.map(([y,x])=>restored[y!]![x!]))))for(const [y,x]of points){const p=supportKey([y!,x!]);support.add(p);const values=owner.get(p)??new Set<number>();values.add(restored[y!]![x!]!);owner.set(p,values);}}
    const cells=new Set<string>();for(let r=0;r<Math.floor((rows.length-ro)/h);r++)for(let c=0;c<Math.floor((rows[0]!.length-co)/w);c++)if(pointsFor(r,c).every(p=>support.has(supportKey(p))))cells.add(supportKey([r,c]));
    const contract=this.config.dependency_measurement_contract;if(contract.permission_models.includes('missing_control_smaller_same_palette_band_homologue_contact')&&contract.surface_models.includes('entered_pattern_occluded_by_homologous_item')){
      const components=supportParts(rows);for(const row of Object.values(this.controls) as R[]){const pixels=row.normalized_valued_pixels.map(([r,c]:number[])=>[r,c]),values=new Set(row.normalized_valued_pixels.map((p:number[])=>p[2]));if(values.size!==1||components.some(item=>supportSame(supportSignature(item),row.normalized_valued_pixels)))continue;
        const bands=measureSupportOrthogonalBands(pixels).oriented_signature;for(const item of components){if(!values.has(item.value)||item.area>=pixels.length||measureSupportOrthogonalBands(item.pixels).oriented_signature!==bands)continue;const mask=pointSet(item.pixels);
          for(let r=0;r<Math.floor((rows.length-ro)/h);r++)for(let c=0;c<Math.floor((rows[0]!.length-co)/w);c++){const points=pointsFor(r,c);if(!points.some(p=>mask.has(supportKey(p))))continue;const remaining=new Set(points.filter(p=>!mask.has(supportKey(p))).map(([y,x])=>rows[y!]![x!]));if(remaining.size===1&&this.entered.has(v6Canonical(Array(h*w).fill([...remaining][0]))))cells.add(supportKey([r,c]));}
        }
      }
    }return [cells,owner,[h,w,ro,co]];
  }
  async propose(observation:NativeObservation,rows:NativeRows,inputs:readonly NativeCommand[],remaining:number,_execution?:NativeExecution):Promise<any|null>{
    this.lastCalculation=null;this.equivalences=[];if(!this.actorSignature||remaining<=0||!observation.available_action_refs.includes('ACTION6'))return null;
    const scene=this.scene(rows);if(!scene)return null;const [components,actor,target,controls]=scene;if(!controls.length)return null;
    if(this.contactQuestion&&supportSame(supportBox(actor),this.contactQuestion.bbox)){const field=this.contactQuestion,bound=controls.filter(item=>supportAssociation(item,'control').term_ref===field.control_ref);
      if(bound.length===1&&!this.contactAttempted.has(field.key)){const item=bound[0]!,control={bbox:supportBox(item),association:supportAssociation(item,'control')},action={action_ref:'ACTION6',data:{x:item.bbox.left+Math.floor(item.bbox.width/2),y:item.bbox.top+Math.floor(item.bbox.height/2)}};
        const result=await this.make(observation,rows,actor,[action],[null],control,'Retest the measured field intervention with the body now on its addressed field. Persistence, relocation and no response remain rival outcomes.');result.support_plan.contact_service_question=clone(field);result.bundle_template.frozen_support_plan=clone(result.support_plan);return result;}
    }
    const [cells,owners,grid]=this.geometry(rows,actor,controls),[h,w,ro,co]=grid as [number,number,number,number],start=[Math.floor((actor.bbox.top-ro)/h),Math.floor((actor.bbox.left-co)/w)],terminal=[Math.floor((target.bbox.top-ro)/h),Math.floor((target.bbox.left-co)/w)];cells.add(supportKey(terminal));if(!cells.has(supportKey(start)))return null;
    const allowed=[...new Set(inputs.filter(item=>!hasData(item)).map(item=>item.action_ref))],unknown=allowed.filter(a=>!(a in this.directions)).sort();
    if(unknown.length)return this.make(observation,rows,actor,[{action_ref:unknown[0]}],[null],null,'Acquire the missing input displacement under the current support hypothesis.');
    const associations=[supportAssociation(actor,'moving'),supportAssociation(target,'fixed'),...Object.values(this.controls)],memory:R={moving_association_refs:[associations[0]!.term_ref],fixed_association_refs:[associations[1]!.term_ref],control_association_refs:Object.keys(this.controls),observed_lattice_calibration_rows:[{row_pitch:h,col_pitch:w,row_phase:ro,col_phase:co}],observed_entered_surface_rows:[...this.entered].map(s=>JSON.parse(s)).sort(supportCompare).map(pattern=>({before_pattern:pattern})),observed_remote_effect_rows:this.quotientEffects(rows,actor,controls)};
    const contract={...this.config.dependency_measurement_contract,interface_steps:this.directions,maximum_executable_series_actions:Math.min(16,remaining)};
    const calculated=this.calculate(rows,components,actor,memory,associations,contract,observation);this.lastCalculation=calculated;
    if(!calculated.complete&&calculated.tested_states)return {status:'support_search_incomplete',actions:[],question:{reason:'Existing finite search bound reached; not a proof of impossibility or a reason to repeat a known intervention.'},calculation:calculated,equivalences:this.equivalences};
    if(!calculated.witness_present){const contact=await this.contactAccess(observation,rows,components,actor,controls,memory,associations,contract,remaining);if(contact)return contact;}
    if(calculated.witness_present){const {actions,positions,control}=this.executable(calculated,controls,grid);if(actions.length)return this.make(observation,rows,actor,actions,positions,control,'Execute the existing support-domain witness; seal at a configuration intervention and revalidate its actual support.',calculated);}
    const parents=new Map<string,{previous:string;action:string}|null>([[supportKey(start),null]]),pending=[start];
    for(let cursor=0;cursor<pending.length;cursor++){const here=pending[cursor]!;for(const [action,delta]of Object.entries(this.directions).sort((a,b)=>supportCompare(a[0],b[0]))){const there=[here[0]!+delta[0]!,here[1]!+delta[1]!],key=supportKey(there);if(cells.has(key)&&!parents.has(key)){parents.set(key,{previous:supportKey(here),action});pending.push(there);}}}
    const distance=(cell:number[])=>Math.abs(cell[0]!-terminal[0]!)+Math.abs(cell[1]!-terminal[1]!);const closest=[...parents.keys()].map(supportPoint).sort((a,b)=>distance(a)-distance(b)||supportCompare(a,b))[0]!;
    if(distance(closest)<distance(start)){let cursor=supportKey(closest);const path:{action:string;cell:number[]}[]=[];while(parents.get(cursor)){const row=parents.get(cursor)!;path.push({action:row.action,cell:supportPoint(cursor)});cursor=row.previous;}path.reverse();const selected=path.slice(0,Math.min(16,remaining));return this.make(observation,rows,actor,selected.map(p=>({action_ref:p.action})),selected.map(p=>[co+p.cell[1]!*w,ro+p.cell[0]!*h]),null,'Approach the current target frontier through observed rectangular support hypotheses; interrupt on first motion mismatch.');}
    const blockedValues=new Set<number>();for(const delta of Object.values(this.directions)){const cell=[start[0]!+delta[0]!,start[1]!+delta[1]!];if(distance(cell)<distance(start)&&!cells.has(supportKey(cell)))for(let dr=0;dr<h;dr++)for(let dc=0;dc<w;dc++){const y=ro+cell[0]!*h+dr,x=co+cell[1]!*w+dc;if(y>=0&&y<rows.length&&x>=0&&x<rows[0]!.length)blockedValues.add(rows[y]![x]!);}}
    const actorUnderlay=new Set(actor.pixels.flatMap((p:number[])=>[...(owners.get(supportKey(p))??[])])),safe=controls.filter(item=>!actorUnderlay.has(item.value));if(!safe.length)return null;
    const projected=this.experimentContext(scene,rows,cells,grid),candidates:{item:R;key:string}[]=[];
    for(const item of safe){const command={action_ref:'ACTION6',data:{x:item.bbox.left+Math.floor(item.bbox.width/2),y:item.bbox.top+Math.floor(item.bbox.height/2)}},key=await ControlDependencies.questionKey(observation.level_epoch,'remote_support_response',command,projected);if(!this.controlQuestions.attempted.has(key))candidates.push({item,key});}
    if(!candidates.length)return {status:'known_control_questions_closed',actions:[],question:{reason:'Current control responses were already tested; missing access or capability remains an open dependency.'},calculation:calculated,equivalences:this.equivalences};
    candidates.sort((a,b)=>Number(!blockedValues.has(a.item.value))-Number(!blockedValues.has(b.item.value))||supportCompare(supportBox(a.item),supportBox(b.item)));const {item:selected,key}=candidates[0]!,control={bbox:supportBox(selected),association:supportAssociation(selected,'control')},point={x:selected.bbox.left+Math.floor(selected.bbox.width/2),y:selected.bbox.top+Math.floor(selected.bbox.height/2)};
    const result=await this.make(observation,rows,actor,[{action_ref:'ACTION6',data:point}],[[actor.bbox.left,actor.bbox.top]],control,'Test the measured remote control homologue associated with the blocked frontier; support persistence and usefulness remain uncertain.');result.support_plan.experiment_key=key;result.bundle_template.frozen_support_plan=clone(result.support_plan);return result;
  }
  private calculate(rows:NativeRows,components:readonly R[],actor:R,memory:R,associations:readonly R[],contract:R,observation:R):R{
    return measureSupportNavigationDomain({frame:rows,components,memory,associations,contract,availableActions:observation.available_action_refs,currentInputAlignedUnderlayValues:this.underlay?.row.underlay_values??[],inputAlignedEntityBboxes:this.underlay?[actor.bbox]:[],currentTranslationUnderlayRows:this.underlay?.observed_frame_hash===observation.frame_hash?[this.underlay!.row]:[]});
  }
  private executable(calculation:R,controls:readonly R[],grid:readonly number[]):{actions:R[];positions:number[][];control:R|null}{
    const [h,w,ro,co]=grid as [number,number,number,number],actions:R[]=[],positions:number[][]=[];let control:R|null=null;
    const n=Math.min(calculation.executable_series_action_refs.length,calculation.executable_series_action_payloads.length,calculation.executable_series_path_rows.length);
    for(let i=0;i<n;i++){const action=calculation.executable_series_action_refs[i],data=calculation.executable_series_action_payloads[i],pathrow=calculation.executable_series_path_rows[i],command:R={action_ref:action};
      if(data&&Object.keys(data).length){const selected=controls.filter(item=>data.x>=item.bbox.left&&data.x<=item.bbox.right&&data.y>=item.bbox.top&&data.y<=item.bbox.bottom);if(selected.length!==1)break;control={bbox:supportBox(selected[0]!),association:supportAssociation(selected[0]!,'control')};command.data=data;}
      actions.push(command);positions.push([co+pathrow[2][1]*w,ro+pathrow[2][0]*h]);if(data&&Object.keys(data).length)break;
    }return {actions,positions,control};
  }
  async contactAccess(observation:R,rows:NativeRows,components:readonly R[],actor:R,controls:readonly R[],memory:R,associations:readonly R[],contract:R,_remaining:number):Promise<R|null>{
    if(!this.config.addressed_reciprocal_field_contact)return null;
    const h=actor.bbox.height,w=actor.bbox.width,ro=actor.bbox.top%h,co=actor.bbox.left%w,fields=currentReciprocalSupportFields(this.effects,rows,observation.level_epoch,h,w);for(const field of fields)field.mode='service_contrast';
    const currentValues=new Set(controls.map(item=>item.value)),knownBands=new Set(this.config.control_introduction_contact?this.controlIntroductions.map(fact=>fact.marker_bands):[]);
    for(const marker of components){if(currentValues.has(marker.value)||marker.area<=1)continue;const bands=measureSupportOrthogonalBands(marker.pixels).oriented_signature;if(!knownBands.has(bands))continue;const mask=pointSet(marker.pixels),cells=sortedPoints(pointSet(marker.pixels.map(([y,x]:number[])=>[Math.floor((y!-ro)/h),Math.floor((x!-co)/w)])));
      for(const [r,c]of cells){const points:number[][]=[];for(let dr=0;dr<h;dr++)for(let dc=0;dc<w;dc++)points.push([ro+r!*h+dr,co+c!*w+dc]);const residual=new Set(points.filter(p=>!mask.has(supportKey(p))).map(([y,x])=>rows[y!]![x!]));if(residual.size!==1||!this.entered.has(v6Canonical(Array(h*w).fill([...residual][0]))))continue;
        const top=ro+r!*h,left=co+c!*w,pattern:number[]=[];for(let dr=0;dr<h;dr++)for(let dc=0;dc<w;dc++)pattern.push(rows[top+dr]![left+dc]!);fields.push({mode:'acquire_control',control_ref:null,marker_value:marker.value,bbox:[left,top,left+w-1,top+h-1],pattern,alternatives:[pattern],evidence:this.controlIntroductions.filter(fact=>fact.marker_bands===bands).flatMap(fact=>[fact.before,fact.after])});}
    }
    const offers:{length:number;field:R;calculation:R}[]=[],bound=new Set(controls.map(item=>supportAssociation(item,'control').term_ref));
    for(const field of fields){const relation=field.mode==='acquire_control'?'control_introduction_contact':'body_on_observed_response_field';field.key=await ControlDependencies.questionKey(observation.level_epoch,relation,field.control_ref,field.bbox);
      if(this.contactAttempted.has(field.key)||field.mode!=='acquire_control'&&!bound.has(field.control_ref)||this.contactQuestion&&field.key!==this.contactQuestion.key)continue;
      const addressed=addressedSupportComponent(field),target=supportFieldAssociation(field),scoped={...memory,fixed_association_refs:[target.term_ref]},calculation=this.calculate(rows,[...components,addressed],actor,scoped,[associations[0]!,target,...Object.values(this.controls)],contract,observation);
      if(calculation.witness_present&&calculation.complete)offers.push({length:calculation.path_length,field,calculation});
    }
    if(!offers.length)return null;offers.sort((a,b)=>Number(a.field.mode!=='acquire_control')-Number(b.field.mode!=='acquire_control')||a.length-b.length||supportCompare(a.field.bbox,b.field.bbox));const {field,calculation}=offers[0]!;this.contactQuestion=clone(field);
    const {actions,positions,control}=this.executable(calculation,controls,[h,w,ro,co]);if(!actions.length)return null;
    const why=field.mode==='acquire_control'?'Revalidate the previously observed control-introduction relation on a new current marker occurrence; retain the parent goal and inspect whether a control actually appears.':'Prepare contact with an actually changed reciprocal field, then test its command in that context; preserve the official parent goal. No nonlocal effect is presumed.';
    const result=await this.make(observation,rows,actor,actions,positions,control,why,calculation);result.support_plan.contact_access_question={...field,equally_short_alternatives:offers.filter(o=>o.length===offers[0]!.length&&o.field.mode===field.mode).map(o=>o.field),falsifier:'Changed field pattern, failed motion, changed control binding or response inconsistent with the current contrast.'};result.bundle_template.frozen_support_plan=clone(result.support_plan);return result;
  }
  experimentContext(scene:[R[],R,R,R[]],rows:NativeRows,cells?:Set<string>,grid?:readonly number[]):R{
    const [,actor,target,controls]=scene;if(!cells){const geometry=this.geometry(rows,actor,controls);cells=geometry[0];grid=geometry[2];}
    const [h,w,ro,co]=grid as [number,number,number,number],sorted=sortedPoints(cells!);return {actor_bbox:supportBox(actor),target:supportSignature(target),supported_cells:sorted,controls:controls.map(item=>[supportSignature(item),supportBox(item)]),support_patterns:sorted.map(([r,c])=>{const pattern:number[]=[];for(let dr=0;dr<h;dr++)for(let dc=0;dc<w;dc++)pattern.push(rows[ro+r!*h+dr]![co+c!*w+dc]!);return [r,c,pattern];})};
  }
  quotientEffects(rows:NativeRows,actor:R,controls:readonly R[]):R[]{
    if(!this.config.equivalence.enabled)return this.effects;
    const restored=rows.map(row=>[...row]);if(this.underlay&&supportSame(this.underlay.row.bbox,[actor.bbox.top,actor.bbox.left,actor.bbox.bottom,actor.bbox.right]))for(const [y,x]of actor.pixels)restored[y]![x]=this.underlay.row.underlay_values[0];
    const excluded=pointSet(controls.flatMap(c=>c.pixels)),rectangles=supportParts(restored).filter(item=>item.area===item.bbox.height*item.bbox.width&&!intersects(pointSet(item.pixels),excluded));
    const aliases=new Map<string,any[]>(),groups=new Map<string,{premises:any[];geometry:string;alternatives:any[][]}>();
    for(const effect of this.effects)for(const fit of effect.typed_transition_measurements.rigid_fit_rows){const key=[effect.control_association_ref,fit.changed_value,fit.pivot_value,fit.pivot_height,fit.pivot_width,fit.quarter_turns_clockwise];
      const otherChanges=new Set(this.effects.filter(other=>other.control_association_ref!==effect.control_association_ref).flatMap(other=>other.typed_transition_measurements.cell_transition_rows.flatMap((row:R)=>[...row.before_pattern,...row.after_pattern])));if(otherChanges.has(fit.changed_value)||otherChanges.has(fit.pivot_value))continue;
      const pivots=rectangles.filter(item=>supportSame([item.value,item.bbox.height,item.bbox.width],key.slice(2,5))),points=rectangles.filter(item=>item.value===fit.changed_value).flatMap(item=>item.pixels.map(([y,x]:number[])=>[2*y!,2*x!])).sort(supportCompare);if(!pivots.length||!points.length)continue;
      const futures=pivots.map(pivot=>{const centre=[pivot.bbox.top+pivot.bbox.bottom,pivot.bbox.left+pivot.bbox.right],orbit=[0,1,2,3].map(step=>transformSupportPoints(points,{kind:'QUARTER_TURN',pivot:centre,quarter_turns:(step*fit.quarter_turns_clockwise)%4}));return [supportBox(pivot),orbit];});
      const premises=key.slice(0,5),geometry=symbolicDigest(futures),groupKey=v6Canonical([premises,geometry]),group=groups.get(groupKey)??{premises,geometry,alternatives:[]};if(!group.alternatives.some(k=>supportSame(k,key)))group.alternatives.push(key);groups.set(groupKey,group);
    }
    for(const {premises,geometry,alternatives}of groups.values()){if(alternatives.length<2)continue;alternatives.sort(supportCompare);const representative=alternatives[0]!;for(const alternative of alternatives)aliases.set(v6Canonical(alternative),representative);
      this.equivalences.push({control_relation:premises[0],alternatives:alternatives.map(item=>item.at(-1)),representative:representative.at(-1),current_future_supports_digest:geometry,preserved_model_dimensions:['same command binding and primitive cost','same four support successors','same actor transitions','same contact-grant conditions'],unmodeled_resources_or_hidden_effects:'unknown, not declared equivalent',falsifier:'New shape, control binding, permission condition or response separating the alternatives; recompute before using the quotient.'});
    }
    return this.effects.map(effect=>({...clone(effect),typed_transition_measurements:{...clone(effect.typed_transition_measurements),rigid_fit_rows:effect.typed_transition_measurements.rigid_fit_rows.filter((fit:R)=>{const key=[effect.control_association_ref,fit.changed_value,fit.pivot_value,fit.pivot_height,fit.pivot_width,fit.quarter_turns_clockwise];return supportSame(aliases.get(v6Canonical(key))??key,key);}).map(clone)}}));
  }
  async make(observation:R,rows:NativeRows,actor:R,actions:readonly R[],positions:readonly (number[]|null)[],control:R|null,why:string,calculation:R|null=null):Promise<R>{
    const plan:R={actor_signature:this.actorSignature,actor_bbox:supportBox(actor),positions,control,calculation:calculation??this.lastCalculation,underlay:clone(this.underlay),equivalence_classes:clone(this.equivalences),scope:this.config.equivalence.scope};
    const steps:R[]=[];for(let i=0;i<Math.min(actions.length,positions.length);i++){const action=actions[i]!,position=positions[i],step:R={action,expected_after:position?{actor_top_left:position}:null};if(hasData(action))step.locus_witness=await ObservedInputDomain.makeLocusWitness(observation as NativeObservation,rows,[action.data.x,action.data.y],{reason:why,evidence:[observation.observation_ref]});steps.push(step);}
    const reference='C_support_'+symbolicDigest([observation.observation_ref,actions]).slice(0,16),facts={controlled_translation_observed:true,current_roles_bound:true,support_interpretation_revisable:true};
    return {status:'proposed',kind:'reconfigurable_support',support_plan:plan,actions,steps,facts,binding:{level_epoch:observation.level_epoch,levels_completed:observation.levels_completed,observation_ref:observation.observation_ref},compositions:[{id:reference,observed:false,open_question:why,properties:{role:'conditional_support_frontier'},relations:['contributes_to:G_official_completion']}],question:{reason:why},route_refs:[observation.observation_ref],bundle_template:{operation_key:'OP18',composition_ref:reference,objective_ref:'G_official_completion',preserve_refs:[],actions,purpose:why,preconditions:facts,evidence:[observation.observation_ref],frozen_support_plan:clone(plan),outcome_guard:{path:['value'],contains:reference}}};
  }
  bind(proposal:any,_domain:ObservedInputDomain):void{for(const step of proposal.steps??[])if(step.locus_witness)step.point_binding=step.locus_witness;}
  async before(proposal:any,index:number,publicPacket:NativePublicObservation,observation:NativeObservation):Promise<NativeBeforeResult>{
    for(const [key,provider]of Object.entries(this.acquiredCompositions))if(proposal.support_plan[key])return provider.before(proposal,index,publicPacket,observation);
    const plan=proposal.support_plan,expected=index===0?plan.actor_bbox.slice(0,2):plan.positions[index-1],current=this.scene(publicPacket.frame_rows);
    let ok=current!==null&&publicPacket.level===proposal.binding.level_epoch&&publicPacket.levels_completed===proposal.binding.levels_completed;
    ok=ok&&(expected===null||supportSame(supportBox(current![1]).slice(0,2),expected));ok=ok&&publicPacket.available_action_refs.includes(proposal.actions[index].action_ref)&&!this.controlQuestions.attempted.has(plan.experiment_key);
    if(ok&&plan.experiment_key){const projected=this.experimentContext(current!,publicPacket.frame_rows),key=await ControlDependencies.questionKey(publicPacket.level,'remote_support_response',proposal.actions[index],projected);ok=key===plan.experiment_key;}
    if(ok&&!hasData(proposal.actions[index])&&plan.positions[index]!==null){const [cells,,grid]=this.geometry(publicPacket.frame_rows,current![1],current![3]),[h,w,ro,co]=grid as [number,number,number,number],[x,y]=plan.positions[index];
      ok=cells.has(supportKey([Math.floor((y-ro)/h),Math.floor((x-co)/w)]))||supportSame([x,y],[current![2].bbox.left,current![2].bbox.top]);const field=plan.contact_access_question;
      if(!ok&&field&&supportSame([x,y],field.bbox.slice(0,2))){const actual:number[]=[];for(let dr=0;dr<h;dr++)for(let dc=0;dc<w;dc++)actual.push(publicPacket.frame_rows[y+dr]![x+dc]!);ok=field.alternatives.some((p:number[])=>supportSame(actual,p));}
    }
    return {admitted:Boolean(ok),reason:ok?'current_support_actor_and_epoch_bound':'support_binding_changed'};
  }
  async after(proposal:any,index:number,before:NativeObservation,after:NativeObservation,first:NativeRows,second:NativeRows):Promise<NativeAfterResult>{
    for(const [key,provider]of Object.entries(this.acquiredCompositions))if(proposal.support_plan[key])return provider.after(proposal,index,before,after,first,second);
    if(before.levels_completed!==after.levels_completed||before.level_epoch!==after.level_epoch||before.state!==after.state)return {matched:null,seal_prefix:true,reason:'official_boundary'};
    const scene=this.scene(second),expected=proposal.support_plan.positions[index];let matched:boolean|null=expected!==null?scene!==null&&supportSame(supportBox(scene[1]).slice(0,2),expected):null;
    if(matched&&hasData(proposal.actions[index])){const [cells,,grid]=this.geometry(second,scene![1],scene![3]),[h,w,ro,co]=grid as [number,number,number,number];matched=cells.has(supportKey([Math.floor((scene![1].bbox.top-ro)/h),Math.floor((scene![1].bbox.left-co)/w)]));}
    return {matched,seal_prefix:hasData(proposal.actions[index])||matched!==true,reason:'compare_observed_actor_with_conditional_support_prediction'};
  }
  /** Child states live in their own V7 family nodes, avoiding duplicate history. */
  state():NativeRecord{return clone({schema:'logos-engine.support-navigation.v1',epoch:this.epoch,actor_signature:this.actorSignature,target_signature:this.targetSignature,controls:this.controls,directions:this.directions,entered:[...this.entered].map(s=>JSON.parse(s)).sort(supportCompare),effects:this.effects,tried:this.tried,blocked:[...this.blocked].map(s=>JSON.parse(s)).sort(supportCompare),events:this.events,passed:this.passed,underlay:this.underlay,control_questions:{pending:this.controlQuestions.pending,attempted:[...this.controlQuestions.attempted].sort()},last_calculation:this.lastCalculation,equivalences:this.equivalences,current_observation:this.currentObservation,contact_question:this.contactQuestion,contact_attempted:[...this.contactAttempted].sort(),control_introductions:this.controlIntroductions,service_edges:this.serviceEdges,acquired_composition_ids:Object.keys(this.acquiredCompositions),pending_subcompositions:this.pendingSubcompositions});}
  restore(state:NativeRecord):void{
    const s=clone(state) as R;if(s.schema!=='logos-engine.support-navigation.v1'||!supportSame(s.acquired_composition_ids,Object.keys(this.acquiredCompositions))||!supportSame(s.pending_subcompositions,this.pendingSubcompositions))throw new TypeError('Support coordinator family registration changed during restore');
    this.epoch=s.epoch;this.actorSignature=s.actor_signature;this.targetSignature=s.target_signature;this.controls=s.controls;this.directions=s.directions;this.entered=new Set(s.entered.map((x:any)=>v6Canonical(x)));this.effects=s.effects;this.tried=s.tried;this.blocked=new Set(s.blocked.map((x:any)=>v6Canonical(x)));this.events=s.events;this.passed=s.passed;this.underlay=s.underlay;this.controlQuestions=new ControlDependencies();this.controlQuestions.pending=s.control_questions.pending;this.controlQuestions.attempted=new Set(s.control_questions.attempted);this.lastCalculation=s.last_calculation;this.equivalences=s.equivalences;this.currentObservation=s.current_observation;this.contactQuestion=s.contact_question;this.contactAttempted=new Set(s.contact_attempted);this.controlIntroductions=s.control_introductions;this.serviceEdges=s.service_edges;
  }
}
