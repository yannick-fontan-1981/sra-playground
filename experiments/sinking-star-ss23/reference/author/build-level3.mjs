import {fileURLToPath} from 'node:url';
import {Author,board} from './author.mjs';

export function spec(){
 const b=board(11,12),{fill,put}=b;
 fill(1,5,3,7);fill(4,7,8,7);fill(5,8,5,10);
 fill(6,2,6,6);fill(3,5,5,5);put(5,6);fill(8,3,8,6);put(9,3);
 put(1,7,'M');put(4,7,'W');put(5,10,'Z');put(6,3,'B');
 for(const[x,y]of[[5,7],[6,7],[6,5],[6,6]])put(x,y,'o');
 for(const[x,y]of[[1,5],[3,5],[8,3],[9,3]])put(x,y,'g');
 return{id:'ss23-03',title:'La case de trop',mode:'quartet',rows:b.strings()};
}

export function build(){
 const a=new Author(spec());
 a.select('warrior').act('RR').go(5,8).stage('La case supplémentaire au bout du bras droit reçoit la tête de file. Deux poussées dégagent le croisement ; le Guerrier quitte la case de réception du second groupe.');
 a.select('bard').act('DD').stage('La première avancée approche le Barde sans déplacer la tête bloquée. La seconde entraîne enfin les deux charges dans le croisement libéré.');
 a.act('LLL').stage('Le groupe repart vers le bras gauche. La butée sous la petite alcôve retient une caisse tandis que les autres se décalent ; une nouvelle file de deux charges apparaît devant le Guerrier.');
 a.select('warrior').act('U').stage('Le Guerrier réemploie la place libérée : une poussée remonte la nouvelle file et ouvre la circulation vers le bras oriental.');
 a.select('wizard').act('U').stage('Le Magicien échange sa place avec le Guerrier dans le passage sans croisement. Le premier peut partir vers l’est ; le second reprend le chemin depuis le fond du bras sud.');
 a.go(9,3).go(8,3,'warrior').go(1,5,'merchant');
 a.stage('Les deux destinations orientales sont accessibles et les quatre héros se répartissent entre les deux bras. Les quatre caisses sont encore présentes.');
 return a;
}

export const source={label:'Adaptation · Heroes and Light · énigme 14',url:'https://sinkingstarwalkthrough.com/fr/heroes-and-light-solutions/#%C3%A9nigme-14',puzzle:14,objective:'Utiliser la case supplémentaire pour dégager le croisement, puis transformer les deux files par un déplacement sélectif.'};
export const adaptation={sourcePrinciple:'Une dépendance circulaire de déplacements est rompue par une pièce qui dispose d’une case supplémentaire de décalage.',changes:'Les pièces de lumière deviennent deux courtes files perpendiculaires dans un croisement sec. Le Guerrier exploite le débattement du bras droit ; le Barde fait entrer puis décaler le groupe, dont une caisse est retenue par une butée. La même place de travail sert à pousser une nouvelle file. Le Magicien règle ensuite le passage des partenaires dans le bras sud. Aucun faisceau de pouvoir, couleur spéciale ni porte finale à plusieurs lests n’est ajouté.',limits:'Le témoin conserve les quatre caisses et utilise le débattement droit. Les essais locaux comparent les préparations du croisement ; ils ne démontrent ni unicité, ni nécessité de chaque capacité, ni impossibilité de toute permutation alternative par le Magicien.',localChecks:[]};
if(process.argv[1]===fileURLToPath(import.meta.url))build().save(new URL('../level3-design.json',import.meta.url),source,adaptation);
