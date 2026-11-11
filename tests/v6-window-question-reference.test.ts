import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { readEvidenceSync } from './helpers/chunked-evidence.ts';
import { installWindowQuestionCapture } from './helpers/v6-window-question-capture.ts';
import { WindowQuestion } from '../src/logos-engine/v6-window-question.ts';
import { WindowPolicy } from '../src/logos-engine/v6-window-question-policy.ts';
import * as geometry from '../src/logos-engine/v6-window-question-geometry.ts';
import * as mechanical from '../src/logos-engine/v5-window-processing.ts';
import { RecolorWorkBudget } from '../src/logos-engine/v6-topological-recolor-geometry.ts';
import type { NativeExecution } from '../src/logos-engine/v6-native-types.ts';

type R = Record<string, any>;
const fixture = JSON.parse(gunzipSync(readEvidenceSync(new URL('./fixtures/v6-window-question-reference.json.gz', import.meta.url))).toString()) as R;
const copy = <T>(value: T): T => structuredClone(value);
const sourceFields = ['epoch', 'edits', 'portable', 'launches', 'attempts', 'last'].sort();
const execution: NativeExecution = { now: () => 0, deadlineMs: 1000, yieldControl: async () => {} };
function exactError(error: unknown, expected: R): boolean {
  assert.ok(error instanceof Error);
  if (expected.cause !== undefined) {
    assert.equal(error.name, expected.name); assert.equal(error.message, expected.message);
    assert.equal((error as unknown as R).cause, expected.cause);
    assert.deepEqual((error as unknown as R).frontier, expected.frontier);
  }
  return true;
}
function assertReceipts(value: any): void {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) { value.forEach(assertReceipts); return; }
  const keys = ['workflow', 'src_hash', 'src_status', 'executed_statements'];
  if (keys.every(key => Object.hasOwn(value, key))) assert.deepEqual(Object.keys(value).sort(), keys.sort(), 'All original SRC receipt fields remain compared');
  Object.values(value).forEach(assertReceipts);
}

for (const row of fixture.geometryCases) test(`window original geometry: ${row.id}`, () => {
  const run = () => (geometry as unknown as R)[row.operation](...copy(row.arguments));
  if (row.error) assert.throws(run, error => exactError(error, row.error));
  else assert.deepEqual(run(), row.value);
});

for (const row of fixture.cases) test(`window original family: ${row.id}`, async () => {
  const family = await WindowQuestion.create(); family.restore(copy(row.seedState));
  if (row.controlledDependency === 'duplicate_exact_current_offers') {
    // Explicit dependency intervention in both original and native guard. This
    // is not a naturally acquired raster or an injected live-game state.
    const original = family.offers.bind(family);
    family.offers = (...args: Parameters<WindowQuestion['offers']>) => {
      const [offers, measured] = original(...args); return [offers.concat(copy(offers)), measured];
    };
  }
  const run = async () => {
    const value = await (family as unknown as R)[row.operation](...copy(row.arguments));
    assertReceipts(value); return value === undefined ? null : value;
  };
  if (row.error) await assert.rejects(run, error => exactError(error, row.error));
  else assert.deepEqual(await run(), row.value);
  assert.deepEqual(family.state(), row.afterState, 'Every source field is compared, including attempts and last');
  assert.deepEqual(Object.keys(family.state()).sort(), sourceFields);
});

for (const row of fixture.policyCases) test(`window original DRM/SRC: ${row.id}`, async () => {
  const policy = await WindowPolicy.create();
  assert.deepEqual(policy.select(copy(row.offers)), row.select);
  const chosen = await policy.choose(copy(row.offers)); assertReceipts(chosen);
  assert.deepEqual(chosen, row.choose); assert.equal(chosen[0].release_authority, false);
});

for (const row of fixture.kernelCases) test(`window consumed original V5 kernel: ${row.id}`, () => {
  let clockCalls = 0;
  const now = () => row.clockMilliseconds[Math.min(clockCalls++, row.clockMilliseconds.length - 1)];
  const budget = new RecolorWorkBudget(copy(row.budget), now);
  const state = mechanical.normalizeWindowBeatState(copy(row.state)), original = copy(state);
  const run = () => row.operation === 'windowEligibility'
    ? mechanical.windowEligibility(state, state.receivers[row.receiverIndex]!, state.train,
      new Set(state.spent_for_run_refs), state.current_pulses, budget)
    : mechanical.processOneBeat(state, budget, row.depthBound);
  if (row.error) assert.throws(run, error => exactError(error, row.error));
  else assert.deepEqual(run(), row.value);
  assert.equal(budget.examined, row.examined); assert.equal(clockCalls, row.clockCalls);
  assert.deepEqual(state, original, 'A projection does not mutate its supplied state or compact fixed ranks');
});

for (const row of fixture.constructorCases) test(`window consumed original model: ${row.id}`, () => {
  const run = () => (mechanical as unknown as R)[row.operation](copy(row.argument));
  if (row.error) assert.throws(run, TypeError); else assert.deepEqual(run(), row.value);
});

for (const row of fixture.nativeAdaptationCases) test(`window named native boundary: ${row.id}`, () => {
  assert.ok(row.qualification);
  if (row.operation === 'plans') {
    const result = geometry.plans(...copy(row.arguments) as Parameters<typeof geometry.plans>);
    assert.deepEqual(result, row.nativeExpected); assert.deepEqual(result[0], []);
    assert.equal(result[1].truncated, true); assert.equal(result[1].domain, row.sourceExactDomainDecimal);
    assert.equal(result[1].native_domain_format, 'exact_decimal_integer');
  } else {
    assert.ok(row.sourceResult.value, 'The original accepted value remains retained, separately from native refusal');
    assert.equal(row.nativeExpectedError, 'TypeError');
    assert.throws(() => (mechanical as unknown as R)[row.operation](copy(row.argument)), TypeError);
  }
});

test('window reference binds its actual generator, pinned originals and newly executed case population', () => {
  assert.equal(fixture.referenceCommit, '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e');
  assert.equal(fixture.sourceModified, false); assert.equal(fixture.fullCallerParity, false);
  assert.equal(fixture.sourceFilesVerifiedBefore, 1786); assert.equal(fixture.sourceFilesVerifiedAfter, 1786);
  assert.equal(fixture.sourceFilesVerifiedBeforeAndAfter, 1786);
  assert.match(fixture.qualification, /synthetic/); assert.match(fixture.qualification, /No game dispatch/);
  assert.deepEqual(fixture.bytecodeIsolation, { dontWriteBytecode: true, freshPrefixEmptyAfter: true });
  const exporter = readFileSync(new URL('../scripts/export-v6-window-question-reference.py', import.meta.url));
  assert.equal(fixture.generator.path, 'scripts/export-v6-window-question-reference.py');
  assert.equal(createHash('sha256').update(exporter).digest('hex'), fixture.generator.sha256);
  const pin = `../reference/v6/${fixture.referenceCommit}/`;
  const manifest = JSON.parse(readFileSync(new URL(pin + 'manifest.json', import.meta.url), 'utf8'));
  assert.equal(Object.keys(manifest.files).length, 1786);
  for (const [path, hash] of Object.entries(fixture.sourceHashes)) {
    const raw = readFileSync(new URL(pin + 'source/' + path, import.meta.url));
    assert.equal(createHash('sha256').update(raw).digest('hex'), hash, path);
    assert.equal(manifest.files[path].sha256, hash, path);
  }
  for (const name of ['geometryCases', 'cases', 'policyCases', 'kernelCases', 'constructorCases', 'nativeAdaptationCases']) {
    assert.equal(fixture.groupCounts[name], fixture[name].length); assert.ok(fixture[name].length > 0);
    assert.equal(new Set(fixture[name].map((row: R) => row.id)).size, fixture[name].length);
  }
  for (const [path, name] of [
    ['agents/yf_arc3_v6/morphology_policy/window_question/family.py', 'WindowQuestion.record'],
    ['agents/yf_arc3_v6/morphology_policy/window_question/geometry.py', 'coverage'],
    ['agents/yf_arc3_v6/morphology_policy/window_question/policy.py', 'WindowPolicy.select'],
    ['agents/yf_arc3_v5/capabilities/window_processing_d.py', '_window_eligibility'],
    ['agents/yf_arc3_v5/capabilities/window_processing_d.py', '_process_one_beat'],
    ['agents/yf_arc3_v5/capabilities/mechanical_family_contracts_d.py', 'DWorkBudget.visit'],
  ]) assert.ok(fixture.executedSourceFunctions.some((row: R) => row.path === path && row.function === name && row.calls > 0), name);
});

test('completed cooperative plans preserve the complete original tuple, product order and costs', async () => {
  const row = fixture.cooperative; let yielded = 0;
  const result = await geometry.plansCooperative(copy(row.measurement), copy(row.model),
    { ...execution, yieldControl: async () => { yielded++; } });
  assert.deepEqual(result, row.sourcePlans); assert.ok(yielded > 0);
  assert.ok(result[0].length > 0, 'Completed candidates are available before the interruption counterfactuals');
});

test('native cancellation after a cooperative yield discards every partially enumerated candidate', async () => {
  const row = fixture.cooperative, controller = new AbortController(); let yielded = 0;
  const result = await geometry.plansCooperative(copy(row.measurement), copy(row.model),
    { ...execution, signal: controller.signal, yieldControl: async () => { yielded++; controller.abort(); } });
  assert.equal(yielded, 1); assert.deepEqual(result[0], []); assert.equal(result[1].truncated, true);
  assert.equal(result[1].native_search_incomplete.reason, 'native_abort');
  assert.ok(result[1].native_search_incomplete.frontier.completed_configurations > 0);
  assert.ok(result[1].native_search_incomplete.frontier.completed_configurations < row.sourcePlans[1].domain);
});

test('native deadlines before work and after the final coverage never expose complete plans', async () => {
  const row = fixture.cooperative;
  const immediate = await geometry.plansCooperative(copy(row.measurement), copy(row.model), { ...execution, deadlineMs: 0 });
  assert.deepEqual(immediate[0], []); assert.equal(immediate[1].native_search_incomplete.reason, 'native_deadline');
  assert.equal(immediate[1].native_search_incomplete.frontier.completed_configurations, 0);
  let now = 0, yields = 0;
  const late = await geometry.plansCooperative(copy(row.measurement), copy(row.model),
    { now: () => now, deadlineMs: 1000, yieldControl: async () => { if (++yields === 2) now = 1000; } });
  assert.deepEqual(late[0], []); assert.equal(late[1].native_search_incomplete.reason, 'native_deadline');
  assert.equal(late[1].native_search_incomplete.frontier.completed_configurations, row.sourcePlans[1].domain);
});

test('completed native proposal and current guard equal the original full source outputs', async () => {
  const k = fixture.kernelCold, family = await WindowQuestion.create(); family.restore(copy(k.passive.afterState));
  const proposal = await family.propose(k.editedObservation, k.editedRows, [], k.stageRemaining.proposal, execution);
  assert.deepEqual(proposal, k.proposal.value); assert.equal(family.currentProposalRefusal(k.editedObservation), null);
  const packet = { frame_rows: k.editedRows } as any;
  assert.deepEqual(await family.before(proposal!, 0, packet, k.editedObservation, execution),
    family.beforeSource(proposal!, 0, packet, k.editedObservation));
  assert.deepEqual(family.state(), k.passive.afterState);
});

test('aborted native proposal and guard grant no authority and acquire no attempts', async () => {
  const k = fixture.kernelCold, family = await WindowQuestion.create(); family.restore(copy(k.passive.afterState));
  const retained = family.state(), controller = new AbortController(); controller.abort();
  const stopped = { ...execution, signal: controller.signal };
  assert.equal(await family.propose(k.editedObservation, k.editedRows, [], 8, stopped), null);
  const refusal = family.currentProposalRefusal(k.editedObservation) as R;
  assert.equal(refusal.status, 'unknown'); assert.equal(refusal.reason, 'window_question_search_incomplete');
  assert.equal(refusal.release_authority, false); assert.equal(refusal.domain_complete, false);
  assert.equal(refusal.status_is_not_an_acquired_refutation, true);
  assert.deepEqual(family.state(), retained);
  assert.equal((await family.before(k.proposal.value, 0, { frame_rows: k.editedRows } as any, k.editedObservation, stopped)).admitted, false);
  assert.deepEqual(family.state(), retained);
  assert.equal(family.currentProposalRefusal({ ...k.editedObservation, observation_ref: 'different' }), null);
});

test('Window entry retains source output and rejects unrelated declared entries', async () => {
  const k = fixture.kernelCold, family = await WindowQuestion.create(); family.restore(copy(k.passive.afterState));
  assert.deepEqual(await family.proposeInSubquestion('factored_material_return', 'window_question', k.editedObservation, k.editedRows, [], 8),
    { ...k.proposal.value, material_access_subquestion: 'window_question' });
  await assert.rejects(family.proposeInSubquestion('goal_access', 'window_question', k.editedObservation, k.editedRows, [], 8), TypeError);
});

test('native record delegates once and the source state predicate excludes launches alone', async () => {
  const k = fixture.kernelCold, family = await WindowQuestion.create(); let calls = 0;
  const original = family.recordSource.bind(family);
  family.recordSource = (...args) => { calls++; return original(...args); };
  family.restore(copy(k.passive.afterState));
  assert.deepEqual(family.record(...copy(k.active.arguments) as Parameters<WindowQuestion['record']>), { events: [k.active.value] });
  assert.equal(calls, 1); assert.deepEqual(family.state(), k.active.afterState);
  assert.equal(family.sourceStateShouldPersist(), true);
  const launches = fixture.cases.find((row: R) => row.id === 'launches_only_not_method');
  family.restore(copy(launches.afterState)); assert.equal(family.sourceStateShouldPersist(), false);
  const saved = family.nativeState(); family.restore({ launches: [], last: null }); family.restoreNative(saved);
  assert.deepEqual(family.state(), launches.afterState);
});

test('complete Window checkpoints are detached, immutable, atomic and preserve JSON types', async () => {
  const family = await WindowQuestion.create(), seed = copy(fixture.kernelCold.active.afterState);
  family.restore(seed); const expected = family.state();
  seed.edits.length = 0; assert.deepEqual(family.state(), expected);
  const detached = family.state(); detached.edits.length = 0; assert.deepEqual(family.state(), expected);
  const saved = family.nativeState() as R, revision = family.nativeRevision;
  assert.deepEqual(Object.keys(saved.source_state).sort(), sourceFields);
  assert.ok(Object.isFrozen(saved)); assert.ok(Object.isFrozen(saved.source_state.edits));
  assert.equal(family.nativeState(), saved);
  for (const invalid of [{ ...copy(saved), format: 'foreign' }, { ...copy(saved), extra: true },
    { ...copy(saved), source_state: { ...copy(expected), epoch: NaN } },
    { ...copy(saved), source_state: { ...copy(expected), edits: [1] } },
    { ...copy(saved), source_state: { ...copy(expected), attempts: [] } },
    { ...copy(saved), source_state: { ...copy(expected), last: [] } }]) {
    assert.throws(() => family.restoreNative(invalid)); assert.deepEqual(family.state(), expected);
    assert.equal(family.nativeRevision, revision); assert.equal(family.nativeState(), saved);
  }
  family.restore({ edits: [], last: null }); family.restoreNative(saved); assert.deepEqual(family.state(), expected);
  family.last = { typed: true }; const booleanState = family.nativeState();
  family.last = { typed: 1 }; const numericState = family.nativeState();
  assert.notEqual(booleanState, numericState); assert.notDeepEqual(booleanState, numericState);
});

test('native raster boundary refuses malformed portable pixels without acquiring source knowledge', () => {
  for (const rows of [[[true]], [[256]], [[1], [1, 2]]]) assert.throws(() => geometry.measure(rows as any), TypeError);
});

test('passive Window capture preserves Promise, return and exception identities and actual execution arguments', async () => {
  const state = copy(fixture.kernelCold.passive.beforeState), report: R = {};
  const result = { value: 7 }, pending = Promise.resolve(result), failure = new Error('original failure');
  const received: any[][] = [], executionObject = { signal: new AbortController().signal, yieldControl: async () => {} };
  const owner: R = {
    state: () => state,
    propose(...args: any[]) { received.push(args); return pending; },
    before(...args: any[]) { received.push(args); return result; },
    recordSource(...args: any[]) { received.push(args); throw failure; },
    restoreNative(...args: any[]) { received.push(args); return result; },
    currentProposalRefusal: () => null,
  };
  const originals = Object.fromEntries(['propose', 'before', 'recordSource', 'restoreNative'].map(key => [key, owner[key]]));
  const capture = installWindowQuestionCapture(owner, report);
  const args = [{ observation_ref: 'current' }, [], [], 8];
  assert.equal(owner.propose(...args, executionObject), pending);
  assert.equal(await pending, result);
  assert.equal(owner.before(...args, executionObject), result);
  assert.throws(() => owner.recordSource(...args, []), error => error === failure);
  assert.equal(owner.restoreNative({ format: 'test', source_state: state }), result);
  assert.equal(received[0]![4], executionObject); assert.equal(received[1]![4], executionObject);
  assert.deepEqual(report.windowSourceCalls[0].arguments, args);
  assert.deepEqual(report.windowSourceCalls[1].arguments, args);
  assert.equal(report.windowSourceCalls[2].arguments.length, 8);
  assert.deepEqual(report.windowSourceCalls[2].arguments.slice(5), [null, 0, null]);
  assert.equal(report.windowSourceCalls[0].returnMode, 'async');
  assert.equal(report.windowSourceCalls[0].completion, 'returned');
  assert.equal(report.windowSourceCalls[2].completion, 'failed');
  assert.deepEqual(report.windowSourceCalls[2].error, { name: 'Error', message: failure.message });
  assert.equal(report.windowRestoreCalls[0].sourceCallsBefore, 3);
  assert.equal(report.windowRestoreCalls[0].sourceCallsAfter, 3);
  assert.deepEqual(report.windowCaptureErrors, []);
  capture.dispose();
  for (const [key, original] of Object.entries(originals)) assert.equal(owner[key], original);
});

test('passive Window capture exposes observer failures without replacing original returns or undefined rejections', async () => {
  const report: R = {}, uncloneable = { method: () => null }, rejection = Promise.reject(undefined);
  const owner: R = { state: () => ({}), propose: () => rejection, before: () => uncloneable,
    recordSource: () => { throw undefined; }, restoreNative: () => undefined };
  const capture = installWindowQuestionCapture(owner, report);
  assert.equal(owner.propose({}, [], [], 8), rejection);
  try { await rejection; assert.fail('The original rejection must survive'); } catch (error) { assert.equal(error, undefined); }
  assert.equal(report.windowSourceCalls[0].completion, 'failed');
  assert.deepEqual(report.windowSourceCalls[0].error, { name: 'undefined', message: 'undefined' });
  assert.equal(owner.before({}, 0, {}, {}), uncloneable);
  assert.ok(report.windowCaptureErrors.some((row: R) => row.phase === 'result'));
  let thrown = false;
  try { owner.recordSource({}, {}, {}, [], []); } catch (error) { thrown = true; assert.equal(error, undefined); }
  assert.equal(thrown, true); assert.equal(report.windowSourceCalls[2].completion, 'failed');
  capture.dispose();
});

test('passive Window prefix capture reads persisted checkpoints and actual source facts without invoking persistence', async () => {
  const family = await WindowQuestion.create(), report: R = { prefixes: [] }, k = fixture.kernelCold;
  const capture = installWindowQuestionCapture(family, report);
  assert.deepEqual(family.recordSource(...copy(k.passive.arguments) as Parameters<WindowQuestion['recordSource']>), k.passive.value);
  const checkpoint = family.nativeState();
  const nativeState = family.nativeState, restoreNative = family.restoreNative;
  family.nativeState = () => { throw new Error('The observer must not request a fresh native checkpoint'); };
  family.restoreNative = () => { throw new Error('The observer must not restore'); };
  const transition = { command: k.foreignCommand, before: k.initialObservation.observation_ref,
    after: k.editedObservation.observation_ref, outcome: 'changed' };
  const eventFact = { episode: 'common-observation-frontier', key: 'window_question_event:1', value: k.passive.value,
    evidence: transition.after, revision: 2 };
  const retained = { episode: 'common-observation-frontier', key: 'window_question_state', value: k.passive.afterState,
    evidence: transition.after, revision: 2 };
  const snapshot = capture.prefixSnapshot({ read: key => {
    assert.equal(key, 'family_state:public_window_question'); return checkpoint;
  }, facts: [eventFact, retained, { ...eventFact, key: 'window_question_event:99' }],
  transitions: [transition], proposal: {}, selectedFamily: 'observed_frontier' });
  assert.deepEqual(snapshot!.sourceState, k.passive.afterState);
  assert.deepEqual(snapshot!.instanceSourceState, k.passive.afterState);
  assert.equal(snapshot!.sourceCallsThrough, 1); assert.equal(snapshot!.restoreCallsThrough, 0);
  assert.equal(snapshot!.sourceDepthAtSnapshot, 0); assert.equal(snapshot!.nativeRestoration, null);
  assert.deepEqual(snapshot!.transitions, [transition]); assert.deepEqual(snapshot!.acquired, [eventFact]);
  assert.deepEqual(snapshot!.retainedSourceFact, retained); assert.equal('selectedProposal' in snapshot!, false);
  assert.deepEqual(report.windowCaptureErrors, []);
  snapshot!.sourceState.edits.length = 0; assert.deepEqual(family.state(), k.passive.afterState);
  family.nativeState = nativeState; family.restoreNative = restoreNative; capture.dispose();
});
