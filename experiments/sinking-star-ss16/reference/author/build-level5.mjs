import {Author,board} from './author.mjs';
const b=board(20,20);
// Western workshop, guarded reserve, two-cell water crossing and isolated exits.
b.fill(1,1,8,16);b.put(7,4,'#');
b.fill(9,3,11,4);b.fill(9,5,9,13);b.fill(12,1,18,5);b.put(12,3,'#');
b.fill(11,10,18,15);b.put(9,12,'~');b.put(10,12,'~');
b.put(13,16);b.put(13,17);b.fill(12,18,18,18);
b.put(2,3,'M');b.put(8,6,'W');b.put(5,2,'T');
b.put(8,5,'o');b.put(5,1,'o');b.put(14,1,'o');b.put(16,1,'o');
b.put(9,4,'m');b.put(11,4,'m');
b.put(14,18,'g');b.put(16,18,'g');b.put(18,18,'g');
const spec={id:'ss16-05',title:'La relève du gardien',rows:b.strings(),circuits:[
 {id:'impulsion',buttons:[{x:2,y:3}],color:12},
 {id:'passerelles',buttons:[{x:9,y:4}],color:10},
 {id:'reserve',buttons:[{x:5,y:4}],color:14},
 {id:'deux-poids',buttons:[{x:5,y:14},{x:15,y:12}],color:15}
],gates:[
 {at:{x:8,y:4},circuit:'impulsion',direction:'E',closedWhen:'released'},
 {at:{x:12,y:4},circuit:'reserve',direction:'E',closedWhen:'released'},
 {at:{x:13,y:16},circuit:'passerelles',direction:'N',closedWhen:'pressed'},
 {at:{x:13,y:17},circuit:'deux-poids',direction:'N',closedWhen:'released'}
],platforms:[9,10].map(x=>({at:{x,y:12},circuit:'passerelles',activeWhen:'pressed'}))};
const a=new Author(spec);
a.select('thief').act('DDD').act('R').stage('Le Voleur extrait la clef contre le mur nord et la laisse sur la commande verte : la réserve reste ouverte sans retenir un héros.');
a.select('warrior').act('U').act('L').stage('Le Guerrier charge la presse par le sud. Le mur à l’ouest interdit de remplacer cette impulsion par une simple poussée horizontale de cette charge.');
a.select('merchant').act('L').stage('Le Marchand libère la commande orange : la charge remplace le gardien et la translation rapproche les deux monstres, qui s’éliminent.');
a.go(9,5,'thief').act('DD').act('L').act('U').act('LL').act('D').stage('Le Voleur récupère la charge de relève et la gare dans l’atelier : le corridor se libère et les plateformes se retirent. Cette caisse sera le lest distant.');
a.go(14,2,'thief').act('DDD').act('R').go(16,2).act('DDD').act('R').go(8,5).stage('Deux charges coincées contre le mur sont extraites, alignées dans la réserve, puis le Voleur regagne le côté de réception. La clef doit encore rester en place.');
a.go(17,4,'warrior').act('LLLLLL').stage('Le Guerrier rassemble les deux charges en file et les livre au coude gardé : il reste à changer leur axe, une charge après l’autre.');
a.go(9,5,'thief').act('DDDDDD').act('L').stage('Le Voleur tire la première charge jusqu’au bord de l’eau puis la lâche latéralement : il ne peut pas poursuivre sa traction sur l’eau sans appui.');
a.go(9,9,'warrior').act('DD').stage('Le Guerrier reprend la charge depuis sa face nord et la transforme en premier appui permanent.');
a.go(11,4,'warrior').act('L');
a.go(9,5,'thief').act('DDDDDD').act('L');
a.go(9,9,'warrior').act('DD').go(8,12).act('R').stage('La seconde charge passe par le même coude, reste mobile sur le premier appui, puis est poussée de côté dans la seconde case d’eau. Le pont permanent est complet.');
a.go(7,5,'warrior').act('DDDDDD').stage('La charge de relève, conservée mobile depuis le combat, est descendue au niveau du pont.');
a.go(6,12,'merchant').act('RRRRRRRR').act('U').stage('Le Marchand transporte la charge de relève sur les deux appuis puis la laisse sur le lest violet de la rive opposée.');
a.go(5,5,'thief').act('DDDDDDDDDD').act('R').stage('La réserve vidée, le Voleur récupère enfin sa clef et la transforme en second lest violet. La réserve se referme ; le sas final exige aussi le retrait des plateformes.');
a.go(18,18,'merchant').go(16,18,'warrior').go(14,18,'thief').stage('Les trois héros traversent le pont permanent et le sas : deux poids restent à distance et l’ancien poste du gardien demeure libéré.');
a.save(new URL('../level5-design.json',import.meta.url),{label:'Adaptation de Heroes and Light · énigme 4 · remplacement des gardiens et presses',url:'https://sinkingstarwalkthrough.com/fr/heroes-and-light-solutions/#%C3%A9nigme-4',puzzle:4,objective:'Préparer la charge de relève, extraire une réserve sous clef, convertir deux charges en pont permanent et réutiliser la charge de relève ainsi que la clef comme lests finaux.'},{kind:'adaptation',preserved:['Une ressource remplace l’occupant d’une commande pendant la translation latérale.','Des poids durables doivent prendre le relais des héros avant le départ collectif.'],changed:['La charge de relève n’est plus préchargée : elle rejoint la presse par le sud, avant le combat simultané des deux monstres.','Dans le parcours de référence, les quatre caisses finissent en deux appuis permanents et deux lests distants. La charge de relève et la clef de réserve sont récupérées après leur premier usage.','La réserve livre deux caisses extraites par le Voleur, regroupées par le Guerrier, puis transférées perpendiculairement au coude de réception.','Le sas final combine deux lests et la libération de l’ancien poste du gardien : les plateformes temporaires doivent être retirées.','Les dragons, pouvoirs lumineux et carte exacte du guide sont remplacés par le trio SS16, des plateformes et des portes-presses distinctes de leurs boutons.'],sourceReading:'Composition originale à partir du principe de relève des boutons de Light 4. La révision renforce les dépendances entre clef, réserve, pont et lests ; elle ne revendique ni unicité de route ni nécessité globale d’un ordre entièrement figé.'});
