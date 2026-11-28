import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const [dir]=process.argv.slice(2);
const read=version=>JSON.parse(readFileSync(join(dir,version+'.json'),'utf8'));
const versions=['base','candidat'].map(read);
const results=[];
const matchPress=(a,b)=>{
  assert.deepEqual(a.cut,b.cut);
  assert.equal(a.retour.image,b.retour.image);
  assert.deepEqual(a.retour.retour,b.retour.retour);
  assert.deepEqual(a.staleGuard,b.staleGuard);
};
for(const variant of [false,true]){
  const cuts=versions.map(v=>v.output.filter(row=>row.variant===variant));
  const [reference,active]=cuts;
  assert.deepEqual(reference.map(r=>r.arm),['reference','active','retenu','inverse','retrait']);
  assert.deepEqual(active.map(r=>r.arm),reference.map(r=>r.arm));
  const expected=variant?'ACTION3':'ACTION4';
  for(const arm of [...reference,...active]){
    assert.equal(arm.earlier,10);
    assert.equal(arm.earlierHash,reference[0].earlierHash);
    assert.deepEqual(arm.walk.map(w=>[w.offer.strategy,w.offer.command]),[['P07',expected],['P07',expected]]);
    assert.deepEqual(arm.walk.map(w=>w.image),reference[0].walk.map(w=>w.image));
    assert.equal(arm.at.image,reference[0].at.image);
    if(arm.cut){
      assert.equal(arm.cut.command,expected);
      assert.equal(arm.cut.strategy,'P05');
      assert.equal(arm.staleGuard.stale.admitted,false);
      assert.equal(arm.staleGuard.live.admitted,true);
      assert.equal(arm.retour.retour.reason,'passage_connections_rewritten_at_landing');
      assert.equal(arm.rewired,true);
      assert.equal(arm.retour.retour.matched,true);
    }else assert.equal(arm.rewired,false);
  }
  for(const i of [0,1,3])matchPress(reference[i],active[i]);
  matchPress(reference[0],reference[2]);
  const zero=active[2].comparisons[0],yes=active[1].comparisons[0];
  assert.equal(active[2].cut,null);
  assert.equal(zero.firstDifference,'selected');
  assert.deepEqual([yes.remaining,zero.remaining,yes.shadow.selected,zero.shadow.selected],[1,0,true,false]);
  assert.deepEqual(yes.shadow.evidence,zero.shadow.evidence);
  assert.deepEqual(active[3].at.controls,[...active[1].at.controls].reverse());
  assert.equal(active[3].cut.command,active[1].cut.command);
  assert.deepEqual(active[3].cut.target,active[1].cut.target);
  assert.equal(active[3].retour.image,active[1].retour.image);
  assert.deepEqual(active[3].cut.evidence,active[1].cut.evidence);
  for(const r of [reference[4],active[4]]){
    assert.equal(r.cut,null);
    assert.ok(!r.at.controls.includes(Number(expected.slice(6))));
  }
  results.push({miroir:variant,commande:expected,approches:2,cible:active[1].cut.target,
    zero:{selected:zero.shadow.selected,contact:false},inverse:{offreConservée:true,retour:active[3].retour.retour.reason},
    retrait:{contact:false},ancienneReferenceRefusée:true});
}
const stats=Object.fromEntries(versions.map(v=>[v.version,{departs:v.output.length,
  gestes:v.output.reduce((n,r)=>n+r.earlier+r.walk.length+Number(!!r.retour),0),
  contacts:v.output.filter(r=>r.rewired).length}]));
assert.deepEqual(stats,{base:{departs:10,gestes:128,contacts:8},candidat:{departs:10,gestes:126,contacts:6}});
console.log(JSON.stringify({sha:{base:'86e0f172bfd4f743bccd985a57ce1811001a6d7e',candidat:'40f140f8dceb78c7ad1e448751a9f103bfc01362'},
  stats,results},null,2));
