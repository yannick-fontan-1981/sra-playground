import {Author,board} from './author.mjs';

// Three offset courts: handling yard, guard balcony and tidal workshop.
const b=board(20,20);
b.fill(1,4,8,17);b.fill(8,8,10,9);b.fill(10,2,18,7);
b.fill(12,9,18,17);b.fill(12,13,18,13,'~');b.put(11,9,'~');
b.fill(16,1,18,1,'g');b.put(16,2,'#');b.put(18,2,'#');
b.put(3,11,'#');b.put(5,11,'#');b.put(6,10,'#');
for(const [x,y,c]of [[7,5,'M'],[4,5,'T'],[3,5,'B'],[2,5,'o'],[1,12,'o'],[3,12,'o'],[5,10,'o'],[10,3,'o'],[9,9,'1'],[16,16,'o'],[15,3,'m'],[17,4,'m']])b.put(x,y,c);
const spec={id:'ss20-01',title:'L’atelier des marées',rows:b.strings(),
 circuits:[
  {id:'relay',buttons:[{x:5,y:5}],color:11},
  {id:'guard',buttons:[{x:13,y:7}],color:15},
  {id:'finish',buttons:[{x:4,y:14},{x:17,y:15}],color:12}
 ],gates:[
  {at:{x:9,y:8},circuit:'relay',direction:'E',closedWhen:'released'},
  {at:{x:16,y:3},circuit:'guard',direction:'S',closedWhen:'pressed'},
  {at:{x:17,y:2},circuit:'finish',direction:'N',closedWhen:'released'}
 ]};
const a=new Author(spec);
a.select('thief').act('R').stage('La traction ne prend que le partenaire voisin ; la caisse reste derrière.');
a.go(5,6,'merchant').act('U').stage('Le Marchand remplace le Voleur sur le bouton, sans libérer le circuit.');
a.select('bard').act('D').stage('Le chant accompagne les partenaires et la caisse dans la même direction.');
a.go(4,7,'thief').act('D');
a.go(1,6,'merchant').act('RRR').go(5,7).act('U').stage('Une caisse tient désormais le relais jaune.');
a.select('thief').act('D').go(3,8).act('L');
a.select('bard').act('DDR').stage('Le chant atteint les deux caisses derrière la cloison, jusque dans le coin diagonal ; une butée retient la troisième.');
a.go(4,9,'thief').act('U');
a.go(4,11,'merchant').act('DD').stage('Le premier poids orange est installé.');
a.go(3,9,'merchant').act('RRR');
a.select('bard').act('URRRURRURUR').stage('Un chant diagonal place le premier gardien sur la presse ouverte.');
a.go(8,8,'thief').act('LL').go(7,9).act('D').stage('Le Voleur dégage le colis que le chant a laissé dans la liaison.');
a.go(12,7,'thief').act('R').stage('Le bouton violet ferme la presse ; elle rapproche les deux gardiens qui disparaissent au contact.');
a.go(8,9,'merchant').act('R').act('X').stage('Le miroir déplacé envoie la caisse sur le quai isolé.');
a.go(10,7).act('X').go(14,10).stage('Le même miroir transporte le Marchand sans déclencher de poussée.');
a.go(10,7,'thief').act('X').go(16,10).act('DDR').stage('Le Voleur extrait la caisse qui arrive contre le mur.');
a.go(16,10,'merchant').act('DD').stage('La caisse devient un appui dans la coupure d’eau.');
a.go(10,7,'bard').act('X').go(14,11).act('L').stage('Le chant diagonal décale l’appui vers le milieu du bassin.');
a.go(15,13,'merchant');a.select('bard').act('U').stage('Un héros sur l’appui le maintient en place.');
a.go(15,16,'merchant').act('R').go(14,16);
a.go(15,13,'thief');a.go(15,10,'bard').act('DDDUUU').stage('Le Barde rejoint l’appui puis remonte ; l’arrivée sur l’appui est ancrée.');
a.select('bard').act('ULLLX').go(14,3);
a.go(17,17,'merchant').act('U').stage('Le poids du quai complète le circuit orange qui ouvre le balcon final.');
a.go(18,1,'bard');
a.go(12,9,'merchant').act('X').go(16,1);
a.go(12,9,'thief').act('X').go(17,1).stage('Les trois héros occupent ensemble les trois destinations.');
a.save(new URL('../level1-design.json',import.meta.url),{
 label:'Atelier original · Heroes 3: Bard, Druid · énigmes 12–14',
 url:'https://sinkingstarwalkthrough.com/fr/heroes-3-bard-druid-solutions/#%C3%A9nigme-13',puzzle:13,
 objective:'Faire circuler les trois héros et les charges entre les cours ; préparer le balcon avec deux poids et un passage dans l’eau.',
 secondary:{label:'Heroes of Hauling · énigmes 5 et 14 · traction et relève des poids',url:'https://sinkingstarwalkthrough.com/fr/heroes-of-hauling-solutions/#%C3%A9nigme-5'}
},{kind:'original-teaching-adaptation',preserved:[
 'Le chant déplace des caisses et prépare la rencontre de deux monstres (Heroes 3, 12–13).',
 'Un partenaire extrait le Barde sans entraîner son cortège (Heroes 3, 14).',
 'La traction se prépare depuis le côté opposé ; héros et caisses peuvent se relayer sur une commande (Heroes 1, 5 et 14).'
],changed:[
 'Trois cours décalées réunissent trente découvertes observées à partir des images publiques.',
 'Le chant agit dans un carré de cinq cases, à travers les cloisons ; les monstres ne se déplacent jamais spontanément.',
 'Une presse latérale achève le rapprochement des deux gardiens ; son bouton se trouve sur une case distincte.',
 'Une caisse est réfléchie contre un mur du quai : le Voleur doit l’extraire avant que le Marchand ne crée un appui, ensuite déplacé et ancré par le chant.',
 'Le terrain, les circuits, les miroirs, le bassin et les trois sorties sont propres à SS20. Les découvertes sont des aides, jamais une condition cachée de victoire.'
],sourceReading:'Adaptation de principes lus dans les guides numérotés, sans reproduction de carte ni prétention à restituer le jeu commercial.',localChecks:[
 {name:'Aucune sortie au départ',observed:'Le seul accès au balcon final est une porte fermée du circuit orange ; les deux commandes sont libres au départ.',scope:'Géométrie initiale et état des circuits.'},
 {name:'Trente apprentissages observables',observed:'Le témoin est rejoué par la session publique ; chaque découverte vient des pixels avant/après, sans lecture de la solution par le jeu.',scope:'Parcours pédagogique de qualification, pas quota de victoire.'}
]});
