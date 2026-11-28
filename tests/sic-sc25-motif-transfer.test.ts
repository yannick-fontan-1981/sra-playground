import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import type { V6Command, V6PublicObservation } from '../src/runtime/v6-agent-protocol.ts';

const root = process.env.SIC_SC25_TRANSFER_ENGINE_ROOT;
const moduleURL = (path: string) => root ? pathToFileURL(resolve(root, path)).href : new URL('../' + path, import.meta.url).href;
const { V6AgentService }: typeof import('../src/runtime/v6-agent-service.ts') = await import(moduleURL('src/runtime/v6-agent-service.ts'));
const { createNativeV6Runtime }: typeof import('../src/logos-engine/v6-native-runtime.ts') =
  await import(moduleURL('src/logos-engine/v6-native-runtime.ts'));
const { MotifAccess }: typeof import('../src/logos-engine/v6-motif-access.ts') = await import(moduleURL('src/logos-engine/v6-motif-access.ts'));

const read = async (path: string) => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const reference = '../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/';
const declarations = { common: await read(reference + 'laya_proto/common_frontier_policy.drm.json'),
  strategy: await read(reference + 'morphology_policy/strategy.drm') };
const { frames } = await read('./fixtures/v6-motif-access-reference.json');

type Point = readonly [number, number];
type R = Record<string, any>;
const panel = [[3, 20], [7, 20], [3, 24], [7, 24]] as const;
const motif = [0, 3];
const alternative = [1, 2];
const receiver = [25, 3, 29, 8];
const plain: number[][] = frames.base.public.frame_rows;
const receiverFixture: number[][] = frames.ray_before.public.frame_rows;

function terrainWithReceiver() {
  const terrain = Array.from({ length: 19 }, () => new Array<number>(34).fill(0));
  for (const y of [3, 4, 5]) for (let x = 2; x <= 14; x++) terrain[y][x] = 7;
  for (let y = 2; y <= 8; y++) for (let x = 15; x <= 20; x++) terrain[y + 1][x] = plain[y][x];
  for (let y = receiver[1]; y <= receiver[3]; y++) {
    for (let x = receiver[0]; x <= receiver[2]; x++) terrain[y][x] = receiverFixture[y][x];
  }
  for (const x of [7, 8]) terrain[4][x] = 14;
  return terrain;
}

function field() {
  const terrain = terrainWithReceiver(), bits = new Set<number>();
  let position: Point = [3, 3], facing = '', sequence = 0;
  let entrance = false;
  function render(projectileLeft?: number) {
    const [left, top] = position;
    const frame = Array.from({ length: 64 }, () => new Array<number>(64).fill(0));
    for (const [y, row] of terrain.entries()) frame[y].splice(0, row.length, ...row);
    for (let y = 19; y < plain.length; y++) frame[y].splice(0, plain[y].length, ...plain[y]);
    for (const row of [top, top + 1]) for (const col of [left, left + 1]) frame[row][col] = col === left ? 3 : 4;
    for (const bit of bits) {
      const [x, y] = panel[bit];
      for (const row of [y, y + 1]) for (const col of [x, x + 1]) frame[row][col] = 12;
    }
    if (projectileLeft !== undefined) {
      for (const y of [4, 5]) for (const x of [projectileLeft, projectileLeft + 1]) frame[y][x] = 13;
    }
    return frame;
  }
  function observation(animation: number[][][] = []): V6PublicObservation {
    const frame = render();
    return { frame, frames: [...animation, frame], availableActionIds: [2, 4, 6], state: 'NOT_FINISHED',
      level: 1, levelsCompleted: 0, stepIndex: sequence };
  }
  function supports([x, y]: Point) {
    return [y, y + 1].every(row => [x, x + 1].every(col =>
      terrain[row]?.[col] !== undefined && ![0, 14].includes(terrain[row][col])));
  }
  return {
    observation,
    get position() { return position; },
    get entrance() { return entrance; },
    act(command: V6Command) {
      sequence++;
      if (command.actionRef !== 'ACTION6') {
        const [x, y] = position;
        assert.ok(command.actionRef === 'ACTION2' || command.actionRef === 'ACTION4');
        const next: Point = command.actionRef === 'ACTION2' ? [x, y + 1] : [x + 2, y];
        if (supports(next)) position = next;
        facing = command.actionRef;
        return observation();
      }
      const index = panel.findIndex(([x, y]) => x === command.data.x && y === command.data.y);
      assert.ok(index >= 0);
      if (bits.has(index)) bits.delete(index);
      else bits.add(index);
      const matches = (card: number[]) => bits.size === card.length && card.every(bit => bits.has(bit));
      if (matches(alternative)) {
        bits.clear();
        return observation();
      }
      if (!matches(motif)) return observation();
      bits.clear();
      if (position[1] === 5 && facing === 'ACTION4') {
        entrance = true;
        for (let x = 9; x <= 14; x++) terrain[6][x] = 7;
        return observation();
      }
      for (let x = 5; x <= 8; x++) terrain[6][x] = 7;
      return observation([render(10), render(12)]);
    },
  };
}

async function start(id: string) {
  const board = field(), service = new V6AgentService(() => createNativeV6Runtime(declarations, { now: () => 0 }));
  let observation = board.observation(), sequence = 0;
  let reply = await service.handle({ type: 'init', sessionId: id, sequence, observation,
    budgets: { targetLevels: 3, levelActionCaps: [16, 16, 16], maxActions: 16 } });
  return {
    board,
    get observation() { return observation; },
    async choose() {
      if (reply.kind === 'boundary') reply = await service.handle({ type: 'resume', sessionId: id, sequence });
      assert.equal(reply.kind, 'action', reply.reason);
      assert.equal(reply.snapshot.lastDecision, 'motif_access');
      const guard = (reply.snapshot.trace as R[]).findLast(e => e.kind === 'before_guard')!;
      assert.deepEqual([guard.admitted, guard.reason], [true, 'revalidate_actor_input_pattern_and_epoch']);
      const plan = reply.snapshot.proposal as R;
      return { command: reply.command!, step: plan.steps[guard.index], refs: plan.question.hypothesis_refs as string[] };
    },
    async act() {
      assert.ok(reply.ticket);
      observation = board.act(reply.command!);
      reply = await service.handle({ type: 'advance', sessionId: id, sequence: ++sequence, ticketId: reply.ticket.id, executionMs: 0, observation });
      return (reply.snapshot.trace as R[]).findLast(e => e.kind === 'actual_outcome')!;
    },
  };
}

const readFrame = (observation: V6PublicObservation) => createHash('sha256').update(JSON.stringify(observation.frame)).digest('hex');

test('21 uses an acquired receiver link to choose the motif before the support appears', async t => {
  const withProof = 'sc25-transfer-with-ray', withoutProof = 'sc25-transfer-without-ray';
  const record = MotifAccess.prototype.record;
  const receipts = new Map<string, R>();
  t.mock.method(MotifAccess.prototype, 'record', function (this: InstanceType<typeof MotifAccess>, ...args: Parameters<typeof record>) {
    const result = record.apply(this, args);
    const before = args[0].observation_ref as string;
    receipts.set(before.split(':epoch:', 1)[0] + '/' + args[0].revision,
      structuredClone({ result, ray: this.ray, motion: this.motion, blocked: [...this.blocked.keys()] }));
    return result;
  });

  const propose = MotifAccess.prototype.propose;
  const withdrawals: string[] = [];
  t.mock.method(MotifAccess.prototype, 'propose', async function (this: InstanceType<typeof MotifAccess>, ...args: Parameters<typeof propose>) {
    const before = args[0].observation_ref as string;
    if (!before.startsWith(withoutProof + ':epoch:1:') || args[0].revision < 8) return propose.apply(this, args);
    const ray = this.ray;
    assert.ok(ray);
    assert.equal(this.refs.invoke, ray.evidence);
    withdrawals.push(before);
    this.ray = null;
    try {
      return await propose.apply(this, args);
    } finally {
      this.ray = ray;
    }
  });

  const on = await start(withProof), off = await start(withoutProof);
  for (const [mode, action, data, position, matched] of [
    ['calibrate', 'ACTION2', {}, [3, 4], null], ['calibrate', 'ACTION4', {}, [5, 4], null],
    ['walk', 'ACTION4', {}, [5, 4], false], ['toggle', 'ACTION6', { x: 3, y: 20 }, [5, 4], true],
    ['invoke', 'ACTION6', { x: 7, y: 24 }, [5, 4], null], ['walk', 'ACTION2', {}, [5, 5], true],
    ['walk', 'ACTION4', {}, [7, 5], true],
  ] as const) {
    assert.equal(readFrame(on.observation), readFrame(off.observation));
    const first = await on.choose(), second = await off.choose();
    assert.deepEqual([first.step.mode, first.command.actionRef, first.command.data], [mode, action, data]);
    assert.deepEqual([second.step.mode, second.command], [mode, first.command]);
    assert.equal((await on.act()).matched, matched);
    assert.equal((await off.act()).matched, matched);
    assert.deepEqual([on.board.position, off.board.position], [position, position]);
  }
  assert.equal(readFrame(on.observation), readFrame(off.observation));
  assert.deepEqual([on.board.entrance, off.board.entrance, on.observation.frame[6].slice(9, 15)],
    [false, false, [0, 0, 0, 0, 0, 0]]);

  for (const id of [withProof, withoutProof]) {
    const blocked = receipts.get(id + '/3')!, invocation = receipts.get(id + '/5')!;
    assert.deepEqual(blocked.blocked.map((key: string) => JSON.parse(key)), [[[5, 4], 'ACTION4', 2]]);
    assert.deepEqual(invocation.motion, { ACTION2: [0, 1], ACTION4: [2, 0] });
    assert.equal(invocation.result.grid_cleared, true);
    assert.deepEqual([invocation.ray.receiver, invocation.ray.card, invocation.ray.aimed, invocation.ray.linked_blockers,
      invocation.ray.sampled_trajectory], [receiver, motif, false, [[7, 4, 8, 4]], [[0, [21, 9]], [1, [25, 9]]]]);
    assert.equal(invocation.ray.evidence, invocation.result.ref);
    assert.match(invocation.ray.evidence, /:revision:6:/);
  }
  const linked = receipts.get(withProof + '/5')!.ray;

  for (const [mode, chosenClick, unlinkedClick] of [
    ['toggle', { x: 3, y: 20 }, { x: 7, y: 20 }],
    ['invoke', { x: 7, y: 24 }, { x: 3, y: 24 }],
  ] as const) {
    const first = await on.choose(), second = await off.choose();
    assert.deepEqual([first.step.mode, first.step.card, first.command.actionRef, first.command.data],
      [mode, motif, 'ACTION6', chosenClick]);
    assert.deepEqual([second.step.mode, second.step.card, second.command.actionRef, second.command.data],
      [mode, alternative, 'ACTION6', unlinkedClick]);
    assert.ok(first.refs.includes(linked.evidence));
    assert.deepEqual([on.board.entrance, off.board.entrance], [false, false]);
    await on.act();
    await off.act();
  }
  assert.equal(new Set(withdrawals).size, 2);
  const changed = on.observation.frame.flatMap((row, y) => row.flatMap((pixel, x) => pixel === off.observation.frame[y][x] ? [] : [[x, y]]));
  assert.deepEqual(changed, [9, 10, 11, 12, 13, 14].map(x => [x, 6]));
  assert.deepEqual([on.board.entrance, off.board.entrance], [true, false]);
  assert.deepEqual([on.board.position, off.board.position], [[7, 5], [7, 5]]);
  const access = await on.choose();
  assert.deepEqual([access.step.mode, access.command.actionRef, access.step.expected_after], ['walk', 'ACTION4', [[9, 5], 2]]);
  assert.equal((await on.act()).matched, true);
  assert.deepEqual(on.board.position, [9, 5]);
  const receipt = receipts.get(withProof + '/10')!.result;
  assert.deepEqual([receipt.mode, receipt.before, receipt.after], ['walk', [[7, 5], 2], [[9, 5], 2]]);
  assert.equal(on.observation.levelsCompleted, 0);
});
