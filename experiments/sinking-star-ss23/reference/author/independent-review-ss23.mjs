/** Independent numeric-action replay. No Author, solver, route builder or replay helper. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {compileLevel,initialState,stepDetailed,equal,terrainAt,supported,circuitPressed,platformActive,gateClosed,cellToPixel} from '../../dist/core.js';
import {SS23_LEVELS} from '../../dist/levels.js';

const lab=new URL('../../',import.meta.url),roles=['merchant','warrior','wizard','bard'],hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const designs=Array.from({length:8},(_,i)=>JSON.parse(readFileSync(new URL(`reference/level${i+1}-design.json`,lab),'utf8')));
const report={game:'SS23',success:false,levels:[],checks:[],shortcutReview:[],qualitativeDiversity:[],method:'Direct execution of the delivered numeric actions with stepDetailed, phase and resource inspection, local alternative branches and explicit shortcut candidates. No author builder or solver.',limits:[
 'A completed witness proves solvability, not a unique or optimal route.',
 'The 72 historical terrain comparisons and maximumIndividualWalkingGoalAssignment are independently run by scripts/verify-design-constraints.mjs. Individual walking keeps other pieces fixed, recomputes circuits at each hero position and excludes orthogonal monster contact; it does not prove impossibility of every joint plan. These controls are not duplicated here.',
 'Local failures establish their consequence from the stated position, not permanent impossibility after every other preparation.',
 'The qualitative comparison distinguishes central problems and repeated supporting mechanisms; it does not measure player difficulty.'
]};
const ok=(level,name,observed,scope='Observed effects on the stated route or local branch; no universal necessity of its exact order claimed.')=>report.checks.push({level,name,status:'passed',observed,scope});
const key=p=>`${p.x},${p.y}`,sorted=ps=>ps.map(key).sort();
const point=(spec,x,y)=>({x:x+Math.floor((20-spec.rows[0].length)/2),y:y+Math.floor((20-spec.rows.length)/2)});
const branch=(world,state,id,data)=>stepDetailed(world,state,id,data);
function select(world,state,role){const p=cellToPixel(state.heroes.find(h=>h.kind===role).at);return branch(world,state,6,{x:p.x+1,y:p.y+1}).state;}
function direct(spec,actions){
 const world=compileLevel(spec),initial=initialState(world),timeline=[];let state=initial;
 for(const[index,action]of actions.entries()){
  assert(!state.complete,`${spec.id}: action after victory`);const before=state,detail=branch(world,state,action.id,action.data);state=detail.state;
  assert(!state.failed&&!state.dead,`${spec.id}: refused or fatal action ${index+1}`);assert.deepEqual(state.heroes.map(h=>h.kind),roles);
  const goals=world.goals.filter(g=>state.heroes.some(h=>!h.dead&&equal(h.at,g))).length;assert.equal(state.complete,goals===4);
  for(const phase of detail.phases){
   const monsterMoves=phase.moves.filter(m=>m.actor==='monster');if(monsterMoves.length)assert(['push','swap','song','reflect','piston'].includes(phase.kind));
   for(const m of phase.moves.filter(m=>m.actor==='support')){assert.equal(phase.kind,'song');assert.equal(terrainAt(world,m.from),'~');assert.equal(terrainAt(world,m.to),'~');assert(phase.before.heroes.every(h=>!equal(h.at,m.from)));}
  }
  timeline.push({turn:index+1,action,before,after:state,phases:detail.phases});
 }
 return{world,initial,state,timeline,phases:timeline.flatMap(t=>t.phases.map(p=>({...p,turn:t.turn})))};
}
function variant(spec,commands){
 const world=compileLevel(spec);let state=initialState(world);const actions=[];
 for(const c of commands){const p=cellToPixel(state.heroes[(state.active+1)%4].at),action=c==='C'?{id:6,data:{x:p.x+1,y:p.y+1}}:{id:{U:1,D:2,L:3,R:4,X:5}[c]};assert(action.id);const next=branch(world,state,action.id,action.data);assert(!next.state.failed&&!next.state.dead);state=next.state;actions.push(action);}
 const result=direct(spec,actions);assert(result.state.complete);return{actions:actions.length,selections:actions.filter(a=>a.id===6).length,phases:result.phases,commands};
}
function stoneComponents(stones){
 const unseen=new Set(stones.map(key)),sizes=[];
 for(const start of stones)if(unseen.has(key(start))){const queue=[start];unseen.delete(key(start));for(let i=0;i<queue.length;i++)for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const p={x:queue[i].x+dx,y:queue[i].y+dy};if(unseen.delete(key(p)))queue.push(p);}sizes.push(queue.length);}
 return sizes.sort((a,b)=>b-a);
}

try{
 assert.equal(SS23_LEVELS.length,8);
 for(const[n0,spec]of SS23_LEVELS.entries()){
  const n=n0+1,d=designs[n0];assert.deepEqual(spec,d.spec,`${spec.id}: synchronize and build before independent review`);
  const r=direct(spec,d.actions),{world,initial,state,timeline,phases}=r,P=(x,y)=>point(spec,x,y),events=kind=>phases.filter(p=>p.kind===kind),at=i=>timeline[d.stages[i].turn-1].after;
  assert.equal(world.goals.length,4);assert.equal(new Set(world.goals.map(key)).size,4);assert(!initial.complete&&!initial.dead);assert(state.complete);
  assert(initial.heroes.every(h=>!world.goals.some(g=>equal(g,h.at))));
  const beforeLast=world.goals.filter(g=>timeline.at(-1).before.heroes.some(h=>equal(g,h.at))).length;assert(beforeLast<4);
  report.levels.push({level:n,title:spec.title,actions:d.actions.length,selections:d.actions.filter(a=>a.id===6).length,mapSha256:hash(spec),actionsSha256:hash(d.actions),complete:true,refusedActions:0,deaths:0,goalCountBeforeLastAction:beforeLast,goalCountAfterLastAction:4,finalPositions:state.heroes.map(h=>({role:h.kind,at:h.at})),initialStoneComponents:stoneComponents(initial.stones)});
  ok(n,'Direct replay reaches four destinations with the four living roles',{actions:d.actions.length,goalsBeforeLastAction:beforeLast,goalsAfterLastAction:4,refusedActions:0,deaths:0});

  if(n===1){
   const mixed=events('push').find(p=>p.moves.filter(m=>m.actor==='hero').length===4&&p.moves.some(m=>m.actor==='stone'));assert(mixed);assert.equal(mixed.before.heroes[mixed.before.active].kind,'warrior');
   const sung=events('song').find(p=>p.moves.some(m=>m.actor==='hero'&&equal(m.from,p.before.heroes[2].at)));assert(sung);const moved=sung.moves.find(m=>equal(m.from,sung.before.heroes[2].at));assert.equal(Math.abs(moved.to.x-moved.from.x)+Math.abs(moved.to.y-moved.from.y),1);
   const forced=events('swap').filter(p=>p.moves.some(m=>m.actor==='hero'&&equal(m.from,p.before.heroes[3].at)));assert(forced.length);for(const p of forced){assert.deepEqual(p.before.stones,p.after.stones);assert.deepEqual(p.before.supports,p.after.supports);}
   assert(events('reflect').some(p=>p.moves.some(m=>m.actor==='stone')));assert(events('reflect').some(p=>p.moves.some(m=>m.actor==='hero')));assert(phases.some(p=>p.moves.some(m=>m.actor==='support')));assert.equal(initial.monsters.length-state.monsters.length,4);assert(circuitPressed(world,state,'sortie'));
   ok(n,'Tutorial transports distinguish voluntary powers from imposed movement',{mixedFile:mixed.moves,sungWizard:moved,silentBardSwapTurns:forced.map(p=>p.turn),monstersRemoved:4,supportMoves:phases.flatMap(p=>p.moves).filter(m=>m.actor==='support').length});
  }
  if(n===2){
   assert.equal(initial.stones.length,9);assert(timeline.every(t=>t.after.stones.length===9));assert.equal(world.gates.length,0);assert.deepEqual(stoneComponents(initial.stones),[9]);
   const pushes=events('push').filter(p=>p.before.heroes[p.before.active].kind==='merchant');assert.equal(pushes.length,6);for(const p of pushes){assert.deepEqual(p.before.stones,p.after.stones);assert(p.moves.some(m=>m.actor==='hero'&&equal(m.from,p.before.heroes[3].at)));}
   const lastSong=events('song').at(-1);assert(lastSong.moves.some(m=>m.actor==='hero'&&equal(m.from,lastSong.before.heroes[0].at)));
   ok(n,'The dense grid is crossed and its work places are reused',{cratesConserved:9,initialComponents:[9],silentMerchantPushes:6,crateSwaps:events('swap').filter(p=>p.moves.some(m=>m.actor==='stone')).length,lastSong:lastSong.moves,gates:0});
  }
  if(n===3){
   assert.equal(initial.stones.length,4);assert(timeline.every(t=>t.after.stones.length===4));assert.equal(events('push').length,3);assert(events('push').every(p=>p.moves.filter(m=>m.actor==='stone').length===2));assert.equal(world.gates.length,0);
   const alt=d.adaptation.localChecks.find(c=>c.name.startsWith('Variante gagnante'));assert(alt?.commands);const result=variant(spec,alt.commands);assert.equal(result.actions,37);assert(result.phases.some(p=>p.kind==='swap'&&p.moves.some(m=>m.actor==='stone')));
   report.shortcutReview.push({level:n,candidate:'Let the Warrior leave first, then use the remaining crate as the Wizard target.',result:'Complete legal 37-action alternative. It retains the three file pushes and the selective group rearrangement.',actions:result.actions,commands:result.commands,limit:'The identity of the Wizard target in the 43-action witness is not mandatory.'});
   ok(n,'The same four crates form two successive working files',{filePushes:3,songs:events('song').length,cratesConserved:4,alternativeActions:37});
  }
  if(n===4){
   const sent=at(2);assert(equal(sent.heroes[3].at,P(10,3)));assert.deepEqual(sent.stones,at(1).stones);assert(timeline.every(t=>t.after.stones.length+t.after.supports.length===3));
   assert.deepEqual(sorted(state.supports),sorted([[6,10],[7,10],[8,10]].map(([x,y])=>P(x,y))));assert.equal(world.gates.length,0);assert.equal(world.platforms.length,0);
   ok(n,'The Bard is sent into the work station and all three charges are reused',{bardStation:sent.heroes[3].at,unchangedStocksDuringSwap:true,finalSupports:state.supports,initialCrates:3});
  }
  if(n===5){
   const reflected=branch(world,initial,5);assert(reflected.state.failed&&!reflected.state.dead);assert.deepEqual(reflected.state.monsters,initial.monsters);
   const unsafe=branch(world,select(world,initial,'wizard'),4);assert(unsafe.state.heroes[2].dead);
   assert.equal(events('swap').filter(p=>p.moves.some(m=>m.actor==='monster')).length,1);assert.equal(world.circuits.length,0);assert.equal(state.monsters.length,0);
   const alt=d.adaptation.localChecks.find(c=>c.name.includes('reflet préparé'));assert(alt?.commands);const checked=variant(spec,alt.commands);assert.equal(checked.actions,51);assert.equal(checked.phases.filter(p=>p.kind==='reflect').length,1);
   report.shortcutReview.push({level:n,candidate:'Activate every mirror immediately and remove both guards before any preparation.',result:'Rejected atomically on the corrected geometry; both guards remain. A prepared reflection is still legal and has a complete 51-action witness, including intermediate evacuation and a monster swap.',initialRefused:true,preparedActions:checked.actions,commands:checked.commands,limit:'This checks the initial activation and the stated prepared branch, not all optical strategies.'});
   ok(n,'The shortcut correction preserves legitimate prepared reflection',{initialReflectionRefused:true,unpreparedCrateSwapKillsWizard:true,preparedReflectionAlternativeActions:51,monsterSwapCount:1,circuits:0});
  }
  if(n===6){
   const loaded=at(0),tooFar=branch(world,loaded,4);assert(tooFar.state.failed&&!tooFar.state.dead);
   const song=events('song')[0];assert.equal(song.moves.filter(m=>m.actor==='stone').length,1);assert(song.moves.some(m=>m.actor==='stone'&&equal(m.from,P(9,7))&&equal(m.to,P(9,8))));
   const deployed=events('swap')[0];assert(deployed);assert(deployed.moves.some(m=>m.actor==='hero'&&equal(m.from,P(8,7))&&equal(m.to,P(14,7))));assert.deepEqual(deployed.before.stones,deployed.after.stones);
   const press=events('piston');assert.equal(press.length,1);assert.equal(press[0].moves.filter(m=>m.actor==='stone').length,2);assert.deepEqual(sorted(state.stones),sorted([[6,8],[7,8]].map(([x,y])=>P(x,y))));assert(circuitPressed(world,state,'rangement'));
   ok(n,'A new working side and the closing press complete the placement',{straightContinuationRefused:true,selectedCrateMove:song.moves.filter(m=>m.actor==='stone'),warriorDeployment:deployed.moves,pressMoves:press[0].moves,finalWeights:state.stones});
   const departure=timeline.find(t=>t.turn>d.stages[3].turn&&t.before.heroes[t.before.active].kind==='bard'&&t.action.id<=4);assert(departure);
   const down=branch(world,departure.before,2);assert(!down.state.failed&&!down.state.dead);assert(!circuitPressed(world,down.state,'rangement'));
   report.shortcutReview.push({level:n,candidate:'After parking the other heroes, leave the final Bard post straight down without checking the nearby load.',result:'The action is legal but removes the two weights and closes the destination access.',fromTurn:departure.turn-1,action:2,cratesAfter:down.state.stones,limit:'The local change can be repaired; this is not a global dead-end claim.'});
  }
  if(n===7){
   assert.equal(initial.supports.length,2);assert.equal(initial.stones.length,1);assert(timeline.every(t=>t.after.supports.length===2&&t.after.stones.length===1));
   const anchored=at(0),adjusted=at(1);assert(equal(anchored.heroes[2].at,P(8,8)));assert(anchored.supports.some(p=>equal(p,P(8,8))));
   assert(adjusted.supports.some(p=>equal(p,P(8,8))));assert(adjusted.supports.some(p=>equal(p,P(11,8))));assert(equal(adjusted.heroes[2].at,P(9,8)));
   const unanchor=branch(world,select(world,anchored,'wizard'),4);assert(!unanchor.state.failed&&!unanchor.state.dead);
   const premature=branch(world,select(world,unanchor.state,'bard'),4);assert(!premature.state.failed&&!premature.state.dead);assert(!supported(world,premature.state,P(8,8)));
   ok(n,'The exchange changes the occupied support before the differential song',{before:anchored.supports,after:adjusted.supports,wizardAfter:adjusted.heroes[2].at,platformSupportsWizard:platformActive(world,adjusted,0),withoutAnchor:premature.state.supports,westernEntranceUnsupportedWithoutAnchor:true},'The unanchored branch is legal but removes the western entrance at this moment. It is not claimed irreparable.');
   const handover=events('push').find(p=>p.moves.some(m=>m.actor==='stone'&&equal(m.to,P(3,13))));assert(handover);assert(circuitPressed(world,handover.before,'passage'));assert(circuitPressed(world,handover.after,'passage'));
   const northRelease=timeline.find(t=>!circuitPressed(world,t.after,'passage')&&circuitPressed(world,t.before,'passage'));assert(northRelease);assert(!gateClosed(world,northRelease.after,0));assert(northRelease.after.heroes.every(h=>world.platforms.every(p=>!equal(h.at,p.at))));
   ok(n,'The release window and the final handover keep their distinct roles',{temporaryReleaseTurn:northRelease.turn,noHeroOnWithdrawnPlatforms:true,continuousHandover:handover.moves,supportMoves:phases.flatMap(p=>p.moves).filter(m=>m.actor==='support').length,allMovedSupportsInitiallyUnoccupied:true});
   report.shortcutReview.push({level:n,candidate:'Walk the Wizard off the first support before singing and use the same crossing.',result:'The song also moves that now-empty support; the western entrance at (8,8) is bare water in the source map.',fromTurn:d.stages[0].turn,branch:['wizard R','bard R'],limit:'This isolates the useful anchoring effect. Another preparation or a recovery route is not ruled out.'});
  }
  if(n===8){
   assert.deepEqual(stoneComponents(initial.stones),[5,3,1]);assert(timeline.every(t=>t.after.stones.length===9));assert.equal(world.circuits[0].buttons.length,9);
   const songs=events('song').filter(p=>p.turn<=d.stages[1].turn);assert.equal(songs.length,5);const lower=[[9,10],[10,10],[11,10]].map(([x,y])=>P(x,y));
   for(const song of songs.slice(0,2))for(const p of lower)assert(song.after.stones.some(q=>equal(p,q)));
   const third=songs[2];assert.equal(third.moves.filter(m=>m.actor==='stone'&&lower.some(p=>equal(p,m.from))).length,3);
   const composed=at(2),filled=at(5);assert(circuitPressed(world,composed,'composition'));assert(composed.heroes.some(h=>world.circuits[0].buttons.some(p=>equal(p,h.at))));
   assert(circuitPressed(world,filled,'composition'));assert(world.circuits[0].buttons.every(p=>filled.stones.some(q=>equal(p,q))));
   ok(n,'The fragments enter the song at different moments',{initialStoneComponents:[5,3,1],firstTwoSongsHoldLowerRow:true,thirdSongMovesLowerRow:third.moves.filter(m=>m.actor==='stone'&&lower.some(p=>equal(p,m.from))),allNineCratesConserved:true},'The lower fragment is initially held by members outside the range. It joins the moving group only after the Bard advances; the new silhouette changes an actual dependency.');
   ok(n,'The final replacement preserves a constructed pattern',{buttons:world.circuits[0].buttons,initiallyOccupiedByHero:true,afterReserveSwapAllNineAreCrateWeights:true,gateOpen:!gateClosed(world,filled,0)},'Pattern construction is the new central operation. Extracting the Bard after placing weights is a reused supporting mechanism, not claimed as a new idea.');
  }
 }
 report.qualitativeDiversity=[
  {levels:[2,8],comparison:'N2 starts with one connected 3×3 block of nine crates and has no buttons. N8 starts with separate five- and three-crate fragments plus a reserve; staggered range entry builds a nine-button pattern.',distinctObservedFeatures:['initial components [9] versus [5,3,1]','circulation through a dense grid versus composition by successive stops'],remainingSimilarity:'Both use group translation and exchanges; the revised N8 avoids presenting another full 3×3 starting grid.'},
  {levels:[3],comparison:'A narrow dry crossing with two short perpendicular files and a single extra end cell; no water, mirror, monster or circuit. It is not another dense square grid.'},
  {levels:[4,6],comparison:'Both deploy a specialist by exchange. N4 sends the Bard to an isolated work bay and reuses three charges as supports; N6 sends the Warrior behind a file and uses a closing press to finish two weights.'},
  {levels:[5],comparison:'Two receiving positions and a trapped partner determine spell safety. Guards never act as button weights; the corrected initial global reflection is blocked by ordinary mirror geometry.'},
  {levels:[7],comparison:'The occupied support is held while its occupant steps onto a platform; the other support moves. Water reuse and keeper replacement are established series mechanisms, while choosing the anchor by exchange is the focal combination.'},
  {levels:[6,7,8],remainingSimilarity:'All three finales still contain maintained circuits and a departure preserving a prepared load. Their central preparations differ, but this supporting pattern is deliberately acknowledged rather than labelled wholly new.'}
 ];
 report.success=true;
}catch(error){report.error=error.stack;process.exitCode=1;}
writeFileSync(new URL('reference/independent-ss23-review.json',lab),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({success:report.success,levels:report.levels.length,checks:report.checks.length,shortcutReviews:report.shortcutReview.length,error:report.error}));
