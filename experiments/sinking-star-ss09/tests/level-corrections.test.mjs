import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Author} from '../reference/author/author.mjs';
import {stepDetailed,terrainAt} from '../dist/core.js';
import {replay,solve} from '../scripts/solver.mjs';

const design=level=>JSON.parse(readFileSync(new URL('../reference/level'+level+'-design.json',import.meta.url),'utf8'));

test('L1 bottom ground stops both submerged crates without extending onto the mirror launch column',()=>{
  const d=design(1),a=new Author(d.spec);
  a.act(d.commands.slice(0,d.stages[2].turn));
  assert.equal(a.state.supports.length,2);
  a.go(4,4,'merchant').select('bard').act('DLD');
  const before=a.state,expected=[a.point(7,10),a.point(8,10)];
  assert.deepEqual([...before.supports].sort((p,q)=>p.x-q.x),expected);
  for(const x of [7,8])assert.equal(terrainAt(a.world,a.point(x,11)),'.');
  assert.equal(terrainAt(a.world,a.point(9,11)),'~');
  const stopped=stepDetailed(a.world,before,2);
  assert.equal(stopped.state.failed,false);
  assert.equal(stopped.state.dead,false);
  assert.deepEqual(stopped.state.supports,before.supports);
  assert.equal(stopped.state.heroes[stopped.state.active].at.y,before.heroes[before.active].at.y+1);
  assert.ok(stopped.phases.every(p=>p.moves.every(m=>m.actor!=='support')));
});

test('L1 bottom bank cannot be reached from the starting shore without crossing at least two water cells',()=>{
  const {spec}=design(1),a=new Author(spec),start=a.state.heroes[0].at;
  const distances=new Map([[start.y*20+start.x,0]]),queue=[start];
  while(queue.length){
    queue.sort((p,q)=>distances.get(p.y*20+p.x)-distances.get(q.y*20+q.x));
    const p=queue.shift(),cost=distances.get(p.y*20+p.x);
    for(const [dx,dy] of [[0,-1],[0,1],[-1,0],[1,0]]){
      const next={x:p.x+dx,y:p.y+dy},terrain=terrainAt(a.world,next);
      if(terrain==='#')continue;
      const key=next.y*20+next.x,n=cost+(terrain==='~'?1:0);
      if(n>=(distances.get(key)??Infinity))continue;
      distances.set(key,n);queue.push(next);
    }
  }
  for(const x of [7,8]){const p=a.point(x,11);assert.equal(distances.get(p.y*20+p.x),2);}
});

test('L1 closes the concrete shortcut created by joining the new bank directly to the shore',()=>{
  const {spec}=design(1),rows=spec.rows.map(r=>[...r]);
  for(const [x,y] of [[6,10],[6,11],[5,11]])rows[y][x]='.';
  const shortcut='DDRRRRRXXRRRCRRLDDDDDRXURRRCL';
  const unsafe=replay({...spec,rows:rows.map(r=>r.join(''))},shortcut);
  assert.equal(unsafe.state.complete,true);
  assert.equal(unsafe.metrics.merchantPushes,0);
  assert.equal(unsafe.metrics.pistonPushes,0);
  assert.equal(unsafe.metrics.mirrorMoves,0);
  assert.equal(replay(spec,shortcut).state.complete,false);
});

for(const [name,restriction] of [
  ['reflections',{disableReflections:true}],
  ['the Merchant push',{disableMerchantPushes:true}],
  ['the Bard song',{disableBardSong:true}],
  ['the press',{disablePistons:true}],
  ['building the bridge',{disablePlatforms:true}],
])test('L4 cannot be solved without '+name,()=>{
  const result=solve(design(4).spec,{maxStates:20000,maxMs:10000,...restriction});
  assert.equal(result.status,'unsolvable',JSON.stringify(result));
  assert.equal(result.states,result.expanded,'The queue must be exhausted, not capped');
});
