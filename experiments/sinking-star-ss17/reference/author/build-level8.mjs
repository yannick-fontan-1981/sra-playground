import {Author,board} from './author.mjs';
const b=board(20,20);
b.fill(1,1,11,7);b.put(2,5,'~');b.fill(8,8,8,10,'~');b.fill(10,8,10,10,'~');
b.fill(6,11,15,15);b.fill(16,11,17,13);b.put(16,15,'~');b.put(17,14,'~');b.put(17,15);
b.fill(14,16,14,18);b.fill(11,18,18,18);
b.put(2,3,'W');b.put(8,2,'T');b.put(3,5,'Z');b.put(8,1,'3');b.put(8,13,'1');
b.put(4,1,'o');b.put(5,1,'o');b.put(12,12,'o');b.put(14,12,'o');b.put(17,15,'o');b.put(15,13,'m');
b.put(12,18,'g');b.put(15,18,'g');b.put(18,18,'g');
const spec={id:'ss17-08',title:'La forteresse aux deux visées',rows:b.strings(),circuits:[
 {id:'reception',buttons:[{x:2,y:3}],color:12},
 {id:'deux-miroirs',buttons:[{x:6,y:5},{x:12,y:15}],color:15},
 {id:'clef',buttons:[{x:4,y:4}],color:14},
 {id:'prison-clef',buttons:[{x:17,y:15}],color:10}
],gates:[
 {at:{x:3,y:5},circuit:'reception',direction:'W',closedWhen:'released'},
 {at:{x:14,y:16},circuit:'deux-miroirs',direction:'N',closedWhen:'released'},
 {at:{x:14,y:17},circuit:'clef',direction:'N',closedWhen:'released'},
 {at:{x:14,y:18},circuit:'prison-clef',direction:'N',closedWhen:'pressed'}
]};
const a=new Author(spec);
a.select('thief').act('DDDD').act('R').stage('Le Voleur descend le miroir enfermé contre le mur et le place à la première station. La visée à deux miroirs du témoin n’est pas encore alignée.');
a.select('wizard').act('R').go(15,12).stage('Le Magicien échange sa place avec le gardien à travers les deux miroirs. Le monstre arrive dans la cellule de réception ; le Magicien quitte le bras inférieur avant la prochaine réflexion globale.');
a.select('warrior').act('L').stage('Le Guerrier libère la commande orange. La presse expulse le gardien vers l’ouest, dans la seule case d’eau de l’atelier.');
a.go(4,2,'thief').act('DDDD').act('R').act('X').stage('La première charge, extraite au nord, est réfléchie à quatre cases : elle devient l’appui du milieu. Les deux miroirs sont concernés par la même action globale.');
a.go(5,2,'thief').act('DDDD').act('L').act('X').stage('La seconde charge est réglée à trois cases du premier miroir : elle devient l’appui proche. Les appuis immergés ne sont plus des cibles optiques.');
a.go(5,5,'warrior');a.go(15,13,'wizard').act('L').stage('Le Magicien reprend la visée inverse pour échanger les rôles : le Guerrier rejoint la salle inférieure et le Magicien prend sa place sur le bras du premier miroir.');
a.go(13,12,'warrior').act('L').go(11,11).act('DR').act('X').stage('Le Guerrier règle la charge du sud à trois cases du second miroir. Une seule réflexion globale achève le pont au sud et transporte simultanément le Magicien sur le premier appui.');
a.go(7,6,'wizard');
a.go(9,5,'thief').act('RRD').stage('Le Voleur décale le miroir supérieur de deux cases. La première liaison est rompue : le nouveau rayon doit emprunter l’autre colonne d’eau.');
a.go(7,13,'warrior').act('RR').go(10,12).act('DD').go(13,12).stage('Le Guerrier déplace le miroir inférieur vers l’est puis vers le sud, et sort de son bras nord. Les deux miroirs sont maintenant accordés sur une seconde visée.');
a.act('RRR').go(17,11).act('DD').act('L').stage('La dernière charge libre est changée d’axe puis sacrifiée dans l’eau au nord de l’alcôve. Cet appui de secours doit exister avant de téléporter un héros dans la prison de la clef.');
a.go(4,5,'wizard').act('R').act('UU').act('L').stage('Le Magicien suit la nouvelle visée à deux coudes et échange sa place avec la clef isolée. Il ressort par l’appui préparé, sans renvoyer la clef dans sa prison.');
a.go(4,4,'thief').act('U').act('L').stage('Le Voleur extrait la clef de la ligne de visée et la pose sur sa commande verte. La clef ouvre le second sas sans retenir un héros.');
a.go(9,15,'warrior').act('RR').act('U').stage('Le miroir inférieur est poussé une seconde fois : après deux stations de visée et une projection de charge, il devient le lest violet de la cour.');
a.go(9,5,'thief').act('LLLL').act('D').stage('Le miroir supérieur est récupéré vers l’ouest et garé sur le second bouton violet. La commande ET n’ouvre le premier sas qu’une fois les deux instruments devenus des poids.');
a.go(18,18,'wizard').go(12,18,'thief').go(15,18,'warrior').stage('Le trio franchit les trois sas : les deux miroirs sont lestés, la clef verte est posée et son ancienne prison est vide. Les trois charges de pont, l’appui de la prison, les deux miroirs et la clef ont chacun trouvé leur dernier usage.');
a.save(new URL('../level8-design.json',import.meta.url),{label:'Adaptation de Heroes and Mirrors · énigmes 31–32 ; Heroes of Hauling · énigme 19',url:'https://sinkingstarwalkthrough.com/fr/heroes-and-mirrors-solutions/#%C3%A9nigme-31',puzzle:'31–32',secondaryUrl:'https://sinkingstarwalkthrough.com/fr/heroes-of-hauling-solutions/#%C3%A9nigme-19',secondaryLabel:'Heroes of Hauling · énigme 19 · libérer un captif par substitution',objective:'Préparer une réception de monstre, régler les distances de trois projections, échanger les rôles, reconstruire une visée à deux miroirs et libérer la clef isolée avant de ranger les miroirs sur leurs poids finaux.'},{kind:'adaptation',preserved:['Le déplacement du miroir modifie les accès et les diagonales disponibles.','Il faut terminer la dernière opération optique avant de garer les miroirs.','Un prisonnier échangé exige un accès de secours ou une ressource de remplacement.','Les échanges seuls ne constituent pas un passage collectif.'],changed:['Deux stations successives coordonnent deux miroirs mobiles ; le deuxième rayon suit une autre colonne d’eau.','Une réflexion globale transporte simultanément un héros et la troisième charge, sans réactiver la capacité du héros déplacé.','Le gardien est échangé vers une presse latérale puis noyé.','La clef est isolée sur une petite île : le quatrième bloc est réservé à son appui de secours.','Les deux miroirs et la clef deviennent les trois poids de deux sas. Un troisième sas reste fermé tant que la prison cyan est occupée : il faut aussi faire ressortir le héros qui remplace la clef.',
 'Cette commande de prison empêche de terminer en ignorant la clef isolée ; elle n’impose pas une solution unique. Coordonnées et disposition originales.'],sourceReading:'Composition originale des idées de Mirrors 31–32 (déplacer les miroirs sans perdre le dernier accès), Hauling 19 (substituer un occupant prisonnier) et Water 11 (raisonner sur les rives). Le témoin met en scène ces dépendances ; il ne revendique ni unicité de solution ni nécessité globale de chacun de ses trajets.'});
