import {Author,board} from './author.mjs';
const b=board(20,16),{fill,put}=b;
fill(1,3,6,11);fill(7,2,12,11,'~');fill(13,2,18,6);fill(5,4,9,4);fill(7,5,7,7);put(9,8);
// Bottom bank: two adjacent ground cells stop the submerged pair from sliding
// farther south, without extending to the mirror's launch column at x = 9.
fill(7,11,8,11);
// Keep that bank two water cells away from the starting shore. Otherwise it
// becomes a free launch pad for a mirror left at x = 7 or x = 8.
put(6,10,'~');put(6,11,'~');put(5,11,'~');
put(2,9,'M');put(5,6,'B');put(5,8,'o');put(7,7,'o');put(17,3,'g');put(17,4,'g');
const spec={id:'ss09-01',title:'Le chantier des deux voix',rows:b.strings(),mirrors:[{at:{x:7,y:4},facing:'SE'}],circuits:[{id:'rose',color:7,buttons:[{x:3,y:10}]}],gates:[{at:{x:7,y:7},circuit:'rose',direction:'S',closedWhen:'pressed'}]};
const a=new Author(spec);
a.go(3,9,'merchant').act('D').stage('La presse plonge la première caisse et crée un appui.');
a.go(6,4).act('RR').stage('Le Marchand prépare la diagonale du miroir.').act('LL');
a.select('bard').act('RR').stage('Le chant entraîne le Marchand, déplace un appui et complète le pont ; le sol retient le premier appui.');
a.select('merchant').go(7,5).act('DD').stage('Le Marchand pousse le Barde sur le pont sans déclencher le chant.').go(4,7);
a.select('bard').act('RRX').stage('Le Barde traverse le pont puis le miroir.').go(17,3);
a.select('merchant').go(9,8).act('X').go(17,4).stage('Les deux héros occupent les deux destinations.');
a.save(new URL('../level1-design.json',import.meta.url),{label:'Atelier original · préparer, chanter, pousser, refléter',url:'https://sinkingstarwalkthrough.com/fr/north/',piston:true,platform:false,objective:'Construire le passage avec les deux voix, puis envoyer les deux héros sur l’îlot.'},'Tutoriel original du duo. Les principes du chant du Nord sont combinés à un miroir mobile et une presse. Une butée de sol de deux cases au fond de l’eau retient les deux caisses immergées. Trois cases du coin de la rive sont retirées afin de maintenir deux cases d’eau entre la rive et cette butée : elle ne donne pas un accès à pied gratuit aux axes du miroir. Géométrie originale, aucun fac-similé revendiqué.');
