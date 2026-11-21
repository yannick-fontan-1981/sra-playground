import { footprints } from "./source-contact-footprints.mjs";

const views = new WeakMap();
export function scene(rows) {
  if (!views.has(rows)) views.set(rows, footprints(rows));
  return views.get(rows);
}
export function locate(rows, role) {
  const boxes = scene(rows).get(role);
  return boxes?.size === 1 ? boxes.values().next().value.bbox : null;
}
const center = (box) => [(box[0] + box[2]) / 2, (box[1] + box[3]) / 2];
const same = (a, b) => a?.join() === b?.join();
function facts(rows, role, delta) {
  const origin = locate(rows, role);
  if (!origin) return null;
  const [x, y] = center(origin),
    [dx, dy] = delta,
    square = dx * dx + dy * dy;
  const goal = origin.map((n, i) => n + delta[i % 2]);
  if (
    goal[0] < 0 ||
    goal[1] < 0 ||
    goal[2] >= rows[0].length ||
    goal[3] >= rows.length
  )
    return null;
  const tile = rows
    .slice(goal[1], goal[3] + 1)
    .map((row) => row.slice(goal[0], goal[2] + 1).join(","))
    .join("/");
  const f = new Set(["landing/" + tile]);
  for (const [peer, parts] of scene(rows)) {
    if (peer === role) continue;
    for (const p of parts.values()) {
      const [sx, sy] = center(p.bbox);
      const forward = ((sx - x) * dx + (sy - y) * dy) / square,
        side = (-(sx - x) * dy + (sy - y) * dx) / square;
      // Distant scene changes without a spatial link are not a contact forecast.
      if (Math.abs(forward) + Math.abs(side) > 4) continue;
      f.add(JSON.stringify([peer, forward, side]));
    }
  }
  return f;
}
export function learnConditions(rows, tape, role) {
  const motors = new Map();
  for (let i = 0; i < tape.length; i++) {
    const a = tape[i];
    if (!/^ACTION[1-4]$/.test(a)) continue;
    const from = locate(rows[i], role),
      to = locate(rows[i + 1], role);
    if (!from || !to) continue;
    const d = [to[0] - from[0], to[1] - from[1]];
    if ((d[0] === 0) === (d[1] === 0)) continue;
    if (!motors.has(a)) motors.set(a, new Map());
    motors.get(a).set(d.join(), d);
  }
  const samples = [],
    seen = new Set();
  for (let i = 0; i < tape.length; i++) {
    const motor = motors.get(tape[i]);
    if (motor?.size !== 1) continue;
    const d = motor.values().next().value,
      before = locate(rows[i], role),
      after = locate(rows[i + 1], role);
    if (!before || !after) continue;
    const moved =
      after[0] === before[0] + d[0] && after[1] === before[1] + d[1];
    if (!moved && !same(before, after)) continue;
    const f = facts(rows[i], role, d);
    if (!f) continue;
    const key = JSON.stringify([tape[i], before, moved, [...f].sort()]);
    if (!seen.has(key)) {
      seen.add(key);
      samples.push({ f, moved });
    }
  }
  return samples;
}

// Compare alternative layouts for one requested crossing. Constant features cannot
// distinguish them. One vote per passable surface or relative body position.
export function rankLayouts(layouts, role, from, delta, samples) {
  const positives = samples.filter((s) => s.moved),
    negatives = samples.filter((s) => !s.moved);
  const cases = layouts.map((rows) =>
    rows && same(locate(rows, role), from) ? facts(rows, role, delta) : null,
  );
  const possible = cases.filter(Boolean);
  const variable = new Set(
    possible
      .flatMap((f) => [...f])
      .filter((k) => possible.some((f) => !f.has(k))),
  );
  const weights = new Map();
  for (const feature of variable) {
    const yes = positives.filter((s) => s.f.has(feature)).length,
      no = negatives.filter((s) => s.f.has(feature)).length;
    if (!yes && !no) continue;
    const support = yes + no;
    const weight =
      ((yes / Math.max(1, positives.length) -
        no / Math.max(1, negatives.length)) *
        support) /
      (1 + support);
    weights.set(feature, weight);
  }
  return {
    positive: positives.length,
    negative: negatives.length,
    variable: weights.size,
    scores: cases.map((f) =>
      f ? [...f].reduce((s, k) => s + (weights.get(k) ?? 0), 0) : null,
    ),
  };
}
