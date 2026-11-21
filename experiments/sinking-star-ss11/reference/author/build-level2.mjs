import {Author,board} from './author.mjs';
const b=board(18,12,'~');
b.fill(5,1,9,9);b.put(2,6);b.put(2,7,'Z');b.put(10,2);b.fill(13,1,16,7);
for(const y of [2,4,6])for(const x of [5,7,9])b.put(x,y,'o');
b.put(6,8,'W');b.put(14,4,'o');
b.put(14,1,'g');b.put(16,1,'g');
const spec={id:'ss11-02',title:'Le damier des cargaisons',rows:b.strings(),facing:'E',
 circuits:[{id:'rive',buttons:[{x:2,y:6}],color:14}],
 gates:[{at:{x:10,y:2},circuit:'rive',direction:'E',closedWhen:'released'}]};
const a=new Author(spec);
a.select('wizard').act('UR').stage('Une caisse prend la place du Magicien sur son îlot-bouton.');
a.act('DDDRRRRUUR').stage('Les échanges dans le damier donnent accès à la cible de l’autre rive.');
a.act('RR').stage('La rive ne contient qu’un occupant : un second héros doit venir par un vrai pont.');
a.go(8,2,'warrior').act('RR').stage('Premier appui dans le chenal.');
a.go(6,2).act('RRRRR').stage('Le second appui permet une vraie traversée.');
a.go(14,1,'warrior').go(16,1,'wizard');
a.save(new URL('../level2-design.json',import.meta.url),{
 label:'Adaptation de Heroes of Hauling · énigme 11',
 url:'https://sinkingstarwalkthrough.com/fr/heroes-of-hauling-solutions/#%C3%A9nigme-11',puzzle:11,
 objective:'Extraire le Magicien du bouton, traverser le damier par échanges et construire les deux appuis pour le Guerrier.'
},{retained:'Grille de trois caisses par trois; bouton commandant la sortie; caisse de réception sur la rive opposée.',changed:'Le bouton devient un îlot isolé; deux héros et deux destinations. La rive d’arrivée ne contient qu’une caisse au départ : les échanges n’y amènent donc qu’un héros à la fois. Le Guerrier doit construire un vrai passage, avec deux appuis sur le trajet le plus court. Les caisses du damier gênent les lignes de visée et servent de réserves.'});
