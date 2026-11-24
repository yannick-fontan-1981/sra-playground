import {Author,board} from './author.mjs';
const b=board(20,20);
// A finite optical latch occupies isolated, readable islets above the workshop.
b.fill(2,9,8,14);b.put(3,10,'#');b.put(4,9,'#');b.put(4,11,'#');
b.fill(7,4,7,7,'~');b.put(7,4);b.put(7,6);b.put(7,7);
b.fill(8,7,14,7,'~');b.put(8,7);b.put(10,7,'o');b.put(11,7,'o');b.put(14,7);
b.fill(14,4,14,6,'~');b.put(14,4);b.put(8,8);
b.put(4,10,'o');b.put(7,12,'M');b.put(5,11,'T');b.put(2,14,'B');
b.fill(8,12,16,12);b.fill(16,13,16,15,'~');b.fill(13,16,18,17);
b.put(13,18,'g');b.put(15,18,'g');b.put(17,18,'g');
const spec={id:'ss20-03',title:'Le poids qui reste',rows:b.strings(),facing:'N',
 circuits:[{id:'vert',buttons:[{x:7,y:4}],color:14},{id:'violet',buttons:[{x:14,y:4}],color:15}],
 gates:[{at:{x:8,y:8},circuit:'vert',direction:'N',closedWhen:'pressed'}],
 platforms:[{at:{x:16,y:13},circuit:'vert',activeWhen:'pressed'},{at:{x:16,y:14},circuit:'violet',activeWhen:'released'},{at:{x:16,y:15},circuit:'vert',activeWhen:'pressed'}],
 mirrors:[{at:{x:7,y:7},facing:'NE'},{at:{x:14,y:7},facing:'NW'}]};
const a=new Author(spec);
a.go(5,10,'thief').act('RRR').go(6,12).stage('Extraire la caisse de la niche : aucun accès derrière elle.');
a.go(6,10,'merchant').act('R').go(8,11).act('UU').go(7,12).stage('Charger la presse ouverte avant d’allumer le vert.');
a.act('X').stage('Le premier reflet allume les deux boutons ; la presse installe l’écran près du miroir gauche.');
a.act('X').stage('Le second reflet éteint le violet ; la caisse-écran prend le reflet et le poids vert reste en place.');
a.go(13,18,'merchant');a.go(15,18,'thief');a.go(17,18,'bard').stage('Traverser le chemin vert–violet inversé–vert et réunir les trois sorties.');
a.save(new URL('../level3-design.json',import.meta.url),{
 label:'Adaptation de Héros et Miroirs — énigme 20',url:'https://sinkingstarwalkthrough.com/fr/heroes-and-mirrors-solutions/',puzzle:'20',
 objective:'Stabiliser un premier bouton tout en laissant le second alterner à chaque reflet.'
},{kind:'adaptation',preserved:['Un premier appui doit rester actif après sa mise en place.','Un obstacle plus proche du miroir soustrait le poids éloigné aux reflets suivants.','Le second circuit conserve une alternance indépendante.'],changed:['Aucune duplication : trois caisses finies sont présentes dès le départ.','Une seule porte-poussoir visible installe l’écran, après son chargement manuel par tirage puis poussée.','Les deux états commandent un chemin de trois passerelles, avec polarité inversée au milieu.'],sourceReading:'Le principe de mémoire optique vient de l’énigme 20 ; la presse, les quais isolés et le chargement Marchand/Voleur sont propres à SS20.',localChecks:[]});
