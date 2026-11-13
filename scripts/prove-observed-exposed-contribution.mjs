/** Reconstruct selected exposed-reception decisions from earlier real events.
 * Usage: node scripts/prove-observed-exposed-contribution.mjs GAME FINAL BASELINE
 * Counterfactual memory ablations are component diagnostics, never game inputs.
 */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { isDeepStrictEqual } from 'node:util';
import { ExposedReceptionMemory, exposedReceptionBefore, exposedReceptionAfter, freshReceptionModels } from '../src/logos-engine/v6-exposed-reception-access.ts';
import { measureExposedReception, exposedReceptionInputCandidates } from '../src/logos-engine/v6-exposed-reception-observation.ts';
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
function observation(packet, reference) {
  return { level_epoch: packet.level, levels_completed: packet.levels_completed, observation_ref: reference,
    available_action_refs: packet.available_action_refs, frame_hash: packet.frame_hash, state: packet.state };
}
function memorySummary(projection) {
  const models = projection.reception_models, state = projection.reception_state;
  return { events: projection.reception_events.length, controls: Object.keys(projection.reception_controls).length,
    coupledCandidates: Object.keys(models.coupled).length, attachedCandidates: Object.keys(models.attached).length,
    colorEdges: models.color_edges.length, repulsionCandidates: Object.keys(models.repulsion).length,
    evidence: state?.evidence.length ?? 0, probes: state?.probed.length ?? 0, dialTrials: state?.dial_tried.length ?? 0,
    epoch: state?.epoch ?? null, layout: state?.layout ?? null };
}
function knowledgeProjection(projection) {
  return { state: projection.reception_state, controls: projection.reception_controls, models: projection.reception_models };
}
function decisionProjection(proposal) {
  const plan = proposal?.exposed_reception_plan;
  return { status: proposal?.status ?? null, reason: proposal?.reason ?? null, actions: proposal?.actions ?? [],
    kind: plan?.kind ?? null, why: plan?.why ?? null, predicted: plan?.predicted ?? null };
}
function actionProjection(proposal) {
  return { status: proposal?.status ?? null, reason: proposal?.reason ?? null, actions: proposal?.actions ?? [] };
}
function restored(history, erasedFields = []) {
  const memory = new ExposedReceptionMemory();
  for (const [index, original] of history.entries()) {
    const event = copy(original);
    // Preserve every historical event and its detail/order. Only the last
    // snapshot's specified knowledge fields change in this counterfactual.
    if (index === history.length - 1) for (const field of erasedFields) {
      if (field === 'controls') event.controls = {};
      else if (field === 'conditional_models') event.models = freshReceptionModels();
      else throw new Error('Unknown ablation field: ' + field);
    }
    memory.applyEvent(event);
  }
  return memory;
}

const stem = game.toLowerCase();
const reportFile = await read(`${directory}/${stem}-campaign.json.gz`);
const traceFile = await read(`${directory}/${stem}-public-trace.json.gz`);
const journalFile = await readJournal(`${directory}/${stem}-actual-public-journal.jsonl.gz`);
const executionFile = await read(`${directory}/execution-${stem}.json`);
const beforeFile = await read(`${baselineDirectory}/${stem}-campaign.json.gz`);
const beforeTrace = await read(`${baselineDirectory}/${stem}-public-trace.json.gz`);
const beforeExecution = await read(`${baselineDirectory}/execution-${stem}.json`);
const manifestFile = await read(`${directory}/source-manifest.json`), manifest = manifestFile.value;
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
assert.deepEqual(trace.packets, journalFile.value, 'All returned packets and commands match the separately retained public journal');
assert.deepEqual(trace.packets[0], beforeTrace.value.packets[0], 'Cold attempts share the same complete initial public packet');
assert.deepEqual(report.gameAssets, baseline.gameAssets, 'Opaque host assets match the retained reference hashes');
assert.equal(trace.packets.length, report.actions.length + 1);
for (const [index, entry] of trace.packets.entries()) {
  assert.equal(entry.packet.step_index, index);
  assert.equal(symbolicDigest(entry.packet.frame_rows).slice(0, 16), entry.packet.frame_hash);
  if (index) assert.deepEqual(entry.command, report.actions[index - 1].command);
  else assert.equal(entry.command, null);
}
const policyFile = await read('reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/morphology_policy/strategy.drm');
const baseConfig = policyFile.value.declarations[0].configuration.observed_composition_services;
const memory = new ExposedReceptionMemory(), selections = [], transitions = [], ablations = [], boundaries = [], foreignPrefixes = [];
let actionCursor = 0, previousEventCount = 0;
for (const prefix of report.prefixes) {
  const captured = prefix.observedExposedReception;
  const events = prefix.sharedSeries.exposedReceptionAcquiredEvents;
  assert.ok(Array.isArray(events), 'Capture must retain every newly acquired exposed event, including empty foreign ranges');
  assert.equal(prefix.sharedSeries.exposedReceptionEventCount, previousEventCount + events.length);
  previousEventCount += events.length;
  if (!captured) {
    assert.equal(events.length, 0, 'Foreign proposals do not invent exposed-specific acquisition');
    foreignPrefixes.push({ prefix: prefix.id, family: prefix.family, acquired: prefix.acquiredActions,
      firstSequence: actionCursor + 1, ownEvents: 0, qualification: 'Foreign selection is retained in the common campaign and does not count as an exposed-reception contribution.' });
    actionCursor += prefix.acquiredActions;
    continue;
  }
  const proposal = captured.proposal, plan = proposal.exposed_reception_plan, packet = trace.packets[actionCursor].packet;
  assert.equal(prefix.fieldSubquestion, 'observed_composition_services');
  assert.equal(prefix.family, 'public_occurrence_recall');
  assert.ok(events.length <= prefix.acquiredActions, 'Own acquisition cannot exceed actual selected transitions');
  assert.equal(packet.level, plan.epoch);
  assert.equal(packet.levels_completed, plan.score);
  assert.equal(symbolicDigest(packet.frame_rows), plan.frame_digest);
  const observed = observation(packet, plan.observation_ref);
  const inputs = exposedReceptionInputCandidates(packet.frame_rows, packet.available_action_refs);
  const earlierLevelActions = report.actions.slice(0, actionCursor).filter(action => action.levelBefore === packet.level).length;
  const remaining = report.budget.levelActionCaps[packet.levels_completed] - earlierLevelActions;
  assert.ok(Number.isInteger(remaining) && remaining > 0);
  const limit = Math.min(16, remaining), config = { ...baseConfig, remaining_level_actions: remaining };
  const retained = memory.currentState(), beforeSummary = memorySummary(retained);
  // No captured proposal memory or current-prefix event primes this decision.
  const reproduced = memory.propose(observed, packet.frame_rows, inputs, limit, config);
  assert.ok(reproduced?.exposed_reception_plan);
  assert.deepEqual(reproduced.exposed_reception_plan, plan, 'Own plan reproduces from earlier real events only');
  assert.deepEqual(reproduced.actions, proposal.actions);
  assert.equal(reproduced.proposal_id, proposal.proposal_id);
  assert.deepEqual(memory.currentState(), retained, 'Planning does not acquire future evidence');
  const restoredControl = restored(retained.reception_events);
  assert.deepEqual(restoredControl.currentState(), retained, 'Event replay restores exact own state');
  assert.equal(restoredControl.retainedDigest('independent-own-layer'), memory.retainedDigest('independent-own-layer'));
  assert.deepEqual(restoredControl.propose(observed, packet.frame_rows, inputs, limit, config), reproduced);
  for (const fields of [['controls'], ['conditional_models'], ['controls', 'conditional_models']]) {
    const counterfactual = restored(retained.reception_events, fields);
    const altered = counterfactual.currentState(), expected = copy(retained);
    if (retained.reception_events.length) for (const field of fields) {
      const last = expected.reception_events.at(-1);
      if (field === 'controls') { expected.reception_controls = {}; last.controls = {}; }
      else { expected.reception_models = freshReceptionModels(); last.models = freshReceptionModels(); }
    }
    assert.deepEqual(altered, expected, 'Only declared last-snapshot fields change; actual event history stays independent');
    const result = counterfactual.propose(observed, packet.frame_rows, inputs, limit, config);
    const actualDecision = decisionProjection(reproduced), alternative = decisionProjection(result);
    const actualSearch = { nodes: reproduced.exposed_reception_plan?.search_nodes ?? null,
      visits: reproduced.exposed_reception_plan?.v5_chain_visits ?? null,
      bounded: reproduced.exposed_reception_plan?.native_reception_work_budget ?? reproduced.native_reception_work_budget ?? null };
    const alternativeSearch = { nodes: result?.exposed_reception_plan?.search_nodes ?? null,
      visits: result?.exposed_reception_plan?.v5_chain_visits ?? null,
      bounded: result?.exposed_reception_plan?.native_reception_work_budget ?? result?.native_reception_work_budget ?? null };
    ablations.push({ prefix: prefix.id, level: plan.epoch, fieldsErased: fields,
      interventionChangedRetainedKnowledge: !isDeepStrictEqual(knowledgeProjection(altered), knowledgeProjection(retained)),
      actualMemorySummary: beforeSummary, ablatedMemorySummary: memorySummary(altered),
      actualMemoryDigest: symbolicDigest(knowledgeProjection(retained)), ablatedMemoryDigest: symbolicDigest(knowledgeProjection(altered)),
      actionOrRefusalChanged: !isDeepStrictEqual(actionProjection(reproduced), actionProjection(result)),
      decisionProjectionChanged: !isDeepStrictEqual(actualDecision, alternative),
      strictProposalChanged: !isDeepStrictEqual(reproduced, result),
      actual: actualDecision, counterfactual: alternative,
      searchDiagnostics: { actual: actualSearch, counterfactual: alternativeSearch, changed: !isDeepStrictEqual(actualSearch, alternativeSearch) },
      qualification: 'Separate component replay. Only last acquired controls/models snapshots are erased; the real journal and game packets are unchanged. No current or future plan memory primes the replay. Identity-only, provenance-only and search-counter differences are not counted as action/refusal or decision contribution. Negative and empty-intervention results remain retained.' });
  }
  let consumedEvents = 0, previousAfterReference = null;
  for (let index = 0; index < prefix.acquiredActions; index += 1) {
    const position = actionCursor + index, physical = report.actions[position], beforePacket = trace.packets[position].packet,
      afterPacket = trace.packets[position + 1].packet, nativeCommand = proposal.actions[index];
    assert.deepEqual(publicCommand(nativeCommand), physical.command,
      'The public controller materializes missing command data as an empty object');
    const beforeScene = measureExposedReception(beforePacket.frame_rows), afterScene = measureExposedReception(afterPacket.frame_rows);
    const measurable = beforeScene !== null && afterScene !== null;
    const expectedEvent = measurable ? events[consumedEvents] : null;
    let beforeReference, afterReference, referenceSource;
    if (measurable) {
      assert.ok(expectedEvent, 'Every selected measurable transition retains its own event exactly once');
      assert.deepEqual(expectedEvent.detail.command, nativeCommand, 'Record uses the exact selected native command');
      assert.equal(expectedEvent.kind, 'observed_exposed_reception');
      beforeReference = expectedEvent.detail.before; afterReference = expectedEvent.detail.after;
      referenceSource = 'captured_own_event';
      consumedEvents += 1;
    } else {
      // The source explicitly returns no own event when either raster has no
      // admitted scene. The separately retained public checkpoint supplies
      // identity references only, never a decision, model or future evidence.
      assert.equal(index, prefix.acquiredActions - 1, 'A missing scene seals this selected prefix');
      const checkpoint = prefix.outlineAcquisition?.nativeCheckpoint?.public_transition;
      assert.equal(checkpoint?.schema, 'native.outline.public_transition.v1');
      assert.deepEqual(checkpoint.command, nativeCommand);
      assert.deepEqual(checkpoint.before_rows, beforePacket.frame_rows);
      assert.equal(checkpoint.before_rows_sha256, symbolicDigest(beforePacket.frame_rows));
      assert.equal(checkpoint.after_rows_sha256, symbolicDigest(afterPacket.frame_rows));
      for (const [binding, packet] of [[checkpoint.before, beforePacket], [checkpoint.after, afterPacket]]) {
        assert.equal(binding.frame_hash, packet.frame_hash);
        assert.equal(binding.level_epoch, packet.level);
        assert.equal(binding.levels_completed, packet.levels_completed);
      }
      beforeReference = checkpoint.before.observation_ref; afterReference = checkpoint.after.observation_ref;
      referenceSource = 'independently_retained_outline_public_checkpoint';
    }
    assert.equal(beforeReference, index === 0 ? plan.observation_ref : previousAfterReference);
    previousAfterReference = afterReference;
    const beforeObservation = observation(beforePacket, beforeReference), afterObservation = observation(afterPacket, afterReference);
    const admission = exposedReceptionBefore(proposal, index, beforePacket.frame_rows,
      { epoch: beforeObservation.level_epoch, score: beforeObservation.levels_completed,
        observation_ref: beforeObservation.observation_ref, available: beforeObservation.available_action_refs });
    assert.equal(admission.admitted, true, 'Every actual selected action remains admitted by its measured current binding');
    const outcome = exposedReceptionAfter(proposal, index, beforePacket.frame_rows, afterPacket.frame_rows,
      { epoch: afterObservation.level_epoch, score: afterObservation.levels_completed, state: afterObservation.state });
    if (index + 1 < prefix.acquiredActions) assert.equal(outcome.seal_prefix, false, 'Actual continuation follows an accepted preceding projection');
    if (!measurable) assert.equal(outcome.seal_prefix, true, 'Missing scene seals the actual prefix');
    const beforeState = memory.currentState(), generated = memory.record(beforeObservation, nativeCommand,
      afterObservation, beforePacket.frame_rows, afterPacket.frame_rows, proposal, index);
    assert.deepEqual(generated, measurable ? [expectedEvent] : [], 'Actual public rasters reproduce the exact own acquisition or source-legitimate empty return');
    const afterState = memory.currentState();
    assert.equal(afterState.reception_events.length, beforeState.reception_events.length + (measurable ? 1 : 0));
    if (measurable) {
      assert.deepEqual(afterState.reception_state, expectedEvent.state);
      assert.deepEqual(afterState.reception_controls, expectedEvent.controls);
      assert.deepEqual(afterState.reception_models, expectedEvent.models);
    } else assert.deepEqual(afterState, beforeState, 'An unmeasured return cannot acquire an invented own event or model');
    const summary = memorySummary(afterState), boundary = beforePacket.level !== afterPacket.level;
    transitions.push({ prefix: prefix.id, sequence: physical.sequence, levelBefore: beforePacket.level,
      levelAfter: afterPacket.level, detail: expectedEvent?.detail ?? { before: beforeReference, after: afterReference, command: nativeCommand },
      ownEventGenerated: measurable, referenceSource, sceneBeforeMeasured: beforeScene !== null, sceneAfterMeasured: afterScene !== null,
      zeroEventReason: measurable ? null : 'source_record_returns_no_own_event_when_either_scene_is_missing',
      recomputedAdmission: admission, recomputedOutcome: outcome,
      memoryBefore: memorySummary(beforeState), memoryAfter: summary,
      controlsChanged: !isDeepStrictEqual(beforeState.reception_controls, afterState.reception_controls),
      conditionalModelsChanged: !isDeepStrictEqual(beforeState.reception_models, afterState.reception_models),
      acquiredEventIndex: measurable ? afterState.reception_events.length - 1 : null });
    if (boundary) {
      if (expectedEvent) assert.equal(expectedEvent.detail.layout_transition_unknown, true);
      const official = report.boundaries.find(item => item.totalActions === physical.sequence);
      assert.ok(official, 'Natural scored boundary is retained by the common campaign');
      boundaries.push({ sequence: physical.sequence, completedLevel: official.completedLevel,
        memory: summary, event: expectedEvent, nextPublicSceneMeasured: afterScene !== null });
    }
  }
  assert.equal(consumedEvents, events.length, 'All and only captured own events are replayed once');
  selections.push({ prefix: prefix.id, level: plan.epoch, kind: plan.kind, why: plan.why, limit, remaining,
    planned: proposal.actions.length, acquired: prefix.acquiredActions, ownEvents: events.length,
    selectedTransitionsWithoutOwnEvent: prefix.acquiredActions - events.length,
    currentBodies: plan.scene.bodies.length, currentSlots: plan.scene.slots.length, currentDial: plan.scene.dial.length,
    searchNodes: plan.search_nodes, nominalV5ChainVisits: plan.v5_chain_visits,
    memoryBefore: beforeSummary, memoryAfter: memorySummary(memory.currentState()),
    earlierKnowledgePresent: beforeSummary.controls + beforeSummary.coupledCandidates + beforeSummary.attachedCandidates
      + beforeSummary.colorEdges + beforeSummary.repulsionCandidates > 0,
    exactOwnLayerPlanReproduced: true, exactActionsReproduced: true, restoredOwnLayerStateExact: true });
  actionCursor += prefix.acquiredActions;
}
assert.equal(actionCursor, report.actions.length);
assert.equal(memory.eventCount, previousEventCount);
assert.equal(new Set(transitions.map(item => `${item.detail.before}|${item.detail.after}`)).size, transitions.length);
const actionAblations = ablations.filter(item => item.actionOrRefusalChanged), decisionAblations = ablations.filter(item => item.decisionProjectionChanged);
const changedKnowledgeAblations = ablations.filter(item => item.interventionChangedRetainedKnowledge);
const result = {
  schema: 'logos-engine.observed-exposed-contribution.v1', status: selections.length ? 'passed' : 'no_selected_exposed_prefix',
  recordedAt: new Date().toISOString(), generator: { path: relative(ROOT, fileURLToPath(import.meta.url)), sha256: hash(await readFile(fileURLToPath(import.meta.url))) },
  inputs: { report: reportFile.receipt, trace: traceFile.receipt, publicJournal: journalFile.receipt, execution: executionFile.receipt,
    baselineReport: beforeFile.receipt, baselineTrace: beforeTrace.receipt, baselineExecution: beforeExecution.receipt,
    sourceManifest: manifestFile.receipt, sourcePolicy: policyFile.receipt },
  nativeSourceDigest: manifest.digest, game,
  scope: { ownExposedLayer: true, inheritedEphemeralMapClosureFullyTransferred: false, observedCompositionBranches: '3/6', completeV5V6Parity: false },
  baseline: { sourceDigest: baseline.source.digest, status: baseline.status, final: baseline.final,
    failure: baseline.failure, initialPublicPacketMatched: true, opaqueHostAssetHashesMatched: true,
    outerTimeout: beforeExecution.value.outerTimeout ?? null, actionCapReached: baseline.outerReferenceLimit?.actionCapReached ?? null },
  actual: { campaignStatus: report.status, targetMet: report.final.levelsCompleted >= report.targetLevels,
    final: report.final, failure: report.failure, selectedPrefixes: selections.length, selectedActions: transitions.length, selectedAcquisitions: transitions.filter(item => item.ownEventGenerated).length,
    selectedTransitionsWithoutOwnEvent: transitions.filter(item => !item.ownEventGenerated).length,
    foreignActions: foreignPrefixes.reduce((count, item) => count + item.acquired, 0),
    stateRestorations: selections.length, naturalBoundaries: boundaries.length, finalMemory: memorySummary(memory.currentState()) },
  contribution: { ablations: ablations.length, interventionsChangingRetainedKnowledge: changedKnowledgeAblations.length,
    actionOrRefusalChanges: actionAblations.length, decisionProjectionChanges: decisionAblations.length,
    strictProposalChanges: ablations.filter(item => item.strictProposalChanged).length,
    strictOnlyChanges: ablations.filter(item => item.strictProposalChanged && !item.decisionProjectionChanged).length,
    searchDiagnosticChanges: ablations.filter(item => item.searchDiagnostics.changed).length,
    negativeOrUnchangedDecisions: ablations.length - decisionAblations.length,
    actionContributionObserved: actionAblations.some(item => item.interventionChangedRetainedKnowledge),
    planningContributionObserved: decisionAblations.some(item => item.interventionChangedRetainedKnowledge),
    controlContributionObserved: actionAblations.some(item => item.interventionChangedRetainedKnowledge && item.fieldsErased.length === 1 && item.fieldsErased[0] === 'controls'),
    conditionalModelContributionObserved: actionAblations.some(item => item.interventionChangedRetainedKnowledge && item.fieldsErased.length === 1 && item.fieldsErased[0] === 'conditional_models'),
    noEffectIsRetainedAsNoEffect: true },
  selections, transitions, boundaries, foreignPrefixes, ablations,
  qualification: 'One actual common campaign, complete public packets and earlier own-layer events are replayed without executing a game or supplying a solution. Every selected own plan/action and acquisition is reconstructed from scratch. Current or future captured plan memory never primes a decision. Component admission/outcome checks are recomputed, not claimed as captured calls. Event restoration covers only this owner; native shared-owner restoration and contrary-return parity are separate integration gates. The inherited EphemeralMapAccess closure remains partial; this proof does not promote it to a complete source transfer. Every selected transition with two admitted scenes acquires one own event. Actual missing-scene returns are retained separately and must produce no own event or memory change, exactly as the source contract requires. Public command comparison only materializes missing data as an empty object; native proposal/event/record commands remain exactly equal. Counterfactual components erase only acquired controls/conditional models at actual decision contexts; identity-only and diagnostic-only changes do not establish action contribution. Negative results remain visible. This is not a second live run, necessity of every action, full private-state equality, complete V5/V6 parity or a solved-game assertion. actual.targetMet separately states whether the requested level target was reached.',
};
const output = resolve(ROOT, directory, 'exposed-contribution.json');
await writeFile(output, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ status: result.status, output: relative(ROOT, output), selectedPrefixes: selections.length,
  selectedActions: transitions.length, acquisitions: result.actual.selectedAcquisitions, selectedTransitionsWithoutOwnEvent: result.actual.selectedTransitionsWithoutOwnEvent, actionOrRefusalChanges: actionAblations.length, decisionProjectionChanges: decisionAblations.length,
  controlsContribute: result.contribution.controlContributionObserved, conditionalModelsContribute: result.contribution.conditionalModelContributionObserved,
  targetMet: result.actual.targetMet, final: report.final }));
