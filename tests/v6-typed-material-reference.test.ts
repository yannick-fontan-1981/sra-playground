import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { measureTypedCarriers, typedReplacementCandidate, typedMaterialDescendants, typedMaterialRequests,
  typedChildPresent, typedLocalChildMark, typedSmallParts, novelTypedControls, rotatedTypedMarks,
  currentTypedMarks, outsideTypedDigest, typedControlMatches, typedMaterialDigest } from '../src/logos-engine/v6-typed-material-observation.ts';
import { TypedMaterialMemory, commonTypedMaterialProposal, bindTypedMaterial, typedMaterialBefore, typedMaterialAfter } from '../src/logos-engine/v6-typed-material-access.ts';
import { ObservedInputDomain } from '../src/logos-engine/v6-native-observer.ts';

type R = Record<string, any>;
const root = new URL('../', import.meta.url);
const compressed = async (path: string): Promise<R> => JSON.parse(gunzipSync(await readFile(new URL(path, root))).toString());
const fixture = await compressed('tests/fixtures/v6-typed-material-reference.json.gz');
const probe = await compressed(fixture.originalPublicProbe.path);
const discovery = await compressed(fixture.initialDiscovery.path);
const clone = <T>(value: T): T => structuredClone(value);
const hash = (value: string | Uint8Array): string => createHash('sha256').update(value).digest('hex');

/** Independent proof spelling, deliberately not imported from the implementation. */
function finiteCanonical(value: any): string {
  if (value === null) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'string') return JSON.stringify(value).replace(/[\u007f-\uffff]/g, c => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
  if (typeof value === 'number') { assert.ok(Number.isFinite(value)); return Object.is(value, -0) ? '-0.0' : String(value); }
  if (Array.isArray(value)) return '[' + value.map(finiteCanonical).join(',') + ']';
  assert.equal(typeof value, 'object');
  return '{' + Object.keys(value).sort().map(k => finiteCanonical(k) + ':' + finiteCanonical(value[k])).join(',') + '}';
}
const names = new Map<string, string>();
for (const recipe of fixture.identityRecipes as R[]) {
  assert.ok(!names.has(recipe.sourceHash)); names.set(recipe.sourceHash, recipe.nativeHash);
  for (const prefix of ['C_typed_carrier_', 'C_material_flow_', 'C_typed_pose_']) names.set(prefix + recipe.sourceHash.slice(0, 20), prefix + recipe.nativeHash.slice(0, 20));
  names.set('measured-material-support:' + recipe.sourceHash, 'measured-material-support:' + recipe.nativeHash);
}
const translated = (value: any): any => {
  if (typeof value === 'string') return names.get(value) ?? value;
  if (Array.isArray(value)) {
    const result = value.map(translated);
    if (result.length === 2 && result[0] === 'ambiguous_source_core_extents') result[1] = result[1].toSorted();
    return result;
  }
  if (value !== null && typeof value === 'object') {
    const result: R = Object.fromEntries(Object.entries(value).map(([k, v]) => [names.get(k) ?? k, translated(v)]));
    if (Object.hasOwn(result, 'compatible_source_occurrences')) result.compatible_source_occurrences = result.compatible_source_occurrences.toSorted();
    return result;
  }
  return value;
};
const exact = (actual: unknown, expected: unknown, message?: string): void => assert.equal(finiteCanonical(actual), finiteCanonical(expected), message);
const ownState = (memory: TypedMaterialMemory): R => { const { requested_stop_reason: _, ...state } = memory.currentState(); return state; };

function assertState(memory: TypedMaterialMemory, expected: R): void {
  exact(ownState(memory), translated(expected.projection));
  assert.equal(memory.requestedStopReason, expected.requestedStopReason);
  assert.equal(memory.retainedCarrierDigest(expected.parentDigest), translated(expected.carrierDigest));
  assert.equal(memory.retainedFlowDigest(expected.parentDigest), translated(expected.flowDigest));
  assert.equal(memory.retainedDigest(expected.parentDigest), translated(expected.digest));
}

test('typed material source provenance separates a cold component campaign from the full original caller', async () => {
  assert.equal(fixture.sourceCommit, '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e');
  assert.equal(fixture.qualification.sourceModified, false); assert.equal(fixture.qualification.gameHostRunByExporter, false);
  assert.match(fixture.qualification.numerics, /not asserted equal/);
  assert.match(fixture.qualification.identityTracing, /replaces no source function/);
  assert.equal(probe.status, 'passed'); assert.equal(probe.game, 'LIFE'); assert.equal(probe.fullOriginalCaller, false);
  assert.equal(probe.frontierEnabled, false); assert.deepEqual(probe.providerOrder, ['material_propose']);
  assert.equal(probe.sessionCount, 1); assert.equal(probe.manualPrimingActions, 0); assert.equal(probe.resets, 0); assert.equal(probe.levelJumps, 0);
  assert.equal(probe.actions, 46); assert.equal(probe.levelsCompleted, 3); assert.equal(probe.state, 'NOT_FINISHED');
  assert.deepEqual(probe.boundaries.map((b: R) => b.levelActions), [14, 14, 18]);
  assert.deepEqual(probe.requests[0], { type: 'load', code: 'LIFE', level: 1 });
  assert.ok(probe.requests.slice(1).every((r: R) => r.type === 'action'));
  assert.equal(probe.packets.length, 47); assert.equal(probe.prefixes.length, 44);
  const manifest = JSON.parse(await readFile(new URL(`reference/v6/${fixture.sourceCommit}/manifest.json`, root), 'utf8'));
  for (const item of [fixture, probe]) {
    assert.equal(item.pinnedSourceFilesVerifiedBeforeImport, Object.keys(manifest.files).length);
    for (const [path, digest] of Object.entries(item.sourceHashes)) {
      assert.equal(manifest.files[path].sha256, digest, path);
      assert.equal(hash(await readFile(new URL(`reference/v6/${fixture.sourceCommit}/source/${path}`, root))), digest, path);
    }
    assert.equal(hash(await readFile(new URL(item.generator, root))), item.generatorSha256);
  }
  for (const input of [fixture.originalPublicProbe, fixture.initialDiscovery]) assert.equal(hash(await readFile(new URL(input.path, root))), input.sha256);
  assert.deepEqual(fixture.sourceAliasing, []);
});

test('all observed source identities and native finite identities are recomputed before references are related', () => {
  let renamed = 0, signed = 0;
  for (const recipe of fixture.identityRecipes as R[]) {
    assert.equal(hash(recipe.sourceCanonical), recipe.sourceHash);
    exact(JSON.parse(recipe.sourceCanonical), recipe.value);
    const projected = translated(recipe.nativeValueTemplate);
    assert.equal(finiteCanonical(projected), recipe.nativeCanonical);
    assert.equal(hash(recipe.nativeCanonical), recipe.nativeHash);
    assert.equal(typedMaterialDigest(projected), recipe.nativeHash);
    if (recipe.sourceHash !== recipe.nativeHash) renamed++;
    if (recipe.nativeCanonical.includes('-0.0')) signed++;
  }
  assert.ok(renamed > 0, 'The Python float/int identity difference must remain explicit');
  assert.ok(signed > 0, 'Signed-zero pose expectations must remain in their actual hash inputs');
});

test('all 100 untouched public initial scenes preserve numeric carrier applicability and measurements', () => {
  assert.equal(discovery.games.length, 100); assert.equal(fixture.initialMeasurements.length, 100);
  for (const item of fixture.initialMeasurements as R[]) exact(measureTypedCarriers(item.arguments.rows, item.arguments.obs, item.arguments.config), translated(item.expected), item.game);
  assert.deepEqual(fixture.initialMeasurements.filter((item: R) => item.expected).map((item: R) => item.game), ['LIFE']);
});

for (const item of fixture.cases as R[]) test(`original typed material observation ${item.id}`, () => {
  const a = translated(item.arguments); let actual: unknown;
  switch (item.operation) {
    case 'measure': actual = measureTypedCarriers(a.rows, a.obs, a.config); break;
    case 'replacement': actual = typedReplacementCandidate(a.before_scene, a.later, a.after, a.config); break;
    case 'descendants': actual = typedMaterialDescendants(a.context, a.before, a.later, a.obs); break;
    case 'requests': actual = typedMaterialRequests(a.rows, a.obs, a.known_shapes); break;
    case 'child_present': actual = typedChildPresent(a.child, a.rows); break;
    case 'local_child_mark': actual = typedLocalChildMark(a.child, a.first, a.later); break;
    case 'rotated': actual = rotatedTypedMarks(a.marks, a.turns); break;
    case 'current_marks': actual = currentTypedMarks(a.child, a.rows); break;
    case 'outside_digest': actual = outsideTypedDigest(a.rows, ...a.boxes); break;
    case 'control_matches': actual = typedControlMatches(a.control, a.rows, a.epoch); break;
    case 'novel_controls': actual = novelTypedControls(a.old, a.rows, a.obs, a.cfg); break;
    default: throw new Error('Unknown source operation: ' + item.operation);
  }
  exact(actual, translated(item.nativeValueTemplate), item.id);
});

test('every actual source public packet preserves current carriers, request shapes and small-control measurements', () => {
  assert.equal(fixture.packetMeasurements.length, probe.packets.length);
  for (const item of fixture.packetMeasurements as R[]) {
    const p = probe.packets[item.actionIndex];
    exact(measureTypedCarriers(p.packet.frame_rows, p.observation, fixture.policy), translated(item.scene), String(item.actionIndex));
    exact(typedMaterialRequests(p.packet.frame_rows, p.observation), translated(item.requests), String(item.actionIndex));
    exact(typedSmallParts(p.packet.frame_rows), translated(item.smallParts), String(item.actionIndex));
  }
});

test('44 original component prefixes preserve actual commands, numeric pose expectations and all own acquisitions across three levels', async () => {
  const memory = new TypedMaterialMemory(), domain = new ObservedInputDomain(4096); let cursor = 0, boundary = 0, events = 0, conditional = 0;
  for (const envelope of fixture.commonEnvelopes as R[]) {
    const first = probe.packets[cursor]; assertState(memory, envelope.beforeState);
    const inputs = domain.candidates(first.observation);
    const p = await commonTypedMaterialProposal(memory, first.observation, first.packet.frame_rows, inputs, probe.budget.levelActions - (cursor - boundary), fixture.policy);
    assert.ok(p); exact(p, translated(envelope.nativeUnboundTemplate), `prefix ${envelope.prefixIndex}`);
    assertState(memory, envelope.afterPlanningState);
    bindTypedMaterial(p, domain); exact(p, translated(envelope.nativeProposalTemplate));
    conditional += Number(p.actions.length > 1);
    for (const step of envelope.steps as R[]) {
      const a = probe.packets[cursor], b = probe.packets[cursor + 1], action = p.actions[step.index];
      assert.deepEqual(action, b.command);
      exact(typedMaterialBefore(p, step.index, a.packet.frame_rows, { epoch: a.observation.level_epoch, score: a.observation.levels_completed, observation_ref: a.observation.observation_ref, available: a.observation.available_action_refs }), step.beforeGuard);
      exact(typedMaterialAfter(p, step.index, a.packet.frame_rows, b.packet.frame_rows, { epoch: b.observation.level_epoch, score: b.observation.levels_completed, state: b.observation.state }), step.outcome);
      const acquired = memory.record(a.observation, action, b.observation, a.packet.frame_rows, b.packet.frame_rows, p, step.index);
      exact(acquired, translated(step.ownEvents), `acquisition ${cursor + 1}`); assertState(memory, step.afterState); events += acquired.length;
      cursor++; if (b.observation.levels_completed > a.observation.levels_completed) boundary = cursor;
    }
  }
  assert.equal(cursor, 46); assert.equal(conditional, 1);
  assert.equal(events, fixture.commonEnvelopes.reduce((n: number, e: R) => n + e.steps.reduce((s: number, t: R) => s + t.ownEvents.length, 0), 0));
});

for (const item of fixture.guards as R[]) test(`original typed material guard ${item.id}`, () => {
  const a = translated(item.arguments);
  const actual = item.operation === 'before' ? typedMaterialBefore(a.proposal, a.index, a.rows, a.meta) : typedMaterialAfter(a.proposal, a.index, a.rows, a.later, a.meta);
  exact(actual, item.expected);
});

test('three material layers reconstruct exclusively from acquired events and return independent state copies', () => {
  const memory = new TypedMaterialMemory();
  for (const e of fixture.commonEnvelopes as R[]) for (const s of e.steps as R[]) for (const original of s.ownEvents as R[]) memory.applyEvent(translated(original));
  assertState(memory, probe.finalState);
  const first = memory.currentState(), snapshot = clone(first);
  first.carrier_events.length = 0; first.flow_models = {}; first.pose_events.length = 0;
  exact(memory.currentState(), snapshot);
  assert.throws(() => memory.applyEvent({ kind: 'unrelated_state', value: 1 }), /Outside typed material/);
});

test('source distinctions retain unknown material effects, ambiguous lineage and refutable conditional pose expectations', () => {
  const byId = new Map<string, R>(fixture.cases.map((c: R) => [c.id, c]));
  assert.equal(byId.get('measure:one_support')!.expected, null);
  assert.equal(byId.get('measure:no_shared_mark_palette')!.expected, null);
  assert.deepEqual(byId.get('descendants:no_new_pixels')!.expected, []);
  const lineage = byId.get('descendants:ambiguous_lineage_preserved')!.expected;
  assert.ok(lineage.length > 0); assert.ok(lineage.every((c: R) => c.source_occurrence === null && c.compatible_source_occurrences.length === 2));
  assert.equal(byId.get('local_child_mark:remote_change')!.expected, false);
  const guard = fixture.guards.find((g: R) => g.id === 'after:42:0:unchanged');
  assert.equal(guard.expected.matched, false); assert.equal(guard.expected.seal_prefix, true);
  const source = probe.prefixes[42].proposal.material_pose_plan;
  assert.equal(source.rule.status, 'conditional_observed_pose_change'); assert.equal(source.actions.length, 3);
});

for (const contract of fixture.hashTieContracts as R[]) test(`declared native lexical identity boundary ${contract.id}`, async () => {
  const memory = new TypedMaterialMemory();
  for (const event of contract.events as R[]) memory.applyEvent(translated(event));
  let p: R | null;
  if (contract.operation === 'common_carrier') p = await commonTypedMaterialProposal(memory, contract.obs, contract.rows, [], contract.remaining, contract.configuration);
  else p = memory.poseQuestion(contract.obs, contract.rows, contract.configuration, translated(contract.child), contract.mode);
  assert.ok(p);
  assert.notEqual(contract.sourceChosenKey, contract.nativeChosenSourceKey, 'The contract must expose an actual lexical inversion');
  assert.equal(translated(contract.nativeChosenSourceKey), contract.nativeChosenKey);
  if (contract.operation === 'common_carrier') {
    const signatures = (contract.candidates as R[]).map(c => translated(c.signature)).sort();
    assert.equal(p.typed_carrier_plan.selected.signature, signatures[0]);
    assert.equal(p.typed_carrier_plan.selected.signature, contract.nativeChosenKey);
    assert.equal(contract.sourceProposal.typed_carrier_plan.selected.signature, contract.sourceChosenKey);
    const expected = translated((contract.candidates as R[]).find(c => c.signature === contract.nativeChosenSourceKey));
    exact(p.typed_carrier_plan.selected, expected);
  } else {
    const options = (contract.candidates as R[]).map(translated).sort((a, b) => a.turns - b.turns || (a.model_ref < b.model_ref ? -1 : a.model_ref > b.model_ref ? 1 : 0));
    assert.equal(p.material_pose_plan.option.model_ref, contract.nativeChosenKey);
    exact(p.material_pose_plan.option, options[0]);
    assert.equal(contract.sourceProposal.material_pose_plan.option.model_ref, contract.sourceChosenKey);
  }
});
