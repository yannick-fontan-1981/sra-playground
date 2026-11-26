import {fileURLToPath} from 'node:url';
import {Author,board} from './author.mjs';

export function spec(){
 const b=board(20,20),{fill,put}=b;
 // Three courts linked by an upper throat, a lower throat and a right-hand walk.
 fill(1,1,8,18);fill(10,1,18,8);fill(10,10,18,18);
 put(9,4);put(9,13);put(18,9);
 fill(1,11,7,13,'~');put(4,6,'#');put(7,5,'#');
 for(const[x,y,c]of[[2,3,'M'],[5,3,'T'],[2,7,'Z'],[6,7,'B'],[3,3,'o'],[4,3,'o'],[8,7,'o'],[3,9,'o'],[2,5,'o'],[4,5,'o'],[6,5,'o'],[2,10,'o'],[5,11,'s'],[4,12,'s'],[16,2,'m'],[18,2,'m'],[13,15,'m'],[15,15,'m'],[13,10,'o'],[13,12,'1']])put(x,y,c);
 for(const[x,y]of[[11,11],[17,11],[11,17],[17,17]])put(x,y,'g');
 return{id:'ss24-01',title:'L’atelier des départs',mode:'quartet',rows:b.strings(),
  circuits:[{id:'relai',color:14,buttons:[{x:5,y:3}]},{id:'presse',color:10,buttons:[{x:3,y:16}]}],
  gates:[{at:{x:9,y:13},circuit:'relai',direction:'E',closedWhen:'released'},{at:{x:15,y:15},circuit:'presse',direction:'W',closedWhen:'pressed'}]};
}
export function build(){
 const a=new Author(spec());
 a.select('thief').act('R').stage('Une prise arrière relève la commande ; la seconde caisse alignée reste en place.');
 a.select('merchant').act('R').stage('Le Marchand déplace une seule caisse vers la place libérée.');
 a.go(1,7).act('R').stage('La poussée transporte le Magicien sans lancer de rayon.');
 a.select('wizard').act('R').stage('Le Barde est la première cible ; la caisse plus lointaine reste en place et aucun chant ne part.');
 a.go(4,7,'thief').act('R').stage('Le Voleur extrait le Barde sans déplacer sa caisse voisine.');
 a.select('wizard').act('D').stage('Sans cible dans sa ligne, le Magicien marche sans tirer.');
 a.select('bard').act('R').stage('Le chant atteint un coin et traverse une cloison ; une butée retient une caisse, les partenaires suivent sans pouvoir.');
 a.go(5,10,'wizard').act('U').stage('Un échange installe le Barde au bord du bassin sans faire suivre son groupe.');
 a.go(2,9,'merchant').act('D').stage('Une caisse devient un appui dans l’eau.');
 a.go(3,15).act('D').stage('La presse rapproche deux gardiens : leurs contacts se résolvent loin des héros.');
 a.go(1,17);
 a.select('bard').act('RD').stage('Les appuis libres glissent ; celui de l’arrivée du Barde reste ancré.');
 a.go(8,11,'wizard').act('L').stage('La visée franchit l’eau et échange avec le Barde, sans construire de nouveau passage.');
 a.select('bard').act('U').stage('Le Magicien suit le chant vers la rive ; son appui occupé reste en place.');
 a.act('UUUUUU').stage('La remontée quitte le bassin et replace quelques charges contre leurs butées.');
 a.act('RRR').go(14,4).act('R').stage('Un gardien à l’angle de la portée rejoint l’autre, puis tous deux disparaissent au contact.');
 // The first activation needs a crate alone on the north axis.
 a.go(12,10,'wizard');a.select('merchant').act('X').stage('Le reflet projette la caisse sur l’axe perpendiculaire en conservant sa distance.');
 a.go(13,10,'wizard').act('X').stage('À égale distance, le héros et la caisse échangent par le miroir.');
 a.act('L').stage('La face blanche dévie la visée jusqu’à la caisse de retour.');
 a.go(13,13,'thief').act('D').stage('Le Voleur tire le miroir sans modifier son orientation.');
 a.go(17,17,'bard');a.go(11,11,'merchant');a.go(11,17,'thief');a.go(17,11,'wizard');
 return a;
}
export const source={label:'Atelier original · monde Nord',url:'https://sinkingstarwalkthrough.com/fr/north/',objective:'Comparer quatre façons de déplacer un occupant, préparer les deux places d’un échange et choisir ce qui reste après le départ.'};
export const adaptation={sourcePrinciple:'La complémentarité des héros du Nord sert de cadre pédagogique à un atelier original.',changes:'Trois cours, deux passages et un bassin introduisent le quatuor MTZB. Une prise unique remplace la poussée de file ; les transports silencieux, le maintien d’une commande et les appuis sont comparés dans les mêmes situations.',limits:'Les 37 découvertes sont pédagogiques et leur ordre reste libre. Le témoin les rassemble ; la victoire dépend uniquement des quatre héros vivants sur les quatre destinations.',localChecks:[]};
if(process.argv[1]===fileURLToPath(import.meta.url))build().save(new URL('../level1-design.json',import.meta.url),source,adaptation);
