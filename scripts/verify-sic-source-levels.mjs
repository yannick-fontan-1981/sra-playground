import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { GAME_CATALOG } from '../src/games/catalog.ts';
import { readRecoveryRevision } from '../src/sic/recovery-pack.ts';
import { sourceBackend } from './sic-study-source-games.mjs';
import { sourceInterface } from './sic-study-source-interface.mjs';
import { hash, op, sourceReplay } from './sic-study-source-replay.mjs';

// Qualify direct entries at any source level from the public tape, independently of SIC.
const [environment, packFile, output, ...tapes] = process.argv.slice(2);
if (!tapes.length) throw Error('Expected the source environment, recovery pack, output and one or more JSONL tapes.');
const pack = readRecoveryRevision(JSON.parse(await readFile(packFile, 'utf8')));
const catalog = new Map(GAME_CATALOG.filter(g => g.group !== 'custom_4').map(g => [g.code, g]));
const engine = await sourceBackend(environment);
const entries = [];
const seen = new Set();
function verify(run) {
  const id = run.code + '/L' + run.start + '/' + (run.sourceInterface ?? 'original');
  assert.ok(!run.error, run.code + ': ' + run.error);
  assert.ok(catalog.has(run.code) && Number.isSafeInteger(run.start) && run.start >= 1 && run.start <= catalog.get(run.code).levels, id);
  assert.equal(run.start, run.finish, 'Expected a single level: ' + id);
  assert.ok(!run.observedPriorLevelActions && !run.sourcePrefixActions && !run.sourceFork, 'Expected a direct public entry: ' + id);
  assert.equal(run.packDigest, pack.digest, id);
  assert.equal(run.issued, run.sic, id);
  assert.equal(run.steps.length, run.issued, id);
  assert.ok(!seen.has(id), 'Duplicate level: ' + id);
  const backend = sourceInterface(engine, run.sourceInterface);
  const replay = sourceReplay(backend, {}, run);
  let { b } = replay.openEntry();
  assert.equal(b.level, run.start, id);
  assert.equal(b.levelsCompleted, run.initialCompleted, id);
  assert.equal(hash(b), run.initial, id);
  let resets = 0;
  const commands = createHash('sha256');
  for (const [index, step] of run.steps.entries()) {
    const where = id + ' action ' + (index + 1);
    if (hash(b).slice(0, 16) !== step.from) {
      assert.ok(resets < run.resets, 'Missing transition: ' + where);
      const prior = b;
      b = backend.dispatch({ type: 'reset' });
      assert.equal(b.level, prior.level, where);
      assert.equal(b.levelsCompleted, prior.levelsCompleted, where);
      resets++;
    }
    assert.equal(hash(b).slice(0, 16), step.from, where);
    assert.ok(b.availableActionIds.includes(step.a), 'Unavailable command: ' + where);
    const command = op(step);
    b = replay.act(command);
    assert.equal(hash(b).slice(0, 16), step.to, where);
    commands.update(command + '\n');
    if (index < run.steps.length - 1) assert.equal(b.levelsCompleted, run.initialCompleted, 'Actions after official credit: ' + where);
  }
  assert.equal(resets, run.resets, id);
  const credit = b.levelsCompleted - run.initialCompleted;
  assert.ok(credit === 0 || credit === 1, id);
  const won = credit === 1 || b.state === 'WIN';
  assert.equal(run.levels.length, 1, id);
  const [reported] = run.levels;
  assert.deepEqual([reported.level, reported.actions, reported.won], [run.start, run.issued, won], id);
  seen.add(id);
  return { game: run.code, ...(run.sourceInterface ? {interface:run.sourceInterface} : {}), level: run.start, cap: run.cap, actions: run.issued, resets, won, credit,
    reason: reported.reason, initial: run.initial, final: hash(b), commands: commands.digest('hex') };
}
for (const file of tapes) {
  for (const line of (await readFile(file, 'utf8')).split(/\r?\n/).filter(Boolean)) entries.push(verify(JSON.parse(line)));
}
entries.sort((a, b) => a.game.localeCompare(b.game) || a.level - b.level);
await writeFile(output, JSON.stringify({ pack: pack.digest, entries }, null, 2) + '\n');
const scores = {};
for (const e of entries) {
  const level = scores[e.level] ??= { played: 0, won: 0 };
  level.played++;
  level.won += Number(e.won);
}
console.log(JSON.stringify(scores));
