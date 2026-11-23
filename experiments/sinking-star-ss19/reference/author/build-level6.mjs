import {Author,board} from './author.mjs';
import {writeFileSync} from 'node:fs';
const b=board(20,20,'~');
b.fill(0,0,19,0,'#');b.fill(0,19,19,19,'#');b.fill(0,0,0,19,'#');b.fill(19,0,19,19,'#');
// A forked southern quay, a separate northern landing, and two optical cargo sockets.
b.fill(2,10,6,16);b.fill(4,6,4,10);b.fill(6,14,10,15);b.fill(10,8,10,14);b.fill(11,5,11,8);b.fill(11,10,11,13);b.put(11,15,'#');
b.fill(7,2,10,4);b.put(10,2,'g');
b.fill(12,14,12,17);b.fill(12,16,16,17);b.put(14,17,'g');b.put(16,17,'g');
b.fill(13,6,13,9);b.put(13,6,'o');b.put(13,12,'o');b.put(13,14,'.');b.put(8,8,'.');
b.put(3,12,'W');b.put(3,15,'Z');b.put(11,5,'B');
export const spec={id:'ss19-06',title:'La seconde image',rows:b.strings(),facing:'N',
 mirrors:[{at:{x:8,y:8},facing:'NW'},{at:{x:13,y:14},facing:'NW'}],
 circuits:[{id:'retard',buttons:[{x:8,y:14}],color:15}],
 gates:[{at:{x:8,y:4},circuit:'retard',direction:'S',closedWhen:'pressed'},
 {at:{x:10,y:2},circuit:'retard',direction:'W',closedWhen:'released'},
 {at:{x:12,y:16},circuit:'retard',direction:'N',closedWhen:'released'}],
};
export function build(){
 const a=new Author(spec);const stage=s=>{a.stage(s);if(process.env.SS19_AUTHOR_DEBUG)console.log(s,a.commands,JSON.stringify(a.state));};
 a.select('bard').act('DDD');
 stage('Le chant descend la charge lointaine au fond de sa glissière, derrière la caisse proche du miroir.');
 a.go(10,8,'wizard').act('R');
 stage('Le Magicien retire le Barde sans emporter la charge hors de sa glissière.');
 a.go(4,8,'warrior').act('X');
 stage('Le premier reflet dépose le Guerrier sur le débarcadère nord et coule seulement la caisse proche : la commande reste relâchée.');
 a.go(9,3,'warrior');
 a.act('X');
 stage('Le second reflet atteint enfin la charge lointaine. Elle ferme le débarcadère derrière le Guerrier, ouvre sa destination et le passage sud-est.');
 a.go(10,2,'warrior');
 a.go(11,5,'wizard');
 a.go(14,17,'bard');
 a.go(16,17,'wizard');
 stage('Le pont fabriqué au premier reflet assure l’arrivée des deux autres héros ; la charge du second doit rester sèche sur sa commande.');
 return a.result({puzzle:19,label:'Adaptation de Heroes and Mirrors · énigme 19 · une commande à retardement',url:'https://sinkingstarwalkthrough.com/fr/heroes-and-mirrors-solutions/',secondaryLabel:'Heroes and Water · énigme 11 · un échange conserve le nombre d’occupants',secondaryUrl:'https://sinkingstarwalkthrough.com/fr/heroes-and-water-solutions/',objective:'Préparer la charge derrière un bloqueur, synchroniser deux reflets, quitter le débarcadère avant sa fermeture puis franchir le pont créé au premier passage.'},{kind:'adaptation',preserved:['Mirrors 19 : le bloqueur le plus proche part à l’eau au premier reflet, et la véritable charge ne rejoint sa commande qu’au second.','Water 11 : la transposition ne transporte pas à elle seule les trois héros sur une région isolée.'],changed:['Deux miroirs fixes synchronisent une arrivée au nord et une livraison au sud. Le premier appui est lui-même nécessaire aux traversées finales.','Le Barde prépare la charge dans une glissière éloignée ; le Magicien le relève sans chant.','Un seul appui immergé remplace les empilements de la source. Le Guerrier quitte une case qui devient une presse lorsque la commande s’active.'],sourceReading:'Reprise du retard optique de Mirrors 19 dans une géométrie originale à trois régions ; aucun empilement, duplicateur ou autre règle du jeu source n’est ajouté.',proofScope:'Dans le parcours de référence, une caisse forme le passage sud-est et l’autre conserve la commande nord. La préparation de la charge peut aussi être effectuée après les deux premiers reflets, au prix de manœuvres supplémentaires. La mobilité de miroirs obtenue en fabriquant d’autres appuis n’est pas exclue par une preuve exhaustive ; aucune unicité ni optimalité n’est revendiquée.'});
}
if(process.argv[1]?.endsWith('build-level6.mjs')){const d=build();writeFileSync(new URL('../level6-design.json',import.meta.url),JSON.stringify(d,null,2)+'\n');console.log(JSON.stringify({title:spec.title,metrics:d.metrics,commands:d.commands}));}
