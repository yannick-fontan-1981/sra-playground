import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { measureNativeObservation } from '../src/logos-engine/v6-native-observer.ts';
import { pathToFileURL } from 'node:url';
import { createPreparedEffects as currentFamily } from '../src/sic/test-prepared-effects.ts';
import { visualLayout } from '../src/sic/witnessed-preview-transfer.ts';
import { sourceReplay, hash, op } from './sic-study-source-replay.mjs';
import { sourceBackend } from './sic-study-source-games.mjs';
import { GAME_CATALOG } from '../src/games/catalog.ts';
const [env, dir, selection, split, out, solver] = process.argv.slice(2),
  engine = await sourceBackend(resolve(env)),
  codes = new Set(GAME_CATALOG.map((g) => g.code));
const createPreparedEffects = solver
  ? (await import(pathToFileURL(join(resolve(solver), 'src/sic/test-prepared-effects.ts')).href))
      .createPreparedEffects
  : currentFamily;
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
const [part, count] = split.split('/').map(Number);
for (const [j, g] of JSON.parse(await readFile(selection, 'utf8')).entries()) {
  if (j % count !== part) continue;
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
        trial = proposal?.mechanismForecast;
      const t = g.tickets.find((t) => t.i === i);
      if (!hash(b).startsWith(t.root)) throw Error('Different registered root');
      const row = {
        code: g.code,
        level: g.level,
        i,
        root: t.root,
        repeated: t.repeated,
        tag: family.state().localProgress?.last ?? null,
        selected: proposal?.experiment.phase ?? null,
        steps: [],
      };
      results.push(row);
      if (proposal?.mobilityForecast) {
        const test = proposal.mobilityForecast,
          seal = digest(test);
        const measure = (o, b, site) => {
          const group = visualLayout(o, b.frame)[site.role] ?? [],
            remaining = group.filter((x) => !site.peers.some((v) => v.join() === x.at.join()));
          return group.length === 1 + site.peers.length &&
            site.peers.every((v) => group.some((x) => v.join() === x.at.join())) &&
            remaining.length === 1
            ? remaining[0].at
            : null;
        };
        const control = rep.act(t.repeated),
          rival = await measured(control, i + 1, scope);
        rep.restore(i);
        const next = rep.act(test.op),
          after = await measured(next, i + 1, scope);
        const receipt = await family.record(
            o,
            after,
            proposal.actions[0],
            b.frame,
            next.frame,
            proposal,
            0,
            []
          ),
          d = receipt.events[0].mobilityProbe;
        if (digest(d.test) !== seal) throw Error('Unsealed mobility test');
        row.probe = {
          op: test.op,
          sites: test.sites.length,
          moved: d.moved,
          won: d.won,
          changedAgainstRival: 0,
        };
        for (const [j, site] of test.sites.entries()) {
          const target = d.outcomes[j],
            actual = measure(after, next, site),
            other = measure(rival, control, site);
          if (JSON.stringify(actual) !== JSON.stringify(target.actual)) throw Error('Named site differs');
          if (target.status === 'moved' && other && other.join() !== actual.join())
            row.probe.changedAgainstRival++;
        }
        rep.restore(i);
      }
      if (trial) {
        const plan = trial.plan;
        const binding = (o, rows) => {
          const scene = visualLayout(o, rows),
            bodies = scene[plan.c] ?? [],
            others = new Set(plan.fixed.map((p) => p.join()));
          if (
            bodies.length !== 1 + others.size ||
            !plan.fixed.every((p) => bodies.some((z) => z.at.join() === p.join()))
          )
            return null;
          return bodies.find((b) => !others.has(b.at.join()))?.at ?? null;
        };
        row.plan = {
          basis: plan.basis,
          initial: plan.initialC,
          placed: plan.placed,
          arrival: plan.arrival,
          commands: plan.steps.map((s) => s.op),
          options: trial.options.length,
        };
        row.announced = digest(trial);
        const rival = rep.act(t.repeated),
          ob = await measured(rival, i + 1, scope);
        row.rival = { op: t.repeated, site: binding(ob, rival.frame), won: rep.win(rival) };
        let board = rep.restore(i),
          o2 = o,
          current = proposal;
        for (let k = 0; k < plan.steps.length; k++) {
          if (
            !current?.mechanismForecast ||
            current.mechanismForecast.index !== k ||
            digest(current.mechanismForecast.plan) !== digest(plan)
          )
            break;
          const step = plan.steps[k],
            c = current.actions[0];
          if (!(await family.before(current, 0, {}, o2)).admitted) throw Error('Unbound intervention');
          const next = rep.act(step.op),
            a = await measured(next, i + k + 1, scope);
          await family.after(current, 0, o2, a, board.frame, next.frame);
          const receipt = await family.record(o2, a, c, board.frame, next.frame, current, 0, []);
          const d = receipt.events[0].mechanism;
          row.steps.push({
            op: step.op,
            stage: step.stage,
            matched: d.matched,
            actual: d.actual,
            won: d.won,
          });
          if (!d.matched || d.won) break;
          if (k + 1 < plan.steps.length)
            current = await family.proposeInGroup(
              'test_compositions_after_recurrent_returns',
              a,
              next.frame,
              [],
              Math.max(1, 63 - k)
            );
          board = next;
          o2 = a;
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
  results.filter((r) => r.tag).length,
  results.filter((r) => r.plan).length,
  results.filter((r) => r.steps.some((x) => x.stage === 'write' && x.matched)).length
);
