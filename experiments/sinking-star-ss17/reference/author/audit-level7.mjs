/** Independent route and transition audit, excluded from the playable build. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {replay} from '../../scripts/solver.mjs';
import {circuitPressed} from '../../dist/core.js';
const read=name=>JSON.parse(readFileSync(new URL(`../${name}`,import.meta.url),'utf8'));
const primary=read('level7-design.json'),alternative=read('level7-two-roles-alternative.json');
const results=[];
for(const [name,d,count,swaps] of [['principal',primary,410,2],['clef-directement-lest',alternative,366,1]]){
 assert.deepEqual(d.spec,primary.spec);
 const r=replay(primary.spec,d.commands);
 assert.equal(r.state.complete,true);assert.equal(r.metrics.blocked,0);assert.equal(r.metrics.deaths,0);
 assert.equal(r.metrics.actions,count);assert.equal(r.metrics.swaps,swaps);assert.equal(r.metrics.platformsCreated,3);
 assert.equal(r.metrics.monstersRemoved,2);assert.deepEqual(r.metrics,d.metrics);
 results.push({name,result:'WIN',metrics:r.metrics});
}
// Local risk: approaching the guard from its own column is fatal.
const delivery=primary.commands.slice(0,primary.stages[4].turn);
const unsafe=delivery+'RUUU';
const death=replay(primary.spec,unsafe);assert.equal(death.state.dead,true);
results.push({name:'Approcher le gardien par la colonne 13',commands:unsafe,result:'GAME_OVER',scope:'Branche locale après livraison des trois charges.'});
// The downward command is still a spell while a living guard is its first target.
const early=delivery+'CCD',wrongTarget=replay(primary.spec,early);
assert.equal(wrongTarget.state.dead,false);
assert.equal(wrongTarget.metrics.monsterSwaps,1);
assert.equal(circuitPressed(wrongTarget.world,wrongTarget.state,'prison'),true);
assert.equal(wrongTarget.state.supports.length,0);
results.push({name:'Quitter vers le sud avant le combat',commands:early,result:'Échange avec le monstre ; commande cyan encore occupée.',scope:'La variante gagne avec un pas sud seulement après disparition des monstres.'});
console.log(JSON.stringify({level:7,claim:'Les trois emplois de la clef appartiennent au témoin principal ; une réaffectation plus courte est également gagnante.',results},null,2));
