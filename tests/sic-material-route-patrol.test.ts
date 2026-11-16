import assert from 'node:assert/strict';
import test from 'node:test';
import type { AlternatingActor } from '../src/logos-engine/v6-alternating-graph-observation.ts';
import type { AlternatingTopology } from '../src/logos-engine/v6-alternating-graph-questions.ts';
import { planPatrolStep, type PatrolMemory } from '../src/sic/material-route-patrol.ts';

test('the same player position takes a different route when the patrol phase changes', () => {
  const links = [
    ['0,1', '1,1'], ['1,1', '2,1'], ['2,1', '3,1'], ['3,1', '4,1'],
    ['2,-1', '2,0'], ['2,0', '2,1'], ['2,1', '2,2'],
  ];
  const edges = new Map<string, Set<string>>();
  for (const [a, b] of links) for (const [from, to] of [[a!, b!], [b!, a!]]) {
    if (!edges.has(from)) edges.set(from, new Set());
    edges.get(from)!.add(to);
  }
  const actor: AlternatingActor = { size: 1, bbox: [2, 0, 2, 0], histogram: [[7, 1]] };
  const controls = { left: [0, -1], right: [0, 1] } as const;
  const route = (row: number) => {
    const memory: PatrolMemory = { position: [row, 1], delta: [1, 0], reversed: true, evidence: [], histogram: [[8, 1]] };
    const topology: AlternatingTopology = { edges, nodes: new Set(edges.keys()), target: [2, 2], pitch: 1, first: 0,
      guards: [{ position: memory.position, bbox: [row, 1, row, 1], front: [row + 1, 1], histogram: memory.histogram }] };
    return planPatrolStep(topology, actor, controls, [], memory, 4);
  };
  assert.equal(route(1)?.input, 'left');
  assert.deepEqual(route(1)?.expected, [2, 1]);
  assert.equal(route(3)?.input, 'right');
  assert.deepEqual(route(3)?.expected, [4, 1]);
});
