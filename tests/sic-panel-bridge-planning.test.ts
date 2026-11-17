import assert from 'node:assert/strict';
import test from 'node:test';
import { planPanelBridge } from '../src/sic/panel-bridge-planning.ts';
import { panelTransportPose } from '../src/sic/panel-mechanism-probe.ts';
import type { NativeBox } from '../src/logos-engine/v6-native-types.ts';
import type { PanelWalker } from '../src/sic/panel-context-probe.ts';

test('work backward from newly accessible floor while respecting recorded failed moves', () => {
  const rows = Array.from({ length: 32 }, () => Array<number>(32).fill(5));
  const paint = ([l, t, r, b]: NativeBox, ink: number) => {
    for (let y = t; y <= b; y++) for (let x = l; x <= r; x++) rows[y]![x] = ink;
  };
  paint([0, 4, 7, 7], 2); paint([24, 4, 31, 7], 2);
  paint([14, 4, 17, 25], 0); paint([14, 22, 21, 25], 0);
  paint([8, 16, 13, 19], 12); paint([18, 16, 23, 19], 12); paint([14, 16, 17, 19], 8);
  const held = { tool: [14, 16, 17, 19] as NativeBox, support: [8, 16, 23, 19] as NativeBox };
  const prev = { tool: [14, 20, 17, 23] as NativeBox, support: [8, 20, 23, 23] as NativeBox };
  const walker: PanelWalker = { floor: 2, ink: 14, controls: {
    up: { delta: [0, -2], evidence: 'walk' }, down: { delta: [0, 2], evidence: 'walk' },
    left: { delta: [-2, 0], evidence: 'walk' }, right: { delta: [2, 0], evidence: 'walk' },
  }, contacts: { '14,16': { patch: '8,8,8,8', evidence: 'crossed-tool' } } };
  const moves = [{ key: 'lift', delta: [0, -4] as const, accessCost: 2 }, { key: 'right', delta: [4, 0] as const, accessCost: 0 }];
  const marker: NativeBox = [2, 4, 3, 5], peers = [{ marker, evidence: 'matching-public-code' }];
  const graph = { [panelTransportPose(prev)]: [{ action: 'lift', destination: panelTransportPose(held), evidence: 'measured' }] };
  const field: NativeBox = [0, 0, 31, 31];
  const plan = planPanelBridge(walker, rows, field, held, graph, moves, peers, 10);
  assert.equal(plan?.first.move.key, 'lift');
  assert.equal(plan?.first.evidence, undefined);
  assert.deepEqual(plan?.goal.placement.support, [8, 4, 23, 7]);
  assert.deepEqual(plan?.goal.marker, marker);
  assert.equal(plan?.goal.evidence, 'matching-public-code');
  assert.equal(planPanelBridge(walker, rows, field, held, graph, moves, [], 10), undefined);
  const hidden = rows.map(row => row.map(value => value === 0 ? 5 : value));
  assert.equal(planPanelBridge(walker, hidden, field, held, graph, moves, peers, 10), undefined);
  const recovered = planPanelBridge(walker, hidden, field, held, graph, moves, peers, 10, plan!.target);
  assert.deepEqual(recovered?.goal, plan?.goal, 'a masked rail should not erase the bound bridge target');
  graph[panelTransportPose(held)] = [{ action: 'lift', destination: panelTransportPose(held), evidence: 'stationary' }];
  assert.equal(planPanelBridge(walker, rows, field, held, graph, moves, peers, 10, plan!.target), undefined);
});
