import {writeFileSync} from 'node:fs';
import {Author,board} from './author.mjs';

// A freight street and the surrounding pedestrian streets are separate.
// The Bard changes streets at the corners instead of pushing the load herself.
const b=board(20,20);
b.fill(1,2,17,2);b.fill(1,2,1,17);b.fill(17,2,17,10);
b.fill(1,6,9,6);b.fill(13,2,13,10);b.fill(13,6,17,6);b.fill(13,10,17,10);
b.fill(5,6,5,14);b.fill(1,14,13,14);b.fill(13,14,13,17);
b.fill(1,15,5,17);b.fill(1,17,14,17);b.fill(15,16,18,18);
b.fill(5,4,11,4);b.fill(11,4,11,8);b.fill(7,8,11,8);
b.fill(7,8,7,12);b.fill(7,12,13,12);
b.put(5,4,'o');b.put(11,12,'m');
b.put(3,2,'B');b.put(3,15,'M');b.put(2,16,'W');b.put(4,16,'T');
for(const x of [15,16,17,18])b.put(x,18,'g');

export const spec={id:'ss22-06',title:'Le quartier des reprises',mode:'quartet',rows:b.strings(),facing:'E',
 circuits:[
  {id:'dechargement',color:15,buttons:[{x:3,y:15}]},
  {id:'livraison',color:14,buttons:[{x:12,y:12},{x:13,y:12}]}
 ],
 gates:[
  {at:{x:7,y:12},circuit:'dechargement',direction:'E',closedWhen:'released'},
  {at:{x:5,y:14},circuit:'dechargement',direction:'W',closedWhen:'pressed'},
  {at:{x:13,y:15},circuit:'dechargement',direction:'S',closedWhen:'pressed'},
  {at:{x:14,y:17},circuit:'livraison',direction:'E',closedWhen:'released'}
 ]};

export function build(){
 const a=new Author(spec);
 a.select('bard').act('RRRRRR');
 a.stage('La caisse traverse la rue haute tandis que la Barde reste dans la galerie parallèle, séparée par les bâtiments.');
 a.act('RRRRDDDD');
 a.stage('Le mur du premier carrefour retient la caisse pendant le changement de poste, puis le chant la descend dans la rue orientale.');
 a.go(9,6).act('LLLLDDDD');
 a.stage('Après un détour extérieur, la Barde reprend la charge depuis le nord, puis depuis l’ouest. Elle la dépose sur la presse ouverte au dernier coude.');
 a.select('merchant').act('L');
 a.stage('Le Marchand libère la commande : la presse décharge la caisse vers l’est et les deux accès de la galerie basse s’ouvrent. Fermer avant la livraison laisserait la charge au-dessus du coude.');
 a.go(5,14,'bard').act('RRRRRRRR');
 a.stage('La Barde reprend la charge depuis le sud. Le gardien entre ensuite dans sa portée ; les deux avancent ensemble et le mur du fond fixe leurs places sur les deux commandes.');
 a.act('DD');
 a.stage('Le départ par le bas conserve les deux poids : les bâtiments empêchent leurs mouvements vers le sud. Le retour vers l’ouest les aurait retirés des commandes.');
 a.go(18,18);
 a.go(15,18,'merchant');a.go(16,18,'warrior');a.go(17,18,'thief');
 return a.result({objective:'Guider la charge dans une rue inaccessible, changer de poste à chaque carrefour, décharger au bon moment puis conserver le bloc et le gardien sur leurs commandes.',label:'Heroes 3: Bard, Druid — énigme 18',url:'https://sinkingstarwalkthrough.com/fr/heroes-3-bard-druid-solutions/',puzzles:[18]},'Le principe repris est le guidage depuis plusieurs coins de rue, avec des itinéraires distincts pour la Barde et la charge. La source ne permet pas de fixer avec certitude le statut de sa créature rouge ; SS22 emploie explicitement une caisse puis un monstre statique. La rue des marchandises est inaccessible à pied. Le changement de galerie final dépend d’une presse latérale à commande distante, qui décharge la caisse au moment où ses accès s’ouvrent. Les deux derniers poids sont placés par la portée progressive du chant et conservés par les murs. Aucun Druide, clone, rayon coloré, déplacement autonome ou condition de victoire supplémentaire.');
}

if(process.argv[1]?.endsWith('build-level6.mjs')){const d=build();writeFileSync(new URL('../level6-design.json',import.meta.url),JSON.stringify(d,null,2)+'\n');console.log(JSON.stringify({title:spec.title,metrics:d.metrics,commands:d.commands}));}
