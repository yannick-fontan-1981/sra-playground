import type { RelayMotion } from './observed-relay-plan.ts';

export type PlatformMark = { cell: number; control: number; activeWhenPressed: boolean };
export type PlatformPose = { actor: number; loads: number[]; reflectors: number[] };
export type PlatformStep = { action: string; before: PlatformPose; after: PlatformPose; projected: number[] };
export type PlatformRelayModel = {
  floor: ReadonlySet<number>; water: ReadonlySet<number>; platforms: PlatformMark[];
  arms: number[][]; moves: RelayMotion[]; capacity: number; trigger: string; goal: number;
};
type Branch = { pose: PlatformPose; steps: PlatformStep[] };
type Node = { branch: Branch; parent: Node | null; cost: number };

const sortCells = (cells: number[]) => cells.sort((a,b)=>a-b);
const signature = (pose: PlatformPose) => [pose.actor,...pose.loads,-1,...pose.reflectors].join(',');
const occupied = (pose: PlatformPose, cell: number) =>
  pose.actor===cell||pose.loads.includes(cell)||pose.reflectors.includes(cell);
export const platformAvailable = (mark: PlatformMark, pose: PlatformPose) =>
  occupied(pose,mark.control)===mark.activeWhenPressed;

function floorAt(model: PlatformRelayModel, pose: PlatformPose, cell: number) {
  if(model.floor.has(cell))return true;
  const platform=model.platforms.find(mark=>mark.cell===cell);
  return platform!==undefined&&platformAvailable(platform,pose);
}

const rayPassable=(model:PlatformRelayModel,cell:number)=>model.floor.has(cell)||model.water.has(cell);

function shift(model: PlatformRelayModel, pose: PlatformPose, moves: ReadonlyMap<number,number>) {
  const at=(cell:number)=>moves.get(cell)??cell;
  const next={actor:at(pose.actor),loads:sortCells(pose.loads.map(at)),reflectors:pose.reflectors.map(at)};
  const cells=[next.actor,...next.loads,...next.reflectors];
  if(new Set(cells).size!==cells.length||cells.some(cell=>!floorAt(model,next,cell)))return;
  return next;
}

function projectedMovement(model: PlatformRelayModel, pose: PlatformPose) {
  const moves=new Map<number,number>(), lanes=new Set<number>();
  for(const [index,reflector] of pose.reflectors.entries()){
    const [a,b]=model.arms[index]!;
    for(const [from,to] of [[a!,b!],[b!,a!]] as const){
      let origin=reflector, target=reflector;
      const incoming:number[]=[], outgoing:number[]=[];
      for(let span=1;span<32;span++){
        origin+=from; target+=to;
        if(!rayPassable(model,origin)||pose.reflectors.includes(origin))break;
        incoming.push(origin);
        outgoing.push(target);
        if(!occupied(pose,origin))continue;
        if(outgoing.some(cell=>!rayPassable(model,cell)||pose.reflectors.includes(cell))
          ||moves.has(origin)&&moves.get(origin)!==target)return;
        moves.set(origin,target);
        for(const cell of [...incoming,...outgoing])lanes.add(cell);
        break;
      }
    }
  }
  if(!moves.size||[...lanes].some(cell=>occupied(pose,cell)&&!moves.has(cell)))return;
  return moves;
}

function reflect(model: PlatformRelayModel, before: PlatformPose): PlatformStep | undefined {
  const moves=projectedMovement(model,before);
  if(!moves)return;
  const after=shift(model,before,moves);
  if(after)return {action:model.trigger,before,after,projected:sortCells([...moves.values()])};
}

function directions(model:PlatformRelayModel,before:PlatformPose,mode:'walk'|'push'|'mirror') {
  const out:PlatformStep[]=[];
  for(const {axis,action} of model.moves){
    const to=before.actor+axis;
    if(!floorAt(model,before,to))continue;
    const moves=new Map([[before.actor,to]]);
    let end=to,n=0;
    while(occupied(before,end)&&n<model.capacity&&mode!=='walk'){
      if(mode==='mirror'&&!before.reflectors.includes(end))break;
      moves.set(end,end+axis);
      end+=axis;
      n++;
    }
    if(occupied(before,end)||mode==='mirror'&&!n)continue;
    const after=shift(model,before,moves);
    if(after)out.push({action,before,after,projected:[]});
  }
  return out;
}

function walkingBranches(model:PlatformRelayModel,pose:PlatformPose) {
  const queue:Branch[]=[{pose,steps:[]}], seen=new Set([pose.actor]);
  for(const branch of queue){
    for(const step of directions(model,branch.pose,'walk')){
      if(seen.has(step.after.actor))continue;
      seen.add(step.after.actor);
      queue.push({pose:step.after,steps:[...branch.steps,step]});
    }
  }
  return queue;
}

function terminalWalk(model:PlatformRelayModel,start:PlatformPose,fixed:ReadonlySet<number>) {
  const queue:Node[]=[{branch:{pose:start,steps:[]},parent:null,cost:0}];
  const seen=new Set([signature(start)]);
  for(let i=0;i<queue.length&&i<1600;i++){
    const node=queue[i]!,{pose}=node.branch;
    if(pose.actor===model.goal)return replay(node);
    const transfer=reflect(model,pose);
    for(const step of [...directions(model,pose,'walk'),...(transfer?[transfer]:[])]){
      const id=signature(step.after);
      if(seen.has(id)||[...fixed].some(cell=>!step.after.loads.includes(cell)))continue;
      seen.add(id);
      queue.push({branch:{pose:step.after,steps:[step]},parent:node,cost:node.cost+1});
    }
  }
}

function requiredPresses(model:PlatformRelayModel,start:PlatformPose) {
  const targets=new Map(model.platforms.map(mark=>[mark.cell,mark]));
  const reach=new Map<number,number>([[start.actor,start.actor]]);
  for(const [from] of reach){
    if(from===model.goal)break;
    for(const {axis} of model.moves){
      const to=from+axis;
      if(!reach.has(to)&&(model.floor.has(to)||targets.has(to)))reach.set(to,from);
    }
  }
  if(!reach.has(model.goal))return;
  const controls=new Map<number,boolean[]>();
  const path:number[]=[];
  for(let at=model.goal;at!==start.actor;at=reach.get(at)!)path.push(at);
  for(const at of path.reverse()){
    const mark=targets.get(at);
    if(!mark)continue;
    const modes=controls.get(mark.control)??[];
    modes.push(mark.activeWhenPressed);
    controls.set(mark.control,modes);
  }
  return {
    load:[...controls].filter(([,modes])=>modes[0]).map(([cell])=>cell),
    fixed:new Set([...controls].filter(([,modes])=>modes.every(Boolean)).map(([cell])=>cell)),
  };
}

const manhattan=(a:number,b:number)=>Math.abs(a%64-b%64)+Math.abs(Math.floor(a/64)-Math.floor(b/64));

function loadingRank(model:PlatformRelayModel, targets:number[]) {
  const templates=targets.map(target=>model.arms.map(([a,b])=>[...model.floor].flatMap(reflector=>{
    const options:{ reflector:number; load:number }[]=[];
    for(const [incoming,outgoing] of [[a!,b!],[b!,a!]] as const){
      for(let n=1;n<32;n++){
        const source=reflector+incoming*n, dest=reflector+outgoing*n;
        if(!rayPassable(model,source)||!rayPassable(model,dest))break;
        if(dest===target&&model.floor.has(source))options.push({reflector,load:source});
      }
    }
    return options;
  })));
  return (pose:PlatformPose)=>targets.reduce((sum,target,i)=>{
    if(pose.loads.includes(target))return sum;
    let least=Math.min(100,...pose.loads.map(load=>manhattan(load,target)+4));
    for(const [index,options] of templates[i]!.entries())
      for(const option of options)for(const load of pose.loads)
        if(!targets.includes(load))
          least=Math.min(least,manhattan(pose.reflectors[index]!,option.reflector)+manhattan(load,option.load)+1);
    return sum+least+1;
  },0);
}

function protectionRank(model:PlatformRelayModel, fixed:ReadonlySet<number>, pose:PlatformPose) {
  const moves=projectedMovement(model,pose);
  if(!moves)return 0;
  let distance=0;
  for(const source of fixed){
    if(!moves.has(source))continue;
    let closest=32;
    for(const [index,origin] of pose.reflectors.entries())for(const axis of model.arms[index]!){
      for(let at=origin+axis;rayPassable(model,at)&&!pose.reflectors.includes(at);at+=axis){
        if(at!==source&&occupied(pose,at))break;
        if(at!==source)continue;
        for(let blocker=origin+axis;blocker!==source;blocker+=axis){
          if(!model.floor.has(blocker))continue;
          for(const other of pose.reflectors)
            if(other!==origin)closest=Math.min(closest,manhattan(other,blocker));
        }
        break;
      }
    }
    distance+=closest;
  }
  return distance;
}

function replay(node:Node) {
  const chunks:PlatformStep[][]=[];
  for(let at:Node|null=node;at;at=at.parent)chunks.push(at.branch.steps);
  return chunks.reverse().flat();
}

async function search(model:PlatformRelayModel,start:PlatformPose,accept:(pose:PlatformPose)=>PlatformStep[]|undefined,
  rank:(pose:PlatformPose)=>number, mode:'load'|'protect', execution:{yieldControl:()=>Promise<void>;signal?:AbortSignal},
  jointTargets:readonly number[]=[]){
  const queue=new Map<number,Node[]>([[0,[{branch:{pose:start,steps:[]},parent:null,cost:0}]]]);
  const costs=new Map([[signature(start),0]]);
  const limit=jointTargets.length?800:5000;
  for(let read=0;queue.size&&read<limit;read++){
    if(read%32===0){await execution.yieldControl();if(execution.signal?.aborted)return;}
    const priority=Math.min(...queue.keys()), bucket=queue.get(priority)!, node=bucket.shift()!;
    if(!bucket.length)queue.delete(priority);
    const pose=node.branch.pose;
    if(costs.get(signature(pose))!==node.cost)continue;
    const tail=accept(pose);
    if(tail)return {steps:[...replay(node),...tail],pose:tail.at(-1)?.after??pose};
    for(const branch of walkingBranches(model,pose)){
      const moves=directions(model,branch.pose,mode==='load'?'push':'mirror')
        .filter(step=>signature(step.after)!==signature(branch.pose)&&(
          step.after.loads.join(',')!==branch.pose.loads.join(',')||step.after.reflectors.join(',')!==branch.pose.reflectors.join(',')));
      const transfer=mode==='load'?reflect(model,branch.pose):undefined;
      if(transfer&&(!jointTargets.some(cell=>transfer.after.loads.includes(cell)&&!branch.pose.loads.includes(cell))
        ||jointTargets.every(cell=>transfer.after.loads.includes(cell))))moves.push(transfer);
      for(const step of moves){
        const id=signature(step.after), cost=node.cost+branch.steps.length+1;
        if(cost>64||(costs.get(id)??Infinity)<=cost)continue;
        costs.set(id,cost);
        const score=cost+rank(step.after)*(mode==='load'?9:13);
        const list=queue.get(score)??[];
        list.push({branch:{pose:step.after,steps:[...branch.steps,step]},parent:node,cost});
        queue.set(score,list);
      }
    }
  }
}

export async function planPlatformRelay(model:PlatformRelayModel,start:PlatformPose,
  execution:{yieldControl:()=>Promise<void>;signal?:AbortSignal}):Promise<PlatformStep[]|undefined> {
  const needs=requiredPresses(model,start);
  if(!needs||!needs.load.length||needs.load.length>start.loads.length)return;
  const loaded=(pose:PlatformPose)=>needs.load.every(cell=>pose.loads.includes(cell))?[]:undefined;
  const rank=loadingRank(model,needs.load);
  const ready=await search(model,start,loaded,rank,'load',execution,needs.load.length>1?needs.load:[])
    ??await search(model,start,loaded,rank,'load',execution);
  if(!ready)return;
  if(!ready.steps.length){
    const direct=terminalWalk(model,start,needs.fixed);
    if(direct?.length)return direct;
  }
  const end=await search(model,ready.pose,pose=>terminalWalk(model,pose,needs.fixed),
    pose=>protectionRank(model,needs.fixed,pose),'protect',execution);
  return end?[...ready.steps,...end.steps]:ready.steps;
}
