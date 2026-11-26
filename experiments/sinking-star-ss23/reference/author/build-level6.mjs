import {writeFileSync} from 'node:fs';
import {Author,board} from './author.mjs';

const b=board(20,16);
b.fill(1,5,7,12);b.put(5,8,'#');
b.fill(8,7,10,8);b.fill(8,9,10,10,'~');
b.put(8,7);b.put(8,8);b.put(9,8);b.put(10,8);
b.fill(12,5,17,10);b.fill(10,6,11,6);b.put(11,8);
b.fill(8,3,14,3,'~');b.fill(8,4,8,6,'~');b.put(14,4,'~');
b.put(8,3,'2');b.put(14,3,'3');
b.fill(1,1,5,3);b.put(3,4);
for(const x of [1,2,3,4])b.put(x,1,'g');
b.put(4,7,'W');b.put(5,7,'o');b.put(6,7,'o');b.put(7,8,'B');b.put(14,7,'Z');b.put(3,11,'M');

export const spec={id:'ss23-06',title:'Le poste derrière la file',mode:'quartet',rows:b.strings(),facing:'E',
 circuits:[{id:'prise',color:10,buttons:[{x:10,y:8}]},{id:'rangement',color:11,buttons:[{x:6,y:8},{x:7,y:8}]}],
 gates:[{at:{x:8,y:8},circuit:'prise',direction:'W',closedWhen:'released'},{at:{x:3,y:4},circuit:'rangement',direction:'N',closedWhen:'released'}]};

export function build(){
 const a=new Author(spec);
 a.select('warrior').act('RRRR');
 a.stage('Le Guerrier avance les deux blocs dans le couloir supérieur. Le mur de fond interdit de poursuivre tout droit et la presse fermée interdit de passer sous la file.');
 a.select('bard').act('D');
 a.stage('Depuis la bordure de sa portée, la Barde fait descendre seulement le bloc de gauche. L’autre reste contre le mur : il faut travailler depuis le poste au-dessus de lui.');
 a.select('wizard').act('U');
 a.stage('Les deux faces blanches font contourner la file à la visée du Magicien. L’échange déploie le Guerrier dans l’atelier droit sans déplacer les blocs et replace le Magicien dans le couloir gauche.');
 a.go(10,6,'warrior').act('D').go(11,8).act('LL');
 a.stage('Le Guerrier rejoint le poste haut, aligne les deux blocs en bas, puis les pousse ensemble. Quand il quitte la commande, la presse latérale se referme et pousse la paire jusque sur les deux boutons de rangement.');
 a.go(5,12,'wizard');a.go(4,12,'warrior');a.go(1,12,'merchant');
 a.go(3,9,'bard').go(1,1);
 a.stage('La Barde se retire vers la gauche : la butée y retient les blocs pendant ses pas chantés. Partir vers le haut ou le bas déplacerait au contraire le rangement.');
 a.go(2,1,'wizard');a.go(3,1,'warrior');a.go(4,1,'merchant');
 return a.result({objective:'Séparer une caisse de la file, déployer le Guerrier à l’autre poste, puis utiliser la fermeture latérale pour ranger les deux poids.',label:'Heroes and Stones, West — énigme 9',url:'https://sinkingstarwalkthrough.com/fr/heroes-and-stones-west-solutions/',puzzles:[9]},'Stones West 9 fournit le changement de poste du Guerrier par échange du Magicien afin de reprendre une charge depuis une autre face. SS23 remplace le ricochet et le chronomètre par des accès physiques : le mur de fond et la presse interdisent la reprise depuis le couloir gauche. Le chant place seulement le bloc situé sur sa bordure de portée ; une visée coudée par deux miroirs amène le Guerrier dans l’atelier droit ; sa poussée de file relâche ensuite la commande et la presse range les deux blocs. Les miroirs fixes et la presse relèvent du contrat SRA, sans feu, bateau, vitesse double ni déclenchement temporel. La sortie de la Barde utilise la butée du rangement pour laisser les deux poids en place.');
}

if(process.argv[1]?.endsWith('build-level6.mjs')){const d=build();writeFileSync(new URL('../level6-design.json',import.meta.url),JSON.stringify(d,null,2)+'\n');console.log(JSON.stringify({title:spec.title,metrics:d.metrics,commands:d.commands}));}
