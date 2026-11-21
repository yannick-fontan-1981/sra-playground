import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
const [env, code, start, scene, plan, destination] = process.argv.slice(2),
  s = JSON.parse(await readFile(scene)),
  path = JSON.parse(await readFile(plan));
const { createGameDispatcher } = await import(
  pathToFileURL(resolve(env, 'src/runtime/native-game-dispatcher.ts'))
);
const engine = createGameDispatcher(() => {
  throw Error('Public engine required');
});
let b = await engine.dispatch({ type: 'load', code, level: +start });
if (b.level !== +start) b = await engine.dispatch({ type: 'selectLevel', level: +start });
const score = b.levelsCompleted,
  hash = (b) => createHash('sha256').update(JSON.stringify(b.frame)).digest('hex'),
  tape = [];
async function act(id, data) {
  const from = hash(b);
  b = await engine.dispatch({ type: 'action', actionId: id, ...(data ? { data } : {}) });
  tape.push({ id, data, from, to: hash(b) });
}
function pose() {
  const p = s.pitch,
    h = Math.floor(p / 4),
    parts = [undefined, undefined],
    bs = [],
    br = [];
  for (let y = s.offset[1]; y < b.frame.length * 2; y += p)
    for (let x = s.offset[0]; x < b.frame[0].length * 2; x += p) {
      const t = b.frame.slice(y / 2 - h, y / 2 + h + 1).flatMap((row) => row.slice(x / 2 - h, x / 2 + h + 1));
      for (const [i, k] of s.actorInks.entries()) if (t.includes(k)) parts[i] = [x, y];
      if (t.join() === s.prep.box) bs.push([x, y]);
      if (t.join() === s.prep.bridge) br.push([x, y]);
    }
  return { a: parts[0], b: parts[1], boxes: bs, bridges: br };
}
let active = s.active,
  firstFailure = null;
const feedback = [];
const eq = (p, q) => p?.join() === q?.join();
for (const [i, step] of path.entries()) {
  const pre = pose();
  if (step.side !== active) {
    const cell = step.side ? pre.b : pre.a;
    await act(6, { x: cell[0] / 2, y: cell[1] / 2 });
    active = step.side;
  }
  await act(step.op);
  const post = pose();
  const official = b.state === 'WIN' || b.levelsCompleted > score;
  feedback.push({ i, op: step.op, side: step.side, post, official });
  if (official) break;
  if (!eq(post.a, step.after.a) || !eq(post.b, step.after.b) || b.state !== 'NOT_FINISHED') {
    firstFailure = {
      i,
      input: tape.length,
      op: step.op,
      side: step.side,
      pre,
      post,
      expected: step.after,
      state: b.state,
    };
    break;
  }
}
const official = b.state === 'WIN' || b.levelsCompleted > score;
await writeFile(
  destination,
  JSON.stringify({
    tape,
    feedback,
    firstFailure,
    official,
    state: b.state,
    level: b.level,
    completed: b.levelsCompleted,
  }),
);
console.log(JSON.stringify({ actions: tape.length, official, firstFailure }));
if (!official || firstFailure) process.exitCode = 1;
