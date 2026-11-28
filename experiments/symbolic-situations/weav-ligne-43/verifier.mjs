import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const [dir]=process.argv.slice(2);
const shas={gel:'d0e7527ca8033bd805a6d7a8bb021eff62e87021',candidat:'fab19fba7cc5e5ac5cd79da53c81fb3ab23b492a'};
const arms=['nominal','stationnaire-t1','stationnaire-t2','sans-progression','sans-paire','ancienne-référence'];
const tree=sha=>execFileSync('git',['rev-parse',sha+':src'],{encoding:'utf8'}).trim();
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
assert.equal(tree(shas.gel),tree(shas.candidat));
const cases=Object.keys(shas).map(engine=>Object.fromEntries(arms.map(arm=>{
  const {sha,arm:name,...r}=JSON.parse(readFileSync(join(dir,engine+'.'+arm+'.json'),'utf8'));
  assert.deepEqual([sha,name],[shas[engine],arm]);
  for(const cut of [...r.steps.map(x=>x.pre.cut),r.next?.cut].filter(Boolean))assert.equal(hash(cut.pre),cut.seal);
  return [arm,r];
})));
assert.deepEqual(cases[0],cases[1]);
const c=cases[0],n=c.nominal.steps,p=(x,i)=>x[i-1].pre,r=(x,i)=>x[i-1].after;
const command=x=>[x,{}],click=(x,y)=>['ACTION6',{x,y}];
for(const start of Object.values(c))for(let i=0;i<start.steps.length-1;i++)assert.equal(start.steps[i].after.ref,start.steps[i+1].pre.ref);
assert.equal(n.length,16);
assert.ok(n.every(s=>s.pre.family==='public_occurrence_recall'&&s.pre.kind==='coupled_prefix_reference'&&s.after.levels===0));
const first=p(n,1),plan=first.plan;
assert.deepEqual([first.command,plan.mode,plan.controller.axis,plan.controller.color,first.cut.pre.layout.reference.origin,
  first.cut.pre.layout.reference.scale,first.cut.pre.layout.controllers.length],
  [click(15,20),'select',0,14,[57,53],[2,2],6]);
assert.deepEqual([r(n,1).matched,r(n,1).record.events,r(n,1).record.slot,r(n,1).record.state.selected],
  [null,[],null,plan.controller.key]);
const t2=p(n,2),a2=r(n,2).record;
assert.deepEqual([t2.command,t2.plan.intent.cell,r(n,2).matched,a2.slot,a2.events.map(e=>e.kind),a2.state.questions[0].source],
  [command('ACTION1'),[0,0],true,{cell:[0,0],changed:true,before:0,after:14},['crossed_prefix_input'],r(n,2).ref]);
assert.deepEqual([p(n,3).plan.mode,p(n,3).command],['select',click(20,15)]);
assert.deepEqual([p(n,4).command,r(n,4).matched,r(n,4).record.state.blocked.at(-1)],
  [command('ACTION2'),false,{context:['1:0:-1',0,'ACTION1'],action:'ACTION2',evidence:r(n,4).ref}]);
const pair=r(n,5).record.events.find(e=>e.kind==='crossed_prefix_pair'),t7=p(n,7);
assert.deepEqual([pair.inputs,pair.owner,pair.visible_palette,pair.evidence,pair.epoch],
  [{0:'ACTION1',1:'ACTION3'},0,14,[p(n,5).ref,r(n,5).ref],1]);
assert.deepEqual([p(n,6).command,t7.command,t7.plan.intent.cell,t7.plan.intent.predicted_pair,r(n,7).matched],
  [click(15,20),command('ACTION1'),[1,0],pair,true]);
assert.deepEqual(t7.refs,[t7.ref,t7.plan.state.ref,...pair.evidence]);
const scope=t7.scope,deny={admitted:false,reason:'crossed_prefix_context_changed'};
assert.deepEqual([scope.live.admitted,scope.stale,scope.contrary,scope.contraryAtMatchingDigest,scope.contraryReturn],
  [true,deny,deny,deny,{matched:false,seal_prefix:true,reason:'reference_changed_unexpectedly'}]);

const held=c['stationnaire-t1'];
assert.deepEqual(held.steps[0],n[0]);assert.deepEqual(held.next,p(n,2));
const stalled=c['stationnaire-t2'],a=r(stalled.steps,2);
assert.deepEqual(p(stalled.steps,2),t2);assert.equal(a.packet,r(n,2).packet);
assert.deepEqual([a.matched,a.record.slot,a.record.events,a.record.state.progress[plan.controller.key],stalled.next.command],
  [false,{cell:[0,0],changed:false,before:0,after:0},[],0,command('ACTION2')]);

const withoutProgress=c['sans-progression'].steps;
assert.deepEqual(withoutProgress.slice(0,2),n.slice(0,2));
assert.deepEqual([p(withoutProgress,3).ref,p(withoutProgress,3).command,p(withoutProgress,3).plan.intent.cell,r(withoutProgress,3).matched],
  [p(n,3).ref,command('ACTION1'),[0,0],false]);
const withoutPair=c['sans-paire'].steps,b=p(withoutPair,7);
assert.deepEqual(withoutPair.slice(0,6),n.slice(0,6));
assert.deepEqual([b.cut.pre.canonical,b.cut.pre.incomingPairs,b.cut.pre.pairs,b.cut.pre.axisInputs,b.ref,b.family,b.command],
  [t7.cut.pre.canonical,[pair],[],t7.cut.pre.axisInputs,t7.ref,'information_goal',click(28,61)]);
assert.ok(r(withoutPair,7).packet);

const old=c['ancienne-référence'].steps,m=p(old,7),ref=r(n,2).ref;
assert.deepEqual(old.slice(0,6),n.slice(0,6));
assert.ok(!pair.evidence.includes(ref));
assert.deepEqual([m.cut.pre.canonical,m.cut.pre.incomingPairs,m.cut.pre.pairs,m.cut.pre.axisInputs],
  [t7.cut.pre.canonical,[pair],[{...pair,evidence:[ref,pair.evidence[1]]}],t7.cut.pre.axisInputs]);
assert.deepEqual(m.plan.intent.predicted_pair,{...pair,evidence:[ref,pair.evidence[1]]});
assert.deepEqual([m.command,m.refs,m.guard.admitted,r(old,7).packet,r(old,7).matched],
  [t7.command,[...t7.refs.slice(0,-2),ref,pair.evidence[1]],true,r(n,7).packet,true]);
const stats=Object.entries(shas).map(([engine,sha],i)=>({engine,sha,départs:arms.length,gestes:Object.values(cases[i]).reduce((n,r)=>n+r.steps.length,0)}));
console.log(JSON.stringify({stats,moteur:tree(shas.gel),catalogue:16,score:r(n,16).levels,
  repriseT7:{action:t7.command[0],sansPaire:b.family,référenceAntérieureAdmise:m.guard.admitted,mêmePaquet:r(old,7).packet===r(n,7).packet}},null,2));
