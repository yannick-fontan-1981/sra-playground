import { measureOccurrenceScene } from '../logos-engine/v6-occurrence-scene.ts';
import { normalizeCodeMask } from '../logos-engine/v6-code-program.ts';
import { ObservedInputDomain, rotateMask } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeFamily, NativeObservation, NativePoint, NativeProgramHandle, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { chooseFromFeedback, feedbackChoiceFacts, feedbackChoiceModule } from './feedback-choice-card.ts';
import { sicNeedId } from './need-identity.ts';

export const occurrenceRecallId = 'sic_occurrence_recall';
export const verifyOccurrenceChoiceId = 'sic_verify_occurrence_from_feedback';
export const occurrenceRecallStrategies = {
  test_emphasized_occurrence: 'Test the uniquely framed occurrence',
  reuse_observed_occurrence_rule: 'Use the learned correspondence to select an occurrence',
} as const;

type Appearance = { shape: string; color: number; rotationClass?: string; scale?: number;
  scaledShape?: string; scaledRotationClass?: string };
type Occurrence = Appearance & { id: string; marked: boolean; bbox: NativeBox; point: NativePoint; mask: NativePoint[] };
type Indicator = { bbox: NativeBox; value: number };
type Calibration = NativeRecord & { foreground_scale?: number };
type Scene = { occurrences: Occurrence[]; indicators: Indicator[]; calibration: Calibration; key: string };
type Rule = { supports: string[]; contradicted: boolean; changedOrientation?: string; changedScale?: string };
type Context = { chosen: Occurrence; peers: Occurrence[] };
type State = { epoch: number; context: Context | null; seen: Appearance[]; rules: Record<string, Rule>;
  calibration: NativeRecord | null; visited: string[]; stopped: boolean; singletonStart?: string };
export type OccurrenceTransfer = { epoch: number; calibration: NativeRecord; rules: Record<string, Rule>; start: string; victory: string };
type Prediction = { key: string; candidates: string[]; minimum: number; orientedKey?: string; turned?: string[];
  scaledFrom?: string; resized?: string[] };
type Proposal = NativeProposal & { local: State; scene: Scene; chosen: Occurrence; predictions: Prediction[]; needId: string;
  rotationTest?: true; scaleTest?: true };
const empty = (epoch = 0): State => ({ epoch, context: null, seen: [], rules: {}, calibration: null, visited: [], stopped: false });
const occurrenceMeasurement = { allowNarrowerForeground: true, readOccludedIndicators: true };

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
  return Object.entries(references).flatMap(([relation, inputs]) => [false, true].flatMap(withColor => {
    const key = `${minimum}:${relation}:${withColor}`;
    const matches = (compare: (first: Appearance, second: Appearance) => boolean) =>
      scene.occurrences.filter(part => inputs.some(peer => compare(part, peer)
        && (!withColor || part.color === peer.color))).map(part => part.id);
    const candidates = matches((part, peer) => part.shape === peer.shape);
    const rotated = matches((part, peer) => !!part.rotationClass && part.rotationClass === peer.rotationClass);
    const predictions: Prediction[] = [{ key, minimum, candidates }, { key: key + ':rotation', minimum, candidates: rotated,
      orientedKey: key, turned: rotated.filter(id => !candidates.includes(id)) }];
    if ((scene.calibration.foreground_scale ?? 1) > 1) for (const [feature, plain] of [
      ['scaledShape', predictions[0]!], ['scaledRotationClass', predictions[1]!],
    ] as const) {
      const agrees = (part: Appearance, peer: Appearance) => !!part[feature] && part[feature] === peer[feature];
      const scaled = matches(agrees);
      const resized = matches((part, peer) => part.scale !== peer.scale && agrees(part, peer));
      predictions.push({ key: plain.key + ':scale', scaledFrom: plain.key, minimum, candidates: scaled,
        resized: resized.filter(id => !plain.candidates.includes(id)) });
    }
    return predictions;
  }));
}

const rotationClass = (mask: NativePoint[]) => [0, 1, 2, 3].map(turn => JSON.stringify(rotateMask(mask, turn))).sort()[0]!;

function identifyShapes(scene: Scene): Scene {
  return { ...scene, occurrences: scene.occurrences.map(part => {
    const scale = part.scale ?? 1;
    const scaled = (scene.calibration.foreground_scale ?? 1) > 1 ? normalizeCodeMask(part.mask, scale) : null;
    return { ...part, rotationClass: rotationClass(part.mask),
      ...(scaled ? { scale, scaledShape: JSON.stringify(scaled), scaledRotationClass: rotationClass(scaled) } : {}) };
  }) };
}

function singleChoice(scene: Scene, predictions: readonly Prediction[]) {
  const votes = new Set(predictions.map(prediction => prediction.candidates[0]));
  return votes.size === 1 ? scene.occurrences.find(part => votes.has(part.id)) ?? null : null;
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

function occurrenceEvidence(local: State) {
  const established = (key: string, minimum: number) => !local.rules[key]?.contradicted
    && (local.rules[key]?.supports.length ?? 0) >= minimum;
  const acceptsScale = (key: string) => !local.rules[key]?.contradicted && !!local.rules[key]?.changedScale;
  return { established, acceptsScale };
}

function supportedOccurrenceChoices(local: State, predictions: Prediction[]) {
  const { established, acceptsScale } = occurrenceEvidence(local);
  const supported = predictions.filter(({ key, minimum, candidates, orientedKey, scaledFrom }) => candidates.length === 1
    && (scaledFrom ? acceptsScale(key)
      && (established(key, minimum) || established(scaledFrom, minimum))
      : !acceptsScale(key + ':scale') && established(key, minimum) && (!orientedKey || local.rules[key]?.changedOrientation)));
  return supported;
}

function learnOccurrenceChoice(local: State, scene: Scene, chosen: Occurrence, predictions: Prediction[], after: NativeObservation): State {
  const rules = { ...local.rules };
  for (const { key, candidates, turned, resized } of predictions) {
    const previous = rules[key] ?? { supports: [], contradicted: false };
    const included = candidates.includes(chosen.id);
    const unique = included && candidates.length === 1;
    const changedOrientation = unique && turned?.includes(chosen.id) ? after.observation_ref : previous.changedOrientation;
    const changedScale = unique && resized?.includes(chosen.id) ? after.observation_ref : previous.changedScale;
    const confirmedWithScale = predictions.some(candidate => candidate.scaledFrom === key && candidate.resized?.includes(chosen.id));
    rules[key] = { supports: unique ? [...previous.supports.slice(-2), after.observation_ref] : previous.supports,
      ...(changedOrientation ? { changedOrientation } : {}),
      ...(changedScale ? { changedScale } : {}), contradicted: previous.contradicted || (!included && !confirmedWithScale) };
  }
  const seen = new Map([...local.seen, ...scene.occurrences].map(({ shape, color, rotationClass, scale, scaledShape, scaledRotationClass }) =>
    [`${shape}:${color}`, { shape, color, ...(rotationClass ? { rotationClass } : {}),
      ...(scale && scaledShape && scaledRotationClass ? { scale, scaledShape, scaledRotationClass } : {}) }]));
  const singletonStart = local.singletonStart ?? (!local.context && scene.occurrences.length === 1 ? after.observation_ref : undefined);
  return { ...local, rules, context: { chosen, peers: scene.occurrences }, seen: [...seen.values()],
    calibration: scene.calibration, visited: [...local.visited, scene.key], ...(singletonStart ? { singletonStart } : {}) };
}

export function retainOccurrenceChoice(local: State, scene: Scene, victory: NativeObservation): OccurrenceTransfer | null {
  if (!local.singletonStart) return null;
  const { indicator_boxes: _previousPositions, ...calibration } = scene.calibration;
  return { epoch: local.epoch, calibration, rules: local.rules, start: local.singletonStart, victory: victory.observation_ref };
}

export function chooseVisibleOccurrence(previous: State | undefined, observation: NativeObservation, rows: NativeRows,
  transfer?: OccurrenceTransfer) {
  const local = previous ?? { ...empty(observation.level_epoch), calibration: transfer?.calibration ?? null, rules: transfer?.rules ?? {} };
  let measured = measureOccurrenceScene(rows, observation, local.calibration, occurrenceMeasurement) as Scene | null;
  if (transfer && !previous && !measured?.occurrences.length) {
    const scaled = measureOccurrenceScene(rows, observation, local.calibration,
      { ...occurrenceMeasurement, inferIntegerScale: true }) as Scene | null;
    if (scaled?.occurrences.length === 1 && (scaled.calibration.foreground_scale ?? 1) > 1) measured = scaled;
  }
  if (!measured || !hasMeter(measured) || measured.occurrences.length > 16 || local.visited.includes(measured.key)
    || local.visited.length >= 48) return null;
  const scene = identifyShapes(measured), predictions = predict(scene, local);
  const marked = scene.occurrences.filter(part => part.marked);
  const supported = marked.length === 0 ? supportedOccurrenceChoices(local, predictions) : [];
  const inferred = singleChoice(scene, supported);
  const start = transfer && !local.context && !marked.length && scene.occurrences.length === 1 ? scene.occurrences[0]! : null;
  const chosen = marked.length === 1 ? marked[0] : inferred ?? start;
  const evidence = start ? [transfer!.start, transfer!.victory] : inferred
    ? [...new Set(supported.flatMap(({ key, scaledFrom }) => [...local.rules[key]!.supports, ...(scaledFrom ? local.rules[scaledFrom]?.supports ?? [] : [])]))] : [];
  return chosen ? { local, scene, chosen, predictions, inferred: !!inferred, evidence, transferredStart: !!start } : null;
}

export function observeVisibleOccurrence({ local, scene, chosen, predictions }: NonNullable<ReturnType<typeof chooseVisibleOccurrence>>,
  after: NativeObservation, rows: NativeRows) {
  const next = measureOccurrenceScene(rows, after, scene.calibration, occurrenceMeasurement) as Scene | null;
  return next && progress(scene, next) && !local.visited.includes(next.key)
    ? learnOccurrenceChoice(local, scene, chosen, predictions, after) : null;
}

export function createSicVerifyOccurrenceChoice(): NativeFamily<Proposal> {
  let state = empty();
  let transfer: OccurrenceTransfer | null = null;
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
      let measured = measureOccurrenceScene(rows, observation, local.calibration, occurrenceMeasurement) as Scene | null;
      if (recalled && !prior && !measured?.occurrences.length) {
        const scaled = measureOccurrenceScene(rows, observation, local.calibration, { ...occurrenceMeasurement, inferIntegerScale: true }) as Scene | null;
        if (scaled?.occurrences.length === 1 && (scaled.calibration.foreground_scale ?? 1) > 1) measured = scaled;
      }
      if (!measured || !hasMeter(measured) || measured.occurrences.length > 16 || local.visited.includes(measured.key)) return null;
      const scene = identifyShapes(measured);
      const marked = scene.occurrences.filter(part => part.marked);
      const predictions = predict(scene, local);
      const { established } = occurrenceEvidence(local);
      const supported = supportedOccurrenceChoices(local, predictions);
      const inferred = !marked.length ? singleChoice(scene, supported) : null;
      const turns = !marked.length && !supported.length ? predictions.filter(({ orientedKey, candidates, turned, minimum, key }) =>
        orientedKey && candidates.length === 1 && turned?.length === 1 && !local.rules[key]?.contradicted
        && !local.rules[orientedKey]?.contradicted && (local.rules[orientedKey]?.supports.length ?? 0) >= minimum) : [];
      const rotationTest = singleChoice(scene, turns);
      const scales = !marked.length && !supported.length && !rotationTest ? predictions.filter(({ key, scaledFrom, minimum, candidates, resized }) =>
        scaledFrom && !local.rules[key]?.contradicted && established(scaledFrom, minimum) && candidates.length === 1 && resized?.length === 1) : [];
      const scaleTest = singleChoice(scene, scales);
      const visible = marked.length === 1 ? marked[0]! : null;
      const start = recalled && !local.context && !marked.length && scene.occurrences.length === 1 ? scene.occurrences[0]! : null;
      const ref = observation.observation_ref;
      const proof = supported.flatMap(({ key, scaledFrom }) => [...local.rules[key]!.supports,
        ...(scaledFrom ? local.rules[scaledFrom]?.supports ?? [] : [])]);
      if (rotationTest) proof.push(...turns.flatMap(({ orientedKey }) => local.rules[orientedKey!]!.supports));
      if (scaleTest) proof.push(...scales.flatMap(({ scaledFrom }) => local.rules[scaledFrom!]!.supports));
      if (start && recalled) proof.push(recalled.start, recalled.victory);
      const evidence: [string, ...string[]] = [ref, ...new Set(proof.filter(value => value !== ref))];
      if (!visible && !inferred && !start && !rotationTest && !scaleTest) return null;
      const mode = execution?.reasoningMode ?? (inferred ? 'assimilation' : 'exploration');
      const facts = feedbackChoiceFacts(mode, { pointedCueNeedsTest: !!visible,
        modelMatchNeedsTest: !!start, trialCanClarifyAlternatives: !!rotationTest || !!scaleTest, feedbackSupportsOneChoice: !!inferred });
      const decision = await decide?.run({ situation: facts }, { signal: execution?.signal });
      const strategy = decision?.result;
      if (!decision || (strategy !== 'P02' && strategy !== 'P05')) return null;
      const chosen = strategy === 'P02' ? inferred : visible ?? start ?? rotationTest ?? scaleTest;
      if (!chosen) return null;
      const rotationVerified = supported.some(({ turned }) => turned?.includes(chosen.id));
      const scaleVerified = supported.some(({ resized }) => resized?.includes(chosen.id));
      const label = scaleTest ? 'Test whether the sequence accepts the same pattern at a different size'
        : scaleVerified ? 'Reuse the confirmed correspondence across sizes'
        : rotationTest ? 'Test whether the sequence accepts the same shape in a different orientation'
        : rotationVerified ? 'Reuse the confirmed correspondence under rotation'
        : strategy === 'P02' ? occurrenceRecallStrategies.reuse_observed_occurrence_rule
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
        ...(rotationTest ? { rotationTest: true } : {}), ...(scaleTest ? { scaleTest: true } : {}),
        steps: [{ action: command, expected_after: null, point_binding: binding }],
        binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        sicSrcDecision: { workflow: decision.receipt.workflow, hash: decision.receipt.src_hash,
          instructions: decision.receipt.instructions, edited: 'edited' in decision.receipt && decision.receipt.edited === true,
          situation: facts },
        sicSituationCard: { strategy, need: 'Find which occurrence advances the visible sequence', mode,
          situation: strategy === 'P02' && !rotationVerified && !scaleVerified ? `${supported.length} supported correspondence rules select this occurrence.` : label,
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
      const next = measureOccurrenceScene(second, after, proposal.scene.calibration, occurrenceMeasurement) as Scene | null;
      const matched = !!next && progress(proposal.scene, next) && !proposal.local.visited.includes(next.key);
      return { matched, seal_prefix: true, reason: matched ? 'one_visible_indicator_changed' : 'occurrence_progress_not_confirmed' };
    },
    record(before, after, _command, _first, second, proposal) {
      const { local, scene, chosen, predictions } = proposal;
      if (after.levels_completed > before.levels_completed && local.singletonStart) {
        transfer = retainOccurrenceChoice(local, scene, after);
        return { events: [], reviewEvidence: 'The occurrence matches advanced the sequence through the end of the level.' };
      }
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const next = measureOccurrenceScene(second, after, scene.calibration, occurrenceMeasurement) as Scene | null;
      if (!next || !progress(scene, next) || local.visited.includes(next.key)) {
        state = { ...local, stopped: true };
        return { events: [] };
      }
      state = learnOccurrenceChoice(local, scene, chosen, predictions, after);
      return { events: [], ...(proposal.scaleTest ? { reviewEvidence: 'The visible sequence advanced after selecting an occurrence at a different size' }
        : proposal.rotationTest ? { reviewEvidence: 'The visible sequence advanced after selecting the rotated occurrence' } : {}) };
    },
    state: () => ({ ...state, transfer }),
    restore(value: NativeRecord) {
      const { transfer: saved, ...episode } = structuredClone(value);
      state = episode as State;
      transfer = (saved ?? null) as OccurrenceTransfer | null;
    },
  };
}
