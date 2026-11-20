import { motionLawSelector } from './select-source-motion-law.mjs';

function face(rows, p, extent, axis, sign, gap) {
  const ahead = p[axis] + (sign > 0 ? extent[axis] : -1) + sign * gap;
  const values = [];
  for (let i = 0; i < extent[1 - axis]; i++) {
    const transverse = p[1 - axis] + i;
    const [x, y] = axis === 0 ? [ahead, transverse] : [transverse, ahead];
    values.push(rows[y]?.[x] ?? -1);
  }
  return values.join(',');
}
export function firstHit(rows, origin, extent, axis, sign, gap, surface, traversed = null) {
  const limit = axis === 0 ? rows[0].length : rows.length;
  const p = [...origin];
  for (; p[axis] >= 0 && p[axis] + extent[axis] <= limit; p[axis] += sign) {
    const sample = face(rows, p, extent, axis, sign, gap);
    if (traversed ? !traversed.has(sample) : sample === surface) return [...p];
  }
  return null;
}
export function fitStoppingSurface(rows, source, dest, extent, axis, sign) {
  for (let gap = 0; gap <= extent[axis]; gap++) {
    const surface = face(rows, dest, extent, axis, sign, gap);
    if (firstHit(rows, source, extent, axis, sign, gap, surface)?.join() !== dest.join()) continue;
    const traversed = new Set();
    for (const p = [...source]; p[axis] !== dest[axis]; p[axis] += sign)
      traversed.add(face(rows, p, extent, axis, sign, gap));
    return { gap, surface, traversed };
  }
  return null;
}

export function latticeContact(origin, boundary, axis, sign, lengths, extent, rows) {
  if (!boundary || !lengths || lengths.size < 2) return boundary;
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  const stride = [...lengths].reduce(gcd);
  if (stride <= 1 || stride > Math.max(...extent)) return boundary;
  const result = [...boundary];
  result[axis] = origin[axis] + sign * stride * Math.ceil(Math.abs(boundary[axis] - origin[axis]) / stride);
  const limit = axis === 0 ? rows[0].length : rows.length;
  return result[axis] >= 0 && result[axis] + extent[axis] <= limit ? result : null;
}

// Fit a stopping surface to a witnessed straight displacement. Predict again in a different lane.
export async function qualifyStoppingSurfaces({ commands, replay, parts, extents, key, won, legal }) {
  const active = (b) => b && !won(b) && b.state !== 'GAME_OVER';
  const point = (p) => p.split(',').map(Number);
  const root = replay([]),
    start = await parts(root),
    sizes = extents.get(key(root));
  const singles = [];
  for (const op of commands) {
    const b = replay([op]);
    if (active(b)) singles.push({ op, b, ps: await parts(b) });
  }
  const lengths = new Map();
  for (const [role, at] of start) {
    const values = new Set(),
      original = point(at);
    for (const { ps } of singles) {
      if (!ps.has(role)) continue;
      const delta = point(ps.get(role))
        .map((v, i) => Math.abs(v - original[i]))
        .filter(Boolean);
      if (delta.length === 1) values.add(delta[0]);
    }
    lengths.set(role, values);
  }
  const cases = [],
    pending = new Map(),
    seen = new Set();
  for (const donor of singles) {
    for (const [id, at] of start) {
      const end = donor.ps.get(id);
      if (!end || end === at) continue;
      const source = point(at),
        dest = point(end),
        d = dest.map((v, i) => v - source[i]);
      if (d.filter(Boolean).length !== 1) continue;
      const axis = d[0] ? 0 : 1,
        sign = Math.sign(d[axis]),
        extent = sizes.get(id);
      const rule = fitStoppingSurface(root.frame, source, dest, extent, axis, sign);
      if (!rule) continue;
      for (const prepared of singles) {
        if (!legal(prepared.b, donor.op) || !prepared.ps.has(id)) continue;
        const from = point(prepared.ps.get(id));
        if (from[1 - axis] === source[1 - axis]) continue;
        const identity = [key(prepared.b), donor.op, id].join('/');
        if (seen.has(identity)) continue;
        seen.add(identity);
        const predicted = firstHit(prepared.b.frame, from, extent, axis, sign, rule.gap, rule.surface);
        if (!predicted) continue;
        const clearance = firstHit(
          prepared.b.frame,
          from,
          extent,
          axis,
          sign,
          rule.gap,
          null,
          rule.traversed
        );
        const additive = from.map((v, i) => v + d[i]),
          fixed = [...from];
        fixed[axis] = dest[axis];
        const prep = [prepared.op, donor.op],
          word = prep.join('/');
        const lattice = latticeContact(
          from,
          clearance,
          axis,
          sign,
          lengths.get(id),
          extent,
          prepared.b.frame
        );
        const record = { prep, id, from, predicted, clearance, lattice, additive, fixed };
        const tests = pending.get(word) ?? [];
        tests.push(record);
        pending.set(word, tests);
      }
    }
  }
  // Generate every forecast before executing any two-command program.
  const select = motionLawSelector();
  for (const tests of pending.values()) {
    const b = replay(tests[0].prep);
    const ps = active(b) ? await parts(b) : null;
    for (const t of tests) {
      const result = ps?.get(t.id);
      const choice = select(t.id, t.from, t.additive, t.lattice, result);
      cases.push({
        ...t,
        selected: choice.exact,
        choseStop: choice.useStop,
        actual: result ? point(result) : null,
      });
    }
  }
  const metric = (group) => ({
    forecasts: group.length,
    selected: group.filter((c) => c.selected).length,
    choseStop: group.filter((c) => c.choseStop).length,
    observed: group.filter((c) => c.actual).length,
    surface: group.filter((c) => c.predicted.join() === c.actual?.join()).length,
    clearance: group.filter((c) => c.clearance && c.clearance.join() === c.actual?.join()).length,
    lattice: group.filter((c) => c.lattice && c.lattice.join() === c.actual?.join()).length,
    additive: group.filter((c) => c.additive.join() === c.actual?.join()).length,
    fixed: group.filter((c) => c.fixed.join() === c.actual?.join()).length,
  });
  const discordant = cases.filter((c) => c.additive.join() !== c.predicted.join());
  return {
    all: metric(cases),
    discordant: metric(discordant),
    latticeDiscordant: metric(cases.filter((c) => c.lattice && c.lattice.join() !== c.additive.join())),
    cases,
  };
}
