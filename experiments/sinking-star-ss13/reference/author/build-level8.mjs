import {Author,board} from './author.mjs';
import {circuitPressed,stepDetailed} from '../../dist/core.js';
import {decodeCommand} from '../../scripts/solver.mjs';
import assert from 'node:assert/strict';

// The same two crates, two mirrors and exchange anchors are reused. The two
// shores are deliberately not joined by a permanent walking corridor.
const b=board(20,20,'~');
b.fill(1,7,8,14);b.put(8,13,'~');b.put(8,15);b.put(8,16);
b.put(8,6,'#');b.put(9,16,'#');b.put(7,15,'#');b.put(7,16,'#');b.put(8,17,'#');
b.put(6,11,'T');b.put(2,10,'Z');b.put(6,10,'o');b.put(6,9,'m');
b.put(5,9,'#');b.put(7,9,'#');b.put(6,8,'#');
b.fill(11,2,14,13);b.fill(15,10,18,13);b.put(15,3);b.put(15,4);
b.put(17,14);b.put(17,15);
b.put(11,6,'m');b.put(14,10,'o');
b.fill(17,1,18,5);b.put(17,5,'#');b.put(17,6);b.put(18,6);b.put(17,2,'g');b.put(18,3,'g');

const spec={id:'ss13-08',title:'Les deux retours de l’ancre',rows:b.strings(),facing:'S',
 mirrors:[{at:{x:8,y:16},facing:'NE'},{at:{x:14,y:6},facing:'SW'}],
 circuits:[
  {id:'ancre-vivante',buttons:[{x:14,y:8},{x:14,y:10}],color:10},
  {id:'retour',buttons:[{x:12,y:7}],color:15},
  {id:'dernier-miroir',buttons:[{x:8,y:12}],color:14},
  {id:'presse',buttons:[{x:12,y:2}],color:0},
 ],
 gates:[
  {at:{x:8,y:14},circuit:'retour',direction:'S',closedWhen:'pressed'},
  {at:{x:14,y:6},circuit:'presse',direction:'E',closedWhen:'pressed'},
  {at:{x:17,y:6},circuit:'dernier-miroir',direction:'E',closedWhen:'released'},
  {at:{x:18,y:6},circuit:'retour',direction:'N',closedWhen:'pressed'},
 ],
 platforms:[
  {at:{x:8,y:13},circuit:'ancre-vivante',activeWhen:'pressed'},
  {at:{x:16,y:15},circuit:'ancre-vivante',activeWhen:'pressed'},
  {at:{x:16,y:6},circuit:'ancre-vivante',activeWhen:'pressed'},
  {at:{x:9,y:12},circuit:'retour',activeWhen:'pressed'},
  {at:{x:10,y:12},circuit:'retour',activeWhen:'pressed'},
 ]};
const a=new Author(spec);
const localChecks=[];
const at=(p,x,y)=>p.x===x&&p.y===y;
function probe(label,commands,expected,meaning){
 let state=a.state;const phases=[];
 for(const command of commands){const action=decodeCommand(command,state),d=stepDetailed(a.world,state,action.id,action.data);state=d.state;phases.push(...d.phases);}
 assert(expected(state,phases),label);
 localChecks.push({label,afterTurn:a.commands.length,commands,meaning,failed:state.failed,dead:state.dead,supports:state.supports,monsters:state.monsters});
}
probe('near-target-is-fatal','CR',s=>s.heroes[1].dead,
 'Depuis le départ, le premier échange vers l’est atteint la caisse gardée ; il ne saute pas cette cible proche.');
a.act('D').stage('La caisse proche quitte la ligne gardée : elle devra encore servir de cargaison.');
a.go(8,15).act('U').stage('Le premier miroir est extrait de son angle, mais sa commande finale reste inaccessible.');
probe('early-mirror-extraction-refused','U',s=>s.failed&&!s.dead,
 'L’appui de la seconde traction est encore retiré : le miroir ne peut pas être monté immédiatement jusqu’à sa commande finale.');
a.act('L').go(8,7).stage('Le Voleur prépare la seule arrivée soutenue de son miroir.');
a.select('wizard').act('RU').stage('Le Magicien réemploie l’ancre lointaine et installe le monstre vivant sur la commande profonde.');
a.go(12,6).stage('Le Magicien devient la cible proche du miroir droit.');
a.act('X').stage('Le premier reflet coordonné transporte le duo et active l’appui au moment de l’arrivée.');
probe('arrival-weight-cannot-leave-first','L',s=>s.heroes[0].dead,
 'Si le Magicien quitte sa commande avant que le Voleur quitte son appui, le retrait hydraulique tue le Voleur.');
a.select('thief').act('R').stage('Le Voleur quitte l’appui temporaire ; le Magicien peut désormais le désactiver.');
a.go(11,3,'wizard');
a.go(14,7,'thief').act('D');
probe('mirror-is-not-a-free-final-weight','D',s=>s.heroes[0].dead&&s.mirrors.some(m=>at(m.at,14,8)),
 'Tirer le miroir jusqu’à la commande du Magicien est une action effective, mais place le Voleur contre le monstre : la substitution immédiate n’est pas une solution.');
a.act('LU').act('LL').stage('Le miroir droit devient le poids du retour : le pont s’ouvre, mais le miroir gauche et la sortie sont verrouillés.');
assert(circuitPressed(a.world,a.state,'retour')&&a.state.gateClosed[0]&&a.state.gateClosed[3]);
a.go(6,12).act('D').act('R').go(7,12).act('RRRR');
const premature=new Author(spec);premature.state=a.state;premature.commands=a.commands;
premature.go(13,7).act('R');
assert(premature.state.supports.some(p=>at(p,10,12))&&!premature.state.stones.some(p=>at(p,10,12)));
localChecks.push({label:'premature-bridge-immersion',afterTurn:a.commands.length,commands:premature.commands.slice(a.commands.length),meaning:'Récupérer le miroir pendant que la caisse est encore sur le pont consomme cette caisse en appui fixe au mauvais endroit ; la cargaison ne peut plus être tirée vers la presse.',supports:premature.state.supports,dead:premature.state.dead});
a.act('RR').stage('La caisse dégagée au début revient par le pont ; elle n’est pas encore sacrifiée à l’eau.');
a.go(13,7).act('R').act('ULUUU').act('RDRU').stage('Le miroir du pont est récupéré et repositionné : le retour disparaît, sa future ligne de chargement apparaît.');
assert(!circuitPressed(a.world,a.state,'retour')&&!a.state.gateClosed[0]&&!a.state.gateClosed[3]);
a.go(12,11).act('UUUUUUUU').stage('La cargaison traverse l’emplacement de l’ancienne commande et rejoint le rayon du miroir déplacé.');
a.act('X').stage('Le second emploi du miroir droit charge la presse, sans déplacer le monstre plus éloigné.');
a.go(11,2,'wizard');
const press=stepDetailed(a.world,a.state,4);
assert(press.phases.some(p=>p.kind==='piston'&&p.moves.some(m=>m.actor==='stone'&&at(m.from,14,6)&&at(m.to,15,6))));
assert(press.state.supports.some(p=>at(p,15,6))&&!press.phases.some(p=>p.kind==='pull'));
a.act('R').stage('La commande distante pousse latéralement la caisse dans l’eau : le premier appui final devient permanent.');
a.act('L').stage('Le Magicien libère la presse pour rendre le passage praticable.');
a.go(11,11,'thief');
a.go(12,10,'wizard').act('L').stage('L’ancienne caisse d’arrivée sert une deuxième fois d’ancre : le Magicien retourne à gauche et la caisse revient dans l’atelier.');
a.go(8,11).act('R').stage('L’échange entre partenaires restitue le Voleur à son miroir sans rouvrir le pont.');
a.go(14,8).stage('Le Magicien reprend temporairement les deux appuis pendant la dernière extraction.');
a.go(8,14,'thief').act('U');
probe('extraction-weight-cannot-leave-first','CL',s=>s.heroes[0].dead,
 'Pendant la reprise du miroir, le Voleur occupe encore l’appui provisoire : le Magicien doit maintenir sa commande jusqu’à la fin des trois tractions.');
a.act('UU').act('L').go(8,9).stage('Le miroir gauche est repris, traverse l’appui temporaire puis devient le poids de la dernière porte.');
probe('wrong-second-reflection-distance','X',s=>s.heroes[1].dead,
 'Le Magicien est déjà plus proche que le monstre, mais sa distance de quatre le ferait encore tomber dans l’eau ; le placement exact compte une seconde fois.');
a.select('wizard').act('U').stage('Le Magicien choisit une distance de reflet sûre ; retirer la commande ne retire plus aucun poids engagé sur l’eau.');
probe('unprotected-final-reflection-loses-monster','LX',s=>!s.dead&&!s.monsters.some(p=>at(p,14,10)),
 'Quitter entièrement le rayon avant le reflet emporte le monstre-poids dans l’eau. Le reflet est valide, mais détruit cette ressource vivante.');
a.select('thief').act('X').stage('Le deuxième retour par les miroirs transporte les deux héros et conserve le monstre lointain.');
a.go(12,9).act('UU').stage('Le Voleur remet l’ancienne ancre dans la ligne de remplacement de la dernière commande.');
a.go(14,8,'wizard').act('L').stage('La caisse remplace enfin le Magicien : les deux poids durables autorisent le départ des deux héros.');
a.select('thief').act('L');
a.go(17,2,'wizard').stage('Le Magicien traverse l’appui immergé et la passerelle finale.');
a.go(18,3,'thief').stage('Le Voleur rejoint la seconde destination ; tous les poids nécessaires restent en place.');
a.save(new URL('../level8-design.json',import.meta.url),{
 puzzle:10,label:'Adaptation de Heroes and Water · énigme 10 · préserver puis réemployer une ligne d’échange',
 url:'https://sinkingstarwalkthrough.com/fr/heroes-and-water-solutions/#%C3%A9nigme-10',
 secondaryLabel:'Heroes and Mirrors · énigme 5 · conserver les miroirs comme poids',
 secondaryUrl:'https://sinkingstarwalkthrough.com/fr/heroes-and-mirrors-solutions/#%C3%A9nigme-5',
 objective:'Préparer deux retours, conserver les bonnes ancres et choisir quels poids pourront être sacrifiés avant de réunir le duo sur la dernière rive.',
 piston:true,platform:true,
},{
 kind:'adaptation',
 preserved:['Heroes and Water 10 : une première cible peut condamner la ligne utile ; une ancre doit être conservée et réemployée.','Heroes and Mirrors 5 : un miroir sert à la fois au transport et au maintien d’une commande.','Heroes and Light 1 : une presse dépose latéralement une cargaison hors de portée de la traction.'],
 changed:['Deux caisses, deux miroirs, deux monstres et quatre circuits forment une boucle entre deux rives et une sortie sans ancre initiale.','Le pont de retour interdit simultanément l’extraction du miroir gauche et l’accès final ; récupérer son miroir change donc les routes possibles.','Le premier transport et la dernière extraction utilisent la même commande à deux poids, d’abord occupée par le Magicien puis relayée par une caisse.','La priorité proche des reflets, la traction unitaire et les monstres stationnaires sont les règles de SS13.'],
 sourceReading:'Heroes and Water 10 demande de préserver un échange utile malgré ses premières cibles. Heroes and Mirrors 5 associe départ par reflet et poids conservé. Heroes and Light 1 fournit le dépôt par presse ; aucune géométrie source n’est reproduite exactement et aucun pouvoir absent du duo n’est ajouté.',
 additionalSources:[{label:'Heroes and Light · énigme 1',url:'https://sinkingstarwalkthrough.com/fr/heroes-and-light-solutions/#%C3%A9nigme-1'}],
 localCounterfactuals:localChecks,
 proofScope:'Ces vérifications exécutent des branches locales sur la route témoin. Elles ne prouvent ni l’unicité de la solution, ni une longueur minimale, ni la nécessité globale de chaque étape de cette route.',
 requiredInWitness:['near-target-clearance','bent-monster-swap','living-weight','two-coordinated-transfers','mirror-recovery','opposed-return-gates','cargo-return','lateral-piston','delayed-immersion','anchor-recovery','partner-swap','temporary-hydraulic-extraction','permanent-weight-relay'],
});
