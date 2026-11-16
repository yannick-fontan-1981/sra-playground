import { geometricComponents } from '../logos-engine/v6-native-observer.ts';
import type { NativePoint, NativeRows } from '../logos-engine/v6-native-types.ts';

type Bar = { at: NativePoint; length: number };
type Layout = {
  origin: NativePoint;
  unit: number;
  width: number;
  terminal: number;
  source: NativePoint;
  targets: number[];
  bars: Bar[];
  carried: number;
  capInk: number;
  restingInk: number;
  focusedInk: number;
  background: number;
  focused: number;
};
export type StackedBranchLayout = Layout;

export function measureStackedBranchLayout(rows: NativeRows): Layout | null {
  const parts = geometricComponents(rows);
  const frame = parts.filter(part => part.bbox[0] > 0 && part.bbox[1] > 0 && part.area > rows.length * rows[0]!.length / 2);
  if (frame.length !== 1) return null;
  const [l, t, r, b] = frame[0]!.bbox, origin: NativePoint = [l, t], background = frame[0]!.color;
  const targets = parts.flatMap(part => {
    const [x, y, right, bottom] = part.bbox, unit = (bottom - y + 1) / 2;
    if (!Number.isInteger(unit) || unit < 2 || right - x + 1 !== 3 * unit || part.area !== 5 * unit ** 2
      || x < l || right > r || bottom > b || (x - l) % unit || (y - t) % unit) return [];
    const hollow = part.mask.every(([dx, dy]) => dy >= unit || dx < unit || dx >= 2 * unit);
    return hollow ? [{ x: (x - l) / unit + 1, y: (y - t) / unit, unit, ink: part.color }] : [];
  });
  if (targets.length < 3 || targets.some(target => target.unit !== targets[0]!.unit
    || target.y !== targets[0]!.y || target.ink !== targets[0]!.ink)) return null;
  const { unit, y: terminal } = targets[0]!, width = (r - l + 1) / unit;
  if (!Number.isInteger(width) || width > 24) return null;
  const lattice = parts.flatMap(part => {
    const [x, y, right, bottom] = part.bbox, length = (right - x + 1) / unit;
    if (!part.rectangular || bottom - y + 1 !== unit || !Number.isInteger(length)
      || x < l || right > r || y < t || y >= t + terminal * unit || (x - l) % unit || (y - t) % unit) return [];
    return [{ at: [(x - l) / unit, (y - t) / unit] as NativePoint, length, ink: part.color }];
  });
  const emitter = lattice.filter(piece => piece.length === 1 && piece.at[1] === 0);
  if (emitter.length !== 1) return null;
  const cap = emitter[0]!, source: NativePoint = [cap.at[0], cap.at[1] + 1];
  if (!lattice.some(piece => piece.length === 1 && piece.at[0] === source[0] && piece.at[1] === source[1] && piece.ink !== cap.ink)) return null;
  const innerCaps = lattice.filter(piece => piece.length === 1 && piece.at[1] > source[1] && piece.ink === cap.ink);
  if (innerCaps.length !== 1) return null;
  const inner = innerCaps[0]!, longs = lattice.filter(piece => piece.length > 1 && piece.at[1] > source[1]);
  const flanks = longs.flatMap(first => {
    if (first.at[1] !== inner.at[1] || first.at[0] + first.length !== inner.at[0]) return [];
    return longs.flatMap(second => second.at[1] === first.at[1] && second.at[0] === inner.at[0] + 1
      && second.ink === first.ink && second.length === first.length ? [{ first, second }] : []);
  });
  if (flanks.length !== 1) return null;
  const { first, second } = flanks[0]!;
  const contributors = [...longs.filter(piece => piece !== first && piece !== second),
    { at: first.at, length: first.length + second.length + 1, ink: first.ink, carriesSource: true }]
    .sort((a, b) => a.at[1] - b.at[1] || a.at[0] - b.at[0]);
  if (contributors.length < 2 || contributors.length > 6) return null;
  const resting = contributors.find(piece => contributors.filter(other => other.ink === piece.ink).length > 1);
  if (!resting) return null;
  const selected = contributors.flatMap((piece, index) => piece.ink !== resting.ink ? [index] : []);
  if (selected.length !== 1) return null;
  return { origin, unit, width, terminal, source, targets: targets.map(target => target.x).sort((a, b) => a - b),
    bars: contributors.map(({ at, length }) => ({ at, length })), carried: contributors.findIndex(piece => 'carriesSource' in piece),
    capInk: cap.ink, restingInk: resting.ink, focusedInk: contributors[selected[0]!]!.ink, background, focused: selected[0]! };
}

const movementCost = (a: NativePoint, b: NativePoint) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);

export function placeStackedBranches(layout: Layout, interrupted: () => boolean = () => false): NativePoint[] | null {
  const { bars, carried, source, terminal, width, targets } = layout;
  const carrier = bars[carried]!, targetSet = new Set(targets), candidate = bars.map(bar => bar.at);
  let bestCost = Infinity, best: NativePoint[] | null = null;
  let examined = 0;
  const stop = () => ++examined > 24_000 || interrupted();
  const center = Math.floor(carrier.length / 2), indices = bars.flatMap((_, index) => index === carried ? [] : [index]);
  for (let start = 0; start + carrier.length <= width; start++) {
    const produced = [start - 1, start + center, start + carrier.length];
    if (produced.some(x => !targetSet.has(x))) continue;
    const unserved = targets.filter(x => !produced.includes(x));
    if (unserved.length !== 1) continue;
    const direct = unserved[0]!;
    for (let intercepted = start; intercepted < start + carrier.length; intercepted++) {
      if (intercepted === direct) continue;
      const lo = Math.min(direct, intercepted) + 1, hi = Math.max(direct, intercepted) - 1;
      if (source[0] < lo || source[0] > hi) continue;
      const chosen: { index: number; x: number }[] = [];
      const full = 2 ** (hi - lo + 1) - 1;
      function chooseLayer(cursor: number, cover: number): void {
        if (stop()) return;
        if (cursor < indices.length) {
          const index = indices[cursor]!, length = bars[index]!.length;
          chooseLayer(cursor + 1, cover);
          for (let x = lo; x + length - 1 <= hi; x++) {
            chosen.push({ index, x });
            chooseLayer(cursor + 1, cover | (2 ** length - 1) << (x - lo));
            chosen.pop();
          }
          return;
        }
        if (cover !== full || new Set(chosen.map(({ index, x }) => [x, bars[index]!.length].join(','))).size !== chosen.length) return;
        const parking = indices.filter(index => !chosen.some(entry => entry.index === index));
        for (let level = source[1] + 1; level < terminal - 2; level++) for (let below = level + 2; below < terminal; below++) {
          if (stop()) return;
          candidate[carried] = [start, below];
          chosen.forEach(({ x, index }) => { candidate[index] = [x, level]; });
          let cost = movementCost(carrier.at, candidate[carried]!)
            + chosen.reduce((sum, { index }) => sum + movementCost(bars[index]!.at, candidate[index]!), 0);
          if (cost >= bestCost) continue;
          const parked: number[] = [];
          for (const index of parking) {
            const bar = bars[index]!, choices: { at: NativePoint; cost: number }[] = [];
            for (let y = source[1] + 1; y < terminal; y++) {
              if (Math.abs(y - level) <= 1 || Math.abs(y - below) <= 1) continue;
              const rays = y < level ? [source[0]] : y < below ? [direct, intercepted] : targets;
              for (let x = 0; x + bar.length <= width; x++) {
                if (rays.some(ray => x <= ray && ray < x + bar.length)) continue;
                if (parked.some(other => candidate[other]![0] === x && candidate[other]![1] === y && bars[other]!.length === bar.length)) continue;
                choices.push({ at: [x, y], cost: movementCost(bar.at, [x, y]) });
              }
            }
            const next = choices.sort((a, b) => a.cost - b.cost)[0];
            if (!next) break;
            candidate[index] = next.at;
            parked.push(index);
            cost += next.cost;
          }
          if (parked.length === parking.length && cost < bestCost) { bestCost = cost; best = [...candidate]; }
        }
      }
      chooseLayer(0, 0);
    }
  }
  return best;
}

export function stackedBranchBox(layout: Layout, [x, y]: NativePoint, length: number) {
  const left = layout.origin[0] + x * layout.unit, top = layout.origin[1] + y * layout.unit;
  return [left, top, left + length * layout.unit - 1, top + layout.unit - 1] as const;
}

export function stackedBranchSelection(layout: Layout, positions: readonly NativePoint[], index: number): NativePoint | null {
  const [left, row] = positions[index]!, length = layout.bars[index]!.length;
  for (let x = left; x < left + length; x++) {
    if (index === layout.carried && x === left + Math.floor(length / 2)) continue;
    if (positions.some(([other, y], j) => j !== index && y === row && other <= x && x < other + layout.bars[j]!.length)) continue;
    const [px, py] = stackedBranchBox(layout, [x, row], 1), center = Math.floor(layout.unit / 2);
    return [px + center, py + center];
  }
  return null;
}

export function verifyStackedBranchLayout(rows: NativeRows, layout: Layout, positions: readonly NativePoint[], focused: number): boolean {
  let focusObserved = false;
  for (let y = layout.source[1] + 1; y < layout.terminal; y++) for (let x = 0; x < layout.width; x++) {
    const indices = positions.flatMap(([left, row], index) =>
      row === y && left <= x && x < left + layout.bars[index]!.length ? [index] : []);
    const [l, t, r, b] = stackedBranchBox(layout, [x, y], 1), ink = rows[t]?.[l];
    if (ink === undefined) return false;
    for (let row = t; row <= b; row++) for (let col = l; col <= r; col++) if (rows[row]?.[col] !== ink) return false;
    if (!indices.length) {
      if (ink !== layout.background) return false;
      continue;
    }
    const cap = x === positions[layout.carried]![0] + Math.floor(layout.bars[layout.carried]!.length / 2);
    const visible = indices.some(index => ink === (index === layout.carried && cap ? layout.capInk
      : index === focused ? layout.focusedInk : layout.restingInk));
    if (!visible) return false;
    if (ink === layout.focusedInk && indices.includes(focused)) focusObserved = true;
  }
  return focusObserved;
}
