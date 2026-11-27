import { catalogueFieldPixels, catalogueStructure, exposedCatalogueValues, fitOccludedCatalogue,
  measureOccludedCatalogue } from '../logos-engine/v6-occluded-catalogue-observation.ts';
import type { JsonObject } from '../logos-engine/ir.ts';
import { ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeCommand, NativeFamily, NativeObservation, NativePoint, NativeProgramHandle, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { sicNeedId } from './need-identity.ts';
import { checkRevealedExample, chooseRevealedExample, revealedExampleModule, revealedExampleOperations } from './revealed-example-card.ts';
import { compileStrategyGraph, resolveStrategyGraph } from './strategy-agenda.ts';
import { readSlottedCatalogue, type SlottedCatalogue } from './catalogue-slots.ts';
import { chooseJointCatalogue, observeCatalogueSubject, recordJointCatalogue, type JointCatalogue, type JointCatalogueAction } from './joint-catalogue-views.ts';

export const catalogueComparisonId = 'sic_catalogue_comparison';
export const continueCatalogueViewsGroup = 'continue_observed_catalogue_views';
export const revealedExampleId = 'sic_resolve_observed_ambiguity';
export const catalogueComparisonStrategies = {
  seek_distinguishing_view: 'Change the view to distinguish possible shapes',
  test_unique_catalogue_match: 'Select the only compatible shape',
  change_catalogue_subject: 'Select another visible subject to compare',
} as const;
const graph = compileStrategyGraph({ id: 'identify_occluded_shapes_by_comparison', version: 1, order: 'FALLBACK',
  priorities: ['test_unique_catalogue_match', 'change_catalogue_subject', 'seek_distinguishing_view'],
  strategies: {
    seek_distinguishing_view: [{ fact: 'views', expected: true, label: 'Several shapes remain possible or the visible background is unconfirmed' }],
    test_unique_catalogue_match: [{ fact: 'unique', expected: true, label: 'Only one displayed shape agrees with the visible parts and measured background' }],
    change_catalogue_subject: [{ fact: 'next', expected: true, label: 'A different visible subject still needs a shape comparison' }],
  },
}, ['views', 'unique', 'next']);
type Card = { bbox: NativeBox; point: NativePoint; mask: NativePoint[]; extent: NativePoint };
type Control = { palette: number; bbox: NativeBox; point: NativePoint };
type Scene = { field: NativeBox; palette: number; cards: Card[]; controls: Control[]; geometry_ref: string };
type State = { epoch: number; field: NativeBox; backgrounds: number[]; submitted: number[]; candidates: Record<string, number[]>;
  views: string[]; tried: string[]; stopped: boolean; evidence: string[] };
type Choice = { action: NativeCommand; sprite: NativeBox | null; target: number | null };
type ViewControl = readonly [number, number, number];
type LearnedViews = { scope: string; epoch: number; completed: number; commands: Record<string, string[]>; evidence: string[];
  controls?: ViewControl[] };
type Strategy = keyof typeof catalogueComparisonStrategies;
type SingleCatalogueProposal = NativeProposal & { local: State; scene: Scene; asked: Choice; attempt: string; strategy: Strategy; needId: string; candidateCount: number };
type JointProposal = NativeProposal & { joint: JointCatalogue; slotted: SlottedCatalogue; choice: JointCatalogueAction; attempt: string; needId: string };
type Proposal = SingleCatalogueProposal | JointProposal;
const isJoint = (proposal: Proposal): proposal is JointProposal => 'joint' in proposal;
const key = (value: unknown) => JSON.stringify(value);
const same = (a: unknown, b: unknown) => key(a) === key(b);
const directions = ['ACTION3', 'ACTION4', 'ACTION1', 'ACTION2'];
const point = ([x, y]: NativePoint): NativeCommand => ({ action_ref: 'ACTION6', data: { x, y } });
const catalogueKey = (scene: Scene) => key([scene.geometry_ref, scene.cards.map(card => card.mask), scene.palette]);
const sourceScope = (observation: NativeObservation) => observation.observation_ref.split(':epoch:')[0]!;
const viewControls = (scene: Scene): ViewControl[] | null => new Set(scene.controls.map(control => control.palette)).size !== scene.controls.length ? null
  : scene.controls.map(control => [control.palette, control.bbox[2] - control.bbox[0], control.bbox[3] - control.bbox[1]] as const)
    .sort((a, b) => a[0] - b[0]);
const viewInterface = (scene: Scene) => { const controls = viewControls(scene); return controls && key(controls); };
function viewReturn(first: NativeRows, second: NativeRows, scene: Scene): boolean | null {
  const returned = measureOccludedCatalogue(second) as Scene | null;
  if (!returned || !same(catalogueStructure(scene), catalogueStructure(returned))) return false;
  return exposedCatalogueValues(first, second, scene).length ? true : null;
}

function fits(rows: NativeRows, scene: Scene, state: State) {
  const prior = state.candidates[catalogueKey(scene)];
  return [...new Set<number>(fitOccludedCatalogue(rows, scene, state.backgrounds).map(fit => fit.candidate))]
    .filter(id => !prior || prior.includes(id));
}

export function createSicCatalogueComparison(family = catalogueComparisonId): NativeFamily<Proposal> {
  const declarative = family === revealedExampleId;
  let state: State | null = null;
  let joint: JointCatalogue | null = null;
  let learnedViews: Record<string, LearnedViews> = {};
  const reusableViews = (observation: NativeObservation, scene: Scene) => {
    const controls = viewControls(scene);
    if (!controls) return null;
    const eligible = (known: LearnedViews | undefined) => known?.scope === sourceScope(observation)
      && known.completed === observation.levels_completed
      && (known.epoch === observation.level_epoch || known.epoch === observation.level_epoch - 1);
    const exact = learnedViews[key(controls)];
    if (eligible(exact)) return exact;
    // Additional selectors do not invalidate the unique controls already observed.
    // Only their acquired commands are retained; a new subject still needs a return.
    const extensions = Object.values(learnedViews).filter(known => eligible(known) && known.controls?.length
      && known.controls.every(prior => controls.some(current => same(prior, current))));
    return extensions.length === 1 ? extensions[0]! : null;
  };
  let choose: NativeProgramHandle | undefined;
  let verify: NativeProgramHandle | undefined;
  async function offerJoint(observation: NativeObservation, rows: NativeRows, remaining: number): Promise<JointProposal | null> {
    const { level_epoch: epoch, observation_ref: ref, frame_hash: frameHash, available_action_refs: available } = observation;
    const prior = joint?.epoch === epoch ? joint : null;
    if (prior && (prior.stopped || prior.lastRef !== ref)) return null;
    const slotted = readSlottedCatalogue(rows);
    if (!slotted) return null;
    const local = observeCatalogueSubject(prior ?? { epoch, lastRef: ref, subjects: [], submitted: [], step: null,
      tried: [], evidence: [], stopped: false }, slotted, rows);
    if (!local) return null;
    const choice = chooseJointCatalogue(local, slotted, rows, frameHash, available, remaining);
    if (!choice) return null;
    const strategy = { select: 'change_catalogue_subject', move: 'seek_distinguishing_view', submit: 'test_unique_catalogue_match' }[choice.kind];
    const reason = choice.kind === 'move' ? 'Move a shape where the available views can distinguish remaining models'
      : choice.kind === 'submit' ? 'Submit the shape supported by the collected views' : 'Read or select the catalogue for this shape';
    const evidence: [string, ...string[]] = [ref, ...local.evidence.filter(value => value !== ref)];
    const action = choice.action, actions = [action];
    const binding = choice.kind === 'move' ? null : await ObservedInputDomain.makeLocusWitness(
      observation, rows, [action.data.x!, action.data.y!], { reason, evidence });
    if (!binding && choice.kind !== 'move') return null;
    const objective = { kind: 'reconstruct_occluded_catalogue_across_views', scope: ref.split(':revision:', 1)[0]!,
      subjects: ['partial_field', 'catalogue_shapes'], parentObjective: 'G_official_completion',
      satisfactionContract: 'official_progress_after_all_compatible_shapes_submitted' };
    const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence };
    const id = `catalogue-comparison:${need.id}`;
    const active = local.subjects.find(subject => subject.palette === slotted.palette)!;
    return { status: 'proposed', kind: family, joint: local, slotted, choice, needId: need.id, actions,
      attempt: key([frameHash, action]), binding: { observation_ref: ref, level_epoch: epoch },
      steps: [{ action, expected_after: null, ...(binding ? { point_binding: binding } : {}) }],
      sicSituationCard: { strategy, need: 'Identify each shape from the available catalogue views',
        mode: choice.kind === 'submit' ? 'solving' : 'exploration', situation: reason, agenda: [], evidence,
        field: slotted.field, choice: choice.box, cards: active.options.map(option => slotted.cards[option.card]!.bbox),
        subjects: local.subjects.map(subject => ({ palette: subject.palette, alternatives: subject.options.length })),
        ...(choice.revealed ? { potentiallyRevealedSubjects: choice.revealed } : {}) },
      question: { reason, hypothesis_refs: evidence }, route_refs: evidence,
      compositions: [{ id, observed: false, open_question: reason, relations: ['contributes_to:' + objective.parentObjective] }],
      sicLocalDecision: { strategy, objective: { id, label: reason, parent: objective.parentObjective }, need },
      bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: objective.parentObjective, purpose: reason,
        preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
  }
  return {
    id: family,
    async attachPrograms(registry) {
      if (!declarative) return;
      const module = await revealedExampleModule();
      choose = await registry.registerProgram(chooseRevealedExample, revealedExampleOperations, module);
      verify = await registry.registerProgram(checkRevealedExample, revealedExampleOperations, module);
    },
    proposeInSubquestion(_group, entry, observation, rows, inputs, remaining, execution) {
      return this.proposeInGroup!(entry, observation, rows, inputs, remaining, execution);
    },
    async proposeInGroup(group, observation, rows, inputs, remaining, execution) {
      if (group !== continueCatalogueViewsGroup) return this.propose(observation, rows, inputs, remaining, execution);
      if (!Object.keys(learnedViews).length) return null;
      const scene = measureOccludedCatalogue(rows) as Scene | null, known = scene && reusableViews(observation, scene);
      const commands = scene && known?.commands[scene.palette];
      if (!commands?.some(command => observation.available_action_refs.includes(command))) return null;
      const proposal = await this.propose(observation, rows, inputs, remaining, execution);
      return proposal && !isJoint(proposal) && (proposal.strategy !== 'seek_distinguishing_view'
        || commands.includes(proposal.asked.action.action_ref)) ? proposal : null;
    },
    async propose(observation, rows, _inputs, remaining, execution) {
      if (remaining < 1 || !observation.available_action_refs.includes('ACTION6') || execution?.signal?.aborted) return null;
      if (declarative && (!choose || (!state && !execution?.readDirectionalView))) return null;
      if (!declarative && joint?.epoch === observation.level_epoch) return offerJoint(observation, rows, remaining);
      const scene = measureOccludedCatalogue(rows) as Scene | null;
      if (!scene || scene.cards.length > 8) return declarative ? null : offerJoint(observation, rows, remaining);
      const prior = state?.epoch === observation.level_epoch && same(state.field, scene.field) ? state : null;
      const known = reusableViews(observation, scene);
      const acquisition = declarative && !prior ? execution?.readDirectionalView?.(scene.field, scene.palette,
        [...scene.cards.map(card => card.bbox), ...scene.controls.map(control => control.bbox)]) : null;
      if (declarative && !prior && !acquisition?.exposed.length) return null;
      const local: State = prior ?? { epoch: observation.level_epoch, field: scene.field, backgrounds: [], submitted: [],
        candidates: {}, views: [...(known?.commands[scene.palette] ?? [])], tried: [], stopped: false, evidence: [...(known?.evidence ?? [])] };
      if (acquisition?.exposed.length) {
        local.backgrounds = [...acquisition.exposed];
        local.views = [acquisition.command];
        local.evidence = [acquisition.beforeRef];
      }
      if (local.stopped || local.tried.length >= 24) return null;
      const context = (action: NativeCommand) => key([observation.frame_hash, action]);
      const seen = (action: NativeCommand) => local.tried.includes(context(action));
      const ids = local.backgrounds.length ? fits(rows, scene, local) : scene.cards.map((_, i) => i);
      const answer = !local.submitted.includes(scene.palette) && ids.length === 1 ? scene.cards[ids[0]!]! : null;
      const selector = local.submitted.includes(scene.palette) ? scene.controls.find(control =>
        !local.submitted.includes(control.palette) && !seen(point(control.point))) : null;
      const available = [...new Set([...local.views, ...directions])].find(action_ref =>
        observation.available_action_refs.includes(action_ref) && !seen({ action_ref, data: {} }));
      const view: Choice | null = !local.submitted.includes(scene.palette) && ids.length > 1 && available
        ? { action: { action_ref: available, data: {} }, sprite: null, target: null } : null;
      const answerChoice: Choice | null = answer && !seen(point(answer.point))
        ? { action: point(answer.point), sprite: answer.bbox, target: scene.palette } : null;
      const select: Choice | null = selector ? { action: point(selector.point), sprite: selector.bbox, target: selector.palette } : null;
      const ref = observation.observation_ref, evidence: [string, ...string[]] = [ref, ...local.evidence.filter(value => value !== ref)];
      const choices = { seek_distinguishing_view: view, test_unique_catalogue_match: answerChoice, change_catalogue_subject: select };
      const situation = { views: !!view, unique: !!answerChoice, next: !!select, candidateCount: ids.length,
        mode: execution?.reasoningMode ?? 'exploration' };
      const decision = declarative ? await choose?.run({ situation }, { signal: execution?.signal }) : null;
      const evaluated = declarative ? null : resolveStrategyGraph({ graph, mode: 'active', facts: {
        views: { value: situation.views, evidence }, unique: { value: situation.unique, evidence }, next: { value: situation.next, evidence },
      }, planners: { seek_distinguishing_view: () => view, test_unique_catalogue_match: () => answerChoice, change_catalogue_subject: () => select } });
      const requested = decision?.result ?? evaluated?.selected?.id;
      if (typeof requested !== 'string' || !Object.hasOwn(choices, requested)) return null;
      const strategy = requested as Strategy, asked = choices[strategy];
      if (!asked) return null;
      const label = catalogueComparisonStrategies[strategy], parent = 'G_official_completion';
      const objective = { kind: 'identify_visible_shape_from_catalogue', scope: ref.split(':revision:', 1)[0]!,
        subjects: ['partial_field', 'catalogue_shapes'], parentObjective: parent, satisfactionContract: 'official_progress_after_submitting_compatible_shapes' };
      const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence }, id = `catalogue-comparison:${need.id}`;
      const actions = [asked.action];
      const binding = asked.target !== null && await ObservedInputDomain.makeLocusWitness(observation, rows,
        [asked.action.data.x!, asked.action.data.y!], { reason: label, evidence });
      return { status: 'proposed', kind: family, actions, local, scene, asked, attempt: context(asked.action), strategy,
        needId: need.id, candidateCount: ids.length,
        steps: [{ action: asked.action, expected_after: null, ...(binding ? { point_binding: binding } : {}) }],
        binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        ...(decision ? { sicSrcDecision: { workflow: decision.receipt.workflow, hash: decision.receipt.src_hash,
          instructions: decision.receipt.instructions, edited: 'edited' in decision.receipt && decision.receipt.edited === true, situation } } : {}),
        sicSituationCard: { strategy, need: 'Identify the shape that is partly hidden', mode: answer ? 'solving' : 'exploration',
          situation: local.submitted.includes(scene.palette) ? label : `${ids.length} visible cards still fit the measured evidence. ${label}.`,
          agenda: evaluated?.entries ?? [], evidence, field: scene.field, choice: asked.sprite, cards: ids.map(index => scene.cards[index]!.bbox).slice(0, 4) },
        question: { reason: label, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: label, relations: [`contributes_to:${parent}`] }],
        sicLocalDecision: { strategy, objective: { id, label, parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: label,
          preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
    },
    before(proposal, index, _packet, observation) {
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref;
      return { admitted, reason: admitted ? 'catalogue_and_field_bound' : 'catalogue_view_changed' };
    },
    async after(proposal, _index, before, after, first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true, reason: 'official_boundary',
        sic_need: { id: proposal.needId, status: 'satisfied' } };
      if (isJoint(proposal)) {
        const result = recordJointCatalogue(proposal.joint, proposal.slotted, readSlottedCatalogue(second), first, second,
          proposal.choice, after.observation_ref, proposal.attempt);
        return { matched: result.matched, seal_prefix: true, reason: result.reason };
      }
      if (verify && proposal.strategy !== 'test_unique_catalogue_match') {
        const { local, scene } = proposal;
        const returned = measureOccludedCatalogue(second) as Scene | null;
        const comparable = !!returned && same(scene.field, returned.field);
        const outcome: JsonObject = proposal.strategy === 'change_catalogue_subject'
          ? { comparable, subjectSelected: returned?.palette === proposal.asked.target }
          : returned && comparable && same(catalogueStructure(scene), catalogueStructure(returned)) ? {
            comparable, beforeCount: proposal.candidateCount,
            afterCount: fits(second, returned, { ...local, backgrounds: [...new Set([...local.backgrounds, ...exposedCatalogueValues(first, second, scene)])] }).length,
          } : { comparable: false };
        const checked = await verify.run({ outcome });
        const matched = typeof checked.result === 'boolean' ? checked.result : null;
        return { matched, seal_prefix: true, reason: matched === true ? 'compared_view_supported' : matched === false
          ? 'compared_view_contradicted' : 'compared_view_unverified',
          src_check: { workflow: checked.receipt.workflow, hash: checked.receipt.src_hash, ...outcome } };
      }
      if (proposal.strategy === 'seek_distinguishing_view') {
        const matched = viewReturn(first, second, proposal.scene);
        return { matched, seal_prefix: true, reason: matched === true ? 'catalogue_view_effect_observed'
          : matched === false ? 'catalogue_view_interface_contradicted' : 'catalogue_view_still_ambiguous' };
      }
      return { matched: null, seal_prefix: true, reason: 'compare_partial_view_and_catalogue' };
    },
    record(before, after, issued, first, second, proposal) {
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) {
        this.observePublicOutcome?.(before, after, issued, first, second);
        return { events: [] };
      }
      if (isJoint(proposal)) {
        const result = recordJointCatalogue(proposal.joint, proposal.slotted, readSlottedCatalogue(second), first, second,
          proposal.choice, after.observation_ref, proposal.attempt);
        joint = result.local;
        const reduced = result.matched && proposal.choice.kind === 'move'
          ? proposal.joint.subjects.flatMap(subject => {
            const current = result.local.subjects.find(item => item.palette === subject.palette);
            return current && current.options.length < subject.options.length ? [subject.options.length - current.options.length] : [];
          }) : [];
        return { events: [], ...(reduced.length ? {
          reviewEvidence: `The translation ruled out ${reduced.reduce((total, count) => total + count, 0)} models across ${reduced.length} shapes.`,
        } : {}) };
      }
      const { local, scene, strategy } = proposal;
      const current = measureOccludedCatalogue(second) as Scene | null;
      const next = { ...local, tried: [...local.tried, proposal.attempt], evidence: [...local.evidence.slice(-4), after.observation_ref] };
      if (!current || !same(scene.field, current.field)) next.stopped = true;
      else if (strategy === 'seek_distinguishing_view' && viewReturn(first, second, scene) === false) next.stopped = true;
      else if (strategy === 'seek_distinguishing_view' && same(catalogueStructure(scene), catalogueStructure(current))) {
        const exposed = exposedCatalogueValues(first, second, scene);
        if (!same(catalogueFieldPixels(first, scene), catalogueFieldPixels(second, scene))) next.views = [...new Set([...local.views, issued.action_ref])];
        next.backgrounds = [...new Set([...local.backgrounds, ...exposed])];
        if (next.backgrounds.length) next.candidates = { ...next.candidates, [catalogueKey(current)]: fits(second, current, next) };
      } else if (strategy === 'test_unique_catalogue_match') next.submitted = [...local.submitted, scene.palette];
      else if (strategy === 'change_catalogue_subject' && current.palette !== proposal.asked.target) next.stopped = true;
      state = next;
      this.observePublicOutcome?.(before, after, issued, first, second);
      return { events: [] };
    },
    observePublicOutcome(before, after, command, first, second) {
      if (declarative || sourceScope(before) !== sourceScope(after)
        || !before.available_action_refs.includes('ACTION6')) return;
      const completion = after.levels_completed === before.levels_completed + 1;
      if (!completion && (before.level_epoch !== after.level_epoch || before.state !== after.state
        || !/^ACTION[1-4]$/.test(command.action_ref))) return;
      const scene = measureOccludedCatalogue(first) as Scene | null, signature = scene && viewInterface(scene);
      if (!scene || !signature) return;
      const known = learnedViews[signature];
      if (completion) {
        if (known?.scope === sourceScope(before) && known.epoch === before.level_epoch && known.completed === before.levels_completed)
          learnedViews[signature] = { ...known, completed: after.levels_completed,
            evidence: [...new Set([...known.evidence, before.observation_ref, after.observation_ref])] };
        return;
      }
      if (viewReturn(first, second, scene) !== true) return;
      const prior = known?.scope === sourceScope(before) ? known : reusableViews(before, scene);
      learnedViews[signature] = { scope: sourceScope(before), epoch: before.level_epoch, completed: before.levels_completed,
        controls: viewControls(scene)!,
        commands: { ...prior?.commands, [scene.palette]: [...new Set([...(prior?.commands[scene.palette] ?? []), command.action_ref])] },
        evidence: [...new Set([...(prior?.evidence ?? []), before.observation_ref, after.observation_ref])] };
    },
    state: () => ({ state, ...(joint ? { joint } : {}), ...(Object.keys(learnedViews).length ? { learnedViews } : {}) }),
    restore(value: NativeRecord) {
      state = structuredClone(value.state as State | null);
      joint = structuredClone((value.joint as JointCatalogue | undefined) ?? null);
      learnedViews = structuredClone((value.learnedViews as Record<string, LearnedViews> | undefined) ?? {});
    },
  };
}
