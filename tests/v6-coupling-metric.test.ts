import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { OrientedCoupling,orientedCouplingInitial,orientedCouplingScene,orientedCouplingTile } from '../src/logos-engine/v6-oriented-coupling.ts';
import { handoffMove,handoffInteraction } from '../src/logos-engine/v6-oriented-handoff-mechanics.ts';
import { MetricComposition,measuredMetricScene,measuredMetricState,metricTargetCandidates } from '../src/logos-engine/v6-metric-composition.ts';
import { enumerateMetricTargetDomain,assignMetricOccurrences,deriveMetricExposureDependencies,fitMetricStackControl,metricStackTransition } from '../src/logos-engine/v6-metric-stack-mechanics.ts';
const oracle=JSON.parse(await readFile(new URL('./fixtures/v6-coupling-metric-reference.json',import.meta.url),'utf8')),scenes=oracle.scenes;
const clean=(v:any):any=>Array.isArray(v)?v.map(clean):v!==null&&typeof v==='object'?Object.fromEntries(Object.entries(v).filter(([k])=>k!=='elapsed_ns').map(([k,x])=>[k,clean(x)])):v;
test('coupling and metric fixtures bind unchanged Python source, without claims of solved games',async()=>{
  assert.match(oracle.qualification,/zero claimed solved game levels/);
  for(const[path,hash]of Object.entries(oracle.sourceHashes))assert.equal(createHash('sha256').update(await readFile(new URL('../reference/v6/'+oracle.commit+'/source/'+path,import.meta.url))).digest('hex'),hash,path);
});
for(const c of oracle.cases)test(c.operation+': '+c.id,()=>{
  const a=c.args;const call=()=>{
    switch(c.operation){
      case'coupling_initial':return orientedCouplingInitial(scenes[a.scene].rows);
      case'coupling_scene':return orientedCouplingScene(scenes[a.scene].rows,a.geometry,a.actor_color);
      case'coupling_tile':return orientedCouplingTile(scenes[a.scene].rows,a.geometry,a.point);
      case'handoff_move':return handoffMove(a.state,a.model,a.actor_ref,a.dx,a.dy,a.maximum,a.allow_hypothetical);
      case'handoff_interaction':return handoffInteraction(a.state,a.model,a.actor_ref,a.target_ref,a.kind,a.maximum,a.allow_hypothetical);
      case'metric_scene':return measuredMetricScene(scenes[a.scene].rows);
      case'metric_state':return measuredMetricState(a.scene,a.observation);
      case'metric_targets':return metricTargetCandidates(a.scene,a.observation,a.state);
      case'metric_target_domain':return enumerateMetricTargetDomain(a.request);
      case'metric_assignment':return assignMetricOccurrences(a.request);
      case'metric_exposure':return deriveMetricExposureDependencies(a.request);
      case'metric_control_fit':return fitMetricStackControl(a.request);
      case'metric_transition':return metricStackTransition(a.state,a.law,a.primitive);
      default:throw new Error(c.operation);
    }
  };
  if(c.error)assert.throws(call,e=>e instanceof Error&&e.message===c.error);else{
    const result:any=call();if(result?.retained_frontier?.work)assert.ok(Number.isInteger(result.retained_frontier.work.elapsed_ns)&&result.retained_frontier.work.elapsed_ns>=0,'wall time remains a real measured nonnegative number');
    assert.deepEqual(clean(result),c.expected);
  }
});
for(const scenario of oracle.scenarios)test(scenario.family+' retained source sequence: '+scenario.id,async context=>{
  const create=()=>scenario.family==='coupling'?new OrientedCoupling():new MetricComposition();let family:any=create(),proposal:any=null;
  for(const[i,row]of scenario.steps.entries())await context.test(i+' '+row.operation.kind,async()=>{
    const op=row.operation;let result:any;
    switch(op.kind){
      case'record':{const b=scenes[op.before],a=scenes[op.after];result=family.record(b.observation,a.observation,op.command,b.rows,a.rows,op.selected?proposal:undefined,op.index);break;}
      case'propose':{const s=scenes[op.scene];proposal=await family.propose(s.observation,s.rows,s.inputs,op.remaining??30);result=proposal;break;}
      case'before':{const s=scenes[op.scene];result=family.before(proposal,op.index??0,s.public,s.observation);break;}
      case'after':{const b=scenes[op.before],a=scenes[op.after];result=family.after(proposal,op.index??0,b.observation,a.observation,b.rows,a.rows);break;}
      case'bind':family.bind(proposal);result=proposal;break;
      case'models':{const s=scenes[op.scene];result=family.models(s.observation,s.rows,orientedCouplingScene(s.rows,family.h,family.actor_color));break;}
      case'reconcile':{const s=scenes[op.scene];result=family.reconcile(s.observation,s.rows);break;}
      default:throw new Error(op.kind);
    }
    assert.deepEqual(clean(result),row.expected.result,'full returned proposal/calculation/event/guard');assert.deepEqual(clean(family.state()),row.expected.state,'entire retained state');
    const saved=family.state(),restored=create();restored.restore(saved);assert.deepEqual(restored.state(),saved,'all retained fields survive restore after each operation');
    if(saved.refs)saved.refs.push('external mutation');if(saved.evidence)saved.evidence.push('external mutation');assert.deepEqual(clean(restored.state()),row.expected.state,'restored state owns its public snapshot');family=restored;
  });
});
test('both families reject incomplete checkpoints before mutation',()=>{
  for(const family of[new OrientedCoupling(),new MetricComposition()]){const before=family.state(),broken={...before};delete broken.epoch;assert.throws(()=>family.restore(broken),/Incomplete/);assert.deepEqual(family.state(),before);}
});
