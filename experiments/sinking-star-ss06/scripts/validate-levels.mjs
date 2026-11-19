import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {DuoPuzzleSession,compileLevel,initialState,stepDetailed,renderWorld,circuitPressed} from '../dist/core.js';
import {SS06_LEVELS} from '../dist/levels.js';
import {LEVEL_INFO} from '../dist/level-info.js';
import {replay,decodeCommand,solve} from './solver.mjs';
const json=async p=>JSON.parse(await readFile(new URL(p,import.meta.url),'utf8'));
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const witnesses=await json('../tests/witnesses.json');
assert.equal(SS06_LEVELS.length,8);assert.equal(witnesses.length,8);assert.equal(LEVEL_INFO.length,8);
const session=new DuoPuzzleSession(SS06_LEVELS),report={game:'SS06',version:'0.2.0',levels:[],totals:{},success:false};
const continuous=new Set(['walk','push','reflect','piston','platform']);
for(const [index,spec] of SS06_LEVELS.entries()){
 const design=await json(`../reference/level${index+1}-design.json`),witness=witnesses[index];
 assert.deepEqual(spec,design.spec);assert.deepEqual(witness.actions,design.actions);assert.equal(witness.level,index+1);assert.equal(witness.id,spec.id);
 const r=replay(spec,witness.commands),world=r.world;let state=initialState(world),frames=0,maxFrames=0,combatWaves=0,mirrorsDestroyed=0,cratesCrushed=0,simultaneousHeroReflections=0;
 assert.deepEqual(r.actions,witness.actions);assert.ok(!state.dead&&!state.complete);assert.equal(session.observe().level,index+1);
 const digest=createHash('sha256');digest.update(JSON.stringify(session.observe()));
 for(const [turn,action] of witness.actions.entries()){
  assert.ok(!state.complete);const before=state,detail=stepDetailed(world,state,action.id,action.data);state=detail.state;
  assert.ok(!state.failed,`${spec.id}: refused action ${turn+1}`);assert.ok(!state.dead,`${spec.id}: fatal action ${turn+1}`);
  const o=session.action(action.id,action.data);digest.update(JSON.stringify(o));
  const expected=(detail.phases.length?detail.phases.reduce((n,p)=>n+(p.kind==='combat'?5:continuous.has(p.kind)?3:1),0):1)+(state.complete&&index<7?1:0);
  assert.equal(o.frames.length,expected);assert.equal(o.frameDurationsMs.length,expected);assert.equal(o.frameDurationsMs.at(-1),0);assert.deepEqual(o.frames.at(-1),o.frame);
  assert.deepEqual(o.availableActionIds,[1,2,3,4,5,6]);
  if(!state.complete||index===7)assert.deepEqual(o.frame,renderWorld(world,state));
  for(const f of o.frames){assert.equal(f.length,64);assert.ok(f.every(row=>row.length===64&&row.every(c=>Number.isInteger(c)&&c>=0&&c<16)));}
  for(const key of ['hero','heroes','active','stones','monsters','mirrors','gates','platforms','platformActive','circuits','plan','phases','solution','witness'])assert.ok(!(key in o));
  const actorCells=[...state.heroes.filter(h=>!h.dead).map(h=>h.at),...state.stones,...state.monsters,...state.mirrors.map(m=>m.at)].map(p=>p.y*20+p.x);
  assert.equal(new Set(actorCells).size,actorCells.length,`${spec.id} overlapping solid actors`);
  assert.equal(state.heroes.length,2);assert.deepEqual(state.heroes.map(h=>h.kind),['merchant','warrior']);
  if(action.id===6){assert.equal(detail.phases.length,0);assert.deepEqual(state.heroes,before.heroes);assert.deepEqual(state.stones,before.stones);assert.deepEqual(state.monsters,before.monsters);}
  combatWaves+=detail.phases.filter(p=>p.kind==='combat').length;mirrorsDestroyed+=before.mirrors.length-state.mirrors.length;
  cratesCrushed+=detail.phases.filter(p=>p.kind==='crush').reduce((n,p)=>n+p.before.stones.length-p.after.stones.length,0);
  simultaneousHeroReflections+=detail.phases.filter(p=>p.kind==='reflect'&&p.moves.filter(m=>m.actor==='hero').length===2).length;
  frames+=o.frames.length;maxFrames=Math.max(maxFrames,o.frames.length);
 }
 assert.ok(state.complete&&r.state.complete);assert.equal(r.metrics.blocked,0);assert.equal(r.metrics.deaths,0);
 report.levels.push({level:index+1,id:spec.id,title:spec.title,source:LEVEL_INFO[index],dimensions:[spec.rows[0].length,spec.rows.length],floorCells:world.terrain.filter(c=>c==='.').length,waterCells:world.terrain.filter(c=>c==='~').length,initialStones:world.stones.length,initialSupports:world.supports.length,initialMonsters:world.monsters.length,mirrors:world.mirrors.length,gates:world.gates.length,hydraulicPlatforms:world.platforms.length,buttons:world.buttons.length,...r.metrics,combatWaves,mirrorsDestroyed,cratesCrushed,simultaneousHeroReflections,frames,maxFrames,solved:true,mapSha256:hash(spec),witnessSha256:hash(witness.actions),observationsSha256:digest.digest('hex')});
}
assert.equal(session.observe().state,'WIN');assert.equal(session.observe().levelsCompleted,8);
assert.ok(report.levels[0].merchantPushes&&report.levels[0].chainPushes&&report.levels[0].platformsCreated&&report.levels[0].pistonPushes&&report.levels[0].heroReflections===2);
assert.equal(report.levels[1].simultaneousHeroReflections,1);assert.equal(report.levels[4].simultaneousHeroReflections,1);
assert.equal(report.levels[5].monstersRemoved,4);
for(const level of [1,8])assert.ok(!SS06_LEVELS[level-1].mirrors.some(m=>SS06_LEVELS[level-1].gates.some(g=>m.at.x===g.at.x&&m.at.y===g.at.y)),'No mirror starts on a press in L1/L8');
assert.ok(report.levels[6].platformsCreated>=2&&report.levels[6].chainPushes&&report.levels[6].pistonPushes);
assert.ok(report.levels[4].platformsCreated>=2&&report.levels[4].pistonPushes>=2&&report.levels[4].combatWaves);
assert.ok(report.levels[7].chainPushes>=1&&report.levels[7].pistonPushes===2);
const clock=replay(SS06_LEVELS[7],witnesses[7].commands);
const ticks=clock.trace.filter(t=>t.action.id===5);
assert.deepEqual(ticks.map(t=>circuitPressed(clock.world,t.after,'ancrage')),[true,true,true,true,true]);
assert.deepEqual(ticks.map(t=>circuitPressed(clock.world,t.after,'alternance')),[false,true,false,true,false]);
assert.equal(clock.world.platforms.length,15);
assert.equal(initialState(clock.world).platformActive[0],true);
assert.ok(ticks.every(t=>t.after.platformActive[0]===false&&t.after.platformActive.slice(1,11).every(Boolean)));
report.clockChecks={level:8,ticks:5,greenLatchStable:true,firstVioletTickDelayed:true,platforms:15,inverseEntryRetracted:true};
report.failureRoutes=[];
for(const f of await json('../tests/failures.json')){
 const r=replay(SS06_LEVELS[f.level-1],f.actions);assert.ok(r.state.dead);assert.equal(r.metrics.blocked,0);
 const s=new DuoPuzzleSession(SS06_LEVELS);s.selectLevel(f.level);let before;
 for(const a of f.actions){before=s.observe();s.action(a.id,a.data);}
 assert.equal(s.observe().state,'GAME_OVER');assert.deepEqual(s.undo().frame,before.frame);
 report.failureRoutes.push({level:f.level,cause:f.cause,actions:f.actions.length,commands:f.commands,passed:true});
}
for(const key of ['actions','selections','merchantPushes','warriorPushes','chainPushes','stoneMoves','mirrorMoves','reflections','heroReflections','pistonPushes','platformsCreated','monstersRemoved','combatWaves','mirrorsDestroyed','cratesCrushed','simultaneousHeroReflections','frames'])report.totals[key]=report.levels.reduce((n,l)=>n+l[key],0);
if(process.argv.includes('--mechanisms')){
 report.mechanismChecks=[];
 for(const [level,option] of [[1,'disableWarriorChains'],[1,'disablePistons'],[1,'disablePlatforms'],[1,'disableReflections'],[2,'disableMirrorMotion'],[2,'disableSelection'],[7,'disablePlatforms'],[7,'disableWarriorChains']]){
  const r=solve(SS06_LEVELS[level-1],{[option]:true,maxStates:100000,maxMs:10000});assert.equal(r.status,'unsolvable');report.mechanismChecks.push({level,option,...r});
 }
 for(const [y,row] of SS06_LEVELS[0].rows.entries())for(const [x,c] of [...row].entries())if(c==='o'){
  const rows=SS06_LEVELS[0].rows.map(r=>[...r]);rows[y][x]='.';
  const r=solve({...SS06_LEVELS[0],rows:rows.map(r=>r.join(''))},{maxStates:100000,maxMs:10000});
  assert.equal(r.status,'unsolvable',`L1 needs crate ${x},${y}`);report.mechanismChecks.push({level:1,option:'removeCrate',at:{x,y},...r});
 }
}else{try{report.mechanismChecks=await json('../reference/mechanism-checks.json');}catch{report.mechanismChecks=[];}}
const html=await readFile(new URL('../dist/SS06-demo.html',import.meta.url),'utf8');
assert.ok(!html.includes('tests/witnesses')&&!html.includes('function solve('));
report.htmlSha256=createHash('sha256').update(html).digest('hex');
report.limitations=['Adaptations are explicit, not certified cell-for-cell copies of the original game.','Witnesses prove solvability, not optimality or autonomous SRA success.','Limited searches are inconclusive and are not impossibility claims.','The engine has two-dimensional supports, no vertical stacking, no clones, no dragon fire and no mirror-to-mirror ray relay.','UI validation uses actual HTML, Happy DOM and a canvas buffer; native Chromium could not start in this executor.'];
report.success=true;
await mkdir(new URL('../validation/',import.meta.url),{recursive:true});
await writeFile(new URL('../validation/levels-report.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({success:report.success,totals:report.totals,levels:report.levels.map(l=>({level:l.level,title:l.title,actions:l.actions,frames:l.frames,reflections:l.reflections,presses:l.pistonPushes}))},null,2));
