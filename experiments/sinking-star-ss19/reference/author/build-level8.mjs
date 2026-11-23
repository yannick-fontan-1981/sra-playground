import {Author,board} from './author.mjs';
import {writeFileSync} from 'node:fs';
const b=board(20,20,'#');
// A song gallery, an optical delivery press and one empty island: every move has a visible cause.
b.fill(1,9,11,18);b.fill(4,5,8,5);b.fill(4,5,4,9);b.fill(4,8,8,8);
b.fill(6,3,10,3);b.fill(6,3,6,7);b.put(10,3,'m');
b.fill(12,16,12,18);b.put(13,17,'~');b.fill(14,16,16,18);b.put(14,17,'g');
b.fill(12,11,17,11,'~');b.put(13,11,'.');b.put(13,12,'.');b.put(17,11,'.');
b.fill(17,5,17,10,'~');b.put(17,5,'o');b.put(17,7,'m');
b.put(8,15,'g');b.put(10,18,'g');
b.put(5,12,'W');b.put(2,12,'Z');b.put(8,5,'B');
export const spec={id:'ss19-08',title:'Les deux gardiens vivants',rows:b.strings(),facing:'N',
 mirrors:[{at:{x:17,y:11},facing:'NW'}],
 circuits:[
  {id:'reserve',buttons:[{x:17,y:5}],color:10},
  {id:'livraison',buttons:[{x:3,y:16}],color:14},
  {id:'gardien-ouest',buttons:[{x:6,y:6}],color:15},
  {id:'gardien-est',buttons:[{x:13,y:12}],color:12},
 ],
 gates:[
  {at:{x:11,y:11},circuit:'reserve',direction:'S',closedWhen:'released'},
  {at:{x:13,y:11},circuit:'livraison',direction:'S',closedWhen:'pressed'},
  {at:{x:6,y:7},circuit:'gardien-ouest',direction:'S',closedWhen:'pressed'},
  {at:{x:8,y:15},circuit:'gardien-ouest',direction:'W',closedWhen:'released'},
  {at:{x:10,y:18},circuit:'gardien-est',direction:'W',closedWhen:'released'},
 ],
};
export function build(){
 const a=new Author(spec);const stage=s=>{a.stage(s);if(process.env.SS19_AUTHOR_DEBUG)console.log(s,a.commands,JSON.stringify(a.state));};
 a.act('X');
 stage('Le reflet prend le monstre le plus proche et le dépose sur la presse optique. La caisse plus lointaine reste sur la commande de réserve.');
 a.go(4,16,'warrior').act('L');
 stage('La commande verte ferme la presse : le gardien oriental descend visiblement sur son bouton orange, hors du rayon.');
 a.act('R');
 stage('Le Guerrier relâche la commande pour rouvrir la presse vide ; un monstre déplacé ne dégage pas à lui seul un rayon encore barré.');
 a.select('bard').act('LLLLDDD');
 stage('Le chant fait suivre au gardien ouest son rail puis sa descente, à travers la cloison. Son bouton violet ferme la porte derrière lui et ouvre la destination occidentale.');
 a.go(11,11,'wizard').act('R');
 stage('Le rayon coudé atteint maintenant la caisse unique. Le Magicien remplace la réserve sur sa commande pendant que la caisse arrive dans le sas.');
 a.go(9,10,'bard').act('L');
 stage('Le Barde écarte la caisse du rayon de retour, sans déplacer les deux gardiens hors de leurs commandes.');
 a.select('wizard').act('X');
 stage('Le reflet ramène le Magicien ; la commande de réserve vide referme le sas et la presse le dépose au sud.');
 a.go(5,13,'wizard');
 a.go(10,10,'warrior').act('DDDDDD').go(9,17).act('RRR');
 stage('La caisse descend dans l’atelier, change d’axe sur le quai et devient l’unique appui d’entrée de l’île encore vide.');
 a.go(8,15,'bard');
 a.go(10,18,'wizard');
 a.go(14,17,'warrior');
 stage('Les deux monstres, transportés par des dispositifs différents, gardent leurs boutons. Les trois héros occupent les trois destinations, dont l’île rejointe par le seul appui.');
 return a.result({puzzle:'15 / 22 / 29',label:'Adaptation de Heroes 2: Monsters · énigmes 15, 22 et 29 · conserver des monstres comme poids',url:'https://sinkingstarwalkthrough.com/fr/heroes-2-monsters-solutions/',secondaryLabel:'Heroes and Water · énigme 11 · un échange conserve le nombre d’occupants',secondaryUrl:'https://sinkingstarwalkthrough.com/fr/heroes-and-water-solutions/',objective:'Conduire un gardien par le chant, livrer l’autre par reflet puis presse, rouvrir le trajet pour récupérer la caisse unique et construire l’entrée de l’île vide.'},{kind:'adaptation',preserved:['Heroes 2 15/22 : des monstres occupent des commandes utiles et doivent être conservés.','Heroes 2 29 : préparer les poids avant de libérer les héros vers les destinations.','Water 11 : la transposition conserve les effectifs ; une traversée physique est nécessaire pour remplir l’île vide.'],changed:['Les monstres restent sur leur case tant qu’une poussée, un chant, un échange, un reflet ou une presse ne les transporte pas. Aucun déplacement autonome, aucune cible liée au héros actif.','Le gardien ouest suit un rail commandé par le chant à travers une cloison ; sa commande ferme une porte distincte qui permet au Barde de se dégager sans le reprendre.','Le gardien est masque la réserve sur le rayon. Un reflet le livre à une presse ; une commande verte le dépose ensuite sur son bouton orange. Il faut relâcher cette commande pour rouvrir le trajet optique.','La caisse unique occupe d’abord la commande de réserve, puis devient le seul appui du dernier passage. Les deux autres buts sont des presses reliées aux boutons visibles des gardiens.'],sourceReading:'Les monstres-poids et les relèves de commandes viennent des guides. La galerie de chant, la livraison en deux temps, le réemploi du rayon et la géométrie du passage final sont propres à SS19 ; aucune poursuite autonome n’est reprise.',proofScope:'À WIN, les trois héros occupent les buts. La caisse unique a dû devenir appui pour atteindre l’île initialement vide, hors des axes du miroir ; ce miroir est immobilisé par les murs de son socle. Les seuls poids disponibles pour les deux presses-buts sont donc les deux monstres vivants. Aucun compteur caché, parcours unique ni minimum de coups n’est imposé.'});
}
if(process.argv[1]?.endsWith('build-level8.mjs')){const d=build();writeFileSync(new URL('../level8-design.json',import.meta.url),JSON.stringify(d,null,2)+'\n');console.log(JSON.stringify({title:spec.title,metrics:d.metrics,commands:d.commands}));}
