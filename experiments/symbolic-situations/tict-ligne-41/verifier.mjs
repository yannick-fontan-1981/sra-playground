import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const [dir,spReceipts]=process.argv.slice(2);
const shas=['d0e7527ca8033bd805a6d7a8bb021eff62e87021','e8df1757272cae3da1669b3e7ddb2e7bf65e8e02'];
const spSha='bb4a99b5ba41531eb70f1dccb6a97a919cefec56';
const tree=sha=>execFileSync('git',['rev-parse',sha+':src'],{encoding:'utf8'}).trim();
assert.equal(tree(shas[1]),tree(spSha));
const read=(sha,group)=>{
  const f=JSON.parse(readFileSync(join(dir,sha.slice(0,8)+'.'+group+'.json')));
  assert.equal(f.sha,sha);assert.equal(f.group,group);return f.cases;
};
const roots=shas.map(sha=>({...read(sha,'nominal'),...read(sha,'variantes')}));
assert.deepEqual(roots[0],roots[1]);
const cases=roots[0],base=cases.nominal;
for(const rows of Object.values(cases)){
  for(let i=0;i<rows.length-1;i++){
    const t=rows[i].ticket, result=rows[i+1].returned;
    assert.deepEqual([t.family,t.kind,t.sub,t.action,t.admitted],
      ['public_occurrence_recall','cell_patch_placement','cell_patch_composition','ACTION6',true]);
    assert.equal(result.ticket,t.id);assert.equal(result.family,t.family);
    assert.equal(rows[i+1].ticket?.ref??result.ref,result.ref);
    assert.ok(result.events.every(e=>e.refs[0]===t.ref && e.refs[1]===result.ref));
  }
}
const locate=frame=>frame.map(c=>c.cell);
const first=base[0].ticket, observed=base[1].returned, next=base[1].ticket;
assert.deepEqual(first.data,{x:31,y:28});assert.deepEqual(first.point,[1,1]);assert.equal(first.expected,null);
assert.equal(observed.matched,null);
assert.deepEqual(observed.frames.map(locate),[[[1,1]],[[1,1]],[[1,1],[1,2]],[[1,1],[1,2]],[[1,1],[1,2]]]);
const local=observed.frames.findIndex(f=>f.length===1 && String(f[0].cell)===String(first.point));
const distant=observed.frames.findIndex(f=>f.length===2);
const localHash=observed.frames[local][0].to, remoteHash=observed.frames[distant][1].to;
assert.ok(observed.frames.every(f=>f[0].to===localHash));
assert.ok(observed.frames.slice(distant).every(f=>f[1].to===remoteHash));
assert.notEqual(localHash,remoteHash);
const acquisition=observed.events.find(e=>e.method==='recordPacket'),[model]=acquisition.models;
assert.deepEqual(acquisition.order,[local,distant]);assert.deepEqual(model.order,[local,distant]);
assert.equal(model.status,'candidate');assert.equal(model.field,first.fieldRef);assert.notEqual(model.own,model.other);
assert.deepEqual(model.evidence,[first.ref,observed.ref]);
assert.deepEqual(next.data,{x:15,y:12});assert.deepEqual(next.model,model);assert.equal(next.expected,model.own);
assert.ok(next.search);assert.ok(model.evidence.every(ref=>next.refs.includes(ref)));
assert.equal(base[2].returned.matched,true);
assert.ok(base[2].returned.frames.at(-1).some(c=>String(c.cell)===String(next.point) && c.to===localHash));

const variants={};
for(const name of ['statut','finale','distantDabord']){
  const [initial,{returned,ticket}]=cases[name];
  assert.deepEqual(initial,base[0]);assert.equal(returned.realFinalHash,observed.finalHash);
  assert.equal(returned.matched,null);
  assert.ok(returned.events.every(e=>e.method!=='recordPacket' && e.models.length===0));
  assert.equal(ticket.model,null);assert.equal(ticket.expected,null);assert.equal(ticket.search,false);
  assert.deepEqual(ticket.refs,[returned.ref]);
  assert.deepEqual(ticket.data,name==='statut'?first.data:next.data);
  if(name==='statut')assert.deepEqual(returned.frames,[[]]);
  else{
    assert.equal(returned.finalHash,observed.finalHash);
    assert.equal(returned.ref,observed.ref);
    assert.deepEqual(returned.frames.at(-1),observed.frames.at(-1));
  }
  variants[name]={images:returned.frames.length,cellulesParImage:returned.frames.map(locate),
    mêmeFinale:returned.finalHash===observed.finalHash,pointT2:ticket.data,modèle:ticket.model};
}
assert.equal(variants.distantDabord.images,observed.frames.length);
assert.deepEqual(variants.distantDabord.cellulesParImage[0],[[1,2]]);
assert.deepEqual(variants.distantDabord.cellulesParImage.slice(1),Array(4).fill([[1,1],[1,2]]));
const failed=cases.réfutation[2];
assert.deepEqual(cases.réfutation.slice(0,2),base.slice(0,2));
assert.equal(failed.returned.matched,false);assert.deepEqual(failed.returned.frames,[[]]);
assert.equal(failed.ticket.model.status,'refuted');assert.equal(failed.ticket.model.counterexample,failed.returned.ref);
assert.equal(failed.ticket.expected,null);assert.equal(failed.ticket.search,false);assert.deepEqual(failed.ticket.data,next.data);

const physical=base.slice(1);
const counts={tickets:physical.length,confirmés:physical.filter(r=>r.returned.matched===true).length,
  contredits:physical.filter(r=>r.returned.matched===false).length,indéterminés:physical.filter(r=>r.returned.matched===null).length};
assert.deepEqual(Object.values(counts),[16,9,0,7]);
const authorTests=shas.map((sha,i)=>{
  const report=readFileSync(join(dir,sha.slice(0,8)+'.auteur.txt'),'utf8');
  const n=i?12:8;
  assert.match(report,new RegExp('pass '+n+'\\b'));assert.match(report,/fail 0/);
  return n;
});
const spFolder=new URL('../sp80-lignes-4-41/',import.meta.url);
const spReport=JSON.parse(readFileSync(new URL('recu.json',spFolder)));
const spMeasured=JSON.parse(execFileSync(process.execPath,[fileURLToPath(new URL('verifier.mjs',spFolder)),spReceipts]));
assert.deepEqual(spMeasured,spReport);
assert.equal(spReport.stats[1].sha,spSha);
assert.equal(spReport.nominal[41].tickets,5);assert.equal(spReport.nominal[41].confirmés,0);
assert.deepEqual(spReport.placement.autrePoint,['ACTION6',{x:33,y:17}]);
assert.equal(spReport.placement.variationFinale.local,0);
console.log(JSON.stringify({shas,moteurCommunAvecSP80:tree(spSha),départsTICTParSHA:Object.keys(cases).length,
  gestesTICTParSHA:Object.values(cases).reduce((s,r)=>s+r.length-1,0),testsAuteur:authorTests,
  tict:counts,catalogue:{TICT:16,SP80:5,couverts:21,total:45},
  acquisition:{point:first.data,cellulesParImage:observed.frames.map(locate),indexImages:model.order,pointT2:next.data,confirméT2:true},
  variations:variants,réfutation:{matched:failed.returned.matched,modèle:failed.ticket.model.status,nouvelleSonde:failed.ticket.data},
  sp80:spReport.placement},null,2));
