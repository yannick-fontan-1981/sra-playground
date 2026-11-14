/** V6 common_subset_diagnosis.py: measured scopes, sealed public feedback,
 * and conditional candidate filtering. All points come from current public pixels.
 */
import { ObservedInputDomain } from './v6-native-observer.ts';
import { symbolicDigest as digest } from './v6-hash.ts';
import { ControlDependencies } from './v6-transition-learning.ts';
import { assessHypothesisPartition } from '../sic/discriminating-experiment.ts';
import { supportParts as components, supportBox as bounds, supportCompare as compare, supportSame as same } from './v6-support-measurements.ts';
import type { NativeAfterResult, NativeBeforeResult, NativeFamily, NativeRows } from './v6-native-types.ts';
type R=Record<string,any>;
const clone=<T>(v:T):T=>structuredClone(v);
const sorted=(v:Iterable<number>):number[]=>[...v].sort((a,b)=>a-b);
const range=(n:number):number[]=>Array.from({length:n},(_,i)=>i);
const key=(v:unknown):string=>JSON.stringify(v);
const hasShape=(shapes:unknown[],shape:unknown):boolean=>shapes.some(s=>same(s,shape));
const shape=(c:R):any[]=>[c.bbox.width,c.bbox.height,c.pixels.map(([y,x]:number[])=>[y!-c.bbox.top,x!-c.bbox.left]).sort(compare)];
const most=(vs:readonly number[]):number=>{const m=new Map<number,number>();for(const v of vs)m.set(v,(m.get(v)??0)+1);return [...m].sort((a,b)=>b[1]-a[1])[0]![0];};

export function measureSubsetScene(rows:NativeRows):R|null{
 const parts=components(rows),groups=new Map<string,R[]>(),candidates:R[]=[];
 for(const c of parts)if(c.bbox.width===c.bbox.height&&c.area===c.bbox.width*c.bbox.height){const k=key([c.value,c.bbox.width]),group=groups.get(k)??[];group.push(c);groups.set(k,group);}
 for(const [k,group]of groups){if(group.length<4)continue;const [color,size]=JSON.parse(k),xs=sorted(new Set<number>(group.map(c=>c.bbox.left))),ys=sorted(new Set<number>(group.map(c=>c.bbox.top)));
  if(xs.length*ys.length!==group.length||xs.length===1||ys.length===1)continue;
  if(xs.length>2&&new Set(xs.slice(1).map((v,i)=>v-xs[i]!)).size!==1||ys.length>2&&new Set(ys.slice(1).map((v,i)=>v-ys[i]!)).size!==1)continue;
  candidates.push({extent:(xs.at(-1)!-xs[0]!+size)*(ys.at(-1)!-ys[0]!+size),color,size,group,xs,ys});
 }
 if(!candidates.length)return null;candidates.sort((a,b)=>b.extent-a.extent);const {extent,color,size,group,xs,ys}=candidates[0]!;if(candidates.filter(c=>c.extent===extent).length>1)return null;
 group.sort((a:R,b:R)=>compare([a.bbox.top,a.bbox.left],[b.bbox.top,b.bbox.left]));const boxes=group.map(bounds),pitchx=Math.min(...xs.slice(1).map((b:number,i:number)=>b-xs[i])),pitchy=Math.min(...ys.slice(1).map((b:number,i:number)=>b-ys[i]));
 const left=Math.max(0,xs[0]-Math.floor(pitchx/2)),right=Math.min(rows[0]!.length-1,xs.at(-1)+size+Math.floor(pitchx/2)),top=Math.max(0,ys[0]-Math.floor(pitchy/2)),bottom=Math.min(rows.length-1,ys.at(-1)+size+Math.floor(pitchy/2)),palettes=new Map<number,number[][]>();
 for(let y=top;y<=bottom;y++)for(let x=left;x<=right;x++){const value=rows[y]![x]!,points=palettes.get(value)??[];points.push([x,y]);palettes.set(value,points);}
 const scopes:R={};for(const [value,pixels]of palettes){if(value===color)continue;const l=Math.min(...pixels.map(p=>p[0]!)),r=Math.max(...pixels.map(p=>p[0]!)),t=Math.min(...pixels.map(p=>p[1]!)),b=Math.max(...pixels.map(p=>p[1]!));const members=boxes.flatMap((bb:number[],i:number)=>l<=(bb[0]!+bb[2]!)/2&&(bb[0]!+bb[2]!)/2<=r&&t<=(bb[1]!+bb[3]!)/2&&(bb[1]!+bb[3]!)/2<=b?[i]:[]);if(members.length&&members.length<boxes.length)scopes[String(value)]=members;}
 const controls:R[]=[];for(const c of parts)if(Object.hasOwn(scopes,String(c.value))&&c.bbox.bottom<top&&c.area>=Math.min(size*size,4))controls.push({color:String(c.value),bbox:bounds(c),shape:shape(c),area:c.area});
 if(!controls.length||Object.keys(scopes).length<2)return null;
 return{boxes,palette:color,scope_members:scopes,controls,universe_ref:digest(boxes),focus:sorted(new Set<number>((Object.values(scopes) as number[][]).flat())),body_size:size};
}
export function subsetFeedback(rows:NativeRows,frames:readonly NativeRows[],scene:R):R|null{
 const boxes:number[][]=scene.boxes,background=most(rows.flat()),trajectory:number[][]=[];
 for(const f of frames){if(most(f.flat())!==background)continue;const changed:number[]=[];let valid=true;
  for(const [i,[l,t,r,b]]of boxes.entries()){const values=new Set<number>();for(let y=t!;y<=b!;y++)for(let x=l!;x<=r!;x++)values.add(f[y]![x]!);if(values.size!==1){valid=false;break;}if([...values][0]!==scene.palette)changed.push(i);}
  if(valid&&changed.length)trajectory.push(changed);
 }
 if(!trajectory.length)return null;const tested=trajectory[0]!;let label:string;
 if(trajectory.some(v=>v.length===boxes.length))label='GLOBAL';else if(trajectory.every(v=>v.every(i=>tested.includes(i))))label='LOCAL';else return{status:'partial_propagation_unknown',tested};
 return{status:'sealed_scope_feedback',tested,label,peak_changed:Math.max(...trajectory.map(v=>v.length)),transient_first_subset_bound:true};
}

/** Exact FILTER/PARTITION values consumed from subset_observation_d for the
 * family's explicit singleton-ANY law. Predictions never become receipts.
 */
export function measureConditionalSubset(candidates:readonly number[],tested:readonly number[],receipt:R|null=null):R{
 const posterior=receipt!==null,retained:string[]=[],eliminations:R[]=[],predictions:R[]=[],groups=new Map<string,string[]>();
 for(const i of candidates){const assignment_ref='candidate:'+i,feedback=[tested.includes(i)?'GLOBAL':'LOCAL'];
  if(posterior){if(!same(feedback,receipt.ordered_feedback))eliminations.push({assignment_ref,law_ref:'conditional_unique_member',contradicting_receipt_refs:[receipt.receipt_ref]});else retained.push(assignment_ref);}
  else{predictions.push({assignment_ref,law_ref:'conditional_unique_member',tested_member_refs:tested.map(String),predicted_ordered_feedback:feedback,actual_receipt:false});retained.push(assignment_ref);const g=groups.get(feedback[0]!)??[];g.push(assignment_ref);groups.set(feedback[0]!,g);}
 }
 const known=retained.length===1?retained[0]!.split(':').at(-1)!:null,confirmed=known!==null&&receipt!==null&&receipt.positive_singleton_confirmation&&same(receipt.tested_member_refs,[known]);
 return{retained_assignment_refs:retained,retained_law_refs:retained.length?['conditional_unique_member']:[],elimination_certificates:eliminations,predictions,partitions:[...groups].sort((a,b)=>compare(a[0],b[0])).map(([label,refs])=>({predicted_ordered_feedback:[label],assignment_refs:refs})),unresolved_assignment_refs:[],ignored_receipt_refs:[],latent_singleton_member_ref:known,positive_singleton_confirmed:!!confirmed,outstanding_positive_confirmation:!confirmed,posterior_updated_from_actual_receipts:posterior,predictions_are_actual_receipts:false,physical_no_solution_proved:false};
}
export function subsetNavigationPrediction(scene:R,candidates:readonly number[],tested:readonly number[],remaining:number):R|null{
 const domain=scene.boxes.length+(scene.focus.length===scene.boxes.length?0:scene.focus.length)+tested.length;if(domain>4096||candidates.length>4096)return null;
 const funded=remaining>=1,current=scene.focus.length===scene.boxes.length?'U':'F';return{query_candidates:[],native_focus_ref:funded?'Q':current,input_result:funded?'FOCUS_CHANGE':'RESOURCE_REFUSAL',all_navigation_words_enumerated:false,debit:funded?1:0,remaining_resource:Math.max(0,remaining-(funded?1:0)),retained_assignment_refs:candidates.map(i=>'candidate:'+i),posterior_filtered:false,actual_feedback_receipts:[],display_phase_after_response:null,positive_confirmation_is_predicted_not_observed:false,complete_response_boundary_count:1};
}

export class SubsetDiagnosis implements NativeFamily<any>{
 readonly id='subset_diagnosis';readonly policy:R;
 epoch:number|null=null;universe:string|null=null;candidates:Set<number>|null=null;press_shapes:any[]=[];nav_shapes:any[]=[];receipts:R[]=[];events:R[]=[];questions=new ControlDependencies();tested=new Set<string>();confirmed_epochs:number[]=[];method_refs:string[]=[];
 constructor(policy:R){this.policy=policy;}
 state():R{return clone({epoch:this.epoch,universe:this.universe,press_shapes:this.press_shapes,nav_shapes:this.nav_shapes,receipts:this.receipts,events:this.events,confirmed_epochs:this.confirmed_epochs,method_refs:this.method_refs,candidates:this.candidates===null?null:sorted(this.candidates),tested:[...this.tested].map(k=>JSON.parse(k)).sort(compare),questions:{pending:this.questions.pending,attempted:[...this.questions.attempted].sort()}});}
 restore(state:R):void{const s=clone(state);for(const k of ['epoch','universe','press_shapes','nav_shapes','receipts','events','confirmed_epochs','method_refs'])(this as any)[k]=s[k];this.candidates=s.candidates===null?null:new Set(s.candidates);this.tested=new Set(s.tested.map(key));this.questions.pending=s.questions.pending;this.questions.attempted=new Set(s.questions.attempted);}
 resetDomain(obs:R,scene:R):void{if(this.epoch!==obs.level_epoch||this.universe!==scene.universe_ref){this.epoch=obs.level_epoch;this.universe=scene.universe_ref;this.candidates=new Set(range(scene.boxes.length));this.receipts=[];this.tested.clear();}}
 record(before:R,after:R,command:R,first:NativeRows,second:NativeRows,proposal?:R|null,_index?:number|null,frames?:readonly NativeRows[]):any{
  this.events=[];if(command.action_ref!=='ACTION6')return{status:'subset_not_applicable',events:[]};const a=measureSubsetScene(first);if(!a)return{status:'subset_scene_unknown',events:[]};this.resetDomain(before,a);const result=subsetFeedback(first,frames?.length?frames:[second],a);
  if(result?.status==='sealed_scope_feedback'){
   const tested:number[]=result.tested,label=result.label,point=command.data??{},colors=Object.entries(a.scope_members).filter(([,members])=>same(members,tested)).map(([color])=>color);
   for(const color of colors){const controls=a.controls.filter((c:R)=>c.color===color);if(controls.length&&Object.hasOwn(point,'x')){const distance=(c:R)=>Math.max(c.bbox[0]-point.x,point.x-c.bbox[2],0)+Math.max(c.bbox[1]-point.y,point.y-c.bbox[3],0);controls.sort((a:R,b:R)=>distance(a)-distance(b));const nearest=controls[0];if(!hasShape(this.press_shapes,nearest.shape))this.press_shapes.push(nearest.shape);}}
   const old=sorted(this.candidates!),receipt={receipt_ref:after.observation_ref+':scope',epoch:before.level_epoch,evidence_revision_ref:after.observation_ref,tested_member_refs:tested.map(String),ordered_feedback:[label],sealed:true,positive_singleton_confirmation:tested.length===1&&after.levels_completed>before.levels_completed};
   if(a.boxes.length>4096||old.length>4096)throw new Error('Subset receipt calculation unresolved: INPUT_DOMAIN_BOUND');const calculation=measureConditionalSubset(old,tested,receipt),surviving=new Set<number>(calculation.retained_assignment_refs.map((v:string)=>Number(v.split(':').at(-1))));if(!surviving.size)throw new Error('Contradiction under conditional unique-member hypothesis; preserve receipt');
   this.candidates=surviving;this.receipts.push(receipt);this.method_refs.push(after.observation_ref);this.tested.add(key([old,tested]));this.events=[{kind:'public_subset_feedback',before:before.observation_ref,after:after.observation_ref,tested,feedback:label,candidates_before:old,candidates_after:sorted(surviving),calculation,press_shapes:this.press_shapes,hypothesis_scope:'conditional unique fixed member, not universal fault law'}];
   if(after.levels_completed>before.levels_completed){this.confirmed_epochs.push(before.level_epoch);this.epoch=null;this.candidates=null;}return{status:'subset_feedback_observed',events:this.events};
  }
  if(proposal?.support_plan?.subset_diagnosis){const p=proposal.support_plan,b=measureSubsetScene(second);if(p.mode==='navigation'&&b&&b.universe_ref===a.universe_ref){const matched=same(sorted(b.focus),sorted(p.tested));this.questions.recordAttempt(p.question_key);if(matched&&!hasShape(this.nav_shapes,p.control_shape))this.nav_shapes.push(p.control_shape);this.events=[{kind:'scope_navigation_response',before:before.observation_ref,after:after.observation_ref,expected_focus:p.tested,observed_focus:b.focus,matched,nav_shapes:this.nav_shapes,candidates_unchanged:sorted(this.candidates!)}];}}
  return{status:'subset_navigation_or_unknown',events:this.events};
 }
 async propose(obs:R,rows:NativeRows,_inputs:readonly any[],remaining:number):Promise<any>{
  if(!this.policy.enabled||!obs.available_action_refs.includes('ACTION6')||!this.press_shapes.length||remaining<1)return null;const scene=measureSubsetScene(rows);if(!scene)return null;this.resetDomain(obs,scene);const candidates=sorted(this.candidates!),offers:any[][]=[],controls=scene.controls.filter((c:R)=>hasShape(this.press_shapes,c.shape));
  const commandAt=(b:number[]):R=>({action_ref:'ACTION6',data:{x:Math.floor((b[0]!+b[2]!)/2),y:Math.floor((b[1]!+b[3]!)/2)}});
  for(const c of controls){
   const tested:number[]=scene.scope_members[c.color],inside=candidates.filter(i=>tested.includes(i)).length;
   if(!inside||inside===candidates.length&&tested.length>1||this.tested.has(key([candidates,tested])))continue;
   const partition=assessHypothesisPartition([inside,candidates.length-inside])!;
   offers.push([partition.remaining,0,tested,commandAt(c.bbox),c.shape]);
  }
  const nav:any[][]=[];if(!offers.length&&candidates.length>2)for(const [color,tested0]of Object.entries(scene.scope_members)){const tested=tested0 as number[];if(!candidates.every(i=>tested.includes(i))||tested.length>=scene.focus.length||!tested.every(i=>scene.focus.includes(i)))continue;for(const c of scene.controls){if(c.color!==color||hasShape(this.press_shapes,c.shape))continue;const command=commandAt(c.bbox),question=digest([obs.level_epoch,'scope_navigation',{universe:scene.universe_ref,focus:scene.focus,desired:tested},command]);if(!this.questions.attempted.has(question))nav.push([tested.length,tested,command,c.shape,question]);}}
  let mode='query',navigation_proof:R|null=null,tested:number[],command:R,control_shape:any,question:string;
  if(nav.length){nav.sort((a,b)=>compare([a[0],a[2].data.x,a[2].data.y],[b[0],b[2].data.x,b[2].data.y]));[,tested,command,control_shape,question]=nav[0]!;mode='navigation';if(hasShape(this.nav_shapes,control_shape)){navigation_proof=subsetNavigationPrediction(scene,candidates,tested,remaining);if(navigation_proof===null)return null;}}
  else{
   if(candidates.length){
    const single=assessHypothesisPartition([1,candidates.length-1])!;
    for(const i of candidates)offers.push([single.remaining,1,[i],commandAt(scene.boxes[i]),null]);
   }
   if(!offers.length)return null;
   offers.sort((a,b)=>compare(a.slice(0,3),b.slice(0,3)));
   [,,tested,command,control_shape]=offers[0]!;
   question=digest([obs.level_epoch,'subset_information',{universe:scene.universe_ref,candidates,tested},command]);
  }
  if(scene.boxes.length>4096||candidates.length>4096)return null;const prediction=measureConditionalSubset(candidates,tested);
  const why=mode==='navigation'?'Preserve the conditional candidate set while accessing a smaller current geometric scope; this control shares the observed scope binding but its navigation effect must be checked.':'Test the bound subset that separates the current conditional candidates. Preserve the complete transient response; a local result excludes this subset, a global result includes it under the explicit fixed-member hypothesis. A deduced singleton still requires a physical terminal test.';
  const ref='C_subset_'+question.slice(0,16),evidence=[obs.observation_ref,...this.method_refs.slice(-8)],plan={subset_diagnosis:true,mode,frame_hash:obs.frame_hash,universe_ref:scene.universe_ref,focus:scene.focus,tested,candidates,question_key:question,control_shape,partitions:prediction,navigation_prediction:navigation_proof,conditional_model:'one fixed influential member; multiple/noisy/changing causes remain outside this hypothesis',terminal_evidence_epochs:this.confirmed_epochs},facts={current_occurrences_measured:true,actual_transient_feedback_retained:true,current_query_or_navigation_address_bound:true,fixed_member_model_is_conditional:true},step={action:command,expected_before:{frame_hash:obs.frame_hash},expected_after:{status:'unknown_feedback_or_partition'},locus_witness:await ObservedInputDomain.makeLocusWitness(obs as any,rows,[command.data.x,command.data.y],{reason:why,evidence})};
  return{status:'proposed',kind:'subset_scope_'+mode,support_plan:plan,actions:[command],steps:[step],facts,compositions:[{id:ref,role:'information_question',observed:false,open_question:why,properties:{candidate_count:candidates.length,tested_count:tested.length},relations:['contributes_to:G_official_completion']}],question:{reason:why,hypothesis_refs:evidence},route_refs:evidence,binding:{observation_ref:obs.observation_ref,level_epoch:obs.level_epoch,levels_completed:obs.levels_completed},bundle_template:{operation_key:'OP18',composition_ref:ref,objective_ref:'G_official_completion',preserve_refs:[],purpose:why,preconditions:facts,evidence,actions:[command],frozen_support_plan:clone(plan),outcome_guard:{path:['value'],contains:ref}}};
 }
 before(p:R,i:number,publicPacket:R,o:R):NativeBeforeResult{
  const plan=p.support_plan,s=measureSubsetScene(publicPacket.frame_rows),original=publicPacket.level===p.binding.level_epoch&&publicPacket.levels_completed===p.binding.levels_completed&&publicPacket.frame_hash===plan.frame_hash&&s!==null&&s.universe_ref===plan.universe_ref&&same(s.focus,plan.focus);if(!original)return{admitted:false,reason:'subset_scope_changed'};
  const actions=p.actions??[],steps=p.steps??[];let ok=i===0&&actions.length===1&&steps.length===1&&same(actions[0],steps[0].action)&&same(actions,p.bundle_template.actions)&&publicPacket.available_action_refs.includes(actions[0].action_ref)&&actions[0].action_ref==='ACTION6'&&same(plan.candidates,sorted(this.candidates??[]))&&o.level_epoch===p.binding.level_epoch;
  if(ok){const mode=plan.mode,features=mode==='navigation'?{universe:s!.universe_ref,focus:s!.focus,desired:plan.tested}:{universe:s!.universe_ref,candidates:sorted(this.candidates!),tested:plan.tested};ok=digest([o.level_epoch,mode==='navigation'?'scope_navigation':'subset_information',features,actions[0]])===plan.question_key;}
  return{admitted:!!ok,reason:ok?'current_subset_control_and_exact_declared_question':'subset_question_binding_changed'};
 }
 after(_p:R,_i:number,_before:R,_after:R,_first:NativeRows,_second:NativeRows):NativeAfterResult{return{matched:null,seal_prefix:true,reason:'complete_transient_feedback_or_new_partition_required'};}
}
