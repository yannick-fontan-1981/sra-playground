import {fileURLToPath} from 'node:url';
import {Author,board} from './author.mjs';

export function spec(){
 const b=board(17,12),{fill,put}=b;
 fill(1,3,6,10);fill(7,5,8,5,'~');fill(9,4,12,4);fill(9,5,10,5);fill(9,2,9,3);
 fill(11,1,12,4);fill(13,1,15,3);put(6,0);fill(7,0,7,2);
 put(10,5,'M');put(7,0,'W');put(3,5,'Z');put(7,2,'B');
 put(9,5,'o');put(9,4,'m');put(13,1,'m');
 for(const[x,y]of[[4,8],[6,0],[7,1],[14,1]])put(x,y,'g');
 return{id:'ss23-05',title:'Les deux côtés du sort',mode:'quartet',rows:b.strings(),mirrors:[{at:{x:12,y:4},facing:'NW'},{at:{x:12,y:1},facing:'SE'}]};
}

export function build(){
 const a=new Author(spec());
 a.select('warrior').act('L').stage('Le Guerrier dégage le fond du petit poste. Le Barde pourra y reculer jusqu’au bout sans être arrêté par son partenaire.');
 a.select('bard').act('UU').stage('La caisse reste hors de portée tandis que le chant éloigne son gardien. L’arrivée du Magicien et la future sortie du Marchand sont maintenant sûres.');
 a.select('wizard').act('R').stage('Le premier échange retire la caisse du goulot et installe le Magicien au poste de visée. Sans préparation, le gardien voisin tuerait ce nouvel arrivant.');
 a.act('R').go(13,3,'merchant').stage('Le Magicien libère le Marchand par un échange de places. Le Marchand quitte ensuite le voisinage qui doit recevoir le second gardien.');
 a.select('wizard').act('UR').stage('Le rayon à deux coudes amène le second gardien dans le poste libéré. Aucun partenaire ne demeure à côté de sa réception.');
 a.select('bard').act('DD').stage('Le premier gardien suit le chant tandis que le second demeure hors de portée. Leur rencontre libère le goulot et le retour du Magicien.');
 a.go(7,1).go(9,5,'wizard').act('L').stage('Le goulot dégagé permet au Magicien de retrouver la balise. La caisse revient à son poste et le Magicien rejoint sa rive de départ.');
 a.go(4,8).go(14,1,'merchant');
 a.stage('Les quatre héros rejoignent leurs destinations réparties entre les trois postes. Aucun bouton ni compteur de monstres n’entre dans la victoire.');
 return a;
}

export const source={label:'Adaptation · Heroes 2: Monsters · énigmes 26–27',url:'https://sinkingstarwalkthrough.com/fr/heroes-2-monsters-solutions/#%C3%A9nigme-26',puzzle:'26–27',objective:'Sécuriser l’arrivée du Magicien, libérer le voisinage qui recevra un monstre, puis réemployer la visée après une rencontre préparée.'};
export const adaptation={sourcePrinciple:'Préparer les emplacements successifs d’échange et faire aider le Magicien par un partenaire qui règle la prochaine position des monstres.',changes:'La progression du canyon est recomposée en trois postes compacts, une coupure d’eau de deux cases et une visée à deux coudes. Le Barde éloigne le premier gardien de la caisse-cible ; le Magicien libère le Marchand avant de recevoir le second monstre. La distance du gardien occidental fait viser un miroir occupé lors du reflet global initial : ce raccourci est refusé atomiquement. Les monstres sont stationnaires hors transport et les contacts orthogonaux sont simultanés. Aucune héroïne invulnérable, poursuite ni porte à décompte de morts n’est reprise.',limits:'Les deux contre-branches dangereuses concernent des positions précises : arrivée sur la caisse adjacente au gardien, ou réception du monstre auprès du Marchand. La rencontre finale explique le dégagement du goulot sans imposer un quota de morts ; d’autres façons de déplacer les gardiens restent légales après préparation.',localChecks:[]};
if(process.argv[1]===fileURLToPath(import.meta.url))build().save(new URL('../level5-design.json',import.meta.url),source,adaptation);
