import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import test from 'node:test';
import { createNativeV6Runtime, NativeV6Runtime } from '../src/logos-engine/v6-native-runtime.ts';
import type { NativeV6Declarations } from '../src/logos-engine/v6-native-runtime.ts';
import type { NativeExecution, NativeFamily, NativePublicObservation } from '../src/logos-engine/v6-native-types.ts';
import { V6AgentService } from '../src/runtime/v6-agent-service.ts';
import { hydrateNativeState, isNativeStateGraph } from '../src/logos-engine/v6-native-state-graph.ts';
import { ObservedInventory } from '../src/logos-engine/v6-observed-inventory.ts';
type R=Record<string,any>;
const copy=<T>(v:T):T=>structuredClone(v);
const reference=new URL('../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/',import.meta.url);
const declarations={common:JSON.parse(await readFile(new URL('laya_proto/common_frontier_policy.drm.json',reference),'utf8')),
  strategy:JSON.parse(await readFile(new URL('morphology_policy/strategy.drm',reference),'utf8'))} as NativeV6Declarations;
const fixture=JSON.parse(gunzipSync(await readFile(new URL('./fixtures/v6-inventory-family-reference.json.gz',import.meta.url))).toString()) as R;
const hano=JSON.parse(await readFile(new URL('./fixtures/v6-native-caller/hano-first-prefix.json',import.meta.url),'utf8')) as R;
const ID='public_observed_inventory',OWNER=`family_state:${ID}`;
const execution:NativeExecution={yieldControl:async()=>{},now:()=>0,deadlineMs:360_000};
function owners(runtime:NativeV6Runtime){const r=runtime as unknown as R;return {registered:r.families as NativeFamily[],acquisition:r.acquisitionFamilies,inventory:r.acquisitionFamilies.inventory as ObservedInventory};}
function value(runtime:NativeV6Runtime,id:string):R{const g=runtime.inspectKnowledge();assert.ok(g.nodes[id],id);const raw=g.nodes[id]!.value;return(isNativeStateGraph(raw)?hydrateNativeState(raw,key=>g.nodes[key]!.value):raw) as R;}
function packet(step=0):NativePublicObservation{const f=fixture.kernelControlled,obs=step?f.afterObservation:f.observation,rows=step?f.afterRows:f.rows;return{frame_rows:copy(rows),frame_packet:[copy(rows)],frame_hash:obs.frame_hash,available_action_refs:copy(obs.available_action_refs),level:1,levels_completed:0,state:'NOT_FINISHED',step_index:step};}

test('inventory has one cold source owner at its original entry and reuses the original compiled SRC',async()=>{
  const runtime=await createNativeV6Runtime(declarations,{now:()=>0});
  try{
    const o=owners(runtime),cold=await ObservedInventory.create();assert.equal(o.registered.filter(f=>f.id===ID).length,1);assert.deepEqual(o.inventory.state(),cold.state());
    const service=new V6AgentService(()=>runtime),result=await service.handle({type:'init',sequence:0,sessionId:'inventory-registration',observation:copy(hano.publicProtocol.events[0].observation),budgets:copy(hano.budgets)});
    const material=(result.snapshot.coverage as R).sourceGroups.find((g:R)=>g.id==='factored_material_return'),index=material.entryPoints.indexOf('observed_inventory_composition');
    assert.ok(index>=0);assert.equal(material.families[index],ID);assert.equal(material.families.filter((id:string)=>id===ID).length,1);
    const declared=declarations.strategy.declarations[0]!.configuration.factored_material_return.ordered_subquestions;
    const connected=material.entryPoints.filter((entry:string|null)=>entry!==null);
    assert.deepEqual(connected,declared.filter((entry:string)=>connected.includes(entry)));
    assert.ok(material.entryPoints.indexOf('reactive_contact_continuation')<index);
    const graph=runtime.inspectKnowledge();assert.deepEqual(Object.values(graph.nodes).filter(n=>n.kind==='family_state'&&n.family===ID).map(n=>n.id),[OWNER]);
    assert.ok(graph.nodes['program:v6.observed_inventory.choose']);assert.equal(Object.keys(value(runtime,OWNER).source_state).length,8);
    assert.ok(value(runtime,OWNER).caller_context);assert.ok(value(runtime,OWNER).caller_context.meter);
  }finally{runtime.close('inventory-registration-complete');}
});

test('passive inventory acquisition follows Outline and precedes OrderedReaction once per sealed public return',async()=>{
  const runtime=await createNativeV6Runtime(declarations,{now:()=>0}),o=owners(runtime),calls:R[]=[],order:string[]=[];
  const record=o.inventory.recordSource.bind(o.inventory),outline=o.acquisition.outline.recordPublicTransition.bind(o.acquisition.outline),reaction=o.acquisition.reaction.recordSource.bind(o.acquisition.reaction);
  (o.inventory as unknown as R).recordSource=(...args:any[])=>{order.push('inventory');calls.push({before:args[0],after:args[1],first:args[3],second:args[4],proposal:args[5]});return(record as(...a:any[])=>R|null)(...args);};
  o.acquisition.outline.recordPublicTransition=async(...args:any[])=>{order.push('outline');return outline(...args);};
  o.acquisition.reaction.recordSource=(...args:any[])=>{order.push('reaction');return reaction(...args);};
  try{
    const service=new V6AgentService(()=>runtime),captured=(r:R):R=>hano.objects[r.$object],sessionId=captured(hano.snapshots[0].observation).observation_ref.split(':epoch:')[0];
    let result=await service.handle({type:'init',sequence:0,sessionId,observation:copy(hano.publicProtocol.events[0].observation),budgets:copy(hano.budgets)});
    for(const [i,returned] of hano.publicProtocol.events.slice(1).entries()){
      assert.equal(result.kind,'action');assert.deepEqual(result.command,returned.command);
      result=await service.handle({type:'advance',sequence:i+1,sessionId,ticketId:result.ticket!.id,observation:copy(returned.observation),executionMs:0});
      if(i===0)assert.equal(calls.length,0,'real prefix first seals before any passive owner acquires');
    }
    assert.equal(result.kind,'boundary');assert.equal(calls.length,2);assert.deepEqual(order,['outline','inventory','reaction','outline','inventory','reaction']);
    for(const [i,call] of calls.entries()){assert.equal(call.proposal,null);assert.deepEqual(call.first,hano.publicProtocol.events[i].observation.frame);assert.deepEqual(call.second,hano.publicProtocol.events[i+1].observation.frame);}
    assert.deepEqual(value(runtime,OWNER).source_state,o.inventory.state());assert.deepEqual(value(runtime,OWNER).caller_context,o.inventory.callerContextState());
    await runtime.resume(execution);assert.equal(calls.length,2,'resume restores acquired state instead of recording twice');
  }finally{runtime.close('inventory-passive-complete');}
});

test('selected inventory transfer uses WHY/ACT, retains one source event and restores both source state and caller context',async()=>{
  const f=fixture.kernelControlled;assert.match(f.qualification,/Synthetic/);
  const production=await createNativeV6Runtime(declarations,{now:()=>0}),o=owners(production);o.inventory.restore(copy(f.seedState));
  const runtime=new NativeV6Runtime({sourceDigest:'inventory-synthetic-kernel-contract',now:()=>0,families:o.registered,
    groups:[{id:'factored_material_return',families:[ID],entryPoints:['observed_inventory_composition']}],maxPointOccurrences:declarations.common.input_domain.max_point_occurrences,
    authorityPolicy:declarations.common,callerStrategy:declarations.strategy.declarations[0]!.configuration,acquisitionFamilies:o.acquisition});
  try{
    let count=0;const record=o.inventory.recordSource.bind(o.inventory);(o.inventory as unknown as R).recordSource=(...args:any[])=>{count++;return(record as(...a:any[])=>R|null)(...args);};
    const released=await runtime.initialize({sessionId:'inventory:synthetic',observation:packet(),budgets:{targetLevels:3,levelActionCaps:[16,16,16],maxActions:48}},execution);
    assert.equal(released.kind,'action',released.reason);assert.equal(released.snapshot.lastDecision,ID);assert.deepEqual(released.command,f.proposal.actions[0]);assert.ok(released.authorization);assert.equal(count,0);
    const proposal=released.snapshot.proposal as R,revision=(released.snapshot.prefix as R).revision;
    assert.equal(proposal.material_access_subquestion,'observed_inventory_composition');assert.equal(proposal.inventory_plan.offer.kind,'acquisition_probe_candidate');
    assert.deepEqual(proposal.inventory_plan.workflow,f.proposal.inventory_plan.workflow);assert.equal(proposal.compositions[0].observed,false);
    const returned=await runtime.advance({command:released.command!,observation:packet(1),executionMs:0},execution);
    assert.equal(returned.kind,'boundary');assert.equal(count,1);assert.equal(returned.snapshot.actions,1);
    assert.deepEqual((returned.snapshot.whyAct as R).analysis.map((r:R)=>r.operation),['OP29','OP30','OP31']);
    assert.deepEqual(o.inventory.state(),f.afterState);assert.deepEqual(value(runtime,OWNER).source_state,f.afterState);
    const facts=(value(runtime,'reasoning:memory').facts as string[]).map(id=>value(runtime,id)),events=facts.filter(fact=>fact.key===`observed_inventory_event:${revision}`);
    assert.equal(events.length,1);assert.deepEqual(events[0]!.value,f.record);assert.deepEqual(facts.find(fact=>fact.key==='observed_inventory_state')!.value,f.afterState);
    assert.deepEqual(value(runtime,`reasoning:transition:${revision}`).caller_acquisition.selected_result.events,[f.record]);
    const context=copy(o.inventory.callerContextState());assert.equal(context!.meter.last_ref,f.afterObservation.observation_ref);
    o.inventory.restore(copy(f.seedState));o.inventory.observeCallerContext({...f.afterObservation,level_epoch:2,observation_ref:'synthetic:foreign'},f.afterRows);
    const plan=o.inventory.proposeSource.bind(o.inventory);let restoredAtPlan:R|null=null;
    (o.inventory as unknown as R).proposeSource=(...args:any[])=>{restoredAtPlan=copy(o.inventory.state());return(plan as(...a:any[])=>Promise<R|null>)(...args);};
    await runtime.resume(execution);assert.equal(count,1);assert.deepEqual(restoredAtPlan,f.afterState);assert.deepEqual(o.inventory.state(),f.resumeState);assert.deepEqual(o.inventory.callerContextState(),context);
  }finally{runtime.close('inventory-selected-complete');production.close('inventory-owner-contract-complete');}
});
