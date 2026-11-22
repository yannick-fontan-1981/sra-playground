import {Author,board} from './author.mjs';
import {replay} from '../../scripts/solver.mjs';
import {circuitPressed} from '../../dist/core.js';
const b=board(20,20);
b.fill(3,4,10,7);b.put(4,8);b.put(10,8);b.fill(3,9,12,12);b.fill(13,10,14,10);b.fill(15,9,17,13);
b.put(3,7,'Z');b.put(7,7,'B');b.put(5,5,'m');b.put(9,5,'m');b.put(6,11,'o');b.put(16,11,'g');b.put(16,12,'g');
const spec={id:'ss15-05',title:'Les gardiens qu’il faut garder',rows:b.strings(),
 circuits:[{id:'gardiens',buttons:[{x:8,y:5},{x:10,y:5}],color:11},{id:'troisieme-poids',buttons:[{x:8,y:11}],color:10}],
 gates:[{at:{x:4,y:8},circuit:'gardiens',direction:'S',closedWhen:'released'},{at:{x:13,y:10},circuit:'gardiens',direction:'E',closedWhen:'released'},{at:{x:14,y:10},circuit:'troisieme-poids',direction:'E',closedWhen:'released'}]};
const a=new Author(spec);
a.select('bard').act('RRR').stage('La butée retient le gardien de droite tandis que le chant aligne celui de gauche sur sa commande');
const guardsLoaded=a.commands.length;
a.select('wizard').act('R').stage('Le Magicien retire le Barde du chœur sans déplacer les deux poids vivants');
a.go(11,9,'wizard');
a.go(4,9,'bard').act('RR').stage('Le Barde franchit la première porte et place la caisse sur la troisième commande');
const crateLoaded=a.commands.length;
a.select('wizard');const beforeRelease=a.commands.length;
a.act('L').stage('Le second échange libère le Barde de sa caisse : les trois poids restent actifs');
a.go(16,11,'bard').stage('Le Barde franchit les deux portes successives commandées par les gardiens et la caisse');
a.go(16,12,'wizard').stage('Le duo termine en laissant les deux monstres vivants sur leurs commandes');
function check(turn,alternative,expected,effect){
 const r=replay(spec,a.commands.slice(0,turn)+alternative);
 const observed={refusals:r.metrics.blocked,dead:r.state.dead,monsters:r.state.monsters,stones:r.state.stones,bard:r.state.heroes.find(h=>h.kind==='bard').at,gardiens:circuitPressed(r.world,r.state,'gardiens'),troisiemePoids:circuitPressed(r.world,r.state,'troisieme-poids')};
 for(const [k,v]of Object.entries(expected))if(JSON.stringify(observed[k])!==JSON.stringify(v))throw Error('L5 local check '+k);
 return{turn,alternative,effect,observed};
}
const localChecks=[
 check(guardsLoaded,'U',{refusals:0,dead:false,gardiens:false,monsters:[{x:8,y:4},{x:10,y:4}]},'Un départ volontaire du Barde reprend les deux gardiens et referme leurs portes.'),
 check(guardsLoaded,'CUURD',{refusals:0,dead:false,gardiens:false,monsters:[{x:3,y:5},{x:10,y:5}]},'Viser la rangée des monstres échange le premier gardien : le Magicien le remplace sur la commande, mais son départ suivant relâche celle-ci.'),
 check(crateLoaded,'D',{refusals:0,dead:false,gardiens:true,troisiemePoids:false,stones:[{x:8,y:12}]},'Un départ à pied après le dépôt de la caisse retire uniquement le troisième poids.'),
 check(beforeRelease,'L',{refusals:0,dead:false,gardiens:true,troisiemePoids:true,bard:{x:11,y:9},stones:[{x:8,y:11}]},'L’échange de sortie conserve la caisse et les deux monstres à leurs postes.')
];
a.save(new URL('../level5-design.json',import.meta.url),{
 puzzle:14,label:'Adaptation de Heroes 3: Bard, Druid · énigme 14 · deux gardiens sur leurs plaques',url:'https://sinkingstarwalkthrough.com/fr/heroes-3-bard-druid-solutions/#%C3%A9nigme-14',
 secondaryLabel:'Heroes 2: Monsters · énigme 22 · deux monstres et une caisse comme poids',secondaryUrl:'https://sinkingstarwalkthrough.com/fr/heroes-2-monsters-solutions/#%C3%A9nigme-22',
 objective:'Conserver les deux gardiens vivants, compléter les trois poids et quitter chaque poste sans chant.'
},{kind:'adaptation',preserved:['Les monstres constituent des poids qu’il faut garder vivants sur leurs commandes.','Le Barde doit quitter ses poids par un déplacement forcé.','Deux monstres et une caisse maintiennent ensemble les accès à l’arrivée.'],changed:['Le Magicien remplace le partenaire qui entraîne le Barde dans la source.','Une butée modifie l’écart des gardiens dans le chant carré de 5 × 5.','Les gardiens ouvrent d’abord l’accès à la caisse puis restent nécessaires à la première des deux portes finales.','Les monstres restent stationnaires hors transport et le combat suit le contrat simultané SS15.'],sourceReading:'Heroes 3, énigme 14 place deux gobelins sur deux plaques puis fait sortir la Barde sans reprendre ses poids. Heroes 2, énigme 22 combine deux monstres et un cristal sur trois commandes. SS15 en fait deux ateliers liés par deux échanges du Magicien.',localChecks,checkScope:'Comparaisons locales exécutées ; aucune preuve d’optimalité ou d’unicité globale.'});
