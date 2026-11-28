import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const [destination]=process.argv.slice(2);
const sha={gel:'d0e7527ca8033bd805a6d7a8bb021eff62e87021',candidat:'01f8fd39e4f0813cdb273b4914d9d1cdc6a74b9b'};
function paired(dir,lengths){
  return Object.fromEntries(Object.entries(lengths).map(([arm,length])=>{
    const read=version=>{
      const {sha:actual,...r}=JSON.parse(readFileSync(join(dir,version+'.'+arm+'.json'),'utf8'));
      assert.equal(actual,sha[version]);
      assert.equal(r.arm,arm);
      assert.equal(r.steps.length,length);
      return r;
    };
    const gel=read('gel');
    assert.deepEqual(read('candidat'),gel,arm);
    return [arm,gel];
  }));
}
const t=(r,i)=>r.steps[i-1];
const lengths={nominal:16,'ordre-permute':2,'permutation-jouee':3,'sans-ajout':2};
const all=paired(destination,lengths);
const {nominal}=all,[change,joue,stopped]=['ordre-permute','permutation-jouee','sans-ajout'].map(k=>all[k]);
const [a,b]=[t(nominal,3).pre,change.next];
const sorted=l=>[...l].sort();
const old=t(nominal,2),mod=t(change,2),neg=t(stopped,2);
assert.equal(mod.after.packet,old.after.packet);
assert.equal(neg.after.packet,old.after.packet);
assert.equal(mod.after.physical,old.after.physical);
assert.notEqual(mod.after.presented,old.after.presented);
assert.equal(old.after.record.state.continuation.rest,1);
assert.equal(mod.after.record.state.continuation,null);
assert.equal(neg.after.record.state.continuation,null);
assert.deepEqual(change.change.old.queue,[2,2,0]);
assert.deepEqual(change.change.next.queue,[0,2,2]);
assert.deepEqual(sorted(change.change.old.queue),sorted(change.change.next.queue));
assert.deepEqual(a.command,b.command);
assert.deepEqual(t(joue,3).pre,b);
function duels(before,legend){
  const key=pair=>[...pair].sort().join(',');
  const ranks=new Map(legend.pairs.map((p,i)=>[key(p),i]));
  const defeats=new Set(legend.relations.map(r=>ranks.get(key(r.left))+':'+ranks.get(key(r.right))));
  const left=[...before.queue],right=[...before.enemy],trace=[];
  while(left.length&&right.length){
    const p=left[0],q=right[0];
    const w=defeats.has(p+':'+q)?'LEFT':defeats.has(q+':'+p)?'RIGHT':null;
    assert.ok(w,'Duel non déterminé dans le témoin');
    trace.push(w);
    if(w==='LEFT')right.shift();
    else left.shift();
  }
  return {trace,survivors:left.length};
}
const options=[a,b].map(decision=>{
  const {measurement}=decision.cut.pre;
  const calc=duels(measurement.summary,measurement.legend);
  assert.deepEqual(calc.trace,decision.plan.trace.map(d=>d.outcome));
  assert.equal(calc.survivors,decision.plan.local.survivors);
  return calc;
});
assert.deepEqual(options.map(d=>[d.trace[0],d.survivors]),[['RIGHT',1],['LEFT',3]]);
const real=t(joue,3).after, native=t(nominal,3).after;
assert.equal(real.packet,native.packet);
assert.equal(real.physical,native.physical);
assert.equal(real.presented,real.physical);
assert.equal(real.levels,1);
assert.equal(real.record.after,null);
assert.equal(real.matched,null);
assert.deepEqual(joue.next.command,t(nominal,4).pre.command);
assert.equal(stopped.next.family,'observed_frontier');
assert.equal(t(nominal,16).after.levels,2);
console.log(JSON.stringify({sha,stats:{departsParSha:4,gestesParSha:23},tour2:{queue:change.change.old.queue,permutation:change.change.next.queue,
  suffixeNominal:1,suffixePerdu:true},tour3:{commande:a.command,projection:options,paquet:real.packet,niveaux:real.levels,survivantsPhysiques:null},
  stationnaire:{repli:stopped.next.command,famille:stopped.next.family},gainsNominaux:2},null,2));
