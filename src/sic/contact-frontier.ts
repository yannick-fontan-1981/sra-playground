import type { NativeObservation, NativeRows } from '../logos-engine/v6-native-types.ts';
import { spatialControls, surfaceFromVisits } from './calibrate-spatial-controls.ts';
import type { XY } from './access-terrain.ts';
import { visualLayout, type PreviewLearning, type VisualLayout } from './witnessed-preview-transfer.ts';
import { previewLaw, type ProbePattern } from './reachable-preview-configurations.ts';
import { contactProject, edgeKey, type Board, type Project, type Step } from './contact-frontier-search.ts';

type Ground = { role: string; actor: string; origin: XY; pitch: XY; width: number };
export type FrontierContact = Ground & {
  step: Step;
  project: Project;
  parts: number[];
  acquired: boolean;
  ref: string;
  transform: string | null;
  terrain: number | null;
  previousEntry: string | null;
};
export type ContactMemory = {
  roles?: string[];
  floor?: number;
  denied: string[];
  displaced: string[];
  supported: number[];
  appearances?: Record<string, string>;
  verify?: { at: number; role: string; terrain: number | null; displacement: string };
  verified?: Record<string, { displacement: string; entry: string }>;
  visited?: number[];
  active?: Project;
  arrival?: boolean;
  explorer?: { actor: string; origin: XY };
};
export const newContactMemory = (): ContactMemory => ({ denied: [], displaced: [], supported: [] });
function cell(at: XY, g: Ground) {
  return Math.round((at[0] - g.origin[0]) / g.pitch[0]) + g.width * Math.round((at[1] - g.origin[1]) / g.pitch[1]);
}
function crossesIntoUnseenRegion(b: Board, from: number, to: number, visited: number[]) {
  const seen = new Set([to]),
    queue = [to],
    old = new Set([from, ...visited]);
  for (const p of queue) {
    if (old.has(p)) return false;
    for (const motor of b.motors) {
      const next = p + motor.delta;
      if (Math.abs((p % b.width) - (next % b.width)) > 1 || !b.floor.has(next) || seen.has(next)) continue;
      queue.push(next);
      seen.add(next);
    }
  }
  return true;
}
function cellPixels(rows: NativeRows, at: XY, pitch: XY): number[] {
  const pixels: number[] = [];
  for (let y = Math.ceil((at[1] - pitch[1] / 2) / 2); 2 * y < at[1] + pitch[1] / 2; y++) {
    for (let x = Math.ceil((at[0] - pitch[0] / 2) / 2); 2 * x < at[0] + pitch[0] / 2; x++) {
      const value = rows[y]?.[x];
      if (value !== undefined) pixels.push(value);
    }
  }
  return pixels;
}
function dominantColor(rows: NativeRows, at: XY, pitch: XY) {
  const histogram = new Map<number, number>();
  for (const value of cellPixels(rows, at, pitch)) histogram.set(value, (histogram.get(value) ?? 0) + 1);
  return [...histogram].sort((a, b) => b[1] - a[1])[0]?.[0];
}
function cellAppearance(rows: NativeRows, id: number, g: Ground) {
  return cellPixels(
    rows,
    [g.origin[0] + (id % g.width) * g.pitch[0], g.origin[1] + Math.floor(id / g.width) * g.pitch[1]],
    g.pitch
  ).join(',');
}
function fittedTransport(
  learning: PreviewLearning,
  actor: string,
  layout: VisualLayout,
  g: Ground,
  motors: Set<string>,
  available: Set<string>
) {
  for (const binding of Object.values(learning.bindings)) {
    if (
      binding.actor !== actor ||
      binding.gesture.point ||
      !available.has(binding.gesture.op) ||
      motors.has(binding.gesture.op)
    )
      continue;
    const roles = new Set(binding.witnesses.flatMap((w) => w.geometry?.pivots.map((p) => p.role) ?? []));
    for (const role of roles) {
      if (layout[role]?.length !== 1) continue;
      const examples: ProbePattern[] = [];
      for (const w of binding.witnesses) {
        const matches = w.geometry?.pivots.filter((p) => p.role === role);
        if (matches?.length !== 1) continue;
        const relative = (p: XY): XY => [
          Math.round((p[0] - matches[0]!.at[0]) / g.pitch[0]),
          Math.round((p[1] - matches[0]!.at[1]) / g.pitch[1]),
        ];
        examples.push({
          actor: relative(w.from),
          centre: [0, 0],
          indicator: relative(w.arrived),
          ref: examples.length,
        });
      }
      if (new Set(examples.map((e) => e.actor.join())).size < 2) continue;
      const predict = previewLaw(examples, true),
        pivot = cell(layout[role]![0]!.at, g);
      const land = (a: number, c: number) => {
        const at: XY = [a % g.width, Math.floor(a / g.width)],
          centre: XY = [c % g.width, Math.floor(c / g.width)];
        const choices = predict(at, centre);
        if (choices.length !== 1) return null;
        const [x, y] = choices[0]!.at;
        return x >= 0 && x < g.width && y >= 0 ? x + y * g.width : null;
      };
      return { pivot, role, op: binding.gesture.op, land };
    }
  }
  return null;
}
function contactBoard(m: ContactMemory, l: PreviewLearning, o: NativeObservation, rows: NativeRows) {
  const layout = visualLayout(o, rows),
    available = new Set(o.available_action_refs);
  const targets: { actor: string; marker: string; offset?: XY }[] = [...(l.terminal ?? [])];
  if (m.explorer) targets.push({ actor: m.explorer.actor, marker: '' });
  for (const goal of targets) {
    const bodies = layout[goal.actor],
      markers = goal.marker ? layout[goal.marker] : [],
      motion = l.partMotion?.[goal.actor];
    if (bodies?.length !== 1 || !markers || (goal.marker && markers.length !== 1) || !motion) continue;
    const controls = spatialControls(motion, available, '', {}, o.frame_hash, goal.actor);
    if (!controls || controls.motors.length < 2 || controls.motors.some((m) => !m.support)) continue;
    const pitch = controls.pitch;
    if (Math.min(...pitch) < 2) continue;
    const anchor = markers[0]?.at ?? m.explorer!.origin,
      origin: XY = [anchor[0] % pitch[0], anchor[1] % pitch[1]];
    const width = Math.ceil((2 * rows[0]!.length - origin[0]) / pitch[0]),
      height = Math.ceil((2 * rows.length - origin[1]) / pitch[1]);
    const g: Ground = { actor: goal.actor, role: goal.marker, origin, pitch, width };
    const actor = cell(bodies[0]!.at, g),
      goals = markers.map((v) => cell([v.at[0] - (goal.offset?.[0] ?? 0), v.at[1] - (goal.offset?.[1] ?? 0)], g));
    const motors = controls.motors.map((m) => ({
      op: m.op,
      delta: Math.round(m.d[0] / pitch[0]) + width * Math.round(m.d[1] / pitch[1]),
    }));
    const warp = fittedTransport(l, goal.actor, layout, g, new Set(motors.map((m) => m.op)), available);
    const floor =
      m.floor ??
      surfaceFromVisits(motion.sites, rows, bodies[0]!.at, pitch, [bodies[0]!.at]) ??
      Number(Object.entries(motion.substrate).sort((a, b) => b[1] - a[1])[0]?.[0]);
    if (!Number.isFinite(floor)) continue;
    const fixed = new Set([actor, ...goals, ...(warp ? [warp.pivot] : [])]);
    const signals = new Set(
      Object.values(l.bindings)
        .filter((b) => b.actor === goal.actor)
        .map((b) => b.indicator)
    );
    for (const binding of Object.values(l.bindings).filter(
      (b) => b.actor === goal.actor && !motors.some((m) => m.op === b.gesture.op) && !b.gesture.point
    )) {
      for (const pivot of binding.witnesses[0]?.geometry?.pivots ?? [])
        if (binding.witnesses.filter((w) => w.geometry?.pivots.some((p) => p.role === pivot.role)).length >= 2)
          signals.add(pivot.role);
    }
    const visibleRoles = () =>
      Object.keys(layout).filter(
        (role) =>
          !signals.has(role) &&
          layout[role]!.every((v) => {
            const w = v.box[2]! - v.box[0]! + 1,
              h = v.box[3]! - v.box[1]! + 1;
            const at = cell(v.at, g);
            if (
              fixed.has(at) ||
              m.supported.includes(at) ||
              m.verify?.at === at ||
              w * 2 > pitch[0] ||
              h * 2 > pitch[1] ||
              w * h * 8 < pitch[0] * pitch[1]
            )
              return false;
            const appearance = cellAppearance(rows, at, g);
            return !appearance.split(',').every((pixel) => Number(pixel) === floor);
          })
      );
    const roles = m.roles && !m.arrival ? m.roles : [...new Set([...(m.roles ?? []), ...visibleRoles()])];
    const appearances = m.appearances ?? {};
    const observed = new Map<string, Set<number>>(
      roles.map((role) => [role, new Set((layout[role] ?? []).map((v) => cell(v.at, g)))])
    );
    if (Object.keys(appearances).length) {
      const lookup = new Map(Object.entries(appearances).map(([role, look]) => [look, role]));
      for (let at = 0; at < width * height; at++) {
        const role = lookup.get(cellAppearance(rows, at, g));
        if (role) observed.get(role)?.add(at);
      }
    }
    const objects = roles
      .flatMap((role) => [...observed.get(role)!].map((at) => ({ at, role })))
      .sort((a, b) => a.role.localeCompare(b.role) || a.at - b.at);
    if (!objects.length && !m.supported.length && !m.verify) continue;
    const walkable = new Set([...fixed, ...objects.map((v) => v.at), ...m.supported]);
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++)
        if (dominantColor(rows, [origin[0] + x * pitch[0], origin[1] + y * pitch[1]], pitch) === floor)
          walkable.add(x + y * width);
    const pivotIndex = warp ? objects.length : -1;
    if (warp) objects.push({ at: warp.pivot, role: warp.role });
    const board: Board = {
      width,
      height,
      floor: walkable,
      goals,
      actor,
      parts: objects.map((v) => v.at),
      roles: objects.map((v) => v.role),
      motors,
      pivotIndex,
      ...(warp ? { transport: warp } : {}),
    };
    return { board, g, roles, floor };
  }
  return null;
}
export function proposeFrontierContact(
  m: ContactMemory,
  l: PreviewLearning,
  o: NativeObservation,
  rows: NativeRows,
  limits: { maxNodes: number; maxDepth: number }
): FrontierContact | null {
  const fit = contactBoard(m, l, o, rows);
  if (!fit) return null;
  const { board, g } = fit;
  const deny = new Set(m.denied);
  let project: Project | null = null;
  if (m.verify) {
    const at = m.verify.at,
      motor = board.motors.find((v) => board.actor + v.delta === at);
    if (motor && !deny.has(edgeKey(board.actor, motor.op, board.parts)))
      project = {
        purpose: 'test_support',
        site: at,
        role: m.verify.role,
        steps: [{ from: board.actor, to: at, op: motor.op }],
      };
  }
  const verifyEntry = !!project;
  const local = m.arrival ? new Set(fit.roles.filter((r) => !m.displaced.includes(r))) : new Set<string>();
  const nextStep = m.active?.steps[0];
  if (!project && !local.size && nextStep?.from === board.actor && m.active) {
    // Occlusion elsewhere is not evidence that this stance was lost. Check the
    // participant required by this step, then acquire the actual public return.
    const occupant = board.parts.indexOf(nextStep.to);
    const contradiction = occupant >= 0 && board.roles[occupant] !== nextStep.role;
    if (!contradiction) project = m.active;
  }
  const terrainAt = (id: number) =>
    dominantColor(
      rows,
      [g.origin[0] + (id % g.width) * g.pitch[0], g.origin[1] + Math.floor(id / g.width) * g.pitch[1]],
      g.pitch
    ) ?? null;
  if (!project) {
    if (!board.goals.length && !local.size) return null;
    project = contactProject(
      board,
      deny,
      limits,
      local,
      m.verified ? (role, id) => !!m.verified![JSON.stringify([role, terrainAt(id)])] : undefined
    );
  }
  const step = project?.steps[0];
  if (!step || !project || deny.has(edgeKey(step.from, step.op, board.parts))) return null;
  if (!m.roles && project.purpose === 'reach_goal' && !project.steps.some((s) => s.role)) return null;
  const terrain = verifyEntry ? m.verify!.terrain : terrainAt(project.site);
  const law = m.verified?.[JSON.stringify([project.role, terrain])];
  return {
    ...g,
    step,
    project,
    parts: board.parts,
    acquired: verifyEntry,
    transform: board.transport?.op ?? null,
    ref: o.observation_ref,
    terrain,
    previousEntry: law?.entry ?? null,
  };
}
export function recordFrontierContact(
  m: ContactMemory,
  l: PreviewLearning,
  b: NativeObservation,
  a: NativeObservation,
  rows: NativeRows,
  next: NativeRows,
  trial: FrontierContact
) {
  if (b.level_epoch !== a.level_epoch || a.levels_completed > b.levels_completed) return 'official_progress';
  const before = contactBoard(m, l, b, rows),
    after = visualLayout(a, next);
  if (!before) return 'unresolved_subject';
  m.roles = before.roles;
  m.floor ??= before.floor;
  m.appearances ??= {};
  for (const role of before.roles) {
    if (m.appearances[role]) continue;
    const a = before.board.parts.filter((_, i) => before.board.roles[i] === role);
    const looks = new Set(a.map((p) => cellAppearance(rows, p, trial)));
    if (looks.size === 1) m.appearances[role] = [...looks][0]!;
  }
  const s = trial.step,
    body = after[trial.actor],
    at = body?.length === 1 ? cell(body[0]!.at, trial) : null;
  const pending = m.verify;
  delete m.active;
  delete m.verify;
  if (at !== s.to) {
    m.denied.push(edgeKey(s.from, s.op, trial.parts));
    m.arrival = false;
    return 'movement_refuted';
  }
  m.arrival = s.op === trial.transform && crossesIntoUnseenRegion(before.board, s.from, s.to, m.visited ?? []);
  const visited = (m.visited ??= []);
  if (!visited.includes(s.from)) visited.push(s.from);
  if (s.role && s.placed !== undefined) {
    const parts = after[s.role] ?? [];
    if (
      parts.some((v) => cell(v.at, trial) === s.placed) ||
      m.appearances[s.role] === cellAppearance(next, s.placed, trial)
    ) {
      if (!m.displaced.includes(s.role)) m.displaced.push(s.role);
    } else if (s.boundary && parts.length === before.board.roles.filter((r) => r === s.role).length - 1) {
      m.verify = { at: s.placed, role: s.role, terrain: trial.terrain, displacement: a.observation_ref };
      return 'object_changed_at_frontier_test_entry';
    } else {
      m.denied.push(edgeKey(s.from, s.op, trial.parts));
      return 'contact_effect_refuted';
    }
  }
  if (trial.acquired && pending) {
    if (!m.supported.includes(s.to)) m.supported.push(s.to);
    (m.verified ??= {})[JSON.stringify([pending.role, pending.terrain])] = {
      displacement: pending.displacement,
      entry: a.observation_ref,
    };
    m.denied = [];
    return 'new_support_entered';
  }
  if (trial.project.steps.length > 1) {
    m.active = { ...trial.project, steps: trial.project.steps.slice(1) };
  }
  return s.role ? 'object_displaced' : m.arrival ? 'arrived_to_investigate' : 'approach_verified';
}

export function observeRegionArrival(
  m: ContactMemory,
  l: PreviewLearning,
  b: NativeObservation,
  a: NativeObservation,
  rows: NativeRows,
  next: NativeRows
) {
  delete m.active;
  const before = visualLayout(b, rows),
    after = visualLayout(a, next);
  const actors = l.terminal?.length ? [...new Set(l.terminal.map((g) => g.actor))] : Object.keys(l.partMotion ?? {});
  for (const actor of actors) {
    const p = before[actor],
      q = after[actor];
    if (p?.length !== 1 || q?.length !== 1) continue;
    const delta = [Math.abs(p[0]!.at[0] - q[0]!.at[0]), Math.abs(p[0]!.at[1] - q[0]!.at[1])];
    if (!delta.some((v) => v > 2)) continue;
    const model = l.partMotion?.[actor],
      controls = model && spatialControls(model, new Set(b.available_action_refs), '', {}, b.frame_hash, actor);
    if (!controls || controls.motors.filter((s) => s.support).length < 2) continue;
    const d = delta[0]! / controls.pitch[0] + delta[1]! / controls.pitch[1];
    if (d > 2) {
      if (!l.terminal?.length) m.explorer = { actor, origin: p[0]!.at };
      const fit = contactBoard(m, l, b, rows);
      if (fit) {
        const previous = cell(p[0]!.at, fit.g),
          visited = (m.visited ??= []);
        m.arrival = crossesIntoUnseenRegion(fit.board, previous, cell(q[0]!.at, fit.g), visited);
        if (!visited.includes(previous)) visited.push(previous);
      }
      if (!m.arrival && !l.terminal?.length) delete m.explorer;
      break;
    }
  }
}
