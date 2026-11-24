import {Author,board} from './author.mjs';

// A loading yard feeds a narrow outside road around a sealed inner garden.
const b=board(20,20);
b.fill(6,3,14,6);b.fill(16,3,18,5);b.put(15,4,'.');
b.fill(14,7,17,16);b.fill(2,13,17,16);b.fill(2,4,4,16);
b.fill(7,8,11,11);b.fill(13,9,14,9);b.fill(13,8,13,11);b.put(12,10,'.');b.put(14,8,'#');b.put(14,10,'#');b.put(3,10,'#');
for(const[x,y,c]of [[16,14,'M'],[7,4,'T'],[17,4,'B'],[7,3,'o'],[11,11,'o'],[7,8,'g'],[9,8,'g'],[7,11,'g']])b.put(x,y,c);
const spec={id:'ss20-02',title:'Le chargement à rebours',rows:b.strings(),
 circuits:[
  {id:'loading',buttons:[{x:7,y:5}],color:11},
  {id:'outside',buttons:[{x:3,y:5}],color:15},
  {id:'inside',buttons:[{x:11,y:9}],color:12}
 ],gates:[
  {at:{x:15,y:4},circuit:'loading',direction:'E',closedWhen:'released'},
  {at:{x:14,y:9},circuit:'outside',direction:'E',closedWhen:'released'},
  {at:{x:14,y:11},circuit:'outside',direction:'E',closedWhen:'released'},
  {at:{x:12,y:10},circuit:'inside',direction:'E',closedWhen:'released'}
 ]};
const a=new Author(spec);
a.select('thief').act('DDR').stage('La caisse extraite du mur devient le poids provisoire qui libère le Barde.');
a.go(17,11,'bard');a.go(6,5,'merchant');a.go(15,7,'thief');
a.select('merchant').act('RRRRRRR');
a.go(14,4,'merchant').act('DD').stage('La caisse contourne le premier angle ; le mur interdit de la pousser vers l’est.');
a.select('thief').act('RR').go(16,8).act('DDR').stage('Deux tractions perpendiculaires préparent la descente sur la route extérieure.');
a.go(16,8,'merchant').act('DDDDD').go(17,14).act('LLLLLLLLLLLLL').go(3,15).act('UUU').stage('Le pilier du couloir ouest impose un nouveau changement de côté.');
a.go(2,11).act('R').go(4,12).act('UU');
a.go(3,9,'thief').act('L').go(3,8).act('UUUU').stage('Le Voleur remonte la charge derrière lui jusque sur la commande violette.');
a.go(13,8,'merchant');
a.go(15,11,'bard').act('LLUU').stage('Depuis la coursive, deux pas du Barde alignent la caisse intérieure sur le bouton orange.');
a.go(12,10,'thief');a.select('merchant').act('D').stage('Le Marchand engage le Barde dans le passage sans faire chanter la caisse.');
a.select('thief').act('LLLLL').stage('Depuis le jardin, le Voleur prend le relais et tire le Barde à distance du poids.');
a.select('bard').act('UUR');a.go(7,8,'thief');a.go(7,11,'merchant').stage('Les trois destinations sont occupées ; les deux poids utiles restent en place.');
a.save(new URL('../level2-design.json',import.meta.url),{
 label:'Adaptation · Heroes of Hauling · énigmes 5, 7 et 17',
 url:'https://sinkingstarwalkthrough.com/fr/heroes-of-hauling-solutions/#%C3%A9nigme-7',puzzle:7,
 objective:'Faire changer la caisse de côté et de fonction, puis faire entrer le Barde dans le jardin sans déplacer le poids intérieur.',
 secondary:{label:'Heroes 3: Bard, Druid · énigme 14 · passage imposé au Barde',url:'https://sinkingstarwalkthrough.com/fr/heroes-3-bard-druid-solutions/#%C3%A9nigme-14'}
},{kind:'adaptation',preserved:[
 'Une traction exige de changer de côté au cours du transport (Heroes 1, 5).',
 'Une caisse rejoint une commande éloignée en contournant un grand obstacle (Heroes 1, 7).',
 'Un poids provisoire donne accès à un héros, puis est réemployé pour maintenir l’entrée d’un jardin (Heroes 1, 17).',
 'Un partenaire transporte le Barde après la mise en place d’un poids par chant (Heroes 3, 14).'
],changed:[
 'Le plateau impose un détour asymétrique avec deux angles où le Marchand ne peut pas se placer derrière la caisse.',
 'Le trio remplace les échanges magiques par une poussée simple, une traction arrière simple et le chant carré.',
 'La première caisse libère d’abord le Barde, puis tient les deux portes de la coursive ; la seconde, intérieure, est placée par chant à travers la cloison.',
 'Marchand et Voleur se relaient pour faire entrer le Barde sans activer sa capacité.',
 'Ce niveau est entièrement terrestre et ne comporte ni monstre ni miroir : la difficulté vient des accès et des changements de côté.'
],sourceReading:'Reprise des principes logistiques décrits dans les énigmes numérotées ; terrain, circuits et parcours recomposés pour SS20.'});
