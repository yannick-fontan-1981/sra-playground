import {Author,board} from './author.mjs';

// Adapt the three successive weight replacements from Heroes and Light 4.
// One cargo replaces the dragon; it is enclosed in a remote three-press lock.
// The two movable weights must become bridges after the Wizard replaces them.
const {put,fill,strings}=board(20,15,'~');
fill(1,1,4,3);put(4,4,'Z');put(3,2,'W');
fill(4,6,9,8);put(9,9,'o');
fill(9,11,14,13);put(14,10);put(14,9,'o');put(15,9);
fill(17,7,18,10);put(17,7,'g');put(18,10,'g');
// The loading chamber has no walking entrance or external casting line.
fill(6,1,11,3,'#');fill(7,2,10,2);put(10,2,'o');put(9,4);
const spec={
  id:'ss11-05',title:'L’écluse des remplaçants',rows:strings(),facing:'E',
  mirrors:[{at:{x:9,y:4},facing:'SW'}],
  circuits:[
    {id:'premier',buttons:[{x:4,y:4}],color:0},
    {id:'deuxieme',buttons:[{x:9,y:9}],color:10},
    {id:'troisieme',buttons:[{x:14,y:9}],color:15},
    {id:'sortie',buttons:[{x:7,y:2}],color:14},
  ],
  gates:[
    {at:{x:10,y:2},circuit:'premier',direction:'W',closedWhen:'released'},
    {at:{x:9,y:2},circuit:'deuxieme',direction:'W',closedWhen:'released'},
    {at:{x:8,y:2},circuit:'troisieme',direction:'W',closedWhen:'released'},
  ],
  platforms:[{at:{x:16,y:9},circuit:'sortie',activeWhen:'pressed'}],
};
const a=new Author(spec);
a.select('wizard').act('R').stage('Le rayon dévié échange le Magicien et le premier poids ; les commandes restent occupées');
a.go(4,3,'warrior').act('D').stage('Le premier poids devient un appui ; le Guerrier remplace encore son poids sur le bouton');
a.act('D').stage('Le Guerrier quitte la commande blanche : la première presse avance la cargaison');
a.go(9,8).select('wizard').act('R').stage('Le Magicien remplace le deuxième poids ; la commande cyan reste tenue par la caisse');
a.go(9,8,'warrior').act('D').stage('La deuxième caisse construit le passage inférieur ; le Guerrier tient encore le bouton cyan');
a.act('D').stage('La commande cyan se libère et la deuxième presse avance la cargaison vers la dernière chambre');
a.select('wizard').act('R').stage('Le Magicien quitte la commande violette : la troisième presse livre la cargaison sur le bouton vert');
a.go(17,7).stage('La plateforme de sortie est maintenant maintenue par la cargaison distante');
a.go(18,10,'warrior').stage('Le Guerrier emprunte les deux appuis construits puis rejoint la deuxième destination');
a.save(new URL('../level5-design.json',import.meta.url),{
  puzzle:4,
  label:'Adaptation de Heroes and Light · énigme 4 · remplacer les poids avant de relâcher les presses',
  url:'https://sinkingstarwalkthrough.com/fr/heroes-and-light-solutions/#%C3%A9nigme-4',
  piston:true,platform:true,
  objective:'Remplacer les poids par échanges, construire deux appuis puis libérer les trois commandes dans l’ordre pour livrer la cargaison sur le bouton de sortie.',
},'Adaptation du principe de Heroes and Light 4 : trois poussées latérales dépendent du remplacement des occupants de commandes. Le dragon de la source est remplacé par une caisse sans feu, enfermée dans une écluse inaccessible aux héros. Les deux cristaux deviennent deux caisses échangeables ; après chaque remplacement, le Guerrier les pousse dans l’eau pour avancer et quitter le bouton. Le duo Guerrier–Magicien, le miroir de visée, les deux appuis et la plateforme finale sont spécifiques à cette adaptation ; la géométrie originale n’est pas reproduite.');
