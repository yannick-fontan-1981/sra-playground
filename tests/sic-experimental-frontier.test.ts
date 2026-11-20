import test from 'node:test';
import assert from 'node:assert/strict';
import { initialMemory, type Edge } from '../src/sic/preparation-experiments.ts';
import { selectFrontier, recordFrontier } from '../src/sic/experimental-frontier.ts';

function edge(s: number, t: number, cmd: string): Edge {
  return {
    s,
    t,
    cmd,
    ref: s + 1,
    stable: true,
    anchors: {},
    effect: { key: s === t ? 'still' : 'change', moves: [] },
  };
}
test('follows a known route to an unmeasured command when the current scene is exhausted', () => {
  const m = initialMemory(1),
    first = edge(0, 1, 'go'),
    back = edge(1, 0, 'back'),
    inert = edge(0, 0, 'back');
  m.scenes = ['start|go,back', 'end|go,back'];
  m.edges = [first, inert, back];
  m.frontier.choices = { 0: ['go', 'back'], 1: ['go', 'back'] };
  const ops = new Set(['go', 'back']);
  const route = selectFrontier(
    m,
    0,
    ops,
    new Map([
      [0, { first: null, length: 0 }],
      [1, { first, length: 1 }],
    ])
  )!;
  assert.equal(route.phase, 'frontierRoute');
  assert.equal(route.frontier!.question.probe, 'go');
  const receipt = recordFrontier(m, route.frontier!, first, false, () => null);
  assert.equal(receipt.result, 'route_verified');
  const probe = selectFrontier(
    m,
    1,
    ops,
    new Map([
      [1, { first: null, length: 0 }],
      [0, { first: back, length: 1 }],
    ])
  )!;
  assert.equal(probe.phase, 'frontierProbe');
  assert.equal(probe.b, 'go');
  m.edges.push(edge(1, 1, 'go'));
  assert.equal(
    selectFrontier(
      m,
      1,
      ops,
      new Map([
        [1, { first: null, length: 0 }],
        [0, { first: back, length: 1 }],
      ])
    ),
    null
  );
});
test('an unsuccessful return cannot certify the planned experiment', () => {
  const m = initialMemory(1),
    q = { target: 2, probe: 'activate', arrival: null, use: null };
  const result = recordFrontier(m, { question: q, next: 2, use: false }, edge(0, 3, 'go'), false, () => null);
  assert.equal(result.result, 'route_refuted');
  assert.equal(m.frontier.question, null);
  assert.equal(m.frontier.follow, null);
});
