import {Author,board} from './author.mjs';
const b=board(20,20);
b.fill(1,1,6,6);b.fill(6,4,8,4);b.put(7,5);b.fill(8,5,8,9);b.put(2,7);b.put(7,6);b.put(9,8);b.put(9,9);b.fill(1,8,8,16);b.put(8,10,'#');
b.put(2,3,'#');b.put(4,3,'#');b.put(3,2,'#');b.put(5,4,'#');
b.fill(9,4,11,4,'~');b.fill(9,13,11,13,'~');b.fill(12,1,18,15);
b.fill(13,16,13,18);b.fill(14,18,18,18);
b.put(2,9,'W');b.put(15,4,'T');b.put(8,7,'Z');b.put(8,4,'2');
b.put(6,1,'o');b.put(6,2,'o');b.put(6,3,'o');b.put(3,3,'o');b.put(12,10,'o');b.put(13,9,'m');b.put(15,9,'m');
b.put(14,18,'g');b.put(16,18,'g');b.put(18,18,'g');
const spec={id:'ss17-07',title:'Les trois vies de la clef',rows:b.strings(),circuits:[
 {id:'prison',buttons:[{x:15,y:4}],color:10},
 {id:'chasse',buttons:[{x:3,y:3}],color:12},
 {id:'trois-lests',buttons:[{x:7,y:4},{x:4,y:13},{x:15,y:12}],color:15}
],gates:[
 {at:{x:2,y:7},circuit:'prison',direction:'S',closedWhen:'released'},
 {at:{x:12,y:9},circuit:'chasse',direction:'E',closedWhen:'released'},
 {at:{x:13,y:16},circuit:'prison',direction:'N',closedWhen:'pressed'},
 {at:{x:13,y:17},circuit:'trois-lests',direction:'N',closedWhen:'released'}
],platforms:[9,10,11].map(x=>({at:{x,y:13},circuit:'prison',activeWhen:'pressed'}))};
const a=new Author(spec);
a.select('wizard').act('U').stage('Le Magicien échange sa place avec le Voleur captif par un rayon coudé. La commande cyan reste occupée : la réserve et les soutiens restent disponibles pendant que les rôles changent de rive.');
// Three superposed charges: the Thief extracts one rear object at a time.
for(let i=0;i<3;i++){
 a.go(6,4-i,'thief').act('D'.repeat(2+i)).act('L');
 a.go(7,5,'warrior').act('LLLL').go(2,4).act('DDDDDDDD');
 a.go(3,13,'thief').act('RD');
 a.go(2,13,'warrior').act('R'.repeat(8-i));
 a.stage(`Charge ${i+1}/3 : extraction individuelle dans la colonne, transport par le sas, changement d’axe au sud et dépôt sur la plateforme ${3-i}. La clef orange doit encore rester en place.`);
}
a.act('RRRR').go(16,13).act('LLLL').stage('Pour changer de rive alors que les trois charges bouchent les plateformes, le Guerrier pousse la file entière jusque dans la cour, en fait le tour, puis la repousse exactement sur les trois soutiens.');
a.go(12,11,'warrior').act('U').act('D').stage('Le Guerrier charge la presse depuis le sud. Le gardien voisin empêche un chargement depuis sa propre ligne ; les deux monstres sont encore séparés.');
a.go(3,4,'thief').act('DD').go(2,5).act('L').go(2,6).act('DDD').act('R').stage('La clef orange est retirée : la presse décale la charge et le premier gardien. Les deux monstres devenus voisins s’éliminent dans la même vague. Le Voleur extrait ensuite la clef par le sas.');
a.go(3,8,'thief').act('RRRRRRDL').go(8,7).act('UL').stage('Le Voleur tire la clef vers l’est, contourne sa charge et change l’axe de traction pour l’installer sous le miroir. Il quitte le rayon pour ne pas masquer la première cible.');
a.select('wizard').act('L').stage('Deuxième usage du même miroir : le Magicien revient dans l’atelier en échangeant sa place avec la clef. La clef prend le relais sur le bouton cyan et garde le pont provisoire actif.');
a.go(7,4,'thief').act('L').go(2,8).stage('Le Voleur parque le miroir sur le bouton violet puis sort de la réserve. La liaison magique a fini ses deux missions ; la clef distante retient toujours le sas et les plateformes.');
a.go(15,3,'warrior').act('DDDDDDDD').act('R').stage('Le Guerrier libère la commande cyan et descend la clef sur le troisième bouton violet. Les trois charges deviennent des appuis fixes et la réserve vide se ferme.');
a.go(13,8,'warrior').act('DDDD').go(14,13).act('LLLLLLLLL').act('U').stage('La charge qui a servi à déplacer les gardiens est récupérée, changée d’axe et ramenée sur le pont permanent. Elle devient le lest violet de la rive de départ.');
a.go(18,18,'wizard').go(16,18,'warrior').go(14,18,'thief').stage('Les trois destinations exigent de libérer la prison après avoir substitué les ressources : miroir-lest, charge de combat-lest et clef de relais-lest.');
a.save(new URL('../level7-design.json',import.meta.url),{label:'Adaptation de Heroes of Hauling · énigme 20 ; Heroes and Water · Métamonde 4',url:'https://sinkingstarwalkthrough.com/fr/heroes-of-hauling-solutions/#%C3%A9nigme-20',puzzle:20,secondaryUrl:'https://sinkingstarwalkthrough.com/fr/heroes-and-water-solutions/',secondaryLabel:'Heroes and Water · Métamonde 4 et énigme 11',objective:'Libérer le bon rôle sans quitter le bouton, livrer trois charges, préparer une presse de combat, échanger la clef contre le gardien du soutien puis récupérer cette clef en lest.'},{kind:'adaptation',preserved:['Un prisonnier est remplacé sur sa commande avant de pouvoir travailler ailleurs.','Les charges libérées dans les alcôves deviennent des ressources pour une autre zone.','La substitution sur un bouton maintient les dispositifs pendant le changement de rôle.'],changed:['Le prisonnier initial est le Voleur ; deux échanges coudés utilisent le même miroir avant son rangement.','Une seule clef remplit successivement trois fonctions : retenue d’une presse, relève du bouton cyan, puis lest violet distant.','Trois charges superposées sont extraites une par une, transportées par un sas et converties en appuis permanents.','La charge de combat est récupérée après élimination simultanée de deux monstres et rapatriée comme lest.','Les règles d’appuis fixes persistants et de presses latérales appartiennent à SS17 ; carte entièrement nouvelle.'],sourceReading:'La progression recombine Hauling 20 (charges et libération d’alcôves), Water Métamonde 4 (relèves par échanges sur boutons) et Water 11 (les échanges ne suffisent pas au départ collectif). Le parcours demande plusieurs changements d’usage, sans revendiquer un ordre global unique ou un minimum.'});
