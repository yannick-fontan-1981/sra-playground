import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const [dir]=process.argv.slice(2);
const shas=['d0e7527ca8033bd805a6d7a8bb021eff62e87021','f6ff40f5e6c870ab5f897eaccdd1d43873944c5c'];
const containment='containment_and_contact',cover='conditional_reflected_cover';
function read(sha,g){
  const f=JSON.parse(readFileSync(join(dir,sha.slice(0,8)+'.'+g+'.json')));
  assert.equal(f.sha,sha);assert.equal(f.group,g);return f.results;
}
const [gel,candidate]=shas.map(sha=>Object.assign({},...['nominal','contrôles','réserve'].map(g=>read(sha,g))));
const n=gel.nominal.steps;
const cmd=s=>[s.pre.family,s.pre.kind,s.pre.command[0],s.pre.index];
for(const group of [gel,candidate])for(const r of Object.values(group)){
  for(const [i,s] of r.steps.entries()){
    assert.ok(s.pre.guard);assert.equal(s.after.ticket,s.pre.ticket);assert.equal(s.after.owner,s.pre.family);
    const next=r.steps[i+1]?.pre??r.next;
    if(next)assert.equal(next.ref,s.after.ref);
  }
}
for(const k of Object.keys(gel).filter(k=>!['autre-calibrage','retrait-calibrage'].includes(k)))assert.deepEqual(gel[k],candidate[k]);
for(const k of ['autre-calibrage','retrait-calibrage'])assert.deepEqual(gel[k].steps,n.slice(0,4));

assert.deepEqual(cmd(n[0]),['containment',containment,'ACTION1',0]);
assert.equal(n[0].pre.containmentPlan.mode,'calibrate');
assert.equal(n[0].pre.containmentPlan.expected,null);
const start=n[0].pre.containment.fact, motion=n[0].after.containment, learned=motion.event;
assert.deepEqual(start.poses,[[36,15]]);assert.equal(start.bodies[0].color,4);
assert.deepEqual(start.availableCalibration,['ACTION1','ACTION2','ACTION3','ACTION4','ACTION5']);
assert.deepEqual(learned.moved,[0]);assert.deepEqual(learned.after,[[36,12]]);
assert.deepEqual(motion.vectors,[['ACTION1',[0,-3]]]);assert.equal(learned.evidence,n[0].after.ref);
assert.deepEqual(motion.rim,[{goal:[51,45],size:35,before:[9],after:[9],unchanged:true}]);
assert.deepEqual(n[1].pre.containment.fact.refs,[['ACTION1',n[0].after.ref]]);
const correctMovement=(event,ref)=>event.evidence===ref && event.moved.length===1 && start.bodies[event.moved[0]]?.color===4;
assert.ok(correctMovement(learned,n[0].after.ref));
assert.ok(!correctMovement({...learned,moved:[1]},n[0].after.ref));

const calibrated=candidate['autre-calibrage'].steps, withdrawn=candidate['retrait-calibrage'].steps;
assert.deepEqual(calibrated[0].pre.containment,n[0].pre.containment);
assert.deepEqual(cmd(calibrated[0]),['containment',containment,'ACTION2',0]);
assert.deepEqual(calibrated[0].after.containment.vectors,[['ACTION2',[0,3]]]);
assert.deepEqual(calibrated[0].after.containment.event.after,[[36,18]]);
assert.deepEqual(calibrated[0].after.containment.rim,motion.rim);
assert.deepEqual(cmd(calibrated[1]),['containment',containment,'ACTION1',0]);
assert.deepEqual(withdrawn[0].pre.containment,n[0].pre.containment);
assert.deepEqual(cmd(withdrawn[0]),['observed_frontier','experiment','ACTION1',0]);
assert.equal(withdrawn[0].after.packet,n[0].after.packet);
assert.equal(withdrawn[0].after.containment,null);
assert.deepEqual(withdrawn[0].after.reflection,n[0].after.reflection);
assert.deepEqual(cmd(withdrawn[1]),['containment',containment,'ACTION1',0]);
const still=gel['retour-contenant'], still1=still.steps[0];
assert.deepEqual(still1.pre,n[0].pre);assert.equal(still1.after.packet,n[0].after.packet);
assert.equal(still1.after.pixels.served,0);assert.ok(still1.after.pixels.real>0);
assert.deepEqual(still1.after.containment.vectors,[]);assert.equal(still1.after.containment.active,null);
assert.deepEqual(still1.after.containment.noMoves,[['ACTION1',[[36,15]]]]);
assert.deepEqual([still.next.kind,still.next.action],[containment,'ACTION2']);

const first=n[3], source=first.pre.reflection.solved.pre.fact;
assert.deepEqual(cmd(first),['reflected_cover',cover,'ACTION3',0]);
assert.deepEqual([source.world.direct,source.world.image,source.world.dim,source.world.axis,source.world.pitch],[5,4,0,10,3]);
assert.deepEqual(source.axes,[0,1]);assert.deepEqual(source.refs,n.slice(0,3).map(s=>s.after.ref));
assert.deepEqual(source.effects.map(([k,v])=>[JSON.parse(k),v]),[
  [['body','ACTION1'],[0,-1]],[['body','ACTION2'],[0,1]],[['body','ACTION3'],[-1,0]],
]);
assert.deepEqual(first.pre.reflectionPlan.coveredBefore,[{direct:[],reflected:[]}]);
assert.deepEqual(n.slice(3).map(s=>s.after.matched),Array(13).fill(true));assert.equal(n.at(-1).after.levels,0);
const loss=gel['preuve-reflet'].steps, off=gel['retrait-reflet'].steps;
assert.deepEqual(loss.slice(0,2),n.slice(0,2));assert.deepEqual(loss[2].pre,n[2].pre);
assert.equal(loss[2].after.packet,n[2].after.packet);
assert.deepEqual(loss[2].after.containment,n[2].after.containment);
assert.deepEqual(loss[3].pre.reflection.pre.fact.axes,[1]);
assert.equal(loss[3].pre.reflection.pre.fact.ready,false);
assert.equal(loss[3].pre.kind,containment);assert.equal(loss[3].pre.command[0],'ACTION4');
assert.deepEqual(off[3].pre.reflection.solved.pre,first.pre.reflection.solved.pre);
assert.equal(off[3].pre.reflection.solved.solution,null);
assert.deepEqual(cmd(off[3]),['containment',containment,'ACTION4',0]);
assert.deepEqual(cmd(off[4]),['reflected_cover',cover,'ACTION3',0]);

const restart=gel['reprise-reflet'].steps, last=restart[15];
assert.deepEqual(restart.map(x=>x.after.packet),n.map(x=>x.after.packet));
assert.equal(restart[3].pre.reflection.pre.fact.allowed,12);assert.equal(restart[14].pre.index,11);
assert.deepEqual(cmd(last),['reflected_cover',cover,'ACTION2',0]);
assert.deepEqual(last.pre.reflection.solved.pre.fact.covered,[{direct:[],reflected:[[17,15]]}]);
assert.deepEqual(last.pre.reflectionPlan.coveredAfter,[{direct:[],reflected:[[17,15],[17,16]]}]);
assert.equal(last.after.matched,true);

const partial=gel['partiel-reflet'], result=partial.steps[3];
assert.deepEqual(partial.steps.slice(0,3),n.slice(0,3));assert.deepEqual(result.pre,first.pre);
assert.equal(result.after.packet,first.after.packet);
assert.equal(result.after.pixels.real,first.after.pixels.real);
assert.ok(result.after.pixels.served<result.after.pixels.real);
assert.deepEqual([result.after.matched,result.after.seal,result.after.reason],[false,true,'reflection_or_control_contradiction']);
assert.equal(partial.next.index,0);
const validProjection=(e,s)=>e.evidence===s.after.ref;
assert.ok(validProjection(n[2].after.reflection.events[0],n[2]));
assert.ok(!validProjection({...n[2].after.reflection.events[0],evidence:n[1].after.ref},n[2]));
const stats=[gel,candidate].map((g,i)=>({sha:shas[i],départs:Object.keys(g).length,gestes:Object.values(g).reduce((s,r)=>s+r.steps.length,0)}));
console.log(JSON.stringify({stats,nominal:{tickets:n.length,containment:n.filter(x=>x.pre.kind===containment).length,
  reflected:n.filter(x=>x.pre.kind===cover).length,niveaux:n.at(-1).after.levels},
  ligne8:{normal:cmd(n[0]),vecteur:motion.vectors,alternative:cmd(calibrated[0]),autreVecteur:calibrated[0].after.containment.vectors,
    retrait:cmd(withdrawn[0]),stationnaire:still.next},
  ligne77:{normal:cmd(first),retraitPreuve:cmd(loss[3]),retraitOffre:cmd(off[3]),reprise:{avant:last.pre.reflection.solved.pre.fact.covered,
    après:last.pre.reflectionPlan.coveredAfter},partiel:{pixels:result.after.pixels,borne:result.after.bbox??null,suite:partial.next}}},null,2));
