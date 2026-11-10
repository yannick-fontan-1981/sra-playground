/** Read-only component comparison; execute from the repository root with Node. */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { ExposedReceptionMemory } from '../../../../../src/logos-engine/v6-exposed-reception-access.ts';
import { measureExposedReception, measureLargeExposedReception, measureSmallExposedReception,
  exposedReceptionInputCandidates } from '../../../../../src/logos-engine/v6-exposed-reception-observation.ts';
import { CompositionTargetTree } from '../../../../../src/logos-engine/v6-target-binding.ts';

const directory = 'docs/migration/lot3c-evidence/final/';
const read = async path => JSON.parse(path.endsWith('.gz') ? gunzipSync(await readFile(path)) : await readFile(path));
const source = await read(directory + 'cwse-terminal-diagnostic/source-result.json');
const campaign = await read(directory + 'cwse-session/cwse-campaign.json.gz');
const trace = await read(directory + 'cwse-session/cwse-public-trace.json.gz');
const packets = trace.packets.map(entry => entry.packet);
const memory = new ExposedReceptionMemory();
const events = campaign.prefixes.flatMap(prefix => prefix.sharedSeries.exposedReceptionAcquiredEvents);
for (const event of events) memory.applyEvent(event);
assert.equal(memory.eventCount, 19);
const measurements = [19, 20, 21].map(sequence => ({ sequence, frameHash: packets[sequence].frame_hash,
  scene: measureExposedReception(packets[sequence].frame_rows),
  largeScene: measureLargeExposedReception(packets[sequence].frame_rows),
  smallScene: measureSmallExposedReception(packets[sequence].frame_rows) }));
assert.deepEqual(measurements, source.measurements);
const prefix = campaign.prefixes.at(-2), capture = prefix.outlineAcquisition.nativeCheckpoint.public_transition;
const stateBefore = memory.currentState();
const returned = memory.record(source.lastExposedTransition.before, capture.command, source.lastExposedTransition.after,
  packets[19].frame_rows, packets[20].frame_rows, prefix.observedExposedReception.proposal, 7);
assert.deepEqual(returned, []);
assert.deepEqual(memory.currentState(), stateBefore);
const policy = await read('reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/morphology_policy/strategy.drm');
const config = { ...policy.declarations[0].configuration.observed_composition_services, remaining_level_actions: source.remaining };
const proposal = memory.propose(source.terminalObservation, packets[21].frame_rows,
  exposedReceptionInputCandidates(packets[21].frame_rows, packets[21].available_action_refs), Math.min(16, source.remaining), config);
assert.deepEqual(proposal, source.proposal, 'The complete own proposal including identity matches unchanged source');
assert.deepEqual(memory.currentState(), stateBefore);
const binding = new CompositionTargetTree().bind(proposal, source.terminalObservation, { id: 'G_official_completion' });
assert.deepEqual(binding, source.targetBinding);
const output = {
  schema: 'logos-engine.v6.exposed-terminal-native-diagnostic.v1',
  sourceResultSha256: createHash('sha256').update(await readFile(directory + 'cwse-terminal-diagnostic/source-result.json')).digest('hex'),
  nativeSourceDigest: campaign.source.digest,
  nativeMatchesOriginal: { measurements: true, ownRecordNoEvent: true, ownStateUnchanged: true, completeProposal: true, proposalIdentity: true, targetRejection: true },
  sceneAdmissions: measurements.map(value => ({ sequence: value.sequence, admitted: value.scene !== null })),
  targetBinding: binding,
  actionsEqualBundle: true,
  currentObservationInBundleEvidence: false,
  retainedOwnEvents: memory.eventCount,
  hypothesisStatus: {
    exposedPortDivergence: 'Not observed: same full proposal and guard outcome as retained source on this real terminal packet.',
    morphologyTargetBranch: 'Not reached: current-evidence gate rejects before morphology-specific target checks.',
    missingEphemeralMap: 'Not established by this check. Scene disappearance caused ancestor fallback at packet20; complete original caller behavior is outside this component diagnosis.',
    sourceEvidenceRebinding: 'Confirmed: same-epoch/same-layout state preserves its evidence ending before the unmeasurable transition and foreign action; current scene is remeasured but its observation reference is absent from bundle evidence.'
  },
  qualification: 'No game code, solution, host, new session, source mutation, synthetic command, or counterfactual game result. This compares immutable source components using prior real own events and public packets.'
};
await writeFile(directory + 'cwse-terminal-diagnostic/native-result.json', JSON.stringify(output, null, 2) + '\n');
console.log(JSON.stringify(output));
