import { geometricComponents, ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeCommand, NativeFamily, NativePoint, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { sicNeedId } from './need-identity.ts';
import { compileStrategyGraph, resolveStrategyGraph } from './strategy-agenda.ts';
import { navigationPrimitives, resolveNavigationPrimitives } from './navigation-primitives.ts';

export const remoteSupportRouteId = 'sic_remote_support_route';
export const learnRemoteAccessId = 'sic_learn_remote_access';
export const remoteSupportRouteStrategies = {
  test_supported_translation: 'Identify which piece moves across the visible support',
  test_remote_support_control: 'Test whether the control changes a distant passage',
  follow_supported_route: 'Move along a passage on the current layout',
  change_support_to_continue: 'Switch the passage layout to continue toward the target',
} as const;
const graph = compileStrategyGraph({ id: 'reach_target_across_switchable_supports', version: 1, order: 'FALLBACK',
  priorities: ['change_support_to_continue', 'follow_supported_route', 'test_remote_support_control', 'test_supported_translation'],
  strategies: {
    test_supported_translation: [{ fact: 'trial', expected: true, label: 'Two framed pieces and a uniquely measured group of remote controls are visible' }],
    test_remote_support_control: [{ fact: 'probe', expected: true, label: 'The moving piece is on stable support and a remote control has no observed effect yet' }],
    follow_supported_route: [{ fact: 'move', expected: true, label: 'The route starts with a movement across a measured support' }],
    change_support_to_continue: [{ fact: 'switch', expected: true, label: 'The route starts with a measured change of support and the piece can stay on its current cell' }],
  },
}, ['trial', 'probe', 'move', 'switch']);

type Strategy = keyof typeof remoteSupportRouteStrategies;
type Piece = { at: NativePoint; color: number; floor: number };
type Control = { box: NativeBox; color: number };
type Edit = readonly [x: number, y: number, before: number, after: number];
type Scene = { arena: NativeBox; pitch: number; candidates: Piece[]; controls: Control[]; supports: number[] };
type State = { epoch: number; scene: Scene; actor: Piece | null; target: Piece | null; effects: (Edit[] | null)[];
  evidence: string[]; effectRefs?: (string | null)[]; stopped: boolean; count: number };
type Move = { command: NativeCommand; landing: NativePoint | null; floor: number | null; control: number | null };
type Proposal = NativeProposal & { strategy: Strategy; local: State; move: Move; needId: string };
const directions = [
  ['ACTION1', 0, -1], ['ACTION2', 0, 1], ['ACTION3', -1, 0], ['ACTION4', 1, 0],
] as const;
const inside = (outer: NativeBox, inner: NativeBox) =>
  outer[0] <= inner[0] && outer[1] <= inner[1] && outer[2] >= inner[2] && outer[3] >= inner[3];
const same = (a: NativePoint, b: NativePoint) => a[0] === b[0] && a[1] === b[1];
const cell = ([x, y]: NativePoint, pitch: number): NativeBox => [x, y, x + pitch - 1, y + pitch - 1];
const origin = ([x, y]: NativeBox): NativePoint => [x, y];
const center = ([l, t, r, b]: NativeBox): NativePoint => [Math.floor((l + r) / 2), Math.floor((t + b) / 2)];
const width = ([l, , r]: NativeBox) => r - l + 1;
const height = ([, t, , b]: NativeBox) => b - t + 1;
const pixelAt = (rows: NativeRows, [x, y]: NativePoint) => rows[y]?.[x];

function uniform(rows: NativeRows, [x, y]: NativePoint, pitch: number): number | null {
  const value = pixelAt(rows, [x, y]);
  if (value === undefined || y + pitch > rows.length || x + pitch > rows[0]!.length) return null;
  for (let dy = 0; dy < pitch; dy++) for (let dx = 0; dx < pitch; dx++) if (rows[y + dy]![x + dx] !== value) return null;
  return value;
}

function measureScene(rows: NativeRows): Scene | null {
  const parts = geometricComponents(rows);
  const regions = parts.filter(part => !part.rectangular && part.area * 5 >= rows.length * rows[0]!.length);
  const scenes: Scene[] = [];
  for (const field of regions) for (const panel of regions) {
    if (field === panel || (field.bbox[0] <= panel.bbox[2] && panel.bbox[0] <= field.bbox[2])) continue;
    const controls = parts.filter(part => !part.rectangular && part.area >= 8 && inside(panel.bbox, part.bbox)
      && part.color !== panel.color && pixelAt(rows, center(part.bbox)) === part.color);
    if (controls.length < 2 || controls.length > 3 || new Set(controls.map(part => part.color)).size !== controls.length) continue;
    if (new Set(controls.map(control => JSON.stringify([width(control.bbox), height(control.bbox), control.mask]))).size !== 1) continue;
    const pieces = parts.filter(part => part.rectangular && width(part.bbox) === height(part.bbox) && width(part.bbox) >= 2
      && inside(field.bbox, part.bbox) && part.color !== field.color).flatMap(part => {
      const [x, y] = origin(part.bbox), pitch = width(part.bbox);
      const surrounds = directions.map(([, dx, dy]) => uniform(rows, [x + dx * pitch, y + dy * pitch], pitch));
      return surrounds[0] !== null && surrounds[0] !== undefined && surrounds[0] !== field.color
        && surrounds.every(value => value === surrounds[0]) ? [{ part, floor: surrounds[0] }] : [];
    });
    if (pieces.length !== 2) continue;
    const [first, second] = pieces as [typeof pieces[number], typeof pieces[number]];
    const pitch = width(first.part.bbox);
    const candidates = pieces.map(({ part, floor }) => ({ at: origin(part.bbox), color: part.color, floor }));
    if (pitch !== width(second.part.bbox) || first.floor !== second.floor || first.part.color === second.part.color
      || candidates.some(({ at: [x, y] }) => (x - candidates[0]!.at[0]) % pitch || (y - candidates[0]!.at[1]) % pitch)) continue;
    const supports = new Set(parts.filter(part => part.rectangular && part.area >= pitch * pitch && inside(field.bbox, part.bbox)
      && width(part.bbox) % pitch === 0 && height(part.bbox) % pitch === 0
      && (part.bbox[0] - candidates[0]!.at[0]) % pitch === 0 && (part.bbox[1] - candidates[0]!.at[1]) % pitch === 0)
      .map(part => part.color));
    candidates.forEach(piece => supports.delete(piece.color));
    supports.delete(field.color);
    if (!controls.every(control => supports.has(control.color))) continue;
    scenes.push({ arena: field.bbox, pitch, candidates, controls: controls.map(control => ({ box: control.bbox, color: control.color })),
      supports: [...supports] });
  }
  return scenes.length === 1 ? scenes[0]! : null;
}

function remoteEdits(first: NativeRows, second: NativeRows, arena: NativeBox, control: Control) {
  const edits: Edit[] = [], [l, t, r, b] = arena;
  for (let y = t; y <= b; y++) for (let x = l; x <= r; x++) {
    const before = first[y]![x]!, after = second[y]![x]!;
    if (before === after) continue;
    if (before !== control.color && after !== control.color) return null;
    edits.push([x, y, before, after]);
  }
  const countGained = edits.filter(edit => edit[3] === control.color).length;
  return edits.length > 0 && countGained * 2 === edits.length ? edits : null;
}

function sameEdits(actual: Edit[], expected: Edit[]) {
  const reversed = actual[0]?.[2] === expected[0]?.[3];
  return actual.length === expected.length && actual.every(([x, y, before, after], index) => {
    const [u, v, a, b] = expected[index]!;
    return x === u && y === v && (reversed ? before === b && after === a : before === a && after === b);
  });
}

function atPiece(rows: NativeRows, piece: Piece, pitch: number) {
  return uniform(rows, piece.at, pitch) === piece.color;
}

function controlCommand(control: Control): NativeCommand {
  const [x, y] = center(control.box);
  return { action_ref: 'ACTION6', data: { x, y } };
}

function searchRoute(rows: NativeRows, local: State, inputs: readonly NativeCommand[], remaining: number): Move | null {
  const { scene: { arena, pitch, supports, controls }, effects } = local;
  const actor = local.actor!, target = local.target!;
  const occupied = cell(actor.at, pitch);
  const editsAt = new Map<string, { bit: number; value: number }>();
  let knownMask = 0;
  for (const [i, edits] of effects.entries()) {
    if (!edits) continue;
    const bit = 1 << i;
    knownMask |= bit;
    const current = edits.map(([x, y, before, after]) => {
      const value = inside(occupied, [x, y, x, y]) ? actor.floor : rows[y]![x];
      return value === before ? false : value === after ? true : null;
    });
    if (current.some(value => value === null || value !== current[0])) return null;
    for (const [x, y, before, after] of edits) {
      const key = `${x},${y}`;
      if (editsAt.has(key)) return null;
      editsAt.set(key, { bit, value: current[0] ? before : after });
    }
  }
  const passes = (at: NativePoint, mask: number) => {
    const footprint = cell(at, pitch);
    if (!inside(arena, footprint)) return null;
    if (same(at, target.at)) return target.floor;
    let first: number | undefined;
    for (let y = at[1]; y <= footprint[3]; y++) for (let x = at[0]; x <= footprint[2]; x++) {
      const edit = editsAt.get(`${x},${y}`);
      const value = edit && (mask & edit.bit) ? edit.value : same(at, actor.at) ? actor.floor : rows[y]![x]!;
      first ??= value;
      if (value !== first) return null;
    }
    return first !== undefined && supports.includes(first) ? first : null;
  };
  const options = directions.flatMap(([key, dx, dy]) => {
    const command = inputs.find(input => input.action_ref === key);
    return command ? [{ command, dx, dy }] : [];
  });
  type Position = { at: NativePoint; mask: number; first: Move | null; depth: number };
  const queue: Position[] = [{ at: actor.at, mask: 0, first: null, depth: 0 }];
  const seen = new Set([`${actor.at.join(',')}:0`]);
  for (const { at, mask, first, depth } of queue) {
    if (same(at, target.at)) return first;
    if (depth >= remaining) continue;
    const add = (next: NativePoint, nextMask: number, move: Move) => {
      const key = `${next.join(',')}:${nextMask}`;
      if (seen.has(key)) return;
      seen.add(key);
      queue.push({ at: next, mask: nextMask, first: first ?? move, depth: depth + 1 });
    };
    for (const { command, dx, dy } of options) {
      const next: NativePoint = [at[0] + dx * pitch, at[1] + dy * pitch];
      const floor = passes(next, mask);
      if (floor !== null) add(next, mask, { command, landing: next, floor, control: null });
    }
    for (const [index, control] of controls.entries()) {
      const bit = 1 << index, nextMask = mask ^ bit;
      const support = passes(at, mask);
      if ((knownMask & bit) && support !== null && support === passes(at, nextMask)) {
        add(at, nextMask, { command: controlCommand(control), landing: null, floor: null, control: index });
      }
    }
  }
  return null;
}

function motionTrial(rows: NativeRows, scene: Scene, inputs: readonly NativeCommand[]): Move | null {
  const choices = directions.flatMap(([action, dx, dy]) => {
    const command = inputs.find(input => input.action_ref === action);
    if (!command) return [];
    const landing = scene.candidates.map(piece =>
      [piece.at[0] + dx * scene.pitch, piece.at[1] + dy * scene.pitch] as NativePoint);
    if (!landing.every((at, i) => uniform(rows, at, scene.pitch) === scene.candidates[i]!.floor)) return [];
    return [{ command, landing: null, floor: null, control: null }];
  });
  return choices[0] ?? null;
}

export function createSicRemoteSupportRoute(family = remoteSupportRouteId): NativeFamily<Proposal> {
  const learns = family === learnRemoteAccessId;
  let state: State | null = null;
  return {
    id: family,
    async propose(observation, rows, inputs, remaining, execution) {
      if (remaining < 1 || !observation.available_action_refs.includes('ACTION6')) return null;
      const prior = state?.epoch === observation.level_epoch ? state : null;
      if (prior?.stopped || (prior?.count ?? 0) >= 64) return null;
      if (learns && !prior && !execution?.readDirectionalMotion) return null;
      const scene = prior?.scene ?? measureScene(rows);
      if (!scene) return null;
      let local: State = prior ?? { epoch: observation.level_epoch, scene, actor: null, target: null,
        effects: scene.controls.map(() => null), evidence: [], stopped: false, count: 0 };
      if (learns && !prior) {
        const motion = execution?.readDirectionalMotion?.();
        if (motion?.afterRef !== observation.observation_ref || motion.levelEpoch !== observation.level_epoch) return null;
        const candidates = scene.candidates.filter(piece => motion.translations.some(({ to, displacement, color }) =>
          color === piece.color && same(piece.at, origin(to)) && width(to) === scene.pitch && height(to) === scene.pitch
          && (displacement[0] === 0 || displacement[1] === 0) && Math.abs(displacement[0]) + Math.abs(displacement[1]) === scene.pitch));
        if (candidates.length !== 1) return null;
        local = { ...local, actor: candidates[0]!, target: scene.candidates.find(piece => piece !== candidates[0])!,
          evidence: [motion.beforeRef, motion.afterRef], effectRefs: scene.controls.map(() => null) };
      }
      const { actor, target } = local;
      if (actor && target && (!atPiece(rows, actor, scene.pitch) || !atPiece(rows, target, scene.pitch))) return null;
      const probe = local.effects.findIndex(effect => effect === null);
      const trial = !actor ? motionTrial(rows, scene, inputs) : null;
      const question = actor && probe !== -1 && scene.controls[probe]!.color !== actor.floor
        ? { command: controlCommand(scene.controls[probe]!), landing: null, floor: null, control: probe } : null;
      const route = actor && target && probe === -1 ? searchRoute(rows, local, inputs, Math.min(remaining, 64 - local.count)) : null;
      const ref = observation.observation_ref;
      const effectRef = route?.control == null ? null : local.effectRefs?.[route.control];
      const evidence: [string, ...string[]] = [ref, ...new Set([...local.evidence, ...(effectRef ? [effectRef] : [])].filter(item => item !== ref))];
      const normal = resolveStrategyGraph({ graph, mode: 'active', facts: {
        trial: { value: !!trial, evidence }, probe: { value: !!question, evidence },
        move: { value: !!route?.landing, evidence }, switch: { value: route?.control != null, evidence },
      }, planners: { test_supported_translation: () => trial, test_remote_support_control: () => question,
        follow_supported_route: () => route, change_support_to_continue: () => route } });
      if (!normal.selected) return null;
      const move = normal.selected.plan, label = remoteSupportRouteStrategies[normal.selected.id], parent = 'G_official_completion';
      const mode = execution?.reasoningMode ?? 'exploration';
      const offer = { input: move.command.action_ref, expected: move.landing, evidence };
      const primitive = learns ? resolveNavigationPrimitives({ mode, evidence, probe: route ? null : offer,
        access: route?.landing ? offer : null, interaction: route?.control != null ? offer : null }) : null;
      const strategy = primitive?.selected?.id ?? normal.selected.id;
      const goal = { kind: 'reach_target_on_switchable_support', scope: ref.split(':revision:', 1)[0]!, subjects: ['visible_support_and_controls'],
        parentObjective: parent, satisfactionContract: 'observe_official_progress_after_supported_navigation' };
      const need = { ...goal, id: sicNeedId(goal), status: 'assigned', evidence };
      const id = `${learns ? family : 'remote-support'}:${need.id}`, actions = [move.command];
      const control = move.control === null ? null : scene.controls[move.control]!;
      const edits = move.control === null ? null : local.effects[move.control];
      const affectedSupport = edits?.length ? [
        Math.min(...edits.map(edit => edit[0])), Math.min(...edits.map(edit => edit[1])),
        Math.max(...edits.map(edit => edit[0])), Math.max(...edits.map(edit => edit[1])),
      ] : null;
      const pointBinding = control ? await ObservedInputDomain.makeLocusWitness(observation, rows, center(control.box), { reason: label, evidence }) : null;
      return { status: 'proposed', kind: family, actions, strategy: normal.selected.id, local, move, needId: need.id,
        steps: [{ action: move.command, expected_after: null, ...(pointBinding ? { point_binding: pointBinding } : {}) }],
        binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        sicSituationCard: { strategy, need: 'Reach the other piece by finding connected support', mode: learns ? mode : route ? 'solving' : 'exploration',
          situation: label, agenda: primitive?.entries ?? normal.entries, evidence, actor: actor ? cell(actor.at, scene.pitch) : null,
          target: target ? cell(target.at, scene.pitch) : null, control: control?.box ?? null,
          landing: move.landing ? cell(move.landing, scene.pitch) : null, affectedSupport },
        question: { reason: label, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: label, relations: [`contributes_to:${parent}`] }],
        sicLocalDecision: { strategy, objective: { id, label: primitive?.selected ? navigationPrimitives[primitive.selected.id] : label, parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: label,
          preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
    },
    before(proposal, index, _packet, observation) {
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref;
      return { admitted, reason: admitted ? 'support_route_observation_bound' : 'support_route_observation_changed' };
    },
    after(proposal, _index, before, after, first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true,
        reason: 'official_boundary', sic_need: { id: proposal.needId, status: 'satisfied' } };
      const update = observeReturn(proposal, first, second);
      return { matched: !update.stopped, seal_prefix: true, reason: update.stopped ? 'support_route_hypothesis_contradicted' : 'support_route_effect_observed' };
    },
    record(before, after, _command, first, second, proposal) {
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const update = observeReturn(proposal, first, second);
      state = { ...update, count: update.count + 1, evidence: [...update.evidence.slice(-5), after.observation_ref] };
      const { control } = proposal.move;
      if (state.effectRefs && control !== null && !proposal.local.effects[control] && update.effects[control]) {
        state.effectRefs = state.effectRefs.map((ref, i) => i === control ? after.observation_ref : ref);
      }
      return { events: [] };
    },
    state: () => ({ state }),
    restore(value: NativeRecord) { state = structuredClone(value.state as State | null); },
  };
}

function observeReturn({ local, move }: Proposal, first: NativeRows, second: NativeRows): State {
  const { scene: { arena, candidates, controls, pitch }, actor, target, effects } = local;
  const stopped = { ...local, stopped: true };
  if (!actor) {
    const direction = directions.find(([key]) => key === move.command.action_ref);
    if (!direction) return stopped;
    const [, dx, dy] = direction;
    const translated = candidates.flatMap((piece, index) => {
      const at: NativePoint = [piece.at[0] + dx * pitch, piece.at[1] + dy * pitch];
      return atPiece(second, { ...piece, at }, pitch) && !atPiece(second, piece, pitch) ? [{ index, at }] : [];
    });
    if (translated.length !== 1) return stopped;
    const { index, at } = translated[0]!, peer = candidates[1 - index]!;
    return atPiece(second, peer, pitch) ? { ...local, actor: { ...candidates[index]!, at }, target: peer } : stopped;
  }
  if (!target || !atPiece(second, target, pitch)) return stopped;
  if (move.control !== null) {
    const edit = remoteEdits(first, second, arena, controls[move.control]!);
    const expected = effects[move.control];
    if (!atPiece(second, actor, pitch) || !edit || (expected && !sameEdits(edit, expected))) return stopped;
      return expected ? local : { ...local, effects: effects.map((old, index) => index === move.control ? edit : old) };
  }
  if (!move.landing || move.floor === null) return stopped;
  const translated = { ...actor, at: move.landing, floor: move.floor };
  return atPiece(second, translated, pitch) && uniform(second, actor.at, pitch) === actor.floor
    ? { ...local, actor: translated } : stopped;
}
