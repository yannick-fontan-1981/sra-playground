import {fileURLToPath} from 'node:url';
import {Author,board} from './author.mjs';

export function spec(){
 const b=board(16,15),{fill,put}=b;
 fill(1,1,5,10);fill(6,1,8,10,'~');
 fill(9,3,10,4);fill(9,5,14,13);put(12,4);put(13,6,'#');
 put(12,11,'#');put(13,11,'#');put(8,12);put(8,13);
 put(2,8,'M');put(2,9,'W');put(4,3,'Z');put(2,3,'B');
 put(10,3,'o');put(12,4,'o');put(13,7,'o');
 for(const[x,y]of[[10,10],[14,10],[10,13],[14,13]])put(x,y,'g');
 return{id:'ss23-04',title:'Le poste emprunté',mode:'quartet',rows:b.strings()};
}

export function build(){
 const a=new Author(spec());
 a.select('wizard').act('R').stage('Le Magicien échange avec la balise de la loge. La caisse est rapatriée, et le poste distant possède son premier opérateur.');
 a.go(4,2,'merchant').act('D').go(3,2).stage('Le Marchand retire la balise renvoyée de la ligne de retour et dégage lui-même la visée.');
 a.select('wizard').act('L').stage('Le Magicien envoie le Barde dans la loge de travail. Le transfert ne chante pas et laisse les deux réserves en place.');
 a.go(4,3,'merchant').act('DDDDDD').go(3,10).act('R');
 a.go(3,10,'warrior').act('R').stage('La balise récupérée devient le premier appui. Une poussée mixte libère le Marchand, sans autre ressource ajoutée.');
 a.select('bard').act('DDDDDD').stage('Depuis la loge, le Barde fait descendre la première réserve. Le second stock reste hors de la portée latérale.');
 a.act('DDDD').go(14,13).act('U').act('LLLLLL').stage('La première réserve devient appui, puis glisse d’une case supplémentaire. La case de service laisse le Barde sur le sol.');
 a.act('D').go(11,6).act('DDD').stage('Le Barde rejoint le second poste. La butée supérieure conserve la réserve pendant son approche, puis les trois pas la mettent en ligne.');
 a.act('DDDD').go(14,13).act('U').act('LLLLL').act('D').go(14,13).stage('Le dernier appui complète la traversée. Les butées inférieures conservent les appuis pendant le départ du Barde.');
 a.go(10,13,'merchant').go(14,10,'warrior');
 a.go(5,10,'wizard').act('R');a.go(10,10,'warrior');
 a.stage('Les quatre héros occupent les quatre destinations au-delà de la coupure ; les trois anciennes caisses forment le passage.');
 return a;
}

export const source={label:'Adaptation · Heroes and Artifacts · énigmes 4–5',url:'https://sinkingstarwalkthrough.com/fr/heroes-and-artifacts-solutions/#%C3%A9nigme-4',puzzle:'4–5',objective:'Envoyer le Barde dans le poste de travail, récupérer la balise et réemployer les trois charges pour la traversée collective.'};
export const adaptation={sourcePrinciple:'Préparer la position du spécialiste par échange et employer une cible intermédiaire pour atteindre sa case de travail.',changes:'Le poste de l’Explorateur et la baguette du guide deviennent une loge où le chant atteint une réserve bloquée contre une paroi. Le Magicien prend d’abord la place d’une balise, puis celle du Barde ; le Marchand dégage la cible renvoyée. Les charges et les appuis suivent les règles déterministes de SS23, sans orientation spéciale ni artefact.',limits:'La route décrit un envoi du spécialiste, puis un chantier de retour. Les contre-branches établiront les effets locaux de la visée et de la portée ; elles ne fixent pas un ordre unique de tous les transports.',localChecks:[]};
if(process.argv[1]===fileURLToPath(import.meta.url))build().save(new URL('../level4-design.json',import.meta.url),source,adaptation);
