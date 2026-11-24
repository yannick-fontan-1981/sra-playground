import {Author,board} from './author.mjs';
const b=board(20,20);
// Two offset quays are joined only by an optical U. Its central landing
// closes the left arm, preventing one actor from being claimed twice.
b.fill(2,3,7,8);b.put(2,4,'#');b.put(2,6,'#');b.put(2,5,'o');
b.put(2,8,'M');b.put(3,3,'T');b.put(6,4,'B');
b.put(5,8,'~');b.fill(5,9,5,11,'~');b.put(5,11);
b.fill(6,11,13,11,'~');b.put(7,11);b.put(8,11);b.put(13,11);
b.fill(13,6,13,10,'~');b.fill(12,4,17,7);b.put(16,5,'#');b.put(17,6,'#');
b.fill(13,1,17,2);b.put(13,1,'g');b.put(15,1,'g');b.put(17,1,'g');b.put(15,3,'~');
const spec={id:'ss20-04',title:'Les quais en décalage',rows:b.strings(),facing:'E',
 circuits:[{id:'escale',buttons:[{x:8,y:11}],color:10},{id:'livraison',buttons:[{x:16,y:6}],color:9}],
 gates:[{at:{x:7,y:11},circuit:'escale',direction:'W',closedWhen:'pressed'}],
 platforms:[{at:{x:5,y:8},circuit:'livraison',activeWhen:'released'},{at:{x:15,y:3},circuit:'livraison',activeWhen:'pressed'}],
 mirrors:[{at:{x:5,y:11},facing:'NE'},{at:{x:13,y:11},facing:'NW'}]};
const a=new Author(spec);
a.go(5,8,'bard').act('XX').go(14,4).stage('Envoyer le Barde comme réceptionnaire : l’escale ferme le bras gauche, puis le second miroir dessert le quai droit.');
a.go(3,5,'thief').act('RR').go(3,3).stage('Tirer la caisse hors de son renfoncement avant de la descendre au départ.');
a.go(4,4,'merchant').act('DDD').go(3,8).act('R').go(3,7).stage('Présenter la caisse seule sur le quai de départ ; les autres acteurs quittent la colonne.');
a.act('XX').select('bard').act('R').stage('Écarter la caisse du débarcadère par un chant latéral, sans encore activer le bouton de livraison.');
a.go(5,8,'merchant').act('XX').go(12,4).stage('Faire passer le Marchand pendant que le départ reste soutenu.');
a.go(5,8,'thief').act('XX').go(12,7).stage('Le Voleur quitte le dernier quai : la passerelle de départ peut maintenant disparaître.');
a.go(13,6,'merchant').act('RR').go(13,7).stage('Livrer la caisse seulement après le dernier passage ; le bouton déploie la passerelle des sorties.');
a.go(15,1,'bard');a.go(13,1,'merchant');a.go(17,1,'thief').stage('Réunir les trois personnages sur les quais d’arrivée.');
a.save(new URL('../level4-design.json',import.meta.url),{
 label:'Adaptation de Héros et Miroirs — énigmes 22–23',url:'https://sinkingstarwalkthrough.com/fr/heroes-and-mirrors-solutions/',puzzle:'22–23',
 objective:'Préparer un départ latéral par deux miroirs et préserver l’accès pour les transports suivants.'
},{kind:'adaptation',preserved:['Un montage de deux miroirs transforme la position de départ en un débarquement décalé.','Le départ d’un personnage ou d’une charge peut gêner les trajets suivants.','La réception et la libération du débarcadère se préparent avant le dernier voyage.'],changed:['Les reflets SS20 restent atomiques et ne dupliquent aucun acteur : une escale-bouton masque visiblement le premier miroir pendant le second trajet.','Le Marchand et le Voleur chargent une caisse finie ; le Barde la décale depuis la rive de réception.','La livraison retire le quai de départ et déploie celui des sorties : elle doit attendre le dernier passager.','Aucune plante, fusion ou création de cristal de l’original n’est reprise.'],sourceReading:'Les énigmes 22–23 motivent le U optique et l’ordre des départs ; l’escale-poussoir et la livraison à polarités opposées sont une adaptation propre aux règles M/T/B.',localChecks:[]});
