/** Independent design audit. This file is never imported by the playable build. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {replay} from '../../scripts/solver.mjs';

const read=name=>JSON.parse(readFileSync(new URL(`../${name}`,import.meta.url),'utf8'));
const primary=read('level5-design.json');
const chain=read('level5-chain-alternative.json');
const ferry=read('level5-ferry-alternative.json');
const results=[];
for(const [name,design,count] of [['principal',primary,241],['chaîne',chain,215],['navette',ferry,257]]){
 assert.deepEqual(design.spec,primary.spec,`${name}: map diverged from the audited map`);
 const r=replay(primary.spec,design.commands);
 assert.equal(r.state.complete,true,`${name}: not won`);
 assert.equal(r.metrics.blocked,0,`${name}: refusal`);
 assert.equal(r.metrics.deaths,0,`${name}: death`);
 assert.equal(r.metrics.actions,count,`${name}: witness count changed`);
 assert.deepEqual(r.metrics,design.metrics,`${name}: recorded metrics differ`);
 if(name==='navette'){
  assert.equal(r.metrics.platformsCreated,0);
  assert.equal(r.state.supports.length,0);
  assert.equal(r.metrics.heroReflections,1);
  assert.equal(r.metrics.swaps,8);
 }
 results.push({name,result:'WIN',metrics:r.metrics});
}

// Each negative result is a precise local branch, not an impossibility proof.
for(const [name,commands] of [
 ['Libérer la commande orange avant la relève du Magicien','CL'],
 ['Confondre le premier sort avec un reflet global','CCX'],
]){
 const r=replay(primary.spec,commands);
 assert.equal(r.state.dead,true,`${name}: expected the identified fatal branch`);
 results.push({name,commands,result:'GAME_OVER',scope:'Branche locale vérifiée.'});
}
const firstReflection=ferry.commands.indexOf('X');
assert.equal(ferry.commands[firstReflection-1],'L');
const premature=ferry.commands.slice(0,firstReflection-1)+'X';
const death=replay(primary.spec,premature);
assert.equal(death.state.dead,true,'The nearer Warrior must drown if he stays on the south ray.');
results.push({name:'Navette : refléter avant de dégager le Guerrier',commands:premature,result:'GAME_OVER',scope:'Le Guerrier à distance deux est prioritaire sur le bloc à distance trois.'});
console.log(JSON.stringify({level:5,claim:'Trois témoins gagnants distincts ; aucun minimum ni besoin universel de pont établi.',results},null,2));
