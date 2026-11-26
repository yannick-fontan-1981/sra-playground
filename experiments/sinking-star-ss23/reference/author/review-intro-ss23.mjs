/** Reproducible N1 teaching checks and local counter-branches; author tools only. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {Author} from './author.mjs';
import {QuartetPuzzleSession,circuitPressed,gateClosed,equal} from '../../dist/core.js';
import {lessonIds,observeLesson} from '../../dist/tutorial.js';
import {replay} from '../../scripts/solver.mjs';
const d=JSON.parse(readFileSync(new URL('../level1-design.json',import.meta.url)));
const checks=[];
const record=(name,observed,scope='Branche locale rejouée ; aucune solution unique ou optimale revendiquée.')=>checks.push({level:1,name,status:'passed',observed,scope});
const r=replay(d.spec,d.commands),phases=r.trace.flatMap(t=>t.phases);
assert(r.state.complete);assert.equal(r.metrics.blocked,0);assert.equal(r.metrics.deaths,0);assert.deepEqual(r.metrics,d.metrics);
record('Témoin complet sans refus ni décès',r.metrics);
{
 const session=new QuartetPuzzleSession([d.spec]),learned=new Set();
 for(const action of d.actions){const before=session.observe(),after=session.action(action.id,action.data);observeLesson(learned,before,after,action.id);}
 assert.equal(session.observe().state,'WIN');assert.deepEqual([...learned].sort(),[...lessonIds].sort());
 record('36 découvertes par les observations publiques',{acquired:learned.size,lessons:[...lessonIds]},'Le détecteur reçoit uniquement les images, leurs séquences et les commandes publiques du tutoriel.');
}
{
 const merchant=replay(d.spec,'R');assert.equal(merchant.metrics.blocked,1);assert.equal(merchant.metrics.stoneMoves,0);assert.equal(merchant.metrics.partnerMoves,0);
 const mixed=phases.find(p=>p.kind==='push'&&p.moves.length===5);assert(mixed);assert.equal(mixed.before.heroes[mixed.before.active].kind,'warrior');
 assert.equal(mixed.moves.filter(m=>m.actor==='hero').length,4);assert.equal(mixed.moves.filter(m=>m.actor==='stone').length,1);
 record('La file initiale demande la poussée du Guerrier',{merchantRefused:1,warriorMoves:mixed.moves},'Comparaison de la même file initiale : trois partenaires et une caisse devant le Guerrier.');
 const first=phases.find(p=>p.kind==='swap');assert(first);assert.equal(first.moves.filter(m=>m.actor==='stone').length,0);assert.deepEqual(first.before.stones,first.after.stones);
 assert(first.moves.some(m=>equal(m.from,first.before.heroes.find(h=>h.kind==='bard').at)));
 record('La première cible intercepte le rayon',{moves:first.moves,fartherCratePreserved:true});
}
{
 const forcedBard=phases.filter(p=>['push','swap'].includes(p.kind)&&p.moves.some(m=>m.actor==='hero'&&equal(m.from,p.before.heroes.find(h=>h.kind==='bard').at)));
 assert(forcedBard.some(p=>p.kind==='push'));assert(forcedBard.some(p=>p.kind==='swap'));
 // The initial mixed push moves a crate mechanically; a single-partner push and every swap do not sing.
 const silent=forcedBard.filter(p=>p.kind==='swap'||p.moves.length===2);
 for(const p of silent){assert.deepEqual(p.before.stones,p.after.stones);assert.deepEqual(p.before.supports,p.after.supports);assert.deepEqual(p.before.monsters,p.after.monsters);}
 record('Pousser ou échanger le Barde ne chante pas',{checked:silent.length,causes:[...new Set(silent.map(p=>p.kind))],neighbouringPiecesPreserved:true});
 const sungWizard=phases.find(p=>p.kind==='song'&&p.moves.some(m=>m.actor==='hero'&&equal(m.from,p.before.heroes.find(h=>h.kind==='wizard').at)));
 assert(sungWizard);const wizardMove=sungWizard.moves.find(m=>equal(m.from,sungWizard.before.heroes.find(h=>h.kind==='wizard').at));
 assert.equal(Math.abs(wizardMove.to.x-wizardMove.from.x)+Math.abs(wizardMove.to.y-wizardMove.from.y),1);
 record('Le Magicien entraîné par le chant ne lance pas de sort',{wizardMove,phase:'song'});
 const prefix=d.commands.slice(0,d.stages[11].turn),back=new Author(d.spec).act(prefix).select('bard').act('L');
 assert.notDeepEqual(back.state.stones,sungWizard.after.stones);
 const silentExit=replay(d.spec,d.commands.slice(0,d.stages[12].turn));assert.deepEqual(silentExit.state.stones,sungWizard.after.stones);
 record('Un pas de retour volontaire altère le groupe ; l’échange préserve son placement',{returnCommands:back.commands,silentExitCommands:d.commands.slice(0,d.stages[12].turn),returnedCrates:back.state.stones,preservedCrates:silentExit.state.stones});
}
{
 const slides=phases.filter(p=>p.moves.some(m=>m.actor==='support'));assert.equal(slides.length,2);
 for(const p of slides){assert.equal(p.kind,'song');for(const m of p.moves.filter(m=>m.actor==='support')){assert(!p.before.heroes.some(h=>equal(h.at,m.from)));assert(!p.after.heroes.some(h=>equal(h.at,m.from)));}}
 const landing=slides[1],bard=landing.after.heroes.find(h=>h.kind==='bard');
 assert(landing.before.supports.some(p=>equal(p,bard.at)));assert(landing.after.supports.some(p=>equal(p,bard.at)));
 assert(!landing.moves.some(m=>m.actor==='support'&&equal(m.from,bard.at)));
 record('Le prochain appui du Barde reste ancré',{landing:bard.at,supportMoves:slides.flatMap(p=>p.moves.filter(m=>m.actor==='support'))},'Aucun appui déplacé ne transporte un passager ; la case d’arrivée du Barde est protégée.');
 const waterSwap=replay(d.spec,d.commands.slice(0,d.stages[8].turn));assert.deepEqual(waterSwap.state.supports,landing.after.supports);
 record('Un échange au-dessus de l’eau conserve les appuis',{supports:waterSwap.state.supports,swap:waterSwap.trace.at(-1).phases.find(p=>p.kind==='swap').moves});
}
{
 const press=phases.find(p=>p.kind==='piston'&&p.moves.some(m=>m.actor==='monster'));assert(press);assert.equal(r.state.monsters.length,0);assert.equal(r.metrics.monstersRemoved,4);
 record('Presse et chant provoquent deux rencontres de gardiens',{pressMoves:press.moves,monstersRemoved:4},'Deux paires distinctes se rencontrent ; la sortie ne dépend pas d’un compteur de monstres éliminés.');
 const reflected=phases.filter(p=>p.kind==='reflect');assert.equal(reflected.length,2);assert(reflected[0].moves.every(m=>m.actor==='stone'));assert(reflected[1].moves.some(m=>m.actor==='hero'));assert.equal(r.metrics.bentSwaps,1);
 record('Reflet à distance égale et rayon dévié sont distincts',{reflectionPhases:2,bentWizardSwaps:1,moves:reflected.map(p=>p.moves)});
 const off=new Author(d.spec).act(d.commands.slice(0,d.stages[3].turn)).go(4,3,'merchant').act('UR');
 assert(!circuitPressed(off.world,off.state,'sortie'));assert(gateClosed(off.world,off.state,0));assert(!off.state.dead);
 record('Retirer le poids referme la sortie',{commands:off.commands,doorClosed:true,dead:false},'Contre-branche locale sur la commande ; aucune impasse définitive affirmée.');
}
{
 const alternate=new Author(d.spec).act(d.commands.slice(0,d.stages[16].turn));
 alternate.go(18,17,'bard').go(16,14,'warrior').go(18,14,'merchant').go(16,17,'wizard');
 const result=replay(d.spec,alternate.commands);assert(result.state.complete);assert.equal(result.metrics.blocked,0);assert.equal(result.metrics.deaths,0);
 record('Variante gagnante : deux arrivées sont permutées',{commands:alternate.commands,actions:result.metrics.actions},'Les quatre arrivées sont communes et non affectées à une identité de héros.');
}
const report={game:'SS23',success:true,levels:[1],method:'Rejeu du témoin, observations publiques, phases physiques et contre-branches locales sans recherche exhaustive.',checks,limits:['Aucune optimalité ni unicité démontrée.','Les 36 découvertes enseignent les règles et ne constituent pas une condition cachée de victoire.']};
writeFileSync(new URL('../intro-ss23-review.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({success:true,checks:checks.length,passed:checks.length,report:'reference/intro-ss23-review.json'}));
