import { cropReturn, measureChangedRegions, previewChangedRegions } from '../logos-engine/v6-public-return-visuals.ts';
import type { NativeBox, NativePoint, NativeRows } from '../logos-engine/v6-native-types.ts';
import type { DecisionSprites, NativeResolution } from './native-resolution.ts';

export interface DirectionalReturn {
  readonly sessionId: string;
  readonly sequence: number;
  readonly command: number;
  readonly fromLevel: number;
  readonly toLevel: number;
  readonly frameCount?: number;
  readonly decision?: DecisionSprites;
  readonly nativeCheck?: NonNullable<NativeResolution['outcome']>;
  readonly rotation?: { readonly tile: NativeRows; readonly before: NativeRows; readonly after: NativeRows };
  readonly animation?: readonly { readonly index: number; readonly rows: NativeRows }[];
  readonly changes: ReturnType<typeof previewChangedRegions> | null;
  readonly translation: { readonly from: NativeBox; readonly to: NativeBox; readonly sprite: NativeRows;
    readonly targetBefore: NativeRows } | null;
  readonly stationary: { readonly box: NativeBox; readonly sprite: NativeRows; readonly step: number;
    readonly ahead: NativeRows | null } | null;
}

const axes: Readonly<Record<number, NativePoint>> = { 1: [0, -1], 2: [0, 1], 3: [-1, 0], 4: [1, 0] };
const equalAt = (rows: NativeRows, sprite: NativeRows, x: number, y: number) =>
  sprite.every((row, dy) => row.every((color, dx) => rows[y + dy]?.[x + dx] === color));

/** Match a previously verified tile and indicator transition to this actual return. */
export function matchObservedRotation(receipt: DirectionalReturn, before: NativeRows, after: NativeRows,
  witness: { readonly tile: NativeRows; readonly before: NativeRows; readonly after: NativeRows }): DirectionalReturn['rotation'] {
  const target = receipt.translation?.targetBefore;
  if (!target || JSON.stringify(target) !== JSON.stringify(witness.tile)) return undefined;
  const matches: NativePoint[] = [];
  for (let y = 0; y + witness.before.length <= before.length; y++) {
    for (let x = 0; x + (witness.before[0]?.length ?? 0) <= (before[y]?.length ?? 0); x++) {
      if (equalAt(before, witness.before, x, y) && equalAt(after, witness.after, x, y)) matches.push([x, y]);
    }
  }
  return matches.length === 1 ? witness : undefined;
}

export function samplePublicAnimation(frames: readonly NativeRows[]) {
  if (frames.length < 2) return undefined;
  const indexes = [...new Set([0, Math.floor((frames.length - 1) / 2), frames.length - 1])];
  return indexes.map(index => {
    const rows = frames[index]!;
    const stride = Math.max(1, Math.ceil(Math.max(rows.length, rows[0]?.length ?? 0) / 32));
    return { index: index + 1, rows: rows.filter((_, y) => y % stride === 0)
      .map(row => row.filter((_, x) => x % stride === 0)) };
  });
}

/** Find a unique exact sprite translation among paired changed regions, without assigning an object role. */
function translationIn(command: number, before: NativeRows, after: NativeRows,
  regions: ReturnType<typeof measureChangedRegions>['regions']): DirectionalReturn['translation'] {
  const axis = axes[command];
  if (!axis) return null;
  const candidates = new Map<string, NonNullable<DirectionalReturn['translation']>>();
  const top = regions.slice(0, 16);
  const pairs: (readonly [NativeBox, NativeBox])[] = [];
  for (const source of top) {
    const [x, y, right, bottom] = source.box;
    if (source.pixels < 6 || right - x < 1 || bottom - y < 1) continue;
    for (const target of top) if (target !== source) pairs.push([source.box, target.box]);
    // Touching footprints can be a single component. Split it along the command axis.
    if (axis[0] && (right - x + 1) % 2 === 0) {
      const split = (x + right + 1) / 2;
      const ends = [[x, y, split - 1, bottom], [split, y, right, bottom]] as const;
      pairs.push(axis[0] > 0 ? ends : [ends[1], ends[0]]);
    }
    if (axis[1] && (bottom - y + 1) % 2 === 0) {
      const split = (y + bottom + 1) / 2;
      const ends = [[x, y, right, split - 1], [x, split, right, bottom]] as const;
      pairs.push(axis[1] > 0 ? ends : [ends[1], ends[0]]);
    }
  }
  for (const [from, to] of pairs) {
    const [x, y, right, bottom] = from, [nx, ny, nr, nb] = to;
    if (right - x < 1 || bottom - y < 1 || right - x > 19 || bottom - y > 19) continue;
    const sprite = cropReturn(before, from, 1);
    if (new Set(sprite.flat()).size < 2) continue;
    const dx = nx - x, dy = ny - y;
    if (nr - nx !== right - x || nb - ny !== bottom - y
        || (axis[0] === 0 ? dx !== 0 || dy * axis[1] <= 0 : dy !== 0 || dx * axis[0] <= 0)) continue;
    if (!equalAt(after, sprite, nx, ny) || equalAt(before, sprite, nx, ny) || equalAt(after, sprite, x, y)) continue;
    candidates.set(`${from}:${to}`, { from, to, sprite, targetBefore: cropReturn(before, to, 1) });
  }
  return candidates.size === 1 ? candidates.values().next().value! : null;
}

/** Compare the approached patches before input; retain one sprite sample per outcome. */
export function compareDirectionTargets(returns: readonly DirectionalReturn[]) {
  const groups = new Map<string, { moved: number; stationary: number; movedExample?: DirectionalReturn;
    stationaryExample?: DirectionalReturn }>();
  for (const item of returns) {
    const target = item.translation?.targetBefore ?? item.stationary?.ahead;
    if (!target) continue;
    const colors = [...new Set(target.flat())].sort((a, b) => a - b);
    const key = colors.join(',');
    const group = groups.get(key) ?? { moved: 0, stationary: 0 };
    if (item.translation) { group.moved++; group.movedExample ??= item; }
    else { group.stationary++; group.stationaryExample ??= item; }
    groups.set(key, group);
  }
  return [...groups].map(([key, evidence]) => ({ colors: key.split(',').map(Number), ...evidence }))
    .sort((a, b) => b.stationary + b.moved - a.stationary - a.moved);
}

function stationaryIn(command: number, before: NativeRows, after: NativeRows, reference: DirectionalReturn | undefined,
  pixelsChanged: number): DirectionalReturn['stationary'] {
  if (!reference) return null;
  const known = reference.translation ?? reference.stationary;
  if (!known) return null;
  const spriteArea = known.sprite.length * (known.sprite[0]?.length ?? 0);
  if (!spriteArea || pixelsChanged > Math.floor(spriteArea / 2)) return null;
  const box = 'to' in known ? known.to : known.box;
  if (!equalAt(before, known.sprite, box[0], box[1]) || !equalAt(after, known.sprite, box[0], box[1])) return null;
  const step = 'to' in known ? Math.abs(known.to[0] - known.from[0]) + Math.abs(known.to[1] - known.from[1]) : known.step;
  const axis = axes[command]!;
  const x = box[0] + step * axis[0], y = box[1] + step * axis[1];
  const right = x + box[2] - box[0], bottom = y + box[3] - box[1];
  const ahead = x >= 0 && y >= 0 && right < before[0]!.length && bottom < before.length
    ? cropReturn(before, [x, y, right, bottom], 1) : null;
  return { box, sprite: known.sprite, step, ahead };
}

/** Exact matching is deliberately conservative. Unmatched changes remain visible. */
export function observeDirectionalReturn(
  scope: Omit<DirectionalReturn, 'changes' | 'translation' | 'stationary'>,
  before: NativeRows, after: NativeRows, boundary: boolean,
  previous?: DirectionalReturn,
): DirectionalReturn {
  const width = before[0]?.length;
  const comparable = width && before.length === after.length
    && before.every(row => row.length === width) && after.every(row => row.length === width);
  if (boundary || !comparable) return { ...scope, changes: null, translation: null, stationary: null };
  const measured = measureChangedRegions(before, after);
  const translation = translationIn(scope.command, before, after, measured.regions);
  const stationary = !translation && axes[scope.command] && previous?.sessionId === scope.sessionId && previous.sequence + 1 === scope.sequence
    && previous.toLevel === scope.fromLevel ? stationaryIn(scope.command, before, after, previous, measured.totalPixels) : null;
  const remaining = translation ? measureChangedRegions(before, after, [translation.from, translation.to]) : measured;
  return { ...scope, changes: previewChangedRegions(before, after, remaining), translation, stationary };
}

export function summarizeDirections(returns: readonly DirectionalReturn[]) {
  return [...new Set(returns.map(item => item.command))].sort().map(command => {
    const samples = returns.filter(item => item.command === command);
    const moved = samples.filter(item => item.translation).length;
    const stationary = samples.filter(item => item.stationary).length;
    const unresolved = samples.length - moved - stationary;
    const shifts = samples.flatMap(({ translation: match }) => match
      ? [`${match.to[0] - match.from[0]},${match.to[1] - match.from[1]}`] : []);
    const repeated = shifts.length >= 2 && new Set(shifts).size === 1;
    return { command, moved, stationary, unresolved, repeated, shift: repeated ? shifts[0] : undefined };
  });
}
