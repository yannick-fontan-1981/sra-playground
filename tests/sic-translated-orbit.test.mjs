import test from 'node:test';
import assert from 'node:assert/strict';
import { initialMemory } from '../src/sic/preparation-experiments.ts';
import { proposedOrbitTransfers, orbitTerritories } from '../src/sic/translated-orbit.ts';
import { walkToOrbit } from '../src/sic/walk-to-orbit.ts';
function scene() {
  const m = initialMemory(1),
    rows = Array.from({ length: 6 }, () => Array(18).fill(1));
  const ent = (signature, x, y, duplicate = false) => ({
    signature,
    position: [x, y],
    bbox: [x, y, x, y],
    area: 1,
    identity_ambiguous: duplicate,
    mask: [[0, 0]],
  });
  const p = ent('p', 1, 2),
    o = { entities: [p, ent('landmark', 2, 3, true), ent('landmark', 10, 3, true)] };
  function move(x, z, cmd) {
    m.edges.push({
      s: 0,
      t: 1,
      ref: m.edges.length + 2,
      cmd,
      stable: true,
      anchors: { p: { at: [x, 2].join() } },
      visibleAfter: ['p'],
      effect: {
        moves: x === z ? [] : [{ actor: 'p', from: [x, 2].join(), to: [z, 2].join(), dx: z - x, dy: 0 }],
      },
    });
  }
  move(1, 2, 'right');
  move(2, 3, 'right');
  move(3, 2, 'left');
  move(2, 1, 'left');
  m.space.floor.p = { 1: 4 };
  return { m, rows, p, o, move };
}
test('a reversible one-dimensional orbit can suggest an entire unvisited area around a remote matching landmark', () => {
  const { m, rows, o, p, move } = scene(),
    goals = proposedOrbitTransfers(m, o, rows);
  assert.equal(goals.length, 1);
  assert.deepEqual(goals[0].foothold, [10, 2]);
  assert.deepEqual(goals[0].delta, [8, 0]);
  const t = orbitTerritories(m, o, rows)[0];
  assert.equal(t.basis, 'translated_orbit');
  assert.equal(t.home.size, 3);
  assert.equal(t.foreign.size, 3);
  const path = walkToOrbit(t, m, rows, new Set(['left', 'right']), p);
  assert.equal(path.length, 9);
  assert(path.every((x) => x.op === 'right'));
  assert.deepEqual(path.at(-1).to, [10, 2]);
  move(3, 3, 'right');
  const blocked = orbitTerritories(m, o, rows)[0];
  assert(blocked.rim.tested != null);
  assert.deepEqual(walkToOrbit(blocked, m, rows, new Set(['left', 'right']), p), []);
});
test('the same view without an observed return does not support transporting a closed walk', () => {
  const { m, rows, o } = scene();
  m.edges = m.edges.slice(0, 2);
  assert.deepEqual(proposedOrbitTransfers(m, o, rows), []);
});
