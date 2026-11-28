import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import type { V6Command, V6PublicObservation } from '../src/runtime/v6-agent-protocol.ts';

const root = process.env.SIC_SC25_ACCESS_ENGINE_ROOT;
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
const fixture: number[][] = frames.base.public.frame_rows;
const panel = [[3, 20], [7, 20], [3, 24], [7, 24]] as const;
type R = Record<string, any>;
type Point = readonly [number, number];
type Axis = 'horizontal' | 'vertical';

const boardDigest = (packet: V6PublicObservation) => createHash('sha256').update(JSON.stringify(packet.frame)).digest('hex');

function field(axis: Axis, wired: boolean) {
  const terrain = fixture.slice(0, 19).map(row => [...row]);
  for (const y of [4, 5]) for (const x of [3, 4]) terrain[y][x] = 7;
  const closed = terrain.map(row => [...row]);
  const bits = new Set<number>();
  let left = 3, sequence = 0;

  const map = (x: number, y: number): Point => axis === 'horizontal' ? [x, y] : [16 - y, x - 2];
  const supported = (left: number, surface: readonly (readonly number[])[]) =>
    [4, 5].every(y => [left, left + 1].every(x => Boolean(surface[y][x])));

  function observation(): V6PublicObservation {
    const frame = Array.from({ length: 64 }, () => new Array<number>(64).fill(0));
    for (const [y, row] of terrain.entries()) {
      for (const [x, pixel] of row.entries()) {
        if (pixel === 0) continue;
        const [mappedX, mappedY] = map(x, y);
        frame[mappedY][mappedX] = pixel;
      }
    }
    for (const y of [4, 5]) for (const x of [left, left + 1]) {
      const [mappedX, mappedY] = map(x, y);
      frame[mappedY][mappedX] = x === left ? 3 : 4;
    }
    for (let y = 19; y < fixture.length; y++) frame[y].splice(0, fixture[y].length, ...fixture[y]);
    for (const i of bits) {
      const [x, y] = panel[i];
      for (const row of [y, y + 1]) for (const col of [x, x + 1]) frame[row][col] = 12;
    }
    return { frame, frames: [frame], availableActionIds: [4, 6], state: 'NOT_FINISHED', level: 1, levelsCompleted: 0,
      stepIndex: sequence };
  }

  return {
    observation,
    get body(): Point { return axis === 'horizontal' ? [left, 4] : map(left, 5); },
    get occupiesOpenedSupport() { return supported(left, terrain) && !supported(left, closed); },
    get bridge(): Point[] { return [4, 5].flatMap(y => [10, 11, 12, 13, 14].map(x => map(x, y))); },
    act(command: V6Command) {
      if (command.actionRef === 'ACTION4') {
        if (supported(left + 2, terrain)) left += 2;
      } else {
        assert.equal(command.actionRef, 'ACTION6');
        const i = panel.findIndex(([x, y]) => command.data.x === x && command.data.y === y);
        assert.ok(i >= 0, 'The coordinates must address a real panel cell');
        if (bits.has(i)) bits.delete(i);
        else bits.add(i);
        if (bits.size === 2 && bits.has(0) && bits.has(3)) {
          bits.clear();
          if (wired) for (const y of [4, 5]) for (let x = 10; x <= 14; x++) terrain[y][x] = 7;
        }
      }
      sequence++;
      return observation();
    },
  };
}

async function start(axis: Axis, wired: boolean) {
  const board = field(axis, wired);
  const service = new V6AgentService(() => createNativeV6Runtime(declarations, { now: () => 0 }));
  const sessionId = 'motif-movement-' + axis + (wired ? '-wired' : '-disconnected');
  let observation = board.observation(), sequence = 0;
  let reply = await service.handle({ type: 'init', sessionId, sequence, observation,
    budgets: { targetLevels: 3, levelActionCaps: [12, 12, 12], maxActions: 12 } });
  return {
    board,
    get observation() { return observation; },
    async choose() {
      if (reply.kind === 'boundary') reply = await service.handle({ type: 'resume', sessionId, sequence });
      assert.equal(reply.kind, 'action');
      assert.equal(reply.snapshot.lastDecision, 'motif_access');
      const guard = (reply.snapshot.trace as R[]).findLast(e => e.kind === 'before_guard')!;
      assert.deepEqual([guard.admitted, guard.reason], [true, 'revalidate_actor_input_pattern_and_epoch']);
      const p = reply.snapshot.proposal as R;
      assert.equal(p.material_access_subquestion, 'motif_conditioned_access');
      return { command: reply.command!, step: p.steps[guard.index], refs: p.question.hypothesis_refs as string[] };
    },
    async act() {
      assert.ok(reply.command && reply.ticket);
      observation = board.act(reply.command);
      reply = await service.handle({ type: 'advance', sessionId, sequence: ++sequence, ticketId: reply.ticket.id, executionMs: 0, observation });
      return (reply.snapshot.trace as R[]).findLast(e => e.kind === 'actual_outcome')!;
    },
  };
}

for (const axis of ['horizontal', 'vertical'] as const) {
  test('21 uses the measured ' + axis + ' direction only after the motif actually connects the terrain', async t => {
    const original = MotifAccess.prototype.record;
    const responses = new Map<string, R>();
    t.mock.method(MotifAccess.prototype, 'record', function (this: InstanceType<typeof MotifAccess>, ...args: Parameters<typeof original>) {
      const event = original.apply(this, args);
      responses.set(String(event.ref), { ...event, motion: structuredClone(this.motion) });
      return event;
    });
    const on = await start(axis, true), off = await start(axis, false);
    for (const [mode, actionRef, data] of [
      ['calibrate', 'ACTION4', {}], ['toggle', 'ACTION6', { x: 3, y: 20 }], ['invoke', 'ACTION6', { x: 7, y: 24 }],
    ] as const) {
      assert.equal(boardDigest(on.observation), boardDigest(off.observation));
      const yes = await on.choose(), no = await off.choose();
      assert.deepEqual([yes.step.mode, yes.command.actionRef, yes.command.data], [mode, actionRef, data]);
      assert.deepEqual(no.command, yes.command);
      if (mode === 'invoke') assert.deepEqual(yes.step.card, [0, 3]);
      await on.act();
      await off.act();
    }
    const expectedMotion = axis === 'horizontal' ? [2, 0] : [0, 2];
    assert.deepEqual(on.board.body, axis === 'horizontal' ? [5, 4] : [11, 3]);
    assert.deepEqual(off.board.body, on.board.body);

    const opened = await on.choose(), shut = await off.choose();
    const returned = (refs: string[], revision: number) => {
      const ref = refs.find(x => typeof x === 'string' && x.includes(':revision:' + revision + ':'));
      assert.ok(ref);
      const result = responses.get(ref);
      assert.ok(result);
      return result;
    };
    for (const chosen of [opened, shut]) {
      const calibration = returned(chosen.refs, 2), invocation = returned(chosen.refs, 4);
      assert.deepEqual([calibration.mode, calibration.motion.ACTION4, invocation.mode, invocation.grid_cleared, invocation.before, invocation.after],
        ['calibrate', expectedMotion, 'invoke', true, [on.board.body, 2], [on.board.body, 2]]);
    }
    const changed = on.observation.frame.flatMap((row, y) => row.flatMap((value, x) => value === off.observation.frame[y][x] ? [] : [[x, y]]));
    assert.equal(changed.length, 10);
    for (const [x, y] of on.board.bridge) assert.deepEqual([off.observation.frame[y][x], on.observation.frame[y][x]], [0, 7]);
    assert.deepEqual([opened.step.mode, opened.command.actionRef], ['walk', 'ACTION4']);
    assert.deepEqual([shut.step.mode, shut.command.actionRef, shut.command.data], ['toggle', 'ACTION6', { x: 7, y: 20 }]);
    const retry = await off.act();
    assert.equal(retry.matched, true);
    assert.deepEqual(off.board.body, on.board.body);
    assert.equal(off.observation.frame[20][7], 12);

    assert.equal((await on.act()).matched, true);
    assert.equal(on.board.occupiesOpenedSupport, false);
    const crossing = await on.choose();
    assert.deepEqual([crossing.step.mode, crossing.command.actionRef], ['walk', 'ACTION4']);
    const result = await on.act();
    assert.equal(result.matched, true);
    assert.equal(on.board.occupiesOpenedSupport, true);
    const crossed = axis === 'horizontal' ? [9, 4] : [11, 7];
    assert.deepEqual(on.board.body, crossed);
    assert.deepEqual(crossing.step.expected_after, [crossed, 2]);
    const crossingRecord = () => [...responses.values()].find(e => e.mode === 'walk' && e.ref.includes(':revision:6:'));
    // The confirmed crossing belongs to a retained prefix. The owner acquires it once the prefix seals.
    for (let next = 11; next <= 17 && !crossingRecord(); next += 2) {
      const continuation = await on.choose();
      assert.deepEqual([continuation.step.mode, continuation.command.actionRef], ['walk', 'ACTION4']);
      assert.equal((await on.act()).matched, true);
      assert.deepEqual(on.board.body, axis === 'horizontal' ? [next, 4] : [11, next - 2]);
    }
    const record = crossingRecord();
    assert.ok(record);
    assert.deepEqual([record.before, record.after, record.motion.ACTION4], [crossing.step.body, [crossed, 2], expectedMotion]);
    assert.equal(on.observation.levelsCompleted, 0);
  });
}
