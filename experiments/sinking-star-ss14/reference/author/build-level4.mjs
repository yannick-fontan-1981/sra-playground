import {Author,board} from './author.mjs';
import {replay} from '../../scripts/solver.mjs';
import {circuitPressed} from '../../dist/core.js';
const b=board(20,20,'~');
b.fill(2,10,8,18);b.put(7,12,'#');b.put(9,17);b.put(9,18);
b.fill(10,2,18,13);b.fill(2,2,7,5);b.put(7,6);b.fill(7,7,9,7);
b.put(3,12,'T');b.put(15,2,'B');b.put(17,2,'o');b.put(2,3,'g');b.put(6,3,'g');
const spec={id:'ss14-04',title:'Les deux départs sans geste',rows:b.strings(),
 mirrors:[{at:{x:3,y:11},facing:'NE'},{at:{x:12,y:7},facing:'SW'}],
 circuits:[{id:'accord',buttons:[{x:8,y:13},{x:14,y:10}],color:11}],
 platforms:[{at:{x:9,y:13},circuit:'accord',activeWhen:'pressed'}],
 gates:[{at:{x:7,y:6},circuit:'accord',direction:'N',closedWhen:'released'}]};
const a=new Author(spec);
a.select('bard').act('DDDDDDDDLLL').stage('Le Barde cale la caisse sur sa commande et reste à portée de ce poids');
a.select('thief').act('DDDDDD').go(4,17).act('RRRRR').stage('Le Voleur change l’axe du miroir dans la cour inférieure');
a.go(8,16).act('UUUU').stage('Le miroir devient le second poids ; le Voleur ne peut quitter son poste à pied sans le retirer');
a.act('X').stage('Les deux départs simultanés conservent la caisse et le miroir sur leurs boutons');
a.go(10,11,'bard').act('R').stage('Le Barde revient au quai et entraîne le Voleur hors de l’appui sans retirer le miroir-poids');
a.go(16,12,'thief').stage('Le Voleur dégage la portée du chanteur avant son retour vers la rive haute');
a.go(2,3,'bard').stage('Le Barde rejoint sa destination après son départ sans chant');
a.go(12,10,'thief').act('X').go(6,3).stage('Le Voleur emprunte le second miroir pour rejoindre son partenaire');
function checkLocal(turn,alternative,expected,effect){
 const r=replay(spec,a.commands.slice(0,turn)+alternative);
 const observed={refusals:r.metrics.blocked,dead:r.state.dead,mirrors:r.state.mirrors.length,supports:r.state.supports,platformActive:r.state.platformActive??[],...Object.fromEntries(a.world.circuits.map(c=>[c.id,circuitPressed(a.world,r.state,c.id)]))};
 for(const [key,value]of Object.entries(expected))if(JSON.stringify(observed[key])!==JSON.stringify(value))throw Error(`Local check changed at ${turn} + ${alternative}: ${key}`);
 return{turn,alternative,effect,observed};
}
const localChecks=[
 checkLocal(37,"R",{"accord": false, "mirrors": 1, "dead": false},"Après le premier reflet, un pas volontaire du Voleur tracte le miroir sur le quai, retire son propre poids, rétracte le quai et détruit le miroir ; le relais par chant conserve la commande."),
 checkLocal(36,"U",{"accord": false},"Avant le reflet, monter entraîne le miroir hors de son bouton et referme la porte.")
];
a.save(new URL('../level4-design.json',import.meta.url),{
 puzzle:1,label:'Adaptation de Heroes and Mirrors · énigme 1 · départ du Barde par reflet',
 url:'https://sinkingstarwalkthrough.com/fr/heroes-and-mirrors-solutions/#%C3%A9nigme-1',
 secondaryLabel:'Heroes and Mirrors · énigmes 4 et 5 · miroir tracté et poids maintenu',
 secondaryUrl:'https://sinkingstarwalkthrough.com/fr/heroes-and-mirrors-solutions/#%C3%A9nigme-5',
 objective:'Préparer les deux commandes et choisir des départs qui les laissent occupées jusqu’à l’arrivée du duo.'
},{kind:'adaptation',preserved:['Le Barde quitte la portée d’une caisse-poids par reflet pour éviter de la déplacer avec son chant.','Le Voleur déplace un miroir puis doit s’éloigner en conservant ce miroir sur son bouton.'],changed:['Deux rives séparées préparent une commande commune à deux poids.','Le premier reflet transporte les deux héros simultanément ; le Barde revient ensuite délivrer le Voleur de son appui par chant avant le second passage.','Une arrivée hydraulique et une porte haute sont alimentées par le même accord.'],sourceReading:'Mirrors 1 inspire le départ du Barde sans chant après placement d’un poids. Mirrors 4 et 5 inspirent la traction du miroir et le départ qui préserve sa commande. La géométrie à deux départs simultanés est originale ; les reflets suivent la priorité proche de SS14 et ne créent pas de doubles.',localChecks,checkScope:'Comparaisons locales du parcours auteur ; aucune preuve d’optimalité ou d’unicité globale.'});
