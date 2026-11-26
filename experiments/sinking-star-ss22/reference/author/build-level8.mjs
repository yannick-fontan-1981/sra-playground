import {writeFileSync} from 'node:fs';
import {Author,board} from './author.mjs';

const b=board(20,16);
b.fill(4,6,13,13);
b.fill(6,5,15,5,'~');b.fill(14,5,15,12,'~');b.put(9,4,'~');
b.fill(8,1,11,3);
b.fill(17,8,18,13);b.put(16,11);
b.put(6,5,'s');b.put(7,5,'s');b.put(8,5,'s');
b.put(9,1,'o');b.put(9,2,'T');b.put(6,11,'M');b.put(4,12,'W');b.put(6,7,'B');
for(const [x,y] of [[17,9],[18,9],[17,10],[18,10]])b.put(x,y,'g');

export const spec={id:'ss22-08',title:'La dernière traverse',mode:'quartet',rows:b.strings(),facing:'E',
 circuits:[{id:'retour',color:14,buttons:[{x:6,y:11}]}],
 gates:[{at:{x:16,y:11},circuit:'retour',direction:'E',closedWhen:'released'}],
 platforms:[{at:{x:9,y:5},circuit:'retour',activeWhen:'pressed'}]};

export function build(){
 const a=new Author(spec);
 a.select('bard').act('R').go(9,7).act('U');
 a.stage('La première translation place les trois appuis dans l’axe. La Barde en dépose ensuite un dans la branche nord : il complète, avec la plateforme tenue par le Marchand, le retour du Voleur et de sa caisse.');
 a.act('RRRDD').go(9,7).act('RRRRDDDDDD');
 a.stage('L’appui de la branche nord reste sur place. Les deux autres longent le bâtiment, tournent vers le sud et forment la dernière traverse devant la porte. La trajectoire se prépare depuis les positions d’arrivée.');
 a.go(13,11).act('RRR').go(18,9);
 a.stage('La Barde franchit la traverse reconstruite. Elle a laissé libre l’appui du retour : le Voleur peut maintenant rapporter la caisse depuis la réserve haute.');
 a.select('thief').act('DDDDDDDDL');
 a.stage('Le Voleur extrait la caisse contre le mur, traverse l’appui déposé puis la plateforme et la ramène dans la cour. Retirer l’appui nord avant ce passage couperait ce retour.');
 a.go(10,9,'warrior').act('LLL').go(6,8).act('DD');
 a.stage('Le Guerrier pousse la caisse et le Marchand dans la même rangée. La caisse remplace le Marchand sur la commande sans aucun relâchement : la plateforme et la porte restent ouvertes.');
 a.go(17,9,'merchant');a.go(17,10,'warrior');a.go(18,10,'thief');
 return a.result({objective:'Déposer un des trois appuis pour le retour de la caisse, préparer la traverse finale avec les deux autres, puis remplacer le passeur par une poussée de rangée.',label:'Low Heroes — énigme 19',url:'https://sinkingstarwalkthrough.com/fr/low-heroes-solutions/',puzzles:[19],secondaryLabel:'Heroes and Water — énigme 34',secondaryUrl:'https://sinkingstarwalkthrough.com/fr/heroes-and-water-solutions/'},'Low Heroes 19 fournit la décision de déposer une partie du dispositif de transport pour rendre un passage possible, puis de réorganiser les éléments restants. Water 34 fournit la préparation d’une configuration de départ à partir de la trajectoire d’arrivée. SS22 utilise trois appuis qui ne déplacent jamais de passager : l’un reste dans une branche pour le retour du Voleur et d’une caisse sèche, les deux autres sont conduits autour de la cour vers une traverse distincte. Une plateforme tenue par le Marchand complète le retour. Le Guerrier réalise enfin une relève continue en poussant ensemble la caisse et ce Marchand. La réserve ne doit pas être immergée. Les cartes, les mouvements d’un pas, le détour de commande et les quatre arrivées sont recomposés ; aucun empilement, véhicule porteur, feu, quota ou déclencheur de victoire caché.');
}

if(process.argv[1]?.endsWith('build-level8.mjs')){const d=build();writeFileSync(new URL('../level8-design.json',import.meta.url),JSON.stringify(d,null,2)+'\n');console.log(JSON.stringify({title:spec.title,metrics:d.metrics,commands:d.commands}));}
