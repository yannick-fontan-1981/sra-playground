import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const dir=process.argv[2];
const sha=['d0e7527ca8033bd805a6d7a8bb021eff62e87021','4dcc659183c31502edcca85f29d661426660a426'];
const read=(s,g,ext)=>readFileSync(join(dir,s.slice(0,8)+'.'+g+'.'+ext),'utf8');
const [base,candidate]=sha.map(s=>{
  const {sha,...receipt}=JSON.parse(read(s,'contrôles','json'));
  assert.equal(s,sha);
  const tap=read(s,'auteur','txt');
  assert.match(tap,/\bpass 6\b/);
  assert.match(tap,/\bfail 0\b/);
  return receipt;
});
assert.deepEqual(base,candidate);
const result={};
const move=(a,b)=>a.map((v,i)=>b[i]-v);
const coord=a=>a.join(',');
for(const [axis,arms] of Object.entries(base.cases)){
  const {ouvert,fermé,sansPreuve,stationnaire}=arms;
  assert.deepEqual(Object.values(arms).map(c=>c.rows.filter(x=>x.ret).length),[9,4,4,5]);
  assert.ok(Object.values(arms).every(c=>c.rows.every(x=>x.vue.score===0)));
  for(const run of [fermé,sansPreuve,stationnaire])assert.deepEqual(run.rows.slice(0,3),ouvert.rows.slice(0,3));
  const [first,,invoked,offered,fourth,crossed]=ouvert.rows;
  const expected=axis==='horizontal'?[2,0]:[0,2];
  const missing=fermé.rows[3],counter=sansPreuve.rows[3],missed=stationnaire.rows[5];
  assert.deepEqual([first.ticket.owner,first.ticket.mode,first.ticket.command],['motif_access','calibrate','ACTION4']);
  assert.deepEqual([invoked.ticket.mode,invoked.ticket.command,invoked.ticket.data],['invoke','ACTION6',{x:7,y:24}]);
  assert.equal(offered.ret.id,invoked.ticket.id);
  assert.equal(missing.ret.id,invoked.ticket.id);
  assert.deepEqual(offered.vue.pixels,missing.vue.pixels);
  const alteredSupport=base.invocationDifferences[axis];
  assert.equal(alteredSupport.length,10);
  assert.ok(alteredSupport.every(([, ,old,now])=>old===0&&now===7));
  assert.deepEqual(new Set(alteredSupport.map(x=>coord(x.slice(0,2)))),new Set(offered.vue.support.map(x=>coord(x.slice(0,2)))));
  assert.deepEqual([offered.ticket.owner,offered.ticket.entry,offered.ticket.mode,offered.ticket.command,offered.ticket.admitted],
    ['motif_access','motif_conditioned_access','walk','ACTION4',true]);
  assert.deepEqual([missing.ticket.owner,missing.ticket.entry,missing.ticket.mode,missing.ticket.command,missing.ticket.data],
    ['motif_access','motif_conditioned_access','toggle','ACTION6',{x:7,y:20}]);
  assert.equal(fermé.rows[4].ret.matched,true);
  assert.deepEqual(fermé.rows[4].vue.pixels,missing.vue.pixels);
  for(const c of [ouvert,fermé]){
    const invocation=c.events.find(e=>e.mode==='invoke');
    assert.equal(invocation.ref,c.rows[3].ret.ref);
    assert.equal(invocation.cleared,true);
    assert.deepEqual(invocation.before,invocation.after);
    assert.deepEqual(c.events.find(e=>e.mode==='calibrate').motion.ACTION4,expected);
  }
  assert.equal(counter.vue.hash,offered.vue.hash);
  assert.equal(counter.ticket.command,offered.ticket.command);
  assert.equal(counter.ticket.mode,'walk');
  assert.equal(counter.ticket.admitted,true);
  const [withdrawal]=sansPreuve.alterations;
  assert.equal(withdrawal.removed,offered.ret.ref);
  assert.equal(counter.ticket.refs.length,offered.ticket.refs.length-1);
  assert.equal(counter.ticket.refs[0],withdrawal.removed);
  assert.equal(sansPreuve.rows[4].ret.actual.hash,fourth.ret.actual.hash);
  assert.equal(sansPreuve.rows[4].ret.matched,true);

  const afterOnSupport=crossed.vue.support.filter(([, ,v])=>v===3||v===4);
  assert.equal(fourth.vue.support.filter(([, ,v])=>v===3||v===4).length,0);
  assert.equal(afterOnSupport.length,2);
  assert.equal(crossed.ret.matched,true);
  assert.equal(crossed.ret.id,fourth.ticket.id);
  const received=ouvert.events.find(e=>e.ref===crossed.ret.ref);
  assert.equal(received.mode,'walk');
  assert.deepEqual(move(received.before[0],received.after[0]),expected);
  assert.deepEqual(received.after,fourth.ticket.expected);
  assert.equal(missed.ret.actual.hash,crossed.ret.actual.hash);
  assert.equal(missed.vue.hash,fourth.vue.hash);
  assert.equal(missed.ret.divergence,8);
  assert.equal(missed.ret.matched,false);
  assert.equal(missed.ret.sealed,true);
  assert.equal(missed.ticket.mode,'toggle');
  result[axis]={command:invoked.ticket.command,data:invoked.ticket.data,openPixels:alteredSupport,
    calibration:expected,crossing:received,withdrew:withdrawal.removed,stationary:'toggle'};
}
console.log(JSON.stringify({stats:{versions:2,terrains:2,départsParVersion:8,gestesParVersion:44,
  franchissementsParVersion:2,testsAuteurParVersion:6,niveauxTerminés:0},result},null,2));
