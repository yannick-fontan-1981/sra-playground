import { geometricComponents } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeFamily, NativePoint, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { navigationPrimitives, resolveNavigationPrimitives } from './navigation-primitives.ts';
import { sicNeedId } from './need-identity.ts';

export const pivotCargoId = 'sic_pivot_cargo';

const directions = [['ACTION1', 0, -1], ['ACTION2', 0, 1], ['ACTION3', -1, 0], ['ACTION4', 1, 0]] as const;
type Layout = { origin: NativePoint; pitch: number; floor: string[]; destinations: string[][]; pivot: string[];
  actorColor: number; core: number; initial: Position; freeColors: number[] };
type Position = { actor: NativePoint; cargo: NativePoint[][]; held: number; delivered: number };
type Intent = 'move' | 'attach' | 'turn' | 'drop';
type Move = { input: string; intent: Intent; next: Position; subject: number };
type Memory = { epoch: number; layout: Layout; at: Position; steps: Move[]; refs: string[]; moves: boolean; interactions: Intent[]; failed: boolean };
type Proposal = NativeProposal & { local: Memory; move: Move; needId: string };

const key = (p: NativePoint) => p.join(',');
const same = (a: NativePoint, b: NativePoint) => a[0] === b[0] && a[1] === b[1];
const shift = ([x, y]: NativePoint, dx: number, dy: number): NativePoint => [x + dx, y + dy];
const aligned = (points: NativePoint[], other: NativePoint[]) => points.length === other.length && points.every(p => other.some(q => same(p, q)));
const identity = (s: Position) => [key(s.actor), s.held, s.delivered, ...s.cargo.map(p => p.map(key).sort().join(';'))].join('/');
const width = ([l, , r]: NativeBox) => r - l + 1;
const height = ([, t, , b]: NativeBox) => b - t + 1;

function patch(rows: NativeRows, [x, y]: NativePoint, pitch: number) {
  return rows.slice(y, y + pitch).flatMap(row => row.slice(x, x + pitch));
}

function tileBox({ origin, pitch }: Layout, [x, y]: NativePoint): NativeBox {
  const a = origin[0] + x * pitch, b = origin[1] + y * pitch;
  return [a, b, a + pitch - 1, b + pitch - 1];
}

function groups(points: NativePoint[]): NativePoint[][] {
  const clusters: NativePoint[][] = [];
  for (const p of points) {
    const adjacent = clusters.filter(a => a.some(q => Math.abs(q[0] - p[0]) + Math.abs(q[1] - p[1]) === 1));
    for (const a of adjacent) clusters.splice(clusters.indexOf(a), 1);
    clusters.push([p, ...adjacent.flat()]);
  }
  return clusters;
}

function measure(rows: NativeRows): Layout[] {
  const parts = geometricComponents(rows);
  const results: Layout[] = [];
  for (const field of parts.filter(p => width(p.bbox) === height(p.bbox) && width(p.bbox) >= 30 && p.area > width(p.bbox) * 4)) {
    for (const pitch of [4, 5, 6]) {
      const side = width(field.bbox) / pitch;
      if (!Number.isInteger(side) || side > 12 || side < 6) continue;
      const origin: NativePoint = [field.bbox[0], field.bbox[1]];
      const cores = new Set(parts.filter(p => p.area === 1 && p.bbox[0] >= origin[0] && p.bbox[1] >= origin[1]
        && (p.bbox[0] - origin[0]) % pitch === Math.floor(pitch / 2)
        && (p.bbox[1] - origin[1]) % pitch === Math.floor(pitch / 2)).map(p => p.color));
      const nodes = Array.from({ length: side * side }, (_, i): NativePoint => [i % side, Math.floor(i / side)]).map(point => {
        const pixels = patch(rows, [origin[0] + point[0] * pitch, origin[1] + point[1] * pitch], pitch);
        const shell = pixels[0]!, core = pixels[Math.floor(pitch / 2) * (pitch + 1)]!;
        return { point, shell, core, count: pixels.filter(v => v === shell).length };
      });
      const easy = nodes.filter(n => n.shell === field.color && n.count >= pitch ** 2 - 1);
      if (easy.length < 20) continue;
      const tokens = nodes.filter(n => n.count === pitch ** 2 - 1 && n.shell !== field.color && n.shell !== n.core && cores.has(n.core));
      const coreCounts = new Map<number, number>();
      for (const token of tokens) coreCounts.set(token.core, (coreCounts.get(token.core) ?? 0) + 1);
      const tokenCores = [...coreCounts].filter(([, n]) => n >= 4).map(([color]) => color);
      if (tokenCores.length !== 1) continue;
      const core = tokenCores[0]!;
      const objects = tokens.filter(n => n.core === core);
      const actorColors = [...new Set(objects.map(n => n.shell))].filter(color => {
        return objects.filter(n => n.shell === color).length === 1
          && parts.some(p => p.color === color && p.bbox[1] > field.bbox[3] && height(p.bbox) === 2 && width(p.bbox) >= 2);
      });
      if (actorColors.length !== 1) continue;
      const actorColor = actorColors[0]!, actor = objects.find(n => n.shell === actorColor)!;
      const cargoColors = [...new Set(objects.filter(n => n !== actor).map(n => n.shell))];
      if (cargoColors.length !== 2) continue;
      const cargo = cargoColors.flatMap(color => groups(objects.filter(n => n.shell === color).map(n => n.point))
        .map(points => ({ color, points })));
      if (cargo.length < 2 || cargo.length > 5) continue;
      const inset = nodes.filter(n => n.count === pitch ** 2 - (pitch - 2) ** 2 && n.shell !== n.core && !cargoColors.includes(n.shell));
      const insets = [...new Set(inset.map(n => n.core))].map(c => inset.filter(n => n.core === c).map(n => key(n.point)));
      const size = cargoColors.map(c => cargo.filter(g => g.color === c).reduce((n, g) => n + g.points.length, 0));
      if (insets.length !== 3) continue;
      for (const first of insets.filter(g => g.length === size[0])) for (const second of insets.filter(g => g !== first && g.length === size[1])) {
        const pivot = insets.find(g => g !== first && g !== second)!;
        results.push({ origin, pitch, floor: [...easy, ...objects, ...inset].map(n => key(n.point)),
          destinations: cargo.map(g => g.color === cargoColors[0] ? first : second), pivot, actorColor, core,
          freeColors: cargo.map(g => g.color), initial: { actor: actor.point, cargo: cargo.map(g => g.points), held: -1, delivered: 0 } });
      }
    }
  }
  return results;
}

function search(layout: Layout, start: Position): Move[] | null {
  const floor = new Set(layout.floor), pivot = new Set(layout.pivot), done = (1 << start.cargo.length) - 1;
  const queue: { at: Position; parent: number; move: Move | null }[] = [{ at: start, parent: -1, move: null }];
  const seen = new Set([identity(start)]);
  for (let i = 0; i < queue.length && i < 12000; i++) {
    const { at } = queue[i]!;
    if (at.delivered === done) {
      const steps: Move[] = [];
      for (let j = i; j >= 0 && queue[j]!.move; j = queue[j]!.parent) steps.push(queue[j]!.move!);
      return steps.reverse();
    }
    const fixed = new Set(at.cargo.flatMap((group, j) => j === at.held ? [] : group.map(key)));
    const occupiable = (p: NativePoint) => floor.has(key(p)) && !fixed.has(key(p));
    const offer = (input: string, intent: Intent, next: Position, subject: number) => {
      const id = identity(next);
      if (seen.has(id)) return;
      seen.add(id);
      queue.push({ at: next, parent: i, move: { input, intent, next, subject } });
    };
    for (const [input, dx, dy] of directions) {
      const actor = shift(at.actor, dx, dy);
      if (!occupiable(actor)) continue;
      const moving = at.held >= 0 ? at.cargo[at.held]!.map(p => shift(p, dx, dy)) : [];
      if (!moving.every(occupiable)) continue;
      offer(input, 'move', { ...at, actor, cargo: at.cargo.map((p, j) => j === at.held ? moving : p) }, at.held);
    }
    if (at.held < 0) {
      const adjacent = at.cargo.flatMap((group, j) => !(at.delivered & (1 << j)) && group.some(p => directions.some(([, x, y]) => same(p, shift(at.actor, x, y)))) ? [j] : []);
      if (adjacent.length === 1) offer('ACTION5', 'attach', { ...at, held: adjacent[0]! }, adjacent[0]!);
      continue;
    }
    const cargo = at.cargo[at.held]!;
    if (cargo.every(p => layout.destinations[at.held]!.includes(key(p)))) {
      offer('ACTION5', 'drop', { ...at, delivered: at.delivered | (1 << at.held), held: -1 }, at.held);
      continue;
    }
    if (!pivot.has(key(at.actor))) continue;
    const [x, y] = at.actor;
    const rotated = cargo.map(([a, b]): NativePoint => [x + y - b, y + a - x]);
    if (rotated.every(occupiable) && !rotated.some(p => same(p, at.actor)) && !aligned(rotated, cargo)) {
      offer('ACTION5', 'turn', { ...at, cargo: at.cargo.map((p, j) => j === at.held ? rotated : p) }, at.held);
    }
  }
  return null;
}

function witnessed(rows: NativeRows, { local, move }: Proposal): boolean {
  const { layout } = local, { next } = move;
  const color = (point: NativePoint) => {
    const [x, y] = tileBox(layout, point);
    const cells = patch(rows, [x, y], layout.pitch);
    return cells[Math.floor(layout.pitch / 2) * (layout.pitch + 1)] === layout.core ? cells[0] : undefined;
  };
  if (color(next.actor) !== layout.actorColor || !same(local.at.actor, next.actor) && color(local.at.actor) === layout.actorColor) return false;
  return next.cargo.every((group, i) => {
    const shell = color(group[0]!);
    if (shell === undefined || shell === layout.actorColor || group.some(p => color(p) !== shell)) return false;
    if (move.intent === 'attach' && i === move.subject) return shell !== layout.freeColors[i];
    if (move.intent === 'drop' && i === move.subject) return shell === layout.freeColors[i];
    const removed = local.at.cargo[i]!.filter(p => !group.some(q => same(q, p)));
    return removed.every(p => next.cargo.some(g => g.some(q => same(p, q))) || color(p) !== shell);
  });
}

function initial(rows: NativeRows, epoch: number): Memory | null {
  const options = measure(rows).flatMap(layout => {
    const steps = search(layout, layout.initial);
    return steps?.length ? [{ layout, steps }] : [];
  });
  if (options.length !== 1) return null;
  const { layout, steps } = options[0]!;
  return { epoch, layout, steps, at: layout.initial, refs: [], moves: false, interactions: [], failed: false };
}

export function createSicPivotCargo(): NativeFamily<Proposal> {
  let state: Memory | null = null;
  return {
    id: pivotCargoId,
    propose(observation, rows, _inputs, remaining, execution): Proposal | null {
      if (remaining < 1 || !['ACTION1', 'ACTION2', 'ACTION3', 'ACTION4', 'ACTION5'].every(ref => observation.available_action_refs.includes(ref))
        || observation.available_action_refs.includes('ACTION6')) return null;
      const local = state?.epoch === observation.level_epoch ? state : initial(rows, observation.level_epoch);
      const move = local?.steps[0];
      if (!local || local.failed || !move) return null;
      const ref = observation.observation_ref;
      const evidence: [string, ...string[]] = [ref, ...local.refs.filter(r => r !== ref)];
      const mode = execution?.reasoningMode ?? 'exploration';
      const motion = move.intent === 'move', known = motion ? local.moves : local.interactions.includes(move.intent);
      const offer = { input: move.input, expected: move.next.actor, evidence };
      const { selected, entries, card } = resolveNavigationPrimitives({ mode, evidence,
        probe: known ? null : offer, access: motion && known ? offer : null, interaction: !motion && known ? offer : null });
      if (!selected) return null;
      const parent = 'G_official_completion';
      const objective = { kind: 'fit_cargo_onto_compatible_pads', scope: ref.split(':revision:', 1)[0]!,
        subjects: ['carrier', 'cargo', 'pivot_surface', 'receiving_cells'], parentObjective: parent, satisfactionContract: 'official_progress_after_all_deliveries' };
      const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence };
      const id = pivotCargoId + ':' + need.id, action = { action_ref: move.input, data: {} };
      const situation = { move: 'Translate the carrier and verify the position of every attached tile', attach: 'Test attaching the adjacent cargo',
        turn: 'Test rotating the cargo without crossing occupied cells', drop: 'Release the cargo onto its compatible pads' }[move.intent];
      const subject = move.subject >= 0 ? move.subject : local.steps.find(m => m.subject >= 0)?.subject ?? -1;
      const { layout } = local;
      const tile = (p: string) => tileBox(layout, p.split(',').map(Number) as [number, number]);
      return {
        status: 'proposed', kind: pivotCargoId, local, move, needId: need.id,
        binding: { observation_ref: ref, level_epoch: observation.level_epoch }, actions: [action], steps: [{ action, expected_after: move.next.actor }],
        sicSituationCard: { strategy: selected.id, need: 'Deliver the differently shaped cargo', situation, evidence, agenda: entries, mode,
          triggerCard: card, actor: tileBox(layout, local.at.actor), cargo: local.at.cargo[subject]?.map(p => tileBox(layout, p)),
          receivers: layout.destinations[subject]?.map(tile), pivot: move.intent === 'turn' ? layout.pivot.map(tile) : [] },
        question: { reason: situation, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: situation, relations: ['contributes_to:' + parent] }],
        sicLocalDecision: { strategy: selected.id, objective: { id, label: navigationPrimitives[selected.id], parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: situation,
          preconditions: {}, preserve_refs: [], evidence, actions: [action], outcome_guard: { path: ['value'], contains: id } },
      };
    },
    before(proposal, index, _packet, observation) {
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref;
      return { admitted, reason: admitted ? 'cargo_step_bound' : 'cargo_observation_changed' };
    },
    after(proposal, _index, before, after, _first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true, reason: 'official_boundary',
        sic_need: { id: proposal.needId, status: 'satisfied' } };
      const matched = witnessed(second, proposal);
      return { matched, seal_prefix: true, reason: matched ? { move: 'cargo_translation_confirmed', attach: 'cargo_attachment_confirmed',
        turn: 'cargo_rotation_confirmed', drop: 'cargo_delivery_confirmed' }[proposal.move.intent] : 'cargo_projection_contradicted' };
    },
    record(before, after, _action, _first, second, proposal) {
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const { local, move } = proposal, matched = witnessed(second, proposal);
      state = { ...local, failed: !matched, at: matched ? move.next : local.at, steps: matched ? local.steps.slice(1) : local.steps,
        moves: local.moves || matched && move.intent === 'move',
        interactions: matched && !local.interactions.includes(move.intent) ? [...local.interactions, move.intent] : local.interactions,
        refs: matched ? [...local.refs.slice(-5), after.observation_ref] : local.refs };
      return { events: [] };
    },
    state: () => ({ state }),
    restore(value: NativeRecord) { state = structuredClone(value.state as Memory | null); },
  };
}
