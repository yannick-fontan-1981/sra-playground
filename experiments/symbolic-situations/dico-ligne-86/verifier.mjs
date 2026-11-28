import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const dir=process.argv[2];
const shas=['d0e7527ca8033bd805a6d7a8bb021eff62e87021','d84d0b938904a9e10a1ab82f8b8f92a0cfec5cdc'];
const nav='subset_scope_navigation',query='subset_scope_query',owner='subset_diagnosis';
const large=[0,1,2,3,4,5,6,7], domain=[0,1,4,5], partial=[0,1,4,5,6,7];
const click=(x,y=3)=>['ACTION6',{x,y}];
const read=(sha,group)=>{
  const f=JSON.parse(readFileSync(join(dir,sha.slice(0,8)+'.'+group+'.json')));
  assert.equal(f.sha,sha);assert.equal(f.group,group);return f.results;
};
const runs=shas.map(sha=>Object.assign({},...['nominal','contrôles','réserve'].map(g=>read(sha,g))));
const [reference,candidate]=runs,n=reference.nominal.steps;
const decision=p=>[p.family,p.kind,p.command];
for(const r of runs)for(const item of Object.values(r)){
  for(const [i,{pre,after}] of item.steps.entries()){
    assert.ok(pre.guard);assert.equal(after.ticket,pre.ticket);assert.equal(after.propriétaire,pre.family);
    const next=item.steps[i+1]?.pre??item.nextStationary;
    if(next)assert.equal(after.ref,next.ref);
  }
}
for(const name of ['nominal','stationnaire','imageT3','stationnaireT3'])assert.deepEqual(candidate[name],reference[name]);
for(const name of ['autre-commande','retrait','permutation']){
  assert.deepEqual(reference[name].steps,n);
  assert.deepEqual(candidate[name].steps[0],n[0]);
  assert.equal(candidate[name].steps[1].pre.ref,n[1].pre.ref);
}
assert.deepEqual(candidate.permutation.steps,n);
assert.deepEqual(n[0].after.record.candidates_before,large);
assert.deepEqual(n[0].after.record.candidates_after,domain);
assert.equal(n[0].after.record.feedback,'GLOBAL');

function checkNavigation(step,x,focus){
  const {pre,after}=step;
  assert.deepEqual(decision(pre),[owner,nav,click(x)]);
  assert.deepEqual([pre.subset.focus,pre.subset.scope,pre.subset.candidates],[focus,domain,domain]);
  assert.equal(pre.subset.prediction,null);assert.equal(after.match,null);assert.equal(after.seal,true);
}
checkNavigation(n[1],6,large);checkNavigation(n[2],16,large);
const ranked=n[1].pre.offers.pre.offers;
assert.deepEqual(ranked.map(o=>o.command.data.x).sort((a,b)=>a-b),[6,16]);
assert.ok(ranked.every(o=>!o.knownEffect && o.scope.every(c=>domain.includes(c)) && o.scope.length===domain.length));
assert.equal(n[1].after.count,14);assert.equal(n[1].after.record.kind,'public_subset_feedback');
assert.deepEqual([n[1].after.record.candidates_before,n[1].after.record.candidates_after],[domain,domain]);
assert.deepEqual(n[2].pre.offers.pre.offers.map(o=>o.command.data.x),[16]);
assert.equal(n[1].pre.offers.pre.pressShapes.length+1,n[2].pre.offers.pre.pressShapes.length);

function checkReceipt(step,scope){
  const r=step.after.record;
  assert.equal(r.kind,'scope_navigation_response');
  assert.deepEqual([r.before,r.after],[step.pre.ref,step.after.ref]);
  assert.deepEqual([r.expected_focus,r.observed_focus,r.candidates_unchanged],[domain,scope,domain]);
  assert.equal(r.matched,false);
}
checkReceipt(n[2],partial);
assert.deepEqual(decision(n[3].pre),[owner,query,click(6)]);
assert.deepEqual(n[3].pre.subset.focus,partial);
assert.deepEqual(n[3].pre.subset.candidates,domain);
const forged={...n[2].after.record,after:n[1].after.ref};
const legitimate=(receipt,step)=>receipt.before===step.pre.ref && receipt.after===step.after.ref &&
  JSON.stringify(receipt.candidates_unchanged)===JSON.stringify(step.pre.subset.candidates);
assert.ok(legitimate(n[2].after.record,n[2]));assert.ok(!legitimate(forged,n[2]));
assert.equal(reference.nominal.staleChecks[0].admitted,false);
assert.equal(reference.nominal.staleChecks[0].reason,'subset_scope_changed');

const different=candidate['autre-commande'].steps;
checkNavigation(different[1],16,large);checkReceipt(different[1],partial);
assert.deepEqual(decision(different[2].pre),decision(n[3].pre));
assert.deepEqual(different[2].pre.subset.focus,partial);
const withdrawal=candidate.retrait.steps;
assert.deepEqual(decision(withdrawal[1].pre),['observed_frontier','experiment',click(10,23)]);
assert.deepEqual(decision(withdrawal[2].pre),decision(n[1].pre));
const s2=reference.stationnaire,s2ret=s2.steps[1].after;
assert.deepEqual(s2.steps[1].pre,n[1].pre);
assert.equal(s2ret.gamePacket,n[1].after.gamePacket);
assert.deepEqual(s2ret.imagesJeu,n[1].after.imagesJeu);
assert.ok(s2ret.images.every(img=>img===s2ret.avant));
checkReceipt(s2.steps[1],large);
assert.deepEqual([s2.nextStationary.kind,s2.nextStationary.command],[nav,click(16)]);
assert.deepEqual(s2.nextStationary.offers.pre.pressShapes,n[1].pre.offers.pre.pressShapes);
assert.ok(s2.nextStationary.offers.pre.attempted.includes(n[1].pre.subset.question));
assert.ok(!n[2].pre.offers.pre.attempted.includes(n[1].pre.subset.question));

const image=reference.imageT3,s3=reference.stationnaireT3, nominal=n[2].after;
for(const trial of [image,s3]){
  assert.deepEqual(trial.steps.slice(0,2),n.slice(0,2));
  assert.deepEqual(trial.steps[2].pre,n[2].pre);
  assert.equal(trial.steps[2].after.gamePacket,nominal.gamePacket);
  assert.equal(trial.steps[2].after.count,nominal.count);
}
const {choisie,possibles}=image.formeT3;
const keep=nominal.imagesJeu.map((h,i)=>h!==nominal.shownFrame&&i<nominal.count-1?i:-1).filter(i=>i>=0);
assert.equal(possibles,keep.length);assert.ok(choisie===null?keep.length===0:keep.includes(choisie));
assert.deepEqual(image.steps[2].after.images,nominal.images.map((h,i)=>i===choisie?h:nominal.shownFrame));
assert.equal(image.steps[2].after.shownFrame,nominal.shownFrame);
checkReceipt(image.steps[2],partial);
assert.deepEqual([image.nextStationary.kind,image.nextStationary.command],[query,click(6)]);
checkReceipt(s3.steps[2],large);
assert.ok(s3.steps[2].after.images.every(img=>img===s3.steps[2].after.avant));
assert.deepEqual([s3.nextStationary.kind,s3.nextStationary.command],[query,click(13,26)]);
assert.notEqual(s3.nextStationary.question,image.nextStationary.question);
assert.deepEqual(s3.nextStationary.offers.pre.focus,large);
assert.deepEqual(s3.nextStationary.offers.pre.candidates,domain);
assert.equal(s3.nextStationary.offers.pre.queryCount,0);
assert.equal(image.nextStationary.offers.pre.queryCount,2);

const stats=runs.map((r,i)=>({sha:shas[i],départs:Object.keys(r).length,gestes:Object.values(r).reduce((sum,v)=>sum+v.steps.length,0)}));
console.log(JSON.stringify({stats,candidats:domain,portées:{initiale:large,visée:domain,observéeAprèsT3:partial},
  nominal:n.map(s=>({tour:s.i,choix:decision(s.pre),acquisition:s.after.record?.kind,images:s.after.count})),
  autre:different.slice(1,3).map(s=>decision(s.pre)),retrait:withdrawal.slice(1,3).map(s=>decision(s.pre)),
  stationnaireT2:{suite:s2.nextStationary.command,candidats:domain,portée:large},
  réserve:{images:nominal.count,intermédiairesDifférentes:possibles,suiteImageT3:image.nextStationary.kind,
    suiteStationnaireT3:s3.nextStationary.kind,commandeStationnaireT3:s3.nextStationary.command,fauxReçuRejeté:true}},null,2));
