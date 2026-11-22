import {Author,board} from './author.mjs';
import {stepDetailed,contains} from '../../dist/core.js';

// A small sorting chamber feeds three large, separate alcoves.
// There are no buttons or exit doors: the movable cargo is the obstruction.
const b=board(20,20);
b.fill(5,9,7,11); b.fill(3,10,4,10);b.put(4,11);
b.put(5,8);b.put(5,12);
b.fill(6,6,6,8);b.fill(5,2,7,5);b.put(6,2,'g');
b.fill(8,10,13,10);b.fill(14,9,17,11);b.put(17,10,'g');
b.fill(6,12,6,14);b.fill(5,15,8,17);b.put(6,17,'g');
b.put(6,8,'o');b.put(8,10,'o');b.put(6,12,'o');
b.put(5,9,'M');b.put(5,11,'Z');b.put(6,10,'B');
const spec={id:'ss18-01',title:'Les trois pièces du chœur',rows:b.strings()};
const a=new Author(spec);
a.select('bard').act('LLL').stage('Les trois cargaisons quittent ensemble leurs accès ; les butées retiennent les pièces du haut et du bas.');
a.go(6,10,'wizard').act('LL').stage('Le Magicien reprend la pièce centrale puis échange avec le Barde : il accepte de rester dans le renfoncement.');
a.go(6,11,'merchant').act('U');
a.go(7,9).act('L').stage('Deux poussées isolées rangent la pièce centrale sous celle du haut, sans remuer les autres.');
a.go(4,10);
const counterCommands=a.commands+'CCR';
const counter=stepDetailed(a.world,{...a.state,active:2},4);
if(counter.state.failed||!contains(counter.state.stones,{x:6,y:8})||!contains(counter.state.stones,{x:6,y:12}))throw Error('A voluntary Bard departure must refill the two vertical accesses.');
const forced=stepDetailed(a.world,a.state,4);
if(!forced.phases.some(p=>p.kind==='push'&&p.moves.some(m=>m.actor==='hero'&&m.from.x===5&&m.from.y===10))||forced.phases.some(p=>p.kind==='song'))throw Error('Merchant extraction must move the Bard without a song.');
a.act('R').stage('Le Marchand pousse le Barde hors du renfoncement ; un pas volontaire aurait replacé deux caisses dans les accès.');
a.go(6,2).stage('Le Marchand se gare au nord avant le dernier réarrangement collectif.');
a.select('bard').act('DD').go(6,17).stage('Deux pas de chant rangent les trois caisses dans la colonne latérale ; sa butée laisse le Barde descendre seul vers le sud.');
a.select('wizard').act('R').go(17,10).stage('La caisse qui ferme encore le renfoncement devient la cible de sortie du Magicien ; il rejoint l’alcôve est.');
const source={
 label:'Adaptation · Heroes 3: Bard, Druid · énigme 12',
 url:'https://sinkingstarwalkthrough.com/fr/heroes-3-bard-druid-solutions/#%C3%A9nigme-12',
 puzzle:12,
 objective:'Trier trois pièces qui répondent au même chant, utiliser les butées pour les séparer, puis libérer le Barde et le Magicien sans reboucher les trois accès.'
};
const adaptation={kind:'adaptation',
 preserved:['Le chant déplace plusieurs caisses qu’il faut réorganiser pour dégager le chemin.'],
 changed:['Une chambre de tri compacte dessert trois alcôves orientées nord, est et sud.','Aucun bouton, aucune porte, aucun miroir et aucun pont : les caisses elles-mêmes ferment les passages.','Les butées filtrent le groupe ; le Marchand corrige une seule pièce, puis transporte le Barde sans chant.','Le Magicien prend temporairement la place du Barde dans un renfoncement et s’en libère par un dernier échange.','Le chant couvre un carré 5×5 et peut déplacer les partenaires, conformément au contrat de la série SS.'],
 sourceReading:'Bard12 fournit le réarrangement collectif de trois cristaux. Les alcôves, les butées, les échanges et les trois destinations sont originaux ; cette adaptation ne reprend pas la transformation du Druide ni une carte commerciale.',
 localChecks:[{name:'Sortie volontaire du Barde avant son extraction',commands:counterCommands,observed:'Le pas vers l’est est légal, mais le chant ramène une caisse dans chaque accès vertical. La poussée du Marchand conserve au contraire leur dégagement.',scope:'Contre-branche locale rejouée ; elle n’interdit pas de réorganiser ensuite autrement.'}]
};
a.save(new URL('../level1-design.json',import.meta.url),source,adaptation);
