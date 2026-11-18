import assert from 'node:assert/strict';
import test from 'node:test';
import { chartEdgeKey, chartPointKey, type ChartEdge, type ChartRectangle, type MeasuredChart } from '../src/logos-engine/v6-chart-navigation-geometry.ts';
import { measureNativeObservation } from '../src/logos-engine/v6-native-observer.ts';
import { createSicChartRoute } from '../src/sic/chart-route.ts';
import { measureCompactChart } from '../src/sic/compact-chart.ts';

const node = (x: number, y: number, inside: number): ChartRectangle => ({
  center: [x, y], bbox: [x - 2, y - 2, x + 2, y + 2], size: 5, edge: 3, corner: 3, inside, center_value: inside,
});

function link(from: ChartRectangle, to: ChartRectangle, annotation: number): ChartEdge[] {
  const dx = Math.sign(to.center[0] - from.center[0]), dy = Math.sign(to.center[1] - from.center[1]);
  return [{ from: from.center, to: to.center, delta: [dx, dy], annotation },
    { from: to.center, to: from.center, delta: [-dx, -dy], annotation }];
}

test('a room that already revealed a chart can be crossed on the return from a key', async () => {
  const origin = node(2, 8, 9), revealed = node(8, 8, 9), current = node(14, 8, 9), exit = node(20, 8, 9);
  const keyRoom = node(14, 2, 5), slot = node(4, 16, 0);
  const chart: MeasuredChart = { nodes: [origin, revealed, current, exit, keyRoom],
    links: [...link(origin, revealed, 13), ...link(revealed, current, 13), ...link(current, exit, 5), ...link(current, keyRoom, 13)],
    origin: origin.center, current: current.center, pitch: 6, goal_annotation_hypothesis: 9,
    slots: [slot], slot_background: 0, field_bottom: 14, evidence: ['chart'], epoch: 1 };
  const rows = Array.from({ length: 20 }, () => Array<number>(24).fill(0));
  rows[16]![4] = 5;
  const observation = await measureNativeObservation({ frame_rows: rows, frame_hash: 'with-key', level: 1,
    levels_completed: 0, state: 'NOT_FINISHED', available_action_refs: ['ACTION1', 'ACTION2', 'ACTION3', 'ACTION4'] }, 1);
  const family = createSicChartRoute();
  family.restore({ state: { chart, positions: [keyRoom.center], open: [], visited: [chartPointKey(keyRoom.center)],
    attempts: [], evidence: ['chart'], frame: observation.frame_hash, chartRooms: [revealed, current].map(room => chartPointKey(room.center)) } });
  const proposal = await family.propose(observation, rows, [], 4);
  assert.equal(proposal?.actions[0]?.action_ref, 'ACTION2');
  assert.deepEqual(proposal?.edges[0]?.to, current.center);
});

test('register touching rooms and read a gated edge from the room boundary', async () => {
  const origin = node(12, 30, 9), previous = { ...node(18, 30, 9), corner: 0 }, landing = node(24, 30, 9);
  const retained: MeasuredChart = { nodes: [origin, previous, landing], pitch: 6,
    links: [...link(origin, previous, 13), ...link(previous, landing, 13)], origin: origin.center, current: previous.center,
    goal_annotation_hypothesis: 9, slots: [], slot_background: 4, field_bottom: 53, evidence: ['old-chart'], epoch: 1 };
  const rows = Array.from({ length: 64 }, () => Array<number>(64).fill(5));
  for (const spec of [
    { ...node(12, 30, 9), center_value: 0 }, node(17, 30, 9),
    { ...node(22, 30, 9), corner: 0 }, node(22, 25, 12), node(27, 30, 9),
  ]) {
    const [l, t, r, b] = spec.bbox;
    for (let y = t; y <= b; y++) for (let x = l; x <= r; x++) {
      rows[y]![x] = (x === l || x === r) && (y === t || y === b) ? spec.corner
        : x === l || x === r || y === t || y === b ? spec.edge : spec.inside!;
    }
    rows[spec.center[1]]![spec.center[0]] = spec.center_value;
  }
  for (let y = 23; y <= 36; y++) rows[y]!.fill(12, 58);
  const observation = await measureNativeObservation({ frame_rows: rows, frame_hash: 'compact', level: 1, levels_completed: 0,
    state: 'NOT_FINISHED', available_action_refs: ['ACTION1', 'ACTION2', 'ACTION3', 'ACTION4'] }, 1);
  const chart = measureCompactChart(rows, observation, retained, [landing.center]);
  assert.ok(chart);
  assert.equal(chart.pitch, 5);
  assert.deepEqual(chart.current, [22, 30]);
  const exit = chart.links.find(edge => chartEdgeKey(edge) === chartEdgeKey({ from: [22, 30], to: [27, 30] }));
  assert.equal(exit?.annotation, 12);
  assert.ok(chart.unconfirmed.includes(chartEdgeKey({ from: [22, 30], to: [22, 25] })));
  assert.equal(measureCompactChart(rows, observation, retained, [previous.center]), null);
});
