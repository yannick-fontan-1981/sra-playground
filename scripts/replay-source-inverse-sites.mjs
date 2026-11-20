import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { GAME_CATALOG } from '../src/games/catalog.ts';
import { sourceBackend } from './sic-study-source-games.mjs';
import { sourceReplay, hash } from './sic-study-source-replay.mjs';
import { publicParts } from './source-transfer-demonstration.mjs';
const [environment, dir, out, sealed, cohort] = process.argv.slice(2),
  engine = await sourceBackend(resolve(environment));
const read = async (f) => JSON.parse(await readFile(f, 'utf8')),
  programs = await read(new URL('../docs/architecture/sic-source-seven-programs.json', import.meta.url));
const allowed = new Set(GAME_CATALOG.map((g) => g.code)),
  files =
    cohort === 'lower'
      ? Array.from({ length: 8 }, (_, i) => 'source-final-' + i)
      : ['u2', 'u2entry', 'u3', 'u3entry', 'u4', 'u5'].map((s) => 'cold12-' + s);
const runs = new Map();
for (const f of files)
  for (const l of (await readFile(join(dir, f + '.jsonl'), 'utf8')).trim().split('\n')) {
    const r = JSON.parse(l);
    runs.set(r.code + '/' + r.start, r);
  }
const eq = (a, b) => !!a && !!b && a[0] === b[0] && a[1] === b[1],
  reports = [];
for (const row of await read(sealed)) {
  if (
    !allowed.has(row.code) ||
    createHash('sha256').update(JSON.stringify(row.inverses)).digest('hex') !== row.inverseSeal
  )
    throw Error('Unsealed source experiment');
  const r = runs.get(row.code + '/' + row.level),
    rep = sourceReplay(engine, programs, r),
    view = publicParts(),
    counts = {},
    examples = [],
    wins = [],
    proofs = new Map(),
    distinct = new Set();
  const inc = (k, n = 1) => (counts[k] = (counts[k] ?? 0) + Number(n));
  const active = (b) => b && !rep.win(b) && b.state !== 'GAME_OVER',
    won = (b) => !!b && rep.win(b);
  for (const p of row.inverses) {
    if (
      !('follow' in p) ||
      [...p.refs, ...p.actuatorRefs, ...(p.follow?.refs ?? [])].some((j) => j >= p.i - 1)
    )
      throw Error('Invalid pre-action evidence');
    const cache = new Map();
    function run(word) {
      const k = JSON.stringify(word);
      if (cache.has(k)) return cache.get(k);
      let b = rep.restore(p.i - 1);
      if (!hash(b).startsWith(p.root)) throw Error('Wrong initial observation');
      for (const op of word) {
        if (!active(b)) break;
        if (!b.availableActionIds.includes(Number(op.slice(6).split(':')[0]))) {
          b = null;
          break;
        }
        b = rep.act(op);
      }
      cache.set(k, b);
      return b;
    }
    async function at(b, role) {
      if (!active(b)) return null;
      const g = (await view(b)).parts.filter((e) => e.signature === role.signature);
      if (
        g.length !== role.fixed.length + 1 ||
        !role.fixed.every((k) => g.some((e) => e.position.join() === k))
      )
        return null;
      return g.find((e) => !role.fixed.includes(e.position.join()))?.position ?? null;
    }
    const anchor = { signature: p.anchor, fixed: [] },
      root = run([]),
      a = Array(p.length).fill(p.a);
    if (!eq(await at(root, p.role), p.from) || !eq(await at(root, anchor), p.at))
      throw Error('Unbound source roles');
    const alone = run([p.q]),
      setup = run(a),
      test = run([...a, p.q]),
      anchorAfter = await at(setup, anchor);
    const former = await at(alone, p.role),
      staged = await at(setup, p.role),
      actual = await at(test, p.role);
    const placed = eq(anchorAfter, p.placement) && !eq(p.at, anchorAfter),
      exact = eq(actual, p.to);
    const changed = actual && former && staged && !eq(actual, former) && !eq(actual, staged);
    const controlled = !!(changed && placed && exact);
    inc('plans');
    inc('placed', placed);
    inc('placementAndPatient', placed && eq(staged, p.patient));
    inc('directExact', eq(former, p.direct));
    inc('visible', !!actual && !!former && !!staged);
    inc('landingExact', exact);
    inc('official', won(test) && !won(setup) && !won(alone));
    inc('jointlyRequired', !!changed);
    inc('controlledLanding', controlled);
    inc('sameStartLanding', controlled && eq(p.from, staged));
    inc('novelControlled', controlled && p.novel);
    inc('independentControls', controlled && p.a !== p.q);
    if (controlled) {
      distinct.add(JSON.stringify([p.role, p.anchor, p.from, p.to, p.placement, p.q]));
      const key = JSON.stringify([p.root, p.role, p.anchor, p.q]),
        seen = proofs.get(key) ?? new Set();
      seen.add(p.to.join());
      proofs.set(key, seen);
      if (examples.length < 4)
        examples.push({
          i: p.i,
          setup: p.a,
          length: p.length,
          act: p.q,
          anchorFrom: p.at,
          anchorTo: p.placement,
          from: p.from,
          afterSetup: staged,
          alone: former,
          arrival: actual,
          goal: p.goal,
          solved: p.solved,
          next: p.follow?.to ?? null,
        });
    }
    if (p.follow && active(test)) {
      inc('continuations');
      const revisit = run([...a, p.q, p.follow.op]),
        direct = run([p.q, p.follow.op]),
        omit = run([...a, p.follow.op]);
      const end = await at(revisit, p.role),
        d = await at(direct, p.role),
        w = await at(omit, p.role);
      const continued = controlled && eq(end, p.follow.to) && !eq(end, actual);
      inc('exactContinuation', continued);
      inc('controlledContinuation', continued && d && w && !eq(end, d) && !eq(end, w));
      const essentialWin = won(revisit) && !won(test) && !won(direct) && !won(omit);
      inc('continuationWon', essentialWin);
      inc('winsAfterControlledLanding', essentialWin && controlled);
      if (essentialWin)
        wins.push({
          i: p.i,
          root: p.root,
          setup: a,
          command: p.q,
          use: p.follow.op,
          placed,
          landing: controlled,
          progress: revisit.levelsCompleted - r.initialCompleted,
        });
    }
  }
  counts.distinctControlled = distinct.size;
  counts.twoDestinations = [...proofs.values()].filter((x) => x.size >= 2).length;
  reports.push({ code: r.code, level: r.start, counts, examples, wins });
}
await writeFile(out, JSON.stringify(reports));
