/** Check exact public behavior and declared acquisition projections after Queued Field integration and corroborated continuation coordination. */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const [beforePath, afterPath, outputPath] = process.argv.slice(2);
if (!beforePath || !afterPath || !outputPath) throw new Error('Usage: compare-v48-regressions.mjs BASELINE.json CURRENT.json COMPARISON.json');
const beforeBytes = await readFile(beforePath), afterBytes = await readFile(afterPath);
const before = JSON.parse(beforeBytes), after = JSON.parse(afterBytes);
const sha = bytes => createHash('sha256').update(bytes).digest('hex'), checks = [];
const omit = (value, names) => Object.fromEntries(Object.entries(value).filter(([key]) => !names.includes(key)));
const pick = (value, names) => Object.fromEntries(names.filter(key => Object.hasOwn(value, key)).map(key => [key, value[key]]));
function normalizeScope(value) {
  if (typeof value === 'string') return value.replace(/^sra-v6-[^:]+(?=:epoch:)/, 'campaign-scope');
  if (Array.isArray(value)) return value.map(normalizeScope);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalizeScope(item)]));
  return value;
}
function prefixProjection(prefix) {
  return normalizeScope(pick(prefix, ['decisionRevision', 'acquiredActions', 'family', 'operations', 'proposalKind', 'fieldSubquestion',
    'programControlProbeMode', 'programRelationMode', 'rootedQuotaPhase', 'productPanelFactors', 'productPanelEstimated',
    'productPanelObservedSteps', 'labeledSequenceLabel', 'labeledSequenceQuery', 'labeledSequenceTrainingReused',
    'labeledSequenceCompatiblePredicates', 'labeledSequenceAgreement', 'labeledSequenceGrammarSize', 'supportMode', 'callerAcquiredTransitions']));
}
function seriesProjection(prefix) {
  const series = prefix.sharedSeries, submission = series.labeledSequenceLatestSubmission;
  return normalizeScope({ ...omit(series, ['digest', 'digestScope', 'traceFieldExtensionCount', 'traceFieldLatestExtension', 'linkedPacketEvidenceCount', 'linkedPacketLatestEvidence', 'labeledSequenceLatestSubmission', 'queuedFieldModelCount', 'queuedFieldLatestModel', 'queuedFieldAcquiredModels']),
    programModels: series.programModels.map(model => omit(model, ['modelId'])),
    labeledSequenceLatestSubmission: submission ? omit(submission, ['cache']) : null });
}
function compositionProjection(prefix) {
  const value = prefix.labeledSequenceNativeComposition;
  // Elimination witnesses also hash the original training receipt references.
  return value ? omit(value, ['currentTrainingReceiptDigest', 'fitTrainingReceiptDigest', 'evidence_ref', 'sourceContradictionRef', 'eliminationWitnessDigest']) : null;
}
const coordination = prefix => (prefix.nativeCoordination ?? []).map(receipt => normalizeScope(pick(receipt,
  ['rule', 'observation_ref', 'guard_reason', 'scope', 'deferred_family', 'preferred_family', 'physical_action_authorized',
   'source_trigger_group', 'source_trigger_entry', 'selected_group', 'selected_entry', 'selected_subquestion'])));
function same(name, left, right) {
  try { assert.deepEqual(left, right); checks.push({ name, passed: true }); }
  catch (error) { checks.push({ name, passed: false, difference: error.message }); }
}
same('same declared game/target and both results passed', [before.game, before.targetLevels, before.status, after.status],
  [after.game, after.targetLevels, 'passed', 'passed']);
same('same production budgets and original game asset provenance', [before.budget, before.gameAssets], [after.budget, after.gameAssets]);
same('same complete initial public packet', before.initial, after.initial);
same('same commands, full returned animation packet hashes and primitive boundaries',
  before.actions.map(action => omit(action, ['executionMs'])), after.actions.map(action => omit(action, ['executionMs'])));
same('same selected source entries, acquired prefix lengths and observed solver projections', before.prefixes.map(prefixProjection), after.prefixes.map(prefixProjection));
same('same retained source-layer projections and labeled public submission receipts', before.prefixes.map(seriesProjection), after.prefixes.map(seriesProjection));
same('same bounded native predicate composition counts, survivors and reuse', before.prefixes.map(compositionProjection), after.prefixes.map(compositionProjection));
same('same source and preferred entry coordination with current guards', before.prefixes.map(coordination), after.prefixes.map(coordination));
same('same reduction geometry plan and step modes', before.prefixes.map(prefix => prefix.reductionTransport ? pick(prefix.reductionTransport, ['plan', 'stepModes', 'stateNode']) : null),
  after.prefixes.map(prefix => prefix.reductionTransport ? pick(prefix.reductionTransport, ['plan', 'stepModes', 'stateNode']) : null));
same('new Trace layer remains empty and never selects these legacy prefixes',
  after.prefixes.map(prefix => [prefix.sharedSeries.traceFieldExtensionCount, prefix.sharedSeries.traceFieldLatestExtension, prefix.traceField ?? null]),
  after.prefixes.map(() => [0, null, null]));
same('same acquired linked packet counts, complete latest payloads and complete plans',
  before.prefixes.map(prefix => normalizeScope([prefix.sharedSeries.linkedPacketEvidenceCount ?? 0, prefix.sharedSeries.linkedPacketLatestEvidence ?? null, prefix.linkedPacket ?? null])),
  after.prefixes.map(prefix => normalizeScope([prefix.sharedSeries.linkedPacketEvidenceCount, prefix.sharedSeries.linkedPacketLatestEvidence, prefix.linkedPacket ?? null])));
same('new Queued Field layer remains empty and never selects these retained trajectories',
  after.prefixes.map(prefix => [prefix.sharedSeries.queuedFieldModelCount, prefix.sharedSeries.queuedFieldLatestModel, prefix.sharedSeries.queuedFieldAcquiredModels, prefix.queuedField ?? null]),
  after.prefixes.map(() => [0, null, [], null]));
same('same request outcomes and common caller counters', before.requests.map(row => omit(row, ['activeSeconds', 'elapsedMs'])), after.requests.map(row => omit(row, ['activeSeconds', 'elapsedMs'])));
same('same final public result and retained-session counters', omit(before.final, ['activeSeconds', 'nativeImplementation']), omit(after.final, ['activeSeconds', 'nativeImplementation']));
same('source frozen during both runs and no Python agent modules', [before.sourceUnchangedDuringRun, after.sourceUnchangedDuringRun, before.pythonAgentModules, after.pythonAgentModules], [true, true, [], []]);
same('same retained mechanical-domain assessments', before.domainAssessments, after.domainAssessments);
const result = { schema: 'logos-engine.v48.public-regression-comparison.v1', passed: checks.every(check => check.passed), checks,
  before: { path: beforePath, sha256: sha(beforeBytes), sourceDigest: before.source.digest },
  after: { path: afterPath, sha256: sha(afterBytes), sourceDigest: after.source.digest,
    mode: after.recordedPublicReplay ? 'recorded-public-replay' : 'actual-game-campaign' },
  compared: { commands: before.actions.length, completePublicPackets: before.actions.length + 1, prefixes: before.prefixes.length },
  qualification: 'Exact public commands, complete packet hashes, source selection, prefix/acquisition counts and listed retained projections are compared. Observation session prefixes are normalized. Native graph chain/revision, inherited digest, session-derived model IDs, full labeled cache, five session-derived predicate proof references (including the elimination witness digest of training receipt refs) and complete reduction state are outside this projection. Reduction geometry/step modes, labeled public receipts, composition counts/survivors/reuse and selected coordination entries remain checked. Trace and Queued Field state must remain empty on these five retained trajectories. Linked Packet plans and latest acquired payloads are compared completely with observation-session normalization only, including all numerical fields and cache identities. Recorded-public replay recalculates commands before supplying prior actual returns; it is not a new live game, full internal-state parity or a speed comparison.',
};
await writeFile(outputPath, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ passed: result.passed, checks: checks.length, compared: result.compared, failed: checks.filter(check => !check.passed).map(check => check.name) }));
if (!result.passed) process.exitCode = 1;
