import {Author,board} from './author.mjs';

// Two separate workshops, one northern optical court, an eastern destination.
// Every crate is a bridge tile or the enduring optical/press command weight.
const {put,fill,strings}=board(20,20);
fill(1,1,10,7);
fill(1,8,10,10,'~');
fill(2,11,7,18);
fill(11,1,18,10,'~');
fill(15,4,18,8);
put(1,7,'#');
put(11,6,'#'); // blocks the east arm until the Warrior raises the mirror
put(14,3,'#'); // no standing place from which to push the press cargo south
put(14,4,'o');
put(12,5); // optical shutter: isolated, not a second walking route
put(4,16,'W');put(4,15,'o');put(4,14,'o');
put(2,4,'B');put(3,6,'o');put(1,6,'o');
put(16,4,'g');put(17,7,'g');
const spec={
 id:'ss12-01',title:'La répétition des deux rives',rows:strings(),facing:'N',
 mirrors:[{at:{x:10,y:6},facing:'NE'}],
 circuits:[{id:'rappel',buttons:[{x:2,y:6}],color:0}],
 gates:[
  {at:{x:14,y:4},circuit:'rappel',direction:'S',closedWhen:'pressed'},
  {at:{x:12,y:5},circuit:'rappel',direction:'E',closedWhen:'released'},
 ],
};
const a=new Author(spec);
a.act('UUUUUU').stage('Le Guerrier pousse sa file de deux caisses et construit les deux premiers appuis du passage nord.');
a.select('bard').act('DDR').stage('Le Barde chante à travers sa cour : une caisse reste retenue, l’autre entre dans l’eau puis glisse à droite. Le poids libéré commande la presse et son obturateur.');
a.select('warrior').act('UUUL').stage('Le Guerrier traverse les trois appuis et rejoint la cour du Barde.');
a.select('bard').act('UD').stage('Le chant entraîne aussi le Guerrier. Le poids quitte puis retrouve sa commande ; les pièces bloquées restent en place.');
a.select('warrior').act('UUU').stage('Trois poussées replacent le Barde hors de portée du poids, sans déclencher son chant.');
a.go(10,7,'warrior').act('U').stage('Le Guerrier remonte le miroir : son bras blanc passe au-dessus du mur qui bloquait le reflet.');
a.go(10,1,'bard').act('X').stage('Le Barde prend le reflet vers l’appui créé par la presse distante.');
a.act('R').go(16,4).stage('Le Barde quitte l’appui et prend la première destination.');
a.go(10,1,'warrior').act('X').act('R').go(17,7).stage('Le Guerrier emprunte à son tour le miroir et occupe la seconde destination.');
a.save(new URL('../level1-design.json',import.meta.url),{
 label:'Tutoriel original · Guerrier et Barde · règles du Nord et des zones mixtes',
 url:'https://sinkingstarwalkthrough.com/fr/north/',piston:true,platform:false,
 objective:'Réunir les deux ateliers par trois appuis, conserver le poids de la commande, régler le miroir puis rejoindre les deux destinations.',
},'Tutoriel original SS12. Le Guerrier démarre dans le chantier inférieur, le Barde dans une cour ouverte au nord. Les deux caisses de la file et la caisse chantée fournissent les trois appuis entre leurs rives. Une quatrième caisse, retenue au sud par un mur et inaccessible à une poussée depuis l’ouest, sert de poids durable. Elle ferme la presse isolée et ouvre l’obturateur optique. Le Barde doit apprendre à quitter sa commande sans déplacer le poids ; le Guerrier peut le replacer sans chant. Un miroir déplacé vers le nord contourne son mur de dos. La caisse de la presse forme la seule arrivée sûre à distance égale pour rejoindre l’île des deux destinations. Le pas du chant qui entraîne le partenaire est une découverte pédagogique, sans promesse d’unicité du parcours.');
