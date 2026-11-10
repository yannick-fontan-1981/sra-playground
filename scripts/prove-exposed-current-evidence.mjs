/** Component proof from retained public observations. This does not run a game. */
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { isDeepStrictEqual } from 'node:util';
import { readEvidenceSync } from '../tests/helpers/chunked-evidence.ts';

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const i = args.indexOf(name);
  return i < 0 ? fallback : args[i + 1];
};
const root = resolve(option('--root', '.'));
const baselineRoot = resolve(option('--baseline-root', '/workspace/sites/sra-published-043'));
const out = resolve(root, option('--out', 'docs/migration/lot3c-current-evidence/diagnostic'));
const oldDirectory = 'docs/migration/lot3c-evidence/final';
const sourcePath = `${oldDirectory}/cwse-terminal-diagnostic/source-result.json`;
const campaignPath = `${oldDirectory}/cwse-session/cwse-campaign.json.gz`;
const tracePath = `${oldDirectory}/cwse-session/cwse-public-trace.json.gz`;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const evidenceBytes = path => readEvidenceSync(pathToFileURL(join(root, path)));
const read = async path => {
  const bytes = evidenceBytes(path);
  return JSON.parse(path.endsWith('.gz') ? gunzipSync(bytes) : bytes);
};
const load = async (directory, path) => import(pathToFileURL(join(directory, path)).href);
const accessPath = 'src/logos-engine/v6-exposed-reception-access.ts';
const observationPath = 'src/logos-engine/v6-exposed-reception-observation.ts';
const targetPath = 'src/logos-engine/v6-target-binding.ts';
const [oldAccess, nextAccess, observation, oldTarget, nextTarget] = await Promise.all([
  load(baselineRoot, accessPath), load(root, accessPath), load(root, observationPath),
  load(baselineRoot, targetPath), load(root, targetPath)
]);
const [source, campaign, trace] = await Promise.all([read(sourcePath), read(campaignPath), read(tracePath)]);
for (const input of source.inputs) assert.equal(hash(evidenceBytes(input.path)), input.sha256, input.path);
assert.equal(hash(await readFile(join(root, observationPath))), hash(await readFile(join(baselineRoot, observationPath))), 'Projector is unchanged');
assert.equal(hash(await readFile(join(root, targetPath))), hash(await readFile(join(baselineRoot, targetPath))), 'TargetTree is unchanged');
const packets = trace.packets.map(entry => entry.packet);
const events = campaign.prefixes.flatMap(prefix => prefix.sharedSeries.exposedReceptionAcquiredEvents);
assert.equal(events.length, 19);
const restore = (Access, sourceEvents = events) => {
  const memory = new Access.ExposedReceptionMemory();
  sourceEvents.forEach(event => memory.applyEvent(event));
  return memory;
};
const oldMemory = restore(oldAccess), nextMemory = restore(nextAccess);
const oldState = oldMemory.currentState(), nextState = nextMemory.currentState();
assert.deepEqual(nextState, oldState);
const measurements = [19, 20, 21].map(sequence => ({ sequence, frameHash: packets[sequence].frame_hash,
  scene: observation.measureExposedReception(packets[sequence].frame_rows),
  largeScene: observation.measureLargeExposedReception(packets[sequence].frame_rows),
  smallScene: observation.measureSmallExposedReception(packets[sequence].frame_rows) }));
assert.deepEqual(measurements, source.measurements);
const prefix = campaign.prefixes.at(-2), capture = prefix.outlineAcquisition.nativeCheckpoint.public_transition;
for (const memory of [oldMemory, nextMemory]) {
  const before = memory.currentState(), revision = memory.nativeRevision;
  const result = memory.record(source.lastExposedTransition.before, capture.command, source.lastExposedTransition.after,
    packets[19].frame_rows, packets[20].frame_rows, prefix.observedExposedReception.proposal, 7);
  assert.deepEqual(result, []);
  assert.deepEqual(memory.currentState(), before);
  assert.equal(memory.nativeRevision, revision);
}
const policyPath = 'reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/morphology_policy/strategy.drm';
const policy = await read(policyPath);
const config = { ...policy.declarations[0].configuration.observed_composition_services, remaining_level_actions: source.remaining };
const current = source.terminalObservation, rows = packets[21].frame_rows;
const inputs = observation.exposedReceptionInputCandidates(rows, packets[21].available_action_refs);
const propose = (memory, obs = current, raster = rows) => memory.propose(obs, raster, inputs, Math.min(16, source.remaining), config);
const oldProposal = propose(oldMemory), proposal = propose(nextMemory);
assert.deepEqual(oldProposal, source.proposal, 'Published native 0.43 reproduces the unchanged source result');
assert.equal(proposal.status, 'proposed');
const expected = structuredClone(oldProposal);
const evidence = expected.bundle_template.evidence.slice(-16);
if (!evidence.includes(current.observation_ref)) {
  if (evidence.length === 16) evidence.shift();
  evidence.push(current.observation_ref);
}
expected.bundle_template.evidence = evidence;
expected.route_refs = evidence;
expected.question.hypothesis_refs = evidence;
assert.deepEqual(proposal, expected, 'Only the three evidence envelopes change on the real terminal packet');
assert.deepEqual(proposal.exposed_reception_plan, oldProposal.exposed_reception_plan);
assert.equal(proposal.proposal_id, oldProposal.proposal_id);
assert.deepEqual(proposal.actions, oldProposal.actions);
assert.deepEqual(nextMemory.currentState(), nextState);
assert.equal(nextMemory.eventCount, 19);
assert.equal(nextMemory.nativeRevision, 19);
const objective = { id: 'G_official_completion' };
const oldBinding = new oldTarget.CompositionTargetTree().bind(oldProposal, current, objective);
const target = new nextTarget.CompositionTargetTree();
const newBinding = target.bind(proposal, current, objective);
assert.deepEqual(oldBinding, source.targetBinding);
assert.equal(oldBinding.admitted, false);
assert.equal(oldBinding.reason, 'unbound_action_set');
assert.equal(newBinding.admitted, true);
assert.equal(newBinding.reason, 'independent_current_contribution');
const meta = { epoch: current.level_epoch, score: current.levels_completed, observation_ref: current.observation_ref,
  available: current.available_action_refs };
assert.equal(nextAccess.exposedReceptionBefore(proposal, 0, rows, meta).admitted, true);

// Opposite cases are explicit synthetic contract probes, never live outcomes.
const probes = [];
const probe = (name, verify) => { verify(); probes.push({ name, passed: true, scope: 'synthetic_contract_probe' }); };
probe('unmeasurable_public_packet_still_returns_null_without_event', () => {
  assert.equal(propose(nextMemory, source.lastExposedTransition.after, packets[20].frame_rows), null);
  assert.deepEqual(nextMemory.currentState(), nextState);
});
probe('stale_current_reference_rejected_by_target_and_before', () => {
  const stale = { ...current, observation_ref: current.observation_ref + ':changed' };
  assert.equal(target.bind(proposal, stale, objective).reason, 'stale_proposal');
  assert.equal(nextAccess.exposedReceptionBefore(proposal, 0, rows, { ...meta, observation_ref: stale.observation_ref }).admitted, false);
});
probe('other_epoch_rejected_for_existing_plan', () => {
  assert.equal(target.bind(proposal, { ...current, level_epoch: current.level_epoch + 1 }, objective).reason, 'stale_proposal');
  assert.equal(nextAccess.exposedReceptionBefore(proposal, 0, rows, { ...meta, epoch: meta.epoch + 1 }).admitted, false);
});
probe('mutated_action_ref_rejected_by_target_and_before', () => {
  const changed = structuredClone(proposal); changed.actions = [{ action_ref: 'ACTION2' }];
  assert.equal(target.bind(changed, current, objective).reason, 'unbound_action_set');
  assert.equal(nextAccess.exposedReceptionBefore(changed, 0, rows, meta).admitted, false);
});
probe('synchronized_action_and_point_mutation_still_rejected_by_before', () => {
  const changed = structuredClone(proposal);
  changed.actions = [{ action_ref: 'ACTION6', data: { x: 1, y: 1 } }];
  changed.bundle_template.actions = structuredClone(changed.actions);
  assert.equal(nextAccess.exposedReceptionBefore(changed, 0, rows, meta).admitted, false);
});
probe('mutated_public_raster_rejected_by_before', () => {
  const changed = structuredClone(rows); changed[0][0] = (changed[0][0] + 1) % 16;
  assert.equal(nextAccess.exposedReceptionBefore(proposal, 0, changed, meta).admitted, false);
});
probe('unavailable_action_rejected_by_before', () => {
  assert.equal(nextAccess.exposedReceptionBefore(proposal, 0, rows, { ...meta, available: [] }).admitted, false);
});
probe('other_epoch_uses_fresh_proposal_state_without_acquisition', () => {
  const changed = { ...current, level_epoch: current.level_epoch + 1, observation_ref: current.observation_ref + ':new-epoch' };
  const proposed = propose(nextMemory, changed);
  assert.deepEqual(proposed.exposed_reception_plan.state, { epoch: changed.level_epoch, layout: proposal.exposed_reception_plan.scene.layout,
    evidence: [changed.observation_ref], probed: [], dial_tried: [] });
  assert.deepEqual(nextMemory.currentState(), nextState);
});
const fromState = (change) => {
  const event = structuredClone(events.at(-1)); change(event.state);
  return restore(nextAccess, [event]);
};
probe('other_layout_memory_uses_fresh_proposal_state', () => {
  const memory = fromState(state => { state.layout += ':other-layout'; });
  const before = memory.currentState(); const proposed = propose(memory);
  assert.deepEqual(proposed.exposed_reception_plan.state, { epoch: current.level_epoch, layout: proposal.exposed_reception_plan.scene.layout,
    evidence: [current.observation_ref], probed: [], dial_tried: [] });
  assert.deepEqual(memory.currentState(), before);
});
probe('evidence_bound_keeps_fifteen_recent_history_refs_plus_current', () => {
  const history = Array.from({ length: 20 }, (_, i) => `synthetic-history:${i}`);
  const memory = fromState(state => { state.evidence = history; });
  const before = memory.currentState(); const proposed = propose(memory);
  assert.deepEqual(proposed.bundle_template.evidence, [...history.slice(-15), current.observation_ref]);
  assert.equal(proposed.bundle_template.evidence.length, 16);
  assert.deepEqual(proposed.exposed_reception_plan.state.evidence, history);
  assert.deepEqual(memory.currentState(), before);
});
probe('current_ref_already_in_window_preserves_order_and_duplicates', () => {
  const history = ['synthetic-history:0', current.observation_ref, 'synthetic-history:1', 'synthetic-history:1'];
  const memory = fromState(state => { state.evidence = history; });
  assert.deepEqual(propose(memory).bundle_template.evidence, history);
});
probe('current_ref_outside_retained_window_is_added_back', () => {
  const history = [current.observation_ref, ...Array.from({ length: 20 }, (_, i) => `synthetic-history:${i}`)];
  const memory = fromState(state => { state.evidence = history; });
  assert.deepEqual(propose(memory).bundle_template.evidence, [...history.slice(-15), current.observation_ref]);
});
probe('mutating_old_snapshot_or_proposal_does_not_alias_owned_memory', () => {
  const detached = nextMemory.currentState(); detached.reception_state.evidence.push('synthetic-mutation');
  const disposable = propose(nextMemory); disposable.exposed_reception_plan.state.evidence.push('synthetic-mutation');
  disposable.bundle_template.evidence.push('synthetic-mutation');
  assert.deepEqual(nextMemory.currentState(), nextState);
  assert.deepEqual(propose(nextMemory), proposal);
});
probe('restoring_actual_events_reproduces_same_corrected_proposal_and_guards', () => {
  const restored = restore(nextAccess), reproduced = propose(restored);
  assert.deepEqual(reproduced, proposal);
  assert.deepEqual(target.bind(reproduced, current, objective), newBinding);
  assert.equal(nextAccess.exposedReceptionBefore(reproduced, 0, rows, meta).admitted, true);
  assert.equal(nextAccess.exposedReceptionBefore(reproduced, 0, rows, { ...meta, observation_ref: 'stale' }).admitted, false);
  assert.equal(restored.eventCount, 19);
});
function differences(a, b, path = '') {
  if (isDeepStrictEqual(a, b)) return [];
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) || Array.isArray(b)) return [{ path, before: a, after: b }];
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].sort().flatMap(key => differences(a[key], b[key], path ? `${path}.${key}` : key));
}
const diff = differences(oldProposal, proposal);
assert.deepEqual(diff.map(entry => entry.path), ['bundle_template.evidence', 'question.hypothesis_refs', 'route_refs']);
const sourceHashes = [];
for (const path of [accessPath, observationPath, targetPath]) sourceHashes.push({ path,
  baselineSha256: hash(await readFile(join(baselineRoot, path))), candidateSha256: hash(await readFile(join(root, path))) });
const result = {
  schema: 'logos-engine.v6.exposed-current-evidence-diagnostic.v1',
  scope: 'Component proof on prior real public packets and 19 own events, plus explicitly synthetic contract probes. No new game execution or success claim.',
  baseline: { nativeVersion: '0.43', commit: 'e9fd144112b05a65af5c88e9f05c541f43ed8ed7', nativeSourceDigest: campaign.source.digest },
  inputs: [...source.inputs, { path: sourcePath, sha256: hash(await readFile(join(root, sourcePath))) },
    { path: policyPath, sha256: hash(await readFile(join(root, policyPath))) }],
  sourceHashes,
  realTrajectory: { sceneAdmissions: measurements.map(value => ({ sequence: value.sequence, admitted: value.scene !== null })),
    retainedOwnEvents: 19, terminalObservation: current, originalSourceProposalReproduced: true,
    samePlanIdentity: true, sameCompletePlan: true, sameActions: true, action: proposal.actions,
    noAcquisitionDuringProposal: true, unmeasurableTransitionStillProducesNoOwnEvent: true,
    historicalEvidenceUnchanged: true, historicalEvidenceCount: oldProposal.exposed_reception_plan.state.evidence.length,
    currentEnvelopeCount: proposal.bundle_template.evidence.length, beforeGuardAdmitted: true,
    oldTargetBinding: oldBinding, correctedTargetBinding: newBinding },
  exactProposalDifference: diff, contractProbes: probes,
  qualification: 'The native extension differs intentionally from source only at current proposal evidence. A newly admitted plan is not a witnessed command or completed level. Future live behavior remains outside this component proof.'
};
await mkdir(out, { recursive: true });
await writeFile(join(out, 'current-evidence-result.json'), JSON.stringify(result, null, 2) + '\n');
await writeFile(join(out, 'candidate-terminal-proposal.json'), JSON.stringify(proposal, null, 2) + '\n');
console.log(JSON.stringify({ result: relative(root, join(out, 'current-evidence-result.json')), retainedOwnEvents: 19,
  exactChangedPaths: diff.map(entry => entry.path), baselineAdmitted: oldBinding.admitted,
  candidateAdmitted: newBinding.admitted, contractProbesPassed: probes.length }));
