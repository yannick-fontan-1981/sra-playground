// Read-only catalogue: every reported command and comparison appears in the archived trajectory.
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { GAME_CATALOG } from '../src/games/catalog.ts';
import { sourceBackend } from './sic-study-source-games.mjs';
import { sourceReplay, op, hash } from './sic-study-source-replay.mjs';
import { publicParts } from './source-transfer-demonstration.mjs';
import { groupsOf, observedRoleMoves, resolveRole } from '../src/sic/exchange-roles.ts';
const [environment, dir, output, cohort, shard = '0/1'] = process.argv.slice(2);
const allowed = new Set(GAME_CATALOG.map((g) => g.code)),
  engine = await sourceBackend(resolve(environment));
const programs = JSON.parse(
  await readFile(new URL('../docs/architecture/sic-source-seven-programs.json', import.meta.url), 'utf8')
);
const files =
  cohort === 'lower'
    ? Array.from({ length: 8 }, (_, i) => 'source-final-' + i)
    : ['u2', 'u2entry', 'u3', 'u3entry', 'u4', 'u5'].map((s) => 'cold12-' + s);
const records = [];
for (const f of files)
  for (const l of (await readFile(join(dir, f + '.jsonl'), 'utf8')).trim().split('\n'))
    records.push(JSON.parse(l));
const [index, parts] = shard.split('/').map(Number),
  report = [];
const eq = (a, b) => !!a && !!b && a[0] === b[0] && a[1] === b[1],
  delta = (p, q) => [q[0] - p[0], q[1] - p[1]];
for (const [indexInCohort, r] of records.entries()) {
  if (indexInCohort % parts !== index) continue;
  if (!allowed.has(r.code)) throw Error('Expected a source trace');
  const rep = sourceReplay(engine, programs, r),
    read = publicParts(),
    frames = new Map(),
    steps = [];
  let board = rep.restore(0);
  async function scene(b) {
    const k = hash(b).slice(0, 16);
    if (!frames.has(k)) frames.set(k, groupsOf({ entities: (await read(b)).parts }));
    return k;
  }
  let before = await scene(board);
  for (const [i, cmd] of r.steps.entries()) {
    if (cmd.from !== before) throw Error('Discontinuous trace');
    board = rep.act(op(cmd));
    const after = await scene(board);
    if (cmd.to !== after) throw Error('Divergent archive step');
    steps.push({ i, from: before, to: after, op: op(cmd), won: rep.win(board) });
    before = after;
  }
  const by = new Map();
  for (const s of steps) {
    const k = s.from + '/' + s.op,
      ls = by.get(k) ?? [];
    ls.push(s);
    by.set(k, ls);
  }
  const stable = (from, op) => {
    const ls = by.get(from + '/' + op);
    return ls && ls.every((e) => e.to === ls[0].to && e.won === ls[0].won) ? ls[0] : null;
  };
  const stats = {
    paired: 0,
    withApproachControl: 0,
    dormantCommandAwakened: 0,
    changedMotion: 0,
    unblocked: 0,
    relocated: 0,
    differentSites: 0,
    anticipated: 0,
    official: 0,
  };
  const seen = new Set(),
    prior = new Map(),
    examples = [];
  for (let i = 1; i < steps.length - 1; i++) {
    const b = steps[i],
      c = steps[i + 1];
    if (b.from === b.to || b.won || b.op === c.op) continue;
    const alone = stable(b.from, c.op);
    if (!alone) continue;
    const k = [b.from, b.to, b.op, c.op].join('/');
    if (seen.has(k)) continue;
    seen.add(k);
    stats.paired++;
    stats.official += Number(c.won && !alone.won);
    let approach = null;
    for (let j = i - 1; j >= Math.max(0, i - 6); j--) {
      const a = steps[j],
        control = stable(a.from, b.op);
      if (a.from !== b.from && control) {
        approach = { index: j, control: control.i, bareDormant: control.from === control.to };
        break;
      }
    }
    stats.withApproachControl += Number(!!approach);
    stats.dormantCommandAwakened += Number(!!approach?.bareDormant);
    if (c.won || alone.won) continue;
    const indices = [b.from, b.to, alone.to, c.to].map((s) => frames.get(s));
    for (const move of observedRoleMoves(indices[1], indices[3])) {
      const [s, prepared, direct, after] = indices.map((g) => resolveRole(g, move.role)?.position);
      if (!s || !prepared || !direct || !after || eq(delta(s, direct), delta(prepared, after))) continue;
      stats.changedMotion++;
      const sameOrigin = eq(s, prepared),
        jammed = eq(s, direct);
      if (jammed) stats[sameOrigin ? 'unblocked' : 'relocated']++;
      const family = JSON.stringify([b.op, c.op, move.role.signature]),
        cal = prior.get(family),
        actual = delta(prepared, after);
      if (cal && cal.at !== b.from && !eq(cal.position, prepared)) {
        stats.differentSites++;
        stats.anticipated += Number(eq(cal.delta, actual));
      }
      prior.set(family, { at: b.from, position: prepared, delta: actual });
      if (examples.length < 4)
        examples.push({
          bind: i + 1,
          exercise: i + 2,
          b: b.op,
          c: c.op,
          alone: alone.i + 1,
          from: s,
          afterBind: prepared,
          aloneTo: direct,
          after,
          approach,
        });
    }
  }
  report.push({ code: r.code, level: r.start, steps: steps.length, stats, examples });
}
await writeFile(output, JSON.stringify(report));
