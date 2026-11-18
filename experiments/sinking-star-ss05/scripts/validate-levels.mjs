import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {BardPuzzleSession,compileLevel,initialState,stepDetailed,renderWorld} from '../dist/core.js';
import {SS05_LEVELS} from '../dist/levels.js';
import {LEVEL_INFO} from '../dist/level-info.js';
import {replay,solve,stringActions} from './solver.mjs';
const json=async p=>JSON.parse(await readFile(new URL(p,import.meta.url),'utf8'));
const witnesses=await json('../tests/witnesses.json'),sources=await json('../reference/source-grids.json');
for(const level of [1,5,6,7,8]){
 const design=await json(`../reference/level${level}-design.json`);
 assert.deepEqual(SS05_LEVELS[level-1],design.spec,`Level ${level} matches its reviewed design`);
 assert.deepEqual(witnesses[level-1].actions,design.actions);
}
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const conversion={'_':'~','*':'o','G':'g','{':'b','[':'D','O':'m','Y':'@'};
for(const [index,id] of [[1,'heroes3_3_v2'],[2,'heroes3_1_v3'],[3,'heroes3_2_v4']]){
 const source=sources.find(s=>s.sourceId===id);
 assert.deepEqual(SS05_LEVELS[index].rows,source.rows.map(row=>[...row].map(c=>conversion[c]??c).join('')),'Reference topology and actors remain intact');
 assert.deepEqual(witnesses[index].actions,stringActions(source.originalWitness),'Original directional witness remains executable');
}
assert.equal(SS05_LEVELS.length,8);assert.equal(witnesses.length,8);assert.equal(LEVEL_INFO.length,8);
const session=new BardPuzzleSession(SS05_LEVELS);
const report={game:'SS05',version:'0.1.0',levels:[],totals:{},success:false};
for(const [index,spec] of SS05_LEVELS.entries()){
 const witness=witnesses[index];assert.equal(witness.level,index+1);assert.equal(witness.id,spec.id);
 const replayed=replay(spec,witness.actions),world=replayed.world;
 assert.equal(session.observe().level,index+1);
 const digest=createHash('sha256');digest.update(JSON.stringify(session.observe()));
 let state=initialState(world),frames=0,maxFrames=0;
 assert.ok(!state.dead&&!state.complete,'Every room starts playable');
 for(const [turn,action] of witness.actions.entries()){
  assert.ok(!state.complete,`${spec.id}: no moves after completion`);
  const detail=stepDetailed(world,state,action);state=detail.state;
  assert.ok(!state.failed,`${spec.id}: action ${turn+1} was refused`);
  assert.ok(!state.dead,`${spec.id}: action ${turn+1} was lethal`);
  const observation=session.action(action);digest.update(JSON.stringify(observation));
  assert.deepEqual(observation.availableActionIds,[1,2,3,4,5]);
  assert.deepEqual(observation.frames.at(-1),observation.frame);
  const expected=detail.phases.reduce((n,p)=>n+(['walk','song','reflect','piston'].includes(p.kind)?3:1),0)+(state.complete&&index<7?1:0);
  assert.equal(observation.frames.length,expected);assert.equal(observation.frameDurationsMs.length,expected);
  assert.equal(observation.frameDurationsMs.at(-1),0);
  if(!state.complete||index===7)assert.deepEqual(observation.frame,renderWorld(world,state));
  for(const frame of observation.frames){assert.equal(frame.length,64);assert.ok(frame.every(row=>row.length===64&&row.every(c=>Number.isInteger(c)&&c>=0&&c<16)));}
  for(const forbidden of ['hero','stones','monsters','mirrors','gates','circuits','plan','ray','phases','solution','witness'])assert.ok(!(forbidden in observation));
  frames+=expected;maxFrames=Math.max(maxFrames,expected);
 }
 assert.ok(state.complete&&replayed.state.complete,`${spec.id}: witness reaches destination`);
 assert.equal(replayed.metrics.blocked,0);assert.equal(replayed.metrics.deaths,0);
 const noSong=solve(spec,{disableSong:true,maxStates:30000,maxMs:3000});
 assert.equal(noSong.status,'unsolvable',`${spec.id}: song is necessary; a limit is not proof`);
 report.levels.push({level:index+1,id:spec.id,title:spec.title,source:LEVEL_INFO[index],dimensions:[spec.rows[0].length,spec.rows.length],floorCells:world.terrain.filter(t=>t==='.').length,waterCells:world.terrain.filter(t=>t==='~').length,initialStones:world.stones.length,initialMonsters:world.monsters.length,initialPlatforms:world.supports.length,mirrors:world.mirrors.length,buttons:world.buttons.length,gates:world.gates.length,...replayed.metrics,frames,maxFrames,solved:true,songRequired:{verified:true,states:noSong.states},mapSha256:hash(spec),witnessSha256:hash(witness.actions),observationsSha256:digest.digest('hex')});
}
assert.equal(session.observe().state,'WIN');assert.equal(session.observe().levelsCompleted,8);
assert.ok(report.levels[0].reflections&&report.levels[0].platformsCreated&&report.levels[0].pistonPushes,'Tutorial exercises reflection, water and a lateral press');
for(const [index,options] of [[4,['disableReflections']],[5,['disableReflections']],[6,['disablePlatformMotion','disablePlatforms','disablePistons']],[7,['disableReflections','disablePlatforms','disablePistons','disableMonsterSong']]]){
 const checks={};
 for(const option of options){const r=solve(SS05_LEVELS[index],{[option]:true,maxStates:30000,maxMs:3000});assert.equal(r.status,'unsolvable',`${index+1}/${option}: exhaustive necessity required`);checks[option]={status:r.status,states:r.states};}
 report.levels[index].mechanismChecks=checks;
}
assert.ok(report.levels[6].platformMoves>=20&&report.levels[6].pistonPushes>=3);
assert.ok(report.levels[7].monsterMoves>0&&report.levels[7].reflections>=2&&report.levels[7].pistonPushes>=2&&report.levels[7].maxFrames>=9);
for(const key of ['actions','songTurns','stoneMoves','monsterMoves','platformMoves','reflections','pistonPushes','platformsCreated','monstersRemoved','frames'])report.totals[key]=report.levels.reduce((n,l)=>n+l[key],0);
const html=await readFile(new URL('../dist/SS05-demo.html',import.meta.url),'utf8');
assert.ok(!html.includes('tests/witnesses')&&!html.includes('function solve('),'Author paths and solver are excluded from the HTML');
report.htmlSha256=createHash('sha256').update(html).digest('hex');
report.limitations=['These are validated author witnesses, not autonomous SRA agent runs.','The tutorial demonstrates its press, but alternative solutions can avoid it.','The final room has alternative solutions: platform sliding and both mirrors are not individually mandatory.','The standalone interface is checked with Happy DOM and exact canvas buffers; this is not a native-browser test.'];
report.success=true;
await mkdir(new URL('../validation/',import.meta.url),{recursive:true});
await writeFile(new URL('../validation/levels-report.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({success:report.success,totals:report.totals,levels:report.levels.map(l=>({level:l.level,actions:l.actions,song:l.songTurns,reflections:l.reflections,presses:l.pistonPushes,platformMotion:l.platformMoves,platforms:l.platformsCreated}))},null,2));
