import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { measureNativeObservation } from '../src/logos-engine/v6-native-observer.ts';
import { visualLayout } from '../src/sic/witnessed-preview-transfer.ts';
import {
  detectTransportSelection,
  observeTransport,
  readTransport,
  sitePoint,
} from '../src/sic/transport-observations.ts';
import { hash } from './sic-study-source-replay.mjs';
const [root, tape, code, out] = process.argv.slice(2);
const run = (await readFile(tape, 'utf8'))
  .trim()
  .split(/\r?\n/)
  .map(JSON.parse)
  .find((r) => r.code === code);
assert.ok(
  run &&
    !run.resets &&
    !run.observedPriorLevelActions &&
    !run.sourcePrefixActions &&
    run.start === run.finish,
);
const commands = run.replayCommands,
  index = commands.findIndex(
    (c) => c.cooperative && c.cooperative.expected.supports.length > c.cooperative.from.supports.length,
  );
assert.ok(index >= 0, 'An autonomous prediction must name the new support before pushing');
const { createGameDispatcher } = await import(
  pathToFileURL(resolve(root, 'src/runtime/native-game-dispatcher.ts'))
);
const engine = createGameDispatcher(() => {
  throw Error('Public engine required');
});
const act = (c) => engine.dispatch({ type: 'action', actionId: c.id, ...(c.data ? { data: c.data } : {}) });
async function entry() {
  let b = await engine.dispatch({ type: 'load', code, level: run.start });
  if (b.level !== run.start) b = await engine.dispatch({ type: 'selectLevel', level: run.start });
  return b;
}
async function prefix() {
  let b = await entry();
  for (const c of commands.slice(0, index)) b = await act(c);
  assert.equal(hash(b).slice(0, 16), commands[index].from);
  return b;
}
let b = await entry(),
  m;
for (const c of commands.slice(0, index)) {
  const a = await act(c);
  assert.equal(hash(a).slice(0, 16), c.to);
  if (!m && c.id === 6) {
    const o = await measureNativeObservation(
      {
        frame_rows: b.frame,
        frame_hash: hash(b),
        level: b.level,
        state: b.state,
        levels_completed: b.levelsCompleted,
        available_action_refs: b.availableActionIds.map((i) => 'ACTION' + i),
      },
      0,
      'support-audit',
    );
    m = detectTransportSelection(visualLayout(o, b.frame), b.frame, a.frame, [c.data.x, c.data.y], c.to);
  }
  if (m)
    observeTransport(
      m,
      b.frame,
      a.frame,
      'ACTION' + c.id + (c.data ? ':' + c.data.x + ',' + c.data.y : ''),
      c.to,
    );
  b = a;
}
assert.ok(m);
const predicted = commands[index].cooperative,
  side = m.active,
  peer = 1 - side;
const target = predicted.expected.supports.find((n) => !predicted.from.supports.includes(n)),
  subject = predicted.expected.subjects[side],
  guard = predicted.expected.subjects[peer];
const origin = readTransport(m, b.frame),
  material = origin.tiles[target],
  motor = commands[index].id;
const live = (b) =>
  b.level === run.start && b.state === 'NOT_FINISHED' && b.levelsCompleted === run.initialCompleted;
function matched(v) {
  return v?.subject[side] === subject && v.subject[peer] === guard;
}
async function follow(word) {
  let board = await prefix();
  for (const id of word) {
    board = await act({ id });
    if (!live(board)) break;
  }
  return board;
}
async function probe(word) {
  const start = await follow(word),
    pre = readTransport(m, start.frame);
  assert.ok(matched(pre));
  const end = await act({ id: motor }),
    post = live(end) ? readTransport(m, end.frame) : undefined;
  return {
    word,
    before: hash(start),
    after: hash(end),
    from: pre.subject[side],
    guard: pre.subject[peer],
    material: pre.tiles[target],
    landing: post?.subject[side] ?? null,
    guardAfter: post?.subject[peer] ?? null,
    reached: post?.subject[side] === target,
    state: end.state,
  };
}
const positive = await probe([motor]);
assert.ok(positive.reached && positive.guardAfter === guard && positive.material !== material);
const ops = b.availableActionIds.filter((k) => k >= 1 && k <= 4),
  paths = [[]],
  seen = new Set([hash(b)]);
let negative;
for (let i = 0; i < paths.length && i < 250 && !negative; i++) {
  const p = paths[i];
  if (p.length >= 7) continue;
  for (const id of ops) {
    const word = [...p, id],
      board = await follow(word);
    if (!live(board)) continue;
    const v = readTransport(m, board.frame);
    if (!v || v.subject[peer] !== guard || v.tiles[target] !== material) continue;
    const key = hash(board);
    if (seen.has(key)) continue;
    seen.add(key);
    if (matched(v)) {
      const test = await probe(word);
      if (!test.reached) {
        negative = test;
        break;
      }
    }
    paths.push(word);
  }
}
await writeFile(
  out,
  JSON.stringify({
    code,
    fromDecision: index + 1,
    root: commands[index].from,
    motor,
    source: sitePoint(m.grid, subject),
    target: sitePoint(m.grid, target),
    partner: sitePoint(m.grid, guard),
    positive,
    negative: negative ?? null,
    alternatives: seen.size,
  }),
);
console.log(
  JSON.stringify({
    decision: index + 1,
    positive: positive.reached,
    matchedControl: !!negative,
    negative: negative?.reached,
    controlLength: negative?.word.length,
    alternatives: seen.size,
  }),
);
