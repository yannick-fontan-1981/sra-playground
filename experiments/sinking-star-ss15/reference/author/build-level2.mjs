import {Author,board} from './author.mjs';
import {replay} from '../../scripts/solver.mjs';
import {circuitPressed} from '../../dist/core.js';
const b=board(20,20);
b.fill(2,3,9,10);b.fill(11,3,16,8);b.put(10,4);
b.put(2,3,'Z');b.put(4,8,'B');b.put(4,6,'o');b.put(14,4,'g');b.put(14,5,'g');
const spec={id:'ss15-02',title:'Le départ qui garde le poids',rows:b.strings(),
 circuits:[{id:'poids-conserve',buttons:[{x:6,y:6}],color:10}],
 gates:[{at:{x:10,y:4},circuit:'poids-conserve',direction:'E',closedWhen:'released'}]};
const a=new Author(spec);
a.select('bard').act('RR').stage('Le chant pose la caisse sur la commande qui ouvre le passage');
const loaded=a.commands.length;
a.go(2,8,'wizard');const beforeExchange=a.commands.length;
a.act('R').stage('Le Magicien échange avec le Barde : la caisse reste sur la commande');
a.go(11,8,'wizard');
a.go(9,3,'bard').go(11,4).go(14,4).stage('Le Barde contourne sa caisse à distance et rejoint la première destination');
a.go(14,5,'wizard').stage('Le Magicien rejoint le Barde sans reprendre la caisse');
function check(turn,alternative,expected,effect){
 const r=replay(spec,a.commands.slice(0,turn)+alternative);
 const observed={refusals:r.metrics.blocked,dead:r.state.dead,pressed:circuitPressed(r.world,r.state,'poids-conserve'),stones:r.state.stones,bard:r.state.heroes.find(h=>h.kind==='bard').at};
 for(const [k,v]of Object.entries(expected))if(JSON.stringify(observed[k])!==JSON.stringify(v))throw Error('L2 local check '+k);
 return{turn,alternative,effect,observed};
}
const localChecks=[
 check(loaded,'D',{refusals:0,dead:false,pressed:false,stones:[{x:6,y:7}]},'Un départ volontaire vers le bas entraîne encore la caisse et referme le passage.'),
 check(beforeExchange,'R',{refusals:0,dead:false,pressed:true,stones:[{x:6,y:6}],bard:{x:2,y:8}},'L’échange déplace le Barde sans chant : son poids reste exactement sur la commande.')
];
a.save(new URL('../level2-design.json',import.meta.url),{
 puzzle:1,label:'Adaptation de Heroes and Mirrors · énigme 1 · départ sans déplacer le poids',url:'https://sinkingstarwalkthrough.com/fr/heroes-and-mirrors-solutions/#%C3%A9nigme-1',
 secondaryLabel:'Heroes of Hauling · énigme 13 · relève par échange',secondaryUrl:'https://sinkingstarwalkthrough.com/fr/heroes-of-hauling-solutions/#%C3%A9nigme-13',
 objective:'Poser la caisse sur la commande, sortir le Barde de son chant et faire passer les deux partenaires.'
},{kind:'adaptation',preserved:['Un poids doit rester sur sa commande pendant le départ du Barde.','Un déplacement forcé du partenaire permet de changer de position sans entraîner la charge.'],changed:['Le départ par miroir du guide devient ici un échange frontal du Magicien.','Le chant carré de 5 × 5 remplace le chant en ligne et impose un détour hors de portée.','La salle, ses distances et ses deux destinations sont originales.'],sourceReading:'Heroes and Mirrors 1 conserve un cristal sur son bouton pendant un reflet de la Barde ; Heroes of Hauling 13 montre une relève de héros par échange. SS15 combine ces contraintes avec ses deux pouvoirs.',localChecks,checkScope:'Comparaisons locales exécutées ; aucune preuve d’optimalité ou d’unicité globale.'});
