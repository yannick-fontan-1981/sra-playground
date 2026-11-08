/** Native coordination over retained public returns; no hidden-state inference. */
import { v6Canonical } from './v6-native-observer.ts';
import { symbolicDigest } from './v6-hash.ts';
import type { NativePublicObservation, NativeRows } from './v6-native-types.ts';

type R = Record<string, any>;
const same = (a: unknown, b: unknown): boolean => v6Canonical(a) === v6Canonical(b);
const validRows = (rows: NativeRows): boolean => Array.isArray(rows) && rows.length > 0
  && Array.isArray(rows[0]) && rows[0]!.length > 0
  && rows.every(row => Array.isArray(row) && row.length === rows[0]!.length && row.every(Number.isFinite));

/** Preserve every returned frame, including an effect absent from the last one. */
export function summaryReturnedPublicProbe(first: NativePublicObservation, second: NativePublicObservation): R {
  const frames = second.frame_packet, rows = first.frame_rows;
  const wellFormed = validRows(rows) && validRows(second.frame_rows) && Array.isArray(frames) && frames.length > 0
    && frames.every(frame => validRows(frame) && frame.length === rows.length && frame[0]!.length === rows[0]!.length)
    && same(frames.at(-1), second.frame_rows) && second.step_index === first.step_index + 1;
  const restored = wellFormed && same(rows, second.frame_rows)
    && ['level', 'levels_completed', 'state', 'available_action_refs'].every(key => same((first as R)[key], (second as R)[key]))
    && !['WIN', 'GAME_OVER'].includes(second.state);
  const changed: number[][] = [];
  if (wellFormed) for (let y = 0; y < rows.length; y++) for (let x = 0; x < rows[y]!.length; x++) {
    if (frames.some(frame => frame[y]![x] !== rows[y]![x])) changed.push([x, y]);
  }
  return {
    status: !restored ? 'outside_stationary_invitation_scope' : changed.length
      ? 'transient_returned_unlearned_invitation' : 'stationary_unlearned_invitation',
    before_frame_digest: symbolicDigest(rows), frame_digest: symbolicDigest(second.frame_rows),
    returned_frame_count: frames.length, returned_frame_digests: frames.map(frame => symbolicDigest(frame)),
    transient_changed_points: changed,
  };
}

/** A cold current relation cannot borrow the unresolved probe's visible locus. */
export function independentReturnedProbeSupport(scope: R, witness: R, currentRows: NativeRows): boolean {
  if (scope.status !== 'transient_returned_unlearned_invitation'
    || scope.frame_digest !== symbolicDigest(currentRows) || !Array.isArray(scope.transient_changed_points)
    || !scope.transient_changed_points.length || !Array.isArray(witness.supportBoxes) || witness.supportBoxes.length < 2
    || scope.command?.action_ref !== 'ACTION6') return false;
  const commandPoint = [scope.command.data?.x, scope.command.data?.y];
  if (!commandPoint.every(Number.isSafeInteger)) return false;
  const points = [...scope.transient_changed_points, commandPoint];
  if (!points.every(point => Array.isArray(point) && point.length === 2 && point.every(Number.isSafeInteger))) return false;
  return witness.supportBoxes.every((box: unknown) => Array.isArray(box) && box.length === 4 && box.every(Number.isSafeInteger)
    && box[0] <= box[2] && box[1] <= box[3] && box[0] >= 0 && box[1] >= 0
    && box[2] < currentRows[0]!.length && box[3] < currentRows.length
    && points.every(([x, y]) => x < box[0] || x > box[2] || y < box[1] || y > box[3]));
}
