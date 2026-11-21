import {Author,board} from './author.mjs';
import {replay} from '../../scripts/solver.mjs';
import {circuitPressed} from '../../dist/core.js';
const b=board(18,19);
b.fill(3,2,7,2);b.fill(7,2,7,6);b.fill(1,4,7,4);b.fill(1,4,1,11);
b.fill(1,8,7,11);b.put(4,10,'#');b.fill(6,6,11,12);b.fill(13,6,13,11);
b.fill(3,12,6,14);b.fill(3,15,4,15);b.put(2,9,'#');b.fill(2,10,2,13);b.fill(8,12,8,15);b.fill(7,15,10,16);
b.put(3,2,'m');b.put(13,6,'m');b.put(3,4,'B');b.put(3,8,'T');b.put(2,8,'o');b.put(2,10,'o');b.put(7,16,'g');b.put(10,16,'g');
const spec={id:'ss14-05',title:'Les gardiens et le poids retiré',rows:b.strings(),
 mirrors:[{at:{x:6,y:8},facing:'NE'}],
 circuits:[{id:'sortie',buttons:[{x:7,y:4},{x:13,y:11},{x:4,y:9},{x:2,y:11},{x:10,y:8}],color:11}],
 gates:[{at:{x:8,y:13},circuit:'sortie',direction:'S',closedWhen:'released'}]};
const a=new Author(spec);
a.select('bard').act('RRRRDD').stage('Le premier gardien suit le chant jusqu’au coude qui le retiendra sur sa commande');
a.act('RRRRDDDDDLLU').stage('Le second gardien prend son poste ; les murs les maintiennent quand le Barde change d’axe');
a.go(3,9).stage('Le Barde rejoint la niche avant que la caisse entre dans la dernière portée');
a.select('thief').act('RR').stage('Le Voleur prépare la caisse au-dessus de la poche inaccessible par traction');
a.go(7,8).act('RRRR').stage('Le miroir obturateur est extrait et devient le dernier poids pour la porte');
a.select('bard').act('D').stage('Le chant dépose les deux caisses sur leurs commandes : l’une au-dessus de la butée, l’autre encore mobile');
a.go(3,11,'thief').act('DDDD').stage('Le Voleur éloigne le Barde des deux caisses sans déclencher de chant ni retirer un poids');
a.go(11,6).stage('Le Voleur quitte la portée du chemin de retour du Barde');
a.go(10,16,'bard').stage('Le Barde rejoint sa destination en conservant les deux gardiens vivants');
a.go(7,16,'thief').stage('Les cinq poids restent en place pendant l’arrivée du second partenaire');
function checkLocal(turn,alternative,expected,effect){
 const r=replay(spec,a.commands.slice(0,turn)+alternative);
 const observed={refusals:r.metrics.blocked,dead:r.state.dead,mirrors:r.state.mirrors.length,supports:r.state.supports,platformActive:r.state.platformActive??[],...Object.fromEntries(a.world.circuits.map(c=>[c.id,circuitPressed(a.world,r.state,c.id)]))};
 for(const [key,value]of Object.entries(expected))if(JSON.stringify(observed[key])!==JSON.stringify(value))throw Error(`Local check changed at ${turn} + ${alternative}: ${key}`);
 return{turn,alternative,effect,observed};
}
const localChecks=[
 checkLocal(45,"D",{"sortie": false},"Descendre volontairement retire le second poids tandis que la caisse de la poche reste bloquée."),
 checkLocal(45,"U",{"sortie": false},"Remonter volontairement retire les deux caisses de leurs commandes."),
 checkLocal(45,"L",{"sortie": false},"Partir à gauche retire les deux caisses de leurs commandes."),
 checkLocal(45,"R",{"refusals": 1, "sortie": true},"Le départ à droite rencontre le fond de la poche et est refusé. Les quatre départs immédiats sont ainsi bloqués ou défont une commande, sans preuve d’unicité globale.")
];
a.save(new URL('../level5-design.json',import.meta.url),{
 puzzle:22,label:'Adaptation de Heroes 2: Monsters · énigme 22 · garder les poids vivants',
 url:'https://sinkingstarwalkthrough.com/fr/heroes-2-monsters-solutions/#%C3%A9nigme-22',
 secondaryLabel:'Heroes 3: Bard, Druid · énigmes 18 et 19 · coins et niches',
 secondaryUrl:'https://sinkingstarwalkthrough.com/fr/heroes-3-bard-druid-solutions/#%C3%A9nigme-18',
 objective:'Conserver les gardiens à leurs postes, placer les caisses et éloigner le chanteur en maintenant toutes les commandes.'
},{kind:'adaptation',preserved:['Deux monstres et une caisse servent de poids conservés sur des commandes.','Les coins et les butées permettent au Barde de changer d’axe sans déplacer un gardien déjà installé.','La cargaison reçoit un placement en niche que la traction seule ne peut pas effectuer.'],changed:['Le Voleur prépare une caisse et déplace un miroir qui devient un poids de commande.','Une seconde caisse interdit au Barde de repartir simplement vers le bas en profitant de la butée.','Le départ du Barde hors de la niche est une traction forcée sans chant.','Les échanges de la source sont remplacés par les chants, les blocages locaux et les deux capacités présentes dans SS14.'],sourceReading:'Monsters 22 fournit les deux poids vivants et la caisse de commande. Heroes 3 énigmes 18 et 19 fournissent les coins de guidage et le travail des niches. La géométrie à cinq poids et le relais final du Voleur sont originaux.',localChecks,checkScope:'Comparaisons locales du parcours auteur ; aucune preuve d’optimalité ou d’unicité globale.'});
