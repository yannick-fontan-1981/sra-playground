import { geometricComponents } from '../src/logos-engine/v6-native-observer.ts';

const click = (op) => (op.startsWith('ACTION6:') ? op.slice(8).split(',').map(Number) : null);
const windowAt = (rows, x, y) =>
  [-1, 0, 1].flatMap((dy) => [-1, 0, 1].map((dx) => rows[y + dy]?.[x + dx] ?? -1));
const appearance = new WeakMap();
function bodies(rows) {
  if (appearance.has(rows)) return appearance.get(rows);
  const roles = new Map();
  for (const p of geometricComponents(rows)) {
    if (p.area > (rows.length * rows[0].length) / 8) continue;
    const role = JSON.stringify([p.color, p.mask]);
    if (!roles.has(role)) roles.set(role, []);
    roles.get(role).push(p.bbox);
  }
  appearance.set(rows, roles);
  return roles;
}

function project(rows, step) {
  const next = rows.map((row) => row.slice());
  for (const [x, y, value, after] of step.changes) {
    if (rows[y]?.[x] !== value) return null;
    next[y][x] = after;
  }
  return next;
}
export function predictionHolds(rows, step) {
  return step.changes.every(([x, y, , after]) => rows[y]?.[x] === after);
}

export function applicable(rows, step) {
  const boxes = bodies(rows).get(step.role);
  return (
    !!boxes?.some((box) => box[0] === step.x - step.offset[0] && box[1] === step.y - step.offset[1]) &&
    (step.op.startsWith('ACTION6:') || boxes.length === 1) &&
    windowAt(rows, step.x, step.y).join() === step.before &&
    step.changes.every(([x, y, before]) => rows[y]?.[x] === before)
  );
}

export function preparationModel() {
  const rules = new Map(),
    seen = new Set(),
    contradicted = new Set(),
    unresponsive = new Set();
  function remember(role, offset, action, before, changes, origin) {
    if (!changes.length) return;
    const id = JSON.stringify([role, offset, action, before]);
    if (!rules.has(id)) rules.set(id, { role, offset, action, before, variants: new Map() });
    const alternatives = rules.get(id).variants,
      key = JSON.stringify(changes);
    if (!alternatives.has(key)) alternatives.set(key, { changes, examples: new Set() });
    alternatives.get(key).examples.add(origin);
  }
  function observe(rows, next, op, origin) {
    seen.add(origin + '/' + op);
    if (
      rows.length === next.length &&
      rows.every((row, y) => row.length === next[y].length && row.every((v, x) => v === next[y][x]))
    ) {
      unresponsive.add(op);
      return;
    }
    const site = click(op),
      parts = bodies(rows);
    for (const [role, boxes] of parts) {
      if (site) {
        for (const [l, t, r, b] of boxes) {
          const [x, y] = site;
          if (x < l || x > r || y < t || y > b) continue;
          const before = windowAt(rows, x, y),
            after = windowAt(next, x, y),
            changes = [];
          for (let i = 0; i < 9; i++)
            if (after[i] !== before[i]) changes.push([(i % 3) - 1, Math.floor(i / 3) - 1, before[i], after[i]]);
          remember(role, [x - l, y - t], 'ACTION6', before.join(), changes, origin);
        }
        continue;
      }
      const targets = bodies(next).get(role);
      if (boxes.length !== 1 || targets?.length !== 1) continue;
      const [l, t, r, b] = boxes[0],
        [u, v] = targets[0],
        dx = u - l,
        dy = v - t;
      if ((!dx && !dy) || Math.max(Math.abs(dx), Math.abs(dy)) > 12) continue;
      const changes = [];
      for (let y = Math.min(t, v); y <= Math.max(b, b + dy); y++)
        for (let x = Math.min(l, u); x <= Math.max(r, r + dx); x++) {
          if (rows[y][x] !== next[y][x]) changes.push([x - l, y - t, rows[y][x], next[y][x]]);
        }
      remember(role, [0, 0], op, windowAt(rows, l, t).join(), changes, origin);
    }
  }
  function options(rows, available) {
    const all = new Map(),
      view = bodies(rows);
    for (const [key, rule] of rules) {
      if (rule.variants.size !== 1 || contradicted.has(key) || !available.has(rule.action)) continue;
      const boxes = view.get(rule.role);
      if (!boxes || (rule.action !== 'ACTION6' && boxes.length !== 1)) continue;
      const variant = rule.variants.values().next().value;
      for (const [l, t] of boxes) {
        const x = l + rule.offset[0],
          y = t + rule.offset[1];
        if (windowAt(rows, x, y).join() !== rule.before) continue;
        const changes = variant.changes.map(([dx, dy, a, b]) => [x + dx, y + dy, a, b]);
        if (!changes.every(([px, py, a]) => rows[py]?.[px] === a)) continue;
        const op = rule.action === 'ACTION6' ? 'ACTION6:' + x + ',' + y : rule.action;
        const step = {
          op,
          role: rule.role,
          x,
          y,
          changes,
          support: variant.examples.size,
          before: rule.before,
          offset: rule.offset,
          key,
        };
        const id = JSON.stringify([op, x, y, changes]);
        if (!all.has(id) || step.support > all.get(id).support) all.set(id, step);
      }
    }
    return [...all.values()].sort((a, b) => b.support - a.support);
  }
  function choose(rows, origin, available, compose) {
    const opts = options(rows, available);
    const first = opts.filter((o) => !seen.has(origin + '/' + o.op));
    if (!compose) return first[0] && { kind: 'single', steps: [first[0]] };
    const effects = new Set(opts.map((step) => JSON.stringify([step.op, step.changes])));
    let best;
    // Bound the number of distinct imagined first effects, including coordinate bindings.
    for (const a of first.slice(0, 12)) {
      const imagined = project(rows, a);
      if (!imagined) continue;
      for (const b of options(imagined, available).slice(0, 64)) {
        if (compose === 'blocked-use' && !unresponsive.has(b.op)) continue;
        if (b.op === a.op || effects.has(JSON.stringify([b.op, b.changes]))) continue;
        if (predictionHolds(rows, b)) continue;
        // Require the second model to consume at least one value produced by the first.
        const feeds = a.changes.filter(([x, y, , after]) =>
          b.changes.some(([u, v, before]) => x === u && y === v && before === after),
        );
        if (!feeds.length) continue;
        const afterB = project(imagined, b);
        if (
          !afterB ||
          predictionHolds(afterB, { changes: a.changes.map(([x, y, old, value]) => [x, y, value, old]) })
        )
          continue;
        const support = Math.min(a.support, b.support);
        if (!best || support > best.support) best = { kind: 'enabled', support, steps: [a, b] };
      }
    }
    return best ?? (first[0] && { kind: 'single', steps: [first[0]] });
  }
  return { observe, choose, refute: (step) => contradicted.add(step.key) };
}
