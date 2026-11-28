import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const [dir,catrFile]=process.argv.slice(2);
const shas={gel:'d0e7527ca8033bd805a6d7a8bb021eff62e87021',candidat:'71e15295d2fd38996147a524e4b0cd63e2991cc5'};
const arms=['nominal','priorite','stationnaire','sans-effet','référence','référence-point','station-route'];
const tree=sha=>execFileSync('git',['rev-parse',sha+':src'],{encoding:'utf8'}).trim();
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
assert.equal(tree(shas.gel),tree(shas.candidat));
const cases=Object.keys(shas).map(engine=>Object.fromEntries(arms.map(arm=>{
  const {sha,arm:name,...r}=JSON.parse(readFileSync(join(dir,engine+'.'+arm+'.json'),'utf8'));
  assert.deepEqual([sha,name],[shas[engine],arm]);
  for(const cut of [...r.steps.map(x=>x.pre.cut),r.next?.cut,r.lastCut].filter(Boolean))assert.equal(hash(cut.before),cut.seal);
  return [arm,r];
})));
assert.deepEqual(cases[0],cases[1]);
const c=cases[0],nom=c.nominal.steps,one=nom[0],two=nom[1];
const physical=r=>r.steps.map(x=>[x.pre.command,x.pre.data,x.after.packet]);
for(const run of Object.values(c))for(let i=0;i<run.steps.length-1;i++)assert.equal(run.steps[i].after.ref,run.steps[i+1].pre.ref);
const before=one.pre.cut.before,route=one.pre.cut.search;
assert.deepEqual([one.pre.family,one.pre.entry,one.pre.type,one.pre.command,one.pre.plan.kind,one.pre.plan.expected],
  ['public_occurrence_recall','observed_composition_services','exposed_reception','ACTION4','control_question',null]);
assert.deepEqual([before.scene.actor,before.scene.slots,before.controls,route.pathLength,route.first[0].delta],
  [[1,2],[{pos:[4,2],color:9},{pos:[6,4],color:9}],{},6,[1,0]]);
const cl=one.after.record,acquired=cl.controls.ACTION4;
assert.deepEqual([cl.detail.actor_delta,cl.detail.body_changes.map(x=>x.delta),acquired.evidence],
  [[1,0],[[1,0],[1,0]],[one.pre.ref,one.after.ref]]);
assert.deepEqual(two.pre.cut.before.controls.ACTION4,acquired);
assert.deepEqual([two.pre.command,two.pre.plan.kind,two.after.matched,two.after.seal],['ACTION4','access',false,true]);
assert.ok(two.pre.plan.expected);

const priority=c.priorite.steps,other=priority[0],pa=other.pre.cut.before.priority;
assert.deepEqual({...other.pre.cut.before,priority:before.priority},before);
assert.deepEqual(pa,[before.priority[1],before.priority[0],...before.priority.slice(2)]);
assert.deepEqual(other.pre.cut.search,route);
assert.deepEqual(priority.map(x=>x.pre.command),['ACTION1','ACTION4']);
assert.deepEqual([other.after.record.detail.actor_delta,other.after.record.detail.body_changes],[[0,-1],[]]);
const still=c.stationnaire,stop=still.steps[0];
assert.deepEqual(stop.pre,one.pre);assert.equal(stop.after.packet,one.after.packet);
assert.notEqual(stop.after.physical,stop.after.presented);
assert.deepEqual([stop.after.record.controls,stop.after.record.detail.actor_delta,still.next.command,still.next.plan.kind],
  [{},[0,0],'ACTION1','control_question']);

const less=c['sans-effet'],same=less.steps[1];
assert.deepEqual(physical(less),physical(c.nominal).slice(0,4));
assert.deepEqual(less.steps[0],one);
assert.deepEqual(same.pre.cut.search,two.pre.cut.search);
assert.deepEqual({...same.pre.cut.before,controls:two.pre.cut.before.controls},two.pre.cut.before);
assert.deepEqual(same.pre.cut.removed,{action:'ACTION4',...acquired});
assert.deepEqual([same.pre.plan.kind,same.pre.plan.expected,same.after.matched,less.steps[2].pre.plan.kind,less.steps[3].after.levels],
  ['control_question',null,null,'exposure_question',1]);

const catr=JSON.parse(readFileSync(catrFile,'utf8'));
assert.equal(catr.sha,shas.gel);assert.equal(catr.arm,'nominal');
const chamber=catr.steps[0].issued;
const envelopeKeys=['frame_hash','level_epoch','levels_completed','state'];
const common=(p,reason)=>{
  assert.equal(p.entry,'observed_composition_services');
  const binding=p.envelope;
  assert.deepEqual(Object.keys(binding.expected).sort(),envelopeKeys);
  assert.deepEqual([binding.expected.level_epoch,binding.expected.levels_completed,binding.expected.state],
    [1,0,'NOT_FINISHED']);
  assert.ok(p.ref.endsWith(binding.expected.frame_hash));
  assert.equal(binding.real.admitted,true);
  assert.deepEqual(binding.foreign,{admitted:false,reason});
};
common(one.pre,'reception_binding_changed');common(chamber,'relation_binding_changed');
assert.equal(one.pre.envelope.point,null);assert.deepEqual(chamber.envelope.point,[[31,47],12]);
const point=nom[2].pre;
assert.deepEqual([point.command,point.envelope.point.point,point.envelope.point.palette_value],['ACTION6',[49,55],5]);
assert.equal(point.envelope.point.observation_ref,point.ref);
for(const [arm,expected] of [['référence',one.pre],['référence-point',point]]){
  const tested=c[arm], bound=tested.evaluations.at(-1);
  assert.deepEqual([tested.next,tested.stop,bound],[null,'no_admissible_prefix',[expected.ref,expected.envelope]]);
  assert.deepEqual(tested.steps,nom.slice(0,arm==='référence'?0:2));
}

const later=nom.slice(12),found=later[0].pre.cut.search;
assert.deepEqual([found.nodes,found.bounded,found.pathLength,found.reason],[8000,true,8,'reception_search_node_bound']);
assert.equal(later[0].pre.cut.before.remaining,4);
assert.deepEqual(later.map(x=>[x.pre.level,x.pre.command,x.after.matched,x.after.levels]),
  [[3,'ACTION2',true,2],[3,'ACTION1',true,2],[3,'ACTION4',true,2],[3,'ACTION1',true,2]]);
assert.equal(c.nominal.stop,'session_action_budget');
const late=c['station-route'],failed=late.steps[12];
assert.deepEqual(late.steps.slice(0,12),nom.slice(0,12));
assert.deepEqual(failed.pre,later[0].pre);
assert.deepEqual([failed.after.packet,failed.after.presented,failed.after.matched,failed.after.seal,late.next.command,late.next.index],
  [later[0].after.packet,nom[11].after.presented,false,true,'ACTION2',0]);
const stats=Object.entries(shas).map(([engine,sha],i)=>({engine,sha,départs:arms.length,gestes:Object.values(cases[i]).reduce((n,r)=>n+r.steps.length,0)}));
console.log(JSON.stringify({stats,moteur:tree(shas.gel),trajetInitial:route.pathLength,mêmeACTION4:{accès:two.after.matched,sonde:same.after.matched},
  référenceCommune:envelopeKeys,gardes:[one.pre.envelope.foreign.reason,chamber.envelope.foreign.reason],
  N3:{pasPrévus:found.pathLength,pasConfirmés:later.length,niveauxFinis:later.at(-1).after.levels,stationnaireScellé:failed.after.seal}},null,2));
