import {Author,board} from './author.mjs';
import {replay} from '../../scripts/solver.mjs';
const b=board(20,20);
b.fill(2,3,7,8);b.fill(2,11,7,15);b.fill(8,3,8,12,'~');b.fill(9,3,14,13);
b.put(2,3,'Z');b.put(5,6,'B');b.put(7,6,'o');b.put(4,13,'g');b.put(4,14,'g');
const spec={id:'ss15-04',title:'L’appui des deux traversées',rows:b.strings()};
const a=new Author(spec);
a.select('bard').act('R').stage('La caisse entre dans l’eau et devient l’unique appui de la salle');
a.act('RR').stage('Le Barde monte sur l’appui : celui-ci reste ancré sous ses pieds');
const onSupport=a.commands.length;
a.act('R');
a.go(7,6,'wizard').act('R').stage('Le Magicien rejoint la rive orientale en échangeant avec le Barde');
a.select('bard').act('RR').stage('Le Barde traverse à nouveau, avec le Magicien entraîné sur le sol');
a.go(12,3,'wizard');
a.select('bard').act('DDDD');const upperReturn=a.commands.length;
a.act('DD').stage('Le même appui descend jusqu’à l’ouverture de la rive inférieure');
a.act('LL').go(4,14).stage('Le Barde revient par l’appui et rejoint la destination du bas');
a.go(4,13,'wizard').stage('Le Magicien suit le passage conservé et les deux héros terminent ensemble');
function check(turn,alternative,expected,effect){
 const r=replay(spec,a.commands.slice(0,turn)+alternative);
 const observed={refusals:r.metrics.blocked,dead:r.state.dead,supports:r.state.supports,bard:r.state.heroes.find(h=>h.kind==='bard').at,stones:r.state.stones};
 for(const [k,v]of Object.entries(expected))if(JSON.stringify(observed[k])!==JSON.stringify(v))throw Error('L4 local check '+k);
 return{turn,alternative,effect,observed};
}
const localChecks=[
 check(onSupport,'U',{refusals:1,dead:false,supports:[{x:8,y:6}],bard:{x:8,y:6},stones:[]},'Un appui sous le Barde reste ancré : tenter de remonter sur l’eau vide est refusé, au lieu de déplacer son propre sol.'),
 check(upperReturn,'LL',{refusals:1,dead:false,supports:[{x:8,y:10}],bard:{x:8,y:10}},'Traverser trop haut atteint l’appui mais la rive occidentale est encore un mur ; il faut rejoindre une ouverture réelle.')
];
a.save(new URL('../level4-design.json',import.meta.url),{
 puzzle:27,label:'Adaptation de Heroes and Water · énigme 27 · appui déplacé dans l’eau',url:'https://sinkingstarwalkthrough.com/fr/heroes-and-water-solutions/#%C3%A9nigme-27',
 secondaryLabel:'Heroes and Water · énigme 28 · départ forcé et traversée du partenaire',secondaryUrl:'https://sinkingstarwalkthrough.com/fr/heroes-and-water-solutions/#%C3%A9nigme-28',
 objective:'Transformer la caisse en appui, faire traverser le duo puis réemployer ce même appui devant la rive du bas.'
},{kind:'adaptation',preserved:['Une caisse immergée devient une ressource de traversée déplacée par le chant.','Il faut modifier la position de l’appui pour desservir des ouvertures différentes.','Les deux héros doivent rejoindre les destinations après le transport de la ressource.'],changed:['Le Magicien remplace le Guerrier et assure une relève par échange.','SS15 ancre les appuis sous les héros et sous la prochaine arrivée du Barde.','Une seule caisse dessert deux traversées ; le chant carré remplace le chant en ligne. Aucun empilement ni déplacement double du guide n’est repris.'],sourceReading:'Heroes and Water 27 guide un cristal dans l’eau entre plusieurs passages ; l’énigme 28 distingue les mouvements volontaires et forcés du Barde. La carte SS15 utilise une rive centrale et un retour vers une rive inférieure séparée.',localChecks,checkScope:'Comparaisons locales exécutées ; aucune preuve d’optimalité ou d’unicité globale.'});
