import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const dir=process.argv[2];
const groups={nominal:16,'catalogue-incomplet':1,stationnaire:1,multifactoriel:1,'sans-arete':2,
  'petite-reserve':6,'contre-exemple':3,'multifactoriel-n2':5,'contre-exemple-n2':10};
const load=(version,arm)=>JSON.parse(readFileSync(join(dir,version+'.'+arm+'.json'),'utf8'));
const cases={};
for(const [arm,gestures] of Object.entries(groups)){
  const {sha:gel,...reference}=load('gel',arm);
  const {sha:candidate,...comparison}=load('candidat',arm);
  assert.equal(gel,'d0e7527ca8033bd805a6d7a8bb021eff62e87021');
  assert.equal(candidate,'07e70e95d36a9c9543927fda8dc1a9193a011fdd');
  assert.equal(reference.steps.length,gestures,arm);
  assert.deepEqual(reference,comparison,arm);
  cases[arm]=reference;
}

const nominal=cases.nominal.steps;
assert.equal(nominal.filter(s=>s.pre.kind==='factor_product_experiment').length,13);
for(const [i,before,after,edges] of [[0,[4,4],[9,4],1],[1,[9,4],[9,8],2]]){
  const step=nominal[i];
  assert.equal(step.pre.plan.step.after_values,null);
  assert.deepEqual([step.after.record.before,step.after.record.after,step.after.record.state.edges.length],[before,after,edges]);
}
const third=nominal[2];
assert.equal(third.pre.guard.admitted,true);
assert.equal(third.pre.plan.estimate.status,'COMPLETE');
assert.ok(third.pre.plan.estimate.assumptions.includes('local_effect_independence_remains_conditional'));
assert.deepEqual([third.pre.plan.step.relation_observed,third.pre.plan.step.after_values,third.after.levels,third.after.matched],
  [false,[4,8],1,false]);
assert.equal(cases.stationnaire.steps[0].after.record.state.edges.length,0);
assert.equal(cases['catalogue-incomplet'].steps[0].pre.plan,null);
assert.deepEqual(cases['sans-arete'].next.command,['ACTION6',{x:38,y:20}]);
assert.equal(cases['sans-arete'].next.plan.step.after_values,null);
assert.equal(cases['petite-reserve'].next.cut.result.reason,'factor_product_has_no_supported_bounded_route');
assert.equal(cases['petite-reserve'].next.kind,'containment_and_contact');

const conflicts=[];
for(const [source,retained,i,edgeCount,afterValues] of [
  ['multifactoriel','contre-exemple',2,0,[9,8]],
  ['multifactoriel-n2','contre-exemple-n2',8,1,[4,8,4]],
]){
  const acquired=cases[source].steps.at(-1);
  const measurement=acquired.after.record;
  const used=cases[retained].steps[i];
  const before=used.pre.cut.pre.used;
  const witness=measurement.state.counterexamples[0];
  assert.deepEqual([measurement.after,measurement.state.edges.length,witness.changed_factors],[afterValues,edgeCount,[0,1]]);
  assert.deepEqual(witness.evidence,[acquired.pre.ref,acquired.after.ref]);
  assert.deepEqual([before.epoch,before.geometry],[measurement.state.epoch,measurement.state.geometry]);
  assert.deepEqual(before.counterexamples,[witness]);
  assert.deepEqual(before.edges,nominal[i].pre.cut.pre.used.edges);
  assert.deepEqual(witness.command,{action_ref:used.pre.command[0],data:used.pre.command[1]});
  for(const j of i===8?[8,9]:[2]){
    const baseline=nominal[j],variant=cases[retained].steps[j];
    for(const key of ['command','ticket','scope','guard','plan'])assert.deepEqual(variant.pre[key],baseline.pre[key],key);
    for(const key of ['packet','matched','ref','levels','physical'])assert.deepEqual(variant.after[key],baseline.after[key],key);
  }
  conflicts.push({tour:i+1,commande:used.pre.command,origine:witness.evidence,epoque:before.epoch,
    observations:before.edges.length,observée:used.pre.plan.step.relation_observed,admis:used.pre.guard.admitted,
    premierÉcart:'contre-exemple présent dans le journal, ticket et retour identiques'});
}
assert.equal(nominal[8].pre.plan.step.relation_observed,true);
assert.equal(nominal[8].after.matched,true);
assert.deepEqual(nominal[9].pre.plan.step.before_values,[4,8,11]);
assert.equal(nominal[9].pre.guard.admitted,true);
assert.equal(nominal[9].after.levels,2);

console.log(JSON.stringify({stats:{versions:2,départsParVersion:Object.keys(groups).length,
  gestesParVersion:Object.values(groups).reduce((n,v)=>n+v,0),catalogue:16,famille:13,
  contreExemplesParVersion:2,contreExemplesBloquantLePlan:0},conflicts},null,2));
