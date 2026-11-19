import { ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type {
  NativeBox,
  NativeCommand,
  NativeEntity,
  NativeFamily,
  NativeObservation,
  NativeProposal,
  NativeRecord,
} from '../logos-engine/v6-native-types.ts';
import { observedCommandKey } from './observed-command-frontier.ts';
import { sicNeedId } from './need-identity.ts';
import { actionRelation, type Step } from './composition-context.ts';
import learned from './source-composition-prior.json' with { type: 'json' };

export const compositionFamily = 'sic_test_observed_compositions';
export const cycleGroup = 'test_compositions_after_recurrent_returns';
export const exhaustedGroup = 'test_compositions_after_existing_strategies';
export const compositionPrior: Readonly<Record<string, number>> = learned;
type Motion = { actor: string; op: string; dx: number; dy: number; evidence: string };
type Goal = { pair: string; actor: string; target: string; gap: number };
type State = {
  epoch: number;
  history: Step[];
  motions: Motion[];
  tests: Record<string, number>;
  active: Goal | null;
  trials: number;
};
const initial = (epoch = 0): State => ({ epoch, history: [], motions: [], tests: {}, active: null, trials: 0 });
type Offer = NativeProposal & { goal: Goal | null; context: string; needId: string; trigger: string };
const gap = (a: NativeBox, b: NativeBox) =>
  Math.max(0, a[0] - b[2], b[0] - a[2]) + Math.max(0, a[1] - b[3], b[1] - a[3]);
const at = (entity: NativeEntity) => entity.signature + '@' + entity.position.join(',');
const scene = (o: NativeObservation) => o.frame_hash + '/' + o.available_action_refs.join(',');
const count = (history: Step[], test: (s: Step) => boolean) => history.reduce((n, s) => n + Number(test(s)), 0);

export function recordCompositionStep(
  state: State,
  before: NativeObservation,
  after: NativeObservation,
  cmd: NativeCommand
) {
  const key = observedCommandKey(cmd),
    history = state.history,
    source = scene(before),
    target = scene(after);
  const repeated = history.some((step) => step.key === key && step.source === source && step.target === target);
  const effect =
    source === target
      ? 'unchanged'
      : history.some((step) => step.source === target || step.target === target)
        ? 'return'
        : 'new';
  history.push({ source, target, key, repeated, effect, evidence: after.observation_ref });
  if (source === target || cmd.action_ref === 'ACTION6') return;
  const unique = new Map(after.entities.filter((e) => !e.identity_ambiguous).map((e) => [e.signature, e]));
  for (const entity of before.entities) {
    const moved = !entity.identity_ambiguous && unique.get(entity.signature);
    if (!moved) continue;
    const dx = moved.position[0] - entity.position[0],
      dy = moved.position[1] - entity.position[1];
    if (!dx && !dy) continue;
    const existing = state.motions.find((m) => m.actor === entity.signature && m.op === key);
    const motion = { actor: entity.signature, op: key, dx, dy, evidence: after.observation_ref };
    if (!existing) state.motions.push(motion);
    else Object.assign(existing, motion);
  }
}

function orderedBefore(a: number[], b: number[]) {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i]! < b[i]!;
  return false;
}
export function chooseSequence(history: Step[], current: string, inputs: readonly NativeCommand[]) {
  const previous = history.at(-1),
    symbols = history.map((s) => s.key.split(':')[0]!);
  const contexts = new Map<string, number>();
  // Count continuations of suffixes ending at the current prefix, shortest first.
  // Length grows with experience, so a repeatedly exhausted pair can expose a longer experiment.
  const depth = Math.min(history.length, 1 + Math.floor(Math.log2(history.length + 1)));
  for (let i = 0; i < history.length; i++) {
    for (let n = 0; n <= Math.min(i, depth); n++) {
      if (n && symbols[i - n] !== symbols[symbols.length - n]) break;
      const k = n + '/' + symbols[i];
      contexts.set(k, (contexts.get(k) ?? 0) + 1);
    }
  }
  let best: { command: NativeCommand; score: number[] } | undefined;
  for (const command of inputs) {
    const key = observedCommandKey(command),
      op = command.action_ref;
    const here = history.filter((s) => s.source === current && s.key === key);
    const relation = actionRelation(previous?.key, key, history.at(-2)?.key);
    const rank = compositionPrior[(previous?.effect ?? 'start') + '/' + relation] ?? 0.5;
    const score = [Number(here.length > 0), here.length];
    for (let n = 1; n <= depth; n++) score.push(contexts.get(n + '/' + op) ?? 0);
    score.push(
      contexts.get('0/' + op) ?? 0,
      count(history, (s) => s.key === key),
      -rank
    );
    if (!best || orderedBefore(score, best.score)) best = { command, score };
  }
  return best?.command;
}
function relationTrial(state: State, observation: NativeObservation, inputs: readonly NativeCommand[]) {
  const ops = new Map(inputs.map((command) => [command.action_ref, command]));
  const candidates = observation.entities;
  let best: { command: NativeCommand; goal: Goal; score: number[]; evidence: string } | undefined;
  for (const motion of state.motions) {
    const actor = candidates.find((e) => !e.identity_ambiguous && e.signature === motion.actor);
    const command = ops.get(motion.op);
    if (!actor || !command) continue;
    const current = scene(observation);
    const known = state.history.filter((s) => s.source === current && s.key === motion.op);
    if (known.some((s) => s.effect === 'unchanged' || s.repeated)) continue;
    const moved: NativeBox = [
      actor.bbox[0] + motion.dx,
      actor.bbox[1] + motion.dy,
      actor.bbox[2] + motion.dx,
      actor.bbox[3] + motion.dy,
    ];
    for (const target of candidates) {
      if (actor === target) continue;
      const distance = gap(actor.bbox, target.bbox),
        next = gap(moved, target.bbox);
      if (distance === 0 || next >= distance) continue;
      const pair = actor.signature + '>' + at(target);
      const continued = state.active?.pair === pair && distance < state.active.gap;
      const score = [continued ? 0 : 1, state.tests[pair] ?? 0, Number(known.length > 0), next, distance];
      if (!best || orderedBefore(score, best.score))
        best = {
          command,
          score,
          goal: { pair, actor: actor.signature, target: at(target), gap: distance },
          evidence: motion.evidence,
        };
    }
  }
  return best;
}

export function createCompositionTrials(): NativeFamily<Offer> {
  let state = initial();
  const learn = (before: NativeObservation, after: NativeObservation, command: NativeCommand) => {
    if (before.level_epoch !== after.level_epoch || before.state !== after.state) return;
    if (state.epoch !== before.level_epoch) state = initial(before.level_epoch);
    recordCompositionStep(state, before, after, command);
  };
  return {
    id: compositionFamily,
    propose: () => null,
    async proposeInGroup(group, observation, rows, inputs, remaining) {
      if (state.epoch !== observation.level_epoch || !state.history.length || remaining < 1) return null;
      const history = state.history;
      const repeated = history.filter((s) => s.repeated && s.effect !== 'unchanged');
      const returns = history.filter((s) => s.effect === 'return');
      const recent = history.slice(-8);
      const replaying = repeated.length >= 3 && recent.some((s) => s.repeated && s.effect !== 'unchanged');
      const revisiting = returns.length >= 6 && recent.filter((s) => s.effect === 'return').length >= 2;
      if (group === cycleGroup && !replaying && !revisiting) return null;
      if (group !== cycleGroup && group !== exhaustedGroup) return null;
      const available = [...inputs];
      for (const op of observation.available_action_refs)
        if (op !== 'ACTION6' && !available.some((c) => c.action_ref === op))
          available.push({ action_ref: op, data: {} });
      const sequence = chooseSequence(history, scene(observation), available);
      if (!sequence) return null;
      const relational = (state.active || state.trials % 2 === 1) && relationTrial(state, observation, available);
      const command = relational ? relational.command : sequence,
        goal = relational ? relational.goal : null;
      const evidence = [
        ...new Set([
          observation.observation_ref,
          history.at(-1)!.evidence,
            ...(group === cycleGroup ? (replaying ? repeated.slice(-3) : returns.slice(-6)).map((s) => s.evidence) : []),
          ...(relational ? [relational.evidence] : []),
        ]),
      ];
      const context = actionRelation(history.at(-1)?.key, observedCommandKey(command), history.at(-2)?.key);
      const label = goal
        ? 'Test whether an observed movement brings two visible components together'
        : 'Test an underexplored continuation of the observed action sequence';
      const parent = 'G_official_completion',
        ref = observation.observation_ref;
      const question = {
        kind: 'test_observed_composition',
        scope: ref.split(':revision:', 1)[0]!,
        subjects: goal
          ? [goal.actor, goal.target, command.action_ref]
          : [context, observedCommandKey(command), history.at(-1)!.key],
        parentObjective: parent,
        satisfactionContract: goal ? 'observe_change_in_pair_distance' : 'observe_the_composed_public_return',
      };
      const need = { ...question, id: sicNeedId(question), status: 'assigned', evidence };
      const witness =
        command.action_ref === 'ACTION6'
          ? await ObservedInputDomain.makeLocusWitness(observation, rows, [command.data.x!, command.data.y!], {
              reason: label,
              evidence,
            })
          : null;
      return {
        status: 'proposed',
        kind: compositionFamily,
        actions: [command],
        goal,
        context,
        trigger: group,
        needId: need.id,
        steps: [{ action: command, expected_after: null, ...(witness ? { point_binding: witness } : {}) }],
        binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        sicSituationCard: {
          strategy: 'test_composition',
          need: label,
          mode: 'exploration',
          situation: label,
          evidence,
          agenda: [],
          trigger: group,
        },
        compositions: [
          { id: need.id, observed: false, open_question: label, relations: ['contributes_to:' + parent] },
        ],
        question: { reason: label, hypothesis_refs: evidence },
        route_refs: evidence,
        sicLocalDecision: { strategy: 'test_composition', objective: { id: need.id, label, parent }, need },
        bundle_template: {
          operation_key: 'OP18',
          composition_ref: need.id,
          objective_ref: parent,
          purpose: label,
          evidence,
          preconditions: {},
          preserve_refs: [],
          actions: [command],
          outcome_guard: { path: ['value'], contains: need.id },
        },
      };
    },
    before(p, i, _packet, o) {
      const admitted = i === 0 && p.binding?.observation_ref === o.observation_ref;
      return { admitted, reason: admitted ? 'current_composition_bound' : 'composition_scope_changed' };
    },
    after(p, _i, b, a) {
      const won = a.levels_completed > b.levels_completed;
      const actor = p.goal && a.entities.find((e) => !e.identity_ambiguous && e.signature === p.goal!.actor);
      const target = p.goal && a.entities.find((e) => at(e) === p.goal!.target);
      const matched = won
        ? true
        : p.goal
          ? actor && target
            ? gap(actor.bbox, target.bbox) < p.goal.gap
            : null
          : null;
      return {
        matched,
        seal_prefix: true,
        reason: won
          ? 'official_boundary'
          : matched === true
            ? 'objects_approached'
            : matched === false
              ? 'approach_refuted'
              : 'sequence_return_observed',
      };
    },
    record(b, a, command, _first, _second, p) {
      learn(b, a, command);
      state.trials++;
      if (p.goal) state.tests[p.goal.pair] = (state.tests[p.goal.pair] ?? 0) + 1;
      state.active = p.goal;
      return {
        events: [{ kind: 'sic_composition_trial', context: p.context, trigger: p.trigger, relation: !!p.goal }],
      };
    },
    observePublicOutcome(b, a, c) {
      learn(b, a, c);
      state.active = null;
    },
    state: () => state,
    restore(value: NativeRecord) {
      state = structuredClone(value as State);
    },
  };
}
