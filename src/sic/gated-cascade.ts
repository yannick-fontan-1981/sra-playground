import { geometricComponents } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeFamily, NativePoint, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { navigationPrimitives, resolveNavigationPrimitives } from './navigation-primitives.ts';
import { sicNeedId } from './need-identity.ts';

export const gatedCascadeId = 'sic_gated_cascade';
const moves = [['ACTION1', 0, -1], ['ACTION2', 0, 1], ['ACTION3', -1, 0], ['ACTION4', 1, 0]] as const;
type Domino = { point: NativePoint; dx: number; dy: number; color: number };
type Layout = { pitch: number; cells: NativePoint[]; cursorColor: number; gate: NativePoint; junction: NativePoint;
  target: NativePoint; branch: NativePoint[] };
type Scene = { layout: Layout; cursor: NativePoint };
type Memory = { epoch: number; layout: Layout; routeRef: string | null; burstRef: string | null; failed: boolean };
type Proposal = NativeProposal & { local: Memory; scene: Scene; next: NativePoint; launch: boolean; needId: string };
const key = (p: NativePoint) => p.join(',');
const same = (a: NativePoint, b: NativePoint) => a[0] === b[0] && a[1] === b[1];
const width = ([l, , r]: NativeBox) => r - l + 1;
const height = ([, t, , b]: NativeBox) => b - t + 1;
const square = ([x, y]: NativePoint): NativeBox => [x, y, x + 2, y + 2];
const patch = (rows: NativeRows, [x, y]: NativePoint) => rows.slice(y, y + 3).flatMap(row => row.slice(x, x + 3));

function domino(point: NativePoint, colors: number[], ink: number): Domino | null {
  const tip = colors.indexOf(ink);
  if (![1, 3, 5, 7].includes(tip) || colors.lastIndexOf(ink) !== tip) return null;
  const color = colors[4]!;
  if (colors.some((v, i) => i !== tip && v !== color)) return null;
  return { point, dx: tip % 3 - 1, dy: Math.floor(tip / 3) - 1, color };
}

function walk(first: Domino, end: NativePoint, pitch: number, pieces: Domino[], cursor: NativePoint): NativePoint[] | null {
  const route: NativePoint[] = [first.point];
  let node = first;
  for (let i = 0; i < pieces.length + 1; i++) {
    const at: NativePoint = [node.point[0] + node.dx * pitch, node.point[1] + node.dy * pitch];
    if (same(at, end)) return route;
    if (route.some(p => same(p, at))) return null;
    const next = pieces.find(p => same(p.point, at));
    if (!next && !same(at, cursor)) return null;
    route.push(at);
    node = next ?? { ...node, point: at };
  }
  return null;
}

function measure(rows: NativeRows): Scene | null {
  const parts = geometricComponents(rows);
  const repeats = new Map<number, NativeBox[]>();
  for (const p of parts) {
    if (width(p.bbox) === 3 && height(p.bbox) === 3 && p.area === 9) {
      repeats.set(p.color, [...repeats.get(p.color) ?? [], p.bbox]);
    }
  }
  const floor = [...repeats].sort((a, b) => b[1].length - a[1].length)[0];
  if (!floor || floor[1].length < 30) return null;
  const [floorColor, boxes] = floor, pitch = 4;
  const origin: NativePoint = [boxes[0]![0] % pitch, boxes[0]![1] % pitch];
  if (boxes.some(box => box[0] % pitch !== origin[0] || box[1] % pitch !== origin[1])) return null;
  const entries: { point: NativePoint; colors: number[] }[] = [];
  const [firstRow, lastRow] = [Math.min(...boxes.map(b => b[1])), Math.max(...boxes.map(b => b[1]))];
  for (let y = Math.max(origin[1], firstRow - pitch); y <= lastRow; y += pitch) {
    for (let x = origin[0]; x + 2 < rows[y]!.length; x += pitch) entries.push({ point: [x, y], colors: patch(rows, [x, y]) });
  }
  const junctions = entries.filter(({ colors: c }) => [1, 3, 5, 7].every(i => c[i] === c[4])
    && c[0] !== c[4] && [2, 6, 8].every(i => c[i] === c[0]));
  const cursor = entries.filter(({ colors: c }) => c[0] !== c[4] && [1, 2, 3, 5, 6, 7, 8].every(i => c[i] === c[0]));
  if (junctions.length !== 1 || cursor.length !== 1) return null;
  const junction = junctions[0]!, active = cursor[0]!;
  const pieces = entries.flatMap(e => { const p = domino(e.point, e.colors, junction.colors[4]!); return p ? [p] : []; });
  const paths = pieces.flatMap(piece => {
    const path = walk(piece, junction.point, pitch, pieces, active.point);
    return path ? [{ piece, path }] : [];
  });
  const roots = paths.filter(p => !paths.some(q => p !== q && q.path.slice(1).some(t => same(t, p.piece.point))));
  if (roots.length !== 2 || roots[0]!.piece.color !== roots[1]!.piece.color) return null;
  roots.sort((a, b) => a.path.length - b.path.length);
  if (roots[0]!.path.length < 2 || roots[0]!.path.length >= roots[1]!.path.length) return null;
  const incoming = roots[1]!.path;
  const last = incoming.at(-1)!;
  const [jx, jy] = junction.point;
  const targets = pieces.filter(p => p.color !== roots[1]!.piece.color && pieces.filter(other => other.color === p.color).length === 1
    && (jx - last[0]) * (p.point[1] - jy) === (jy - last[1]) * (p.point[0] - jx)
    && (jx - last[0]) * (p.point[0] - jx) + (jy - last[1]) * (p.point[1] - jy) > 0);
  if (targets.length !== 1) return null;
  const cells = entries.filter(e => e.colors.every(c => c === floorColor) || e === junction || e === active
    || pieces.some(p => same(p.point, e.point))).map(e => e.point);
  return { cursor: active.point, layout: { pitch, cells, cursorColor: active.colors[0]!, gate: roots[0]!.path.at(-1)!,
    junction: junction.point, target: targets[0]!.point, branch: incoming } };
}

function retained(rows: NativeRows, layout: Layout): Scene | null {
  const cells = layout.cells.map(point => ({ point, c: patch(rows, point) }));
  const cursor = cells.filter(({ c }) => c[4] !== layout.cursorColor && c.every((v, i) => i === 4 || v === layout.cursorColor));
  if (cursor.length !== 1) return null;
  return { layout, cursor: cursor[0]!.point };
}

function nextMove(scene: Scene) {
  const { pitch, cells, gate } = scene.layout;
  const queue: { at: NativePoint; first?: { ref: string; at: NativePoint } }[] = [{ at: scene.cursor }];
  const available = new Set(cells.map(key)), seen = new Set([key(scene.cursor)]);
  for (const entry of queue) for (const [ref, dx, dy] of moves) {
    const at: NativePoint = [entry.at[0] + dx * pitch, entry.at[1] + dy * pitch], k = key(at);
    if (!available.has(k) || seen.has(k)) continue;
    const first = entry.first ?? { ref, at };
    if (same(at, gate)) return first;
    seen.add(k);
    queue.push({ at, first });
  }
  return null;
}

export function createSicGatedCascade(): NativeFamily<Proposal> {
  let state: Memory | null = null;
  return {
    id: gatedCascadeId,
    propose(observation, rows, _inputs, remaining, execution): Proposal | null {
      if (remaining < 1 || ![...moves.map(([ref]) => ref), 'ACTION5'].every(ref => observation.available_action_refs.includes(ref))) return null;
      const prior = state?.epoch === observation.level_epoch ? state : null;
      if (prior?.failed) return null;
      const scene = prior ? retained(rows, prior.layout) : measure(rows);
      if (!scene) return null;
      const { layout } = scene;
      const local = prior ?? { epoch: observation.level_epoch, layout, routeRef: null, burstRef: null, failed: false };
      const launch = same(scene.cursor, layout.gate);
      const step = launch ? { ref: 'ACTION5', at: scene.cursor } : nextMove(scene);
      if (!step) return null;

      const ref = observation.observation_ref;
      const evidence: [string, ...string[]] = [ref, ...[local.routeRef, local.burstRef].filter((v): v is string => !!v && v !== ref)];
      const mode = execution?.reasoningMode ?? 'exploration';
      const offer = { input: step.ref, expected: step.at, evidence };
      const known = launch ? local.burstRef : local.routeRef;
      const { selected, entries, card } = resolveNavigationPrimitives({ mode, evidence,
        probe: known ? null : offer, access: !launch && known ? offer : null, interaction: launch && known ? offer : null });
      if (!selected) return null;
      const parent = 'G_official_completion';
      const objective = { kind: 'control_cascade_at_shared_junction', scope: ref.split(':revision:', 1)[0]!,
        subjects: [key(layout.junction), key(layout.target)], parentObjective: parent, satisfactionContract: 'official_progress_after_directional_cascade' };
      const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence };
      const id = gatedCascadeId + ':' + need.id;
      const situation = launch ? 'Test the cascade with the earlier branch blocked and check the target branch'
        : 'Move the cursor to block the shorter path into the shared junction';
      const action = { action_ref: step.ref, data: {} };
      return {
        status: 'proposed', kind: gatedCascadeId, local, scene, next: step.at, launch, needId: need.id,
        binding: { observation_ref: ref, level_epoch: observation.level_epoch }, actions: [action],
        steps: [{ action, expected_after: launch ? null : step.at }],
        sicSituationCard: { strategy: selected.id, need: 'Keep the cascade going toward the target', situation, evidence, agenda: entries,
          mode, triggerCard: card, actor: square(scene.cursor), gate: square(layout.gate), junction: square(layout.junction), target: square(layout.target) },
        question: { reason: situation, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: situation, relations: ['contributes_to:' + parent] }],
        sicLocalDecision: { strategy: selected.id, objective: { id, label: navigationPrimitives[selected.id], parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: situation,
          preconditions: {}, preserve_refs: [], evidence, actions: [action], outcome_guard: { path: ['value'], contains: id } },
      };
    },
    before(proposal, index, _packet, observation) {
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref;
      return { admitted, reason: admitted ? 'cascade_step_bound' : 'cascade_observation_changed' };
    },
    after(proposal, _index, before, after, first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true, reason: 'official_boundary',
        sic_need: { id: proposal.needId, status: 'satisfied' } };
      const next = retained(second, proposal.local.layout);
      const matched = !!next && same(next.cursor, proposal.next) && (!proposal.launch || burstChanged(first, second, proposal.local.layout));
      return { matched, seal_prefix: true, reason: matched ? proposal.launch ? 'cascade_propagation_observed' : 'cursor_landing_confirmed'
        : proposal.launch ? 'cascade_stalled_or_reset' : 'cursor_did_not_reach_predicted_cell' };
    },
    record(before, after, _action, first, second, proposal) {
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const { local, launch } = proposal;
      const next = retained(second, local.layout);
      const matched = !!next && same(next.cursor, proposal.next) && (!launch || burstChanged(first, second, local.layout));
      state = { ...local, failed: !matched, routeRef: matched && !launch ? after.observation_ref : local.routeRef,
        burstRef: matched && launch ? after.observation_ref : local.burstRef };
      return { events: [] };
    },
    state: () => ({ state }),
    restore(value: NativeRecord) { state = structuredClone(value.state as Memory | null); },
  };
}

function burstChanged(first: NativeRows, second: NativeRows, layout: Layout) {
  return [...layout.branch, layout.junction, layout.target].some(point => {
    const before = patch(first, point), after = patch(second, point);
    return before.some((color, index) => color !== after[index]);
  }) || layout.cells.some(point => patch(first, point)[4] !== patch(second, point)[4]);
}
