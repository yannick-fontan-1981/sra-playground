import {writeFileSync} from 'node:fs';
import {Author,board} from './author.mjs';
const b=board(20,20);
b.fill(2,4,10,11);b.put(6,5,'#');b.put(11,8,'~');b.fill(12,7,18,11);
b.fill(16,2,18,5);b.put(17,6);b.put(16,12);b.put(16,13);b.fill(14,14,17,16);
for(const [x,y] of [[16,2],[17,2],[18,2],[18,3]])b.put(x,y,'g');
b.put(2,5,'W');b.put(13,8,'T');b.put(16,9,'Z');b.put(4,7,'B');b.put(3,5,'o');b.put(5,8,'o');b.put(16,14,'o');
export const spec={id:'ss25-07',title:'Le retour de la troisième charge',mode:'quartet',rows:b.strings(),facing:'E',
 circuits:[{id:'traversee',color:10,buttons:[{x:5,y:5}]},{id:'reserve',color:9,buttons:[{x:9,y:8}]},{id:'arrivees',color:11,buttons:[{x:4,y:4},{x:7,y:7}]}],
 gates:[{at:{x:16,y:12},circuit:'reserve',direction:'S',closedWhen:'released'},{at:{x:17,y:6},circuit:'arrivees',direction:'N',closedWhen:'released'}],
 platforms:[{at:{x:11,y:8},circuit:'traversee',activeWhen:'pressed'}]};
export function build(){
 const a=new Author(spec);
 a.select('warrior').act('RR').go(2,10);
 a.select('bard').act('RRRR');
 a.stage('La butée retient la première caisse sur sa commande pendant que le chant transporte la deuxième jusqu’à la réserve. Un même mouvement agit donc sur la charge libre et laisse la charge bloquée en place.');
 a.select('wizard').act('D');
 a.stage('L’ouverture de la réserve permet au Magicien d’échanger avec la troisième caisse. Il reste à la faire revenir pendant que la deuxième maintient encore le passage de sa propre sortie.');
 a.go(16,8,'thief').act('U').go(15,8).act('LLLLL');
 a.stage('Le Voleur extrait la troisième charge, lui fait changer d’axe puis la laisse sur le pont provisoire. Cette charge doit attendre là : elle remplacera le soutien quand le premier poids sera repris.');
 a.go(18,10,'wizard');
 a.stage('Le Magicien quitte la réserve avant la reprise de sa commande. Les deux livraisons ont préparé à la fois une sortie de héros et une ressource de retour.');
 a.select('bard').act('LLU');
 a.stage('Le retour change les deux premières caisses de rôle. Le premier poids quitte sa butée : le pont se retire sous la troisième caisse, qui devient un appui permanent. Le pas vers le haut range les deux poids sur les commandes des arrivées.');
 a.go(6,7,'thief').act('DDDD');
 a.stage('Le Voleur extrait la Barde de quatre cases sans chant. Un départ volontaire à proximité déplacerait de nouveau un poids ; les deux commandes restent occupées pendant cette extraction.');
 a.go(18,2,'wizard');a.go(16,2,'warrior');a.go(17,2,'thief');a.go(18,3,'bard');
 return a.result({objective:'Maintenir une charge par une butée pendant l’aller, rapporter une troisième caisse avant de reprendre ce poids, puis quitter les deux commandes finales sans les entraîner.',label:'Adaptation · Heroes, Doubled · énigme 10',url:'https://sinkingstarwalkthrough.com/fr/heroes-doubled-solutions/',puzzles:[10]},'Doubled 10 maintient une copie contre un mur sur une commande pendant qu’une autre va chercher la pierre d’un troisième bouton ; le retour utilise un autre placement. SS25 ne contient pas de copies synchronisées. Le chant déplace une caisse et laisse la première contre sa butée ; cette dissymétrie prépare l’extraction de la troisième charge par le Magicien et le Voleur. La charge revient sur une plateforme avant que le premier poids quitte sa commande et la transforme en appui permanent. Les deux caisses initiales deviennent alors les deux poids des arrivées, et le Voleur extrait la Barde sans réactiver leur mouvement. L’aller et le retour n’utilisent donc pas la même configuration. Les quatre héros, la réserve basse, la plateforme et les circuits sont une construction SS25.');
}
if(process.argv[1]?.endsWith('build-level7.mjs')){const d=build();writeFileSync(new URL('../level7-design.json',import.meta.url),JSON.stringify(d,null,2)+'\n');console.log(JSON.stringify({title:spec.title,metrics:d.metrics,commands:d.commands}));}
