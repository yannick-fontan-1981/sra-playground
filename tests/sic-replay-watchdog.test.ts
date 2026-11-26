import assert from 'node:assert/strict';
import { mkdtemp, rmdir, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { superviseSicReplay } from '../scripts/sic-replay-watchdog.mjs';

test('the supervisor stops a blocked level and retains the completed levels and applied commands', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'sic-watchdog-'));
  const script = join(directory, 'blocked.mjs');
  try {
    await writeFile(script, `
      const firstBudget = { actions: 6, activeTimeMs: 1000 };
      const secondBudget = { actions: 8, activeTimeMs: 100 };
      process.send({ kind: 'level-started', level: 1, target: 2, budget: firstBudget });
      process.send({ kind: 'command-applied', sicAuthorized: true });
      process.send({ kind: 'level-finished', level: { level: 1, won: true, actions: 1, budget: firstBudget } });
      process.send({ kind: 'level-started', level: 2, target: 2, budget: secondBudget });
      process.send({ kind: 'command-applied', sicAuthorized: true,
        command: { id: 2, family: 'measured_route', strategy: 'approach' } }, () => { for (;;) {} });
    `);
    const result = await superviseSicReplay(script, [], 'FIXTURE');
    assert.equal(result.reason, 'level_wall_time_budget');
    assert.equal(result.target, 2);
    assert.equal(result.levels, 1);
    assert.equal(result.actions, 2);
    assert.equal(result.authority, 2);
    assert.deepEqual(result.levelStats.map(level => [level.level, level.won, level.actions]), [[1, true, 1], [2, false, 1]]);
    assert.equal(result.levelStats[1].budget.activeTimeMs, 100);
    assert.deepEqual(result.recentCommands.map(({ id, family, strategy, index }) => [id, family, strategy, index]),
      [[2, 'measured_route', 'approach', 2]]);
  } finally {
    await unlink(script);
    await rmdir(directory);
  }
});

test('the watchdog retains the public score when native reconciliation misses the deadline', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'sic-watchdog-score-'));
  const script = join(directory, 'settled.mjs');
  try {
    await writeFile(script, `
      const target = Number(process.argv[2]);
      process.send({ kind: 'level-started', level: 1, target, budget: { actions: 5, activeTimeMs: 100 } });
      process.send({ kind: 'command-applied', sicAuthorized: true, levelsCompleted: 1 }, () => { for (;;) {} });
    `);
    for (const [target, reason] of [[1, 'target_levels_completed'], [2, 'level_transition_wall_time_budget']]) {
      const result = await superviseSicReplay(script, [String(target)], 'FIXTURE');
      assert.equal(result.reason, reason);
      assert.equal(result.levels, 1);
      assert.equal(result.levelStats[0].won, true);
    }
  } finally {
    await unlink(script);
    await rmdir(directory);
  }
});

test('post-score settlement is bounded independently and admits no further command', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'sic-watchdog-transition-'));
  const script = join(directory, 'transition.mjs');
  try {
    await writeFile(script, `
      const budget = { actions: 5, activeTimeMs: 60 };
      const send = (message) => new Promise(resolve => process.send(message, resolve));
      await send({ kind: 'level-started', level: 1, target: 2, budget });
      await send({ kind: 'command-applied', sicAuthorized: true, levelsCompleted: 1 });
      if (process.argv[2] === 'extra') {
        await send({ kind: 'command-applied', sicAuthorized: true, levelsCompleted: 2 });
      } else {
        await new Promise(resolve => setTimeout(resolve, 120));
        await send({ kind: 'level-finished', level: { level: 1, won: true, actions: 1, budget } });
        await send({ kind: 'level-started', level: 2, target: 2, budget });
        await send({ kind: 'command-applied', sicAuthorized: true, levelsCompleted: 2 });
        await send({ kind: 'level-finished', level: { level: 2, won: true, actions: 1, budget } });
        await send({ kind: 'result', result: { levels: 2, reason: 'target_levels_completed', actions: 2, authority: 2 } });
      }
      process.disconnect();
    `);
    const result = await superviseSicReplay(script, [], 'FIXTURE');
    assert.equal(result.reason, 'target_levels_completed');
    assert.equal(result.actions, 2);
    assert.equal(result.levelStats[0].won, true);
    assert.ok(result.levelStats[0].scoredMs < 60);
    assert.ok(result.levelStats[0].settlementMs >= 100);

    const extra = await superviseSicReplay(script, ['extra'], 'FIXTURE');
    assert.equal(extra.reason, 'command_outside_active_level');
    assert.equal(extra.status, 'harness_error');
    assert.equal(extra.levels, 1);
    assert.equal(extra.levelStats[0].actions, 1);
  } finally {
    await unlink(script);
    await rmdir(directory);
  }
});
