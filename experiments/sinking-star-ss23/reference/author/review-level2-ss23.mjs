/** Local causal checks for the dry 3×3 cargo grid; author tooling only. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {Author} from './author.mjs';
import {build,spec as makeSpec} from './build-level2.mjs';
import {QuartetPuzzleSession,equal} from '../../dist/core.js';
import {replay} from '../../scripts/solver.mjs';

const d=JSON.parse(readFileSync(new URL('../level2-design.json',import.meta.url),'utf8'));
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const checks=[];
const record=(name,observed,scope='Contre-branche locale rejouée ; aucune optimalité, unicité ou impossibilité globale revendiquée.')=>checks.push({level:2,name,status:'passed',observed,scope});
const author=build(),point=(x,y)=>author.point(x,y),hero=(state,kind)=>state.heroes.find(h=>h.kind===kind);
const places=state=>({heroes:state.heroes.map(h=>({kind:h.kind,at:h.at,dead:!!h.dead})),stones:state.stones,monsters:state.monsters,mirrors:state.mirrors,supports:state.supports});
const atStage=index=>new Author(d.spec).act(d.commands.slice(0,d.stages[index].turn));
assert.deepEqual(d.spec,makeSpec());assert.equal(author.commands,d.commands);assert.deepEqual(author.stages,d.stages);
const route=replay(d.spec,d.commands),phases=route.trace.flatMap(turn=>turn.phases);
assert.equal(route.state.complete,true);assert.equal(route.metrics.blocked,0);assert.equal(route.metrics.deaths,0);
assert.deepEqual(route.metrics,d.metrics);assert.deepEqual(route.actions,d.actions);
assert.equal(route.world.stones.length,9);assert.equal(route.world.goals.length,4);
assert.equal(route.world.terrain.filter(c=>c==='~').length,0);
for(const name of ['monsters','mirrors','supports','buttons','doors','gates','platforms','circuits'])assert.equal(route.world[name].length,0,name);
for(const turn of route.trace){assert.equal(turn.before.stones.length,9);assert.equal(turn.after.stones.length,9);}
record('Témoin complet : sas sec, neuf charges conservées et quatre destinations',route.metrics,'Rejeu exact de la carte et des commandes sauvegardées, sans mécanisme ajouté au contrat MWZB.');

{
 const session=new QuartetPuzzleSession([d.spec]);let frames=0,beforeLast,lastObservation;
 for(const action of d.actions){beforeLast=session.observe();lastObservation=session.action(action.id,action.data);frames+=lastObservation.frames.length;assert.deepEqual(lastObservation.frames.at(-1),lastObservation.frame);assert.equal(lastObservation.frameDurationsMs.length,lastObservation.frames.length);}
 assert.equal(lastObservation.state,'WIN');assert.deepEqual(session.undo(),beforeLast);
 const last=d.actions.at(-1);assert.deepEqual(session.action(last.id,last.data),lastObservation);
 record('Victoire publique, images et Undo exacts',{actions:d.actions.length,frames,finalState:'WIN',completionUndo:true},'Une session publique, sans carte privée dans les observations ; témoin d’auteur, pas une résolution autonome SRA.');
}

{
 const first=replay(d.spec,'CCR');assert.equal(first.metrics.swaps,1);assert.equal(first.metrics.wizardStoneSwaps,1);
 assert.deepEqual(hero(first.state,'wizard').at,point(5,5));
 for(const p of [point(3,5),point(6,5),point(7,5)])assert(first.state.stones.some(q=>equal(p,q)));
 record('La caisse proche arrête le rayon',{commands:'CCR',wizard:hero(first.state,'wizard').at,nearCrateReplacedOrigin:true,twoFartherCratesStillPresent:true});
 const initialTransfer=atStage(0),blocked=initialTransfer.select('warrior').go(3,4).act('DR');
 const before=blocked.state,attempt=replay(d.spec,blocked.commands+'R');
 assert.equal(attempt.state.failed,true);assert.deepEqual(places(attempt.state),places(before));
 const shifted=atStage(1).go(5,5,'warrior');assert.deepEqual(shifted.hero.at,point(5,5));
 record('Sans le désalignement inférieur, la file frontale rencontre sa butée',{refusedCommands:blocked.commands+'R',blockedFrontRow:[point(5,5),point(6,5),point(7,5)],wall:point(8,5),afterSongWalkingCommands:shifted.commands,afterSongWarrior:shifted.hero.at});
}

{
 const afterFirst=replay(d.spec,d.commands.slice(0,d.stages[0].turn));
 const afterSong=replay(d.spec,d.commands.slice(0,d.stages[1].turn));
 const song=afterSong.trace.at(-1).phases.find(p=>p.kind==='song');assert(song);
 assert(song.moves.some(m=>m.actor==='hero'&&equal(m.from,hero(afterFirst.state,'warrior').at)));
 assert(song.moves.some(m=>m.actor==='stone'&&equal(m.from,point(5,5))&&equal(m.to,point(5,6))));
 assert(song.moves.some(m=>m.actor==='stone'&&equal(m.from,point(6,5))&&equal(m.to,point(6,6))));
 assert(!song.moves.some(m=>m.actor==='stone'&&m.from.x===point(7,5).x));
 const carriedWizard=phases.filter(p=>p.kind==='push'&&p.moves.some(m=>m.actor==='hero'&&equal(m.from,hero(p.before,'wizard').at)));
 assert.equal(carriedWizard.length,2);
 record('Portée initiale et pouvoirs passifs',{songMoves:song.moves,rightColumnOutsideRange:true,warriorPushesCarryingWizard:carriedWizard.length},'La portée est mesurée avant le pas. Le Guerrier chanté et le Magicien poussé ne déclenchent pas leur capacité.');
}

{
 const parked=atStage(4),positioned=atStage(5);
 assert.deepEqual(parked.state.stones,positioned.state.stones);
 const sixPushes=route.trace.slice(d.stages[4].turn,d.stages[5].turn).flatMap(t=>t.phases).filter(p=>p.kind==='push');
 assert.equal(sixPushes.length,6);
 for(const phase of sixPushes){assert.equal(phase.before.heroes[phase.before.active].kind,'merchant');assert.equal(phase.moves.length,2);assert(phase.moves.some(m=>m.actor==='hero'&&equal(m.from,hero(phase.before,'bard').at)));}
 const ownStep=parked.select('bard').act('U');
 assert(!ownStep.state.stones.some(p=>equal(p,point(3,6))));assert(ownStep.state.stones.some(p=>equal(p,point(3,5))));
 record('Pousser le Barde conserve la grille ; son propre pas déplace une charge',{silentCommands:d.commands.slice(0,d.stages[5].turn),merchantPushes:6,voluntaryCommands:ownStep.commands,shiftedCrate:{from:point(3,6),to:point(3,5)}});
}

{
 const centre=atStage(5).select('bard'),up=replay(d.spec,centre.commands+'U');
 assert.equal(up.state.failed,true);assert.deepEqual(places(up.state),places(centre.state));
 const rightUp=replay(d.spec,centre.commands+'RU');assert.equal(rightUp.state.failed,false);assert.equal(rightUp.metrics.blocked,0);
 assert.deepEqual(hero(rightUp.state,'bard').at,point(6,4));
 const variant=structuredClone(d.spec),rows=variant.rows.map(row=>[...row]);rows[2][6]='#';variant.rows=rows.map(row=>row.join(''));
 const narrowed=replay(variant,centre.commands+'R'),refused=replay(variant,centre.commands+'RU');
 assert.equal(narrowed.state.failed,false);assert.equal(narrowed.metrics.blocked,0);assert.equal(refused.state.failed,true);
 assert.deepEqual(places(refused.state),places(narrowed.state));
 record('Décaler avant de monter, avec une case haute libre',{immediateUpCommands:centre.commands+'U',immediateUpRefused:true,rightUpCommands:centre.commands+'RU',rightUpBard:hero(rightUp.state,'bard').at,narrowedCell:{x:6,y:2},narrowedMapSha256:hash(variant),narrowedUpRefused:true},'Le même préfixe est légal dans les deux géométries. Fermer une seule case bloque ce mouvement local, sans preuve d’impossibilité de toutes les autres routes.');
}

{
 const alternate=atStage(6).go(10,2,'wizard').go(12,3,'merchant');
 const result=replay(d.spec,alternate.commands);assert(result.state.complete);assert.equal(result.metrics.blocked,0);assert.equal(result.metrics.deaths,0);assert.equal(result.state.stones.length,9);
 assert.deepEqual(hero(result.state,'wizard').at,point(10,2));assert.deepEqual(hero(result.state,'merchant').at,point(12,3));
 record('Variante gagnante : deux arrivées sont échangées',{commands:alternate.commands,actions:result.metrics.actions,swappedFinalRoles:['merchant','wizard'],finalState:'WIN'},'Les destinations sont communes. Cette variante ne revendique ni le parcours le plus court ni un unique ordre des phases.');
}

const report={game:'SS23',success:true,levels:[2],method:'Rejeu public et mécanique du témoin, cinq comparaisons causales locales et une variante gagnante, sans recherche exhaustive.',mapSha256:hash(d.spec),witnessSha256:hash(d.actions),checks,limits:['Le plan est une adaptation de Heroes of Hauling 11, pas une reproduction exacte.','Les refus locaux ne prouvent pas une impasse définitive ou une capacité globalement nécessaire.','Aucune optimalité ni résolution autonome SRA démontrée.']};
writeFileSync(new URL('../level2-ss23-review.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({success:true,checks:checks.length,passed:checks.length,report:'reference/level2-ss23-review.json'}));
