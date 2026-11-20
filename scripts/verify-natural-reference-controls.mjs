import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { GAME_CATALOG } from '../src/games/catalog.ts';
import { sourceBackend } from './sic-study-source-games.mjs';
import { hash, op, sourceReplay } from './sic-study-source-replay.mjs';
import { publicParts } from './source-transfer-demonstration.mjs';
const [environment, dir, sealed, out, cohort] = process.argv.slice(2),
  engine = await sourceBackend(resolve(environment));
const files =
  cohort === 'lower'
    ? Array.from({ length: 8 }, (_, i) => 'source-final-' + i)
    : cohort === 'extra'
      ? [2, 3, 4, 5].map((l) => 'cold13-f' + l)
      : ['u2', 'u2entry', 'u3', 'u3entry', 'u4', 'u5'].map((s) => 'cold12-' + s);
const programs = JSON.parse(
  await readFile(new URL('../docs/architecture/sic-source-seven-programs.json', import.meta.url), 'utf8')
);
const runs = new Map(),
  allowed = new Set(GAME_CATALOG.map((g) => g.code));
for (const f of files)
  for (const l of (await readFile(join(dir, f + '.jsonl'), 'utf8')).trim().split('\n')) {
    const r = JSON.parse(l);
    runs.set(r.code + '/' + r.start, r);
  }
const eq = (a, b) => !!a && !!b && a[0] === b[0] && a[1] === b[1],
  reports = [];
for (const row of JSON.parse(await readFile(sealed, 'utf8'))) {
  if (
    !allowed.has(row.code) ||
    createHash('sha256').update(JSON.stringify(row.inverses)).digest('hex') !== row.inverseSeal
  )
    throw Error('Invalid source receipt');
  const r = runs.get(row.code + '/' + row.level),
    rep = sourceReplay(engine, programs, r),
    read = publicParts();
  const live = (b) => b && !rep.win(b) && b.state !== 'GAME_OVER';
  const positions = async (b, role) => {
    if (!live(b)) return null;
    const g = (await read(b)).parts.filter((e) => e.signature === role.signature);
    return g.length === role.fixed.length + 1 &&
      role.fixed.every((v) => g.some((e) => e.position.join() === v))
      ? g.find((e) => !role.fixed.includes(e.position.join()))?.position
      : null;
  };
  const test = (b, q) =>
    live(b) && b.availableActionIds.includes(Number(q.slice(6).split(':')[0])) ? rep.act(q) : null;
  const counts = {},
    examples = [],
    changedExamples = [];
  const inc = (k, b = true) => {
    if (b) counts[k] = (counts[k] ?? 0) + 1;
  };
  for (const p of row.inverses) {
    if (
      p.write >= p.i - 1 ||
      (p.sample != null && (p.sample >= p.i - 1 || op(r.steps[p.sample]) !== p.q)) ||
      op(r.steps[p.write]) !== p.a
    )
      throw Error('Invalid witness indices');
    if (p.sample == null && p.basis !== 'unseen_response') throw Error('Missing response witness');
    const ref = { signature: p.anchor, fixed: [] };
    let b = rep.restore(p.write);
    if (
      !hash(b).startsWith(p.baseline) ||
      !eq(await positions(b, p.role), p.from) ||
      !eq(await positions(b, ref), p.before)
    )
      throw Error('Incorrect control origin');
    b = test(b, p.q);
    const alone = await positions(b, p.role),
      bareWin = b && rep.win(b);
    const aloneFollow = p.follow ? await positions(test(b, p.follow.op), p.role) : null;
    b = rep.restore(p.i - 1);
    if (
      !hash(b).startsWith(p.root) ||
      !eq(await positions(b, p.role), p.from) ||
      !eq(await positions(b, ref), p.placed)
    )
      throw Error('Incorrect prepared origin');
    if (!r.steps[p.write].to.startsWith(p.root) && !p.root.startsWith(r.steps[p.write].to))
      throw Error('Unmatched paired preparation');
    const after = test(b, p.q),
      arrived = await positions(after, p.role);
    const changed = arrived && alone && !eq(alone, arrived) && !eq(arrived, p.from);
    const unlocked = changed && eq(alone, p.from);
    inc('changedResponse', changed);
    inc('unlocked', unlocked);
    inc('vacated', changed && eq(arrived, p.before));
    inc('ordinaryUnlocked', unlocked && eq(arrived, p.relative));
    inc('suppressed', arrived && alone && eq(arrived, p.from) && !eq(alone, p.from));
    const closer = (u, v) => Math.abs(u[0] - v[0]) + Math.abs(u[1] - v[1]);
    const apart = closer(p.placed, p.from) > closer(p.before, p.from);
    const span = Math.max(1, closer(p.placed, p.before));
    const local = closer(p.before, p.from) <= span;
    const classKey = apart && local ? 'nearThenFar' : apart ? 'farther' : 'other';
    inc(classKey + 'Trials');
    inc(classKey + 'Changed', changed);
    inc(classKey + 'Unlocked', unlocked);
    if (changed && changedExamples.length < 8)
      changedExamples.push({
        i: p.i,
        a: p.a,
        q: p.q,
        from: p.from,
        before: p.before,
        placed: p.placed,
        alone,
        arrived,
        unlocked: !!unlocked,
        relative: p.relative,
        knownControl: p.knownControl,
        firstQ: p.seenQ === 0,
      });
    inc('proposals');
    inc('applied', !!after);
    inc('visible', alone && arrived);
    const exact = eq(arrived, p.to),
      paired = exact && alone && !eq(alone, arrived) && !eq(arrived, p.from),
      full = paired && eq(alone, p.without);
    inc('matchedNegativeControl', p.knownControl);
    inc('pairedMatchedNegative', paired && p.knownControl);
    inc('firstQ', p.seenQ === 0);
    inc('pairedFirstQ', paired && p.seenQ === 0);
    inc('proposedScore' + Math.floor(p.score));
    inc('pairedScore' + Math.floor(p.score), paired);
    inc('proposedOffset' + Number(p.offset[0] === 0 && p.offset[1] === 0));
    inc('pairedOffset' + Number(p.offset[0] === 0 && p.offset[1] === 0), paired);
    inc('exact', exact);
    inc('paired', paired);
    inc('bothPredictions', full);
    inc('simpleArrival', eq(arrived, p.relative) || eq(arrived, p.world));
    inc('newWin', after && rep.win(after) && b && !rep.win(b) && !bareWin);
    inc('singleObservation', p.priorCount === 1);
    inc('singlePaired', paired && p.priorCount === 1);
    let continued = null,
      use = false;
    if (p.follow && live(after)) {
      continued = await positions(test(after, p.follow.op), p.role);
      b = rep.restore(p.i - 1);
      const withoutQ = await positions(test(b, p.follow.op), p.role);
      use =
        paired &&
        eq(continued, p.follow.to) &&
        !eq(continued, arrived) &&
        aloneFollow &&
        withoutQ &&
        !eq(continued, aloneFollow) &&
        !eq(continued, withoutQ);
      inc('continuations');
      inc('verifiedUse', use);
    }
    if (p.basis === 'unseen_response' && (paired || (after && rep.win(after) && !bareWin))) {
      let original = rep.restore(0),
        exams = 0;
      for (const cmd of r.steps.slice(0, p.i - 1)) {
        const key = op(cmd);
        if (key !== p.q) {
          original = rep.act(key);
          continue;
        }
        const was = await positions(original, p.role),
          where = await positions(original, ref);
        original = rep.act(key);
        const now = await positions(original, p.role);
        exams++;
        if (was && where && now && !eq(was, now) && eq(where, now))
          throw Error('Response already demonstrated at this prefix');
      }
      if (exams !== p.seenQ) throw Error('Prior trigger count mismatch');
      inc('blindHistoryVerified');
    }
    if ((paired || (after && rep.win(after) && !bareWin)) && examples.length < 6)
      examples.push({
        i: p.i,
        a: p.a,
        q: p.q,
        prior: p.sample == null ? null : p.sample + 1,
        setup: p.write + 1,
        initial: p.before,
        placed: p.placed,
        from: p.from,
        alone,
        arrived,
        expected: p.to,
        full: !!full,
        use: !!use,
        continued,
        won: !!after && rep.win(after),
      });
  }
  reports.push({ code: r.code, level: r.start, seal: row.inverseSeal, counts, examples, changedExamples });
}
await writeFile(out, JSON.stringify(reports));
