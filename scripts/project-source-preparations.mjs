import { bases } from '../src/sic/motion-frames.ts';
import { resolveRole } from '../src/sic/exchange-roles.ts';

const key = (r) => JSON.stringify([r.signature, r.fixed]),
  same = (a, b) => !!a && !!b && a[0] === b[0] && a[1] === b[1];
const add = (p, v) => [p[0] + v[0], p[1] + v[1]],
  delta = (p, q) => [p[0] - q[0], p[1] - q[1]];
export function projectPreparation(plan, now, history, known, rows) {
  const anchor = { signature: plan.anchor, fixed: [] },
    roles = new Map(),
    positions = new Map();
  for (const [id, r] of known.get(plan.a) ?? []) roles.set(id, r);
  roles.set(key(plan.role), plan.role);
  roles.set(key(anchor), anchor);
  const fixed = new Map([['world', [0, 0]]]);
  for (const [sig, g] of now.g)
    if (g.size === 1) {
      const v = g.values().next().value;
      if (v.area <= (rows.length * rows[0].length) / 10) fixed.set(sig, v.position);
    }
  for (const [id, r] of roles) {
    const e = resolveRole(now.g, r);
    if (e) positions.set(id, e.position);
  }
  let firstKnown = false;
  const trace = [];
  for (let step = 0; step < plan.length; step++) {
    const current = new Map(fixed);
    for (const [id, r] of roles)
      if (!r.fixed.length && positions.has(id)) current.set(r.signature, positions.get(id));
    const next = new Map(positions),
      laws = {};
    for (const [id, r] of roles) {
      const from = positions.get(id),
        h = history.get(plan.a + '/' + id) ?? [];
      if (!from) continue;
      const here = new Map(current);
      here.delete(r.signature);
      here.set('self', from);
      const exact = step === 0 ? h.find((e) => e.scene === now.s) : null;
      const role = key(anchor) === id ? 'anchor' : key(plan.role) === id ? 'patient' : null;
      if (exact) {
        next.set(id, exact.to);
        if (role) laws[role] = 'same public origin';
        if (role === 'anchor') firstKnown = true;
        continue;
      }
      const model = bases(h, { scene: now.s, index: plan.i - 1, from, role: r, anchors: here })[0];
      if (model) {
        next.set(id, model.to);
        if (role) laws[role] = model.family;
        continue;
      }
      const near = h.findLast((e) => same(e.from, from)) ?? h.at(-1);
      if (near) {
        next.set(id, add(from, delta(near.to, near.from)));
        if (role) laws[role] = 'previous displacement';
      } else if (role) laws[role] = 'unmeasured, retained';
    }
    for (const [id, v] of next) positions.set(id, v);
    trace.push({ at: positions.get(key(anchor)), patient: positions.get(key(plan.role)), laws });
  }
  const end = trace.at(-1),
    axis = (k, j) => (k === 'self' ? end.patient[j] : k === 'world' ? 0 : end.at[j]);
  const to = plan.axes.map((k, j) => axis(k, j) + plan.offset[j]);
  return { trace, to, firstKnown };
}
