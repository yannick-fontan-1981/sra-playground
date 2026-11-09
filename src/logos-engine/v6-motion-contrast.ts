/** Original V6 motion_contrast.py producer over acquired public snapshots.
 * Consumes only geometry.footprint/rigid_role and the component projection of
 * geometry.pairs. It does not implement MorphologyAdapter or parent acquisition.
 * Source: 786dcf51ca57773d8e3a8948ce9ea3655e7baf8e. */
import { compareUnicode } from './canonical.ts';
import { Snapshot, compositionIdentity, motionModels, registered } from './v6-composition-memory.ts';
import type { CompositionTransition } from './v6-composition-memory.ts';
import { geometricComponents } from './v6-native-observer.ts';
import type { GeometricComponent } from './v6-native-observer.ts';
import { pythonEqual as same, pythonTruthy as truth } from './v6-operations.ts';
import type { NativePoint, NativeRows } from './v6-native-types.ts';

type R = Record<string, any>;
export interface MotionCommand { readonly action_ref: string; readonly data?: unknown }
export interface MotionLimits {
  readonly actions: readonly (string | MotionCommand)[];
  readonly remaining_actions?: number | null;
  readonly remaining_meter_steps?: number | null;
  readonly preserve_cells?: readonly NativePoint[];
}
type Track = { roles: string[]; moves: Record<string, NativePoint>; position: (scene: Snapshot) => NativePoint | null; size: NativePoint };
type Measured = { before: Snapshot; command: string; after: Snapshot; from: NativePoint; to: NativePoint };
type SurfaceWitness = { from: NativePoint; to: NativePoint; before: string; after: string };
const key = (value: unknown): string => JSON.stringify(value);
const nonzero = ([x, y]: NativePoint): boolean => x !== 0 || y !== 0;
const gcd = (a: number, b: number): number => { while (b) [a, b] = [b, a % b]; return Math.abs(a); };
const append = <T>(map: Map<string, T[]>, at: string, value: T): void => { const values = map.get(at) ?? []; values.push(value); map.set(at, values); };

/** The exact consumed geometry.footprint measurement, with no image-edge wall. */
export function motionFootprint(rows: NativeRows, at: NativePoint, size: NativePoint): number[] | null {
  const [x, y] = at, [width, height] = size;
  if (x < 0 || y < 0 || y + height > rows.length || x + width > rows[0]!.length) return null;
  return rows.slice(y, y + height).flatMap(row => [...row.slice(x, x + width)]);
}

async function componentSignatures(parts: readonly GeometricComponent[]): Promise<Map<GeometricComponent, string>> {
  return new Map(await Promise.all(parts.map(async part => [part, await compositionIdentity({
    palette_value: part.color, area: part.area, scale: part.scale,
    normalized_mask: [...part.normalized].sort((a, b) => a[0] - b[0] || a[1] - b[1]),
  })] as const)));
}
function filledPixels(parts: readonly GeometricComponent[], signatures: ReadonlyMap<GeometricComponent, string>, roles: readonly string[]): Set<string> {
  const admitted = new Set(roles), pixels = new Set<string>();
  for (const part of parts) if (admitted.has(signatures.get(part)!)) {
    const [x, y] = part.bbox; for (const [i, j] of part.mask) pixels.add(key([x + i, y + j]));
  }
  return pixels;
}
function trackPosition(current: Snapshot, roles: readonly string[], left: number, top: number): (scene: Snapshot) => NativePoint | null {
  const offsets = roles.map(role => [role, [current.roles[role]![0] - left, current.roles[role]![1] - top]] as const);
  return scene => {
    if (roles.some(role => !Object.hasOwn(scene.roles, role))) return null;
    const origins = new Map<string, NativePoint>();
    for (const [role, [dx, dy]] of offsets) {
      const origin: NativePoint = [scene.roles[role]![0] - dx!, scene.roles[role]![1] - dy!]; origins.set(key(origin), origin);
    }
    return origins.size === 1 ? [...origins.values()][0]! : null;
  };
}
/** Exact geometry.rigid_role, consuming the existing source motion model. */
function rigidRole(history: readonly CompositionTransition[], current: Snapshot, parts: readonly GeometricComponent[], signatures: ReadonlyMap<GeometricComponent, string>): Track | null {
  const candidates = motionModels(history, current); if (!candidates.length) return null;
  const roles = candidates.map(([role]) => role), moves = candidates[0]![1];
  if (!(Object.values(moves).some(([x]) => x !== 0) && Object.values(moves).some(([, y]) => y !== 0))) return null;
  if (candidates.some(([, other]) => !same(other, moves))) return null;
  const boxes = roles.map(role => current.roles[role]!);
  const left = Math.min(...boxes.map(b => b[0])), top = Math.min(...boxes.map(b => b[1]));
  const right = Math.max(...boxes.map(b => b[2])), bottom = Math.max(...boxes.map(b => b[3]));
  const position = trackPosition(current, roles, left, top);
  const origins = new Set(history.flatMap(([before]) => { const p = position(before); return p ? [key(p)] : []; }));
  if (origins.size < 2 || filledPixels(parts, signatures, roles).size !== (right - left + 1) * (bottom - top + 1)) return null;
  return { roles, moves, position, size: [right - left + 1, bottom - top + 1] };
}
/** A unique rigid translation track can precede a two-axis source model. */
function singleRigidTrack(history: readonly CompositionTransition[], current: Snapshot, parts: readonly GeometricComponent[], signatures: ReadonlyMap<GeometricComponent, string>): Track | null {
  history = history.filter(([before, , after]) => registered(before, after) && registered(after, current));
  if (!history.length) return null;
  const shared = Object.keys(current.roles).filter(role => history.every(([before, , after]) => Object.hasOwn(before.roles, role) && Object.hasOwn(after.roles, role)));
  const tracks = new Map<string, { deltas: NativePoint[]; roles: string[] }>();
  for (const role of shared) {
    const deltas = history.map(([before, , after]): NativePoint => [after.roles[role]![0] - before.roles[role]![0], after.roles[role]![1] - before.roles[role]![1]]);
    if (deltas.some(nonzero)) { const at = key(deltas), track = tracks.get(at) ?? { deltas, roles: [] }; track.roles.push(role); tracks.set(at, track); }
  }
  if (tracks.size !== 1) return null;
  const { deltas, roles } = [...tracks.values()][0]!; roles.sort(compareUnicode);
  const grouped = new Map<string, Map<string, NativePoint>>();
  history.forEach(([, command], index) => {
    const delta = deltas[index]!; if (!nonzero(delta)) return;
    const vectors = grouped.get(command) ?? new Map<string, NativePoint>(); vectors.set(key(delta), delta); grouped.set(command, vectors);
  });
  const moves = Object.fromEntries([...grouped].filter(([, vectors]) => vectors.size === 1).map(([command, vectors]) => [command, [...vectors.values()][0]!]));
  if (!Object.keys(moves).length) return null;
  const boxes = roles.map(role => current.roles[role]!);
  const left = Math.min(...boxes.map(b => b[0])), top = Math.min(...boxes.map(b => b[1]));
  const size: NativePoint = [Math.max(...boxes.map(b => b[2])) - left + 1, Math.max(...boxes.map(b => b[3])) - top + 1];
  if (filledPixels(parts, signatures, roles).size !== size[0] * size[1]) return null;
  return { roles, moves, position: trackPosition(current, roles, left, top), size };
}

/** Produce hypotheses from actual earlier transitions and one current position.
 * The result has no source label or execution authority; the original caller
 * adds source='motion_contrast' before information-goal election. */
export async function motionOffers(history: readonly CompositionTransition[], current: Snapshot,
  admitted: readonly (string | MotionCommand)[] | MotionLimits,
  observation: { readonly level_epoch?: number; readonly observation_ref?: string }): Promise<R[]> {
  const limits: MotionLimits = Array.isArray(admitted) ? { actions: admitted } : admitted as MotionLimits;
  const allowed = new Set(limits.actions.filter(action => typeof action === 'string' || !truth(action.data)).map(action => typeof action === 'string' ? action : action.action_ref));
  const budget = limits.remaining_actions ?? null, meter = limits.remaining_meter_steps ?? null;
  if (!allowed.size || budget !== null && budget < 1 || meter !== null && meter < 1
    || current.epoch !== observation.level_epoch || current.ref !== observation.observation_ref) return [];
  history = history.filter(([before, , after]) => before.epoch === current.epoch && after.epoch === current.epoch && before.score === current.score && after.score === current.score);
  if (!history.length) return [];
  // geometry.pairs(rows)[1] is exactly geometric_observer.components(rows).
  // Pair detection has no effect on this consumed result. The differential
  // exporter also checks this projection against the unmodified geometry.pairs.
  const parts = geometricComponents(current.rows), signatures = await componentSignatures(parts);
  const role = rigidRole(history, current, parts, signatures) ?? singleRigidTrack(history, current, parts, signatures);
  if (!role) return [];
  const { roles, moves, position, size } = role, origin = position(current); if (!origin) return [];
  const measured: Measured[] = [];
  for (const [before, command, after] of history) {
    const from = position(before), to = position(after);
    if (!from || !to || !registered(before, after) || !registered(after, current)) continue;
    measured.push({ before, command, after, from, to });
  }
  const candidates: Record<string, NativePoint> = { ...moves }, byCommand = new Map<string, Map<string, NativePoint>>();
  for (const { command, from, to } of measured) if (!same(from, to)) {
    const delta: NativePoint = [to[0] - from[0], to[1] - from[1]], vectors = byCommand.get(command) ?? new Map<string, NativePoint>();
    vectors.set(key(delta), delta); byCommand.set(command, vectors);
  }
  for (const [command, vectors] of byCommand) if (!Object.hasOwn(candidates, command) && vectors.size === 1) candidates[command] = [...vectors.values()][0]!;
  const reached = new Map<string, SurfaceWitness[]>(), returnGraph = new Map<string, Measured[]>(), patches = new Map<string, number[]>();
  for (const trial of measured) {
    const { before, command, after, from, to } = trial, move = moves[command]; if (!move) continue;
    if (!same([from[0] + move[0], from[1] + move[1]], to)) continue;
    const patch = motionFootprint(before.rows, to, size);
    if (patch !== null) {
      const at = key(patch); patches.set(at, patch); append(reached, at, { from, to, before: before.ref, after: after.ref });
      if (allowed.has(command)) append(returnGraph, key(from), trial);
    }
  }
  const passing = new Set([...reached].filter(([, witnesses]) => new Set(witnesses.map(row => key(row.from))).size >= 2).map(([patch]) => patch));
  if (!passing.size) return [];
  const protectedCells = new Set((limits.preserve_cells ?? []).map(key));
  const routeHome = (start: NativePoint): [string, string, string][] | null => {
    const queue: [NativePoint, [string, string, string][]][] = [[start, []]], seen = new Set([key(start)]);
    for (let index = 0; index < queue.length; index++) {
      const [at, refs] = queue[index]!; if (same(at, origin)) return refs;
      for (const { to, before, after, command } of returnGraph.get(key(at)) ?? []) {
        if (seen.has(key(to))) continue;
        if (!same(to, origin) && !same(motionFootprint(current.rows, to, size), motionFootprint(before.rows, to, size))) continue;
        if (same(to, origin) && !same(position(after) ?? [], origin)) continue;
        seen.add(key(to)); queue.push([to, [...refs, [command, before.ref, after.ref]]]);
      }
    }
    return null;
  };
  const offers: R[] = [];
  for (const command of Object.keys(candidates).sort(compareUnicode)) {
    const [dx, dy] = candidates[command]!;
    if (!allowed.has(command) || (dx === 0) === (dy === 0)) continue;
    const axis = dx ? 0 : 1, fixed = Math.abs(axis ? dy : dx);
    const strides = Object.values(candidates).filter(delta => delta[axis]).map(delta => Math.abs(delta[axis]));
    const step = strides.reduce(gcd); if (step <= 0 || fixed % step) continue;
    const direction: NativePoint = dx ? [step * (dx > 0 ? 1 : -1), 0] : [0, step * (dy > 0 ? 1 : -1)];
    const failures = new Map<string, SurfaceWitness[]>(), trials = measured.filter(trial => trial.command === command);
    for (const { before, after, from, to } of trials) if (same(from, to)) {
      const ahead: NativePoint = [from[0] + direction[0], from[1] + direction[1]], surface = motionFootprint(before.rows, ahead, size);
      if (surface !== null) { const at = key(surface); patches.set(at, surface); append(failures, at, { from, to: ahead, before: before.ref, after: after.ref }); }
    }
    const blocked = new Set([...failures.keys()].filter(patch => !passing.has(patch))); if (!blocked.size) continue;
    const ray = (scene: Snapshot, at: NativePoint): { swept: NativePoint[]; wall: NativePoint; patch: string; passage: Set<string> } | null => {
      const swept: NativePoint[] = [], passage = new Set<string>();
      while (true) {
        const next: NativePoint = [at[0] + (swept.length + 1) * direction[0], at[1] + (swept.length + 1) * direction[1]], patch = motionFootprint(scene.rows, next, size);
        if (patch === null) return null;
        const encoded = key(patch); patches.set(encoded, patch);
        if (blocked.has(encoded)) return { swept, wall: next, patch: encoded, passage };
        if (!passing.has(encoded) || failures.has(encoded)) return null;
        swept.push(next); passage.add(encoded);
      }
    };
    const witnesses: R[] = []; let alreadyDecided = false;
    for (const { before, after, from, to } of trials) {
      const path = ray(before, from); if (!path) continue;
      const positions = path.swept, fixedEnd = positions.length ? positions[Math.min(positions.length, fixed / step) - 1]! : from;
      const slideEnd = positions.length ? positions[positions.length - 1]! : from;
      if (!same(to, fixedEnd) || !same(to, slideEnd)) { alreadyDecided = true; break; }
      if (!same(to, from) && positions.length === fixed / step) witnesses.push({ before: before.ref, after: after.ref, origin: [...from], arrival: [...to], obstacle: [...path.wall], gap_lattice_steps: positions.length });
    }
    if (!witnesses.length || alreadyDecided) continue;
    const path = ray(current, origin); if (!path || path.swept.length <= fixed / step) continue;
    const fixedEnd = path.swept[fixed / step - 1]!, slideEnd = path.swept[path.swept.length - 1]!;
    let touchesProtected = false;
    for (const [x, y] of path.swept) for (let i = 0; i < size[0]; i++) for (let j = 0; j < size[1]; j++) if (protectedCells.has(key([x + i, y + j]))) touchesProtected = true;
    if (touchesProtected) continue;
    const returns = [routeHome(fixedEnd), routeHome(slideEnd)];
    const home = returns.every(route => route !== null) ? Math.max(...returns.map(route => route!.length)) : null;
    const proof = witnesses[witnesses.length - 1]!, wallRecords = failures.get(path.patch)!;
    const wallRecord = wallRecords.find(row => same(row.to, path.wall)) ?? wallRecords[wallRecords.length - 1]!;
    const refs: string[] = [current.ref, proof.before, proof.after, wallRecord.before, wallRecord.after];
    const passage = await Promise.all([...path.passage].map(async patch => ({ patch, digest: await compositionIdentity(patches.get(patch)!) })));
    passage.sort((a, b) => compareUnicode(a.digest, b.digest));
    for (const { patch } of passage) { const records = reached.get(patch)!; refs.push(records[0]!.before, records[0]!.after, records[records.length - 1]!.before, records[records.length - 1]!.after); }
    const risks = ['A matching surface may have a different passage condition at this occurrence.',
      'An intermediate site can change the participant, the meter or the board.',
      'A third position or a changed reference frame leaves both predictions unresolved.'];
    if (home === null) risks.push('A directed return to this origin is not witnessed for both predicted outcomes.');
    if (meter !== null) risks.push(`The experiment spends one of ${meter} measured moves before depletion.`);
    offers.push({ action: { action_ref: command }, predictions: { 'motion.fixed_displacement': [...fixedEnd], 'motion.stop_before_obstacle': [...slideEnd] },
      relations: [['controlled_participant', 'has_measured_footprint', [...size]], ['shared_witness', 'ended_one_step_before', proof.obstacle],
        ['current_ray', 'first_conditionally_blocked_site', [...path.wall]], ['fixed_displacement', 'predicts_position', [...fixedEnd]], ['stop_before_obstacle', 'predicts_position', [...slideEnd]]],
      evidence: [...new Set(refs)], risks, return_steps: home,
      question: 'Le même contrôle parcourt-il la distance déjà observée, ou continue-t-il jusqu’au prochain obstacle ?',
      role_refs: [...roles], origin: [...origin], observation_ref: current.ref, level_epoch: current.epoch, shared_witness: proof,
      current_gap_lattice_steps: path.swept.length, fixed_lattice_steps: fixed / step,
      blocking_evidence_basis: same(wallRecord.to, path.wall) ? 'same_occurrence' : 'same_measured_surface',
      return_evidence: returns, remaining_actions_after_probe: budget === null ? null : budget - 1,
      remaining_meter_after_probe: meter === null ? null : meter - 1, cost_actions: 1, release_authority: false });
  }
  return offers;
}
