import {Author,board} from './author.mjs';

// Bard 19: extract cargo from a recessed alcove, change axis, leave it on
// the far command. The new quay requires carrying the support back first.
const b=board(18,15);
b.fill(2,3,9,3);
b.fill(2,3,2,12);
b.fill(3,2,3,5);
b.fill(2,6,5,12);
b.fill(5,7,7,7);
b.fill(7,5,7,12);
b.fill(8,5,8,12,'~');
b.fill(9,4,9,12);b.put(9,4,'~');
b.fill(10,3,12,3,'~');
b.fill(13,2,15,4);
b.put(3,2,'o');b.put(4,3,'2');
b.put(3,4,'B');b.put(2,6,'W');b.put(8,12,'s');
b.put(13,2,'g');b.put(15,3,'g');
const spec={id:'ss12-03',title:'Le quai ramené d’en bas',rows:b.strings(),
 circuits:[{id:'quai',buttons:[{x:8,y:3}],color:14}],
 gates:[{at:{x:6,y:7},circuit:'quai',direction:'E',closedWhen:'released'}]};
const a=new Author(spec);
a.select('bard').act('D').stage('La caisse est extraite de sa niche, à travers le mur');
a.go(2,3,'warrior').act('RRRRR').stage('La poussée commune pose le poids et règle le miroir au bout du quai');
a.go(7,12,'bard').act('UUUUU').stage('L’appui remonte depuis le cul-de-sac aquatique');
a.act('RRXU').stage('Le Barde franchit le quai puis prend le premier reflet');
a.go(9,7,'warrior').act('XRR');
a.save(new URL('../level3-design.json',import.meta.url),{
 label:'Adaptation de Heroes 3: Bard, Druid · énigme 19',
 url:'https://sinkingstarwalkthrough.com/fr/heroes-3-bard-druid-solutions/#%C3%A9nigme-19',puzzle:19,
 image:'https://sinkingstarwalkthrough.com/img/north/hauling-3/puzzle-19.webp',
 objective:'Extraire la caisse, pousser avec elle le miroir, puis ramener l’appui du canal pour donner accès aux deux reflets.'
},'La niche, le changement d’axe de la cargaison et le poids final de l’énigme 19 sont conservés comme structure causale. L’adaptation ajoute un miroir poussé dans la même file et un appui mobile à ramener depuis le fond du canal. Chaque héros doit prendre le reflet séparément.');
