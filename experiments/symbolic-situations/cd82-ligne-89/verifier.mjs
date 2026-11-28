import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const dir=process.argv[2];
const shas=['d0e7527ca8033bd805a6d7a8bb021eff62e87021','a6f7b0de19f013b132ff133b1084be86988b2dc1'];
const read=(sha,g,x)=>readFileSync(join(dir,sha.slice(0,8)+'.'+g+'.'+x),'utf8');
const [gel,comparison]=shas.map(sha=>{
  const tap=read(sha,'auteur','txt');
  assert.match(tap,/\bpass 2\b/);assert.match(tap,/\bfail 0\b/);
  return Object.assign({},...['nominal','contrôles'].map(group=>{
    const value=JSON.parse(read(sha,group,'json'));
    assert.equal(value.sha,sha);assert.equal(value.group,group);
    return value.cases;
  }));
});
assert.deepEqual(gel,comparison);
const {nominal,sansModèle,autreDomaine,hypothèseN1}=gel,n=nominal.rows;
assert.equal(n.filter(r=>r.ticket?.owner==='surface_program'&&r.ticket.admis).length,16);
assert.deepEqual(n.filter((r,i)=>i&&r.score>n[i-1].score).map(r=>r.tour-1),[9,15]);
const t1=n[0],t10=n[9],r10=n[10].ret;
assert.deepEqual([t1.ticket.plan.models,t1.ticket.command,n[1].ret.event.models,n[1].ret.matched,n[1].ret.surface],
  [240,'ACTION1',96,null,0]);
assert.equal(n[8].ticket.plan.models,1);
assert.equal(n[9].ret.reason,'official_boundary');
assert.equal(n[9].ret.event.origin,n[9].ret.ref);
assert.deepEqual(t10.ticket.plan.program,[[6,15],[1,12]]);
assert.deepEqual([t10.ticket.plan.models,t10.ticket.command,r10.surface,r10.fixed,r10.matched],[1,'ACTION5',50,0,true]);
assert.deepEqual([r10.id,r10.event.before,r10.event.after],[t10.ticket.id,t10.ref,r10.ref]);
assert.deepEqual(t10.ticket.guards,{reference:false,edit:false,stale:false});
assert.deepEqual([n[10].ticket.command,n[10].ticket.point,n[10].ticket.plan.program],['ACTION6',{x:46,y:4},[[1,12]]]);
for(const arm of [sansModèle,autreDomaine,hypothèseN1]){
  assert.deepEqual(arm.rows.slice(0,9),n.slice(0,9));
  assert.equal(arm.rows[9].photo,t10.photo);
  assert.deepEqual(arm.rows[9].ticket.plan.program,t10.ticket.plan.program);
  assert.equal(arm.controls[0].source,n[9].ret.ref);
}
assert.equal(sansModèle.controls[0].used,null);
assert.notDeepEqual(autreDomaine.controls[0].used.keys,autreDomaine.controls[0].original.keys);
assert.deepEqual(autreDomaine.controls[0].used.models,autreDomaine.controls[0].original.models);
assert.deepEqual(sansModèle.rows,autreDomaine.rows);
for(const arm of [sansModèle,autreDomaine]){
  const [a,b]=arm.rows.slice(9);
  assert.deepEqual([a.ticket.command,a.ticket.plan.models,b.ret.surface,b.ret.matched,b.ticket.command,b.ticket.plan.models],
    ['ACTION1',240,0,null,'ACTION2',96]);
}
const [a,b]=hypothèseN1.rows.slice(9),[source]=hypothèseN1.controls;
assert.equal(source.early,n[1].ret.ref);
assert.deepEqual(source.used.keys,source.original.keys);
assert.notDeepEqual(source.used.models,source.original.models);
assert.deepEqual([a.ticket.command,a.ticket.plan.models,b.ret.surface,b.ret.fixed,b.ret.matched,b.ret.event.models],
  ['ACTION4',1,0,0,false,0]);
assert.notEqual(b.ticket.owner,'surface_program');
assert.ok([gel,comparison].every(c=>Object.values(c).reduce((s,k)=>s+k.rows.filter(x=>x.ret).length,0)===49));
console.log(JSON.stringify({stats:{versions:2,départsParVersion:4,gestesParVersion:49,testsParVersion:2,catalogue:16},
  preuve:{surfaces:[t10.ticket.plan.target,t10.ticket.plan.surface],acquis:n[9].ret.event.origin,
    commande:t10.ticket.command,retour:r10.ref,édition:r10.surface,référence:r10.fixed,passages:[9,15]},
  modèleErroné:{origine:source.early,commande:a.ticket.command,refus:b.ret.matched,repli:b.ticket.command,propriétaire:b.ticket.owner}},null,2));
