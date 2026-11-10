/** Reconstruct selected chamber decisions from earlier public transitions only.
 * Usage: node scripts/prove-observed-chamber-contribution.mjs GAME FINAL BASELINE
 * Counterfactual memory ablations are component diagnostics, never game inputs.
 */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { isDeepStrictEqual } from 'node:util';
import { RelationalChamberMemory, relationalChamberBefore, relationalChamberAfter } from '../src/logos-engine/v6-relational-chamber-access.ts';
import { measureRelationalChamber, relationalChamberInputCandidates } from '../src/logos-engine/v6-relational-chamber-observation.ts';
import { symbolicDigest } from '../src/logos-engine/v6-hash.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [game, directory, baselineDirectory] = process.argv.slice(2);
assert.match(game ?? '', /^[A-Z0-9]{4}$/);
assert.ok(directory && baselineDirectory);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const copy = value => structuredClone(value);
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
function memorySummary(memory) {
  return { contexts: Object.keys(memory.rows).length,
    rows: Object.values(memory.rows).reduce((total, table) => total + Object.keys(table).length, 0),
    observedEditEdges: Object.keys(memory.edges).length, evidence: memory.evidence.length,
    conflicts: memory.conflicts.length, failedTrials: memory.failed.length, boundaries: memory.boundaries.length };
}
function decisionProjection(proposal) {
  const plan = proposal?.chamber_relation_plan;
  return { status: proposal?.status ?? null, reason: proposal?.reason ?? null, actions: proposal?.actions ?? [],
    kind: plan?.kind ?? null, why: plan?.why ?? null, candidate: plan?.candidate ?? null,
    predicted: plan?.predicted ?? null, edits: plan?.edits ?? null };
}
function actionProjection(proposal) {
  return { status: proposal?.status ?? null, reason: proposal?.reason ?? null, actions: proposal?.actions ?? [] };
}
function restored(history, erasedFields = []) {
  const memory = new RelationalChamberMemory();
  for (const [index, original] of history.entries()) {
    const event = copy(original);
    // Preserve every historical event, its order and its detail. Only the final
    // retained memory snapshot is altered in this separate counterfactual.
    if (index === history.length - 1) for (const field of erasedFields) event.memory[field] = {};
    memory.applyEvent(event);
  }
  return memory;
}

const stem = game.toLowerCase();
const reportFile = await read(`${directory}/${stem}-campaign.json.gz`);
const traceFile = await read(`${directory}/${stem}-public-trace.json.gz`);
const journalFile = await readJournal(`${directory}/${stem}-actual-public-journal.jsonl.gz`);
const beforeFile = await read(`${baselineDirectory}/${stem}-campaign.json.gz`);
const beforeTrace = await read(`${baselineDirectory}/${stem}-public-trace.json.gz`);
const beforeExecution = await read(`${baselineDirectory}/execution-${stem}.json`);
const manifestFile = await read(`${directory}/source-manifest.json`), manifest = manifestFile.value;
for (const [name, expected] of Object.entries(manifest.files)) assert.equal(hash(await readFile(resolve(ROOT, name))), expected, name);
const report = reportFile.value, trace = traceFile.value, baseline = beforeFile.value;
assert.equal(report.source.digest, manifest.digest); assert.equal(report.sourceUnchangedDuringRun, true);
assert.equal(report.final.sessions, 1); assert.deepEqual(report.pythonAgentModules, []);
assert.equal(baseline.sourceUnchangedDuringRun, true); assert.deepEqual(baseline.pythonAgentModules, []);
assert.equal(beforeExecution.value.nativeSourceManifestDigest, baseline.source.digest);
assert.equal(beforeExecution.value.nativeSourceUnchanged, true); assert.equal(beforeExecution.value.executionCodeUnchanged, true);
assert.deepEqual(trace.packets, journalFile.value, 'Full returned packets and commands match the independently retained public journal');
assert.deepEqual(trace.packets[0], beforeTrace.value.packets[0], 'Cold attempts share the same complete initial public observation');
assert.deepEqual(report.gameAssets, baseline.gameAssets, 'Opaque host assets match the retained reference hashes');
assert.equal(trace.packets.length, report.actions.length + 1);
for (const [index, entry] of trace.packets.entries()) {
  assert.equal(entry.packet.step_index, index); assert.equal(symbolicDigest(entry.packet.frame_rows).slice(0, 16), entry.packet.frame_hash);
  if (index) assert.deepEqual(entry.command, report.actions[index - 1].command);
  else assert.equal(entry.command, null);
}
const policyFile = await read('reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/morphology_policy/strategy.drm');
const baseConfig = policyFile.value.declarations[0].configuration.observed_composition_services;
const memory = new RelationalChamberMemory(), selections = [], transitions = [], ablations = [], boundaries = [];
let actionCursor = 0, previousEventCount = 0;
for (const prefix of report.prefixes) {
  const captured = prefix.observedChamberRelations;
  const events = prefix.sharedSeries.chamberRelationAcquiredEvents;
  assert.ok(Array.isArray(events), 'The campaign must retain all newly acquired chamber events, including empty foreign ranges');
  assert.equal(prefix.sharedSeries.chamberRelationEventCount, previousEventCount + events.length);
  previousEventCount += events.length;
  if (!captured) {
    assert.equal(events.length, 0, 'Foreign proposals do not invent branch-specific acquisitions');
    actionCursor += prefix.acquiredActions; continue;
  }
  const proposal = captured.proposal, plan = proposal.chamber_relation_plan, packet = trace.packets[actionCursor].packet;
  assert.equal(prefix.fieldSubquestion, 'observed_composition_services'); assert.equal(prefix.family, 'public_occurrence_recall');
  assert.equal(events.length, prefix.acquiredActions, 'One own-layer acquisition per selected actual transition');
  assert.equal(packet.level, plan.epoch); assert.equal(packet.levels_completed, plan.score);
  assert.equal(symbolicDigest(packet.frame_rows), plan.frame_digest);
  const observed = observation(packet, plan.observation_ref);
  const inputs = relationalChamberInputCandidates(packet.frame_rows, packet.available_action_refs);
  const earlierLevelActions = report.actions.slice(0, actionCursor).filter(action => action.levelBefore === packet.level).length;
  const remaining = report.budget.levelActionCaps[packet.levels_completed] - earlierLevelActions;
  assert.ok(Number.isInteger(remaining) && remaining > 0);
  const limit = Math.min(16, remaining), config = { ...baseConfig, remaining_level_actions: remaining };
  const retained = memory.currentState(), beforeSummary = memorySummary(retained.relation_memory);
  // Neither plan.memory nor events from this prefix prime the decision. The
  // memory contains only accepted earlier events, reconstructed from scratch.
  const reproduced = memory.propose(observed, packet.frame_rows, inputs, limit, config);
  assert.ok(reproduced?.chamber_relation_plan);
  assert.deepEqual(reproduced.chamber_relation_plan, plan, 'Own-layer plan reproduces exactly from earlier actual events');
  assert.deepEqual(reproduced.actions, proposal.actions); assert.equal(reproduced.proposal_id, proposal.proposal_id);
  assert.deepEqual(memory.currentState(), retained, 'Planning does not acquire a future observation');
  const restoredControl = restored(retained.relation_events);
  assert.deepEqual(restoredControl.currentState(), retained, 'Event replay preserves the exact own-layer state');
  assert.deepEqual(restoredControl.propose(observed, packet.frame_rows, inputs, limit, config), reproduced);

  for (const fields of [['rows'], ['edges'], ['rows', 'edges']]) {
    const counterfactual = restored(retained.relation_events, fields);
    const altered = counterfactual.currentState().relation_memory;
    const expected = copy(retained.relation_memory); for (const field of fields) expected[field] = {};
    assert.deepEqual(altered, expected, 'Only the declared current-memory fields change');
    const result = counterfactual.propose(observed, packet.frame_rows, inputs, limit, config);
    const actualDecision = decisionProjection(reproduced), alternative = decisionProjection(result);
    const actualDomain = reproduced.chamber_relation_plan?.domain ?? null, alternativeDomain = result?.chamber_relation_plan?.domain ?? null;
    ablations.push({ prefix: prefix.id, level: plan.epoch, fieldsErased: fields,
      interventionChangedRetainedMemory: !isDeepStrictEqual(altered, retained.relation_memory),
      actualMemorySummary: beforeSummary, ablatedMemorySummary: memorySummary(altered),
      actualMemoryDigest: symbolicDigest(retained.relation_memory), ablatedMemoryDigest: symbolicDigest(altered),
      actionOrRefusalChanged: !isDeepStrictEqual(actionProjection(reproduced), actionProjection(result)),
      decisionProjectionChanged: !isDeepStrictEqual(actualDecision, alternative),
      actual: actualDecision, counterfactual: alternative,
      domainDiagnostics: { actual: actualDomain, counterfactual: alternativeDomain,
        changed: !isDeepStrictEqual(actualDomain, alternativeDomain) },
      qualification: 'Separate component replay only. Earlier real event order/detail remain retained; only the final snapshot fields named above are erased. No current or future proposal memory is imported. Identity-only differences are not counted as a changed action/refusal. Enumeration/check/bounded diagnostics remain separate and never establish planning contribution. Negative and empty-intervention outcomes are retained.' });
  }
  for (const [index, expectedEvent] of events.entries()) {
    const position = actionCursor + index, physical = report.actions[position], beforePacket = trace.packets[position].packet,
      afterPacket = trace.packets[position + 1].packet;
    assert.deepEqual(proposal.actions[index], physical.command);
    assert.deepEqual(expectedEvent.detail.command, physical.command);
    if (index === 0) assert.equal(expectedEvent.detail.before, plan.observation_ref);
    else assert.equal(expectedEvent.detail.before, events[index - 1].detail.after);
    const beforeObservation = observation(beforePacket, expectedEvent.detail.before), afterObservation = observation(afterPacket, expectedEvent.detail.after);
    const admission = relationalChamberBefore(proposal, index, beforePacket.frame_rows,
      { epoch: beforeObservation.level_epoch, score: beforeObservation.levels_completed,
        observation_ref: beforeObservation.observation_ref, available: beforeObservation.available_action_refs });
    assert.equal(admission.admitted, true, 'Every actual command remains admitted by its current measured binding');
    const outcome = relationalChamberAfter(proposal, index, beforePacket.frame_rows, afterPacket.frame_rows,
      { epoch: afterObservation.level_epoch, score: afterObservation.levels_completed, state: afterObservation.state });
    if (index + 1 < events.length) assert.equal(outcome.seal_prefix, false, 'An actually continued prefix has an accepted preceding measured projection');
    const beforeState = memory.currentState(), generated = memory.record(beforeObservation, physical.command,
      afterObservation, beforePacket.frame_rows, afterPacket.frame_rows, proposal, index);
    assert.deepEqual(generated, [expectedEvent], 'Observed pixels reproduce the exact captured acquisition once');
    const afterState = memory.currentState(); assert.equal(afterState.relation_events.length, beforeState.relation_events.length + 1);
    assert.deepEqual(afterState.relation_memory, expectedEvent.memory);
    const summary = memorySummary(afterState.relation_memory), boundary = beforePacket.level !== afterPacket.level;
    transitions.push({ prefix: prefix.id, sequence: physical.sequence, levelBefore: beforePacket.level,
      levelAfter: afterPacket.level, detail: expectedEvent.detail, recomputedAdmission: admission,
      recomputedOutcome: outcome, memoryBefore: memorySummary(beforeState.relation_memory), memoryAfter: summary,
      rowsAdded: summary.rows - memorySummary(beforeState.relation_memory).rows,
      acquiredEventIndex: afterState.relation_events.length - 1 });
    if (boundary) {
      assert.equal(expectedEvent.detail.boundary_not_same_scope_effect, true);
      assert.equal(afterState.relation_memory.boundaries.length, beforeState.relation_memory.boundaries.length + 1);
      const official = report.boundaries.find(item => item.totalActions === physical.sequence);
      assert.ok(official, 'Natural scored boundary is retained by the common campaign');
      boundaries.push({ sequence: physical.sequence, completedLevel: official.completedLevel,
        memory: summary, event: expectedEvent, nextPublicSceneMeasured: measureRelationalChamber(afterPacket.frame_rows) !== null });
    }
  }
  selections.push({ prefix: prefix.id, level: plan.epoch, kind: plan.kind, why: plan.why, limit, remaining,
    planned: proposal.actions.length, acquired: prefix.acquiredActions, currentControls: plan.scene.controls.length,
    currentAxes: plan.scene.axes.length, targetAxes: plan.scene.axes.filter(axis => axis.target !== null).length,
    candidate: plan.candidate, domain: plan.domain, memoryBefore: beforeSummary,
    memoryAfter: memorySummary(memory.currentState().relation_memory), exactOwnLayerPlanReproduced: true,
    exactActionsReproduced: true, restoredOwnLayerStateExact: true });
  actionCursor += prefix.acquiredActions;
}
assert.equal(actionCursor, report.actions.length); assert.equal(memory.eventCount, previousEventCount);
assert.equal(new Set(transitions.map(item => `${item.detail.before}|${item.detail.after}`)).size, transitions.length);
const actionAblations = ablations.filter(item => item.actionOrRefusalChanged), decisionAblations = ablations.filter(item => item.decisionProjectionChanged);
const result = {
  schema: 'logos-engine.observed-chamber-contribution.v1', status: selections.length ? 'passed' : 'no_selected_chamber_prefix',
  recordedAt: new Date().toISOString(), generator: { path: relative(ROOT, fileURLToPath(import.meta.url)), sha256: hash(await readFile(fileURLToPath(import.meta.url))) },
  inputs: { report: reportFile.receipt, trace: traceFile.receipt, publicJournal: journalFile.receipt,
    baselineReport: beforeFile.receipt, baselineTrace: beforeTrace.receipt, baselineExecution: beforeExecution.receipt,
    sourceManifest: manifestFile.receipt, sourcePolicy: policyFile.receipt },
  nativeSourceDigest: manifest.digest, game,
  baseline: { sourceDigest: baseline.source.digest, status: baseline.status, final: baseline.final,
    failure: baseline.failure, initialPublicPacketMatched: true, opaqueHostAssetHashesMatched: true,
    outerTimeout: beforeExecution.value.outerTimeout ?? null, actionCapReached: baseline.outerReferenceLimit?.actionCapReached ?? null },
  actual: { campaignStatus: report.status, targetMet: report.final.levelsCompleted >= report.targetLevels,
    final: report.final, failure: report.failure, selectedPrefixes: selections.length, selectedAcquisitions: transitions.length,
    stateRestorations: selections.length, naturalBoundaries: boundaries.length, finalMemory: memorySummary(memory.currentState().relation_memory) },
  contribution: { ablations: ablations.length, actionOrRefusalChanges: actionAblations.length,
    decisionProjectionChanges: decisionAblations.length, negativeOrUnchangedDecisions: ablations.length - decisionAblations.length,
    domainDiagnosticChanges: ablations.filter(item => item.domainDiagnostics.changed).length,
    actionContributionObserved: actionAblations.length > 0, planningContributionObserved: decisionAblations.length > 0,
    noEffectIsRetainedAsNoEffect: true },
  selections, transitions, boundaries, ablations,
  qualification: 'One actual common campaign, public packets and earlier own-layer events are replayed without executing a game or supplying a solution. Every selected own-layer plan/action and acquisition is reconstructed from scratch; initial proposal memory is never used to prime the replay. Component admission/outcome checks are recomputed and named as such, not invented captured calls. Event restoration covers this own layer; shared-owner restoration and contrary-return source parity are separate integration tests. Pure component ablations erase only the declared acquired table/edge fields at actual decision contexts and retain negative outcomes. They do not prove a second live-game result, necessity of every action, whole-private-graph identity or complete V5/V6 parity. A passed proof means these scoped checks passed; actual.targetMet separately states whether the game target was reached.',
};
const output = resolve(ROOT, directory, 'chamber-contribution.json');
await writeFile(output, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ status: result.status, output: relative(ROOT, output), selectedPrefixes: selections.length,
  acquisitions: transitions.length, actionOrRefusalChanges: actionAblations.length, decisionProjectionChanges: decisionAblations.length,
  targetMet: result.actual.targetMet, final: report.final }));
