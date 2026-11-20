import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { GAME_CATALOG } from '../src/games/catalog.ts';
import { sourceBackend } from './sic-study-source-games.mjs';
import { op, hash, sourceReplay } from './sic-study-source-replay.mjs';
import { publicParts } from './source-transfer-demonstration.mjs';
const [env, dir, programFile, proofFile, out] = process.argv.slice(2),
  engine = await sourceBackend(resolve(env));
const proof = JSON.parse(await readFile(proofFile, 'utf8')),
  plans = JSON.parse(await readFile(programFile, 'utf8'));
const runs = new Map(),
  allowed = new Set(GAME_CATALOG.map((g) => g.code));
for (let n = 0; n < 8; n++)
  for (const l of (await readFile(join(dir, 'source-final-' + n + '.jsonl'), 'utf8')).trim().split('\n')) {
    const r = JSON.parse(l);
    runs.set(r.code, r);
  }
const eq = (a, b) => !!a && !!b && a[0] === b[0] && a[1] === b[1],
  results = [];
for (const r of proof) {
  if (!allowed.has(r.code) || r.level !== 1) throw Error('Original source cohort only');
  const record = runs.get(r.code),
    rep = sourceReplay(engine, {}, record),
    view = publicParts();
  const active = (b) => !!b && !rep.win(b) && b.state !== 'GAME_OVER';
  const pos = async (b, role) => {
    if (!active(b)) return null;
    const parts = (await view(b)).parts.filter((e) => e.signature === role.signature);
    return parts.length === role.fixed.length + 1 &&
      role.fixed.every((k) => parts.some((e) => e.position.join() === k))
      ? parts.find((e) => !role.fixed.includes(e.position.join()))?.position
      : null;
  };
  const modes = new Map();
  for (const e of r.changedExamples ?? []) if (e.unlocked) modes.set(e.i, 'unlocked');
  for (const e of r.examples) if (e.won) modes.set(e.i, 'win');
  for (const p of plans.find((x) => x.code === r.code).inverses.filter((p) => modes.has(p.i))) {
    const mode = modes.get(p.i),
      reference = { signature: p.anchor, fixed: [] };
    const origin = rep.restore(p.write);
    if (!hash(origin).startsWith(p.baseline)) throw Error('Wrong control origin');
    const steps = record.steps.slice(0, p.i - 1);
    const keys = origin.availableActionIds.flatMap((n) =>
      n === 6 ? [...new Set(steps.map(op).filter((k) => k.startsWith('ACTION6:')))] : ['ACTION' + n]
    );
    const row = {
      code: r.code,
      i: p.i,
      mode,
      q: p.q,
      a: p.a,
      tried: 0,
      matched: 0,
      replicated: 0,
      differentLanding: 0,
      movedRef: 0,
      samePlacement: 0,
      samePlacementReplicated: 0,
      samePlacementExact: 0,
      visuallyDifferent: 0,
      differentExact: 0,
    };
    for (const k of keys) {
      if (k === p.a) continue;
      rep.restore(p.write);
      const b = rep.act(k);
      row.tried++;
      const patient = await pos(b, p.role),
        at = await pos(b, reference);
      if (!eq(patient, p.from) || !at || !b.availableActionIds.includes(Number(p.q.slice(6).split(':')[0])))
        continue;
      const next = rep.act(p.q),
        arrived = await pos(next, p.role);
      const measured = mode === 'win' || !!arrived;
      if (!measured) continue;
      const success = mode === 'win' ? rep.win(next) : !eq(arrived, p.from);
      if (eq(at, p.before)) {
        row.matched++;
        row.replicated += Number(success);
        if (success && arrived && !eq(arrived, r.changedExamples.find((e) => e.i === p.i)?.arrived))
          row.differentLanding++;
      } else {
        row.movedRef++;
        if (eq(at, p.placed)) {
          const exact =
            mode === 'win' ? rep.win(next) : eq(arrived, r.changedExamples.find((e) => e.i === p.i)?.arrived);
          const different = !hash(b).startsWith(p.root);
          row.samePlacement++;
          row.samePlacementReplicated += Number(success);
          row.samePlacementExact += Number(exact);
          row.visuallyDifferent += Number(different);
          row.differentExact += Number(different && exact);
        }
      }
    }
    results.push(row);
  }
}
await writeFile(out, JSON.stringify(results));
