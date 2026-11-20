export const length = (p) => Math.abs(p[0]) + Math.abs(p[1]);
export const diff = (p, q) => [p[0] - q[0], p[1] - q[1]];
export const add = (p, q) => [p[0] + q[0], p[1] + q[1]];
const centre = (e) => [(e.bbox[2] - e.bbox[0]) / 2, (e.bbox[3] - e.bbox[1]) / 2];
const gap = (p, box) => Math.max(0, box[0] - p[0], p[0] - box[2]) + Math.max(0, box[1] - p[1], p[1] - box[3]);
export function alternatives(role, v, parts, groups, rows) {
  const p = role.position,
    step = length(v),
    extent = centre(role),
    current = add(p, extent),
    next = add(current, v),
    votes = new Map();
  for (const src of parts) {
    if (src.signature === role.signature || src.area > (rows.length * rows[0].length) / 12) continue;
    const before = gap(current, src.bbox),
      after = gap(next, src.bbox);
    if (before && (after >= before || after > step / 2)) continue;
    const similar = groups.get(src.geometry);
    if (similar.length < 2 || similar.length > 4) continue;
    for (const dest of similar) {
      if (dest === src || dest.signature === role.signature) continue;
      const offset = diff(dest.position, src.position);
      if (length(offset) < 3 * step) continue;
      const landing = add(add(p, v), offset);
      if (
        landing[0] < 0 ||
        landing[1] < 0 ||
        landing[0] + 2 * extent[0] >= rows[0].length ||
        landing[1] + 2 * extent[1] >= rows.length
      )
        continue;
      const score =
        Number(src.signature === dest.signature) * 3 +
        Number(similar.length === 2) * 2 -
        Math.min(before, after) / step;
      const key = landing.join(),
        old = votes.get(key);
      if (!old || score > old.score)
        votes.set(key, {
          landing,
          score,
          entry: src.position,
          exit: dest.position,
        });
    }
  }
  return [...votes.values()]
    .sort((a, b) => b.score - a.score || a.landing[1] - b.landing[1] || a.landing[0] - b.landing[0])
    .slice(0, 3);
}

export function geometryIndex(entities, rows) {
  const parts = entities.map((e) => ({ ...e, geometry: e.mask.map((p) => p.join()).join(';') }));
  const groups = new Map(),
    ids = new Map();
  for (const e of parts) {
    const group = groups.get(e.geometry) ?? [];
    group.push(e);
    groups.set(e.geometry, group);
    if (!e.identity_ambiguous && e.area < (rows.length * rows[0].length) / 4) ids.set(e.signature, e);
  }
  return { parts, groups, ids };
}
