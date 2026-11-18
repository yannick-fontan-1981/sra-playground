import test from 'node:test';
import assert from 'node:assert/strict';
import {compileLevel,initialState,stepWorld,transitionFrames,renderWorld,PushPuzzleSession,VECTORS} from '../dist/core.js';

const fixture=(rows,facing='N')=>({id:'MOVE',title:'Animation fixture',rows,facing});
const pointKey=p=>`${p.x},${p.y}`;
const pixels=(frame,color)=>{
 const found=[];
 for(let y=0;y<64;y++)for(let x=0;x<64;x++)if(frame[y][x]===color)found.push({x,y});
 return found;
};
const center=p=>({x:3+p.x*3,y:3+p.y*3});
const shifted=(p,d,n)=>({x:p.x+VECTORS[d].x*n,y:p.y+VECTORS[d].y*n});
const cases=[
 ['N',1,['#########','#.......#','#...o...#','#...W.g.#','#.......#','#########']],
 ['S',2,['#########','#.......#','#...W.g.#','#...o...#','#.......#','#########']],
 ['W',3,['#########','#.......#','#..oW.g.#','#.......#','#.......#','#########']],
 ['E',4,['#########','#.......#','#..Wo.g.#','#.......#','#.......#','#########']],
];
for(const [direction,action,rows] of cases)test(`push animation ${direction}: sprites advance exactly 1, 2 and 3 pixels`,()=>{
 const spec=fixture(rows,direction==='N'?'S':'N'),w=compileLevel(spec),before=initialState(w),after=stepWorld(w,before,action);
 const saved=structuredClone({before,after}),frames=transitionFrames(w,before,after,action);
 assert.equal(frames.length,3);
 for(const [i,frame] of frames.entries()){
  const stoneCenter=shifted(center(before.stones[0]),direction,i+1);
  assert.deepEqual(pixels(frame,5),[stoneCenter]);
  assert.equal(frame[stoneCenter.y-1][stoneCenter.x],13);
  const heroCenter=shifted(center(before.hero),direction,i+1);
  assert.equal(frame[heroCenter.y][heroCenter.x],8);
  assert.equal(pixels(frame,13).length,8,'stone retains its eight brown border pixels');
  assert.equal(pixels(frame,8).length,4,'only one Warrior is drawn');
  assert.equal(pixels(frame,0).length,1,'only the Warrior direction pixel is white');
  assert.equal(pixels(frame,1).length,0,'no destination preview');
 }
 assert.deepEqual(frames[2],renderWorld(w,after));
 assert.deepEqual({before,after},saved,'presentation never mutates either logical state');
 const o=new PushPuzzleSession([spec]).action(action);
 assert.deepEqual(o.frames,frames);assert.deepEqual(o.frame,frames[2]);
 assert.deepEqual(o.frameDurationsMs,[60,80,0]);
});

test('a whole file advances together with no old copies or white blink',()=>{
 const w=compileLevel(fixture(['#########','#Woo...g#','#########'],'E')),before=initialState(w),after=stepWorld(w,before,4);
 const frames=transitionFrames(w,before,after,4);
 for(const [i,frame] of frames.entries()){
  const centers=before.stones.map(p=>shifted(center(p),'E',i+1));
  assert.deepEqual(pixels(frame,5).map(pointKey).sort(),centers.map(pointKey).sort());
  assert.equal(pixels(frame,13).length,16);assert.equal(pixels(frame,0).length,1);
 }
 assert.deepEqual(frames.at(-1),renderWorld(w,after));
});

test('a stone slides into water before becoming a cyan-X platform on frame three',()=>{
 const w=compileLevel(fixture(['#########','#Woo~..g#','#########'],'E')),before=initialState(w),after=stepWorld(w,before,4);
 const frames=transitionFrames(w,before,after,4);
 for(let i=0;i<2;i++){
  const centers=before.stones.map(p=>shifted(center(p),'E',i+1));
  assert.deepEqual(pixels(frames[i],5).map(pointKey).sort(),centers.map(pointKey).sort());
  assert.equal(pixels(frames[i],10).length,0,'the platform is not shown before arrival');
  assert.equal(pixels(frames[i],0).length,1,'sinking does not flash white');
 }
 assert.equal(after.stones.length,1);assert.equal(after.supports.length,1);
 assert.deepEqual(frames[2],renderWorld(w,after));assert.equal(pixels(frames[2],10).length,5);
});

test('stationary stones and existing platforms keep their pixels during motion',()=>{
 const w=compileLevel(fixture(['#########','#Wo...g.#','#..o.s..#','#########'],'E')),before=initialState(w),after=stepWorld(w,before,4);
 const frames=transitionFrames(w,before,after,4),stationary=center(before.stones[1]),platform=center(before.supports[0]);
 for(const frame of frames){
  assert.equal(frame[stationary.y][stationary.x],5);assert.equal(frame[stationary.y-1][stationary.x],13);
  assert.equal(frame[platform.y][platform.x],10);assert.equal(frame[platform.y-1][platform.x],13);
 }
});

test('a blocked push or ordinary walk has no push animation',()=>{
 for(const rows of [['#######','#Wo#.g#','#######'],['#######','#W...g#','#######']]){
  const w=compileLevel(fixture(rows,'E')),before=initialState(w),after=stepWorld(w,before,4);
  assert.deepEqual(transitionFrames(w,before,after,4),[renderWorld(w,after)]);
 }
});
