import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import test from 'node:test';
import { measureNativeObservation, ObservedInputDomain, publicFrameHash } from '../src/logos-engine/v6-native-observer.ts';
import { NativeV6Runtime } from '../src/logos-engine/v6-native-runtime.ts';
import type { NativeCommand, NativeFamily, NativePoint, NativeRecord, NativeRows } from '../src/logos-engine/v6-native-types.ts';
import { V6AgentService } from '../src/runtime/v6-agent-service.ts';
import { evidencedPlanGroup, transferredPreviewGroup } from '../src/sic/experiment-arbitration.ts';
import { createPreparedEffects } from '../src/sic/test-prepared-effects.ts';
import { acceptPreviewCarry, carryPreviewBindings, checkWitnessedPreview, newPreviewLearning,
  observePreviewBindings, offerWitnessedPreview, visualLayout } from '../src/sic/witnessed-preview-transfer.ts';

const fixture = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/sic-preview-transfer-public.json.gz', import.meta.url))).toString());

for (const item of fixture.cases) test('the public ' + item.code + ' transfer retains the selection interface missing in its first failed preview', async () => {
  const learning = newPreviewLearning();
  let retained = learning;
  for (let i = 0; i < item.steps.length - 1; i++) {
    const step = item.steps[i];
    const observe = async (board: typeof step.before, revision: number) => measureNativeObservation({
      frame_rows: board.frame, frame_hash: await publicFrameHash(board.frame),
      level: board.level, levels_completed: board.levelsCompleted, state: board.state,
      available_action_refs: board.availableActionIds.map((id: number) => 'ACTION' + id),
    }, revision, 'public-preview-' + item.code);
    const before = await observe(step.before, i + 1), after = await observe(step.after, i + 2);
    const command = 'ACTION' + step.command.id + (step.command.data ? ':' + step.command.data.x + ',' + step.command.data.y : '');
    observePreviewBindings(retained, before, after, visualLayout(before, step.before.frame), visualLayout(after, step.after.frame), command);
    if (after.levels_completed > before.levels_completed) {
      retained = acceptPreviewCarry(carryPreviewBindings(retained, before, after), after);
    }
  }
  const failed = item.steps.at(-1);
  assert.deepEqual(failed.before.frame, failed.after.frame, 'The actual preview did not move any public pixel');
  const current = await measureNativeObservation({ frame_rows: failed.before.frame,
    frame_hash: await publicFrameHash(failed.before.frame), level: failed.before.level,
    levels_completed: failed.before.levelsCompleted, state: failed.before.state,
    available_action_refs: failed.before.availableActionIds.map((id: number) => 'ACTION' + id),
  }, item.firstPreview, 'public-preview-' + item.code);
  const binding = retained.bindings[item.forecast.key];
  assert.ok(binding?.witnesses.some(witness => witness.interface?.subject.length || witness.interface?.indicator.length),
    'The successful source operation visibly enclosed either the source or its target in a distinct interface');
  assert.equal(offerWitnessedPreview(retained, current, visualLayout(current, failed.before.frame),
    new Set(current.available_action_refs), item.forecast.key), null,
  'An unchanged shape without the witnessed selection interface cannot authorize the transferred operation');
  assert.ok(retained.bindings[item.forecast.key], 'Keep the original effect and its public proof');
});

type Variant = { mask: NativePoint[]; body: number; cue: number; marker: number; command: string; old: NativePoint;
  oldTarget: NativePoint; current: NativePoint; target: NativePoint };
const variants: Variant[] = [
  { mask: [[0, 0], [1, 0], [0, 1], [1, 1]], body: 9, cue: 4, marker: 7, command: 'ACTION6',
    old: [3, 4], oldTarget: [12, 6], current: [5, 11], target: [19, 8] },
  { mask: [[1, 0], [0, 1], [1, 1], [2, 1], [1, 2]], body: 11, cue: 6, marker: 13, command: 'ACTION2',
    old: [4, 3], oldTarget: [11, 12], current: [18, 5], target: [8, 12] },
];

function raster(v: Variant, at: NativePoint, target: NativePoint | null, selected: boolean, peer?: NativePoint): number[][] {
  const rows = Array.from({ length: 64 }, () => Array<number>(64).fill(0));
  const paint = (p: NativePoint) => { for (const [dx, dy] of v.mask) rows[p[1] + dy]![p[0] + dx] = v.body; };
  paint(at); if (peer) paint(peer);
  const width = 1 + Math.max(...v.mask.map(p => p[0])), height = 1 + Math.max(...v.mask.map(p => p[1]));
  if (selected) for (let y = -1; y <= height; y++) for (let x = -1; x <= width; x++) {
    if (x === -1 || x === width || y === -1 || y === height) rows[at[1] + y]![at[0] + x] = v.cue;
  }
  if (target) rows[target[1]]![target[0]] = v.marker;
  return rows;
}

const packet = (rows: NativeRows, level: number, command: string) => ({
  frame_rows: rows, frame_hash: '', level, levels_completed: level - 1,
  state: 'NOT_FINISHED' as const, available_action_refs: [...new Set([command, 'ACTION5', 'ACTION6'])],
});
const operation = (v: Variant, target: NativePoint): NativeCommand => ({ action_ref: v.command,
  data: v.command === 'ACTION6' ? { x: target[0], y: target[1] } : {} });

async function acquire(v: Variant, scope: string) {
  const beforeRows = raster(v, v.old, v.oldTarget, true), afterRows = raster(v, v.oldTarget, null, false);
  const currentRows = raster(v, v.current, v.target, true);
  const observe = async (rows: NativeRows, level: number, revision: number) => measureNativeObservation({
    ...packet(rows, level, v.command), frame_hash: await publicFrameHash(rows),
  }, revision, scope);
  const before = await observe(beforeRows, 1, 1), after = await observe(afterRows, 1, 2), current = await observe(currentRows, 2, 3);
  const family = createPreparedEffects();
  await family.observePublicOutcome!(before, after, operation(v, v.oldTarget), beforeRows, afterRows);
  await family.observePublicOutcome!(after, current, { action_ref: 'ACTION5', data: {} }, afterRows, currentRows);
  return { family, before, after, current, beforeRows, afterRows, currentRows, observe };
}

for (const [index, variant] of variants.entries()) test('native transfer reuses a witnessed marked interface with varied shape, palette, position and control ' + index, async () => {
  const sessionId = 'preview-interface-native-' + index, learned = await acquire(variant, sessionId);
  const family = createPreparedEffects(), records: NativeRecord[] = [], record = family.record!;
  family.record = async (...args) => { const result = await record(...args); records.push(...(result?.events ?? [])); return result; };
  let teachingStep = 0, trainingProof = '';
  const teaching: NativeFamily = {
    id: 'public_interface_acquisition',
    async propose(observation, rows) {
      if (teachingStep >= 2) return null;
      const command: NativeCommand = teachingStep === 0 ? operation(variant, variant.oldTarget) : { action_ref: 'ACTION5', data: {} };
      const pointBinding = command.action_ref === 'ACTION6' ? await ObservedInputDomain.makeLocusWitness(observation, rows,
        [command.data.x!, command.data.y!], { reason: 'Observe the public operation', evidence: [observation.observation_ref] }) : null;
      return { status: 'proposed', kind: this.id, actions: [command],
        steps: [{ action: command, ...(pointBinding ? { point_binding: pointBinding } : {}) }],
        binding: { observation_ref: observation.observation_ref } };
    },
    before(proposal, index, _packet, observation) {
      return { admitted: index === 0 && proposal.binding?.observation_ref === observation.observation_ref, reason: 'public_training_bound' };
    },
    after: () => ({ matched: true, seal_prefix: true, reason: 'public_training_return' }),
    async record(before, after, command, first, second) {
      if (!teachingStep) trainingProof = before.observation_ref;
      await family.observePublicOutcome!(before, after, command, first, second);
      teachingStep++;
      return { events: [] };
    },
    state: () => ({ teachingStep }), restore(value) { teachingStep = value.teachingStep as number; },
  };
  const service = new V6AgentService(() => new NativeV6Runtime({
    families: [teaching, family], groups: [{ id: 'observe_public_operation', families: [teaching.id] },
      ...[evidencedPlanGroup, transferredPreviewGroup].map(id => ({ id, families: [family.id], entryPoints: [id] }))],
    sourceDigest: 'public-interface-transfer', maxPointOccurrences: 100,
  }));
  const publicPacket = (rows: NativeRows, level: number, stepIndex: number) => ({ frame: rows, frames: [rows], level,
    levelsCompleted: level - 1, state: 'NOT_FINISHED' as const, availableActionIds: packet(rows, level, variant.command).available_action_refs.map(ref => Number(ref.slice(6))), stepIndex });
  let training = await service.handle({ type: 'init', sessionId, sequence: 0,
    observation: publicPacket(learned.beforeRows, 1, 0), budgets: { targetLevels: 3, levelActionCaps: [20, 20, 20] } });
  for (const [step, rows] of [learned.afterRows, learned.currentRows].entries()) {
    assert.ok(training.ticket);
    training = await service.handle({ type: 'advance', sessionId, sequence: step + 1, ticketId: training.ticket.id,
      executionMs: 1, observation: publicPacket(rows, step + 1, step + 1) });
    assert.equal(training.kind, 'boundary');
    training = await service.handle({ type: 'resume', sessionId, sequence: step + 1 });
  }
  const first = training;
  assert.ok(first.ticket, 'The first useful ticket should reuse the acquired operation');
  assert.deepEqual(first.command, { actionRef: variant.command, data: operation(variant, variant.target).data });
  const forecast = first.snapshot.proposal?.witnessedPreviewForecast as NativeRecord;
  assert.equal(forecast.basis, 'observed_in_previous_level');
  assert.equal((forecast.witness as NativeRecord).before, trainingProof);
  const arrived = raster(variant, variant.target, null, false);
  const next = await service.handle({ type: 'advance', sessionId, sequence: 3, ticketId: first.ticket.id,
    executionMs: 1, observation: publicPacket(arrived, 2, 3) });
  assert.equal(next.ticket, null);
  assert.equal(next.snapshot.actions, 3);
  assert.equal(records.filter(event => event.result === 'preview_realized').length, 1);
  const seals = next.snapshot.trace.filter(event => event.kind === 'sealed_prefix');
  assert.equal(seals.length, 3);
  assert.equal(seals.at(-1)?.acquired_actions, 1);
});

test('an absent interface or ambiguous actor leaves the inherited fact open without authorizing a guessed transfer', async () => {
  for (const v of variants) {
    const sample = await acquire(v, 'guarded-interface');
    for (const [selected, peer] of [[false, undefined], [true, [3, 15] as NativePoint]] as const) {
      const rows = raster(v, v.current, v.target, selected, peer);
      const current = await sample.observe(rows, 2, 4);
      const proposal = await sample.family.proposeInGroup!(transferredPreviewGroup, current, rows, [], 20);
      assert.equal(proposal, null);
      assert.ok(Object.keys(sample.family.state!().previewLearning.bindings).length);
    }
  }
});

test('an unchanged command refutes every proposed arrival on the same public frame without erasing another learned role', async () => {
  const v = variants[0]!, sample = await acquire(v, 'same-command-refutation');
  const learning = acceptPreviewCarry(carryPreviewBindings(sample.family.state!().previewLearning,
    sample.after, sample.current), sample.current);
  const layout = visualLayout(sample.current, sample.currentRows);
  const offer = offerWitnessedPreview(learning, sample.current, layout, new Set(sample.current.available_action_refs))!;
  assert.ok(offer);
  const original = learning.bindings[offer.key]!;
  learning.bindings['another-attested-association'] = structuredClone(original);
  const other = offerWitnessedPreview(learning, sample.current, layout, new Set(sample.current.available_action_refs), 'another-attested-association');
  assert.equal(other?.command, offer.command);
  const still = await sample.observe(sample.currentRows, 2, 4);
  assert.equal(checkWitnessedPreview(learning, offer, sample.current, still, layout,
    visualLayout(still, sample.currentRows), offer.command).status, 'contradicted');
  assert.equal(offerWitnessedPreview(learning, still, visualLayout(still, sample.currentRows),
    new Set(still.available_action_refs), 'another-attested-association'), null);
  assert.deepEqual(learning.bindings[offer.key], original);
  assert.ok(learning.bindings['another-attested-association']);
  assert.equal(Object.keys(learning.refutedCommands ?? {}).length, 1);
  const changedRows = sample.currentRows.map(row => [...row]);
  changedRows[60]![60] = 3;
  const changed = await sample.observe(changedRows, 2, 5);
  assert.ok(offerWitnessedPreview(learning, changed, visualLayout(changed, changedRows),
    new Set(changed.available_action_refs), 'another-attested-association'), 'A changed public context remains a new question');
  const nextLevel = await sample.observe(sample.currentRows, 3, 6);
  assert.equal(nextLevel.frame_hash, still.frame_hash);
  assert.ok(offerWitnessedPreview(learning, nextLevel, visualLayout(nextLevel, sample.currentRows),
    new Set(nextLevel.available_action_refs), 'another-attested-association'), 'An identical raster in another level does not inherit a command refutation');
});

test('a measured success without the earlier interface revises that precondition while keeping both proofs', async () => {
  const v = variants[0]!, sample = await acquire(v, 'revised-interface'), learning = newPreviewLearning();
  const command = 'ACTION6:' + v.oldTarget.join(',');
  observePreviewBindings(learning, sample.before, sample.after, visualLayout(sample.before, sample.beforeRows),
    visualLayout(sample.after, sample.afterRows), command);
  const plainRows = raster(v, v.old, v.oldTarget, false), plain = await sample.observe(plainRows, 1, 3);
  const returned = await sample.observe(sample.afterRows, 1, 4);
  observePreviewBindings(learning, plain, returned, visualLayout(plain, plainRows),
    visualLayout(returned, sample.afterRows), command);
  const binding = Object.values(learning.bindings).find(value => value.witnesses.some(witness => witness.interface?.subject.length));
  assert.equal(binding?.witnesses.length, 2);
  assert.equal(binding?.witnesses[1]?.interface, undefined);
  const currentRows = raster(v, v.current, v.target, false), current = await sample.observe(currentRows, 2, 5);
  const inherited = acceptPreviewCarry(carryPreviewBindings(learning, returned, current), current);
  assert.ok(offerWitnessedPreview(inherited, current, visualLayout(current, currentRows), new Set(current.available_action_refs)));
});
