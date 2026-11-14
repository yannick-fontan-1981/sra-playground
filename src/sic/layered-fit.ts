import { geometricComponents, ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeCommand, NativeFamily, NativePoint, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { navigationPrimitives, resolveNavigationPrimitives } from './navigation-primitives.ts';
import { sicNeedId } from './need-identity.ts';

export const layeredFitId = 'sic_layered_fit';
type Part = ReturnType<typeof geometricComponents>[number];
type Pane = { color: number; box: NativeBox; points: NativePoint[] };
type Scene = { panes: Pane[]; canvas: NativeBox; reference: NativeBox; mixed: number; empty: number };
type Stage = 'select' | 'measure' | 'fit';
type State = { epoch: number; scene: Scene; index: number; stage: Stage; marker: NativePoint | null; remaining: string[]; refs: string[]; failed: boolean };
type Proposal = NativeProposal & { local: State; pane: Pane; stage: Stage; delta: NativePoint | null; marker: NativePoint | null; needId: string };

const dirs = [['ACTION1', 0, -1], ['ACTION2', 0, 1], ['ACTION3', -1, 0], ['ACTION4', 1, 0]] as const;
const key = (p: NativePoint) => p.join(',');
const same = (a: NativePoint, b: NativePoint) => a[0] === b[0] && a[1] === b[1];
const width = ([l, , r]: NativeBox) => r - l + 1;
const height = ([, t, , b]: NativeBox) => b - t + 1;
const inside = ([l, t, r, b]: NativeBox, [x, y]: NativePoint) => x >= l && y >= t && x <= r && y <= b;
const mid = ([l, t, r, b]: NativeBox): NativePoint => [Math.floor((l + r) / 2), Math.floor((t + b) / 2)];
const inset = ([l, t, r, b]: NativeBox): NativeBox => [l + 1, t + 1, r - 1, b - 1];

function colorsIn(rows: NativeRows, region: NativeBox): Map<number, NativePoint[]> {
  const map = new Map<number, NativePoint[]>();
  const [l, t, r, b] = region;
  for (let y = t; y <= b; y++) for (let x = l; x <= r; x++) {
    const c = rows[y]?.[x];
    if (c === undefined) continue;
    const cells = map.get(c) ?? [];
    cells.push([x, y]);
    map.set(c, cells);
  }
  return map;
}

function findFrames(parts: Part[], rows: NativeRows): NativeBox[] {
  const seen = new Map<string, NativeBox>();
  const colors = new Set(parts.filter(p => width(p.bbox) === 12 && height(p.bbox) >= 11 && p.area >= 30 && p.area <= 45).map(p => p.color));
  for (const p of parts) {
    if (!colors.has(p.color) || width(p.bbox) !== 12 || height(p.bbox) < 11 || height(p.bbox) > 12) continue;
    const [l, t, r, b] = p.bbox;
    for (const top of [t, b - 11]) {
      if (top < 0 || top + 11 >= rows.length) continue;
      const edge = p.mask.filter(([dx, dy]) => dx === 0 || dx === 11 || t + dy === top || t + dy === top + 11).length;
      if (edge >= 30 && edge === p.area) seen.set([l, top, r, top + 11].join(','), [l, top, r, top + 11]);
    }
  }
  return [...seen.values()].sort((a, b) => a[1] - b[1]);
}

function initial(rows: NativeRows): Scene | null {
  const parts = geometricComponents(rows), frames = findFrames(parts, rows);
  if (frames.length !== 2) return null;
  const canvas = inset(frames[0]!), reference = inset(frames[1]!);
  if (canvas[3] >= reference[1]) return null;
  const target = colorsIn(rows, reference);
  const current = colorsIn(rows, canvas);
  if (target.size !== 4 || current.size !== 1) return null;
  const empty = [...current.keys()][0]!;
  if (!target.has(empty)) return null;
  const field: NativeBox = [0, 0, rows[0]!.length - 1, reference[1] - 2];
  const colors = colorsIn(rows, field);
  const available = [...target.keys()].filter(c => c !== empty);
  const panes: Pane[] = [];
  for (const color of available) {
    const choices = parts.filter(p => p.color === color && p.area > 2 * width(canvas) * height(canvas) && p.bbox[3] < field[3]);
    if (choices.length !== 1) continue;
    panes.push({ color, box: choices[0]!.bbox, points: colors.get(color) ?? [] });
  }
  const mixed = available.filter(c => !panes.some(p => p.color === c));
  if (panes.length !== 2 || mixed.length !== 1) return null;
  panes.sort((a, b) => (a.box[0] > 0 && a.box[1] > 0 ? 1 : 0) - (b.box[0] > 0 && b.box[1] > 0 ? 1 : 0));
  return { panes, canvas, reference, empty, mixed: mixed[0]! };
}

function selectionPoint(pane: Pane): NativePoint {
  const c = mid(pane.box);
  return pane.points.reduce((a, b) => {
    const dist = (p: NativePoint) => Math.abs(p[0] - c[0]) + Math.abs(p[1] - c[1]);
    return dist(a) <= dist(b) ? a : b;
  }, pane.points[0]!);
}

function firstDirection(pane: Pane, scene: Scene) {
  const [x, y] = mid(pane.box), [u, v] = mid(scene.canvas);
  const horizontal = Math.abs(x - u) > Math.abs(y - v);
  return horizontal ? dirs[x < u ? 3 : 2]! : dirs[y < v ? 1 : 0]!;
}

function changedPoint(first: NativeRows, second: NativeRows): NativePoint | null {
  const changed: NativePoint[] = [];
  for (let y = 0; y < second.length; y++) for (let x = 0; x < second[y]!.length; x++) {
    if (first[y]?.[x] !== second[y]![x]) changed.push([x, y]);
  }
  return changed.length === 1 ? changed[0]! : null;
}

function moveDelta(first: NativeRows, rows: NativeRows, marker: NativePoint, direction: typeof dirs[number]): NativePoint | null {
  const [x, y] = marker, [, dx, dy] = direction;
  const mark = first[y]![x], shifts: NativePoint[] = [];
  for (let i = 1; i <= 12; i++) {
    const a = x + i * dx, b = y + i * dy;
    if (rows[b]?.[a] === mark && first[b]?.[a] !== mark) shifts.push([a - x, b - y]);
  }
  return shifts.length === 1 ? shifts[0]! : null;
}

function fitPane(rows: NativeRows, pane: Pane, scene: Scene, [dx, dy]: NativePoint): string[] | null {
  const area: NativeBox = [0, 0, rows[0]!.length - 1, scene.reference[1] - 2];
  const known = colorsIn(rows, area);
  const translated = [...(known.get(pane.color) ?? []), ...(known.get(scene.mixed) ?? [])];
  const absolute = [...new Map([...pane.points.map(([x, y]): NativePoint => [x + dx, y + dy]), ...translated].map(p => [key(p), p])).values()];
  let x = Infinity, y = Infinity;
  for (const p of absolute) { x = Math.min(x, p[0]); y = Math.min(y, p[1]); }
  if (!Number.isFinite(x) || absolute.length > 1200) return null;
  let shape = absolute.map(([a, b]): NativePoint => [a - x, b - y]);
  const target = new Set<string>(), reference = colorsIn(rows, scene.reference);
  for (const color of [pane.color, scene.mixed]) {
    for (const [a, b] of reference.get(color) ?? []) {
      target.add(key([a - scene.reference[0] + scene.canvas[0], b - scene.reference[1] + scene.canvas[1]]));
    }
  }
  const pitch = Math.abs(dx) + Math.abs(dy);
  let best: string[] | null = null;
  for (let turn = 0; turn < 4; turn++) {
    for (let row = -12; row <= 12; row++) for (let col = -12; col <= 12; col++) {
      const length = turn + Math.abs(row) + Math.abs(col);
      if (best && best.length <= length) continue;
      const origin: NativePoint = [x + col * pitch, y + row * pitch];
      if (origin[0] > scene.canvas[2] || origin[1] > scene.canvas[3]) continue;
      const cut = shape.map(([a, b]): NativePoint => [a + origin[0], b + origin[1]]).filter(p => inside(scene.canvas, p));
      if (cut.length !== target.size || cut.some(p => !target.has(key(p)))) continue;
      best = [...Array<string>(Math.abs(row)).fill(row < 0 ? 'ACTION1' : 'ACTION2'),
        ...Array<string>(Math.abs(col)).fill(col < 0 ? 'ACTION3' : 'ACTION4'), ...Array<string>(turn).fill('ACTION5')];
    }
    const bottom = Math.max(...shape.map(p => p[1]));
    shape = shape.map(([a, b]): NativePoint => [bottom - b, a]);
  }
  return best;
}

function paneMatches(rows: NativeRows, scene: Scene, pane: Pane, marker: NativePoint | null): boolean {
  const field = colorsIn(rows, scene.canvas), expected = colorsIn(rows, scene.reference);
  const wanted = new Set([pane.color, scene.mixed].flatMap(c => (expected.get(c) ?? [])
    .map(([x, y]) => key([x - scene.reference[0] + scene.canvas[0], y - scene.reference[1] + scene.canvas[1]]))));
  const actual = new Set([pane.color, scene.mixed].flatMap(c => (field.get(c) ?? []).map(key)));
  if (marker && inside(scene.canvas, marker)) {
    actual.delete(key(marker));
    wanted.delete(key(marker));
  }
  return wanted.size === actual.size && [...wanted].every(p => actual.has(p));
}

export function createSicLayeredFit(): NativeFamily<Proposal> {
  let memory: State | null = null;
  return {
    id: layeredFitId,
    async propose(observation, rows, _inputs, remaining, execution): Promise<Proposal | null> {
      if (remaining < 1 || !['ACTION1', 'ACTION2', 'ACTION3', 'ACTION4', 'ACTION5', 'ACTION6'].every(ref => observation.available_action_refs.includes(ref))) return null;
      const prior = memory?.epoch === observation.level_epoch ? memory : null;
      const scene = prior?.scene ?? initial(rows);
      if (!scene || prior?.failed) return null;
      const local = prior ?? { epoch: observation.level_epoch, scene, index: 0, stage: 'select' as const, marker: null, remaining: [], refs: [], failed: false };
      const pane = scene.panes[local.index];
      if (!pane) return null;
      const direction = firstDirection(pane, scene);
      const target = local.stage === 'select' ? selectionPoint(pane) : null;
      const action_ref = local.stage === 'select' ? 'ACTION6' : local.stage === 'measure' ? direction[0] : local.remaining[0];
      if (!action_ref) return null;
      const action: NativeCommand = { action_ref, data: target ? { x: target[0], y: target[1] } : {} };
      const ref = observation.observation_ref;
      const evidence: [string, ...string[]] = [ref, ...local.refs.filter(r => r !== ref)];
      const mode = execution?.reasoningMode ?? 'exploration';
      const offer = { input: action_ref, expected: target, evidence };
      const { selected, entries, card } = resolveNavigationPrimitives({ mode, evidence, probe: local.stage === 'fit' ? null : offer,
        access: local.stage === 'fit' ? offer : null, interaction: null });
      if (!selected) return null;
      const witness = target ? await ObservedInputDomain.makeLocusWitness(observation, rows, target, { reason: 'Select a visible pane', evidence }) : null;
      if (target && !witness) return null;
      const parent = 'G_official_completion';
      const objective = { kind: 'fit_layer_to_reference', scope: ref.split(':revision:', 1)[0]!, subjects: ['pane:' + local.index],
        parentObjective: parent, satisfactionContract: 'visible_color_layer_matches_reference' };
      const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence };
      const id = layeredFitId + ':' + need.id;
      const situation = local.stage === 'select' ? 'Select the visible pane and locate its selection marker'
        : local.stage === 'measure' ? 'Measure one translation and recover the portion hidden at the edge'
          : 'Apply the next measured transform toward the matching reference layer';
      return { status: 'proposed', kind: layeredFitId, local, pane, stage: local.stage, marker: local.marker,
        delta: local.stage === 'measure' ? [direction[1], direction[2]] : null, needId: need.id,
        binding: { observation_ref: ref, level_epoch: observation.level_epoch }, actions: [action],
        steps: [{ action, expected_after: null, ...(witness ? { point_binding: witness } : {}) }],
        sicSituationCard: { strategy: selected.id, need: 'Match the visible superposition to the reference', situation, evidence, agenda: entries, mode,
          triggerCard: card, pane: pane.box, canvas: scene.canvas, reference: scene.reference },
        question: { reason: situation, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: situation, relations: ['contributes_to:' + parent] }],
        sicLocalDecision: { strategy: selected.id, objective: { id, label: navigationPrimitives[selected.id], parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: situation,
          preconditions: {}, preserve_refs: [], evidence, actions: [action], outcome_guard: { path: ['value'], contains: id } },
      };
    },
    before(proposal, index, _packet, observation) {
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref;
      return { admitted, reason: admitted ? 'layer_transform_bound' : 'layer_observation_changed' };
    },
    after(proposal, _index, before, after, first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true, reason: 'official_boundary',
        sic_need: { id: proposal.needId, status: 'satisfied' } };
      const next = observeReturn(first, second, proposal);
      return { matched: !next.failed, seal_prefix: true, reason: next.failed ? 'layer_prediction_not_confirmed'
        : next.index > proposal.local.index ? 'reference_layer_confirmed' : proposal.stage === 'select' ? 'selection_marker_confirmed'
          : proposal.stage === 'measure' ? 'translation_and_candidate_shape_confirmed' : 'observed_transform_changed_layer',
        ...(next.index > proposal.local.index ? { sic_need: { id: proposal.needId, status: 'satisfied' as const } } : {}) };
    },
    record(before, after, _action, first, second, proposal) {
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const next = observeReturn(first, second, proposal);
      memory = { ...next, refs: [...next.refs.slice(-4), after.observation_ref] };
      return { events: [] };
    },
    state: () => ({ memory }),
    restore(value: NativeRecord) { memory = structuredClone(value.memory as State | null); },
  };
}

function observeReturn(first: NativeRows, second: NativeRows, { local, pane, stage, marker }: Proposal): State {
  if (stage === 'select') {
    const next = selectionMarker(first, second, pane, local.scene);
    return { ...local, stage: 'measure', marker: next, failed: !next };
  }
  if (stage === 'measure' && marker) {
    const delta = moveDelta(first, second, marker, firstDirection(pane, local.scene));
    const fit = delta && fitPane(second, pane, local.scene, delta);
    return { ...local, stage: 'fit', marker: delta ? [marker[0] + delta[0], marker[1] + delta[1]] : null,
      remaining: fit ?? [], failed: !fit?.length };
  }
  const remaining = local.remaining.slice(1);
  const markerColor = marker ? first[marker[1]]?.[marker[0]] : undefined;
  const spots = markerColor === undefined ? [] : colorsIn(second, [0, 0, second[0]!.length - 1, local.scene.reference[1] - 2]).get(markerColor) ?? [];
  const nextMarker = spots.length === 1 ? spots[0]! : null;
  if (remaining.length) return { ...local, marker: nextMarker, remaining, failed: first.every((row, y) => row.every((c, x) => second[y]?.[x] === c)) };
  const matched = paneMatches(second, local.scene, pane, nextMarker);
  return { ...local, index: local.index + Number(matched), stage: 'select', marker: null, remaining: [], failed: !matched };
}

function selectionMarker(first: NativeRows, rows: NativeRows, pane: Pane, scene: Scene): NativePoint | null {
  const point = changedPoint(first, rows);
  if (point) return point;
  const palette = new Set([scene.empty, scene.mixed, ...scene.panes.map(p => p.color)]);
  const candidates = geometricComponents(rows).filter(p => p.area === 1 && !palette.has(p.color)
    && inside(pane.box, mid(p.bbox)) && first[p.bbox[1]]?.[p.bbox[0]] !== p.color);
  return candidates.length === 1 ? mid(candidates[0]!.bbox) : null;
}
