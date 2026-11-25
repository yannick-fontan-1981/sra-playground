import {Author,board} from './author.mjs';
import {fileURLToPath} from 'node:url';
const b=board(20,20);
// Two western relay alcoves and an eastern depot are linked by one narrow lock.
b.fill(6,3,7,16);b.fill(2,8,7,10);b.fill(4,4,6,4);b.fill(4,14,6,14);b.put(5,13);
b.fill(8,9,10,9);b.fill(11,7,17,15);
b.fill(12,5,17,5);b.put(15,6);b.put(15,4);b.put(15,3);b.fill(11,1,17,2);
for(const x of [11,13,15,17])b.put(x,1,'g');
b.put(4,4,'Z');b.put(4,14,'M');b.put(6,9,'W');b.put(7,10,'T');
b.put(14,9,'o');b.put(15,9,'o');b.put(17,5,'o');
export const spec={id:'ss21-05',title:'Le dernier intercepteur',mode:'quartet',rows:b.strings(),
 circuits:[{id:'double-serrure',buttons:[{x:4,y:4},{x:4,y:14}],color:15},{id:'sortie',buttons:[{x:13,y:5}],color:10}],
 gates:[{at:{x:9,y:9},circuit:'double-serrure',direction:'N',closedWhen:'released'},{at:{x:15,y:3},circuit:'sortie',direction:'N',closedWhen:'released'}]};
export function build(){const a=new Author(spec);
 a.go(16,9,'warrior').act('LLLLLLLL').stage('Pendant que deux héros maintiennent les postes, le Guerrier ramène les deux caisses en file à travers la serrure.');
 a.go(6,8,'thief').act('UUUUU').go(7,3).stage('Le Voleur sépare la première caisse et la remonte jusqu’à l’axe du poste supérieur.');
 a.select('wizard').act('R').go(7,4).stage('Le Magicien remplace son propre poids par la caisse sans interrompre la double commande.');
 a.select('warrior').act('L');
 a.go(6,10,'thief').act('DDDDD').go(7,15).stage('La deuxième caisse descend à hauteur du poste inférieur ; le Voleur s’écarte de sa ligne.');
 a.go(12,12,'warrior');a.go(6,16,'thief');
 a.go(5,14,'wizard').act('L').stage('Le Magicien relève le Marchand sur le second poste par un échange de partenaires.');
 a.select('merchant').act('U').go(7,13);
 a.select('wizard').act('R').stage('La deuxième caisse prend le relais à son tour ; les quatre personnages sont libres de rejoindre le dépôt.');
 a.go(12,12,'warrior');a.go(17,13,'merchant');
 a.go(16,5,'thief').act('LDDL').stage('Le Voleur extrait la dernière caisse de son cul-de-sac, puis libère l’accès et la visée.');
 a.go(13,5,'wizard').act('R').stage('La caisse remplace le Magicien sur le dernier bouton, mais le Magicien se retrouve dans l’alcôve.');
 a.go(15,5,'thief');
 a.select('wizard').act('L').stage('Le Voleur intercepte la visée de retour avant la caisse : le dernier poids reste en place.');
 a.go(15,1,'wizard');a.go(11,1,'warrior');a.go(17,1,'merchant');a.go(13,1,'thief').stage('Le groupe quitte le dépôt ; les trois caisses gardent les trois commandes.');
 return a;}
export const source={label:'Adaptation · Heroes and Light · énigme 8',url:'https://sinkingstarwalkthrough.com/fr/heroes-and-light-solutions/#%C3%A9nigme-8',puzzle:8,objective:'Conserver une première cible utile dans la visée du Magicien et relever deux postes avant le départ collectif.',secondaryUrl:'https://sinkingstarwalkthrough.com/fr/heroes-and-light-solutions/#%C3%A9nigme-2',secondaryLabel:'Énigme 2 · maintenir une commande à distance avec des charges'};
export const adaptation={kind:'adaptation',preserved:['Dans un couloir, un pas du Magicien peut devenir un échange involontaire avec une cible plus loin.','Une pièce conservée ou interposée sur le rayon permet de sortir sans reprendre la cible distante.','Les commandes qui doivent rester occupées se préparent depuis un autre secteur avec des charges.'],changed:['Les faisceaux colorés et les blocs à effacer de la source sont remplacés par des alcôves et une double serrure visible.','Le Guerrier ramène une file de deux caisses ; le Voleur la sépare pour les deux postes de relève.','Le Magicien échange d’abord des poids puis un partenaire, sans ouvrir momentanément les boutons.','Le dernier intercepteur est le Voleur : il libère le Magicien de l’alcôve tout en conservant la troisième caisse sur son bouton.','Carte originale entièrement sèche, sans miroirs ni monstres, centrée sur le transport et les cibles de la magie.'],sourceReading:'Light 8 motive la conservation d’un obstacle ou d’une cible proche pour contrôler une visée imposée ; Light 2 motive la relève distante d’une commande. Les trois caisses finies et la double serrure constituent un problème original pour quatre héros.',localChecks:[]};
if(process.argv[1]===fileURLToPath(import.meta.url))build().save(new URL('../level5-design.json',import.meta.url),source,adaptation);
