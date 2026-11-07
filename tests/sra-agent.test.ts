import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { BrowserSraAgent, BrowserSraWorkerClient } from '../src/runtime/sra-agent.ts';
import type { SraAgentSnapshot } from '../src/runtime/sra-agent.ts';
import type { GameObservation } from '../src/runtime/browser-games.ts';
import { frameFromAgentObservation, isAgentAction, matchesPublicObservation, toAgentObservation } from '../src/runtime/contracts.ts';
import type { SupportedAgentActionId } from '../src/runtime/contracts.ts';
import { SraAgentError } from '../src/runtime/sra-agent-protocol.ts';
import type { SraAgentOperation, SraAgentResult, SraAgentTransport, SraKnowledgeSummary } from '../src/runtime/sra-agent-protocol.ts';
import { SraAgentService } from '../src/runtime/sra-agent-service.ts';
import { createV7Runtime } from '../src/logos-engine/create-runtime.ts';
import type { V7Bundle } from '../src/logos-engine/bundle.ts';

const bundle = JSON.parse(await readFile(new URL('../reference/v7/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/bundle.json', import.meta.url), 'utf8')) as V7Bundle;

function board(pixel = 0, overrides: Partial<GameObservation> = {}): GameObservation {
  const frame = Array.from({ length: 64 }, () => Array<number>(64).fill(0));
  frame[10]![10] = pixel;
  return { gameCode: 'TEST', frame, frames: [frame], state: 'NOT_FINISHED', availableActionIds: [1, 2, 6, 7], canUndo: false, canSelectLevel: true, level: 1, levelCount: 6, levelsCompleted: 0, defaultFps: 10, ...overrides };
}

class Deferred<T> {
  promise: Promise<T>;
  resolve!: (value: T | PromiseLike<T>) => void;
  reject!: (reason: unknown) => void;
  constructor() { this.promise = new Promise<T>((resolve, reject) => { this.resolve = resolve; this.reject = reject; }); }
}

const summary = (cycles = 1, choices = 0): SraKnowledgeSummary => ({ cycles, choices, nodeCount: cycles, hypothesisCount: Math.max(0, cycles - 1), compositionCount: 0, lastDecision: choices ? 'ACTION1' : null, trace: [] });

/** Transport double for races only; real V7 policy is exercised separately below. */
class ScriptedTransport implements SraAgentTransport {
  operations: SraAgentOperation[] = [];
  cancels: string[] = [];
  resets: string[] = [];
  disposed = false;
  cycles = 0;
  choices = 0;
  hook: ((operation: SraAgentOperation, result: SraAgentResult) => Promise<SraAgentResult>) | null = null;

  async request(operation: SraAgentOperation): Promise<SraAgentResult> {
    this.operations.push(operation);
    let result: SraAgentResult;
    if (operation.type === 'initialize') { this.cycles = 1; this.choices = 0; result = { kind: 'ready', summary: summary(this.cycles, this.choices) }; }
    else if (operation.type === 'observe') { this.cycles += 1; result = { kind: 'observed', summary: summary(this.cycles, this.choices) }; }
    else if (operation.type === 'choose') {
      this.choices += 1;
      result = { kind: 'choice', action: 1, summary: summary(this.cycles, this.choices), proposal: { choiceSequence: this.choices, sourceDigest: 'test', graphChain: `chain:${this.choices}`, observationRef: `${operation.sessionId}:${operation.sequence}`, decisionId: `choice:${this.choices}`, decisionRevision: 1 } };
    } else if (operation.type === 'consume') result = { kind: 'consumed', action: 1, proposalId: operation.proposal.decisionId, summary: summary(this.cycles, this.choices) };
    else result = { kind: 'abandoned', summary: summary(this.cycles, this.choices) };
    return this.hook ? this.hook(operation, result) : result;
  }
  cancel(sessionId: string): void { this.cancels.push(sessionId); }
  reset(reason: string): void { this.resets.push(reason); }
  dispose(): void { this.disposed = true; }
}

class DirectTransport implements SraAgentTransport {
  service: SraAgentService;
  active: AbortController | null = null;
  operations: SraAgentOperation[] = [];
  constructor() { this.service = new SraAgentService(() => createV7Runtime(bundle)); }
  async request(operation: SraAgentOperation): Promise<SraAgentResult> {
    this.operations.push(operation);
    const controller = new AbortController(); this.active = controller;
    try { return await this.service.handle(operation, controller.signal); }
    catch (error) {
      if (controller.signal.aborted) throw new SraAgentError('cancelled', 'Cancelled');
      throw error;
    } finally { if (this.active === controller) this.active = null; }
  }
  cancel(): void { this.active?.abort(); }
  reset(): void { this.active?.abort(); this.service = new SraAgentService(() => createV7Runtime(bundle)); }
  dispose(): void { this.active?.abort(); }
}

function harness(transport: SraAgentTransport = new ScriptedTransport()) {
  const context = { current: board(), enabled: true, actions: [] as number[], snapshots: [] as SraAgentSnapshot[] };
  let dispatch: (action: SupportedAgentActionId) => Promise<GameObservation> = async action => {
    context.actions.push(action);
    context.current = board(context.actions.length % 16);
    return context.current;
  };
  const agent = new BrowserSraAgent({
    transport,
    getObservation: () => context.current,
    canDispatch: () => context.enabled,
    dispatch: action => dispatch(action),
    onState: state => { context.snapshots.push(state); },
  });
  return { agent, context, setDispatch: (value: typeof dispatch) => { dispatch = value; } };
}

test('public game projection admits the live protocol and excludes engine state', () => {
  const native = Object.assign(board(), { hidden_board: [[99]], history: ['private'], scoreOracle: true });
  const projected = toAgentObservation(native, 'session', 0);
  assert.deepEqual(Object.keys(projected).sort(), ['availableActionIds', 'gameCode', 'image', 'level', 'levelsCompleted', 'protocolVersion', 'sequence', 'sessionId', 'state'].sort());
  native.frame[0]![0] = 9;
  assert.equal(projected.image.pixels[0], 0);
  projected.image.pixels[1] = 8;
  assert.equal(native.frame[0]![1], 0);
  assert.equal(frameFromAgentObservation(projected)[0]![1], 8);
  for (const state of ['WIN', 'GAME_OVER', 'LEVEL_COMPLETE']) assert.equal(toAgentObservation(board(0, { state }), 's', 1).state, state);
  assert.throws(() => toAgentObservation(board(0, { availableActionIds: [0, 1] }), 's', 0), /action vocabulary/);
  assert.throws(() => toAgentObservation(board(16), 's', 0), /palette index/);
  assert.throws(() => toAgentObservation(board(0, { state: 'UNKNOWN' }), 's', 0), /game state/);
  assert.equal(isAgentAction({ id: 0 }), false);
  assert.equal(isAgentAction({ id: 1, hidden: true }), false);
  assert.equal(isAgentAction({ id: 6, data: { x: 63, y: 0 } }), true);
  assert.equal(isAgentAction({ id: 6, data: { x: 64, y: 0 } }), false);
  assert.equal(isAgentAction({ id: 7 }), true);
  const expected = toAgentObservation(board(), 's', 0);
  assert.equal(matchesPublicObservation(expected, board()), true);
  assert.equal(matchesPublicObservation(expected, board(1)), false);
});

test('real V7 worker service proposes, consumes and acquires only the matching witnessed action', async () => {
  const service = new SraAgentService(() => createV7Runtime(bundle));
  const initial = toAgentObservation(board(), 'real', 0);
  const ready = await service.handle({ type: 'initialize', sessionId: 'real', sequence: 0, observation: initial });
  assert.equal(ready.kind, 'ready');
  const choice = await service.handle({ type: 'choose', sessionId: 'real', sequence: 0 });
  assert.equal(choice.kind, 'choice');
  if (choice.kind !== 'choice') throw new Error('Expected real V7 proposal');
  assert.equal(choice.action, 1);
  assert.equal(choice.summary.hypothesisCount, 0);
  const consumed = await service.handle({ type: 'consume', sessionId: 'real', sequence: 0, proposal: choice.proposal });
  assert.equal(consumed.kind, 'consumed');
  await assert.rejects(() => service.handle({ type: 'consume', sessionId: 'real', sequence: 0, proposal: choice.proposal }), /previous proposal/);
  const next = toAgentObservation(board(3), 'real', 1);
  await assert.rejects(() => service.handle({ type: 'observe', sessionId: 'real', sequence: 1, observation: next, action: 2 }), /pending proposal/);
  const observed = await service.handle({ type: 'observe', sessionId: 'real', sequence: 1, observation: next, action: 1 });
  assert.equal(observed.kind, 'observed');
  assert.equal(observed.summary.cycles, 2);
  assert.equal(observed.summary.hypothesisCount, 1);
  assert.ok(observed.summary.trace.every(event => event.workflowId === 'prototype.v7.cycle'));
  const second = await service.handle({ type: 'choose', sessionId: 'real', sequence: 1 });
  assert.equal(second.kind, 'choice');
  if (second.kind !== 'choice') throw new Error('Expected second proposal');
  const reserved = await service.handle({ type: 'consume', sessionId: 'real', sequence: 1, proposal: second.proposal });
  if (reserved.kind !== 'consumed') throw new Error('Expected reservation');
  const abandoned = await service.handle({ type: 'abandon', sessionId: 'real', sequence: 1, proposalId: reserved.proposalId });
  assert.equal(abandoned.summary.cycles, 2, 'Abandon is not witnessed game evidence');
  assert.equal(abandoned.summary.hypothesisCount, 1);
  const resumed = await service.handle({ type: 'choose', sessionId: 'real', sequence: 1 });
  assert.equal(resumed.kind, 'choice');
  assert.equal(resumed.summary.choices, 3);
});

test('worker reserves an observation slot before dispatch and preserves the declared budget', async () => {
  const limited = structuredClone(bundle) as any;
  limited.knowledge.drm.limits.events = 2;
  const service = new SraAgentService(() => createV7Runtime(limited));
  await service.handle({ type: 'initialize', sessionId: 'limited', sequence: 0, observation: toAgentObservation(board(), 'limited', 0) });
  const choice = await service.handle({ type: 'choose', sessionId: 'limited', sequence: 0 });
  if (choice.kind !== 'choice') throw new Error('Expected bounded choice');
  await service.handle({ type: 'consume', sessionId: 'limited', sequence: 0, proposal: choice.proposal });
  await service.handle({ type: 'observe', sessionId: 'limited', sequence: 1, observation: toAgentObservation(board(1), 'limited', 1), action: choice.action });
  const stopped = await service.handle({ type: 'choose', sessionId: 'limited', sequence: 1 });
  assert.equal(stopped.kind, 'stopped');
  if (stopped.kind === 'stopped') assert.equal(stopped.reason, 'budget');
  assert.equal(stopped.summary.cycles, 2);
  assert.equal(stopped.summary.choices, 1, 'No extra choice or automatic memory reset');
});

test('live controller acquires actual V7 transitions even when an action leaves pixels unchanged', async () => {
  const transport = new DirectTransport();
  const { agent, context, setDispatch } = harness(transport);
  setDispatch(async action => { context.actions.push(action); return context.current; });
  await agent.step();
  const session = agent.snapshot.sessionId;
  await agent.step();
  assert.equal(agent.snapshot.sessionId, session);
  assert.deepEqual(context.actions, [1, 2]);
  assert.equal(agent.snapshot.sequence, 2);
  assert.equal(agent.snapshot.actionCount, 2);
  assert.equal(agent.snapshot.cycles, 3);
  assert.equal(transport.operations.filter(operation => operation.type === 'initialize').length, 1);
  assert.equal(transport.operations.filter(operation => operation.type === 'observe').length, 2);
  agent.dispose();
});

test('four-action batches are serial, coalesce double clicks and keep the same memory on resume', async () => {
  const transport = new ScriptedTransport();
  const { agent, context } = harness(transport);
  const first = agent.run(4);
  assert.equal(agent.run(4), first);
  await first;
  assert.equal(context.actions.length, 4);
  const session = agent.snapshot.sessionId;
  await agent.run(4);
  assert.equal(context.actions.length, 8);
  assert.equal(agent.snapshot.cycles, 9);
  assert.equal(agent.snapshot.sessionId, session);
  assert.equal(transport.operations.filter(operation => operation.type === 'initialize').length, 1);
  await assert.rejects(() => agent.run(5), /one to four/);
  agent.dispose();
});

test('stale board, game, level, state or action vocabulary never enters the native FIFO', async () => {
  for (const mutate of [
    (state: GameObservation) => ({ ...state, gameCode: 'OTHER' }),
    (_state: GameObservation) => board(7),
    (state: GameObservation) => ({ ...state, level: 2 }),
    (state: GameObservation) => ({ ...state, state: 'WIN' }),
    (state: GameObservation) => ({ ...state, availableActionIds: [2] }),
  ]) {
    const transport = new ScriptedTransport();
    const entered = new Deferred<void>(), release = new Deferred<void>();
    transport.hook = async (operation, result) => { if (operation.type === 'choose') { entered.resolve(); await release.promise; } return result; };
    const { agent, context } = harness(transport);
    const running = agent.step(); await entered.promise;
    context.current = mutate(context.current);
    release.resolve(); await running;
    assert.equal(context.actions.length, 0);
    assert.equal(transport.operations.some(operation => operation.type === 'consume'), false);
    assert.equal(agent.snapshot.requiresNewSession, true);
    agent.dispose();
  }
});

test('invalidation ignores a late decision and creates a fresh session only on the next step', async () => {
  const transport = new ScriptedTransport();
  const entered = new Deferred<void>(), release = new Deferred<void>();
  transport.hook = async (operation, result) => { if (operation.type === 'choose') { entered.resolve(); await release.promise; } return result; };
  const { agent, context } = harness(transport);
  const running = agent.step(); await entered.promise;
  const oldSession = agent.snapshot.sessionId;
  agent.invalidate('Manual intervention.'); context.current = board(4);
  release.resolve(); await running;
  assert.equal(context.actions.length, 0);
  assert.equal(agent.snapshot.cycles, 0);
  assert.equal(agent.snapshot.sessionId, null);
  transport.hook = null;
  await agent.step();
  assert.notEqual(agent.snapshot.sessionId, oldSession);
  assert.equal(context.actions.length, 1);
  agent.dispose();
});

test('the host checks freshness again after the consumed ticket returns', async () => {
  const transport = new ScriptedTransport();
  const entered = new Deferred<void>(), release = new Deferred<void>();
  transport.hook = async (operation, result) => { if (operation.type === 'consume') { entered.resolve(); await release.promise; } return result; };
  const { agent, context } = harness(transport);
  const running = agent.step(); await entered.promise;
  context.current = board(8); release.resolve(); await running;
  assert.equal(context.actions.length, 0);
  assert.equal(agent.snapshot.requiresNewSession, true);
  agent.dispose();
});

test('pause during choice or consumption preserves memory and never releases an unstarted action', async () => {
  for (const phase of ['choose', 'consume']) {
    const transport = new ScriptedTransport();
    const entered = new Deferred<void>(), release = new Deferred<void>();
    transport.hook = async (operation, result) => { if (operation.type === phase) { entered.resolve(); await release.promise; } return result; };
    const { agent, context } = harness(transport);
    const running = agent.step(); await entered.promise;
    const session = agent.snapshot.sessionId;
    agent.pause(); release.resolve(); await running;
    assert.equal(context.actions.length, 0);
    assert.equal(agent.snapshot.cycles, 1);
    assert.equal(agent.snapshot.paused, true);
    assert.equal(transport.operations.some(operation => operation.type === 'abandon'), phase === 'consume');
    transport.hook = null; await agent.step();
    assert.equal(agent.snapshot.sessionId, session);
    assert.equal(context.actions.length, 1);
    assert.equal(transport.operations.filter(operation => operation.type === 'initialize').length, 1);
    agent.pause(); assert.doesNotMatch(agent.snapshot.message, /Pausing/);
    agent.dispose();
  }
});

test('pause waits for an engaged native action and still acquires its real outcome', async () => {
  const transport = new ScriptedTransport();
  const { agent, context, setDispatch } = harness(transport);
  const entered = new Deferred<void>(), release = new Deferred<GameObservation>();
  setDispatch(async action => { context.actions.push(action); entered.resolve(); context.current = await release.promise; return context.current; });
  const running = agent.run(4); await entered.promise;
  agent.pause(); assert.equal(agent.snapshot.busy, true);
  release.resolve(board(5)); await running;
  assert.equal(context.actions.length, 1);
  assert.equal(agent.snapshot.actionCount, 1);
  assert.equal(agent.snapshot.cycles, 2);
  assert.equal(transport.operations.filter(operation => operation.type === 'observe').length, 1);
  assert.equal(transport.cancels.length, 0, 'An already applied action still needs its observation');
  assert.equal(agent.snapshot.canStep, true);
  agent.dispose();
});

test('terminal outcomes stop the batch, and a natural level change is never a cross-level transition', async () => {
  for (const state of ['WIN', 'LEVEL_COMPLETE', 'GAME_OVER']) {
    const transport = new ScriptedTransport();
    const { agent, context, setDispatch } = harness(transport);
    setDispatch(async action => { context.actions.push(action); return context.current = board(1, { state }); });
    await agent.run(4);
    assert.equal(context.actions.length, 1);
    assert.equal(agent.snapshot.cycles, 2);
    assert.equal(agent.snapshot.canStep, false);
    agent.dispose();
  }
  const transport = new ScriptedTransport();
  const { agent, context, setDispatch } = harness(transport);
  setDispatch(async action => { context.actions.push(action); return context.current = board(1, { level: 2, levelsCompleted: 1 }); });
  await agent.run(4);
  assert.equal(context.actions.length, 1);
  assert.equal(agent.snapshot.cycles, 1);
  assert.equal(transport.operations.some(operation => operation.type === 'observe'), false);
  assert.equal(agent.snapshot.requiresNewSession, true);
  assert.match(agent.snapshot.message, /another level/);
  agent.dispose();
});

test('unsupported controls and exhausted sessions never become random actions or automatic resets', async () => {
  const transport = new ScriptedTransport();
  const { agent, context } = harness(transport);
  context.current = board(0, { availableActionIds: [6, 7] });
  assert.equal(agent.snapshot.canStep, false);
  assert.match(agent.snapshot.message, /deferred/);
  await agent.run(4); assert.equal(transport.operations.length, 0);
  context.current = board();
  transport.hook = async (operation, result) => operation.type === 'choose' ? { kind: 'stopped', summary: result.summary, reason: 'budget', message: 'Declared budget exhausted.' } : result;
  await agent.run(4); const requests = transport.operations.length;
  await agent.step();
  assert.equal(transport.operations.length, requests);
  assert.equal(agent.snapshot.requiresNewSession, true);
  assert.equal(context.actions.length, 0);
  agent.dispose();
});

test('native dispatch failure does not fabricate an observation or retry a consumed proposal', async () => {
  const transport = new ScriptedTransport();
  const { agent, context, setDispatch } = harness(transport);
  setDispatch(async action => { context.actions.push(action); throw new Error('Native action failed'); });
  await agent.run(4);
  assert.equal(context.actions.length, 1);
  assert.equal(transport.operations.some(operation => operation.type === 'observe'), false);
  assert.equal(agent.snapshot.status, 'error');
  assert.equal(agent.snapshot.requiresNewSession, true);
  await agent.step(); assert.equal(context.actions.length, 1);
  agent.dispose();
});

test('worker transport ignores old worker failures and rejects mismatched response identities', async () => {
  class FakeWorker {
    listeners = new Map<string, Array<(event: any) => void>>();
    messages: any[] = [];
    terminated = false;
    addEventListener(type: string, callback: (event: any) => void) { const list = this.listeners.get(type) ?? []; list.push(callback); this.listeners.set(type, list); }
    postMessage(message: unknown) { this.messages.push(message); }
    terminate() { this.terminated = true; }
    emit(type: string, data?: unknown) { for (const callback of this.listeners.get(type) ?? []) callback({ data }); }
  }
  const workers: FakeWorker[] = [];
  const client = new BrowserSraWorkerClient(() => { const worker = new FakeWorker(); workers.push(worker); return worker as unknown as Worker; });
  const operation: SraAgentOperation = { type: 'initialize', sessionId: 'a', sequence: 0, observation: toAgentObservation(board(), 'a', 0) };
  const first = client.request(operation);
  const rejected = assert.rejects(first, /Reset/);
  client.reset('Reset'); await rejected;
  const second = client.request({ ...operation, sessionId: 'b', observation: toAgentObservation(board(), 'b', 0) });
  workers[0]!.emit('error'); workers[0]!.emit('messageerror');
  assert.equal(workers[1]!.terminated, false);
  const request = workers[1]!.messages[0];
  workers[1]!.emit('message', { id: request.id, sessionId: 'b', sequence: 0, result: { kind: 'ready', summary: summary() } });
  assert.equal((await second).kind, 'ready');
  const wrong = client.request({ type: 'choose', sessionId: 'b', sequence: 0 });
  const wrongRequest = workers[1]!.messages.at(-1);
  workers[1]!.emit('message', { id: wrongRequest.id, sessionId: 'a', sequence: 0, result: { kind: 'ready', summary: summary() } });
  await assert.rejects(wrong, /obsolete/);
  const fatal = client.request({ type: 'choose', sessionId: 'b', sequence: 0 });
  workers[1]!.emit('error');
  await assert.rejects(fatal, /worker stopped/);
  assert.equal(workers[1]!.terminated, true);
  client.dispose();
});
