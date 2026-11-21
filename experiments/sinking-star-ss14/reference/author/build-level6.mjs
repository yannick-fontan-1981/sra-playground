import {Author,board} from './author.mjs';
import {replay} from '../../scripts/solver.mjs';
import {circuitPressed} from '../../dist/core.js';
const b=board(20,20);
b.fill(1,12,7,18);b.fill(6,5,6,11);b.put(7,6,'~');
b.fill(8,3,10,9);b.put(9,3,'#');b.put(10,4,'#');b.put(11,5);b.fill(11,6,13,6);b.put(13,7);b.fill(10,8,14,8);b.put(13,9,'~');b.put(14,9,'~');
b.fill(11,10,18,14);b.put(14,15);b.fill(11,16,18,18);
b.put(6,11,'T');b.put(2,16,'B');b.put(6,6,'o');b.put(13,8,'o');b.put(14,16,'m');b.put(17,16,'m');b.put(11,17,'g');b.put(18,17,'g');
const spec={id:'ss14-06',title:'Le passage des deux presses',rows:b.strings(),
 mirrors:[{at:{x:6,y:10},facing:'NE'}],
 circuits:[{id:'premiere-presse',buttons:[{x:3,y:14}],color:10},{id:'accord-presse',buttons:[{x:8,y:4},{x:9,y:4}],color:15},{id:'retour-sous-charge',buttons:[{x:8,y:3}],color:9},{id:'miroir-final',buttons:[{x:13,y:12}],color:11}],
 gates:[{at:{x:6,y:6},circuit:'premiere-presse',direction:'E',closedWhen:'pressed'},{at:{x:13,y:8},circuit:'accord-presse',direction:'S',closedWhen:'pressed'},{at:{x:13,y:7},circuit:'miroir-final',direction:'S',closedWhen:'released'},{at:{x:14,y:15},circuit:'miroir-final',direction:'S',closedWhen:'released'}],
 platforms:[{at:{x:14,y:9},circuit:'retour-sous-charge',activeWhen:'pressed'}]};
const a=new Author(spec);
a.act('DDDLLL').stage('Le Voleur retire le miroir du couloir et la première presse crée l’appui oriental');
a.act('L').stage('La commande est relâchée pour rouvrir l’emplacement de la presse');
a.go(8,5,'bard').stage('Le Barde traverse vers la salle des deux commandes, sans décaler l’appui');
a.go(6,12,'thief').act('UUUUUUU').stage('Le Voleur ramène le miroir au coude, après la réouverture de la première presse');
a.act('XRRRR').stage('Le reflet place le Voleur devant la charge pour la tracter à travers l’eau');
a.go(9,4).stage('Le Voleur occupe la commande retenue par la butée nord');
a.select('bard').act('U').stage('Les deux commandes ferment la seconde presse : la caisse devient un nouvel appui');
a.select('thief').act('D');
a.select('bard').act('U').stage('Les partenaires libèrent les commandes violettes ; le Barde prend le bouton bleu distinct et déploie le quai');
a.go(10,7,'thief').act('DD').go(10,7).act('XRRR').stage('Le second reflet change l’axe de traction ; le Barde maintient le quai depuis sa commande bleue');
a.act('DLDDDD').stage('Le Voleur traverse le quai maintenu par le Barde, puis installe le miroir sur la commande finale');
a.go(13,6,'bard').act('DDDDLDDDD').stage('Le Barde retire le quai une fois le Voleur en sécurité, puis descend dans l’axe de l’appui conservé entre ses rives');
a.act('RR').stage('Le Barde déplace seulement le gardien proche et les deux attaques simultanées dégagent le passage');
a.act('DDD').go(18,17).stage('Le Barde atteint sa destination après avoir libéré la porte des gardiens');
a.go(11,17,'thief').stage('Le Voleur rejoint la seconde destination pendant que le miroir maintient les portes ouvertes');
function checkLocal(turn,alternative,expected,effect){
 const r=replay(spec,a.commands.slice(0,turn)+alternative);
 const observed={refusals:r.metrics.blocked,dead:r.state.dead,deadHeroes:r.state.heroes.filter(h=>h.dead).map(h=>h.kind),mirrors:r.state.mirrors.length,supports:r.state.supports,platformActive:r.state.platformActive??[],...Object.fromEntries(a.world.circuits.map(c=>[c.id,circuitPressed(a.world,r.state,c.id)]))};
 for(const [key,value]of Object.entries(expected))if(JSON.stringify(observed[key])!==JSON.stringify(value))throw Error(`Local check changed at ${turn} + ${alternative}: ${key}`);
 return{turn,alternative,effect,observed};
}
const localChecks=[
 checkLocal(36,"D",{"refusals": 1, "mirrors": 1},"Au premier coude, tenter de traverser le miroir est refusé ; le reflet place le Voleur sur l’appui créé par la presse."),
 checkLocal(67,"CD",{"refusals": 0, "dead": true, "deadHeroes": ["thief"], "retour-sous-charge": false, "platformActive": [false]},"Si le Barde quitte le bouton bleu alors que le Voleur attend sur le quai, le retrait de la plateforme noie le Voleur. Le Barde doit maintenir cette commande jusqu’à la traversée."),
 checkLocal(72,"CDDDDDRRRRRD",{"refusals": 1, "dead": false, "supports": [{"x": 7, "y": 6}, {"x": 14, "y": 9}]},"Une approche horizontale du Barde décale le second appui vers le quai latéral ; la descente directe qui suit est refusée. La descente ouverte dans l’axe conserve l’appui.")
];
a.save(new URL('../level6-design.json',import.meta.url),{
 puzzle:1,label:'Adaptation de Heroes and Light · énigme 1 · dépôts par presses orientées',
 url:'https://sinkingstarwalkthrough.com/fr/heroes-and-light-solutions/#%C3%A9nigme-1',
 secondaryLabel:'Heroes and Light · énigme 41 · butée, commande et départ forcé',
 secondaryUrl:'https://sinkingstarwalkthrough.com/fr/heroes-and-light-solutions/#%C3%A9nigme-41',
 objective:'Créer les traversées par les presses, maintenir le quai avec le Barde et conduire le miroir sans emporter les appuis.'
},{kind:'adaptation',preserved:['Les presses déposent une caisse dans une direction inaccessible à la traction directe du Voleur.','Une commande est activée puis relâchée avant d’emprunter la case de la presse.','Une butée conserve un partenaire sur sa commande pendant le dernier pas du chanteur.'],changed:['Deux caisses deviennent des appuis permanents et un miroir doit franchir les deux traversées.','Le Voleur utilise le reflet du miroir qu’il transporte pour changer de côté avant chaque traction.','Le Barde maintient le quai temporaire depuis un bouton bleu distinct de la presse violette ; il ne quitte ce bouton qu’après la traversée du Voleur.','Le miroir ouvre ensuite une descente alignée sur l’appui pour le Barde, puis un chant sélectif rapproche les deux gardiens.'],sourceReading:'Light 1 fournit la logique du dépôt par presse et de sa réouverture. Light 41 inspire la butée qui corrige le placement et le départ forcé avant de reprendre la traction. Les deux ponts, la double commande violette, le bouton bleu séparé et la relève du Barde sur le quai temporaire sont une composition originale SS14, sans empilement ni double déplacement.',localChecks,checkScope:'Comparaisons locales du parcours auteur ; aucune preuve d’optimalité ou d’unicité globale.'});
