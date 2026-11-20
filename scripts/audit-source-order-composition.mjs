import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { sourceBackend } from './sic-study-source-games.mjs';

const [environment, programFile, ablationFile, output] = process.argv.slice(2);
const { niveau_1, niveaux_supérieurs: levels } = JSON.parse(await readFile(programFile, 'utf8'));
const entries = JSON.parse(await readFile(ablationFile, 'utf8'));
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
for (const { code, l, seq } of levels) {
  const entry = entries.find((x) => x.code === code && x.level === l);
  if (!entry?.confirmed) throw Error('Unconfirmed source program');
  function replay(changes) {
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
    let win = false,
      used = 0;
    for (const op of word) {
      if (!win && b.state !== 'GAME_OVER') {
        b = act(op);
        used++;
      }
      win = b.level > l || b.state === 'WIN';
      frames.push(hash(b));
    }
    return { win, frames, used };
  }
  const base = replay([]);
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
    if (seq[i] !== seq[i + 1]) {
      const r = replay([i]);
      singles.push({ i, win: r.win, converged: r.frames[i + 2] === base.frames[i + 2] });
    }
  for (const a of singles)
    for (const b of singles) {
      if (b.i < a.i + 2) continue;
      const prediction = a.win && b.win,
        trial = replay([a.i, b.i]),
        ground = trial.win;
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
    examples,
  });
}
await writeFile(output, JSON.stringify(results) + '\n');
console.log(
  JSON.stringify({
    levels: results.length,
    trials: results.reduce((s, r) => s + r.singles + r.winningTriples.tested + Object.values(r.double).reduce((a, b) => a + b, 0), 0),
  })
);
