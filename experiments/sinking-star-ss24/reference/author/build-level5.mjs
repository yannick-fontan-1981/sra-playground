import {fileURLToPath} from 'node:url';
import {Author,board} from './author.mjs';

export function spec(){
 const b=board(18,16),{fill,put}=b;
 fill(2,4,12,7);fill(3,8,11,13);put(12,3);put(13,4,'~');fill(14,2,16,6);
 for(const[x,y]of[[8,9],[8,11],[11,9],[11,11]])put(x,y,'#');
 put(5,10,'M');put(8,10,'T');put(9,10,'Z');put(10,12,'B');
 put(6,10,'o');put(11,10,'o');put(12,3,'o');
 for(const[x,y]of[[14,2],[16,2],[14,6],[16,6]])put(x,y,'g');
 return{id:'ss24-05',title:'Le relais interrompu',mode:'quartet',rows:b.strings(),circuits:[{id:'relais',buttons:[{x:8,y:10}],color:15}],gates:[{at:{x:12,y:4},circuit:'relais',direction:'E',closedWhen:'released'}]};
}

export function build(){
 const a=new Author(spec());
 a.act('R').stage('Le Marchand présente la réserve derrière le Voleur, qui tient la presse ouverte. Deux charges encadrent maintenant la ligne de visée du poste de commande.');
 a.select('wizard').act('L').stage('L’échange remplace le Voleur par le Magicien sur la commande. Cette relève libère le chargeur sans interrompre le circuit.');
 a.go(12,4,'thief').act('D').go(9,10).stage('Le Voleur tire la charge depuis sa niche sur la presse ouverte, puis revient devant le Magicien sans reprendre le chargement.');
 a.select('wizard').act('R').stage('Un nouvel échange remet le Voleur sur la commande. Le Magicien n’aurait pu simplement en sortir : les côtés sont fermés et les deux axes de marche rencontrent une cible.');
 a.select('bard').act('R').stage('Le chant atteint le Voleur et le Magicien au coin de sa portée, mais pas la réserve derrière le bouton. L’écran droit reste contre sa butée. La commande se vide : la presse ferme et immerge le chargement dans le détroit.');
 a.go(5,7,'wizard').select('thief').act('LR').stage('Le Magicien se retire du dos du Voleur. Celui-ci revient ouvrir la presse, puis repart en tirant la réserve sur sa commande. Cette seconde relève maintient le passage ouvert.');
 a.go(6,11,'thief').go(16,6,'bard').go(16,2,'merchant').go(14,2,'wizard').go(14,6,'thief');
 a.stage('L’appui créé par la fermeture et le poids conservé sur la commande permettent les quatre arrivées. La victoire ne compte ni fermetures ni tractions.');
 return a;
}

export const source={label:'Adaptation · Heroes and Water · énigme 9',url:'https://sinkingstarwalkthrough.com/fr/heroes-and-water-solutions/#%C3%A9nigme-9',puzzle:9,objective:'Préparer le chargement, interrompre une relève pour déclencher la presse, puis rétablir une occupation continue avant la traversée.'};
export const adaptation={sourcePrinciple:'Préparer un déclencheur, déplacer les opérateurs, puis retirer un écran au moment utile afin de libérer un autre accès.',changes:'Le pont escamoté, le cristal-écran et le feu de dragon du guide deviennent un chargement de presse et une commande tenue par un héros. Le Voleur charge la presse après une première relève. Sur le poste resserré, le Magicien voit une cible sur chacun des deux axes disponibles : un échange y maintient un occupant. Un chant sélectif transporte ensuite le Voleur sans tirer la réserve ; l’écran opposé reste contre sa butée et la fermeture dépose le chargement. Le retour puis la traction de relève réouvrent le passage en conservant son poids. Ce sont les règles de collision et de circuit ordinaires de SS24, sans feu ni déclencheur caché.',limits:'La source fournit la préparation et le retrait différé, pas la chaîne de causes exacte de cette machine. Les comparaisons locales établissent la différence entre une relève continue et une rupture depuis les postes documentés. La variante ancienne qui faisait simplement marcher le Magicien hors du bouton est refusée par les parois actuelles. D’autres retraits préparés des écrans ou d’autres constructions du détroit ne sont pas exclus ; aucune unicité ni nécessité de chaque rôle n’est affirmée.',localChecks:[]};
if(process.argv[1]===fileURLToPath(import.meta.url))build().save(new URL('../level5-design.json',import.meta.url),source,adaptation);
