import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const dir=process.argv[2];
const versions=['d0e7527ca8033bd805a6d7a8bb021eff62e87021','aa9c4cfe2c4ac65d5f1164c7748a8a2c1f677aec'];
const read=(s,g,e)=>readFileSync(join(dir,s.slice(0,8)+'.'+g+'.'+e),'utf8');
const [gel,candidat]=versions.map(sha=>{
  const tap=read(sha,'auteur','txt');
  assert.match(tap,/\bpass 4\b/);assert.match(tap,/\bfail 0\b/);
  return Object.assign({},...['nominal','contrôles'].map(group=>{
    const d=JSON.parse(read(sha,group,'json'));
    assert.equal(d.sha,sha);assert.equal(d.group,group);
    return d.cases;
  }));
});
assert.deepEqual(gel,candidat);
const {nominal,retraitDeux,doublon,sansLimite,stationnaire}=gel,n=nominal.rows;
assert.equal(n.filter(r=>r.ret).length,9);
assert.ok(n.slice(0,8).every(r=>r.ticket.owner==='visual_sequences'&&r.ticket.admitted));
assert.equal(n[9].arrêt,'nested_control_effect_requires_composition');
const rev=ref=>Number(ref.match(/:revision:(\d+):/)[1]);
for(let i=0;i<8;i++){
  const t=n[i].ticket,r=n[i+1].ret,e=r.event;
  assert.equal(r.id,t.id);
  assert.equal(r.matched,null);
  assert.equal(r.sealed,true);
  assert.equal(e.ref,r.ref);
  if([3,7].includes(i))assert.equal(e.status,'official_boundary');
  else{
    assert.equal(e.status,'observed_row_completion');
    assert.ok(e.preserved&&e.filled);
    assert.equal(e.observed,t.expected);
  }
}
assert.deepEqual(n.filter((r,i)=>i>0&&r.score>n[i-1].score).map(r=>r.tour-1),[4,8]);
assert.deepEqual(n[4].ticket.continuation.map(rev),[3,4,5]);
assert.deepEqual([n[4].ticket.guards.point,n[4].ticket.guards.stale],[false,false]);
for(const [k,arm] of Object.entries({retraitDeux,doublon,sansLimite})){
  assert.deepEqual(arm.rows.slice(0,4),n.slice(0,4));
  const [decision,response]=arm.rows.slice(4),[cut]=arm.cuts;
  assert.equal(decision.photo,n[4].photo);
  assert.deepEqual([decision.ticket.command,decision.ticket.point],['ACTION6',{x:46,y:54}]);
  assert.deepEqual(response.ret,n[5].ret);
  if(k!=='doublon')assert.equal(decision.ticket.continuation,undefined);
  else{
    const refs=decision.ticket.continuation.map(rev);
    const seen=cut.used.filter(x=>x.status==='observed_row_completion');
    assert.equal(new Set(seen.map(x=>x.key)).size,2);
    assert.deepEqual(refs,[3,3,5]);
  }
}
const [original,blocked,next]=stationnaire.rows;
assert.equal(original.photo,blocked.photo);
assert.equal(blocked.ret.physical,n[1].ret.physical);
assert.equal(blocked.ret.event.status,'answer_acceptance_unconfirmed');
assert.deepEqual([blocked.ret.event.filled,blocked.ret.event.preserved,blocked.ret.matched,blocked.ret.sealed],[false,true,null,true]);
assert.ok(blocked.ret.event.fail.includes(original.ticket.trial));
assert.deepEqual([blocked.ticket.owner,blocked.ticket.command],['observed_frontier','ACTION1']);
assert.notEqual(next.photo,original.photo);
assert.notEqual(next.ticket.trial,original.ticket.trial);
assert.deepEqual(next.ticket.point,original.ticket.point);
assert.equal(next.score,0);
assert.ok([gel,candidat].every(d=>Object.values(d).reduce((a,r)=>a+r.rows.filter(x=>x.ret).length,0)===26));
console.log(JSON.stringify({stats:{versions:2,départsParVersion:5,gestesParVersion:26,
  testsParVersion:4,occurrencesCatalogue:8,gestesCatalogue:9,niveauxTerminés:2},
  continuation:{authentiques:n[4].ticket.continuation.map(rev),dupliquées:doublon.rows[4].ticket.continuation.map(rev),
    choix:n[4].ticket.point},stationnaire:{statut:blocked.ret.event.status,repli:blocked.ticket.command,
    reprise:next.ticket.point,autreEssai:next.ticket.trial}},null,2));
