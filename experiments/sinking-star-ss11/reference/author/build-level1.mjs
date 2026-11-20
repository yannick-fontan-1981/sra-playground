import {Author,board} from './author.mjs';

// A new three-branch courtyard, with destinations in separate rooms.
// The eastern works unlock BOTH the northern room and the optical shutter.
// The bent exchange has unequal distances; its geometric landing is open water.
// One cargo is reused as a distant weight and support; a side press builds another.
// This topology and dependency order are independent of the SS08 workshop.
const {put,fill,strings}=board(19,19);

// Open starting courtyard and the separate northern destination.
fill(7,5,11,9);put(8,6,'W');put(7,7,'Z');
fill(9,1,11,3);put(10,4);put(10,1,'g');

// Only the end of this file is accessible: the first push moves both crates.
put(12,8,'o');put(13,8,'o');
fill(14,6,17,10,'~');put(16,8);

// A water channel prevents a walk into the lower optical workshop. Its shutter
// also prevents an early bent exchange from bypassing the eastern construction.
fill(9,10,13,16,'~');put(10,11);
fill(10,15,12,16);put(10,15,'o');
put(11,14,'#');put(12,14,'#');
// The press backing (10,13) stays WATER, not wall: the exchange ray needs it.
// Its standing place and the upper approach are inaccessible before construction.
put(9,12,'#');put(9,13,'o');put(9,14);put(8,13,'~');
fill(5,12,7,16);put(6,12,'g');

const spec={
  id:'ss11-01',title:'La cour aux deux sorties',rows:strings(),facing:'E',
  mirrors:[{at:{x:10,y:7},facing:'SE'}],
  circuits:[
    {id:'relais-est',buttons:[{x:16,y:8}],color:0},
    {id:'presse-ouest',buttons:[{x:12,y:16}],color:10},
  ],
  gates:[
    {at:{x:10,y:4},circuit:'relais-est',direction:'N',closedWhen:'released'},
    {at:{x:10,y:11},circuit:'relais-est',direction:'S',closedWhen:'released'},
    {at:{x:9,y:13},circuit:'presse-ouest',direction:'W',closedWhen:'pressed'},
  ],
};

const a=new Author(spec);
a.go(11,8,'warrior').act('RRR').stage('Le Guerrier pousse la file puis construit les deux appuis du bras est');
a.act('RR').stage('Le Guerrier tient la commande : la sortie nord et l’obturateur du rayon s’ouvrent');
a.go(9,8,'wizard').act('R').stage('Le Magicien remplace son partenaire sur le bouton par un échange entre héros');
a.go(10,6,'warrior').act('D').stage('Le Guerrier descend le miroir sur l’axe de la commande est');
a.select('wizard').act('L').stage('Le rayon coudé échange le Magicien et la caisse de l’atelier : la caisse garde les deux portes ouvertes');
a.go(10,1,'warrior').stage('Le Guerrier revient par la cour et rejoint la destination nord avant le retrait du poids');
a.select('wizard').act('RX').stage('Espace envoie le poids distant dans l’eau : un premier appui est construit et les portes se referment derrière le Guerrier');
a.act('RD').stage('Le bouton cyan ferme la presse latérale : sa caisse construit le second appui vers la sortie ouest');
a.act('ULLULULLLU').stage('Le Magicien relâche la presse, traverse les deux appuis puis rejoint l’autre destination');

a.save(new URL('../level1-design.json',import.meta.url),{
  label:'Tutoriel original · Guerrier et Magicien · règles des Héros du Nord',
  url:'https://sinkingstarwalkthrough.com/fr/north/',
  piston:true,platform:false,
  objective:'Construire le bras est, relayer les héros sur sa commande, libérer la sortie nord puis combiner le reflet du poids et une presse pour construire les deux appuis de la sortie ouest.',
},'Création pédagogique originale pour SS11, entièrement reconstruite autour d’une cour à trois branches et de deux destinations séparées. La commande est ouvre la sortie nord ainsi que l’obturateur optique ; l’atelier inférieur reste inaccessible à pied. Le rayon coudé échange des occupants à des distances différentes : six cases côté est, sept au sud. Un reflet prématuré du héros arriverait dans l’eau, à six cases au sud ; le vrai échange du Magicien est nécessaire pour atteindre le sol de l’atelier. Sa caisse sert successivement de cible de transposition, de poids sur la commande puis d’appui construit par Espace. Une seconde caisse, inaccessible depuis son côté droit, fournit l’appui latéral au moyen de la presse. Le Guerrier doit terminer sa branche avant que le Magicien ne réutilise le poids. Aucun reflet final de héros, aucune passerelle hydraulique et aucune reproduction exacte d’une énigme source.');
