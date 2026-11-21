// Offline calibration from matched public commands. The output is never loaded by SIC.
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const [env, tape, code, out] = process.argv.slice(2);
import { openParkedSubjects } from './sic-study-parked-subjects.mjs';
const s = await openParkedSubjects(env, tape, code);
const ref = await s.prepare([]),
  size = Math.max(...s.verify.controlContrast.baselineDelta.map(Math.abs)),
  pitch = 2 * size;
const tile = (r, p) => {
    const x = Math.round(p[0] / 2),
      y = Math.round(p[1] / 2),
      h = Math.floor(size / 2);
    return r.slice(y - h, y + h + 1).flatMap((row) => row.slice(x - h, x + h + 1));
  },
  id = (t) => t.join(),
  uniform = (t) => new Set(t).size === 1;
const align = (p) => p.map((v, i) => s.selected[i] + Math.round((v - s.selected[i]) / pitch) * pitch);
const plus = (p, d) => p.map((v, i) => v + d[i]),
  diff = (p, q) => p.map((v, i) => v - q[i]);
let prep;
const dirs = {};
for (const input of s.directions) {
  const b = await s.prepare([input]);
  if (!s.live(b)) continue;
  const a = s.at(await s.view(b), s.first);
  if (!a) continue;
  const from = align(s.original),
    to = align(a),
    d = diff(to, from);
  if (Math.abs(d[0]) + Math.abs(d[1]) !== pitch) continue;
  dirs[input] = d;
  const ahead = plus(to, d),
    floor = tile(b.frame, from),
    land = tile(ref.frame, ahead),
    result = tile(b.frame, ahead);
  if (
    uniform(floor) &&
    uniform(land) &&
    land[0] !== floor[0] &&
    !uniform(result) &&
    !uniform(tile(ref.frame, to))
  ) {
    const next = await s.prepare([input, input]);
    if (!s.live(next) || !s.same(align(s.at(await s.view(next), s.first)), ahead)) continue;
    prep = {
      floor: floor[0],
      liquid: land[0],
      bridge: id(result),
      box: id(tile(ref.frame, to)),
      origin: from,
      piece: to,
      ahead,
      action: input,
    };
  }
}
assert.ok(prep && Object.keys(dirs).length === 4);
const active = tile(ref.frame, s.original),
  peer = tile(ref.frame, s.selected),
  mainInk = (t) =>
    t
      .filter((v) => v !== prep.floor)
      .sort((a, b) => t.filter((j) => j === b).length - t.filter((j) => j === a).length)[0];
const actorInks = [mainInk(active), mainInk(peer)];
const { createGameDispatcher } = await import(
  pathToFileURL(resolve(env, 'src/runtime/native-game-dispatcher.ts'))
);
const game = createGameDispatcher(() => {
  throw Error('Unexpected backend');
});
let entry = await game.dispatch({ type: 'load', code, level: s.run.start });
if (entry.level !== s.run.start) entry = await game.dispatch({ type: 'selectLevel', level: s.run.start });
const scene = {
  floor: [],
  liquid: [],
  bridges: [],
  pieces: [],
  actors: [],
  goals: [],
  dirs,
  prep,
  actorInks,
  pitch,
  offset: s.selected.map((v) => v % pitch),
  available: entry.availableActionIds,
};
const glyphs = {};
for (let y = scene.offset[1]; y < entry.frame.length * 2; y += pitch)
  for (let x = scene.offset[0]; x < entry.frame[0].length * 2; x += pitch) {
    if (
      x < pitch / 2 ||
      y < pitch / 2 ||
      x > 2 * (entry.frame[0].length - 1) - pitch / 2 ||
      y > 2 * (entry.frame.length - 1) - pitch / 2
    )
      continue;
    const p = [x, y],
      t = tile(entry.frame, p),
      k = id(t);
    (glyphs[k] ??= []).push(p);
    if (t.includes(actorInks[0])) scene.actors[0] = p;
    else if (t.includes(actorInks[1])) scene.actors[1] = p;
    else if (k === prep.box) scene.pieces.push(p);
    else if (k === prep.bridge) scene.bridges.push(p);
    else if (uniform(t)) {
      if (t[0] === prep.floor) scene.floor.push(p);
      if (t[0] === prep.liquid) scene.liquid.push(p);
    }
  }
for (const [key, pts] of Object.entries(glyphs)) {
  const t = key.split(',').map(Number),
    mid = Math.floor(t.length / 2);
  if (
    pts.length >= 2 &&
    t[mid] === prep.floor &&
    t.every((v, i) => i === mid || v === t[0]) &&
    t[0] !== prep.floor
  )
    scene.goals.push(...pts);
}
const pick = tile(entry.frame, scene.actors[0]).find((v) => !actorInks.includes(v) && v !== prep.floor);
scene.active = pick !== undefined ? 0 : 1;
await writeFile(out, JSON.stringify(scene));
console.log(
  JSON.stringify({
    actors: scene.actors,
    pieces: scene.pieces.length,
    goals: scene.goals,
    pitch,
    floor: scene.floor.length,
    initial: scene.active,
    detectedPush: prep.action,
  }),
);
