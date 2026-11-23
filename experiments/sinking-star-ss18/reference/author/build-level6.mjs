import {Author,board} from './author.mjs';
import {writeFileSync} from 'node:fs';
const b=board(20,20,'~');
b.fill(0,0,19,0,'#');b.fill(0,19,19,19,'#');b.fill(0,0,0,19,'#');b.fill(19,0,19,19,'#');
// Three windmill arms around a split workshop. Water keeps the optical arrivals distinct.
b.fill(5,5,14,8);b.fill(5,10,14,14);b.fill(5,9,14,9,'#');b.put(11,9,'.');
b.fill(12,11,16,11,'~');
b.put(8,3,'.');b.put(8,2,'.');b.put(8,1,'g');b.put(17,11,'g');b.put(2,15,'g');b.put(7,15,'.');
b.put(7,8,'M');b.put(13,8,'B');b.put(13,12,'Z');
export const spec={id:'ss18-06',title:'Le miroir en tournée',rows:b.strings(),facing:'N',
 mirrors:[{at:{x:8,y:8},facing:'NE'},{at:{x:7,y:15},facing:'NW'}],
 circuits:[
  {id:'presse',buttons:[{x:13,y:12}],color:15},
  {id:'station',buttons:[{x:11,y:11}],color:10},
  {id:'departs',buttons:[{x:8,y:1},{x:17,y:11}],color:11},
 ],
 gates:[
  {at:{x:11,y:8},circuit:'presse',direction:'S',closedWhen:'released'},
  {at:{x:11,y:7},circuit:'station',direction:'W',closedWhen:'released'},
  {at:{x:8,y:2},circuit:'station',direction:'N',closedWhen:'released'},
  {at:{x:7,y:14},circuit:'departs',direction:'W',closedWhen:'released'},
 ],
};
export function build(){
 const a=new Author(spec);
 const stage=label=>{a.stage(label);if(process.env.SS18_AUTHOR_DEBUG)console.log(label,a.commands.length,JSON.stringify(a.state));};
 a.act('X');
 stage('Le premier poste envoie le Barde dans la branche nord ; sa destination reste fermée tant que le miroir n’atteint pas son second poste.');
 a.act('RRR');
 a.select('wizard').act('RL');
 stage('Le Marchand charge la presse. Le Magicien relâche puis reprend sa commande, déposant le miroir dans la seule descente praticable.');
 a.go(11,8,'merchant').act('DD');
 stage('Le miroir atteint la station basse : il ouvre la sortie nord et la fenêtre de visée qui le dessert.');
 a.select('bard').act('UU');
 a.go(14,12,'wizard');a.go(13,12,'merchant');a.go(11,5,'wizard').act('X');
 stage('Le Marchand maintient la fenêtre de presse ouverte pendant que le second poste envoie le Magicien sur la branche est.');
 a.go(11,10,'merchant').act('D');
 stage('Le miroir utilisé doit quitter son axe : laissé en place, il rappellerait le Magicien ou bloquerait le prochain reflet.');
 a.go(7,10,'merchant').act('X');
 stage('Les deux destinations déjà occupées libèrent le dernier miroir ; le Marchand rejoint seul la branche ouest.');
 return a.result({puzzle:18,label:'Adaptation de Heroes and Mirrors · énigme 18 · préparer un retour puis dégager le miroir devenu obstacle',url:'https://sinkingstarwalkthrough.com/fr/heroes-and-mirrors-solutions/',secondaryLabel:'Heroes and Light · énigme 1 · transporter une pièce par une presse latérale',secondaryUrl:'https://sinkingstarwalkthrough.com/fr/heroes-and-light-solutions/',objective:'Faire voyager un miroir entre deux postes, utiliser la presse pour franchir la butée, puis retirer ce miroir du circuit avant le dernier départ.'},{kind:'adaptation',preserved:['Mirrors 18 : préparer les déplacements futurs d’un miroir avant de quitter une région, puis dégager celui qui gêne le reflet final.','Light 1 : une presse peut déplacer une pièce dans une direction inaccessible à une poussée ordinaire.'],changed:['Le miroir voyage dans un atelier à trois branches, et sa présence sur une commande ouvre sa fenêtre optique et une destination.','La presse dépose le miroir sans le détruire ; le Marchand le pousse ensuite hors de l’axe devenu dangereux.','Les trois destinations sont séparées au nord, à l’est et à l’ouest ; deux arrivées ouvrent le dernier rayon.'],sourceReading:'Les deux contraintes sont adaptées sans duplication de héros ni destruction obligatoire du miroir. Les deux postes, la presse de transfert et les trois branches forment une carte originale.',proofScope:'Parcours légal et dépendances du plan auteur ; aucune unicité ni optimalité revendiquée.'});
}
if(process.argv[1]?.endsWith('build-level6.mjs')){const d=build();writeFileSync(new URL('../level6-design.json',import.meta.url),JSON.stringify(d,null,2)+'\n');console.log(JSON.stringify({title:spec.title,metrics:d.metrics,commands:d.commands}));}
