import assert from 'node:assert/strict';
import test from 'node:test';
import type { GameObservation } from '../src/runtime/browser-games.ts';
import type { AgentAction } from '../src/runtime/contracts.ts';
import { BrowserV6Agent, BrowserV6WorkerClient } from '../src/runtime/v6-agent.ts';
import type { V6AgentSnapshot, V6DispatchResult } from '../src/runtime/v6-agent.ts';
import { readControlEffectShadow } from '../src/sic/shadow.ts';
import { as66Contradiction } from '../src/sic/contradiction-review.ts';
import {
  emptyV6Snapshot, nativeV6Action, sameV6Observation, toV6PublicObservation, v6FrameHash, V6AgentError, V6_REFERENCE_COMMIT,
} from '../src/runtime/v6-agent-protocol.ts';
import type {
  V6AgentOperation, V6AgentResult, V6AgentTransport, V6BackendSnapshot, V6Command, V6PublicObservation, V6Ticket,
} from '../src/runtime/v6-agent-protocol.ts';

function board(pixel = 0, overrides: Partial<GameObservation> = {}): GameObservation {
  const frame = Array.from({ length: 64 }, () => Array<number>(64).fill(0));
  frame[10]![10] = pixel;
  return { gameCode: 'TEST', frame, frames: [frame], state: 'NOT_FINISHED', availableActionIds: [1, 2, 6, 7],
    canUndo: false, canSelectLevel: true, level: 1, levelCount: 3, levelsCompleted: 0, defaultFps: 10, ...overrides };
}

class Deferred<T> {
  promise: Promise<T>;
  resolve!: (value: T | PromiseLike<T>) => void;
  reject!: (reason: unknown) => void;
  constructor() { this.promise = new Promise<T>((resolve, reject) => { this.resolve = resolve; this.reject = reject; }); }
}

/** Models coroutine rendezvous only. Solver behavior is checked against Python separately. */
class ScriptedTransport implements V6AgentTransport {
  operations: V6AgentOperation[] = [];
  resets: string[] = [];
  disposed = false;
  sessionId = '';
  actions = 0;
  cycles = 0;
  revision = 1;
  prefixIndex = 0;
  prefixLength = 3;
  nextTicket = 0;
  command: V6Command = { actionRef: 'ACTION1', data: {} };
  observation: V6PublicObservation | null = null;
  ticket: V6Ticket | null = null;
  hook: ((operation: V6AgentOperation, result: V6AgentResult) => Promise<V6AgentResult>) | null = null;

  snapshot(): V6BackendSnapshot {
    return { ...emptyV6Snapshot(), actions: this.actions, cycles: this.cycles, nodeCount: this.actions * 15,
      levelsCompleted: this.observation?.levelsCompleted ?? 0, level: this.observation?.level ?? 1,
      activeSeconds: this.actions / 10, sourceDigest: 'a'.repeat(64), sourceCommit: V6_REFERENCE_COMMIT,
      lastDecision: this.ticket?.id ?? null, proposal: { revision: this.revision, prefixIndex: this.prefixIndex } };
  }

  async action(): Promise<V6AgentResult> {
    const observation = this.observation!;
    this.ticket = { ...structuredClone(this.command), id: `${this.sessionId}:ticket:${++this.nextTicket}`, sessionId: this.sessionId,
      sourceDigest: 'a'.repeat(64), observationRef: `original-v6-ref:${this.actions}`, frameHash: await v6FrameHash(observation.frame),
      level: observation.level, levelsCompleted: observation.levelsCompleted, decisionRevision: this.revision, actionIndex: this.prefixIndex };
    return { ok: true, kind: 'action', sessionId: this.sessionId, phase: 'authorised_not_executed', reason: null,
      command: structuredClone(this.command), ticket: structuredClone(this.ticket), snapshot: this.snapshot() };
  }

  boundary(): V6AgentResult {
    this.ticket = null;
    return { ok: true, kind: 'boundary', sessionId: this.sessionId, phase: 'sealed_prefix', reason: null,
      command: null, ticket: null, snapshot: this.snapshot() };
  }

  async request(operation: V6AgentOperation): Promise<V6AgentResult> {
    this.operations.push(operation);
    let result: V6AgentResult;
    if (operation.type === 'init') {
      this.sessionId = operation.sessionId; this.observation = operation.observation;
      this.actions = 0; this.cycles = 0; this.revision = 1; this.prefixIndex = 0;
      result = await this.action();
    } else {
      assert.equal(operation.sessionId, this.sessionId);
      if (operation.type === 'advance') {
        assert.equal(operation.ticketId, this.ticket?.id);
        assert.equal(operation.observation.stepIndex, this.actions + 1);
        const previous = this.observation!;
        this.observation = operation.observation; this.actions += 1; this.prefixIndex += 1;
        const boundary = this.prefixIndex >= this.prefixLength || previous.level !== this.observation.level
          || previous.levelsCompleted !== this.observation.levelsCompleted || this.observation.state !== 'NOT_FINISHED';
        if (boundary) { this.cycles += 1; result = this.boundary(); }
        else result = await this.action();
      } else if (operation.type === 'resume') {
        assert.equal(this.ticket, null);
        this.prefixIndex = 0; this.revision += 1;
        result = await this.action();
      } else result = this.boundary();
    }
    return this.hook ? this.hook(operation, result) : result;
  }

  reset(reason: string): void { this.resets.push(reason); }
  dispose(): void { this.disposed = true; }
}

function harness(transport = new ScriptedTransport(), onAcquired?: (snapshot: V6AgentSnapshot) => void) {
  const context = { current: board(), enabled: true, actions: [] as AgentAction[], snapshots: [] as V6AgentSnapshot[] };
  let onState: ((snapshot: V6AgentSnapshot) => void) | null = null;
  let dispatch: (action: AgentAction) => Promise<V6DispatchResult> = async action => {
    context.actions.push(action);
    context.current = board(context.actions.length % 16, { level: context.current.level, levelsCompleted: context.current.levelsCompleted });
    return context.current;
  };
  const agent = new BrowserV6Agent({ transport, getObservation: () => context.current, canDispatch: () => context.enabled,
    dispatch: action => dispatch(action), onAcquired, onState: state => { context.snapshots.push(state); onState?.(state); } });
  return { agent, context, transport, setDispatch: (value: typeof dispatch) => { dispatch = value; },
    setOnState: (value: typeof onState) => { onState = value; } };
}

test('V6 observation retains every public animation frame, clones inputs and excludes native internals', () => {
  const native = Object.assign(board(1), { secret: ['native-state'], history: ['undo'] });
  native.frames = [board(2).frame, native.frame];
  const projected = toV6PublicObservation(native, 19);
  assert.deepEqual(Object.keys(projected).sort(), ['frame', 'frames', 'availableActionIds', 'state', 'level', 'levelsCompleted', 'stepIndex'].sort());
  assert.equal(projected.stepIndex, 19);
  assert.equal(projected.frames[0]![10]![10], 2);
  native.frames[0]![10]![10] = 8;
  native.frame[10]![10] = 9;
  assert.equal(projected.frame[10]![10], 1);
  assert.equal(projected.frames[0]![10]![10], 2);
  assert.equal(sameV6Observation(projected, native), false);
  assert.throws(() => toV6PublicObservation(board(), -1));
});

test('native V6 commands require exact coordinate arguments and never alias action zero or Undo', () => {
  assert.deepEqual(nativeV6Action({ actionRef: 'ACTION6', data: { x: 0, y: 63 } }), { id: 6, data: { x: 0, y: 63 } });
  assert.deepEqual(nativeV6Action({ actionRef: 'ACTION7', data: {} }), { id: 7 });
  for (const command of [
    { actionRef: 'ACTION0', data: {} }, { actionRef: 'ACTION1', data: { x: 1 } },
    { actionRef: 'ACTION6', data: { x: -1, y: 2 } }, { actionRef: 'ACTION6', data: { x: 64, y: 2 } },
    { actionRef: 'ACTION6', data: { x: 1.1, y: 2 } }, { actionRef: 'ACTION6', data: { x: 1 } },
    { actionRef: 'ACTION6', data: { x: 1, y: 2, hidden: true } },
  ]) assert.throws(() => nativeV6Action(command));
});

test('sixteen-action batches preserve the coroutine beyond twelve actions and reconcile only at prefix boundaries', async () => {
  const { agent, context, transport } = harness();
  const running = agent.run();
  assert.equal(agent.run(16), running);
  await running;
  assert.equal(context.actions.length, 16);
  assert.equal(agent.snapshot.actionCount, 16);
  assert.equal(agent.snapshot.nodeCount, 240);
  assert.equal(transport.cycles, 5);
  assert.equal(transport.operations.filter(operation => operation.type === 'init').length, 1);
  assert.equal(transport.operations.filter(operation => operation.type === 'resume').length, 5);
  const session = agent.snapshot.sessionId;
  await agent.step();
  assert.equal(agent.snapshot.sessionId, session);
  assert.equal(agent.snapshot.actionCount, 17);
  assert.equal(transport.cycles, 5);
  const init = transport.operations[0]!;
  assert.equal(init.type, 'init');
  if (init.type === 'init') assert.deepEqual(init.budgets, { targetLevels: 3, levelActionCaps: [600, 600, 600] });
  assert.deepEqual(transport.operations.filter(operation => operation.type === 'advance').map(operation => operation.observation.stepIndex), Array.from({ length: 17 }, (_, i) => i + 1));
});

test('coordinate clicks flow intact from the authorized ticket to the real host and outcome', async () => {
  const state = harness();
  state.transport.command = { actionRef: 'ACTION6', data: { x: 11, y: 63 } };
  state.context.current.availableActionIds = [6];
  await state.agent.step();
  assert.deepEqual(state.context.actions, [{ id: 6, data: { x: 11, y: 63 } }]);
  assert.equal(state.transport.actions, 1);
  assert.equal(state.agent.snapshot.sequence, 1);
});

test('reading the SIC shadow leaves V6 commands and acquisition order identical through a terminal return', async () => {
  async function campaign(shadow: boolean) {
    const state = harness();
    state.transport.command = { actionRef: 'ACTION6', data: { x: 11, y: 63 } };
    state.setDispatch(async action => {
      state.context.actions.push(action);
      const count = state.context.actions.length;
      state.context.current = board(count, count === 2 ? { state: 'WIN', levelsCompleted: 1 } : {});
      return state.context.current;
    });
    const shadowOutcomes: string[] = [];
    if (shadow) state.setOnState(snapshot => {
      const view = readControlEffectShadow(state.context.current, snapshot, snapshot.sequence);
      if (view) shadowOutcomes.push(view.resolution.outcome);
    });
    await state.agent.step();
    await state.agent.run(16);
    return {
      actions: state.context.actions,
      operations: state.transport.operations.map(operation => operation.type === 'advance'
        ? [operation.type, operation.sequence, operation.ticketId.split(':').at(-1), operation.observation.state]
        : [operation.type, operation.sequence]),
      status: state.agent.snapshot.status,
      shadowOutcomes,
    };
  }
  const { shadowOutcomes, ...observed } = await campaign(true);
  const { shadowOutcomes: disabled, ...baseline } = await campaign(false);
  assert.deepEqual(observed, baseline);
  assert.deepEqual(disabled, []);
  assert.ok(shadowOutcomes.includes('needs_evidence'));
  assert.equal(shadowOutcomes.at(-1), 'closed');
});

test('pause during first planning retains the undelivered command and resumes without reinitializing', async () => {
  const state = harness();
  const entered = new Deferred<void>();
  const release = new Deferred<void>();
  state.transport.hook = async (operation, result) => {
    if (operation.type === 'init') { entered.resolve(); await release.promise; }
    return result;
  };
  const run = state.agent.run(16);
  await entered.promise; state.agent.pause(); release.resolve(); await run;
  assert.equal(state.context.actions.length, 0);
  assert.equal(state.agent.snapshot.paused, true);
  assert.equal(state.agent.snapshot.pendingAction?.id, 1);
  assert.equal(state.transport.resets.length, 0);
  await state.agent.step();
  assert.equal(state.context.actions.length, 1);
  assert.equal(state.transport.operations.filter(operation => operation.type === 'init').length, 1);
  assert.equal(state.transport.operations.filter(operation => operation.type === 'resume').length, 0);
});

test('opt-in AS66 review pauses after acquiring a contradiction and resumes the same ticket', async () => {
  const transport = new ScriptedTransport();
  transport.hook = async (operation, result) => {
    if (operation.type === 'advance' && operation.sequence <= 2) {
      const ref = `${operation.sessionId}:epoch:1:revision:${operation.sequence + 1}:frame:x`;
      return { ...result, snapshot: { ...result.snapshot, trace: [{ kind: 'actual_outcome',
        observation_ref: ref, matched: operation.sequence === 2 ? false : null }] } };
    }
    return result;
  };
  const pauses: number[] = [];
  const state = harness(transport, snapshot => {
    if (as66Contradiction(state.context.current.gameCode, true, snapshot)) {
      pauses.push(snapshot.sequence);
      state.agent.pause();
    }
  });
  state.context.current.gameCode = 'AS66';
  state.setDispatch(async action => {
    state.context.actions.push(action);
    state.context.current = { ...board(state.context.actions.length), gameCode: 'AS66' };
    return state.context.current;
  });
  await state.agent.run(3);
  assert.deepEqual(pauses, [2]);
  assert.equal(state.agent.snapshot.actionCount, 2);
  assert.equal(state.agent.snapshot.paused, true);
  assert.equal(transport.operations.at(-1)?.type, 'advance');
  const pending = transport.ticket?.id;
  assert.ok(pending);
  assert.equal(as66Contradiction('SYME', true, state.agent.snapshot), null);
  assert.equal(as66Contradiction('AS66', false, state.agent.snapshot), null);
  assert.equal(as66Contradiction('AS66', true, { ...state.agent.snapshot, sequence: 3 }), null);
  await state.agent.step();
  const resumed = transport.operations.at(-1);
  assert.equal(resumed?.type === 'advance' && resumed.ticketId, pending);
  assert.equal(state.agent.snapshot.actionCount, 3);
});

test('pause during native execution acquires that outcome, then retains the remaining prefix', async () => {
  const state = harness();
  const entered = new Deferred<void>();
  const release = new Deferred<void>();
  state.setDispatch(async action => {
    state.context.actions.push(action); entered.resolve(); await release.promise;
    state.context.current = board(1); return state.context.current;
  });
  const run = state.agent.run(16);
  await entered.promise; state.agent.pause(); release.resolve(); await run;
  assert.equal(state.context.actions.length, 1);
  assert.equal(state.transport.actions, 1);
  assert.equal(state.agent.snapshot.actionCount, 1);
  assert.equal(state.agent.snapshot.phase, 'authorised_not_executed');
  assert.equal(state.agent.snapshot.requiresNewSession, false);
  await state.agent.step();
  assert.equal(state.context.actions.length, 2);
  assert.equal(state.transport.operations.filter(operation => operation.type === 'resume').length, 0);
});

test('the solver clock receives native execution time without counting presentation delays', async () => {
  const state = harness();
  state.setDispatch(async action => {
    state.context.actions.push(action);
    state.context.current = board(1);
    return { observation: state.context.current, executionMs: 1.25 };
  });
  await state.agent.step();
  const advanced = state.transport.operations.find(operation => operation.type === 'advance');
  assert.equal(advanced?.type, 'advance');
  if (advanced?.type === 'advance') assert.equal(advanced.executionMs, 1.25);
});

test('a natural level success is acquired before stopping the batch and retains transfer memory', async () => {
  const state = harness();
  state.setDispatch(async action => {
    state.context.actions.push(action);
    state.context.current = board(state.context.actions.length, { level: 2, levelsCompleted: 1 });
    return state.context.current;
  });
  await state.agent.run(16);
  assert.equal(state.context.actions.length, 1);
  assert.equal(state.transport.actions, 1);
  assert.equal(state.agent.snapshot.level, 2);
  assert.equal(state.agent.snapshot.levelsCompleted, 1);
  assert.equal(state.agent.snapshot.requiresNewSession, false);
  assert.equal(state.agent.snapshot.canStep, true);
  assert.equal(state.agent.snapshot.phase, 'sealed_prefix');
  const session = state.agent.snapshot.sessionId;
  await state.agent.step();
  assert.equal(state.context.actions.length, 2);
  assert.equal(state.agent.snapshot.sessionId, session);
  assert.equal(state.transport.operations.filter(operation => operation.type === 'init').length, 1);
  assert.equal(state.transport.operations.filter(operation => operation.type === 'resume').length, 1);
});

test('terminal native outcomes are acquired once and never followed by another command', async () => {
  for (const terminal of ['WIN', 'GAME_OVER', 'LEVEL_COMPLETE']) {
    const state = harness();
    state.setDispatch(async action => { state.context.actions.push(action); state.context.current = board(1, { state: terminal }); return state.context.current; });
    await state.agent.run(16);
    assert.equal(state.context.actions.length, 1);
    assert.equal(state.transport.actions, 1);
    assert.equal(state.agent.snapshot.status, 'stopped');
    assert.equal(state.agent.snapshot.canStep, false);
    await state.agent.step();
    assert.equal(state.context.actions.length, 1);
  }
});

test('stale public frames, animation frames, game, level and action vocabularies never enter the native FIFO', async () => {
  const mutations = [
    (state: ReturnType<typeof harness>) => { state.context.current = board(9); },
    (state: ReturnType<typeof harness>) => { state.context.current.frames = [board(2).frame, state.context.current.frame]; },
    (state: ReturnType<typeof harness>) => { state.context.current.gameCode = 'OTHER'; },
    (state: ReturnType<typeof harness>) => { state.context.current.level = 2; },
    (state: ReturnType<typeof harness>) => { state.context.current.levelsCompleted = 1; },
    (state: ReturnType<typeof harness>) => { state.context.current.state = 'GAME_OVER'; },
    (state: ReturnType<typeof harness>) => { state.context.current.availableActionIds = [6]; },
  ];
  for (const mutate of mutations) {
    const state = harness();
    state.transport.hook = async (operation, result) => { if (operation.type === 'init') mutate(state); return result; };
    await state.agent.step();
    assert.equal(state.context.actions.length, 0);
    assert.equal(state.agent.snapshot.requiresNewSession, true);
    assert.equal(state.transport.operations.some(operation => operation.type === 'advance'), false);
  }
});

test('manual invalidation ignores late decisions and uses a different identity for the next session', async () => {
  const state = harness();
  const entered = new Deferred<void>(); const release = new Deferred<void>();
  state.transport.hook = async (operation, result) => { if (operation.type === 'init') { entered.resolve(); await release.promise; } return result; };
  const run = state.agent.run(16);
  await entered.promise;
  const previous = state.agent.snapshot.sessionId;
  state.agent.invalidate('Manual play');
  release.resolve(); await run;
  assert.equal(state.context.actions.length, 0);
  assert.equal(state.agent.snapshot.sessionId, null);
  state.transport.hook = null;
  await state.agent.step();
  assert.equal(state.context.actions.length, 1);
  assert.notEqual(state.agent.snapshot.sessionId, previous);
  assert.deepEqual(state.transport.resets, ['Manual play']);
});

test('authorization binds source, frame and full coordinate command and cannot be replayed', async () => {
  for (const mutate of [
    (result: V6AgentResult) => { result.ticket!.sourceDigest = 'other'; },
    (result: V6AgentResult) => { result.ticket!.frameHash = 'bad-frame'; },
    (result: V6AgentResult) => { result.ticket!.data = { x: 3, y: 4 }; },
    (result: V6AgentResult) => { result.ticket!.sessionId = 'other'; },
  ]) {
    const state = harness(); state.transport.command = { actionRef: 'ACTION6', data: { x: 1, y: 2 } };
    state.transport.hook = async (operation, result) => { if (operation.type === 'init') mutate(result); return result; };
    await state.agent.step(); assert.equal(state.context.actions.length, 0);
  }
  const state = harness(); let firstId = '';
  state.transport.hook = async (operation, result) => {
    if (operation.type === 'init') firstId = result.ticket!.id;
    if (operation.type === 'advance' && result.ticket) result.ticket.id = firstId;
    return result;
  };
  await state.agent.run(16);
  assert.equal(state.context.actions.length, 1);
  assert.equal(state.agent.snapshot.requiresNewSession, true);
});

test('a pause triggered by an acting-state callback leaves the same unexecuted ticket usable', async () => {
  const state = harness(); let pause = true;
  state.setOnState(snapshot => { if (snapshot.status === 'acting' && pause) { pause = false; state.agent.pause(); } });
  await state.agent.step();
  assert.equal(state.context.actions.length, 0);
  const ticket = state.transport.ticket!.id;
  await state.agent.step();
  const advance = state.transport.operations.find(operation => operation.type === 'advance');
  assert.equal(advance?.type, 'advance');
  if (advance?.type === 'advance') assert.equal(advance.ticketId, ticket);
  assert.equal(state.context.actions.length, 1);
});

test('native failure and solver budgets never fabricate an outcome or automatically reset memory', async () => {
  const failed = harness();
  failed.setDispatch(async () => { throw new Error('Native failure'); });
  await failed.agent.step();
  assert.equal(failed.transport.operations.some(operation => operation.type === 'advance'), false);
  assert.equal(failed.agent.snapshot.actionCount, 0);
  assert.equal(failed.agent.snapshot.requiresNewSession, true);
  await failed.agent.step();
  assert.equal(failed.transport.operations.length, 1);

  const stopped = harness();
  stopped.transport.hook = async (operation, result) => operation.type === 'advance'
    ? { ...result, kind: 'stopped', phase: 'stopped', ticket: null, command: null, reason: 'level_action_budget' } : result;
  await stopped.agent.run(16);
  assert.equal(stopped.context.actions.length, 1);
  assert.equal(stopped.agent.snapshot.actions, 1);
  assert.equal(stopped.agent.snapshot.requiresNewSession, true);
  assert.equal(stopped.transport.resets.length, 0);
  await stopped.agent.run(16);
  assert.equal(stopped.context.actions.length, 1);
});

test('V6 preserves its level-one entry requirement and public user budget', async () => {
  const state = harness();
  state.context.current = board(0, { level: 2, levelsCompleted: 1 });
  assert.equal(state.agent.snapshot.canStep, false);
  await state.agent.step();
  assert.equal(state.transport.operations.length, 0);
  await assert.rejects(state.agent.run(601), RangeError);
  state.agent.pause();
  assert.match(state.agent.snapshot.message, /level 1/);
});

test('V6 transport rejects identity mismatches and ignores late failures from a retired worker', async () => {
  class FakeWorker {
    listeners = new Map<string, ((event: any) => void)[]>();
    messages: any[] = [];
    terminated = false;
    addEventListener(type: string, callback: (event: any) => void): void { this.listeners.set(type, [...(this.listeners.get(type) ?? []), callback]); }
    postMessage(message: any): void { this.messages.push(message); }
    terminate(): void { this.terminated = true; }
    emit(type: string, data?: unknown): void { for (const listener of this.listeners.get(type) ?? []) listener({ data }); }
  }
  const workers: FakeWorker[] = [];
  const transport = new BrowserV6WorkerClient(() => { const worker = new FakeWorker(); workers.push(worker); return worker as unknown as Worker; });
  const first = transport.request({ type: 'snapshot', sessionId: 'first', sequence: 0 });
  transport.reset('new session');
  await assert.rejects(first, (error: unknown) => error instanceof V6AgentError && error.code === 'cancelled');
  const second = transport.request({ type: 'snapshot', sessionId: 'second', sequence: 0 });
  workers[0]!.emit('error'); workers[0]!.emit('messageerror');
  assert.equal(workers[1]!.terminated, false);
  const id = workers[1]!.messages[0].id;
  workers[1]!.emit('message', { id, sessionId: 'different', sequence: 0, result: {} });
  await assert.rejects(second, (error: unknown) => error instanceof V6AgentError && error.code === 'stale');
  transport.dispose();
});
