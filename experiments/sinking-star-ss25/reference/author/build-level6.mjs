import {writeFileSync} from 'node:fs';
import {Author,board} from './author.mjs';
const b=board(20,20);
b.fill(2,12,10,17);b.fill(4,9,10,10);b.put(8,11);b.put(6,11,'~');
b.fill(5,5,10,7);b.put(8,8,'~');b.fill(7,2,9,3);b.put(9,4);
b.fill(11,9,12,10,'~');b.fill(13,9,16,12);b.fill(14,6,14,8);
for(const [x,y] of [[7,2],[8,2],[9,2],[14,6]])b.put(x,y,'g');
b.put(2,15,'W');b.put(9,15,'T');b.put(6,15,'Z');b.put(14,9,'B');
b.put(3,15,'o');b.put(6,9,'o');b.put(5,10,'o');
export const spec={id:'ss25-06',title:'Le dernier usage de la butée',mode:'quartet',rows:b.strings(),facing:'N',
 circuits:[{id:'service',color:10,buttons:[{x:6,y:15}]},{id:'couronne',color:11,buttons:[{x:8,y:6}]}],
 gates:[{at:{x:8,y:11},circuit:'service',direction:'N',closedWhen:'released'},{at:{x:9,y:4},circuit:'couronne',direction:'N',closedWhen:'released'},{at:{x:14,y:8},circuit:'couronne',direction:'N',closedWhen:'released'}]};
export function build(){
 const a=new Author(spec);
 a.select('wizard').act('UR');
 a.stage('La caisse sèche intercepte d’abord la visée verticale. Son échange ouvre le service ; le second échange installe la Barde dans l’atelier haut et envoie le Magicien sur la rive isolée.');
 a.select('warrior').act('RRR').go(7,16).act('UUU');
 a.go(8,11,'thief');
 a.go(6,12,'warrior').act('R');
 a.stage('La réserve prend le bouton sans interrompre le service. L’ancienne cible est sortie de la file, remontée puis présentée devant le passage ; elle reste sèche pour cette manutention.');
 a.go(8,11,'thief').act('UU').go(10,10);
 a.go(8,11,'warrior').act('UU');
 a.stage('La première cible devient enfin appui dans le trou supérieur. Elle cesse d’être échangeable ou tractable ; cette consommation n’a lieu qu’après la relève du service et l’installation de la Barde.');
 a.go(6,10,'thief').act('R');
 a.select('bard').act('D');
 a.stage('Le Voleur a placé la dernière caisse au bord du trou inférieur. Le chant la transforme en second appui tout en ramenant le Guerrier vers le bas ; le premier appui reste ancré par son bord de terre.');
 a.go(4,9,'thief');a.go(6,16,'warrior');
 a.select('wizard').act('DL');
 a.stage('Le Magicien échange une seconde fois avec la Barde. Elle rejoint la rive isolée sans emporter les appuis ; il retrouve l’atelier devenu traversable.');
 a.go(10,10,'wizard');
 a.go(6,16,'warrior').act('UUUUUU').go(5,9).act('RR').go(8,10).act('UUU');
 a.stage('Le poids du service est récupéré. Son départ ferme le passage ancien, mais l’appui inférieur fournit le retour préparé. La caisse traverse ensuite l’appui supérieur et devient le poids de la couronne.');
 a.go(7,9,'warrior');a.go(8,9,'thief');a.go(8,10,'wizard');
 a.select('thief').act('UUL');a.go(8,9,'warrior').act('U');
 a.stage('Le poids final intercepte désormais la marche du Magicien vers le haut. La traction l’amène sur l’appui, puis une poussée le porte de l’autre côté sans échange ; les deux transporteurs se dégagent pour son départ latéral.');
 a.select('wizard').act('R').go(9,2);a.go(7,2,'warrior');a.go(8,2,'thief');a.go(14,6,'bard');
 return a.result({objective:'Utiliser la cible sèche avant de la transformer en appui, préparer un second retour, puis récupérer le poids qui maintenait le premier accès.',label:'Adaptation · Heroes and Artifacts · énigme 9',url:'https://sinkingstarwalkthrough.com/fr/heroes-and-artifacts-solutions/',puzzles:[9]},'Artifacts 9 conserve d’abord des plantes comme obstacles de visée ou de déplacement, puis les transforme en sol lorsque cette fonction n’est plus nécessaire. SS25 ne possède ni Druide, ni baguette, ni transformation réversible. Une caisse est ici la première cible qui permet au Magicien d’installer la Barde dans l’atelier ; elle devient ensuite un appui et disparaît du plan des cibles. Une autre caisse fournit le retour matériel nécessaire avant la récupération du poids de service. Le poids traverse enfin les deux appuis et ouvre deux sorties distantes. Trois ressources ont donc trois histoires différentes : première cible puis appui, caisse de réception puis second appui, poids provisoire puis poids final. Les positions, les quatre héros, les portes et les destinations sont propres à SS25.');
}
if(process.argv[1]?.endsWith('build-level6.mjs')){const d=build();writeFileSync(new URL('../level6-design.json',import.meta.url),JSON.stringify(d,null,2)+'\n');console.log(JSON.stringify({title:spec.title,metrics:d.metrics,commands:d.commands}));}
