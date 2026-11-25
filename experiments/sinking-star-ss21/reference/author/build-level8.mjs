import {writeFileSync} from 'node:fs';
import {Author,board} from './author.mjs';
const b=board(20,20);
// An isolated archive, two offset work yards and a destination court.
b.fill(1,1,6,4);b.put(7,4);b.put(7,5);b.put(8,5);
b.fill(1,7,6,17);b.put(7,12);
b.fill(8,6,14,17);for(const [x,y] of [[13,6],[14,6],[11,7],[12,8],[13,8],[14,8]])b.put(x,y,'#');
b.fill(16,14,18,18);b.put(15,16,'~');
for(const [x,y] of [[16,14],[18,14],[16,18],[18,18]])b.put(x,y,'g');
b.put(4,8,'M');b.put(1,14,'W');b.put(5,16,'T');b.put(5,3,'Z');
b.put(1,1,'o');b.put(2,14,'o');b.put(3,14,'o');b.put(12,7,'m');
export const spec={id:'ss21-08',title:'Le verrou à trois poids',mode:'quartet',rows:b.strings(),facing:'E',mirrors:[{at:{x:7,y:5},facing:'NE'}],circuits:[{id:'premiere',color:11,buttons:[{x:4,y:10}]},{id:'seconde',color:15,buttons:[{x:10,y:12}]},{id:'arrivee',color:14,buttons:[{x:14,y:7},{x:10,y:10},{x:12,y:14}]}],gates:[{at:{x:12,y:7},circuit:'premiere',direction:'E',closedWhen:'pressed'},{at:{x:7,y:12},circuit:'premiere',direction:'E',closedWhen:'pressed'},{at:{x:13,y:7},circuit:'seconde',direction:'E',closedWhen:'pressed'},{at:{x:16,y:16},circuit:'arrivee',direction:'E',closedWhen:'released'}]};
export function build(){const a=new Author(spec);
 a.select('thief').go(9,11);
 a.select('merchant').go(4,9).act('D');
 a.select('thief').go(10,11).act('D');
 a.select('merchant').go(4,9);
 a.select('thief').go(8,6);
 a.stage('Le Voleur passe avant la fermeture du passage de traverse. Les deux commandes déplacent ensuite le gardien, une case par presse, jusqu’à son bouton : il reste nécessaire comme troisième poids.');
 a.select('wizard').go(2,1).act('L').go(4,1).act('L').go(4,4).act('U').go(7,4).act('L').act('X');
 a.stage('Le Magicien décolle la réserve de l’archive, change son axe puis l’installe dans le port du miroir. Le reflet l’envoie contre la paroi du quai de réception.');
 a.select('thief').act('DDDDDDD').go(9,15);
 a.select('merchant').go(7,12).act('RRRR').go(12,11).act('DD');
 a.stage('Le Voleur extrait la livraison et la descend jusqu’à la traverse. Le Marchand la range sur la commande basse avant le retour du Magicien : la visée de sortie du quai doit être libre.');
 a.select('wizard').go(7,4).act('X').go(10,17);
 a.select('warrior').act('RR').go(5,15).act('UU').go(4,12).act('RRRRRRRRR').go(14,11).act('DDDD').go(13,16).act('R').go(13,15);
 a.stage('Le Guerrier décale la file entière, sépare sa tête et l’achemine autour du chantier. Cette caisse devient l’unique appui vers la cour encore vide des destinations.');
 a.select('merchant').go(4,15).act('UU').go(3,12).act('RRRRRR').go(10,13).act('UU');
 a.stage('La dernière caisse quitte le dépôt et maintient la commande haute. Deux caisses sèches et le gardien alimentent ensemble le verrou ; la troisième caisse porte le passage d’eau.');
 a.select('wizard').go(18,18);
 a.select('warrior').go(16,14);
 a.select('thief').go(18,14);
 a.select('merchant').go(16,18);
 return a.result({objective:'Conserver le gardien comme poids, extraire la réserve de l’archive puis répartir les trois caisses entre l’appui d’arrivée et les deux commandes sèches.',label:'Heroes and Light — énigmes 4 et 45',url:'https://sinkingstarwalkthrough.com/fr/heroes-and-light-solutions/',puzzles:[4,45]},'Light 4 inspire le gardien déplacé par des presses successives pour compléter deux poids secs. Light 45 fournit l’extraction d’une ressource adossée à une paroi par transport indirect. Ici, magie, miroir fixe et traction remplacent les faisceaux, dans une archive séparée de deux dépôts décalés ; une troisième caisse devient le passage vers quatre destinations.');}
if(process.argv[1]?.endsWith('build-level8.mjs')){const d=build();writeFileSync(new URL('../level8-design.json',import.meta.url),JSON.stringify(d,null,2)+'\n');console.log(JSON.stringify({title:spec.title,metrics:d.metrics,commands:d.commands}));}
