import { framedRows, value } from '../logos-engine/v6-coupled-displays.ts';
import { ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeFamily, NativeObservation, NativeProgramHandle, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { sicNeedId } from './need-identity.ts';
import { compileStrategyGraph, observedMechanicsGroup, resolveStrategyGraph } from './strategy-agenda.ts';
import { chooseLanding, landingModule } from './highlighted-route-card.ts';
import { navigationPrimitives } from './navigation-primitives.ts';
import { chooseCascade, measureLogicCascade, readCascade, type Cascade, type CascadeChoice, type CascadeReading } from './logic-cascade.ts';
import type { ReasoningMode } from './reasoning-mode.ts';

export const displayCouplingId = 'sic_display_coupling';
export const displayCouplingStrategies = {
  P05: navigationPrimitives.P05,
  test_aligned_switch: 'Test a switch near a distinct indicator',
  vary_coupled_switches: 'Compare another switch after the indicator row changes',
  recheck_scored_switch_spacing: 'Recheck the switch spacing that previously aligned the indicators',
} as const;
const graph = compileStrategyGraph({ id: 'relate_switches_to_indicators', version: 1, order: 'FALLBACK',
  priorities: ['recheck_scored_switch_spacing', 'vary_coupled_switches', 'test_aligned_switch'],
  strategies: {
    test_aligned_switch: [{ fact: 'untested', expected: true, label: 'A control is horizontally near a minority value in a separate indicator row' }],
    vary_coupled_switches: [{ fact: 'coupled', expected: true, label: 'An earlier click changed its own control and the separate indicators' }],
    recheck_scored_switch_spacing: [{ fact: 'canRecheck', expected: true, label: 'The switch and indicator rows were relocated and the verified spacing suggests an untested setting' }],
  },
}, ['untested', 'coupled', 'canRecheck']);
type ScoredSpacing = { epoch: number; score: number; control: [number, number]; receiver: [number, number];
  receiverSide: number; period: number; offset: number; fromRight: boolean; evidence: string[] };
type State = { epoch: number; controls: NativeBox[]; receivers: NativeBox[]; initial: number; attempts: string[]; inert: number[];
  visited: string[]; coupled: boolean; count: number; stopped: boolean; evidence: string[];
  firstCoupled?: number; spacing?: ScoredSpacing | null };
type SpacingProposal = NativeProposal & { cascade?: undefined; local: State; index: number; controls: number[]; receivers: number[]; attempt: string; needId: string;
  sicSituationCard: Record<string, unknown> & { strategy: keyof typeof displayCouplingStrategies } };
type CascadeState = { epoch: number; layout: Cascade; samples: CascadeReading[]; refs: string[]; blocked: string[]; inconsistent?: true };
type Proposal = SpacingProposal | (NativeProposal & { needId: string; cascade: { local: CascadeState; current: CascadeReading; choice: CascadeChoice } });
const values = (rows: NativeRows, boxes: NativeBox[]) => {
  const measured = boxes.map(box => value(rows, box));
  return measured.some(color => color === null) ? null : measured as number[];
};
const size = ([left, top, right, bottom]: NativeBox): [number, number] => [right - left + 1, bottom - top + 1];
const sameAspect = (a: [number, number], b: [number, number]) => a[0] * b[1] === b[0] * a[1];
const fromEdge = (index: number, length: number, spacing: ScoredSpacing) => spacing.fromRight ? length - 1 - index : index;
function expectedSwitch(index: number, length: number, spacing: ScoredSpacing): boolean {
  const distance = fromEdge(index, length, spacing) - spacing.offset;
  return distance >= 0 && distance % spacing.period === 0;
}

function measure(observation: NativeObservation, rows: NativeRows, spacing: ScoredSpacing | null): State | null {
  const groups = framedRows(observation, rows);
  const candidates = groups.flatMap(controls => {
    const initial = values(rows, controls);
    if (controls.length < 3 || !initial || new Set(initial).size !== 1) return [];
    const [width, height] = size(controls[0]!);
    return groups.flatMap(receivers => {
      if (receivers === controls) return [];
      const side = receivers[0]![1] - controls[0]![1], receiverSize = size(receivers[0]!);
      if (Math.abs(side) < 4 * height) return [];
      const relocated = spacing && Math.sign(side) === spacing.receiverSide
        && sameAspect([width, height], spacing.control) && sameAspect(receiverSize, spacing.receiver);
      const contrasted = receivers.length === controls.length && receiverSize[1] === height && receiverSize[0] > width
        && new Set(values(rows, receivers)).size >= 2;
      return relocated || contrasted ? [{ controls, receivers, initial: initial[0]!, spacing: relocated ? spacing : null }] : [];
    });
  });
  return candidates.length === 1 ? { ...candidates[0]!, epoch: observation.level_epoch, attempts: [], inert: [],
    visited: [], coupled: false, count: 0, stopped: false, evidence: [] } : null;
}

function scoreSpacing(proposal: SpacingProposal, after: NativeObservation, frames: readonly NativeRows[]): ScoredSpacing | null {
  const { local, index, controls, receivers } = proposal, first = local.firstCoupled;
  const analogy = local.spacing;
  const newCoupling = first !== undefined && new Set(receivers).size >= 2;
  if ((!analogy && !newCoupling) || controls[index] !== local.initial) return null;
  for (const frame of frames) {
    const settings = values(frame, local.controls), outputs = values(frame, local.receivers);
    if (!settings || !outputs || new Set(outputs).size !== 1) continue;
    if (settings[index] === local.initial || settings.some((value, i) => i !== index && value !== controls[i])) continue;
    if (new Set(settings).size !== 2) continue;
    const active = settings.flatMap((value, i) => value !== local.initial ? [i] : []);
    if (active.length < 2) continue;
    const measurement = { epoch: after.level_epoch, score: after.levels_completed, control: size(local.controls[0]!),
      receiver: size(local.receivers[0]!), receiverSide: Math.sign(local.receivers[0]![1] - local.controls[0]![1]) };
    if (analogy && settings.every((value, i) => (value !== local.initial) === expectedSwitch(i, settings.length, analogy))) {
      return { ...analogy, ...measurement,
        evidence: [...new Set([...analogy.evidence, ...local.evidence, after.observation_ref])].slice(-8) };
    }
    if (!newCoupling || !active.includes(first!) || !receivers.includes(outputs[0]!)) continue;
    const period = active[1]! - active[0]!;
    if (period < 2 || settings.some((value, i) => (value !== local.initial) !== ((i - active[0]!) % period === 0))) continue;
    const fromRight = first! > (settings.length - 1) / 2;
    const offset = fromRight ? settings.length - 1 - active.at(-1)! : active[0]!;
    return { ...measurement, period, offset, fromRight, evidence: [...local.evidence, after.observation_ref] };
  }
  return null;
}

export function createSicDisplayCoupling(): NativeFamily<Proposal> {
  let state: State | null = null;
  let scored: ScoredSpacing | null = null;
  let cascade: CascadeState | null = null;
  let decide: NativeProgramHandle | undefined;
  const currentSpacing = (observation: NativeObservation) => scored?.epoch === observation.level_epoch
    && scored.score === observation.levels_completed ? scored : null;

  async function offerCascade(observation: NativeObservation, rows: NativeRows, remaining: number, mode: ReasoningMode,
    signal?: AbortSignal): Promise<Proposal | null> {
    const prior = cascade?.epoch === observation.level_epoch ? cascade : null;
    if (prior?.inconsistent) return null;
    const layout = prior?.layout ?? measureLogicCascade(observation, rows);
    if (!layout) return null;
    const current = readCascade(rows, layout);
    if (!current) return null;
    const ref = observation.observation_ref;
    const local = prior ?? { epoch: observation.level_epoch, layout, samples: [current], refs: [ref], blocked: [] };
    const choice = chooseCascade(rows, layout, local.samples, current, local.blocked, remaining);
    if (!choice) return null;
    const evidence: [string, ...string[]] = [ref, ...local.refs.filter(value => value !== ref)];
    const facts = { routeSupported: false, eligibleProbe: true, knownInteraction: false, mode };
    const decision = await decide?.run({ situation: facts }, { signal });
    if (decision?.result !== 'P05') return null;
    const box = layout.controls[choice.index]!;
    const [left, top, right, bottom] = box, x = Math.floor((left + right) / 2), y = Math.floor((top + bottom) / 2);
    const command = { action_ref: 'ACTION6', data: { x, y } }, actions = [command];
    const receivers = layout.terminals?.map(terminal => terminal.lamp) ?? [layout.lamp];
    const label = layout.terminals ? 'Compare the switch, gate signals, and all terminal lamps' : 'Compare the switch, intermediate signals, and final lamp';
    const witness = await ObservedInputDomain.makeLocusWitness(observation, rows, [x, y], { reason: label, evidence });
    if (!witness) return null;
    const parent = 'G_official_completion';
    const objective = { kind: 'activate_observed_signal_cascade', scope: ref.split(':revision:', 1)[0]!, subjects: [layout.terminals ? 'terminal_lamps' : 'final_lamp'],
      parentObjective: parent, satisfactionContract: 'observe_official_progress_after_preparing_joint_inputs' };
    const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence }, id = `signal-cascade:${need.id}`;
    const situation = choice.distance > 1 ? `Prepare an untested setting in ${choice.distance} switch changes and compare the intermediate signals.`
      : layout.terminals ? 'Test the new switch setting and compare its effect on every terminal lamp.'
        : 'Test the new switch setting and compare the intermediate signals with the final lamp.';
    return { status: 'proposed', kind: displayCouplingId, actions, needId: need.id, cascade: { local, current, choice },
      steps: [{ action: command, expected_after: { setting: choice.setting }, point_binding: witness }],
      binding: { observation_ref: ref, level_epoch: observation.level_epoch },
      sicSrcDecision: { workflow: decision.receipt.workflow, hash: decision.receipt.src_hash, instructions: decision.receipt.instructions,
        edited: 'edited' in decision.receipt && decision.receipt.edited === true, situation: facts },
      sicSituationCard: { strategy: 'P05', need: layout.terminals ? 'Find one setting that activates all terminal lamps'
        : 'Combine switch settings that activate the final lamp', mode, situation, agenda: [], evidence,
        triggerCard: decision.receipt.workflow, control: box, receivers, cascadeGates: layout.gates.map(gate => gate.box),
        distance: choice.distance, logicAlternatives: choice.hypotheses },
      question: { reason: label, hypothesis_refs: evidence }, route_refs: evidence,
      compositions: [{ id, observed: false, open_question: label, relations: [`contributes_to:${parent}`] }],
      sicLocalDecision: { strategy: 'P05', objective: { id, label, parent }, need },
      bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: label,
        preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
  }

  return {
    id: displayCouplingId,
    async attachPrograms(registry) { decide = await registry.registerProgram(chooseLanding, {}, await landingModule()); },
    async proposeInGroup(group, observation, rows, inputs, remaining, execution) {
      if (group !== observedMechanicsGroup) return this.propose(observation, rows, inputs, remaining, execution);
      if (!currentSpacing(observation)) return null;
      const proposal = await this.propose(observation, rows, inputs, remaining, execution);
      return proposal?.cascade || proposal?.sicSituationCard?.strategy === 'recheck_scored_switch_spacing' ? proposal : null;
    },
    async propose(observation, rows, _inputs, remaining, execution) {
      if (remaining < 1 || !observation.available_action_refs.includes('ACTION6')) return null;
      if (cascade?.epoch === observation.level_epoch) return offerCascade(observation, rows, remaining, execution?.reasoningMode ?? 'exploration', execution?.signal);
      const local = state?.epoch === observation.level_epoch ? state : measure(observation, rows, currentSpacing(observation));
      if (!local) return offerCascade(observation, rows, remaining, execution?.reasoningMode ?? 'exploration', execution?.signal);
      if (local.stopped || local.count >= 12) return null;
      const controls = values(rows, local.controls), receivers = values(rows, local.receivers);
      if (!controls || !receivers) return null;
      const alternative = [...new Set(controls.filter(color => color !== local.initial))];
      if (alternative.length > 1) return null;
      const frequency = receivers.map(color => receivers.filter(value => value === color).length);
      const minority = local.receivers.filter((_, index) => frequency[index] === Math.min(...frequency));
      const options = local.controls.map(([l, t, r, b], index) => {
        const projected = controls.map((color, i) => i !== index ? color : color === local.initial ? alternative[0] ?? null : local.initial);
        return { index, point: [Math.floor((l + r) / 2), Math.floor((t + b) / 2)] as const,
          attempt: JSON.stringify([index, controls, receivers]), repeated: local.visited.includes(JSON.stringify(projected)),
          distance: Math.min(...minority.map(([x, , right]) => Math.abs(l + r - x - right))) };
      }).filter(option => !local.inert.includes(option.index) && !local.attempts.includes(option.attempt))
        .sort((a, b) => Number(a.repeated) - Number(b.repeated) || a.distance - b.distance || a.index - b.index);
      const analogy = local.spacing;
      const candidate = analogy && options.filter(option =>
        expectedSwitch(option.index, controls.length, analogy) !== (controls[option.index] !== local.initial))
        .sort((a, b) => fromEdge(a.index, controls.length, analogy) - fromEdge(b.index, controls.length, analogy))[0];
      const option = candidate || options[0];
      if (!option) return null;
      const [x, y] = option.point, command = { action_ref: 'ACTION6', data: { x, y } };
      const ref = observation.observation_ref, evidence: [string, ...string[]] = [ref,
        ...new Set([...local.evidence, ...(candidate && analogy ? analogy.evidence : [])].filter(value => value !== ref))];
      const { selected, entries } = resolveStrategyGraph({ graph, mode: 'active', facts: {
        untested: { value: true, evidence }, coupled: { value: local.coupled, evidence }, canRecheck: { value: !!candidate, evidence },
      }, planners: { test_aligned_switch: () => command, vary_coupled_switches: () => command, recheck_scored_switch_spacing: () => command } });
      if (!selected) return null;
      const strategy = selected.id, label = displayCouplingStrategies[strategy], parent = 'G_official_completion';
      const objective = { kind: 'learn_remote_indicator_effect', scope: ref.split(':revision:', 1)[0]!, subjects: ['switches', 'separate_indicators'],
        parentObjective: parent, satisfactionContract: 'observe_how_switches_change_separate_indicators_and_confirm_progress' };
      const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence };
      const id = `display-coupling:${need.id}`, actions = [command];
      const binding = await ObservedInputDomain.makeLocusWitness(observation, rows, option.point, { reason: label, evidence });
      return { status: 'proposed', kind: displayCouplingId, actions, local, index: option.index, controls, receivers, attempt: option.attempt, needId: need.id,
        steps: [{ action: command, expected_after: null, point_binding: binding }], binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        sicSituationCard: { strategy, need: 'Understand how to change the indicators', mode: candidate ? 'assimilation' : 'exploration',
          situation: !candidate && local.coupled ? 'A previous click changed the switch and the remote row. The rule linking them is still uncertain.' : label,
          agenda: entries, evidence, control: local.controls[option.index], receivers: local.receivers },
        question: { reason: label, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: label, relations: [`contributes_to:${parent}`] }],
        sicLocalDecision: { strategy, objective: { id, label, parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: label,
          preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
    },
    before(proposal, index, _packet, observation) {
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref;
      return { admitted, reason: admitted ? 'indicator_rows_bound' : 'indicator_rows_changed' };
    },
    after(proposal, _index, before, after, _first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true,
        reason: 'official_boundary', sic_need: { id: proposal.needId, status: 'satisfied' } };
      if (proposal.cascade) {
        const { local, current, choice } = proposal.cascade, returned = readCascade(second, local.layout);
        const matched = returned?.setting === choice.setting && returned.controlInks.every((ink, i) => i === choice.index || ink === current.controlInks[i]);
        return { matched, seal_prefix: true, reason: matched ? 'cascade_switch_changed_as_projected' : 'cascade_switch_projection_contradicted' };
      }
      return { matched: null, seal_prefix: true, reason: 'measure_switch_and_remote_indicators' };
    },
    record(before, after, _command, _first, second, proposal, _index, frames) {
      if (proposal.cascade) {
        const ref = after.observation_ref;
        if (after.levels_completed > before.levels_completed) return { events: [], reviewEvidence: proposal.cascade.local.layout.terminals
          ? 'The joint switch setting activated every terminal lamp.' : 'The joint switch setting activated the final lamp.' };
        if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
        const { local, current, choice } = proposal.cascade, returned = readCascade(second, local.layout);
        const prior = returned ? local.samples.find(sample => sample.setting === returned.setting) : null;
        const inconsistent = !returned || !!prior && JSON.stringify([prior.lamp, prior.lamps, prior.active, prior.ports])
          !== JSON.stringify([returned.lamp, returned.lamps, returned.active, returned.ports]);
        const matched = returned?.setting === choice.setting;
        cascade = { ...local, samples: returned && !prior ? [...local.samples, returned] : local.samples,
          refs: [...local.refs.slice(-5), ref], blocked: matched ? local.blocked : [...local.blocked, `${current.setting}:${choice.index}`],
          ...(inconsistent ? { inconsistent: true as const } : {}) };
        if (!returned || !matched || inconsistent) return { events: [] };
        const gates = returned.active.filter((active, i) => active !== current.active[i]).length;
        const ports = returned.ports.reduce((sum, row, index) => sum + row.filter((value, j) => value !== current.ports[index]![j]).length, 0);
        const lamps = returned.lamps?.filter((ink, index) => ink !== current.lamps?.[index]).length;
        const lamp = lamps !== undefined ? `Terminal lamps changed state (${lamps}).`
          : returned.lamp === current.lamp ? 'The final lamp held its state.' : 'The final lamp changed.';
        const reviewEvidence = gates ? `Intermediate components changed state (${gates}). ${lamp}`
          : ports ? `Inputs of intermediate components changed (${ports}). ${lamp}` : 'The switch changed. SIC retained the new joint setting.';
        return { events: [], reviewEvidence };
      }
      if (after.levels_completed > before.levels_completed) {
        scored = scoreSpacing(proposal, after, frames);
        return { events: [] };
      }
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const { local, index } = proposal, controls = values(second, local.controls), receivers = values(second, local.receivers);
      const localChanges = controls?.flatMap((color, i) => color !== proposal.controls[i] ? [i] : []) ?? [];
      const remoteChanges = receivers?.flatMap((color, i) => color !== proposal.receivers[i] ? [i] : []) ?? [];
      const unchanged = before.frame_hash === after.frame_hash;
      const coupled = localChanges.includes(index) && remoteChanges.length > 0;
      state = { ...local, count: local.count + 1, stopped: !controls || !receivers, coupled: local.coupled || coupled,
        ...(local.firstCoupled === undefined && coupled ? { firstCoupled: index } : {}),
        spacing: localChanges.length === 1 && localChanges[0] === index ? local.spacing ?? null : null,
        attempts: [...local.attempts, proposal.attempt], inert: unchanged ? [...local.inert, index] : local.inert,
        visited: [...local.visited, JSON.stringify(proposal.controls)], evidence: [...local.evidence.slice(-4), after.observation_ref] };
      return { events: [{ status: coupled ? 'remote_indicator_change_observed' : unchanged ? 'no_visible_change' : 'other_visible_change',
        control: index, changed_indicators: remoteChanges, evidence: [before.observation_ref, after.observation_ref] }] };
    },
    state: () => ({ state, scored, cascade }),
    restore(value: NativeRecord) {
      state = structuredClone(value.state as State | null);
      scored = structuredClone((value.scored as ScoredSpacing | null | undefined) ?? null);
      cascade = structuredClone((value.cascade as CascadeState | null | undefined) ?? null);
    },
  };
}
