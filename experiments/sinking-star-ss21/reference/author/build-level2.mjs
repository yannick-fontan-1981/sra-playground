import {fileURLToPath} from 'node:url';
import {Author,board} from './author.mjs';

export function spec(){
 const b=board(20,20),{fill,put}=b;
 fill(6,1,12,6);fill(3,3,5,3,'~');put(2,3,'W');
 fill(7,7,7,9);fill(7,8,11,8);put(10,7);fill(8,9,10,9);
 fill(8,10,12,18);fill(13,12,15,12,'~');put(16,12,'T');
 fill(2,14,6,18);put(7,16);
 put(7,5,'M');put(11,3,'Z');put(8,5,'o');put(8,8,'o');put(9,8,'o');
 for(const [x,y]of [[2,15],[5,15],[3,17],[6,17]])put(x,y,'g');
 return{id:'ss21-02',title:'Trois caisses, deux chambres',mode:'quartet',rows:b.strings(),
  circuits:[{id:'retour',color:15,buttons:[{x:9,y:15}]}],
  gates:[{at:{x:7,y:16},circuit:'retour',direction:'E',closedWhen:'released'}]};
}

export function build(){
 const a=new Author(spec());
 a.select('wizard').act('L').stage('Le Magicien remplace le Guerrier dans la chambre nord-ouest.');
 a.go(10,4,'warrior');
 a.go(8,6,'merchant').act('UU').stage('Le Marchand place la première caisse dans la visée de retour.');
 a.select('wizard').act('R').stage('Le Magicien revient dans la cour ; la caisse reste dans la première chambre.');
 a.go(7,8,'warrior').act('RR').go(6,6).stage('Le Guerrier amène la file jusqu’aux deux postes de reprise.');
 a.go(10,12,'wizard').act('R').stage('La même relève libère le Voleur dans la chambre sud-est.');
 a.go(8,11,'thief');
 a.go(10,7,'merchant').act('DDDD').stage('La caisse arrière descend au poste de retour du Magicien.');
 a.select('wizard').act('L').stage('Deux chambres restent occupées par les deux caisses ; les quatre héros sont libres.');
 a.go(10,8,'thief').act('LL').go(9,9).act('DDDDDDD').stage('La caisse de tête est extraite du renfoncement puis laissée sur la commande finale.');
 a.go(5,15,'wizard').go(2,15,'merchant').go(3,17,'warrior').go(6,17,'thief').stage('Le quatrième héros quitte le dépôt ; chaque chambre conserve sa charge.');
 return a;
}

export const source={label:'Adaptation · Heroes of Hauling · énigmes 19 et 20',url:'https://sinkingstarwalkthrough.com/fr/heroes-of-hauling-solutions/#%C3%A9nigme-19',puzzle:'19–20',objective:'Libérer deux partenaires isolés, laisser une caisse dans chacune de leurs chambres et conserver le dernier poids pour les quatre sorties.'};
export const adaptation={sourcePrinciple:'Le Magicien prend la place des héros enfermés, puis échange avec des caisses qui restent dans les logements.',changes:'Deux chambres sont décalées dans des coins opposés et séparées par trois cases d’eau chacune. Une file étroite distribue les deux dernières caisses ; la tête finit dans un renfoncement latéral. Le quatuor doit ensuite entrer dans une cour commune avec un poids resté dehors.',resourceArgument:'Trois caisses mobiles au départ : une remplace le Guerrier, une remplace le Voleur, une maintient la commande des sorties. Un échange conserve le nombre d’occupants de chaque chambre ; les ponts de trois cases ont un coût distinct d’une transposition.',limits:'La route qualifiée utilise les quatre capacités. Elle ne prouve pas que chaque action particulière ou chaque capacité est indispensable à toute solution.',localChecks:[]};
if(process.argv[1]===fileURLToPath(import.meta.url))build().save(new URL('../level2-design.json',import.meta.url),source,adaptation);
