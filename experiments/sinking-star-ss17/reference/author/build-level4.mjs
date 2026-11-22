import {Author,board} from './author.mjs';
import {stepDetailed} from '../../dist/core.js';
import {writeFileSync} from 'node:fs';

const b=board(20,20);
b.fill(2,8,9,10); b.put(8,11); b.put(9,11); b.put(9,12,'1');
b.fill(8,2,10,3); b.fill(9,4,9,7,'~'); b.put(9,3,'Z');
b.put(6,9,'W'); b.put(9,11,'T');
b.fill(10,9,11,10,'~'); b.fill(12,8,18,15); b.put(14,10,'o');
b.fill(16,3,18,5); b.put(17,6); b.put(17,7);
for(const x of [16,17,18])b.put(x,4,'g');
const spec={id:'ss17-04',title:'Le miroir, puis le lest',rows:b.strings(),circuits:[
 {id:'releve-du-mage',buttons:[{x:9,y:3}],color:11},
 {id:'miroir-lest',buttons:[{x:14,y:14}],color:15}
],gates:[
 {at:{x:17,y:7},circuit:'releve-du-mage',direction:'S',closedWhen:'released'},
 {at:{x:17,y:6},circuit:'miroir-lest',direction:'S',closedWhen:'released'}
],platforms:[
 {at:{x:10,y:9},circuit:'releve-du-mage',activeWhen:'pressed'},
 {at:{x:11,y:9},circuit:'releve-du-mage',activeWhen:'pressed'}
]};
const a=new Author(spec);
a.select('thief').act('UU').go(8,9).stage('Le Voleur extrait le miroir, l’aligne puis quitte le faisceau nord.');
a.select('wizard').act('D').stage('La visée coudée remplace le Magicien par le bloc sans relâcher le pont.');
a.go(15,11);
a.go(10,9,'thief');
a.go(9,11,'warrior').act('U').stage('Le miroir quitte sa fonction optique et rejoint la voie du pont.');
a.select('thief').act('RRRRR').go(14,10).act('DDDDD').stage('Le Voleur transporte le même miroir jusqu’au second verrou.');
a.go(16,4,'warrior');
a.go(18,4,'thief');
a.go(17,4,'wizard').stage('Le bloc reste sur l’île du Magicien, et le miroir maintient le verrou intérieur.');

const source={label:'Adaptation · Heroes and Mirrors · énigmes 30 et 31',url:'https://sinkingstarwalkthrough.com/fr/heroes-and-mirrors-solutions/#%C3%A9nigme-30',puzzle:30,objective:'Placer physiquement le miroir pour une visée coudée, puis réutiliser cet outil comme poids.',secondaryUrl:'https://sinkingstarwalkthrough.com/fr/heroes-and-mirrors-solutions/#%C3%A9nigme-31',secondaryLabel:'Énigme 31 · repositionner le miroir avant la sortie'};
const adaptation={kind:'adaptation',preserved:['La ligne de vue du Magicien peut tourner autour d’un angle pour échanger un bloc.','Le miroir doit atteindre une position précise avant que la visée utile existe.'],changed:['Carte originale : île de commande du Magicien, pont hydraulique, renfoncement à miroir et double verrou.','Le Voleur extrait et transporte le miroir ; le Guerrier le pousse sur la voie, puis le même miroir devient un poids final.','Le miroir spécial échangeable de la source 31 est remplacé par un miroir ordinaire déplacé physiquement. Aucun miroir n’est cible de magie, ni dupliqué.','Un échange conserve la charge du bouton distant ; les sorties dépendent de deux circuits distincts.'],sourceReading:'La visée déviée vient de l’énigme 30, le placement préparatoire du miroir de l’énigme 31. Le réemploi comme lest et le pont commandé sont une composition SS17, sans reproduction de carte.',localChecks:[]};
const d=a.result(source,adaptation);
const intercepted=new Author(spec);intercepted.select('thief').act('UU');intercepted.select('wizard');
const interception=stepDetailed(intercepted.world,intercepted.state,2);
if(interception.state.failed||!interception.phases.some(p=>p.kind==='swap'&&p.moves.every(m=>m.actor==='hero'))||!interception.state.stones.some(p=>p.x===14&&p.y===10))throw Error('The thief must intercept the spell if left in its north ray.');
d.adaptation.localChecks.push({name:'Le tireur masque le coude',commands:intercepted.commands+'D',observed:'Le Magicien échange avec le Voleur resté en (9,9) ; le bloc oriental demeure en (14,10). Quitter la ligne est donc une étape du témoin.',scope:'Contre-branche locale, pas impossibilité globale.'});
const geometric=new Author(spec);geometric.select('thief').act('UU').go(8,9);geometric.select('wizard').act('D');
const reflection=stepDetailed(geometric.world,geometric.state,5);
if(!reflection.state.dead)throw Error('Geometric reflection must drown the nearer Wizard in the water north of the mirror.');
d.adaptation.localChecks.push({name:'Confondre visée magique et reflet global',commands:geometric.commands+'X',observed:'Après l’échange, le reflet global prend le Magicien à distance cinq et le dépose en (9,5), dans l’eau ; cette branche meurt.',scope:'Contre-branche locale vérifiée.'});
writeFileSync(new URL('../level4-design.json',import.meta.url),JSON.stringify(d,null,2)+'\n');
console.log(JSON.stringify({level:4,metrics:d.metrics,commands:d.commands}));
