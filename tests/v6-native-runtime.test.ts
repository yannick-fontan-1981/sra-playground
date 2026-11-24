import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createNativeV6Runtime, NativeV6Runtime } from '../src/logos-engine/v6-native-runtime.ts';
import type { NativeV6Declarations } from '../src/logos-engine/v6-native-runtime.ts';
import { nativeProgramDescriptions } from '../src/logos-engine/v6-src-program.ts';
import { V6AgentService } from '../src/runtime/v6-agent-service.ts';
import { BrowserV6Agent } from '../src/runtime/v6-agent.ts';
import { defaultRecoveryPack } from '../src/sic/active-recovery.ts';
import { createSicFramedContact, learnPatternAccessId } from '../src/sic/framed-contact.ts';
import { standalonePlanningFamilies } from '../src/sic/standalone-families.ts';
import type { GameObservation } from '../src/runtime/browser-games.ts';
import { emptyV6Snapshot, toV6PublicObservation, V6_REFERENCE_COMMIT, v6FrameHash } from '../src/runtime/v6-agent-protocol.ts';
import type { V6AgentOperation, V6AgentTransport } from '../src/runtime/v6-agent-protocol.ts';
import { sicObservedGameOver } from '../src/logos-engine/v6-native-types.ts';
import type {
  NativeCommand, NativeExecution, NativeFamily, NativeInitialize, NativeOutcome, NativePublicObservation,
  NativeRuntimeSnapshot, NativeRuntimeYield, NativeV6Backend,
} from '../src/logos-engine/v6-native-types.ts';

const source = new URL('../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/', import.meta.url);
const declarations = {
  common: JSON.parse(await readFile(new URL('laya_proto/common_frontier_policy.drm.json', source), 'utf8')),
  strategy: JSON.parse(await readFile(new URL('morphology_policy/strategy.drm', source), 'utf8')),
} as NativeV6Declarations;
const ordered = JSON.parse(await readFile(new URL('./fixtures/v6-ordered-support-reference.json', import.meta.url), 'utf8'));
const fields = JSON.parse(await readFile(new URL('./fixtures/v6-field-reference.json', import.meta.url), 'utf8'));

function board(pixel = 0): GameObservation {
  const frame = Array.from({ length: 64 }, () => Array<number>(64).fill(pixel));
  return { gameCode: 'PUBLIC', frame, frames: [frame], state: 'NOT_FINISHED', availableActionIds: [1, 6],
    level: 1, levelCount: 3, levelsCompleted: 0, canUndo: false, canSelectLevel: true, defaultFps: 10 };
}
function gamePacket(packet: NativePublicObservation, code: string): GameObservation {
  return { gameCode: code, frame: packet.frame_rows.map(row => [...row]), frames: packet.frame_packet.map(frame => frame.map(row => [...row])),
    state: packet.state, availableActionIds: packet.available_action_refs.map(action => Number(action.slice(6))),
    level: packet.level, levelCount: 3, levelsCompleted: packet.levels_completed, canUndo: false, canSelectLevel: true, defaultFps: 10 };
}

// The full original caller completed these three public trajectories. SEQN's
// zero-action fixture is only an isolated field-family refusal, still tested
// in v6-field-parity.test.ts. A connected common frontier is allowed to explore
// after that refusal, so it must not be forced to stop to satisfy that fixture.
for (const fixture of [ordered.session, ...fields.cases.filter((item: any) => item.levelsCompleted > 0)]) {
  test(`native SRC/service/controller replays public ${fixture.game} transitions without a Python solver`, async () => {
    // Stored-public-frame replay checks decisions, not machine scheduling.
    // The independent real-game smoke retains the production active clock.
    const service = new V6AgentService(() => createNativeV6Runtime(declarations, { now: () => 0 }));
    const operations: V6AgentOperation[] = [];
    const transport: V6AgentTransport = {
      request(operation) { operations.push(operation); return service.handle(operation); },
      reset() { assert.fail('No automatic memory reset is allowed'); }, dispose() {},
    };
    const stream = fixture.transitions.flatMap((prefix: any) => prefix.steps.map((step: any, index: number) => ({
      command: prefix.proposal.actions[index] as NativeCommand, after: step.afterPublic as NativePublicObservation,
    })));
    let index = 0, current = gamePacket(fixture.initial.public, fixture.game);
    const agent = new BrowserV6Agent({ transport, getObservation: () => current, canDispatch: () => true, onState: () => {},
      dispatch: async action => {
        const expected = stream[index];
        assert.ok(expected, 'No unobserved fixture action may be fabricated');
        assert.deepEqual({ action_ref: `ACTION${action.id}`, data: action.id === 6 ? { ...action.data } : {} }, expected.command);
        current = gamePacket(expected.after, fixture.game); index += 1;
        return { observation: current, executionMs: 0.25 };
      },
    });
    let sessionId: string | null = null;
    for (let level = 1; level <= Math.max(1, fixture.levelsCompleted); level += 1) {
      await agent.run(600);
      assert.notEqual(agent.snapshot.status, 'error', agent.snapshot.message);
      if (sessionId !== null) assert.equal(agent.snapshot.sessionId, sessionId);
      sessionId = agent.snapshot.sessionId;
      if (fixture.levelsCompleted) assert.ok(current.levelsCompleted >= level, agent.snapshot.message);
    }
    assert.equal(index, fixture.actions);
    assert.equal(agent.snapshot.actionCount, fixture.actions);
    assert.equal(agent.snapshot.actions, fixture.actions);
    assert.equal(operations.filter(operation => operation.type === 'advance').length, fixture.actions);
    assert.equal(current.levelsCompleted, fixture.levelsCompleted);
    assert.equal(agent.snapshot.sourceCommit, V6_REFERENCE_COMMIT);
    assert.match(agent.snapshot.sourceDigest, /^[a-f0-9]{64}$/);
    const snapshot = agent.snapshot as unknown as Record<string, any>;
    assert.equal(snapshot.coverage.fullV6Parity, false);
    assert.equal(snapshot.srcDecision.workflow, 'v6.composition_strategy.choose');
    assert.ok(snapshot.srcDecision.executed_statements.length > 0);
    if (!fixture.actions) assert.equal(agent.snapshot.reason, 'no_applicable_transferred_family');
  });
}

for (const scenario of [
  { fixture: fields.cases.find((item: { game: string }) => item.game === 'SYME'), actions: 9, strategies: ['test_local_repair', 'apply_local_repair'] },
  { fixture: ordered.session, actions: 6, strategies: ['transfer_exposed_member'] },
]) test(`SIC-only service earns a public ${scenario.fixture.game} level with an exclusive plan for every action`, async () => {
  const { fixture, actions, strategies } = scenario;
  const service = new V6AgentService(recovery => createNativeV6Runtime(declarations, { recovery, now: () => 0 }));
  let current = fixture.initial.public as NativePublicObservation;
  const sessionId = 'sic-only-replay';
  let result = await service.handle({ type: 'init', sessionId, sequence: 0,
    observation: toV6PublicObservation(gamePacket(current, 'UNSEEN'), 0),
    budgets: { targetLevels: 1, levelActionCaps: [600] }, recovery: { ...defaultRecoveryPack, solver: 'sic' } });
  const steps = fixture.transitions.flatMap((prefix: { steps: any[]; proposal: { actions: NativeCommand[] } }) =>
    prefix.steps.map((step, index) => ({ after: step.afterPublic, command: prefix.proposal.actions[index] })));
  let sequence = 0;
  while (current.levels_completed === 0) {
    const { after, command } = steps[sequence];
    const registered = result.snapshot.coverage?.registeredFamilies;
    assert.equal(registered?.length, standalonePlanningFamilies.length);
    assert.deepEqual(new Set(registered), new Set(standalonePlanningFamilies));
    const receipt = result.snapshot.trace.findLast(value => (value as { kind: string }).kind === 'sic_native_plan') as
      { authority: string; objective: string; subObjective: string; strategy: string };
    assert.equal(receipt.authority, 'sicOnly');
    assert.equal(receipt.objective, 'G_official_completion');
    assert.ok(receipt.subObjective);
    assert.ok(strategies.includes(receipt.strategy));
    assert.equal(result.kind, 'action');
    assert.deepEqual(result.command, { actionRef: command.action_ref, data: command.data });
    current = after;
    sequence++;
    result = await service.handle({ type: 'advance', sessionId, sequence, ticketId: result.ticket!.id,
      observation: toV6PublicObservation(gamePacket(current, 'UNSEEN'), sequence), executionMs: 0 });
    if (current.levels_completed === 0 && result.kind === 'boundary') {
      result = await service.handle({ type: 'resume', sessionId, sequence });
    }
  }
  assert.equal(sequence, actions);
  assert.equal(result.snapshot.levelsCompleted, 1);
  assert.equal(result.snapshot.sicActionCoverage?.sicOnly, actions);
  assert.equal(result.snapshot.sicActionCoverage?.native, 0);
});

test('a SIC-only session can execute a replaced SRC selection workflow at a sealed boundary', async () => {
  const fixture = fields.cases.find((item: { game: string }) => item.game === 'SYME');
  const service = new V6AgentService(recovery => createNativeV6Runtime(declarations, { recovery, now: () => 0 }));
  const sessionId = 'sic-only-src-selection';
  const first = await service.handle({ type: 'init', sessionId, sequence: 0,
    observation: toV6PublicObservation(gamePacket(fixture.initial.public, 'UNSEEN'), 0),
    budgets: { targetLevels: 1, levelActionCaps: [600] }, recovery: { ...defaultRecoveryPack, solver: 'sic' } });
  assert.equal(first.kind, 'action');
  assert.equal(first.snapshot.sicFamilySelection?.mode, 'active');
  const boundary = await service.handle({ type: 'advance', sessionId, sequence: 1, ticketId: first.ticket!.id,
    observation: toV6PublicObservation(gamePacket(fixture.transitions[0].steps[0].afterPublic, 'UNSEEN'), 1), executionMs: 0 });
  assert.equal(boundary.kind, 'boundary');

  const programId = 'v6.composition_strategy.choose';
  const module = structuredClone(nativeProgramDescriptions().find(program => program.id === programId)!.module);
  const step = module.workflows[0]!.steps[0]!;
  step.statements[1] = { ...step.statements[1]!, kind: 'STOP',
    expression: { kind: 'reference', value: 'session', arguments: [], items: [] } };
  await service.handle({ type: 'edit', sessionId, sequence: 1, edit: {
    expectedGraphChain: boundary.snapshot.graphChain!, reason: 'Test SRC abstention before consulting any SIC family',
    changes: [{ type: 'replace_program', programId, module }],
  } });
  const result = await service.handle({ type: 'resume', sessionId, sequence: 1 });
  assert.equal(result.kind, 'stopped');
  assert.equal(result.command, null);
  assert.equal(result.snapshot.sicActionCoverage?.sicOnly, 1);
  assert.equal(result.snapshot.sicActionCoverage?.native, 0);
  const receipt = result.snapshot.srcDecision as { edited: boolean; executed_statements: string[] };
  assert.equal(receipt.edited, true);
  assert.deepEqual(receipt.executed_statements, [`${programId}.open.s0000`, `${programId}.open.s0001`]);
});

class RecordingBackend implements NativeV6Backend {
  readonly sourceCommit = V6_REFERENCE_COMMIT;
  readonly sourceDigest = 'native-service-test';
  observation: NativePublicObservation | null = null;
  actions = 0;
  closes: string[] = [];
  malformed = false;
  command: NativeCommand = { action_ref: 'ACTION6', data: { x: 2, y: 3 } };
  initializeCalls = 0;
  advances: NativeOutcome[] = [];
  resumes = 0;
  snapshot(): NativeRuntimeSnapshot {
    return { ...emptyV6Snapshot(), sourceDigest: this.sourceDigest, actions: this.malformed ? 99 : this.actions,
      level: this.observation?.level ?? 1, levelsCompleted: this.observation?.levels_completed ?? 0 };
  }
  private output(kind: NativeRuntimeYield['kind']): NativeRuntimeYield {
    return { kind, reason: null, command: kind === 'action' ? this.command : null,
      authorization: kind === 'action' ? { observation_ref: 'native-current-observation', decision_revision: 1, action_index: this.actions } : null,
      snapshot: this.snapshot() };
  }
  async initialize(input: NativeInitialize): Promise<NativeRuntimeYield> {
    this.initializeCalls += 1; this.observation = input.observation; return this.output('action');
  }
  async advance(outcome: NativeOutcome): Promise<NativeRuntimeYield> {
    this.advances.push(outcome); this.observation = outcome.observation; this.actions += 1; return this.output('boundary');
  }
  async resume(): Promise<NativeRuntimeYield> { this.resumes += 1; return this.output('action'); }
  close(reason: string): void { this.closes.push(reason); }
}
function init(sessionId = 'native-test') {
  return { type: 'init' as const, sessionId, sequence: 0 as const, observation: toV6PublicObservation(board(), 0), budgets: { targetLevels: 3, levelActionCaps: [600, 600, 600] } };
}

test('native service binds one immutable ticket, preserves it on resume and burns it after the witnessed action', async () => {
  const backend = new RecordingBackend(); const service = new V6AgentService(() => backend);
  const first = await service.handle(init());
  assert.equal(first.kind, 'action'); assert.ok(first.ticket);
  assert.ok(Object.isFrozen(first.ticket)); assert.ok(Object.isFrozen(first.ticket.data));
  const resumed = await service.handle({ type: 'resume', sessionId: 'native-test', sequence: 0 });
  assert.equal(resumed.ticket, first.ticket); assert.equal(backend.resumes, 0);
  const operation = { type: 'advance' as const, sessionId: 'native-test', sequence: 1, ticketId: first.ticket.id,
    observation: toV6PublicObservation(board(1), 1), executionMs: 2.5 };
  const acquired = await service.handle(operation);
  assert.equal(acquired.kind, 'boundary'); assert.equal(acquired.snapshot.actions, 1);
  assert.deepEqual(backend.advances[0]!.command, { action_ref: 'ACTION6', data: { x: 2, y: 3 } });
  assert.equal(backend.advances[0]!.executionMs, 2.5);
  await assert.rejects(service.handle(operation), /pending authorization/);
  assert.equal(backend.advances.length, 1);
  const next = await service.handle({ type: 'resume', sessionId: 'native-test', sequence: 1 });
  assert.notEqual(next.ticket?.id, first.ticket.id); assert.equal(backend.resumes, 1);
});

test('bad outcome identity, timing and animation packets do not consume a native service authorization', async () => {
  const backend = new RecordingBackend(); const service = new V6AgentService(() => backend);
  const first = await service.handle(init());
  const base = { type: 'advance' as const, sessionId: 'native-test', sequence: 1, ticketId: first.ticket!.id,
    observation: toV6PublicObservation(board(1), 1), executionMs: 1 };
  for (const invalid of [
    { ...base, ticketId: 'old' }, { ...base, sessionId: 'other' }, { ...base, sequence: 2 }, { ...base, executionMs: NaN },
    { ...base, observation: { ...base.observation, stepIndex: 4 } },
    { ...base, observation: { ...base.observation, frames: [board(2).frame] } },
    { ...base, observation: { ...base.observation, hiddenEngine: true } },
  ]) await assert.rejects(service.handle(invalid));
  assert.equal(backend.advances.length, 0); assert.equal(backend.closes.length, 0);
  assert.equal((await service.handle(base)).snapshot.actions, 1);
});

test('a native backend state failure closes its authority and never resumes from partial evidence', async () => {
  const backend = new RecordingBackend(); const service = new V6AgentService(() => backend);
  const first = await service.handle(init()); backend.malformed = true;
  await assert.rejects(service.handle({ type: 'advance', sessionId: 'native-test', sequence: 1, ticketId: first.ticket!.id,
    observation: toV6PublicObservation(board(1), 1), executionMs: 0 }), /state does not bind/);
  assert.equal(backend.advances.length, 1); assert.deepEqual(backend.closes, ['native_runtime_error']);
  await assert.rejects(service.handle({ type: 'resume', sessionId: 'native-test', sequence: 1 }), /no longer current/);
});

test('native runtime defers family recording until a sealed prefix and ignores paused wall time', async () => {
  let clock = 0; const records: number[] = [];
  const family: NativeFamily = {
    id: 'bounded-native-test',
    propose: () => ({ status: 'proposed', kind: 'public_test', actions: [{ action_ref: 'ACTION1', data: {} }, { action_ref: 'ACTION1', data: {} }], steps: [{}, {}] }),
    before: () => ({ admitted: true, reason: 'current' }),
    after: (_proposal, index) => ({ matched: true, seal_prefix: index === 1, reason: 'witnessed' }),
    record: (_before, _after, _command, _first, _second, _proposal, index) => { records.push(index); return { events: [] }; },
    state: () => ({ recorded: [...records] }),
    restore: state => { records.splice(0, records.length, ...(state.recorded as number[])); },
  };
  const service = new V6AgentService(() => new NativeV6Runtime({ families: [family], maxPointOccurrences: 250, sourceDigest: 'native-clock-test', now: () => clock }));
  let result = await service.handle(init());
  clock = 3_600_000;
  result = await service.handle({ type: 'advance', sessionId: 'native-test', sequence: 1, ticketId: result.ticket!.id, observation: toV6PublicObservation(board(1), 1), executionMs: 5 });
  assert.equal(result.kind, 'action'); assert.deepEqual(records, []); assert.equal(result.snapshot.activeSeconds, 0.005);
  clock += 3_600_000;
  result = await service.handle({ type: 'advance', sessionId: 'native-test', sequence: 2, ticketId: result.ticket!.id, observation: toV6PublicObservation(board(2), 2), executionMs: 7 });
  assert.equal(result.kind, 'boundary'); assert.deepEqual(records, [0, 1]); assert.equal(result.snapshot.activeSeconds, 0.012);
});

test('SIC Fallback withdraws the admitted family before any of its commands is released', async () => {
  const family = (id: string, action_ref: string, length: number): NativeFamily => ({
    id,
    propose: () => ({ status: 'proposed', kind: id, actions: Array.from({ length }, () => ({ action_ref, data: {} })),
      steps: Array.from({ length }, () => ({ expected_after: null })) }),
    before: () => ({ admitted: true, reason: 'current' }),
    after: (_proposal, index) => ({ matched: true, seal_prefix: index + 1 === length, reason: 'observed' }),
    record: () => ({ events: [] }), state: () => ({}), restore: () => {},
  });
  const backend = new NativeV6Runtime({ families: [family('primary', 'ACTION1', 1), family('recovery', 'ACTION2', 2)],
    maxPointOccurrences: 250, sourceDigest: 'test-fallback', withdrawPrimaryFamily: true });
  const service = new V6AgentService(() => backend);
  const first = await service.handle({ ...init(), observation: toV6PublicObservation({ ...board(), availableActionIds: [1, 2] }) });
  assert.equal(first.command?.actionRef, 'ACTION2');
  const withdrawal = (first.snapshot.trace as Record<string, unknown>[]).find(event => event.kind === 'sic_fallback_primary_withdrawn');
  assert.equal(withdrawal?.family, 'primary');
  const second = await service.handle({ type: 'advance', sessionId: first.sessionId, sequence: 1, ticketId: first.ticket!.id,
    observation: toV6PublicObservation({ ...board(1), availableActionIds: [1, 2] }, 1), executionMs: 1 });
  assert.equal(second.command?.actionRef, 'ACTION2');
  assert.equal(second.ticket?.decisionRevision, first.ticket?.decisionRevision);
  assert.equal(second.ticket?.actionIndex, 1);
});

test('an acquired loss can RESET the current level, retain evidence and replan from its entry', async () => {
  let state = 0;
  const family: NativeFamily = {
    id: 'reset-test',
    propose: () => ({ status: 'proposed', kind: 'reset-test', actions: [{ action_ref: 'ACTION1', data: {} }], steps: [{}] }),
    before: () => ({ admitted: true, reason: 'current' }),
    after: () => ({ matched: false, seal_prefix: true, reason: 'observed_loss' }),
    record: () => { state++; return { events: [] }; }, state: () => ({ state }), restore: value => { state = value.state as number; },
  };
  const backend = new NativeV6Runtime({ families: [family], maxPointOccurrences: 250, sourceDigest: 'test-level-reset' });
  const service = new V6AgentService(() => backend);
  const startingBoard = board();
  const first = await service.handle(init());
  await assert.rejects(service.handle({ type: 'reset_level', sessionId: first.sessionId, sequence: 0,
    observation: toV6PublicObservation(startingBoard, 0) }), /outstanding command/);
  const lost = await service.handle({ type: 'advance', sessionId: first.sessionId, sequence: 1, ticketId: first.ticket!.id,
    observation: toV6PublicObservation({ ...board(1), state: 'GAME_OVER' }, 1), executionMs: 1 });
  assert.equal(lost.kind, 'stopped');
  assert.equal(lost.snapshot.canResetLevel, true);
  assert.equal(lost.snapshot.actions, 1);
  const failedGraph = backend.inspectKnowledge();
  await assert.rejects(service.handle({ type: 'reset_level', sessionId: first.sessionId, sequence: 1,
    observation: toV6PublicObservation({ ...startingBoard, level: 2, levelsCompleted: 1 }, 1) }), /current level/);
  const reset = await service.handle({ type: 'reset_level', sessionId: first.sessionId, sequence: 1,
    observation: toV6PublicObservation(startingBoard, 1) });
  assert.equal(reset.kind, 'boundary');
  assert.equal(reset.snapshot.actions, 1);
  assert.equal(reset.snapshot.levelsCompleted, 0);
  const resetGraph = backend.inspectKnowledge();
  assert.equal(resetGraph.deltas[failedGraph.deltas.length - 1], failedGraph.deltas.at(-1));
  assert.ok(Object.keys(resetGraph.nodes).some(id => id.startsWith('reasoning:level-reset:')));
  const next = await service.handle({ type: 'resume', sessionId: first.sessionId, sequence: 1 });
  assert.equal(next.kind, 'action');
  assert.equal(state, 0);
  assert.notEqual(next.ticket?.observationRef, first.ticket?.observationRef);
});

test('SIC retains a witnessed fatal command across a same-level reset and authorizes a different command', async () => {
  const recovery = { ...defaultRecoveryPack, solver: 'sic' } as const;
  const service = new V6AgentService(() => createNativeV6Runtime(declarations, { recovery, now: () => 0 }));
  const entry = { ...board(), availableActionIds: [1, 2] };
  const sessionId = 'sic-fatal-choice';
  const first = await service.handle({ ...init(sessionId), recovery, observation: toV6PublicObservation(entry, 0) });
  assert.ok(first.ticket);
  const loss = await service.handle({ type: 'advance', sessionId, sequence: 1, ticketId: first.ticket.id, executionMs: 1,
    observation: toV6PublicObservation({ ...entry, state: 'GAME_OVER' }, 1) });
  assert.equal(loss.snapshot.reason, sicObservedGameOver);
  assert.equal(loss.snapshot.canResetLevel, true);
  const reset = await service.handle({ type: 'reset_level', sessionId, sequence: 1, observation: toV6PublicObservation(entry, 1) });
  assert.equal(reset.snapshot.actions, 1);
  const next = await service.handle({ type: 'resume', sessionId, sequence: 1 });
  assert.ok(next.ticket, next.snapshot.reason ?? 'SIC must authorize the alternative control');
  assert.notEqual(next.ticket.actionRef, first.ticket.actionRef);
});

test('a declared walk reconciles the confirmed prefix when its next landing changes', async () => {
  const family = createSicFramedContact(learnPatternAccessId);
  const command = { action_ref: 'ACTION4', data: {} };
  family.propose = observation => ({
    status: 'proposed', kind: family.id, action: 'ACTION4', actions: [command, command],
    binding: { observation_ref: observation.observation_ref, level_epoch: observation.level_epoch },
    steps: [[4, 2], [6, 2]].map(landing => ({ action: command, expected_after: landing, landingBefore: [0, 0, 0, 0] })),
    adoptedBody: { at: [2, 2], pitch: 2, floor: 0, colors: [1], evidence: observation.observation_ref },
    plan: { command: 'ACTION4', landing: [4, 2], target: [8, 2], contact: false, walk: [
      { command: 'ACTION4', from: [2, 2], landing: [4, 2], beneath: [0, 0, 0, 0] },
      { command: 'ACTION4', from: [4, 2], landing: [6, 2], beneath: [0, 0, 0, 0] },
    ] },
    surface: null, target: null, inset: null, pair: null, needId: 'test_reach_destination',
  });
  const scene = (left: number, blocked: boolean): GameObservation => {
    const result = { ...board(), availableActionIds: [4] };
    for (const y of [2, 3]) for (const x of [left, left + 1]) result.frame[y]![x] = 1;
    if (blocked) result.frame[2]![6] = 2;
    return result;
  };
  const service = new V6AgentService(() => new NativeV6Runtime({ families: [family], sourceDigest: 'walk-guard-test', maxPointOccurrences: 250 }));
  const first = await service.handle({ ...init(), observation: toV6PublicObservation(scene(2, false)) });
  assert.equal(first.kind, 'action');
  const next = await service.handle({ type: 'advance', sessionId: first.sessionId, sequence: 1, ticketId: first.ticket!.id,
    observation: toV6PublicObservation(scene(4, true), 1), executionMs: 1 });
  assert.equal(next.kind, 'boundary');
  assert.equal(next.command, null);
  assert.equal(next.ticket, null);
  const trace = next.snapshot.trace as Record<string, unknown>[];
  assert.equal(trace.findLast(event => event.kind === 'actual_outcome')?.matched, true);
  assert.equal(trace.findLast(event => event.kind === 'before_guard')?.reason, 'declared_bfs_landing_changed');
  assert.equal(trace.findLast(event => event.kind === 'sealed_prefix')?.acquired_actions, 1);
  assert.deepEqual((family.state().body as { at: number[] }).at, [4, 2]);
});

for (const [parallelWorkers, expectedMs] of [[1, 360_000], [4, 514_286], [8, 720_000], [12, 720_000]]) {
  test(`the per-level active deadline scales with ${parallelWorkers} campaign workers`, async () => {
    const deadlines: number[] = [];
    const command = { action_ref: 'ACTION1', data: {} };
    const family: NativeFamily = {
      id: 'parallel-campaign-time-test',
      propose: (_observation, _rows, _inputs, remaining, execution) => {
        assert.equal(remaining, 600);
        deadlines.push(execution!.deadlineMs!);
        return { status: 'proposed', kind: 'public_test', actions: [command, command], steps: [{}, {}] };
      },
      before: () => ({ admitted: true, reason: 'current' }),
      after: () => ({ matched: true, seal_prefix: false, reason: 'witnessed' }),
      record: () => ({ events: [] }),
      state: () => ({}),
      restore: () => {},
    };
    const service = new V6AgentService(() => new NativeV6Runtime({ families: [family], maxPointOccurrences: 250,
      sourceDigest: 'native-campaign-clock-test', now: () => 0 }));
    const first = await service.handle({ ...init(), budgets: { ...init().budgets, parallelWorkers } });
    assert.deepEqual(deadlines, [expectedMs]);
    const reply = await service.handle({ type: 'advance', sessionId: 'native-test', sequence: 1, ticketId: first.ticket!.id,
      observation: toV6PublicObservation(board(1), 1), executionMs: 360_000 });
    if (parallelWorkers === 1) {
      assert.equal(reply.reason, 'level_active_time_budget');
      assert.equal(reply.snapshot.actions, 1);
      return;
    }
    assert.equal(reply.kind, 'action');
    const stopped = await service.handle({ type: 'advance', sessionId: 'native-test', sequence: 2, ticketId: reply.ticket!.id,
      observation: toV6PublicObservation(board(2), 2), executionMs: expectedMs - 360_000 });
    assert.equal(stopped.reason, 'level_active_time_budget');
    assert.equal(stopped.snapshot.actions, 2);
  });
}

for (const [runtimeOrigin, callerOrigin] of [[1000, 10], [10, 1000]] as const) {
  test(`native current deadlines convert caller clock ${callerOrigin} to runtime clock ${runtimeOrigin}`, async () => {
    let runtimeClock: number = runtimeOrigin, callerClock: number = callerOrigin;
    const controller = new AbortController();
    const yieldControl = async () => {};
    const execution: NativeExecution = { now: () => callerClock, deadlineMs: callerOrigin + 50,
      signal: controller.signal, yieldControl };
    const planned: number[] = [], guarded: number[] = [], recorded: number[] = [];
    const remaining = (context: NativeExecution | undefined): number => {
      assert.ok(context?.now && context.deadlineMs !== undefined);
      assert.equal(context.signal, controller.signal);
      assert.equal(context.yieldControl, yieldControl);
      return context.deadlineMs - context.now();
    };
    const family: NativeFamily = {
      id: 'independent-clock-test',
      propose: (_observation, _rows, _inputs, _remaining, context) => {
        const time = remaining(context); planned.push(time);
        if (time <= 0) return null;
        runtimeClock += 10; callerClock += 10;
        return { status: 'proposed', kind: 'public_test',
          actions: [{ action_ref: 'ACTION1', data: {} }, { action_ref: 'ACTION1', data: {} }], steps: [{}, {}] };
      },
      before: (_proposal, _index, _packet, _observation, context) => {
        const time = remaining(context); guarded.push(time);
        return { admitted: time > 0, reason: time > 0 ? 'current' : 'caller_deadline' };
      },
      after: (_proposal, index) => ({ matched: true, seal_prefix: index === 1, reason: 'witnessed' }),
      record: (_before, _after, _command, _first, _second, _proposal, index) => {
        recorded.push(index); return { events: [] };
      },
      state: () => ({ recorded: [...recorded] }),
      restore: state => { recorded.splice(0, recorded.length, ...(state.recorded as number[])); },
    };
    const rows = board().frame, frameHash = await v6FrameHash(rows);
    const packet = (step_index: number): NativePublicObservation => ({ frame_rows: rows, frame_packet: [rows],
      state: 'NOT_FINISHED', level: 1, levels_completed: 0, available_action_refs: ['ACTION1'], step_index, frame_hash: frameHash });
    const runtime = new NativeV6Runtime({ families: [family], maxPointOccurrences: 250,
      sourceDigest: 'independent-clock-test', now: () => runtimeClock });
    try {
      const first = await runtime.initialize({ sessionId: `offset-${runtimeOrigin}-${callerOrigin}`,
        observation: packet(0), budgets: { targetLevels: 1, levelActionCaps: [600], maxActions: 600 } }, execution);
      assert.equal(first.kind, 'action');
      assert.deepEqual(planned, [50]); assert.deepEqual(guarded, [40]);
      runtimeClock += 41; callerClock += 41;
      const second = await runtime.advance({ command: first.command!, observation: packet(1), executionMs: 0 }, execution);
      assert.notEqual(second.kind, 'action', 'An expired caller cannot authorize the second path action');
      assert.deepEqual(guarded, [40, 0]);
      assert.deepEqual(recorded, [0], 'The actual first return is acquired exactly once before the next decision');
      const resumed = await runtime.resume(execution);
      assert.notEqual(resumed.kind, 'action', 'Resume cannot refresh the expired request');
      assert.equal(planned.at(-1), 0);
      assert.deepEqual(recorded, [0]);
    } finally { runtime.close('independent_clock_test_finished'); }
  });
}
