import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const [destination]=process.argv.slice(2);
const sha={gel:'d0e7527ca8033bd805a6d7a8bb021eff62e87021',candidat:'4f39c40869cdb3c2881d4fef01d3a7eafaf196dd'};
const lengths={"nominal":16,"stationnaire":6,"exterieur":6,"poche-ouverte":7,"poche-jouee":8,"poche-coherente":8,"pixel-neutre":8};
const arms=Object.keys(lengths);
function read(version,arm){
  const {sha:actual,...r}=JSON.parse(readFileSync(join(destination,version+'.'+arm+'.json'),'utf8'));
  assert.equal(actual,sha[version]);
  assert.equal(r.arm,arm);
  assert.equal(r.steps.length,lengths[arm]);
  return r;
}
const cases=Object.fromEntries(arms.map(arm=>{
  const gel=read('gel',arm),candidate=read('candidat',arm);
  assert.deepEqual(candidate,gel,arm);
  return [arm,gel];
}));
const stats={departsParSha:arms.length,gestesParSha:Object.values(lengths).reduce((a,b)=>a+b),parite:true};
const t=(r,i)=>r.steps[i-1];
const click=(x,y)=>['ACTION6',{x,y}];
const {nominal,stationnaire,exterieur}=cases;
const [ouverte,jouee,coherente,neutre]=['poche-ouverte','poche-jouee','poche-coherente','pixel-neutre'].map(a=>cases[a]);
const status=s=>s.after.record.result.status;
const write=s=>{
  const {seed,count,pigment,within,outside}=s.after.record.state.writes.at(-1);
  return {seed,count,pigment,within,outside};
};

for(const r of [ouverte,jouee,coherente,neutre]){
  for(const i of [6,7]){
    assert.deepEqual(t(r,i).pre.command,t(nominal,i).pre.command);
    assert.equal(t(r,i).after.packet,t(nominal,i).after.packet);
  }
}
const {point,old,next}=ouverte.change;
assert.deepEqual(point,[36,11]);
assert.deepEqual([old.pockets,ouverte.change.new.pockets,old.target,ouverte.change.new.target],[1,0,10,9]);
const selection=t(nominal,6);
assert.equal(status(selection),'selection_observed');
assert.equal(selection.after.record.result.changed_count,44);
for(const r of [stationnaire,exterieur]){
  assert.equal(t(r,6).after.packet,selection.after.packet);
  assert.equal(status(t(r,6)),'unknown_or_no_visible_effect');
}
assert.deepEqual(t(nominal,8).pre.command,click(20,32));
assert.deepEqual(ouverte.next.command,click(43,11));
for(const r of [jouee,coherente]){
  assert.deepEqual(t(r,8).pre.command,ouverte.next.command);
  assert.equal(status(t(r,8)),'write_effect_observed');
  assert.equal(t(r,8).after.matched,null);
  assert.equal(t(r,8).after.levels,0);
  assert.deepEqual(r.next.command,click(20,32));
}
assert.equal(t(jouee,8).after.packet,t(coherente,8).after.packet);
assert.equal(t(jouee,8).after.physical,t(coherente,8).after.physical);
assert.equal(t(jouee,8).after.physical,t(jouee,8).after.presented);
assert.notEqual(t(coherente,8).after.physical,t(coherente,8).after.presented);
assert.deepEqual(write(t(jouee,8)),{seed:[43,11],count:92,pigment:9,within:false,outside:1});
assert.deepEqual(write(t(coherente,8)),{seed:[43,11],count:91,pigment:9,within:true,outside:0});
assert.deepEqual(t(neutre,8).pre.command,t(nominal,8).pre.command);
assert.deepEqual(write(t(neutre,8)),write(t(nominal,8)));
assert.equal(write(t(nominal,7)).count,133);
assert.equal(write(t(nominal,8)).count,95);
assert.equal(t(nominal,10).after.levels,1);
assert.deepEqual([write(t(nominal,16)).count,write(t(nominal,16)).pigment],[89,14]);

console.log(JSON.stringify({sha,stats,lengths,nominal:{selectionPixels:44,pixelsT7:133,pixelsT8:95,gains:1,N2T16:{pixels:89,pigment:14}},
  poche:{point,ancienneCible:old.target,nouvelleCible:ouverte.change.new.target,ancienClic:t(nominal,8).pre.command,
    autreClic:ouverte.next.command,paquet:t(jouee,8).after.packet,physique:write(t(jouee,8)),presente:write(t(coherente,8))}},null,2));
