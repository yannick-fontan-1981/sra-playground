import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { QueuedFieldMemory, commonQueuedFieldProposal, bindQueuedField, queuedFieldBefore, queuedFieldAfter } from '../src/logos-engine/v6-queued-field-access.ts';
import { measureQueuedField, queuedFieldBoard, queuedFieldGrid } from '../src/logos-engine/v6-queued-field-observation.ts';
import { queuedFieldModels, queuedFieldPlacement, queuedFieldClosure, queuedFieldReceipt, queuedFieldTyped,
  queuedFieldValues, queuedTypedPlacement, queuedTypedClosure, queuedCascadeClosure } from '../src/logos-engine/v6-queued-field-mechanics.ts';
import { activeQueueMemberCount, portableQueueHypothesis } from '../src/logos-engine/v6-queued-field-models.ts';
import { queuedFieldPreparations, chooseQueuedField } from '../src/logos-engine/v6-queued-field-search.ts';
import { linkedPacketDigest } from '../src/logos-engine/v6-linked-packet-numeric.ts';
import { ObservedInputDomain } from '../src/logos-engine/v6-native-observer.ts';

type R = Record<string, any>;
const root = new URL('../', import.meta.url);
const compressed = async (path: string): Promise<R> => JSON.parse(gunzipSync(await readFile(new URL(path, root))).toString());
const fixture = await compressed('tests/fixtures/v6-queued-field-reference.json.gz');
const probe = await compressed(fixture.originalPublicProbe.path);
const discovery = await compressed(fixture.initialDiscovery.path);
const clone = <T>(value: T): T => structuredClone(value);
const hash = (value: Uint8Array): string => createHash('sha256').update(value).digest('hex');

function replaceReference(value: any, from: string, to: string): any {
  if (value === from) return to;
  if (Array.isArray(value)) return value.map(item => replaceReference(item, from, to));
  if (value !== null && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replaceReference(item, from, to)]));
  return value;
}

/** The exact plan is independently hashed before its derived reference changes. */
function compareProposal(actual: R, expected: R): void {
  assert.deepEqual(actual.queued_field_plan, expected.queued_field_plan);
  const actualRef = 'C_queue_' + linkedPacketDigest(actual.queued_field_plan).slice(0, 20);
  assert.equal(actual.proposal_id, actualRef);
  assert.deepEqual(actual.compositions.map((item: R) => item.id), [actualRef]);
  assert.equal(actual.bundle_template.composition_ref, actualRef);
  assert.equal(actual.bundle_template.outcome_guard.contains, actualRef);
  assert.match(expected.proposal_id, /^C_queue_[0-9a-f]{20}$/);
  assert.deepEqual(actual, replaceReference(expected, expected.proposal_id, actualRef));
}

test('queued evidence pins unchanged source and a cold original component, independently of full caller selection', async () => {
  assert.equal(fixture.sourceCommit, '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e');
  assert.equal(fixture.qualification.sourceModified, false);
  assert.equal(fixture.qualification.gameHostRunByExporter, false);
  assert.match(fixture.qualification.commonEnvelope, /True ObservedCompositionConstraint/);
  assert.match(fixture.qualification.commonEnvelope, /not original full common caller/);
  const manifest = JSON.parse(await readFile(new URL(`reference/v6/${fixture.sourceCommit}/manifest.json`, root), 'utf8'));
  for (const item of [fixture, probe, discovery]) {
    assert.equal(item.pinnedSourceFilesVerifiedBeforeImport, Object.keys(manifest.files).length);
    for (const [path, digest] of Object.entries(item.sourceHashes)) {
      assert.equal(manifest.files[path].sha256, digest, path);
      assert.equal(hash(await readFile(new URL(`reference/v6/${fixture.sourceCommit}/source/${path}`, root))), digest, path);
    }
    assert.equal(hash(await readFile(new URL(item.generator, root))), item.generatorSha256);
  }
  for (const source of [fixture.originalPublicProbe, fixture.initialDiscovery]) assert.equal(hash(await readFile(new URL(source.path, root))), source.sha256);
  const diagnostic = fixture.originalParentProjectionDiagnostic;
  assert.equal(hash(await readFile(new URL(diagnostic.path, root))), diagnostic.sha256);
  assert.equal(hash(await readFile(new URL(diagnostic.generatorArchive, root))), diagnostic.generatorSha256);
  const originalParent = await compressed(diagnostic.path);
  assert.equal(originalParent.generatorSha256, diagnostic.generatorSha256, 'The prior exporter bytes and its diagnostic are preserved');
  assert.match(fixture.qualification.digestScope, /not the immediate MRO parent/);
  assert.equal(probe.status, 'passed'); assert.equal(probe.reason, 'target_levels_completed');
  assert.equal(probe.game, 'COLM'); assert.equal(probe.sessionCount, 1);
  assert.equal(probe.manualPrimingActions, 0); assert.equal(probe.resets, 0); assert.equal(probe.levelJumps, 0);
  assert.deepEqual(probe.requests[0], { type: 'load', code: 'COLM', level: 1 });
  assert.ok(probe.requests.slice(1).every((item: R) => item.type === 'action'));
  assert.equal(probe.actions, 45); assert.equal(probe.levelsCompleted, 3); assert.equal(probe.state, 'NOT_FINISHED');
  assert.deepEqual(probe.boundaries.map((item: R) => item.actions), [17, 34, 45]);
  assert.deepEqual(probe.boundaries.map((item: R) => item.levelActions), [17, 17, 11]);
  assert.equal(probe.packets.length, 46);
  assert.equal(probe.packets.reduce((sum: number, item: R) => sum + item.packet.frame_packet.length, 0), 125);
  assert.deepEqual(fixture.sourceAliasing, [], 'The unchanged common source did not mutate any earlier own event');
});

test('all 100 untouched public initial views retain the original queued measurement and ambiguity', () => {
  assert.equal(discovery.games.length, 100); assert.equal(fixture.initialMeasurements.length, 100);
  for (const [index, original] of (fixture.initialMeasurements as R[]).entries()) {
    const item = discovery.games[index]; assert.equal(item.game, original.game);
    assert.deepEqual(measureQueuedField(item.packet.frame_rows), original.expected, item.game);
  }
  const applicable = fixture.initialMeasurements.filter((item: R) => item.expected?.mark && item.expected.preview_alternatives.length);
  assert.deepEqual(applicable.map((item: R) => item.game), ['COLM']);
});

for (const item of fixture.cases as R[]) test(`source queued contract ${item.id}`, () => {
  const a = item.arguments;
  let actual: unknown;
  switch (item.operation) {
    case 'models': actual = queuedFieldModels(a.shape, a.gravity); break;
    case 'placement': actual = queuedFieldPlacement(a.grid, a.bundle, a.column, a.gravity); break;
    case 'closure': actual = queuedFieldClosure(a.grid, a.model); break;
    case 'receipt': actual = queuedFieldReceipt(a.obs, a.grid, a.model, a.evidence); break;
    case 'preparations': actual = queuedFieldPreparations(a.bundle, a.column, a.controls, a.width, a.field, a.active_rows, a.state); break;
    case 'board': actual = queuedFieldBoard(a.scene, a.empty); break;
    case 'choose': actual = chooseQueuedField(a.scene, a.state, a.remaining, a.deadline_expired ? 0 : 600000,
      a.node_bound, a.depth_bound, () => 0); break;
    case 'active_count': actual = activeQueueMemberCount(a.state); break;
    case 'portable': actual = portableQueueHypothesis(a.previous, a.scene, a.observation); break;
    default: throw new Error('Uncovered original queued operation: ' + item.operation);
  }
  assert.deepEqual(actual, item.expected, item.id);
});

test('all 21 source common envelopes, 45 public acquisitions and 39 own events retain exact field evidence', () => {
  const memory = new QueuedFieldMemory(), domain = new ObservedInputDomain(4096);
  let actions = 0, boundary = 0, events = 0, emptyReceipts = 0;
  for (const envelope of fixture.commonEnvelopes as R[]) {
    const first = probe.packets[actions];
    assert.deepEqual(memory.currentState(), envelope.beforeState.projection);
    assert.equal(memory.retainedDigest(envelope.beforeState.actualParentDigest), envelope.beforeState.digest);
    const proposal = commonQueuedFieldProposal(memory, first.observation, first.packet.frame_rows, domain.candidates(first.observation),
      probe.budget.levelActions - (actions - boundary), fixture.policy, 600000, () => 0);
    assert.ok(proposal); compareProposal(proposal, envelope.unboundProposal);
    bindQueuedField(proposal, domain); compareProposal(proposal, envelope.proposal);
    assert.deepEqual(memory.currentState(), envelope.beforeState.projection, 'Planning has acquired no simulated return');
    for (const step of envelope.steps as R[]) {
      const before = probe.packets[actions], after = probe.packets[actions + 1];
      const meta = { epoch: before.observation.level_epoch, score: before.observation.levels_completed,
        observation_ref: before.observation.observation_ref, available: before.observation.available_action_refs };
      assert.deepEqual(queuedFieldBefore(proposal, step.index, before.packet.frame_rows, meta, memory), step.beforeGuard);
      assert.deepEqual(queuedFieldAfter(proposal, step.index, before.packet.frame_rows, after.packet.frame_rows,
        { epoch: after.observation.level_epoch, score: after.observation.levels_completed, state: after.observation.state }), step.outcome);
      assert.deepEqual(memory.record(before.observation, proposal.actions[step.index], after.observation,
        before.packet.frame_rows, after.packet.frame_rows, proposal, step.index), []);
      const acquired = memory.recordPacket(before.observation, proposal.actions[step.index], after.observation,
        before.packet.frame_rows, after.packet.frame_packet);
      assert.deepEqual(acquired, step.ownEvents);
      events += acquired.length; emptyReceipts += Number(acquired.length === 0);
      assert.deepEqual(memory.currentState(), step.ownState.projection);
      assert.equal(memory.retainedDigest(step.ownState.actualParentDigest), step.ownState.digest);
      if (after.observation.levels_completed > before.observation.levels_completed) boundary = actions + 1;
      actions++;
    }
  }
  assert.equal(actions, 45); assert.equal(events, 39); assert.equal(emptyReceipts, 6);
  assert.deepEqual(memory.currentState(), probe.finalState.projection);
});

test('queued first dispatch guards reject stale fields, command payloads, epochs and controls', () => {
  const first = probe.packets[0], envelope = fixture.commonEnvelopes[0];
  const proposal = clone(envelope.proposal), meta = { epoch: first.observation.level_epoch, score: first.observation.levels_completed,
    observation_ref: first.observation.observation_ref, available: first.observation.available_action_refs };
  for (const change of [{ epoch: meta.epoch + 1 }, { score: meta.score + 1 }, { observation_ref: 'old' }, { available: [] }]) {
    assert.equal(queuedFieldBefore(proposal, 0, first.packet.frame_rows, { ...meta, ...change }).admitted, false);
  }
  assert.equal(queuedFieldBefore(proposal, -1, first.packet.frame_rows, meta).admitted, false);
  assert.equal(queuedFieldBefore(proposal, proposal.steps.length, first.packet.frame_rows, meta).admitted, false);
  const rows = clone(first.packet.frame_rows); rows[0][0] += 1;
  assert.equal(queuedFieldBefore(proposal, 0, rows, meta).admitted, false);
  const command = clone(proposal); command.actions[0].action_ref = 'ACTION6';
  assert.equal(queuedFieldBefore(command, 0, first.packet.frame_rows, meta).admitted, false);
  const bundle = clone(proposal); bundle.bundle_template.actions = [];
  assert.equal(queuedFieldBefore(bundle, 0, first.packet.frame_rows, meta).admitted, false);
  assert.throws(() => bindQueuedField({ actions: [{ action_ref: 'ACTION6', data: { x: 1, y: 2 } }] }), /unexpected point data/);
  assert.throws(() => commonQueuedFieldProposal(new QueuedFieldMemory(), first.observation, first.packet.frame_rows,
    [], 1, fixture.policy, null), /deadline/);
  assert.equal(commonQueuedFieldProposal(new QueuedFieldMemory(), first.observation, first.packet.frame_rows,
    [], 0, fixture.policy, null), null);
});

test('known preparation rechecks destination cells and seals a changed exterior projection', () => {
  const envelope = (fixture.commonEnvelopes as R[]).find(item => item.steps.length > 1)!;
  const proposal = envelope.proposal, actionIndex = envelope.firstAction - 1;
  const before = probe.packets[actionIndex], after = probe.packets[actionIndex + 1];
  assert.notEqual(proposal.steps[0].expected_after_grid, null);
  const meta = { epoch: after.observation.level_epoch, score: after.observation.levels_completed, state: after.observation.state };
  assert.equal(queuedFieldAfter(proposal, 0, before.packet.frame_rows, after.packet.frame_rows, meta).matched, true);
  const altered = clone(after.packet.frame_rows); altered[0][0] += 1;
  const outcome = queuedFieldAfter(proposal, 0, before.packet.frame_rows, altered, meta);
  assert.equal(outcome.matched, false); assert.equal(outcome.seal_prefix, true);
  const next = queuedFieldBefore(proposal, 1, after.packet.frame_rows, { epoch: after.observation.level_epoch,
    score: after.observation.levels_completed, observation_ref: after.observation.observation_ref, available: after.observation.available_action_refs });
  assert.equal(next.admitted, true);
  const mismatched = clone(after.packet.frame_rows), geometry = proposal.queued_field_plan.geometry;
  mismatched[geometry.origin[1]][geometry.origin[0]] += 1;
  assert.equal(queuedFieldGrid(mismatched, geometry), null);
  assert.equal(queuedFieldBefore(proposal, 1, mismatched, { epoch: after.observation.level_epoch,
    score: after.observation.levels_completed, observation_ref: after.observation.observation_ref, available: after.observation.available_action_refs }).admitted, false);
});

test('physical occurrence identity and finite wave bounds remain visible in the mechanical receipt', () => {
  const field = [[2, 2, 2], [3, null, 3]], typed = queuedFieldTyped(field);
  assert.deepEqual(queuedFieldValues(typed), field);
  const model = { directions: [[0, 1]], minimum_line: 3, gravity: 1 };
  const noWave = queuedTypedClosure(typed, model, 0);
  assert.deepEqual(noWave.credited, []); assert.equal(noWave.closed, false);
  const closure = queuedTypedClosure(typed, model, 6);
  assert.deepEqual(closure.credited, ['board:0:0', 'board:1:0', 'board:2:0']);
  assert.equal(new Set(closure.credited).size, closure.credited.length, 'Crossed line membership never duplicates physical credit');
  const receipt = queuedFieldReceipt({ observation_ref: 'current', level_epoch: 1 }, field, model, ['actual']);
  const request = clone(receipt.request); request.bounds.max_waves = 0;
  const bounded = queuedCascadeClosure(request);
  assert.equal(bounded.source_status, 'BUDGET_REACHED'); assert.equal(bounded.cause, 'COMPUTATION_BOUND');
  assert.equal(bounded.frontier.length, 1); assert.equal(bounded.values.closed, false);
  assert.deepEqual(bounded.values.credited_occurrences, []);
  const duplicated = queuedFieldTyped([[null, null], [7, null]]);
  assert.throws(() => queuedTypedPlacement(duplicated, [{ value: 2, occurrence_ref: 'board:0:1' }], 1, 1), /identities must be unique/);
});

test('queued own memory freezes acquired values and a pending public return is consumed once', () => {
  const event = clone(probe.finalState.projection.queue_events[0]), memory = new QueuedFieldMemory();
  memory.applyEvent(event);
  const digest = memory.retainedDigest('ancestor'), snapshot = memory.currentState();
  event.state.evidence.length = 0; snapshot.queue_events.length = 0;
  assert.equal(memory.retainedDigest('ancestor'), digest);
  assert.throws(() => memory.applyEvent({ kind: 'outside' }), /Outside queued-field/);
  const first = probe.packets[0], second = probe.packets[1], fresh = new QueuedFieldMemory();
  const proposal = fixture.commonEnvelopes[0].proposal;
  fresh.record(first.observation, proposal.actions[0], second.observation, first.packet.frame_rows, second.packet.frame_rows, proposal, 0);
  assert.equal(fresh.recordPacket(first.observation, proposal.actions[0], second.observation, first.packet.frame_rows, second.packet.frame_packet).length, 1);
  const once = fresh.currentState();
  assert.deepEqual(fresh.recordPacket(first.observation, proposal.actions[0], second.observation, first.packet.frame_rows, second.packet.frame_packet), []);
  assert.deepEqual(fresh.currentState(), once);
});
