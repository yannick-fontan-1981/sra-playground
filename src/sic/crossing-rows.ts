import { crossedPrefixCell, crossedPrefixGeometry, crossedPrefixMeasureControls, crossedPrefixReferencePresent, crossedPrefixSlot,
  type CrossedPrefixController, type CrossedPrefixLayout } from '../logos-engine/v6-crossed-prefix-observation.ts';
import { geometricComponents, ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeCommand, NativeFamily, NativePoint, NativeProgramHandle, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { chooseLanding, landingModule } from './highlighted-route-card.ts';
import { sicNeedId } from './need-identity.ts';
import { maximumCommittedActions } from './plan-step.ts';

export const crossingRowsId = 'sic_crossing_rows';
export const verifyCrossingRowsId = 'sic_verify_crossing_rows';
export const learnCrossingRowsId = 'sic_learn_crossing_rows';
export const crossingRowsStrategies = {
  select_aligned_prefix: 'Select the row or column that can contribute to the pattern',
  test_prefix_advance: 'Test a command for advancing the selected row or column',
  extend_measured_prefix: 'Extend the selected row or column with a measured command',
} as const;
type State = { epoch: number; layout: CrossedPrefixLayout; progress: Record<string, number>; selected: string | null;
  commands: Record<string, string>; axisCommands: [string[], string[]]; crossed: boolean; tried: string[]; stopped: boolean; evidence: string[];
  pairs?: CrossingPair[]; transferred?: boolean; pattern?: SwatchPattern };
type CrossingPair = { commands: [string, string]; owner: 0 | 1; proof: string };
type Acquired = { axes: [string[], string[]]; pairs: CrossingPair[]; layout: CrossedPrefixLayout };
type Swatch = { point: CrossedPrefixController['point']; color: number };
type SwatchPattern = { choices: Record<string, Swatch>; pairs: CrossingPair[][] };
type Choice = { controller: CrossedPrefixController; action: NativeCommand; cell: NativePoint; selecting: boolean; crossing: boolean;
  interaction?: { peer: CrossedPrefixController; input: string; expected: number } };
type Proposal = NativeProposal & { local: State; choice: Choice; needId: string;
  route?: Choice[]; cursor?: number };
const key = (value: unknown) => JSON.stringify(value);
const equal = (a: unknown, b: unknown) => key(a) === key(b);
const painted = (rows: NativeRows, layout: CrossedPrefixLayout, cell: NativePoint) => {
  const pixels = crossedPrefixSlot(rows, layout, cell);
  return pixels[Math.floor(pixels.length / 2)]?.[Math.floor((pixels[0]?.length ?? 0) / 2)];
};

function solveSwatches(layout: CrossedPrefixLayout, known: readonly CrossingPair[]): SwatchPattern | undefined {
  const { controllers, reference } = layout;
  const rows = controllers.filter(control => control.axis === 0), cols = controllers.filter(control => control.axis === 1);
  const cells = reference.values.flatMap((row, y) => row.map((target, x) => ({ target, keys: [rows[y]!.key, cols[x]!.key] })));
  if (cells.every(({ target, keys }) => controllers.some(control => keys.includes(control.key) && control.color === target))) return;
  const choices: Record<string, Swatch> = {};
  const pairFor = ({ target, keys }: typeof cells[number]) => known.find(pair => choices[keys[pair.owner]!]!.color === target);
  let best: SwatchPattern | undefined, lowestCost = Infinity, visits = 0;
  function visit(index: number, cost: number) {
    if (cost >= lowestCost || ++visits > 5000) return;
    if (index === controllers.length) {
      const pairs = reference.values.map((row, y) => row.map((_, x) => pairFor(cells[y * row.length + x]!)!));
      lowestCost = cost;
      best = { choices: { ...choices }, pairs };
      return;
    }
    const control = controllers[index]!;
    for (const { color, point } of [control, ...control.alternatives]) {
      choices[control.key] = { color, point };
      if (cells.every(cell => cell.keys.some(key => !choices[key]) || pairFor(cell))) visit(index + 1, cost + Number(color !== control.color));
    }
    delete choices[control.key];
  }
  visit(0, 0);
  return best;
}

function initial(epoch: number, rows: NativeRows, acquired: Acquired | null): State | null {
  const layout = crossedPrefixGeometry(rows);
  if (!layout || layout.controllers.length > 16 || layout.shape[0] * layout.shape[1] > 64) return null;
  const palette = new Set(layout.reference.palette);
  if (layout.reference.values.some((row, y) => row.some((_, x) => crossedPrefixSlot(rows, layout, [x, y])
    .some(line => line.some(color => palette.has(color)))))) return null;
  const analogous = acquired && equal(layout.reference.scale, acquired.layout.reference.scale)
    && equal(layout.size, acquired.layout.size) && equal(layout.pitch, acquired.layout.pitch)
    && layout.controllers.every(control => acquired.layout.controllers.some(previous => previous.axis === control.axis && previous.side === control.side));
  const pattern = analogous ? solveSwatches(layout, acquired.pairs) : undefined;
  return { epoch, layout, progress: Object.fromEntries(layout.controllers.map(control => [control.key, 0])), selected: null,
    commands: {}, axisCommands: analogous ? acquired.axes : [[], []], crossed: false, tried: [], stopped: false, evidence: [],
    ...(analogous ? { pairs: acquired.pairs, transferred: true } : {}), ...(pattern ? { pattern } : {}) };
}

function returnAssessment(local: State, choice: Choice, first: NativeRows, second: NativeRows) {
  const { layout } = local;
  if (!crossedPrefixReferencePresent(second, layout)) return 'refuted';
  if (choice.selecting) {
    const measured = !local.pattern || crossedPrefixMeasureControls(second, layout)
      ?.some(control => control.key === choice.controller.key && control.color === choice.controller.color);
    return measured ? 'selection' : 'refuted';
  }
  const before = crossedPrefixSlot(first, layout, choice.cell), after = crossedPrefixSlot(second, layout, choice.cell);
  if (equal(before, after)) return equal(first, second) ? 'unchanged' : 'refuted';
  const [x, y] = choice.cell, expected = choice.crossing ? layout.reference.values[y]![x] : choice.controller.color;
  if (local.transferred && painted(second, layout, choice.cell) === painted(first, layout, choice.cell)) {
    const nextIndex = (local.progress[choice.controller.key] ?? 0) + 1;
    const next = nextIndex < choice.controller.length ? crossedPrefixCell(choice.controller, nextIndex) : null;
    // The control can change a border while the cursor stays on the same cell.
    if ((!next || equal(crossedPrefixSlot(first, layout, next), crossedPrefixSlot(second, layout, next)))
      && !layout.reference.palette.includes(painted(second, layout, choice.cell)!)) return 'unchanged';
  }
  return painted(second, layout, choice.cell) === expected ? 'advanced' : 'refuted';
}

export function createSicVerifyCrossingRows(family = verifyCrossingRowsId): NativeFamily<Proposal> {
  let state: State | null = null;
  let acquired: Acquired | null = null;
  let decide: NativeProgramHandle | undefined;
  return {
    id: family,
    async attachPrograms(registry) {
      decide = await registry.registerProgram(chooseLanding, {}, await landingModule());
    },
    controlledClickRegions(observation, rows) {
      if (!state || state.epoch !== observation.level_epoch || !Object.values(state.progress).some(count => count > 0)) return [];
      const { layout } = state;
      if (!crossedPrefixReferencePresent(rows, layout)) return [];
      const controls = crossedPrefixMeasureControls(rows, layout);
      if (!controls) return [];
      const swatches = controls.flatMap(control => [control, ...control.alternatives]);
      return geometricComponents(rows).filter(({ bbox: [l, t, r, b], color, area }) => area === (r - l + 1) * (b - t + 1)
        && swatches.some(({ point: [x, y], color: ink }) => ink === color && l <= x && x <= r && t <= y && y <= b))
        .map(part => part.bbox);
    },
    async propose(observation, rows, _inputs, remaining, execution) {
      if (remaining < 1 || !observation.available_action_refs.includes('ACTION6')) return null;
      let local = state?.epoch === observation.level_epoch ? state : null;
      if (!local && family === learnCrossingRowsId) {
        const receipt = execution?.readPriorDirectionalScene?.((earlier, previous) => initial(previous.level_epoch, earlier, null));
        if (!receipt || receipt.afterRef !== observation.observation_ref) return null;
        const { layout } = receipt.scene;
        const changed = layout.reference.values.flatMap((row, y) => row.flatMap((_, x) =>
          layout.reference.palette.includes(painted(rows, layout, [x, y])!) ? [[x, y] as NativePoint] : []));
        const returned = crossedPrefixMeasureControls(rows, layout);
        if (changed.length !== 1 || !returned || !crossedPrefixReferencePresent(rows, layout)) return null;
        const candidates = returned.filter(control => equal(crossedPrefixCell(control, 0), changed[0])
          && control.color === painted(rows, layout, changed[0]!));
        if (candidates.length !== 1) return null;
        const control = candidates[0]!;
        const axisCommands: State['axisCommands'] = [[], []];
        axisCommands[control.axis] = [receipt.command];
        local = { ...receipt.scene, progress: { ...receipt.scene.progress, [control.key]: 1 }, selected: control.key,
          commands: { [`${control.key}:0`]: receipt.command }, axisCommands, evidence: [receipt.beforeRef, receipt.afterRef] };
      }
      local ??= initial(observation.level_epoch, rows, acquired);
      if (!local || local.stopped || local.tried.length >= 80 || !crossedPrefixReferencePresent(rows, local.layout)) return null;
      const { layout, pattern } = local, observed = crossedPrefixMeasureControls(rows, layout);
      if (!observed) return null;
      const controls = pattern ? observed.map(control => ({ ...control, ...pattern.choices[control.key]! })) : observed;
      const horizontal = controls.filter(control => control.axis === 0), vertical = controls.filter(control => control.axis === 1);
      const byLane = (items: CrossedPrefixController[], lane: number) => items.find(item => item.lane === lane)!;
      if (layout.reference.values.some((row, y) => row.some((value, x) =>
        value !== byLane(horizontal, y)?.color && value !== byLane(vertical, x)?.color))) return null;
      const progress = (controller: CrossedPrefixController) => local.progress[controller.key] ?? 0;
      let controller: CrossedPrefixController | undefined;
      let anchorLimit: number | null = null;
      if (!local.crossed && !local.transferred) {
        const anchors = layout.reference.values.flatMap((row, y) => row.flatMap((_, x) => {
          const h = byLane(horizontal, y), v = byLane(vertical, x);
          return h.color !== v.color ? [{ x, y, h, v }] : [];
        })).sort((a, b) => a.x + a.y - b.x - b.y);
        const anchor = anchors[0];
        if (anchor) {
          const { x, y, h, v } = anchor;
          const steps = (control: CrossedPrefixController, coordinate: number) => control.side < 0 ? coordinate + 1 : control.length - coordinate;
          controller = progress(h) < steps(h, x) ? h : progress(v) < steps(v, y) ? v : undefined;
          if (controller) anchorLimit = steps(controller, controller.axis === 0 ? x : y);
        }
      }
      controller ??= controls.find(control => progress(control) < control.length);
      if (!controller) return null;
      const index = progress(controller), cell = crossedPrefixCell(controller, index);
      const [x, y] = cell, peer = controller.axis === 0 ? byLane(vertical, x) : byLane(horizontal, y);
      const coordinate = controller.axis === 0 ? y : x;
      const peerIndex = peer.side < 0 ? coordinate : peer.length - 1 - coordinate;
      const priorCommand = local.commands[`${peer.key}:${peerIndex}`], crossing = priorCommand !== undefined;
      const selecting = local.selected !== controller.key;
      const tested = (action: NativeCommand) => local.tried.includes(key([controller.key, index, priorCommand ?? null, action]));
      const learned = local.axisCommands[controller.axis], opposite = local.axisCommands[1 - controller.axis]!;
      const available = observation.available_action_refs.filter(action => /^ACTION[1-5]$/.test(action));
      const expected = layout.reference.values[y]![x]!;
      const composed = pattern?.pairs[y]?.[x];
      const pairMatches = (pair: CrossingPair) => priorCommand === undefined || pair.commands[1 - controller.axis] === priorCommand;
      const matchingOwner = (pair: CrossingPair) => (pair.owner === controller.axis ? controller.color : peer.color) === expected;
      const applicable = local.transferred ? (local.pairs ?? []).filter(pairMatches) : [];
      const preferred = applicable.filter(matchingOwner).map(pair => pair.commands[controller.axis]);
      const contrary = new Set(applicable.filter(pair => !matchingOwner(pair)).map(pair => pair.commands[controller.axis]));
      const newCommands = available.filter(action => !opposite.includes(action)
        && (!local.transferred || !learned.includes(action)));
      const ordered = [...new Set(local.transferred
        ? [...preferred, ...newCommands, ...learned.filter(action => !contrary.has(action)), ...available.filter(action => !contrary.has(action))]
        : [...learned, ...newCommands, ...available])];
      const plain = (composed ? [composed.commands[controller.axis]] : ordered).filter(action => available.includes(action))
        .map(action_ref => ({ action_ref, data: {} }))
        .find(action => !tested(action));
      const point = controller.point;
      const action = selecting ? { action_ref: 'ACTION6', data: { x: point[0], y: point[1] } } : plain;
      if (!action || tested(action)) return null;
      const measured = !selecting && learned.includes(action.action_ref)
        && (!!composed || (local.transferred ? preferred.includes(action.action_ref) : !crossing || local.crossed));
      const selectedPair = composed ?? applicable.find(pair => matchingOwner(pair) && pair.commands[controller.axis] === action.action_ref);
      const ref = observation.observation_ref, evidence: [string, ...string[]] = [ref,
        ...new Set([...local.evidence, ...(selectedPair ? [selectedPair.proof] : [])].filter(value => value !== ref))];
      const mode = execution?.reasoningMode ?? (measured ? 'solving' : 'exploration');
      const facts = { routeSupported: measured, eligibleProbe: !measured, knownInteraction: false, mode };
      const decision = await decide?.run({ situation: facts }, { signal: execution?.signal });
      const strategy = measured ? 'P07' : 'P05';
      if (decision?.result !== strategy) return null;
      const phase = selecting ? 'select_aligned_prefix' : measured ? 'extend_measured_prefix' : 'test_prefix_advance';
      const label = crossingRowsStrategies[phase], parent = 'G_official_completion';
      const objective = { kind: 'copy_pattern_with_crossing_lines', scope: layout.ref, subjects: ['row_contributions', 'column_contributions'],
        parentObjective: parent, satisfactionContract: 'official_progress_after_advancing_the_reference_contributions' };
      const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence }, id = `crossing-rows:${need.id}`;
      const choice: Choice = { controller, action, cell, selecting, crossing,
        ...(priorCommand === undefined ? {} : { interaction: { peer, input: priorCommand, expected } }) };
      const cursor = painted(rows, layout, cell);
      const prefix = [choice];
      if (measured && cursor !== undefined && !layout.reference.palette.includes(cursor) && cursor !== layout.empty_appearance
        && !local.transferred && (local.crossed || !crossing) && /^ACTION[1-4]$/.test(action.action_ref)) {
        const limit = Math.min(controller.length, anchorLimit ?? controller.length, index + remaining,
          index + maximumCommittedActions, index + 80 - local.tried.length);
        for (let next = index + 1; next < limit; next++) {
          const site = crossedPrefixCell(controller, next), [px, py] = site;
          const other = controller.axis === 0 ? byLane(vertical, px) : byLane(horizontal, py);
          const at = controller.axis === 0 ? py : px;
          const otherIndex = other.side < 0 ? at : other.length - 1 - at;
          const input = local.commands[`${other.key}:${otherIndex}`];
          const expected = layout.reference.values[py]![px]!;
          const supported = input === undefined || controller.color === other.color || local.pairs?.some(pair =>
            pair.commands[controller.axis] === action.action_ref && pair.commands[other.axis] === input
            && (pair.owner === controller.axis ? controller.color : other.color) === expected);
          if (!supported || local.tried.includes(key([controller.key, next, input ?? null, action]))) break;
          prefix.push({ controller, action, cell: site, selecting: false, crossing: input !== undefined,
            ...(input === undefined ? {} : { interaction: { peer: other, input, expected } }) });
          if (input !== undefined && !local.crossed) break;
        }
      }
      const route = prefix.length > 1 ? prefix : undefined;
      const actions = route?.map(step => step.action) ?? [action];
      const binding = selecting && await ObservedInputDomain.makeLocusWitness(observation, rows, point, { reason: label, evidence });
      const left = layout.origin[0] + x * layout.pitch[0], top = layout.origin[1] + y * layout.pitch[1];
      const target: NativeBox = [left, top, left + layout.size[0] - 1, top + layout.size[1] - 1];
      const { origin: [rx, ry], scale: [sx, sy] } = layout.reference;
      const reference: NativeBox = [rx, ry, rx + sx * layout.shape[0] - 1, ry + sy * layout.shape[1] - 1];
      return { status: 'proposed', kind: family, actions, local, choice, ...(route ? { route, cursor } : {}),
        needId: need.id,
        steps: actions.map((action, index) => ({ action, expected_after: route ? route[index]!.cell : null,
          ...(binding ? { point_binding: binding } : {}) })),
        binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        sicSrcDecision: { workflow: decision.receipt.workflow, hash: decision.receipt.src_hash,
          instructions: decision.receipt.instructions, edited: 'edited' in decision.receipt && decision.receipt.edited === true,
          situation: facts },
        sicSituationCard: { strategy, need: 'Reproduce the reference through contributions from both axes', mode,
          situation: pattern && selecting ? 'Choose the visible swatch needed by this line and its crossings.'
            : crossing ? 'The other axis has already reached this cell. Compare the crossing color with the reference.' : label,
          agenda: [], evidence, triggerCard: decision.receipt.workflow, target, reference, controller: [...point, ...point] },
        question: { reason: label, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: label, relations: [`contributes_to:${parent}`] }],
        sicLocalDecision: { strategy, objective: { id, label, parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: label,
          preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
    },
    before(proposal, index, packet, observation) {
      const step = proposal.route?.[index], { layout } = proposal.local;
      const admitted = index === 0 ? proposal.binding?.observation_ref === observation.observation_ref
        : !!step && proposal.binding?.level_epoch === observation.level_epoch
          && crossedPrefixReferencePresent(packet.frame_rows, layout)
          && painted(packet.frame_rows, layout, step.cell) === proposal.cursor
          && !!crossedPrefixMeasureControls(packet.frame_rows, layout)?.some(control =>
            control.key === step.controller.key && control.color === step.controller.color);
      return { admitted, reason: admitted ? 'crossing_inputs_bound' : 'crossing_inputs_changed' };
    },
    after(proposal, index, before, after, first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true, reason: 'official_boundary',
        sic_need: { id: proposal.needId, status: 'satisfied' } };
      const result = returnAssessment(proposal.local, proposal.route?.[index] ?? proposal.choice, first, second);
      return { matched: result === 'selection' ? null : result === 'advanced',
        seal_prefix: result !== 'advanced' || index + 1 === proposal.actions.length, reason: `prefix_${result}` };
    },
    record(before, after, issued, first, second, proposal, index) {
      const local = index > 0 ? state ?? proposal.local : proposal.local;
      const choice = proposal.route?.[index] ?? proposal.choice, { controller } = choice;
      if (after.levels_completed > before.levels_completed) {
        if (local.pairs?.length) acquired = { axes: local.axisCommands, pairs: local.pairs, layout: local.layout };
        return { events: [] };
      }
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const result = returnAssessment(local, choice, first, second), progress = { ...local.progress }, commands = { ...local.commands };
      const axisCommands: [string[], string[]] = [[...local.axisCommands[0]], [...local.axisCommands[1]]];
      let pairs = local.pairs ?? [];
      if (result === 'advanced') {
        const index = progress[controller.key]!;
        progress[controller.key] = index + 1;
        commands[`${controller.key}:${index}`] = issued.action_ref;
        if (!axisCommands[controller.axis].includes(issued.action_ref)) axisCommands[controller.axis].push(issued.action_ref);
        const interaction = choice.interaction;
        if (interaction && controller.color !== interaction.peer.color) {
          const pair: CrossingPair = { commands: controller.axis === 0 ? [issued.action_ref, interaction.input] : [interaction.input, issued.action_ref],
            owner: controller.color === interaction.expected ? controller.axis : interaction.peer.axis, proof: after.observation_ref };
          if (!pairs.some(known => known.owner === pair.owner && equal(known.commands, pair.commands))) pairs = [...pairs, pair];
        }
      }
      state = { ...local, commands, axisCommands, progress, selected: controller.key, stopped: result === 'refuted',
        crossed: local.crossed || result === 'advanced' && choice.crossing,
        tried: [...local.tried, key([controller.key, local.progress[controller.key], choice.interaction?.input ?? null, issued])],
        evidence: [...local.evidence.slice(-4), after.observation_ref], pairs };
      return { events: [] };
    },
    state: () => ({ state, acquired }),
    restore(value: NativeRecord) {
      state = structuredClone(value.state as State | null);
      acquired = structuredClone((value.acquired as Acquired | undefined) ?? null);
    },
  };
}
