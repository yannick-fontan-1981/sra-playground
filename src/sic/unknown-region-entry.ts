import { surrounding, type Reading, type Scene } from './paired-scene.ts';
import { chooseEffectExperiment } from './discriminating-experiment.ts';
import { forecast, geometry, imagine, key, law, type Learning } from './paired-displacements.ts';

type Entry = { site: number; objectives: number[] };
export type RegionEntries = Map<number, Entry[]>;

export function walkingRegion(s: Scene, v: Reading, origin: number, space = geometry(s)) {
  const sites = new Set([origin]), queue = [origin];
  for (const p of queue) for (const n of surrounding(s.grid, p)) {
    if (!sites.has(n) && space.walk(v, n)) {
      sites.add(n);
      queue.push(n);
    }
  }
  return sites;
}

/** Locate an unclassified feature for which entering from one shore would give
 * access to an observed objective or its control on a different shore. */
export function regionEntries(s: Scene, m: Learning, v: Reading): RegionEntries {
  const entries: RegionEntries = new Map();
  if (!s.other.length) return entries;
  const space = geometry(s), region = new Map<number, number>();
  for (const origin of [...s.ground, ...v.supports]) {
    if (region.has(origin) || !space.walk(v, origin)) continue;
    for (const site of walkingRegion(s, v, origin, space)) region.set(site, origin);
  }
  const objectives = [...new Set([...s.goals, ...s.doors.flatMap(d => d.controls)])];
  for (const site of s.other) {
    if (m.visibleFeatures && !m.visibleFeatures.includes(site)) continue;
    if (m.avoid?.includes(site) || m.passage?.pivot === site || region.has(site)) continue;
    const shores = surrounding(s.grid, site).filter(n => region.has(n));
    for (const source of shores) {
      const beyond = new Set(shores.map(n => region.get(n)));
      beyond.delete(region.get(source));
      const gain = objectives.filter(p => region.has(p) && beyond.has(region.get(p)));
      if (gain.length) {
        const options = entries.get(source) ?? [];
        options.push({ site, objectives: gain });
        entries.set(source, options);
      }
    }
  }
  for (const options of entries.values()) options.sort((a, b) => b.objectives.length - a.objectives.length);
  return entries;
}

export function regionEntryTest(s: Scene, m: Learning, v: Reading, entries: RegionEntries, ref: string, minimum: number) {
  const source = v.subjects[v.active], options = entries.get(source);
  if (!options || minimum > 2) return;
  const space = geometry(s);
  for (const entry of options) {
    const { site, objectives } = entry;
    if (v.subjects.includes(site) || v.pieces.includes(site)) continue;
    const neighbors = surrounding(s.grid, site);
    const context = neighbors.map(n => v.subjects.includes(n) ? 'subject' :
      v.pieces.includes(n) ? 'piece' : v.supports.includes(n) ? 'support' : 'empty');
    const ticket = [v.active, source, site, context.join(','), v.opened.join(',')].join('/');
    if (m.checked.includes('entry/' + ticket)) continue;
    const op = Object.keys(m.motors).find(op => {
      const dir = m.motors[op]!;
      return space.at(source, dir.dx, dir.dy) === site;
    });
    if (!op) continue;
    const normal = imagine(s, space, v, op, m, law(m, v.active)) ?? v;
    const subjects: [number, number] = [...v.subjects];
    subjects[v.active] = site;
    const entered = { ...v, subjects };
    const predictions = [{ law: 'ordinary_response', pose: key(normal) }, { law: 'enter_the_unclassified_site', pose: key(entered) }];
    const selected = chooseEffectExperiment([{ action: op, predictions: predictions.map(p => p.pose) }], minimum);
    if (!selected) continue;
    const test = forecast(s, m, v, normal, op, 'test_an_unclassified_entry_to_an_unreached_objective',
      ['compare_ordinary_motion_to_entry', 'measure_access_to_the_objectives_beyond'], ref);
    test.motionTest = { predictions, maximumRemaining: selected.partition.remaining };
    test.regionEntry = { site, source, objectives, ticket };
    return test;
  }
}
