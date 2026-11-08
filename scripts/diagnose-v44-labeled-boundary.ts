/** Diagnose one saved public boundary. No game host, new action or grammar edit. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { measureLabeledSequence } from '../src/logos-engine/v6-labeled-sequence-observation.ts';
import { inferLabeledSequence } from '../src/logos-engine/v6-labeled-sequence-mechanics.ts';
import { LabeledSequenceMemory } from '../src/logos-engine/v6-labeled-sequence-access.ts';
import { symbolicDigest as identity } from '../src/logos-engine/v6-hash.ts';

type R = Record<string, any>;
const base = new URL('../', import.meta.url), root = fileURLToPath(base);
const fixturePath = 'tests/fixtures/v6-labeled-sequence-original-public.json.gz';
const outputPath = 'docs/migration/native-campaigns-v44/catl-next-level-diagnosis.json';
const scriptPath = 'scripts/diagnose-v44-labeled-boundary.ts';
const hash = (value: Uint8Array | string): string => createHash('sha256').update(value).digest('hex');
const read = (path: string) => readFile(new URL(path, base));
async function nativeManifest(): Promise<R> {
  const files: Record<string, string> = {};
  async function walk(path: string): Promise<void> {
    for (const entry of await readdir(new URL(path, base), { withFileTypes: true })) {
      const name = `${path}/${entry.name}`;
      if (entry.isDirectory()) await walk(name);
      else if (/\.(?:ts|json|drm)$/.test(entry.name)) files[name] = hash(await read(name));
    }
  }
  await walk('src/logos-engine'); await walk('src/runtime');
  const ordered = Object.fromEntries(Object.entries(files).sort(([a], [b]) => a.localeCompare(b, 'en')));
  return { digest: hash(JSON.stringify(ordered)), fileCount: Object.keys(ordered).length, files: ordered };
}

const nativeBefore = await nativeManifest(), fixtureBytes = await read(fixturePath);
const fixture: R = JSON.parse(gunzipSync(fixtureBytes).toString());
assert.equal(fixture.sourceModified, false); assert.equal(fixture.actions, 40);
assert.equal(fixture.levelsCompleted, 5); assert.equal(fixture.reason, 'labeled_component_abstained');
assert.equal(fixture.packets.length, 41);
const last = fixture.packets.at(-1), packet = last.packet, observation = last.observation;
assert.equal(packet.level, 6); assert.equal(packet.levels_completed, 5); assert.equal(packet.state, 'NOT_FINISHED');
assert.equal(observation.level_epoch, 6); assert.equal(observation.frame_hash, packet.frame_hash);
const events: R[] = fixture.finalState.projection.labeled_events, cache = fixture.finalState.projection.labeled_cache;
assert.equal(events.length, fixture.actions); assert.deepEqual(cache, events.at(-1)!.cache);
const memory = new LabeledSequenceMemory(); for (const event of events) memory.applyEvent(event);
assert.deepEqual(memory.currentState().labeled_cache, cache);
const priorControls = cache && cache.epoch === observation.level_epoch ? cache.controls : null;
const scene = measureLabeledSequence(packet.frame_rows, priorControls);
const inference = scene ? inferLabeledSequence(scene, observation, 300000, fixture.policy.labeled_sequence_question, cache, () => 0) : null;
const proposal = memory.proposeLabeled(observation, packet.frame_rows, [], 16, fixture.policy, 300000, () => 0);

// These are the unchanged source component calls, with only the saved public
// rows, observation, declared policy and acquired own-layer journal as inputs.
const python = String.raw`
import copy,hashlib,json,sys,time
from pathlib import Path
sys.dont_write_bytecode=True
payload=json.load(sys.stdin)
root=Path(payload['root']);source=root/'reference/v6'/payload['commit']/'source'
sys.path[:0]=[str(source),str(source/'agents/yf_arc3_v6/laya_proto')]
from labeled_sequence_observation import measure
from labeled_sequence_methods import infer
from labeled_sequence_access import LabeledSequenceAccess
from rooted_quota_methods import plain
manifest_path=source.parent/'manifest.json'
manifest=json.loads(manifest_path.read_text())['files']
def hashes():
 out={}
 for module in list(sys.modules.values()):
  if not getattr(module,'__file__',None):continue
  path=Path(module.__file__).resolve()
  if path.is_relative_to(source) and path.is_file():
   key=str(path.relative_to(source));digest=hashlib.sha256(path.read_bytes()).hexdigest()
   assert manifest[key]['sha256']==digest,key
   out[key]=digest
 return dict(sorted(out.items()))
before=hashes();obs=payload['observation'];rows=payload['rows'];cache=payload['cache']
prior=cache['controls'] if cache and cache['epoch']==obs['level_epoch'] else None
scene=measure(rows,prior)
inference=infer(scene,obs,time.perf_counter()+300,payload['policy']['labeled_sequence_question'],cache) if scene is not None else None
memory=LabeledSequenceAccess()
for event in payload['events']:memory.apply_event(copy.deepcopy(event))
proposal=memory.propose([],obs,rows,[],16,{**payload['policy'],'level_deadline':time.perf_counter()+300})
after=hashes()
assert all(after.get(path)==value for path,value in before.items())
print(json.dumps({'scene':plain(scene),'inference':plain(inference),'proposal':plain(proposal),
 'sourceFileCount':len(after),'sourceHashesDigest':hashlib.sha256(json.dumps(after,sort_keys=True,separators=(',',':')).encode()).hexdigest(),
 'manifestSha256':hashlib.sha256(manifest_path.read_bytes()).hexdigest(),'sourceModified':False,'sourceUnchanged':True,
 'gameHostRun':False,'grammarChanged':False}))
`;
const original: R = JSON.parse(execFileSync(process.env.CODEX_PRIMARY_RUNTIME_PYTHON ?? 'python', ['-c', python], {
  cwd: root, input: JSON.stringify({ root, commit: fixture.sourceCommit, rows: packet.frame_rows, observation, cache, events, policy: fixture.policy }),
  encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
}));
for (const [key, actual] of Object.entries({ scene, inference, proposal })) assert.deepEqual(actual, original[key], key);
assert.ok(scene && inference);
assert.equal(priorControls, null); assert.equal(cache.epoch, 5); assert.equal(inference.training_reused, false);
const induction = inference.induction, values = induction.values, training = inference.training_cache.training_features;
assert.equal(training.status, 'COMPLETE'); assert.equal(inference.query_features.status, 'COMPLETE');
assert.equal(induction.status, 'COMPLETE'); assert.equal(induction.cause, 'MODEL_CONTRADICTION');
assert.equal(induction.domain_complete, true); assert.equal(inference.grammar.length, 80);
assert.equal(values.observation_compatible_version_space.length, 0);
assert.equal(values.elimination_certificates.length, 80); assert.equal(values.label_predictions.length, 0);
assert.equal(values.robust_answer_and_submission_agreement, false);
assert.deepEqual(proposal, { status: 'abstained', reason: 'labeled_predicate_domain_has_no_unique_current_answer' });
const actualReceipts = new Set(training.values.model_feature_rows.map((row: R) => observation.observation_ref + '/' + row.model_ref));
assert.equal(actualReceipts.size, 20);
for (const certificate of values.elimination_certificates as R[]) {
  assert.ok(certificate.actual_counterexample_receipt_refs.length > 0);
  assert.ok(certificate.actual_counterexample_receipt_refs.every((ref: string) => actualReceipts.has(ref)));
}
assert.deepEqual(await nativeManifest(), nativeBefore, 'Production source remains unchanged during diagnosis');
const diagnosis: R = {
  schema: 'logos-engine.labeled-sequence-saved-public-diagnosis.v1', status: 'passed',
  generator: scriptPath, generatorSha256: hash(await read(scriptPath)),
  scope: 'Read-only comparison of unchanged source/native components on the saved public packet after action 40. No game host, new action, full-caller replay, grammar extension or solved-level claim.',
  inputs: { fixture: { path: fixturePath, sha256: hash(fixtureBytes) }, packetIndex: fixture.packets.length - 1,
    packetSha256: hash(JSON.stringify(packet)), packetSymbolicDigest: identity(packet), observation,
    policyDigest: identity(fixture.policy), acquiredJournalDigest: identity(events), acquiredCacheDigest: identity(cache),
    acquiredEventCount: events.length, level: packet.level, levelsCompleted: packet.levels_completed, state: packet.state },
  nativeSource: nativeBefore, nativeSourceUnchangedDuringDiagnosis: true,
  pinnedOriginal: { commit: fixture.sourceCommit, verifiedFileCount: original.sourceFileCount,
    sourceHashesDigest: original.sourceHashesDigest, manifestPath: `reference/v6/${fixture.sourceCommit}/manifest.json`,
    manifestSha256: original.manifestSha256, sourceModified: false, sourceUnchanged: true, gameHostRun: false, grammarChanged: false },
  exactComponentParity: { completeScene: true, completeInferenceIncludingCache: true, completeAbstention: true },
  componentResultDigests: { completeScene: identity(scene), completeInferenceIncludingCache: identity(inference), completeAbstention: identity(proposal) },
  cacheBoundary: { acquiredEpoch: cache.epoch, currentEpoch: observation.level_epoch, priorControlsAdmitted: false,
    acquiredContextRef: cache.context_ref, measuredContextRef: scene.context_ref, trainingReused: false,
    trainingContextRecomputedFromCurrentPublicExamples: true, inheritedCachedLabelsNotSubmitted: true },
  diagnosis: { measurementSucceeded: true, featureCalculationComplete: true, inferenceReturned: true,
    mechanicalStatus: induction.status, cause: induction.cause, domainComplete: induction.domain_complete,
    examinedCount: induction.examined_count, declaredFeatureRefs: inference.training_cache.queries.map((query: R) => query.feature_ref),
    measuredExampleCount: actualReceipts.size, suppliedPredicateRootCount: inference.grammar.length,
    compatiblePredicateCount: 0, eliminationCertificateCount: values.elimination_certificates.length,
    everyRootHasActualMeasuredCounterexamples: true, predictionCount: 0, robustAgreement: false,
    interpretation: 'Every predicate in the declared atomic/complement grammar contradicts at least one currently measured labeled example. Computation and perception complete; there is no retained version-space disagreement to resolve and no time/node interruption. Contradiction is relative to the supplied grammar and measured geometry, not proof of an inconsistent world or of a missing unique universal rule.' },
  measuredScene: scene, unchangedInductionReceipt: induction, abstention: proposal,
  unchangedGrammar: { digest: identity(inference.grammar), nodeCount: inference.grammar.length,
    nodeKinds: [...new Set(inference.grammar.map((node: R) => node.kind))],
    suppliedComparators: fixture.policy.labeled_sequence_question.comparisons, configuredRootBound: fixture.policy.labeled_sequence_question.root_bound },
  nextGenericCapability: { kind: 'native_extension_to_be_designed', installed: false, newActionsExecuted: 0,
    proposal: 'A declared, bounded composition grammar over already measured features, using AND/OR supported by the existing predicate evaluator. Refit against all current labeled examples, retain every compatible alternative, and submit only with nonvacuous current-label/control agreement. Keep the faithful atomic/complement source path distinguishable, invalidate caches by grammar and evidence, bound depth/nodes/roots, and preserve abstention when no model fits or alternatives disagree.',
    qualification: 'No composite grammar is generated or evaluated here. This diagnostic does not establish that such an extension solves the sixth level, and it adds no source entry-point connection.' },
};
await mkdir(new URL('docs/migration/native-campaigns-v44/', base), { recursive: true });
await writeFile(new URL(outputPath, base), JSON.stringify(diagnosis, null, 2) + '\n');
console.log(JSON.stringify({ outputPath, passed: true, exactComponentParity: diagnosis.exactComponentParity,
  sourceDigest: nativeBefore.digest, sourceFiles: nativeBefore.fileCount, originalFiles: original.sourceFileCount,
  cause: induction.cause, measuredExamples: actualReceipts.size, predicateRoots: inference.grammar.length,
  compatiblePredicates: 0, oldCacheEpoch: cache.epoch, currentEpoch: observation.level_epoch, trainingReused: false }));
