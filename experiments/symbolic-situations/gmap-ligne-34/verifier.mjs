import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const [dir]=process.argv.slice(2);
const shas={gel:'d0e7527ca8033bd805a6d7a8bb021eff62e87021',candidat:'9c71cd820b59ef3456455b637a0a062abe1d03d0'};
const arms=['nominal','sans-repere','stationnaire','sans-localisation','inverse-localisation','sans-permission','inverse-commune','inverse-cohérente'];
const tree=sha=>execFileSync('git',['rev-parse',sha+':src'],{encoding:'utf8'}).trim();
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
assert.equal(tree(shas.gel),tree(shas.candidat));
const read=(engine,arm)=>JSON.parse(readFileSync(join(dir,engine+'.'+arm+'.json'),'utf8'));
const cases=Object.keys(shas).map(engine=>Object.fromEntries(arms.map(arm=>{
  const {sha,arm:name,...r}=read(engine,arm);
  assert.deepEqual([sha,name],[shas[engine],arm]);
  for(const cut of [...r.steps.map(x=>x.pre.cut),r.next?.cut,r.lastCut].filter(Boolean))assert.equal(hash(cut.pre),cut.seal);
  return [arm,r];
})));
assert.deepEqual(cases[0],cases[1]);
const c=cases[0],n=c.nominal.steps,p=(x,i)=>x[i-1].pre,r=(x,i)=>x[i-1].after;
const travel=o=>o.alternatives.map(path=>path[0].delta);
const command=x=>[x,{}];
const chart=(x,i,action)=>{
  const q=p(x,i),ret=r(x,i);
  assert.deepEqual([q.family,q.kind,q.command,q.guard.admitted,q.bundle,q.plan.root,ret.matched,ret.seal],
    ['public_chart_navigation','public_chart_navigation',command(action),true,'OP18','G_official_completion',null,true]);
  assert.deepEqual(ret.record.result.evidence,[q.ref,ret.ref]);
  return q.plan.offer;
};
for(const run of Object.values(c))for(let i=0;i<run.steps.length-1;i++)assert.equal(run.steps[i].after.ref,run.steps[i+1].pre.ref);
const start=p(n,1).cut.pre,first=chart(n,1,'ACTION4'),after1=r(n,1).record;
assert.deepEqual([start.decoded.current,start.decoded.nodes.length,start.decoded.pitch,first.target,first.annotation,first.held],
  [[23,28],6,6,[29,22],10,[]]);
assert.deepEqual(first.route.map(x=>[x.from,x.to,x.delta]),[[[23,28],[29,28],[1,0]],[[29,28],[29,22],[0,-1]]]);
assert.deepEqual([after1.sceneChanged,after1.result.position,after1.memory.status,after1.oldHeld,after1.newHeld,r(n,1).levels],
  [true,[29,28],'conditional_arrival_scene_changed_not_unique_world_proof',[],[],0]);
chart(n,2,'ACTION1');chart(n,3,'ACTION2');chart(n,4,'ACTION4');const common=chart(n,5,'ACTION4');
assert.ok(p(n,2).refs.includes(r(n,1).ref));
assert.deepEqual([r(n,2).record.result.position,r(n,2).record.newHeld],[ [29,22],[10] ]);
const exit=r(n,3).record,grant=exit.memory.grants[0];
assert.deepEqual([exit.oldHeld,exit.newHeld,grant.from,grant.to,grant.status],
  [[10],[],[29,28],[35,28],'local_permission_hypothesis_not_confirmed_transaction']);
assert.deepEqual(p(n,4).cut.pre.state.grants,[grant]);
assert.deepEqual([r(n,4).record.result.location_alternatives,r(n,4).record.result.position,r(n,4).record.sceneChanged],
  [[[29,28],[35,28]],null,false]);
assert.deepEqual([common.start,travel(common),r(n,5).levels,p(n,6).level,p(n,6).plan.offer.target],
  [[[29,28],[35,28]],[[1,0],[1,0]],1,2,[32,19]]);

const bare=c['sans-repere'].steps;
assert.equal(p(bare,1).cut.pre.input,start.input);
assert.equal(p(bare,1).cut.pre.changed.length,4);assert.deepEqual(p(bare,1).cut.pre.offers,[]);
assert.deepEqual([p(bare,1).family,p(bare,1).command,p(bare,2).family,p(bare,2).command],
  ['observed_frontier',command('ACTION1'),'public_chart_navigation',command('ACTION4')]);
const still=c.stationnaire;
assert.deepEqual(p(still.steps,1),p(n,1));
const hold=r(still.steps,1);
assert.deepEqual([hold.packet,hold.presented,hold.record.sceneChanged,hold.record.result.location_alternatives,
  hold.record.memory.gains,hold.levels],[r(n,1).packet,hold.presented,false,[[23,28],[29,28]],[],0]);
assert.notEqual(hold.presented,hold.physical);

for(const [key,positions] of [['sans-localisation',[[23,28],[29,28]]],['inverse-localisation',[[29,28],[23,28]]]]){
  const x=c[key].steps,choice=p(x,2).cut.pre;
  assert.deepEqual(x.slice(0,1),n.slice(0,1));
  assert.deepEqual([choice.input,choice.state.positions,choice.offers,p(x,2).family,p(x,2).command],
    [p(n,2).cut.pre.input,positions,[],'observed_frontier',command('ACTION1')]);
  assert.equal(r(x,2).packet,r(n,2).packet);
  assert.ok(!r(x,2).record.owned);
}
const removal=c['sans-permission'].steps,without=p(removal,4).cut.pre;
assert.deepEqual(removal.slice(0,3),n.slice(0,3));
assert.deepEqual([without.input,without.incoming.grants,without.state.grants,without.offers,p(removal,4).family,p(removal,4).command],
  [p(n,4).cut.pre.input,[grant],[],[],'observed_frontier',command('ACTION3')]);
const local=c['inverse-commune'],consistent=c['inverse-cohérente'];
for(const k of [local,consistent]){
  assert.deepEqual(k.steps.slice(0,4),n.slice(0,4));
  const pre=k.lastCut.pre;
  assert.deepEqual([pre.input,pre.state.positions,pre.offers.length,pre.offers[0].action,travel(pre.offers[0])],
    [p(n,5).cut.pre.input,[...common.start].reverse(),1,'ACTION4',[[1,0],[1,0]]]);
  assert.equal(k.lastCheck[0],p(n,5).ref);
}
assert.deepEqual([local.lastCheck[1].live.admitted,local.steps.length,local.stop,local.next],[false,4,'no_admissible_prefix',null]);
assert.equal(consistent.lastCheck[1].live.admitted,true);
assert.deepEqual([p(consistent.steps,5).command,r(consistent.steps,5).packet,r(consistent.steps,5).levels],
  [p(n,5).command,r(n,5).packet,1]);
const contrast=read('gel','contraste');
assert.deepEqual(contrast,read('candidat','contraste'));
assert.equal(contrast.fixture,'reference-01');
assert.ok(contrast.contrary[0].result.events.includes('predicted_arrival_refuted_by_current_anchor'));
assert.deepEqual(contrast.contrary[0].result.position,[46,10]);
assert.deepEqual([contrast.inventory.sameScene,contrast.inventory.location,contrast.inventory.held.inventory,contrast.inventory.empty],
  [true,[[22,10]],[4],{inventory:[],plan:null}]);
const witness=contrast.primary[1].result.events.find(x=>x.inventory_loss_and_local_boundary_change);
assert.equal(witness.inventory_loss_and_local_boundary_change.status,'local_permission_hypothesis_not_confirmed_transaction');

const stats=Object.entries(shas).map(([engine,sha],i)=>({engine,sha,départs:arms.length,gestes:Object.values(cases[i]).reduce((n,r)=>n+r.steps.length,0),contrasteConstruit:1}));
const count=n.filter(s=>s.pre.family==='public_chart_navigation').length;
console.log(JSON.stringify({stats,moteur:tree(shas.gel),catalogue:16,occurrences:count,
  permission:{de:grant.from,vers:grant.to,statut:grant.status},
  pasCommun:{positions:common.start,action:common.action,ordreOffreSeuleAdmis:local.lastCheck[1].live.admitted,
    ordreCohérentAdmis:consistent.lastCheck[1].live.admitted,gain:r(n,5).levels}},null,2));
