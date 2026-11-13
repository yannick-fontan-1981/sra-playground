/** Read-only comparison of the native projection with the retained Python oracle.
 * Usage, repository root: node docs/migration/lot3c-evidence/diagnostic/check-projection-parity.mjs [new-receipt.json]
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import * as native from '../../../../src/logos-engine/v6-exposed-reception-observation.ts';

const root = new URL('../../../../', import.meta.url);
const read = path => readFileSync(new URL(path, root));
const digest = data => createHash('sha256').update(data).digest('hex');
const fingerprint = path => { const bytes = read(path); return { path, bytes: bytes.length, sha256: digest(bytes) }; };
const fixturePath = 'tests/fixtures/v6-exposed-reception-parity.json.gz';
const fixture = JSON.parse(gunzipSync(read(fixturePath)));
assert.equal(fixture.pinnedSourceFilesVerifiedBeforeImport, 1786);
assert.equal(fixture.pinnedSourceFilesVerifiedAfterRun, 1786);
assert.equal(fixture.sourceCommit, '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e');
assert.equal(digest(read(fixture.generator)), fixture.generatorSha256);
const corpus = JSON.parse(gunzipSync(read(fixture.initialPublicCorpus.path)));
assert.equal(digest(read(fixture.initialPublicCorpus.path)), fixture.initialPublicCorpus.sha256);
const inputPaths = [fixturePath, fixture.initialPublicCorpus.path, fixture.generator,
  'src/logos-engine/v6-exposed-reception-observation.ts', 'src/logos-engine/v6-native-observer.ts',
  'src/logos-engine/v6-hash.ts', 'src/logos-engine/v6-program-identity.ts', 'src/logos-engine/canonical.ts',
  'tests/v6-exposed-reception-observation.test.ts', 'tests/helpers/v6-exposed-reception-raster.ts',
  'docs/migration/lot3c-evidence/diagnostic/check-projection-parity.mjs'];
const inputs = inputPaths.map(fingerprint);
let initialChecks = 0, sceneChecks = 0, inputChecks = 0, identityChecks = 0;
const matchedCases = [];
for (const item of fixture.initialMeasurements) {
  const view = corpus.games.find(value => value.game === item.game);
  assert.equal(view.observation.frame_hash, item.frameHash);
  for (const [key, fn] of [['scene', native.measureExposedReception], ['largeScene', native.measureLargeExposedReception], ['smallScene', native.measureSmallExposedReception]]) {
    assert.deepEqual(fn(view.packet.frame_rows), item[key], `${item.game}:${key}`); initialChecks++;
  }
}
for (const item of fixture.cases) {
  const fn = { scene: native.measureExposedReception, large_scene: native.measureLargeExposedReception, small_scene: native.measureSmallExposedReception }[item.operation];
  if (fn) { assert.deepEqual(fn(item.arguments.rows), item.expected, item.id); sceneChecks++; matchedCases.push(item.id); }
  if (item.operation === 'input_candidates') {
    const args = item.arguments;
    assert.deepEqual(native.exposedReceptionInputCandidates(args.rows, args.available, args.inherited), item.expected, item.id);
    inputChecks++; matchedCases.push(item.id);
  }
  if (item.operation === 'propose' && item.expected?.status === 'proposed' && item.expected.exposed_reception_plan) {
    assert.equal('exposed-reception:' + native.exposedReceptionPlanIdentity(item.expected.exposed_reception_plan), item.expected.proposal_id, item.id);
    identityChecks++; matchedCases.push(item.id + ':plan-identity');
  }
}
assert.deepEqual(inputPaths.map(fingerprint), inputs, 'all recorded inputs remain unchanged during comparison');
const receipt = { schema: 'logos-engine.v6.exposed-reception-projection-parity.v1', recordedAt: new Date().toISOString(), status: 'passed',
  sourceCommit: fixture.sourceCommit, inputs, inputsUnchanged: true,
  counts: { originalPublicRasters: fixture.initialMeasurements.length, initialChecks, sceneChecks, inputChecks, identityChecks,
    total: initialChecks + sceneChecks + inputChecks + identityChecks }, matchedCases,
  qualification: 'Development projection, candidate and schema-specific identity comparison only, using the retained unmodified-Python oracle. No game, action, source modification, official cost measurement or claim of complete inheritance parity.' };
if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ status: receipt.status, counts: receipt.counts, receipt: process.argv[2] ?? null,
  script: fileURLToPath(import.meta.url) }));
