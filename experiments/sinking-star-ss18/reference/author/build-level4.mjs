import {Author,board} from './author.mjs';
import {stepDetailed} from '../../dist/core.js';

// A circular preparation court and three separate departure arms.
const b=board(20,20);
b.fill(5,5,14,14);
b.fill(8,8,11,11,'~'); b.put(10,9,'M');
b.fill(9,2,9,4); b.put(9,2,'g');
b.fill(2,10,4,10); b.put(2,10,'g');
b.fill(15,11,17,11); b.put(17,11,'g');
b.put(10,6,'Z'); b.put(6,13,'B');
const spec={id:'ss18-04',title:'Personne ne part le premier',rows:b.strings(),
 mirrors:[
  {at:{x:10,y:5},facing:'NE'},
  {at:{x:5,y:11},facing:'NW'},
  {at:{x:14,y:12},facing:'NE'},
  {at:{x:10,y:12},facing:'NE'}
 ],
 circuits:[
  {id:'depart-ouest',buttons:[{x:12,y:5}],color:12},
  {id:'depart-est',buttons:[{x:5,y:7}],color:15},
  {id:'depart-nord',buttons:[{x:14,y:8}],color:6}
 ],
 gates:[
  {at:{x:3,y:10},circuit:'depart-ouest',direction:'W',closedWhen:'released'},
  {at:{x:16,y:11},circuit:'depart-est',direction:'E',closedWhen:'released'},
  {at:{x:9,y:3},circuit:'depart-nord',direction:'N',closedWhen:'released'}
 ]
};
const a=new Author(spec);
a.select('wizard').act('D').stage('Le Magicien prend la place du Marchand sur l’îlot : le pousseur peut préparer les trois postes.');
a.go(11,5,'merchant').act('L');
a.go(5,12).act('U');
a.go(14,13).act('U').stage('Les trois miroirs de départ sont alignés sur trois destinations séparées.');
a.go(7,13).act('X').stage('Le quatrième miroir ramène le Magicien depuis son îlot, sans reprendre le Marchand.');
a.go(5,7,'wizard');
a.go(12,5,'merchant');
a.go(14,9,'bard');
const earlyCommands=a.commands+'X';
if(!stepDetailed(a.world,a.state,5).state.failed)throw Error('The north departure must remain blocked before the third relay is occupied.');
a.act('U').stage('Chaque personnage maintient le passage d’un autre ; les trois commandes sont occupées.');
const final=stepDetailed(a.world,a.state,5);
if(!final.state.complete||final.phases[0]?.moves.filter(m=>m.actor==='hero').length!==3)throw Error('The final reflection must land all three heroes at once.');
a.act('X').stage('Un seul reflet transporte les trois héros vers les sorties nord, ouest et est.');
const source={
 label:'Adaptation · Heroes and Mirrors · énigme 17',
 url:'https://sinkingstarwalkthrough.com/fr/heroes-and-mirrors-solutions/#%C3%A9nigme-17',
 puzzle:17,
 objective:'Aligner trois départs croisés, récupérer l’occupant de l’îlot et déclencher le reflet collectif lorsque les trois passages sont maintenus.'
};
const adaptation={kind:'adaptation',
 preserved:['Chaque départ dépend de la présence d’un autre héros sur une commande.','La réflexion permet de quitter plusieurs commandes dans le même mouvement.'],
 changed:['Le cycle comporte trois héros et trois destinations placées dans des secteurs distincts.','Une cour annulaire permet de préparer les positions ; les trois miroirs sont initialement décalés.','Un quatrième miroir récupère l’occupant de l’îlot : le Magicien dans le parcours témoin, ou directement le Marchand dans une autre préparation légale.','Aucune caisse de réserve ne remplace durablement les trois héros sur les commandes.'],
 sourceReading:'L’énigme 17 fournit le départ simultané de deux partenaires. La cour, l’îlot central, les quatre miroirs et le cycle à trois sont une composition originale pour M/Z/B. Aucun plan commercial n’est transcrit.',
 localChecks:[{name:'Troisième commande encore libre',commands:earlyCommands,observed:'Le reflet est refusé : le passage nord manque et les autres transports sont annulés ensemble.',scope:'Contre-branche locale ; pas preuve d’unicité de la solution.'}]
};
a.save(new URL('../level4-design.json',import.meta.url),source,adaptation);
