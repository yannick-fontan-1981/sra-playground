import {Author,board} from './author.mjs';

// Original teaching room: extraction, a two-crate file, a remote press,
// a useful hero exchange, a moved mirror, a bent ray and a held water bridge.
const {put,fill,strings}=board(19,14);
fill(1,2,5,5);put(3,1,'o');put(4,1);put(5,1);put(3,4,'Z');put(1,4,'W');put(4,4,'o');
put(6,4,'~');put(7,4,'~');fill(8,4,11,5);put(7,5);put(9,5,'#');
// The press cannot be reached from above, right or below. Only its left exit is usable.
put(9,6,'o');put(8,6,'~');put(8,7);fill(8,8,11,11);
fill(12,10,15,10,'~');fill(16,7,17,10);put(16,10,'o');put(16,7,'g');put(17,9,'g');
const spec={
  id:'ss11-01',title:'L’atelier des relais',rows:strings(),facing:'E',
  mirrors:[{at:{x:10,y:10},facing:'NE'}],
  circuits:[{id:'presse',buttons:[{x:8,y:4}],color:0},{id:'passerelle',buttons:[{x:17,y:10}],color:14}],
  gates:[{at:{x:9,y:6},circuit:'presse',direction:'W',closedWhen:'pressed'}],
  platforms:[{at:{x:14,y:10},circuit:'passerelle',activeWhen:'pressed'},{at:{x:15,y:10},circuit:'passerelle',activeWhen:'pressed'}],
};
const a=new Author(spec);
a.select('wizard').act('UR').stage('Le Magicien extrait la caisse de l’alcôve par échange et libère l’axe');
a.go(2,4,'warrior').act('RRRR').stage('Le Guerrier avance toute la file : les deux caisses deviennent deux appuis');
a.go(7,4).act('R').stage('Le bouton rose-blanc commande la presse isolée et construit le troisième appui');
a.go(9,10).act('R').stage('Le Guerrier place le miroir sur l’axe de la traversée');
a.go(8,8).go(8,5,'wizard').act('D').stage('Le Magicien échange sa place avec le Guerrier pour franchir le passage en un rayon');
a.go(11,8).act('D').stage('Le rayon tourne sur la face blanche et échange le Magicien avec la caisse distante');
a.act('R').stage('Le Magicien tient les deux plateformes vertes d’arrivée');
a.act('X').stage('Le reflet transporte la caisse la plus proche dans l’eau : le quatrième appui est prêt');
a.go(11,8,'warrior').act('X').stage('Le reflet prend le Guerrier proche et laisse le Magicien à la commande');
a.act('RRR').go(16,7).stage('Le Guerrier traverse l’appui et les deux plateformes, puis rejoint la première cible');
a.select('wizard').act('U').stage('Les deux destinations sont occupées ; la passerelle peut se retirer');
a.save(new URL('../level1-design.json',import.meta.url),{
  label:'Tutoriel original · Guerrier et Magicien · règles des Héros du Nord',
  url:'https://sinkingstarwalkthrough.com/fr/north/',
  piston:true,platform:true,
  objective:'Extraire la première caisse, pousser la file dans l’eau, commander la presse puis relayer les deux héros par échanges et reflets jusqu’aux deux cibles.',
},'Création pédagogique pour SS11. La structure de l’atelier SS08 est étendue à une file de deux caisses, une traversée double et un échange entre héros. Les mécanismes du Nord sont enseignés avec une presse latérale isolée, un miroir mobile et deux plateformes temporaires. Aucune reproduction exacte d’une énigme source n’est revendiquée.');
