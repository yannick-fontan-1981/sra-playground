/** Author tools only. No solver or witness is imported by the playable game. */
import {compileLevel,initialState,stepDetailed} from '../dist/core.js';
const cell=p=>p.y*20+p.x;
const positions=ps=>ps.map(cell).sort((a,b)=>a-b).join(',');
export const stateKey=s=>`${s.heroes.map(h=>`${h.kind}:${cell(h.at)}:${+!!h.dead}`).join(';')}|${s.active}|${positions(s.stones)}|${positions(s.monsters)}|${positions(s.supports)}|${s.mirrors.map(m=>`${cell(m.at)}:${m.facing}`).sort().join(',')}|${(s.gateClosed??[]).map(Number).join('')}|${(s.platformActive??[]).map(Number).join('')}`;
export function decodeCommand(c,state){
 if(c==='C'){const h=state.heroes[1-state.active];return {id:6,data:{x:3+h.at.x*3,y:3+h.at.y*3}};}
 const id={U:1,D:2,L:3,R:4,X:5}[c];if(!id)throw new Error(`Unknown command ${c}`);return {id};
}
export function replay(spec,commands){
 const world=compileLevel(spec);let state=initialState(world);
 const text=typeof commands==='string'?commands.replace(/\s/g,''):commands;
 const actions=[],trace=[],metrics={actions:0,selections:0,merchantPushes:0,warriorPushes:0,chainPushes:0,stoneMoves:0,mirrorMoves:0,reflections:0,heroReflections:0,pistonPushes:0,platformsCreated:0,monstersRemoved:0,blocked:0,deaths:0};
 for(const c of text){
  const action=typeof c==='string'?decodeCommand(c,state):c,before=state,detail=stepDetailed(world,state,action.id,action.data);state=detail.state;actions.push(action);metrics.actions++;
  metrics.selections+=+(before.active!==state.active);metrics.blocked+=+state.failed;metrics.deaths+=+(!before.dead&&state.dead);
  metrics.platformsCreated+=Math.max(0,state.supports.length-before.supports.length);metrics.monstersRemoved+=before.monsters.length-state.monsters.length;
  for(const phase of detail.phases){
   if(phase.kind==='push'){metrics[before.heroes[before.active].kind==='merchant'?'merchantPushes':'warriorPushes']++;metrics.chainPushes+=+(phase.moves.length>=3);}
   if(phase.kind==='reflect'){metrics.reflections++;metrics.heroReflections+=phase.moves.filter(m=>m.actor==='hero').length;}
   if(phase.kind==='piston')metrics.pistonPushes++;
   for(const move of phase.moves){metrics.stoneMoves+=+(move.actor==='stone');metrics.mirrorMoves+=+(move.actor==='mirror');}
  }
  trace.push({command:typeof c==='string'?c:action.id,action,before,after:state,phases:detail.phases});
 }
 return {world,state,actions,trace,metrics};
}
/** Exhausted queues prove impossibility; time/state limits remain inconclusive. */
export function solve(spec,{maxStates=100000,maxMs=10000,start,goal,disableReflections=false,disablePistons=false,disablePlatforms=false,disableWarriorChains=false,disableMirrorMotion=false,disableSelection=false}={}){
 const world=compileLevel(spec),initial=start??initialState(world),began=performance.now(),nodes=[{state:initial,parent:-1,command:''}],seen=new Set([stateKey(initial)]);let expanded=0;
 const result=status=>({status,states:seen.size,expanded,ms:Math.round(performance.now()-began)});
 const route=i=>{let commands='';while(nodes[i].parent>=0){commands=nodes[i].command+commands;i=nodes[i].parent;}return commands;};
 for(let head=0;head<nodes.length;head++){
  if(performance.now()-began>=maxMs)return result('limit');const node=nodes[head];expanded++;
  if(goal?goal(node.state,world):node.state.complete)return {...result('solved'),commands:route(head),state:node.state};
  if(node.state.dead)continue;
  for(const command of 'UDLRXC'){
   if((command==='X'&&disableReflections)||(command==='C'&&disableSelection))continue;
   const a=decodeCommand(command,node.state),detail=stepDetailed(world,node.state,a.id,a.data),next=detail.state;
   if(next.failed||next.dead)continue;
   if(disablePistons&&detail.phases.some(p=>p.kind==='piston'||p.kind==='crush'))continue;
   if(disablePlatforms&&next.supports.length>node.state.supports.length)continue;
   if(disableWarriorChains&&detail.phases.some(p=>p.kind==='push'&&p.moves.length>=3))continue;
   if(disableMirrorMotion&&detail.phases.some(p=>p.moves.some(m=>m.actor==='mirror')))continue;
   const key=stateKey(next);if(seen.has(key))continue;if(seen.size>=maxStates)return result('limit');
   seen.add(key);nodes.push({state:next,parent:head,command});
  }
 }
 return result('unsolvable');
}
