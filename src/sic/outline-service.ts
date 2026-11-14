import { geometricComponents } from '../logos-engine/v6-native-observer.ts';
import { outlineBoxes, outlineSameBox, type OutlineBox } from '../logos-engine/v6-outline-geometry.ts';
import type { NativeBox, NativeCommand, NativeFamily, NativePoint, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { sicNeedId } from './need-identity.ts';
import { compileStrategyGraph, resolveStrategyGraph } from './strategy-agenda.ts';

export const outlineServiceId = 'sic_outline_service';
export const outlineServiceStrategies = {
  test_outline_motion: 'Identify the outline moved by a direction',
  approach_framed_locus: 'Bring the controlled outline into the fitting frame',
  test_framed_operator: 'Test the local command at the exact fit',
  accompany_marked_body: 'Follow the marked body toward its matching outline',
  test_marker_turn: 'Test the local command where the marker turns',
  verify_outline_contact: 'Check the result of contact with the matching outline',
} as const;
const graph = compileStrategyGraph({ id: 'bring_marked_body_to_matching_outline', version: 1, order: 'FALLBACK',
  priorities: ['verify_outline_contact', 'test_marker_turn', 'accompany_marked_body', 'test_framed_operator', 'approach_framed_locus', 'test_outline_motion'],
  strategies: {
    test_outline_motion: [{ fact: 'trial', expected: true, label: 'A nearby outline fits the inner dimensions of a unique frame' }],
    approach_framed_locus: [{ fact: 'approach', expected: true, label: 'A measured moving outline can take a step toward the frame' }],
    test_framed_operator: [{ fact: 'fit', expected: true, label: 'The moving outline exactly fits inside the frame' }],
    accompany_marked_body: [{ fact: 'accompany', expected: true, label: 'The tracked same-color body and outline still give a direction to compare' }],
    test_marker_turn: [{ fact: 'turn', expected: true, label: 'The marker left the moving outline and indicates a turn by the nearby body' }],
    verify_outline_contact: [{ fact: 'contact', expected: true, label: 'The body and counterpart now form one visible component' }],
  },
}, ['trial', 'approach', 'fit', 'accompany', 'turn', 'contact']);

type Strategy = keyof typeof outlineServiceStrategies;
type Pose = { box: NativeBox; color: number };
type State = { epoch: number; actor: Pose; target: Pose; frame: Pose; locus: NativeBox; count: number;
  bound: boolean; opened: boolean; turned: boolean; lastDirection: string | null; evidence: string[] };
type Move = { command: NativeCommand; landing: NativeBox | null };
type Proposal = NativeProposal & { strategy: Strategy; local: State; move: Move; needId: string; turnMarker: NativeBox | null };
const directions = [
  ['ACTION1', 0, -1], ['ACTION2', 0, 1], ['ACTION3', -1, 0], ['ACTION4', 1, 0],
] as const;
const same = (a: NativeBox, b: NativeBox) => a.every((value, index) => value === b[index]);
const inside = (outer: NativeBox, inner: NativeBox) =>
  outer[0] <= inner[0] && outer[1] <= inner[1] && outer[2] >= inner[2] && outer[3] >= inner[3];
const distance = (a: NativeBox, b: NativeBox) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
const shift = ([l, t, r, b]: NativeBox, x: number, y: number): NativeBox => [l + x, t + y, r + x, b + y];
const box = (outline: OutlineBox): NativeBox => [outline.bbox[0]!, outline.bbox[1]!, outline.bbox[2]!, outline.bbox[3]!];
const pose = (outline: OutlineBox): Pose => ({ box: box(outline), color: outline.value });
const size = ([l, t, r, b]: NativeBox): NativePoint => [r - l + 1, b - t + 1];

async function findLocus(rows: NativeRows, epoch: number): Promise<State | null> {
  const shapes = await outlineBoxes(rows), candidates: State[] = [];
  if (shapes.length < 3) return null;
  const parts = geometricComponents(rows);
  for (const frame of shapes) {
    const [l, t, r, b] = box(frame);
    const locus: NativeBox = [l + 1, t + 1, r - 1, b - 1];
    const [width, height] = size(locus);
    if (width !== height || width < 3) continue;
    const matching = shapes.filter(shape => shape.width === width && shape.height === height
      && (shape.bbox[0]! - locus[0]) % width === 0 && (shape.bbox[1]! - locus[1]) % height === 0
      && !inside(box(frame), box(shape))).sort((a, b) => distance(box(a), locus) - distance(box(b), locus));
    if (matching.length !== 2) continue;
    const [near, far] = matching as [OutlineBox, OutlineBox];
    if (near.value === far.value || distance(box(near), locus) === distance(box(far), locus)) continue;
    // The counterpart has a separate, nearby component of its own color.
    if (!parts.some(part => part.color === far.value && part.area < width * height
      && !same(part.bbox, box(far)) && distance(part.bbox, locus) <= 2 * width)) continue;
    candidates.push({ epoch, actor: pose(near), target: pose(far), frame: pose(frame), locus, count: 0,
      bound: false, opened: false, turned: false, lastDirection: null, evidence: [] });
  }
  return candidates.length === 1 ? candidates[0]! : null;
}

function perimeterMatch(rows: NativeRows, [left, top, right, bottom]: NativeBox, color: number) {
  let hits = 0, total = 0;
  for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) {
    if (x !== left && x !== right && y !== top && y !== bottom) continue;
    total++;
    if (rows[y]?.[x] === color) hits++;
  }
  return hits / total;
}

function measuredTranslation(first: NativeRows, second: NativeRows, { box, color }: Pose, landing: NativeBox): boolean {
  // A projected outline can overlap existing artwork. Its arrival and its departure both need visible support.
  return perimeterMatch(first, landing, color) < 0.5 && perimeterMatch(second, landing, color) >= 0.5
    && perimeterMatch(second, box, color) < 0.5;
}

function inspectCompanion(rows: NativeRows, local: State) {
  const [width, height] = size(local.actor.box), parts = geometricComponents(rows);
  const peers = parts.filter(part => part.color === local.target.color);
  const bodies = peers.filter(part => part.rectangular && part.area > 1 && part.area < width * height
    && distance(part.bbox, local.actor.box) <= 2 * width);
  const body = bodies.length === 1 ? bodies[0]! : null;
  const markers = body ? peers.filter(part => part.area === 1 && distance(part.bbox, body.bbox) === width) : [];
  const marker = markers.length === 1 ? markers[0]!.bbox : null;
  const merged = peers.some(part => inside(part.bbox, local.target.box) && part.area > 2 * (width + height) - 4
    && perimeterMatch(rows, local.target.box, local.target.color) >= 0.75);
  return { body: body?.bbox ?? null, marker, merged };
}

const frameOpened = (rows: NativeRows, local: State) => !outlineSameBox(rows, local.frame.box, local.frame.color);

function markerReached(rows: NativeRows, local: State, marker: NativeBox) {
  const body = inspectCompanion(rows, local).body;
  return !!body && distance(body, marker) === 0;
}

function stepTowards(rows: NativeRows, inputs: readonly NativeCommand[], at: NativeBox, goal: NativeBox, continuation?: string | null): Move | null {
  const [width, height] = size(at), screen: NativeBox = [0, 0, rows[0]!.length - 1, rows.length - 1];
  const moves = directions.flatMap(([action, x, y]) => {
    const command = inputs.find(input => input.action_ref === action);
    const landing = shift(at, x * width, y * height);
    return command && inside(screen, landing) ? [{ command, landing }] : [];
  });
  if (same(at, goal) && continuation) return moves.find(move => move.command.action_ref === continuation) ?? null;
  return moves.filter(move => distance(move.landing, goal) < distance(at, goal))
    .sort((a, b) => {
      const remaining = (move: typeof a) => Math.max(Math.abs(move.landing[0] - goal[0]), Math.abs(move.landing[1] - goal[1]));
      return Number(b.command.action_ref === continuation) - Number(a.command.action_ref === continuation) || remaining(a) - remaining(b);
    })[0] ?? null;
}

export function createSicOutlineService(): NativeFamily<Proposal> {
  let state: State | null = null;
  return {
    id: outlineServiceId,
    async propose(observation, rows, inputs, remaining) {
      if (remaining < 1 || !inputs.some(input => input.action_ref === 'ACTION5')) return null;
      const local = state?.epoch === observation.level_epoch ? state : await findLocus(rows, observation.level_epoch);
      if (!local || local.count >= 32) return null;
      const ref = observation.observation_ref;
      const evidence: [string, ...string[]] = [ref, ...local.evidence];
      const actor = local.actor.box;
      if (perimeterMatch(rows, actor, local.actor.color) < 0.5) return null;
      const operator: Move = { command: inputs.find(input => input.action_ref === 'ACTION5')!, landing: null };
      const companion = local.opened ? inspectCompanion(rows, local) : null;
      const [pitch] = size(actor);
      const turn = !!companion?.body && !!companion.marker && !inside(actor, companion.marker)
        && distance(companion.body, actor) <= pitch
        && distance(companion.marker, local.target.box) > distance(companion.body, local.target.box);
      const atFit = same(actor, local.locus) && outlineSameBox(rows, actor, local.actor.color)
        && outlineSameBox(rows, local.frame.box, local.frame.color);
      const toward = stepTowards(rows, inputs, actor, local.opened ? local.target.box : local.locus, local.lastDirection);
      const nearby = !!companion?.body || (local.turned && distance(actor, local.target.box) <= pitch);
      const { selected, entries } = resolveStrategyGraph({ graph, mode: 'active', facts: {
        trial: { value: !local.bound && !!toward, evidence }, approach: { value: local.bound && !local.opened && !!toward, evidence },
        fit: { value: local.bound && !local.opened && atFit, evidence },
        accompany: { value: local.opened && !!toward && !!nearby, evidence },
        turn: { value: local.opened && !local.turned && turn, evidence }, contact: { value: !!companion?.merged, evidence },
      }, planners: { test_outline_motion: () => toward, approach_framed_locus: () => toward,
        test_framed_operator: () => operator, accompany_marked_body: () => toward, test_marker_turn: () => operator,
        verify_outline_contact: () => operator } });
      if (!selected) return null;
      const strategy = selected.id, move = selected.plan, label = outlineServiceStrategies[strategy];
      const parent = 'G_official_completion';
      const goal = { kind: 'verify_marked_body_and_matching_outline', scope: ref.split(':revision:', 1)[0]!,
        subjects: [local.target.box.join(',')], parentObjective: parent, satisfactionContract: 'observe_official_progress_after_marked_contact' };
      const need = { ...goal, id: sicNeedId(goal), status: 'assigned', evidence };
      const id = `outline-service:${need.id}`, actions = [move.command];
      return { status: 'proposed', kind: outlineServiceId, actions, strategy, local, move, needId: need.id,
        turnMarker: strategy === 'test_marker_turn' ? companion?.marker ?? null : null,
        steps: [{ action: move.command, expected_after: null }], binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        sicSituationCard: { strategy, need: 'Find how the marked body can reach its matching outline',
          mode: move.landing && local.bound ? 'solving' : 'exploration', situation: label, agenda: entries, evidence,
          controlledPiece: actor, addressedRegion: local.opened ? local.target.box : local.locus,
          markedBody: companion?.body ?? null, marker: companion?.marker ?? null },
        question: { reason: label, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: label, relations: [`contributes_to:${parent}`] }],
        sicLocalDecision: { strategy, objective: { id, label, parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: label,
          preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
    },
    before(proposal, index, _packet, observation) {
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref;
      return { admitted, reason: admitted ? 'outline_observation_bound' : 'outline_observation_changed' };
    },
    after(proposal, _index, before, after, first, second) {
      const scored = after.levels_completed > before.levels_completed;
      if (scored) return { matched: true, seal_prefix: true, reason: 'official_boundary',
        sic_need: { id: proposal.needId, status: 'satisfied' } };
      const { local, move, strategy, turnMarker } = proposal;
      if (move.landing) {
        const matched = measuredTranslation(first, second, local.actor, move.landing);
        return { matched, seal_prefix: true, reason: matched ? 'outline_translation_observed' : 'outline_translation_contradicted' };
      }
      if (strategy === 'test_framed_operator') {
        const matched = frameOpened(second, local);
        return { matched, seal_prefix: true, reason: matched ? 'fitting_frame_removed' : 'fitting_frame_still_visible' };
      }
      if (turnMarker) {
        const matched = markerReached(second, local, turnMarker);
        return { matched, seal_prefix: true, reason: matched ? 'body_reached_marker' : 'body_did_not_reach_marker' };
      }
      return { matched: null, seal_prefix: true, reason: 'merged_outline_did_not_score' };
    },
    record(before, after, command, first, second, proposal) {
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const local = proposal.local, landing = proposal.move.landing;
      const moved = landing && measuredTranslation(first, second, local.actor, landing);
      const opened = local.opened || (proposal.strategy === 'test_framed_operator'
        && frameOpened(second, local));
      const turnMarker = proposal.turnMarker;
      const turned = local.turned || (!!turnMarker && markerReached(second, local, turnMarker));
      const failed = (landing && !moved) || (proposal.strategy === 'test_framed_operator' && !opened)
        || (turnMarker && !turned)
        || proposal.strategy === 'verify_outline_contact';
      state = { ...local, opened, count: failed ? 32 : local.count + 1,
        actor: moved ? { ...local.actor, box: landing } : local.actor, bound: local.bound || !!moved,
        turned,
        lastDirection: moved ? command.action_ref : local.lastDirection,
        evidence: [...local.evidence.slice(-4), after.observation_ref] };
      return { events: [] };
    },
    state: () => ({ state }),
    restore(value: NativeRecord) { state = structuredClone(value.state as State | null); },
  };
}
