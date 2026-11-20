/** Author-only exhaustive state search. Never imported by the browser or an agent. */
import {compileLevel,initialState,stepDetailed,planSwap} from '../dist/core.js';
const cell=p=>p.y*20+p.x;
const positions=ps=>ps.map(cell).sort((a,b)=>a-b).join(',');
export const stateKey=s=>`${cell(s.hero)}|${positions(s.stones)}|${positions(s.monsters)}|${positions(s.supports)}|${(s.gateClosed??[]).map(Number).join('')}`;
const dir=['N','S','W','E'];
/** Four directions determine sight and movement, so previous facing has no logical effect. */
export function solve(spec,{maxStates=250000,maxMs=15000,disableSwap=false,disableReflections=false,disablePistons=false,disablePlatforms=false,disableMonsterSwap=false}={}) {
  const world=compileLevel(spec),start=initialState(world),began=performance.now();
  const nodes=[{state:start,parent:-1,action:0}],seen=new Set([stateKey(start)]);
  let expanded=0;
  const result=status=>({status,states:seen.size,expanded,ms:performance.now()-began});
  const route=index=>{const actions=[];while(nodes[index].parent>=0){actions.push(nodes[index].action);index=nodes[index].parent;}return actions.reverse();};
  for(let head=0;head<nodes.length;head++) {
    if(performance.now()-began>=maxMs)return result('limit');
    const node=nodes[head];expanded++;
    if(node.state.complete)return {...result('solved'),actions:route(head)};
    if(node.state.dead)continue;
    for(let action=1;action<=4;action++) {
      const plan=(disableReflections||disableMonsterSwap)?planSwap(world,node.state,dir[action-1]):null;
      if(disableReflections&&(plan?.reflections??0)>0)continue;
      if(disableMonsterSwap&&plan?.target==='monster')continue;
      const detail=stepDetailed(world,node.state,action),next=detail.state;
      if(next.dead||next.failed)continue;
      if(disableSwap&&detail.phases.some(p=>p.kind==='swap'))continue;
      if(disablePistons&&detail.phases.some(p=>p.kind==='piston'||p.kind==='crush'))continue;
      if(disablePlatforms&&next.supports.length>node.state.supports.length)continue;
      const key=stateKey(next);if(seen.has(key))continue;
      if(seen.size>=maxStates)return result('limit');
      seen.add(key);nodes.push({state:next,parent:head,action});
    }
  }
  return result('unsolvable');
}
export function replay(spec,actions) {
  const world=compileLevel(spec);let state=initialState(world);
  const metrics={actions:actions.length,swaps:0,reflectedSwaps:0,monsterSwaps:0,pistonPushes:0,platformsCreated:0,monstersRemoved:0,blocked:0,deaths:0};
  const trace=[];
  for(const action of actions) {
    const before=state,plan=planSwap(world,state,dir[action-1]),detail=stepDetailed(world,state,action);state=detail.state;
    metrics.blocked+=Number(state.failed);metrics.deaths+=Number(state.dead&&!before.dead);
    metrics.platformsCreated+=state.supports.length-before.supports.length;
    metrics.monstersRemoved+=before.monsters.length-state.monsters.length;
    for(const phase of detail.phases) {
      if(phase.kind==='swap'){
        metrics.swaps++;
        if((plan?.reflections??0)>0)metrics.reflectedSwaps++;
        if(plan?.target==='monster')metrics.monsterSwaps++;
      }
      if(phase.kind==='piston')metrics.pistonPushes++;
    }
    trace.push({action,before,after:state,phases:detail.phases.map(p=>({kind:p.kind,moves:p.moves})),plan});
  }
  return {world,state,metrics,trace};
}
