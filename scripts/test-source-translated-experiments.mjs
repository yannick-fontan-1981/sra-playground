import { readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { GAME_CATALOG } from '../src/games/catalog.ts';
import { sourceBackend } from './sic-study-source-games.mjs';
import { sourcePoseIndex } from './source-numbered-poses.mjs';
import { sourceReplay, hash, op } from './sic-study-source-replay.mjs';

const [environment, study, selection, shard, output] = process.argv.slice(2),
  [ix, n] = shard.split('/').map(Number);
const engine = await sourceBackend(resolve(environment)),
  allowed = new Set(GAME_CATALOG.map((g) => g.code));
const starts = JSON.parse(
    await readFile(new URL('../docs/architecture/sic-source-seven-programs.json', import.meta.url), 'utf8')
  ),
  runs = new Map(),
  result = [];
for (const file of [
  ...Array.from({ length: 8 }, (_, i) => 'source-final-' + i),
  ...['u2', 'u2entry', 'u3', 'u3entry', 'u4', 'u5'].map((s) => 'cold12-' + s),
])
  for (const line of (await readFile(join(study, file + '.jsonl'), 'utf8')).trim().split('\n')) {
    const run = JSON.parse(line);
    runs.set(run.code + '/' + run.start, run);
  }
const displacement = (a, b) => (a && b ? [b[0] - a[0], b[1] - a[1]] : null);
const eq = (a, b) => a && b && a[0] === b[0] && a[1] === b[1],
  bag = (sites) =>
    sites
      .map((p) => p.join())
      .sort()
      .join(';');
const pos = (g, k) => (g.get(k)?.length === 1 ? g.get(k)[0].p : null);
for (const [j, group] of JSON.parse(await readFile(selection, 'utf8')).entries()) {
  if (j % n !== ix) continue;
  if (!allowed.has(group.code)) throw Error('Source only');
  const rows = [];
  result.push({ code: group.code, level: group.level, rows });
  if (!group.tickets.length) continue;
  const r = runs.get(group.code + '/' + group.level),
    rep = sourceReplay(engine, starts, r),
    read = sourcePoseIndex();
  let b = rep.restore(0),
    last = Math.max(...group.tickets.map((t) => t.i));
  for (let i = 0; i <= last; i++) {
    await read(b);
    if (i < last) b = rep.act(op(r.steps[i]));
  }
  for (const t of group.tickets) {
    const g = async (b) => (await read(b)).groups,
      cs = (z) => (z.get(t.c) ?? []).map((e) => e.p);
    const witness = rep.restore(t.receipt),
      old = await g(witness),
      out = await g(rep.act(t.read));
    if (
      !hash(witness).startsWith(t.priorRoot) ||
      !eq(pos(old, t.p), t.oldLaunch) ||
      !eq(pos(old, t.r), t.oldArrival) ||
      !eq(pos(out, t.p), t.oldArrival) ||
      !cs(old).some((v) => eq(v, t.oldCentre ?? t.fromC))
    )
      throw Error('Incorrect previous transfer');
    const root = rep.restore(t.i),
      initial = await g(root),
      live = (b) => !rep.win(b) && b.state === root.state && b.level === root.level;
    if (
      !hash(root).startsWith(t.root) ||
      !eq(pos(initial, t.p), t.fromP) ||
      bag(cs(initial)) !== bag([...t.rest, t.fromC])
    )
      throw Error('Incorrect contact origin');
    const can = (b, a) => b.availableActionIds.includes(Number(a.slice(6).split(':')[0]));
    let b = root,
      matched = 0,
      mismatch = null;
    for (const step of t.steps) {
      if (!live(b) || !can(b, step.op)) break;
      b = rep.act(step.op);
      if (!live(b)) break;
      const z = await g(b),
        p = pos(z, t.p),
        moved = bag(cs(z)) === bag([...t.rest, step.c]);
      if (!eq(p, step.p) || !moved) {
        mismatch = { kind: step.kind, actor: Boolean(eq(p, step.p)), centre: moved };
        break;
      }
      matched++;
    }
    let emitted = false,
      visible = false,
      arrived = null,
      official = rep.win(b),
      omitted = null,
      rivals = [],
      sameLaunch = null;
    if (matched === t.steps.length && live(b)) {
      const before = await g(b);
      visible = Boolean(eq(pos(before, t.r), t.arrival));
      if (can(b, t.read)) {
        emitted = true;
        b = rep.act(t.read);
        official = rep.win(b);
        if (live(b)) arrived = pos(await g(b), t.p);
      }
      if (visible || eq(arrived, t.arrival) || official) {
        async function control(ops) {
          let b = rep.restore(t.i);
          for (const a of ops) {
            if (!live(b) || !can(b, a)) return null;
            b = rep.act(a);
          }
          const pre = live(b) ? await g(b) : null;
          if (!pre || !can(b, t.read)) return null;
          const after = rep.act(t.read);
          return {
            cue: pos(pre, t.r),
            start: pos(pre, t.p),
            p: live(after) ? pos(await g(after), t.p) : null,
            official: rep.win(after),
          };
        }
        omitted = await control(t.steps.filter((s) => s.kind !== 'contact').map((s) => s.op));
        // Recreate an alternative with the same point of departure and a different mechanism position
        // if such a public state occurs in the preceding source trajectory.
        let altBoard = rep.restore(0);
        for (let j = 0; j <= t.i; j++) {
          const gv = await g(altBoard);
          if (
            eq(pos(gv, t.p), t.launch) &&
            bag(cs(gv)) === bag([...t.rest, t.fromC]) &&
            can(altBoard, t.read)
          ) {
            const after = rep.act(t.read);
            if (live(after)) sameLaunch = { ref: j, p: pos(await g(after), t.p) };
            break;
          }
          if (j < t.i) altBoard = rep.act(op(r.steps[j]));
        }
        for (const id of root.availableActionIds.filter((n) => n !== 6)) {
          const a = 'ACTION' + id;
          if (a === t.steps[0].op) continue;
          const v = await control([a, ...t.steps.slice(1).map((s) => s.op)]);
          if (v) rivals.push(v);
        }
      }
    }
    rows.push({
      root: t.root,
      i: t.i,
      p: t.p,
      c: t.c,
      r: t.r,
      prior: t.receipt,
      distinctCue: t.distinctCue,
      knownCause: t.knownCause,
      steps: t.steps.length,
      writes: t.writeCount,
      first: t.first,
      read: t.read,
      novel: t.newToSubject,
      matched,
      mismatch,
      emitted,
      visible,
      arrived,
      exact: Boolean(eq(arrived, t.arrival)),
      official,
      bareDiff: Boolean(omitted?.p && !eq(omitted.p, t.arrival)),
      rivalDiff: rivals.some((v) => v.p && !eq(v.p, t.arrival)),
      bareMotionChanged: Boolean(
        omitted?.p && !eq(displacement(omitted.start, omitted.p), displacement(t.launch, t.arrival))
      ),
      equalLengthMotionChanged: rivals.some(
        (v) => v.p && !eq(displacement(v.start, v.p), displacement(t.launch, t.arrival))
      ),
      sameLaunch,
      sameLaunchDifferent: Boolean(sameLaunch?.p && !eq(sameLaunch.p, t.arrival)),
    });
  }
}
await writeFile(output, JSON.stringify(result));
