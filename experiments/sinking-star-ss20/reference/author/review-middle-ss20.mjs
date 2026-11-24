import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {Author} from './author.mjs';
import {compileLevel,initialState,stepDetailed,circuitPressed} from '../../dist/core.js';
import {replay,solve,decodeCommand} from '../../scripts/solver.mjs';
const designs=Object.fromEntries([3,4,5].map(n=>[n,JSON.parse(readFileSync(new URL(`../level${n}-design.json`,import.meta.url)))]));
const checks=[];
const ok=(level,name,observed,scope='Parcours ou branche locale effectivement rejouée ; aucune prétention d’unicité.')=>checks.push({level,name,status:'passed',observed,scope});
const runStep=(world,state,command)=>{const a=decodeCommand(command,state);return stepDetailed(world,state,a.id,a.data);};
const win=(n,commands)=>{const r=replay(designs[n].spec,commands);assert(r.state.complete);assert.equal(r.metrics.blocked,0);assert.equal(r.metrics.deaths,0);return r;};
for(const n of [3,4,5]){const d=designs[n],r=win(n,d.commands);assert.equal(d.actions.length,d.commands.length);assert.equal(d.stages.at(-1).turn,d.commands.length);ok(n,'Témoin complet, étapes et métriques',r.metrics);}
// N3: without the third load, repeated global images keep both controls tied.
{
 const d=designs[3],loaded=replay(d.spec,d.commands.slice(0,d.stages[1].turn));
 let state={...loaded.state,stones:loaded.state.stones.filter(p=>!(p.x===8&&p.y===8))};
 const empty=[];for(let i=0;i<6;i++){const r=runStep(loaded.world,state,'X');assert(!r.state.failed&&!r.state.dead);state=r.state;const v=circuitPressed(loaded.world,state,'vert'),p=circuitPressed(loaded.world,state,'violet');assert.equal(v,p);empty.push({vert:v,violet:p,bridge:state.platformActive});}
 ok(3,'Presse sans caisse : deux circuits encore liés après six reflets',empty,'Branche optique depuis le chargement, avec seule la caisse de presse retirée. La branche ne remplace pas une recherche de tous les déplacements.');
 state=loaded.state;const latched=[];for(let i=0;i<6;i++){const r=runStep(loaded.world,state,'X');assert(!r.state.failed&&!r.state.dead);state=r.state;const v=circuitPressed(loaded.world,state,'vert'),p=circuitPressed(loaded.world,state,'violet');assert(v);assert.equal(p,i%2===0);latched.push({vert:v,violet:p,bridge:state.platformActive});}
 ok(3,'Écran chargé : vert stable et violet alternant pendant six reflets',latched);
 assert.equal(d.spec.circuits.find(c=>c.id==='violet').color,15);ok(3,'Bouton violet lisible',{floor:'gray',arms:'pink',centerPalette:15},'Contrôle de palette : le centre violet est distinct des bras roses. L’inspection du rendu effectif appartient à la revue UI du laboratoire.');
}
// N4: the shutter is a physical adaptation of the U, not actor duplication.
{
 const d=designs[4],noShutter={...d.spec,gates:[]};
 const before=d.commands.slice(0,d.commands.indexOf('X'));
 const one=replay(noShutter,before+'X');assert.equal(one.metrics.blocked,0);const two=runStep(one.world,one.state,'X');assert(two.state.failed);assert.deepEqual(two.blockedMirrorIndices,[0,1]);
 ok(4,'Sans l’escale-poussoir, le deuxième trajet serait revendiqué par les deux miroirs',{firstImage:'valid',secondImage:'refused',blockedMirrorIndices:two.blockedMirrorIndices},'Contrefactuel d’appareil : même carte et même trajet, porte retirée. La version livrée masque effectivement le premier bras.');
 const a=new Author(d.spec);a.act(d.commands.slice(0,d.stages[3].turn)).act('RR');assert(circuitPressed(a.world,a.state,'livraison'));assert.equal(a.state.platformActive[0],false);assert.equal(a.state.platformActive[1],true);
 a.go(5,7,'merchant');const attempted=runStep(a.world,a.state,'D');assert(attempted.state.failed&&!attempted.state.dead);
 ok(4,'Livrer trop tôt retire le départ encore nécessaire',{departureActive:a.state.platformActive[0],goalBridgeActive:a.state.platformActive[1],boardingFrom:{x:5,y:7},boardingRefused:attempted.state.failed},'Branche légale jusqu’à la tentative d’embarquement. Cette erreur reste réversible depuis le quai de réception.');
 a.select('bard').act('LL');assert(!circuitPressed(a.world,a.state,'livraison'));assert.equal(a.state.platformActive[0],true);a.go(3,7,'merchant').select('bard').act(d.commands.slice(d.stages[3].turn));
 const recovery=win(4,a.commands);ok(4,'Variante légale : annuler une livraison prématurée puis terminer',recovery.metrics);
 // Cargo first occupies the receiving cell and makes the next first leg conflict.
 const cargo=new Author(d.spec);cargo.go(3,5,'thief').act('RR').go(3,3);cargo.go(4,4,'merchant').act('DDD').go(3,8).act('R').go(3,7).act('XX');cargo.go(5,8,'merchant');
 const collision=runStep(cargo.world,cargo.state,'X');assert(collision.state.failed);assert.deepEqual(collision.blockedMirrorIndices,[0,1]);
 ok(4,'Caisse livrée sans réceptionnaire : le prochain premier trajet entre en conflit',{merchant:cargo.state.heroes[0].at,cargo:cargo.state.stones[0],reflectionRefused:collision.state.failed,blockedMirrorIndices:collision.blockedMirrorIndices},'Branche de chargement exacte, contrôlée jusqu’au reflet refusé : les deux miroirs visent la même escale.');
}
// N5: a step changes parity; the reflection alone only alternates the same rail.
{
 const d=designs[5],world=compileLevel(d.spec);let state=initialState(world);const alternate=[];
 for(let i=0;i<8;i++){state=runStep(world,state,'X').state;assert(!state.failed&&!state.dead);assert.equal(state.monsters.length,2);assert(circuitPressed(world,state,'rail'));assert(state.monsters.every(p=>(p.x+p.y)%2===1));alternate.push(state.monsters);}
 ok(5,'Huit reflets seuls ne créent aucune rencontre',alternate,'Les deux monstres gardent la même parité x+y ; un voisinage orthogonal demande des parités opposées. Ce contrôle porte sur les reflets sans autre déplacement.');
 const variant='CCXDU'+d.commands.slice(5);const r=win(5,variant);ok(5,'Variante légale : reflet puis pas du Barde, au lieu de pas puis reflet',r.metrics);
 const corner=replay(d.spec,d.commands.slice(0,d.stages[4].turn));assert(circuitPressed(corner.world,corner.state,'coude'));const blocked=runStep(corner.world,corner.state,'U');assert(blocked.state.failed&&!blocked.state.dead);ok(5,'Caisse au coude : la voie arrière du Marchand se ferme',{merchant:corner.state.heroes[0].at,gateClosed:corner.state.gateClosed[1],northStepRefused:blocked.state.failed});
 const song=replay(d.spec,d.commands.slice(0,d.stages[5].turn)),phase=song.trace.at(-1).phases.find(p=>p.kind==='song');assert(phase);assert.deepEqual(phase.moves.map(m=>m.actor).sort(),['hero','stone']);assert.deepEqual(song.state.heroes[0].at,corner.state.heroes[0].at);assert(!circuitPressed(song.world,song.state,'coude'));ok(5,'Chant du coude : caisse déplacée, Marchand retenu par le mur',{moves:phase.moves,couplingReleased:true});
 const withoutSongs=solve(d.spec,{disableSongs:true,maxStates:30000,maxMs:15000});checks.push({level:5,name:'Recherche sans aucun chant',status:withoutSongs.status==='unsolvable'?'passed':'inconclusive',observed:withoutSongs,scope:withoutSongs.status==='unsolvable'?'File épuisée : aucun parcours gagnant sous cette restriction.':'Limite de recherche ; aucun résultat négatif global n’est revendiqué.'});
}
for(const n of [3,4,5]){
 designs[n].adaptation.localChecks=checks.filter(c=>c.level===n).map(({level,...c})=>c);
 writeFileSync(new URL(`../level${n}-design.json`,import.meta.url),JSON.stringify(designs[n],null,2)+'\n');
}
const report={game:'ss20',levels:[3,4,5],method:'Témoins rejoués, mauvais ordres ciblés, variantes légales et recherche bornée explicitement qualifiée.',limits:['Aucune unicité de solution n’est revendiquée.','Un refus dans une branche de revue est attendu et ne fait pas partie des témoins gagnants.','Les variantes admises ne changent ni la carte ni les règles.'],checks};
writeFileSync(new URL('../middle-ss20-review.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({checks:checks.length,passed:checks.filter(c=>c.status==='passed').length,inconclusive:checks.filter(c=>c.status==='inconclusive').length,report:'reference/middle-ss20-review.json'}));
