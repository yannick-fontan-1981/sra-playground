import {fileURLToPath} from 'node:url';
import {Author,board} from './author.mjs';
export function spec(){
 const b=board(20,20),{fill,put}=b;fill(1,1,18,18);
 // A broad workshop surrounds one short wet bay and a sealed arrival room.
 fill(3,7,10,9,'~');
 fill(14,12,18,12,'#');fill(14,12,14,18,'#');put(14,15);
 put(14,3,'#');put(17,4,'#');
 put(2,2,'W');put(3,2,'M');put(4,2,'Z');put(5,2,'B');put(6,2,'o');
 put(4,6,'o');put(6,7,'s');put(7,7,'s');
 put(12,2,'o');put(14,2,'o');put(16,4,'o');
 put(16,6,'m');put(18,6,'m');
 put(12,9,'m');put(12,11,'m');
 put(6,12,'o');put(6,15,'1');
 for(const[x,y]of[[16,14],[18,14],[16,17],[18,17]])put(x,y,'g');
 return{id:'ss23-01',title:'Le conservatoire des échanges',mode:'quartet',rows:b.strings(),
  circuits:[{id:'sortie',color:11,buttons:[{x:4,y:2}]},{id:'presse',color:10,buttons:[{x:2,y:14}]}],
  gates:[{at:{x:14,y:15},circuit:'sortie',direction:'E',closedWhen:'released'},
   {at:{x:12,y:11},circuit:'presse',direction:'N',closedWhen:'pressed'}]};
}
export function build(){
 const a=new Author(spec());
 a.select('warrior').act('R').stage('Une poussée déplace la file mixte et relève la commande sans aucun pouvoir secondaire.');
 a.select('wizard').act('R').stage('La première cible est le Barde : l’échange le replace sans entraîner la caisse voisine.');
 a.go(6,6,'wizard');a.select('merchant').act('R');a.select('wizard').act('U').stage('Le Marchand aligne le Barde ; le Magicien l’installe au bord de l’eau sans chant.');
 a.go(11,7,'wizard');
 a.go(8,2,'merchant').act('LLL').stage('Une caisse relève la commande de sortie, libérant tous les héros.');
 a.go(4,5).act('D').stage('La caisse descend dans la baie et devient un appui.');
 a.go(2,13).act('D').stage('Une presse rapproche deux gardiens ; le contact simultané les élimine à distance sûre.');a.go(1,15);
 a.select('bard').act('R').stage('Le chant déplace les appuis libres d’eau en eau.');
 a.act('D').stage('Le prochain appui du Barde reste ancré, tandis que les autres glissent.');
 a.select('wizard').act('L').stage('Le rayon traverse la baie ; échanger le Barde l’extrait sans déplacer les appuis.');
 a.act('U').stage('Sans cible dans sa ligne, le Magicien marche et quitte son appui.');
 a.go(14,7,'bard');a.go(14,4,'wizard').act('D').stage('Un échange envoie le Barde au poste qui commande le coin et la cloison.');
 a.go(14,6,'wizard');
 a.select('bard').act('R').stage('Le chant transporte aussi le Magicien sans sort, atteint un coin, traverse une cloison et laisse la pièce retenue par la butée. Les deux gardiens se rencontrent.');
 a.go(15,7,'wizard').act('U').stage('Un échange libère le Barde de son groupe sans chant de retour.');
 a.go(6,11,'merchant').act('X').stage('Le reflet transporte la caisse à distance égale de l’autre côté du miroir.');
 a.go(6,12,'wizard').act('X').stage('À distance égale, le reflet échange le héros et la caisse.');
 a.act('L').stage('Le rayon du Magicien tourne sur la face blanche et échange avec sa première cible.');
 a.go(5,15,'merchant').act('R').stage('Le miroir change de poste sans changer sa face.');
 a.go(18,17,'bard');a.go(16,14,'merchant');a.go(18,14,'warrior');a.go(16,17,'wizard');
 return a;
}
export const source={label:'Atelier original · pouvoirs du monde Nord',url:'https://sinkingstarwalkthrough.com/fr/north/',objective:'Découvrir les quatre rôles, préparer les deux places d’un échange et choisir les pièces qui suivent le chant.'};
export const adaptation={sourcePrinciple:'Le tutoriel assemble les pouvoirs complémentaires du monde Nord dans une géométrie originale.',changes:'Quatre rôles MWZB, files mixtes, appuis libres ou ancrés, visée déviée et presses sont enseignés dans un atelier sans trajet imposé. Les règles des campagnes SS sont conservées.',limits:'Le parcours d’auteur vise les 36 découvertes publiques. Elles ne sont ni des conditions de victoire ni une obligation de suivre cet ordre.',localChecks:[]};
if(process.argv[1]===fileURLToPath(import.meta.url))build().save(new URL('../level1-design.json',import.meta.url),source,adaptation);
