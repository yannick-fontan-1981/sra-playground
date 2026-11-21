import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { openParkedSubjects } from './sic-study-parked-subjects.mjs';
const [env, tape, code, comparison, out] = process.argv.slice(2);
const example = JSON.parse(await readFile(comparison, 'utf8')).examples.different_position;
assert.equal(example.suffix.length, 1);
const s = await openParkedSubjects(env, tape, code),
  pitch = 2 * Math.max(...s.verify.controlContrast.baselineDelta.map(Math.abs));
const align = (p) => p.map((v, i) => s.selected[i] + pitch * Math.round((v - s.selected[i]) / pitch));
const same = (p, q) => !!p && !!q && p.every((v, i) => v === q[i]);
const dist = (p, q) => Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]);
const direction = (p, q) => p.map((v, i) => Math.sign(q[i] - v));
const poses = [{ word: [], at: s.original }],
  seen = new Set([s.original.join()]);
for (let i = 0; i < poses.length && poses.length < 34; i++)
  for (const id of s.directions) {
    const word = [...poses[i].word, id];
    if (word.length > 12) continue;
    const b = await s.prepare(word);
    if (!s.live(b)) continue;
    const l = await s.view(b),
      at = s.at(l, s.first);
    if (!at || !s.same(s.at(l, s.second), s.selected) || seen.has(at.join())) continue;
    seen.add(at.join());
    poses.push({ at, word });
  }
const readings = [];
for (const p of poses)
  for (const id of s.directions) {
    await s.prepare(p.word);
    const b = await s.act(s.select);
    if (!s.live(b)) continue;
    const before = await s.view(b),
      from = s.at(before, s.moving),
      guard = s.at(before, s.parked);
    if (!from || !guard || !s.same(guard, p.at)) continue;
    const a = await s.act({ id });
    if (!s.live(a)) continue;
    const after = await s.view(a),
      end = s.at(after, s.moving),
      parked = s.at(after, s.parked);
    if (end && parked)
      readings.push({
        word: p.word.join(),
        id,
        before,
        after,
        from: align(from),
        end: align(end),
        guard: align(guard),
        parked: align(parked),
      });
  }
const training = new Set(example.preparations.map((w) => w.join()));
const arms = readings.filter((r) => training.has(r.word));
const long = arms
  .filter((r) => r.id === example.suffix[0])
  .sort((a, b) => dist(b.from, b.end) - dist(a.from, a.end))[0];
const has = (l, k, p) => l[k]?.some((v) => s.same(v.at, p));
const roles = Object.keys(long.before)
  .filter(
    (k) =>
      has(long.before, k, long.end) &&
      !has(long.before, k, long.from) &&
      has(long.after, k, long.from) &&
      !has(long.after, k, long.end),
  )
  .sort((a, b) => long.before[b].length - long.before[a].length);
assert.ok(roles.length && (!roles[1] || long.before[roles[0]].length > long.before[roles[1]].length));
const inventory = roles[0],
  handoff = readings.find(
    (r) =>
      !training.has(r.word) && dist(r.from, r.end) > pitch && same(r.guard, r.end) && same(r.parked, r.from),
  );
assert.ok(handoff);
training.add(handoff.word);
const motors = {};
for (const id of s.directions) {
  const directions = new Set(
    arms
      .filter((r) => r.id === id && dist(r.from, r.end) >= pitch)
      .map((r) => direction(r.from, r.end).join()),
  );
  if (directions.size === 1) motors[id] = [...directions][0].split(',').map(Number);
}
const counts = {
  preparations: poses.length,
  training: training.size,
  comparable: 0,
  piece: 0,
  pieceConfirmed: 0,
  peer: 0,
  peerConfirmed: 0,
  ordinary: 0,
  ordinaryConfirmed: 0,
  ordinaryWouldExplainExchange: 0,
  multipleTargets: 0,
  firstAmongMultiple: 0,
};
for (const r of readings) {
  const d = motors[r.id];
  if (!d || training.has(r.word)) continue;
  const aligned = (p) => same(direction(r.from, p), d);
  const ps = (r.before[inventory] ?? [])
    .map((v) => align(v.at))
    .filter(aligned)
    .map((p) => ({ p, role: 'piece' }));
  if (aligned(r.guard)) ps.push({ p: r.guard, role: 'peer' });
  ps.sort((a, b) => dist(r.from, a.p) - dist(r.from, b.p));
  if (ps[1] && same(ps[0].p, ps[1].p)) continue;
  const target = ps[0],
    ordinary = r.from.map((v, i) => v + d[i] * pitch);
  counts.comparable++;
  if (!target) {
    counts.ordinary++;
    if (same(ordinary, r.end)) counts.ordinaryConfirmed++;
    continue;
  }
  counts[target.role]++;
  if (ps.length > 1) counts.multipleTargets++;
  const reciprocal =
    target.role === 'peer'
      ? same(r.parked, r.from)
      : has(r.after, inventory, r.from) && !has(r.after, inventory, target.p) && same(r.parked, r.guard);
  if (reciprocal && same(r.end, target.p)) {
    counts[target.role + 'Confirmed']++;
    if (ps.length > 1) counts.firstAmongMultiple++;
  }
  if (same(ordinary, r.end)) counts.ordinaryWouldExplainExchange++;
}
await writeFile(
  out,
  JSON.stringify({
    code,
    pitch,
    counts,
    calibration: {
      pairedPreparations: example.preparations,
      additionalGuardPreparation: handoff.word.split(',').map(Number),
      motors,
    },
  }),
);
console.log(JSON.stringify(counts));
