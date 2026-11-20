// Retrospective geometry only. Uses two disjoint temporal halves and the public board.
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { measureNativeObservation } from '../src/logos-engine/v6-native-observer.ts';
const [env, file, out] = process.argv.slice(2),
  r = JSON.parse((await readFile(file, 'utf8')).trim());
const { createGameDispatcher } = await import(
  pathToFileURL(join(resolve(env), 'src/runtime/native-game-dispatcher.ts'))
);
const engine = createGameDispatcher(() => {
  throw Error('Unexpected game backend');
});
const hash = (rows) => createHash('sha256').update(JSON.stringify(rows)).digest('hex').slice(0, 16);
let b = await engine.dispatch({ type: 'load', code: r.code, level: r.start });
if (b.level !== r.start && b.canSelectLevel)
  b = await engine.dispatch({ type: 'selectLevel', level: r.start });
const h = b.frame.length,
  w = b.frame[0].length,
  count = w * h;
const hist = [0, 1].map(() => Array.from({ length: count }, () => new Map()));
const cache = new Map(),
  moves = [];
async function parts(board) {
  const key = hash(board.frame);
  if (!cache.has(key)) {
    const o = await measureNativeObservation(
      {
        frame_rows: board.frame,
        frame_hash: key,
        level: board.level,
        levels_completed: board.levelsCompleted,
        state: board.state,
        available_action_refs: [],
      },
      1
    );
    cache.set(key, new Map(o.entities.filter((e) => !e.identity_ambiguous).map((e) => [e.signature, e])));
  }
  return cache.get(key);
}
function observe(rows, k) {
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const v = rows[y][x],
        m = hist[k][y * w + x];
      m.set(v, 1 + (m.get(v) ?? 0));
    }
}
const center = (e) => [Math.round((e.bbox[0] + e.bbox[2]) / 2), Math.round((e.bbox[1] + e.bbox[3]) / 2)];
const steps = r.replayCommands,
  events = new Map(r.preparation.filter((e) => e.access).map((e) => [e.actionIndex, e]));
for (const [i, s] of steps.entries()) {
  if (hash(b.frame) !== s.from) throw Error('Divergent origin');
  observe(b.frame, Number(i >= steps.length / 2));
  const after = await engine.dispatch({
    type: 'action',
    actionId: s.id,
    ...(s.id === 6 ? { data: s.data } : {}),
  });
  if (hash(after.frame) !== s.to) throw Error('Divergent return');
  if (s.from !== s.to && b.level === after.level && b.state === after.state) {
    const a = await parts(b),
      z = await parts(after);
    for (const [id, e] of a) {
      const f = z.get(id);
      if (!f || e.position.join() === f.position.join()) continue;
      const ev = events.get(i + 1);
      moves.push({
        i: i + 1,
        id,
        op: s.id,
        from: center(e),
        to: center(f),
        predicted: ev?.result === 'predicted_landing_verified' && ev.access.actor === id,
      });
    }
  }
  b = after;
}
function components(on) {
  const labels = new Int32Array(count).fill(-1),
    regions = [];
  for (let i = 0; i < count; i++) {
    if (labels[i] >= 0 || !on(i)) continue;
    const q = [i],
      id = regions.length;
    labels[i] = id;
    let l = w,
      t = h,
      r = 0,
      b = 0;
    for (const j of q) {
      const x = j % w,
        y = Math.floor(j / w);
      l = Math.min(l, x);
      t = Math.min(t, y);
      r = Math.max(r, x);
      b = Math.max(b, y);
      for (const k of [
        x > 0 ? j - 1 : -1,
        x < w - 1 ? j + 1 : -1,
        y > 0 ? j - w : -1,
        y < h - 1 ? j + w : -1,
      ])
        if (k >= 0 && labels[k] < 0 && on(k)) {
          labels[k] = id;
          q.push(k);
        }
    }
    regions.push({ id, area: q.length, box: [l, t, r, b] });
  }
  return { regions, at: (p) => regions[labels[p[1] * w + p[0]]] ?? null };
}
const mode = (m) => [...m].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0];
function segment(tallies) {
  const values = tallies.map(mode),
    border = new Map();
  for (let j = 0; j < count; j++)
    if (j < w || j >= count - w || j % w === 0 || j % w === w - 1)
      border.set(values[j], (border.get(values[j]) ?? 0) + 1);
  const outer = mode(border),
    panel = components((i) => values[i] !== outer).regions.sort((a, b) => b.area - a.area)[0];
  if (!panel) return { regions: [], at: () => null };
  const [l, t, r, b] = panel.box,
    inside = (i) => i % w >= l && i % w <= r && Math.floor(i / w) >= t && Math.floor(i / w) <= b;
  const fill = new Map();
  for (let i = 0; i < count; i++) if (inside(i)) fill.set(values[i], (fill.get(values[i]) ?? 0) + 1);
  const bg = mode(fill);
  return components((i) => inside(i) && values[i] !== outer && values[i] !== bg);
}
const projections = hist.map(segment);
const crossings = [],
  forecasts = [],
  possible = [];
for (const m of moves) {
  const pairs = projections.map((p) => [p.at(m.from), p.at(m.to)]);
  const distinct = pairs.map(([a, b]) => (a && b ? a.id !== b.id : null));
  if (distinct.every((v) => v === true)) crossings.push({ ...m, regions: pairs });
  if (distinct.some((v) => v === true)) possible.push(m.i);
  if (m.predicted) forecasts.push({ ...m, distinct, regions: pairs });
}
await writeFile(
  out,
  JSON.stringify({
    game: r.code,
    level: r.start,
    actions: steps.length,
    measuredMoves: moves.length,
    possible: [...new Set(possible)],
    crossings,
    forecasts,
    regions: projections.map((p) => p.regions.sort((a, b) => b.area - a.area).slice(0, 8)),
  })
);
console.log(
  JSON.stringify({ moves: moves.length, crossings: crossings.length, forecasts: forecasts.length })
);
