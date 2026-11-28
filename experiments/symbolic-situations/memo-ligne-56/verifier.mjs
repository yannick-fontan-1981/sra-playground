import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const [dir]=process.argv.slice(2);
const shas=['d0e7527ca8033bd805a6d7a8bb021eff62e87021','4d9f1a397bd3706469f419739d077d366eb1b13c'];
const tree=sha=>execFileSync('git',['rev-parse',sha+':src'],{encoding:'utf8'}).trim();
assert.equal(tree(shas[0]),tree(shas[1]));
function read(sha,g){
  const f=JSON.parse(readFileSync(join(dir,sha.slice(0,8)+'.'+g+'.json')));
  assert.equal(f.sha,sha);assert.equal(f.group,g);return f.results;
}
const both=shas.map(sha=>Object.assign({},...['nominal','contrôles','réserve'].map(g=>read(sha,g))));
assert.deepEqual(both[0],both[1]);
const c=both[0],n=c.nominal.steps;
for(const {steps} of Object.values(c))for(const [i,{issued,after}] of steps.entries()){
  assert.equal(issued.ticket,after.ticket);assert.equal(issued.family,after.owner);assert.ok(issued.admitted);
  if(steps[i+1])assert.equal(steps[i+1].issued.ref,after.ref);
}
const click=(x,y)=>['ACTION6',{x,y}];
const expectedKind='observed_occurrence_recall', fromPrior='test_retained_occurrence_correspondence';
assert.equal(n.length,8);
for(const s of n.slice(0,6)){
  assert.equal(s.issued.entry,expectedKind);assert.equal(s.issued.cut.authorizes.reason,'test_observed_enclosing_emphasis');
  assert.equal(s.after.memory[0].mode,'forward');assert.deepEqual(s.after.memory[0].evidence,[s.issued.ref,s.after.ref]);
}
const [s6,s7,s8]=n.slice(5), cut=s7.issued.cut, {current,prior,models}=cut.pre;
const offer=cut.authorizes;
assert.equal(s7.issued.entry,expectedKind);assert.deepEqual(s7.issued.command,click(15,35));
assert.equal(offer.reason,fromPrior);
assert.equal(prior.example,s6.issued.ref);assert.equal(prior.previous.ref,s6.issued.ref);
assert.deepEqual(s6.after.memory[0].consolidated,prior);
assert.deepEqual(offer.refs,[s7.issued.ref,s6.issued.ref]);
assert.equal(current.occurrences.length,3);assert.ok(current.occurrences.every(o=>!o.marked));
assert.equal(prior.previous.occurrences.length,3);
const key=({relation,comparison})=>'plural_antecedent:'+relation+':'+comparison;
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const sources=prior.previous.occurrences.filter(o=>same(o.shape,offer.selected.shape) && o.color===offer.selected.color);
assert.equal(sources.length,1);
const source=sources[0];assert.deepEqual(source.point,[46,41]);assert.notEqual(source.id,prior.chosen);
assert.equal(offer.support.length,4);
for(const hypothesis of offer.support){
  const model=models.find(m=>m.key===hypothesis), decision=cut.comparisons.find(row=>key(row)===hypothesis);
  assert.equal(model.count,4);assert.equal(model.evidence.length,4);assert.deepEqual(model.counterexamples,[]);
  assert.deepEqual(decision.candidates,[offer.selected.id]);
}
const y=s7.after.memory[0];
assert.deepEqual([y.mode,y.evidence],['forward',[s7.issued.ref,s7.after.ref]]);
assert.deepEqual(s8.issued.command,click(14,28));assert.equal(s8.after.memory[0].mode,'forward');
assert.equal(s8.issued.cut.pre.prior.example,s7.issued.ref);

for(const name of ['sans-exemple','sans-voisin','permutation']){
  const steps=c[name].steps;
  assert.deepEqual(steps.slice(0,6),n.slice(0,6));
  assert.equal(steps[6].issued.ref,s7.issued.ref);
  assert.deepEqual(steps[6].issued.cut.pre,cut.pre);
}
const loss=c['sans-exemple'].steps[6], lossCut=loss.issued.cut;
assert.deepEqual(lossCut.removed,source);assert.equal(lossCut.authorizes,null);
for(const hypothesis of offer.support)assert.deepEqual(lossCut.comparisons.find(row=>key(row)===hypothesis).candidates,[]);
assert.deepEqual([loss.issued.family,loss.issued.command,loss.after.memory],['animated_contact',click(37,13),null]);
assert.equal(c['sans-exemple'].steps.length,7);assert.equal(c['sans-exemple'].stop,'frontier_unknown');
const neighbour=c['sans-voisin'].steps[6], other=neighbour.issued.cut.removed;
assert.deepEqual(other.point,[14,37]);assert.notEqual(other.id,source.id);
assert.deepEqual({...neighbour.issued.cut,removed:null},cut);
assert.deepEqual(neighbour.after,s7.after);assert.deepEqual(c['sans-voisin'].steps[7],s8);
const perm=c.permutation.steps[6], pair=perm.issued.cut.pair;
assert.ok(pair[0]<pair[1] && pair[0]>=0 && pair[1]<prior.previous.occurrences.length);
assert.deepEqual({...perm.issued.cut,pair:null},cut);
assert.deepEqual(perm.after,s7.after);assert.deepEqual(c.permutation.steps[7],s8);
const checkOrigin=p=>p.example===prior.example && sources.some(s=>same(s.point,p.point));
assert.ok(checkOrigin({example:prior.example,point:source.point}));
assert.ok(!checkOrigin({example:prior.example,point:other.point}));
const stats=shas.map(sha=>({sha,départs:Object.keys(c).length,gestes:Object.values(c).reduce((s,x)=>s+x.steps.length,0)}));
console.log(JSON.stringify({stats,moteur:tree(shas[0]),exemple:{point:source.point,référence:prior.example,
  modèles:offer.support,appuisParModèle:4},rappel:{T7:s7.issued.command,T8:s8.issued.command,retours:[y.mode,s8.after.memory[0].mode]},
  sansExemple:{repli:loss.issued.command,famille:loss.issued.family,arrêt:c['sans-exemple'].stop},
  sansVoisin:neighbour.issued.command,permutation:{pair,choix:perm.issued.command},fauxReçuRejeté:true},null,2));
