import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {isDeepStrictEqual as eq} from 'node:util';
const [dir]=process.argv.slice(2),shas=['d0e7527ca8033bd805a6d7a8bb021eff62e87021','c0b9f4027f1df257d7b8c96f5656f9dbb83661f0'];
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const signatures={};
function read(sha,group){
  const {sha:receipt,...data}=JSON.parse(readFileSync(join(dir,sha.slice(0,8)+'.'+group+'.json')));
  assert.equal(receipt,sha);
  if(group!=='retrait'){
    const h=hash(data);
    if(sha===shas[0])signatures[group]=h;else assert.equal(h,signatures[group]);
  }
  return data;
}
function checkQuery(r){
  assert.ok(r.family==='subset_diagnosis' && r.kind==='subset_scope_query' && r.query?.mode==='query' &&
    r.guard.admitted && r.ticket.actionRef==='ACTION6' && r.matched===null);
  const pre=r.offerSet.pre;assert.equal(r.offerSet.sha256,hash(pre));assert.equal(pre.observation,r.ticket.observationRef);
  const scores=pre.offers.map(o=>{
    const yes=pre.candidates.filter(x=>o.tested.includes(x)).length,no=pre.candidates.length-yes;
    assert.deepEqual([o.global,o.local,o.remaining],[yes,no,Math.max(yes,no)]);return Math.max(yes,no);
  });
  const best=Math.min(...scores),optimal=pre.offers.filter((_,i)=>scores[i]===best);
  assert.ok(optimal.some(o=>eq(o.command.data,r.ticket.data) && eq(o.tested,r.query.tested)));
  const f=r.feedback,e=f.event;
  assert.ok(f.before===r.ticket.observationRef && f.after===r.after && eq(f.command,{action_ref:r.ticket.actionRef,data:r.ticket.data}));
  assert.ok(e && ['GLOBAL','LOCAL'].includes(e.label) && e.before===f.before && e.after===f.after);
  assert.deepEqual(e.tested,r.query.tested);assert.deepEqual(e.beforeDomain,pre.candidates);
  const kept=pre.candidates.filter(x=>e.tested.includes(x)===(e.label==='GLOBAL'));
  assert.deepEqual(kept,e.afterDomain);assert.deepEqual(kept,f.retained);
  return {offres:scores.length,coût:best,optima:optimal.length,point:r.ticket.data,question:r.query.key,
    cadres:r.frames,retour:e.label,restants:kept};
}
let normal,active,other;
for(const sha of shas){
  const d=read(sha,'catalogue'),q=d.rows[3];
  normal=checkQuery(q);assert.deepEqual([normal.offres,normal.coût,normal.optima],[6,2,2]);
  assert.equal(normal.retour,'LOCAL');
  for(const c of [d.stationary,d.last]){
    assert.deepEqual(c.ticket,q.ticket);assert.deepEqual(c.offerSet,q.offerSet);assert.equal(c.frames,1);
    assert.equal(c.feedback.event,null);assert.deepEqual(c.feedback.retained,q.offerSet.pre.candidates);
  }
  assert.equal(d.last.after,q.after);assert.deepEqual(d.permutation.command.data,q.ticket.data);
  const r=read(sha,'curieux').rows;
  assert.ok(r[0].opening && r[0].family==='observed_frontier' && r[0].completed===1);
  assert.ok(r[3].level===2 && r[3].kind==='subset_scope_navigation' && !r[3].offerSet);
  active={ouverture:r[0].ticket.data,famille:r[0].family,tour4:r[3].kind};
  for(const group of ['finite.dev','finite.res'])assert.ok(read(sha,group).rejetCommandeHistorique);
  if(sha===shas[1]){
    const alt=read(sha,'retrait').rows;
    assert.deepEqual(alt.slice(0,3),d.rows.slice(0,3));assert.deepEqual(alt[3].offerSet,q.offerSet);
    other=checkQuery(alt[3]);assert.equal(other.coût,normal.coût);assert.notDeepEqual(other.point,normal.point);
    assert.notEqual(other.question,normal.question);assert.equal(other.retour,'GLOBAL');assert.deepEqual(other.restants,normal.restants);
  }
}
console.log(JSON.stringify({révisions:shas,catalogue:normal,ouvertureActive:active,autreOptimum:other,empreintes:signatures},null,2));
