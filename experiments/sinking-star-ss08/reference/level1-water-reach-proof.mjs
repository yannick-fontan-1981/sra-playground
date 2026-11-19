/** Author-only optimistic bound for the final water gap; never imported by the game. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {compileLevel,terrainAt} from '../dist/core.js';
const {spec}=JSON.parse(fs.readFileSync(new URL('./level1-design.json',import.meta.url),'utf8'));
const world=compileLevel(spec),ox=Math.floor((20-spec.rows[0].length)/2),oy=Math.floor((20-spec.rows.length)/2);
const p=(x,y)=>({x:x+ox,y:y+oy}),key=p=>`${p.x},${p.y}`;
const fixed=[p(6,4),p(8,6)],thirdCandidates=[p(12,10),p(13,10),p(14,10),p(15,10)];
assert.equal(world.mirrors.length,1);assert.equal(world.mirrors[0].facing,'NE');assert.equal(world.stones.length,3);
assert.equal(world.stones.filter(q=>q.x-ox>=16).length,1);assert.equal(world.heroes.filter(h=>h.at.x-ox>=16).length,0);
const cases=[];
for(const extra of [null,...thirdCandidates]){
 const supports=[...fixed,...(extra?[extra]:[])];
 const supported=q=>terrainAt(world,q)==='.'||supports.some(s=>key(s)===key(q));
 const start=world.mirrors[0].at,queue=[start],seen=new Set([key(start)]);
 for(let i=0;i<queue.length;i++)for(const [dx,dy] of [[0,-1],[0,1],[-1,0],[1,0]]){
  const q={x:queue[i].x+dx,y:queue[i].y+dy};if(!supported(q)||seen.has(key(q)))continue;seen.add(key(q));queue.push(q);
 }
 // Grant the mirror access to every connected supported tile, even if pushing
 // it there would be impossible. Ignore actors and closed gates as obstacles.
 const landings=[];
 for(const mirror of queue)for(let d=1;d<20;d++){
  const source={x:mirror.x,y:mirror.y-d};if(terrainAt(world,source)==='#')break;if(!supported(source))continue;
  const to={x:mirror.x+d,y:mirror.y};let blocked=false;
  for(let k=1;k<=d;k++)if(terrainAt(world,{x:mirror.x+k,y:mirror.y})==='#')blocked=true;
  if(!blocked)landings.push({mirror:{x:mirror.x-ox,y:mirror.y-oy},source:{x:source.x-ox,y:source.y-oy},to:{x:to.x-ox,y:to.y-oy}});
 }
 const furthestX=Math.max(...landings.map(l=>l.to.x));assert.ok(furthestX<=14);
 cases.push({extraSupport:extra?{x:extra.x-ox,y:extra.y-oy}:null,optimisticMirrorPositions:queue.length,maxEastLandingX:furthestX,furthestLandings:landings.filter(l=>l.to.x===furthestX)});
}
console.log(JSON.stringify({specSha256:crypto.createHash('sha256').update(JSON.stringify(spec)).digest('hex'),kind:'optimistic-geometric-bound',rightIslandStartsX:16,lastGapCellX:15,maximumReflectableEastX:14,cases},null,2));
