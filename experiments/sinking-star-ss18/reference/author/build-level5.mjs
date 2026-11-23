import {Author,board} from './author.mjs';
import {writeFileSync} from 'node:fs';

const b=board(20,20,'#');
b.fill(1,3,18,16);b.fill(4,1,15,18);b.fill(0,7,0,14);
// An arena below a long wall; the three destinations face different directions.
b.fill(1,5,18,5,'#');b.put(8,5,'.');
b.put(10,6,'#');b.put(5,10,'#');b.put(4,9,'#');
b.put(17,12,'#');b.put(17,14,'#');b.put(18,13,'#');
b.put(2,17,'#');b.put(4,17,'#');b.put(3,18,'#');b.put(3,16,'~');
b.put(8,2,'g');b.put(17,13,'g');b.put(3,17,'g');
b.put(7,8,'B');b.put(2,14,'M');b.put(13,16,'Z');
b.put(5,6,'m');b.put(9,6,'m');b.put(3,10,'m');b.put(13,13,'m');b.put(3,15,'o');
export const spec={id:'ss18-05',title:'Les gardiens de l’arène',rows:b.strings(),facing:'N',
 circuits:[{id:'gardiens',buttons:[{x:4,y:10},{x:13,y:11}],color:11}],
 gates:[{at:{x:8,y:5},circuit:'gardiens',direction:'N',closedWhen:'released'},{at:{x:16,y:13},circuit:'gardiens',direction:'E',closedWhen:'released'}],
};
export function build(){
 const a=new Author(spec);
 const stage=label=>{a.stage(label);if(process.env.SS18_AUTHOR_DEBUG)console.log(label,a.commands.length,JSON.stringify(a.state));};
 a.select('bard').act('RRR');
 stage('La butée retient le monstre de droite ; le chant rapproche seulement son adversaire jusqu’au combat, sans toucher aux deux futurs contrepoids.');
 a.go(0,12,'bard').act('RRRRRR');
 stage('Le premier gardien entre dans sa loge. La butée latérale le retient pendant que le Barde et le Marchand s’éloignent.');
 a.go(13,11,'wizard').act('D');
 stage('Le Magicien relève le second gardien sur la commande : le poids reste présent pendant l’échange, et les accès nord et est s’ouvrent ensemble.');
 a.go(3,14,'merchant').act('D');
 stage('Le Marchand transforme la seule caisse en appui pour la destination sud-ouest.');
 a.go(17,13,'merchant');
 a.go(3,17,'bard');
 a.go(8,2,'wizard');
 stage('Les trois héros atteignent des destinations séparées ; les deux gardiens conservés maintiennent leurs commandes.');
 return a.result({puzzle:'13–14',label:'Adaptation de Heroes 3 · énigmes 13–14 · combattre une paire, conserver les contrepoids',url:'https://sinkingstarwalkthrough.com/fr/heroes-3-bard-druid-solutions/',secondaryLabel:'Heroes and Light · énigme 4 · un monstre tient lieu de poids',secondaryUrl:'https://sinkingstarwalkthrough.com/fr/heroes-and-light-solutions/',objective:'Distinguer les monstres à réunir de ceux à conserver, puis partager les trois accès sans déplacer leurs contrepoids.'},{kind:'adaptation',preserved:['Bard 13 : guider deux monstres jusqu’à leur rencontre pour dégager le passage.','Bard 14 : des monstres conservés occupent simultanément les commandes nécessaires au départ.'],changed:['Quatre monstres occupent une arène à sorties dispersées, avec une paire combattante, une butée de combat et deux contrepoids.','Le Magicien assure la relève sur une commande, tandis que le Marchand prépare un appui distinct.','La portée carrée du chant et le combat orthogonal suivent le contrat SS18 ; la carte et les déplacements sont originaux.'],sourceReading:'Les deux idées du guide sont composées dans une arène ouverte avec une seule butée de combat et deux loges distinctes. Les positions précises et le partage des trois sorties sont originaux.',proofScope:'Parcours de référence légal, sans revendication de minimum ni d’unicité.'});
}
if(process.argv[1]?.endsWith('build-level5.mjs')){const d=build();writeFileSync(new URL('../level5-design.json',import.meta.url),JSON.stringify(d,null,2)+'\n');console.log(JSON.stringify({title:spec.title,metrics:d.metrics,commands:d.commands}));}
