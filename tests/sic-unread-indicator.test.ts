import assert from 'node:assert/strict';
import test from 'node:test';
import { measureNativeObservation, publicFrameHash } from '../src/logos-engine/v6-native-observer.ts';
import { createPreparedEffects } from '../src/sic/test-prepared-effects.ts';

async function frame(revision: number, subject: number, mark: number | null, peer = false) {
  const rows = Array.from({ length: 16 }, () => Array<number>(30).fill(0));
  rows[6]![subject] = 9;
  if (peer) rows[10]![24] = 9;
  if (mark !== null) rows[6]![mark] = 4;
  const o = await measureNativeObservation(
    {
      frame_rows: rows,
      frame_hash: await publicFrameHash(rows),
      level: 1,
      levels_completed: 0,
      state: 'NOT_FINISHED',
      available_action_refs: ['ACTION1', 'ACTION2', 'ACTION5'],
    },
    revision,
    'source-example'
  );
  return { o, rows };
}
const cmd = (action_ref: string) => ({ action_ref, data: {} });
const propose = (f: ReturnType<typeof createPreparedEffects>, s: Awaited<ReturnType<typeof frame>>) =>
  f.proposeInGroup!('explore', s.o, s.rows, [], 32);
async function onset(peer = false) {
  const f = createPreparedEffects(),
    a = await frame(1, 2, null, peer),
    b = await frame(2, 3, null, peer),
    c = await frame(3, 3, 11, peer);
  await f.observePublicOutcome!(a.o, b.o, cmd('ACTION1'), a.rows, b.rows);
  await f.observePublicOutcome!(b.o, c.o, cmd('ACTION2'), b.rows, c.rows);
  return { f, c };
}
test('an untested displayed arrival initiates a falsifiable action sequence and becomes witnessed after the actual landing', async () => {
  const { f, c } = await onset(),
    one = await propose(f, c);
  const first = one?.experiment.unreadIndicator;
  assert.ok(first);
  assert.deepEqual(first.cue.origin, [6, 12]);
  assert.deepEqual(first.cue.site, [22, 12]);
  const still = await frame(4, 3, 11);
  const a = await f.record!(c.o, still.o, one!.actions[0]!, c.rows, still.rows, one!, 0, []);
  assert.equal((a.events[0]!.unreadIndicator as { canContinue: boolean }).canContinue, true);
  const stored = createPreparedEffects();
  stored.restore!(f.state!());
  const two = await propose(stored, still),
    second = two?.experiment.unreadIndicator;
  assert.ok(second);
  assert.notEqual(second.op, first.op);
  assert.deepEqual(second.word, [first.op, second.op]);
  const landed = await frame(5, 11, null);
  const ret = await stored.record!(still.o, landed.o, two!.actions[0]!, still.rows, landed.rows, two!, 0, []);
  assert.equal((ret.events[0]!.unreadIndicator as { status: string }).status, 'realized');
  assert.ok(
    Object.values(
      (stored.state!() as ReturnType<typeof import('../src/sic/preparation-experiments.ts').initialMemory>)
        .previewLearning!.bindings
    ).some((b) => b.actor === first.cue.p && b.indicator === first.cue.r && b.gesture.op === second.op)
  );
});
test('losing the indication ends the outstanding experiment', async () => {
  const { f, c } = await onset(),
    one = await propose(f, c);
  assert.ok(one?.experiment.unreadIndicator);
  const gone = await frame(4, 3, null);
  const a = await f.record!(c.o, gone.o, one.actions[0]!, c.rows, gone.rows, one, 0, []);
  assert.equal((a.events[0]!.unreadIndicator as { canContinue: boolean }).canContinue, false);
  assert.equal((await propose(f, gone))?.experiment.unreadIndicator, undefined);
});
test('an unresolved duplicate subject cannot supply a unique indicator binding', async () => {
  const { f, c } = await onset(true);
  assert.equal((await propose(f, c))?.experiment.unreadIndicator, undefined);
});
