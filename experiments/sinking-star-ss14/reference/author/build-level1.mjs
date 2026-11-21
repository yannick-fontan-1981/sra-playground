import {Author,board} from './author.mjs';

// A deliberately spacious workshop. Its witness demonstrates every discovery;
// the player may solve it in another order, without following a prescribed route.
const b=board(20,20);
b.fill(1,1,18,10);
b.fill(1,11,18,13,'~');
b.fill(15,12,18,18);
b.put(7,7,'#');
b.put(3,11,'#');b.put(9,11,'#');
b.put(4,5,'T');b.put(4,6,'B');
for(const [x,y] of [[5,5],[6,7],[6,9],[15,10]])b.put(x,y,'o');
b.put(16,2,'m');b.put(18,2,'m');
b.put(15,15,'g');b.put(17,17,'g');
const spec={id:'ss14-01',title:'L’atelier des deux voix',rows:b.strings(),facing:'W',
 mirrors:[{at:{x:16,y:8},facing:'SW'}],
 circuits:[{id:'atelier',buttons:[{x:12,y:4}],color:11}],
 gates:[
  {at:{x:15,y:10},circuit:'atelier',direction:'S',closedWhen:'pressed'},
  {at:{x:16,y:2},circuit:'atelier',direction:'E',closedWhen:'pressed'}
 ]};
const a=new Author(spec);
a.act('LD').stage('Une traction unitaire puis un départ perpendiculaire : la caisse reste en place');
a.go(4,7).act('DD').stage('Le Voleur tire le Barde ; ce déplacement forcé ne déclenche aucun chant');
a.select('bard').act('R').stage('Le chant entraîne le partenaire et la caisse libre, tandis que la caisse devant le mur reste immobile');
a.go(3,10,'thief');
a.select('bard').act('DDR').stage('Une caisse est immergée puis l’appui ainsi créé glisse dans l’eau');
a.go(8,11,'thief');
a.select('bard').act('R').stage('L’appui reste ancré sous le Voleur pendant le déplacement du Barde');
a.select('thief').act('UR').go(12,5).act('U').stage('Une commande déclenche deux presses : immersion de la caisse et rencontre des deux monstres');
a.go(15,8).act('L').stage('Le Voleur transporte le miroir sans modifier ses faces réfléchissantes');
a.go(13,4);
a.select('bard').act('URRRUR').stage('Le Barde se place devant la face blanche en conservant l’appui d’arrivée');
a.act('XDDD').go(17,17).stage('Le reflet transporte le Barde sans chant ; il libère ensuite l’arrivée');
a.go(12,8,'thief').act('XD').go(15,15).stage('Le second reflet permet d’occuper les deux destinations simultanément');
a.save(new URL('../level1-design.json',import.meta.url),{
 label:'Atelier original · North et Crossovers · Voleur et Barde',
 url:'https://sinkingstarwalkthrough.com/fr/north/',
 secondaryLabel:'Crossovers · coopération et conservation des appuis',
 secondaryUrl:'https://sinkingstarwalkthrough.com/fr/crossovers/',
 objective:'Découvrir les deux pouvoirs, préserver un appui, préparer le reflet et rejoindre les deux destinations.'
},{kind:'original-tutorial',preserved:['Les familles de problèmes de North et Crossovers : traction, entraînement, appui immergé et départ forcé.'],changed:['Un atelier original, ouvert à plusieurs itinéraires, associe les règles déterministes de SS14.','Dix-sept découvertes sont reconnues à partir des seules images publiques.','La route de validation démontre chacune des découvertes, sans imposer cette route au joueur.'],sourceReading:'Ce premier niveau enseigne le contrat de SS14 ; il ne prétend reproduire aucune carte numérotée de la source.'});
