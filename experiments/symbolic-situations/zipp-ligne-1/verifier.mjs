import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {isDeepStrictEqual as eq} from 'node:util';
import {historical,freeze,candidate} from './situations.mjs';
const [dir]=process.argv.slice(2),signatures={};
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
function packet(sha,group){
  const p=JSON.parse(readFileSync(join(dir,sha.slice(0,8)+'.'+group+'.json')));assert.equal(p.sha,sha);
  if(group!=='retrait'){const h=hash(p.results);if(sha===freeze)signatures[group]=h;else assert.equal(h,signatures[group]);}
  return p.results;
}
const delta=(a,b)=>b.map((v,i)=>v-a[i]);
const patch=(frame,x,y)=>frame.slice(y,y+7).flatMap(r=>r.slice(x,x+7).map(v=>Number(v!==0))).join('');
// Masque du sujet au départ connu de T10. Sa couleur peut changer lors du recalage.
const template=patch(historical.observations[9].frame,11,31);
function locate(i){
  const frame=historical.observations[i].frame,found=[];
  for(let y=0;y<=frame.length-7;y++)for(let x=0;x<=frame[y].length-7;x++)if(patch(frame,x,y)===template)found.push([x,y]);
  assert.equal(found.length,1);return found[0];
}
function isRep(d){return d.acquisition?.experiment==='replicate_translation';}
function sameEffect(d,measured){return isRep(d) && Object.values(d.acquisition.motion).some(v=>eq(v,measured));}
function bound(d,next){
  return next.ret?.ticket===d.ticket.id && next.ret.ref!==d.ticket.observationRef && next.ret.matched===null;
}
let history,summary,retrait;
for(const sha of [freeze,candidate]){
  const [{turns:t}]=packet(sha,'ZIPP'),d=t[14],next=t[15],q=d.acquisition;
  assert.equal(t.length,17);assert.ok(d.ticket.level===2 && d.ticket.actionRef==='ACTION2' && d.guard && isRep(d) &&
    d.family==='acquire_control_for_target' && d.missing===null && d.sub===null && q.pair===d.pair);
  assert.deepEqual(q.evidence,[d.ticket.observationRef,t[9].ticket.observationRef,t[10].ticket.observationRef]);
  const earlier=t.slice(0,14).filter(x=>x.ticket.level===2 && x.ticket.actionRef==='ACTION2');assert.equal(earlier.length,1);
  assert.equal(earlier[0].ticket.id,t[9].ticket.id);
  const past=delta(locate(9),locate(10)),measured=delta(locate(14),locate(15));
  assert.deepEqual(past,[0,12]);assert.deepEqual(Object.values(q.motion),[past]);assert.deepEqual(measured,[0,0]);
  assert.ok(bound(d,next) && !sameEffect(d,measured));assert.equal(next.family,'observed_frontier');
  assert.deepEqual(next.command.data,{x:14,y:10});
  history={point:'ZIPP L2 T15',action:d.command.actionRef,mesureAntérieure:past,prévision:Object.values(q.motion)[0],mesureNouvelle:measured,
    matched:next.ret.matched,T16:next.command};
  summary={};
  for(const group of ['dev','res']){
    const rows=packet(sha,group),[rep,stop,rev,noPrior]=rows;
    assert.equal(rows.length,4);
    assert.deepEqual(rep.turns.slice(0,2),stop.turns.slice(0,2));assert.deepEqual(rep.turns.slice(0,2),rev.turns.slice(0,2));
    for(const [i,r] of rows.entries()){
      const [first,test,after]=r.turns;
      assert.ok(first.family==='acquire_control_for_target' && first.acquisition?.experiment==='sample_unused_control' && first.guard && bound(first,test));
      if(i===3){assert.deepEqual(r.positions[0],r.positions[1]);assert.ok(!isRep(test));continue;}
      const prior=delta(r.positions[0],r.positions[1]),now=delta(r.positions[1],r.positions[2]);
      assert.ok(isRep(test) && test.acquisition.pair===test.pair && test.guard && !test.missing && test.ticket.actionRef===first.ticket.actionRef);
      assert.deepEqual(test.acquisition.evidence,[test.ticket.observationRef,first.ticket.observationRef,test.ret.ref]);
      assert.deepEqual(Object.values(test.acquisition.motion),[prior]);assert.ok(bound(test,after));
      assert.equal(sameEffect(test,now),i===0);
      if(i===1)assert.deepEqual(now,[0,0]);if(i===2)assert.deepEqual(now,prior.map(v=>v===0?0:-v));
    }
    const movement=delta(rep.positions[0],rep.positions[1]),unchanged=delta(stop.positions[1],stop.positions[2]);
    const falsified={measured:movement,physicallyReplicated:true};
    const acceptsMeasured=(receipt,measured,d)=>eq(receipt.measured,measured) && receipt.physicallyReplicated===sameEffect(d,measured);
    assert.ok(!acceptsMeasured(falsified,unchanged,stop.turns[1]));
    assert.ok(!bound(rep.turns[1],{...rep.turns[2],ret:{...rep.turns[2].ret,matched:true}}));
    summary[group]={départs:rows.length,répétitionsDemandées:3,répétitionsPhysiques:1,sansPreuve:1,contrôlesNégatifs:2};
  }
  if(sha===candidate){
    const [{turns}]=packet(sha,'retrait');assert.deepEqual(turns.slice(0,14),t.slice(0,14));
    const alt=turns[14];assert.equal(alt.ticket.observationRef,d.ticket.observationRef);
    assert.ok(alt.retirées>0 && !isRep(alt));
    retrait={famille:alt.family,expérience:alt.acquisition?.experiment??null,action:alt.command};
  }
}
console.log(JSON.stringify({révisions:[freeze,candidate],historique:history,construit:summary,retrait,empreintes:signatures},null,2));
