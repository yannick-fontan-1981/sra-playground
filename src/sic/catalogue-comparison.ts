import { catalogueFieldPixels, catalogueStructure, exposedCatalogueValues, fitOccludedCatalogue,
  measureOccludedCatalogue } from '../logos-engine/v6-occluded-catalogue-observation.ts';
import { ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeCommand, NativeFamily, NativePoint, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { sicNeedId } from './need-identity.ts';
import { compileStrategyGraph, resolveStrategyGraph } from './strategy-agenda.ts';

export const catalogueComparisonId = 'sic_catalogue_comparison';
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
type Proposal = NativeProposal & { local: State; scene: Scene; asked: Choice; attempt: string; strategy: keyof typeof catalogueComparisonStrategies; needId: string };
const key = (value: unknown) => JSON.stringify(value);
const same = (a: unknown, b: unknown) => key(a) === key(b);
const directions = ['ACTION3', 'ACTION4', 'ACTION1', 'ACTION2'];
const point = ([x, y]: NativePoint): NativeCommand => ({ action_ref: 'ACTION6', data: { x, y } });
const catalogueKey = (scene: Scene) => key([scene.geometry_ref, scene.cards.map(card => card.mask), scene.palette]);

function fits(rows: NativeRows, scene: Scene, state: State) {
  const prior = state.candidates[catalogueKey(scene)];
  return [...new Set<number>(fitOccludedCatalogue(rows, scene, state.backgrounds).map(fit => fit.candidate))]
    .filter(id => !prior || prior.includes(id));
}

export function createSicCatalogueComparison(): NativeFamily<Proposal> {
  let state: State | null = null;
  return {
    id: catalogueComparisonId,
    async propose(observation, rows, _inputs, remaining, execution) {
      if (remaining < 1 || !observation.available_action_refs.includes('ACTION6') || execution?.signal?.aborted) return null;
      const scene = measureOccludedCatalogue(rows) as Scene | null;
      if (!scene || scene.cards.length > 8) return null;
      const prior = state?.epoch === observation.level_epoch && same(state.field, scene.field) ? state : null;
      const local: State = prior ?? { epoch: observation.level_epoch, field: scene.field, backgrounds: [], submitted: [],
        candidates: {}, views: [], tried: [], stopped: false, evidence: [] };
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
      const { selected, entries } = resolveStrategyGraph({ graph, mode: 'active', facts: {
        views: { value: !!view, evidence }, unique: { value: !!answerChoice, evidence }, next: { value: !!select, evidence },
      }, planners: { seek_distinguishing_view: () => view, test_unique_catalogue_match: () => answerChoice, change_catalogue_subject: () => select } });
      if (!selected) return null;
      const strategy = selected.id, asked = selected.plan, label = catalogueComparisonStrategies[strategy], parent = 'G_official_completion';
      const objective = { kind: 'identify_visible_shape_from_catalogue', scope: ref.split(':revision:', 1)[0]!,
        subjects: ['partial_field', 'catalogue_shapes'], parentObjective: parent, satisfactionContract: 'official_progress_after_submitting_compatible_shapes' };
      const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence }, id = `catalogue-comparison:${need.id}`;
      const actions = [asked.action];
      const binding = asked.target !== null && await ObservedInputDomain.makeLocusWitness(observation, rows,
        [asked.action.data.x!, asked.action.data.y!], { reason: label, evidence });
      return { status: 'proposed', kind: catalogueComparisonId, actions, local, scene, asked, attempt: context(asked.action), strategy, needId: need.id,
        steps: [{ action: asked.action, expected_after: null, ...(binding ? { point_binding: binding } : {}) }],
        binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        sicSituationCard: { strategy, need: 'Identify the shape that is partly hidden', mode: answer ? 'solving' : 'exploration',
          situation: local.submitted.includes(scene.palette) ? label : `${ids.length} visible cards still fit the measured evidence. ${label}.`,
          agenda: entries, evidence, field: scene.field, choice: asked.sprite, cards: ids.map(index => scene.cards[index]!.bbox).slice(0, 4) },
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
    after(proposal, _index, before, after) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true, reason: 'official_boundary',
        sic_need: { id: proposal.needId, status: 'satisfied' } };
      return { matched: null, seal_prefix: true, reason: 'compare_partial_view_and_catalogue' };
    },
    record(before, after, issued, first, second, proposal) {
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const { local, scene, strategy } = proposal;
      const current = measureOccludedCatalogue(second) as Scene | null;
      const next = { ...local, tried: [...local.tried, proposal.attempt], evidence: [...local.evidence.slice(-4), after.observation_ref] };
      if (!current || !same(scene.field, current.field)) next.stopped = true;
      else if (strategy === 'seek_distinguishing_view' && same(catalogueStructure(scene), catalogueStructure(current))) {
        const exposed = exposedCatalogueValues(first, second, scene);
        if (!same(catalogueFieldPixels(first, scene), catalogueFieldPixels(second, scene))) next.views = [...new Set([...local.views, issued.action_ref])];
        next.backgrounds = [...new Set([...local.backgrounds, ...exposed])];
        if (next.backgrounds.length) next.candidates = { ...next.candidates, [catalogueKey(current)]: fits(second, current, next) };
      } else if (strategy === 'test_unique_catalogue_match') next.submitted = [...local.submitted, scene.palette];
      else if (strategy === 'change_catalogue_subject' && current.palette !== proposal.asked.target) next.stopped = true;
      state = next;
      return { events: [] };
    },
    state: () => ({ state }),
    restore(value: NativeRecord) { state = structuredClone(value.state as State | null); },
  };
}
