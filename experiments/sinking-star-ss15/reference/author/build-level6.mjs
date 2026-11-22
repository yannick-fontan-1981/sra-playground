import {Author,board} from './author.mjs';
import {replay} from '../../scripts/solver.mjs';
import {circuitPressed} from '../../dist/core.js';
const b=board(20,20);
b.fill(2,5,6,10);b.fill(7,6,9,6);b.put(6,6,'~');
b.put(9,3);b.fill(9,4,9,5,'~');b.fill(10,5,16,11);b.fill(8,8,9,8);b.fill(9,9,9,11);
b.put(7,8,'~');b.put(7,9);b.put(7,10);b.put(12,12);b.fill(12,13,16,15);
b.put(2,4,'Z');b.put(4,8,'B');b.put(9,3,'o');b.put(13,14,'g');b.put(14,14,'g');
const spec={id:'ss15-06',title:'La visée et le dernier appui',rows:b.strings(),
 mirrors:[{at:{x:8,y:6},facing:'NW'}],
 circuits:[{id:'relais-du-nord',buttons:[{x:4,y:9}],color:15},{id:'depot-lateral',buttons:[{x:7,y:10}],color:10}],
 gates:[{at:{x:8,y:6},circuit:'relais-du-nord',direction:'E',closedWhen:'pressed'},{at:{x:6,y:8},circuit:'depot-lateral',direction:'E',closedWhen:'pressed'},{at:{x:12,y:12},circuit:'relais-du-nord',direction:'S',closedWhen:'pressed'}],
 platforms:[{at:{x:9,y:4},circuit:'relais-du-nord',activeWhen:'pressed'},{at:{x:9,y:5},circuit:'relais-du-nord',activeWhen:'pressed'}]};
const a=new Author(spec);
a.select('bard').act('D').stage('La première presse décale le miroir et aligne sa face sur la caisse isolée');
const mirrorPressed=a.commands.length;
a.act('U').stage('Le Barde relâche la commande : la presse rouverte laisse passer la visée du Magicien');
const mirrorOpen=a.commands.length;
a.go(3,6,'wizard').act('R').stage('L’échange dévié ramène la caisse sèche et envoie le Magicien sur l’île du nord');
a.select('bard').act('D').stage('Le Barde dégage la caisse de la ligne du miroir et maintient les deux plateformes pour le retour');
a.select('wizard').act('D');const onPlatform=a.commands.length;
a.act('DR').stage('Le Magicien quitte les plateformes et rejoint le sol de la rive orientale');
a.select('bard').act('D').stage('Le Barde retire le pont provisoire et ouvre l’accès final, puis prépare la caisse pour la seconde presse');
a.act('RRR').stage('Le chant charge la presse latérale au moment où le Barde atteint sa commande : la caisse devient l’appui de la seconde traversée');
a.act('U').stage('La seconde presse est rouverte avant la traversée');
a.act('UR').go(13,14).stage('Le Barde emprunte l’appui permanent et rejoint l’arrivée libérée par le retrait du relais');
a.go(14,14,'wizard').stage('Le Magicien rejoint la seconde destination ; le miroir et l’appui ont rempli des rôles distincts');
function check(turn,alternative,expected,effect){
 const r=replay(spec,a.commands.slice(0,turn)+alternative);
 const observed={refusals:r.metrics.blocked,dead:r.state.dead,deadHeroes:r.state.heroes.filter(h=>h.dead).map(h=>h.kind),wizard:r.state.heroes.find(h=>h.kind==='wizard').at,stones:r.state.stones,supports:r.state.supports,mirrors:r.state.mirrors,swaps:r.metrics.swaps,platformActive:r.state.platformActive??[],relais:circuitPressed(r.world,r.state,'relais-du-nord')};
 for(const [k,v]of Object.entries(expected))if(JSON.stringify(observed[k])!==JSON.stringify(v))throw Error('L6 local check '+k+' '+JSON.stringify(observed));
 return{turn,alternative,effect,observed};
}
const localChecks=[
 check(mirrorPressed,'CDDRR',{refusals:0,dead:false,swaps:0,wizard:{x:4,y:6},relais:true},'Tant que la première presse reste fermée, elle interrompt le rayon : la commande droite fait marcher le Magicien au lieu d’échanger avec la caisse.'),
 check(mirrorOpen,'X',{refusals:0,dead:false,stones:[],supports:[{x:6,y:6}]},'Un reflet global prématuré immerge l’unique caisse dans la case d’eau isolée du couloir ; cette caisse sèche n’est alors plus disponible pour charger la seconde presse.'),
 check(onPlatform,'CU',{refusals:0,dead:true,deadHeroes:['wizard'],platformActive:[false,false],relais:false},'Si le Barde quitte sa commande pendant le retour du Magicien, les plateformes disparaissent sous celui-ci et il se noie.')
];
a.save(new URL('../level6-design.json',import.meta.url),{
 puzzle:1,label:'Adaptation de Heroes and Light · énigme 1 · deux dépôts par presses orientées',url:'https://sinkingstarwalkthrough.com/fr/heroes-and-light-solutions/#%C3%A9nigme-1',
 secondaryLabel:'Heroes and Light · énigme 4 · relais des commandes et dépôts successifs',secondaryUrl:'https://sinkingstarwalkthrough.com/fr/heroes-and-light-solutions/#%C3%A9nigme-4',
 objective:'Déplacer le miroir, récupérer la caisse sèche par échange, assurer le retour hydraulique puis créer le dernier appui par la presse latérale.'
},{kind:'adaptation',preserved:['Une presse dépose une ressource dans une direction qui n’est pas obtenue par une traction directe.','La commande doit être activée puis relâchée pour réutiliser le passage.','Les héros se relaient pendant les phases de chargement et de traversée.'],changed:['La première presse déplace un miroir pour construire une visée du Magicien.','Une commande du Barde crée deux plateformes temporaires et ferme simultanément l’accès final.','La caisse récupérée doit rester sèche jusqu’au second dépôt, qui en fait l’appui permanent du Barde.','Le chant carré, l’échange dévié et les deux destinations sont propres à SS15 ; aucun faisceau de pouvoir, empilement ou dragon du guide n’est repris.'],sourceReading:'Heroes and Light 1 utilise les presses pour atteindre des emplacements inaccessibles aux mouvements directs ; Light 4 répartit les remplaçants sur des commandes afin de produire des poussées successives. La chaîne miroir, caisse sèche, retour hydraulique et dernier appui est une composition originale SS15.',localChecks,checkScope:'Comparaisons locales du parcours auteur ; aucune preuve d’optimalité ou d’unicité globale.'});
