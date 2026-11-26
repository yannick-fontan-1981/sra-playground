/** Direct action-list review and frozen geometry. No solver or author builder is invoked. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {compileLevel,initialState,stepDetailed,circuitPressed,platformActive,terrainAt,supported,gateClosed,doorsOpen,cellToPixel,equal} from '../../dist/core.js';
import {SS22_LEVELS} from '../../dist/levels.js';

const lab=new URL('../../',import.meta.url),hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const roles=['bard','merchant','thief','warrior'],directions=[[1,0],[-1,0],[0,1],[0,-1]],key=p=>`${p.x},${p.y}`;
const report={game:'SS22',success:false,method:'Direct replay of the delivered numeric action lists with stepDetailed; no Author, command solver, route builder or replay helper. Frozen walking geometry and all eight planar terrain symmetries.',levels:[],checks:[],shortcutReview:[],limits:[
 'A completed witness establishes solvability, not an optimal or unique solution.',
 'Frozen walking suppresses abilities and fixes circuits, pieces and supports at their initial states. Ignoring other heroes makes this static graph more permissive; it is not an exhaustive search of all joint walking or switch strategies.',
 'Terrain comparison ignores actor and device placements, preserves water, trims exterior walls and canonicalizes rotations and reflections. It detects exact repeated silhouettes, not subjective similarity or difficulty.',
 'Local branches establish their stated consequences from the stated positions, without proving all other preparations impossible.'
]};
const ok=(level,name,observed,scope='Effects observed on the qualified route; no universal necessity of its exact order is claimed.')=>report.checks.push({level,name,status:'passed',observed,scope});

function canonicalTerrain(rows){
 let matrix=rows.map(row=>[...row].map(c=>c==='#'?'#':'~s'.includes(c)?'~':'.'));
 const active=[];matrix.forEach((row,y)=>row.forEach((c,x)=>{if(c!=='#')active.push({x,y});}));assert(active.length);
 const left=Math.min(...active.map(p=>p.x)),right=Math.max(...active.map(p=>p.x)),top=Math.min(...active.map(p=>p.y)),bottom=Math.max(...active.map(p=>p.y));
 matrix=matrix.slice(top,bottom+1).map(row=>row.slice(left,right+1));const forms=[];
 for(let i=0;i<4;i++){forms.push(matrix.map(row=>row.join('')).join('\n'));forms.push(matrix.map(row=>[...row].reverse().join('')).join('\n'));matrix=matrix[0].map((_,x)=>matrix.map(row=>row[x]).reverse());}
 return hash(forms.sort()[0]);
}
function historicalLayouts(){
 const records=[];
 for(let series=14;series<=21;series++){
  const source=readFileSync(new URL(`../sinking-star-ss${series}/src/levels.ts`,lab),'utf8'),match=source.match(/SS\d+_LEVELS[^=]*=\s*(\[[\s\S]*\])\s*;/);
  assert(match,`Readable SS${series} levels`);const levels=JSON.parse(match[1]);assert.equal(levels.length,8);
  for(const spec of levels)records.push({series:`SS${series}`,id:spec.id,title:spec.title,terrainSha256:canonicalTerrain(spec.rows)});
 }
 assert.equal(records.length,64);return records;
}
function walking(world,state,hero,ignoreOtherHeroes){
 const occupied=[...state.stones,...state.monsters,...state.mirrors.map(m=>m.at),...(!ignoreOtherHeroes?state.heroes.filter(h=>h.kind!==hero.kind).map(h=>h.at):[])];
 const blocked=p=>!supported(world,state,p)||terrainAt(world,p)==='#'||occupied.some(q=>equal(p,q))||world.gates.some((g,i)=>equal(g.at,p)&&gateClosed(world,state,i))||world.doors.some(q=>equal(q,p))&&!doorsOpen(world,state);
 const queue=[hero.at],seen=new Set([key(hero.at)]);for(let i=0;i<queue.length;i++)for(const[dx,dy]of directions){const p={x:queue[i].x+dx,y:queue[i].y+dy};if(blocked(p)||seen.has(key(p)))continue;seen.add(key(p));queue.push(p);}
 return{role:hero.kind,reachableCells:seen.size,reachableGoals:world.goals.filter(p=>seen.has(key(p))),exhausted:true};
}
function maximumAssignment(walks){
 function visit(i,used){if(i===walks.length)return 0;let best=visit(i+1,used);for(const p of walks[i].reachableGoals)if(!used.has(key(p))){const next=new Set(used);next.add(key(p));best=Math.max(best,1+visit(i+1,next));}return best;}
 return visit(0,new Set());
}
function landComponent(world,start){const queue=[start],seen=new Set([key(start)]);for(let i=0;i<queue.length;i++)for(const[dx,dy]of directions){const p={x:queue[i].x+dx,y:queue[i].y+dy};if(terrainAt(world,p)!=='.'||seen.has(key(p)))continue;seen.add(key(p));queue.push(p);}return seen;}
function direct(spec,actions){
 const world=compileLevel(spec),initial=initialState(world),timeline=[];let state=initial;
 for(const[index,action]of actions.entries()){
  assert(!state.complete,`${spec.id}: route continues beyond completion`);const before=state,detail=stepDetailed(world,state,action.id,action.data);state=detail.state;
  assert(!state.failed&&!state.dead,`${spec.id}: refused or fatal action ${index+1}`);assert.deepEqual(state.heroes.map(h=>h.kind).sort(),roles);
  assert.equal(state.complete,world.goals.filter(g=>state.heroes.some(h=>!h.dead&&equal(h.at,g))).length===4);
  timeline.push({turn:index+1,action,before,after:state,phases:detail.phases});
 }
 return{world,initial,state,timeline,phases:timeline.flatMap(t=>t.phases.map(p=>({...p,turn:t.turn})))};
}
function branch(world,state,action){return stepDetailed(world,state,action.id,action.data);}
function byRole(world,state,role){return branch(world,state,{id:6,data:cellToPixel(state.heroes.find(h=>h.kind===role).at)}).state;}
function commandVariant(spec,commands){
 const world=compileLevel(spec);let state=initialState(world);const actions=[];
 for(const command of commands){const action=command==='C'?{id:6,data:cellToPixel(state.heroes[(state.active+1)%state.heroes.length].at)}:{id:{U:1,D:2,L:3,R:4,X:5}[command]};assert(action.id);const next=branch(world,state,action);assert(!next.state.failed&&!next.state.dead&&!state.complete);state=next.state;actions.push(action);}
 const checked=direct(spec,actions);assert(checked.state.complete);return{...checked,actions};
}

try{
 const previous=historicalLayouts(),terrainKeys=new Set();assert.equal(SS22_LEVELS.length,8);
 report.layoutComparison={historicalGames:Array.from({length:8},(_,i)=>`SS${14+i}`),historicalLevelCount:64,method:'Compare canonical wall/land/water silhouettes across translation, rotation and reflection',historical:previous};
 for(const[index,spec]of SS22_LEVELS.entries()){
  const n=index+1,design=JSON.parse(readFileSync(new URL(`reference/level${n}-design.json`,lab),'utf8'));assert.deepEqual(spec,design.spec,`SS22 N${n}: sync/build before reviewing`);
  const r=direct(spec,design.actions),{world,initial,state,timeline,phases}=r,events=kind=>phases.filter(p=>p.kind===kind),at=stage=>timeline[design.stages[stage].turn-1].after;
  assert.equal(world.goals.length,4);assert.equal(new Set(world.goals.map(key)).size,4);assert(!initial.complete&&!initial.dead);assert(initial.heroes.every(h=>!world.goals.some(g=>equal(g,h.at))));assert(state.complete);
  assert.equal(world.goals.filter(g=>timeline.at(-1).before.heroes.some(h=>equal(h.at,g))).length,3);
  const terrainSha256=canonicalTerrain(spec.rows),repeats=previous.filter(p=>p.terrainSha256===terrainSha256);assert.deepEqual(repeats,[],`${spec.id}: exact historical terrain repeat`);assert(!terrainKeys.has(terrainSha256),`${spec.id}: repeated new terrain`);terrainKeys.add(terrainSha256);
  const frozenWalking=initial.heroes.map(h=>walking(world,initial,h,false)),generousWalking=initial.heroes.map(h=>walking(world,initial,h,true)),assignment=maximumAssignment(generousWalking);assert(assignment<4,`${spec.id}: frozen walking alone assigns all four goals`);
  report.levels.push({level:n,title:spec.title,actions:design.actions.length,selections:design.actions.filter(a=>a.id===6).length,mapSha256:hash(spec),actionsSha256:hash(design.actions),terrainSha256,exactHistoricalRepeats:repeats,frozenWalking,generousWalking,maximumFrozenWalkingGoalAssignment:assignment,finalPositions:state.heroes.map(h=>({role:h.kind,at:h.at})),complete:true,refusedActions:0,deaths:0});
  ok(n,'Four living heroes reach four destinations',{actions:design.actions.length,goalCountBeforeLastAction:3,goalCountAfterLastAction:4,maximumFrozenWalkingGoalAssignment:assignment},'Direct numeric-action replay plus the stated frozen initial walking model.');

  if(n===1){
   const mixed=events('push').find(p=>p.before.heroes[p.before.active].kind==='warrior'&&p.moves.filter(m=>m.actor==='hero').length===2&&p.moves.filter(m=>m.actor==='stone').length===2);assert(mixed);
   const silent=phases.filter(p=>['push','pull'].includes(p.kind)&&p.moves.some(m=>m.actor==='hero'&&equal(m.from,p.before.heroes.find(h=>h.kind==='bard').at)));assert(silent.some(p=>p.kind==='push'));assert(silent.some(p=>p.kind==='pull'));
   for(const p of silent)assert.deepEqual(p.before.stones,p.after.stones);
   const fight=timeline.find(t=>t.phases.some(p=>p.kind==='piston')&&t.phases.some(p=>p.kind==='combat'));assert(fight);assert.equal(fight.before.monsters.length,2);assert.equal(fight.after.monsters.length,0);
   assert(phases.some(p=>p.moves.some(m=>m.actor==='support')));assert(events('reflect').some(p=>p.moves.some(m=>m.actor==='stone')));assert(events('reflect').some(p=>p.moves.some(m=>m.actor==='hero')));assert(circuitPressed(world,state,'sortie'));
   ok(n,'Teaching mechanisms have observable physical effects',{mixedFileTurn:mixed.turn,silentBardTransports:silent.map(p=>({turn:p.turn,kind:p.kind,moves:p.moves})),pressCombatTurn:fight.turn,supportMovementTurns:phases.filter(p=>p.moves.some(m=>m.actor==='support')).map(p=>p.turn),exitWeights:world.circuits.find(c=>c.id==='sortie').buttons},'The tutorial route demonstrates these mechanisms; demonstrations are not additional victory conditions.');
  }
  if(n===2){
   const firstStageTurn=design.stages[0].turn,pulses=events('song').filter(p=>p.turn<=firstStageTurn&&p.moves.some(m=>m.actor==='stone'));
   const resets=events('push').filter(p=>p.turn<=firstStageTurn&&p.before.heroes[p.before.active].kind==='warrior'&&p.moves.some(m=>m.actor==='hero'&&equal(m.from,p.before.heroes[3].at)));
   assert.equal(pulses.length,4);assert.equal(resets.length,4);
   for(const p of pulses){const movement=p.moves.find(m=>m.actor==='stone');assert.equal(movement.to.x,movement.from.x-1);assert.equal(movement.to.y,movement.from.y);}
   for(const p of resets){assert.deepEqual(p.before.stones,p.after.stones);assert.equal(p.after.heroes[3].at.x,p.before.heroes[3].at.x+1);}
   const selfReturn=branch(world,pulses[0].after,{id:4});assert(!selfReturn.state.failed&&!selfReturn.state.dead);assert.deepEqual(selfReturn.state.stones,pulses[0].before.stones);
   const prepared=at(0);assert(circuitPressed(world,prepared,'cadence'));assert(circuitPressed(world,state,'cadence'));assert(circuitPressed(world,state,'livraison'));
   assert(events('pull').some(p=>p.moves.some(m=>m.actor==='stone')));assert(events('push').some(p=>p.before.heroes[p.before.active].kind==='merchant'&&p.moves.some(m=>m.actor==='stone')));
   ok(n,'Repeated silent repositioning preserves the previous delivery step',{songTurns:pulses.map(p=>p.turn),warriorResetTurns:resets.map(p=>p.turn),voluntaryReturnRestoresInitialCratePosition:true,firstControlPrepared:true,finalWeights:state.stones},'Four observed cycles advance the freight while a direct sung return undoes its first step. The route does not claim the Warrior is the only possible source of forced transport.');
  }
  if(n===3){
   const before=at(1),own=branch(world,before,{id:2}),press=events('piston')[0];assert(own.phases.some(p=>p.kind==='pull'));assert(!circuitPressed(world,own.state,'sortie'));assert(press.moves.some(m=>m.actor==='hero'&&equal(m.from,{x:10,y:10})&&equal(m.to,{x:10,y:11})));assert(circuitPressed(world,press.after,'sortie'));
   ok(n,'The commanded release preserves the load',{voluntaryDepartureClosesExit:true,pressMoves:press.moves,weight:{x:10,y:9}});
   const commands='CRRLDDLLLLLLLCDDDDCCCUURRRRRRRRRDDDDCLLLDLLLLUUUUULLCCCUUUULLDDLLLLLDDDDDRRRRURRRUDCCULLDDDDLLLLDDDDDRRRRDDDDRRRRCCCRRDDDDDRRRRDDDDDDRRRRRCCDDDDRDDDDDRRRRDDDDLCLLLDDDDDDR';
   const alternative=commandVariant(spec,commands),pressCount=alternative.phases.filter(p=>p.kind==='piston').length;assert.equal(pressCount,0);assert(alternative.phases.some(p=>p.kind==='push'&&p.moves.some(m=>m.actor==='stone')&&p.moves.filter(m=>m.actor==='hero').length===2));assert.equal(alternative.actions.length,170);
   report.shortcutReview.push({level:n,candidate:'Bypass the command press by pushing the Thief and his crate with the Warrior.',result:'Legal alternative, longer than the authored route. The Warrior must restore the displaced load from the other side before leaving.',witnessActions:design.actions.length,alternativeActions:alternative.actions.length,pressPushes:pressCount,complete:true,refusedActions:0,deaths:0,commands,lesson:'The press is not universally necessary. Forced transport still suppresses the Thief ability; the alternative repairs the load explicitly. No walking-only shortcut was established.'});
  }
  if(n===4){
   const selected=byRole(world,initial,'bard'),wrong=branch(world,selected,{id:4});assert(!wrong.state.failed&&!wrong.state.dead);assert.equal(wrong.state.stones.length,0);assert.deepEqual(wrong.state.supports,[{x:9,y:10}]);
   const raised=branch(world,selected,{id:1}),correct=branch(world,raised.state,{id:4});assert(!correct.state.failed&&!correct.state.dead);assert.deepEqual(correct.state.stones,[{x:8,y:10}]);assert.equal(correct.state.monsters.length,0);assert.deepEqual(state.supports,[{x:16,y:15}]);
   ok(n,'Selecting the upper gallery preserves the dry reserve',{lowerSongSupport:wrong.state.supports,upperSongDryCrate:correct.state.stones,finalSupport:state.supports},'Comparison of two immediate branches; the separate middle review details the water-resource argument and the legal single-push variant.');
  }
  if(n===5){
   const loaded=at(4),cleared=at(5);assert(circuitPressed(world,loaded,'arrivee'));assert.deepEqual(loaded.stones,cleared.stones);assert(circuitPressed(world,cleared,'arrivee'));
   assert.deepEqual(state.stones,[{x:8,y:15},{x:8,y:3},{x:12,y:9}]);assert.equal(world.circuits.length,1);
   ok(n,'Three deliveries survive the upper departure',{weights:state.stones,bardAtDelivery:loaded.heroes[3].at,bardAfterDetour:cleared.heroes[3].at,gateOpenAfterDetour:true},'The lower-entry rescue variant remains legal and is independently recorded in the middle review; the upper route is not a hidden compulsory route.');
  }
  if(n===6){
   const freight=landComponent(world,initial.stones[0]);assert(initial.heroes.every(h=>!freight.has(key(h.at))));assert(world.circuits.find(c=>c.id==='livraison').buttons.every(p=>freight.has(key(p))));assert.equal(world.mirrors.length,0);assert.equal(world.platforms.length,0);
   const press=events('piston');assert.equal(press.length,1);assert.deepEqual(press[0].moves,[{actor:'stone',from:{x:7,y:12},to:{x:8,y:12}}]);
   assert.deepEqual(state.stones,[{x:12,y:12}]);assert.deepEqual(state.monsters,[{x:13,y:12}]);assert(circuitPressed(world,state,'livraison'));
   const delivered=at(4),preserved=at(5);assert.deepEqual(delivered.stones,preserved.stones);assert.deepEqual(delivered.monsters,preserved.monsters);
   ok(n,'The freight street is worked from outside',{freightLandCells:freight.size,noHeroInitiallyInFreight:true,pressTurn:press[0].turn,pressMoves:press[0].moves,finalCrate:state.stones[0],finalMonster:state.monsters[0],weightsPreservedOnDeparture:true},'The land-component test ignores device closures and still separates every hero from the freight street. No mirror or swap ability provides an alternate entrance.');
   report.shortcutReview.push({level:n,candidate:'Walk a hero onto a freight button instead of delivering the crate.',result:'The freight land component contains both buttons but no starting hero and no adjoining land path from the pedestrian network. With no mirror or swap ability, walking cannot substitute a hero for the delivered load.',freightLandCells:freight.size,limit:'This does not establish an optimal schedule of songs or presses.'});
  }
  if(n===7){
   assert.equal(initial.supports.length,2);assert.equal(initial.stones.length,0);assert.equal(state.supports.length,2);
   for(const p of phases)for(const m of p.moves.filter(m=>m.actor==='support')){assert.equal(terrainAt(world,m.from),'~');assert.equal(terrainAt(world,m.to),'~');assert(p.before.heroes.every(h=>!equal(h.at,m.from)),'A moved support must be unoccupied');}
   const stepped=at(2),column=at(3),aligned=at(4);assert.deepEqual(stepped.supports,[{x:9,y:9},{x:10,y:12}]);assert.deepEqual(column.supports,[{x:10,y:13},{x:10,y:14}]);assert.deepEqual(aligned.supports,[{x:9,y:13},{x:10,y:13}]);
   assert.deepEqual(state.supports,aligned.supports);assert(timeline.every(t=>t.after.supports.length===2));
   ok(n,'The empty supports change alignment without carrying passengers',{offsetPair:stepped.supports,verticalPair:column.supports,finalPair:aligned.supports,supportMoves:phases.flatMap(p=>p.moves).filter(m=>m.actor==='support').length,allMovedSupportsInitiallyUnoccupied:true});
  }
  if(n===8){
   const selected=byRole(world,initial,'thief'),first=branch(world,selected,{id:2}),tooSoon=branch(world,first.state,{id:2});assert(!first.state.failed);assert(tooSoon.state.failed&&!tooSoon.state.dead);
   assert.equal(initial.supports.length,3);assert.equal(initial.stones.length,1);assert.equal(state.supports.length,3);assert.equal(state.stones.length,1);assert(timeline.every(t=>t.after.stones.length===1&&t.after.supports.length===3));
   const deposited=at(0),bridge=at(1);assert(deposited.supports.some(p=>equal(p,{x:9,y:6})));assert.deepEqual(bridge.supports,[{x:14,y:13},{x:15,y:13},{x:9,y:6}]);
   const relay=events('push').find(p=>p.moves.some(m=>m.actor==='hero'&&equal(m.from,{x:6,y:13}))&&p.moves.some(m=>m.actor==='stone'&&equal(m.to,{x:6,y:13})));assert(relay);assert(circuitPressed(world,relay.before,'retour'));assert(circuitPressed(world,relay.after,'retour'));assert(platformActive(world,relay.before,0));assert(platformActive(world,relay.after,0));assert(!relay.before.gateClosed[0]&&!relay.after.gateClosed[0]);
   assert.deepEqual(state.stones,[{x:6,y:13}]);assert(circuitPressed(world,state,'retour'));
   ok(n,'A deposited support enables the return and a continuous handover frees the keeper',{earlyReturnRefusedAt:first.state.heroes[2].at,depositedReturnSupport:{x:9,y:6},finalTraverse:bridge.supports.filter(p=>p.x>9),handoverTurn:relay.turn,handoverMoves:relay.moves,gateAndPlatformRemainActive:true,dryReservePreserved:true});
  }
 }
 report.success=true;
}catch(error){report.error=error.stack;process.exitCode=1;}
writeFileSync(new URL('reference/independent-ss22-review.json',lab),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({success:report.success,levels:report.levels.length,checks:report.checks.length,historicalLevels:report.layoutComparison?.historicalLevelCount,shortcutReviews:report.shortcutReview.length,error:report.error}));
