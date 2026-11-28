import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const [destination]=process.argv.slice(2);
const sha={gel:'d0e7527ca8033bd805a6d7a8bb021eff62e87021',candidat:'c9737d9831a703611422fcf03af83e39dbfdc6d6'};
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
const t=(r,i)=>r.steps[i-1];const lengths={nominal:16,'sans-guide':0,stationnaire:1,'produit-substitue':9,'sans-conversion':9,'operande-restaure':9};
const all=paired(destination,lengths);
const {nominal,stationnaire}=all;
const [guide,produit,station,operande]=['sans-guide','produit-substitue','sans-conversion','operande-restaure'].map(k=>all[k]);
const rec=s=>s.after.record;
const e=s=>rec(s).event;
const kinds=s=>e(s).interface_event?.kinds;
assert.equal(t(nominal,1).pre.plan.mode,'guide');
assert.deepEqual(kinds(t(nominal,1)),['select']);
assert.deepEqual(guide.change.center,[4,11]);
assert.equal(guide.next.family,'observed_frontier');
assert.deepEqual(guide.next.command,stationnaire.next.command);
assert.equal(t(stationnaire,1).after.packet,t(nominal,1).after.packet);
assert.equal(e(t(stationnaire,1)).status,'no_discriminating_change');
assert.deepEqual([kinds(t(nominal,2)),kinds(t(nominal,4))],[['load'],['load']]);
const trigger=t(nominal,5),pair=rec(trigger).state.contrasts.at(-1).transform[0];
assert.deepEqual(pair.map(x=>x.value),[11,9]);
assert.equal(produit.change.from,14);
assert.deepEqual(kinds(trigger),['transform']);
assert.equal(e(trigger).diagram_operand_removal_result_appearance_matches,1);
assert.equal(rec(trigger).state.count,1);
for(const r of [produit,operande,station]){
  const s=t(r,5);
  assert.deepEqual(s.pre.command,trigger.pre.command);
  assert.equal(s.after.packet,trigger.after.packet);
  assert.equal(s.after.physical,trigger.after.physical);
  assert.notEqual(s.after.physical,s.after.presented);
  assert.equal(e(s).diagram_operand_removal_result_appearance_matches,0);
  assert.equal(rec(s).state.count,0);
  assert.ok(!kinds(s)?.includes('transform'));
}
assert.equal(operande.change.value,11);
for(const r of [produit,operande]){
  for(const i of [6,9]){
    assert.deepEqual(t(r,i).pre.command,t(nominal,i).pre.command);
    assert.equal(t(r,i).after.packet,t(nominal,i).after.packet);
  }
  assert.equal(t(r,9).after.levels,1);
  assert.equal(rec(t(r,9)).state.methods.length,0);
  assert.equal(r.next.family,'observed_frontier');
}
assert.notDeepEqual(t(station,6).pre.command,t(nominal,6).pre.command);
assert.equal(t(station,6).pre.family,'information_goal');
assert.equal(t(station,9).after.levels,0);
assert.equal(t(nominal,9).after.levels,1);
const [method]=rec(t(nominal,9)).state.methods;
assert.ok(method.evidence.includes(t(nominal,5).after.ref));
assert.ok([10,11].every(i=>t(nominal,i).pre.plan.interface.method_ref===method.id));
assert.deepEqual([kinds(t(nominal,10)),kinds(t(nominal,11))],[['select'],['receive']]);
assert.notDeepEqual(t(nominal,10).pre.command,t(nominal,11).pre.command);
console.log(JSON.stringify({sha,stats:{departsParSha:6,gestesParSha:44},charges:[11,9],produit:14,
    interventions:{produit:{conversion:0,gainT9:1},operande:{conversion:0,gainT9:1},stationnaire:{conversion:0,gainT9:0,repli:t(station,6).pre.command}},
    methode:{acquiseT9:true,reemploieT10:t(nominal,10).pre.command,reemploieT11:t(nominal,11).pre.command}},null,2));
