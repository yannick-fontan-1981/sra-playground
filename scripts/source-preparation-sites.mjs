import { geometricComponents } from '../src/logos-engine/v6-native-observer.ts';

const clicked = (word) => (word?.startsWith('ACTION6:') ? word.slice(8).split(',').map(Number) : null);
const center = (box) => [Math.floor((box[0] + box[2]) / 2), Math.floor((box[1] + box[3]) / 2)];
const coord = (p) => p.join(',');
const patch = (rows, x, y) =>
  [-1, 0, 1].flatMap((dy) => [-1, 0, 1].map((dx) => rows[y + dy]?.[x + dx] ?? -1)).join(',');

export function preparationSites() {
  const cached = new WeakMap(),
    records = [];
  function bodies(rows) {
    if (cached.has(rows)) return cached.get(rows);
    const parts = geometricComponents(rows)
      .filter((p) => p.area <= (rows.length * rows[0].length) / 8)
      .map((p) => {
        const shape = JSON.stringify(p.mask);
        return { box: p.bbox, shape, appearance: p.color + '/' + shape, area: p.area };
      });
    cached.set(rows, parts);
    return parts;
  }
  function at(rows, site) {
    const [x, y] = site;
    const surrounding = bodies(rows).filter(({ box: [l, t, r, b] }) => l <= x && x <= r && t <= y && y <= b);
    return surrounding.map((p) => ({ ...p, offset: [x - p.box[0], y - p.box[1]] }));
  }
  function observe(before, after, command) {
    const site = clicked(command);
    if (!site) return;
    const [x, y] = site,
      initial = patch(before, x, y);
    records.push({ site, domains: at(before, site), initial, changed: initial !== patch(after, x, y) });
  }
  function nominate(rows, use, visible) {
    const parts = bodies(rows),
      offers = new Map();
    function offer(site) {
      const [x, y] = site,
        key = coord(site);
      if (x < 0 || y < 0 || x >= rows[0].length || y >= rows.length) return null;
      if (!offers.has(key))
        offers.set(key, {
          site,
          effects: new Set(),
          rejected: new Set(),
          goal: false,
          visible: false,
          sameInk: 0,
        });
      return offers.get(key);
    }
    const goal = clicked(use);
    function from(record, isGoal) {
      for (const ref of record.domains)
        for (const p of parts) {
          if (p.shape !== ref.shape) continue;
          const site = [p.box[0] + ref.offset[0], p.box[1] + ref.offset[1]];
          const option = offer(site);
          if (!option) continue;
          if (isGoal) {
            option.goal = true;
            continue;
          }
          if (patch(rows, ...site) !== record.initial) continue;
          const id = coord(record.site);
          (record.changed ? option.effects : option.rejected).add(id);
          if (p.appearance === ref.appearance && record.changed) option.sameInk = 1;
        }
    }
    for (const record of records) from(record, false);
    if (goal) from({ domains: at(rows, goal) }, true);
    for (const w of visible) {
      const p = clicked(w);
      if (p) offer(p).visible = true;
    }
    for (const p of parts) offer(center(p.box));
    const tested = new Set(
      records.filter((r) => patch(rows, ...r.site) === r.initial).map((r) => coord(r.site)),
    );
    const distance = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
    const rank = (o) => [
      o.effects.size - o.rejected.size,
      o.sameInk,
      Number(o.goal),
      Number(!tested.has(coord(o.site))),
      Number(o.visible),
      goal ? -distance(o.site, goal) : 0,
    ];
    return [...offers.values()]
      .map((o) => ({ op: 'ACTION6:' + coord(o.site), rank: rank(o) }))
      .sort((a, b) => {
        for (let i = 0; i < a.rank.length; i++) if (a.rank[i] !== b.rank[i]) return b.rank[i] - a.rank[i];
        return 0;
      });
  }
  return { observe, nominate };
}
