import {fileURLToPath} from 'node:url';
import {Author,board} from './author.mjs';

export function spec(){
 const b=board(20,20),{fill,put}=b;
 fill(1,1,8,14);fill(10,1,18,8);put(9,5);
 fill(1,10,13,14);fill(13,10,18,10);fill(17,9,17,18);
 fill(14,12,16,12);
 for(const x of [3,7,11])fill(x,15,x,18);
 put(11,4,'#');put(12,3,'#');put(12,5,'#');put(13,4,'~');
 put(2,2,'M');put(2,4,'W');put(5,4,'T');put(12,4,'Z');
 for(const [x,y]of [[3,2],[3,4],[4,4],[14,4],[16,4],[18,6]])put(x,y,'o');
 put(16,6,'1');put(14,12,'m');put(16,12,'m');
 for(const x of [3,7,11,17])put(x,17,'g');
 return{id:'ss21-01',title:'L’école des quatre',mode:'quartet',rows:b.strings(),
  circuits:[
   {id:'atelier',color:9,buttons:[{x:4,y:2}]},
   {id:'rencontre',color:14,buttons:[{x:12,y:11}]},
   {id:'sorties',color:15,buttons:[{x:3,y:12},{x:7,y:12},{x:11,y:12}]},
  ],gates:[
   {at:{x:9,y:5},circuit:'atelier',direction:'E',closedWhen:'released'},
   {at:{x:17,y:9},circuit:'atelier',direction:'S',closedWhen:'released'},
   {at:{x:14,y:12},circuit:'rencontre',direction:'E',closedWhen:'pressed'},
   ...[3,7,11,17].map(x=>({at:{x,y:15},circuit:'sorties',direction:'S',closedWhen:'released'})),
  ]};
}

export function build(){
 const a=new Author(spec());
 a.act('R').stage('Le Marchand pousse une caisse sur le bouton bleu.');
 a.select('warrior').act('RR').stage('Le Guerrier avance la file de deux caisses et du Voleur.');
 a.select('thief').act('RD').go(3,4).act('LD').stage('Le Voleur sépare la caisse de tête, puis tire le Guerrier sans déclencher sa poussée.');
 a.select('wizard').act('RRDXLL').stage('Première cible au-delà de l’eau, échange coudé, puis reflet des occupants à distance égale.');
 a.go(15,6,'merchant').act('RX').stage('Le miroir est décalé ; la caisse reflétée arrive au quai de reprise.');
 a.go(15,4).act('LL').stage('La caisse devient un appui fixe et le Marchand le traverse.');
 a.select('wizard').act('RDD').stage('Le Magicien échange avec le Marchand sur l’appui puis marche hors de la visée.');
 a.go(2,6,'warrior');
 a.select('merchant').act('R').go(6,4).act('LL').go(3,3).act('DDDDDDDD').stage('Première charge sèche installée sous la commande de sortie.');
 a.go(7,3,'warrior').act('DDDDDDD').go(12,10).act('D').stage('La presse avance un gardien vers le second ; leur rencontre libère la colonne est.');
 a.go(7,12,'thief').act('DR').stage('Le Voleur remplace son propre poids par la deuxième caisse sans abandonner la commande.');
 a.go(17,4).act('UU').go(16,3).act('LLL').go(14,4).act('DDDD').go(15,7).act('RRR').stage('Extraction du quai puis transfert de la caisse dans le couloir de livraison.');
 a.go(18,10,'merchant');
 a.go(17,8,'thief').act('DDD');
 a.select('merchant').act('LLLLLL').stage('Le Marchand livre la caisse au débouché de la troisième colonne.');
 a.go(11,11,'thief').act('DD').stage('Trois charges occupent les trois boutons ; les quatre passages de sortie sont ouverts.');
 a.go(17,17,'wizard').go(3,17,'merchant').go(7,17,'warrior').go(11,17,'thief').stage('Les quatre destinations sont occupées.');
 return a;
}

export const source={label:'Atelier original : Heroes of Hauling 3, 4 et 13',url:'https://sinkingstarwalkthrough.com/fr/heroes-of-hauling-solutions/',puzzle:'3, 4 et 13',secondaryUrl:'https://sinkingstarwalkthrough.com/fr/heroes-and-mirrors-solutions/',secondaryLabel:'Heroes and Mirrors — premières visées',objective:'Apprendre les quatre rôles, manipuler les arrivées optiques et installer trois poids pour les quatre sorties.',note:'Adaptation pédagogique : commandes à maintenir et relève par échange ; quatre rôles, appui fixe, quai optique et rencontre commandée ajoutés.'};
export const adaptation={sourcePrinciple:'Transformer les poids temporaires en charges permanentes et distribuer les accès entre des capacités différentes.',changes:'Trois commandes communes protègent quatre sorties séparées. Le trajet pédagogique ajoute une file mixte, la séparation de sa tête, une visée coudée distincte du reflet global et une presse dont le déplacement des gardiens reste visible.',teaching:'Le témoin montre les capacités du quatuor sans imposer de quota de découvertes à la victoire. Les démonstrations optiques supplémentaires restent des exercices légaux, pas des obligations cachées.',localChecks:[]};
if(process.argv[1]===fileURLToPath(import.meta.url))build().save(new URL('../level1-design.json',import.meta.url),source,adaptation);
