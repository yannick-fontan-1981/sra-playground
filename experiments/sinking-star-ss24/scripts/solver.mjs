/** Author tools only; no search, solution or state metadata is imported by the game. */
import {compileLevel,initialState,stepDetailed} from '../dist/core.js';
const cell=p=>p.y*20+p.x;
const positions=ps=>ps.map(cell).sort((a,b)=>a-b).join(',');
export const stateKey=s=>`${s.heroes.map(h=>`${h.kind}:${cell(h.at)}:${+!!h.dead}`).join(';')}|${s.active}|${positions(s.stones)}|${positions(s.monsters)}|${positions(s.supports)}|${s.mirrors.map(m=>`${cell(m.at)}:${m.facing}`).sort().join(',')}|${(s.gateClosed??[]).map(Number).join('')}|${(s.platformActive??[]).map(Number).join('')}`;
export function decodeCommand(c,state){
 if(c==='C'){const h=state.heroes[(state.active+1)%state.heroes.length];return {id:6,data:{x:3+h.at.x*3,y:3+h.at.y*3}};}
 const id={U:1,D:2,L:3,R:4,X:5}[c];if(!id)throw new Error(`Unknown command ${c}`);return {id};
}
const eq=(a,b)=>a.x===b.x&&a.y===b.y;
export function replay(spec,commands){
 const world=compileLevel(spec);let state=initialState(world);
 const text=typeof commands==='string'?commands.replace(/\s/g,''):commands;
 const actions=[],trace=[],metrics={actions:0,selections:0,merchantPushes:0,thiefPulls:0,thiefPartnerPulls:0,thiefMirrorPulls:0,swaps:0,wizardHeroSwaps:0,wizardStoneSwaps:0,wizardMonsterSwaps:0,bentSwaps:0,songs:0,groupSongs:0,songHeroMoves:0,songStoneMoves:0,songMonsterMoves:0,supportMoves:0,partnerMoves:0,stoneMoves:0,mirrorMoves:0,monsterMoves:0,reflections:0,heroReflections:0,pistonPushes:0,platformsCreated:0,monstersRemoved:0,blocked:0,deaths:0};
 for(const c of text){
  const action=typeof c==='string'?decodeCommand(c,state):c,before=state,detail=stepDetailed(world,state,action.id,action.data);state=detail.state;actions.push(action);metrics.actions++;
  metrics.selections+=+(before.active!==state.active);metrics.blocked+=+state.failed;metrics.deaths+=+(!before.dead&&state.dead);
  metrics.platformsCreated+=Math.max(0,state.supports.length-before.supports.length);metrics.monstersRemoved+=before.monsters.length-state.monsters.length;
  for(const phase of detail.phases){
   if(phase.kind==='push'){
    const active=phase.before.heroes[phase.before.active];
    if(active.kind==='merchant')metrics.merchantPushes++;
   }
   if(phase.kind==='pull'){metrics.thiefPulls++;metrics.thiefPartnerPulls+=+phase.moves.some(m=>m.actor==='hero'&&!eq(m.from,phase.before.heroes[phase.before.active].at));metrics.thiefMirrorPulls+=+phase.moves.some(m=>m.actor==='mirror');}
   if(phase.kind==='swap'){metrics.swaps++;const targets=phase.moves.filter(m=>!eq(m.from,phase.before.heroes[phase.before.active].at));metrics.wizardHeroSwaps+=+targets.some(m=>m.actor==='hero');metrics.wizardStoneSwaps+=+targets.some(m=>m.actor==='stone');metrics.wizardMonsterSwaps+=+targets.some(m=>m.actor==='monster');const path=phase.paths?.[0]??[];metrics.bentSwaps+=+path.some((p,i)=>i>1&&(p.x-path[i-1].x)!==(path[i-1].x-path[i-2].x));}
   if(phase.kind==='song'){metrics.songs++;metrics.groupSongs+=+(phase.moves.length>=3);metrics.songHeroMoves+=phase.moves.filter(m=>m.actor==='hero'&&!eq(m.from,phase.before.heroes[phase.before.active].at)).length;metrics.songStoneMoves+=phase.moves.filter(m=>m.actor==='stone').length;metrics.songMonsterMoves+=phase.moves.filter(m=>m.actor==='monster').length;}
   if(['push','pull','swap','song'].includes(phase.kind))metrics.partnerMoves+=phase.moves.filter(m=>m.actor==='hero'&&phase.before.heroes.some((h,i)=>i!==phase.before.active&&eq(h.at,m.from))).length;
   if(phase.kind==='reflect'){metrics.reflections++;metrics.heroReflections+=phase.moves.filter(m=>m.actor==='hero').length;}
   if(phase.kind==='piston')metrics.pistonPushes++;
   for(const move of phase.moves){metrics.stoneMoves+=+(move.actor==='stone');metrics.mirrorMoves+=+(move.actor==='mirror');metrics.supportMoves+=+(move.actor==='support');metrics.monsterMoves+=+(move.actor==='monster');}
  }
  trace.push({command:typeof c==='string'?c:action.id,action,before,after:state,phases:detail.phases});
 }
 return {world,state,actions,trace,metrics};
}
/** Queue exhaustion proves impossibility; time/state limits remain inconclusive. */
export function solve(spec,{maxStates=100000,maxMs=10000,start,goal,disableReflections=false,disablePistons=false,disablePlatforms=false,disablePush=false,disableMerchantPushes=false,disableThiefPulls=false,disableSwap=false,disableSong=false,disableSongs=false,disableSupportMotion=false,disableHeroReflections=false,disableMirrorMotion=false,disableSelection=false}={}){
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
   if(disablePush&&detail.phases.some(p=>p.kind==='push'))continue;
   if(disableMerchantPushes&&detail.phases.some(p=>p.kind==='push'&&p.before.heroes[p.before.active].kind==='merchant'))continue;
   if(disableThiefPulls&&detail.phases.some(p=>p.kind==='pull'&&p.before.heroes[p.before.active].kind==='thief'))continue;
   if(disableSwap&&detail.phases.some(p=>p.kind==='swap'))continue;
   if((disableSong||disableSongs)&&detail.phases.some(p=>p.kind==='song'))continue;
   if(disableSupportMotion&&detail.phases.some(p=>p.moves.some(m=>m.actor==='support')))continue;
   if(disableHeroReflections&&detail.phases.some(p=>p.kind==='reflect'&&p.moves.some(m=>m.actor==='hero')))continue;
   if(disableMirrorMotion&&detail.phases.some(p=>p.moves.some(m=>m.actor==='mirror')))continue;
   const key=stateKey(next);if(seen.has(key))continue;if(seen.size>=maxStates)return result('limit');
   seen.add(key);nodes.push({state:next,parent:head,command});
  }
 }
 return result('unsolvable');
}
