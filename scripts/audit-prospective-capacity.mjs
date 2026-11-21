import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { appendFile, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { sourceBackend } from './sic-study-source-games.mjs';
import { sourceReplay, hash, op } from './sic-study-source-replay.mjs';
import { publicParts } from './source-transfer-demonstration.mjs';

const [environment, game, levelArg, output, inputs, prior] = process.argv.slice(2);
const engine = await sourceBackend(resolve(environment));
const level = Number(levelArg);
const records = (
  await Promise.all(
    inputs.split(',').map(async (f) => (await readFile(f, 'utf8')).trim().split(/\r?\n/).map(JSON.parse))
  )
).flat();
const run = records.find((r) => r.code === game && r.start === level);
assert.ok(run && run.resets === 0 && run.sic === run.issued);
const replay = sourceReplay(engine, {}, run),
  perceive = publicParts();
const digest = (x) => createHash('sha256').update(JSON.stringify(x)).digest('hex');
const delta = (a, b) => [a[0] - b[0], a[1] - b[1]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const eq = (a, b) => !!a && !!b && a[0] === b[0] && a[1] === b[1];
const nonzero = (d) => d && (d[0] !== 0 || d[1] !== 0);
const unique = new Map();
async function view(board) {
  const id = hash(board);
  if (unique.has(id)) return unique.get(id);
  const parts = await perceive(board),
    pos = new Map([...parts.ids].map(([k, p]) => [k, p.position]));
  const v = {
    id,
    frame: board.frame,
    pos,
    parts,
    level: board.level,
    state: board.state,
    available: board.availableActionIds,
    score: board.levelsCompleted,
  };
  unique.set(id, v);
  return v;
}
function motion(a, b, role) {
  const p = a.pos.get(role),
    q = b.pos.get(role);
  return p && q ? delta(q, p) : null;
}
function action(b, raw) {
  const cmd = Number(raw.split(':')[0].slice(6));
  if (cmd !== 6) return { id: cmd };
  const [x, y] = raw.split(':')[1].split(',').map(Number);
  const hit = [...b.parts.ids]
    .filter(([, p]) => p.mask.some(([dx, dy]) => p.bbox[0] + dx === x && p.bbox[1] + dy === y))
    .sort((a, c) => a[1].area - c[1].area)[0];
  return hit ? { id: cmd, owner: hit[0], offset: delta([x, y], hit[1].position) } : { id: cmd, point: [x, y] };
}
function materialize(v, a) {
  if (!v.available.includes(a.id) || a.id === 7) return null;
  if (a.id !== 6) return 'ACTION' + a.id;
  const p = a.owner ? v.pos.has(a.owner) && add(v.pos.get(a.owner), a.offset) : a.point;
  return p && p[0] >= 0 && p[1] >= 0 && p[1] < v.frame.length && p[0] < v.frame[0].length
    ? 'ACTION6:' + p.join(',')
    : null;
}
const cache = new Map();
async function projected(i, seq) {
  const key = JSON.stringify([i, seq]);
  if (cache.has(key)) return cache.get(key);
  let b = replay.restore(i);
  let v = await view(b);
  for (const a of seq) {
    if (b.level !== level || b.state !== 'NOT_FINISHED') {
      cache.set(key, null);
      return null;
    }
    const k = materialize(v, a);
    if (!k) {
      cache.set(key, null);
      return null;
    }
    b = replay.act(k);
    v = await view(b);
  }
  if (b.level !== level || b.state !== 'NOT_FINISHED' || b.levelsCompleted !== run.initialCompleted) v = null;
  cache.set(key, v);
  return v;
}
function witnessA(base, prepared, role) {
  const ref = base.pos.get(role);
  for (const [other, p] of base.pos) {
    if (other === role) continue;
    const d = motion(base, prepared, other);
    if (nonzero(d)) return { kind: 'movement', role: other, d };
    if (!prepared.pos.has(other)) return { kind: 'loss', role: other, offset: delta(p, ref) };
  }
  const d = motion(base, prepared, role);
  if (nonzero(d)) return { kind: 'movement', role, d };
  for (const [other, p] of prepared.pos)
    if (other !== role && !base.pos.has(other)) return { kind: 'gain', role: other, offset: delta(p, ref) };
  return null;
}
function checkA(base, prepared, r) {
  const w = r.write,
    ref = base.pos.get(r.role);
  if (!prepared || !ref) return false;
  if (w.kind === 'movement') return eq(motion(base, prepared, w.role), w.d);
  const expected = add(ref, w.offset);
  return w.kind === 'loss'
    ? eq(base.pos.get(w.role), expected) && !prepared.pos.has(w.role)
    : !base.pos.has(w.role) && eq(prepared.pos.get(w.role), expected);
}
function precondition(v, r) {
  const w = r.write,
    p = v.pos.get(r.role);
  if (!p || !materialize(v, r.a)) return false;
  if (w.kind === 'movement') return v.pos.has(w.role);
  return w.kind === 'loss' ? eq(v.pos.get(w.role), add(p, w.offset)) : !v.pos.has(w.role);
}
function neighborhood(v, p, offsets) {
  return offsets.map(([x, y]) => v.frame[p[1] + y]?.[p[0] + x] ?? -1);
}
function relevantOffsets(da, db) {
  const points = [[0, 0], da, db, add(da, db)];
  return points.flatMap(([x, y]) => [
    [x, y],
    [x + 1, y],
    [x - 1, y],
    [x, y + 1],
    [x, y - 1],
  ]);
}
const priorPacket = prior ? JSON.parse(await readFile(prior, 'utf8')) : null;
if (priorPacket) assert.ok(priorPacket.game === game && priorPacket.level < level);
const laws = priorPacket?.laws ?? [],
  seen = new Set(laws.map((x) => x.key)),
  attempted = new Set();
const scored = [],
  kept = new Set(),
  refuted = new Set();
const history = [];
async function acquire(i, seq) {
  const base = await projected(i, []),
    [a, b, c] = seq;
  if (!base || !a || !b || !c || [a, b, c].some((x) => x.id === 7)) return;
  const va = await projected(i, [a]),
    vb = await projected(i, [b]);
  const vab = await projected(i, [a, b]),
    vabc = await projected(i, [a, b, c]);
  if (va) assert.equal(va.id.slice(0, 16), run.steps[i].to);
  if (vab) assert.equal(vab.id.slice(0, 16), run.steps[i + 1].to);
  if (vabc) assert.equal(vabc.id.slice(0, 16), run.steps[i + 2].to);
  if (!va || !vb || !vab || base.id === va.id) return;
  for (const [role, old] of base.pos) {
    const da = motion(base, va, role),
      db = motion(va, vab, role);
    if (!da || !nonzero(db) || eq(motion(base, vb, role), db) || eq(add(da, db), [0, 0])) continue;
    const write = witnessA(base, va, role);
    if (!write) continue;
    const key = JSON.stringify([a, b, c, role, write, da, db, old, level]);
    if (seen.has(key)) continue;
    let dc = vabc && motion(vab, vabc, role);
    if (nonzero(dc)) {
      const vac = await projected(i, [a, c]),
        vbc = await projected(i, [b, c]);
      if (!vac || !vbc || eq(motion(va, vac, role), dc) || eq(motion(vb, vbc, role), dc)) dc = null;
    }
    const offsets = relevantOffsets(da, db);
    laws.push({
      key,
      role,
      a,
      b,
      c,
      da,
      db,
      dc: nonzero(dc) ? dc : null,
      write,
      old,
      origin: base.id,
      learnedAt: i + 3,
      level,
      context: neighborhood(base, old, offsets),
    });
    seen.add(key);
  }
}
async function test(i, base, r, afterRefutation = false) {
  const p = base.pos.get(r.role);
  const commitment = {
    i,
    origin: base.id,
    learned: r.origin,
    learnedAt: r.learnedAt,
    learnedLevel: r.level,
    site: p,
    trainedSite: r.old,
    role: r.role,
    a: r.a,
    b: r.b,
    c: r.c,
    write: r.write,
    afterA: add(p, r.da),
    afterB: add(add(p, r.da), r.db),
    afterC: r.dc ? add(add(add(p, r.da), r.db), r.dc) : null,
    db: r.db,
    dc: r.dc,
    afterRefutation,
  };
  const seal = digest(commitment);
  await appendFile(output + '.journal', JSON.stringify({ kind: 'forecast', seal, commitment }) + '\n');
  const va = await projected(i, [r.a]),
    vb = await projected(i, [r.b]),
    vab = await projected(i, [r.a, r.b]);
  const aOK = !!va && checkA(base, va, r) && eq(va.pos.get(r.role), commitment.afterA);
  const rival = !!vb && !!vb.pos.get(r.role) && !eq(motion(base, vb, r.role), r.db);
  const enabled = !!vab && aOK && rival && eq(vab.pos.get(r.role), commitment.afterB);
  let use = false;
  if (enabled && r.dc) {
    const vac = await projected(i, [r.a, r.c]),
      vbc = await projected(i, [r.b, r.c]),
      vabc = await projected(i, [r.a, r.b, r.c]);
    use =
      !!vac &&
      !!vbc &&
      !!vabc &&
      !!vac.pos.get(r.role) &&
      !!vbc.pos.get(r.role) &&
      eq(vabc.pos.get(r.role), commitment.afterC) &&
      !eq(motion(va, vac, r.role), r.dc) &&
      !eq(motion(vb, vbc, r.role), r.dc);
  }
  const retainedKey = JSON.stringify([base.id, r.a, r.write]);
  if (aOK) kept.add(retainedKey);
  if (aOK && !enabled) refuted.add(JSON.stringify([base.id, r.a, r.b, r.role, r.db]));
  const result = {
    i,
    seal,
    aOK,
    rival,
    enabled,
    use,
    hasUse: !!r.dc,
    afterRefutation,
    prior: r.level !== level,
    retainedKey,
    writeKind: r.write.kind,
    other: r.write.role !== r.role,
  };
  scored.push(result);
  await appendFile(output + '.journal', JSON.stringify({ kind: 'outcome', ...result }) + '\n');
  return result;
}
const entered = new Set();
for (let i = 0; i < run.steps.length; i++) {
  const base = await projected(i, []);
  if (!base) break;
  if (i >= 3) await acquire(i - 3, history.slice(-3));
  if (!entered.has(base.id)) {
    entered.add(base.id);
    const ranked = laws
      .filter((r) => r.origin !== base.id && !eq(r.old, base.pos.get(r.role)) && precondition(base, r))
      .map((r) => {
        const curr = neighborhood(base, base.pos.get(r.role), relevantOffsets(r.da, r.db));
        return { r, match: curr.filter((v, j) => v === r.context[j]).length };
      })
      .sort(
        (a, b) => b.match - a.match || Number(!!b.r.dc) - Number(!!a.r.dc) || a.r.key.localeCompare(b.r.key)
      );
    let failures = [];
    for (const { r } of ranked) {
      const local = JSON.stringify([base.id, r.a, r.b, r.role, r.db]);
      if (attempted.has(local)) continue;
      const retainedKey = JSON.stringify([base.id, r.a, r.write]);
      const revised =
        failures.some((x) => x.aOK && !x.enabled && x.retainedKey === retainedKey) && kept.has(retainedKey);
      if (failures.length >= 2 && !revised) continue;
      attempted.add(local);
      const result = await test(i, base, r, revised);
      if (result.enabled || failures.length >= 2) break;
      failures.push(result);
    }
  }
  history.push(action(base, op(run.steps[i])));
}
const distinct = (x) => new Set(x.map((t) => t.i)).size;
const summary = {
  game,
  level,
  prior: !!prior,
  roots: entered.size,
  laws: laws.length,
  forecasts: scored.length,
  verified: scored.filter((x) => x.enabled).length,
  verifiedOrigins: distinct(scored.filter((x) => x.enabled)),
  nonActor: scored.filter((x) => x.enabled && x.other).length,
  uses: scored.filter((x) => x.use).length,
  priorForecasts: scored.filter((x) => x.prior).length,
  priorVerified: scored.filter((x) => x.prior && x.enabled).length,
  retainedRefutations: scored.filter((x) => x.aOK && !x.enabled).length,
  revised: scored.filter((x) => x.afterRefutation).length,
  revisedVerified: scored.filter((x) => x.afterRefutation && x.enabled).length,
};
await writeFile(output, JSON.stringify({ game, level, summary, laws, scored }) + '\n');
console.log(JSON.stringify(summary));
