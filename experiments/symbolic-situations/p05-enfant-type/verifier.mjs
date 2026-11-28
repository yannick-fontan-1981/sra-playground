import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const [reçus]=process.argv.slice(2);
const read=name=>JSON.parse(readFileSync(join(reçus,name+'.json'),'utf8'));
const baseline=read('base').runs[0], candidate=read('candidat');
const [nominal,témoin,stationnaire,provenance,retrait]=candidate.runs;
assert.deepEqual(candidate.runs.map(r=>r.arm),['nominal','témoin','stationnaire','provenance','retrait']);
const n=r=>r.rows.map(({shot,actual,outcome})=>[shot.command,shot.data,actual,outcome]);
assert.equal(baseline.rows.length,16);
assert.deepEqual(n(baseline),n(nominal));
assert.deepEqual(baseline.rows.flatMap(r=>r.result?[r.result]:[]),[]);
const first=nominal.rows[0];
assert.deepEqual([first.result.status,first.result.reason],['unresolved','no_single_axis_step']);
const successes=nominal.rows.filter(r=>r.result?.status==='observed_translation');
const unresolved=nominal.rows.filter(r=>r.result?.status==='unresolved');
assert.deepEqual([successes.length,unresolved.length],[4,2]);
const t=(arm,i)=>arm.rows[i-1];
const t5=t(nominal,5), t6=t(nominal,6);
assert.equal(t5.shot.command,'ACTION4');
assert.deepEqual(t5.shot.child.subject.start,[14,8]);
assert.equal(t5.result.status,'observed_translation');
assert.deepEqual(t5.result.displacement,[6,0]);
assert.deepEqual(t5.result.destination,[20,8]);
assert.equal(t5.result.beforeRef,t5.shot.ref);
assert.equal(t5.result.afterRef,t5.outcome.ref);
assert.ok(t6.shot.evidence.includes(t5.result.afterRef));
assert.deepEqual([t6.shot.strategy,t6.shot.command,t6.shot.expected,t6.outcome.matched],['P07','ACTION4',[26,8],true]);
for(const r of [témoin,stationnaire,provenance,retrait]){
  assert.deepEqual(r.rows.slice(0,5).map(s=>[s.shot.command,s.actual]),nominal.rows.slice(0,5).map(s=>[s.shot.command,s.actual]));
}
assert.deepEqual(t(témoin,5).result,t5.result);
assert.deepEqual(t(témoin,5).control,t5.result.displacement);
assert.equal(t(témoin,5).controlEvidence,t5.result.afterRef);
assert.equal(t(témoin,6).actual,t6.actual);
assert.notEqual(t(stationnaire,5).presented,t5.actual);
assert.equal(t(stationnaire,5).result.status,'unresolved');
assert.equal(t(stationnaire,5).result.reason,'no_single_axis_step');
assert.deepEqual([t(stationnaire,6).shot.strategy,t(stationnaire,6).shot.command,t(stationnaire,6).comparisonOnly],['P05','ACTION5',true]);
assert.deepEqual(provenance.substituted,{genuine:t5.shot.ref,other:t(provenance,3).outcome.ref});
assert.notEqual(provenance.substituted.genuine,provenance.substituted.other);
assert.deepEqual(retrait.withheld,{control:t5.result.displacement,reference:t5.result.afterRef});
for(const r of [provenance,retrait]){
  const fifth=t(r,5),sixth=t(r,6);
  assert.deepEqual([fifth.presented,fifth.result,fifth.control,fifth.controlEvidence],[t5.actual,null,null,null]);
  assert.deepEqual([sixth.shot.strategy,sixth.shot.command],['P05','ACTION3']);
  assert.notEqual(sixth.actual,t6.actual);
  assert.ok(sixth.outcome.ref);
}
const mesure=read('mesure');
assert.deepEqual([mesure.position,mesure.positionRetour,mesure.vecteur,mesure.pixels,mesure.retour],
  [[14,8],[20,8],[6,0],24,t5.actual]);
const summary=r=>({t5:t(r,5).result?.status??null,control:t(r,5).control,
  prochain:{strategy:t(r,6).shot.strategy,command:t(r,6).shot.command,retour:t(r,6).actual??null}});
console.log(JSON.stringify({sha:{base:'09b9a509e5e07894b9fccf170f22ae26cbeffbda',candidat:'162e45506cd9196171c15cb2402cf2ca1ee4266d'},
  gestes:{nominalParSha:16,controlsCandidat:23,mesureIndépendante:5},enfantsNominaux:{translations:4,indéterminés:2},
  t5:{preuve:t5.result,paquet:t5.actual},t6:{commande:t6.shot.command,projection:t6.shot.expected,preuve:t5.result.afterRef},
  substitution:provenance.substituted,contrôles:[témoin,stationnaire,provenance,retrait].map(r=>({arm:r.arm,...summary(r)})),mesure},null,2));
