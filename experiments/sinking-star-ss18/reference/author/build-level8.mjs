import {Author,board} from './author.mjs';
import {writeFileSync} from 'node:fs';
const b=board(20,20,'#');
b.fill(1,1,18,18);b.fill(6,6,13,13,'~');
// An inward-facing gallery: the final court is at the centre of a lake.
b.fill(9,9,11,11);b.fill(6,9,7,11);b.put(7,9,'~');b.put(7,11,'~');b.put(6,12,'.');
b.put(9,9,'g');b.put(11,9,'g');b.put(10,11,'g');
// The north-east reserve can only leave its alcove through the optical/hydraulic passage.
b.fill(15,2,17,4,'~');b.put(16,3,'o');b.put(16,5,'.');
b.put(13,3,'o');b.put(9,16,'o');b.put(3,14,'#');b.put(1,12,'#');
b.put(16,6,'M');b.put(5,8,'Z');b.put(3,6,'B');
export const spec={id:'ss18-08',title:'La cour au cœur du lac',rows:b.strings(),facing:'N',
 mirrors:[{at:{x:16,y:7},facing:'NW'}],
 circuits:[
  {id:'hydraulique',buttons:[{x:13,y:3}],color:10},
  {id:'accord',buttons:[{x:13,y:5},{x:3,y:15}],color:15},
 ],
 gates:[
  {at:{x:16,y:5},circuit:'hydraulique',direction:'S',closedWhen:'released'},
  {at:{x:9,y:10},circuit:'accord',direction:'E',closedWhen:'released'},
 ],
 platforms:[{at:{x:16,y:4},circuit:'hydraulique',activeWhen:'pressed'}],
};
export function build(){
 const a=new Author(spec);
 const stage=label=>{a.stage(label);if(process.env.SS18_AUTHOR_DEBUG)console.log(label,a.commands.length,JSON.stringify(a.state));};
 a.act('D').go(17,7);
 stage('Le Marchand place le miroir sur la visée de la réserve puis quitte le rayon : sa propre présence intercepterait l’échange.');
 a.select('wizard').act('R');
 stage('La visée coudée extrait la caisse au sec et laisse le Magicien dans l’alcôve hydraulique. La caisse extraite est maintenant la première cible du rayon de retour.');
 a.select('bard').act('DDDDDDDLL');
 stage('Le Barde éloigne la caisse de la visée, la transporte le long de la galerie et la pose sur la commande sud-ouest.');
 a.go(17,13,'wizard').act('L');
 stage('Le Magicien peut quitter l’alcôve après dégagement du rayon. Il extrait ensuite le Barde par échange, sans faire quitter sa commande à la caisse.');
 a.go(2,7,'wizard');
 a.go(13,2,'merchant').act('DD');
 stage('La réserve récupérée et le Magicien sauvé, le poids hydraulique peut changer de rôle : il rejoint la commande nord-est et ferme la passerelle devenue inutile.');
 a.go(10,16,'merchant').act('LL').go(7,17).act('UUU').go(3,9);
 stage('Le Marchand prépare la troisième ressource à l’entrée du chenal : cette caisse devient l’appui destiné au lac central.');
 a.go(5,13,'bard').act('URUU');
 stage('Le Barde fait contourner la langue de terre à l’appui, puis le place dans l’accès ouest de la cour. La butée protège le poids sud-ouest pendant cette manœuvre.');
 a.act('RRRRRU');
 stage('Le Barde entre et s’éloigne d’abord de l’appui vers l’est, afin de laisser le passage intact pour les deux autres héros.');
 a.go(9,9,'merchant');a.go(10,11,'wizard');
 stage('Les destinations centrales sont occupées ; les deux caisses sèches conservent l’accord et la troisième reste immergée dans le passage.');
 return a.result({puzzle:'37 / 40 / 41',label:'Adaptation de Heroes and Light · énigmes 37, 40 et 41 · préserver un accès, détourner puis lâcher une charge',url:'https://sinkingstarwalkthrough.com/fr/heroes-and-light-solutions/',secondaryLabel:'Heroes and Mirrors · énigme 30 · une visée déviée conserve sa première cible',secondaryUrl:'https://sinkingstarwalkthrough.com/fr/heroes-and-mirrors-solutions/',objective:'Extraire une réserve par visée, libérer le Barde sans retirer son poids, réaffecter la commande hydraulique puis acheminer l’appui jusqu’aux destinations centrales.'},{kind:'adaptation',preserved:['Light 37 : conserver un passage temporaire jusqu’à ce que son utilisateur ait effectué le trajet de retour.','Light 40 : faire contourner un obstacle à une charge plutôt que la diriger tout droit.','Light 41 : quitter une commande par déplacement forcé pour rompre le chant sans déplacer sa charge.'],changed:['Les faisceaux de pouvoir sont remplacés par une visée du Magicien, un appui mobile et les capacités fixes du trio.','Les trois destinations sont au centre d’une cour dans le lac, et trois ressources sont préparées dans des ailes différentes.','La première caisse quitte l’alcôve hydraulique ; le poids initial de cette alcôve devient ensuite un poids final ; la troisième caisse devient un appui.','Un seul miroir dévie la visée : le Marchand puis la caisse peuvent en intercepter la première cible avant d’être déplacés.','L’entrée finale demande un changement d’axe du chant afin de ne pas déplacer l’appui sous le prochain passage.'],sourceReading:'La carte reprend des contraintes de retour, de détour et de séparation du chant. Elle ne reprend ni les faisceaux de pouvoir, ni leurs couleurs fonctionnelles, ni les coordonnées des salles sources.',proofScope:'Parcours de référence légal et vérifications locales des choix ; aucune unicité ni optimalité revendiquée.'});
}
if(process.argv[1]?.endsWith('build-level8.mjs')){const d=build();writeFileSync(new URL('../level8-design.json',import.meta.url),JSON.stringify(d,null,2)+'\n');console.log(JSON.stringify({title:spec.title,metrics:d.metrics,commands:d.commands}));}
