/** Resource and device review of the three concluding quartet rooms. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {Author} from './author.mjs';
import {stepDetailed,circuitPressed,platformActive,terrainAt,equal} from '../../dist/core.js';
import {replay,decodeCommand} from '../../scripts/solver.mjs';

const designs=Object.fromEntries([6,7,8].map(n=>[n,JSON.parse(readFileSync(new URL(`../level${n}-design.json`,import.meta.url)))]));
const checks=[];
const ok=(level,name,observed,scope='Étapes et conséquences physiques du parcours rejouées ; aucune unicité ou impossibilité globale affirmée.')=>checks.push({level,name,status:'passed',observed,scope});
const at=(n,k)=>replay(designs[n].spec,designs[n].commands.slice(0,designs[n].stages[k].turn));
const one=(w,s,c)=>{const a=decodeCommand(c,s);return stepDetailed(w,s,a.id,a.data);};
const win=(n,commands)=>{const r=replay(designs[n].spec,commands);assert(r.state.complete);assert.equal(r.metrics.blocked,0);assert.equal(r.metrics.deaths,0);return r;};
for(const n of [6,7,8]){const d=designs[n],r=win(n,d.commands);assert.equal(r.world.heroes.length,4);assert.equal(r.world.goals.length,4);assert.deepEqual(r.actions,d.actions);ok(n,'Parcours complet sans refus ni décès',r.metrics);}

{
 const d=designs[6],all=win(6,d.commands),swaps=all.trace.flatMap(t=>t.phases).filter(p=>p.kind==='swap');assert.equal(swaps.length,1);
 assert.deepEqual(new Set(swaps[0].moves.map(m=>`${m.from.x},${m.from.y}`)),new Set(swaps[0].moves.map(m=>`${m.to.x},${m.to.y}`)));
 assert(swaps[0].moves.every(m=>m.actor==='hero'));
 ok(6,'L’échange initial conserve les deux positions occupées',{moves:swaps[0].moves},'Cet échange change les rôles présents sur les îlots, sans ajouter d’occupant ni créer de franchissement.');
 const opened=at(6,0);assert(circuitPressed(opened.world,opened.state,'lancement'));assert(!opened.state.gateClosed[0]);
 const early=new Author(d.spec).act(d.commands.slice(0,d.stages[0].turn)).act('DDR');assert(!circuitPressed(early.world,early.state,'lancement'));assert(early.state.gateClosed[0]);
 assert(early.state.heroes.filter(h=>['merchant','thief'].includes(h.kind)).every(h=>h.at.x<7));
 const closed={gateClosed:early.state.gateClosed[0],westHeroes:early.state.heroes.filter(h=>['merchant','thief'].includes(h.kind)).map(h=>({kind:h.kind,at:h.at}))};
 early.act('L');assert(circuitPressed(early.world,early.state,'lancement'));assert(!early.state.gateClosed[0]);
 ok(6,'Retirer trop tôt la commande ferme le départ ; revenir la rétablit',{counterBranch:'DDR',closed,repair:'L',reopened:true},'Branche locale réversible avant le transfert des deux héros occidentaux ; ce n’est pas une preuve d’impasse.');
 const first=at(6,1),second=at(6,2),third=at(6,3),ready=at(6,4);
 assert.deepEqual(first.state.supports,[{x:7,y:5}]);assert.deepEqual(second.state.supports,[{x:7,y:5},{x:10,y:9}]);assert.deepEqual(third.state.supports,[{x:7,y:5},{x:10,y:9},{x:13,y:12}]);
 for(const t of all.trace)assert.equal(t.after.stones.length+t.after.supports.length,4);
 assert.deepEqual(ready.state.stones,[{x:11,y:11}]);assert(circuitPressed(ready.world,ready.state,'arrivee'));assert(ready.state.supports.every(p=>terrainAt(ready.world,p)==='~'));
 ok(6,'Quatre caisses affectées à trois franchissements et un poids sec',{supports:ready.state.supports,dryWeight:ready.state.stones[0],crateResourceCount:4},'Comptabilité exacte du parcours : les caisses immergées restent présentes comme appuis fixes.');
 assert(first.state.heroes.filter(h=>['merchant','thief'].includes(h.kind)).every(h=>h.at.x>7));assert(second.state.gateClosed[0]);
 ok(6,'Le départ ne se referme qu’après le passage des deux opérateurs',{crossed:first.state.heroes.filter(h=>['merchant','thief'].includes(h.kind)).map(h=>h.at),gateClosedAfterReuse:second.state.gateClosed[0]});
}

{
 const d=designs[7],all=win(7,d.commands),drop=all.trace.find(t=>t.before.monsters.length===1&&t.after.monsters.length===0);assert(drop);
 assert.deepEqual(drop.before.monsters,[{x:10,y:9}]);assert(platformActive(all.world,drop.before,0));assert(!platformActive(all.world,drop.after,0));assert(!drop.after.dead);
 assert.deepEqual(drop.phases.map(p=>p.kind),['walk','gate','platform']);
 const transported=all.trace.flatMap(t=>t.phases).find(p=>p.kind==='swap'&&p.moves.some(m=>m.actor==='monster'));assert(transported);assert(transported.moves.some(m=>m.actor==='monster'&&equal(m.to,{x:10,y:9})));
 ok(7,'Le gardien est transporté avant le retrait de son soutien',{transport:transported.moves,platformBefore:true,platformAfter:false,monsterLost:true,heroesAlive:true},'Le retrait d’eau, et non un combat de contact, élimine ce gardien dans le parcours.');
 const relay=at(7,1);assert.deepEqual(relay.state.heroes[2].at,{x:10,y:7});assert(relay.state.heroes[3].at.y>9);assert(platformActive(relay.world,relay.state,0));assert(relay.state.gateClosed[0]);
 ok(7,'Le relais magique précède la fermeture du sas inférieur',{thief:relay.state.heroes[2].at,wizard:relay.state.heroes[3].at,platformActive:true,lowerGateClosed:true});
 const permanent=at(7,2);assert.deepEqual(permanent.state.supports,[{x:10,y:9}]);assert.equal(permanent.state.stones.length,2);assert(!platformActive(permanent.world,permanent.state,0));assert(!permanent.state.gateClosed[0]);
 const raised=one(permanent.world,permanent.state,'U');assert(!raised.state.failed&&!raised.state.dead);assert(platformActive(permanent.world,raised.state,0));assert.deepEqual(raised.state.supports,permanent.state.supports);
 const lowered=one(permanent.world,raised.state,'D');assert(!lowered.state.failed&&!lowered.state.dead);assert(!platformActive(permanent.world,lowered.state,0));assert.deepEqual(lowered.state.supports,permanent.state.supports);
 ok(7,'L’appui fixe survit à une nouvelle activation et au retrait',{support:{x:10,y:9},counterBranch:'UD',preservedOnBothTransitions:true},'Contrat SRA explicite : l’appui immergé n’est pas écrasé par le redéploiement de la plateforme.');
 const oneWeight=at(7,3),twoWeights=at(7,4);assert(!circuitPressed(oneWeight.world,oneWeight.state,'fronton'));assert(oneWeight.state.gateClosed[1]);assert(circuitPressed(twoWeights.world,twoWeights.state,'fronton'));assert(!twoWeights.state.gateClosed[1]);
 assert.deepEqual(twoWeights.state.stones,[{x:9,y:4},{x:11,y:4}]);assert.deepEqual(twoWeights.state.supports,[{x:10,y:9}]);
 ok(7,'Les deux caisses sèches ouvrent ensemble le fronton',{oneWeightClosed:true,twoWeightsOpen:true,stones:twoWeights.state.stones,support:twoWeights.state.supports});
 const alternate=new Author(d.spec).act(d.commands.slice(0,d.stages[4].turn));alternate.go(12,1,'merchant').go(9,1,'warrior').go(11,1,'thief').go(8,1,'wizard');
 ok(7,'Variante gagnante : le Marchand évacue avant les autres',win(7,alternate.commands).metrics,'L’ordre final de stationnement reste libre lorsque les deux charges sont en place.');
}

{
 const d=designs[8],all=win(8,d.commands),pistons=all.trace.flatMap(t=>t.phases).filter(p=>p.kind==='piston');
 assert.equal(pistons.length,2);assert.deepEqual(pistons.map(p=>p.moves),[[{actor:'monster',from:{x:12,y:7},to:{x:13,y:7}}],[{actor:'monster',from:{x:13,y:7},to:{x:14,y:7}}]]);
 assert(all.trace.every(t=>t.after.monsters.length===1));
 ok(8,'Deux presses distinctes placent le gardien sur sa commande',{presses:pistons.map(p=>({gate:all.world.gates[p.gateIndex].at,moves:p.moves})),monsterPreservedThroughout:true},'Le gardien reste vivant et immobilisé sur son poids final dans tout le parcours.');
 const delivered=at(8,1),last=delivered.trace.at(-1);assert.equal(last.command,'X');assert(last.phases.some(p=>p.kind==='reflect'&&p.moves.some(m=>m.actor==='stone'&&equal(m.to,{x:8,y:5}))));
 assert.equal(delivered.metrics.stoneSwaps,4);assert(delivered.state.stones.some(p=>equal(p,{x:8,y:5})));
 const stored=at(8,2);assert(stored.state.stones.some(p=>equal(p,{x:12,y:14})));assert(!stored.state.stones.some(p=>equal(p,{x:8,y:5})));
 const reflectedHeroes=all.trace.flatMap(t=>t.phases).filter(p=>p.kind==='reflect').flatMap(p=>p.moves.filter(m=>m.actor==='hero'));
 assert.equal(reflectedHeroes.length,1);assert.deepEqual(reflectedHeroes[0],{actor:'hero',from:{x:7,y:4},to:{x:8,y:5}});
 ok(8,'Le quai reçoit la caisse, est dégagé, puis reçoit le Magicien',{crateArrival:{x:8,y:5},storedCrate:{x:12,y:14},heroArrival:reflectedHeroes[0]},'Ordre causal du témoin : la traction libère la case que le reflet du Magicien réutilise.');
 const bridge=at(8,3),ready=at(8,4);assert.deepEqual(bridge.state.supports,[{x:15,y:16}]);assert(!circuitPressed(bridge.world,bridge.state,'arrivee'));
 assert.deepEqual(ready.state.stones,[{x:12,y:14},{x:10,y:10}]);assert.deepEqual(ready.state.monsters,[{x:14,y:7}]);assert(circuitPressed(ready.world,ready.state,'arrivee'));assert(!ready.state.gateClosed[3]);
 for(const t of all.trace)assert.equal(t.after.stones.length+t.after.supports.length,3);
 ok(8,'Trois poids secs et un appui remplissent des fonctions différentes',{dryCrates:ready.state.stones,monsterWeight:ready.state.monsters[0],support:ready.state.supports[0],gateOpen:true},'Le gardien fournit le troisième poids sec ; les trois caisses deviennent deux poids et un appui dans la solution qualifiée.');
 const alternate=new Author(d.spec).act(d.commands.slice(0,d.stages[4].turn));alternate.go(16,18,'merchant').go(18,14,'thief').go(16,14,'warrior').go(18,18,'wizard');
 ok(8,'Variante gagnante : départ collectif dans un ordre différent',win(8,alternate.commands).metrics);
}

// Preserve the original textual adaptation while adding reproducible review findings.
for(const n of [6,7,8]){
 if(typeof designs[n].adaptation==='string')designs[n].adaptation={description:designs[n].adaptation};
 designs[n].adaptation.localChecks=checks.filter(c=>c.level===n).map(({level,...c})=>c);
 writeFileSync(new URL(`../level${n}-design.json`,import.meta.url),JSON.stringify(designs[n],null,2)+'\n');
}
const report={game:'SS21',success:true,levels:[6,7,8],method:'Rejeu des allocations de ressources, transitions hydrauliques, presses, relèves et variantes finales.',limits:['Aucune solution unique ou optimale n’est revendiquée.','Les contraintes constatées dans le témoin ne prouvent pas que chaque capacité est indispensable dans tous les plans.','Les branches de retrait et de réactivation sont locales et réparables.'],checks};
writeFileSync(new URL('../final-ss21-review.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({success:true,checks:checks.length,passed:checks.length,report:'reference/final-ss21-review.json'}));
