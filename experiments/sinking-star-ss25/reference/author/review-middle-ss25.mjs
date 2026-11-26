import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {Author} from './author.mjs';
import {compileLevel,initialState,stepDetailed,circuitPressed,gateClosed,platformActive,equal,planReflection} from '../../dist/core.js';
import {replay,decodeCommand} from '../../scripts/solver.mjs';

const sha=x=>createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex');
const records=new Map([2,3,4].map(n=>[n,JSON.parse(readFileSync(new URL(`../level${n}-design.json`,import.meta.url),'utf8'))]));
const report={game:'SS25',scope:'N2–N4; exact routes, resource handovers and local counter-branches',success:false,checks:[],levels:[],counterBranches:[],limitations:[
 'These tests demonstrate the listed local effects and winning routes, not unique or optimal solutions.',
 'No claim of an irrecoverable global deadlock is inferred from a blocked local move or a lost command.',
 'N2 uses the Bard as a remote command operator; the author route does not require a song.',
 'The East and Light references are adaptations of causal structure; ricochets, light powers and timed movement are not added.'
]};
const check=(name,fn)=>{fn();report.checks.push({name,passed:true});};
const fork=(n,turn)=>{const d=records.get(n),a=new Author(d.spec);a.act(d.commands.slice(0,turn));return a;};
const step=(a,c)=>{const action=decodeCommand(c,a.state);return stepDetailed(a.world,a.state,action.id,action.data);};
const at=(a,points,x,y)=>points.some(p=>equal(p,a.point(x,y)));
const hero=(a,kind)=>a.state.heroes.find(h=>h.kind===kind);
const branch=(n,name,a,c,detail)=>report.counterBranches.push({level:n,name,prefix:a.commands,attempt:c,actions:replay(a.spec,a.commands+c).actions,failed:detail.state.failed,dead:detail.state.dead,complete:detail.state.complete,finalStateSha256:sha(detail.state)});

try{
 for(const n of [2,3,4]){
  const d=records.get(n),r=replay(d.spec,d.commands);
  check(`N${n}: author route wins with four living heroes`,()=>assert.ok(r.state.complete&&!r.state.dead&&r.state.heroes.every(h=>!h.dead)));
  check(`N${n}: no refused or lethal author action`,()=>assert.equal(r.metrics.blocked+r.metrics.deaths,0));
  check(`N${n}: numerical actions match the declared route`,()=>assert.deepEqual(r.actions,d.actions));
  check(`N${n}: all recorded stages match the replay`,()=>{
   for(const stage of d.stages){const s=replay(d.spec,d.commands.slice(0,stage.turn)).state;
    assert.deepEqual(s.heroes.map(h=>({kind:h.kind,at:h.at})),stage.heroes);
    for(const key of ['stones','supports','mirrors','monsters'])assert.deepEqual(s[key],stage[key]);
    assert.deepEqual(Object.fromEntries(r.world.circuits.map(c=>[c.id,circuitPressed(r.world,s,c.id)])),stage.circuits);
   }
  });
  report.levels.push({level:n,title:d.spec.title,mapSha256:sha(d.spec),commandsSha256:sha(d.commands),actions:r.metrics.actions,selections:r.metrics.selections,metrics:r.metrics});
 }
 {
  const d=records.get(2),r=replay(d.spec,d.commands),a=new Author(d.spec);
  check('N2: the initial six pushes move a crate and a mirror together',()=>{
   const phases=r.trace.slice(0,6).flatMap(t=>t.phases).filter(p=>p.kind==='push');
   assert.equal(phases.length,6);assert.ok(phases.every(p=>p.moves.some(m=>m.actor==='stone')&&p.moves.some(m=>m.actor==='mirror')));
  });
  check('N2: the press sends the crate first, then the mirror',()=>{
   const phases=r.trace.flatMap(t=>t.phases).filter(p=>p.kind==='piston');assert.equal(phases.length,2);
   assert.equal(phases[0].moves[0].actor,'stone');assert.equal(phases[1].moves[0].actor,'mirror');
  });
  a.act('RRRRRR').select('bard').act('R').go(9,4,'thief');const early=step(a,'R');
  check('N2: a premature send closes the receiver access',()=>{assert.equal(early.state.failed,true);assert.ok(gateClosed(a.world,early.state,1));assert.deepEqual(early.state.heroes.map(h=>h.at),a.state.heroes.map(h=>h.at));});
  branch(2,'Send before placing the receiver',a,'R',early);
  const busy=fork(2,d.stages[2].turn);busy.select('bard').act('L').select('warrior').act('R').select('bard').act('R').select('thief');const blocked=step(busy,'D');
  check('N2: the second load reaches an occupied receiving bay without the exchanges',()=>{assert.ok(at(busy,busy.state.stones,12,5));assert.ok(busy.state.mirrors.some(m=>equal(m.at,busy.point(12,6))));assert.equal(blocked.state.failed,true);});
  branch(2,'Second load without clearing the first delivery',busy,'D',blocked);
  const noStance=fork(2,d.stages[0].turn);noStance.go(11,8,'warrior');const water=step(noStance,'R');
  check('N2: the lower manual pushing stance is bare water',()=>{assert.equal(water.state.failed,true);assert.equal(water.state.dead,false);});
  branch(2,'Try to stand below the lateral sending post',noStance,'R',water);
  const final=fork(2,d.stages[5].turn);
  check('N2: both deposits persist after the receiver and operator leave',()=>{assert.ok(at(final,final.state.stones,15,5));assert.ok(final.state.mirrors.some(m=>equal(m.at,final.point(12,5))));assert.ok(circuitPressed(final.world,final.state,'reception')&&circuitPressed(final.world,final.state,'depot'));assert.equal(circuitPressed(final.world,final.state,'envoi'),false);});
 }
 {
  const d=records.get(3),r=replay(d.spec,d.commands),delivered=fork(3,d.stages[2].turn);
  check('N3: the two weights are delivered while the supports remain separated',()=>{assert.ok(at(delivered,delivered.state.stones,10,4)&&at(delivered,delivered.state.stones,10,10));assert.ok(at(delivered,delivered.state.supports,7,5)&&at(delivered,delivered.state.supports,7,9));});
  delivered.go(6,7,'warrior');const gap=step(delivered,'R');
  check('N3: separated delivery supports do not cross the central gap',()=>{assert.equal(gap.state.failed,true);assert.equal(gap.state.dead,false);});
  branch(3,'Attempt the central route before joining the supports',delivered,'R',gap);
  const positioned=fork(3,d.stages[3].turn);positioned.select('bard');const unwanted=step(positioned,'U');
  check('N3: a voluntary departure moves the support already parked',()=>{assert.equal(unwanted.state.failed,false);assert.ok(at(positioned,unwanted.state.supports,8,6));assert.ok(!at(positioned,unwanted.state.supports,8,7));});
  branch(3,'Move the Bard voluntarily after the first support is parked',positioned,'U',unwanted);
  const released=fork(3,d.stages[4].turn);
  check('N3: pulling the Bard preserves that support',()=>{assert.ok(at(released,released.state.supports,8,7));assert.ok(equal(hero(released,'bard').at,released.point(4,9)));});
  const bridge=fork(3,d.stages[5].turn);
  check('N3: the same two supports form the final adjacent bridge',()=>{assert.equal(bridge.state.supports.length,2);assert.ok(at(bridge,bridge.state.supports,7,7)&&at(bridge,bridge.state.supports,8,7));});
  check('N3: the complete route preserves both dry weights and uses no extra immersed crate',()=>{assert.ok(r.trace.every(t=>t.after.stones.length===2&&t.after.supports.length===2));assert.equal(r.metrics.platformsCreated,0);});
  check('N3: the Wizard carries the remaining convoy crate across the water column',()=>{const swaps=r.trace.flatMap(t=>t.phases).filter(p=>p.kind==='swap');assert.equal(swaps.length,1);assert.ok(swaps[0].moves.some(m=>m.actor==='stone'&&equal(m.from,bridge.point(9,5))&&equal(m.to,bridge.point(9,9))));});
 }
 {
  const d=records.get(4),r=replay(d.spec,d.commands),masked=fork(4,d.stages[0].turn),reflection=step(masked,'X');
  check('N4: the original blocker is the first reflected target',()=>{assert.equal(reflection.state.failed,false);assert.ok(at(masked,reflection.state.stones,12,9));assert.deepEqual(reflection.state.heroes.map(h=>h.at),masked.state.heroes.map(h=>h.at));});
  branch(4,'Reflect before extracting the blocker',masked,'X',reflection);
  const walking=step(masked,'R');
  check('N4: an ordinary Thief step takes the delivered weight off its command',()=>{assert.equal(walking.state.failed,false);assert.equal(circuitPressed(masked.world,walking.state,'traction'),false);assert.ok(at(masked,walking.state.stones,10,5));});
  branch(4,'Leave the first pull by walking forward',masked,'R',walking);
  const released=fork(4,d.stages[2].turn);
  check('N4: exchange and reflection release the Thief without moving the deposited weight',()=>{assert.ok(equal(hero(released,'thief').at,released.point(12,9)));assert.ok(at(released,released.state.stones,9,5));assert.ok(at(released,released.state.stones,13,7));});
  released.go(13,8,'thief');const tooSoon=step(released,'D');
  check('N4: extracting the blocker before its replacement withdraws both hydraulic cells',()=>{assert.equal(tooSoon.state.failed,false);assert.equal(circuitPressed(released.world,tooSoon.state,'releve'),false);assert.deepEqual(tooSoon.state.platformActive,[false,false]);assert.ok(gateClosed(released.world,tooSoon.state,0));});
  branch(4,'Recover the blocker before delivering its replacement',released,'D',tooSoon);
  check('N4: the two-piece push replaces the relay without withdrawing the bridge',()=>{
   const phase=r.trace.flatMap(t=>t.phases).find(p=>p.kind==='push'&&p.moves.some(m=>m.actor==='stone'&&equal(m.from,masked.point(13,7))&&equal(m.to,masked.point(14,7))));
   assert.ok(phase);assert.ok(phase.moves.some(m=>m.actor==='stone'&&equal(m.from,masked.point(12,7))&&equal(m.to,masked.point(13,7))));assert.deepEqual(phase.before.platformActive,[true,true]);assert.deepEqual(phase.after.platformActive,[true,true]);
  });
  check('N4: the last two songs carry the Thief but the northern wall holds the Wizard',()=>{
   const songs=r.trace.flatMap(t=>t.phases).filter(p=>p.kind==='song');assert.equal(songs.length,2);
   for(const p of songs){const t=p.before.heroes.find(h=>h.kind==='thief'),z=p.before.heroes.find(h=>h.kind==='wizard');assert.ok(p.moves.some(m=>m.actor==='hero'&&equal(m.from,t.at)&&m.to.y===t.at.y-1));assert.deepEqual(p.after.heroes.find(h=>h.kind==='wizard').at,z.at);}
  });
  const last=fork(4,d.stages[5].turn),reclaimed=step(last,'D');
  check('N4: the Bard would reclaim the final weight on an ordinary downward exit',()=>{assert.equal(reclaimed.state.failed,false);assert.equal(circuitPressed(last.world,reclaimed.state,'dernier'),false);assert.ok(at(last,reclaimed.state.stones,14,4));});
  branch(4,'Leave the final song by walking down',last,'D',reclaimed);
  const detached=fork(4,d.stages[6].turn);
  check('N4: the passive extraction leaves all three final commands weighted',()=>{assert.ok(equal(hero(detached,'bard').at,detached.point(17,4)));assert.ok(detached.world.circuits.every(c=>circuitPressed(detached.world,detached.state,c.id)));});
  check('N4: no side opening bypasses the three final gates',()=>{
   const w=compileLevel(d.spec),goals=new Set(w.goals.map(p=>p.y*20+p.x));
   for(const gate of w.gates.filter(g=>g.at.x===16)){
    const closed=new Set([gate.at.y*20+gate.at.x]),start=masked.point(13,11),queue=[start],seen=new Set([start.y*20+start.x]);
    for(let i=0;i<queue.length;i++)for(const[dx,dy]of[[0,-1],[0,1],[-1,0],[1,0]]){const p={x:queue[i].x+dx,y:queue[i].y+dy},k=p.y*20+p.x;if(p.x<0||p.y<0||p.x>=20||p.y>=20||w.terrain[k]==='#'||w.terrain[k]==='~'||closed.has(k)||seen.has(k))continue;seen.add(k);queue.push(p);}
    assert.ok([...goals].every(k=>!seen.has(k)));
   }
  });
 }
 report.success=true;
}catch(error){report.error=error.stack;process.exitCode=1;}
writeFileSync(new URL('../middle-ss25-review.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
