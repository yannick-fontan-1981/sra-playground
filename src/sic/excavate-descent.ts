import { geometricComponents, ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeCommand, NativeFamily, NativePoint, NativeProgramHandle, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { navigationPrimitives } from './navigation-primitives.ts';
import { chooseLanding, landingModule } from './highlighted-route-card.ts';
import { sicNeedId } from './need-identity.ts';
import { maximumCommittedActions } from './plan-step.ts';

export const excavateDescentId = 'sic_excavate_descent';
export const verifyRemovableSupportId = 'sic_verify_removable_support';
export const learnRemovableSupportId = 'sic_learn_removable_support';

type Part = ReturnType<typeof geometricComponents>[number];
type Layout = { pitch: number; phaseX: number; phaseY: number; actorColor: number; blockColor: number; alternateColors?: number[]; wallColor: number; airColor: number };
type Tile = 'block' | 'wall' | 'air' | 'target' | 'passage' | 'unverified';
type Scene = { actor: Part; at: NativePoint; goal: Part | null; tiles: Record<string, Tile>; materials?: Record<string, number> };
type Step = { action: NativeCommand; at: NativePoint };
type Plan = { score: number; steps: Step[]; drop: boolean; restoreForm?: string };
type State = { epoch: number; layout: Layout; rejected: string[]; refs: string[]; removalRef: string | null; removalByColor?: Record<number,string>; entryTest?: EntryTest; entryForms?: Record<string,string>; restoredForms?: Record<string,string>; movementRef?: string };
type EntryTest = { from: NativePoint; to: NativePoint; form: string; changed: string };
type Proposal = NativeProposal & { restoreForm?: string; local: State; scene: Scene; step: Step; drop: boolean; needId: string; burst?: Step[] };

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
  let blocks: Part[];
  const alternateColors: number[] = [];
  if (groups.length === 1) blocks = groups[0]!;
  else {
    // Identical silhouettes on one lattice support a common geometry. Each ink
    // still needs its own witnessed result before a click is a known removal.
    const repeated = [...blockGroups.values()].filter(g => g.length >= 2);
    blocks = repeated.flat();
    if (repeated.length < 2 || blocks.length < 5) return null;
    const mask = JSON.stringify(blocks[0]!.mask);
    if (blocks.some(p => JSON.stringify(p.mask) !== mask)) return null;
    alternateColors.push(...repeated.slice(1).map(g => g[0]!.color));
  }
  const pitch = width(blocks[0]!.bbox) + 1;
  const [bx, by] = center(blocks[0]!.bbox), phaseX = bx % pitch, phaseY = by % pitch;
  if (blocks.some(b => center(b.bbox)[0] % pitch !== phaseX || center(b.bbox)[1] % pitch !== phaseY)) return null;
  const [ax, ay] = center(actor.bbox), air = rows[ay]?.[ax + pitch];
  const wall = rows[ay]?.[phaseX];
  if (air === undefined || wall === undefined || air === wall || blocks.some(p => p.color === air || p.color === wall)) return null;
  return { pitch, phaseX, phaseY, actorColor: actor.color, blockColor: blocks[0]!.color, ...(alternateColors.length ? { alternateColors } : {}), airColor: air, wallColor: wall };
}

function sceneFor(rows: NativeRows, parts: Part[], layout: Layout, entryForms?: Record<string,string>): Scene | null {
  const { pitch, phaseX, phaseY, actorColor, blockColor, wallColor, airColor } = layout;
  const actor = parts.find(p => p.color === actorColor && isActor(p));
  if (!actor) return null;
  const at: NativePoint = [Math.round((center(actor.bbox)[0] - phaseX) / pitch) * pitch + phaseX, actor.bbox[1] + 2];
  if (at[1] % pitch !== phaseY) return null;
  const targets = parts.filter(p => p.area === 5 && width(p.bbox) === 3 && height(p.bbox) === 3
    && p.color !== airColor && p.color !== wallColor && p.color !== blockColor && !layout.alternateColors?.includes(p.color) && p.color !== actorColor
    && center(p.bbox).every((v, i) => (v - at[i]!) % pitch < 2 && (v - at[i]!) % pitch > -2));
  const goal = targets.length === 1 ? targets[0]! : null;
  const tiles: Record<string, Tile> = {};
  const materials: Record<string, number> = {};
  const colors = [blockColor, ...(layout.alternateColors ?? [])];
  for (let y = phaseY; y + 2 < rows.length - 1; y += pitch) {
    for (let x = phaseX; x + 2 < rows[y]!.length; x += pitch) {
      const pixels = patch(rows, [x, y], pitch - 1);
      const material = colors.find(ink => pixels.filter(c => c === ink).length === 21);
      const solid = pixels.filter(c => c === wallColor).length;
      if (goal && Math.abs(center(goal.bbox)[0] - x) < 3 && Math.abs(center(goal.bbox)[1] - y) < 3) tiles[key([x, y])] = 'target';
      else if (material !== undefined) {
        tiles[key([x, y])] = 'block';
        if (layout.alternateColors) materials[key([x, y])] = material;
      }
      else if (solid >= 20) tiles[key([x, y])] = 'wall';
      else if (pixels.length === (pitch - 1) ** 2) {
        tiles[key([x, y])] = pixels.every(c => c === airColor) ? 'air' : entryForms?.[pixels.join(',')] ? 'passage' : 'unverified';
      }
    }
  }
  tiles[key(at)] = 'air';
  return { actor, at, goal, tiles, ...(layout.alternateColors ? {materials} : {}) };
}

function route(scene: Scene, local: State): Plan | null {
  const { pitch } = local.layout, [start, y] = scene.at;
  const tile = (x: number, y: number) => scene.tiles[key([x, y])];
  const dropScore = (x: number, first: number, base: number) => {
    let n = base, test = first;
    let crossesUnprovenSupport = false;
    while (tile(x, test) === 'air' || tile(x, test) === 'passage') {
      crossesUnprovenSupport ||= tile(x, test) === 'passage';
      n++; test -= pitch;
    }
    if (crossesUnprovenSupport && !tile(x, test)) return -1;
    if (n > 0) {
      const blockedSide = (side: number, row: number) => {
        const cell = tile(x + side * pitch, row);
        return cell !== 'air' && cell !== 'passage' && cell !== 'block' && cell !== 'target';
      };
      const boxed = (row: number) => blockedSide(-1, row) && blockedSide(1, row);
      // Check successive visible supports when the first landing has no lateral exit.
      if (boxed(test + pitch)) {
        let floor = test;
        while (tile(x, floor) === 'block' && boxed(floor + pitch)) {
          floor -= pitch;
          while (tile(x, floor) === 'air') floor -= pitch;
        }
        if (tile(x, floor) === 'unverified' || (tile(x, floor) === 'wall' && boxed(floor + pitch))) return -1;
      }
    }
    if (tile(x, test) === 'unverified') return -1;
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
      if (seen.has(x) || (t !== 'air' && t !== 'passage' && t !== 'target')) continue;
      seen.add(x);
      const move: Step = { action: { action_ref: d < 0 ? 'ACTION3' : 'ACTION4', data: {} }, at: [x, y] };
      const steps = [...current.steps, move];
      const score = t === 'target' ? 240 : dropScore(x, y - pitch, 0);
      if (score < 0) continue;
      if (score > 0) options.push({ score, steps, drop: steps.length === 1 && t !== 'target' });
      else queue.push({ x, steps });
    }
    if (tile(current.x, y - pitch) === 'block') {
      const score = dropScore(current.x, y - 2 * pitch, 1);
      if (score > 0) options.push({ score, steps: [...current.steps, click(current.x, y - pitch)], drop: current.steps.length === 0 });
    }
  }
  options.sort((a, b) => b.score - a.score || a.steps.length - b.steps.length);
  return options.find(p => !local.rejected.includes(signature(p.steps[0]!))) ?? null;
}

function restoreFooting(scene: Scene, local: State, rows: NativeRows): Plan | null {
  if (!local.entryForms) return null;
  const floorY = scene.at[1] - local.layout.pitch;
  const options = new Map<string, { step: Step; form: string }>();
  const hypothetical = { ...scene.tiles };
  for (const [site, tile] of Object.entries(scene.tiles)) {
    if (tile !== 'passage') continue;
    const [x, y] = site.split(',').map(Number) as [number, number];
    if (y !== floorY) continue;
    const at: NativePoint = [x, y];
    const step: Step = { at, action: { action_ref: 'ACTION6', data: { x, y } } };
    const form = patch(rows, at, local.layout.pitch - 1).join(',');
    if (!local.entryForms[form] || local.rejected.includes(signature(step))) continue;
    options.set(site, { step, form });
    hypothetical[site] = 'block';
  }
  if (!options.size) return null;
  const possible = route({ ...scene, tiles: hypothetical }, local);
  if (!possible) return null;
  // Change only a footing actually needed by the imagined walk. Replan from
  // the observed result before attempting the next member of the sequence.
  for (const leg of possible.steps) {
    if (leg.action.action_ref === 'ACTION6') continue;
    const required = options.get(key([leg.at[0], floorY]));
    if (required) return { score: possible.score, steps: [required.step], drop: false, restoreForm: required.form };
  }
  return null;
}

function resultOf(first: NativeRows, second: NativeRows, proposal: Pick<Proposal, 'local' | 'step' | 'scene' | 'drop' | 'restoreForm'>) {
  const { layout } = proposal.local;
  const measured = sceneFor(second, geometricComponents(second), layout);
  if (!measured) return { matched: false, reason: 'excavation_or_motion_unverified' };
  const old = proposal.scene.at, next = measured.at, target = proposal.step.at;
  if (!first.slice(0, -2).some((row, y) => row.some((v, x) => v !== second[y]?.[x]))) {
    return { matched: false, reason: 'only_reserve_changed' };
  }
  if (proposal.step.action.action_ref === 'ACTION6') {
    const tile = measured.tiles[key(target)];
    if (proposal.restoreForm) return {
      matched: tile === 'block',
      reason: tile === 'block' ? 'restored_support_shape_observed' : 'support_restoration_unverified',
    };
    const opened = proposal.local.layout.alternateColors ? tile === 'air' || tile === 'target' : tile !== 'block';
    const newView = Object.entries(proposal.scene.tiles).filter(([k, t]) => measured.tiles[k] !== t).length > 4;
    if (proposal.drop && newView) return { matched: true, reason: 'support_opened_and_view_shifted' };
    if (opened) return { matched: true, reason: 'blocking_tile_removed' };
    const changed = tile === 'unverified' && patch(first,target,layout.pitch-1).join(',') !== patch(second,target,layout.pitch-1).join(',');
    return { matched: false, reason: changed ? 'appearance_changed_entry_unverified' : 'predicted_tile_still_present' };
  }
  const matched = next[0] === target[0] && next[0] !== old[0];
  return { matched, reason: matched ? 'lateral_displacement_observed' : next[0] === old[0] ? 'lateral_move_refused' : 'lateral_displacement_diverged' };
}

function liveLeg(proposal: Proposal, index: number, rows: NativeRows) {
  if (index === 0) return proposal;
  const scene = sceneFor(rows, geometricComponents(rows), proposal.local.layout,proposal.local.entryForms);
  if (!scene || !proposal.burst) return null;
  const step = proposal.burst[index]!;
  const drop = step.action.action_ref === 'ACTION6' && step.at[0] === scene.at[0]
    && step.at[1] === scene.at[1] - proposal.local.layout.pitch;
  return { local: proposal.local, scene, step, drop };
}

export function createSicVerifyRemovableSupport(family = verifyRemovableSupportId): NativeFamily<Proposal> {
  const learns = family === learnRemovableSupportId;
  let state: State | null = null;
  let decide: NativeProgramHandle | undefined;
  return {
    id: family,
    async attachPrograms(registry) {
      decide = await registry.registerProgram(chooseLanding, {}, await landingModule());
    },
    async propose(observation, rows, _inputs, remaining, execution): Promise<Proposal | null> {
      if (remaining < 1 || !['ACTION3', 'ACTION4', 'ACTION6'].every(ref => observation.available_action_refs.includes(ref))
        || ['ACTION1', 'ACTION2', 'ACTION5'].some(ref => observation.available_action_refs.includes(ref))) return null;
      const prior = state?.epoch === observation.level_epoch ? state : null;
      const motion = learns && !prior ? execution?.readPriorDirectionalScene?.(previous => {
        const parts = geometricComponents(previous), layout = initial(previous, parts);
        const scene = layout && sceneFor(previous, parts, layout);
        return scene ? { layout: layout!, at: scene.at } : null;
      }) : null;
      if (learns && !prior && (!motion || motion.afterRef !== observation.observation_ref || motion.levelEpoch !== observation.level_epoch)) return null;
      const parts = geometricComponents(rows), layout = prior?.layout ?? motion?.scene.layout ?? initial(rows, parts);
      if (!layout) return null;
      const scene = sceneFor(rows, parts, layout,prior?.entryForms);
      if (!scene) return null;
      const dx = motion?.command === 'ACTION4' ? layout.pitch : motion?.command === 'ACTION3' ? -layout.pitch : 0;
      if (motion && (!dx || scene.at[0] !== motion.scene.at[0] + dx || scene.at[1] !== motion.scene.at[1])) return null;
      const local: State = prior ?? { epoch: observation.level_epoch, layout, rejected: [], refs: motion ? [motion.beforeRef] : [], removalRef: null,
        ...(motion ? { movementRef: motion.afterRef } : {}) };
      const test = local.entryTest;
      const testingEntry = !!test && key(scene.at) === key(test.from) && patch(rows,test.to,layout.pitch-1).join(',') === test.form;
      const probe: Step | null = testingEntry ? {
        at: test.to,
        action: { action_ref: test.to[0] < scene.at[0] ? 'ACTION3' : 'ACTION4', data: {} },
      } : null;
      const plan: Plan | null = probe ? { score: 0, steps: [probe], drop: false } : route(scene, local) ?? restoreFooting(scene, local, rows);
      if (!plan) return null;
      const step = plan.steps[0]!, pointCommand = step.action.action_ref === 'ACTION6';
      const ref = observation.observation_ref;
      const material = scene.materials?.[key(step.at)];
      const removalRef = plan.restoreForm ? local.restoredForms?.[plan.restoreForm] : material === undefined ? local.removalRef : local.removalByColor?.[material];
      const proof = [...local.refs, ...(testingEntry ? [test.changed] : []), ...Object.values(local.entryForms??{}), ...(removalRef ? [removalRef] : []), ...(local.movementRef ? [local.movementRef] : [])];
      const evidence: [string, ...string[]] = [ref, ...new Set(proof.filter(value => value !== ref))];
      const mode = execution?.reasoningMode ?? 'exploration';
      const routeSupported = !pointCommand && !!local.movementRef && !testingEntry;
      const knownInteraction = pointCommand && !!removalRef;
      const facts = { routeSupported, knownInteraction, eligibleProbe: !routeSupported && !knownInteraction, mode };
      const decision = await decide?.run({ situation: facts }, { signal: execution?.signal });
      const strategy = routeSupported ? 'P07' : knownInteraction ? 'P02' : 'P05';
      if (decision?.result !== strategy) return null;
      const witness = pointCommand ? await ObservedInputDomain.makeLocusWitness(observation, rows, step.at, { reason: 'Visible block on the route', evidence }) : null;
      if (pointCommand && !witness) return null;
      const parent = 'G_official_completion';
      const objective = { kind: 'open_route_to_lower_regions', scope: ref.split(':revision:', 1)[0]!,
        subjects: ['controlled_piece', 'removable_support', 'lower_route'], parentObjective: parent,
        satisfactionContract: 'official_progress_after_descent_or_contact' };
      const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence };
      const id = family + ':' + need.id, [x, y] = step.at;
      const situation = plan.restoreForm ? 'Test whether reversing a terrain change restores footing on a blocked route' : testingEntry ? 'Test whether a changed support permits entry while its mark is still visible' : pointCommand ? 'Remove a blocking tile and check whether the view follows a drop'
        : scene.goal ? 'Move through the current corridor toward access to the visible marker'
          : 'Follow the measured lateral control toward a visible opening';
      const burst = [step], actions = [step.action];
      const steps = [{ action: step.action, expected_after: step.at, ...(witness ? { point_binding: witness } : {}) }];
      if (routeSupported && !plan.drop) for (const next of plan.steps.slice(1, Math.min(remaining, maximumCommittedActions))) {
        const click = next.action.action_ref === 'ACTION6';
        const nextMaterial = scene.materials?.[key(next.at)];
        if (click && !(nextMaterial === undefined ? local.removalRef : local.removalByColor?.[nextMaterial])) break;
        const point = click ? await ObservedInputDomain.makeLocusWitness(observation, rows, next.at,
          { reason: 'Observed blocking tile at the end of the measured corridor', evidence }) : null;
        burst.push(next);
        actions.push(next.action);
        steps.push({ action: next.action, expected_after: next.at, ...(point ? { point_binding: point } : {}) });
        if (click) break;
      }
      return {
        status: 'proposed', kind: family, local, scene, step, drop: plan.drop, needId: need.id, ...(plan.restoreForm ? {restoreForm:plan.restoreForm} : {}),
        ...(burst.length > 1 ? { burst } : {}),
        binding: { observation_ref: ref, level_epoch: observation.level_epoch }, actions,
        steps,
        sicSrcDecision: { workflow: decision.receipt.workflow, hash: decision.receipt.src_hash,
          instructions: decision.receipt.instructions, edited: 'edited' in decision.receipt && decision.receipt.edited === true,
          situation: facts },
        sicSituationCard: { strategy, need: 'Open access to the lower route', situation, evidence, agenda: [], mode,
          triggerCard: chooseLanding, actor: scene.actor.bbox, focus: [x - 2, y - 2, x + 2, y + 2], goal: scene.goal?.bbox ?? null },
        question: { reason: situation, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: situation, relations: ['contributes_to:' + parent] }],
        sicLocalDecision: { strategy, objective: { id, label: navigationPrimitives[strategy], parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: situation,
          preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } },
      };
    },
    before(proposal, index, packet, observation) {
      if (index > 0 && proposal.burst) {
        const leg = liveLeg(proposal, index, packet.frame_rows), previous = proposal.burst[index - 1]!.at;
        const tile = leg?.scene.tiles[key(leg.step.at)];
        const admitted = proposal.local.epoch === observation.level_epoch && !!leg && key(leg.scene.at) === key(previous)
          && (leg.step.action.action_ref === 'ACTION6' ? tile === 'block' : tile === 'air' || tile === 'passage' || tile === 'target')
          && Object.keys(leg.scene.tiles).every(key => leg.scene.tiles[key] === proposal.scene.tiles[key]);
        return { admitted, reason: admitted ? 'descent_corridor_and_target_retained' : 'descent_observation_changed' };
      }
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref;
      return { admitted, reason: admitted ? 'descent_step_bound' : 'descent_observation_changed' };
    },
    after(proposal, index, before, after, first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true, reason: 'official_boundary',
        sic_need: { id: proposal.needId, status: 'satisfied' } };
      const leg = liveLeg(proposal, index, first);
      const result = leg ? resultOf(first, second, leg) : { matched: false, reason: 'descent_observation_changed' };
      return { ...result, seal_prefix: !result.matched || index + 1 >= proposal.actions.length };
    },
    record(before, after, _action, first, second, proposal, index) {
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const leg = liveLeg(proposal, index, first);
      if (!leg) return { events: [] };
      const local = (index > 0 && state?.epoch === before.level_epoch ? state : null) ?? proposal.local;
      const { step } = leg, matched = resultOf(first, second, leg).matched;
      const material = leg.scene.materials?.[key(step.at)];
      const { entryTest: previousTest, ...retained } = local;
      const currentForm = patch(second,step.at,local.layout.pitch-1).join(',');
      const testedEntry = previousTest && step.action.action_ref !== 'ACTION6' && key(step.at)===key(previousTest.to)
        && key(leg.scene.at)===key(previousTest.from) && patch(first,step.at,local.layout.pitch-1).join(',')===previousTest.form;
      const adjacent = leg.scene.at[1]===step.at[1] && Math.abs(leg.scene.at[0]-step.at[0])===local.layout.pitch;
      let entryTest:EntryTest|undefined;
      if (material!==undefined && !matched && adjacent && step.action.action_ref==='ACTION6' && currentForm!==patch(first,step.at,local.layout.pitch-1).join(',')) {
        const next = sceneFor(second,geometricComponents(second),local.layout,local.entryForms);
        if(next && key(next.at)===key(leg.scene.at) && next.tiles[key(step.at)]==='unverified')
          entryTest={from:next.at,to:step.at,form:currentForm,changed:after.observation_ref};
      }
      const verifiedMaterial = matched && step.action.action_ref === 'ACTION6' && material !== undefined;
      state = { ...retained, ...(matched && proposal.restoreForm ? {restoredForms:{...local.restoredForms,[proposal.restoreForm]:after.observation_ref}} : {}), ...(entryTest ? {entryTest} : {}),
        ...(testedEntry && matched ? {entryForms:{...local.entryForms,[previousTest.form]:after.observation_ref}} : {}),
        ...(verifiedMaterial ? {removalByColor:{...local.removalByColor,[material]:after.observation_ref}} : {}), refs: matched ? [...local.refs.slice(-4), after.observation_ref] : local.refs,
        removalRef: matched && !proposal.restoreForm && step.action.action_ref === 'ACTION6' ? after.observation_ref : local.removalRef,
        ...(matched && step.action.action_ref !== 'ACTION6' ? { movementRef: after.observation_ref } : {}),
        rejected: matched ? [] : [...local.rejected, signature(step)] };
      return { events: [] };
    },
    state: () => ({ state }),
    restore(value: NativeRecord) { state = structuredClone(value.state as State | null); },
  };
}
