import {Author,board} from './author.mjs';

// A narrow runway and a sealed press chamber replace the source's crystal train.
// The gap at (6,6) remains water: the press alone never makes a walking bridge.
const b=board(19,12,'~');
b.fill(2,6,5,8);b.put(5,8,'#');b.put(6,7);
b.fill(6,8,16,8);b.fill(9,7,10,7);
b.fill(6,2,6,4);b.put(6,2,'g');b.put(6,3,'g');
b.put(7,5,'o');b.put(7,4,'#');b.put(7,6,'#');b.put(8,5,'#');
b.put(3,8,'W');b.put(2,7,'Z');
const spec={
  id:'ss11-05',title:'La passerelle à contre-sens',rows:b.strings(),facing:'E',
  mirrors:[{at:{x:10,y:8},facing:'NE'}],
  circuits:[{id:'appui',buttons:[{x:3,y:6}],color:7}],
  gates:[{at:{x:7,y:5},circuit:'appui',direction:'W',closedWhen:'pressed'}],
};
const a=new Author(spec);
a.select('wizard').act('UR').stage('La presse latérale crée l’appui de réception entre les deux rives.');
a.go(10,7,'wizard').act('X').go(15,8).stage('Le Magicien passe derrière le miroir par le petit palier nord.');
a.go(10,7,'warrior').act('XLLLL').stage('Le Guerrier rejoint son partenaire, puis recule le miroir jusqu’à la butée.');
a.select('wizard').act('L').stage('L’échange entre partenaires remet le Magicien près du miroir sans pousser son compagnon.');
a.go(9,7,'warrior');
a.go(9,8,'wizard').act('X').go(6,2).stage('Le Magicien se reflète sur l’appui fabriqué par la presse.');
a.go(9,8,'warrior').act('X').go(6,3);
a.save(new URL('../level5-design.json',import.meta.url),{
  label:'Heroes and Mirrors — énigme 21',puzzle:21,
  url:'https://sinkingstarwalkthrough.com/fr/heroes-and-mirrors-solutions/#%C3%A9nigme-21',
  adaptation:true,
},[
  'Adaptation originale du passage sur une rangée : il faut atteindre l’autre côté du miroir, puis le pousser vers la gauche pour préparer le reflet de sortie.',
  'La caisse de la presse est isolée par trois murs. Seule la poussée vers la gauche de la porte peut la déposer dans l’eau, sur la case de réception utile.',
  'Un second trou reste volontairement ouvert devant l’appui : le bouton seul ne permet pas de traverser à pied, il faut aussi déplacer et utiliser le miroir.',
  'Le petit palier nord et les deux positions de sortie permettent de régler l’ordre du duo. L’échange du Magicien est employé dans la route constructive, sans affirmation d’unicité de solution.',
  'Route constructive enregistrée directement pendant la conception ; aucune recherche exhaustive ni vérification d’unicité.'
]);
