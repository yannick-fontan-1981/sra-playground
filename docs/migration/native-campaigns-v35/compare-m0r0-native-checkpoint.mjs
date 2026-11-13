/**
 * Compare the already recorded M0R0 witnesses; never starts a game or agent.
 * Run only after m0r0-three-levels.json is complete:
 *   node docs/migration/native-campaigns-v35/compare-m0r0-native-checkpoint.mjs
 * Optional argv[2..4]: baseline report, candidate report, output report.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const here = new URL('.', import.meta.url);
const location = (argument, fallback) => argument ? pathToFileURL(resolve(argument)) : new URL(fallback, here);
const beforePath = location(process.argv[2], 'm0r0-before-native-checkpoint.json');
const afterPath = location(process.argv[3], 'm0r0-three-levels.json');
const outputPath = location(process.argv[4], 'm0r0-native-checkpoint-comparison.json');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const [beforeBytes, afterBytes] = await Promise.all([readFile(beforePath), readFile(afterPath)]);
const before = JSON.parse(beforeBytes), after = JSON.parse(afterBytes);
const expectedLevelActions = [19, 27, 62], expectedActions = 108;
const checks = [];
function checked(name, body) { body(); checks.push({ name, passed: true }); }
function boundary(report, level) {
  const found = report.boundaries.find(boundary => boundary.completedLevel === level);
  assert.ok(found, `Missing completed level ${level}`); return found;
}
const beforeBoundary = boundary(before, 3), afterBoundary = boundary(after, 3);
const beforeActions = before.actions.slice(0, expectedActions), afterActions = after.actions;
checked('fixed_game_and_requested_targets', () => {
  assert.equal(before.game, 'M0R0'); assert.equal(after.game, 'M0R0');
  assert.equal(before.targetLevels, 6); assert.equal(after.targetLevels, 3);
  assert.equal(after.status, 'passed');
  assert.equal(after.final.levelsCompleted, 3);
  assert.equal(after.boundaries.length, 3);
});
checked('same_108_commands_and_109_complete_public_packets', () => {
  assert.equal(beforeBoundary.totalActions, expectedActions);
  assert.equal(afterBoundary.totalActions, expectedActions);
  assert.equal(beforeActions.length, expectedActions); assert.equal(afterActions.length, expectedActions);
  assert.equal(before.initial.publicPacketSha256, after.initial.publicPacketSha256);
  for (const [index, first] of beforeActions.entries()) {
    const second = afterActions[index];
    assert.equal(first.sequence, index + 1); assert.equal(second.sequence, index + 1);
    assert.deepEqual(second.command, first.command, `Command differs at ${index + 1}`);
    assert.equal(second.publicPacketSha256, first.publicPacketSha256, `Complete public packet differs at ${index + 1}`);
    for (const key of ['levelBefore', 'completedBefore', 'levelAfter', 'completedAfter', 'state', 'frameHash', 'animationFrames']) {
      assert.deepEqual(second[key], first[key], `${key} differs at ${index + 1}`);
    }
  }
});
checked('same_per_level_action_counts_19_27_62', () => {
  assert.deepEqual([1, 2, 3].map(level => boundary(before, level).levelActions), expectedLevelActions);
  assert.deepEqual(after.boundaries.map(boundary => boundary.levelActions), expectedLevelActions);
});
checked('one_session_real_budgets_and_no_python_agent', () => {
  for (const report of [before, after]) {
    assert.equal(report.final.sessions, 1);
    assert.equal(report.final.operationCounts.init, 1);
    assert.deepEqual(report.pythonAgentModules, []);
    assert.equal(report.budget.activeSecondsPerLevel, 360);
    assert.deepEqual(report.budget.levelActionCaps.slice(0, 3), [600, 600, 600]);
    assert.equal(report.budget.clock, 'real active compute and native execution');
    assert.equal(report.sourceUnchangedDuringRun, true);
    for (const level of [1, 2, 3]) assert.equal(boundary(report, level).sessionRetained, true);
  }
  assert.equal(after.final.operationCounts.advance, expectedActions);
  assert.equal(after.final.actions, expectedActions);
});
checked('same_reference_and_game_assets', () => {
  assert.equal(after.referenceCommit, before.referenceCommit);
  assert.deepEqual(after.gameAssets, before.gameAssets);
});
checked('source_manifests_match_their_saved_digests', () => {
  for (const report of [before, after]) {
    assert.equal(report.source.fileCount, Object.keys(report.source.files).length);
    const ordered = Object.fromEntries(Object.entries(report.source.files).sort(([left], [right]) => left.localeCompare(right, 'en')));
    assert.equal(hash(JSON.stringify(ordered)), report.source.digest);
  }
});
const beforePrefixes = before.prefixes.filter(prefix => prefix.callerAcquiredTransitions <= expectedActions);
const afterPrefixes = after.prefixes;
const prefixShape = prefix => ({ decisionRevision: prefix.decisionRevision, acquiredActions: prefix.acquiredActions,
  family: prefix.family, proposalKind: prefix.proposalKind, fieldSubquestion: prefix.fieldSubquestion,
  supportMode: prefix.supportMode, callerAcquiredTransitions: prefix.callerAcquiredTransitions });
checked('same_selected_families_and_committed_prefixes', () => {
  assert.deepEqual(afterActions.map(action => [action.family, action.decisionRevision, action.actionIndex]),
    beforeActions.map(action => [action.family, action.decisionRevision, action.actionIndex]));
  assert.deepEqual(afterPrefixes.map(prefixShape), beforePrefixes.map(prefixShape));
  assert.equal(beforePrefixes.reduce((total, prefix) => total + prefix.acquiredActions, 0), expectedActions);
  assert.equal(afterPrefixes.reduce((total, prefix) => total + prefix.acquiredActions, 0), expectedActions);
});
checked('known_final_boundary_replay_difference', () => {
  for (const level of [1, 2]) {
    assert.equal(boundary(before, level).caller.boundaryReplays, level);
    assert.equal(boundary(after, level).caller.boundaryReplays, level);
  }
  assert.equal(beforeBoundary.caller.boundaryReplays, 3);
  assert.equal(afterBoundary.caller.boundaryReplays, 2);
  assert.equal(beforeBoundary.caller.acquiredTransitions, expectedActions);
  assert.equal(afterBoundary.caller.acquiredTransitions, expectedActions);
  assert.equal(after.final.caller.acquiredTransitions, expectedActions);
});
const timing = (first, second) => ({ beforeSeconds: first, afterSeconds: second,
  savedSeconds: first - second, reductionPercent: (1 - second / first) * 100, ratioBeforeToAfter: first / second });
const levels = [1, 2, 3].map(level => ({ level, actions: expectedLevelActions[level - 1],
  ...timing(boundary(before, level).levelActiveSeconds, boundary(after, level).levelActiveSeconds),
  beforePrefixCountCumulative: boundary(before, level).prefixCount,
  afterPrefixCountCumulative: boundary(after, level).prefixCount,
  beforeNodeCount: boundary(before, level).nodeCount, afterNodeCount: boundary(after, level).nodeCount,
  beforeGraphRevision: boundary(before, level).graphRevision, afterGraphRevision: boundary(after, level).graphRevision,
  timingQualification: level < 3
    ? 'Same observed actions and both natural boundary replays are present. Real active-time comparison of the two integrated versions, not an isolated CPU benchmark.'
    : 'Includes the known endpoint difference: baseline target 6 replays the L3 boundary into L4; candidate target 3 stops after acquiring L3. The full level timing cannot isolate checkpoint savings from that omitted replay.' }));
function requestStatistics(report) {
  const selected = report.requests.filter(request => request.sequence < expectedActions
    || request.sequence === expectedActions && request.operation === 'advance');
  const groups = new Map();
  let acquired = 0;
  for (const request of selected) {
    const current = request.caller?.acquiredTransitions ?? acquired;
    const delta = current - acquired; acquired = current;
    const beforeAction = report.actions.find(action => action.sequence === request.sequence);
    const level = request.operation === 'advance' ? beforeAction?.levelBefore : request.level;
    if (![1, 2, 3].includes(level)) continue;
    const phase = request.operation === 'advance' ? delta > 0 ? delta === 1 ? 'acquire_one_transition' : 'acquire_multiple_transitions'
      : 'continue_unsealed_prefix' : request.operation;
    const key = `${level}:${phase}`, values = groups.get(key) ?? { level, phase, elapsedMs: [], acquiredTransitions: 0 };
    values.elapsedMs.push(request.elapsedMs); values.acquiredTransitions += delta; groups.set(key, values);
  }
  return [...groups.values()].map(group => {
    const sorted = group.elapsedMs.toSorted((a, b) => a - b), n = sorted.length;
    return { level: group.level, phase: group.phase, requests: n, acquiredTransitions: group.acquiredTransitions,
      totalMs: sorted.reduce((total, value) => total + value, 0), minMs: sorted[0], maxMs: sorted.at(-1),
      medianMs: n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2 };
  });
}
const names = [...new Set([...Object.keys(before.source.files), ...Object.keys(after.source.files)])].sort();
const sourceChanges = names.filter(name => before.source.files[name] !== after.source.files[name]).map(name => ({ path: name,
  beforeSha256: before.source.files[name] ?? null, afterSha256: after.source.files[name] ?? null }));
const comparison = { schema: 'logos-engine.v6.native-checkpoint-comparison.v1',
  qualification: 'Comparison of recorded reports only; this script makes no game or agent calls. Equality is asserted for the initial public packet, 108 commands and their 108 complete public response packets, selected families, and committed prefix boundaries. The old full campaign failed later in L4; only its witnessed successful first three levels are compared. Native versions and target endpoints differ. Time reductions do not isolate individual copy/restore calls; no count of those calls or complete graph equality is claimed.',
  before: { path: beforePath.pathname, sha256: hash(beforeBytes), nativeImplementation: before.final.nativeImplementation,
    sourceDigest: before.source.digest, sourceFileCount: before.source.fileCount, requestedTarget: before.targetLevels,
    entireCampaignStatus: before.status, entireCampaignFinal: before.final },
  after: { path: afterPath.pathname, sha256: hash(afterBytes), nativeImplementation: after.final.nativeImplementation,
    sourceDigest: after.source.digest, sourceFileCount: after.source.fileCount, requestedTarget: after.targetLevels,
    entireCampaignStatus: after.status, entireCampaignFinal: after.final },
  checks, witnesses: { commandsCompared: expectedActions, completePublicPacketsCompared: expectedActions + 1,
    prefixesCompared: afterPrefixes.length, perLevelActions: expectedLevelActions, sessions: 1, pythonAgentModules: 0 },
  levels, aggregateFirstTwoLevels: { ...timing(boundary(before, 2).activeSeconds, boundary(after, 2).activeSeconds),
    qualification: 'Both reports continue after L2, so this aggregate avoids the final target-boundary replay difference.' },
  aggregateThreeLevels: { ...timing(beforeBoundary.activeSeconds, afterBoundary.activeSeconds),
    qualification: 'This total includes one fewer boundary replay in the candidate because its requested target is three levels.' },
  requestStatistics: { before: requestStatistics(before), after: requestStatistics(after),
    qualification: 'Elapsed service-request durations from the reports, grouped by action-before level and newly acquired transitions. These are neither CPU samples nor an attribution to a specific function.' },
  sourceChanges };
await writeFile(outputPath, JSON.stringify(comparison, null, 2) + '\n');
console.log(JSON.stringify({ output: outputPath.pathname, checksPassed: checks.length, witnesses: comparison.witnesses,
  levels, aggregateFirstTwoLevels: comparison.aggregateFirstTwoLevels, aggregateThreeLevels: comparison.aggregateThreeLevels }));
