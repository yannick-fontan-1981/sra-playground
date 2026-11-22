/** Author review: campaign examples and local mistakes, never a global uniqueness claim. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {Author} from './author.mjs';
import {replay,decodeCommand,stateKey} from '../../scripts/solver.mjs';
import {compileLevel,initialState,stepDetailed,TrioPuzzleSession,renderWorld,cellToPixel,circuitPressed} from '../../dist/core.js';
const designs=Object.fromEntries([5,6,7,8].map(n=>[n,JSON.parse(readFileSync(new URL(`../level${n}-design.json`,import.meta.url),'utf8'))]));
const results=[];
const has=(ps,x,y)=>ps.some(p=>p.x===x&&p.y===y);
for(const [n,d] of Object.entries(designs)){
 const r=replay(d.spec,d.commands),start=initialState(compileLevel(d.spec));
 assert.equal(start.complete,false);assert.equal(start.dead,false);
 assert.equal(r.state.complete,true);assert.equal(r.metrics.blocked,0);assert.equal(r.metrics.deaths,0);assert.deepEqual(r.metrics,d.metrics);
 assert.ok(r.metrics.warriorPushes>0&&r.metrics.thiefPulls>0&&r.metrics.swaps>0);
 assert.ok(r.metrics.mirrorMoves>0&&r.metrics.platformsCreated>0);
 const roles=r.state.heroes.map(h=>h.kind).sort();assert.deepEqual(roles,['thief','warrior','wizard']);
 assert.equal(r.world.goals.filter(g=>r.state.heroes.some(h=>h.at.x===g.x&&h.at.y===g.y)).length,3);
 const alternatives=[];
 for(const suffix of n==='5'?['ferry-alternative','chain-alternative']:n==='7'?['two-roles-alternative']:[]){
  const p=new URL(`../level${n}-${suffix}.json`,import.meta.url);if(existsSync(p)){const alt=JSON.parse(readFileSync(p,'utf8'));const x=replay(d.spec,alt.commands);assert.deepEqual(alt.spec,d.spec);assert.equal(x.state.complete,true);assert.equal(x.metrics.blocked,0);assert.equal(x.metrics.deaths,0);alternatives.push({file:`level${n}-${suffix}.json`,actions:x.metrics.actions,supports:x.state.supports.length});}
 }
 results.push({level:+n,specSha256:createHash('sha256').update(JSON.stringify(d.spec)).digest('hex'),result:'WIN',metrics:r.metrics,stages:d.stages.length,alternatives,scope:'Le témoin prouve cette solution, sans prouver un minimum, une unicité ou la nécessité globale de chaque mécanique.'});
}
const mistakes=[];
// L5: a press receives a hero if its command is released before the exchange.
{
 const d=designs[5],r=replay(d.spec,'CL');
 assert.equal(r.state.dead,true);assert.ok(r.state.heroes.find(h=>h.kind==='wizard').dead);
 mistakes.push({level:5,label:'Libérer la presse avant de remplacer le Magicien',commands:'CL',result:'GAME_OVER',evidence:'La presse expulse le Magicien dans l’eau ; préparer la réception précède sa libération dans le témoin.'});
}
// L6: parking the upper mirror removes the double-ray alignment; it is reversible.
{
 const d=designs[6],a=new Author(d.spec);a.go(7,5,'thief').act('LLDL').select('wizard');
 const before=a.state,move=stepDetailed(a.world,before,4);
 assert.equal(move.state.dead,false);assert.equal(move.phases.some(p=>p.kind==='swap'),false);assert.equal(has(move.state.stones,14,13),true);
 mistakes.push({level:6,label:'Ranger le miroir avant le premier échange',commands:a.commands+'R',result:'Marche simple ; charge distante inchangée',evidence:'Le miroir déplacé coupe la liaison avec le relais inférieur. Ce constat local ne rend pas la carte globalement insoluble.'});
}
// L7: leaving the Thief in the ray masks the intended key.
{
 const d=designs[7],a=new Author(d.spec);a.act(d.commands.slice(0,d.stages[7].turn-1)).select('wizard');
 assert.equal(has(a.state.stones,8,7),true);
 const step=stepDetailed(a.world,a.state,3),swap=step.phases.find(p=>p.kind==='swap');
 assert.ok(swap);assert.ok(swap.moves.every(m=>m.actor==='hero'));assert.equal(has(step.state.stones,8,7),true);assert.equal(circuitPressed(a.world,step.state,'prison'),true);
 mistakes.push({level:7,label:'Viser la clef avant que le Voleur quitte le rayon',commands:a.commands+'L',result:'Échange avec le Voleur ; clef restée dans l’atelier',evidence:'Le premier occupant masque la clef. Le bouton cyan reste occupé par un héros, et non par la clef prévue.'});
}
// L8: an unprepared prison exit is refused; a reverse spell only restores the key.
{
 const d=designs[8],a=new Author(d.spec);a.act(d.commands.slice(0,d.stages[8].turn)).go(4,5,'wizard').act('R');
 assert.deepEqual(a.hero.at,{x:17,y:15});assert.equal(has(a.state.supports,17,14),false);
 const step=stepDetailed(a.world,a.state,1);assert.equal(step.state.failed,true);assert.equal(step.state.dead,false);assert.deepEqual(step.state.heroes.map(h=>h.at),a.state.heroes.map(h=>h.at));
 mistakes.push({level:8,label:'Échanger la clef avant de préparer son appui de secours',commands:a.commands+'U',result:'Sortie vers le nord refusée sur l’eau',evidence:'Le Magicien est arrivé dans l’alcôve mais ne peut pas en sortir à pied. Le problème est réparable ; aucun softlock global n’est affirmé.'});
}
// L8: actual map state that implicates only the parked lower mirror.
{
 const d=designs[8],a=new Author(d.spec);a.act(d.commands.slice(0,d.stages[12].turn)).go(17,15,'wizard');
 const before=a.state,detail=stepDetailed(a.world,before,5);
 assert.deepEqual(detail.blockedMirrorIndices,[1]);assert.equal(detail.phases.length,0);assert.equal(stateKey(detail.state),stateKey(before));
 const warned=new TrioPuzzleSession([d.spec]),control=new TrioPuzzleSession([d.spec]);
 let s=initialState(compileLevel(d.spec));
 for(const c of a.commands){const action=decodeCommand(c,s);warned.action(action.id,action.data);control.action(action.id,action.data);s=stepDetailed(a.world,s,action.id,action.data).state;}
 const normal=renderWorld(a.world,before),obs=warned.action(5);
 assert.deepEqual(obs.frameDurationsMs,[110,70,110,0]);assert.equal(obs.frames.length,4);assert.deepEqual(obs.frames[0],obs.frames[2]);assert.deepEqual(obs.frames[1],obs.frames[3]);
 for(let mi=0;mi<before.mirrors.length;mi++){
  const p=cellToPixel(before.mirrors[mi].at);
  for(let y=0;y<3;y++)for(let x=0;x<3;x++){
   const base=normal[p.y+y][p.x+x],shown=obs.frames[0][p.y+y][p.x+x];
   assert.equal(shown,mi===1&&base===5?8:base);
  }
 }
 warned.action(5);assert.deepEqual(warned.undo().frame,control.undo().frame);
 mistakes.push({level:8,label:'Projeter depuis l’alcôve après rangement du miroir inférieur',commands:a.commands+'X',result:'Refus optique, rouge → normal → rouge → normal',evidence:'Le miroir en (12,15) tente une arrivée dans le mur (12,10). Seul son dos noir devient rouge, sa diagonale reste blanche, les entités ne bougent pas et les deux avertissements ne créent pas de nouvelle entrée Annuler.',blockedMirrorIndices:detail.blockedMirrorIndices,durationsMs:obs.frameDurationsMs});
}
const report={schema:1,scope:'Revue déterministe des quatre témoins et de cinq contresens locaux. Les variantes connues restent légitimes ; aucune exploration exhaustive ni borne minimale n’est revendiquée.',levels:results,mistakes};
writeFileSync(new URL('../levels5-8-review.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({levels:results.map(r=>({level:r.level,actions:r.metrics.actions,result:r.result,stages:r.stages,alternatives:r.alternatives})),localBranches:mistakes.length,blockedMirrorFeedback:'L8 verified red/normal/red/normal + white face + undo'}));
