import { correspondences, type ConstraintTable, type RegularField } from '../logos-engine/v6-field-constraints.ts';
import type { NativePoint } from '../logos-engine/v6-native-types.ts';

type Fit = { table: ConstraintTable; unchanged: number };
type FieldConsensus = Fit & { relation: string };

function repeatedValues(field: RegularField, groups: Iterable<string[]>, useIndependentGroups = false): Fit | null {
  const table: ConstraintTable = new Map();
  const targetValues = new Set<number>();
  let unchanged = 0;
  const partition = useIndependentGroups ? [...groups] : groups;
  const witnesses = new Map<number, string[][]>();
  if (useIndependentGroups) {
    for (const cells of partition) {
      const value = field.values.get(cells[0]!)!;
      if (cells.length < 2 || !cells.every(cell => field.values.get(cell) === value)) continue;
      const intact = witnesses.get(value) ?? [];
      if (intact.length < 2) intact.push(cells);
      witnesses.set(value, intact);
    }
  }
  for (const cells of partition) {
    const values = new Map<number, string[]>();
    for (const cell of cells) {
      const value = field.values.get(cell)!;
      const matching = values.get(value) ?? [];
      matching.push(cell);
      values.set(value, matching);
    }
    const majority = [...values].find(([, sites]) => sites.length >= 2 && sites.length * 2 > cells.length);
    const supported = majority || !useIndependentGroups ? [] : [...values].filter(([value]) => witnesses.has(value));
    const [prediction] = supported;
    const choice = majority ?? (supported.length === 1 && witnesses.get(prediction![0])!.length >= 2 ? prediction : undefined);
    if (!choice) return null;
    const [expected, sites] = choice;
    const unchangedSites = majority ? sites : [...sites, ...witnesses.get(expected)!.flat()];
    unchanged += sites.length;
    targetValues.add(expected);
    for (const cell of cells) {
      const actual = field.values.get(cell)!;
      if (actual !== expected) table.set(cell, { actual, eq: new Set([expected]), ne: new Set(), sources: new Set(unchangedSites) });
    }
  }
  return table.size > 0 && targetValues.size > 1 && table.size * 3 < unchanged ? { table, unchanged } : null;
}

function periodicConsensus(field: RegularField): FieldConsensus[] {
  const options: FieldConsensus[] = [];
  for (let width = 1; width * 2 <= field.xs.length; width++) {
    for (let height = 1; height * 2 <= field.ys.length; height++) {
      const groups = new Map<string, string[]>();
      for (const [xIndex, x] of field.xs.entries()) {
        for (const [yIndex, y] of field.ys.entries()) {
          const key = [xIndex % width, yIndex % height].join(',');
          const group = groups.get(key) ?? [];
          group.push([x, y].join(','));
          groups.set(key, group);
        }
      }
      const fit = repeatedValues(field, groups.values());
      if (fit) options.push({ ...fit, relation: `period-majority:${width},${height}` });
    }
  }
  return options;
}

function reflectionConsensus(field: RegularField, isometries: readonly string[]): FieldConsensus[] {
  const { xs, ys, values } = field;
  const key = ([x, y]: NativePoint) => [xs[x], ys[y]].join(',');
  const supported = isometries.map(name => ({ name, pairs: correspondences(xs.length, ys.length, name).map(([a, b]) => [key(a), key(b)]) }))
    .filter(({ pairs }) => pairs.length && pairs.filter(([a, b]) => values.get(a!) !== values.get(b!)).length * 3 < pairs.length);
  const options: FieldConsensus[] = [];
  for (const [index, first] of supported.entries()) {
    for (const second of supported.slice(index + 1)) {
      const orbits = new Map([...values.keys()].map(cell => [cell, [cell]]));
      for (const [a, b] of [...first.pairs, ...second.pairs]) {
        const left = orbits.get(a!)!, right = orbits.get(b!)!;
        if (left === right) continue;
        left.push(...right);
        for (const cell of right) orbits.set(cell, left);
      }
      // A point fixed by both transformations contributes no independent observation.
      const groups = [...new Set(orbits.values())].filter(group => group.length > 1);
      const fit = repeatedValues(field, groups);
      if (fit) options.push({ ...fit, relation: `symmetry-majority:${first.name},${second.name}` });
    }
  }
  return options;
}
export function fieldConsensus(field: RegularField, isometries: readonly string[]): FieldConsensus[] {
  return [...periodicConsensus(field), ...reflectionConsensus(field, isometries)];
}

/** Resolve a two-cell disagreement only when one value recurs in intact pairs. */
export function pairedReflectionConsensus(field: RegularField, isometries: readonly string[]): FieldConsensus[] {
  const { xs, ys } = field;
  const address = ([x, y]: NativePoint) => [xs[x], ys[y]].join(',');
  return isometries.flatMap(name => {
    const pairs = correspondences(xs.length, ys.length, name).map(pair => pair.map(address));
    const fit = repeatedValues(field, pairs, true);
    return fit ? [{ ...fit, relation: 'reflection-pairs:' + name }] : [];
  });
}
