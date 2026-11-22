import {Author,board} from './author.mjs';
const b=board(20,20);
b.fill(1,1,18,18);
b.put(3,5,'#');b.put(4,6,'#');
b.fill(2,13,8,13,'~');b.fill(15,7,15,18,'~');
b.put(2,2,'Z');b.put(4,5,'B');
for(const [x,y] of [[6,2],[2,5],[4,7],[6,7],[4,12],[17,4],[14,11]])b.put(x,y,'o');
b.put(11,17,'m');b.put(14,17,'m');b.put(17,16,'g');b.put(18,16,'g');
const spec={id:'ss15-01',title:'L’atelier des passages croisés',rows:b.strings(),
 mirrors:[{at:{x:14,y:4},facing:'NE'}],
 circuits:[{id:'releve',buttons:[{x:4,y:5}],color:10},{id:'depot',buttons:[{x:12,y:10}],color:15}],
 gates:[{at:{x:9,y:5},circuit:'releve',direction:'E',closedWhen:'released'},{at:{x:14,y:11},circuit:'depot',direction:'E',closedWhen:'pressed'}]};
const a=new Author(spec);
a.act('R').stage('Le premier échange remplace la caisse par le Magicien');
a.go(4,3).act('D').stage('La transposition des héros conserve le poids de la commande');
a.act('U').stage('Le Barde retrouve sa commande sans chanter');
a.select('bard').act('R').stage('Le chant traverse la cloison, atteint son coin et laisse la pièce retenue en place');
a.select('wizard').act('D').stage('Le Magicien extrait le Barde sans emporter son cortège');
a.go(14,2).act('D').stage('Le rayon dévié échange le Magicien avec la caisse à droite du miroir');
a.act('X').stage('Le reflet transporte la caisse la plus proche sur l’autre axe');
a.go(18,4).stage('Le Magicien quitte la zone de réflexion');
a.go(6,11,'bard').act('LDR').stage('Une caisse devient un appui, puis le chant le fait glisser sur l’eau');
a.go(4,12,'wizard').act('D');
a.select('bard').act('U').stage('Le Magicien ancre l’appui pendant que le chant le ramène sur la rive');
a.go(12,9,'wizard').act('D').stage('La presse latérale dépose une caisse dans le bras d’eau oriental');
a.go(10,15,'bard').act('RR').stage('Le chant rapproche les deux monstres sans exposer les héros');
a.go(18,16,'wizard').stage('Le Magicien rejoint la première destination par le passage créé');
a.go(17,16,'bard').stage('Le Barde rejoint sa destination et laisse le Magicien reprendre sa place');
if(!a.state.complete)a.go(18,16,'wizard');
a.stage('Les deux destinations sont occupées simultanément');
a.save(new URL('../level1-design.json',import.meta.url),{
 label:'Atelier original · Magicien, Barde et passages croisés',url:'https://sinkingstarwalkthrough.com/fr/north/',
 secondaryLabel:'Zones mixtes · eau, miroirs et dépôts latéraux',secondaryUrl:'https://sinkingstarwalkthrough.com/fr/crossovers/',
 objective:'Explore les vingt découvertes, puis fais arriver les deux héros sur les contours jaunes.'
},{kind:'original-tutorial',preserved:['Le Magicien remplace une cible par échange ; le Barde transporte les ressources.','Les départs forcés évitent le chant et conservent les poids.'],changed:['Atelier ouvert composé pour les vingt découvertes publiques de SS15.','Chant carré, butées, appui mobile et presse issus du contrat de la série SS.'],sourceReading:'Les modules sont une composition pédagogique originale nourrie du monde Nord et des zones mixtes ; ils ne reproduisent aucune salle commerciale.',checkScope:'Le parcours démontre les découvertes ; les explorations et autres solutions restent libres.'});
