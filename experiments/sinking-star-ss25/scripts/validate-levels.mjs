/** Replays authored SS25 witnesses and validates the shipped public contract.
 * Search-based necessity proofs are separate author tools, never a default gate. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {QuartetPuzzleSession,PALETTE,compileLevel,initialState,stepDetailed,renderWorld,circuitPressed,terrainAt} from '../dist/core.js';
import {SS25_LEVELS} from '../dist/levels.js';
import {LEVEL_INFO} from '../dist/level-info.js';
import {replay} from './solver.mjs';
import {lessonIds,observeLesson,TUTORIAL_LEVEL} from '../dist/tutorial.js';

const json=async p=>JSON.parse(await readFile(new URL(p,import.meta.url),'utf8'));
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const publicKeys=new Set(['gameCode','frame','frames','frameDurationsMs','state','availableActionIds','canUndo','canSelectLevel','level','levelCount','levelsCompleted','defaultFps','palette']);
const animated=new Set(['walk','push','pull','song','swap','reflect','piston','platform']);
const witnessKeys=['actions','selections','warriorPushes','thiefPulls','thiefPartnerPulls','thiefMirrorPulls','swaps','wizardHeroSwaps','wizardStoneSwaps','wizardMonsterSwaps','bentSwaps','songs','groupSongs','songHeroMoves','songStoneMoves','songMonsterMoves','supportMoves','partnerMoves','stoneMoves','mirrorMoves','monsterMoves','reflections','heroReflections','pistonPushes','platformsCreated','monstersRemoved','blocked','deaths'];
const witnesses=await json('../tests/witnesses.json');
const {version}=await json('../package.json');
assert.equal(SS25_LEVELS.length,8,'SS25 ships exactly eight levels');
assert.equal(witnesses.length,8,'Each level needs an author witness');
assert.equal(LEVEL_INFO.length,8,'Each level needs public source metadata');
const worlds=SS25_LEVELS.map(compileLevel),starts=worlds.map(initialState);
const session=new QuartetPuzzleSession(SS25_LEVELS),learned=new Set();
const report={game:'SS25',version,campaignSearch:false,scope:'Eight authored routes, public observations, animation contracts and tutorial coverage',levels:[],totals:{},success:false};
assert.equal(TUTORIAL_LEVEL,1);assert.equal(lessonIds.length,39,'The opening workshop has thirty-nine discoveries');assert.equal(new Set(lessonIds).size,lessonIds.length);
report.ordering={firstLevel:SS25_LEVELS[0].id,firstTitle:SS25_LEVELS[0].title,tutorialLevel:TUTORIAL_LEVEL};
assert.equal(new Set(SS25_LEVELS.map(({id,title,...map})=>hash(map))).size,8,'The eight rooms must have distinct maps');

function checkFrame(frame,label){
 assert.equal(frame.length,64,label+': image height');
 assert.ok(frame.every(row=>row.length===64&&row.every(c=>Number.isInteger(c)&&c>=0&&c<16)),label+': 64 by 64 palette image');
}
function checkObservation(o,label){
 for(const key of Object.keys(o))assert.ok(publicKeys.has(key),label+': private observation field '+key);
 assert.equal(o.gameCode,'SS25');assert.equal(o.levelCount,8);assert.equal(o.defaultFps,10);
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
 assert.equal(state.heroes.length,4);assert.deepEqual(state.heroes.map(h=>h.kind),['warrior','thief','wizard','bard']);
 assert.equal(world.goals.length,4);
 const actors=[...state.heroes.filter(h=>!h.dead).map(h=>h.at),...state.stones,...state.monsters,...state.mirrors.map(m=>m.at)];
 assert.ok(actors.every(p=>Number.isInteger(p.x)&&Number.isInteger(p.y)&&p.x>=0&&p.x<20&&p.y>=0&&p.y<20));
 const keys=actors.map(p=>p.y*20+p.x);assert.equal(new Set(keys).size,keys.length,label+': solid actors cannot overlap');
 assert.equal(new Set(state.supports.map(p=>p.y*20+p.x)).size,state.supports.length,label+': submerged supports are unique');
}
function checkPhases(world,detail,label){
 for(const phase of detail.phases){
  assert.notEqual(phase.kind,'hunt',label+': no autonomous monster phase');
  const monsterMoves=phase.moves.filter(move=>move.actor==='monster');
  if(monsterMoves.length)assert.ok(['push','pull','swap','song','reflect','piston'].includes(phase.kind),label+': every monster transport has a physical cause');
  for(const p of phase.after.monsters)if(!phase.before.monsters.some(q=>q.x===p.x&&q.y===p.y))assert.ok(monsterMoves.some(move=>move.to.x===p.x&&move.to.y===p.y),label+': each new monster position is explained by an explicit transport');
  checkActors(world,phase.before,label+' before '+phase.kind);checkActors(world,phase.after,label+' after '+phase.kind);
  if(phase.kind==='push'){
   const active=phase.before.heroes[phase.before.active],first=phase.moves[0],piece=phase.moves[1];
   assert.equal(active.kind,'warrior',label+': only the Warrior causes a frontal push');
   assert.ok(phase.moves.length>=2,label+': Warrior handles a contiguous frontal file');
   assert.equal(first.actor,'hero');assert.deepEqual(first.from,active.at);
   const dx=first.to.x-first.from.x,dy=first.to.y-first.from.y;
   for(let i=1;i<phase.moves.length;i++){
    const moved=phase.moves[i];
    assert.deepEqual(moved.from,{x:active.at.x+i*dx,y:active.at.y+i*dy},label+': contiguous frontal occupant '+i);
    assert.deepEqual(moved.to,{x:moved.from.x+dx,y:moved.from.y+dy});
    assert.notEqual(moved.actor,'support',label+': submerged supports cannot be pushed directly');
   }
  }
  if(phase.kind==='pull'){
   const active=phase.before.heroes[phase.before.active];assert.equal(active.kind,'thief',label+': only the Thief causes a rear pull');
   assert.equal(phase.moves.length,2,label+': Thief handles one immediately rear occupant');
   const [walker,piece]=phase.moves;assert.equal(walker.actor,'hero');assert.deepEqual(walker.from,active.at);
   const dx=walker.to.x-walker.from.x,dy=walker.to.y-walker.from.y;
   assert.deepEqual(piece.from,{x:active.at.x-dx,y:active.at.y-dy},label+': one immediately rear occupant');
   assert.deepEqual(piece.to,active.at,label+': the pulled occupant takes the vacated tile');
   assert.notEqual(piece.actor,'support',label+': submerged supports cannot be pulled directly');
  }
  if(phase.kind==='swap'){
   const active=phase.before.heroes[phase.before.active];assert.equal(active.kind,'wizard');
   assert.equal(phase.moves.length,2,label+': exchange has exactly two participants');
   const [caster,target]=phase.moves;assert.equal(caster.actor,'hero');assert.deepEqual(caster.from,active.at);
   assert.ok(['hero','stone','monster'].includes(target.actor),label+': only solid targets can exchange');
   assert.deepEqual(caster.to,target.from);assert.deepEqual(target.to,caster.from);
   assert.deepEqual(phase.paths[0][0],caster.from);assert.deepEqual(phase.paths[0].at(-1),caster.to);
  }
  if(phase.kind==='song'){
   const bard=phase.before.heroes[phase.before.active];assert.equal(bard.kind,'bard');
   assert.ok(phase.moves.every(m=>m.actor!=='mirror'),label+': mirrors never join a song');
   assert.ok(phase.moves.every(m=>Math.max(Math.abs(m.from.x-bard.at.x),Math.abs(m.from.y-bard.at.y))<=2),label+': the song uses its initial square');
  }
  for(const motion of phase.moves.filter(m=>m.actor==='support')){
   assert.equal(phase.kind,'song',label+': only a song can move a submerged support');
   assert.equal(terrainAt(world,motion.to),'~',label+': supports remain in water');
   assert.ok(!phase.before.heroes.some(h=>h.at.x===motion.from.x&&h.at.y===motion.from.y),label+': occupied supports are anchored');
   const bard=phase.after.heroes.find(h=>h.kind==='bard');
   assert.ok(bard.at.x!==motion.from.x||bard.at.y!==motion.from.y,label+': the Bard landing is anchored');
  }
  for(const old of phase.before.supports){
   const target=phase.moves.find(m=>m.actor==='support'&&m.from.x===old.x&&m.from.y===old.y)?.to??old;
   assert.ok(phase.after.supports.some(p=>p.x===target.x&&p.y===target.y),label+': a support persists at its translated or anchored location');
  }
  if(['walk','push','pull','song','piston'].includes(phase.kind)){
   assert.ok(phase.moves.length>0,label+': motion phase has movers');
   const first=phase.moves[0],dx=first.to.x-first.from.x,dy=first.to.y-first.from.y;
   assert.equal(Math.abs(dx)+Math.abs(dy),1,label+': movement is cardinal');
   assert.ok(phase.moves.every(m=>m.to.x-m.from.x===dx&&m.to.y-m.from.y===dy),label+': all members translate in the same direction');
  }
  assert.ok(animated.has(phase.kind)||['combat','crush','gate'].includes(phase.kind),label+': recognized animation phase');
 }
}
function expectedTiming(detail,transition){
 const durations=detail.phases.flatMap(p=>p.kind==='combat'?[80,90,100,110,40]:animated.has(p.kind)?(['reflect','swap'].includes(p.kind)?[70,90,40]:[60,80,40]):[40]);
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

for(const [index,spec] of SS25_LEVELS.entries()){
 const level=index+1,label=spec.id,design=await json('../reference/level'+level+'-design.json'),witness=witnesses[index];
 assert.deepEqual(spec,design.spec,label+': reference grid and shipped grid');
 assert.deepEqual(LEVEL_INFO[index],{...design.source,platform:!!design.source.platform},label+': reference and public source metadata');
 assert.deepEqual(witness.actions,design.actions,label+': reference and witness actions');
 assert.equal(witness.commands,design.commands);assert.equal(witness.level,level);assert.equal(witness.id,spec.id);
 assert.ok(typeof witness.commands==='string'&&witness.commands.length>0);
 if(typeof design.adaptation==='string')assert.ok(design.adaptation.trim(),label+': declare the adaptation');
 else if(design.adaptation?.kind){
  assert.ok(design.adaptation&&typeof design.adaptation.kind==='string',label+': adaptation kind');
  for(const part of ['preserved','changed'])assert.ok(Array.isArray(design.adaptation[part])&&design.adaptation[part].length&&design.adaptation[part].every(text=>typeof text==='string'&&text.trim()),label+': documented '+part);
  assert.ok(typeof design.adaptation.sourceReading==='string'&&design.adaptation.sourceReading.trim(),label+': source reading and scope');
 }else{
  for(const part of ['sourcePrinciple','changes','limits'])assert.ok(typeof design.adaptation?.[part]==='string'&&design.adaptation[part].trim(),label+': documented '+part);
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
  const previousLessons=[...learned];observeLesson(learned,beforeLast,observation,action.id);
  if(level!==TUTORIAL_LEVEL)assert.deepEqual([...learned],previousLessons,at+': discoveries only belong to the actual tutorial room');
  checkObservation(observation,at);digest.update(JSON.stringify(observation));
  const levelTransition=state.complete&&index<7;
  const expectedFrames=(detail.phases.length?detail.phases.reduce((n,p)=>n+(p.kind==='combat'?5:animated.has(p.kind)?3:1),0):1)+(levelTransition?1:0);
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
  simultaneousHeroReflections+=detail.phases.filter(p=>p.kind==='reflect'&&p.moves.filter(m=>m.actor==='hero').length >=2).length;
  hydraulicChanges+=detail.phases.filter(p=>p.kind==='platform').length;
  frames+=observation.frames.length;maxFrames=Math.max(maxFrames,observation.frames.length);
 }
 assert.ok(state.complete&&result.state.complete,label+': solved by its author witness');
 assert.equal(result.metrics.blocked,0);assert.equal(result.metrics.deaths,0);
 if(level<TUTORIAL_LEVEL)assert.equal(learned.size,0,label+': no discovery before the tutorial');
 if(level===TUTORIAL_LEVEL)assert.deepEqual([...learned].sort(),[...lessonIds].sort(),'The level 1 witness demonstrates every tutorial lesson before leaving its room');
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
assert.deepEqual([...learned].sort(),[...lessonIds].sort(),'The level 1 author route demonstrates every public-pixel lesson');
report.tutorial={level:TUTORIAL_LEVEL,actions:witnesses[TUTORIAL_LEVEL-1].actions.length,lessons:[...lessonIds],acquired:learned.size,publicPixelsOnly:true,onlyTutorialRoomAwardsDiscoveries:true};
report.mechanismCoverage=report.levels.map(level=>Object.fromEntries(['level','warriorPushes','thiefPulls','thiefPartnerPulls','thiefMirrorPulls','swaps','wizardHeroSwaps','wizardStoneSwaps','wizardMonsterSwaps','bentSwaps','songs','groupSongs','songHeroMoves','songStoneMoves','songMonsterMoves','supportMoves','partnerMoves','stoneMoves','mirrorMoves','monsterMoves','platformsCreated','reflections','heroReflections','pistonPushes','combatWaves','hydraulicChanges'].map(key=>[key,level[key]])));

const restarted=session.restart();assert.equal(restarted.level,1);assert.equal(restarted.levelsCompleted,0);assert.equal(restarted.canUndo,false);
assert.deepEqual(restarted.frame,renderWorld(worlds[0],starts[0]));
for(const key of [...witnessKeys,'combatWaves','mirrorsDestroyed','cratesCrushed','simultaneousHeroReflections','hydraulicChanges','frames'])report.totals[key]=report.levels.reduce((n,l)=>n+l[key],0);
const html=await readFile(new URL('../dist/SS25-demo.html',import.meta.url),'utf8');
assert.ok(html.includes('Les Derniers Équilibres')&&html.includes('SS25'));
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
 'Warrior contiguous file pushes, Thief single rear pulls, Wizard reciprocal exchanges, Bard group transport and movable empty submerged supports follow the declared SS25 quartet contract.',
 'HTML interaction QA uses Happy DOM, public canvas pixels and controlled timers; no native browser session is claimed.'
];
report.success=true;
await mkdir(new URL('../validation/',import.meta.url),{recursive:true});
await writeFile(new URL('../validation/levels-report.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({success:true,totals:report.totals,levels:report.levels.map(l=>({level:l.level,title:l.title,actions:l.actions,frames:l.frames,warriorPushes:l.warriorPushes,swaps:l.swaps,thiefPulls:l.thiefPulls,songs:l.songs,supportMoves:l.supportMoves,reflections:l.reflections,presses:l.pistonPushes})),tutorialLessons:report.tutorial.acquired,campaignSearch:report.campaignSearch},null,2));
