import {Author,board} from './author.mjs';
import {replay} from '../../scripts/solver.mjs';
import {circuitPressed} from '../../dist/core.js';
const b=board(20,20);
b.fill(2,5,6,12);b.put(7,6);b.put(7,3);b.fill(7,4,7,5,'~');b.fill(8,3,9,3,'~');
b.fill(10,3,16,5);b.fill(10,6,10,8);b.fill(7,8,11,8);b.fill(12,8,17,13);
b.put(3,6,'Z');b.put(7,3,'B');b.put(10,3,'o');b.put(4,10,'o');b.put(16,11,'g');b.put(16,12,'g');
const spec={id:'ss15-03',title:'Le remplaçant derrière le reflet',rows:b.strings(),
 mirrors:[{at:{x:7,y:6},facing:'NW'}],
 circuits:[{id:'cellule',buttons:[{x:7,y:3}],color:15},{id:'entree-finale',buttons:[{x:5,y:11}],color:10}],
 gates:[{at:{x:10,y:8},circuit:'cellule',direction:'S',closedWhen:'released'},{at:{x:12,y:8},circuit:'entree-finale',direction:'E',closedWhen:'released'}]};
const a=new Author(spec);
a.act('R').stage('La visée déviée libère le Barde et place le Magicien dans sa cellule');
a.act('R').stage('La caisse remplace le Magicien dans la cellule et maintient le passage');
a.go(4,8,'bard').act('RD').stage('Le Barde amène le second poids sur la commande de la dernière salle');
const loaded=a.commands.length;
a.go(5,6,'wizard');const beforeRescue=a.commands.length;
a.act('D').stage('Un second échange retire le Barde sans reprendre son poids');
a.go(6,6,'bard').go(7,8).go(16,11).stage('Le Barde emprunte les deux passages maintenus par les caisses');
a.go(16,12,'wizard').stage('Les deux partenaires sont libres ; les deux remplaçants restent à leur poste');
function check(turn,alternative,expected,effect){
 const r=replay(spec,a.commands.slice(0,turn)+alternative);
 const observed={refusals:r.metrics.blocked,dead:r.state.dead,wizard:r.state.heroes.find(h=>h.kind==='wizard').at,bard:r.state.heroes.find(h=>h.kind==='bard').at,stones:r.state.stones,bouncedSwaps:r.metrics.bouncedSwaps,pressed:circuitPressed(r.world,r.state,'entree-finale')};
 for(const [k,v]of Object.entries(expected))if(JSON.stringify(observed[k])!==JSON.stringify(v))throw Error('L3 local check '+k);
 return{turn,alternative,effect,observed};
}
const localChecks=[
 check(0,'R',{refusals:0,dead:false,wizard:{x:7,y:3},bard:{x:3,y:6},bouncedSwaps:1},'Le premier échange suit la face blanche du miroir et traverse le coude au-dessus de l’eau.'),
 check(loaded,'D',{refusals:0,dead:false,pressed:false},'Si le Barde descend encore à pied, le deuxième poids quitte sa commande et la salle finale se referme.'),
 check(beforeRescue,'D',{refusals:0,dead:false,pressed:true,stones:[{x:7,y:3},{x:5,y:11}],bard:{x:5,y:6}},'L’échange retire le Barde du voisinage de la caisse sans déclencher le chant.')
];
a.save(new URL('../level3-design.json',import.meta.url),{
 puzzle:19,label:'Adaptation de Heroes of Hauling · énigme 19 · libération par substitution',url:'https://sinkingstarwalkthrough.com/fr/heroes-of-hauling-solutions/#%C3%A9nigme-19',
 secondaryLabel:'Heroes and Mirrors · énigme 1 · laisser le poids en place',secondaryUrl:'https://sinkingstarwalkthrough.com/fr/heroes-and-mirrors-solutions/#%C3%A9nigme-1',
 objective:'Libérer le partenaire par une visée déviée, remplacer les héros par des poids et conserver les deux passages.'
},{kind:'adaptation',preserved:['Un échange libère le héros enfermé et une caisse prend finalement sa place.','Le Barde doit quitter un poids sans l’entraîner hors de sa commande.'],changed:['La visée du Magicien emprunte un miroir fixe avant d’atteindre la cellule.','Deux caisses maintiennent deux passages distincts et deux héros doivent atteindre l’arrivée.','Le chant carré, la cellule isolée par l’eau et l’ordre des postes sont une composition SS15.'],sourceReading:'Heroes of Hauling 19 remplace des héros emprisonnés par des cristaux ; Heroes and Mirrors 1 laisse un cristal sur un bouton pendant un déplacement forcé du Barde. Les cartes et la visée déviée sont réagencées pour SS15.',localChecks,checkScope:'Comparaisons locales exécutées ; aucune preuve d’optimalité ou d’unicité globale.'});
