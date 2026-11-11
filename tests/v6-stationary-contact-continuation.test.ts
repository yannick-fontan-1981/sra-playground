import assert from 'node:assert/strict';
import test from 'node:test';
import { AnimatedContact } from '../src/logos-engine/v6-animated-contact.ts';
import { NativeV6Runtime } from '../src/logos-engine/v6-native-runtime.ts';
import type { NativeSelectionGroup } from '../src/logos-engine/v6-native-runtime.ts';
import { rowsDigest, v6Canonical } from '../src/logos-engine/v6-native-observer.ts';
import type { NativeExecution, NativeFamily, NativeObservation, NativeProposal, NativePublicObservation } from '../src/logos-engine/v6-native-types.ts';

type R = Record<string, any>;
const execution: NativeExecution = { yieldControl: async () => {}, now: () => 0 };

/** Independent test pixels, never a game raster or retained game trajectory. */
async function invitation(): Promise<NativePublicObservation> {
  const rows = Array.from({ length: 24 }, () => Array<number>(24).fill(0));
  for (let offset = -2; offset <= 2; offset++) {
    rows[12 + offset]![12] = 3;
    rows[12]![12 + offset] = 3;
  }
  return { frame_rows: rows, frame_packet: [rows], frame_hash: await rowsDigest(rows),
    level: 1, levels_completed: 0, step_index: 0, state: 'NOT_FINISHED', available_action_refs: ['ACTION1', 'ACTION6'] };
}

interface OfferOptions {
  nullOffer?: boolean;
  missingWitness?: boolean;
  staleWitness?: boolean;
  guardVeto?: boolean;
  executionGuardVeto?: boolean;
  unknown?: boolean;
  emptyActions?: boolean;
  requiresService?: boolean;
  globalRefusal?: boolean;
  groupStop?: boolean;
}
function provider(id: string, calls: string[], options: OfferOptions = {}): NativeFamily {
  let guards = 0;
  const propose = (observation: NativeObservation): NativeProposal | null => {
    calls.push(`${id}:propose`);
    if (options.nullOffer) return null;
    return { status: options.unknown ? 'unknown' : 'proposed', kind: 'synthetic_current_question',
      actions: options.emptyActions ? [] : [{ action_ref: 'ACTION1' }],
      steps: options.emptyActions ? [] : [{ action: { action_ref: 'ACTION1' }, expected_after: null }],
      binding: { observation_ref: observation.observation_ref, level_epoch: observation.level_epoch },
      ...(options.requiresService ? { requires_current_service_witness: true } : {}) };
  };
  return {
    id, propose, proposeInSubquestion: (_group, _entry, observation) => propose(observation),
    ...(options.missingWitness ? {} : { groundedInquiryWitness: (_proposal: NativeProposal, observation: NativeObservation) => {
      calls.push(`${id}:witness`);
      return { status: 'acquired_context_for_unknown_effect' as const,
        observation_ref: options.staleWitness ? 'other-observation' : observation.observation_ref,
        context_model_ids: ['synthetic-acquired-context'], evidence_refs: ['public-before', 'public-after'],
        qualification: 'Synthetic provider contract; no physical effect asserted.' };
    } }),
    ...(options.globalRefusal ? { currentProposalRefusal: (observation: NativeObservation) => ({
      observation_ref: observation.observation_ref, level_epoch: observation.level_epoch, frame_hash: observation.frame_hash,
      block_unrelated_probe: true, release_authority: false, reason: 'synthetic_current_global_refusal',
    }) } : {}),
    ...(options.groupStop ? { sourceGroupStop: (group: string, entry: string | null, observation: NativeObservation) => ({
      observation_ref: observation.observation_ref, level_epoch: observation.level_epoch, frame_hash: observation.frame_hash,
      stop_group: group, source_entry: entry, release_authority: false, reason: 'synthetic_source_group_stop',
    }) } : {}),
    before: (...args) => {
      assert.equal(args.length, 4, 'The existing four-argument current guard is preserved');
      calls.push(`${id}:before`); guards++;
      return { admitted: !options.guardVeto && !(options.executionGuardVeto && guards > 1), reason: 'synthetic_current_guard' };
    },
    after: () => ({ matched: null, seal_prefix: true, reason: 'synthetic_return' }),
    record: () => ({ events: [] }), state: () => ({ events: [] }), restore: () => {},
  };
}

async function acquiredRuntime(providers: NativeFamily[], groups: NativeSelectionGroup[]) {
  const contact = new AnimatedContact();
  const runtime = new NativeV6Runtime({ sourceDigest: 'synthetic-stationary-continuation-contract',
    maxPointOccurrences: 1024, now: () => 0, families: [contact, ...providers], groups });
  const initial = await invitation();
  let result = await runtime.initialize({ sessionId: 'synthetic-stationary-continuation', observation: initial,
    budgets: { targetLevels: 2, levelActionCaps: [10, 10], maxActions: 20 } }, execution);
  assert.equal(result.kind, 'action', result.reason);
  assert.equal(result.snapshot.lastDecision, contact.id);
  assert.deepEqual(result.command, { action_ref: 'ACTION6', data: { x: 12, y: 12 } });
  result = await runtime.advance({ command: result.command!, executionMs: 0,
    observation: { ...initial, step_index: 1 } }, execution);
  assert.equal(result.kind, 'boundary', result.reason);
  assert.equal(result.snapshot.actions, 1);
  const internal = runtime as unknown as R;
  const scope = internal.knowledge.value('native_contact_probe_scope:animated_contact');
  assert.equal(scope.status, 'stationary_unlearned_invitation');
  assert.deepEqual(scope.evidence, (contact.state() as R).events[0].evidence,
    'The refusal scope is produced by the actual selected contact acquisition');
  return { runtime, contact, scope, internal };
}

test('stationary refusal follows declared groups and caches named and unnamed null consultations', async () => {
  const calls: string[] = [];
  const same = provider('same_group_empty', calls, { nullOffer: true, missingWitness: true });
  const unnamed = provider('unnamed_empty', calls, { nullOffer: true, missingWitness: true });
  const next = provider('grounded_material', calls);
  const { runtime, internal } = await acquiredRuntime([same, unnamed, next], [
    { id: 'goal_access', families: ['animated_contact', same.id], entryPoints: [null, 'next_source_entry'] },
    { id: 'surface', families: [unnamed.id] },
    { id: 'factored_material_return', families: [next.id] },
  ]);
  const result = await runtime.resume(execution);
  assert.equal(result.kind, 'action', result.reason);
  assert.equal(result.snapshot.lastDecision, next.id);
  assert.deepEqual(calls, ['same_group_empty:propose', 'unnamed_empty:propose', 'grounded_material:propose',
    'grounded_material:witness', 'grounded_material:before', 'grounded_material:before']);
  const receipt = internal.trace.find((event: R) => event.kind === 'native_coordination');
  assert.equal(receipt.preferred_proposal_id, null, 'Missing source IDs remain explicit JSON null');
  assert.equal(receipt.grounded_inquiry.status, 'acquired_context_for_unknown_effect');
  assert.doesNotThrow(() => v6Canonical(receipt), 'The coordination receipt is strict JSON');
  assert.equal(result.snapshot.actions, 1, 'A released command is not a claimed acquired physical effect');
});

test('same-group remainder owns the first question before later groups', async () => {
  const calls: string[] = [];
  const first = provider('same_group_first', calls), later = provider('later_material', calls);
  const { runtime } = await acquiredRuntime([first, later], [
    { id: 'goal_access', families: ['animated_contact', first.id] },
    { id: 'factored_material_return', families: [later.id] },
  ]);
  const result = await runtime.resume(execution);
  assert.equal(result.kind, 'action', result.reason);
  assert.equal(result.snapshot.lastDecision, first.id);
  assert.ok(!calls.some(call => call.startsWith(later.id)));
});

for (const [name, options] of Object.entries({
  'missing witness': { missingWitness: true },
  'stale witness': { staleWitness: true },
  'current guard veto': { guardVeto: true },
  'unknown proposal': { unknown: true },
  'empty action prefix': { emptyActions: true },
  'required current service': { requiresService: true },
  'global refusal after null': { nullOffer: true, globalRefusal: true },
})) test(`first earlier ${name} retains the contact refusal without consulting a later provider`, async () => {
  const calls: string[] = [];
  const first = provider('earlier_source', calls, options), later = provider('later_grounded', calls);
  const { runtime, internal } = await acquiredRuntime([first, later], [
    { id: 'goal_access', families: ['animated_contact'] },
    { id: 'surface', families: [first.id] },
    { id: 'factored_material_return', families: [later.id] },
  ]);
  const result = await runtime.resume(execution);
  assert.equal(result.kind, 'stopped');
  assert.equal(result.reason, 'frontier_unknown');
  assert.equal(result.snapshot.lastDecision, 'animated_contact');
  assert.ok(!calls.some(call => call.startsWith(later.id)));
  assert.ok(!internal.trace.some((event: R) => event.kind === 'native_coordination'));
});

test('sourceGroupStop closes its remaining group and leaves the next declared group available', async () => {
  const calls: string[] = [];
  const stop = provider('recognized_source', calls, { nullOffer: true, missingWitness: true, groupStop: true });
  const skipped = provider('closed_group_tail', calls), next = provider('next_group_grounded', calls);
  const { runtime } = await acquiredRuntime([stop, skipped, next], [
    { id: 'goal_access', families: ['animated_contact', stop.id, skipped.id] },
    { id: 'factored_material_return', families: [next.id] },
  ]);
  const result = await runtime.resume(execution);
  assert.equal(result.kind, 'action', result.reason);
  assert.equal(result.snapshot.lastDecision, next.id);
  assert.ok(!calls.some(call => call.startsWith(skipped.id)));
  assert.equal(calls.filter(call => call === `${stop.id}:propose`).length, 1);
});

test('a coordination witness never bypasses the actual execution guard', async () => {
  const calls: string[] = [];
  const next = provider('grounded_but_vetoed_at_release', calls, { executionGuardVeto: true });
  const { runtime, internal } = await acquiredRuntime([next], [
    { id: 'goal_access', families: ['animated_contact'] },
    { id: 'factored_material_return', families: [next.id] },
  ]);
  const result = await runtime.resume(execution);
  assert.equal(result.kind, 'stopped');
  assert.equal(result.snapshot.actions, 1);
  assert.ok(internal.trace.some((event: R) => event.kind === 'native_coordination'));
  assert.equal(calls.filter(call => call === `${next.id}:before`).length, 2);
});
