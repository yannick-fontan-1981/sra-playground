import type {NativeObservation,NativeRows} from '../logos-engine/v6-native-types.ts';
import {diff,same,type XY} from './access-terrain.ts';
import {aligned} from './controlled-parts.ts';
import {cellMatches} from './calibrate-spatial-controls.ts';
import {previewLaw,type ProbePattern} from './reachable-preview-configurations.ts';
import {observedBodyClick,type VerifiedPartnerForms} from './test-partner-preparation.ts';
import {visibleBoard} from './plan-mobile-indication.ts';
import type {VisualLayout} from './witnessed-preview-transfer.ts';

type Side=0|1;
type Pair<T>=[T,T];
type Motor={op:string;d:XY};
export type JointContext={roles:Pair<string>;goals:Pair<XY>;pivot:string;pitch:XY;alternate:VerifiedPartnerForms};
type Pose={actors:Pair<XY>;pivots:Pair<XY>;active:Side;forms:Pair<string>};
type Witness={pattern:ProbePattern;ref:string;producer:string};
export type JointMemory={witnesses:Record<string,Witness[]>;sites:Pair<Record<string,true>>;
  denied:Record<string,true>;failedReads:Record<string,true>;failedDisplays:Record<string,true>};
export const newJointMemory=():JointMemory=>({witnesses:{},sites:[{},{}],denied:{},failedReads:{},failedDisplays:{}});
export type JointForecast={purpose:'position_for_shared_operation'|'select_remaining_subject'|'test_joint_arrivals';
  command:string;side:Side;goals:Pair<XY>;actors:Pair<XY>;pivots:Pair<XY>;cue:string;witness:string;producer:string;
  expected:XY;placed:XY;ready:Pair<boolean>;displayed:Pair<boolean>;verifyDisplay?:boolean;key:string};
const sides=[0,1] as const;
const other=(i:Side):Side=>i===0?1:0;
const single=(l:VisualLayout,k:string)=>l[k]?.length===1?l[k]![0]:undefined;
const squared=([x,y]:XY)=>x*x+y*y;
const pairKey=(a:XY,b:XY)=>a.join()+'/'+b.join();
const grid=(p:XY,c:JointContext)=>aligned(p,c.goals[0],c.pitch);

export function jointPose(l:VisualLayout,c:JointContext):Pose|undefined {
  const primary=c.roles,alternate:Pair<string>=[c.alternate.alternateActor,c.alternate.alternatePeer];
  const normal=primary.every(k=>single(l,k)),switched=alternate.every(k=>single(l,k));
  const parts=l[c.pivot];if(normal===switched||parts?.length!==2)return;
  const forms=normal?primary:alternate,actors=forms.map(k=>grid(single(l,k)!.at,c)) as Pair<XY>;
  const pivots=parts.map(p=>grid(p.at,c)) as Pair<XY>;
  const direct=sides.reduce<number>((n,i)=>n+squared(diff(actors[i],pivots[i])),0);
  const reverse=sides.reduce<number>((n,i)=>n+squared(diff(actors[i],pivots[other(i)])),0);
  if(direct===reverse)return;
  if(reverse<direct)pivots.reverse();
  return {actors,pivots,active:normal?0:1,forms};
}

export function observeJointIndications(m:JointMemory,c:JointContext,before:VisualLayout,after:VisualLayout,op:string,ref:string){
  const previous=jointPose(before,c),p=jointPose(after,c);
  if(!p)return;
  for(const i of sides)for(const at of [p.actors[i],p.pivots[i]])m.sites[i][at.join()]=true;
  if(!previous||previous.active!==p.active||!/^ACTION[1-4]$/.test(op)||same(previous.actors[p.active],p.actors[p.active]))return;
  const j=other(p.active),actor=p.actors[j],centre=p.pivots[j];
  if(!same(previous.actors[j],actor)||!same(previous.pivots[j],centre))return;
  const radius=squared(diff(actor,centre));if(!radius)return;
  for(const [role,parts] of Object.entries(after)){
    if(parts.length>2||role===c.pivot||p.forms.includes(role))continue;
    const matching=parts.filter(body=>{
      const mark=grid(body.at,c);
      return cellMatches(body.at,mark,c.pitch)&&!same(mark,actor)&&squared(diff(mark,centre))===radius&&
        radius<squared(diff(mark,p.pivots[p.active]))&&!before[role]?.some(v=>cellMatches(v.at,mark,c.pitch));
    });
    if(matching.length!==1)continue;
    const indicator=grid(matching[0]!.at,c),list=m.witnesses[role]??=[];
    const known=list.some(w=>same(diff(w.pattern.actor,w.pattern.centre),diff(actor,centre))&&
      same(diff(w.pattern.indicator,w.pattern.centre),diff(indicator,centre))&&w.producer===op);
    if(!known&&list.length<24)list.push({pattern:{actor,centre,indicator,ref:list.length},ref,producer:op});
  }
}

type Step={command:string;expected:XY;placed:XY};
function route(m:JointMemory,c:JointContext,p:Pose,i:Side,rows:NativeRows,motors:Motor[],ground:number|undefined,
  predict:ReturnType<typeof previewLaw>,producer:string,depth:number,limit:number,finishWithProducer:boolean):Step[]|undefined{
  const goal=c.goals[i],loc=p.actors[i],anchor=p.pivots[i],guard=p.actors[other(i)];
  const scene={at:loc,visible:{[c.pivot]:anchor},form:'',next:{}};
  const board=visibleBoard({sites:m.sites[i],scenes:{current:scene}},
    {actor:p.forms[i],parked:p.forms[other(i)],home:guard,goal,pitch:c.pitch},scene,c.pivot,rows,motors,ground);
  if(!board)return;
  const {points,walk}=board;
  type Node={pos:number;pivot:number;parent:number;motor:number;length:number;produced:boolean};
  const nodes:Node[]=[{pos:board.start,pivot:board.centre,parent:-1,motor:-1,length:0,produced:false}];
  const seen=new Set([board.start+'/'+board.centre+'/false']);
  for(let j=0;j<nodes.length&&j<limit;j++){
    const node=nodes[j]!,from=points[node.pos]!,centre=points[node.pivot]!;
    const mark=predict(from,centre);
    if(mark.length===1&&same(mark[0]!.at,goal)&&(!finishWithProducer||node.produced)){
      const path:Step[]=[];
      for(let k=j;nodes[k]!.parent>=0;k=nodes[k]!.parent){
        const n=nodes[k]!;path.push({command:motors[n.motor]!.op,expected:points[n.pos]!,placed:points[n.pivot]!});
      }
      return path.reverse();
    }
    if(node.length>=depth)continue;
    for(const [index,motor] of motors.entries()){
      const to=walk[node.pos]![index]!;if(to<0)continue;
      const centreTo=to===node.pivot?walk[node.pivot]![index]!:node.pivot;
      if(centreTo<0)continue;
      if(m.denied[edge(i,from,centre,guard,p.pivots[other(i)],motor.op)])continue;
      const produced=motor.op===producer,key=to+'/'+centreTo+'/'+produced;
      if(seen.has(key))continue;seen.add(key);
      nodes.push({pos:to,pivot:centreTo,parent:j,motor:index,length:node.length+1,produced});
    }
  }
}
const edge=(i:Side,from:XY,centre:XY,guard:XY,otherPivot:XY,op:string)=>i+'/'+pairKey(from,centre)+'/'+pairKey(guard,otherPivot)+'/'+op;
export function chooseJointArrival(m:JointMemory,c:JointContext,l:VisualLayout,o:NativeObservation,rows:NativeRows,
  motors:Motor[],ground:number|undefined,depth:number,limit:number):JointForecast|undefined{
  const p=jointPose(l,c);if(!p||!motors.length)return;
  const options=o.available_action_refs.filter(op=>/^ACTION[57]$/.test(op));
  if(!options.length)return;
  for(const [cue,samples] of Object.entries(m.witnesses).sort((a,b)=>b[1].length-a[1].length)){
    if(!samples.length)continue;
    const predict=previewLaw(samples.map(w=>w.pattern),true),w=samples[0]!,i=p.active,j=other(i);
    const ready=sides.map(k=>{const sites=predict(p.actors[k],p.pivots[k]);return sites.length===1&&same(sites[0]!.at,c.goals[k]);}) as Pair<boolean>;
    const displayed=sides.map(k=>!!l[cue]?.some(mark=>cellMatches(mark.at,c.goals[k],c.pitch))) as Pair<boolean>;
    const base={side:i,goals:c.goals,actors:p.actors,pivots:p.pivots,cue,witness:w.ref,producer:w.producer,ready,displayed};
    if(ready.every(Boolean)&&displayed.every(Boolean)){
      const op=options.find(q=>!m.failedReads[cue+'/'+o.frame_hash+'/'+q]);
      if(op)return {...base,purpose:'test_joint_arrivals',command:op,expected:c.goals[i],placed:p.pivots[i],key:cue+'/'+o.frame_hash+'/'+op};
      continue;
    }
    const displayKey=cue+'/'+i+'/'+pairKey(p.actors[i],p.pivots[i])+'/'+pairKey(p.actors[j],p.pivots[j]);
    const calibrate=ready.every(Boolean)&&!displayed[i]&&!m.failedDisplays[displayKey];
    const plans=sides.map(k=>ready[k]&&!(calibrate&&k===i)?[]:
      route(m,c,p,k,rows,motors,ground,predict,w.producer,depth,limit,calibrate&&k===i));
    if(!plans[0]||!plans[1])continue;
    const step=plans[i]![0];
    if(step)return {...base,purpose:'position_for_shared_operation',...step,
      ...(calibrate&&plans[i]!.length===1?{verifyDisplay:true}:{}),key:edge(i,p.actors[i],p.pivots[i],p.actors[j],p.pivots[j],step.command)};
    if(plans[j]!.length||ready.every(Boolean)&&!displayed[j]&&!m.failedDisplays[cue+'/'+j+'/'+pairKey(p.actors[j],p.pivots[j])+'/'+pairKey(p.actors[i],p.pivots[i])]){
      const command=observedBodyClick(l,p.forms[j],o),key='switch/'+i+'/'+o.frame_hash;
      if(command&&!m.denied[key])return {...base,purpose:'select_remaining_subject',command,expected:p.actors[i],placed:p.pivots[i],key};
    }
  }
}
export function measureJointReturn(m:JointMemory,c:JointContext,l:VisualLayout,f:JointForecast){
  const p=jointPose(l,c),i=f.side,j=other(i);
  if(f.purpose==='test_joint_arrivals'){
    m.failedReads[f.key]=true;
    return p&&sides.every(k=>same(p.actors[k],c.goals[k]))?'both_indicated_arrivals':'joint_arrival_not_confirmed';
  }
  const guard=p&&same(p.actors[j],f.actors[j])&&same(p.pivots[j],f.pivots[j]);
  const matches=guard&&same(p.actors[i],f.expected)&&same(p.pivots[i],f.placed)&&p.active===(f.purpose==='select_remaining_subject'?j:i);
  if(!matches){m.denied[f.key]=true;return 'joint_preparation_refuted';}
  if(f.verifyDisplay&&!l[f.cue]?.some(mark=>cellMatches(mark.at,c.goals[i],c.pitch))){
    m.failedDisplays[f.cue+'/'+i+'/'+pairKey(p.actors[i],p.pivots[i])+'/'+pairKey(p.actors[j],p.pivots[j])]=true;
  }
  return f.purpose==='select_remaining_subject'?'selected_remaining_subject':'preparation_matched_with_other_geometry_preserved';
}
