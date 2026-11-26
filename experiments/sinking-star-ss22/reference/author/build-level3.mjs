import {fileURLToPath} from 'node:url';
import {Author,board} from './author.mjs';

export function spec(){
 const b=board(20,20),{fill,put}=b;
 fill(1,2,8,7);fill(7,5,11,5);fill(9,2,9,4);fill(11,3,11,4);
 fill(10,6,10,11);fill(7,11,9,11);put(7,12);
 fill(3,8,3,12);fill(3,12,6,12);put(7,13);fill(5,14,13,18);
 put(2,3,'M');put(7,5,'W');put(10,6,'T');put(9,4,'B');
 put(8,5,'o');put(9,5,'o');
 for(const[x,y]of[[6,16],[8,17],[11,16],[12,18]])put(x,y,'g');
 return{id:'ss22-03',title:'L’atelier du décrochage',mode:'quartet',rows:b.strings(),
  circuits:[{id:'decrochage',color:15,buttons:[{x:11,y:3}]},{id:'sortie',color:14,buttons:[{x:10,y:9}]}],
  gates:[{at:{x:10,y:10},circuit:'decrochage',direction:'S',closedWhen:'pressed'},{at:{x:7,y:13},circuit:'sortie',direction:'S',closedWhen:'released'}]};
}
export function build(){
 const a=new Author(spec());
 a.select('warrior').act('RR').go(1,7).stage('Le Guerrier engage la file dans les deux voies : une caisse au-dessus du Voleur, l’autre au fond de la colonne de commande.');
 a.select('thief').act('DDDD').stage('Le Voleur descend la première caisse sur la commande de sortie. Il reste devant elle, dans un couloir sans dégagement latéral.');
 a.select('bard').act('UU').stage('Depuis la galerie parallèle, le Barde remonte la deuxième caisse. Son arrivée sur la commande ferme la presse : le Voleur est transporté sans tirer son poids.');
 a.act('LL').go(6,6).stage('La cloison retient la caisse pendant que le Barde quitte le pupitre. La presse reste fermée et les sorties restent ouvertes.');
 a.go(11,16,'bard').go(12,18,'thief').go(6,16,'merchant').go(8,17,'warrior');
 a.stage('Les quatre héros rejoignent la salle basse ; la caisse de sortie est restée dans sa branche.');
 return a;
}
export const source={label:'Adaptation · Heroes Doubled · énigme 5',url:'https://sinkingstarwalkthrough.com/fr/heroes-doubled-solutions/#%C3%A9nigme-5',puzzle:5,objective:'Préparer deux voies de manutention, déposer un poids puis faire partir le Voleur sans reprendre sa caisse.'};
export const adaptation={sourcePrinciple:'Un Voleur transporté par un autre effet ne déclenche pas sa traction et peut abandonner une charge à l’endroit voulu.',changes:'La synchronisation de deux Voleurs est remplacée par une presse commandée à distance. Deux caisses issues d’une même file prennent des fonctions distinctes ; un chant à travers la cloison commande le décrochage.',limits:'La presse donne un départ sans traction dans le parcours qualifié. Aucun ordre unique ni usage universellement obligatoire de chaque capacité n’est affirmé.',localChecks:[]};
if(process.argv[1]===fileURLToPath(import.meta.url))build().save(new URL('../level3-design.json',import.meta.url),source,adaptation);
