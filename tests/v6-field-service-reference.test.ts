import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { fieldCrop, fieldChangeGroups, fieldState, acquireFields, fieldStates, fieldDirections, pairedControls,
  linkedControl, sameFieldShape, fieldShape, currentControl, fieldServiceDigest } from '../src/logos-engine/v6-field-service-observation.ts';
import { FieldServiceMemory, commonFieldServiceProposal, bindFieldService, fieldServiceBefore, fieldServiceAfter } from '../src/logos-engine/v6-field-service-access.ts';
import { ObservedInputDomain } from '../src/logos-engine/v6-native-observer.ts';

type R = Record<string, any>;
const root = new URL('../', import.meta.url);
const compressed = async (path: string): Promise<R> => JSON.parse(gunzipSync(await readFile(new URL(path, root))).toString());
const fixture = await compressed('tests/fixtures/v6-field-service-reference.json.gz');
const probe = await compressed(fixture.originalPublicProbe.path);
const discovery = await compressed(fixture.initialDiscovery.path);
const clone = <T>(value: T): T => structuredClone(value);
const hash = (value: string | Uint8Array): string => createHash('sha256').update(value).digest('hex');

/** Independent proof spelling, not imported from the translated implementation. */
function finiteCanonical(value: any): string {
  if (value === null) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'string') return JSON.stringify(value).replace(/[\u007f-\uffff]/g, c => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
  if (typeof value === 'number') { assert.ok(Number.isFinite(value)); return Object.is(value, -0) ? '-0.0' : String(value); }
  if (Array.isArray(value)) return '[' + value.map(finiteCanonical).join(',') + ']';
  assert.equal(typeof value, 'object');
  return '{' + Object.keys(value).sort().map(key => finiteCanonical(key) + ':' + finiteCanonical(value[key])).join(',') + '}';
}
const exact = (actual: unknown, expected: unknown, message?: string): void => assert.equal(finiteCanonical(actual), finiteCanonical(expected), message);
function ownState(memory: FieldServiceMemory): R {
  const { requested_stop_reason: _, ...projection } = memory.currentState(); return projection;
}
function assertState(memory: FieldServiceMemory, expected: R): void {
  exact(ownState(memory), expected.projection);
  assert.equal(memory.requestedStopReason, expected.requestedStopReason);
  assert.equal(memory.retainedNestedDigest(expected.parentDigest), expected.nestedDigest);
  assert.equal(memory.retainedFillDigest(expected.parentDigest), expected.fillDigest);
  assert.equal(memory.retainedServiceDigest(expected.parentDigest), expected.serviceDigest);
  assert.equal(memory.retainedDigest(expected.parentDigest), expected.digest);
}

test('field service provenance proves a cold component campaign and separately pins the complete source tree', async () => {
  assert.equal(fixture.schema, 'logos-engine.v6.field-service-reference.v1');
  assert.equal(fixture.sourceCommit, '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e');
  assert.equal(fixture.qualification.sourceModified, false); assert.equal(fixture.qualification.gameHostRunByExporter, false);
  assert.match(fixture.qualification.numerics, /No general Python float identity equivalence/);
  assert.match(fixture.qualification.identityTracing, /replaces no source function/);
  assert.match(fixture.qualification.digestScope, /full source\/native ancestor hierarchy is outside/);
  assert.equal(probe.status, 'passed'); assert.equal(probe.game, 'VALV'); assert.equal(probe.fullOriginalCaller, false);
  assert.equal(probe.frontierEnabled, false); assert.deepEqual(probe.providerOrder, ['service_propose']);
  assert.equal(probe.sessionCount, 1); assert.equal(probe.manualPrimingActions, 0); assert.equal(probe.resets, 0); assert.equal(probe.levelJumps, 0);
  assert.equal(probe.actions, 28); assert.equal(probe.levelsCompleted, 3); assert.equal(probe.state, 'NOT_FINISHED');
  assert.deepEqual(probe.boundaries.map((boundary: R) => boundary.levelActions), [10, 10, 8]);
  assert.deepEqual(probe.requests[0], { type: 'load', code: 'VALV', level: 1 });
  assert.ok(probe.requests.slice(1).every((request: R) => request.type === 'action'));
  assert.equal(probe.packets.length, 29); assert.equal(probe.prefixes.length, 28);
  const manifest = JSON.parse(await readFile(new URL(`reference/v6/${fixture.sourceCommit}/manifest.json`, root), 'utf8'));
  assert.equal(Object.keys(manifest.files).length, 1786);
  for (const [path, descriptor] of Object.entries(manifest.files) as [string, R][]) {
    assert.equal(hash(await readFile(new URL(`reference/v6/${fixture.sourceCommit}/source/${path}`, root))), descriptor.sha256, path);
  }
  for (const item of [fixture, probe]) {
    assert.equal(item.pinnedSourceFilesVerifiedBeforeImport, 1786);
    assert.equal(Object.keys(item.sourceHashes).length, 755);
    for (const [path, digest] of Object.entries(item.sourceHashes)) assert.equal(manifest.files[path].sha256, digest, path);
    assert.equal(hash(await readFile(new URL(item.generator, root))), item.generatorSha256);
  }
  assert.equal(fixture.pinnedSourceFilesVerifiedAfterRun, 1786);
  for (const input of [fixture.originalPublicProbe, fixture.initialDiscovery]) assert.equal(hash(await readFile(new URL(input.path, root))), input.sha256);
  for (const [path, digest] of Object.entries(probe.gameAssetHashes)) assert.equal(hash(await readFile(new URL('public/python/' + path, root))), digest);
  assert.deepEqual(fixture.sourceAliasing, []);
});

test('430 original identity recipes prove exact numeric identity only for the checked safe integer domain', () => {
  assert.equal(fixture.identityRecipes.length, 430);
  const safe = (value: any): void => {
    if (typeof value === 'number') { assert.ok(Number.isSafeInteger(value)); assert.equal(Object.is(value, -0), false); }
    else if (Array.isArray(value)) value.forEach(safe);
    else if (value !== null && typeof value === 'object') Object.values(value).forEach(safe);
  };
  for (const recipe of fixture.identityRecipes as R[]) {
    safe(recipe.value); assert.equal(hash(recipe.sourceCanonical), recipe.sourceHash);
    exact(JSON.parse(recipe.sourceCanonical), recipe.value);
    assert.equal(finiteCanonical(recipe.value), recipe.nativeCanonical);
    assert.equal(recipe.nativeCanonical, recipe.sourceCanonical);
    assert.equal(hash(recipe.nativeCanonical), recipe.nativeHash);
    assert.equal(recipe.nativeHash, recipe.sourceHash);
    assert.equal(fieldServiceDigest(recipe.value), recipe.nativeHash);
    assert.ok(recipe.callers.length > 0);
  }
});

test('all 100 untouched public initial scenes preserve measured paired controls and nested applicability', () => {
  assert.equal(discovery.games.length, 100); assert.equal(fixture.initialMeasurements.length, 100);
  const memory = new FieldServiceMemory();
  for (const item of fixture.initialMeasurements as R[]) {
    exact(pairedControls(item.arguments.rows), item.pairedControls, item.game);
    exact(memory.nestedQuestion(item.arguments.obs, item.arguments.rows, fixture.policy.nested_control_question), item.nestedQuestion, item.game);
  }
  assert.deepEqual(fixture.initialMeasurements.filter((item: R) => item.nestedQuestion).map((item: R) => item.game),
    ['SKBN', 'CLRS', 'SWCH', 'SEQN', 'MIND', 'KEYD', 'VALV', 'ESCT', 'FITE', 'GIGO', 'DAME']);
});

for (const item of fixture.cases as R[]) test(`original field service observation ${item.id}`, () => {
  const a = clone(item.arguments); let actual: unknown;
  switch (item.operation) {
    case 'groups': actual = fieldChangeGroups(a.before, a.after); break;
    case 'field_state': actual = fieldState(a.rows, a.field); break;
    case 'acquire_fields': actual = acquireFields(a.before, a.after, a.refs); break;
    case 'field_states': actual = fieldStates(a.rows, a.fields); break;
    case 'directions': actual = fieldDirections(a.old, a.new); break;
    case 'paired_controls': actual = pairedControls(a.rows); break;
    case 'linked_control': actual = linkedControl(a.field, a.controls); break;
    case 'current_control': actual = currentControl(a.rows, a.prior); break;
    case 'shape': actual = fieldShape(a.component); break;
    case 'same_shape': actual = sameFieldShape(a.component, a.template); break;
    case 'crop': actual = fieldCrop(a.rows, a.box); break;
    default: throw new Error('Unknown source observation operation: ' + item.operation);
  }
  exact(actual, item.expected, item.id);
});

test('every actual public return preserves changed groups, acquired fields and current paired controls', () => {
  assert.equal(fixture.packetMeasurements.length, probe.packets.length);
  const memory = new FieldServiceMemory();
  for (const item of fixture.packetMeasurements as R[]) {
    const packet = probe.packets[item.actionIndex], rows = packet.packet.frame_rows;
    exact(pairedControls(rows), item.pairedControls, String(item.actionIndex));
    exact(memory.nestedQuestion(packet.observation, rows, fixture.policy.nested_control_question), item.nestedQuestion);
    if (item.actionIndex) {
      const previous = probe.packets[item.actionIndex - 1];
      exact(fieldChangeGroups(previous.packet.frame_rows, rows), item.changes);
      exact(acquireFields(previous.packet.frame_rows, rows, [previous.observation.observation_ref, packet.observation.observation_ref]), item.acquiredFields);
    }
  }
});

test('28 source component envelopes preserve commands, point binding, 63 own acquisitions and four digest layers across three levels', async () => {
  const memory = new FieldServiceMemory(), domain = new ObservedInputDomain(4096); let cursor = 0, boundary = 0, events = 0;
  const accepted: { value: R; snapshot: R }[] = [];
  for (const envelope of fixture.commonEnvelopes as R[]) {
    const first = probe.packets[cursor]; assertState(memory, envelope.beforeState);
    const inputs = domain.candidates(first.observation);
    const p = await commonFieldServiceProposal(memory, first.observation, first.packet.frame_rows, inputs, probe.budget.levelActions - (cursor - boundary), fixture.policy);
    assert.ok(p); exact(p, envelope.unboundProposal, `prefix ${envelope.prefixIndex}`);
    assertState(memory, envelope.afterPlanningState);
    bindFieldService(p, domain); exact(p, envelope.proposal); assert.equal(p.actions.length, 1);
    for (const step of envelope.steps as R[]) {
      const a = probe.packets[cursor], b = probe.packets[cursor + 1], command = p.actions[step.index];
      exact(command, b.command);
      exact(fieldServiceBefore(p, step.index, a.packet.frame_rows, { epoch: a.observation.level_epoch, score: a.observation.levels_completed,
        observation_ref: a.observation.observation_ref, available: a.observation.available_action_refs }), step.beforeGuard);
      exact(fieldServiceAfter(p, step.index, a.packet.frame_rows, b.packet.frame_rows, { epoch: b.observation.level_epoch, score: b.observation.levels_completed, state: b.observation.state }), step.outcome);
      const acquired = memory.record(a.observation, command, b.observation, a.packet.frame_rows, b.packet.frame_rows, p, step.index);
      exact(acquired, step.ownEvents, `acquisition ${cursor + 1}`); assertState(memory, step.afterState);
      acquired.forEach(value => accepted.push({ value, snapshot: clone(value) })); events += acquired.length;
      cursor++; if (b.observation.levels_completed > a.observation.levels_completed) boundary = cursor;
    }
  }
  assert.equal(cursor, 28); assert.equal(events, 63); assertState(memory, probe.finalState);
  for (const item of accepted) exact(item.value, item.snapshot, 'Previously emitted evidence must retain its accepted value');
  const state = memory.currentState(), digest = memory.retainedDigest(probe.finalState.parentDigest);
  state.nested_events.length = 0; state.fill_context = null; state.transfer_model = null;
  assert.equal(memory.retainedDigest(probe.finalState.parentDigest), digest, 'Exported state is not mutable memory ownership');
});

for (const item of fixture.controlledCases as R[]) test(`original field service controlled contract ${item.id}`, () => {
  const memory = new FieldServiceMemory();
  for (const event of item.seedEvents) memory.applyEvent(clone(event));
  assertState(memory, item.beforeState);
  const a = clone(item.arguments); let actual: unknown;
  switch (item.operation) {
    case 'nested_question': actual = memory.nestedQuestion(a.obs, a.rows, a.cfg); break;
    case 'nested_refusal': actual = memory.nestedRefusal(a.obs, a.rows); break;
    case 'fill_question': actual = memory.fillQuestion(a.obs, a.rows, a.target, a.cfg, a.phase); break;
    case 'initialize_service': actual = memory.initializeService(a.rows); break;
    case 'bind_transfer': actual = memory.bindTransfer(a.obs, a.rows, a.config); break;
    case 'transfer_question': actual = memory.transferQuestion(a.obs, a.rows, a.target, a.ctx, a.phase, a.config); break;
    case 'propose': actual = memory.proposeService(a.obs, a.rows, a.inputs, a.max_prefix, a.config); break;
    case 'record': actual = memory.record(a.before, a.command, a.after, a.rows, a.later, a.proposal, a.index); break;
    default: throw new Error('Unknown source memory operation: ' + item.operation);
  }
  exact(actual, item.expected, item.id); assertState(memory, item.afterState);
});

for (const item of fixture.guards as R[]) test(`original field service guard ${item.id}`, () => {
  const a = clone(item.arguments);
  const actual = item.operation === 'before' ? fieldServiceBefore(a.proposal, a.index, a.rows, a.meta)
    : fieldServiceAfter(a.proposal, a.index, a.rows, a.later, a.meta);
  exact(actual, item.expected, item.id);
});

test('a visible reversal and a full-looking receiver preserve explicit uncertainty and refutation', () => {
  const actual = fixture.commonEnvelopes.flatMap((envelope: R) => envelope.steps.flatMap((step: R) => step.ownEvents)) as R[];
  const restored = actual.find(event => event.kind === 'envelope_fill_context' && event.context.restored_measured_fields);
  assert.ok(restored); assert.equal(restored.context.phase, 'service_choice_required');
  const fields = restored.context.fields as R[];
  assert.ok(fields.some(field => field.polarity_hypothesis === 'repeated_new_content'));
  assert.ok(fields.some(field => field.polarity_hypothesis === 'single_old_content'));
  for (const field of fields) {
    assert.deepEqual(field.observed_state.physical_quantity_interval, [0, null]);
    assert.equal(field.observed_state.capacity, null); assert.equal(field.observed_state.calibration, 'unknown');
    assert.equal(field.observed_state.envelope_complete, false);
  }
  const transfer = probe.prefixes[20].proposal.field_transfer_plan.transfer_context;
  assert.equal(transfer.unknown_intermediate, true); assert.equal(transfer.relay_bbox, null); assert.equal(transfer.targets.length, 3);
  const refuted = fixture.controlledCases.find((item: R) => item.id === 'record:serve_isolation_refuted');
  assert.equal(refuted.afterState.requestedStopReason, 'field_isolation_hypothesis_refuted');
  const noEffect = fixture.controlledCases.find((item: R) => item.id === 'record:nested_no_visible_effect');
  const refusal = noEffect.expected.find((event: R) => event.kind === 'nested_control_response');
  assert.equal(refusal.disposition, 'local_no_visible_effect'); assert.equal(refusal.selection_acquired, false); assert.equal(refusal.impossibility_acquired, false);
});
