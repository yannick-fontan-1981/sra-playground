import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { ExposedReceptionMemory, exposedReceptionBefore } from '../src/logos-engine/v6-exposed-reception-access.ts';
import { measureExposedReception } from '../src/logos-engine/v6-exposed-reception-observation.ts';
import { CompositionTargetTree } from '../src/logos-engine/v6-target-binding.ts';
import { receptionRaster } from './helpers/v6-exposed-reception-raster.ts';
import { readEvidenceSync } from './helpers/chunked-evidence.ts';

type R = Record<string, any>;
const root = new URL('../', import.meta.url);
const file = (path: string): Buffer => readEvidenceSync(new URL(path, root));
const read = (path: string): R => JSON.parse((path.endsWith('.gz') ? gunzipSync(file(path)) : file(path)).toString());
const copy = <T>(value: T): T => structuredClone(value);
const directory = 'docs/migration/lot3c-evidence/final/';
const terminal = read(directory + 'cwse-terminal-diagnostic/source-result.json');
const campaign = read(directory + 'cwse-session/cwse-campaign.json.gz');
const packets = read(directory + 'cwse-session/cwse-public-trace.json.gz').packets.map((entry: R) => entry.packet);
const actualEvents: R[] = campaign.prefixes.flatMap((prefix: R) => prefix.sharedSeries.exposedReceptionAcquiredEvents);
const policy = read('reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/morphology_policy/strategy.drm');
const config = policy.declarations[0].configuration.observed_composition_services;
const parity = read('tests/fixtures/v6-exposed-reception-parity.json.gz');
const target = new CompositionTargetTree(), objective = { id: 'G_official_completion' };
function restored(events: R[]): ExposedReceptionMemory {
  const memory = new ExposedReceptionMemory();
  for (const event of JSON.parse(JSON.stringify(events))) memory.applyEvent(event);
  return memory;
}
function actualProposal(memory: ExposedReceptionMemory): R {
  const proposal = memory.propose(terminal.terminalObservation, packets[21].frame_rows, [], Math.min(16, terminal.remaining),
    { ...config, remaining_level_actions: terminal.remaining });
  assert.equal(proposal?.status, 'proposed'); return proposal!;
}
function assertEnvelope(proposal: R, evidence: string[]): void {
  assert.deepEqual(proposal.bundle_template.evidence, evidence);
  assert.deepEqual(proposal.route_refs, evidence);
  assert.deepEqual(proposal.question.hypothesis_refs, evidence);
}

test('published failed trajectory 19/20/21 gains only current proposal evidence, without an acquired event', () => {
  for (const input of terminal.inputs) assert.equal(createHash('sha256').update(file(input.path)).digest('hex'), input.sha256);
  assert.equal(actualEvents.length, 19);
  assert.deepEqual([19, 20, 21].map(index => measureExposedReception(packets[index].frame_rows) !== null), [true, false, true]);
  const memory = restored(actualEvents), checkpoint = memory.currentState(), digest = memory.retainedDigest('published-terminal');
  const prefix = campaign.prefixes.at(-2), capture = prefix.outlineAcquisition.nativeCheckpoint.public_transition;
  assert.deepEqual(memory.record(terminal.lastExposedTransition.before, capture.command, terminal.lastExposedTransition.after,
    packets[19].frame_rows, packets[20].frame_rows, prefix.observedExposedReception.proposal, 7), []);
  const proposal = actualProposal(memory), current = terminal.terminalObservation.observation_ref;
  assert.equal(terminal.proposal.bundle_template.evidence.includes(current), false);
  assert.equal(target.bind(terminal.proposal, terminal.terminalObservation, objective).reason, 'unbound_action_set');
  const evidence = [...terminal.proposal.bundle_template.evidence.slice(-15), current];
  assertEnvelope(proposal, evidence);
  assert.equal(target.bind(proposal, terminal.terminalObservation, objective).admitted, true);
  const sourceEquivalent = copy(proposal);
  sourceEquivalent.bundle_template.evidence = copy(terminal.proposal.bundle_template.evidence);
  sourceEquivalent.route_refs = copy(terminal.proposal.route_refs);
  sourceEquivalent.question.hypothesis_refs = copy(terminal.proposal.question.hypothesis_refs);
  assert.deepEqual(sourceEquivalent, terminal.proposal, 'Native extension is confined to the three proposal evidence fields');
  assert.deepEqual(memory.currentState(), checkpoint); assert.equal(memory.eventCount, 19);
  assert.equal(memory.retainedDigest('published-terminal'), digest);
  assert.deepEqual(actualProposal(memory), proposal, 'Repeated proposal acquires no future response');
});

test('real terminal current evidence preserves stale observation, command, frame and action guards', () => {
  const proposal = actualProposal(restored(actualEvents)), observation = terminal.terminalObservation;
  const rows = packets[21].frame_rows;
  const meta = { epoch: observation.level_epoch, score: observation.levels_completed,
    observation_ref: observation.observation_ref, available: observation.available_action_refs };
  assert.equal(exposedReceptionBefore(proposal, 0, rows, meta).admitted, true);
  assert.equal(exposedReceptionBefore(proposal, 0, rows, { ...meta, observation_ref: 'foreign-current' }).admitted, false);
  assert.equal(exposedReceptionBefore(proposal, 0, packets[19].frame_rows, meta).admitted, false);
  assert.equal(exposedReceptionBefore(proposal, 0, rows, { ...meta, available: [] }).admitted, false);
  assert.equal(target.bind(proposal, { ...observation, level_epoch: observation.level_epoch + 1 }, objective).reason, 'stale_proposal');
  assert.equal(target.bind(proposal, { ...observation, observation_ref: 'foreign-current' }, objective).reason, 'stale_proposal');
  const changed = copy(proposal); changed.actions = copy(changed.actions); changed.actions[0].action_ref = 'ACTION7';
  assert.equal(target.bind(changed, observation, objective).reason, 'unbound_action_set');
  assert.equal(exposedReceptionBefore(changed, 0, rows, meta).admitted, false);
  const withoutCurrent = copy(proposal);
  withoutCurrent.bundle_template.evidence = terminal.proposal.bundle_template.evidence;
  assert.equal(target.bind(withoutCurrent, observation, objective).reason, 'unbound_action_set');
});

test('restoring only the real nineteen own events reproduces the same extended proposal and unchanged history', () => {
  const original = restored(actualEvents), proposal = actualProposal(original), checkpoint = original.currentState();
  const reloaded = restored(checkpoint.reception_events);
  assert.deepEqual(reloaded.currentState(), checkpoint); assert.deepEqual(actualProposal(reloaded), proposal);
  proposal.bundle_template.evidence.push('caller-edit'); proposal.exposed_reception_plan.state.evidence.push('caller-edit');
  assert.deepEqual(original.currentState(), checkpoint); assert.deepEqual(reloaded.currentState(), checkpoint);
  assert.deepEqual(actualProposal(original), actualProposal(reloaded));
});

const rows = receptionRaster(), scene = measureExposedReception(rows)!;
const observation = { level_epoch: 1, levels_completed: 0, observation_ref: 'synthetic:current',
  available_action_refs: ['ACTION1', 'ACTION2', 'ACTION3', 'ACTION4', 'ACTION5', 'ACTION6'] };
function synthetic(evidence: string[], changes: R = {}): ExposedReceptionMemory {
  const event = copy(parity.cases.find((item: R) => item.id === 'propose:known_controls_path').seedEvents[0]);
  event.state = { ...event.state, epoch: observation.level_epoch, layout: scene.layout, evidence, ...changes };
  return restored([event]);
}
function syntheticProposal(memory: ExposedReceptionMemory, raster = rows, obs = observation): R {
  const proposal = memory.propose(obs, raster, [], 16, config); assert.equal(proposal?.status, 'proposed'); return proposal!;
}
for (const [name, evidence, expected] of [
  ['empty history', [], [observation.observation_ref]],
  ['short history', ['older', 'latest'], ['older', 'latest', observation.observation_ref]],
  ['full history', Array.from({ length: 19 }, (_, i) => 'history:' + i), [...Array.from({ length: 15 }, (_, i) => 'history:' + (i + 4)), observation.observation_ref]],
  ['current outside retained tail', [observation.observation_ref, ...Array.from({ length: 18 }, (_, i) => 'history:' + i)], [...Array.from({ length: 15 }, (_, i) => 'history:' + (i + 3)), observation.observation_ref]],
  ['current already within tail', ['older', observation.observation_ref, 'later'], ['older', observation.observation_ref, 'later']],
] as [string, string[], string[]][]) test(`synthetic proposal evidence is bounded and preserves learned provenance: ${name}`, () => {
  const memory = synthetic(evidence), checkpoint = memory.currentState(), revision = memory.nativeRevision;
  const proposal = syntheticProposal(memory); assertEnvelope(proposal, expected);
  assert.ok(proposal.bundle_template.evidence.length <= 16);
  assert.deepEqual(proposal.exposed_reception_plan.state.evidence, evidence);
  assert.deepEqual(memory.currentState(), checkpoint); assert.equal(memory.nativeRevision, revision);
  assert.equal(target.bind(proposal, observation, objective).admitted, true);
});

for (const [name, changes] of [['epoch', { epoch: 0 }], ['layout', { layout: 'other-layout' }]] as [string, R][])
  test(`synthetic stale ${name} still resets local proposal state and retains acquired history`, () => {
    const memory = synthetic(['old-only'], changes), checkpoint = memory.currentState();
    const proposal = syntheticProposal(memory);
    assertEnvelope(proposal, [observation.observation_ref]);
    assert.equal(proposal.exposed_reception_plan.state.epoch, observation.level_epoch);
    assert.equal(proposal.exposed_reception_plan.state.layout, scene.layout);
    assert.deepEqual(proposal.exposed_reception_plan.state.evidence, [observation.observation_ref]);
    assert.deepEqual(memory.currentState(), checkpoint);
  });

test('an unmeasurable current raster or incomplete search cannot gain a proposed evidence envelope', () => {
  const memory = synthetic(['old-only']), checkpoint = memory.currentState();
  assert.equal(memory.propose(observation, Array.from({ length: 64 }, () => Array(64).fill(0)), [], 16, config), null);
  const incomplete = memory.propose(observation, rows, [], 16, { ...config, level_deadline: 1, native_reception_now: () => 2 });
  assert.equal(incomplete?.status, 'unknown'); assert.equal(incomplete?.reason, 'reception_computation_incomplete');
  assert.equal(incomplete?.bundle_template, undefined); assert.deepEqual(memory.currentState(), checkpoint);
});
