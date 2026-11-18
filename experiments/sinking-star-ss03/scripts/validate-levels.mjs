import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {compileLevel,initialState,stepWorld,planPull,doorsOpen,equal,contains,PullPuzzleSession} from '../dist/core.js';
import {SS03_LEVELS} from '../dist/levels.js';
import {LEVEL_INFO} from '../dist/level-info.js';
import {reachable,solve} from './solver.mjs';
const witnesses=JSON.parse(await readFile(new URL('../tests/witnesses.json',import.meta.url),'utf8'));
const references=JSON.parse(await readFile(new URL('../reference/hauling-grids.json',import.meta.url),'utf8'));
const directions=['N','S','W','E'];
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const session=new PullPuzzleSession(SS03_LEVELS);
const report={game:'SS03',version:'0.1.0',levels:[],totalActions:0,totalPulls:0,success:false};
assert.equal(SS03_LEVELS.length,8);
assert.equal(witnesses.length,8);
assert.equal(LEVEL_INFO.length,8);
const conversion={'*':'o','{':'b','[':'D','G':'g'};
assert.equal(references.levels.filter(l=>l.kind==='transcription').length,4);
for(const reference of references.levels){
 const spec=SS03_LEVELS[reference.level-1];
 assert.equal(spec.id,reference.id);
 assert.deepEqual(spec.rows,reference.rows);
 if(reference.kind==='transcription')assert.deepEqual(spec.rows,reference.sourceRows.map(r=>[...r].map(c=>conversion[c]??c).join('')));
}
for(const [i,spec]of SS03_LEVELS.entries()){
 const w=compileLevel(spec),first=initialState(w);let s=first,pulls=0,releaseMoves=0,previousPull=0;
 const pullDirections=new Set(),stoneIds=new Map(first.stones.map((p,j)=>[p.y*20+p.x,j]));
 const stoneAxes=first.stones.map(()=>new Set());
 assert.equal(witnesses[i].id,spec.id);
 assert.equal(witnesses[i].level,i+1);
 assert.equal(session.observe().level,i+1);
 for(const [step,action]of witnesses[i].actions.entries()){
  assert.equal(s.complete,false,`${spec.id} witness has moves after completion`);
  const plan=planPull(w,s,directions[action-1]),after=stepWorld(w,s,action);
  assert.equal(after.failed,false,`${spec.id} blocked action ${step+1}`);
  assert.ok(!equal(after.hero,s.hero),`${spec.id} inert witness action ${step+1}`);
  assert.equal(after.stones.length,first.stones.length);
  assert.deepEqual(after.supports,first.supports);
  if(plan?.valid){
   pulls++;pullDirections.add(directions[action-1]);previousPull=action;
   const id=stoneIds.get(plan.from.y*20+plan.from.x);assert.notEqual(id,undefined);
   stoneIds.delete(plan.from.y*20+plan.from.x);stoneIds.set(plan.to.y*20+plan.to.x,id);
   stoneAxes[id].add(action<=2?'vertical':'horizontal');
  }else{
   if(previousPull&&Math.ceil(previousPull/2)!==Math.ceil(action/2))releaseMoves++;
   previousPull=0;
  }
  const observation=session.action(action);
  assert.deepEqual(observation.frames.at(-1),observation.frame);
  assert.deepEqual(observation.availableActionIds,[1,2,3,4]);
  const frameCount=(plan?.valid?3:1)+(after.complete&&i<7?1:0);
  assert.equal(observation.frames.length,frameCount);
  for(const frame of observation.frames){
   assert.equal(frame.length,64);
   assert.ok(frame.every(row=>row.length===64&&row.every(c=>Number.isInteger(c)&&c>=0&&c<16)));
   assert.ok(!frame.flat().includes(1),'No grey destination preview');
  }
  s=after;
 }
 assert.ok(s.complete,`${spec.id} must have a complete witness`);
 const withoutPull=solve(spec,{disablePull:true,maxStates:10000,maxMs:2000});
 assert.equal(withoutPull.status,'unsolvable',`${spec.id} must require pulling`);
 if(w.doors.length)assert.ok(doorsOpen(w,s));
 const initialWalkingCells=reachable(w,first).size;
 report.levels.push({level:i+1,id:spec.id,title:spec.title,guidePuzzle:LEVEL_INFO[i].puzzle,
  dimensions:[spec.rows[0].length,spec.rows.length],stones:first.stones.length,buttons:w.buttons.length,
  initialWalkingCells,actions:witnesses[i].actions.length,pulls,pullDirections:[...pullDirections].sort(),
  releaseMoves,stonesUsingBothAxes:stoneAxes.filter(s=>s.size>1).length,
  allButtonsOccupiedByStones:w.buttons.every(p=>contains(s.stones,p)),
  pullsRequired:true,solved:true,mapSha256:hash(spec.rows),witnessSha256:hash(witnesses[i].actions)});
}
assert.equal(session.observe().state,'WIN');
assert.equal(session.observe().levelsCompleted,8);
const tutorial=report.levels[0];
assert.equal(tutorial.stones,3);assert.equal(tutorial.buttons,3);
assert.equal(tutorial.pullDirections.length,4);
assert.ok(tutorial.releaseMoves>=3&&tutorial.stonesUsingBothAxes>=1&&tutorial.initialWalkingCells>=25);
assert.ok(tutorial.allButtonsOccupiedByStones);
report.totalActions=report.levels.reduce((n,l)=>n+l.actions,0);
report.totalPulls=report.levels.reduce((n,l)=>n+l.pulls,0);
report.success=true;
await mkdir(new URL('../validation/',import.meta.url),{recursive:true});
await writeFile(new URL('../validation/levels-report.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
