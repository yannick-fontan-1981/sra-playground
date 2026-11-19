import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {compileLevel} from '../dist/core.js';

// This proof explores a permissive terrain graph, never tuples of game actors.
// A failed reachability search in that larger graph excludes every legal play.
const root=new URL('../',import.meta.url);
const design=JSON.parse(await readFile(new URL('reference/level6-design.json',root),'utf8'));
const world=compileLevel(design.spec),size=20;
const offset={x:Math.floor((size-design.spec.rows[0].length)/2),y:Math.floor((size-design.spec.rows.length)/2)};
const index=p=>p.y*size+p.x;
const sourceIndex=(x,y)=>(y+offset.y)*size+x+offset.x;
const sourcePoint=i=>({x:i%size-offset.x,y:Math.floor(i/size)-offset.y});
const neighbors=Array.from({length:size*size},(_,i)=>[
  i%size>0?i-1:-1,i%size<size-1?i+1:-1,
  i>=size?i-size:-1,i<size*(size-1)?i+size:-1,
].filter(j=>j>=0));
const startHeroes=world.heroes.map(h=>index(h.at)),startMirror=index(world.mirrors[0].at);
const goals=world.goals.map(index),gate=sourceIndex(9,14),antiBypassWall=sourceIndex(10,13);

// The argument relies on one non-teleportable NE mirror and at most one newly
// submerged crate. Reject any later map change that invalidates these premises.
assert.equal(design.spec.id,'ss07-06');
assert.equal(world.heroes.length,2);
assert.equal(world.stones.length,1);
assert.equal(world.supports.length,0);
assert.equal(world.mirrors.length,1);
assert.equal(world.mirrors[0].facing,'NE');
assert.equal(world.platforms.length,0);
assert.equal(world.doors.length,0);
assert.equal(world.gates.length,1);
assert.equal(index(world.gates[0].at),gate);
assert.equal(world.gates[0].closedWhen,'released');
assert.equal(world.gates[0].direction,'S');
assert.equal(world.circuits.length,1);
assert.equal(world.circuits[0].id,world.gates[0].circuit);
assert.deepEqual(world.circuits[0].buttons.map(index),[sourceIndex(6,4)]);
assert.equal(world.terrain[antiBypassWall],'#');
assert.deepEqual(goals.map(sourcePoint).sort((a,b)=>a.x-b.x),[{x:14,y:14},{x:16,y:14}]);
assert.equal(world.terrain[sourceIndex(12,10)],'.');
for(let x=11;x<=17;x++)assert.equal(world.terrain[sourceIndex(x,14)],'.');
for(let y=0;y<design.spec.rows.length;y++)for(let x=11;x<design.spec.rows[0].length;x++){
  if(y===14&&x<=17||x===12&&y===10)continue;
  assert.notEqual(world.terrain[sourceIndex(x,y)],'.','The final island must remain one horizontal line, apart from the isolated monster relay.');
}

function terrainReachability(terrain,gateClosed,extraSupport) {
  const rayPassable=i=>terrain[i]!=='#'&&(!gateClosed||i!==gate);
  const supported=i=>rayPassable(i)&&(terrain[i]==='.'||i===extraSupport);
  assert.ok(startHeroes.every(supported));assert.ok(supported(startMirror));

  // The only mirror can move freely anywhere in its supported component.
  // This grants repositioning even where no hero could actually push or pull it.
  const mirrorPositions=new Set([startMirror]),mirrorQueue=[startMirror];
  for(let k=0;k<mirrorQueue.length;k++)for(const to of neighbors[mirrorQueue[k]]){
    if(supported(to)&&!mirrorPositions.has(to)){mirrorPositions.add(to);mirrorQueue.push(to);}
  }

  // Grant both directions of every NE reflection from every possible mirror
  // position. Ignore occupants, distance priority, combat and simultaneity.
  // Water may lie along a ray, but a living hero needs a supported endpoint.
  const reflections=new Map();
  const addReflection=(from,to,mirror)=>{
    if(!reflections.has(from))reflections.set(from,new Map());
    if(!reflections.get(from).has(to))reflections.get(from).set(to,mirror);
  };
  for(const mirror of mirrorPositions){
    const x=mirror%size,y=Math.floor(mirror/size);
    for(let distance=1;distance<=Math.min(y,size-1-x);distance++){
      const north=mirror-size*distance,east=mirror+distance;
      if(!rayPassable(north)||!rayPassable(east))break;
      if(supported(north)&&supported(east)){
        addReflection(north,east,mirror);addReflection(east,north,mirror);
      }
    }
  }

  const reached=new Set(startHeroes),queue=[...startHeroes],parents=new Map();
  const visit=(from,to,kind,mirror)=>{
    if(reached.has(to))return;
    reached.add(to);queue.push(to);parents.set(to,{from,kind,...(mirror===undefined?{}:{mirror})});
  };
  for(let k=0;k<queue.length;k++){
    const from=queue[k];
    for(const to of neighbors[from])if(supported(to))visit(from,to,'walk');
    for(const [to,mirror] of reflections.get(from)??[])visit(from,to,'reflect',mirror);
  }
  const reachableGoals=goals.filter(g=>reached.has(g));
  const abstractPaths=reachableGoals.map(goal=>{
    const steps=[];let at=goal;
    while(parents.has(at)){
      const edge=parents.get(at);
      steps.push({kind:edge.kind,from:sourcePoint(edge.from),to:sourcePoint(at),
        ...(edge.mirror===undefined?{}:{mirror:sourcePoint(edge.mirror)})});
      at=edge.from;
    }
    return {start:sourcePoint(at),goal:sourcePoint(goal),steps:steps.reverse()};
  });
  return {mirrorPositions:mirrorPositions.size,heroReachableCells:reached.size,
    reflectionEdges:[...reflections.values()].reduce((n,r)=>n+r.size,0),
    reachableGoals:reachableGoals.map(sourcePoint),abstractPaths};
}

function supportChoices(terrain){
  return [null,...terrain.flatMap((cell,i)=>cell==='~'?[i]:[])];
}
function findReachableControl(terrain,gateClosed){
  let tried=0;
  for(const support of supportChoices(terrain)){
    tried++;
    const result=terrainReachability(terrain,gateClosed,support);
    if(result.reachableGoals.length)return {triedSupportChoices:tried,
      extraSupport:support===null?null:sourcePoint(support),...result};
  }
  return null;
}

const cases=[];
for(const support of supportChoices(world.terrain)){
  const {abstractPaths,...result}=terrainReachability(world.terrain,true,support);
  assert.deepEqual(result.reachableGoals,[],`Green gate bypass with support ${JSON.stringify(support===null?null:sourcePoint(support))}`);
  cases.push({extraSupport:support===null?null:sourcePoint(support),...result});
}

// Positive controls show that the graph detects the intended opening and the
// real geometric loophole that the single additional wall closes.
const openedGate=findReachableControl(world.terrain,false);
assert.ok(openedGate);assert.equal(openedGate.reachableGoals.length,2);
const withoutWall=[...world.terrain];withoutWall[antiBypassWall]='~';
const removedWall=findReachableControl(withoutWall,true);
assert.ok(removedWall);assert.equal(removedWall.reachableGoals.length,2);
assert.deepEqual(removedWall.extraSupport,{x:11,y:13});

const report={
  game:'SS07',level:6,title:design.spec.title,
  mapSha256:createHash('sha256').update(JSON.stringify(design.spec)).digest('hex'),
  coordinateSystem:'LevelSpec source coordinates before centering; x increases right, y increases down.',
  geometry:{greenGate:{x:9,y:14},antiBypassWall:{x:10,y:13},
    finalIsland:{row:14,fromX:11,toX:17},goals:goals.map(sourcePoint),monsterRelay:{x:12,y:10}},
  method:'Exhaustive support-placement enumeration on a permissive terrain-and-reflection graph; no actor-state BFS.',
  model:{
    gateForcedClosed:true,waterCells:cases.length-1,maximumExtraSupports:1,
    supportAvailableFromStart:true,mirror:'One NE mirror, freely repositionable within its supported terrain component.',
    heroMoves:'Independent cardinal walking plus both directions of every unobstructed NE reflection from every allowed mirror position.',
    ignoredConstraints:['Other occupants and their collisions','Nearest-occupant reflection priority','Which hero can move the mirror','Combat','The work needed to create the chosen support','Simultaneous goal occupation'],
    retainedConstraints:['Walls and the permanently closed green gate block movement and rays','Heroes need supported departure and arrival cells','The single mirror cannot teleport itself or change its orientation'],
    justification:'The only crate can create at most one permanent support. Granting any water cell as a support from the beginning, free mirror relocation and occupant-free rays includes every legal trajectory while adding many impossible ones. If neither target is reachable in any such graph, no legal solution can keep the green gate closed throughout.',
  },
  result:{provedGateOpeningNecessary:true,reachableGoalsWithGateClosed:[],
    checkedSupportChoices:cases.length,includesNoSupportCase:true,
    maximumMirrorPositions:Math.max(...cases.map(c=>c.mirrorPositions)),
    maximumHeroReachableCells:Math.max(...cases.map(c=>c.heroReachableCells))},
  positiveControls:{
    note:'These permissive graph paths check the proof model; they are not claimed to be playable game solutions.',
    gateOpened:openedGate,antiBypassWallRemovedButGateClosed:removedWall,
  },
  scope:'Proves that the green gate must open at least once for this exact map. It does not prove a unique solution or the necessity of every object or of the recorded witness.',
  cases,
};
await writeFile(new URL('reference/level6-gate-necessity.json',root),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({success:true,level:6,...report.result,
  positiveControls:{openedGateGoals:openedGate.reachableGoals,removedWallSupport:removedWall.extraSupport,removedWallGoals:removedWall.reachableGoals}},null,2));
