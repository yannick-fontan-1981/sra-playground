import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import rules from '../src/logos-engine/v6/animated-contact-rules.json' with {type:'json'};
import { AnimatedContact,animatedCrossInvitation } from '../src/logos-engine/v6-animated-contact.ts';
import { acquireTransientCurve,projectTransientCurve,transientCalibration,transientSourceRoleProbe } from '../src/logos-engine/v6-transient-contact-memory.ts';
import { orderedTransientComponentPathFacts,measureScalarFillDisplay,maximalTransientBars,consistentTransientTurn,transientLinearSlope,transientQuadratic,transientRound,ballisticContactClick } from '../src/logos-engine/v6-transient-measurements.ts';
import { learnCurveWitness, retainRegulatedReturn, type RegulatedChoice } from '../src/sic/regulated-transient-contact.ts';
import { currentRegulatedTrial } from '../src/sic/animation-contact.ts';
import type { NativeObservation, NativeRows } from '../src/logos-engine/v6-native-types.ts';
const oracle=JSON.parse(await readFile(new URL('./fixtures/v6-animated-contact-reference.json',import.meta.url),'utf8')),scenes=oracle.scenes,packets=oracle.packets;
const component=(c:any):any=>({...c,bbox:{...c.bbox,height:c.bbox.bottom-c.bbox.top+1,width:c.bbox.right-c.bbox.left+1}});
test('a regulated curve requires a visible parameter before reading the animation', () => {
  const board = Array.from({ length: 12 }, () => Array(12).fill(0));
  const unneeded = new Proxy([] as NativeRows, {
    get() { throw new Error('The trajectory frames should not be inspected.'); },
  });
  const observation = {} as NativeObservation;
  assert.equal(learnCurveWitness(observation, observation, { action_ref: 'ACTION6', data: { x: 5, y: 7 } },
    board, board, Array(6).fill(unneeded)), null);
});
for (const id of ['contact', 'disclosure']) test('a regulated trial certifies the current animated return: ' + id, () => {
  const packet = packets[id];
  const before = { level_epoch: 3, levels_completed: 2, observation_ref: 'before' } as NativeObservation;
  const after = { ...before, observation_ref: 'returned' };
  const action = { action_ref: packet.action_ref, data: packet.action_data };
  const witness = learnCurveWitness(before, after, action, packet.before, packet.after, packet.intermediate);
  assert.ok(witness);
  const choice: RegulatedChoice = {
    strategy: 'test_regulated_contact', action, count: witness.model.fill.scalar_fill_count, evidence: ['before'],
    source: [0, 0, 2, 2], peer: [5, 5, 7, 7], meter: [0, 9, 9, 9],
    projected: [packet.action_data.x, packet.action_data.y], expectedSign: null,
    shot: [witness.model.fill.scalar_fill_count, packet.action_data.x, packet.action_data.y].join(','),
  };
  const retained = (frames: NativeRows[], result = after) =>
    retainRegulatedReturn(witness, choice, before, result, packet.before, packet.after, frames);
  assert.equal(currentRegulatedTrial({ curve: retained(packet.intermediate) }, after), 'returned');
  assert.equal(currentRegulatedTrial({ curve: retained(packet.intermediate.slice(0, 2)) }, after), undefined);
  assert.equal(currentRegulatedTrial({ curve: retained(Array(6).fill(packet.after)) }, after), undefined);
  const next = { ...after, level_epoch: 4, levels_completed: 3, observation_ref: 'next' };
  assert.equal(currentRegulatedTrial({ curve: retained(packet.intermediate, next) }, next), undefined);
});
test('an ambiguous moving source cannot establish a regulation model', () => {
  const packet = packets.ambiguous;
  const before = { level_epoch: 3, observation_ref: 'before' } as NativeObservation;
  assert.equal(learnCurveWitness(before, { ...before, observation_ref: 'returned' },
    { action_ref: packet.action_ref, data: packet.action_data }, packet.before, packet.after, packet.intermediate), null);
});
test('animation oracle and DRM predicates bind unchanged source and only public pixels',async()=>{
  assert.match(oracle.qualification,/zero claimed completed game levels/);assert.deepEqual(rules,oracle.rules);
  for(const[path,hash]of Object.entries(oracle.sourceHashes))assert.equal(createHash('sha256').update(await readFile(new URL('../reference/v6/'+oracle.commit+'/source/'+path,import.meta.url))).digest('hex'),hash,path);
});
for(const c of oracle.cases)test('animated '+c.operation+': '+c.id,()=>{
  const a=c.args,p=a.packet?packets[a.packet]:null;const call=()=>{
    switch(c.operation){
      case'ordered_packet':return orderedTransientComponentPathFacts(p.before,p.intermediate,p.after,p.action_ref,p.action_data);
      case'cross':return animatedCrossInvitation(scenes[a.scene].observation);
      case'scalar_fill':return measureScalarFillDisplay(scenes[a.scene].rows);
      case'maximal_bars':return maximalTransientBars(a.values,a.thin);
      case'consistent_turn':return consistentTransientTurn(a.centers);
      case'linear_slope':return transientLinearSlope(a.values);
      case'quadratic':return transientQuadratic(a.values);
      case'round':return transientRound(a.value);
      case'acquire':return acquireTransientCurve(p.before,p.intermediate,a.measurement,a.epoch,a.evidence,a.command,a.retained_models??[]);
      case'project':return projectTransientCurve(a.model,scenes[a.scene].rows);
      case'calibration':return transientCalibration(a.model,scenes[a.scene].rows);
      case'source_role':return transientSourceRoleProbe(a.model,scenes[a.scene].rows);
      case'ballistic':return ballisticContactClick(a.track.map(component),component(a.source),component(a.peer),a.components.map(component),a.rows,a.avoid);
      default:throw new Error(c.operation);
    }
  };
  if(c.error)assert.throws(call,e=>e instanceof Error&&e.message===c.error);else assert.deepEqual(call(),c.expected);
});
for(const scenario of oracle.scenarios)test('animated retained source sequence: '+scenario.id,async context=>{
  let family=new AnimatedContact(),proposal:any=null;if(scenario.initial)family.restore(scenario.initial);
  for(const[i,row]of scenario.steps.entries())await context.test(i+' '+row.operation.kind,async()=>{
    const op=row.operation;let result:any;
    switch(op.kind){
      case'propose':{const s=scenes[op.scene];proposal=await family.propose(s.observation,s.rows,s.inputs,op.remaining??16);result=proposal;break;}
      case'bind':family.bind(proposal);result=proposal;break;
      case'before':{const s=scenes[op.scene],p={...structuredClone(proposal),...structuredClone(op.patch??{})};result=family.before(p,op.index??0,s.public,s.observation);break;}
      case'after':{const b=scenes[op.before],a=scenes[op.after];result=family.after(proposal,0,b.observation,a.observation,b.rows,a.rows);break;}
      case'record':{const b=scenes[op.before],a=scenes[op.after],frames=op.packet?[...packets[op.packet].intermediate,a.rows]:[a.rows];result=family.record(b.observation,a.observation,proposal.actions[0],b.rows,a.rows,proposal,0,frames);break;}
      default:throw new Error(op.kind);
    }
    assert.deepEqual(result,row.expected.result,'complete source decision/measurement/authorization');assert.deepEqual(family.state(),row.expected.state,'entire retained source memory');
    const saved=family.state(),restored=new AnimatedContact();restored.restore(saved);assert.deepEqual(restored.state(),saved,'V7 restore preserves every acquired public event and authorization');(saved.events as any[]).push({kind:'external edit'});assert.deepEqual(restored.state(),row.expected.state,'public checkpoint edits cannot mutate retained state');family=restored;
  });
});
test('animation refuses incomplete checkpoints and non-owned response commands',async()=>{
  const family=new AnimatedContact(),s=scenes.initial,p=await family.propose(s.observation,s.rows,s.inputs,16),before=family.state();
  assert.throws(()=>family.restore({format:'animated_contact.v1',events:[]}),/Incomplete/);assert.deepEqual(family.state(),before);
  assert.throws(()=>family.record(s.observation,s.observation,{action_ref:'ACTION1'},s.rows,s.rows,p!,0,[]),/another command/);assert.deepEqual(family.state(),before);
  assert.deepEqual(family.record(s.observation,s.observation,{action_ref:'ACTION1'},s.rows,s.rows,undefined,0,[]),{events:[]});
});
