import {fileURLToPath} from 'node:url';
import {Author,board} from './author.mjs';

export function spec(){
 const b=board(16,14),{fill,put}=b;
 fill(8,1,14,5);put(12,1,'#');put(12,6);
 fill(8,7,14,12);fill(1,8,6,11);put(7,10);
 for(const[x,y,c]of[[9,2,'M'],[12,3,'T'],[9,4,'Z'],[8,4,'B'],[12,2,'o'],[6,10,'o']])put(x,y,c);
 for(const[x,y]of[[2,8],[4,8],[2,10],[4,10]])put(x,y,'g');
 return{id:'ss24-02',title:'L’escalier à rebours',mode:'quartet',rows:b.strings(),
  circuits:[{id:'passage',color:14,buttons:[{x:12,y:9}]}],
  gates:[{at:{x:7,y:10},circuit:'passage',direction:'W',closedWhen:'released'}]};
}
export function build(){
 const a=new Author(spec());
 a.select('thief').act('DDDDD').go(10,10).stage('Le Voleur extrait la charge sous le mur puis la descend par l’unique escalier.');
 a.go(12,6,'merchant').act('DD').stage('Le Marchand prend le relais et dépose la charge sur la commande du passage inférieur.');
 a.go(12,4,'wizard').act('D').stage('Le Magicien échange les postes avec le Marchand sans déranger le poids.');
 a.go(11,8);a.go(14,12,'merchant');
 a.go(12,4,'bard');a.go(12,7,'wizard').act('U').stage('La Barde est installée dans l’escalier sans chant.');
 a.go(11,7,'thief').act('LLL').stage('Trois tractions sortent la Barde de la portée du poids, qui reste sur sa commande.');
 a.go(12,5);
 a.go(8,9,'bard').act('DD').stage('Depuis l’autre côté du mur, un chant dégage le bloc de passage ; la butée inférieure le retient au pas suivant.');
 a.select('thief').act('DDD').go(14,8).stage('Le Voleur descend le Magicien sans le laisser échanger avec le poids au fond de sa ligne.');
 a.go(11,8,'wizard');
 a.go(6,10,'thief').act('LDLLL').stage('Le bloc contre le mur est tiré vers une place de réserve pour libérer la route de toute l’équipe.');
 a.go(2,10);
 a.go(4,8,'bard');
 a.go(8,10,'wizard').act('LUU').stage('L’échange final transfère le Magicien dans la salle basse et rend au Voleur le passage déjà dégagé.');
 a.go(4,10,'thief');a.go(2,10,'merchant');
 return a;
}
export const source={label:'Heroes of Hauling — énigme 6',url:'https://sinkingstarwalkthrough.com/fr/heroes-of-hauling-solutions/#%C3%A9nigme-6',puzzle:6,objective:'Descendre une charge, maintenir le passage inférieur et extraire le dernier obstacle sans retirer le poids de commande.'};
export const adaptation={sourcePrinciple:'La source descend une charge par la droite, tire un autre cristal sur une plaque, puis extrait l’obstacle contre le mur de la salle basse.',changes:'Deux charges et quatre rôles MTZB remplacent le héros isolé. Le premier poids ouvre le passage ; l’installation silencieuse de la Barde et la traction du Magicien évitent de le reprendre pendant les transports. Un chant à travers la cloison puis une traction dégagent le dernier bloc.',limits:'La coopération décrite est celle du parcours vérifié. La salle conserve une liberté de préparation ; ni ordre unique ni nécessité globale de chaque pouvoir ne sont revendiqués.',localChecks:[]};
if(process.argv[1]===fileURLToPath(import.meta.url))build().save(new URL('../level2-design.json',import.meta.url),source,adaptation);
