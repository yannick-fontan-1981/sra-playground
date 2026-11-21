import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
// Offline comparison. Each alternative restores its full public prefix in a separate episode.
const [directory, tape, meta, out, cap] = process.argv.slice(2),
  rr = JSON.parse(await readFile(tape)),
  study = JSON.parse(await readFile(meta));
const { createGameDispatcher } = await import(
    pathToFileURL(resolve(directory, 'src/runtime/native-game-dispatcher.ts'))
  ),
  { hash } = await import(
    pathToFileURL(resolve('scripts/sic-study-source-replay.mjs'))
  );
const en = createGameDispatcher(() => {
    throw Error();
  }),
  act = (c) =>
    en.dispatch({
      type: 'action',
      actionId: c.id,
      ...(c.data ? { data: c.data } : {}),
    });
async function restore(word) {
  let b = await en.dispatch({ type: 'load', code: rr.code, level: rr.start });
  if (b.level !== rr.start)
    b = await en.dispatch({ type: 'selectLevel', level: rr.start });
  for (const c of word) b = await act(c);
  return b;
}
const root = await restore([]),
  cl = rr.replayCommands.find((c) => c.id === 6 && c.observedSubjects),
  [l, t, r, bt] = cl.observedSubjects[0],
  w = r - l + 1,
  h = bt - t + 1,
  x0 = l % w,
  y0 = t % h,
  cols = Math.floor((root.frame[0].length - x0) / w),
  rows = Math.floor((root.frame.length - y0) / h),
  mid = Math.floor((w * h) / 2);
assert.equal(
  cl,
  rr.replayCommands[0],
  'This diagnostic starts at an observed selection on the opening image',
);
assert.equal(rr.start, rr.finish);
const index = ([x, y]) =>
  Math.floor((x - x0) / w) + Math.floor((y - y0) / h) * cols;
const center = (n) => ({
  x: x0 + (n % cols) * w + Math.floor(w / 2),
  y: y0 + Math.floor(n / cols) * h + Math.floor(h / 2),
});
function tile(frame, n) {
  const { x, y } = center(n),
    v = [];
  for (let dy = -Math.floor(h / 2); dy <= Math.floor(h / 2); dy++)
    for (let dx = -Math.floor(w / 2); dx <= Math.floor(w / 2); dx++)
      v.push(frame[y + dy][x + dx]);
  return v;
}
const anchors = cl.observedSubjects.map(index),
  roles = anchors.map((n) => tile(root.frame, n));
const floor = roles[0].find((v) => roles[1].includes(v)),
  selected = await act(cl),
  stamp = roles[0].find(
    (v) =>
      !tile(selected.frame, anchors[0]).includes(v) &&
      tile(selected.frame, anchors[1]).includes(v),
  );
const inks = roles.map((p) => p.find((v) => v !== floor && v !== stamp)),
  movable = study.report.find((g) => g.total > 0),
  boxInk = movable.glyph[0],
  core = movable.glyph[mid],
  fixed = study.report.filter((g) => g !== movable),
  dest = fixed.find((g) => g.glyph[mid] === floor).initial,
  plates = fixed.find((g) => g.glyph[mid] !== floor).initial;
const md = (a, b) =>
  Math.abs((a % cols) - (b % cols)) +
  Math.abs(Math.floor(a / cols) - Math.floor(b / cols));
const assignment = (a, g) =>
  Math.min(md(a[0], g[0]) + md(a[1], g[1]), md(a[1], g[0]) + md(a[0], g[1]));
function read(b) {
  const sub = [[], []],
    selectedSites = [],
    boxes = [];
  for (let n = 0; n < cols * rows; n++) {
    const q = tile(b.frame, n);
    for (let i = 0; i < 2; i++)
      if (
        q.filter((x) => x === inks[i]).length ===
        (q.includes(stamp) ? Math.floor(q.length / 2) : Math.ceil(q.length / 2))
      ) {
        sub[i].push(n);
        if (q.includes(stamp)) selectedSites.push(i);
      }
    if (
      q[mid] === core &&
      (q.includes(boxInk) || plates.includes(n)) &&
      (q.filter((x) => x === boxInk).length >= q.length / 3 ||
        plates.includes(n))
    )
      boxes.push(n);
  }
  if (
    sub.some((z) => z.length !== 1) ||
    boxes.length !== 2 ||
    selectedSites.length !== 1
  )
    return;
  const subjects = sub.map((z) => z[0]),
    side = selectedSites[0],
    bd = assignment(boxes, plates),
    gd = assignment(subjects, dest);
  return { subjects, side, boxes, bd, gd };
}
const scan = read(root);
if (!scan) throw Error('unknown initial registration');
const q = [{ word: [], score: 0, info: scan }],
  seen = new Map([[hash(root), 0]]);
let moves = 0,
  best = Infinity,
  closest,
  won;
for (let it = 0; q.length && it < +cap; it++) {
  q.sort((a, b) => a.score - b.score || a.word.length - b.word.length);
  const p = q.shift();
  const choices = root.availableActionIds
    .filter((id) => id !== 6)
    .map((id) => ({ id }));
  choices.push({ id: 6, data: center(p.info.subjects[1 - p.info.side]) });
  for (const cmd of choices) {
    const s = await restore(p.word);
    const next = await act(cmd),
      word = [...p.word, cmd];
    moves++;
    if (next.levelsCompleted > root.levelsCompleted || next.state === 'WIN') {
      won = word;
      break;
    }
    if (next.state !== root.state) continue;
    const dig = hash(next);
    if ((seen.get(dig) ?? Infinity) <= word.length) continue;
    seen.set(dig, word.length);
    const z = read(next);
    if (!z) continue;
    const parked = z.boxes.filter((n) => plates.includes(n)).length;
    const h =
      z.bd === 0
        ? z.gd
        : 18 +
          3 * z.bd +
          Math.min(
            ...z.boxes
              .filter((n) => !plates.includes(n))
              .map((n) => md(z.subjects[z.side], n)),
          ) /
            3;
    if (h < best) {
      best = h;
      closest = { word, info: z, parked };
    }
    q.push({ word, info: z, score: word.length + 5 * h });
  }
  if (won) break;
}
const milestones = [],
  alternatives = [],
  reference = [];
if (won) {
  let b = await restore([]),
    selected,
    earlier;
  const start = b.levelsCompleted;
  for (const [i, cmd] of won.entries()) {
    b = await act(cmd);
    if (b.levelsCompleted > start || b.state === 'WIN') {
      milestones.push({ step: i + 1, won: true });
      break;
    }
    const info = read(b);
    reference[i] = info;
    if (!info) continue;
    const parked = info.boxes.filter((n) => plates.includes(n)).length;
    if (parked !== earlier || info.side !== selected) {
      milestones.push({ step: i + 1, parked, selected: info.side });
      earlier = parked;
      selected = info.side;
    }
  }
  assert.ok(
    b.levelsCompleted > start || b.state === 'WIN',
    'Independent public replay failed',
  );
  for (const [at, input] of won.entries()) {
    if (input.id !== 6) continue;
    let state = await restore(won.slice(0, at));
    const who = read(state);
    assert.ok(who);
    let firstBoxDifference,
      firstPlacementDifference,
      coveredAt,
      count = at;
    for (let i = at; i < won.length; i++) {
      const cmd =
        i === at ? { id: 6, data: center(who.subjects[who.side]) } : won[i];
      state = await act(cmd);
      count++;
      if (state.levelsCompleted > start || state.state === 'WIN') break;
      const actual = read(state),
        expected = reference[i];
      if (actual && expected) {
        if (
          !firstBoxDifference &&
          actual.boxes.join() !== expected.boxes.join()
        )
          firstBoxDifference = i + 1;
        if (
          !firstPlacementDifference &&
          actual.subjects.join() !== expected.subjects.join()
        )
          firstPlacementDifference = i + 1;
        if (!coveredAt && actual.bd === 0) coveredAt = i + 1;
      }
    }
    alternatives.push({
      reselectedAt: at + 1,
      firstBoxDifference,
      firstPlacementDifference,
      coveredAt,
      actions: count,
      won: state.levelsCompleted > start || state.state === 'WIN',
    });
  }
}
// Compare explanations on the pilot's public actions and, independently, the winning branch.
const ground = new Set();
for (let n = 0; n < cols * rows; n++) {
  const q = tile(root.frame, n);
  if (
    q.includes(floor) ||
    q.includes(boxInk) ||
    plates.includes(n) ||
    dest.includes(n)
  )
    ground.add(n);
}
async function compareReach(word) {
  const observations = [[], []];
  let b = await restore([]);
  for (const cmd of word) {
    const before = read(b);
    b = await act(cmd);
    const after = read(b);
    if (!before || !after || cmd.id === 6 || before.side !== after.side)
      continue;
    const side = before.side,
      start = before.subjects[side],
      end = after.subjects[side];
    const dx = (end % cols) - (start % cols),
      dy = Math.floor(end / cols) - Math.floor(start / cols);
    if (Math.abs(dx) + Math.abs(dy) !== 1) continue;
    for (const piece of before.boxes) {
      const nx = (piece % cols) - (start % cols),
        ny = Math.floor(piece / cols) - Math.floor(start / cols),
        to = piece + dx + dy * cols;
      const free =
        ground.has(to) &&
        !before.boxes.includes(to) &&
        !before.subjects.includes(to);
      observations[side].push({
        nx,
        ny,
        dx,
        dy,
        free,
        front: piece === end,
        moved: !after.boxes.includes(piece) && after.boxes.includes(to),
      });
    }
  }
  return observations.map((data) => {
    const errors = (predict) =>
      data.filter((o) => predict(o) !== o.moved).length;
    const distances = [
      ...new Set(data.map((o) => Math.max(Math.abs(o.nx), Math.abs(o.ny)))),
    ].sort((a, b) => a - b);
    return {
      sample: data.length,
      unique: new Set(data.map((o) => JSON.stringify(o))).size,
      translated: data.filter((o) => o.moved).length,
      contactErrors: errors((o) => o.free && o.front),
      unrestrictedErrors: errors((o) => o.free),
      rangeErrors: distances.map((range) => ({
        range,
        errors: errors(
          (o) => o.free && Math.max(Math.abs(o.nx), Math.abs(o.ny)) <= range,
        ),
      })),
    };
  });
}
const explanations = {
  pilot: await compareReach(rr.replayCommands),
  ...(won ? { branch: await compareReach(won) } : {}),
};
await writeFile(
  out,
  JSON.stringify({
    moves,
    visited: seen.size,
    closest,
    won,
    milestones,
    alternatives,
    explanations,
  }),
);
console.log(
  JSON.stringify({
    moves,
    visited: seen.size,
    win: won?.length,
    milestones,
    alternatives,
  }),
);
