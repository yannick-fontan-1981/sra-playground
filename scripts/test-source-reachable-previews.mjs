import { readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { GAME_CATALOG } from '../src/games/catalog.ts';
import { sourceReplay, hash, op } from './sic-study-source-replay.mjs';
import { sourceBackend } from './sic-study-source-games.mjs';
import { sourcePoseIndex } from './source-numbered-poses.mjs';
import { reachablePreviewConfigurations } from './source-reachable-preview-calculus.ts';
const [environment, study, selection, shard, output] = process.argv.slice(2);
const [ix, count] = shard.split('/').map(Number),
  engine = await sourceBackend(resolve(environment)),
  allowed = new Set(GAME_CATALOG.map((g) => g.code));
const starts = JSON.parse(
    await readFile(new URL('../docs/architecture/sic-source-seven-programs.json', import.meta.url), 'utf8')
  ),
  runs = new Map(),
  result = [];
for (const name of [
  ...Array.from({ length: 8 }, (_, i) => 'source-final-' + i),
  ...['u2', 'u2entry', 'u3', 'u3entry', 'u4', 'u5'].map((s) => 'cold12-' + s),
])
  for (const line of (await readFile(join(study, name + '.jsonl'), 'utf8')).trim().split('\n')) {
    const r = JSON.parse(line);
    runs.set(r.code + '/' + r.start, r);
  }
const eq = (a, b) => a && b && a[0] === b[0] && a[1] === b[1],
  sub = (a, b) => [a[0] - b[0], a[1] - b[1]],
  bag = (v) =>
    v
      .map((x) => x.join())
      .sort()
      .join(';');
const single = (s, id) => (s.get(id)?.length === 1 ? s.get(id)[0].p : null);
const centres = (s, id) => s.get(id)?.map((v) => v.p) ?? [];
function active(g, t) {
  const v = centres(g, t.c);
  if (v.length === 1) return v[0];
  const rest = new Set(t.rest.map((x) => x.join()));
  if (!t.rest.every((x) => v.some((y) => eq(x, y)))) return null;
  const left = v.filter((x) => !rest.has(x.join()));
  return left.length === 1 ? left[0] : null;
}
for (const [j, row] of JSON.parse(await readFile(selection, 'utf8')).entries()) {
  if (j % count !== ix) continue;
  if (!allowed.has(row.code)) throw Error('Source only');
  const trials = [],
    seen = new Set();
  result.push({ code: row.code, level: row.level, trials });
  if (!row.tickets.length) continue;
  const run = runs.get(row.code + '/' + row.level),
    rep = sourceReplay(engine, starts, run),
    inspect = sourcePoseIndex(),
    history = [],
    groups = [];
  let b = rep.restore(0),
    stop = Math.max(...row.tickets.map((t) => t.i));
  for (let i = 0; i <= stop; i++) {
    history.push(b);
    groups.push((await inspect(b)).groups);
    if (i < stop) b = rep.act(op(run.steps[i]));
  }
  for (const t of row.tickets) {
    const key = [t.root, t.p, t.r, t.c, t.fromC, t.read].join('/');
    if (seen.has(key)) continue;
    seen.add(key);
    const root = history[t.i],
      here = groups[t.i];
    if (!hash(root).startsWith(t.root)) throw Error('Public root changed');
    const strokes = new Map(),
      sites = new Set(),
      votes = new Map(),
      patterns = [];
    for (let i = 0; i < t.i; i++) {
      const a = op(run.steps[i]),
        old = single(groups[i], t.p),
        after = single(groups[i + 1], t.p),
        mark = single(groups[i], t.r),
        c = active(groups[i], t);
      if (!old || !after) continue;
      sites.add(old.join());
      sites.add(after.join());
      if (eq(old, after)) continue;
      const d = sub(after, old),
        options = strokes.get(a) ?? new Map(),
        entry = options.get(d.join()) ?? { op: a, d, ref: i, starts: new Set() };
      entry.starts.add(old.join());
      options.set(d.join(), entry);
      strokes.set(a, options);
      if (![...groups[i + 1].values()].some((list) => list.some((e) => eq(e.p, old)))) {
        const colour = history[i + 1].frame[Math.floor(old[1] / 2)]?.[Math.floor(old[0] / 2)];
        if (colour !== undefined) votes.set(colour, (votes.get(colour) ?? 0) + 1);
      }
      if (a === t.read && mark && eq(after, mark) && c && !eq(old, c))
        patterns.push({ actor: old, centre: c, indicator: mark, ref: i });
    }
    const common = [...votes].sort((a, b) => b[1] - a[1]);
    if (!patterns.length || !common.length || common[1]?.[1] === common[0][1]) continue;
    const known = [...strokes.values()]
      .map((map) => [...map.values()].sort((a, b) => b.starts.size - a.starts.size))
      .filter((v) => v[0].starts.size > (v[1]?.starts.size ?? 0))
      .map((v) => v[0]);
    const motors = known.filter((v) => v.op !== t.read && !v.op.startsWith('ACTION6:')),
      baseline = known.find((v) => v.op === t.read && v.starts.size >= 2);
    if (!motors.length) continue;
    const floor = common[0][0],
      passable = (p) => {
        const x = Math.floor(p[0] / 2),
          y = Math.floor(p[1] / 2);
        return (
          x >= 0 &&
          y >= 0 &&
          x < root.frame[0].length &&
          y < root.frame.length &&
          (root.frame[y][x] === floor || sites.has(p.join()) || eq(p, t.fromC))
        );
      };
    const calc = reachablePreviewConfigurations({
      actor: t.fromP,
      centre: t.fromC,
      otherCentres: t.rest,
      op: t.read,
      motors,
      patterns,
      baselineRead: baseline?.d,
      readWitnessed: true,
      allowWrites: true,
      passable,
      stateLimit: Math.min(6000, 4 * root.frame.length * root.frame[0].length),
    });
    const proposal = calc.configurations[0],
      z = {
        root: t.root,
        i: t.i,
        p: t.p,
        r: t.r,
        c: t.c,
        home: calc.home.size,
        complete: calc.complete,
        count: calc.configurations.length,
        issued: !!proposal,
        ordinary: baseline?.d ?? null,
        floor,
      };
    trials.push(z);
    if (!proposal) continue;
    let b = rep.restore(t.i),
      matched = 0;
    const alive = (b) => b.level === root.level && b.state === root.state && !rep.win(b);
    z.newToSubject = !sites.has(proposal.arrival.join());
    z.stages = proposal.steps.map((x) => x.stage);
    z.arrival = proposal.arrival;
    z.source = proposal.source;
    for (const step of proposal.steps) {
      if (!alive(b) || !b.availableActionIds.includes(Number(step.op.slice(6).split(':')[0]))) break;
      const before = (await inspect(b)).groups;
      if (step.stage === 'read') z.indicated = Boolean(eq(single(before, t.r), step.to));
      b = rep.act(step.op);
      if (!alive(b)) {
        z.official = rep.win(b);
        break;
      }
      const g = (await inspect(b)).groups,
        p = single(g, t.p);
      if (
        !eq(p, step.to) ||
        ((step.stage === 'move' || step.stage === 'write') &&
          bag(centres(g, t.c)) !== bag([...t.rest, step.placed]))
      )
        break;
      matched++;
      if (step.stage === 'read') z.transferred = true;
      if (step.stage === 'use') z.used = true;
    }
    z.matched = matched;
  }
}
await writeFile(output, JSON.stringify(result));
