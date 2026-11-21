import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { appendFile, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { getGameByCode } from '../src/games/catalog.ts';
import { measureNativeObservation, ObservedInputDomain } from '../src/logos-engine/v6-native-observer.ts';
import { sourceBackend } from './sic-study-source-games.mjs';
import { hash, op, sourceReplay } from './sic-study-source-replay.mjs';
import { preparationSites } from './source-preparation-sites.mjs';

const [environment, initialForecasts, output, ...files] = process.argv.slice(2);
const byCode = new Map(
  (await readFile(initialForecasts, 'utf8'))
    .trim()
    .split(/\r?\n/)
    .map((line) => {
      const r = JSON.parse(line);
      return [r.code, r];
    }),
);
const engine = await sourceBackend(resolve(environment)),
  limit = 128;
await writeFile(output, '', { flag: 'wx' });
for (const file of files)
  for (const line of (await readFile(file, 'utf8')).trim().split(/\r?\n/)) {
    const r = JSON.parse(line),
      game = getGameByCode(r.code);
    assert.ok(game && game.group !== 'custom_4');
    const given = byCode.get(r.code);
    if (!given?.inputs || !given.inputs.some((w) => w.startsWith('ACTION6:'))) continue;
    const replay = sourceReplay(engine, {}, r),
      prefix = given.prefix,
      sites = preparationSites();
    let initial = replay.restore(0);
    for (const step of r.steps.slice(0, prefix)) {
      const before = initial;
      initial = replay.act(op(step));
      assert.equal(hash(initial).slice(0, 16), step.to);
      sites.observe(before.frame, initial.frame, op(step));
    }
    assert.equal(hash(initial), given.origin);
    const observation = await measureNativeObservation(
      {
        frame_rows: initial.frame,
        frame_hash: given.origin,
        level: initial.level,
        levels_completed: initial.levelsCompleted,
        state: initial.state,
        available_action_refs: initial.availableActionIds.map((n) => 'ACTION' + n),
      },
      1,
      'source-sites',
    );
    const visible = new ObservedInputDomain(4096)
      .candidates(observation)
      .filter((c) => c.action_ref === 'ACTION6')
      .map((c) => 'ACTION6:' + c.data.x + ',' + c.data.y);
    const use = op(r.steps.at(-1)),
      proposed = sites.nominate(initial.frame, use, visible);
    const lists = {
      short: given.inputs.filter((w) => w.startsWith('ACTION6:')),
      visible: visible.slice(0, limit),
      analogy: proposed.slice(0, limit).map((p) => p.op),
    };
    const frozen = createHash('sha256').update(JSON.stringify(lists)).digest('hex');
    // Reveal the recorded preparations after fixing the complete lists.
    const [a, b] = r.steps.slice(prefix, -1).map(op);
    if (a === b || ![a, b].every((w) => w.startsWith('ACTION6:'))) continue;
    const cache = new Map();
    function run(commands) {
      const id = commands.join('/');
      if (!cache.has(id)) {
        let board = replay.restore(prefix),
          used = 0;
        for (const cmd of commands) {
          if (board.state !== 'NOT_FINISHED' || replay.win(board)) break;
          board = replay.act(cmd);
          used++;
        }
        cache.set(id, { end: hash(board), won: replay.win(board), used });
      }
      return cache.get(id);
    }
    assert.ok(run([a, b, use]).won);
    const need = [run([a]).end, run([b]).end],
      methods = {};
    for (const [name, list] of Object.entries(lists)) {
      const effects = list.map((word) => run([word]).end);
      const ranks = need.map((dest) => effects.indexOf(dest) + 1);
      const literal = [a, b].map((cmd) => list.indexOf(cmd) + 1);
      const matched = ranks.every(Boolean) ? ranks.map((rank) => list[rank - 1]) : null;
      const valid = matched && run([...matched, use]);
      methods[name] = {
        considered: list.length,
        ranks,
        literal,
        jointWin: !!valid?.won && valid.used === 3,
        selected: matched,
        distinctEffects: new Set(effects).size,
      };
    }
    await appendFile(
      output,
      JSON.stringify({
        code: r.code,
        level: r.start,
        prefix,
        frozen,
        recordedDistinctEffects: need[0] !== need[1],
        methods,
      }) + '\n',
    );
  }
