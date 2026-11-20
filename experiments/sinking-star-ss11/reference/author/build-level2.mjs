import {Author,board} from './author.mjs';
const b=board(13,12);
b.fill(4,1,8,4);b.put(6,5);b.fill(1,6,11,10);
b.put(4,2,'W');b.put(6,8,'Z');b.put(3,8,'o');
b.put(2,10,'g');b.put(10,10,'g');
const spec={id:'ss11-02',title:'La relève du gardien',rows:b.strings(),facing:'E',
 circuits:[{id:'relais',buttons:[{x:6,y:2}],color:14}],
 gates:[{at:{x:6,y:5},circuit:'relais',direction:'S',closedWhen:'released'}]};
const a=new Author(spec);
a.go(6,2,'warrior').stage('Le Guerrier ouvre le passage en tenant le bouton.');
a.select('wizard').act('U').stage('Le Magicien prend sa place sans relâcher le bouton.');
a.go(2,8,'warrior').act('RRR').go(6,9).act('UUUUU').act('DDR');
a.stage('Le Guerrier présente la caisse juste sous le Magicien.');
a.select('wizard').act('D').stage('La caisse remplace le dernier gardien du bouton.');
a.go(2,10,'wizard').go(10,10,'warrior');
a.save(new URL('../level2-design.json',import.meta.url),{
 label:'Adaptation de Heroes of Hauling · énigme 13',
 url:'https://sinkingstarwalkthrough.com/fr/heroes-of-hauling-solutions/#%C3%A9nigme-13',puzzle:13,
 objective:'Relever le gardien du bouton, puis y installer une caisse pour libérer les deux héros.'
},{retained:'Deux salles séparées par une porte; échange du Guerrier et du Magicien sur le bouton qui maintient le passage.',changed:'La salle basse reçoit une caisse à remonter. Un second échange permet de libérer le Magicien; deux destinations communes au sud remplacent les sorties séparées de la capture.'});
