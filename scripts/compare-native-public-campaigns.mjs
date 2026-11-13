#!/usr/bin/env node
/**
 * Compare completed cold native campaigns and every recorded public value.
 * Usage: node scripts/compare-native-public-campaigns.mjs BEFORE_REPORT BEFORE_TRACE AFTER_REPORT AFTER_TRACE OUTPUT
 *   --before-execution BEFORE_EXECUTION --after-execution AFTER_EXECUTION
 *
 * Reads completed evidence only. No agent, game, oracle or source implementation
 * is imported. Execution receipts are required because campaign reports do not
 * contain the runner and harness fingerprints. Output is exclusive.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const omit = (value, fields) => Object.fromEntries(Object.entries(value).filter(([key]) => !fields.includes(key)));
const canonical = value => JSON.stringify(value, (_, item) => item && !Array.isArray(item) && typeof item === 'object'
  ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
const equal = (left, right) => canonical(left) === canonical(right);
const pointer = (base, key) => `${base}/${String(key).replaceAll('~', '~0').replaceAll('/', '~1')}`;
const MAX_DIFFERENCE_EXAMPLES = 200;

function inside(name) {
  const path = resolve(ROOT, name), local = relative(ROOT, path);
  assert.ok(local && !local.startsWith('..') && !isAbsolute(local), 'Evidence paths must be inside the checkout');
  return path;
}

async function bytesAt(name) {
  const path = inside(name), bytes = await readFile(path);
  return { bytes, fingerprint: { path: relative(ROOT, path), sha256: sha(bytes), bytes: bytes.length } };
}

async function jsonAt(name) {
  const item = await bytesAt(name);
  const bytes = item.bytes[0] === 0x1f && item.bytes[1] === 0x8b ? gunzipSync(item.bytes) : item.bytes;
  return { value: JSON.parse(bytes), fingerprint: item.fingerprint };
}

function compact(value) {
  if (value === undefined) return { missing: true };
  if (value === null || typeof value !== 'object') return value;
  return { type: Array.isArray(value) ? 'array' : 'object',
    size: Array.isArray(value) ? value.length : Object.keys(value).length,
    canonicalSha256: sha(canonical(value)) };
}

/** All comparable fields are examined; only the displayed difference examples are bounded. */
function compareValues(left, right) {
  const result = { equal: true, equalScalarLeaves: 0, differenceCount: 0, differences: [],
    maximumDifferenceExamples: MAX_DIFFERENCE_EXAMPLES, differenceExamplesTruncated: false };
  function difference(path, first, second, kind) {
    result.equal = false; result.differenceCount++;
    if (result.differences.length < MAX_DIFFERENCE_EXAMPLES)
      result.differences.push({ path: path || '/', kind, before: compact(first), after: compact(second) });
    else result.differenceExamplesTruncated = true;
  }
  function walk(first, second, path) {
    if (Object.is(first, second)) { result.equalScalarLeaves++; return; }
    if (first === null || second === null || typeof first !== 'object' || typeof second !== 'object'
        || Array.isArray(first) !== Array.isArray(second)) {
      difference(path, first, second, 'value_or_type'); return;
    }
    if (Array.isArray(first)) {
      if (first.length !== second.length) difference(pointer(path, 'length'), first.length, second.length, 'array_length');
      const length = Math.max(first.length, second.length);
      for (let index = 0; index < length; index++) {
        if (index >= first.length || index >= second.length) difference(pointer(path, index), first[index], second[index], 'array_member');
        else walk(first[index], second[index], pointer(path, index));
      }
      return;
    }
    const keys = new Set([...Object.keys(first), ...Object.keys(second)]);
    for (const key of [...keys].sort()) {
      if (!Object.hasOwn(first, key) || !Object.hasOwn(second, key))
        difference(pointer(path, key), first[key], second[key], 'object_member');
      else walk(first[key], second[key], pointer(path, key));
    }
  }
  walk(left, right, '');
  return { ...result, qualification: 'Exact JSON values and field presence, without normalization. Object key order is not semantic. '
    + 'Missing or type-changed subtrees are differences and are represented by a bounded summary. '
    + 'All comparisons continue after the example limit; truncation affects displayed differences only.' };
}

function parseArguments() {
  const args = process.argv.slice(2);
  assert.ok(args.length === 9,
    'Usage: compare-native-public-campaigns.mjs BEFORE_REPORT BEFORE_TRACE AFTER_REPORT AFTER_TRACE OUTPUT --before-execution FILE --after-execution FILE');
  const positional = args.slice(0, 5), options = new Map();
  for (let i = 5; i < args.length; i += 2) {
    assert.ok(['--before-execution', '--after-execution'].includes(args[i]) && !options.has(args[i]), 'Unexpected or repeated option');
    options.set(args[i], args[i + 1]);
  }
  assert.ok(options.has('--before-execution') && options.has('--after-execution'), 'Both execution receipts are required');
  const [beforeReport, beforeTrace, afterReport, afterTrace, output] = positional.map(inside);
  const beforeExecution = inside(options.get('--before-execution')), afterExecution = inside(options.get('--after-execution'));
  const paths = [beforeReport, beforeTrace, beforeExecution, afterReport, afterTrace, afterExecution, output];
  assert.equal(new Set(paths).size, paths.length, 'Inputs and output must use distinct evidence paths');
  return { beforeReport, beforeTrace, beforeExecution, afterReport, afterTrace, afterExecution, output };
}

function proposalProjection(prefix) {
  return Object.fromEntries(Object.entries(prefix).filter(([, value]) => value && typeof value === 'object'
    && !Array.isArray(value) && Object.hasOwn(value, 'proposal')).map(([key, value]) => [key, value.proposal]));
}

function proposalActionProjection(prefix) {
  return Object.fromEntries(Object.entries(proposalProjection(prefix)).map(([key, proposal]) => [key,
    proposal === null ? null : {
      actions: proposal.actions ?? null, kind: proposal.kind ?? null,
      field_subquestion: proposal.field_subquestion ?? null, material_access_subquestion: proposal.material_access_subquestion ?? null,
    }]));
}

const PREFIX_FIELDS = ['id', 'decisionRevision', 'acquiredActions', 'family', 'operations', 'proposalKind',
  'fieldSubquestion', 'materialSubquestion', 'selectionGroup', 'supportMode', 'callerAcquiredTransitions'];
function prefixProjection(prefix) {
  return Object.fromEntries(PREFIX_FIELDS.filter(key => Object.hasOwn(prefix, key)).map(key => [key, prefix[key]]));
}

async function validateCampaign(label, reportFile, traceFile, executionFile) {
  const report = reportFile.value, trace = traceFile.value, execution = executionFile.value, checks = [];
  const check = (name, condition, detail = null) => checks.push({ name, passed: Boolean(condition), ...(detail === null ? {} : { detail }) });
  assert.ok(Array.isArray(report.actions) && Array.isArray(report.prefixes) && Array.isArray(report.boundaries)
    && Array.isArray(report.requests) && Array.isArray(trace.packets) && trace.packets.length > 0, `Malformed ${label} campaign arrays`);
  assert.ok(report.source && report.final && report.initial && execution.executionInputs && execution.executionInputsAfter,
    `Missing ${label} campaign provenance`);
  const packets = trace.packets, actions = report.actions, first = packets[0].packet, last = packets.at(-1).packet;
  const count = actions.length;
  check('supported_campaign_trace_and_execution_schemas', report.schema === 'logos-engine.v6.integrated-game-campaign.v1'
    && trace.schema === 'logos-engine.native-public-game-trace.v1'
    && execution.schema === 'logos-engine.v53.actual-journaled-campaign-execution.v1');
  check('both_reports_completed_successfully', report.status === 'passed' && trace.status === 'passed' && report.failure === null);
  check('independent_live_campaign_without_recorded_baseline', report.baseline === null);
  check('trace_game_and_source_match_campaign', trace.game === report.game && trace.sourceDigest === report.source.digest);
  // The native inventory is ordered with JavaScript's ordinary lexicographic sort.
  const nativeFiles = Object.fromEntries(Object.keys(report.source.files).sort().map(key => [key, report.source.files[key]]));
  check('native_manifest_digest_valid', report.source.fileCount === Object.keys(nativeFiles).length
    && report.source.digest === sha(JSON.stringify(nativeFiles)));
  check('native_source_unchanged', report.sourceUnchangedDuringRun === true && execution.nativeSourceUnchanged === true
    && equal(execution.nativeSource, report.source) && equal(execution.nativeSourceAfter, report.source)
    && execution.nativeSourceManifestDigest === report.source.digest);
  check('execution_completed_with_unchanged_inputs', execution.exitCode === 0 && execution.executionCodeUnchanged === true
    && equal(execution.executionInputs, execution.executionInputsAfter));
  check('execution_receipt_binds_report_and_trace', equal(execution.report, reportFile.fingerprint) && equal(execution.trace, traceFile.fingerprint));
  check('no_python_agent_modules', equal(report.pythonAgentModules, []));
  check('game_asset_fingerprints_present', report.gameAssets && typeof report.gameAssets === 'object'
    && !Array.isArray(report.gameAssets) && Object.keys(report.gameAssets).length > 0
    && Object.values(report.gameAssets).every(value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)));
  check('original_reference_commit_present', typeof report.referenceCommit === 'string' && /^[a-f0-9]{40}$/.test(report.referenceCommit));
  check('one_cold_session_from_first_level', report.final.sessions === 1 && report.initial.level === 1
    && report.initial.levelsCompleted === 0 && first.level === report.initial.level
    && first.levels_completed === report.initial.levelsCompleted && packets[0].command === null);
  check('initial_packet_bound_to_campaign', sha(JSON.stringify(first)) === report.initial.publicPacketSha256
    && first.state === report.initial.state);
  check('complete_action_and_packet_counts', packets.length === count + 1 && report.final.actions === count);
  check('target_completion_attested', Number.isInteger(report.targetLevels) && report.targetLevels > 0
    && report.final.levelsCompleted >= report.targetLevels);
  check('last_public_packet_matches_final', last.level === report.final.level && last.levels_completed === report.final.levelsCompleted
    && last.state === report.final.state);
  check('prefixes_acquire_every_action_once', report.final.prefixes === report.prefixes.length
    && report.prefixes.every(prefix => Number.isSafeInteger(prefix.acquiredActions) && prefix.acquiredActions >= 0)
    && report.prefixes.reduce((sum, prefix) => sum + prefix.acquiredActions, 0) === count
    && report.final.caller?.acquiredTransitions === count);

  const inputChecks = [];
  for (const name of ['runner', 'harness', 'generator']) {
    const declared = execution.executionInputs[name];
    assert.ok(declared?.path, `Missing ${label} ${name} fingerprint`);
    const actual = (await bytesAt(declared.path)).fingerprint;
    inputChecks.push({ name, declared, current: actual, passed: equal(declared, actual) });
  }
  check('recorded_execution_files_match_retained_files', inputChecks.every(row => row.passed));
  assert.ok(execution.publicJournal?.path, `Missing ${label} passive public journal`);
  const journalFile = await bytesAt(execution.publicJournal.path);
  const journalBytes = journalFile.bytes[0] === 0x1f && journalFile.bytes[1] === 0x8b ? gunzipSync(journalFile.bytes) : journalFile.bytes;
  const journal = journalBytes.toString('utf8').split(/\r?\n/).filter(line => line.length > 0).map(line => JSON.parse(line));
  check('passive_journal_bytes_match_receipt', equal(execution.publicJournal, journalFile.fingerprint));
  check('every_passive_journal_entry_matches_trace', equal(journal, packets));

  const packetChecks = [], boundaries = [];
  let lastBoundary = 0, acquisitionCount = 0;
  const acquiredPrefixEnds = report.prefixes.map(prefix => acquisitionCount += prefix.acquiredActions);
  for (let index = 0; index < packets.length; index++) {
    const item = packets[index], packet = item.packet, previous = packets[index - 1]?.packet, action = actions[index - 1];
    const validFrame = Array.isArray(packet.frame_rows) && Array.isArray(packet.frame_packet);
    let passed = packet.step_index === index && validFrame
      && packet.frame_hash === sha(JSON.stringify(packet.frame_rows)).slice(0, 16);
    if (index > 0) passed = passed && Boolean(action) && action.sequence === index && equal(action.command, item.command)
      && action.levelBefore === previous.level && action.completedBefore === previous.levels_completed
      && action.levelAfter === packet.level && action.completedAfter === packet.levels_completed && action.state === packet.state
      && action.publicPacketSha256 === sha(JSON.stringify(packet)) && action.frameHash === packet.frame_hash
      && action.animationFrames === packet.frame_packet.length && packet.levels_completed >= previous.levels_completed;
    packetChecks.push({ index, passed, packetSha256: sha(JSON.stringify(packet)),
      completeEntryCanonicalSha256: sha(canonical(item)), animationFrames: validFrame ? packet.frame_packet.length : null });
    if (index > 0 && packet.levels_completed > previous.levels_completed) {
      const prefixIndex = acquiredPrefixEnds.indexOf(index);
      boundaries.push({ completedLevel: previous.level, nativeLevel: packet.level,
        levelsCompleted: packet.levels_completed, totalActions: index, levelActions: index - lastBoundary,
        prefixCount: prefixIndex < 0 ? null : prefixIndex + 1 });
      lastBoundary = index;
    }
  }
  check('every_command_and_packet_is_bound_to_real_progression', packetChecks.every(row => row.passed));
  const declaredBoundaries = report.boundaries.map(row => Object.fromEntries(Object.keys(boundaries[0] ?? {
    completedLevel: null, nativeLevel: null, levelsCompleted: null, totalActions: null, levelActions: null, prefixCount: null,
  }).map(key => [key, row[key]])));
  check('official_boundaries_match_public_progression', equal(boundaries, declaredBoundaries)
    && report.boundaries.every(row => row.sessionRetained === true));
  const operations = {};
  for (const request of report.requests) operations[request.operation] = (operations[request.operation] ?? 0) + 1;
  check('single_init_and_one_advance_per_action', operations.init === 1 && operations.advance === count
    && Object.keys(operations).every(name => ['init', 'advance', 'resume'].includes(name))
    && equal(operations, report.final.operationCounts));
  return { label, passed: checks.every(row => row.passed), checks, inputChecks, packetChecks,
    publicJournal: journalFile.fingerprint, derivedBoundaries: boundaries,
    summary: { game: report.game, targetLevels: report.targetLevels, actions: count, packets: packets.length,
      animationFramesIncludingInitial: packetChecks.reduce((sum, row) => sum + (row.animationFrames ?? 0), 0),
      prefixes: report.prefixes.length, sessions: report.final.sessions, levelsCompleted: report.final.levelsCompleted,
      level: report.final.level, state: report.final.state, reason: report.final.reason,
      levelActions: boundaries.map(row => row.levelActions), operationCounts: operations,
      nativeImplementation: report.final.nativeImplementation, nativeSourceDigest: report.source.digest } };
}

async function main() {
  const args = parseArguments();
  try { await access(args.output); throw new Error('Comparison output exists; refusing overwrite'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const [beforeReport, beforeTrace, beforeExecution, afterReport, afterTrace, afterExecution] = await Promise.all([
    args.beforeReport, args.beforeTrace, args.beforeExecution, args.afterReport, args.afterTrace, args.afterExecution,
  ].map(jsonAt));
  const before = beforeReport.value, after = afterReport.value;
  const validations = [await validateCampaign('before', beforeReport, beforeTrace, beforeExecution),
    await validateCampaign('after', afterReport, afterTrace, afterExecution)];
  const strictTrace = compareValues(beforeTrace.value, afterTrace.value);
  const publicTrajectory = compareValues(beforeTrace.value.packets, afterTrace.value.packets);
  const selectedPrefixes = compareValues(before.prefixes.map(prefixProjection), after.prefixes.map(prefixProjection));
  const proposalActions = compareValues(before.prefixes.map(proposalActionProjection), after.prefixes.map(proposalActionProjection));
  const strictRetainedProposals = compareValues(before.prefixes.map(proposalProjection), after.prefixes.map(proposalProjection));
  const actionMetadata = compareValues(before.actions.map(row => omit(row, ['executionMs'])), after.actions.map(row => omit(row, ['executionMs'])));
  const requests = compareValues(before.requests.map(row => omit(row, ['activeSeconds', 'elapsedMs'])),
    after.requests.map(row => omit(row, ['activeSeconds', 'elapsedMs'])));
  const finalProtocol = compareValues(omit(before.final, ['activeSeconds', 'nativeImplementation']),
    omit(after.final, ['activeSeconds', 'nativeImplementation']));
  const provenance = [
    { name: 'same_game_and_target', passed: before.game === after.game && before.targetLevels === after.targetLevels },
    { name: 'same_budget', passed: equal(before.budget, after.budget) },
    { name: 'same_game_assets', passed: equal(before.gameAssets, after.gameAssets) },
    { name: 'same_original_agent_reference', passed: before.referenceCommit === after.referenceCommit },
    { name: 'same_execution_runner_harness_and_generator', passed: equal(beforeExecution.value.executionInputs, afterExecution.value.executionInputs) },
  ];
  const required = { completePublicTrajectory: publicTrajectory.equal, selectedPrefixMetadata: selectedPrefixes.equal,
    retainedProposalActionsAndKinds: proposalActions.equal, actionMetadata: actionMetadata.equal,
    requestProtocolAndCallerRevisions: requests.equal, finalProtocol: finalProtocol.equal };
  const passed = validations.every(item => item.passed) && provenance.every(item => item.passed) && Object.values(required).every(Boolean);
  const result = {
    schema: 'logos-engine.native-public-campaign-comparison.v1', status: passed ? 'passed' : 'failed',
    recordedAt: new Date().toISOString(), generator: (await bytesAt(fileURLToPath(import.meta.url))).fingerprint,
    inputs: { before: { report: beforeReport.fingerprint, trace: beforeTrace.fingerprint, execution: beforeExecution.fingerprint },
      after: { report: afterReport.fingerprint, trace: afterTrace.fingerprint, execution: afterExecution.fingerprint } },
    validations, provenance, requiredComparisons: required,
    strictTraceEquality: strictTrace.equal, strictTraceComparison: strictTrace,
    completePublicTrajectoryExactlyEqual: publicTrajectory.equal, publicTrajectoryComparison: publicTrajectory,
    selectedPrefixComparison: selectedPrefixes, retainedProposalActionsComparison: proposalActions,
    strictRetainedProposalEquality: strictRetainedProposals.equal, strictRetainedProposalComparison: strictRetainedProposals,
    actionMetadataComparison: actionMetadata, requestProtocolComparison: requests, finalProtocolComparison: finalProtocol,
    scope: { sourceMetadataNormalized: false, publicValuesNormalized: false,
      actionMetadataExcludedFields: ['executionMs'], requestMetadataExcludedFields: ['activeSeconds', 'elapsedMs'],
      finalProtocolExcludedFields: ['activeSeconds', 'nativeImplementation'], selectedPrefixFields: PREFIX_FIELDS,
      retainedProposalActionFields: ['actions', 'kind', 'field_subquestion', 'material_access_subquestion'],
      strictTraceAndStrictRetainedProposalComparisonsAreDiagnostic: true,
      privateMemoryEquivalenceClaimed: false, completeSourceParityClaimed: false, speedRatioClaimed: false },
    qualification: 'Completed independent cold native campaigns, not a replay or an agent execution by this tool. '
      + 'Every command, public pixel, animation frame, level count and state is compared exactly as recorded, with no normalization. '
      + 'Receipts bind the reports, traces, unchanged native inventories, runner/harness/generator and complete passive journals. '
      + 'Recorded execution files are checked against the retained files; game asset digests are compared without reading game implementations. '
      + 'The whole-trace comparison retains any sourceDigest difference and is not relabeled as strict equality. '
      + 'Full retained proposal objects are also compared strictly, with session observation-reference differences left intact; '
      + 'the required proposal projection separately compares actions and kinds, not every private binding or memory field. '
      + 'The required metadata comparisons omit only the listed timing or implementation fields. '
      + 'Success establishes this public trajectory, selected metadata and execution protocol, not full private graph equivalence, '
      + 'global V5/V6 parity, causal contribution of a new capability or any performance budget.',
  };
  await mkdir(dirname(args.output), { recursive: true });
  await writeFile(args.output, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ status: result.status, output: relative(ROOT, args.output),
    before: validations[0].summary, after: validations[1].summary,
    strictTraceEquality: result.strictTraceEquality, completePublicTrajectoryExactlyEqual: publicTrajectory.equal,
    failedValidationChecks: validations.flatMap(item => item.checks.filter(row => !row.passed).map(row => `${item.label}:${row.name}`)),
    failedProvenanceChecks: provenance.filter(row => !row.passed).map(row => row.name),
    failedRequiredComparisons: Object.entries(required).filter(([, value]) => !value).map(([key]) => key) }));
  if (!passed) process.exitCode = 1;
}

await main();
