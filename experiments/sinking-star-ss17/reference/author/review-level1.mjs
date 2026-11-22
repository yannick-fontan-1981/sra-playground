/** Author-only review: an observed alternative is evidence against necessity. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {compileLevel,initialState,stepDetailed,TrioPuzzleSession,terrainAt,supported} from '../../dist/core.js';
import {lessonIds,observeLesson} from '../../dist/tutorial.js';
import {decodeCommand,replay,stateKey} from '../../scripts/solver.mjs';

const design=JSON.parse(readFileSync(new URL('../level1-design.json',import.meta.url),'utf8'));
const {spec}=design,reference=replay(spec,design.commands);
assert.equal(design.commands.length,120);assert.equal(reference.state.complete,true);assert.equal(reference.metrics.blocked,0);assert.equal(reference.metrics.deaths,0);
const world=compileLevel(spec),start=initialState(world),session=new TrioPuzzleSession([spec]);
const learned=new Set(),events=[];let state=start,before=session.observe();
for(const [i,c] of [...design.commands].entries()){
 const a=decodeCommand(c,state),known=new Set(learned),after=session.action(a.id,a.data);observeLesson(learned,before,after,a.id);
 state=stepDetailed(world,state,a.id,a.data).state;
 for(const id of learned)if(!known.has(id))events.push({turn:i+1,command:c,id});before=after;
}
assert.equal(lessonIds.length,23);assert.deepEqual([...learned].sort(),[...lessonIds].sort());

// A constructive counterexample: the guards can be transported to become
// reserve targets and a final weight instead of being killed by the press.
const commands='URRRDRRCCDLDLCRDUUULXURDDCCRCULCCXDXUUUULCCRRULUUUULLUUUURRRRULURRDCLCCULCXRXRRDCRDDXDDCDRXDCCDRDDDDDRDDDLLCDDRDDDDDRDDDRRCDDDDDDD';
const alternate=replay(spec,commands);
assert.equal(commands.length,130);assert.equal(alternate.state.complete,true);assert.equal(alternate.metrics.blocked,0);assert.equal(alternate.metrics.deaths,0);
assert.equal(alternate.metrics.platformsCreated,0);assert.equal(alternate.metrics.chainPushes,0);assert.equal(alternate.metrics.pistonPushes,0);assert.equal(alternate.metrics.monstersRemoved,0);
assert.equal(alternate.metrics.swaps,7);assert.equal(alternate.metrics.monsterSwaps,4);assert.equal(alternate.metrics.reflections,7);
const alternative={level:spec.id,kind:'observed-alternative',commands,actions:alternate.actions,metrics:alternate.metrics,finalState:alternate.state,
 explanation:'Le Magicien fait entrer le Guerrier à travers la tranchée. Après déplacement du miroir, des échanges et reflets successifs utilisent les gardiens comme cibles de réserve. Le trio rejoint la cour sans appui ; un monstre assure la relève du bouton distant. Cette solution emploie davantage d’actions que le témoin pédagogique.',
 conclusion:'Le pont, les poussées en chaîne et l’élimination des gardiens ne sont pas des nécessités globales de cette carte. Le témoin de 120 actions les enseigne, mais une autre stratégie valide les évite.'};
writeFileSync(new URL('../level1-alternative.json',import.meta.url),JSON.stringify(alternative,null,2)+'\n');

// Exhaust every ordinary-walk state of one initial hero with other actors fixed.
// Reject all pushes, pulls, swaps, reflections and forced cascades.
const walking=[];
for(let active=0;active<start.heroes.length;active++){
 const first={...start,active},queue=[first],seen=new Set([stateKey(first)]);let reachesAnyGoal=false;
 for(let head=0;head<queue.length;head++)for(const id of [1,2,3,4]){
  const detail=stepDetailed(world,queue[head],id),s=detail.state;
  if(s.failed||s.dead||detail.phases.some(p=>p.kind!=='walk'))continue;
  const h=s.heroes[active];if(world.goals.some(p=>p.x===h.at.x&&p.y===h.at.y))reachesAnyGoal=true;
  const key=stateKey(s);if(!seen.has(key)){seen.add(key);queue.push(s);}
 }
 assert.equal(reachesAnyGoal,false);walking.push({hero:start.heroes[active].kind,states:seen.size,reachesAnyGoal,exhaustive:true,otherActors:'fixed'});
}
// Strengthen the initial walking finding with a generous static reachability
// graph: all doors/presses open and all other actors/mirrors ignored. It permits
// more walking than the real game; no destination is connected even here.
const generousWalking=[];
for(const hero of start.heroes){
 const queue=[hero.at],seen=new Set([`${hero.at.x},${hero.at.y}`]);
 for(let head=0;head<queue.length;head++)for(const [dx,dy] of [[0,-1],[0,1],[-1,0],[1,0]]){
  const p={x:queue[head].x+dx,y:queue[head].y+dy},key=`${p.x},${p.y}`;
  if(seen.has(key)||terrainAt(world,p)==='#'||!supported(world,start,p))continue;seen.add(key);queue.push(p);
 }
 const reachesAnyGoal=world.goals.some(p=>seen.has(`${p.x},${p.y}`));assert.equal(reachesAnyGoal,false);
 generousWalking.push({hero:hero.kind,cells:seen.size,reachesAnyGoal,exhaustive:true});
}
const immediateReflection=stepDetailed(world,start,5);assert.equal(immediateReflection.state.failed,true);assert.deepEqual(immediateReflection.phases,[]);assert.deepEqual(immediateReflection.blockedMirrorIndices,[0]);
const report={level:spec.id,
 reference:{actions:design.commands.length,complete:reference.state.complete,metrics:reference.metrics,lessons:learned.size,expectedLessons:lessonIds.length,missing:lessonIds.filter(id=>!learned.has(id)),firstDiscoveries:events},
 alternative:{file:'reference/level1-alternative.json',actions:commands.length,complete:alternate.state.complete,metrics:alternate.metrics},
 initialWalking:{perHero:walking,generousGraph:generousWalking,model:'Initial terrain and supports; every door or press treated as open; other occupants and mirrors ignored. This overapproximation still contains no reachable goal.'},
 initialGlobalReflection:{refused:true,blockedMirrorIndices:immediateReflection.blockedMirrorIndices,worldMoved:false},
 conclusions:[
 'Les 23 découvertes se déclenchent depuis les images publiques du témoin pédagogique de 120 actions.',
 'Aucune destination n’est accessible depuis les positions initiales par marche seule, même en ouvrant toutes les portes et en ignorant les autres occupants.',
 'Une variante gagnante de 130 actions évite les appuis, les chaînes et la presse en exploitant quatre échanges de monstres.',
 'Les objectifs exigent de réorganiser les trois cours et de maintenir les boutons ; le tutoriel ne verrouille aucune stratégie autorisée par le moteur.'
 ],limits:[
 'Aucune preuve de longueur minimale ni recherche exhaustive sur l’ensemble des actions de la carte.',
 'L’exhaustivité concerne uniquement les graphes de marche initiale explicitement décrits.',
 'Les interactions présentes dans un témoin ne sont pas automatiquement nécessaires dans toutes les solutions.'
 ]};
writeFileSync(new URL('../level1-review.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({level:report.level,referenceActions:report.reference.actions,lessons:report.reference.lessons,alternativeActions:report.alternative.actions,walking:report.initialWalking.perHero.map(p=>({hero:p.hero,states:p.states,reachesAnyGoal:p.reachesAnyGoal}))}));
