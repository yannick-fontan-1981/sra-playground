import { geometricComponents } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeExecution, NativeFamily, NativePoint, NativeProgramHandle, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { chooseLanding, landingModule } from './highlighted-route-card.ts';
import { navigationPrimitives, resolveNavigationPrimitives } from './navigation-primitives.ts';
import { blockedRouteStep, rememberRouteRefusal, type RouteRefusals } from './route-refusals.ts';
import { sicNeedId } from './need-identity.ts';
import { observedMechanicsGroup } from './strategy-agenda.ts';
import { emptySurfaceMemory, measureSurface, planAcrossSurfaces, rememberSurface, rememberSurfaceStep,
  sameSurfaceAddress, surfaceDirections, surfacePoint,
  type SurfaceMemory, type SurfacePlan, type SurfaceRoles, type SurfaceView } from './observed-surfaces.ts';

export const switchedSurfaceId = 'sic_switched_surface';
export const learnSwitchedSurfaceId = 'sic_follow_observed_surface_change';
const directions = surfaceDirections;
type Direction = typeof directions[number];
type Part = ReturnType<typeof geometricComponents>[number];
type Mark = { point: NativePoint; color: number; box: NativeBox };
type Model = { epoch: number; actor: Mark; peer: Mark; ground: number; gates: NativePoint[]; pitch: number; refs: string[]; blocked: RouteRefusals;
  entry: { gate: NativePoint; outside: NativePoint } | null; count: number };
type Scene = { model: Model; actor: Mark; peer: Mark | null; context: string; ground: number };
type Step = { direction: Direction; at: NativePoint; floor: boolean };
type SurfaceWitness = { epoch: number; score: number; roles: SurfaceRoles; refs: string[] };
type LearnedSurfaces = { epoch: number; memory: SurfaceMemory; refs: string[] };
type Transfer = { view: SurfaceView; plan: SurfacePlan; local: LearnedSurfaces; roles: SurfaceRoles };
type Proposal = NativeProposal & ({ scene: Scene; step: Step; needId: string; transfer?: never }
  | { transfer: Transfer; needId: string });
const point = ([x, y]: NativeBox): NativePoint => [x, y];
const key = (a: NativePoint) => a.join(',');
const equal = (a: NativePoint, b: NativePoint) => a[0] === b[0] && a[1] === b[1];
const distance = (a: NativePoint, b: NativePoint) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
const width = ([l, , r]: NativeBox) => r - l + 1;
const height = ([, t, , b]: NativeBox) => b - t + 1;
const shift = ([x, y]: NativePoint, [, dx, dy]: Direction, n: number): NativePoint => [x + dx * n, y + dy * n];
const asMark = (p: Part): Mark => ({ point: point(p.bbox), color: p.color, box: p.bbox });
const square = (p: Part, n: number) => width(p.bbox) === n && height(p.bbox) === n && p.area === n * n;

function underlay(rows: NativeRows, [x, y]: NativePoint, n: number): number | null {
  const a = rows[y]?.[x];
  if (a === undefined || !rows[y + n - 1] || x < 0
    || !Array.from({ length: n }, (_, dy) => rows[y + dy]!.slice(x, x + n)).every(row => row.length === n && row.every(color => color === a))) return null;
  return a;
}

function initial(parts: Part[], rows: NativeRows, epoch: number): Model | null {
  const candidates: Model[] = [];
  const repeated = parts.filter(p => square(p, 4));
  for (const ground of new Set(repeated.map(p => p.color))) {
    const repeats = repeated.filter(p => p.color === ground);
    const pitch = width(repeats[0]!.bbox) + 1, [x, y] = point(repeats[0]!.bbox);
    const aligned = repeats.filter(p => (p.bbox[0] - x) % pitch === 0 && (p.bbox[1] - y) % pitch === 0);
    if (aligned.length < 20 || aligned.length * 4 < repeats.length * 3) continue;
    const marks = parts.filter(p => square(p, 2) && (p.bbox[0] - x - 1) % pitch === 0 && (p.bbox[1] - y - 1) % pitch === 0);
    if (marks.length !== 2 || marks[0]!.color === marks[1]!.color) continue;
    const frames = parts.filter(p => width(p.bbox) === pitch + 1 && height(p.bbox) === pitch + 1 && p.area === 4 * pitch
      && p.mask.filter(([x, y]) => x === 0 || y === 0 || x === pitch || y === pitch).length >= 3 * pitch);
    const groups = new Map<number, Part[]>();
    for (const p of frames) groups.set(p.color, [...groups.get(p.color) ?? [], p]);
    const banks = [...groups.values()].filter(group => group.length >= 3);
    if (banks.length !== 1) continue;
    const gates: NativePoint[] = banks[0]!.map(p => [p.bbox[0] + 2, p.bbox[1] + 2]);
    const [a, b] = marks.map(asMark) as [Mark, Mark];
    const first = (m: Mark) => Math.min(...gates.map(g => distance(g, m.point)));
    if (first(a) === first(b) && a.point[1] !== b.point[1]) continue;
    const [actor, peer] = first(a) <= first(b) ? [a, b] : [b, a];
    if (first(actor) !== pitch || first(peer) !== pitch) continue;
    const support = rows[actor.point[1] - 1]?.[actor.point[0]];
    if (support === undefined || support === ground) continue;
    candidates.push({ epoch, actor, peer, ground: support, pitch, gates, refs: [], blocked: [], entry: null, count: 0 });
  }
  return candidates.length === 1 ? candidates[0]! : null;
}

function sceneFor(rows: NativeRows, prior: Model | null, epoch: number): Scene | null {
  const parts = geometricComponents(rows);
  const model = prior ?? initial(parts, rows, epoch);
  if (!model) return null;
  const marks = (m: Mark) => parts.filter(p => square(p, 2) && p.color === m.color
    && (p.bbox[0] - m.point[0]) % model.pitch === 0 && (p.bbox[1] - m.point[1]) % model.pitch === 0);
  const actor = marks(model.actor), peer = marks(model.peer);
  if (actor.length !== 1 || peer.length > 1) return null;
  const a = asMark(actor[0]!);
  return { model, actor: a, peer: peer.length ? asMark(peer[0]!) : null, context: peer.length ? 'target-visible' : 'target-hidden', ground: model.ground };
}

function acquiredScene(rows: NativeRows, ref: string, epoch: number, execution: NativeExecution | undefined): Scene | null {
  const receipt = execution?.readPriorDirectionalScene?.(prior => sceneFor(prior, null, epoch));
  if (!receipt || receipt.afterRef !== ref || receipt.levelEpoch !== epoch || !receipt.scene.peer) return null;
  const { scene: before } = receipt;
  const step = directions.find(([command]) => command === receipt.command);
  if (!step) return null;
  const next = sceneFor(rows, before.model, epoch);
  if (!next || next.peer || !equal(next.actor.point, shift(before.actor.point, step, before.model.pitch))
    || !before.model.gates.some(gate => equal(gate, next.actor.point))) return null;
  const model: Model = { ...before.model, refs: [receipt.beforeRef, ref], count: 1,
    entry: { gate: next.actor.point, outside: before.actor.point } };
  return { ...next, model };
}

function pickStep(rows: NativeRows, scene: Scene): Step | null {
  const { model, actor, peer, ground, context } = scene;
  const { pitch, blocked } = model;
  const start = actor.point, target = peer?.point ?? model.peer.point;
  const isGate = (p: NativePoint) => model.gates.some(g => equal(g, p));
  const options = (p: NativePoint) => directions.flatMap(direction => {
    if (blockedRouteStep(blocked, p, direction[0], context)) return [];
    const at = shift(p, direction, pitch);
    if (!peer && model.entry && equal(p, model.entry.gate) && equal(at, model.entry.outside)) return [];
    const tile = underlay(rows, at, 2);
    const [x, y] = at;
    const surrounds = [rows[y - 1]?.[x], rows[y + 2]?.[x], rows[y]?.[x - 1], rows[y]?.[x + 2]];
    const floor = tile === ground || surrounds.filter(color => color === ground).length >= 3;
    if (!rows[y + 1] || x < 0 || x + 1 >= rows[y + 1]!.length) return [];
    return [{ direction, at, floor }];
  });
  if (peer && distance(start, target) === pitch) return options(start).find(s => equal(s.at, target)) ?? null;
  if (peer) {
    return options(start).filter(s => isGate(s.at)).sort((a, b) => distance(a.at, target) - distance(b.at, target))[0] ?? null;
  }

  const exits = model.gates.filter(g => distance(g, target) === pitch && (!model.entry || !equal(model.entry.gate, g)));
  const towardExit = (p: NativePoint) => Math.min(...exits.map(g => distance(p, g)));
  const queue: { at: NativePoint; first: Step | null }[] = [{ at: start, first: null }];
  const seen = new Set([key(start)]);
  for (const entry of queue) {
    const next = options(entry.at).filter(s => !seen.has(key(s.at)) && (s.floor || isGate(s.at)));
    next.sort((a, b) => towardExit(a.at) - towardExit(b.at) || distance(a.at, target) - distance(b.at, target));
    for (const step of next) {
      const first = entry.first ?? step;
      if (exits.some(g => equal(g, step.at)) && equal(shift(step.at, step.direction, pitch), target)) return first;
      if (!step.floor || isGate(step.at)) continue;
      seen.add(key(step.at));
      queue.push({ at: step.at, first });
    }
  }
  return options(start).sort((a, b) => Number(isGate(a.at)) - Number(isGate(b.at))
    || Number(b.floor) - Number(a.floor) || towardExit(a.at) - towardExit(b.at))[0] ?? null;
}

function calibrateSurface(model: Model, rows: NativeRows): SurfaceRoles | null {
  const { actor, peer, pitch, ground: support } = model, [x, y] = actor.point;
  const origin: NativePoint = [(x - 1) % pitch, (y - 1) % pitch];
  const gap = rows[origin[1] - 1]?.[origin[0] - 1];
  if (gap === undefined || gap === support) return null;
  return { actor: actor.color, goal: peer.color, origin, pitch, gap, support };
}

const sprite = ([x, y]: NativePoint): NativeBox => [x + 1, y + 1, x + 2, y + 2];

export function createSicSwitchedSurface(family = switchedSurfaceId): NativeFamily<Proposal> {
  const learns = family === learnSwitchedSurfaceId;
  let model: Model | null = null;
  let ascertained: { epoch: number; roles: SurfaceRoles; ref: string } | null = null;
  let witness: SurfaceWitness | null = null;
  let mapped: LearnedSurfaces | null = null;
  let decide: NativeProgramHandle | undefined;
  return {
    id: family,
    async attachPrograms(registry) {
      if (learns) decide = await registry.registerProgram(chooseLanding, {}, await landingModule());
    },
    async proposeInGroup(group, observation, rows, inputs, remaining, execution) {
      if (group !== observedMechanicsGroup) return this.propose(observation, rows, inputs, remaining, execution);
      if (witness?.epoch !== observation.level_epoch || witness.score !== observation.levels_completed) return null;
      const proposal = await this.propose(observation, rows, inputs, remaining, execution);
      return proposal?.transfer ? proposal : null;
    },
    async propose(observation, rows, _inputs, remaining, execution): Promise<Proposal | null> {
      if (remaining < 1 || !directions.every(([ref]) => observation.available_action_refs.includes(ref))
        || observation.available_action_refs.includes('ACTION6')) return null;
      const ref = observation.observation_ref;
      if (witness?.epoch === observation.level_epoch && witness.score === observation.levels_completed) {
        const { roles, refs } = witness, view = measureSurface(rows, roles);
        if (view) {
          const prior = mapped?.epoch === observation.level_epoch ? mapped : null;
          const memory = rememberSurface(prior?.memory ?? emptySurfaceMemory(), view);
          const plan = planAcrossSurfaces(memory, view.address, remaining);
          if (plan) {
            const local = { epoch: observation.level_epoch, memory, refs: prior?.refs ?? refs };
            const evidence: [string, ...string[]] = [ref, ...local.refs.filter(value => value !== ref)];
            const mode = execution?.reasoningMode ?? 'solving';
            const action = { action_ref: directions[plan.direction][0], data: {} }, actions = [action];
            const offer = { input: action.action_ref, expected: plan.expected?.cell ?? plan.focus.cell, evidence };
            const navigation = resolveNavigationPrimitives({ mode, evidence, probe: plan.kind === 'probe' ? offer : null,
              access: plan.kind !== 'probe' ? offer : null, interaction: null });
            const strategy = navigation.selected?.id;
            if (!strategy) return null;
            const situation = plan.kind === 'probe' ? 'Test a passage whose arrival is still unknown'
              : plan.kind === 'linked' ? 'Cross using a passage located on both surfaces'
                : 'Move through a visible cell toward the next passage or destination';
            const parent = 'G_official_completion';
            const objective = { kind: 'reach_target_across_observed_surfaces', scope: ref.split(':revision:', 1)[0]!,
              subjects: ['controlled_sprite', 'observed_surfaces', 'destination'], parentObjective: parent,
              satisfactionContract: 'verify_surface_transitions_and_official_progress' };
            const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence };
            const id = `mapped-surface:${need.id}`;
            return { status: 'proposed', kind: family, actions, transfer: { view, plan, local, roles }, needId: need.id,
              binding: { observation_ref: ref, level_epoch: observation.level_epoch }, steps: [{ action, expected_after: plan.expected }],
              sicSituationCard: { strategy, need: 'Reach the destination across the observed surfaces', situation, agenda: navigation.entries, mode,
                triggerCard: navigation.card, evidence, actor: sprite(surfacePoint(roles, view.address.cell)),
                focus: view.surface.goal ? sprite(surfacePoint(roles, view.surface.goal)) : null, landing: sprite(surfacePoint(roles, plan.focus.cell)) },
              question: { reason: situation, hypothesis_refs: evidence }, route_refs: evidence,
              compositions: [{ id, observed: false, open_question: situation, relations: [`contributes_to:${parent}`] }],
              sicLocalDecision: { strategy, objective: { id, label: navigationPrimitives[strategy], parent }, need },
              bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: situation,
                preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
          }
        }
      }
      const prior = model?.epoch === observation.level_epoch ? model : null;
      const scene = learns && !prior ? acquiredScene(rows, ref, observation.level_epoch, execution)
        : sceneFor(rows, prior, observation.level_epoch);
      if (!scene || scene.model.count >= 24) return null;
      const step = pickStep(rows, scene);
      if (!step) return null;
      const memory = scene.model;
      const evidence: [string, ...string[]] = [ref, ...memory.refs.filter(value => value !== ref)];
      const mode = execution?.reasoningMode ?? 'exploration';
      const action = { action_ref: step.direction[0], data: {} };
      const offer = { input: action.action_ref, expected: step.at, evidence };
      const contact = !!scene.peer && equal(step.at, scene.peer.point);
      const routeSupported = memory.refs.length > 0 && step.floor && !contact;
      const facts = { eligibleProbe: !routeSupported, routeSupported, knownInteraction: false, mode };
      const decision = learns ? await decide?.run({ situation: facts }, { signal: execution?.signal }) : null;
      const primitive = routeSupported ? 'P07' : 'P05';
      if (learns && decision?.result !== primitive) return null;
      const navigation = learns ? null : resolveNavigationPrimitives({
        mode, evidence, probe: !memory.refs.length || !step.floor && !contact ? offer : null,
        access: memory.refs.length && step.floor && !contact ? offer : null, interaction: contact ? offer : null,
      });
      const strategy = learns ? primitive : navigation?.selected?.id;
      if (!strategy) return null;
      const parent = 'G_official_completion';
      const objective = { kind: 'reach_peer_across_alternate_surface', scope: ref.split(':revision:', 1)[0]!,
        subjects: [key(memory.peer.point)], parentObjective: parent, satisfactionContract: 'official_progress_after_peer_contact' };
      const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence };
      const id = switchedSurfaceId + ':' + need.id;
      const [x, y] = step.at;
      const situation = contact ? 'Test contact with the visible target'
        : strategy === 'P05' ? 'Test access through the visible opening'
          : 'Use the current surface to reach the last observed target position';
      return {
        status: 'proposed', kind: family, scene, step, needId: need.id,
        binding: { observation_ref: ref, level_epoch: observation.level_epoch }, actions: [action], steps: [{ action, expected_after: step.at }],
        ...(decision ? { sicSrcDecision: { workflow: decision.receipt.workflow, hash: decision.receipt.src_hash,
          instructions: decision.receipt.instructions, edited: 'edited' in decision.receipt && decision.receipt.edited === true, situation: facts } } : {}),
        sicSituationCard: { strategy, need: 'Reach the target through the available surface', situation, evidence, agenda: navigation?.entries ?? [],
          mode, triggerCard: navigation?.card ?? decision?.receipt.workflow, actor: scene.actor.box, focus: scene.peer?.box ?? null,
          landing: [x, y, x + 1, y + 1] },
        question: { reason: situation, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: situation, relations: ['contributes_to:' + parent] }],
        sicLocalDecision: { strategy, objective: { id, label: navigationPrimitives[strategy], parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: situation,
          preconditions: {}, preserve_refs: [], evidence, actions: [action], outcome_guard: { path: ['value'], contains: id } },
      };
    },
    before(proposal, index, _packet, observation) {
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref;
      return { admitted, reason: admitted ? 'alternate_surface_step_bound' : 'alternate_surface_context_changed' };
    },
    after(proposal, _index, before, after, _first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true, reason: 'official_boundary',
        sic_need: { id: proposal.needId, status: 'satisfied' } };
      if (proposal.transfer) {
        const { view, plan, roles } = proposal.transfer, next = measureSurface(second, roles);
        const crossed = !!next && next.address.floor !== view.address.floor;
        const matched = !!next && (plan.expected ? sameSurfaceAddress(plan.expected, next.address)
          : crossed && equal(next.address.cell, plan.focus.cell));
        return { matched, seal_prefix: true, reason: crossed
          ? 'passage_and_arrival_surface_observed' : matched ? 'observed_surface_step' : 'record_surface_prediction_difference' };
      }
      const next = sceneFor(second, proposal.scene.model, before.level_epoch);
      const matched = !!next && equal(next.actor.point, proposal.step.at);
      return { matched, seal_prefix: true, reason: !matched ? 'surface_refused_predicted_step'
        : next?.context !== proposal.scene.context ? 'piece_moved_and_surface_changed' : 'piece_at_predicted_tile' };
    },
    record(before, after, _action, first, second, proposal) {
      if (proposal.transfer) {
        if (after.levels_completed > before.levels_completed && witness) {
          witness = { ...witness, epoch: after.level_epoch, score: after.levels_completed,
            refs: [...proposal.transfer.local.refs.slice(-4), after.observation_ref] };
          return { events: [] };
        }
        if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
        const { local, plan, roles, view } = proposal.transfer, next = measureSurface(second, roles);
        if (next) mapped = { epoch: local.epoch, memory: rememberSurfaceStep(local.memory, view, next, plan),
          refs: [...local.refs.slice(-6), after.observation_ref] };
        return { events: [], ...(next && next.address.floor !== view.address.floor ? { reviewEvidence: 'A passage changed the visible surface' } : {}) };
      }
      const { scene, step } = proposal;
      const sameLevel = before.level_epoch === after.level_epoch && before.state === after.state;
      const next = sameLevel ? sceneFor(second, scene.model, before.level_epoch) : null;
      if (!learns) {
        const prior = ascertained?.epoch === before.level_epoch ? ascertained : null;
        if (after.levels_completed > before.levels_completed && prior && scene.peer && equal(step.at, scene.peer.point)) {
          witness = { epoch: after.level_epoch, score: after.levels_completed, roles: prior.roles,
            refs: [prior.ref, before.observation_ref, after.observation_ref] };
        } else if (!prior && scene.peer && next && !next.peer) {
          const roles = calibrateSurface(scene.model, first);
          const a = roles && measureSurface(first, roles), b = roles && measureSurface(second, roles);
          if (roles && a && b && a.address.floor !== b.address.floor) {
            ascertained = { epoch: before.level_epoch, roles, ref: after.observation_ref };
          }
        }
      }
      if (!sameLevel) return { events: [] };
      const local = scene.model;
      const blocked = !!next && equal(next.actor.point, scene.actor.point) && next.context === scene.context;
      const entry = scene.peer && next && !next.peer ? { gate: next.actor.point, outside: scene.actor.point } : local.entry;
      model = { ...local, count: local.count + 1, refs: [...local.refs.slice(-5), after.observation_ref],
        entry, blocked: blocked ? rememberRouteRefusal(local.blocked, scene.actor.point, step.direction[0], after.observation_ref, scene.context) : local.blocked };
      return { events: [] };
    },
    state: () => ({ model, ascertained, witness, mapped }),
    restore(value: NativeRecord) {
      model = structuredClone(value.model as Model | null);
      ascertained = structuredClone((value.ascertained as typeof ascertained | undefined) ?? null);
      witness = structuredClone((value.witness as SurfaceWitness | null | undefined) ?? null);
      mapped = structuredClone((value.mapped as LearnedSurfaces | null | undefined) ?? null);
    },
  };
}
