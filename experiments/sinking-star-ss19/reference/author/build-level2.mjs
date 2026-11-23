import {Author,board} from './author.mjs';
import {circuitPressed} from '../../dist/core.js';

const b=board(20,20);
// The hunter can be steered from the lower gallery, but neither songs nor
// rays can reach it through the two solid wall rows.
b.fill(5,3,15,3);
b.put(15,3,'m');
b.fill(6,6,13,6);
b.put(8,7);
b.fill(8,8,16,14);
// A blind elbow: no hero can stand to the right or above the reserve.
b.put(14,7);b.put(15,7,'o');b.put(15,8,'#');
// A distant operating island, separated by four cells of unsupported water.
b.fill(2,9,3,11);b.fill(4,10,7,10,'~');
b.put(6,6,'W');b.put(3,10,'Z');b.put(13,9,'B');
for(const [x,y] of [[9,15],[15,15],[17,10]])b.put(x,y,'g');
const spec={id:'ss19-02',title:'Le gardien du seuil',rows:b.strings(),facing:'E',
 circuits:[{id:'seuil',buttons:[{x:11,y:3},{x:3,y:10}],color:15}],
 gates:[
  {at:{x:9,y:15},circuit:'seuil',direction:'N',closedWhen:'released'},
  {at:{x:15,y:15},circuit:'seuil',direction:'N',closedWhen:'released'},
  {at:{x:17,y:10},circuit:'seuil',direction:'W',closedWhen:'released'}
 ]
};
const a=new Author(spec);
a.act('RLRR').stage('Quatre pas dans la galerie attirent le gardien sur la commande intermédiaire.');
if(!circuitPressed(a.world,a.state,'seuil'))throw Error('The hunter should hold the non-endpoint plate.');
a.select('bard').act('LDDD').stage('Changer de héros fixe la cible au sud : le mur bloque la chasse. Le chant retire la réserve du coude aveugle.');
a.go(15,10,'warrior').act('LLLLLL').stage('Le Guerrier amène la caisse dans la visée du Magicien, sans quitter le cône qui immobilise le gardien.');
a.select('wizard').act('R').stage('La caisse remplace le Magicien sur la commande de l’îlot ; sa nouvelle position garde le monstre immobile.');
a.go(17,10).stage('Le Magicien occupe la sortie est.');
a.go(9,15,'warrior').stage('Le Guerrier rejoint la sortie sud-ouest.');
a.go(15,15,'bard').stage('Le Barde ferme la marche : les deux poids restent en place pendant les trois arrivées.');
const source={
 label:'Adaptation · Heroes 2: Monsters · énigmes 15 et 22',
 url:'https://sinkingstarwalkthrough.com/fr/heroes-2-monsters-solutions/#%C3%A9nigme-15',
 puzzle:15,
 objective:'Conserver un monstre comme poids, changer sa cible pour le bloquer, puis remplacer le Magicien par une caisse sur un îlot de commande.',
 secondaryLabel:'Heroes 2: Monsters · énigme 22 · conserver les monstres sur des commandes',
 secondaryUrl:'https://sinkingstarwalkthrough.com/fr/heroes-2-monsters-solutions/#%C3%A9nigme-22'
};
const adaptation={kind:'adaptation',
 preserved:['Un monstre et une caisse servent de poids pour libérer les sorties.','La transposition dépose une pièce sur une commande sans laisser la case vide.'],
 changed:['Le gardien est isolé dans un rail horizontal, derrière deux rangées de murs qui interdisent le chant et les visées.','La poursuite déterministe de SS19 dépend du héros sélectionné, de sa position après l’action et de l’axe dominant ; ces détails ne sont pas attribués au guide.','La réserve sort d’un coude aveugle par le chant, puis le Guerrier l’aligne avec le Magicien.','Les trois destinations sont sur des presses liées au même accord de deux commandes.','La carte, les coordonnées, le rail, l’îlot et le trajet sont propres à SS19.'],
 sourceReading:'Heroes2 15 associe la transposition d’un monstre puis d’un cristal aux plaques. Heroes2 22 utilise les monstres comme poids à conserver. SS19 adapte cette logique avec un seul gardien mobile, une caisse unique, un relais de sélection et un îlot de commande.',
 localChecks:[
  {name:'Caisse indispensable',observed:'À la victoire, les trois héros occupent les trois destinations, distinctes des commandes. Il ne reste que la caisse et le gardien pour les deux commandes. Immerger ou perdre la caisse rend cet accord final impossible.',scope:'Argument de conservation des occupants, indépendant du témoin.'},
  {name:'Gardien sur une commande intérieure du rail',observed:'La commande x11 ne se trouve ni à x5 ni à x15, les deux extrémités. Les murs verticaux n’arrêtent le gardien que si le héros actif est dans le cône vertical.',scope:'Géométrie du rail et règle de poursuite du moteur.'},
  {name:'Aucune sortie accessible sans accord',observed:'Chaque destination est la case d’une presse fermée tant que l’une des deux commandes est libre ; les héros ne peuvent pas contourner la condition en restant derrière une porte.',scope:'Condition de victoire spatiale, sans verrou caché.'}
 ]
};
a.save(new URL('../level2-design.json',import.meta.url),source,adaptation);
