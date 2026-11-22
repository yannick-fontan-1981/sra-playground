import {Author,board} from './author.mjs';
import {writeFileSync} from 'node:fs';
import {stepDetailed,circuitPressed} from '../../dist/core.js';
import {decodeCommand,replay} from '../../scripts/solver.mjs';
import assert from 'node:assert/strict';

const b=board(20,20,'#');
b.fill(1,1,8,18);b.fill(9,1,10,18,'~');b.fill(11,1,18,18);
b.fill(4,4,4,6,'#');b.fill(6,4,6,6,'#');
b.put(3,3,'m');b.put(7,3,'m');b.put(5,3,'B');b.put(5,10,'Z');
b.put(6,15,'o');b.put(13,16,'o');b.put(9,14,'s');b.put(8,12,'~');
b.put(11,16,'#');
b.fill(15,1,15,6,'#');b.put(15,3,'.');b.fill(16,6,18,6,'#');
b.put(17,2,'g');b.put(17,4,'g');
export const spec={id:'ss15-08',title:'Le compte des deux rives',rows:b.strings(),facing:'S',
 mirrors:[{at:{x:5,y:2},facing:'SE'},{at:{x:12,y:2},facing:'SW'},{at:{x:5,y:12},facing:'NE'}],
 circuits:[
  {id:'premier-choeur',buttons:[{x:3,y:5},{x:7,y:5}],color:11},
  {id:'charge-conservee',buttons:[{x:6,y:15}],color:15},
  {id:'accord-final',buttons:[{x:3,y:7},{x:7,y:7},{x:14,y:4}],color:10},
 ],
 gates:[
  {at:{x:11,y:14},circuit:'charge-conservee',direction:'W',closedWhen:'released'},
  {at:{x:15,y:3},circuit:'accord-final',direction:'E',closedWhen:'released'},
  {at:{x:16,y:3},circuit:'premier-choeur',direction:'E',closedWhen:'pressed'},
 ],
 platforms:[
  {at:{x:9,y:8},circuit:'premier-choeur',activeWhen:'pressed'},
  {at:{x:10,y:8},circuit:'premier-choeur',activeWhen:'pressed'},
 ],
};

export function build(){
 const a=new Author(spec);
 const stage=label=>{a.stage(label);if(process.env.SS15_AUTHOR_DEBUG)console.log(label,a.commands.length,JSON.stringify({heroes:a.state.heroes,stones:a.state.stones,supports:a.state.supports,monsters:a.state.monsters}));};
 a.select('bard').act('DD');
 stage('Les deux gardiens prennent leurs premières commandes et déploient le pont provisoire.');
 a.select('wizard').act('U');
 stage('Le Magicien remplace le Barde dans le chœur sans déplacer les deux poids vivants.');
 a.go(13,14,'bard').act('UULL');
 stage('Le Barde charge la caisse orientale sur la presse maintenue ouverte par la caisse de l’autre rive.');
 a.go(5,10,'wizard').act('D');
 stage('Un rayon coudé retire le Barde du chargement sans déplacer la caisse placée sur la presse.');
 a.go(17,10,'wizard');
 a.go(4,15,'bard').act('U');
 stage('Le retrait du poids occidental déclenche le dépôt latéral : le second appui du passage durable est créé.');
 a.act('RRRRURRRR');
 stage('Le Barde déplace les deux appuis et transporte réellement la caisse sèche sur l’autre rive, au-dessus de la presse fermée.');
 a.act('RRUUUUUULLUUU');
 stage('La caisse qui commandait la presse devient le poids oriental de l’accord final.');
 a.go(5,5,'wizard').act('U');
 stage('Deux miroirs relaient le rayon : le Magicien libère le poids oriental et replace le Barde exactement entre les gardiens.');
 a.select('bard').act('DD');
 stage('Les gardiens prennent leurs deux commandes finales ; le pont provisoire disparaît et la chambre s’ouvre.');
 a.go(11,12,'wizard').act('L');
 stage('Le rayon de l’atelier sert une seconde fois : le Barde quitte son dernier chœur sans retirer les poids.');
 a.select('bard').act('RR').go(17,4);
 a.go(17,2,'wizard');
 stage('Le dernier héros traverse le passage durable ; les trois poids restent en place pour la victoire du duo.');
 const design=a.result({
  puzzle:24,label:'Adaptation de Heroes and Water · énigme 24 · les échanges ne changent pas le compte des îles',
  url:'https://sinkingstarwalkthrough.com/fr/heroes-and-water-solutions/#%C3%A9nigme-24',
  secondaryLabel:'Heroes 3: Bard, Druid · énigme 14 · quitter le chœur sans déplacer ses poids',
  secondaryUrl:'https://sinkingstarwalkthrough.com/fr/heroes-3-bard-druid-solutions/#%C3%A9nigme-14',
  objective:'Préparer un passage durable, transférer la caisse sèche et changer le rôle des deux gardiens avant de réunir le duo sur la rive finale.',
 },{
  kind:'adaptation',
  preserved:['Water 24 : les échanges changent les occupants mais conservent leur nombre de chaque côté ; un vrai transfert doit compléter le plan.','Heroes 3, 14 : deux monstres maintiennent des commandes et le Barde doit être déplacé sans chanter après leur placement.','Light 1 : une presse fournit un dépôt latéral préparé depuis un autre poste.'],
  changed:['Les deux gardiens alimentent d’abord le pont provisoire, puis les commandes de la chambre finale.','La caisse occidentale commande d’abord la presse ; son retrait transforme l’autre caisse en appui, puis elle traverse comme cargaison sèche et devient le troisième poids.','Le Barde déplace les deux appuis chargés pour contourner la presse fermée sans immerger sa caisse.','Un rayon à deux coudes reconduit le Barde au centre du chœur après la livraison, sans déplacement des objets voisins.','Le même miroir de l’atelier sert aux deux extractions forcées du Barde, avant et après le changement de service des gardiens.'],
  sourceReading:'Water 24 fournit directement la coopération Magicien–Barde et le comptage des îles. Heroes 3, 14 fournit la pose de deux poids vivants puis le départ sans chant. Light 1 fournit le dépôt par presse. Les rives, le chargement, les deux appuis mobiles et le réseau de rayons sont recomposés pour le chant carré et les règles SS15.',
  additionalSources:[{label:'Heroes and Light · énigme 1',url:'https://sinkingstarwalkthrough.com/fr/heroes-and-light-solutions/#%C3%A9nigme-1'}],
  localCounterfactuals:[],
  proofScope:'La route et les branches locales vérifient leurs résultats exécutés. Aucun compteur d’actions ni limite de recherche ne prouve une longueur minimale ou une solution unique.',
 });
 const checks=design.adaptation.localCounterfactuals;
 const at=(p,x,y)=>p.x===x&&p.y===y;
 function branch(label,stageIndex,prepare,commands,expected,meaning){
  const stage=design.stages[stageIndex],trial=new Author(spec).act(design.commands.slice(0,stage.turn));prepare(trial);
  let state=trial.state;const phases=[];
  for(const c of commands){const action=decodeCommand(c,state),d=stepDetailed(trial.world,state,action.id,action.data);state=d.state;phases.push(...d.phases);}
  assert(expected(state,phases),label);
  checks.push({label,afterTurn:stage.turn,commands:trial.commands.slice(stage.turn)+commands,meaning,refused:state.failed,dead:state.dead,complete:state.complete,heroes:state.heroes,stones:state.stones,supports:state.supports,monsters:state.monsters,circuits:Object.fromEntries(trial.world.circuits.map(c=>[c.id,circuitPressed(trial.world,state,c.id)])),phases:phases.map(p=>p.kind)});
 }
 branch('walking-away-withdraws-the-first-bridge',0,()=>{},'D',s=>!s.dead&&!s.failed&&!circuitPressed(a.world,s,'premier-choeur'),
  'Le départ volontaire du Barde entraîne les gardiens et retire les deux cases du pont provisoire.');
 branch('ordinary-loading-exit-moves-cargo-and-support',2,()=>{},'D',s=>!s.dead&&!s.failed&&s.stones.some(p=>at(p,11,15))&&s.supports.some(p=>at(p,9,15)),
  'Le départ sud est légal mais déplace la caisse hors de la presse et décale aussi le premier appui. La préparation n’est plus celle du dépôt latéral.');
 branch('unload-the-command-before-loading-the-press',1,t=>t.go(4,15,'bard'),'U',s=>!s.failed&&!s.dead&&s.supports.length===1&&s.stones.length===2&&!circuitPressed(a.world,s,'charge-conservee'),
  'Retirer la caisse occidentale avant le chargement ferme une presse vide : aucun second appui n’est créé. Une nouvelle préparation reste possible.');
 branch('straight-delivery-carries-away-the-return-support',5,()=>{},'UUUUUUUUU',s=>!s.failed&&!s.dead&&s.stones.some(p=>at(p,14,4))&&s.supports.some(p=>at(p,10,4))&&!s.supports.some(p=>at(p,10,13)),
  'La livraison directe place bien la caisse mais emporte un appui jusqu’au nord. Le détour latéral du parcours conserve les deux cases du passage de retour.');
 branch('global-reflection-is-not-the-two-bend-spell',6,t=>t.go(5,5,'wizard'),'X',s=>s.failed&&!s.dead&&at(s.heroes[0].at,5,5)&&at(s.heroes[1].at,12,4),
  'L’activation globale des miroirs est refusée ici. La flèche du Magicien suit les deux faces et échange les héros ; ACTION5 ne relaie pas les reflets entre miroirs.');
 branch('ordinary-final-exit-removes-the-living-weights',8,()=>{},'D',s=>!s.failed&&!s.dead&&!circuitPressed(a.world,s,'accord-final'),
  'Un dernier pas chanté retire les deux gardiens de leurs commandes finales et referme la chambre.');
 branch('straight-ray-selects-the-guard-before-the-bard',8,t=>t.go(12,7,'wizard'),'LU',s=>!s.failed&&!s.dead&&s.monsters.some(p=>at(p,12,7))&&!circuitPressed(a.world,s,'accord-final'),
  'La visée horizontale atteint d’abord le gardien droit. Le Magicien le remplace momentanément, puis son départ libère la commande ; le rayon coudé par l’atelier évite cette cible intermédiaire.');
 branch('wrong-final-exit-realigns-the-bridge-with-the-closed-press',9,t=>t.select('bard').act('D').go(8,14,'wizard'),'RRR',s=>s.failed&&!s.dead&&at(s.heroes[0].at,10,14)&&s.supports.some(p=>at(p,9,14))&&s.supports.some(p=>at(p,10,14)),
  'Un départ sud du Barde ramène les appuis devant la presse fermée. Le Magicien franchit l’eau, mais son pas vers la rive orientale est alors refusé.');
 const route=replay(spec,design.commands);
 const counts=s=>{const out={west:0,river:0,east:0};for(const p of [...s.heroes.filter(h=>!h.dead).map(h=>h.at),...s.stones,...s.monsters])out[p.x<=8?'west':p.x>=11?'east':'river']++;return out;};
 const swaps=route.trace.flatMap((t,i)=>t.phases.filter(p=>p.kind==='swap').map(p=>{const before=counts(p.before),after=counts(p.after);assert.deepEqual(after,before);return{turn:i+1,before,after};}));
 const cargoImports=route.trace.flatMap((t,i)=>t.phases.flatMap(p=>p.moves.filter(m=>m.actor==='stone'&&m.from.x<=10&&m.to.x>=11).map(m=>({turn:i+1,phase:p.kind,from:m.from,to:m.to}))));
 assert.equal(swaps.length,4);assert.equal(cargoImports.length,1);assert.equal(cargoImports[0].phase,'song');
 design.islandCountEvidence={definition:'Héros vivants, caisses sèches et monstres ; ouest x≤8, rivière x9–10, est x≥11. Les miroirs fixes et appuis ne sont pas comptés.',initial:counts(route.trace[0].before),final:counts(route.state),swaps,cargoImports,scope:'Les quatre échanges du parcours conservent chaque compte. Le chant importe la caisse sèche à l’entrée 69 ; les traversées des héros produisent les autres transferts physiques. L’immersion d’une caisse retire un occupant de ce compte.'};
 design.difficultyNotes={role:'Finale de conservation des comptes, transport physique et changements de rôle.',resources:{dryCrates:2,initialSubmergedSupports:1,livingMonsters:2,fixedMirrors:3,finalWeights:3},referencePlanDependencies:design.stages.map(s=>s.label),claimScope:'Les onze étapes décrivent le parcours auteur ; les huit branches locales et le comptage sont exécutés. Aucune unicité ou longueur minimale n’est revendiquée.'};
 return design;
}
if(process.argv[1]?.endsWith('build-level8.mjs')){
 const design=build();writeFileSync(new URL('../level8-design.json',import.meta.url),JSON.stringify(design,null,2)+'\n');
 console.log(JSON.stringify({title:design.spec.title,metrics:design.metrics,stages:design.stages.length,localCounterfactuals:design.adaptation.localCounterfactuals.length}));
}
