import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {gunzipSync} from 'node:zlib';

const [dir]=process.argv.slice(2);
const shas=['d0e7527ca8033bd805a6d7a8bb021eff62e87021','1e11472a8acfe8d4287cf33e58fe3f629e532fb9'];
const tree=sha=>execFileSync('git',['rev-parse',sha+':src'],{encoding:'utf8'}).trim();
assert.equal(tree(shas[0]),tree(shas[1]));
const family='configured_arrivals',kind='configured_first_arrival_composition',packet='public_configured_arrival_packet';
function read(sha,g){
  const f=JSON.parse(readFileSync(join(dir,sha.slice(0,8)+'.'+g+'.json')));
  assert.equal(f.sha,sha);assert.equal(f.group,g);return f.cases;
}
const comparisons=shas.map(sha=>Object.assign({},...['nominal','contrôles','réserve'].map(g=>read(sha,g))));
assert.deepEqual(comparisons[0],comparisons[1]);
const c=comparisons[0], n=c.nominal.rows;
const t=(rows,tour)=>rows[tour-1].ticket,r=(rows,tour)=>rows[tour].ret;
const event=(rows,tour,kind)=>r(rows,tour).events.find(e=>e.kind===kind);
const choice=t=>[t.owner,t.kind,t.cmd,t.data];
for(const {rows} of Object.values(c))for(let i=0;i<rows.length-1;i++){
  const before=rows[i].ticket,after=rows[i+1].ret;
  assert.ok(before.admis);assert.equal(before.id,after.id);assert.equal(before.owner,after.owner);
  if(rows[i+1].ticket)assert.equal(rows[i+1].ticket.ref,after.ref);
}
assert.equal(n.length,17);
const nominalTickets=n.slice(0,-1).filter(x=>x.ticket.owner===family);
assert.equal(nominalTickets.length,13);
assert.ok(nominalTickets.every(x=>x.ticket.kind===kind));
assert.deepEqual(choice(t(n,1)),['observed_frontier','experiment','ACTION5',{}]);
assert.equal(r(n,1).frames.length,75);
const tracePath='docs/migration/native-campaigns-v57/baseline-smlp/smlp-public-trace.json.gz';
const {packets}=JSON.parse(gunzipSync(execFileSync('git',['show',shas[0]+':'+tracePath],{maxBuffer:16*1024*1024})));
function lastVisibleAlongSegment(frames,color,anchor,target,firstSample){
  const distance=(p,q)=>Math.abs(p[0]-q[0])+Math.abs(p[1]-q[1]);
  const length=distance(anchor,target);
  return frames.findLastIndex((frame,index)=>{
    if(index<firstSample)return false;
    for(let y=1;y+1<frame.length;y++)for(let x=1;x+1<frame[y].length;x++){
      if(distance(anchor,[x,y])+distance([x,y],target)!==length)continue;
      if([frame[y-1][x],frame[y+1][x],frame[y][x-1],frame[y][x+1]].every(p=>p===color) && frame[y][x]!==color)return true;
    }
    return false;
  });
}
const fits={};
for(const [tour,tracks,count,base,times] of [
  [1,2,24,4,{9:52,12:68}],[4,3,12,4,{9:84,12:148,15:68}],
  [9,3,6,3,{9:42,12:24,15:48}],[11,3,3,3,{9:54,12:24,15:48}]
]){
  const e=event(n,tour,packet);
  assert.deepEqual([e.before,e.after],[t(n,tour).ref,r(n,tour).ref]);
  assert.deepEqual([e.tracks,e.compatible_route_orders,e.samples_per_cell],[tracks,count,base]);
  for(const [k,v] of Object.entries(e.measured.paths)){
    const arrival=v.ticks.at(-1);
    assert.equal(arrival,times[k]);assert.deepEqual(v.path.at(-1),e.measured.goal);
    if(v.goalVisible!==null)assert.equal(v.goalVisible,arrival);
    else{
      const frames=packets[tour].packet.frame_packet;
      const last=lastVisibleAlongSegment(frames,Number(k),v.path.at(-2),e.measured.goal,v.ticks.at(-2));
      assert.equal(last+1,arrival);
    }
  }
  fits[tour]={ordres:count,base,arrivées:times};
}
const edit=t(n,2), evidence=event(n,2,'configured_local_rewrite');
assert.deepEqual(choice(edit),[family,kind,'ACTION6',{x:32,y:26}]);assert.equal(edit.proof,null);
assert.equal(edit.fit.evidence,r(n,1).ref);
assert.deepEqual([evidence.point,evidence.before,evidence.after],[[32,26],edit.ref,r(n,2).ref]);
assert.notDeepEqual(evidence.local.avant,evidence.local.après);assert.equal(r(n,2).pixels,216);

const predictions={};
for(const [tour,count,actors,at] of [[3,24,2,17],[5,12,3,17],[10,6,3,null],[12,3,3,18]]){
  const q=t(n,tour),proof=q.proof;
  assert.equal(q.owner,family);assert.equal(q.kind,kind);
  assert.equal(proof.orders.length,count);assert.equal(proof.domains.length,actors);
  assert.ok(proof.domains.every(status=>status==='COMPLETE'));
  const unique=[...new Set(proof.orders.map(JSON.stringify))].map(JSON.parse);
  assert.ok(q.refs.includes(r(n,tour-1).ref));
  if(at===null){
    assert.equal(proof.question,'route_order_discrimination');assert.ok(unique.length>=2);
    assert.ok(unique.some(order=>new Set(order).size>1));
  }else{
    assert.equal(proof.question,'coincident_first_arrivals');
    assert.deepEqual(unique,[Array(actors).fill(at)]);
    assert.deepEqual(proof.cohorts.map(v=>[v.tick,v.actor_refs.length]),[[at,actors]]);
  }
  predictions[tour]={question:proof.question,total:count,ordresPrédits:unique};
}
for(const [tour,score] of [[3,1],[7,2],[15,3]]){
  assert.deepEqual([r(n,tour).match,r(n,tour).motif,n[tour].score],[null,'official_score_boundary',score]);
  assert.equal(event(n,tour,'configured_arrival_official_boundary').after,r(n,tour).ref);
}
assert.equal(t(n,3).cmd,'ACTION5');

const endpoint=c.finale.rows, fallback=c.sansOrdre.rows;
assert.deepEqual(t(endpoint,1),t(n,1));assert.equal(r(endpoint,1).finale,r(n,1).finale);
assert.equal(r(endpoint,1).ref,r(n,1).ref);assert.equal(r(endpoint,1).frames.length,1);
assert.ok(!event(endpoint,1,packet));
assert.deepEqual(choice(t(endpoint,2)),['observed_frontier','experiment','ACTION6',{x:10,y:32}]);
assert.equal(r(endpoint,2).pixels,0);
const allowedBundle=(receipt,observation)=>observation.events.some(e=>e.kind===receipt.kind&&e.after===receipt.after);
assert.ok(allowedBundle(event(n,1,packet),r(n,1)));
assert.ok(!allowedBundle(event(n,1,packet),r(endpoint,1)));

assert.deepEqual(fallback.slice(0,9),n.slice(0,9));assert.equal(t(fallback,10).ref,t(n,10).ref);
assert.deepEqual(c.sansOrdre.edits,[{tour:10,ancien:6,nouveau:0,offre:null}]);
assert.deepEqual(choice(t(fallback,10)),['observed_frontier','experiment','ACTION6',{x:10,y:18}]);assert.equal(r(fallback,10).pixels,0);
assert.deepEqual(choice(t(fallback,11)),[family,kind,'ACTION6',{x:22,y:21}]);
assert.equal(t(fallback,11).proof.question,'route_order_discrimination');
assert.equal(r(fallback,11).match,true);assert.equal(t(fallback,12).cmd,'ACTION5');
assert.equal(t(fallback,13).proof.question,'coincident_first_arrivals');

const reserve=c.échantillon.rows,given=r(reserve,1),original=r(n,1),{index,eligible}=given.variant;
assert.deepEqual(t(reserve,1),t(n,1));
assert.ok(eligible.includes(index));assert.equal(given.finale,original.finale);
assert.deepEqual(given.actual,original.actual);
assert.deepEqual(given.frames,original.frames.map((f,i)=>i===index?original.frames[i-1]:f));
const measureReserve=event(reserve,1,packet);
const modified=packets[1].packet.frame_packet.map((f,i)=>i===index?packets[1].packet.frame_packet[i-1]:f);
const reserveTimes=Object.fromEntries(Object.entries(measureReserve.measured.paths).map(([k,v])=>{
  const time=v.ticks.at(-1);
  assert.equal(lastVisibleAlongSegment(modified,Number(k),v.path.at(-2),measureReserve.measured.goal,v.ticks.at(-2))+1,time);
  return [k,time];
}));
assert.deepEqual(reserveTimes,{9:53,12:68});
assert.deepEqual(choice(t(reserve,2)),choice(edit));
const stats=shas.map(sha=>{
  const tests=readFileSync(join(dir,sha.slice(0,8)+'.auteur.txt'),'utf8');
  assert.match(tests,/pass 3\b/);assert.match(tests,/fail 0/);
  return {sha,départs:Object.keys(c).length,gestes:Object.values(c).reduce((s,x)=>s+x.rows.length-1,0),testsAuteur:3};
});
console.log(JSON.stringify({stats,moteur:tree(shas[0]),occurrences:nominalTickets.map(x=>x.tour),
  mesures:fits,plans:predictions,finOfficielle:[3,7,15],
  finaleSeule:choice(t(endpoint,2)),retraitPriorité:choice(t(fallback,10)),
  réserve:{index,images:given.frames.length,paquetModifié:original.frames[index]!==given.frames[index],
    arrivé:reserveTimes,
    suite:choice(t(reserve,2))}},null,2));
