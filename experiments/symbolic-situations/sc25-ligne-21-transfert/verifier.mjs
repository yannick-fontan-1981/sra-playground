import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const dir=process.argv[2];
const shas=['d0e7527ca8033bd805a6d7a8bb021eff62e87021','88e8abe8389ba9e5809de6aa8e2f911053f14959'];
const read=(sha,g,ext)=>readFileSync(join(dir,sha.slice(0,8)+'.'+g+'.'+ext),'utf8');
const [gel,candidate]=shas.map(sha=>{
  const data=JSON.parse(read(sha,'contrôles','json'));
  assert.equal(data.sha,sha);
  const tap=read(sha,'auteur','txt');
  assert.match(tap,/\bpass 1\b/);assert.match(tap,/\bfail 0\b/);
  return data.cases;
});
assert.deepEqual(gel,candidate);
const {intact,sansLien,récepteurÉtranger,sansOuvertureServie}=gel,n=intact.rows;
assert.deepEqual(Object.values(gel).map(r=>r.rows.filter(x=>x.ret).length),[10,9,9,9]);
assert.ok(Object.values(gel).every(r=>r.rows.every(x=>x.vu.score===0)));
assert.deepEqual(intact.events.find(e=>e.tour===3).blocked.map(x=>JSON.parse(x)),[[[5,4],'ACTION4',2]]);
assert.equal(n[3].ret.matched,false);
const qualified=intact.events.find(e=>e.tour===5),link=qualified.ray;
assert.equal(qualified.cleared,true);
assert.equal(qualified.ref,qualified.afterRef);
assert.deepEqual(qualified.motion,{ACTION2:[0,1],ACTION4:[2,0]});
assert.deepEqual([link.receiver,link.card,link.sampled_trajectory,link.linked_blockers,link.evidence],
  [[25,3,29,8],[0,3],[[0,[21,9]],[1,[25,9]]],[[7,4,8,4]],qualified.ref]);
assert.deepEqual(n[7].ret.position,[7,5]);
assert.deepEqual(n[7].vu.support,[0,0,0,0,0,0]);
assert.equal(n[7].ret.entrance,false);
for(const arm of [sansLien,récepteurÉtranger]){
  assert.deepEqual(arm.rows.slice(0,7),n.slice(0,7));
  assert.deepEqual(arm.rows[7].vu,n[7].vu);
  assert.deepEqual(arm.rows[7].ret,n[7].ret);
  for(const cut of arm.cuts){
    assert.equal(cut.invocation,link.evidence);
    assert.deepEqual(cut.before,link);
    assert.deepEqual(cut.motion,qualified.motion);
  }
  assert.deepEqual(arm.rows.slice(7,9).map(x=>[x.ticket.mode,x.ticket.card,x.ticket.data]),
    [['toggle',[1,2],{x:7,y:20}],['invoke',[1,2],{x:3,y:24}]]);
  assert.equal(arm.events.find(x=>x.tour===9).cleared,true);
  assert.deepEqual(arm.rows[9].vu.support,[0,0,0,0,0,0]);
  assert.equal(arm.rows[9].ret.entrance,false);
  assert.equal(arm.rows[9].ticket.mode,'toggle');
}
assert.ok(sansLien.cuts.every(c=>c.used===null));
assert.ok(récepteurÉtranger.cuts.every(c=>c.used.receiver[0]===45));
assert.deepEqual(n.slice(7,9).map(x=>[x.ticket.mode,x.ticket.card,x.ticket.data]),
  [['toggle',[0,3],{x:3,y:20}],['invoke',[0,3],{x:7,y:24}]]);
assert.equal(intact.events.find(x=>x.tour===9).cleared,true);
assert.deepEqual(n[9].vu.support,[7,7,7,7,7,7]);
assert.deepEqual([n[9].ticket.owner,n[9].ticket.mode,n[9].ticket.command,n[9].ticket.admitted],
  ['motif_access','walk','ACTION4',true]);
assert.deepEqual(n[10].ret.position,[9,5]);
assert.deepEqual(n[10].vu.support,[3,4,7,7,7,7]);
assert.equal(n[10].ret.matched,true);
assert.equal(n[10].ret.id,n[9].ticket.id);

const hidden=sansOuvertureServie.rows[9];
assert.deepEqual(sansOuvertureServie.rows.slice(0,9),n.slice(0,9));
assert.equal(hidden.ret.raw.raster,n[9].ret.raw.raster);
assert.ok(hidden.ret.contraste.every(([x,y,a,b])=>y===6&&x>=9&&x<=14&&a===7&&b===0));
assert.equal(hidden.ret.contraste.length,6);
assert.equal(hidden.ticket.mode,'toggle');
console.log(JSON.stringify({stats:{versions:2,départsParVersion:4,gestesParVersion:37,testsParVersion:1,
  franchissementsParVersion:1,niveauxTerminés:0},
  preuve:link,choixAvec:[0,3],choixSans:[1,2],entrée:n[10].ret.position,retour:n[10].ret.ref},null,2));
