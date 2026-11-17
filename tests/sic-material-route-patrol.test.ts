import assert from 'node:assert/strict';
import test from 'node:test';
import type { AlternatingActor } from '../src/logos-engine/v6-alternating-graph-observation.ts';
import type { AlternatingTopology } from '../src/logos-engine/v6-alternating-graph-questions.ts';
import { planPatrolGroup, planPatrolStep, type PatrolGroupMemory, type PatrolMemory } from '../src/sic/material-route-patrol.ts';

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

test('overlapping patrols retain their different next positions', () => {
  const edges = new Map([['0,3', new Set(['1,3'])], ['1,3', new Set(['0,3', '2,3'])],
    ['2,3', new Set(['1,3', '2,2'])], ['2,2', new Set(['2,3', '2,1'])], ['2,1', new Set(['2,2'])]]);
  const histogram = [[8, 1]];
  const graph: AlternatingTopology = { edges, nodes: new Set(edges.keys()), target: [2, 2], pitch: 1, first: 0,
    guards: [{ position: [1, 3], front: [0, 3], bbox: [1, 3, 1, 3], histogram }] };
  const known: PatrolGroupMemory = { histogram, target: graph.target, evidence: ['earlier-separate-observation'], formations: [[
    { position: [1, 3], delta: [-1, 0] }, { position: [1, 3], delta: [1, 0] },
  ]] };
  const actor: AlternatingActor = { size: 1, bbox: [2, 1, 2, 1], histogram: [[7, 1]] };
  const step = planPatrolGroup(graph, actor, { right: [0, 1] }, histogram, known, 4);
  assert.equal(step?.input, 'right');
  assert.deepEqual(step?.positions, [[1, 3]]);
  assert.deepEqual(step?.expected, [[0, 3], [2, 3]]);
  assert.equal(step?.next[0]?.length, 2);
});
