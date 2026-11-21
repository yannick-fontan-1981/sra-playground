import {Author,board} from './author.mjs';
import {replay} from '../../scripts/solver.mjs';
import {circuitPressed} from '../../dist/core.js';
const b=board(20,13);
b.fill(1,5,14,5);b.fill(1,3,7,3);b.fill(1,7,7,7);b.fill(1,5,1,8);
b.fill(6,8,10,10);b.fill(10,5,10,10);b.fill(9,2,14,10);
b.put(11,2,'#');b.put(13,2,'#');b.put(12,1,'#');b.put(15,2);b.put(15,3);b.put(15,4);
b.fill(16,4,18,7);b.put(16,5,'g');b.put(18,7,'g');
b.put(2,5,'B');b.put(6,10,'T');b.put(2,3,'o');b.put(2,7,'o');b.put(12,10,'o');
const spec={id:'ss14-02',title:'La relève silencieuse',rows:b.strings(),circuits:[
 {id:'rails',buttons:[{x:5,y:3},{x:5,y:7}],color:11},
 {id:'alcove',buttons:[{x:12,y:2}],color:10},
],gates:[{at:{x:8,y:5},circuit:'rails',direction:'E',closedWhen:'released'},
 {at:{x:15,y:4},circuit:'alcove',direction:'E',closedWhen:'released'}]};
const a=new Author(spec);
a.select('bard').act('RRR').stage('Le chant place deux poids au milieu de leurs rails ; les déplacer encore retirerait la commande');
a.go(6,5,'thief').act('RRRRR').stage('Le Voleur remorque le Barde sans chant à travers la porte maintenue');
a.act('D');a.go(14,4,'bard');
a.go(12,9,'thief').act('UUUUUU').stage('La troisième caisse remonte vers une alcôve sans case de traction au nord');
a.act('L').go(10,8).stage('Le Voleur libère la zone du dernier chant');
a.select('bard').act('UU').stage('Le chant à travers le mur dépose le poids dans l’alcôve');
a.act('RDD').go(18,7).stage('Le Barde sort de la portée du poids avant de descendre vers sa destination');
a.go(16,5,'thief').stage('Le partenaire rejoint la seconde destination en laissant les trois poids en place');
function checkLocal(turn,alternative,expected,effect){
 const r=replay(spec,a.commands.slice(0,turn)+alternative);
 const observed={refusals:r.metrics.blocked,dead:r.state.dead,mirrors:r.state.mirrors.length,supports:r.state.supports,platformActive:r.state.platformActive??[],...Object.fromEntries(a.world.circuits.map(c=>[c.id,circuitPressed(a.world,r.state,c.id)]))};
 for(const [key,value]of Object.entries(expected))if(JSON.stringify(observed[key])!==JSON.stringify(value))throw Error(`Local check changed at ${turn} + ${alternative}: ${key}`);
 return{turn,alternative,effect,observed};
}
const localChecks=[
 checkLocal(4,"R",{"rails": false},"Un pas volontaire supplémentaire du Barde retire les deux poids et ferme la porte des rails."),
 checkLocal(51,"D",{"alcove": false},"Descendre immédiatement après le dépôt retire la caisse de l’alcôve ; le départ latéral retenu dans le parcours la conserve.")
];
a.save(new URL('../level2-design.json',import.meta.url),{
 puzzle:14,label:'Adaptation de Heroes 3: Bard, Druid · énigme 14 · deux poids à conserver',
 url:'https://sinkingstarwalkthrough.com/fr/heroes-3-bard-druid-solutions/#%C3%A9nigme-14',
 secondaryLabel:'Heroes 3: Bard, Druid · énigme 19 · commande en alcôve',
 secondaryUrl:'https://sinkingstarwalkthrough.com/fr/heroes-3-bard-druid-solutions/#%C3%A9nigme-19',
 objective:'Maintenir les deux rails, transporter le partenaire et préparer la commande reculée de la sortie.'
},{kind:'adaptation',preserved:['Deux poids restent sur leurs plaques pendant le déplacement imposé du Barde.','Le placement du chanteur autour d’une niche permet de déplacer une cargaison inaccessible par traction directe.'],changed:['Le Voleur remorque le Barde depuis l’avant au lieu d’une poussée de Guerrier.','Les poids sont des caisses ; une troisième caisse et une alcôve composent une seconde relève.','La portée carrée de deux cases traverse les murs, selon le contrat SS14.'],sourceReading:'Heroes 3 énigme 14 inspire le maintien de deux poids par départ sans chant. L’énigme 19 inspire le travail de cargaison autour d’une niche. La carte et l’enchaînement sont originaux, sans empilement ni déplacement double.',localChecks,checkScope:'Comparaisons locales du parcours auteur ; aucune preuve d’optimalité ou d’unicité globale.'});
