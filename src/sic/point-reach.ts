import { geometricComponents, ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeFamily, NativePoint, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { navigationPrimitives, resolveNavigationPrimitives } from './navigation-primitives.ts';
import { blockedRouteStep, rememberRouteRefusal, type RouteRefusals } from './route-refusals.ts';
import { sicNeedId } from './need-identity.ts';

export const pointReachId = 'sic_point_reach';

type Part = ReturnType<typeof geometricComponents>[number];
type Layout = { color: number; field: NativeBox; goal: NativeBox; inset: NativeBox; side: number; reserve: NativeBox; reserveColor: number };
type Memory = { epoch: number; layout: Layout; radius: number; evidence: string[]; blocked: RouteRefusals; unitCost: number | null };
type Proposal = NativeProposal & { local: Memory; actor: NativePoint; target: NativePoint; reserve: number; needId: string };

const width = ([l, , r]: NativeBox) => r - l + 1;
const height = ([, t, , b]: NativeBox) => b - t + 1;
const center = ([l, t, r, b]: NativeBox): NativePoint => [Math.floor((l + r) / 2), Math.floor((t + b) / 2)];
const same = (a: NativePoint, b: NativePoint) => a[0] === b[0] && a[1] === b[1];
const inside = ([l, t, r, b]: NativeBox, [x, y]: NativePoint) => x >= l && x <= r && y >= t && y <= b;
const square = (p: Part, n: number) => width(p.bbox) === n && height(p.bbox) === n && p.area === n ** 2;

function layoutFor(rows: NativeRows, parts: Part[]): Layout | null {
  const frameWidth = rows[0]?.length ?? 0;
  const candidates: Layout[] = [];
  for (const field of parts.filter(p => width(p.bbox) === frameWidth && p.area > frameWidth * rows.length * 0.65)) {
    const markers = parts.filter(p => p.bbox[3] < field.bbox[1] && square(p, width(p.bbox)) && width(p.bbox) >= 2 && width(p.bbox) <= 5);
    const reserves = parts.filter(p => p.bbox[1] > field.bbox[3] && height(p.bbox) === 1 && width(p.bbox) >= frameWidth / 2);
    if (markers.length !== 1 || reserves.length !== 1) continue;
    const mark = markers[0]!, reserve = reserves[0]!, side = width(mark.bbox);
    const actor = parts.filter(p => p.color === mark.color && square(p, side) && inside(field.bbox, center(p.bbox)));
    if (actor.length !== 1) continue;
    const n = 3 * side;
    const goals = parts.filter(p => width(p.bbox) === n && height(p.bbox) === n && p.area > n * n / 2
      && inside(field.bbox, center(p.bbox)));
    if (goals.length !== 1) continue;
    const goal = goals[0]!.bbox;
    const inset = parts.find(p => square(p, side) && same(center(p.bbox), center(goal)) && p.bbox[0] > goal[0] && p.bbox[2] < goal[2]);
    if (inset) candidates.push({ color: mark.color, field: field.bbox, side, goal, inset: inset.bbox, reserve: reserve.bbox, reserveColor: reserve.color });
  }
  return candidates.length === 1 ? candidates[0]! : null;
}

function at(parts: Part[], layout: Layout): NativePoint | null {
  const found = parts.filter(p => p.color === layout.color && square(p, layout.side) && inside(layout.field, center(p.bbox)));
  return found.length === 1 ? center(found[0]!.bbox) : null;
}

function reserveOf(rows: NativeRows, layout: Layout): number {
  const [l, y, r] = layout.reserve;
  return rows[y]!.slice(l, r + 1).filter(p => p === layout.reserveColor).length;
}

function nextPoint(actor: NativePoint, local: Memory): NativePoint | null {
  const { goal, field, side } = local.layout;
  const [x, y] = actor, [gx, gy] = center(goal);
  const dx = gx - x, dy = gy - y;
  const intended = Math.hypot(dx, dy);
  if (!intended) return null;
  const steps: NativePoint[] = [];
  for (let distance = Math.min(intended, local.radius || side * 2 * Math.SQRT2); distance >= 1; distance--) {
    const scale = distance / intended;
    const target: NativePoint = [x + Math.round(dx * scale), y + Math.round(dy * scale)];
    if (!same(actor, target) && inside(field, target) && !blockedRouteStep(local.blocked, actor, target.join(','))) steps.push(target);
  }
  return steps[0] ?? null;
}

export function createSicPointReach(): NativeFamily<Proposal> {
  let memory: Memory | null = null;
  return {
    id: pointReachId,
    async propose(observation, rows, _inputs, remaining, execution): Promise<Proposal | null> {
      if (remaining < 1 || !observation.available_action_refs.includes('ACTION6')
        || observation.available_action_refs.some(ref => /^ACTION[1-5]$/.test(ref))) return null;
      const prior = memory?.epoch === observation.level_epoch ? memory : null;
      const parts = geometricComponents(rows), layout = prior?.layout ?? layoutFor(rows, parts);
      if (!layout) return null;
      const local = prior ?? { epoch: observation.level_epoch, layout, evidence: [], radius: 0, blocked: [], unitCost: null };
      const actor = at(parts, layout), reserve = reserveOf(rows, layout);
      if (!actor || reserve < (local.unitCost ?? 1)) return null;
      const target = nextPoint(actor, local);
      if (!target) return null;

      const ref = observation.observation_ref;
      const evidence: [string, ...string[]] = [ref, ...local.evidence.filter(value => value !== ref)];
      const mode = execution?.reasoningMode ?? 'exploration', contact = inside(layout.goal, target);
      const offer = { input: 'ACTION6', expected: target, evidence };
      const { selected, entries, card } = resolveNavigationPrimitives({ mode, evidence, probe: local.radius ? null : offer,
        access: local.radius && !contact ? offer : null, interaction: local.radius && contact ? offer : null });
      if (!selected) return null;
      const witness = await ObservedInputDomain.makeLocusWitness(observation, rows, target, { reason: 'Point within the candidate control range', evidence });
      if (!witness) return null;
      const parent = 'G_official_completion';
      const objective = { kind: 'reach_receptor_with_measured_point_control', scope: ref.split(':revision:', 1)[0]!,
        subjects: [layout.goal.join(',')], parentObjective: parent, satisfactionContract: 'official_progress_after_receptor_contact' };
      const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence };
      const id = pointReachId + ':' + need.id, action = { action_ref: 'ACTION6', data: { x: target[0], y: target[1] } };
      const half = Math.floor(layout.side / 2);
      const sprite = ([x, y]: NativePoint): NativeBox => [x - half, y - half, x - half + layout.side - 1, y - half + layout.side - 1];
      const situation = selected.id === 'P05' ? 'Test whether the sprite can move to a nearby point and measure the cost'
        : contact ? 'Test contact with the framed receptor using the measured range' : 'Move toward the receptor in steps supported by the measured range';
      return {
        status: 'proposed', kind: pointReachId, local, actor, target, reserve, needId: need.id,
        binding: { observation_ref: ref, level_epoch: observation.level_epoch }, actions: [action], steps: [{ action, expected_after: target, point_binding: witness }],
        sicSituationCard: { strategy: selected.id, need: 'Reach the receptor within the visible reserve', situation, evidence, agenda: entries,
          mode, triggerCard: card, actor: sprite(actor), focus: sprite(target), goal: layout.goal, reserve: layout.reserve },
        question: { reason: situation, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: situation, relations: ['contributes_to:' + parent] }],
        sicLocalDecision: { strategy: selected.id, objective: { id, label: navigationPrimitives[selected.id], parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: situation,
          preconditions: {}, preserve_refs: [], evidence, actions: [action], outcome_guard: { path: ['value'], contains: id } },
      };
    },
    before(proposal, index, _packet, observation) {
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref;
      return { admitted, reason: admitted ? 'point_move_bound' : 'point_move_context_changed' };
    },
    after(proposal, _index, before, after, _first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true, reason: 'official_boundary',
        sic_need: { id: proposal.needId, status: 'satisfied' } };
      const actual = at(geometricComponents(second), proposal.local.layout);
      const arrived = !!actual && same(actual, proposal.target);
      const spent = proposal.reserve - reserveOf(second, proposal.local.layout);
      return { matched: arrived && (proposal.local.unitCost === null || spent === proposal.local.unitCost), seal_prefix: true,
        reason: arrived ? 'point_landing_observed' : spent > 0 ? 'point_refused_and_reserve_spent' : 'point_landing_missing' };
    },
    record(before, after, _action, _first, second, proposal) {
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const { local, actor, target, reserve } = proposal;
      const actual = at(geometricComponents(second), local.layout), arrived = !!actual && same(actual, target);
      const distance = Math.hypot(actor[0] - target[0], actor[1] - target[1]);
      const cost = reserve - reserveOf(second, local.layout);
      memory = { ...local, radius: arrived ? Math.max(local.radius, distance) : local.radius,
        unitCost: cost > 0 ? cost : local.unitCost, evidence: [...local.evidence.slice(-4), after.observation_ref],
        blocked: arrived ? local.blocked : rememberRouteRefusal(local.blocked, actor, target.join(','), after.observation_ref) };
      return { events: [] };
    },
    state: () => ({ memory }),
    restore(value: NativeRecord) { memory = structuredClone(value.memory as Memory | null); },
  };
}
