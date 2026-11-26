import {writeFileSync} from 'node:fs';
import {Author,board} from './author.mjs';

const b=board(20,16);
b.fill(2,8,14,14);b.fill(3,6,14,7);b.fill(4,4,13,4);
for(const x of [4,7,10,13])b.put(x,5);
for(const x of [4,7,10])b.put(x,7,'#');
b.put(12,11,'#');b.put(13,10,'#');
b.fill(15,6,16,10,'~');b.put(16,6);b.fill(17,2,18,14);
for(const [x,y] of [[17,2],[18,2],[17,3],[18,3]])b.put(x,y,'g');
b.put(2,10,'M');b.put(5,6,'T');b.put(13,4,'Z');b.put(14,8,'B');
b.put(4,6,'1');b.put(3,10,'o');b.put(17,6,'o');b.put(16,8,'s');

export const spec={id:'ss24-07',title:'La place qui restera sûre',mode:'quartet',rows:b.strings(),facing:'E',
 circuits:[{id:'premier',color:8,buttons:[{x:4,y:10}]},{id:'deuxieme',color:9,buttons:[{x:7,y:10}]},{id:'troisieme',color:6,buttons:[{x:10,y:10}]},
 {id:'livraison',color:11,buttons:[{x:12,y:10}]},{id:'passage',color:10,buttons:[{x:17,y:7}]}],
 gates:[{at:{x:4,y:6},circuit:'premier',direction:'S',closedWhen:'pressed'},{at:{x:7,y:6},circuit:'deuxieme',direction:'S',closedWhen:'pressed'},
 {at:{x:10,y:6},circuit:'troisieme',direction:'S',closedWhen:'pressed'},
 {at:{x:16,y:6},circuit:'livraison',direction:'E',closedWhen:'released'},{at:{x:14,y:10},circuit:'livraison',direction:'E',closedWhen:'released'}],
 platforms:[{at:{x:15,y:10},circuit:'passage',activeWhen:'pressed'}]};

export function build(){
 const a=new Author(spec);
 a.select('thief').act('RRRRRRRRR').go(4,8);
 a.stage('Le Voleur fait passer le miroir par trois presses actuellement ouvertes et le gare sous le quatrième poste de visée. Les trois premières places seraient détruites lorsque le transport inférieur actionnera leurs commandes.');
 a.select('merchant').act('RRRRRRRRR');
 a.stage('Le bloc et le Marchand parcourent les trois commandes intermédiaires. Les presses se ferment puis se rouvrent ; le miroir reste hors de leurs cases. La livraison finale ouvre la fenêtre de visée et la porte du passage.');
 a.select('wizard').act('D');
 a.stage('La fenêtre est désormais ouverte : le miroir fait tourner la visée vers la réserve de la rive droite. Le Magicien y arrive ; la réserve le remplace sur le balcon sec.');
 a.act('D');
 a.select('bard').act('DD');
 a.stage('Le Magicien maintient une seule case de plateforme. La Barde descend l’appui vide dans l’autre colonne ; le bloc livré reste contre sa butée pendant ce chant.');
 a.act('RRRDDDR');
 a.stage('Le bord de terre empêche l’appui de suivre vers la droite, puis le mur inférieur le retient pendant le départ vers le bas. La Barde franchit ainsi le passage avant ses partenaires sans enlever leur appui.');
 a.go(17,11,'merchant');a.go(18,11,'thief');a.go(17,3,'wizard');
 a.select('bard').act('UUUUUUUUUU');
 a.stage('Une fois les quatre héros sur la rive d’arrivée, la plateforme peut disparaître. Le dernier chant remonte le Marchand et le Voleur, qui se calent contre le bord supérieur auprès du Magicien.');
 return a.result({objective:'Réserver au miroir une place compatible avec les trois commandes du transport suivant, puis préparer un passage à deux cases dont l’appui reste disponible au groupe.',label:'Heroes and Water — énigme 8',url:'https://sinkingstarwalkthrough.com/fr/heroes-and-water-solutions/',puzzles:[8]},'Water 8 demande de choisir, parmi quatre emplacements, celui qu’aucune commande du second transport ne détruira. Le guide utilise un cristal immergé, des plateformes destructrices et un dragon ; SS24 ne reproduit aucune de ces règles. Trois postes du balcon sont ici des presses qui écraseraient le miroir contre un mur lorsqu’un bloc traverse leurs commandes. Le quatrième poste conserve le miroir nécessaire à la visée après ouverture d’une fenêtre distante. L’appui du petit passage n’est jamais détruit par une plateforme : il glisse uniquement à vide, d’eau en eau, puis les bords empêchent son départ avec la Barde. Water 8 avait déjà été cité comme référence secondaire de SS16 N8 ; cette salle change le problème en anticipation de trois déclenchements explicites, et non en conservation de plusieurs lests et miroirs pour deux sas. Le miroir reste un outil optique, la réserve est déposée sur le balcon et le dernier chant accompagne des héros jusqu’aux arrivées.');
}

if(process.argv[1]?.endsWith('build-level7.mjs')){const d=build();writeFileSync(new URL('../level7-design.json',import.meta.url),JSON.stringify(d,null,2)+'\n');console.log(JSON.stringify({title:spec.title,metrics:d.metrics,commands:d.commands}));}
