import assert from 'node:assert/strict';
import test from 'node:test';
import { chartPointKey, type ChartEdge, type ChartRectangle, type MeasuredChart } from '../src/logos-engine/v6-chart-navigation-geometry.ts';
import { measureNativeObservation } from '../src/logos-engine/v6-native-observer.ts';
import { createSicChartRoute } from '../src/sic/chart-route.ts';

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
