import {Author,board} from './author.mjs';
import {stepDetailed,circuitPressed} from '../../dist/core.js';

const b=board(20,20);
b.fill(3,4,16,15);
b.fill(6,8,10,11,'~');
b.put(7,10); b.put(8,10);
for(const [x,y] of [[14,10],[15,11],[14,12]])b.put(x,y,'#');
b.put(14,11,'M'); b.put(4,13,'Z'); b.put(13,6,'B'); b.put(11,6,'o');
b.fill(4,2,4,3);b.put(4,2,'g');
b.fill(17,7,18,7);b.put(18,7,'g');
b.fill(11,16,11,17);b.put(11,17,'g');
const spec={id:'ss18-02',title:'Le carrefour à contretemps',rows:b.strings(),
 mirrors:[{at:{x:8,y:7},facing:'SE'}],
 circuits:[
  {id:'cellule',buttons:[{x:8,y:10}],color:15},
  {id:'bascule',buttons:[{x:7,y:10}],color:10}
 ],
 gates:[
  {at:{x:13,y:11},circuit:'cellule',direction:'W',closedWhen:'released'},
  {at:{x:4,y:3},circuit:'bascule',direction:'N',closedWhen:'released'},
  {at:{x:16,y:7},circuit:'bascule',direction:'E',closedWhen:'released'},
  {at:{x:17,y:7},circuit:'bascule',direction:'E',closedWhen:'pressed'},
  {at:{x:11,y:16},circuit:'bascule',direction:'S',closedWhen:'released'}
 ]
};
const a=new Author(spec);
a.select('bard').act('DX').stage('Le chant charge la première visée ; son reflet ouvre la cellule du Marchand.');
a.go(15,5);
a.go(12,9,'merchant').act('X').stage('Le Marchand est sorti avant que la caisse ne quitte sa première commande.');
a.go(9,7).act('L');
a.go(12,7).act('L');
a.go(12,9).act('X').stage('Miroir et caisse sont décalés d’une case : le même reflet commande désormais les sorties à distance.');
if(!circuitPressed(a.world,a.state,'bascule'))throw Error('Remote toggle was not armed.');
a.go(4,2).stage('Le Marchand prend la branche nord pendant la phase ouverte.');
a.go(16,7,'wizard');
const forced=stepDetailed(a.world,a.state,5);
if(!forced.phases.some(p=>p.kind==='piston'&&p.moves.some(m=>m.actor==='hero'&&m.to.x===17&&m.to.y===7)))throw Error('The east vestibule must deliver its occupant when the phase changes.');
a.act('X').go(18,7).stage('Dans le sas est, le changement de phase referme une presse et ouvre l’autre : le Magicien est déposé au-delà.');
a.select('bard').act('X');
a.go(11,17).stage('La phase est rétablie pour la branche sud, tandis que les deux autres héros restent à leur destination.');
const source={
 label:'Adaptation · Heroes and Mirrors · énigme 16',
 url:'https://sinkingstarwalkthrough.com/fr/heroes-and-mirrors-solutions/#%C3%A9nigme-16',
 puzzle:16,
 objective:'Transformer un reflet en commande distante, puis choisir la bonne phase pour trois branches de sortie, dont un sas à deux presses de polarités opposées.',
 secondaryLabel:'Heroes and Light · énigme 2 · ouvertures de polarités opposées',
 secondaryUrl:'https://sinkingstarwalkthrough.com/fr/heroes-and-light-solutions/#%C3%A9nigme-2'
};
const adaptation={kind:'adaptation',
 preserved:['Un objet réfléchi active puis libère une commande à distance.','La même commande ouvre certains passages et en ferme d’autres.'],
 changed:['Le contrôleur sert d’abord à libérer le Marchand, puis doit être recalé sur une deuxième commande.','Trois destinations occupent les branches nord, est et sud d’une cour autour d’un bassin.','Le sas est utilise deux presses de polarités opposées et transporte son occupant pendant le changement de phase.','Le premier chargement se fait par le chant carré du Barde ; le Marchand déplace ensuite une seule pièce à la fois.'],
 sourceReading:'Mirrors16 fournit la bascule de bouton par reflet. Light2 fournit le conflit de polarité entre accès et sortie. La cellule initiale, les trois branches et le sas de transfert sont originaux ; aucune grille commerciale n’est reproduite.',
 localChecks:[{name:'Sas est occupé pendant la bascule',observed:'La fermeture de la première presse transporte le Magicien dans la seconde case, qui s’ouvre au même changement de circuit.',scope:'Transition concrète du témoin ; la route n’est pas annoncée optimale.'}]
};
a.save(new URL('../level2-design.json',import.meta.url),source,adaptation);
