import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {Author} from './author.mjs';
import {compileLevel,initialState,stepDetailed,circuitPressed} from '../../dist/core.js';
import {replay,decodeCommand,stateKey} from '../../scripts/solver.mjs';
const designs=Object.fromEntries([6,7,8].map(n=>[n,JSON.parse(readFileSync(new URL(`../level${n}-design.json`,import.meta.url)))]));
const checks=[];
const ok=(level,name,observed,scope='Branche effectivement rejouée ; aucune unicité ni optimalité n’est revendiquée.')=>checks.push({level,name,status:'passed',observed,scope});
const eq=(p,x,y)=>p.x===x&&p.y===y;
const runStep=(world,state,command)=>{const a=decodeCommand(command,state);return stepDetailed(world,state,a.id,a.data);};
const win=(n,commands)=>{const r=replay(designs[n].spec,commands);assert(r.state.complete);assert.equal(r.metrics.blocked,0);assert.equal(r.metrics.deaths,0);return r;};
for(const n of [6,7,8]){const d=designs[n],r=win(n,d.commands);assert.equal(d.actions.length,d.commands.length);assert(d.source.objective);ok(n,'Témoin complet sans refus ni perte',r.metrics);}
{
 const d=designs[6],a=new Author(d.spec);
 a.select('thief').act('D');a.select('bard').go(3,8).act('R');a.select('merchant').go(1,10).act('RRRRRDD');a.select('thief').go(8,12);
 const checkpoint=replay(d.spec,d.commands.slice(0,d.stages[0].turn));assert.equal(stateKey(a.state),stateKey(checkpoint.state));a.act(d.commands.slice(d.stages[0].turn));
 const variant=win(6,a.commands);ok(6,'Variante légale : extraction initiale par le Barde', {metrics:variant.metrics,commands:a.commands},'La variante conserve la carte et rejoint le même état du quai central. Le tirage initial du Voleur n’est donc pas présenté comme obligatoire.');
 const r=win(6,d.commands);assert.equal(r.state.supports.length,1);assert.equal(r.metrics.supportMoves,9);assert.equal(r.state.stones.length,1);assert(r.state.stones.some(p=>eq(p,12,13)));assert(circuitPressed(r.world,r.state,'arrivee'));
 ok(6,'Un appui réemployé, une caisse restée sèche',{support:r.state.supports[0],finalWeight:r.state.stones[0],supportMoves:r.metrics.supportMoves},'Le parcours conserve un seul appui ; les trois héros quittent le bouton extérieur, que la caisse maintient au terme du parcours.');
 const gate=d.spec.gates[0],button=d.spec.circuits[0].buttons[0];assert(eq(gate.at,13,12)&&eq(button,12,13));assert.equal(d.spec.rows[11][13],'#');assert.equal(d.spec.rows[13][13],'#');
 ok(6,'Le contrôleur final ne rejoint pas la presse en quittant son bouton',{gate:gate.at,button,otherCrossings:'walls',nonHeroWeights:['one dry crate']},'Certificat local de passage : une seule entrée vers les trois sorties ; bouton et presse ne sont pas voisins. L’appui reste dans l’eau et ne peut servir de poids sur ce bouton de sol.');
}
{
 const d=designs[7],world=compileLevel(d.spec),initial=initialState(world);
 let s=runStep(world,initial,'C').state;s=runStep(world,s,'C').state;const danger=runStep(world,s,'R');assert(danger.state.dead);assert(danger.phases.some(p=>p.kind==='combat'));
 ok(7,'Départ chanté immédiat du Barde : contact fatal',{dead:danger.state.dead,phases:danger.phases.map(p=>p.kind),monsters:danger.state.monsters},'Le mouvement du gardien est provoqué par le chant, pas par une poursuite autonome.');
 s=runStep(world,initial,'C').state;const returns=runStep(world,s,'U');assert(!returns.state.failed&&!returns.state.dead);assert(eq(returns.state.heroes[1].at,7,8));assert(returns.phases.some(p=>p.kind==='piston'));
 ok(7,'Sortie haute prématurée du Voleur : retour physique sur la commande',{thief:returns.state.heroes[1].at,phases:returns.phases.map(p=>p.kind),buttonStillPressed:circuitPressed(world,returns.state,'releve')});
 const old='RRCDDCRRRRRRDDDUUURCCRURRRRRUUUUUUULDRDDDDLCCRRRRRURRRDCCRRRUUCCURRRRURRU';const rejected=replay(d.spec,old);assert(!rejected.state.complete);assert(rejected.metrics.blocked||rejected.metrics.deaths);
 ok(7,'Ancien contournement par gardien-poids rejeté',{commands:old,firstBlockedTurn:rejected.trace.findIndex(t=>t.after.failed)+1,complete:rejected.state.complete,metrics:rejected.metrics},'Contre-exemple exact de l’ancienne carte, rejoué sur la correction. Ce résultat ne prétend pas énumérer toutes les stratégies.');
 const branch=replay(d.spec,'RRCDDCRR');assert(!branch.state.dead);assert.equal(branch.metrics.blocked,0);assert(branch.state.monsters.some(p=>eq(p,6,7)));assert(!circuitPressed(branch.world,branch.state,'releve'));
 assert.equal(d.spec.rows[6][6],'#');assert.equal(d.spec.rows[7][5],'#');assert.equal(d.spec.rows[8][6],'~');
 ok(7,'Voleur parti : le gardien ne peut prendre sa place sur le bouton',{guard:{x:6,y:7},onlyDryDestination:{x:7,y:7},destinationClosed:branch.state.gateClosed[0],otherDestinations:['north wall','west wall','south water'],button:{x:7,y:8}},'Le seul déplacement sec du gardien vise la presse au-dessus du bouton. Sans poids de relève elle est fermée ; si un héros tient encore le bouton, l’arrivée du gardien le touche. La réserve établit la relève avant ce déplacement.');
}
{
 const d=designs[8],world=compileLevel(d.spec),cutA={x:7,y:11},cutB={x:4,y:12};
 const reachable=(supports)=>{
  const supported=new Set(supports.map(p=>`${p.x},${p.y}`));for(const p of d.spec.platforms)supported.add(`${p.at.x},${p.at.y}`);
  const seen=new Set(['4,7']),queue=[{x:4,y:7}],ports=[{x:9,y:7},{x:10,y:8}];
  for(let i=0;i<queue.length;i++){const p=queue[i];const next=[{x:p.x-1,y:p.y},{x:p.x+1,y:p.y},{x:p.x,y:p.y-1},{x:p.x,y:p.y+1}];for(let j=0;j<2;j++)if(eq(p,ports[j].x,ports[j].y))next.push(ports[1-j]);for(const q of next){if(q.x<0||q.y<0||q.x>=20||q.y>=20)continue;const cell=d.spec.rows[q.y][q.x],key=`${q.x},${q.y}`;if(cell==='#'||(cell==='~'&&!supported.has(key))||seen.has(key))continue;seen.add(key);queue.push(q);}}
  return seen.has('1,17');
 };
 assert(reachable([cutA,cutB]));assert(!reachable([cutA]));assert(!reachable([cutB]));
 ok(8,'Deux coupures d’eau indépendantes jusqu’aux sorties',{cuts:[cutA,cutB],bothPresent:true,withoutNorthCut:false,withoutWestCut:false},'Certificat topologique optimiste : toutes les portes sont considérées ouvertes, la plateforme hydraulique active et le port optique utilisable. Même ainsi, supprimer l’un des deux appuis coupe l’accès aux sorties.');
 for(const p of [cutA,cutB])for(const q of [{x:p.x-1,y:p.y},{x:p.x+1,y:p.y},{x:p.x,y:p.y-1},{x:p.x,y:p.y+1}])assert.notEqual(d.spec.rows[q.y][q.x],'~');
 ok(8,'Les deux appuis finaux ne peuvent voyager de trou en trou',{cuts:[cutA,cutB],waterNeighbours:[0,0]},'Un appui ne glisse que de l’eau vers l’eau ; chacun de ces deux trous est entouré de sol ou de murs. Deux caisses distinctes sont nécessaires pour les combler.');
 const walls=[[9,6],[8,8],[9,9],[11,8]];for(const [x,y]of walls)assert.equal(d.spec.rows[y][x],'#');
 ok(8,'Le miroir d’angle est physiquement immobile',{mirror:{x:9,y:8},walls: walls.map(([x,y])=>({x,y})),ports:[{x:9,y:7},{x:10,y:8}]},'Une poussée depuis le nord ou l’est vise un mur. Un tirage depuis ces faces bute sur le mur situé derrière le tireur. Les deux autres faces sont murées ; le chant ignore le miroir. Ses seuls ports optiques sont les deux cases adjacentes.');
 const full=replay(d.spec,d.commands),trace=full.trace.find(t=>t.after.stones.some(p=>eq(p,14,13))&&t.after.monsters.length===0&&t.after.heroes[1].at.y===14);
 assert(trace);const beforeEarly=new Author(d.spec);beforeEarly.act(d.commands.slice(0,full.trace.indexOf(trace)+1)).select('bard').act('D');assert(beforeEarly.state.supports.some(p=>eq(p,14,13)));assert.equal(beforeEarly.state.stones.length,2);assert.equal(beforeEarly.state.monsters.length,0);
 ok(8,'Démontage trop tôt : la réserve haute devient un appui perdu dans le chantier',{dryCrates:beforeEarly.state.stones.length,strandedSupport:{x:14,y:13},remainingMonsters:0},'Branche légale après la purge. Deux ressources sèches restent pour deux trous isolés plus un poids final : cette erreur consomme irréversiblement une ressource encore nécessaire. Cette preuve conditionnelle ne prétend pas couvrir une stratégie qui conserverait le monstre avant la purge.');
 const stage40=replay(d.spec,d.commands.slice(0,d.stages[2].turn)),last40=stage40.trace.at(-1);assert(!last40.phases.some(p=>p.kind==='piston'));assert(eq(stage40.state.heroes[0].at,14,14));
 ok(8,'Le retour de commande chante le Marchand vers le nord',{turn:d.stages[2].turn,merchant:stage40.state.heroes[0].at,phases:last40.phases.map(p=>p.kind)},'Vérification de la légende : le sas se referme vide. L’unique poussée de presse du témoin concerne le gardien lors de la purge.');
 const beforeFinal=replay(d.spec,d.commands.slice(0,d.stages[9].turn));const walk=runStep(beforeFinal.world,beforeFinal.state,'L');assert(!walk.state.failed&&!walk.state.dead);assert(!circuitPressed(world,walk.state,'arrivee'));assert(walk.state.stones.some(p=>eq(p,5,12)));
 ok(8,'Le départ actif du Voleur retire le poids final',{thief:walk.state.heroes[1].at,crate:walk.state.stones.find(p=>eq(p,5,12)),finalGateClosed:walk.state.gateClosed[2]},'Branche locale valide : le tirage ferme la sortie. On ne déclare pas cette erreur globalement irréparable.');
 const carried=new Author(d.spec);carried.act(d.commands.slice(0,d.stages[9].turn)).select('bard').act('L');assert(eq(carried.state.heroes[1].at,4,12));assert(carried.state.stones.some(p=>eq(p,6,12)));assert(circuitPressed(world,carried.state,'arrivee'));
 ok(8,'Le chant depuis l’autre rive extrait le Voleur sans tirer sa caisse',{thief:carried.state.heroes[1].at,bard:carried.state.heroes[2].at,finalWeight:{x:6,y:12},gateOpen:true},'Le Voleur est transporté passivement ; la caisse se trouve hors de la portée initiale du Barde.');
 const guardReplacement={...beforeFinal.state,stones:beforeFinal.state.stones.filter(p=>!eq(p,6,12)),monsters:[{x:6,y:12}],heroes:beforeFinal.state.heroes.map(h=>h.kind==='thief'?{...h,at:{x:8,y:12}}:h)};const contact=runStep(world,guardReplacement,'L');assert(contact.state.dead);
 ok(8,'Un gardien sur le bouton interdit la dernière traversée',{guard:{x:6,y:12},adjacentMandatoryCells:[{x:5,y:12},{x:7,y:12}],contactFatal:true},'Contrefactuel local, pas une position déclarée atteignable : un monstre déjà posé sur ce bouton empêche un héros restant à droite de franchir le couloir. L’installation tardive après tous les passages n’est pas exclue par une recherche exhaustive ; aucune preuve globale de ce remplacement n’est revendiquée.');
}
const report={game:'ss20',levels:[6,7,8],method:'Témoins exacts, variante gagnante, ancien contournement rejoué, certificats topologiques et branches physiques ciblées. Aucune recherche bornée utilisée comme preuve négative.',limits:['Aucune unicité de solution ni minimum de coups ne sont revendiqués.','La variante N6 par chant initial est conservée ; le tirage initial n’est pas indispensable.','N7 ferme le contre-exemple du gardien de relève par la géométrie de la presse, de l’eau et du bouton.','N8 exige deux appuis distincts par topologie ; après la purge du gardien, trois caisses sont nécessaires aux deux ponts et au poids sec.','Le remplacement du poids final par un gardien est rejeté avant la dernière traversée ; aucune preuve exhaustive générale sur toute installation tardive de ce gardien n’est annoncée.','Les refus et morts des branches de contrôle ne figurent pas dans les témoins gagnants.'],checks};
writeFileSync(new URL('../final-ss20-review.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({checks:checks.length,passed:checks.filter(c=>c.status==='passed').length,report:'reference/final-ss20-review.json'}));
