import {fileURLToPath} from 'node:url';
import {Author,board} from './author.mjs';

export function spec(){
 const b=board(20,17),{fill,put}=b;
 fill(1,3,8,6);fill(1,7,9,14);fill(9,5,12,5);fill(10,6,10,8,'~');
 put(10,7);fill(11,7,12,7,'~');put(10,9,'1');fill(11,9,15,9);
 fill(13,3,18,8);fill(10,11,13,11);put(13,10);
 fill(16,9,16,11);fill(14,12,18,15);
 put(5,5,'W');put(6,5,'o');put(7,5,'o');put(8,5,'T');
 put(10,7,'o');put(13,7,'Z');put(16,6,'B');
 for(const [x,y]of[[14,12],[18,12],[14,15],[18,15]])put(x,y,'g');
 return{id:'ss25-04',title:'La cale que l’on reprend',mode:'quartet',rows:b.strings(),
  circuits:[{id:'traction',color:11,buttons:[{x:9,y:5}]},{id:'releve',color:10,buttons:[{x:13,y:7}]},{id:'dernier',color:14,buttons:[{x:14,y:3}]}],
  gates:[{at:{x:10,y:11},circuit:'releve',direction:'E',closedWhen:'released'},
   {at:{x:16,y:9},circuit:'traction',direction:'S',closedWhen:'released'},
   {at:{x:16,y:10},circuit:'releve',direction:'S',closedWhen:'released'},
   {at:{x:16,y:11},circuit:'dernier',direction:'S',closedWhen:'released'}],
  platforms:[{at:{x:11,y:7},circuit:'releve',activeWhen:'pressed'},{at:{x:12,y:7},circuit:'releve',activeWhen:'pressed'}]};
}

export function build(){
 const a=new Author(spec());
 a.select('warrior').act('R');a.select('thief').act('R');
 a.stage('Le Guerrier avance les deux caisses et le Voleur ensemble. La traction suivante ne prend que la caisse voisine : elle reste sur la première commande, tandis que la caisse arrière est conservée pour la relève.');
 a.select('wizard').act('LU');
 a.stage('La cale qui masquait le miroir remplace le poids du Magicien dans la baie droite. Elle maintient la passerelle hydraulique et le retour inférieur. Le Magicien échange ensuite avec le Voleur, qui quitte la charge sans la tirer.');
 a.act('X');
 a.stage('Le reflet emporte le Voleur depuis l’îlot intermédiaire vers la rive droite. La caisse restée sur la commande haute ne suit pas ; sans extraction de la cale, c’est cette dernière que le miroir aurait prise.');
 a.go(17,3,'wizard');
 a.go(7,4,'warrior').act('DD').go(6,7).act('RRRRRR').go(9,12);
 a.stage('La caisse arrière descend dans la galerie de service, franchit les deux cases hydrauliques puis pousse la cale en file. Elle remplace son poids sans interrompre la passerelle : la cale peut maintenant servir ailleurs.');
 a.go(14,6,'thief').act('UUR').go(18,8);
 a.stage('Le Voleur extrait la cale libérée vers le haut puis rejoint la bordure droite du chant. La relève reste en place, et la dernière charge est préparée pour une remontée par le chant depuis le flanc.');
 a.select('bard').act('UU');
 a.stage('Deux chants depuis la rive droite remontent la cale sur le dernier bouton et rapprochent le Voleur de son prochain poste. La caisse de relève reste hors de portée, tandis que le mur retient le Magicien.');
 a.go(13,4,'wizard');
 a.go(17,4,'thief').act('R').go(13,11);
 a.stage('Le Voleur retire la Barde de sa portée de travail. Son prochain déplacement ne reprend plus la cale ; les trois poids restent en place pour le départ des quatre héros.');
 a.go(18,15,'bard');a.go(14,12,'wizard');a.go(14,15,'thief');a.go(18,12,'warrior');
 return a;
}

export const source={label:'Adaptation · Heroes and Light · énigme 29',url:'https://sinkingstarwalkthrough.com/fr/heroes-and-light-solutions/',puzzles:[29],objective:'Extraire une cale qui masque le transport, lâcher une charge sans la reprendre, puis remplacer et réemployer cette même cale.'};
export const adaptation={sourcePrinciple:'Une pierre bloque un faisceau pendant la traction d’une autre charge. Le transport violet permet au Voleur de quitter une traction sans entraîner sa prise ; la première cale est ensuite reprise pour préparer une autre ligne et les derniers dépôts.',changes:'Le faisceau violet devient une succession d’échange et de reflet, avec une vraie première cible visible. Une cale sur l’îlot masque d’abord le Voleur : le Magicien la dépose sur un relais, puis extrait le Voleur sans reprendre la caisse qu’il vient de livrer. Le reflet termine ce transport passif. La même cale maintient ensuite deux plateformes jusqu’à ce que le Guerrier la pousse en file avec la caisse de relève : le poids est remplacé sans coupure. Enfin le Voleur et la Barde réemploient la cale sur la dernière commande ; une traction passive retire la Barde sans déplacer son dernier dépôt. Les lumières violettes, leur vitesse et leurs autres pouvoirs ne sont pas importés.',limits:'Les contrefactuels portent sur le premier reflet masqué, la traction qui reprendrait une charge, le retrait du poids avant la relève et la reprise du dernier poids par un départ chanté. Ils décrivent des états réellement rejoués, sans affirmer que tous les autres ordres légaux sont impossibles.',localChecks:[]};
adaptation.localChecks=[
 {name:'La première cible masque le Voleur',observed:'Le reflet tenté avant l’extraction de la cale transporte cette dernière et laisse le Voleur en place.',scope:'Contre-branche depuis la première livraison ; effet local du choix de la cible la plus proche.'},
 {name:'Transport passif pour lâcher la charge',observed:'Le pas volontaire du Voleur reprend le poids du premier bouton ; l’échange suivi du reflet laisse ce poids sur place.',scope:'Comparaison de gestes réellement exécutés depuis le même état de livraison.'},
 {name:'Remplacer le poids avant de le récupérer',observed:'Une extraction anticipée de la cale retire les deux plateformes. La poussée de file y substitue la caisse de relève sans retrait.',scope:'Deux branches locales comparées ; aucune conclusion d’impasse définitive.'},
 {name:'Conserver le dernier dépôt',observed:'Descendre volontairement avec la Barde reprend la cale ; la retirer par traction permet de partir avec les trois commandes lestées.',scope:'Contre-geste et départ passif reproduits sur les cartes finales.'}
];
if(process.argv[1]===fileURLToPath(import.meta.url))build().save(new URL('../level4-design.json',import.meta.url),source,adaptation);
