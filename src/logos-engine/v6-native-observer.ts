/**
 * Mechanical transfer of V6 geometric_observer/neutral_observer and
 * observed_input_domain, plus V5 capabilities/components.py. No game role,
 * game identifier, state accessor or action meaning enters these measurements.
 * Reference: 786dcf51ca57773d8e3a8948ce9ea3655e7baf8e.
 */
import { assertPortableNumber, canonical } from './canonical.ts';
import type { NativeRows as SharedRows, NativePoint, NativeBox, NativeEntity, NativeObservation } from './v6-native-types.ts';

export type NativeRows = SharedRows;
export type Pixel = NativePoint;
export type PixelBox = NativeBox;
export interface GeometricComponent {
  id: string; color: number; bbox: PixelBox; area: number; scale: number;
  mask: readonly Pixel[]; normalized: readonly Pixel[]; rectangular: boolean;
}
export interface MeasuredEntity extends NativeEntity {
  id: string; signature: string; position: Pixel; bbox: PixelBox; area: number;
  scale: number; mask: readonly Pixel[]; palette_value: number; rectangular: boolean;
  identity_ambiguous: boolean; identity_scope: 'monochrome_component_not_physical_object';
}
export interface MeasuredObservation extends NativeObservation {
  revision: number; level_epoch: number; frame_hash: string; observation_ref: string;
  coordinate_basis: 'screen'; entities: readonly MeasuredEntity[];
  available_action_refs: readonly string[]; state: string; levels_completed: number;
  unknowns: readonly string[]; provenance: 'public_frame_connected_components_only';
}
export interface ObserverPublicPacket {
  frame_rows: NativeRows; frame_hash: string; level: number;
  levels_completed: number; state: string; available_action_refs: readonly string[];
}
export interface V5BoundingBox { top: number; left: number; bottom: number; right: number; height: number; width: number }
export interface V5Component {
  component_id: string; value: number; pixels: readonly Pixel[];
  relative_pixels: readonly Pixel[]; bbox: V5BoundingBox; area: number;
  touches_frame_boundary: boolean; schema_version: 'yf_arc3_v5.component_description.v1';
}
export interface V5ComponentExtraction {
  components: readonly V5Component[];
  schema_version: 'yf_arc3_v5.component_extraction_result.v1';
}
export interface MeasuredCommand { action_ref: string; data: Record<string, number> }
export interface LocusWitness {
  observation_ref: string; level_epoch: number; frame_hash: string; entity_ref: string;
  signature: string; bbox: readonly number[]; palette_value: number; point: readonly number[];
  total_occurrences?: number; sampled_occurrences?: number; projection_bbox?: readonly number[];
  projected_rows_digest?: string; scope?: string; reason?: string; evidence?: readonly string[];
}

const comparePixel = (a: Pixel, b: Pixel) => a[0] - b[0] || a[1] - b[1];
const pixelKey = (x: number, y: number) => `${x},${y}`;
// Preserve the source traversal order without allocating neighbor coordinate
// pairs for every visited pixel. These offsets are private to the measurement.
const FOUR_NEIGHBOR_OFFSETS = [-1, 0, 1, 0, 0, -1, 0, 1] as const;
const EIGHT_NEIGHBOR_OFFSETS = [-1, -1, 0, -1, 1, -1, -1, 0, 1, 0, -1, 1, 0, 1, 1, 1] as const;
const gcd = (a: number, b: number): number => { while (b) [a, b] = [b, a % b]; return a; };
async function sha256(bytes: Uint8Array): Promise<string> {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', Uint8Array.from(bytes)))].map(value => value.toString(16).padStart(2, '0')).join('');
}
/** Python compact sorted JSON with ensure_ascii=True, on the exact integer domain. */
export function v6Canonical(value: unknown): string {
  return canonical(value).replace(/[\u007f-\uffff]/g, character => `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`);
}
export async function v6Digest(value: unknown): Promise<string> {
  return sha256(new TextEncoder().encode(v6Canonical(value)));
}
export async function publicFrameHash(rows: NativeRows): Promise<string> {
  validateRows(rows);
  return (await sha256(new TextEncoder().encode(JSON.stringify(rows)))).slice(0, 16);
}

/** Explicit browser measurement domain; no truncation or palette remapping. */
export function validateRows(rows: NativeRows): void {
  const width = rows[0]?.length ?? 0;
  if (!Array.isArray(rows) || rows.length === 0 || width === 0 || rows.length * width > 65_536 ||
      rows.some(row => !Array.isArray(row) || row.length !== width || row.some(value => !Number.isSafeInteger(value) || value < 0 || value > 255))) {
    throw new TypeError('A rectangular public palette matrix of at most 65536 pixels is required');
  }
}

/** NumPy np.uint8 rows_digest: repr(shape) followed by C-order bytes. */
export async function rowsDigest(rows: NativeRows): Promise<string> {
  const height = rows.length, width = rows[0]?.length ?? 0;
  if (rows.some(row => row.length !== width)) throw new TypeError('Projection must be rectangular');
  const prefix = new TextEncoder().encode(`(${height}, ${width})`);
  const bytes = new Uint8Array(prefix.length + height * width); bytes.set(prefix);
  let index = prefix.length;
  for (const row of rows) for (const value of row) {
    if (!Number.isSafeInteger(value) || value < 0 || value > 255) throw new TypeError('Projection palette outside public uint8 domain');
    bytes[index++] = value;
  }
  return sha256(bytes);
}
export function projection(rows: NativeRows, box: readonly number[]): number[][] {
  if (box.length !== 4 || box.some(value => !Number.isSafeInteger(value))) throw new TypeError('Invalid projection box');
  const [x, y, right, bottom] = box as [number, number, number, number];
  return rows.slice(y, bottom + 1).map(row => row.slice(x, right + 1));
}

/** V6 masks are relative [x,y] pairs, unlike V5 pixels ([row,column]). */
export function geometricComponents(rows: NativeRows, connectivity: 4 | 8 = 4): GeometricComponent[] {
  validateRows(rows);
  if (connectivity !== 4 && connectivity !== 8) throw new TypeError('Connectivity must be 4 or 8');
  const height = rows.length, width = rows[0]!.length;
  const offsets = connectivity === 4 ? FOUR_NEIGHBOR_OFFSETS : EIGHT_NEIGHBOR_OFFSETS;
  const seen = new Uint8Array(height * width), result: GeometricComponent[] = [];
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const origin = y * width + x;
    if (seen[origin]) continue;
    const color = rows[y]![x]!, pending: number[] = [origin], pixels: number[] = [];
    seen[origin] = 1;
    let left = x, right = x, top = y, bottom = y;
    while (pending.length) {
      const current = pending.pop()!, px = current % width, py = Math.floor(current / width);
      pixels.push(current); left = Math.min(left, px); right = Math.max(right, px);
      top = Math.min(top, py); bottom = Math.max(bottom, py);
      for (let neighbor = 0; neighbor < offsets.length; neighbor += 2) {
        const nx = px + offsets[neighbor]!, ny = py + offsets[neighbor + 1]!;
        const index = ny * width + nx;
        if (nx >= 0 && nx < width && ny >= 0 && ny < height && !seen[index] && rows[ny]![nx] === color) {
          seen[index] = 1; pending.push(index);
        }
      }
    }
    const mask: Pixel[] = pixels.map(index => [index % width - left, Math.floor(index / width) - top] as Pixel).sort(comparePixel);
    // The Python observer takes the GCD of every horizontal AND vertical run.
    const axes: [Map<number, number[]>, Map<number, number[]>] = [new Map(), new Map()];
    for (const [px, py] of mask) {
      const horizontal = axes[0].get(py) ?? []; horizontal.push(px); axes[0].set(py, horizontal);
      const vertical = axes[1].get(px) ?? []; vertical.push(py); axes[1].set(px, vertical);
    }
    let scale = 0;
    for (const lines of axes) for (const line of lines.values()) {
      line.sort((a, b) => a - b);
      let run = 1;
      for (let i = 1; i < line.length; i++) {
        if (line[i] === line[i - 1]! + 1) run++;
        else { scale = gcd(scale, run); run = 1; }
      }
      scale = gcd(scale, run);
    }
    scale ||= 1;
    const normalizedMap = new Map<string, Pixel>();
    for (const [px, py] of mask) {
      const nx = Math.floor(px / scale), ny = Math.floor(py / scale);
      normalizedMap.set(pixelKey(nx, ny), [nx, ny]);
    }
    result.push({ id: `component-${result.length}`, color, bbox: [left, top, right, bottom], area: pixels.length,
      scale, mask, normalized: [...normalizedMap.values()].sort(comparePixel),
      rectangular: pixels.length === (right - left + 1) * (bottom - top + 1) });
  }
  return result;
}

export function rotateMask(mask: readonly Pixel[], turns = 1): Pixel[] {
  let result = [...mask];
  for (let i = 0; i < ((turns % 4) + 4) % 4; i++) {
    const height = Math.max(...result.map(([, y]) => y)) + 1;
    result = result.map(([x, y]) => [height - 1 - y, x] as Pixel);
  }
  return result.sort(comparePixel);
}
function sameMask(a: readonly Pixel[], b: readonly Pixel[]): boolean {
  return a.length === b.length && a.every((p, i) => p[0] === b[i]![0] && p[1] === b[i]![1]);
}
export function geometricCorrespondences(parts: readonly GeometricComponent[]) {
  const result = [];
  for (let index = 0; index < parts.length; index++) {
    const a = parts[index]!;
    if (a.rectangular) continue;
    for (const b of parts.slice(index + 1)) {
      const turns = [0, 1, 2, 3].filter(turn => sameMask(rotateMask(a.normalized, turn), b.normalized));
      if (turns.length) result.push({ first: a.id, second: b.id, quarter_turns: turns, same_color: a.color === b.color,
        scale_ratio: [a.scale, b.scale], orientation_already_equal: turns.includes(0) });
    }
  }
  return result;
}
export function geometricTransitions(before: readonly GeometricComponent[], after: readonly GeometricComponent[]) {
  const changes = [];
  for (const a of before) {
    const matches = [];
    for (const b of after) {
      if (a.color !== b.color) continue;
      const turns = [0, 1, 2, 3].filter(turn => sameMask(rotateMask(a.normalized, turn), b.normalized));
      if (turns.length && a.area === b.area) matches.push({ after: b.id,
        translation: [b.bbox[0] - a.bbox[0], b.bbox[1] - a.bbox[1]], quarter_turns: turns,
        scale_preserved: a.scale === b.scale });
    }
    if (matches.length === 1) {
      const match = matches[0]!;
      if (match.translation[0] !== 0 || match.translation[1] !== 0 || !match.quarter_turns.includes(0)) {
        changes.push({ before: a.id, ...match, attribution: 'observed_difference_not_causal_proof' });
      }
    }
  }
  return changes;
}

/**
 * Private closed record built only from geometricComponents below. Its area,
 * scale and normalized coordinates are bounded integers produced after raster
 * validation. Constant ASCII keys follow the exact canonical order, so direct
 * JSON has the same bytes without revalidating every freshly constructed pair.
 * Keep the palette scalar check: validateRows admits -0, whereas the original
 * canonical signature rejects it. Public v6Canonical/v6Digest stay unchanged.
 */
function measuredComponentSignature(part: GeometricComponent): Promise<string> {
  assertPortableNumber(part.color);
  const text = JSON.stringify({ area: part.area, normalized_mask: part.normalized,
    palette_value: part.color, scale: part.scale });
  return sha256(new TextEncoder().encode(text));
}

export async function measureNativeObservation(publicPacket: ObserverPublicPacket, revision: number, scope = 'neutral'): Promise<MeasuredObservation> {
  if (!Number.isSafeInteger(revision) || revision < 0) throw new TypeError('Observation revision must be an integer');
  const parts = geometricComponents(publicPacket.frame_rows);
  const signatures = await Promise.all(parts.map(measuredComponentSignature));
  const counts = new Map<string, number>(), ordinal = new Map<string, number>();
  for (const signature of signatures) counts.set(signature, (counts.get(signature) ?? 0) + 1);
  const entities = parts.map((part, index): MeasuredEntity => {
    const signature = signatures[index]!, occurrence = ordinal.get(signature) ?? 0;
    ordinal.set(signature, occurrence + 1);
    return { id: `component:${signature.slice(0, 16)}:${occurrence}`, signature,
      position: [part.bbox[0], part.bbox[1]], bbox: part.bbox, area: part.area, scale: part.scale,
      mask: part.mask, palette_value: part.color, rectangular: part.rectangular,
      identity_ambiguous: counts.get(signature)! > 1, identity_scope: 'monochrome_component_not_physical_object' };
  });
  return { revision, level_epoch: publicPacket.level, frame_hash: publicPacket.frame_hash,
    observation_ref: `${scope}:epoch:${publicPacket.level}:revision:${revision}:frame:${publicPacket.frame_hash}`,
    coordinate_basis: 'screen', entities, available_action_refs: [...publicPacket.available_action_refs],
    state: publicPacket.state, levels_completed: publicPacket.levels_completed,
    unknowns: ['physical_object_roles', 'terminal_objective', 'input_semantics', 'logical_lattice'],
    provenance: 'public_frame_connected_components_only' };
}

export function nativeObservationDelta(before: NativeObservation, after: NativeObservation,
  beforeParts: readonly GeometricComponent[], afterParts: readonly GeometricComponent[], action: unknown) {
  return { action, before_hash: before.frame_hash, after_hash: after.frame_hash,
    before_revision: before.revision, after_revision: after.revision,
    pixel_hash_changed: before.frame_hash !== after.frame_hash,
    component_count_before: before.entities.length, component_count_after: after.entities.length,
    geometric_correspondences: geometricTransitions(beforeParts, afterParts),
    official_level_delta: after.levels_completed - before.levels_completed,
    interpretation: 'observed differences; no causal control, contact, goal or reversibility established by pixels alone' };
}
export function nativeObservationSummary(observation: NativeObservation) {
  return { revision: observation.revision, level_epoch: observation.level_epoch,
    frame_hash: observation.frame_hash, state: observation.state, levels_completed: observation.levels_completed,
    unknowns: observation.unknowns, component_count: observation.entities.length,
    unambiguous_signature_components: observation.entities.filter(entity => !entity.identity_ambiguous).length };
}

/** V5 component identifiers are shape-only; equal shapes share ordinal counters. */
export async function detectV5Components(rows: NativeRows, connectivity: 4 | 8 = 4): Promise<V5ComponentExtraction> {
  validateRows(rows);
  if (connectivity !== 4 && connectivity !== 8) throw new TypeError('Connectivity must be 4 or 8');
  const height = rows.length, width = rows[0]!.length, seen = new Uint8Array(height * width);
  const components: V5Component[] = [], instances = new Map<string, number>(), hashes = new Map<string, string>();
  const directions: readonly Pixel[] = connectivity === 4 ? [[-1, 0], [0, -1], [0, 1], [1, 0]]
    : [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
  for (let row = 0; row < height; row++) for (let column = 0; column < width; column++) {
    const origin = row * width + column;
    if (seen[origin]) continue;
    const value = rows[row]![column]!, pending = [origin], pixels: Pixel[] = [];
    seen[origin] = 1;
    let top = row, left = column, bottom = row, right = column;
    while (pending.length) {
      const current = pending.pop()!, y = Math.floor(current / width), x = current % width;
      pixels.push([y, x]); top = Math.min(top, y); bottom = Math.max(bottom, y); left = Math.min(left, x); right = Math.max(right, x);
      for (const [dy, dx] of directions) {
        const ny = y + dy, nx = x + dx, next = ny * width + nx;
        if (ny >= 0 && nx >= 0 && ny < height && nx < width && !seen[next] && rows[ny]![nx] === value) {
          seen[next] = 1; pending.push(next);
        }
      }
    }
    pixels.sort(comparePixel);
    const relative_pixels = pixels.map(([y, x]) => [y - top, x - left] as Pixel);
    const shape = JSON.stringify(relative_pixels), instance = (instances.get(shape) ?? 0) + 1;
    instances.set(shape, instance);
    let shapeHash = hashes.get(shape);
    if (!shapeHash) { shapeHash = (await v6Digest(relative_pixels)).slice(0, 8); hashes.set(shape, shapeHash); }
    const h = bottom - top + 1, w = right - left + 1;
    components.push({ component_id: `${connectivity === 4 ? 'block' : 'zone'}.shape_${h}x${w}.area_${pixels.length}.pattern_${shapeHash}.instance_${String(instance).padStart(3, '0')}`,
      value, pixels, relative_pixels, bbox: { top, left, bottom, right, height: h, width: w }, area: pixels.length,
      touches_frame_boundary: top === 0 || left === 0 || bottom === height - 1 || right === width - 1,
      schema_version: 'yf_arc3_v5.component_description.v1' });
  }
  return { components, schema_version: 'yf_arc3_v5.component_extraction_result.v1' };
}

export class ObservedInputDomain {
  readonly limit: number;
  readonly bindings = new Map<string, Map<string, LocusWitness>>();
  constructor(maxLoci: number) {
    if (!Number.isSafeInteger(maxLoci) || maxLoci < 1 || maxLoci > 4096) throw new TypeError('Invalid declared sample cap');
    this.limit = maxLoci;
  }
  candidates(observation: NativeObservation): MeasuredCommand[] {
    const available = new Set(observation.available_action_refs);
    const actions = ['ACTION1', 'ACTION2', 'ACTION3', 'ACTION4', 'ACTION5'].filter(action => available.has(action)).map(action_ref => ({ action_ref, data: {} as Record<string, number> }));
    if (!available.has('ACTION6')) return actions;
    const groups = new Map<string, { x: number; y: number; entity: NativeEntity }[]>();
    for (const entity of observation.entities) {
      const mask = entity.mask;
      if (!mask.length) continue;
      const n = mask.length, sx = mask.reduce((sum, p) => sum + p[0], 0), sy = mask.reduce((sum, p) => sum + p[1], 0);
      // Python squares arbitrary integers. BigInt keeps centroid ties exact
      // even for an admitted, unusually long one-dimensional raster.
      const distance = (p: Pixel) => {
        const dx = BigInt(n * p[0] - sx), dy = BigInt(n * p[1] - sy);
        return dx * dx + dy * dy;
      };
      let best = mask[0]!;
      for (const p of mask) {
        const delta = distance(p) - distance(best);
        if (delta < 0n || delta === 0n && (p[1] < best[1] || p[1] === best[1] && p[0] < best[0])) best = p;
      }
      const group = groups.get(entity.signature) ?? [];
      group.push({ x: entity.position[0] + best[0], y: entity.position[1] + best[1], entity }); groups.set(entity.signature, group);
    }
    const ordered = [...groups].flatMap(([signature, group]) => group.sort((a, b) => a.y - b.y || a.x - b.x).map((item, index) => ({ ...item, signature, index })))
      .sort((a, b) => a.index - b.index || (a.signature < b.signature ? -1 : a.signature > b.signature ? 1 : 0) || a.x - b.x || a.y - b.y);
    const table = new Map<string, LocusWitness>();
    for (const { signature, x, y, entity } of ordered.slice(0, this.limit)) {
      table.set(pixelKey(x, y), { observation_ref: observation.observation_ref, level_epoch: observation.level_epoch,
        frame_hash: observation.frame_hash, entity_ref: entity.id, signature, bbox: [...entity.bbox], palette_value: entity.palette_value,
        point: [x, y], total_occurrences: ordered.length, sampled_occurrences: Math.min(ordered.length, this.limit) });
      actions.push({ action_ref: 'ACTION6', data: { x, y } });
    }
    this.bindings.set(`${observation.level_epoch}:${observation.frame_hash}`, table);
    return actions;
  }
  static async makeLocusWitness(observation: NativeObservation, rows: NativeRows, point: Pixel,
    provenance: { reason: string; evidence: readonly string[] }): Promise<LocusWitness> {
    const [x, y] = point;
    if (!provenance.reason || !provenance.evidence.length || !Number.isSafeInteger(x) || !Number.isSafeInteger(y) ||
        y < 0 || y >= rows.length || x < 0 || x >= rows[y]!.length) throw new TypeError('Derived locus needs bounded coordinates and symbolic provenance');
    const owners = observation.entities.filter(entity => entity.mask.some(pixel => pixel[0] === x - entity.position[0] && pixel[1] === y - entity.position[1]));
    if (owners.length !== 1) throw new TypeError('Derived locus lacks one measured pixel owner');
    const entity = owners[0]!, value = rows[y]![x]!;
    return { observation_ref: observation.observation_ref, level_epoch: observation.level_epoch, frame_hash: observation.frame_hash,
      entity_ref: entity.id, signature: entity.signature, bbox: [...entity.bbox], palette_value: value, point: [x, y],
      projection_bbox: [x, y, x, y], projected_rows_digest: await rowsDigest([[value]]),
      scope: 'source_derived_locus_on_observed_pixel', reason: provenance.reason, evidence: [...provenance.evidence] };
  }
  bindProposal(proposal: { actions: readonly MeasuredCommand[]; steps: { expected_before: { level_epoch: number; frame_hash: string }; point_binding?: LocusWitness }[] }): void {
    if (proposal.actions.length !== proposal.steps.length) throw new TypeError('Actions and steps must have equal lengths');
    for (let i = 0; i < proposal.actions.length; i++) {
      const command = proposal.actions[i]!, step = proposal.steps[i]!;
      if (command.action_ref !== 'ACTION6') continue;
      const witness = this.bindings.get(`${step.expected_before.level_epoch}:${step.expected_before.frame_hash}`)?.get(pixelKey(command.data.x!, command.data.y!));
      if (!witness) throw new TypeError('Addressed action has no current sampled witness');
      step.point_binding = structuredClone(witness);
    }
  }
  static async pointGuard(publicPacket: ObserverPublicPacket, command: MeasuredCommand, step: { point_binding?: LocusWitness }): Promise<boolean> {
    if (command.action_ref !== 'ACTION6') return true;
    const witness = step.point_binding;
    if (!witness || publicPacket.level !== witness.level_epoch) return false;
    if (witness.projected_rows_digest !== undefined) {
      if (!witness.projection_bbox || await rowsDigest(projection(publicPacket.frame_rows, witness.projection_bbox)) !== witness.projected_rows_digest) return false;
    } else if (publicPacket.frame_hash !== witness.frame_hash) return false;
    const { x, y } = command.data, rows = publicPacket.frame_rows;
    return x !== undefined && y !== undefined && Number.isSafeInteger(x) && Number.isSafeInteger(y) && x === witness.point[0] && y === witness.point[1]
      && y >= 0 && y < rows.length && x >= 0 && x < rows[y]!.length && rows[y]![x] === witness.palette_value;
  }
}
