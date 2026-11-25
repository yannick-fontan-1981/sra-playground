import {Author,board} from './author.mjs';
import {fileURLToPath} from 'node:url';
const b=board(20,20);
// The outer service passage and inner courtyard are separated by a sealed optical rectangle.
b.fill(2,2,18,2);b.fill(17,2,18,17);b.fill(2,16,18,17);b.fill(2,2,3,17);
b.fill(8,1,10,1);b.fill(9,3,9,4);
b.fill(6,5,13,5);b.fill(6,5,6,12);b.fill(13,5,13,12);b.fill(6,12,13,12);
b.fill(8,7,11,10);b.put(12,9);b.fill(10,11,10,16);
b.fill(14,9,17,9);b.put(17,14,'M');b.put(17,9,'W');b.put(16,9,'T');b.put(15,9,'o');b.put(9,5,'Z');
for(const [x,y] of [[8,7],[11,7],[8,10],[11,10]])b.put(x,y,'g');
export const spec={id:'ss21-04',title:'Le rectangle sans issue',mode:'quartet',rows:b.strings(),
 circuits:[{id:'injection',buttons:[{x:17,y:14}],color:10},{id:'trappe',buttons:[{x:10,y:9}],color:15},{id:'cour',buttons:[{x:6,y:2}],color:9}],
 gates:[{at:{x:14,y:9},circuit:'injection',direction:'W',closedWhen:'released'},{at:{x:9,y:3},circuit:'trappe',direction:'N',closedWhen:'released'},{at:{x:10,y:14},circuit:'cour',direction:'S',closedWhen:'released'}],
 mirrors:[{at:{x:6,y:5},facing:'SE'},{at:{x:13,y:5},facing:'SW'},{at:{x:13,y:12},facing:'NW'},{at:{x:6,y:12},facing:'NE'}]};
export function build(){const a=new Author(spec);
 a.select('warrior').act('L').stage('Le Guerrier charge la presse avec la caisse en avançant aussi le Voleur.');
 a.go(18,8,'warrior');
 a.select('merchant').act('U').stage('Le Marchand relâche la commande : la presse injecte une cible dans le rectangle optique.');
 a.select('wizard').act('R').stage('La cible interrompt la boucle ; la visée déviée échange le Magicien et la caisse.');
 a.act('LLL').stage('Depuis la cour intérieure, le Magicien ouvre la trappe haute.');
 a.go(9,4,'thief').act('UUU').go(8,1).stage('Le Voleur extrait la même caisse de l’anneau sans libérer la commande intérieure.');
 a.go(10,2,'merchant').act('LLL').stage('Le Marchand gare la caisse sur la commande de la cour ; l’entrée basse est ouverte.');
 a.go(11,7,'wizard');
 a.go(8,7,'warrior');a.go(8,10,'merchant');a.go(11,10,'thief').stage('Les quatre héros rejoignent la cour ; la caisse maintient l’unique accès.');
 return a;}
export const source={label:'Adaptation · Heroes and Mirrors · énigme 34',url:'https://sinkingstarwalkthrough.com/fr/heroes-and-mirrors-solutions/#%C3%A9nigme-34',puzzle:34,objective:'Interrompre une visée en boucle avec une cible transportée, puis récupérer cette cible pour libérer les quatre héros.',secondaryUrl:'https://sinkingstarwalkthrough.com/fr/heroes-and-mirrors-solutions/#%C3%A9nigme-30',secondaryLabel:'Énigme 30 · échange autour d’un angle'};
export const adaptation={kind:'adaptation',preserved:['Un rectangle de miroirs ramène la visée à son origine et interdit le pas horizontal du Magicien.','Le placement d’une cible transforme la visée déviée et donne accès à un autre secteur.','Le travail sur l’optique doit préparer la sortie de l’ensemble du groupe.'],changed:['Les quatre miroirs ordinaires ne sont ni échangés ni cassés : une presse latérale injecte l’unique caisse dans le rayon.','Le Guerrier charge une file de deux occupants, le Marchand commande l’injection, le Magicien ouvre la trappe de récupération et le Voleur extrait la caisse.','La même caisse sert d’abord de cible de secours puis de poids permanent pour l’entrée de la cour.','Carte originale à passage périphérique et cour intérieure, quatre destinations, aucune eau ni poursuite de monstre.'],sourceReading:'L’énigme 34 fournit le rectangle de visée bouclée ; l’énigme 30 fournit l’échange coudé d’une caisse. La récupération par trappe et le relais à quatre sont propres à SS21.',localChecks:[]};
if(process.argv[1]===fileURLToPath(import.meta.url))build().save(new URL('../level4-design.json',import.meta.url),source,adaptation);
