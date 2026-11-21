import {Author,board} from './author.mjs';
import {writeFileSync} from 'node:fs';
import {stepDetailed,circuitPressed,platformActive} from '../../dist/core.js';
import {decodeCommand} from '../../scripts/solver.mjs';

// Four shores form a loop. The fourth crate outlives the three crossings:
// it first supplies the hydraulic access, then becomes the final gate's weight.
const {put,fill,strings}=board(20,20,'~');
fill(2,13,14,18);
fill(2,7,14,11);
fill(2,1,14,4);
fill(16,3,18,11);
// The goal chamber has one controlled entrance.
fill(4,1,4,4,'#');put(4,2,'.');put(2,1,'g');put(2,3,'g');
put(3,1,'#');put(3,3,'#');put(3,4,'#');
// The final command is an alcove: a mirror cannot be pulled into it.
put(8,1,'#');put(10,1,'#');put(9,0,'#');
// The southern weight cannot be hauled out through its unsupported forecourt.
put(2,17,'#');put(4,17,'#');put(3,18,'#');put(3,15,'~');
// The loaded press has no voluntary eastward landing until its command releases.
put(9,9,'~');put(9,11,'#');put(10,10,'~');put(11,10,'#');
put(5,16,'T');put(3,14,'Z');put(9,16,'o');put(3,17,'o');
put(5,2,'o');put(14,1,'o');
const spec={
 id:'ss13-07',title:'L’amarre et les trois diagonales',rows:strings(),facing:'W',
 mirrors:[{at:{x:6,y:16},facing:'NE'}],
 circuits:[
  {id:'amarre',buttons:[{x:3,y:17}],color:11},
  {id:'presse',buttons:[{x:7,y:9}],color:9},
  {id:'sceau',buttons:[{x:9,y:1},{x:17,y:6}],color:10},
 ],
 gates:[
  {at:{x:8,y:10},circuit:'presse',direction:'E',closedWhen:'released'},
  {at:{x:4,y:2},circuit:'sceau',direction:'E',closedWhen:'released'},
  {at:{x:3,y:2},circuit:'amarre',direction:'E',closedWhen:'pressed'},
 ],
 platforms:[
  {at:{x:5,y:5},circuit:'amarre',activeWhen:'pressed'},
  {at:{x:11,y:5},circuit:'amarre',activeWhen:'pressed'},
  {at:{x:12,y:5},circuit:'amarre',activeWhen:'pressed'},
  {at:{x:15,y:10},circuit:'amarre',activeWhen:'released'},
  {at:{x:10,y:10},circuit:'presse',activeWhen:'released'},
 ],
};
const a=new Author(spec);
a.act('LX').stage('Premier poste : le miroir déplacé immerge la première caisse et relie la rive sud au chantier');
a.go(5,15,'thief').act('UUUUUU').go(7,9)
 .stage('Deuxième poste : le Voleur tient la presse ouverte après avoir tracté le miroir jusqu’au chantier');
a.go(9,10,'wizard').act('L')
 .stage('Le rayon coudé importe la caisse du nord sans déplacer le poids qui entretient les passerelles');
a.act('X').stage('Deuxième appui : il rejoint la passerelle hydraulique encore alimentée par la caisse sud');
a.go(12,1,'wizard').act('R').go(14,2)
 .stage('Le Magicien recale la troisième caisse ; il libère aussi l’arrivée du Voleur et du miroir');
a.go(5,9,'thief').act('UUUUUUU')
 .stage('Le Voleur fait franchir au même miroir l’appui fixe puis la passerelle commandée');
a.go(6,3).act('RRRRRRR').go(12,4).act('D').go(11,3)
 .stage('Troisième poste : la traction vers le bas dépend du parvis hydraulique et de la caisse conservée');
a.act('X').stage('Troisième appui : la rive est referme la boucle ; le retour restera possible après le retrait du poids');
a.go(13,4,'thief').act('RRRRR').go(17,5).act('DD')
 .stage('Le miroir franchit son troisième appui puis reste sur la commande est de la chambre finale');
a.go(3,10,'wizard')
 .stage('Avant récupération : le poids sud alimente toujours les trois cases hydrauliques');
a.act('D').stage('Le Magicien récupère la caisse par échange et la remplace provisoirement sur son bouton');
a.go(4,10,'thief').act('RRR')
 .stage('Le Voleur libère la ligne de retour : le Magicien peut quitter le bouton sans rééchanger la caisse');
a.go(7,9,'wizard')
 .stage('Le poids sud est libéré : le raccourci nord disparaît, le détour est se déploie et la porte intérieure s’ouvre');
a.select('thief').act('RR')
 .stage('Avant la presse : la caisse est sur le piston et le Voleur juste devant elle');
a.select('wizard').act('U')
 .stage('La presse déplace ensemble la caisse et le Voleur ; le déplacement forcé ne provoque aucune traction');
a.go(9,1,'wizard').act('D')
 .stage('Le Magicien revient par la boucle permanente et échange la caisse dans l’alcôve de commande');
a.go(2,1,'thief');
a.go(2,3,'wizard').stage('Les deux partenaires empruntent les appuis fixes et rejoignent la chambre finale');
const design=a.result({
 puzzle:6,label:'Adaptation de Heroes and Mirrors · énigme 6 · une diagonale mobile, une ressource à conserver',
 url:'https://sinkingstarwalkthrough.com/fr/heroes-and-mirrors-solutions/#%C3%A9nigme-6',
 secondaryLabel:'Heroes and Water · énigmes 7 et 10 · conserver les relais et l’ordre des caisses',
 secondaryUrl:'https://sinkingstarwalkthrough.com/fr/heroes-and-water-solutions/',
 objective:'Ouvrir la chambre des deux destinations en organisant trois passages et le retour des ressources. Chaque caisse engagée change les possibilités restantes.',
}, {
 kind:'Adaptation originale de plusieurs idées de parcours, sans reproduction de carte',
 preserved:[
  'Le miroir mobile change la diagonale qui dépose une caisse dans un trou.',
  'Le même miroir doit franchir un passage obtenu grâce à sa précédente configuration.',
  'Un échange transporte une caisse et un héros en sens opposés, sans transporter le miroir.',
 ],
 changed:[
  'Quatre rives forment une boucle avec trois appuis permanents et deux itinéraires hydrauliques opposés.',
  'Une quatrième caisse sert successivement de poids hydraulique et de commande nord ; le miroir devient le poids de la commande est.',
  'La presse est tenue ouverte pour un rayon coudé, puis réemployée pour déplacer une caisse et le Voleur en déployant son arrivée.',
  'La chambre finale demande les deux commandes du sceau et le relâchement de l’amarre ; le retrait de celle-ci impose le détour par l’est.',
 ],
 sourceReading:'Heroes and Mirrors 6 inspire le changement de diagonale et le réemploi du miroir après chaque passage. Heroes and Water 7 inspire la différence entre un échange de places et un transport physique ; Water 10 inspire la conservation des relais et l’ordre des caisses. La presse, les circuits et la boucle sont une recomposition propre à SS13 ; aucune règle de dédoublement ni destruction d’appui à la réactivation n’est reprise.',
});

// These explanations and executable local counterfactuals are author-only.
// They are not hints, routes or additional state in the playable game.
design.difficultyNotes={
 role:'Finale de planification : le témoin est une solution construite, pas une preuve de longueur minimale.',
 resources:{crates:4,permanentCrossings:3,mobileMirrors:1,hydraulicCircuits:2,goalButtons:2},
 dependencies:[
  'Le premier appui permet de tracter le miroir jusqu’au poste du rayon coudé.',
  'La presse doit rester ouverte pendant le transport de la deuxième caisse et son reflet.',
  'La deuxième caisse rejoint une arrivée encore alimentée par le poids sud ; le miroir doit emprunter ce passage.',
  'Le parvis hydraulique rend possible le changement de direction du miroir avant la troisième immersion.',
  'Le troisième appui permet de transporter le miroir sur la commande est, puis de revenir quand l’itinéraire hydraulique change.',
  'Après l’échange du poids sud, le Voleur doit dégager la caisse de la visée du Magicien avant que celui-ci puisse quitter son bouton.',
  'Relâcher l’amarre ouvre la porte intérieure et le passage est, mais retire l’arrivée nord et le parvis du miroir.',
  'La presse pousse la caisse et le Voleur sur une arrivée qu’elle déploie dans la même action ; la traction directe est refusée.',
  'L’alcôve nord reçoit la caisse conservée par échange ; le miroir maintient l’autre bouton et les deux héros doivent rentrer.',
 ],
 claims:'Les essais locaux ci-dessous établissent leurs seuls résultats observés. Ils ne prouvent ni unicité, ni optimalité, ni absence de toute autre solution.',
};
function localCounterfactual(label,prepare,command,check){
 const stage=design.stages.find(s=>s.label.startsWith(label));
 if(!stage)throw Error('Missing counterfactual stage: '+label);
 const b=new Author(spec).act(design.commands.slice(0,stage.turn));
 prepare(b);
 const action=decodeCommand(command,b.state);
 const result=stepDetailed(b.world,b.state,action.id,action.data);
 if(!check(result,b))throw Error('Counterfactual changed: '+label);
 return{afterStage:stage.label,startTurn:stage.turn,commands:b.commands.slice(stage.turn)+command,
  observed:{refused:result.state.failed,dead:result.state.dead,complete:result.state.complete,
   phases:result.phases.map(p=>p.kind),heroes:result.state.heroes.map(h=>({kind:h.kind,at:h.at,dead:!!h.dead})),
   stones:result.state.stones,mirrors:result.state.mirrors,supports:result.state.supports,
   circuits:Object.fromEntries(b.world.circuits.map(c=>[c.id,circuitPressed(b.world,result.state,c.id)])),
   platforms:b.world.platforms.map((p,i)=>({at:p.at,active:platformActive(b.world,result.state,i)}))}};
}
design.localCounterfactuals={
 releasePressBeforeSecondReflection:localCounterfactual('Le rayon coudé',b=>b.select('thief').act('L'),'X',r=>r.state.failed&&!r.state.dead),
 removeAnchorBeforeMirrorCrossing:localCounterfactual('Le Magicien recale',b=>{
  b.go(3,10,'wizard').act('D');b.go(3,9,'thief').act('U');b.go(4,9).act('R');
  b.select('wizard').act('U');b.select('thief').act('UUU');
 },'U',r=>r.state.failed&&!r.state.dead),
 skipThirdSupportBeforeMirrorTransport:localCounterfactual('Troisième poste',b=>b.go(13,4,'thief').act('R'),'R',r=>r.state.failed&&!r.state.dead),
 leaveAnchorBeforeClearingCast:localCounterfactual('Le Magicien récupère',()=>{},'U',r=>r.phases[0]?.kind==='swap'&&r.state.stones.some(p=>p.x===3&&p.y===17)),
 walkInsteadOfPiston:localCounterfactual('Avant la presse',()=>{},'R',r=>r.state.failed&&!r.state.dead),
};
writeFileSync(new URL('../level7-design.json',import.meta.url),JSON.stringify(design,null,2)+'\n');
console.log(JSON.stringify({title:design.spec.title,metrics:design.metrics,counterfactuals:Object.keys(design.localCounterfactuals)}));
