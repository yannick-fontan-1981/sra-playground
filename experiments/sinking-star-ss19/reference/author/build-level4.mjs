import {Author,board} from './author.mjs';
const b=board(20,20);
b.fill(2,2,5,4);b.put(6,3);b.fill(7,2,10,16);b.fill(5,14,6,15);
b.fill(11,2,13,16,'~');b.fill(14,2,18,16);
b.put(12,5,'m');b.put(13,5,'#');b.put(13,6,'#');b.put(11,6,'#');b.put(12,7,'#');b.put(11,13,'s');
b.put(8,4,'#');b.put(9,4,'#');
b.put(2,3,'W');b.put(10,5,'B');b.put(17,5,'Z');b.put(3,3,'o');b.put(4,3,'o');
b.put(5,15,'g');b.put(16,15,'g');b.put(18,13,'g');
const spec={id:'ss19-04',title:'Le gardien de la vanne',rows:b.strings(),
 circuits:[{id:'gardien',buttons:[{x:12,y:5}],color:12},{id:'trappe',buttons:[{x:17,y:5}],color:15}],
 gates:[{at:{x:6,y:3},circuit:'gardien',direction:'W',closedWhen:'released'},{at:{x:16,y:15},circuit:'gardien',direction:'N',closedWhen:'pressed'}],
 platforms:[{at:{x:12,y:6},circuit:'trappe',activeWhen:'pressed'}]
};
const a=new Author(spec);
a.act('RRRRR').stage('Les deux charges quittent ensemble la réserve, pendant que le gardien tient encore son bouton.');
a.select('bard').act('D').stage('Le chant du Barde pousse le gardien vers le sud sur la trappe maintenue par le Magicien.');
if(a.state.monsters.length!==1||a.state.monsters[0].x!==12||a.state.monsters[0].y!==6)throw Error('Guardian must wait on hatch.');
a.select('wizard').act('U').stage('Le Magicien quitte la commande violette : la trappe disparaît et le gardien tombe sur place.');
if(a.state.monsters.length)throw Error('Hatch must drown guardian.');
a.go(10,15,'bard').act('UU').stage('La Barde remonte l’appui immergé jusqu’à la rangée du futur pont.');
a.go(7,15);
a.select('warrior').act('R');
a.go(10,2).act('DDDDDDDD');
a.go(9,11).act('RR').stage('La première caisse traverse l’appui préparé et devient le deuxième pilier.');
a.go(8,3).act('R');
a.go(10,2).act('DDDDDDDD');
a.go(9,11).act('RRR').stage('La deuxième caisse franchit les deux premiers appuis avant de combler le dernier intervalle.');
a.go(9,11,'bard');
a.go(8,11,'warrior').act('RRRRR').stage('Le Guerrier pousse la Barde jusqu’à la rive : aucun chant ne déplace le pont sous leur passage.');
a.go(17,11,'wizard').act('LL').stage('Deux échanges successifs extraient la Barde, puis font passer le Guerrier pendant que le Magicien récupère le pont.');
a.go(5,15);
a.go(16,15,'bard');
a.go(18,13,'warrior').stage('Le dernier héros rejoint la troisième destination ; le chantier a consommé exactement les deux réserves.');
a.save(new URL('../level4-design.json',import.meta.url),{
 label:'Adaptation · Heroes and Water · énigmes 12 et 28',url:'https://sinkingstarwalkthrough.com/fr/heroes-and-water-solutions/#%C3%A9nigme-12',puzzle:12,
 secondaryUrl:'https://sinkingstarwalkthrough.com/fr/heroes-3-bard-druid-solutions/#%C3%A9nigme-14',secondaryLabel:'Heroes 3 · déplacer les gardiens par le chant',
 objective:'Sortir les réserves, déposer le gardien sur une trappe par le chant, retirer son soutien puis construire une traversée à trois appuis.'
},{kind:'adaptation',preserved:['Un ennemi déplacé sur un soutien temporaire tombe lorsque la commande est relâchée (Water 12).','Un déplacement imposé permet à la Barde de franchir une arrivée sans déplacer l’appui qu’elle contrôlerait en marchant (Water 28).','Le chant déplace les monstres depuis une case voisine sans exiger un contact dangereux (Heroes 3, 14).'],changed:['Le gardien ne se déplace que sous une force visible : le chant le fait descendre sur la trappe, puis le retrait du soutien le noie.','Le monstre ouvre d’abord une réserve à deux caisses ; son déplacement ferme la réserve et libère la destination orange. Le bouton orange occupé maintient cette destination fermée, tandis que le bouton violet occupé maintient la trappe.','Les butées de la réserve imposent un transfert de chaque caisse vers la colonne de descente ; un appui persistant est déplacé par chant, puis les deux caisses complètent le pont.','Trois destinations réparties sur les deux rives exigent un transfert net de héros. Aucun dragon, feu ou protection du Clerc n’est repris.'],sourceReading:'Le plan du bassin, le calendrier de la réserve et les positions des trois héros sont originaux. Le témoin dépose le gardien sur la trappe puis retire son soutien ; relâcher la trappe avant le chant permet aussi une noyade directe. Une traversée chantée du pont a également été rejouée jusqu’à la victoire. La poussée du Barde est un enseignement démontré, sans revendication de nécessité absolue.'});
