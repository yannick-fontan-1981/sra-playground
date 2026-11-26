import {fileURLToPath} from 'node:url';
import {Author,board} from './author.mjs';

export function spec(){
 const b=board(19,14),{fill,put}=b;
 fill(1,2,6,11);fill(8,3,11,5);fill(8,9,11,11);
 fill(7,4,7,10,'~');fill(8,6,9,8,'~');fill(9,7,13,7);fill(14,4,17,10);
 put(7,5,'s');put(7,9,'s');put(4,5,'W');put(5,5,'o');put(6,5,'o');
 put(9,3,'T');put(9,9,'Z');put(3,11,'B');
 for(const [x,y]of[[15,5],[17,5],[15,9],[17,9]])put(x,y,'g');
 return{id:'ss25-03',title:'Les deux formes du pont',mode:'quartet',rows:b.strings(),
  circuits:[{id:'haut',color:10,buttons:[{x:10,y:4}]},{id:'bas',color:11,buttons:[{x:10,y:10}]}],
  gates:[{at:{x:11,y:7},circuit:'haut',direction:'E',closedWhen:'released'},
   {at:{x:13,y:7},circuit:'bas',direction:'E',closedWhen:'released'}]};
}

export function build(){
 const a=new Author(spec());
 a.go(10,4,'thief');
 a.select('warrior').act('RRRR');
 a.select('thief').act('URD');
 a.stage('Les deux appuis sont encore séparés. Le Voleur attend dans la baie nord avant l’arrivée de la file, extrait sa tête sur la commande haute puis laisse la seconde caisse dans la ligne verticale.');
 a.select('wizard').act('U');
 a.stage('Le Magicien échange depuis la baie basse à travers la colonne d’eau. La caisse arrière du convoi rejoint ainsi le second atelier, sans transformer cette charge en appui.');
 a.go(5,2,'warrior');
 a.go(8,5,'thief').act('LL').go(10,10);
 a.go(8,9,'warrior').act('R').go(5,2);
 a.select('thief').act('DRU');
 a.go(3,2,'wizard');a.go(2,2,'thief');
 a.stage('La seconde charge est livrée par poussée puis traction vers le sud. Les deux relais restent lestés, mais les appuis qui ont servi aux livraisons ne forment toujours aucun passage vers les destinations.');
 a.go(5,11,'bard').act('URU');
 a.stage('La Barde remonte l’appui inférieur, le décale vers la droite puis le remonte encore. Le premier appui reste au nord, hors de portée pendant ces trois gestes.');
 a.go(5,9,'thief').act('LL').go(2,2);
 a.stage('Le Voleur retire la Barde du bord du bassin sans chanter : le premier appui rangé ne la suit pas pendant son changement de poste.');
 a.go(5,5,'bard').act('DD');
 a.stage('Depuis la rive supérieure, la Barde abaisse le second appui. Les deux pièces deviennent voisines dans le chenal central ; les appuis séparés de l’aller sont maintenant un pont continu pour le départ commun.');
 a.go(17,9,'bard');a.go(17,5,'warrior');a.go(15,9,'thief');a.go(15,5,'wizard');
 return a;
}

export const source={label:'Adaptation · Heroes and Stones, East · énigme 4',url:'https://sinkingstarwalkthrough.com/fr/heroes-and-stones-east-solutions/',puzzles:[4],objective:'Employer deux appuis séparés pour livrer les charges puis les réunir sans perdre les dépôts ni les partenaires.'};
export const adaptation={sourcePrinciple:'Le guide distingue une disposition espacée des plateformes pour aller et revenir d’une livraison, puis une disposition accolée pour disposer du poste nécessaire à une autre poussée.',changes:'Deux appuis immergés desservent d’abord des baies séparées, au nord et au sud. Un convoi de deux caisses est fractionné : la tête est extraite vers le haut, la seconde charge passe à travers la colonne d’eau par échange, puis est extraite vers le bas. Les poids maintiennent deux portes tandis que les mêmes appuis doivent quitter les deux traversées initiales et former un pont central de deux cases. La Barde réalise les déplacements, puis le Voleur la dégage sans entraîner l’appui déjà rangé. Aucun courant, ricochet, Druide ou empilement supplémentaire n’est ajouté.',limits:'La revue compare des configurations et des contre-gestes précis du témoin. Elle établit que les deux traversées latérales ne franchissent pas le chenal central, sans déclarer la route optimale ni exclure toute autre coopération légale.',localChecks:[]};
adaptation.localChecks=[
 {name:'Deux configurations des mêmes appuis',observed:'Après les livraisons, les deux appuis séparés ne soutiennent pas le chenal central ; le pas de traversée est refusé. Les deux appuis deviennent ensuite voisins sans nouvelle caisse immergée.',scope:'Ressources inchangées et états de la route reproduits ; pas d’exclusion de toute stratégie différente.'},
 {name:'Quitter le premier appui sans le reprendre',observed:'Le départ volontaire de la Barde fait remonter l’appui déjà rangé, tandis que sa traction passive le conserve.',scope:'Comparaison d’un contre-geste avec la relève effectivement exécutée.'}
];
if(process.argv[1]===fileURLToPath(import.meta.url))build().save(new URL('../level3-design.json',import.meta.url),source,adaptation);
