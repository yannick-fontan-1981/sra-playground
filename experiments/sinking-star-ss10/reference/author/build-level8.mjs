import {readFileSync} from 'node:fs';
import {Author,board} from './author.mjs';

// The visual-source coordinates omit the surrounding water border.
const grid=JSON.parse(readFileSync(new URL('../heroes-and-water-03-grid.json',import.meta.url),'utf8'));
const {put,strings}=board(grid.terrainRows[0].length+2,grid.terrainRows.length+2,'~');
grid.terrainRows.forEach((row,y)=>[...row].forEach((cell,x)=>put(x+1,y+1,cell)));
for(const p of grid.crates)put(p.x+1,p.y+1,'o');
put(grid.heroes.warrior.x+1,grid.heroes.warrior.y+1,'W');
put(grid.heroes.thief.x+1,grid.heroes.thief.y+1,'T');
const spec={id:'ss10-08',title:'Les cinq points d’appui',rows:strings(),facing:'W'};
const a=new Author(spec),go=(x,y,kind)=>a.go(x+1,y+1,kind);

go(6,0,'warrior').act('DD');go(7,3).act('LLLLL');
a.stage('Premier appui à gauche : le Guerrier amène une caisse sur la passerelle et la pousse au-delà du coude.');

go(2,4,'warrior');go(7,2,'thief').act('DD');go(8,4);go(6,3).act('LLLLL');
a.select('warrior').act('U');
a.stage('Deuxième appui en haut : le Guerrier attend sous le coude pendant que le Voleur tire la caisse depuis le premier appui.');

a.act('U');go(8,2,'thief').act('DD');go(9,4);go(7,3).act('LLLLLL');
a.select('warrior').act('DD');
a.stage('Troisième appui vers le bas : depuis le nouvel appui supérieur, le Guerrier comble le trou qui donne accès à la passerelle inférieure.');

go(3,3,'warrior');go(4,6,'thief');go(9,0,'warrior').act('DD');go(10,3).act('LLLLLLL');
go(2,4,'thief').act('DDRR');go(2,4,'warrior').act('D');
go(3,6,'thief').act('RU');go(2,6,'warrior').act('RR');
a.stage('Quatrième appui à droite : le Voleur reçoit la caisse par le bas, la tire latéralement puis se gare dans la niche pour laisser pousser le Guerrier.');

go(9,0,'warrior');go(9,1,'thief').act('L');go(4,6,'thief');
a.select('warrior').act('DD');go(10,3).act('LLLLLLL');
go(2,4,'thief').act('DDRR');go(2,4,'warrior').act('D');
go(3,6,'thief').act('RU');go(2,6,'warrior').act('RRR');
a.stage('La dernière caisse est garée provisoirement sur la destination droite pour ménager assez de place aux deux héros.');

a.select('thief').act('DL');a.select('warrior').act('U');
a.stage('Échange de places : le Voleur tire le Guerrier vers la gauche, puis le Guerrier occupe la niche latérale.');

a.select('thief').act('RRLLLU');a.select('warrior').act('DLL');
a.stage('Cinquième appui à gauche : le Voleur ramène la caisse devant le Guerrier, puis libère le passage pour la poussée finale.');
go(0,6,'warrior');go(6,6,'thief');
a.stage('Les deux héros rejoignent les deux destinations au bout des cinq appuis construits.');

a.save(new URL('../level8-design.json',import.meta.url),{
  label:'Reprise de Heroes and Water · énigme 3 · les cinq points d’appui',
  url:grid.source,puzzle:3,
  objective:'Construire les cinq appuis dans les directions gauche, haut, bas, droite puis gauche, et échanger les positions des héros pour livrer la dernière caisse.'
},'Topologie des cellules, cinq caisses et positions initiales des deux héros relevées dans la capture et les storyboards publics de Heroes and Water 3 (Postmode, départ vers 0:25 ; disposition initiale visible à 0:30). La capture du guide montre une étape intermédiaire après quatre appuis : elle n’a pas été interprétée comme un départ avec quatre plateformes déjà construites. Les planches et le grand dallage deviennent du sol gris, les haies solides des murs gris foncé et les deux dalles orange des destinations jaunes. Une couronne d’eau d’une cellule conserve l’eau autour de la salle. Aucun miroir, bouton, porte ou monstre n’est ajouté. Les règles, sprites 3×3 et animations sont ceux du duo SS10.');
