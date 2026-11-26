import {fileURLToPath} from 'node:url';
import {Author,board} from './author.mjs';

export function spec(){
 const b=board(20,14),{fill,put}=b;
 fill(1,6,7,11);fill(4,3,6,5);fill(7,4,10,4);
 fill(11,3,13,5);put(12,6);fill(8,7,14,7);fill(8,10,14,10);fill(11,8,14,11);put(12,8,'~');
 fill(15,3,17,6);put(14,5);put(15,9);fill(16,8,18,11);
 put(4,7,'W');put(5,7,'1');put(6,7,'o');put(5,4,'T');put(15,5,'Z');put(4,10,'B');
 for(const [x,y]of[[16,8],[18,8],[16,11],[18,11]])put(x,y,'g');
 return{id:'ss25-02',title:'Le quai à deux réceptions',mode:'quartet',rows:b.strings(),
  circuits:[{id:'envoi',color:10,buttons:[{x:5,y:10}]},{id:'reception',color:11,buttons:[{x:12,y:5}]},{id:'depot',color:14,buttons:[{x:15,y:5}]}],
  gates:[{at:{x:12,y:7},circuit:'envoi',direction:'N',closedWhen:'pressed'},
   {at:{x:10,y:4},circuit:'envoi',direction:'E',closedWhen:'pressed'},
   {at:{x:14,y:5},circuit:'reception',direction:'E',closedWhen:'released'},
   {at:{x:15,y:9},circuit:'reception',direction:'E',closedWhen:'released'},
   {at:{x:16,y:9},circuit:'depot',direction:'E',closedWhen:'released'}]};
}

export function build(){
 const a=new Author(spec());
 a.select('warrior').act('RRRRRR');
 a.go(12,5,'thief');
 a.stage('Le convoi réunit un miroir et une caisse. Le Guerrier pousse la file jusqu’au poste latéral ; le Voleur rejoint le quai supérieur avant que la commande ferme son accès.');
 a.select('bard').act('R');
 a.stage('La première fermeture déporte la caisse vers le nord et coupe en même temps la galerie d’accès au quai. Le Voleur attend déjà du bon côté de la charge.');
 a.select('thief').act('U');
 a.stage('La traction remonte uniquement la caisse reçue et remplace le poids du Voleur sur le relais. La baie du Magicien reste ouverte, mais le quai ne peut recevoir la seconde pièce tant que la caisse y reste.');
 a.select('wizard').act('LU').go(11,4);
 a.stage('Le Magicien échange avec la caisse, qui remplace son poids dans la baie distante. Il échange ensuite avec le Voleur : celui-ci reprend le relais sans reprendre la caisse, et le poste de réception est prêt pour le miroir.');
 a.select('bard').act('L');
 a.select('warrior').act('R');
 a.select('bard').act('R');
 a.stage('La commande est rouverte pour charger le miroir, puis refermée. Le même poste latéral sert une seconde fois ; le poids distant est conservé.');
 a.select('thief').act('URD');
 a.select('bard').act('L');
 a.stage('Le Voleur tire le miroir sur le relais puis quitte la commande sans la libérer. Les deux charges occupent des postes distincts ; les deux passages d’arrivée peuvent rester ouverts.');
 a.go(18,11,'bard');a.go(18,8,'warrior');a.go(16,8,'wizard');a.go(16,11,'thief');
 return a;
}

export const source={label:'Adaptation · Heroes and Stones, East · énigme 2',url:'https://sinkingstarwalkthrough.com/fr/heroes-and-stones-east-solutions/',puzzles:[2],objective:'Préparer le réceptionnaire avant chaque envoi, dégager le quai par échange puis conserver les deux dépôts.'};
export const adaptation={sourcePrinciple:'Le guide place le Voleur à l’extrémité de chaque tronçon avant la poussée et choisit le sens de traction pour préparer la suite.',changes:'Les ricochets de pierres sont remplacés par une file de caisse et de miroir poussée par le Guerrier, puis par deux transports successifs d’une presse latérale. La commande ferme aussi la galerie du réceptionnaire. La première charge doit quitter le quai sans perdre le poids de commande : l’échange la dépose dans la baie du Magicien en remplaçant son poids, et un échange de partenaires maintient le relais de réception. Le miroir peut alors être réceptionné sur ce relais. Les deux commandes finales sont séparées ; aucun projectile, chronomètre ou pouvoir de ricochet n’est importé.',limits:'La contre-branche établit la fermeture de l’accès après un envoi prématuré et la nécessité de rouvrir ce passage pour revenir à cette préparation. Elle ne prétend pas prouver une impasse définitive ni l’unicité de la route.',localChecks:[]};
adaptation.localChecks=[
 {name:'Réception préparée avant envoi',observed:'Un envoi effectué avant le placement du Voleur ferme sa galerie ; son pas depuis la case voisine est refusé.',scope:'Contre-branche locale reproduite dans review-middle-ss25.mjs ; rouvrir la commande reste une récupération autorisée.'},
 {name:'Le quai doit être libéré pour la deuxième charge',observed:'Sans les échanges intermédiaires, la caisse reçue occupe encore la case où le Voleur doit se placer pour extraire le miroir.',scope:'État obtenu par les mêmes deux envois, sans les échanges ; pas une preuve d’impasse définitive.'},
 {name:'Absence de poste inférieur de poussée',observed:'L’eau nue sous le poste latéral interdit au Guerrier de s’y placer par marche pour remplacer directement cet envoi.',scope:'Test du pas vers cette case, appuis et ressources inchangés.'}
];
if(process.argv[1]===fileURLToPath(import.meta.url))build().save(new URL('../level2-design.json',import.meta.url),source,adaptation);
