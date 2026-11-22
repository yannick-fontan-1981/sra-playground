import {Author,board} from './author.mjs';
import {replay,decodeCommand} from '../../scripts/solver.mjs';
import {stepDetailed,circuitPressed} from '../../dist/core.js';
const b=board(20,16);
b.fill(2,8,5,12);b.put(2,7);b.fill(2,6,7,6);b.fill(3,2,8,4);b.fill(3,5,5,5,'~');
b.put(9,3);b.fill(10,2,16,7);b.put(13,8,'~');b.fill(12,9,16,12);
b.put(3,11,'M');b.put(5,11,'W');b.put(3,6,'T');b.put(2,6,'1');b.put(3,8,'o');b.put(4,8,'o');
b.put(12,10,'g');b.put(14,11,'g');b.put(16,10,'g');
const spec={id:'ss16-03',title:'Lâcher le miroir, garder son poids',rows:b.strings(),facing:'E',
 circuits:[{id:'double-lest',buttons:[{x:5,y:6},{x:3,y:11}],color:15}],
 gates:[{at:{x:9,y:3},circuit:'double-lest',direction:'E',closedWhen:'released'}],
 platforms:[3,4,5].map(x=>({at:{x,y:5},circuit:'double-lest',activeWhen:'pressed'}))};
const a=new Author(spec);
a.select('thief').act('RRR').stage('Le Voleur tire le miroir jusqu’à son bouton, au fond du couloir');
const beforeRelease=a.commands.length;
a.act('X').stage('Le reflet évacue le Voleur par le haut sans reprendre le miroir derrière lui');
a.go(3,9).act('D').go(4,10).stage('Le Voleur extrait la première réserve puis quitte le bouton de côté');
a.go(3,8,'warrior').act('DD').stage('Le Guerrier remplace le Marchand par le bloc sans relâcher le bouton ni les plateformes');
a.go(5,11,'warrior');
a.go(4,12,'merchant').stage('Le Marchand dégage le couloir pour le dernier bloc, réservé au pont');
a.go(4,9,'thief').act('D').go(5,10).stage('La seconde réserve descend du mur ; elle ne doit pas remplacer le miroir');
a.go(3,6,'thief').stage('Le Voleur attend au-dessus du coude avant que le bloc coupe le passage');
a.go(5,9,'warrior').act('LL').go(2,10).act('UUU').go(2,8).stage('Le Guerrier ramène le bloc jusqu’au coude inférieur sans le coincer contre le miroir');
a.go(3,6,'thief').act('R').go(4,5).stage('Le Voleur dégage le bloc de la paroi latérale pour préparer sa rotation');
a.go(2,6,'warrior').act('R').go(2,8).stage('Une poussée unique place le bloc sous le passage vertical');
a.go(4,5,'thief').act('UUU').act('R').stage('Le Voleur remonte le bloc jusqu’à la rangée de la porte ouverte');
a.go(3,3,'warrior').act('RRRRRRRRR').go(13,2).act('DDDDD').stage('Le Guerrier fait franchir la porte au bloc, puis le convertit en dernier appui');
a.go(14,11,'warrior').go(12,10,'merchant').go(16,10,'thief').stage('Les trois héros traversent ; les deux lests restent derrière eux');
const prematureClimb=replay(spec,a.commands.slice(0,beforeRelease-1)+'U');
if(!prematureClimb.state.dead||!prematureClimb.state.heroes.find(h=>h.kind==='thief').dead)throw Error('Leaving the temporary button before parking the mirror must withdraw the hydraulic landing');
const prematureWalk=replay(spec,a.commands.slice(0,beforeRelease)+'R');
const trappedChecks=Object.fromEntries([...'UDLRX'].map(c=>{const ac=decodeCommand(c,prematureWalk.state);const d=stepDetailed(prematureWalk.world,prematureWalk.state,ac.id,ac.data);return[c,{failed:d.state.failed,dead:d.state.dead}];}));
if(prematureWalk.metrics.blocked||prematureWalk.state.dead||Object.values(trappedChecks).some(v=>!v.failed))throw Error('Walking east should strand the Thief with the mirror in this local alcove');
a.save(new URL('../level3-design.json',import.meta.url),{
 puzzle:4,label:'Adaptation de Heroes and Mirrors · énigme 4 · le reflet coupe la traction',url:'https://sinkingstarwalkthrough.com/fr/heroes-and-mirrors-solutions/#%C3%A9nigme-4',
 secondaryLabel:'Heroes and Mirrors · Métamonde 2 · le miroir devient un lest',secondaryUrl:'https://sinkingstarwalkthrough.com/fr/heroes-and-mirrors-solutions/#m%C3%A9tamonde-%C3%A9nigme-2',
 objective:'Extraire et laisser le miroir sur son bouton, puis faire tourner le dernier bloc par plusieurs relais pousse–tire.'
},{kind:'adaptation',preserved:['Le Voleur déplace le miroir par traction.','Un déplacement par reflet permet de quitter une position sans entraîner le miroir.','Le miroir conserve un rôle de poids après avoir servi au transport.'],changed:['La géométrie utilise une alcôve latérale et un passage supérieur, au lieu de reproduire les cases de la référence.','Le Marchand maintient le second bouton pendant la sortie du Voleur ; il est ensuite remplacé par un bloc.', 'Trois plateformes temporaires ne restent levées que tant que les deux boutons sont occupés.', 'Le second bouton et l’unique bloc destiné à l’eau obligent à conserver le miroir comme lest.','Deux réserves et trois destinations font intervenir le Marchand et le Guerrier dans les rotations du transport.','Ni duplication, ni fusion, ni dragon, ni mouvement en temps réel du guide ne sont implémentés.'],sourceReading:'Mirrors 4 enseigne le départ par reflet pour éviter de reprendre un miroir ; Mirrors Métamonde 2 conserve le miroir comme poids. Les plateformes d’échappée, le relais du Marchand et le trajet coudé de la dernière caisse sont nouveaux.',localChecks:[{turn:beforeRelease-1,alternative:'U',effect:'Monter avant d’avoir laissé le miroir sur le bouton retire la plateforme sous le Voleur.',observed:{dead:prematureClimb.state.dead,deadHeroes:prematureClimb.state.heroes.filter(h=>h.dead).map(h=>h.kind),platformActive:prematureClimb.state.platformActive}}, {turn:beforeRelease,alternative:'R',effect:'Marcher vers l’est au lieu de refléter tire le miroir hors de son bouton et enferme le Voleur au bout de l’alcôve.',observed:{refusals:prematureWalk.metrics.blocked,dead:prematureWalk.state.dead,mirror:prematureWalk.state.mirrors[0],nextThiefActions:trappedChecks}}],checkScope:'Parcours gagnant et contre-branche locale vérifiés. La contre-branche teste les cinq actions du Voleur depuis l’alcôve ; elle ne prétend pas énumérer tous les états globaux.'});
