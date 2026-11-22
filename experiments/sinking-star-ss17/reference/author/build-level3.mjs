import {Author,board} from './author.mjs';
import {stepDetailed} from '../../dist/core.js';
import {replay} from '../../scripts/solver.mjs';
import {writeFileSync} from 'node:fs';

const b=board(20,20);
b.fill(2,2,8,16); b.fill(9,2,10,16,'~'); b.fill(11,2,15,16);
for(const [x,y] of [[2,10],[3,9],[3,11]])b.put(x,y,'#');
b.put(8,5,'W'); b.put(4,10,'T'); b.put(11,5,'Z');
b.put(3,10,'o'); b.put(13,10,'o'); b.put(13,5,'o');
b.put(16,10); b.fill(17,8,18,12);
for(const [x,y] of [[17,9],[18,10],[17,11]])b.put(x,y,'g');
const spec={id:'ss17-03',title:'Le compte des îles',rows:b.strings(),circuits:[
 {id:'ancrage-ouest',buttons:[{x:8,y:14}],color:15}
],gates:[{at:{x:16,y:10},circuit:'ancrage-ouest',direction:'E',closedWhen:'released'}]};
const a=new Author(spec);
a.select('wizard').act('L').stage('L’échange envoie le Guerrier à l’est, sans ajouter un occupant à cette rive.');
a.go(14,10,'warrior').act('LLLL').stage('Le Guerrier immerge la charge orientale : seule la moitié est du pont est permanente.');
// Keep the wizard's return line clear. A nearer crystal would win over W.
a.go(13,4).act('D'); a.go(14,5);
a.select('wizard').act('R').stage('La clé écartée de la visée permet l’échange de retour avec le Guerrier.');
a.select('thief').act('RRR').go(7,12).stage('Le Voleur sort la charge occidentale de son renfoncement.');
a.go(5,10,'warrior').act('RRR').stage('Le second appui réunit les rives ; un passage à pied peut enfin changer leur occupation.');
// The last mobile stone is preserved, moved through the emptied eastern axis,
// then exchanged into the western latch without trapping the Wizard there.
a.go(13,5).act('DDDDDDDD');
a.go(14,14).act('LL');
a.go(14,12);
a.go(8,14,'wizard').act('R').stage('Le dernier bloc reste mobile jusqu’à sa relève sur le bouton occidental.');
a.go(17,9,'warrior');
a.go(17,11,'thief');
a.go(18,10,'wizard').stage('Le pont porte le trio ; la rive ouest conserve uniquement la clé de sortie.');

const source={label:'Adaptation · Heroes and Water · énigmes 10 et 11',url:'https://sinkingstarwalkthrough.com/fr/heroes-and-water-solutions/#%C3%A9nigme-11',puzzle:11,objective:'Distinguer l’échange d’occupants d’un véritable transfert entre îles, et préserver une ligne de récupération.',secondaryUrl:'https://sinkingstarwalkthrough.com/fr/heroes-and-water-solutions/#%C3%A9nigme-10',secondaryLabel:'Énigme 10 · garder libre l’axe du retour'};
const adaptation={kind:'adaptation',preserved:['Les échanges conservent le nombre d’occupants de chaque rive ; les appuis permettent ensuite un vrai passage.','Une charge trop proche masque la cible utile sur l’axe de retour.','Un bloc doit rester récupérable au lieu d’être consommé pour le pont.'],changed:['Carte originale à deux rives et pont de deux cases, plutôt que cinq îles.','Le Voleur extrait la réserve occidentale, et le Guerrier construit depuis les deux côtés.','Le troisième bloc devient un poids distant maintenant une porte-poussoir ; aucun Clerc, dragon ou flottement.'],sourceReading:'La contrainte de comptage vient de l’énigme 11 ; la réservation de l’axe de récupération vient de l’énigme 10. Les coordonnées, passages et rôles du trio sont nouveaux.',localChecks:[]};
const d=a.result(source,adaptation);
// Probe the return ray before clearing its first target.
const wrong=new Author(spec);wrong.select('wizard').act('L');wrong.go(14,10,'warrior').act('LLLL');wrong.go(14,5);wrong.select('wizard');
const before=structuredClone(wrong.state),detail=stepDetailed(wrong.world,wrong.state,4);
if(detail.state.failed||!detail.phases.some(p=>p.kind==='swap'&&p.moves.some(m=>m.actor==='stone'))||detail.state.heroes[0].at.x!==14)throw Error('The near key must intercept the unprepared return ray.');
const countEast=s=>s.heroes.filter(h=>h.at.x>=11).length+s.stones.filter(p=>p.x>=11).length+s.monsters.filter(p=>p.x>=11).length;
if(countEast(before)!==countEast(detail.state))throw Error('A spell changed the number of eastern occupants.');
d.adaptation.localChecks.push({name:'Retour sans dégager la première cible',commands:wrong.commands+'R',observed:'Le rayon échange le bloc en (13,5), et laisse le Guerrier en (14,5) ; le nombre d’occupants orientaux reste identique.',scope:'Contre-branche locale et invariant sur cet échange, pas preuve de minimum global.'});
const mid=replay(spec,d.commands.slice(0,d.stages[1].turn));
if(mid.state.supports.length!==1)throw Error('Half bridge stage does not have exactly one support.');
d.adaptation.localChecks.push({name:'Demi-pont',atStage:2,observed:'Un seul appui en (10,10) ; la case occidentale (9,10) demeure de l’eau. Le témoin attend la seconde charge avant toute traversée.',scope:'Contrôle structurel du témoin.'});
writeFileSync(new URL('../level3-design.json',import.meta.url),JSON.stringify(d,null,2)+'\n');
console.log(JSON.stringify({level:3,metrics:d.metrics,commands:d.commands}));
