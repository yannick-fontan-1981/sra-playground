import { createHash } from 'node:crypto';

const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

// This presentation is external to the solver. The backend still receives its normal actions.
export function sourceContactView(initial, components, style) {
  const drawing = style === 'line' ? [[0, 0], [0, -1]] : [[0, 0], [-1, -1]];
  const patch = (frame, [left, top, right, bottom]) =>
    frame.slice(top, bottom + 1).map(row => row.slice(left, right + 1));
  let cues = null;
  let transformed = 0;
  let calibration = null;

  function freeze(before, commands) {
    if (cues !== null || before.level !== initial.level) return;
    calibration = digest([initial.frame, commands, before.frame]);
    cues = components(initial.frame).flatMap(({ color, bbox, rectangular, area }) => {
      const [left, top, right, bottom] = bbox;
      const pitch = right - left + 1;
      if (rectangular || pitch < 3 || pitch > 8 || bottom - top + 1 !== pitch || area < 2 * pitch - 1) return [];
      const center = [left + Math.floor(pitch / 2), top + Math.floor(pitch / 2)];
      const floor = initial.frame[center[1]][center[0]];
      const original = patch(initial.frame, bbox);
      if (color === floor || original.some(row => row.some(ink => ink !== color && ink !== floor))) return [];
      return digest(original) === digest(patch(before.frame, bbox)) ? [{ bbox, original, center, floor, color }] : [];
    });
  }

  function present(board) {
    if (board.level !== initial.level || !cues?.length) return board;
    const edit = frame => {
      const stable = cues.filter(({ bbox, original }) => patch(frame, bbox).every((row, y) =>
        row.every((ink, x) => ink === original[y][x])));
      if (!stable.length) return frame;
      const output = frame.map(row => row.slice());
      for (const { bbox: [left, top, right, bottom], center: [cx, cy], floor, color } of stable) {
        for (let y = top; y <= bottom; y++) output[y].fill(floor, left, right + 1);
        for (const [dx, dy] of drawing) output[cy + dy][cx + dx] = color;
      }
      return output;
    };
    const frame = edit(board.frame);
    if (frame !== board.frame) transformed++;
    return { ...board, frame, frames: board.frames.map(edit) };
  }

  return { freeze, present, receipt: () => ({ style, calibration, cues: cues?.length ?? 0, transformed }) };
}
