import {fileURLToPath} from 'node:url';
import {Author,board} from './author.mjs';

export function spec(){
 const b=board(20,20),{fill,put}=b;
 fill(1,2,8,5);put(7,3,'#');put(8,2,'#');fill(1,6,6,16);put(7,6);
 fill(8,6,10,7);fill(10,9,12,9);fill(7,11,10,11);
 fill(6,13,8,16);fill(9,16,10,16);fill(11,14,18,18);
 put(2,3,'M');put(3,4,'W');put(5,5,'T');put(2,9,'B');
 put(4,4,'o');put(5,4,'o');put(10,9,'o');
 for(const[x,y]of[[14,14],[17,14],[14,18],[18,18]])put(x,y,'g');
 return{id:'ss22-05',title:'Les entrées décalées',mode:'quartet',rows:b.strings(),
  circuits:[{id:'arrivee',color:14,buttons:[{x:8,y:3},{x:12,y:9},{x:8,y:15}]}],
  gates:[{at:{x:10,y:16},circuit:'arrivee',direction:'E',closedWhen:'released'}]};
}
export function build(){
 const a=new Author(spec());
 a.select('warrior').act('RRR').go(1,2).stage('Le Guerrier avance les deux caisses ensemble jusqu’aux postes de séparation.');
 a.go(8,5,'merchant').act('U').stage('La caisse de tête quitte la file et rejoint la commande haute. La caisse arrière peut maintenant descendre séparément.');
 a.go(7,5,'thief').act('D').go(6,6);
 a.go(8,5,'merchant').act('LL');
 a.go(5,6,'thief').act('DDDDDDDD').go(8,14).stage('La caisse arrière est extraite, changée d’axe puis descendue dans le dépôt inférieur.');
 a.go(4,13,'merchant').act('RRR');
 a.select('thief').act('DDL').go(1,16);
 a.go(1,12,'merchant').stage('Le Voleur termine la livraison basse par traction et peut s’écarter latéralement en laissant son poids en place.');
 a.go(8,7,'bard').act('RR').stage('Le Barde entre par l’accès haut, garde deux cases de décalage avec la caisse centrale et la livre sur son bouton à travers la cloison.');
 a.act('ULLLL').stage('La sortie haute permet un détour hors de portée. Revenir directement par la galerie basse aurait repris la caisse dans le chant.');
 a.go(18,18,'bard').go(14,14,'merchant').go(17,14,'warrior').go(14,18,'thief');
 a.stage('Trois livraisons différentes maintiennent l’accès aux quatre destinations.');
 return a;
}
export const source={label:'Adaptation · Heroes and Light · énigme 42',url:'https://sinkingstarwalkthrough.com/fr/heroes-and-light-solutions/#%C3%A9nigme-42',puzzle:42,objective:'Séparer les livraisons, choisir l’accès qui conserve le bon décalage avec la charge centrale et repartir sans défaire son placement.'};
export const adaptation={sourcePrinciple:'Trois charges ont des contraintes de livraison différentes. Pour celle du milieu, l’entrée haute ménage une sortie qui conserve le placement ; revenir par l’entrée basse reprendrait la charge.',changes:'Les itinéraires et le chant à travers la cloison remplacent les faisceaux orange. La livraison supérieure sépare la tête de file ; la livraison inférieure demande une traction après changement d’axe. Les trois charges commandent un seul accès final.',limits:'L’accès inférieur reste une branche légale : son retrait volontaire du Barde déplace la caisse. La présence d’un partenaire pourrait fournir un transport imposé ; cette possibilité n’est pas déclarée impossible.',localChecks:[]};
if(process.argv[1]===fileURLToPath(import.meta.url))build().save(new URL('../level5-design.json',import.meta.url),source,adaptation);
