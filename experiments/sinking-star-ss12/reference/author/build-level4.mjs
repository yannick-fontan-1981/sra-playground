import {Author,board} from './author.mjs';

// Monsters 22: two living enemies and a crate must remain as three weights.
// The lateral press turns a crate into a pocket unreachable from above.
const b=board(17,18);
b.fill(3,2,7,2);b.fill(7,2,7,6);
b.fill(1,4,7,4);b.fill(1,4,1,11);
b.fill(1,8,4,8);b.put(4,9);
b.fill(1,11,6,11);
b.fill(6,6,11,12);
b.fill(13,6,13,11);
b.fill(8,12,8,15);b.fill(7,15,10,16);
b.put(3,2,'m');b.put(13,6,'m');
b.put(3,4,'B');b.put(1,8,'W');b.put(2,8,'1');b.put(3,8,'o');
b.put(7,16,'g');b.put(10,16,'g');
const spec={id:'ss12-04',title:'Les trois poids sous garde',rows:b.strings(),
 circuits:[
  {id:'poche',buttons:[{x:9,y:10}],color:0},
  {id:'sortie',buttons:[{x:7,y:4},{x:13,y:11},{x:4,y:9}],color:14}
 ],gates:[
  {at:{x:4,y:8},circuit:'poche',direction:'S',closedWhen:'released'},
  {at:{x:8,y:13},circuit:'sortie',direction:'S',closedWhen:'released'}
 ]};
const a=new Author(spec);
a.select('bard').act('RRRRDD').stage('Le premier monstre descend sur le bouton du coude');
a.act('RRRRDDDDDLLU').stage('Le second monstre reste à droite, le Barde prend la commande de la presse');
a.select('warrior').act('R').stage('Le Guerrier pousse ensemble le miroir obturateur et la caisse vers la presse ouverte');
a.select('bard').act('U').stage('La presse envoie le troisième poids dans la poche inaccessible');
a.go(10,16,'bard').stage('Le Barde quitte la zone des chants en laissant les trois contrepoids');
a.go(7,16,'warrior');
a.save(new URL('../level4-design.json',import.meta.url),{
 label:'Adaptation de Heroes 2: Monsters · énigme 22',
 url:'https://sinkingstarwalkthrough.com/fr/heroes-2-monsters-solutions/#%C3%A9nigme-22',puzzle:22,
 image:'https://sinkingstarwalkthrough.com/img/north/hauling-2/puzzle-22.webp',
 objective:'Garder les deux monstres vivants sur leurs boutons, puis livrer le troisième poids par une presse latérale.'
},'La condition de l’énigme 22 est reprise : deux monstres et une caisse occupent trois boutons. L’échange du jeu source est remplacé par deux parcours de chant à distance sûre. La caisse ne peut atteindre son bouton que par la fermeture sud de la presse. Le miroir qui bouche l’entrée impose une poussée en file du Guerrier ; son reflet rencontre un mur. Les murs arrêtent chaque monstre à son poste lorsque le Barde change d’axe.');
