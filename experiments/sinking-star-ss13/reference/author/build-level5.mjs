import {Author,board} from './author.mjs';
const {put,fill,strings}=board(20,14,'~');
fill(1,1,5,9);put(2,10);put(3,10,'#');put(2,3,'T');put(4,4,'Z');
fill(8,2,13,9);put(11,4,'m');put(8,7,'o');
fill(15,6,18,10);put(17,7,'g');put(17,9,'g');
const spec={id:'ss13-05',title:'Le gardien devenu poids',rows:strings(),facing:'E',
 mirrors:[{at:{x:2,y:10},facing:'NE'}],
 circuits:[{id:'deux-poids',buttons:[{x:4,y:4},{x:11,y:7}],color:10}],
 platforms:[{at:{x:14,y:8},circuit:'deux-poids',activeWhen:'pressed'}]};
const a=new Author(spec);
a.go(2,9,'thief').act('U').stage('Le Voleur tire le miroir au-dessus du mur qui coupait son rayon horizontal');
a.act('R').go(2,3).stage('Le Voleur se décroche du miroir et prépare son point de reflet');
a.select('wizard').act('R').stage('Le Magicien traverse l’eau en laissant le monstre vivant sur la première commande');
a.go(11,7).act('L').stage('La caisse remplace le Magicien sur la seconde commande et le passage final apparaît');
a.go(17,7).stage('Le Magicien rejoint la rive finale, loin du gardien conservé comme poids');
a.select('thief').act('X').stage('Le miroir déplacé livre le Voleur sur la deuxième île');
a.go(17,9).stage('Les deux héros empruntent le passage tenu par le monstre et la caisse');
a.save(new URL('../level5-design.json',import.meta.url),{
 puzzle:15,label:'Adaptation de Heroes 2: Monsters · énigme 15 · le monstre comme poids durable',
 url:'https://sinkingstarwalkthrough.com/fr/heroes-2-monsters-solutions/#%C3%A9nigme-15',
 objective:'Échanger avec un monstre pour maintenir une commande distante, puis placer une caisse sur la seconde et transporter le Voleur par le miroir qu’il a déplacé.',
 piston:false,platform:true,
},'Le monstre et la caisse maintiennent deux boutons comme dans Heroes 2: Monsters 15. Le Magicien effectue les remplacements à distance sûre; aucun monstre ne doit être tué. Les îles, le miroir à extraire derrière son mur, la traction du Voleur et le pont hydraulique sont une composition originale destinée au duo SS13. La géométrie et la présence du partenaire diffèrent de la source.');
