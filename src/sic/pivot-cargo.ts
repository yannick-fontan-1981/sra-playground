import { geometricComponents } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeExecution, NativeFamily, NativePoint, NativeProgramHandle, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { chooseLanding, landingModule } from './highlighted-route-card.ts';
import { navigationPrimitives, resolveNavigationPrimitives } from './navigation-primitives.ts';
import { sicNeedId } from './need-identity.ts';
import { observedMechanicsGroup } from './strategy-agenda.ts';

export const pivotCargoId = 'sic_pivot_cargo';
export const learnPivotCargoId = 'sic_deliver_cargo_after_observed_motion';

const directions = [['ACTION1', 0, -1], ['ACTION2', 0, 1], ['ACTION3', -1, 0], ['ACTION4', 1, 0]] as const;
type Layout = { origin: NativePoint; pitch: number; floor: string[]; destinations: string[][]; pivot: string[];
  actorColor: number; core: number; initial: Position; freeColors: number[]; receiverColors?: number[] };
type Position = { actor: NativePoint; cargo: NativePoint[][]; held: number; delivered: number };
type Intent = 'move' | 'attach' | 'turn' | 'drop';
type Move = { input: string; intent: Intent; next: Position; subject: number };
type Memory = { epoch: number; layout: Layout; at: Position; steps: Move[]; refs: string[]; moves: boolean; interactions: Intent[]; failed: boolean };
type Landing = { point: NativePoint; pixels: number[] };
type Proposal = NativeProposal & { local: Memory; move: Move; needId: string; landings?: Landing[][] };
type ReceiverBinding = { cargo: number; receiver: number };
type CargoWitness = { epoch: number; score: number; pitch: number; actorColor: number; core: number; interactions: Intent[]; refs: string[];
  receivers?: ReceiverBinding[] };
type Component = ReturnType<typeof geometricComponents>[number];
type Field = Pick<Component, 'bbox' | 'color' | 'area'>;

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

function splitFields(parts: Component[], rows: NativeRows): Field[] {
  const found = new Map<string, Field>();
  for (const pitch of [4, 5, 6]) {
    const lattice = new Map<string, Component[]>();
    for (const part of parts) {
      const [left, top, right, bottom] = part.bbox;
      if (left <= 0 || top <= 0 || right >= rows[0]!.length - 1 || bottom >= rows.length - 2
        || width(part.bbox) % pitch || height(part.bbox) % pitch || part.area < pitch ** 2) continue;
      const group = [part.color, left % pitch, top % pitch].join(',');
      lattice.set(group, [...(lattice.get(group) ?? []), part]);
    }
    for (const domains of lattice.values()) {
      if (domains.length < 2) continue;
      const bbox: NativeBox = [Math.min(...domains.map(p => p.bbox[0])), Math.min(...domains.map(p => p.bbox[1])),
        Math.max(...domains.map(p => p.bbox[2])), Math.max(...domains.map(p => p.bbox[3]))];
      if (width(bbox) < 30 || width(bbox) !== height(bbox)) continue;
      const area = domains.reduce((sum, part) => sum + part.area, 0), color = domains[0]!.color;
      if (area > width(bbox) * 4) found.set([color, ...bbox].join(','), { bbox, color, area });
    }
  }
  return [...found.values()];
}

function measure(rows: NativeRows, reassemble = false, receivers?: ReceiverBinding[]): Layout[] {
  const parts = geometricComponents(rows);
  const results: Layout[] = [];
  const fields = reassemble ? splitFields(parts, rows)
    : parts.filter(p => width(p.bbox) === height(p.bbox) && width(p.bbox) >= 30 && p.area > width(p.bbox) * 4);
  for (const field of fields) {
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
      const insets = [...new Set(inset.map(n => n.core))].map(color =>
        ({ color, cells: inset.filter(n => n.core === color).map(n => key(n.point)) }));
      const size = cargoColors.map(c => cargo.filter(g => g.color === c).reduce((n, g) => n + g.points.length, 0));
      if (insets.length !== 3) continue;
      const fitting = (i: number) => insets.filter(group => receivers
        ? group.cells.length >= size[i]! && receivers.some(binding => binding.cargo === cargoColors[i] && binding.receiver === group.color)
        : group.cells.length === size[i]);
      for (const first of fitting(0)) for (const second of fitting(1).filter(group => group !== first)) {
        const pivot = insets.find(g => g !== first && g !== second)!;
        results.push({ origin, pitch, floor: [...easy, ...objects, ...inset].map(n => key(n.point)),
          destinations: cargo.map(g => (g.color === cargoColors[0] ? first : second).cells), pivot: pivot.cells, actorColor, core,
          freeColors: cargo.map(g => g.color), receiverColors: cargo.map(g => (g.color === cargoColors[0] ? first : second).color),
          initial: { actor: actor.point, cargo: cargo.map(g => g.points), held: -1, delivered: 0 } });
      }
    }
  }
  return results;
}

function* cargoRoutes(layout: Layout, start: Position, stopAtDelivery: boolean, budget: { remaining: number },
  subject?: number): Generator<Move[]> {
  const floor = new Set(layout.floor), pivot = new Set(layout.pivot), done = (1 << start.cargo.length) - 1;
  const queue: { at: Position; parent: number; move: Move | null }[] = [{ at: start, parent: -1, move: null }];
  const seen = new Set([identity(start)]);
  for (let i = 0; i < queue.length && budget.remaining > 0; i++) {
    budget.remaining--;
    const { at } = queue[i]!;
    if (at.delivered === done || stopAtDelivery && at.delivered !== start.delivered) {
      const steps: Move[] = [];
      for (let j = i; j >= 0 && queue[j]!.move; j = queue[j]!.parent) steps.push(queue[j]!.move!);
      yield steps.reverse();
      if (!stopAtDelivery) return;
      continue;
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
      if (adjacent.length === 1 && (subject === undefined || subject === adjacent[0])) {
        offer('ACTION5', 'attach', { ...at, held: adjacent[0]! }, adjacent[0]!);
      }
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
}

function search(layout: Layout, start: Position): Move[] | null {
  const candidate = cargoRoutes(layout, start, false, { remaining: 12_000 }).next();
  return candidate.done ? null : candidate.value;
}

function searchByDelivery(layout: Layout, start: Position, varyPlacements = false): Move[] | null {
  const done = (1 << start.cargo.length) - 1, bestAt = new Map<string, number>(), budget = { remaining: 80_000 };
  const alternativeLimit = varyPlacements ? 16 : 5;
  let best: Move[] | null = null;
  function visit(at: Position, prefix: Move[]) {
    // Each segment ends at a supported drop. Keep the resting carrier pose because
    // it changes the cost and feasibility of reaching the next cargo.
    if (prefix.length >= (best?.length ?? Infinity)) return;
    if (at.delivered === done) {
      best = prefix;
      return;
    }
    const signature = identity(at);
    if (prefix.length >= (bestAt.get(signature) ?? Infinity)) return;
    bestAt.set(signature, prefix.length);
    for (let subject = 0; subject < at.cargo.length; subject++) {
      if (at.delivered & (1 << subject) || at.held >= 0 && at.held !== subject) continue;
      let alternatives = 0;
      const triedPlacements = varyPlacements ? new Map<string, number>() : null;
      for (const segment of cargoRoutes(layout, at, true, budget, subject)) {
        if (prefix.length + segment.length >= (best?.length ?? Infinity)) break;
        const next = segment.at(-1)!.next;
        if (triedPlacements) {
          // A delivery can occupy different cells, even when it uses the same receiving pad.
          const placement = next.cargo[subject]!.map(key).sort().join(';');
          const poses = triedPlacements.get(placement) ?? 0;
          if (poses >= 3) continue;
          triedPlacements.set(placement, poses + 1);
        }
        visit(next, [...prefix, ...segment]);
        if (++alternatives >= alternativeLimit) break;
      }
    }
  }
  visit(start, []);
  return best;
}

function observeAttachmentSplit(layout: Layout, at: Position, move: Move, before: NativeRows, after: NativeRows) {
  if (move.intent !== 'attach' || at.held >= 0) return null;
  const { subject } = move, cargo = at.cargo[subject]!, free = layout.freeColors[subject]!;
  if (cargo.length < 2) return null;
  const cells = (rows: NativeRows, point: NativePoint) => {
    const [x, y] = tileBox(layout, point);
    return patch(rows, [x, y], layout.pitch);
  };
  const coreIndex = Math.floor(layout.pitch / 2) * (layout.pitch + 1);
  const changed: NativePoint[] = [], resting: NativePoint[] = [], palettes = new Set<number>();
  for (const point of cargo) {
    const first = cells(before, point), second = cells(after, point);
    const ink = second[0];
    if (first.length !== layout.pitch ** 2 || second.length !== first.length
      || first[coreIndex] !== layout.core || first.some((value, i) => i !== coreIndex && value !== free)
      || ink === undefined || ink === layout.actorColor
      || second[coreIndex] !== layout.core || second.some((value, i) => i !== coreIndex && value !== ink)) return null;
    if (ink === free) resting.push(point);
    else {
      palettes.add(ink);
      changed.push(point);
    }
  }
  if (!resting.length || !changed.length || palettes.size !== 1 || groups(changed).length !== 1
    || !changed.some(point => directions.some(([, x, y]) => same(point, shift(at.actor, x, y))))) return null;
  const subjectTiles = new Set(cargo.map(key));
  for (const tile of layout.floor) {
    if (subjectTiles.has(tile)) continue;
    const point = tile.split(',').map(Number) as [number, number];
    const first = cells(before, point), second = cells(after, point);
    if (first.some((value, i) => second[i] !== value)) return null;
  }
  const parts = groups(resting);
  const nextCargo = [...at.cargo.map((tiles, i) => i === subject ? changed : tiles), ...parts];
  if (nextCargo.length >= 31) return null;
  const next: Position = { ...at, held: subject, cargo: nextCargo };
  const refined: Layout = {
    ...layout, initial: next,
    destinations: [...layout.destinations, ...parts.map(() => layout.destinations[subject]!)],
    freeColors: [...layout.freeColors, ...parts.map(() => free)],
    ...(layout.receiverColors ? { receiverColors: [...layout.receiverColors, ...parts.map(() => layout.receiverColors![subject]!)] } : {}),
  };
  return { layout: refined, next };
}

function witnessed(rows: NativeRows, layout: Layout, at: Position, move: Move): boolean {
  const { next } = move;
  const color = (point: NativePoint) => {
    const [x, y] = tileBox(layout, point);
    const cells = patch(rows, [x, y], layout.pitch);
    return cells[Math.floor(layout.pitch / 2) * (layout.pitch + 1)] === layout.core ? cells[0] : undefined;
  };
  if (color(next.actor) !== layout.actorColor || !same(at.actor, next.actor) && color(at.actor) === layout.actorColor) return false;
  return next.cargo.every((group, i) => {
    const shell = color(group[0]!);
    if (shell === undefined || shell === layout.actorColor || group.some(p => color(p) !== shell)) return false;
    if (move.intent === 'attach' && i === move.subject) return shell !== layout.freeColors[i];
    if (move.intent === 'drop' && i === move.subject) return shell === layout.freeColors[i];
    const removed = at.cargo[i]!.filter(p => !group.some(q => same(q, p)));
    return removed.every(p => next.cargo.some(g => g.some(q => same(p, q))) || color(p) !== shell);
  });
}

function translationLandings(rows: NativeRows, local: Memory, remaining: number): Landing[][] {
  const { layout, at, steps } = local;
  const occupied = new Set([key(at.actor), ...at.cargo.flat().map(key)]);
  const moving = (position: Position) => [position.actor, ...(position.cargo[position.held] ?? [])];
  const result: Landing[][] = [];
  let previous = at;
  for (const move of steps.slice(0, remaining)) {
    if (move.intent !== 'move') break;
    const entering = moving(move.next).filter(point => !moving(previous).some(current => same(current, point)));
    // A cell vacated earlier in this series has no observed background at
    // planning time. Rebind it at the next decision instead of guessing.
    if (entering.some(point => occupied.has(key(point)))) break;
    const landings = entering.map(point => {
      const [x, y] = tileBox(layout, point);
      return { point, pixels: patch(rows, [x, y], layout.pitch) };
    });
    if (landings.some(landing => landing.pixels.length !== layout.pitch ** 2)) break;
    result.push(landings);
    previous = move.next;
  }
  return result;
}

function initial(rows: NativeRows, epoch: number, witness: CargoWitness | null): Memory | null {
  const ordinary = measure(rows);
  const layouts = !ordinary.length && witness ? measure(rows, true) : ordinary;
  let options = layouts.flatMap(layout => {
    const steps = search(layout, layout.initial);
    return steps?.length ? [{ layout, steps }] : [];
  });
  if (!options.length && witness?.receivers?.length) {
    const bindingLayouts = measure(rows, !ordinary.length, witness.receivers)
      .filter(layout => witness.pitch === layout.pitch && witness.actorColor === layout.actorColor && witness.core === layout.core);
    for (const varyPlacements of [false, true]) {
      options = bindingLayouts.flatMap(layout => {
        const steps = searchByDelivery(layout, layout.initial, varyPlacements);
        return steps?.length ? [{ layout, steps }] : [];
      });
      if (options.length) break;
    }
  }
  if (options.length !== 1) return null;
  const { layout, steps } = options[0]!;
  const prior = witness?.pitch === layout.pitch && witness.actorColor === layout.actorColor && witness.core === layout.core ? witness : null;
  if (!ordinary.length && !prior) return null;
  return { epoch, layout, steps, at: layout.initial, refs: prior?.refs ?? [], moves: !!prior, interactions: prior?.interactions ?? [], failed: false };
}

function acquireMotion(rows: NativeRows, ref: string, epoch: number, execution: NativeExecution | undefined): Memory | null {
  const receipt = execution?.readPriorDirectionalScene?.(rows => measure(rows));
  if (!receipt || receipt.afterRef !== ref || receipt.levelEpoch !== epoch) return null;
  const direction = directions.find(([input]) => input === receipt.command);
  if (!direction) return null;
  const [input, dx, dy] = direction;
  const options = receipt.scene.flatMap(layout => {
    const at = layout.initial, actor = shift(at.actor, dx, dy);
    if (!layout.floor.includes(key(actor)) || at.cargo.some(group => group.some(point => same(point, actor)))) return [];
    const next = { ...at, actor };
    if (!witnessed(rows, layout, at, { input, intent: 'move', next, subject: -1 })) return [];
    const steps = search(layout, next);
    return steps?.length ? [{ layout, at: next, steps }] : [];
  });
  if (options.length !== 1) return null;
  return { ...options[0]!, epoch, moves: true, interactions: [], failed: false, refs: [receipt.beforeRef, ref] };
}

export function createSicPivotCargo(family = pivotCargoId): NativeFamily<Proposal> {
  const learns = family === learnPivotCargoId;
  let state: Memory | null = null;
  let witness: CargoWitness | null = null;
  let decide: NativeProgramHandle | undefined;
  return {
    id: family,
    async attachPrograms(registry) {
      if (learns) decide = await registry.registerProgram(chooseLanding, {}, await landingModule());
    },
    proposeInGroup(group, observation, rows, inputs, remaining, execution) {
      if (group === observedMechanicsGroup && (witness?.epoch !== observation.level_epoch || witness.score !== observation.levels_completed)) return null;
      return this.propose(observation, rows, inputs, remaining, execution);
    },
    async propose(observation, rows, _inputs, remaining, execution): Promise<Proposal | null> {
      if (remaining < 1 || !['ACTION1', 'ACTION2', 'ACTION3', 'ACTION4', 'ACTION5'].every(ref => observation.available_action_refs.includes(ref))
        || observation.available_action_refs.includes('ACTION6')) return null;
      const ref = observation.observation_ref;
      const trained = witness?.epoch === observation.level_epoch && witness.score === observation.levels_completed ? witness : null;
      const local = state?.epoch === observation.level_epoch ? state
        : learns ? acquireMotion(rows, ref, observation.level_epoch, execution) : initial(rows, observation.level_epoch, trained);
      const move = local?.steps[0];
      if (!local || local.failed || !move) return null;
      const evidence: [string, ...string[]] = [ref, ...local.refs.filter(r => r !== ref)];
      const mode = execution?.reasoningMode ?? 'exploration';
      const motion = move.intent === 'move', known = motion ? local.moves : local.interactions.includes(move.intent);
      const offer = { input: move.input, expected: move.next.actor, evidence };
      const facts = { routeSupported: motion && known, eligibleProbe: !known, knownInteraction: !motion && known, mode };
      const decision = learns ? await decide?.run({ situation: facts }, { signal: execution?.signal }) : null;
      const primitive = !known ? 'P05' : motion ? 'P07' : 'P02';
      if (learns && decision?.result !== primitive) return null;
      const navigation = learns ? null : resolveNavigationPrimitives({ mode, evidence,
        probe: known ? null : offer, access: motion && known ? offer : null, interaction: !motion && known ? offer : null });
      const strategy = learns ? primitive : navigation?.selected?.id;
      if (!strategy) return null;
      const parent = 'G_official_completion';
      const objective = { kind: 'fit_cargo_onto_compatible_pads', scope: ref.split(':revision:', 1)[0]!,
        subjects: ['carrier', 'cargo', 'pivot_surface', 'receiving_cells'], parentObjective: parent, satisfactionContract: 'official_progress_after_all_deliveries' };
      const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence };
      const id = pivotCargoId + ':' + need.id, action = { action_ref: move.input, data: {} };
      const landings = motion && known ? translationLandings(rows, local, remaining) : [];
      const series = landings.length > 1 ? local.steps.slice(0, landings.length) : [move];
      const actions = series.length > 1 ? series.map(step => ({ action_ref: step.input, data: {} })) : [action];
      const situation = { move: 'Translate the carrier and verify the position of every attached tile', attach: 'Test attaching the adjacent cargo',
        turn: 'Test rotating the cargo without crossing occupied cells', drop: 'Release the cargo onto its compatible pads' }[move.intent];
      const subject = move.subject >= 0 ? move.subject : local.steps.find(m => m.subject >= 0)?.subject ?? -1;
      const { layout } = local;
      const tile = (p: string) => tileBox(layout, p.split(',').map(Number) as [number, number]);
      return {
        status: 'proposed', kind: family, local, move, needId: need.id,
        binding: { observation_ref: ref, level_epoch: observation.level_epoch }, actions,
        steps: series.map((step, index) => ({ action: actions[index], expected_after: step.next.actor })),
        ...(series.length > 1 ? { landings } : {}),
        ...(decision ? { sicSrcDecision: { workflow: decision.receipt.workflow, hash: decision.receipt.src_hash,
          instructions: decision.receipt.instructions, edited: 'edited' in decision.receipt && decision.receipt.edited === true, situation: facts } } : {}),
        sicSituationCard: { strategy, need: 'Deliver the differently shaped cargo', situation, evidence, agenda: navigation?.entries ?? [], mode,
          triggerCard: navigation?.card ?? decision?.receipt.workflow, actor: tileBox(layout, local.at.actor), cargo: local.at.cargo[subject]?.map(p => tileBox(layout, p)),
          receivers: layout.destinations[subject]?.map(tile), pivot: move.intent === 'turn' ? layout.pivot.map(tile) : [],
          ...(series.length > 1 ? { plannedSeries: series.map(step => step.next.actor) } : {}) },
        question: { reason: situation, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: situation, relations: ['contributes_to:' + parent] }],
        sicLocalDecision: { strategy, objective: { id, label: navigationPrimitives[strategy], parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: situation,
          preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } },
      };
    },
    before(proposal, index, packet, observation) {
      if (index > 0) {
        const { layout } = proposal.local, landing = proposal.landings?.[index];
        const admitted = proposal.binding?.level_epoch === observation.level_epoch && !!landing && landing.every(expected => {
          const [x, y] = tileBox(layout, expected.point);
          const actual = patch(packet.frame_rows, [x, y], layout.pitch);
          return actual.length === expected.pixels.length && actual.every((value, i) => value === expected.pixels[i]);
        });
        return { admitted, reason: admitted ? 'cargo_landing_still_available' : 'cargo_landing_changed' };
      }
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref;
      return { admitted, reason: admitted ? 'cargo_step_bound' : 'cargo_observation_changed' };
    },
    after(proposal, index, before, after, first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true, reason: 'official_boundary',
        sic_need: { id: proposal.needId, status: 'satisfied' } };
      const { local } = proposal, move = local.steps[index]!;
      const at = local.steps[index - 1]?.next ?? local.at;
      const matched = witnessed(second, local.layout, at, move);
      if (!matched && observeAttachmentSplit(local.layout, at, move, first, second)) {
        return { matched: true, seal_prefix: true, reason: 'attachment_distinguishes_touching_loads' };
      }
      return { matched, seal_prefix: !matched || index + 1 === proposal.actions.length,
        reason: matched ? { move: 'cargo_translation_confirmed', attach: 'cargo_attachment_confirmed',
          turn: 'cargo_rotation_confirmed', drop: 'cargo_delivery_confirmed' }[move.intent] : 'cargo_projection_contradicted' };
    },
    record(before, after, _action, first, second, proposal, index) {
      const local = index > 0 && state?.epoch === proposal.local.epoch ? state : proposal.local;
      const move = local.steps[0]!;
      if (!learns && after.levels_completed > before.levels_completed && local.moves && move.intent === 'drop'
        && move.next.delivered === (1 << local.at.cargo.length) - 1 && local.interactions.includes('attach')) {
        const { actorColor, core, pitch, freeColors, receiverColors } = local.layout;
        const receivers = receiverColors && [...new Map(freeColors.map((cargo, i) => [cargo, { cargo, receiver: receiverColors[i]! }])).values()];
        witness = { epoch: after.level_epoch, score: after.levels_completed, actorColor, core, pitch,
          interactions: [...new Set([...local.interactions, move.intent])], refs: [...local.refs.slice(-4), before.observation_ref, after.observation_ref],
          ...(receivers ? { receivers } : {}) };
      }
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const matched = witnessed(second, local.layout, local.at, move);
      const split = !matched ? observeAttachmentSplit(local.layout, local.at, move, first, second) : null;
      if (split) {
        const steps = search(split.layout, split.next) ?? searchByDelivery(split.layout, split.next, true);
        state = { ...local, layout: split.layout, at: split.next, steps: steps ?? [], failed: !steps,
          interactions: [...new Set<Intent>([...local.interactions, 'attach'])], refs: [...local.refs.slice(-5), after.observation_ref] };
        return { events: [], reviewEvidence: 'Only the adjacent portion changed to the carried color. The rest of the touching tiles stayed in place.' };
      }
      state = { ...local, failed: !matched, at: matched ? move.next : local.at, steps: matched ? local.steps.slice(1) : local.steps,
        moves: local.moves || matched && move.intent === 'move',
        interactions: matched && !local.interactions.includes(move.intent) ? [...local.interactions, move.intent] : local.interactions,
        refs: matched ? [...local.refs.slice(-5), after.observation_ref] : local.refs };
      return { events: [] };
    },
    state: () => ({ state, witness }),
    restore(value: NativeRecord) {
      state = structuredClone(value.state as Memory | null);
      witness = structuredClone((value.witness as CargoWitness | null | undefined) ?? null);
    },
  };
}
