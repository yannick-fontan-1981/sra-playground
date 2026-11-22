/** Independent historical regression and risky-transition audit. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Author} from './author.mjs';
import {replay} from '../../scripts/solver.mjs';
import {circuitPressed} from '../../dist/core.js';
const read=name=>JSON.parse(readFileSync(new URL(`../${name}`,import.meta.url),'utf8'));
const current=read('level8-design.json'),record=read('level8-rejected-shortcut.json');
const {historical,correction}=record;
assert.deepEqual(current.spec,{...historical.spec,circuits:[...historical.spec.circuits,correction.circuit],gates:[...historical.spec.gates,correction.gate]});
const original=replay(historical.spec,historical.commands);
assert.equal(original.state.complete,true);assert.equal(original.metrics.actions,156);
assert.equal(original.metrics.platformsCreated,0);assert.equal(original.metrics.blocked,0);assert.equal(original.metrics.deaths,0);
assert.deepEqual(original.metrics,historical.metrics);
const fixed=replay(current.spec,historical.commands);
assert.equal(fixed.state.complete,false);assert.equal(fixed.metrics.blocked,12);
assert.equal(circuitPressed(fixed.world,fixed.state,'prison-clef'),true);
assert.equal(fixed.state.stones.some(p=>p.x===17&&p.y===15),true);
assert.deepEqual(fixed.metrics,record.corrected.metrics);
const reference=replay(current.spec,current.commands);
assert.equal(reference.state.complete,true);assert.equal(reference.metrics.actions,205);
assert.equal(reference.metrics.blocked,0);assert.equal(reference.metrics.deaths,0);
assert.equal(circuitPressed(reference.world,reference.state,'prison-clef'),false);
assert.deepEqual(reference.metrics,current.metrics);
const results=[
 {name:'Carte historique / raccourci',result:'WIN',metrics:original.metrics},
 {name:'Carte corrigée / ancien raccourci',result:'NON_WIN',metrics:fixed.metrics},
 {name:'Carte corrigée / référence',result:'WIN',metrics:reference.metrics}
];
for(const [name,commands] of [
 ['Relâcher la réception avant la relève du Magicien','L'],
 ['Lancer un reflet global à la place du premier sort','CDDDDRCX']
]){
 const r=replay(current.spec,commands);assert.equal(r.state.dead,true);
 results.push({name,commands,result:'GAME_OVER',scope:'Contre-branche locale.'});
}
const unprepared=new Author(current.spec);
unprepared.act(current.commands.slice(0,current.stages[8].turn));
unprepared.go(4,5,'wizard').act('R');
const trapped=replay(current.spec,unprepared.commands+'U');
assert.equal(trapped.state.failed,true);assert.equal(trapped.state.dead,false);
assert.equal(trapped.state.heroes[2].at.x,17);assert.equal(trapped.state.heroes[2].at.y,15);
assert.equal(circuitPressed(trapped.world,trapped.state,'prison-clef'),true);
results.push({name:'Entrer dans l’alcôve avant de construire son appui',commands:unprepared.commands+'U',result:'Pas nord refusé ; Magicien dans l’alcôve, dernier sas fermé.',scope:'Contre-branche locale ; une autre méthode de récupération reste autorisée.'});
console.log(JSON.stringify({level:8,claim:'La correction exige que l’alcôve soit libérée, sans imposer un trajet unique ni un nombre universel d’appuis.',results},null,2));
