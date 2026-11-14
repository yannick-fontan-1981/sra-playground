import type { NativeBox } from '../logos-engine/v6-native-types.ts';
import type { GeometricComponent } from '../logos-engine/v6-native-observer.ts';

export function repeatedInputTargets(components: readonly GeometricComponent[], covered: ReadonlySet<GeometricComponent>, limit: number) {
  const groups = new Map<string, GeometricComponent[]>();
  for (const part of components) {
    const [left, top, right, bottom] = part.bbox;
    if (!part.rectangular || right <= left || bottom <= top) continue;
    const key = `${right - left},${bottom - top}`;
    const group = groups.get(key) ?? [];
    group.push(part);
    groups.set(key, group);
  }
  const offers = [...groups.values()].flatMap(group => {
    if (group.length < 4 || group.some(part => covered.has(part))) return [];
    const boxes = group.map(part => part.bbox);
    const left = Math.min(...boxes.map(box => box[0])), right = Math.max(...boxes.map(box => box[2]));
    const top = Math.min(...boxes.map(box => box[1])), bottom = Math.max(...boxes.map(box => box[3]));
    const distance = ([l, t, r, b]: NativeBox) => Math.abs(l + r - left - right) + Math.abs(t + b - top - bottom);
    return [{ group, distance }];
  }).sort((a, b) => b.group.length - a.group.length);
  const ranked = offers.map(({ group, distance }) => [...group].sort((a, b) => distance(a.bbox) - distance(b.bbox)));
  const candidates: GeometricComponent[] = [];
  for (let i = 0; i < limit; i++) for (const group of ranked) {
    if (group[i] && candidates.length < limit) candidates.push(group[i]!);
  }
  return candidates;
}
