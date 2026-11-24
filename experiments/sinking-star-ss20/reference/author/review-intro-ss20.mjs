/** Public tutorial proof and exact local branches; never shipped to players. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {TrioPuzzleSession,stepDetailed,circuitPressed,equal} from '../../dist/core.js';
import {lessonIds,observeLesson} from '../../dist/tutorial.js';
import {Author} from './author.mjs';
import {replay,decodeCommand} from '../../scripts/solver.mjs';

const designs=[1,2].map(n=>JSON.parse(readFileSync(new URL(`../level${n}-design.json`,import.meta.url))));
const checks=[];
const ok=(level,name,observed,scope='Branche exacte rejouée ; aucune unicité ni difficulté optimale revendiquée.')=>checks.push({level,name,status:'passed',observed,scope});
const stage=(d,text)=>{const s=d.stages.find(s=>s.label.includes(text));assert(s,text);return replay(d.spec,d.commands.slice(0,s.turn));};
const next=(r,c)=>{const a=decodeCommand(c,r.state);return stepDetailed(r.world,r.state,a.id,a.data);};
for(const [i,d]of designs.entries()){
 const r=replay(d.spec,d.commands);assert(r.state.complete);assert.equal(r.metrics.blocked,0);assert.equal(r.metrics.deaths,0);
 ok(i+1,'Témoin gagnant et métriques recalculées',r.metrics);
}
{
 const d=designs[0],session=new TrioPuzzleSession([d.spec]),learned=new Set(),discoveries=[];
 for(const [i,action]of d.actions.entries()){
  const before=session.observe(),seen=new Set(learned),after=session.action(action.id,action.data);
  observeLesson(learned,before,after,action.id);
  const added=[...learned].filter(x=>!seen.has(x));if(added.length)discoveries.push({turn:i+1,action:action.id,lessons:added});
 }
 assert.equal(session.observe().state,'WIN');assert.deepEqual(lessonIds.filter(x=>!learned.has(x)),[]);
 ok(1,'Les trente découvertes sont lues dans les images publiques',{count:learned.size,discoveries},'Parcours pédagogique complet depuis N1 ; le jeu ne charge ni témoin ni état privé pour afficher les découvertes.');
 const pressed=stage(d,'Le bouton violet'),phases=pressed.trace.at(-1).phases;
 assert(phases.some(p=>p.kind==='piston'&&p.moves.some(m=>m.actor==='monster')));
 assert(phases.some(p=>p.kind==='combat'));assert.equal(pressed.state.monsters.length,0);
 ok(1,'La presse rapproche les gardiens avant leur contact',{phaseOrder:phases.map(p=>p.kind),monstersRemaining:0});
 const slid=stage(d,'décale l’appui'),anchored=stage(d,'le maintient');
 assert.deepEqual(slid.state.supports,[{x:15,y:13}]);assert.deepEqual(anchored.state.supports,slid.state.supports);
 assert(anchored.trace.at(-1).phases.some(p=>p.kind==='song'&&p.moves.some(m=>m.actor==='hero')));
 ok(1,'L’appui déplacé reste en place quand un héros l’occupe',{support:anchored.state.supports,heroes:anchored.state.heroes.map(h=>({kind:h.kind,at:h.at}))});
 const delivery=stage(d,'miroir déplacé');assert(delivery.state.stones.some(p=>equal(p,{x:16,y:9})));
 const extracted=stage(d,'extrait la caisse');assert(extracted.state.stones.some(p=>equal(p,{x:16,y:11})));
 ok(1,'La caisse réfléchie contre le mur est extraite par traction',{landing:{x:16,y:9},afterExtraction:{x:16,y:11},northWall:true});
}
{
 const d=designs[1],first=stage(d,'poids provisoire'),last=stage(d,'commande violette');
 assert(circuitPressed(first.world,first.state,'loading'));assert(!circuitPressed(first.world,first.state,'outside'));
 assert(!circuitPressed(last.world,last.state,'loading'));assert(circuitPressed(last.world,last.state,'outside'));
 ok(2,'La même caisse change de fonction',{first:first.state.stones,last:last.state.stones},'Deux étapes du témoin avec deux caisses conservées, dont une demeure inaccessible dans le jardin.');
 const early=new Author(d.spec);early.act('CDDR').go(6,5,'merchant').act('RR');
 assert(!circuitPressed(early.world,early.state,'loading'));assert.equal(early.state.gateClosed[0],true);
 assert.deepEqual(early.state.heroes.find(h=>h.kind==='bard').at,{x:17,y:4});
 ok(2,'Déplacer la relève avant de libérer le Barde referme son seul accès',{bard:early.state.heroes.find(h=>h.kind==='bard').at,gateClosed:early.state.gateClosed[0]},'Mauvais ordre réversible : le poids peut être réinstallé ; aucune impasse définitive n’est affirmée.');
 const charged=stage(d,'coursive'),bad=next(charged,'D');assert(!bad.state.dead&&!bad.state.failed);
 assert(!circuitPressed(charged.world,bad.state,'inside'));assert.equal(bad.state.gateClosed[3],true);
 const recovery=next({world:charged.world,state:bad.state},'U');assert(!recovery.state.dead&&!recovery.state.failed);
 assert(circuitPressed(charged.world,recovery.state,'inside'));assert.deepEqual(recovery.state.stones,charged.state.stones);
 ok(2,'Un pas du Barde retire le poids ; le pas inverse rétablit le circuit',{downCloses:true,upRestores:true},'Branche locale volontairement réversible. La victoire ne dépend d’aucun historique de déplacements.');
 const taken=stage(d,'prend le relais');assert.deepEqual(taken.state.stones,charged.state.stones);
 const segment=d.commands.slice(d.stages.find(s=>s.label.includes('coursive')).turn,d.stages.find(s=>s.label.includes('prend le relais')).turn);
 assert.equal(taken.state.heroes.find(h=>h.kind==='bard').at.x,8);
 ok(2,'Poussée puis traction amènent le Barde dans le jardin sans déplacer les charges',{commands:segment,bard:taken.state.heroes.find(h=>h.kind==='bard').at,stones:taken.state.stones});
 const w=charged.world;
 assert.equal(w.terrain[8*20+14],'#');assert.equal(w.terrain[10*20+14],'#');assert.equal(w.terrain[12*20+13],'#');
 assert.deepEqual(w.gates.filter(g=>g.circuit==='outside').map(g=>g.at),[{x:14,y:9},{x:14,y:11}]);
 ok(2,'La coursive ne comporte pas de troisième entrée libre',{closedSides:[{x:14,y:8},{x:14,y:10},{x:13,y:12}],controlledEntrances:w.gates.filter(g=>g.circuit==='outside').map(g=>g.at)},'Inspection du bord de la coursive ; complétée par le graphe de marche initial dans la revue de conception.');
}
const report={game:'SS20',success:true,levels:[1,2],checks,limits:['Les parcours prouvent la résolution, pas une solution minimale ou unique.','Les contre-exemples locaux sont des essais contrôlés, jamais des conditions cachées dans le moteur.']};
for(const [i,d]of designs.entries()){
 d.adaptation.localChecks=checks.filter(c=>c.level===i+1).map(({level,...check})=>check);
 writeFileSync(new URL(`../level${i+1}-design.json`,import.meta.url),JSON.stringify(d,null,2)+'\n');
}
writeFileSync(new URL('../intro-ss20-review.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({success:true,checks:checks.length,report:'reference/intro-ss20-review.json'}));
