import {Author,board} from './author.mjs';

// Heroes and Light #1: the pointed doors move a weight in a direction
// unavailable to the hero standing in the access corridor.
const b=board(19,17,'#');
b.fill(1,10,7,15); b.fill(6,6,6,9); b.put(7,6,'~');
b.put(5,9,'.'); b.put(6,9,'4'); b.put(7,9,'.');
b.put(6,6,'o'); b.put(2,13,'W'); b.put(6,13,'B'); b.put(3,12,'b');
b.fill(8,3,10,8); b.fill(8,8,13,8); b.put(13,8,'o'); b.put(13,9,'~');
b.put(9,4,'b'); b.put(8,4,'b'); b.put(9,3,'#'); b.put(10,4,'#');
b.fill(11,10,17,15); b.put(14,14,'m'); b.put(16,14,'m');
b.put(11,15,'g'); b.put(16,14,'m'); b.put(17,14,'g');
const spec={id:'ss12-06',title:'Les deux écluses de pierre',rows:b.strings(),facing:'N',
 circuits:[{id:'cyan',buttons:[{x:3,y:12}],color:10},{id:'violet',buttons:[{x:9,y:4},{x:8,y:4}],color:15}],
 gates:[{at:{x:6,y:6},circuit:'cyan',direction:'E',closedWhen:'pressed'},{at:{x:13,y:8},circuit:'violet',direction:'S',closedWhen:'pressed'}]};
const a=new Author(spec);
a.act('URD');
a.stage('La première presse envoie sa caisse à droite et l’on relâche le bouton pour emprunter son emplacement.');
a.go(5,9).act('R');
a.go(9,4);
a.select('bard').go(8,5).act('U');
a.stage('Les deux héros maintiennent ensemble les boutons violets et la seconde presse crée l’appui inférieur.');
a.select('warrior').act('D').go(11,15);
a.select('bard').go(13,10).act('LLDDRR');
a.stage('Le Barde rapproche le gardien gauche de celui de droite ; les deux frappent simultanément.');
a.go(17,14);
a.select('warrior').go(11,15);
a.save(new URL('../level6-design.json',import.meta.url),{
 label:'Adaptation de Heroes and Light · énigme 1',
 url:'https://sinkingstarwalkthrough.com/fr/heroes-and-light-solutions/#%C3%A9nigme-1',puzzle:1,
 image:'https://sinkingstarwalkthrough.com/img/crossovers/heroes-and-light/puzzle-01.webp',
 objective:'Utiliser deux presses orientées différemment, puis se servir du chant à portée sélective pour déplacer un seul des deux gardiens.'
},{kind:'mechanic-adaptation',preserved:['Les portes orientées poussent un poids à travers un côté inaccessible.','Activation puis libération d’une presse pour pouvoir emprunter la case qu’elle occupait.','Le dernier obstacle est un groupe de monstres à faire se rencontrer.'],changed:['Deux îlots et deux traversées créées par les caisses dans l’eau.','Le Voleur de la source est remplacé par le duo Guerrier–Barde.','Deux boutons conjoints imposent une coordination avant la deuxième presse.','Un miroir bloque l’accès de l’écluse : seul le Guerrier peut le ranger dans son alcôve latérale.'],sourceReading:'Adaptation des étapes et contraintes décrites dans le guide, sans reproduction exacte de la capture.',authoredRoute:'Parcours manuel, avec recherche limitée aux déplacements libres entre postes.',resourceRoles:{firstCrate:'Seul appui de la traversée vers la salle des deux boutons.',secondCrate:'Seul appui vers la cour des gardiens.',mirror:'Bloque le corridor ; le chant ne le déplace pas et le Guerrier doit le pousser de côté.',dualButtons:'Exigent la présence simultanée des deux héros.',guards:'Interdisent les abords de la destination droite avant leur déplacement ou leur élimination.'}});
