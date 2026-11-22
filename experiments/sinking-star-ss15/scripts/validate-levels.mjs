/** Replays authored SS15 witnesses and validates the shipped public contract.
 * Search-based necessity proofs are separate author tools, never a default gate. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {DuoPuzzleSession,PALETTE,compileLevel,initialState,stepDetailed,renderWorld,circuitPressed} from '../dist/core.js';
import {SS15_LEVELS} from '../dist/levels.js';
import {LEVEL_INFO} from '../dist/level-info.js';
import {replay} from './solver.mjs';
import {lessonIds,observeLesson,TUTORIAL_LEVEL} from '../dist/tutorial.js';

const json=async p=>JSON.parse(await readFile(new URL(p,import.meta.url),'utf8'));
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const publicKeys=new Set(['gameCode','frame','frames','frameDurationsMs','state','availableActionIds','canUndo','canSelectLevel','level','levelCount','levelsCompleted','defaultFps','palette']);
const animated=new Set(['walk','swap','song','reflect','piston','platform']);
const witnessKeys=['actions','selections','swaps','partnerSwaps','bouncedSwaps','bardSongs','partnerSongs','selectiveSongs','forcedBardMoves','supportMoves','stoneMoves','monsterMoves','mirrorMoves','reflections','heroReflections','pistonPushes','platformsCreated','monstersRemoved','blocked','deaths'];
const witnesses=await json('../tests/witnesses.json');
const {version}=await json('../package.json');
assert.equal(SS15_LEVELS.length,8,'SS15 ships exactly eight levels');
assert.equal(witnesses.length,8,'Each level needs an author witness');
assert.equal(LEVEL_INFO.length,8,'Each level needs public source metadata');
const worlds=SS15_LEVELS.map(compileLevel),starts=worlds.map(initialState);
const session=new DuoPuzzleSession(SS15_LEVELS),learned=new Set();
const report={game:'SS15',version,campaignSearch:false,scope:'Eight authored routes, public observations, animation contracts and tutorial coverage',levels:[],totals:{},success:false};
assert.equal(TUTORIAL_LEVEL,1);assert.equal(lessonIds.length,20);
assert.equal(new Set(SS15_LEVELS.map(({id,title,...map})=>hash(map))).size,8,'The eight rooms must have distinct maps');

function checkFrame(frame,label){
 assert.equal(frame.length,64,label+': image height');
 assert.ok(frame.every(row=>row.length===64&&row.every(c=>Number.isInteger(c)&&c>=0&&c<16)),label+': 64 by 64 palette image');
}
function checkObservation(o,label){
 for(const key of Object.keys(o))assert.ok(publicKeys.has(key),label+': private observation field '+key);
 assert.equal(o.gameCode,'SS15');assert.equal(o.levelCount,8);assert.equal(o.defaultFps,10);
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
 assert.equal(state.heroes.length,2);assert.deepEqual(state.heroes.map(h=>h.kind),['wizard','bard']);
 assert.equal(world.goals.length,2);
 const actors=[...state.heroes.filter(h=>!h.dead).map(h=>h.at),...state.stones,...state.monsters,...state.mirrors.map(m=>m.at)];
 assert.ok(actors.every(p=>Number.isInteger(p.x)&&Number.isInteger(p.y)&&p.x>=0&&p.x<20&&p.y>=0&&p.y<20));
 const keys=actors.map(p=>p.y*20+p.x);assert.equal(new Set(keys).size,keys.length,label+': solid actors cannot overlap');
 assert.equal(new Set(state.supports.map(p=>p.y*20+p.x)).size,state.supports.length,label+': permanent supports are unique');
}
function checkPhases(world,detail,label){
 for(const phase of detail.phases){
  checkActors(world,phase.before,label+' before '+phase.kind);checkActors(world,phase.after,label+' after '+phase.kind);
  if(phase.kind==='swap'){
   assert.equal(phase.before.heroes[phase.before.active].kind,'wizard');
   assert.equal(phase.moves.length,2,label+': reciprocal substitution has two occupants');
   const [caster,target]=phase.moves;assert.equal(caster.actor,'hero');
   assert.ok(['hero','stone','monster'].includes(target.actor),label+': only mobile swap targets');
   assert.deepEqual(caster.to,target.from);assert.deepEqual(target.to,caster.from);
   assert.equal(phase.paths.length,1);assert.deepEqual(phase.paths[0][0],caster.from);assert.deepEqual(phase.paths[0].at(-1),caster.to);
   for(let i=1;i<phase.paths[0].length;i++){const a=phase.paths[0][i-1],b=phase.paths[0][i];assert.equal(Math.abs(a.x-b.x)+Math.abs(a.y-b.y),1,label+': the ray path is contiguous');}
  }
  if(phase.kind==='song'){
   const bard=phase.before.heroes[phase.before.active];
   assert.equal(bard.kind,'bard');
   assert.ok(phase.moves.length>1,label+': an effective song carries at least one participant');
   assert.ok(phase.moves.every(m=>m.actor!=='mirror'),label+': a mirror is never selected by the song');
   assert.ok(phase.moves.every(m=>Math.max(Math.abs(m.from.x-bard.at.x),Math.abs(m.from.y-bard.at.y))<=2),label+': pre-step square range');
   for(const motion of phase.moves.filter(m=>m.actor==='support'))assert.ok(!phase.before.heroes.some(h=>h.at.x===motion.from.x&&h.at.y===motion.from.y),label+': a support under a hero stays anchored');
  }
  if(['walk','song','piston'].includes(phase.kind)){
   assert.ok(phase.moves.length>0,label+': motion phase has movers');
   const first=phase.moves[0],dx=first.to.x-first.from.x,dy=first.to.y-first.from.y;
   assert.equal(Math.abs(dx)+Math.abs(dy),1,label+': movement is cardinal');
   assert.ok(phase.moves.every(m=>m.to.x-m.from.x===dx&&m.to.y-m.from.y===dy),label+': all members translate in the same direction');
  }
  assert.ok(animated.has(phase.kind)||['combat','crush','gate','swap-loop'].includes(phase.kind),label+': recognized animation phase');
 }
}
function loopFrameCount(phase){
 const path=phase.paths?.[0]??[phase.after.heroes[phase.after.active].at];
 const ends=path.flatMap((p,i)=>i>0&&phase.after.mirrors.some(m=>m.at.x===p.x&&m.at.y===p.y)?[i]:[]);
 if(ends.at(-1)!==path.length-1)ends.push(path.length-1);
 return ends.length+4;
}
function expectedTiming(detail,transition){
 const durations=detail.phases.flatMap(p=>p.kind==='swap-loop'?[...Array(loopFrameCount(p)-5).fill(90),100,100,80,100,0]
  :p.kind==='combat'?[80,90,100,110,40]:animated.has(p.kind)?(['swap','reflect'].includes(p.kind)?[70,90,40]:[60,80,40]):[40]);
 if(!durations.length)durations.push(0);
 durations[durations.length-1]=transition?100:0;if(transition)durations.push(0);return durations;
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
const initialCampaign=session.observe();
for(const action of [0,7,1.5,NaN]){assert.throws(()=>session.action(action));assert.deepEqual(session.observe(),initialCampaign);}
for(const data of [undefined,{x:-1,y:3},{x:64,y:3},{x:3.5,y:4}]){assert.throws(()=>session.action(6,data));assert.deepEqual(session.observe(),initialCampaign);}
for(const level of [0,9,1.5,NaN]){assert.throws(()=>session.selectLevel(level));assert.deepEqual(session.observe(),initialCampaign);}
assert.deepEqual(session.action(6,{x:0,y:0}),initialCampaign,'An empty pixel selection is a no-op');
report.controlChecks={actions:[1,2,3,4,5,6],malformedActionsAtomic:true,selectionUsesPublicPixelCoordinates:true,invalidLevelAtomic:true,emptyPixelSelectionIsNoop:true};

for(const [index,spec] of SS15_LEVELS.entries()){
 const level=index+1,label=spec.id,design=await json('../reference/level'+level+'-design.json'),witness=witnesses[index];
 assert.deepEqual(spec,design.spec,label+': reference grid and shipped grid');
 assert.deepEqual(LEVEL_INFO[index],{...design.source,platform:!!design.source.platform},label+': reference and public source metadata');
 assert.deepEqual(witness.actions,design.actions,label+': reference and witness actions');
 assert.equal(witness.commands,design.commands);assert.equal(witness.level,level);assert.equal(witness.id,spec.id);
 assert.ok(typeof witness.commands==='string'&&witness.commands.length>0);
 if(typeof design.adaptation==='string')assert.ok(design.adaptation.trim(),label+': declare the adaptation');
 else {
  assert.ok(design.adaptation&&typeof design.adaptation.kind==='string',label+': adaptation kind');
  for(const part of ['preserved','changed'])assert.ok(Array.isArray(design.adaptation[part])&&design.adaptation[part].length&&design.adaptation[part].every(text=>typeof text==='string'&&text.trim()),label+': documented '+part);
  assert.ok(typeof design.adaptation.sourceReading==='string'&&design.adaptation.sourceReading.trim(),label+': source reading and scope');
 }
 assert.ok(design.source.label?.trim()&&design.source.objective?.trim(),label+': readable credit and objective');
 const sourceURL=new URL(design.source.url);assert.equal(sourceURL.protocol,'https:');assert.equal(sourceURL.hostname,'sinkingstarwalkthrough.com');
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
  observeLesson(learned,beforeLast,observation,action.id);
  checkObservation(observation,at);digest.update(JSON.stringify(observation));
  const levelTransition=state.complete&&index<7;
  const expectedFrames=(detail.phases.length?detail.phases.reduce((n,p)=>n+(p.kind==='swap-loop'?loopFrameCount(p):p.kind==='combat'?5:animated.has(p.kind)?3:1),0):1)+(levelTransition?1:0);
  assert.equal(observation.frames.length,expectedFrames,at+': three-frame motion, five-frame combat and complete cascades');
  assert.ok(observation.frameDurationsMs,at+': changed input includes timing');
  assert.deepEqual(observation.frameDurationsMs,expectedTiming(detail,levelTransition),at+': exact phase durations');
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
 assert.equal(result.metrics.blocked,0);assert.equal(result.metrics.deaths,0);
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

}

assert.equal(session.observe().state,'WIN');assert.equal(session.observe().levelsCompleted,8);
report.campaignChecks={levels:8,finalState:'WIN',allCompletionUndosVerified:true,allShippedMapsMatchAuthorReferences:true,allWitnessesCompleteWithoutRefusalOrDeath:true};
assert.deepEqual([...learned].sort(),[...lessonIds].sort(),'The level 1 author route demonstrates all twenty public-pixel lessons');
report.tutorial={level:TUTORIAL_LEVEL,lessons:[...lessonIds],acquired:learned.size,publicPixelsOnly:true};
report.mechanismCoverage=report.levels.map(level=>Object.fromEntries(['level','swaps','partnerSwaps','bouncedSwaps','bardSongs','partnerSongs','selectiveSongs','supportMoves','platformsCreated','mirrorMoves','reflections','pistonPushes','combatWaves','hydraulicChanges'].map(key=>[key,level[key]])));

const restarted=session.restart();assert.equal(restarted.level,1);assert.equal(restarted.levelsCompleted,0);assert.equal(restarted.canUndo,false);
assert.deepEqual(restarted.frame,renderWorld(worlds[0],starts[0]));
for(const key of [...witnessKeys,'combatWaves','mirrorsDestroyed','cratesCrushed','simultaneousHeroReflections','hydraulicChanges','frames'])report.totals[key]=report.levels.reduce((n,l)=>n+l[key],0);
const html=await readFile(new URL('../dist/SS15-demo.html',import.meta.url),'utf8');
assert.ok(html.includes('Les Accords Transposés')&&html.includes('SS15'));
assert.ok(!html.includes('tests/witnesses')&&!html.includes('function solve(')&&!html.includes('reference/level')&&!html.includes('reference/author')&&!html.includes('function replay('),'The playable HTML excludes author witnesses, replay helpers and search tools');
assert.equal((html.match(/<script>/g)??[]).length,1,'The standalone game has one local bundle');
assert.ok(!/<script[^>]+src=/i.test(html),'No remote script is needed to play');
report.bundle={authorToolsExcluded:true,witnessesExcluded:true,networkIndependent:true};
for(const witness of witnesses)assert.ok(!html.includes(witness.commands),'Author command sequence is absent from the playable HTML');
report.htmlSha256=createHash('sha256').update(html).digest('hex');
report.limitations=[
 'Source adaptations are declared, not certified exact reconstructions.',
 'Witnesses prove solvability, not optimality, uniqueness or autonomous SRA success.',
 'Witness use of an ability is not by itself a necessity proof.',
 'No exhaustive search or general necessity proof is performed by this validator.',
 'Reciprocal swaps, square-range song, movable water supports and anchoring follow the declared SS15 contract; no cloning, dragons, Druid or cleric abilities are added.',
 'HTML interaction QA uses Happy DOM, public canvas pixels and controlled timers; no native browser session is claimed.'
];
report.success=true;
await mkdir(new URL('../validation/',import.meta.url),{recursive:true});
await writeFile(new URL('../validation/levels-report.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({success:true,totals:report.totals,levels:report.levels.map(l=>({level:l.level,title:l.title,actions:l.actions,frames:l.frames,swaps:l.swaps,songs:l.bardSongs,supportMoves:l.supportMoves,reflections:l.reflections,presses:l.pistonPushes})),tutorialLessons:report.tutorial.acquired,campaignSearch:report.campaignSearch},null,2));
