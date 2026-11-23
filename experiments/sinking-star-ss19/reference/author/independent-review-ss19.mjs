import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {compileLevel,initialState,stepDetailed,terrainAt,supported,gateClosed,circuitPressed} from '../../dist/core.js';
import {replay} from '../../scripts/solver.mjs';
import {Author} from './author.mjs';

const read=n=>JSON.parse(readFileSync(new URL(`../level${n}-design.json`,import.meta.url),'utf8'));
const point=(x,y)=>({x,y}),same=(p,q)=>p.x===q.x&&p.y===q.y;
const reports=[];
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const forcedKinds=new Set(['push','song','swap','reflect','piston']);
function physicalMonsterEvents(result){
 const events=[];
 for(const [i,t] of result.trace.entries())for(const phase of t.phases){
  const moves=phase.moves.filter(m=>m.actor==='monster');
  assert.notEqual(phase.kind,'hunt');
  if(moves.length)assert.ok(forcedKinds.has(phase.kind),'Every monster movement has a visible physical cause');
  for(const at of phase.after.monsters)assert.ok(phase.before.monsters.some(from=>{
   const motion=moves.find(m=>same(m.from,from));return same(motion?.to??from,at);
  }),'No new or autonomously displaced monster');
  if(moves.length||phase.before.monsters.length!==phase.after.monsters.length)events.push({entry:i+1,phase:phase.kind,moves,remaining:phase.after.monsters});
 }
 return events;
}
function addReport(level,design,result,checks,alternatives=[]){
 reports.push({level,title:design.spec.title,status:'passed',mapSha256:hash(design.spec),witness:{metrics:result.metrics,final:result.state,monsterEvents:physicalMonsterEvents(result)},checks,...(alternatives.length?{alternatives}:{} )});
}
function check(list,name,observed,scope){list.push({name,observed,scope});}
function walkRegion(w,s,seeds){
 const seen=new Set(),queue=[...seeds];
 for(let i=0;i<queue.length;i++){
  const p=queue[i],key=`${p.x},${p.y}`;
  if(seen.has(key)||!supported(w,s,p)||w.gates.some((g,i)=>same(p,g.at)&&gateClosed(w,s,i)))continue;
  seen.add(key);for(const d of [[1,0],[-1,0],[0,1],[0,-1]])queue.push(point(p.x+d[0],p.y+d[1]));
 }
 return seen;
}
{
 const d=read(1),w=compileLevel(d.spec),s=initialState(w),checks=[],r=replay(d.spec,d.commands);
 assert.equal(r.state.complete,true);assert.equal(r.metrics.blocked,0);assert.equal(r.metrics.deaths,0);
 check(checks,'Parcours pédagogique intégral',`${r.metrics.actions} entrées, ${r.metrics.selections} sélections ; WIN sans refus ni perte.`,'Rejeu indépendant du témoin actuel ; les interactions facultatives ne sont pas déclarées nécessaires.');
 const region=walkRegion(w,s,s.heroes.map(h=>h.at));assert.ok(w.goals.every(g=>!region.has(`${g.x},${g.y}`)));
 check(checks,'Aucune sortie directement accessible','Même en ignorant les autres occupants, le réseau de marche initial ne contient aucune des trois destinations. Chaque alcôve est derrière une presse fermée.','Parcours exhaustif du graphe de sol initial ; aucune capacité ni modification de circuit n’est simulée par ce contrôle.');
 const optical=w.gates.find(g=>g.circuit==='optique');assert.equal(optical.closedWhen,'pressed');assert.equal(circuitPressed(w,s,'optique'),true);assert.ok(w.circuits.find(c=>c.id==='optique').buttons.every(b=>s.stones.some(p=>same(p,b))));
 const east=w.goals.find(g=>g.x===18&&g.y===4);assert.ok(east);assert.deepEqual([[0,1],[0,-1],[1,0],[-1,0]].map(([dx,dy])=>point(east.x+dx,east.y+dy)).filter(p=>terrainAt(w,p)!=='#'),[point(17,4)]);
 check(checks,'Marcher seulement ne peut terminer la salle','La caisse déjà posée sur la commande optique maintient la seule entrée de l’alcôve est fermée. Une suite qui ne déplace aucune pièce ne peut libérer cette destination.','Argument géométrique et de conservation du poids ; le changement de héros seul ne modifie pas cet obstacle.');
 const near=stepDetailed(w,s,3),refused=stepDetailed(w,near.state,3);assert.equal(near.state.failed,false);assert.equal(refused.state.failed,true);assert.equal(refused.state.dead,false);assert.deepEqual(refused.state.monsters,near.state.monsters);assert.deepEqual(refused.phases,[]);
 check(checks,'Entrée ouest refusée concrètement','Depuis le départ, L approche la presse ; le second L est refusé sans déplacement du gardien ni perte de héros.','Contre-parcours réel LL ; il est délibérément distinct du témoin sans refus.');
 const rail=walkRegion(w,s,s.monsters);assert.deepEqual([...rail].sort(),['15,9','16,9','17,9']);
 for(const t of r.trace)for(const p of t.after.monsters)assert.ok(rail.has(`${p.x},${p.y}`));
 const removal=r.trace.find(t=>t.before.monsters.length>t.after.monsters.length);assert.ok(removal);assert.ok(removal.phases.some(p=>p.kind==='piston'));assert.equal(r.metrics.monstersRemoved,1);
 const movements=physicalMonsterEvents(r);assert.equal(movements.length,2);
 assert.deepEqual(movements[0].moves,[{actor:'monster',from:point(16,9),to:point(15,9)}]);assert.equal(movements[0].phase,'song');
 assert.deepEqual(movements[1].moves,[{actor:'monster',from:point(15,9),to:point(15,10)}]);assert.equal(movements[1].phase,'piston');
 check(checks,'Deux déplacements physiques, chacun visible','Le gardien reste en (16,9) jusqu’au chant, qui le place sur la presse ouverte (15,9). Une fermeture ultérieure le pousse dans l’eau (15,10). Aucun pas de héros ou changement de sélection ne le déplace seul.','Revue de toutes les phases du témoin ; la noyade est une interaction enseignée, sans prétention de nécessité universelle.');
 const singingTurn=movements[0].entry,beforeSong=replay(d.spec,d.commands.slice(0,singingTurn-1));
 const refusal=stepDetailed(w,beforeSong.state,1);assert.equal(refusal.state.failed,true);assert.deepEqual(refusal.state.monsters,beforeSong.state.monsters);
 check(checks,'Le chant exige un vrai pas de la Barde','Au poste de livraison, son pas vers le haut est refusé par le mur : le gardien reste immobile. Le pas vers la gauche du témoin est accepté et lui seul transporte le monstre sur la presse.','Deux gestes locaux comparables ; aucune attraction à travers les murs n’est simulée.');
 addReport(1,d,r,checks);
}
{
 const d=read(3),w=compileLevel(d.spec),s=initialState(w),checks=[],r=replay(d.spec,d.commands);
 assert.equal(r.state.complete,true);assert.equal(r.metrics.blocked,0);assert.equal(r.metrics.deaths,0);
 check(checks,'Parcours des sas alternés',`${r.metrics.actions} entrées, ${r.metrics.selections} sélections, ${r.metrics.reflections} reflets ; victoire sans refus ni perte.`,'Rejeu indépendant du témoin actuel, sans minimum de reflets annoncé.');
 const charges=w.circuits.find(c=>c.id==='charges');assert.equal(charges.buttons.length,2);assert.ok(charges.buttons.every(b=>!w.goals.some(g=>same(g,b))));assert.equal(w.stones.length,3);assert.equal(w.monsters.length,0);
 assert.ok(w.gates.some(g=>g.circuit==='charges'&&g.closedWhen==='released'&&w.goals.some(p=>same(p,g.at))));
 check(checks,'Les deux réserves sèches restent nécessaires','À la victoire, les trois héros sont sur les destinations et ne pèsent plus sur les deux commandes charges. Le poids optique isolé assure alternance ; les deux autres caisses assurent charges.','Comptage de trois commandes finales disjointes et de trois caisses ; une seule perte de poids empêche l’accord final.');
 const optical=w.circuits.find(c=>c.id==='alternance');assert.deepEqual(optical.buttons,[point(6,6)]);assert.ok(w.gates.some(g=>g.circuit==='alternance'&&g.closedWhen==='released'&&w.goals.some(p=>same(p,g.at))));
 // The reflected endpoint is within the boundary of the Bard aura, but
 // every direction either blocks the crate or blocks the Bard's own step.
 const a=new Author(d.spec);a.select('bard').go(8,6).act('X');assert.ok(a.state.stones.some(p=>same(p,point(6,6))));assert.equal(circuitPressed(a.world,a.state,'alternance'),true);
 for(const id of [1,2,3,4]){const attempt=stepDetailed(a.world,a.state,id);assert.ok(attempt.state.stones.some(p=>same(p,point(6,6))));assert.equal(attempt.state.supports.length,0);if(id===3){assert.equal(attempt.state.failed,true);assert.deepEqual(attempt.phases,[]);}}
 check(checks,'Le contrôleur résiste au chant depuis le bord','Après X, le Barde en (8,6) atteint la caisse de (6,6) par sa portée, mais son pas gauche est interdit par le mur en (7,6). Les autres directions laissent également la caisse en place.','Quatre essais concrets : le pas refusé annule toute la chanson, et les autres destinations de la caisse sont murées.');
 addReport(3,d,r,checks);
}

{
 const d=read(6),w=compileLevel(d.spec),checks=[],r=replay(d.spec,d.commands);
 assert.equal(r.state.complete,true);assert.equal(r.metrics.blocked,0);assert.equal(r.metrics.deaths,0);assert.equal(r.metrics.reflections,2);assert.equal(r.state.stones.length,1);assert.ok(r.state.supports.some(p=>same(p,point(11,14))));assert.ok(r.state.stones.some(p=>same(p,point(8,14))));
 check(checks,'Deux livraisons différentes',`${r.metrics.actions} entrées : premier reflet vers l’appui (11,14), second vers le poids sec (8,14), victoire sans refus ni perte.`,'Rejeu des deux fonctions finales des caisses ; aucun caractère unique du témoin n’est affirmé.');
 const early=replay(d.spec,d.commands.slice(0,d.stages[2].turn)+'XX');assert.equal(early.metrics.deaths,0);assert.equal(early.trace.at(-1).after.failed,true);assert.deepEqual(early.state.heroes[0].at,point(4,8));assert.deepEqual(early.trace.at(-2).phases.map(p=>p.kind),['reflect','gate']);
 check(checks,'Répéter X sans quitter le débarcadère échoue','Un deuxième X immédiat renvoie le Guerrier sur le quai de départ et active le poids. Un troisième X est alors refusé par le débarcadère fermé.','Contre-parcours concret ; il est réparable par d’autres manœuvres ou Undo, et n’est pas annoncé irréversible.');
 const alternative='UURUUXUULXCCDDDLDDDDDDLLLRRRCCRRRRRRRUUUUDLURRUUUULUURUUUCCRRRCCRDDDRDDDRRCCDDDLDDDDDDRRDDRRRDR',alt=replay(d.spec,alternative);assert.equal(alt.state.complete,true);assert.equal(alt.metrics.blocked,0);assert.equal(alt.metrics.deaths,0);assert.equal(alt.metrics.reflections,2);assert.ok(alt.state.supports.some(p=>same(p,point(11,14))));assert.ok(alt.state.stones.some(p=>same(p,point(8,14))));
 check(checks,'Variante valide : préparer la charge après les reflets',`${alt.metrics.actions} entrées. Le second reflet livre d’abord la caisse en (5,14), puis le chant et deux échanges la placent sur sa commande. Les deux ressources et les deux reflets restent employés.`,'Variante gagnante rejouée, plus longue que le témoin ; la préparation préalable n’est donc pas déclarée universellement nécessaire.');
 addReport(6,d,r,checks,[{label:'Charge préparée après les reflets',commands:alternative,metrics:alt.metrics,final:alt.state}]);
}
{
 const d=read(7),checks=[],r=replay(d.spec,d.commands);assert.equal(r.state.complete,true);assert.equal(r.metrics.blocked,0);assert.equal(r.metrics.deaths,0);assert.equal(r.state.mirrors.length,2);assert.equal(r.state.gateClosed[0],false);
 check(checks,'Relais supprimé et passage rouvert',`${r.metrics.actions} entrées et ${r.metrics.selections} sélections ; la charge ferme puis rouvre la presse, un miroir disparaît et les trois destinations sont occupées.`,'Rejeu du témoin ; destruction et réouverture sont deux états distincts.');
 const movements=physicalMonsterEvents(r);assert.equal(movements.length,2);assert.ok(movements.every(e=>e.phase==='push'));
 assert.deepEqual(movements[0].moves,[{actor:'monster',from:point(15,12),to:point(16,12)}]);assert.deepEqual(movements[1].moves,[{actor:'monster',from:point(16,12),to:point(17,12)}]);
 check(checks,'La caisse forme un écran pendant la poussée','Les seuls mouvements du monstre sont les deux poussées du Guerrier derrière la caisse. Les pas de préparation le laissent immobile et la seconde poussée le fait tomber dans l’eau.','Toutes les phases physiques du parcours ont été inspectées ; cette noyade appartient au témoin, pas à la condition de victoire.');
 const a=new Author(d.spec);a.act(d.commands.slice(0,d.stages[3].turn));assert.equal(a.state.gateClosed[0],true);assert.equal(a.state.mirrors.length,2);
 a.go(6,16,'wizard').act('R');a.select('bard').act('UUXUUL');a.select('wizard').act('L');a.go(12,12,'warrior');
 const denied=stepDetailed(a.world,a.state,5);assert.equal(denied.state.failed,true);assert.equal(denied.state.dead,false);assert.ok(denied.blockedMirrorIndices.length);assert.deepEqual(denied.state.heroes.map(h=>h.at),a.state.heroes.map(h=>h.at));assert.deepEqual(denied.phases,[]);
 check(checks,'Détruire sans rouvrir ne suffit pas','Une route différente retire la Barde en conservant la charge sur le bouton. Le relais est détruit, mais la presse restée fermée bloque le reflet final entier, avec le signal rouge attendu.','Contre-parcours concret ; le transfert du Magicien pourtant valide n’est pas appliqué partiellement.');
 const alternative='DDLUUURRUUUXUURRRDLCLLCDDDDUCCURRRURCUXUULCCLCCULX',alt=replay(d.spec,alternative);assert.equal(alt.state.complete,true);assert.equal(alt.metrics.blocked,0);assert.equal(alt.metrics.deaths,0);assert.equal(alt.metrics.monstersRemoved,0);assert.deepEqual(alt.state.monsters,[point(16,12)]);assert.ok(alt.state.stones.some(p=>same(p,point(15,12))));assert.equal(alt.state.mirrors.length,2);assert.equal(alt.state.gateClosed[0],false);physicalMonsterEvents(alt);
 check(checks,'Variante valide : garder le gardien vivant',`${alt.metrics.actions} entrées et ${alt.metrics.selections} sélections. Une seule poussée de file conserve le monstre sur (16,12) et la caisse écran sur (15,12). Le recalage, la destruction du relais et la réouverture restent présents.`,'Variante gagnante rejouée ; éliminer le monstre n’est pas nécessaire.');
 addReport(7,d,r,checks,[{label:'Gardien conservé comme poids',commands:alternative,metrics:alt.metrics,final:alt.state}]);
}
{
 const d=read(8),w=compileLevel(d.spec),s=initialState(w),checks=[],r=replay(d.spec,d.commands);assert.equal(r.state.complete,true);assert.equal(r.metrics.blocked,0);assert.equal(r.metrics.deaths,0);assert.equal(r.metrics.monstersRemoved,0);assert.deepEqual(r.state.monsters,[point(6,6),point(13,12)]);assert.deepEqual(r.state.supports,[point(13,17)]);assert.equal(r.state.stones.length,0);
 const movements=physicalMonsterEvents(r);assert.equal(movements.filter(e=>e.phase==='song').length,7);assert.equal(movements.filter(e=>e.phase==='reflect').length,1);assert.equal(movements.filter(e=>e.phase==='piston').length,1);
 assert.deepEqual(movements[0].moves,[{actor:'monster',from:point(17,7),to:point(13,11)}]);assert.deepEqual(movements[1].moves,[{actor:'monster',from:point(13,11),to:point(13,12)}]);
 check(checks,'Les deux gardiens arrivent par des causes physiques',`${r.metrics.actions} entrées et ${r.metrics.selections} sélections. Le gardien ouest reçoit sept pas de chant ; le gardien est reçoit un reflet puis une poussée de presse. Les deux restent sur leurs boutons jusqu’à la victoire.`,'Rejeu indépendant de toutes les phases ; aucun changement de cible, d’axe ou de distance ne commande un monstre.');
 const empty=new Author(d.spec);empty.go(4,16,'warrior').act('L');assert.deepEqual(empty.state.monsters,s.monsters);assert.equal(empty.state.gateClosed[1],true);
 const blocked=stepDetailed(w,empty.state,5);assert.equal(blocked.state.failed,true);assert.deepEqual(blocked.state.monsters,s.monsters);assert.ok(blocked.blockedMirrorIndices.includes(0));
 empty.act('RX');assert.ok(empty.state.monsters.some(p=>same(p,point(13,11))));
 check(checks,'Fermer la presse vide ne fait pas venir le monstre','Si la commande verte est actionnée avant X, aucun monstre ne bouge et la presse fermée interdit le reflet. Relâcher la commande rouvre la destination, puis X peut y livrer le gardien.','Contre-parcours réel, sans attraction ni transport lors de l’ouverture ; une presse agit seulement sur l’occupant de sa propre case au moment de sa fermeture.');
 assert.equal(w.stones.length,1);assert.equal(w.monsters.length,2);assert.equal(w.mirrors.length,1);assert.equal(w.supports.length,0);assert.deepEqual(w.mirrors[0].at,point(17,11));
 for(const [behind,landing] of [[point(17,12),point(17,10)],[point(17,10),point(17,12)],[point(18,11),point(16,11)],[point(16,11),point(18,11)]])assert.ok(terrainAt(w,behind)==='#'||terrainAt(w,landing)==='#');
 check(checks,'Le miroir ne peut remplacer un gardien','Pour chacune des quatre directions de poussée du miroir (17,11), le départ du pousseur ou la destination du miroir est un mur. Aucun chant, échange ou reflet ne déplace un miroir.','Vérification géométrique exhaustive des quatre lignes de poussée ; fabriquer un appui ne retire aucun mur.');
 const island=walkRegion(w,s,[point(14,17)]);assert.equal(island.size,9);assert.ok(s.heroes.every(h=>!island.has(`${h.at.x},${h.at.y}`)));assert.ok(s.stones.every(p=>!island.has(`${p.x},${p.y}`)));assert.ok(s.monsters.every(p=>!island.has(`${p.x},${p.y}`)));
 const waterExits=[];for(const key of island){const [x,y]=key.split(',').map(Number);for(const [dx,dy] of [[0,1],[0,-1],[1,0],[-1,0]]){const q=point(x+dx,y+dy);if(terrainAt(w,q)==='~')waterExits.push(q);}}
 assert.deepEqual(waterExits,[point(13,17)]);assert.ok([...island].every(key=>{const [x,y]=key.split(',').map(Number);return x!==17&&y!==11;}));
 check(checks,'L’île vide impose la caisse du nord-est','L’île des neuf cases est vide au départ et hors des deux axes du miroir. Son seul voisin aquatique est (13,17). Un échange ne peut ajouter un premier occupant à une île vide ; il faut donc fabriquer ce passage avec la caisse unique.','Invariant d’effectif et inspection de toute la frontière de l’île ; ne repose pas sur une recherche limitée.');
 for(const id of ['gardien-ouest','gardien-est']){const c=w.circuits.find(c=>c.id===id);assert.equal(c.buttons.length,1);assert.ok(w.gates.some(g=>g.circuit===id&&g.closedWhen==='released'&&w.goals.some(p=>same(p,g.at))));assert.ok(c.buttons.every(b=>!w.goals.some(p=>same(p,b))&&!w.gates.some(g=>same(g.at,b))));}
 check(checks,'Aucun gardien ne peut être sacrifié à la victoire','La caisse doit devenir appui et le miroir est fixe. Les trois héros occupent les trois destinations, distinctes des deux plaques. Les deux monstres sont donc les seuls poids encore disponibles pour tenir les presses-buts.','Preuve de conservation des poids ; les appuis immergés ne comptent pas comme poids et les boutons ne sont pas des cases de presse.');
 const alternative='XCCLLLLDDDDRRRRRRRDLCCDRRRRURRRRRURCLCCXDLLLLLLCCUUURRRRRDDDDDDDLDRRRCCDDDDDLCCDDDDDRRRRRCCRR',alt=replay(d.spec,alternative);assert.equal(alt.state.complete,true);assert.equal(alt.metrics.blocked,0);assert.equal(alt.metrics.deaths,0);assert.deepEqual(alt.state.supports,[point(13,17)]);assert.deepEqual(alt.state.monsters,[point(6,6),point(13,12)]);assert.ok(!alt.trace.some(t=>t.phases.some(p=>p.kind==='piston'&&alt.world.gates[p.gateIndex]?.circuit==='livraison')));physicalMonsterEvents(alt);
 check(checks,'Variante valide : le chant remplace la presse de livraison',`${alt.metrics.actions} entrées et ${alt.metrics.selections} sélections. Après le reflet initial, la Barde atteint (11,9), chante vers le bas pour livrer le gardien est, puis vers la gauche pour se dégager. Les deux gardiens et la caisse sont toujours employés.`,'Variante gagnante rejouée ; la commande verte illustre une solution physique lisible mais son emploi n’est pas universellement obligatoire.');
 addReport(8,d,r,checks,[{label:'Livraison est remplacée par un chant',commands:alternative,metrics:alt.metrics,final:alt.state}]);
}

{
 const d=read(2),w=compileLevel(d.spec),s=initialState(w),checks=[],r=replay(d.spec,d.commands);assert.equal(r.state.complete,true);assert.equal(r.metrics.blocked,0);assert.equal(r.metrics.deaths,0);
 const movements=physicalMonsterEvents(r);assert.equal(movements.length,3);assert.ok(movements.every(e=>e.phase==='piston'));
 assert.deepEqual(movements.map(e=>e.moves),[14,13,12].map(x=>[{actor:'monster',from:point(x,3),to:point(x-1,3)}]));
 assert.deepEqual(r.state.monsters,[point(11,3)]);assert.deepEqual(r.state.stones,[point(3,10)]);
 check(checks,'Trois fermetures distinctes livrent le gardien',`${r.metrics.actions} entrées et ${r.metrics.selections} sélections, sans refus ni perte. Le gardien avance exactement de (14,3) vers (13,3), puis (12,3), puis le bouton séparé (11,3).`,'Les trois transports sont des phases de presse observées ; aucune porte ouverte ne déplace un occupant à distance.');
 const leftOnRail=replay(d.spec,'RRRRRL');assert.equal(leftOnRail.metrics.blocked,0);assert.equal(leftOnRail.metrics.deaths,0);assert.deepEqual(leftOnRail.state.monsters,[point(12,3)]);assert.equal(circuitPressed(w,leftOnRail.state,'seuil'),false);assert.ok(leftOnRail.state.gateClosed.slice(3).every(Boolean));
 check(checks,'Un pas qui abandonne la séquence ne termine pas le transport','Après deux fermetures, revenir vers la commande jaune laisse le gardien en (12,3). La fermeture jaune est alors vide : elle ne le pousse pas et les trois destinations restent fermées.','Contre-parcours RRRRRL, sans refus ni perte ; le troisième déplacement exige une nouvelle cause physique.');
 const accessible=walkRegion(w,s,s.heroes.map(h=>h.at)),rail=walkRegion(w,s,s.monsters);
 assert.deepEqual([...rail].sort(),['11,3','12,3','13,3','14,3']);assert.ok([...accessible].every(key=>Number(key.split(',')[1])>=6));
 for(let x=11;x<=14;x++)assert.equal(terrainAt(w,point(x,5)),'#');assert.equal(w.mirrors.length,0);
 check(checks,'Le rail ne répond pas au placement des héros','Le rail est séparé du sol des héros par deux rangées murées. La portée de deux cases du chant ne l’atteint pas, les visées verticales rencontrent les murs et aucun miroir ne dessert ces cases.','Inspection géométrique : les presses sont les seuls dispositifs capables de faire sortir le gardien de sa case initiale et de le livrer sur le bouton.');
 const threshold=w.circuits.find(c=>c.id==='seuil');assert.deepEqual(threshold.buttons,[point(11,3),point(3,10)]);assert.equal(w.stones.length,1);assert.equal(w.monsters.length,1);
 assert.ok(threshold.buttons.every(b=>!w.goals.some(g=>same(g,b))&&!w.gates.some(g=>same(g.at,b))));
 assert.ok(w.goals.every(goal=>w.gates.some(g=>same(g.at,goal)&&g.circuit==='seuil'&&g.closedWhen==='released')));
 check(checks,'La caisse et le monstre sont deux poids nécessaires','Les trois héros doivent occuper les trois destinations, toutes soumises au même accord. Les deux boutons violets, hors destinations et hors presses, ne peuvent alors être tenus que par la caisse et le monstre.','Comptage exhaustif des occupants disponibles ; perdre l’une des deux pièces interdit cet accord final.');
 addReport(2,d,r,checks);
}
{
 const d=read(4),w=compileLevel(d.spec),s=initialState(w),checks=[],r=replay(d.spec,d.commands);assert.equal(r.state.complete,true);assert.equal(r.metrics.blocked,0);assert.equal(r.metrics.deaths,0);
 const movements=physicalMonsterEvents(r);assert.equal(movements.length,2);assert.deepEqual(movements[0].moves,[{actor:'monster',from:point(12,5),to:point(12,6)}]);assert.equal(movements[0].phase,'song');assert.equal(movements[1].phase,'platform');assert.deepEqual(movements[1].moves,[]);
 check(checks,'Le chant déplace, la trappe retire le soutien',`${r.metrics.actions} entrées et ${r.metrics.selections} sélections, sans refus ni perte. Un unique chant dépose le gardien de (12,5) en (12,6) ; le départ du Magicien retire ensuite la plateforme et le gardien disparaît sur place.`,'Les deux événements sont distincts et tous les autres pas laissent le monstre immobile. La noyade n’est pas présentée comme une condition cachée de victoire.');
 const left=walkRegion(w,s,s.heroes.filter(h=>h.at.x<11).map(h=>h.at));assert.ok([...left].every(key=>Number(key.split(',')[0])<14));assert.deepEqual(s.platformActive,[true]);
 for(const at of [point(13,5),point(13,6),point(11,6),point(12,7)])assert.equal(terrainAt(w,at),'#');
 check(checks,'La plateforme levée ne court-circuite pas le bassin','La trappe active est isolée par trois murs et la case du gardien. Elle n’offre aucun chemin de marche entre les deux rives ; la rive gauche reste coupée de la rive droite.','Inspection exhaustive du graphe de terrain initial avec la plateforme levée, sans prétendre exclure les transports élaborés d’appuis ailleurs dans le bassin.');
 const tooEarly=replay(d.spec,'CCDCRR');assert.equal(tooEarly.trace.at(-1).after.failed,true);assert.equal(tooEarly.metrics.deaths,0);assert.deepEqual(tooEarly.state.monsters,[point(12,6)]);assert.deepEqual(tooEarly.state.stones,[point(4,3),point(5,3)]);assert.equal(tooEarly.state.gateClosed[0],true);assert.equal(tooEarly.state.gateClosed[1],false);
 check(checks,'Déplacer le gardien ferme réellement la réserve','Si la Barde chante avant la sortie des caisses, la réserve se ferme : après une poussée dans la pièce, la suivante rencontre la presse fermée et est refusée. La destination orange s’ouvre au même moment.','Contre-parcours CCDCRR ; l’erreur reste réparable tant que le gardien peut revenir sur son bouton, et Undo reste disponible.');
 const partial=replay(d.spec,d.commands.slice(0,d.stages[4].turn)+'RR');assert.equal(partial.trace.at(-1).after.failed,true);assert.equal(partial.metrics.deaths,0);assert.deepEqual(partial.state.heroes[0].at,point(12,11));assert.equal(partial.state.supports.length,2);
 check(checks,'Le pont partiel ne suffit pas à une traversée droite','Après la première immersion du témoin, le Guerrier atteint (12,11), mais son pas vers (13,11) est refusé par l’eau nue. La seconde livraison construit ce dernier appui dans le parcours enseigné.','Contre-parcours concret ; deux immersions ne sont pas annoncées comme nécessaires à toutes les solutions possibles.');
 assert.equal(r.state.supports.length,3);assert.equal(r.state.stones.length,0);assert.ok(r.state.heroes.filter(h=>h.at.x>=14).length===2);
 check(checks,'Le chantier réalise un transfert net de héros','Le témoin utilise l’appui initial et les deux caisses, puis termine avec deux héros sur la rive droite et un sur la rive gauche. Des échanges entre héros seuls ne changent pas cette répartition ; une autre traversée ou une livraison de cible reste nécessaire.','Comptage des occupants et observation du témoin. Une cible livrée pourrait ensuite être échangée avec un héros ; l’ordre des livraisons et le pont continu ne sont pas déclarés universels.');
 addReport(4,d,r,checks);
}

{
 const d=read(5),w=compileLevel(d.spec),s=initialState(w),checks=[],r=replay(d.spec,d.commands);assert.equal(r.state.complete,true);assert.equal(r.metrics.blocked,0);assert.equal(r.metrics.deaths,0);assert.equal(r.metrics.pistonPushes,2);assert.equal(r.metrics.monstersRemoved,2);
 assert.deepEqual(r.state.monsters,[point(5,8)]);assert.ok(r.state.stones.some(p=>same(p,point(5,9))));assert.ok(r.state.stones.some(p=>same(p,point(9,12))));
 const movements=physicalMonsterEvents(r);assert.equal(movements.filter(e=>e.phase==='song').length,3);assert.equal(movements.filter(e=>e.phase==='combat').length,1);
 const collision=movements.find(e=>e.phase==='combat');assert.deepEqual(collision.remaining,[point(5,8)]);
 check(checks,'Le chant conserve un gardien et provoque le combat des deux autres',`${r.metrics.actions} entrées et ${r.metrics.selections} sélections, sans refus ni perte. Les trois premiers chants installent le captif et sa caisse ; un autre chant pousse (9,9) vers (9,8), au contact de (9,7). Les deux disparaissent ensemble et le captif reste sur son bouton.`,'Observation des déplacements effectifs : le captif monte de deux cases puis reste contre son mur pendant le troisième chant qui termine la livraison de sa caisse.');
 const latch=replay(d.spec,d.commands.slice(0,d.stages[0].turn)+'D');assert.equal(latch.metrics.blocked,0);assert.equal(latch.metrics.deaths,0);assert.ok(latch.state.monsters.some(p=>same(p,point(5,9))));assert.ok(latch.state.stones.some(p=>same(p,point(5,10))));assert.equal(circuitPressed(w,latch.state,'captif'),false);assert.equal(circuitPressed(w,latch.state,'verrou'),true);assert.equal(latch.state.gateClosed[0],true);assert.equal(latch.state.gateClosed[1],true);
 check(checks,'Quitter le pupitre par chant déplace vraiment les deux poids','Un D après leur installation descend le gardien en (5,9) et la caisse en (5,10). Le chargement et la destination orange se ferment ; la commande verte reste occupée par le monstre qui vient remplacer la caisse.','Contre-parcours réel ; ce maintien du bouton vert est conservé et aucune règle cachée ne distingue les deux poids.');
 const cell=walkRegion(w,s,[point(5,8)]);assert.deepEqual([...cell].sort(),['5,10','5,11','5,12','5,8','5,9']);assert.equal(w.mirrors.length,0);
 for(let y=8;y<=12;y++){assert.equal(terrainAt(w,point(4,y)),'#');assert.equal(terrainAt(w,point(6,y)),'#');}
 assert.equal(terrainAt(w,point(5,7)),'#');assert.equal(terrainAt(w,point(5,13)),'#');
 check(checks,'Les deux poids de la chambre scellée ne remplacent pas la caisse haute','Le monstre et sa caisse restent enfermés dans les cinq cases verticales (5,8) à (5,12), entourées de murs. Aucun miroir ni presse ne les en extrait, et toutes les visées extérieures vers eux sont murées.','Inspection de toute la frontière de la chambre. Ces deux ressources assurent les boutons orange et vert ; elles ne peuvent servir au bouton cyan extérieur.');
 const impostor=new Author(d.spec);impostor.act(d.commands.slice(0,d.stages[1].turn)).go(11,11,'bard').go(9,12,'wizard').act('U').go(10,13);
 assert.ok(impostor.state.monsters.some(p=>same(p,point(9,12))));assert.equal(circuitPressed(w,impostor.state,'meule'),true);assert.equal(impostor.state.dead,false);
 const hit=stepDetailed(w,impostor.state,3);assert.equal(hit.state.dead,true);assert.equal(hit.state.complete,false);assert.deepEqual(hit.phases.map(p=>p.kind),['walk','combat']);assert.equal(hit.state.heroes.find(h=>h.kind==='wizard').dead,true);
 check(checks,'Un monstre comme poids cyan tue le héros de la destination voisine','Un échange réel dépose le monstre (9,9) sur le bouton cyan (9,12). Le Magicien peut alors approcher de (10,13), mais son pas vers la destination (9,13) le tue par contact. La caisse haute est donc le seul poids extérieur compatible avec la victoire.','Contre-parcours réel de placement et d’approche, complété par le comptage des ressources ; la paire de monstres n’est soumise à aucun quota de destruction.');
 checks.at(-1).counterBranch={commands:impostor.commands+'L',dead:true,complete:false};
 const hold=new Author(d.spec);hold.act(d.commands.slice(0,d.stages[5].turn)).act('D').go(9,7,'bard').act('D');assert.ok(hold.state.stones.some(p=>same(p,point(9,5))));assert.equal(hold.state.gateClosed[5],true);assert.equal(hold.state.dead,false);
 check(checks,'Relâcher la commande rose referme la sortie de la caisse','Après la seconde presse, le départ du Magicien referme le volet (9,6). La Barde peut faire son pas vers le bas, mais son chant laisse la caisse en (9,5), arrêtée par ce volet.','Contre-parcours sans perte ; rouvrir le volet permet de reprendre le transport. L’ouverture seule ne déplace pas la caisse.');
 const crushed=new Author(d.spec);crushed.act(d.commands.slice(0,d.stages[3].turn)).act('UUR').go(15,14,'bard').act('U').go(15,11,'wizard').act('U');
 const last=replay(d.spec,crushed.commands).trace.at(-1);assert.deepEqual(last.phases.map(p=>p.kind),['walk','crush']);assert.deepEqual(crushed.state.stones,[point(5,9)]);assert.equal(crushed.state.dead,false);
 check(checks,'Une presse fermée au mauvais bout écrase la livraison','La Barde maintient d’abord la commande rose, ce qui ferme la presse (9,4). Fermer ensuite la presse violette contre elle écrase la caisse haute au lieu de la livrer.','Contre-parcours réel sans mort de héros. La caisse perdue est la seule réserve extérieure sûre pour le cyan ; Undo peut restaurer le geste. Aucune obligation d’utiliser exactement le témoin n’est imposée.');
 addReport(5,d,r,checks);
}

reports.sort((a,b)=>a.level-b.level);
const report={gameCode:'SS19',version:'0.2.0',title:'Les Gardiens Noirs',status:'passed',levels:reports,scope:'Relecture des huit salles 0.2.0 et de leurs causes physiques. Le nouveau rail de N2 a été rédigé par un autre auteur, sur une géométrie 0.1.0 initialement conçue par ce relecteur ; les autres salles sont relues indépendamment de leurs auteurs. Contrôles ciblés, variantes rejouées et preuves géométriques ; aucune recherche bornée n’est présentée comme une impossibilité universelle.'};
writeFileSync(new URL('../independent-review-ss19.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:'passed',version:report.version,levels:reports.map(r=>r.level),checks:reports.reduce((n,r)=>n+r.checks.length,0)}));
