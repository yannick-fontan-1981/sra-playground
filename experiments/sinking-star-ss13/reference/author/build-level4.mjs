import {Author,board} from './author.mjs';
import {circuitPressed,stepDetailed} from '../../dist/core.js';

const b=board(20,19,'~');
// The Thief's two approaches meet at one temporary water platform.
// Walking away from either end of a pull keeps the mirror attached.
b.fill(3,8,3,11);b.fill(3,10,7,10);b.put(4,10,'~');
b.put(3,8,'2');b.put(3,9,'T');b.put(5,11,'g');
// Three separated islands supply the Wizard with successive exchange anchors.
b.fill(13,1,15,3);b.put(14,2,'Z');
b.fill(12,6,16,9);b.put(14,8,'o');
b.fill(7,5,10,9);b.put(9,6,'o');
b.fill(6,13,10,16);b.put(7,14,'o');
b.fill(8,13,8,15,'#');
b.fill(11,15,13,15);b.fill(14,13,17,17);b.put(16,14,'g');
const spec={
 id:'ss13-04',title:'Le miroir reste à quai',rows:b.strings(),
 circuits:[
  {id:'return-anchor',buttons:[{x:14,y:2}],color:15},
  {id:'mirror-mooring',buttons:[{x:5,y:10}],color:9},
 ],
 gates:[{at:{x:11,y:15},circuit:'mirror-mooring',direction:'W',closedWhen:'released'}],
 platforms:[{at:{x:4,y:10},circuit:'return-anchor',activeWhen:'pressed'}],
};
const a=new Author(spec);
a.select('wizard').act('D').stage('La première caisse relève le Magicien sur la commande de la plateforme.');
a.select('thief').act('DDX').stage('Le reflet donne accès à l’autre côté du miroir, sur la plateforme tenue à distance.');
a.act('RR').stage('Le Voleur tire le miroir sur sa commande ; le passage final du Magicien s’ouvre.');
const walkingDeparture=stepDetailed(a.world,a.state,4);
if(!circuitPressed(a.world,a.state,'mirror-mooring')||walkingDeparture.state.failed||walkingDeparture.state.dead||circuitPressed(a.world,walkingDeparture.state,'mirror-mooring')||!walkingDeparture.phases.some(p=>p.kind==='pull'&&p.moves.some(m=>m.actor==='mirror')))throw Error('The walking departure must remove the mirror from its command by pulling.');
a.go(14,6,'wizard').act('L');
a.go(7,6).act('D').stage('Le Magicien utilise les deux ancres suivantes sans retirer la caisse de la commande initiale.');
a.go(16,14).stage('Le Magicien franchit la porte maintenue par le miroir.');
a.select('thief');
const reflectedDeparture=stepDetailed(a.world,a.state,5);
if(reflectedDeparture.state.failed||reflectedDeparture.state.dead||!circuitPressed(a.world,reflectedDeparture.state,'mirror-mooring')||!reflectedDeparture.phases.some(p=>p.kind==='reflect'&&p.moves.some(m=>m.actor==='hero'))||reflectedDeparture.phases.some(p=>p.moves.some(m=>m.actor==='mirror')))throw Error('The reflected departure must preserve the mirror command.');
a.act('X').stage('Le Voleur quitte le quai par reflet, laissant le miroir sur son bouton.');
a.save(new URL('../level4-design.json',import.meta.url),{
 label:'Adaptation de Heroes and Mirrors · énigmes 4 et 5',
 url:'https://sinkingstarwalkthrough.com/fr/heroes-and-mirrors-solutions/#%C3%A9nigme-5',puzzle:5,
 secondaryLabel:'Heroes and Mirrors · énigme 4 · changer de côté par reflet',
 secondaryUrl:'https://sinkingstarwalkthrough.com/fr/heroes-and-mirrors-solutions/#%C3%A9nigme-4',
 objective:'Faire relayer la commande par une caisse, changer le côté de traction du miroir, puis se refléter pour le laisser maintenir la sortie du partenaire.',
},{
 kind:'adaptation',
 preserved:['Le Voleur change de côté par reflet.','Le miroir est tiré jusqu’à une commande et le Voleur s’éloigne sans pas volontaire afin de conserver le poids.'],
 changed:['Une plateforme commandée à distance et trois ancres d’échange ajoutent le Magicien au problème.','Le duo s’ouvre mutuellement ses passages ; un seul miroir mobile suffit dans cette géométrie.'],
 sourceReading:'Heroes and Mirrors 4 associe traction du miroir et reflet pour changer de côté. L’énigme 5 fait quitter au Voleur une commande par reflet afin de laisser le miroir dessus. SS13 reprend ces deux contraintes avec une géométrie et une coopération nouvelles.',
 localCounterfactual:'Après la pose du miroir sur son bouton, un pas volontaire vers l’est est valide, tire le miroir et referme la porte. Le parcours conserve cette commande en utilisant le reflet. Ce contrôle local ne prouve pas l’unicité globale.',
 requiredInWitness:['stone-swap','thief-pull','mirror-motion','hero-reflection','button-relay','two-destinations'],
});
