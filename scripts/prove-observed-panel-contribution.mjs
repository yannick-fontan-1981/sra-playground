/** Inspect an actual public campaign, then isolate the acquired selection bit.
 * Usage: node scripts/prove-observed-panel-contribution.mjs GAME FINAL BASELINE
 * Counterfactuals run only in this evidence tool, never in the game transport.
 */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { PanelServiceMemory } from '../src/logos-engine/v6-panel-service-access.ts';
import { panelServiceInputCandidates } from '../src/logos-engine/v6-panel-service-observation.ts';
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
async function optional(path) {
  try { return await read(path); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}
async function textFile(path) {
  const absolute = resolve(ROOT, path), bytes = await readFile(absolute);
  return { value: (path.endsWith('.gz') ? gunzipSync(bytes) : bytes).toString(),
    receipt: { path: relative(ROOT, absolute), sha256: hash(bytes), bytes: bytes.length } };
}
const frequency = values => Object.fromEntries([...new Set(values)].map(value => [value, values.filter(item => item === value).length]));
const packetSummary = packet => Object.fromEntries(Object.entries(packet).filter(([key]) => !['frame_rows', 'frame_packet'].includes(key)));

/** Preserve an export failure using only independently retained evidence. */
async function baselineEvidence(stem, baselineDirectory) {
  const report = await optional(`${baselineDirectory}/${stem}-campaign.json.gz`);
  const trace = await optional(`${baselineDirectory}/${stem}-public-trace.json.gz`);
  if (report && trace) return { report, trace, mode: 'complete_campaign_report_and_trace', summary: null };

  const execution = await read(`${baselineDirectory}/execution-${stem}.json`);
  const sourceManifest = await read(`${baselineDirectory}/source-manifest.json`);
  const archive = await read(`${baselineDirectory}/source-archive.json`);
  const archiveParts = await read(`${baselineDirectory}/source-archive-parts.json`);
  const journal = await textFile(`${baselineDirectory}/${stem}-actual-public-journal.jsonl.gz`);
  const log = await textFile(`${baselineDirectory}/${stem}-output.log.gz`);
  assert.equal(journal.receipt.sha256, execution.value.publicJournal.sha256, 'Receipt must pin retained public journal');
  assert.equal(log.receipt.sha256, execution.value.output.sha256, 'Receipt must pin retained process log');
  assert.equal(execution.value.nativeSourceManifestDigest, sourceManifest.value.digest);
  assert.equal(execution.value.nativeSourceUnchanged, true);
  assert.equal(execution.value.executionCodeUnchanged, true);
  assert.equal(archive.value.nativeSourceManifestDigest, sourceManifest.value.digest);
  const parts = [];
  for (const part of archiveParts.value.parts) {
    const bytes = await readFile(resolve(ROOT, part.path));
    assert.equal(hash(bytes), part.sha256); assert.equal(bytes.length, part.bytes); parts.push(bytes);
  }
  const archiveBytes = Buffer.concat(parts);
  assert.equal(hash(archiveBytes), archiveParts.value.original.sha256);
  assert.equal(hash(archiveBytes), archive.value.archive.sha256);

  const packets = journal.value.split(/\r?\n/).filter(line => line.trim()).map(line => JSON.parse(line));
  assert.ok(packets.length > 1); assert.equal(packets[0].command, null);
  for (const [index, entry] of packets.entries()) {
    assert.equal(entry.packet.step_index, index, 'Public journal steps must be contiguous');
    assert.equal(symbolicDigest(entry.packet.frame_rows).slice(0, 16), entry.packet.frame_hash);
    if (index) assert.ok(entry.command?.action_ref, 'Every subsequent journal packet must have its actual command');
  }
  const lines = log.value.split(/\r?\n/), records = [];
  for (const [index, line] of lines.entries()) {
    try { const value = JSON.parse(line); if (value && typeof value === 'object') records.push({ line: index + 1, value }); }
    catch { /* Native OOM diagnostics are retained as text, not silently treated as JSON. */ }
  }
  const responses = records.filter(item => item.value.phase === 'response');
  const last = responses.at(-1), failure = records.findLast(item => item.value.phase === 'failure');
  const initial = packets[0].packet, finalPacket = packets.at(-1).packet;
  const oomIndex = lines.findIndex(line => line.includes('FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory'));
  assert.ok(last); assert.equal(last.value.kind, 'stopped');
  assert.equal(last.value.actions, packets.length - 1);
  assert.equal(last.value.level, finalPacket.level);
  assert.equal(last.value.levelsCompleted, finalPacket.levels_completed);
  assert.ok(failure && failure.line > last.line);
  assert.ok(oomIndex + 1 > failure.line, 'The OOM must follow the observed gameplay stop');
  assert.equal(execution.value.exitCode, -6);

  const final = { actions: last.value.actions, levelsCompleted: finalPacket.levels_completed,
    level: finalPacket.level, state: finalPacket.state, status: last.value.kind, reason: last.value.reason,
    activeSeconds: last.value.activeSeconds, cycles: last.value.cycles };
  const summaryValue = {
    schema: 'logos-engine.lot3a.incomplete-baseline-summary.v1', game, status: 'target_not_reached_export_incomplete',
    generator: { path: relative(ROOT, fileURLToPath(import.meta.url)), sha256: hash(await readFile(fileURLToPath(import.meta.url))) },
    source: { digest: sourceManifest.value.digest, fileCount: sourceManifest.value.fileCount,
      unchangedDuringRun: execution.value.nativeSourceUnchanged, passiveExecutionCodeUnchanged: execution.value.executionCodeUnchanged },
    execution: { exitCode: execution.value.exitCode, startedAt: execution.value.startedAt, finishedAt: execution.value.finishedAt,
      elapsedSeconds: execution.value.elapsedSeconds },
    evidence: { execution: execution.receipt, publicJournal: journal.receipt, processLog: log.receipt,
      sourceManifest: sourceManifest.receipt, sourceArchive: archive.receipt, sourceArchiveParts: archiveParts.receipt },
    artifactAvailability: { completeCampaignReport: Boolean(report), completePublicTrace: Boolean(trace), retainedPublicJournal: true },
    journal: { packets: packets.length, physicalActions: packets.length - 1, contiguousSteps: true,
      initialPacket: packetSummary(initial), lastPacket: packetSummary(finalPacket),
      commandCounts: frequency(packets.slice(1).map(item => item.command.action_ref)),
      observedScores: [...new Set(packets.map(item => item.packet.levels_completed))],
      observedLevels: [...new Set(packets.map(item => item.packet.level))] },
    log: { jsonRecords: records.length, phaseCounts: frequency(records.map(item => item.value.phase)),
      responseFamilies: frequency(responses.map(item => item.value.family)),
      lastResponseLine: last.line, lastObservedResponse: last.value, campaignFailureLine: failure.line,
      campaignFailure: failure.value, fatalDiagnosticLine: oomIndex + 1, fatalDiagnostic: lines[oomIndex] },
    final, failure: { campaignStop: last.value.reason, diagnostic: lines[oomIndex], exitCode: execution.value.exitCode,
      order: 'The gameplay stop and failure message were recorded before the fatal heap diagnostic; full report/trace export did not complete.' },
    pythonAgentModules: null, moduleAuditAvailability: 'No explicit module list is retained because the complete baseline campaign report is absent. The receipt describes a native common campaign, but an empty module list is not reconstructed.',
    baselineOpaqueHostAssetHashes: null,
    qualification: 'This derived summary preserves the failed execution and its public journal. It does not fabricate missing proposals, acquisitions, final memory, module audit or host-asset hashes. Exact initial-public-packet comparison is possible with the successful run; equality or pre-run timestamping of baseline opaque host assets is not established by these retained artifacts.'
  };
  const summaryPath = `${baselineDirectory}/summary.json`;
  await writeFile(resolve(ROOT, summaryPath), JSON.stringify(summaryValue, null, 2) + '\n');
  const summary = await read(summaryPath);
  return { report: { value: summaryValue, receipt: summary.receipt },
    trace: { value: { packets }, receipt: journal.receipt }, mode: 'execution_receipt_public_journal_and_process_log', summary };
}
const stem = game.toLowerCase();
const reportFile = await read(`${directory}/${stem}-campaign.json.gz`);
const traceFile = await read(`${directory}/${stem}-public-trace.json.gz`);
const baseline = await baselineEvidence(stem, baselineDirectory);
const beforeFile = baseline.report, beforeTrace = baseline.trace;
const manifest = (await read(`${directory}/source-manifest.json`)).value;
for (const [name, expected] of Object.entries(manifest.files)) assert.equal(hash(await readFile(resolve(ROOT, name))), expected, name);
const report = reportFile.value, trace = traceFile.value, before = beforeFile.value;
assert.equal(report.status, 'passed'); assert.equal(report.source.digest, manifest.digest);
assert.equal(report.sourceUnchangedDuringRun, true);
assert.equal(report.final.sessions, 1); assert.ok(report.final.levelsCompleted >= report.targetLevels);
assert.deepEqual(report.pythonAgentModules, []);
assert.deepEqual(trace.packets[0], beforeTrace.value.packets[0], 'Both cold attempts start from the same complete public observation');
const hostAssetComparison = before.gameAssets ? { status: 'matched_retained_campaign_hashes' }
  : { status: 'baseline_hashes_unavailable', qualification: 'The incomplete baseline retains no opaque host-asset hash list; matching initial public packets does not establish identical assets or their pre-run timestamping.' };
if (before.gameAssets) assert.deepEqual(report.gameAssets, before.gameAssets, 'Retained opaque host asset hashes must match when available');
assert.equal(trace.packets.length, report.actions.length + 1);
const source = 'reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/morphology_policy/strategy.drm';
const policyFile = await read(source), config = policyFile.value.declarations[0].configuration.observed_composition_services;
let actionCursor = 0, previousPanelCount = 0, configurationActions = 0, applicationActions = 0;
const selections = [], transitions = [], ablations = [];
const acquiredMemory = new PanelServiceMemory();
for (const prefix of report.prefixes) {
  const captured = prefix.observedPanelService, events = prefix.sharedSeries.panelServiceAcquiredEvents;
  assert.equal(prefix.sharedSeries.panelServiceEventCount, previousPanelCount + events.length);
  previousPanelCount += events.length;
  if (captured) {
    const proposal = captured.proposal, plan = proposal.panel_service_plan;
    const packet = trace.packets[actionCursor].packet;
    assert.equal(prefix.fieldSubquestion, 'observed_composition_services');
    assert.equal(prefix.family, 'public_occurrence_recall');
    assert.equal(events.length, prefix.acquiredActions, 'Exactly one Panel acquisition per selected real transition');
    assert.equal(symbolicDigest(packet.frame_rows), plan.frame_digest);
    assert.equal(packet.level, plan.epoch); assert.equal(packet.levels_completed, plan.score);
    const observation = { level_epoch: plan.epoch, levels_completed: plan.score, observation_ref: plan.observation_ref,
      available_action_refs: packet.available_action_refs, frame_hash: packet.frame_hash, state: packet.state };
    const inputs = [...packet.available_action_refs.filter(ref => ref !== 'ACTION6').map(action_ref => ({ action_ref })),
      ...panelServiceInputCandidates(packet.frame_rows, packet.available_action_refs)];
    // plan.memory contains symbols tentatively discovered during this proposal.
    // Reusing it as the preceding state would prime the initial measurement.
    // Start cold and replay only previously accepted, actual Panel events.
    const beforePlanningMemory = copy(acquiredMemory.currentState().panel_memory);
    const reproduced = acquiredMemory.propose(observation, packet.frame_rows, inputs, 16, config);
    assert.deepEqual(reproduced.panel_service_plan, plan, 'Selected own-layer plan reproduces from its actual public state');
    assert.deepEqual(reproduced.actions, proposal.actions);
    if (plan.kind === 'configuration') configurationActions += prefix.acquiredActions;
    else applicationActions += prefix.acquiredActions;
    if (plan.kind === 'configuration' && plan.memory.selection_observed && proposal.actions.length > 1) {
      const erased = copy(beforePlanningMemory); erased.selection_observed = false;
      assert.deepEqual({ ...erased, selection_observed: beforePlanningMemory.selection_observed }, beforePlanningMemory);
      const control = new PanelServiceMemory();
      control.applyEvent({ kind: 'observed_panel_service', memory: erased, detail: { evidence_tool_only: true } });
      const result = control.propose(observation, packet.frame_rows, inputs, 16, config);
      assert.equal(result.actions.length, 1); assert.deepEqual(result.actions[0], proposal.actions[0]);
      ablations.push({ prefix: prefix.id, level: plan.epoch, actualActions: proposal.actions.length,
        withoutAcquiredSelection: result.actions.length, actualProposal: proposal.proposal_id,
        counterfactualProposal: result.proposal_id, onlyMemoryFieldChanged: 'selection_observed',
        memoryBasis: 'Only previously accepted real transition events; no current proposal symbols are preloaded.' });
    }
    for (const [index, event] of events.entries()) {
      const physical = report.actions[actionCursor + index], command = { action_ref: event.detail.command.action_ref,
        data: event.detail.command.data ?? {} };
      assert.deepEqual(command, physical.command);
      assert.equal(event.detail.score_delta, physical.completedAfter - physical.completedBefore);
      assert.equal(event.detail.boundary, physical.levelBefore !== physical.levelAfter);
      assert.equal(event.memory.effects.length, previousPanelCount - events.length + index + 1);
      transitions.push({ prefix: prefix.id, sequence: physical.sequence, detail: event.detail,
        selectionObserved: event.memory.selection_observed, effectCount: event.memory.effects.length,
        failedCount: event.memory.failed.length });
      acquiredMemory.applyEvent(copy(event));
    }
    selections.push({ prefix: prefix.id, level: plan.epoch, kind: plan.kind, planned: proposal.actions.length,
      acquired: prefix.acquiredActions, selectionObservedBefore: plan.memory.selection_observed,
      evidenceBefore: plan.memory.evidence.length, effectCountBefore: plan.memory.effects.length,
      contributions: plan.contributions.map(item => item.reason) });
  } else assert.equal(events.length, 0, 'Foreign plans do not fabricate Panel-specific acquisitions');
  actionCursor += prefix.acquiredActions;
}
assert.equal(actionCursor, report.actions.length);
assert.ok(ablations.length > 0, 'At least one actual acquired selection must change a subsequent prefix');
assert.equal(new Set(transitions.map(item => `${item.detail.before}|${item.detail.after}`)).size, transitions.length);
assert.equal(transitions[0].selectionObserved, true);
const result = {
  schema: 'logos-engine.observed-panel-contribution.v1', status: 'passed', recordedAt: new Date().toISOString(),
  generator: { path: relative(ROOT, fileURLToPath(import.meta.url)), sha256: hash(await readFile(fileURLToPath(import.meta.url))) },
  inputs: { report: reportFile.receipt, trace: traceFile.receipt, baseline: beforeFile.receipt,
    baselineTraceOrJournal: beforeTrace.receipt, sourcePolicy: policyFile.receipt },
  nativeSourceDigest: manifest.digest, game,
  baseline: { sourceDigest: before.source.digest, evidenceMode: baseline.mode, status: before.status,
    final: before.final, failure: before.failure, initialPublicPacketMatched: true, hostAssetComparison },
  actual: { final: report.final, boundaries: report.boundaries, selectedPrefixes: selections.length,
    configurationActions, applicationActions, panelEvents: transitions.length },
  selections, transitions, ablations,
  qualification: 'The common cold live campaign is observed without supplying actions or state. The separate component ablation reuses an actual public decision context and changes only the acquired selection bit; it is not a second live game run and does not claim that every game action is causally necessary. Source-parity and contrary-return cases are separate fixtures. Initial complete public packets match the retained baseline. Baseline report/export limitations and opaque host-asset hash availability are recorded explicitly; no missing evidence is reconstructed.',
};
const output = resolve(ROOT, directory, 'panel-contribution.json');
await writeFile(output, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ status: result.status, output: relative(ROOT, output), prefixes: selections.length,
  events: transitions.length, ablations: ablations.length, final: report.final }));
