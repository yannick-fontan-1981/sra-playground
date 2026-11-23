import {Author,board} from './author.mjs';

// Three staggered galleries. Each yellow alcove has its own physical lock.
// The guard stays in a separated bay until a visible song delivers it to a press.
const b=board(20,20);
b.fill(2,2,17,6);b.fill(2,8,13,12);b.fill(2,14,17,17);
b.fill(2,7,3,7);b.fill(12,13,13,13);b.fill(14,11,14,12);
b.put(4,1);b.put(14,1);b.fill(15,9,17,9);b.put(15,10,'~');
for(const[x,y]of [[1,4],[18,4],[1,16]])b.put(x,y,'g');
for(const[x,y]of [[5,9],[6,10]])b.put(x,y,'#');
for(const[x,y]of [[6,12],[7,12]])b.put(x,y,'~');b.put(8,12,'s');
for(const[x,y]of [[4,2],[4,3],[14,1],[4,9],[6,9],[8,9],[5,12],[16,15]])b.put(x,y,'o');
b.put(4,4,'W');b.put(6,4,'Z');b.put(6,11,'B');b.put(16,9,'m');
const spec={id:'ss19-l1',title:'Les galeries des gardiens',rows:b.strings(),facing:'N',
 mirrors:[{at:{x:13,y:3},facing:'NW'}],
 circuits:[
  {id:'charge',color:10,buttons:[{x:4,y:1},{x:16,y:16}]},
  {id:'optique',color:15,buttons:[{x:14,y:1}]},
  {id:'chœur',color:6,buttons:[{x:9,y:9},{x:11,y:9}]},
  {id:'capture',color:14,buttons:[{x:13,y:12}]},
 ],
 gates:[
  {at:{x:2,y:4},circuit:'charge',direction:'W',closedWhen:'released'},
  {at:{x:17,y:4},circuit:'optique',direction:'E',closedWhen:'pressed'},
  {at:{x:2,y:16},circuit:'chœur',direction:'W',closedWhen:'released'},
  {at:{x:15,y:9},circuit:'capture',direction:'S',closedWhen:'pressed'},
 ]};
const a=new Author(spec);
a.act('U').stage('Une seule poussée avance les deux caisses. Le monstre reste dans sa baie : les pas des héros ne le déplacent pas.');
a.go(5,4).act('R').stage('Le Magicien poussé ne lance aucun sort. Les monstres restent en place sans déplacement imposé.');
a.go(12,3).act('R').go(12,4).stage('Le miroir rejoint son poste ; ses deux axes se déplacent avec lui.');
a.go(10,3,'wizard').act('RX').stage('Le rayon dévié échange le Magicien avec le poids violet ; le reflet fait ensuite sortir le Magicien sans marcher.');
a.act('D');
a.go(9,3,'warrior').act('RRX').stage('La caisse rapprochée devient prioritaire et remonte sur le bouton par reflet.');
a.go(12,3,'wizard').act('R').stage('La transposition relève le poids de la commande sans interrompre son occupation.');
a.go(12,2,'warrior').act('D').go(11,2);
a.select('wizard').act('D').go(15,2).stage('Le Magicien libère enfin la commande violette ; la porte de l’alcôve droite reste ouverte.');
a.select('bard').act('RR').stage('Le chant passe à travers la cloison. Une caisse est retenue, une autre suit en diagonale, et la troisième devient puis déplace un appui.');
a.go(7,12,'warrior');
a.select('bard').act('R').stage('Le Guerrier ancre le premier appui et suit le chant sur le suivant ; une caisse atteint le bouton magenta.');
a.select('warrior').act('R');
a.go(14,11,'wizard').act('L').stage('Le Magicien dépose la Barde près de la baie par échange, sans chanter.');
a.select('bard').act('L').stage('Le carré pointillé contient le monstre : le chant le décale sur la presse verte ouverte.');
a.select('wizard').act('R').stage('Le Magicien extrait la Barde sans reprendre le monstre avec son chant.');
a.act('D').stage('La commande verte ferme la presse : le monstre tombe dans l’eau. Le geste et son effet sont visibles.');
a.go(13,11).act('L').stage('Le Magicien extrait le Barde sans chant ; le poids magenta reste sur sa commande.');
a.go(12,11,'warrior').act('R').stage('Le Guerrier prolonge l’extraction : le Barde sort de la portée du dernier poids sans le chanter.');
a.go(16,14,'warrior').act('D').stage('La seconde charge cyan rejoint sa place. L’alcôve ouest devient accessible.');
a.go(1,4).stage('Le Guerrier rejoint son alcôve : les deux autres héros continuent à agir.');
a.go(18,4,'wizard').stage('Le Magicien rejoint l’alcôve optique après avoir laissé sa commande libre.');
a.go(1,16,'bard').stage('Le Barde gagne la galerie basse sans déplacer le poids resté derrière la cloison.');
a.save(new URL('../level1-design.json',import.meta.url),{
 label:'Adaptation de Heroes 2: Monsters · énigmes 14 et 15',
 url:'https://sinkingstarwalkthrough.com/fr/heroes-2-monsters-solutions/',puzzle:'14, 15',
 secondaryLabel:'Heroes and Water · 27–28 · appuis et départ sans chant',
 secondaryUrl:'https://sinkingstarwalkthrough.com/fr/heroes-and-water-solutions/',
 objective:'Apprendre les trois pouvoirs, livrer un monstre au chant sur une presse, puis résoudre les trois verrous des galeries.',
 },{
 kind:'adaptation',
 preserved:['Préparer le placement d’un monstre et manipuler les occupants avec les capacités des héros (Heroes 2, 14 et 15).','Recaler et ancrer les appuis avec la Barde ; quitter un cortège par déplacement imposé (Water, 27–28).','Déplacer une pièce par reflet et viser au travers d’un miroir (Mirrors, 1 et 30).'],
 changed:['Plan original en trois galeries décalées ; aucune grille ni séquence de la source n’est reproduite.','Les monstres n’ont aucun déplacement autonome. Le chant livre le gardien sur une presse ouverte, puis sa fermeture le pousse vers l’eau.','La presse et l’eau remplacent le cristal offensif de Heroes 2.','Le tutoriel montre aussi des interactions facultatives ; les découvertes n’ajoutent aucune condition cachée à la victoire.'],
 sourceReading:'Les guides motivent les interactions ; la géométrie, les trois verrouillages, la livraison par chant et le parcours pédagogique sont propres à SS19. La poursuite de la source n’est pas reproduite.',
 });
