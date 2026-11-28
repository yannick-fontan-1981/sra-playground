import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const [dir]=process.argv.slice(2);
const shas=['d0e7527ca8033bd805a6d7a8bb021eff62e87021','80d14be16d5f3d4fa1f84c0c92498902e96a5e3f'];
const tree=sha=>execFileSync('git',['rev-parse',sha+':src'],{encoding:'utf8'}).trim();
assert.equal(tree(shas[0]),tree(shas[1]));
const cases=shas.map(sha=>Object.assign({},...['nominal','contrôles'].map(group=>{
  const a=JSON.parse(readFileSync(join(dir,sha.slice(0,8)+'.'+group+'.json'),'utf8'));
  assert.equal(a.sha,sha);assert.equal(a.group,group);return a.cases;
})));
assert.deepEqual(cases[0],cases[1]);
const c=cases[0],n=c.prolongé.rows,cat=c.catalogue.rows;
const t=(rows,i)=>rows[i-1].ticket,r=(rows,i)=>rows[i].ret;
const e=(rows,i)=>rows.flatMap(x=>x.ret?.events??[]).find(x=>x.ref===r(rows,i).ref);
const single=values=>values.map(x=>{assert.equal(x.length,1);return x[0];});
assert.deepEqual(Object.values(c).map(x=>x.rows.length-1),[16,17,3,3]);
for(const {rows} of Object.values(c))for(let i=1;i<rows.length;i++){
  const q=t(rows,i),b=r(rows,i);
  assert.deepEqual([q.id,q.owner,q.admitted],[b.ticket,b.owner,true]);
  if(t(rows,i+1))assert.equal(t(rows,i+1).ref,b.ref);
  if(q.sides)assert.deepEqual(q.sides.before,single(q.sides.sampled));
}
assert.deepEqual(cat.slice(0,16),n.slice(0,16));
assert.deepEqual(r(cat,16),r(n,16));
for(let i=1;i<=17;i++){
  const q=t(n,i);
  assert.deepEqual([q.owner,q.kind,q.action,q.reason],['orbit_constraints','measured_slot_permutation','ACTION6','compare_frozen_positions_contents_and_control']);
}
const s=t(n,1).sides,t3=t(n,3),d=t3.sides;
assert.deepEqual([s.positions.length,s.size,s.controls,s.targets,s.operators,s.prediction],[20,4,2,[[0,11]],0,null]);
for(const i of [1,2]){
  assert.deepEqual([e(n,i).status,e(n,i).matches,t(n,i).sides.prediction],['locally_fitted',1,null]);
}
assert.deepEqual([d.before,d.operators,d.len],[s.before,2,5]);
assert.ok(t3.refs.includes(r(n,1).ref));
const measured=single(r(n,3).vrai);
assert.deepEqual(measured,[2,1,10,15,2,10,1,9,1,15,9,11,9,2,10,15,9,10,2,15]);
assert.deepEqual([d.prediction,r(n,3).matched],[measured,true]);
const [g]=c.prolongé.guards;
assert.deepEqual([g.ref,g.index,g.real.admitted,g.rejected.admitted,g.rejected.reason],
  [t(n,4).ref,1,true,false,'compare_frozen_positions_contents_and_control']);

const lost=c.sansPreuve,own=t(lost.rows,3),missing=lost.interventions[0];
assert.deepEqual(lost.rows.slice(0,2),n.slice(0,2));
assert.deepEqual([missing.ref,missing.lost,missing.opérateurs],[t3.ref,{key:[5,32],ref:r(n,1).ref},1]);
assert.deepEqual([own.ref,own.data,own.sides.before,own.sides.len,own.sides.prediction,own.sides.operators],
  [t3.ref,t3.data,d.before,1,null,1]);
assert.ok(!own.refs.includes(r(n,1).ref));
assert.deepEqual([r(lost.rows,3).packet,r(lost.rows,3).vrai,r(lost.rows,3).matched,e(lost.rows,3).matches],
  [r(n,3).packet,r(n,3).vrai,null,1]);
assert.equal(t(lost.rows,4).sides.operators,2);
assert.ok(t(lost.rows,4).refs.includes(r(lost.rows,3).ref));

const still=c.stationnaire.rows;
assert.deepEqual(still.slice(0,3),n.slice(0,3));
assert.deepEqual([r(still,3).packet,still[3].présenté,r(still,3).matched,e(still,3).status,e(still,3).matches],
  [r(n,3).packet,n[2].présenté,false,'no_supported_permutation',0]);
assert.deepEqual(single(r(still,3).vu),d.before);
assert.deepEqual([t(still,4).data,t(still,4).sides.operators],[{x:58,y:32},1]);

const q8=t(n,8).sides;
assert.deepEqual([e(n,7).status,r(n,7).reason,n[7].score,n[7].niveau,q8.positions.length,q8.size,q8.controls,q8.targets,q8.operators],
  ['official_boundary','official_boundary',1,2,42,2,6,[[29,11],[32,11]],0]);
const t15=t(n,15),t16=t(n,16);
assert.deepEqual([t15.data,t16.data,t16.sides.prediction,e(n,15).matches,e(n,16).matches,t(n,17).sides.operators],
  [{x:14,y:26},{x:14,y:26},null,2,1,3]);
assert.notDeepEqual(t15.sides.before,t16.sides.before);
assert.match(t16.sides.why,/different content arrangement/);
assert.equal(n[17].score,1);
const stats=shas.map(sha=>{
  const report=readFileSync(join(dir,sha.slice(0,8)+'.auteur.txt'),'utf8');
  assert.match(report,/pass 2\b/);assert.match(report,/fail 0/);
  return {sha,départs:Object.keys(c).length,gestes:Object.values(c).reduce((n,x)=>n+x.rows.length-1,0),testsAuteur:2};
});
console.log(JSON.stringify({stats,moteur:tree(shas[0]),catalogue:16,premierPlan:{cases:measured.length,nominal:d.len,sansPreuve:own.sides.len},
  contrôleStationnaire:r(still,3).matched,N2:{candidats:[e(n,15).matches,e(n,16).matches],opérateursAuT17:t(n,17).sides.operators},score:n[17].score},null,2));
