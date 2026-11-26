/** Independent local checks for N2. Author tooling; never imported by the game. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {Author} from './author.mjs';
import {build,spec as makeSpec} from './build-level2.mjs';
import {QuartetPuzzleSession,initialState,circuitPressed,gateClosed,equal} from '../../dist/core.js';
import {replay} from '../../scripts/solver.mjs';

const d=JSON.parse(readFileSync(new URL('../level2-design.json',import.meta.url),'utf8'));
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const checks=[];
const localScope='Contre-branche locale rejouée ; aucune optimalité, unicité ou impossibilité globale revendiquée.';
const record=(name,observed,scope=localScope)=>checks.push({level:2,name,status:'passed',observed,scope});
const author=build(),point=(x,y)=>author.point(x,y);
const hero=(state,kind)=>state.heroes.find(h=>h.kind===kind);
const places=state=>({heroes:state.heroes.map(h=>({kind:h.kind,at:h.at,dead:!!h.dead})),stones:state.stones,supports:state.supports,monsters:state.monsters,mirrors:state.mirrors});
const atStage=index=>new Author(d.spec).act(d.commands.slice(0,d.stages[index].turn));
assert.deepEqual(d.spec,makeSpec());assert.equal(author.commands,d.commands);assert.deepEqual(author.stages,d.stages);
const route=replay(d.spec,d.commands);
assert.equal(route.state.complete,true);assert.equal(route.metrics.blocked,0);assert.equal(route.metrics.deaths,0);
assert.deepEqual(route.metrics,d.metrics);assert.deepEqual(route.actions,d.actions);
assert.equal(route.world.goals.length,4);assert.equal(route.world.stones.length,2);
assert.equal(route.world.terrain.filter(c=>c==='~').length,0);
for(const name of ['monsters','mirrors','supports','platforms'])assert.equal(route.world[name].length,0,name);
assert.equal(route.world.circuits.length,1);assert.equal(route.world.gates.length,1);
record('Témoin complet : deux charges, un passage commandé et quatre arrivées',route.metrics,'Rejeu exact du JSON sauvegardé et comparaison avec le générateur d’auteur. La salle reste sèche, sans miroir, monstre ni combinaison de poids.');

{
 const session=new QuartetPuzzleSession([d.spec]);let frames=0,beforeLast,lastObservation;
 for(const action of d.actions){beforeLast=session.observe();lastObservation=session.action(action.id,action.data);frames+=lastObservation.frames.length;assert.deepEqual(lastObservation.frames.at(-1),lastObservation.frame);assert.equal(lastObservation.frameDurationsMs.length,lastObservation.frames.length);}
 assert.equal(lastObservation.state,'WIN');assert.deepEqual(session.undo(),beforeLast);
 const last=d.actions.at(-1);assert.deepEqual(session.action(last.id,last.data),lastObservation);
 record('Victoire publique et Undo de la dernière entrée',{actions:d.actions.length,frames,finalState:'WIN',completionUndo:true},'Session publique de cette carte seule ; témoin d’auteur, sans qualification de résolution autonome SRA.');
}

{
 const initial=initialState(route.world);assert(!circuitPressed(route.world,initial,'passage'));assert(gateClosed(route.world,initial,0));
 const approach=new Author(d.spec).go(8,10,'merchant'),refused=replay(d.spec,approach.commands+'L');
 assert(refused.state.failed);assert.deepEqual(places(refused.state),places(approach.state));
 const loaded=atStage(1);assert(circuitPressed(loaded.world,loaded.state,'passage'));assert(!gateClosed(loaded.world,loaded.state,0));
 assert(loaded.state.stones.some(p=>equal(p,point(12,9))));
 record('La commande ouvre l’unique liaison avec les arrivées',{closedApproachCommands:approach.commands+'L',closedAttemptRefused:true,weight:point(12,9),loadedTurn:d.stages[1].turn,gateOpen:true});

 const below=new Author(d.spec).select('thief').act('L').go(12,3,'merchant');
 const upward=replay(d.spec,below.commands+'U');assert(upward.state.failed);assert.deepEqual(places(upward.state),places(below.state));
 const first=atStage(0);assert(first.state.stones.some(p=>equal(p,point(12,7))));
 const pulls=route.trace.slice(0,d.stages[0].turn).flatMap(t=>t.phases).filter(p=>p.kind==='pull');
 assert.equal(pulls.length,5);assert(pulls.every(p=>p.moves.filter(m=>m.actor==='stone').length===1));
 record('La charge sous plafond est descendue par cinq prises uniques',{upwardPushCommands:below.commands+'U',upwardPushRefused:true,ceiling:point(12,1),pulls:5,loadAfterStair:point(12,7)},'La poussée vers ce plafond est impossible ; cette comparaison ne prétend pas exclure toute autre préparation latérale.');
}

{
 const weight=point(12,9),installed=atStage(3),released=atStage(4);
 const installPhase=route.trace[d.stages[3].turn-1].phases.find(p=>p.kind==='swap');assert(installPhase);
 assert(installPhase.moves.some(m=>m.actor==='hero'&&equal(m.from,hero(installPhase.before,'bard').at)));
 assert.deepEqual(installPhase.before.stones,installPhase.after.stones);assert(circuitPressed(installed.world,installed.state,'passage'));
 const pulls=route.trace.slice(d.stages[3].turn,d.stages[4].turn).flatMap(t=>t.phases).filter(p=>p.kind==='pull');
 assert.equal(pulls.length,3);
 for(const phase of pulls){assert(phase.moves.some(m=>m.actor==='hero'&&equal(m.from,hero(phase.before,'bard').at)));assert.deepEqual(phase.before.stones,phase.after.stones);}
 assert.deepEqual(installed.state.stones,released.state.stones);assert(released.state.stones.some(p=>equal(p,weight)));
 const voluntary=atStage(3).select('bard').act('L');assert(!circuitPressed(voluntary.world,voluntary.state,'passage'));assert(gateClosed(voluntary.world,voluntary.state,0));
 assert(voluntary.state.stones.some(p=>equal(p,point(11,9))));
 record('Échanger puis tirer la Barde préserve le poids ; son propre pas le déplace',{silentSwapTurn:d.stages[3].turn,silentPartnerPulls:3,weightPreserved:weight,voluntaryCommands:voluntary.commands,weightAfterVoluntaryStep:point(11,9),voluntaryGateClosed:true});
}

{
 const lower=atStage(5),beforeSong=route.trace[d.stages[5].turn-2],afterSong=route.trace[d.stages[5].turn-1];
 const song=beforeSong.phases.find(p=>p.kind==='song');assert(song);
 assert(song.moves.some(m=>m.actor==='stone'&&equal(m.from,point(6,10))&&equal(m.to,point(6,11))));
 assert(!afterSong.phases.some(p=>p.moves.some(m=>m.actor==='stone')));assert(lower.state.stones.some(p=>equal(p,point(6,11))));
 assert(circuitPressed(lower.world,lower.state,'passage'));
 record('Le chant agit à travers la cloison, puis la butée retient le bloc',{songTurn:d.stages[5].turn-1,stoneMove:{from:point(6,10),to:point(6,11)},wallBetween:point(7,9),nextStepTurn:d.stages[5].turn,blockedStoneDestination:point(6,12),weightPreserved:point(12,9)});
}

{
 const pulled=atStage(6),pulls=route.trace.slice(d.stages[5].turn,d.stages[6].turn).flatMap(t=>t.phases).filter(p=>p.kind==='pull');
 assert.equal(pulls.length,3);
 for(const phase of pulls){assert(phase.moves.some(m=>m.actor==='hero'&&equal(m.from,hero(phase.before,'wizard').at)));assert.deepEqual(phase.before.stones,phase.after.stones);}
 assert.deepEqual(hero(pulled.state,'wizard').at,point(12,7));assert(pulled.state.stones.some(p=>equal(p,point(12,9))));
 const voluntary=atStage(5).select('wizard').act('DD');
 assert.deepEqual(hero(voluntary.state,'wizard').at,point(12,9));assert(voluntary.state.stones.some(p=>equal(p,point(12,5))));
 assert(circuitPressed(voluntary.world,voluntary.state,'passage'));
 voluntary.act('L');assert(!circuitPressed(voluntary.world,voluntary.state,'passage'));assert(gateClosed(voluntary.world,voluntary.state,0));
 record('La traction du Magicien laisse le lest ; son propre rayon le reprend',{silentPartnerPulls:3,silentWizardAt:point(12,7),weightPreserved:point(12,9),voluntaryCommands:voluntary.commands,exchangedWeight:point(12,5),wizardTemporarilyHoldsButton:true,gateClosesAfterWizardLeaves:true},'Le premier rayon rencontre le Voleur. Le second échange avec le poids ; le Magicien maintient alors lui-même la commande jusqu’à son départ.');
}

{
 const approach=atStage(6).go(11,8,'wizard').go(6,10,'thief'),blocked=replay(d.spec,approach.commands+'D');
 assert(blocked.state.failed);assert.deepEqual(places(blocked.state),places(approach.state));
 const ranged=atStage(7);assert(ranged.state.stones.some(p=>equal(p,point(3,11))));assert(circuitPressed(ranged.world,ranged.state,'passage'));
 const finalPulls=route.trace.slice(d.stages[6].turn,d.stages[7].turn).flatMap(t=>t.phases).filter(p=>p.kind==='pull');
 assert.equal(finalPulls.length,3);assert(finalPulls.every(p=>p.moves.some(m=>m.actor==='stone')));
 record('Le bloc du bas demande un dégagement, pas une marche à travers',{refusedCommands:approach.commands+'D',blockedAt:point(6,11),finalStonePulls:3,reserve:point(3,11),buttonStillHeld:true});
}

{
 // An intentional, fully replayed alternative. It disproves any claim that the
 // wall-song or the final stone pull is globally mandatory in this geometry.
 const alternate=atStage(1).go(8,10,'merchant').act('LLLLLL').go(1,9).act('D').go(12,8);
 alternate.act(d.commands.slice(d.stages[1].turn,d.stages[6].turn));
 alternate.go(11,8,'wizard').go(2,10,'thief').go(4,8,'bard');
 alternate.go(8,10,'wizard').act('LUU').go(4,10,'thief').go(2,10,'merchant');
 const result=replay(d.spec,alternate.commands);assert(result.state.complete);assert.equal(result.metrics.blocked,0);assert.equal(result.metrics.deaths,0);assert.equal(result.metrics.songs,0);
 assert.equal(result.metrics.thiefPartnerPulls,6);assert.equal(result.metrics.swaps,3);assert(result.state.stones.some(p=>equal(p,point(12,9))));assert(result.state.stones.some(p=>equal(p,point(1,11))));
 const session=new QuartetPuzzleSession([d.spec]);for(const action of result.actions)session.action(action.id,action.data);assert.equal(session.observe().state,'WIN');
 record('Variante gagnante sans chant : le Marchand range le dernier bloc',{commands:alternate.commands,metrics:result.metrics,finalState:'WIN',lastBlockReserve:point(1,11),weightRemains:point(12,9),omitted:['chant à travers la cloison','traction du dernier bloc'],retained:['descente de la charge','maintien du passage','échanges de partenaires','tractions silencieuses de la Barde et du Magicien']},'Alternative conservée après revue : elle remplace le dégagement du dernier bloc, sans supprimer la charge ni le passage. Le chant n’est pas artificiellement imposé. Aucune unicité ni optimalité revendiquée.');
}

const report={game:'SS24',success:true,levels:[2],method:'Rejeu du témoin, sortie publique, comparaisons mécaniques locales et variante gagnante sans chant ; aucune recherche exhaustive.',mapSha256:hash(d.spec),witnessSha256:hash(d.actions),checks,limits:['La carte transpose le problème de Heroes of Hauling 6 sans reproduire exactement son plan.','Le chant à travers la cloison et la traction du dernier bloc ne sont pas globalement nécessaires : une variante publique gagnante en apporte la contrepreuve.','Les refus locaux ne prouvent pas une impasse définitive ni la nécessité globale de chaque pouvoir.','Aucune optimalité ni résolution autonome SRA démontrée.']};
writeFileSync(new URL('../level2-ss24-review.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({success:true,checks:checks.length,passed:checks.length,actions:route.metrics.actions,report:'reference/level2-ss24-review.json'}));
