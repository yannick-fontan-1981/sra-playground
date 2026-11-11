import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createNativeV6Runtime } from '../src/logos-engine/v6-native-runtime.ts';
import type { NativeV6Declarations } from '../src/logos-engine/v6-native-runtime.ts';
import type { NativeCommand, NativeExecution, NativeFamily, NativeObservation, NativePublicObservation, NativeRuntimeYield } from '../src/logos-engine/v6-native-types.ts';
import { MotifAccess } from '../src/logos-engine/v6-motif-access.ts';
import { SymmetricField } from '../src/logos-engine/v6-field-constraints.ts';
type R = Record<string, any>;
const reference = new URL('../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/', import.meta.url);
const declarations = { common: JSON.parse(await readFile(new URL('laya_proto/common_frontier_policy.drm.json', reference), 'utf8')),
  strategy: JSON.parse(await readFile(new URL('morphology_policy/strategy.drm', reference), 'utf8')) } as NativeV6Declarations;
const fixture = JSON.parse(await readFile(new URL('./fixtures/v6-motif-access-reference.json', import.meta.url), 'utf8')) as R;
const execution: NativeExecution = { yieldControl: async () => {}, now: () => 0, deadlineMs: 360000 };
const packet = (name: string, step?: number): NativePublicObservation => ({ ...structuredClone(fixture.frames[name].public), ...(step === undefined ? {} : { step_index: step }) });
const budgets = { targetLevels: 3, levelActionCaps: [12, 12, 12], maxActions: 36 };
function released(result: NativeRuntimeYield, mode: string, command: R) {
  assert.equal(result.kind, 'action', result.reason ?? 'No current action');
  assert.equal(result.snapshot.lastDecision, 'motif_access'); assert.deepEqual(result.command, command);
  const proposal = result.snapshot.proposal as R;
  assert.equal(proposal.kind, 'motif_to_geometric_access');
  assert.equal(proposal.material_access_subquestion, 'motif_conditioned_access');
  assert.equal(proposal.steps[0].mode, mode); assert.equal(proposal.bundle_template.operation_key, 'OP18');
  assert.equal(proposal.compositions[0].observed, false);
  assert.equal((result.snapshot.whyAct as R).decision.decision.status, 'action_set_released');
  assert.ok(result.authorization); assert.equal(result.snapshot.levelsCompleted, 0);
}
async function coldInvocation(afterInvocation = 'open') {
  const runtime = await createNativeV6Runtime(declarations, { now: () => 0 }), internal = runtime as unknown as R;
  const owner = (internal.families as NativeFamily[]).find(f => f.id === 'motif_access')!, records: R[] = [];
  assert.deepEqual(owner.state(), new MotifAccess().state());
  const record = owner.record.bind(owner);
  owner.record = async (...args) => { const value = await record(...args);
    records.push({ revision: args[0].revision, command: structuredClone(args[2]), mode: args[5].steps?.[args[6]]?.mode, event: structuredClone(value.events[0]) });
    return value;
  };
  try {
    let result = await runtime.initialize({ sessionId: `synthetic-motif-${afterInvocation}`, observation: packet('base'), budgets }, execution);
    const steps: [string, string, R][] = [ ['moved', 'calibrate', { action_ref: 'ACTION4' }],
      ['toggled', 'toggle', { action_ref: 'ACTION6', data: { x: 3, y: 20 } }],
      [afterInvocation, 'invoke', { action_ref: 'ACTION6', data: { x: 7, y: 24 } }] ];
    for (let index = 0; index < steps.length; index++) {
      const [after, mode, command] = steps[index]!; released(result, mode, command);
      assert.equal(records.length, index, 'Selection and admission cannot acquire a return');
      result = await runtime.advance({ command: result.command!, observation: packet(after, index + 1), executionMs: 0 }, execution);
      assert.equal(result.kind, 'boundary', result.reason ?? 'Unknown effect must seal');
      assert.equal(records.length, index + 1, 'One selected owner acquires each return once');
      assert.deepEqual((result.snapshot.whyAct as R).analysis.map((item: R) => item.operation), ['OP29', 'OP30', 'OP31']);
      assert.deepEqual(internal.authority.memory.get('common-observation-frontier', `motif:${records[index]!.revision}`).value, records[index]!.event);
      if (index + 1 < steps.length) result = await runtime.resume(execution);
    }
    return { runtime, internal, owner, records, result };
  } catch (error) { runtime.close('synthetic-motif-setup-failed'); throw error; }
}

test('the cold production caller acquires one motif response, restores it from common memory and rechecks access', async () => {
  const { runtime, internal, owner, records, result: boundary } = await coldInvocation();
  try {
    const acquired = owner.state() as R;
    assert.equal(boundary.snapshot.actions, 3); assert.equal(records.length, 3);
    assert.deepEqual(records.map(row => row.mode), ['calibrate', 'toggle', 'invoke']);
    assert.equal(records[2]!.event.grid_cleared, true);
    assert.equal((acquired.events as R[]).length, 3);
    owner.restore(new MotifAccess().state()); assert.deepEqual(owner.state(), new MotifAccess().state());
    let result = await runtime.resume(execution);
    released(result, 'walk', { action_ref: 'ACTION4' });
    const restored = owner.state() as R;
    for (const key of ['learned', 'motion', 'events', 'passed']) assert.deepEqual(restored[key], acquired[key], `Common store restores ${key}`);
    assert.equal(records.length, 3, 'Restoration and the next decision do not reacquire the invocation');
    result = await runtime.advance({ command: result.command!, observation: packet('walked'), executionMs: 0 }, execution);
    assert.equal(result.kind, 'boundary'); assert.equal(result.snapshot.actions, 4);
    assert.equal(records.length, 4); assert.equal(records[3]!.mode, 'walk');
    assert.deepEqual(internal.authority.memory.get('common-observation-frontier', `motif:${records[3]!.revision}`).value, records[3]!.event);
    assert.equal(result.snapshot.levelsCompleted, 0, 'A synthetic geometric route is not an official game success');
  } finally { runtime.close('synthetic-motif-cold-path-complete'); }
});

test('a contrary invocation response keeps access unresolved and changes the next current decision', async () => {
  const positive = await coldInvocation('open'), contrary = await coldInvocation('moved');
  try {
    assert.deepEqual(positive.records.map(r => r.command), contrary.records.map(r => r.command));
    const opened = await positive.runtime.resume(execution), unchanged = await contrary.runtime.resume(execution);
    released(opened, 'walk', { action_ref: 'ACTION4' });
    released(unchanged, 'toggle', { action_ref: 'ACTION6', data: { x: 7, y: 20 } });
    assert.equal(positive.records.length, 3); assert.equal(contrary.records.length, 3);
    assert.equal((opened.snapshot.proposal as R).motif_plan.scope, (unchanged.snapshot.proposal as R).motif_plan.scope);
    assert.equal(opened.snapshot.levelsCompleted, 0); assert.equal(unchanged.snapshot.levelsCompleted, 0);
  } finally { positive.runtime.close('positive-synthetic-response'); contrary.runtime.close('contrary-synthetic-response'); }
});

test('removing only selected motif acquisition prevents the measured calibration from becoming a motif decision', async () => {
  const runtime = await createNativeV6Runtime(declarations, { now: () => 0 }), internal = runtime as unknown as R;
  const owner = (internal.families as NativeFamily[]).find(f => f.id === 'motif_access')!;
  const blank = owner.state() as R; let calls = 0;
  // Explicit diagnostic ablation: production sources and common caller remain unchanged.
  owner.record = () => { calls++; return { events: [] }; };
  try {
    let result = await runtime.initialize({ sessionId: 'synthetic-motif-acquisition-ablation', observation: packet('base'), budgets }, execution);
    released(result, 'calibrate', { action_ref: 'ACTION4' });
    result = await runtime.advance({ command: result.command!, observation: packet('moved'), executionMs: 0 }, execution);
    assert.equal(result.kind, 'boundary'); assert.equal(calls, 1);
    result = await runtime.resume(execution);
    released(result, 'calibrate', { action_ref: 'ACTION4' });
    assert.deepEqual((owner.state() as R).motion, blank.motion);
    assert.equal(calls, 1); assert.equal(result.snapshot.levelsCompleted, 0);
  } finally { runtime.close('synthetic-motif-acquisition-ablation'); }
});

test('the source motif-interface exclusion is local to the final symmetry fallback and requires an unambiguous body', async () => {
  const original = SymmetricField.prototype.propose; let calls = 0;
  // Boundary instrumentation proves whether the fallback is consulted; it makes no geometry-parity claim.
  SymmetricField.prototype.propose = async function () { calls++; return null; };
  const runtimes: Awaited<ReturnType<typeof createNativeV6Runtime>>[] = [];
  try {
    for (const enabled of [true, false]) {
      const configuration = structuredClone(declarations);
      configuration.strategy.declarations[0]!.configuration.regular_field_correspondence.exclude_observed_control_interface = enabled;
      const runtime = await createNativeV6Runtime(configuration, { now: () => 0 }); runtimes.push(runtime);
      const owner = ((runtime as unknown as R).families as NativeFamily[]).find(f => f.id === 'regular_field_correspondence')!;
      for (const name of ['base', 'two_bodies', 'missing_cell']) {
        const frame = fixture.frames[name], previous = calls;
        assert.equal(await owner.propose(frame.observation as NativeObservation, frame.public.frame_rows, frame.inputs as NativeCommand[], 16, execution), null);
        assert.equal(calls - previous, enabled && name === 'base' ? 0 : 1, `${enabled}/${name}`);
      }
    }
  } finally { SymmetricField.prototype.propose = original; for (const runtime of runtimes) runtime.close('source-symmetry-fallback-boundary'); }
});
