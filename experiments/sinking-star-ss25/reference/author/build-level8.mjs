import {writeFileSync} from 'node:fs';
import {Author,board} from './author.mjs';
const b=board(20,20);
b.fill(3,5,16,8);b.put(5,3,'m');b.put(5,4);b.put(14,3,'m');b.put(14,4);
b.put(5,9);b.put(14,9);b.fill(3,10,7,14);b.fill(13,10,17,13);
b.put(8,12);b.fill(9,11,9,14);b.fill(10,9,10,14,'~');b.fill(10,15,14,18);
for(const x of [10,11,12,13])b.put(x,18,'g');
b.put(14,13,'W');b.put(5,11,'T');b.put(9,11,'Z');b.put(7,14,'B');
b.put(5,12,'1');b.put(14,12,'4');b.put(9,14,'o');
export const spec={id:'ss25-08',title:'Les deux accès avant le retour',mode:'quartet',rows:b.strings(),facing:'N',
 circuits:[{id:'rive-gauche',color:10,buttons:[{x:5,y:3}]},{id:'rive-droite',color:11,buttons:[{x:14,y:3}]}],
 gates:[{at:{x:5,y:9},circuit:'rive-gauche',direction:'S',closedWhen:'released'},{at:{x:9,y:11},circuit:'rive-gauche',direction:'E',closedWhen:'released'},{at:{x:14,y:9},circuit:'rive-droite',direction:'S',closedWhen:'released'}],
 platforms:[{at:{x:10,y:9},circuit:'rive-gauche',activeWhen:'released'},{at:{x:10,y:10},circuit:'rive-gauche',activeWhen:'released'},{at:{x:10,y:12},circuit:'rive-droite',activeWhen:'released'},{at:{x:10,y:13},circuit:'rive-droite',activeWhen:'released'},{at:{x:10,y:14},circuit:'rive-droite',activeWhen:'released'}]};
export function build(){
 const a=new Author(spec);
 a.select('thief').act('UUUUUR');
 a.select('warrior').act('UUUUU');
 a.stage('Les deux monstres maintiennent les accès de chantier. Le Voleur remonte un miroir par traction, le Guerrier pousse l’autre depuis sa rive. Ils quittent les axes avant de réunir les monstres ; le Magicien occupe encore la presse latérale.');
 a.select('wizard').act('D');
 a.stage('L’échange extrait la caisse de la poche et la dépose sur la presse, à la place du Magicien. La caisse doit rester sèche jusqu’à la fermeture : elle comblera alors le seul trou sans plateforme du retour.');
 a.select('bard').act('UULL');
 a.stage('Le chant ramène le Magicien hors de sa poche sans activer son échange. La butée au-dessus de la presse retient la caisse pendant les pas vers le haut, puis le mur de gauche la retient pendant l’extraction latérale.');
 a.act('X');
 a.stage('Une seule réflexion amène les deux monstres au contact. Leur départ libère les deux commandes : les anciens accès ferment, les deux familles de plateformes apparaissent et la presse pousse la caisse vers l’est. Elle devient l’appui qui complète le retour.');
 a.go(12,18,'wizard');a.go(10,18,'warrior');a.go(11,18,'thief');
 a.stage('Le Magicien emprunte le raccord latéral ; le Guerrier et le Voleur traversent le retour central complet. La Barde attend encore sur la rive : déplacer l’appui avant leur passage rouvrirait le trou supérieur.');
 a.go(10,12,'bard').act('DDDRRRRDLDD');
 return a.result({objective:'Préparer les deux miroirs et remplacer le Magicien sur la presse avant de libérer les commandes, puis laisser passer les partenaires avant de reprendre l’appui avec le chant.',label:'Adaptation · Heroes and Water · énigme 22',url:'https://sinkingstarwalkthrough.com/fr/heroes-and-water-solutions/',puzzles:[22]},'Water 22 conserve deux commandes pendant l’extraction des héros, puis les libère pour ouvrir le trajet final. SS25 remplace les dragons et le Clerc par deux monstres qui servent de poids, deux miroirs préparés par manutention et une presse latérale. L’échange retire le Magicien de la presse et y dépose la caisse ; le chant le ramène sans reprendre cette cible. La réflexion libère les deux commandes, ferme les accès de chantier et fait apparaître les plateformes. La presse immerge alors la caisse dans le seul trou qui reste. Le Guerrier et le Voleur utilisent ce retour avant que la Barde, dernière passagère, entraîne l’appui derrière elle. Les monstres sont éliminés par leur contact mutuel ; le Guerrier n’a aucun pouvoir d’attaque. La carte, l’optique, les quatre rôles et les circuits sont une adaptation SS25, sans Clerc, dragon, immunité ni quota d’élimination.');
}
if(process.argv[1]?.endsWith('build-level8.mjs')){const d=build();writeFileSync(new URL('../level8-design.json',import.meta.url),JSON.stringify(d,null,2)+'\n');console.log(JSON.stringify({title:spec.title,metrics:d.metrics,commands:d.commands}));}
