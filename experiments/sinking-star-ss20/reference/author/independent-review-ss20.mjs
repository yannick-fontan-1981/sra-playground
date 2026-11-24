/** Independent, reproducible counter-checks. No uniqueness or optimality search. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {compileLevel,initialState,stepDetailed,terrainAt,supported,gateClosed,circuitPressed,TrioPuzzleSession} from '../../dist/core.js';
import {lessonIds,observeLesson,visibleHeroes,TUTORIAL_LEVEL} from '../../dist/tutorial.js';
import {replay} from '../../scripts/solver.mjs';
import {Author} from './author.mjs';

const point=(x,y)=>({x,y}),same=(a,b)=>a.x===b.x&&a.y===b.y,key=p=>`${p.x},${p.y}`;
const directions=[[1,0],[-1,0],[0,1],[0,-1]];
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const read=n=>JSON.parse(readFileSync(new URL(`../level${n}-design.json`,import.meta.url),'utf8'));
const check=(list,name,observed,scope)=>list.push({name,observed,scope});
const reports=[];
function region(world,state,seeds,{optimistic=false,exclude=[]}={}){
 const denied=new Set(exclude.map(key)),seen=new Set(),queue=[...seeds];
 for(let i=0;i<queue.length;i++){
  const at=queue[i],id=key(at);if(seen.has(id)||denied.has(id)||terrainAt(world,at)==='#')continue;
  if(!optimistic&&(!supported(world,state,at)||world.gates.some((g,j)=>same(g.at,at)&&gateClosed(world,state,j))))continue;
  seen.add(id);for(const [dx,dy] of directions)queue.push(point(at.x+dx,at.y+dy));
 }
 return seen;
}
function monsterEvents(result){
 const events=[];
 for(const [i,t] of result.trace.entries())for(const phase of t.phases){
  const moves=phase.moves.filter(m=>m.actor==='monster');
  if(moves.length)assert.ok(['push','pull','song','reflect','piston'].includes(phase.kind));
  for(const at of phase.after.monsters)assert.ok(phase.before.monsters.some(from=>same(moves.find(m=>same(m.from,from))?.to??from,at)),'Every monster arrival has an explicit physical source');
  if(moves.length||phase.before.monsters.length!==phase.after.monsters.length)events.push({input:i+1,phase:phase.kind,moves,remaining:phase.after.monsters});
 }
 return events;
}
function won(spec,commands){const r=replay(spec,commands);assert.equal(r.state.complete,true);assert.equal(r.metrics.blocked,0);assert.equal(r.metrics.deaths,0);return r;}
function alternative(spec,commands,label){const r=won(spec,commands);return{label,commands,metrics:r.metrics,final:r.state};}

for(let level=1;level<=8;level++){
 if(!existsSync(new URL(`../level${level}-design.json`,import.meta.url)))continue;
 const d=read(level),w=compileLevel(d.spec),s=initialState(w),r=won(d.spec,d.commands),checks=[],alternatives=[];
 assert.deepEqual(r.actions,d.actions);assert.deepEqual(r.metrics,d.metrics);
 assert.deepEqual(s.heroes.map(h=>h.kind),['merchant','thief','bard']);
 const visible=visibleHeroes(new TrioPuzzleSession([d.spec]).observe().frame);assert.equal(visible.length,3);
 const startRegion=region(w,s,s.heroes.map(h=>h.at));assert.ok(w.goals.every(g=>!startRegion.has(key(g))));
 check(checks,'Témoin actuel rejoué',`${r.metrics.actions} entrées, ${r.metrics.selections} sélections, zéro refus et zéro perte ; trois destinations occupées.`, 'Rejeu indépendant du JSON actuel et comparaison des métriques et actions enregistrées.');
 check(checks,'Aucune sortie directement accessible au départ',`${startRegion.size} cases dans le réseau de marche initial, zéro destination.`, 'Parcours complet du graphe initial en ignorant les occupants, avec les supports et portes dans leur état initial ; aucune capacité ou modification de circuit n’est simulée.');
 const events=monsterEvents(r);
 check(checks,'Chaque déplacement de monstre a une cause physique',events.length?`${events.length} événements de transport ou de disparition ; phases et coordonnées consignées.`:'Aucun monstre dans cette salle.', 'Toutes les phases du témoin sont inspectées ; marche et sélection seules ne déplacent aucun monstre.');

 if(level===1){
  assert.equal(TUTORIAL_LEVEL,1);assert.equal(lessonIds.length,30);
  const session=new TrioPuzzleSession([d.spec]),learned=new Set();
  for(const action of d.actions){const before=session.observe(),after=session.action(action.id,action.data);observeLesson(learned,before,after,action.id);}
  assert.deepEqual([...learned].sort(),[...lessonIds].sort());
  const finish=w.circuits.find(c=>c.id==='finish');assert.equal(finish.buttons.length,2);assert.ok(finish.buttons.every(p=>r.state.stones.some(q=>same(p,q))));
  check(checks,'Trente enseignements issus des pixels publics',`Les ${learned.size} découvertes sont acquises par la session publique, sans lire l’état interne pour le suivi.`, 'Les leçons sont démontrées par ce parcours ; leur présence ne prétend pas rendre chaque geste obligatoire dans toute solution.');
  check(checks,'Deux commandes finales distinctes',finish.buttons,'Le témoin laisse une caisse sur chacune des deux commandes orange, hors destinations ; le balcon final commence derrière une porte fermée.');
  assert.equal(events.filter(e=>e.moves.length).length,2);assert.deepEqual(events.filter(e=>e.moves.length).map(e=>e.phase),['song','piston']);
  check(checks,'Les gardiens suivent deux causes différentes','Un chant place un gardien, puis une fermeture de presse rapproche la paire ; les deux sont retirés au contact.','Inspection du témoin, sans quota caché de destruction dans la condition de victoire.');
 }
 if(level===2){
  assert.equal(w.monsters.length,0);assert.equal(w.mirrors.length,0);assert.ok(w.terrain.every(t=>t!=='~'));
  for(const at of [point(14,8),point(14,10),point(13,7),point(12,9),point(12,11)])assert.equal(terrainAt(w,at),'#');
  const access=region(w,s,s.heroes.map(h=>h.at));for(const at of [point(13,8),point(13,9),point(13,10),point(13,11)])assert.ok(!access.has(key(at)));
  check(checks,'La coursive ne se contourne plus par le nord','Les cases (14,8) et (14,10) sont murées ; les deux accès latéraux sont les portes (14,9) et (14,11).','Inspection de la frontière de la coursive et du graphe initial ; le contrôle extérieur doit être modifié pour y entrer.');
  const staged=new Author(d.spec);staged.act(d.commands.slice(0,d.stages[5].turn));
  assert.ok(staged.state.stones.some(p=>same(p,point(11,9))));assert.deepEqual(staged.state.heroes.find(h=>h.kind==='merchant').at,point(13,8));assert.deepEqual(staged.state.heroes.find(h=>h.kind==='bard').at,point(13,9));
  check(checks,'Le poste du Marchand est préparé avant le chant final','Au terme de l’alignement, la caisse est en (11,9), le Barde en (13,9) et le Marchand déjà au-dessus en (13,8).','Positions enregistrées et rejouées ; le témoin prépare ainsi la poussée vers (13,10), puis la traction depuis le jardin. Aucun ordre unique n’est revendiqué.');
 }
 if(level===3){
  const unprepared=replay(d.spec,'XX');assert.equal(unprepared.metrics.blocked,0);assert.equal(unprepared.metrics.deaths,0);
  assert.deepEqual(unprepared.trace.map(t=>[circuitPressed(w,t.after,'vert'),circuitPressed(w,t.after,'violet')]),[[true,true],[false,false]]);
  assert.ok(w.goals.every(g=>!region(w,unprepared.trace[0].after,s.heroes.map(h=>h.at)).has(key(g))));
  check(checks,'Deux reflets sans écran ne règlent pas le verrou','Le premier X active les deux circuits ; le deuxième les relâche ensemble. Avec les deux actifs, la passerelle centrale reste retirée.','Contre-parcours réel XX et graphe de marche après le premier reflet ; cela ne prouve pas la nécessité de chaque geste du témoin.');
  const loaded=r.trace[d.stages[2].turn-1].after,latched=r.trace[d.stages[3].turn-1].after;
  assert.equal(circuitPressed(w,loaded,'vert'),true);assert.equal(circuitPressed(w,loaded,'violet'),true);assert.equal(circuitPressed(w,latched,'vert'),true);assert.equal(circuitPressed(w,latched,'violet'),false);
  assert.ok(latched.stones.some(p=>same(p,point(7,4))));assert.ok(latched.stones.some(p=>same(p,point(7,6))));
  check(checks,'L’écran préserve réellement le poids éloigné','Après chargement et deux reflets, le poids vert reste en (7,4), l’écran est en (7,6) et le violet est relâché.','L’occupant proche reçoit le reflet suivant ; aucun acteur n’est dupliqué.');
  assert.equal(w.circuits.find(c=>c.id==='violet').color,15);
  const trial=new Author(d.spec);trial.go(5,10,'thief').act('RRR').go(6,12).go(6,10,'merchant').act('R').go(8,9).act('DD').go(7,12).act('RRRRRRRRX');
  assert.ok(trial.state.stones.some(p=>same(p,point(16,12))));assert.equal(terrainAt(w,point(16,11)),'#');assert.equal(terrainAt(w,point(15,13)),'#');assert.equal(supported(w,trial.state,point(16,14)),false);
  check(checks,'Une caisse amenée au coude ne remplit pas directement le trou central','La caisse peut atteindre (16,12), mais le poste de poussée (16,11) et le pas chanté depuis (15,12) vers (15,13) sont murés ; la traction sud demanderait de marcher sur (16,14), encore sans soutien.','Exclusion géométrique de cette tentative directe de pont ; aucune impossibilité universelle de toute variante n’est annoncée.');
 }
 if(level===4){
  const early=new Author(d.spec);early.act(d.commands.slice(0,d.stages[3].turn)).act('RR');assert.equal(circuitPressed(w,early.state,'livraison'),true);assert.deepEqual(early.state.platformActive,[false,true]);
  early.go(5,7,'merchant');const walk=stepDetailed(w,early.state,2),reflect=stepDetailed(w,early.state,5);
  assert.equal(walk.state.failed,true);assert.equal(walk.state.dead,false);assert.equal(reflect.state.dead,true);
  check(checks,'Livrer avant le dernier passager retire son quai','Deux chants droits après la réception activent la livraison trop tôt. Depuis (5,7), descendre vers (5,8) est refusé ; réfléchir depuis cette distance projette le Marchand dans l’eau.','Deux contre-gestes réels à partir d’une préparation légale. Une autre manœuvre ou Undo peut réparer cette erreur ; elle n’est pas qualifiée d’irréversible.');
  assert.equal(r.metrics.reflections,8);assert.equal(r.state.stones.length,1);assert.ok(r.state.stones.some(p=>same(p,point(16,6))));
  check(checks,'L’escale sert quatre transports successifs','Le Barde, la caisse, le Marchand et le Voleur traversent le montage à deux étapes ; la caisse finale maintient ensuite (16,6).','Comptage des huit reflets du témoin, sans minimum universel de reflets déclaré.');
 }
 if(level===5){
  assert.equal(s.monsters.length,2);assert.equal((s.monsters[0].x+s.monsters[0].y)%2,(s.monsters[1].x+s.monsters[1].y)%2);
  const first=replay(d.spec,'X');assert.equal(first.state.monsters.length,2);assert.equal(first.metrics.deaths,0);
  const alternate=d.commands.replace(/^CCDX/,'CCXD');assert.notEqual(alternate,d.commands);alternatives.push(alternative(d.spec,alternate,'Le reflet précède le pas correcteur du Barde'));
  check(checks,'La correction de diagonale admet deux ordres','X seul laisse les deux monstres. La variante X puis D après sélection du Barde gagne aussi en 128 entrées, sans refus ni perte.','Variante positive complète ; l’ordre D puis X du témoin n’est pas unique. Les deux routes utilisent un déplacement réel pour changer la parité.');
  assert.ok(r.state.supports.some(p=>same(p,point(11,14))));assert.equal(r.state.stones.length,0);
  check(checks,'Le chargement finit dans le goulet d’eau','La seule caisse sèche devient l’appui (11,14), après extraction et changement d’axe au coude.','Rôle matériel de la caisse dans les deux parcours rejoués.');
 }
 if(level===6){
  const cut=point(13,12),outside=region(w,s,s.heroes.map(h=>h.at),{optimistic:true,exclude:[cut]});
  assert.equal(w.gates.length,1);assert.equal(w.mirrors.length,0);assert.equal(w.monsters.length,0);assert.equal(w.stones.length,1);assert.equal(w.supports.length,1);
  assert.ok(w.goals.every(g=>!outside.has(key(g))));assert.ok(outside.has('12,13'));assert.equal(Math.abs(cut.x-12)+Math.abs(cut.y-13),2);
  check(checks,'La caisse finale ne peut être omise simplement','Même en autorisant toute l’eau comme passage, enlever la case de presse (13,12) sépare les trois sorties. Le bouton (12,13) est extérieur et non voisin de la presse ; l’appui ne fait pas poids.','Argument de coupure, absence de téléporteur et inventaire des occupants : le dernier héros ne peut quitter seul le bouton et entrer dans la presse pendant le même pas.');
  const a=new Author(d.spec);a.select('thief').act('D').select('bard').act('LRR').go(3,11,'thief').go(2,10,'merchant').act('RRRR').select('bard').act('L').select('merchant').act('R').go(6,12).go(8,12,'thief');a.act(d.commands.slice(d.stages[0].turn));
  alternatives.push(alternative(d.spec,a.commands,'Extraction initiale par le Barde, puis même convoyage de l’appui'));
  assert.equal(alternatives.at(-1).metrics.supportMoves,9);assert.equal(alternatives.at(-1).metrics.thiefPulls,2);
  check(checks,'Une extraction différente reste gagnante','La variante utilise 104 entrées et deux tractions au lieu de quatre ; elle conserve les neuf déplacements d’appui et la caisse finale.','Variante complète rejouée : la traction initiale n’est pas déclarée obligatoire, et la fonction finale de la caisse reste conservée.');
 }
 if(level===7){
  const oldBypass='RRCDDCRRRRRRDDDUUURCCRURRRRRUUUUUUULDRDDDDLCCRRRRRURRRDCCRRRUUCCURRRRURRU',old=replay(d.spec,oldBypass);assert.equal(old.state.complete,false);
  const branch=new Author(d.spec);branch.act('RR').select('thief').act('DD').select('bard');const attempted=stepDetailed(w,branch.state,4);
  assert.equal(attempted.state.dead,false);assert.ok(attempted.state.monsters.some(p=>same(p,point(6,7))));assert.equal(gateClosed(w,branch.state,0),true);
  check(checks,'L’ancien remplacement de la réserve par le gardien est corrigé','L’ancien parcours gagnant de 73 entrées ne termine plus. Après RR, départ DD du Voleur et sélection du Barde, chanter à droite laisse le gardien en (6,7), arrêté par la presse fermée (7,7).','Régression ciblée de l’attaque effectivement découverte sur la première carte ; elle ne démontre pas l’unicité de la nouvelle solution.');
  const exposed=replay(d.spec,'CCR'),returning=replay(d.spec,'CU');assert.equal(exposed.state.dead,true);assert.equal(exposed.state.heroes.find(h=>h.kind==='thief').dead,true);assert.equal(returning.metrics.deaths,0);assert.deepEqual(returning.state.heroes.find(h=>h.kind==='thief').at,point(7,8));
  check(checks,'Le danger et la retenue ont des causes lisibles','Un chant droit initial place le gardien à côté du Voleur et le tue. Une sortie haute initiale du Voleur ferme la presse sur lui et le renvoie sur son bouton.','Deux contre-parcours locaux CCR et CU, sans règle spéciale de personnage ni déplacement autonome.');
  assert.ok(r.state.stones.some(p=>same(p,point(7,8))));assert.ok(r.state.stones.some(p=>same(p,point(13,6))));
  check(checks,'Le témoin conserve les deux réserves utiles','Une caisse tient la relève (7,8), l’autre la sortie (13,6), alors que les trois héros rejoignent les destinations.','Conservation des deux usages dans le parcours corrigé de 92 entrées ; les rôles exacts ne sont pas imposés par une condition cachée de victoire.');
 }
 if(level===8){
  const holes=[point(7,11),point(4,12)];assert.equal(w.supports.length,0);assert.equal(w.stones.length,3);
  for(const hole of holes){assert.equal(terrainAt(w,hole),'~');assert.ok(directions.every(([dx,dy])=>terrainAt(w,point(hole.x+dx,hole.y+dy))!=='~'));assert.ok(w.goals.every(g=>!region(w,s,s.heroes.map(h=>h.at),{optimistic:true,exclude:[hole]}).has(key(g))));assert.ok(r.state.supports.some(p=>same(p,hole)));}
  check(checks,'Deux coupures d’eau exigent deux appuis distincts','(7,11) et (4,12) coupent chacune tous les trajets terrestres vers les sorties. Elles sont isolées des autres cases d’eau : un appui ne peut glisser de l’une vers l’autre.','Inspection de deux coupures du graphe optimiste. Le seul miroir ne dessert que les deux compartiments du chantier, pas l’îlot final.');
  const mirror=s.mirrors[0];assert.deepEqual(mirror.at,point(9,8));
  for(const [dx,dy] of directions){const pushFrom=point(9-dx,8-dy),one=point(9+dx,8+dy),two=point(9+2*dx,8+2*dy);assert.ok(terrainAt(w,pushFrom)==='#'||terrainAt(w,one)==='#');assert.ok(terrainAt(w,one)==='#'||terrainAt(w,two)==='#');}
  assert.deepEqual(r.state.mirrors,s.mirrors);
  check(checks,'Le miroir ne remplace pas une caisse','Dans chacune des quatre directions, le poste de poussée ou son arrivée est muré ; le pas de traction correspondant est également muré. Le chant ne le déplace pas et aucune presse ne le dessert.','Vérification des huit configurations d’accès/arrivée autour de (9,8), puis conservation de la position dans le témoin.');
  const afterDelivery=r.trace[d.stages[9].turn-1].after;assert.equal(afterDelivery.heroes[afterDelivery.active].kind,'thief');assert.ok(afterDelivery.stones.some(p=>same(p,point(6,12))));
  const leaving=stepDetailed(w,afterDelivery,3);assert.equal(leaving.state.failed,false);assert.equal(leaving.state.dead,false);assert.ok(leaving.state.stones.some(p=>same(p,point(5,12))));assert.equal(circuitPressed(w,leaving.state,'arrivee'),false);
  check(checks,'Le dernier Voleur ne peut partir par un simple pas gauche','Après livraison, L retire la caisse (6,12) vers (5,12) et relâche le verrou. Le chant de la fin le transporte sans cette traction.','Contre-geste concret à l’entrée 349 du témoin ; cette erreur reste annulable et n’est pas présentée comme irréversible.');
  assert.equal(terrainAt(w,point(6,11)),'#');assert.equal(Math.abs(6-5)+Math.abs(12-12),1);assert.equal(Math.abs(6-7)+Math.abs(12-12),1);
  check(checks,'Un monstre posé trop tôt sur le bouton bloque le dernier passage','Un gardien en (6,12) menace orthogonalement (7,12), arrivée du premier pont, et (5,12), accès au second. La case nord (6,11) est murée.','Exclusion du remplacement avant la dernière traversée. Aucune preuve exhaustive des livraisons tardives après passage de tous les héros n’est revendiquée.');
  const highTurn=r.trace.findIndex(t=>t.after.stones.some(p=>same(p,point(14,13)))&&same(t.after.heroes.find(h=>h.kind==='thief').at,point(14,14)))+1;assert.ok(highTurn>0);
  const early=new Author(d.spec);early.act(d.commands.slice(0,highTurn)).select('bard');const withdrew=stepDetailed(w,early.state,2);
  assert.equal(withdrew.state.failed,false);assert.equal(withdrew.state.dead,false);assert.equal(withdrew.state.monsters.length,0);assert.ok(withdrew.state.supports.some(p=>same(p,point(14,13))));assert.equal(withdrew.state.stones.length,2);
  check(checks,'Retirer le chantier pendant le passage perd la réserve haute','Quand la réserve est sur (14,13) et le Voleur devant elle, un D du Barde retire sa plateforme : la caisse devient un appui immobile du chantier, après la purge du monstre.','Contre-parcours légal. Dans cette branche, il ne reste que deux caisses récupérables, sans monstre et avec le miroir fixe, pour les deux trous finaux et leur poids sec. C’est une nécessité conditionnée à cette branche, pas un théorème sur toutes les solutions.');
  const restored=r.trace[d.stages[2].turn-1];assert.equal(restored.phases.some(p=>p.kind==='piston'),false);assert.ok(restored.phases.find(p=>p.kind==='song').moves.some(m=>m.actor==='hero'&&same(m.from,point(14,15))&&same(m.to,point(14,14))));
  check(checks,'La restauration ne confond plus chant et presse','À l’entrée 40, le chant remonte le Marchand ; la presse se ferme vide, puis la plateforme revient. Le piston n’est pas la cause de ce transport.','Vérification de la description corrigée contre les phases song/gate/platform du replay.');
 }
 reports.push({level,title:d.spec.title,status:'passed',mapSha256:hash(d.spec),witnessSha256:hash(d.actions),metrics:r.metrics,monsterEvents:events,checks,...(alternatives.length?{alternatives}:{})});
}
const report={gameCode:'SS20',title:'Le Relais des Îles',status:'passed',levelsReviewed:reports.map(r=>r.level),complete:reports.length===8,checks:reports.reduce((n,r)=>n+r.checks.length,0),positiveVariants:reports.reduce((n,r)=>n+(r.alternatives?.length??0),0),scope:'Relecture indépendante du moteur, des cartes et des témoins des autres auteurs. Graphes de terrain, contre-gestes ciblés, conservation de ressources et variantes gagnantes ; aucune recherche de solution unique ou optimale.',limitations:['Un témoin gagnant prouve la solvabilité, pas la nécessité universelle de chaque geste.','Les contre-gestes et les impossibilités locales sont explicitement bornés à leurs positions et hypothèses.','Le remplacement tardif du poids de N8 par un monstre n’a pas fait l’objet d’une preuve exhaustive ; le contrôle porte sur le remplacement avant la dernière traversée et sur la branche où le chantier a déjà été purgé.'],levels:reports};
writeFileSync(new URL('../independent-review-ss20.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:report.status,levels:report.levelsReviewed,checks:report.checks,positiveVariants:report.positiveVariants,complete:report.complete},null,2));
