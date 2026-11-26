/** Numeric-action audit. No Author, solver, route builder or replay helper. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {compileLevel,initialState,stepDetailed,equal,terrainAt,supported,circuitPressed,platformActive,gateClosed,cellToPixel} from '../../dist/core.js';
import {SS24_LEVELS} from '../../dist/levels.js';

const lab=new URL('../../',import.meta.url),roles=['merchant','thief','wizard','bard'];
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const designs=Array.from({length:8},(_,i)=>JSON.parse(readFileSync(new URL(`reference/level${i+1}-design.json`,lab),'utf8')));
const report={game:'SS24',success:false,levels:[],checks:[],shortcutReview:[],qualitativeDiversity:[],method:'Exécution directe des actions numériques avec stepDetailed, inspection des phases et ressources, contre-branches explicites et variantes gagnantes. Aucun générateur d’auteur ni solveur.',limits:[
 'Un témoin gagnant prouve la faisabilité, pas une solution unique ou optimale.',
 'Les 80 comparaisons historiques SS14–23 et les affectations de buts par marche avec ressources fixes sont exécutées par scripts/verify-design-constraints.mjs ; elles ne sont pas dupliquées ici.',
 'Une contre-branche montre son effet depuis le poste décrit, pas une impasse définitive après toute autre préparation.',
 'La comparaison qualitative distingue les problèmes centraux et reconnaît les mécanismes réutilisés ; elle ne mesure pas la difficulté ressentie.',
 'Les commandes d’auteur ne sont ni un apprentissage ni une résolution autonome SRA.'
]};
const ok=(level,name,observed,scope='Effets constatés sur le témoin ou la branche indiquée ; aucune nécessité universelle de cet ordre exact.')=>report.checks.push({level,name,status:'passed',observed,scope});
const key=p=>`${p.x},${p.y}`,point=(spec,x,y)=>({x:x+Math.floor((20-spec.rows[0].length)/2),y:y+Math.floor((20-spec.rows.length)/2)});
const hero=(state,role)=>state.heroes.find(h=>h.kind===role);
const physical=state=>({heroes:state.heroes.map(h=>({kind:h.kind,at:h.at,dead:!!h.dead})),stones:state.stones,supports:state.supports,mirrors:state.mirrors,monsters:state.monsters});
const branch=(world,state,id,data)=>stepDetailed(world,state,id,data);
const clickAction=(state,role)=>{const p=cellToPixel(hero(state,role).at);return{id:6,data:{x:p.x+1,y:p.y+1}};};
const select=(world,state,role)=>{const a=clickAction(state,role);return branch(world,state,a.id,a.data).state;};
function follow(world,state,actions){for(const action of actions){const detail=branch(world,state,action.id,action.data);assert(!detail.state.failed&&!detail.state.dead);state=detail.state;}return state;}
function direct(spec,actions){
 const world=compileLevel(spec),initial=initialState(world),timeline=[];let state=initial;
 for(const[index,action]of actions.entries()){
  assert(!state.complete,`${spec.id}: action after victory`);
  const before=state,detail=branch(world,state,action.id,action.data);state=detail.state;
  assert(!state.failed&&!state.dead,`${spec.id}: refused or fatal action ${index+1}`);assert.deepEqual(state.heroes.map(h=>h.kind),roles);
  assert.equal(state.stones.length+state.supports.length,initial.stones.length+initial.supports.length,`${spec.id}: cargo/support conservation`);
  assert.equal(state.mirrors.length,initial.mirrors.length);assert.deepEqual(state.mirrors.map(m=>m.facing),initial.mirrors.map(m=>m.facing));
  const goals=world.goals.filter(g=>state.heroes.some(h=>!h.dead&&equal(h.at,g))).length;assert.equal(state.complete,goals===4);
  for(const phase of detail.phases){
   const active=phase.before.heroes[phase.before.active];
   if(phase.kind==='push'){assert.equal(active.kind,'merchant');assert.equal(phase.moves.length,2);}
   if(phase.kind==='pull'){assert.equal(active.kind,'thief');assert.equal(phase.moves.length,2);assert(phase.moves.every(m=>m.actor!=='support'));assert(phase.moves.some(m=>!equal(m.from,active.at)&&equal(m.to,active.at)));}
   if(phase.kind==='swap'){assert.equal(active.kind,'wizard');assert.equal(phase.moves.length,2);assert(phase.moves.every(m=>!['support','mirror'].includes(m.actor)));}
   if(phase.kind==='song'){
    assert.equal(active.kind,'bard');
    for(const move of phase.moves){assert.notEqual(move.actor,'mirror');assert.equal(Math.abs(move.to.x-move.from.x)+Math.abs(move.to.y-move.from.y),1);assert(Math.max(Math.abs(move.from.x-active.at.x),Math.abs(move.from.y-active.at.y))<=2);}
   }
   for(const move of phase.moves.filter(m=>m.actor==='monster'))assert(['push','pull','swap','song','reflect','piston'].includes(phase.kind));
   for(const move of phase.moves.filter(m=>m.actor==='support')){assert.equal(phase.kind,'song');assert.equal(terrainAt(world,move.from),'~');assert.equal(terrainAt(world,move.to),'~');assert(phase.before.heroes.every(h=>!equal(h.at,move.from)));}
  }
  timeline.push({turn:index+1,action,before,after:state,phases:detail.phases});
 }
 return{world,initial,state,timeline,phases:timeline.flatMap(t=>t.phases.map(p=>({...p,turn:t.turn})))};
}
function variant(spec,commands){
 const world=compileLevel(spec);let state=initialState(world);const actions=[];
 for(const command of commands){
  const action=command==='C'?clickAction(state,roles[(state.active+1)%4]):{id:{U:1,D:2,L:3,R:4,X:5}[command]};assert(action.id);
  const detail=branch(world,state,action.id,action.data);assert(!detail.state.failed&&!detail.state.dead);state=detail.state;actions.push(action);
 }
 const result=direct(spec,actions);assert(result.state.complete);return{...result,commands,actions:actions.length,selections:actions.filter(a=>a.id===6).length};
}
function stoneComponents(stones){
 const unseen=new Set(stones.map(key)),sizes=[];
 for(const start of stones)if(unseen.has(key(start))){const queue=[start];unseen.delete(key(start));for(let i=0;i<queue.length;i++)for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const p={x:queue[i].x+dx,y:queue[i].y+dy};if(unseen.delete(key(p)))queue.push(p);}sizes.push(queue.length);}
 return sizes.sort((a,b)=>b-a);
}

try{
 assert.equal(SS24_LEVELS.length,8);
 for(const[n0,spec]of SS24_LEVELS.entries()){
  const n=n0+1,d=designs[n0];assert.deepEqual(spec,d.spec,`${spec.id}: synchronize and build before independent review`);
  const r=direct(spec,d.actions),{world,initial,state,timeline,phases}=r,P=(x,y)=>point(spec,x,y),events=kind=>phases.filter(p=>p.kind===kind),at=i=>timeline[d.stages[i].turn-1].after;
  assert.equal(world.goals.length,4);assert.equal(new Set(world.goals.map(key)).size,4);assert(!initial.complete&&!initial.dead);assert(state.complete);
  assert(initial.heroes.every(h=>!world.goals.some(g=>equal(g,h.at))));
  for(const stage of d.stages){const s=timeline[stage.turn-1].after;assert.deepEqual(stage.heroes,s.heroes.map(h=>({kind:h.kind,at:h.at})));for(const part of ['stones','supports','mirrors','monsters'])assert.deepEqual(stage[part],s[part]);for(const[id,pressed]of Object.entries(stage.circuits))assert.equal(circuitPressed(world,s,id),pressed);}
  const beforeLast=world.goals.filter(g=>timeline.at(-1).before.heroes.some(h=>equal(g,h.at))).length;assert(beforeLast<4);
  const phaseCounts=Object.fromEntries([...new Set(phases.map(p=>p.kind))].map(kind=>[kind,events(kind).length]));
  report.levels.push({level:n,title:spec.title,actions:d.actions.length,selections:d.actions.filter(a=>a.id===6).length,mapSha256:hash(spec),actionsSha256:hash(d.actions),complete:true,refusedActions:0,deaths:0,goalCountBeforeLastAction:beforeLast,goalCountAfterLastAction:4,phaseCounts,finalPositions:state.heroes.map(h=>({role:h.kind,at:h.at})),initialStoneComponents:stoneComponents(initial.stones)});
  ok(n,'Les actions numériques réunissent les quatre rôles vivants sur quatre buts',{actions:d.actions.length,goalsBeforeLastAction:beforeLast,goalsAfterLastAction:4,refusedActions:0,deaths:0,conservedCargoAndSupports:initial.stones.length+initial.supports.length,conservedMirrors:initial.mirrors.length});

  if(n===1){
   const first=events('pull')[0];assert(first.moves.some(m=>m.actor==='stone'&&equal(m.from,P(4,3))&&equal(m.to,P(5,3))));assert(first.after.stones.some(p=>equal(p,P(3,3))));assert(circuitPressed(world,first.after,'relai'));
   const leave=branch(world,select(world,initial,'thief'),2);assert(!leave.state.failed&&!leave.state.dead);assert(!circuitPressed(world,leave.state,'relai'));
   const relayGates=world.gates.map((g,i)=>({g,i})).filter(({g})=>g.circuit==='relai');assert.equal(relayGates.length,2);for(const {i} of relayGates)assert(gateClosed(world,leave.state,i));
   assert(events('pull').some(p=>p.moves.some(m=>m.actor==='hero'&&equal(m.from,hero(p.before,'bard').at))));
   assert(events('swap').some(p=>p.moves.some(m=>m.actor==='hero'&&equal(m.from,hero(p.before,'bard').at))));
   assert.equal(initial.monsters.length-state.monsters.length,4);assert(events('reflect').some(p=>p.moves.some(m=>m.actor==='hero')));
   ok(n,'La prise unique maintient deux accès et les transports passifs restent distincts',{firstPull:first.moves,secondCratePreserved:P(3,3),relayDoors:relayGates.map(({g})=>g.at),bothCloseOnUnreplacedDeparture:true,supportMoves:phases.flatMap(p=>p.moves).filter(m=>m.actor==='support').length,monstersRemoved:4});
   report.shortcutReview.push({level:n,candidate:'Quitter le bouton initial puis passer par le couloir droit.',result:'Le départ sans caisse ferme aussi la porte du couloir droit en (18,9). Le témoin garde le bouton chargé par sa première traction.',branch:['select thief','ACTION2'],limit:'Ce contrôle porte sur le départ sans relève ; les autres préparations restent libres.'});
  }
  if(n===2){
   assert.equal(initial.stones.length,2);assert.equal(world.gates.length,1);assert.equal(world.terrain.filter(c=>c==='~').length,0);
   const loaded=at(1);assert(circuitPressed(world,loaded,'passage'));assert(loaded.stones.some(p=>equal(p,P(12,9))));
   const voluntary=branch(world,select(world,at(3),'bard'),3);assert(!voluntary.state.failed&&!voluntary.state.dead);assert(!circuitPressed(world,voluntary.state,'passage'));
   const partnerPulls=events('pull').filter(p=>p.moves.filter(m=>m.actor==='hero').length===2);assert.equal(partnerPulls.length,6);for(const p of partnerPulls)assert.deepEqual(p.before.stones,p.after.stones);
   const review=JSON.parse(readFileSync(new URL('reference/level2-ss24-review.json',lab),'utf8'));assert.equal(review.mapSha256,hash(spec));
   const alt=review.checks.find(c=>c.name.startsWith('Variante gagnante sans chant'));assert(alt?.observed.commands);
   const result=variant(spec,alt.observed.commands);assert.equal(result.actions,180);assert.equal(result.phases.filter(p=>p.kind==='song').length,0);assert(circuitPressed(world,result.state,'passage'));
   ok(n,'La descente de charge et les transports préservent un passage tenu',{button:P(12,9),silentPartnerPulls:6,voluntaryBardDepartureClosesGate:true,alternativeActions:result.actions});
   report.shortcutReview.push({level:n,candidate:'Pousser directement le bloc du bas avec le Marchand.',result:'Variante gagnante de 180 entrées sans chant. Elle conserve la descente de charge, le passage commandé et six tractions de partenaires, mais remplace le chant et la traction du dernier bloc.',commands:result.commands,actions:result.actions,limit:'Le chant à travers le mur n’est donc pas une capacité globalement obligatoire.'});
  }
  if(n===3){
   assert.equal(initial.stones.length,4);assert.deepEqual(stoneComponents(initial.stones),[2,2]);assert.equal(world.circuits.length,0);assert.equal(state.supports.length,0);
   const blocked=branch(world,initial,4);assert(blocked.state.failed);assert.deepEqual(physical(blocked.state),physical(initial));
   const swapPair=events('swap').slice(0,2);assert(swapPair.every(p=>p.moves.some(m=>m.actor==='stone')));
   let masked=select(world,at(2),'thief');masked=follow(world,masked,[{id:2},{id:3}]);masked=select(world,masked,'wizard');
   const hit=branch(world,masked,3);assert(!hit.state.failed&&!hit.state.dead);assert(hit.phases.some(p=>p.kind==='swap'&&p.moves.some(m=>m.actor==='stone')));assert.deepEqual(hero(hit.state,'bard').at,hero(masked,'bard').at);
   const cleared=events('swap').find(p=>p.turn===d.stages[5].turn);assert(cleared.moves.some(m=>m.actor==='hero'&&equal(m.from,hero(cleared.before,'bard').at)));
   const firstSong=events('song')[0];assert(firstSong.after.stones.some(p=>equal(p,P(7,4))));assert(firstSong.moves.some(m=>m.actor==='stone'&&equal(m.from,P(8,4))&&equal(m.to,P(8,5))));
   ok(n,'Deux paires imposent des places de réception et une ligne dégagée',{initialMerchantPushRefused:true,initialComponents:[2,2],firstTwoSwaps:swapPair.map(p=>p.moves),unclearedReturnHitsCrate:true,bardNotYetExchanged:true,selectiveSong:firstSong.moves,cratesConserved:4},'La paire haute bloque la poussée simple. Après les deux échanges du bas, la caisse renvoyée masque la Barde tant qu’elle reste dans cette ligne.');
  }
  if(n===4){
   let directSwap=select(world,initial,'wizard');directSwap=follow(world,directSwap,[{id:4},{id:1}]);const trapped=select(world,directSwap,'thief');
   const refusals=[1,2,3,4].map(id=>({id,failed:branch(world,trapped,id).state.failed}));assert(refusals.every(r=>r.failed));
   const pull=events('pull')[0];assert(pull.moves.some(m=>m.actor==='hero'&&equal(m.from,hero(pull.before,'wizard').at)));
   const song=events('song')[0];assert(song.moves.some(m=>m.actor==='hero'&&equal(m.from,hero(song.before,'merchant').at)));assert(song.after.stones.some(p=>equal(p,P(7,6))));
   assert(circuitPressed(world,state,'acces'));assert.equal(state.stones.length,2);assert.equal(events('swap').filter(p=>p.moves.some(m=>m.actor==='stone')).length,2);
   ok(n,'La traction laisse le Voleur du côté utile de la réception',{wizardPull:pull.moves,directSwapBranch:['select wizard','ACTION4','ACTION1','select thief'],thiefLocalRefusals:refusals,selectiveSong:song.moves,finalDeliveredWeight:P(7,9),cratesConserved:2},'L’échange direct permet le même rayon mais laisse le Voleur entouré de trois murs et de la caisse reçue. Une intervention des partenaires peut encore le libérer.');
   report.shortcutReview.push({level:n,candidate:'Échanger les places du Magicien et du Voleur au lieu de tirer le Magicien.',result:'Le rayon atteint la loge, mais le Voleur reste derrière la caisse reçue et ses quatre directions sont refusées dans cet état.',limit:'Ce poste local est bloqué pour le Voleur seul, pas déclaré définitivement perdu pour le groupe.'});
  }
  if(n===5){
   const loaded=at(2),mage=select(world,loaded,'wizard');
   const exits=[1,2,3,4].map(id=>{const detail=branch(world,mage,id);return{id,failed:detail.state.failed,pressed:circuitPressed(world,detail.state,'relais'),phases:detail.phases.map(p=>p.kind)};});
   assert(exits.filter(e=>e.id<=2).every(e=>e.failed));assert(exits.filter(e=>e.id>=3).every(e=>!e.failed&&e.pressed&&e.phases.includes('swap')));
   const press=events('piston');assert.equal(press.length,1);assert(press[0].moves.some(m=>m.actor==='stone'&&equal(m.to,P(13,4))));
   assert(state.supports.some(p=>equal(p,P(13,4))));assert(circuitPressed(world,state,'relais'));
   const release=branch(world,select(world,loaded,'thief'),4);assert(!release.state.failed&&!release.state.dead);assert(!circuitPressed(world,release.state,'relais'));assert(release.state.supports.some(p=>equal(p,P(13,4))));assert(!release.phases.some(p=>p.kind==='song'||p.kind==='swap'));
   ok(n,'La relève continue et la rupture provoquent des effets différents',{wizardExitsFromLoadedPost:exits,closingPress:press[0].moves,supportCreated:P(13,4),finalButtonHeld:true,alternativeThiefPullReleasesButton:true},'Les côtés du poste empêchent la simple marche verticale du Magicien. Les deux directions horizontales échangent avec une cible qui remplace le poids.');
   report.shortcutReview.push({level:n,candidate:'Après le chargement, tirer le Magicien hors du bouton avec le Voleur.',result:'La branche est légale : le bouton se vide, la presse immerge sa charge et crée l’appui, sans chant ni échange actif dans cette entrée. Elle conserve le besoin de charger la presse et de rétablir ensuite le passage.',startTurn:d.stages[2].turn,branch:['select thief','ACTION4'],limit:'Cette vérification locale ne prétend pas rendre le chant obligatoire ; la variante complète est documentée par la revue des salles centrales.'});
  }
  if(n===6){
   assert.equal(initial.stones.length,1);assert.equal(state.stones.length,1);assert.equal(state.monsters.length,1);assert.equal(events('pull').filter(p=>p.moves.some(m=>m.actor==='mirror')).length,8);
   const early=follow(world,at(0),d.actions.slice(d.stages[1].turn,d.stages[2].turn));assert(circuitPressed(world,early,'chargement'));assert(equal(early.mirrors[0].at,P(6,4)));
   const retry=branch(world,select(world,early,'thief'),2);assert(retry.state.failed);assert.deepEqual(retry.state.mirrors,early.mirrors);
   const placed=at(5);assert(placed.stones.some(p=>equal(p,P(11,12))));assert(circuitPressed(world,placed,'depot'));assert(circuitPressed(world,placed,'chargement'));assert(equal(hero(placed,'merchant').at,P(10,10)));
   assert.deepEqual(at(6).stones,placed.stones);assert.equal(events('swap').length,1);assert(events('song').some(p=>p.moves.some(m=>m.actor==='monster')));
   ok(n,'Rétablir le coude précède la livraison qui ferme son accès',{mirrorPulls:8,earlyLoadClosesServicePassage:true,earlyReturnRefused:true,restoredMirror:P(6,8),deliveredWeight:P(11,12),merchantTemporarilyHoldsFirstButton:true,monsterPreserved:true,bardLeavesByOwnSteps:true});
   report.shortcutReview.push({level:n,candidate:'Livrer la charge avant de redescendre le miroir du garage.',result:'La livraison est légale mais ferme le couloir sous le Voleur. Son pas de retour vers le bas est refusé et le miroir reste au mauvais étage.',startTurn:d.stages[0].turn,reusedWitnessActions:[d.stages[1].turn+1,d.stages[2].turn],finalBranch:['select thief','ACTION2'],limit:'La commande peut encore être déchargée par une autre préparation ; ce n’est pas une impasse globale démontrée.'});
  }
  if(n===7){
   const crushed=[];
   for(const count of [0,3,6]){
    let local=initial;if(count){local=select(world,local,'thief');local=follow(world,local,Array.from({length:count},()=>({id:4})));}
    local=select(world,local,'merchant');local=follow(world,local,Array.from({length:count+1},()=>({id:4})));
    assert.equal(local.mirrors.length,0);assert(!local.dead);crushed.push({mirrorPost:P(4+count,6),thiefRightMoves:count,merchantRightMoves:count+1,mirrorRemoved:true,heroDeaths:0});
   }
   assert(equal(at(0).mirrors[0].at,P(13,6)));assert.equal(state.mirrors.length,1);assert.equal(initial.supports.length,1);assert.equal(state.supports.length,1);
   assert(platformActive(world,at(3),0));assert(at(3).supports.some(p=>equal(p,P(16,10))));
   assert.deepEqual(at(4).supports,at(3).supports);
   const withdrawal=timeline.find(t=>platformActive(world,t.before,0)&&!platformActive(world,t.after,0));assert(withdrawal);assert(withdrawal.after.heroes.every(h=>h.at.x>=P(17,7).x));
   ok(n,'Trois stationnements sont détruits par les commandes du transport suivant',{testedUnsafePosts:crushed,safeWitnessPost:P(13,6),mirrorPreserved:true},'Trois postes précis sont testés ; aucun classement exhaustif de toutes les cases de stationnement n’est revendiqué.');
   ok(n,'Appui mobile et plateforme composent deux cases de passage',{supportAtCrossing:P(16,10),platformAtCrossing:P(15,10),supportHeldDuringBardCrossing:true,platformWithdrawalTurn:withdrawal.turn,allHeroesAlreadyOnEastBank:true,finalSupportMoves:phases.flatMap(p=>p.moves).filter(m=>m.actor==='support').length},'L’appui reste d’abord disponible derrière la Barde ; il peut être déplacé plus tard par les chants de rassemblement, une fois les héros sur la rive droite.');
  }
  if(n===8){
   assert.equal(initial.stones.length,4);assert.equal(world.circuits.reduce((sum,c)=>sum+c.buttons.length,0),5);assert.equal(world.platforms.length,1);
   const prepared=at(3),premature=branch(world,select(world,prepared,'wizard'),4);assert(!premature.state.failed&&!premature.state.dead);assert(!circuitPressed(world,premature.state,'composition'));assert(premature.state.stones.some(p=>equal(p,P(11,7))));
   assert(!platformActive(world,prepared,0));assert(!supported(world,prepared,P(12,6)));assert(circuitPressed(world,prepared,'coude'));
   const song=events('song')[0];assert(song.moves.some(m=>m.actor==='hero'&&equal(m.from,hero(song.before,'wizard').at)));assert(!song.moves.some(m=>m.actor==='stone'));assert(equal(hero(song.after,'wizard').at,P(12,7)));
   const filled=at(5);assert(circuitPressed(world,filled,'composition'));assert(filled.stones.some(p=>equal(p,P(12,7))));
   const wrongExit=branch(world,select(world,filled,'bard'),3);assert(!wrongExit.state.failed&&!wrongExit.state.dead);assert(!circuitPressed(world,wrongExit.state,'composition'));assert(wrongExit.state.stones.some(p=>equal(p,P(11,7))));
   ok(n,'Le poste change ce que reçoit le dernier dépôt',{prematureExchangePlacesReserveAt:P(11,7),preparedNorthernApproachUnsupported:P(12,6),mirrorHoldsHydraulicCommand:true,sungWizardMove:song.moves,preparedReserveAt:P(12,7),leftBardDepartureRemovesWeight:true,platformReactivatedAfterMirrorDeparture:platformActive(world,state,0)});
   // The alternative already selects the Bard. Drop the witness's redundant
   // selection of that same hero before resuming its physical suffix.
   assert.equal(d.commands[d.stages[5].turn],'C');
   const commands=d.commands.slice(0,d.stages[3].turn)+'RCR'+d.commands.slice(d.stages[5].turn+1),result=variant(spec,commands);assert.equal(result.actions,137);
   const alternativeSong=result.phases.find(p=>p.kind==='song');assert(alternativeSong);assert(alternativeSong.moves.some(m=>m.actor==='stone'&&equal(m.from,P(11,7))&&equal(m.to,P(12,7))));assert(!alternativeSong.moves.some(m=>m.actor==='hero'&&!equal(m.from,hero(alternativeSong.before,'bard').at)));
   report.shortcutReview.push({level:n,candidate:'Échanger avant le chant, puis déplacer la réserve reçue au lieu du Magicien.',result:'Variante gagnante de 137 entrées. Après le chant, elle retrouve les mêmes positions que le témoin après son dernier échange. Elle conserve les dépôts, le coude hydraulique, le miroir et le chant, mais inverse l’ordre des deux gestes. Une sélection redondante du Barde est omise.',commands:result.commands,actions:result.actions,limit:'Le transport chanté du Magicien n’est donc pas globalement nécessaire ; le témoin illustre une solution parmi deux ordres vérifiés.'});
  }
 }
 report.qualitativeDiversity=[
  {levels:[1,2],comparison:'N1 assemble les 37 comparaisons pédagogiques dans trois cours et un bassin. N2 réduit le matériel à deux charges sèches, un escalier et un seul passage commandé.',remainingSimilarity:'Les relèves de bouton et les transports passifs sont communs ; N2 les isole sans miroir ni monstre.'},
  {levels:[3],comparison:'Deux paires de caisses, deux galeries décalées et une coupure d’eau organisent la circulation et les retours de cible. Aucun bouton ni tableau de dépôts ne remplace le problème de rangement.',distinctObservedFeatures:['deux composantes de deux caisses','quatre caisses conservées','cibles renvoyées à dégager']},
  {levels:[4,8],comparison:'Les deux salles demandent de distinguer un pas du Magicien de sa visée. N4 traite la réception d’une caisse et la position laissée au Voleur ; N8 traite le dernier dépôt d’une composition et l’ordre échange/chant.',remainingSimilarity:'La visée coudée et le décalage d’un héros sont des mécanismes réutilisés ; la variante N8 montre que le chant peut aussi transporter la réserve.'},
  {levels:[5],comparison:'La même commande doit être maintenue, relâchée pour charger un appui, puis maintenue à nouveau. L’événement utile est une interruption préparée, pas seulement un état final ouvert.'},
  {levels:[6,7],comparison:'N6 exige de restaurer le miroir avant une fermeture de service ; N7 anticipe trois fermetures futures qui détruiraient des stationnements précis.',distinctObservedFeatures:['une charge réutilisée et un monstre conservé dans N6','trois presses indépendantes puis appui mobile et plateforme dans N7'],remainingSimilarity:'Les deux salles déplacent un miroir avant une livraison et utilisent ensuite une visée distante ; cette parenté est reconnue.'},
  {levels:[7,8],comparison:'N7 compose une traversée avec un appui mobile et une plateforme temporaire. N8 emploie une seule case hydraulique pour modifier une approche locale du dernier dépôt, puis la réactive en reprenant le miroir.',remainingSimilarity:'Le maintien d’un circuit, la préparation d’un coude et la sortie préservant une charge restent des moyens communs de la série.'},
  {levels:[8],comparison:'Le final utilise quatre caisses réparties, trois boutons de composition, une commande d’atelier et une commande hydraulique sous le miroir ; il ne reprend pas les neuf poids en fragments du final SS23.',distinctObservedFeatures:['quatre caisses au lieu de neuf','cinq boutons aux fonctions distinctes','alternative échange puis chant vérifiée']}
 ];
 report.success=true;
}catch(error){report.error=error.stack;process.exitCode=1;}
writeFileSync(new URL('reference/independent-ss24-review.json',lab),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({success:report.success,levels:report.levels.length,checks:report.checks.length,shortcutReviews:report.shortcutReview.length,error:report.error}));
