import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const dir=process.argv[2],versions={gel:'d0e7527ca8033bd805a6d7a8bb021eff62e87021',
  candidat:'dc9314cc1ebdfc4ac4888d5ad0e7bfa0fb62542f'};
const groups={nominal:16,stationnaire:1,'soeur-modifiee':1,'stationnaire-coupe':2,'sans-ajout':3,'sans-coupe':3};
const cases={};
for(const [arm,steps] of Object.entries(groups)){
  const [gel,candidate]=Object.entries(versions).map(([v,id])=>{
    const {sha,...r}=JSON.parse(readFileSync(join(dir,v+'.'+arm+'.json'),'utf8'));
    assert.equal(sha,id);assert.equal(r.arm,arm);assert.equal(r.steps.length,steps);
    return r;
  });
  assert.deepEqual(gel,candidate);
  cases[arm]=gel;
}
const n=cases.nominal.steps;
const flags=x=>[x.addition,x.cut],first=n[0],second=n[1],third=n[2];
assert.deepEqual(first.pre.plan.before,[0,0,0]);
assert.equal(first.pre.plan.predicted,null);
assert.deepEqual(first.pre.command,['ACTION6',{x:21,y:21}]);
assert.deepEqual(second.pre.plan.before,[3,0,0]);
assert.deepEqual(second.pre.command,['ACTION6',{x:21,y:35}]);
assert.deepEqual(third.pre.plan.before,[1,0,0]);
assert.deepEqual(flags(first.after.record.event.model),[true,false]);
assert.deepEqual(flags(second.after.record.event.model),[true,true]);
for(const x of [first,second])assert.deepEqual(x.after.record.event.refs,[x.pre.ref,x.after.ref]);
assert.deepEqual(third.pre.plan.desired,[[1],[2],[1]]);
assert.deepEqual([third.pre.plan.predicted,third.after.matched,third.after.seal],[[1,2,0],true,false]);
assert.equal(n[3].pre.index,1);
assert.equal(n[3].after.levels,1);
assert.equal(n[3].after.matched,null);
assert.deepEqual(n.filter((s,i)=>s.after.levels>(n[i-1]?.after.levels??0)).map(s=>s.i),[4,7,11,15]);
for(const [name,i,reason,error] of [
  ['stationnaire',0,'indexed_edit_response_not_supported',[false,false]],
  ['soeur-modifiee',0,'indexed_edit_owner_or_prefix_refuted',[false,false]],
  ['stationnaire-coupe',1,'indexed_edit_response_not_supported',[true,false]],
]){
  const r=cases[name],s=r.steps[i];
  assert.deepEqual(s.pre,n[i].pre);
  assert.equal(s.after.packet,n[i].after.packet);
  assert.equal(s.after.record.event.stop,reason);
  assert.equal(r.stop,reason);
  assert.equal(r.next,null);
  assert.deepEqual(flags(s.after.record.event.model),error);
}
for(const [name,expected] of [['sans-ajout',[false,true]],['sans-coupe',[true,false]]]){
  const r=cases[name],s=r.steps[2];
  assert.equal(s.pre.cut.pre.input,third.pre.cut.pre.input);
  assert.deepEqual(flags(s.pre.cut.pre.original),[true,true]);
  assert.deepEqual(flags(s.pre.cut.pre.prior),expected);
  assert.notDeepEqual(s.pre.command,third.pre.command);
  assert.ok(s.pre.guard.admitted);
  assert.equal(r.next.plan.phase,'realize_conditional_joint_prefixes');
}
assert.equal(cases['sans-ajout'].steps[2].pre.plan.phase,'discriminate_local_effect_from_rooted_prefix');
assert.equal(cases['sans-coupe'].steps[2].pre.cut.local.reason,'no_observed_long_prefix_for_cut_contrast');
assert.notEqual(cases['sans-coupe'].steps[2].pre.family,third.pre.family);

const [archive,candidateArchive]=Object.keys(versions).map(v=>JSON.parse(readFileSync(join(dir,v+'.archive.json'),'utf8')));
assert.deepEqual(archive,candidateArchive);
const {nominal,control}=archive;
assert.deepEqual(nominal.marks,[[3,3,4,3,1],[2,3,4,3,2]]);
assert.deepEqual(control.marks,[[3,3,4,3,2],[2,3,4,3,2]]);
assert.deepEqual(control.marks[1],nominal.marks[1]);
const totals=marks=>marks.map(a=>a.reduce((s,v)=>s+v,0));
assert.deepEqual(totals(nominal.marks),[14,14]);
assert.deepEqual(totals(control.marks),[15,14]);
assert.equal(control.cause,'EMPTY_DOMAIN_CONTRADICTION');
assert.equal(control.refusal,'conditional_prefix_marginals_not_singleton');
assert.deepEqual(nominal.domains,n[15].pre.plan.desired);
assert.deepEqual(n[15].pre.plan.predicted,[4,0,0,0,0,0]);
assert.equal(n[15].after.matched,true);
console.log(JSON.stringify({stats:{versions:2,départsServiceParVersion:6,
  gestesParVersion:Object.values(groups).reduce((a,b)=>a+b,0),contrôlesArchivesParVersion:1,catalogue:16,
  niveauxTerminés:4},projection:third.pre.plan.desired,archive:{local:control.marks[1],totauxNominaux:totals(nominal.marks),
    totauxAltérés:totals(control.marks),cause:control.cause,offre:null}},null,2));
