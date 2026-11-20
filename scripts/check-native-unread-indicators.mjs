import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { measureNativeObservation } from '../src/logos-engine/v6-native-observer.ts';
import { createPreparedEffects } from '../src/sic/test-prepared-effects.ts';
import { sourceReplay, hash, op } from './sic-study-source-replay.mjs';
import { sourceBackend } from './sic-study-source-games.mjs';
import { GAME_CATALOG } from '../src/games/catalog.ts';
const [env, dir, selection, shard, out] = process.argv.slice(2),
  engine = await sourceBackend(resolve(env)),
  codes = new Set(GAME_CATALOG.map((g) => g.code));
const defs = JSON.parse(
    await readFile(new URL('../docs/architecture/sic-source-seven-programs.json', import.meta.url), 'utf8')
  ),
  runs = new Map(),
  results = [];
for (const f of [
  ...Array.from({ length: 8 }, (_, j) => 'source-final-' + j),
  ...['u2', 'u2entry', 'u3', 'u3entry', 'u4', 'u5'].map((s) => 'cold12-' + s),
])
  for (const line of (await readFile(join(dir, f + '.jsonl'), 'utf8')).trim().split('\n')) {
    const r = JSON.parse(line);
    runs.set(r.code + '/' + r.start, r);
  }
function cmd(q) {
  const [op, pt] = q.split(':'),
    [x, y] = pt?.split(',').map(Number) ?? [];
  return { action_ref: op, data: pt ? { x, y } : {} };
}
const measured = (b, i, scope) =>
  measureNativeObservation(
    {
      level: b.level,
      levels_completed: b.levelsCompleted,
      state: b.state,
      frame_hash: hash(b).slice(0, 16),
      frame_rows: b.frame,
      available_action_refs: b.availableActionIds.map((v) => 'ACTION' + v),
    },
    i + 1,
    scope
  );
const digest = (x) => createHash('sha256').update(JSON.stringify(x)).digest('hex');
const [ix, n] = shard.split('/').map(Number);
for (const [j, g] of JSON.parse(await readFile(selection, 'utf8')).entries()) {
  if (j % n !== ix) continue;
  if (!codes.has(g.code)) throw Error('Source only');
  if (!g.tickets.length) continue;
  const r = runs.get(g.code + '/' + g.level),
    rep = sourceReplay(engine, defs, r),
    f = createPreparedEffects(),
    scope = g.code + '/' + g.level;
  let b = rep.restore(0),
    o = await measured(b, 0, scope);
  const indices = new Set(g.tickets.map((t) => t.i)),
    end = Math.max(...indices);
  for (let i = 0; i <= end; i++) {
    if (indices.has(i)) {
      const family = createPreparedEffects();
      family.restore(f.state());
      const proposal = await family.proposeInGroup(
          'test_compositions_after_recurrent_returns',
          o,
          b.frame,
          [],
          64
        ),
        probe = proposal?.indicatorProbeForecast;
      const row = {
        code: g.code,
        level: g.level,
        i,
        selected: proposal?.experiment.phase ?? null,
        offered: !!probe,
        steps: [],
      };
      results.push(row);
      if (probe) {
        row.matchesRegistered = g.tickets.some(
          (t) =>
            t.i === i &&
            JSON.stringify(t.origin) === JSON.stringify(probe.cue.origin) &&
            JSON.stringify(t.site) === JSON.stringify(probe.cue.site)
        );
        let before = b,
          prior = o,
          job = proposal;
        for (let k = 0; k < 16 && job?.indicatorProbeForecast; k++) {
          const test = job.indicatorProbeForecast;
          if (JSON.stringify(test.cue) !== JSON.stringify(probe.cue)) break;
          const seal = digest(test),
            q = test.op,
            c = job.actions[0];
          if (!(await family.before(job, 0, {}, prior)).admitted) throw Error('Action not admitted');
          const next = rep.act(q),
            after = await measured(next, i + k + 1, scope);
          await family.after(job, 0, prior, after, before.frame, next.frame);
          const receipt = await family.record(prior, after, c, before.frame, next.frame, job, 0, []);
          const d = receipt.events[0]?.unreadIndicator;
          if (!d || digest(d.test) !== seal) throw Error('No prior commitment');
          row.steps.push({ q, word: test.word, status: d.status, continued: d.canContinue });
          if (!d.canContinue || rep.win(next)) break;
          job = await family.proposeInGroup(
            'test_compositions_after_recurrent_returns',
            after,
            next.frame,
            [],
            63 - k
          );
          before = next;
          prior = after;
        }
        rep.restore(i);
      }
    }
    if (i < end) {
      const step = r.steps[i];
      if (hash(b).slice(0, 16) !== step.from) throw Error('Divergent public origin');
      const next = rep.act(op(step)),
        after = await measured(next, i + 1, scope);
      if (hash(next).slice(0, 16) !== step.to) throw Error('Divergent public return');
      await f.observePublicOutcome(o, after, cmd(op(step)), b.frame, next.frame);
      b = next;
      o = after;
    }
  }
}
await writeFile(out, JSON.stringify(results, null, 2) + '\n');
console.log(
  results.length,
  results.filter((r) => r.offered).length,
  results.filter((r) => r.steps.some((d) => d.status === 'realized')).length
);
