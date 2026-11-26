import {writeFileSync} from 'node:fs';
import {Author,board} from './author.mjs';

const b=board(20,20);
b.fill(1,3,5,14);
b.fill(7,2,16,12);
b.put(6,4,'~');b.put(6,8,'~');
b.fill(2,16,4,18);b.put(3,15);
for(const [x,y] of [[2,18],[3,17],[4,18],[3,18]])b.put(x,y,'g');
for(const [x,y] of [[14,7],[15,8],[16,9]])b.put(x,y,'#');
for(const [x,y] of [[7,7],[8,7],[9,7],[7,8],[9,8],[9,10],[10,10],[11,10]])b.put(x,y,'o');
b.put(8,8,'Z');b.put(3,8,'B');b.put(1,12,'M');b.put(2,12,'W');b.put(2,4,'o');

export const pattern=[[11,3],[12,3],[13,3],[12,4],[13,4],[12,6],[13,6],[14,8],[14,9]];
export const spec={id:'ss23-08',title:'La forme et la place vide',mode:'quartet',rows:b.strings(),facing:'W',
 circuits:[{id:'composition',color:11,buttons:pattern.map(([x,y])=>({x,y}))}],
 gates:[{at:{x:3,y:15},circuit:'composition',direction:'S',closedWhen:'released'}]};

export function build(){
 const a=new Author(spec);
 a.select('wizard').act('LL');
 a.stage('Le premier échange déplace la lacune du fragment supérieur ; le second y installe la Barde, de l’autre côté de la coupure d’eau. Le rang inférieur est séparé par une ligne vide et décalé de deux cases.');
 a.select('bard').act('RRRRR');
 a.stage('Au début, les blocs du fragment inférieur hors portée retiennent ceux qui entendent déjà le chant. Quand la Barde avance, ce rang entre dans la portée et rejoint le mouvement. Les butées arrêtent ensuite les rangs à des moments différents.');
 a.act('UUUU');
 a.stage('Le rang de droite reste contre sa butée tandis que les six autres blocs montent. Huit boutons sont couverts et la Barde occupe la neuvième place, au milieu de la composition.');
 a.go(5,4,'wizard').act('R');
 a.stage('Le Magicien extrait la Barde par la seconde fenêtre. Aucun chant ne touche aux huit blocs déjà placés ; le Magicien occupe maintenant la place restée vide dans le motif.');
 a.select('bard').act('DDD').go(3,12);
 a.go(1,4,'merchant').act('RRR').act('D');
 a.stage('Le Marchand amène le bloc de réserve devant la fenêtre de retour. Ce bloc est la cible de sortie du Magicien et deviendra le neuvième poids.');
 a.select('wizard').act('L');
 a.stage('L’échange final remplace le Magicien par la réserve au cœur du motif. Tous les boutons restent couverts quand les quatre héros quittent l’atelier.');
 a.go(1,9,'warrior');a.go(2,17,'wizard');a.go(4,17,'merchant');a.go(3,14,'bard').act('DDDD');
 a.stage('Le dernier déplacement chanté range le Marchand et le Magicien contre le fond de la salle d’arrivée. Le Guerrier ferme le cortège sur la quatrième destination.');
 a.go(3,17,'warrior');
 return a.result({objective:'Réunir et déformer deux fragments décalés, extraire la Barde sans chanter, puis remplir la dernière place en faisant sortir le Magicien.',label:'Heroes and Light — énigmes 52–53',url:'https://sinkingstarwalkthrough.com/fr/heroes-and-light-solutions/',puzzles:[52,53]},'Les énigmes 52–53 donnent le principe d’un ensemble de cristaux remodelé par la Barde en plusieurs morceaux ou en escalier. Le départ de SS23 possède deux fragments, séparés par une rangée vide et décalés de deux colonnes ; les membres hors portée retiennent d’abord le fragment inférieur. Les butées ordinaires et la portée du chant déforment ensuite les huit blocs conservés, sans faisceau multicolore, explosion ou empilement. Les deux fenêtres d’eau interdisent un simple accès à pied à l’atelier. Le Magicien prépare la lacune, y installe la Barde, la récupère à la fin puis transforme la réserve en neuvième poids en échangeant sa propre sortie. La forme n’est pas reconnue par un objectif caché : neuf boutons physiques commandent la porte, et seules les quatre arrivées terminent la salle.');
}

if(process.argv[1]?.endsWith('build-level8.mjs')){const d=build();writeFileSync(new URL('../level8-design.json',import.meta.url),JSON.stringify(d,null,2)+'\n');console.log(JSON.stringify({title:spec.title,metrics:d.metrics,commands:d.commands}));}
