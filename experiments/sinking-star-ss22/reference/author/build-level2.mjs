import {fileURLToPath} from 'node:url';
import {Author,board} from './author.mjs';

export function spec(){
 const b=board(17,15),{fill,put}=b;
 fill(1,10,14,13);fill(5,6,9,6);fill(6,8,8,8);put(8,9);
 fill(11,2,14,8);put(12,9);fill(1,1,9,4);put(10,3);
 fill(4,1,4,2,'#');fill(6,3,6,4,'#');
 put(2,11,'M');put(6,8,'W');put(4,12,'T');put(8,8,'B');
 put(9,6,'o');put(11,2,'o');
 for(const[x,y]of[[1,1],[1,4],[5,1],[9,4]])put(x,y,'g');
 return{id:'ss22-02',title:'La marche à deux temps',mode:'quartet',rows:b.strings(),
  circuits:[{id:'cadence',color:15,buttons:[{x:5,y:6}]},{id:'livraison',color:14,buttons:[{x:12,y:11}]}],
  gates:[{at:{x:12,y:9},circuit:'cadence',direction:'N',closedWhen:'released'},
   {at:{x:10,y:3},circuit:'livraison',direction:'W',closedWhen:'released'}]};
}
export function build(){
 const a=new Author(spec());
 for(let i=0;i<4;i++){
  a.select('bard').act('L');a.select('warrior').act('R');
 }
 a.stage('Quatre petites courses chantées déplacent la caisse dans sa galerie. Après chacune, le Guerrier replace le Barde sans chant : le chargement ne revient pas en arrière.');
 a.select('bard').act('DDRRRRUURRUUUUU').stage('La caisse a atteint sa commande. Le Barde quitte son pupitre par la seule ouverture basse ; la réserve devient accessible.');
 a.go(14,8,'warrior');
 a.go(11,3,'thief').act('DDD').go(12,5).act('R').go(13,8).stage('Le Voleur extrait la caisse du coin et la présente dans la colonne de livraison.');
 a.go(12,4,'merchant').act('DDDDDD').go(11,10).stage('Le Marchand descend la réserve jusqu’à la seconde commande. La salle des quatre arrivées s’ouvre.');
 a.go(1,1,'bard');a.go(1,4,'warrior');a.go(5,1,'merchant');a.go(9,4,'thief');
 return a;
}
export const source={label:'Adaptation · Low Heroes · énigme 11',url:'https://sinkingstarwalkthrough.com/fr/low-heroes-solutions/#%C3%A9nigme-11',puzzle:11,objective:'Alterner une course chantée et un replacement silencieux, puis extraire et livrer la réserve.'};
export const adaptation={sourcePrinciple:'Le Guerrier replace le Barde entre deux avancées : le transport imposé évite le chant de retour qui annulerait le travail.',changes:'La voiture à pédales est transposée dans un atelier sec. Une galerie de fret séparée, une course volontaire très courte et deux commandes successives remplacent le véhicule de la source. Le Voleur extrait la réserve du coin avant la livraison.',limits:'Le témoin qualifié utilise quatre replacements par le Guerrier. Aucune unicité du parcours ni nécessité universelle du Guerrier n’est affirmée ; le Voleur peut également imposer un transport silencieux.',localChecks:[]};
if(process.argv[1]===fileURLToPath(import.meta.url))build().save(new URL('../level2-design.json',import.meta.url),source,adaptation);
