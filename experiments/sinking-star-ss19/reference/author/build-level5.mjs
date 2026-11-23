import {Author,board} from './author.mjs';
const b=board(20,20);
// Three distinct spaces: sealed singer's cell, narrow arena, two-axis press mill.
b.fill(3,6,3,16);b.fill(3,14,7,15);
b.fill(7,8,18,16);b.fill(16,5,16,7);
b.fill(5,8,5,12);b.put(5,10,'m');b.put(5,12,'o');
b.fill(8,6,12,6);b.put(8,5,'m');b.put(12,5,'m');b.put(9,7);b.put(10,5);
b.fill(9,2,11,4);b.put(10,3,'o');b.put(11,3,'g');
b.put(10,2,'W');b.put(16,6,'Z');b.put(3,11,'B');b.put(3,16,'g');b.put(17,15,'g');for(const x of [8,10,11])b.put(x,8,'#');
const spec={id:'ss19-05',title:'Le troisième doit rester vivant',rows:b.strings(),
 circuits:[
  {id:'captif',buttons:[{x:5,y:8}],color:12},
  {id:'presse-ouest',buttons:[{x:16,y:8}],color:15},
  {id:'presse-sud',buttons:[{x:16,y:12}],color:6},
  {id:'meule',buttons:[{x:9,y:12}],color:10}],
 gates:[
  {at:{x:17,y:15},circuit:'captif',direction:'N',closedWhen:'released'},
  {at:{x:10,y:4},circuit:'captif',direction:'N',closedWhen:'released'},
  {at:{x:8,y:6},circuit:'captif',direction:'N',closedWhen:'pressed'},
  {at:{x:11,y:6},circuit:'captif',direction:'E',closedWhen:'pressed'},
  {at:{x:9,y:4},circuit:'captif',direction:'N',closedWhen:'pressed'},
  {at:{x:11,y:4},circuit:'captif',direction:'N',closedWhen:'pressed'},
  {at:{x:10,y:6},circuit:'presse-ouest',direction:'W',closedWhen:'pressed'},
  {at:{x:9,y:6},circuit:'presse-sud',direction:'S',closedWhen:'pressed'},
  {at:{x:11,y:3},circuit:'meule',direction:'S',closedWhen:'released'}]
};
const a=new Author(spec);
a.go(10,11,'wizard').stage('Le Magicien descend pour amener les deux chasseurs dans la rangée de l’arène.');
a.act('RRRRRRU').stage('Le Magicien se décale à droite : la butée retient le premier chasseur et le second le rejoint.');
if(a.state.monsters.length!==1)throw Error(JSON.stringify(a.stages));
a.select('bard').act('UUU').stage('Le chant monte le dernier gardien sur son bouton puis le bloque avec la caisse ; la trappe de chargement ouvre, les accès latéraux ferment.');
if(!a.state.monsters.some(p=>p.x===5&&p.y===8)||!a.state.stones.some(p=>p.x===5&&p.y===9))throw Error('Bard must latch hunter.');
a.go(3,14,'wizard').act('U').stage('Le Magicien extrait la Barde de son étroit pupitre : aucun pas chanté ne déverrouille le captif.');
a.go(7,15,'bard');
a.go(10,15,'wizard');
a.go(3,16,'bard');
a.go(10,2,'warrior').act('DDD').stage('La caisse de la chambre haute arrive sur la première presse, au-dessus d’un mur infranchissable.');
a.go(10,4);
a.go(16,9,'wizard').act('U').stage('La presse violette dépose la caisse dans le coude occidental.');
a.act('R');
a.go(16,13).act('U').stage('La seconde presse transforme le transfert horizontal en livraison vers le sud.');
a.act('R');
a.go(9,6,'warrior').act('DDDDD').stage('Le Guerrier conduit la caisse sortie du moulin jusqu’à la commande cyan.');
a.go(11,3,'wizard');
a.go(17,15,'warrior').stage('La caisse commande la chambre haute ; le gardien vivant maintient la sortie orientale.');
a.save(new URL('../level5-design.json',import.meta.url),{
 label:'Adaptation · Heroes 3 · énigmes 13–14 et Heroes and Light · énigme 1',url:'https://sinkingstarwalkthrough.com/fr/heroes-3-bard-druid-solutions/#%C3%A9nigme-13',puzzle:13,
 secondaryUrl:'https://sinkingstarwalkthrough.com/fr/heroes-and-light-solutions/#%C3%A9nigme-1',secondaryLabel:'Heroes and Light · deux presses changent l’axe de livraison',
 objective:'Conserver un chasseur comme poids, éliminer la paire dangereuse, extraire la Barde sans rouvrir sa prison et charger deux presses perpendiculaires.'
},{kind:'adaptation',preserved:['Une paire de gobelins est rapprochée jusqu’au contact (Heroes 3, 13).','Un monstre conservé sur une plaque remplace un héros au moment du départ (Heroes 3, 14).','Des presses atteignent les côtés de poussée inaccessibles aux héros et changent l’axe de transport (Light 1).'],changed:['Les monstres poursuivent tous le héros actif selon la règle déterministe SS19.','Le captif ouvre le chargement mais condamne les côtés de manœuvre ; le Guerrier commence au-dessus de la réserve, la Barde ne peut pas remplacer les presses depuis le bas.','Le chant déplace à travers le mur le gardien et son verrou ; l’échange du Magicien permet de quitter le pupitre sans desserrer ce verrou.','Deux chasses se terminent en combat, tandis que le troisième monstre doit rester séparé des deux autres.','Le moulin, ses commandes distantes et les trois sorties sont une carte originale sans eau ni miroir.'],sourceReading:'Les références fournissent les contrastes éliminer/conserver et les presses orientées. La chasse, la prison à une entrée et le tracé du moulin sont propres à SS19 ; aucun plateau commercial n’est recopié.'});
