import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const dir=process.argv[2];
const versions={gel:'d0e7527ca8033bd805a6d7a8bb021eff62e87021',candidat:'b01ca9bfde92510eb622a105e1f1470c796dc8e0'};
const arms={nominal:16,'ancienne-reference':7,portee:7,'journal-intact':7,'journal-altere':7,
  'journal-portee':7,'sans-paire':7,'sans-recu':7,epoque:32};
function read(version,arm){
  const d=JSON.parse(readFileSync(join(dir,version+'.'+arm+'.json'),'utf8'));
  assert.equal(d.sha,versions[version]);
  assert.equal(d.arm,arm);
  assert.equal(d.steps.length,arms[arm]);
  return d.steps;
}
const runs=Object.fromEntries(Object.keys(versions).map(v=>[v,Object.fromEntries(Object.keys(arms).map(k=>[k,read(v,k)]))]));
const {gel,candidat}=runs;
const nominal=candidat.nominal;
const crossing=nominal[4].after.record,pair=crossing.pair;
assert.deepEqual(pair.evidence,[nominal[4].pre.ref,nominal[4].after.ref]);
assert.equal(crossing.comparison.reference_property_matched,true);
assert.equal(crossing.witness,crossing.pairDigest);
assert.match(crossing.witness,/^[0-9a-f]{64}$/);
assert.deepEqual([pair.inputs,pair.owner,pair.epoch],[{'0':'ACTION1','1':'ACTION3'},0,1]);
assert.equal(nominal[1].after.record.witness,null);
assert.deepEqual(nominal[6].pre.plan.pair,pair);
assert.equal(nominal[6].after.matched,true);

const physical=({pre,after})=>[pre.ref,pre.family,pre.kind,pre.command,pre.guard,
  after.ref,after.matched,after.seal,after.levels,after.packet];
assert.deepEqual(nominal.map(physical),gel.nominal.map(physical));
assert.deepEqual(candidat.epoque.map(physical),gel.epoque.map(physical));
const input=({ref,epoch,available,raster})=>[ref,epoch,available,raster];
assert.deepEqual(candidat['journal-intact'],nominal.slice(0,7));
const without=['ancienne-reference','portee','journal-altere','journal-portee','sans-paire','sans-recu'];
const effects={};
const base=nominal[6],expected=[base.pre.family,base.pre.command];
for(const mode of without){
  const now=candidat[mode],old=gel[mode],step=now[6],earlier=old[6];
  assert.deepEqual(now.slice(0,6),nominal.slice(0,6));
  assert.deepEqual(old.slice(0,6),gel.nominal.slice(0,6));
  assert.deepEqual(input(step.pre.cut.pre),input(base.pre.cut.pre));
  assert.deepEqual(input(earlier.pre.cut.pre),input(step.pre.cut.pre));
  assert.deepEqual([step.pre.family,step.pre.command],['information_goal',['ACTION6',{x:28,y:61}]]);
  assert.equal(step.pre.guard.admitted,true);
  assert.equal(step.pre.plan,null);
  assert.equal(step.after.matched,null);
  assert.notEqual(step.after.packet,base.after.packet);
  const retained=step.pre.cut.pre.used;
  const healthy=base.pre.cut.pre.used;
  assert.deepEqual([retained.past,retained.axisInputs,retained.progress],[healthy.past,healthy.axisInputs,healthy.progress]);
  if(mode==='sans-paire')assert.deepEqual(retained.pairs,[]);
  else if(mode==='sans-recu'){
    assert.deepEqual(retained.pairs,[pair]);
    assert.deepEqual(retained.receipts,[]);
  }else{
    const bad=mode.includes('portee')?{...pair,epoch:2}:{...pair,evidence:[nominal[1].after.ref,pair.evidence[1]]};
    assert.deepEqual(retained.pairs,[bad]);
    assert.deepEqual(retained.receipts,healthy.receipts);
    assert.deepEqual([earlier.pre.family,earlier.pre.command],expected);
    assert.equal(earlier.after.packet,gel.nominal[6].after.packet);
  }
  effects[mode]={gel:earlier.pre.command,correctif:step.pre.command,retour:step.after.ref};
}
const second=candidat.epoque.find(x=>x.pre.level===2&&x.pre.cut);
assert.ok(second);
assert.ok(second.pre.cut.pre.used.receipts.some(r=>r.digest===crossing.witness));
assert.deepEqual(second.pre.cut.pre.used.pairs.find(p=>p.evidence[1]===pair.evidence[1]),pair);
const firstReuse=candidat.epoque.find(x=>x.pre.level===2&&x.pre.plan?.pair?.epoch===1)?.i??null;
assert.equal(firstReuse,null);
const boundary=candidat.epoque.find(x=>x.after.levels>x.pre.level-1);
assert.ok(boundary);
console.log(JSON.stringify({stats:{versions:2,départsParVersion:Object.keys(arms).length,
  gestesParVersion:Object.values(arms).reduce((n,v)=>n+v,0),substitutionsRefusées:4,retoursAdmisNominal:16},
  source:pair.evidence,empreinte:crossing.witness,effects,N2:{passageAprès:boundary.i,paireConservéeAu:second.i,
    premièreRéutilisation:firstReuse}},null,2));
