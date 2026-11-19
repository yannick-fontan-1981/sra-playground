import assert from 'node:assert/strict';
import test from 'node:test';
import type { AlternatingActor } from '../src/logos-engine/v6-alternating-graph-observation.ts';
import type { AlternatingTopology } from '../src/logos-engine/v6-alternating-graph-questions.ts';
import { planPatrolGroup, planPatrolStep, type PatrolGroupMemory, type PatrolMemory } from '../src/sic/material-route-patrol.ts';
import { planGuardWatch } from '../src/sic/material-route-watch.ts';
import { planGuardDiversion, type GuardDiversion } from '../src/sic/material-route-diversion.ts';
import { observeCombinedEncounter, type EncounterMemory } from '../src/sic/material-route-encounter.ts';

test('a patrol can obscure a predicted pursuer while an unrelated stale guard still contradicts the return', () => {
  const rows = Array.from({ length: 20 }, () => Array<number>(20).fill(0));
  const paint = (top: number, left: number, ink: number) => {
    for (let y = top; y < top + 3; y++) rows[y]!.fill(ink, left, left + 3);
    rows[top + 1]![left + 2] = 15;
  };
  paint(2, 8, 4);
  paint(8, 8, 12);
  const actor: AlternatingActor = { size: 3, bbox: [2, 2, 4, 4], histogram: [[4, 8], [15, 1]] };
  const expected: EncounterMemory = { at: [2, 8], target: [14, 8], fixed: [], fixedBodies: [8],
    patrols: [{ position: [8, 8], heading: [0, 6] }], patrolBody: 12, pursuer: [8, 8], pursuerBody: 13,
    trigger: [], trail: [[8, 2], [2, 8]], evidence: ['movement'] };
  const step = { input: 'right', to: expected.at, current: expected, expected, learning: false, measuringPatrols: false };
  assert.deepEqual(observeCombinedEncounter(step, actor, rows, [], 'return')?.pursuer, [8, 8]);
  paint(14, 2, 8);
  assert.equal(observeCombinedEncounter(step, actor, rows, [], 'return'), null);
});

test('an unfamiliar guard excludes its adjacent tiles from the immediate move', () => {
  const edges = new Map<string, Set<string>>([
    ['3,2', new Set(['3,3', '4,2'])], ['3,3', new Set(['3,2', '2,3', '3,4', '4,3'])],
    ['2,3', new Set(['3,3'])], ['3,4', new Set(['3,3'])],
    ['4,2', new Set(['3,2', '4,3'])], ['4,3', new Set(['4,2', '3,3'])],
  ]);
  const fixed = [[8, 3], [9, 1]];
  const actor: AlternatingActor = { size: 2, bbox: [3, 2, 4, 3], histogram: [[4, 3], [5, 1]] };
  const graph: AlternatingTopology = { nodes: new Set(edges.keys()), edges, target: [3, 4], pitch: 1, first: 0, guards: [
    { position: [2, 3], front: [3, 3], bbox: [2, 3, 3, 4], histogram: [[6, 3], [7, 1]] },
    { position: [4, 4], front: [4, 5], bbox: [4, 4, 5, 5], histogram: fixed },
  ] };
  const step = planGuardWatch(graph, actor, { right: [0, 1], down: [1, 0], up: [-1, 0] },
    [{ guard_histogram: fixed, size: 2 }], 5);
  assert.deepEqual(step?.to, [4, 2]);
  assert.deepEqual(step?.alternatives, [[2, 3], [3, 3]]);
});

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

test('a hidden patrol stays in the forecast while a different guard is approached from the side', () => {
  const edges = new Map<string, Set<string>>([
    ['0,1', new Set(['0,2'])], ['0,2', new Set(['0,1'])],
    ['0,3', new Set(['0,4'])], ['0,4', new Set(['0,3'])],
    ['2,0', new Set(['2,1'])], ['2,1', new Set(['2,0', '2,2'])], ['2,2', new Set(['2,1'])],
  ]);
  const histogram = [[8, 1]], fixed = [[9, 1]];
  const graph: AlternatingTopology = { edges, nodes: new Set(edges.keys()), target: [2, 2], pitch: 1, first: 0,
    guards: [
      { position: [0, 2], front: [1, 2], bbox: [0, 2, 0, 2], histogram: fixed },
      { position: [0, 4], front: [0, 3], bbox: [0, 4, 0, 4], histogram },
      { position: [2, 1], front: [1, 1], bbox: [2, 1, 2, 1], histogram: fixed },
    ] };
  const known: PatrolGroupMemory = { histogram, target: graph.target, evidence: ['both-patrols-seen'],
    formations: [[{ position: [0, 2], delta: [0, 1] }, { position: [0, 4], delta: [0, 1] }]] };
  const actor: AlternatingActor = { size: 1, bbox: [2, 0, 2, 0], histogram: [[7, 1]] };
  const controls = { right: [0, 1] } as const;
  assert.equal(planPatrolGroup(graph, actor, controls, histogram, known, 4), null);
  const step = planPatrolGroup(graph, actor, controls, histogram, known, 4, [{ size: 1, guard_histogram: fixed }]);
  assert.deepEqual(step?.capture?.position, [2, 1]);
  assert.deepEqual(step?.expected, [[0, 1], [0, 3]]);
});

test('a following guard is drawn out of a cut vertex only when the player can return around it', () => {
  const links = [
    ['0,1', '0,2'], ['0,2', '1,2'], ['1,2', '2,2'], ['2,2', '2,1'], ['2,1', '2,0'],
    ['2,0', '3,0'], ['3,0', '3,1'], ['3,1', '3,2'], ['3,2', '2,2'],
  ] as const;
  const edges = new Map<string, Set<string>>();
  for (const [a, b] of links) {
    if (!edges.has(a)) edges.set(a, new Set());
    if (!edges.has(b)) edges.set(b, new Set());
    edges.get(a)!.add(b);
    edges.get(b)!.add(a);
  }
  const controls = { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] } as const;
  const profile = { body: 8, distance: 2, evidence: ['marker changed', 'followed the previous route'] };
  const guard = { position: [0, 2] as const, front: [1, 2] as const, bbox: [0, 2, 1, 3] as const, histogram: [[8, 3], [9, 1]] };
  const graph: AlternatingTopology = { nodes: new Set(edges.keys()), edges, target: [0, 1], pitch: 1, first: 0, guards: [guard] };
  const actor: AlternatingActor = { size: 2, bbox: [3, 1, 4, 2], histogram: [[5, 3], [6, 1]] };
  assert.equal(planGuardWatch(graph, actor, controls, [], 18), null);
  const withoutReturn = new Map([...edges].map(([point, neighbours]) => [point, new Set(neighbours)]));
  withoutReturn.get('3,1')!.delete('3,2');
  withoutReturn.get('3,2')!.delete('3,1');
  assert.equal(planGuardDiversion({ ...graph, edges: withoutReturn }, actor, controls, [], profile, 18), null);

  let player = actor, follower = graph.guards[0]!, memory: GuardDiversion | undefined, awakened = 0;
  for (let remaining = 18; remaining > 0; remaining--) {
    if (player.bbox[0] === graph.target[0] && player.bbox[1] === graph.target[1]) break;
    const step = planGuardDiversion({ ...graph, guards: [follower] }, player, controls, [], profile, remaining, memory);
    assert.ok(step);
    assert.notDeepEqual(step.to, follower.position);
    assert.notDeepEqual(step.to, step.expected);
    if (step.awakening) {
      awakened++;
      assert.deepEqual(step.to, [2, 2]);
      assert.deepEqual(step.expected, [0, 2]);
    }
    follower = { ...follower, position: step.expected };
    const [y, x] = step.to;
    player = { ...player, bbox: [y, x, y + 1, x + 1] };
    memory = { target: step.target, passage: step.passage, trail: step.trail, evidence: step.evidence };
  }
  assert.equal(awakened, 1);
  assert.deepEqual(player.bbox.slice(0, 2), graph.target);
});
