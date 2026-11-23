import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {compileLevel,initialState,stepDetailed,terrainAt,supported,gateClosed,circuitPressed} from '../../dist/core.js';
import {replay} from '../../scripts/solver.mjs';
import {Author} from './author.mjs';

const read=n=>JSON.parse(readFileSync(new URL(`../level${n}-design.json`,import.meta.url),'utf8'));
const point=(x,y)=>({x,y}),same=(p,q)=>p.x===q.x&&p.y===q.y;
const reports=[];
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
 check(checks,'Apprentissage de la chasse protégé','Le gardien ne peut marcher que sur les trois cases du rail. Il reste dans ce rail pendant le témoin, puis une fermeture de presse le pousse dans l’eau.','Composante de terrain et revue de toutes les phases du témoin ; la noyade est une interaction enseignée, sans prétention de nécessité universelle.');
 reports.push({level:1,title:d.spec.title,status:'passed',checks});
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
 reports.push({level:3,title:d.spec.title,status:'passed',checks});
}

{
 const d=read(6),w=compileLevel(d.spec),checks=[],r=replay(d.spec,d.commands);
 assert.equal(r.state.complete,true);assert.equal(r.metrics.blocked,0);assert.equal(r.metrics.deaths,0);assert.equal(r.metrics.reflections,2);assert.equal(r.state.stones.length,1);assert.ok(r.state.supports.some(p=>same(p,point(11,14))));assert.ok(r.state.stones.some(p=>same(p,point(8,14))));
 check(checks,'Deux livraisons différentes',`${r.metrics.actions} entrées : premier reflet vers l’appui (11,14), second vers le poids sec (8,14), victoire sans refus ni perte.`,'Rejeu des deux fonctions finales des caisses ; aucun caractère unique du témoin n’est affirmé.');
 const early=replay(d.spec,d.commands.slice(0,d.stages[2].turn)+'XX');assert.equal(early.metrics.deaths,0);assert.equal(early.trace.at(-1).after.failed,true);assert.deepEqual(early.state.heroes[0].at,point(4,8));assert.deepEqual(early.trace.at(-2).phases.map(p=>p.kind),['reflect','gate']);
 check(checks,'Répéter X sans quitter le débarcadère échoue','Un deuxième X immédiat renvoie le Guerrier sur le quai de départ et active le poids. Un troisième X est alors refusé par le débarcadère fermé.','Contre-parcours concret ; il est réparable par d’autres manœuvres ou Undo, et n’est pas annoncé irréversible.');
 const alternative='UURUUXUULXCCDDDLDDDDDDLLLRRRCCRRRRRRRUUUUDLURRUUUULUURUUUCCRRRCCRDDDRDDDRRCCDDDLDDDDDDRRDDRRRDR',alt=replay(d.spec,alternative);assert.equal(alt.state.complete,true);assert.equal(alt.metrics.blocked,0);assert.equal(alt.metrics.deaths,0);assert.equal(alt.metrics.reflections,2);assert.ok(alt.state.supports.some(p=>same(p,point(11,14))));assert.ok(alt.state.stones.some(p=>same(p,point(8,14))));
 check(checks,'Variante valide : préparer la charge après les reflets',`${alt.metrics.actions} entrées. Le second reflet livre d’abord la caisse en (5,14), puis le chant et deux échanges la placent sur sa commande. Les deux ressources et les deux reflets restent employés.`,'Variante gagnante rejouée, plus longue que le témoin ; la préparation préalable n’est donc pas déclarée universellement nécessaire.');
 reports.push({level:6,title:d.spec.title,status:'passed',checks,alternatives:[{label:'Charge préparée après les reflets',commands:alternative,metrics:alt.metrics}]});
}
{
 const d=read(7),checks=[],r=replay(d.spec,d.commands);assert.equal(r.state.complete,true);assert.equal(r.metrics.blocked,0);assert.equal(r.metrics.deaths,0);assert.equal(r.state.mirrors.length,2);assert.equal(r.state.gateClosed[0],false);
 check(checks,'Relais supprimé et passage rouvert',`${r.metrics.actions} entrées ; la charge ferme puis rouvre la presse, un miroir disparaît et les trois destinations sont occupées.`,'Rejeu du témoin ; destruction et réouverture sont deux états distincts.');
 const a=new Author(d.spec);a.act(d.commands.slice(0,d.stages[3].turn));assert.equal(a.state.gateClosed[0],true);assert.equal(a.state.mirrors.length,2);
 a.go(6,16,'wizard').act('R');a.select('bard').act('UUXUUL');a.select('wizard').act('L');a.go(12,12,'warrior');
 const denied=stepDetailed(a.world,a.state,5);assert.equal(denied.state.failed,true);assert.equal(denied.state.dead,false);assert.ok(denied.blockedMirrorIndices.length);assert.deepEqual(denied.state.heroes.map(h=>h.at),a.state.heroes.map(h=>h.at));assert.deepEqual(denied.phases,[]);
 check(checks,'Détruire sans rouvrir ne suffit pas','Une route différente retire le Barde en conservant la charge sur le bouton. Le relais est détruit, mais la presse restée fermée bloque le reflet final entier, avec le signal rouge attendu.','Contre-parcours concret ; le transfert du Magicien pourtant valide n’est pas appliqué partiellement.');
 const alternative='DDLUUURRUUUXUURRRDLCLLCDDDDUCCURRRURCUXUULCCLCCULX',alt=replay(d.spec,alternative);assert.equal(alt.state.complete,true);assert.equal(alt.metrics.blocked,0);assert.equal(alt.metrics.deaths,0);assert.equal(alt.metrics.monstersRemoved,0);assert.deepEqual(alt.state.monsters,[point(16,12)]);assert.ok(alt.state.stones.some(p=>same(p,point(15,12))));assert.equal(alt.state.mirrors.length,2);assert.equal(alt.state.gateClosed[0],false);
 check(checks,'Variante valide : garder le gardien vivant',`${alt.metrics.actions} entrées. Une seule poussée de file conserve le monstre sur (16,12) et la caisse écran sur (15,12). Le recalage, la destruction du relais et la réouverture restent présents.`,'Variante gagnante rejouée ; éliminer le monstre n’est pas nécessaire.');
 reports.push({level:7,title:d.spec.title,status:'passed',checks,alternatives:[{label:'Gardien conservé comme poids',commands:alternative,metrics:alt.metrics}]});
}
{
 const d=read(8),w=compileLevel(d.spec),s=initialState(w),checks=[],r=replay(d.spec,d.commands);assert.equal(r.state.complete,true);assert.equal(r.metrics.blocked,0);assert.equal(r.metrics.deaths,0);assert.equal(r.metrics.monstersRemoved,0);assert.deepEqual(r.state.monsters,[point(6,6),point(12,11)]);assert.deepEqual(r.state.supports,[point(13,17)]);assert.equal(r.state.stones.length,0);
 check(checks,'Les deux gardiens arrivent vivants',`${r.metrics.actions} entrées, ${r.metrics.huntSteps} phases de chasse et ${r.metrics.monsterHuntMoves} pas de monstres ; les deux gardiens terminent sur leurs plaques.`,'Rejeu indépendant du témoin complet, sans suppression d’une contrainte de ressource.');
 const releasedPrefix=d.commands.slice(0,d.stages[6].turn),released=replay(d.spec,releasedPrefix),early=replay(d.spec,releasedPrefix+'CCDCU');assert.equal(early.metrics.blocked,0);assert.equal(early.metrics.deaths,0);assert.ok(early.state.monsters.some(p=>same(p,point(12,7))));assert.ok(early.trace.at(-1).phases.some(p=>p.kind==='piston'));assert.equal(circuitPressed(w,early.state,'gardien-est'),false);
 check(checks,'Quitter trop tôt la libération fait reculer le chasseur est','Après un seul pas du Barde, le Guerrier quitte sa commande : la retenue renvoie le chasseur est en (12,7), et sa destination reste fermée.','Contre-parcours concret sans mort ; la retenue ne peut pas être ouverte puis oubliée immédiatement.');
 assert.equal(w.stones.length,1);assert.equal(w.monsters.length,2);assert.equal(w.mirrors.length,1);assert.deepEqual(w.mirrors[0].at,point(17,11));
 for(const [behind,landing] of [[point(17,12),point(17,10)],[point(17,10),point(17,12)],[point(18,11),point(16,11)],[point(16,11),point(18,11)]])assert.ok(terrainAt(w,behind)==='#'||terrainAt(w,landing)==='#');
 check(checks,'Le miroir ne peut remplacer un gardien','Pour chacune des quatre directions de poussée du miroir (17,11), le départ du pousseur ou la destination du miroir est un mur. Aucun chant, échange ou reflet ne déplace un miroir.','Vérification géométrique exhaustive des quatre lignes de poussée ; aucune réserve ne permet de lever cette obstruction.');
 const island=walkRegion(w,s,[point(14,17)]);assert.equal(island.size,9);assert.ok(s.heroes.every(h=>!island.has(`${h.at.x},${h.at.y}`)));assert.ok(s.stones.every(p=>!island.has(`${p.x},${p.y}`)));assert.ok(s.monsters.every(p=>!island.has(`${p.x},${p.y}`)));
 const waterExits=[];for(const key of island){const [x,y]=key.split(',').map(Number);for(const [dx,dy] of [[0,1],[0,-1],[1,0],[-1,0]]){const q=point(x+dx,y+dy);if(terrainAt(w,q)==='~')waterExits.push(q);}}
 assert.deepEqual(waterExits,[point(13,17)]);assert.ok([...island].every(key=>{const [x,y]=key.split(',').map(Number);return x!==17&&y!==11;}));
 check(checks,'L’île vide impose la caisse du nord-est','L’île des neuf cases est vide au départ et hors des deux axes du miroir. Son seul voisin aquatique est (13,17). Aucun échange ne peut augmenter le nombre d’occupants d’une île encore vide ; il faut donc fabriquer ce passage avec la caisse unique.','Invariant d’effectif et inspection de toute la frontière de l’île ; ne repose pas sur une recherche limitée.');
 for(const id of ['gardien-ouest','gardien-est']){const c=w.circuits.find(c=>c.id===id);assert.equal(c.buttons.length,1);assert.ok(w.gates.some(g=>g.circuit===id&&g.closedWhen==='released'&&w.goals.some(p=>same(p,g.at))));assert.ok(c.buttons.every(b=>!w.goals.some(p=>same(p,b))));}
 check(checks,'Aucun gardien ne peut être sacrifié à la victoire','La caisse doit devenir appui et le miroir est fixe. Les trois héros occupent les trois destinations, distinctes des deux plaques. Les deux monstres sont donc les deux seuls poids encore disponibles pour tenir les presses-buts.','Preuve de conservation des poids ; les appuis immergés ne comptent pas comme poids.');
 const alternative='XDDRLUUURCCRLCDDDLDDDDDDRRRRRRRRDDDDDLDRRRULLLLLLLLLCCDDDDDCCLLDDDDDDDDDDDDDRRRRRRRRCCDRRRRRRRRRRR',alt=replay(d.spec,alternative);assert.equal(alt.state.complete,true);assert.equal(alt.metrics.blocked,0);assert.equal(alt.metrics.deaths,0);assert.deepEqual(alt.state.supports,[point(13,17)]);assert.deepEqual(alt.state.monsters,[point(6,6),point(12,11)]);assert.equal(alt.metrics.bentSwaps,0);
 check(checks,'Variante valide : reflet immédiat de la réserve',`${alt.metrics.actions} entrées. X dès le départ livre la caisse sous la presse ; le Barde l’en extrait. Le pont et les deux gardiens restent indispensables, mais la visée coudée est évitée.`,'Variante gagnante rejouée ; le sort coudé est illustré par le témoin et n’est pas annoncé comme obligatoire.');
 reports.push({level:8,title:d.spec.title,status:'passed',checks,alternatives:[{label:'Réserve extraite par X initial',commands:alternative,metrics:alt.metrics}]});
}

{
 const d=read(4),w=compileLevel(d.spec),s=initialState(w),checks=[],r=replay(d.spec,d.commands);assert.equal(r.state.complete,true);assert.equal(r.metrics.blocked,0);assert.equal(r.metrics.deaths,0);
 check(checks,'Témoin de construction complet',`${r.metrics.actions} entrées et ${r.metrics.selections} sélections ; les deux réserves construisent le pont continu du témoin, sans refus ni perte.`,'Description du témoin uniquement ; la variante ci-dessous montre que les deux immersions ne sont pas obligatoires.');
 const left=walkRegion(w,s,s.heroes.filter(h=>h.at.x<11).map(h=>h.at));assert.ok([...left].every(key=>Number(key.split(',')[0])<14));assert.deepEqual(s.platformActive,[true]);assert.equal(terrainAt(w,point(13,5)),'#');assert.equal(terrainAt(w,point(13,6)),'#');
 check(checks,'La plateforme active ne donne pas une traversée directe','La plateforme hydraulique est déjà active au départ, mais le graphe de marche des deux héros de gauche reste séparé de la rive droite. Les murs (13,5) et (13,6) ferment la sortie directe de la trappe.','Inspection du terrain initial avec la plateforme active, pas une preuve contre tous les usages ultérieurs d’appuis mobiles.');
 const partial=replay(d.spec,d.commands.slice(0,d.stages[4].turn)+'RR');assert.equal(partial.trace.at(-1).after.failed,true);assert.equal(partial.metrics.deaths,0);assert.deepEqual(partial.state.heroes[0].at,point(12,11));assert.equal(partial.state.supports.length,2);
 check(checks,'Le pont partiel ne suffit pas à marcher droit','Après la première livraison, le Guerrier peut avancer jusqu’en (12,11), mais son pas suivant vers (13,11) est refusé par l’eau nue.','Contre-parcours concret ; des transports plus élaborés restent autorisés.');
 const ferry='RRRRRDDDDDDRRRCUCLDDDDDDDDDDRRRUUUCCDDDDDDDDDLCCUUUUUUULLDDDDDDDDLDRRRRLUUUUUUUUULDDDDDDDDLDRRRCCUULLLRRCLUCLUURCCDDDDDLLLLLCCDDDDCCUURRRR',f=replay(d.spec,ferry);assert.equal(f.state.complete,true);assert.equal(f.metrics.blocked,0);assert.equal(f.metrics.deaths,0);assert.equal(f.metrics.platformsCreated,1);assert.equal(f.metrics.selections,16);assert.deepEqual(f.state.supports,[point(11,11),point(13,11)]);assert.deepEqual(f.state.stones,[point(9,11)]);
 check(checks,'Variante valide : une caisse voyage sur son propre appui',`${f.metrics.actions} entrées, ${f.metrics.selections} sélections, ${f.metrics.supportMoves} déplacements d’appui, ${f.metrics.swaps} échanges et ${f.metrics.monstersRemoved} monstre retiré. Les deux caisses sont employées mais une seule est immergée ; l’autre reste sèche en (9,11).`,'Le Barde entraîne ensemble caisse et appui jusqu’à la rive ; le Magicien utilise ensuite la caisse comme cible. Réfute la nécessité d’un pont continu ou de deux immersions.');
 const late='RRRRRDDDDDDRRRCCLDDDDDDDDDDRRRUUULLDDLCUUUUUUULLDDDDDDDDLDRRRRLUUUUUUUUULDDDDDDDDLDRRRRCCUUUURRCLLULLDRRRRRCDDDDDDLLLLLDDDDLLLLLCDDDDLCDDRRRR',l=replay(d.spec,late);assert.equal(l.state.complete,true);assert.equal(l.metrics.blocked,0);assert.equal(l.metrics.deaths,0);assert.equal(l.metrics.selections,9);assert.equal(l.metrics.platformsCreated,2);assert.equal(l.metrics.monstersRemoved,1);
 check(checks,'Variante valide : noyade après le chantier',`${l.metrics.actions} entrées et ${l.metrics.selections} sélections. Le Magicien maintient la trappe pendant la construction ; son départ tardif noie ensuite le gardien. Les deux réserves sont toujours utilisées.`,'Le calendrier de la noyade est une option de la solution, sans condition cachée imposant son ordre.');
 reports.push({level:4,title:d.spec.title,status:'passed',checks,alternatives:[{label:'Caisse transportée sur son appui puis échangée',commands:ferry,metrics:f.metrics,final:{stones:f.state.stones,supports:f.state.supports,monsters:f.state.monsters}},{label:'Noyade différée après construction',commands:late,metrics:l.metrics}]});
}
{
 const d=read(5),checks=[],r=replay(d.spec,d.commands);assert.equal(r.state.complete,true);assert.equal(r.metrics.blocked,0);assert.equal(r.metrics.deaths,0);assert.equal(r.metrics.monstersRemoved,2);assert.deepEqual(r.state.monsters,[point(5,8)]);assert.ok(r.state.stones.some(p=>same(p,point(9,12))));
 check(checks,'Contraste éliminer et conserver',`${r.metrics.actions} entrées et ${r.metrics.selections} sélections. La paire de chasseurs est éliminée, le troisième reste sur sa commande et la caisse haute rejoint le bouton cyan.`,'Rejeu du témoin complet ; aucune victoire par l’élimination de tous les monstres.');
 const latch=replay(d.spec,d.commands.slice(0,d.stages[2].turn)+'D');assert.equal(latch.metrics.blocked,0);assert.equal(latch.metrics.deaths,0);assert.ok(latch.state.monsters.some(p=>same(p,point(5,9))));assert.ok(latch.state.stones.some(p=>same(p,point(5,10))));assert.equal(circuitPressed(latch.world,latch.state,'captif'),false);assert.equal(latch.state.gateClosed[0],true);assert.equal(latch.state.gateClosed[1],true);
 check(checks,'Un pas chanté défait réellement le verrou du captif','Après l’installation du gardien, un D du Barde déplace le monstre en (5,9) et la caisse en (5,10). La sortie orientale et le chargement haut se referment.','Contre-parcours concret sans perte ; l’extraction par échange évite cet effet.');
 const a=new Author(d.spec);a.act(d.commands.slice(0,d.stages[4].turn));a.go(9,8,'bard');const left=stepDetailed(a.world,a.state,3);assert.equal(left.state.failed,true);assert.ok(left.state.stones.some(p=>same(p,point(10,6))));assert.deepEqual(left.phases,[]);
 check(checks,'Le remplacement direct de la première presse est bloqué','Une Barde amenée en (9,8) ne peut chanter à gauche : son propre pas aboutit au nouveau mur (8,8), et la caisse reste sur la première presse.','Essai concret sur la géométrie durcie ; ne prouve pas l’unicité de la paire de presses.');
 const alternative='CDDDDDLLLLLLRRRRRRUCUUUCCDDDDLLLLLLLLLLLLLUCDRRRRCCDDDDDDRRRRRDRRCLLLLDCDDDUCUUUUUURRRRRRUCUURRRRUUUUUUDCCDDLLLLLLLUCUCCRUCCLDDDDDUCDDDLDLDDDDDLUCLLLLDCDDDDDRDDDDRRRRRRRCDRRUUURUUUR',alt=replay(d.spec,alternative);assert.equal(alt.state.complete,true);assert.equal(alt.metrics.blocked,0);assert.equal(alt.metrics.deaths,0);assert.equal(alt.metrics.actions,181);assert.equal(alt.metrics.selections,22);assert.ok(!alt.trace.some(t=>t.phases.some(p=>p.kind==='piston'&&alt.world.gates[p.gateIndex]?.circuit==='presse-sud')));assert.ok(alt.state.stones.some(p=>same(p,point(9,12))));assert.deepEqual(alt.state.monsters,[point(5,8)]);
 check(checks,'Variante valide : échange et relâchement temporaire remplacent la deuxième presse',`${alt.metrics.actions} entrées et ${alt.metrics.selections} sélections. Après la première presse, un chant relâche le captif ; le Magicien extrait la charge, puis un autre chant reverrouille la prison et plusieurs relèves libèrent les héros.`,'Variante plus longue, rejouée sans refus ni perte. Elle conserve la caisse haute et le gardien, mais réfute une obligation universelle d’employer la seconde presse.');
 reports.push({level:5,title:d.spec.title,status:'passed',checks,alternatives:[{label:'Seconde presse remplacée par relâchement et échanges',commands:alternative,metrics:alt.metrics}]});
}
reports.sort((a,b)=>a.level-b.level);
const report={gameCode:'SS19',status:'passed',levels:reports,scope:'Revue indépendante de L1 et L3–L8. L2 a été conçu par ce relecteur et possède un rapport séparé, sans label de revue indépendante. Contrôles ciblés et preuves géométriques ; aucune recherche bornée n’est présentée comme une impossibilité universelle.'};
writeFileSync(new URL('../independent-review-ss19.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:'passed',levels:reports.map(r=>r.level),checks:reports.reduce((n,r)=>n+r.checks.length,0)}));
