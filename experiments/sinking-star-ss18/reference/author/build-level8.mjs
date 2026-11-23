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
// The one reusable support is already immersed; all three crates must stay dry.
b.put(7,13,'s');
// The south crate has no Merchant push available: the wall behind it closes the socket.
for(const [x,y] of [[8,15],[8,16],[9,17],[10,15],[10,16]])b.put(x,y,'#');
b.put(16,6,'M');b.put(5,8,'Z');b.put(3,6,'B');
export const spec={id:'ss18-08',title:'La cour au cœur du lac',rows:b.strings(),facing:'N',
 mirrors:[{at:{x:16,y:7},facing:'NW'}],
 circuits:[
  {id:'hydraulique',buttons:[{x:13,y:3}],color:10},
  // At WIN all three heroes are on distinct goals: only the three crates and the mirror
  // can keep these four disjoint plates weighted. Supports are never weights.
  {id:'accord',buttons:[{x:13,y:5},{x:3,y:15},{x:9,y:14},{x:15,y:11}],color:15},
 ],
 gates:[
  {at:{x:16,y:5},circuit:'hydraulique',direction:'S',closedWhen:'released'},
  {at:{x:9,y:10},circuit:'accord',direction:'E',closedWhen:'released'},
  // A destination itself is a press: reaching the court cannot bypass the final accord.
  {at:{x:10,y:11},circuit:'accord',direction:'N',closedWhen:'released'},
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
 a.go(16,7,'merchant').act('DDD').go(17,11).act('L');
 stage('Le miroir quitte la visée et devient un poids final, après trois poussées vers le sud puis une poussée latérale.');
 a.go(3,9,'merchant');
 a.go(7,18,'bard').act('UU');
 stage('Le chant dégage la charge sud le long de sa glissière : la butée interdit la poussée directe depuis le bas.');
 a.go(7,18,'wizard').act('U');
 stage('Le Magicien retire le Barde de sa glissière sans entraîner la caisse hors de sa commande.');
 a.go(3,9,'merchant');a.go(2,7,'wizard');
 a.go(5,13,'bard').act('URUU');
 stage('Le Barde fait contourner la langue de terre à l’appui initial puis le place dans l’accès ouest. Le poids sud-ouest reste arrêté par sa butée.');
 a.act('RRRRRU');
 stage('Le Barde entre et s’éloigne d’abord de l’appui vers l’est, afin de laisser le passage intact pour les deux autres héros.');
 a.go(9,9,'merchant');a.go(10,11,'wizard');
 stage('Les trois caisses et le miroir gardent les quatre commandes. La destination basse exige la presse ouverte ; les trois héros terminent ensemble.');
 return a.result({puzzle:'37 / 40 / 41',label:'Adaptation de Heroes and Light · énigmes 37, 40 et 41 · préserver un accès, détourner puis lâcher une charge',url:'https://sinkingstarwalkthrough.com/fr/heroes-and-light-solutions/',secondaryLabel:'Heroes and Mirrors · énigme 30 · une visée déviée conserve sa première cible',secondaryUrl:'https://sinkingstarwalkthrough.com/fr/heroes-and-mirrors-solutions/',objective:'Conserver les trois caisses sèches, recycler le miroir comme quatrième poids, libérer deux fois le Barde sans retirer ses charges puis guider l’appui jusqu’à la cour : la destination basse est elle-même une presse commandée.'},{kind:'adaptation',preserved:['Light 37 : conserver un passage temporaire jusqu’à ce que son utilisateur ait effectué le trajet de retour.','Light 40 : faire contourner un obstacle à une charge plutôt que la diriger tout droit.','Light 41 : quitter une commande par déplacement forcé pour rompre le chant sans déplacer sa charge.'],changed:['Les faisceaux de pouvoir sont remplacés par une visée du Magicien, un appui mobile et les capacités fixes du trio.','Les trois destinations restent au centre du lac ; quatre commandes éloignées exigent les trois caisses sèches et le miroir, tandis qu’un appui initial assure le passage.','La réserve nord-est quitte l’alcôve hydraulique ; le poids hydraulique devient ensuite un poids final ; la troisième caisse sort d’une glissière par chant puis reste sur une commande.','Le miroir sert d’abord à la visée puis voyage sur deux axes vers la quatrième commande. Le Marchand et la caisse peuvent intercepter la première cible avant leur dégagement.','L’entrée finale demande un changement d’axe du chant afin de ne pas déplacer l’appui sous le prochain passage. La presse placée sur la destination basse impose le maintien des quatre poids jusque dans l’état final.'],sourceReading:'La carte reprend des contraintes de retour, de détour et de séparation du chant. Elle ne reprend ni les faisceaux de pouvoir, ni leurs couleurs fonctionnelles, ni les coordonnées des salles sources.',proofScope:'Parcours de référence légal. À la victoire, la presse-but exige les quatre commandes ; trois héros occupent les buts et seuls les trois caisses sèches et le miroir restent disponibles comme poids. La réserve nord-est est donc nécessaire et toute immersion d’une caisse retire un poids indispensable. Aucun ordre unique ni optimum de coups n’est revendiqué.'});
}
if(process.argv[1]?.endsWith('build-level8.mjs')){const d=build();writeFileSync(new URL('../level8-design.json',import.meta.url),JSON.stringify(d,null,2)+'\n');console.log(JSON.stringify({title:spec.title,metrics:d.metrics,commands:d.commands}));}
