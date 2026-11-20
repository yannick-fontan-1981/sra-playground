// Bind a desired endpoint to a controllable reference using only earlier commands in this episode.
const same = (a, b) => !!a && !!b && a[0] === b[0] && a[1] === b[1],
  add = (a, b) => a.map((x, i) => x + b[i]),
  diff = (a, b) => a.map((x, i) => x - b[i]);
const size = (a) => Math.abs(a[0]) + Math.abs(a[1]);
function movement(samples) {
  const bins = new Map();
  for (const e of samples) {
    if (same(e.from, e.to)) continue;
    const delta = diff(e.to, e.from),
      key = delta.join(),
      s = bins.get(key) ?? { delta, refs: [] };
    s.refs.push(e.index);
    bins.set(key, s);
  }
  return [...bins.values()].sort((a, b) => b.refs.length - a.refs.length || size(a.delta) - size(b.delta))[0];
}
export function inversePlans({ i, now, rows, known, history, sample, bases, tried }) {
  const offers = [];
  for (const [q, pool] of known)
    for (const [id, role] of pool) {
      const cur = sample(now.g, now.s, role),
        h = history.get(q + '/' + id);
      if (!cur || !h || h.length < 2) continue;
      const mechanism = bases(h, cur).find((m) => m.object);
      if (!mechanism) continue;
      const m = mechanism,
        anchor = m.object,
        at = cur.anchors.get(anchor);
      if (!at) continue;
      const anchorId = JSON.stringify([anchor, []]);
      for (const [a] of known) {
        const actuator = movement(history.get(a + '/' + anchorId) ?? []);
        if (!actuator) continue;
        const patientReadings = history.get(a + '/' + id) ?? [],
          pat = movement(patientReadings);
        const fixed = patientReadings.some((e) => same(e.from, e.to));
        const assumed = pat && !fixed ? pat.delta : [0, 0];
        for (const length of [1, 2, 3]) {
          const placement = add(
              at,
              actuator.delta.map((v) => v * length)
            ),
            patient = add(
              cur.from,
              assumed.map((v) => v * length)
            );
          const axis = (k) => (k === anchor ? placement : k === 'self' ? patient : [0, 0]);
          const to = m.axes.map((k, j) => axis(k)[j] + m.offset[j]);
          const inside = (p) => p[0] >= 0 && p[1] >= 0 && p[0] < rows[0].length && p[1] < rows.length;
          if (!inside(placement) || !inside(patient) || !inside(to) || same(to, m.to) || same(to, patient))
            continue;
          const key = JSON.stringify([now.s, q, a, role, placement, to]);
          if (tried.has(key)) continue;
          let goal = null,
            gain = 0;
          for (const [sig, g] of now.g) {
            if (sig === anchor || sig === role.signature || g.size > 8) continue;
            for (const e of g.values()) {
              if (e.area > (rows.length * rows[0].length) / 10) continue;
              const d1 = size(diff(e.position, m.to)),
                d2 = size(diff(e.position, to));
              const improvement = (d1 - d2) / (1 + d2);
              if (improvement > gain) {
                gain = improvement;
                goal = e.position;
              }
            }
          }
          const solved = goal ? m.axes.map((k, j) => (k === anchor ? goal[j] - m.offset[j] : null)) : null;
          const novel = !h.some((e) => same(e.to, to));
          offers.push({
            i: i + 1,
            root: now.s,
            role,
            anchor,
            at,
            from: cur.from,
            placement,
            patient,
            to,
            direct: m.to,
            goal,
            solved,
            axes: m.axes,
            offset: m.offset,
            a,
            q,
            length,
            refs: m.refs,
            actuatorRefs: actuator.refs,
            novel,
            key,
            score:
              Math.min(8, gain) +
              Number(novel) * 3 +
              Math.min(4, actuator.refs.length) -
              length * 0.7 +
              Number(a !== q),
          });
        }
      }
    }
  offers.sort((a, b) => b.score - a.score);
  const chosen = [],
    ends = new Set();
  for (const p of offers) {
    const target = JSON.stringify([p.q, p.role, p.to]);
    if (ends.has(target)) continue;
    ends.add(target);
    tried.add(p.key);
    chosen.push(p);
    if (chosen.length === 2) break;
  }
  for (const p of chosen) {
    const id = JSON.stringify([p.role.signature, p.role.fixed]),
      anchorId = JSON.stringify([p.anchor, []]);
    const cur = sample(now.g, now.s, p.role),
      anchors = new Map(cur.anchors);
    const anchorShift = movement(history.get(p.q + '/' + anchorId) ?? []);
    anchors.set(p.anchor, add(p.placement, anchorShift?.delta ?? [0, 0]));
    anchors.set('self', p.to);
    const alternatives = [];
    for (const [s] of known) {
      const h = history.get(s + '/' + id) ?? [];
      if (h.length < 2) continue;
      const model = bases(h, { ...cur, from: p.to, anchors })[0];
      if (!model || same(model.to, p.to)) continue;
      if (model.to.some((v, i) => v < 0 || v >= (i === 0 ? rows[0].length : rows.length))) continue;
      const gain = p.goal ? size(diff(p.to, p.goal)) - size(diff(model.to, p.goal)) : 0;
      alternatives.push({
        op: s,
        to: model.to,
        refs: model.refs,
        score: model.score + Math.max(-6, Math.min(6, gain)),
      });
    }
    alternatives.sort((a, b) => b.score - a.score);
    p.follow = alternatives[0] ?? null;
  }
  return chosen;
}
