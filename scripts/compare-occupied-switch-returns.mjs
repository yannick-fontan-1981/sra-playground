import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
// Diagnostic only. Vary order and subject assignment, then measure the remote gate after either subject leaves.
const [env, tape, code, fork, out] = process.argv.slice(2),
  report = JSON.parse(await readFile(fork)),
  r = JSON.parse(await readFile(tape)),
  imp = (p) => import(pathToFileURL(resolve(p)));
const { createGameDispatcher } = await imp(resolve(env, 'src/runtime/native-game-dispatcher.ts')),
  { visualLayout } = await imp('src/sic/witnessed-preview-transfer.ts'),
  { measureNativeObservation } = await imp('src/logos-engine/v6-native-observer.ts'),
  t = await imp('src/sic/transport-observations.ts'),
  { hash } = await imp('scripts/sic-study-source-replay.mjs');
const en = createGameDispatcher(() => {
    throw Error('Public backend');
  }),
  id = report.step - 1,
  sel = report.changed.find((z) => z.verified).p;
const act = (id, data) => en.dispatch({ type: 'action', actionId: id, ...(data ? { data } : {}) });
async function start(word = [], side = 0) {
  let b = await en.dispatch({ type: 'load', code, level: r.start });
  if (b.level !== r.start) b = await en.dispatch({ type: 'selectLevel', level: r.start });
  for (const c of r.replayCommands.slice(0, id)) b = await act(c.id, c.data);
  if (side) b = await act(6, { x: sel[0], y: sel[1] });
  for (const op of word) b = await act(op);
  return b;
}
const b = await start(),
  o = await measureNativeObservation(
    {
      frame_rows: b.frame,
      frame_hash: hash(b),
      state: b.state,
      level: b.level,
      levels_completed: b.levelsCompleted,
      available_action_refs: b.availableActionIds.map((n) => 'ACTION' + n),
    },
    0,
    'audit',
  ),
  a = await act(6, { x: sel[0], y: sel[1] });
const m = t.detectTransportSelection(visualLayout(o, b.frame), b.frame, a.frame, sel, 'click'),
  root = t.readTransport(m, b.frame),
  grid = m.grid;
const sum = Object.entries(
  root.tiles.reduce((p, key) => {
    p[key] = (p[key] ?? 0) + 1;
    return p;
  }, {}),
)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 12);
const floor = sum.find(
  ([k, n]) =>
    n > 3 &&
    k.split(',').every((v) => v === k.split(',')[0]) &&
    root.tiles[root.subject[0]].split(',').includes(k.split(',')[0]),
)[0];
const motions = [];
for (const side of [0, 1]) {
  const ops = {};
  let pos = root.subject[side];
  for (let id = 1; id <= 4; id++) {
    const n = await start([id], side),
      q = t.readTransport(m, n.frame);
    const to = q?.subject[side];
    if (to !== undefined && to !== pos)
      ops[id] = [
        Math.sign((to % grid.columns) - (pos % grid.columns)),
        Math.sign(Math.floor(to / grid.columns) - Math.floor(pos / grid.columns)),
      ];
  }
  motions.push(ops);
}
let cold = await en.dispatch({ type: 'load', code, level: r.start });
if (cold.level !== r.start) cold = await en.dispatch({ type: 'selectLevel', level: r.start });
const board = t.readTransport(m, cold.frame),
  kFloor = floor.split(',')[0],
  counts = new Map();
for (const v of board.tiles) counts.set(v, 1 + (counts.get(v) ?? 0));
const ring = (key) => {
  const v = key.split(','),
    mid = Math.floor(v.length / 2);
  return v[mid] !== v[0] && v.every((c, i) => i === mid || c === v[0]);
};
const rowsOf = (cond) => board.tiles.flatMap((v, i) => (cond(v) ? [i] : []));
const decorative = [...counts.keys()].find((k) => {
  const v = k.split(',');
  return (
    counts.get(k) >= 2 &&
    v[0] === kFloor &&
    v[4] !== kFloor &&
    v[1] === v[4] &&
    v[3] === v[4] &&
    v[5] === v[4]
  );
});
const gateInk = decorative.split(',')[4],
  marks = rowsOf((v) => ring(v) && v.split(',')[4] === kFloor);
const pieces = rowsOf(
  (v) => ring(v) && counts.get(v) > 1 && v.split(',')[4] !== kFloor && v.split(',')[0] !== gateInk,
);
const gate = rowsOf((v) => ring(v) && v.split(',')[0] === gateInk),
  controls = rowsOf((v) => v === decorative);
const scene = {
  width: grid.columns,
  marks,
  pieces,
  gate,
  controls,
  subjects: board.subject,
  active: 0,
  ground: rowsOf((v) => v === floor),
  motors: motions[1],
  grid,
  inks: m.inks,
  floor,
};
const s = scene,
  level = r.start,
  memory = { inks: s.inks, grid: s.grid };
const samples = [];
for (const order of [
  [0, 1],
  [1, 0],
])
  for (const reverse of [false, true]) {
    let b = await en.dispatch({ type: 'load', code, level: +level });
    if (b.level !== +level) b = await en.dispatch({ type: 'selectLevel', level: +level });
    let read = () => t.readTransport(memory, b.frame),
      active = s.active;
    const row = { order, reverse, initial: read().tiles[s.gate[0]], results: [] },
      word = [];
    for (const side of order) {
      let seen = new Set();
      const goal = s.controls[reverse ? 1 - side : side];
      if (active !== side) {
        const [x, y] = t.sitePoint(s.grid, read().subject[side]);
        b = await act(6, { x, y });
        active = side;
      }
      let matched = false;
      for (let i = 0; i < 90; i++) {
        const v = read(),
          src = v.subject[side];
        if (src === goal) {
          matched = true;
          break;
        }
        const blocked = new Set([v.subject[1 - side]]);
        const path = [{ n: src, ops: [] }],
          visited = new Set([src]);
        let target;
        for (const u of path) {
          if (u.n === goal) {
            target = u.ops;
            break;
          }
          for (const [op, [dx, dy]] of Object.entries(s.motors)) {
            const p = t.neighbor(s.grid, u.n, dx, dy);
            if (p < 0 || visited.has(p) || blocked.has(p) || seen.has(u.n + '/' + op)) continue;
            if (p !== goal && v.tiles[p] !== s.floor && !s.controls.includes(p) && !s.marks.includes(p))
              continue;
            visited.add(p);
            path.push({ n: p, ops: [...u.ops, +op] });
          }
        }
        if (!target?.length) break;
        const op = target[0];
        b = await act(op);
        word.push(op);
        if (b.state !== 'NOT_FINISHED') break;
        if (read().subject[side] === src) seen.add(src + '/' + op);
      }
      row.results.push({
        side,
        matched,
        glyph: read().tiles[s.gate[0]],
        subjects: read().subject.slice(),
        length: word.length,
      });
    }
    const l = read();
    if (s.controls.every((k) => l.subject.includes(k))) {
      b = await act(5);
      row.activation = read().tiles[s.gate[0]];
      for (const [op, d] of Object.entries(s.motors)) {
        if (l.tiles[t.neighbor(s.grid, l.subject[active], ...d)] === s.floor) {
          b = await act(+op);
          row.steppedOff = read().tiles[s.gate[0]];
          break;
        }
      }
    }
    samples.push(row);
  }
await writeFile(out, JSON.stringify(samples));
console.log(
  JSON.stringify(
    samples.map((z) => [
      z.order,
      z.reverse,
      z.results.map((r) => [r.matched, r.glyph !== z.initial]),
      z.activation && z.activation !== z.initial,
      z.steppedOff && z.steppedOff !== z.initial,
    ]),
  ),
);
