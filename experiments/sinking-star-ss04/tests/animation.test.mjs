import test from 'node:test';
import assert from 'node:assert/strict';
import {compileLevel,initialState,stepDetailed,renderWorld,transitionFrames,WizardPuzzleSession,GRID} from '../dist/core.js';

const spec=(rows,extras={})=>({id:'animation',title:'Animation',rows,...extras});
const point=(level,x,y)=>({x:x+Math.floor((20-level.rows[0].length)/2),y:y+Math.floor((20-level.rows.length)/2)});

test('a long exchange has three distinct teleport frames, with final pixels exactly matching state',()=>{
 const level=spec(['##########','#W....o..#','#.......g#','##########']);
 const w=compileLevel(level),s=initialState(w),detail=stepDetailed(w,s,4),frames=transitionFrames(w,s,detail.state,4);
 assert.equal(detail.phases[0].kind,'swap');assert.equal(frames.length,3);
 assert.notDeepEqual(frames[0],frames[1]);assert.notDeepEqual(frames[1],frames[2]);
 assert.deepEqual(frames[2],renderWorld(w,detail.state));
 const from=point(level,1,1),to=point(level,6,1),center=p=>({x:GRID.originPx+p.x*3+1,y:GRID.originPx+p.y*3+1});
 const a=center(from),b=center(to);
 assert.equal(frames[1][a.y][a.x],13,'stone transfer is shown at the former Wizard position');
 assert.equal(frames[1][b.y][b.x],15,'Wizard transfer is shown at the former stone position');
 assert.equal(frames[2][b.y][b.x],15);
 const ob=new WizardPuzzleSession([level]).action(4);assert.deepEqual(ob.frameDurationsMs,[70,90,0]);
 assert.equal(renderWorld(w,s).flat().includes(1),false,'light-gray transfer outlines are not a resting preview');
});

test('the flash follows a reflected route and stops before an unrelated stone',()=>{
 const level=spec(['#########','#W......#','#...#...#','#....o.o#','#......g#','#########'],{mirrors:[{at:{x:3,y:1},facing:'SW'},{at:{x:3,y:3},facing:'NE'}]});
 const w=compileLevel(level),s=initialState(w),detail=stepDetailed(w,s,4),frames=transitionFrames(w,s,detail.state,4);
 assert.equal(frames.length,3);
 const corner=point(level,3,1),offPath=point(level,6,3);
 assert.equal(frames[0][3+corner.y*3][3+corner.x*3],10,'mirror turn belongs to the cyan flash');
 assert.equal(frames[0][3+offPath.y*3][3+offPath.x*3],3,'the ray stops at its first target');
 assert.deepEqual(frames[2],renderWorld(w,detail.state));
});

test('an exchange, simultaneous monster combat and a released press keep all presentation phases',()=>{
 const level=spec(['##########','#W..o....#','#........#','#mm...o..#','#.......g#','##########'],{
  circuits:[{id:'a',buttons:[{x:1,y:3}]}],
  gates:[{at:{x:6,y:3},circuit:'a',direction:'E',closedWhen:'released'}],
 });
 const w=compileLevel(level),s=initialState(w),detail=stepDetailed(w,s,4),session=new WizardPuzzleSession([level]),ob=session.action(4);
 assert.deepEqual(detail.phases.map(p=>p.kind),['swap','combat','piston']);
 assert.equal(ob.frames.length,7);assert.deepEqual(ob.frameDurationsMs,[70,90,40,40,60,80,0]);
 assert.deepEqual(ob.frames[2],renderWorld(w,detail.phases[0].after));
 assert.deepEqual(ob.frames[3],renderWorld(w,detail.phases[1].after));
 assert.deepEqual(ob.frames[6],renderWorld(w,detail.state));
 assert.deepEqual(session.undo().frame,renderWorld(w,s));
});

test('all transitional pixels stay in the 64 by 64 palette image',()=>{
 const level=spec(['#########','#W...m..#','#......g#','#########']),session=new WizardPuzzleSession([level]);
 const before=session.observe(),ob=session.action(4);
 assert.ok(ob.frames.every(frame=>frame.length===64&&frame.every(row=>row.length===64&&row.every(c=>Number.isInteger(c)&&c>=0&&c<16))));
 assert.equal(before.frame.flat().includes(15),true);assert.equal(before.frame.flat().includes(14),false);
 for(const frame of ob.frames){
  assert.ok(frame[0].every(c=>c===4));assert.ok(frame[63].every(c=>c===4));
  assert.ok(frame.every(row=>row[0]===4&&row[63]===4));
 }
});
