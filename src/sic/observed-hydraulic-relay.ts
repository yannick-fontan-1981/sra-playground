import { findRelayPlan, relayPlatformAvailable, type RelayModel, type RelayState, type RelayStep } from './observed-relay-plan.ts';

const axes=[-64,64,-1,1];
const distance=(a:number,b:number)=>Math.abs(a%64-b%64)+Math.abs((a>>6)-(b>>6));

function pushDistances(floor:ReadonlySet<number>,target:number){
  const distances=new Map([[target,0]]);
  for(const [cell,n] of distances)for(const axis of axes){
    const from=cell-axis;
    if(floor.has(from)&&floor.has(from-axis)&&!distances.has(from))distances.set(from,n+1);
  }
  return distances;
}

function bankFrom(floor:ReadonlySet<number>,start:number){
  const cells=new Set([start]);
  for(const cell of cells)for(const axis of axes)if(floor.has(cell+axis))cells.add(cell+axis);
  return cells;
}

function assignment(loads:number[],targets:readonly ReadonlyMap<number,number>[]):number{
  if(loads.length<targets.length)return Infinity;
  // Shortest augmenting paths give a minimum-cost matching. An unreachable
  // target has no edge, and a load can be reserved for only one platform.
  const targetPotential=Array<number>(targets.length+1).fill(0);
  const loadPotential=Array<number>(loads.length+1).fill(0);
  const owner=Array<number>(loads.length+1).fill(0);
  for(let target=1;target<=targets.length;target++){
    owner[0]=target;
    let load=0;
    const used=Array<boolean>(loads.length+1).fill(false);
    const slack=Array<number>(loads.length+1).fill(Infinity);
    const previous=Array<number>(loads.length+1).fill(0);
    do{
      used[load]=true;
      const reserved=owner[load]!;
      let step=Infinity, next=0;
      for(let candidate=1;candidate<=loads.length;candidate++){
        if(used[candidate])continue;
        const cost=targets[reserved-1]!.get(loads[candidate-1]!)??Infinity;
        const reduced=cost-targetPotential[reserved]!-loadPotential[candidate]!;
        if(reduced<slack[candidate]!){slack[candidate]=reduced;previous[candidate]=load;}
        if(slack[candidate]!<step){step=slack[candidate]!;next=candidate;}
      }
      if(!Number.isFinite(step))return Infinity;
      for(let candidate=0;candidate<=loads.length;candidate++){
        if(used[candidate]){
          const row=owner[candidate]!;
          targetPotential[row]=targetPotential[row]!+step;
          loadPotential[candidate]=loadPotential[candidate]!-step;
        }else slack[candidate]=slack[candidate]!-step;
      }
      load=next;
    }while(owner[load]!==0);
    while(load!==0){
      const parent=previous[load]!;
      owner[load]=owner[parent]!;
      load=parent;
    }
  }
  return -loadPotential[0]!;
}

type HydraulicPlan = { steps:RelayStep[]; purpose:string; trial?:number };
type Execution = { yieldControl:()=>Promise<void>; signal?:AbortSignal };

/** Keep the occupied control, its dependent crossing, and the cargo needed to
 * replace that crossing in the same model. Physical changes at an untested
 * control are observed at a boundary before planning from the new pose. */
export async function planHydraulicRelay(model:RelayModel,pose:RelayState,untested:readonly number[],execution:Execution):Promise<HydraulicPlan|undefined>{
  const temporary=model.platforms?.filter(mark=>!pose.supports.includes(mark.cell))??[];
  if(temporary.length){
    const controls=[...new Set(temporary.filter(mark=>mark.activeWhenPressed).map(mark=>mark.control))];
    controls.sort((a,b)=>Number(pose.actors.includes(b))-Number(pose.actors.includes(a)));
    for(const control of controls){
      const span=temporary.filter(mark=>mark.control===control&&mark.activeWhenPressed);
      const plan=await planHeldSpan(model,pose,control,span,untested,execution);
      if(plan||execution.signal?.aborted)return plan;
    }
  }
  const steps=await findRelayPlan({...model,...(!temporary.length?{platforms:undefined}:{}),plate:null},pose,
    {...execution,maxNodes:16000});
  if(steps?.length)return {steps,purpose:temporary.length?'compose_group_destination_after_access':'complete_destinations_after_permanent_crossing'};
}

async function planHeldSpan(model:RelayModel,pose:RelayState,control:number,
  platforms:NonNullable<RelayModel['platforms']>,untested:readonly number[],execution:Execution):Promise<HydraulicPlan|undefined>{
  const span=platforms.map(mark=>mark.cell);
  const floor=new Set([...model.floor,...pose.supports,...span]);
  const targets=span.map(cell=>pushDistances(floor,cell));
  const mobile=new Set(targets.flatMap(map=>[...map.keys()]));
  const bank=bankFrom(new Set([...model.floor,...pose.supports]),control);
  const extraction=new Map<number,number>();
  for(const cell of floor)if(!mobile.has(cell))extraction.set(cell,Math.min(25,...[...mobile].map(other=>distance(cell,other))));
  const presses=platforms.some(mark=>relayPlatformAvailable(mark,pose));
  let holder=pose.actors.indexOf(control);
  const search={...execution,maxNodes:9500};
  if(!presses||holder<0){
    holder=model.pull?.findIndex((pull,index)=>pull&&model.capacity.some((cap,peer)=>peer!==index&&cap>0))??-1;
    const anchor=holder<0?pose.actors.indexOf(pose.actors.reduce((old,cell)=>distance(cell,control)<distance(old,control)?cell:old)):holder;
    const courier=pose.actors.findIndex((_,index)=>index!==anchor);
    const remainingPushes=(cell:number)=>Math.min(...targets.map(map=>map.get(cell)??Infinity));
    const accessRank=(state:RelayState)=>{
      const blocked=new Set([...state.loads,...state.reflectors,state.actors[anchor]!]);
      const reach=bankFrom(new Set([...bank].filter(cell=>!blocked.has(cell))),state.actors[courier]!);
      return state.loads.filter(cell=>bank.has(cell)&&!axes.some(axis=>reach.has(cell-axis)
        &&!blocked.has(cell+axis)&&remainingPushes(cell+axis)<remainingPushes(cell)))
        .reduce((total,cell)=>total+8+(extraction.get(cell)??0),0);
    };
    const steps=await findRelayPlan({...model,plate:control},pose,{...search,objective:{
      accept:state=>state.actors[anchor]===control&&accessRank(state)===0,
      rank:state=>accessRank(state)*8+distance(state.actors[anchor]!,control)*1.5,
    }});
    if(steps?.length)return {steps,purpose:'prepare_reserved_loads_and_hold_crossing'};
    return;
  }
  const held={...model,heldBy:{actor:holder,cell:control},plate:control};
  const courier=pose.actors.findIndex((_,index)=>index!==holder);
  for(const target of untested){
    const steps=await findRelayPlan({...held,observedTargets:[target]},pose,{...execution,maxNodes:1000,objective:{
      accept:state=>state.actors[courier]===target,
      rank:state=>distance(state.actors[courier]!,target)*2,
    }});
    if(steps?.length)return {steps,purpose:'cross_on_held_platforms_and_test_control',trial:target};
  }
  if(!span.every(cell=>pose.loads.includes(cell))){
    const estimates=new Map<string,number>();
    const estimate=(state:RelayState)=>{
      const signature=state.loads.join(',');
      const previous=estimates.get(signature);
      if(previous!==undefined)return previous;
      const cost=assignment(state.loads,targets);
      estimates.set(signature,cost);
      return cost;
    };
    const steps=await findRelayPlan({...held,trigger:''},pose,{...search,objective:{
      accept:state=>span.every(cell=>state.loads.includes(cell)),
      rank:state=>estimate(state)*10,
      admit:state=>Number.isFinite(estimate(state)),
    }});
    if(steps?.length)return {steps,purpose:'load_the_platforms_for_permanent_crossing'};
    return;
  }
  const steps=await findRelayPlan({...model,plate:control},pose,{...execution,maxNodes:1000,objective:{
    accept:state=>span.every(cell=>state.supports.includes(cell)),rank:()=>0,
  }});
  if(steps?.length)return {steps,purpose:'release_control_to_build_permanent_crossing'};
}
