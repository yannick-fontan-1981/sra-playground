import {Author,board} from './author.mjs';
import {circuitPressed} from '../../dist/core.js';

const b=board(20,20);
// Three visible, separately operated presses deliver the weight to a fourth cell.
// The rail is beyond both the singer and every unobstructed Wizard ray.
b.fill(11,3,14,3);
b.put(14,3,'m');
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
 circuits:[{id:'seuil',buttons:[{x:11,y:3},{x:3,y:10}],color:15},
  {id:'poussee-1',buttons:[{x:10,y:6}],color:11},
  {id:'poussee-2',buttons:[{x:11,y:6}],color:14},
  {id:'poussee-3',buttons:[{x:12,y:6}],color:12}],
 gates:[
  {at:{x:14,y:3},circuit:'poussee-1',direction:'W',closedWhen:'pressed'},
  {at:{x:13,y:3},circuit:'poussee-2',direction:'W',closedWhen:'pressed'},
  {at:{x:12,y:3},circuit:'poussee-3',direction:'W',closedWhen:'pressed'},
  {at:{x:9,y:15},circuit:'seuil',direction:'N',closedWhen:'released'},
  {at:{x:15,y:15},circuit:'seuil',direction:'N',closedWhen:'released'},
  {at:{x:17,y:10},circuit:'seuil',direction:'W',closedWhen:'released'}
 ]
};
const a=new Author(spec);
a.go(9,6).act('R').stage('La commande jaune ferme la première presse : le gardien avance de 14,3 à 13,3.');
a.act('R').stage('La commande verte ferme la deuxième presse et livre le gardien en 12,3.');
a.act('R').stage('La commande orange actionne la dernière presse : le gardien arrive sur le bouton violet en 11,3.');
if(!circuitPressed(a.world,a.state,'seuil'))throw Error('The three presses must deliver the guardian onto its separate arrival plate.');
a.select('bard').act('LDDD').stage('Le gardien reste sur son bouton. Quatre pas chantés retirent la réserve du coude aveugle.');
a.go(15,10,'warrior').act('LLLLLL').stage('Le Guerrier amène la caisse dans la visée du Magicien et s’arrête avant l’eau.');
a.select('wizard').act('R').stage('La caisse remplace le Magicien sur la commande de l’îlot : les deux poids permanents maintiennent les sorties ouvertes.');
a.go(17,10).stage('Le Magicien occupe la sortie est.');
a.go(9,15,'warrior').stage('Le Guerrier rejoint la sortie sud-ouest.');
a.go(15,15,'bard').stage('Le Barde ferme la marche : les deux poids restent en place pendant les trois arrivées.');
const source={
 label:'Adaptation · Heroes 2: Monsters · énigmes 15 et 22',
 url:'https://sinkingstarwalkthrough.com/fr/heroes-2-monsters-solutions/#%C3%A9nigme-15',puzzle:15,
 objective:'Livrer un monstre par trois presses orientées, puis remplacer le Magicien par une caisse sur un îlot de commande.',
 secondaryLabel:'Heroes and Light · énigme 1 · presses orientées',
 secondaryUrl:'https://sinkingstarwalkthrough.com/fr/heroes-and-light-solutions/#%C3%A9nigme-1'
};
const adaptation={kind:'adaptation',
 preserved:['Un monstre et une caisse servent de poids pour libérer les sorties (Heroes 2, 15 et 22).','La transposition remplace un occupant sur sa commande.','Des presses poussent depuis des côtés inaccessibles aux héros (Heroes and Light, 1).'],
 changed:['Le rail court comporte trois presses de couleurs distinctes et un bouton d’arrivée sur une quatrième case : aucune porte ne fait aussi office de bouton.','Chaque monstre reste immobile tant qu’une force visible ne le déplace. Aucun déplacement automatique ne dépend de la sélection ou du placement d’un héros.','La réserve sort du coude aveugle par le chant, puis le Guerrier l’aligne avec le Magicien.','Les trois destinations sont des portes du même accord de deux commandes ; le rail, l’îlot, la géométrie et le trajet sont propres à SS19.'],
 sourceReading:'Heroes 2 fournit la conservation des monstres et des caisses comme poids. Light 1 fournit le déplacement imposé par une presse. Cette carte originale combine ces mécanismes, sans reprendre un plateau commercial.',
 localChecks:[
  {name:'Deux poids indispensables',observed:'À la victoire, les trois héros occupent les trois destinations distinctes des commandes du seuil. Seuls la caisse et le gardien peuvent tenir les deux boutons ; perdre l’un rend cet accord impossible.',scope:'Conservation des occupants, indépendante du témoin.'},
  {name:'Trois commandes explicites',observed:'Les boutons jaune, vert et orange ferment respectivement les presses en 14,3, 13,3 et 12,3. Le gardien arrive sur le bouton violet distinct en 11,3.',scope:'Correspondance spatiale et circuits déclarés.'},
  {name:'Sorties sous accord',observed:'Chaque destination est fermée tant que l’un des deux boutons violets est libre ; une fermeture expulse l’occupant avant la victoire.',scope:'Condition spatiale, sans quota caché.'}
 ]
};
a.save(new URL('../level2-design.json',import.meta.url),source,adaptation);
