import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {refs} from './montage.mjs';
const dir=process.argv[2],signatures={};
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
function load(sha,group){
  const r=JSON.parse(readFileSync(join(dir,sha.slice(0,8)+'.'+group+'.json')));assert.equal(r.sha,sha);
  const v=r.rows??r.out;
  if(group!=='alt'){
    if(sha===refs[0])signatures[group]=hash(v);else assert.equal(hash(v),signatures[group],group);
  }
  return v;
}
function accept(row,n=0){
  const p=row.slate.pre,list=p.eligible,max=Math.max(...list.map(o=>o.target?.count??0)),tops=list.filter(o=>o.target?.count===max),q=tops[n];
  assert.equal(row.slate.sha256,hash(p));assert.equal(row.ticket.observationRef,p.observation);
  assert.ok(row.guard.admitted && row.family==='observed_frontier' && row.opening.selected && row.opening.mode==='active');
  assert.deepEqual(row.ticket.data,q.command.data);assert.equal(row.objective.id,q.ref);
  const r=row.returned;assert.ok(r.acquired?.need===row.need && r.acquired.objective===q.ref && r.acquired.status==='observed' &&
    r.after!==row.ticket.observationRef && r.matched===null);
  return {rang:list.length,offres:p.offered.length,max,exÆquo:tops.length,point:row.ticket.data,niveauxTerminés:r.completed,verdict:r.status};
}
let nominal,niveau2,alternative;
for(const sha of refs){
  for(const g of ['dev','res']){const v=load(sha,g);assert.deepEqual(v.égalité,v.retrait);assert.ok(v.nouvelle.guard.admitted && v.doublon.guard.admitted);}
  const d=load(sha,'DICO'),s=load(sha,'shadow')[0],memo=load(sha,'MEMO')[0];
  nominal=accept(d[0]);niveau2=accept(d[1]);assert.equal(d[1].level,2);
  assert.deepEqual([nominal.rang,nominal.max,nominal.exÆquo,nominal.niveauxTerminés],[147,12,4,1]);
  assert.ok(!s.opening.selected && s.guard.admitted);assert.deepEqual(s.opening.command.data,d[0].ticket.data);
  assert.deepEqual(s.ticket.data,{x:1,y:3});assert.equal(s.returned.completed,0);
  assert.ok(memo.family==='public_occurrence_recall' && memo.slate===null && !memo.opening && memo.guard.admitted);
  if(sha===refs[2]){
    const alt=load(sha,'alt')[0];assert.deepEqual(alt.slate,d[0].slate);alternative=accept(alt,1);
    assert.notDeepEqual(alt.ticket.data,d[0].ticket.data);assert.notEqual(alt.objective.id,d[0].objective.id);
  }
}
console.log(JSON.stringify({révisions:refs,nominal,niveau2,alternative,empreintes:signatures},null,2));
