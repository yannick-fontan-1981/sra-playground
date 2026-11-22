import {Author,board} from './author.mjs';
const b=board(20,20);
b.fill(1,1,7,7);b.fill(8,5,8,7);b.fill(8,8,8,10,'~');b.fill(6,11,16,16);
b.put(4,3,'#');b.put(6,3,'#');b.put(5,2,'#');
b.put(17,14,'~');b.put(17,15);b.fill(18,12,18,18);
b.put(1,6,'W');b.put(2,2,'T');b.put(3,5,'Z');
b.put(2,1,'o');b.put(7,1,'o');b.put(5,3,'o');b.put(14,13,'o');
b.put(8,5,'3');b.put(8,13,'1');b.put(16,14,'m');
b.put(18,12,'g');b.put(18,15,'g');b.put(18,18,'g');
const spec={id:'ss17-06',title:'Les deux emplois des miroirs',rows:b.strings(),circuits:[
 {id:'retenue',buttons:[{x:5,y:3}],color:10},
 {id:'trois-lests',buttons:[{x:6,y:5},{x:12,y:13},{x:15,y:15}],color:15}
],gates:[
 {at:{x:16,y:14},circuit:'retenue',direction:'E',closedWhen:'released'},
 {at:{x:17,y:15},circuit:'trois-lests',direction:'E',closedWhen:'released'},
 {at:{x:18,y:14},circuit:'retenue',direction:'S',closedWhen:'pressed'}
],platforms:[8,9,10].map(y=>({at:{x:8,y},circuit:'retenue',activeWhen:'pressed'}))};
const a=new Author(spec);
a.select('wizard').act('R').go(14,14).stage('Un seul rayon traverse les deux miroirs : le Magicien rejoint la cour inférieure et la charge lointaine arrive sur le bras du premier miroir. Un échange transporte une ressource sans créer un passage collectif.');
a.act('X').stage('La première réflexion place la charge sur le soutien le plus éloigné. Le Magicien a quitté le second bras pour éviter une projection simultanée.');
a.select('thief').act('DDDD').act('R');a.go(1,5,'warrior').act('RRD').act('X').stage('La deuxième charge est extraite puis réglée à quatre cases du miroir : la réflexion l’envoie sur la plateforme centrale.');
a.go(7,2,'thief').act('DDDD').act('L').go(6,5).act('LLD');a.act('X').stage('Le Voleur règle la troisième charge à trois cases du miroir. Les trois plateformes portent désormais des pierres mobiles, pas encore un pont permanent.');
a.go(5,4,'thief').act('DD').act('R').stage('Le Voleur retire la clef hydraulique : trois appuis deviennent fixes et la même libération expulse le gardien latéralement dans l’eau.');
a.go(7,13,'warrior').act('RRRR').go(10,12).stage('Le Guerrier traverse le pont et déplace le miroir de relais de quatre cases. Il devient le premier lest éloigné ; la visée à deux coudes n’existe plus.');
a.go(14,12,'wizard');
a.go(5,4,'warrior').act('DD').go(4,7).act('RRR').go(8,6).act('DDDDDDD').go(7,14).act('RRRRRRR').go(15,13).act('D').act('L').stage('La clef retirée change plusieurs fois d’axe, traverse les trois appuis et devient le deuxième lest éloigné. Le témoin réserve cette charge au troisième lest, après les transports optiques.');
a.go(7,5,'thief').act('LL').act('D').stage('Le premier miroir est tiré sur son bouton violet. Les deux miroirs qui ont transporté les charges deviennent des poids immobiles, avec l’ancienne clef comme troisième poids.');
a.go(18,12,'wizard').go(18,18,'warrior').go(16,15,'thief').act('R').stage('Le Magicien et le Guerrier franchissent le sas sous trois poids. Dernier à sortir, le Voleur tire la clef derrière lui : la presse libérée le projette sur la destination centrale, sans traction supplémentaire.');
a.save(new URL('../level6-design.json',import.meta.url),{label:'Adaptation de Heroes and Mirrors · énigme 32',url:'https://sinkingstarwalkthrough.com/fr/heroes-and-mirrors-solutions/#%C3%A9nigme-32',puzzle:32,objective:'Exploiter une visée à deux miroirs puis trois distances de réflexion, retirer les plateformes et transformer les miroirs ainsi que la clef en trois lests.'},{kind:'adaptation',preserved:['Un miroir déplacé ou garé trop tôt condamne une visée ou un accès encore utile.','Le dernier rôle du miroir dépend de l’achèvement des transports précédents.'],changed:['Deux miroirs relaient une magie d’échange puis trois réflexions géométriques établissent un pont à trois cases.','La clef hydraulique déclenche aussi une expulsion latérale du gardien.','Les deux miroirs et la clef deviennent les trois poids d’une même commande ET.',
 'Un verrou de retenue devant la destination haute exige de libérer la commande hydraulique : garder les plateformes actives et remplacer les miroirs par des caisses ne suffit plus à terminer.','Les miroirs ne sont ni échangeables par le Magicien ni duplicables : le Guerrier et le Voleur assurent leur repositionnement.','Carte et coordonnées originales, sans reproduction du plan commercial.'],sourceReading:'Le motif de Mirrors 32 — préserver les accès et le dernier échange avant de ranger le miroir — est recomposé autour de trois distances, d’un rayon à deux relais et d’une réutilisation matérielle des miroirs. Water 11 complète le raisonnement sur le passage collectif ; le témoin ne prétend pas être optimal ou unique.'});
