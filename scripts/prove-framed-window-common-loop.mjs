#!/usr/bin/env node
/** Controlled public returns through the complete native common controller.
 * Usage: node scripts/prove-framed-window-common-loop.mjs OUTPUT.json[.gz] SOURCE-MANIFEST.json
 * The immutable oracle supplies only initial pixels and available actions.
 * Returns below are explicitly synthetic. No game, learned checkpoint, source
 * configuration change, wall-clock measurement or live victory is involved.
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
  'Usage: prove-framed-window-common-loop.mjs OUTPUT.json[.gz] SOURCE-MANIFEST.json');
const output = resolve(ROOT, outputArgument), manifestPath = resolve(ROOT, manifestArgument);
const REFERENCE = 'reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e';
const FIXTURE = 'tests/fixtures/v6-framed-window-reference.json.gz';
const EXPORT = 'docs/migration/lot3g-evidence/diagnostic/source-oracle-export.json';
const DECLARATIONS = [`${REFERENCE}/source/agents/yf_arc3_v6/laya_proto/common_frontier_policy.drm.json`,
  `${REFERENCE}/source/agents/yf_arc3_v6/morphology_policy/strategy.drm`];
const OWNER = 'public_occurrence_recall', STATE_ID = `family_state:${OWNER}`;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const copy = value => structuredClone(value);
const checks = [];
function verified(name) { checks.push(name); }
function inRoot(name) {
  const path = resolve(ROOT, name), rel = relative(ROOT, path);
  assert.ok(rel && !rel.startsWith('..') && !rel.startsWith('/'), `Input must remain inside checkout: ${name}`);
  return path;
}
async function receipt(path) {
  const absolute = resolve(ROOT, path), bytes = await readFile(absolute);
  return { path: relative(ROOT, absolute), bytes: bytes.length, sha256: hash(bytes) };
}
async function json(path) {
  const bytes = await readFile(resolve(ROOT, path));
  return JSON.parse(path.endsWith('.gz') ? gunzipSync(bytes).toString() : bytes.toString());
}
async function inventory() {
  const paths = [];
  async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (entry.isFile() && /\.(ts|json|drm)$/.test(entry.name)) paths.push(relative(ROOT, path));
    }
  }
  await Promise.all(['src/logos-engine', 'src/runtime'].map(name => walk(resolve(ROOT, name))));
  const files = {};
  for (const name of paths.sort()) files[name] = hash(await readFile(inRoot(name)));
  return { fileCount: paths.length, digest: hash(JSON.stringify(files)), files };
}

const [manifest, beforeInventory, oracle, exported, originalManifest] = await Promise.all([
  json(manifestPath), inventory(), json(FIXTURE), json(EXPORT), json(`${REFERENCE}/manifest.json`),
]);
assert.deepEqual(beforeInventory, manifest, 'Exact native inventory must match the declared freeze, including added or removed files');
assert.equal(exported.status, 'passed');
assert.equal(exported.fixture.path, FIXTURE);
assert.equal(exported.generator.path, 'scripts/export-v6-framed-window-reference.py');
assert.deepEqual(await receipt(FIXTURE), exported.fixture);
assert.equal((await receipt(exported.generator.path)).sha256, exported.generator.sha256);
assert.equal(oracle.sourceCommit, '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e');
verified('native_inventory_matches_declared_freeze');
verified('oracle_fixture_and_generator_match_export_receipt');

const originalPaths = [];
for (const [name, expected] of Object.entries(oracle.sourceFiles)) {
  const path = `${REFERENCE}/source/${name}`;
  assert.equal(originalManifest.files[name]?.sha256, expected, name);
  assert.equal((await receipt(inRoot(path))).sha256, expected, name);
  originalPaths.push(path);
}
for (const path of DECLARATIONS) {
  const name = path.slice(`${REFERENCE}/source/`.length);
  assert.equal((await receipt(path)).sha256, originalManifest.files[name]?.sha256, path);
}
const inputPaths = [...new Set([manifestPath, fileURLToPath(import.meta.url), FIXTURE, EXPORT,
  exported.generator.path, `${REFERENCE}/manifest.json`, ...DECLARATIONS, ...originalPaths].map(path => resolve(ROOT, path)))].sort();
const inputsBefore = await Promise.all(inputPaths.map(receipt));
verified('consumed_originals_and_unchanged_source_declarations_match_pinned_manifest');

// Import only native modules, after validating their complete inventory. The
// Python oracle generator is fingerprinted; it is never executed by this proof.
const [{ createNativeV6Runtime }, { SharedSeriesConstraint }, { FramedWindowMemory, proposeFramedWindowCommon },
  { hydrateNativeState }, { measureNativeObservation }, { symbolicDigest }] = await Promise.all([
  import('../src/logos-engine/v6-native-runtime.ts'), import('../src/logos-engine/v6-shared-series.ts'),
  import('../src/logos-engine/v6-framed-window-access.ts'), import('../src/logos-engine/v6-native-state-graph.ts'),
  import('../src/logos-engine/v6-native-observer.ts'), import('../src/logos-engine/v6-hash.ts'),
]);
const declarations = { common: await json(DECLARATIONS[0]), strategy: await json(DECLARATIONS[1]) };
const declarationsBefore = copy(declarations), configuration = declarations.strategy.declarations[0].configuration;
const recallPolicy = configuration.window_constraints.occurrence_recall;
const framedPolicy = configuration.window_constraints.framed_window_composition;
const fixture = oracle.cases.find(item => item.id === 'common:fresh');
assert.ok(fixture); assert.deepEqual(fixture.seedEvents, []);
assert.deepEqual(framedPolicy, fixture.arguments.config);
const rows = copy(fixture.arguments.rows), inputs = copy(fixture.arguments.inputs);
const packet = { frame_rows: rows, frame_packet: [rows], level: 1, levels_completed: 0,
  state: fixture.arguments.observation.state, step_index: 0,
  available_action_refs: copy(fixture.arguments.observation.available_action_refs), frame_hash: symbolicDigest(rows).slice(0, 16) };
assert.equal(packet.frame_hash, fixture.arguments.observation.frame_hash);
const expectedCommand = fixture.expected.actions[0];
const execution = { yieldControl: async () => {}, now: () => 0, deadlineMs: 360_000 };
const budgets = { targetLevels: 2, levelActionCaps: [40, 40], maxActions: 80 };
verified('initial_public_pixels_and_actions_only_are_taken_from_unseeded_common_fresh');

function graphRead(graph, id) {
  assert.ok(graph.nodes[id], `Missing authoritative node ${id}`);
  return hydrateNativeState(graph.nodes[id].value, key => {
    assert.ok(graph.nodes[key], `Missing authoritative fragment ${key}`);
    return graph.nodes[key].value;
  });
}
function decision(proposal) {
  return { status: proposal?.status ?? 'no_own_proposal', kind: proposal?.kind ?? null,
    actions: copy(proposal?.actions ?? []), trialKey: proposal?.framed_window_plan?.trial_key ?? null };
}
function assertReleased(result, message) {
  assert.equal(result.kind, 'action', message + ': ' + String(result.reason));
  assert.ok(result.authorization, message + ': current authorization');
  assert.equal(result.snapshot.whyAct.enabled, true);
  assert.equal(result.snapshot.whyAct.decision.decision.status, 'action_set_released');
  const before = result.snapshot.trace.findLast(item => item.kind === 'before_guard');
  assert.equal(before.admitted, true); assert.equal(before.point_bound, true);
  assert.ok(result.snapshot.trace.some(item => item.kind === 'why_act_release' && item.native_gate && item.admitted));
}

async function branch(id, progress) {
  const runtime = await createNativeV6Runtime(declarations, { now: () => 0 });
  const families = runtime.families.filter(family => family.id === OWNER);
  assert.equal(families.length, 1, 'All series entry points retain one common owner');
  const family = families[0], coldState = copy(family.state()), sessionId = `synthetic-framed-window-${id}`;
  assert.deepEqual(coldState.events, [], 'A cold session has no injected learned journal');
  const released = await runtime.initialize({ sessionId, observation: copy(packet), budgets: copy(budgets) }, execution);
  assertReleased(released, id + ' initial release');
  assert.equal(released.snapshot.lastDecision, OWNER);
  const proposal = released.snapshot.proposal, plan = proposal.framed_window_plan;
  assert.equal(proposal.kind, 'framed_window_experiment');
  assert.equal(proposal.field_subquestion, 'framed_window_composition');
  assert.equal(proposal.strategy_receipt.selected, 'window_constraints');
  assert.deepEqual(released.command, expectedCommand, 'The complete caller independently chooses the oracle point');
  assert.deepEqual(proposal.steps[0].point_binding, proposal.steps[0].point_support);
  assert.equal(proposal.steps[0].point_binding.observation_ref, released.authorization.observation_ref);
  assert.equal(proposal.steps[0].expected_after, null, 'The point effect remains unknown at release');
  assert.deepEqual(family.state(), coldState, 'Initial selection and release acquire no future return');
  const group = released.snapshot.coverage.sourceGroups.find(item => item.id === 'window_constraints');
  const entry = group.entryPoints.indexOf('framed_window_composition');
  assert.equal(entry, group.entryPoints.indexOf('rooted_quota_composition') + 1);
  assert.equal(group.families[entry], OWNER); assert.equal(released.snapshot.coverage.fullV6Parity, false);
  verified(id + ':cold_source_order_selection_current_binding_and_why_act_release');

  const afterPacket = { ...copy(packet), step_index: 1, ...(progress ? { level: 2, levels_completed: 1 } : {}) };
  const adverse = [];
  if (!progress) {
    const initialGraph = runtime.inspectKnowledge(), initialSnapshot = runtime.snapshot();
    const wrongCommand = copy(released.command); wrongCommand.data.x += 1;
    for (const [name, outcome, pattern] of [
      ['substituted_command', { command: wrongCommand, observation: afterPacket, executionMs: 0 }, /does not match/],
      ['unadvanced_step', { command: released.command, observation: packet, executionMs: 0 }, /does not match/],
      ['negative_execution_time', { command: released.command, observation: afterPacket, executionMs: -1 }, /Invalid native execution time/],
    ]) {
      await assert.rejects(runtime.advance(copy(outcome), execution), pattern);
      assert.equal(runtime.inspectKnowledge(), initialGraph);
      assert.deepEqual(runtime.snapshot(), initialSnapshot); assert.deepEqual(family.state(), coldState);
      adverse.push({ kind: name, rejectedBeforeAcquisition: true, graphAndSessionUnchanged: true });
    }
    verified(id + ':three_invalid_returns_leave_graph_authority_and_acquisition_unchanged');
  }

  const boundary = await runtime.advance({ command: copy(released.command), observation: copy(afterPacket), executionMs: 0 }, execution);
  assert.equal(boundary.kind, 'boundary', String(boundary.reason));
  assert.equal(boundary.snapshot.actions, 1); assert.equal(boundary.snapshot.cycles, 1);
  assert.equal(boundary.snapshot.caller.acquiredTransitions, 1);
  assert.equal(boundary.snapshot.caller.boundaryReplays, progress ? 1 : 0);
  assert.deepEqual(boundary.snapshot.whyAct.analysis.map(item => item.operation), ['OP29', 'OP30', 'OP31']);
  const graph = runtime.inspectKnowledge(), retained = graphRead(graph, STATE_ID);
  assert.deepEqual(retained, family.state());
  assert.deepEqual(Object.values(graph.nodes).filter(node => node.kind === 'family_state' && node.family === OWNER).map(node => node.id), [STATE_ID]);
  const ownEvents = retained.events.filter(event => event.kind === 'framed_window_response');
  assert.equal(ownEvents.length, 1, 'One actual synthetic return creates exactly one own event');
  const event = ownEvents[0], prefixId = `prefix_evidence:${boundary.snapshot.prefix.revision}`;
  const prefix = graphRead(graph, prefixId), transitionId = `reasoning:transition:${prefix.decision_revision}`;
  const transition = graphRead(graph, transitionId);
  assert.equal(prefix.transitions.length, 1);
  assert.deepEqual(prefix.transitions[0].command, released.command);
  assert.deepEqual(event.command, released.command); assert.equal(event.trial_key, plan.trial_key);
  assert.equal(event.official_progress, progress); assert.equal(event.canonical_changed, false);
  assert.equal(event.epoch, 1); assert.equal(event.after_epoch, progress ? 2 : 1);
  assert.deepEqual(event.evidence, [prefix.transitions[0].before, prefix.transitions[0].after]);
  assert.equal(prefix.transitions[0].outcome.matched, null); assert.equal(prefix.transitions[0].outcome.seal_prefix, true);
  assert.ok(transition.caller_acquisition && transition.frontier_acquisition);
  const facts = graphRead(graph, 'reasoning:memory').facts.map(id => graphRead(graph, id));
  assert.deepEqual(facts.find(fact => fact.key === 'repeated_series_state').value, retained);
  const restored = new SharedSeriesConstraint(recallPolicy); restored.restore(copy(retained));
  assert.deepEqual(restored.state(), retained);
  const projection = restored.framedWindow.currentState();
  assert.deepEqual(projection.window_events, ownEvents);
  assert.deepEqual(projection.window_blocked, progress ? [] : [plan.trial_key]);
  verified(id + ':one_return_acquired_once_through_caller_and_authoritative_kernel');
  verified(id + ':common_checkpoint_and_own_trial_scope_reconstruct_exactly');

  const afterObservation = await measureNativeObservation(afterPacket, 2, sessionId);
  assert.equal(afterObservation.observation_ref, prefix.transitions[0].after);
  const remaining = progress ? budgets.levelActionCaps[1] : budgets.levelActionCaps[0] - 1;
  const reconstructedNext = await restored.framedWindowPropose(afterObservation, afterPacket.frame_rows,
    inputs, remaining, framedPolicy, execution.deadlineMs, execution.now);
  if (progress) {
    assert.ok(reconstructedNext?.framed_window_plan);
    assert.notEqual(reconstructedNext.framed_window_plan.trial_key, plan.trial_key);
    assert.deepEqual(reconstructedNext.actions, [released.command]);
  } else assert.equal(reconstructedNext, null);
  const resumed = await runtime.resume(execution); assertReleased(resumed, id + ' resumed release');
  if (progress) {
    assert.equal(resumed.snapshot.proposal.field_subquestion, 'framed_window_composition');
    assert.equal(resumed.snapshot.proposal.framed_window_plan.epoch, 2);
    assert.notEqual(resumed.snapshot.proposal.framed_window_plan.trial_key, plan.trial_key);
    assert.deepEqual(resumed.command, released.command);
  } else {
    assert.notEqual(resumed.snapshot.proposal.field_subquestion, 'framed_window_composition');
    assert.equal(resumed.snapshot.proposal.framed_window_plan, undefined);
  }
  assert.deepEqual(family.state(), retained, 'Resuming planning cannot duplicate an acquired response');
  assert.equal(resumed.snapshot.caller.acquiredTransitions, 1);
  verified(id + ':restored_component_and_common_resume_consume_the_return_without_duplicate_acquisition');
  runtime.close('synthetic_proof_complete_without_returning_the_next_released_command');
  return { id, synthetic: true, sessionId, initialPublicPacket: copy(packet), controlledReturnedPacket: afterPacket,
    initialSharedState: coldState, released, boundary, resumed, rejectedReturns: adverse,
    kernel: { node: STATE_ID, graphChain: graph.chain, nodeRevision: graph.nodes[STATE_ID].revision,
      retained, ownProjection: projection, prefixNode: prefixId, prefix, transitionNode: transitionId, transition },
    reconstructedComponentNext: decision(reconstructedNext),
    contextForComponentReplay: { observation: afterObservation, rows: afterPacket.frame_rows, inputs, remaining,
      config: framedPolicy, deadlineMs: execution.deadlineMs, nowMs: 0 },
    qualification: progress
      ? 'The supplied public score and epoch increase are synthetic. They exercise positive evidence, boundary reconciliation and a newly authorized current-epoch question; they establish no game progress, terminal utility or victory.'
      : 'The supplied unchanged public return is synthetic. It acquires a scoped negative trial and changes the following full-controller choice; no hidden game effect is asserted.' };
}

const noProgress = await branch('no_progress', false);
const progress = await branch('public_progress', true);
const actualHistory = noProgress.kernel.ownProjection.window_events;
assert.equal(actualHistory.length, 1); assert.equal(actualHistory[0].official_progress, false);
const withEvent = new FramedWindowMemory(), withoutEvent = new FramedWindowMemory();
for (const event of actualHistory) withEvent.applyEvent(copy(event));
assert.deepEqual(withEvent.currentState(), noProgress.kernel.ownProjection);
const context = noProgress.contextForComponentReplay;
const ownProposal = owner => proposeFramedWindowCommon(owner, context.observation, context.rows, context.inputs,
  context.remaining, context.config, context.deadlineMs, () => context.nowMs);
const acquiredProposal = await ownProposal(withEvent), ablatedProposal = await ownProposal(withoutEvent);
assert.equal(acquiredProposal, null); assert.ok(ablatedProposal?.framed_window_plan);
assert.deepEqual(ablatedProposal.actions, [expectedCommand]);
assert.equal(ablatedProposal.framed_window_plan.trial_key, actualHistory[0].trial_key);
const actualDecision = decision(acquiredProposal), counterfactualDecision = decision(ablatedProposal);
assert.equal(isDeepStrictEqual(actualDecision.actions, counterfactualDecision.actions), false);
assert.deepEqual(withEvent.currentState(), noProgress.kernel.ownProjection, 'Counterfactual queries do not acquire events');
assert.deepEqual(withoutEvent.currentState(), { window_events: [], window_blocked: [] });
const ablation = { scope: 'framed_window_component_only', intervention: 'remove_the_single_earlier_acquired_negative_response',
  acquisitionSource: { branch: noProgress.id, stateNode: STATE_ID, eventIndex: 0 }, removedEvent: copy(actualHistory[0]),
  identicalContext: { observationRef: context.observation.observation_ref, epoch: context.observation.level_epoch,
    score: context.observation.levels_completed, fullRowsDigest: symbolicDigest(context.rows), inputs: context.inputs,
    config: context.config, remaining: context.remaining, deadlineMs: context.deadlineMs, nowMs: context.nowMs },
  withAcquiredEvent: { state: withEvent.currentState(), decision: actualDecision },
  withoutAcquiredEvent: { state: withoutEvent.currentState(), decision: counterfactualDecision },
  actionOrRefusalChanged: true, fullCallerCounterfactualExecuted: false,
  qualification: 'Separate component owners reconstruct only the own events actually acquired earlier in the synthetic controller branch. The sole intervention removes its one negative response. The same measured after-context is queried in both owners. Neither counterfactual state is injected into either controller session. This is component contribution, not a complete common-caller ablation.' };
verified('component_ablation_of_only_the_acquired_negative_event_changes_action_or_refusal_in_identical_context');

assert.deepEqual(declarations, declarationsBefore, 'The full source declarations remain unmodified');
const [afterInventory, inputsAfter] = await Promise.all([inventory(), Promise.all(inputPaths.map(receipt))]);
assert.deepEqual(afterInventory, beforeInventory, 'No native input changed during this proof');
assert.deepEqual(inputsAfter, inputsBefore, 'The manifest, oracle, generator, declarations and proof script remain unchanged');
verified('native_inventory_and_all_evidence_inputs_unchanged_after_both_branches');
const report = { schema: 'logos-engine.v6.framed-window-common-loop.v1', status: 'passed',
  implementation: noProgress.released.snapshot.implementation, sourceManifest: inputsBefore.find(item => resolve(ROOT, item.path) === manifestPath),
  nativeSource: { fileCount: beforeInventory.fileCount, digest: beforeInventory.digest },
  sourceUnchangedDuringRun: true, executionInputs: inputsBefore, executionInputsUnchangedDuringRun: true,
  sourceDeclarationsModified: false, initialOracleCase: fixture.id,
  clock: { runtimeNowMs: 0, executionNowMs: 0, deadlineMs: 360_000, executionMsPerReturnedCommand: 0,
    qualification: 'Externally supplied deterministic clocks for finite contract checks. No elapsed physical time, deadline performance or cost is measured.' },
  scope: { synthetic: true, coldControllerSessions: 2, controlledReturnedCommands: 2, commonAcquiredTransitions: 2,
    furtherReleasedCommandsNotReturned: 2, liveGameSessions: 0, liveGameActions: 0, liveGameLevelCompletions: 0,
    liveGameVictories: 0, sourcePythonAgentExecutions: 0, learnedCheckpointsInjected: 0,
    fullCallerParityClaimed: false, fullCallerAblationExecuted: false },
  checks, verifiedCheckGroups: checks.length, branches: [noProgress, progress], componentAblation: ablation,
  qualification: 'Two fresh native common-controller sessions receive only synthetic public pixels and explicitly controlled public returns. Selection, current point binding, ordinary WHY/ACT, caller acquisition, Kernel persistence, reconstruction and subsequent choice run through the unchanged source declarations. No game host, game engine, specification or solution is loaded. Positive synthetic score is not game success. Inherited source closure and complete original-caller parity remain partial. Source-contract and live-performance evidence are separate.' };
await mkdir(dirname(output), { recursive: true });
const bytes = Buffer.from(JSON.stringify(report, null, 2) + '\n');
await writeFile(output, output.endsWith('.gz') ? gzipSync(bytes, { level: 9 }) : bytes, { flag: 'wx' });
console.log(JSON.stringify({ status: report.status, output: await receipt(output), sourceDigest: beforeInventory.digest,
  verifiedCheckGroups: checks.length, coldSyntheticSessions: 2, liveGameActions: 0, liveGameVictories: 0,
  negativeResume: { family: noProgress.resumed.snapshot.lastDecision, command: noProgress.resumed.command },
  positiveResume: { family: progress.resumed.snapshot.lastDecision, command: progress.resumed.command },
  componentAblationChangedActionOrRefusal: true }));
