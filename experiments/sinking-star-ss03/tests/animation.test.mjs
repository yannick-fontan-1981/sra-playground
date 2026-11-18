import test from 'node:test';
import assert from 'node:assert/strict';
import {compileLevel, initialState, stepWorld, transitionFrames, renderWorld, VECTORS, PullPuzzleSession} from '../dist/core.js';

const ids={N:1,S:2,W:3,E:4};
function fixture(direction) {
  const d=VECTORS[direction];
  const rows=Array.from({length:7},(_,y)=>Array.from({length:7},(_,x)=>(!x||!y||x===6||y===6)?'#':'.'));
  rows[3][3]='T';rows[3-d.y][3-d.x]='o';rows[1][1]='o';rows[5][5]='g';
  const level={id:'motion-'+direction,title:'Motion '+direction,rows:rows.map(r=>r.join(''))};
  const w=compileLevel(level),before=initialState(w),action=ids[direction],after=stepWorld(w,before,action);
  return {w,before,after,action,d};
}

for(const direction of ['N','S','W','E']) test(`pull animation in direction ${direction} advances both sprites at 1, 2, 3 pixels`,()=>{
  const {w,before,after,action,d}=fixture(direction);
  const original=structuredClone(before),final=structuredClone(after);
  const frames=transitionFrames(w,before,after,action);
  assert.equal(frames.length,3);
  const stone=before.stones.find(p=>p.x===before.hero.x-d.x&&p.y===before.hero.y-d.y);
  for(let i=0;i<frames.length;i++) {
    const frame=frames[i],pixels=i+1;
    const hx=2+before.hero.x*3+d.x*pixels,hy=2+before.hero.y*3+d.y*pixels;
    const sx=2+stone.x*3+d.x*pixels,sy=2+stone.y*3+d.y*pixels;
    assert.equal(frame[hy+1][hx+1],14,'hero center moves continuously');
    assert.equal(frame[hy+1+d.y][hx+1+d.x],0,'facing pixel moves with the hero');
    assert.equal(frame[sy+1][sx+1],5,'stone center moves continuously');
    for(const [x,y] of [[0,0],[1,0],[2,0],[0,1],[2,1],[0,2],[1,2],[2,2]]) assert.equal(frame[sy+y][sx+x],13);
    assert.equal(frame.flat().filter(c=>c===14).length,4,'hero never blinks');
    assert.equal(frame.flat().filter(c=>c===13).length,16,'two stones retain their normal colour');
    assert.equal(frame.flat().includes(1),false,'no light-grey prediction');
  }
  assert.deepEqual(frames.at(-1),renderWorld(w,after));
  assert.deepEqual(before,original,'presentation cannot mutate simulation');
  assert.deepEqual(after,final,'presentation cannot mutate final state');
});

test('ordinary walking and failed pulling have a single settled frame',()=>{
  const {w,before}=fixture('E');
  const walk=stepWorld(w,before,1);
  assert.equal(transitionFrames(w,before,walk,1).length,1);
  const level={id:'blocked',title:'Blocked',rows:['########','#oT~..g#','########']};
  const b=compileLevel(level),s=initialState(b),blocked=stepWorld(b,s,4);
  assert.equal(transitionFrames(b,s,blocked,4).length,1);
});

test('winning pull preserves three movement frames before the next map and exposes its exact final frame',()=>{
  const one={id:'one',title:'one',rows:['######','#oTg.#','######']};
  const two={id:'two',title:'two',rows:['######','#T..g#','######']};
  const session=new PullPuzzleSession([one,two]);
  const next=session.action(4);
  assert.equal(next.level,2);
  assert.equal(next.levelsCompleted,1);
  assert.equal(next.frames.length,4);
  assert.deepEqual(next.frameDurationsMs,[60,80,100,0]);
  const w=compileLevel(one),start=initialState(w);
  assert.deepEqual(next.frames[2],renderWorld(w,stepWorld(w,start,4)));
  assert.deepEqual(next.frames[3],next.frame);
});

test('undo after a winning pull restores the previous map and resets presentation to one frame',()=>{
  const one={id:'one',title:'one',rows:['######','#oTg.#','######']};
  const two={id:'two',title:'two',rows:['######','#T..g#','######']};
  const session=new PullPuzzleSession([one,two]),before=session.observe();
  session.action(4);
  const restored=session.undo();
  assert.deepEqual(restored,before);
  assert.equal(restored.frames.length,1);
});
