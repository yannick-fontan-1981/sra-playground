import { readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { sourceReplay, hash, op } from './sic-study-source-replay.mjs';
import { sourceBackend } from './sic-study-source-games.mjs';
import { GAME_CATALOG } from '../src/games/catalog.ts';
import { poseRole } from '../src/sic/occupancy-programs.ts';
import { measureNativeObservation } from '../src/logos-engine/v6-native-observer.ts';
import {
  newPreviewLearning,
  observePreviewBindings,
  visualLayout,
  offerWitnessedPreview,
  measureWitnessedArrival,
} from '../src/sic/witnessed-preview-transfer.ts';

const [env, dir, prefix, out] = process.argv.slice(2);
const engine = await sourceBackend(resolve(env)),
  allowed = new Set(GAME_CATALOG.map((g) => g.code));
const defs = JSON.parse(
    await readFile(new URL('../docs/architecture/sic-source-seven-programs.json', import.meta.url), 'utf8')
  ),
  runs = new Map();
for (const f of [
  ...Array.from({ length: 8 }, (_, j) => 'source-final-' + j),
  ...['u2', 'u2entry', 'u3', 'u3entry', 'u4', 'u5'].map((s) => 'cold12-' + s),
])
  for (const l of (await readFile(join(dir, f + '.jsonl'), 'utf8')).trim().split('\n')) {
    const r = JSON.parse(l);
    runs.set(r.code + '/' + r.start, r);
  }
const xy = (a, b) => a && b && a[0] === b[0] && a[1] === b[1],
  results = [];
for (let part = 0; part < 6; part++) {
  for (const t of JSON.parse(await readFile(join(dir, prefix + part + '.json'), 'utf8'))) {
    if (!t.sequence.some((a) => a.hit)) continue;
    if (!allowed.has(t.code)) throw Error('Source only');
    const run = runs.get(t.code + '/' + t.level),
      rep = sourceReplay(engine, defs, run),
      scope = t.code + '/' + t.level;
    let n = 0;
    async function measure(b) {
      return measureNativeObservation(
        {
          level: b.level,
          levels_completed: b.levelsCompleted,
          state: b.state,
          frame_rows: b.frame,
          frame_hash: hash(b).slice(0, 16),
          available_action_refs: b.availableActionIds.map((id) => 'ACTION' + id),
        },
        ++n,
        scope
      );
    }
    const learn = newPreviewLearning(),
      row = { game: t.code, level: t.level, sourceStep: t.i, acquired: false, trials: [] };
    results.push(row);
    const families = new Map();
    let b = rep.restore(0),
      o,
      v,
      proof;
    for (let j = 0; j <= t.i; j++) {
      o = await measure(b);
      for (const e of o.entities)
        if (e.area <= (b.frame.length * b.frame[0].length) / 12 && !families.has(poseRole(e)))
          families.set(poseRole(e), families.size + 1);
      if (j < t.i) b = rep.act(op(run.steps[j]));
    }
    v = visualLayout(o, b.frame);
    for (const trial of t.sequence) {
      const next = rep.act(trial.q),
        a = await measure(next),
        z = visualLayout(a, next.frame);
      observePreviewBindings(learn, o, a, v, z, trial.q);
      if (trial.hit) {
        const matches = Object.entries(learn.bindings).filter(
          ([, rule]) =>
            families.get(rule.actor) === t.p &&
            families.get(rule.indicator) === t.r &&
            rule.witnesses.some(
              (w) =>
                w.before === o.observation_ref &&
                xy(w.from, t.origin) &&
                xy(w.indicated, t.site) &&
                w.peers.length === t.peers.length
            )
        );
        if (matches.length === 1) {
          const [key, rule] = matches[0];
          learn.bindings = { [key]: rule };
          proof = rule.witnesses.find((w) => w.before === o.observation_ref && xy(w.indicated, t.site));
          row.acquired = true;
        }
      }
      b = next;
      o = a;
      v = z;
    }
    if (!proof) continue;
    learn.lastActor[Object.values(learn.bindings)[0].actor] = t.origin;
    // Replace only one new decision at a time in the original public continuation.
    // The physically acquired rule stays fixed. The current subject may be identified by later observed moves.
    b = rep.restore(t.i);
    o = await measure(b);
    v = visualLayout(o, b.frame);
    const tried = new Set();
    let unbound = false;
    for (let i = t.i; i < run.steps.length && row.trials.length < 5; i++) {
      const step = run.steps[i];
      if (hash(b).slice(0, 16) !== step.from) throw Error('Lost public prefix');
      const commands = new Set(o.available_action_refs.filter((q) => q !== 'ACTION6'));
      for (const body of Object.values(v).flat())
        if (o.available_action_refs.includes('ACTION6'))
          commands.add('ACTION6:' + Math.floor(body.at[0] / 2) + ',' + Math.floor(body.at[1] / 2));
      const f = offerWitnessedPreview(learn, o, v, commands),
        key = f && JSON.stringify([f.from, f.indicated]);
      if (
        i > t.i &&
        hash(b).slice(0, 16) !== t.root &&
        !unbound &&
        f &&
        !tried.has(key) &&
        (!xy(f.from, t.origin) || !xy(f.indicated, t.site))
      ) {
        tried.add(key);
        async function test(q) {
          const a = rep.act(q),
            z = await measure(a);
          const m = measureWitnessedArrival(f, o, z, v, visualLayout(z, a.frame));
          rep.restore(i);
          return { q, status: m.status, actual: m.actual };
        }
        const actual = await test(f.command),
          rival =
            [...commands].find((q) => q !== f.command && !q.startsWith('ACTION6:')) ??
            run.steps
              .slice(0, i)
              .map(op)
              .reverse()
              .find(
                (q) =>
                  q !== f.command && q.startsWith('ACTION6:') && o.available_action_refs.includes('ACTION6')
              );
        row.trials.push({
          sourceStep: i,
          subject: f.from,
          mark: f.indicated,
          peers: f.peers.length,
          actual,
          control: rival ? await test(rival) : null,
        });
      }
      b = rep.act(op(step));
      if (hash(b).slice(0, 16) !== step.to) throw Error('Source replay mismatch');
      const a = await measure(b),
        z = visualLayout(a, b.frame);
      if (o.level_epoch !== a.level_epoch || a.state !== o.state || a.levels_completed !== o.levels_completed)
        break;
      const rule = Object.values(learn.bindings)[0],
        p = rule.actor,
        old = v[p] ?? [],
        after = z[p] ?? [];
      if (old.length !== after.length) unbound = true;
      else {
        const moved = after.filter((e) => !old.some((b) => xy(e.at, b.at)));
        if (moved.length === 1) {
          learn.lastActor[p] = moved[0].at;
          unbound = false;
        } else if (moved.length > 1) unbound = true;
      }
      o = a;
      v = z;
    }
  }
}
await writeFile(out, JSON.stringify(results, null, 2) + '\n');
console.log(
  results.length,
  results.filter((r) => r.acquired).length,
  results.flatMap((r) => r.trials).length,
  results.flatMap((r) => r.trials).filter((t) => t.actual.status === 'realized').length
);
