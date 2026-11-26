/** Independent teaching and causal checks for N1; author tooling only. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {Author} from './author.mjs';
import {build,spec as makeSpec} from './build-level1.mjs';
import {QuartetPuzzleSession,initialState,stepDetailed,circuitPressed,gateClosed,equal} from '../../dist/core.js';
import {lessonIds,observeLesson} from '../../dist/tutorial.js';
import {replay,decodeCommand,stateKey} from '../../scripts/solver.mjs';

const d=JSON.parse(readFileSync(new URL('../level1-design.json',import.meta.url),'utf8'));
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const checks=[];
const record=(name,observed,scope='Comparaison locale rejouée ; aucune optimalité ou unicité revendiquée.')=>checks.push({level:1,name,status:'passed',observed,scope});
const author=build(),point=(x,y)=>author.point(x,y);
const hero=(state,kind)=>state.heroes.find(h=>h.kind===kind);
const places=state=>({heroes:state.heroes.map(h=>({kind:h.kind,at:h.at,dead:!!h.dead})),stones:state.stones,supports:state.supports,mirrors:state.mirrors,monsters:state.monsters});
const atStage=index=>new Author(d.spec).act(d.commands.slice(0,d.stages[index].turn));
assert.deepEqual(d.spec,makeSpec());assert.equal(author.commands,d.commands);assert.deepEqual(author.stages,d.stages);
const route=replay(d.spec,d.commands),phases=route.trace.flatMap(t=>t.phases);
assert(route.state.complete);assert.equal(route.metrics.blocked,0);assert.equal(route.metrics.deaths,0);assert.deepEqual(route.metrics,d.metrics);assert.deepEqual(route.actions,d.actions);
assert.equal(route.world.goals.length,4);assert.deepEqual(route.world.heroes.map(h=>h.kind),['merchant','thief','wizard','bard']);
record('Témoin complet sans refus ni décès',route.metrics,'Rejeu exact du JSON sauvegardé et comparaison avec le générateur d’auteur.');

{
 // The teaching detector receives a detached, explicit public projection only.
 const publicPart=o=>JSON.parse(JSON.stringify({level:o.level,frame:o.frame,frames:o.frames,levelsCompleted:o.levelsCompleted}));
 const session=new QuartetPuzzleSession([d.spec]),learned=new Set(),firstObservedAt={};
 let frames=0,beforeLast,lastObservation;
 for(let index=0;index<d.actions.length;index++){
  const action=d.actions[index],before=session.observe(),previous=new Set(learned);beforeLast=before;
  lastObservation=session.action(action.id,action.data);frames+=lastObservation.frames.length;
  assert.deepEqual(lastObservation.frames.at(-1),lastObservation.frame);assert.equal(lastObservation.frameDurationsMs.length,lastObservation.frames.length);
  observeLesson(learned,publicPart(before),publicPart(lastObservation),action.id);
  for(const id of learned)if(!previous.has(id))firstObservedAt[id]=index+1;
 }
 assert.equal(lastObservation.state,'WIN');assert.equal(lessonIds.length,37);assert.deepEqual([...learned].sort(),[...lessonIds].sort());
 assert.deepEqual(session.undo(),beforeLast);const last=d.actions.at(-1);assert.deepEqual(session.action(last.id,last.data),lastObservation);
 record('37 découvertes par les seules images publiques, puis victoire et Undo',{actions:d.actions.length,acquired:learned.size,lessons:[...lessonIds],firstObservedAt,frames,publicFields:['level','frame','frames','levelsCompleted'],finalState:'WIN',completionUndo:true},'Aucune position privée, carte d’auteur ou solution n’est passée au détecteur pédagogique. La session ne contient que cette carte.');
}

{
 const first=route.trace[d.stages[0].turn-1],pull=first.phases.find(p=>p.kind==='pull');assert(pull);
 assert(pull.moves.some(m=>m.actor==='stone'&&equal(m.from,point(4,3))&&equal(m.to,point(5,3))));
 assert(first.before.stones.some(p=>equal(p,point(3,3))));assert(first.after.stones.some(p=>equal(p,point(3,3))));
 assert.equal(pull.moves.filter(m=>m.actor==='stone').length,1);
 assert(circuitPressed(route.world,first.before,'relai'));assert(circuitPressed(route.world,first.after,'relai'));
 const relayGates=route.world.gates.map((g,i)=>({g,i})).filter(({g})=>g.circuit==='relai');assert.equal(relayGates.length,2);
 assert(relayGates.some(({g})=>equal(g.at,point(9,13))));assert(relayGates.some(({g})=>equal(g.at,point(18,9))));
 for(const {i} of relayGates)assert(!gateClosed(route.world,first.after,i));
 const leave=replay(d.spec,'CD');assert(!circuitPressed(leave.world,leave.state,'relai'));
 for(const {i} of relayGates)assert(gateClosed(leave.world,leave.state,i));
 record('Prise unique et relève de la commande pour les deux accès',{pull:pull.moves,secondCratePreserved:point(3,3),heldButton:point(5,3),relayGates:relayGates.map(({g})=>g.at),sideExitCommands:'CD',bothGatesCloseWithoutReplacement:true});
 const merchant=replay(d.spec,'R');assert(merchant.state.failed);assert.equal(merchant.metrics.blocked,1);assert.equal(merchant.metrics.stoneMoves,0);
 const afterPull=atStage(1);assert(afterPull.state.stones.some(p=>equal(p,point(4,3))));assert(afterPull.state.stones.some(p=>equal(p,point(5,3))));
 record('La poussée simple ne déplace pas les deux caisses initiales',{initialCommands:'R',initialPushRefused:true,afterSinglePullTurn:d.stages[1].turn,merchantPushesOneCrate:true});
}

{
 const matrix=[];
 for(let active=0;active<4;active++){
  const start=initialState(route.world);start.active=active;
  const queue=[start],seen=new Set([stateKey(start)]),goals=new Set();
  for(let index=0;index<queue.length;index++){
   const state=queue[index];for(let j=0;j<route.world.goals.length;j++)if(equal(state.heroes[active].at,route.world.goals[j]))goals.add(j);
   for(const command of 'UDLR'){
    const action=decodeCommand(command,state),detail=stepDetailed(route.world,state,action.id),next=detail.state;
    if(next.failed||next.dead||detail.phases.some(p=>!['walk','gate','platform'].includes(p.kind)||p.moves.some(m=>m.actor!=='hero'||!equal(m.from,state.heroes[active].at))))continue;
    const key=stateKey(next);if(seen.has(key))continue;seen.add(key);queue.push(next);
   }
  }
  matrix.push({kind:start.heroes[active].kind,states:seen.size,goals:[...goals].sort()});
 }
 assert.deepEqual(matrix.find(r=>r.kind==='thief').goals,[]);
 assert.deepEqual(matrix.find(r=>r.kind==='bard').goals,[]);
 record('Les quatre buts ne sont pas accessibles par quatre promenades isolées',{reachableGoalsWithOtherActorsFrozen:matrix,completeGoalAssignment:false},'Exploration finie des marches seules dans le vrai moteur, portes recalculées à chaque position ; tout déplacement d’un autre acteur et tout pouvoir sont exclus. Ce contrôle restreint ne cherche pas toutes les solutions coopératives.');
}

{
 const pushed=route.trace[d.stages[2].turn-1].phases.find(p=>p.kind==='push');assert(pushed);
 assert(pushed.moves.some(m=>m.actor==='hero'&&equal(m.from,hero(pushed.before,'wizard').at)));assert.deepEqual(pushed.before.stones,pushed.after.stones);
 const first=route.trace[d.stages[3].turn-1].phases.find(p=>p.kind==='swap');assert(first);
 assert(first.moves.some(m=>m.actor==='hero'&&equal(m.from,hero(first.before,'bard').at)));assert.deepEqual(first.before.stones,first.after.stones);assert(first.after.stones.some(p=>equal(p,point(8,7))));
 const pulled=route.trace[d.stages[4].turn-1].phases.find(p=>p.kind==='pull');assert(pulled);
 assert(pulled.moves.some(m=>m.actor==='hero'&&equal(m.from,hero(pulled.before,'bard').at)));assert.deepEqual(pulled.before.stones,pulled.after.stones);
 const voluntary=atStage(3).select('bard').act('R');assert.notDeepEqual(voluntary.state.stones,first.after.stones);
 const silent=atStage(4);assert.deepEqual(silent.state.stones,first.after.stones);
 record('La première cible arrête le rayon ; les transports de partenaires restent silencieux',{wizardPushTurn:d.stages[2].turn,firstSwapTurn:d.stages[3].turn,fartherCratePreserved:point(8,7),silentBardPullTurn:d.stages[4].turn,voluntaryBardCommands:voluntary.commands,voluntaryStoneMoves:replay(d.spec,voluntary.commands).trace.at(-1).phases.flatMap(p=>p.moves).filter(m=>m.actor==='stone')});
 const empty=route.trace[d.stages[5].turn-1];assert.equal(empty.phases.length,1);assert.equal(empty.phases[0].kind,'walk');assert.deepEqual(empty.before.stones,empty.after.stones);
 record('Le Magicien sans cible marche sans traction',{turn:d.stages[5].turn,moves:empty.phases[0].moves});
}

{
 const song=route.trace[d.stages[6].turn-1].phases.find(p=>p.kind==='song');assert(song);
 assert(song.moves.some(m=>m.actor==='stone'&&equal(m.from,point(2,5))&&equal(m.to,point(3,5))));
 assert(song.moves.some(m=>m.actor==='stone'&&equal(m.from,point(4,5))&&equal(m.to,point(5,5))));
 assert(song.before.stones.some(p=>equal(p,point(6,5))));assert(song.after.stones.some(p=>equal(p,point(6,5))));
 for(const kind of ['merchant','thief','wizard'])assert(song.moves.some(m=>m.actor==='hero'&&equal(m.from,hero(song.before,kind).at)));
 record('Portée diagonale, cloison, butée et partenaires passifs dans le même chant',{turn:d.stages[6].turn,moves:song.moves,interveningWall:point(4,6),retainedCrate:point(6,5),blockingWall:point(7,5)},'La portée est déterminée avant le pas. Les héros entraînés ne poussent, ne tirent et n’échangent pas avec un autre acteur.');
 const bank=route.trace[d.stages[7].turn-1].phases.find(p=>p.kind==='swap');assert(bank);assert.deepEqual(bank.before.stones,bank.after.stones);assert.deepEqual(bank.before.supports,bank.after.supports);
 record('L’échange installe la Barde au bassin sans faire suivre les charges',{turn:d.stages[7].turn,moves:bank.moves,stonesAndSupportsPreserved:true});
}

{
 const creation=route.trace[d.stages[8].turn-1];assert(!creation.after.stones.some(p=>equal(p,point(2,11))));assert(creation.after.supports.some(p=>equal(p,point(2,11))));
 const slides=phases.filter(p=>p.moves.some(m=>m.actor==='support'));assert.equal(slides.length,2);
 const supportMoves=slides.flatMap(p=>p.moves.filter(m=>m.actor==='support'));assert.equal(supportMoves.length,3);
 for(const phase of slides){assert.equal(phase.kind,'song');for(const move of phase.moves.filter(m=>m.actor==='support'))assert(!phase.before.heroes.some(h=>equal(h.at,move.from)));}
 const landing=route.trace[d.stages[10].turn-1].phases.find(p=>p.kind==='song');assert(landing);
 const landed=hero(landing.after,'bard').at;assert(landing.before.supports.some(p=>equal(p,landed)));assert(landing.after.supports.some(p=>equal(p,landed)));assert(!landing.moves.some(m=>m.actor==='support'&&equal(m.from,landed)));
 const occupied=route.trace[d.stages[12].turn-1].phases.find(p=>p.kind==='song');assert(occupied);
 const oldWizard=hero(occupied.before,'wizard').at;assert(occupied.before.supports.some(p=>equal(p,oldWizard)));assert(occupied.after.supports.some(p=>equal(p,oldWizard)));assert(!occupied.moves.some(m=>m.actor==='support'));
 const waterSwap=route.trace[d.stages[11].turn-1].phases.find(p=>p.kind==='swap');assert(waterSwap);assert.deepEqual(waterSwap.before.supports,waterSwap.after.supports);
 const unsupported=replay(d.spec,d.commands.slice(0,d.stages[10].turn)+'D');assert(unsupported.state.failed);assert.deepEqual(places(unsupported.state),places(atStage(10).state));
 record('Appui créé, appuis libres glissés et appuis occupés ou d’arrivée ancrés',{createdAt:point(2,11),supportMoves,bardLanding:landed,occupiedSupport:oldWizard,waterSwapTurn:d.stages[11].turn,waterSwapPreservesSupports:true,unsupportedCommands:d.commands.slice(0,d.stages[10].turn)+'D',unsupportedStepRefused:true});
}

{
 const press=route.trace[d.stages[9].turn-1],song=route.trace[d.stages[14].turn-1];
 assert(press.phases.some(p=>p.kind==='piston'&&p.moves.some(m=>m.actor==='monster')));assert(press.phases.some(p=>p.kind==='combat'));assert.equal(press.before.monsters.length-press.after.monsters.length,2);
 assert(song.phases.some(p=>p.kind==='song'&&p.moves.some(m=>m.actor==='monster')));assert(song.phases.some(p=>p.kind==='combat'));assert.equal(song.before.monsters.length-song.after.monsters.length,2);
 assert.equal(route.state.monsters.length,0);assert.equal(route.metrics.monstersRemoved,4);
 const approach=new Author(d.spec).go(14,2,'merchant'),unsafe=replay(d.spec,approach.commands+'R');assert(unsafe.state.dead);assert(unsafe.state.heroes.some(h=>h.dead));
 record('Presse et chant réunissent deux paires de gardiens à distance des héros',{pressTurn:d.stages[9].turn,pressMoves:press.phases.find(p=>p.kind==='piston').moves,songTurn:d.stages[14].turn,songMoves:song.phases.find(p=>p.kind==='song').moves,monstersRemoved:4,unsafeApproachCommands:approach.commands+'R',unsafeAdjacentHeroDies:true},'Les gardiens ne sont pas une ressource à éliminer par quota. La contre-branche reproduit le danger du contact orthogonal ; le témoin reste sans décès.');
}

{
 const reflected=phases.filter(p=>p.kind==='reflect');assert.equal(reflected.length,2);assert(reflected[0].moves.every(m=>m.actor==='stone'));assert(reflected[1].moves.some(m=>m.actor==='hero'));assert.equal(route.metrics.bentSwaps,1);
 const mirrorPull=route.trace[d.stages[18].turn-1].phases.find(p=>p.kind==='pull');assert(mirrorPull);
 assert(mirrorPull.moves.some(m=>m.actor==='mirror'&&equal(m.from,point(13,12))&&equal(m.to,point(13,13))));
 assert.deepEqual(mirrorPull.before.mirrors.map(m=>m.facing),mirrorPull.after.mirrors.map(m=>m.facing));
 record('Reflets, rayon dévié et traction du miroir restent distincts',{reflections:reflected.map(p=>p.moves),bentSwapTurn:d.stages[17].turn,mirrorPullTurn:d.stages[18].turn,orientationPreserved:true});
}

{
 const alternate=atStage(18).go(17,17,'bard').go(17,11,'merchant').go(11,17,'thief').go(11,11,'wizard');
 const result=replay(d.spec,alternate.commands);assert(result.state.complete);assert.equal(result.metrics.blocked,0);assert.equal(result.metrics.deaths,0);
 record('Variante gagnante : deux arrivées sont permutées',{commands:alternate.commands,actions:result.metrics.actions,swappedFinalRoles:['merchant','wizard'],finalState:'WIN'},'Les quatre destinations sont communes. La variante conserve les démonstrations du témoin et ne prétend pas être la route la plus courte.');
}

const report={game:'SS24',success:true,levels:[1],method:'Rejeu public et mécanique, 37 découvertes par pixels, contre-branches locales, exploration restreinte des marches et variante gagnante.',mapSha256:hash(d.spec),witnessSha256:hash(d.actions),checks,limits:['Les 37 découvertes sont pédagogiques et ne constituent pas une condition cachée de victoire.','Le témoin illustre les mécanismes ; il ne prouve pas que chacun soit indispensable à toute solution.','L’exploration des marches garde les autres acteurs fixes et ne recherche pas toutes les coopérations possibles.','Aucune optimalité, unicité ni résolution autonome SRA démontrée.']};
writeFileSync(new URL('../intro-ss24-review.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({success:true,checks:checks.length,passed:checks.length,actions:route.metrics.actions,lessons:lessonIds.length,report:'reference/intro-ss24-review.json'}));
