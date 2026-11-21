import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { hash } from './sic-study-source-replay.mjs';

const [directory, tape, out] = process.argv.slice(2),
  r = JSON.parse(await readFile(tape));
assert.equal(r.start, r.finish);
assert.ok(!r.resets && !r.observedPriorLevelActions);
const { createGameDispatcher } = await import(
  pathToFileURL(resolve(directory, 'src/runtime/native-game-dispatcher.ts'))
);
const engine = createGameDispatcher(() => {
  throw Error('Public dispatcher required');
});
let b = await engine.dispatch({ type: 'load', code: r.code, level: r.start });
if (b.level !== r.start)
  b = await engine.dispatch({ type: 'selectLevel', level: r.start });
const root = b.frame,
  start = b.levelsCompleted,
  milestones = [],
  rejected = [],
  used = new Set();
let sensor,
  layout,
  box,
  initialGate,
  tested = 0,
  matched = 0,
  moves = 0,
  opened = false,
  occupied = false,
  firstVerified;
function scan(rows, g) {
  const tiles = [];
  for (let y = g.top; y + g.pitch <= rows.length; y += g.pitch)
    for (let x = g.left; x + g.pitch <= rows[0].length; x += g.pitch)
      tiles.push(
        rows.slice(y, y + g.pitch).flatMap((row) => row.slice(x, x + g.pitch)),
      );
  return tiles;
}
const count = (tile, v) => tile.filter((p) => p === v).length;
function registration(before, after, boxes) {
  const square = boxes.find((b) => b[2] - b[0] === b[3] - b[1]);
  if (!square) return;
  const pitch = square[2] - square[0] + 1;
  if (pitch < 2 || pitch % 2 !== 1) return;
  const left = square[0] % pitch,
    top = square[1] % pitch,
    cols = Math.floor((before[0].length - left) / pitch);
  const g = { pitch, left, top, cols },
    a = scan(before, g),
    z = scan(after, g),
    sites = boxes.map(
      ([l, t, r, b]) =>
        Math.floor(((l + r) / 2 - left) / pitch) +
        cols * Math.floor(((t + b) / 2 - top) / pitch),
    );
  const [old, peer] = sites;
  if (old === peer) return;
  const accent = a[old].find(
    (v) => !z[old].includes(v) && !a[peer].includes(v) && z[peer].includes(v),
  );
  if (accent === undefined) return;
  const inks = sites.map((n, i) => [
    ...new Set(
      a[n].filter(
        (v) => v !== accent && !a[sites[1 - i]].includes(v) && z[n].includes(v),
      ),
    ),
  ]);
  if (inks.some((s) => s.length !== 1)) return;
  const hues = inks.map((s) => s[0]);
  return {
    ...g,
    hues,
    accent,
    counts: [
      [count(z[old], hues[0]), count(a[old], hues[0])],
      [count(a[peer], hues[1]), count(z[peer], hues[1])],
    ],
  };
}
function read(tiles, field, expected) {
  const roles = sensor.hues.map((ink, i) =>
    tiles.flatMap((t, n) =>
      count(t, ink) === sensor.counts[i][Number(t.includes(sensor.accent))]
        ? [n]
        : [],
    ),
  );
  const controls = field.controls ?? [field.control],
    mid = Math.floor(box.length / 2);
  const objects = tiles.flatMap((t, n) =>
    t[mid] === box[mid] &&
    (count(t, box[0]) >= box.length / 3 || controls.includes(n))
      ? [n]
      : [],
  );
  const located = roles.every((s) => s.length === 1),
    positions = roles.map((s) => s[0]);
  return {
    located,
    positions,
    objects,
    valid:
      located &&
      positions.join() === expected.subjects.join() &&
      objects.join() === expected.pieces.join() &&
      tiles[positions[expected.active]]?.includes(sensor.accent),
  };
}
for (const [i, cmd] of r.replayCommands.entries()) {
  assert.equal(hash(b).slice(0, 16), cmd.from);
  const a = await engine.dispatch({
    type: 'action',
    actionId: cmd.id,
    ...(cmd.data ? { data: cmd.data } : {}),
  });
  assert.equal(hash(a).slice(0, 16), cmd.to);
  if (!sensor && cmd.id === 6 && cmd.observedSubjects)
    sensor = registration(b.frame, a.frame, cmd.observedSubjects);
  const f = cmd.cooperative,
    field = f?.coverage ?? f?.crossing;
  if (field && sensor && b.levelsCompleted === a.levelsCompleted) {
    const prior = scan(b.frame, sensor),
      after = scan(a.frame, sensor),
      step = i + 1,
      controls = field.controls ?? [field.control];
    if (!box) {
      const atRoot = scan(root, sensor),
        candidates = f.from.pieces.map((n) => prior[n]);
      box = candidates.sort(
        (a, b) =>
          candidates.filter((t) => t.join() === b.join()).length -
          candidates.filter((t) => t.join() === a.join()).length,
      )[0];
      initialGate = atRoot[field.gate];
    }
    const actual = read(after, field, f.expected),
      was = read(prior, field, f.from);
    if (f.purpose !== 'measure_direction_for_coverage') {
      tested++;
      if (actual.valid) {
        matched++;
        firstVerified ??= step;
      } else rejected.push(step);
    }
    if (was.valid && actual.valid) {
      const parked = 1 - f.from.active,
        exchanging = f.from.active === f.expected.active;
      if (was.objects.join() !== actual.objects.join()) moves++;
      if (field.testPeerPush && !used.has('peer')) {
        milestones.push({
          step,
          effect: 'contact_displaces_partner',
          bothMoved: actual.positions.every((p, j) => p !== was.positions[j]),
        });
        used.add('peer');
      }
      const covered = controls.every(
        (n) => actual.positions.includes(n) || actual.objects.includes(n),
      );
      if (!occupied && controls.every((n) => actual.objects.includes(n))) {
        milestones.push({ step, effect: 'pieces_occupy_controls' });
        occupied = true;
      }
      if (
        !opened &&
        covered &&
        !actual.positions.includes(field.gate) &&
        after[field.gate].some(
          (v, j) => v !== initialGate[j] && !sensor.hues.includes(v),
        )
      ) {
        milestones.push({ step, effect: 'remote_gate_changes' });
        opened = true;
      }
      const additions = f.expected.supports.filter(
        (n) => !f.from.supports.includes(n),
      );
      for (const n of additions)
        if (
          prior[n].join() !== after[n].join() &&
          new Set(prior[n]).size === 1 &&
          new Set(after[n]).size > 1 &&
          actual.objects.length < was.objects.length
        )
          milestones.push({ step, effect: 'new_support', site: n });
      if (
        exchanging &&
        was.objects.includes(actual.positions[f.expected.active]) &&
        actual.objects.includes(was.positions[f.from.active]) &&
        !used.has('exchange')
      ) {
        milestones.push({ step, effect: 'exchanged_with_piece' });
        used.add('exchange');
      }
      for (const n of f.from.supports)
        if (actual.positions.includes(n) && !used.has(n)) {
          milestones.push({ step, effect: 'subject_enters_support', site: n });
          used.add(n);
        }
    }
  }
  b = a;
}
assert.ok(sensor && tested > 0);
const report = {
  code: r.code,
  start: r.start,
  actions: r.issued,
  firstVerified,
  tested,
  matched,
  rejected,
  observedPieceMoves: moves,
  milestones,
  won: b.levelsCompleted > start,
  final: hash(b),
};
await writeFile(out, JSON.stringify(report));
console.log(
  JSON.stringify({
    code: r.code,
    won: report.won,
    tested,
    matched,
    milestones,
  }),
);
