import {fileURLToPath} from 'node:url';
import {Author,board} from './author.mjs';

export function spec(){
 const b=board(16,12),{fill,put}=b;
 fill(1,2,5,9);fill(6,4,9,4);fill(6,7,10,7);fill(8,5,9,6);
 fill(6,8,7,8);put(6,9);fill(10,2,14,9);put(10,4,'#');put(8,7,'~');
 put(5,4,'M');put(8,4,'T');put(5,7,'Z');put(4,7,'B');
 for(const[x,y]of[[6,4],[7,4],[6,7],[7,7]])put(x,y,'o');
 for(const[x,y]of[[12,2],[14,2],[12,9],[14,9]])put(x,y,'g');
 return{id:'ss24-03',title:'Les tiroirs décalés',mode:'quartet',rows:b.strings()};
}

export function build(){
 const a=new Author(spec());
 a.select('thief').act('RD').go(10,7).stage('Le Voleur prend seulement la caisse voisine de la paire haute. Le décalage obtenu permet désormais une poussée simple depuis l’autre extrémité. Il rejoint ensuite le poste de retour.');
 a.select('merchant').act('R').stage('Le Marchand avance la caisse restée en arrière dans la place libérée. La paire initiale aurait bloqué cette poussée.');
 a.select('wizard').act('RRR').stage('Deux échanges traversent la paire basse et laissent ses caisses dans les anciennes places du Magicien. Un troisième échange franchit la coupure en prenant la place du Voleur au poste de retour.');
 a.go(5,8,'merchant').act('U').go(3,8).stage('La caisse renvoyée dans l’atelier est rangée vers le haut. Elle cesse de masquer la Barde dans la ligne de retour.');
 a.go(6,8,'thief').act('D').go(4,9).stage('Le Voleur retire la seconde caisse basse dans la poche décalée. Les deux anciennes places du Magicien ont été libérées par des gestes différents.');
 a.select('wizard').act('L').stage('La ligne dégagée permet d’envoyer la Barde à droite. Les deux caisses rangées restent hors de sa future course de travail.');
 a.go(9,6,'bard').act('DRR').stage('La butée retient la caisse arrière en haut ; la Barde abaisse puis déporte celle de tête dans le renfoncement droit. Le chantier supérieur retrouve un débouché.');
 a.go(6,4,'merchant').act('RR').go(14,2).stage('Le Marchand reprend la caisse haute désormais isolée et ouvre le passage entre les deux ateliers.');
 a.go(12,2,'bard').go(5,4,'wizard').act('R').go(14,9).stage('La caisse haute sert de cible au retour du Magicien. Elle revient dans l’atelier gauche et occupe encore son accès.');
 a.go(4,4,'thief').act('L').go(5,3).act('DRRRD').go(12,9);
 a.stage('Les quatre caisses sont conservées et les quatre héros rejoignent leurs destinations. Aucun circuit ne transforme leur rangement en condition supplémentaire.');
 return a;
}

export const source={label:'Adaptation · Heroes, Doubled · énigme 4',url:'https://sinkingstarwalkthrough.com/fr/heroes-doubled-solutions/#%C3%A9nigme-4',puzzle:4,objective:'Séparer une paire qui bloque la poussée simple, libérer les cibles de retour et ranger une tête de file depuis une autre portée.'};
export const adaptation={sourcePrinciple:'Deux pierres alignées servent de butée parce que le Marchand ne peut pas pousser leur file ; des décalages de colonne et de rangée changent ce qui peut avancer.',changes:'Les héros doublés deviennent un quatuor sans synchronisation de clones. Deux galeries ont chacune une paire de caisses ; une coupure d’une case distingue la fenêtre d’échange basse du passage physique supérieur. La traction sépare la paire haute ; les échanges traversent la paire basse, dont les pièces renvoyées doivent être retirées de la visée. La Barde travaille ensuite depuis le côté opposé et une butée retient une charge pendant la dépose latérale de sa voisine. La caisse haute redevient cible puis charge à extraire lors du retour. Aucune poussée de file ni pouvoir du héros transporté n’est ajouté.',limits:'Les contrôles établissent les effets des deux paires, des cibles renvoyées et de la butée sur la route décrite. La route conserve les quatre caisses sèches ; une stratégie qui construit un autre passage dans l’eau reste autorisée si elle réussit. Les autres échanges de caisses et ordres de manutention restent légaux ; ni chaque capacité ni chaque détour du témoin ne sont déclarés nécessaires dans toutes les solutions.',localChecks:[]};
if(process.argv[1]===fileURLToPath(import.meta.url))build().save(new URL('../level3-design.json',import.meta.url),source,adaptation);
