/** Native transfer of common_oriented_coupling.py and its public-pixel guards. */
import frontierPolicy from './v6/frontier-policy.json' with { type:'json' };
import { symbolicDigest } from './v6-hash.ts';
import { v6Canonical } from './v6-native-observer.ts';
import { handoffMove, handoffInteraction } from './v6-oriented-handoff-mechanics.ts';
import { supportParts, supportCompare, supportSame, supportKey, supportPoint } from './v6-support-measurements.ts';
import type { NativeFamily, NativeRows, NativeExecution, NativeBeforeResult, NativeAfterResult, NativeRecordResult, NativeRecord } from './v6-native-types.ts';
type R=Record<string,any>;
const clone=<T>(x:T):T=>structuredClone(x);
const mod=(x:number,n:number):number=>((x%n)+n)%n;
const coordinates=(boxes:R):number[][]=>Object.keys(boxes).map(supportPoint).sort(supportCompare);
const setSame=(a:readonly number[][],b:readonly number[][]):boolean=>supportSame([...a].sort(supportCompare),[...b].sort(supportCompare));
const frequency=(values:readonly any[]):[any,number][]=>{const counts=new Map<any,number>();for(const v of values)counts.set(v,(counts.get(v)??0)+1);return[...counts].sort((a,b)=>b[1]-a[1]);};

export function orientedCouplingInitial(rows:NativeRows):R|null{
  const cs=supportParts(rows),rings:number[][]=[];
  for(const c of cs){const b=c.bbox,p=b.width;if(p<3||b.height!==p||c.area!==p*p-(p-2)**2)continue;
    const edge:number[]=[],inside=new Set<number>();for(let y=b.top;y<=b.bottom;y++)for(let x=b.left;x<=b.right;x++){
      if(x===b.left||x===b.right||y===b.top||y===b.bottom)edge.push(rows[y]![x]!);else inside.add(rows[y]![x]!);
    }
    if(new Set(edge).size===1&&inside.size===1&&!inside.has(c.value))rings.push([p,c.value,[...inside][0]!,b.left,b.top]);
  }
  const groups=frequency(rings.map(r=>v6Canonical(r.slice(0,3)))).filter(([,n])=>n>=2);if(groups.length!==1)return null;
  const[p,shell,core]=JSON.parse(groups[0]![0]) as [number,number,number],rs=rings.filter(r=>v6Canonical(r.slice(0,3))===groups[0]![0]);
  const phase=[mod(rs[0]![3]!,p),mod(rs[0]![4]!,p)];if(rs.some(r=>!supportSame([mod(r[3]!,p),mod(r[4]!,p)],phase)))return null;
  const boxes:R[]=[];for(const c of cs){const b=c.bbox;if(c.value!==core||b.width%p||b.height%p||b.width*b.height<=p*p||!supportSame([mod(b.left,p),mod(b.top,p)],phase))continue;
    let good=true;for(let y=b.top;y<=b.bottom;y++)for(let x=b.left;x<=b.right;x++)if((x===b.left||x===b.right||y===b.top||y===b.bottom)&&rows[y]![x]!==core)good=false;
    if(good)boxes.push(b);
  }
  if(boxes.length!==1)return null;const b=boxes[0]!,targets:number[][]=[];
  for(let x=Math.floor((b.left-phase[0]!)/p);x<Math.floor((b.right-phase[0]!+1)/p);x++)for(let y=Math.floor((b.top-phase[1]!)/p);y<Math.floor((b.bottom-phase[1]!+1)/p);y++)targets.push([x,y]);
  if(targets.length<rs.length)return null;
  return{pitch:p,phase,core,rest_shell:shell,targets,initial_boxes:rs.map(r=>[Math.floor((r[3]!-phase[0]!)/p),Math.floor((r[4]!-phase[1]!)/p)]).sort(supportCompare),background:frequency(rows.flat())[0]![0]};
}
export function orientedCouplingTile(rows:NativeRows,h:R,p:readonly number[]):number[][]|null{
  const q=h.pitch,x=h.phase[0]+p[0]!*q,y=h.phase[1]+p[1]!*q;if(x<0||y<0||y+q>rows.length||x+q>rows[0]!.length)return null;
  return Array.from({length:q},(_,dy)=>Array.from({length:q},(_,dx)=>rows[y+dy]![x+dx]!));
}
export function orientedCouplingScene(rows:NativeRows,h:R,actorColor:number):R|null{
  const q=h.pitch,phase=h.phase,cs=supportParts(rows),bodies=cs.filter(c=>c.value===actorColor&&c.area>=q&&c.bbox.width<=q&&c.bbox.height<=q);
  if(bodies.length!==1)return null;const b=bodies[0]!.bbox,pose=[Math.floor((b.left-phase[0])/q),Math.floor((b.top-phase[1])/q)],patch=orientedCouplingTile(rows,h,pose);if(!patch)return null;
  const minor:number[][]=[];for(let y=0;y<q;y++)for(let x=0;x<q;x++)if(patch[y]![x]!==actorColor)minor.push([x,y,patch[y]![x]!]);
  if(minor.length!==q||new Set(minor.map(p=>p[2])).size!==1)return null;
  if(![0,q-1].some(edge=>minor.every(p=>p[0]===edge))&&![0,q-1].some(edge=>minor.every(p=>p[1]===edge)))return null;
  const axes=[0,1].map(i=>minor.reduce((n,p)=>n+p[i]!,0)/minor.length-(q-1)/2);if((axes[0]===0)===(axes[1]===0))return null;
  const face=axes[0]===0?[0,axes[1]!>0?1:-1]:[axes[0]!>0?1:-1,0],boxes:R={};
  for(const c of cs){const b=c.bbox;if(c.value!==h.core||b.width!==q-2||b.height!==q-2||c.area!==(q-2)**2||!supportSame([mod(b.left-1,q),mod(b.top-1,q)],phase))continue;
    const pos=[Math.floor((b.left-1-phase[0])/q),Math.floor((b.top-1-phase[1])/q)],t=orientedCouplingTile(rows,h,pos)!,edge=new Set<number>();
    for(let y=0;y<q;y++)for(let x=0;x<q;x++)if(x===0||x===q-1||y===0||y===q-1)edge.add(t[y]![x]!);
    if(edge.size!==1||edge.has(h.core))return null;boxes[supportKey(pos)]=[...edge][0]!;
  }
  if(Object.keys(boxes).length!==h.initial_boxes.length)return null;
  return{pose,face,boxes,actor_color:actorColor,face_value:minor[0]![2]};
}
export const orientedCouplingEqual=(expected:R,s:R|null):boolean=>!!s&&supportSame(expected.pose,s.pose)&&supportSame(expected.face,s.face)&&setSame(expected.boxes,coordinates(s.boxes));

export class OrientedCoupling implements NativeFamily<any>{
  readonly id='oriented_coupling';readonly policy:R;
  h:R|null=null;actor_color:number|null=null;epoch:number|null=null;ready=false;s:R|null=null;held:number[]|null=null;coupled=false;invitation:number[]|null=null;
  known=new Set<string>();refs:string[]=[];pending_release=false;blocked_face=false;tried=new Set<string>();
  constructor(policy:R=frontierPolicy.oriented_coupling){this.policy=clone(policy);}
  reset():void{this.h=null;this.actor_color=null;this.epoch=null;this.ready=false;this.s=null;this.held=null;this.coupled=false;this.invitation=null;this.known.clear();this.refs=[];this.pending_release=false;this.blocked_face=false;this.tried.clear();}
  record(before:R,after:R,command:R,first:NativeRows,second:NativeRows,_proposal?:R,_index?:number,_frames?:readonly NativeRows[]):NativeRecordResult{
    if(this.epoch!==before.level_epoch){this.reset();this.epoch=before.level_epoch;this.h=orientedCouplingInitial(first);}
    if(!this.h)return{status:'coupling_domain_absent',events:[]};
    if(this.actor_color===null){const candidates:number[]=[];for(const v of new Set(supportParts(first).map(c=>c.value)))if(![this.h.core,this.h.rest_shell,this.h.background].includes(v)){
      const a=orientedCouplingScene(first,this.h,v),b=orientedCouplingScene(second,this.h,v);if(a&&b&&!supportSame(a.pose,b.pose)&&supportSame(a.boxes,b.boxes))candidates.push(v);
    }if(candidates.length!==1)return{status:'coupling_controller_unknown',events:[]};this.actor_color=candidates[0]!;}
    const a=orientedCouplingScene(first,this.h,this.actor_color),b=orientedCouplingScene(second,this.h,this.actor_color);
    if(!a||!b)return{status:'coupling_current_measurement_unknown',events:[]};
    if(after.levels_completed>before.levels_completed)return{status:'coupling_official_boundary',events:[{kind:'official_completion',evidence:after.observation_ref}]};
    const action=command.action_ref,delta=[b.pose[0]-a.pose[0],b.pose[1]-a.pose[1]],moves=delta.some(v=>v!==0),newpos=Object.keys(b.boxes).filter(k=>!(k in a.boxes)),oldpos=Object.keys(a.boxes).filter(k=>!(k in b.boxes)),events:R[]=[];
    if(this.held!==null&&moves){const predicted=[this.held[0]!+delta[0]!,this.held[1]!+delta[1]!];
      if(oldpos.length===1&&oldpos[0]===supportKey(this.held)&&newpos.length===1&&newpos[0]===supportKey(predicted)){
        this.held=predicted;this.coupled=true;this.known.add(v6Canonical(['held',action]));events.push({kind:'public_rigid_pair_translation',delta,evidence:after.observation_ref});
      }else{this.held=null;this.coupled=false;events.push({kind:'rigid_pair_prediction_refuted',evidence:after.observation_ref});}
    }else if(moves&&!newpos.length&&!oldpos.length){this.known.add(v6Canonical(['free',action]));this.pending_release=false;}
    if(!moves&&!supportSame(a.face,b.face))this.blocked_face=true;
    const ahead=[b.pose[0]+b.face[0],b.pose[1]+b.face[1]],changed=Object.keys(a.boxes).filter(p=>p in b.boxes&&a.boxes[p]!==b.boxes[p]);
    if(action===this.policy.interaction_candidate&&!moves&&changed.length===1&&changed[0]===supportKey(ahead)){
      if(this.held===null){this.held=ahead;events.push({kind:'visible_relation_change_candidate',evidence:after.observation_ref,uncertainty:'coupling awaits co-translation'});}
      else{this.held=null;this.pending_release=true;events.push({kind:'release_candidate',evidence:after.observation_ref,uncertainty:'independent actor movement or official boundary must confirm'});}
    }
    if(moves&&changed.length===1&&changed[0]===supportKey(ahead)&&this.held===null){this.invitation=ahead;this.ready=true;events.push({kind:'front_contour_invitation',evidence:after.observation_ref,uncertainty:'available is not attached'});}
    if(this.held!==null||this.coupled)this.ready=true;this.s=b;this.refs.push(after.observation_ref);return{status:'coupling_observed',events};
  }
  models(obs:R,rows:NativeRows,s:R):[R,R]{
    const h=this.h!,q=h.pitch,floor:number[][]=[],targets=new Set(h.targets.map(supportKey));
    for(let y=0;y<Math.floor((rows.length-h.phase[1])/q);y++)for(let x=0;x<Math.floor((rows[0]!.length-h.phase[0])/q);x++){
      const p=[x,y],t=orientedCouplingTile(rows,h,p)!;if(supportKey(p) in s.boxes||supportSame(p,s.pose)||targets.has(supportKey(p))||t.every(r=>r.every(v=>v===h.background)))floor.push(p);
    }
    const cargo=coordinates(s.boxes).map((p,i)=>({cargo_ref:'part:'+i,type_ref:'part',x:p[0],y:p[1],offsets:[[0,0]],holder_ref:supportSame(p,this.held)?'controller':null,delivery_acquired:false,mask_evidence_ref:obs.observation_ref}));
    const held=cargo.find(c=>c.holder_ref)?.cargo_ref??null,actor={actor_ref:'controller',type_ref:'controller',x:s.pose[0],y:s.pose[1],offsets:[[0,0]],face:s.face,held_cargo_ref:held,locked_interaction_face:held?s.face:null,alive:true};
    const terrain=floor.flatMap(([x,y])=>['controller','part'].map(role=>({x,y,actor_type_ref:role,traversable:true,evidence_ref:obs.observation_ref})));
    if(cargo.length>128||terrain.length>8192)throw new TypeError('Oriented handoff state exceeds its V5 geometry bounds');
    const state={actors:[actor],player_ref:'controller',cargo,terrain,remaining_budget:512,input_tick:0,level_scope_ref:String(obs.level_epoch),restore_epoch:0,status:'ACTIVE',receivers:[],autonomous_phase:0};
    const rules=['ATTACH','RELEASE'].map(kind=>({actor_type_ref:'controller',target_type_ref:'part',kind,front_required:true,delivered_cargo_regrasp_allowed:false,acquisition_retained_on_regrasp:null,release_carried_after_actor_removal:null,evidence_ref:this.coupled?this.refs.at(-1)!:null}));
    const model={model_ref:'conditional_current_rigid_relation',free_facing:'BEFORE_TRANSLATION',free_facing_evidence_ref:this.blocked_face?this.refs.at(-1)!:null,free_move_evidence_ref:this.refs[0]!,coupling_evidence_ref:this.coupled?this.refs.at(-1)!:null,interaction_rules:rules,
      commands:[],autonomous_order:[],autonomous_choices:[],joint_order:'UNKNOWN',phase_modulus:null,clock_inputs:[],clock_evidence_ref:null,wait_evidence_ref:null};return[state,model];
  }
  async search(state:R,model:R,predicate:(s:R)=>boolean,execution?:NativeExecution):Promise<[Array<[string,R]>,R]|null>{
    const queue:[R,Array<[string,R]>][]=[[state,[]]],seen=new Set<string>();let head=0;
    while(head<queue.length){const[s,path]=queue[head++]!,a=s.actors[0],key=v6Canonical([a.x,a.y,a.face,s.cargo.map((c:R)=>[c.x,c.y])]);if(seen.has(key))continue;seen.add(key);
      if(predicate(s))return[path,s];
      if(execution&&seen.size%128===0){execution.signal?.throwIfAborted();await execution.yieldControl();}
      // The transferred V5 move changes only actors and cargo; all other
      // state fields are retained verbatim. Compare those complete records
      // instead of serializing the unchanged terrain on every search edge.
      for(const[action,d]of Object.entries(this.policy.direction_candidates) as [string,number[]][]){const[t,,missing]=handoffMove(s,model,'controller',d[0]!,d[1]!,100000,true);if(!missing.length&&(!supportSame(t.actors,s.actors)||!supportSame(t.cargo,s.cargo)))queue.push([t,[...path,[action,t]]]);}
    }return null;
  }
  async route(state:R,model:R,execution?:NativeExecution):Promise<Array<[string,R]>|null>{
    const actor=state.actors[0],choices:any[][]=[];
    for(const cargo of state.cargo){const pos=[cargo.x,cargo.y];if(actor.held_cargo_ref&&cargo.cargo_ref!==actor.held_cargo_ref)continue;if(!actor.held_cargo_ref&&this.h!.targets.some((p:number[])=>supportSame(p,pos)))continue;
      const occupied=new Set(state.cargo.filter((c:R)=>c.cargo_ref!==cargo.cargo_ref).map((c:R)=>supportKey([c.x,c.y])));
      for(const target of [...this.h!.targets].filter((p:number[])=>!occupied.has(supportKey(p))).sort(supportCompare))for(const face of actor.held_cargo_ref?[actor.face]:Object.values(this.policy.direction_candidates)){
        let prefix:Array<[string,R]>=[],start=state;
        if(actor.held_cargo_ref===null){const grasp=[cargo.x-face[0],cargo.y-face[1]],found=await this.search(state,model,s=>supportSame(s.actors[0].face,face)&&supportSame([s.actors[0].x,s.actors[0].y],grasp),execution);if(!found)continue;
          [prefix,start]=found;const[result,,missing]=handoffInteraction(start,model,'controller',cargo.cargo_ref,'ATTACH',100000,true);if(missing.length)continue;start=result;prefix=[...prefix,[this.policy.interaction_candidate,start]];
        }
        const found=await this.search(start,model,s=>s.cargo.some((c:R)=>c.cargo_ref===cargo.cargo_ref&&supportSame([c.x,c.y],target)),execution);if(!found)continue;
        const[suffix,last]=found,[end,,missing]=handoffInteraction(last,model,'controller',cargo.cargo_ref,'RELEASE',100000,true);if(missing.length)continue;
        const path=[...prefix,...suffix,[this.policy.interaction_candidate,end] as [string,R]];choices.push([path.length,cargo.cargo_ref,target,face,path]);
      }
    }
    choices.sort((a,b)=>supportCompare(a.slice(0,4),b.slice(0,4)));return choices[0]?.[4]??null;
  }
  async propose(obs:R,rows:NativeRows,_inputs:readonly R[],remaining:number,execution?:NativeExecution):Promise<any|null>{
    if(!this.ready||!this.h||obs.level_epoch!==this.epoch)return null;const s=orientedCouplingScene(rows,this.h,this.actor_color!);if(!s)return null;
    const[state,model]=this.models(obs,rows,s),ahead=[s.pose[0]+s.face[0],s.pose[1]+s.face[1]];let path:Array<[string,R|null]>,why:string;
    if(!this.coupled&&this.held===null){const key=v6Canonical([s.pose,s.face,ahead,s.boxes[supportKey(ahead)]??null]);if(!supportSame(ahead,this.invitation)||this.tried.has(key))return null;
      this.tried.add(key);path=[[this.policy.interaction_candidate,null]];why='Test the current frontal contour invitation; availability is distinct from attachment';
    }else{const route=await this.route(state,model,execution);if(!route?.length)return null;path=route;why='Deliver a current compatible part into the retained homologous region, then test release; preserve other parts and the rigid offset';}
    const actions:R[]=[],steps:R[]=[];let cur=state;
    const expected=(s:R):R=>({pose:[s.actors[0].x,s.actors[0].y],face:s.actors[0].face,boxes:s.cargo.map((c:R)=>[c.x,c.y]),held:s.cargo.filter((c:R)=>c.holder_ref).map((c:R)=>[c.x,c.y])[0]??null});
    for(const[action,next]of path.slice(0,Math.min(16,remaining))){if(!obs.available_action_refs.includes(action))break;const before=expected(cur),after=next?expected(next):null;
      const unknown=action===this.policy.interaction_candidate||!this.known.has(v6Canonical([before.held?'held':'free',action]))||this.pending_release||!this.blocked_face&&after!==null&&supportSame(before.pose,after.pose)&&!supportSame(before.face,after.face);
      actions.push({action_ref:action});steps.push({expected_before:before,expected_after:after,uncertain:!!unknown});if(unknown)break;cur=next!;
    }
    if(!actions.length)return null;const ref='C_coupling_'+symbolicDigest([obs.observation_ref,actions]).slice(0,16),evidence=[obs.observation_ref,...this.refs.slice(-4)],facts={current_contour_relation_bound:true,measured_lattice_and_masks:true,conditional_v5_composition:true};
    const plan={oriented_coupling:true,frame_hash:obs.frame_hash,geometry:clone(this.h),actor_color:this.actor_color,target_hypothesis:clone(this.h.targets),scope:'Current repeated hollow objects and homologous enclosure; single measured controller, no autonomous model',
      v5_consumers:['oriented_cargo_handoffs._move','oriented_cargo_handoffs._interaction'],unknowns:['receiver acceptance before official score','untried command/role bindings','class support beyond current uniform appearance','exclusive frontal interaction law']};
    return{status:'proposed',kind:'conditional_oriented_coupling',support_plan:plan,actions,steps,facts,compositions:[{id:ref,role:'oriented_part_delivery',observed:false,open_question:why,relations:['contributes_to:G_official_completion']}],question:{reason:why,hypothesis_refs:evidence},route_refs:evidence,
      binding:{observation_ref:obs.observation_ref,level_epoch:obs.level_epoch,levels_completed:obs.levels_completed},bundle_template:{operation_key:'OP18',composition_ref:ref,objective_ref:'G_official_completion',preserve_refs:[],purpose:why,preconditions:facts,evidence,actions,frozen_support_plan:clone(plan),outcome_guard:{path:['value'],contains:ref}}};
  }
  before(p:R,i:number,packet:R,_obs:R):NativeBeforeResult{const plan=p.support_plan,s=orientedCouplingScene(packet.frame_rows,plan.geometry,plan.actor_color);let ok=packet.level===p.binding.level_epoch&&orientedCouplingEqual(p.steps[i].expected_before,s);if(i===0)ok=ok&&packet.frame_hash===plan.frame_hash;return{admitted:ok,reason:'current_controller_part_masks_and_orientation'};}
  after(p:R,i:number,before:R,after:R,_first:NativeRows,second:NativeRows):NativeAfterResult{
    if(after.levels_completed>before.levels_completed)return{matched:true,seal_prefix:true,reason:'official_boundary'};const expected=p.steps[i].expected_after;if(expected===null)return{matched:null,seal_prefix:true,reason:'current_relation_experiment_requires_reconciliation'};
    const plan=p.support_plan,ok=orientedCouplingEqual(expected,orientedCouplingScene(second,plan.geometry,plan.actor_color));return{matched:ok,seal_prefix:!ok||p.steps[i].uncertain,reason:ok?'conditional_rigid_coupling_prediction':'coupling_pose_or_face_contradiction'};
  }
  state():NativeRecord{return clone({format:'oriented_coupling_state.v1',h:this.h,actor_color:this.actor_color,epoch:this.epoch,ready:this.ready,s:this.s,held:this.held,coupled:this.coupled,invitation:this.invitation,known:[...this.known].map(k=>JSON.parse(k)).sort(supportCompare),refs:this.refs,pending_release:this.pending_release,blocked_face:this.blocked_face,tried:[...this.tried].map(k=>JSON.parse(k)).sort(supportCompare)});}
  restore(state:NativeRecord):void{const s=clone(state) as R,required=['format','h','actor_color','epoch','ready','s','held','coupled','invitation','known','refs','pending_release','blocked_face','tried'];
    if(s.format!=='oriented_coupling_state.v1'||!supportSame(Object.keys(s).sort(),required.sort()))throw new TypeError('Incomplete oriented coupling state contract');
    this.h=s.h;this.actor_color=s.actor_color;this.epoch=s.epoch;this.ready=s.ready;this.s=s.s;this.held=s.held;this.coupled=s.coupled;this.invitation=s.invitation;this.known=new Set(s.known.map(v6Canonical));this.refs=s.refs;this.pending_release=s.pending_release;this.blocked_face=s.blocked_face;this.tried=new Set(s.tried.map(v6Canonical));
  }
}
