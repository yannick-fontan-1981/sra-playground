import {Author,board} from './author.mjs';
const {put,fill,strings}=board(20,19,'~');
fill(1,7,8,17);put(8,6,'#');put(9,16,'#');
put(6,11,'T');put(2,10,'Z');put(6,10,'o');put(6,9,'m');
put(5,9,'#');put(7,9,'#');put(6,8,'#');
fill(11,2,18,13);put(11,6,'o');put(16,10,'o');
put(17,14);put(17,15);put(16,3,'g');put(17,3,'g');
const spec={id:'ss13-08',title:'La ligne libre et le poids gardé',rows:strings(),facing:'S',
 mirrors:[{at:{x:8,y:16},facing:'NE'},{at:{x:16,y:6},facing:'SW'}],
 circuits:[{id:'arrivee',buttons:[{x:16,y:10}],color:14}],
 platforms:[{at:{x:16,y:15},circuit:'arrivee',activeWhen:'pressed'}]};
const a=new Author(spec);
a.act('D').stage('Le Voleur retire la cible proche de la ligne du Magicien sans approcher le monstre');
a.go(8,15).act('U').stage('Le Voleur décale son miroir pour libérer le rayon horizontal');
a.act('L').go(8,7).stage('Le Voleur attend au seul rayon qui peut atteindre l’appui d’arrivée');
a.select('wizard').act('R').stage('La ligne dégagée permet au Magicien d’atteindre la cible lointaine et de reprendre sa commande');
a.act('U').stage('Le rayon dévié échange la caisse de la rive droite avec le Magicien et garde la commande occupée');
a.go(13,6).stage('Le Magicien contourne la visée du miroir puis devient sa cible la plus proche');
a.select('thief').act('X').stage('Les deux miroirs déplacent les héros; la caisse plus éloignée reste sur la commande de l’appui');
a.act('R').stage('Le Voleur quitte l’appui hydraulique vers le quai solide');
a.go(16,3,'wizard').stage('Le Magicien rejoint la première destination en laissant le poids durable en place');
a.go(17,3,'thief').stage('Le Voleur rejoint la deuxième destination après le transfert physique entre les rives');
a.save(new URL('../level8-design.json',import.meta.url),{
 puzzle:10,label:'Adaptation de Heroes and Water · énigme 10 · garder libre la ligne d’échange',
 url:'https://sinkingstarwalkthrough.com/fr/heroes-and-water-solutions/#%C3%A9nigme-10',
 secondaryLabel:'Heroes and Mirrors · énigme 5 · maintenir le poids en quittant par reflet',
 secondaryUrl:'https://sinkingstarwalkthrough.com/fr/heroes-and-mirrors-solutions/#%C3%A9nigme-5',
 objective:'Retirer une cible proche dangereuse, préparer la transposition lointaine, remplacer la commande par une caisse et utiliser la priorité des reflets pour transporter les deux héros sans retirer ce poids.',
 piston:false,platform:true,
},'Heroes and Water 10 fournit la contrainte de réorganiser les cibles pour conserver une ligne d’échange utile; Heroes and Mirrors 5 fournit le maintien d’un poids pendant le départ par reflet. SS13 compose une cible proche gardée par un monstre, une ancre lointaine sur commande, un échange à rayon dévié et deux miroirs activés ensemble. Le Magicien doit se placer plus près que la caisse sur le second miroir afin de laisser l’appui du Voleur actif. La caisse sous garde, la priorité proche de la série SS et cette géométrie sont des adaptations originales, sans revendication de reproduction exacte ni d’unicité de la solution.');
