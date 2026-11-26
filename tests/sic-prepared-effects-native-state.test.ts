import assert from 'node:assert/strict';
import test from 'node:test';
import { canonical } from '../src/logos-engine/canonical.ts';
import { NativeKnowledgeStore } from '../src/logos-engine/v6-knowledge-store.ts';
import { retainNativeJson } from '../src/logos-engine/v6-native-owned.ts';
import { measureNativeObservation, publicFrameHash } from '../src/logos-engine/v6-native-observer.ts';
import { createPreparedEffects } from '../src/sic/test-prepared-effects.ts';
import { initialMemory } from '../src/sic/preparation-experiments.ts';

const stateId = 'family_state:sic_test_prepared_effects';
const cause = (statement: string) => ({ workflow: 'prepared-state-test', step: 'family', statement });

test('native restoration preserves legacy defaults and owns a mutable copy of the authoritative graph', async () => {
  const source: any = initialMemory(3);
  source.turns = 17;
  for (const field of ['delayed', 'frontier', 'projection', 'space', 'equations']) delete source[field];
  source.extra = { number: -0, fraction: 0.125, literal: { $v6_float64: 'user-data' },
    property: Object.fromEntries([['__proto__', { retained: true }]]) };
  const store = new NativeKnowledgeStore('prepared-source', 'prepared-scope');
  await store.commit([{ id: stateId, kind: 'family_state', family: 'sic_test_prepared_effects',
    value: retainNativeJson(source) }], cause('legacy-state'));
  const graphState = store.value(stateId) as any;
  const publicFamily = createPreparedEffects(), nativeFamily = createPreparedEffects();
  publicFamily.restore(structuredClone(graphState));
  nativeFamily.restoreNative!(graphState);
  assert.deepEqual(nativeFamily.state(), publicFamily.state());
  assert.equal(nativeFamily.state().frontier.lastEdge, 17);
  assert.equal(nativeFamily.state().frontier.lastScene, 17);
  assert.ok(Object.is(nativeFamily.state().extra.number, -0));
  assert.notEqual(nativeFamily.state(), graphState);
  assert.notEqual(nativeFamily.state().extra, graphState.extra);

  const saved = nativeFamily.nativeState!();
  assert.ok(Object.isFrozen(saved) && Object.isFrozen(saved.extra.property.__proto__));
  assert.equal(nativeFamily.nativeState!(), saved);
  nativeFamily.state().scenes.push('new observed scene');
  nativeFamily.state().extra.property.__proto__.retained = false;
  assert.deepEqual(saved.scenes, []);
  assert.equal(saved.extra.property.__proto__.retained, true);
  assert.equal(graphState.extra.property.__proto__.retained, true);
  const changed = nativeFamily.nativeState!();
  assert.notEqual(changed, saved);
  assert.equal(changed.equations, saved.equations);
  nativeFamily.restoreNative!(saved);
  assert.deepEqual(nativeFamily.state(), publicFamily.state());
  assert.notEqual(nativeFamily.state().extra, saved.extra);
});

test('foreign restore inputs keep public clone behavior and failures preserve the working state', () => {
  const publicFamily = createPreparedEffects(), nativeFamily = createPreparedEffects();
  let reads = 0;
  const shared = { value: 3 }, source: any = initialMemory(2);
  source.extra = { left: shared, right: shared, map: new Map([['key', shared]]) };
  Object.defineProperty(source, 'observed', { enumerable: true, get() { reads++; return { value: 8 }; } });
  publicFamily.restore(source);
  nativeFamily.restoreNative!(source);
  assert.equal(reads, 2);
  assert.deepEqual(nativeFamily.state(), publicFamily.state());
  assert.equal(nativeFamily.state().extra.left, nativeFamily.state().extra.right);
  assert.equal(nativeFamily.state().extra.map.get('key'), nativeFamily.state().extra.left);
  shared.value = 9;
  assert.equal(nativeFamily.state().extra.left.value, 3);
  for (const family of [publicFamily, nativeFamily]) {
    const restore = family === nativeFamily ? family.restoreNative!.bind(family) : family.restore.bind(family);
    const before = family.state();
    for (const rejected of [new Proxy(initialMemory(0), {}), { ...initialMemory(0), extra: () => 1 }]) {
      assert.throws(() => restore(rejected), { name: 'DataCloneError' });
      assert.equal(family.state(), before);
    }
  }
});

async function frame(revision: number, subject: number, mark: number | null, level = 1) {
  const rows = Array.from({ length: 16 }, () => Array<number>(30).fill(0));
  rows[6]![subject] = 9;
  if (mark !== null) rows[6]![mark] = 4;
  const o = await measureNativeObservation({ frame_rows: rows, frame_hash: await publicFrameHash(rows),
    level, levels_completed: level - 1, state: 'NOT_FINISHED', available_action_refs: ['ACTION1', 'ACTION2', 'ACTION5'] },
  revision, 'prepared-state-source');
  return { o, rows };
}
const cmd = (action_ref: string) => ({ action_ref, data: {} });

for (const result of ['landing', 'lost-indication'] as const) {
  test(`native checkpoints preserve proposals, acquisitions and full graph chains after ${result}`, async () => {
    const publicFamily = createPreparedEffects(), nativeFamily = createPreparedEffects();
    const families = [publicFamily, nativeFamily];
    const stores = families.map(() => new NativeKnowledgeStore('prepared-source', 'prepared-scope'));
    let previous: ReturnType<typeof publicFamily.state> | undefined, revision = 0;
    async function roundTrip() {
      const checkpoints = [previous = retainNativeJson(publicFamily.state(), previous), nativeFamily.nativeState!()];
      assert.deepEqual(checkpoints[1], checkpoints[0]);
      for (let index = 0; index < stores.length; index++) {
        await stores[index]!.commit([{ id: stateId, kind: 'family_state', family: publicFamily.id,
          value: checkpoints[index], evidence: [`return:${revision}`] }], cause(`checkpoint:${revision}`));
      }
      revision++;
      assert.equal(canonical(stores[0]!.memory), canonical(stores[1]!.memory));
      publicFamily.restore(structuredClone(stores[0]!.value(stateId)) as any);
      nativeFamily.restoreNative!(stores[1]!.value(stateId) as any);
      assert.deepEqual(nativeFamily.state(), publicFamily.state());
    }
    const a = await frame(1, 2, null), b = await frame(2, 3, null), c = await frame(3, 3, 11);
    await roundTrip();
    for (const [before, after, command] of [[a, b, 'ACTION1'], [b, c, 'ACTION2']] as const) {
      for (const family of families) await family.observePublicOutcome!(before.o, after.o, cmd(command), before.rows, after.rows);
      await roundTrip();
    }
    let current = c;
    for (const after of [await frame(4, 3, 11), await frame(5, result === 'landing' ? 11 : 3, null)]) {
      const offers = await Promise.all(families.map(family => family.proposeInGroup!('explore', current.o, current.rows, [], 32)));
      assert.ok(offers[0]?.experiment.unreadIndicator);
      assert.deepEqual(offers[1], offers[0]);
      await roundTrip();
      const receipts = [];
      for (let index = 0; index < families.length; index++) {
        const offer = offers[index]!;
        receipts.push(await families[index]!.record!(current.o, after.o, offer.actions[0]!, current.rows, after.rows, offer, 0, []));
      }
      assert.deepEqual(receipts[1], receipts[0]);
      await roundTrip();
      current = after;
    }
    const next = await frame(6, 4, 12, 2);
    for (const family of families) await family.observePublicOutcome!(current.o, next.o, cmd('ACTION1'), current.rows, next.rows);
    await roundTrip();
    const offers = await Promise.all(families.map(family => family.proposeInGroup!('explore', next.o, next.rows, [], 32)));
    assert.deepEqual(offers[1], offers[0]);
    await roundTrip();
  });
}
