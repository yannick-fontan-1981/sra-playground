import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { sourceBackend } from './sic-study-source-games.mjs';
import { measureNativeObservation } from '../src/logos-engine/v6-native-observer.ts';
import { GAME_CATALOG } from '../src/games/catalog.ts';
const [environment, output, ...files] = process.argv.slice(2);
const engine = await sourceBackend(resolve(environment));
const games = files.flatMap((file) => readFileSync(file, 'utf8').trim().split('\n').map(JSON.parse));
if (
  games
    .map((g) => g.code)
    .sort()
    .join() !==
    GAME_CATALOG.map((g) => g.code)
      .sort()
      .join() ||
  games.some((g) => g.start !== 1 || g.finish !== 1 || g.resets)
)
  throw Error('Require original public source cohort');
const out = [];
const hash = (f) => createHash('sha256').update(JSON.stringify(f)).digest('hex').slice(0, 16);
for (const g of games) {
  const rows = [],
    mobile = new Set(),
    effects = new Map(),
    cache = new Map();
  let board = engine.dispatch({ type: 'load', code: g.code, level: 1 });
  async function get(b) {
    const h = hash(b.frame);
    if (!cache.has(h))
      cache.set(
        h,
        (
          await measureNativeObservation(
            {
              frame_rows: b.frame,
              frame_hash: h,
              level: b.level,
              state: b.state,
              levels_completed: b.levelsCompleted,
              available_action_refs: b.availableActionIds.map((v) => 'ACTION' + v),
            },
            1
          )
        ).entities
      );
    return cache.get(h);
  }
  for (const step of g.steps) {
    if (hash(board.frame) !== step.from) throw Error('prefix');
    const before = await get(board),
      map = new Map(before.filter((e) => !e.identity_ambiguous).map((e) => [e.signature, e])),
      op = step.a;
    const predict = [];
    if (op === 6) predict.push({ role: 'click', point: [step.data.x, step.data.y], size: 1, box: [1, 1] });
    else
      for (const [role, e] of map) {
        const hist = effects.get(role + '/' + op);
        if (!hist?.size) continue;
        const sorted = [...hist].sort((a, b) => b[1] - a[1]);
        if (sorted[0][1] === sorted[1]?.[1]) continue;
        const [dx, dy] = sorted[0][0].split(',').map(Number),
          w = e.bbox[2] - e.bbox[0] + 1,
          h = e.bbox[3] - e.bbox[1] + 1;
        predict.push({
          role,
          point: [e.position[0] + dx + (w - 1) / 2, e.position[1] + dy + (h - 1) / 2],
          size: e.area,
          box: [w, h],
        });
      }
    const tags = new Set();
    for (const p of predict) {
      const [x, y] = p.point;
      for (const f of before) {
        if (
          f.signature === p.role ||
          mobile.has(f.signature) ||
          f.area > (board.frame.length * board.frame[0].length) / 10
        )
          continue;
        const [l, t, r, b] = f.bbox,
          w = r - l + 1,
          h = b - t + 1;
        if (x < l - 0.5 || x > r + 0.5 || y < t - 0.5 || y > b + 0.5) continue;
        tags.add('contact');
        if (!f.identity_ambiguous) tags.add('unique');
        if (f.area / (w * h) < 0.75) tags.add('openShape');
        if (Math.abs(x - (l + r) / 2) <= 1 && Math.abs(y - (t + b) / 2) <= 1) tags.add('centered');
        if (f.area >= p.size / 2 && f.area <= p.size * 2) tags.add('similarArea');
        if (f.area < p.size / 2) tags.add('smaller');
        if (f.area > p.size * 2) tags.add('larger');
        if (w === p.box[0] && h === p.box[1]) tags.add('sameExtent');
        if (w === h) tags.add('square');
      }
    }
    const next = engine.dispatch({
      type: 'action',
      actionId: step.a,
      ...(step.a === 6 ? { data: step.data } : {}),
    });
    if (hash(next.frame) !== step.to) throw Error('return');
    const won =
      next.level > board.level || next.levelsCompleted > board.levelsCompleted || next.state === 'WIN';
    rows.push({ op, predicted: predict.length > 0, tags: [...tags].sort(), won });
    if (!won) {
      const after = await get(next);
      for (const z of after) {
        const e = map.get(z.signature);
        if (!e || z.identity_ambiguous) continue;
        const delta = [z.position[0] - e.position[0], z.position[1] - e.position[1]];
        if (delta.some(Boolean)) {
          mobile.add(e.signature);
          const k = e.signature + '/' + op,
            hist = effects.get(k) ?? new Map();
          hist.set(delta.join(), (hist.get(delta.join()) ?? 0) + 1);
          effects.set(k, hist);
        }
      }
    }
    board = next;
  }
  out.push({ code: g.code, rows });
}

const prior = {};
for (const kind of ['movement', 'point']) {
  const comparisons = [];
  for (const g of out) {
    const win = g.rows.at(-1);
    if (!win?.won || !win.predicted || (win.op === 6) !== (kind === 'point')) continue;
    const controls = g.rows.slice(0, -1).filter((r) => r.op === win.op && r.predicted);
    if (controls.length) comparisons.push({ win, controls });
  }
  const features = {};
  for (const tag of [
    'contact',
    'unique',
    'openShape',
    'centered',
    'similarArea',
    'sameExtent',
    'square',
    'larger',
    'smaller',
  ]) {
    let wins = 0,
      controls = 0;
    for (const c of comparisons) {
      wins += Number(c.win.tags.includes(tag));
      controls += c.controls.filter((r) => r.tags.includes(tag)).length / c.controls.length;
    }
    features[tag] = { wins, expected: Number(controls.toFixed(4)) };
  }
  prior[kind] = { games: comparisons.length, features };
}
writeFileSync(output, JSON.stringify(prior, null, 2) + '\n');
