/** Independent read-only native/source comparison of captured public returns.
 * Source-exact and declared native adaptation lanes retain separate verdicts.
 * No game host, native proposal-memory priming or additional action is used.
 */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ReceptionServiceMemory, receptionServiceBefore, receptionServiceAfter } from '../../../../src/logos-engine/v6-reception-service-access.ts';
import { measureReceptionService, receptionServiceCarriers } from '../../../../src/logos-engine/v6-reception-service-observation.ts';
import { symbolicDigest as identity } from '../../../../src/logos-engine/v6-hash.ts';

const here = dirname(fileURLToPath(import.meta.url)), root = resolve(here, '../../../..');
const sourcePath = resolve(process.argv[2] ?? resolve(here, 'fogw-public-source-replay.json.gz'));
const load = path => JSON.parse(gunzipSync(readFileSync(path)).toString());
const source = load(sourcePath), slug = source.game.toLowerCase(), session = resolve(root, source.sessionPath);
const reportPath = resolve(session, slug + '-campaign.json.gz'), journalPath = resolve(session, slug + '-actual-public-journal.jsonl.gz');
const report = load(reportPath), journal = gunzipSync(readFileSync(journalPath)).toString().trim().split('\n').map(JSON.parse);
const policyPath = resolve(root, 'reference/v6', source.sourceCommit, 'source/agents/yf_arc3_v6/morphology_policy/strategy.drm');
const policy = JSON.parse(readFileSync(policyPath, 'utf8')).declarations[0].configuration.observed_composition_services;
const checks = [], observations = new Map();
const sha = value => createHash('sha256').update(value).digest('hex');
function equal(actual, expected, label) { assert.deepStrictEqual(actual, expected, label); checks.push(label); }
function findObservations(value) {
  if (Array.isArray(value)) for (const child of value) findObservations(child);
  else if (value && typeof value === 'object') {
    if (['observation_ref', 'revision', 'level_epoch', 'available_action_refs', 'entities'].every(key => key in value)) {
      if (observations.has(value.revision)) assert.deepStrictEqual(observations.get(value.revision), value);
      observations.set(value.revision, value);
    } else for (const child of Object.values(value)) findObservations(child);
  }
}
findObservations(report.inventorySourceCalls);
equal([...observations.keys()].sort((a, b) => a - b), Array.from({ length: journal.length }, (_, i) => i + 1), 'all actual public observations retained');
for (let index = 0; index < journal.length; index++) {
  const observation = observations.get(index + 1), packet = journal[index].packet;
  for (const key of ['frame_hash', 'levels_completed', 'state', 'available_action_refs']) assert.deepStrictEqual(observation[key], packet[key]);
  assert.equal(observation.level_epoch, packet.level);
}
checks.push('every observation is bound to its actual public packet');
equal(source.originalFilesVerifiedBefore, 1786, 'all original files verified before replay');
equal(source.originalFilesVerifiedAfter, 1786, 'all original files verified after replay');

function runLane(lane, adapted) {
  let memory = new ReceptionServiceMemory({ currentEpochAcquisition: adapted });
  const begin = checks.length, label = adapted ? 'declared native adaptation' : 'exact original prefix';
  function state(expected, tag) {
    const current = memory.currentState();
    equal(identity(current.reception_memory), expected.memoryDigest, `${label} ${tag} acquired memory`);
    equal(identity(current.reception_events), expected.eventsDigest, `${label} ${tag} own journal`);
    equal(memory.eventCount, expected.eventCount, `${label} ${tag} event count`);
    equal(memory.retainedDigest(expected.parentDigest), expected.digest, `${label} ${tag} digest suffix on opaque original ancestor`);
  }
  state(lane.initialState, 'cold initial');
  let returned = 0, restored = 0;
  for (const prefix of lane.prefixes) {
    state(prefix.sourceStateBefore, `prefix ${prefix.index} before`);
    const observation = observations.get(prefix.revision), rows = journal[prefix.revision - 1].packet.frame_rows;
    const config = { ...structuredClone(policy), remaining_level_actions: prefix.remainingActions,
      ...(adapted ? { native_reception_wait_budget: true } : {}) };
    const proposal = memory.propose(structuredClone(observation), structuredClone(rows), structuredClone(prefix.nonpointInputs), prefix.prefixLimit, config);
    equal(proposal, prefix.sourceProposal, `${label} prefix ${prefix.index} complete own proposal`);
    const captured = report.prefixes[prefix.index].observedReceptionService.proposal;
    const capturedOwn = Object.fromEntries(Object.keys(proposal).map(key => [key, structuredClone(captured[key])]));
    for (const step of capturedOwn.steps) delete step.expected_before;
    equal(proposal, capturedOwn, `${label} prefix ${prefix.index} captured common own projection`);
    const capturedEvents = report.prefixes[prefix.index].sharedSeries.receptionServiceAcquiredEvents;
    for (const step of lane.steps.filter(value => value.prefixIndex === prefix.index)) {
      const before = observations.get(step.beforeRevision), after = observations.get(step.afterRevision);
      const first = journal[step.beforeRevision - 1].packet.frame_rows, later = journal[step.afterRevision - 1].packet.frame_rows;
      equal(proposal.actions[step.index], step.command, `${label} return ${step.sequence} proposed command`);
      const actual = journal[step.sequence].command;
      equal({ action_ref: step.command.action_ref, data: step.command.data ?? {} }, { action_ref: actual.action_ref, data: actual.data ?? {} }, `${label} return ${step.sequence} actual command`);
      equal(receptionServiceBefore(proposal, step.index, first, step.beforeMeta), step.beforeGuard, `${label} return ${step.sequence} before guard`);
      equal(receptionServiceAfter(proposal, step.index, first, later, step.afterMeta), step.afterGuard, `${label} return ${step.sequence} after guard`);
      const firstScene = measureReceptionService(first, proposal.reception_service_plan.scene);
      const lastScene = measureReceptionService(later, firstScene);
      equal(firstScene, step.sourceProjectionBefore, `${label} return ${step.sequence} before public projection`);
      equal(lastScene, step.sourceProjectionAfter, `${label} return ${step.sequence} after public projection`);
      equal(lastScene ? receptionServiceCarriers(later, lastScene) : [], step.sourceCarriersAfter, `${label} return ${step.sequence} actual carriers`);
      const events = memory.record(structuredClone(before), structuredClone(step.command), structuredClone(after), structuredClone(first), structuredClone(later), proposal, step.index);
      equal(events, [step.sourceOwnEvent], `${label} return ${step.sequence} original-method event`);
      equal(events, [capturedEvents[step.index]], `${label} return ${step.sequence} captured native event`);
      state(step.sourceStateAfter, `return ${step.sequence}`); returned++;
    }
    const snapshot = memory.currentState(), replacement = new ReceptionServiceMemory({ currentEpochAcquisition: adapted });
    for (const event of snapshot.reception_events) replacement.applyEvent(structuredClone(event));
    equal(replacement.currentState(), snapshot, `${label} prefix ${prefix.index} own checkpoint reconstruction`);
    memory = replacement; restored++;
  }
  state(lane.finalState, 'final');
  equal(returned, lane.steps.length, `${label} all replayed actual returns acquired once`);
  equal(lane.restorationOwnLayerEqual, true, `${label} original own checkpoint reconstruction`);
  if (!adapted && lane.stop?.kind === 'original_exception') {
    const prefix = report.prefixes[lane.stop.prefixIndex], observation = observations.get(prefix.decisionRevision), rows = journal[prefix.decisionRevision - 1].packet.frame_rows;
    const inputs = ['ACTION1', 'ACTION2', 'ACTION3', 'ACTION4', 'ACTION5'].filter(key => observation.available_action_refs.includes(key)).map(action_ref => ({ action_ref, data: {} }));
    assert.throws(() => memory.propose(observation, rows, inputs, Math.min(16, lane.stop.remainingActions),
      { ...structuredClone(policy), remaining_level_actions: lane.stop.remainingActions }), /Reception wait integer outside portable source domain/);
    checks.push('exact original stop preserves the same out-of-domain wait ledger rejection');
  }
  return { checks: checks.length - begin, prefixes: lane.prefixes.length, returns: returned, restorations: restored,
    sourceStop: lane.stop, differences: lane.differences.length, coldStart: true, primedFromCapturedProposalMemory: false,
    qualifiedOriginalWholeTrajectoryParity: !adapted && lane.stop === null && lane.differences.length === 0 && returned === source.capturedSelectedReceptionActions };
}

equal(source.adaptedOriginal.stop, null, 'adapted original lane completed all selected returns');
equal(source.adaptedOriginal.differences, [], 'adapted original lane retains no hidden differences');
const exact = runLane(source.exactOriginal, false), adapted = runLane(source.adaptedOriginal, true);
equal(adapted.returns, source.capturedSelectedReceptionActions, 'adapted cold lane covers the complete selected Reception trajectory');
equal(source.capturedGameActions, journal.length - 1, 'actual game action count is unchanged by read-only replay');
const perEpoch = [...new Set(source.adaptedOriginal.steps.map(step => step.beforeMeta.epoch))].map(epoch => {
  const steps = source.adaptedOriginal.steps.filter(step => step.beforeMeta.epoch === epoch);
  return { epoch, actions: steps.length, waits: steps.filter(step => step.sourceOwnEvent.detail.kind === 'reception_observation').length,
    acquiredWaitSpent: steps.at(-1).sourceOwnEvent.memory.wait_spent,
    stationaryExperiments: steps.filter(step => step.sourceOwnEvent.detail.kind === 'reception_observation' && step.sourceOwnEvent.detail.carrier_delta?.every(value => value === 0)).length,
    boundaryReturns: steps.filter(step => step.sourceOwnEvent.detail.boundary).map(step => step.sequence) };
});
const paths = [sourcePath, reportPath, journalPath, policyPath, fileURLToPath(import.meta.url),
  resolve(root, 'src/logos-engine/v6-reception-service-access.ts'), resolve(root, 'src/logos-engine/v6-reception-service-observation.ts'),
  resolve(root, 'src/logos-engine/v6-reception-residual-evidence.ts'), resolve(root, 'src/logos-engine/v5-reception-wait-contracts.ts')];
const receipt = { schema: 'logos-engine.lot3e.reception-public-native-source-review.v1', status: 'passed_with_declared_native_adaptations',
  game: source.game, checks: checks.length, failed: 0, labels: checks, sourceCommit: source.sourceCommit,
  exactOriginal: exact, declaredNativeAdaptation: adapted, perEpoch,
  originalFilesVerifiedBefore: source.originalFilesVerifiedBefore, originalFilesVerifiedAfter: source.originalFilesVerifiedAfter,
  newGameActions: 0, levelJumps: 0, inputs: Object.fromEntries(paths.map(path => [relative(root, path), sha(readFileSync(path))])),
  capturedCommonTerminal: { actions: report.final.actions, levelsCompleted: report.final.levelsCompleted, level: report.final.level,
    status: report.final.status, reason: report.final.reason, prefixes: report.final.prefixes },
  qualification: 'The untouched original lane and the complete declared-adaptation lane are reported separately. Every lane starts cold and reconstructs only earlier source-produced own events. The complete native path matches unchanged original methods only through the explicitly declared external ownership/current-epoch/stationary/wait-budget adaptations. The exact original exception remains a retained limitation, not a full original parity result. Continuation guards check layout and carrier; request counterpart identity is not separately part of the source layout. No game source, new action, full inherited caller parity or additional level success is inferred.' };
const output = resolve(here, slug + '-public-parity.json');
writeFileSync(output, JSON.stringify(receipt, null, 2) + '\n');
process.stdout.write(JSON.stringify({ path: relative(root, output), status: receipt.status, checks: checks.length, failed: 0,
  exactOriginal: exact, declaredNativeAdaptation: adapted, perEpoch }) + '\n');
