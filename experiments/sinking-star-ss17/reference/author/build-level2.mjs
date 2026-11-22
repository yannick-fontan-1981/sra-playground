import {Author,board} from './author.mjs';
import {compileLevel,stepDetailed,circuitPressed} from '../../dist/core.js';
import {decodeCommand,replay} from '../../scripts/solver.mjs';

const b=board(20,20);
b.fill(6,2,10,15); b.fill(5,6,5,7);
b.put(2,4,'W'); b.put(2,5); b.fill(3,4,5,4,'~');
b.put(2,12,'T'); b.fill(3,12,5,12,'~');
b.put(6,4,'Z'); b.put(8,4,'o'); b.put(8,12,'o');
b.put(6,7,'o'); b.put(10,3,'o'); b.put(10,2,'#');
for(const [x,y] of [[8,6],[7,8],[9,8],[8,9]])b.put(x,y,'#');
b.fill(11,11,13,11); b.fill(14,9,18,13);
for(const [x,y] of [[16,10],[17,11],[16,12]])b.put(x,y,'g');
const spec={id:'ss17-02',title:'Les cellules de relève',rows:b.strings(),circuits:[
 {id:'cellule-ouest',buttons:[{x:2,y:4}],color:15},
 {id:'liberte',buttons:[{x:2,y:12},{x:8,y:8},{x:10,y:10}],color:11}
],gates:[
 {at:{x:8,y:7},circuit:'cellule-ouest',direction:'S',closedWhen:'pressed'},
 {at:{x:13,y:11},circuit:'liberte',direction:'E',closedWhen:'released'}
]};
const a=new Author(spec);
a.select('wizard').act('LD').stage('Le Guerrier quitte sa cellule ; le Magicien libère la plaque en restant captif.');
// The press needs the upper prison emptied before its cargo can enter.
a.go(5,7,'warrior').act('RR').stage('La charge attend sur la presse ouverte, sans accès de poussée au nord.');
a.go(9,4).act('LL');
a.select('wizard').act('UR').stage('Le Magicien referme la presse puis le bloc le relève dans la cellule.');
a.go(6,12).act('L').stage('Le Voleur libéré doit encore être remplacé par un poids dans sa cellule.');
a.go(7,14,'thief');
a.go(9,12,'warrior').act('LL');
a.select('wizard').act('R');
a.go(7,10);
a.go(10,4,'thief').act('DDDDDDD').stage('Le Voleur extrait la clé du renfoncement et la conserve comme troisième poids.');
a.go(9,11);
a.go(16,10,'warrior');
a.go(16,12,'thief');
a.go(17,11,'wizard').stage('Les trois cellules de commande restent lestées pendant la sortie du trio.');

const source={label:'Adaptation · Heroes of Hauling · énigmes 13 et 19',url:'https://sinkingstarwalkthrough.com/fr/heroes-of-hauling-solutions/#%C3%A9nigme-19',puzzle:19,objective:'Libérer deux captifs par substitution et préserver les poids qui commandent la sortie.',secondaryUrl:'https://sinkingstarwalkthrough.com/fr/heroes-of-hauling-solutions/#%C3%A9nigme-13',secondaryLabel:'Énigme 13 · relève sur une plaque par échange'};
const adaptation={kind:'adaptation',preserved:['Les héros enfermés sont remplacés par des blocs, puis réunis dans la zone commune.','Un échange peut transférer le rôle de poids sans abandonner la cellule de commande.'],changed:['Carte originale de deux cellules séparées par de l’eau, trois héros W/T/Z et trois sorties.','Une fermeture latérale dépose une charge dans un logement sans accès de poussée au nord.','Un quatrième bloc doit être extrait d’un renfoncement puis conservé comme poids final.'],sourceReading:'Les énigmes 13 et 19 fournissent la substitution des occupants. La presse et le logement sud sont une construction SS17 ; aucune carte ni sprite du jeu commercial ne sont repris.',localChecks:[]};
const d=a.result(source,adaptation);
// Counter-branch: restore the prison before loading the press. Its tile closes,
// and the planned next push cannot enter it. This is a local dependency check.
const premature=new Author(spec);premature.select('wizard').act('LD');premature.go(9,4,'warrior').act('LL');premature.select('wizard').act('UR');premature.go(5,7,'warrior').act('R');
const blocked=stepDetailed(premature.world,premature.state,4);
if(!blocked.state.failed)throw Error('Premature prison relay must block the cargo push.');
d.adaptation.localChecks.push({name:'Relève avant chargement de la presse',commands:premature.commands+'R',observed:'Poussée de la charge refusée devant la presse fermée ; le chargement doit précéder cette relève dans le parcours.',scope:'Branche locale, pas preuve de nécessité globale.'});
// The initial exits cannot be approached through the closed circuit.
if(circuitPressed(a.world,replay(spec,'').state,'liberte'))throw Error('Exit circuit initially active.');
await import('node:fs').then(({writeFileSync})=>writeFileSync(new URL('../level2-design.json',import.meta.url),JSON.stringify(d,null,2)+'\n'));
console.log(JSON.stringify({level:2,metrics:d.metrics,commands:d.commands}));
