/** Public marked supports, descendants, requests and pose comparisons. */
import { geometricComponents } from './v6-native-observer.ts';
import { linkedPacketDigest as identity } from './v6-linked-packet-numeric.ts';
import { pythonEqual as equal } from './v6-operations.ts';
import type { NativeRows } from './v6-native-types.ts';

type R = Record<string, any>;
type P = number[];
const key = (point: readonly number[]): string => point.join(',');
const cmp = (a: readonly number[], b: readonly number[]): number => {
  for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i]! - b[i]!;
  return a.length - b.length;
};
const distance = (point: readonly number[], center: readonly number[]): number => (point[0]! - center[0]!) ** 2 + (point[1]! - center[1]!) ** 2;
const nearest = (points: P[], center: readonly number[]): P => [...points].sort((a, b) => distance(a, center) - distance(b, center) || cmp(a, b))[0]!;
const numeric = (a: number, b: number): number => a - b;
function counts(values: Iterable<number>): Map<number, number> {
  const result = new Map<number, number>();
  for (const value of values) result.set(value, (result.get(value) ?? 0) + 1);
  return result;
}
function background(rows: NativeRows): number {
  const frequencies = counts(rows.flat()); let choice: number | undefined, largest = -1;
  // Counter.most_common keeps the first encountered value for equal counts.
  for (const [value, count] of frequencies) if (count > largest) { choice = value; largest = count; }
  if (choice === undefined) throw new TypeError('Typed material measurement requires a nonempty public raster');
  return choice;
}

/** Finite native JSON IDs preserve fractions and negative zero, not Python float spelling. */
export const typedMaterialDigest = identity;

export function measureTypedCarriers(rows: NativeRows, observation: R, config: R): R | null {
  const height = rows.length, width = rows[0]!.length, parts = geometricComponents(rows), bg = background(rows), carriers: R[] = [];
  const candidates: { part: (typeof parts)[number]; box: readonly number[]; source: string }[] = [];
  for (const part of parts) {
    candidates.push({ part, box: part.bbox, source: 'component' });
    const [x, y, r, b] = part.bbox, w = r - x + 1, h = b - y + 1;
    if (part.area / (w * h) < config.minimum_body_fill) continue;
    for (const shape of config.observed_body_shapes ?? []) {
      const [sw, sh] = shape.size, cx = (x + r) / 2, cy = (y + b) / 2, left = cx - (sw - 1) / 2, top = cy - (sh - 1) / 2;
      if (sw < w && sh < h && Number.isInteger(left) && Number.isInteger(top)) candidates.push({ part, box: [left, top, left + sw - 1, top + sh - 1], source: 'calibrated_centered_window' });
    }
  }
  const seen = new Set<string>();
  for (const { part, box, source } of candidates) {
    const [x, y, r, b] = box as [number, number, number, number], w = r - x + 1, h = b - y + 1, support: P[] = [], missing: P[] = [];
    for (let v = 0; v < h; v++) for (let u = 0; u < w; u++) (rows[y + v]![x + u] === part.color ? support : missing).push([u, v]);
    if (part.color === bg || !(3 <= w && w <= width / 4 && 3 <= h && h <= height / 4)) continue;
    if (!(config.minimum_body_fill <= support.length / (w * h) && support.length / (w * h) < 1)) continue;
    if (missing.some(([u, v]) => u === 0 || u === w - 1 || v === 0 || v === h - 1)) continue;
    const values = counts(missing.map(([u, v]) => rows[y + v!]![x + u!]!));
    if (values.size < config.minimum_distinct_internal_marks || Math.max(...values.values()) > config.maximum_pixels_per_mark) continue;
    const center = [(x + r) / 2, (y + b) / 2], marks = missing.map(([u, v]) => [rows[y + v!]![x + u!]!, x + u! - center[0]!, y + v! - center[1]!]).sort(cmp);
    const frame = [Math.max(0, x - 1), Math.max(0, y - 1), Math.min(width - 1, r + 1), Math.min(height - 1, b + 1)], fringe: P[] = [];
    for (let v = frame[1]!; v <= frame[3]!; v++) for (let u = frame[0]!; u <= frame[2]!; u++) {
      if (!(x <= u && u <= r && y <= v && v <= b) && rows[v]![u] !== bg) fringe.push([u - center[0]!, v - center[1]!, rows[v]![u]!]);
    }
    const point = nearest(support.map(([u, v]) => [x + u!, y + v!]), center), id = `${key(box)}:${part.color}`;
    if (seen.has(id)) continue;
    seen.add(id);
    carriers.push({ id: identity([observation.level_epoch, box, marks]), bbox: [...box], center, point, body_palette: part.color, marks,
      signature: identity([w, h, marks]), fringe, fringe_signature: identity(fringe), body_ref: part.id, support_source: source,
      calibration_refs: source !== 'component' ? (config.observed_body_shapes ?? []).map((shape: R) => shape.evidence) : [] });
  }
  if (carriers.length < config.minimum_repeated_carriers) return null;
  if (!carriers.length) return null;
  const palettes = carriers.map(carrier => new Set((carrier.marks as P[]).map(mark => mark[0]!)));
  if (![...palettes[0]!].some(value => palettes.every(palette => palette.has(value)))) return null;
  return { carriers, background_hypothesis: bg, source_ref: observation.observation_ref, frame_digest: identity(rows),
    scope: 'Dense supports and typed holes are measured. Selection, compatibility and production are unconfirmed hypotheses.' };
}

export function typedReplacementCandidate(beforeScene: R, later: NativeRows, after: R, config: R): R | null {
  const nextScene = measureTypedCarriers(later, after, { ...config, minimum_repeated_carriers: 1 }), current = (nextScene?.carriers ?? []) as R[];
  const removed = (beforeScene.carriers as R[]).filter(c => !current.some(q => equal(q.bbox, c.bbox) && q.signature === c.signature));
  if (removed.length < 2) return null;
  const parts = geometricComponents(later), bg = background(later), found: R[] = [];
  for (const part of parts) {
    const [x, y, r, b] = part.bbox, w = r - x + 1, h = b - y + 1;
    if (part.color === bg || !(3 <= w && w <= later[0]!.length / 4 && 3 <= h && h <= later.length / 4) || part.area / (w * h) < config.minimum_body_fill) continue;
    if ((beforeScene.carriers as R[]).some(c => equal(c.bbox, part.bbox))) continue;
    const embedded: R[] = [];
    for (const old of removed) {
      const anchors: P[] = [];
      for (let cy = y; cy <= b; cy++) for (let cx = x; cx <= r; cx++) {
        const pixels = (old.marks as P[]).map(([value, dx, dy]) => [Math.trunc(cx + dx!), Math.trunc(cy + dy!), value!]);
        if (pixels.every(([u, v, value]) => x <= u! && u! <= r && y <= v! && v! <= b && later[v!]![u!] === value)) anchors.push([cx, cy]);
      }
      if (!anchors.length) break;
      embedded.push({ source_signature: old.signature, source_id: old.id, possible_anchors: anchors });
    }
    if (embedded.length !== removed.length) continue;
    const center = [(x + r) / 2, (y + b) / 2], point = nearest(part.mask.map(([u, v]) => [x + u, y + v]), center);
    const selected = { id: identity([after.observation_ref, part.bbox, embedded]), bbox: part.bbox, center, point, body_palette: part.color,
      marks: [], signature: identity(embedded), fringe: [], fringe_signature: null, body_ref: part.id, embedded_substructures: embedded };
    found.push({ selected, removed, evidence: [beforeScene.source_ref, after.observation_ref], status: 'material_replacement_with_compatible_embedded_marks' });
  }
  return found.length === 1 ? found[0]! : null;
}

export function typedMaterialDescendants(context: R, before: NativeRows, later: NativeRows, observation: R): R[] {
  const sources = (context.removed ?? []) as R[];
  if (!sources.length) return [];
  const bg = background(later), radius = Math.trunc(Math.max(...sources.flatMap(c => (c.marks as P[]).flatMap(([, dx, dy]) => [Math.abs(dx!), Math.abs(dy!)])))), found: R[] = [];
  for (const source of sources) {
    const hits: R[] = [], typed = new Set((source.marks as P[]).map(mark => mark[0]!));
    for (let y = radius; y < later.length - radius; y++) for (let x = radius; x < later[0]!.length - radius; x++) {
      if (!(source.marks as P[]).every(([value, dx, dy]) => later[Math.trunc(y + dy!)]![Math.trunc(x + dx!)] === value)) continue;
      const box = [x - radius, y - radius, x + radius, y + radius], material: P[] = []; let changed = false;
      for (let v = box[1]!; v <= box[3]!; v++) for (let u = box[0]!; u <= box[2]!; u++) {
        if (before[v]![u] !== later[v]![u]) changed = true;
        if (!typed.has(later[v]![u]!) && later[v]![u] !== bg) material.push([u, v, later[v]![u]!]);
      }
      if (!changed) continue;
      const colors = new Set(material.map(p => p[2]!));
      if (colors.size !== 1) continue;
      const point = nearest(material.map(([u, v]) => [u!, v!]), [x, y]);
      hits.push({ id: identity([observation.observation_ref, box, source.signature]), bbox: box, center: [x, y], point, marks: source.marks,
        core_signature: source.signature, body_palette: [...colors][0], source_ref: observation.observation_ref, source_occurrence: source.id });
    }
    if (!hits.length) return [];
    found.push(...hits);
  }
  const grouped = new Map<string, R[]>();
  for (const child of found) { const id = key(child.center), group = grouped.get(id) ?? []; group.push(child); grouped.set(id, group); }
  const occurrences: R[] = [];
  for (const matches of grouped.values()) {
    const signatures = [...new Set<string>(matches.map(c => c.core_signature))].sort(), patterns = new Set(matches.map(c => identity(c.marks)));
    if (patterns.size !== 1) return [];
    const child = { ...matches[0]! }, origins = [...new Set<string>(matches.map(c => c.source_occurrence))].sort();
    child.compatible_source_occurrences = origins; child.source_occurrence = origins.length === 1 ? origins[0] : null;
    child.lineage_status = origins.length === 1 ? 'unique_observed_match' : 'ambiguous_observed_matches_preserved';
    if (signatures.length > 1) child.core_signature = identity(['ambiguous_source_core_extents', signatures]);
    occurrences.push(child);
  }
  return occurrences;
}

export function typedMaterialRequests(rows: NativeRows, observation: R, knownShapes: readonly P[] = []): R[] {
  const bg = background(rows), found: R[] = [];
  for (const part of geometricComponents(rows)) {
    const [x, y, r, b] = part.bbox, w = r - x + 1, h = b - y + 1;
    if (!(5 <= w && w <= rows[0]!.length / 4 && 5 <= h && h <= rows.length / 4)) continue;
    const border = new Set<string>();
    for (let v = 0; v < h; v++) for (let u = 0; u < w; u++) if (u === 0 || u === w - 1 || v === 0 || v === h - 1) border.add(key([u, v]));
    if (part.mask.length !== border.size || !part.mask.every(point => border.has(key(point)))) continue;
    const inner: P[] = [];
    for (let v = y + 1; v < b; v++) for (let u = x + 1; u < r; u++) inner.push([u, v, rows[v]![u]!]);
    const values = new Set(inner.map(p => p[2]!)), pigments = [...values].filter(value => value !== bg);
    if (!values.has(bg) || pigments.length !== 1) continue;
    const pigment = pigments[0]!, pixels = inner.filter(p => p[2] === pigment).map(p => [p[0]!, p[1]!]);
    if (!pixels.length) continue;
    const left = Math.min(...pixels.map(p => p[0]!)), top = Math.min(...pixels.map(p => p[1]!)), right = Math.max(...pixels.map(p => p[0]!)), bottom = Math.max(...pixels.map(p => p[1]!));
    const mask = pixels.map(([u, v]) => [u! - left, v! - top]).sort(cmp), descriptor = { palette: pigment, width: right - left + 1, height: bottom - top + 1, mask };
    const point = nearest(pixels, [(x + r) / 2, (y + b) / 2]);
    found.push({ id: identity([observation.level_epoch, part.bbox]), bbox: part.bbox, point, descriptor, source_ref: observation.observation_ref });
  }
  const shape = (q: R): P => [q.bbox[2] - q.bbox[0], q.bbox[3] - q.bbox[1]], groups = new Map<string, number>();
  for (const q of found) { const id = key(shape(q)); groups.set(id, (groups.get(id) ?? 0) + 1); }
  return found.filter(q => groups.get(key(shape(q)))! >= 2 || knownShapes.some(s => equal(s, shape(q))));
}

export function typedChildPresent(child: R, rows: NativeRows): boolean {
  const [x, y] = child.center;
  return (child.marks as P[]).every(([value, dx, dy]) => {
    const v = Math.trunc(y + dy!), u = Math.trunc(x + dx!);
    return 0 <= v && v < rows.length && 0 <= u && u < rows[0]!.length && rows[v]![u] === value;
  });
}

export function typedLocalChildMark(child: R, first: NativeRows, later: NativeRows): boolean {
  const [x, y, r, b] = child.bbox, margin = Math.max(r - x + 1, b - y + 1); let changed = false;
  if (!typedChildPresent(child, later)) return false;
  for (let v = 0; v < first.length; v++) for (let u = 0; u < first[v]!.length; u++) if (first[v]![u] !== later[v]![u]) {
    changed = true;
    if (!(x - margin <= u && u <= r + margin && y - margin <= v && v <= b + margin && !(x <= u && u <= r && y <= v && v <= b))) return false;
  }
  return changed;
}

export function typedSmallParts(rows: NativeRows): R[] {
  const bg = background(rows), result: R[] = [];
  for (const part of geometricComponents(rows)) {
    const [x, y, r, b] = part.bbox, w = r - x + 1, h = b - y + 1;
    if (part.color === bg || part.rectangular || Math.min(w, h) < 3 || Math.max(w, h) > Math.max(rows.length, rows[0]!.length) / 4) continue;
    result.push({ bbox: part.bbox, color: part.color, mask: part.mask.map(p => [...p]).sort(cmp) });
  }
  return result;
}

export function novelTypedControls(old: readonly R[], rows: NativeRows, observation: R, config: R): [R[], R[]] {
  const current = typedSmallParts(rows), seen = new Set(old.map(p => identity(p))), scene = measureTypedCarriers(rows, observation, config);
  const boxes = [...typedMaterialRequests(rows, observation), ...((scene?.carriers ?? []) as R[])].map(q => q.bbox), novel: R[] = [];
  for (const part of current) {
    const [x, y, r, b] = part.bbox;
    if (seen.has(identity(part)) || boxes.some(([l, t, rr, bb]) => !(r < l - 3 || x > rr + 3 || b < t - 3 || y > bb + 3))) continue;
    novel.push(part);
  }
  const groups: Map<string, P>[] = [];
  for (const part of novel) {
    const support = new Map<string, P>((part.mask as P[]).map(([u, v]) => { const point = [part.bbox[0] + u!, part.bbox[1] + v!]; return [key(point), point]; }));
    const touch: number[] = [];
    for (const [i, group] of groups.entries()) if ([...support.values()].some(([u, v]) => [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => group.has(key([u! + dx!, v! + dy!]))))) touch.push(i);
    for (const i of touch.reverse()) { for (const [id, point] of groups[i]!) support.set(id, point); groups.splice(i, 1); }
    groups.push(support);
  }
  const result: R[] = [];
  for (const pixels of groups) {
    const points = [...pixels.values()], x = Math.min(...points.map(p => p[0]!)), y = Math.min(...points.map(p => p[1]!)), r = Math.max(...points.map(p => p[0]!)), b = Math.max(...points.map(p => p[1]!));
    const point = nearest(points, [(x + r) / 2, (y + b) / 2]);
    result.push({ bbox: [x, y, r, b], point, projection: rows.slice(y, b + 1).map(row => row.slice(x, r + 1)), source_ref: observation.observation_ref,
      epoch: observation.level_epoch, status: 'uncharacterized_new_scope_control_candidate' });
  }
  return [result, current];
}

export function rotatedTypedMarks(marks: readonly P[], turns: number): P[] {
  let result = marks.map(mark => [...mark]);
  for (let i = 0; i < ((turns % 4) + 4) % 4; i++) result = result.map(([value, dx, dy]) => [value!, -dy!, dx!]);
  return result.sort(cmp);
}

export function currentTypedMarks(child: R, rows: NativeRows): P[] | null {
  const [cx, cy] = child.center, [x, y, r, b] = child.bbox, result: P[] = [];
  for (const value of [...new Set<number>((child.marks as P[]).map(mark => mark[0]!))].sort(numeric)) {
    const points: P[] = [];
    for (let v = y; v <= b; v++) for (let u = x; u <= r; u++) if (rows[v]![u] === value) points.push([u, v]);
    if (points.length !== 1) return null;
    result.push([value, points[0]![0]! - cx, points[0]![1]! - cy]);
  }
  return result.sort(cmp);
}

export function outsideTypedDigest(rows: NativeRows, ...boxes: readonly P[]): string {
  const values: P[] = [];
  for (let v = 0; v < rows.length; v++) for (let u = 0; u < rows[v]!.length; u++) if (!boxes.some(([x, y, r, b]) => x! <= u && u <= r! && y! <= v && v <= b!)) values.push([u, v, rows[v]![u]!]);
  return identity(values);
}

export function typedControlMatches(control: R, rows: NativeRows, epoch: number): boolean {
  const [x, y, r, b] = control.bbox;
  return epoch === control.epoch && equal(rows.slice(y, b + 1).map(row => row.slice(x, r + 1)), control.projection);
}
