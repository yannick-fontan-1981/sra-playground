import { measureSubsetScene, subsetFeedback } from '../logos-engine/v6-subset-diagnosis.ts';
import { ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeFamily, NativePoint, NativeProgramHandle, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { assessHypothesisPartition } from './discriminating-experiment.ts';
import { navigationPrimitives, resolveNavigationPrimitives } from './navigation-primitives.ts';
import { sicNeedId } from './need-identity.ts';
import { chooseLanding, landingModule } from './highlighted-route-card.ts';
import { measureGroupResponse, observeVisibleScope, type VisibleScope } from './observed-group-effects.ts';

export const learnScopeEffectsId = 'sic_learn_scope_effects';
export const learnVisibleGroupEffectsId = 'sic_learn_visible_group_effects';

type Scene = VisibleScope;
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
  const { focus, controls, boxes, scope_members: scopeMembers } = scene;
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

export function createSicLearnScopeEffects(family = learnScopeEffectsId): NativeFamily<Proposal> {
  const fromVisibleGroups = family === learnVisibleGroupEffectsId;
  const readScene = (rows: NativeRows): Scene | null => fromVisibleGroups
    ? observeVisibleScope(rows) : measureSubsetScene(rows) as Scene | null;
  let memory: State | null = null;
  let decide: NativeProgramHandle | undefined;
  return {
    id: family,
    async attachPrograms(registry) {
      if (fromVisibleGroups) decide = await registry.registerProgram(chooseLanding, {}, await landingModule());
    },
    async propose(observation, rows, _inputs, remaining, execution) {
      if (remaining < 1 || !observation.available_action_refs.includes('ACTION6')) return null;
      if (fromVisibleGroups && observation.available_action_refs.some(action => /^ACTION[1-5]$/.test(action))) return null;
      const scene = readScene(rows);
      if (!scene) return null;
      const local: State = memory?.epoch === observation.level_epoch && memory.universe === scene.universe_ref ? memory : {
        epoch: observation.level_epoch, universe: scene.universe_ref, possible: scene.boxes.map((_, i) => i),
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
      const legacy = fromVisibleGroups ? null : resolveNavigationPrimitives({ mode, evidence, probe: !choice.mode ? offer : null,
        access: choice.mode === 'navigate' ? offer : null, interaction: choice.mode === 'test' ? offer : null });
      const facts = { routeSupported: choice.mode === 'navigate', eligibleProbe: !choice.mode, knownInteraction: choice.mode === 'test', mode };
      const decision = fromVisibleGroups ? await decide?.run({ situation: facts }, { signal: execution?.signal }) : undefined;
      const primitive = choice.mode === 'navigate' ? 'P07' : choice.mode === 'test' ? 'P02' : 'P05';
      if (fromVisibleGroups && decision?.result !== primitive) return null;
      const strategy = fromVisibleGroups ? primitive : legacy?.selected?.id;
      if (!strategy) return null;
      const purpose = choice.mode === 'navigate' ? 'Access a group while preserving the remaining candidates'
        : choice.mode === 'test' ? 'Reuse the observed group test to distinguish remaining candidates'
          : choice.shape ? 'Measure whether this control changes the view or tests the group' : 'Test the remaining candidate at its visible cell';
      const witness = await ObservedInputDomain.makeLocusWitness(observation, rows, choice.point, { reason: purpose, evidence });
      if (!witness) return null;
      const parent = 'G_official_completion';
      const objective = { kind: 'resolve_scope_feedback', scope: ref.split(':revision:', 1)[0]!,
        subjects: [scene.universe_ref], parentObjective: parent, satisfactionContract: 'official_progress_after_candidate_confirmation' };
      const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence };
      const id = family + ':' + need.id, [x, y] = choice.point, action = { action_ref: 'ACTION6', data: { x, y } };
      return {
        status: 'proposed', kind: family, local, scene, choice, needId: need.id,
        binding: { observation_ref: ref, level_epoch: observation.level_epoch }, actions: [action],
        steps: [{ action, point_binding: witness, expected_after: null }],
        ...(decision ? { sicSrcDecision: { workflow: decision.receipt.workflow, hash: decision.receipt.src_hash,
          instructions: decision.receipt.instructions, edited: 'edited' in decision.receipt && decision.receipt.edited === true,
          situation: facts } } : {}),
        sicSituationCard: { strategy, need: 'Identify which candidate causes the global response', situation: purpose,
          evidence, agenda: legacy?.entries ?? [], mode, triggerCard: fromVisibleGroups ? chooseLanding : legacy?.card,
          target: choice.box, members: choice.group.map(member => scene.boxes[member]),
          remainingCandidates: local.possible.length },
        question: { reason: purpose, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: purpose, relations: ['contributes_to:' + parent] }],
        sicLocalDecision: { strategy, objective: { id, label: navigationPrimitives[strategy], parent }, need },
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
      const visibleFrames = frames.length ? frames : [returned];
      const legacy = fromVisibleGroups ? null : subsetFeedback(rows, visibleFrames, scene);
      const feedback = fromVisibleGroups ? measureGroupResponse(rows, visibleFrames, scene.boxes)
        : legacy?.status === 'sealed_scope_feedback' ? { tested: legacy.tested as number[], reachesEverySite: legacy.label === 'GLOBAL' } : null;
      const tried = [...local.tried, choice.key], refs = [...local.refs.slice(-3), after.observation_ref];
      if (feedback) {
        const tested = new Set(feedback.tested), result = feedback.reachesEverySite ? 'GLOBAL' : 'LOCAL';
        const possible = local.possible.filter(member => tested.has(member) === feedback.reachesEverySite);
        const effects = choice.shape ? { ...local.effects, [choice.shape]: { mode: 'test' as const, ref: after.observation_ref } } : local.effects;
        memory = { ...local, possible, tried, refs, effects, hypothesisRefuted: !possible.length };
        return { events: [{ kind: 'sic_observed_scope_feedback', result, tested: tested.size,
          candidates: possible.length, modelRefuted: !possible.length, observation: after.observation_ref }],
          reviewEvidence: `${tested.size} sites reacted first. The effect ${feedback.reachesEverySite ? 'spread to the whole grid' : 'stayed inside the tested group'}. ${possible.length} candidates remained.` };
      }
      const next = readScene(returned);
      const changed = next?.universe_ref === scene.universe_ref && JSON.stringify(next?.focus) !== JSON.stringify(scene.focus);
      const effects = choice.shape && changed ? { ...local.effects, [choice.shape]: { mode: 'navigate' as const, ref: after.observation_ref } } : local.effects;
      memory = { ...local, tried, effects, refs: changed ? refs : local.refs };
      return changed ? { events: [{ kind: 'sic_observed_scope_navigation', candidates: local.possible.length, observation: after.observation_ref }],
        reviewEvidence: `The visible group changed. ${local.possible.length} candidates remained.` } : { events: [] };
    },
    state: () => ({ memory }),
    restore(value: NativeRecord) { memory = structuredClone(value.memory as State | null); },
  };
}
