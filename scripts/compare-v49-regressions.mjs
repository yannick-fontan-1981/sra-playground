/** Check exact public behavior and declared acquisition projections after catalogue acquisition and the source view fallback. */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const [beforePath, afterPath, outputPath] = process.argv.slice(2);
if (!beforePath || !afterPath || !outputPath) throw new Error('Usage: compare-v49-regressions.mjs BASELINE.json CURRENT.json COMPARISON.json');
const beforeBytes = await readFile(beforePath), afterBytes = await readFile(afterPath);
const before = JSON.parse(beforeBytes), after = JSON.parse(afterBytes);
const sha = bytes => createHash('sha256').update(bytes).digest('hex'), checks = [];
const derivedRefs = new Map(), referenceChecks = [];
const omit = (value, names) => Object.fromEntries(Object.entries(value).filter(([key]) => !names.includes(key)));
const pick = (value, names) => Object.fromEntries(names.filter(key => Object.hasOwn(value, key)).map(key => [key, value[key]]));
function normalizeScope(value) {
  if (typeof value === 'string') return (derivedRefs.get(value) ?? value).replace(/^sra-v6-[^:]+(?=:epoch:)/, 'campaign-scope');
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
  return normalizeScope({ ...omit(series, ['digest', 'digestScope', 'traceFieldExtensionCount', 'traceFieldLatestExtension', 'linkedPacketEvidenceCount', 'linkedPacketLatestEvidence', 'labeledSequenceLatestSubmission', 'queuedFieldModelCount', 'queuedFieldLatestModel', 'queuedFieldAcquiredModels', 'catalogueEventCount', 'catalogueLatestEvent', 'catalogueAcquiredEvents']),
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
const ascii = value => JSON.stringify(value).replace(/[\u007f-\uffff]/g, character => '\\u' + character.charCodeAt(0).toString(16).padStart(4, '0'));
const canonical = value => value === null || typeof value !== 'object' ? ascii(value)
  : Array.isArray(value) ? '[' + value.map(canonical).join(',') + ']'
  : '{' + Object.keys(value).sort().map(key => ascii(key) + ':' + canonical(value[key])).join(',') + '}';
const digest = value => sha(Buffer.from(canonical(value)));
function registerDerived(kind, prefixIndex, left, right, leftPayload, rightPayload, prefix = '') {
  assert.equal(left, prefix + digest(leftPayload), `Baseline ${kind} derived identity`);
  assert.equal(right, prefix + digest(rightPayload), `Current ${kind} derived identity`);
  const name = derivedRefs.get(left) ?? derivedRefs.get(right) ?? `scoped-derived:${kind}:${prefixIndex}`;
  if (derivedRefs.has(left)) assert.equal(derivedRefs.get(left), name);
  if (derivedRefs.has(right)) assert.equal(derivedRefs.get(right), name);
  derivedRefs.set(left, name); derivedRefs.set(right, name);
  referenceChecks.push({kind, prefixIndex, baseline:left, current:right, independentlyRecomputed:true});
}
for (let index = 0; index < before.prefixes.length; index++) {
  const left = before.prefixes[index], right = after.prefixes[index];
  if (!right) break;
  if (left.traceField && right.traceField) {
    const a = left.traceField.plan, b = right.traceField.plan;
    registerDerived('trace_request', index, a.estimate.receipt.scope.request_ref, b.estimate.receipt.scope.request_ref,
      [a.observation_ref, a.scene], [b.observation_ref, b.scene], 'trace:');
  }
  if (left.queuedField && right.queuedField) {
    const a = left.queuedField.plan, b = right.queuedField.plan;
    const previousA = before.prefixes[index - 1]?.sharedSeries.queuedFieldLatestModel?.state ?? null;
    const previousB = after.prefixes[index - 1]?.sharedSeries.queuedFieldLatestModel?.state ?? null;
    const stateA = a.portable_model ?? (previousA?.epoch === a.epoch ? previousA : null);
    const stateB = b.portable_model ?? (previousB?.epoch === b.epoch ? previousB : null);
    registerDerived('queue_model', index, a.model_digest, b.model_digest, stateA, stateB);
    if (a.portable_model && b.portable_model) registerDerived('queue_source_relation', index,
      a.portable_model.transfer_scope.source_relation_digest, b.portable_model.transfer_scope.source_relation_digest,
      [previousA.controls, previousA.closure_models], [previousB.controls, previousB.closure_models]);
    if (a.estimate && b.estimate) registerDerived('queue_request', index,
      a.estimate.mechanical_receipt.request.request_ref, b.estimate.mechanical_receipt.request.request_ref,
      [a.observation_ref, a.estimate.placed, a.estimate.model_alternatives[0]],
      [b.observation_ref, b.estimate.placed, b.estimate.model_alternatives[0]], 'queue:');
  }
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
same('same complete trace plans and latest acquired trace payloads',
  before.prefixes.map(prefix => normalizeScope([prefix.sharedSeries.traceFieldExtensionCount ?? 0, prefix.sharedSeries.traceFieldLatestExtension ?? null, prefix.traceField ?? null])),
  after.prefixes.map(prefix => normalizeScope([prefix.sharedSeries.traceFieldExtensionCount, prefix.sharedSeries.traceFieldLatestExtension, prefix.traceField ?? null])));
same('same acquired linked packet counts, complete latest payloads and complete plans',
  before.prefixes.map(prefix => normalizeScope([prefix.sharedSeries.linkedPacketEvidenceCount ?? 0, prefix.sharedSeries.linkedPacketLatestEvidence ?? null, prefix.linkedPacket ?? null])),
  after.prefixes.map(prefix => normalizeScope([prefix.sharedSeries.linkedPacketEvidenceCount, prefix.sharedSeries.linkedPacketLatestEvidence, prefix.linkedPacket ?? null])));
same('same complete queued-field plans and every acquired model event',
  before.prefixes.map(prefix => normalizeScope([prefix.sharedSeries.queuedFieldModelCount ?? 0, prefix.sharedSeries.queuedFieldLatestModel ?? null, prefix.sharedSeries.queuedFieldAcquiredModels ?? [], prefix.queuedField ?? null])),
  after.prefixes.map(prefix => normalizeScope([prefix.sharedSeries.queuedFieldModelCount, prefix.sharedSeries.queuedFieldLatestModel, prefix.sharedSeries.queuedFieldAcquiredModels, prefix.queuedField ?? null])));
same('new catalogue layers remain empty and never select these retained trajectories',
  after.prefixes.map(prefix => [prefix.sharedSeries.catalogueEventCount, prefix.sharedSeries.catalogueLatestEvent, prefix.sharedSeries.catalogueAcquiredEvents, prefix.occludedCatalogue ?? null]),
  after.prefixes.map(() => [0, null, [], null]));
same('same request outcomes and common caller counters', before.requests.map(row => omit(row, ['activeSeconds', 'elapsedMs'])), after.requests.map(row => omit(row, ['activeSeconds', 'elapsedMs'])));
same('same final public result and retained-session counters', omit(before.final, ['activeSeconds', 'nativeImplementation']), omit(after.final, ['activeSeconds', 'nativeImplementation']));
same('source frozen during both runs and no Python agent modules', [before.sourceUnchangedDuringRun, after.sourceUnchangedDuringRun, before.pythonAgentModules, after.pythonAgentModules], [true, true, [], []]);
same('same retained mechanical-domain assessments', before.domainAssessments, after.domainAssessments);
const result = { schema: 'logos-engine.v49.public-regression-comparison.v1', passed: checks.every(check => check.passed), checks, independentlyRecomputedReferences: referenceChecks,
  before: { path: beforePath, sha256: sha(beforeBytes), sourceDigest: before.source.digest },
  after: { path: afterPath, sha256: sha(afterBytes), sourceDigest: after.source.digest,
    mode: after.recordedPublicReplay ? 'recorded-public-replay' : 'actual-game-campaign' },
  compared: { commands: before.actions.length, completePublicPackets: before.actions.length + 1, prefixes: before.prefixes.length },
  qualification: 'Exact public commands, complete packet hashes, source selection, prefix/acquisition counts and listed retained projections are compared. Observation session prefixes are normalized. Trace request and Queue model/portable-relation/request identifiers are independently recomputed from complete retained payloads before normalization. Their complete plans and acquired payloads remain compared, including numeric fields. Native graph chain/revision, inherited digest, session-derived observed-program model IDs, full labeled cache and five predicate proof references are outside the retained projection. Coordination source/preferred entries and current guards remain compared; full proposal digest and graph-node references are not asserted equal. Catalogue and catalogue-view own events must remain empty on all five prior trajectories. Linked Packet plans and latest acquired payloads retain complete comparison. Recorded-public replay recomputes commands before supplying prior actual returns and is neither a new live success nor a speed measurement.',
};
await writeFile(outputPath, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ passed: result.passed, checks: checks.length, compared: result.compared, failed: checks.filter(check => !check.passed).map(check => check.name) }));
if (!result.passed) process.exitCode = 1;
