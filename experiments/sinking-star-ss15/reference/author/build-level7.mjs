import {Author,board} from './author.mjs';
import {writeFileSync} from 'node:fs';
import {stepDetailed,circuitPressed} from '../../dist/core.js';
import {decodeCommand} from '../../scripts/solver.mjs';
import assert from 'node:assert/strict';

const b=board(20,20,'#');
b.fill(0,0,9,9);b.fill(11,0,18,9);
b.fill(0,11,9,18);b.fill(11,11,18,18);
b.fill(10,0,10,18,'~');b.fill(0,10,18,10,'~');b.put(4,10,'#');
// The sole dry crate must remain a weight on this isolated island.
b.put(5,1,'~');b.put(4,2,'~');b.put(6,2,'~');b.put(5,3,'~');
b.put(2,4,'#');b.put(2,6,'#');
// The Wizard can extract the crate across water, but his rescue ray is gated.
b.fill(14,4,17,4,'#');b.fill(14,6,17,6,'#');
b.put(14,5,'~');b.put(16,5,'#');b.put(17,5,'#');b.put(15,6,'.');
b.fill(15,11,15,18,'#');b.put(15,16,'.');b.fill(16,12,18,12,'#');
b.put(17,14,'g');b.put(17,17,'g');
b.put(5,17,'Z');b.put(3,14,'B');b.put(15,5,'o');b.put(5,10,'s');
export const spec={id:'ss15-07',title:'Le relais des trois rives',rows:b.strings(),facing:'N',
 mirrors:[{at:{x:5,y:5},facing:'NW'},{at:{x:15,y:7},facing:'NW'}],
 circuits:[
  {id:'relais',buttons:[{x:2,y:5}],color:11},
  {id:'depot-miroir',buttons:[{x:13,y:7}],color:15},
  {id:'deux-poids',buttons:[{x:5,y:2},{x:5,y:6}],color:10},
 ],
 gates:[
  {at:{x:15,y:6},circuit:'relais',direction:'N',closedWhen:'released'},
  {at:{x:5,y:5},circuit:'depot-miroir',direction:'S',closedWhen:'pressed'},
  {at:{x:15,y:16},circuit:'deux-poids',direction:'E',closedWhen:'released'},
 ],
};

export function build(){
 const a=new Author(spec);
 const stage=label=>{a.stage(label);if(process.env.SS15_AUTHOR_DEBUG)console.log(label,a.commands.length,JSON.stringify({heroes:a.state.heroes,stones:a.state.stones,supports:a.state.supports,mirrors:a.state.mirrors}));};
 a.go(5,11,'bard').act('UUU');
 a.go(4,11,'wizard').act('RU');
 a.select('bard').act('UU');
 a.go(0,7,'wizard');
 stage('Les deux héros franchissent le bras sud ; l’échange prépare le passage accompagné du Barde.');
 a.go(3,9,'bard').act('RRRRRUU');
 stage('Le seul appui change d’axe et ouvre un passage au sud de la ligne de visée de la réserve.');
 a.go(13,8,'wizard').go(13,5).act('R');
 stage('Le Magicien échange la caisse hors de son îlot et reste prisonnier derrière le passage d’eau.');
 a.select('bard').act('UUU').go(7,5).act('RRRR');
 a.act('LLLLLDLLLDLLUUL');
 stage('La caisse traverse sur l’appui conservé puis ouvre le rayon de secours depuis sa première commande.');
 a.act('X');
 stage('Deux reflets simultanés déposent la caisse sur l’île et sauvent le Magicien ; son arrivée presse le miroir vers son dernier poste.');
 a.go(17,2,'wizard');
 a.go(7,5,'bard').act('RRRR').go(13,4).act('LDDDDDRR');
 stage('Le Barde reprend l’unique appui et le place dans le bras de la chambre finale.');
 a.act('UU').go(12,7).act('DDDD');
 stage('Le Barde franchit le dernier bras en ancrant son arrivée ; le Magicien attend encore au nord.');
 a.go(12,9,'wizard').act('D');
 a.select('bard').act('DD');
 stage('Un dernier échange puis le chant font passer les deux héros sans retirer l’appui sous leurs pieds.');
 a.go(17,17,'bard');
 a.go(17,14,'wizard');
 stage('La caisse et le miroir restent sur les deux commandes ; les deux destinations sont occupées.');
 const design=a.result({
  puzzle:6,label:'Adaptation de Heroes and Mirrors · énigme 6 · préserver la ressource qui ne doit pas couler',
  url:'https://sinkingstarwalkthrough.com/fr/heroes-and-mirrors-solutions/#%C3%A9nigme-6',
  secondaryLabel:'Heroes and Water · énigme 27 · changer l’écart et réemployer un appui',
  secondaryUrl:'https://sinkingstarwalkthrough.com/fr/heroes-and-water-solutions/#%C3%A9nigme-27',
  objective:'Réemployer le seul appui entre les rives, sauver le Magicien et conserver la caisse sèche jusqu’à son dernier poste.',
 },{
  kind:'adaptation',
  preserved:['Mirrors 6 : la ressource sèche doit être conservée pendant un passage obtenu par reflet.','Water 27 : les butées et les changements d’écart permettent de réemployer le même appui immergé.'],
  changed:['La caisse sert d’abord de cible d’échange, puis ouvre le rayon de secours et devient enfin le poids de l’île.','L’échange importe la caisse hors de son îlot mais y enferme le Magicien ; son sauvetage dépend de cette même caisse.','Deux miroirs agissent ensemble : l’arrivée du Magicien déclenche la presse qui dépose l’autre miroir sur une seconde commande.','Un seul appui mobile dessert successivement les trois bras ; les héros doivent synchroniser leurs traversées.','Le chant carré, l’ancrage des appuis et la presse reprennent le contrat SS15 ; aucun empilement ni déplacement double n’est ajouté.'],
  sourceReading:'Les sources fournissent l’économie d’une ressource sèche et le recalage d’un appui. Les quatre rives, le sauvetage coudé, la double réflexion et les circuits sont une composition originale SS15.',
  localCounterfactuals:[],
  proofScope:'La route et les branches locales vérifient leurs seuls résultats exécutés ; aucune unicité, optimalité ou nécessité globale n’est revendiquée.',
 });
 const checks=design.adaptation.localCounterfactuals;
 const at=(p,x,y)=>p.x===x&&p.y===y;
 function branch(label,stageIndex,prepare,commands,expected,meaning){
  const stage=design.stages[stageIndex],trial=new Author(spec).act(design.commands.slice(0,stage.turn));prepare(trial);
  let state=trial.state;const phases=[];
  for(const c of commands){const action=decodeCommand(c,state),d=stepDetailed(trial.world,state,action.id,action.data);state=d.state;phases.push(...d.phases);}
  assert(expected(state,phases),label);
  checks.push({label,afterTurn:stage.turn,commands:trial.commands.slice(stage.turn)+commands,meaning,refused:state.failed,dead:state.dead,complete:state.complete,heroes:state.heroes,stones:state.stones,supports:state.supports,mirrors:state.mirrors,circuits:Object.fromEntries(trial.world.circuits.map(c=>[c.id,circuitPressed(trial.world,state,c.id)])),phases:phases.map(p=>p.kind)});
 }
 branch('rescue-before-its-command',2,()=>{},'X',s=>s.failed&&!s.dead&&at(s.heroes[0].at,15,5),
  'Avant le dépôt sur la commande jaune, la porte coupe le rayon de secours ; le reflet est refusé et le Magicien reste sur son îlot.');
 branch('ordinary-departure-loses-the-only-dry-weight',3,()=>{},'RX',s=>!s.failed&&!s.dead&&s.stones.length===0&&s.supports.some(p=>at(p,5,3))&&at(s.heroes[0].at,15,5),
  'Un pas volontaire du Barde retire la caisse de la commande et change sa distance de reflet. Le reflet suivant la fait couler à côté de l’île et ne sauve pas le Magicien.');
 branch('press-before-the-double-reflection',2,t=>t.select('bard').act('LDRRRRRRU'),'X',s=>s.failed&&!s.dead&&s.mirrors.some(m=>at(m.at,5,6))&&!circuitPressed(a.world,s,'deux-poids'),
  'Atteindre prématurément la commande de presse déplace le miroir avant le dépôt sur l’île. Cette tentative de reflet ne remplit aucune des deux commandes finales.');
 branch('shift-the-ferry-before-the-wizard',5,t=>t.act('R').go(12,9,'wizard'),'D',s=>s.failed&&!s.dead&&s.supports.some(p=>at(p,13,10)),
  'Un décalage supplémentaire du chant éloigne l’appui du passage choisi par le Magicien ; son pas direct vers l’eau est refusé.');
 branch('bard-arrival-moves-the-wizard-off-his-goal',7,t=>t.go(17,14,'wizard').go(17,17,'bard'),'',s=>!s.failed&&!s.dead&&!s.complete&&at(s.heroes[1].at,17,17)&&!at(s.heroes[0].at,17,14),
  'Cette variante est légale mais ne termine pas la salle : en arrivant après son partenaire, le Barde le déplace hors de sa destination. Le Magicien reste jouable pour corriger sa place.');
 design.difficultyNotes={role:'Finale de sauvetage et de conservation avec trois usages de la caisse.',resources:{dryCrates:1,submergedSupports:1,mirrors:2,finalWeights:2},referencePlanDependencies:design.stages.map(s=>s.label),claimScope:'Dépendances du plan auteur et résultats locaux uniquement. Les variantes légales restent acceptées.'};
 return design;
}
if(process.argv[1]?.endsWith('build-level7.mjs')){
 const design=build();writeFileSync(new URL('../level7-design.json',import.meta.url),JSON.stringify(design,null,2)+'\n');
 console.log(JSON.stringify({title:design.spec.title,metrics:design.metrics,stages:design.stages.length,localCounterfactuals:design.adaptation.localCounterfactuals.length}));
}
