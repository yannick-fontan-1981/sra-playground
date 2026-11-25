import {Author,board} from './author.mjs';
import {fileURLToPath} from 'node:url';
const b=board(20,20);b.fill(1,1,18,18,'~');
// A single heavy mirror services four isolated arrival balconies from three stations.
b.fill(2,12,4,18);b.put(3,11);b.fill(3,17,17,18);
b.fill(10,11,15,11);b.fill(10,11,11,17);b.fill(14,11,15,17);b.put(12,14);b.put(13,14);
for(const [x,y] of [[14,4],[15,4],[14,7],[15,7],[11,3],[10,3],[11,7],[10,7]])b.put(x,y);
for(const [x,y] of [[15,4],[15,7],[10,3],[10,7]])b.put(x,y,'g');
b.put(3,16,'M');b.put(4,17,'W');b.put(6,17,'Z');b.put(13,14,'T');
export const spec={id:'ss21-03',title:'Les quatre balcons',mode:'quartet',rows:b.strings(),mirrors:[{at:{x:12,y:14},facing:'NW'}]};
export function build(){const a=new Author(spec);
 a.select('thief').act('RRD').stage('Le Voleur tire le miroir jusqu’à la première station et quitte sa poignée de côté.');
 a.go(4,14,'merchant').act('XR').stage('Le Marchand atteint le balcon le plus haut et quitte l’axe de retour.');
 a.go(14,15,'warrior').act('UUU').stage('Le Guerrier remonte le miroir de trois cases, jusqu’à la station du deuxième balcon.');
 a.go(10,11,'wizard').act('XR').stage('Le Magicien gagne le balcon droit par reflet, sans cible permettant un échange préalable.');
 a.go(15,11,'warrior').act('LLL').stage('Le Guerrier gare le miroir dans la colonne intérieure avant son propre départ.');
 a.go(3,11,'warrior').act('XL').stage('Le troisième passager quitte le rayon ; le Voleur reste seul pour descendre le miroir.');
 a.go(11,12,'thief').act('DDD').stage('Le dernier déplacement se tire depuis le sud : aucune case de poussée ne se trouve au nord du miroir.');
 a.go(4,14,'thief').act('XL').stage('Le Voleur rejoint le quatrième balcon après avoir quitté le miroir sans le reprendre.');
 return a;}
export const source={label:'Adaptation · Heroes and Mirrors · énigme 32',url:'https://sinkingstarwalkthrough.com/fr/heroes-and-mirrors-solutions/#%C3%A9nigme-32',puzzle:32,objective:'Choisir les stations d’un miroir mobile et conserver le personnage capable d’effectuer son dernier déplacement.',secondaryUrl:'https://sinkingstarwalkthrough.com/fr/heroes-and-mirrors-solutions/#%C3%A9nigme-31',secondaryLabel:'Énigme 31 · position du miroir et diagonale de départ'};
export const adaptation={kind:'adaptation',preserved:['La position utile du miroir se détermine à partir de la destination et des cases de départ disponibles.','Un miroir placé trop tôt peut barrer la position nécessaire à sa prochaine manutention.','L’approche par l’autre côté et le parking final doivent se préparer avant le départ.'],changed:['Un seul miroir ordinaire dessert quatre balcons séparés ; il ne se casse pas et ne se transpose pas.','Le Guerrier remonte puis décale le miroir ; le Voleur doit rester disponible pour son déplacement vers le sud.','Les quatre balcons offrent une case de retrait hors du rayon, évitant de rappeler les premiers passagers.','Aucune caisse à consommer, aucun bouton, aucun monstre : l’eau dessine le rail de manutention et les départs possibles.'],sourceReading:'Les énigmes 31–32 motivent le choix d’une station et de la face d’approche ; le rail original à quatre stations et les quatre balcons sont une adaptation à M/W/T/Z. Le témoin n’est pas une preuve d’ordre unique.',localChecks:[]};
if(process.argv[1]===fileURLToPath(import.meta.url))build().save(new URL('../level3-design.json',import.meta.url),source,adaptation);
