import {Author,board} from './author.mjs';
import {replay,decodeCommand} from '../../scripts/solver.mjs';
import {stepDetailed,circuitPressed} from '../../dist/core.js';
const b=board(18,18);
b.fill(2,8,7,12);b.fill(3,6,6,6);b.put(3,7);b.fill(8,8,9,8);b.fill(9,9,9,10,'~');b.put(9,11);b.fill(9,12,14,15);
b.put(2,10,'M');b.put(5,10,'W');b.put(5,6,'T');b.put(6,6,'o');b.put(6,8,'o');b.put(7,8,'o');
b.put(10,14,'g');b.put(12,14,'g');b.put(14,14,'g');
const spec={id:'ss16-04',title:'Le quai des deux impulsions',rows:b.strings(),facing:'E',
 circuits:[
  {id:'poids-conserve',buttons:[{x:5,y:6}],color:15},
  {id:'depart-force',buttons:[{x:6,y:6}],color:10},
  {id:'depot-a-deux',buttons:[{x:2,y:10},{x:3,y:6}],color:11}],
 gates:[
  {at:{x:4,y:6},circuit:'depart-force',direction:'W',closedWhen:'released'},
  {at:{x:9,y:8},circuit:'depot-a-deux',direction:'S',closedWhen:'pressed'},
  {at:{x:9,y:11},circuit:'poids-conserve',direction:'S',closedWhen:'released'}]};
const a=new Author(spec);
a.go(5,8,'warrior').act('RR').stage('Le Guerrier charge la presse avec une file de deux blocs ; le Marchand garde une des deux commandes');
const loaded=a.commands.length;
a.select('thief').act('L').stage('La traction libère la première commande : le Voleur est poussé sur la seconde et la presse latérale dépose le premier appui');
const firstDeposit=a.commands.length;
a.act('D').stage('Le Voleur relâche la commande pour rouvrir la presse de chargement');
a.go(7,8,'warrior').act('R').stage('Le second bloc prend place sur la presse désormais ouverte');
a.select('thief').act('U').stage('Le second appui nécessite une autre impulsion : le bloc arrive au-dessus du premier support');
a.act('D').stage('La presse doit de nouveau s’ouvrir avant de laisser passer le Guerrier');
a.select('warrior').act('RD').stage('Le Guerrier prolonge le pont : il pousse le bloc depuis le premier support jusque dans la seconde case d’eau');
a.go(10,14,'warrior').go(12,14,'merchant').go(14,14,'thief').stage('Les trois héros empruntent les deux appuis ; le bloc quitté par le Voleur maintient toujours la porte');
const noMerchantStart=replay(spec,a.commands.slice(0,loaded));
let s=noMerchantStart.state;
for(const c of 'CCUCCL'){const ac=decodeCommand(c,s);s=stepDetailed(noMerchantStart.world,s,ac.id,ac.data).state;}
if(s.failed||s.dead||s.supports.length!==0)throw Error('Without Merchant weight the Thief departure must not create the bridge');
const afterFirst=replay(spec,a.commands.slice(0,firstDeposit));
const direct=supportReport(afterFirst);
function supportReport(r){return{supports:r.state.supports,stones:r.state.stones,thief:r.state.heroes.find(h=>h.kind==='thief').at,pressure:circuitPressed(r.world,r.state,'depot-a-deux'),pistonPushes:r.metrics.pistonPushes};}
a.save(new URL('../level4-design.json',import.meta.url),{
 puzzle:1,label:'Adaptation de Heroes and Light · énigme 1 · la presse remplace le côté inaccessible',url:'https://sinkingstarwalkthrough.com/fr/heroes-and-light-solutions/#%C3%A9nigme-1',
 secondaryLabel:'Heroes and Water · énigme 3 · le premier appui prépare le suivant',secondaryUrl:'https://sinkingstarwalkthrough.com/fr/heroes-and-water-solutions/#%C3%A9nigme-3',
 objective:'Précharger la file, libérer le Voleur par une poussée forcée, puis déposer deux blocs avec deux impulsions coordonnées.'
},{kind:'adaptation',preserved:['La face d’une presse impose une poussée vers un emplacement que le héros ne peut pas atteindre depuis le bon côté.','Un déplacement forcé du Voleur interrompt la traction : le bloc garde sa place sur le bouton.','La première case de passage permet de construire la suivante.'],changed:['Une presse libère le Voleur, dont l’arrivée commande une autre presse avec le Marchand.','Le Guerrier charge deux blocs et doit rouvrir la presse entre les deux dépôts.','Les deux cases d’eau, les trois personnages et la porte tenue par le bloc abandonné sont une composition originale SS16.','Le niveau utilise trois presses pures, chacune sans bouton superposé ; aucun faisceau de pouvoir ni dragon.'],sourceReading:'Light 1 utilise la direction des presses pour déposer des pièces et dégager le Voleur ; Water 3 construit les positions de poussée avec les appuis déjà posés. Le déclenchement en deux presses, les deux commandes et le chargement successif sont une composition SS16.',localChecks:[{turn:loaded,alternative:'CCUCCL',effect:'Si le Marchand quitte sa commande avant la sortie du Voleur, la première presse libère celui-ci mais la presse de dépôt ne produit aucun appui.',observed:{supports:s.supports,dead:s.dead,failed:s.failed,secondCircuit:circuitPressed(noMerchantStart.world,s,'depot-a-deux')}},{turn:firstDeposit,effect:'Après la première impulsion, le Voleur a été déplacé sans reprendre le bloc de la porte, et un seul appui existe.',observed:direct}],checkScope:'Parcours gagnant et deux contrôles locaux. La commande prématurée reste réparable ; ce test montre la dépendance de la presse au second poids, pas une impasse globale.'});
