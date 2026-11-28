import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const [dir]=process.argv.slice(2);
const shas=['d0e7527ca8033bd805a6d7a8bb021eff62e87021','421dc6a58d051e8e418db80a98cf1e01755dab40'];
const tree=sha=>execFileSync('git',['rev-parse',sha+':src'],{encoding:'utf8'}).trim();
assert.equal(tree(shas[0]),tree(shas[1]));
const cases=shas.map(sha=>Object.assign({},...['nominal','contours'].map(group=>{
  const a=JSON.parse(readFileSync(join(dir,sha.slice(0,8)+'.'+group+'.json'),'utf8'));
  assert.equal(a.sha,sha);assert.equal(a.group,group);return a.cases;
})));
assert.deepEqual(cases[0],cases[1]);
const c=cases[0],n=c.nominal.rows,still=c.stationnaire.rows;
const t=(x,i)=>x[i-1].ticket,r=(x,i)=>x[i].ret;
const event=(rows,i)=>rows.flatMap(x=>x.ret?.events??[]).find(x=>x.after_ref===r(rows,i).ref);
assert.deepEqual(Object.values(c).map(x=>x.rows.length-1),[16,2,4,4,14,13]);
for(const {rows} of Object.values(c))for(let i=1;i<rows.length;i++){
  const q=t(rows,i),b=r(rows,i);
  assert.deepEqual([q.id,q.owner,q.admitted],[b.ticket,b.owner,true]);
  if(t(rows,i+1))assert.equal(t(rows,i+1).ref,b.ref);
}
const start=t(n,1),next=t(n,2),route=t(n,3);
assert.deepEqual([start.trace.area.shape,start.trace.area.bbox,start.trace.area.pitch,start.trace.paint],
  [[3,3],[8,4,56,52],16,null]);
for(const [i,data] of [[1,{x:32,y:12}],[2,{x:48,y:12}],[3,{x:48,y:28}]]){
  const q=t(n,i);
  assert.deepEqual([q.owner,q.entry,q.kind,q.action,q.data,q.reason],
    ['public_occurrence_recall','trace_field_composition','trace_field_experiment','ACTION6',data,'trace_current_head_and_point_bound']);
}
assert.deepEqual([start.trace.n,next.trace.n,route.trace.n,route.trace.paint,route.trace.measured,route.trace.r],
  [1,1,6,12,true,[r(n,1).ref,r(n,2).ref]]);
assert.deepEqual(route.trace.shape,[[0,0],[1,0],[2,0]]);
for(let i=1;i<=8;i++){
  const q=t(n,i),b=r(n,i),e=event(n,i);
  assert.equal(q.kind,'trace_field_experiment');
  assert.deepEqual([e.before_ref,e.source,e.target,e.outcome,e.outside_support_effect_role],
    [q.ref,q.trace.source,q.trace.target,i===8?'official_boundary':'local_extension_observed','unknown']);
  assert.deepEqual([b.matched,n[i].score],[i!==8?true:null,i===8?1:0]);
}
assert.deepEqual([n[8].niveau,t(n,9).owner,t(n,9).action],[2,'containment','ACTION1']);

for(const [key,removed] of [['sansPremier',1],['sansSecond',2]]){
  const {rows,interventions}=c[key];
  assert.ok(interventions.length>0&&interventions.every(x=>x.ref===r(n,removed).ref&&x.countBefore===x.countAfter+1));
  assert.deepEqual(rows.slice(0,5).map(x=>x.shown),n.slice(0,5).map(x=>x.shown));
  assert.deepEqual([t(rows,3).ref,t(rows,3).data,t(rows,3).trace.shape,t(rows,3).trace.n,t(rows,3).trace.measured],
    [route.ref,route.data,route.trace.shape,1,false]);
  assert.deepEqual(t(rows,3).trace.r,[r(n,removed===1?2:1).ref]);
  assert.deepEqual([r(rows,3).matched,event(rows,3).outcome,t(rows,4).trace.n,t(rows,4).trace.measured],
    [true,'local_extension_observed',5,true]);
}
assert.deepEqual(still.slice(0,2),n.slice(0,2));
assert.equal(r(still,2).physical,r(n,2).physical);assert.equal(still[2].shown,n[1].shown);
assert.deepEqual([r(still,2).matched,event(still,2).outcome,t(still,3).owner],
  [false,'projection_refuted','acquire_control_for_target']);

const o=t(n,14),proof=r(n,14);
assert.deepEqual([o.owner,o.entry,o.action,o.reason,o.outline.meaning,o.outline.current.bbox,o.outline.facts.exact_locus,o.outline.facts.local_operator_observed,o.anticipated],
  ['public_outline_service','observed_outline_service','ACTION5','current_outline_and_sealed_action','local_operator_hypothesis',[11,43,17,49],true,false,null]);
assert.deepEqual([o.outline.epoch,o.outline.history],[2,[9,10,11,12,13].map(i=>t(n,i).ref)]);
assert.deepEqual(o.outline.withoutFit,{status:'abstain',conclusions:[],authority:false});
assert.equal(t(n,13).action,o.action);assert.ok(r(n,13).diff>0);
assert.deepEqual([proof.diff,proof.matched,proof.reason,n[14].score],[0,null,'unknown_local_operator_effect_compare_public_return',1]);
const local=proof.outline.find(x=>x.evidence.at(-1)===proof.ref);
assert.deepEqual([local.status,local.local,local.scope],['no_visible_local_change',0,2]);
assert.deepEqual([t(n,15).owner,t(n,15).action],['acquire_control_for_target','ACTION2']);
assert.notEqual(t(n,15).owner,o.owner);
for(const guard of c.nominal.guards){
  assert.deepEqual([guard.ref,guard.command,guard.real.admitted,guard.pixels,guard.corner],[o.ref,'ACTION5',true,24,1]);
  assert.deepEqual(guard.other,{admitted:false,reason:'outline_or_command_changed'});
  assert.deepEqual(guard.local,guard.other);
}
assert.ok(c.nominal.guards.length>0);
const changed=c.contourModifié;
assert.deepEqual(changed.rows.slice(0,13),n.slice(0,13));
assert.ok(changed.guards.length>0&&changed.guards.every(x=>x.other.admitted===false&&x.ref===o.ref));
assert.notEqual(t(changed.rows,14)?.owner,'public_outline_service');
const independent=c.sansFrontière;
assert.deepEqual(independent.interventions,[{type:'trace-boundary',ref:r(n,8).ref}]);
assert.equal(event(independent.rows,8),undefined);
assert.deepEqual([t(independent.rows,14),r(independent.rows,14),t(independent.rows,15)],[o,proof,t(n,15)]);

const stats=shas.map(sha=>{
  const report=readFileSync(join(dir,sha.slice(0,8)+'.auteur.txt'),'utf8');
  assert.match(report,/pass 4\b/);assert.match(report,/fail 0/);
  return {sha,départs:Object.keys(c).length,gestes:Object.values(c).reduce((n,r)=>n+r.rows.length-1,0),testsAuteur:4};
});
console.log(JSON.stringify({stats,moteur:tree(shas[0]),ligne67:{occurrencesZIPP:8,préfixe:[1,1,6],aprèsRetrait:[1,5],
  scoreT8:n[8].score},ligne71:{occurrencesZIPP:1,pixelsT14:proof.diff,projection:proof.matched,
  contourAltéré:changed.rows[13].stop??t(changed.rows,14)?.owner,décisionT15:t(n,15).owner}},null,2));
