import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {WizardPuzzleSession,compileLevel,initialState,stepDetailed,renderWorld} from '../dist/core.js';
import {SS04_LEVELS} from '../dist/levels.js';
import {LEVEL_INFO} from '../dist/level-info.js';
import {replay,solve} from './solver.mjs';
const json=async p=>JSON.parse(await readFile(new URL(p,import.meta.url),'utf8'));
const witnesses=await json('../tests/witnesses.json');
const sources=await json('../reference/source-grids.json');
for(const level of [1,6,7,8]){
 const design=await json(`../reference/level${level}-design.json`);
 assert.deepEqual(SS04_LEVELS[level-1],design.spec,`Level ${level} must match its reviewed design record`);
}
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const conversion={'_':'~','*':'o','G':'g','{':'b','}':'b','[':'D',']':'D','O':'m'};
const referenceIds=['heroes1_8_v2','heroes1_10_inv_v4_b','heroes2_3_v2','a_wiz_out_of_water'];
for(let i=1;i<=4;i++){
 const source=sources.find(s=>s.id===referenceIds[i-1]);
 assert.deepEqual(SS04_LEVELS[i].rows,source.rows.map(row=>[...row].map(c=>conversion[c]??c).join('')),'Reference topology and actors must be preserved');
 assert.deepEqual(witnesses[i].actions,[...source.solution].map(c=>({U:1,D:2,L:3,R:4})[c]),'Original directional witness must remain executable');
}
assert.equal(SS04_LEVELS.length,8);assert.equal(witnesses.length,8);assert.equal(LEVEL_INFO.length,8);
const session=new WizardPuzzleSession(SS04_LEVELS);
const report={game:'SS04',version:'0.1.0',levels:[],totalActions:0,totalSwaps:0,totalReflectedSwaps:0,totalMonsterSwaps:0,totalPistonStrokes:0,totalPlatformsCreated:0,success:false};
for(const [index,spec] of SS04_LEVELS.entries()){
 const witness=witnesses[index];assert.equal(witness.level,index+1);assert.equal(witness.id,spec.id);
 const replayed=replay(spec,witness.actions),world=replayed.world;
 assert.equal(session.observe().level,index+1);
 const digest=createHash('sha256');digest.update(JSON.stringify(session.observe()));
 let state=initialState(world);
 assert.ok(!state.dead&&!state.complete,'Every room starts playable');
 for(const [turn,action] of witness.actions.entries()){
  assert.ok(!state.complete,`${spec.id}: no moves after completion`);
  const detail=stepDetailed(world,state,action);state=detail.state;
  assert.ok(!state.failed,`${spec.id}: action ${turn+1} was refused`);
  assert.ok(!state.dead,`${spec.id}: action ${turn+1} was lethal`);
  const observation=session.action(action);digest.update(JSON.stringify(observation));
  assert.deepEqual(observation.availableActionIds,[1,2,3,4]);
  assert.deepEqual(observation.frames.at(-1),observation.frame);
  const expected=detail.phases.reduce((n,p)=>n+(['swap','piston'].includes(p.kind)?3:1),0)+(state.complete&&index<7?1:0);
  assert.equal(observation.frames.length,expected);assert.equal(observation.frameDurationsMs.length,expected);
  assert.equal(observation.frameDurationsMs.at(-1),0);
  if(!state.complete||index===7)assert.deepEqual(observation.frame,renderWorld(world,state));
  for(const frame of observation.frames){assert.equal(frame.length,64);assert.ok(frame.every(row=>row.length===64&&row.every(c=>Number.isInteger(c)&&c>=0&&c<16)));}
  for(const forbidden of ['hero','stones','monsters','mirrors','gates','circuits','plan','ray','phases','solution','witness'])assert.ok(!(forbidden in observation));
  assert.ok(!observation.frame.flat().includes(1),'The resting frame contains no destination preview');
 }
 assert.ok(state.complete&&replayed.state.complete,`${spec.id}: witness reaches destination`);
 assert.equal(replayed.metrics.blocked,0);assert.equal(replayed.metrics.deaths,0);
 const noSwaps=solve(spec,{disableSwap:true,maxStates:20000,maxMs:3000});
 assert.equal(noSwaps.status,'unsolvable',`${spec.id}: exchanges must be necessary; a limit is not proof`);
 report.levels.push({level:index+1,id:spec.id,title:spec.title,source:LEVEL_INFO[index],dimensions:[spec.rows[0].length,spec.rows.length],floorCells:world.terrain.filter(t=>t==='.').length,waterCells:world.terrain.filter(t=>t==='~').length,initialStones:world.stones.length,initialMonsters:world.monsters.length,mirrors:world.mirrors.length,buttons:world.buttons.length,presses:world.gates.length,...replayed.metrics,solved:true,exchangesRequired:{verified:true,states:noSwaps.states},mapSha256:hash(spec),witnessSha256:hash(witness.actions),observationsSha256:digest.digest('hex')});
}
assert.equal(session.observe().state,'WIN');assert.equal(session.observe().levelsCompleted,8);
// The loaded tutorial teaches a real reflected exchange and builds its only bridge with a press.
for(const [field,option] of [['mirror','disableReflections'],['press','disablePistons'],['platform','disablePlatforms']]){
 const ablation=solve(SS04_LEVELS[0],{[option]:true,maxStates:50000,maxMs:3000});assert.equal(ablation.status,'unsolvable');report.levels[0][field+'Required']={verified:true,states:ablation.states};
}
assert.ok(report.levels[0].reflectedSwaps>=1&&report.levels[0].platformsCreated>=1&&report.levels[0].pistonPushes>=1);
assert.ok(report.levels[3].monsterSwaps>=1,'The monster room requires actual monster exchanges in its witness');
assert.equal(report.levels[5].floorCells,55,'The mirror adaptation preserves the source island footprints');
assert.ok(report.levels[5].reflectedSwaps>=2);
for(const i of [6,7])assert.ok(report.levels[i].pistonPushes>0&&report.levels[i].platformsCreated>0&&report.levels[i].monsterSwaps>0&&report.levels[i].reflectedSwaps>0,'The final rooms combine all requested mechanics in their witness');
for(const [total,key] of [['totalActions','actions'],['totalSwaps','swaps'],['totalReflectedSwaps','reflectedSwaps'],['totalMonsterSwaps','monsterSwaps'],['totalPistonStrokes','pistonPushes'],['totalPlatformsCreated','platformsCreated']])report[total]=report.levels.reduce((sum,l)=>sum+l[key],0);
report.success=true;
await mkdir(new URL('../validation/',import.meta.url),{recursive:true});
await writeFile(new URL('../validation/levels-report.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,levels:report.levels.map(l=>({level:l.level,actions:l.actions,swaps:l.swaps,reflected:l.reflectedSwaps,monsters:l.monsterSwaps,presses:l.pistonPushes,platforms:l.platformsCreated}))},null,2));
