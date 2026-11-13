import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import test from 'node:test';
import { ChartNavigation } from '../src/logos-engine/v6-chart-navigation.ts';
import type { NativeExecution, NativeObservation, NativeRows } from '../src/logos-engine/v6-native-types.ts';

type R = Record<string, any>;
const copy = <T>(value: T): T => structuredClone(value);
const fixture = JSON.parse(gunzipSync(await readFile(new URL(
  '../docs/migration/lot9a-evidence/reference-01/reference.json.gz', import.meta.url))).toString()) as R;
const fields = ['epoch', 'chart', 'position', 'positions', 'position_status', 'visited', 'grants', 'gains',
  'views', 'blocked', 'evidence', 'portable', 'last', 'method_use'];
const cold = fixture.frames.chart_cold as { rows: NativeRows; observation: NativeObservation };
const execution: NativeExecution = { yieldControl: async () => {}, now: () => 0, deadlineMs: 100 };

async function measured(): Promise<ChartNavigation> {
  const owner = await ChartNavigation.create();
  assert.ok(owner.current(copy(cold.observation), copy(cold.rows)), 'The independent public raster must provide a current chart');
  return owner;
}
function assertFrozen(value: unknown): void {
  if (value === null || typeof value !== 'object') return;
  assert.ok(Object.isFrozen(value), 'Every retained native JSON branch must be immutable');
  for (const child of Object.values(value)) assertFrozen(child);
}
function assertNoAcquisition(owner: ChartNavigation): void {
  assert.deepEqual(owner.evidence, []); assert.deepEqual(owner.gains, []); assert.deepEqual(owner.grants, []);
  assert.deepEqual(owner.portable, []); assert.equal(owner.last, null);
}

test('Chart public snapshots and restored source inputs cannot mutate the retained owner', async () => {
  const owner = await measured(), original = owner.state(), exported = owner.sourceState();
  assert.deepEqual(Object.keys(exported).sort(), [...fields].sort());
  exported.chart.nodes[0].center[0] += 1;
  exported.chart.evidence.push('native-contract:external-snapshot');
  exported.positions[0][1] += 1;
  assert.deepEqual(owner.state(), original);
  const restored = await ChartNavigation.create(), incoming = copy(original);
  restored.restore(incoming);
  incoming.chart.slots[0].bbox[0] += 1; incoming.evidence.push('native-contract:external-input');
  assert.deepEqual(restored.state(), original);
});

test('Chart native snapshots are deeply immutable, reusable and sensitive to typed nested changes', async () => {
  const owner = await measured(); owner.last = { native_contract_value: false };
  const saved = owner.nativeState() as R, revision = owner.nativeRevision;
  assertFrozen(saved); assert.deepEqual(saved.source_state, owner.state());
  assert.notEqual(saved.source_state.chart, owner.chart);
  assert.equal(owner.nativeState(), saved); assert.equal(owner.nativeRevision, revision);
  assert.throws(() => { saved.source_state.chart.nodes[0].center[0] += 1; }, TypeError);
  assert.throws(() => { saved.source_state.evidence.push('native-contract:mutation'); }, TypeError);
  owner.last!.native_contract_value = 0;
  const changed = owner.nativeState() as R;
  assert.notEqual(changed, saved, 'Python False == 0 must not collapse typed native checkpoint identity');
  assert.equal(owner.nativeRevision, revision + 1);
  assert.equal(saved.source_state.last.native_contract_value, false);
  assert.equal(changed.source_state.last.native_contract_value, 0);
});

test('Chart restores a healthy retained checkpoint after external corruption of mutable working fields', async () => {
  const owner = await measured(), healthy = owner.state(), saved = owner.nativeState();
  owner.chart!.nodes = null; owner.blocked = [7] as unknown as string[];
  assert.throws(() => owner.nativeState(), TypeError);
  owner.restoreNative(saved);
  assert.deepEqual(owner.state(), healthy); assert.equal(owner.nativeState(), saved);
  owner.positions[0]![0] += 1;
  owner.restoreNative(saved);
  assert.deepEqual(owner.state(), healthy, 'Restoring an identical checkpoint handle must still repair mutable state');
});

test('Chart rejects corrupt native envelopes and consumed chart structures atomically', async () => {
  const owner = await measured(), saved = owner.nativeState() as R, original = owner.state(), revision = owner.nativeRevision;
  const corruptions: [string, (state: R) => void][] = [
    ['foreign format', state => { state.format = 'native.foreign.v1'; }],
    ['extra envelope field', state => { state.unknown = true; }],
    ['missing source field', state => { delete state.source_state.positions; }],
    ['empty chart', state => { state.source_state.chart = {}; }],
    ['null nodes', state => { state.source_state.chart.nodes = null; }],
    ['empty slots', state => { state.source_state.chart.slots = []; }],
    ['invalid pitch', state => { state.source_state.chart.pitch = 0; }],
    ['inconsistent box', state => { state.source_state.chart.nodes[0].bbox[2] += 1; }],
    ['unbound link endpoint', state => { state.source_state.chart.links[0].to = [999, 999]; }],
    ['nonfinite coordinate', state => { state.source_state.position[0] = Number.NaN; }],
    ['malformed boundary pixels', state => {
      state.source_state.views = { '[22, 10]': { '4': { pixels: null, observation_ref: 'native-contract:invalid', edge: '[22, 10]>[34, 10]' } } };
    }],
    ['negative boundary pixel', state => {
      state.source_state.views = { '[22, 10]': { '4': { pixels: [[-1, 0]], observation_ref: 'native-contract:invalid', edge: '[22, 10]>[34, 10]' } } };
    }],
    ['non-JSON leaf', state => { state.source_state.last = { invalid: undefined }; }],
  ];
  for (const [name, corrupt] of corruptions) {
    const supplied = copy(saved); corrupt(supplied);
    assert.throws(() => owner.restoreNative(supplied), TypeError, name);
    assert.deepEqual(owner.state(), original, name); assert.equal(owner.nativeState(), saved, name);
    assert.equal(owner.nativeRevision, revision, name);
  }
  let getterReads = 0;
  const accessor = copy(saved);
  Object.defineProperty(accessor.source_state.chart, 'nodes', { enumerable: true, configurable: true,
    get: () => { getterReads++; throw new Error('An ingress accessor must never execute'); } });
  assert.throws(() => owner.restoreNative(accessor), TypeError); assert.equal(getterReads, 0);
  assert.deepEqual(owner.state(), original); assert.equal(owner.nativeState(), saved);
});

test('Chart source restoration is partial over all fourteen fields and rejects malformed updates before mutation', async () => {
  const owner = await measured(), original = owner.state(), partial = { evidence: ['native-contract:retained'], last: { stage: 'saved' } };
  owner.restore({ ...partial, unknown_source_field: 'ignored' });
  const expected = { ...original, ...copy(partial) };
  assert.deepEqual(owner.state(), expected); assert.deepEqual(Object.keys(owner.state()).sort(), [...fields].sort());
  partial.evidence.push('native-contract:caller-mutation'); partial.last.stage = 'changed';
  assert.deepEqual(owner.state(), expected);
  for (const invalid of [{ positions: [[1]] }, { chart: {} }, { chart: { ...original.chart, slots: [] } }, { position: [1, false] }]) {
    assert.throws(() => owner.restore(invalid), TypeError);
    assert.deepEqual(owner.state(), expected);
  }
  const repeated = Array.from({ length: 33 }, () => copy(original.position));
  owner.restore({ positions: repeated });
  assert.equal(owner.positions.length, 33, 'A source offer bound must not become an invented restoration limit');
});

test('Chart source-fact retention remains distinct from its complete native checkpoint', async () => {
  const owner = await ChartNavigation.create();
  owner.restore({ last: { status: 'native-contract:last-only' } });
  assert.equal(owner.sourceStateShouldPersist(), false);
  const saved = owner.nativeState() as R;
  assert.equal(saved.source_state.last.status, 'native-contract:last-only');
  owner.chart = {};
  assert.equal(owner.sourceStateShouldPersist(), false, 'The source predicate uses Python truthiness even for an empty working mapping');
  assert.throws(() => owner.nativeState(), TypeError, 'An empty chart cannot cross native checkpoint ingress');
  owner.restoreNative(saved);
  assert.equal(owner.chart, null); assert.equal(owner.sourceStateShouldPersist(), false);
  owner.current(cold.observation, cold.rows);
  assert.equal(owner.sourceStateShouldPersist(), true);
});

test('Chart pre-abort leaves source state untouched and its detached refusal expires with observation or retry', async () => {
  const owner = await ChartNavigation.create(), original = owner.state(), controller = new AbortController();
  controller.abort();
  assert.equal(await owner.propose(cold.observation, cold.rows, [], 8, { ...execution, signal: controller.signal }), null);
  assert.deepEqual(owner.state(), original); assertNoAcquisition(owner);
  const refusal = owner.currentProposalRefusal(cold.observation) as R;
  assert.equal(refusal.native_search_incomplete.reason, 'native_abort');
  assert.equal(refusal.release_authority, false); assert.equal(refusal.status_is_not_an_acquired_refutation, true);
  refusal.native_search_incomplete.frontier.phase = 'external-mutation';
  assert.notEqual((owner.currentProposalRefusal(cold.observation) as R).native_search_incomplete.frontier.phase, 'external-mutation');
  for (const observation of [
    { ...cold.observation, observation_ref: 'native-contract:other' },
    { ...cold.observation, frame_hash: 'native-contract:other-hash' },
    { ...cold.observation, level_epoch: cold.observation.level_epoch + 1 },
  ]) assert.equal(owner.currentProposalRefusal(observation), null);
  assert.ok(await owner.propose(cold.observation, cold.rows, [], 8, execution));
  assert.equal(owner.currentProposalRefusal(cold.observation), null); assertNoAcquisition(owner);
});

test('Chart an already reached deadline prevents geometry and SRC without persisting scheduling context', async () => {
  const owner = await ChartNavigation.create(), original = owner.state();
  let measuredCalls = 0, decisionCalls = 0;
  const current = owner.current.bind(owner), choose = owner.policy.choose.bind(owner.policy);
  owner.current = (...args) => { measuredCalls++; return current(...args); };
  owner.policy.choose = async (...args) => { decisionCalls++; return choose(...args); };
  assert.equal(await owner.propose(cold.observation, cold.rows, [], 8, { ...execution, now: () => 100 }), null);
  assert.equal(measuredCalls, 0); assert.equal(decisionCalls, 0);
  assert.deepEqual(owner.state(), original); assertNoAcquisition(owner);
  assert.equal((owner.currentProposalRefusal(cold.observation) as R).native_search_incomplete.reason, 'native_deadline');
  assert.deepEqual(Object.keys(owner.nativeState() as R).sort(), ['format', 'source_state']);
  assert.deepEqual(Object.keys((owner.nativeState() as R).source_state).sort(), [...fields].sort());
});

test('Chart deadline reached during measurement withholds source selection without converting measurement into acquisition', async () => {
  const owner = await ChartNavigation.create(); let now = 0, decisionCalls = 0;
  const offers = owner.offers.bind(owner), choose = owner.policy.choose.bind(owner.policy);
  owner.offers = (...args) => { const result = offers(...args); assert.ok(result.length); now = 100; return result; };
  owner.policy.choose = async (...args) => { decisionCalls++; return choose(...args); };
  assert.equal(await owner.propose(cold.observation, cold.rows, [], 8, { ...execution, now: () => now }), null);
  assert.equal(decisionCalls, 0); assert.ok(owner.chart); assertNoAcquisition(owner);
  const refusal = owner.currentProposalRefusal(cold.observation) as R;
  assert.equal(refusal.native_search_incomplete.reason, 'native_deadline');
  assert.equal(refusal.native_search_incomplete.frontier.phase, 'before_source_selection');
});

test('Chart an abort during the actual SRC selection cannot release its resulting proposal', async () => {
  const owner = await ChartNavigation.create(), controller = new AbortController(); let decisions = 0;
  const choose = owner.policy.choose.bind(owner.policy);
  owner.policy.choose = async (...args) => { const result = await choose(...args); decisions++; controller.abort(); return result; };
  assert.equal(await owner.propose(cold.observation, cold.rows, [], 8, { ...execution, signal: controller.signal }), null);
  assert.equal(decisions, 1); assertNoAcquisition(owner);
  const refusal = owner.currentProposalRefusal(cold.observation) as R;
  assert.equal(refusal.native_search_incomplete.reason, 'native_abort');
  assert.equal(refusal.native_search_incomplete.frontier.phase, 'source_selection_completed');
});

test('Chart native entry admits only its original group and subquestion', async () => {
  const owner = await ChartNavigation.create(), original = owner.state();
  for (const [group, question] of [['goal_access', 'chart_navigation'], ['factored_material_return', 'region_intervention']]) {
    await assert.rejects(() => owner.proposeInSubquestion(group!, question!, cold.observation, cold.rows, [], 8, execution),
      /Unknown chart-navigation source entry/);
    assert.deepEqual(owner.state(), original);
  }
  const proposal = await owner.proposeInSubquestion('factored_material_return', 'chart_navigation',
    cold.observation, cold.rows, [], 8, execution) as R;
  assert.ok(proposal); assert.equal(proposal.kind, 'public_chart_navigation');
  assert.equal(proposal.material_access_subquestion, 'chart_navigation');
  assert.equal(proposal.chart_plan.workflow.workflow, 'v6.chart_navigation.choose');
  assert.equal(proposal.chart_plan.choice.release_authority, false); assertNoAcquisition(owner);
});
