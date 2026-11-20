import {Author,board} from './author.mjs';

// Original layout: a two-stage extraction inspired by Heroes and Mirrors 30.
// Water separates the left console, the workshop and the northern crystal.
const b=board(20,16,'~');
b.fill(2,3,4,5);                         // Left console: deliberately no access to row 2.
b.fill(3,10,7,13);b.fill(8,7,12,13);     // Workshop and reflection runway.
b.fill(11,6,12,6);                      // Reach the back of the extracted crate.
b.fill(13,9,15,9);b.fill(15,7,15,8);     // The Warrior must raise the northern mirror.
b.put(15,2,'o');                        // Only a bent Wizard ray can reach this crate safely.
b.put(12,10,'o');                       // Reserve for the single water gap to the exit.
b.fill(14,13,18,13);b.fill(16,12,18,14);
b.put(17,12,'g');b.put(18,14,'g');
b.put(8,11,'W');b.put(9,11,'Z');
const spec={
  id:'ss11-07',title:'Le cristal derrière deux rives',rows:b.strings(),facing:'E',
  mirrors:[{at:{x:3,y:12},facing:'NE'},{at:{x:15,y:8},facing:'NW'}],
  circuits:[{id:'console',buttons:[{x:3,y:3}],color:14}],
  gates:[{at:{x:14,y:13},circuit:'console',direction:'E',closedWhen:'released'}],
};
const a=new Author(spec);
a.go(15,9,'warrior').act('U').stage('Le Guerrier aligne le miroir sur le rayon du Magicien.');
a.go(11,6,'warrior');
a.go(11,7,'wizard').act('R').stage('Un rayon coudé extrait la caisse de son îlot isolé.');
a.select('warrior').act('D').go(10,8).stage('La caisse et le Guerrier quittent la ligne du reflet de retour.');
a.select('wizard').act('X').stage('Le Magicien revient dans l’atelier par le reflet.');
a.go(12,12,'wizard').act('X').stage('Le second miroir envoie le Magicien sur la console gauche.');
a.go(11,7,'warrior').act('DDDD').stage('Le Guerrier amène la caisse sur le second rayon.');
a.select('wizard').act('D').stage('La caisse remplace le Magicien sur le bouton et maintient la porte ouverte.');
a.go(12,9,'warrior').act('DDD').go(11,13).act('R').stage('La caisse restante devient l’appui qui manquait devant la porte.');
a.go(18,14,'warrior');
a.go(17,12,'wizard');
a.save(new URL('../level7-design.json',import.meta.url),{
  label:'Heroes and Mirrors — énigme 30',puzzle:30,
  url:'https://sinkingstarwalkthrough.com/fr/heroes-and-mirrors-solutions/#%C3%A9nigme-30',
  adaptation:true,
},[
  'Adaptation originale, pas une reproduction cellule par cellule : la source associe les reflets et la ligne de vue coudée du Magicien pour extraire un cristal vers un bouton à gauche.',
  'Le Guerrier prépare le miroir nord, dégage la ligne de retour puis place la caisse sur le rayon du second miroir ; le Magicien réalise deux échanges coudés et deux reflets.',
  'Les deux caisses ont des rôles distincts : maintien permanent de la console et appui dans l’eau devant l’accès final. Deux sorties accueillent le duo.',
  'Route constructive enregistrée directement pendant la conception ; aucune recherche exhaustive ni vérification d’unicité.'
]);
