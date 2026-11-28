import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const dir=process.argv[2];
const groups={nominal:16,stationnaire:1,'sans-controles-retenus':2,'sans-reutilisation':2,
  'n1-invariance':0,'n2-extremites':8,'n2-interieur':8};
const load=(version,arm)=>JSON.parse(readFileSync(join(dir,version+'.'+arm+'.json'),'utf8'));
const variants={};
for(const [arm,gestures] of Object.entries(groups)){
  const {sha:baseline,...reference}=load('gel',arm);
  const {sha:candidate,...comparison}=load('candidat',arm);
  assert.equal(baseline,'d0e7527ca8033bd805a6d7a8bb021eff62e87021');
  assert.equal(candidate,'fad120b559f52767208ba2620dd48b5a5f530dff');
  assert.equal(reference.steps.length,gestures);
  assert.deepEqual(reference,comparison);
  variants[arm]=reference;
}

const nominal=variants.nominal.steps;
const [one,two]=nominal;
const nine=nominal[8].pre;
const score=nominal.filter((s,i)=>s.after.levels>(nominal[i-1]?.after.levels??0)).map(s=>s.i);
assert.deepEqual(score,[8,16]);
for(const {i,pre,after} of nominal){
  assert.equal(pre.kind,'labeled_sequence_experiment');
  assert.equal(pre.guard.admitted,true);
  assert.equal(pre.scope.live.admitted,true);
  assert.equal(pre.scope.replaced.admitted,false);
  assert.equal(pre.scope.stale.admitted,false);
  assert.equal(pre.plan.inference.agreement,true);
  assert.equal(pre.plan.inference.modelUnique,false);
  assert.equal(pre.plan.inference.created,false);
  assert.equal(pre.plan.inference.training.refs.length,20);
  assert.equal(after.matched,null);
  assert.equal(after.seal,true);
  assert.deepEqual([after.record.before_ref,after.record.after_ref],[pre.ref,after.ref]);
  assert.equal(after.record.official_progress,score.includes(i));
}
assert.equal(two.pre.plan.inference.reused,true);
assert.deepEqual(one.pre.plan.inference.training.refs,two.pre.plan.inference.training.refs);
assert.equal(one.pre.plan.inference.training.featuresHash,two.pre.plan.inference.training.featuresHash);
assert.equal(two.pre.cut.pre.recent[0].ref,one.after.ref);
assert.deepEqual(two.pre.cut.pre.recent[0].command,one.after.record.command);
assert.notDeepEqual(one.pre.command,two.pre.command);
assert.equal(nine.plan.inference.reused,false);
assert.notEqual(nine.plan.inference.training.featuresHash,two.pre.plan.inference.training.featuresHash);
const labelAt=(level,word)=>(level===1?word.includes(8):word[0]===word.at(-1))?15:12;
for(const [s,level,feature] of [[one.pre,1,'COUNT:8'],[nine,2,'ENDPOINT_EQUAL']]){
  const examples=s.cut.pre.examples.examples;
  assert.deepEqual(examples.map(p=>[p.label,p.words.length]),[[15,10],[12,10]]);
  for(const p of examples)for(const word of p.words)assert.equal(labelAt(level,word),p.label);
  assert.equal(s.plan.inference.tests.length,2);
  assert.ok(s.plan.inference.tests.every(predicate=>predicate.feature===feature));
}

const recomputed=variants['sans-reutilisation'].steps[1].pre;
assert.equal(recomputed.plan.inference.reused,false);
assert.equal(recomputed.plan.inference.training.featuresHash,two.pre.plan.inference.training.featuresHash);
assert.deepEqual(recomputed.plan.inference.training.refs,two.pre.plan.inference.training.refs);
assert.notEqual(recomputed.plan.inference.training.hash,two.pre.plan.inference.training.hash);
assert.deepEqual(recomputed.command,two.pre.command);
const noControl=variants['sans-controles-retenus'].steps[1].pre;
assert.equal(noControl.ref,two.pre.ref);
assert.deepEqual(noControl.cut.pre.reference.refs,noControl.cut.pre.used.refs);
assert.ok(noControl.cut.pre.reference.controls.length>0);
assert.equal(noControl.cut.pre.used.controls.length,0);
assert.equal(noControl.cut.result.reason,'no_recurrent_line_question');
assert.deepEqual(noControl.command,['ACTION6',{x:10,y:11}]);
const still=variants.stationnaire;
assert.equal(still.steps[0].after.packet,one.after.packet);
assert.notEqual(still.steps[0].after.physical,still.steps[0].after.presented);
assert.equal(still.steps[0].after.record.physical_receipt_status,'unchanged_public_context');
assert.equal(still.next.cut.result.reason,'identical_labeled_submission_context_already_observed');

const permutations=[];
for(const [id,expected,reference,label] of [
  ['n1-invariance',[9,9,8,9],one.pre,15],
  ['n2-extremites',[11,8,11,9,11],nine,15],
  ['n2-interieur',[9,11,8,11,11],nine,12],
]){
  const variation=variants[id],{contrast,next}=variation;
  assert.deepEqual(contrast.used.query.values,expected);
  assert.deepEqual([...expected].sort(),[...contrast.base.query.values].sort());
  for(const field of ['context','examples','buttons','queryScale','palette'])
    assert.deepEqual(contrast.used[field],contrast.base[field]);
  assert.equal(next.plan.inference.training.featuresHash,reference.plan.inference.training.featuresHash);
  assert.equal(next.plan.label,label);
  assert.equal(next.guard.admitted,true);
  assert.equal(label,labelAt(next.level,expected));
  assert.deepEqual(next.command,['ACTION6',{x:label===15?43:56,y:52}]);
  permutations.push({id,avant:contrast.base.query.values,après:expected,libéré:next.command,étiquette:label,
    exécuté:false});
}
console.log(JSON.stringify({stats:{versions:2,départsParVersion:7,gestesParVersion:37,catalogue:16,
  succèsDeNiveau:score,gardesNominalesParVersion:16,permutationsParVersion:3},permutations,
  retours:{attribution:nominal.map(({i,pre,after})=>({i,avant:pre.ref,après:after.ref,
    verdict:after.matched,progression:after.record.official_progress})),stationnaire:still.next.cut.result.reason}},null,2));
