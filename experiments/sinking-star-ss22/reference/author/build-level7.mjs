import {writeFileSync} from 'node:fs';
import {Author,board} from './author.mjs';

const b=board(19,18);
b.fill(1,2,8,15);
b.fill(9,3,10,13,'~');
for(const y of [9,11,13])b.put(9,y,'#');
b.fill(11,3,14,6);
b.fill(12,10,15,12);b.put(11,12);
b.put(9,4,'s');b.put(10,4,'s');
b.put(8,3,'B');b.put(12,3,'M');b.put(13,4,'W');b.put(12,6,'T');
for(const x of [12,13,14,15])b.put(x,10,'g');

export const spec={id:'ss22-07',title:'Les cales du bassin',mode:'quartet',rows:b.strings(),facing:'S'};

export function build(){
 const a=new Author(spec);
 a.select('bard').act('D').go(6,4);
 a.stage('Les deux appuis forment le pont du débarcadère supérieur. La Barde se décale sur le quai pour laisser les trois voyageurs passer.');
 a.go(2,3,'merchant');a.go(2,6,'warrior');a.go(2,9,'thief');
 a.stage('Les trois voyageurs ont quitté les appuis. Un appui occupé par un héros ne transporte pas son passager : tenter de déplacer le pont avant le débarquement serait refusé.');
 a.go(8,4,'bard').act('DDDDDD');
 a.stage('La première butée retient l’appui de gauche. Celui de droite continue seul, donnant deux hauteurs différentes au dispositif.');
 a.go(7,8).act('RDDDD');
 a.stage('Depuis un poste décalé, la Barde engage le premier appui dans la seconde colonne. Les deux descendent ensuite en file jusqu’à la butée basse.');
 a.act('LDDDRU');
 a.stage('La butée basse retient un appui pendant que l’autre se décale à gauche. Un détour par le bas reprend seulement le second et rétablit le pont devant l’unique entrée de la cour finale.');
 a.go(8,12).act('RRR').go(15,10);
 a.stage('La Barde embarque et débarque à pied sur le pont reconstitué. Les appuis demeurent en place pour les trois autres arrivées.');
 a.go(12,10,'merchant');a.go(13,10,'warrior');a.go(14,10,'thief');
 return a.result({objective:'Évacuer le débarcadère supérieur, faire contourner trois butées aux deux appuis vides, puis rétablir un pont devant la cour finale.',label:'Heroes and Water — énigme 33',url:'https://sinkingstarwalkthrough.com/fr/heroes-and-water-solutions/',puzzles:[33]},'Water 33 fournit le principe de calage contre des obstacles et de correction séparée du voyageur et de son dispositif. Ici les deux appuis ne portent personne pendant leur déplacement : la présence d’un héros les ancre, et un chant qui laisserait un héros sans appui est refusé. Les trois voyageurs débarquent avant la réorganisation. Une colonne de trois butées transforme la paire horizontale en file, puis en paire devant une autre entrée. Le chant agit dans un carré de cinq cases, les appuis vides glissent seulement entre cases d’eau, sans empilement, vitesse double, statue spéciale ou nouveau type de terrain.');
}

if(process.argv[1]?.endsWith('build-level7.mjs')){const d=build();writeFileSync(new URL('../level7-design.json',import.meta.url),JSON.stringify(d,null,2)+'\n');console.log(JSON.stringify({title:spec.title,metrics:d.metrics,commands:d.commands}));}
