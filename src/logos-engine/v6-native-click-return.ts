import type { MeasuredEntity, MeasuredObservation } from './v6-native-observer.ts';
import type { NativeBox, NativeCommand, NativePoint, NativeRows } from './v6-native-types.ts';

interface VisibleRegion {
  readonly ref: string;
  readonly signature: string;
  readonly box: NativeBox;
  readonly palette: number;
  readonly pixels: number;
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

/** Compact diagnostic of an already executed command, using the native public measurements. */
export function projectNativeClickReturn(
  command: NativeCommand, before: MeasuredObservation, after: MeasuredObservation, returnedRows: NativeRows,
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
  };
}
