import {Author,board} from './author.mjs';
const b=board(20,20);
// Disconnected optical control: neither Wizard nor Bard can reach its weight.
b.put(2,2,'o');b.fill(2,3,2,5,'~');b.put(2,6);b.fill(3,6,5,6,'~');b.put(6,6);
b.fill(8,2,12,17);b.fill(14,2,18,8);b.fill(14,11,18,17);
b.put(13,4);b.put(13,14);
b.put(16,3,'o');for(const [x,y] of [[15,3],[17,3],[16,2],[17,4],[17,5],[16,6]])b.put(x,y,'#');
b.put(14,16,'o');b.put(8,14,'W');b.put(8,8,'B');b.put(18,12,'Z');
b.put(9,17,'g');b.put(17,7,'g');b.put(16,16,'g');
// The upper goal has a single neck and the western goal a separate landing.
b.put(18,7,'#');b.put(17,8,'#');
b.put(10,5,'#');b.put(8,17,'#');b.put(10,17,'#');
const spec={id:'ss19-03',title:'L’interrupteur hors d’atteinte',rows:b.strings(),
 mirrors:[{at:{x:2,y:6},facing:'NE'}],
 circuits:[{id:'alternance',buttons:[{x:6,y:6}],color:15},{id:'charges',buttons:[{x:10,y:4},{x:8,y:11}],color:12}],
 gates:[
  {at:{x:13,y:4},circuit:'alternance',direction:'W',closedWhen:'released'},
  {at:{x:13,y:14},circuit:'alternance',direction:'E',closedWhen:'pressed'},
  {at:{x:9,y:17},circuit:'alternance',direction:'N',closedWhen:'released'},
  {at:{x:9,y:16},circuit:'charges',direction:'N',closedWhen:'released'},
  {at:{x:17,y:7},circuit:'charges',direction:'N',closedWhen:'released'}]
};
const a=new Author(spec);
a.go(14,17,'warrior').act('UU').stage('La caisse de la chambre basse monte jusqu’au sas ouvert.');
a.go(15,14).act('LLLLLL').stage('La première réserve traverse le sas avant son inversion.');
a.go(8,15).act('UUU').stage('Le premier lest occupe la commande basse.');
a.go(12,14,'wizard');
a.select('warrior').act('X').stage('Le poids isolé change de bras : le sas inférieur ferme, le supérieur ouvre.');
a.go(15,8,'warrior');
a.go(16,4,'bard').act('DLL').stage('Le chant sort la seconde caisse de son cul-de-sac sans position de poussée arrière.');
a.go(12,4,'wizard').act('RD').stage('Le Magicien extrait la Barde de son poste sans reprendre la caisse avec le chant.');
a.go(15,4,'warrior').act('LLL').stage('La caisse supérieure franchit le sas puis remplace tout gardien sur la commande haute.');
a.go(17,7,'wizard');
a.go(8,5,'warrior');
a.go(12,7,'bard');
a.select('warrior');
a.act('X').stage('Le sas bas rouvre pour faire entrer la Barde dans la dernière chambre.');
a.go(16,16,'bard');
a.select('warrior').act('X').stage('La dernière inversion ouvre la destination occidentale sans déplacer les deux lests.');
a.go(9,17).stage('Les trois sorties séparées restent occupées ensemble.');
a.save(new URL('../level3-design.json',import.meta.url),{
 label:'Adaptation · Heroes and Mirrors · énigme 16',url:'https://sinkingstarwalkthrough.com/fr/heroes-and-mirrors-solutions/#%C3%A9nigme-16',puzzle:16,
 secondaryUrl:'https://sinkingstarwalkthrough.com/fr/heroes-3-bard-druid-solutions/#%C3%A9nigme-19',secondaryLabel:'Heroes 3 · extraction d’un cristal par le chant',
 objective:'Extraire les deux réserves par des sas alternés et piloter à distance la configuration finale des trois sorties.'
},{kind:'adaptation',preserved:['Un cristal change de côté par reflet et commande une plaque inaccessible.','Le même interrupteur ouvre un passage et ferme l’autre.'],changed:['Trois pièces de jeu distinctes et trois destinations séparées remplacent le parcours du guide.','Une réserve sèche est coincée dans un cul-de-sac : la Barde doit la sortir avant que le Guerrier la transfère.','La machine optique est isolée de toutes les lignes de visée des héros ; le reflet global reste sa commande.','Cette salle sans monstre alterne la réflexion et la logistique après l’introduction de la chasse.'],sourceReading:'Mirrors 16 fournit le poids télécommandé par reflet. Le plan, les deux sas et le partage des réserves sont originaux ; le nombre de reflets du témoin n’est pas un minimum démontré.'});
