/** Reconstruct reference-population decisions from earlier actual acquisitions.
 * Usage: node scripts/prove-observed-reference-population-contribution.mjs GAME FINAL BASELINE
 * This reads public journals and performs component replay; it never runs a game.
 */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { isDeepStrictEqual } from 'node:util';
import { ReferencePopulationMemory, referencePopulationBefore, referencePopulationAfter } from '../src/logos-engine/v6-reference-population-access.ts';
import { referencePopulationInputs, measureReferencePopulation } from '../src/logos-engine/v6-reference-population-observation.ts';
import { measureNativeObservation, ObservedInputDomain } from '../src/logos-engine/v6-native-observer.ts';
import { symbolicDigest } from '../src/logos-engine/v6-hash.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [game, directory, baselineDirectory] = process.argv.slice(2);
assert.match(game ?? '', /^[A-Z0-9]{4}$/);
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
  const state = projection.population_state;
  return { events: projection.population_events.length, controls: Object.keys(projection.population_controls).length,
    active: copy(state?.active ?? null), pending: copy(state?.pending ?? null), trials: state?.tried.length ?? 0,
    evidence: state?.evidence.length ?? 0, epoch: state?.epoch ?? null, sceneRetained: state?.scene != null,
    population: state?.scene.population ?? null, markerOverlays: state?.scene.observed_marker_overlays?.length ?? 0 };
}
function knowledgeProjection(projection) {
  return { controls: projection.population_controls, state: projection.population_state };
}
function decisionProjection(proposal) {
  const plan = proposal?.reference_population_plan;
  return { status: proposal?.status ?? null, reason: proposal?.reason ?? null, actions: proposal?.actions ?? [],
    mode: plan?.mode ?? null, why: plan?.why ?? null, chosen: plan?.chosen ?? null,
    expected: plan?.expected ?? null, beforeCells: plan?.before_cells ?? null,
    assignmentComplete: plan?.assignment_complete ?? null };
}
function actionProjection(proposal) {
  return { status: proposal?.status ?? null, reason: proposal?.reason ?? null, actions: proposal?.actions ?? [] };
}
function eraseSnapshot(event, fields) {
  for (const field of fields) {
    if (field === 'controls') event.controls = {};
    else if (field === 'active' || field === 'pending') { if (event.state) event.state[field] = null; }
    else if (field === 'tried') { if (event.state) event.state.tried = []; }
    else if (field === 'observed_marker_overlays') { if (event.state?.scene) delete event.state.scene.observed_marker_overlays; }
    else throw new Error('Unknown reference-population ablation field: ' + field);
  }
}
function restored(history, fields = []) {
  const owner = new ReferencePopulationMemory();
  for (const [index, original] of history.entries()) {
    const event = copy(original);
    if (index === history.length - 1) eraseSnapshot(event, fields);
    owner.applyEvent(event);
  }
  return owner;
}
function capturedTransitions(prefix) {
  const sources = ['inventoryAcquisition', 'reactionAcquisition', 'reactiveAcquisition', 'recolorAcquisition']
    .filter(key => Array.isArray(prefix[key]?.transitions));
  assert.ok(sources.length, 'The actual common prefix must retain its sealed transition identities independently of its own events');
  const transitions = prefix[sources[0]].transitions;
  for (const key of sources.slice(1)) assert.deepEqual(prefix[key].transitions, transitions, 'Independent captures retain the same sealed transitions');
  assert.equal(transitions.length, prefix.acquiredActions);
  return { transitions, sources };
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
assert.deepEqual(trace.packets[0], beforeTrace.value.packets[0], 'Both cold attempts share the complete initial public packet');
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

const capturedObservations = new Map(), observationReceipts = [], observationCache = new Map();
for (const call of report.inventorySourceCalls ?? []) for (const argument of call.arguments ?? []) {
  if (!argument || typeof argument !== 'object' || !Array.isArray(argument.entities) || typeof argument.observation_ref !== 'string') continue;
  const previous = capturedObservations.get(argument.observation_ref);
  if (previous) assert.deepEqual(argument, previous.observation, 'One public observation identity retains one measured value');
  else capturedObservations.set(argument.observation_ref, { observation: argument, callIndex: call.index, method: call.method });
}
async function observation(packet, reference) {
  const parsed = /^(.*):epoch:(\d+):revision:(\d+):frame:([a-f0-9]+)$/.exec(reference);
  assert.ok(parsed, 'The retained observation identity supplies its scope and revision');
  assert.equal(Number(parsed[2]), packet.level); assert.equal(parsed[4], packet.frame_hash);
  const old = observationCache.get(reference);
  if (old) { assert.equal(old.rasterDigest, symbolicDigest(packet.frame_rows)); return old.value; }
  const measured = await measureNativeObservation(packet, Number(parsed[3]), parsed[1]);
  assert.equal(measured.observation_ref, reference);
  const captured = capturedObservations.get(reference);
  if (captured) assert.deepEqual(measured, captured.observation, 'Complete remeasurement equals the actual captured Inventory observation');
  observationReceipts.push({ observationRef: reference, revision: measured.revision, level: measured.level_epoch,
    entities: measured.entities.length, rasterDigest: symbolicDigest(packet.frame_rows), measuredDigest: symbolicDigest(measured),
    capturedInventoryObservationMatched: captured !== undefined, captureCallIndex: captured?.callIndex ?? null, captureMethod: captured?.method ?? null });
  observationCache.set(reference, { rasterDigest: symbolicDigest(packet.frame_rows), value: measured });
  return measured;
}
const memory = new ReferencePopulationMemory(), selections = [], transitions = [], ablations = [], boundaries = [], foreignPrefixes = [];
let actionCursor = 0, previousEventCount = 0, lastOwnAfterReference = null, optionalZeroPrefixes = 0;
async function context(packet, reference, cursor) {
  const earlierLevelActions = report.actions.slice(0, cursor).filter(action => action.levelBefore === packet.level).length;
  const remaining = report.budget.levelActionCaps[packet.levels_completed] - earlierLevelActions;
  assert.ok(Number.isInteger(remaining) && remaining > 0);
  const observed = await observation(packet, reference);
  // Every inherited addition is a point candidate; this own source branch only
  // consumes the scalar inputs and supplies its own measured selection points.
  const inputs = [...new ObservedInputDomain(256).candidates(observed).filter(action => !Object.keys(action.data).length),
    ...referencePopulationInputs(packet.frame_rows, packet.available_action_refs)];
  return { observed, inputs, limit: Math.min(16, remaining), remaining,
    config: { ...baseConfig, remaining_level_actions: remaining, native_reference_population_bounds: true,
      native_reference_population_now: () => 0, level_deadline: Infinity } };
}
const fieldSets = [['controls'], ['active'], ['pending'], ['tried'], ['observed_marker_overlays'], ['controls', 'active']];
function ablateAt(actual, retained, packet, ctx, label) {
  for (const fields of fieldSets) {
    const counterfactual = restored(retained.population_events, fields), altered = counterfactual.currentState(), expected = copy(retained);
    if (retained.population_events.length) {
      eraseSnapshot(expected.population_events.at(-1), fields);
      expected.population_controls = copy(expected.population_events.at(-1).controls);
      expected.population_state = copy(expected.population_events.at(-1).state);
    }
    assert.deepEqual(altered, expected, 'Only named fields of the last acquired snapshot change');
    const alternativeProposal = counterfactual.propose(ctx.observed, packet.frame_rows, ctx.inputs, ctx.limit, ctx.config);
    const actualDecision = decisionProjection(actual), alternative = decisionProjection(alternativeProposal);
    ablations.push({ context: label, level: packet.level, fieldsErased: fields,
      interventionChangedRetainedKnowledge: !isDeepStrictEqual(knowledgeProjection(altered), knowledgeProjection(retained)),
      actualMemorySummary: memorySummary(retained), ablatedMemorySummary: memorySummary(altered),
      actualMemoryDigest: symbolicDigest(knowledgeProjection(retained)), ablatedMemoryDigest: symbolicDigest(knowledgeProjection(altered)),
      actionOrRefusalChanged: !isDeepStrictEqual(actionProjection(actual), actionProjection(alternativeProposal)),
      decisionProjectionChanged: !isDeepStrictEqual(actualDecision, alternative), strictProposalChanged: !isDeepStrictEqual(actual, alternativeProposal),
      actual: actualDecision, counterfactual: alternative,
      qualification: 'Counterfactual component replay at an actual public context. Only named fields of the last earlier acquired snapshot change; previous snapshots, transition details and actual public journals remain unchanged. Empty and negative interventions remain in the report. Identity-only differences are not action contribution.' });
  }
}

for (const prefix of report.prefixes) {
  const captured = prefix.observedReferencePopulation, series = prefix.sharedSeries ?? {};
  const hasEvents = Object.hasOwn(series, 'referencePopulationAcquiredEvents'), hasCount = Object.hasOwn(series, 'referencePopulationEventCount');
  assert.equal(hasEvents, hasCount, 'Optional own counters and event slices are present together');
  if (!hasEvents) {
    assert.equal(previousEventCount, 0, 'An acquired own count remains visible thereafter');
    assert.ok(!captured); optionalZeroPrefixes++;
  }
  const events = hasEvents ? series.referencePopulationAcquiredEvents : [];
  assert.ok(Array.isArray(events));
  if (hasCount) assert.equal(series.referencePopulationEventCount, previousEventCount + events.length);
  previousEventCount += events.length;
  if (!captured) {
    assert.equal(events.length, 0, 'A foreign selected proposal cannot acquire an own population event');
    foreignPrefixes.push({ prefix: prefix.id, family: prefix.family, acquired: prefix.acquiredActions,
      firstSequence: actionCursor + 1, ownEvents: 0 });
    actionCursor += prefix.acquiredActions; continue;
  }
  const proposal = captured.proposal, plan = proposal.reference_population_plan, packet = trace.packets[actionCursor].packet;
  assert.equal(captured.stateNode, 'family_state:public_occurrence_recall');
  assert.equal(prefix.fieldSubquestion, 'observed_composition_services'); assert.equal(prefix.family, 'public_occurrence_recall');
  assert.ok(events.length <= prefix.acquiredActions, 'Own acquisition cannot exceed actual selected returns');
  assert.equal(packet.level, plan.epoch); assert.equal(packet.levels_completed, plan.score);
  assert.equal(symbolicDigest(packet.frame_rows), plan.frame_digest);
  const ctx = await context(packet, plan.observation_ref, actionCursor), retained = memory.currentState();
  const reproduced = memory.propose(ctx.observed, packet.frame_rows, ctx.inputs, ctx.limit, ctx.config);
  assert.ok(reproduced?.reference_population_plan);
  assert.deepEqual(reproduced.reference_population_plan, plan, 'Every selected own plan reproduces from cold memory and earlier actual events only');
  assert.deepEqual(reproduced.actions, proposal.actions); assert.equal(reproduced.proposal_id, proposal.proposal_id);
  assert.deepEqual(memory.currentState(), retained, 'Planning does not acquire future evidence');
  const restoredOwner = restored(retained.population_events);
  assert.deepEqual(restoredOwner.currentState(), retained);
  assert.equal(restoredOwner.retainedDigest('independent-own-layer'), memory.retainedDigest('independent-own-layer'));
  assert.deepEqual(restoredOwner.propose(ctx.observed, packet.frame_rows, ctx.inputs, ctx.limit, ctx.config), reproduced);
  ablateAt(reproduced, retained, packet, ctx, { kind: 'selected_prefix', prefix: prefix.id });
  const sealed = capturedTransitions(prefix);
  let consumedEvents = 0, previousAfterReference = null;
  for (let index = 0; index < prefix.acquiredActions; index += 1) {
    const position = actionCursor + index, actual = report.actions[position], beforePacket = trace.packets[position].packet,
      afterPacket = trace.packets[position + 1].packet, nativeCommand = reproduced.actions[index], sealedTransition = sealed.transitions[index];
    assert.deepEqual(publicCommand(nativeCommand), actual.command, 'Public transport only materializes absent data as an empty object');
    assert.deepEqual(sealedTransition.command, nativeCommand);
    assert.equal(actual.decisionRevision, prefix.decisionRevision); assert.equal(actual.actionIndex, index);
    assert.equal(sealedTransition.before, index === 0 ? plan.observation_ref : previousAfterReference);
    previousAfterReference = sealedTransition.after;
    const beforeObservation = await observation(beforePacket, sealedTransition.before), afterObservation = await observation(afterPacket, sealedTransition.after);
    const admission = referencePopulationBefore(reproduced, index, beforePacket.frame_rows, { epoch: beforeObservation.level_epoch,
      score: beforeObservation.levels_completed, observation_ref: beforeObservation.observation_ref, available: beforeObservation.available_action_refs });
    assert.equal(admission.admitted, true, 'Each actual action remains admitted by its current population and reference');
    const outcome = referencePopulationAfter(reproduced, index, beforePacket.frame_rows, afterPacket.frame_rows,
      { epoch: afterObservation.level_epoch, score: afterObservation.levels_completed, state: afterObservation.state });
    if (index + 1 < prefix.acquiredActions) assert.equal(outcome.seal_prefix, false, 'A continued actual prefix follows a matched projection');
    const beforeState = memory.currentState(), generated = memory.record(beforeObservation, nativeCommand, afterObservation,
      beforePacket.frame_rows, afterPacket.frame_rows, reproduced, index), afterState = memory.currentState();
    assert.ok(generated.length <= 1);
    const expectedEvents = events.slice(consumedEvents, consumedEvents + generated.length);
    assert.deepEqual(generated, expectedEvents, 'Actual public returns reproduce each captured own event in order');
    consumedEvents += generated.length;
    assert.equal(afterState.population_events.length, beforeState.population_events.length + generated.length);
    const boundary = beforePacket.level !== afterPacket.level, expectedEvent = generated[0] ?? null;
    if (expectedEvent) {
      assert.equal(expectedEvent.kind, 'observed_reference_population'); assert.deepEqual(expectedEvent.detail.command, nativeCommand);
      assert.equal(expectedEvent.detail.before, sealedTransition.before); assert.equal(expectedEvent.detail.after, sealedTransition.after);
      assert.deepEqual(afterState.population_state, expectedEvent.state); assert.deepEqual(afterState.population_controls, expectedEvent.controls);
      assert.equal(expectedEvent.color_rule_status, 'observed_samples_only_no_complete_law');
      assert.equal(boundary, false, 'The source acquires own observations within one epoch');
    } else {
      assert.deepEqual(afterState, beforeState, 'A source-legitimate empty return acquires no own state');
      assert.equal(outcome.seal_prefix, true, 'An unmeasurable or boundary return seals this prefix');
    }
    const beforeScene = measureReferencePopulation(beforePacket.frame_rows, plan.scene);
    // Record intentionally does not project a new epoch through the previous
    // retained frame. Keep that source short-circuit in this diagnostic too.
    const afterScene = boundary ? null : measureReferencePopulation(afterPacket.frame_rows, afterState.population_state?.scene ?? plan.scene);
    transitions.push({ prefix: prefix.id, sequence: actual.sequence, levelBefore: beforePacket.level, levelAfter: afterPacket.level,
      before: sealedTransition.before, after: sealedTransition.after, referenceSources: sealed.sources,
      acquiredOwnEvent: expectedEvent !== null, detail: expectedEvent?.detail ?? null,
      emptyOwnAcquisitionReason: expectedEvent ? null : boundary ? 'epoch_boundary' : 'population_or_reference_revalidation_missing',
      sceneBeforeMeasured: beforeScene !== null, sceneAfterMeasured: afterScene !== null,
      afterSceneMeasurementSkipped: boundary ? 'epoch_boundary' : null,
      recomputedAdmission: admission, recomputedOutcome: outcome,
      memoryBefore: memorySummary(beforeState), memoryAfter: memorySummary(afterState),
      controlsChanged: !isDeepStrictEqual(beforeState.population_controls, afterState.population_controls),
      activeChanged: !isDeepStrictEqual(beforeState.population_state?.active, afterState.population_state?.active),
      markerOverlaysChanged: !isDeepStrictEqual(beforeState.population_state?.scene.observed_marker_overlays, afterState.population_state?.scene.observed_marker_overlays),
      acquiredEventIndex: expectedEvent ? afterState.population_events.length - 1 : null });
    if (boundary) {
      const official = report.boundaries.find(item => item.totalActions === actual.sequence);
      assert.ok(official, 'The common campaign retains this natural scored boundary');
      boundaries.push({ sequence: actual.sequence, completedLevel: official.completedLevel,
        acquiredOwnEvent: expectedEvent !== null, memory: memorySummary(afterState) });
    }
    lastOwnAfterReference = sealedTransition.after;
  }
  assert.equal(consumedEvents, events.length, 'Every captured own event belongs to an actual selected return');
  assert.equal(memory.eventCount, previousEventCount);
  selections.push({ prefix: prefix.id, level: plan.epoch, mode: plan.mode, why: plan.why, limit: ctx.limit, remaining: ctx.remaining,
    planned: proposal.actions.length, acquired: prefix.acquiredActions, ownEvents: events.length,
    population: plan.scene.population, targetCells: plan.scene.target.length, assignmentComplete: plan.assignment_complete,
    memoryBefore: memorySummary(retained), memoryAfter: memorySummary(memory.currentState()), exactOwnPlanReproduced: true,
    exactActionsReproduced: true, restoredOwnLayerStateExact: true });
  actionCursor += prefix.acquiredActions;
}
assert.equal(actionCursor, report.actions.length, 'All retained actual actions belong to a captured prefix');
assert.equal(memory.eventCount, previousEventCount);
assert.equal(new Set(transitions.map(item => JSON.stringify([item.before, item.after]))).size, transitions.length);
const finalOwner = restored(memory.currentState().population_events);
assert.deepEqual(finalOwner.currentState(), memory.currentState());
assert.equal(finalOwner.retainedDigest('independent-own-layer'), memory.retainedDigest('independent-own-layer'));
let terminalRefusal = null;
if (report.final.reason === 'frontier_unknown' && lastOwnAfterReference && transitions.at(-1)?.sequence === report.actions.length) {
  const packet = trace.packets.at(-1).packet, ctx = await context(packet, lastOwnAfterReference, actionCursor), retained = memory.currentState();
  const reproduced = memory.propose(ctx.observed, packet.frame_rows, ctx.inputs, ctx.limit, ctx.config);
  assert.deepEqual(memory.currentState(), retained);
  if (reproduced?.status === 'unknown' && reproduced.block_unrelated_probe === true) {
    ablateAt(reproduced, retained, packet, ctx, { kind: 'terminal_own_refusal', afterSequence: report.actions.length });
  }
  terminalRefusal = { commonCampaignReason: report.final.reason, recomputedOwnDecision: decisionProjection(reproduced),
    qualification: 'Own-layer decision recomputed from the final public return and earlier acquired state. This is neither an additional captured controller call nor a new game action.' };
}
const actionAblations = ablations.filter(item => item.actionOrRefusalChanged), decisionAblations = ablations.filter(item => item.decisionProjectionChanged);
const contributes = field => actionAblations.some(item => item.interventionChangedRetainedKnowledge && item.fieldsErased.length === 1 && item.fieldsErased[0] === field);
const result = {
  schema: 'logos-engine.observed-reference-population-contribution.v1', status: selections.length ? 'passed' : 'no_selected_reference_population_prefix',
  recordedAt: new Date().toISOString(), generator: { path: relative(ROOT, fileURLToPath(import.meta.url)), sha256: hash(await readFile(fileURLToPath(import.meta.url))) },
  inputs: { report: reportFile.receipt, trace: traceFile.receipt, publicJournal: journalFile.receipt, execution: executionFile.receipt,
    baselineReport: beforeFile.receipt, baselineTrace: beforeTrace.receipt, baselineJournal: beforeJournal.receipt,
    baselineExecution: beforeExecution.receipt, sourceManifest: manifestFile.receipt, sourcePolicy: policyFile.receipt },
  nativeSourceDigest: manifest.digest, game,
  scope: { ownReferencePopulationLayer: true, consumedV5MatchingAndSelectedCardinalMove: true, nativeSeparatePopulationJournal: true,
    sourceZeroAcquisitionPreserved: true, nativeFiniteProposalBounds: true, componentReplayClock: 'constant_zero_with_no_level_deadline',
    wallTimeOrCostReplay: false, appearanceLawInferred: false, inheritedEphemeralMapClosureFullyTransferred: false,
    observedCompositionBranches: '6/6', completeV5V6Parity: false },
  baseline: { sourceDigest: baseline.source.digest, status: baseline.status, final: baseline.final, failure: baseline.failure,
    initialPublicPacketMatched: true, opaqueHostAssetHashesMatched: true, outerTimeout: beforeExecution.value.outerTimeout ?? null,
    actionCapReached: baseline.outerReferenceLimit?.actionCapReached ?? null },
  actual: { campaignStatus: report.status, targetMet: report.final.levelsCompleted >= report.targetLevels, final: report.final,
    failure: report.failure, selectedPrefixes: selections.length, selectedActions: transitions.length,
    selectedAcquisitions: transitions.filter(item => item.acquiredOwnEvent).length,
    zeroOwnAcquisitionActions: transitions.filter(item => !item.acquiredOwnEvent).length,
    foreignActions: foreignPrefixes.reduce((sum, prefix) => sum + prefix.acquired, 0), optionalZeroPrefixes,
    stateRestorations: selections.length + 1, naturalBoundaries: boundaries.length, finalMemory: memorySummary(memory.currentState()) },
  contribution: { ablations: ablations.length, interventionsChangingRetainedKnowledge: ablations.filter(item => item.interventionChangedRetainedKnowledge).length,
    actionOrRefusalChanges: actionAblations.length, decisionProjectionChanges: decisionAblations.length,
    strictProposalChanges: ablations.filter(item => item.strictProposalChanged).length,
    strictOnlyChanges: ablations.filter(item => item.strictProposalChanged && !item.decisionProjectionChanged).length,
    negativeOrUnchangedDecisions: ablations.length - decisionAblations.length,
    actionContributionObserved: actionAblations.some(item => item.interventionChangedRetainedKnowledge),
    planningContributionObserved: decisionAblations.some(item => item.interventionChangedRetainedKnowledge),
    controlsContribute: contributes('controls'), activeIdentityContributes: contributes('active'), pendingSelectionContributes: contributes('pending'),
    triedInputsContribute: contributes('tried'), markerOverlaysContribute: contributes('observed_marker_overlays'), noEffectIsRetainedAsNoEffect: true },
  observations: observationReceipts, selections, transitions, boundaries, foreignPrefixes, ablations, terminalRefusal,
  qualification: 'Cold own-layer reconstruction uses the actual public journal and earlier acquired events, without a game, private state or solution. Captured proposal.state never primes planning or acquisition: the independently reproduced proposal supplies record. Complete observations are remeasured and checked against captured Inventory observations when present; sealed common transition identities cover empty own returns as well as acquisitions. Guards are recomputed component checks, not claimed captured guard calls. Fixed replay time removes wall-clock nondeterminism while finite node/domain bounds remain active; this proves neither timing nor costs. Source continuation may accept a changed receiving-zone corner; source unknowns and empty boundary/revalidation acquisitions remain qualified. Preparing occupancy supplies no complete appearance law or terminal meaning. Shared-owner restoration and original source parity have separate evidence. Ablations preserve negative results and never establish action contribution from identities alone. Proof status describes reconstruction, while actual.targetMet, scores and failures remain authoritative. This is not another live attempt or complete inherited-caller/V5/V6 parity.',
};
const output = resolve(ROOT, directory, 'reference-population-contribution.json');
await writeFile(output, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ status: result.status, output: relative(ROOT, output), selectedPrefixes: selections.length,
  selectedActions: transitions.length, acquisitions: result.actual.selectedAcquisitions, zeroOwnAcquisitions: result.actual.zeroOwnAcquisitionActions,
  actionOrRefusalChanges: actionAblations.length, controlsContribute: result.contribution.controlsContribute,
  activeIdentityContributes: result.contribution.activeIdentityContributes, pendingSelectionContributes: result.contribution.pendingSelectionContributes,
  terminalRefusal: terminalRefusal?.recomputedOwnDecision.reason ?? null, targetMet: result.actual.targetMet,
  campaignStatus: report.status, final: { actions: report.final.actions, levelsCompleted: report.final.levelsCompleted } }));
