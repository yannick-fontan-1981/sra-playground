import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const dir=process.argv[2];
const versions=['f710f2e13f252ca0ec1b7de7e25768e13a5e5bf4','51d983a7243289d2ebb2cef365dd536cbeaf59b1'];
function read(sha,g,ext){
  return readFileSync(join(dir,sha.slice(0,8)+'.'+g+'.'+ext),'utf8');
}
const [parent,candidate]=versions.map(sha=>{
  const value={};
  for(const group of ['catalogue','jeu-KEYD','preuve-KEYD']){
    const d=JSON.parse(read(sha,group,'json'));
    assert.equal(d.sha,sha);
    assert.equal(d.group,group);
    Object.assign(value,d.cases);
  }
  return value;
});
assert.deepEqual(candidate.KEYD,parent.KEYD);
assert.deepEqual(candidate.hist,parent.hist);
const {KEYD,hist}=candidate;
const reference=KEYD[8].ret.acquisition.acquis[0];
assert.equal(reference.status,'local_access_return');
assert.deepEqual(reference.evidence,[KEYD[7].ticket.ref,KEYD[8].ret.ref]);
assert.deepEqual([KEYD[8].ticket.offer.dependency,KEYD[9].ticket.offer.dependency],[reference.evidence,reference.evidence]);
for(const i of [13,15]){
  const r=hist[i+1].ret;
  assert.deepEqual([hist[i].ticket.offer.role,r.matched,r.mesure.confirmée,r.mesure.hors,r.acquisition.acquis],
    ['unknown',false,true,16,[]]);
}
const {sansAccès}=candidate;
assert.deepEqual(sansAccès,parent.sansAccès);
const comparisons={};
for(const [arm,wrong] of [
  ['preuveÉtrangère',[KEYD[6].ticket.ref,KEYD[7].ticket.ref]],
  ['finÉtrangère',[KEYD[7].ticket.ref,KEYD[5].ticket.ref]],
]){
  const baseline=parent[arm],fixed=candidate[arm];
  assert.deepEqual(baseline.slice(0,8),fixed.slice(0,8));
  assert.deepEqual(baseline.slice(0,8),KEYD.slice(0,8));
  assert.deepEqual(fixed[8].ret,KEYD[8].ret);
  assert.equal(fixed[8].ticket.scope.type,arm);
  assert.deepEqual(fixed[8].ticket.scope.remplacement,wrong);
  for(const [i,command] of [[8,'ACTION4'],[9,'ACTION2']]){
    const base=baseline[i].ticket,repair=fixed[i].ticket,after=fixed[i+1].ret;
    assert.equal(fixed[i].vu,KEYD[i].vu);
    assert.equal(base.command,command);
    assert.equal(repair.command,command);
    assert.equal(repair.admitted,true);
    assert.equal(repair.owner,'public_observed_inventory');
    assert.equal(base.offer.kind,'capacity_probe_candidate');
    assert.deepEqual(base.offer.dependency,wrong);
    assert.deepEqual(repair.offer,sansAccès[i].ticket.offer);
    assert.equal(repair.offer.kind,'endpoint_approach_candidate');
    assert.equal(repair.offer.dependency,undefined);
    assert.equal(after.id,repair.id);
    assert.equal(after.packet,baseline[i+1].ret.packet);
    assert.equal(after.packet,KEYD[i+1].ret.packet);
    assert.equal(after.matched,true);
    assert.deepEqual(after.acquisition?.acquis??[],[]);
  }
  assert.equal(fixed[8].ticket.scope.stale,false);
  assert.deepEqual(fixed[9].ret.mesure.position,[30,7,32,9]);
  comparisons[arm]={références:wrong,nominal:'capacity_probe_candidate',correctif:'endpoint_approach_candidate',
    commandes:[fixed[8].ticket.command,fixed[9].ticket.command],retour:fixed[9].ret.ref};
}
const tap=read(versions[1],'auteur','txt');
assert.match(tap,/\bpass 4\b/);
assert.match(tap,/\bfail 0\b/);
assert.ok([parent,candidate].every(c=>Object.values(c).reduce((a,r)=>a+r.filter(x=>x.ret).length,0)===62));

console.log(JSON.stringify({stats:{versions:2,départsParVersion:5,gestesParVersion:62,testsCorrectif:4,
  substitutionsRefusées:2,grandeurCatalogueKEYD:16,grandeurCatalogueSKBN:16},
  vraiePaire:reference.evidence,comparisons},null,2));
