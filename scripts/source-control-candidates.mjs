import { geometricComponents } from "../src/logos-engine/v6-native-observer.ts";
const centre = ([l, t, r, b]) => [(l + r) / 2, (t + b) / 2];
const distance = ([x, y], b) =>
  Math.max(0, b[0] - x, x - b[2], b[1] - y, y - b[3]);
const size = (b) => [b[2] - b[0] + 1, b[3] - b[1] + 1];
const residue = (x, p) =>
  Math.min(Math.abs(x) % p, (p - (Math.abs(x) % p)) % p);
function topology(rows, point, r) {
  const dx = Math.round(point[0]),
    dy = Math.round(point[1]),
    out = [];
  for (let y = -r; y <= r; y++)
    for (let x = -r; x <= r; x++) {
      const v = rows[dy + y]?.[dx + x];
      if (v === undefined) {
        out.push(-1, -1);
        continue;
      }
      out.push(
        Number(v === rows[dy + y]?.[dx + x + 1]),
        Number(v === rows[dy + y + 1]?.[dx + x]),
      );
    }
  return out;
}
// Only measurements from before the click enter these descriptors.
export function controlCandidateFeatures(rows, hosts, points) {
  if (!hosts.length) return points.map(() => null);
  const parts = geometricComponents(rows);
  return points.map((p) => {
    const terms = [];
    for (const h of hosts) {
      if (
        !parts.some(
          (t) =>
            t.color === h.to.color &&
            t.area === h.to.area &&
            t.bbox.every((x, i) => x === h.to.bbox[i]),
        )
      )
        continue;
      const pitch = Math.abs(h.dx) + Math.abs(h.dy),
        r = Math.max(1, Math.min(5, Math.floor(pitch / 2))),
        a = centre(h.to.bbox);
      if (distance(p, h.to.bbox) <= r) continue;
      const [w, hg] = size(h.to.bbox),
        radius = Math.max(r, Math.ceil(Math.min(w, hg) / 2));
      const first = topology(rows, a, r),
        second = topology(rows, p, r);
      const topologyAgreement =
        first.reduce((n, x, i) => n + Number(x >= 0 && x === second[i]), 0) /
        first.length;
      const near = parts.filter(
        (t) =>
          distance(p, t.bbox) <= radius &&
          t.area <= Math.max(12, h.to.area * 3),
      );
      let congruence = 0,
        shape = 0,
        paint = 0,
        extent = 0;
      for (const t of near) {
        const [u, v] = centre(t.bbox),
          [tw, th] = size(t.bbox);
        const sameOutline =
          tw === w &&
          th === hg &&
          t.area === h.to.area &&
          t.mask.every(
            ([x, y], i) => h.to.mask[i]?.[0] === x && h.to.mask[i]?.[1] === y,
          );
        shape = Math.max(shape, Number(sameOutline));
        paint = Math.max(paint, Number(sameOutline && t.color === h.to.color));
        extent = Math.max(
          extent,
          ((Math.min(tw, w) / Math.max(tw, w)) * Math.min(th, hg)) /
            Math.max(th, hg),
        );
        congruence = Math.max(
          congruence,
          1 -
            Math.min(
              1,
              (residue(u - a[0], pitch) + residue(v - a[1], pitch)) / pitch,
            ),
        );
      }
      terms.push([shape, paint, extent, congruence, topologyAgreement]);
    }
    return terms.length
      ? terms.reduce(
          (a, b) => b.map((v, i) => Math.max(v, a[i])),
          [0, 0, 0, 0, 0],
        )
      : null;
  });
}

// Order by the demonstrated moving silhouette, then its surroundings. Keep tied
// points equivalent so that the input domain's enumeration cannot inflate hits.
export function controlCandidateRanks(features) {
  const order = [1, 0, 2, 4, 3];
  function compare(first, second) {
    for (const field of order) {
      if (first[field] !== second[field]) return second[field] - first[field];
    }
    return 0;
  }
  const measured = features.filter(Boolean);
  return features.map((value) => {
    if (!value) return null;
    const better = measured.filter((item) => compare(item, value) < 0).length;
    const tied = measured.filter((item) => compare(item, value) === 0).length;
    return { first: better + 1, last: better + tied };
  });
}
