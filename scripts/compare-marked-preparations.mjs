import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { hash } from './sic-study-source-replay.mjs';

// All branches start at the first selection whose visible mark actually transferred.
// Group equal-cost preparations by the two observed centers and the selected subject.
const [directory, tape, code, out] = process.argv.slice(2);
const run = (await readFile(tape, 'utf8'))
  .trim()
  .split(/\r?\n/)
  .map(JSON.parse)
  .find((r) => r.code === code);
assert.ok(run && run.start === run.finish && !run.resets);
const { createGameDispatcher } = await import(
  pathToFileURL(resolve(directory, 'src/runtime/native-game-dispatcher.ts'))
);
const engine = createGameDispatcher(() => {
  throw Error('Public dispatcher required');
});
const act = (c) =>
  engine.dispatch({
    type: 'action',
    actionId: c.id,
    ...(c.data ? { data: c.data } : {}),
  });
const index =
  run.preparation.find((p) => p.result === 'cursor_mark_transferred')
    .actionIndex - 1;
const click = run.replayCommands[index],
  boxes = click.observedSubjects;
async function root(selected = true) {
  let b = await engine.dispatch({ type: 'load', code, level: run.start });
  if (b.level !== run.start)
    b = await engine.dispatch({ type: 'selectLevel', level: run.start });
  for (const c of run.replayCommands.slice(0, index + (selected ? 1 : 0)))
    b = await act(c);
  assert.equal(hash(b).slice(0, 16), selected ? click.to : click.from);
  return b;
}
const b = await root(),
  commands = b.availableActionIds.filter((id) => id >= 1 && id <= 5);
const cell = (rows, x, y, w, h) =>
  rows
    .slice(y, y + h)
    .flatMap((row) => row.slice(x, x + w))
    .sort((a, b) => a - b)
    .join(',');
const templates = boxes.map(([l, t, r, bottom]) => ({
  w: r - l + 1,
  h: bottom - t + 1,
  l,
  t,
  colors: cell(b.frame, l, t, r - l + 1, bottom - t + 1),
}));
function locate(rows) {
  const centers = [];
  for (const s of templates) {
    const found = [];
    for (let y = s.t % s.h; y + s.h <= rows.length; y += s.h)
      for (let x = s.l % s.w; x + s.w <= rows[0].length; x += s.w)
        if (cell(rows, x, y, s.w, s.h) === s.colors) found.push([x, y]);
    if (found.length !== 1) return;
    centers.push(found[0]);
  }
  return centers;
}
const key = (c) => c.map((p) => p.join(',')).join('/');
async function after(word) {
  let b = await root();
  for (const id of word) b = await act({ id });
  return b;
}
assert.ok(locate(b.frame), 'Subject identities are ambiguous at the fork');
let frontier = [{ word: [], board: b }];
const contrasts = [],
  sampled = [];
for (let depth = 1; depth <= 3; depth++) {
  const states = new Map(),
    groups = new Map();
  for (const parent of frontier)
    for (const id of commands) {
      const word = [...parent.word, id],
        next = await after(word),
        digest = hash(next);
      if (states.has(digest) || next.levelsCompleted > b.levelsCompleted)
        continue;
      const centers = locate(next.frame);
      if (!centers) continue;
      const state = { word, centers, digest };
      states.set(digest, state);
      const k = key(centers),
        group = groups.get(k) ?? [];
      group.push(state);
      groups.set(k, group);
    }
  let comparisons = 0;
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    for (const id of commands) {
      const arms = [];
      for (const st of group) {
        const next = await after([...st.word, id]),
          centers = locate(next.frame);
        if (!centers) continue;
        arms.push({
          word: st.word,
          from: st.digest.slice(0, 16),
          to: hash(next).slice(0, 16),
          delta: centers.map((p, j) => p.map((v, i) => v - st.centers[j][i])),
        });
      }
      const held = (a) => a.delta[0].every((n) => n === 0);
      for (const blocked of arms.filter(
        (a) => held(a) && a.delta[1].every((n) => n === 0),
      ))
        for (const enabled of arms.filter(
          (a) => held(a) && a.delta[1].some((n) => n !== 0),
        )) {
          comparisons++;
          if (contrasts.length < 10)
            contrasts.push({ depth, id, blocked, enabled });
        }
    }
  }
  sampled.push({
    depth,
    states: states.size,
    comparable: [...groups.values()].filter((g) => g.length > 1).length,
    contrasts: comparisons,
  });
  frontier = [...states.values()];
}
// Vary the first subject's placement, then switch to the second at its witnessed site.
async function preparePartner(word) {
  let state = await root(false);
  for (const id of word) state = await act({ id });
  state = await act(click);
  return state;
}
const partner = [],
  partnerSamples = [];
let histories = [[]];
for (let depth = 1; depth <= 4; depth++) {
  const distinct = new Map();
  for (const prefix of histories)
    for (const id of commands) {
      const word = [...prefix, id],
        next = await preparePartner(word),
        digest = hash(next);
      if (distinct.has(digest)) continue;
      const centers = locate(next.frame);
      if (centers && centers[1].join() === boxes[1].slice(0, 2).join())
        distinct.set(digest, { word, centers, digest });
    }
  let comparisons = 0;
  for (const id of commands) {
    const arms = [];
    for (const st of distinct.values()) {
      await preparePartner(st.word);
      const n = await act({ id }),
        end = locate(n.frame);
      if (end && end[0].join() === st.centers[0].join())
        arms.push({
          word: st.word,
          parked: st.centers[0],
          from: st.digest.slice(0, 16),
          to: hash(n).slice(0, 16),
          delta: end[1].map((v, i) => v - st.centers[1][i]),
        });
    }
    for (const blocked of arms.filter((a) => a.delta.every((n) => n === 0)))
      for (const enabled of arms.filter((a) => a.delta.some((n) => n !== 0))) {
        if (blocked.parked.join() === enabled.parked.join()) continue;
        comparisons++;
        if (partner.length < 10) partner.push({ depth, id, blocked, enabled });
      }
  }
  partnerSamples.push({ depth, states: distinct.size, contrasts: comparisons });
  histories = [...distinct.values()].map((s) => s.word);
}
await writeFile(
  out,
  JSON.stringify({
    code,
    level: run.start,
    fork: index + 1,
    sampled,
    contrasts,
    partnerSamples,
    partner,
  }),
);
console.log(
  JSON.stringify({
    sampled,
    example: contrasts[0],
    partnerSamples,
    examplePartner: partner[0],
  }),
);
