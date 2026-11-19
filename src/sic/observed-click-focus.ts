import { ConcentricGeometryBoundExceeded, FrameGrid, measureConcentricFrames } from '../logos-engine/v5-concentric-frames.ts';
import type { NativeBox, NativeObservation, NativePoint, NativeRows } from '../logos-engine/v6-native-types.ts';

export type ObservedClickFocus = { box: NativeBox; point: NativePoint; accent: number };

export function chooseObservedClickFocus(observation: NativeObservation, rows: NativeRows, accent?: number): ObservedClickFocus | undefined {
  const grid = new FrameGrid(rows);
  let frames;
  try {
    frames = measureConcentricFrames(grid);
  } catch (error) {
    if (error instanceof ConcentricGeometryBoundExceeded) return;
    throw error;
  }
  const candidates = frames.flatMap(frame => {
    const { left, top, right, bottom, outer_value } = frame;
    const area = (right - left + 1) * (bottom - top + 1);
    if (frame.maximum_equal_padding < 2 || area * 8 >= grid.width * grid.height || accent !== undefined && outer_value !== accent) return [];
    const box: NativeBox = [left, top, right, bottom];
    const outlined = observation.entities.some(entity => entity.id === frame.outer_ref || (
      entity.palette_value === outer_value && entity.area === 2 * (right - left + bottom - top)
      && box.every((coordinate, i) => entity.bbox[i] === coordinate)));
    return outlined ? [{ box, point: [frame.center[1], frame.center[0]] as NativePoint, accent: outer_value, area }] : [];
  });
  const smallest = Math.min(...candidates.map(candidate => candidate.area));
  const unique = candidates.filter(candidate => candidate.area === smallest);
  return unique.length === 1 ? unique[0] : undefined;
}
