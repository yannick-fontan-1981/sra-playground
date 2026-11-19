import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {DuoPuzzleSession,initialState,stepDetailed,renderWorld} from '../dist/core.js';
import {SS07_LEVELS} from '../dist/levels.js';
import {LEVEL_INFO} from '../dist/level-info.js';
import {replay,solve} from './solver.mjs';
const json=async p=>JSON.parse(await readFile(new URL(p,import.meta.url),'utf8'));
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const witnesses=await json('../tests/witnesses.json');
assert.equal(SS07_LEVELS.length,8);assert.equal(witnesses.length,8);assert.equal(LEVEL_INFO.length,8);
const session=new DuoPuzzleSession(SS07_LEVELS),report={game:'SS07',version:'0.1.0',levels:[],totals:{},success:false};
const continuous=new Set(['walk','push','pull','reflect','piston','platform']);
for(const [index,spec] of SS07_LEVELS.entries()){
 const design=await json(`../reference/level${index+1}-design.json`),witness=witnesses[index];
 assert.deepEqual(spec,design.spec);assert.deepEqual(witness.actions,design.actions);assert.equal(witness.commands,design.commands);assert.equal(witness.level,index+1);assert.equal(witness.id,spec.id);
 const r=replay(spec,witness.commands),world=r.world;let state=initialState(world),frames=0,maxFrames=0,combatWaves=0,mirrorsDestroyed=0,cratesCrushed=0,simultaneousHeroReflections=0;
 assert.deepEqual(r.actions,witness.actions);assert.ok(!state.dead&&!state.complete);assert.equal(session.observe().level,index+1);
 const digest=createHash('sha256');digest.update(JSON.stringify(session.observe()));
 for(const [turn,action] of witness.actions.entries()){
  assert.ok(!state.complete);const before=state,detail=stepDetailed(world,state,action.id,action.data);state=detail.state;
  assert.ok(!state.failed,`${spec.id}: refused action ${turn+1}`);assert.ok(!state.dead,`${spec.id}: fatal action ${turn+1}`);
  const o=session.action(action.id,action.data);digest.update(JSON.stringify(o));
  const expected=(detail.phases.length?detail.phases.reduce((n,p)=>n+(p.kind==='combat'?5:continuous.has(p.kind)?3:1),0):1)+(state.complete&&index<7?1:0);
  assert.equal(o.frames.length,expected);assert.equal(o.frameDurationsMs.length,expected);assert.equal(o.frameDurationsMs.at(-1),0);assert.deepEqual(o.frames.at(-1),o.frame);
  assert.deepEqual(o.availableActionIds,[1,2,3,4,5,6]);assert.equal(o.gameCode,'SS07');
  if(!state.complete||index===7)assert.deepEqual(o.frame,renderWorld(world,state));
  for(const f of o.frames){assert.equal(f.length,64);assert.ok(f.every(row=>row.length===64&&row.every(c=>Number.isInteger(c)&&c>=0&&c<16)));}
  for(const key of ['hero','heroes','active','stones','monsters','mirrors','gates','platforms','platformActive','circuits','plan','phases','solution','witness'])assert.ok(!(key in o));
  const actorCells=[...state.heroes.filter(h=>!h.dead).map(h=>h.at),...state.stones,...state.monsters,...state.mirrors.map(m=>m.at)].map(p=>p.y*20+p.x);
  assert.equal(new Set(actorCells).size,actorCells.length,`${spec.id}: overlapping solid actors`);
  assert.equal(state.heroes.length,2);assert.deepEqual(state.heroes.map(h=>h.kind),['merchant','thief']);assert.equal(world.goals.length,2);
  if(action.id===6){assert.equal(detail.phases.length,0);assert.deepEqual(state.heroes,before.heroes);assert.deepEqual(state.stones,before.stones);assert.deepEqual(state.monsters,before.monsters);}
  for(const p of detail.phases)if(p.kind==='push'||p.kind==='pull'){assert.equal(p.moves.length,2);assert.equal(before.heroes[before.active].kind,p.kind==='pull'?'thief':'merchant');}
  combatWaves+=detail.phases.filter(p=>p.kind==='combat').length;mirrorsDestroyed+=before.mirrors.length-state.mirrors.length;
  cratesCrushed+=detail.phases.filter(p=>p.kind==='crush').reduce((n,p)=>n+p.before.stones.length-p.after.stones.length,0);
  simultaneousHeroReflections+=detail.phases.filter(p=>p.kind==='reflect'&&p.moves.filter(m=>m.actor==='hero').length===2).length;
  frames+=o.frames.length;maxFrames=Math.max(maxFrames,o.frames.length);
 }
 assert.ok(state.complete&&r.state.complete);assert.equal(r.metrics.blocked,0);assert.equal(r.metrics.deaths,0);
 assert.ok(r.metrics.merchantPushes>0&&r.metrics.thiefPulls>0,`${spec.id}: both roles must perform their distinctive action in the witness`);
 report.levels.push({level:index+1,id:spec.id,title:spec.title,source:LEVEL_INFO[index],dimensions:[spec.rows[0].length,spec.rows.length],floorCells:world.terrain.filter(c=>c==='.').length,waterCells:world.terrain.filter(c=>c==='~').length,initialStones:world.stones.length,initialSupports:world.supports.length,initialMonsters:world.monsters.length,mirrors:world.mirrors.length,gates:world.gates.length,hydraulicPlatforms:world.platforms.length,buttons:world.buttons.length,...r.metrics,combatWaves,mirrorsDestroyed,cratesCrushed,simultaneousHeroReflections,frames,maxFrames,solved:true,mapSha256:hash(spec),witnessSha256:hash(witness.actions),observationsSha256:digest.digest('hex')});
}
assert.equal(session.observe().state,'WIN');assert.equal(session.observe().levelsCompleted,8);
assert.ok(report.levels[0].merchantPushes&&report.levels[0].thiefPulls&&report.levels[0].mirrorMoves&&report.levels[0].pistonPushes&&report.levels[0].platformsCreated>=2&&report.levels[0].heroReflections===2);
assert.ok(report.levels[3].platformsCreated>=4);
assert.equal(report.levels[5].monstersRemoved,0);assert.equal(report.levels[5].initialMonsters,1);
assert.equal(report.levels[6].monstersRemoved,2);assert.equal(report.levels[6].combatWaves,1);
assert.equal(report.levels[7].hydraulicPlatforms,3);assert.equal(report.levels[7].platformsCreated,3);assert.equal(report.levels[7].initialSupports,2);
const finale=replay(SS07_LEVELS[7],witnesses[7].commands);
const conversion=finale.trace.find(t=>t.after.supports.length-t.before.supports.length===3);
assert.ok(conversion);assert.ok(conversion.before.platformActive.every(Boolean));assert.ok(conversion.after.platformActive.every(v=>!v));assert.equal(conversion.after.stones.length,0);
report.finaleChecks={level:8,temporaryPlatforms:3,simultaneousPermanentSupports:3,initialSupports:2,thiefReleasesButton:conversion.before.heroes[conversion.before.active].kind==='thief',provedSolvable:true};
report.failureRoutes=[];
for(const f of await json('../tests/failures.json')){
 const r=replay(SS07_LEVELS[f.level-1],f.actions);assert.ok(r.state.dead);assert.equal(r.metrics.blocked,0);assert.deepEqual(replay(SS07_LEVELS[f.level-1],f.commands).actions,f.actions);
 const s=new DuoPuzzleSession(SS07_LEVELS);s.selectLevel(f.level);let before;
 for(const a of f.actions){before=s.observe();s.action(a.id,a.data);}
 assert.equal(s.observe().state,'GAME_OVER');assert.deepEqual(s.undo().frame,before.frame);
 report.failureRoutes.push({level:f.level,cause:f.cause,actions:f.actions.length,commands:f.commands,passed:true});
}
const keys=['actions','selections','merchantPushes','thiefPulls','heroPulls','chainPushes','stoneMoves','mirrorMoves','reflections','heroReflections','pistonPushes','platformsCreated','monstersRemoved','combatWaves','mirrorsDestroyed','cratesCrushed','simultaneousHeroReflections','frames'];
for(const key of keys)report.totals[key]=report.levels.reduce((n,l)=>n+l[key],0);
report.tutorialNecessity=await json('../reference/level1-necessity.json');report.tutorialNecessity.mapSha256=hash(SS07_LEVELS[0]);
if(process.argv.includes('--mechanisms')){
 report.recheckedMechanisms=[];
 for(const option of ['disableMerchantPushes','disableThiefPulls','disablePistons','disablePlatforms']){
  const r=solve(SS07_LEVELS[0],{[option]:true,maxStates:100000,maxMs:10000});assert.equal(r.status,'unsolvable');report.recheckedMechanisms.push({level:1,option,...r});
 }
}
const html=await readFile(new URL('../dist/SS07-demo.html',import.meta.url),'utf8');
assert.ok(!html.includes('tests/witnesses')&&!html.includes('function solve('));for(const w of witnesses)assert.ok(!html.includes(w.commands));
report.htmlSha256=createHash('sha256').update(html).digest('hex');
report.limitations=['Source adaptations are declared, not certified exact reconstructions.','Witnesses prove solvability, not optimality, uniqueness or autonomous SRA success.','Limited searches are inconclusive and are not impossibility proofs.','The engine is two-dimensional: no vertical stacking, clones, dragons or mirror-to-mirror relay.','HTML tests run in Happy DOM with canvas pixels and controlled timers; no native browser session is claimed.'];
report.success=true;await mkdir(new URL('../validation/',import.meta.url),{recursive:true});await writeFile(new URL('../validation/levels-report.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({success:report.success,totals:report.totals,levels:report.levels.map(l=>({level:l.level,title:l.title,actions:l.actions,frames:l.frames,pushes:l.merchantPushes,pulls:l.thiefPulls,reflections:l.reflections,presses:l.pistonPushes}))},null,2));
