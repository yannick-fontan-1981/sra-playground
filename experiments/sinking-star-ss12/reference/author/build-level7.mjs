import {Author,board} from './author.mjs';

// Heroes and Water 27: the walls stop the immersed cargo while the Bard
// changes her offset. Four bends prevent a straight-line shortcut.
const b=board(20,20);
b.fill(1,1,11,18);
b.fill(4,8,4,13,'~'); b.put(4,14,'o');
b.fill(4,8,8,8,'~'); b.fill(8,4,8,8,'~');
b.fill(8,4,12,4,'~'); b.fill(12,4,12,9,'~');
b.fill(13,9,18,15);
b.fill(14,2,18,5); b.fill(16,6,16,8,'~');
b.put(2,14,'B'); b.put(2,2,'W');
b.put(14,12,'2'); b.put(16,12,'b');
b.put(15,3,'g'); b.put(17,3,'g');
const spec={id:'ss12-07',title:'Le canal aux quatre coudes',rows:b.strings(),facing:'N',
 circuits:[{id:'quai',buttons:[{x:16,y:12}],color:10}],
 platforms:[6,7,8].map(y=>({at:{x:16,y},circuit:'quai',activeWhen:'pressed'}))};
const a=new Author(spec);
a.select('bard').act('UUUUUU').stage('La caisse coule puis remonte le canal jusqu’au premier coude.');
a.act('UURRRR').stage('Le Barde avance au nord pendant que la rive arrête l’appui ; cet écart permet le virage vers la droite.');
a.act('UUUURRRR').stage('Le Barde remonte le deuxième bras, puis guide l’appui vers le débouché du dernier canal vertical.');
a.go(10,6,'bard').act('DDDDD').stage('Une boucle hors de portée et les butées permettent de passer sous le canal sans bouger l’appui, puis de le faire descendre au débouché.');
a.go(12,9,'warrior').stage('Le Guerrier prend pied sur l’appui pour l’ancrer avant le retour du Barde.');
a.go(11,9,'bard').act('RR').stage('Le Barde passe sur l’appui ancré et entraîne son partenaire vers la rive droite.');
a.go(13,12,'warrior').act('RR').stage('Le Guerrier pousse le miroir sur la commande de la passerelle ; le chant laisse ce poids en place.');
a.go(15,3,'warrior');
a.go(17,3,'bard');
a.select('warrior').go(15,3);
a.save(new URL('../level7-design.json',import.meta.url),{
 label:'Adaptation de Heroes and Water · énigme 27',
 url:'https://sinkingstarwalkthrough.com/fr/heroes-and-water-solutions/#%C3%A9nigme-27',puzzle:27,
 image:'https://sinkingstarwalkthrough.com/img/crossovers/heroes-and-water/puzzle-27.webp',
 objective:'Guider le même appui autour des quatre coudes, l’ancrer avec le partenaire puis maintenir la passerelle grâce au miroir.'
},{kind:'mechanic-and-topology-adaptation',
 preserved:['Un cristal immergé traverse un labyrinthe par le chant du Barde.','Les butées arrêtent le cargo pendant que le héros corrige leur écart.','Le joueur change de côté avant chaque changement d’axe.'],
 changed:['Canal redessiné avec quatre coudes, deux héros et deux destinations.','Le Guerrier ancre temporairement l’appui pour le passage du Barde.','Une passerelle hydraulique finale impose de pousser un miroir comme poids durable.'],
 sourceReading:'Guide de l’énigme 27 consulté ; adaptation de sa progression spatiale et de ses butées, sans reproduction cellule par cellule ni déplacement de pile à deux cases.',
 authoredRoute:'Parcours manuel du canal ; recherche limitée aux marches sans manipulation entre postes.',
 resourceRoles:{canalCrate:'Unique appui pouvant relier la rive de départ au quai de droite.',bends:'Empêchent une translation rectiligne et exigent le changement de côté du Barde.',warrior:'Ancre l’appui puis pousse le miroir que le chant ne peut pas déplacer.',mirror:'Poids durable du circuit hydraulique, insensible au chant.',hydraulicBridge:'Seul accès pédestre vers l’île des deux destinations.'}});
