import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { hash } from './sic-study-source-replay.mjs';
// Compare repeated visible tiles after a selection, allowing foreground ink to cover part of a tile.
const [env, tape, out] = process.argv.slice(2),
  r = JSON.parse(await readFile(tape)),
  cs = r.replayCommands,
  first = cs.find((c) => c.observedSubjects?.length === 2),
  box = first.observedSubjects[0],
  width = box[2] - box[0] + 1,
  h = box[3] - box[1] + 1;
const { createGameDispatcher } = await import(
  pathToFileURL(resolve(env, 'src/runtime/native-game-dispatcher.ts'))
);
const en = createGameDispatcher(() => {
  throw Error();
});
let b = await en.dispatch({ type: 'load', code: r.code, level: r.start });
if (b.level !== r.start)
  b = await en.dispatch({ type: 'selectLevel', level: r.start });
const x0 = box[0] % width,
  y0 = box[1] % h,
  cols = Math.floor((b.frame[0].length - x0) / width);
function tiles(b) {
  const res = [];
  for (let y = y0; y + h <= b.frame.length; y += h)
    for (let x = x0; x + width <= b.frame[0].length; x += width)
      res.push(
        b.frame.slice(y, y + h).flatMap((row) => row.slice(x, x + width)),
      );
  return res;
}
const root = tiles(b),
  forms = new Map();
for (const [i, a] of root.entries()) {
  const s = a.join('/'),
    v = forms.get(s) ?? { a, pos: [] };
  v.pos.push(i);
  forms.set(s, v);
}
const repeating = [...forms.values()].filter(
  (f) => f.pos.length > 1 && f.pos.length < 8,
);
const anchors = first.observedSubjects.map(
  (q) => Math.floor((q[0] - x0) / width) + Math.floor((q[1] - y0) / h) * cols,
);
const bg = [
  ...new Set(root[anchors[0]].filter((k) => root[anchors[1]].includes(k))),
];
const inks = new Set(
  anchors.flatMap((n) => root[n].filter((k) => !bg.includes(k))),
);
function positions(ts, glyph) {
  return ts.flatMap((t, i) =>
    t.every((v, j) => v === glyph[j] || inks.has(v)) &&
    t.filter((v, j) => v === glyph[j]).length > t.length / 2
      ? [i]
      : [],
  );
}
const report = [];
for (const f of repeating)
  report.push({ glyph: f.a, initial: f.pos, total: 0, changes: [] });
for (const [i, c] of cs.entries()) {
  const t0 = tiles(b);
  b = await en.dispatch({
    type: 'action',
    actionId: c.id,
    ...(c.data ? { data: c.data } : {}),
  });
  if (hash(b).slice(0, 16) !== c.to) throw Error('divergence ' + i);
  const t1 = tiles(b);
  for (const row of report) {
    const pre = positions(t0, row.glyph),
      post = positions(t1, row.glyph);
    if (
      pre.length !== row.initial.length ||
      post.length !== pre.length ||
      pre.join() === post.join()
    )
      continue;
    const left = pre.filter((v) => !post.includes(v)),
      moved = post.filter((v) => !pre.includes(v));
    row.total++;
    if (row.changes.length < 8)
      row.changes.push({ step: i + 1, cmd: c.id, left, moved });
  }
}
const fork = cs.indexOf(first);
assert.equal(first.id, 6);
async function start(selection) {
  let n = await en.dispatch({ type: 'load', code: r.code, level: r.start });
  if (n.level !== r.start)
    n = await en.dispatch({ type: 'selectLevel', level: r.start });
  for (const c of cs.slice(0, fork))
    n = await en.dispatch({
      type: 'action',
      actionId: c.id,
      ...(c.data ? { data: c.data } : {}),
    });
  if (selection === 'second')
    n = await en.dispatch({
      type: 'action',
      actionId: first.id,
      data: first.data,
    });
  if (selection === 'first') {
    const [l, t, r, b] = first.observedSubjects[0];
    n = await en.dispatch({
      type: 'action',
      actionId: 6,
      data: { x: Math.floor((l + r) / 2), y: Math.floor((t + b) / 2) },
    });
  }
  return n;
}
const forks = [];
for (const id of (await start()).availableActionIds.filter((id) => id !== 6)) {
  const arms = [];
  for (const select of [undefined, 'first', 'second']) {
    const pre = await start(select),
      post = await en.dispatch({ type: 'action', actionId: id });
    const rows = report.map((f) => {
      const a = positions(tiles(pre), f.glyph),
        z = positions(tiles(post), f.glyph);
      return a.length === f.initial.length && a.length === z.length
        ? {
            departed: a.filter((n) => !z.includes(n)),
            arrived: z.filter((n) => !a.includes(n)),
          }
        : null;
    });
    arms.push(rows);
  }
  forks.push({ id, arms });
}
await writeFile(out, JSON.stringify({ report, forks }));
console.log(
  JSON.stringify(
    forks.map((b) => [
      b.id,
      b.arms.map((arm) => arm.map((a) => (a ? [a.departed, a.arrived] : null))),
    ]),
  ),
);
