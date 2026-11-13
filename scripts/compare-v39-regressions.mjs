/** Verify retained public behavior while adding the observed-program closure. */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const [beforePath, afterPath, outputPath] = process.argv.slice(2);
if (!beforePath || !afterPath || !outputPath) throw new Error('Usage: compare-v39-regressions.mjs before.json after.json output.json');
const beforeBytes = await readFile(beforePath), afterBytes = await readFile(afterPath);
const before = JSON.parse(beforeBytes), after = JSON.parse(afterBytes);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const checks = [];
const omit = (value, names) => Object.fromEntries(Object.entries(value).filter(([key]) => !names.includes(key)));
const programFields = ['markedCollectionResultCount', 'programEditSampleCount', 'programPhaseAlignmentCount', 'programModels',
  'programReconciliationCount', 'programRefutedEpochs', 'respondentProbeCount', 'respondentModelCount',
  'programExtensionRefusalCount', 'programInputSupportCount'];
function normalizeScope(value) {
  if (typeof value === 'string') return value.replace(/^sra-v6-[^:]+(?=:epoch:)/, 'campaign-scope');
  if (Array.isArray(value)) return value.map(normalizeScope);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalizeScope(item)]));
  return value;
}
const projection = prefix => normalizeScope(omit(prefix.sharedSeries, ['digest', 'digestScope', ...programFields]));
function same(name, left, right) {
  try { assert.deepEqual(left, right); checks.push({ name, passed: true }); }
  catch (error) { checks.push({ name, passed: false, difference: error.message }); }
}
same('same game and target, both campaigns passed', [before.game, before.targetLevels, before.status, after.status],
  [after.game, after.targetLevels, 'passed', 'passed']);
same('same production budgets and exact game assets', [before.budget, before.gameAssets], [after.budget, after.gameAssets]);
same('same complete initial public packet hash', before.initial, after.initial);
same('same physical commands, full animation packet hashes and primitive boundaries',
  before.actions.map(action => omit(action, ['executionMs'])), after.actions.map(action => omit(action, ['executionMs'])));
same('same selected source prefix kinds and acquired action counts',
  before.prefixes.map(prefix => omit(prefix, ['graphChain', 'graphRevision', 'sharedSeries'])),
  after.prefixes.map(prefix => omit(prefix, ['graphChain', 'graphRevision', 'sharedSeries'])));
same('same previously reported series projection with observation-scope normalization',
  before.prefixes.map(projection), after.prefixes.map(projection));
same('new program projections remain empty in these regression games',
  after.prefixes.map(prefix => programFields.map(key => prefix.sharedSeries[key])),
  after.prefixes.map(() => [0, 0, 0, [], 0, [], 0, 0, 0, 0]));
same('same request outcomes and common caller revisions',
  before.requests.map(request => omit(request, ['activeSeconds', 'elapsedMs'])),
  after.requests.map(request => omit(request, ['activeSeconds', 'elapsedMs'])));
same('same final public result and retained-session counters',
  omit(before.final, ['activeSeconds', 'nativeImplementation']), omit(after.final, ['activeSeconds', 'nativeImplementation']));
same('source frozen during both campaigns and no Python agent modules',
  [before.sourceUnchangedDuringRun, after.sourceUnchangedDuringRun, before.pythonAgentModules, after.pythonAgentModules], [true, true, [], []]);
same('same retained mechanical-domain assessments', before.domainAssessments, after.domainAssessments);
const result = {
  schema: 'logos-engine.v39.public-regression-comparison.v1', passed: checks.every(check => check.passed), checks,
  before: { path: beforePath, sha256: sha(beforeBytes), implementation: before.final.nativeImplementation, sourceDigest: before.source.digest,
    sharedDigestScope: before.prefixes[0]?.sharedSeries.digestScope },
  after: { path: afterPath, sha256: sha(afterBytes), implementation: after.final.nativeImplementation, sourceDigest: after.source.digest,
    sharedDigestScope: after.prefixes[0]?.sharedSeries.digestScope },
  compared: { commands: before.actions.length, completePublicPackets: before.actions.length + 1, prefixes: before.prefixes.length },
  qualification: 'Compares public behavior, source prefix descriptions, acquisition counters and all previously reported series projections, including cell models. Only observation session scope is normalized within those projections. Native graph chains/revisions and the expanded shared inherited digest/scope are not compared. The newly reported program projections must independently remain empty for these regression games. Timings are excluded; this is not a speed comparison or full internal-state parity.',
};
await writeFile(outputPath, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ passed: result.passed, checks: checks.length, compared: result.compared,
  failed: checks.filter(check => !check.passed).map(check => check.name) }));
if (!result.passed) process.exitCode = 1;
