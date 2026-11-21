import type {
  NativeObservation,
  NativeRows,
} from "../logos-engine/v6-native-types.ts";
import type { VisualLayout } from "./witnessed-preview-transfer.ts";
import type { TerminalContact } from "./terminal-contact.ts";
import type { PartMotion } from "./controlled-parts.ts";
import { cellMatches, spatialControls } from "./calibrate-spatial-controls.ts";
import type { RelativeTrial } from "./relative-motion-plan.ts";
import type { XY } from "./access-terrain.ts";

type Point = number;
// One extra row and column form a boundary around the public grid.
export type GroupPose = { actor: Point; pieces: Point[] };
type Sample = {
  p: Point;
  q: Point;
  destination: Point;
  moved: boolean;
  clear: boolean;
  texture?: string;
};
type TerrainReturn = { open: boolean; texture: string };
export type RelativeModel = {
  actor: string;
  partner: string;
  pitch: number;
  origin: XY;
  width: number;
  height: number;
  goals: Record<string, Point[]>;
  moves: Record<string, number>;
  inheritedMoves?: Record<string, string>;
  samples: Sample[];
  measured: Record<string, GroupPose>;
  playerTerrain: Record<number, TerrainReturn>;
  positive: number;
  contrasts: number;
  blocked: number;
  invalid: number;
  last: string;
  first: string;
  differingRef?: string;
  blockedRef?: string;
  occupiedFailures?: Record<number, string>;
  obstruction?: string;
};
export type RelativeMemory = {
  models: Record<string, RelativeModel>;
  active?: RelativeTrial;
};
export const poseKey = (s: GroupPose) => [s.actor, ...s.pieces].join(",");
export const equalPose = (p: GroupPose, q: GroupPose) =>
  poseKey(p) === poseKey(q);
export function relativeCell(m: RelativeModel, p: XY): Point {
  return (
    (Math.round((p[1] - m.origin[1]) / m.pitch) + 1) * m.width +
    Math.round((p[0] - m.origin[0]) / m.pitch) +
    1
  );
}
export function cellXY(m: RelativeModel, p: Point): XY {
  return [
    ((p % m.width) - 1) * m.pitch + m.origin[0],
    (Math.floor(p / m.width) - 1) * m.pitch + m.origin[1],
  ];
}
export function vector(m: RelativeModel, from: Point, to: Point): XY {
  return [
    (to % m.width) - (from % m.width),
    Math.floor(to / m.width) - Math.floor(from / m.width),
  ];
}
export function texture(m: RelativeModel, rows: NativeRows, p: Point): string {
  const [x, y] = cellXY(m, p),
    n = Math.max(1, Math.round(m.pitch / 2)),
    left = Math.round((x - (n - 1)) / 2),
    top = Math.round((y - (n - 1)) / 2);
  if (
    left < 0 ||
    top < 0 ||
    top + n > rows.length ||
    left + n > rows[0]!.length
  )
    return "";
  const pixels: number[] = [];
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) pixels.push(rows[top + j]![left + i]!);
  return pixels.join(",");
}
export function readGroup(m: RelativeModel, l: VisualLayout): GroupPose | null {
  if (l[m.actor]?.length !== 1 || !l[m.partner]?.length) return null;
  const actor = relativeCell(m, l[m.actor]![0]!.at),
    pieces = l[m.partner]!.map((v) => relativeCell(m, v.at)).sort(
      (x, y) => x - y,
    );
  if (new Set([actor, ...pieces]).size !== 1 + pieces.length) return null;
  return { actor, pieces };
}
// Match identical pieces along an observed one-cell translation. The leading
// piece can only stay or advance. Remove its destination before matching the next.
export function destinations(
  pieces: number[],
  after: number[],
  d: number,
): Map<number, number> | null {
  const available = new Set(after),
    assign = new Map<number, number>();
  for (const p of [...pieces].sort((a, b) => Math.sign(d) * (b - a))) {
    const to = available.has(p + d) ? p + d : p;
    if (!available.delete(to)) return null;
    assign.set(p, to);
  }
  return available.size ? null : assign;
}
function newModel(
  w: TerminalContact,
  partner: string,
  xy: XY,
  rows: NativeRows,
  ref: string,
): RelativeModel {
  const pitch = w.pitch[0],
    mod = (v: number) => ((v % pitch) + pitch) % pitch;
  return {
    actor: w.actor,
    partner,
    pitch,
    origin: [mod(xy[0]), mod(xy[1])],
    width: Math.ceil((2 * rows[0]!.length) / pitch) + 2,
    height: Math.ceil((2 * rows.length) / pitch) + 2,
    goals: {},
    moves: {},
    samples: [],
    measured: {},
    playerTerrain: {},
    positive: 0,
    contrasts: 0,
    blocked: 0,
    invalid: 0,
    first: ref,
    last: ref,
  };
}
export function observeRelativeMotion(
  mem: RelativeMemory,
  witnesses: TerminalContact[],
  b: NativeObservation,
  a: NativeObservation,
  rows: NativeRows,
  old: VisualLayout,
  next: VisualLayout,
  op: string,
  previousMotion?: Record<string, PartMotion>,
) {
  if (
    !/^ACTION[1-4]$/.test(op) ||
    b.level_epoch !== a.level_epoch ||
    a.state !== b.state
  )
    return;
  for (const w of witnesses) {
    const person = old[w.actor];
    if (
      person?.length !== 1 ||
      next[w.actor]?.length !== 1 ||
      w.pitch[0] !== w.pitch[1] ||
      w.pitch[0] < 2
    )
      continue;
    for (const [partner, parts] of Object.entries(old)) {
      if (
        partner === w.actor ||
        !parts.length ||
        parts.length > 8 ||
        next[partner]?.length !== parts.length
      )
        continue;
      const id = [w.actor, partner, w.pitch[0]].join("/");
      let m = mem.models[id];
      if (!m) {
        // Only instantiate roles whose translated sites can be explained by
        // the subject's displacement and include a separately located mover.
        if (
          parts.every((s) =>
            next[partner]!.some(
              (t) => s.at[0] === t.at[0] && s.at[1] === t.at[1],
            ),
          )
        )
          continue;
        m = newModel(w, partner, parts[0]!.at, rows, b.observation_ref);
        const motion = previousMotion?.[w.actor];
        const controls =
          motion &&
          spatialControls(
            motion,
            new Set(b.available_action_refs),
            "",
            {},
            b.frame_hash,
            w.actor,
          );
        if (controls?.pitch[0] === m.pitch) {
          for (const motor of controls.motors.filter(
            (v) =>
              v.basis !== "untested" &&
              v.support > 0 &&
              /^ACTION[1-4]$/.test(v.op),
          )) {
            const observed = Object.values(
              motion!.displacements?.[motor.op] ?? motion!.axes[motor.op] ?? {},
            )
              .filter((v) => cellMatches(v.d, motor.d, controls.pitch))
              .sort((a, b) => b.count - a.count)[0];
            if (!observed) continue;
            m.moves[motor.op] = (motor.d[0] + motor.d[1] * m.width) / m.pitch;
            (m.inheritedMoves ??= {})[motor.op] = observed.first;
          }
        }
      }
      const p = readGroup(m, old),
        q = readGroup(m, next);
      if (!p || !q) {
        if (mem.models[id]) m.invalid++;
        continue;
      }
      const knownGoals = m.goals[w.marker];
      const sites = (old[w.marker] ?? []).map((v) =>
        relativeCell(m!, [v.at[0] - w.offset[0], v.at[1] - w.offset[1]]),
      );
      if (!knownGoals) m.goals[w.marker] = sites;
      else if (sites.length) {
        const intersection = knownGoals.filter((site) => sites.includes(site));
        if (intersection.length) m.goals[w.marker] = intersection;
      }
      if (m.last === a.observation_ref) continue;
      const step = q.actor - p.actor;
      const oneCell = [1, -1, m.width, -m.width].includes(step);
      if (step && !oneCell) {
        if (mem.models[id]) m.invalid++;
        continue;
      }
      if (
        step &&
        m.moves[op] &&
        m.moves[op] !== step &&
        !m.inheritedMoves?.[op]
      ) {
        m.invalid++;
        continue;
      }
      const d = step || m.moves[op];
      if (!d) continue;
      const moved = step ? destinations(p.pieces, q.pieces, step) : null;
      if ((step && !moved) || (!step && !equalPose(p, q))) {
        if (mem.models[id]) m.invalid++;
        continue;
      }
      const shifted = moved
        ? [...moved].filter(([from, to]) => from !== to).length
        : 0;
      if (!mem.models[id] && !shifted) continue;
      mem.models[id] = m;
      m.last = a.observation_ref;
      if (step) {
        m.moves[op] = step;
        if (m.inheritedMoves) delete m.inheritedMoves[op];
      }
      m.measured[poseKey(p) + "/" + op] = q;
      const destination = p.actor + d,
        bare = !p.pieces.includes(destination);
      if (bare)
        m.playerTerrain[destination] = {
          open: !!step,
          texture: texture(m, rows, destination),
        };
      if (!bare && !step)
        (m.occupiedFailures ??= {})[destination] = a.observation_ref;
      if (
        m.occupiedFailures?.[destination] &&
        m.playerTerrain[destination]?.open
      )
        m.obstruction = m.occupiedFailures[destination];
      if (!step) {
        m.blocked++;
        m.blockedRef = a.observation_ref;
        continue;
      }
      m.positive += shifted;
      if (shifted < p.pieces.length) {
        m.contrasts++;
        m.differingRef = a.observation_ref;
      }
      for (const [from, to] of moved!) {
        const want = from + d,
          clear = want !== q.actor && !p.pieces.includes(want);
        const sample = {
          p: p.actor,
          q: from,
          destination: want,
          moved: to !== from,
          clear,
          ...(clear && want !== p.actor
            ? { texture: texture(m, rows, want) }
            : {}),
        };
        if (
          !m.samples.some(
            (s) =>
              s.p === sample.p &&
              s.q === from &&
              s.destination === want &&
              s.clear === clear &&
              s.moved === sample.moved,
          )
        )
          m.samples.push(sample);
      }
    }
  }
}
export type ReachLaw = {
  metric: "global" | "square" | "diamond";
  radius: number;
  disagreements: number;
  evidence: number;
};
export function rangeOf(
  m: RelativeModel,
  p: number,
  q: number,
  metric: ReachLaw["metric"],
) {
  const [x, y] = vector(m, p, q);
  return metric === "global"
    ? 0
    : metric === "square"
      ? Math.max(Math.abs(x), Math.abs(y))
      : Math.abs(x) + Math.abs(y);
}
export function fitReach(m: RelativeModel): ReachLaw {
  const open = new Set(
    m.samples.filter((s) => s.moved).map((s) => s.destination),
  );
  const positive = new Set(
    m.samples.filter((s) => s.moved && s.texture).map((s) => s.texture),
  );
  const negative = new Set<string>();
  for (const [cell, s] of Object.entries(m.playerTerrain)) {
    if (s.open) {
      open.add(Number(cell));
      positive.add(s.texture);
    } else negative.add(s.texture);
  }
  const known = m.samples.filter(
    (s) =>
      s.moved ||
      (s.clear &&
        (open.has(s.destination) ||
          (s.texture && positive.has(s.texture) && !negative.has(s.texture)))),
  );
  let best: ReachLaw = {
    metric: "global",
    radius: 0,
    disagreements: known.filter((s) => !s.moved).length,
    evidence: known.length,
  };
  for (const metric of ["square", "diamond"] as const) {
    const seen = known
      .filter((s) => s.moved)
      .map((s) => rangeOf(m, s.p, s.q, metric));
    if (!seen.length) continue;
    const radius = Math.max(...seen);
    const wrong = known.filter(
      (s) => rangeOf(m, s.p, s.q, metric) <= radius !== s.moved,
    ).length;
    if (wrong < best.disagreements)
      best = { metric, radius, disagreements: wrong, evidence: known.length };
  }
  return best;
}
