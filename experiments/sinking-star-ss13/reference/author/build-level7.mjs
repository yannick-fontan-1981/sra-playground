import {Author,board} from './author.mjs';
const {put,fill,strings}=board(20,20,'~');
fill(2,13,11,18);put(5,16,'T');put(3,15,'Z');put(9,16,'o');
fill(2,6,11,11);put(9,12,'#');
fill(2,1,11,4);put(9,3,'o');put(3,2,'g');put(10,2,'g');
const spec={id:'ss13-07',title:'Les deux diagonales de l’ancre',rows:strings(),facing:'W',
 mirrors:[{at:{x:6,y:16},facing:'NE'}]};
const a=new Author(spec);
a.act('L').stage('Le Voleur décale le miroir: la diagonale de la première caisse aboutit au premier trou');
a.act('X').stage('Le premier reflet immerge une caisse et crée l’appui vers l’île intermédiaire');
a.go(5,15).act('UUUUUUU').stage('Le Voleur transporte le même miroir à travers le passage qu’il vient de construire');
a.act('L').stage('Le Voleur quitte le faisceau proche pour laisser la caisse lointaine devenir la prochaine cible');
a.go(9,9,'wizard').act('U').stage('Depuis la rive intermédiaire, le Magicien échange la caisse de la dernière île sur la nouvelle ligne du miroir');
a.go(3,2).stage('Le Magicien reste sur la dernière rive pendant que son partenaire prépare un passage physique');
a.select('thief').act('X').stage('Le second reflet immerge la caisse transportée par échange et complète le deuxième appui');
a.go(10,2).stage('Le Voleur franchit les deux trous désormais comblés et rejoint la deuxième destination');
a.save(new URL('../level7-design.json',import.meta.url),{
 puzzle:6,label:'Adaptation de Heroes and Mirrors · énigme 6 · déplacer la diagonale pour combler les trous',
 url:'https://sinkingstarwalkthrough.com/fr/heroes-and-mirrors-solutions/#%C3%A9nigme-6',
 objective:'Déplacer le même miroir pour créer deux appuis successifs; le premier passage permet de préparer un échange avec la caisse de la dernière île.',
 piston:false,platform:false,
},'Heroes and Mirrors 6 fournit la relation entre position du miroir, diagonale du cristal et trou à combler, ainsi que le réemploi du miroir entre plusieurs étapes. SS13 réarrange cette idée en trois rives: la première caisse crée le passage qui permet au Voleur de tracter le miroir jusqu’au deuxième poste. Un échange du Magicien depuis la rive intermédiaire prépare ensuite la seconde caisse. Le mur coupe cette visée depuis la rive de départ; la dernière traversée doit augmenter physiquement le nombre de héros sur la rive finale. La géométrie est originale et aucun dédoublement n’est utilisé.');
