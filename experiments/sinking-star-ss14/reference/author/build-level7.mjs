import {Author,board} from './author.mjs';
import {writeFileSync} from 'node:fs';
import {stepDetailed,circuitPressed} from '../../dist/core.js';
import {decodeCommand} from '../../scripts/solver.mjs';
import assert from 'node:assert/strict';

// One submerged stone is the ferry for three different arms of the water cross.
// The only dry crate and the only mirror must survive as the two final weights.
const b=board(20,20,'#');
b.fill(0,0,9,9);b.fill(11,0,18,9);
b.fill(0,11,9,18);b.fill(11,11,18,18);
b.fill(10,0,10,18,'~');b.fill(0,10,18,10,'~');b.put(4,10,'#');
// A weight can reach this island only by reflection, without being immersed.
b.put(5,1,'~');b.put(4,2,'~');b.put(6,2,'~');b.put(5,3,'~');
b.put(2,4,'#');b.put(2,6,'#');
// The north-east cargo is boxed in behind the distant mirror's command.
b.fill(14,4,17,4,'#');b.fill(14,6,17,6,'#');b.put(17,5,'#');
// Goal room: its one entrance is controlled by both preserved weights.
b.fill(15,11,15,18,'#');b.put(15,16,'.');b.fill(16,12,18,12,'#');
b.put(17,14,'g');b.put(17,17,'g');
b.put(5,17,'T');b.put(3,14,'B');b.put(15,5,'o');b.put(5,10,'s');
const spec={id:'ss14-07',title:'La pierre des trois traversées',rows:b.strings(),facing:'N',
 mirrors:[{at:{x:5,y:15},facing:'NW'}],
 circuits:[
  {id:'reserve',buttons:[{x:5,y:15}],color:11},
  {id:'deux-poids',buttons:[{x:5,y:2},{x:5,y:5}],color:10},
 ],
 gates:[
  {at:{x:13,y:5},circuit:'reserve',direction:'E',closedWhen:'released'},
  {at:{x:15,y:16},circuit:'deux-poids',direction:'E',closedWhen:'released'},
 ],
};
const a=new Author(spec);
const checks=[];
function probe(label,commands,expected,meaning){let state=a.state;const phases=[];for(const command of commands){const action=decodeCommand(command,state),d=stepDetailed(a.world,state,action.id,action.data);state=d.state;phases.push(...d.phases);}assert(expected(state,phases),label);checks.push({label,afterTurn:a.commands.length,commands,meaning,refused:state.failed,dead:state.dead,stones:state.stones,supports:state.supports,mirrors:state.mirrors});}
a.go(5,11,'bard').act('UU').stage('Le Barde franchit le premier bras ; le miroir garde la réserve ouverte à distance.');
a.go(3,9).act('RRRRRUUUUU').stage('Le même appui change deux fois d’axe et dessert désormais la réserve nord-est.');
a.act('L').go(7,5).act('RRRR').go(13,5).stage('Le Barde atteint la caisse par le passage maintenu par le miroir resté au sud.');
a.act('LLLLLLLLLLLLL').stage('La caisse traverse sur l’appui conservé et rejoint le rayon ouest du futur miroir.');
a.act('DDD').go(8,3).act('DDDDD').act('LLLLL').stage('Le Barde ramène le seul appui au bras initial ; la caisse est retenue entre deux murs.');
a.go(5,14,'thief').act('UUUU').stage('Le Voleur occupe l’appui et l’ancre pendant que le miroir attend derrière lui.');
probe('anchor-keeps-the-ferry','CL',s=>!s.dead&&!s.failed&&s.supports.some(p=>p.x===5&&p.y===10), 'Le pas latéral du Barde laisse l’appui occupé en place ; le mur ouest retient aussi le Voleur.');
a.select('bard').act('L').go(0,8).stage('Le Barde s’écarte sans déplacer l’appui sous son partenaire.');
a.select('thief').act('UUUUUU').act('R').stage('Le miroir franchit l’appui, ferme la réserve et devient le second poids final.');
a.act('X').stage('La caisse conservée atteint l’île de commande par le reflet du miroir réemployé.');
a.go(8,5,'thief');
a.go(3,9,'bard').act('RRRRRUUUU').stage('L’appui sert à nouveau : les deux héros doivent encore rejoindre la rive des destinations.');
a.go(17,2,'thief').stage('Le Voleur a franchi le bras nord avant son retrait.');
a.select('bard').act('L').go(7,6).act('RRRR');
a.go(12,4,'bard').act('DDDDRRR').stage('L’appui quitte le passage nord et se place dans le troisième bras, vers la chambre finale.');
a.go(17,14,'thief');
a.select('bard').act('U').go(13,7).act('DDDD').go(13,16).stage('Le Barde arrive au sud-est ; les deux poids restent à l’écart de son chant.');
a.go(17,17,'bard');
a.go(17,14,'thief').stage('Les deux partenaires atteignent leurs destinations avec la caisse et le miroir encore sur les commandes.');
const design=a.result({
 puzzle:27,label:'Adaptation de Heroes and Water · énigme 27 · changer l’écart entre le Barde et l’appui',
 url:'https://sinkingstarwalkthrough.com/fr/heroes-and-water-solutions/#%C3%A9nigme-27',
 secondaryLabel:'Heroes and Mirrors · énigmes 1 et 4 · conserver un poids et réemployer le miroir tracté',
 secondaryUrl:'https://sinkingstarwalkthrough.com/fr/heroes-and-mirrors-solutions/',
 objective:'Un seul appui dessert les trois bras de la rivière. Faites voyager les bonnes ressources avant de rejoindre la chambre des deux destinations.',
 },{
 kind:'adaptation',
 preserved:['Water 27 : les obstacles permettent de modifier l’écart entre le Barde et un appui immergé avant de lui faire changer d’axe.','Mirrors 4 : le miroir est tracté entre plusieurs positions et doit être laissé en place après son dernier emploi.','Mirrors 1 : une ressource reste sur sa commande pendant le départ des héros.'],
 changed:['Une seule pierre immergée est réemployée entre les trois bras d’un réseau en croix.','Le miroir maintient d’abord la réserve ouverte, franchit ensuite le passage initial et sert enfin au reflet et au second poids.','La caisse doit rester sèche pour atteindre par reflet une île inaccessible à la traction.','Les deux héros traversent avant chaque retrait du passage utile ; les appuis occupés restent ancrés conformément aux règles de SS14.'],
 sourceReading:'Water 27 fournit le transport d’un cristal immergé et le recalage par les murs. Mirrors 4 fournit le réemploi du miroir tracté ; Mirrors 1 la conservation d’une commande lors du départ. La carte, les circuits, l’île de réception et la contrainte d’une seule pierre sont originaux. Aucun déplacement double ni pouvoir d’un autre héros n’est repris.',
 localCounterfactuals:checks,
 proofScope:'Les branches locales et la route témoin établissent leurs seuls résultats exécutés. Elles ne prouvent ni unicité ni longueur minimale.',
});
design.difficultyNotes={role:'Finale de conservation et de transport couplé, sans longueur minimale revendiquée.',resources:{dryCrates:1,submergedSupports:1,mobileMirrors:1,finalWeights:2},referencePlanDependencies:['Conserver le miroir sur la réserve pendant la sortie de la seule caisse.','Déplacer la pierre dans le bras nord puis la ramener pour le miroir.','Préserver la caisse sèche pour le reflet vers son île.','Réutiliser le même miroir comme poids et comme angle de transport.','Faire franchir le bras nord aux deux héros avant de retirer son unique appui.','Acheminer la même pierre vers le troisième bras pour le départ final.']};
function branch(label,stagePrefix,prepare,commands,expected,meaning){
 const stage=design.stages.find(s=>s.label.startsWith(stagePrefix));assert(stage,label);
 const trial=new Author(spec).act(design.commands.slice(0,stage.turn));prepare(trial);
 let state=trial.state;const phases=[];
 for(const c of commands){const action=decodeCommand(c,state),d=stepDetailed(trial.world,state,action.id,action.data);state=d.state;phases.push(...d.phases);}
 assert(expected(state,phases,trial),label);
 checks.push({label,afterTurn:stage.turn,commands:trial.commands.slice(stage.turn)+commands,meaning,refused:state.failed,dead:state.dead,complete:state.complete,heroes:state.heroes,stones:state.stones,supports:state.supports,mirrors:state.mirrors,circuits:Object.fromEntries(trial.world.circuits.map(c=>[c.id,circuitPressed(trial.world,state,c.id)])),phases:phases.map(p=>p.kind)});
}
branch('remove-mirror-with-bard-in-vault','Le Barde atteint la caisse',t=>t.go(5,14,'thief').act('U').select('bard'),'L',s=>s.failed&&!s.dead&&!circuitPressed(a.world,s,'reserve'), 'Retirer ici le miroir ferme la réserve et presse le Barde à l’intérieur ; son essai de retour par la porte est refusé. Une autre relève de poids n’est pas exclue.');
branch('withdraw-north-support-before-thief','L’appui sert à nouveau',t=>t.select('bard').act('D').go(9,6,'thief'),'R',s=>s.failed&&!s.dead&&s.supports.some(p=>p.x===10&&p.y===7),'Déplacer l’appui d’une ligne avant la traversée laisse l’arrivée nord choisie sans soutien ; ce pas du Voleur est refusé.');
branch('wrong-distance-immerses-final-crate','Le miroir franchit l’appui',t=>t.go(3,7,'bard').act('R'),'X',s=>!s.dead&&!s.failed&&!s.stones.length&&s.supports.some(p=>p.x===5&&p.y===3),'Décaler la caisse d’une case change sa distance de reflet : elle devient un appui dans l’eau voisine au lieu d’un poids sur l’île.');
design.difficultyNotes.claimScope='Ces dépendances décrivent le plan de référence. Le miroir sur la réserve et la caisse sur l’île peuvent être relayés temporairement par un héros dans des branches distinctes ; aucune unicité n’est revendiquée.';
writeFileSync(new URL('../level7-design.json',import.meta.url),JSON.stringify(design,null,2)+'\n');
console.log(JSON.stringify({title:design.spec.title,metrics:design.metrics,stages:design.stages.length,localCounterfactuals:checks.length}));
