/** Review the shipped action lists directly, without calling the author solver or route builders. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {compileLevel,initialState,stepDetailed,circuitPressed,platformActive,terrainAt,cellToPixel,traceSwap,equal} from '../../dist/core.js';
import {SS21_LEVELS} from '../../dist/levels.js';

const checks=[],levels=[];
const roles=['merchant','thief','warrior','wizard'];
const pos=p=>`${p.x},${p.y}`;
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const ok=(level,name,observed,scope='Causalité du parcours qualifié, sans affirmation de solution unique ou de capacité universellement indispensable.')=>checks.push({level,name,status:'passed',observed,scope});
const terrainComponent=(world,seed)=>{
 const queue=[seed],seen=new Set([pos(seed)]);
 for(let i=0;i<queue.length;i++)for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){
  const p={x:queue[i].x+dx,y:queue[i].y+dy};if(terrainAt(world,p)!=='.'||seen.has(pos(p)))continue;seen.add(pos(p));queue.push(p);
 }
 return seen;
};
const selectWizard=(world,state)=>stepDetailed(world,state,6,cellToPixel(state.heroes.find(h=>h.kind==='wizard').at)).state;

assert.equal(SS21_LEVELS.length,8);
for(const[index,spec]of SS21_LEVELS.entries()){
 const n=index+1,design=JSON.parse(readFileSync(new URL(`../level${n}-design.json`,import.meta.url)));
 assert.deepEqual(spec,design.spec);const world=compileLevel(spec),initial=initialState(world);let state=initial;
 assert.equal(world.goals.length,4);assert.equal(new Set(world.goals.map(pos)).size,4);assert.deepEqual(state.heroes.map(h=>h.kind).sort(),roles);
 assert(!state.dead&&!state.complete);assert(state.heroes.every(h=>!world.goals.some(g=>equal(g,h.at))));
 const timeline=[];
 for(const[i,action]of design.actions.entries()){
  assert(!state.complete,'The route must stop at the first completion');const before=state,detail=stepDetailed(world,state,action.id,action.data);state=detail.state;
  assert(!state.failed&&!state.dead,`${spec.id}: invalid action ${i+1}`);assert.deepEqual(state.heroes.map(h=>h.kind).sort(),roles);
  const occupied=world.goals.filter(g=>state.heroes.some(h=>!h.dead&&equal(h.at,g))).length;
  assert.equal(state.complete,occupied===4,`${spec.id}: completion follows the four occupied destinations`);
  timeline.push({turn:i+1,action,before,after:state,phases:detail.phases});
 }
 assert(state.complete);assert.equal(world.goals.filter(g=>timeline.at(-1).before.heroes.some(h=>equal(h.at,g))).length,3);
 const phases=timeline.flatMap(t=>t.phases.map(p=>({turn:t.turn,...p}))),events=kind=>phases.filter(p=>p.kind===kind);
 levels.push({level:n,title:spec.title,actions:design.actions.length,selections:design.actions.filter(a=>a.id===6).length,mapSha256:hash(spec),actionSha256:hash(design.actions),finalDestinations:state.heroes.map(h=>({role:h.kind,at:h.at})),complete:true,refused:0,deaths:0});
 ok(n,'La quatrième destination déclenche exactement la victoire',{actions:design.actions.length,goalsBeforeLastAction:3,goalsAfterLastAction:4,roles},'Vérification directe de tous les états du parcours livré, distincte de son outil de construction.');

 if(n===1){
  const encounter=timeline.find(t=>t.phases.some(p=>p.kind==='piston')&&t.phases.some(p=>p.kind==='combat'));assert(encounter);
  assert.equal(encounter.before.monsters.length,2);assert.equal(encounter.after.monsters.length,0);
  assert(events('push').some(p=>p.moves.filter(m=>m.actor==='hero').length===2&&p.moves.filter(m=>m.actor==='stone').length===2));
  assert(state.supports.some(p=>equal(p,{x:13,y:4})));assert(circuitPressed(world,state,'sorties'));
  ok(n,'L’atelier lie les capacités, l’eau, le combat et les sorties',{mixedFileObserved:true,combatTurn:encounter.turn,combatCause:encounter.phases.map(p=>p.kind),exitWeights:world.circuits.find(c=>c.id==='sorties').buttons});
 }
 if(n===2){
  const cells=[{x:2,y:3},{x:16,y:12}];for(const p of cells){assert.equal(terrainComponent(world,p).size,1);for(const t of timeline)assert.equal(t.after.heroes.filter(h=>equal(h.at,p)).length+t.after.stones.filter(q=>equal(q,p)).length,1);assert(state.stones.some(q=>equal(q,p)));}
  assert.equal(events('swap').length,4);assert.equal(state.stones.length,3);assert(circuitPressed(world,state,'retour'));
  ok(n,'Les chambres gardent leurs occupants mais changent de nature',{isolatedCells:cells,swaps:4,finalChamberOccupants:'two crates',finalDryWeight:{x:9,y:15}},'Conservation observée pour tous les états de ce parcours ; aucun pont ni miroir n’y est utilisé.');
 }
 if(n===3){
  const entered=[];
  for(const goal of world.goals){const component=terrainComponent(world,goal);assert.equal(component.size,2);assert(initial.heroes.every(h=>!component.has(pos(h.at))));
   const arrivals=events('reflect').flatMap(p=>p.moves.filter(m=>m.actor==='hero'&&!component.has(pos(m.from))&&component.has(pos(m.to))).map(m=>({turn:p.turn,from:m.from,to:m.to,role:p.before.heroes.find(h=>equal(h.at,m.from)).kind})));
   assert.equal(arrivals.length,1);entered.push(arrivals[0]);
  }
  assert.deepEqual(entered.map(a=>a.role).sort(),roles);assert.equal(initial.stones.length,0);assert.equal(world.platforms.length,0);
  ok(n,'Chaque balcon reçoit son premier héros par reflet',{arrivals:entered,mirrorMoves:phases.flatMap(p=>p.moves).filter(m=>m.actor==='mirror').length},'La géométrie des balcons et les premières arrivées sont vérifiées, sans prétendre imposer l’ordre du témoin.');
 }
 if(n===4){
  const injection=events('piston').find(p=>p.moves.some(m=>m.actor==='stone'));assert(injection);
  const before=traceSwap(world,selectWizard(world,injection.before),'E'),after=traceSwap(world,selectWizard(world,injection.after),'E');
  assert(before.loop&&!before.plan);assert(!after.loop&&after.plan?.target==='stone');assert.deepEqual(after.plan.to,{x:13,y:9});
  const actual=events('swap').find(p=>p.turn>injection.turn);assert(actual.moves.some(m=>m.actor==='hero'&&equal(m.to,after.plan.to)));
  assert.equal(state.stones.length,1);assert(circuitPressed(world,state,'cour'));
  ok(n,'La presse transforme la boucle en visée exploitable',{injectionTurn:injection.turn,moves:injection.moves,beforeLoop:true,afterTarget:after.plan.to,exchangeTurn:actual.turn,finalWeight:state.stones[0]});
 }
 if(n===5){
  const buttons=world.circuits.find(c=>c.id==='double-serrure').buttons;
  const relays=events('swap').filter(p=>p.moves.some(m=>buttons.some(b=>equal(b,m.from))));assert.equal(relays.length,3);
  for(const p of relays){assert(circuitPressed(world,p.before,'double-serrure'));assert(circuitPressed(world,p.after,'double-serrure'));assert(!p.before.gateClosed[0]&&!p.after.gateClosed[0]);}
  const last=events('swap').at(-1);assert(last.moves.every(m=>m.actor==='hero'));assert(last.before.stones.some(p=>equal(p,{x:13,y:5})));assert(last.after.stones.some(p=>equal(p,{x:13,y:5})));
  ok(n,'Les relèves conservent la double commande puis protègent le dernier poids',{relayTurns:relays.map(p=>p.turn),lastSwap:last.moves,protectedWeight:{x:13,y:5}});
 }
 if(n===6){
  for(const t of timeline)assert.equal(t.after.stones.length+t.after.supports.length,4);
  assert.deepEqual(state.supports,[{x:7,y:5},{x:10,y:9},{x:13,y:12}]);assert.deepEqual(state.stones,[{x:11,y:11}]);assert(circuitPressed(world,state,'arrivee'));
  const conversions=timeline.filter(t=>t.after.supports.length>t.before.supports.length);assert.equal(conversions.length,3);
  ok(n,'La réserve totale devient trois appuis et un poids',{conversions:conversions.map(t=>({turn:t.turn,newSupport:t.after.supports.find(p=>!t.before.supports.some(q=>equal(p,q)))})),dryWeight:state.stones[0]});
 }
 if(n===7){
  const monsterDrop=timeline.find(t=>t.before.monsters.length===1&&t.after.monsters.length===0);assert(monsterDrop);
  assert(platformActive(world,monsterDrop.before,0)&&!platformActive(world,monsterDrop.after,0));assert.deepEqual(monsterDrop.before.monsters,[{x:10,y:9}]);
  const conversion=timeline.find(t=>t.after.supports.length>t.before.supports.length);assert(conversion);assert(platformActive(world,conversion.before,0)&&!platformActive(world,conversion.after,0));assert(conversion.before.stones.some(p=>equal(p,{x:10,y:9})));
  assert.deepEqual(state.supports,[{x:10,y:9}]);assert.deepEqual(state.stones,[{x:9,y:4},{x:11,y:4}]);assert(circuitPressed(world,state,'fronton'));
  ok(n,'Deux retraits produisent deux résultats matériels distincts',{monsterDropTurn:monsterDrop.turn,crateConversionTurn:conversion.turn,permanentSupport:state.supports[0],dryWeights:state.stones},'Un gardien disparaît sans soutien ; une caisse se transforme en appui fixe.');
 }
 if(n===8){
  const pressMoves=events('piston').flatMap(p=>p.moves);assert.deepEqual(pressMoves,[{actor:'monster',from:{x:12,y:7},to:{x:13,y:7}},{actor:'monster',from:{x:13,y:7},to:{x:14,y:7}}]);
  assert(timeline.every(t=>t.after.monsters.length===1));assert(timeline.every(t=>t.after.stones.length+t.after.supports.length===3));assert(circuitPressed(world,state,'arrivee'));
  const reflections=events('reflect');assert.equal(reflections.length,2);assert(reflections[0].moves.some(m=>m.actor==='stone'));assert(reflections[1].moves.some(m=>m.actor==='hero'));
  ok(n,'La ressource optique et le gardien complètent le verrou',{pressMoves,crateReflectionTurn:reflections[0].turn,heroReflectionTurn:reflections[1].turn,dryCrates:state.stones,monsterWeight:state.monsters[0],support:state.supports[0]});
 }
}
const report={game:'SS21',success:true,method:'Rejeu direct des listes d’actions du livrable avec stepDetailed, sans Author, solve ni les commandes textuelles du solveur ; examen de la causalité des phases.',levels,checks,limits:['La revue ne recherche pas exhaustivement toutes les solutions.','Une séquence réussie et ses effets ne prouvent ni optimalité, ni difficulté minimale, ni unicité.','Les preuves portent sur la solvabilité des cartes, la victoire matérielle et les dépendances observées dans les parcours qualifiés.']};
writeFileSync(new URL('../independent-ss21-review.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({success:true,levels:levels.length,checks:checks.length,passed:checks.length,report:'reference/independent-ss21-review.json'}));
