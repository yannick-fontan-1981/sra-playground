/** Replays authored SS08 witnesses and validates the shipped public contract.
 * Search-based necessity proofs are separate author tools, never a default gate. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {DuoPuzzleSession,PALETTE,compileLevel,initialState,stepDetailed,renderWorld,circuitPressed} from '../dist/core.js';
import {SS08_LEVELS} from '../dist/levels.js';
import {LEVEL_INFO} from '../dist/level-info.js';
import {replay} from './solver.mjs';

const json=async p=>JSON.parse(await readFile(new URL(p,import.meta.url),'utf8'));
const optionalJson=async p=>{try{return await json(p);}catch(error){if(error.code==='ENOENT')return null;throw error;}};
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const samePoint=(a,b)=>a.x===b.x&&a.y===b.y;
const publicKeys=new Set(['gameCode','frame','frames','frameDurationsMs','state','availableActionIds','canUndo','canSelectLevel','level','levelCount','levelsCompleted','defaultFps','palette']);
const animated=new Set(['walk','push','swap','reflect','piston','platform']);
const witnessKeys=['actions','selections','merchantPushes','wizardSwaps','bentSwaps','heroSwaps','chainPushes','stoneMoves','mirrorMoves','reflections','heroReflections','pistonPushes','platformsCreated','monstersRemoved','blocked','deaths'];
const witnesses=await json('../tests/witnesses.json');
const {version}=await json('../package.json');
assert.equal(SS08_LEVELS.length,8,'SS08 ships exactly eight levels');
assert.equal(witnesses.length,8,'Each level needs an author witness');
assert.equal(LEVEL_INFO.length,8,'Each level needs public source metadata');
const worlds=SS08_LEVELS.map(compileLevel),starts=worlds.map(initialState);
const session=new DuoPuzzleSession(SS08_LEVELS);
const report={game:'SS08',version,levels:[],totals:{},failureRoutes:[],necessityEvidence:[],success:false};

function checkFrame(frame,label){
 assert.equal(frame.length,64,label+': image height');
 assert.ok(frame.every(row=>row.length===64&&row.every(c=>Number.isInteger(c)&&c>=0&&c<16)),label+': 64 by 64 palette image');
}
function checkObservation(o,label){
 for(const key of Object.keys(o))assert.ok(publicKeys.has(key),label+': private observation field '+key);
 assert.equal(o.gameCode,'SS08');assert.equal(o.levelCount,8);assert.equal(o.defaultFps,10);
 assert.deepEqual(o.palette,PALETTE);assert.deepEqual(o.availableActionIds,[1,2,3,4,5,6]);
 assert.equal(o.canSelectLevel,true);assert.equal(typeof o.canUndo,'boolean');
 assert.ok(['NOT_FINISHED','GAME_OVER','WIN'].includes(o.state));
 assert.ok(Number.isInteger(o.level)&&o.level>=1&&o.level<=8);
 assert.ok(Number.isInteger(o.levelsCompleted)&&o.levelsCompleted>=0&&o.levelsCompleted<=8);
 assert.ok(Array.isArray(o.frames)&&o.frames.length>0);checkFrame(o.frame,label);
 for(const frame of o.frames)checkFrame(frame,label);
 assert.deepEqual(o.frames.at(-1),o.frame,label+': final displayed image');
 if(o.frameDurationsMs){
  assert.equal(o.frameDurationsMs.length,o.frames.length,label+': duration per frame');
  assert.equal(o.frameDurationsMs.at(-1),0,label+': final frame has no delay');
  assert.ok(o.frameDurationsMs.slice(0,-1).every(n=>Number.isFinite(n)&&n>0),label+': intermediate frames remain visible');
 }
}
function checkActors(world,state,label){
 assert.equal(state.heroes.length,2);assert.deepEqual(state.heroes.map(h=>h.kind),['merchant','wizard']);
 assert.equal(world.goals.length,2);
 const actors=[...state.heroes.filter(h=>!h.dead).map(h=>h.at),...state.stones,...state.monsters,...state.mirrors.map(m=>m.at)];
 assert.ok(actors.every(p=>Number.isInteger(p.x)&&Number.isInteger(p.y)&&p.x>=0&&p.x<20&&p.y>=0&&p.y<20));
 const keys=actors.map(p=>p.y*20+p.x);assert.equal(new Set(keys).size,keys.length,label+': solid actors cannot overlap');
 assert.equal(new Set(state.supports.map(p=>p.y*20+p.x)).size,state.supports.length,label+': permanent supports are unique');
}
function checkPhases(world,detail,label){
 for(const phase of detail.phases){
  checkActors(world,phase.before,label+' before '+phase.kind);checkActors(world,phase.after,label+' after '+phase.kind);
  if(phase.kind==='push'){
   assert.equal(phase.before.heroes[phase.before.active].kind,'merchant');
   assert.equal(phase.moves.length,2,label+': the Merchant pushes exactly one occupant');
   assert.ok(phase.moves.every(m=>Math.abs(m.from.x-m.to.x)+Math.abs(m.from.y-m.to.y)===1));
  }
  if(phase.kind==='swap'){
   assert.equal(phase.before.heroes[phase.before.active].kind,'wizard');
   assert.equal(phase.moves.length,2,label+': exchange is reciprocal');
   const [hero,target]=phase.moves;
   assert.equal(hero.actor,'hero');assert.ok(['hero','stone','monster'].includes(target.actor));
   assert.ok(samePoint(hero.from,target.to)&&samePoint(hero.to,target.from),label+': exchange conserves both places');
   assert.ok(phase.paths?.length===1&&phase.paths[0].length>=2,label+': exchange animates its targeting path');
  }
  assert.ok(animated.has(phase.kind)||['combat','crush','gate'].includes(phase.kind),label+': recognized animation phase');
 }
}
function checkSelection(before,after,detail,label){
 assert.equal(detail.phases.length,0,label+': selection has no world tick');
 assert.notEqual(after.active,before.active,label+': no redundant selection in a witness');
 assert.deepEqual({...after,active:before.active},before,label+': selection changes only the selected hero');
}
function checkStages(design,result,label){
 if(!design.stages)return 0;
 let last=-1;
 for(const stage of design.stages){
  assert.ok(Number.isInteger(stage.turn)&&stage.turn>=0&&stage.turn<=result.trace.length&&stage.turn>=last,label+': valid stage turn');
  last=stage.turn;const state=stage.turn?result.trace[stage.turn-1].after:initialState(result.world);
  const projection={
   heroes:state.heroes.map(h=>({kind:h.kind,at:h.at})),stones:state.stones,supports:state.supports,
   mirrors:state.mirrors,monsters:state.monsters,
   circuits:Object.fromEntries(result.world.circuits.map(c=>[c.id,circuitPressed(result.world,state,c.id)]))
  };
  for(const key of Object.keys(projection))if(key in stage)assert.deepEqual(stage[key],projection[key],label+': recorded stage '+stage.turn+' '+key);
 }
 return design.stages.length;
}
checkObservation(session.observe(),'initial campaign');

for(const [index,spec] of SS08_LEVELS.entries()){
 const level=index+1,label=spec.id,design=await json('../reference/level'+level+'-design.json'),witness=witnesses[index];
 assert.deepEqual(spec,design.spec,label+': reference grid and shipped grid');
 assert.deepEqual(LEVEL_INFO[index],{...design.source,platform:!!design.source.platform},label+': reference and public source metadata');
 assert.deepEqual(witness.actions,design.actions,label+': reference and witness actions');
 assert.equal(witness.commands,design.commands);assert.equal(witness.level,level);assert.equal(witness.id,spec.id);
 assert.ok(typeof witness.commands==='string'&&witness.commands.length>0);
 const result=replay(spec,witness.commands),world=worlds[index];
 assert.deepEqual(result.actions,witness.actions,label+': commands decode to the saved pixel actions');
 if(design.metrics)assert.deepEqual(result.metrics,design.metrics,label+': recorded author metrics');
 let state=initialState(world),frames=0,maxFrames=0,combatWaves=0,mirrorsDestroyed=0,cratesCrushed=0,simultaneousHeroReflections=0,hydraulicChanges=0;
 assert.ok(!state.dead&&!state.complete);checkActors(world,state,label);
 assert.equal(session.observe().level,level);assert.equal(session.observe().levelsCompleted,index);
 assert.deepEqual(session.observe().frame,renderWorld(world,state));
 const digest=createHash('sha256');digest.update(JSON.stringify(session.observe()));
 let beforeLast,finalObservation;
 for(const [turn,action] of witness.actions.entries()){
  const at=label+' action '+(turn+1);
  assert.ok(!state.complete&&!state.dead,at+': no action after a terminal state');
  assert.ok(Number.isInteger(action.id)&&action.id>=1&&action.id<=6);
  if(action.id===6)assert.ok(action.data&&Number.isInteger(action.data.x)&&Number.isInteger(action.data.y)&&action.data.x>=0&&action.data.x<64&&action.data.y>=0&&action.data.y<64,at+': selection uses image pixels');
  const before=state,detail=stepDetailed(world,state,action.id,action.data);state=detail.state;
  assert.ok(!state.failed,at+': action cannot be refused');assert.ok(!state.dead,at+': witness cannot lose a hero');
  assert.notDeepEqual(state,before,at+': no redundant input in a witness');
  checkActors(world,state,at);checkPhases(world,detail,at);
  if(action.id===6)checkSelection(before,state,detail,at);
  beforeLast=session.observe();const observation=session.action(action.id,action.data);finalObservation=observation;
  checkObservation(observation,at);digest.update(JSON.stringify(observation));
  const levelTransition=state.complete&&index<7;
  const expectedFrames=(detail.phases.length?detail.phases.reduce((n,p)=>n+(p.kind==='combat'?5:animated.has(p.kind)?3:1),0):1)+(levelTransition?1:0);
  assert.equal(observation.frames.length,expectedFrames,at+': three-frame motion, five-frame combat and complete cascades');
  assert.ok(observation.frameDurationsMs,at+': changed input includes timing');
  const expectedFrame=levelTransition?renderWorld(worlds[index+1],starts[index+1]):renderWorld(world,state);
  assert.deepEqual(observation.frame,expectedFrame,at+': session and deterministic engine agree');
  assert.equal(observation.level,levelTransition?level+1:level);
  assert.equal(observation.levelsCompleted,state.complete?level:index);
  assert.equal(observation.state,state.complete&&index===7?'WIN':'NOT_FINISHED');
  combatWaves+=detail.phases.filter(p=>p.kind==='combat').length;
  mirrorsDestroyed+=before.mirrors.length-state.mirrors.length;
  cratesCrushed+=detail.phases.filter(p=>p.kind==='crush').reduce((n,p)=>n+p.before.stones.length-p.after.stones.length,0);
  simultaneousHeroReflections+=detail.phases.filter(p=>p.kind==='reflect'&&p.moves.filter(m=>m.actor==='hero').length===2).length;
  hydraulicChanges+=detail.phases.filter(p=>p.kind==='platform').length;
  frames+=observation.frames.length;maxFrames=Math.max(maxFrames,observation.frames.length);
 }
 assert.ok(state.complete&&result.state.complete,label+': solved by its author witness');
 assert.equal(result.metrics.blocked,0);assert.equal(result.metrics.deaths,0);assert.equal(result.metrics.chainPushes,0);
 assert.ok(result.metrics.merchantPushes>0&&result.metrics.wizardSwaps>0,label+': both distinctive abilities appear in the witness');
 const recordedStages=checkStages(design,result,label);
 assert.deepEqual(session.undo(),beforeLast,label+': Undo restores the last action including level progression');
 const last=witness.actions.at(-1);assert.deepEqual(session.action(last.id,last.data),finalObservation,label+': redoing the completion is deterministic');
 report.levels.push({
  level,id:spec.id,title:spec.title,source:LEVEL_INFO[index],dimensions:[spec.rows[0].length,spec.rows.length],
  floorCells:world.terrain.filter(c=>c==='.').length,waterCells:world.terrain.filter(c=>c==='~').length,
  initialStones:world.stones.length,initialSupports:world.supports.length,initialMonsters:world.monsters.length,
  mirrors:world.mirrors.length,gates:world.gates.length,hydraulicPlatforms:world.platforms.length,buttons:world.buttons.length,
  ...result.metrics,combatWaves,mirrorsDestroyed,cratesCrushed,simultaneousHeroReflections,hydraulicChanges,frames,maxFrames,
  recordedStages,completionUndo:true,solved:true,mapSha256:hash(spec),witnessSha256:hash(witness.actions),observationsSha256:digest.digest('hex')
 });
 const proof=await optionalJson('../reference/level'+level+'-necessity.json');
 if(proof){
  const boundHash=proof.specSha256??proof.mapSha256;
  if(boundHash)assert.equal(boundHash,hash(spec),label+': necessity evidence must belong to the current map');
  report.necessityEvidence.push({level,boundToCurrentMap:!!boundHash,...proof});
 }
}

assert.equal(session.observe().state,'WIN');assert.equal(session.observe().levelsCompleted,8);
report.campaignChecks={levels:8,finalState:'WIN',allWitnessesUseMerchantPushAndWizardSwap:true,allCompletionUndosVerified:true};
// The tutorial's advertised lessons are concrete obligations of its real route.
const tutorial=report.levels[0];
assert.ok(tutorial.bentSwaps>=1&&tutorial.mirrorMoves>=1&&tutorial.reflections>=1&&tutorial.heroReflections>=1);
assert.ok(tutorial.pistonPushes>=1&&tutorial.platformsCreated>=2&&tutorial.hydraulicPlatforms>=1&&tutorial.hydraulicChanges>=1);
// L6's delay puzzle deliberately builds one support by reflection and one by its press.
const delay=report.levels[5];
assert.ok(delay.reflections>=3&&delay.heroReflections>=2&&delay.pistonPushes>=1&&delay.platformsCreated>=2&&delay.hydraulicPlatforms>=2);

const failures=await json('../tests/failures.json');
assert.ok(Array.isArray(failures)&&failures.length>0,'At least one reachable campaign defeat is required');
for(const failure of failures){
 assert.ok(Number.isInteger(failure.level)&&failure.level>=1&&failure.level<=8);
 assert.ok(Array.isArray(failure.actions)&&failure.actions.length>0);
 const spec=SS08_LEVELS[failure.level-1],result=replay(spec,failure.actions),label=spec.id+' defeat';
 assert.ok(result.state.dead&&!result.state.complete,label+': route ends in a real defeat');
 assert.equal(result.metrics.blocked,0,label+': no refused setup actions');
 assert.ok(result.trace.slice(0,-1).every(t=>!t.after.dead&&!t.after.complete),label+': fatal action is last');
 if(failure.commands)assert.deepEqual(replay(spec,failure.commands).actions,failure.actions,label+': failure commands');
 const failedSession=new DuoPuzzleSession(SS08_LEVELS);failedSession.selectLevel(failure.level);
 let beforeFinal,terminal;
 for(const action of failure.actions){beforeFinal=failedSession.observe();terminal=failedSession.action(action.id,action.data);checkObservation(terminal,label);}
 assert.equal(terminal.state,'GAME_OVER');assert.ok(terminal.frames.length>1,label+': visible terminal animation');
 const after=failedSession.observe();assert.deepEqual(failedSession.action(4),after,label+': terminal world rejects further movement');
 assert.deepEqual(failedSession.undo(),beforeFinal,label+': complete visual/progression Undo after defeat');
 const last=failure.actions.at(-1);assert.deepEqual(failedSession.action(last.id,last.data),terminal,label+': terminal animation replays deterministically');
 const reset=failedSession.reset();assert.equal(reset.state,'NOT_FINISHED');assert.equal(reset.canUndo,false);
 assert.deepEqual(reset.frame,renderWorld(worlds[failure.level-1],starts[failure.level-1]),label+': Reset restores the initial room');
 report.failureRoutes.push({level:failure.level,cause:failure.cause,actions:failure.actions.length,frames:terminal.frames.length,frameDurationsMs:terminal.frameDurationsMs,exactUndo:true,exactReset:true,passed:true});
}

const restarted=session.restart();assert.equal(restarted.level,1);assert.equal(restarted.levelsCompleted,0);assert.equal(restarted.canUndo,false);
assert.deepEqual(restarted.frame,renderWorld(worlds[0],starts[0]));
for(const key of [...witnessKeys,'combatWaves','mirrorsDestroyed','cratesCrushed','simultaneousHeroReflections','hydraulicChanges','frames'])report.totals[key]=report.levels.reduce((n,l)=>n+l[key],0);
const html=await readFile(new URL('../dist/SS08-demo.html',import.meta.url),'utf8');
assert.ok(html.includes('La Double Transposition')&&html.includes('SS08'));
assert.ok(!html.includes('tests/witnesses')&&!html.includes('function solve(')&&!html.includes('reference/level'),'The playable HTML excludes author witnesses and search tools');
for(const witness of witnesses)assert.ok(!html.includes(witness.commands),'Author command sequence is absent from the playable HTML');
report.htmlSha256=createHash('sha256').update(html).digest('hex');
report.limitations=[
 'Source adaptations are declared, not certified exact reconstructions.',
 'Witnesses prove solvability, not optimality, uniqueness or autonomous SRA success.',
 'Witness use of an ability is not by itself a necessity proof.',
 'Necessity evidence is recorded separately; state/time limits remain inconclusive.',
 'Wizard target rays may relay through mirrors; ACTION5 geometric reflections do not.',
 'HTML interaction QA uses Happy DOM, public canvas pixels and controlled timers; no native browser session is claimed.'
];
report.success=true;
await mkdir(new URL('../validation/',import.meta.url),{recursive:true});
await writeFile(new URL('../validation/levels-report.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({success:true,totals:report.totals,levels:report.levels.map(l=>({level:l.level,title:l.title,actions:l.actions,frames:l.frames,pushes:l.merchantPushes,swaps:l.wizardSwaps,bentSwaps:l.bentSwaps,reflections:l.reflections,presses:l.pistonPushes})),failureRoutes:report.failureRoutes.length},null,2));
