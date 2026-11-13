/** Native transfer of common_periodic_sums.py, pinned V6 786dcf51.
 * Phase domains are enumerated independently; no target state or game identity is supplied.
 */
import { ObservedInputDomain } from './v6-native-observer.ts';
import { symbolicDigest as digest } from './v6-hash.ts';
import { supportParts as parts, supportBox as box, supportCompare as compare, supportSame as same } from './v6-support-measurements.ts';
import type { NativeAfterResult, NativeBeforeResult, NativeFamily, NativeRows } from './v6-native-types.ts';
type R = Record<string, any>;
const copy = <T>(v:T):T => structuredClone(v);
const mod=(n:number,p:number):number=>((n%p)+p)%p;
const most=(values:readonly number[]):number=>{const m=new Map<number,number>();for(const v of values)m.set(v,(m.get(v)??0)+1);return [...m].sort((a,b)=>b[1]-a[1])[0]![0];};
const range=(n:number):number[]=>Array.from({length:n},(_,i)=>i);
const tuples=(domains:readonly number[][]):number[][]=>domains.reduce<number[][]>((acc,domain)=>acc.flatMap(prefix=>domain.map(v=>[...prefix,v])),[[]]);

export function measurePeriodicSums(rows:NativeRows):R|null {
 const h=rows.length,w=rows[0]!.length,cs=parts(rows),background=most(rows.flat()),tracks:R[]=[];
 for(const color of [...new Set(rows.flat())].filter(v=>v!==background).sort(compare)){
  const ys=rows.flatMap((row,y)=>row.includes(color)?[y]:[]),runs:number[][]=[];
  for(const y of ys){if(!runs.length||y>runs.at(-1)!.at(-1)!+1)runs.push([]);runs.at(-1)!.push(y);}
  for(const run of runs){if(run.length<2||run.length>Math.floor(w/3))continue;
   const top=run[0]!,base=run.at(-1)!+1,xx=[...new Set(run.flatMap(y=>range(w).filter(x=>rows[y]![x]===color)))];
   if(xx.length<Math.floor(w/3)||Math.max(...xx)-Math.min(...xx)<Math.floor(w*3/4)||base>=h)continue;
   const heights=range(w).map(x=>{let n=0;while(base-n-1>=top&&rows[base-n-1]![x]===color)n++;return n;});
   for(let period=2;period<=Math.floor(w/3);period++){
    const pattern=range(period).map(k=>most(heights.filter((_,i)=>i%period===k)));
    if(new Set(pattern).size<2||Math.max(...pattern)<2)continue;
    const errors=range(w).filter(x=>heights[x]!==pattern[x%period]);
    if(errors.every(x=>heights[x]!+1===pattern[x%period]&&![color,background].includes(rows[base-pattern[x%period]!]![x]!))){tracks.push({color,base,top:base-Math.max(...pattern),period,profile:pattern,overlay_columns:errors});break;}
   }
  }
 }
 tracks.sort((a,b)=>a.base-b.base);
 if(tracks.length<2||tracks.length>4||tracks.some((t,i)=>i>0&&tracks[i-1]!.base>=t.top))return null;
 const colors=new Set(tracks.map(t=>t.color)),floor=tracks.at(-1)!.base,feet:number[][]=[];
 for(const c of cs){const [l,t,r,b]=box(c) as [number,number,number,number];if(t>floor&&t===b&&3<=r-l+1&&r-l+1<Math.floor(w/2)&&c.area===r-l+1&&!colors.has(c.value))feet.push([l,t,r,c.value]);}
 const detectors:R[]=[];
 for(const foot of feet){let [l,base,r]=foot as [number,number,number];
  const rail=(x:number)=>cs.some(c=>{const q=box(c);return q[0]===x&&q[2]===x&&q[3]===base-1&&c.area>=2;});
  if(rail(l-1)&&rail(r+1)){l--;r++;}
  const x=Math.floor((l+r)/2),left=cs.filter(c=>{const q=box(c);return q[1]===q[3]&&q[0]!<l&&[l-1,l].includes(q[2]!)&&floor<q[1]!&&q[1]!<base;});
  for(const c of left){const [a,y,b]=box(c) as [number,number,number];if(!cs.some(q=>q.value===c.value&&same(box(q),[l+r-b,y,l+r-a,y])))continue;
   let total=0;while(base-total-1>floor&&colors.has(rows[base-total-1]![x]))total++;
   const contributions=tracks.map(t=>t.profile[x%t.period]);if(contributions.reduce((a,n)=>a+n,0)!==total)continue;
   detectors.push({x,base,target:base-y,total,contributions});
  }
 }
 if(!detectors.length||new Set(detectors.map(d=>d.x)).size!==detectors.length)return null;
 detectors.sort((a,b)=>a.x-b.x);const controls:R[]=[];
 for(const c of cs){const [l,t,r,b]=box(c) as [number,number,number,number];
  if(l===0||r===w-1||b>=tracks[0]!.top||c.area<3||c.area>12||r-l<1||b-t<1)continue;
  const mask=c.pixels.map(([y,x]:number[])=>[x!-l,y!-t]).sort(compare),mirror=mask.map(([x,y]:number[])=>[r-l-x!,y!]).sort(compare);
  // The reflected peer retains its own origin, colour, dimensions and vertical interval.
  const paired=cs.some(q=>{const a=box(q);return q!==c&&q.value===c.value&&a[1]===t&&a[3]===b&&a[2]! - a[0]! === r-l&&same(q.pixels.map(([y,x]:number[])=>[x!-a[0]!,y!-a[1]!]).sort(compare),mirror);});
  if(paired&&!same(mask,mirror))controls.push({box:[l,t,r,b],shape:digest([r-l+1,b-t+1,mask]),point:[Math.floor((l+r)/2),Math.floor((t+b)/2)]});
 }
 const edgePairs:number[][]=[];
 for(const c of cs){const [l,t,r,b]=box(c) as [number,number,number,number];if(l===0&&c.area>=2&&c.area<=6&&r<=2&&cs.some(q=>{const a=box(q);return q.value===c.value&&a[0]!>=w-3&&a[2]===w-1&&a[1]===t&&a[3]===b;}))edgePairs.push([t,b]);}
 const selected:number[]=[];
 tracks.forEach((track,i)=>{const above=edgePairs.filter(p=>p[1]!<track.top).map(p=>p[1]!),below=edgePairs.filter(p=>p[0]!>track.base).map(p=>p[0]!);if(above.length&&below.length){const a=Math.max(...above),b=Math.min(...below);if(!tracks.some((other,j)=>j!==i&&a<other.top&&other.base<b))selected.push(i);}});
 return {tracks,detectors,controls,selected:selected.length===1?selected[0]:null,layout:digest([...tracks.map(t=>[t.base,t.period]),...detectors.map(d=>[d.x,d.base,d.target])])};
}

export function periodicOffsets(a:R,b:R):number[]|null {
 if(a.tracks.length!==b.tracks.length)return null;const result:number[]=[];
 for(let i=0;i<a.tracks.length;i++){const x=a.tracks[i],y=b.tracks[i];if(!same([x.color,x.period,x.base],[y.color,y.period,y.base]))return null;const p=x.period,matches=range(p).filter(k=>range(p).every(j=>y.profile[j]===x.profile[mod(j-k,p)]));if(matches.length!==1)return null;const d=matches[0]!;result.push(d<=Math.floor(p/2)?d:d-p);}return result;
}

/** Consumed INVERSE_DOMAIN projection of periodic_profile_preimages_d.
 * The original independent Cartesian domain and work/domain refusals are retained.
 */
export function periodicTargetDomain(scene:R):{proof:R;targets:number[][]}|null {
 const tracks:R[]=scene.tracks,detectors:R[]=scene.detectors,count=tracks.reduce((n,t)=>n*t.period,1);if(count>4096)return null;
 const assignments=tuples(tracks.map(t=>range(t.period))),targets:number[][]=[],refs:string[]=[];
 let cause='PERIODIC_PROFILE_RESULT',status='COMPLETE',work=0;const started=Date.now();
 if(tracks.reduce((n,t)=>n+t.profile.length,0)>4096){cause='INPUT_DOMAIN_BOUND';status='NEEDS_EVIDENCE';}
 else if(!assignments.length||!detectors.length){cause='CORRELATED_ASSIGNMENT_OR_DETECTOR_DOMAIN_INCOMPLETE';status='NEEDS_EVIDENCE';}
 else if(detectors.some(d=>d.target==null)){cause='TARGET_VALUES_NOT_BOUND';status='NEEDS_EVIDENCE';}
 else outer:for(const [n,values]of assignments.entries()){
  let hits=true;for(const detector of detectors){let total=0;for(let i=0;i<tracks.length;i++){if(work>=100000){status='NEEDS_EVIDENCE';cause='NODE_BOUND';break outer;}if(Date.now()-started>=60000){status='NEEDS_EVIDENCE';cause='TIME_BOUND';break outer;}work++;const t=tracks[i]!;total+=t.profile[mod(detector.x-values[i]!,t.period)];}if(total!==detector.target)hits=false;}
  if(hits){targets.push(values);refs.push(String(n));}
 }
 if(status==='COMPLETE'&&Date.now()-started>=60000){status='NEEDS_EVIDENCE';cause='TIME_BOUND';}
 return {proof:{status,cause,assignment_count:assignments.length,target_refs:status==='COMPLETE'?refs:[]},targets:status==='COMPLETE'?targets:[]};
}
const inputDigest=(p:R):string=>digest([p.binding,p.actions,p.steps.map((s:R)=>Object.fromEntries(Object.entries(s).filter(([k])=>k!=='point_binding')))]);

export class PeriodicSums implements NativeFamily<any> {
 readonly id='periodic_sums';readonly config:R;
 individual:R={};collective:R={};refs:string[]=[];selection=false;passed:R[]=[];tried=new Set<string>();events:R[]=[];last_result:R|null=null;
 bootstrap_attempts=new Set<string>();authorizations:R={};
 constructor(config:R){this.config=config;}
 state():R{return copy({individual:this.individual,collective:this.collective,refs:this.refs,selection:this.selection,passed:this.passed,events:this.events,last_result:this.last_result,authorizations:this.authorizations,tried:[...this.tried].sort(),bootstrap_attempts:[...this.bootstrap_attempts].sort()});}
 restore(state:R):void{const s=copy(state);for(const k of ['individual','collective','refs','selection','passed','events','last_result','authorizations'])(this as any)[k]=s[k];this.tried=new Set(s.tried);this.bootstrap_attempts=new Set(s.bootstrap_attempts);}
 targets(scene:R,_obs:R):Set<string>|null{const r=periodicTargetDomain(scene);if(r===null)return null;this.last_result=r.proof;return r.proof.status==='COMPLETE'?new Set(r.targets.map(v=>JSON.stringify(v))):null;}
 search(scene:R,targets:Set<string>,remaining:number):R[]|null {
  const tracks:R[]=scene.tracks,start=[tracks.map(()=>0),scene.selected],queue:{state:any[];path:R[]}[]=[{state:start,path:[]}],seen=new Set([JSON.stringify(start)]);
  for(let head=0;head<queue.length;head++){const {state:[phases,selected],path}=queue[head]!;if(targets.has(JSON.stringify(phases))&&path.length)return path;if(path.length>=remaining)continue;
   const nexts:{state:any[];command:R}[]=[];
   for(const [action,delta]of Object.entries(this.individual)){if(selected===null)continue;const values=[...phases];values[selected]=mod(values[selected]+delta,tracks[selected]!.period);nexts.push({state:[values,selected],command:{action_ref:action,delta:tracks.map((_,i)=>i===selected?delta:0)}});}
   for(const control of scene.controls){const law=this.collective[control.shape]??{};if(tracks.every(t=>Object.hasOwn(law,String(t.color)))){const ds=tracks.map(t=>law[String(t.color)]),values=phases.map((v:number,i:number)=>mod(v+ds[i],tracks[i]!.period));nexts.push({state:[values,selected],command:{action_ref:'ACTION6',data:{x:control.point[0],y:control.point[1]},delta:ds}});}}
   tracks.forEach((t,i)=>{if(i!==selected)nexts.push({state:[phases,i],command:{select:i,action_ref:'ACTION6',data:{x:Math.floor(t.profile.length/2),y:t.base-1},delta:tracks.map(()=>0)}});});
   for(const {state,command}of nexts){const k=JSON.stringify(state);if(!seen.has(k)){seen.add(k);queue.push({state,path:[...path,command]});}}
  }return null;
 }
 private async measuredProposal(obs:R,rows:NativeRows,_inputs:readonly any[],remaining:number):Promise<R|null>{
  if(!this.config.enabled||!this.refs.length||remaining<1)return null;const scene=measurePeriodicSums(rows);if(!scene||scene.selected===null)return null;
  const targets=this.targets(scene,obs);if(targets===null)return null;let route=this.search(scene,targets,remaining),question='',mode='joint_phase_target';
  if(!route){for(const c of [...scene.controls].sort((a:R,b:R)=>compare(a.point,b.point))){const key=digest([obs.level_epoch,scene.layout,c.shape,'channel']);if(!this.tried.has(key)&&!scene.tracks.every((t:R)=>Object.hasOwn(this.collective[c.shape]??{},String(t.color)))){route=[{action_ref:'ACTION6',data:{x:c.point[0],y:c.point[1]},probe:true}];question=key;break;}}
   if(!route)for(const action of obs.available_action_refs)if(['ACTION3','ACTION4'].includes(action)&&!Object.hasOwn(this.individual,action)){const key=digest([obs.level_epoch,scene.layout,action,'individual']);if(!this.tried.has(key)){route=[{action_ref:action,probe:true}];question=key;break;}}
   mode='channel_question';
  }if(!route)return null;
  const profiles:number[][]=scene.tracks.map((t:R)=>[...t.profile]),steps:R[]=[],actions:R[]=[];let selected=scene.selected;
  for(const command of route.slice(0,16)){const expected_before={profiles:copy(profiles),selected},action=Object.fromEntries(Object.entries(command).filter(([k])=>['action_ref','data'].includes(k)));let probe=!!command.probe;
   if(Object.hasOwn(command,'select')){selected=command.select;probe=!this.selection;}
   if(!probe)(command.delta??[]).forEach((d:number,i:number)=>{const p=profiles[i]!;profiles[i]=p.map((_,x)=>p[mod(x-d,p.length)]!);});
   const step:R={action,expected_before,expected_after:probe?null:{profiles:copy(profiles),selected},probe};
   if(action.action_ref==='ACTION6')step.locus_witness=await ObservedInputDomain.makeLocusWitness(obs as any,rows,[(action.data as R).x,(action.data as R).y],{reason:'Measured strip focus or paired control occurrence; no semantic role from position alone.',evidence:[obs.observation_ref]});
   steps.push(step);actions.push(action);if(probe)break;
  }
  const why='Reach a joint preimage of all current sampled-stack targets using measured phase controls; selection costs and each receiver remain coupled. If a control is unknown, stop at its first response and retain rival channel hypotheses.',facts={periodic_strips_measured:true,stack_contributions_match:true,current_focus_bound:true,phase_preimages_computed:true},ref='C_profiles_'+digest([obs.observation_ref,actions]).slice(0,16),evidence=[obs.observation_ref,...this.refs.slice(-4)],plan={periodic_sums:true,mode,frame_hash:obs.frame_hash,layout:scene.layout,question_key:question,preimage_proof:this.last_result,hypotheses:['measured finite periodic strips','current stack is sum of sampled strip heights','native controls retain their current scoped phase effects'],passed:this.passed.slice(-3)};
  return this.package(obs,scene,'periodic_sum_'+mode,plan,actions,steps,facts,ref,'joint_phase_preimage',why,evidence);
 }
 private package(obs:R,scene:R,kind:string,plan:R,actions:R[],steps:R[],facts:R,ref:string,role:string,why:string,evidence:string[]):R{return{status:'proposed',kind,support_plan:plan,actions,steps,facts,compositions:[{id:ref,role,observed:false,open_question:why,properties:{receivers:scene.detectors.length},relations:['contributes_to:G_official_completion']}],question:{reason:why,hypothesis_refs:evidence},route_refs:evidence,binding:{observation_ref:obs.observation_ref,level_epoch:obs.level_epoch,levels_completed:obs.levels_completed},bundle_template:{operation_key:'OP18',composition_ref:ref,objective_ref:'G_official_completion',preserve_refs:[],purpose:why,preconditions:facts,evidence,actions,frozen_support_plan:copy(plan),outcome_guard:{path:['value'],contains:ref}}};}
 async propose(obs:R,rows:NativeRows,inputs:readonly any[],remaining:number):Promise<any>{
  let p=await this.measuredProposal(obs,rows,inputs,remaining);
  if(p===null&&this.config.enabled&&!this.refs.length&&remaining>=1){const scene=measurePeriodicSums(rows),rule=this.config.initial_control_question;if(!rule.enabled||!scene||scene.selected===null||!scene.detectors.some((d:R)=>d.total!==d.target))return null;
   const available=new Set(inputs.filter(v=>!v.data||!Object.keys(v.data).length).map(v=>v.action_ref));let chosen:[string,string]|null=null;
   for(const action of rule.ordered_input_hypotheses){const key=digest([obs.level_epoch,scene.layout,scene.tracks.map((t:R)=>t.profile),scene.selected,action,'initial_selected_strip_response']);if(available.has(action)&&!this.bootstrap_attempts.has(key)){chosen=[action,key];break;}}
   if(!chosen)return null;const [action,key]=chosen,command={action_ref:action},why=rule.meaning,ref='C_profiles_initial_'+key.slice(0,16),evidence=[obs.observation_ref],facts={periodic_strips_measured:true,stack_contributions_match:true,current_focus_bound:true,sampled_target_residual_present:true,input_effect_is_unknown:true,phase_preimages_computed:false},plan={periodic_sums:true,mode:'initial_control_question',frame_hash:obs.frame_hash,layout:scene.layout,question_key:key,hypotheses:[rule.input_hypothesis],passed:[]},step={action:command,expected_before:{profiles:scene.tracks.map((t:R)=>t.profile),selected:scene.selected},expected_after:null,probe:true};
   p=this.package(obs,scene,'periodic_sum_initial_control_question',plan,[command],[step],facts,ref,'information_question',why,evidence);
  }
  if(p){const token=inputDigest(p);p.support_plan.input_binding_ref=token;this.authorizations[token]=inputDigest(p);p.bundle_template.frozen_support_plan=copy(p.support_plan);}return p;
 }
 before(p:R,i:number,publicPacket:R,obs:R):NativeBeforeResult{
  if(i<0||i>=p.actions.length)return{admitted:false,reason:'periodic_input_index_outside_set'};
  const s=measurePeriodicSums(publicPacket.frame_rows),expected=p.steps[i].expected_before;let ok=s!==null&&s.layout===p.support_plan.layout&&same(s.tracks.map((t:R)=>t.profile),expected.profiles)&&s.selected===expected.selected&&publicPacket.level===p.binding.level_epoch&&publicPacket.levels_completed===p.binding.levels_completed;if(i===0)ok=ok&&publicPacket.frame_hash===p.support_plan.frame_hash;
  const exact=this.authorizations[p.support_plan.input_binding_ref]===inputDigest(p)&&same(p.actions,p.steps.map((s:R)=>s.action))&&same(p.actions,p.bundle_template.actions)&&publicPacket.available_action_refs.includes(p.actions[i].action_ref)&&obs.level_epoch===p.binding.level_epoch;
  return{admitted:!!(ok&&exact),reason:exact?'current_periodic_scope_and_exact_authorized_input':'periodic_input_binding_changed'};
 }
 after(p:R,i:number,before:R,after:R,_first:NativeRows,second:NativeRows):NativeAfterResult{
  if(after.levels_completed>before.levels_completed)return{matched:null,seal_prefix:true,reason:'official_boundary'};const expected=p.steps[i].expected_after;if(expected===null)return{matched:null,seal_prefix:true,reason:'unknown_channel_response'};
  const s=measurePeriodicSums(second),ok=s!==null&&s.layout===p.support_plan.layout&&same(s.tracks.map((t:R)=>t.profile),expected.profiles)&&s.selected===expected.selected;return{matched:ok,seal_prefix:!ok,reason:ok?'joint_phase_prediction':'profile_focus_or_sum_diverged'};
 }
 record(before:R,after:R,command:R,first:NativeRows,second:NativeRows,proposal?:R|null,index?:number|null,frames?:readonly NativeRows[]):any{
  const result=this.measuredRecord(before,after,command,first,second,proposal,index,frames);
  if(proposal?.support_plan?.mode==='initial_control_question'){this.bootstrap_attempts.add(proposal.support_plan.question_key);const acquired=!!result.events?.length;this.events.push({kind:'initial_periodic_control_question_returned',before:before.observation_ref,after:after.observation_ref,question_key:proposal.support_plan.question_key,mechanical_acquisition:acquired,parent:'G_official_completion',remaining_unknowns:['unobserved controls and untested scope changes']});return{...result,events:this.events};}return result;
 }
 private measuredRecord(before:R,after:R,command:R,first:NativeRows,second:NativeRows,proposal?:R|null,index?:number|null,frames?:readonly NativeRows[]):R{
  this.events=[];const a=measurePeriodicSums(first);if(!a)return{status:'periodic_sums_absent',events:[]};let b=measurePeriodicSums(second);
  if(after.levels_completed>before.levels_completed){b=null;for(const r of frames??[]){const s=measurePeriodicSums(r);if(s&&s.layout===a.layout){b=s;break;}}this.passed.push({before:before.observation_ref,after:after.observation_ref,method:'sampled_periodic_sum',control:command});}
  if(!b)return{status:'periodic_response_unmeasured',events:[]};const delta=periodicOffsets(a,b);if(delta===null)return{status:'periodic_profile_changed',events:[]};const action=command.action_ref;let kind:string|null=null;
  if(action!=='ACTION6'&&a.selected!==null&&delta[a.selected]&&delta.every((d,i)=>i===a.selected||!d)){this.individual[action]=delta[a.selected];kind='individual_phase_displacement';}
  if(action==='ACTION6'){const point=command.data??{},controls=a.controls.filter((c:R)=>c.box[0]<=(point.x??-1)&&(point.x??-1)<=c.box[2]&&c.box[1]<=(point.y??-1)&&(point.y??-1)<=c.box[3]);if(controls.length===1&&delta.some(Boolean)){this.collective[controls[0].shape]=Object.fromEntries(a.tracks.map((t:R,i:number)=>[String(t.color),delta[i]]));kind='joint_phase_displacement';}else if(!delta.some(Boolean)&&b.selected!==null&&b.selected!==a.selected){this.selection=true;kind='strip_focus_changed';}}
  if(kind){this.refs.push(after.observation_ref);this.events=[{kind,command,delta,before:before.observation_ref,after:after.observation_ref,scope:'current measured strips; gains and focus remain context-bound',official_boundary:after.levels_completed>before.levels_completed}];}
  if(proposal?.support_plan?.periodic_sums&&proposal.steps[index!]?.probe)this.tried.add(proposal.support_plan.question_key);
  return{status:'periodic_response_recorded',events:this.events};
 }
}
