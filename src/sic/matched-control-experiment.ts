import type { NativeObservation } from '../logos-engine/v6-native-types.ts';
import type { Memory, Edge } from './preparation-experiments.ts';
import { groupsOf, resolveRole, type Role } from './exchange-roles.ts';
import { same, diff, add, type XY } from './access-terrain.ts';
import { observedPositionAfter } from './witnessed-capacity-word.ts';

export type ControlFork = {
  root: string; branch: string; otherBranch: string; prepare: string; rival: string; trigger: string;
  subject: Role; reference: Role; subjectAt: XY; markerAt: XY; otherMarker: XY; priority:number; firstMotion:boolean;
  otherResult: XY; possible: XY[]; refs: [number, number, number];
};
export type ControlRule = {
  fork: ControlFork; arrived: XY; measuredAt: number; attempts: Record<string, number>;
  tested: number; correct: number; refuted: boolean;
};
export type ControlStudy = { rules: ControlRule[]; examined: Record<string, number> };
export const controlStudy = (): ControlStudy => ({rules: [], examined: {}});
const roleKey = (r: Role) => JSON.stringify([r.signature,r.fixed]);
const seenMoves = (e: Edge) => e.manipulation?.moves ?? e.effect.moves.map(v=>({
  role:{signature:v.actor,fixed:[]},from:v.from.split(',').map(Number) as XY,to:v.to.split(',').map(Number) as XY
}));
const seen = (m: Memory, e: Edge, role: Role) => observedPositionAfter(m,e,role);
const known = (a: XY | null, b: XY | null): a is XY => !!a && !!b && same(a,b);
export const forkKey = (f: ControlFork) => JSON.stringify([f.root,f.branch,f.otherBranch,f.trigger,f.subject,f.reference]);

// Both preparations begin in the same public scene and take one command. The rival's
// preparation and probe must have been played consecutively at the cited revisions.
export function openControlForks(m: Memory, o: NativeObservation, scene: number, available: Set<string>, eligible?: Set<string>): ControlFork[] {
  const history=m.delayed.history, n=history.length, last=m.edges[history[n-1]!];
  if(n<3||!last?.stable||last.t!==scene||m.revisionScene[o.revision-1]!==last.s||m.revisionScene[o.revision]!==scene)return [];
  const groups=groupsOf(o), origins=new Map<string,Role>(), moves=new Map<string,Map<string,XY[]>>();
  for(const edge of m.edges)if(edge.stable)for(const motion of seenMoves(edge)){
    if(eligible&&!eligible.has(motion.role.signature))continue;
    const id=roleKey(motion.role);origins.set(id,motion.role);
    const commands=moves.get(id)??new Map<string,XY[]>(), ds=commands.get(edge.cmd)??[];
    const d=diff(motion.to,motion.from);
    if(!ds.some(x=>same(x,d)))ds.push(d);
    commands.set(edge.cmd,ds);moves.set(id,commands);
  }
  const tried=new Set(m.edges.filter(e=>e.s===scene).map(e=>e.cmd)),out:ControlFork[]=[],unique=new Set<string>();
  for(let j=n-3;j>=0;j--){
    const a=m.edges[history[j]!]!,q=m.edges[history[j+1]!]!,ref=o.revision-n+j+1;
    if(!a.stable||!q.stable||last.s!==a.s||last.cmd===a.cmd||scene===a.t||a.t!==q.s||
      m.revisionScene[ref-1]!==a.s||m.revisionScene[ref]!==a.t||m.revisionScene[ref+1]!==q.t||
      !available.has(q.cmd)||tried.has(q.cmd))continue;
    const markers=new Map([...seenMoves(last),...seenMoves(a)].map(v=>[roleKey(v.role),v.role]));
    for(const marker of markers.values()){
      const referenceEntity=resolveRole(groups,marker),r=referenceEntity?.position,other=seen(m,a,marker);
      if(!referenceEntity||!r||!other||same([...r],other))continue;
      const gap=(box: readonly number[],at: XY)=>{
        const dx=at[0]-r[0],dy=at[1]-r[1],bb=referenceEntity.bbox;
        return Math.max(0,bb[0]+dx-box[2]!-1,box[0]!-bb[2]-dx-1,bb[1]+dy-box[3]!-1,box[1]!-bb[3]-dy-1);
      };
      const subjects=new Map(origins);
      // A part that has never moved is precisely what a new control could unlock.
      // Admit it if the two setups change physical contact with the same visible part.
      for(const item of o.entities){
        if(item.signature===marker.signature||(eligible&&!eligible.has(item.signature)))continue;
        const members=groups.get(item.signature)!;
        if(members.size>12||(gap(item.bbox,[...r])===0)===(gap(item.bbox,other)===0))continue;
        const role={signature:item.signature,fixed:[...members.keys()].filter(p=>p!==item.position.join()).sort()};
        subjects.set(roleKey(role),role);
      }
      for(const [id,subject] of subjects){
        if(subject.signature===marker.signature)continue;
        const item=resolveRole(groups,subject),p=item?.position,prior=seen(m,a,subject),after=seen(m,q,subject);
        if(!item||!p||!known(prior,[...p])||!after)continue;
        const ds=moves.get(id)?.get(q.cmd)??[];
        const possible:XY[]=([prior,after,...ds.map(d=>add(prior,d))] satisfies XY[]).filter((v,i,a)=>a.findIndex(z=>same(v,z))===i);
        const contact=(gap(item.bbox,[...r])===0)!==(gap(item.bbox,other)===0);
        const priority=Number(contact)*8+Number(!same(after,prior))*4+Number(ds.length>0)*2+Number(!origins.has(id));
        const f:ControlFork={priority,firstMotion:!origins.has(id),root:m.scenes[a.s]!,branch:m.scenes[scene]!,otherBranch:m.scenes[a.t]!,
          prepare:last.cmd,rival:a.cmd,trigger:q.cmd,subject,reference:marker,subjectAt:[...p],markerAt:[...r],otherMarker:other,otherResult:after,possible,refs:[o.revision,ref,ref+1]};
        const key=forkKey(f);if(!unique.has(key)){unique.add(key);out.push(f);}
      }
    }
  }
  return out.sort((a,b)=>b.priority-a.priority);
}
export function learnControl(s: ControlStudy,f:ControlFork,to:XY|null,ref:number){
  s.examined[forkKey(f)]=ref;
  if(!to||same(to,f.otherResult)||same(to,f.subjectAt)===same(f.otherResult,f.subjectAt))return;
  const rule:ControlRule={fork:f,arrived:to,measuredAt:ref,attempts:{},tested:0,correct:0,refuted:false};
  s.rules.push(rule);
}
// Reuse only at the two measured arrangements. Relative translation goes beyond the source evidence.
export function predictControl(rule:ControlRule,scene:string,p:XY,r:XY):XY|null{
  const f=rule.fork;
  if(rule.refuted||scene===f.branch||scene===f.otherBranch||rule.attempts[scene]!==undefined||!same(p,f.subjectAt))return null;
  return same(r,f.markerAt)?rule.arrived:same(r,f.otherMarker)?f.otherResult:null;
}
export function checkControl(rule:ControlRule,scene:string,to:XY|null,forecast:XY,ref:number){
  rule.attempts[scene]=ref;
  if(!to)return;
  rule.tested++;
  if(same(to,forecast))rule.correct++;else rule.refuted=true;
}

