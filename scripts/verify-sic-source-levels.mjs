import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { GAME_CATALOG } from '../src/games/catalog.ts';
import { readRecoveryRevision } from '../src/sic/recovery-pack.ts';
import { sourceBackend } from './sic-study-source-games.mjs';
import { sourceInterface } from './sic-study-source-interface.mjs';
import { hash, op, sourceReplay } from './sic-study-source-replay.mjs';

// Reproduce every command, public frame and scored boundary independently of SIC.
const [environment, packFile, output, ...tapes] = process.argv.slice(2);
if (!tapes.length) throw Error('Expected the source environment, recovery pack, output and one or more JSONL tapes.');
const pack = readRecoveryRevision(JSON.parse(await readFile(packFile, 'utf8')));
const catalog = new Map(GAME_CATALOG.filter(g => g.group !== 'custom_4').map(g => [g.code, g]));
const engine = await sourceBackend(environment);
const entries = [];
const seen = new Set();

function verify(run) {
  const id = [run.code, run.start, run.finish, run.sourceInterface ?? 'original', run.parallelWorkers ?? 'unspecified'].join('/');
  if (run.parallelWorkers !== undefined) assert.ok(Number.isSafeInteger(run.parallelWorkers) && run.parallelWorkers >= 1, id);
  assert.ok(!run.error, run.code + ': ' + run.error);
  const game = catalog.get(run.code);
  assert.ok(game && Number.isSafeInteger(run.start) && run.start >= 1, id);
  assert.ok(Number.isSafeInteger(run.finish) && run.finish >= run.start && run.finish <= game.levels, id);
  assert.ok(!run.observedPriorLevelActions && !run.sourcePrefixActions && !run.sourceFork, 'Expected an autonomous entry: ' + id);
  assert.equal(run.packDigest, pack.digest, id);
  assert.equal(run.issued, run.sic, id);
  assert.equal(run.steps.length, run.issued, id);
  assert.ok(!seen.has(id), 'Duplicate run: ' + id);
  const backend = sourceInterface(engine, run.sourceInterface);
  const replay = sourceReplay(backend, {}, run);
  let { b } = replay.openEntry();
  assert.equal(b.level, run.start, id);
  assert.equal(b.levelsCompleted, run.initialCompleted, id);
  assert.equal(hash(b), run.initial, id);
  let resets = 0;
  let index = 0;
  assert.ok(run.levels.length > 0 && run.levels.length <= run.finish - run.start + 1, id);
  for (const [offset, report] of run.levels.entries()) {
    const level = run.start + offset;
    assert.equal(report.level, level, id);
    assert.equal(b.level, level, id);
    assert.ok(Number.isSafeInteger(report.actions) && report.actions >= 0 && report.actions <= run.cap, id);
    const initial = hash(b);
    const previousScore = b.levelsCompleted;
    const previousResets = resets;
    const commands = createHash('sha256');
    for (let i = 0; i < report.actions; i++, index++) {
      const where = id + ' action ' + (index + 1);
      assert.equal(b.levelsCompleted, previousScore, 'Actions after official credit: ' + where);
      assert.equal(b.level, level, where);
      assert.notEqual(b.state, 'WIN', where);
      const step = run.steps[index];
      assert.ok(step, 'Incomplete tape: ' + where);
      if (hash(b).slice(0, 16) !== step.from) {
        assert.ok(resets < run.resets, 'Missing transition: ' + where);
        b = backend.dispatch({ type: 'reset' });
        assert.equal(b.level, level, where);
        assert.equal(b.levelsCompleted, previousScore, where);
        resets++;
      }
      assert.equal(hash(b).slice(0, 16), step.from, where);
      assert.ok(b.availableActionIds.includes(step.a), 'Unavailable command: ' + where);
      const command = op(step);
      b = replay.act(command);
      assert.equal(hash(b).slice(0, 16), step.to, where);
      commands.update(command + '\n');
    }
    const credit = b.levelsCompleted - previousScore;
    assert.ok(credit === 0 || credit === 1, id);
    const won = credit === 1 || b.state === 'WIN';
    assert.equal(report.won, won, id);
    assert.ok(won || offset === run.levels.length - 1, 'Unscored campaign boundary: ' + id);
    entries.push({ game: run.code, level, start: run.start, finish: run.finish,
      ...(run.parallelWorkers === undefined ? {} : {parallelWorkers: run.parallelWorkers}),
      ...(run.sourceInterface ? { interface: run.sourceInterface } : {}), cap: run.cap, actions: report.actions,
      resets: resets - previousResets, won, credit, reason: report.reason, initial, final: hash(b), commands: commands.digest('hex') });
  }
  assert.equal(index, run.issued, id);
  assert.equal(resets, run.resets, id);
  seen.add(id);
}

for (const file of tapes) {
  for (const line of (await readFile(file, 'utf8')).split(/\r?\n/).filter(Boolean)) verify(JSON.parse(line));
}
entries.sort((a, b) => a.game.localeCompare(b.game) || a.level - b.level || a.start - b.start || a.finish - b.finish);
await writeFile(output, JSON.stringify({ pack: pack.digest, entries }, null, 2) + '\n');
const scores = {};
for (const e of entries) {
  const level = scores[e.level] ??= { played: 0, won: 0 };
  level.played++;
  level.won += Number(e.won);
}
console.log(JSON.stringify(scores));
