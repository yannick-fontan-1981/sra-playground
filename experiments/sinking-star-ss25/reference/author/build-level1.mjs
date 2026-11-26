import {fileURLToPath} from 'node:url';
import {Author,board} from './author.mjs';

export function spec(){
 const b=board(20,20),{fill,put}=b;
 // A single workshop loops around a central basin; the final bay has one controlled entry.
 fill(1,1,18,18);fill(9,2,11,8,'~');
 fill(14,15,18,15,'#');fill(14,16,14,18,'#');put(14,17);
 put(5,5,'#');put(4,8,'#');
 for(const[x,y,c]of[
  [3,2,'W'],[3,3,'o'],[3,4,'o'],[3,5,'T'],
  [6,3,'Z'],[6,7,'B'],[6,9,'o'],[4,3,'o'],[4,5,'o'],[4,7,'o'],
  [8,2,'o'],[9,6,'s'],[10,5,'s'],
  [3,15,'m'],[3,17,'m'],[16,8,'m'],[16,10,'m'],
  [10,14,'o'],[10,16,'1']])put(x,y,c);
 for(const[x,y]of[[15,16],[17,16],[15,18],[17,18]])put(x,y,'g');
 return{id:'ss25-01',title:'Le chantier des quatre gestes',mode:'quartet',rows:b.strings(),
  circuits:[{id:'releve',color:14,buttons:[{x:3,y:5},{x:10,y:17}]},{id:'presse',color:10,buttons:[{x:7,y:14}]}],
  gates:[{at:{x:14,y:17},circuit:'releve',direction:'E',closedWhen:'released'},
   {at:{x:3,y:17},circuit:'presse',direction:'N',closedWhen:'pressed'}]};
}

export function build(){
 const a=new Author(spec());
 a.select('thief').act('D').stage('Le Voleur remplace son poids par son voisin arrière et laisse la seconde caisse sur place.');
 a.select('warrior').act('DD').stage('Le Guerrier pousse d’abord une caisse, puis la file de deux caisses et du Voleur ; le partenaire transporté ne tire rien.');
 a.go(6,2).act('D').stage('Le Guerrier installe le Magicien devant sa ligne de travail sans lancer de sort.');
 a.select('wizard').act('D').stage('Le Barde arrête la première visée ; la caisse située derrière lui reste en place.');
 a.select('thief').act('D').go(6,5).act('D').stage('Le Voleur sort de la file en emportant sa seule voisine, puis extrait le Barde sans entraîner les charges voisines.');
 a.select('wizard').act('R').stage('Sans cible accessible, la même commande devient un pas ordinaire.');
 a.select('bard').act('D').stage('Le chant passe la cloison, atteint une diagonale et entraîne les partenaires ; une butée retient une charge.');
 a.go(8,6,'wizard').act('L').stage('Un échange place le Barde au bord du bassin, en laissant ses caisses dans l’atelier.');
 a.go(7,2,'warrior').act('R').stage('Une caisse sèche devient un appui immergé, et cesse d’être une charge à pousser ou une cible à échanger.');
 a.go(7,13).act('D').go(7,16).stage('La fermeture de la presse rapproche deux monstres ; leurs contacts se résolvent avant que le Guerrier quitte la commande.');
 a.select('bard').act('DR').stage('Deux appuis libres glissent d’eau en eau ; l’appui d’arrivée du Barde reste ancré.');
 a.go(9,9,'wizard').act('U').stage('La visée traverse l’eau nue sans la combler et échange deux postes sûrs.');
 a.select('bard').act('L').stage('Le Magicien rejoint la rive par le chant, tandis que l’appui qu’il occupait reste en place.');
 a.act('DDRRRRRRUUUUU').stage('Le Barde conduit le groupe par la rive basse, puis rapproche deux gardiens dans la galerie de droite ; les contacts se résolvent loin des héros.');
 a.go(9,14,'wizard').act('X').stage('Le premier reflet transporte seulement une caisse et conserve sa distance au miroir.');
 a.go(10,14).act('X').stage('À égale distance, le héros et la caisse échangent leurs places par reflet.');
 a.act('L').stage('Le Magicien retrouve la caisse par une visée coudée sur la face blanche du miroir.');
 a.go(10,17,'thief').act('D').stage('La traction déplace le miroir sans changer son orientation. Il devient le second poids de la relève et ouvre la baie finale.');
 a.go(14,7).act('DDD').go(17,12).stage('Le Voleur extrait une seconde fois le Barde et le laisse partir sans emporter la charge de son dernier trajet.');
 a.go(13,13,'bard').act('DDDDRRRRD').stage('Au passage de la baie, la butée retient la caisse transportée par le miroir : le Barde peut s’en éloigner et le miroir reste sur sa commande.');
 a.go(15,18,'thief').go(15,16,'warrior').go(17,16,'wizard');
 return a;
}

export const source={label:'Atelier original · monde Nord',url:'https://sinkingstarwalkthrough.com/fr/north/',objective:'Distinguer file poussée, prise unique, échange et chant ; organiser les transports passifs et réunir deux poids avant le départ.'};
export const adaptation={sourcePrinciple:'Le Nord organise la coopération de héros aux capacités différentes. Cette salle est un atelier original, pas la reproduction d’une énigme numérotée.',changes:'Le chantier entoure un bassin central. Une file verticale composée de deux caisses et d’un partenaire confronte la poussée du Guerrier à la prise unique du Voleur. Les ressources pédagogiques sont réemployées : les mêmes partenaires sont poussés, tirés, échangés puis chantés ; le miroir sert ensuite à la commande de sortie. Le circuit final exige deux poids maintenus à distance. Le plan et le parcours diffèrent des trois cours de SS24.',limits:'Les 39 découvertes sont pédagogiques. Le témoin les démontre, sans quota nécessaire à la victoire, sans solution unique ni affirmation que chaque pouvoir serait indispensable à toutes les variantes.',localChecks:[]};
if(process.argv[1]===fileURLToPath(import.meta.url))build().save(new URL('../level1-design.json',import.meta.url),source,adaptation);
