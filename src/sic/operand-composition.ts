import type { NativeBox, NativeObservation, NativeRows } from '../logos-engine/v6-native-types.ts';
import { clickSite } from './local-response.ts';
import { rankOperandCorrespondences } from './operand-correspondence.ts';

type Box = NativeBox;
type Point = readonly [number,number];
type View = Map<string,Map<string,Box>>;
type Binding = {input:string;offset:Point;actor?:string};
type Witness = {box:Box;ref:string;confirmed?:string};
export type OperandRule = {role:string;before:string;after:string;binding:Binding;sites:Witness[]};
export type OperandOption = {rule:OperandRule;target:Box;kept:Witness[]};
type Move = {input:string;at?:Point};
export type OperandPlan = {key:string;role:string;actor?:string;target:Box;before:string;after:string;kept:Box[];
  keptRefs:string[][];sourceRefs:string[];correspondence:number;steps:Move[];index:number};
type Actor = {motors:Record<string,Point|null>;visited:string[]};
export type OperandMemory = {rules:OperandRule[];actors:Record<string,Actor>;rejected:string[];pending?:OperandPlan;continueFrom?:string};
export const newOperandMemory=():OperandMemory=>({rules:[],actors:{},rejected:[]});

const views=new WeakMap<NativeObservation,View>();
function viewOf(o:NativeObservation,rows:NativeRows):View {
  const cached=views.get(o);if(cached)return cached;
  const view:View=new Map(),limit=rows.length*(rows[0]?.length??0)/12;
  for(const e of o.entities){
    if(e.area<2||e.area>limit)continue;
    const g=view.get(e.signature)??new Map<string,Box>();
    g.set(e.bbox.join(),e.bbox);view.set(e.signature,g);
  }
  views.set(o,view);return view;
}
const center=(b:Box):Point=>[(b[0]+b[2])/2,(b[1]+b[3])/2];
const add=(p:Point,q:Point):Point=>[p[0]+q[0],p[1]+q[1]];
const sub=(p:Point,q:Point):Point=>[p[0]-q[0],p[1]-q[1]];
const singleton=(g:Map<string,Box>|undefined)=>g?.size===1?g.values().next().value:undefined;
const patch=(rows:NativeRows,b:Box)=>rows.slice(b[1],b[3]+1).map(r=>r.slice(b[0],b[2]+1).join(',')).join('/');
function rememberSite(places:string[],p:Point){
  const k=p.join();if(!places.includes(k))places.push(k);
}
export function learnOperands(m:OperandMemory,b:NativeObservation,a:NativeObservation,rows:NativeRows,next:NativeRows,input:string){
  if(b.frame_hash===a.frame_hash)return;
  const before=viewOf(b,rows),after=viewOf(a,next),click=clickSite(input);
  const moved:{role:string;from:Point;to:Point;d:Point}[]=[];
  for(const [role,g] of before){
    const p=singleton(g),q=singleton(after.get(role));
    if(!p||!q||p.join()===q.join())continue;
    const from=center(p),to=center(q),d=sub(to,from);if((d[0]===0)===(d[1]===0))continue;
    moved.push({role,from,to,d});
    if(!/^ACTION[1-4]$/.test(input))continue;
    const actor=m.actors[role]??={motors:{},visited:[]},known=actor.motors[input];
    actor.motors[input]=known===undefined||known?.join()===d.join()?d:null;
    rememberSite(actor.visited,from);rememberSite(actor.visited,to);
  }
  for(const rule of m.rules){
    rule.sites=rule.sites.filter(s=>patch(next,s.box)===rule.after);
    for(const s of rule.sites)s.confirmed??=a.observation_ref;
  }
  m.rules=m.rules.filter(r=>r.sites.length);
  for(const [role,previous] of before){
    const current=after.get(role);
    if(previous.size<2||previous.size>64||!current||current.size!==previous.size-1)continue;
    const gone=[...previous].filter(([k])=>!current.has(k));if(gone.length!==1)continue;
    const box=gone[0]![1];if((box[2]-box[0]+1)*(box[3]-box[1]+1)>144)continue;
    const old=patch(rows,box),value=patch(next,box);if(old===value)continue;
    const bindings:Binding[]=[];
    if(click&&click[0]>=box[0]&&click[0]<=box[2]&&click[1]>=box[1]&&click[1]<=box[3])
      bindings.push({input:'ACTION6',offset:[click[0]-box[0],click[1]-box[1]]});
    if(!click)for(const actor of moved){
      const p=center(box),pitch=Math.abs(actor.d[0])+Math.abs(actor.d[1]);
      if(actor.role!==role&&Math.max(Math.abs(actor.to[0]-p[0]),Math.abs(actor.to[1]-p[1]))<=.48*pitch)
        bindings.push({input,actor:actor.role,offset:sub(actor.from,p)});
    }
    for(const binding of bindings){
      let rule=m.rules.find(r=>r.role===role&&r.before===old&&r.after===value&&r.binding.input===binding.input&&
        r.binding.actor===binding.actor&&r.binding.offset.join()===binding.offset.join());
      if(!rule){rule={role,before:old,after:value,binding,sites:[]};m.rules.push(rule);}
      if(!rule.sites.some(s=>s.box.join()===box.join()))rule.sites.push({box,ref:a.observation_ref});
    }
  }
}
function stepsTo(m:OperandMemory,view:View,binding:Binding,box:Box,available:Set<string>):Move[]|undefined{
  if(!available.has(binding.input))return;
  if(!binding.actor)return [{input:'ACTION6:'+add([box[0],box[1]],binding.offset).join()}];
  const body=singleton(view.get(binding.actor)),actor=m.actors[binding.actor];
  if(!actor||!body)return;
  const start=center(body),goal=add(center(box),binding.offset),seen=new Set([start.join()]);
  const queue:{at:Point;path:Move[]}[]=[{at:start,path:[]}],visited=new Set(actor.visited);
  for(let i=0;i<queue.length;i++){
    const {at,path}=queue[i]!;
    if(at.join()===goal.join())return [...path,{input:binding.input}];
    if(path.length>=6)continue;
    for(const [input,d] of Object.entries(actor.motors)){
      if(!d||!available.has(input))continue;
      const position=add(at,d),k=position.join();if(seen.has(k)||(!visited.has(k)&&k!==goal.join()))continue;
      seen.add(k);queue.push({at:position,path:[...path,{input,at:position}]});
    }
  }
}
export function operandPlan(m:OperandMemory,o:NativeObservation,rows:NativeRows,budget:number):OperandPlan|undefined{
  if(m.pending&&m.pending.kept.every(b=>patch(rows,b)===m.pending!.after)&&patch(rows,m.pending.target)===m.pending.before)return m.pending;
  if(!m.rules.length)return;
  const view=viewOf(o,rows),available=new Set(o.available_action_refs),ranked:{plan:OperandPlan;priority:number[]}[]=[];
  for(const rule of m.rules){
    const kept=rule.sites.filter(s=>s.confirmed&&patch(rows,s.box)===rule.after);if(!kept.length)continue;
    const targets=view.get(rule.role);if(!targets?.size)continue;
    const candidates:{option:OperandOption;steps:Move[];key:string}[]=[];
    for(const target of targets.values()){
      if(patch(rows,target)!==rule.before)continue;
      const steps=stepsTo(m,view,rule.binding,target,available);if(!steps||steps.length>budget)continue;
      const key=JSON.stringify([rule.role,rule.binding,target,steps[0]!.input,kept.map(w=>w.ref)]);
      if(!m.rejected.includes(key))candidates.push({option:{rule,target,kept},steps,key});
    }
    const scores=rankOperandCorrespondences(rows,candidates.map(c=>c.option));
    for(const [i,c] of candidates.entries()){
      const weight=scores[i]??0;if(candidates.length>1&&!weight)continue;
      ranked.push({plan:{key:c.key,role:rule.role,...(rule.binding.actor?{actor:rule.binding.actor}:{}),target:c.option.target,before:rule.before,after:rule.after,
        kept:kept.map(s=>s.box),keptRefs:kept.map(s=>[s.ref,s.confirmed!]),sourceRefs:[...new Set(kept.flatMap(s=>[s.ref,s.confirmed!]))],correspondence:weight,steps:c.steps,index:0},
        priority:[kept.length,-targets.size,weight,-c.steps.length]});
    }
  }
  ranked.sort((a,b)=>{for(let i=0;i<a.priority.length;i++){const d=b.priority[i]!-a.priority[i]!;if(d)return d;}return 0;});
  return ranked[0]?.plan;
}
export function operandMatches(p:OperandPlan,o:NativeObservation,rows:NativeRows):boolean{
  if(!p.kept.every(b=>patch(rows,b)===p.after))return false;
  const expected=p.steps[p.index]?.at;
  if(!expected)return patch(rows,p.target)===p.after;
  const body=p.actor&&singleton(viewOf(o,rows).get(p.actor));return !!body&&center(body).join()===expected.join();
}
