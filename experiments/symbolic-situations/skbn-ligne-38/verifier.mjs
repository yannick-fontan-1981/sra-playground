import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const dir=process.argv[2];
const sha=['d0e7527ca8033bd805a6d7a8bb021eff62e87021','fa126d653aa5e123f9de78c220e9e6129a6436a2'];
const read=(s,group,extension)=>readFileSync(join(dir,s.slice(0,8)+'.'+group+'.'+extension),'utf8');
const cases={};
for(const group of ['catalogue','suite','retrait','jeu-KEYD','preuve-KEYD']){
  const [gel,candidat]=sha.map(s=>{
    const header=JSON.parse(read(s,group,'json'));
    assert.equal(header.sha,s);
    assert.equal(header.group,group);
    return header.cases;
  });
  assert.deepEqual(gel,candidat);
  Object.assign(cases,gel);
}
const inv=r=>r.ticket?.owner==='public_observed_inventory'&&r.ticket.kind==='public_inventory_composition';
const count=rows=>rows.filter(r=>r.ret).length;
assert.deepEqual(Object.values(cases).map(count),[16,19,15,15,14,14,16,6,9,9]);
const expected=[46,11,49,14];
const {hist,nominal,stationnaire,conservation,sansMesure,référenceÉtrangère,KEYD,sansSignature,sansAccès,preuveÉtrangère}=cases;
assert.deepEqual(hist.filter(inv).map(x=>x.tour),[14,16]);
assert.deepEqual(hist.slice(0,16),nominal.slice(0,16));
for(const i of [13,15]){
  const {ticket}=nominal[i],{ret}=nominal[i+1];
  assert.equal(ticket.scope.stale,false);
  assert.equal(ticket.admitted,true);
  assert.equal(ticket.offer.role,'unknown');
  assert.equal(ticket.offer.displayed,null);
  assert.equal(ticket.offer.retained,0);
  assert.deepEqual(ticket.offer.cell,[1,5]);
  assert.deepEqual(ticket.offer.expected,expected);
  assert.equal(ret.id,ticket.id);
  assert.equal(ret.mesure.avant,ticket.ref);
  assert.deepEqual([ret.matched,ret.mesure.confirmée,ret.mesure.scellé,ret.mesure.position,ret.servi,ret.mesure.hors],
    [false,true,true,expected,62,16]);
  assert.deepEqual([ret.acquisition.propre,ret.acquisition.acquis],['changed_endpoint_reached',[]]);
}
assert.deepEqual([nominal[14].ticket.owner,nominal[16].ticket.owner],['observed_frontier','pre_score_contact']);
for(const [arm,matched,confirmed,pixels] of [[stationnaire,false,false,0],[conservation,true,true,46]]){
  assert.deepEqual(arm[13].ticket,nominal[13].ticket);
  const {ret,ticket}=arm[14];
  assert.equal(ret.packet,nominal[14].ret.packet);
  assert.deepEqual([ret.matched,ret.mesure.confirmée,ret.servi,ret.mesure.hors,ret.acquisition.acquis],
    [matched,confirmed,pixels,0,[]]);
  assert.equal(ticket.command,'ACTION2');
}
assert.equal(conservation[14].ticket.offer.kind,'endpoint_approach_candidate');

for(const variant of [sansMesure,référenceÉtrangère]){
  const start=variant[13],end=variant[14];
  assert.equal(start.vu,nominal[13].vu);
  assert.equal(start.ticket.command,nominal[13].ticket.command);
  assert.equal(start.ticket.offer.kind,'endpoint_approach_candidate');
  assert.ok(start.ticket.scope.intervention.original.flat().every(r=>!r.includes(':revision:15:')));
  assert.equal(end.ret.packet,nominal[14].ret.packet);
}
assert.equal(sansMesure[13].ticket.offer.control,undefined);
assert.deepEqual(référenceÉtrangère[13].ticket.offer.control,référenceÉtrangère[13].ticket.scope.intervention.alternative);

assert.equal(KEYD.filter(inv).length,16);
assert.deepEqual(KEYD.slice(0,4).map((r,i)=>[r.ticket.offer.kind,KEYD[i+1].ret.matched]),
  Array.from({length:4},()=>['approach_candidate',true]));
assert.equal(KEYD[4].ticket.offer.kind,'acquisition_probe_candidate');
assert.equal(KEYD[5].ret.matched,null);
assert.ok(KEYD.slice(5,8).every(r=>r.ticket.offer.kind==='access_probe_candidate'));
assert.ok(KEYD.slice(5,8).every(r=>r.ticket.offer.displayed));
const completed=KEYD[7].ticket;
const {ret:receipt}=KEYD[8];
assert.equal(receipt.id,completed.id);
assert.equal(receipt.matched,true);
const [acquired]=receipt.acquisition.acquis;
assert.deepEqual([acquired.status,acquired.evidence],['local_access_return',[completed.ref,receipt.ref]]);
assert.ok(KEYD.slice(8,16).every(r=>r.ticket.offer.kind==='capacity_probe_candidate'));
for(const r of KEYD.slice(8,16))assert.deepEqual(r.ticket.offer.dependency,acquired.evidence);
assert.equal(KEYD.at(-1).score,0);

for(const [arm,index,expectedOffer] of [
  [sansSignature,5,'endpoint_approach_candidate'],
  [sansAccès,8,'endpoint_approach_candidate'],
  [preuveÉtrangère,8,'capacity_probe_candidate'],
]){
  const base=KEYD[index],step=arm[index],after=arm[index+1];
  assert.equal(step.vu,base.vu);
  assert.equal(step.ticket.ref,base.ticket.ref);
  assert.equal(step.ticket.command,base.ticket.command);
  assert.equal(step.ticket.offer.kind,expectedOffer);
  assert.equal(step.ticket.admitted,true);
  assert.equal(after.ret.packet,KEYD[index+1].ret.packet);
}
assert.equal(sansSignature[5].ticket.offer.displayed,null);
assert.equal(sansAccès[8].ticket.offer.dependency,undefined);
const foreign=preuveÉtrangère[8].ticket;
assert.deepEqual(foreign.offer.dependency,[KEYD[6].ticket.ref,KEYD[7].ticket.ref]);
assert.notDeepEqual(foreign.offer.dependency,acquired.evidence);

const tests=sha.map(s=>{
  const txt=read(s,'auteur','txt');
  assert.match(txt,/\bfail 0\b/);
  return Number(txt.match(/\bpass (\d+)/)[1]);
});
console.log(JSON.stringify({stats:{versions:2,départsParVersion:Object.keys(cases).length,
  gestesParVersion:Object.values(cases).reduce((n,rows)=>n+count(rows),0),catalogueRecapturé:18,
  catalogueTotalDocumenté:31,testsParVersion:tests},SKBN:{tours:[14,16],preuve:'arrivée du corps et changement étranger',
  accèsAcquis:0},KEYD:{tours:16,acquis:acquired,utilisations:8,provenanceAltéréeAdmise:foreign.offer.dependency,
  aprèsRetrait:sansAccès[8].ticket.offer.kind}},null,2));
