#!/usr/bin/env node
/** Cold complete common-controller loops with explicitly controlled public returns.
 * Usage: node scripts/prove-crossed-prefix-common-loop.mjs OUTPUT.json[.gz] SOURCE-MANIFEST.json
 * Original declarations and priorities are unchanged. Earlier CellPatch offers
 * actually run and receive unchanged synthetic returns before CrossedPrefix can
 * be selected. No game, learned initial state or measured wall cost is involved.
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
  'Usage: prove-crossed-prefix-common-loop.mjs OUTPUT.json[.gz] SOURCE-MANIFEST.json');
const output = resolve(ROOT, outputArgument), manifestPath = resolve(ROOT, manifestArgument);
const REFERENCE = 'reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e';
const FIXTURE = 'tests/fixtures/v6-crossed-prefix-reference.json.gz';
const EXPORT = 'docs/migration/lot3h-evidence/diagnostic/source-oracle-export.json';
const DECLARATIONS = [`${REFERENCE}/source/agents/yf_arc3_v6/laya_proto/common_frontier_policy.drm.json`,
  `${REFERENCE}/source/agents/yf_arc3_v6/morphology_policy/strategy.drm`];
const OWNER = 'public_occurrence_recall', STATE_ID = `family_state:${OWNER}`;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const copy = value => structuredClone(value), checks = [];
const verified = name => checks.push(name);
const ownEvent = event => ['crossed_prefix_state', 'crossed_prefix_input', 'crossed_prefix_pair'].includes(event.kind);
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
assert.equal(exported.generator.path, 'scripts/export-v6-crossed-prefix-reference.py');
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
const [{ createNativeV6Runtime }, { SharedSeriesConstraint }, { CrossedPrefixMemory, proposeCrossedPrefixCommon },
  { hydrateNativeState }, { measureNativeObservation }, { symbolicDigest }] = await Promise.all([
  import('../src/logos-engine/v6-native-runtime.ts'), import('../src/logos-engine/v6-shared-series.ts'),
  import('../src/logos-engine/v6-crossed-prefix-access.ts'), import('../src/logos-engine/v6-native-state-graph.ts'),
  import('../src/logos-engine/v6-native-observer.ts'), import('../src/logos-engine/v6-hash.ts'),
]);
const declarations = { common: await json(DECLARATIONS[0]), strategy: await json(DECLARATIONS[1]) };
const declarationsBefore = copy(declarations), configuration = declarations.strategy.declarations[0].configuration;
const recallPolicy = configuration.window_constraints.occurrence_recall;
const fixture = oracle.accessCases.find(item => item.id === 'common_fresh');
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
// Source chains have no CellPatch transitions. The actual common caller has
// additional public observations; only source/evidence reference labels differ
// in the own reducer semantics checked below. Full native journals retain them.
function withoutObservationLabels(value) {
  if (Array.isArray(value)) return value.map(withoutObservationLabels);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !['evidence', 'source'].includes(key)).map(([key, item]) => [key, withoutObservationLabels(item)]));
  return value;
}
function decision(proposal) {
  return { status: proposal?.status ?? 'no_own_proposal', kind: proposal?.kind ?? null, actions: copy(proposal?.actions ?? []),
    mode: proposal?.crossed_prefix_plan?.mode ?? null, controller: proposal?.crossed_prefix_plan?.controller?.key ?? null };
}

async function branch(chain) {
  const runtime = await createNativeV6Runtime(declarations, { now: () => 0 });
  const owners = runtime.families.filter(family => family.id === OWNER); assert.equal(owners.length, 1);
  const family = owners[0], coldState = copy(family.state()), sessionId = `synthetic-crossed-prefix-${chain.id}`;
  assert.deepEqual(coldState.events, []); assert.deepEqual(chain.initialEvents, []);
  let packet = copy(initialPacket), current = await runtime.initialize({ sessionId, observation: copy(packet), budgets: copy(budgets) }, execution);
  const history = [], rejectedReturns = []; let sourceIndex = 0, returned = 0, ownReturns = 0;
  let lastKernel = null, afterObservation = null;
  const group = current.snapshot.coverage.sourceGroups.find(item => item.id === 'window_constraints');
  const entry = group.entryPoints.indexOf('coupled_prefix_reference');
  assert.equal(entry, group.entryPoints.indexOf('framed_window_composition') + 1); assert.equal(group.families[entry], OWNER);
  assert.equal(current.snapshot.coverage.fullV6Parity, false);
  assert.equal(current.snapshot.proposal.field_subquestion, 'cell_patch_composition', 'Earlier source priority must actually run');
  assert.notDeepEqual(current.command, fixture.expected.actions[0], 'The new branch cannot bypass its earlier competitor');
  verified(chain.id + ':cold_controller_preserves_prior_cell_patch_selection_and_source_order');

  while (returned < 24) {
    assertReleased(current, chain.id + ' release ' + returned);
    const proposal = current.snapshot.proposal, selectedOwn = Boolean(proposal.crossed_prefix_plan);
    if (sourceIndex === chain.steps.length) {
      if (chain.following && selectedOwn) {
        assert.deepEqual(current.command, chain.following.actions[0]); break;
      }
      if (!chain.following && proposal.field_subquestion !== 'cell_patch_composition') {
        assert.equal(selectedOwn, false, 'Refuted own state cannot authorize another own step'); break;
      }
    }
    const sourceStep = selectedOwn ? chain.steps[sourceIndex] : null;
    if (selectedOwn) {
      assert.ok(sourceStep, 'No extra own return is invented after the declared oracle chain');
      assert.equal(proposal.kind, 'coupled_prefix_reference'); assert.equal(proposal.field_subquestion, 'coupled_prefix_reference');
      assert.equal(proposal.strategy_receipt.selected, 'window_constraints');
      assert.deepEqual(current.command, sourceStep.command, 'Source and complete caller independently choose the same command');
      assert.equal(proposal.crossed_prefix_plan.mode, sourceStep.proposal.crossed_prefix_plan.mode);
      assert.equal(proposal.crossed_prefix_plan.controller.key, sourceStep.proposal.crossed_prefix_plan.controller.key);
      if (current.command.action_ref === 'ACTION6') {
        assert.deepEqual(proposal.steps[0].point_binding.point, [current.command.data.x, current.command.data.y]);
        assert.equal(proposal.steps[0].point_binding.observation_ref, current.authorization.observation_ref);
      }
    } else assert.equal(proposal.field_subquestion, 'cell_patch_composition', 'Only the observed earlier CellPatch competitor is supplied an unchanged return');
    const nextRows = copy(sourceStep ? sourceStep.later : packet.frame_rows);
    const afterPacket = { ...copy(packet), frame_rows: nextRows, frame_packet: [nextRows], step_index: packet.step_index + 1,
      frame_hash: symbolicDigest(nextRows).slice(0, 16) };
    if (selectedOwn && sourceIndex === 0 && chain.id === 'no_effect_then_next') {
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
      verified(chain.id + ':invalid_returns_preserve_graph_current_authority_and_all_owners');
    }
    const beforeShared = copy(family.state()), ownBefore = beforeShared.events.filter(ownEvent).length;
    const boundary = await runtime.advance({ command: copy(current.command), observation: copy(afterPacket), executionMs: 0 }, execution);
    returned++; if (selectedOwn) { ownReturns++; sourceIndex++; }
    assert.equal(boundary.kind, 'boundary', String(boundary.reason)); assert.equal(boundary.snapshot.actions, returned);
    assert.equal(boundary.snapshot.caller.acquiredTransitions, returned); assert.equal(boundary.snapshot.caller.boundaryReplays, 0);
    assert.deepEqual(boundary.snapshot.whyAct.analysis.map(item => item.operation), ['OP29', 'OP30', 'OP31']);
    const graph = runtime.inspectKnowledge(), retained = graphRead(graph, STATE_ID);
    assert.deepEqual(retained, family.state());
    assert.deepEqual(Object.values(graph.nodes).filter(node => node.kind === 'family_state' && node.family === OWNER).map(node => node.id), [STATE_ID]);
    const restored = new SharedSeriesConstraint(recallPolicy); restored.restore(copy(retained)); assert.deepEqual(restored.state(), retained);
    const ownProjection = restored.crossedPrefix.currentState(), ownAfter = retained.events.filter(ownEvent);
    assert.equal(ownAfter.length - ownBefore, selectedOwn ? sourceStep.expectedOwnEvents.length : 0, 'Selected return acquires its own event batch exactly once');
    assert.deepEqual(ownProjection.cross_events, ownAfter);
    if (selectedOwn) assert.deepEqual(withoutObservationLabels(ownProjection), withoutObservationLabels(sourceStep.afterState.projection),
      'Own source reducer semantics agree, with actual common-caller observation references retained separately');
    const prefixId = `prefix_evidence:${boundary.snapshot.prefix.revision}`, prefix = graphRead(graph, prefixId);
    const transitionId = `reasoning:transition:${prefix.decision_revision}`, transition = graphRead(graph, transitionId);
    assert.equal(prefix.transitions.length, 1); assert.deepEqual(prefix.transitions[0].command, current.command);
    assert.ok(transition.caller_acquisition && transition.frontier_acquisition);
    afterObservation = await measureNativeObservation(afterPacket, afterPacket.step_index + 1, sessionId);
    assert.equal(afterObservation.observation_ref, prefix.transitions[0].after);
    const facts = graphRead(graph, 'reasoning:memory').facts.map(id => graphRead(graph, id));
    assert.deepEqual(facts.find(fact => fact.key === 'repeated_series_state').value, retained);
    lastKernel = { stateNode: STATE_ID, graphChain: graph.chain, nodeRevision: graph.nodes[STATE_ID].revision,
      retained, ownProjection, prefixNode: prefixId, prefix, transitionNode: transitionId, transition };
    history.push({ index: returned, selectedOwn, sourceStepIndex: selectedOwn ? sourceIndex - 1 : null,
      responseKind: sourceStep?.responseKind ?? 'unchanged_return_to_prior_cell_patch_offer',
      released: current, controlledReturnedPacket: afterPacket, boundary, kernel: lastKernel });
    packet = afterPacket; current = await runtime.resume(execution);
    assert.deepEqual(family.state(), retained, 'Resumed planning cannot duplicate an acquired event');
    assert.equal(current.snapshot.caller.acquiredTransitions, returned);
  }
  assert.equal(sourceIndex, chain.steps.length, 'All declared own source-chain returns were consumed');
  assert.ok(returned < 24, 'The prior-family diagnostic bound is not a substitute for own selection');
  assertReleased(current, chain.id + ' final next release');
  const restored = new SharedSeriesConstraint(recallPolicy); restored.restore(copy(lastKernel.retained));
  const componentNext = await restored.crossedPrefixPropose(afterObservation, packet.frame_rows, inputs,
    budgets.maxActions - returned, execution.deadlineMs, execution.now);
  if (chain.following) {
    assert.ok(componentNext?.crossed_prefix_plan); assert.ok(current.snapshot.proposal.crossed_prefix_plan);
    assert.deepEqual(componentNext.crossed_prefix_plan, current.snapshot.proposal.crossed_prefix_plan);
    assert.deepEqual(componentNext.actions, chain.following.actions); assert.deepEqual(componentNext.actions, [current.command]);
  } else {
    assert.equal(componentNext, null); assert.equal(current.snapshot.proposal.crossed_prefix_plan, undefined);
    assert.equal(lastKernel.ownProjection.cross_state.invalid, true);
  }
  verified(chain.id + ':source_chain_commands_are_released_through_current_guards_and_why_act');
  verified(chain.id + ':each_actual_controlled_return_is_acquired_once_with_own_source_semantics');
  verified(chain.id + ':kernel_checkpoint_restores_one_crossed_owner_without_duplicate_journal');
  verified(chain.id + ':restored_own_memory_and_subsequent_common_choice_consume_the_acquired_return');
  runtime.close('synthetic_proof_complete_without_returning_the_next_released_command');
  return { id: chain.id, synthetic: true, sessionId, initialPublicPacket: copy(initialPacket), initialSharedState: coldState,
    returnedCommands: returned, ownReturnedCommands: ownReturns, priorCellPatchReturnedCommands: returned - ownReturns,
    history, rejectedReturns, finalKernel: lastKernel, nextReleased: current, reconstructedOwnNext: decision(componentNext),
    contextForComponentReplay: { observation: afterObservation, rows: packet.frame_rows, inputs, remaining: budgets.maxActions - returned,
      deadlineMs: execution.deadlineMs, nowMs: 0 },
    qualification: 'Every command and current authorization is chosen by the complete common caller from a cold start. Earlier CellPatch offers receive explicitly supplied unchanged synthetic returns. Own supplied pixel changes come from the declared original-source synthetic chain; they are not game effects or victories. The final released command is not returned. Source own reducer comparison ignores only evidence/source observation labels introduced by the extra actual common-caller transitions; full acquired journals preserve those labels.' };
}
const branches = [];
for (const id of ['compatible_pair', 'no_effect_then_next', 'refuted_crossing']) {
  const chain = oracle.chains.find(value => value.id === id); assert.ok(chain); branches.push(await branch(chain));
}
const ablations = [];
for (const [branchId, kind, reason] of [
  ['compatible_pair', 'crossed_prefix_pair', null],
  ['no_effect_then_next', 'crossed_prefix_state', 'input_has_no_effect_in_current_crossing'],
]) {
  const branchResult = branches.find(item => item.id === branchId), history = branchResult.finalKernel.ownProjection.cross_events;
  const removed = history.map((event, index) => ({ event, index })).filter(({ event }) => event.kind === kind && (!reason || event.outcome?.reason === reason));
  assert.equal(removed.length, 1); const { event, index } = removed[0];
  const withEvent = new CrossedPrefixMemory(), withoutEvent = new CrossedPrefixMemory();
  for (const [i, entry] of history.entries()) { withEvent.applyEvent(copy(entry)); if (i !== index) withoutEvent.applyEvent(copy(entry)); }
  assert.deepEqual(withEvent.currentState(), branchResult.finalKernel.ownProjection);
  const context = branchResult.contextForComponentReplay, query = owner => proposeCrossedPrefixCommon(owner,
    context.observation, context.rows, context.inputs, context.remaining, context.deadlineMs, () => context.nowMs);
  const actual = decision(await query(withEvent)), counterfactual = decision(await query(withoutEvent));
  assert.equal(isDeepStrictEqual(actual.actions, counterfactual.actions), false, 'The sole acquired-event removal must change action or refusal');
  assert.deepEqual(withEvent.currentState(), branchResult.finalKernel.ownProjection);
  ablations.push({ scope: 'crossed_prefix_component_only', branch: branchId,
    intervention: 'remove_only_one_event_actually_acquired_earlier_in_the_synthetic_common_session', removedEventIndex: index,
    removedEvent: copy(event), identicalContext: { observationRef: context.observation.observation_ref, epoch: context.observation.level_epoch,
      score: context.observation.levels_completed, fullRowsDigest: symbolicDigest(context.rows), inputs: context.inputs,
      remaining: context.remaining, deadlineMs: context.deadlineMs, nowMs: context.nowMs },
    withAcquiredEvent: { state: withEvent.currentState(), decision: actual }, withoutAcquiredEvent: { state: withoutEvent.currentState(), decision: counterfactual },
    actionOrRefusalChanged: true, fullCallerCounterfactualExecuted: false,
    qualification: 'Both separate component owners reconstruct retained events actually acquired in the preceding cold common session. No knowledge is injected into a controller session, and no complete-caller counterfactual is claimed.' });
  verified(branchId + ':component_ablation_of_single_acquired_event_changes_action_or_refusal');
}
assert.deepEqual(declarations, declarationsBefore);
const [afterInventory, inputsAfter] = await Promise.all([inventory(), Promise.all(inputPaths.map(receipt))]);
assert.deepEqual(afterInventory, beforeInventory); assert.deepEqual(inputsAfter, inputsBefore);
verified('native_inventory_and_all_evidence_inputs_unchanged_after_three_branches');
const total = key => branches.reduce((sum, branchResult) => sum + branchResult[key], 0);
const report = { schema: 'logos-engine.v6.crossed-prefix-common-loop.v1', status: 'passed',
  implementation: branches[0].nextReleased.snapshot.implementation,
  sourceManifest: inputsBefore.find(item => resolve(ROOT, item.path) === manifestPath),
  nativeSource: { fileCount: beforeInventory.fileCount, digest: beforeInventory.digest }, sourceUnchangedDuringRun: true,
  executionInputs: inputsBefore, executionInputsUnchangedDuringRun: true, sourceDeclarationsModified: false, initialOracleCase: fixture.id,
  clock: { runtimeNowMs: 0, executionNowMs: 0, deadlineMs: execution.deadlineMs, executionMsPerReturnedCommand: 0,
    qualification: 'Deterministic external clocks for finite contracts. No elapsed time, deadline performance or wall cost is measured.' },
  scope: { synthetic: true, coldControllerSessions: 3, controlledReturnedCommands: total('returnedCommands'),
    ownControlledReturnedCommands: total('ownReturnedCommands'), priorCellPatchControlledReturns: total('priorCellPatchReturnedCommands'),
    commonAcquiredTransitions: total('returnedCommands'), furtherReleasedCommandsNotReturned: 3,
    liveGameSessions: 0, liveGameActions: 0, liveGameLevelCompletions: 0, liveGameVictories: 0,
    sourcePythonAgentExecutions: 0, learnedCheckpointsInjected: 0, fullCallerParityClaimed: false, fullCallerAblationExecuted: false },
  checks, verifiedCheckGroups: checks.length, branches, componentAblations: ablations,
  qualification: 'Three cold complete common-controller sessions receive synthetic public pixels and controlled returns. Original declarations and competition remain intact: CellPatch proposals are executed with unchanged returns before the new branch can be selected. Current point/discrete authority, ordinary WHY/ACT, caller acquisition, Kernel persistence, exact reconstruction and the following choice are verified. No game host, engine, specification or solution is read. Positive pair evidence and targeted counterfactuals establish own synthetic contribution, not a game contribution or complete inherited-caller parity.' };
await mkdir(dirname(output), { recursive: true });
const bytes = Buffer.from(JSON.stringify(report, null, 2) + '\n');
await writeFile(output, output.endsWith('.gz') ? gzipSync(bytes, { level: 9 }) : bytes, { flag: 'wx' });
console.log(JSON.stringify({ status: report.status, output: await receipt(output), nativeDigest: beforeInventory.digest,
  verifiedCheckGroups: checks.length, scope: report.scope,
  next: branches.map(item => ({ branch: item.id, kind: item.nextReleased.snapshot.proposal.kind, command: item.nextReleased.command })),
  componentAblationsChangedActionOrRefusal: ablations.length }));
