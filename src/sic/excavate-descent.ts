import { geometricComponents, ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeCommand, NativeFamily, NativePoint, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { navigationPrimitives, resolveNavigationPrimitives } from './navigation-primitives.ts';
import { sicNeedId } from './need-identity.ts';

export const excavateDescentId = 'sic_excavate_descent';

type Part = ReturnType<typeof geometricComponents>[number];
type Layout = { pitch: number; phaseX: number; phaseY: number; actorColor: number; blockColor: number; wallColor: number; airColor: number };
type Tile = 'block' | 'wall' | 'air' | 'target';
type Scene = { actor: Part; at: NativePoint; goal: Part | null; tiles: Record<string, Tile> };
type Step = { action: NativeCommand; at: NativePoint };
type Plan = { score: number; steps: Step[]; drop: boolean };
type State = { epoch: number; layout: Layout; rejected: string[]; refs: string[]; removalRef: string | null };
type Proposal = NativeProposal & { local: State; scene: Scene; step: Step; drop: boolean; needId: string };

const key = (p: NativePoint) => p.join(',');
const width = ([l, , r]: NativeBox) => r - l + 1;
const height = ([, t, , b]: NativeBox) => b - t + 1;
const center = ([l, t, r, b]: NativeBox): NativePoint => [Math.floor((l + r) / 2), Math.floor((t + b) / 2)];
const isActor = (p: Part) => p.area === 6 && width(p.bbox) === 2 && height(p.bbox) === 4;
const signature = (step: Step) => step.action.action_ref + '/' + key(step.at);

function patch(rows: NativeRows, [x, y]: NativePoint, side: number) {
  const half = Math.floor(side / 2);
  return rows.slice(y - half, y - half + side).flatMap(row => row.slice(x - half, x - half + side));
}

function initial(rows: NativeRows, parts: Part[]): Layout | null {
  const bodies = parts.filter(isActor);
  if (bodies.length !== 1) return null;
  const actor = bodies[0]!;
  const blockGroups = new Map<number, Part[]>();
  for (const p of parts) {
    if (width(p.bbox) !== 5 || height(p.bbox) !== 5 || p.area !== 21) continue;
    blockGroups.set(p.color, [...blockGroups.get(p.color) ?? [], p]);
  }
  const groups = [...blockGroups.values()].filter(g => g.length >= 5);
  if (groups.length !== 1) return null;
  const blocks = groups[0]!, pitch = width(blocks[0]!.bbox) + 1;
  const [bx, by] = center(blocks[0]!.bbox), phaseX = bx % pitch, phaseY = by % pitch;
  if (blocks.some(b => center(b.bbox)[0] % pitch !== phaseX || center(b.bbox)[1] % pitch !== phaseY)) return null;
  const [ax, ay] = center(actor.bbox), air = rows[ay]?.[ax + pitch];
  const wall = rows[ay]?.[phaseX];
  if (air === undefined || wall === undefined || air === wall || blocks[0]!.color === air || blocks[0]!.color === wall) return null;
  return { pitch, phaseX, phaseY, actorColor: actor.color, blockColor: blocks[0]!.color, airColor: air, wallColor: wall };
}

function sceneFor(rows: NativeRows, parts: Part[], layout: Layout): Scene | null {
  const { pitch, phaseX, phaseY, actorColor, blockColor, wallColor, airColor } = layout;
  const actor = parts.find(p => p.color === actorColor && isActor(p));
  if (!actor) return null;
  const at: NativePoint = [Math.round((center(actor.bbox)[0] - phaseX) / pitch) * pitch + phaseX, actor.bbox[1] + 2];
  if (at[1] % pitch !== phaseY) return null;
  const targets = parts.filter(p => p.area === 5 && width(p.bbox) === 3 && height(p.bbox) === 3
    && p.color !== airColor && p.color !== wallColor && p.color !== blockColor && p.color !== actorColor
    && center(p.bbox).every((v, i) => (v - at[i]!) % pitch < 2 && (v - at[i]!) % pitch > -2));
  const goal = targets.length === 1 ? targets[0]! : null;
  const tiles: Record<string, Tile> = {};
  for (let y = phaseY; y + 2 < rows.length - 1; y += pitch) {
    for (let x = phaseX; x + 2 < rows[y]!.length; x += pitch) {
      const pixels = patch(rows, [x, y], pitch - 1);
      const block = pixels.filter(c => c === blockColor).length;
      const solid = pixels.filter(c => c === wallColor).length;
      if (goal && Math.abs(center(goal.bbox)[0] - x) < 3 && Math.abs(center(goal.bbox)[1] - y) < 3) tiles[key([x, y])] = 'target';
      else if (block === 21) tiles[key([x, y])] = 'block';
      else if (solid >= 20) tiles[key([x, y])] = 'wall';
      else if (pixels.length === 25 && pixels.every(c => c === airColor)) tiles[key([x, y])] = 'air';
    }
  }
  tiles[key(at)] = 'air';
  return { actor, at, goal, tiles };
}

function route(scene: Scene, local: State): Plan | null {
  const { pitch } = local.layout, [start, y] = scene.at;
  const tile = (x: number, y: number) => scene.tiles[key([x, y])];
  const dropScore = (x: number, first: number, base: number) => {
    let n = base, test = first;
    while (tile(x, test) === 'air') { n++; test -= pitch; }
    return n * 4 + (tile(x, test) === 'target' ? 120 : 0);
  };
  const click = (x: number, y: number): Step => ({ action: { action_ref: 'ACTION6', data: { x, y } }, at: [x, y] });
  const queue: { x: number; steps: Step[] }[] = [{ x: start, steps: [] }];
  const seen = new Set([start]);
  const options: Plan[] = [];
  for (const current of queue) {
    for (const d of [-pitch, pitch]) {
      const x = current.x + d, t = tile(x, y);
      if (t === 'block') {
        options.push({ score: 1, steps: [...current.steps, click(x, y)], drop: false });
        continue;
      }
      if (seen.has(x) || (t !== 'air' && t !== 'target')) continue;
      seen.add(x);
      const move: Step = { action: { action_ref: d < 0 ? 'ACTION3' : 'ACTION4', data: {} }, at: [x, y] };
      const steps = [...current.steps, move];
      const score = t === 'target' ? 240 : dropScore(x, y - pitch, 0);
      if (score) options.push({ score, steps, drop: steps.length === 1 && t !== 'target' });
      else queue.push({ x, steps });
    }
    if (tile(current.x, y - pitch) === 'block') {
      const score = dropScore(current.x, y - 2 * pitch, 1);
      options.push({ score, steps: [...current.steps, click(current.x, y - pitch)], drop: current.steps.length === 0 });
    }
  }
  options.sort((a, b) => b.score - a.score || a.steps.length - b.steps.length);
  return options.find(p => !local.rejected.includes(signature(p.steps[0]!))) ?? null;
}

function resultOf(first: NativeRows, second: NativeRows, proposal: Proposal) {
  const { layout } = proposal.local;
  const measured = sceneFor(second, geometricComponents(second), layout);
  if (!measured) return { matched: false, reason: 'excavation_or_motion_unverified' };
  const old = proposal.scene.at, next = measured.at, target = proposal.step.at;
  if (!first.slice(0, -2).some((row, y) => row.some((v, x) => v !== second[y]?.[x]))) {
    return { matched: false, reason: 'only_reserve_changed' };
  }
  if (proposal.step.action.action_ref === 'ACTION6') {
    const opened = measured.tiles[key(target)] !== 'block';
    const newView = Object.entries(proposal.scene.tiles).filter(([k, t]) => measured.tiles[k] !== t).length > 4;
    return { matched: opened || proposal.drop && newView, reason: proposal.drop && newView ? 'support_opened_and_view_shifted'
      : opened ? 'blocking_tile_removed' : 'predicted_tile_still_present' };
  }
  const matched = next[0] === target[0] && next[0] !== old[0];
  return { matched, reason: matched ? 'lateral_displacement_observed' : next[0] === old[0] ? 'lateral_move_refused' : 'lateral_displacement_diverged' };
}

export function createSicExcavateDescent(): NativeFamily<Proposal> {
  let state: State | null = null;
  return {
    id: excavateDescentId,
    async propose(observation, rows, _inputs, remaining, execution): Promise<Proposal | null> {
      if (remaining < 1 || !['ACTION3', 'ACTION4', 'ACTION6'].every(ref => observation.available_action_refs.includes(ref))
        || ['ACTION1', 'ACTION2', 'ACTION5'].some(ref => observation.available_action_refs.includes(ref))) return null;
      const prior = state?.epoch === observation.level_epoch ? state : null;
      const parts = geometricComponents(rows), layout = prior?.layout ?? initial(rows, parts);
      if (!layout) return null;
      const scene = sceneFor(rows, parts, layout);
      if (!scene) return null;
      const local = prior ?? { epoch: observation.level_epoch, layout, rejected: [], refs: [], removalRef: null };
      const plan = route(scene, local);
      if (!plan) return null;
      const step = plan.steps[0]!, pointCommand = step.action.action_ref === 'ACTION6';
      const ref = observation.observation_ref;
      const evidence: [string, ...string[]] = [ref, ...new Set([...local.refs, ...(local.removalRef ? [local.removalRef] : [])].filter(value => value !== ref))];
      const mode = execution?.reasoningMode ?? 'exploration';
      const offer = { input: step.action.action_ref, expected: step.at, evidence };
      const { selected, entries, card } = resolveNavigationPrimitives({ mode, evidence,
        probe: (pointCommand ? !local.removalRef : !local.refs.length) ? offer : null,
        access: local.refs.length && !pointCommand ? offer : null,
        interaction: local.removalRef && pointCommand ? offer : null });
      if (!selected) return null;
      const witness = pointCommand ? await ObservedInputDomain.makeLocusWitness(observation, rows, step.at, { reason: 'Visible block on the route', evidence }) : null;
      if (pointCommand && !witness) return null;
      const parent = 'G_official_completion';
      const objective = { kind: 'open_route_to_lower_regions', scope: ref.split(':revision:', 1)[0]!,
        subjects: ['controlled_piece', 'removable_support', 'lower_route'], parentObjective: parent,
        satisfactionContract: 'official_progress_after_descent_or_contact' };
      const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence };
      const id = excavateDescentId + ':' + need.id, [x, y] = step.at;
      const situation = pointCommand ? 'Remove a blocking tile and check whether the view follows a drop'
        : scene.goal ? 'Move through the current corridor toward access to the visible marker'
          : 'Follow the measured lateral control toward a visible opening';
      return {
        status: 'proposed', kind: excavateDescentId, local, scene, step, drop: plan.drop, needId: need.id,
        binding: { observation_ref: ref, level_epoch: observation.level_epoch }, actions: [step.action],
        steps: [{ action: step.action, expected_after: step.at, ...(witness ? { point_binding: witness } : {}) }],
        sicSituationCard: { strategy: selected.id, need: 'Open access to the lower route', situation, evidence, agenda: entries, mode,
          triggerCard: card, actor: scene.actor.bbox, focus: [x - 2, y - 2, x + 2, y + 2], goal: scene.goal?.bbox ?? null },
        question: { reason: situation, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: situation, relations: ['contributes_to:' + parent] }],
        sicLocalDecision: { strategy: selected.id, objective: { id, label: navigationPrimitives[selected.id], parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: situation,
          preconditions: {}, preserve_refs: [], evidence, actions: [step.action], outcome_guard: { path: ['value'], contains: id } },
      };
    },
    before(proposal, index, _packet, observation) {
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref;
      return { admitted, reason: admitted ? 'descent_step_bound' : 'descent_observation_changed' };
    },
    after(proposal, _index, before, after, first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true, reason: 'official_boundary',
        sic_need: { id: proposal.needId, status: 'satisfied' } };
      return { ...resultOf(first, second, proposal), seal_prefix: true };
    },
    record(before, after, _action, first, second, proposal) {
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const { local, step } = proposal, matched = resultOf(first, second, proposal).matched;
      state = { ...local, refs: matched ? [...local.refs.slice(-4), after.observation_ref] : local.refs,
        removalRef: matched && step.action.action_ref === 'ACTION6' ? after.observation_ref : local.removalRef,
        rejected: matched ? [] : [...local.rejected, signature(step)] };
      return { events: [] };
    },
    state: () => ({ state }),
    restore(value: NativeRecord) { state = structuredClone(value.state as State | null); },
  };
}
