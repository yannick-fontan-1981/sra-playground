/** Author-only counterfactual review. Not imported by the playable bundle. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {compileLevel,initialState,stepDetailed,planReflection,terrainAt,equal,circuitPressed} from '../dist/core.js';
import {replay,decodeCommand} from './solver.mjs';

const onlySeven=process.argv.includes('--level7-only');
const checks=[],sources=[],witnesses=[];
const at=(p,x,y)=>p?.x===x&&p?.y===y;
const hero=(s,kind)=>s.heroes.find(h=>h.kind===kind);
const pointKey=p=>p.y*20+p.x;
const snapshot=(d,s)=>({heroes:s.heroes.map(h=>({kind:h.kind,at:h.at,dead:!!h.dead})),stones:s.stones,mirrors:s.mirrors,supports:s.supports,monsters:s.monsters,active:s.heroes[s.active]?.kind,gateClosed:s.gateClosed,platformActive:s.platformActive,dead:s.dead,complete:s.complete,circuits:Object.fromEntries(d.world.circuits.map(c=>[c.id,circuitPressed(d.world,s,c.id)]))});
function load(level){
 const path=new URL(`../reference/level${level}-design.json`,import.meta.url),bytes=readFileSync(path),data=JSON.parse(bytes),full=replay(data.spec,data.commands);
 assert.ok(full.state.complete&&!full.state.dead,`L${level}: reference must win`);assert.equal(full.metrics.blocked,0,`L${level}: reference refuses no action`);assert.equal(full.metrics.deaths,0);
 sources.push({level,path:`reference/level${level}-design.json`,sha256:createHash('sha256').update(bytes).digest('hex')});
 witnesses.push({level,actions:data.actions.length,commands:data.commands.length,complete:true,refusals:0,deaths:0,scope:'Executed author route; neither a lower bound nor an optimality certificate.'});
 return {...data,level,world:compileLevel(data.spec),full};
}
const stateAfter=(d,turn)=>turn?d.full.trace[turn-1].after:initialState(d.world);
function branch(d,turn,commands){
 let state=stateAfter(d,turn);const start=state,steps=[];
 for(const command of commands){const action=decodeCommand(command,state),detail=stepDetailed(d.world,state,action.id,action.data);state=detail.state;steps.push({command,action,refused:state.failed,dead:state.dead,phases:detail.phases.map(p=>p.kind),moves:detail.phases.flatMap(p=>p.moves)});}
 return {state,start,steps,evidence:{kind:'executed-author-prefix-branch',afterTurn:turn,commands,startingState:snapshot(d,start),steps,result:snapshot(d,state)}};
}
const legal=r=>!r.state.dead&&r.steps.every(s=>!s.refused);
function check(id,level,claim,condition,evidence){assert.ok(condition,id);checks.push({id,level,status:'PASS',claim,evidence});}

const l7=load(7);
const initialX=branch(l7,0,'X');
check('l7-initial-reflection-refuses',7,'Dans la disposition initiale testée, X ne trouve aucun transfert et ne déplace aucun occupant.',
 initialX.steps[0].refused&&!initialX.state.dead&&initialX.steps[0].moves.length===0,initialX.evidence);
const withdrawn=branch(l7,0,'LUUURU'),substitute=branch(l7,0,'LUUURUCDR');
check('l7-early-mirror-removal-closes-reserve',7,'Cette traction précoce retire le miroir de sa commande et ferme la réserve avant extraction de la caisse.',
 legal(withdrawn)&&!circuitPressed(l7.world,withdrawn.state,'reserve')&&at(withdrawn.state.mirrors[0].at,5,14)&&at(withdrawn.state.stones[0],15,5),withdrawn.evidence);
check('l7-bard-can-substitute-for-reserve-mirror',7,'Le Barde peut réellement remplacer le miroir comme poids temporaire de la réserve. Cette branche ne gagne pas le niveau.',
 legal(substitute)&&circuitPressed(l7.world,substitute.state,'reserve')&&at(hero(substitute.state,'bard').at,5,15)&&at(substitute.state.mirrors[0].at,5,14)&&!substitute.state.complete,substitute.evidence);
const oldCrossing=branch(l7,20,'CRUUUUUULU');
check('l7-original-crossing-refuses-after-support-departure',7,'Quand l’appui dessert le bras nord, cette approche du Voleur refuse le pas vers l’ancien passage (5,10). Aucune impossibilité de récupération n’est déduite.',
 !oldCrossing.state.dead&&oldCrossing.steps.filter(s=>s.refused).length===1&&oldCrossing.steps.at(-1).refused&&at(hero(oldCrossing.state,'thief').at,5,11)&&at(oldCrossing.state.supports[0],10,5),oldCrossing.evidence);
const bank=branch(l7,20,'L');
check('l7-support-cannot-be-sung-onto-dry-bank',7,'Le pas gauche du Barde réussit mais l’appui reste sur l’eau (10,5), sa destination (9,5) étant sèche.',
 legal(bank)&&at(hero(bank.state,'bard').at,7,4)&&at(bank.state.supports[0],10,5)&&!bank.steps.flatMap(s=>s.moves).some(m=>m.actor==='support'),bank.evidence);
const immersed=branch(l7,41,'RUUUR'),immobile=branch(l7,41,'RUUURR');
check('l7-sacrificed-crate-becomes-support',7,'Cette branche transforme la seule caisse sèche en appui isolé (4,2). Le pas suivant ne le fait pas remonter sur l’île sèche (5,2).',
 legal(immersed)&&legal(immobile)&&immersed.state.stones.length===0&&immersed.state.supports.length===2&&immobile.state.supports.some(p=>at(p,4,2))&&!immobile.steps.at(-1).moves.some(m=>m.actor==='support'),
 {immersion:immersed.evidence,nextStep:immobile.evidence,scope:'A resource conversion and one attempted dry-bank slide, not a global unsolvability result.'});
const anchored=branch(l7,77,'CL'),earlyX=branch(l7,77,'X');
check('l7-occupied-support-anchors-during-song',7,'Le pas latéral testé du Barde garde l’appui sous le Voleur ; le mur retient aussi le partenaire. Aucun pouvoir ne se déclenche sur le miroir.',
 legal(anchored)&&at(hero(anchored.state,'thief').at,5,10)&&at(anchored.state.supports[0],5,10)&&at(anchored.state.mirrors[0].at,5,11),anchored.evidence);
check('l7-early-reflection-is-legal-and-changes-river-bank',7,'X est légal à ce point précoce : il ramène le Voleur en (4,11), côté sud-ouest, sans ouvrir la porte finale.',
 legal(earlyX)&&at(hero(earlyX.state,'thief').at,4,11)&&earlyX.steps[0].phases.includes('reflect')&&!circuitPressed(l7.world,earlyX.state,'deux-poids')&&!earlyX.state.complete,earlyX.evidence);
const islandPull=branch(l7,89,'LU');
check('l7-mirror-haul-toward-island-refuses-at-water',7,'Depuis la position du miroir réemployé, le Voleur ne peut pas le tracter au nord : son arrivée (5,3) n’a aucun appui dans cette branche.',
 !islandPull.state.dead&&islandPull.steps.at(-1).refused&&at(hero(islandPull.state,'thief').at,5,4)&&at(islandPull.state.mirrors[0].at,5,5),islandPull.evidence);
const heroWeight=branch(l7,89,'CRRULCLLLDLX'),heroLeaves=branch(l7,89,'CRRULCLLLDLXX');
check('l7-hero-can-temporarily-replace-crate-on-island',7,'Après dégagement de la caisse, le Voleur est le plus proche du miroir et atteint l’île par reflet. Il ouvre la porte comme poids temporaire ; le reflet retour la referme.',
 legal(heroWeight)&&legal(heroLeaves)&&at(hero(heroWeight.state,'thief').at,5,2)&&circuitPressed(l7.world,heroWeight.state,'deux-poids')&&at(hero(heroLeaves.state,'thief').at,2,5)&&!circuitPressed(l7.world,heroLeaves.state,'deux-poids')&&at(heroWeight.state.stones[0],1,5)&&!heroWeight.state.complete&&!heroLeaves.state.complete,
 {weight:heroWeight.evidence,departure:heroLeaves.evidence,scope:'Executed temporary substitution. No alternative winning route is asserted.'});

/** Deliberately permissive synthetic geometry, not a reachable campaign state.
 * Both actors retain their roles; the inactive actor is kept off both mirror axes.
 * Water placements receive synthetic supports, all other gates are open, and the
 * final gate is closed. This isolates a single reflection across that boundary. */
function closedChamberReflectionProbe(d,circuit,facing='NW'){
 const horizontal=facing==='NE'?1:-1;
 const gate=d.world.gates.find(g=>g.circuit===circuit);assert.ok(gate);
 const chamber=new Set(),queue=[d.world.goals[0]];
 while(queue.length){const p=queue.shift();if(chamber.has(pointKey(p))||terrainAt(d.world,p)!=='.'||equal(p,gate.at))continue;chamber.add(pointKey(p));for(const[x,y]of[[1,0],[-1,0],[0,1],[0,-1]])queue.push({x:p.x+x,y:p.y+y});}
 const accepted=[],rejected=[];let mirrorPlacements=0;
 for(let my=0;my<20;my++)for(let mx=0;mx<20;mx++){
  const mirror={x:mx,y:my};if(terrainAt(d.world,mirror)==='#')continue;mirrorPlacements++;
  for(let distance=1;distance<20;distance++)for(let side=0;side<2;side++){
   const from=side?{x:mx+horizontal*distance,y:my}:{x:mx,y:my-distance},to=side?{x:mx,y:my-distance}:{x:mx+horizontal*distance,y:my};
   if(terrainAt(d.world,from)==='#'||terrainAt(d.world,to)==='#'||chamber.has(pointKey(from))||!chamber.has(pointKey(to)))continue;
   let other;for(let y=0;y<20&&!other;y++)for(let x=0;x<20&&!other;x++)if(x!==mx&&y!==my&&terrainAt(d.world,{x,y})==='.')other={x,y};assert.ok(other);
   const state={...initialState(d.world),heroes:[{kind:'thief',at:from,facing:'N'},{kind:'bard',at:other,facing:'N'}],stones:[],monsters:[],mirrors:[{at:mirror,facing}],supports:[mirror,from].filter(p=>terrainAt(d.world,p)==='~'),gateClosed:d.world.gates.map(g=>g.circuit===circuit),failed:false,dead:false,complete:false};
   const plan=planReflection(d.world,state),candidate={mirror,from,to,distance};
   (plan?.moves.some(m=>m.actor==='hero'&&equal(m.from,from)&&equal(m.to,to))?accepted:rejected).push(candidate);
  }
 }
 return {kind:'exhaustive-single-reflection-geometry-with-synthetic-supports',facing,finalGate:gate.at,chamberCells:chamber.size,mirrorPlacements,candidates:accepted.length+rejected.length,accepted,rejected,scope:'Tests one reflection in the stated orientation with the final gate closed. Does not establish route optimality, global necessity, reachability of synthetic placements or absence of other multi-action strategies.'};
}
const geometry=closedChamberReflectionProbe(l7,'deux-poids');
check('l7-no-direct-nw-reflection-through-closed-chamber-boundary',7,'Aucun des couples géométriques testés ne fournit un reflet NW direct depuis l’extérieur vers la chambre finale fermée.',geometry.candidates===23&&geometry.accepted.length===0,geometry);

if(!onlySeven){
 const l8=load(8),turn=needle=>{const stage=l8.stages.find(s=>s.label.includes(needle));assert.ok(stage,needle);return stage.turn;};
 const choirTurn=turn('Les deux gardiens occupent'),loadedTurn=turn('Le chant charge la presse'),borrowTurn=turn('Le Voleur rejoint le flanc'),retuneTurn=turn('Les deux gardiens changent'),recenterTurn=turn('Le Voleur replace le Barde'),anchorTurn=turn('Le Voleur revient ancrer'),crossedTurn=turn('Le chant emporte le Voleur');
 const chorusDeparture=branch(l8,choirTurn,'D'),forcedExit=branch(l8,choirTurn,l8.commands.slice(choirTurn,turn('Le Voleur extrait le Barde sans chant')));
 check('l8-voluntary-departure-moves-living-weights',8,'Après le premier accord, un pas volontaire du Barde déplace les deux gardiens et retire le pont provisoire.',
  legal(chorusDeparture)&&!circuitPressed(l8.world,chorusDeparture.state,'choeur')&&chorusDeparture.state.monsters.every(p=>p.y===6)&&chorusDeparture.state.platformActive.slice(0,2).every(v=>!v),chorusDeparture.evidence);
 check('l8-forced-departure-keeps-living-weights',8,'La sortie forcée exécutée conserve les deux gardiens sur leurs commandes et le pont actif, sans chant récursif.',
  legal(forcedExit)&&circuitPressed(l8.world,forcedExit.state,'choeur')&&forcedExit.state.monsters.every(p=>p.y===5)&&forcedExit.steps.some(s=>s.phases.includes('pull'))&&!forcedExit.steps.some(s=>s.phases.includes('song')),forcedExit.evidence);
 for(const [side,commands]of [['north','DRDDU'],['south','LDDDDDRRD']]){
  const attempt=branch(l8,0,commands);
  check(`l8-${side}-mirror-extraction-is-returned-by-press`,8,'Cette extraction latérale testée est suivie d’une presse qui ramène le miroir sur sa commande initiale.',
   legal(attempt)&&at(attempt.state.mirrors[0].at,6,14)&&circuitPressed(l8.world,attempt.state,'presse')&&attempt.steps.some(s=>s.phases.includes('piston')),attempt.evidence);
 }
 const west=branch(l8,loadedTurn,'L'),south=branch(l8,loadedTurn,'D'),southTwice=branch(l8,loadedTurn,'DD'),southReturn=branch(l8,loadedTurn,'DU'),southReflect=branch(l8,loadedTurn,'DDX');
 check('l8-loaded-west-song-refuses',8,'À ce point de chargement, le pas ouest du Barde est refusé et la caisse reste sur la presse. Ce seul refus n’établit aucune nécessité globale de la presse.',
  west.steps[0].refused&&!west.state.dead&&at(west.state.stones[0],11,14),west.evidence);
 check('l8-loaded-south-song-is-a-valid-alternative-preparation',8,'Le départ sud est légal : il déplace la caisse et le premier appui et libère la commande de charge. Un retour nord rétablit les positions et commandes initiales.',
  legal(south)&&legal(southReturn)&&at(south.state.stones[0],11,15)&&at(south.state.supports[0],9,15)&&!circuitPressed(l8.world,south.state,'charge')&&JSON.stringify(snapshot(l8,southReturn.state))===JSON.stringify(snapshot(l8,southReturn.start)),
  {departure:south.evidence,return:southReturn.evidence,scope:'Successful alternative local preparation and reversal, without an alternative winning route.'});
 check('l8-bard-can-temporarily-substitute-for-loaded-crate',8,'Un second pas sud place le Barde lui-même sur la commande de charge ; la caisse reste en (11,15) et l’appui avance en (9,16). Le reflet immédiat testé est refusé.',
  legal(southTwice)&&at(hero(southTwice.state,'bard').at,11,14)&&circuitPressed(l8.world,southTwice.state,'charge')&&at(southTwice.state.stones[0],11,15)&&at(southTwice.state.supports[0],9,16)&&southReflect.steps.at(-1).refused&&!southReflect.state.dead,
  {substitution:southTwice.evidence,reflection:southReflect.evidence,scope:'A real temporary actor/weight substitution; no impossibility of later recovery is inferred.'});
 const cascade=branch(l8,borrowTurn,'R');
 check('l8-loaded-cascade-creates-support-and-transports-mirror',8,'Dans cette cascade exécutée, la reprise du miroir immerge la caisse en (10,14), pousse le miroir en (8,14) et le Voleur sur l’appui (9,14), puis déploie le parvis hydraulique.',
  legal(cascade)&&cascade.state.stones.length===0&&cascade.state.supports.some(p=>at(p,9,14))&&cascade.state.supports.some(p=>at(p,10,14))&&at(cascade.state.mirrors[0].at,8,14)&&at(hero(cascade.state,'thief').at,9,14)&&cascade.steps[0].phases.filter(p=>p==='piston').length===2,cascade.evidence);
 const alteredCommands=l8.commands.slice(0,borrowTurn).replace('X','')+'R',withoutFirstReflection=replay(l8.spec,alteredCommands),firstHarm=withoutFirstReflection.trace.findIndex(t=>t.after.failed||t.after.dead);
 check('l8-omitting-first-reflection-drowns-thief-in-replayed-cascade',8,'En omettant uniquement le premier X et en rejouant cette séquence précise jusqu’à la reprise du miroir, le Voleur meurt sur (9,14), tandis que le second appui est créé.',
  withoutFirstReflection.metrics.blocked===0&&withoutFirstReflection.metrics.deaths===1&&firstHarm===withoutFirstReflection.trace.length-1&&hero(withoutFirstReflection.state,'thief').dead&&at(hero(withoutFirstReflection.state,'thief').at,9,14)&&withoutFirstReflection.state.supports.length===1&&at(withoutFirstReflection.state.supports[0],10,14),
  {kind:'executed-witness-with-one-action-omitted',omittedAction:'first X',commands:alteredCommands,firstHarmAt:firstHarm+1,refusals:withoutFirstReflection.metrics.blocked,deaths:withoutFirstReflection.metrics.deaths,beforeCascade:snapshot(l8,withoutFirstReflection.trace.at(-1).before),afterCascade:snapshot(l8,withoutFirstReflection.state),phases:withoutFirstReflection.trace.at(-1).phases.map(p=>p.kind),scope:'Only this edited sequence is shown to fail. Other bridge preparations are not ruled out.'});
 const badBridge=branch(l8,recenterTurn,'LLLLDDDDDDRRRRRRRRCD');
 check('l8-retuning-while-partner-waits-on-bridge-drowns-him',8,'Cette branche place le Voleur sur le pont provisoire avant le changement de poste des gardiens ; le premier pas du Barde retire son appui hydraulique et le noie.',
  badBridge.steps.every(s=>!s.refused)&&badBridge.steps.at(-1).dead&&!badBridge.steps.slice(0,-1).some(s=>s.dead)&&hero(badBridge.state,'thief').dead&&at(hero(badBridge.state,'thief').at,9,8),badBridge.evidence);
 const finalDeparture=branch(l8,retuneTurn,'D');
 check('l8-final-voluntary-song-removes-two-required-local-weights',8,'Dans la position finale préparée, un pas volontaire du Barde déplace les deux gardiens en rangée8 et referme la porte. Le miroir reste sur son poids en (14,4).',
  legal(finalDeparture)&&finalDeparture.state.monsters.every(p=>p.y===8)&&!circuitPressed(l8.world,finalDeparture.state,'dernier-accord')&&at(finalDeparture.state.mirrors[0].at,14,4),finalDeparture.evidence);
 const leavesAnchor=branch(l8,anchorTurn,'U'+l8.commands.slice(anchorTurn,crossedTurn));
 check('l8-leaving-anchor-disrupts-the-tested-bard-crossing',8,'En avançant le Voleur d’un pas au nord avant la même approche du Barde, cette séquence rencontre des refus à la remontée ; les deux appuis ont changé de place.',
  !leavesAnchor.state.dead&&leavesAnchor.steps.some(s=>s.refused)&&at(hero(leavesAnchor.state,'bard').at,9,15)&&!leavesAnchor.state.supports.some(p=>at(p,9,14)),
  {...leavesAnchor.evidence,scope:'An explicit failure of the reused suffix, not a claim that the resulting position is unsolvable.'});
 const neGeometry=closedChamberReflectionProbe(l8,'dernier-accord','NE');
 check('l8-no-direct-ne-reflection-through-closed-chamber-boundary',8,'Aucun des couples géométriques testés ne fournit un reflet NE direct depuis l’extérieur vers la chambre finale fermée.',neGeometry.candidates>0&&neGeometry.accepted.length===0,neGeometry);
}
const report={schemaVersion:1,success:true,scope:onlySeven?'Independent L7 local counterfactuals and isolated reflection geometry.':'Independent final-room local counterfactuals and isolated reflection geometry.',requiredLevels:onlySeven?[7]:[7,8],
 limitations:['Author witnesses and their action counts are existence checks, not difficulty or optimality proofs.','Successful local substitutions are reported as successes, not suppressed to preserve the intended solution.','Failed branches establish only the actions and states shown; no global necessity or unsolvability is inferred.','The reflection boundary probe uses explicitly synthetic supports and poses; it is limited to one reflection while the final gate is closed.','No BFS, state cap or time limit is used as evidence of necessity.','These artifacts are author validation only and are never part of SRA observations.'],
 sources,witnesses,passed:checks.length,total:checks.length,checks};
mkdirSync(new URL('../validation/',import.meta.url),{recursive:true});writeFileSync(new URL('../validation/design-constraints-report.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({report:'validation/design-constraints-report.json',levels:report.requiredLevels,passed:report.passed,total:report.total,scope:report.scope}));
