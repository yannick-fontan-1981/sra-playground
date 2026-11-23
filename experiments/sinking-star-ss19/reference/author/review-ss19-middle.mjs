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
 const r=replay(d.spec,d.commands);assert.equal(r.state.complete,true);assert.equal(r.metrics.blocked,0);assert.equal(r.metrics.deaths,0);assert.equal(r.state.heroes.filter(h=>!h.dead).length,3);
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
check('N4 : éteindre le soutien avant l’appât laisse le gardien sur la commande',()=>{
 const d=refs[1],a=new Author(d.spec).act(prefix(d,'charges quittent'));
 a.select('wizard').act('D');a.go(10,9,'warrior');
 assert.equal(at(a.state.monsters,12,5),true);assert.equal(a.state.monsters.length,1);assert.equal(circuitPressed(a.world,a.state,'gardien'),true);
 assert.equal(gateClosed(a.world,a.state,1),true);return {commands:a.commands,observed:'La chasse refuse l’eau nue : le gardien ne descend pas et sa porte reste fermée.',scope:'Erreur locale récupérable en réarmant la trappe.'};
});
check('N4 : la trappe retire réellement son occupant',()=>{
 const d=refs[1],a=new Author(d.spec).act(prefix(d,'attirer le gardien'));
 assert.equal(at(a.state.monsters,12,6),true);a.select('wizard');const r=input(a,1);
 assert.equal(r.state.monsters.length,0);assert.equal(r.state.dead,false);assert.ok(r.phases.some(p=>p.kind==='platform'&&p.before.monsters.length===1&&p.after.monsters.length===0));
 return {commands:a.commands+'U',phases:r.phases.map(p=>p.kind)};
});
check('N4 : deux réserves deviennent deux appuis, plus l’appui déplacé',()=>{
 const d=refs[1],a=new Author(d.spec).act(prefix(d,'deuxième caisse'));
 assert.deepEqual(a.state.supports.map(p=>`${p.x},${p.y}`).sort(),['11,11','12,11','13,11']);assert.equal(a.state.stones.length,0);
 return {commands:a.commands,bridge:[{x:11,y:11},{x:12,y:11},{x:13,y:11}],scope:'État démontré du chantier ; les autres calendriers restent possibles.'};
});
check('N4 : quitter le pont vers le nord avec la Barde est refusé',()=>{
 const d=refs[1],a=new Author(d.spec).act(prefix(d,'pousse la Barde'));a.select('bard');const r=input(a,1);
 assert.equal(r.state.failed,true);assert.equal(r.state.dead,false);assert.deepEqual(r.state.supports,a.state.supports);return {commands:a.commands+'U',observed:'Le chant imposerait un déplacement dangereux du compagnon ; il est refusé. Les échanges du témoin permettent la relève.'};
});
check('N5 : charger avant de placer le captif échoue',()=>{
 const a=new Author(refs[2].spec),r=input(a,2);assert.equal(r.state.failed,true);assert.equal(at(r.state.stones,10,3),true);
 return {commands:'D',observed:'La porte 10,4 interdit la poussée de la réserve tant que le gardien n’occupe pas 5,8.'};
});
check('N5 : quitter le pupitre à pied déverrouille le captif',()=>{
 const d=refs[2],a=new Author(d.spec).act(prefix(d,'chant monte'));a.act('D');
 assert.equal(at(a.state.monsters,5,9),true);assert.equal(at(a.state.stones,5,10),true);assert.equal(circuitPressed(a.world,a.state,'captif'),false);
 assert.equal(gateClosed(a.world,a.state,0),true);assert.equal(gateClosed(a.world,a.state,1),true);
 return {commands:a.commands,observed:'Le chant du départ emporte ensemble le gardien et son verrou ; la sortie et le chargement referment.'};
});
check('N5 : la seconde presse seule ne décharge pas la réserve',()=>{
 const d=refs[2],a=new Author(d.spec).act(prefix(d,'première presse'));
 a.go(16,13,'wizard');a.act('U');assert.equal(at(a.state.stones,10,6),true);assert.equal(at(a.state.stones,9,7),false);
 return {commands:a.commands,observed:'L’impulsion sud est vide tant que le transfert occidental n’a pas eu lieu.'};
});
check('N5 : l’ancien accès de chant sous le moulin est désormais bloqué',()=>{
 const d=refs[2],a=new Author(d.spec).act(prefix(d,'première presse'));
 a.go(12,8,'bard');const r=input(a,3);assert.equal(r.state.failed,true);assert.equal(at(r.state.stones,10,6),true);
 return {commands:a.commands+'L',observed:'Le pas vers 11,8 est un mur ; il ne déplace pas la caisse par chant à travers le sol.',scope:'Régression du contre-parcours local trouvé pendant la conception, pas preuve exhaustive de toutes les routes.'};
});
check('N5 : les deux impulsions livrent une caisse dans le bon ordre',()=>{
 const d=refs[2],r=replay(d.spec,d.commands),ps=r.trace.flatMap(t=>t.phases).filter(p=>p.kind==='piston');
 assert.equal(ps.length,2);assert.deepEqual(ps.map(p=>p.moves.find(m=>m.actor==='stone').to),[{x:9,y:6},{x:9,y:7}]);
 assert.equal(r.state.monsters.length,1);assert.equal(at(r.state.monsters,5,8),true);assert.equal(at(r.state.stones,5,9),true);assert.equal(at(r.state.stones,9,12),true);
 return {pistonLandings:[{x:9,y:6},{x:9,y:7}],captive:{x:5,y:8},latch:{x:5,y:9}};
});
const report={gameCode:'SS19',scope:'Niveaux 3–5 : témoins et contre-branches locales, sans preuve de solution unique.',levels:refs.map(d=>({id:d.spec.id,sha256:createHash('sha256').update(JSON.stringify(d.spec)).digest('hex')})),checks,passed:checks.length,failed:0};
writeFileSync(new URL('../ss19-middle-review.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
