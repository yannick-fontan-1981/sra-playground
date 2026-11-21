import {Author,board} from './author.mjs';

// Mirrors 2 changes the side on which a cargo accompanies the Bard.
// Water 28 supplies the hand-off: the Warrior repositions the Bard without
// moving her cargo. The remaining machinery makes that hand-off persistent.
const b=board(20,19,'~');
b.fill(1,1,5,7); b.put(3,8); b.put(3,9,'1');
b.fill(4,9,12,16); b.put(12,13,'1');
b.fill(16,10,18,12); b.put(15,12);
b.put(2,5,'B'); b.put(1,2,'W'); b.put(3,6,'o');
b.put(10,10,'b'); b.put(16,10,'m'); b.put(18,10,'m');
b.put(16,11,'g'); b.put(18,12,'g');
const spec={id:'ss12-08',title:'La coda des deux reflets',rows:b.strings(),facing:'E',
 circuits:[{id:'coda',buttons:[{x:10,y:10}],color:15}],
 gates:[
  {at:{x:6,y:9},circuit:'coda',direction:'E',closedWhen:'pressed'},
  {at:{x:15,y:12},circuit:'coda',direction:'E',closedWhen:'released'},
 ]};
const a=new Author(spec);
a.act('X').stage('Le premier miroir transfère la caisse sur la rive centrale.');
a.go(3,8,'bard').act('X').stage('Le Barde traverse depuis un rayon plus court : la caisse se trouve maintenant à sa droite.');
a.act('DRRRR').stage('Le chant ramène la caisse sur la commande : le premier axe se ferme et l’arrivée finale s’ouvre.');
a.go(3,8,'warrior').act('X').stage('Le Guerrier rejoint le Barde ; le premier miroir reste utilisable à courte portée.');
a.go(12,14,'warrior').act('U').stage('Le Guerrier remonte le second miroir, dont l’arrivée précédente donnait dans l’eau.');
a.go(8,11,'warrior').act('U').stage('Le Guerrier fait monter le Barde sans déplacer sa caisse.');
a.go(7,9,'warrior').act('RRRR').stage('Le Barde est poussé sur le bon rayon, tandis que le poids maintient les deux portes.');
a.select('bard').act('XR').stage('Le dernier reflet dépose le Barde près des gardiens ; son chant rapproche un seul monstre et les deux s’éliminent.');
a.go(16,11,'bard');
a.go(12,9,'warrior').act('X').go(18,12);
a.save(new URL('../level8-design.json',import.meta.url),{
 label:'Synthèse adaptée de Heroes and Mirrors 2 et Heroes and Water 28',
 url:'https://sinkingstarwalkthrough.com/fr/heroes-and-mirrors-solutions/#%C3%A9nigme-2',puzzle:2,
 secondaryUrl:'https://sinkingstarwalkthrough.com/fr/heroes-and-water-solutions/#%C3%A9nigme-28',
 image:'https://sinkingstarwalkthrough.com/img/crossovers/heroes-and-mirrors/puzzle-02.webp',
 objective:'Faire traverser la caisse et les deux héros, maintenir sa commande pendant le replacement forcé du Barde, puis libérer la dernière île.'
},{kind:'two-source-mechanic-adaptation',
 preserved:['Heroes and Mirrors 2 : le reflet change le côté relatif du Barde et de sa caisse, puis il faut les réaligner.','Heroes and Water 28 : le Guerrier pousse le Barde pour éviter un déplacement parasite du cargo entraîné par le chant.','Deux héros et deux destinations demandent de finir la coopération avant de quitter la salle.'],
 changed:['Trois îles originales remplacent les géométries sources.','Le même poids ferme le premier axe de miroir et ouvre l’arrivée du dernier reflet.','Le deuxième miroir doit être poussé à la bonne hauteur par le Guerrier.','La paire de monstres finale impose un chant sélectif à distance sûre.','La sortie par appui de Water 28 est transposée à une commande de portes ; aucune mécanique de pile ni double déplacement n’est ajoutée.'],
 sourceReading:'Descriptions des énigmes Mirrors 2 et Water 28 consultées ; synthèse déclarée de leurs problèmes de position relative et de sortie sans chant, pas une reconstruction exacte.',
 authoredRoute:'Parcours manuel avec recherche de marches sans manipulation entre les postes.',
 resourceRoles:{cargo:'Change de rive, puis commande simultanément un obturateur et la porte d’arrivée.',firstMirror:'Fait passer la caisse puis les héros depuis des distances différentes.',shutter:'Coupe le premier rayon pour qu’il ne ramène pas le Guerrier lors du reflet final.',secondMirror:'Doit être décalé d’une case pour offrir une arrivée sûre sur l’île finale.',warrior:'Règle le second miroir et place le Barde sans retirer le poids de sa commande.',guards:'Bloquent les deux abords de la destination supérieure tant qu’ils restent vivants.'}});
