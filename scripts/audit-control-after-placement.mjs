import { changedControl } from '../src/sic/partial-control-repertoire.ts';
import { forecastPreparedControls } from './forecast-control-after-placement.mjs';
import { compareControlRepertoires } from '../src/sic/control-repertoire.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { sourceReplay, hash, op } from './sic-study-source-replay.mjs';
import { sourceBackend } from './sic-study-source-games.mjs';
import { measureNativeObservation } from '../src/logos-engine/v6-native-observer.ts';
import { GAME_CATALOG } from '../src/games/catalog.ts';

// Measure which commands acquire distinct, role-specific consequences after a preparation.
// The final probe is sealed until every candidate has been ranked.
const [environment, directory, output, cohort, split = '0/1'] = process.argv.slice(2);
const [shard, shards] = split.split('/').map(Number);
const json = async (p) => JSON.parse(await readFile(p, 'utf8'));
const programs = await json(new URL('../docs/architecture/sic-source-seven-programs.json', import.meta.url));
const allowed = new Set(GAME_CATALOG.map((g) => g.code));
const engine = await sourceBackend(resolve(environment));
const cases = [];
if (cohort === 'lower') {
  for (let i = 0; i < 8; i++) {
    const lines = await readFile(join(directory, 'source-final-' + i + '.jsonl'), 'utf8');
    for (const line of lines.trim().split('\n')) {
      const run = JSON.parse(line);
      cases.push({ run, word: run.steps.map(op), won: run.levels[0].won });
    }
  }
} else if (cohort === 'upper') {
  const entries = await json(
    new URL('../docs/architecture/sic-projected-affordances-results.json', import.meta.url)
  );
  for (const { code, level, entry, confirmed } of entries.upperLevels) {
    if (!confirmed) throw Error('Unconfirmed entry');
    const seq = programs.niveaux_supérieurs.find((r) => r.code === code && r.l === level).seq;
    cases.push({
      run: { code, start: level, sourcePrefixActions: Number(entry === 'chronological') },
      word: seq.map((s) => 'ACTION' + s.replace('@', ':')),
      won: true,
    });
  }
} else throw Error('Unknown source cohort');
const pos = (p) => p.join(',');
async function audit({ run, word, won }) {
  if (!allowed.has(run.code)) throw Error('Source cohort required');
  const result = { code: run.code, level: run.start, referenceWon: won, length: word.length };
  if (word.length < 3) return result;
  const begin = won ? word.length - 3 : Math.min(8, word.length - 3);
  const { act, restore, openEntry } = sourceReplay(engine, programs, run);
  const entryCompleted = openEntry().b.levelsCompleted;
  const win = (b) => b && (b.level > run.start || b.levelsCompleted > entryCompleted || b.state === 'WIN');
  const active = (b) => b && !win(b) && b.state !== 'GAME_OVER';
  const apply = (b, cmd) =>
    active(b) && b.availableActionIds.includes(Number(cmd.split(':')[0].slice(6))) ? act(cmd) : null;
  function start() {
    if (run.steps) return restore(begin);
    let { b } = openEntry();
    if (b.level !== run.start) throw Error('Wrong level');
    for (const k of word.slice(0, begin)) b = apply(b, k);
    if (!active(b)) throw Error('Invalid decision prefix');
    return b;
  }
  const root = start(),
    origin = hash(root);
  const cache = new Map();
  async function poses(b) {
    if (!active(b)) return null;
    const key = hash(b);
    if (!cache.has(key)) {
      const o = await measureNativeObservation(
        {
          frame_rows: b.frame,
          frame_hash: key,
          level: 1,
          levels_completed: 0,
          state: b.state,
          available_action_refs: b.availableActionIds.map((id) => 'ACTION' + id),
        },
        1
      );
      cache.set(
        key,
        o.entities.filter((e) => !e.identity_ambiguous && e.area < (b.frame.length * b.frame[0].length) / 4)
      );
    }
    return new Map(cache.get(key).map((e) => [e.signature, e.position]));
  }
  const startPos = await poses(root);
  const buttons = root.availableActionIds.filter((id) => id !== 6).map((id) => 'ACTION' + id);
  if (root.availableActionIds.includes(6)) {
    const past = word
      .slice(0, begin)
      .reverse()
      .filter((s) => s.startsWith('ACTION6:'));
    const centres = cache
      .get(origin)
      .slice()
      .sort((a, b) => a.area - b.area || a.position[1] - b.position[1] || a.position[0] - b.position[0])
      .map(
        (e) =>
          'ACTION6:' +
          [Math.floor((e.bbox[0] + e.bbox[2]) / 2), Math.floor((e.bbox[1] + e.bbox[3]) / 2)].join()
      );
    buttons.push(...[...new Set([...new Set(past)].slice(0, 2).concat(centres))].slice(0, 4));
  }
  buttons.sort();
  result.prefix = begin;
  result.vocab = buttons.length;
  function play(keys) {
    let b = start();
    if (hash(b) !== origin) throw Error('Non-reproducible prefix');
    for (const k of keys) b = apply(b, k);
    return b;
  }
  const baseline = new Map();
  const forks = new Map(),
    hashes = new Map();
  for (const b of buttons) {
    const state = play([b]);
    baseline.set(b, await poses(state));
    if (active(state)) hashes.set(b, hash(state));
  }
  const cells = [];
  for (const a of buttons) {
    const setup = baseline.get(a);
    if (!setup) continue;
    const fork = new Map();
    for (const b of buttons) fork.set(b, await poses(play([a, b])));
    forks.set(a, fork);
    for (const [b, target] of fork) {
      if (!target) continue;
      let best = null;
      for (const [id, from] of setup) {
        const end = target.get(id),
          rootAt = startPos.get(id),
          direct = baseline.get(b)?.get(id);
        if (!end || !rootAt || !direct || pos(from) === pos(end)) continue;
        const shared = buttons.filter((cmd) => !!baseline.get(cmd)?.get(id) && !!fork.get(cmd)?.get(id));
        if (!shared.includes(b) || shared.length < 2) continue;
        const responses = new Map(
          shared.map((k) => [k, { before: baseline.get(k).get(id), after: fork.get(k).get(id) }])
        );
        const change = compareControlRepertoires(rootAt, from, responses, b);
        if (change && (!best || change.score > best.score)) best = { id, ...change, from, end };
      }
      cells.push({ a, b, best });
    }
  }
  // Store the rankings before accessing the held-out command or its outcome.
  const byScore = [...cells].sort((x, y) => (y.best?.score ?? -9) - (x.best?.score ?? -9));
  const eligible = byScore.filter((v) => v.best && v.best.score > 0);
  const highest = eligible[0]?.best.score;
  const leaders = eligible.filter((v) => v.best.score === highest);
  const forecast = forecastPreparedControls(startPos, baseline, forks, hashes);
  const partial = new Map();
  for (const [a, fork] of forks) {
    const setup = baseline.get(a);
    for (const [ix, b] of buttons.entries()) {
      const known = buttons.filter((_, i) => i % 2 !== ix % 2);
      const signs = [];
      for (const [id, from] of setup) {
        const origin = startPos.get(id),
          direct = baseline.get(b)?.get(id);
        if (!origin || !direct) continue;
        const calibration = known
          .filter((k) => baseline.get(k)?.has(id) && fork.get(k)?.has(id))
          .map((k) => ({
            op: k,
            before: baseline.get(k).get(id),
            after: fork.get(k).get(id),
            bareRef: 0,
            preparedRef: 0,
          }));
        const witness = changedControl(origin, from, calibration);
        if (!witness) continue;
        const ends = new Set(calibration.map((c) => pos(c.after)));
        signs.push({
          id,
          diverse: ends.size >= 2,
          bareIdle: pos(direct) === pos(origin),
          from,
          direct,
          origin,
        });
      }
      if (signs.length) partial.set(a + '/' + b, signs);
    }
  }
  const probe = word[begin + 2],
    reference = word.slice(begin, begin + 2);
  const winning = [],
    measured = [],
    essential = [];
  const alone = new Map(buttons.map((k) => [k, !!win(play([k, probe]))]));
  const bareWin = !!win(play([probe]));
  for (const cell of cells) {
    const board = play([cell.a, cell.b, probe]);
    if (!board) continue;
    measured.push(cell);
    if (win(board)) {
      winning.push(cell);
      if (!bareWin && !alone.get(cell.a) && !alone.get(cell.b)) essential.push(cell);
    }
  }
  if (won && !win(play([...reference, probe]))) throw Error('Reference suffix no longer wins');
  const projected = [];
  for (const p of forecast.values()) {
    const cell = cells.find((c) => c.a === p.a && c.b === p.b);
    const actual = forks.get(p.a)?.get(p.b)?.get(p.role);
    const match = !!actual && pos(actual) === pos(p.at);
    projected.push({
      seen: !p.unseen,
      measured: !!actual,
      match,
      enabled: !!cell?.best && cell.best.score > 0,
      won: !!cell && winning.includes(cell),
      essential: !!cell && essential.includes(cell),
    });
  }
  const report = (list) => ({
    forecasts: list.length,
    measured: list.filter((p) => p.measured).length,
    exact: list.filter((p) => p.match).length,
    enabled: list.filter((p) => p.enabled).length,
    wins: list.filter((p) => p.won).length,
    essential: list.filter((p) => p.essential).length,
    exactAndWon: list.filter((p) => p.won && p.match).length,
  });
  function summaryPartial(pick) {
    let probes = 0,
      wins = 0,
      necessary = 0,
      newMotion = 0,
      changed = 0,
      measured = 0;
    for (const [word, signs] of partial) {
      const selected = signs.filter(pick);
      if (!selected.length) continue;
      probes++;
      const [a, b] = word.split('/'),
        cell = cells.find((c) => c.a === a && c.b === b);
      if (cell && winning.includes(cell)) wins++;
      if (cell && essential.includes(cell)) necessary++;
      const after = forks.get(a)?.get(b);
      const available = selected.filter((c) => after?.has(c.id));
      if (available.length) measured++;
      const displacement = (p, q) => p.map((v, i) => v - q[i]).join();
      const matching = available.filter(
        (c) => displacement(after.get(c.id), c.from) !== displacement(c.direct, c.origin)
      );
      if (matching.length) changed++;
      if (matching.some((c) => pos(after.get(c.id)) !== pos(c.from))) newMotion++;
    }
    return { probes, measured, changed, newMotion, wins, necessary };
  }
  const hit = (set) => set.reduce((n, x) => n + Number(winning.includes(x)), 0);
  return {
    ...result,
    partial: summaryPartial(() => true),
    partialDiverse: summaryPartial((c) => c.diverse),
    partialIdle: summaryPartial((c) => c.bareIdle),
    forecast: report(projected),
    unseen: report(projected.filter((p) => !p.seen)),
    candidates: cells.length,
    measured: measured.length,
    wins: winning.length,
    essentialWins: essential.length,
    selectedEssential: eligible.filter((c) => essential.includes(c)).length,
    bestEssential: leaders.filter((c) => essential.includes(c)).length,
    directWins: [...alone.values()].filter(Boolean).length,
    positive: eligible.length,
    positiveWins: hit(eligible),
    tiedBest: leaders.length,
    bestWins: hit(leaders),
    firstWin: !!leaders.length && winning.includes(leaders[0]),
    matchedReference: cells.some((c) => c.a === reference[0] && c.b === reference[1]),
    best: leaders.length ? { a: leaders[0].a, b: leaders[0].b, ...leaders[0].best } : null,
    groups: Object.fromEntries(
      ['novel', 'awakened', 'expansion', 'choices'].map((k) => {
        const picks = cells.filter((c) => c.best && Number(c.best[k]) > 0);
        return [k, [picks.length, hit(picks)]];
      })
    ),
  };
}
const rows = [];
for (const [i, c] of cases.entries()) if (i % shards === shard) rows.push(await audit(c));
await writeFile(output, JSON.stringify(rows));
