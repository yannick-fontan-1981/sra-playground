import {Author,board} from './author.mjs';
import {circuitPressed} from '../../dist/core.js';
const b=board(20,20);
// A sealed double weight cell, a visible collision neck and a narrow two-axis mill.
b.fill(3,6,3,16);b.fill(3,14,7,15);b.fill(7,9,18,16);
b.fill(5,8,5,12);b.put(5,10,'m');b.put(5,12,'o');
b.fill(9,4,9,9);b.put(9,7,'m');b.put(9,9,'m');
b.fill(10,1,10,4);b.put(11,1);b.put(11,2,'g');b.put(10,2,'o');
b.put(10,1,'W');b.put(16,10,'Z');b.put(3,11,'B');b.put(3,16,'g');b.put(9,13,'g');
const spec={id:'ss19-05',title:'Le troisième doit rester vivant',rows:b.strings(),
 circuits:[
  {id:'captif',buttons:[{x:5,y:8}],color:12},
  {id:'verrou',buttons:[{x:5,y:9}],color:14},
  {id:'presse-ouest',buttons:[{x:15,y:10}],color:15},
  {id:'presse-sud',buttons:[{x:15,y:13}],color:6},
  {id:'meule',buttons:[{x:9,y:12}],color:10}],
 gates:[
  {at:{x:9,y:13},circuit:'captif',direction:'E',closedWhen:'released'},
  {at:{x:10,y:3},circuit:'captif',direction:'N',closedWhen:'released'},
  {at:{x:3,y:16},circuit:'verrou',direction:'N',closedWhen:'released'},
  {at:{x:10,y:4},circuit:'presse-ouest',direction:'W',closedWhen:'pressed'},
  {at:{x:9,y:4},circuit:'presse-sud',direction:'S',closedWhen:'pressed'},
  {at:{x:9,y:6},circuit:'presse-sud',direction:'S',closedWhen:'released'},
  {at:{x:11,y:2},circuit:'meule',direction:'N',closedWhen:'released'}]
};
const a=new Author(spec);
a.select('bard').act('UUU').stage('Trois chants montent le captif sur le bouton orange et sa caisse sur le bouton vert : le chargement et deux destinations sont ouverts.');
if(!circuitPressed(a.world,a.state,'captif')||!circuitPressed(a.world,a.state,'verrou'))throw Error('Both captive weights must hold their separate plates.');
a.go(3,14,'wizard').act('U').stage('Le Magicien extrait le Barde de son pupitre par échange ; le gardien et son verrou restent en place.');
a.go(9,11,'bard').act('U').stage('Un chant vers le nord rapproche les deux monstres du couloir : ils se rencontrent et disparaissent ensemble.');
if(a.state.monsters.length!==1)throw Error('The pair must meet while the captive survives.');
a.select('warrior').act('DD').stage('Le Guerrier charge la caisse sur la presse violette.');
a.act('UUR');
a.go(15,11,'wizard').act('U').stage('La commande violette ferme la presse ouest : la caisse passe de 10,4 à 9,4.');
a.act('D');
a.go(15,14).act('U').stage('La commande rose ferme la presse sud et ouvre le volet de sortie : la caisse arrive en 9,5. Le Magicien reste sur la commande.');
a.go(9,7,'bard').act('DDDDDDD').stage('Sept pas chantés tirent la caisse le long du couloir ouvert jusqu’au bouton cyan en 9,12.');
if(!a.state.stones.some(p=>p.x===9&&p.y===12))throw Error('The freight must hold the final cyan plate.');
a.select('wizard').act('DRL').stage('Le Magicien libère sa commande, rejoint la ligne du Barde et échange leurs places : aucun chant de départ ne retire la caisse cyan.');
a.go(17,9);
a.go(3,16,'bard').stage('Le Barde rejoint la destination verte, maintenue par la caisse du captif.');
a.go(11,2,'warrior');
a.go(9,13,'wizard').stage('Les trois héros occupent leurs destinations ; le gardien, son verrou et la dernière caisse tiennent trois boutons distincts.');
a.save(new URL('../level5-design.json',import.meta.url),{
 label:'Adaptation · Heroes 3 · énigmes 13–14 et Heroes and Light · énigme 1',
 url:'https://sinkingstarwalkthrough.com/fr/heroes-3-bard-druid-solutions/#%C3%A9nigme-13',puzzle:13,
 secondaryUrl:'https://sinkingstarwalkthrough.com/fr/heroes-and-light-solutions/#%C3%A9nigme-1',secondaryLabel:'Heroes and Light · deux presses changent l’axe de livraison',
 objective:'Conserver un gardien et sa caisse comme poids distincts, provoquer une collision par chant, puis livrer la dernière caisse avec deux presses et une relève du Barde.'
},{kind:'adaptation',
 preserved:['Le chant rapproche une paire de gobelins jusqu’au contact (Heroes 3, 13).','Un gardien conservé sur un bouton remplace un héros au départ ; le Barde quitte son poste sans déplacer son poids (Heroes 3, 14).','Des presses atteignent les côtés de poussée inaccessibles aux héros et changent l’axe du transport (Light 1).'],
 changed:['Tous les monstres restent immobiles sans force visible : trois chants posent le captif, un chant provoque la rencontre de la paire.','Deux boutons voisins mais distincts donnent un rôle permanent au gardien orange et à sa caisse verte. La chambre scellée interdit leur remplacement par les héros.','Le volet rose ouvre pendant que la presse sud ferme ; il faut maintenir cette commande pendant la sortie de la caisse. La fermeture de la presse et l’ouverture du volet sont visibles dans le même circuit.','Le Barde tire ensuite la caisse vers le bouton cyan, puis un échange permet sa relève. Cette méthode est démontrée sans prétendre que le chant est l’unique transport possible après le moulin.','La destination orange jouxte la commande cyan : un monstre placé à la place de la caisse empêcherait son occupation sans perte.','Le couloir, le moulin et les trois postes sont une carte originale sans eau ni miroir.'],
 sourceReading:'Les références fournissent le contraste éliminer/conserver, le chant et les presses orientées. La géométrie, les circuits de livraison et les trois poids finaux sont propres à SS19 ; aucun mouvement autonome ni quota de combat n’est ajouté.',
 localChecks:[
  {name:'Trois ressources finales',observed:'Le témoin conserve le gardien en 5,8, la caisse du captif en 5,9 et la caisse du moulin en 9,12. Chacun maintient une destination distincte.',scope:'Rejeu et circuits déclarés ; les routes alternatives légales restent admises.'},
  {name:'Un monstre ne remplace pas la livraison finale',observed:'Un gardien sur le bouton cyan 9,12 tue tout héros sur la destination orange adjacente 9,13.',scope:'Règle de contact orthogonal, indépendante du témoin.'}
 ]
});
