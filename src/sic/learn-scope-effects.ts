import { measureSubsetScene, subsetFeedback } from '../logos-engine/v6-subset-diagnosis.ts';
import { ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeFamily, NativePoint, NativeProposal, NativeRecord } from '../logos-engine/v6-native-types.ts';
import { assessHypothesisPartition } from './discriminating-experiment.ts';
import { navigationPrimitives, resolveNavigationPrimitives } from './navigation-primitives.ts';
import { sicNeedId } from './need-identity.ts';

export const learnScopeEffectsId = 'sic_learn_scope_effects';

type Scene = NonNullable<ReturnType<typeof measureSubsetScene>>;
type Control = { color: string; bbox: NativeBox; shape: readonly [number, number, unknown]; area: number };
type Mode = 'test' | 'navigate';
type Effect = { mode: Mode; ref: string };
type State = { epoch: number; universe: string; possible: number[]; tried: string[];
  effects: Record<string, Effect>; refs: string[]; hypothesisRefuted: boolean };
type Choice = { box: NativeBox; point: NativePoint; key: string; shape?: string; mode?: Mode; support?: string;
  group: number[]; possibleAfter: number; density: number };
type Proposal = NativeProposal & { local: State; scene: Scene; choice: Choice; needId: string };

const center = ([l, t, r, b]: NativeBox): NativePoint => [Math.floor((l + r) / 2), Math.floor((t + b) / 2)];
const attempt = (focus: readonly number[], point: NativePoint) => JSON.stringify([focus, point]);

function choose(scene: Scene, local: State): Choice | null {
  const focus = scene.focus as number[], controls = scene.controls as Control[], boxes = scene.boxes as NativeBox[];
  const scopeMembers = scene.scope_members as Record<string, number[]>;
  const remaining = local.possible.length;
  const make = (box: NativeBox, group: number[], density: number, shape?: string): Choice | null => {
    const point = center(box), key = attempt(focus, point);
    if (local.tried.includes(key)) return null;
    const overlap = local.possible.filter(member => group.includes(member)).length;
    if (!overlap) return null;
    const assessment = assessHypothesisPartition([overlap, remaining - overlap])!;
    const known = shape ? local.effects[shape] : undefined;
    return { box, point, key, group, density, possibleAfter: assessment.remaining,
      ...(shape ? { shape } : {}), ...(known ? { mode: known.mode, support: known.ref } : {}) };
  };
  const available = controls.flatMap(control => {
    const candidate = make(control.bbox, scopeMembers[control.color] ?? [], control.area / control.shape[0], JSON.stringify(control.shape));
    return candidate ? [candidate] : [];
  });
  const split = available.filter(offer => offer.mode === 'test' && offer.possibleAfter < remaining)
    .sort((a, b) => a.possibleAfter - b.possibleAfter)[0];
  if (split) return split;
  const learnedTest = Object.values(local.effects).some(effect => effect.mode === 'test');
  if (!learnedTest) {
    const probe = available.filter(offer => !offer.mode && offer.possibleAfter < remaining).sort((a, b) => b.density - a.density)[0];
    if (probe) return probe;
  }
  if (remaining > 2) {
    const access = available.find(offer => offer.mode !== 'test');
    if (access) return access;
  }
  for (const member of local.possible) {
    const individual = make(boxes[member]!, [member], 0);
    if (individual) return individual;
  }
  return null;
}

export function createSicLearnScopeEffects(): NativeFamily<Proposal> {
  let memory: State | null = null;
  return {
    id: learnScopeEffectsId,
    async propose(observation, rows, _inputs, remaining, execution) {
      if (remaining < 1 || !observation.available_action_refs.includes('ACTION6')) return null;
      const scene = measureSubsetScene(rows);
      if (!scene) return null;
      const local: State = memory?.epoch === observation.level_epoch && memory.universe === scene.universe_ref ? memory : {
        epoch: observation.level_epoch, universe: scene.universe_ref, possible: (scene.boxes as NativeBox[]).map((_, i) => i),
        tried: [], effects: memory?.effects ?? {}, refs: [], hypothesisRefuted: false,
      };
      if (local.hypothesisRefuted) return null;
      const choice = choose(scene, local);
      if (!choice) return null;
      const ref = observation.observation_ref;
      const prior = [...new Set([choice.support, ...local.refs].filter((value): value is string => !!value && value !== ref))];
      const evidence: [string, ...string[]] = [ref, ...prior];
      const mode = execution?.reasoningMode ?? 'exploration';
      const offer = { input: 'ACTION6', expected: choice.point, evidence };
      const { selected, entries, card } = resolveNavigationPrimitives({ mode, evidence, probe: !choice.mode ? offer : null,
        access: choice.mode === 'navigate' ? offer : null, interaction: choice.mode === 'test' ? offer : null });
      if (!selected) return null;
      const purpose = choice.mode === 'navigate' ? 'Access a group while preserving the remaining candidates'
        : choice.mode === 'test' ? 'Reuse the observed group test to distinguish remaining candidates'
          : choice.shape ? 'Measure whether this control changes the view or tests the group' : 'Test the remaining candidate at its visible cell';
      const witness = await ObservedInputDomain.makeLocusWitness(observation, rows, choice.point, { reason: purpose, evidence });
      if (!witness) return null;
      const parent = 'G_official_completion';
      const objective = { kind: 'resolve_scope_feedback', scope: ref.split(':revision:', 1)[0]!,
        subjects: [scene.universe_ref as string], parentObjective: parent, satisfactionContract: 'official_progress_after_candidate_confirmation' };
      const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence };
      const id = learnScopeEffectsId + ':' + need.id, [x, y] = choice.point, action = { action_ref: 'ACTION6', data: { x, y } };
      return {
        status: 'proposed', kind: learnScopeEffectsId, local, scene, choice, needId: need.id,
        binding: { observation_ref: ref, level_epoch: observation.level_epoch }, actions: [action],
        steps: [{ action, point_binding: witness, expected_after: null }],
        sicSituationCard: { strategy: selected.id, need: 'Identify which candidate causes the global response', situation: purpose,
          evidence, agenda: entries, mode, triggerCard: card, target: choice.box, members: choice.group.map(member => scene.boxes[member]),
          remainingCandidates: local.possible.length },
        question: { reason: purpose, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: purpose, relations: ['contributes_to:' + parent] }],
        sicLocalDecision: { strategy: selected.id, objective: { id, label: navigationPrimitives[selected.id], parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose,
          preconditions: {}, preserve_refs: [], evidence, actions: [action], outcome_guard: { path: ['value'], contains: id } },
      };
    },
    before(proposal, index, _packet, current) {
      const admitted = index === 0 && proposal.binding?.observation_ref === current.observation_ref;
      return { admitted, reason: admitted ? 'scope_control_bound' : 'scope_changed' };
    },
    after(proposal, _index, before, after) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true, reason: 'official_boundary',
        sic_need: { id: proposal.needId, status: 'satisfied' } };
      return { matched: null, seal_prefix: true, reason: 'check_view_and_animation_separately' };
    },
    record(before, after, _command, rows, returned, { local, scene, choice }, _index, frames) {
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const feedback = subsetFeedback(rows, frames.length ? frames : [returned], scene);
      const tried = [...local.tried, choice.key], refs = [...local.refs.slice(-3), after.observation_ref];
      if (feedback?.status === 'sealed_scope_feedback') {
        const tested = new Set<number>(feedback.tested);
        const possible = local.possible.filter(member => tested.has(member) === (feedback.label === 'GLOBAL'));
        const effects = choice.shape ? { ...local.effects, [choice.shape]: { mode: 'test' as const, ref: after.observation_ref } } : local.effects;
        memory = { ...local, possible, tried, refs, effects, hypothesisRefuted: !possible.length };
        return { events: [{ kind: 'sic_observed_scope_feedback', result: feedback.label, tested: tested.size,
          candidates: possible.length, modelRefuted: !possible.length, observation: after.observation_ref }] };
      }
      const next = measureSubsetScene(returned);
      const changed = next?.universe_ref === scene.universe_ref && JSON.stringify(next?.focus) !== JSON.stringify(scene.focus);
      const effects = choice.shape && changed ? { ...local.effects, [choice.shape]: { mode: 'navigate' as const, ref: after.observation_ref } } : local.effects;
      memory = { ...local, tried, effects, refs: changed ? refs : local.refs };
      return { events: changed ? [{ kind: 'sic_observed_scope_navigation', candidates: local.possible.length, observation: after.observation_ref }] : [] };
    },
    state: () => ({ memory }),
    restore(value: NativeRecord) { memory = structuredClone(value.memory as State | null); },
  };
}
