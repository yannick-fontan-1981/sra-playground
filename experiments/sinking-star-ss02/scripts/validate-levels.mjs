import {readFile,writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {compileLevel,initialState,stepWorld,planPush,doorsOpen,contains,PushPuzzleSession} from '../dist/core.js';
import {SS02_LEVELS} from '../dist/levels.js';
import {reachable,solve} from './solver.mjs';
const witnesses=JSON.parse(await readFile(new URL('../tests/witnesses.json',import.meta.url),'utf8'));
const report={game:'SS02',levels:[],success:false};
const rebuilt=new Set([3,4,5,6,8]);
const num=p=>p.y*20+p.x;
const session=new PushPuzzleSession(SS02_LEVELS);let animationCount=0;
for(const [i,spec] of SS02_LEVELS.entries()){
 const w=compileLevel(spec);let s=initialState(w),pushes=0,maxChain=0,platformWalks=0,platformPushes=0,crossAxisPlatformPushes=0;
 const supportDirections=new Map();
 const n=reachable(w,s).size;
 for(const a of witnesses[i].actions){
  const p=planPush(w,s,['N','S','W','E'][a-1]);
  if(p){
   assert.ok(p.valid);pushes++;maxChain=Math.max(maxChain,p.stones.length);
   if(contains(s.supports,s.hero)){
    platformPushes++;
    const built=supportDirections.get(num(s.hero));
    if(built&&Math.ceil(built/2)!==Math.ceil(a/2))crossAxisPlatformPushes++;
   }
   if(p.sinks)supportDirections.set(num(p.to),a);
  }
  s=stepWorld(w,s,a);assert.ok(!s.failed);if(contains(s.supports,s.hero))platformWalks++;
  const o=session.action(a);if(o.frames.length>1)animationCount++;
 }
 assert.ok(s.complete);
 let waterNecessity=null;
 if(rebuilt.has(i+1)){
  // Removing stones and opening doors gives an over-approximation of all dry walking.
  // Disconnected unoccupied buttons/goal cannot be reached without building support.
  const first=initialState(w),dry=reachable({...w,doors:[],buttons:[]},{...first,stones:[]});
  const unreachableButtons=w.buttons.filter(b=>!dry.has(num(b))&&!contains(first.stones,b));
  if(!dry.has(num(w.goal))||unreachableButtons.length){
   waterNecessity={proven:true,method:'dry-terrain-components',unreachableButtons:unreachableButtons.length,goalDisconnected:!dry.has(num(w.goal))};
  }else{
   const search=solve(spec,{disableSinking:true,maxStates:10000,maxMs:10000});
   waterNecessity={proven:search.status==='unsolvable',method:'exhaustive-search-without-sinking',status:search.status,states:search.states};
  }
  assert.ok(waterNecessity.proven,`Water requirement not established for ${spec.id}`);
  assert.ok(s.supports.length>=2 && platformWalks>0,`Missing platform route in ${spec.id}`);
 }
 report.levels.push({level:i+1,title:spec.title,actions:witnesses[i].actions.length,pushes,maxChain,dimensions:[spec.rows[0].length,spec.rows.length],initialWalkingCells:n,waterCells:w.terrain.filter(t=>t==='~').length,buttons:w.buttons.length,stones:w.stones.length,createdSupports:s.supports.length-w.supports.length,platformWalks,platformPushes,crossAxisPlatformPushes,waterNecessity,doorsOpenAtFinish:doorsOpen(w,s),solved:true});
}
assert.equal(session.observe().state,'WIN');report.animationCount=animationCount;report.totalActions=report.levels.reduce((n,l)=>n+l.actions,0);report.success=true;
await mkdir(new URL('../validation/',import.meta.url),{recursive:true});await writeFile(new URL('../validation/levels-report.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
