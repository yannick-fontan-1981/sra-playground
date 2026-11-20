import assert from 'node:assert/strict';
import test from 'node:test';
import { territorialMaps, terrainKey } from '../src/sic/controllable-territory.ts';
import { imaginedPlacements } from '../src/sic/imagine-territory-placement.ts';
import { initialMemory } from '../src/sic/preparation-experiments.ts';

function fixture(gap = true) {
  const actor = 'p',
    anchor = 'r';
  const entity = (signature, [x, y]) => ({
    signature,
    position: [x, y],
    mask: [[0, 0]],
    bbox: [x, y, x, y],
    identity_ambiguous: false,
    area: 1,
  });
  const o = { entities: [entity(actor, [3, 2]), entity(anchor, [1, 3])] };
  const rows = Array.from({ length: 5 }, (_, y) =>
    Array.from({ length: 10 }, (_, x) =>
      y >= 1 && y <= 3 && x >= 1 && x <= 8 && (gap ? x <= 3 || x >= 6 : true) ? 1 : 0
    )
  );
  const m = initialMemory(1);
  m.space.floor.p = { 1: 20 };
  function edge(cmd, from, to, part = actor, fixed) {
    const moves =
      String(from) === String(to)
        ? []
        : [{ actor: part, from: from.join(), to: to.join(), dx: to[0] - from[0], dy: to[1] - from[1] }];
    const others = fixed
      ? Object.fromEntries(Object.entries(fixed).map(([k, v]) => [k, { at: v.join() }]))
      : {};
    m.edges.push({
      cmd,
      stable: true,
      ref: m.edges.length + 2,
      anchors: { [part]: { at: from.join() }, ...others },
      visibleAfter: [part, ...Object.keys(others)],
      effect: { moves },
      s: 0,
      t: 0,
    });
  }
  edge('east', [1, 1], [2, 1]);
  edge('south', [2, 1], [2, 2]);
  edge('west', [2, 2], [1, 2]);
  edge('north', [1, 2], [1, 1]);
  edge('east', [2, 2], [3, 2]);
  edge('east', [3, 2], [3, 2]);
  return { o, m, rows, edge };
}
test('a measured movement limit creates an unvisited spatial goal before any transfer has occurred', () => {
  const { o, m, rows, edge } = fixture();
  const map = territorialMaps(m, o, rows)[0];
  assert.equal(map.basis, 'substrate');
  assert.equal(map.rim.tested, 7);
  assert.deepEqual(map.origin, [1, 1]);
  assert.deepEqual(map.from, [3, 2]);
  assert(map.home.has(terrainKey([3, 2], map.width)));
  assert(!map.home.has(terrainKey(map.foothold, map.width)));
  assert.equal(map.foreign.size, 9);
  assert(map.foreign.has(terrainKey(map.foothold, map.width)));
  edge('previous-visit', [3, 2], [6, 2]);
  assert.equal(territorialMaps(m, o, rows).length, 0);
});
test('identical substrate on both sides of an experimentally blocked cut still produces a goal', () => {
  const { o, m, rows, edge } = fixture(false);
  edge('east', [3, 1], [3, 1]);
  edge('east', [3, 3], [3, 3]);
  const map = territorialMaps(m, o, rows).find((t) => t.basis === 'failed_stroke');
  assert(map);
  assert.equal(map.foreign.size, 15);
  assert(map.foreign.has(terrainKey([4, 2], map.width)));
  assert(map.rim.tested != null);
  const open = fixture(false);
  assert.equal(territorialMaps(open.m, open.o, open.rows).length, 0);
});
test('an independent actuator can be aimed at a remote foothold before its effect on the traveller is known', () => {
  const { o, m, rows, edge } = fixture();
  edge('slide', [0, 3], [1, 3], 'r', { p: [3, 2] });
  edge('try', [3, 2], [3, 2], 'p', { r: [1, 3] });
  const map = territorialMaps(m, o, rows)[0];
  const offers = imaginedPlacements(m, o, rows, map, new Set(['slide', 'try', 'east']));
  const prediction = offers.find((v) => v.ideal[0] === map.foothold[0] && v.program.at(-1).op === 'try');
  assert(prediction);
  assert.deepEqual(prediction.landing, map.foothold);
  assert(prediction.program.length > 2);
  assert(prediction.program.slice(0, -1).every((step) => step.op === 'slide' && step.stage === 'displace'));
  assert.deepEqual(prediction.program.at(-1).from, map.from);
  assert(prediction.refs.includes(m.edges.at(-1).ref));
});
