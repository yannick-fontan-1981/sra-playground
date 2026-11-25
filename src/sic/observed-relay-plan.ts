/** Bounded counterfactual search for a movable relay and opposing gates.
 * This module receives a visible scene and control hypotheses. Only the caller
 * can release a command, after binding it to a fresh observation. */
export type RelayMotion = { action: string; axis: number };
export type RelayState = { actors: number[]; loads: number[]; reflectors: number[]; supports: number[]; subjects?: number[] };
export type RelayStep = { actor: number; action: string; before: RelayState; after: RelayState; projected: number[] };
type Gate = { cell: number; closedWhenPressed: boolean; control?: number };
export type RelayModel = {
  floor: Set<number>; water: Set<number>; gates: Gate[]; plate: number | null;
  goals: number[]; arms: readonly (readonly number[])[]; controls: RelayMotion[][]; capacity: number[]; trigger: string;
  unoccupiedControls?: number[];
  heldLoadControls?: number[];
  pull?: boolean[];
  nearestReflection?: boolean;
  finishAtPlate?: boolean;
  settleSubjectOnControl?: boolean;
  keepSubjectOnControl?: boolean;
  activeActor?: number;
  linkedControls?: boolean;
  trialControl?: number;
  trialWeightOnly?: boolean;
  guidingControls?: number[];
};
type Branch = { state: RelayState; steps: RelayStep[] };
type Node = { branch: Branch; parent: Node | null; cost: number; priority: number };

const occupied = (s: RelayState, cell:number) => s.reflectors.includes(cell)||s.loads.includes(cell)||s.actors.includes(cell)||!!s.subjects?.includes(cell);
export { occupied as relayControlOccupied };
export const relayControlWeighted = (s:RelayState,cell:number) => s.reflectors.includes(cell)||s.loads.includes(cell)||!!s.subjects?.includes(cell);
const pressed = (s:RelayState,plate:number|null) => plate!==null&&occupied(s,plate);
export const relayGateClosed = (gate:Gate,s:RelayState,plate:number|null) => gate.closedWhenPressed===pressed(s,gate.control??plate);
const blocked = (m:RelayModel,s:RelayState,p:number) => !m.floor.has(p)&&!m.water.has(p)
  ||m.gates.some(gate=>gate.cell===p&&relayGateClosed(gate,s,m.plate));
const stands = (m:RelayModel,s:RelayState,p:number) => m.floor.has(p)||s.supports.includes(p);
const sorted=(xs:number[])=>xs.sort((a,b)=>a-b);
const signature=(s:RelayState)=>[...s.actors,-1,...s.reflectors,-1,...s.loads,-1,...s.supports,-1,...(s.subjects??[])].join(',');
const solved=(m:RelayModel,s:RelayState)=>m.trialControl!==undefined?(m.trialWeightOnly?relayControlWeighted(s,m.trialControl):occupied(s,m.trialControl))
  :m.settleSubjectOnControl&&m.plate!==null?!!s.subjects?.includes(m.plate)
  :m.finishAtPlate&&m.plate!==null?s.actors.includes(m.plate):m.goals.every(goal=>s.actors.includes(goal));

function shift(m:RelayModel,before:RelayState,moves:ReadonlyMap<number,number>) {
  const position=(cell:number)=>moves.get(cell)??cell;
  const reflectors=before.reflectors.map(position);
  // Indistinguishable reflectors share a slot ordering even after displacement.
  for(let first=0;first<m.arms.length;){
    let end=first+1;
    while(end<m.arms.length&&m.arms[end]!.join(',')===m.arms[first]!.join(','))end++;
    if(end-first>1)reflectors.splice(first,end-first,...sorted(reflectors.slice(first,end)));
    first=end;
  }
  const after:RelayState={actors:before.actors.map(position),loads:before.loads.map(position),reflectors,supports:[...before.supports],
    ...(before.subjects?{subjects:sorted(before.subjects.map(position))}:{})};
  if(m.keepSubjectOnControl&&m.plate!==null&&!after.subjects?.includes(m.plate))return;
  // An untested body may be hazardous on contact. Use non-contact transport
  // and keep both cursors clear until an observation supports a closer move.
  if(after.subjects?.some(p=>!stands(m,after,p)||after.actors.some(actor=>p===actor||[1,-1,64,-64].includes(p-actor))))return;
  if(m.unoccupiedControls?.some(cell=>occupied(after,cell)))return;
  if(m.heldLoadControls?.some(cell=>!after.loads.includes(cell)))return;
  if(!after.actors.every(p=>stands(m,after,p))||!after.reflectors.every(p=>stands(m,after,p)))return;
  after.loads=after.loads.filter(p=>{
    if(stands(m,after,p))return true;
    if(m.water.has(p))after.supports.push(p);
    return false;
  });
  // Shutting a gate is admitted only when nothing would be struck. The
  // observed circuit family handles actuator contacts separately.
  if(m.gates.some(g=>occupied(after,g.cell)&&relayGateClosed(g,after,m.plate)&&!relayGateClosed(g,before,m.plate)))return;
  after.loads=sorted(after.loads);
  after.supports=sorted(after.supports);
  return after;
}

function reflection(m:RelayModel,s:RelayState):{state:RelayState;keys:number[]}|undefined {
  const transfers=new Map<number,number>(), ray=new Set<number>();
  for(const [index,reflector] of s.reflectors.entries()){
    const [a,b]=m.arms[index]!;
    if(a===undefined||b===undefined)return;
    const candidates:{origin:number;destination:number;span:number;outgoing:number}[]=[];
    for(const [from,to] of [[a,b],[b,a]] as const){
      let origin=reflector, destination=reflector;
      for(let i=0;i<25;i++){
        origin+=from; destination+=to;
        if(blocked(m,s,origin)||s.reflectors.includes(origin))break;
        if(!occupied(s,origin))continue;
        candidates.push({origin,destination,span:i+1,outgoing:to});
        break;
      }
    }
    const nearest=Math.min(...candidates.map(candidate=>candidate.span));
    for(const {origin,destination,span,outgoing} of candidates){
      if(m.nearestReflection&&span!==nearest)continue;
      if(!stands(m,s,destination)&&s.actors.includes(origin))return;
      for(let p=reflector+outgoing;;p+=outgoing){
        if(blocked(m,s,p)||s.reflectors.includes(p))return;
        ray.add(p);
        if(p===destination)break;
      }
      const previous=transfers.get(origin);
      if(previous!==undefined&&previous!==destination)return;
      transfers.set(origin,destination);
    }
  }
  if(!transfers.size||new Set(transfers.values()).size!==transfers.size
    ||[...ray].some(p=>occupied(s,p)&&!transfers.has(p)))return;
  const state=shift(m,s,transfers);
  if(state)return {state,keys:[...transfers.values()]};
}

function branches(model:RelayModel,origin:RelayState, keepPrepared=false):Branch[] {
  const out:Branch[]=[];
  for(const [actor,start] of origin.actors.entries()){
    const paths=new Map<number,RelayStep[]>([[start,[]]]);
    const controls=model.controls[actor]!;
    for(const [at,path] of paths) {
      const s=path.at(-1)?.after??origin;
      const emit=(action:string,after:RelayState,projected:number[]=[])=>{
        out.push({state:after,steps:[...path,{actor,action,before:s,after,projected}]});
      };
      const pressureChanged=pressed(origin,model.plate)!==pressed(s,model.plate)||model.gates.some(gate=>
        gate.control!==undefined&&pressed(origin,gate.control)!==pressed(s,gate.control));
      if(path.length&&(pressureChanged||model.goals.includes(at))){
        out.push({state:s,steps:path});
        if(pressureChanged||solved(model,s))continue;
      }
      const reflected=model.trigger?reflection(model,s):undefined;
      if(reflected)emit(model.trigger,reflected.state,reflected.keys);
      for(const {action,axis} of controls){
        const dest=at+axis;
        if(blocked(model,s,dest))continue;
        if(occupied(s,dest)){
          const moves=new Map([[at,dest]]);
          let p=dest, count=0;
          for(;occupied(s,p)&&count<model.capacity[actor]!;p+=axis){
            if(s.actors.includes(p)?!model.goals.includes(p+axis):keepPrepared)break;
            if(blocked(model,s,p+axis))break;
            moves.set(p,p+axis);
            count++;
          }
          if(!count||occupied(s,p))continue;
          const pushed=shift(model,s,moves);
          if(pushed)emit(action,pushed);
          continue;
        }
        if(!stands(model,s,dest))continue;
        const rear=at-axis;
        if(model.pull?.[actor]&&occupied(s,rear)){
          const pulled=shift(model,s,new Map([[at,dest],[rear,at]]));
          if(pulled)emit(action,pulled);
          continue;
        }
        if(paths.has(dest))continue;
        const after=shift(model,s,new Map([[at,dest]]));
        if(after)paths.set(dest,[...path,{actor,action,before:s,after,projected:[]}]);
      }
    }
  }
  return out;
}

function distanceMap(model: RelayModel, start:number) {
  const dist=new Map([[start,0]]);
  for(const [p,d] of dist) for(const axis of [1,-1,64,-64]){
    const q=p+axis;
    if(model.floor.has(q)&&!dist.has(q))dist.set(q,d+1);
  }
  return dist;
}


function relayStances(model:RelayModel){
  if(model.plate===null)return [];
  const templates:{mirror:number;load:number}[]=[];
  const [a,b]=model.arms[0]!;
  for(const [from,to] of [[a!,b!],[b!,a!]] as const) {
    let center:number=model.plate;
    for(let span=1;span<25;span++){
      center-=from;
      if(!model.floor.has(center)&&!model.water.has(center))break;
      if(!model.floor.has(center))continue;
      const other=center+to*span;
      if(!model.floor.has(other)||other===model.plate)continue;
      let lane=true;
      for(let i=1;i<span;i++){
        const at=center+to*i;
        if(!model.floor.has(at)&&!model.water.has(at)){lane=false;break;}
      }
      if(lane)templates.push({mirror:center,load:other});
    }
  }
  return templates;
}

function bridgeOrdering(model:RelayModel){
  const field=model.goals.map(goal=>distanceMap({...model,floor:new Set([...model.floor,...model.water])},goal));
  const [left,right]=field;
  return (s:RelayState)=>{
    const distance=(known:Map<number,number>,cell:number)=>known.get(cell)??50;
    const [a,b]=s.actors as [number,number];
    const total=Math.min(distance(left!,a)+distance(right!,b),distance(left!,b)+distance(right!,a));
    // A new footing changes traversability. Cargo arriving on existing
    // footing remains a load and can subsequently be pushed farther.
    return total*2.6-Math.min(6,s.supports.length)*4;
  };
}


function ordering(model: RelayModel, emphasis:number) {
  if(model.trialControl!==undefined)return controlOrdering(model,model.trialControl);
  if(model.guidingControls){
    const goal=bridgeOrdering(model);
    return (pose:RelayState)=>goal(pose)+model.guidingControls!.filter(control=>!occupied(pose,control)).length*12;
  }
  // With independent gates, geometric progress can point through a closed
  // circuit. Use observed action costs, including selection, across relays.
  if(model.linkedControls||model.settleSubjectOnControl)return ()=>0;
  if(model.keepSubjectOnControl){
    const goal=bridgeOrdering(model);
    // Once the infrastructure is held, favor command cost. A weak distance
    // term breaks ties without encouraging unnecessary reflector moves.
    return (pose:RelayState)=>goal(pose)*0.35;
  }
  if(model.finishAtPlate&&model.plate!==null){
    const floor=new Set([...model.floor,...model.water]);
    const distances=distanceMap({...model,floor},model.plate);
    return (pose:RelayState)=>Math.min(...pose.actors.map(actor=>distances.get(actor)??40))*5;
  }
  if(model.pull?.some(Boolean))return bridgeOrdering(model);
  if(model.plate===null)return bridgeOrdering(model);
  const [first,second]=model.goals.map(goal=>distanceMap(model,goal));
  const dist=(map:Map<number,number>,p:number)=>map.get(p)??50;
  const goal=(p:number,q:number)=>Math.min(dist(first!,p)+dist(second!,q),dist(first!,q)+dist(second!,p));
  const templates=relayStances(model).map(t=>({...t,mirrorDistance:distanceMap(model,t.mirror),loadDistance:distanceMap(model,t.load)}));
  return (s:RelayState)=>{
    const total=goal(s.actors[0]!,s.actors[1]!);
    const logistics=Math.min(25,...templates.map(t=>dist(t.mirrorDistance,s.reflectors[0]!)*1.6+
      Math.min(...s.loads.map(load=>dist(t.loadDistance,load)),model.plate!==null&&s.loads.includes(model.plate)?1:25)));
    return total*0.45+logistics*emphasis;
  };
}

function controlOrdering(model:RelayModel,target:number){
  const distance=(a:number,b:number)=>Math.abs(a%64-b%64)+Math.abs((a>>6)-(b>>6));
  const approaches=distanceMap(model,target);
  const transfers=model.arms.map(arms=>relayStances({...model,plate:target,arms:[arms]}));
  return (pose:RelayState)=>{
    const near=(cell:number)=>Math.min(...pose.actors.map(actor=>distance(actor,cell)));
    const candidates=[...pose.loads,...(model.trialWeightOnly?[]:pose.actors),...(pose.subjects??[])];
    const adjacent=approaches.size>1?Math.min(...[...pose.reflectors,...candidates].map(cell=>
      (approaches.get(cell)??distance(cell,target)+8)*3+near(cell)*0.35)):Infinity;
    const reflect=Math.min(80,...transfers.flatMap((options,index)=>options.map(option=>
      distance(pose.reflectors[index]!,option.mirror)*3+Math.min(...candidates.map(cell=>
        distance(cell,option.load)*3+near(cell)*0.35)))));
    return solved(model,pose)?0:Math.min(adjacent,reflect);
  };
}

function directControlSetup(model:RelayModel,start:RelayState){
  const target=model.trialControl!;
  const distance=(s:RelayState)=>Math.min(...[...s.loads,...s.reflectors,...(s.subjects??[])].map(cell=>
    Math.abs(cell%64-target%64)+Math.abs((cell>>6)-(target>>6))));
  const initialDistance=distance(start);
  const first=branches(model,start).filter(candidate=>distance(candidate.state)<initialDistance)
    .sort((a,b)=>distance(a.state)-distance(b.state)||a.steps.length-b.steps.length);
  for(const branch of first.slice(0,8)){
    if(solved(model,branch.state))return branch.steps;
    const next=branches(model,branch.state).filter(candidate=>solved(model,candidate.state))
      .sort((a,b)=>a.steps.length-b.steps.length)[0];
    if(next)return [...branch.steps,...next.steps];
  }
}

function replayPath(node:Node) {
  const route:RelayStep[][]=[];
  for(let current:Node|null=node;current;current=current.parent)route.push(current.branch.steps);
  return route.reverse().flat();
}

function exploitPrepared(model:RelayModel,start:RelayState) {
  const root:Node={branch:{state:start,steps:[]},parent:null,cost:0,priority:0};
  const queue=[root], seen=new Set([signature(start)]);
  for(let index=0;index<queue.length&&index<1600;index++){
    const node=queue[index]!;
    if(solved(model,node.branch.state))return replayPath(node);
    for(const branch of branches(model,node.branch.state,true)){
      const id=signature(branch.state);
      if(seen.has(id))continue;
      seen.add(id);
      queue.push({branch,parent:node,cost:0,priority:0});
    }
  }
}

function enqueue(queue:Node[],n:Node) {
  let i=queue.push(n)-1;
  while(i>0){
    const p=(i-1)>>1;
    if(queue[p]!.priority<=n.priority)break;
    queue[i]=queue[p]!;
    i=p;
  }
  queue[i]=n;
}

function dequeue(queue:Node[]) {
  const n=queue[0]!,tail=queue.pop()!;
  if(!queue.length)return n;
  let i=0;
  while(i*2+1<queue.length){
    const l=i*2+1,r=l+1;
    const child=r<queue.length&&queue[r]!.priority<queue[l]!.priority?r:l;
    if(queue[child]!.priority>=tail.priority)break;
    queue[i]=queue[child]!;
    i=child;
  }
  queue[i]=tail;
  return n;
}

export async function findRelayPlan(model:RelayModel,start:RelayState,options:{maxNodes:number; emphasis?:number; yieldControl:()=>Promise<void>;signal?:AbortSignal}) {
  if(model.trialWeightOnly){
    const direct=directControlSetup(model,start);
    if(direct)return direct;
  }
  const stateKey=(state:RelayState,actor:number|undefined)=>model.activeActor===undefined
    ?signature(state):JSON.stringify([signature(state),actor]);
  const rank=ordering(model,options.emphasis??19), seen=new Map([[stateKey(start,model.activeActor),0]]);
  const templates=relayStances(model), ready=new Set<string>();
  const queue:Node[]=[{branch:{state:start,steps:[]},parent:null,cost:0,priority:rank(start)}];
  for(let read=0;queue.length&&read<options.maxNodes;read++){
    if(read%64===0){await options.yieldControl();if(options.signal?.aborted)return;}
    const node=dequeue(queue);
    const active=node.branch.steps.at(-1)?.actor??model.activeActor;
    if(node.cost!==seen.get(stateKey(node.branch.state,active)))continue;
    const state=node.branch.state;
    if(solved(model,state))return replayPath(node);
    const stage=templates.find(template=>template.mirror===state.reflectors[0]
      &&(state.loads.includes(template.load)||model.plate!==null&&state.loads.includes(model.plate)));
    if(stage){
      const trial=signature(state);
      if(!ready.has(trial)&&ready.size<12){
        ready.add(trial);
        const route=exploitPrepared(model,state);
        if(route)return [...replayPath(node),...route];
      }
    }
    for(const branch of branches(model,node.branch.state)){
      const actor=branch.steps[0]!.actor;
      const selection=model.activeActor!==undefined&&actor!==active?1:0;
      const id=stateKey(branch.state,actor), cost=node.cost+branch.steps.length+selection;
      if((seen.get(id)??Infinity)<=cost)continue;
      seen.set(id,cost);
      enqueue(queue,{branch,parent:node,cost,priority:cost+rank(branch.state)});
    }
  }
}
