import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { BranchRouting } from '../src/logos-engine/v6-branch-routing.ts';
import { createNativeV6Runtime } from '../src/logos-engine/v6-native-runtime.ts';
import type { NativeV6Declarations } from '../src/logos-engine/v6-native-runtime.ts';
import { ObservedInputDomain } from '../src/logos-engine/v6-native-observer.ts';
import type { NativeExecution, NativeFamily, NativeObservation, NativeProposal, NativePublicObservation, NativeRuntimeYield } from '../src/logos-engine/v6-native-types.ts';

type R = Record<string, any>;
const OWNER = 'branch_routing';
const EPISODE = 'common-observation-frontier';
const reference = new URL('../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/', import.meta.url);
const declarations = {
  common: JSON.parse(await readFile(new URL('laya_proto/common_frontier_policy.drm.json', reference), 'utf8')),
  strategy: JSON.parse(await readFile(new URL('morphology_policy/strategy.drm', reference), 'utf8')),
} as NativeV6Declarations;
const fixture = JSON.parse(await readFile(new URL('./fixtures/v6-branch-routing-reference.json', import.meta.url), 'utf8')) as R;
const copy = <T>(value: T): T => structuredClone(value);
const budgets = { targetLevels: 3, levelActionCaps: [24, 24, 24], maxActions: 72 };
const singleId = 'cold_four_calibrations_move_propagate_epoch';
const tripleId = 'cold_equal_cost_select_first_point_bind_move';
const packet = (name: string, step: number): NativePublicObservation => ({ ...copy(fixture.frames[name].public), step_index: step });
const scenario = (id: string): R => {
  const value = fixture.scenarios.find((row: R) => row.id === id);
  assert.ok(value, `Missing independent original scenario ${id}`);
  return value;
};
const sourceRecords = (id: string): R[] => scenario(id).steps.filter((step: R) => step.operation === 'record');

/** These sessions feed only independently constructed public rasters into the
 * production factory. No component snapshot, motion, model or proposal is
 * installed to manufacture a cold acquisition. Source observation references
 * are rebound to the actual common observer; all event/state fields survive. */
async function harness(name: string, now: () => number = () => 0) {
  const runtime = await createNativeV6Runtime(declarations, { now }), internal = runtime as unknown as R;
  const owners = (internal.families as NativeFamily[]).filter(item => item.id === OWNER);
  assert.equal(owners.length, 1, 'One registered owner must serve the source entry');
  const owner = owners[0]!, records: R[] = [], beforeCalls: R[] = [], afterCalls: R[] = [];
  const execution: NativeExecution = { now, deadlineMs: 900_000, yieldControl: async () => {} };
  const record = owner.record.bind(owner), before = owner.before.bind(owner), after = owner.after.bind(owner);
  owner.record = async (...args) => {
    const ownerBefore = owner.state();
    const result = await record(...args);
    records.push({ before: copy(args[0]), after: copy(args[1]), command: copy(args[2]), index: args[6],
      mode: args[5].steps?.[args[6]]?.mode, result: copy(result), ownerBefore, ownerAfter: owner.state() });
    return result;
  };
  owner.before = async (...args) => {
    const result = await before(...args);
    beforeCalls.push({ index: args[1], packet: copy(args[2]), observation: copy(args[3]), result: copy(result) });
    return result;
  };
  owner.after = async (...args) => {
    const result = await after(...args);
    afterCalls.push({ index: args[1], before: copy(args[2]), after: copy(args[3]), result: copy(result) });
    return result;
  };
  assert.deepEqual(owner.state(), new BranchRouting().state());
  return { name, runtime, internal, owner, execution, records, beforeCalls, afterCalls, references: new Map<string, string>() };
}
type Session = Awaited<ReturnType<typeof harness>>;

function remember(session: Session, name: string, actual: string): void {
  const source = fixture.frames[name].observation.observation_ref;
  const previous = session.references.get(source);
  assert.ok(previous === undefined || previous === actual, `One actual observation for ${name}`);
  session.references.set(source, actual);
}
function rebound(value: any, references: Map<string, string>): any {
  if (typeof value === 'string' && value.startsWith('O_synthetic_branches_')) {
    assert.ok(references.has(value), `Unwitnessed original observation ${value}`);
    return references.get(value);
  }
  if (Array.isArray(value)) return value.map(item => rebound(item, references));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, rebound(item, references)]));
  return value;
}
function sourceFacts(session: Session, key: string): R[] {
  return session.internal.knowledge.stateValue('reasoning:memory').facts
    .map((id: string) => session.internal.knowledge.stateValue(id)).filter((fact: R) => fact.key === key);
}
function released(result: NativeRuntimeYield, mode: string, command: R): void {
  assert.equal(result.kind, 'action', result.reason ?? 'The real caller did not release the branch question');
  assert.equal(result.snapshot.lastDecision, OWNER); assert.deepEqual(result.command, command);
  assert.ok(result.authorization);
  const proposal = result.snapshot.proposal as R;
  assert.equal(proposal.kind, 'parallel_branch_routing');
  assert.equal(proposal.material_access_subquestion, 'parallel_branch_routing');
  assert.equal(proposal.steps[result.authorization.action_index].mode, mode);
  assert.equal(proposal.bundle_template.operation_key, 'OP18');
  assert.equal(proposal.compositions[0].observed, false);
  assert.equal(proposal.strategy_receipt.selected, 'factored_material_return');
  assert.equal((result.snapshot.whyAct as R).decision.decision.status, 'action_set_released');
  assert.equal((result.snapshot.srcDecision as R).workflow, 'v6.composition_strategy.choose');
  assert.equal(result.snapshot.levelsCompleted, 0, 'Synthetic geometry does not establish an official solved level');
}
async function returned(session: Session, result: NativeRuntimeYield, row: R): Promise<NativeRuntimeYield> {
  assert.ok(result.command); assert.ok(result.authorization);
  remember(session, row.before, result.authorization.observation_ref);
  const next = await session.runtime.advance({ command: result.command,
    observation: packet(row.after, result.snapshot.actions + 1), executionMs: 0 }, session.execution);
  const transition = (next.snapshot.trace as R[]).findLast(item => item.kind === 'actual_outcome');
  assert.ok(transition); remember(session, row.after, transition.observation_ref);
  return next;
}
function acquired(session: Session, row: R, actual: R = session.records.at(-1)!): void {
  assert.ok(actual);
  assert.deepEqual(actual.result, { events: [rebound(row.result, session.references)] }, 'The complete source event is acquired');
  assert.deepEqual(actual.ownerAfter, rebound(row.afterState, session.references), 'The complete original acquired state survives the adapter');
  const key = `branches:${actual.before.revision}`;
  assert.deepEqual(session.internal.authority.memory.get(EPISODE, key).value, actual.result.events[0]);
  assert.equal(sourceFacts(session, key).length, 1, 'One selected return has one source acquisition key');
}
function checkpointed(session: Session): void {
  assert.deepEqual(session.internal.knowledge.stateValue(`family_state:${OWNER}`), session.owner.state(),
    'The actual common graph retains the complete owner');
}
async function fourCalibrations(session: Session, id = singleId): Promise<NativeRuntimeYield> {
  const selected = scenario(id), rows = sourceRecords(id).slice(0, 4);
  assert.equal(selected.initialStateOrigin.kind, 'cold_original_constructor');
  let result = await session.runtime.initialize({ sessionId: session.name, observation: packet(rows[0]!.before, 0), budgets }, session.execution);
  for (let index = 0; index < rows.length; index++) {
    released(result, 'calibrate', { action_ref: `ACTION${index + 1}` });
    assert.equal(session.records.length, index, 'Proposal, binding and authorization do not acquire a return');
    result = await returned(session, result, rows[index]!);
    assert.equal(result.kind, 'boundary', result.reason ?? 'Calibration must seal');
    assert.equal(session.records.length, index + 1); acquired(session, rows[index]!); checkpointed(session);
    assert.deepEqual((result.snapshot.whyAct as R).analysis.map((item: R) => item.operation), ['OP29', 'OP30', 'OP31']);
    if (index + 1 < rows.length) result = await session.runtime.resume(session.execution);
  }
  return result;
}

test('the production factory registers one cold branch owner at its exact source material entry', async () => {
  const session = await harness('branch-common-registration');
  try {
    assert.equal(fixture.inputOrigin.kind, 'independently_constructed_contract_geometry');
    assert.equal(fixture.inputOrigin.gamePayloadsInterpreted, 0); assert.equal(fixture.inputOrigin.gameActionsDispatched, 0);
    const coverage = session.runtime.snapshot().coverage as R;
    const group = coverage.sourceGroups.find((item: R) => item.id === 'factored_material_return');
    const index = group.families.indexOf(OWNER);
    assert.deepEqual(group.families.slice(index - 1, index + 2), ['motif_access', OWNER, 'band_transfer']);
    assert.equal(group.entryPoints[index], null, 'The direct source owner is not evaluated a second time as a caller subentry');
    assert.equal(coverage.registeredFamilies.filter((id: string) => id === OWNER).length, 1);
    assert.equal(coverage.fullV6Parity, false);
    assert.equal(session.records.length, 0);
  } finally { session.runtime.close('branch-common-registration-complete'); }
});

test('cold common acquisition restores its four measured controls before move and propagation', async () => {
  const session = await harness('branch-common-cold-restoration');
  try {
    await fourCalibrations(session);
    const retained = session.owner.state();
    assert.deepEqual(retained.motion, { ACTION1: [0, -2], ACTION2: [0, 2], ACTION3: [-2, 0], ACTION4: [2, 0] });
    session.owner.restore(new BranchRouting().state());
    assert.deepEqual(session.owner.state(), new BranchRouting().state());
    let result = await session.runtime.resume(session.execution);
    released(result, 'move', { action_ref: 'ACTION1' });
    assert.deepEqual(session.owner.state(), retained, 'The common graph, not a new physical acquisition, restores the owner');
    assert.equal(session.records.length, 4);
    result = await returned(session, result, sourceRecords(singleId)[4]!);
    assert.equal(result.kind, 'boundary'); assert.equal(session.records.length, 5);
    acquired(session, sourceRecords(singleId)[4]!); checkpointed(session);
    result = await session.runtime.resume(session.execution);
    released(result, 'propagate', { action_ref: 'ACTION5' });
    result = await returned(session, result, sourceRecords(singleId)[5]!);
    assert.equal(result.kind, 'boundary'); assert.equal(result.snapshot.actions, 6);
    assert.equal(session.records.length, 6); acquired(session, sourceRecords(singleId)[5]!); checkpointed(session);
    assert.equal(session.owner.state().finished, true);
    assert.deepEqual(session.owner.state().passed, []);
    assert.equal(result.snapshot.levelsCompleted, 0, 'A propagation return without score remains an unproved outcome');
  } finally { session.runtime.close('branch-common-cold-restoration-complete'); }
});

test('the common point guard binds selection, then rechecks and acquires a two-action move only at seal', async () => {
  const session = await harness('branch-common-selection-prefix');
  try {
    await fourCalibrations(session, tripleId);
    let result = await session.runtime.resume(session.execution);
    // The component corpus deliberately supplied (7,13) first. The ordinary
    // caller samples the centroid witness (6,13) inside the same public bar.
    // This is a common-input-domain proof, not an exact replay of that manual list.
    released(result, 'select', { action_ref: 'ACTION6', data: { x: 6, y: 13 } });
    const proposal = result.snapshot.proposal as NativeProposal, step = proposal.steps![0] as R;
    assert.deepEqual(step.box, [6, 12, 7, 15]);
    assert.deepEqual(step.point_binding.point, [6, 13]);
    assert.deepEqual(step.point_binding.projection_bbox, step.box);
    assert.equal(step.point_binding.observation_ref, result.authorization!.observation_ref);
    assert.equal(step.point_binding.projected_rows_digest, scenario(tripleId).steps[8].result.steps[0].point_digest);
    const current = copy(session.internal.current) as NativePublicObservation;
    const observation = copy(session.internal.observation) as NativeObservation;
    assert.equal(await ObservedInputDomain.pointGuard(current, result.command!, step), true);
    assert.equal((await session.owner.before(proposal, 0, current, observation)).admitted, true);
    // Counterfactual guard probes never enter acquisition or alter the live packet.
    for (const [label, publicPatch, observationPatch] of [
      ['epoch', { level: current.level + 1 }, {}],
      ['score', { levels_completed: current.levels_completed + 1 }, {}],
      ['command', { available_action_refs: current.available_action_refs.filter(value => value !== 'ACTION6') }, {}],
      ['reference', {}, { observation_ref: observation.observation_ref + ':stale' }],
      ['other-contributor-pose', { frame_rows: packet('triple_west', 4).frame_rows }, {}],
    ] as [string, R, R][]) {
      assert.equal((await session.owner.before(proposal, 0, { ...current, ...publicPatch }, { ...observation, ...observationPatch })).admitted, false, label);
    }
    const changedRows = current.frame_rows.map(row => [...row]); changedRows[13]![6] = 0;
    assert.equal(await ObservedInputDomain.pointGuard({ ...current, frame_rows: changedRows }, result.command!, step), false,
      'The real bound projection must still match, even if a supplied frame hash is unchanged');
    assert.equal(session.records.length, 4);
    result = await returned(session, result, sourceRecords(tripleId)[4]!);
    assert.equal(result.kind, 'boundary'); assert.equal(session.records.length, 5); acquired(session, sourceRecords(tripleId)[4]!);
    result = await session.runtime.resume(session.execution);
    released(result, 'move', { action_ref: 'ACTION1' });
    assert.equal((result.snapshot.proposal as R).actions.length, 2);
    const revision = result.authorization!.decision_revision, retained = session.owner.state();
    result = await returned(session, result, sourceRecords(tripleId)[5]!);
    released(result, 'move', { action_ref: 'ACTION1' });
    assert.equal(result.authorization!.decision_revision, revision); assert.equal(result.authorization!.action_index, 1);
    assert.equal(session.records.length, 5, 'The unsealed prefix has no early acquisition');
    assert.deepEqual(session.owner.state(), retained);
    const currentGuard = session.beforeCalls.at(-1)!;
    assert.equal(currentGuard.index, 1); assert.equal(currentGuard.result.admitted, true);
    assert.equal(currentGuard.observation.observation_ref, result.authorization!.observation_ref);
    result = await returned(session, result, sourceRecords(tripleId)[6]!);
    assert.equal(result.kind, 'boundary'); assert.equal(result.snapshot.actions, 7); assert.equal(session.records.length, 7);
    acquired(session, sourceRecords(tripleId)[5]!, session.records[5]!);
    acquired(session, sourceRecords(tripleId)[6]!, session.records[6]!); checkpointed(session);
    result = await session.runtime.resume(session.execution);
    released(result, 'propagate', { action_ref: 'ACTION5' });
    assert.equal(session.records.length, 7, 'The next proposal does not reacquire either move');
  } finally { session.runtime.close('branch-common-selection-prefix-complete'); }
});

test('a contrary current move revises acquired motion and changes the next common question', async () => {
  const session = await harness('branch-common-contrary-return');
  try {
    await fourCalibrations(session);
    let result = await session.runtime.resume(session.execution);
    released(result, 'move', { action_ref: 'ACTION1' });
    const row = sourceRecords('contrary_measured_move_revises_motion')[0]!;
    result = await returned(session, result, row);
    assert.equal(result.kind, 'boundary'); assert.equal(session.records.length, 5); acquired(session, row); checkpointed(session);
    assert.equal(session.afterCalls.at(-1)!.result.matched, false);
    assert.deepEqual(session.owner.state().motion, { ACTION1: [0, 2], ACTION2: [0, 2], ACTION3: [-2, 0], ACTION4: [2, 0] });
    result = await session.runtime.resume(session.execution);
    released(result, 'calibrate', { action_ref: 'ACTION5' });
    assert.equal(session.records.length, 5);
    // ACTION5 is also the positive route's propagation key. The observed contrary
    // return changes its actual question and unknown-effect guard, not its name.
    assert.notEqual((result.snapshot.proposal as R).steps[0].mode, 'propagate');
    assert.equal((result.snapshot.proposal as R).steps[0].expected_after, null);
  } finally { session.runtime.close('branch-common-contrary-return-complete'); }
});

test('removing only selected branch acquisition prevents the cold response from becoming a learned control', async () => {
  const session = await harness('branch-common-acquisition-ablation'); let omitted = 0;
  // Explicit diagnostic ablation. The factory, selection, public returns and
  // guards remain real; this case deliberately omits the selected owner effect.
  session.owner.record = () => { omitted++; return { events: [] }; };
  try {
    let result = await session.runtime.initialize({ sessionId: session.name, observation: packet('base', 0), budgets }, session.execution);
    released(result, 'calibrate', { action_ref: 'ACTION1' });
    const revision = session.internal.observation.revision;
    result = await returned(session, result, sourceRecords(singleId)[0]!);
    assert.equal(result.kind, 'boundary'); assert.equal(omitted, 1); assert.equal(session.records.length, 0);
    assert.deepEqual(session.owner.state().motion, {}); assert.deepEqual(session.owner.state().events, []);
    assert.equal(session.internal.authority.memory.get(EPISODE, `branches:${revision}`).value, null);
    result = await session.runtime.resume(session.execution);
    released(result, 'calibrate', { action_ref: 'ACTION1' });
    assert.equal(omitted, 1); assert.deepEqual(session.owner.state().motion, {});
    assert.equal(result.snapshot.levelsCompleted, 0);
  } finally { session.runtime.close('branch-common-acquisition-ablation-complete'); }
});

test('an incomplete real branch proposal blocks later source entries without action authority', async () => {
  const session = await harness('branch-common-proposal-incomplete');
  const propose = session.owner.propose.bind(session.owner);
  const lower = (session.internal.families as NativeFamily[]).find(item => item.id === 'band_transfer')!;
  const lowerPropose = lower.propose.bind(lower); let lowerCalls = 0, boundedCalls = 0;
  lower.propose = (...args) => { lowerCalls++; return lowerPropose(...args); };
  // Native scheduling counterfactual only: no fabricated provider result, model,
  // acquired state or public geometry. The actual bounded owner must abstain.
  session.owner.propose = (observation, rows, inputs, remaining, execution) => {
    boundedCalls++;
    return propose(observation, rows, inputs, remaining, { ...execution,
      yieldControl: execution?.yieldControl ?? session.execution.yieldControl, now: () => 0, deadlineMs: 0 });
  };
  try {
    const result = await session.runtime.initialize({ sessionId: session.name, observation: packet('base', 0), budgets }, session.execution);
    assert.equal(result.kind, 'stopped'); assert.equal(result.reason, 'frontier_unknown');
    assert.equal(result.command, null); assert.equal(result.authorization, null); assert.equal(result.snapshot.actions, 0);
    assert.equal(boundedCalls, 1); assert.equal(lowerCalls, 0); assert.equal(session.records.length, 0);
    const row = (result.snapshot.trace as R[]).findLast(item => item.kind === 'native_proposal_refusal' && item.family === OWNER);
    assert.ok(row); assert.equal(row.refusal.status, 'unknown'); assert.equal(row.refusal.reached_bound, 'deadline');
    assert.equal(row.refusal.release_authority, false); assert.equal(row.refusal.block_unrelated_probe, true);
    assert.equal(row.refusal.frontier.complete, false);
    assert.equal(row.refusal.observation_ref, session.internal.observation.observation_ref);
    assert.deepEqual(session.owner.state().events, []); assert.deepEqual(session.owner.state().motion, {});
  } finally { session.runtime.close('branch-common-proposal-incomplete-complete'); }
});

test('the common adapter isolates all proposal inputs before a component await', async () => {
  const session = await harness('branch-common-stable-inputs');
  const original = BranchRouting.prototype.propose;
  let release!: () => void;
  const waiting = new Promise<void>(resolve => { release = resolve; });
  let received: Parameters<BranchRouting['propose']> | null = null;
  // Explicit adapter instrumentation introduces a deterministic await at the
  // component boundary; the real component then evaluates the retained inputs.
  BranchRouting.prototype.propose = function (this: BranchRouting, ...args) {
    received = args;
    return waiting.then(() => original.apply(this, args));
  };
  const observation = copy(fixture.frames.base.observation), rows = copy(fixture.frames.base.public.frame_rows), inputs = copy(fixture.frames.base.inputs);
  const initial = copy({ observation, rows, inputs });
  let pending: ReturnType<NativeFamily['propose']> | undefined;
  try {
    pending = session.owner.propose(observation, rows, inputs, 16, session.execution);
    assert.ok(received);
    const captured = received as Parameters<BranchRouting['propose']>;
    assert.notStrictEqual(captured[0], observation); assert.notStrictEqual(captured[1], rows); assert.notStrictEqual(captured[2], inputs);
    const frozen = (value: any): void => {
      if (!value || typeof value !== 'object') return;
      assert.equal(Object.isFrozen(value), true);
      for (const child of Object.values(value)) frozen(child);
    };
    frozen(captured[0]); frozen(captured[1]); frozen(captured[2]);
    observation.frame_hash = 'externally-mutated'; observation.entities.length = 0;
    rows[6][8] = 0; inputs.splice(0, inputs.length);
    assert.deepEqual({ observation: captured[0], rows: captured[1], inputs: captured[2] }, initial);
    release(); const proposal = await pending;
    assert.ok(proposal); assert.deepEqual(proposal.actions, [{ action_ref: 'ACTION1' }]);
    assert.equal(proposal.material_access_subquestion, 'parallel_branch_routing');
    assert.equal((proposal.binding as R).observation_ref, initial.observation.observation_ref);
    assert.deepEqual(session.owner.state().events, [], 'Input isolation itself is not acquisition');
  } finally {
    release();
    if (pending) await Promise.resolve(pending).catch(() => {});
    BranchRouting.prototype.propose = original;
    session.runtime.close('branch-common-stable-inputs-complete');
  }
});

test('an expired selected acquisition retains both real move returns and never acquires a suffix across the gap', async () => {
  let clockMs = 0;
  const session = await harness('branch-common-incomplete-prefix', () => clockMs);
  try {
    await fourCalibrations(session, tripleId);
    let result = await session.runtime.resume(session.execution);
    released(result, 'select', { action_ref: 'ACTION6', data: { x: 6, y: 13 } });
    result = await returned(session, result, sourceRecords(tripleId)[4]!);
    assert.equal(result.kind, 'boundary'); assert.equal(session.records.length, 5);
    result = await session.runtime.resume(session.execution);
    released(result, 'move', { action_ref: 'ACTION1' });
    const selected = copy(result), ownerBefore = session.owner.state();
    const actualAfter = session.owner.after.bind(session.owner); let expirations = 0;
    session.owner.after = async (...args) => {
      const outcome = await actualAfter(...args);
      if (args[1] === 1) {
        assert.equal(outcome.matched, true); assert.equal(outcome.seal_prefix, true);
        assert.equal(clockMs, 0); clockMs = 360_001; expirations++;
      }
      return outcome;
    };
    result = await returned(session, result, sourceRecords(tripleId)[5]!);
    released(result, 'move', { action_ref: 'ACTION1' });
    assert.equal(session.records.length, 5); assert.deepEqual(session.owner.state(), ownerBefore);
    result = await returned(session, result, sourceRecords(tripleId)[6]!);
    assert.equal(expirations, 1); assert.ok(clockMs < session.execution.deadlineMs!);
    assert.equal(result.kind, 'stopped'); assert.equal(result.reason, 'native_acquisition_incomplete');
    assert.equal(result.command, null); assert.equal(result.authorization, null);
    assert.equal(result.snapshot.actions, 7); assert.equal((result.snapshot.caller as R).acquiredTransitions, 7);
    assert.equal(session.records.length, 6, 'Only the first unacquired return reaches record; its suffix remains pending');
    assert.equal(session.records.at(-1)!.result.native_acquisition_incomplete, true);
    assert.deepEqual(session.records.at(-1)!.result.events, []);
    assert.deepEqual(session.owner.state(), ownerBefore, 'An expired identity search makes no owner acquisition mutation');
    checkpointed(session);
    const evidenceId = `prefix_evidence:${selected.authorization!.decision_revision}`;
    const evidence = session.internal.knowledge.stateValue(evidenceId);
    assert.deepEqual(evidence.proposal, selected.snapshot.proposal);
    const incomplete = evidence.native_acquisitions_incomplete.filter((item: R) => item.family === OWNER) as R[];
    assert.equal(incomplete.length, 2);
    const actual = session.afterCalls.slice(-2);
    const frames = ['triple_selected', 'triple_moved', 'triple_aligned'];
    for (let index = 0; index < incomplete.length; index++) {
      const item = incomplete[index]!, observed = actual[index]!;
      assert.equal(item.mode, 'selected'); assert.equal(item.acquired, false); assert.equal(item.release_authority, false);
      assert.equal(item.proposal_ref, evidenceId); assert.equal(item.continuation, 'terminal_stop_without_automatic_reacquisition');
      assert.equal(item.before, observed.before.observation_ref); assert.equal(item.after, observed.after.observation_ref);
      assert.deepEqual(item.command, { action_ref: 'ACTION1' });
      assert.deepEqual(item.public_transition, { command: { action_ref: 'ACTION1' }, before: observed.before, after: observed.after,
        first: packet(frames[index]!, 5 + index), second: packet(frames[index + 1]!, 6 + index), index, outcome: observed.result },
        'The durable receipt keeps complete public packets, measured observations and the unchanged guard outcome');
      assert.equal(item.refusal.status, 'unknown'); assert.equal(item.refusal.release_authority, false);
      assert.equal(item.refusal.frontier.complete, false); assert.equal(item.refusal.observation_ref, observed.after.observation_ref);
      assert.equal(item.refusal.level_epoch, observed.after.level_epoch); assert.equal(item.refusal.frame_hash, observed.after.frame_hash);
      assert.deepEqual(sourceFacts(session, `branches:${observed.before.revision}`), [], 'No source event or selected-null event is fabricated');
    }
    assert.equal(incomplete[0]!.refusal.reason, 'branch_routing_acquisition_incomplete');
    assert.equal(incomplete[0]!.refusal.source_record_attempted, true); assert.equal(incomplete[0]!.refusal.reached_bound, 'deadline');
    assert.equal(incomplete[0]!.refusal.search_phase, 'identity'); assert.equal(incomplete[0]!.refusal.examined, 0);
    assert.equal(incomplete[1]!.refusal.reason, 'earlier_selected_acquisition_incomplete');
    assert.equal(incomplete[1]!.refusal.source_record_attempted, false);
    assert.deepEqual(incomplete[1]!.refusal.blocked_by, { observation_ref: actual[0]!.after.observation_ref, index: 0 });
    assert.deepEqual((result.snapshot.trace as R[]).filter(item => item.kind === 'native_acquisition_incomplete' && item.family === OWNER)
      .map(({ kind: _kind, ...item }) => item), incomplete);
    const resumed = await session.runtime.resume(session.execution);
    assert.equal(resumed.kind, 'stopped'); assert.equal(resumed.reason, 'native_acquisition_incomplete');
    assert.equal(resumed.command, null); assert.equal(resumed.authorization, null); assert.equal(session.records.length, 6);
    assert.deepEqual(session.owner.state(), ownerBefore);
    assert.deepEqual(session.internal.knowledge.stateValue(evidenceId).native_acquisitions_incomplete.filter((item: R) => item.family === OWNER), incomplete);
    assert.equal(resumed.snapshot.levelsCompleted, 0);
  } finally { session.runtime.close('branch-common-incomplete-prefix-complete'); }
});
