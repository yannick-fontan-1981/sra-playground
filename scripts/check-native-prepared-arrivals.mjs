import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { measureNativeObservation } from '../src/logos-engine/v6-native-observer.ts';
import { createPreparedEffects } from '../src/sic/test-prepared-effects.ts';
import { occupancyView } from '../src/sic/occupancy-programs.ts';
import { sourceReplay, hash, op } from './sic-study-source-replay.mjs';
import { sourceBackend } from './sic-study-source-games.mjs';
import { GAME_CATALOG } from '../src/games/catalog.ts';
const [env, dir, selection, out] = process.argv.slice(2),
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
for (const g of JSON.parse(await readFile(selection, 'utf8'))) {
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
        trial = proposal?.occupancyForecast;
      const row = {
        code: g.code,
        level: g.level,
        i,
        selected: proposal?.experiment.phase ?? null,
        direct: null,
        returns: [],
        redirected: false,
      };
      results.push(row);
      if (trial?.plan?.preparedPreview) {
        const plan = trial.plan,
          read = plan.steps[1].op;
        row.plan = plan;
        row.beforeAction = digest(plan);
        if (plan.steps.some((s) => !o.available_action_refs.includes(s.op)))
          throw Error('Unavailable source command');
        const control = rep.act(read),
          oc = await measured(control, i + 1, scope);
        row.direct = occupancyView(oc, control.frame)[plan.p] ?? null;
        let restored = rep.restore(i),
          ob = o,
          current = proposal;
        for (let k = 0; k < plan.steps.length; k++) {
          if (
            !current?.occupancyForecast ||
            digest(current.occupancyForecast.plan) !== row.beforeAction ||
            current.occupancyForecast.index !== k
          ) {
            row.interrupted = true;
            break;
          }
          const step = plan.steps[k],
            c = current.actions[0];
          if (c.action_ref !== step.op) throw Error('Wrong proposed action');
          if (!(await family.before(current, 0, {}, ob)).admitted) throw Error('Unbound proposed action');
          const next = rep.act(step.op),
            on = await measured(next, i + k + 1, scope);
          await family.after(current, 0, ob, on, restored.frame, next.frame);
          const record = await family.record(ob, on, c, restored.frame, next.frame, current, 0, []);
          const detail = record.events[0].occupancy;
          row.returns.push({
            stage: step.stage,
            matched: detail.matched,
            subject: detail.arrived,
            indicator: detail.marker,
            won: rep.win(next),
          });
          if (!detail.matched || rep.win(next)) break;
          if (k + 1 < plan.steps.length)
            current = await family.proposeInGroup(
              'test_compositions_after_recurrent_returns',
              on,
              next.frame,
              [],
              64 - k
            );
          ob = on;
          restored = next;
        }
        row.redirected =
          row.returns[1]?.matched === true &&
          JSON.stringify(row.direct) === JSON.stringify(plan.marker) &&
          JSON.stringify(row.direct) !== JSON.stringify(plan.landing);
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
console.log(results.length, results.filter((t) => t.plan).length, results.filter((t) => t.redirected).length);
