import {writeFileSync} from 'node:fs';
import {Author,board} from './author.mjs';

const b=board(20,19);
b.fill(1,2,7,16);
b.fill(8,3,11,15,'~');
b.fill(12,4,18,15);
b.fill(16,4,16,15,'#');b.put(16,8);
b.fill(8,3,9,3);b.fill(9,4,9,7);
b.fill(8,10,10,12);
b.put(8,8,'s');b.put(10,8,'s');
b.put(7,8,'o');b.put(6,8,'W');b.put(5,5,'Z');b.put(8,10,'B');b.put(3,13,'M');
for(const [x,y] of [[17,4],[18,4],[17,5],[18,5]])b.put(x,y,'g');

export const spec={id:'ss23-07',title:'Le pas qui laisse un appui',mode:'quartet',rows:b.strings(),facing:'E',
 circuits:[{id:'passage',color:10,buttons:[{x:3,y:13}]}],
 gates:[{at:{x:8,y:3},circuit:'passage',direction:'W',closedWhen:'pressed'},{at:{x:16,y:8},circuit:'passage',direction:'E',closedWhen:'released'}],
 platforms:[{at:{x:9,y:8},circuit:'passage',activeWhen:'pressed'},{at:{x:10,y:8},circuit:'passage',activeWhen:'pressed'}]};

export function build(){
 const a=new Author(spec);
 a.select('warrior').act('R').go(3,12);
 a.go(5,8,'wizard').act('R');
 a.stage('Le Guerrier a posé la réserve sur le premier appui. Le Magicien l’échange depuis la rive : la réserve revient au sec et le Magicien ancre maintenant cet appui.');
 a.select('bard').act('R');
 a.stage('Un seul chant règle l’écart : l’appui vide avance jusqu’à la rive orientale, tandis que l’appui occupé reste à l’ouest. Le Magicien fait un pas sur la plateforme tenue par le Marchand ; il n’est jamais porté par un appui.');
 a.go(9,3,'wizard').act('D');
 a.stage('Le Magicien monte au poste nord puis échange avec la Barde. Elle quitte le poste de chant sans déplacer les appuis ; lui rejoint la galerie basse.');
 a.select('merchant').act('L');a.go(3,3,'bard');a.select('merchant').act('R');a.go(4,6,'wizard');
 a.stage('Le Marchand relâche brièvement le circuit lorsque personne ne se tient sur les plateformes. La porte nord s’ouvre pour la Barde, puis se referme quand le passage d’eau est rétabli : cette galerie ne permet pas de contourner l’appui occidental pendant la traversée.');
 a.go(6,8,'warrior').act('LL').go(3,7).act('DDDDD');
 a.stage('La réserve revenue au sec remplace le Marchand par une poussée de file. Le circuit reste enfoncé pendant la relève : les deux plateformes ne disparaissent pas.');
 a.go(18,5,'wizard');a.go(17,5,'merchant');
 a.go(5,8,'bard');a.go(4,8,'warrior').act('RRRR');
 a.stage('Le Magicien et le Marchand traversent d’abord. Le Guerrier installe ensuite la Barde sur la première plateforme sans chanter et se tient lui-même sur l’appui occidental.');
 a.select('bard').act('RRRR');
 a.stage('La Barde et le Guerrier finissent ensemble la traversée. Le Guerrier ancre encore le premier appui au début du passage, puis cet appui glisse derrière les deux derniers voyageurs. Aucun appui ne porte un passager pendant son déplacement.');
 a.go(12,12,'warrior');a.go(18,8,'bard').act('UUU');a.go(17,5,'warrior');
 return a.result({objective:'Choisir quel appui reste en place pendant le chant, retirer la Barde silencieusement, puis faire passer deux éclaireurs et le dernier duo.',label:'Heroes and Stones, West — énigmes 16–17',url:'https://sinkingstarwalkthrough.com/fr/heroes-and-stones-west-solutions/',puzzles:[16,17]},'Stones West 16 travaille les positions relatives par des mouvements différents ; le 17 prépare un élément qui sert de butée. SS23 emploie uniquement le contrat des appuis occupés : un héros ancre l’appui où il se trouvait au début du chant, tandis qu’un appui vide peut glisser d’eau en eau. Le Magicien choisit ce point d’ancrage par échange avec une réserve, puis est entraîné sur une plateforme par le chant. La Barde est extraite par un second échange depuis un poste éloigné. Une porte inverse du circuit ouvre sa sortie nord seulement lorsque les plateformes sont retirées. La réserve remplace ensuite le Marchand. Après les deux éclaireurs, le Guerrier installe la Barde sans chanter et ancre à son tour le premier appui pendant le départ du dernier duo. Aucun ricochet, vitesse double, bateau porteur, empilement ou effet de timing n’est repris.');
}

if(process.argv[1]?.endsWith('build-level7.mjs')){const d=build();writeFileSync(new URL('../level7-design.json',import.meta.url),JSON.stringify(d,null,2)+'\n');console.log(JSON.stringify({title:spec.title,metrics:d.metrics,commands:d.commands}));}
