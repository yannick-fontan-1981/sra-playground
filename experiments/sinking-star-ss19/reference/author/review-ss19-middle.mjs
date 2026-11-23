import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {Author} from './author.mjs';
import {replay} from '../../scripts/solver.mjs';
import {stepDetailed,circuitPressed,gateClosed} from '../../dist/core.js';
const root=new URL('../',import.meta.url);
const refs=[3,4,5].map(n=>JSON.parse(readFileSync(new URL(`level${n}-design.json`,root),'utf8')));
const checks=[];
const check=(name,fn)=>{const details=fn();checks.push({name,status:'passed',...details});};
const prefix=(d,label)=>d.commands.slice(0,d.stages.find(s=>s.label.includes(label)).turn);
const at=(ps,x,y)=>ps.some(p=>p.x===x&&p.y===y);
const input=(a,id)=>stepDetailed(a.world,a.state,id);
for(const d of refs)check(`${d.spec.id}: témoin complet`,()=>{
 const r=replay(d.spec,d.commands);assert.equal(r.state.complete,true);assert.equal(r.metrics.blocked,0);assert.equal(r.metrics.deaths,0);assert.equal(r.state.heroes.filter(h=>!h.dead).length,3);assert.equal(r.metrics.huntSteps,0);
 assert.deepEqual(r.metrics,d.metrics);return {actions:r.metrics.actions,selections:r.metrics.selections,monstersRemaining:r.state.monsters.length};
});
check('N3 : les commandes inoccupées refusent la sortie occidentale',()=>{
 const a=new Author(refs[0].spec);a.go(9,15,'warrior');const r=input(a,2);assert.equal(r.state.failed,true);assert.equal(r.state.complete,false);return {commands:a.commands+'D',observed:'La porte en 9,16 reste fermée tant que les deux réserves ne sont pas posées.'};
});
check('N3 : retirer le lest bas expulse le héros déjà arrivé',()=>{
 const d=refs[0],a=new Author(d.spec).act(prefix(d,'dernière inversion'));
 a.go(8,10,'warrior');const before=a.state;a.act('DR');
 assert.equal(circuitPressed(a.world,a.state,'charges'),false);assert.equal(at(a.state.stones,8,12),true);
 assert.equal(before.heroes.find(h=>h.kind==='wizard').at.y,7);assert.equal(a.state.heroes.find(h=>h.kind==='wizard').at.y,6);
 return {commands:a.commands,observed:'La caisse quitte 8,11 et la porte-poussoir de la destination 17,7 en retire le Magicien.'};
});
check('N4 : le chant dépose le gardien sur la trappe',()=>{
 const d=refs[1],r=replay(d.spec,prefix(d,'chant du Barde'));assert.equal(at(r.state.monsters,12,6),true);assert.equal(circuitPressed(r.world,r.state,'gardien'),false);assert.equal(r.metrics.songMonsterMoves,1);assert.equal(r.metrics.monsterHuntMoves,0);
 return {commands:prefix(d,'chant du Barde'),observed:'Un déplacement chanté D transporte le gardien de 12,5 à 12,6. Il reste sur la trappe après la sélection du Magicien.'};
});
check('N4 : la trappe retire réellement son occupant',()=>{
 const d=refs[1],a=new Author(d.spec).act(prefix(d,'chant du Barde'));a.select('wizard');const r=input(a,1);
 assert.equal(r.state.monsters.length,0);assert.equal(r.state.dead,false);assert.ok(r.phases.some(p=>p.kind==='platform'&&p.before.monsters.length===1&&p.after.monsters.length===0));
 return {commands:a.commands+'U',phases:r.phases.map(p=>p.kind)};
});
check('N4 : relâcher avant le chant est une variante légale',()=>{
 const d=refs[1],a=new Author(d.spec).act(prefix(d,'charges quittent'));
 a.select('wizard').act('U');assert.equal(at(a.state.monsters,12,5),true);
 a.select('bard').act('D');assert.equal(a.state.monsters.length,0);assert.equal(a.state.dead,false);
 a.select('wizard').act(d.commands.slice(prefix(d,'trappe disparaît').length));
 const r=replay(d.spec,a.commands);assert.equal(r.state.complete,true);assert.equal(r.metrics.blocked,0);assert.equal(r.metrics.deaths,0);
 return {commands:a.commands,actions:r.metrics.actions,observed:'Le chant imposé peut aussi noyer le gardien dans l’eau nue après un retrait précoce de la trappe. Le reste du chantier mène à la victoire.',scope:'La chronologie du témoin est pédagogique ; elle n’est pas une contrainte cachée.'};
});
check('N4 : deux réserves deviennent deux appuis, plus l’appui déplacé',()=>{
 const d=refs[1],a=new Author(d.spec).act(prefix(d,'deuxième caisse'));
 assert.deepEqual(a.state.supports.map(p=>`${p.x},${p.y}`).sort(),['11,11','12,11','13,11']);assert.equal(a.state.stones.length,0);
 return {commands:a.commands,bridge:[{x:11,y:11},{x:12,y:11},{x:13,y:11}],scope:'État démontré du chantier ; aucune unicité de calendrier revendiquée.'};
});
check('N4 : quitter le pont vers le nord avec le Barde est refusé',()=>{
 const d=refs[1],a=new Author(d.spec).act(prefix(d,'pousse la Barde'));a.select('bard');const r=input(a,1);
 assert.equal(r.state.failed,true);assert.equal(r.state.dead,false);assert.deepEqual(r.state.supports,a.state.supports);return {commands:a.commands+'U',observed:'Le chant imposerait un déplacement dangereux du compagnon. Les échanges du témoin permettent la relève.'};
});
check('N4 : la chaîne d’appuis permet aussi une traversée chantée',()=>{
 const d=refs[1],a=new Author(d.spec).act(prefix(d,'deuxième caisse'));
 a.go(9,11,'bard');a.go(8,11,'warrior');a.select('bard').act('RRRRR');
 assert.equal(a.state.heroes.find(h=>h.kind==='bard').at.x,14);assert.equal(a.state.heroes.find(h=>h.kind==='warrior').at.x,13);
 assert.deepEqual(a.state.supports.map(p=>`${p.x},${p.y}`).sort(),['11,11','12,11','13,11']);
 a.select('warrior').act(d.commands.slice(prefix(d,'pousse la Barde').length));
 const r=replay(d.spec,a.commands);assert.equal(r.state.complete,true);assert.equal(r.metrics.blocked,0);assert.equal(r.metrics.deaths,0);
 return {commands:a.commands,actions:r.metrics.actions,observed:'Les appuis en chaîne sont retenus par la rive et les héros ; cinq pas du Barde font aussi traverser le duo.',scope:'La poussée du Barde est démontrée, mais non obligatoire.'};
});
check('N5 : charger avant de placer le captif échoue',()=>{
 const a=new Author(refs[2].spec),r=input(a,2);assert.equal(r.state.failed,true);assert.equal(at(r.state.stones,10,2),true);
 return {commands:'D',observed:'La porte orange 10,3 interdit de pousser la réserve tant que le gardien n’occupe pas 5,8.'};
});
check('N5 : quitter le pupitre à pied libère deux commandes distinctes',()=>{
 const d=refs[2],a=new Author(d.spec).act(prefix(d,'Trois chants'));a.act('DD');
 assert.equal(at(a.state.monsters,5,10),true);assert.equal(at(a.state.stones,5,11),true);assert.equal(circuitPressed(a.world,a.state,'captif'),false);assert.equal(circuitPressed(a.world,a.state,'verrou'),false);
 assert.equal(gateClosed(a.world,a.state,0),true);assert.equal(gateClosed(a.world,a.state,1),true);assert.equal(gateClosed(a.world,a.state,2),true);
 return {commands:a.commands,observed:'Deux pas chantés emportent gardien et caisse. Le bouton orange puis le bouton vert se libèrent ; le chargement et les deux destinations referment.'};
});
check('N5 : la collision est un déplacement chanté visible',()=>{
 const d=refs[2],r=replay(d.spec,prefix(d,'rencontrent'));
 assert.equal(r.state.monsters.length,1);assert.equal(at(r.state.monsters,5,8),true);assert.equal(r.metrics.monstersRemoved,2);assert.equal(r.metrics.monsterHuntMoves,0);
 assert.ok(r.trace.flatMap(t=>t.phases).some(p=>p.kind==='song'&&p.moves.some(m=>m.actor==='monster'&&m.to.x===9&&m.to.y===8)));
 return {commands:prefix(d,'rencontrent'),observed:'Le Barde monte le monstre 9,9 vers 9,8, au contact de celui en 9,7. Les deux disparaissent ; le captif reste.'};
});
check('N5 : le volet fermé protège le moulin d’une visée directe',()=>{
 const d=refs[2],a=new Author(d.spec).act(prefix(d,'charge la caisse'));a.go(9,7,'wizard');const r=input(a,1);
 assert.equal(r.state.failed,true);assert.equal(at(r.state.stones,10,4),true);assert.equal(at(r.state.stones,9,4),false);
 return {commands:a.commands+'U',observed:'Le volet rose fermé en 9,6 arrête le pas et la visée depuis le couloir. Le Magicien ne rejoint pas le côté de la caisse avant le transfert.'};
});
check('N5 : la seconde presse seule ne décharge pas la réserve',()=>{
 const d=refs[2],a=new Author(d.spec).act(prefix(d,'charge la caisse'));a.go(15,14,'wizard').act('U');
 assert.equal(at(a.state.stones,10,4),true);assert.equal(at(a.state.stones,9,5),false);assert.equal(gateClosed(a.world,a.state,4),true);assert.equal(gateClosed(a.world,a.state,5),false);
 return {commands:a.commands,observed:'La commande rose ouvre le volet mais sa presse est vide : la caisse reste sur la presse violette en 10,4.'};
});
check('N5 : relâcher trop tôt ferme le couloir sans déplacer la livraison',()=>{
 const d=refs[2],a=new Author(d.spec).act(prefix(d,'commande rose'));a.act('D');
 assert.equal(at(a.state.stones,9,5),true);assert.equal(gateClosed(a.world,a.state,5),true);
 a.go(9,7,'bard');const r=input(a,1);assert.equal(r.state.failed,true);assert.equal(at(r.state.stones,9,5),true);
 return {commands:a.commands+'U',observed:'Le volet rose ferme en 9,6. Le Barde ne peut plus atteindre la position qui tire la caisse ; réappuyer rétablit le passage.',scope:'Erreur récupérable, sans perte de ressource ni minuteur.'};
});
check('N5 : un monstre sur le cyan ne remplace pas la caisse',()=>{
 const d=refs[2],a=new Author(d.spec).act(prefix(d,'extrait le Barde'));a.go(9,11,'bard').act('DDD');
 assert.equal(at(a.state.monsters,9,12),true);assert.equal(circuitPressed(a.world,a.state,'meule'),true);
 a.go(10,13,'wizard');const r=input(a,3);assert.equal(r.state.dead,true);
 return {commands:a.commands+'L',observed:'Attirer le monstre sur le cyan ouvre bien le palier, mais entrer dans la destination orange 9,13 provoque le contact mortel avec 9,12.',scope:'Contre-branche concrète qui ferme le raccourci de remplacement du dernier poids.'};
});
check('N5 : le départ chanté retirerait la livraison finale',()=>{
 const d=refs[2],a=new Author(d.spec).act(prefix(d,'Sept pas chantés'));a.act('D');
 assert.equal(at(a.state.stones,9,13),true);assert.equal(circuitPressed(a.world,a.state,'meule'),false);assert.equal(gateClosed(a.world,a.state,6),true);
 return {commands:a.commands,observed:'Un pas de plus emporte la caisse hors du cyan. L’échange de relève du témoin évite ce départ chanté.'};
});
check('N5 : deux impulsions et trois poids finaux distincts',()=>{
 const d=refs[2],r=replay(d.spec,d.commands),ps=r.trace.flatMap(t=>t.phases).filter(p=>p.kind==='piston');
 assert.equal(ps.length,2);assert.deepEqual(ps.map(p=>p.moves.find(m=>m.actor==='stone').to),[{x:9,y:4},{x:9,y:5}]);
 assert.equal(r.state.monsters.length,1);assert.equal(at(r.state.monsters,5,8),true);assert.equal(at(r.state.stones,5,9),true);assert.equal(at(r.state.stones,9,12),true);
 for(const id of ['captif','verrou','meule'])assert.equal(circuitPressed(r.world,r.state,id),true);
 return {pistonLandings:[{x:9,y:4},{x:9,y:5}],weights:[{x:5,y:8},{x:5,y:9},{x:9,y:12}]};
});
const report={gameCode:'SS19',version:'0.2.0',scope:'Niveaux 3–5 : témoins, contre-branches et variantes physiques locales ; sans preuve de solution unique. La carte et le témoin de N3 sont conservés.',levels:refs.map(d=>({id:d.spec.id,sha256:createHash('sha256').update(JSON.stringify(d.spec)).digest('hex')})),checks,passed:checks.length,failed:0};
writeFileSync(new URL('../ss19-middle-review.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
