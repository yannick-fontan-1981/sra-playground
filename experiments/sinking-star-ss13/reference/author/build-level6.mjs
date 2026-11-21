import {Author,board} from './author.mjs';
const {put,fill,strings}=board(20,14,'~');
fill(1,1,9,10);put(6,5,'T');put(5,5,'o');put(2,2,'Z');
put(10,5);put(11,5);put(11,4,'#');put(11,6,'#');put(12,6);
fill(13,4,18,11);put(17,11,'o');put(15,9,'m');put(14,9,'#');put(15,8,'#');put(15,10,'#');put(16,8,'#');put(16,10,'#');
fill(16,1,18,2);put(17,1,'g');put(18,2,'g');
const spec={id:'ss13-06',title:'La presse délivre le tireur',rows:strings(),facing:'E',
 circuits:[
  {id:'chargement',buttons:[{x:4,y:9}],color:0},
  {id:'premiere-caisse',buttons:[{x:11,y:5}],color:10},
  {id:'depot',buttons:[{x:14,y:6}],color:15},
  {id:'derniere-caisse',buttons:[{x:16,y:9}],color:14},
 ],
 gates:[
  {at:{x:10,y:5},circuit:'chargement',direction:'E',closedWhen:'pressed'},
  {at:{x:17,y:9},circuit:'depot',direction:'W',closedWhen:'pressed'},
 ],
 platforms:[
  {at:{x:12,y:5},circuit:'chargement',activeWhen:'pressed'},
  ...[{x:10,y:8},{x:11,y:8},{x:12,y:8}].map(at=>({at,circuit:'premiere-caisse',activeWhen:'pressed'})),
  {at:{x:17,y:3},circuit:'derniere-caisse',activeWhen:'pressed'},
 ]};
const a=new Author(spec);
a.act('RRRRR').stage('Le Voleur charge la première presse; son prochain pas serait dans une plateforme inactive');
a.go(4,8,'wizard').act('D').stage('La presse déplace la caisse et le Voleur: la commande active aussi l’appui sous son arrivée forcée');
a.select('thief').act('D').stage('Le Voleur quitte latéralement son appui et laisse la caisse sur la commande');
a.go(17,10).act('UU').stage('Le Voleur charge la deuxième presse devant une commande enclavée');
a.act('R').stage('Le Voleur se décroche de la deuxième caisse avant le dépôt');
a.go(14,5,'wizard').act('D').stage('La deuxième presse livre le poids dans l’alcôve gardée et ouvre l’ultime passerelle');
a.go(17,1).stage('Le Magicien rejoint la terrasse finale');
a.go(18,2,'thief').stage('Le Voleur rejoint le Magicien en laissant les deux caisses sur leurs commandes');
a.save(new URL('../level6-design.json',import.meta.url),{
 puzzle:1,label:'Adaptation de Heroes and Light · énigmes 1 et 2 · déposer contre un mur par presse',
 url:'https://sinkingstarwalkthrough.com/fr/heroes-and-light-solutions/#%C3%A9nigme-1',
 secondaryLabel:'Heroes and Light · énigme 2 · commande distante et cargaison',
 secondaryUrl:'https://sinkingstarwalkthrough.com/fr/heroes-and-light-solutions/#%C3%A9nigme-2',
 piston:true,platform:true,
 objective:'Charger deux presses, extraire le Voleur sans traction et déposer le dernier poids dans une alcôve gardée que la traction ne peut remplir.',
},'Heroes and Light 1 fournit le dépôt par presse sur un bouton contre un mur et le déplacement forcé du Voleur sans traction. Heroes and Light 2 fournit la commande tenue depuis une autre région pendant le transport de cargaison. La première presse pousse ici une file caisse–Voleur; la commande distante active aussi l’appui sous l’arrivée forcée du héros après stabilisation hydraulique. La seconde commande est bordée de deux murs et d’un monstre enclavé: un héros ne peut s’y installer vivant pour remplacer la presse par un échange direct. Les deux rives, la passerelle finale et cette cascade hydraulique sont propres à SS13; aucun dragon ou pouvoir absent du duo n’est importé.');
