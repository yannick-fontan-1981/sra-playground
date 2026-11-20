import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { measureNativeObservation } from '../src/logos-engine/v6-native-observer.ts';
import { GAME_CATALOG } from '../src/games/catalog.ts';
import { sourceBackend } from './sic-study-source-games.mjs';

const [environment, programFile, ablationFile, output] = process.argv.slice(2);
async function sourcePrograms(directory) {
  const files = Array.from({ length: 8 }, (_, i) =>
    readFile(resolve(directory, 'source-final-' + i + '.jsonl'), 'utf8')
  );
  const records = (await Promise.all(files)).flatMap((text) => text.trim().split('\n').map(JSON.parse));
  if (
    records
      .map((r) => r.code)
      .sort()
      .join() !==
    GAME_CATALOG.map((g) => g.code)
      .sort()
      .join()
  )
    throw Error('Expected the original source cohort');
  const levels = records
    .filter((r) => r.levels[0].won)
    .map((r) => {
      const seq = r.steps.map((s) => String(s.a) + (s.a === 6 ? '@' + s.data.x + ',' + s.data.y : ''));
      const eligible = seq.flatMap((op, i) => (i + 1 < seq.length && op !== seq[i + 1] ? [i] : []));
      const selectedSwaps =
        eligible.length <= 4
          ? eligible
          : Array.from({ length: 4 }, (_, i) => eligible[Math.floor((i * (eligible.length - 1)) / 3)]);
      return { code: r.code, l: 1, seq, selectedSwaps };
    });
  return {
    programs: { niveau_1: {}, niveaux_supérieurs: levels },
    entries: levels.map((r) => ({ code: r.code, level: 1, entry: 'direct', confirmed: true })),
  };
}
const study =
  programFile === 'source100'
    ? await sourcePrograms(ablationFile)
    : {
        programs: JSON.parse(await readFile(programFile, 'utf8')),
        entries: JSON.parse(await readFile(ablationFile, 'utf8')),
      };
const { niveau_1, niveaux_supérieurs: levels } = study.programs;
const { entries } = study;
const engine = await sourceBackend(resolve(environment)),
  results = [];
function act(cmd) {
  const [op, xy] = cmd.split('@'),
    [x, y] = xy ? xy.split(',').map(Number) : [];
  return engine.dispatch({ type: 'action', actionId: Number(op), ...(xy ? { data: { x, y } } : {}) });
}
const hash = (b) =>
  createHash('sha256')
    .update(JSON.stringify([b.level, b.levelsCompleted, b.state, b.availableActionIds, b.frame]))
    .digest('hex');
for (const { code, l, seq, selectedSwaps } of levels) {
  const entry = entries.find((x) => x.code === code && x.level === l);
  if (!entry?.confirmed) throw Error('Unconfirmed source program');
  function replay(changes, collect = false) {
    let b = engine.dispatch({ type: 'load', code, level: entry.entry === 'chronological' ? 1 : l });
    if (entry.entry === 'chronological')
      for (let i = 1; i < l; i++) {
        const prefix =
          i === 1 ? niveau_1[code].suite_gagnante : levels.find((x) => x.code === code && x.l === i).seq;
        if (b.level !== i) throw Error('Bad entry prefix');
        for (const op of prefix) b = act(op);
      }
    else if (b.level !== l && b.canSelectLevel) b = engine.dispatch({ type: 'selectLevel', level: l });
    if (b.level !== l) throw Error('Bad initial level');
    const word = [...seq],
      frames = [hash(b)];
    for (const i of changes) [word[i], word[i + 1]] = [word[i + 1], word[i]];
    const path = [];
    let lastBoard, lastCommand;
    let win = false,
      used = 0;
    for (const op of word) {
      if (!win && b.state !== 'GAME_OVER') {
        if (collect) path.push(b);
        lastBoard = b;
        lastCommand = op;
        b = act(op);
        used++;
      }
      win = b.level > l || b.state === 'WIN';
      frames.push(hash(b));
    }
    return { win, frames, used, lastBoard, lastCommand, path };
  }
  const base = replay([], true);
  const cache = new Map();
  async function positions(board) {
    const key = hash(board);
    if (!cache.has(key)) {
      const obs = await measureNativeObservation(
        {
          frame_rows: board.frame,
          frame_hash: key,
          level: board.level,
          state: board.state,
          levels_completed: board.levelsCompleted,
          available_action_refs: board.availableActionIds.map((op) => 'ACTION' + op),
        },
        1
      );
      cache.set(
        key,
        new Map(
          obs.entities.filter((e) => !e.identity_ambiguous).map((e) => [e.signature, e.position.join()])
        )
      );
    }
    return cache.get(key);
  }
  const tracks = new Map();
  for (const board of base.path)
    for (const [role, at] of await positions(board)) {
      const seen = tracks.get(role) ?? new Set();
      seen.add(at);
      tracks.set(role, seen);
    }
  const mobile = [...tracks]
    .filter(([, seen]) => seen.size > 1)
    .map(([id]) => id)
    .sort();
  const knownLayouts = new Map(),
    layoutCatalogue = [];
  async function register(result, swaps, reference) {
    if (!result.win) return;
    const actual = await positions(result.lastBoard);
    const poses = mobile.filter((id) => actual.has(id)).map((id) => [id, actual.get(id)]);
    const group = JSON.stringify([result.lastCommand, poses.map((p) => p[0])]);
    const id = JSON.stringify(poses.map((p) => p[1]));
    if (reference) {
      const seen = knownLayouts.get(group) ?? new Set();
      seen.add(id);
      knownLayouts.set(group, seen);
      return;
    }
    const known = knownLayouts.get(group);
    layoutCatalogue.push({
      swaps,
      command: result.lastCommand,
      visible: poses.length,
      comparable: !!known && poses.length > 0,
      novel: !!known && poses.length > 0 && !known.has(id),
      poseHash: createHash('sha256')
        .update(id + group)
        .digest('hex')
        .slice(0, 16),
    });
  }
  await register(base, [], true);
  if (!base.win) throw Error('Source did not win');
  const singles = [],
    double = { P1: 0, P0: 0, N1: 0, N0: 0 },
    exact = { P1: 0, P0: 0, N1: 0, N0: 0 };
  let afterFirstDifferent = 0,
    secondOrderRescues = 0,
    bothSwapsExecuted = 0;
  const formerlyUnpredicted = [],
    winningTriples = { tested: 0, won: 0, allExecuted: 0 };
  const examples = [];
  for (let i = 0; i + 1 < seq.length; i++)
    if (seq[i] !== seq[i + 1] && (!selectedSwaps || selectedSwaps.includes(i))) {
      const r = replay([i]);
      await register(r, [i], true);
      singles.push({ i, win: r.win, converged: r.frames[i + 2] === base.frames[i + 2] });
    }
  for (const a of singles)
    for (const b of singles) {
      if (b.i < a.i + 2) continue;
      const prediction = a.win && b.win,
        trial = replay([a.i, b.i]),
        ground = trial.win;
      if (prediction && ground) await register(trial, [a.i, b.i], false);
      if (prediction && ground && trial.used >= b.i + 2) bothSwapsExecuted++;
      if (!prediction && ground) formerlyUnpredicted.push([a.i, b.i]);
      const label = (prediction ? 'P' : 'N') + (ground ? '1' : '0');
      double[label]++;
      if (a.converged) exact[label]++;
      if (!a.converged && prediction && ground) afterFirstDifferent++;
      if (!a.win && !b.win && ground) secondOrderRescues++;
      if (((!prediction && ground) || (!a.converged && prediction && ground)) && examples.length < 3)
        examples.push({ swaps: [a.i, b.i], bothSingleWin: prediction, win: ground, firstEqual: a.converged });
    }
  for (const a of singles.filter((s) => s.win))
    for (const b of singles.filter((s) => s.win && s.i > a.i + 1))
      for (const c of singles.filter((s) => s.win && s.i > b.i + 1)) {
        const r = replay([a.i, b.i, c.i]);
        if (r.win) await register(r, [a.i, b.i, c.i], false);
        winningTriples.tested++;
        winningTriples.won += Number(r.win);
        winningTriples.allExecuted += Number(r.win && r.used >= c.i + 2);
      }
  results.push({
    code,
    level: l,
    singles: singles.length,
    singleWins: singles.filter((x) => x.win).length,
    sameImage: singles.filter((x) => x.converged).length,
    double,
    exact,
    afterFirstDifferent,
    secondOrderRescues,
    bothSwapsExecuted,
    winningTriples,
    formerlyUnpredicted,
    layoutCatalogue,
    examples,
  });
}
await writeFile(output, JSON.stringify(results) + '\n');
console.log(
  JSON.stringify({
    levels: results.length,
    trials: results.reduce(
      (s, r) => s + r.singles + r.winningTriples.tested + Object.values(r.double).reduce((a, b) => a + b, 0),
      0
    ),
  })
);
