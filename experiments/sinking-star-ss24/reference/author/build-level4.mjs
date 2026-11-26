import {fileURLToPath} from 'node:url';
import {Author,board} from './author.mjs';

export function spec(){
 const b=board(17,13),{fill,put}=b;
 fill(1,2,3,7);fill(4,3,5,3,'~');put(6,3,'3');put(6,4);fill(5,5,6,5);
 fill(7,4,11,10);put(8,6,'#');put(8,8,'#');fill(4,7,7,7);put(12,7);fill(13,5,15,9);
 put(10,5,'M');put(6,5,'T');put(5,5,'Z');put(9,7,'B');put(3,3,'o');put(7,7,'o');
 for(const[x,y]of[[13,5],[15,5],[13,9],[15,9]])put(x,y,'g');
 return{id:'ss24-04',title:'Le pas et la visée',mode:'quartet',rows:b.strings(),circuits:[{id:'acces',buttons:[{x:7,y:9}],color:15}],gates:[{at:{x:4,y:7},circuit:'acces',direction:'E',closedWhen:'released'},{at:{x:12,y:7},circuit:'acces',direction:'E',closedWhen:'released'}]};
}

export function build(){
 const a=new Author(spec());
 a.select('thief').act('R').stage('La traction décale le Magicien d’une colonne sans lancer de sort. Le Voleur reste devant lui, disponible pour reprendre ce que la nouvelle visée rapportera.');
 a.select('wizard').act('U').stage('Le rayon atteint maintenant la face blanche du miroir, traverse la coupure et échange la caisse de la loge. Le Magicien prend sa place ; la charge arrive dans son ancienne case.');
 a.select('thief').act('R').go(11,4).stage('Le Voleur retire la charge de la case d’arrivée et la présente dans la colonne de livraison, puis laisse la place au Marchand.');
 a.go(7,4,'merchant').act('D').stage('Le Marchand engage la charge. Une seconde caisse bloque encore la colonne : pousser deux occupants n’est pas une capacité de ce quatuor.');
 a.select('bard').act('R').stage('La butée retient la charge engagée tandis que le chant décale la caisse basse. Le Marchand est entraîné séparément, sans nouvelle poussée.');
 a.go(7,5,'merchant').act('DDD').stage('La colonne dégagée reçoit la charge jusqu’à sa commande. La même ouverture donne accès au retour de la loge et à la chambre d’arrivée.');
 a.go(15,9,'bard').go(15,5,'merchant');
 a.go(3,7,'wizard').act('R').go(13,5).stage('La caisse basse, écartée du chantier, fournit la première cible de retour. Le Magicien la renvoie dans la loge et revient dans l’atelier sans reprendre le poids livré.');
 a.go(13,9,'thief');
 a.stage('Les quatre héros occupent leurs destinations. Les deux caisses existent encore, et le miroir est resté un outil de visée plutôt qu’un poids final.');
 return a;
}

export const source={label:'Adaptation · Heroes and Light Advanced · énigmes 6–7',url:'https://sinkingstarwalkthrough.com/fr/heroes-and-light-advanced-solutions/#%C3%A9nigme-6',secondaryUrl:'https://sinkingstarwalkthrough.com/fr/heroes-and-light-advanced-solutions/#%C3%A9nigme-7',secondaryLabel:'Heroes and Light Advanced · énigme 7',puzzle:'6–7',objective:'Décaler le Magicien sans lancer de sort, récupérer la cible renvoyée et libérer la colonne de livraison sans pousser une file.'};
export const adaptation={sourcePrinciple:'Un déplacement d’une case change les cibles vues par le Magicien ; une pièce proche peut aussi masquer celle que l’on veut atteindre ensuite.',changes:'La parité de lumière orange n’est pas importée. La traction du Voleur donne au Magicien une nouvelle colonne de visée tout en gardant le Voleur du côté utile de la réception. Un miroir fixe dévie ce rayon vers une loge. La caisse rapportée est extraite puis livrée ; un chant sélectif dégage sa colonne tout en transportant le Marchand sans poussée. La caisse écartée redevient ensuite une cible de retour, tandis que le poids final reste en place.',limits:'Les essais locaux distinguent la position du Magicien et celle laissée au Voleur par une traction ou un échange direct. Un Voleur enfermé derrière la caisse reçue n’est pas déclaré définitivement perdu : les partenaires peuvent encore intervenir. La route ne prétend ni rendre la traction du Magicien universellement obligatoire ni interdire d’autres emplois du reflet global.',localChecks:[]};
if(process.argv[1]===fileURLToPath(import.meta.url))build().save(new URL('../level4-design.json',import.meta.url),source,adaptation);
