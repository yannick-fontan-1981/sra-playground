import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { appendFile, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { getGameByCode } from '../src/games/catalog.ts';
import { measureNativeObservation, ObservedInputDomain } from '../src/logos-engine/v6-native-observer.ts';
import { overlay, combinedPositions } from './source-isolated-preparations.mjs';
import { preparationSites } from './source-preparation-sites.mjs';
import { hash, op, sourceReplay } from './sic-study-source-replay.mjs';
import { sourceBackend } from './sic-study-source-games.mjs';

const [environment, tableFile, forecastFile, resultFile, mode, ...args] = process.argv.slice(2);
const setting = args.find((arg) => arg.startsWith('--sites='))?.slice(8) ?? 'visible';
assert.ok(['visible', 'analogous', 'analogous-with-use'].includes(setting));
const files = args.filter((arg) => !arg.startsWith('--sites='));
assert.ok(['given-use', 'stalled'].includes(mode));
const tables = JSON.parse(await readFile(tableFile, 'utf8'));
const engine = await sourceBackend(resolve(environment)),
  seen = new Set();
for (const path of [forecastFile, resultFile]) await writeFile(path, '', { flag: 'wx' });
const kind = (word) =>
  word.startsWith('ACTION6:') ? 'point' : /^ACTION[1-4]$/.test(word) ? 'direction' : 'interaction';
const digest = (data) => createHash('sha256').update(JSON.stringify(data)).digest('hex');
async function candidates(board, past, sites, use) {
  const scalar = board.availableActionIds.filter((n) => n > 0 && n !== 6).map((n) => 'ACTION' + n);
  if (!board.availableActionIds.includes(6)) return scalar;
  const observation = await measureNativeObservation(
    {
      frame_rows: board.frame,
      frame_hash: hash(board),
      level: board.level,
      levels_completed: board.levelsCompleted,
      state: board.state,
      available_action_refs: board.availableActionIds.map((n) => 'ACTION' + n),
    },
    1,
    'source-prefix',
  );
  const visible = new ObservedInputDomain(32)
    .candidates(observation)
    .filter((c) => c.action_ref === 'ACTION6')
    .map((c) => 'ACTION6:' + c.data.x + ',' + c.data.y);
  if (sites)
    return [
      ...scalar,
      ...sites
        .nominate(board.frame, use, visible)
        .slice(0, scalar.length ? 3 : 6)
        .map((o) => o.op),
    ];
  const prior = [...new Set([...past].reverse().filter((w) => w.startsWith('ACTION6:')))];
  const clicks = new Set(),
    unseen = visible.filter((w) => !prior.includes(w));
  for (let i = 0; i < Math.max(prior.length, unseen.length); i++) {
    if (prior[i]) clicks.add(prior[i]);
    if (unseen[i]) clicks.add(unseen[i]);
  }
  return [...scalar, ...[...clicks].slice(0, scalar.length ? 3 : 6)];
}
function score(first, second, use, facts, table) {
  const flags = [facts.added, facts.separate, facts.exclusive, facts.conflicts]
    .map((v) => Number(Boolean(v)))
    .join('');
  const key = [flags, ...[kind(first), kind(second)].sort(), kind(use)].join('/');
  assert.ok(Object.hasOwn(table, key));
  return table[key];
}
for (const file of files)
  for (const line of (await readFile(file, 'utf8')).trim().split(/\r?\n/)) {
    const r = JSON.parse(line),
      game = getGameByCode(r.code),
      key = [r.code, r.start].join('/');
    assert.ok(game && game.group !== 'custom_4');
    if (
      seen.has(key) ||
      r.error ||
      r.resets ||
      r.observedPriorLevelActions ||
      r.sourcePrefixActions ||
      r.start !== r.finish
    )
      continue;
    if ((mode === 'given-use') !== Boolean(r.levels[0].won)) continue;
    seen.add(key);
    const replay = sourceReplay(engine, {}, r),
      tape = r.steps.map(op),
      table = tables[r.code] ?? tables.heldOutGame;
    assert.equal(replay.win(replay.restore(tape.length)), r.levels[0].won);
    const checkpoints = mode === 'given-use' ? [tape.length - 3] : [0, 8, 24, 48];
    let tested = 0;
    for (const prefix of checkpoints.filter((n) => n >= 0 && n <= tape.length)) {
      const base = replay.restore(prefix),
        past = tape.slice(0, prefix);
      const sites = setting === 'visible' ? null : preparationSites();
      if (sites && base.availableActionIds.includes(6)) {
        let board = replay.restore(0);
        for (const word of past) {
          const before = board;
          board = replay.act(word);
          sites.observe(before.frame, board.frame, word);
        }
        assert.equal(hash(board), hash(base));
      }
      const suppliedUse = mode === 'given-use' ? tape.at(-1) : null;
      const inputs = await candidates(base, past, sites, setting === 'analogous-with-use' ? suppliedUse : null);
      // In given-use the last command is the question posed to the planner. The two
      // actual intervening commands are never used to generate or rank options.
      const uses = mode === 'given-use' ? [tape.at(-1)] : inputs;
      const cache = new Map(),
        single = new Map();
      function arm(commands) {
        const k = commands.join('/');
        if (!cache.has(k)) {
          let b = replay.restore(prefix),
            used = 0;
          for (const word of commands) {
            if (
              replay.win(b) ||
              b.state !== 'NOT_FINISHED' ||
              !b.availableActionIds.includes(Number(word.split(':')[0].slice(6)))
            )
              break;
            b = replay.act(word);
            used++;
          }
          cache.set(k, {
            used,
            won: replay.win(b),
            ...(commands.length === 1 ? { frame: b.frame, state: b.state } : {}),
          });
        }
        return cache.get(k);
      }
      for (const input of inputs) {
        const result = arm([input]);
        if (!result.won && result.used === 1 && result.state === 'NOT_FINISHED')
          single.set(input, result.frame);
      }
      const pairs = [];
      const ready = [...single];
      for (let i = 0; i < ready.length; i++)
        for (let j = i + 1; j < ready.length; j++) {
          const [a, u] = ready[i],
            [b, v] = ready[j],
            fields = overlay(base.frame, u, v);
          const movement = combinedPositions(base.frame, u, v);
          const facts = {
            added: movement.added,
            separate: movement.separate,
            exclusive: !!(fields.onlyA && fields.onlyB),
            conflicts: fields.conflicts,
          };
          pairs.push({ a, b, facts });
        }
      const offers = uses.flatMap((use) =>
        pairs.map(({ a, b, facts }) => ({ a, b, use, score: score(a, b, use, facts, table) })),
      );
      const forecast = {
        code: r.code,
        level: r.start,
        mode,
        setting,
        prefix,
        origin: hash(base),
        inputs,
        offers,
      };
      const forecastDigest = digest(forecast);
      await appendFile(forecastFile, JSON.stringify({ ...forecast, forecastDigest }) + '\n');
      const results = [];
      for (const { a, b, use } of offers) {
        const ab = arm([a, b, use]),
          ba = arm([b, a, use]);
        const forward = ab.won && ab.used === 3,
          reverse = ba.won && ba.used === 3;
        const row = { a, b, use, forward, reverse };
        if (forward || reverse) {
          const noA = arm([b, use]).won,
            noB = arm([a, use]).won,
            bare = arm([use]).won;
          const twiceA = arm([a, a, use]).won,
            twiceB = arm([b, b, use]).won;
          Object.assign(row, {
            noA,
            noB,
            bare,
            twiceA,
            twiceB,
            joint: !(noA || noB || bare || twiceA || twiceB),
          });
        }
        results.push(row);
      }
      await appendFile(
        resultFile,
        JSON.stringify({ code: r.code, level: r.start, prefix, forecastDigest, results }) + '\n',
      );
      tested++;
    }
    if (!tested) {
      const skip = { code: r.code, level: r.start, reason: 'shorter_than_two_preparations_and_one_use' };
      await appendFile(forecastFile, JSON.stringify(skip) + '\n');
      await appendFile(resultFile, JSON.stringify(skip) + '\n');
    }
  }
console.log('source games/levels', seen.size);
