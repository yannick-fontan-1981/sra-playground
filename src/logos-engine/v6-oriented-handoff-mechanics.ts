/** Exact called closure of V5 oriented_cargo_handoffs._move/_interaction.
 * Source 786dcf51ca57773d8e3a8948ce9ea3655e7baf8e. Hypothetical transitions
 * preserve unknown support, class evidence, locked facing and owned cargo.
 */
import { supportCompare, supportKey, supportPoint } from './v6-support-measurements.ts';
export type HandoffRecord = Record<string, any>;
type R = HandoffRecord;
export type HandoffCalculation = [R, R[], string[], number, R];
const actorFor=(s:R,ref:any):R|undefined=>s.actors.find((a:R)=>a.actor_ref===ref);
const cargoFor=(s:R,ref:any):R|undefined=>s.cargo.find((c:R)=>c.cargo_ref===ref);
const mask=(o:R):number[][]=>o.offsets.map(([x,y]:number[])=>[o.x+x!,o.y+y!]);
const workFor=(s:R):number=>3*s.terrain.length+4*s.actors.reduce((n:number,a:R)=>n+a.offsets.length,0)+4*s.cargo.reduce((n:number,c:R)=>n+c.offsets.length,0);
const points=(values:Set<string>):number[][]=>[...values].map(supportPoint).sort(supportCompare);

export function handoffBlocked(state:R,actor:R,actorMask:number[][],cargo:R|null=null,cargoMask:number[][]=[]):[number[][],number[][]]{
  const terrain=new Map<string,R>(state.terrain.map((t:R)=>[JSON.stringify([t.x,t.y,t.actor_type_ref]),t]));
  const obstacles=new Set<string>([...state.actors.filter((other:R)=>other.actor_ref!==actor.actor_ref&&other.alive).flatMap(mask),
    ...state.cargo.filter((other:R)=>cargo===null||other.cargo_ref!==cargo.cargo_ref).flatMap(mask)].map(supportKey));
  const blocked=new Set<string>(),unknown=new Set<string>();
  for(const[type,values]of [[actor.type_ref,actorMask],[cargo?.type_ref??null,cargoMask]] as [string|null,number[][]][])for(const point of values){
    const key=supportKey(point),row=terrain.get(JSON.stringify([...point,type]));
    if(obstacles.has(key)||row?.traversable===false)blocked.add(key);
    else if(!row||row.traversable==null||row.evidence_ref==null)unknown.add(key);
  }
  return [points(blocked),points(unknown)];
}

export function handoffMove(state:R,model:R,actorRef:string,dx:number,dy:number,maximum:number,allowHypothetical=false):HandoffCalculation{
  const actor=actorFor(state,actorRef),work=workFor(state);
  if(work>maximum)return[state,[],[],0,{phase:'oriented_actor_pair_geometry'}];
  if(Math.abs(dx)+Math.abs(dy)!==1)return[state,[],['supplied_single_cell_direction'],work,{}];
  if(!actor||!actor.alive)return[state,[],['current_living_addressed_actor'],work,{}];
  const held=actor.held_cargo_ref!=null?cargoFor(state,actor.held_cargo_ref):undefined;
  if(actor.held_cargo_ref!=null&&(!held||held.holder_ref!==actor.actor_ref))return[state,[],['current_exact_cargo_actor_coupling'],work,{}];
  let faced=actor;
  if(!held){
    if(model.free_facing==='UNKNOWN'||(model.free_facing_evidence_ref==null||model.free_move_evidence_ref==null)&&!allowHypothetical)return[state,[],['current_free_facing_and_move_law'],work,{}];
    if(model.free_facing==='BEFORE_TRANSLATION')faced={...actor,face:[dx,dy]};
  }else if(actor.locked_interaction_face==null||model.coupling_evidence_ref==null&&!allowHypothetical)return[state,[],['current_locked_pair_face_and_rigid_coupling'],work,{}];
  const actorMask=mask(actor).map(([x,y])=>[x!+dx,y!+dy]),cargoMask=held?mask(held).map(([x,y])=>[x!+dx,y!+dy]):[];
  const[blocked,unknown]=handoffBlocked(state,actor,actorMask,held??null,cargoMask);
  if(unknown.length&&!blocked.length)return[state,[{kind:'UNKNOWN_PAIR_SUPPORT',cells:unknown}],['current_actor_and_cargo_class_support'],work,{}];
  const moved=blocked.length===0;let changed=faced;
  if(moved){changed={...faced,x:actor.x+dx,y:actor.y+dy};if(!held&&model.free_facing==='AFTER_SUCCESSFUL_TRANSLATION')changed={...changed,face:[dx,dy]};}
  const actors=state.actors.map((a:R)=>a.actor_ref===actorRef?changed:a),cargo=moved&&held?state.cargo.map((c:R)=>c.cargo_ref===held.cargo_ref?{...c,x:c.x+dx,y:c.y+dy}:c):state.cargo;
  return[{...state,actors,cargo},[{kind:held?'RIGID_PAIR_MOVE':'FREE_MOVE',actor_ref:actorRef,moved,refusal_mask:blocked,before_face:actor.face,after_face:changed.face,
    locked_face_preserved:!!held,whole_actor_mask:actorMask,whole_cargo_mask:cargoMask,own_vacated_cells_are_static_blockers:false}],[],work,{}];
}

export function handoffFrontCondition(state:R,model:R,actorRef:string,targetRef:string,kind:string,allowHypothetical=false):[any[]|null,string[]]{
  const actor=actorFor(state,actorRef),cargo=cargoFor(state,targetRef),targetActor=actorFor(state,targetRef);
  if(!actor||!actor.alive||!cargo&&!targetActor)return[null,['current_addressed_actor_and_target_type']];
  const targetType=(cargo??targetActor)!.type_ref,rules=model.interaction_rules.filter((r:R)=>r.actor_type_ref===actor.type_ref&&r.target_type_ref===targetType&&r.kind===kind);
  if(rules.length!==1)return[null,['unique_current_type_interaction_law']];
  const rule=rules[0];if(rule.evidence_ref==null&&!allowHypothetical)return[null,['current_type_front_interaction_evidence']];
  const face=actor.held_cargo_ref!=null?actor.locked_interaction_face:actor.face;
  if(face==null)return[null,['current_interaction_face']];
  if(rule.front_required&&Math.abs(face[0])+Math.abs(face[1])!==1)return[null,['current_unit_front_interaction_face']];
  const targetMask=mask((cargo??targetActor)!),frontCell=[actor.x+face[0],actor.y+face[1]],contact=targetMask.some(p=>supportKey(p)===supportKey(frontCell));
  const facts={actor_ref:actorRef,target_ref:targetRef,actor_type_ref:actor.type_ref,target_type_ref:targetType,rule_evidence_ref:rule.evidence_ref,
    front_required:rule.front_required,effective_face:face,face_locked:actor.held_cargo_ref!=null,front_cell:frontCell,target_mask:targetMask,front_contact:contact,
    front_precondition_satisfied:!rule.front_required||contact,actor_held_cargo_ref:actor.held_cargo_ref,target_holder_ref:cargo?.holder_ref??null,
    target_is_cargo:!!cargo,state_status:state.status,target_delivery_acquired:cargo?.delivery_acquired??false,delivered_cargo_regrasp_allowed:rule.delivered_cargo_regrasp_allowed,
    level_scope_ref:state.level_scope_ref,restore_epoch:state.restore_epoch,input_tick:state.input_tick,autonomous_phase:state.autonomous_phase};
  return[[actor,cargo??null,targetActor??null,rule,face,facts],[]];
}

export function handoffInteraction(state:R,model:R,actorRef:string,targetRef:string,kind:string,maximum:number,allowHypothetical=false):HandoffCalculation{
  const work=workFor(state)+model.interaction_rules.length;
  if(work>maximum)return[state,[],[],0,{phase:'front_conditioned_interaction'}];
  const[measured,missing]=handoffFrontCondition(state,model,actorRef,targetRef,kind,allowHypothetical);
  if(missing.length)return[state,[],missing,work,{}];
  const[actor,cargo,targetActor,rule,face,front]=measured!;
  if(!front.front_precondition_satisfied)return[state,[{kind:'FRONT_INTERACTION_REFUSED',actor_ref:actorRef,target_ref:targetRef}],[],work,{}];
  let actors=state.actors,objects=state.cargo,receivers=state.receivers,details:R={};
  if(kind==='ATTACH'){
    if(!cargo||actor.held_cargo_ref!=null||cargo.holder_ref!=null)return[state,[],['current_free_actor_and_unowned_cargo'],work,{}];
    if(cargo.delivery_acquired&&!rule.delivered_cargo_regrasp_allowed)return[state,[{kind:'ACQUIRED_CARGO_REGRASP_REFUSED',cargo_ref:cargo.cargo_ref}],[],work,{}];
    if(cargo.delivery_acquired&&rule.acquisition_retained_on_regrasp==null)return[state,[],['current_delivery_retention_or_reclaim_law'],work,{}];
    const retained=cargo.delivery_acquired&&rule.acquisition_retained_on_regrasp===true;
    actors=actors.map((a:R)=>a.actor_ref===actorRef?{...actor,held_cargo_ref:cargo.cargo_ref,locked_interaction_face:face}:a);
    objects=objects.map((c:R)=>c.cargo_ref===cargo.cargo_ref?{...c,holder_ref:actorRef,delivery_acquired:retained}:c);
    if(cargo.delivery_acquired&&!retained)receivers=receivers.map((r:R)=>({...r,acquired_cargo_refs:r.acquired_cargo_refs.filter((ref:string)=>ref!==cargo.cargo_ref)}));
    details={coupling_offset:[cargo.x-actor.x,cargo.y-actor.y],locked_face:face};
  }else if(kind==='RELEASE'){
    if(!cargo||actor.held_cargo_ref!==cargo.cargo_ref||cargo.holder_ref!==actorRef)return[state,[],['current_owned_cargo_release'],work,{}];
    actors=actors.map((a:R)=>a.actor_ref===actorRef?{...actor,held_cargo_ref:null,locked_interaction_face:null}:a);
    const matches=receivers.filter((r:R)=>r.type_refs.includes(cargo.type_ref)&&mask(cargo).every(p=>r.cells.some((c:number[])=>supportKey(p)===supportKey(c)))&&r.acquired_cargo_refs.length<r.capacity);
    if(matches.length>1)return[state,[],['current_competing_receiver_selection'],work,{}];
    if(matches.length&&matches[0].delivery_evidence_ref==null)return[state,[],['current_receiver_acceptance_evidence'],work,{}];
    const acquired=!!(matches.length&&matches[0].delivery_evidence_ref!=null);
    objects=objects.map((c:R)=>c.cargo_ref===cargo.cargo_ref?{...c,holder_ref:null,delivery_acquired:c.delivery_acquired||acquired}:c);
    if(acquired)receivers=receivers.map((r:R)=>r.receiver_ref===matches[0].receiver_ref?{...r,acquired_cargo_refs:[...r.acquired_cargo_refs,cargo.cargo_ref]}:r);
    details={temporary_deposit:!acquired,receiver_ref:matches[0]?.receiver_ref??null,delivery_supported:acquired};
  }else if(kind==='REMOVE_ACTOR'){
    if(!targetActor)return[state,[],['current_removal_actor'],work,{}];
    const carried=cargoFor(state,targetActor.held_cargo_ref);
    if(carried&&rule.release_carried_after_actor_removal==null)return[state,[],['current_removed_actor_cargo_lifecycle'],work,{}];
    actors=actors.map((a:R)=>a.actor_ref===targetActor.actor_ref?{...targetActor,alive:false,held_cargo_ref:null,locked_interaction_face:null}:a);
    if(carried){if(rule.release_carried_after_actor_removal)objects=objects.map((c:R)=>c.cargo_ref===carried.cargo_ref?{...c,holder_ref:null}:c);
      else return[state,[],['explicit_retained_or_removed_cargo_policy_after_actor_removal'],work,{}];}
    details={removed_actor_ref:targetActor.actor_ref,cargo_deleted_without_supported_removal:false};
  }else{
    if(!cargo)return[state,[],['current_explicit_cargo_removal_target'],work,{}];
    objects=objects.filter((c:R)=>c.cargo_ref!==cargo.cargo_ref);actors=actors.map((a:R)=>a.held_cargo_ref===cargo.cargo_ref?{...a,held_cargo_ref:null,locked_interaction_face:null}:a);
    details={explicitly_supported_cargo_removal:true};
  }
  const after={...state,actors,cargo:objects,receivers};return[after,[{kind,actor_ref:actorRef,target_ref:targetRef,after_state:after,...details}],[],work,{}];
}
