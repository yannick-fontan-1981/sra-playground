import {Author,board} from './author.mjs';
import {writeFileSync} from 'node:fs';
const b=board(20,20,'~');
b.fill(0,0,19,0,'#');b.fill(0,19,19,19,'#');b.fill(0,0,0,19,'#');b.fill(19,0,19,19,'#');
// Three irregular islands linked by optical paths, with a disposable relay in the middle.
b.fill(3,11,8,17);b.put(2,17,'.');b.fill(5,8,5,11);
b.fill(11,11,16,16);b.put(11,8,'.');b.put(11,7,'#');b.put(12,8,'.');b.put(8,8,'g');
b.fill(2,8,2,10);b.put(1,8,'g');b.put(2,10,'g');b.put(2,14,'.');
b.put(4,12,'W');b.put(5,17,'Z');b.put(7,12,'B');b.fill(9,15,9,18);b.put(9,14,'#');b.put(9,15,'o');b.put(14,12,'o');b.put(15,12,'m');
export const spec={id:'ss19-07',title:'Le relais condamné',rows:b.strings(),facing:'N',
 mirrors:[{at:{x:11,y:8},facing:'SW'},{at:{x:12,y:8},facing:'SW'},{at:{x:3,y:14},facing:'NE'}],
 circuits:[{id:'relais',buttons:[{x:9,y:18}],color:15},{id:'quai',buttons:[{x:16,y:12}],color:10}],
 gates:[{at:{x:11,y:8},circuit:'relais',direction:'N',closedWhen:'pressed'},
 {at:{x:1,y:8},circuit:'quai',direction:'S',closedWhen:'released'}],
};
export function build(){
 const a=new Author(spec);const stage=s=>{a.stage(s);if(process.env.SS19_AUTHOR_DEBUG)console.log(s,a.commands,JSON.stringify(a.state));};
 a.go(4,14,'warrior').act('L');
 stage('Avant de quitter l’atelier, le Guerrier recale le petit miroir sur l’axe des deux arrivées nord-ouest.');
 a.go(5,8,'warrior').act('X');
 stage('Le relais central reçoit le Guerrier sur le quai de droite ; sa commande de destruction reste relâchée.');
 a.go(13,12,'warrior').act('RR');
 stage('La poussée en file utilise la caisse comme écran. Deux poussées envoient le monstre dans l’eau et laissent la caisse sur la commande du quai.');
 a.go(13,13,'warrior');
 a.go(3,17,'wizard');
 a.select('bard').act('DDDD');
 stage('Le Barde descend la charge de la glissière jusqu’à la commande inaccessible : la presse écrase le relais contre sa butée nord.');
 a.act('U');
 stage('Un pas de retour retire la charge et rouvre la presse vide. Détruire le miroir sans rouvrir cette case ne suffirait pas.');
 a.go(6,15,'wizard').act('R');
 a.select('bard').act('UXUUL');
 stage('Le Magicien extrait le Barde de la glissière. Son dernier chant le place aussi pour le prochain départ ; le premier reflet installe le Barde hors de l’axe.');
 a.select('wizard').act('L');
 a.go(12,12,'warrior').act('X');
 stage('Le dernier reflet envoie ensemble le Guerrier et le Magicien sur les deux arrivées encore libres.');
 return a.result({puzzle:18,label:'Adaptation de Heroes and Mirrors · énigme 18 · supprimer un miroir qui barre le dernier reflet',url:'https://sinkingstarwalkthrough.com/fr/heroes-and-mirrors-solutions/',secondaryLabel:'Heroes 2: Monsters · énigmes 10 et 14 · préparer une ligne face au monstre',secondaryUrl:'https://sinkingstarwalkthrough.com/fr/heroes-2-monsters-solutions/',objective:'Utiliser le relais pour entrer, manœuvrer le monstre derrière son écran, faire écraser le miroir devenu obstacle puis organiser les deux derniers reflets ensemble.'},{kind:'adaptation',preserved:['Mirrors 18 : un miroir utile pour entrer bloque ensuite la sortie ; une presse le supprime avant le reflet final.','Heroes 2 10/14 : préparer une ligne sûre avec une charge entre le héros et le monstre.'],changed:['Le monstre ne se déplace que par un transport imposé visible. La poussée en file entraîne la caisse et le monstre ; la caisse sert ensuite de poids, sans pouvoir d’écrasement des cristaux de la source.','La charge du Barde provoque la destruction et laisse une presse fermée : la charge doit remonter d’une case avant le dernier rayon.','Trois régions séparées imposent un premier départ puis un départ conjoint ; les personnages conservés sur leurs destinations ne sont pas effacés.'],sourceReading:'Géométrie et commande de relève originales ; adaptation de la suppression d’un relais et de la préparation d’une ligne de poussée.',proofScope:'Parcours légal vérifié. Supprimer le relais ne suffit pas : sa presse doit être ouverte et la commande du quai maintenue. Le monstre peut aussi être conservé derrière un écran ; aucune élimination obligatoire n’est prétendue.'});
}
if(process.argv[1]?.endsWith('build-level7.mjs')){const d=build();writeFileSync(new URL('../level7-design.json',import.meta.url),JSON.stringify(d,null,2)+'\n');console.log(JSON.stringify({title:spec.title,metrics:d.metrics,commands:d.commands}));}
