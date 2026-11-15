import { ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeEntity, NativeFamily, NativeObservation, NativePoint, NativeProgramHandle, NativeProposal,
  NativeRecord } from '../logos-engine/v6-native-types.ts';
import { chooseLanding, landingModule } from './highlighted-route-card.ts';
import { navigationPrimitives } from './navigation-primitives.ts';
import { sicNeedId } from './need-identity.ts';

export const mergeForDemandId = 'sic_merge_to_meet_visible_demand';

type Piece = { readonly color: number; readonly side: number; readonly box: NativeBox; readonly point: NativePoint };
type Scene = { readonly samples: readonly Piece[]; readonly demand: Piece; readonly receptor: NativeBox;
  readonly field: readonly [number, number]; readonly probeRange: number };
type Recipe = { readonly input: number; readonly inputSide: number; readonly output: number; readonly outputSide: number;
  readonly evidence: string };
type Motion = { readonly color: number; readonly side: number; readonly range: number; readonly evidence: string };
type Memory = { readonly epoch: number; readonly scene: Scene; readonly recipes: readonly Recipe[];
  readonly motion: readonly Motion[]; readonly tried: readonly string[]; readonly count: number };
type Choice = { readonly intent: 'merge' | 'approach' | 'deliver'; readonly member: Piece; readonly partner: Piece | null;
  readonly point: NativePoint; readonly expected: Recipe | null };
type Proposal = NativeProposal & { readonly memory: Memory; readonly stock: readonly Piece[]; readonly choice: Choice;
  readonly attempt: string; readonly needId: string };

const width = ([l, , r]: NativeBox) => r - l + 1;
const height = ([, t, , b]: NativeBox) => b - t + 1;
const center = ([l, t, r, b]: NativeBox): NativePoint => [(l + r) / 2, (t + b) / 2];
const distance = ([x, y]: NativePoint, [a, b]: NativePoint) => Math.hypot(x - a, y - b);
const same = (a: NativePoint, b: NativePoint) => a[0] === b[0] && a[1] === b[1];
const enclosed = (outer: NativeBox, inner: NativeBox) => outer[0] <= inner[0] && outer[1] <= inner[1] &&
  inner[2] <= outer[2] && inner[3] <= outer[3];
const solidSquare = (part: NativeEntity) => part.rectangular && width(part.bbox) === height(part.bbox);
const piece = (part: NativeEntity): Piece => ({ color: part.palette_value, side: width(part.bbox), box: part.bbox, point: center(part.bbox) });
const matches = (a: Pick<Piece, 'color' | 'side'>, b: Pick<Piece, 'color' | 'side'>) => a.color === b.color && a.side === b.side;
const samePiece = (a: Piece, b: Piece) => matches(a, b) && same(a.point, b.point);
const paletteRank = (scene: Scene, color: number) => scene.samples.findIndex(sample => sample.color === color);

function readStock(observation: NativeObservation, scene: Scene): Piece[] {
  const [top, bottom] = scene.field;
  return observation.entities.filter(part => part.bbox[1] >= top && part.bbox[3] <= bottom && solidSquare(part) &&
    paletteRank(scene, part.palette_value) >= 0 && width(part.bbox) <= scene.demand.side).map(piece);
}

function identify(observation: NativeObservation, screenWidth: number, screenHeight: number): Scene | null {
  const { entities } = observation;
  const reserve = entities.filter(part => width(part.bbox) === screenWidth && height(part.bbox) === 1 &&
    part.bbox[1] >= screenHeight * 0.85 && part.area === screenWidth);
  if (reserve.length !== 1) return null;
  const bottom = reserve[0]!.bbox[1] - 1;
  const scenes: Scene[] = [];
  for (const frame of entities) {
    const [left, top, right, stripBottom] = frame.bbox;
    if (top > screenHeight / 6 || width(frame.bbox) < 3 * height(frame.bbox) || height(frame.bbox) > screenHeight / 6) continue;
    const samples = entities.filter(part => solidSquare(part) && width(part.bbox) >= 2 &&
      part.bbox[0] > left && part.bbox[1] > top && part.bbox[2] < right && part.bbox[3] < stripBottom).map(piece);
    samples.sort((a, b) => a.point[0] - b.point[0]);
    if (samples.length < 3 || samples.length > 5 || new Set(samples.map(item => item.color)).size !== samples.length ||
      samples.some(item => item.side !== samples[0]!.side || item.point[1] !== samples[0]!.point[1])) continue;
    const demand = entities.filter(part => solidSquare(part) && !enclosed(frame.bbox, part.bbox) && width(part.bbox) > samples[0]!.side &&
      part.bbox[1] <= screenHeight / 6 && samples.some(item => item.color === part.palette_value));
    if (demand.length !== 1) continue;
    const wanted = piece(demand[0]!), fieldTop = Math.max(stripBottom, wanted.box[3]) + 1;
    const receptacles = entities.filter(part => part.bbox[1] >= fieldTop && part.bbox[3] <= bottom &&
      !part.rectangular && width(part.bbox) === height(part.bbox) && width(part.bbox) > 2 * wanted.side &&
      part.area > width(part.bbox) ** 2 / 2 && samples.every(item => item.color !== part.palette_value));
    if (receptacles.length !== 1) continue;
    const receptor = receptacles[0]!.bbox;
    const scene: Scene = { samples, demand: wanted, receptor, field: [fieldTop, bottom], probeRange: Math.floor(width(receptor) * 0.8) };
    const stock = readStock(observation, scene);
    if (stock.length < 2 || stock.length > 24 || !stock.some((a, i) => stock.slice(i + 1).some(b => matches(a, b)))) continue;
    scenes.push(scene);
  }
  return scenes.length === 1 ? scenes[0]! : null;
}

function attemptKey(stock: readonly Piece[], point: NativePoint) {
  return stock.map(p => [p.color, p.side, p.point.join(',')].join(':')).sort().join('|') + '>' + point.join(',');
}

function nextChoice(stock: readonly Piece[], memory: Memory): Choice | null {
  const { scene } = memory;
  const demandRank = paletteRank(scene, scene.demand.color);
  const tried = new Set(memory.tried);
  const limitFor = (member: Piece) => {
    const motion = memory.motion.find(item => matches(item, member));
    return motion ? Math.min(scene.probeRange, Math.max(1, Math.round(motion.range))) : scene.probeRange;
  };
  const available = (at: NativePoint) => at[1] >= scene.field[0] && at[1] <= scene.field[1] && !tried.has(attemptKey(stock, at));
  const approach = (member: Piece, goal: NativePoint) => {
    const [x, y] = member.point, [a, b] = goal;
    const span = distance(member.point, goal);
    if (!span) return null;
    for (let step = Math.min(limitFor(member), span); step >= 1; step--) {
      const point: NativePoint = [Math.round(x + step * (a - x) / span), Math.round(y + step * (b - y) / span)];
      if (!same(point, member.point) && available(point)) return point;
    }
    return null;
  };
  const product = stock.find(item => matches(item, scene.demand));
  if (product) {
    const point = approach(product, center(scene.receptor));
    return point ? { intent: 'deliver', member: product, partner: null, point, expected: null } : null;
  }
  for (let rank = demandRank - 1; rank >= 0; rank--) {
    const color = scene.samples[rank]!.color;
    const group = stock.filter(item => item.color === color);
    const pairs = group.flatMap((a, i) => group.slice(i + 1).filter(b => matches(a, b)).map(b => ({ a, b, separation: distance(a.point, b.point) })));
    pairs.sort((a, b) => a.separation - b.separation);
    for (const { a, b, separation } of pairs) {
      const expected = memory.recipes.find(recipe => recipe.input === color && recipe.inputSide === a.side) ?? null;
      const mean: NativePoint = [Math.round((a.point[0] + b.point[0]) / 2), Math.round((a.point[1] + b.point[1]) / 2)];
      if (separation <= Math.round(1.5 * limitFor(a)) && available(mean)) return { intent: 'merge', member: a, partner: b, point: mean, expected };
      const first = approach(a, b.point);
      if (first) return { intent: 'approach', member: a, partner: b, point: first, expected };
      const reverse = approach(b, a.point);
      if (reverse) return { intent: 'approach', member: b, partner: a, point: reverse, expected };
    }
  }
  return null;
}

function measureReturn(proposal: Proposal, after: NativeObservation) {
  const { choice, stock, memory } = proposal, { member, partner, expected } = choice;
  const actual = readStock(after, memory.scene);
  const gone = stock.filter(old => !actual.some(now => samePiece(old, now)));
  const added = actual.filter(now => !stock.some(old => samePiece(old, now)));
  if (partner && gone.length === 2 && added.length === 1 && gone.some(item => samePiece(item, member)) &&
    gone.some(item => samePiece(item, partner))) {
    const output = added[0]!;
    const supported = expected ? expected.output === output.color && expected.outputSide === output.side
      : paletteRank(memory.scene, output.color) > paletteRank(memory.scene, member.color) && output.side > member.side;
    if (supported) {
      const recipe: Recipe = { input: member.color, inputSide: member.side, output: output.color, outputSide: output.side,
        evidence: after.observation_ref };
      return { recipe, range: null };
    }
  }
  if (!gone.some(item => samePiece(item, member)) || gone.length !== added.length) return null;
  if (gone.some(item => !matches(item, member)) || added.some(item => !matches(item, member))) return null;
  const target = partner?.point ?? center(memory.scene.receptor);
  const shifted = added.filter(item => distance(item.point, choice.point) < distance(member.point, choice.point))
    .sort((a, b) => distance(a.point, choice.point) - distance(b.point, choice.point))[0];
  if (!shifted) return null;
  const oldGap = distance(member.point, target);
  const newGap = partner && gone.some(item => samePiece(item, partner)) && added.length === 2
    ? distance(added[0]!.point, added[1]!.point) : distance(shifted.point, target);
  if (newGap >= oldGap) return null;
  return { recipe: null, range: distance(member.point, choice.point) };
}

export function createSicMergeForDemand(): NativeFamily<Proposal> {
  let state: Memory | null = null;
  let choose: NativeProgramHandle | undefined;
  return {
    id: mergeForDemandId,
    async attachPrograms(registry) {
      choose = await registry.registerProgram(chooseLanding, {}, await landingModule());
    },
    async propose(observation, rows, _inputs, remaining, execution) {
      if (!choose || remaining < 1 || !observation.available_action_refs.includes('ACTION6') ||
        observation.available_action_refs.some(ref => /^ACTION[1-5]$/.test(ref))) return null;
      const prior = state?.epoch === observation.level_epoch ? state : null;
      const scene = prior?.scene ?? identify(observation, rows[0]!.length, rows.length);
      if (!scene || (prior?.count ?? 0) >= 40) return null;
      const memory = prior ?? { scene, epoch: observation.level_epoch, recipes: [], motion: [], tried: [], count: 0 };
      const stock = readStock(observation, scene);
      const choice = nextChoice(stock, memory);
      if (!choice) return null;
      const mode = execution?.reasoningMode ?? 'exploration';
      const measured = memory.motion.find(item => matches(item, choice.member));
      const knownInteraction = choice.intent === 'merge' && !!choice.expected;
      const routeSupported = choice.intent !== 'merge' && !!measured;
      const facts = { knownInteraction, routeSupported, eligibleProbe: !knownInteraction && !routeSupported, mode };
      const decision = await choose.run({ situation: facts }, { signal: execution?.signal });
      const strategy = knownInteraction ? 'P02' : routeSupported ? 'P07' : 'P05';
      if (decision.result !== strategy) return null;
      const ref = observation.observation_ref;
      const evidence: [string, ...string[]] = [ref, ...new Set([measured?.evidence, ...memory.recipes.map(recipe => recipe.evidence)]
        .filter((item): item is string => !!item && item !== ref))];
      const situation = choice.intent === 'merge'
        ? knownInteraction ? 'Repeat the observed merge on two compatible pieces' : 'Test whether two nearby pieces merge into a new type'
        : choice.intent === 'deliver' ? 'Bring the requested product to its receiver' : 'Bring two compatible pieces within range of the same click';
      const witness = await ObservedInputDomain.makeLocusWitness(observation, rows, choice.point, { reason: situation, evidence });
      if (!witness) return null;
      const [x, y] = choice.point, parent = 'G_official_completion';
      const objective = { kind: 'produce_and_deliver_requested_visible_type', scope: ref.split(':revision:', 1)[0]!,
        subjects: [`${scene.demand.color}:${scene.demand.side}`], parentObjective: parent,
        satisfactionContract: 'official_progress_after_delivery_of_requested_type' };
      const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence };
      const id = mergeForDemandId + ':' + need.id, action = { action_ref: 'ACTION6', data: { x, y } };
      const prediction = knownInteraction ? { color: choice.expected!.output, side: choice.expected!.outputSide } : null;
      return {
        status: 'proposed', kind: mergeForDemandId, memory, stock, choice, needId: need.id, attempt: attemptKey(stock, choice.point),
        binding: { observation_ref: ref, level_epoch: observation.level_epoch }, actions: [action],
        steps: [{ action, point_binding: witness, expected_after: prediction }],
        sicSrcDecision: { workflow: decision.receipt.workflow, hash: decision.receipt.src_hash, instructions: decision.receipt.instructions,
          edited: 'edited' in decision.receipt && decision.receipt.edited === true, situation: facts },
        sicSituationCard: { strategy, need: 'Make the displayed product and bring it to the receiver', situation, evidence, agenda: [],
          mode, triggerCard: decision.receipt.workflow, actor: choice.member.box, partner: choice.partner?.box ?? null,
          demand: scene.demand.box, receptor: scene.receptor, focus: [x, y, x, y] },
        question: { reason: situation, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: situation, relations: ['contributes_to:' + parent] }],
        sicLocalDecision: { strategy, objective: { id, label: navigationPrimitives[strategy], parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: situation,
          preconditions: {}, preserve_refs: [], evidence, actions: [action], outcome_guard: { path: ['value'], contains: id } },
      };
    },
    before(proposal, index, _packet, observation) {
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref;
      return { admitted, reason: admitted ? 'production_click_bound' : 'production_scene_changed' };
    },
    after(proposal, _index, before, after) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true, reason: 'official_boundary',
        sic_need: { id: proposal.needId, status: 'satisfied' } };
      const effect = measureReturn(proposal, after);
      if (proposal.choice.intent === 'merge' && proposal.choice.expected && !effect?.recipe) {
        return { matched: false, seal_prefix: true, reason: 'expected_merge_not_observed' };
      }
      const reason = effect?.recipe ? 'two_inputs_consumed_and_output_observed'
        : effect ? 'material_approached_destination' : 'expected_material_effect_not_observed';
      return { matched: !!effect, seal_prefix: true, reason };
    },
    record(before, after, _command, _first, _second, proposal) {
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const { memory, choice: { member } } = proposal, effect = measureReturn(proposal, after), recipe = effect?.recipe;
      const previous = memory.motion.find(item => matches(item, member));
      const motion = effect?.range && effect.range > (previous?.range ?? 0) ? [...memory.motion.filter(item => item !== previous),
        { color: member.color, side: member.side, range: effect.range, evidence: after.observation_ref }] : memory.motion;
      const recipes = recipe && !memory.recipes.some(known => known.input === recipe.input && known.inputSide === recipe.inputSide)
        ? [...memory.recipes, recipe] : memory.recipes;
      state = { ...memory, motion, recipes, count: memory.count + 1, tried: [...memory.tried, proposal.attempt] };
      return { events: [] };
    },
    state: () => ({ state }),
    restore(value: NativeRecord) { state = structuredClone(value.state as Memory | null); },
  };
}
