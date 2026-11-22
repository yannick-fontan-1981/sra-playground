import {Author,board} from './author.mjs';

// A central octagonal court with short side balconies and three separated exits.
// This layout is original; its teaching route combines three different abilities.
const b=board(20,20);
b.fill(4,4,15,14);b.fill(5,3,14,3);b.fill(6,15,13,15);
b.fill(2,7,3,11);b.fill(16,7,17,11);
for(const [x,y] of [[5,9],[8,8],[11,8],[11,9]])b.put(x,y,'#');
for(const [x,y] of [[8,12],[9,12],[16,9]])b.put(x,y,'~');
b.put(10,12,'s');
for(const [x,y] of [[5,5],[12,3],[5,8],[7,8],[7,12],[14,13]])b.put(x,y,'o');
b.put(15,9,'m');b.put(5,6,'M');b.put(7,6,'Z');b.put(5,10,'B');
for(const [x,y] of [[4,3],[15,3],[10,16]])b.put(x,y,'.');
for(const [x,y] of [[3,3],[16,3],[10,17]])b.put(x,y,'g');
const spec={id:'ss18-l1',title:'Le jardin des trois issues',rows:b.strings(),facing:'N',mirrors:[{at:{x:11,y:5},facing:'NW'}],
 circuits:[
  {id:'atelier',color:10,buttons:[{x:5,y:4},{x:15,y:13}]},
  {id:'optique',color:15,buttons:[{x:12,y:3}]},
  {id:'releve',color:12,buttons:[{x:7,y:10},{x:11,y:10}]},
  {id:'presse',color:14,buttons:[{x:13,y:7}]},
 ],
 gates:[
  {at:{x:10,y:16},circuit:'atelier',direction:'S',closedWhen:'released'},
  {at:{x:15,y:3},circuit:'optique',direction:'E',closedWhen:'pressed'},
  {at:{x:4,y:3},circuit:'releve',direction:'W',closedWhen:'released'},
  {at:{x:15,y:9},circuit:'presse',direction:'E',closedWhen:'pressed'},
  {at:{x:14,y:13},circuit:'presse',direction:'E',closedWhen:'pressed'},
 ]};
const a=new Author(spec);
a.act('U').stage('Le Marchand pousse une seule caisse sur la première commande cyan ; l’issue sud attend encore son second poids.');
a.go(6,6).act('R').stage('Le Marchand pousse le Magicien d’une case sans déclencher sa visée.');
a.go(10,5).act('R').go(11,6).stage('Le Marchand avance le miroir vers sa station optique, puis quitte son rayon.');
a.go(8,5,'wizard').act('RX').stage('La visée déviée remplace la caisse sur son bouton. Le reflet global fait ensuite quitter ce bouton au Magicien.');
a.act('D');
a.go(7,5,'merchant').act('RRX').stage('Deux poussées rapprochent la caisse : le reflet choisit alors cette caisse, plus proche que le Marchand.');
a.go(10,5,'wizard').act('R').go(13,3).stage('Le Magicien récupère la station supérieure par échange, puis libère la commande violette.');
a.select('bard').act('RR').stage('Le chant traverse le pilier, retient une caisse contre sa butée et en déplace une autre en diagonale. Une caisse immergée devient un appui, puis glisse sur l’eau.');
a.go(9,12,'merchant');
a.go(11,10,'wizard');
a.select('bard').act('R').stage('Le Marchand ancre son appui de départ et suit le chant jusqu’au suivant.');
a.select('merchant').act('R');
a.select('bard').act('L');
a.select('wizard').act('L').stage('L’échange des partenaires maintient les deux commandes orange. Le Barde quitte son ancien cortège sans le déplacer.');
a.go(3,3,'merchant').stage('Pendant la relève, le Marchand gagne l’issue nord-ouest. Les deux autres sorties restent à rejoindre.');
a.go(13,8,'wizard').act('U').stage('La commande verte actionne deux presses latérales : le monstre tombe dans l’eau et une caisse rejoint le second bouton cyan.');
a.go(16,3).stage('Le Magicien gagne l’issue nord-est après avoir libéré sa commande violette.');
a.go(10,17,'bard').stage('Le Barde rejoint l’issue sud ; les trois destinations sont maintenant occupées simultanément.');
a.save(new URL('../level3-design.json',import.meta.url),{
 label:'Adaptation de Heroes 3: Bard, Druid · énigmes 12–13',
 url:'https://sinkingstarwalkthrough.com/fr/heroes-3-bard-druid-solutions/',
 puzzle:'12–13',
 secondaryLabel:'Heroes and Mirrors · énigmes 1 et 30 · départ sans chant et visée déviée',
 secondaryUrl:'https://sinkingstarwalkthrough.com/fr/heroes-and-mirrors-solutions/',
 objective:'Apprendre poussée unique, chant sélectif, échanges et reflets dans une cour à trois issues séparées ; construire, déplacer et ancrer un appui, puis maintenir une relève.',
 },{
 kind:'adaptation',
 preserved:['Le chant réarrange plusieurs caisses pour préparer un accès (Heroes 3, 12).','Un déplacement préparé permet de traiter le danger des monstres avant de rejoindre une issue (Heroes 3, 13).','Un départ forcé libère le Barde de son cortège (Mirrors 1), et la visée du Magicien peut tourner sur un miroir (Mirrors 30).'],
 changed:['Cour octogonale originale, avec deux balcons latéraux, quatre piliers et trois destinations séparées ; les butées précises sont une construction SS18.','Le Marchand déplace un seul occupant à la fois ; les appuis mobiles et leur ancrage suivent le contrat SS.','Deux presses latérales remplacent le combat guidé de la source par une élimination dans l’eau et la livraison d’un poids distant.','L’échange du Magicien remplace le reflet qui extrait le Barde dans Mirrors 1. Les découvertes pédagogiques ne verrouillent pas la victoire.'],
 sourceReading:'Les principes des énigmes Heroes 3 12–13 et Mirrors 1/30 ont été vérifiés dans les guides. Le détail de la position des trois cristaux de Heroes 3 12 est partiellement masqué dans sa source ; aucune grille ni suite de coups n’est prétendue reproduite. Atelier original : les objectifs sont des dispositifs visibles, le parcours enseigne aussi des usages facultatifs, et aucun minimum, ordre unique ou nécessité universelle de chaque démonstration n’est revendiqué.',
 });
