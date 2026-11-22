import assert from 'node:assert/strict';
import test from 'node:test';
import { measureNativeObservation, publicFrameHash } from '../src/logos-engine/v6-native-observer.ts';
import { initialMemory, recordExperiment, selectExperiment } from '../src/sic/preparation-experiments.ts';
import { proposeMobilityTest, measureMobility } from '../src/sic/test-mechanism-mobility.ts';
import { offerMechanism } from '../src/sic/reconfigure-local-mechanism.ts';
import { poseRole } from '../src/sic/occupancy-programs.ts';
type Point = [number, number];
const commands = ['ACTION1', 'ACTION2', 'ACTION3', 'ACTION4', 'ACTION5'];
async function scene(
  i: number,
  p: Point,
  site: Point = [7, 5],
  available = commands,
  split: boolean | 'openGate' = false
) {
  const rows = Array.from({ length: 12 }, () => Array<number>(18).fill(0));
  for (let y = 3; y <= 8; y++)
    for (let x = 2; x <= 13; x++) if (!split || x !== 8 || (split === 'openGate' && y === 5)) rows[y]![x] = 3;
  rows[p[1]]![p[0]] = 9;
  rows[site[1]]![site[0]] = 4;
  const o = await measureNativeObservation(
    {
      frame_rows: rows,
      frame_hash: await publicFrameHash(rows),
      level: 1,
      levels_completed: 0,
      state: 'NOT_FINISHED',
      available_action_refs: available,
    },
    i,
    'zone-source'
  );
  return { o, rows };
}
async function expose(split = false) {
  const m = initialMemory(1);
  let before = await scene(1, [4, 5], undefined, commands, split);
  async function move(q: string, p: Point, site: Point = [7, 5], available = commands) {
    const next = await scene(before.o.revision + 1, p, site, available, split);
    recordExperiment(m, before.o, next.o, { action_ref: q, data: {} }, before.rows, next.rows);
    before = next;
    return next;
  }
  await move('ACTION4', [5, 5]);
  await move('ACTION4', [6, 5]);
  await move('ACTION3', [5, 5]);
  await move('ACTION3', [4, 5]);
  await move('ACTION2', [4, 6]);
  await move('ACTION1', [4, 5]);
  return { m, move, here: () => before };
}
test('only a repeated local return earns the stagnation tag; a mechanism experiment then takes priority', async () => {
  const { m, move, here } = await expose();
  await move('ACTION5', [6, 5]);
  assert.equal(m.localProgress?.last, null);
  await move('ACTION5', [4, 5]);
  assert.equal(m.localProgress?.last, null);
  await move('ACTION5', [6, 5]);
  const tag = m.localProgress!.last!;
  assert.equal(tag.tag, 'stagnation_same_zone');
  assert.equal(tag.connection, 'witnessed_walk');
  assert.ok(tag.previous < tag.revision);
  assert.ok(tag.walkRefs.length);
  assert.deepEqual(tag.from, [8, 10]);
  assert.deepEqual(tag.to, [12, 10]);
  const { o, rows } = here(),
    inputs = commands.map((action_ref) => ({ action_ref, data: {} }));
  const offer = selectExperiment(m, o, inputs, false, rows);
  assert.equal(offer?.phase, 'reconfigureMechanism');
  const job = offer!.mechanism!;
  assert.equal(job.plan.c, poseRole(o.entities.find((e) => e.palette_value === 4)!));
  assert.ok(job.options.length);
  const first = job.plan.steps[0]!,
    next = await scene(
      o.revision + 1,
      [first.to[0] / 2, first.to[1] / 2],
      [first.placed[0] / 2, first.placed[1] / 2]
    );
  const result = recordExperiment(m, o, next.o, { action_ref: first.op, data: {} }, rows, next.rows, offer!);
  assert.equal((result?.mechanism as { matched: boolean }).matched, true);
  assert.equal(result?.localRepeat, undefined);
});
test('a repeat crossing disconnected terrain keeps its navigation value', async () => {
  const { m, move } = await expose(true);
  await move('ACTION5', [10, 5]);
  await move('ACTION5', [4, 5]);
  await move('ACTION5', [10, 5]);
  assert.equal(m.localProgress!.last, null);
});
test('a known return that enables another demonstrated operation keeps its priority', async () => {
  const { m, move } = await expose();
  await move('ACTION1', [4, 5]);
  await move('ACTION5', [6, 5]);
  await move('ACTION1', [6, 5], [7, 4]);
  await move('ACTION2', [6, 5]);
  await move('ACTION5', [4, 5]);
  await move('ACTION5', [6, 5]);
  assert.equal(m.localProgress!.last, null);
});
test('an unchanged new action menu and a newly available command are distinguished', async () => {
  const { m, move } = await expose();
  await move('ACTION5', [6, 5], undefined, [...commands, 'ACTION7']);
  await move('ACTION5', [4, 5]);
  await move('ACTION5', [6, 5], undefined, [...commands, 'ACTION7']);
  assert.equal(m.localProgress!.last, null);
});
test('a failed displacement ends the plan and the same failed contact is not proposed again', async () => {
  const { m, move, here } = await expose();
  await move('ACTION5', [6, 5]);
  await move('ACTION5', [4, 5]);
  await move('ACTION5', [6, 5]);
  const { o, rows } = here(),
    tag = m.localProgress!.last!,
    s = tag.returnScene;
  const x = offerMechanism(m, s, o, rows, new Set(commands), tag)!;
  assert.ok(x.mechanism);
  const step = x.mechanism.plan.steps[0]!;
  assert.equal(step.stage, 'write');
  const next = await scene(o.revision + 1, [6, 5]);
  recordExperiment(m, o, next.o, { action_ref: step.op, data: {} }, rows, next.rows, x);
  assert.equal(m.localProgress!.active, null);
  assert.notEqual(
    offerMechanism(m, s, next.o, rows, new Set(commands), tag)?.mechanism?.plan.key,
    x.mechanism.plan.key
  );
});
test('reuse a measured return when evaluating a new plan from the same public scene', async () => {
  const { m, move, here } = await expose();
  await move('ACTION5', [6, 5]);
  await move('ACTION5', [4, 5]);
  await move('ACTION5', [6, 5]);
  const { o, rows } = here(), tag = m.localProgress!.last!, origin = tag.returnScene;
  const propose = () => offerMechanism(m, origin, o, rows, new Set(commands), tag)?.mechanism;
  const trial = propose()!, step = trial.plan.steps[0]!, occupancy = m.occupancy!;
  const retry = () => { m.localProgress!.active = trial; return propose(); };
  const edge = origin + '/' + step.op;
  assert.equal(step.stage, 'write');
  const other = 1000;
  occupancy.observed[edge] = other;
  occupancy.layouts[other] = { [trial.plan.p]: step.to, [trial.plan.c]: step.placed };
  assert.equal(retry()?.plan.key, trial.plan.key);
  occupancy.observed[edge] = origin;
  assert.notEqual(retry()?.plan.key, trial.plan.key);
  occupancy.observed[edge] = -1;
  assert.equal(retry()?.plan.key, trial.plan.key);
  delete occupancy.observed[edge];
  assert.equal(retry()?.plan.key, trial.plan.key);
});
test('reopening access beyond a previously traversed zone is useful even when the resulting image is familiar', async () => {
  const { m, move } = await expose(true);
  let b = await move('ACTION2', [4, 5], [7, 4]);
  for (const [q, door] of [
    ['ACTION5', 'openGate'],
    ['ACTION3', true],
    ['ACTION5', 'openGate'],
  ] as const) {
    const a = await scene(b.o.revision + 1, [4, 5], [7, 4], commands, door);
    recordExperiment(m, b.o, a.o, { action_ref: q, data: {} }, b.rows, a.rows);
    b = a;
  }
  assert.equal(m.localProgress!.last, null);
});
test('a complete repeated public cycle is detectable before its two ends can be connected by walking', async () => {
  const { m, move } = await expose(true);
  await move('ACTION5', [10, 5]);
  await move('ACTION5', [4, 5]);
  await move('ACTION5', [10, 5]);
  assert.equal(m.localProgress!.last, null);
  await move('ACTION5', [4, 5]);
  const tag = m.localProgress!.last!;
  assert.equal(tag.tag, 'stagnation_repeated_cycle');
  assert.equal(tag.connection, 'closed_public_cycle');
  assert.deepEqual(tag.cycle!.word, ['ACTION5', 'ACTION5']);
  assert.ok(tag.cycle!.refs.every((ref) => ref <= tag.cycle!.startRevision));
});
test('when the displacement is unknown an untried control can test the mobility of named persistent parts', async () => {
  const { m, move, here } = await expose();
  await move('ACTION5', [6, 5]);
  await move('ACTION5', [4, 5]);
  await move('ACTION5', [6, 5]);
  const tag = m.localProgress!.last!,
    { o, rows } = here();
  const test = proposeMobilityTest(m, tag.returnScene, o, rows, new Set(commands), tag)!.mobilityProbe!;
  assert.notEqual(test.op, tag.op);
  assert.equal(m.occupancy!.observed[tag.returnScene + '/' + test.op], undefined);
  const changed = await scene(o.revision + 1, [6, 5], [7, 6]);
  const measured = measureMobility(test, o, changed.o, changed.rows, test.op);
  assert.equal(measured.moved, 1);
  assert.ok(measured.outcomes.some((s) => s.status === 'moved' && s.actual?.join() === '14,12'));
  const gone = await scene(o.revision + 1, [6, 5]);
  assert.equal(measureMobility(test, o, gone.o, gone.rows, test.op).moved, 0);
});
