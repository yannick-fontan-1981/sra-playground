const sub = (a, b) => [a[0] - b[0], a[1] - b[1]],
  cross = (a, b) => a[0] * b[1] - a[1] * b[0],
  same = (a, b) => a[0] === b[0] && a[1] === b[1];

// Exact affine interpolation on the measured span. One measured axis gives no prediction off its line.
export function responseField(observations, placement) {
  const unique = new Map();
  for (const o of observations) {
    const k = o.r.join(),
      known = unique.get(k);
    if (known && !same(known.y, o.y)) return null;
    unique.set(k, o);
  }
  const entries = [...unique.values()],
    base = entries[0],
    first = entries[1];
  if (!first) return null;
  const u = sub(first.r, base.r),
    du = sub(first.y, base.y),
    second = entries.slice(2).find((v) => cross(u, sub(v.r, base.r)) !== 0);
  const v = second && sub(second.r, base.r),
    dv = second && sub(second.y, base.y),
    rank = second ? 2 : 1;
  function predict(r) {
    const x = sub(r, base.r);
    let den,
      n1,
      n2 = 0;
    if (v) {
      den = cross(u, v);
      n1 = cross(x, v);
      n2 = cross(u, x);
    } else {
      if (cross(u, x) !== 0) return null;
      const j = u[0] === 0 ? 1 : 0;
      den = u[j];
      n1 = x[j];
    }
    const raw = [0, 1].map((j) => base.y[j] * den + n1 * du[j] + n2 * (dv ? dv[j] : 0));
    return raw.every((a) => a % den === 0) ? raw.map((a) => a / den) : null;
  }
  if (
    entries.some((o) => {
      const y = predict(o.r);
      return !y || !same(o.y, y);
    })
  )
    return null;
  const to = predict(placement);
  if (!to) return null;
  const varying = du[0] !== 0 || du[1] !== 0 || (!!dv && (dv[0] !== 0 || dv[1] !== 0));
  return { to, rank, varying, refs: [base.i, first.i, ...(second ? [second.i] : [])] };
}

// Solve on the span of the measured interventions. For a non-injective map a finite set of reachable placements
// is supplied by the action graph, so all compatible bindings can be retained.
export function placementsForResponse(observations, goal, reachable = []) {
  const entries = [...new Map(observations.map((s) => [s.r.join(), s])).values()],
    origin = entries[0],
    first = entries[1];
  if (!first) return [];
  const u = sub(first.r, origin.r),
    du = sub(first.y, origin.y),
    second = entries.slice(2).find((s) => cross(u, sub(s.r, origin.r)) !== 0);
  const v = second && sub(second.r, origin.r),
    dv = second && sub(second.y, origin.y),
    gap = sub(goal, origin.y);
  let computed = null;
  if (v && cross(du, dv) !== 0) {
    const den = cross(du, dv),
      a = cross(gap, dv),
      b = cross(du, gap);
    computed = origin.r.map((x, j) => x + (a * u[j] + b * v[j]) / den);
  } else if (!v && (du[0] !== 0 || du[1] !== 0) && cross(du, gap) === 0) {
    const j = du[0] !== 0 ? 0 : 1;
    computed = origin.r.map((x, i) => x + (gap[j] * u[i]) / du[j]);
  }
  const candidates = reachable.length ? reachable : computed ? [computed] : [];
  return [
    ...new Map(
      candidates
        .filter(
          (r) =>
            r.every(Number.isInteger) && responseField(observations, r)?.to.every((a, i) => a === goal[i])
        )
        .map((r) => [r.join(), r])
    ).values(),
  ];
}
