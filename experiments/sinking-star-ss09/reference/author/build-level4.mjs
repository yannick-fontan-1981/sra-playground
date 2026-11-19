import {Author,board} from './author.mjs';
const {put,fill,strings}=board(20,20,'~');
// Three separated starts/routes: the Bard's launch tile is not a spare bridge.
fill(3,15,6,17);put(3,16,'M');put(9,13,'B');
put(5,14,'o');put(4,14,'#');put(5,13,'#');
put(11,13);put(12,13);
// The press is loaded before play. The west wall forbids a manual east push;
// the eastern approach has no eastward step inside the Bard's singing range.
fill(7,11,7,14);put(8,11);fill(8,10,12,10);put(12,9);
// Monsters occupy the compulsory exit corridor, rather than an optional cage.
fill(7,7,13,9,'#');fill(8,8,12,8);put(12,9);put(8,8,'m');put(12,8,'m');
fill(9,1,9,7);put(8,1);put(8,6);put(8,7);
// The final mirror must be pushed north once to align its west-facing arrival.
fill(2,5,3,6);put(2,5,'g');put(3,6,'g');
const spec={id:'ss09-04',title:'Le contrechant du pont',rows:strings(),facing:'N',mirrors:[{at:{x:12,y:13},facing:'NW'},{at:{x:8,y:7},facing:'NW'}],circuits:[{id:'entry',buttons:[{x:3,y:17}],color:10},{id:'duel',buttons:[{x:8,y:8}],color:8}],gates:[{at:{x:11,y:13},circuit:'entry',direction:'E',closedWhen:'released'},{at:{x:5,y:14},circuit:'duel',direction:'E',closedWhen:'released'}]};
const a=new Author(spec);
a.go(3,17,'merchant').stage('Le Marchand maintient le seul passage optique de l’îlot isolé du Barde.');
a.select('bard').act('XLLL').stage('Le Barde rapproche les deux monstres du couloir : leur duel libère la presse et construit le pont.').go(9,7);
a.go(8,8,'merchant').act('U').stage('Le Marchand traverse le pont obligatoire puis pousse le miroir final au bon niveau.');
a.go(8,1,'bard').act('X').go(2,5).stage('Le Barde atteint la première destination et libère l’arrivée.');
a.go(8,1,'merchant').act('X').stage('Le Marchand rejoint la seconde destination.');
a.save(new URL('../level4-design.json',import.meta.url),{label:'Adaptation de Heroes 3: Bard, Druid 13 · un duel dans le passage obligatoire',url:'https://sinkingstarwalkthrough.com/fr/heroes-3-bard-druid-solutions/#%C3%A9nigme-13',puzzle:13,objective:'Libérer le Barde, vider le couloir des monstres, déclencher le pont du Marchand puis régler le miroir final.'},'Le principe du duel commandé à distance est repris dans une géométrie originale. Le Barde commence isolé ; le Marchand maintient son miroir d’entrée. La caisse de la presse est inaccessible à une poussée manuelle vers l’eau. Le couloir occupé par les monstres mène obligatoirement au miroir final, qui doit être poussé d’une case vers le nord. Le pont relie le Marchand au couloir. Aucune règle spéciale de porte « monstres morts » n’est ajoutée.');
