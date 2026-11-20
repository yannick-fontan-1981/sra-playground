import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { initialMemory } from '../src/sic/preparation-experiments.ts';
import { selectDelayed, recordDelayed } from '../src/sic/distinguishing-suffix.ts';
import { sourceBackend } from './sic-study-source-games.mjs';
import { measureNativeObservation } from '../src/logos-engine/v6-native-observer.ts';
import { createHash } from 'node:crypto';
const [environment, directory, output] = process.argv.slice(2);
const d = resolve(directory),
  data = JSON.parse(readFileSync(d + '/space-source-poses.json', 'utf8')),
  original = Array.from({ length: 8 }, (_, i) =>
    readFileSync(d + '/source-final-' + i + '.jsonl', 'utf8')
      .trim()
      .split('\n')
      .map(JSON.parse)
  ).flat();
const backend = await sourceBackend(resolve(environment)),
  out = [];
const hash = (b) => createHash('sha256').update(JSON.stringify(b.frame)).digest('hex').slice(0, 16);
for (const g of data) {
  const raw = original.find((a) => a.code === g.code);
  const m = initialMemory(1),
    scenes = new Map(),
    edges = new Map(),
    ops = new Set(),
    visited = new Set();
  let rev = 0,
    pick = null;
  function sid(h) {
    if (!scenes.has(h)) scenes.set(h, scenes.size);
    return scenes.get(h);
  }
  function obs(h) {
    return {
      level_epoch: 1,
      state: 'NOT_FINISHED',
      revision: rev,
      entities: Object.entries(g.scenes[h]).map(([signature, [x, y]]) => ({ signature, position: [x, y] })),
      available_action_refs: [...ops],
    };
  }
  for (const [s, op, t] of g.edges) {
    const b = g.scenes[s],
      a = g.scenes[t];
    const src = sid(s),
      dest = sid(t),
      key = src + '/' + op;
    if (!edges.has(key)) {
      edges.set(key, m.edges.length);
      const common = Object.keys(b).filter((z) => a[z]),
        moves = common
          .filter((z) => b[z][0] !== a[z][0] || b[z][1] !== a[z][1])
          .map((actor) => ({
            actor,
            from: b[actor].slice(0, 2).join(),
            to: a[actor].slice(0, 2).join(),
            dx: a[actor][0] - b[actor][0],
            dy: a[actor][1] - b[actor][1],
          }));
      m.edges.push({
        s: src,
        t: dest,
        cmd: op,
        ref: rev + 1,
        anchors: Object.fromEntries(
          Object.entries(b).map(([id, v]) => [id, { at: v.slice(0, 2).join(), exterior: '' }])
        ),
        visibleAfter: common,
        stable: true,
        effect: { key: moves.length ? 'move' : s === t ? 'still' : 'change', moves },
      });
    }
    const edge = m.edges[edges.get(key)];
    if (edge.t !== dest) edge.stable = false;
    m.previous = edges.get(key);
    m.delayed.history.push(m.previous);
    m.turns++;
    if (visited.has(t)) m.recurrences++;
    visited.add(s);
    visited.add(t);
    ops.add(op);
    rev++;
    const trial = selectDelayed(m, obs(t), dest, ops)?.delayed;
    if (trial) {
      pick = trial;
      break;
    }
  }
  if (!pick) continue;
  let board = backend.dispatch({ type: 'load', code: g.code, level: 1 });
  for (const cmd of raw.steps.slice(0, rev)) {
    if (hash(board) !== cmd.from) throw Error(g.code + ' prefix');
    board = backend.dispatch({ type: 'action', actionId: cmd.a, ...(cmd.a === 6 ? { data: cmd.data } : {}) });
    if (hash(board) !== cmd.to) throw Error(g.code + ' return');
  }
  const events = [];
  async function measure(b, r) {
    return await measureNativeObservation(
      {
        frame_rows: b.frame,
        frame_hash: hash(b),
        level: b.level,
        state: b.state,
        levels_completed: b.levelsCompleted,
        available_action_refs: b.availableActionIds.map((x) => 'ACTION' + x),
      },
      r
    );
  }
  let before = await measure(board, rev);
  for (let step = 0; pick && step < 7; step++) {
    const op = pick.use ?? pick.sequence[pick.index].op,
      [name, coords] = op.split(':'),
      [x, y] = coords ? coords.split(',').map(Number) : [];
    board = backend.dispatch({
      type: 'action',
      actionId: +name.slice(6),
      ...(coords ? { data: { x, y } } : {}),
    });
    const after = await measure(board, ++rev);
    const ret = recordDelayed(m, pick, { t: sid(hash(board)) }, before, after, board.level > 1);
    events.push({ result: ret.result, index: pick.index, matched: ret.detail.predictedMatched });
    before = after;
    pick = m.delayed.active;
  }
  out.push({ code: g.code, events });
}
writeFileSync(output, JSON.stringify(out) + '\n');
console.log(
  JSON.stringify({
    games: out.length,
    counts: out
      .flatMap((r) => r.events)
      .reduce((counts, e) => ((counts[e.result] = (counts[e.result] ?? 0) + 1), counts), {}),
  })
);
