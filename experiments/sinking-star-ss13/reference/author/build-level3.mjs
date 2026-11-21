import {Author,board} from './author.mjs';

// The isolated cell is visible along the water, but cannot be reached on foot.
// Its resident also keeps the only physical north passage open.
const b=board(19,19);
b.fill(1,10,17,17);
b.fill(3,4,3,9,'~');b.put(3,3,'T');
b.fill(13,8,13,9);
b.fill(12,4,17,7);b.fill(8,6,11,6);
b.fill(15,2,17,3);b.put(15,4,'#');b.put(17,4,'#');
b.put(5,10,'#');b.put(5,11,'#');b.put(5,12,'#');
b.put(9,14,'#');b.put(9,15,'#');b.put(9,16,'#');
b.put(3,12,'Z');b.put(8,13,'o');b.put(8,6,'o');
b.put(16,3,'g');b.put(17,3,'g');
const spec={
 id:'ss13-03',title:'La cellule et les trois relèves',rows:b.strings(),
 circuits:[
  {id:'anchor',buttons:[{x:3,y:3}],color:9},
  {id:'extraction',buttons:[{x:15,y:6}],color:14},
  {id:'exit',buttons:[{x:13,y:5}],color:11},
 ],
 gates:[
  {at:{x:13,y:8},circuit:'anchor',direction:'S',closedWhen:'released'},
  {at:{x:10,y:6},circuit:'extraction',direction:'W',closedWhen:'released'},
  {at:{x:16,y:4},circuit:'exit',direction:'S',closedWhen:'released'},
 ],
};
const a=new Author(spec);
a.select('wizard').act('U').stage('Le Magicien relève le Voleur dans la cellule et maintient le passage nord.');
a.go(7,13,'thief').act('LLLL');
a.go(4,12).act('U');
a.go(3,12).act('L').stage('Le Voleur place une caisse dans la ligne de retour, hors de la cellule.');
a.select('wizard').act('D').stage('La caisse remplace le prisonnier sur le bouton ; les deux héros sont libres.');
a.go(15,6,'wizard').stage('Le Magicien maintient la porte de l’alcôve pendant l’extraction.');
a.go(9,6,'thief').act('RRRRR');
a.go(13,5).act('U').stage('La seconde caisse maintient la commande finale ; le Voleur la quitte par le côté.');
a.go(17,3,'wizard');
a.go(16,3,'thief').stage('Les deux héros occupent les deux destinations.');
a.save(new URL('../level3-design.json',import.meta.url),{
 label:'Adaptation de Heroes of Hauling · énigmes 13 et 19',
 url:'https://sinkingstarwalkthrough.com/fr/heroes-of-hauling-solutions/#%C3%A9nigme-19',puzzle:19,
 secondaryLabel:'Heroes of Hauling · énigme 13 · relève sur un bouton',
 secondaryUrl:'https://sinkingstarwalkthrough.com/fr/heroes-of-hauling-solutions/#%C3%A9nigme-13',
 objective:'Libérer le Voleur sans relâcher la commande, substituer une caisse au Magicien enfermé, puis coopérer pour extraire le poids de la dernière porte.',
},{
 kind:'adaptation',
 preserved:['Un échange transfère le partenaire en laissant la commande occupée.','Une caisse prend ensuite la place du héros enfermé.'],
 changed:['Deux héros et deux destinations ; la cellule visible au-delà de l’eau remplace les barreaux.','Le Voleur prépare les deux cargaisons par traction. Une deuxième alcôve exige une extraction pendant que le Magicien tient une porte.'],
 sourceReading:'Heroes of Hauling 13 présente la relève du partenaire sur une commande ; l’énigme 19 libère les héros enfermés et laisse des cristaux à leur place. SS13 combine ces contraintes dans une carte originale.',
 requiredInWitness:['partner-swap','stone-swap','thief-pull','button-relay','two-destinations'],
});
