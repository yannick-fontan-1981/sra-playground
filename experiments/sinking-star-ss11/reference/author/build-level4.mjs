import {Author,board} from './author.mjs';
const b=board(13,12);
b.fill(1,1,5,10);b.fill(6,1,6,10,'~');b.fill(7,2,11,8);
b.put(9,1,'g');b.put(10,9);b.put(10,10,'g');
b.put(2,5,'Z');b.put(2,9,'W');b.put(8,3,'m');b.put(8,8,'o');
const spec={id:'ss11-04',title:'Le poids du danger',rows:b.strings(),facing:'N',
 circuits:[{id:'gardien',buttons:[{x:2,y:3}],color:11},{id:'charge',buttons:[{x:2,y:8}],color:10}],
 gates:[{at:{x:9,y:2},circuit:'gardien',direction:'S',closedWhen:'released'},{at:{x:10,y:9},circuit:'charge',direction:'N',closedWhen:'released'}]};
const a=new Author(spec);
a.select('wizard').act('UUR').stage('Le monstre devient le poids du premier bouton, à distance des héros.');
a.act('D').stage('La caisse est extraite vers le haut par échange.');
a.go(2,8,'warrior');a.select('wizard').act('L').stage('L’échange des héros donne le chantier au Guerrier.');
a.go(8,2,'warrior').act('DDDDD').stage('La caisse rejoint la ligne du second bouton.');
a.select('wizard').act('R').stage('La caisse stabilise le second verrou.');
a.go(9,1,'warrior').go(10,10,'wizard');
a.save(new URL('../level4-design.json',import.meta.url),{
 label:'Adaptation de Heroes 2: Monsters · énigme 15',
 url:'https://sinkingstarwalkthrough.com/fr/heroes-2-monsters-solutions/#%C3%A9nigme-15',puzzle:15,
 objective:'Employer le monstre comme premier poids, puis faire relayer la caisse et les héros pour tenir le second bouton.'
},{retained:'Le Magicien échange un monstre sur un bouton puis une caisse sur un autre pour ouvrir les sorties.',changed:'Le monstre reste immobile et attaque seulement à distance orthogonale d’une case, selon la série Sinking Star. Un chenal et une caisse unique imposent la coopération avec le Guerrier; deux portes gardent deux destinations.'});
