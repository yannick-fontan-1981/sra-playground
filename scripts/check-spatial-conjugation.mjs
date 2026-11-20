// A paired public intervention: does exchanging two roles transfer an ordinary control to the other role?
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { sourceBackend } from './sic-study-source-games.mjs';
import { GAME_CATALOG } from '../src/games/catalog.ts';
import { measureNativeObservation } from '../src/logos-engine/v6-native-observer.ts';

const [environment, file, code, output] = process.argv.slice(2);
const r = (await readFile(file, 'utf8'))
  .trim()
  .split('\n')
  .map(JSON.parse)
  .find((g) => g.code === code);
if (!r || r.start !== r.finish) throw Error('Single-level public recording required');
const source = GAME_CATALOG.some((g) => g.code === code);
const game = source
  ? await sourceBackend(resolve(environment))
  : (
      await import(pathToFileURL(join(resolve(environment), 'src/runtime/native-game-dispatcher.ts')))
    ).createGameDispatcher(() => {
      throw Error('Unexpected backend');
    });
const fingerprint = (f) => createHash('sha256').update(JSON.stringify(f)).digest('hex').slice(0, 16);
const commands = r.steps?.map((s) => ({ id: s.a, data: s.data, from: s.from, to: s.to })) ?? r.replayCommands;
const op = (s) => (s.id === 6 ? 'ACTION6:' + s.data.x + ',' + s.data.y : 'ACTION' + s.id);
const act = (k) => {
  const [name, xy] = k.split(':'),
    [x, y] = xy?.split(',').map(Number) ?? [];
  return game.dispatch({
    type: 'action',
    actionId: Number(name.slice(6)),
    ...(xy ? { data: { x, y } } : {}),
  });
};
async function rewind(n) {
  let board = await game.dispatch({ type: 'load', code, level: r.start });
  if (board.level !== r.start && board.canSelectLevel)
    board = await game.dispatch({ type: 'selectLevel', level: r.start });
  if (fingerprint(board.frame) !== r.initial.slice(0, 16)) throw Error('Initial hash');
  for (const s of commands.slice(0, n)) {
    board = await act(op(s));
    if (fingerprint(board.frame) !== s.to) throw Error('Prefix hash');
  }
  return board;
}
const cache = new Map();
async function centers(b) {
  const h = fingerprint(b.frame);
  if (!cache.has(h)) {
    const o = await measureNativeObservation(
      {
        frame_rows: b.frame,
        frame_hash: h,
        level: b.level,
        levels_completed: b.levelsCompleted,
        state: b.state,
        available_action_refs: [],
      },
      1
    );
    cache.set(
      h,
      new Map(
        o.entities
          .filter((e) => !e.identity_ambiguous)
          .map((e) => [e.signature, [(e.bbox[0] + e.bbox[2]) / 2, (e.bbox[1] + e.bbox[3]) / 2]])
      )
    );
  }
  return cache.get(h);
}
const equal = (p, q) => !!p && !!q && p[0] === q[0] && p[1] === q[1];
const delta = (p, q) => [q[0] - p[0], q[1] - p[1]];
const near = (p, q) => Math.max(Math.abs(p[0] - q[0]), Math.abs(p[1] - q[1])) <= 1;
const candidates = [],
  dedup = new Set();
let b = await rewind(0);
for (const [n, s] of commands.entries()) {
  if (fingerprint(b.frame) !== s.from) throw Error('Origin');
  const a = await act(op(s));
  if (fingerprint(a.frame) !== s.to) throw Error('Return');
  if (a.level === b.level && a.state === b.state && s.from !== s.to) {
    const before = await centers(b),
      after = await centers(a),
      moved = [...before].filter(([i, p]) => after.has(i) && !equal(p, after.get(i)));
    for (let j = 0; j < moved.length; j++)
      for (let k = j + 1; k < moved.length; k++) {
        const [i, p] = moved[j],
          [h, q] = moved[k],
          P = after.get(i),
          Q = after.get(h);
        if (!equal(delta(p, P), delta(Q, q)) || !near(P, q) || !near(Q, p) || equal(p, q)) continue;
        const ids = [i, h].sort(),
          key = [op(s), ...ids, before.get(ids[0]), before.get(ids[1])].join('|');
        if (!dedup.has(key)) {
          dedup.add(key);
          candidates.push({ n, exchange: op(s), ids });
        }
      }
  }
  b = a;
}
const seenScene = new Set(),
  tested = [],
  products = [];
for (const candidate of candidates) {
  const { n, exchange, ids } = candidate;
  if (seenScene.size >= 8 && !seenScene.has(n)) continue;
  seenScene.add(n);
  const start = await rewind(n),
    base = await centers(start);
  const pose = (m) => ids.map((id) => m.get(id) ?? null),
    initial = pose(base);
  const run = async (program) => {
    let b = await rewind(n);
    for (const k of program) {
      b = await act(k);
      if (b.level !== start.level || b.state !== start.state) return { pose: [null, null], terminal: true };
    }
    return { pose: pose(await centers(b)), hash: fingerprint(b.frame) };
  };
  const restored = await run([exchange, exchange]);
  if (!restored.pose.every((x, i) => equal(x, initial[i]))) continue;
  const options = [...new Set(commands.map(op))].filter((k) => k !== exchange && !k.includes(':'));
  for (const u of options) {
    const direct = await run([u]),
      balanced = await run([exchange, exchange, u]),
      conjugate = await run([exchange, u, exchange]);
    if (!direct.pose.every(Boolean) || !balanced.pose.every(Boolean) || !conjugate.pose.every(Boolean)) {
      tested.push({ ...candidate, u, status: 'unresolved' });
      continue;
    }
    const d = initial.map((p, i) => delta(p, direct.pose[i])),
      v = initial.map((p, i) => delta(p, conjugate.pose[i]));
    const active = d.findIndex((a) => !equal(a, [0, 0])),
      other = 1 - active;
    const control = direct.pose.every((p, i) => equal(p, balanced.pose[i]));
    const transfer =
      active >= 0 &&
      equal(d[other], [0, 0]) &&
      equal(v[active], [0, 0]) &&
      equal(v[other], d[active]) &&
      control;
    tested.push({
      ...candidate,
      u,
      initial,
      direct: direct.pose,
      balanced: balanced.pose,
      conjugate: conjugate.pose,
      active,
      fullReset: restored.hash === commands[n].from,
      control,
      status: transfer ? 'transferred' : 'different_effect',
    });
  }
  if (products.length) continue;
  const controls = tested.filter(
    (e) => e.n === n && e.ids.join() === ids.join() && e.status === 'transferred' && e.fullReset
  );
  if (controls.length < 2) continue;
  const swap = await run([exchange]);
  for (const u of controls)
    for (const v of controls) {
      if (u.active !== v.active) continue;
      const expected = initial.map((_, i) => (i === u.active ? u.direct[i] : v.conjugate[i]));
      const offset = initial.map((_, i) => delta(initial[1 - i], swap.pose[i]));
      const expectedLanding = expected.map((_, i) => [
        expected[1 - i][0] + offset[i][0],
        expected[1 - i][1] + offset[i][1],
      ]);
      const uThenV = [u.u, exchange, v.u, exchange],
        vThenU = [exchange, v.u, exchange, u.u];
      const one = await run(uThenV),
        two = await run(vThenU),
        final = await run([...uThenV, exchange]);
      products.push({
        n,
        ids,
        local: u.u,
        remote: v.u,
        expected,
        expectedLanding,
        actual: one.pose,
        otherOrder: two.pose,
        afterExchange: final.pose,
        verified: expected.every(
          (p, i) => equal(p, one.pose[i]) && equal(p, two.pose[i]) && equal(expectedLanding[i], final.pose[i])
        ),
      });
    }
}
await writeFile(
  output,
  JSON.stringify({ code, seenCandidatePairs: candidates.length, origins: [...seenScene], tested, products })
);
console.log(
  JSON.stringify({
    code,
    candidates: candidates.length,
    tested: tested.length,
    transferred: tested.filter((t) => t.status === 'transferred').length,
  })
);
