import type {NativeObservation} from '../logos-engine/v6-native-types.ts';
import type {Edge, Memory} from './preparation-experiments.ts';

export interface OrderTrial {
  origin: number;
  forward: [string,string];
  probe: string;
  controlMotion: Record<string,readonly [number,number]>;
  controlEffect: string;
  refs: number[];
  prefixRefs:number[];
  index: number;
  relatedEvidence?: number;
}
type MotionChange = {role:string; original:readonly number[]; reversed:readonly number[]};
type Discovery = {probe:string; changes:MotionChange[]; revision:number; evidence:number[]};
export type OrderStudy = {
  pending?: {observation:string; trial:OrderTrial};
  attempted: Record<string,true>;
  discoveries: Record<string,Discovery[]>;
};
export const newOrderStudy = ():OrderStudy => ({attempted:{},discoveries:{}});
const orderKey = (origin:number, a:string, b:string) => JSON.stringify([origin,a,b]);
const wordKey = (origin:number, a:string, b:string, c:string) => JSON.stringify([origin,a,b,c]);
export function orderCommand(q:OrderTrial) {
  return q.index===0?q.forward[1]:q.index===1?q.forward[0]:q.probe;
}

function witnessedMotion(edge:Edge) {
  const motion:Record<string,readonly [number,number]> = {};
  for (const role of edge.visibleAfter??[]) motion[role]=[0,0];
  for (const move of edge.effect.moves) if (motion[move.actor]) motion[move.actor]=[move.dx,move.dy];
  return motion;
}

export function chooseOrderTrial(m:Memory,o:NativeObservation,site:number,remaining:number):OrderTrial|undefined {
  const study=m.orderStudy;
  const pending=study?.pending;
  if (pending?.observation===o.observation_ref && 3-pending.trial.index<=remaining &&
      o.available_action_refs.includes(orderCommand(pending.trial))) return pending.trial;
  const history=m.delayed.history, n=history.length;
  if (n<3) return;
  const firstRevision=o.revision-n;
  const edges=history.map((id,i)=>{
    const e=m.edges[id]!;
    return e.stable && e.s===m.revisionScene[firstRevision+i] && e.t===m.revisionScene[firstRevision+i+1] ? e : undefined;
  });
  const completed=new Set<string>();
  for (let i=2;i<n;i++) {
    const a=edges[i-2],b=edges[i-1],c=edges[i];
    if (a&&b&&c) completed.add(wordKey(a.s,a.cmd,b.cmd,c.cmd));
  }
  const last=edges[n-1], prior=edges[n-2];
  let best:OrderTrial|undefined;
  for (let i=2;i<n;i++) {
    const a=edges[i-2], b=edges[i-1], c=edges[i];
    if (!a || !b || !c || a.cmd===b.cmd || a.s===a.t || b.s===b.t || a.s===b.t ||
        [a,b,c].some(e=>e.cmd.includes(':')) || !c.visibleAfter?.length) continue;
    const id=wordKey(a.s,b.cmd,a.cmd,c.cmd);
    if (study?.attempted[id] || completed.has(id)) continue;
    // Match a later chronological prefix. The original witness cannot double as its own control.
    let index:number;
    if (i<n-2 && prior?.s===a.s && prior.cmd===b.cmd && last?.cmd===a.cmd && last.t===site) index=2;
    else if (i<n-1 && last?.s===a.s && last.cmd===b.cmd && last.t===site) index=1;
    else if (site===a.s) index=0;
    else continue;
    if (3-index>remaining) continue;
    const known=study?.discoveries[orderKey(a.s,a.cmd,b.cmd)]??[];
    const related=known.find(d=>d.probe!==c.cmd && d.changes.some(v=>c.visibleAfter!.includes(v.role)))?.revision;
    if (best && (best.index>index || (best.index===index && (!related || best.relatedEvidence)))) continue;
    const q:OrderTrial={origin:a.s,forward:[a.cmd,b.cmd],probe:c.cmd,controlMotion:witnessedMotion(c),
      controlEffect:c.effect.key,index,refs:[firstRevision+i-1,firstRevision+i,firstRevision+i+1],
      prefixRefs:index===2?[o.revision-1,o.revision]:index===1?[o.revision]:[],
      ...(related ? {relatedEvidence:related} : {})};
    if (o.available_action_refs.includes(orderCommand(q))) best=q;
  }
  return best;
}

function compareMovement(control:OrderTrial['controlMotion'],b:NativeObservation,a:NativeObservation) {
  const parts=(o:NativeObservation)=>new Map(o.entities.filter(e=>!e.identity_ambiguous).map(e=>[e.signature,e.position]));
  const before=parts(b), after=parts(a);
  const gained:string[]=[], lost:string[]=[], altered:string[]=[];
  const changes:MotionChange[]=[];
  let compared=0;
  for (const [role,earlier] of Object.entries(control)) {
    const p=before.get(role), q=after.get(role);
    if (!p || !q) continue;
    compared++;
    const observed=[q[0]-p[0],q[1]-p[1]];
    if (observed[0]===earlier[0] && observed[1]===earlier[1]) continue;
    changes.push({role,original:earlier,reversed:observed});
    if (!earlier.some(Boolean)) gained.push(role);
    else if (!observed.some(Boolean)) lost.push(role);
    else altered.push(role);
  }
  return {compared,gained,lost,altered,changes};
}

export function recordOrderTrial(study:OrderStudy,q:OrderTrial,b:NativeObservation,a:NativeObservation) {
  const key=wordKey(q.origin,q.forward[1],q.forward[0],q.probe);
  if (a.levels_completed>b.levels_completed || a.state==='WIN') {
    study.attempted[key]=true;
    return {result:q.index===2?'order_probe_completed_level':'order_preparation_completed_level'};
  }
  if (a.level_epoch!==b.level_epoch || a.state!==b.state) {
    study.attempted[key]=true;
    return {result:'order_trial_ended_at_boundary'};
  }
  if (q.index<2) {
    const next={...q,index:q.index+1,prefixRefs:[...q.prefixRefs,a.revision]};
    if (!a.available_action_refs.includes(orderCommand(next))) {
      study.attempted[key]=true;
      return {result:'continuation_unavailable_after_preparation'};
    }
    study.pending={observation:a.observation_ref,trial:next};
    return {result:'order_preparation_observed'};
  }
  study.attempted[key]=true;
  const measurement=compareMovement(q.controlMotion,b,a);
  if (measurement.changes.length) {
    const id=orderKey(q.origin,...q.forward), bindings=study.discoveries[id]??=[];
    bindings.push({probe:q.probe,changes:measurement.changes,revision:a.revision,evidence:[...q.refs,...q.prefixRefs,a.revision]});
  }
  const result=measurement.changes.length?'preparation_order_changed_the_probe_motion':
    measurement.compared?'same_probe_motion_for_comparable_roles':'probe_subjects_unresolved';
  return {result,orderMeasurement:measurement};
}
