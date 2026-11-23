import {Author,board} from './author.mjs';
const b=board(20,20);
b.fill(2,2,5,4);b.put(6,3);b.fill(7,2,10,16);b.fill(5,14,6,15);
b.fill(11,2,13,16,'~');b.fill(14,2,18,16);
b.put(12,5,'m');b.put(13,5,'#');b.put(13,6,'#');b.put(11,13,'s');
b.put(2,3,'W');b.put(8,6,'B');b.put(17,5,'Z');b.put(3,3,'o');b.put(4,3,'o');
b.put(5,15,'g');b.put(16,15,'g');b.put(18,13,'g');
const spec={id:'ss19-04',title:'Le gardien de la vanne',rows:b.strings(),
 circuits:[{id:'gardien',buttons:[{x:12,y:5}],color:12},{id:'trappe',buttons:[{x:17,y:5}],color:15}],
 gates:[{at:{x:6,y:3},circuit:'gardien',direction:'W',closedWhen:'released'},{at:{x:16,y:15},circuit:'gardien',direction:'N',closedWhen:'pressed'}],
 platforms:[{at:{x:12,y:6},circuit:'trappe',activeWhen:'pressed'}]
};
const a=new Author(spec);
a.act('RRRRR').stage('Les deux charges quittent ensemble la réserve, pendant que le gardien tient encore son bouton.');
a.go(10,9).stage('Le Guerrier descend assez bas pour attirer le gardien sur la trappe maintenue par le Magicien.');
if(a.state.monsters.length!==1||a.state.monsters[0].x!==12||a.state.monsters[0].y!==6)throw Error('Hunter must wait on hatch.');
a.select('wizard').act('U').stage('Le Magicien quitte la commande : le soutien disparaît avant le prochain pas de chasse.');
if(a.state.monsters.length)throw Error('Hatch must drown hunter.');
a.go(10,15,'bard').act('UU').stage('La Barde remonte l’appui immergé jusqu’à la rangée du futur pont.');
a.go(7,15);
a.go(8,2,'warrior').act('DDDDDDDD');
a.go(7,11).act('RRRR').stage('La première caisse traverse l’appui préparé et devient le deuxième pilier.');
a.go(9,2).act('DDDDDDDD');
a.go(8,11).act('RRRR').stage('La deuxième caisse franchit les deux premiers appuis avant de combler le dernier intervalle.');
a.go(9,11,'bard');
a.go(8,11,'warrior').act('RRRRR').stage('Le Guerrier pousse la Barde jusqu’à la rive : aucun chant ne déplace le pont sous leur passage.');
a.go(17,11,'wizard').act('LL').stage('Deux échanges successifs extraient la Barde, puis font passer le Guerrier pendant que le Magicien récupère le pont.');
a.go(5,15);
a.go(16,15,'bard');
a.go(18,13,'warrior').stage('Le dernier héros rejoint la troisième destination ; le chantier a consommé exactement les deux réserves.');
a.save(new URL('../level4-design.json',import.meta.url),{
 label:'Adaptation · Heroes and Water · énigmes 12 et 28',url:'https://sinkingstarwalkthrough.com/fr/heroes-and-water-solutions/#%C3%A9nigme-12',puzzle:12,
 secondaryUrl:'https://sinkingstarwalkthrough.com/fr/heroes-2-monsters-solutions/#%C3%A9nigme-14',secondaryLabel:'Heroes 2 · attirer le monstre sur une ligne préparée',
 objective:'Sortir les réserves avant la chasse, attirer le gardien sur un soutien escamotable, puis reconstruire une traversée sans que le chant retire ses appuis.'
},{kind:'adaptation',preserved:['Un ennemi déplacé sur un soutien temporaire tombe lorsque la commande est relâchée (Water 12).','Un déplacement imposé permet à la Barde de franchir une arrivée sans déplacer l’appui qu’elle contrôlerait en marchant (Water 28).','Le placement du héros attire un monstre vers la position préparée (Heroes 2, 14).'],changed:['Le gardien est un chasseur SS19 ; son axe dominant et la priorité verticale sont les règles explicites de cet épisode.','Le monstre ouvre d’abord une réserve à deux caisses ; le détour de chasse condamne cette réserve avant le chantier.','Un appui persistant est déplacé par chant, puis deux caisses construisent les deux autres cellules du pont.','Trois destinations réparties sur les deux rives exigent un transfert net de héros. Aucun dragon, feu ou protection du Clerc n’est repris.'],sourceReading:'Le plan du bassin, le calendrier de la réserve et les positions des trois héros sont originaux. La noyade est démontrée dans le témoin ; les limites des audits de variantes sont précisées séparément.'});
