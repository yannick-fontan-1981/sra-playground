import { Author, board } from './author.mjs';

// Heroes and Mirrors #1: leave the weight behind by reflecting the Bard.
// The second island adds a wall-locked cargo which only the song can extract.
const b=board(19,15,'~');
b.fill(1,1,5,5); b.fill(1,5,2,7); b.put(1,7,'W');
b.put(2,3,'B'); b.put(2,4,'o'); b.put(3,3,'b');
b.put(9,2,'3');
b.fill(8,8,15,11); b.put(14,12,'o');
b.put(13,12,'#'); b.put(15,12,'#'); b.put(14,13,'#');
b.put(13,10,'#'); b.put(15,10,'#');
b.fill(12,7,17,7,'#'); b.put(14,7,'~');
b.fill(13,3,17,6); b.put(14,4,'g'); b.put(16,4,'g');
const spec={id:'ss12-05',title:'Le poids reste, le chant s’en va',rows:b.strings(),facing:'N',
 circuits:[{id:'rose',buttons:[{x:3,y:3}],color:7}],
 gates:[{at:{x:9,y:8},circuit:'rose',direction:'S',closedWhen:'released'}]};
const a=new Author(spec);
a.select('bard').act('URX');
a.stage('Le Barde est réfléchi sur la seconde île ; la caisse reste sur le bouton de départ.');
a.act('R');
a.select('warrior').go(3,2).act('X');
a.stage('Le Guerrier emprunte le miroir sans retirer le poids qui maintient son arrivée ouverte.');
a.select('bard').go(14,10).act('UU LLL');
a.stage('Le chant extrait la caisse de son cul-de-sac ; les murs du puits la retiennent pendant le départ du Barde.');
a.select('warrior').go(14,11).act('UUUUUU').go(16,4);
a.stage('Le Guerrier pousse la caisse dans le détroit et traverse sur l’appui.');
a.select('bard').go(14,4);
a.select('warrior').go(16,4);
a.save(new URL('../level5-design.json',import.meta.url),{
 label:'Adaptation de Heroes and Mirrors · énigme 1',
 url:'https://sinkingstarwalkthrough.com/fr/heroes-and-mirrors-solutions/#%C3%A9nigme-1',puzzle:1,
 image:'https://sinkingstarwalkthrough.com/img/crossovers/heroes-and-mirrors/puzzle-01.webp',
 objective:'Maintenir le bouton après avoir téléporté le Barde hors de portée de sa caisse, puis extraire un second poids pour bâtir la traversée finale.'
},{kind:'mechanic-and-topology-adaptation',preserved:['Barde, caisse sur bouton, arrivée verrouillée et reflet utilisé pour rompre le chant.','Séparation entre le poids immobilisé et le héros qui rejoint la sortie.'],changed:['Deux îles séparées et deux destinations pour le duo Guerrier–Barde.','Ajout d’un puits de caisse à extraire au chant et d’un détroit comblé par la poussée du Guerrier.'],sourceReading:'Le guide a été lu ; adaptation des contraintes décrites, sans prétention de reproduction cellule par cellule.',authoredRoute:'Parcours manuel avec déplacements sans manipulation calculés localement.',resourceRoles:{departureCrate:'Maintient ouverte la case d’arrivée du miroir.',fixedMirror:'Seul lien entre les deux îles.',shaftCrate:'Seul appui disponible pour rejoindre les deux destinations.',shaftWalls:'Empêchent une poussée vers le haut depuis le fond et permettent au Barde de quitter la caisse.'}});
