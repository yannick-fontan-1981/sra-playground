import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import test from 'node:test';
import { emptySurfaceMemory, planSurfacePrefix, rememberSurfaceStep, surfaceStepCurrent,
  type SurfaceMemory, type SurfaceView } from '../src/sic/observed-surfaces.ts';
import type { NativePoint } from '../src/logos-engine/v6-native-types.ts';

const publicRun = JSON.parse(gunzipSync(readFileSync(new URL('../docs/diagnostics/sic-surface-goal-access-20261127/public-map-before.json.gz', import.meta.url))));
const firstLoss = publicRun.samples.find((sample: any) => sample.levelAction === 30) as {
  memoryBefore: SurfaceMemory; first: SurfaceView; action: { id: number };
};

test('the first public priority loss selects the visible route toward the disconnected goal', () => {
  const memory = structuredClone(firstLoss.memoryBefore), old = structuredClone(memory);
  const prefix = planSurfacePrefix(memory, firstLoss.first.address, 51, 16);
  assert.equal(firstLoss.action.id, 1);
  assert.equal(prefix[0]?.direction, 1, 'Continue across the current support instead of reversing toward an unrelated frontier');
  assert.equal(prefix.length, 10);
  assert.ok(prefix.slice(0, -1).every(step => step.expected));
  assert.equal(prefix.at(-1)?.kind, 'probe');
  assert.equal(prefix.at(-1)?.expected, null, 'The candidate destination is not an acquired link');
  assert.ok(surfaceStepCurrent(firstLoss.first, memory, prefix[0]!));
  assert.deepEqual(memory, old, 'Planning a hypothesis cannot acquire it');
});

test('rotated public cells, relocated geometry and renamed surfaces preserve the goal connection', () => {
  const point = ([x, y]: NativePoint): NativePoint => [y + 7, 25 - x], direction = [2, 3, 1, 0] as const;
  const key = (p: NativePoint) => p.join(','), cell = (s: string) => s.split(',').map(Number) as NativePoint;
  const address = (a: SurfaceView['address']) => ({ floor: 'rotated-' + a.floor, cell: point(a.cell) });
  const map = (s: SurfaceView['surface']) => ({ free: s.free.map(k => key(point(cell(k)))),
    gates: Object.fromEntries(Object.entries(s.gates).map(([k, value]) => [key(point(cell(k))), direction[value]])),
    goal: s.goal ? point(s.goal) : null });
  const addressKey = (value: string) => { const [floor, at] = value.split('/'); return 'rotated-' + floor + '/' + key(point(cell(at!))); };
  const stepKey = (value: string) => { const [floor, at, d] = value.split('/'); return addressKey(floor + '/' + at) + '/' + direction[Number(d)]!; };
  const old = firstLoss.memoryBefore;
  const memory: SurfaceMemory = { floors: Object.fromEntries(Object.entries(old.floors).map(([f, m]) => ['rotated-' + f, map(m)])),
    steps: Object.fromEntries(Object.entries(old.steps).map(([k, v]) => [stepKey(k), address(v)])),
    links: Object.fromEntries(Object.entries(old.links).map(([k, v]) => [addressKey(k), address(v)])), blocked: old.blocked.map(stepKey) };
  const view = { address: address(firstLoss.first.address), surface: map(firstLoss.first.surface) };
  const prefix = planSurfacePrefix(memory, view.address, 51, 16);
  assert.equal(prefix[0]?.direction, 3, 'The rotated scene uses a different directional command');
  assert.equal(prefix.at(-1)?.expected, null);
  assert.ok(surfaceStepCurrent(view, memory, prefix[0]!));
});

test('a changed visible support or opening refuses the next committed movement', () => {
  const step = planSurfacePrefix(firstLoss.memoryBefore, firstLoss.first.address, 51, 16)[0]!;
  const missing = structuredClone(firstLoss.first);
  missing.surface.free = missing.surface.free.filter(key => key !== step.expected!.cell.join(','));
  assert.equal(surfaceStepCurrent(missing, firstLoss.memoryBefore, step), false);
  const changed = structuredClone(firstLoss.first);
  changed.surface.gates[changed.address.cell.join(',')] = 2;
  assert.equal(surfaceStepCurrent(changed, firstLoss.memoryBefore, step), false);
});

test('an ambiguous candidate opening remains one experiment until its actual destination is observed', () => {
  const memory: SurfaceMemory = { ...emptySurfaceMemory(), floors: {
    source: { free: ['0,0'], gates: { '1,0': 2 }, goal: null },
    one: { free: ['2,0'], gates: { '1,0': 3 }, goal: [2, 0] },
    two: { free: ['2,0'], gates: { '1,0': 3 }, goal: [2, 0] },
  } };
  const start = { floor: 'source', cell: [0, 0] as NativePoint };
  const prefix = planSurfacePrefix(memory, start, 20, 16);
  assert.equal(prefix.length, 1);
  assert.equal(prefix[0]!.kind, 'probe'); assert.equal(prefix[0]!.expected, null);
  assert.deepEqual(memory.links, {});
  const actual = rememberSurfaceStep(memory, { address: start, surface: memory.floors.source! },
    { address: { floor: 'two', cell: [1, 0] }, surface: memory.floors.two! }, prefix[0]!);
  assert.equal(actual.links['source/1,0']!.floor, 'two');
  assert.deepEqual(actual.floors.one, memory.floors.one, 'An alternative visible surface remains an independent fact');
});

test('an entirely acquired route is preferred over a shorter candidate crossing', () => {
  const memory: SurfaceMemory = { ...emptySurfaceMemory(), floors: {
    known: { free: ['0,0', '0,1', '0,2', '1,2', '2,2', '2,1', '2,0'], gates: { '1,0': 2 }, goal: [2, 0] },
    candidate: { free: ['2,0'], gates: { '1,0': 3 }, goal: [2, 0] },
  } };
  const prefix = planSurfacePrefix(memory, { floor: 'known', cell: [0, 0] }, 20, 16);
  assert.equal(prefix.length, 6); assert.ok(prefix.every(step => step.expected !== null));
  assert.equal(prefix[0]!.direction, 1);
});

test('the executable surface prefix respects both native and remaining limits', () => {
  assert.ok(planSurfacePrefix(firstLoss.memoryBefore, firstLoss.first.address, 1, 16).length <= 1);
  assert.ok(planSurfacePrefix(firstLoss.memoryBefore, firstLoss.first.address, 51, 4).length <= 4);
  assert.deepEqual(planSurfacePrefix(firstLoss.memoryBefore, firstLoss.first.address, 0, 16), []);
});
