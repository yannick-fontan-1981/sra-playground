import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { LinkedPacketMemory, commonLinkedPacketProposal, bindLinkedPacket, linkedPacketBefore, linkedPacketAfter } from '../src/logos-engine/v6-linked-packet-access.ts';
import { fitLinkedLine, mergeLinkedBoxes, linkedForegroundGroups, linkedPhase, linkedSelectionRecipient, measureLinkedPacket, measureLinkedScene, linkedTargetMarker } from '../src/logos-engine/v6-linked-packet-observation.ts';
import { linkedLattice, estimateLinkedPhase } from '../src/logos-engine/v6-linked-packet-ray.ts';
import { linkedPacketDigest, linkedRound } from '../src/logos-engine/v6-linked-packet-numeric.ts';
import { ObservedInputDomain } from '../src/logos-engine/v6-native-observer.ts';
import { SharedSeriesConstraint } from '../src/logos-engine/v6-shared-series.ts';

type R = Record<string, any>;
const root = new URL('../', import.meta.url);
const compressed = async (path: string): Promise<R> => JSON.parse(gunzipSync(await readFile(new URL(path, root))).toString());
const fixture = await compressed('tests/fixtures/v6-linked-packet-reference.json.gz');
const probe = await compressed(fixture.originalPublicProbe.path);
const discovery = await compressed(fixture.initialDiscovery.path);
const clone = <T>(value: T): T => structuredClone(value);
const hash = (value: Uint8Array): string => createHash('sha256').update(value).digest('hex');
const config = JSON.parse(await readFile(new URL(`reference/v6/${fixture.sourceCommit}/source/agents/yf_arc3_v6/morphology_policy/strategy.drm`, root), 'utf8')).declarations[0].configuration;

/** Only explicitly numerical derived identifiers may have a native spelling. */
function nativeIdentityPath(path: string): boolean {
  return /(?:^|\.)proposal_id$/.test(path) || /\.compositions\.\d+\.id$/.test(path)
    || /\.bundle_template\.composition_ref$/.test(path) || /\.bundle_template\.outcome_guard\.contains$/.test(path)
    || /\.geometric_route_cache\.context$/.test(path);
}
function compareNumerical(actual: any, expected: any, path = 'value', stats = { maximumError: 0, numbers: 0, nativeIdentities: 0 }): typeof stats {
  if (typeof expected === 'number') {
    assert.equal(typeof actual, 'number', path); assert.ok(Number.isFinite(actual), path);
    const difference = Math.abs(actual - expected); stats.maximumError = Math.max(stats.maximumError, difference); stats.numbers++;
    if (Number.isInteger(actual) && Number.isInteger(expected)) assert.equal(actual, expected, path);
    else assert.ok(difference <= 1e-12, `${path}: ${actual} versus ${expected}, difference ${difference}`);
    return stats;
  }
  if (expected === null || typeof expected !== 'object') {
    if (typeof expected === 'string' && actual !== expected && nativeIdentityPath(path)) {
      assert.equal(typeof actual, 'string', path);
      assert.match(actual, /^(?:C_linked_)?[0-9a-f]{20,64}$/); assert.match(expected, /^(?:C_linked_)?[0-9a-f]{20,64}$/);
      stats.nativeIdentities++; return stats;
    }
    assert.equal(actual, expected, path); return stats;
  }
  assert.ok(actual !== null && typeof actual === 'object', path); assert.equal(Array.isArray(actual), Array.isArray(expected), path);
  assert.deepEqual(Object.keys(actual).sort(), Object.keys(expected).sort(), path);
  for (const key of Object.keys(expected)) compareNumerical(actual[key], expected[key], path + '.' + key, stats);
  return stats;
}

test('linked evidence pins unchanged source and a cold original three-level attempt, not full-caller selection', async () => {
  assert.equal(fixture.sourceCommit, '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e');
  assert.equal(fixture.qualification.sourceModified, false); assert.equal(fixture.qualification.gameHostRunByExporter, false);
  assert.match(fixture.qualification.commonEnvelope, /True ObservedCompositionConstraint/);
  assert.match(fixture.qualification.commonEnvelope, /not original full common caller/);
  assert.match(fixture.qualification.numerics, /1e-12/);
  assert.match(fixture.qualification.immutableReceiptExtension, /read-only sys.setprofile/);
  const manifest = JSON.parse(await readFile(new URL(`reference/v6/${fixture.sourceCommit}/manifest.json`, root), 'utf8'));
  for (const item of [fixture, probe, discovery]) {
    assert.equal(item.pinnedSourceFilesVerifiedBeforeImport, Object.keys(manifest.files).length);
    for (const [path, expected] of Object.entries(item.sourceHashes)) {
      assert.equal(hash(await readFile(new URL(`reference/v6/${fixture.sourceCommit}/source/${path}`, root))), expected, path);
      assert.equal(manifest.files[path].sha256, expected, path);
    }
    assert.equal(hash(await readFile(new URL(item.generator, root))), item.generatorSha256);
  }
  for (const item of [fixture.originalPublicProbe, fixture.initialDiscovery, fixture.originalAliasingDiagnostic]) assert.equal(hash(await readFile(new URL(item.path, root))), item.sha256);
  const diagnostic = await compressed(fixture.originalAliasingDiagnostic.path);
  assert.equal(hash(await readFile(new URL('scripts/history/export-v6-linked-packet-reference-pre-emission.py', root))), diagnostic.generatorSha256,
    'Historical diagnostic keeps the exact exporter bytes whose checksum it originally recorded');
  for (const [name, expected] of Object.entries(probe.gameAssetHashes)) assert.equal(hash(await readFile(new URL(`public/python/${name}`, root))), expected, name);
  assert.ok(fixture.sourceMro.indexOf('CellPlacementAccess') < fixture.sourceMro.indexOf('LinkedPacketAccess'));
  assert.ok(fixture.sourceMro.indexOf('LinkedPacketAccess') < fixture.sourceMro.indexOf('TraceFieldAccess'));
  assert.equal(probe.game, 'SELE'); assert.equal(probe.targetLevels, 3); assert.equal(probe.status, 'passed');
  assert.equal(probe.reason, 'target_levels_completed'); assert.equal(probe.actions, 44); assert.equal(probe.levelsCompleted, 3);
  assert.equal(probe.sessionCount, 1); assert.equal(probe.manualPrimingActions, 0); assert.equal(probe.resets, 0); assert.equal(probe.levelJumps, 0);
  assert.equal(probe.sourceModified, false); assert.equal(probe.state, 'NOT_FINISHED');
  assert.deepEqual(probe.boundaries.map((item: R) => item.levelActions), [8, 10, 26]);
  assert.equal(probe.packets.length, 45); assert.equal(probe.prefixes.length, 44); assert.equal(probe.requests.length, 45);
  assert.equal(probe.requests.filter((item: R) => item.type === 'load').length, 1);
  assert.ok(probe.requests.slice(1).every((item: R) => item.type === 'action'));
});

test('all 100 untouched public initial scenes have exact source support measurements', () => {
  assert.equal(discovery.actions, 0); assert.equal(discovery.games.length, 100);
  const matching: string[] = [];
  for (const item of discovery.games as R[]) {
    assert.ok(!item.loadError, item.game);
    const scene = measureLinkedScene(item.packet.frame_rows);
    assert.deepEqual(scene, item.scene, item.game);
    const target = scene ? linkedTargetMarker(item.packet.frame_rows, scene) : null;
    assert.deepEqual(target, item.target, item.game);
    if (target) matching.push(item.game);
  }
  assert.deepEqual(matching, ['SELE']);
});

for (const item of fixture.cases as R[]) test(`Python ↔ TypeScript linked packet: ${item.id}`, () => {
  const a = clone(item.arguments); let actual: unknown;
  switch (item.operation) {
    case 'line': actual = fitLinkedLine(a.points); break;
    case 'round': actual = linkedRound(a.value); break;
    case 'ratio': actual = [linkedRound(a.value * 1_000_000), 1_000_000]; break;
    case 'boxes': actual = mergeLinkedBoxes(a.boxes); break;
    case 'foreground': actual = linkedForegroundGroups(a.rows, a.background, a.bounds); break;
    case 'phase': actual = linkedPhase(a.rows, a.control, a.occlusion); break;
    case 'lattice': actual = linkedLattice(a.outputs, a.steps); break;
    case 'estimate': actual = estimateLinkedPhase(a.drawing, a.outputs, a.edges, a.steps, a.grid); break;
    case 'selection': actual = linkedSelectionRecipient(a.before, a.after, a.affected, a.previous); break;
    case 'packet_literal': actual = measureLinkedPacket(a.before, a.frames, a.observation_ref, a.action_ref); break;
    default: throw new Error(`Unrecognized operation ${item.operation}`);
  }
  compareNumerical(actual, item.expected);
});

test('all nine dated output packets match, including fronts hidden by the canonical return', () => {
  let canonicalReturns = 0;
  for (const item of fixture.packetMeasurements as R[]) {
    const before = probe.packets[item.actionIndex - 1], after = probe.packets[item.actionIndex];
    const actual = measureLinkedPacket(before.packet.frame_rows, after.packet.frame_packet, before.observation.observation_ref, after.command.action_ref);
    compareNumerical(actual, item.expected); canonicalReturns += Number(actual.canonical_equal_initial);
    assert.equal(actual.status, 'measured'); assert.ok(actual.segments.length > 0);
  }
  assert.equal(fixture.packetMeasurements.length, 9); assert.ok(canonicalReturns > 0);
});

test('44 native own proposals and 53 acquisitions reproduce source decisions, routes and numerical evidence', async () => {
  const memory = new LinkedPacketMemory(), domain = new ObservedInputDomain(4096); let levelActions = 0;
  const stats = { maximumError: 0, numbers: 0, nativeIdentities: 0 };
  for (let index = 0; index < probe.prefixes.length; index++) {
    const prefix = probe.prefixes[index], before = probe.packets[index], after = probe.packets[index + 1], snapshot = memory.currentState();
    const proposal = await commonLinkedPacketProposal(memory, before.observation, before.packet.frame_rows, domain.candidates(before.observation),
      120 - levelActions, fixture.policy, 300000, () => 0);
    assert.ok(proposal); assert.deepEqual(memory.currentState(), snapshot, 'Planning must acquire no receipt');
    bindLinkedPacket(proposal, domain);
    compareNumerical(proposal, prefix.proposal, 'proposal', stats);
    assert.equal(proposal.proposal_id, proposal.bundle_template.composition_ref);
    assert.equal(proposal.proposal_id, proposal.bundle_template.outcome_guard.contains);
    assert.deepEqual(proposal.actions, prefix.proposal.actions);
    assert.deepEqual(linkedPacketBefore(proposal, 0, before.packet.frame_rows, { epoch: before.observation.level_epoch, score: before.observation.levels_completed,
      observation_ref: before.observation.observation_ref, available: before.observation.available_action_refs }), prefix.steps[0].beforeGuard);
    assert.deepEqual(linkedPacketAfter(proposal, 0, before.packet.frame_rows, after.packet.frame_rows,
      { epoch: after.observation.level_epoch, score: after.observation.levels_completed }), prefix.steps[0].outcome);
    const envelope = fixture.commonEnvelopes[index];
    const recorded = memory.record(before.observation, proposal.actions[0], after.observation, before.packet.frame_rows, after.packet.frame_rows, proposal, 0);
    compareNumerical(recorded, envelope.sourceMethodReturns[0].events.filter((event: R) => event.kind === 'linked_packet_evidence'), 'record', stats);
    const packet = memory.recordPacket(before.observation, proposal.actions[0], after.observation, before.packet.frame_rows, after.packet.frame_packet);
    compareNumerical(packet, envelope.sourceMethodReturns[1].events.filter((event: R) => event.kind === 'linked_packet_evidence'), 'packet', stats);
    compareNumerical(memory.currentState(), envelope.emissionLinkedProjection, 'state', stats);
    const actualCurrent = memory.currentState() as R, originalCurrent = clone(prefix.steps[0].afterState.projection);
    delete actualCurrent.linked_events; delete originalCurrent.linked_events;
    compareNumerical(actualCurrent, originalCurrent, 'current', stats);
    levelActions++;
    if (after.observation.levels_completed > before.observation.levels_completed) levelActions = 0;
  }
  assert.equal(memory.currentState().linked_events.length, 53); assert.ok(stats.nativeIdentities > 0);
  assert.ok(stats.maximumError <= 1e-12); assert.ok(stats.numbers > 1000);
  const rebuilt = new LinkedPacketMemory(); for (const event of memory.currentState().linked_events) rebuilt.applyEvent(event);
  assert.deepEqual(rebuilt.currentState(), memory.currentState()); assert.equal(rebuilt.retainedDigest('ancestor'), memory.retainedDigest('ancestor'));
});

test('true complete family envelope and the common native owner acquire each actual receipt once', async () => {
  const family = new SharedSeriesConstraint(config.window_constraints.occurrence_recall), domain = new ObservedInputDomain(4096);
  let boundaries = 0;
  for (const envelope of fixture.commonEnvelopes as R[]) {
    const before = probe.packets[envelope.actionIndex - 1], after = probe.packets[envelope.actionIndex];
    const proposal = await family.linkedPropose(before.observation, before.packet.frame_rows, domain.candidates(before.observation), envelope.remaining, fixture.policy, 300000, () => 0);
    assert.ok(proposal); compareNumerical(proposal, envelope.proposal, 'proposal');
    family.bind(proposal, domain); compareNumerical(proposal, envelope.boundProposal, 'proposal');
    assert.deepEqual(family.before(proposal, 0, before.packet, before.observation), envelope.beforeGuard);
    assert.deepEqual(family.after(proposal, 0, before.observation, after.observation, before.packet.frame_rows, after.packet.frame_rows), envelope.outcome);
    const acquired = family.record(before.observation, after.observation, proposal.actions[0], before.packet.frame_rows, after.packet.frame_rows, proposal, 0, after.packet.frame_packet);
    compareNumerical(acquired, envelope.emissionRecord, 'record');
    compareNumerical(family.state().events, envelope.emissionEvents, 'events');
    compareNumerical(family.linked.currentState(), envelope.emissionLinkedProjection, 'linked');
    if (acquired.status === 'official_boundary_witness') {
      boundaries++; const snapshot = family.state(), rebuilt = new SharedSeriesConstraint(config.window_constraints.occurrence_recall);
      rebuilt.restore(clone(snapshot)); assert.deepEqual(rebuilt.state(), snapshot); assert.deepEqual(rebuilt.linked.currentState(), family.linked.currentState());
    }
  }
  assert.equal(boundaries, 3); assert.equal(family.state().events.length, 59); assert.equal(family.linked.currentState().linked_events.length, 53);
  const before = family.state(), changed = clone(before);
  changed.events.find((event: R) => Object.keys(event.outputs ?? {}).length).outputs.forged = { angle: 0.25 };
  assert.throws(() => family.restore(changed), /changed during recall/);
  assert.deepEqual(family.state(), before, 'Rejected restore must not partially replace the common owner');
});

test('each source journal alias is witnessed by that same packet, with both dated values retained', () => {
  let aliases = 0;
  for (const envelope of fixture.commonEnvelopes as R[]) {
    const raw = envelope.record.events.filter((event: R) => event.kind === 'linked_packet_evidence');
    const emitted = envelope.sourceMethodReturns.flatMap((entry: R) => entry.events.filter((event: R) => event.kind === 'linked_packet_evidence'));
    assert.equal(raw.length, emitted.length);
    for (const item of envelope.sourceAliasing as R[]) {
      aliases++; assert.equal(raw.length, 2); assert.equal(item.eventIndex, 0);
      assert.ok(item.fields.length > 0); assert.ok(item.fields.every((key: string) => ['outputs', 'input_steps'].includes(key)));
      for (const key of item.fields) {
        assert.notDeepEqual(raw[0][key], emitted[0][key], 'The diagnostic preserves the actual original mutation');
        assert.deepEqual(raw[0][key], emitted[1][key], 'Earlier alias takes exactly the current packet evidence, with no ignored angle or law');
      }
      for (const key of Object.keys(raw[0])) if (!item.fields.includes(key)) assert.deepEqual(raw[0][key], emitted[0][key]);
    }
  }
  assert.ok(aliases > 0);
});

test('current point and full-raster guards reject changed context, command, epoch and bundle', async () => {
  const memory = new LinkedPacketMemory(), first = probe.packets[0], domain = new ObservedInputDomain(4096);
  const proposal = await commonLinkedPacketProposal(memory, first.observation, first.packet.frame_rows, domain.candidates(first.observation), 120, fixture.policy, 300000, () => 0);
  assert.ok(proposal); bindLinkedPacket(proposal, domain);
  const meta = { epoch: first.observation.level_epoch, score: first.observation.levels_completed, observation_ref: first.observation.observation_ref, available: first.observation.available_action_refs };
  for (const delta of [{ epoch: meta.epoch + 1 }, { score: meta.score + 1 }, { observation_ref: 'changed' }, { available: [] }]) {
    assert.equal(linkedPacketBefore(proposal, 0, first.packet.frame_rows, { ...meta, ...delta }).admitted, false);
  }
  assert.equal(linkedPacketBefore(proposal, 1, first.packet.frame_rows, meta).admitted, false);
  const rows = clone(first.packet.frame_rows); rows[0][0] += 1;
  assert.equal(linkedPacketBefore(proposal, 0, rows, meta).admitted, false);
  const changed = clone(proposal); changed.actions[0].data.x += 1;
  assert.equal(linkedPacketBefore(changed, 0, first.packet.frame_rows, meta).admitted, false);
  const bundle = clone(proposal); bundle.bundle_template.actions = [];
  assert.equal(linkedPacketBefore(bundle, 0, first.packet.frame_rows, meta).admitted, false);
  await assert.rejects(() => commonLinkedPacketProposal(memory, first.observation, first.packet.frame_rows, [], 1, fixture.policy, null), /deadline/);
  assert.equal(await commonLinkedPacketProposal(memory, first.observation, first.packet.frame_rows, [], 0, fixture.policy, null), null);
  const snapshot = memory.currentState(); assert.throws(() => memory.record(first.observation, { action_ref: 'ACTION1' }, first.observation, first.packet.frame_rows, first.packet.frame_rows, proposal, 0), /differs/);
  assert.deepEqual(memory.currentState(), snapshot); assert.deepEqual(memory.record(first.observation, {}, first.observation, first.packet.frame_rows, first.packet.frame_rows, {}, 0), []);
});

test('finite numerical layer owns events and rejects non-finite or non-JSON values', () => {
  const event = clone(probe.finalState.projection.linked_events.find((item: R) => Object.keys(item.outputs).length));
  const memory = new LinkedPacketMemory(); memory.applyEvent(event);
  const initial = memory.currentState(), digest = memory.retainedDigest('ancestor'), revision = memory.nativeRevision;
  event.state.evidence.length = 0; event.outputs = {}; initial.linked_events.length = 0;
  assert.equal(memory.retainedDigest('ancestor'), digest); assert.equal(memory.nativeRevision, revision);
  assert.throws(() => memory.applyEvent({ kind: 'foreign' }), /Outside linked-packet/);
  for (const value of [NaN, Infinity, -Infinity, undefined, { get value() { return 1; } }, [, 1]]) assert.throws(() => linkedPacketDigest(value));
  assert.notEqual(linkedPacketDigest([0]), linkedPacketDigest([-0]));
});
