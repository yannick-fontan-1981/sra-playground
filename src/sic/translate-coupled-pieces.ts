import { geometricComponents, ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeCommand, NativeFamily, NativePoint, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { navigationPrimitives, resolveNavigationPrimitives } from './navigation-primitives.ts';
import { sicNeedId } from './need-identity.ts';

export const translateCoupledPiecesId = 'sic_translate_coupled_pieces';

const directions = [['ACTION1', 0, -1], ['ACTION2', 0, 1], ['ACTION3', -1, 0], ['ACTION4', 1, 0]] as const;

type Model = {
  pitch: number;
  color: number;
  divider: NativeBox;
  domain: NativePoint[];
  targets: NativePoint[];
};
type Position = { pieces: NativePoint[]; selected: number };
type Move = { input: string; click?: NativePoint; position: Position; contact?: number };
type State = { epoch: number; model: Model; position: Position; refs: string[]; attempts: Record<string, number> };
type Proposal = NativeProposal & { local: State; move: Move; needId: string; attempt: string };

const eq = ([x, y]: NativePoint, [a, b]: NativePoint) => x === a && y === b;
const label = (p: NativePoint) => p.join(',');
const advance = ([x,y]: NativePoint, dx: number, dy: number): NativePoint => [x + dx, y + dy];
const key = (p: Position) => p.selected + '/' + p.pieces.map(label).join(';');
const size = ([l, t, r, b]: NativeBox) => [r - l + 1, b - t + 1] as const;

function measure(rows: NativeRows): { model: Model; position: Position } | null {
  const parts = geometricComponents(rows), layouts = [];
  const at = (x: number, y: number) => rows[y]?.[x];
  for (const a of parts) {
    const [pitch, height] = size(a.bbox);
    if (pitch < 3 || pitch > 7 || height !== pitch || a.area !== pitch * pitch - 1) continue;
    const rings = parts.filter(p => p.color === a.color && p.area === a.area && size(p.bbox).every(v => v === pitch));
    if (rings.length !== 2 || rings[0] !== a) continue;
    const slots = parts.filter(p => p.area === 4 * (pitch + 1) && size(p.bbox).every(v => v === pitch + 2)
      && p.mask.every(([x, y]) => x === 0 || y === 0 || x === pitch + 1 || y === pitch + 1));
    if (slots.length !== 2 || slots[0]!.color !== slots[1]!.color || slots[0]!.color === a.color) continue;
    const toPoint = ([x,y]: NativeBox): NativePoint => [x, y];
    const pieces = rings.map(p => toPoint(p.bbox));
    const targets = slots.map(p => advance(toPoint(p.bbox), 1, 1));
    const aligned = ([x,y]: NativePoint) => (x - pieces[0]![0]) % pitch === 0 && (y - pieces[0]![1]) % pitch === 0;
    if (![...pieces, ...targets].every(aligned)) continue;
    const [left, right] = targets.sort((a, b) => a[0] - b[0]);
    const dividers = parts.filter(p => {
      const [l, t, r, b] = p.bbox, [w,h] = size(p.bbox);
      return l > left![0] + pitch - 1 && r < right![0] && h >= 4 * pitch && w >= pitch
        && p.area === w * h && pieces.every(([x,y]) => (x < l || x > r) && y >= t && y + pitch - 1 <= b);
    });
    if (dividers.length !== 1) continue;
    const [x0, y0] = pieces[0]!;
    const phase: NativePoint = [x0 % pitch, y0 % pitch];
    const divider = dividers[0]!.bbox, [l, t, r, b] = divider, half = Math.floor(pitch / 2);
    const support = at(left![0] + half, left![1] + half);
    if (support === undefined || support !== at(right![0] + half, right![1] + half)) continue;
    const domain: NativePoint[] = [];
    for (let y = phase[1]; y + pitch - 1 <= b; y += pitch) {
      if (y < t) continue;
      for (let x = phase[0]; x + pitch - 1 < rows[0]!.length; x += pitch) {
        if (x + pitch - 1 >= l && x <= r) continue;
        const p: NativePoint = [x,y];
        if (at(x + half, y + half) === support || pieces.some(piece => eq(piece, p)) || targets.some(goal => eq(goal, p))) domain.push(p);
      }
    }
    if (domain.length < 2 * pitch || domain.length > 140) continue;
    layouts.push({ model: { pitch, color: a.color, divider, domain, targets }, position: { pieces, selected: -1 } });
  }
  return layouts.length === 1 ? layouts[0]! : null;
}

function choose({ model, position, attempts }: State): Move | null {
  const { pitch, domain, divider, targets } = model;
  const domainKeys = new Set(domain.map(label));
  const queue: { position: Position; first: Move | null }[] = [{ position, first: null }];
  const seen = new Set([key(position)]);
  const half = Math.floor(pitch / 2);
  for (let i = 0; i < queue.length && i < 14000; i++) {
    const { position: p, first } = queue[i]!;
    if (targets.every(goal => p.pieces.some(piece => eq(piece, goal)))) return first;
    const offer = (move: Move) => {
      const k = key(move.position);
      const tried = attempts[key(p) + '>' + k] ?? 0;
      if (seen.has(k) || !first && tried >= (move.contact === undefined ? 1 : 2)) return;
      seen.add(k);
      queue.push({ position: move.position, first: first ?? move });
    };
    const m = p.selected, other = 1 - m;
    const click = (selected: number) => offer({ input: 'ACTION6', click: advance(p.pieces[selected]!, half, half), position: { ...p, selected } });
    if (m < 0) {
      for (let j = 0; j < p.pieces.length; j++) click(j);
      continue;
    }
    click(other);
    for (const [input, dx, dy] of directions) {
      const target = advance(p.pieces[m]!, dx * pitch, dy * pitch);
      if (!domainKeys.has(label(target))) continue;
      if (!eq(p.pieces[other]!, target)) {
        offer({ input, position: { ...p, pieces: p.pieces.map((piece, j) => j === m ? target : piece) } });
        continue;
      }
      if (!dx) continue;
      const next = advance(target, dx * pitch, 0), [l,,r] = divider;
      if (next[0] + pitch - 1 < l || next[0] > r) continue;
      const beyond = domain.filter(([x,y]) => y === target[1] && (dx > 0 ? x > r : x + pitch - 1 < l));
      beyond.sort((a, b) => dx * (a[0] - b[0]));
      for (const landing of beyond) {
        offer({ input, contact: other, position: { ...p, pieces: p.pieces.map((piece, j) => j === other ? landing : piece) } });
      }
    }
  }
  return null;
}

function returned(rows: NativeRows, proposal: Proposal): Position | null {
  const { local: { model, position }, move } = proposal;
  const { pitch, color, domain } = model;
  const at = (x:number,y:number) => rows[y]?.[x];
  const ring = ([x,y]: NativePoint) => {
    let count = 0;
    for (let i = 0; i < pitch; i++) {
      count += Number(at(x + i,y) === color) + Number(at(x + i,y + pitch - 1) === color);
      if (i && i < pitch - 1) count += Number(at(x,y + i) === color) + Number(at(x + pitch - 1,y + i) === color);
    }
    const present = count === 4 * (pitch - 1);
    const adjacent = (points: NativePoint[]) => points.some(other => !eq(other, [x,y])
      && other[1] === y && Math.abs(other[0] - x) === pitch);
    const deformedContact = move.contact === undefined && [position.pieces, move.position.pieces]
      .some(points => points.some(point => eq(point, [x,y])) && adjacent(points))
      && count >= 4 * (pitch - 1) - pitch;
    return present || deformedContact;
  };
  const seen = domain.filter(ring);
  if (seen.length !== position.pieces.length) return null;
  const pieces = move.position.pieces.every(p => seen.some(q => eq(p,q))) ? move.position.pieces
    : position.pieces.map((p, i) => seen.find(q => eq(p,q)) ?? seen.find(q => !position.pieces.some(previous => eq(previous,q))) ?? position.pieces[i]!);
  if (new Set(pieces.map(label)).size !== pieces.length) return null;
  if (move.click) {
    const half = Math.floor(pitch / 2);
    const [otherX, otherY] = pieces[1 - move.position.selected]!;
    if (at(...move.click) === at(otherX + half, otherY + half)) return null;
  }
  return { pieces, selected: move.position.selected };
}

export function createSicTranslateCoupledPieces(): NativeFamily<Proposal> {
  let state: State | null = null;
  return {
    id: translateCoupledPiecesId,
    async propose(observation, rows, _inputs, remaining, execution): Promise<Proposal | null> {
      if (remaining < 1 || !['ACTION6', ...directions.map(([id]) => id)].every(id => observation.available_action_refs.includes(id))) return null;
      const prior = state?.epoch === observation.level_epoch ? state : null;
      const initial = prior ?? measure(rows);
      if (!initial) return null;
      const local = prior ?? { ...initial, epoch: observation.level_epoch, refs: [], attempts: {} };
      const move = choose(local);
      if (!move) return null;
      const ref = observation.observation_ref;
      const evidence: [string, ...string[]] = [ref, ...local.refs.filter(v => v !== ref)];
      const mode = execution?.reasoningMode ?? 'exploration';
      const offer = { input: move.input, expected: move.position.pieces[move.position.selected]!, evidence };
      const probe = !local.refs.length || !!move.click || move.contact !== undefined;
      const { selected, entries, card } = resolveNavigationPrimitives({ mode, evidence,
        probe: probe ? offer : null, access: probe ? null : offer, interaction: null });
      if (!selected) return null;
      const witness = move.click ? await ObservedInputDomain.makeLocusWitness(observation, rows, move.click, { reason: 'Select a piece for movement', evidence }) : null;
      if (move.click && !witness) return null;
      const parent = 'G_official_completion';
      const objective = { kind: 'place_movable_pieces_in_fitting_targets', scope: ref.split(':revision:', 1)[0]!,
        subjects: ['movable_pieces', 'matching_target_openings', 'separating_obstacle'], parentObjective: parent, satisfactionContract: 'official_progress_after_target_coverage' };
      const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence };
      const id = translateCoupledPiecesId + ':' + need.id;
      const action: NativeCommand = { action_ref: move.input, data: move.click ? { x: move.click[0], y: move.click[1] } : {} };
      const situation = move.click ? 'Select the piece needed for the next move' : move.contact !== undefined
        ? 'Test whether directed contact carries the blocked piece across the separator' : 'Move the controlled piece toward a target or contact position';
      const box = ([x,y]: NativePoint) => [x, y, x + local.model.pitch - 1, y + local.model.pitch - 1];
      const attempt = key(local.position) + '>' + key(move.position);
      return {
        status: 'proposed', kind: translateCoupledPiecesId, local, move, needId: need.id, attempt,
        binding: { observation_ref: ref, level_epoch: observation.level_epoch }, actions: [action],
        steps: [{ action, expected_after: move.position.pieces, ...(witness ? { point_binding: witness } : {}) }],
        sicSituationCard: { strategy: selected.id, need: 'Place the pieces in the matching openings', situation, evidence, agenda: entries, mode,
          triggerCard: card, focus: box(local.position.pieces[move.position.selected]!),
          related: box(local.position.pieces[1 - move.position.selected]!), target: box(local.model.targets.find(goal => !local.position.pieces.some(p => eq(p, goal)))!) },
        question: { reason: situation, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: situation, relations: ['contributes_to:' + parent] }],
        sicLocalDecision: { strategy: selected.id, objective: { id, label: navigationPrimitives[selected.id], parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: situation,
          preconditions: {}, preserve_refs: [], evidence, actions: [action], outcome_guard: { path: ['value'], contains: id } },
      };
    },
    before(proposal, index, _packet, current) {
      const admitted = index === 0 && proposal.binding?.observation_ref === current.observation_ref;
      return { admitted, reason: admitted ? 'piece_move_bound' : 'piece_layout_changed' };
    },
    after(proposal, _index, before, after, _first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true, reason: 'official_boundary',
        sic_need: { id: proposal.needId, status: 'satisfied' } };
      const result = returned(second, proposal);
      const matched = result !== null && (key(result) === key(proposal.move.position) || proposal.move.contact !== undefined && key(result) !== key(proposal.local.position));
      return { matched, seal_prefix: true, reason: matched ? 'piece_positions_observed' : 'piece_projection_unconfirmed' };
    },
    record(before, after, _action, _first, second, proposal) {
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const { local, move } = proposal, result = returned(second, proposal);
      state = { ...local, position: result ?? local.position, refs: result ? [...local.refs.slice(-4), after.observation_ref] : local.refs,
        attempts: result && key(result) === key(move.position) ? local.attempts : { ...local.attempts, [proposal.attempt]: (local.attempts[proposal.attempt] ?? 0) + 1 } };
      return { events: [] };
    },
    state: () => ({ state }),
    restore(value: NativeRecord) { state = structuredClone(value.state as State | null); },
  };
}
