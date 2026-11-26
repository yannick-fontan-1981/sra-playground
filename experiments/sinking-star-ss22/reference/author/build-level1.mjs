import {Author,board} from './author.mjs';

// A low workshop, a northern loading bay and an optical annex. The final room
// is reached from the upper west rather than through a row of exit corridors.
const b=board(20,20);
b.fill(1,10,10,18);b.fill(1,9,5,9);b.fill(6,1,10,7);
b.fill(7,7,7,10);b.fill(9,4,9,10);b.put(8,9,'.');
b.fill(1,1,4,4);b.fill(4,4,6,4);
b.fill(12,1,18,18);b.fill(12,12,18,12,'~');b.fill(10,9,11,9,'~');
for(const [x,y]of [[3,10],[6,11],[14,8]])b.put(x,y,'#');
for(const [x,y,c]of [[2,13,'M'],[3,13,'o'],[2,16,'W'],[3,16,'o'],[4,16,'o'],[5,16,'T'],[3,11,'B'],[1,9,'o'],[3,9,'o'],[5,11,'o'],[8,9,'1'],[9,4,'o'],[16,17,'o'],[17,3,'m'],[18,5,'m'],[1,1,'g'],[2,1,'g'],[1,2,'g'],[2,2,'g']])b.put(x,y,c);
const spec={id:'ss22-01',title:'L’école des cortèges',mode:'quartet',rows:b.strings(),circuits:[
 {id:'atelier',buttons:[{x:6,y:13}],color:9},
 {id:'rencontre',buttons:[{x:14,y:7}],color:15},
 {id:'sortie',buttons:[{x:7,y:16},{x:16,y:16}],color:12}
],gates:[
 {at:{x:7,y:8},circuit:'atelier',direction:'N',closedWhen:'released'},
 {at:{x:9,y:8},circuit:'atelier',direction:'N',closedWhen:'released'},
 {at:{x:18,y:3},circuit:'rencontre',direction:'S',closedWhen:'pressed'},
 {at:{x:5,y:4},circuit:'sortie',direction:'W',closedWhen:'released'}
]};
const a=new Author(spec);
a.act('RRR').stage('Le Marchand dépose une seule caisse sur la commande bleue.');
a.select('warrior').act('R').stage('Le Guerrier pousse deux caisses et le Voleur dans une même file.');
a.select('thief').act('R').stage('La traction sépare la caisse voisine de la seconde.');
a.go(7,17,'merchant').act('U').stage('Le Marchand remplace le Voleur sur une commande sans perdre son poids.');
a.go(4,12,'warrior');
a.select('bard').act('R').stage('Le chant passe la cloison, atteint son coin diagonal et laisse une caisse sur sa butée.');
a.go(4,12,'thief').act('D').stage('Le Voleur retire le Barde sans faire repartir les charges.');
a.go(3,12,'warrior').act('RRR').stage('Le Guerrier replace le Barde sans chanter ni déplacer la commande bleue.');
a.go(7,9,'merchant').act('RX').stage('Le miroir est décalé puis livre une caisse dans l’annexe orientale.');
a.go(9,6,'thief').act('X').go(14,10).act('DR').go(16,10).stage('Le Voleur rejoint une arrivée plus proche et extrait la caisse sous son auvent.');
a.go(9,6,'merchant').act('X').go(14,9).act('DD').go(14,10).stage('Le Marchand transforme la caisse en appui dans le bassin.');
a.go(7,13,'warrior').act('UUUUU');
a.select('bard').act('RRUX').stage('Le Barde quitte l’atelier par reflet ; ses charges restent derrière lui.');
a.select('bard').act('UUURRRUR').stage('Depuis le coin de sa portée, le Barde place un seul gardien sur la presse.');
a.go(14,6,'thief').act('D').stage('La presse rapproche les gardiens ; le contact les élimine à distance du groupe.').go(12,3);
a.go(14,12,'merchant');
a.go(16,10,'bard').act('U').stage('Le héros sur l’appui le maintient pendant le chant, puis rejoint le sol voisin.');
a.go(12,10,'merchant');
a.go(15,10,'bard').act('R').stage('L’appui vide glisse d’une case dans l’eau.');
a.go(15,12,'merchant');
a.select('bard').act('U').stage('Le passager est déplacé séparément, tandis que l’appui occupé reste ancré.');
a.go(14,16,'merchant');
a.go(15,10,'bard').act('DDDUUU').stage('Le Barde peut emprunter le passage : son arrivée ancre aussi l’appui.');
a.select('bard').act('ULLLXLLLUUUU').stage('Le Barde rejoint le quartier des sorties par reflet.');
a.go(16,18,'merchant').act('U').go(12,9).act('X').go(10,2).stage('La caisse du sud maintient la commande de l’annexe après le départ du Marchand.');
a.go(12,9,'thief').act('X').go(10,4);
a.go(5,16,'warrior').act('R').stage('La dernière caisse de l’atelier complète les deux poids de sortie.');
a.go(1,1,'bard');a.go(2,1,'merchant');a.go(1,2,'thief');a.go(2,2,'warrior').stage('Les quatre destinations sont occupées ensemble.');
a.save(new URL('../level1-design.json',import.meta.url),{
 label:'Atelier original · Heroes 3: Bard, Druid · énigmes 12 et 14',
 url:'https://sinkingstarwalkthrough.com/fr/heroes-3-bard-druid-solutions/',puzzle:'12 et 14',
 objective:'Comparer les quatre capacités, préparer les chargements et faire circuler le groupe entre l’atelier, l’annexe et la salle commune.',
 secondary:{label:'Low Heroes · énigme 11 · replacer le Barde par poussée',url:'https://sinkingstarwalkthrough.com/fr/low-heroes-solutions/'}
},{kind:'original-teaching-adaptation',preserved:[
 'Le Barde guide des charges par sa position et peut être déplacé par un partenaire pour quitter son cortège.',
 'La coopération avec le Guerrier distingue un pas chanté d’une poussée imposée.'
],changed:[
 'Atelier original à quatre rôles : file mixte, extraction, relais de poids, portée à travers une cloison et butée sélective.',
 'Une annexe optique contient un auvent d’extraction, un bassin et deux gardiens rapprochés par une presse.',
 'L’appui vide glisse d’eau en eau ; son occupation et l’arrivée du Barde le maintiennent. Aucun empilement ni transport d’un passager avec son appui.',
 'Les deux commandes permanentes ouvrent une salle commune à quatre destinations, au nord-ouest. Les exercices supplémentaires enrichissent la découverte sans constituer une condition cachée de victoire.'
],sourceReading:'Principes de coopération adaptés au contrat SRA ; les cartes et la séquence pédagogique sont originales.',localChecks:[
 {name:'Sortie fermée au départ',observed:'La salle commune est séparée par la porte du circuit sortie ; les deux boutons sont initialement libres.',scope:'État initial et accès physique.'},
 {name:'Transport imposé distinct du chant',observed:'Le Voleur puis le Guerrier déplacent le Barde et conservent les charges restées sur place.',scope:'Étapes concrètes du témoin, pas ordre unique.'}
]});

