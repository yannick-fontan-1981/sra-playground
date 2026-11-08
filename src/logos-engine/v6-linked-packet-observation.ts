/** Public support and dated-front measurements from the pinned V6 source. */
import { geometricComponents } from './v6-native-observer.ts';
import { symbolicDigest as identity } from './v6-hash.ts';
import { pythonEqual as equal } from './v6-operations.ts';
import type { NativeRows } from './v6-native-types.ts';

type R = Record<string, any>;
type Point = [number, number];
const range = (first: number, last: number): number[] => Array.from({ length: Math.max(0, last - first + 1) }, (_, index) => first + index);

/** The consumed unoccluded, equal-color branch of revalidate_frame. */
export function linkedFrameSupport(rows: NativeRows): number[] | null {
  const candidates = geometricComponents(rows).filter(part => {
    const [left, top, right, bottom] = part.bbox, width = right - left + 1, height = bottom - top + 1;
    if (Math.min(width, height) < 8 || part.area < 2 * width + 2 * height - 4) return false;
    let corners = 0, measured = 0;
    for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) {
      if (x !== left && x !== right && y !== top && y !== bottom) continue;
      if (rows[y]![x] !== part.color) return false;
      measured++; if ((x === left || x === right) && (y === top || y === bottom)) corners++;
    }
    return corners >= 2 && measured >= right - left + bottom - top;
  });
  if (!candidates.length) return null;
  const area = (part: R): number => (part.bbox[2] - part.bbox[0]) * (part.bbox[3] - part.bbox[1]);
  const largest = Math.max(...candidates.map(area)), best = candidates.filter(part => area(part) === largest);
  return best.length === 1 ? [...best[0]!.bbox] : null;
}

export function mergeLinkedBoxes(boxes: readonly number[][]): number[][] {
  const groups: number[][][] = [];
  for (const box of boxes) {
    const matching = groups.filter(group => group.some(other => !(box[2]! < other[0]! - 1 || other[2]! < box[0]! - 1 || box[3]! < other[1]! - 1 || other[3]! < box[1]! - 1)));
    const combined = [box];
    for (const group of matching) { combined.push(...group); groups.splice(groups.indexOf(group), 1); }
    groups.push(combined);
  }
  return groups.map(group => [Math.min(...group.map(box => box[0]!)), Math.min(...group.map(box => box[1]!)), Math.max(...group.map(box => box[2]!)), Math.max(...group.map(box => box[3]!))]);
}

export function linkedForegroundGroups(rows: NativeRows, background: number, bounds: readonly number[]): Point[][] {
  const [left, top, right, bottom] = bounds as [number, number, number, number], seen = new Set<string>(), groups: Point[][] = [];
  for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) {
    if (seen.has(`${x},${y}`) || rows[y]![x] === background) continue;
    const todo: Point[] = [[x, y]], points: Point[] = []; seen.add(`${x},${y}`);
    while (todo.length) {
      const [xx, yy] = todo.pop()!; points.push([xx, yy]);
      for (const dx of [-1, 0, 1]) for (const dy of [-1, 0, 1]) {
        const q: Point = [xx + dx, yy + dy], key = q.join(',');
        if (left <= q[0] && q[0] <= right && top <= q[1] && q[1] <= bottom && !seen.has(key) && rows[q[1]]![q[0]] !== background) {
          seen.add(key); todo.push(q);
        }
      }
    }
    groups.push(points);
  }
  return groups;
}

export function measureLinkedScene(rows: NativeRows): R | null {
  const frame = linkedFrameSupport(rows);
  if (!frame) return null;
  const [left, top, right, bottom] = frame as [number, number, number, number], counts = new Map<number, number>();
  for (let y = top + 1; y < bottom; y++) for (let x = left + 1; x < right; x++) counts.set(rows[y]![x]!, (counts.get(rows[y]![x]!) ?? 0) + 1);
  const peak = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2);
  if (peak.length < 2 || peak[0]![1] === peak[1]![1]) return null;
  const background = peak[0]![0], limit = Math.min(right - left, bottom - top) / 3;
  const inside: number[][] = [], outside: number[][] = [], cores: R[] = [];
  for (const part of geometricComponents(rows)) {
    const [a, c, z, d] = part.bbox, width = z - a + 1, height = d - c + 1;
    if (part.color === background || Math.min(width, height) < 3 || Math.max(width, height) > limit || part.area < width * height * 0.4) continue;
    if (left < a && a <= z && z < right && top < c && c <= d && d < bottom) { inside.push([...part.bbox]); cores.push(part); }
    else if (z < left || a > right || d < top || c > bottom) { if (part.area < width * height) outside.push([...part.bbox]); }
  }
  for (const points of linkedForegroundGroups(rows, background, [left + 1, top + 1, right - 1, bottom - 1])) {
    const box = [Math.min(...points.map(p => p[0])), Math.min(...points.map(p => p[1])), Math.max(...points.map(p => p[0])), Math.max(...points.map(p => p[1]))];
    const width = box[2]! - box[0]! + 1, height = box[3]! - box[1]! + 1;
    if (Math.min(width, height) >= 3 && Math.max(width, height) <= limit && points.length >= 4) inside.push(box);
  }
  const objects: R[] = [];
  for (let box of mergeLinkedBoxes(inside)) {
    const extent = [...box], contained = cores.filter(part => box[0]! <= part.bbox[0] && part.bbox[0] <= part.bbox[2] && part.bbox[2] <= box[2]! && box[1]! <= part.bbox[1] && part.bbox[1] <= part.bbox[3] && part.bbox[3] <= box[3]!);
    if (contained.length) {
      const largest = Math.max(...contained.map(part => part.area)), best = contained.filter(part => part.area === largest);
      const centers = new Set(best.map(part => [Math.floor((part.bbox[0] + part.bbox[2] + 1) / 2), Math.floor((part.bbox[1] + part.bbox[3] + 1) / 2)].join(',')));
      if (centers.size !== 1) return null;
      box = [...best[0]!.bbox];
    }
    const [a, c, z, d] = box as [number, number, number, number], point = [Math.floor((a + z + 1) / 2), Math.floor((c + d + 1) / 2)];
    objects.push({ bbox: box, point, ref: 'support:' + identity(box), shape: range(c, d).map(y => range(a, z).map(x => Number(rows[y]![x] !== background))),
      connected_extent_bbox: extent, center_scope: contained.length ? 'largest measured compact core, attached thin continuation kept separately' : 'compact connected support extent' });
  }
  const controls: R[] = [];
  for (const box of mergeLinkedBoxes(outside)) {
    const [a, c, z, d] = box as [number, number, number, number], point = [Math.floor((a + z + 1) / 2), Math.floor((c + d + 1) / 2)];
    const radius = Math.floor((Math.max(z - a + 1, d - c + 1) + 1) / 2);
    if (point[0]! - radius < 0 || point[1]! - radius < 0 || point[0]! + radius >= rows[0]!.length || point[1]! + radius >= rows.length) continue;
    controls.push({ bbox: box, point, radius, ref: 'control:' + identity(box) });
  }
  if (!controls.length || objects.length < 2) return null;
  return { frame, background, objects, controls, scope: 'Outside compact motifs as possible controls, inside supports as possible recipients. No palette roles, game identity or optical law.' };
}

export function linkedPhase(rows: NativeRows, control: R, occlusion: readonly number[][] = []): string {
  const [x, y] = control.point, radius = control.radius, masked = new Set(occlusion.map(point => point.join(',')));
  return identity(range(-radius, radius).map(dy => range(-radius, radius).map(dx => masked.has(`${dx},${dy}`) ? null : rows[y + dy]![x + dx])));
}
export function changedLinkedSupports(before: NativeRows, after: NativeRows, measurement: R): R[] {
  return measurement.objects.filter((object: R) => range(object.bbox[1], object.bbox[3]).some(y => range(object.bbox[0], object.bbox[2]).some(x => before[y]![x] !== after[y]![x])));
}
export function linkedSelectionRecipient(before: NativeRows, after: NativeRows, affected: readonly R[], previous: R | null): [R | null, R] {
  if (affected.length === 1) return [affected[0]!, { kind: 'single_cochanged_support' }];
  if (affected.length !== 2 || !previous || !affected.some(object => object.ref === previous.ref)) return [null, { kind: 'ambiguous_cochange' }];
  const current = affected.find(object => object.ref !== previous.ref)!, [x, y] = previous.point, [u, v] = current.point;
  const old = [before[y]![x], after[y]![x]], next = [before[v]![u], after[v]![u]];
  if (old[0] !== old[1] && old[0] === next[1] && old[1] === next[0]) return [current, { kind: 'reciprocal_center_decoration_replacement', previous_ref: previous.ref,
    current_ref: current.ref, previous_values: old, current_values: next }];
  return [null, { kind: 'cochange_without_reciprocal_decoration' }];
}

export function linkedTargetMarker(rows: NativeRows, measurement: R): R | null {
  const result = measurement.objects.filter((object: R) => {
    const [x, y] = object.point, values = [[0, 1], [0, -1], [1, 0], [-1, 0]].map(([dx, dy]) => rows[y + dy!]![x + dx!]);
    return new Set(values).size === 1 && values[0] === measurement.background && rows[y]![x] !== values[0];
  });
  return result.length === 1 ? result[0] : null;
}

export function fitLinkedLine(points: readonly number[][]): R | null {
  if (points.length < 2) return null;
  const mx = points.reduce((sum, p) => sum + p[0]!, 0) / points.length, my = points.reduce((sum, p) => sum + p[1]!, 0) / points.length;
  const xx = points.reduce((sum, p) => sum + (p[0]! - mx) ** 2, 0), yy = points.reduce((sum, p) => sum + (p[1]! - my) ** 2, 0);
  const xy = points.reduce((sum, p) => sum + (p[0]! - mx) * (p[1]! - my), 0), theta = Math.atan2(2 * xy, xx - yy) / 2;
  const vx = Math.cos(theta), vy = Math.sin(theta), transverse = Math.max(...points.map(p => Math.abs((p[0]! - mx) * vy - (p[1]! - my) * vx)));
  const along = points.map(p => (p[0]! - mx) * vx + (p[1]! - my) * vy), extent = Math.max(...along) - Math.min(...along);
  if (transverse > 1 || extent < 1) return null;
  return { center: [mx, my], axis: [vx, vy], transverse_error_pixels: transverse, extent };
}

export function measureLinkedPacket(before: NativeRows, frames: readonly NativeRows[], observationRef: string, actionRef: string): R {
  const bounds = linkedFrameSupport(before);
  if (!bounds) return { status: 'unknown', reason: 'unique_frame_support_not_measured' };
  const [left, top, right, bottom] = bounds as [number, number, number, number], area = (right - left - 1) * (bottom - top - 1);
  let previous = before, active: R | null = null;
  const events: R[] = [], runs: R[] = [];
  for (const [tick, frame] of frames.entries()) {
    if (frame.length !== before.length || frame.some((row, index) => row.length !== before[index]!.length)) return { status: 'unknown', reason: 'packet_dimensions_changed' };
    const byColor = new Map<number, number[][]>();
    for (let y = top + 1; y < bottom; y++) for (let x = left + 1; x < right; x++) if (frame[y]![x] !== previous[y]![x]) {
      const value = frame[y]![x]!, points = byColor.get(value) ?? []; points.push([x, y]); byColor.set(value, points);
    }
    const count = [...byColor.values()].reduce((sum, points) => sum + points.length, 0), event: R = { frame_index: tick, changed_pixels: count, frame_digest: identity(frame), fronts: [] };
    if (count > area / 4) { event.kind = 'broad_field_change'; active = null; }
    else {
      for (const [value, points] of byColor) {
        const fit = fitLinkedLine(points);
        if (!fit) continue;
        event.fronts.push({ value, count: points.length, ...fit });
        if (active && active.value === value) {
          const merged = [...active.points, ...points], whole = fitLinkedLine(merged);
          if (whole) {
            const dx = fit.center[0] - active.last_center[0], dy = fit.center[1] - active.last_center[1];
            if (Math.hypot(dx, dy) > 0) { active.points = merged; active.last_center = fit.center; active.end_frame = tick; active.fit = whole; continue; }
          }
        }
        active = { value, points: [...points], first_center: fit.center, last_center: fit.center, start_frame: tick, end_frame: tick, fit }; runs.push(active);
      }
      if (count && !event.fronts.length) active = null;
    }
    events.push(event); previous = frame;
  }
  const measured: R[] = [];
  for (const run of runs) {
    if (run.end_frame <= run.start_frame) continue;
    const dx = run.last_center[0] - run.first_center[0], dy = run.last_center[1] - run.first_center[1];
    if (Math.hypot(dx, dy) < 2) continue;
    let [vx, vy] = run.fit.axis;
    if (vx * dx + vy * dy < 0) { vx = -vx; vy = -vy; }
    const points = [...run.points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    measured.push({ value: run.value, start_frame: run.start_frame, end_frame: run.end_frame, first_center: run.first_center, last_center: run.last_center,
      direction: [vx, vy], extent: run.fit.extent, transverse_error_pixels: run.fit.transverse_error_pixels, support_digest: identity(points) });
  }
  return { status: measured.length ? 'measured' : 'unknown', observation_ref: observationRef, action_ref: actionRef, bounds, frame_count: frames.length,
    canonical_equal_initial: Boolean(frames.length && equal(frames.at(-1), before)), events, segments: measured,
    scope: 'Dated collinear growing fronts only. No reflection/reemission, receiver identity, control law or reset semantics is inferred from returning to the initial image.' };
}

export function linkedSegmentFor(body: R, segments: readonly R[]): R | null {
  const [x, y] = body.point, size = Math.max(body.bbox[2] - body.bbox[0] + 1, body.bbox[3] - body.bbox[1] + 1);
  const candidates = segments.filter(segment => {
    const [a, b] = segment.first_center, [vx, vy] = segment.direction, dx = a - x, dy = b - y;
    return 0 <= dx * vx + dy * vy && dx * vx + dy * vy <= 2 * size && Math.abs(dx * vy - dy * vx) <= 1.2;
  });
  return candidates.length === 1 ? candidates[0]! : null;
}
