#!/usr/bin/env node
/** Cold complete common-controller loops on declared public synthetic rasters.
 * Usage: node scripts/prove-recurrent-series-common-loop.mjs OUTPUT.json[.gz] SOURCE-MANIFEST.json
 * Earlier source-priority offers receive explicitly unchanged returns. No source
 * priority, declaration, initial acquired memory or physical command is replaced.
 * Repeated-line responses come from the independent original-source fixture.
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
  'Usage: prove-recurrent-series-common-loop.mjs OUTPUT.json[.gz] SOURCE-MANIFEST.json');
const output = resolve(ROOT, outputArgument), manifestPath = resolve(ROOT, manifestArgument);
const REFERENCE = 'reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e';
const FIXTURE = 'tests/fixtures/v6-recurrent-series-reference.json.gz';
const EXPORT = 'docs/migration/lot3i-evidence/diagnostic/source-oracle-export.json';
const DECLARATIONS = [`${REFERENCE}/source/agents/yf_arc3_v6/laya_proto/common_frontier_policy.drm.json`,
  `${REFERENCE}/source/agents/yf_arc3_v6/morphology_policy/strategy.drm`];
const OWNER = 'public_occurrence_recall', STATE_ID = `family_state:${OWNER}`;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const copy = value => structuredClone(value), checks = [];
const verified = name => checks.push(name);
const ownEvent = event => /^(repeated_line_|supported_)/.test(event.kind);
function inRoot(name) {
  const path = resolve(ROOT, name), rel = relative(ROOT, path);
  assert.ok(rel && !rel.startsWith('..') && !rel.startsWith('/'), 'Input must remain inside checkout: ' + name);
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
assert.deepEqual(beforeInventory, manifest, 'Complete native inventory must match the declared freeze');
assert.equal(exported.status, 'passed'); assert.equal(exported.fixture.path, FIXTURE);
assert.equal(exported.generator.path, 'scripts/export-v6-recurrent-series-reference.py');
assert.deepEqual(await receipt(FIXTURE), exported.fixture);
assert.deepEqual(await receipt(exported.generator.path), exported.generator);
assert.equal(oracle.sourceCommit, '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e');
verified('native_inventory_matches_declared_freeze');
verified('oracle_fixture_and_generator_match_export_receipt');
const originalPaths = [];
for (const [name, expected] of Object.entries(oracle.sourceFiles)) {
  const path = `${REFERENCE}/source/${name}`;
  assert.equal(originalManifest.files[name]?.sha256, expected, name);
  assert.equal((await receipt(path)).sha256, expected, name); originalPaths.push(path);
}
for (const path of DECLARATIONS) {
  const name = path.slice(`${REFERENCE}/source/`.length);
  assert.equal((await receipt(path)).sha256, originalManifest.files[name]?.sha256, path);
}
const inputPaths = [...new Set([manifestPath, fileURLToPath(import.meta.url), FIXTURE, EXPORT,
  exported.generator.path, `${REFERENCE}/manifest.json`, ...DECLARATIONS, ...originalPaths].map(path => resolve(ROOT, path)))].sort();
const inputsBefore = await Promise.all(inputPaths.map(receipt));
verified('consumed_originals_and_source_declarations_match_pinned_manifest');
const [{ createNativeV6Runtime }, { SharedSeriesConstraint }, { RecurrentSeriesMemory, proposeRecurrentSeriesCommon },
  { hydrateNativeState }, { measureNativeObservation }, { symbolicDigest }] = await Promise.all([
  import('../src/logos-engine/v6-native-runtime.ts'), import('../src/logos-engine/v6-shared-series.ts'),
  import('../src/logos-engine/v6-recurrent-series-access.ts'), import('../src/logos-engine/v6-native-state-graph.ts'),
  import('../src/logos-engine/v6-native-observer.ts'), import('../src/logos-engine/v6-hash.ts'),
]);
const declarations = { common: await json(DECLARATIONS[0]), strategy: await json(DECLARATIONS[1]) };
const declarationsBefore = copy(declarations), configuration = declarations.strategy.declarations[0].configuration;
const recallPolicy = configuration.window_constraints.occurrence_recall, seriesConfig = configuration.window_constraints;
const fixture = oracle.accessCases.find(item => item.id === 'adapter:actual_observed_repeated');
assert.ok(fixture); assert.deepEqual(fixture.initialEvents, []);
const initialRows = copy(fixture.rows), inputs = copy(fixture.inputs);
const initialPacket = { frame_rows: initialRows, frame_packet: [initialRows], level: 1, levels_completed: 0,
  state: fixture.observation.state, step_index: 0, available_action_refs: copy(fixture.observation.available_action_refs),
  frame_hash: symbolicDigest(initialRows).slice(0, 16) };
const execution = { yieldControl: async () => {}, now: () => 0, deadlineMs: 360_000 };
const budgets = { targetLevels: 1, levelActionCaps: [80], maxActions: 80 };
verified('initial_public_pixels_and_actions_only_are_taken_from_unseeded_source_case');
function graphRead(graph, id) {
  assert.ok(graph.nodes[id], 'Missing authoritative node ' + id);
  return hydrateNativeState(graph.nodes[id].value, key => {
    assert.ok(graph.nodes[key], 'Missing authoritative fragment ' + key); return graph.nodes[key].value;
  });
}
function assertReleased(result, label) {
  assert.equal(result.kind, 'action', label + ': ' + String(result.reason)); assert.ok(result.authorization);
  assert.equal(result.snapshot.whyAct.enabled, true);
  assert.equal(result.snapshot.whyAct.decision.decision.status, 'action_set_released');
  const before = result.snapshot.trace.findLast(item => item.kind === 'before_guard');
  assert.equal(before.admitted, true); assert.equal(before.point_bound, true);
  assert.ok(result.snapshot.trace.some(item => item.kind === 'why_act_release' && item.native_gate && item.admitted));
}
// Additional actual caller returns introduce new observation labels. Trial
// identities, field references, targets, palettes and lengths are not removed.
function withoutObservationLabels(value) {
  if (Array.isArray(value)) return value.map(withoutObservationLabels);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !['before', 'after', 'source'].includes(key)).map(([key, item]) => [key, withoutObservationLabels(item)]));
  return value;
}
function decision(proposal) {
  const plan = proposal?.line_plan ?? proposal?.supported_line_plan;
  return { status: proposal?.status ?? 'no_own_proposal', kind: proposal?.kind ?? null, actions: copy(proposal?.actions ?? []),
    trial: plan?.trial ?? null, field: plan?.field ?? null, observedLength: plan?.observed_length ?? null,
    candidateLength: plan?.candidate_length ?? null };
}

async function branch(id, responseId, nextId) {
  const response = oracle.recordCases.find(item => item.id === responseId);
  const following = oracle.accessCases.find(item => item.id === nextId);
  assert.ok(response && following); assert.deepEqual(response.initialEvents, []);
  assert.deepEqual(response.rows, initialRows); assert.deepEqual(response.command, fixture.expected.actions[0]);
  const runtime = await createNativeV6Runtime(declarations, { now: () => 0 });
  const owners = runtime.families.filter(family => family.id === OWNER); assert.equal(owners.length, 1);
  const family = owners[0], coldState = copy(family.state()), sessionId = `synthetic-recurrent-series-${id}`;
  assert.deepEqual(coldState.events, []);
  let packet = copy(initialPacket), current = await runtime.initialize({ sessionId, observation: copy(packet), budgets: copy(budgets) }, execution);
  const history = [], rejectedReturns = []; let returned = 0, ownReturns = 0, consumed = false;
  let lastKernel = null, afterObservation = null;
  const group = current.snapshot.coverage.sourceGroups.find(item => item.id === 'window_constraints');
  const entry = group.entryPoints.indexOf('recurrent_series');
  assert.ok(entry >= 0); assert.equal(group.families[entry], OWNER);
  assert.equal(group.entryPoints.filter(name => name === 'recurrent_series').length, 1);
  assert.equal(current.snapshot.coverage.fullV6Parity, false);
  const earlierEntries = new Set(group.entryPoints.slice(0, entry));
  verified(id + ':cold_controller_keeps_original_source_order_and_one_shared_provider');

  while (returned < 48) {
    assertReleased(current, id + ' release ' + returned);
    const proposal = current.snapshot.proposal, selectedOwn = Boolean(proposal.line_plan);
    console.log(JSON.stringify({ branch: id, returned, selected: proposal.field_subquestion ?? proposal.kind, command: current.command }));
    if (consumed && selectedOwn) {
      assert.deepEqual(decision(proposal), decision(following.expected), 'Acquired outcome selects the same next source trial');
      break;
    }
    if (selectedOwn) {
      assert.equal(proposal.field_subquestion, 'recurrent_series');
      assert.equal(proposal.strategy_receipt.selected, 'window_constraints');
      assert.deepEqual(current.command, response.command, 'Common caller independently chooses the original source command');
      assert.deepEqual(proposal.steps[0].point_binding.point, [current.command.data.x, current.command.data.y]);
      assert.equal(proposal.steps[0].point_binding.observation_ref, current.authorization.observation_ref);
    } else {
      assert.equal(proposal.strategy_receipt.selected, 'window_constraints', 'Only an actual earlier source-priority offer may receive an unchanged return');
      assert.ok(earlierEntries.has(proposal.field_subquestion), 'Cannot bypass or force a non-prior competitor: ' + proposal.field_subquestion);
    }
    const nextRows = copy(selectedOwn ? response.later : packet.frame_rows);
    const afterPacket = { ...copy(packet), frame_rows: nextRows, frame_packet: [nextRows], step_index: packet.step_index + 1,
      frame_hash: symbolicDigest(nextRows).slice(0, 16) };
    if (selectedOwn && id === 'refuted') {
      const graph = runtime.inspectKnowledge(), snapshot = runtime.snapshot(), state = copy(family.state());
      const wrong = copy(current.command); wrong.data.x += 1;
      for (const [name, outcome, pattern] of [
        ['substituted_command', { command: wrong, observation: afterPacket, executionMs: 0 }, /does not match/],
        ['unadvanced_step', { command: current.command, observation: packet, executionMs: 0 }, /does not match/],
        ['negative_execution_time', { command: current.command, observation: afterPacket, executionMs: -1 }, /Invalid native execution time/],
      ]) {
        await assert.rejects(runtime.advance(copy(outcome), execution), pattern);
        assert.equal(runtime.inspectKnowledge(), graph); assert.deepEqual(runtime.snapshot(), snapshot); assert.deepEqual(family.state(), state);
        rejectedReturns.push({ kind: name, graphAndSessionAndAcquisitionUnchanged: true });
      }
      verified(id + ':invalid_returns_preserve_graph_current_authority_and_all_owners');
    }
    const ownBefore = family.state().events.filter(ownEvent).length;
    const boundary = await runtime.advance({ command: copy(current.command), observation: copy(afterPacket), executionMs: 0 }, execution);
    returned++; if (selectedOwn) { ownReturns++; consumed = true; }
    assert.equal(boundary.kind, 'boundary', String(boundary.reason)); assert.equal(boundary.snapshot.actions, returned);
    assert.equal(boundary.snapshot.caller.acquiredTransitions, returned); assert.equal(boundary.snapshot.caller.boundaryReplays, 0);
    assert.deepEqual(boundary.snapshot.whyAct.analysis.map(item => item.operation), ['OP29', 'OP30', 'OP31']);
    const graph = runtime.inspectKnowledge(), retained = graphRead(graph, STATE_ID);
    assert.deepEqual(retained, family.state());
    assert.deepEqual(Object.values(graph.nodes).filter(node => node.kind === 'family_state' && node.family === OWNER).map(node => node.id), [STATE_ID]);
    const restored = new SharedSeriesConstraint(recallPolicy); restored.restore(copy(retained)); assert.deepEqual(restored.state(), retained);
    const ownProjection = restored.recurrentSeries.currentState(), ownAfter = retained.events.filter(ownEvent);
    assert.equal(ownAfter.length - ownBefore, selectedOwn ? response.expected.length : 0, 'The actual controlled return acquires its own event batch exactly once');
    assert.equal(restored.recurrentSeries.eventCount, ownAfter.length);
    if (selectedOwn) {
      assert.deepEqual(withoutObservationLabels(ownAfter.slice(ownBefore)), withoutObservationLabels(response.expected));
      assert.deepEqual(withoutObservationLabels({ line_trials: ownProjection.line_trials, line_goals: ownProjection.line_goals }),
        withoutObservationLabels({ line_trials: response.afterState.line_trials, line_goals: response.afterState.line_goals }));
    }
    const prefixId = `prefix_evidence:${boundary.snapshot.prefix.revision}`, prefix = graphRead(graph, prefixId);
    const transitionId = `reasoning:transition:${prefix.decision_revision}`, transition = graphRead(graph, transitionId);
    assert.equal(prefix.transitions.length, 1); assert.deepEqual(prefix.transitions[0].command, current.command);
    assert.ok(transition.caller_acquisition && transition.frontier_acquisition);
    afterObservation = await measureNativeObservation(afterPacket, afterPacket.step_index + 1, sessionId);
    assert.equal(afterObservation.observation_ref, prefix.transitions[0].after);
    const facts = graphRead(graph, 'reasoning:memory').facts.map(key => graphRead(graph, key));
    assert.deepEqual(facts.find(fact => fact.key === 'repeated_series_state').value, retained);
    lastKernel = { stateNode: STATE_ID, graphChain: graph.chain, nodeRevision: graph.nodes[STATE_ID].revision,
      retained, ownProjection, prefixNode: prefixId, prefix, transitionNode: transitionId, transition };
    history.push({ index: returned, selectedOwn,
      responseKind: selectedOwn ? responseId : 'declared_unchanged_return_to_actual_prior_source_offer',
      released: current, controlledReturnedPacket: afterPacket, boundary, kernel: lastKernel });
    packet = afterPacket; current = await runtime.resume(execution);
    assert.deepEqual(family.state(), retained, 'Resumed planning cannot duplicate an acquired event');
    assert.equal(current.snapshot.caller.acquiredTransitions, returned);
  }
  assert.equal(consumed, true, 'The complete unmodified caller must actually reach recurrent_series');
  assert.ok(returned < 48, 'A prior-family diagnostic bound cannot substitute for own selection');
  assertReleased(current, id + ' final next release'); assert.equal(ownReturns, 1);
  assert.equal(current.snapshot.proposal.field_subquestion, 'recurrent_series');
  const restored = new SharedSeriesConstraint(recallPolicy); restored.restore(copy(lastKernel.retained));
  const componentNext = await restored.recurrentSeriesPropose(afterObservation, packet.frame_rows, inputs,
    budgets.maxActions - returned, seriesConfig, execution.deadlineMs, execution.now);
  assert.ok(componentNext?.line_plan);
  assert.deepEqual(componentNext.line_plan, current.snapshot.proposal.line_plan);
  assert.deepEqual(decision(componentNext), decision(following.expected));
  assert.deepEqual(componentNext.actions, [current.command]);
  verified(id + ':source_command_is_released_through_current_binding_guards_and_why_act');
  verified(id + ':each_controlled_return_is_acquired_once_with_own_source_semantics');
  verified(id + ':kernel_checkpoint_restores_one_recurrent_owner_without_duplicate_journal');
  verified(id + ':restored_own_memory_and_next_common_choice_consume_acquired_outcome');
  runtime.close('synthetic_proof_complete_without_returning_the_next_released_command');
  return { id, synthetic: true, sessionId, sourceResponseCase: responseId, sourceNextQuestionCase: nextId,
    initialPublicPacket: copy(initialPacket), initialSharedState: coldState,
    returnedCommands: returned, ownReturnedCommands: ownReturns, priorSourceReturnedCommands: returned - ownReturns,
    history, rejectedReturns, finalKernel: lastKernel, nextReleased: current, reconstructedOwnNext: decision(componentNext),
    contextForComponentReplay: { observation: afterObservation, rows: packet.frame_rows, inputs,
      remaining: budgets.maxActions - returned, deadlineMs: execution.deadlineMs, nowMs: 0 },
    qualification: 'Cold complete common caller, unchanged source priorities, explicitly controlled public returns only. Source fixtures determine the own matched/refuted pixels and subsequent trial choice. Additional caller observation labels differ and remain present in the complete journal. Supported preparation is qualified separately by component and shared integration contracts; this complete-caller proof does not force the two passive Supported clicks.' };
}
const branches = [];
for (const [id, response, next] of [['matched', 'repeated:matched', 'repeated:matched_field_skipped'],
  ['refuted', 'repeated:refuted', 'repeated:refuted_trial_not_retried']]) branches.push(await branch(id, response, next));
const ablations = [];
for (const result of branches) {
  const history = result.finalKernel.retained.events.filter(ownEvent);
  assert.equal(history.length, 1); assert.equal(history[0].kind, 'repeated_line_trial');
  const withEvent = new RecurrentSeriesMemory(), withoutEvent = new RecurrentSeriesMemory(); withEvent.applyEvent(copy(history[0]));
  assert.deepEqual(withEvent.currentState(), result.finalKernel.ownProjection);
  const context = result.contextForComponentReplay;
  const query = owner => proposeRecurrentSeriesCommon(owner, context.observation, context.rows, context.inputs,
    context.remaining, seriesConfig, context.deadlineMs, () => context.nowMs);
  const actual = decision(await query(withEvent)), counterfactual = decision(await query(withoutEvent));
  assert.equal(isDeepStrictEqual(actual.actions, counterfactual.actions), false, 'Removing the sole acquired trial must change action or refusal');
  assert.deepEqual(withEvent.currentState(), result.finalKernel.ownProjection);
  ablations.push({ scope: 'recurrent_series_component_only', branch: result.id,
    intervention: 'remove_only_the_trial_actually_acquired_earlier_in_the_cold_common_session', removedEvent: history[0],
    identicalContext: { observationRef: context.observation.observation_ref, epoch: context.observation.level_epoch,
      score: context.observation.levels_completed, fullRowsDigest: symbolicDigest(context.rows), inputs: context.inputs,
      remaining: context.remaining, deadlineMs: context.deadlineMs, nowMs: context.nowMs },
    withAcquiredEvent: { state: withEvent.currentState(), decision: actual }, withoutAcquiredEvent: { state: withoutEvent.currentState(), decision: counterfactual },
    actionOrRefusalChanged: true, fullCallerCounterfactualExecuted: false,
    qualification: 'Separate component owners reconstruct evidence actually acquired by the preceding common session. No learned checkpoint is injected into a controller and no full-caller ablation is claimed.' });
  verified(result.id + ':component_ablation_of_acquired_trial_changes_action_or_refusal');
}
assert.deepEqual(declarations, declarationsBefore);
const [afterInventory, inputsAfter] = await Promise.all([inventory(), Promise.all(inputPaths.map(receipt))]);
assert.deepEqual(afterInventory, beforeInventory); assert.deepEqual(inputsAfter, inputsBefore);
verified('native_inventory_and_all_evidence_inputs_unchanged_after_both_branches');
const total = key => branches.reduce((sum, item) => sum + item[key], 0);
const report = { schema: 'logos-engine.v6.recurrent-series-common-loop.v1', status: 'passed',
  implementation: branches[0].nextReleased.snapshot.implementation,
  sourceManifest: inputsBefore.find(item => resolve(ROOT, item.path) === manifestPath),
  nativeSource: { fileCount: beforeInventory.fileCount, digest: beforeInventory.digest }, sourceUnchangedDuringRun: true,
  executionInputs: inputsBefore, executionInputsUnchangedDuringRun: true, sourceDeclarationsModified: false, initialOracleCase: fixture.id,
  clock: { runtimeNowMs: 0, executionNowMs: 0, deadlineMs: execution.deadlineMs, executionMsPerReturnedCommand: 0,
    qualification: 'Deterministic external clocks for finite contracts. No elapsed time, deadline performance or wall cost is measured.' },
  scope: { synthetic: true, coldControllerSessions: 2, controlledReturnedCommands: total('returnedCommands'),
    ownControlledReturnedCommands: total('ownReturnedCommands'), priorSourceControlledReturns: total('priorSourceReturnedCommands'),
    commonAcquiredTransitions: total('returnedCommands'), furtherReleasedCommandsNotReturned: 2,
    liveGameSessions: 0, liveGameActions: 0, liveGameLevelCompletions: 0, liveGameVictories: 0,
    sourcePythonAgentExecutions: 0, learnedCheckpointsInjected: 0, fullCallerParityClaimed: false,
    fullCallerAblationExecuted: false, supportedPreparationCompleteCallerClaimed: false },
  checks, verifiedCheckGroups: checks.length, branches, componentAblations: ablations,
  qualification: 'Two cold complete common-controller sessions with declared synthetic public returns. Original declarations and competition remain intact. Matched and refuted repeated-line trials pass binding, current guards, ordinary WHY/ACT, acquisition, Kernel persistence, cold reconstruction and subsequent common choice. Unsupported passive clicks are not forced into the caller. No game host, engine, specification or solution is read; no game contribution, full inherited-caller parity or wall-cost result is claimed.' };
await mkdir(dirname(output), { recursive: true });
const bytes = Buffer.from(JSON.stringify(report, null, 2) + '\n');
await writeFile(output, output.endsWith('.gz') ? gzipSync(bytes, { level: 9 }) : bytes, { flag: 'wx' });
console.log(JSON.stringify({ status: report.status, output: await receipt(output), nativeDigest: beforeInventory.digest,
  verifiedCheckGroups: checks.length, scope: report.scope,
  next: branches.map(item => ({ branch: item.id, kind: item.nextReleased.snapshot.proposal.kind, command: item.nextReleased.command })),
  componentAblationsChangedActionOrRefusal: ablations.length }));
