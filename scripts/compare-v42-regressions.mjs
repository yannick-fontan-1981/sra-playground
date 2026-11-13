/** Verify prior public behavior while connecting rooted quotas and explicit conditional program relations. */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const [beforePath, afterPath, outputPath] = process.argv.slice(2);
if (!beforePath || !afterPath || !outputPath) throw new Error('Usage: compare-v42-regressions.mjs before.json after.json output.json');
const beforeBytes = await readFile(beforePath), afterBytes = await readFile(afterPath);
const before = JSON.parse(beforeBytes), after = JSON.parse(afterBytes);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const checks = [];
const omit = (value, names) => Object.fromEntries(Object.entries(value).filter(([key]) => !names.includes(key)));
function normalizeScope(value) {
  if (typeof value === 'string') return value.replace(/^sra-v6-[^:]+(?=:epoch:)/, 'campaign-scope');
  if (Array.isArray(value)) return value.map(normalizeScope);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalizeScope(item)]));
  return value;
}
const projection = prefix => normalizeScope({ ...omit(prefix.sharedSeries, ['digest', 'digestScope', 'rootedQuotaStateCount', 'rootedQuotaLatestState', 'nativeProgramRelations']),
  programModels: prefix.sharedSeries.programModels.map(model => omit(model, ['modelId'])) });
const coordination = prefix => (prefix.nativeCoordination ?? []).map(receipt => ({
  rule: receipt.rule,
  observation: normalizeScope(receipt.observation_ref), guardReason: receipt.guard_reason, scope: receipt.scope }));
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
  before.prefixes.map(prefix => omit(prefix, ['graphChain', 'graphRevision', 'sharedSeries', 'nativeCoordination', 'currentProgramAccess'])),
  after.prefixes.map(prefix => omit(prefix, ['graphChain', 'graphRevision', 'sharedSeries', 'nativeCoordination', 'currentProgramAccess'])));
same('same previously reported series projection with observation-scope normalization',
  before.prefixes.map(projection), after.prefixes.map(projection));
same('same acquired-preparation deferrals and guards',
  before.prefixes.map(coordination), after.prefixes.map(coordination));
same('partial current-control access is not required in these previous successful prefixes',
  after.prefixes.map(prefix => prefix.currentProgramAccess ?? null), after.prefixes.map(() => null));
same('new quota and relation evidence remains empty in prior successful prefixes',
  after.prefixes.map(prefix => [prefix.sharedSeries.rootedQuotaStateCount, prefix.sharedSeries.rootedQuotaLatestState,
    prefix.sharedSeries.nativeProgramRelations]),
  after.prefixes.map(() => [0, null, { modelCount: 0, trialCount: 0, refutationCount: 0,
    latestModel: null, latestTrial: null, latestRefutation: null }]));
same('same request outcomes and common caller revisions',
  before.requests.map(request => omit(request, ['activeSeconds', 'elapsedMs'])),
  after.requests.map(request => omit(request, ['activeSeconds', 'elapsedMs'])));
same('same final public result and retained-session counters',
  omit(before.final, ['activeSeconds', 'nativeImplementation']), omit(after.final, ['activeSeconds', 'nativeImplementation']));
same('source frozen during both campaigns and no Python agent modules',
  [before.sourceUnchangedDuringRun, after.sourceUnchangedDuringRun, before.pythonAgentModules, after.pythonAgentModules], [true, true, [], []]);
same('same retained mechanical-domain assessments', before.domainAssessments, after.domainAssessments);
const result = {
  schema: 'logos-engine.v42.public-regression-comparison.v1', passed: checks.every(check => check.passed), checks,
  before: { path: beforePath, sha256: sha(beforeBytes), implementation: before.final.nativeImplementation, sourceDigest: before.source.digest,
    sharedDigestScope: before.prefixes[0]?.sharedSeries.digestScope },
  after: { path: afterPath, sha256: sha(afterBytes), implementation: after.final.nativeImplementation, sourceDigest: after.source.digest,
    sharedDigestScope: after.prefixes[0]?.sharedSeries.digestScope },
  compared: { commands: before.actions.length, completePublicPackets: before.actions.length + 1, prefixes: before.prefixes.length },
  qualification: 'Compares commands, complete public packet hashes, source prefix kinds, acquisition counters and reported series projections. Observation session scope is normalized. Session-derived hashed program model IDs are excluded while their acquisition epochs, normalized evidence and observed/inferred operator counts remain compared. Native graph chains/revisions and shared inherited digests are excluded. Prior acquired-preparation deferrals and guards are compared. New quota/relation projections must remain empty on these prior successful prefixes; prior radial/control-discovery and other series evidence remain compared. No partial-access extension is required in these prefixes. Timings are excluded; this is not a speed comparison or full internal-state parity.',
};
await writeFile(outputPath, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ passed: result.passed, checks: checks.length, compared: result.compared,
  failed: checks.filter(check => !check.passed).map(check => check.name) }));
if (!result.passed) process.exitCode = 1;
