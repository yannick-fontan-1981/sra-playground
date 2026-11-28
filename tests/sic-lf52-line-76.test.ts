import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test, { type TestContext } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { sourceBackend } from '../scripts/sic-study-source-games.mjs';

const root = process.env.SIC_LF52_ENGINE_ROOT;
const moduleURL = (path: string) => root ? pathToFileURL(resolve(root, path)).href : new URL('../' + path, import.meta.url).href;
const { V6AgentService }: typeof import('../src/runtime/v6-agent-service.ts') = await import(moduleURL('src/runtime/v6-agent-service.ts'));
const { toV6PublicObservation }: typeof import('../src/runtime/v6-agent-protocol.ts') = await import(moduleURL('src/runtime/v6-agent-protocol.ts'));
const { createNativeV6Runtime }: typeof import('../src/logos-engine/v6-native-runtime.ts') = await import(moduleURL('src/logos-engine/v6-native-runtime.ts'));
const { ReductionTransport }: typeof import('../src/logos-engine/v6-reduction-transport.ts') =
  await import(moduleURL('src/logos-engine/v6-reduction-transport.ts'));

type Row = Record<string, any>;
const read = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const src = '../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/';
const declarations = { common: read(src + 'laya_proto/common_frontier_policy.drm.json'), strategy: read(src + 'morphology_policy/strategy.drm') };
const assetRoot = process.env.SIC_LF52_GAME_ROOT ?? fileURLToPath(new URL('../', import.meta.url));
const sessionId = 'sra-v6-f8f552d2-2a43-4897-9ef4-aba266fe9c10';


type Packet = ReturnType<typeof toV6PublicObservation>;

async function start(project: (observation: Packet) => Packet = observation => observation) {
  const backend = await sourceBackend(assetRoot);
  const service = new V6AgentService(() => createNativeV6Runtime(declarations, { now: () => 0 }));
  let sequence = 0, observation = project(toV6PublicObservation(backend.dispatch({ type: 'load', code: 'LF52', level: 1 }), sequence));
  let reply = await service.handle({ type: 'init', sessionId, sequence, observation,
    budgets: { targetLevels: 6, levelActionCaps: Array(6).fill(600), maxActions: 16 } });
  async function continuation() {
    if (reply.kind === 'boundary') reply = await service.handle({ type: 'resume', sessionId, sequence });
    return reply;
  }
  return {
    get observation() { return observation; },
    continuation,
    async decision() {
      await continuation();
      assert.equal(reply.kind, 'action');
      return { command: reply.command!, proposal: reply.snapshot.proposal as Row, family: reply.snapshot.lastDecision,
        guard: (reply.snapshot.trace as Row[]).findLast(e => e.kind === 'before_guard')! };
    },
    async advance() {
      const { actionRef, data } = reply.command!;
      const actionId = Number(actionRef.slice(6));
      observation = project(toV6PublicObservation(backend.dispatch({ type: 'action', actionId, ...(actionId === 6 ? { data } : {}) }), ++sequence));
      reply = await service.handle({ type: 'advance', sessionId, sequence, ticketId: reply.ticket!.id, executionMs: 0, observation });
      return (reply.snapshot.trace as Row[]).findLast(e => e.kind === 'actual_outcome')!;
    },
  };
}

const clicks = [[18,19],[29,19],[30,19],[41,19],[42,19],[41,31],[42,31],[41,43]];
type ReductionOwner = InstanceType<typeof ReductionTransport>;

function observeReductions(t: TestContext) {
  const original = ReductionTransport.prototype.record;
  const records = new Map<number, Row>();
  t.mock.method(ReductionTransport.prototype, 'record', function (this: ReductionOwner, ...args: Parameters<typeof original>) {
    const result = original.apply(this, args);
    records.set(args[0].revision, { result, selected: this.selected, firstLanding: this.scene?.floor.has('4,3'),
      pegs: [...this.scene?.pegs ?? []].sort() });
    return result;
  });
  return records;
}

test('76 separates confirmed selection, supported population reduction and the official boundary', async t => {
  const records = observeReductions(t);
  const game = await start();
  const startCells = [[2,3],[4,3],[6,3],[6,5]];
  const endCells = [[4,3],[6,3],[6,5],[6,7]];
  for (const [i, [x, y]] of clicks.entries()) {
    const turn = i + 1, pairing = Math.floor(i / 2);
    const d = await game.decision(), step = d.proposal.steps[d.guard.index];
    assert.deepEqual([d.family, d.proposal.kind, d.command.actionRef, d.command.data, d.guard.admitted, d.guard.reason],
      ['reduction_transport', 'supported_ternary_reduction', 'ACTION6', { x,y }, true, 'bind_population_supports_and_epoch']);
    assert.deepEqual([step.mode, step.cell, d.proposal.reduction_plan.carriers],
      [i % 2 === 0 ? 'select' : 'jump', i % 2 === 0 ? startCells[pairing] : endCells[pairing], 0]);
    const outcome = await game.advance();
    assert.equal(outcome.matched, turn === 8 ? null : true);
    const record = records.get(turn)!;
    if (turn === 8) {
      assert.equal(record.result.status, 'official_boundary');
      assert.equal(game.observation.levelsCompleted, 1);
    } else {
      assert.equal(record.result.before_population, 5 - pairing);
      assert.equal(record.result.after_population, i % 2 === 0 ? 5 - pairing : 4 - pairing);
      if (turn === 1) {
        assert.equal(record.firstLanding, true);
        assert.deepEqual(record.selected, [2,3]);
      }
      if (turn === 2) assert.deepEqual(record.pegs, ['4,3','5,3','6,4','6,6']);
      if (turn === 4) assert.deepEqual(record.pegs, ['6,3','6,4','6,6']);
    }
  }
});

function removeLanding(packet: Packet): Packet {
  if (packet.level !== 1 || packet.stepIndex !== 1) return packet;
  const remove = (frame: Packet['frame']) => frame.map((row, y) =>
    row.map((value, x) => 29 <= x && x <= 32 && 18 <= y && y <= 21 && value === 1 ? 0 : value));
  return { ...packet, frame: remove(packet.frame), frames: packet.frames.map(remove) };
}

for (const retain of [true, false]) {
  test('76 selected response with the landing evidence ' + (retain ? 'retained' : 'withdrawn'), async t => {
    const records = observeReductions(t);
    const original = ReductionTransport.prototype.propose;
    let scoped = false;
    t.mock.method(ReductionTransport.prototype, 'propose', function (this: ReductionOwner, ...args: Parameters<typeof original>) {
      if (args[0].level_epoch !== 1 || args[0].revision !== 2 || retain) return original.apply(this, args);
      assert.ok(this.scene?.floor.has('4,3'));
      this.scene = { ...this.scene, floor: new Set(this.scene.floor) };
      this.scene.floor.delete('4,3');
      scoped = true;
      return original.apply(this, args);
    });
    const game = await start(removeLanding);
    const selection = await game.decision();
    assert.deepEqual(selection.command.data, { x: 18, y: 19 });
    const result = await game.advance();
    const observed = records.get(1)!;
    assert.equal(result.matched, true);
    assert.deepEqual([observed.result.before_population, observed.result.after_population, observed.selected, observed.firstLanding],
      [5, 5, [2,3], true]);
    const landing = game.observation.frame.slice(18, 22).flatMap(row => row.slice(29, 33));
    assert.equal(landing.filter(pixel => pixel === 0).length, 8);
    assert.equal(landing.filter(pixel => pixel === 2).length, 8);
    assert.equal(game.observation.frame[19][29], 2);
    assert.equal(game.observation.availableActionIds.includes(6), true);
    const next = await game.continuation();
    assert.equal(scoped, !retain);
    if (retain) {
      assert.deepEqual([next.kind, next.snapshot.lastDecision, next.command], ['action', 'reduction_transport',
        { actionRef: 'ACTION6', data: { x: 30, y: 19 } }]);
      const step = (next.snapshot.proposal as Row).steps[0];
      assert.deepEqual([step.mode, step.cell], ['jump', [4,3]]);
      assert.equal((await game.advance()).matched, true);
      assert.equal(records.get(2)?.result.after_population, 4);
    } else {
      assert.deepEqual([next.kind, next.snapshot.lastDecision, next.command], ['action', 'observed_frontier',
        { actionRef: 'ACTION1', data: {} }]);
      await game.advance();
      assert.equal(game.observation.levelsCompleted, 0);
    }
  });
}
