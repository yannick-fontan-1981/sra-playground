import {Author,board} from './author.mjs';
import {replay} from '../../scripts/solver.mjs';

const b=board(20,20);
// The Merchant's dock has only one opening: a crate must fill its water cell.
b.fill(1,1,5,4);b.put(6,3,'~');b.fill(7,3,7,17);
b.fill(1,7,7,17);b.fill(8,3,14,17,'~');
// The press loads a retractable platform; stepping off its control sinks the load.
b.put(8,5,'o');b.put(8,4,'#');b.put(9,5,'#');
b.fill(9,6,11,6);b.put(8,7,'#');b.put(9,7,'#');b.put(10,7,'#');
b.fill(12,3,12,5,'#');b.fill(12,7,12,17,'#');
// A three-cell bridge is needed before anyone can reach the reflection dock.
b.fill(11,12,12,14);
// The arrival court and the goal chamber have a single, initially closed gate.
b.fill(15,5,18,9);b.fill(15,1,18,3);b.put(18,4,'.');
b.put(2,3,'M');b.put(3,3,'o');b.put(3,8,'W');b.put(3,13,'T');
b.put(1,13,'o');b.put(2,13,'o');b.put(4,11,'o');
b.put(2,10,'o');b.put(5,10,'o');
b.put(15,5,'m');b.put(17,5,'m');
for(const x of [16,17,18])b.put(x,2,'g');
const spec={id:'ss16-01',title:'L’atelier des trois passeurs',rows:b.strings(),
 mirrors:[{at:{x:9,y:6},facing:'SE'}],
 circuits:[{id:'cyan',color:10,buttons:[{x:6,y:8}]},{id:'violet',color:15,buttons:[{x:2,y:9},{x:17,y:5}]}],
 gates:[{at:{x:8,y:5},circuit:'cyan',direction:'S',closedWhen:'pressed'},
        {at:{x:15,y:5},circuit:'cyan',direction:'E',closedWhen:'pressed'},
        {at:{x:18,y:4},circuit:'violet',direction:'S',closedWhen:'released'}],
 platforms:[{at:{x:8,y:6},circuit:'cyan',activeWhen:'pressed'}]};
const a=new Author(spec);
a.act('RRRRR').stage('Le Marchand construit seul le premier appui et rejoint les deux autres passeurs.');
a.go(6,7).act('D').stage('La commande cyan charge la plateforme et rapproche les deux monstres : ils s’éliminent ensemble.');
const platformLoaded=a.commands.length;
a.act('U').stage('Le Marchand relâche la commande : la caisse descend avec la plateforme et devient un appui permanent.');
a.go(2,11).act('U').stage('Une caisse remplace le héros sur le premier bouton violet. Il en faudra un second sur l’autre rive.');
a.go(5,9);
a.go(7,6,'warrior').act('RRR').stage('Le Guerrier pousse le miroir sur le seul axe qui atteint l’embarcadère.');
a.go(3,8);
a.select('thief').act('RRRU').stage('Le Voleur n’extrait que la caisse voisine ; la plus éloignée reste au fond. Il lâche sa charge de côté.');
a.go(2,13).act('RR').stage('La caisse collée au mur est extraite, sans case de poussée possible derrière elle.');
a.go(4,12).act('DDR').stage('La troisième caisse rejoint la rangée et le Voleur laisse libre la ligne de poussée.');
a.go(2,13,'warrior').act('RRRRRRR').stage('Le Guerrier pousse la file : trois caisses sont investies dans les trois cases manquantes du pont.');
const bridgeBuilt=a.commands.length;
a.select('merchant').act('DDD').stage('La dernière caisse de transport rejoint le pont, en restant mobile.');
a.go(4,13,'warrior').act('RRRRRRR').stage('La caisse destinée au bouton de la rive opposée atteint l’embarcadère.');
a.go(11,12).act('X').go(17,7).stage('Le Guerrier part depuis l’axe le plus court, devant la caisse plus éloignée.');
a.go(11,12,'merchant').act('X').go(18,8).stage('Le Marchand rejoint la cour avant le dernier transfert de matériel.');
a.go(11,13,'thief').act('LX').stage('Le reflet livre la caisse à l’autre rive. Le Voleur doit encore y retrouver ses partenaires.');
a.go(11,12).act('XLD').stage('Le Voleur traverse sans rien tirer, puis ramène la caisse depuis le bord et la lâche de côté.');
a.select('warrior').act('U').stage('La caisse remplace le monstre disparu sur le second bouton violet : les trois héros peuvent quitter les commandes.');
a.go(16,2);
a.go(18,2,'merchant');
a.go(17,2,'thief').stage('Les trois destinations sont occupées derrière la porte, avec les deux boutons maintenus par les caisses.');

function checkpoint(turn,label){const r=replay(spec,a.commands.slice(0,turn));return{label,turn,heroes:r.state.heroes,supports:r.state.supports,stones:r.state.stones,monsters:r.state.monsters,gateClosed:r.state.gateClosed,platformActive:r.state.platformActive};}
a.save(new URL('../level1-design.json',import.meta.url),{
 label:'Adaptation pédagogique · Heroes and Water 3 et Heroes and Light 1',
 url:'https://sinkingstarwalkthrough.com/fr/heroes-and-water-solutions/#%C3%A9nigme-3',puzzle:3,
 secondary:{label:'Heroes and Light · énigme 1 · presses et monstres',url:'https://sinkingstarwalkthrough.com/fr/heroes-and-light-solutions/#%C3%A9nigme-1',puzzle:1},
 objective:'Réunir les trois passeurs, construire le pont et remplacer les deux poids avant de rejoindre les destinations.'
},{kind:'adaptation',preserved:[
 'L’accès au bon côté d’une caisse détermine qui peut la déplacer ; pousser et tirer se relaient.',
 'Les caisses immergées forment un passage et ne restent plus des ressources mobiles.',
 'Une presse pose une charge dans une case où la poussée et la traction ordinaires ne peuvent pas la déposer.',
 'Deux monstres rapprochés s’éliminent ; un ancien poids doit ensuite être remplacé.'
 ],changed:[
 'Carte originale de 20 × 20 cellules, trois héros, trois destinations et deux boutons de sortie simultanés.',
 'Le Marchand dispose d’un embarcadère initial séparé ; le Guerrier et le Voleur réorganisent ensuite une file de trois caisses.',
 'Un miroir mobile dessert une cour séparée et enseigne la priorité au candidat le plus proche.',
 'La plateforme SS conserve l’appui permanent après réactivation ; aucun faisceau, dragon, empilement ou duplication n’est repris.'
 ],sourceReading:'La construction de plusieurs appuis et les changements de côté reprennent Heroes and Water 3. Les deux presses, le dépôt inaccessible et le rapprochement des monstres adaptent Heroes and Light 1. Les coordonnées et la route sont nouvelles.',
 checkpoints:[checkpoint(platformLoaded,'Plateforme chargée avant retrait'),checkpoint(bridgeBuilt,'Trois investissements irréversibles ouvrent l’embarcadère')],
 checkScope:'Témoin gagnant entièrement rejoué. Les contrôles de nécessité géométrique et les contre-exemples locaux sont séparés dans validation/design-report.json ; aucun minimum global annoncé.'});
