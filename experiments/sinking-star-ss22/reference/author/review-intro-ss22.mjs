/** Reproducible teaching checks and local counter-branches, without search. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {Author} from './author.mjs';
import {QuartetPuzzleSession,circuitPressed,equal} from '../../dist/core.js';
import {lessonIds,observeLesson} from '../../dist/tutorial.js';
import {replay} from '../../scripts/solver.mjs';
const load=n=>JSON.parse(readFileSync(new URL(`../level${n}-design.json`,import.meta.url)));
const checks=[];
const record=(level,name,observed,scope='Branche locale rejouée ; aucune solution unique ou optimale revendiquée.')=>checks.push({level,name,status:'passed',observed,scope});
for(const n of [1,2]){
 const d=load(n),r=replay(d.spec,d.commands);
 assert(r.state.complete);assert.equal(r.metrics.blocked,0);assert.equal(r.metrics.deaths,0);assert.deepEqual(r.metrics,d.metrics);
 record(n,'Témoin complet sans refus ni décès',r.metrics);
}
{
 const d=load(1),session=new QuartetPuzzleSession([d.spec]),learned=new Set();
 for(const action of d.actions){const before=session.observe(),after=session.action(action.id,action.data);observeLesson(learned,before,after,action.id);}
 assert.equal(session.observe().state,'WIN');assert.deepEqual([...learned].sort(),[...lessonIds].sort());
 record(1,'33 découvertes par les observations publiques',{acquired:learned.size,lessons:[...lessonIds]},'Le détecteur ne reçoit que les images, leurs séquences et les commandes publiques du tutoriel.');
 const r=replay(d.spec,d.commands),phases=r.trace.flatMap(t=>t.phases);
 const forcedBard=phases.filter(p=>['push','pull'].includes(p.kind)&&p.moves.some(m=>m.actor==='hero'&&equal(m.from,p.before.heroes[3].at)));
 assert(forcedBard.some(p=>p.kind==='push'));assert(forcedBard.some(p=>p.kind==='pull'));
 for(const p of forcedBard){assert.deepEqual(p.after.stones,p.before.stones);assert.deepEqual(p.after.supports,p.before.supports);}
 record(1,'Pousser ou tirer le Barde ne chante pas',{forcedMoves:forcedBard.length,causes:[...new Set(forcedBard.map(p=>p.kind))],loadsPreserved:true});
 const mixed=phases.find(p=>p.kind==='push'&&p.moves.length===4);assert(mixed);assert.equal(mixed.before.heroes[mixed.before.active].kind,'warrior');
 record(1,'La file du Guerrier contient deux caisses et un partenaire',{moves:mixed.moves});
 const press=phases.find(p=>p.kind==='piston'&&p.moves.some(m=>m.actor==='monster'));assert(press);assert.equal(r.state.monsters.length,0);assert.equal(r.metrics.monstersRemoved,2);
 record(1,'Presse et rencontre des deux gardiens',{pressMoves:press.moves,monstersRemoved:r.metrics.monstersRemoved});
 const slide=phases.find(p=>p.moves.some(m=>m.actor==='support'));assert(slide);assert.equal(slide.kind,'song');
 for(const m of slide.moves.filter(m=>m.actor==='support'))assert(!slide.before.heroes.some(h=>equal(h.at,m.from)));
 record(1,'Le témoin déplace un appui vide',{moves:slide.moves.filter(m=>m.actor==='support')});
}
{
 const d=load(2),first=new Author(d.spec).select('bard').act('L');
 assert(first.state.stones.some(p=>equal(p,first.point(8,6))));
 const returns=replay(d.spec,first.commands+'R');
 assert.equal(returns.metrics.blocked,0);assert(returns.state.stones.some(p=>equal(p,first.point(9,6))));
 assert(!circuitPressed(returns.world,returns.state,'cadence'));
 record(2,'Le retour volontaire annule la course chantée',{commands:first.commands+'R',crateBefore:first.point(9,6),crateAfter:returns.state.stones.find(p=>p.y===first.point(9,6).y)},'Contre-branche depuis le premier pas ; elle montre une perte de progression, pas une impasse globale.');
 const cannotContinue=replay(d.spec,first.commands+'L');assert.equal(cannotContinue.metrics.blocked,1);
 record(2,'La course volontaire est trop courte pour atteindre le bouton',{commands:first.commands+'L',refused:cannotContinue.metrics.blocked},'Le Guerrier et la butée ferment le deuxième pas à gauche dans cet état précis.');
 first.select('warrior').act('R');assert(first.state.stones.some(p=>equal(p,first.point(8,6))));assert(equal(first.state.heroes[3].at,first.point(8,8)));
 record(2,'Le replacement imposé conserve la progression',{commands:first.commands,bard:first.state.heroes[3].at,freight:first.point(8,6)});
 const cadence=replay(d.spec,d.commands.slice(0,d.stages[0].turn));assert(circuitPressed(cadence.world,cadence.state,'cadence'));assert.equal(cadence.metrics.songStoneMoves,4);assert.equal(cadence.metrics.warriorPushes,4);
 record(2,'Quatre cycles déposent le fret sur sa commande',{turn:d.stages[0].turn,freight:cadence.state.stones,warriorPushes:4,sungCrateMoves:4});
 const alternate=new Author(d.spec).act(d.commands.slice(0,d.stages[3].turn));
 alternate.go(1,1,'bard').go(9,4,'thief').go(5,1,'merchant').go(1,4,'warrior');
 const result=replay(d.spec,alternate.commands);assert(result.state.complete);assert.equal(result.metrics.blocked,0);assert.equal(result.metrics.deaths,0);
 record(2,'Variante gagnante : le Guerrier arrive en dernier',{commands:alternate.commands,actions:result.metrics.actions},'Les poids restent en place ; les arrivées admettent plusieurs ordres.');
}
const report={game:'SS22',success:true,levels:[1,2],method:'Rejeu des témoins, images publiques, phases physiques et contre-branches locales sans solveur.',checks,limits:['Aucune optimalité ni unicité démontrée.','Les découvertes sont pédagogiques et ne constituent pas une condition cachée de victoire.']};
writeFileSync(new URL('../intro-ss22-review.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({success:true,checks:checks.length,passed:checks.length,report:'reference/intro-ss22-review.json'}));
