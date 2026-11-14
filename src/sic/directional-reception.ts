import { freshReceptionModels, pathToReceptions } from '../logos-engine/v6-exposed-reception-access.ts';
import { measureExposedReception } from '../logos-engine/v6-exposed-reception-observation.ts';
import { ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeCommand, NativeFamily, NativePoint, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { sicNeedId } from './need-identity.ts';
import { compileStrategyGraph, resolveStrategyGraph } from './strategy-agenda.ts';

export const directionalReceptionId = 'sic_directional_reception';
export const directionalReceptionStrategies = {
  measure_reception_displacement: 'Measure a direction that could move the pieces toward their receivers',
  approach_reception_slots: 'Use the measured displacement toward the matching receivers',
  orient_toward_mismatched_piece: 'Point the orientation control toward the mismatched piece',
} as const;
const graph = compileStrategyGraph({ id: 'align_piece_and_receiver_state', version: 1, order: 'FALLBACK',
  priorities: ['orient_toward_mismatched_piece', 'approach_reception_slots', 'measure_reception_displacement'],
  strategies: {
    measure_reception_displacement: [{ fact: 'test', expected: true, label: 'A conditional route needs a direction that has yet to be measured' }],
    approach_reception_slots: [{ fact: 'route', expected: true, label: 'The measured displacement is the first step of the geometric route' }],
    orient_toward_mismatched_piece: [{ fact: 'orientation', expected: true, label: 'A piece occupies a receiver with a different appearance' }],
  },
}, ['test', 'route', 'orientation']);
type Site = { pos: NativePoint; color: number };
type Dial = { point: NativePoint; vector: NativePoint; active: boolean };
type Scene = { origin: NativePoint; size: NativePoint; pitch: number; actor: NativePoint; bodies: Site[]; slots: Site[];
  walls: NativePoint[]; dial: Dial[]; layout: string };
type State = { epoch: number; layout: string; directions: Record<string, NativePoint>; coupled: number[]; tried: string[];
  evidence: string[]; count: number };
type Choice = { command: NativeCommand; target?: Site; dial?: Dial };
type Proposal = NativeProposal & { local: State; scene: Scene; choice: Choice; attempt: string; needId: string };
const hints: Readonly<Record<string, NativePoint>> = { ACTION1: [0, -1], ACTION2: [0, 1], ACTION3: [-1, 0], ACTION4: [1, 0] };
const same = (a: NativePoint, b: NativePoint) => a[0] === b[0] && a[1] === b[1];
const plus = (a: NativePoint, b: NativePoint): NativePoint => [a[0] + b[0], a[1] + b[1]];
const minus = (a: NativePoint, b: NativePoint): NativePoint => [a[0] - b[0], a[1] - b[1]];
const command = (action_ref: string): Choice => ({ command: { action_ref, data: {} } });
function cellBox({ origin, pitch }: Scene, [x, y]: NativePoint): NativeBox {
  const left = origin[0] + x * pitch, top = origin[1] + y * pitch;
  return [left, top, left + pitch - 1, top + pitch - 1];
}
function pointScore(vector: NativePoint, direction: NativePoint) {
  return (vector[0] * direction[0] + vector[1] * direction[1]) / Math.hypot(...vector);
}

export function createSicDirectionalReception(): NativeFamily<Proposal> {
  let state: State | null = null;
  return {
    id: directionalReceptionId,
    async propose(observation, rows, _inputs, remaining, execution) {
      if (remaining < 1 || !observation.available_action_refs.includes('ACTION6')) return null;
      const keys = observation.available_action_refs.filter(action => hints[action]);
      if (!keys.length || execution?.signal?.aborted) return null;
      const scene = measureExposedReception(rows) as Scene | null;
      if (!scene || scene.bodies.length > 4 || scene.size[0] * scene.size[1] > 256) return null;
      const prior = state?.epoch === observation.level_epoch ? state : null;
      const local: State = prior?.layout === scene.layout ? prior : {
        epoch: observation.level_epoch, layout: scene.layout, directions: prior?.directions ?? {},
        coupled: [], tried: [], evidence: prior?.evidence ?? [], count: prior?.count ?? 0,
      };
      if (local.count >= 32) return null;
      const key = (action: NativeCommand) => JSON.stringify([observation.frame_hash, action]);
      const available = (choice: Choice) => !local.tried.includes(key(choice.command));
      const mismatch = scene.bodies.find(body => scene.slots.some(slot => same(slot.pos, body.pos) && slot.color !== body.color));
      let orientation: Choice | null = null, route: Choice | null = null, trial: Choice | null = null;
      if (mismatch) {
        const direction = minus(mismatch.pos, scene.actor);
        const dial = [...scene.dial].filter(control => !control.active).sort((a, b) =>
          pointScore(b.vector, direction) - pointScore(a.vector, direction));
        orientation = dial.map(control => ({ command: { action_ref: 'ACTION6', data: { x: control.point[0], y: control.point[1] } },
          target: mismatch, dial: control })).find(available) ?? null;
      }
      if (!orientation) {
        const model = freshReceptionModels();
        for (const color of local.coupled) model.coupled[String(color)] = true;
        const result = pathToReceptions(scene, model, 800, {
          ...(execution?.deadlineMs === undefined ? {} : { deadlineMs: execution.deadlineMs }),
          ...(execution?.now ? { now: execution.now } : {}),
        });
        const delta = result.path[0]?.[0];
        if (!delta) return null;
        const learned = keys.find(action => local.directions[action] && same(local.directions[action]!, delta) && available(command(action)));
        if (learned) route = command(learned);
        const unknown = keys.filter(action => !local.directions[action] && available(command(action)));
        const probe = unknown.find(action => same(hints[action]!, delta)) ?? unknown[0];
        if (probe) trial = command(probe);
      }
      const ref = observation.observation_ref, evidence: [string, ...string[]] = [ref, ...local.evidence.filter(value => value !== ref)];
      const { selected, entries } = resolveStrategyGraph({ graph, mode: 'active', facts: {
        test: { value: !!trial, evidence }, route: { value: !!route, evidence }, orientation: { value: !!orientation, evidence },
      }, planners: { measure_reception_displacement: () => trial, approach_reception_slots: () => route,
        orient_toward_mismatched_piece: () => orientation } });
      if (!selected) return null;
      const strategy = selected.id, choice = selected.plan, label = directionalReceptionStrategies[strategy], parent = 'G_official_completion';
      const goal = { kind: 'match_occupied_receivers', scope: ref.split(':revision:', 1)[0]!, subjects: ['controlled_body', 'receivers'],
        parentObjective: parent, satisfactionContract: 'official_progress_after_matching_the_occupied_receivers' };
      const need = { ...goal, id: sicNeedId(goal), status: 'assigned', evidence }, id = `directional-reception:${need.id}`;
      const actions = [choice.command];
      const binding = choice.dial && await ObservedInputDomain.makeLocusWitness(observation, rows, choice.dial.point, { reason: label, evidence });
      return { status: 'proposed', kind: directionalReceptionId, actions, local, scene, choice, attempt: key(choice.command), needId: need.id,
        steps: [{ action: choice.command, expected_after: null, ...(binding ? { point_binding: binding } : {}) }],
        binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        sicSituationCard: { strategy, need: 'Bring the pieces and the receivers into agreement', mode: route ? 'solving' : 'exploration',
          situation: choice.dial ? 'The piece is in the receiver but has a different color. Test the nearby direction on the dial.' : label,
          agenda: entries, evidence, actor: cellBox(scene, scene.actor),
          pieces: (choice.target ? [choice.target] : scene.bodies).map(body => cellBox(scene, body.pos)),
          receivers: scene.slots.map(slot => cellBox(scene, slot.pos)),
          dial: choice.dial ? [...choice.dial.point, ...choice.dial.point] : null },
        question: { reason: label, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: label, relations: [`contributes_to:${parent}`] }],
        sicLocalDecision: { strategy, objective: { id, label, parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: label,
          preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
    },
    before(proposal, index, _packet, observation) {
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref;
      return { admitted, reason: admitted ? 'directional_reception_bound' : 'directional_reception_changed' };
    },
    after(proposal, _index, before, after) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true,
        reason: 'official_boundary', sic_need: { id: proposal.needId, status: 'satisfied' } };
      return { matched: null, seal_prefix: true, reason: 'remeasure_piece_receiver_and_orientation' };
    },
    record(before, after, issued, _first, second: NativeRows, proposal) {
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const { local, scene, choice } = proposal;
      const returned = measureExposedReception(second) as Scene | null;
      const directions = { ...local.directions }, coupled = [...local.coupled];
      let colorMatched = false;
      if (returned?.layout === scene.layout) {
        const delta = minus(returned.actor, scene.actor);
        if (!choice.dial && Math.abs(delta[0]) + Math.abs(delta[1]) === 1) {
          directions[issued.action_ref] = delta;
          for (const color of new Set(scene.bodies.map(body => body.color))) {
            const group = scene.bodies.filter(body => body.color === color);
            if (group.length > 1 && group.every(body => returned.bodies.some(next => next.color === color && same(next.pos, plus(body.pos, delta))))) coupled.push(color);
          }
        }
        if (choice.target && returned.dial.some(dial => dial.active && same(dial.point, choice.dial!.point))) {
          const at = choice.target.pos;
          const target = scene.slots.find(slot => same(slot.pos, at));
          colorMatched = returned.bodies.some(body => same(body.pos, at) && body.color === target?.color);
        }
      }
      state = { ...local, directions, coupled: [...new Set(coupled)], count: local.count + 1,
        tried: [...local.tried, proposal.attempt], evidence: [...local.evidence.slice(-4), after.observation_ref] };
      const status = returned?.layout !== scene.layout ? 'receiver_layout_changed' : colorMatched ? 'receiver_color_match_observed' : 'receiver_return_measured';
      return { events: [{ status, evidence: [before.observation_ref, after.observation_ref] }] };
    },
    state: () => ({ state }),
    restore(value: NativeRecord) { state = structuredClone(value.state as State | null); },
  };
}
