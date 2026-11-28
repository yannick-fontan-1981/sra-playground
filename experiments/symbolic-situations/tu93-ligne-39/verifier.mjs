import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const [dir]=process.argv.slice(2);
const sha={gel:'d0e7527ca8033bd805a6d7a8bb021eff62e87021',candidat:'49a971c37982154ea175294afffdf83469c1c302'};
const arms=['nominal','sans-action4','retrait-offre','preuve-etrangere','preuve-concurrente','stationnaire'];
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const tree=x=>execFileSync('git',['rev-parse',x+':src'],{encoding:'utf8'}).trim();
assert.equal(tree(sha.gel),tree(sha.candidat));
function read(engine,arm){
  const r=JSON.parse(readFileSync(join(dir,engine+'.'+arm+'.json'),'utf8'));
  assert.deepEqual([r.sha,r.arm],[sha[engine],arm]);
  const {sha:_sha,arm:_arm,...body}=r;
  for(const cut of [...r.steps.map(x=>x.pre.cut),r.next?.cut,r.lastCut].filter(Boolean))assert.equal(hash(cut.fact),cut.seal);
  return body;
}
const cases=Object.keys(sha).map(engine=>Object.fromEntries(arms.map(arm=>[arm,read(engine,arm)])));
assert.deepEqual(cases[0],cases[1]);
const c=cases[0],nom=c.nominal,root=nom.steps[14],next=nom.steps[15],plan=root.pre.plan;
const physical=r=>r.steps.map(x=>[x.pre.command,x.after.packet]);
assert.deepEqual(nom.steps.slice(0,14).map(x=>x.pre.family),Array(14).fill('observed_frontier'));
for(const run of Object.values(c)){
  assert.deepEqual(run.steps.slice(0,14),nom.steps.slice(0,14));
  assert.ok(run.steps.every(x=>x.after.levels===0));
  for(let i=0;i<run.steps.length-1;i++)assert.equal(run.steps[i].after.ref,run.steps[i+1].pre.ref);
}
assert.deepEqual(plan.actor,{bbox:[15,15,17,17],size:3,histogram:[[4,1],[9,8]]});
const scoped=root.pre.cut.fact.samples.filter(x=>x.signature===plan.signature);
const a4=scoped.find(x=>x.action==='ACTION4');
assert.equal(scoped.length,6);assert.equal(scoped.filter(x=>x.action==='ACTION4').length,1);
assert.deepEqual(a4.delta,[0,6]);assert.deepEqual(a4.evidence,[nom.steps[3].pre.ref,nom.steps[3].after.ref]);
assert.ok(a4.evidence.every(ref=>plan.evidence.includes(ref)));
const m=plan.measurement;
assert.deepEqual([m.alternating_material_graph_node_count,m.alternating_material_graph_edge_count,
  m.alternating_material_first_shortest_edge_count,root.pre.cut.fact.remaining],[31,32,18,2]);
assert.equal(plan.steps.length,2);
for(const [i,step] of [root,next].entries()){
  assert.deepEqual([step.i,step.pre.family,step.pre.entry,step.pre.type,step.pre.index,step.pre.admitted,step.after.matched,step.after.seal],
    [15+i,'public_occurrence_recall','alternating_graph_composition','alternating_graph_access',i,true,true,false]);
  assert.equal(step.pre.plan.trial,plan.trial);
  assert.equal(step.pre.command,plan.steps[i].action_ref);
  assert.equal(plan.steps[i].ordinary_support,true);
  assert.notEqual(step.after.shown,nom.steps[13+i].after.shown);
}
assert.deepEqual(plan.steps.map(x=>[x.action_ref,x.from,x.to]),[['ACTION4',[15,15],[15,21]],['ACTION2',[15,21],[21,21]]]);
assert.deepEqual(next.after.record.detail.observed_translation,[6,0]);
assert.equal(nom.stop,'session_action_budget');

const foreign=c['preuve-etrangere'],added=foreign.steps[14].pre.cut.added;
assert.notEqual(added.signature,plan.signature);assert.deepEqual(added.delta,[0,-6]);
assert.deepEqual(foreign.steps[14].pre.cut.proposed,root.pre.cut.proposed);
assert.deepEqual(physical(foreign),physical(nom));
const competing=c['preuve-concurrente'],conflict=competing.steps[14].pre.cut.added;
assert.deepEqual(conflict,{...added,signature:plan.signature});
const removed=c['sans-action4'],withdrawn=c['retrait-offre'];
assert.deepEqual(removed.steps[14].pre.cut.removed,[a4]);
assert.deepEqual(removed.steps[14].pre.cut.fact.samples,root.pre.cut.fact.samples.filter(x=>hash(x)!==hash(a4)));
assert.equal(withdrawn.steps[14].pre.cut.proposed.status,'proposed');
assert.equal(withdrawn.steps[14].pre.cut.authored.reason,'withdrawn_in_qualification');
for(const r of [removed,competing]){
  assert.deepEqual(r.steps[14].pre.cut.proposed,{status:'abstained',reason:'graph_access_absent_or_ambiguous',blocking:false,plan:null});
}
for(const r of [removed,withdrawn,competing]){
  assert.deepEqual(physical(r),physical(removed));
  assert.equal(r.steps[14].pre.cut.fact.ref,root.pre.ref);
  assert.deepEqual(r.steps.slice(14).map(s=>[s.pre.family,s.pre.command,s.pre.index,s.after.matched]),
    [['observed_frontier','ACTION3',0,null],['public_occurrence_recall','ACTION4',0,true]]);
}
const stationary=c.stationnaire,stop=stationary.steps[14];
assert.deepEqual(stop.pre,root.pre);assert.equal(stop.after.packet,root.after.packet);
assert.equal(stop.after.shown,nom.steps[13].after.shown);
assert.deepEqual([stop.after.matched,stop.after.seal,stop.after.reason],
  [false,true,'graph_displacement_or_extra_effect_diverged']);
assert.deepEqual(stop.after.record.refused,[plan.trial]);
assert.deepEqual([stationary.next.family,stationary.next.command,stationary.next.cut.fact.refused],
  ['observed_frontier','ACTION3',[plan.trial]]);
const stats=Object.entries(sha).map(([engine,s],i)=>({engine,sha:s,départs:arms.length,gestes:Object.values(cases[i]).reduce((sum,r)=>sum+r.steps.length,0)}));
console.log(JSON.stringify({stats,moteur:tree(sha.gel),tail:plan.steps,prévu:m.alternating_material_first_shortest_edge_count,réalisé:plan.steps.length,
  refusT15:[removed.steps[14].pre.cut.proposed.reason,competing.steps[14].pre.cut.proposed.reason],arrêtStationnaire:stop.after.reason,
  progressionOfficielle:next.after.levels},null,2));
