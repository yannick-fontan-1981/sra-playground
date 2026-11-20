import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { GAME_CATALOG } from '../src/games/catalog.ts';
import { sourceBackend } from './sic-study-source-games.mjs';
import { sourceReplay, op, hash } from './sic-study-source-replay.mjs';
import { observedEdit, projectEdit, imageKey } from '../src/sic/relative-edits.ts';
const [environment, dir, out, cohort, split = '0/1'] = process.argv.slice(2),
  engine = await sourceBackend(resolve(environment));
const allow = new Set(GAME_CATALOG.map((g) => g.code)),
  programs = JSON.parse(
    await readFile(new URL('../docs/architecture/sic-source-seven-programs.json', import.meta.url), 'utf8')
  );
const originals = new Map();
const names =
  cohort === 'lower'
    ? Array.from({ length: 8 }, (_, i) => 'source-final-' + i)
    : ['u2', 'u2entry', 'u3', 'u3entry', 'u4', 'u5'].map((s) => 'cold12-' + s);
for (const name of names)
  for (const l of (await readFile(join(dir, name + '.jsonl'), 'utf8')).trim().split('\n')) {
    const r = JSON.parse(l);
    if (!allow.has(r.code)) throw Error('Unexpected source');
    originals.set(r.code + '/' + r.start, r);
  }
const records = [];
for (const name of cohort === 'lower' ? ['lower0', 'lower1'] : ['upper'])
  records.push(...JSON.parse(await readFile(join(dir, 'probe13-' + name + '.json'), 'utf8')));
const [part, total] = split.split('/').map(Number),
  reports = [];
function counts() {
  return {
    trials: 0,
    exact: 0,
    changed: 0,
    differentBare: 0,
    won: 0,
    laterWins: 0,
    exclusiveWins: 0,
    revived: 0,
  };
}
for (const [i, entry] of records.entries()) {
  if (i % total !== part) continue;
  const r = originals.get(entry.code + '/' + entry.level),
    rep = sourceReplay(engine, programs, r);
  const stats = {},
    examples = [],
    voting = [];
  function count(key, result) {
    const s = (stats[key] ??= counts());
    s.trials++;
    for (const k in s) if (k !== 'trials') s[k] += Number(result[k] ?? 0);
  }
  for (const row of entry.rows) {
    const { k: a, undo, index } = row.edge,
      initial = rep.restore(index),
      image = hash(initial);
    if (image !== row.root) throw Error('Wrong root');
    const active = (b) =>
      b &&
      b.state !== 'GAME_OVER' &&
      b.state !== 'WIN' &&
      b.level === initial.level &&
      b.levelsCompleted === initial.levelsCompleted;
    const win = (b) =>
      !!b && (b.state === 'WIN' || b.levelsCompleted > initial.levelsCompleted || b.level > initial.level);
    const cache = new Map();
    function run(word) {
      const key = JSON.stringify(word);
      if (cache.has(key)) return cache.get(key);
      let b = rep.restore(index);
      for (const k of word) {
        if (!active(b)) break;
        if (!b.availableActionIds.includes(Number(k.split(':')[0].slice(6)))) {
          b = null;
          break;
        }
        b = rep.act(k);
      }
      cache.set(key, b);
      return b;
    }
    const x = run([a]),
      rest = run([a, ...undo]);
    if (!active(x) || !active(rest) || hash(rest) !== image) throw Error('Unverified control');
    const keys = new Set(initial.availableActionIds.filter((n) => n !== 6).map((n) => 'ACTION' + n));
    for (const s of r.steps) if (s.from === row.edge.s) keys.add(op(s));
    const S = imageKey(initial.frame),
      X = imageKey(x.frame);
    for (const b of keys) {
      if (b === a) continue;
      const bare = run([b]),
        configured = run([a, b]);
      if (!active(bare) || !active(configured)) continue;
      const D = imageKey(bare.frame),
        Y = imageKey(configured.frame);
      if (Y === X) continue;
      const residual = observedEdit(x.frame, configured.frame);
      if (!residual) continue;
      const merged = projectEdit(initial.frame, residual);
      if (!merged) continue;
      const prediction = imageKey(merged.board);
      const undoEffect = observedEdit(x.frame, initial.frame),
        restore = undoEffect && projectEdit(configured.frame, undoEffect);
      const predictedUndo = restore ? imageKey(restore.board) : null;
      const novel = ![S, X, D, Y].includes(prediction);
      const cs = [...keys].filter((k) => k !== a);
      const offered = [];
      for (const c of cs) {
        const s = run([c]),
          d = run([b, c]),
          y = run([a, b, c]);
        if (!s || !d || !y) continue;
        const dormant = active(s) && imageKey(s.frame) === S;
        const wakes = active(y) && imageKey(y.frame) !== Y;
        let projected = null;
        if (active(y)) {
          const change = observedEdit(configured.frame, y.frame);
          const next = change && projectEdit(merged.board, change);
          if (next) projected = imageKey(next.board);
        }
        offered.push({ c, dormant, wakes, projected, alreadyWon: win(s) || win(d) || win(y) });
      }
      // Commit to a configuration and its possible continuations before executing the inverse on the edited layout.
      const seal = createHash('sha256')
        .update(JSON.stringify([prediction, predictedUndo, offered]))
        .digest('hex');
      const target = run([a, b, ...undo]);
      if (!target) continue;
      const at = imageKey(target.frame),
        exact = active(target) && at === prediction;
      let laterWins = 0,
        exclusiveWins = 0,
        revived = 0,
        suffixExact = 0;
      const nextChecks = [];
      if (active(target)) {
        for (const { c, dormant, wakes, projected, alreadyWon } of offered) {
          const next = run([a, b, ...undo, c]);
          if (!next) continue;
          const gain = win(next),
            wake = dormant && active(next) && imageKey(next.frame) !== at;
          if (gain) laterWins++;
          let required = false;
          if (gain && !alreadyWon) {
            const minusA = run([b, ...undo, c]),
              minusB = run([a, ...undo, c]);
            required = !!minusA && !!minusB && !win(minusA) && !win(minusB);
            exclusiveWins += Number(required);
          }
          revived += Number(wake);
          const fit = !!projected && active(next) && imageKey(next.frame) === projected;
          suffixExact += Number(fit);
          nextChecks.push({ op: c, win: gain, required, wake, anticipated: wakes, fit });
        }
      }
      const result = {
        exact,
        changed: at !== S,
        differentBare: at !== D,
        won: win(target),
        laterWins: laterWins > 0,
        exclusiveWins: exclusiveWins > 0,
        revived: revived > 0,
      };
      count('all', result);
      if (novel) count('newConfiguration', result);
      if (novel && merged.conflicts === 0) count('compatibleNew', result);
      if (novel && predictedUndo === prediction) count('agreementNew', result);
      if (novel && D === S) count('inactiveBare', result);
      if (
        (novel && exact && laterWins) ||
        exclusiveWins ||
        (novel && exact && revived && examples.length < 4)
      )
        examples.push({
          index,
          a,
          b,
          undo,
          initial: image,
          prediction,
          at,
          exact,
          novel,
          conflicts: merged.conflicts,
          seal,
          nextChecks,
        });
      voting.push({
        index,
        a,
        b,
        undo,
        novel,
        conflicts: merged.conflicts,
        agrees: prediction === predictedUndo,
        bareIdle: D === S,
        beforeUndoChanged: Y !== D,
        exact,
        restoreExact: at === predictedUndo,
        actualNovel: ![S, X, D, Y].includes(at),
        suffixExact,
        revived,
        laterWins,
        exclusiveWins,
      });
    }
  }
  reports.push({ code: r.code, level: r.start, stats, examples, voting });
}
await writeFile(out, JSON.stringify(reports));
