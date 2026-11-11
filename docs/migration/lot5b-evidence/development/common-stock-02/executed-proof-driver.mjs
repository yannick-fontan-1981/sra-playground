#!/usr/bin/env node
/** Full, cold native caller on an independently exported synthetic public table.
 * The public return is a function only of the current packet and released
 * command. No owner, learned state, selected action or production priority is
 * supplied to the runtime. The original Python replays the actual operation
 * journal separately; native expected results never become oracle inputs.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { gunzipSync, gzipSync } from 'node:zlib';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [outputArgument, manifestArgument, chainId, mode = 'positive', ...extra] = process.argv.slice(2);
assert.ok(outputArgument && manifestArgument && chainId && !extra.length && ['positive', 'navigation-no-effect'].includes(mode),
  'Usage: prove-addressed-material-common-loop.mjs OUTPUT-DIRECTORY SOURCE-MANIFEST.json CHAIN-ID [positive|navigation-no-effect]');
const output = resolve(ROOT, outputArgument), manifestPath = resolve(ROOT, manifestArgument);
const FIXTURE = 'tests/fixtures/v6-addressed-material-reference.json.gz';
const EXPORT = 'docs/migration/lot5b-evidence/diagnostic/source-oracle-export.json';
const REFERENCE = 'reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e';
const DECLARATIONS = [`${REFERENCE}/source/agents/yf_arc3_v6/laya_proto/common_frontier_policy.drm.json`,
  `${REFERENCE}/source/agents/yf_arc3_v6/morphology_policy/strategy.drm`];
const OWNER = 'public_addressed_material', ENTRY = 'observed_addressed_material', STATE_ID = `family_state:${OWNER}`;
const copy = value => structuredClone(value), hash = value => createHash('sha256').update(value).digest('hex');
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
assert.equal(fixture.schema, 'logos-engine.v6.addressed-material-reference.v1');
assert.equal(fixture.referenceCommit, '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e');
assert.equal(exported.status, 'passed'); assert.equal(exported.sourceInventoryUnchanged, true);
assert.equal(exported.sourceInventorySha256Before, exported.sourceInventorySha256After);
assert.equal(exported.sourceFilesVerifiedBefore, Object.keys(originalManifest.files).length);
assert.equal(exported.sourceFilesVerifiedAfter, exported.sourceFilesVerifiedBefore);
assert.deepEqual(await receipt(FIXTURE), { path: exported.fixture.path, bytes: exported.fixture.bytes, sha256: exported.fixture.sha256 });
assert.deepEqual(await receipt(exported.exporter.path), exported.exporter);
const originalPaths = [];
for (const [name, expected] of Object.entries(exported.importedOriginalModules)) {
  assert.ok(expected.path.startsWith(`${REFERENCE}/source/agents/yf_arc3_v6/`), name);
  const sourceName = expected.path.slice(`${REFERENCE}/source/`.length);
  assert.equal(originalManifest.files[sourceName]?.sha256, expected.sha256, name);
  assert.equal((await receipt(expected.path)).sha256, expected.sha256, name);
  originalPaths.push(expected.path);
}
const inputs = [...new Set([fileURLToPath(import.meta.url), manifestPath, FIXTURE, EXPORT,
  exported.exporter.path, `${REFERENCE}/manifest.json`, ...DECLARATIONS, ...originalPaths].map(name => resolve(ROOT, name)))].sort();
const inputsBefore = await Promise.all(inputs.map(receipt));
const declarations = { common: await json(DECLARATIONS[0]), strategy: await json(DECLARATIONS[1]) }, declarationsBefore = copy(declarations);
const [{ createNativeV6Runtime }, { AddressedMaterial, ADDRESSED_NATIVE_SEARCH_BOUNDS }, { hydrateNativeState, isNativeStateGraph },
  { decodeNativeState }, { symbolicDigest }] = await Promise.all([
  import('../src/logos-engine/v6-native-runtime.ts'), import('../src/logos-engine/v6-addressed-material.ts'),
  import('../src/logos-engine/v6-native-state-graph.ts'), import('../src/logos-engine/v6-knowledge-store.ts'),
  import('../src/logos-engine/v6-hash.ts'),
]);
const execution = { yieldControl: async () => {}, now: () => 0, deadlineMs: 360_000 };
const budgets = { targetLevels: 3, levelActionCaps: [64, 64, 64], maxActions: 128 };
function retained(runtime, id) {
  const graph = runtime.inspectKnowledge(); assert.ok(graph.nodes[id], 'Missing authoritative node ' + id);
  const raw = graph.nodes[id].value;
  return isNativeStateGraph(raw) ? hydrateNativeState(raw, key => graph.nodes[key].value) : decodeNativeState(raw);
}
function packet(obs, rows, step, frames = null) {
  // The component oracle admits opaque frame identifiers. The complete native
  // public transport uses SHA-256 of canonical JSON rows, truncated to 16 hex
  // characters. Derive that identifier from these actual public pixels; do not
  // feed the component fixture's separate raw-byte hash into the public host.
  return { frame_rows: copy(rows), frame_packet: copy(frames ?? [rows]), level: obs.level_epoch,
    levels_completed: obs.levels_completed, state: obs.state, frame_hash: symbolicDigest(rows).slice(0, 16),
    available_action_refs: copy(obs.available_action_refs), step_index: step };
}
function publicState(p) {
  return { frame_rows: p.frame_rows, level: p.level, levels_completed: p.levels_completed, state: p.state,
    frame_hash: p.frame_hash, available_action_refs: p.available_action_refs };
}
function command(c) { return { action_ref: c.action_ref, ...(c.data && Object.keys(c.data).length ? { data: c.data } : {}) }; }
function released(r) {
  assert.equal(r.kind, 'action', String(r.reason)); assert.ok(r.authorization);
  assert.equal(r.snapshot.whyAct.enabled, true); assert.equal(r.snapshot.whyAct.decision.decision.status, 'action_set_released');
  const guard = r.snapshot.trace.findLast(item => item.kind === 'before_guard');
  assert.ok(guard); assert.equal(guard.family, r.snapshot.lastDecision); assert.equal(guard.index, r.authorization.action_index);
  assert.equal(r.authorization.action_index, r.snapshot.prefix.nextIndex);
  assert.equal(r.authorization.decision_revision, r.snapshot.prefix.revision);
  assert.deepEqual(r.command, r.snapshot.proposal.actions[r.authorization.action_index]);
  assert.equal(guard.admitted, true); assert.equal(guard.point_bound, true);
}
function instrument(owner, operations, restores) {
  const specifications = {
    propose: args => ({ method: 'propose', input: { observation: args[0], rows: args[1], inputs: args[2], remaining: args[3] } }),
    preservationObligations: args => ({ method: 'preservation_obligations', input: { observation: args[0], rows: args[1] } }),
    bind: () => ({ method: 'bind', input: {}, useLatestSourceProposal: true }),
    before: args => ({ method: 'before', input: { index: args[1], public: args[2], observation: args[3] }, useLatestSourceProposal: true }),
    after: args => ({ method: 'after', input: { index: args[1], before: args[2], after: args[3], first: args[4], second: args[5] }, useLatestSourceProposal: true }),
    recordSource: args => ({ method: 'record', input: { before: args[0], after: args[1], command: args[2], first: args[3], second: args[4],
      index: args[6] ?? null, frames: args[7] ?? null }, ...(args[5] != null ? { useLatestSourceProposal: true } : {}) }),
  };
  for (const [name, project] of Object.entries(specifications)) {
    const original = owner[name].bind(owner);
    owner[name] = (...args) => {
      const row = copy(project(args)); operations.push(row);
      const finish = result => {
        row.native = { result: copy(result ?? null), state: owner.sourceState(),
          ...(name === 'bind' ? { proposalAfterBind: copy(args[0]) } : {}) };
        return result;
      };
      const rejected = error => {
        row.native = { exception: { type: error.name, message: error.message }, state: owner.sourceState() }; throw error;
      };
      try { const result = original(...args); return result?.then ? result.then(finish, rejected) : finish(result); }
      catch (error) { return rejected(error); }
    };
  }
  const restore = owner.restoreNative.bind(owner);
  owner.restoreNative = value => { restore(value); const after = owner.nativeState(); assert.deepEqual(after, value);
    restores.push({ ordinal: restores.length, operationCount: operations.length, input: copy(value), output: copy(after) }); };
}

const chain = fixture.chains.find(c => c.id === chainId); assert.ok(chain, 'Missing independent source chain ' + chainId);
const records = chain.operations.filter(row => row.method === 'record'); assert.ok(records.length > 0);
const table = records.map((row, i) => ({ stage: i, before: publicState(packet(row.input.before, row.input.first, 0)),
  command: command(row.input.command), after: packet(row.input.after, row.input.second, 0, row.input.frames) }));
const negativeStage = mode === 'navigation-no-effect' ? records.findIndex(row => row.input.proposal?.field_plan?.experiment === 'navigation') : -1;
if (mode === 'navigation-no-effect') {
  assert.ok(negativeStage >= 0); table[negativeStage].after = packet(records[negativeStage].input.before, records[negativeStage].input.first, 0);
}
await mkdir(output, { recursive: true });
const operations = [], restores = [], history = [], checkpoints = [], continuations = [], protectionCalls = [], checks = [], failures = [];
const runtime = await createNativeV6Runtime(declarations, { now: () => 0 });
const owner = runtime.acquisitionFamilies.fields;
const verified = name => checks.push(name);
let current = null, returned = 0, stage = 0, ownReturns = 0, ownPathReturns = 0, stockReturns = 0, currentPacket = null;
const sessionId = records[0].input.before.observation_ref.split(':epoch:')[0];
try {
  assert.equal(runtime.families.filter(f => f.id === OWNER).length, 1);
  assert.deepEqual(owner.sourceState(), new AddressedMaterial().sourceState());
  const initialOwner = owner.sourceState(); instrument(owner, operations, restores);
  const protect = runtime.caller.protect.bind(runtime.caller);
  runtime.caller.protect = (...args) => {
    const input = copy({ proposal: args[0], obligations: args[1], observation: args[2], rows: args[3] });
    const result = protect(...args); protectionCalls.push({ input, result: copy(result) }); return result;
  };
  currentPacket = packet(records[0].input.before, records[0].input.first, 0);
  current = await runtime.initialize({ sessionId, observation: copy(currentPacket), budgets: copy(budgets) }, execution);
  const material = current.snapshot.coverage.sourceGroups.find(g => g.id === 'factored_material_return');
  const index = material.entryPoints.indexOf(ENTRY); assert.ok(index >= 0); assert.equal(material.families[index], OWNER);
  const order = declarations.strategy.declarations[0].configuration.factored_material_return.ordered_subquestions;
  const entries = material.entryPoints.filter(e => e !== null);
  assert.deepEqual(entries, [...entries].sort((a, b) => order.indexOf(a) - order.indexOf(b)));
  verified('cold_single_owner_original_material_order');
  while (stage < table.length && returned < budgets.maxActions) {
    released(current);
    const matches = table.filter(row => isDeepStrictEqual(row.before, publicState(currentPacket)) && isDeepStrictEqual(row.command, command(current.command)));
    assert.ok(matches.length <= 1, 'The declared public return table must be deterministic');
    const match = matches[0]; assert.ok(!match || match.stage === stage, 'Public response must follow its contiguous declared path');
    const next = match ? { ...copy(match.after), step_index: returned + 1 }
      : { ...copy(currentPacket), step_index: returned + 1, frame_packet: [copy(currentPacket.frame_rows)] };
    const prior = current, own = current.snapshot.lastDecision === OWNER;
    const ownPath = own && current.snapshot.proposal.field_plan?.experiment === 'navigation';
    const stock = own && Boolean(current.snapshot.proposal.field_plan?.stock);
    const recordCount = operations.filter(op => op.method === 'record').length;
    current = await runtime.advance({ command: copy(prior.command), observation: copy(next), executionMs: 0 }, execution);
    returned++; if (own) ownReturns++; if (ownPath) ownPathReturns++; if (stock) stockReturns++;
    if (match) stage++;
    const item = { returned, sourceStage: stage, own, ownPath, stock, advancesPublicTable: Boolean(match),
      released: prior, actualPublicReturn: next, response: current };
    currentPacket = next;
    if (current.kind === 'boundary') {
      const retainedOwner = retained(runtime, STATE_ID); assert.deepEqual(retainedOwner, owner.nativeState());
      const fresh = new AddressedMaterial(declarations.common.addressed_field, { boundedSearch: ADDRESSED_NATIVE_SEARCH_BOUNDS });
      fresh.restoreNative(copy(retainedOwner)); assert.deepEqual(fresh.sourceState(), owner.sourceState());
      const calls = operations.filter(op => op.method === 'record'); assert.equal(calls.length, returned);
      assert.equal(new Set(calls.map(op => op.input.before.observation_ref)).size, returned);
      const facts = retained(runtime, 'reasoning:memory').facts.map(id => retained(runtime, id));
      for (const call of calls) {
        const actual = facts.filter(f => f.key === `addressed_material_event:${call.input.before.revision}`);
        assert.equal(actual.length, 1); assert.deepEqual(actual[0].value, call.native.result);
      }
      checkpoints.push({ returned, state: copy(retainedOwner), graphChain: runtime.inspectKnowledge().chain });
      current = await runtime.resume(execution);
    } else {
      assert.equal(operations.filter(op => op.method === 'record').length, recordCount,
        'An intermediate path step acquires its return only when the prefix seals');
      assert.equal(current.snapshot.prefix.revision, prior.snapshot.prefix.revision);
      assert.equal(current.authorization.action_index, prior.authorization.action_index + 1);
      if (ownPath) continuations.push({ fromAction: returned, decisionRevision: prior.authorization.decision_revision,
        fromIndex: prior.authorization.action_index, nextIndex: current.authorization.action_index,
        planned: prior.snapshot.prefix.planned, firstCommand: copy(prior.command), nextCommand: copy(current.command) });
    }
    history.push(item);
    console.log(JSON.stringify({ stage, returned, ownReturns, ownPathReturns, stockReturns, next: current.kind, family: current.snapshot.lastDecision }));
    if (mode === 'navigation-no-effect' && match?.stage === negativeStage) break;
  }
  assert.ok(ownReturns > 0, 'The common caller must actually select AddressedMaterial');
  assert.ok(checkpoints.length > 0 && restores.length > 0);
  if (mode === 'navigation-no-effect') {
    assert.equal(stage, negativeStage + 1); assert.equal(owner.sourceState().model, null);
    const nextOwnOffer = operations.findLast(op => op.method === 'propose');
    assert.ok(nextOwnOffer); assert.equal(nextOwnOffer.native.result, null);
    if (current.kind === 'action') assert.notEqual(current.snapshot.lastDecision, OWNER);
    verified('stationary_return_inside_accepted_range_refutes_model_and_changes_common_choice');
  } else {
    assert.equal(stage, table.length, 'The real common selector must finish the declared public path');
    if (chainId.startsWith('field-')) {
      assert.ok(ownPathReturns >= 2, 'The common caller must execute at least two field navigation clicks');
      assert.ok(continuations.some(row => row.planned >= 2 && row.nextIndex === row.fromIndex + 1),
        'At least two guarded clicks must belong to one retained prefix');
    }
    if (chainId.includes('stock-')) assert.ok(stockReturns > 0, 'The post-boundary stock must actually contribute a selected command');
  }
  verified('actual_selected_or_passive_returns_acquired_exactly_once');
  verified('whole_source_envelopes_retained_even_with_empty_events');
  verified('actual_native_restore_calls_and_fresh_owner_checkpoint_reconstruction');
  verified('released_commands_pass_full_why_act_and_current_point_guards');
  verified('synthetic_returns_depend_only_on_public_state_and_released_command');
  assert.deepEqual(initialOwner, new AddressedMaterial().sourceState());
} catch (error) { failures.push({ name: error.name, message: error.message, stack: error.stack }); }
finally { runtime.close('synthetic_addressed_common_proof_finished'); }
const [afterInventory, inputsAfter] = await Promise.all([inventory(), Promise.all(inputs.map(receipt))]);
assert.deepEqual(afterInventory, beforeInventory); assert.deepEqual(inputsAfter, inputsBefore); assert.deepEqual(declarations, declarationsBefore);
const journal = { schema: 'logos-engine.addressed-material-public-operations.v1', sessionId, chainId, mode, operations,
  qualification: 'Only input contains replay arguments. native contains observed comparison results and must not be supplied to the original. No native state is an oracle initial condition.' };
await writeFile(resolve(output, 'actual-operations.json'), JSON.stringify(journal) + '\n', { flag: 'wx' });
const report = { schema: 'logos-engine.addressed-material-common-loop.v1', status: failures.length ? 'failed' : 'passed',
  synthetic: true, chainId, mode, nativeSource: manifest, executionInputs: inputsBefore, sourceUnchangedDuringRun: true,
  executionInputsUnchangedDuringRun: true, sourceDeclarationsModified: false, publicTable: table, history, checkpoints, restores, continuations, protectionCalls,
  checks: { passed: checks.length, names: checks, failures }, returned, ownReturns, ownPathReturns, stockReturns, sourceStages: stage,
  next: current, finalOwner: owner.sourceState(),
  qualification: 'Cold full production selector with original priorities, public-only synthetic table, full WHY/ACT and current-step guards. Not a real game success or latency benchmark. Independent original replay of the actual operation journal is a separate required result.' };
await writeFile(resolve(output, 'common-loop.json.gz'), gzipSync(JSON.stringify(report) + '\n', { mtime: 0 }), { flag: 'wx' });
console.log(JSON.stringify({ status: report.status, checks: checks.length, failures, returned, ownReturns, ownPathReturns, stockReturns, sourceStages: stage }));
if (failures.length) process.exitCode = 1;
