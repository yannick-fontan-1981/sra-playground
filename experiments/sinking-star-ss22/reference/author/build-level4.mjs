import {fileURLToPath} from 'node:url';
import {Author,board} from './author.mjs';

export function spec(){
 const b=board(20,20),{fill,put}=b;
 fill(1,14,3,18);fill(3,6,3,13);fill(3,6,12,6);fill(4,7,7,8);put(3,7);put(3,8);
 fill(12,3,17,7);fill(15,8,15,10);fill(5,11,15,15);fill(5,10,8,10);put(9,10,'~');
 put(16,15,'~');fill(17,14,18,18);
 put(2,16,'M');put(2,14,'W');put(3,10,'T');put(6,8,'B');
 put(8,6,'m');put(10,6,'m');put(8,10,'o');
 for(const[x,y]of[[17,14],[18,14],[17,18],[18,18]])put(x,y,'g');
 return{id:'ss22-04',title:'La frontière du chant',mode:'quartet',rows:b.strings()};
}
export function build(){
 const a=new Author(spec());
 a.select('bard').act('UR').stage('Un pas vers le haut place la réserve hors de portée. Le pas latéral ne déplace alors que le gardien du haut ; sa rencontre libère la galerie.');
 a.go(17,7).stage('Le Barde quitte le poste par la galerie libérée. La caisse reste sèche dans son renfoncement, au-delà de la cloison basse.');
 a.go(7,10,'thief').act('LL').go(6,11).act('DD').go(7,13).stage('Le Voleur extrait la réserve contre la paroi, puis la descend selon un second axe dans le dépôt inférieur.');
 a.go(5,12,'merchant').act('RRRRRRRRR').go(15,11).act('DDD').go(14,14).act('D').stage('Le Marchand achemine la caisse au bord de l’eau ; il attend devant le Guerrier dans la courte file de lancement.');
 a.go(13,15,'warrior').act('R').stage('Le Guerrier pousse ensemble le Marchand et la caisse. La caisse devient l’appui, tandis que son partenaire arrive sur la rive de départ.');
 a.go(17,18,'merchant');
 a.go(11,14,'warrior');
 a.go(18,18,'thief').go(18,14,'bard').go(17,14,'warrior');
 a.stage('La seule caisse est devenue le passage utile ; les quatre héros occupent leurs destinations.');
 return a;
}
export const source={label:'Adaptation · Heroes Doubled · énigme 8',url:'https://sinkingstarwalkthrough.com/fr/heroes-doubled-solutions/#%C3%A9nigme-8',puzzle:8,objective:'Choisir la frontière de portée qui déplace le gardien sans immerger la réserve, puis livrer cette réserve jusqu’au passage final.'};
export const adaptation={sourcePrinciple:'Atteindre une galerie depuis la limite du chant permet de sélectionner son contenu sans déplacer celui de l’autre salle.',changes:'Le décalage de cristal de la référence devient une rencontre de gardiens. Une caisse dans la galerie basse doit rester sèche : la petite mare voisine ne communique pas avec la coupure finale. Le retrait par deux axes et la file mixte ajoutent la coopération du quatuor.',limits:'La contre-branche du poste bas établit la perte de la réserve sèche à cet instant. Le parcours n’affirme pas que toute autre préparation des héros ou tous les autres ordres sont impossibles.',localChecks:[]};
if(process.argv[1]===fileURLToPath(import.meta.url))build().save(new URL('../level4-design.json',import.meta.url),source,adaptation);
