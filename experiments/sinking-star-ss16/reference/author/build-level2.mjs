import {Author,board} from './author.mjs';
import {replay} from '../../scripts/solver.mjs';
import {circuitPressed} from '../../dist/core.js';
const b=board(20,18);
b.fill(2,3,9,13);b.fill(10,7,11,7);b.fill(12,7,13,7,'~');
b.fill(14,4,18,10);b.fill(15,11,15,12,'~');b.fill(14,13,18,16);
b.put(3,10,'M');b.put(5,8,'W');b.put(16,5,'T');
b.put(10,7,'o');b.put(11,7,'o');b.put(2,3,'o');b.put(5,3,'o');b.put(9,3,'o');
b.put(14,14,'g');b.put(16,15,'g');b.put(18,14,'g');
const spec={id:'ss16-02',title:'Récupérer avant de combler',rows:b.strings(),facing:'E',
 circuits:[{id:'retour-du-voleur',buttons:[{x:5,y:12}],color:15}],
 gates:[{at:{x:14,y:7},circuit:'retour-du-voleur',direction:'E',closedWhen:'released'}]};
const a=new Author(spec);
a.go(9,7,'merchant');const merchantTrain=a.commands.length;
a.go(5,12).stage('Le Marchand assure le passage pendant que le Voleur reste isolé sur la rive orientale');
a.go(9,7,'warrior').act('RRR').stage('Le Guerrier pousse les deux blocs du chenal : deux appuis ouvrent la route du Voleur');
a.go(14,8).stage('Le Guerrier dégage la porte et laisse le Voleur retourner vers les réserves');
a.go(5,4,'thief').act('DDDDDDD').go(6,11).stage('Le Voleur extrait le premier bloc du bord nord et prépare le remplacement du Marchand');
a.go(5,9,'warrior').act('DD').stage('La poussée en file remplace le Marchand par le bloc sans relâcher la commande');
a.go(3,3,'thief').act('R').act('D').go(3,4).act('DDDD').go(4,8).stage('Le Voleur sort le bloc du coin : d’abord sur le côté, ensuite vers le bas');
a.go(2,7,'merchant').act('RRRRRRRRRRRR').go(14,8).stage('Le Marchand transporte ce bloc, seul, sur les deux appuis déjà construits');
a.go(15,6,'warrior').act('DDDD').stage('Le troisième bloc comble la première case du pont méridional');
a.go(8,7,'merchant');
a.go(9,4,'thief').act('DDDD').go(8,8).stage('La dernière réserve quitte le mur : il reste exactement le bloc du dernier appui');
a.go(8,7,'merchant').act('RRRRRR').go(14,8).stage('Le dernier bloc traverse le pont nord sans emporter son lest');
a.go(15,6,'warrior').act('DDDDD').stage('La première case du pont sud donne le recul nécessaire pour paver la seconde');
a.go(16,15,'warrior').go(14,14,'merchant').go(18,14,'thief').stage('Les trois héros rejoignent leurs destinations ; le cinquième bloc garde la porte ouverte');
const branch=replay(spec,a.commands.slice(0,merchantTrain)+'R');
if(branch.metrics.blocked!==1||branch.state.dead||branch.state.stones.length!==5)throw Error('Merchant must fail against the initial two-block queue');
a.save(new URL('../level2-design.json',import.meta.url),{
 puzzle:2,label:'Adaptation de Heroes and Water · énigme 2 · récupérer les réserves avant leur emploi',url:'https://sinkingstarwalkthrough.com/fr/heroes-and-water-solutions/#%C3%A9nigme-2',
 secondaryLabel:'Heroes of Hauling · énigme 17 · laisser un poids derrière le groupe',secondaryUrl:'https://sinkingstarwalkthrough.com/fr/heroes-of-hauling-solutions/#%C3%A9nigme-17',
 objective:'Faire revenir le Voleur, extraire les trois réserves et conserver un lest sec pendant la construction des deux ponts.'
},{kind:'adaptation',preserved:['La route utile se prépare en ouvrant d’abord l’accès aux réserves.','Les blocs sont une ressource limitée : ceux immergés ne peuvent plus servir de poids.','Un poids reste sur la commande pendant le regroupement de tous les héros.'],changed:['Deux blocs en file et un Voleur initialement isolé imposent le premier travail du Guerrier.','Le Marchand assure le retour du Voleur, puis un bloc le remplace sur la commande.','Trois héros, deux ponts, quatre appuis permanents et un lest sec remplacent la carte de la référence.','Aucun miroir, dragon, ricochet ou mécanisme chronométré n’intervient dans cette salle.'],sourceReading:'Water 2 sert de référence à l’accès aux réserves avant leur emploi. Le maintien collectif de la porte vient de Hauling 17. La file initiale, le retour du Voleur, les deux ponts et le remplacement du Marchand sont une composition originale SS16.',localChecks:[{turn:merchantTrain,alternative:'R',effect:'Le Marchand ne peut pas lancer la file de deux blocs avant le retour du Voleur.',observed:{refusals:branch.metrics.blocked,dead:branch.state.dead,stones:branch.state.stones.length}}],checkScope:'Parcours gagnant vérifié et contre-branche locale de poussée. Les cinq blocs initiaux deviennent quatre appuis et un poids ; pas de preuve d’optimalité globale.'});
