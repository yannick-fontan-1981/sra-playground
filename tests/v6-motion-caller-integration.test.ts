import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import test from 'node:test';
import { NativeCallerCoordinator } from '../src/logos-engine/v6-native-caller.ts';
import { NativeReasoningMemory } from '../src/logos-engine/v6-reasoning-memory.ts';
import { ObservedInputDomain } from '../src/logos-engine/v6-native-observer.ts';
import { Snapshot } from '../src/logos-engine/v6-composition-memory.ts';
import type { CompositionTransition } from '../src/logos-engine/v6-composition-memory.ts';
import type { NativeObservation, NativeProposal, NativePublicObservation } from '../src/logos-engine/v6-native-types.ts';

type R = Record<string, any>;
const copy = <T>(value: T): T => structuredClone(value);
const fixture = JSON.parse(gunzipSync(await readFile(new URL('./fixtures/v6-motion-contrast-reference.json.gz', import.meta.url))).toString()) as R;
const reference = new URL('../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/', import.meta.url);
const common = JSON.parse(await readFile(new URL('laya_proto/common_frontier_policy.drm.json', reference), 'utf8'));
const strategy = JSON.parse(await readFile(new URL('morphology_policy/strategy.drm', reference), 'utf8')).declarations[0].configuration;
const scene = (name: string) => fixture.scenes[name] as R;
const snapshot = (name: string) => Snapshot.fromPublic(scene(name).observation, scene(name).rows);
function publicPacket(s: R): NativePublicObservation {
  return { frame_rows: copy(s.rows), frame_packet: [copy(s.rows)], frame_hash: s.observation.frame_hash,
    available_action_refs: copy(s.observation.available_action_refs), level: s.observation.level_epoch,
    levels_completed: s.observation.levels_completed, state: s.observation.state, step_index: s.observation.revision - 1 };
}
async function controlledCaller(sample: R) {
  const memory = new NativeReasoningMemory({ clock: () => 0 }); memory.importCatalog();
  const caller = new NativeCallerCoordinator(memory, { targetLevels: 3,
    domain: new ObservedInputDomain(common.input_domain.max_point_occurrences), strategy });
  await caller.initialize(sample.observation);
  // Explicit synthetic component contract. These source-measured scenes are
  // never supplied as learned state to a live campaign.
  caller.goal.memory.episode = sample.history.map(([before, command, after]: string[]) =>
    [snapshot(before!), command!, snapshot(after!)] as CompositionTransition);
  return { caller, memory };
}

for (const sample of fixture.callerControlled as R[]) test(`common information caller preserves source motion election: ${sample.id}`, async () => {
  const { caller, memory } = await controlledCaller(sample), current = scene(sample.current);
  const meter = copy(sample.meter), beforeEpisode = copy(caller.goal.memory.episode), order: string[] = [];
  const points = caller.points.offers.bind(caller.points), displays = caller.displays.offers.bind(caller.displays), motion = caller.currentMotionOffers.bind(caller);
  (caller.points as unknown as R).offers = async (...args: any[]) => { order.push('points'); return (points as (...args: any[]) => Promise<R[]>)(...args); };
  (caller.displays as unknown as R).offers = (...args: any[]) => { order.push('displays'); return (displays as (...args: any[]) => R[])(...args); };
  let observed: R[] | null = null;
  (caller as unknown as R).currentMotionOffers = async (...args: any[]) => {
    order.push('motion'); assert.deepEqual(args[4], meter);
    const result = await (motion as (...args: any[]) => Promise<R[]>)(...args); observed = copy(result); return result;
  };
  const proposal = await caller.currentInformationOffer(sample.observation, current.rows, sample.inputs, sample.remaining, meter);
  assert.deepEqual(order, ['points', 'displays', 'motion']); assert.deepEqual(observed, sample.expectedOffers);
  assert.deepEqual(copy(caller.goal.memory.episode), beforeEpisode); assert.deepEqual(meter, sample.meter, 'Planning does not advance the acquired meter');
  if (sample.expectedElection.length) {
    assert.ok(proposal); const receipt = sample.expectedElection[0][1];
    assert.deepEqual(proposal.question.curiosity, receipt); assert.deepEqual(proposal.actions, [receipt.action]);
    assert.equal(receipt.release_authority, false); assert.equal(receipt.return_steps, null);
    assert.equal((await caller.before(proposal as NativeProposal, 0, publicPacket(current), sample.observation)).admitted, true);
  } else assert.equal(proposal, null);
  memory.close();
});

for (const returned of fixture.callerControlled[0].reconciliations as R[]) test(`common acquisition compares the actual motion return: ${returned.after}`, async () => {
  const sample = fixture.callerControlled[0], { caller, memory } = await controlledCaller(sample), first = scene(sample.current), second = scene(returned.after);
  const proposal = await caller.currentInformationOffer(sample.observation, first.rows, sample.inputs, sample.remaining, sample.meter);
  assert.ok(proposal);
  const acquisition = await caller.beforeAssessment({ before: sample.observation as NativeObservation,
    after: second.observation as NativeObservation, command: proposal.actions[0], first: publicPacket(first), second: publicPacket(second),
    index: 0, outcome: { matched: null, preservation_matched: true, seal_prefix: true, reason: 'synthetic_public_return' } }, proposal as NativeProposal);
  assert.deepEqual(acquisition.information_goal_result, returned.expected);
  assert.deepEqual(memory.get('common-observation-frontier', `information_experiment:${sample.observation.revision}`).value,
    { goal: proposal.question.curiosity, outcome: returned.expected });
  assert.equal(acquisition.selected_result, null, 'A common motion experiment is not attributed to an unrelated family');
  memory.close();
});
