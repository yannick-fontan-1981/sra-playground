import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const dir=process.argv[2],versions={gel:'d0e7527ca8033bd805a6d7a8bb021eff62e87021',
  candidat:'4e1760327c1aea9031654e7de7c26da3ae19cf7b'};
const sizes={nominal:16,'ordre-reference':3,'ordre-entrees':4,'autre-contenu':5,'depot-absent':5,'ordre-reference-joue':4};
const cases={};
for(const [arm,n] of Object.entries(sizes)){
  const [gel,candidate]=Object.entries(versions).map(([version,sha])=>{
    const {sha:seen,...data}=JSON.parse(readFileSync(join(dir,version+'.'+arm+'.json'),'utf8'));
    assert.equal(seen,sha);assert.equal(data.arm,arm);assert.equal(data.steps.length,n);
    return data;
  });
  assert.deepEqual(gel,candidate);
  cases[arm]=gel;
}
const n=cases.nominal.steps,selection=n[2],deposit=n[3];
const layout=x=>x.pre.cut.pre.layout;
assert.equal(n.filter(x=>x.pre.kind==='ordered_slot_substitution').length,11);
assert.deepEqual(layout(selection).hues,[14,15,9,11]);
assert.deepEqual(layout(selection).targets,[9,14,11,15]);
assert.deepEqual(selection.pre.command,['ACTION6',{x:35,y:58}]);
assert.equal(selection.pre.plan.op,'select');
assert.deepEqual(selection.after.record.occupancy,[[true,true,true,true],[null,null,null,null],2]);
assert.equal(selection.after.matched,true);
assert.deepEqual(deposit.pre.command,['ACTION6',{x:22,y:29}]);
assert.ok(deposit.pre.refs.includes(selection.after.ref));
assert.ok(deposit.pre.refs.includes(selection.pre.ref));
assert.deepEqual(deposit.after.record.occupancy,[[true,true,false,true],[9,null,null,null],null]);
assert.equal(deposit.after.matched,true);
assert.equal(deposit.pre.scope.stale.admitted,false);
assert.deepEqual(cases['ordre-entrees'].steps,n.slice(0,4));

const order=cases['ordre-reference'],played=cases['ordre-reference-joue'];
assert.deepEqual(order.steps,played.steps.slice(0,3));
const p=played.steps[2],d=played.steps[3];
for(const k of ['inventory','hues','slots'])assert.deepEqual(layout(p)[k],layout(selection)[k]);
assert.deepEqual(p.pre.plan.layout.required_values,[14,9,11,15]);
assert.deepEqual(p.pre.command,['ACTION6',{x:19,y:58}]);
assert.deepEqual(d.pre.command,deposit.pre.command);
assert.deepEqual(d.pre.plan.after,[[false,true,true,true],[14,null,null,null],null]);
assert.deepEqual(d.after.record.occupancy,d.pre.plan.after);
assert.equal(d.after.matched,true);
assert.equal(d.after.physical,d.after.presented);
assert.equal(d.after.levels,0);

const rejected=[];
for(const [arm,color] of [['autre-contenu',14],['depot-absent',null]]){
  const choice=cases[arm],altered=choice.steps[3];
  assert.deepEqual(choice.steps.slice(0,3),n.slice(0,3));
  assert.deepEqual(altered.pre,deposit.pre);
  assert.equal(altered.after.packet,deposit.after.packet);
  assert.notEqual(altered.after.physical,altered.after.presented);
  assert.deepEqual(altered.after.record.occupancy,[[true,true,false,true],[color,null,null,null],null]);
  assert.deepEqual([altered.after.matched,altered.after.seal,altered.after.record.status,altered.after.record.known],
    [false,true,'retired',['select']]);
  assert.notEqual(choice.steps[4].pre.kind,deposit.pre.kind);
  rejected.push({arm,dépôtPrésenté:color,retour:altered.after.ref,suivant:choice.steps[4].pre.command});
}
assert.equal(n[5].pre.plan.steps.length,7);
assert.deepEqual(n[11].pre.plan.before[1],[9,14,11,15]);
assert.equal(n[11].after.levels,1);
assert.deepEqual(n[13].pre.plan.layout.required_values,[12,15,8,9,14,11,6]);
assert.deepEqual(n[14].pre.command,['ACTION6',{x:22,y:22}]);
assert.equal(n[14].after.record.occupancy[1][0],12);
console.log(JSON.stringify({stats:{versions:2,départsParVersion:Object.keys(sizes).length,
  gestesParVersion:Object.values(sizes).reduce((a,b)=>a+b,0),catalogue:16,occurrencesFamille:11,niveauxTerminés:1},
  substitution:{nominale:deposit.after.record.occupancy[1],permutée:d.after.record.occupancy[1],ticket:d.pre.command},
  rejetés:rejected},null,2));
