import {writeFileSync} from 'node:fs';
import {Author,board} from './author.mjs';

const b=board(20,18);
b.fill(2,10,14,14);b.fill(2,8,8,9);b.fill(9,4,14,7);b.put(10,8);b.put(10,9);b.put(13,8);b.put(13,9);b.fill(14,7,14,10);
b.put(14,6);b.put(15,6,'~');b.fill(16,2,18,7);
for(const [x,y] of [[17,2],[18,2],[17,3],[18,3]])b.put(x,y,'g');
b.put(3,11,'W');b.put(10,7,'T');b.put(12,4,'Z');b.put(11,12,'B');
b.put(4,11,'o');b.put(5,11,'o');b.put(6,11,'2');
export const spec={id:'ss25-05',title:'La cale qui change de côté',mode:'quartet',rows:b.strings(),facing:'E',
 circuits:[{id:'reserve',color:10,buttons:[{x:8,y:11}]},{id:'service',color:11,buttons:[{x:13,y:11}]},{id:'depart',color:9,buttons:[{x:13,y:6},{x:11,y:7}]}],
 gates:[{at:{x:8,y:9},circuit:'reserve',direction:'N',closedWhen:'released'},{at:{x:10,y:8},circuit:'service',direction:'N',closedWhen:'released'},{at:{x:16,y:6},circuit:'depart',direction:'E',closedWhen:'released'}]};
export function build(){
 const a=new Author(spec);
 a.select('warrior').act('RRRR');
 a.stage('La file est déplacée entière : la première caisse tient la réserve, la seconde reste devant le miroir. Il faut maintenant séparer la manutention sans reprendre le premier poids.');
 a.go(11,11,'thief').act('RRR').go(10,11).act('RR').go(10,9);
 a.stage('Le miroir tient le service ; la seconde caisse a été extraite de la file et attend une case avant lui.');
 a.go(10,11,'warrior').act('R').go(13,12).act('U');
 a.stage('Le Guerrier pousse le miroir vers le haut et prend sa place sur le service. La caisse se trouve à sa gauche : la relève suivante doit déplacer le Guerrier et la caisse ensemble.');
 a.select('bard').act('R');
 a.stage('Le chant fait avancer la caisse sur le service en libérant le Guerrier. Le miroir ignore le chant ; le premier poids reste hors de portée.');
 a.go(12,7,'thief');
 a.go(13,12,'warrior').act('UUUU');
 a.stage('La caisse sert de cale à la file verticale. Après la première poussée, le service est encore tenu par le Guerrier ; les suivantes ferment ce passage tandis que le Voleur attend déjà au-dessus.');
 a.go(12,7,'thief').act('LL').go(9,4);
 a.stage('La traction latérale sort la cale du rayon et la dépose sur le second bouton du départ. Le miroir reste en station : les deux ressources, jusque-là solidaires, ont maintenant des fonctions différentes.');
 a.go(13,9,'warrior').act('X').go(17,2);
 a.go(13,9,'thief').act('X').go(18,2);
 a.go(13,9,'wizard').act('X').go(17,3);
 a.go(13,9,'bard').act('X').go(18,3);
 return a.result({objective:'Intervertir la caisse et le miroir, relever la commande pendant le chantier puis séparer la cale pour préparer le départ des quatre héros.',label:'Adaptation · Heroes and Light · énigme 30',url:'https://sinkingstarwalkthrough.com/fr/heroes-and-light-solutions/',puzzles:[30]},'Light 30 demande de déplacer tôt un émetteur, de l’intervertir avec une pierre et de réemployer cette pierre comme cale lors des déplacements suivants. SS25 transpose ce travail à un miroir et à deux caisses : la file horizontale est dissociée, le miroir puis le Guerrier puis la caisse occupent le service, et une nouvelle file monte vers le poste de reflet. Le Voleur en extrait la cale latéralement pour libérer le rayon et compléter la commande du départ. Aucun faisceau violet ni téléportation automatique n’est ajouté. Les quatre rôles et les circuits visibles remplacent les pouvoirs de la source ; la géométrie et les destinations sont originales.');
}
if(process.argv[1]?.endsWith('build-level5.mjs')){const d=build();writeFileSync(new URL('../level5-design.json',import.meta.url),JSON.stringify(d,null,2)+'\n');console.log(JSON.stringify({title:spec.title,metrics:d.metrics,commands:d.commands}));}
