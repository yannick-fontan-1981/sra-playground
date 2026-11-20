/** Author-only exhaustive search; no import from the game, browser or SRA runtime. */
import {compileLevel,initialState,stepDetailed} from '../dist/core.js';
const cell=p=>p.y*20+p.x;
const positions=ps=>ps.map(cell).sort((a,b)=>a-b).join(',');
export const stateKey=s=>`${cell(s.hero)}|${positions(s.stones)}|${positions(s.monsters)}|${positions(s.supports)}|${(s.gateClosed??[]).map(Number).join('')}`;
export const stringActions=s=>[...s].map(c=>({U:1,D:2,L:3,R:4,X:5})[c]);
export const actionsString=as=>as.map(a=>'UDLRX'[a-1]).join('');
/** A limit is an inconclusive search, never a proof of impossibility. */
export function solve(spec,{maxStates=250000,maxMs=15000,disableSong=false,disableReflections=false,disablePistons=false,disablePlatforms=false,disablePlatformMotion=false,disableMonsterSong=false,start,goal}={}) {
  const world=compileLevel(spec),initial=start??initialState(world),began=performance.now();
  const nodes=[{state:initial,parent:-1,action:0}],seen=new Set([stateKey(initial)]);
  let expanded=0;
  const result=status=>({status,states:seen.size,expanded,ms:performance.now()-began});
  const route=index=>{const actions=[];while(nodes[index].parent>=0){actions.push(nodes[index].action);index=nodes[index].parent;}return actions.reverse();};
  for(let head=0;head<nodes.length;head++) {
    if(performance.now()-began>=maxMs)return result('limit');
    const node=nodes[head];expanded++;
    if(goal?goal(node.state,world):node.state.complete)return {...result('solved'),actions:route(head),state:node.state};
    if(node.state.dead)continue;
    for(let action=1;action<=(disableReflections?4:5);action++) {
      const detail=stepDetailed(world,node.state,action),next=detail.state;
      if(next.dead||next.failed)continue;
      const song=detail.phases.filter(p=>p.kind==='song');
      if(disableSong&&song.some(p=>p.moves.some(m=>m.actor!=='hero')))continue;
      if(disableMonsterSong&&song.some(p=>p.moves.some(m=>m.actor==='monster')))continue;
      if(disablePlatformMotion&&song.some(p=>p.moves.some(m=>m.actor==='support')))continue;
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
  const metrics={actions:actions.length,songTurns:0,stoneMoves:0,monsterMoves:0,platformMoves:0,reflections:0,pistonPushes:0,platformsCreated:0,monstersRemoved:0,blocked:0,deaths:0};
  const trace=[];
  for(const action of actions) {
    const before=state,detail=stepDetailed(world,state,action);state=detail.state;
    metrics.blocked+=Number(state.failed);metrics.deaths+=Number(state.dead&&!before.dead);
    metrics.platformsCreated+=Math.max(0,state.supports.length-before.supports.length);
    metrics.monstersRemoved+=before.monsters.length-state.monsters.length;
    for(const phase of detail.phases) {
      if(phase.kind==='song'){
        metrics.songTurns++;
        for(const motion of phase.moves){
          if(motion.actor==='stone')metrics.stoneMoves++;
          if(motion.actor==='monster')metrics.monsterMoves++;
          if(motion.actor==='support')metrics.platformMoves++;
        }
      }
      if(phase.kind==='reflect')metrics.reflections++;
      if(phase.kind==='piston')metrics.pistonPushes++;
    }
    trace.push({action,before,after:state,phases:detail.phases.map(p=>({kind:p.kind,moves:p.moves}))});
  }
  return {world,state,metrics,trace};
}
