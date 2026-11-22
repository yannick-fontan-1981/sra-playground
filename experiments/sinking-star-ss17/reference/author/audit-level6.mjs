/** Independent review: this script never mutates the authored level. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {compileLevel,initialState,stepDetailed,TrioPuzzleSession,terrainAt,supported,circuitPressed} from '../../dist/core.js';
import {replay,stateKey} from '../../scripts/solver.mjs';

const design=JSON.parse(readFileSync(new URL('../level6-design.json',import.meta.url),'utf8'));
const same=(a,b)=>a.x===b.x&&a.y===b.y,at=(x,y)=>({x,y});
const role=(s,kind)=>s.heroes.find(h=>h.kind===kind),gatePosition=at(18,14);
const historicalSpec={...design.spec,gates:design.spec.gates.filter(g=>!same(g.at,gatePosition))};
const proposedGate={at:gatePosition,circuit:'retenue',direction:'S',closedWhen:'pressed'};
const correctedSpec={...historicalSpec,gates:[...historicalSpec.gates,proposedGate]};
assert.deepEqual(design.spec,correctedSpec,'The authored level must include the reviewed correction.');
const digest=spec=>createHash('sha256').update(JSON.stringify(spec)).digest('hex');
const solved=r=>r.state.complete&&!r.metrics.blocked&&!r.metrics.deaths;
const summarize=r=>({complete:r.state.complete,metrics:r.metrics,heroes:r.state.heroes,supports:r.state.supports,monsters:r.state.monsters,stones:r.state.stones,mirrors:r.state.mirrors,gateClosed:r.state.gateClosed,platformActive:r.state.platformActive});
const original=replay(historicalSpec,design.commands),reference=replay(correctedSpec,design.commands);
assert.equal(design.commands.length,170);assert.ok(solved(original));assert.ok(solved(reference));assert.deepEqual(reference.metrics,original.metrics);

// First counterexample: keep the hydraulic key in place, substitute the three
// free crates for the mirror weights, and relocate the guardian with one spell.
const simpleCommands='DRRRRRRRDDDDDRRRRRRDDLDRUUURRCCDDRRRRRDDDDRDDRRRRRDRDCCDDDLRRRURRRUUDDDDLULDCCULLLLLLLLUUUUULUULLLLULDDDLDRRRRRRURDDDDDLDRRRRURDCCRRUUUCRRRDRDDRRDDDCDRRRDDDDDRRRRRRRDRDDR';
const historicalAlternative=replay(historicalSpec,simpleCommands),refusedAlternative=replay(correctedSpec,simpleCommands);
assert.equal(simpleCommands.length,170);assert.ok(solved(historicalAlternative));
for(const field of ['reflections','bentSwaps','mirrorMoves','platformsCreated','monstersRemoved'])assert.equal(historicalAlternative.metrics[field],0);
assert.equal(historicalAlternative.metrics.monsterSwaps,1);assert.equal(refusedAlternative.state.complete,false);
const firstRefusal=refusedAlternative.trace.findIndex(t=>t.after.failed||t.after.dead);assert.equal(firstRefusal+1,133);

// Follow-up was a constructive, targeted ferry attempt, not a global search.
// Relocate the guardian in three spells onto (12,13), extract the hydraulic key,
// ferry the Thief across the withdrawn platforms, then return the Wizard by
// swapping with a prepared crate before the lower mirror is reached by the ray.
const ferryCommands='DRRRRRRRDDDDDRRRRRRDDLDRUUUULCCDDRRRRRDDDDDRDDDDRRRRRRRULLDDLLRUUULLLLDCCDDDLRRRURRRUUDDDDLULDCCLLLLLUUUUULUULLLLULDDDLDRRRRRRURDDDDDRDDDDRRRRDRRRCUUDDRRDRCLUULUUULLUCCRCDCURRDDDCCRDDDDRRRRRRRURRUUUCCDDDDDRRRRRRRUR';
const ferry=replay(correctedSpec,ferryCommands);
assert.equal(ferryCommands.length,214);assert.ok(solved(ferry));
for(const field of ['reflections','bentSwaps','mirrorMoves','platformsCreated','monstersRemoved'])assert.equal(ferry.metrics[field],0);
assert.equal(ferry.metrics.monsterSwaps,3);assert.equal(ferry.metrics.partnerSwaps,1);assert.equal(ferry.metrics.stoneSwaps,1);
assert.deepEqual(ferry.state.monsters,[at(12,13)]);assert.deepEqual(ferry.state.platformActive,[false,false,false]);

const final=reference.trace.at(-1),pull=final.phases[0],press=final.phases[1];
assert.equal(final.command,'R');assert.deepEqual(final.phases.map(p=>p.kind),['pull','piston']);
assert.deepEqual(role(final.before,'thief').at,at(16,15));assert.deepEqual(final.before.stones,[at(15,15)]);
assert.equal(circuitPressed(reference.world,final.before,'trois-lests'),true);
assert.deepEqual(pull.moves,[{actor:'hero',from:at(16,15),to:at(17,15)},{actor:'stone',from:at(15,15),to:at(16,15)}]);
assert.equal(press.gateIndex,1);assert.deepEqual(press.moves,[{actor:'hero',from:at(17,15),to:at(18,15)}]);
assert.deepEqual(role(final.after,'thief').at,at(18,15));assert.deepEqual(final.after.stones,[at(16,15)]);
assert.equal(circuitPressed(reference.world,final.after,'trois-lests'),false);assert.equal(final.after.gateClosed[1],true);assert.equal(final.after.complete,true);
// The press moves only the Thief: it does not trigger another rear traction.
assert.deepEqual(press.after.stones,press.before.stones);assert.deepEqual(press.after.mirrors,press.before.mirrors);
const session=new TrioPuzzleSession([correctedSpec]);let beforeLast;
for(const [i,action] of reference.actions.entries()){if(i===reference.actions.length-1)beforeLast=session.observe();session.action(action.id,action.data);}
assert.equal(session.observe().state,'WIN');assert.deepEqual(session.undo(),beforeLast);
const finalObservation=session.action(4);assert.deepEqual(finalObservation.frameDurationsMs,[60,80,40,60,80,0]);assert.equal(finalObservation.frames.length,6);assert.deepEqual(finalObservation.frames.at(-1),finalObservation.frame);

const mirrorUses=reference.world.mirrors.map((mirror,index)=>{
 let swapRayVisits=0,reflectionPaths=0,motionSteps=0;
 for(const t of reference.trace)for(const phase of t.phases){const before=phase.before.mirrors[index];
  if(phase.kind==='swap')swapRayVisits+=(phase.paths?.[0]??[]).filter(p=>same(p,before.at)).length;
  if(phase.kind==='reflect')reflectionPaths+=(phase.paths??[]).filter(path=>path.some(p=>same(p,before.at))).length;
  motionSteps+=phase.moves.filter(m=>m.actor==='mirror'&&same(m.from,before.at)).length;
 }
 const end=reference.state.mirrors[index];assert.ok(swapRayVisits>0);assert.ok(reflectionPaths>0);assert.ok(motionSteps>0);
 assert.ok(reference.world.circuits.find(c=>c.id==='trois-lests').buttons.some(p=>same(p,end.at)));
 return {index,initial:mirror,final:end,swapRayVisits,reflectionPaths,motionSteps,holdsFinalExitButton:true};
});

// Exact one-hero ordinary-walking graphs, with companions and props fixed.
const world=compileLevel(correctedSpec),start=initialState(world),walking=[];
for(let active=0;active<start.heroes.length;active++){
 const first={...start,active},queue=[first],seen=new Set([stateKey(first)]);let reachesAnyGoal=false;
 for(let head=0;head<queue.length;head++)for(const id of [1,2,3,4]){
  const detail=stepDetailed(world,queue[head],id),s=detail.state;
  if(s.failed||s.dead||detail.phases.some(p=>p.kind!=='walk'))continue;
  if(world.goals.some(p=>same(p,s.heroes[active].at)))reachesAnyGoal=true;
  const key=stateKey(s);if(!seen.has(key)){seen.add(key);queue.push(s);}
 }
 assert.equal(reachesAnyGoal,false);walking.push({hero:start.heroes[active].kind,states:seen.size,reachesAnyGoal,exhaustive:true,otherActors:'fixed'});
}
// Structural supplement for several walkers: the exit circuit has three empty
// plates, all farther than one step from the unique supported entrance. With
// props fixed, opening it uses all three heroes. The first departure closes it
// while the press cell is still empty, so walking alone cannot transfer anyone.
const exit=world.circuits.find(c=>c.id==='trois-lests'),entrance=at(17,15),actors=[...start.heroes.map(h=>h.at),...start.stones,...start.monsters,...start.mirrors.map(m=>m.at)];
assert.ok(exit.buttons.every(p=>!actors.some(a=>same(a,p))));
const distances=exit.buttons.map(p=>({button:p,manhattanToEntrance:Math.abs(p.x-entrance.x)+Math.abs(p.y-entrance.y)}));assert.ok(distances.every(d=>d.manhattanToEntrance>1));
const queue=start.heroes.map(h=>h.at),seen=new Set(queue.map(p=>`${p.x},${p.y}`));
for(let head=0;head<queue.length;head++)for(const [dx,dy] of [[0,-1],[0,1],[-1,0],[1,0]]){
 const p={x:queue[head].x+dx,y:queue[head].y+dy},key=`${p.x},${p.y}`;
 if(seen.has(key)||same(p,entrance)||terrainAt(world,p)==='#'||!supported(world,start,p))continue;seen.add(key);queue.push(p);
}
assert.ok(world.goals.every(p=>!seen.has(`${p.x},${p.y}`)));
const refusal=refusedAlternative.trace[firstRefusal];
const report={level:correctedSpec.id,review:'Independent of the level author; canonical route, concrete substitutions, final press, and initial walking.',
 historical:{sha256:digest(historicalSpec),spec:historicalSpec,referenceCommands:design.commands,reference:summarize(original),counterexample:{kind:'simple-crate-substitution',commands:simpleCommands,actions:historicalAlternative.actions,...summarize(historicalAlternative)}},
 correction:{addedGate:proposedGate,sha256:digest(correctedSpec),spec:correctedSpec,referenceCommands:design.commands,reference:summarize(reference),referenceUnchanged:true,
  oldCounterexample:{complete:refusedAlternative.state.complete,metrics:refusedAlternative.metrics,firstInvalidTurn:firstRefusal+1,firstInvalidCommand:refusal.command,hero:role(refusal.before,'wizard').at,reason:'La retenue hydraulique laisse la nouvelle presse fermée en (18,14) ; le Magicien ne peut pas rejoindre la destination supérieure.'}},
 finalThiefPress:{turn:170,command:'R',before:{thief:role(final.before,'thief').at,stone:final.before.stones,exitCircuitPressed:true},phases:final.phases.map(p=>({kind:p.kind,moves:p.moves,...(p.gateIndex!==undefined?{gateIndex:p.gateIndex}:{})})),after:{thief:role(final.after,'thief').at,stone:final.after.stones,exitCircuitPressed:false,exitPressClosed:true,complete:true},frameDurationsMs:finalObservation.frameDurationsMs,undoRestoresWholeFinalTurn:true,forcedPressTriggersNoAdditionalPull:true},
 canonicalMirrorUses:mirrorUses,
 initialWalking:{perHero:walking,structuralCertificate:{exitButtonsInitiallyEmpty:true,distances,uniqueSupportedEntrance:entrance,noGoalReachableWithEntranceRemoved:true,reachableCellsWithoutEntrance:seen.size,reason:'Sans déplacer les objets, les trois héros doivent occuper les trois plaques pour ouvrir le sas. Aucun ne peut atteindre la case de presse en un pas depuis sa plaque. Le premier départ referme donc un sas encore vide.'}},
 advancedAlternative:{kind:'guardian-weight-and-straight-ferry',commands:ferryCommands,actions:ferry.actions,...summarize(ferry),explanation:'Trois transpositions placent le gardien sur le lest (12,13). Une caisse reste sur le bouton nord et une autre sur le bouton proche du sas. Après retrait de la clef, le Magicien échange le Voleur par-dessus les trois cases d’eau puis revient grâce à une caisse préparée avant le miroir inférieur. Le détour exige 214 actions, dont cinq échanges, sans déplacer ni utiliser les miroirs.'},
 conclusions:[
 'Le témoin de 170 actions reste gagnant après ajout de la presse supérieure, avec exactement les mêmes mouvements et métriques.',
 'La dernière action du Voleur comporte une traction volontaire puis une projection forcée par la presse ; la caisse reste en (16,15), et Undo rétablit tout le tour.',
 'La substitution directe de 170 actions contournait les deux miroirs sur la carte historique. Elle échoue au tour 133 sur la carte corrigée.',
 'Une stratégie plus élaborée de 214 actions conserve néanmoins une solution sans miroirs, grâce au gardien-poids et à un ferry de transpositions droites.',
 'Aucune sortie initiale gratuite à pied ; aucune nécessité globale des miroirs, des appuis ou de la disparition du gardien n’est revendiquée.'
 ],limits:[
 'Aucune recherche exhaustive de toutes les solutions, aucun minimum global et aucune preuve que 214 actions soit le meilleur contournement restant.',
 'La recherche supplémentaire vise uniquement la construction du ferry concret identifié ; elle ne couvre pas toutes les substitutions possibles.',
 'Les graphes exhaustifs de marche fixent les autres acteurs ; le cas de plusieurs marcheurs est couvert séparément par le certificat de sas et des trois plaques.',
 'Les fonctions des deux miroirs sont garanties dans le témoin pédagogique, pas imposées artificiellement à toute stratégie valide.'
 ]};
writeFileSync(new URL('../level6-independent-review.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({level:report.level,referenceActions:design.commands.length,historicalAlternative:simpleCommands.length,oldCounterexampleBlockedAt:firstRefusal+1,correctedAlternative:ferryCommands.length,finalThiefPress:true,walking,mirrorUses}));
