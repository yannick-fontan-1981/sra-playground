import {readFile,writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {compileLevel,initialState,stepWorld,planPush,doorsOpen,PushPuzzleSession} from '../dist/core.js';
import {SS02_LEVELS} from '../dist/levels.js';
import {reachable} from './solver.mjs';
const witnesses=JSON.parse(await readFile(new URL('../tests/witnesses.json',import.meta.url),'utf8'));
const report={game:'SS02',levels:[],success:false};
const session=new PushPuzzleSession(SS02_LEVELS);let animationCount=0;
for(const [i,spec] of SS02_LEVELS.entries()){
 const w=compileLevel(spec);let s=initialState(w),pushes=0,maxChain=0;
 const n=reachable(w,s).size;
 for(const a of witnesses[i].actions){
  const p=planPush(w,s,['N','S','W','E'][a-1]);
  if(p){assert.ok(p.valid);pushes++;maxChain=Math.max(maxChain,p.stones.length);}
  s=stepWorld(w,s,a);assert.ok(!s.failed);const o=session.action(a);if(o.frames.length>1)animationCount++;
 }
 assert.ok(s.complete);
 report.levels.push({level:i+1,title:spec.title,actions:witnesses[i].actions.length,pushes,maxChain,initialWalkingCells:n,buttons:w.buttons.length,stones:w.stones.length,createdSupports:s.supports.length-w.supports.length,doorsOpenAtFinish:doorsOpen(w,s),solved:true});
}
assert.equal(session.observe().state,'WIN');report.animationCount=animationCount;report.totalActions=report.levels.reduce((n,l)=>n+l.actions,0);report.success=true;
await mkdir(new URL('../validation/',import.meta.url),{recursive:true});await writeFile(new URL('../validation/levels-report.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
