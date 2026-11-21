import {Author,board} from './author.mjs';
import {writeFileSync} from 'node:fs';
import {stepDetailed,circuitPressed} from '../../dist/core.js';
import {decodeCommand} from '../../scripts/solver.mjs';
import assert from 'node:assert/strict';

const b=board(20,20,'#');
b.fill(1,1,8,18);b.fill(9,1,10,18,'~');b.fill(11,1,18,18);
// The choir has a narrow central aisle and two separated living weights.
b.fill(4,4,4,6,'#');b.fill(6,4,6,6,'#');
b.put(3,3,'m');b.put(7,3,'m');b.put(5,3,'B');b.put(5,10,'T');
// Reflection pocket: a loaded press opens the extraction route, while changing
// the choir later opens the final return route. There is no outside entrance.
b.put(6,10,'#');b.put(5,14,'#');b.put(8,12,'#');b.put(8,13,'#');b.put(8,16,'#');
// The narrow loading lane prevents a sung westward departure beside the load.
b.put(11,16,'#');b.put(13,16,'o');b.put(14,5,'o');
// The goal chamber has one entrance and a second, opposed inner command.
b.fill(15,1,15,6,'#');b.put(15,3,'.');b.fill(16,6,18,6,'#');
b.put(17,2,'g');b.put(17,4,'g');
const spec={id:'ss14-08',title:'Le dernier accord des deux rives',rows:b.strings(),facing:'S',
 mirrors:[{at:{x:6,y:14},facing:'NE'}],
 circuits:[
  {id:'choeur',buttons:[{x:3,y:5},{x:7,y:5}],color:11},
  {id:'presse',buttons:[{x:6,y:14}],color:9},
  {id:'charge',buttons:[{x:11,y:14}],color:15},
  {id:'dernier-accord',buttons:[{x:3,y:7},{x:7,y:7},{x:14,y:4}],color:10},
 ],
 gates:[
  {at:{x:11,y:14},circuit:'presse',direction:'W',closedWhen:'released'},
  {at:{x:6,y:13},circuit:'presse',direction:'S',closedWhen:'released'},
  {at:{x:6,y:15},circuit:'presse',direction:'N',closedWhen:'released'},
  ...[12,14,15,16].map(y=>({at:{x:12,y},circuit:'charge',direction:'E',closedWhen:'pressed'})),
  {at:{x:12,y:13},circuit:'presse',direction:'E',closedWhen:'pressed'},
  {at:{x:7,y:14},circuit:'presse',direction:'E',closedWhen:'released'},
  {at:{x:7,y:15},circuit:'charge',direction:'S',closedWhen:'released'},
  {at:{x:7,y:13},circuit:'choeur',direction:'N',closedWhen:'pressed'},
  {at:{x:15,y:3},circuit:'dernier-accord',direction:'E',closedWhen:'released'},
  {at:{x:16,y:3},circuit:'choeur',direction:'E',closedWhen:'pressed'},
 ],
 platforms:[
  {at:{x:9,y:8},circuit:'choeur',activeWhen:'pressed'},
  {at:{x:10,y:8},circuit:'choeur',activeWhen:'pressed'},
  {at:{x:9,y:15},circuit:'dernier-accord',activeWhen:'pressed'},
  ...[{x:9,y:12},{x:9,y:13},{x:10,y:12},{x:10,y:13}].map(at=>({at,circuit:'presse',activeWhen:'released'})),
 ],
};
const a=new Author(spec),checks=[];
const at=(p,x,y)=>p.x===x&&p.y===y;
function probe(label,commands,expected,meaning){let state=a.state;const phases=[];for(const command of commands){const action=decodeCommand(command,state),d=stepDetailed(a.world,state,action.id,action.data);state=d.state;phases.push(...d.phases);}assert(expected(state,phases),label);checks.push({label,afterTurn:a.commands.length,commands,meaning,refused:state.failed,dead:state.dead,monsters:state.monsters,stones:state.stones,supports:state.supports});}
a.select('bard').act('DD').stage('Les deux gardiens occupent ensemble les commandes du premier pont.');
probe('walking-away-breaks-the-choir','D',s=>!circuitPressed(a.world,s,'choeur'), 'Un départ volontaire du Barde entraîne les deux poids et retire le pont.');
a.go(5,6,'thief').act('DDD').stage('Le Voleur extrait le Barde sans chant : le pont provisoire reste alimenté.');
a.go(1,12,'bard');
a.select('thief').stage('Le miroir tient la presse distante ouverte avant tout chargement.');
a.go(14,6).act('DDD').go(13,8).act('LLLLLLLLL');
a.go(5,9).act('DDD').act('R').go(6,11).act('R').stage('La première caisse revient par le pont provisoire dans le rayon du miroir.');
a.act('X').stage('Le reflet prépare le premier appui ; le miroir maintient toujours la presse ouverte.');
a.go(13,12,'bard');
a.go(13,15,'thief').act('UU').act('R').go(15,16).stage('Le Voleur place la seconde caisse dans la portée exacte du Barde.');
a.select('bard').act('LL').stage('Le chant charge la presse ; la caisse verrouille le flanc de l’atelier et libère la reprise du miroir.');
a.go(11,11,'thief').act('UU').act('RRR').stage('Le Voleur extrait le Barde de l’atelier sans déplacer la cargaison chargée.');
a.go(5,8,'bard');
a.go(7,14,'thief').stage('Le Voleur rejoint le flanc libéré du miroir pendant que la cargaison attend sur la presse.');
a.act('R').stage('La reprise du miroir libère la presse ; la caisse devient le second appui et le retour pousse le Voleur avec le miroir.');
a.act('R').go(9,13).act('U').act('R').go(10,13).act('RR').stage('Le miroir contourne la presse fermée par son parvis hydraulique, sur les deux appuis préparés.');
a.act('RRR').go(14,12).act('UUUUUUUUU').act('L').stage('Le même miroir devient le troisième poids de la chambre finale.');
a.go(5,7,'thief').act('UUUUU').stage('Le Voleur replace le Barde au milieu du chœur sans déplacer les gardiens.');
a.go(1,8,'thief');
a.select('bard').act('DD').stage('Les deux gardiens changent de service : le premier pont se retire et les commandes finales sont occupées.');
a.go(5,6,'thief').act('DDDDD').stage('Le Voleur extrait une seconde fois le Barde ; cette fois les poids doivent rester sur les commandes finales.');
a.go(9,14,'thief').stage('Le Voleur revient ancrer le premier appui pour le passage du Barde.');
a.go(7,16,'bard').act('URRUURR').stage('Le chant emporte le Voleur sur le parvis en conservant l’arrivée du Barde ; les deux appuis changent ensuite de place.');
a.go(17,4,'bard');
a.go(17,2,'thief').stage('Les deux partenaires atteignent la chambre par le passage préparé en conservant les trois poids.');
const design=a.result({
 puzzle:14,label:'Adaptation de Heroes 3: Bard, Druid · énigme 14 · quitter le chœur sans déplacer ses poids',
 url:'https://sinkingstarwalkthrough.com/fr/heroes-3-bard-druid-solutions/#%C3%A9nigme-14',
 secondaryLabel:'Heroes and Light · énigme 1 · dépôt latéral par une presse',
 secondaryUrl:'https://sinkingstarwalkthrough.com/fr/heroes-and-light-solutions/#%C3%A9nigme-1',
 objective:'Préparer le passage durable, réemployer le miroir et donner leur dernier poste aux deux gardiens avant de réunir les héros.',
 },{
 kind:'adaptation',
 preserved:['Heroes 3, 14 : deux monstres servent de poids ; le Barde est déplacé sans chant après leur mise en place.','Light 1 : une presse dépose latéralement une caisse hors de portée d’une traction normale.','Mirrors 1 et 4 : le miroir est transporté puis conservé comme poids après son dernier emploi.'],
 changed:['Les deux gardiens assurent deux services successifs ; le pont provisoire s’efface quand leurs commandes finales sont occupées.','Deux caisses doivent être rapportées ou chargées avant leur immersion ; le reflet et la presse fabriquent les deux appuis du passage durable.','Le miroir commande d’abord la presse ; sa reprise libère le dépôt et déclenche une poussée en file du miroir et du Voleur.','Une cloison de chargement empêche de remplacer le dépôt latéral par un simple pas chanté vers l’ouest.','Le miroir traverse ensuite les appuis et le parvis hydraulique, puis devient le troisième poids final.','Après le dépôt, la presse fermée maintient elle-même la commande de chargement ; une ouverture opposée permet de quitter son parvis.','Au dernier passage, le Voleur ancre un appui avant d’être chanté sur le parvis ; le Barde peut alors rejoindre son arrivée en laissant glisser les autres appuis.'],
 sourceReading:'Heroes 3, énigme 14 fournit le départ accompagné du Barde après la pose de deux poids vivants. Light 1 fournit le dépôt par presse ; Mirrors 1 et 4 fournissent la conservation et la reprise du miroir. La double fonction des gardiens, les deux rives, les circuits opposés et la cascade de chargement sont originaux ; aucun faisceau ni pouvoir absent du duo n’est repris.',
 additionalSources:[{label:'Heroes and Mirrors · énigmes 1 et 4',url:'https://sinkingstarwalkthrough.com/fr/heroes-and-mirrors-solutions/'}],
 localCounterfactuals:checks,
 proofScope:'Les routes et branches locales sont exécutées. Aucun résultat de recherche bornée ni compteur d’actions ne prouve l’unicité ou la longueur minimale.',
 });
design.difficultyNotes={role:'Finale à ressources réemployées et passages opposés.',resources:{dryCrates:2,mobileMirrors:1,livingMonsters:2,finalWeights:3},referencePlanDependencies:['Maintenir les deux gardiens pendant la première sortie forcée du Barde.','Revenir avec la première caisse avant de retirer le pont provisoire.','Conserver le miroir sur la presse pendant la préparation du reflet et du chargement.','Placer le second chargement avec les deux héros avant sa translation par chant.','Créer le premier appui avant la cascade qui pousse le Voleur et le miroir sur cette arrivée.','Employer la fermeture de la presse pour créer le second appui et déployer son contournement hydraulique.','Transporter le miroir après son rôle de commande et de réflecteur.','Replacer les deux mêmes gardiens et extraire le Barde une dernière fois sans chant.']};
function branch(label,stagePrefix,prepare,commands,expected,meaning){
 const stage=design.stages.find(s=>s.label.startsWith(stagePrefix));assert(stage,label);
 const trial=new Author(spec).act(design.commands.slice(0,stage.turn));prepare(trial);
 let state=trial.state;const phases=[];
 for(const c of commands){const action=decodeCommand(c,state),d=stepDetailed(trial.world,state,action.id,action.data);state=d.state;phases.push(...d.phases);}
 assert(expected(state,phases,trial),label);
 checks.push({label,afterTurn:stage.turn,commands:trial.commands.slice(stage.turn)+commands,meaning,refused:state.failed,dead:state.dead,complete:state.complete,heroes:state.heroes,stones:state.stones,supports:state.supports,mirrors:state.mirrors,monsters:state.monsters,circuits:Object.fromEntries(trial.world.circuits.map(c=>[c.id,circuitPressed(trial.world,state,c.id)])),phases:phases.map(p=>p.kind)});
}
branch('north-extraction-restores-mirror','Le reflet prépare le premier appui',t=>t.go(6,13,'thief'),'U',(s,p)=>!s.failed&&!s.dead&&s.mirrors.some(m=>at(m.at,6,14))&&p.some(v=>v.kind==='piston'),'La traction nord est effective mais sa presse de retour remet le miroir sur sa commande ; cette branche ne transporte pas le miroir vers le pont haut.');
branch('voluntary-exit-rearranges-the-load','Le chant charge la presse',()=>{},'D',s=>!s.failed&&!s.dead&&s.stones.some(p=>at(p,11,15))&&s.supports.some(p=>at(p,9,15))&&!circuitPressed(a.world,s,'charge'),'Le départ sud est légal : il déplace aussi la cargaison et le premier appui et retire la commande de chargement. Un second pas sud peut placer le Barde lui-même sur cette commande ; cette préparation différente n’est pas déclarée insoluble.');
branch('missing-first-support-kills-piston-arrival','La première caisse revient',t=>{
 t.go(13,12,'bard');t.go(13,15,'thief').act('UU').act('R').go(15,16);t.select('bard').act('LL');
 t.go(11,11,'thief').act('UU').act('RRR');t.go(5,8,'bard');t.go(7,14,'thief');
},'R',s=>s.dead&&s.heroes.some(h=>h.kind==='thief'&&h.dead)&&s.supports.some(p=>at(p,10,14))&&!s.supports.some(p=>at(p,9,14)),'En omettant le premier reflet, le dépôt latéral crée bien le second appui, mais la poussée en file envoie le Voleur sur l’arrivée encore vide.');
branch('walking-away-breaks-last-weights','Les deux gardiens changent de service',()=>{},'D',s=>!s.failed&&!s.dead&&!circuitPressed(a.world,s,'dernier-accord'),'Le pas volontaire sud décale les deux poids vivants après leur second service ; les commandes finales cessent de tenir.');
branch('leaving-before-anchoring-loses-bard-arrival','Le Voleur revient ancrer',t=>{t.go(17,2,'thief');t.go(7,16,'bard').act('URR');},'U',s=>s.failed&&!s.dead&&!s.supports.some(p=>at(p,9,14)),'Si le Voleur part avant le chant d’approche, le premier appui glisse ; le Barde atteint son quai mais son pas suivant vers l’arrivée prévue est refusé.');
design.difficultyNotes.claimScope='Dépendances du plan de référence, vérifiées par ses étapes et des branches locales. Les départs chantés alternatifs peuvent produire d’autres préparations ; aucune nécessité globale, unicité ou longueur minimale n’est revendiquée.';
writeFileSync(new URL('../level8-design.json',import.meta.url),JSON.stringify(design,null,2)+'\n');
console.log(JSON.stringify({title:design.spec.title,metrics:design.metrics,stages:design.stages.length,localCounterfactuals:checks.length}));
