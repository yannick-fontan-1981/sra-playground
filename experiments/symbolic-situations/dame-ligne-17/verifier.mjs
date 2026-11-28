import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const dir=process.argv[2],shas={gel:'d0e7527ca8033bd805a6d7a8bb021eff62e87021',
  candidat:'775f40c5505add040d3b1c1aac5aba8d0dd0a027'};
const sizes={nominal:16,'une-invitation':2,'sans-invitation':2,'victime-preservee':3,'sans-relation-n1':3,'sans-relation-n2':9};
const cases={};
for(const [arm,n] of Object.entries(sizes)){
  const [gel,candidate]=Object.entries(shas).map(([version,expected])=>{
    const {sha,...r}=JSON.parse(readFileSync(join(dir,version+'.'+arm+'.json'),'utf8'));
    assert.equal(sha,expected);assert.equal(r.arm,arm);assert.equal(r.steps.length,n);
    return r;
  });
  assert.deepEqual(gel,candidate);
  cases[arm]=gel;
}

const n=cases.nominal.steps,first=n[0],two=n[1],three=n[2],eight=n[7],nine=n[8];
const relation=Object.keys(two.after.record.state.relations).at(0);
const refs=e=>e.after.record.state.refs;
assert.equal(first.pre.kind,'invited_population_reduction');
assert.deepEqual(first.pre.command,['ACTION6',{x:31,y:19}]);
assert.equal(first.pre.plan.mode,'select');
assert.equal(first.after.matched,true);
const initial=first.after.record;
assert.deepEqual(initial.before.population,initial.after.population);
assert.equal(initial.after.population.length,5);
assert.deepEqual(initial.state.invites,[[0,2],[4,2]]);
assert.deepEqual(initial.state.relations,{});
assert.deepEqual(two.pre.command,['ACTION6',{x:17,y:33}]);
assert.equal(two.pre.plan.mode,'probe');
assert.equal(two.after.matched,null);
assert.equal(two.after.record.after.population.length,4);
assert.equal(two.after.record.result.events[0].kind,'observed_consumed_intermediate');
assert.ok(refs(two).includes(two.after.ref));
assert.ok(three.pre.refs.includes(two.after.ref));
assert.equal(three.pre.plan.mode,'capture');
assert.equal(three.pre.plan.states,8);
assert.equal(three.after.matched,true);

const one=cases['une-invitation'].steps,both=cases['sans-invitation'].steps;
assert.equal(one[0].after.packet,first.after.packet);
assert.equal(both[0].after.packet,first.after.packet);
assert.deepEqual(one[0].after.record.state.invites,[[4,2]]);
assert.deepEqual(both[0].after.record.state.invites,[]);
assert.deepEqual(one[1].pre.command,['ACTION6',{x:45,y:33}]);
assert.deepEqual(both[1].pre.command,['ACTION6',{x:24,y:26}]);
assert.equal(one[1].after.record.after.population.length,4);
assert.equal(both[1].after.record.after.population.length,5);

const save=cases['victime-preservee'].steps;
assert.deepEqual(save[1].pre,two.pre);
assert.equal(save[1].after.packet,two.after.packet);
assert.deepEqual(cases['victime-preservee'].change.victim.cell,[1,1]);
assert.equal(save[1].after.record.after.population.length,5);
assert.deepEqual(save[1].after.record.state.relations,{});
assert.deepEqual(save[2].pre.command,both[1].pre.command);
assert.notEqual(save[2].pre.plan.mode,three.pre.plan.mode);

for(const [name,index,before,after,states] of [
  ['sans-relation-n1',2,'capture','probe',8],
  ['sans-relation-n2',7,'select','select',33],
]){
  const d=cases[name].steps[index],auth=n[index];
  assert.equal(d.pre.cut.pre.input,auth.pre.cut.pre.input);
  assert.ok(Object.hasOwn(d.pre.cut.pre.memory.relations,relation));
  assert.deepEqual(d.pre.cut.relationsServies,{});
  assert.deepEqual(d.pre.command,auth.pre.command);
  assert.equal(d.after.packet,auth.after.packet);
  assert.deepEqual([auth.pre.plan.mode,d.pre.plan.mode],[before,after]);
  assert.equal(auth.pre.plan.states,states);
  assert.equal(d.pre.plan.steps.length,1);
  assert.equal(d.pre.guard.admitted,true);
}
assert.equal(cases['sans-relation-n1'].steps[2].after.record.after.population.length,3);
assert.equal(eight.pre.plan.before.length,7);
assert.equal(eight.pre.plan.steps.length,8);
assert.equal(nine.pre.plan.expected.length,6);
assert.equal(nine.after.matched,true);
assert.deepEqual(n.filter((r,i)=>r.after.levels>(n[i-1]?.after.levels??0)).map(r=>r.i),[7,15]);

console.log(JSON.stringify({stats:{versions:2,départsParVersion:Object.keys(sizes).length,
  gestesParVersion:Object.values(sizes).reduce((a,b)=>a+b,0),catalogue:16,niveauxTerminés:2},
  relation:{clé:relation,preuve:two.after.ref,populationAvant:5,populationAprès:4,
    n1SansRelation:'probe',n2NombrePas:[eight.pre.plan.steps.length,1]},
  repliSansIntermédiaire:save[2].pre.command},null,2));
