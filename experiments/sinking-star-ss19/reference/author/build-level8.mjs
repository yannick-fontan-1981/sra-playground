import {Author,board} from './author.mjs';
import {writeFileSync} from 'node:fs';
const b=board(20,20,'#');
// Two L-shaped hunting pens above a broad workshop; a final island lies to the east.
b.fill(1,1,4,5);b.fill(2,5,2,9);b.fill(1,9,11,18);
b.fill(6,3,10,3);b.fill(6,3,6,6);b.put(10,3,'m');
b.fill(12,7,15,7);b.fill(12,7,12,11);b.put(15,7,'m');
b.fill(12,16,12,18);b.put(13,17,'~');b.fill(14,16,16,18);b.put(14,17,'g');
b.fill(13,11,17,11,'~');b.put(17,11,'.');b.fill(17,5,17,10,'~');b.put(17,5,'o');
b.put(8,15,'g');b.put(10,18,'g');
b.put(2,3,'W');b.put(4,5,'Z');b.put(8,10,'B');
export const spec={id:'ss19-08',title:'Les deux gardiens vivants',rows:b.strings(),facing:'N',
 mirrors:[{at:{x:17,y:11},facing:'NW'}],
 circuits:[
  {id:'reserve',buttons:[{x:17,y:5}],color:10},
  {id:'lacher',buttons:[{x:3,y:16}],color:7},
  {id:'gardien-ouest',buttons:[{x:6,y:6}],color:15},
  {id:'gardien-est',buttons:[{x:12,y:11}],color:12},
 ],
 gates:[
  {at:{x:11,y:11},circuit:'reserve',direction:'S',closedWhen:'released'},
  {at:{x:6,y:4},circuit:'lacher',direction:'N',closedWhen:'released'},
  {at:{x:12,y:8},circuit:'lacher',direction:'N',closedWhen:'released'},
  {at:{x:8,y:15},circuit:'gardien-ouest',direction:'W',closedWhen:'released'},
  {at:{x:10,y:18},circuit:'gardien-est',direction:'W',closedWhen:'released'},
 ],
};
export function build(){
 const a=new Author(spec);const stage=s=>{a.stage(s);if(process.env.SS19_AUTHOR_DEBUG)console.log(s,a.commands,JSON.stringify(a.state));};
 a.act('DDRL').go(3,2);
 stage('Le Guerrier attire les chasseurs vers les angles de leurs enclos. Les deux retenues fermées empêchent encore leur descente.');
 a.go(11,11,'wizard').act('R');
 stage('Le Magicien vise par le coude du miroir et remplace la réserve sur sa commande : le sas reste ouvert pendant l’extraction de la caisse unique.');
 a.select('bard').act('RL');
 stage('Le Barde décale la caisse hors du rayon de retour. Les chasseurs restent séparés derrière leurs retenues.');
 a.select('wizard').act('X');
 stage('Le reflet ramène le Magicien dans le sas ; la commande vide referme aussitôt la presse, qui le dépose au sud et rebouche le côté du futur gardien est.');
 a.go(5,13,'wizard');
 a.select('warrior').act('U');
 stage('Après la visée lointaine, le Guerrier rappelle le chasseur occidental dans son angle avant de descendre à son tour.');
 a.go(10,10,'warrior').act('DDDDDD').go(9,17).act('RRR');
 stage('La seule caisse mobile descend dans l’atelier puis traverse le quai. Elle devient l’unique appui qui permet d’augmenter le nombre d’occupants de l’île finale.');
 a.go(3,16,'warrior');
 stage('Le Guerrier ouvre les deux retenues. Depuis cette commande éloignée, il ne peut pas attirer seul le chasseur est jusqu’à sa plaque.');
 a.select('bard').act('DDDDD');
 stage('Le Barde devient la cible : sa colonne équilibre les distances et entraîne les chasseurs jusqu’aux deux boutons. Il prend sa destination après leur stabilisation.');
 a.go(10,18,'wizard');
 a.go(14,17,'warrior');
 stage('Les trois arrivées gardent les chasseurs tournés vers leurs butées. Les deux monstres restent vivants et maintiennent les presses-buts ; le Guerrier traverse le seul appui jusqu’à l’île.');
 return a.result({puzzle:'15 / 22 / 29',label:'Adaptation de Heroes 2: Monsters · énigmes 15, 22 et 29 · conserver des monstres comme poids',url:'https://sinkingstarwalkthrough.com/fr/heroes-2-monsters-solutions/',secondaryLabel:'Heroes and Water · énigme 11 · un échange conserve le nombre d’occupants',secondaryUrl:'https://sinkingstarwalkthrough.com/fr/heroes-and-water-solutions/',objective:'Récupérer la caisse unique avant d’ouvrir les enclos, préparer le pont, changer de cible pour garer les deux chasseurs vivants, puis maintenir leurs positions pendant les trois arrivées.'},{kind:'adaptation',preserved:['Heroes 2 15/22 : des monstres occupent des commandes utiles et doivent être conservés.','Heroes 2 29 : préparer les poids avant de libérer les héros vers les destinations.','Water 11 : la transposition conserve les effectifs ; une traversée physique est nécessaire pour remplir l’île vide.'],changed:['Les chasseurs suivent la règle déterministe SS19 : un pas vers le héros actif, sur l’axe le plus long, vertical en cas d’égalité. Les retenues et les deux enclos en L rendent leur position contrôlable.','Une réserve éloignée sert d’abord à conserver le sas optique ouvert, puis devient le seul appui du dernier passage. La fermeture du sas dépose le Magicien et forme ensuite la butée ouest d’un chasseur.','Le Guerrier tient la commande de libération tandis que le Barde attire les ennemis depuis une autre colonne. Quitter trop tôt la commande renvoie les chasseurs vers le haut.','Aucun compteur d’élimination ni condition cachée : deux destinations sont des presses commandées par les deux plaques visibles.'],sourceReading:'Les monstres-poids et la relève des commandes viennent des guides ; la poursuite, les enclos en L, le sas de retour et la géométrie du passage final sont propres à SS19.',proofScope:'À WIN, les trois héros occupent les buts. La caisse unique a dû devenir appui pour atteindre l’île vide, et le miroir ne peut quitter son socle. Les seuls poids disponibles pour les deux presses-buts sont donc les deux monstres vivants. Éliminer l’un d’eux rend la victoire impossible sans annuler ou recommencer. Aucun parcours unique ni optimal n’est revendiqué.'});
}
if(process.argv[1]?.endsWith('build-level8.mjs')){const d=build();writeFileSync(new URL('../level8-design.json',import.meta.url),JSON.stringify(d,null,2)+'\n');console.log(JSON.stringify({title:spec.title,metrics:d.metrics,commands:d.commands}));}
