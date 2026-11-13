import type { MeasuredEntity, MeasuredObservation } from './v6-native-observer.ts';
import type { NativeBox, NativeCommand, NativePoint, NativeRows } from './v6-native-types.ts';

interface VisibleRegion {
  readonly ref: string;
  readonly signature: string;
  readonly box: NativeBox;
  readonly palette: number;
  readonly pixels: number;
}

export interface NativeClickContext {
  readonly state: string;
  readonly commands: readonly string[];
  readonly matchingRegions: number;
  readonly neighborhood: Readonly<Record<'above' | 'right' | 'below' | 'left', readonly number[]>>;
}

export interface NativeClickPreview {
  readonly before: NativeRows;
  readonly after: NativeRows | null;
  readonly point: NativePoint;
  readonly stride: number;
}

export interface NativeClickReturn {
  readonly beforeRef: string;
  readonly afterRef: string;
  readonly fromLevel: number;
  readonly toLevel: number;
  readonly sequence: number;
  readonly point: NativePoint;
  readonly target: VisibleRegion | null;
  readonly atPointAfter: VisibleRegion | null;
  readonly changedTargetPixels: number;
  readonly sameSupport: boolean;
  readonly boundary: boolean;
  readonly beforeContext?: NativeClickContext;
  readonly preview?: NativeClickPreview;
}

function atPoint(observation: MeasuredObservation, [x, y]: NativePoint): MeasuredEntity | undefined {
  return observation.entities.find(entity => {
    const [left, top, right, bottom] = entity.bbox;
    return x >= left && x <= right && y >= top && y <= bottom
      && entity.mask.some(([dx, dy]) => left + dx === x && top + dy === y);
  });
}

function region(entity: MeasuredEntity | undefined): VisibleRegion | null {
  return entity ? {
    ref: entity.id, signature: entity.signature, box: entity.bbox, palette: entity.palette_value, pixels: entity.area,
  } : null;
}

function summarizeContext(before: MeasuredObservation, target: MeasuredEntity, rows: NativeRows): NativeClickContext {
  const [left, top, right, bottom] = target.bbox;
  const depth = 2;
  function colors(x0: number, y0: number, x1: number, y1: number): number[] {
    const palette = new Set<number>();
    for (let y = Math.max(0, y0); y <= Math.min(y1, rows.length - 1); y++) {
      const row = rows[y]!;
      for (let x = Math.max(0, x0); x <= Math.min(x1, row.length - 1); x++) palette.add(row[x]!);
    }
    return [...palette].sort((a, b) => a - b);
  }
  return {
    state: before.state,
    commands: [...new Set(before.available_action_refs)].sort(),
    matchingRegions: before.entities.filter(entity => entity.signature === target.signature).length,
    neighborhood: {
      above: colors(left, top - depth, right, top - 1),
      right: colors(right + 1, top, right + depth, bottom),
      below: colors(left, bottom + 1, right, bottom + depth),
      left: colors(left - depth, top, left - 1, bottom),
    },
  };
}

function capturePreview(
  target: MeasuredEntity, point: NativePoint, before: NativeRows, after: NativeRows | null,
): NativeClickPreview {
  const [left, top, right, bottom] = target.bbox;
  const x0 = Math.max(0, left - 2), y0 = Math.max(0, top - 2);
  const x1 = Math.min(before[y0]!.length - 1, right + 2), y1 = Math.min(before.length - 1, bottom + 2);
  const stride = Math.max(1, Math.ceil(Math.max(x1 - x0 + 1, y1 - y0 + 1) / 20));
  function crop(rows: NativeRows): NativeRows {
    const pixels: number[][] = [];
    for (let y = y0; y <= y1; y += stride) {
      const row: number[] = [];
      for (let x = x0; x <= x1; x += stride) row.push(rows[y]![x]!);
      pixels.push(row);
    }
    return pixels;
  }
  return {
    before: crop(before),
    after: after ? crop(after) : null,
    point: [Math.floor((point[0] - x0) / stride), Math.floor((point[1] - y0) / stride)],
    stride,
  };
}

/** Compact diagnostic of an already executed command, using the native public measurements. */
export function projectNativeClickReturn(
  command: NativeCommand, before: MeasuredObservation, after: MeasuredObservation, returnedRows: NativeRows,
  beforeRows?: NativeRows,
): NativeClickReturn | null {
  if (command.action_ref !== 'ACTION6') return null;
  const x = command.data?.x, y = command.data?.y;
  if (x === undefined || y === undefined || !Number.isInteger(x) || !Number.isInteger(y)) return null;
  const point: NativePoint = [x, y];
  const target = atPoint(before, point);
  const boundary = before.level_epoch !== after.level_epoch || before.levels_completed !== after.levels_completed
    || before.state !== after.state;
  const returned = boundary ? undefined : atPoint(after, point);
  let changedTargetPixels = 0;
  if (target && !boundary) {
    const [left, top] = target.bbox;
    for (const [dx, dy] of target.mask) {
      if (returnedRows[top + dy]?.[left + dx] !== target.palette_value) changedTargetPixels += 1;
    }
  }
  const sameSupport = Boolean(target && returned && target.mask.length === returned.mask.length
    && target.bbox.every((coordinate, index) => coordinate === returned.bbox[index])
    && target.mask.every(([dx, dy], index) => dx === returned.mask[index]?.[0] && dy === returned.mask[index]?.[1]));
  return {
    beforeRef: before.observation_ref,
    afterRef: after.observation_ref,
    fromLevel: before.level_epoch,
    toLevel: after.level_epoch,
    sequence: before.revision,
    point,
    target: region(target),
    atPointAfter: region(returned),
    changedTargetPixels,
    sameSupport,
    boundary,
    ...(target && beforeRows ? {
      beforeContext: summarizeContext(before, target, beforeRows),
      preview: capturePreview(target, point, beforeRows, boundary ? null : returnedRows),
    } : {}),
  };
}
