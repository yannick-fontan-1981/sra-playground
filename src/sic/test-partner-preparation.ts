import {add, type XY} from './access-terrain.ts';
import {cellMatches} from './calibrate-spatial-controls.ts';
import type {VisualLayout} from './witnessed-preview-transfer.ts';
import type {NativeObservation,NativeRows} from '../logos-engine/v6-native-types.ts';

export type PartnerPhase='select_partner'|'move_partner'|'restore_subject'|'retry';
export type VerifiedPartnerForms={actor:string;peer:string;alternateActor:string;alternatePeer:string;ref:string};
export type PartnerTest={
  phase:PartnerPhase; actor:string; peer:string; origin:XY; destination:XY; initialPartner:XY; partnerAt:XY;
  blockedMotor:string; prepareMotor:string; prepareDelta:XY; refusal:string; motorRef:string;
  originalPatch:string; alternateActor?:string; alternatePeer?:string; verifiedForms?:VerifiedPartnerForms;
};
export type PartnerOffer={phase:PartnerPhase;command:string;from:XY;expected:XY;guard:XY;changedSite?:boolean};

export function sitePatch(rows:NativeRows,at:XY,pitch:XY){
  const [x,y]=at.map(v=>Math.round(v/2)),radius=Math.max(0,Math.floor(Math.min(...pitch)/4));
  const values:number[]=[];
  for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++)values.push(rows[y!+dy]?.[x!+dx]??-1);
  return values.join();
}
const single=(l:VisualLayout,k:string|undefined)=>k && l[k]?.length===1?l[k]![0]:undefined;
export function observedBodyClick(l:VisualLayout,k:string,o:NativeObservation){
  const body=single(l,k);
  if(!body||!o.available_action_refs.includes('ACTION6'))return;
  const entity=o.entities.find(e=>e.signature===body.form && e.bbox.every((v,i)=>v===body.box[i]));
  if(!entity?.mask.length)return;
  const [cx,cy]=body.at, [left,top]=entity.bbox;
  let best=Infinity,point:XY|undefined;
  for(const [dx,dy] of entity.mask){
    const x=left+dx,y=top+dy,d=Math.abs(2*x-cx)+Math.abs(2*y-cy);
    if(d<best){best=d;point=[x,y];}
  }
  return point?'ACTION6:'+point.join():undefined;
}
export function nextPartnerTest(s:PartnerTest,l:VisualLayout,o:NativeObservation,rows:NativeRows,pitch:XY):PartnerOffer|undefined{
  const otherControls=s.phase==='move_partner'||s.phase==='restore_subject';
  const subject=single(l,otherControls?s.alternateActor:s.actor),partner=single(l,otherControls?s.alternatePeer:s.peer);
  if(!cellMatches(subject?.at??null,s.origin,pitch)||!cellMatches(partner?.at??null,s.partnerAt,pitch))return;
  if(s.phase==='move_partner' && o.available_action_refs.includes(s.prepareMotor))
    return {phase:s.phase,command:s.prepareMotor,from:s.partnerAt,expected:add(s.partnerAt,s.prepareDelta),guard:s.origin};
  if(s.phase==='retry' && o.available_action_refs.includes(s.blockedMotor))
    return {phase:s.phase,command:s.blockedMotor,from:s.origin,expected:s.destination,guard:s.partnerAt,
      changedSite:sitePatch(rows,s.destination,pitch)!==s.originalPatch};
  const target=s.phase==='select_partner'?s.peer:s.phase==='restore_subject'?s.alternateActor:undefined;
  const click=target&&observedBodyClick(l,target,o);
  if(click)return {phase:s.phase,command:click,from:s.origin,expected:s.origin,guard:s.partnerAt};
}
function redrawn(before:VisualLayout,after:VisualLayout,site:XY,pitch:XY){
  const roles=Object.keys(after).filter(k=>{
    const next=single(after,k);
    return next&&cellMatches(next.at,site,pitch)&&!cellMatches(single(before,k)?.at??null,site,pitch);
  });
  return roles;
}
export function advancePartnerTest(s:PartnerTest,before:VisualLayout,after:VisualLayout,pitch:XY){
  if(s.phase==='select_partner'){
    const actors=redrawn(before,after,s.origin,pitch),peers=redrawn(before,after,s.partnerAt,pitch);
    const known=s.verifiedForms;
    const matches=known?.actor===s.actor&&known.peer===s.peer&&actors.includes(known.alternateActor)&&peers.includes(known.alternatePeer);
    const actor=matches?known.alternateActor:actors.length===1?actors[0]:undefined;
    const peer=matches?known.alternatePeer:peers.length===1?peers[0]:undefined;
    if(!actor||!peer||actor===peer)return 'lost';
    s.alternateActor=actor;s.alternatePeer=peer;s.phase='move_partner';return 'partner_selected';
  }
  if(s.phase==='move_partner'){
    const guard=single(after,s.alternateActor),partner=single(after,s.alternatePeer);
    if(!partner||!cellMatches(guard?.at??null,s.origin,pitch))return 'lost';
    const matched=cellMatches(partner.at,add(s.partnerAt,s.prepareDelta),pitch);
    s.partnerAt=partner.at;s.phase='restore_subject';
    return matched?'partner_preparation_confirmed':'partner_preparation_refuted';
  }
  if(s.phase==='restore_subject'){
    if(!cellMatches(single(after,s.actor)?.at??null,s.origin,pitch)||
       !cellMatches(single(after,s.peer)?.at??null,s.partnerAt,pitch))return 'lost';
    s.phase='retry';return 'subject_reselected';
  }
  if(!cellMatches(single(after,s.peer)?.at??null,s.partnerAt,pitch))return 'lost';
  const actor=single(after,s.actor);if(!actor)return 'lost';
  return !cellMatches(s.partnerAt,s.initialPartner,pitch)&&cellMatches(actor.at,s.destination,pitch)?'released':'still_blocked';
}
