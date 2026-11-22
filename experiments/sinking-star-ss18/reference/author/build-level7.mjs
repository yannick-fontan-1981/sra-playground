import {Author,board} from './author.mjs';
import {writeFileSync} from 'node:fs';
const b=board(20,20,'#');
// A dock and four narrow alcoves, joined only by a water channel with side berths.
b.fill(8,3,9,14);b.fill(4,12,9,14);b.fill(10,3,10,12,'~');
for(const y of [4,6,8,10])b.fill(11,y,13,y);
for(const y of [5,7,9,11])b.put(11,y,'~');
b.put(11,5,'s');b.put(12,8,'o');b.put(12,10,'o');b.put(14,10,'~');
b.put(12,4,'M');b.put(8,5,'B');b.put(8,13,'Z');
b.put(13,6,'g');b.put(13,10,'g');b.put(5,13,'g');
export const spec={id:'ss18-07',title:'La navette des alcôves',rows:b.strings(),facing:'N',circuits:[{id:'vue',buttons:[{x:13,y:8}],color:15}],gates:[{at:{x:11,y:10},circuit:'vue',direction:'E',closedWhen:'released'}]};
export function build(){
 const a=new Author(spec);
 const stage=label=>{a.stage(label);if(process.env.SS18_AUTHOR_DEBUG)console.log(label,a.commands.length,JSON.stringify(a.state));};
 a.go(11,4,'merchant').act('DDRR');
 stage('Le Marchand traverse le premier appui et se range au fond de l’alcôve : ce recul le met hors de portée du chant suivant.');
 a.select('bard').act('RLDDR');
 stage('L’appui quitte son poste latéral, contourne la terre sèche par le chenal et vient desservir la deuxième traversée.');
 a.go(11,6,'merchant').act('DDR');
 stage('Le Marchand pousse la réserve au fond de l’alcôve. Cette charge ouvre la fenêtre du dernier débarcadère et doit y rester pendant les traversées suivantes.');
 a.select('bard').act('LDDR');
 a.go(11,8,'merchant').act('DDRR');
 stage('Au dernier débarcadère, le Marchand pousse l’obstacle jusqu’à l’eau. La ligne de relève est enfin dégagée et la caisse de l’alcôve précédente maintient sa fenêtre ouverte.');
 a.go(8,10,'wizard').act('R');
 stage('Le Magicien rejoint l’alcôve terminale par échange ; le Marchand récupéré sur le quai peut rejoindre la destination ouest.');
 a.go(5,13,'merchant');
 a.select('bard').act('LUUURRRRR');
 stage('Le Barde ramène la navette par le chenal. La berge la retient lors du changement d’axe ; son arrivée ancre l’appui sous ses pieds, puis il gagne l’alcôve centrale.');
 return a.result({puzzle:27,label:'Adaptation de Heroes and Water · énigme 27 · recaler un appui grâce aux butées',url:'https://sinkingstarwalkthrough.com/fr/heroes-and-water-solutions/',secondaryLabel:'Heroes and Light · énigme 40 · faire contourner l’obstacle à la charge',secondaryUrl:'https://sinkingstarwalkthrough.com/fr/heroes-and-light-solutions/',objective:'Acheminer un appui par un chenal latéral, garer le passager hors du chant, dégager une visée de relève puis changer l’axe de la dernière traversée.'},{kind:'adaptation',preserved:['Water 27 : le trajet de l’appui et celui du Barde diffèrent ; les butées modifient leur écart avant un nouveau passage.','Light 40 : une charge doit contourner le passage que le chant ne peut lui faire traverser directement.'],changed:['Quatre alcôves en peigne remplacent les quatre rives de SS15 ; une charge laissée dans l’avant-dernière alcôve ouvre la fenêtre de relève finale.','Le passager doit se garer au fond des alcôves avant le déplacement de la navette ; rester au bord perturbe le chant.','Le Marchand réserve un poids pour la fenêtre de relève, convertit l’obstacle terminal en appui, puis le Magicien le relève à distance.','Le dernier trajet du Barde utilise l’appui transversalement, et non dans l’axe des traversées précédentes.','Il n’existe ni empilement ni déplacement double : les appuis mobiles et leurs ancrages suivent le contrat SS18.'],sourceReading:'Le principe du recalage par butées est repris, mais la géométrie en peigne, la relève par échange et les destinations dispersées sont une composition originale.',proofScope:'Parcours légal et effets locaux du chant ; aucune unicité ni optimalité revendiquée.'});
}
if(process.argv[1]?.endsWith('build-level7.mjs')){const d=build();writeFileSync(new URL('../level7-design.json',import.meta.url),JSON.stringify(d,null,2)+'\n');console.log(JSON.stringify({title:spec.title,metrics:d.metrics,commands:d.commands}));}
