#!/usr/bin/env node
/** Preserve strict differences, then qualify only observed, verified clock/provenance leaves. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync, gzipSync } from 'node:zlib';
import { isDeepStrictEqual } from 'node:util';
import { canonical, compareUnicode } from '../src/logos-engine/canonical.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = resolve(ROOT, process.argv[2] ?? 'docs/migration/lot2c-cost-evidence/diagnostic');
assert.ok(relative(ROOT, DIR) && !relative(ROOT, DIR).startsWith('..'));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const escape = value => value.replaceAll('~', '~0').replaceAll('/', '~1');
const unescape = value => value.replaceAll('~1', '/').replaceAll('~0', '~');
async function fp(path) { const bytes = await readFile(path); return { path: relative(ROOT, path), bytes: bytes.length, sha256: sha(bytes) }; }
async function read(name) { const bytes = await readFile(resolve(DIR, name)); return JSON.parse(name.endsWith('.gz') ? gunzipSync(bytes) : bytes); }
async function write(name, value) {
  const raw = Buffer.from(JSON.stringify(value, null, 2) + '\n');
  const bytes = name.endsWith('.gz') ? gzipSync(raw, { level: 9 }) : raw;
  if (name.endsWith('.gz')) assert.deepEqual(gunzipSync(bytes), raw);
  await writeFile(resolve(DIR, name), bytes, { flag: 'wx' });
  return fp(resolve(DIR, name));
}
function differences(a, b, path = '') {
  if (Object.is(a, b)) return [];
  const rows = [];
  if (a && b && typeof a === 'object' && typeof b === 'object' && Array.isArray(a) === Array.isArray(b)) {
    if (Array.isArray(a) && a.length !== b.length) rows.push({ path: `${path}/length`, before: a.length, after: b.length });
    for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
      const next = `${path}/${escape(key)}`;
      if (!Object.hasOwn(a, key) || !Object.hasOwn(b, key)) rows.push({ path: next, beforePresent: Object.hasOwn(a, key), afterPresent: Object.hasOwn(b, key), before: a[key] ?? null, after: b[key] ?? null });
      else rows.push(...differences(a[key], b[key], next));
    }
    return rows;
  }
  return [{ path, before: a, after: b }];
}
function stats(rows) {
  const sorted = rows.toSorted((a, b) => a - b), n = sorted.length;
  return { count: n, totalMs: rows.reduce((sum, n) => sum + n, 0),
    medianMs: n ? n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : null };
}
const generator = await fp(fileURLToPath(import.meta.url));
const before = await read('baseline.json.gz'), after = await read('after.json.gz');
assert.deepEqual(before.generator, after.generator); assert.deepEqual(before.inputs, after.inputs);
const profileDiffs = differences(before.final, after.final, '/final');
const initiallyQualified = new Set(['/final/snapshot/implementation', '/final/snapshot/activeSeconds']);
const profileUnknown = profileDiffs.filter(row => !initiallyQualified.has(row.path));
const changedValueNodes = Object.keys(before.final.knowledge.nodes).filter(id => !isDeepStrictEqual(before.final.knowledge.nodes[id], after.final.knowledge.nodes[id]));
const timings = Object.fromEntries([...new Set([...Object.keys(before.stages), ...Object.keys(after.stages)])].map(stage => [stage, {
  before: before.stages[stage] ?? null, after: after.stages[stage] ?? null,
}]));
const continuations = [before, after].map(profile => profile.requests.filter(row => row.operation === 'advance' && row.resultKind === 'action').map(request => ({
  sequence: request.sequence, serviceMs: request.serviceMs,
  stages: profile.samples.filter(sample => sample.operation === 'advance' && sample.sequence === request.sequence),
})));
const profileReceipt = await write('comparison.json', {
  schema: 'logos-engine.native-loop-profile-comparison.v1', status: profileUnknown.length ? 'strict_identity_failed' : 'strict_identity_passed',
  recordedAt: new Date().toISOString(), generator,
  inputs: { before: await fp(resolve(DIR, 'baseline.json.gz')), after: await fp(resolve(DIR, 'after.json.gz')) },
  nativeDigests: { before: before.nativeSource.digest, after: after.nativeSource.digest },
  initiallyQualifiedSnapshotFields: [...initiallyQualified], allFinalDifferences: profileDiffs,
  differencesOutsideInitialQualification: profileUnknown,
  commandsExactlyEqual: isDeepStrictEqual(before.commands, after.commands),
  capturedOwnerStatesExactlyEqual: isDeepStrictEqual(before.final.ownerStates, after.final.ownerStates),
  nodeValueFingerprints: { compared: Object.keys(before.final.knowledge.nodes).length,
    equal: Object.keys(before.final.knowledge.nodes).length - changedValueNodes.length, changed: changedValueNodes },
  timings, continuations: { before: continuations[0], after: continuations[1] },
  qualification: 'The original profiles lack full reasoning-trace values. Their strict identity failure and all unequal fingerprints remain unchanged; the separate semantic replay does not retroactively prove unavailable profile leaves. Timings are instrumented single-session diagnostics, nested and nonadditive, with a brief baseline/typecheck overlap documented separately. No budget acceptance is inferred.',
});

const a = await read('semantic-baseline.json.gz'), b = await read('semantic-after.json.gz');
assert.deepEqual(a.generator, b.generator); assert.deepEqual(a.inputs, b.inputs);
assert.equal(a.nativeSource.digest, before.nativeSource.digest); assert.equal(b.nativeSource.digest, after.nativeSource.digest);
assert.equal(a.nativeSource.files['src/logos-engine/canonical.ts'], b.nativeSource.files['src/logos-engine/canonical.ts']);
assert.equal(sha(await readFile(resolve(ROOT, 'src/logos-engine/canonical.ts'))), b.nativeSource.files['src/logos-engine/canonical.ts']);
const programBundle = JSON.parse(await readFile(resolve(ROOT, 'src/logos-engine/v6/programs.json')));
assert.equal(sha(await readFile(resolve(ROOT, 'src/logos-engine/v6/programs.json'))), a.nativeSource.files['src/logos-engine/v6/programs.json']);
const selectionHash = Object.values(programBundle.programs).find(program => program.entry === 'v6.composition_strategy.choose').transitiveSourceHash;
const reference = 'reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6';
const declarations = { common: JSON.parse(await readFile(resolve(ROOT, `${reference}/laya_proto/common_frontier_policy.drm.json`))),
  strategy: JSON.parse(await readFile(resolve(ROOT, `${reference}/morphology_policy/strategy.drm`))) };
const manifests = [a, b].map(capture => {
  const s = capture.final.snapshot;
  return { sourceEncoding: 'json-stringify-v1', implementation: s.implementation, referenceCommit: s.sourceCommit,
    declarations, families: s.coverage.registeredFamilies, groups: s.coverage.sourceGroups,
    authority: 'native_original_why_act', caller: 'native_common_coordinator', selectionProgram: selectionHash,
    nativeCallerExtensions: s.coverage.nativeCallerExtensions, fullV6Parity: false };
});
const manifestDiffs = differences(manifests[0], manifests[1]);
assert.deepEqual(manifestDiffs.map(row => row.path), ['/implementation']);
const reconstructedSourceDigests = manifests.map(manifest => sha(JSON.stringify(manifest)));
assert.equal(reconstructedSourceDigests[0], a.final.snapshot.sourceDigest); assert.equal(reconstructedSourceDigests[1], b.final.snapshot.sourceDigest);

function verifyGraph(capture) {
  const { graph, snapshot } = capture.final, finalNodes = {}, chains = new Map();
  let previous = null;
  for (let index = 0; index < graph.deltas.length; index++) {
    const delta = graph.deltas[index], { digest, ...payload } = delta;
    assert.equal(delta.sequence, index + 1); assert.equal(delta.previous, previous);
    assert.equal(delta.source_digest, snapshot.sourceDigest);
    assert.equal(delta.node.origin.source_digest, snapshot.sourceDigest);
    assert.equal(sha(canonical(payload)), digest, `Kernel delta digest differs at ${index + 1}`);
    assert.equal(delta.node.revision, (finalNodes[delta.node.id]?.revision ?? 0) + 1);
    finalNodes[delta.node.id] = delta.node; chains.set(digest, index + 1); previous = digest;
  }
  assert.equal(graph.chain, previous); assert.equal(snapshot.graphChain, previous);
  assert.equal(snapshot.graphRevision, graph.deltas.length);
  assert.deepEqual(finalNodes, graph.nodes);
  const nodes = Object.values(graph.nodes).filter(node => node.kind === 'program' || node.kind === 'family_activation')
    .sort((left, right) => compareUnicode(left.id, right.id)).map(node => ({ id: node.id, value: node.value }));
  const executionDigest = sha(canonical({ profile: snapshot.knowledgeProfile, source_digest: snapshot.sourceDigest, nodes }));
  assert.equal(executionDigest, snapshot.nativeExecutionDigest);
  return { chains, executionDigest, nodeCount: Object.keys(graph.nodes).length, deltas: graph.deltas.length, programAndActivationNodes: nodes.length };
}
const va = verifyGraph(a), vb = verifyGraph(b);
const sa = a.final.snapshot, sb = b.final.snapshot;
const sourcePair = row => row.before === sa.sourceDigest && row.after === sb.sourceDigest;
const executionPair = row => row.before === va.executionDigest && row.after === vb.executionDigest;
const chainPair = row => typeof row.before === 'string' && typeof row.after === 'string'
  && va.chains.has(row.before) && va.chains.get(row.before) === vb.chains.get(row.after);
const finitePair = row => Number.isFinite(row.before) && Number.isFinite(row.after);
const traceDiffs = differences(a.final.decodedTraces, b.final.decodedTraces, '/decodedTraces');
const traceClockRows = [];
for (const row of traceDiffs) {
  const match = /^\/decodedTraces\/([^/]+)\/created$/.exec(row.path);
  if (!match || !finitePair(row)) continue;
  const id = unescape(match[1]);
  assert.ok(/^reasoning:trace:[0-9]+$/.test(id));
  assert.ok(row.before * 1000 >= Date.parse(a.startedAt) && row.before * 1000 <= Date.parse(a.finishedAt));
  assert.ok(row.after * 1000 >= Date.parse(b.startedAt) && row.after * 1000 <= Date.parse(b.finishedAt));
  const encodedBefore = a.final.graph.nodes[id].value.root.members.created;
  const encodedAfter = b.final.graph.nodes[id].value.root.members.created;
  assert.equal(encodedBefore.kind, 'float64'); assert.equal(encodedAfter.kind, 'float64');
  assert.equal(Buffer.from(encodedBefore.bits, 'hex').readDoubleBE(), row.before);
  assert.equal(Buffer.from(encodedAfter.bits, 'hex').readDoubleBE(), row.after);
  traceClockRows.push({ ...row, nodeId: id, encodedBefore: encodedBefore.bits, encodedAfter: encodedAfter.bits });
}
const traceClockById = new Map(traceClockRows.map(row => [row.nodeId, row]));
function isTraceBits(row, id) {
  const actual = traceClockById.get(id);
  return actual && row.before === actual.encodedBefore && row.after === actual.encodedAfter;
}
function qualifyGraph(row) {
  let match;
  if (row.path === '/graph/chain' && chainPair(row)) return 'verified_kernel_chain';
  if (/^\/graph\/nodes\/[^/]+\/origin\/source_digest$/.test(row.path) && sourcePair(row)) return 'reconstructed_version_source_digest';
  if (/^\/graph\/deltas\/[0-9]+\/(source_digest|node\/origin\/source_digest)$/.test(row.path) && sourcePair(row)) return 'reconstructed_version_source_digest';
  if (/^\/graph\/deltas\/[0-9]+\/(previous|digest)$/.test(row.path) && chainPair(row)) return 'verified_kernel_chain';
  match = /^\/graph\/nodes\/([^/]+)\/value\/root\/members\/created\/bits$/.exec(row.path);
  if (match && isTraceBits(row, unescape(match[1]))) return 'observed_trace_created_float64';
  match = /^\/graph\/deltas\/([0-9]+)\/node\/value\/root\/members\/created\/bits$/.exec(row.path);
  if (match) {
    const left = a.final.graph.deltas[Number(match[1])], right = b.final.graph.deltas[Number(match[1])];
    if (left.node.id === right.node.id && isTraceBits(row, left.node.id)) return 'observed_trace_created_float64';
  }
  return null;
}
function qualifySnapshot(row) {
  if (row.path === '/snapshot/implementation' && row.before === manifests[0].implementation && row.after === manifests[1].implementation) return 'declared_native_version';
  if (['/snapshot/activeSeconds', '/snapshot/whyAct/decision/total_ms'].includes(row.path) && finitePair(row)) return 'observed_runtime_clock_measurement';
  if (row.path === '/snapshot/sourceDigest' && sourcePair(row)) return 'reconstructed_version_source_digest';
  if (row.path === '/snapshot/nativeExecutionDigest' && executionPair(row)) return 'recomputed_execution_identity';
  if ((row.path === '/snapshot/graphChain' || /^\/snapshot\/trace\/[0-9]+\/graph_chain$/.test(row.path)) && chainPair(row)) return 'verified_kernel_chain';
  return null;
}
const graphDiffs = differences(a.final.graph, b.final.graph, '/graph');
const snapshotDiffs = differences(sa, sb, '/snapshot');
const requestDiffs = differences(a.requests, b.requests, '/requests');
const commandDiffs = differences(a.commands, b.commands, '/commands');
const ownerDiffs = differences(a.final.ownerStates, b.final.ownerStates, '/ownerStates');
const qualified = [
  ...graphDiffs.map(row => ({ ...row, qualification: qualifyGraph(row) })),
  ...snapshotDiffs.map(row => ({ ...row, qualification: qualifySnapshot(row) })),
  ...requestDiffs.map(row => ({ ...row, qualification: /^\/requests\/[0-9]+\/graphChain$/.test(row.path) && chainPair(row)
    ? 'verified_kernel_chain' : /^\/requests\/[0-9]+\/nativeExecutionDigest$/.test(row.path) && executionPair(row) ? 'recomputed_execution_identity' : null })),
  ...traceDiffs.map(row => ({ ...row, qualification: traceClockRows.some(clock => clock.path === row.path) ? 'observed_trace_created' : null })),
  ...commandDiffs.map(row => ({ ...row, qualification: null })), ...ownerDiffs.map(row => ({ ...row, qualification: null })),
];
const unqualified = qualified.filter(row => row.qualification === null);
const strictSemanticReceipt = await write('semantic-comparison.json.gz', {
  schema: 'logos-engine.native-loop-semantic-strict-comparison.v1', status: qualified.length ? 'strict_identity_failed' : 'strict_identity_passed',
  recordedAt: new Date().toISOString(), generator,
  inputs: { before: await fp(resolve(DIR, 'semantic-baseline.json.gz')), after: await fp(resolve(DIR, 'semantic-after.json.gz')) },
  nativeDigests: { before: a.nativeSource.digest, after: b.nativeSource.digest },
  graphDifferences: graphDiffs, snapshotDifferences: snapshotDiffs, requestDifferences: requestDiffs,
  decodedTraceDifferences: traceDiffs, commandDifferences: commandDiffs, ownerStateDifferences: ownerDiffs,
  differenceCount: qualified.length,
  qualification: 'Complete actual semantic captures compared leaf by leaf with no normalization or numeric tolerance. Every difference remains in this receipt, including graph chains, version provenance and clocks. Separate verified qualification does not establish binary identity.',
});
const kinds = {};
for (const row of qualified) kinds[row.qualification ?? 'unqualified'] = (kinds[row.qualification ?? 'unqualified'] ?? 0) + 1;
const qualificationReceipt = await write('semantic-qualification.json', {
  schema: 'logos-engine.native-loop-semantic-qualification.v1', status: unqualified.length ? 'business_difference_blocks' : 'qualified_semantic_equivalence',
  recordedAt: new Date().toISOString(), generator, strictComparison: strictSemanticReceipt, originalProfileStrictComparison: profileReceipt,
  sourceDigestReconstruction: { before: reconstructedSourceDigests[0], after: reconstructedSourceDigests[1],
    exact: true, manifestDifferences: manifestDiffs, encoding: 'SHA-256 of JSON.stringify manifest, in the original property order',
    manifestKeys: Object.keys(manifests[0]), selectionTransitiveSourceHash: selectionHash,
    sourceContract: 'src/logos-engine/v6-native-runtime.ts:createNativeV6Runtime implementation manifest' },
  kernelAndExecutionIdentityChecks: [va, vb].map((row, index) => ({ nativeDigest: [a, b][index].nativeSource.digest,
    nodeCount: row.nodeCount, deltas: row.deltas, everyDeltaRehashedExactly: true, everyPreviousLinkVerified: true,
    everyNodeRevisionVerified: true, finalNodesRebuiltExactlyFromDeltas: true, executionDigestRecomputedExactly: true,
    programAndActivationNodes: row.programAndActivationNodes, finalChain: [a, b][index].final.graph.chain,
    executionDigest: row.executionDigest })),
  exactChecks: { commands: commandDiffs.length === 0, ownerStates: ownerDiffs.length === 0,
    allGraphNodeKeys: isDeepStrictEqual(Object.keys(a.final.graph.nodes).sort(), Object.keys(b.final.graph.nodes).sort()),
    allNodeTypesAndRevisions: Object.keys(a.final.graph.nodes).every(id => a.final.graph.nodes[id].kind === b.final.graph.nodes[id]?.kind && a.final.graph.nodes[id].revision === b.final.graph.nodes[id]?.revision),
    allTraceBusinessBodies: Object.keys(a.final.decodedTraces).every(id => isDeepStrictEqual(a.final.decodedTraces[id].body, b.final.decodedTraces[id]?.body)) },
  observedTraceClockDifferences: traceClockRows,
  snapshotQualifications: qualified.filter(row => row.path.startsWith('/snapshot/')),
  requestQualifications: qualified.filter(row => row.path.startsWith('/requests/')),
  differenceCounts: kinds, businessDifferenceCount: unqualified.length, unqualifiedDifferences: unqualified,
  clockContracts: [
    { path: 'src/logos-engine/v6-reasoning-memory.ts', field: 'reasoning trace.created', behavior: 'NativeReasoningMemory.trace stores created: this.clock(); default clock is Date.now() / 1000.' },
    { path: 'src/logos-engine/v6-composition-engine.ts', field: 'snapshot.whyAct.decision.total_ms', behavior: 'Composition execution records this.clock() - started after persisting its decision report.' },
    { path: 'src/logos-engine/v6-native-runtime.ts', field: 'snapshot.activeSeconds', behavior: 'Elapsed and currently running native time, divided by 1000.' },
  ],
  qualification: 'Bounded semantic equivalence for this STCK10 control only. The actual 24 decoded trace differences are exclusively created timestamps, with exact IEEE754 bits checked. Every graph-chain delta and execution identity is recomputed from the captured values. Version sourceDigest reconstructs exactly and only the declared implementation differs in that manifest. All remaining leaf differences would block; none are silently removed. The first profiles still lack full trace payloads and retain their strict failure. No complete V6 parity, full-game result or cost-budget acceptance is claimed.',
});

const svcBefore = stats(continuations[0].map(row => row.serviceMs)), svcAfter = stats(continuations[1].map(row => row.serviceMs));
const fmt = value => value.toFixed(3).replace('.', ',');
const lines = [
  '# Lot 2C : diagnostic de coût et contrôle sémantique', '',
  '## Profils originaux conservés', '',
  'Les deux profils instrumentés utilisent une session froide STCK de dix actions, via le service direct. Le script et le protocole sont identiques ; leurs sources natives respectives restent gelées. La référence a brièvement chevauché le typecheck jusqu’à environ 21:07:49 UTC, comme le consigne `baseline-environment-qualification.json`. Aucun profil n’a été relancé pour sélectionner un meilleur temps.', '',
  `La [comparaison stricte](comparison.json) conserve **${profileDiffs.length} différences finales**, dont **${profileUnknown.length} hors des deux qualifications initiales implementation/activeSeconds**. Les dix commandes et les quatre états de propriétaires sont identiques. Sur 344 nœuds, 320 empreintes de valeurs concordent et 24 empreintes de traces diffèrent. Leurs corps manquent dans ces profils : cette limite n’est pas transformée rétroactivement en preuve d’identité.`, '',
  '## Travail localisé, sans validation de budget', '',
  '| Méthode | Appels avant / après | Total diagnostic avant | Total diagnostic après |',
  '| --- | ---: | ---: | ---: |',
  ...['runtime.snapshot', 'runtime.authorizationIdentity', 'runtime.persistFamilies', 'runtime.restoreFamilies', 'knowledge.commit', 'knowledge.stateValue', 'caller.checkpointWrites'].map(stage => {
    const left = before.stages[stage], right = after.stages[stage];
    return `| ${stage} | ${left?.count ?? 0} / ${right?.count ?? 0} | ${fmt(left?.totalMs ?? 0)} ms | ${fmt(right?.totalMs ?? 0)} ms |`;
  }), '',
  `Sur les quatre continuations, la médiane du service direct passe de **${fmt(svcBefore.medianMs)} à ${fmt(svcAfter.medianMs)} ms** dans ces diagnostics. La lecture d’identité évite dix snapshots complets. Les snapshots seuls représentaient moins d’une milliseconde par lecture ; le diagnostic distinct de l’observateur a donc guidé une correction supplémentaire des signatures géométriques.`, '',
  '**Ces durées sont imbriquées et non additives.** Une seule session, les wrappers et le service direct ne remplacent pas le protocole officiel, ses répétitions, le contrôleur, le transport et le budget de +10 %. Les valeurs brutes et le chevauchement initial restent disponibles.', '',
  '## Contrôle sémantique distinct', '',
  'Une collecte supplémentaire déclarée dans [semantic-control-protocol.md](semantic-control-protocol.md) a exécuté une fois V63 puis une fois 0.36, sans instrumentation de performance. Elle conserve les graphes, les valeurs de nœuds, les deltas et les 24 traces décodées intégralement. Elle corrige une lacune de collecte concrète ; elle ne remplace aucun résultat de coût.', '',
  `La [comparaison intégrale](semantic-comparison.json.gz) conserve **${qualified.length} différences de feuilles**. La [qualification séparée](semantic-qualification.json) établit :`, '',
  '- Dix commandes et quatre états de propriétaires identiques ; 344 nœuds, leurs types et révisions identiques, 842 deltas dans chaque graphe.',
  '- Les 24 traces décodées diffèrent uniquement sur leur feuille `created`. Leurs corps métier restent identiques ; leurs bits Float64 encodés correspondent exactement aux horloges observées.',
  '- Le `sourceDigest` de chaque version est reconstruit exactement depuis le manifeste. Seule la version d’implémentation change dans ce manifeste.',
  '- Chaque digest de delta, son lien précédent et les nœuds finaux reconstruits sont vérifiés. L’identité d’exécution est également recalculée avec la provenance de sa version.',
  `- **${unqualified.length} différence métier non qualifiée.** Les différences de chaîne, provenance, horloges et temps du snapshot sont conservées avec leurs chemins et valeurs ; aucune identité binaire des graphes n’est revendiquée.`, '',
  'La portée reste ce replay public de dix actions. Ce contrôle ne démontre ni la migration complète V5/V6 ni un budget de performance respecté. La clôture du coût dépend des mesures officielles séparées.', '',
];
await writeFile(resolve(DIR, 'results.md'), lines.join('\n'), { flag: 'wx' });
console.log(JSON.stringify({ originalProfileStrictStatus: profileUnknown.length ? 'strict_identity_failed' : 'strict_identity_passed',
  semanticStatus: unqualified.length ? 'business_difference_blocks' : 'qualified_semantic_equivalence',
  profileDifferences: profileDiffs.length, semanticDifferences: qualified.length, traceClockDifferences: traceClockRows.length,
  businessDifferences: unqualified.length, receipts: [profileReceipt, strictSemanticReceipt, qualificationReceipt] }));
if (unqualified.length) process.exitCode = 1;
