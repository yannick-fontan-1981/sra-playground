/** Reconstruct reception-service selections from earlier actually acquired events.
 * Usage: node scripts/prove-observed-reception-service-contribution.mjs GAME FINAL BASELINE
 * Counterfactual memory ablations are component diagnostics, never game inputs.
 */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { isDeepStrictEqual } from 'node:util';
import { ReceptionServiceMemory, receptionServiceBefore, receptionServiceAfter } from '../src/logos-engine/v6-reception-service-access.ts';
import { measureReceptionService } from '../src/logos-engine/v6-reception-service-observation.ts';
import { measureNativeObservation, ObservedInputDomain } from '../src/logos-engine/v6-native-observer.ts';
import { symbolicDigest } from '../src/logos-engine/v6-hash.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [game, directory, baselineDirectory] = process.argv.slice(2);
assert.match(game ?? '', /^[A-Z0-9]{4}$/);
assert.ok(!['CWSE', 'SK48'].includes(game), 'Previously bounded cases are excluded from this independent reception delivery');
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
function memorySummary(projection) {
  const state = projection.reception_memory;
  return { events: projection.reception_events.length, controls: Object.keys(state.controls).length,
    trials: copy(state.trials), evidence: state.evidence.length, waitSpent: state.wait_spent,
    stationary: copy(state.stationary ?? {}), residualEvents: state.residual_events.length,
    refutations: state.refuted.length, epoch: state.epoch, sceneRetained: state.scene !== null };
}
function decisionProjection(proposal) {
  const plan = proposal?.reception_service_plan;
  return { status: proposal?.status ?? null, reason: proposal?.reason ?? null, actions: proposal?.actions ?? [],
    kind: plan?.kind ?? null, why: plan?.why ?? null, steps: plan?.steps ?? null };
}
function actionProjection(proposal) {
  return { status: proposal?.status ?? null, reason: proposal?.reason ?? null, actions: proposal?.actions ?? [] };
}
function erase(memory, fields) {
  for (const field of fields) {
    if (field === 'controls' || field === 'trials') memory[field] = {};
    else if (field === 'stationary') delete memory.stationary;
    else if (field === 'wait_spent') memory.wait_spent = 0;
    else if (field === 'refuted') memory.refuted = [];
    else throw new Error('Unknown reception-service ablation field: ' + field);
  }
}
function restored(history, fields = []) {
  const memory = new ReceptionServiceMemory({ currentEpochAcquisition: true });
  for (const [index, original] of history.entries()) {
    const event = copy(original);
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
assert.deepEqual(trace.packets, journalFile.value, 'Candidate public trace matches the independently retained actual journal');
assert.deepEqual(beforeTrace.value.packets, beforeJournal.value, 'Baseline public trace matches its independently retained actual journal');
assert.deepEqual(trace.packets[0], beforeTrace.value.packets[0], 'Both cold attempts have the same complete initial public packet');
assert.deepEqual(report.gameAssets, baseline.gameAssets, 'Opaque host asset hashes match the retained baseline');
assert.equal(trace.packets.length, report.actions.length + 1);
for (const [index, entry] of trace.packets.entries()) {
  assert.equal(entry.packet.step_index, index);
  assert.equal(symbolicDigest(entry.packet.frame_rows).slice(0, 16), entry.packet.frame_hash);
  if (index) assert.deepEqual(entry.command, report.actions[index - 1].command);
  else assert.equal(entry.command, null);
}
const policyFile = await read('reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/morphology_policy/strategy.drm');
const baseConfig = policyFile.value.declarations[0].configuration.observed_composition_services;

// The residual reducer consumes measured entities and revision. Reconstruct the
// full observation from public pixels and its exact identity, then compare it
// with the separately captured Inventory call when that call is available.
const capturedObservations = new Map(), observationReceipts = [], observationCache = new Map();
for (const call of report.inventorySourceCalls ?? []) for (const argument of call.arguments ?? []) {
  if (!argument || typeof argument !== 'object' || !Array.isArray(argument.entities) || typeof argument.observation_ref !== 'string') continue;
  const previous = capturedObservations.get(argument.observation_ref);
  if (previous) assert.deepEqual(argument, previous.observation, 'One public observation identity retains one measured value');
  else capturedObservations.set(argument.observation_ref, { observation: argument, callIndex: call.index, method: call.method });
}
async function observation(packet, reference) {
  const parsed = /^(.*):epoch:(\d+):revision:(\d+):frame:([a-f0-9]+)$/.exec(reference);
  assert.ok(parsed, 'Actual observation identity supplies its scope and revision');
  assert.equal(Number(parsed[2]), packet.level); assert.equal(parsed[4], packet.frame_hash);
  const old = observationCache.get(reference);
  if (old) { assert.equal(old.rasterDigest, symbolicDigest(packet.frame_rows)); return old.value; }
  const measured = await measureNativeObservation(packet, Number(parsed[3]), parsed[1]);
  assert.equal(measured.observation_ref, reference);
  const captured = capturedObservations.get(reference);
  if (captured) assert.deepEqual(measured, captured.observation, 'Recomputed complete observation equals the actual measured Inventory observation');
  observationReceipts.push({ observationRef: reference, revision: measured.revision, level: measured.level_epoch,
    entities: measured.entities.length, rasterDigest: symbolicDigest(packet.frame_rows), measuredDigest: symbolicDigest(measured),
    capturedInventoryObservationMatched: captured !== undefined, captureCallIndex: captured?.callIndex ?? null, captureMethod: captured?.method ?? null });
  observationCache.set(reference, { rasterDigest: symbolicDigest(packet.frame_rows), value: measured }); return measured;
}
const memory = new ReceptionServiceMemory({ currentEpochAcquisition: true });
const selections = [], transitions = [], ablations = [], boundaries = [], foreignPrefixes = [];
let actionCursor = 0, previousEventCount = 0, lastOwnAfterReference = null, optionalZeroPrefixes = 0;
async function context(packet, reference, cursor) {
  const earlierLevelActions = report.actions.slice(0, cursor).filter(action => action.levelBefore === packet.level).length;
  const remaining = report.budget.levelActionCaps[packet.levels_completed] - earlierLevelActions;
  assert.ok(Number.isInteger(remaining) && remaining > 0);
  const observed = await observation(packet, reference);
  const inputs = new ObservedInputDomain(256).candidates(observed).filter(action => !Object.keys(action.data).length);
  return { observed, inputs, limit: Math.min(16, remaining), remaining,
    config: { ...baseConfig, remaining_level_actions: remaining, native_reception_wait_budget: true } };
}
function ablateAt(actual, retained, packet, ctx, label, fieldSets) {
  for (const fields of fieldSets) {
    const counterfactual = restored(retained.reception_events, fields), altered = counterfactual.currentState(), expected = copy(retained);
    if (retained.reception_events.length) { erase(expected.reception_memory, fields); erase(expected.reception_events.at(-1).memory, fields); }
    assert.deepEqual(altered, expected, 'Only named fields of the final acquired snapshot may change');
    const alternativeProposal = counterfactual.propose(ctx.observed, packet.frame_rows, ctx.inputs, ctx.limit, ctx.config);
    const actualDecision = decisionProjection(actual), alternative = decisionProjection(alternativeProposal);
    ablations.push({ context: label, level: packet.level, fieldsErased: fields,
      interventionChangedRetainedKnowledge: !isDeepStrictEqual(altered.reception_memory, retained.reception_memory),
      actualMemorySummary: memorySummary(retained), ablatedMemorySummary: memorySummary(altered),
      actualMemoryDigest: symbolicDigest(retained.reception_memory), ablatedMemoryDigest: symbolicDigest(altered.reception_memory),
      actionOrRefusalChanged: !isDeepStrictEqual(actionProjection(actual), actionProjection(alternativeProposal)),
      decisionProjectionChanged: !isDeepStrictEqual(actualDecision, alternative), strictProposalChanged: !isDeepStrictEqual(actual, alternativeProposal),
      actual: actualDecision, counterfactual: alternative,
      qualification: 'Counterfactual component replay at an actual public context from earlier acquired events only. The intervention changes named fields of the last acquired snapshot, while earlier snapshots, transition details and the complete game journal remain unchanged. Identity-only differences are not action contribution. Empty and negative interventions are retained.' });
  }
}

for (const prefix of report.prefixes) {
  const captured = prefix.observedReceptionService, series = prefix.sharedSeries ?? {};
  const hasEvents = Object.hasOwn(series, 'receptionServiceAcquiredEvents'), hasCount = Object.hasOwn(series, 'receptionServiceEventCount');
  assert.equal(hasEvents, hasCount, 'Optional reception counters and event slices are present together');
  if (!hasEvents) {
    assert.equal(previousEventCount, 0, 'Reception event count remains visible after its first acquisition');
    assert.ok(!captured); optionalZeroPrefixes++;
  }
  const events = hasEvents ? series.receptionServiceAcquiredEvents : [];
  assert.ok(Array.isArray(events));
  if (hasCount) assert.equal(series.receptionServiceEventCount, previousEventCount + events.length);
  previousEventCount += events.length;
  if (!captured) {
    assert.equal(events.length, 0, 'Foreign proposals cannot acquire a selected reception-service event');
    foreignPrefixes.push({ prefix: prefix.id, family: prefix.family, acquired: prefix.acquiredActions,
      firstSequence: actionCursor + 1, ownEvents: 0 });
    actionCursor += prefix.acquiredActions; continue;
  }
  const proposal = captured.proposal, plan = proposal.reception_service_plan, packet = trace.packets[actionCursor].packet;
  assert.equal(captured.stateNode, 'family_state:public_occurrence_recall');
  assert.equal(prefix.fieldSubquestion, 'observed_composition_services'); assert.equal(prefix.family, 'public_occurrence_recall');
  assert.equal(events.length, prefix.acquiredActions, 'Each selected return acquires exactly one own event, including missing scenes and boundaries');
  assert.equal(packet.level, plan.epoch); assert.equal(packet.levels_completed, plan.score);
  assert.equal(symbolicDigest(packet.frame_rows), plan.frame_digest);
  const ctx = await context(packet, plan.observation_ref, actionCursor), retained = memory.currentState();
  const reproduced = memory.propose(ctx.observed, packet.frame_rows, ctx.inputs, ctx.limit, ctx.config);
  assert.ok(reproduced?.reception_service_plan);
  assert.deepEqual(reproduced.reception_service_plan, plan, 'Every selected own plan reproduces from cold memory and earlier actual events, never captured plan memory');
  assert.deepEqual(reproduced.actions, proposal.actions); assert.equal(reproduced.proposal_id, proposal.proposal_id);
  assert.deepEqual(memory.currentState(), retained, 'Planning does not acquire future evidence');
  const restoredOwner = restored(retained.reception_events);
  assert.deepEqual(restoredOwner.currentState(), retained);
  assert.equal(restoredOwner.retainedDigest('independent-own-layer'), memory.retainedDigest('independent-own-layer'));
  assert.deepEqual(restoredOwner.propose(ctx.observed, packet.frame_rows, ctx.inputs, ctx.limit, ctx.config), reproduced);
  ablateAt(reproduced, retained, packet, ctx, { kind: 'selected_prefix', prefix: prefix.id },
    [['controls'], ['trials'], ['stationary'], ['wait_spent'], ['refuted'], ['controls', 'trials']]);
  for (const [index, expectedEvent] of events.entries()) {
    const position = actionCursor + index, actual = report.actions[position], beforePacket = trace.packets[position].packet,
      afterPacket = trace.packets[position + 1].packet, nativeCommand = proposal.actions[index];
    assert.deepEqual(publicCommand(nativeCommand), actual.command, 'Public commands only materialize absent data as an empty object');
    assert.equal(expectedEvent.kind, 'observed_reception_service'); assert.deepEqual(expectedEvent.detail.command, nativeCommand);
    assert.equal(expectedEvent.detail.before, index === 0 ? plan.observation_ref : events[index - 1].detail.after);
    const beforeObservation = await observation(beforePacket, expectedEvent.detail.before), afterObservation = await observation(afterPacket, expectedEvent.detail.after);
    const admission = receptionServiceBefore(proposal, index, beforePacket.frame_rows, { epoch: beforeObservation.level_epoch,
      score: beforeObservation.levels_completed, observation_ref: beforeObservation.observation_ref, available: beforeObservation.available_action_refs });
    assert.equal(admission.admitted, true, 'The actual current binding admits each executed action');
    const outcome = receptionServiceAfter(proposal, index, beforePacket.frame_rows, afterPacket.frame_rows,
      { epoch: afterObservation.level_epoch, score: afterObservation.levels_completed, state: afterObservation.state });
    if (index + 1 < events.length) assert.equal(outcome.seal_prefix, false, 'Every continued actual prefix follows a matched public projection');
    const beforeState = memory.currentState(), generated = memory.record(beforeObservation, nativeCommand, afterObservation,
      beforePacket.frame_rows, afterPacket.frame_rows, proposal, index);
    assert.deepEqual(generated, [expectedEvent], 'Actual public pixels and measured entities reproduce the captured own event exactly once');
    const afterState = memory.currentState();
    assert.equal(afterState.reception_events.length, beforeState.reception_events.length + 1);
    assert.deepEqual(afterState.reception_memory, expectedEvent.memory); assert.deepEqual(afterState.reception_events.at(-1), expectedEvent);
    const boundary = beforePacket.level !== afterPacket.level;
    const beforeScene = measureReceptionService(beforePacket.frame_rows, plan.scene), afterScene = measureReceptionService(afterPacket.frame_rows, beforeScene);
    const currentEpochReset = beforeState.reception_memory.epoch !== beforeObservation.level_epoch;
    const residualEventsAdded = afterState.reception_memory.residual_events.length - beforeState.reception_memory.residual_events.length;
    assert.ok(residualEventsAdded >= 0, 'Acquired residual evidence is retained across epochs');
    assert.equal(afterState.reception_memory.epoch, beforeObservation.level_epoch);
    if (expectedEvent.detail.matched === false) {
      assert.equal(outcome.seal_prefix, true); assert.equal(index, events.length - 1, 'A refuted actual prediction seals its prefix');
      assert.deepEqual(afterState.reception_memory.refuted.at(-1), expectedEvent.detail);
    }
    const startingWait = currentEpochReset ? plan.memory.wait_spent : beforeState.reception_memory.wait_spent;
    const acquiredWait = !boundary && plan.kind === 'reception_observation' ? 1 : 0;
    assert.equal(afterState.reception_memory.wait_spent, startingWait + acquiredWait);
    assert.ok(afterState.reception_memory.wait_spent <= 128, 'Own cumulative waiting never exceeds the unchanged source ceiling');
    transitions.push({ prefix: prefix.id, sequence: actual.sequence, levelBefore: beforePacket.level, levelAfter: afterPacket.level,
      detail: expectedEvent.detail, sceneBeforeMeasured: beforeScene !== null, sceneAfterMeasured: afterScene !== null,
      recomputedAdmission: admission, recomputedOutcome: outcome, memoryBefore: memorySummary(beforeState), memoryAfter: memorySummary(afterState),
      controlsChanged: !isDeepStrictEqual(beforeState.reception_memory.controls, afterState.reception_memory.controls),
      stationaryChanged: !isDeepStrictEqual(beforeState.reception_memory.stationary, afterState.reception_memory.stationary),
      currentEpochResetCommitted: currentEpochReset, acquiredWait, residualEventsAdded,
      acquiredRefutation: expectedEvent.detail.matched === false, acquiredEventIndex: afterState.reception_events.length - 1 });
    if (boundary) {
      assert.equal(expectedEvent.detail.boundary, true);
      const official = report.boundaries.find(item => item.totalActions === actual.sequence);
      assert.ok(official, 'The common campaign retains this natural scored boundary');
      boundaries.push({ sequence: actual.sequence, completedLevel: official.completedLevel, memory: memorySummary(afterState), event: expectedEvent });
    }
    lastOwnAfterReference = expectedEvent.detail.after;
  }
  selections.push({ prefix: prefix.id, level: plan.epoch, kind: plan.kind, why: plan.why, limit: ctx.limit, remaining: ctx.remaining,
    planned: proposal.actions.length, acquired: prefix.acquiredActions, ownEvents: events.length, target: plan.scene.target.anchor,
    measuredSupports: plan.scene.support_candidates.length, requestCounterparts: plan.scene.counterparts.length,
    memoryBefore: memorySummary(retained), memoryAfter: memorySummary(memory.currentState()), exactOwnPlanReproduced: true,
    exactActionsReproduced: true, restoredOwnLayerStateExact: true });
  actionCursor += prefix.acquiredActions;
}
assert.equal(actionCursor, report.actions.length, 'Every retained actual action belongs to a captured prefix');
assert.equal(memory.eventCount, previousEventCount);
assert.equal(new Set(transitions.map(item => JSON.stringify([item.detail.before, item.detail.after]))).size, transitions.length);
const finalOwner = restored(memory.currentState().reception_events);
assert.deepEqual(finalOwner.currentState(), memory.currentState());
assert.equal(finalOwner.retainedDigest('independent-own-layer'), memory.retainedDigest('independent-own-layer'));
let terminalRefusal = null;
if (report.final.reason === 'frontier_unknown' && lastOwnAfterReference && transitions.at(-1)?.sequence === report.actions.length) {
  const packet = trace.packets.at(-1).packet, ctx = await context(packet, lastOwnAfterReference, actionCursor), retained = memory.currentState();
  const reproduced = memory.propose(ctx.observed, packet.frame_rows, ctx.inputs, ctx.limit, ctx.config);
  assert.deepEqual(memory.currentState(), retained);
  if (reproduced?.status === 'unknown' && reproduced.block_unrelated_probe === true) {
    ablateAt(reproduced, retained, packet, ctx, { kind: 'terminal_own_refusal', afterSequence: report.actions.length },
      [['refuted'], ['wait_spent'], ['controls'], ['trials'], ['stationary']]);
  }
  terminalRefusal = { commonCampaignReason: report.final.reason, recomputedOwnDecision: decisionProjection(reproduced),
    currentEpochRefuted: retained.reception_memory.epoch === packet.level && retained.reception_memory.refuted.length > 0,
    waitSpent: retained.reception_memory.wait_spent,
    qualification: 'Recomputed own-layer decision from final acquired state and public return, not a captured extra controller call or new game action.' };
}
const actionAblations = ablations.filter(item => item.actionOrRefusalChanged), decisionAblations = ablations.filter(item => item.decisionProjectionChanged);
const contributes = field => actionAblations.some(item => item.interventionChangedRetainedKnowledge && item.fieldsErased.length === 1 && item.fieldsErased[0] === field);
const result = {
  schema: 'logos-engine.observed-reception-service-contribution.v1', status: selections.length ? 'passed' : 'no_selected_reception_prefix',
  recordedAt: new Date().toISOString(), generator: { path: relative(ROOT, fileURLToPath(import.meta.url)), sha256: hash(await readFile(fileURLToPath(import.meta.url))) },
  inputs: { report: reportFile.receipt, trace: traceFile.receipt, publicJournal: journalFile.receipt, execution: executionFile.receipt,
    baselineReport: beforeFile.receipt, baselineTrace: beforeTrace.receipt, baselineJournal: beforeJournal.receipt,
    baselineExecution: beforeExecution.receipt, sourceManifest: manifestFile.receipt, sourcePolicy: policyFile.receipt },
  nativeSourceDigest: manifest.digest, game,
  scope: { ownReceptionServiceLayer: true, consumedResidualRecordOnly: true, unchangedV5WaitCeiling: 128,
    nativeSeparateReceptionJournals: true, nativeCurrentEpochAcquisition: true, nativeWaitExhaustionBlocks: true,
    inheritedEphemeralMapClosureFullyTransferred: false, observedCompositionBranches: '5/6', completeV5V6Parity: false },
  baseline: { sourceDigest: baseline.source.digest, status: baseline.status, final: baseline.final, failure: baseline.failure,
    initialPublicPacketMatched: true, opaqueHostAssetHashesMatched: true, outerTimeout: beforeExecution.value.outerTimeout ?? null,
    actionCapReached: baseline.outerReferenceLimit?.actionCapReached ?? null },
  actual: { campaignStatus: report.status, targetMet: report.final.levelsCompleted >= report.targetLevels, final: report.final,
    failure: report.failure, selectedPrefixes: selections.length, selectedActions: transitions.length, selectedAcquisitions: transitions.length,
    foreignActions: foreignPrefixes.reduce((sum, p) => sum + p.acquired, 0), optionalZeroPrefixes,
    stateRestorations: selections.length + 1, naturalBoundaries: boundaries.length,
    acquiredRefutations: transitions.filter(t => t.acquiredRefutation).length,
    acquiredWaitActions: transitions.reduce((sum, t) => sum + t.acquiredWait, 0),
    finalMemory: memorySummary(memory.currentState()) },
  contribution: { ablations: ablations.length, interventionsChangingRetainedKnowledge: ablations.filter(a => a.interventionChangedRetainedKnowledge).length,
    actionOrRefusalChanges: actionAblations.length, decisionProjectionChanges: decisionAblations.length,
    strictProposalChanges: ablations.filter(a => a.strictProposalChanged).length,
    strictOnlyChanges: ablations.filter(a => a.strictProposalChanged && !a.decisionProjectionChanged).length,
    negativeOrUnchangedDecisions: ablations.length - decisionAblations.length,
    actionContributionObserved: actionAblations.some(a => a.interventionChangedRetainedKnowledge),
    planningContributionObserved: decisionAblations.some(a => a.interventionChangedRetainedKnowledge),
    controlsContribute: contributes('controls'), trialsContribute: contributes('trials'), stationaryContributes: contributes('stationary'),
    cumulativeWaitContributes: contributes('wait_spent'), acquiredRefutationContributes: contributes('refuted'), noEffectIsRetainedAsNoEffect: true },
  observations: observationReceipts, selections, transitions, boundaries, foreignPrefixes, ablations, terminalRefusal,
  qualification: 'The common campaign is replayed cold from its public journal without a game, private state or solution. Each selected own plan, action and acquisition is reconstructed from earlier actual events only. Full measured observations, including entities and revisions needed by the residual reducer, are independently remeasured and checked against captured Inventory observations when present. Captured proposal.memory never primes a decision. Before/after guards are recomputed component checks, not claimed captured calls. Shared-owner restoration and original source parity have separate evidence; native journal separation, current-epoch acquisition and bounded wait rejection are explicit extensions. An acquired wait increments once and only within its level; 128 remains the source ceiling. Ablations preserve negative results and never establish action contribution from identities alone. Proof status describes reconstruction, not game success; actual.targetMet, scores and failures remain authoritative. This is not another live attempt, complete inherited-caller parity or complete V5/V6 transfer.',
};
const output = resolve(ROOT, directory, 'reception-service-contribution.json');
await writeFile(output, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ status: result.status, output: relative(ROOT, output), selectedPrefixes: selections.length,
  selectedActions: transitions.length, acquisitions: transitions.length, actionOrRefusalChanges: actionAblations.length,
  controlsContribute: result.contribution.controlsContribute, stationaryContributes: result.contribution.stationaryContributes,
  cumulativeWaitContributes: result.contribution.cumulativeWaitContributes, acquiredRefutationContributes: result.contribution.acquiredRefutationContributes,
  terminalRefusal: terminalRefusal?.recomputedOwnDecision.reason ?? null, targetMet: result.actual.targetMet,
  campaignStatus: report.status, final: { actions: report.final.actions, levelsCompleted: report.final.levelsCompleted } }));
