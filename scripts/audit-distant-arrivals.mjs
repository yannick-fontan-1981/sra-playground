import { length, diff, alternatives, geometryIndex } from './source-corresponding-sites.mjs';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { GAME_CATALOG } from '../src/games/catalog.ts';
import { measureNativeObservation } from '../src/logos-engine/v6-native-observer.ts';
import { sourceBackend } from './sic-study-source-games.mjs';
import { sourceReplay, hash, op } from './sic-study-source-replay.mjs';

const [environment, directory, output, cohort, split = '0/1'] = process.argv.slice(2);
const [shard, shards] = split.split('/').map(Number);
const read = async (p) => JSON.parse(await readFile(p, 'utf8'));
const programs = await read(new URL('../docs/architecture/sic-source-seven-programs.json', import.meta.url));
const allowed = new Set(GAME_CATALOG.map((g) => g.code));
const engine = await sourceBackend(resolve(environment));
const cases = [];
if (cohort === 'lower') {
  for (let i = 0; i < 8; i++)
    for (const line of (await readFile(join(directory, 'source-final-' + i + '.jsonl'), 'utf8'))
      .trim()
      .split('\n')) {
      const run = JSON.parse(line);
      cases.push({ run, word: run.steps.map(op) });
    }
} else if (cohort === 'upper') {
  const info = await read(
    new URL('../docs/architecture/sic-projected-affordances-results.json', import.meta.url)
  );
  for (const { code, level, entry, confirmed } of info.upperLevels) {
    if (!confirmed) throw Error('Unverified source entry');
    const seq = programs.niveaux_supérieurs.find((r) => r.code === code && r.l === level).seq;
    cases.push({
      run: { code, start: level, sourcePrefixActions: Number(entry === 'chronological') },
      word: seq.map((v) => 'ACTION' + v.replace('@', ':')),
    });
  }
} else if (cohort === 'recorded') {
  for (const file of process.argv.slice(7)) {
    const rows = (await readFile(file, 'utf8')).trim().split('\n').map(JSON.parse);
    for (const run of rows) {
      if (!allowed.has(run.code) || run.issued !== run.steps?.length || run.issued !== run.sic || run.resets)
        throw Error('Unverified source rollout');
      cases.push({ run, word: run.steps.map(op) });
    }
  }
} else throw Error('Invalid source cohort');
async function audit({ run, word }) {
  if (!allowed.has(run.code)) throw Error('Outside source corpus');
  const replay = sourceReplay(engine, programs, run);
  let board = run.steps ? replay.restore(0) : replay.openEntry().b;
  const completed = board.levelsCompleted;
  if (board.level !== run.start) throw Error('Wrong entry');
  const cache = new Map(),
    history = new Map(),
    seen = new Set(),
    seenBody = new Set(),
    examples = [];
  const counts = {
    predictions: 0,
    measurable: 0,
    distant: 0,
    offered: 0,
    offeredMeasurable: 0,
    offeredDistant: 0,
    nearestExact: 0,
    topThreeExact: 0,
    newEndpointExact: 0,
  };
  async function observe(b) {
    const key = hash(b);
    if (!cache.has(key)) {
      const o = await measureNativeObservation(
        {
          frame_rows: b.frame,
          frame_hash: key,
          level: 1,
          levels_completed: 0,
          state: b.state,
          available_action_refs: b.availableActionIds.map((n) => 'ACTION' + n),
        },
        1
      );
      cache.set(key, { key, ...geometryIndex(o.entities, b.frame) });
    }
    return cache.get(key);
  }
  for (const [i, cmd] of word.entries()) {
    const before = await observe(board),
      forecasts = [];
    if (run.steps && before.key.slice(0, 16) !== run.steps[i].from) throw Error('Prefix mismatch');
    for (const [id, e] of before.ids) {
      seenBody.add(id + '/' + e.position.join());
      const key = id + '/' + cmd,
        h = history.get(key);
      if (!h || seen.has(before.key + '/' + cmd)) continue;
      const sorted = [...h.values()].sort((a, b) => b.n - a.n);
      if (!sorted.length || sorted[1]?.n === sorted[0].n) continue;
      const d = sorted[0].d,
        options = alternatives(e, d, before.parts, before.groups, board.frame);
      forecasts.push({ id, e, d, options });
    }
    const after = replay.act(cmd),
      end = hash(after);
    if (run.steps && end.slice(0, 16) !== run.steps[i].to) throw Error('Step mismatch');
    const active =
      after.state === board.state && after.level === run.start && after.levelsCompleted === completed;
    const next = active ? await observe(after) : null;
    if (next && !seen.has(before.key + '/' + cmd)) {
      for (const { id, e, d, options } of forecasts) {
        const actual = next.ids.get(id)?.position;
        counts.predictions++;
        counts.offered += Number(!!options.length);
        if (!actual) continue;
        const move = diff(actual, e.position);
        const distant = length(move) >= 3 * length(d) && length(diff(move, d)) >= 3 * length(d);
        counts.measurable++;
        counts.distant += Number(distant);
        counts.offeredMeasurable += Number(!!options.length);
        counts.offeredDistant += Number(distant && !!options.length);
        const rank = options.findIndex((o) => o.landing.join() === actual.join());
        counts.nearestExact += Number(rank === 0);
        counts.topThreeExact += Number(rank >= 0);
        counts.newEndpointExact += Number(rank >= 0 && !seenBody.has(id + '/' + actual.join()));
        if (distant || rank >= 0)
          examples.push({
            step: i + 1,
            cmd,
            origin: e.position,
            ordinary: d,
            actual,
            offered: options.map((o) => o.landing),
            rank: rank < 0 ? null : rank + 1,
          });
      }
      for (const [id, e] of before.ids) {
        const end = next.ids.get(id)?.position;
        if (!end || end.join() === e.position.join()) continue;
        const d = diff(end, e.position),
          k = id + '/' + cmd,
          h = history.get(k) ?? new Map(),
          v = h.get(d.join()) ?? { d, n: 0 };
        v.n++;
        h.set(d.join(), v);
        history.set(k, h);
      }
    }
    seen.add(before.key + '/' + cmd);
    board = after;
  }
  if (!run.steps && !(board.level > run.start || board.levelsCompleted > completed || board.state === 'WIN'))
    throw Error('Reference did not win');
  if (
    run.steps &&
    (board.level > run.start || board.levelsCompleted > completed || board.state === 'WIN') !==
      run.levels[0].won
  )
    throw Error('Official result mismatch');
  return { code: run.code, level: run.start, counts, examples };
}
const results = [];
for (const [i, c] of cases.entries()) if (i % shards === shard) results.push(await audit(c));
await writeFile(output, JSON.stringify(results));
