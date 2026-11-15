import { measureOccurrenceScene } from '../logos-engine/v6-occurrence-scene.ts';
import { ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeFamily, NativePoint, NativeProgramHandle, NativeProposal, NativeRecord } from '../logos-engine/v6-native-types.ts';
import { chooseFromFeedback, feedbackChoiceFacts, feedbackChoiceModule } from './feedback-choice-card.ts';
import { sicNeedId } from './need-identity.ts';

export const occurrenceRecallId = 'sic_occurrence_recall';
export const verifyOccurrenceChoiceId = 'sic_verify_occurrence_from_feedback';
export const occurrenceRecallStrategies = {
  test_emphasized_occurrence: 'Test the uniquely framed occurrence',
  reuse_observed_occurrence_rule: 'Use the learned correspondence to select an occurrence',
} as const;

type Appearance = { shape: string; color: number };
type Occurrence = Appearance & { id: string; marked: boolean; bbox: NativeBox; point: NativePoint };
type Indicator = { bbox: NativeBox; value: number };
type Scene = { occurrences: Occurrence[]; indicators: Indicator[]; calibration: NativeRecord; key: string };
type Rule = { supports: string[]; contradicted: boolean };
type Context = { chosen: Occurrence; peers: Occurrence[] };
type State = { epoch: number; context: Context | null; seen: Appearance[]; rules: Record<string, Rule>;
  calibration: NativeRecord | null; visited: string[]; stopped: boolean; singletonStart?: string };
type Transfer = { epoch: number; calibration: NativeRecord; rules: Record<string, Rule>; start: string; victory: string };
type Prediction = { key: string; candidates: string[]; minimum: number };
type Proposal = NativeProposal & { local: State; scene: Scene; chosen: Occurrence; predictions: Prediction[]; needId: string };
const empty = (epoch = 0): State => ({ epoch, context: null, seen: [], rules: {}, calibration: null, visited: [], stopped: false });

function hasMeter(scene: Scene) {
  const [first, second] = scene.indicators;
  if (!first || !second || scene.indicators.length < 3) return false;
  const [left, top, right, bottom] = first.bbox;
  const pitch = second.bbox[0] - left, width = right - left + 1, height = bottom - top + 1;
  return height > 1 && width > height && pitch >= width && pitch <= 2 * width
    && scene.indicators.every(({ bbox: [x, y, r, b] }, i) => x === left + i * pitch && r - x + 1 === width
      && y === top && b === bottom);
}

function predict(scene: Scene, state: State): Prediction[] {
  const context = state.context;
  if (!context) return [];
  const references = {
    previous: context.peers,
    chosen: [context.chosen],
    unchosen: context.peers.filter(part => part.id !== context.chosen.id),
    seen: state.seen,
  };
  const minimum = context.peers.length > 1 ? 2 : 1;
  return Object.entries(references).flatMap(([relation, inputs]) => [false, true].map(withColor => ({
    key: `${minimum}:${relation}:${withColor}`, minimum,
    candidates: scene.occurrences.filter(part => inputs.some(peer => part.shape === peer.shape
      && (!withColor || part.color === peer.color))).map(part => part.id),
  })));
}

function progress(before: Scene, after: Scene | null) {
  if (!after || after.key === before.key || after.indicators.length !== before.indicators.length) return false;
  let changed = 0;
  for (const [index, { bbox, value }] of before.indicators.entries()) {
    const next = after.indicators[index]!;
    if (bbox.some((coordinate, i) => coordinate !== next.bbox[i])) return false;
    if (value !== next.value) changed++;
  }
  return changed === 1;
}

export function createSicVerifyOccurrenceChoice(): NativeFamily<Proposal> {
  let state = empty();
  let transfer: Transfer | null = null;
  let decide: NativeProgramHandle | undefined;
  return {
    id: verifyOccurrenceChoiceId,
    async attachPrograms(registry) {
      decide = await registry.registerProgram(chooseFromFeedback, {}, await feedbackChoiceModule());
    },
    async propose(observation, rows, _inputs, remaining, execution) {
      if (remaining < 1 || !observation.available_action_refs.includes('ACTION6')
        || observation.available_action_refs.some(ref => /^ACTION[1-5]$/.test(ref))) return null;
      const prior = state.epoch === observation.level_epoch ? state : null;
      const recalled = transfer?.epoch === observation.level_epoch - 1 ? transfer : null;
      const local = prior ?? { ...empty(observation.level_epoch), calibration: recalled?.calibration ?? null, rules: recalled?.rules ?? {} };
      if (local.stopped || local.visited.length >= 48) return null;
      const scene = measureOccurrenceScene(rows, observation, local.calibration) as Scene | null;
      if (!scene || !hasMeter(scene) || scene.occurrences.length > 16 || local.visited.includes(scene.key)) return null;
      const marked = scene.occurrences.filter(part => part.marked);
      const predictions = predict(scene, local);
      const supported = predictions.filter(({ key, minimum, candidates }) => candidates.length === 1
        && !local.rules[key]?.contradicted && (local.rules[key]?.supports.length ?? 0) >= minimum);
      const votes = new Set(supported.map(prediction => prediction.candidates[0]));
      const inferred = !marked.length && votes.size === 1 ? scene.occurrences.find(part => votes.has(part.id)) : null;
      const visible = marked.length === 1 ? marked[0]! : null;
      const start = recalled && !local.context && !marked.length && scene.occurrences.length === 1 ? scene.occurrences[0]! : null;
      const ref = observation.observation_ref;
      const proof = supported.flatMap(({ key }) => local.rules[key]!.supports);
      if (start && recalled) proof.push(recalled.start, recalled.victory);
      const evidence: [string, ...string[]] = [ref, ...new Set(proof.filter(value => value !== ref))];
      if (!visible && !inferred && !start) return null;
      const mode = execution?.reasoningMode ?? (inferred ? 'assimilation' : 'exploration');
      const facts = feedbackChoiceFacts(mode, { pointedCueNeedsTest: !!visible,
        modelMatchNeedsTest: !!start, feedbackSupportsOneChoice: !!inferred });
      const decision = await decide?.run({ situation: facts }, { signal: execution?.signal });
      const strategy = decision?.result;
      if (!decision || (strategy !== 'P02' && strategy !== 'P05')) return null;
      const chosen = strategy === 'P02' ? inferred : visible ?? start;
      if (!chosen) return null;
      const label = strategy === 'P02' ? occurrenceRecallStrategies.reuse_observed_occurrence_rule
        : start ? 'Test the only visible occurrence using the earlier start as evidence' : occurrenceRecallStrategies.test_emphasized_occurrence;
      const parent = 'G_official_completion';
      const goal = { kind: 'find_repeated_occurrence', scope: ref.split(':revision:', 1)[0]!, subjects: ['visible_occurrences'],
        parentObjective: parent, satisfactionContract: 'observe_official_progress_after_a_confirmed_occurrence' };
      const need = { ...goal, id: sicNeedId(goal), status: 'assigned', evidence };
      const id = `occurrence-recall:${need.id}`;
      const [x, y] = chosen.point;
      const command = { action_ref: 'ACTION6', data: { x, y } }, actions = [command];
      const binding = await ObservedInputDomain.makeLocusWitness(observation, rows, chosen.point, { reason: label, evidence });
      return { status: 'proposed', kind: verifyOccurrenceChoiceId, actions, local, scene, chosen, predictions, needId: need.id,
        steps: [{ action: command, expected_after: null, point_binding: binding }],
        binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        sicSrcDecision: { workflow: decision.receipt.workflow, hash: decision.receipt.src_hash,
          instructions: decision.receipt.instructions, edited: 'edited' in decision.receipt && decision.receipt.edited === true,
          situation: facts },
        sicSituationCard: { strategy, need: 'Find which occurrence advances the visible sequence', mode,
          situation: strategy === 'P02' ? `${supported.length} supported correspondence rules select this occurrence.` : label,
          agenda: [], evidence, triggerCard: decision.receipt.workflow,
          chosen: chosen.bbox, candidates: scene.occurrences.filter(part => part.id !== chosen.id).map(part => part.bbox) },
        question: { reason: label, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: label, relations: [`contributes_to:${parent}`] }],
        sicLocalDecision: { strategy, objective: { id, label, parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: label,
          preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
    },
    before(proposal, index, _packet, observation) {
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref;
      return { admitted, reason: admitted ? 'occurrence_bound' : 'occurrence_changed' };
    },
    after(proposal, _index, before, after, _first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true,
        reason: 'official_boundary', sic_need: { id: proposal.needId, status: 'satisfied' } };
      const next = measureOccurrenceScene(second, after, proposal.scene.calibration) as Scene | null;
      const matched = !!next && progress(proposal.scene, next) && !proposal.local.visited.includes(next.key);
      return { matched, seal_prefix: true, reason: matched ? 'one_visible_indicator_changed' : 'occurrence_progress_not_confirmed' };
    },
    record(before, after, _command, _first, second, proposal) {
      const { local, scene, chosen, predictions } = proposal;
      if (after.levels_completed > before.levels_completed && local.singletonStart) {
        const { indicator_boxes: _previousPositions, ...calibration } = scene.calibration;
        transfer = { epoch: before.level_epoch, calibration, rules: local.rules, start: local.singletonStart, victory: after.observation_ref };
        return { events: [], reviewEvidence: 'The occurrence matches advanced the sequence through the end of the level.' };
      }
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const next = measureOccurrenceScene(second, after, scene.calibration) as Scene | null;
      if (!next || !progress(scene, next) || local.visited.includes(next.key)) {
        state = { ...local, stopped: true };
        return { events: [] };
      }
      const rules = { ...local.rules };
      for (const { key, candidates } of predictions) {
        const previous = rules[key] ?? { supports: [], contradicted: false };
        const included = candidates.includes(chosen.id);
        rules[key] = { supports: included && candidates.length === 1 ? [...previous.supports.slice(-2), after.observation_ref] : previous.supports,
          contradicted: previous.contradicted || !included };
      }
      const seen = new Map([...local.seen, ...scene.occurrences].map(({ shape, color }) => [`${shape}:${color}`, { shape, color }]));
      const singletonStart = local.singletonStart ?? (!local.context && scene.occurrences.length === 1 ? after.observation_ref : undefined);
      state = { ...local, rules, context: { chosen, peers: scene.occurrences }, seen: [...seen.values()],
        calibration: scene.calibration, visited: [...local.visited, scene.key], ...(singletonStart ? { singletonStart } : {}) };
      return { events: [] };
    },
    state: () => ({ ...state, transfer }),
    restore(value: NativeRecord) {
      const { transfer: saved, ...episode } = structuredClone(value);
      state = episode as State;
      transfer = (saved ?? null) as Transfer | null;
    },
  };
}
