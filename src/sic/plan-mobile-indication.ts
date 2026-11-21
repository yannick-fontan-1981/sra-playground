import {add,diff,same,size,type XY} from './access-terrain.ts';
import {aligned} from './controlled-parts.ts';
import {cellMatches,surfaceFromVisits} from './calibrate-spatial-controls.ts';
import {previewLaw,type ProbePattern} from './reachable-preview-configurations.ts';
import type {NativeRows} from '../logos-engine/v6-native-types.ts';
import type {AccessContext,AccessScene,IndicatedMemory} from './seek-indicated-access.ts';

type Motor={op:string;d:XY};
export type MobileStep={command:string;from:XY;centre:XY;expected:XY;placed:XY;read:boolean;inverseHypothesis?:true;preparedSurface?:true};
export type MobilePlan={pivot:string;cue:string;motion:'push'|'pull'|'both';ref:string;path:MobileStep[];examined:number};
type Model={pivot:string;cue:string;push:boolean;pull:boolean;ref:string;examples:ProbePattern[]};
const gridPoint=(p:XY,c:AccessContext)=>aligned(p,c.goal,c.pitch);
export function identifyMobileModels(m:IndicatedMemory,c:AccessContext):Model[]{
  const roles=new Map<string,{pull:boolean;push:boolean}>();
  for(const s of Object.values(m.scenes))for(const [op,h] of Object.entries(s.next)){
    const next=m.scenes[h];
    if(!/^ACTION[1-4]$/.test(op)||!next)continue;
    const p=gridPoint(s.at,c),q=gridPoint(next.at,c),d=diff(q,p);
    if(size(d)!==c.pitch[0])continue;
    for(const [role,before] of Object.entries(s.visible)){
      const after=next.visible[role];if(!after)continue;
      const old=gridPoint(before,c),now=gridPoint(after,c);
      if(!same(diff(now,old),d))continue;
      const pull=same(now,p),push=same(old,q);
      if(!pull&&!push)continue;
      const binding=roles.get(role)??{pull:false,push:false};
      binding.pull||=pull;binding.push||=push;roles.set(role,binding);
    }
  }
  const models:Model[]=[];
  for(const [pivot,mobility] of roles)for(const cue of new Set(m.productions.map(p=>p.cue))){
    if(cue===pivot)continue;
    const patterns=new Map<string,ProbePattern>();let compatible=0,count=0;
    for(const s of Object.values(m.scenes)){
      const centre=s.visible[pivot],indication=s.visible[cue];
      if(!centre||!indication)continue;
      count++;
      const p=gridPoint(s.at,c),a=gridPoint(centre,c),r=gridPoint(indication,c),u=diff(p,a),v=diff(r,a);
      if(same(p,r)||size(u)===0||Math.abs(u[0])**2+Math.abs(u[1])**2!==Math.abs(v[0])**2+Math.abs(v[1])**2)continue;
      compatible++;patterns.set(u.join()+'/'+v.join(),{actor:p,centre:a,indicator:r,ref:0});
    }
    if(patterns.size<2||compatible*3<count*2)continue;
    models.push({pivot,cue,...mobility,examples:[...patterns.values()],ref:m.productions.find(p=>p.cue===cue)!.ref});
  }
  return models.sort((a,b)=>b.examples.length-a.examples.length);
}
export function tileValues(rows:NativeRows,p:XY,pitch:XY){
  const values:number[]=[];
  for(let y=Math.ceil((p[1]-pitch[1]/2)/2);y<(p[1]+pitch[1]/2)/2;y++)
    for(let x=Math.ceil((p[0]-pitch[0]/2)/2);x<(p[0]+pitch[0]/2)/2;x++){
      const v=rows[y]?.[x];if(v!==undefined)values.push(v);
    }
  return values;
}
function dominant(values:number[]){
  const counts=new Map<number,number>();for(const v of values)counts.set(v,1+(counts.get(v)??0));
  return [...counts].sort((a,b)=>b[1]-a[1])[0]?.[0];
}
type Board={points:XY[];index:Map<string,number>;walk:number[][];goal:number;start:number;centre:number;prepared:Set<number>};
function visibleBoard(m:IndicatedMemory,c:AccessContext,s:AccessScene,pivot:string,rows:NativeRows,motors:Motor[],learnedGround?:number):Board|undefined{
  const centre=s.visible[pivot];if(!centre)return;
  const ground=learnedGround??surfaceFromVisits(Object.fromEntries(Object.keys(m.sites).map(k=>[k,1])),rows,c.goal,c.pitch,
    [s.at,c.home,centre,c.goal]);
  if(ground==null)return;
  const documented=new Set(Object.keys(m.sites));
  for(const other of Object.values(m.scenes)){const p=other.visible[pivot];if(p)documented.add(gridPoint(p,c).join());}
  const points:XY[]=[],index=new Map<string,number>(),prepared=new Set<number>();
  const changed=new Map(m.preparedGround?.map(site=>[site.at.join(),site.appearance]));
  for(let y=c.goal[1]%c.pitch[1];y<=2*(rows.length-1);y+=c.pitch[1])
    for(let x=c.goal[0]%c.pitch[0];x<=2*(rows[0]!.length-1);x+=c.pitch[0]){
      const p:XY=[x,y],k=p.join();
      if(same(p,c.home))continue;
      if(!same(p,c.goal)&&!documented.has(k)){
        const values=tileValues(rows,p,c.pitch);
        if(dominant(values)!==ground){if(changed.get(k)!==values.join())continue;prepared.add(points.length);}
      }
      index.set(k,points.length);points.push(p);
    }
  const start=index.get(gridPoint(s.at,c).join()),anchor=index.get(gridPoint(centre,c).join()),goal=index.get(c.goal.join());
  if(start===undefined||anchor===undefined||goal===undefined)return;
  return {points,index,start,centre:anchor,goal,prepared,walk:points.map(p=>motors.map(v=>index.get(add(p,v.d).join())??-1))};
}
const edgeKey=(actor:XY,centre:XY,q:string)=>actor.join()+'/'+centre.join()+'/'+q;
export function mobileRefutation(pivot:string,cue:string,p:XY,centre:XY,q:string){return pivot+'/'+cue+'/'+edgeKey(p,centre,q);}
function solve(model:Model,board:Board,c:AccessContext,m:IndicatedMemory,s:AccessScene,motors:Motor[],op:string,depth:number,limit:number):MobilePlan|undefined {
  const {points,walk,start,centre,goal}=board,n=points.length,predict=previewLaw(model.examples,true);
  const reversed=previewLaw(model.examples.map(e=>({...e,actor:e.indicator,indicator:e.actor})),true);
  const offsets=new Map<string,XY|null>(),conjectures=new Set<string>();
  function projected(p:number,a:number){
    const relative=diff(points[p]!,points[a]!),key=relative.join();
    if(!offsets.has(key)){
      const forward=predict(relative,[0,0]);
      const predictions=forward.length?forward:reversed(relative,[0,0]);
      if(!forward.length&&predictions.length===1)conjectures.add(key);
      offsets.set(key,predictions.length===1?predictions[0]!.at:null);
    }
    const offset=offsets.get(key);
    return offset?board.index.get(add(points[a]!,offset).join())??-1:-1;
  }
  // Relax the fixed pivot to get a lower bound on the distance to the destination.
  const incoming=points.map(()=>new Set<number>());
  for(let p=0;p<n;p++){
    for(const q of walk[p]!)if(q>=0)incoming[q]!.add(p);
    for(let a=0;a<n;a++){const q=projected(p,a);if(q>=0&&q!==p)incoming[q]!.add(p);}
  }
  const dist=new Map<number,number>([[goal,0]]),wave=[goal];
  for(let i=0;i<wave.length;i++){const q=wave[i]!;for(const p of incoming[q]!)if(!dist.has(p)){dist.set(p,dist.get(q)!+1);wave.push(p);}}
  if(!dist.has(start))return;
  type Node={p:number;a:number;parent:number;action:number;cost:number;priority:number};
  const nodes:Node[]=[{p:start,a:centre,parent:-1,action:-1,cost:0,priority:0}],open=[0],best=new Map([[start*n+centre,0]]);
  function submit(p:number,a:number,parent:number,action:number){
    const prev=nodes[parent]!,d=dist.get(p),cost=prev.cost+1,key=p*n+a;
    if(d===undefined||cost>depth||cost>=(best.get(key)??Infinity))return;
    const cmd=action===motors.length?op:motors[action]!.op;
    if(m.mobileDenied?.[mobileRefutation(model.pivot,model.cue,points[prev.p]!,points[prev.a]!,cmd)])return;
    const gain=size(diff(points[p]!,c.goal))/c.pitch[0];
    best.set(key,cost);open.push(nodes.length);nodes.push({p,a,parent,action,cost,priority:cost+2*d+gain/(depth+1)});
  }
  const pick=()=>{let at=0;for(let j=1;j<open.length;j++)if(nodes[open[j]!]!.priority<nodes[open[at]!]!.priority)at=j;
    const v=open[at]!;open[at]=open[open.length-1]!;open.pop();return v;};
  for(let examined=0;open.length&&examined<limit;examined++){
    const i=pick(),u=nodes[i]!;
    if(u.cost!==best.get(u.p*n+u.a))continue;
    if(u.p===goal){
      const path:MobileStep[]=[];
      for(let j=i;nodes[j]!.parent>=0;j=nodes[j]!.parent){
        const v=nodes[j]!,prev=nodes[v.parent]!,read=v.action===motors.length;
        path.push({from:points[prev.p]!,centre:points[prev.a]!,command:read?op:motors[v.action]!.op,expected:points[v.p]!,placed:points[v.a]!,read,
          ...(read&&conjectures.has(diff(points[prev.p]!,points[prev.a]!).join())?{inverseHypothesis:true as const}:{}),
          ...(board.prepared.has(v.p)?{preparedSurface:true as const}:{})});
      }
      path.reverse();
      if(path.length)return {pivot:model.pivot,cue:model.cue,motion:model.push&&model.pull?'both':model.pull?'pull':'push',ref:model.ref,path,examined:examined+1};
    }
    for(const [j,motor] of motors.entries()){
      const dest=walk[u.p]![j]!;if(dest<0)continue;
      let a=u.a;
      if(dest===a){if(!model.push)continue;a=walk[a]![j]!;if(a<0)continue;}
      else if(model.pull&&same(add(points[a]!,motor.d),points[u.p]!))a=u.p;
      submit(dest,a,i,j);
    }
    const arrival=projected(u.p,u.a);
    if(arrival>=0&&arrival!==u.p&&arrival!==u.a){
      // A future indication is hypothetical. At the actual activation, check its presence.
      if(i!==0||cellMatches(s.visible[model.cue]??null,points[arrival]!,c.pitch))
        submit(arrival,u.a,i,motors.length);
    }
  }
}
export function chooseMobileIndication(m:IndicatedMemory,c:AccessContext,root:string,rows:NativeRows,motors:Motor[],available:readonly string[],depth:number,limit:number,ground?:number):MobilePlan|undefined{
  const s=m.scenes[root];if(!s||!motors.length)return;
  const ops=available.filter(q=>/^ACTION[57]$/.test(q));if(!ops.length)return;
  const models=identifyMobileModels(m,c);
  for(const model of models){
    const board=visibleBoard(m,c,s,model.pivot,rows,motors,ground);if(!board)continue;
    const op=ops.slice().sort((a,b)=>(m.readings[b+'/'+model.cue]?.hits??0)-(m.readings[a+'/'+model.cue]?.hits??0))[0]!;
    const plan=solve(model,board,c,m,s,motors,op,depth,Math.max(1,Math.floor(limit/models.length)));
    if(plan)return plan;
  }
}
