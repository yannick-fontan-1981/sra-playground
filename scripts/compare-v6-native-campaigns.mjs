/** Compare two completed native public-game campaigns, outside the agent. */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const [beforePath, afterPath, output] = process.argv.slice(2);
if (!beforePath || !afterPath || !output) throw new Error('Usage: compare-v6-native-campaigns.mjs before.json after.json output.json');
const beforeBytes = await readFile(beforePath), afterBytes = await readFile(afterPath);
const before = JSON.parse(beforeBytes), after = JSON.parse(afterBytes);
const sha = value => createHash('sha256').update(value).digest('hex');
const checks = [];
function same(name, left, right) {
  try { assert.deepEqual(left, right); checks.push({ name, passed: true }); }
  catch (error) { checks.push({ name, passed: false, difference: error.message }); }
}
const without = (value, fields) => Object.fromEntries(Object.entries(value).filter(([key]) => !fields.includes(key)));
const scope = value => value.replace(/^sra-v6-[^:]+(?=:epoch:)/, 'campaign-scope');
const retainedProjection = prefix => ({ ...without(prefix.sharedSeries, ['digest']),
  epochAnchors: prefix.sharedSeries.epochAnchors.map(anchor => ({ ...anchor, observation_ref: scope(anchor.observation_ref) })) });
same('same completed game and target', [before.game, before.targetLevels, before.status], [after.game, after.targetLevels, after.status]);
same('both campaigns passed', [before.status, after.status], ['passed', 'passed']);
same('same production budgets and game assets', [before.budget, before.gameAssets], [after.budget, after.gameAssets]);
same('same initial public packet', before.initial, after.initial);
same('same commands, all public animation packets and primitive boundaries',
  before.actions.map(action => without(action, ['executionMs'])), after.actions.map(action => without(action, ['executionMs'])));
same('same selected prefixes and common acquisition counters',
  before.prefixes.map(prefix => without(prefix, ['graphChain', 'sharedSeries'])),
  after.prefixes.map(prefix => without(prefix, ['graphChain', 'sharedSeries'])));
same('same retained series projections after normalizing only observation scope',
  before.prefixes.map(retainedProjection), after.prefixes.map(retainedProjection));
same('same request results and caller revisions',
  before.requests.map(request => without(request, ['activeSeconds', 'elapsedMs'])),
  after.requests.map(request => without(request, ['activeSeconds', 'elapsedMs'])));
same('same final result and one retained session',
  without(before.final, ['activeSeconds', 'nativeImplementation']), without(after.final, ['activeSeconds', 'nativeImplementation']));
same('unchanged source during each run and no Python agent modules',
  [before.sourceUnchangedDuringRun, after.sourceUnchangedDuringRun, before.pythonAgentModules, after.pythonAgentModules], [true, true, [], []]);
same('same domain assessments', before.domainAssessments, after.domainAssessments);

function summary(values) {
  const sorted = [...values].sort((a, b) => a - b), n = sorted.length;
  return { count: n, totalMs: values.reduce((sum, value) => sum + value, 0),
    medianMs: n ? n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : null,
    minMs: n ? sorted[0] : null, maxMs: n ? sorted.at(-1) : null };
}
function timings(report) {
  const stages = { init: [], resume: [], sealed_acquisition: [], unsealed_advance: [] };
  let previousCycles = 0;
  for (const request of report.requests) {
    const stage = request.cycles > previousCycles ? 'sealed_acquisition' : request.operation === 'advance' ? 'unsealed_advance' : request.operation;
    stages[stage].push(request.elapsedMs); previousCycles = request.cycles;
  }
  return { activeSeconds: report.final.activeSeconds, elapsedSeconds: report.elapsedSeconds,
    byStage: Object.fromEntries(Object.entries(stages).map(([key, values]) => [key, summary(values)])),
    levels: report.boundaries.map(boundary => ({ level: boundary.completedLevel, actions: boundary.levelActions, activeSeconds: boundary.levelActiveSeconds })) };
}
const first = timings(before), second = timings(after), passed = checks.every(check => check.passed);
const result = {
  schema: 'logos-engine.v6.native-campaign-comparison.v1', passed, checks,
  before: { path: beforePath, sha256: sha(beforeBytes), implementation: before.final.nativeImplementation, sourceDigest: before.source.digest, timing: first },
  after: { path: afterPath, sha256: sha(afterBytes), implementation: after.final.nativeImplementation, sourceDigest: after.source.digest, timing: second },
  compared: { commands: before.actions.length, fullPublicPackets: before.actions.length + 1, prefixes: before.prefixes.length },
  observedActiveTimeReductionPercent: passed ? (1 - second.activeSeconds / first.activeSeconds) * 100 : null,
  qualification: 'Two real native campaigns. Compare source/budgets/instrumentation separately before attributing timings. This verifies the retained public trace and reported projections, not equality of complete graph-chain digests: session scopes and implementation identities differ. It is one before/after observation, not a repeated benchmark or a guarantee for other games or machines.',
};
await writeFile(output, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ passed, checks: checks.length, failed: checks.filter(check => !check.passed).map(check => check.name),
  compared: result.compared, beforeActiveSeconds: first.activeSeconds, afterActiveSeconds: second.activeSeconds,
  observedReductionPercent: result.observedActiveTimeReductionPercent }));
if (!passed) process.exitCode = 1;
