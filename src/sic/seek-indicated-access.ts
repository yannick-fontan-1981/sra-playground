import type {XY} from './access-terrain.ts';
import {add,diff,size} from './access-terrain.ts';
import {aligned} from './controlled-parts.ts';
import {cellMatches} from './calibrate-spatial-controls.ts';
import type {VisualLayout} from './witnessed-preview-transfer.ts';

import {mobileRefutation,type MobilePlan} from './plan-mobile-indication.ts';
export type AccessContext={actor:string;parked:string;home:XY;goal:XY;pitch:XY};
export type AccessScene={at:XY;form:string;visible:Record<string,XY>;next:Record<string,string>};
type Context=AccessContext;
type Production={cue:string;op:string;offset:XY;form:string;ref:string};
export type AccessExperiment={purpose:'approach_indication'|'test_indication'|'seek_preparation'|'use_mobile_indication';command:string;expected:XY;
  mobile?:MobilePlan;
  cue?:string;destination?:XY;ref?:string;origin:string;probe:string};
export type IndicatedMemory={scenes:Record<string,AccessScene>;sites:Record<string,true>;productions:Production[];
  mobilePending?:MobilePlan;mobileDenied?:Record<string,true>;
  readings:Record<string,{hits:number;misses:number}>;contradictions:Record<string,number>;repair:boolean};
export const newIndicatedMemory=():IndicatedMemory=>({scenes:{},sites:{},productions:[],readings:{},contradictions:{},repair:false});
const single=(l:VisualLayout,k:string)=>l[k]?.length===1?l[k]![0]:undefined;
const directional=(op:string)=>/^ACTION[1-4]$/.test(op);
const operation=(op:string)=>/^ACTION[57]$/.test(op);
const cell=(p:XY,c:Context)=>aligned(p,c.goal,c.pitch);
const hasSite=(m:IndicatedMemory,p:XY,c:Context)=>!!m.sites[cell(p,c).join()];
function scene(m:IndicatedMemory,hash:string,l:VisualLayout,c:Context){
  const body=single(l,c.actor),parked=single(l,c.parked);
  if(!body||!parked||!cellMatches(parked.at,c.home,c.pitch))return;
  m.sites[cell(body.at,c).join()]=true;
  return m.scenes[hash]??={at:body.at,form:body.form,visible:Object.fromEntries(Object.entries(l)
    .filter(([k,g])=>k!==c.actor&&k!==c.parked&&g.length===1).map(([k,g])=>[k,g[0]!.at])),next:{}};
}
export function learnIndicatedAccess(m:IndicatedMemory,c:Context,b:string,a:string,before:VisualLayout,after:VisualLayout,op:string,ref:string,
  expected?:XY,trial?:AccessExperiment){
  const old=scene(m,b,before,c),now=scene(m,a,after,c);
  if(!old||!now)return;
  if(directional(op)||operation(op))old.next[op]=a;
  delete m.mobilePending;
  if(trial?.mobile){
    const plan=trial.mobile,step=plan.path[0]!;
    if(step.command===op && cellMatches(now.at,step.expected,c.pitch) && cellMatches(now.visible[plan.pivot]??null,step.placed,c.pitch)){
      if(plan.path.length>1)m.mobilePending={...plan,path:plan.path.slice(1)};
    }else (m.mobileDenied??={})[mobileRefutation(plan.pivot,plan.cue,step.from,step.centre,op)]=true;
  }
  if(expected&&directional(op)&&!cellMatches(now.at,expected,c.pitch))m.repair=true;
  if(directional(op)){
    for(const [cue,at] of Object.entries(now.visible)){
      if(cellMatches(at,old.at,c.pitch)||cellMatches(at,now.at,c.pitch))continue;
      const prior=old.visible[cue];
      if(prior&&cellMatches(at,prior,c.pitch))continue;
      const offset=diff(cell(at,c),cell(now.at,c));
      if(!m.productions.some(p=>p.op===op&&p.cue===cue&&p.form===now.form&&p.offset.join()===offset.join()))
        m.productions.push({cue,op,offset,form:now.form,ref});
    }
  }
  if(operation(op)){
    for(const cue of new Set(m.productions.map(p=>p.cue))){
      const at=old.visible[cue];
      if(!at||cellMatches(at,old.at,c.pitch))continue;
      const k=op+'/'+cue,score=m.readings[k]??={hits:0,misses:0};
      if(cellMatches(now.at,at,c.pitch)){score.hits++;m.repair=false;}
      else if(trial?.cue===cue)score.misses++;
    }
  }
  if(trial?.purpose==='seek_preparation'&&trial.cue&&trial.destination && (!now.visible[trial.cue]||!cellMatches(now.visible[trial.cue]!,trial.destination,c.pitch))){
    const k=trial.cue+'/'+trial.probe;
    m.contradictions[k]=1+(m.contradictions[k]??0);
  }
}
type Motor={op:string;d:XY};
type Path={hash:string;depth:number;first?:{command:string;expected:XY}};
export function chooseIndicatedAccess(m:IndicatedMemory,c:Context,root:string,motors:Motor[],ops:readonly string[],limits:{maxDepth:number;maxNodes:number}):AccessExperiment|undefined {
  if(!m.repair||!m.scenes[root]||!ops.some(operation))return;
  const reads=ops.filter(operation),queue:Path[]=[{hash:root,depth:0}],seen=new Set([root]);
  const gap=(a:XY,b:XY)=>size(diff(cell(a,c),cell(b,c)))/c.pitch[0];
  const cueNames=[...new Set(m.productions.map(p=>p.cue))];
  let best:{value:number;offer:AccessExperiment}|undefined;
  function consider(path:Path,probe:string,expected:XY,rank:number,cue?:string,destination?:XY,ref?:string){
    const value=rank-path.depth;
    if(best&&best.value>=value)return;
    const first=path.first;
    best={value,offer:{purpose:first?'approach_indication':operation(probe)?'test_indication':'seek_preparation',
      command:first?.command??probe,expected:first?.expected??expected,origin:path.hash,probe,
      ...(cue?{cue}:{}),...(destination?{destination}:{}),...(ref?{ref}:{})}};
  }
  for(let i=0;i<queue.length&&i<limits.maxNodes;i++){
    const path=queue[i]!,s=m.scenes[path.hash]!;
    for(const q of reads){
      if(s.next[q])continue;
      for(const cue of cueNames){
        const site=s.visible[cue];
        if(!site||!hasSite(m,site,c)||cellMatches(site,s.at,c.pitch)||cellMatches(site,c.home,c.pitch))continue;
        const scores=m.readings[q+'/'+cue];
        if(scores&&!scores.hits&&scores.misses)continue;
        const witness=m.productions.find(p=>p.cue===cue)!;
        consider(path,q,site,4*limits.maxDepth+Number(!!scores?.hits)*limits.maxDepth-gap(site,c.goal),cue,site,witness.ref);
      }
    }
    if(path.depth+1>limits.maxDepth)continue;
    for(const motor of motors){
      const edge=s.next[motor.op];
      if(edge){
        if(!seen.has(edge)&&m.scenes[edge]){seen.add(edge);queue.push({hash:edge,depth:path.depth+1,
          first:path.first??{command:motor.op,expected:m.scenes[edge]!.at}});}
        continue;
      }
      const to=add(cell(s.at,c),motor.d);
      if(cellMatches(to,c.home,c.pitch))continue;
      const unseen=!hasSite(m,to,c);
      consider(path,motor.op,to,Number(unseen)*2-gap(to,c.goal)/Math.max(1,limits.maxDepth));
      for(const p of m.productions){
        if(p.op!==motor.op||reads.every(q=>(m.readings[q+'/'+p.cue]?.misses??0)>0&&!m.readings[q+'/'+p.cue]?.hits))continue;
        const destination=add(to,p.offset);
        if(!hasSite(m,destination,c)||cellMatches(destination,c.home,c.pitch))continue;
        const previousFailures=m.contradictions[p.cue+'/'+motor.op]??0;
        consider(path,motor.op,to,limits.maxDepth/(1+previousFailures)+Number(p.form===s.form)-gap(destination,c.goal)/limits.maxDepth,p.cue,destination,p.ref);
      }
    }
    // A measured operation may also connect two layouts with different continuations.
    for(const q of reads){const next=s.next[q];if(next&&!seen.has(next)&&m.scenes[next]){
      seen.add(next);queue.push({hash:next,depth:path.depth+1,first:path.first??{command:q,expected:m.scenes[next]!.at}});
    }}
  }
  return best?.offer;
}
