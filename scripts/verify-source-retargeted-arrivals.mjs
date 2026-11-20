// Source-only interventions. Replay Q and A -> Q from the same public state.
// P stays fixed during A. An earlier example gives Q and the role of the marker.
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { GAME_CATALOG } from '../src/games/catalog.ts';
import { sourceBackend } from './sic-study-source-games.mjs';
import { sourceReplay, hash, op } from './sic-study-source-replay.mjs';
import { sourcePoseIndex } from './source-numbered-poses.mjs';
const [env, dir, questions, out, mode] = process.argv.slice(2),
  engine = await sourceBackend(resolve(env)),
  allowed = new Set(GAME_CATALOG.map((g) => g.code));
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
const eq = (a, b) => !!(a && b && a[0] === b[0] && a[1] === b[1]);
const point = (layout, k) => (layout.groups.get(k)?.length === 1 ? layout.groups.get(k)[0].p : null);
const diff = (a, b) => [a[0] - b[0], a[1] - b[1]];
for (const group of JSON.parse(await readFile(questions, 'utf8'))) {
  if (!allowed.has(group.code)) throw Error('Source games only');
  if (!group.tickets.length) continue;
  const r = runs.get(group.code + '/' + group.level),
    rep = sourceReplay(engine, defs, r),
    read = sourcePoseIndex(),
    frames = [];
  let board = rep.restore(0);
  for (let i = 0; i <= Math.max(...group.tickets.map((t) => t.i)); i++) {
    frames.push(await read(board));
    if (i < r.steps.length) board = rep.act(op(r.steps[i]));
  }
  for (const t of group.tickets) {
    if (mode === 'prospective') {
      const { i, p, r: mark, a, q } = t;
      if (t.writeRef >= i || t.readRef >= i || op(r.steps[t.readRef]) !== q || op(r.steps[t.writeRef]) !== a)
        throw Error('Invalid past evidence');
      const wr = t.writeRef,
        rd = t.readRef,
        oldMark = point(frames[wr], mark),
        written = point(frames[wr + 1], mark);
      if (
        !oldMark ||
        !written ||
        !eq(point(frames[wr], p), point(frames[wr + 1], p)) ||
        !eq(point(frames[rd], p), t.readOrigin) ||
        !eq(point(frames[rd], mark), t.readMark) ||
        !eq(point(frames[rd + 1], p), t.readMark)
      )
        throw Error('Unverified source rule');
      const root = rep.restore(i);
      if (
        !hash(root).startsWith(t.root) ||
        !eq(point(frames[i], p), t.origin) ||
        !eq(point(frames[i], mark), t.oldMark) ||
        !eq(diff(written, oldMark), diff(t.imagined, t.oldMark))
      )
        throw Error('Forecast mismatch');
      function run(prep, follow) {
        rep.restore(i);
        if (prep) rep.act(a);
        const land = rep.act(q);
        return follow && !rep.win(land) ? rep.act(follow) : land;
      }
      const b = rep.act(a),
        stable = !rep.win(b) && b.state === root.state,
        u = stable ? await read(b) : null,
        direct = run(false),
        prepared = run(true);
      const landed = rep.win(prepared) ? null : point(await read(prepared), p),
        directAt = rep.win(direct) ? null : point(await read(direct), p);
      const markAfter = u ? point(u, mark) : null,
        pAfter = u ? point(u, p) : null,
        writeExact = eq(pAfter, t.origin) && eq(markAfter, t.imagined);
      const redirected =
        writeExact && eq(landed, t.imagined) && eq(directAt, t.oldMark) && !eq(t.imagined, t.oldMark);
      const uses = [];
      if (redirected)
        for (const k of root.availableActionIds.filter((v) => v !== 6).map((v) => 'ACTION' + v)) {
          const one = run(false, k),
            two = run(true, k),
            pd = rep.win(one) ? null : point(await read(one), p),
            pz = rep.win(two) ? null : point(await read(two), p);
          if ((rep.win(two) && !rep.win(one)) || (pz && pd && !eq(pz, landed) && !eq(pz, pd)))
            uses.push({
              q: k,
              direct: pd,
              withPreparation: pz,
              differentDisplacement: !!(pz && pd && !eq(diff(pz, landed), diff(pd, directAt))),
              wonOnlyAfter: rep.win(two) && !rep.win(one),
            });
        }
      results.push({
        ...t,
        code: r.code,
        level: r.start,
        writeExact,
        directAt,
        landed,
        pAfter,
        markAfter,
        redirected,
        uses,
      });
      continue;
    }
    const i = t.i - 1,
      w = t.witness,
      p = t.p,
      mark = t.r,
      q = t.suggested;
    if (i <= w || !eq(point(frames[i], p), t.from) || !eq(point(frames[t.i], p), t.from)) continue;
    const old = point(frames[i], mark);
    if (!old || eq(old, t.to)) continue;
    const earlier = rep.restore(w),
      oldView = await read(earlier),
      witnessOp = op(r.steps[w]);
    if (witnessOp !== q || !eq(point(oldView, p), t.from) || !eq(point(oldView, mark), t.oldTarget))
      throw Error('Missing historical evidence before Q');
    const witness = rep.act(q);
    if (rep.win(witness) || !eq(point(await read(witness), p), t.oldTarget))
      throw Error('Historical Q missed the indicated site');
    const a = op(r.steps[i]);
    const earlierShifts = [];
    for (let j = 0; j < i; j++) {
      if (op(r.steps[j]) !== a) continue;
      const p0 = point(frames[j], p),
        p1 = point(frames[j + 1], p),
        m0 = point(frames[j], mark),
        m1 = point(frames[j + 1], mark);
      if (eq(p0, p1) && m0 && m1) earlierShifts.push({ j, delta: diff(m1, m0) });
    }
    // The forecast for the two-command composition requires agreement of all observed preparations of this type.
    const effects = new Set(earlierShifts.map((x) => x.delta.join())),
      shift = earlierShifts[0]?.delta;
    const imagined =
      effects.size === 1 && shift && (shift[0] || shift[1]) ? [old[0] + shift[0], old[1] + shift[1]] : null;
    function branch(prep, follow) {
      rep.restore(i);
      if (prep) rep.act(a);
      const arrival = rep.act(q);
      return follow && !rep.win(arrival) ? rep.act(follow) : arrival;
    }
    const direct = branch(false),
      prepared = branch(true);
    if (rep.win(direct) || rep.win(prepared)) continue;
    const d = point(await read(direct), p),
      z = point(await read(prepared), p),
      changed = eq(d, old) && eq(z, t.to) && !eq(d, z);
    const uses = [];
    if (changed)
      for (const k of prepared.availableActionIds.filter((v) => v !== 6).map((v) => 'ACTION' + v)) {
        const bd = branch(false, k),
          bz = branch(true, k),
          vd = rep.win(bd) ? null : point(await read(bd), p),
          vz = rep.win(bz) ? null : point(await read(bz), p);
        if ((rep.win(bz) && !rep.win(bd)) || (vz && vd && !eq(vz, z) && !eq(vz, vd)))
          uses.push({
            q: k,
            base: vd,
            prepared: vz,
            baseWon: rep.win(bd),
            preparedWon: rep.win(bz),
            changedDisplacement: !!(vz && vd && !eq(diff(vz, z), diff(vd, d))),
          });
      }
    results.push({
      code: r.code,
      level: r.start,
      i,
      w,
      root: hash(rep.restore(i)).slice(0, 16),
      a,
      q,
      actor: p,
      indicator: mark,
      origin: t.from,
      oldMark: old,
      newMark: t.to,
      direct: d,
      prepared: z,
      changed,
      earlierShifts,
      imagined,
      simulatedBeforeA: !!imagined && eq(imagined, z) && changed,
      uses,
    });
  }
}
await writeFile(out, JSON.stringify(results, null, 2) + '\n');
console.log(
  results.length,
  results.filter((r) => r.changed).length,
  results.filter((r) => r.simulatedBeforeA).length,
  results.filter((r) => r.redirected).length
);
