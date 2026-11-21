import { changedFootprints, footprints } from "./source-contact-footprints.mjs";

const key = ([x, y]) => x + "," + y;
const gap = (p, q) => Math.max(Math.abs(p[0] - q[0]), Math.abs(p[1] - q[1]));
const distanceToBox = ([x, y], [l, t, r, b]) =>
  Math.max(0, l - x, x - r, t - y, y - b);

// A click can transfer a marker between visually different hosts.
// Group only the pixels of the same ink that entered or left the image.
function patches(changes) {
  const remaining = new Map(changes.map((p) => [key(p), p])),
    out = [];
  for (const p of changes) {
    if (!remaining.delete(key(p))) continue;
    const pixels = [p];
    for (let i = 0; i < pixels.length; i++) {
      const [x, y] = pixels[i];
      for (const q of [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1],
      ])
        if (remaining.delete(key(q))) pixels.push(q);
    }
    if (pixels.length > 48) continue;
    const xs = pixels.map((v) => v[0]),
      ys = pixels.map((v) => v[1]),
      l = Math.min(...xs),
      t = Math.min(...ys),
      r = Math.max(...xs),
      b = Math.max(...ys);
    out.push({
      at: [(l + r) / 2, (t + b) / 2],
      box: [l, t, r, b],
      pixels: pixels.length,
      mask: pixels
        .map(([x, y]) => [x - l, y - t].join())
        .sort()
        .join("/"),
    });
  }
  return out;
}
export function transferredMarkers(before, after, click, radius) {
  const lost = new Map(),
    gained = new Map();
  const add = (map, c, p) => {
    if (!map.has(c)) map.set(c, []);
    map.get(c).push(p);
  };
  let total = 0;
  for (let y = 0; y < before.length; y++)
    for (let x = 0; x < before[y].length; x++) {
      const a = before[y][x],
        b = after[y]?.[x];
      if (a === b) continue;
      add(lost, a, [x, y]);
      add(gained, b, [x, y]);
      total++;
    }
  if (!total || total > (before.length * before[0].length) / 4) return [];
  const propositions = [];
  for (const [ink, positive] of gained) {
    const negative = lost.get(ink);
    if (!negative) continue;
    const ends = patches(positive).filter(
      (g) => distanceToBox(click, g.box) <= radius,
    );
    if (!ends.length) continue;
    for (const a of patches(negative))
      for (const b of ends) {
        if (
          gap(a.at, b.at) <= 2 * radius ||
          Math.min(a.pixels, b.pixels) * 2 < Math.max(a.pixels, b.pixels)
        )
          continue;
        const exact = a.mask === b.mask,
          balance = Math.min(a.pixels, b.pixels) / Math.max(a.pixels, b.pixels);
        propositions.push({
          from: a.at,
          to: b.at,
          exact,
          ink,
          weight:
            Number(exact) * 4 + balance + 1 / (1 + distanceToBox(click, b.box)),
        });
      }
  }
  return propositions.sort((a, b) => b.weight - a.weight);
}
export function motions(before, after) {
  return changedFootprints(footprints(before), footprints(after)).filter(
    (m) => Math.abs(m.dx) + Math.abs(m.dy) <= 20,
  );
}
export function responses(moves, p, radius) {
  return [
    ...new Set(
      moves
        .filter((m) => distanceToBox(p, m.from.bbox) <= radius)
        .map((m) => [m.dx, m.dy].join()),
    ),
  ];
}
export function onSite(p, q, radius) {
  return gap(p, q) <= radius;
}
