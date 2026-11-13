/** Reconstruct rooted-line selections from earlier actually acquired events.
 * Usage: node scripts/prove-observed-rooted-line-contribution.mjs GAME FINAL BASELINE
 * Counterfactual memory ablations are component diagnostics, never game inputs.
 */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { isDeepStrictEqual } from 'node:util';
import { RootedLineMemory, rootedLineBefore, rootedLineAfter } from '../src/logos-engine/v6-rooted-line-access.ts';
import { measureRootedLine } from '../src/logos-engine/v6-rooted-line-observation.ts';
import { symbolicDigest } from '../src/logos-engine/v6-hash.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [game, directory, baselineDirectory] = process.argv.slice(2);
assert.match(game ?? '', /^[A-Z0-9]{4}$/);
assert.notEqual(game, 'CWSE', 'This proof does not operate on the deferred game');
assert.ok(directory && baselineDirectory);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const copy = value => structuredClone(value);
const publicCommand = command => ({ action_ref: command.action_ref, data: command.data ?? {} });
async function read(path) {
  const absolute = resolve(ROOT, path), bytes = await readFile(absolute);
  return { value: JSON.parse(path.endsWith('.gz') ? gunzipSync(bytes) : bytes),
    receipt: { path: relative(ROOT, absolute), sha256: hash(bytes), bytes: bytes.length } };
}
async function readJournal(path) {
  const absolute = resolve(ROOT, path), bytes = await readFile(absolute);
  return { value: gunzipSync(bytes).toString().split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line)),
    receipt: { path: relative(ROOT, absolute), sha256: hash(bytes), bytes: bytes.length } };
}
function observation(packet, reference) {
  return { level_epoch: packet.level, levels_completed: packet.levels_completed, observation_ref: reference,
    available_action_refs: packet.available_action_refs, frame_hash: packet.frame_hash, state: packet.state };
}
function memorySummary(projection) {
  const state = projection.line_memory;
  return { events: projection.line_events.length, controls: Object.keys(state.controls).length,
    tried: state.tried.length, evidence: state.evidence.length, retainedConfiguration: state.current !== null,
    retainedConfigurationRef: state.current?.configuration_ref ?? null,
    retainedConfigurationIsPredicted: state.current?.is_predicted_configuration ?? null,
    declaredSupportPairs: state.current?.pieces.flatMap(piece => piece.support_refs.map(ref => [ref, piece.piece_ref])) ?? [],
    hypotheticalSupportPairs: state.current?.hypothetical_support_pairs ?? [],
    refutations: state.refuted.length, epoch: state.epoch };
}
function decisionProjection(proposal) {
  const plan = proposal?.rooted_line_plan;
  return { status: proposal?.status ?? null, reason: proposal?.reason ?? null, actions: proposal?.actions ?? [],
    kind: plan?.kind ?? null, why: plan?.why ?? null, predictions: plan?.predictions ?? null };
}
function actionProjection(proposal) {
  return { status: proposal?.status ?? null, reason: proposal?.reason ?? null, actions: proposal?.actions ?? [] };
}
function searchProjection(proposal) { return proposal?.rooted_line_plan?.search ?? proposal?.search ?? null; }
function erase(memory, fields) {
  for (const field of fields) {
    if (field === 'controls') memory.controls = {};
    else if (field === 'current') memory.current = null;
    else if (field === 'tried') memory.tried = [];
    else if (field === 'refuted') memory.refuted = [];
    else throw new Error('Unknown rooted ablation field: ' + field);
  }
}
function restored(history, fields = []) {
  const memory = new RootedLineMemory();
  for (const [index, original] of history.entries()) {
    const event = copy(original);
    // Earlier events, their order and all transition details stay intact. The
    // counterfactual changes only explicitly named fields in the last snapshot.
    if (index === history.length - 1) erase(event.memory, fields);
    memory.applyEvent(event);
  }
  return memory;
}

const stem = game.toLowerCase();
const reportFile = await read(directory + '/' + stem + '-campaign.json.gz');
const traceFile = await read(directory + '/' + stem + '-public-trace.json.gz');
const journalFile = await readJournal(directory + '/' + stem + '-actual-public-journal.jsonl.gz');
const executionFile = await read(directory + '/execution-' + stem + '.json');
const beforeFile = await read(baselineDirectory + '/' + stem + '-campaign.json.gz');
const beforeTrace = await read(baselineDirectory + '/' + stem + '-public-trace.json.gz');
const beforeJournal = await readJournal(baselineDirectory + '/' + stem + '-actual-public-journal.jsonl.gz');
const beforeExecution = await read(baselineDirectory + '/execution-' + stem + '.json');
const manifestFile = await read(directory + '/source-manifest.json'), manifest = manifestFile.value;
for (const [name, expected] of Object.entries(manifest.files)) assert.equal(hash(await readFile(resolve(ROOT, name))), expected, name);
const report = reportFile.value, trace = traceFile.value, baseline = beforeFile.value;
assert.equal(report.source.digest, manifest.digest);
assert.equal(report.sourceUnchangedDuringRun, true);
assert.equal(report.final.sessions, 1);
assert.deepEqual(report.pythonAgentModules, []);
assert.equal(executionFile.value.nativeSourceManifestDigest, manifest.digest);
assert.equal(executionFile.value.nativeSourceUnchanged, true);
assert.equal(executionFile.value.executionCodeUnchanged, true);
assert.equal(baseline.sourceUnchangedDuringRun, true);
assert.deepEqual(baseline.pythonAgentModules, []);
assert.equal(beforeExecution.value.nativeSourceManifestDigest, baseline.source.digest);
assert.equal(beforeExecution.value.nativeSourceUnchanged, true);
assert.equal(beforeExecution.value.executionCodeUnchanged, true);
assert.deepEqual(trace.packets, journalFile.value, 'Candidate packets and commands match the separately retained public journal');
assert.deepEqual(beforeTrace.value.packets, beforeJournal.value, 'Reference packets and commands match their independently retained public journal');
assert.deepEqual(trace.packets[0], beforeTrace.value.packets[0], 'Cold attempts share the entire initial public packet');
assert.deepEqual(report.gameAssets, baseline.gameAssets, 'Opaque host asset hashes match the retained reference');
assert.equal(trace.packets.length, report.actions.length + 1);
for (const [index, entry] of trace.packets.entries()) {
  assert.equal(entry.packet.step_index, index);
  assert.equal(symbolicDigest(entry.packet.frame_rows).slice(0, 16), entry.packet.frame_hash);
  if (index) assert.deepEqual(entry.command, report.actions[index - 1].command);
  else assert.equal(entry.command, null);
}
const policyFile = await read('reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/morphology_policy/strategy.drm');
const baseConfig = policyFile.value.declarations[0].configuration.observed_composition_services;
const memory = new RootedLineMemory(), selections = [], transitions = [], ablations = [], boundaries = [], foreignPrefixes = [];
let actionCursor = 0, previousEventCount = 0, lastOwnAfterReference = null, optionalZeroPrefixes = 0;
function context(packet, reference, cursor) {
  const earlierLevelActions = report.actions.slice(0, cursor).filter(action => action.levelBefore === packet.level).length;
  const remaining = report.budget.levelActionCaps[packet.levels_completed] - earlierLevelActions;
  assert.ok(Number.isInteger(remaining) && remaining > 0);
  return { observed: observation(packet, reference), limit: Math.min(16, remaining), remaining,
    config: { ...baseConfig, remaining_level_actions: remaining } };
}
function ablateAt(actual, retained, packet, ctx, label, fieldSets) {
  for (const fields of fieldSets) {
    const counterfactual = restored(retained.line_events, fields), altered = counterfactual.currentState(), expected = copy(retained);
    if (retained.line_events.length) { erase(expected.line_memory, fields); erase(expected.line_events.at(-1).memory, fields); }
    assert.deepEqual(altered, expected, 'Only named fields of the final acquired snapshot may change');
    const alternativeProposal = counterfactual.propose(ctx.observed, packet.frame_rows, [], ctx.limit, ctx.config);
    const actualDecision = decisionProjection(actual), alternative = decisionProjection(alternativeProposal);
    const actualSearch = searchProjection(actual), alternativeSearch = searchProjection(alternativeProposal);
    ablations.push({ context: label, level: packet.level, fieldsErased: fields,
      interventionChangedRetainedKnowledge: !isDeepStrictEqual(altered.line_memory, retained.line_memory),
      actualMemorySummary: memorySummary(retained), ablatedMemorySummary: memorySummary(altered),
      actualMemoryDigest: symbolicDigest(retained.line_memory), ablatedMemoryDigest: symbolicDigest(altered.line_memory),
      actionOrRefusalChanged: !isDeepStrictEqual(actionProjection(actual), actionProjection(alternativeProposal)),
      decisionProjectionChanged: !isDeepStrictEqual(actualDecision, alternative), strictProposalChanged: !isDeepStrictEqual(actual, alternativeProposal),
      actual: actualDecision, counterfactual: alternative,
      searchDiagnostics: { actual: actualSearch, counterfactual: alternativeSearch, changed: !isDeepStrictEqual(actualSearch, alternativeSearch) },
      qualification: 'Separate component replay at an actual public context, with only earlier acquired events. Erasure is confined to named fields of the last acquired snapshot. The game journal, earlier event snapshots, commands and transition details are unchanged. Identity, provenance, predicted internal configuration and search-counter differences alone are not action or public-prediction contributions. Empty and negative interventions remain retained.' });
  }
}

for (const prefix of report.prefixes) {
  const captured = prefix.observedRootedLine, series = prefix.sharedSeries ?? {};
  const hasEvents = Object.hasOwn(series, 'rootedLineAcquiredEvents'), hasCount = Object.hasOwn(series, 'rootedLineEventCount');
  assert.equal(hasEvents, hasCount, 'Optional rooted counters and event slices are present together');
  if (!hasEvents) {
    assert.equal(previousEventCount, 0, 'After first acquisition the rooted event counter remains visible');
    assert.ok(!captured, 'A rooted selection must retain its own acquisition fields');
    optionalZeroPrefixes++;
  }
  const events = hasEvents ? series.rootedLineAcquiredEvents : [];
  assert.ok(Array.isArray(events));
  if (hasCount) assert.equal(series.rootedLineEventCount, previousEventCount + events.length);
  previousEventCount += events.length;
  if (!captured) {
    assert.equal(events.length, 0, 'Foreign proposals acquire no rooted-specific event');
    foreignPrefixes.push({ prefix: prefix.id, family: prefix.family, acquired: prefix.acquiredActions,
      firstSequence: actionCursor + 1, ownEvents: 0 });
    actionCursor += prefix.acquiredActions;
    continue;
  }
  const proposal = captured.proposal, plan = proposal.rooted_line_plan, packet = trace.packets[actionCursor].packet;
  assert.equal(captured.stateNode, 'family_state:public_occurrence_recall');
  assert.equal(prefix.fieldSubquestion, 'observed_composition_services');
  assert.equal(prefix.family, 'public_occurrence_recall');
  assert.equal(events.length, prefix.acquiredActions, 'Exactly one rooted event is acquired for every selected transition, including missing-scene returns');
  assert.equal(packet.level, plan.epoch); assert.equal(packet.levels_completed, plan.score);
  assert.equal(symbolicDigest(packet.frame_rows), plan.frame_digest);
  const ctx = context(packet, plan.observation_ref, actionCursor), retained = memory.currentState();
  // Crucially, neither plan.memory nor current-prefix events initialize this
  // decision. The owner starts cold and receives only prior verified records.
  const reproduced = memory.propose(ctx.observed, packet.frame_rows, [], ctx.limit, ctx.config);
  assert.ok(reproduced?.rooted_line_plan);
  assert.deepEqual(reproduced.rooted_line_plan, plan, 'Every source plan field reproduces from earlier real events alone');
  assert.deepEqual(reproduced.actions, proposal.actions);
  assert.equal(reproduced.proposal_id, proposal.proposal_id);
  assert.deepEqual(memory.currentState(), retained, 'Planning cannot acquire future evidence');
  const restoredOwner = restored(retained.line_events);
  assert.deepEqual(restoredOwner.currentState(), retained);
  assert.equal(restoredOwner.retainedDigest('independent-own-layer'), memory.retainedDigest('independent-own-layer'));
  assert.deepEqual(restoredOwner.propose(ctx.observed, packet.frame_rows, [], ctx.limit, ctx.config), reproduced);
  ablateAt(reproduced, retained, packet, ctx, { kind: 'selected_prefix', prefix: prefix.id },
    [['controls'], ['current'], ['tried'], ['controls', 'tried'], ['controls', 'current', 'tried']]);
  for (const [index, expectedEvent] of events.entries()) {
    const position = actionCursor + index, actual = report.actions[position], beforePacket = trace.packets[position].packet,
      afterPacket = trace.packets[position + 1].packet, nativeCommand = proposal.actions[index];
    assert.deepEqual(publicCommand(nativeCommand), actual.command, 'Public commands only materialize missing data as an empty object');
    assert.equal(expectedEvent.kind, 'observed_rooted_line');
    assert.deepEqual(expectedEvent.detail.command, nativeCommand);
    assert.equal(expectedEvent.detail.before, index === 0 ? plan.observation_ref : events[index - 1].detail.after);
    const beforeObservation = observation(beforePacket, expectedEvent.detail.before), afterObservation = observation(afterPacket, expectedEvent.detail.after);
    const admission = rootedLineBefore(proposal, index, beforePacket.frame_rows, { epoch: beforeObservation.level_epoch,
      score: beforeObservation.levels_completed, observation_ref: beforeObservation.observation_ref, available: beforeObservation.available_action_refs });
    assert.equal(admission.admitted, true, 'The actual current binding admits each executed action');
    const outcome = rootedLineAfter(proposal, index, beforePacket.frame_rows, afterPacket.frame_rows,
      { epoch: afterObservation.level_epoch, score: afterObservation.levels_completed, state: afterObservation.state });
    if (index + 1 < events.length) assert.equal(outcome.seal_prefix, false, 'A continued actual prefix has an accepted preceding public projection');
    const beforeState = memory.currentState(), generated = memory.record(beforeObservation, nativeCommand, afterObservation,
      beforePacket.frame_rows, afterPacket.frame_rows, proposal, index);
    assert.deepEqual(generated, [expectedEvent], 'Actual pixels reproduce exactly the independently captured own event once');
    const afterState = memory.currentState();
    assert.equal(afterState.line_events.length, beforeState.line_events.length + 1);
    assert.deepEqual(afterState.line_memory, expectedEvent.memory);
    assert.deepEqual(afterState.line_events.at(-1), expectedEvent);
    const boundary = beforePacket.level !== afterPacket.level, beforeScene = measureRootedLine(beforePacket.frame_rows), afterScene = measureRootedLine(afterPacket.frame_rows);
    const refutationsAdded = afterState.line_memory.refuted.length - beforeState.line_memory.refuted.length;
    if (refutationsAdded) {
      assert.equal(refutationsAdded, 1);
      assert.equal(expectedEvent.detail.matched, false);
      assert.equal(outcome.seal_prefix, true);
      assert.equal(afterState.line_memory.current, null);
      assert.equal(index, events.length - 1, 'A refuted actual prediction seals the selected prefix');
    }
    transitions.push({ prefix: prefix.id, sequence: actual.sequence, levelBefore: beforePacket.level, levelAfter: afterPacket.level,
      detail: expectedEvent.detail, sceneBeforeMeasured: beforeScene !== null, sceneAfterMeasured: afterScene !== null,
      recomputedAdmission: admission, recomputedOutcome: outcome, memoryBefore: memorySummary(beforeState), memoryAfter: memorySummary(afterState),
      controlsChanged: !isDeepStrictEqual(beforeState.line_memory.controls, afterState.line_memory.controls),
      retainedConfigurationChanged: !isDeepStrictEqual(beforeState.line_memory.current, afterState.line_memory.current),
      refutationsAdded, acquiredEventIndex: afterState.line_events.length - 1 });
    if (boundary) {
      assert.equal(expectedEvent.detail.boundary, true); assert.equal(afterState.line_memory.current, null);
      const official = report.boundaries.find(item => item.totalActions === actual.sequence);
      assert.ok(official, 'The common campaign retains this natural scored boundary');
      boundaries.push({ sequence: actual.sequence, completedLevel: official.completedLevel, memory: memorySummary(afterState), event: expectedEvent });
    }
    lastOwnAfterReference = expectedEvent.detail.after;
  }
  selections.push({ prefix: prefix.id, level: plan.epoch, kind: plan.kind, why: plan.why, limit: ctx.limit, remaining: ctx.remaining,
    planned: proposal.actions.length, acquired: prefix.acquiredActions, ownEvents: events.length, search: plan.search,
    measuredPieces: plan.scene.pieces.length, requestedTypeOrder: plan.scene.order,
    memoryBefore: memorySummary(retained), memoryAfter: memorySummary(memory.currentState()), exactOwnPlanReproduced: true,
    exactActionsReproduced: true, restoredOwnLayerStateExact: true });
  actionCursor += prefix.acquiredActions;
}
assert.equal(actionCursor, report.actions.length, 'Every retained actual action belongs to a verified captured prefix');
assert.equal(memory.eventCount, previousEventCount);
assert.equal(new Set(transitions.map(item => JSON.stringify([item.detail.before, item.detail.after]))).size, transitions.length);
const finalOwner = restored(memory.currentState().line_events);
assert.deepEqual(finalOwner.currentState(), memory.currentState(), 'Final event replay restores exact owner state');
assert.equal(finalOwner.retainedDigest('independent-own-layer'), memory.retainedDigest('independent-own-layer'));
let terminalRefusal = null;
if (report.final.reason === 'frontier_unknown' && lastOwnAfterReference && transitions.at(-1)?.sequence === report.actions.length) {
  const packet = trace.packets.at(-1).packet, ctx = context(packet, lastOwnAfterReference, actionCursor), retained = memory.currentState();
  const reproduced = memory.propose(ctx.observed, packet.frame_rows, [], ctx.limit, ctx.config);
  assert.deepEqual(memory.currentState(), retained);
  const currentEpochRefuted = retained.line_memory.refuted.some(item => item.epoch === packet.level);
  if (currentEpochRefuted) {
    assert.equal(reproduced?.status, 'unknown'); assert.equal(reproduced?.reason, 'conditional_contact_model_refuted');
    assert.equal(reproduced?.block_unrelated_probe, true);
    ablateAt(reproduced, retained, packet, ctx, { kind: 'terminal_own_refusal', afterSequence: report.actions.length }, [['refuted']]);
  }
  terminalRefusal = { commonCampaignReason: report.final.reason, recomputedOwnDecision: decisionProjection(reproduced),
    currentEpochRefuted, refusalRespectsAcquiredRefutation: currentEpochRefuted && reproduced?.reason === 'conditional_contact_model_refuted',
    qualification: 'Recomputed own-layer decision from final acquired state and public return; not a captured extra controller call or a new game action.' };
}
const actionAblations = ablations.filter(item => item.actionOrRefusalChanged), decisionAblations = ablations.filter(item => item.decisionProjectionChanged);
const contributes = field => actionAblations.some(item => item.interventionChangedRetainedKnowledge && item.fieldsErased.length === 1 && item.fieldsErased[0] === field);
const result = {
  schema: 'logos-engine.observed-rooted-line-contribution.v1', status: selections.length ? 'passed' : 'no_selected_rooted_prefix',
  recordedAt: new Date().toISOString(), generator: { path: relative(ROOT, fileURLToPath(import.meta.url)), sha256: hash(await readFile(fileURLToPath(import.meta.url))) },
  inputs: { report: reportFile.receipt, trace: traceFile.receipt, publicJournal: journalFile.receipt, execution: executionFile.receipt,
    baselineReport: beforeFile.receipt, baselineTrace: beforeTrace.receipt, baselineJournal: beforeJournal.receipt,
    baselineExecution: beforeExecution.receipt, sourceManifest: manifestFile.receipt, sourcePolicy: policyFile.receipt },
  nativeSourceDigest: manifest.digest, game,
  scope: { ownRootedLayer: true, nonStagedV5Kernel: true, inheritedEphemeralMapClosureFullyTransferred: false,
    observedCompositionBranches: '4/6', completeV5V6Parity: false },
  baseline: { sourceDigest: baseline.source.digest, status: baseline.status, final: baseline.final, failure: baseline.failure,
    initialPublicPacketMatched: true, opaqueHostAssetHashesMatched: true, outerTimeout: beforeExecution.value.outerTimeout ?? null,
    actionCapReached: baseline.outerReferenceLimit?.actionCapReached ?? null },
  actual: { campaignStatus: report.status, targetMet: report.final.levelsCompleted >= report.targetLevels, final: report.final,
    failure: report.failure, selectedPrefixes: selections.length, selectedActions: transitions.length, selectedAcquisitions: transitions.length,
    foreignActions: foreignPrefixes.reduce((sum, p) => sum + p.acquired, 0), optionalZeroPrefixes,
    stateRestorations: selections.length + 1, naturalBoundaries: boundaries.length, acquiredRefutations: transitions.reduce((sum, t) => sum + t.refutationsAdded, 0),
    finalMemory: memorySummary(memory.currentState()) },
  contribution: { ablations: ablations.length, interventionsChangingRetainedKnowledge: ablations.filter(a => a.interventionChangedRetainedKnowledge).length,
    actionOrRefusalChanges: actionAblations.length, decisionProjectionChanges: decisionAblations.length,
    strictProposalChanges: ablations.filter(a => a.strictProposalChanged).length,
    strictOnlyChanges: ablations.filter(a => a.strictProposalChanged && !a.decisionProjectionChanged).length,
    searchDiagnosticChanges: ablations.filter(a => a.searchDiagnostics.changed).length,
    negativeOrUnchangedDecisions: ablations.length - decisionAblations.length,
    actionContributionObserved: actionAblations.some(a => a.interventionChangedRetainedKnowledge),
    planningContributionObserved: decisionAblations.some(a => a.interventionChangedRetainedKnowledge),
    controlsContribute: contributes('controls'), retainedConfigurationContributes: contributes('current'), triedControlsContribute: contributes('tried'),
    acquiredRefutationContributes: contributes('refuted'), noEffectIsRetainedAsNoEffect: true },
  selections, transitions, boundaries, foreignPrefixes, ablations, terminalRefusal,
  qualification: 'One actual common campaign is replayed from its complete public journal without opening a game, reading private game state or supplying a solution. Every selected own plan, command and acquisition is reconstructed from cold memory plus earlier verified events; current or future proposal memory never primes a decision. Before/after guards are recomputed component checks, not claimed captured calls. Event restoration proves this owner only; shared-owner restoration and Python source parity are separate gates. An actual failed conditional prediction is retained and seals its prefix. The terminal own refusal, when present, is independently recomputed from acquired refutation and is not an extra live action. The source conditional model remains a hypothesis. Ablations change only named acquired snapshot fields, never the journal; identity-only and search-only differences do not establish action contribution. No-effect results remain visible. Proof status describes reconstruction checks; actual.campaignStatus, actual.targetMet, final scores and failure preserve game success or failure separately. This is not a second live attempt, full private-state equality, complete V5/V6 transfer or a solved-game assertion.',
};
const output = resolve(ROOT, directory, 'rooted-line-contribution.json');
await writeFile(output, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ status: result.status, output: relative(ROOT, output), selectedPrefixes: selections.length,
  selectedActions: transitions.length, acquisitions: transitions.length, actionOrRefusalChanges: actionAblations.length,
  controlsContribute: result.contribution.controlsContribute, retainedConfigurationContributes: result.contribution.retainedConfigurationContributes,
  acquiredRefutationContributes: result.contribution.acquiredRefutationContributes, acquiredRefutations: result.actual.acquiredRefutations,
  terminalRefusal: terminalRefusal?.recomputedOwnDecision.reason ?? null, targetMet: result.actual.targetMet,
  campaignStatus: report.status, final: { actions: report.final.actions, levelsCompleted: report.final.levelsCompleted } }));
