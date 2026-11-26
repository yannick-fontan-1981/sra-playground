import {writeFileSync} from 'node:fs';
import {Author,board} from './author.mjs';

const b=board(20,18);
b.fill(2,7,11,9);b.fill(2,10,6,15);b.fill(7,11,9,15);b.fill(8,10,11,10);b.put(7,10);
b.fill(6,3,7,7);b.fill(2,5,5,6);b.fill(2,2,4,3);b.put(4,4);
b.put(11,9,'#');b.put(10,11,'#');b.put(10,12,'~');b.put(11,11);b.put(11,12);
b.put(12,8);b.put(13,8,'~');b.put(14,8,'~');b.put(15,8);b.fill(16,5,16,8);b.fill(17,6,18,6);
for(const x of [2,3,4])b.put(x,2,'g');b.put(16,5,'g');
b.put(2,8,'M');b.put(6,7,'T');b.put(6,11,'Z');b.put(15,8,'B');b.put(17,6,'m');
b.put(4,8,'o');b.put(6,8,'2');

export const spec={id:'ss24-06',title:'Trois postes, un seul retour',mode:'quartet',rows:b.strings(),facing:'N',
 circuits:[{id:'chargement',color:10,buttons:[{x:10,y:10}]},{id:'depot',color:11,buttons:[{x:11,y:12}]}],
 gates:[{at:{x:6,y:6},circuit:'chargement',direction:'N',closedWhen:'pressed'},{at:{x:12,y:8},circuit:'chargement',direction:'E',closedWhen:'released'},
 {at:{x:4,y:4},circuit:'depot',direction:'N',closedWhen:'released'},{at:{x:16,y:6},circuit:'depot',direction:'N',closedWhen:'released'}]};

export function build(){
 const a=new Author(spec);
 a.select('thief').act('UUUU').go(5,8).act('RRRRRR').go(6,5);
 a.stage('Le Voleur remonte le miroir dans le garage supérieur, puis extrait la charge par le passage libéré. La charge attend au milieu : la livrer tout de suite fermerait le passage nécessaire au retour du miroir.');
 a.act('DDDD').go(2,12);
 a.stage('Le miroir revient à son coude avant la fermeture de son couloir de service. Le Voleur peut quitter le poste inférieur ; la charge reste accessible depuis le haut.');
 a.go(10,7,'merchant').act('DD');
 a.stage('La livraison intermédiaire ferme le couloir supérieur mais ouvre la fenêtre droite. L’ordre précédent conserve donc le miroir au bon étage lorsque la visée devient disponible.');
 a.select('bard').act('R');
 a.stage('Dans la chambre distante, la Barde décale le monstre vers le bout de sa corniche. Il reste vivant ; sa nouvelle distance permet au futur occupant de rejoindre la sortie sans contact.');
 a.select('wizard').act('U');
 a.stage('La visée passe par le miroir remis en place et par la fenêtre ouverte. Le Magicien remplace la Barde dans la chambre droite ; la Barde rejoint l’atelier inférieur.');
 a.select('bard').act('RRRDD');
 a.stage('Depuis la bordure de la niche, la Barde fait tourner la charge vers la droite puis la descend jusqu’au dépôt inaccessible par le bas. Le Marchand est entraîné sur la commande intermédiaire et la tient pendant cette livraison.');
 a.act('DD');
 a.stage('Deux pas vers le bas laissent le dépôt contre son fond de niche et sortent la Barde de sa portée. Son départ ne demande ni extraction par échange, ni abandon du poids.');
 a.go(2,2,'merchant');a.go(3,2,'thief');a.go(16,5,'wizard');a.go(4,2,'bard');
 return a.result({objective:'Dégager une charge, restaurer le coude avant de fermer son accès, puis préparer la relève distante et le dépôt dans une niche sans poste inférieur.',label:'Heroes and Light — énigme 11',url:'https://sinkingstarwalkthrough.com/fr/heroes-and-light-solutions/',puzzles:[11]},'Light 11 présente trois compartiments et une réorganisation provisoire : une pièce doit être écartée, puis remise avant le retour du faisceau, faute de quoi le retour est perdu. SS24 remplace la traversée de murs donnée par la lumière verte par un miroir tracté entre deux étages et une fenêtre commandée. Le Voleur gare le miroir, sort la charge, puis restaure le coude avant que le Marchand ne pose la charge sur le bouton qui ferme le couloir de service. La Barde éloigne le monstre dans la chambre distante avant de céder sa place au Magicien. La charge passe ensuite du poste intermédiaire à une niche accessible au chant mais sans poste de traction inférieur ; le Marchand entraîné assure une relève temporaire de commande. Le monstre n’est ni un poids final ni un adversaire détruit. La Barde quitte la portée par un détour inférieur, sans extraction silencieuse. Cette construction transpose l’ordre des stationnements et le maintien du retour ; elle ne reproduit pas la carte ni les pouvoirs lumineux de la source.');
}

if(process.argv[1]?.endsWith('build-level6.mjs')){const d=build();writeFileSync(new URL('../level6-design.json',import.meta.url),JSON.stringify(d,null,2)+'\n');console.log(JSON.stringify({title:spec.title,metrics:d.metrics,commands:d.commands}));}
