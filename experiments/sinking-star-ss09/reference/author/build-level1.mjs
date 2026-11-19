import {Author,board} from './author.mjs';
const b=board(20,16),{fill,put}=b;
fill(1,3,6,11);fill(7,2,12,11,'~');fill(13,2,18,6);fill(5,4,9,4);fill(7,5,7,7);
// Move the existing one-cell islet to the bottom of the basin. The original
// starting shore stays intact; there is no additional two-cell bank.
put(9,11);
put(2,9,'M');put(5,6,'B');put(5,8,'o');put(7,7,'o');put(17,3,'g');put(17,4,'g');
const spec={id:'ss09-01',title:'Le chantier des deux voix',rows:b.strings(),mirrors:[{at:{x:7,y:4},facing:'SE'}],circuits:[{id:'rose',color:7,buttons:[{x:3,y:10}]}],gates:[{at:{x:7,y:7},circuit:'rose',direction:'S',closedWhen:'pressed'}]};
const a=new Author(spec);
a.go(3,9,'merchant').act('D').stage('La presse plonge la première caisse et crée un appui.');
a.go(6,4).act('RR').stage('Le Marchand prépare la diagonale du miroir.').act('LL');
a.select('bard').act('DDD').stage('Le Barde descend la caisse et l’appui au fond du bassin ; le Marchand suit le chant.');
a.act('L').stage('Le chant décale la caisse vers la gauche mais la rive retient l’appui immergé : un membre bloqué reste en place.');
a.act('RR').stage('Le Barde ramène la caisse puis la décale avec l’appui vers le petit îlot.');
a.go(6,10,'merchant').act('U').stage('Le Marchand remonte le Barde d’une case sans déplacer la caisse ni l’appui.');
a.select('bard').act('LDR').stage('Le Barde reprend son élan : le petit îlot retient le premier appui, tandis que la seconde caisse complète le pont.');
a.go(4,9,'merchant');
a.select('bard').act('DDRRRX').stage('Le Barde traverse les deux appuis retenus par l’îlot d’une case puis active le miroir.').go(17,3);
a.go(9,11,'merchant').act('X').go(17,4).stage('Le Marchand traverse le même pont et les deux héros occupent les deux destinations.');
a.save(new URL('../level1-design.json',import.meta.url),{label:'Atelier original · préparer, chanter, pousser, refléter',url:'https://sinkingstarwalkthrough.com/fr/north/',piston:true,platform:false,objective:'Construire le passage avec les deux voix, puis envoyer les deux héros sur l’îlot.'},'Tutoriel original du duo. Le seul îlot d’une case est descendu de (9,8) à (9,11), tout en bas du bassin. Il retient les deux appuis alignés devant lui. Le bord du premier îlot retrouve exactement sa forme originale ; aucune butée supplémentaire n’est ajoutée. Les personnages, caisses, miroir, bouton, presse et destinations gardent leurs positions d’origine. Géométrie originale, aucun fac-similé revendiqué.');
