import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { NativePoint } from '../src/logos-engine/v6-native-types.ts';
import { collectLightTiming, exposureMask, searchLightTiming } from '../src/sic/lit-route-timing.ts';
import type { LightRoute, LightTiming } from '../src/sic/lit-route-timing.ts';

const actor: NativePoint = [2, 2], goal: NativePoint = [4, 2];
const view = { actor, goal, light: 1, guardInk: 3, walls: 4 };
const pitch = 2, width = 12, height = 8;
function frame(light?: NativePoint) {
  const rows = Array.from({ length: height + pitch }, () => Array<number>(width).fill(0));
  rows[1]![1] = view.walls;
  if (light) rows[light[1]]![light[0]] = view.light;
  return rows;
}

test('samples a repeat across waits without counting the duplicate idle frame', () => {
  let clock: LightTiming | null = null;
  const phase = (at: number) => frame([3 + at % 5, 5]);
  for (let at = 0; at < 12; at += 4) {
    const before = phase(at), after = phase(at + 4);
    const frames = [before, phase(at + 1), phase(at + 2), phase(at + 3), after, after];
    clock = collectLightTiming(clock, before, after, frames, view, pitch);
    assert.ok(clock);
    assert.equal(clock.waitTicks, 4);
    assert.equal(clock.elapsed, at + 4);
    assert.equal(clock.period, at < 8 ? 0 : 5);
  }
  assert.equal(clock?.samples.length, 5);
});

test('waits when an intermediate footprint is exposed even if the destination will be clear', () => {
  const dark = exposureMask(frame(), view, pitch), blocked = exposureMask(frame([4, 2]), view, pitch);
  const timing = { elapsed: 0, period: 6, waitTicks: 2, samples: [dark, blocked, dark, dark, dark, dark], stopped: false };
  const routes = (from: NativePoint) => from === actor
    ? new Map<string, LightRoute>([['4,2', { point: goal, route: [goal] }]])
    : new Map<string, LightRoute>([['4,2', { point: goal, route: [] }]]);
  assert.deepEqual(searchLightTiming(timing, view, pitch, width, height, routes, 2), { point: actor, route: [], wait: true });
  assert.deepEqual(searchLightTiming({ ...timing, elapsed: 2 }, view, pitch, width, height, routes, 2), { point: goal, route: [goal] });
});
