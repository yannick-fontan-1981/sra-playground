/** Check eight retained public trajectories after framed-transfer integration. */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { compareMaterialProjection } from './compare-v52-material-projection.mjs';

const [beforePath, afterPath, outputPath] = process.argv.slice(2);
if (!beforePath || !afterPath || !outputPath) throw new Error('Usage: compare-v52-regressions.mjs BASELINE.json CURRENT.json COMPARISON.json');
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
  return normalizeScope({ ...omit(series, ['digest', 'digestScope', 'traceFieldExtensionCount', 'traceFieldLatestExtension', 'linkedPacketEvidenceCount', 'linkedPacketLatestEvidence', 'labeledSequenceLatestSubmission', 'queuedFieldModelCount', 'queuedFieldLatestModel', 'queuedFieldAcquiredModels', 'catalogueEventCount', 'catalogueLatestEvent', 'catalogueAcquiredEvents', 'typedMaterialEventCount', 'typedMaterialLatestEvent', 'typedMaterialAcquiredEvents', 'typedMaterialAcquiredNegativeZeroPaths', 'fieldServiceEventCount', 'fieldServiceLatestEvent', 'fieldServiceAcquiredEvents', 'fieldServiceAcquiredNegativeZeroPaths']),
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
function catalogueProjectionPayload(plan) {
  // Reconstruct the finite mask/pose request from retained plan data, without importing the solver.
  const fits = plan.evidence.pose_alternatives;
  const poses = [...new Map(fits.map(fit => {
    const pose = [fit.scale, ...fit.translation]; return [JSON.stringify(pose), pose];
  })).values()].sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
  const scales = [...new Set(poses.map(pose => pose[0]))].sort((a, b) => a - b);
  const masks = plan.scene.cards.map((card, index) => ({ candidate_ref: `M${index}`,
    pixels: card.mask.map(point => ({ point, value_ref: `palette:${plan.scene.palette}` })),
    supported_integer_scales: scales, mask_provenance_ref: plan.observation_ref }));
  return { request: [plan.observation_ref, plan.scene.geometry_ref, fits], model: [masks, poses] };
}
const catalogueEventsBefore = [], catalogueEventsAfter = [];
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
  if (left.occludedCatalogue && right.occludedCatalogue) {
    const a = left.occludedCatalogue.plan, b = right.occludedCatalogue.plan;
    if (a.evidence && b.evidence) {
      // The source catalogue memory excludes its separate view-event layer.
      const supportA = catalogueEventsBefore.filter(event => event.field_key === a.field_key);
      const supportB = catalogueEventsAfter.filter(event => event.field_key === b.field_key);
      assert.deepEqual(a.evidence.supporting_event_digests, supportA.map(digest), 'Baseline catalogue supporting events');
      assert.deepEqual(b.evidence.supporting_event_digests, supportB.map(digest), 'Current catalogue supporting events');
      assert.equal(supportA.length, supportB.length, 'Same catalogue supporting event count');
      for (let eventIndex = 0; eventIndex < supportA.length; eventIndex++) registerDerived(`catalogue_supporting_event_${eventIndex}`, index,
        a.evidence.supporting_event_digests[eventIndex], b.evidence.supporting_event_digests[eventIndex], supportA[eventIndex], supportB[eventIndex]);
      if (a.evidence.receipt && b.evidence.receipt) {
        const payloadA = catalogueProjectionPayload(a), payloadB = catalogueProjectionPayload(b);
        for (const section of ['scope', 'descriptive_facts']) {
          registerDerived(`catalogue_projection_request_${section}`, index,
            a.evidence.receipt[section].request_ref, b.evidence.receipt[section].request_ref,
            payloadA.request, payloadB.request, 'projection:');
          registerDerived(`catalogue_projection_model_${section}`, index,
            a.evidence.receipt[section].model_revision_ref, b.evidence.receipt[section].model_revision_ref,
            payloadA.model, payloadB.model);
        }
      }
    }
  }
  // Current acquisition occurs after this prefix's proposal; never use its future evidence in a reference recipe.
  catalogueEventsBefore.push(...(left.sharedSeries.catalogueAcquiredEvents ?? [])
    .filter(event => ['catalogue_observation', 'catalogue_response'].includes(event.kind)));
  catalogueEventsAfter.push(...(right.sharedSeries.catalogueAcquiredEvents ?? [])
    .filter(event => ['catalogue_observation', 'catalogue_response'].includes(event.kind)));
}
const material = before.game === 'LIFE' ? await compareMaterialProjection(before, after) : null;
if (material) referenceChecks.push(...material.referenceChecks);
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
same('same complete catalogue plans, latest payloads and every acquired catalogue or view event',
  before.prefixes.map(prefix => normalizeScope([prefix.sharedSeries.catalogueEventCount ?? 0, prefix.sharedSeries.catalogueLatestEvent ?? null,
    prefix.sharedSeries.catalogueAcquiredEvents ?? [], prefix.occludedCatalogue ? pick(prefix.occludedCatalogue, ['plan', 'stateNode']) : null])),
  after.prefixes.map(prefix => normalizeScope([prefix.sharedSeries.catalogueEventCount, prefix.sharedSeries.catalogueLatestEvent,
    prefix.sharedSeries.catalogueAcquiredEvents, prefix.occludedCatalogue ? pick(prefix.occludedCatalogue, ['plan', 'stateNode']) : null])));
if (before.game !== 'VALV') same('field-service layers remain empty on the seven earlier trajectories',
  after.prefixes.map(prefix => [prefix.sharedSeries.fieldServiceEventCount, prefix.sharedSeries.fieldServiceLatestEvent,
    prefix.sharedSeries.fieldServiceAcquiredEvents, prefix.sharedSeries.fieldServiceAcquiredNegativeZeroPaths, prefix.fieldService ?? null]),
  after.prefixes.map(() => [0, null, [], [], null]));
if (before.game !== 'LIFE') same('typed-material layers remain empty outside LIFE on the retained trajectories',
  after.prefixes.map(prefix => [prefix.sharedSeries.typedMaterialEventCount, prefix.sharedSeries.typedMaterialLatestEvent,
    prefix.sharedSeries.typedMaterialAcquiredEvents, prefix.sharedSeries.typedMaterialAcquiredNegativeZeroPaths, prefix.typedMaterial ?? null]),
  after.prefixes.map(() => [0, null, [], [], null]));
if (material) same('same complete material provider envelopes, every acquired receipt and independently reconstructed own layers',
  material.beforeProjection, material.afterProjection);
same('same request outcomes and common caller counters', before.requests.map(row => omit(row, ['activeSeconds', 'elapsedMs'])), after.requests.map(row => omit(row, ['activeSeconds', 'elapsedMs'])));
same('same final public result and retained-session counters', omit(before.final, ['activeSeconds', 'nativeImplementation']), omit(after.final, ['activeSeconds', 'nativeImplementation']));
same('source frozen during both runs and no Python agent modules', [before.sourceUnchangedDuringRun, after.sourceUnchangedDuringRun, before.pythonAgentModules, after.pythonAgentModules], [true, true, [], []]);
same('same retained mechanical-domain assessments', before.domainAssessments, after.domainAssessments);
const result = { schema: 'logos-engine.v52.public-regression-comparison.v1', passed: checks.every(check => check.passed), checks, independentlyRecomputedReferences: referenceChecks,
  ...(material ? { typedMaterialComparison: material.proof } : {}),
  before: { path: beforePath, sha256: sha(beforeBytes), sourceDigest: before.source.digest },
  after: { path: afterPath, sha256: sha(afterBytes), sourceDigest: after.source.digest,
    mode: after.recordedPublicReplay ? 'recorded-public-replay' : 'actual-game-campaign' },
  compared: { commands: before.actions.length, completePublicPackets: before.actions.length + 1, prefixes: before.prefixes.length },
  qualification: 'Exact public commands, complete packet hashes, source selection, prefix/acquisition counts and listed retained projections are compared. Observation session prefixes are normalized. Trace request, Queue model/portable-relation/request, and Catalogue supporting-event/projection-request/projection-model identifiers are independently recomputed from complete retained payloads before normalization. Catalogue support recipes use only prior catalogue observation/response events in the matching field; current acquired events are accumulated afterward. Complete Trace, Linked Packet and Queue plans and their declared acquired payloads remain compared, including numeric fields. Complete Catalogue plans, every acquired catalogue or view event, the latest payload, counts and state-node label remain compared; absent baseline layers are explicitly normalized to zero/null/empty. Its full caller proposal envelope is outside the retained projection. Native graph chain/revision, inherited digest, session-derived observed-program model IDs, full labeled cache and five predicate proof references are also outside that projection. Coordination source/preferred entries and current guards remain compared; full proposal digest and graph-node references are not asserted equal. Field Service own counts, latest payload, acquisitions, negative-zero paths and selected plans must remain empty on the seven trajectories before VALV. VALV service own envelopes and acquisitions are checked separately against the unchanged source component on the retained public trace; this baseline projection alone does not compare those identifiers. Typed Material remains empty outside LIFE on these eight trajectories. FramedTransfer state and passive acquisitions are retained separately and are not assumed to be empty or equal to an absent baseline layer. LIFE compares all three reconstructed own material layers, complete provider envelopes and every acquired receipt with explicit signed-zero restoration and independently recomputed identity recipes; its exact limits are in typedMaterialComparison. Execution durations and final implementation labels are excluded. Recorded-public replay recomputes commands before supplying prior actual returns and is neither a new live success nor a speed measurement.',
};
await writeFile(outputPath, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ passed: result.passed, checks: checks.length, compared: result.compared, failed: checks.filter(check => !check.passed).map(check => check.name) }));
if (!result.passed) process.exitCode = 1;
