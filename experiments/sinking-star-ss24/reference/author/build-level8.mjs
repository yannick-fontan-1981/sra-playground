import {writeFileSync} from 'node:fs';
import {Author,board} from './author.mjs';

const b=board(20,16);
b.fill(2,4,10,11);b.fill(12,4,13,11);b.put(12,3);b.put(13,3);
b.put(11,7);b.put(11,8);b.put(11,9);b.put(12,6,'~');
b.fill(14,1,18,4);b.fill(16,5,16,9);b.fill(14,9,17,9);b.fill(14,7,15,7);b.put(14,6);b.put(14,8);
for(const x of [15,16,17,18])b.put(x,1,'g');
b.put(6,5,'M');b.put(8,8,'T');b.put(13,8,'Z');b.put(13,9,'B');
b.put(7,5,'o');b.put(12,3,'o');b.put(10,9,'o');b.put(13,3,'o');b.put(16,7,'4');

export const spec={id:'ss24-08',title:'Le dernier pas sans échange',mode:'quartet',rows:b.strings(),facing:'E',
 circuits:[{id:'atelier',color:10,buttons:[{x:10,y:5}]},{id:'composition',color:11,buttons:[{x:12,y:5},{x:10,y:7},{x:12,y:7}]},{id:'coude',color:6,buttons:[{x:13,y:7}]}],
 gates:[{at:{x:11,y:7},circuit:'atelier',direction:'E',closedWhen:'released'},{at:{x:11,y:8},circuit:'atelier',direction:'E',closedWhen:'released'},
 {at:{x:11,y:9},circuit:'atelier',direction:'E',closedWhen:'released'},
 {at:{x:14,y:3},circuit:'composition',direction:'E',closedWhen:'released'},{at:{x:16,y:5},circuit:'composition',direction:'N',closedWhen:'released'}],
 platforms:[{at:{x:12,y:6},circuit:'coude',activeWhen:'released'}]};

export function build(){
 const a=new Author(spec);
 a.select('merchant').act('RRR').go(2,11);
 a.stage('Le Marchand livre le premier bloc. Ce dépôt ouvre les passages entre l’atelier large et le couloir étroit ; il doit rester en place pendant la préparation du tableau.');
 a.go(12,4,'thief').act('DD').go(12,8).go(10,8).act('UU').go(9,6);
 a.stage('Le Voleur extrait le bloc du cul-de-sac supérieur, puis tire le bloc bas vers le haut. Les deux dépôts se font depuis des côtés différents, sans poussée de file.');
 a.go(15,7,'thief').act('LLLDLD').go(5,11);
 a.stage('Le Voleur ramène le miroir jusqu’au coude, qui retire la plateforme au-dessus de la dernière commande. En se dégageant par la gauche, il entraîne le Magicien d’une case sans lancer son sort. Le miroir reste un outil optique, une butée physique et la commande de cette case hydraulique.');
 a.go(12,8,'wizard').go(11,8).go(11,7);
 a.stage('Depuis le poste à gauche de la dernière commande, un pas volontaire à droite atteindrait la réserve par le miroir et échangerait trop tôt : il ne ferait pas avancer le Magicien d’une case.');
 a.select('bard').act('R');
 a.stage('Le chant prend le Magicien sur sa bordure gauche, mais laisse le poids en bas à gauche hors de portée. Le Magicien rejoint la case vide sans lancer son pouvoir.');
 a.select('wizard').act('R');
 a.stage('Depuis la bonne case, la visée coudée échange la réserve haute avec le Magicien. Le dernier poids complète le tableau ; le miroir retient ce poids pendant le départ vers la droite de la Barde.');
 a.select('bard').act('RR').go(18,1);
 a.go(15,1,'wizard');a.go(16,1,'merchant');
 a.go(13,6,'thief').act('UUU').go(17,1);
 return a.result({objective:'Préparer trois dépôts et un coude optique, puis faire entrer le Magicien sur la dernière commande sans déclencher un échange prématuré.',label:'Heroes and Light, Advanced — énigme 8',url:'https://sinkingstarwalkthrough.com/fr/heroes-and-light-advanced-solutions/',puzzles:[8]},'Light Advanced 8 décrit un tableau dont le dernier emplacement ne peut pas être rejoint par le pas habituel du Magicien : ce pas échange avec une pierre déjà placée. Dans le guide, la lumière orange autorise un saut ; SS24 ne possède ni cette lumière ni la parité. La transposition emploie un chant sélectif qui entraîne le Magicien sans son pouvoir. Les quatre boutons de l’atelier et de la composition sont répartis entre deux espaces et non en carré 2×2 ; le premier ouvre l’accès de travail, deux blocs sont extraits par traction et un miroir est ramené de trois cases. Une cinquième commande, sous le miroir, retire la case hydraulique située au-dessus du dernier dépôt : cette approche devient impraticable mais le rayon passe toujours vers le poids supérieur. Depuis le poste gauche, la visée atteint la réserve mais la dépose trop tôt ; après le pas forcé, le même rayon coudé produit la bonne dépose. Le miroir reste utile au rayon et sert de butée contre le chant de sortie. La Barde rejoint les arrivées par ses propres pas ; le Voleur peut ensuite reprendre le miroir et réactiver la petite plateforme. La contrainte porte sur l’état préparé montré par le témoin ; aucune unicité globale de méthode n’est revendiquée.');
}

if(process.argv[1]?.endsWith('build-level8.mjs')){const d=build();writeFileSync(new URL('../level8-design.json',import.meta.url),JSON.stringify(d,null,2)+'\n');console.log(JSON.stringify({title:spec.title,metrics:d.metrics,commands:d.commands}));}
