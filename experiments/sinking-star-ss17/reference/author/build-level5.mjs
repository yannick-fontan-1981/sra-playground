import {Author,board} from './author.mjs';
const b=board(20,20);
b.fill(1,1,8,5);b.fill(7,6,8,16);b.put(8,8,'#');
b.put(5,6);b.put(6,6);b.fill(6,12,6,13);b.fill(1,7,5,11);// The reserve is reached only through its northern gate.
b.fill(9,4,10,4,'~');b.fill(11,1,18,15);b.fill(9,12,10,12,'~');
b.put(9,7,'~');b.fill(13,16,13,18);b.fill(14,18,18,18);
b.put(1,11,'W');b.put(3,3,'T');b.put(8,7,'Z');
b.put(5,1,'o');b.put(2,7,'o');b.put(4,7,'o');b.put(12,4,'m');b.put(8,4,'2');
b.put(14,18,'g');b.put(16,18,'g');b.put(18,18,'g');
const spec={id:'ss17-05',title:'La relève à angle droit',rows:b.strings(),circuits:[
 {id:'expulsion',buttons:[{x:3,y:3}],color:12},
 {id:'reserve',buttons:[{x:5,y:3}],color:14},
 {id:'ecluse',buttons:[{x:12,y:4}],color:10},
 {id:'lest',buttons:[{x:6,y:4},{x:15,y:12}],color:15}
],gates:[
 {at:{x:8,y:7},circuit:'expulsion',direction:'E',closedWhen:'released'},
 {at:{x:5,y:6},circuit:'reserve',direction:'S',closedWhen:'released'},
 {at:{x:13,y:16},circuit:'ecluse',direction:'N',closedWhen:'pressed'},
 {at:{x:13,y:17},circuit:'lest',direction:'N',closedWhen:'released'}
],platforms:[9,10].map(x=>({at:{x,y:12},circuit:'ecluse',activeWhen:'pressed'}))};
const a=new Author(spec);
a.select('wizard').act('U').stage('Le rayon remonte jusqu’à la face blanche du miroir, tourne à droite et échange le Magicien avec le gardien. La commande cyan reste occupée, mais le monstre attend maintenant dans la presse.');
a.select('thief').act('L').stage('Le Voleur quitte la commande orange : la presse latérale expulse le gardien dans l’eau. La case de destination du rayon avait été préparée avant la relève.');
a.go(5,2,'thief').act('DD').act('L').stage('Le Voleur extrait la clef du mur nord et la dépose sur la commande verte. La réserve s’ouvre sans immobiliser un héros.');
a.go(2,8,'thief').act('DD').act('R').go(4,8).act('DD').act('R').go(3,4).stage('Les deux charges de pont sont sorties de leurs alcôves : elles doivent encore franchir le même sas et changer d’axe.');
a.go(1,9,'warrior').act('RR').go(5,10).act('UUUU').go(4,5).act('RR').go(7,4).act('DDDDDDD').go(6,12).act('RRR').stage('Le Guerrier réunit les charges, fait passer la première par le sas, change deux fois son axe et la pose sur la plateforme éloignée.');
a.go(3,9,'warrior').act('R').go(5,10).act('UUUU').go(4,5).act('RR').go(7,4).act('DDDDDDD').go(6,12).act('RR').stage('La seconde charge emprunte le sas puis rejoint la plateforme proche. Aucun héros ne doit rester sur les deux cases au retrait.');
a.select('wizard').act('U').stage('Le Magicien libère l’ancienne commande du gardien : les deux caisses deviennent des appuis fixes et le premier verrou final s’ouvre.');
a.go(7,4,'thief').act('LLD').act('R').stage('Le miroir est tiré sur le premier bouton violet, puis la clef verte est extraite : la réserve vide se referme. Le miroir a changé de fonction.');
a.go(5,3,'warrior').act('D').go(4,5).act('RR').go(7,4).act('DDDDDDD').go(6,12).act('RRRRRRRR').act('U').stage('La clef de réserve devient le second lest, sur l’autre rive. Les deux commandes violettes sont occupées et l’écluse doit rester libérée.');
a.go(18,18,'wizard').go(16,18,'warrior').go(14,18,'thief').stage('Les trois héros rejoignent les destinations après avoir changé un monstre en cible, deux caisses en pont, un miroir et une clef en lests.');
a.save(new URL('../level5-design.json',import.meta.url),{label:'Adaptation de Heroes and Water · Métamonde 4 et énigme 12',url:'https://sinkingstarwalkthrough.com/fr/heroes-and-water-solutions/',puzzle:'Métamonde 4 / 12',objective:'Remplacer un gardien sur son bouton sans rompre le soutien, préparer sa cellule de réception, convertir une réserve en pont et réemployer le miroir et la clef comme lests finaux.'},{kind:'adaptation',preserved:['La relève par échange maintient le poids sur une commande éloignée.','Le retrait d’un soutien hydraulique convertit les blocs restés dessus en appuis de traversée.','Un échange seul conserve le nombre d’occupants de chaque rive ; un transfert supplémentaire est nécessaire. Le témoin utilise un pont, une variante utilise des reflets.'],changed:['Le dragon est remplacé par un monstre vulnérable à une presse latérale qui le pousse dans l’eau.','Le rayon du Magicien est dévié par un miroir mobile, récupéré ensuite en lest.','Une clef extraite ouvre la réserve de deux charges puis devient le lest de la rive opposée.','La sortie exige simultanément deux poids et le retrait des plateformes ; coordonnées et topologie entièrement nouvelles.'],sourceReading:'Composition originale de principes de Water Métamonde 4 (échanges avec gardiens de boutons), Water 12 (retrait hydraulique) et Water 11 (conservation des occupants). Le témoin illustre une chaîne de dépendances ; aucun minimum ni ordre unique n’est revendiqué.'});
