#!/usr/bin/env node
/** Cold common-selector contracts on explicitly synthetic public returns.
 * No production priority, initial knowledge, game engine or selected action is
 * supplied. The response table is exported from independent original Python.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { gunzipSync, gzipSync } from 'node:zlib';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [outputArgument, manifestArgument, ...extra] = process.argv.slice(2);
assert.ok(outputArgument && manifestArgument && extra.length === 0,
  'Usage: prove-linked-temporal-common-loop.mjs OUTPUT.json[.gz] SOURCE-MANIFEST.json');
const output = resolve(ROOT, outputArgument), manifestPath = resolve(ROOT, manifestArgument);
const FIXTURE = 'tests/fixtures/v6-linked-preparation-reference.json.gz';
const EXPORT = 'docs/migration/lot5a-evidence/diagnostic/source-oracle-export.json';
const REFERENCE = 'reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e';
const DECLARATIONS = [`${REFERENCE}/source/agents/yf_arc3_v6/laya_proto/common_frontier_policy.drm.json`,
  `${REFERENCE}/source/agents/yf_arc3_v6/morphology_policy/strategy.drm`];
const OWNER = 'linked_temporal_preparation', STATE_ID = `family_state:${OWNER}`;
const copy = value => structuredClone(value), hash = value => createHash('sha256').update(value).digest('hex');
const checks = [], verified = name => checks.push(name);
async function receipt(name) {
  const path = resolve(ROOT, name), bytes = await readFile(path);
  return { path: relative(ROOT, path), bytes: bytes.length, sha256: hash(bytes) };
}
async function json(name) {
  const bytes = await readFile(resolve(ROOT, name));
  return JSON.parse(name.endsWith('.gz') ? gunzipSync(bytes).toString() : bytes.toString());
}
async function inventory() {
  const files = {}, paths = [];
  async function walk(directory) {
    for (const item of await readdir(directory, { withFileTypes: true })) {
      const path = resolve(directory, item.name);
      if (item.isDirectory()) await walk(path);
      else if (item.isFile() && /\.(ts|json|drm)$/.test(item.name)) paths.push(relative(ROOT, path));
    }
  }
  await Promise.all(['src/logos-engine', 'src/runtime'].map(name => walk(resolve(ROOT, name))));
  for (const name of paths.sort()) files[name] = hash(await readFile(resolve(ROOT, name)));
  return { fileCount: paths.length, digest: hash(JSON.stringify(files)), files };
}
const [manifest, beforeInventory, fixture, exported, originalManifest] = await Promise.all([
  json(manifestPath), inventory(), json(FIXTURE), json(EXPORT), json(`${REFERENCE}/manifest.json`),
]);
assert.deepEqual(beforeInventory, manifest);
assert.equal(fixture.schema, 'logos-engine.v6.linked-preparation-reference.v1');
assert.equal(fixture.referenceCommit, '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e');
assert.equal(exported.schema, 'logos-engine.independent-python-oracle-export.v1');
assert.equal(exported.status, 'passed'); assert.equal(exported.referenceCommit, fixture.referenceCommit);
assert.equal(exported.sourceInventoryUnchanged, true);
assert.equal(exported.sourceInventorySha256Before, exported.sourceInventorySha256After);
assert.equal(exported.sourceFilesVerifiedBefore, Object.keys(originalManifest.files).length);
assert.equal(exported.sourceFilesVerifiedAfter, exported.sourceFilesVerifiedBefore);
assert.deepEqual(exported.directModules, fixture.sourceModules);
assert.equal(exported.fixture.path, FIXTURE);
assert.deepEqual(await receipt(FIXTURE), { path: exported.fixture.path, bytes: exported.fixture.bytes, sha256: exported.fixture.sha256 });
assert.equal(gunzipSync(await readFile(resolve(ROOT, FIXTURE))).byteLength, exported.fixture.uncompressedBytes);
assert.equal(exported.exporter.path, 'scripts/export-v6-linked-preparation-reference.py');
assert.deepEqual(await receipt(exported.exporter.path), exported.exporter);
assert.equal(exported.sourceManifest.path, `${REFERENCE}/manifest.json`);
assert.equal((await receipt(exported.sourceManifest.path)).sha256, exported.sourceManifest.sha256);
const originalPaths = [];
for (const [name, expected] of Object.entries(exported.importedOriginalModules)) {
  assert.ok(expected.path.startsWith(`${REFERENCE}/source/agents/yf_arc3_v6/`), name);
  const sourceName = expected.path.slice(`${REFERENCE}/source/`.length);
  assert.equal(originalManifest.files[sourceName]?.sha256, expected.sha256, name);
  assert.equal((await receipt(expected.path)).sha256, expected.sha256, name);
  originalPaths.push(expected.path);
}
for (const name of fixture.sourceModules) {
  const expected = exported.importedOriginalModules[name], unchanged = exported.directSourceBeforeAfter[name];
  assert.ok(expected && unchanged, 'Missing original source receipt: ' + name);
  assert.deepEqual(unchanged, { path: expected.path, sha256Before: expected.sha256, sha256After: expected.sha256 });
}
for (const path of DECLARATIONS) {
  assert.equal((await receipt(path)).sha256, originalManifest.files[path.slice(`${REFERENCE}/source/`.length)]?.sha256, path);
}
const inputs = [...new Set([fileURLToPath(import.meta.url), manifestPath, FIXTURE, EXPORT,
  exported.exporter.path, exported.sourceManifest.path, ...DECLARATIONS, ...originalPaths].map(name => resolve(ROOT, name)))].sort();
const inputsBefore = await Promise.all(inputs.map(receipt));
verified('native_inventory_matches_declared_freeze');
verified('oracle_fixture_exporter_and_consumed_originals_match_export_receipt_and_pinned_manifest');
const declarations = { common: await json(DECLARATIONS[0]), strategy: await json(DECLARATIONS[1]) };
const declarationsBefore = copy(declarations);
const [{ createNativeV6Runtime }, { LinkedTemporalPreparation, LINKED_TEMPORAL_NATIVE_SEARCH_BOUNDS },
  { hydrateNativeState }, { measureNativeObservation }] = await Promise.all([
  import('../src/logos-engine/v6-native-runtime.ts'), import('../src/logos-engine/v6-linked-temporal-preparation.ts'),
  import('../src/logos-engine/v6-native-state-graph.ts'), import('../src/logos-engine/v6-native-observer.ts'),
]);
const execution = { yieldControl: async () => {}, now: () => 0, deadlineMs: 360_000 };
const budgets = { targetLevels: 1, levelActionCaps: [48], maxActions: 48 };
function readGraph(graph, id) {
  assert.ok(graph.nodes[id], 'Missing authoritative node ' + id);
  return hydrateNativeState(graph.nodes[id].value, key => {
    assert.ok(graph.nodes[key], 'Missing authoritative fragment ' + key);
    return graph.nodes[key].value;
  });
}
function packet(observation, rows, step) {
  return { frame_rows: copy(rows), frame_packet: [copy(rows)], level: observation.level_epoch,
    levels_completed: observation.levels_completed, state: observation.state, frame_hash: observation.frame_hash,
    available_action_refs: copy(observation.available_action_refs), step_index: step };
}
function publicState(value) {
  return { frame_rows: value.frame_rows, level: value.level, levels_completed: value.levels_completed,
    state: value.state, frame_hash: value.frame_hash, available_action_refs: value.available_action_refs };
}
// Plain native controls may include data: {} whereas original source commands
// omit it. Normalize only that empty payload for the declared public table.
// The command passed back to advance() is always the exact released command.
function publicCommand(value) {
  return { action_ref: value.action_ref, ...(value.data && Object.keys(value.data).length ? { data: value.data } : {}) };
}
function publicReturn(table, currentPacket, command, step) {
  const matches = table.filter(row => isDeepStrictEqual(row.before, publicState(currentPacket))
    && isDeepStrictEqual(row.command, publicCommand(command)));
  assert.ok(matches.length <= 1, 'Synthetic public response table must be deterministic');
  const row = matches[0];
  return row ? { sourceStage: row.sourceStage, packet: { ...copy(row.after), step_index: step } }
    : { sourceStage: null, packet: { ...copy(currentPacket), step_index: step, frame_packet: [copy(currentPacket.frame_rows)] } };
}
function decision(proposal) {
  return proposal ? { status: proposal.status, kind: proposal.kind, actions: copy(proposal.actions),
    mode: proposal.phase_plan?.mode ?? null, site: proposal.phase_plan?.site ?? null,
    remotePixels: copy(proposal.phase_plan?.remote_pixels ?? []),
    steps: proposal.steps.map(step => ({ from: step.from, to: step.to, destination_before: step.destination_before })) }
    : { status: 'no_own_proposal' };
}
function released(result) {
  assert.equal(result.kind, 'action', String(result.reason)); assert.ok(result.authorization);
  assert.equal(result.snapshot.whyAct.enabled, true);
  assert.equal(result.snapshot.whyAct.decision.decision.status, 'action_set_released');
  const before = result.snapshot.trace.findLast(item => item.kind === 'before_guard');
  assert.ok(before); assert.equal(before.family, result.snapshot.lastDecision);
  assert.equal(before.index, result.authorization.action_index);
  assert.equal(result.authorization.action_index, result.snapshot.prefix.nextIndex);
  assert.equal(result.authorization.decision_revision, result.snapshot.prefix.revision);
  assert.deepEqual(result.command, result.snapshot.proposal.actions[result.authorization.action_index]);
  assert.equal(before.admitted, true); assert.equal(before.point_bound, true);
  assert.ok(result.snapshot.trace.some(item => item.kind === 'why_act_release' && item.native_gate && item.admitted
    && item.decision_revision === result.authorization.decision_revision));
}

async function branch(id) {
  const source = fixture.chains.find(item => item.id === id); assert.ok(source);
  const records = source.operations.filter(item => item.method === 'record');
  assert.equal(records.length, 6);
  assert.equal(source.operations[8].method, 'propose'); assert.equal(source.operations[15].method, 'propose');
  assert.ok(!source.operations.some(item => Object.hasOwn(item, 'exception')));
  const ownExpected = source.operations[8].result, nextExpected = source.operations[15].result;
  assert.equal(ownExpected.actions.length, 2);
  const responseTable = records.map(({ input }, sourceStage) => ({ sourceStage,
    before: publicState(packet(input.before, input.first, 0)), command: publicCommand(input.command),
    after: packet(input.after, input.second, 0) }));
  const runtime = await createNativeV6Runtime(declarations, { now: () => 0 });
  const owners = runtime.families.filter(family => family.id === OWNER); assert.equal(owners.length, 1);
  const family = owners[0], cold = copy(family.state());
  assert.deepEqual(cold.phase.states, []); assert.deepEqual(cold.phase.commands, []); assert.deepEqual(cold.events, []);
  assert.equal(cold.phase.linked_contact.body, null);
  const sessionId = 'synthetic-linked-temporal-' + id;
  let currentPacket = packet(records[0].input.before, records[0].input.first, 0);
  let current = await runtime.initialize({ sessionId, observation: copy(currentPacket), budgets: copy(budgets) }, execution);
  let stage = 0, returned = 0, ownReturns = 0, ownPrefixRevision = null;
  const history = [], invalidReturns = [], actualReturns = [];
  const initialObservation = await measureNativeObservation(currentPacket, 1, sessionId);
  const sourceGroups = current.snapshot.coverage.sourceGroups;
  const surface = sourceGroups.find(group => group.id === 'surface');
  assert.ok(surface);
  const configuration = declarations.strategy.declarations[0].configuration;
  assert.deepEqual(sourceGroups.map(group => group.id), configuration.families);
  const registeredIds = new Set(runtime.families.map(item => item.id));
  const sourceAliases = { surface_rewrite: 'surface_program', learned_code_program: 'code_program' };
  const declaredSurface = configuration.program_construction.ordered_subquestions.map(name => sourceAliases[name] ?? name)
    .filter(name => registeredIds.has(name));
  assert.deepEqual(surface.families, declaredSurface);
  assert.equal(surface.families.filter(name => name === OWNER).length, 1);
  verified(id + ':cold_shared_owner_registered_once_in_original_surface_order');
  let lastRetained = null, lastObservation = null;
  while (stage < records.length && returned < budgets.maxActions) {
    released(current);
    const proposed = current.snapshot.proposal, selectedOwn = proposed.program_subquestion === OWNER;
    const transition = records[stage].input;
    assert.deepEqual(publicState(currentPacket), publicState(packet(transition.before, transition.first, 0)));
    // Lookup depends only on declared public state and command. A different
    // selected owner issuing the same command receives the very same pixels.
    const response = publicReturn(responseTable, currentPacket, current.command, returned + 1);
    const matches = response.sourceStage === stage;
    assert.ok(response.sourceStage === null || matches, 'Public response must follow the contiguous source table');
    if (stage < 4) assert.ok(matches, 'The single publicly available calibration control must be selected');
    if (selectedOwn && stage >= 4) {
      assert.ok(matches, 'Own selected key path must match the independent source action');
      if (stage === 4) {
        assert.deepEqual(decision(proposed), decision(ownExpected));
        ownPrefixRevision = current.snapshot.prefix.revision;
        assert.equal(current.snapshot.prefix.planned, 2);
      } else assert.equal(current.snapshot.prefix.revision, ownPrefixRevision, 'Second key is the same retained prefix');
    }
    // A finite, declared synthetic response table. Inputs not represented at
    // this public state return unchanged pixels; no selected action is replaced.
    const advances = matches, nextPacket = response.packet;
    if (stage === 4 && selectedOwn) {
      const graph = runtime.inspectKnowledge(), snapshot = runtime.snapshot(), ownerBefore = copy(family.state());
      await assert.rejects(runtime.advance({ command: { action_ref: 'ACTION6', data: { x: 0, y: 0 } }, observation: copy(nextPacket), executionMs: 0 }, execution));
      assert.equal(runtime.inspectKnowledge(), graph); assert.deepEqual(runtime.snapshot(), snapshot); assert.deepEqual(family.state(), ownerBefore);
      invalidReturns.push({ type: 'substituted_command', graphSessionAndOwnerUnchanged: true });
    }
    const beforeResult = current;
    current = await runtime.advance({ command: copy(current.command), observation: copy(nextPacket), executionMs: 0 }, execution);
    returned++; if (selectedOwn) ownReturns++;
    if (advances) stage++;
    lastObservation = await measureNativeObservation(nextPacket, nextPacket.step_index + 1, sessionId);
    actualReturns.push({ decisionRevision: beforeResult.authorization.decision_revision,
      command: copy(beforeResult.command), before: beforeResult.authorization.observation_ref,
      after: lastObservation.observation_ref, rows: copy(nextPacket.frame_rows) });
    const item = { returned, sourceStage: stage, selectedOwn, advancesSyntheticTable: advances,
      released: beforeResult, actualPublicReturn: nextPacket, response: current };
    if (current.kind === 'boundary') {
      const graph = runtime.inspectKnowledge(); lastRetained = readGraph(graph, STATE_ID);
      assert.deepEqual(lastRetained, family.nativeState());
      const restored = new LinkedTemporalPreparation(declarations.common.linked_contact,
        { boundedSearch: LINKED_TEMPORAL_NATIVE_SEARCH_BOUNDS });
      restored.restoreNative(copy(lastRetained)); assert.deepEqual(restored.state(), lastRetained);
      assert.equal(current.snapshot.caller.acquiredTransitions, returned);
      assert.deepEqual(lastRetained.phase.commands, actualReturns.map(item => Object.keys(item.command.data ?? {}).length ? null : item.command.action_ref));
      assert.deepEqual(lastRetained.phase.states.map(state => state.ref), [initialObservation.observation_ref, ...actualReturns.map(item => item.after)]);
      assert.deepEqual(lastRetained.phase.states.map(state => state.rows), [records[0].input.first, ...actualReturns.map(item => item.rows)]);
      const prefixId = `prefix_evidence:${current.snapshot.prefix.revision}`;
      const prefix = readGraph(graph, prefixId);
      assert.equal(prefix.decision_revision, current.snapshot.prefix.revision);
      assert.deepEqual(prefix.transitions.map(({ command, before, after }) => ({ command, before, after })),
        actualReturns.filter(row => row.decisionRevision === prefix.decision_revision).map(({ command, before, after }) => ({ command, before, after })));
      item.checkpoint = { graphChain: graph.chain, state: lastRetained, prefixId, prefix };
      current = await runtime.resume(execution);
    } else if (stage === 5 && selectedOwn) {
      assert.equal(current.kind, 'action');
      assert.equal(current.snapshot.prefix.nextIndex, 1);
      assert.equal(current.snapshot.caller.acquiredTransitions, returned - 1,
        'Open path returns are acquired only once when its prefix seals');
    }
    history.push(item); currentPacket = nextPacket;
    console.log(JSON.stringify({ branch: id, stage, returned, ownReturns, next: current.kind, family: current.snapshot.lastDecision }));
  }
  assert.equal(stage, 6, 'Common selector must actually execute the complete source path');
  assert.equal(ownReturns, 2, 'LinkedPreparation must contribute both commands without owner-dependent public responses');
  assert.ok(ownPrefixRevision !== null); assert.ok(lastRetained); assert.ok(lastObservation);
  assert.equal(lastRetained.phase.commands.length, returned);
  assert.equal(lastRetained.phase.linked_contact.seen, returned);
  const restored = new LinkedTemporalPreparation(declarations.common.linked_contact,
    { boundedSearch: LINKED_TEMPORAL_NATIVE_SEARCH_BOUNDS });
  restored.restoreNative(copy(lastRetained));
  const controls = currentPacket.available_action_refs.map(action_ref => ({ action_ref }));
  const ownNext = restored.propose(lastObservation, currentPacket.frame_rows, controls, 48 - returned, execution);
  assert.deepEqual(decision(ownNext), decision(nextExpected));
  if (nextExpected) {
    released(current); assert.equal(current.snapshot.proposal.program_subquestion, OWNER);
    assert.deepEqual(decision(current.snapshot.proposal), decision(ownNext));
  } else assert.notEqual(current.snapshot.proposal?.program_subquestion, OWNER);
  const contacts = lastRetained.events.filter(event => event.kind === 'linked_contact_effect');
  assert.equal(contacts.length, 1); assert.equal(contacts[0].pixels.length, nextExpected ? 9 : 0);
  verified(id + ':actual_public_calibration_is_acquired_passively_once');
  verified(id + ':two_step_key_path_is_selected_and_released_by_full_why_act');
  verified(id + ':intermediate_guard_preserves_prefix_and_defers_one_acquisition_batch');
  verified(id + ':kernel_checkpoint_restores_one_owner_and_all_actual_returns_in_order');
  verified(id + ':retained_remote_result_changes_the_next_common_decision');
  runtime.close('controlled_linked_temporal_proof_complete');
  return { id, synthetic: true, initialOwner: cold, sourceChain: id, returned, ownReturns,
    history, invalidReturns, retained: lastRetained, nextOwnDecision: decision(ownNext), nextCommon: current,
    qualification: 'Cold complete native caller with original priorities and full native authority. Public availability supplies one calibration control at each initial state, then all five plain inputs. The finite synthetic response table is keyed only by public pixels, protocol fields and command, independently of the selected owner. Source-exported public pixels supply no learned memory, proposal, action choice or game result. This direct-runtime proof does not exercise browser transport, Pause or wall-time deadlines; it checks the selected two-key contract and native checkpoints, not universal V6 parity or gameplay success.' };
}

const branches = [];
for (const id of ['learned-multi-action-access', 'learned-path-no-remote-effect']) branches.push(await branch(id));
assert.deepEqual(declarations, declarationsBefore);
const [afterInventory, inputsAfter] = await Promise.all([inventory(), Promise.all(inputs.map(receipt))]);
assert.deepEqual(afterInventory, beforeInventory); assert.deepEqual(inputsAfter, inputsBefore);
verified('native_source_and_proof_inputs_unchanged'); verified('source_declarations_unchanged');
const report = { schema: 'logos-engine.linked-temporal-common-loop.v1', status: 'passed',
  nativeSource: { fileCount: manifest.fileCount, digest: manifest.digest }, sourceUnchangedDuringRun: true,
  executionInputs: inputsBefore, executionInputsUnchangedDuringRun: true, sourceDeclarationsModified: false,
  checks: { passed: checks.length, failed: 0, names: checks }, branches,
  clock: { nowMs: 0, executionMs: 0, qualification: 'Deterministic logical-contract clocks; this is not a latency benchmark or a game campaign.' } };
await mkdir(dirname(output), { recursive: true });
const data = JSON.stringify(report) + '\n';
await writeFile(output, output.endsWith('.gz') ? gzipSync(data, { mtime: 0 }) : data, { flag: 'wx' });
console.log(JSON.stringify({ status: report.status, checks: report.checks.passed, branches: branches.length,
  returned: branches.reduce((n, item) => n + item.returned, 0), ownReturns: branches.reduce((n, item) => n + item.ownReturns, 0) }));
