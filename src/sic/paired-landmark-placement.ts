import type {NativeBox, NativeObservation, NativeRows} from '../logos-engine/v6-native-types.ts';
import {add, diff, same, size, type XY} from './access-terrain.ts';
import {aligned, type PartMotion} from './controlled-parts.ts';
import {cellMatches, spatialControls} from './calibrate-spatial-controls.ts';
import type {CursorTrial} from './marked-cursor-selection.ts';
import type {VisualLayout} from './witnessed-preview-transfer.ts';

import {chooseIndicatedAccess,learnIndicatedAccess,newIndicatedMemory,type AccessExperiment,type IndicatedMemory} from './seek-indicated-access.ts';
import {chooseMobileIndication,tileValues} from './plan-mobile-indication.ts';

type Pair = {role:string; sites:XY[]; ref:string};
type Assignment = {
  pair:Pair; home:XY; other:XY; actor:string; peer:string; selection:CursorTrial;
  pitch:XY; firstRef:string; returnRef?:string;
};
export type LandmarkTrial = Assignment & {
  stage:'place_before_selection'|'select_after_contact'|'approach_with_partner_parked';
  command:string; from:XY; expected:XY; guard:XY; basis:string; access?:AccessExperiment;
};
export type LandmarkMemory = {
  pairs:Pair[]; active?:Assignment; parkedRole?:string; secondRole?:string; access?:IndicatedMemory;
  redrawn?:{parked:string;selected:string};
  planAfterSelection?:boolean;
  previousControl?:{parked:string;moving:string;at:XY;ref:string};
  blocked:string[]; tried:string[]; inconclusiveSelections?:string[]; handoff?:boolean; lastResult?:string;
};

export function observeLandmarks(m:LandmarkMemory|undefined, before:VisualLayout, after:VisualLayout, ref:string):LandmarkMemory {
  if(!m) {
    const pairs=Object.entries(before).filter(([,parts])=>parts.length===2)
      .map(([role,parts])=>({role,sites:parts.map(p=>p.at),ref}));
    m={pairs,blocked:[],tried:[]};
  }
  // An absent mark may be covered. A mark appearing at a third position disproves stationarity.
  m.pairs=m.pairs.filter(p=>!(after[p.role]??[]).some(v=>!p.sites.some(s=>same(s,v.at))));
  if(m.active && !m.pairs.some(p=>p.role===m.active!.pair.role))drop(m);
  return m;
}
function drop(m:LandmarkMemory) {
  delete m.active;delete m.handoff;delete m.parkedRole;delete m.secondRole;delete m.redrawn;delete m.access;
}
function bodyRole(layout:VisualLayout,box:NativeBox) {
  const matches=Object.entries(layout).filter(([,g])=>g.length===1 && g[0]!.box.every((v,i)=>v===box[i]));
  if(matches.length===1)return matches[0]![0];
  // A selection highlight can surround the measured body. Use an enclosed
  // singleton only when the visual layout gives it an unambiguous identity.
  const enclosed=Object.entries(layout).filter(([,g])=>{
    if(g.length!==1)return false;
    const b=g[0]!.box;
    return b[0]!>=box[0] && b[1]!>=box[1] && b[2]!<=box[2] && b[3]!<=box[3];
  });
  return enclosed.length===1?enclosed[0]![0]:undefined;
}
function singleton(l:VisualLayout,role:string){const g=l[role];return g?.length===1?g[0]:undefined;}
function redrawnRole(before:VisualLayout,after:VisualLayout,site:XY,pitch:XY) {
  const changed=Object.keys(after).filter(role=>{
    const body=singleton(after,role);
    return body && cellMatches(body.at,site,pitch) && !before[role]?.some(p=>p.form===body.form && same(p.at,body.at));
  });
  return changed.length===1?changed[0]:undefined;
}
function covered(l:VisualLayout,a:Assignment,site:XY) {
  return !l[a.pair.role]?.some(p=>cellMatches(p.at,site,a.pitch));
}
function movement(motions:Record<string,PartMotion>,role:string,o:NativeObservation,pair:Pair) {
  const motion=motions[role];
  const separation=diff(pair.sites[0]!,pair.sites[1]!);
  return motion && spatialControls(motion,new Set(o.available_action_refs.filter(k=>/^ACTION[1-4]$/.test(k))),'',{},o.frame_hash,role,
    length=>separation.every(delta=>delta%length===0));
}
const edgeKey=(role:string,at:XY,op:string)=>JSON.stringify([role,at,op]);
function nearestAssignment(m:LandmarkMemory,l:VisualLayout,o:NativeObservation,selection:CursorTrial,motions:Record<string,PartMotion>):Assignment|undefined {
  if(selection.stage!=='select'||!selection.contrast)return;
  const actor=bodyRole(l,selection.source.box),peer=bodyRole(l,selection.target.box);
  if(!actor||!peer||actor===peer)return;
  if(m.inconclusiveSelections?.includes(JSON.stringify([peer,l[peer]![0]!.at])))return;
  const from=l[actor]![0]!.at, retained=l[peer]![0]!.at;
  const options:{a:Assignment;cost:number;first:number}[]=[];
  for(const pair of m.pairs){
    if(pair.role===actor||pair.role===peer||l[pair.role]?.length!==2)continue;
    const control=movement(motions,actor,o,pair);
    if(!control)continue;
    for(const [i,home] of pair.sites.entries()){
      const other=pair.sites[1-i]!,first=size(diff(home,from)),second=size(diff(other,retained));
      if(first>second || m.tried.includes(JSON.stringify([actor,peer,pair.role,home])))continue;
      const rebound=m.previousControl;
      const returnRef=rebound?.moving===actor&&rebound.parked===peer?rebound.ref:undefined;
      options.push({a:{actor,peer,home,other,selection,pitch:control.pitch,pair,firstRef:o.observation_ref,...(returnRef?{returnRef}:{})},cost:first+second,first});
    }
  }
  options.sort((a,b)=>a.cost-b.cost||a.first-b.first);
  return options[0]?.a;
}
// Route over the measured motor lattice. Unknown cells are legal experiments,
// exposed substrate costs less, and a refuted edge is local to the actor and site.
function nextStep(m:LandmarkMemory,a:Assignment,role:string,from:XY,goal:XY,guard:XY,o:NativeObservation,rows:NativeRows,motions:Record<string,PartMotion>,limit:number) {
  const controls=movement(motions,role,o,a.pair)??movement(motions,a.actor,o,a.pair);
  if(!controls||!same(controls.pitch,a.pitch))return;
  const ground=Object.entries(motions[role]?.substrate??{}).sort((x,y)=>y[1]-x[1])[0]?.[0];
  const start=aligned(from,goal,a.pitch),dist=(p:XY)=>size(diff(p,goal))/a.pitch[0];
  type Step={op:string;at:XY;basis:string};
  const queue:{p:XY;cost:number;estimate:number;first?:Step}[]=[{p:start,cost:0,estimate:dist(start)}];
  const best=new Map<string,number>([[start.join(),0]]);
  for(let i=0;i<limit&&queue.length;i++){
    queue.sort((x,y)=>y.estimate-x.estimate||y.cost-x.cost);
    const cur=queue.pop()!;
    if(cur.cost!==best.get(cur.p.join()))continue;
    if(same(cur.p,goal))return cur.first;
    for(const motor of controls.motors){
      if(m.blocked.includes(edgeKey(role,cur.p,motor.op)))continue;
      const at=add(cur.p,motor.d);
      if(at[0]<0||at[1]<0||at[0]>2*(rows[0]!.length-1)||at[1]>2*(rows.length-1)||cellMatches(at,guard,a.pitch))continue;
      const pixel=rows[Math.round(at[1]/2)]?.[Math.round(at[0]/2)];
      const unknown=ground!==undefined && String(pixel)!==ground && !same(at,goal);
      const cost=cur.cost+1+Number(unknown)*controls.motors.length;
      if(cost>=(best.get(at.join())??Infinity))continue;
      best.set(at.join(),cost);
      queue.push({p:at,cost,estimate:cost+dist(at),first:cur.first??{op:motor.op,at,basis:motor.basis}});
    }
  }
}
function accessContext(m:LandmarkMemory){
  const a=m.active;
  return a&&m.secondRole&&m.parkedRole?{actor:m.secondRole,parked:m.parkedRole,home:a.home,goal:a.other,pitch:a.pitch}:undefined;
}
export function observeLandmarkAccess(m:LandmarkMemory,before:VisualLayout,after:VisualLayout,b:NativeObservation,a:NativeObservation,rows:NativeRows,next:NativeRows,op:string,t?:LandmarkTrial){
  if(t?.stage==='place_before_selection'){
    const start=singleton(before,t.actor),end=singleton(after,t.actor),still=singleton(after,t.peer);
    if(start&&end&&still&&cellMatches(still.at,t.guard,t.pitch)&&!cellMatches(start.at,end.at,t.pitch)){
      const sites=((m.access??=newIndicatedMemory()).partnerSites??={});
      sites[aligned(start.at,t.other,t.pitch).join()]=b.observation_ref;
      sites[aligned(end.at,t.other,t.pitch).join()]=a.observation_ref;
    }
  }
  if(t?.stage==='place_before_selection' && !covered(before,t,t.home) && covered(after,t,t.home) && cellMatches(singleton(after,t.actor)?.at??null,t.home,t.pitch)){
    const prepared:{at:XY;appearance:string;ref:string}[]=[];
    for(let y=t.home[1]%t.pitch[1];y<=2*(rows.length-1);y+=t.pitch[1])for(let x=t.home[0]%t.pitch[0];x<=2*(rows[0]!.length-1);x+=t.pitch[0]){
      const at:XY=[x,y];if([t.home,t.guard,t.from].some(site=>cellMatches(at,site,t.pitch)))continue;
      const initial=tileValues(rows,at,t.pitch),later=tileValues(next,at,t.pitch);
      if(initial.length===later.length&&later.filter((v,i)=>v!==initial[i]).length*2>later.length)
        prepared.push({at,appearance:later.join(),ref:a.observation_ref});
    }
    (m.access??=newIndicatedMemory()).preparedGround=prepared;
  }
  const c=accessContext(m);
  if(c)learnIndicatedAccess(m.access??=newIndicatedMemory(),c,b.frame_hash,a.frame_hash,before,after,op,a.observation_ref,t?.expected,t?.access);
}
export function proposeLandmark(m:LandmarkMemory,l:VisualLayout,o:NativeObservation,rows:NativeRows,motions:Record<string,PartMotion>,candidate:CursorTrial|null,limit:number,accessDepth?:number):LandmarkTrial|undefined {
  const a=m.active??(candidate && nearestAssignment(m,l,o,candidate,motions));
  if(!a||m.handoff&&!m.secondRole)return;
  const role=m.secondRole??a.actor,peer=m.parkedRole??a.peer,body=singleton(l,role),parked=singleton(l,peer);
  if(!body||!parked||m.secondRole&&(!cellMatches(parked.at,a.home,a.pitch)||!covered(l,a,a.home)))return;
  const goal=m.secondRole?a.other:a.home;
  if(cellMatches(body.at,goal,a.pitch)){
    if(m.secondRole||!covered(l,a,goal))return;
    return {...a,stage:'select_after_contact',command:a.selection.command,from:body.at,expected:body.at,guard:parked.at,basis:'observed_contact'};
  }
  const c=accessContext(m);
  if(c&&accessDepth&&m.access){
    const controls=movement(motions,role,o,a.pair)??movement(motions,a.actor,o,a.pair);
    const floor=Object.entries(motions[role]?.substrate??{}).sort((x,y)=>y[1]-x[1])[0];
    let plan=m.access.mobilePending;
    const pending=plan?.path[0];
    if(plan&&pending && (!cellMatches(body.at,pending.from,c.pitch)||!cellMatches(singleton(l,plan.pivot)?.at??null,pending.centre,c.pitch)||
      pending.read&&!cellMatches(singleton(l,plan.cue)?.at??null,pending.expected,c.pitch)))plan=undefined;
    if(!plan&&controls&&m.access.repair)plan=chooseMobileIndication(m.access,c,o.frame_hash,rows,controls.motors,o.available_action_refs,accessDepth,limit,floor?Number(floor[0]):undefined);
    if(plan){
      const step=plan.path[0]!,access:AccessExperiment={purpose:'use_mobile_indication',command:step.command,expected:step.expected,
        cue:plan.cue,origin:o.frame_hash,probe:step.command,ref:plan.ref,mobile:plan};
      return {...a,stage:'approach_with_partner_parked',command:step.command,from:body.at,expected:step.expected,guard:parked.at,basis:access.purpose,access};
    }
  }
  if(c&&accessDepth&&m.access?.repair && size(diff(aligned(body.at,c.goal,c.pitch),goal))>c.pitch[0]){
    const controls=movement(motions,role,o,a.pair)??movement(motions,a.actor,o,a.pair);
    const access=controls&&chooseIndicatedAccess(m.access,c,o.frame_hash,controls.motors,o.available_action_refs,{maxNodes:limit,maxDepth:accessDepth});
    if(access)return {...a,stage:'approach_with_partner_parked',command:access.command,from:body.at,expected:access.expected,guard:parked.at,basis:access.purpose,access};
  }
  const step=nextStep(m,a,role,body.at,goal,parked.at,o,rows,motions,limit);
  if(step)return {...a,stage:m.secondRole?'approach_with_partner_parked':'place_before_selection',command:step.op,
    from:body.at,expected:step.at,guard:parked.at,basis:step.basis};
}
export function refreshedSelection(t:LandmarkTrial,l:VisualLayout):CursorTrial {
  const box=singleton(l,t.actor)!.box;
  return {...t.selection,source:{...t.selection.source,box:[box[0]!,box[1]!,box[2]!,box[3]!]},
    evidence:[...t.selection.evidence,t.pair.ref,t.firstRef]};
}
export function observePlacement(m:LandmarkMemory,t:LandmarkTrial|undefined,l:VisualLayout,cursorResult:string|undefined,selection:CursorTrial|undefined,before:VisualLayout,pending?:CursorTrial,observationRef?:string) {
  if(m.planAfterSelection && selection?.stage==='select')delete m.previousControl;
  if(t){
    m.active??={pair:t.pair,home:t.home,other:t.other,actor:t.actor,peer:t.peer,selection:t.selection,pitch:t.pitch,firstRef:t.firstRef,...(t.returnRef?{returnRef:t.returnRef}:{})};
    if(t.stage==='select_after_contact'){
      // A predicted change of the highlight can fail while the control test
      // remains pending. The next motor determines whether the subject switched.
      if(pending?.stage==='verify'){
        m.handoff=true;
        const parked=redrawnRole(before,l,t.home,t.pitch),selected=redrawnRole(before,l,t.guard,t.pitch);
        if(parked && selected && parked!==selected)m.redrawn={parked,selected};
      }
      else {m.tried.push(JSON.stringify([t.actor,t.peer,t.pair.role,t.home]));drop(m);}
      return m.lastResult=cursorResult;
    }
    const role=m.secondRole??t.actor,peer=m.parkedRole??t.peer;
    const body=singleton(l,role),parked=singleton(l,peer),goal=m.secondRole?t.other:t.home;
    if(!parked||!cellMatches(parked.at,t.guard,t.pitch)||!body){drop(m);return m.lastResult='subject_or_parked_position_lost';}
    if(t.access?.purpose==='test_indication')return m.lastResult=cellMatches(body.at,t.expected,t.pitch)?'indicated_arrival_with_partner_parked':'indicated_arrival_refuted';
    if(cellMatches(body.at,t.expected,t.pitch)){
      return m.lastResult=cellMatches(body.at,goal,t.pitch)&&covered(l,t,goal)?'subject_covers_named_landmark':'approach_matched_with_partner_parked';
    }
    const key=edgeKey(role,aligned(t.from,goal,t.pitch),t.command);
    if(!m.blocked.includes(key))m.blocked.push(key);
    return m.lastResult='approach_refuted_replan';
  }
  if(selection?.stage==='select' && cursorResult==='cursor_click_visually_unchanged'){
    const peer=bodyRole(before,selection.target.box);
    if(peer){
      const key=JSON.stringify([peer,before[peer]![0]!.at]), sites=m.inconclusiveSelections??=[];
      if(!sites.includes(key))sites.push(key);
    }
  }
  if(m.planAfterSelection && !m.active && selection?.stage==='verify' &&
    cursorResult==='new_cursor_moved_while_previous_cursor_stayed' && observationRef) {
    const parked=bodyRole(before,selection.source.box),moving=bodyRole(before,selection.target.box);
    const old=parked&&singleton(before,parked),still=parked&&singleton(l,parked);
    const from=moving&&singleton(before,moving),to=moving&&singleton(l,moving);
    if(parked && moving && parked!==moving && old && still && same(old.at,still.at) && from && to && !same(from.at,to.at)){
      m.previousControl={parked,moving,at:still.at,ref:observationRef};
    }
  }
  if(!m.active||!m.handoff||!selection||selection.stage!=='verify')return;
  if(cursorResult==='new_cursor_moved_while_previous_cursor_stayed'){
    const peer=m.redrawn?.parked??bodyRole(before,selection.source.box),actor=m.redrawn?.selected??bodyRole(before,selection.target.box);
    const old=peer&&singleton(l,peer),previous=actor&&singleton(before,actor),moving=actor&&singleton(l,actor);
    if(peer&&actor&&old&&previous&&moving&&cellMatches(old.at,m.active.home,m.active.pitch)&&!cellMatches(moving.at,previous.at,m.active.pitch)){
      m.parkedRole=peer;m.secondRole=actor;return;
    }
  }
  drop(m);
}
