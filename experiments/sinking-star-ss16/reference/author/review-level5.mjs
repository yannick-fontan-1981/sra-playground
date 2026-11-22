/** Author-side local counter-branches for the strengthened fifth room. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {Author} from './author.mjs';
import {replay} from '../../scripts/solver.mjs';
import {circuitPressed,gateClosed} from '../../dist/core.js';
const design=JSON.parse(readFileSync(new URL('../level5-design.json',import.meta.url)));
const has=(ps,x,y)=>ps.some(p=>p.x===x&&p.y===y);
const localChecks=[];
function at(stage){const a=new Author(design.spec);if(stage>=0)a.act(design.commands.slice(0,design.stages[stage].turn));return a;}
function snapshot(r){return{heroes:r.state.heroes.map(h=>({kind:h.kind,at:h.at,dead:!!h.dead})),stones:r.state.stones,supports:r.state.supports,monsters:r.state.monsters,gateClosed:r.state.gateClosed,platformActive:r.state.platformActive,circuits:Object.fromEntries(r.world.circuits.map(c=>[c.id,circuitPressed(r.world,r.state,c.id)])),failed:r.state.failed,dead:r.state.dead,complete:r.state.complete,metrics:r.metrics};}
function check(label,commands,test,scope){const r=replay(design.spec,commands);test(r);localChecks.push({label,commands,observed:snapshot(r),assertion:'All assertions in this named local counter-branch passed.',scope});return r;}
check('L5 — libérer une presse non chargée ne remplace pas le gardien','L',r=>{assert.equal(r.state.monsters.length,2);assert.equal(r.metrics.pistonPushes,0);assert(gateClosed(r.world,r.state,0));assert(circuitPressed(r.world,r.state,'passerelles'));assert(!r.state.dead);},'One initial release only: the original automatic clearance is no longer available. Loading and later reopening remain possible.');
{
 const a=at(-1);a.go(8,3,'thief');
 check('L5 — le couloir nord reste gardé avant le combat',a.commands+'R',r=>{assert(r.state.heroes.find(h=>h.kind==='thief').dead);assert.equal(r.state.monsters.length,2);},'One exact attempted north-side approach while both monsters are alive. Other global reorganizations are not searched here.');
}
check('L5 — charger verticalement ne déclenche pas encore la relève',design.commands.slice(0,design.stages[1].turn),r=>{assert(has(r.state.stones,8,4));assert.equal(r.state.monsters.length,2);assert(!gateClosed(r.world,r.state,0));},'Reference state after the Warrior loaded the open press from the south.');
check('L5 — la relève conserve le poids pendant le combat',design.commands.slice(0,design.stages[2].turn),r=>{assert(has(r.state.stones,9,4));assert.equal(r.state.monsters.length,0);assert.equal(r.metrics.pistonPushes,1);assert(r.state.platformActive.every(Boolean));assert(!r.state.dead);},'The loaded closure moves the crate into the keeper cell and brings the monsters together, without losing the hydraulic weight.');
check('L5 — récupérer la charge retire les plateformes mais ne suffit pas au sas',design.commands.slice(0,design.stages[3].turn),r=>{assert(has(r.state.stones,7,6));assert(r.state.platformActive.every(x=>!x));assert(!gateClosed(r.world,r.state,2));assert(gateClosed(r.world,r.state,3));assert.equal(r.state.supports.length,0);},'Reference parking state: the former relay crate remains mobile, the two future bridge crates remain in the reserve.');
{
 const a=at(3);a.go(5,5,'thief');
 check('L5 — reprendre la clef avant les charges referme la réserve',a.commands+'D',r=>{assert(!circuitPressed(r.world,r.state,'reserve'));assert(gateClosed(r.world,r.state,1));assert(has(r.state.stones,14,1)&&has(r.state.stones,16,1));assert(!r.state.dead);},'Exact wrong-order branch, with both reserve crates still inside. This proves closure, not irreversible unsolvability; restoring the key is outside the branch.');
}
{
 const a=at(4);a.go(17,4,'merchant').act('L');
 check('L5 — le Marchand ne reprend pas la file de deux charges',a.commands+'L',r=>{assert(r.state.failed);assert(has(r.state.stones,14,4)&&has(r.state.stones,15,4));assert.equal(r.state.heroes.find(h=>h.kind==='merchant').at.x,16);},'The Merchant can make the first one-crate push; the next push is refused once it would move both reserve crates together.');
}
{
 const a=at(5);a.go(9,5,'thief');
 check('L5 — la traction au coude extrait seulement la première charge',a.commands+'D',r=>{assert(has(r.state.stones,9,5));assert(has(r.state.stones,10,4));assert(!has(r.state.stones,9,4));assert(!r.state.dead);},'Single perpendicular extraction from the two-crate delivery state; the other crate stays in the reserve corridor.');
}
{
 const a=at(6);a.go(9,11,'thief');
 check('L5 — la traction ne peut pas continuer dans l’eau sans appui',a.commands+'D',r=>{assert(r.state.failed);assert(!r.state.dead);assert.equal(r.state.supports.length,0);assert(has(r.state.stones,9,10));assert.deepEqual(r.state.heroes.find(h=>h.kind==='thief').at,{x:9,y:11});},'Exact refused voluntary step before the first permanent support: both the Thief and rear crate keep their previous positions.');
}
{
 const a=at(2);a.go(9,12,'thief').go(9,5,'warrior').act('U');
 check('L5 — retirer les plateformes pendant la traversée fait perdre le Voleur',a.commands+'R',r=>{assert(r.state.heroes.find(h=>h.kind==='thief').dead);assert(r.state.platformActive.every(x=>!x));assert.equal(r.state.supports.length,0);},'Exact hydraulic withdrawal while a hero occupies the temporary bridge: the Warrior first takes over the weight, then leaves it. This is an actual fatal transition, unlike a refused voluntary water step.');
}
check('L5 — la première immersion laisse la seconde charge mobile',design.commands.slice(0,design.stages[7].turn),r=>{assert(has(r.state.supports,9,12));assert(!has(r.state.supports,10,12));assert(has(r.state.stones,10,4));assert.equal(r.state.stones.length,3);},'Reference intermediate resource account only, before the second change of axis.');
check('L5 — les deux appuis préservent les deux futurs lests',design.commands.slice(0,design.stages[8].turn),r=>{assert(has(r.state.supports,9,12)&&has(r.state.supports,10,12));assert(has(r.state.stones,5,4)&&has(r.state.stones,7,6));assert.equal(r.state.stones.length,2);assert(gateClosed(r.world,r.state,3));},'Reference resource account: two permanent supports, the reserve key and the parked relay crate. It is not a minimum-resource proof.');
check('L5 — le sas s’ouvre après les deux réemplois et le retrait hydraulique',design.commands.slice(0,design.stages[11].turn),r=>{assert(has(r.state.stones,5,14)&&has(r.state.stones,15,12));assert(!circuitPressed(r.world,r.state,'reserve'));assert(!circuitPressed(r.world,r.state,'passerelles'));assert(circuitPressed(r.world,r.state,'deux-poids'));assert(!gateClosed(r.world,r.state,2)&&!gateClosed(r.world,r.state,3));assert.equal(r.state.supports.length,2);},'Reference end preparation: the former key and relay crate are now remote weights, while the hydraulic command is empty.');
{
 const a=at(11);a.go(5,15,'thief');
 check('L5 — reprendre le lest gauche ferme le dernier sas',a.commands+'D',r=>{assert(!circuitPressed(r.world,r.state,'deux-poids'));assert(gateClosed(r.world,r.state,3));assert(!r.state.dead);},'Exact local withdrawal before entering the exits; the closure is reversible.');
}
{
 const a=at(11);a.go(9,4,'warrior');
 check('L5 — les deux lests ne suffisent pas si le poste hydraulique est réoccupé',a.commands,r=>{assert(circuitPressed(r.world,r.state,'deux-poids'));assert(circuitPressed(r.world,r.state,'passerelles'));assert(gateClosed(r.world,r.state,2));assert(!gateClosed(r.world,r.state,3));assert.equal(r.state.supports.length,2);assert(!r.state.dead);},'Local reoccupation closes the first exit gate despite the two final weights. SS16 permanent supports remain intact when hydraulic platforms reactivate.');
}
const winner=replay(design.spec,design.commands);assert(winner.state.complete);assert.equal(winner.metrics.blocked,0);assert.equal(winner.metrics.deaths,0);
export const report={success:true,specSha256:createHash('sha256').update(JSON.stringify(design.spec)).digest('hex'),scope:'Winning reference route and exact local counter-branches. No global shortest-path, unique-solution or irreversible-failure claim.',winningRoute:winner.metrics,localChecks};
writeFileSync(new URL('../level5-review.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({success:report.success,specSha256:report.specSha256,localChecks:localChecks.length,winningRoute:winner.metrics}));
