import {Author,board} from './author.mjs';
import {replay} from '../../scripts/solver.mjs';

const b=board(20,20);
// Two western workshops feed a double-water bridge; exchange alone cannot add
// another occupant to the eastern landing. The final courtyard is a third island.
b.fill(1,1,8,7);b.fill(2,10,8,17);b.fill(3,8,3,9);b.fill(3,9,6,9);
b.fill(9,4,10,4,'~');b.fill(11,1,13,5);b.put(12,6,'.');b.put(13,6,'~');
b.fill(14,6,18,14);b.fill(14,16,18,18);b.put(16,15,'.');
b.put(3,4,'W');b.put(4,4,'o');b.put(5,4,'o');
b.put(4,14,'T');b.put(2,14,'o');b.put(3,14,'o');b.put(12,2,'Z');
b.put(16,6,'o');b.put(14,10,'m');b.put(16,10,'m');
for(const x of [14,16,18])b.put(x,17,'g');
const spec={id:'ss17-01',title:'Les trois cours de la forteresse',rows:b.strings(),facing:'E',
 mirrors:[{at:{x:12,y:5},facing:'NE'}],
 circuits:[{id:'violet',color:15,buttons:[{x:5,y:10},{x:16,y:6}]}],
 gates:[{at:{x:14,y:10},circuit:'violet',direction:'E',closedWhen:'pressed'},
        {at:{x:16,y:15},circuit:'violet',direction:'N',closedWhen:'released'}]};
const a=new Author(spec);
a.act('RRRRRR').stage('Le Guerrier pousse la file : deux caisses deviennent deux appuis permanents.');
a.act('RR').go(11,3).stage('Le Guerrier traverse les appuis et libère le passage vers la deuxième cour.');
a.select('thief').act('RRU').stage('Le Voleur extrait seulement la caisse voisine ; la réserve reste contre le mur. Un départ latéral lâche la charge.');
a.go(5,13).act('UUUUL').stage('La caisse remplace un héros sur la plaque occidentale : la presse rapproche les deux gardiens, qui s’éliminent.');
const firstGate=a.commands.length;
a.go(12,4).stage('Le Voleur utilise le pont déjà construit pour rejoindre le relais optique.');
a.go(11,4,'warrior');
a.select('thief').act('RU').stage('Le Voleur tire son compagnon d’une case et le laisse en position de relais, sans provoquer sa poussée.');
a.go(11,4,'wizard').act('R').stage('Le Magicien échange avec le Guerrier ; chacun conserve son identité et son pouvoir.');
a.act('U').stage('Sans cible sur son axe, une flèche du Magicien produit un simple pas.');
a.go(12,4,'warrior').act('D').stage('Le Guerrier descend le miroir pour aligner sa face avec la caisse de la troisième cour.');
a.go(12,4,'wizard');
a.go(11,5,'warrior');
a.select('wizard').act('D').stage('La visée du Magicien tourne sur la face blanche : il prend la place de la caisse sur la plaque distante. Les deux poids restent présents.');
const bentExchange=a.commands.length;
a.act('X').stage('Le reflet global livre la caisse à la troisième cour, à distance égale sur l’autre bras du miroir.');
a.go(12,4,'warrior').act('X').go(14,8).stage('À distances égales, le Guerrier et la caisse s’échangent. Le Guerrier dégage ensuite la ligne.');
a.act('X').stage('Le reflet ramène le matériel dans la cour après le passage du Guerrier.');
a.go(12,4,'thief').act('XR').stage('Le Voleur traverse à son tour puis se place du bon côté pour reprendre la caisse.');
a.select('wizard').act('D').stage('Le Magicien quitte la plaque : la porte se referme. Il faut une relève permanente avant les trois sorties.');
const relayReleased=a.commands.length;
a.act('X').stage('La caisse revient devant le Voleur. Le reflet ne confère aucun pouvoir aux pièces transportées.');
a.select('thief').act('RRD').stage('Deux tractions ramènent la caisse sur la plaque distante ; le Voleur part de côté et laisse les deux boutons maintenus.');
const permanentRelay=a.commands.length;
a.go(14,17,'warrior');
a.go(18,17,'thief');
a.go(16,17,'wizard').stage('Les trois héros atteignent ensemble les destinations derrière la porte, après deux investissements dans le pont et deux relèves de plaques.');

function checkpoint(turn,label){const r=replay(spec,a.commands.slice(0,turn));return{label,turn,heroes:r.state.heroes,supports:r.state.supports,stones:r.state.stones,monsters:r.state.monsters,gateClosed:r.state.gateClosed};}
a.save(new URL('../level1-design.json',import.meta.url),{
 label:'Adaptation pédagogique · Heroes and Water 10–11, Hauling 13 et Heroes and Mirrors 30–31',
 url:'https://sinkingstarwalkthrough.com/fr/heroes-and-water-solutions/#%C3%A9nigme-11',puzzle:11,
 secondary:{label:'Heroes and Mirrors · énigmes 30–31 · visée et déplacement du miroir',url:'https://sinkingstarwalkthrough.com/fr/heroes-and-mirrors-solutions/#%C3%A9nigme-30',puzzle:30},
 objective:'Organiser les trois cours, régler le miroir et relever les boutons pour réunir le trio dans la chambre des destinations.'
},{kind:'adaptation',preserved:[
 'Un échange conserve le nombre d’occupants de chaque île ; la construction du pont permet un vrai transfert supplémentaire.',
 'La première cible alignée détermine l’échange du Magicien, y compris lorsque la face blanche dévie sa visée.',
 'Un échange entre deux cases occupées conserve les poids des plaques ; quitter ensuite une plaque exige une relève.',
 'Déplacer physiquement le miroir change les cases reliées par sa diagonale.'
 ],changed:[
 'Carte originale de trois cours, avec un trio Guerrier/Voleur/Magicien et trois destinations simultanées.',
 'Le Guerrier et le Voleur déplacent le miroir SS17 ; il ne peut pas être une cible de transposition.',
 'La double tranchée consomme deux caisses. La traction unique, la traction d’un partenaire et le départ latéral sont montrés avant la visée coudée.',
 'La même paire de boutons commande une presse latérale contre les deux gardiens et la porte de la chambre finale.',
 'Le reflet global et la visée du Magicien restent deux actions distinctes, sans duplication de héros ni pouvoirs déclenchés par un déplacement forcé.'
 ],sourceReading:'Water 10–11 inspire la priorité de la première cible et la conservation d’occupation ; Hauling 13 inspire la relève de plaque par échange ; Mirrors 30–31 inspire la visée coudée puis le déplacement du miroir pour régler les correspondances. Géométrie, circuit, destinations et route sont originaux.',
 references:[
 {label:'Heroes and Water · énigme 10',url:'https://sinkingstarwalkthrough.com/fr/heroes-and-water-solutions/#%C3%A9nigme-10'},
 {label:'The Hearty Heroes of Hauling · énigme 13',url:'https://sinkingstarwalkthrough.com/fr/heroes-of-hauling-solutions/#%C3%A9nigme-13'},
 {label:'Heroes and Mirrors · énigme 31',url:'https://sinkingstarwalkthrough.com/fr/heroes-and-mirrors-solutions/#%C3%A9nigme-31'}
 ],checkpoints:[checkpoint(firstGate,'Première ouverture et disparition simultanée des gardiens'),checkpoint(bentExchange,'Échange coudé conservant les deux poids'),checkpoint(relayReleased,'Plaque libérée et porte fermée'),checkpoint(permanentRelay,'Deux caisses maintiennent la porte finale')],
 checkScope:'Témoin gagnant intégralement rejoué sans refus ni mort. Cette route pédagogique n’est pas annoncée comme minimale. La nécessité d’une interaction avant les sorties est contrôlée séparément.'});
