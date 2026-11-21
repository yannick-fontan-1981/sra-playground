import {Author,board} from './author.mjs';
import {replay} from '../../scripts/solver.mjs';
import {circuitPressed} from '../../dist/core.js';
const b=board(20,20,'~');
b.fill(1,6,8,17);b.fill(10,6,18,17);b.fill(11,1,18,4);b.fill(4,4,7,4);b.put(4,5);b.put(7,5);b.put(5,5,'#');b.put(9,7,'#');b.put(14,6,'~');
b.put(5,7,'T');b.put(7,14,'B');b.put(9,16,'s');b.put(11,2,'g');b.put(17,2,'g');
const spec={id:'ss14-03',title:'L’appui sous le partenaire',rows:b.strings(),
 mirrors:[{at:{x:6,y:8},facing:'NE'}],
 circuits:[{id:'haut-quai',buttons:[{x:14,y:9}],color:11}],
 platforms:[{at:{x:14,y:5},circuit:'haut-quai',activeWhen:'pressed'}]};
const a=new Author(spec);
a.select('bard').act('UUUUUUUUUU').stage('L’appui remonte le canal ; la butée le retient pendant que le Barde corrige sa distance');
a.go(9,8,'thief').stage('Le Voleur se pose sur l’appui : il devient son ancre pendant le retour du chanteur');
a.select('bard').act('LLLDDDDDRRRRURR').stage('Le Barde avance vers l’appui ancré puis entraîne son partenaire sur la rive opposée');
a.go(14,12,'bard').stage('Le chanteur dégage la traversée pour permettre le retour du Voleur');
a.go(7,8,'thief').act('RRRRRRRR').stage('Le Voleur transporte le miroir à travers l’appui désormais placé');
a.act('DLDR').stage('Le miroir est descendu sur la commande du haut quai sans changer son orientation');
a.go(18,9).act('XU').go(11,2).stage('Le Voleur prend le premier reflet et libère l’arrivée hydraulique');
a.go(18,9,'bard').act('XU').go(17,2).stage('Le Barde emprunte le même reflet sans chanter pendant le transport');
function checkLocal(turn,alternative,expected,effect){
 const r=replay(spec,a.commands.slice(0,turn)+alternative);
 const observed={refusals:r.metrics.blocked,dead:r.state.dead,mirrors:r.state.mirrors.length,supports:r.state.supports,platformActive:r.state.platformActive??[],...Object.fromEntries(a.world.circuits.map(c=>[c.id,circuitPressed(a.world,r.state,c.id)]))};
 for(const [key,value]of Object.entries(expected))if(JSON.stringify(observed[key])!==JSON.stringify(value))throw Error(`Local check changed at ${turn} + ${alternative}: ${key}`);
 return{turn,alternative,effect,observed};
}
const localChecks=[
 checkLocal(11,"DDD",{"supports": [{"x": 9, "y": 9}], "refusals": 0},"Sans l’ancrage préparé, un retour direct du Barde vers le bas décale l’appui hors du passage."),
 checkLocal(18,"CDDD",{"refusals": 1, "dead": false, "supports": [{"x": 9, "y": 8}]},"Après l’ancrage, le même retour direct est refusé car le chant enverrait le Voleur sur de l’eau sans appui ; le détour conserve les deux positions.")
];
a.save(new URL('../level3-design.json',import.meta.url),{
 puzzle:27,label:'Adaptation de Heroes and Water · énigme 27 · appui mobile et butée',
 url:'https://sinkingstarwalkthrough.com/fr/heroes-and-water-solutions/#%C3%A9nigme-27',
 secondaryLabel:'Heroes and Water · énigme 28 · préserver l’appui pendant le passage',
 secondaryUrl:'https://sinkingstarwalkthrough.com/fr/heroes-and-water-solutions/#%C3%A9nigme-28',
 objective:'Ramener le quai mobile, conserver son emplacement pendant le relais et transporter le miroir jusqu’à la commande du haut quai.'
},{kind:'adaptation',preserved:['Un appui immergé est guidé dans un canal et retenu par une butée pour corriger le placement du Barde.','Le passage dépend de la conservation de cet appui pendant le déplacement du chanteur.'],changed:['Le Voleur ancre l’appui sous ses pieds avant que le Barde revienne dans sa portée.','Le chant entraîne ensuite le partenaire sans déclencher sa traction.','Le miroir mobile franchit le quai, devient un poids et permet deux reflets vers une arrivée hydraulique inaccessible à pied.'],sourceReading:'Water 27 inspire le guidage de l’appui et les butées ; Water 28 inspire la conservation de l’appui pendant le transfert du Barde. L’ancrage sous les héros, le chant carré et le miroir-poids sont les règles et la composition propres à SS14.',localChecks,checkScope:'Comparaisons locales du parcours auteur ; aucune preuve d’optimalité ou d’unicité globale.'});
