import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { symbolicDigest } from '../src/logos-engine/v6-hash.ts';
import { measureExposedReception, measureLargeExposedReception, measureSmallExposedReception,
  exposedReceptionInputCandidates, exposedReceptionPlanIdentity, exposedReceptionProjection } from '../src/logos-engine/v6-exposed-reception-observation.ts';
import { receptionRaster } from './helpers/v6-exposed-reception-raster.ts';

type R = Record<string, any>;

test('all 100 untouched public initial rasters preserve both source projection grammars and their fallback order', () => {
  const root = new URL('../', import.meta.url);
  const fixture = JSON.parse(gunzipSync(readFileSync(new URL('tests/fixtures/v6-exposed-reception-parity.json.gz', root))).toString());
  const raw = readFileSync(new URL(fixture.initialPublicCorpus.path, root));
  assert.equal(createHash('sha256').update(raw).digest('hex'), fixture.initialPublicCorpus.sha256);
  assert.equal(fixture.initialPublicCorpus.recordedActions, 0); assert.equal(fixture.initialPublicCorpus.recordedLevelJumps, 0);
  const corpus = JSON.parse(gunzipSync(raw).toString());
  assert.equal(fixture.initialMeasurements.length, 100); assert.equal(corpus.games.length, 100);
  for (const item of fixture.initialMeasurements as R[]) {
    const view = corpus.games.find((entry: R) => entry.game === item.game);
    assert.equal(view.observation.frame_hash, item.frameHash);
    assert.deepEqual(measureLargeExposedReception(view.packet.frame_rows), item.largeScene, `${item.game}:large`);
    assert.deepEqual(measureSmallExposedReception(view.packet.frame_rows), item.smallScene, `${item.game}:small`);
    assert.deepEqual(measureExposedReception(view.packet.frame_rows), item.scene, `${item.game}:fallback`);
  }
  assert.ok(fixture.initialMeasurements.some((item: R) => item.scene !== null));
  assert.ok(fixture.initialMeasurements.some((item: R) => item.scene === null));
});

test('two source lattice grammars measure body, receiver, actor and orientation from public pixels', () => {
  for (const pitch of [4, 5] as const) {
    const rows = receptionRaster({ pitch }), scene = measureExposedReception(rows)!;
    assert.deepEqual(scene.origin, [8, 8]); assert.equal(scene.pitch, pitch); assert.deepEqual(scene.size, [8, 6]);
    assert.deepEqual(scene.actor, [1, 2]); assert.equal(scene.actor_color, 4);
    assert.deepEqual(scene.bodies, [{ pos: [2, 2], color: 7 }]);
    assert.deepEqual(scene.slots, [{ pos: [5, 2], color: 7 }]);
    assert.equal(scene.walls.length, 24); assert.equal(scene.dial.length, 8);
    assert.deepEqual(scene.orientation, [-4, -4]);
    assert.deepEqual(pitch === 4 ? measureSmallExposedReception(rows) : measureLargeExposedReception(rows), scene);
    assert.equal(pitch === 4 ? measureLargeExposedReception(rows) : measureSmallExposedReception(rows), null);
  }
});

test('palette permutation and translated lattice preserve measured structural roles without fixed color meanings', () => {
  const rows = receptionRaster({ pitch: 5 }), original = measureExposedReception(rows)!;
  const recolored = rows.map(row => row.map(color => (color + 5) % 16)), changed = measureExposedReception(recolored)!;
  for (const field of ['origin', 'pitch', 'size', 'actor', 'walls', 'dial', 'orientation']) assert.deepEqual(changed[field], original[field]);
  assert.equal(changed.actor_color, 9); assert.deepEqual(changed.bodies, [{ pos: [2, 2], color: 12 }]);
  assert.deepEqual(changed.slots, [{ pos: [5, 2], color: 12 }]); assert.notEqual(changed.layout, original.layout);
  const translated = rows.map(row => [...row]);
  for (let y = 0; y < 45; y++) translated[y]!.fill(0);
  for (let y = 0; y < 44; y++) for (let x = 0; x < 63; x++) translated[y + 1]![x + 1] = rows[y]![x]!;
  const moved = measureExposedReception(translated)!;
  assert.deepEqual(moved.origin, [9, 9]);
  for (const field of ['pitch', 'size', 'actor', 'actor_color', 'bodies', 'slots', 'walls', 'dial', 'orientation']) assert.deepEqual(moved[field], original[field]);
  assert.notEqual(moved.layout, original.layout);
});

test('small receiver overlap remains a conditional underlay and requires the matching measured receiver color', () => {
  const rows = receptionRaster({ bodies: [{ pos: [5, 2], color: 7, overlap: true }] });
  const scene = measureSmallExposedReception(rows)!;
  assert.deepEqual(scene.bodies, [{ pos: [5, 2], color: 7, underlay: 'receiver_overlap_candidate' }]);
  const mismatch = receptionRaster({ bodies: [{ pos: [5, 2], color: 7, overlap: true }], slots: [{ pos: [5, 2], color: 6 }] });
  assert.equal(measureSmallExposedReception(mismatch), null);
});

test('small grammar excludes body-like cores in patterns established as walls', () => {
  const rows = receptionRaster(), topX = 8 + 3 * 4;
  for (let dy = 1; dy <= 2; dy++) for (let dx = 1; dx <= 2; dx++) rows[8 + dy]![topX + dx] = 7;
  const interiorY = 8 + 3 * 4;
  for (let dy = 0; dy < 4; dy++) for (let dx = 0; dx < 4; dx++) rows[interiorY + dy]![topX + dx] = rows[8 + dy]![topX + dx]!;
  const scene = measureSmallExposedReception(rows)!;
  assert.deepEqual(scene.bodies, [{ pos: [2, 2], color: 7 }]);
  assert.ok(scene.walls.some((pos: number[]) => pos[0] === 3 && pos[1] === 3));
});

test('missing receiver, unequal body count and ambiguous actor refuse the structural scene', () => {
  for (const pitch of [4, 5] as const) {
    assert.equal(measureExposedReception(receptionRaster({ pitch, slots: [] })), null);
    assert.equal(measureExposedReception(receptionRaster({ pitch, bodies: [{ pos: [2, 2], color: 7 }, { pos: [3, 3], color: 7 }] })), null);
    const rows = receptionRaster({ pitch }), originX = 8 + pitch, originY = 8 + 2 * pitch;
    const secondX = 8 + 3 * pitch, secondY = 8 + 3 * pitch;
    for (let dy = 1; dy < pitch - 1; dy++) for (let dx = 1; dx < pitch - 1; dx++) rows[secondY + dy]![secondX + dx] = rows[originY + dy]![originX + dx]!;
    assert.equal(measureExposedReception(rows), null);
  }
});

test('orientation needs exactly eight dial rings and exactly one non-dominant occurrence', () => {
  for (const pitch of [4, 5] as const) {
    const noAccent = receptionRaster({ pitch }).map(row => row.map(color => color === 9 ? 8 : color));
    assert.equal(measureExposedReception(noAccent), null);
    const twoAccents = receptionRaster({ pitch });
    for (let y = 47; y <= 49; y++) for (let x = 53; x <= 55; x++) if (twoAccents[y]![x] === 8) twoAccents[y]![x] = 9;
    assert.equal(measureExposedReception(twoAccents), null);
    const missing = receptionRaster({ pitch });
    for (let y = 47; y <= 49; y++) for (let x = 53; x <= 55; x++) missing[y]![x] = 0;
    assert.equal(measureExposedReception(missing), null);
    const changed = measureExposedReception(receptionRaster({ pitch, activeDial: 7 }))!;
    assert.deepEqual(changed.orientation, [4, 4]);
    assert.equal(changed.layout, measureExposedReception(receptionRaster({ pitch }))!.layout);
  }
});

test('source layout excludes changing poses and orientation while retaining receiver identity', () => {
  for (const pitch of [4, 5] as const) {
    const original = measureExposedReception(receptionRaster({ pitch }))!;
    const moved = measureExposedReception(receptionRaster({ pitch, actor: [1, 3], bodies: [{ pos: [3, 2], color: 7 }], activeDial: 4 }))!;
    assert.equal(moved.layout, original.layout);
    assert.notDeepEqual(exposedReceptionProjection(moved), exposedReceptionProjection(original));
    const receiverChanged = measureExposedReception(receptionRaster({ pitch, slots: [{ pos: [6, 2], color: 7 }] }))!;
    assert.notEqual(receiverChanged.layout, original.layout);
  }
});

test('input candidates append all measured dial points only when available and keep source dedup order', () => {
  const rows = receptionRaster(), known = { action_ref: 'ACTION6', data: { x: 58, y: 56 } };
  const inherited = [{ action_ref: 'ACTION2' }, known, { action_ref: 'ACTION1' }, { action_ref: 'ACTION2' }];
  assert.deepEqual(exposedReceptionInputCandidates(rows, ['ACTION1'], inherited), inherited.slice(0, 3));
  const candidates = exposedReceptionInputCandidates(rows, ['ACTION6'], inherited);
  assert.equal(candidates.length, 10); assert.deepEqual(candidates.slice(0, 3), inherited.slice(0, 3));
  assert.notEqual(candidates[1], known, 'the later duplicate replaces the value without moving its insertion position');
  assert.deepEqual(candidates.slice(3).map(value => [value.data.x, value.data.y]),
    [[50, 48], [54, 48], [58, 48], [50, 52], [58, 52], [50, 56], [54, 56]]);
});

test('scene and projection results are detached and body ordering is numeric lexicographic', () => {
  const rows = receptionRaster(), untouched = structuredClone(rows), scene = measureExposedReception(rows)!;
  scene.bodies[0].pos[0] = 99; scene.dial[0].vector[0] = 99;
  assert.deepEqual(scene.orientation, [-4, -4], 'source plain copies orientation separately from its dial vector');
  assert.deepEqual(rows, untouched); assert.deepEqual(measureExposedReception(rows)!.bodies, [{ pos: [2, 2], color: 7 }]);
  const source = { actor: [1, 2], bodies: [{ pos: [10, 1], color: 3 }, { pos: [2, 10], color: 9 }, { pos: [2, 3], color: 7 }] };
  const projected = exposedReceptionProjection(source);
  assert.deepEqual(projected, { actor: [1, 2], bodies: [[[2, 3], 7], [[2, 10], 9], [[10, 1], 3]] });
  projected.actor[0] = 50; projected.bodies[0][0][0] = 50;
  assert.deepEqual(source.actor, [1, 2]); assert.deepEqual(source.bodies[2]!.pos, [2, 3]);
});

test('plan identity retains Python float geometry while point coordinates and unrelated integers remain integers', () => {
  const plan: R = { scene: { origin: [8, 8], orientation: [0, -2], dial: [{ point: [4, 5], vector: [0, -2], active: true }] },
    kind: 'symbolique é 😀', commands: [{ action_ref: 'ACTION6', data: { x: 4, y: 5 } }], epoch: 1 };
  // sha256(json.dumps(plan, sort_keys=True, separators=(',', ':'))) in the
  // original Python identity with orientation/vector [0.0, -2.0].
  assert.equal(exposedReceptionPlanIdentity(plan), '43b49a2c5caa47e696ee5bb7f0b912f6d3764de9fd03a10c7e5992e6ad52375e');
  assert.notEqual(exposedReceptionPlanIdentity(plan), symbolicDigest(plan));
});
