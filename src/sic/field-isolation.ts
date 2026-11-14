import { acquireFields, fieldDirections, fieldStates, linkedControl, pairedControls } from '../logos-engine/v6-field-service-observation.ts';
import { framedPatterns, type FramedPattern } from '../logos-engine/v6-geometric-scene.ts';
import { geometricComponents, ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeFamily, NativePoint, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { sicNeedId } from './need-identity.ts';
import { compileStrategyGraph, resolveStrategyGraph } from './strategy-agenda.ts';

export const fieldIsolationId = 'sic_field_isolation';
export const learnFieldIsolationId = 'sic_learn_field_isolation';

export type ClickFieldEvidence = { readonly point: NativePoint; readonly family: string; readonly beforeRef: string; readonly afterRef: string;
  readonly levelEpoch: number; readonly fields: readonly Field[]; readonly before: Snapshot; readonly after: Snapshot };

export function measureClickFields(before: NativeRows, after: NativeRows, context: Omit<ClickFieldEvidence, 'fields' | 'before' | 'after'>): ClickFieldEvidence | null {
  const fields = acquireFields(before, after, [context.beforeRef, context.afterRef]);
  return fields.length >= 2 && fields.length <= 6 ? { ...context, fields, before: fieldStates(before, fields), after: fieldStates(after, fields) } : null;
}
export const fieldIsolationStrategies = {
  test_compact_control: 'Test the uniquely smallest framed control',
  compare_repeated_field_effect: 'Repeat the control and compare the field changes',
  test_inverse_field_effect: 'Test whether a contrasting control restores the previous field state',
  isolate_noncontributing_branch: 'Change the control aligned with the other field',
  repeat_isolated_field_effect: 'Repeat the measured effect with the other field isolated',
} as const;
const priorities = ['repeat_isolated_field_effect', 'isolate_noncontributing_branch', 'test_inverse_field_effect',
  'compare_repeated_field_effect', 'test_compact_control'] as const;
const graph = compileStrategyGraph({ id: 'isolate_a_contributing_field', version: 1, order: 'FALLBACK', priorities,
  strategies: {
    test_compact_control: [{ fact: 'discover', expected: true, label: 'A compact framed control can test for a distant effect' }],
    compare_repeated_field_effect: [{ fact: 'repeat', expected: true, label: 'One click changed two persistent fields' }],
    test_inverse_field_effect: [{ fact: 'reverse', expected: true, label: 'A contrasting pattern fits the size of the first control' }],
    isolate_noncontributing_branch: [{ fact: 'isolate', expected: true, label: 'The original field appearances are restored and only one field showed a distinct replacement' }],
    repeat_isolated_field_effect: [{ fact: 'serve', expected: true, label: 'The aligned control changed orientation while both field contents stayed in place' }],
  },
}, ['discover', 'repeat', 'reverse', 'isolate', 'serve']);
type Phase = 'discover' | 'repeat' | 'reverse' | 'restore' | 'isolate' | 'serve';
type Field = ReturnType<typeof acquireFields>[number];
type Snapshot = ReturnType<typeof fieldStates>;
type Target = { bbox: NativeBox; point: NativePoint; orientation?: string };
type State = { epoch: number; phase: Phase; forward: Target; inverse: Target | null; gate: Target | null; fields: Field[];
  history: Snapshot[]; other: string | null; count: number; stopped: boolean; evidence: string[] };
type Proposal = NativeProposal & { local: State; target: Target; needId: string };
const extent = ([l, t, r, b]: NativeBox) => [r - l + 1, b - t + 1];
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const matches = (a: Snapshot, b: Snapshot) => Object.keys(a).every(id => a[id]?.appearance_digest === b[id]?.appearance_digest);
const locate = (pattern: FramedPattern): Target => ({ bbox: pattern.bbox, point: pattern.center });

function firstControl(patterns: FramedPattern[], rows: NativeRows) {
  const compact = patterns.filter(pattern => {
    const [w, h] = extent(pattern.bbox);
    const [x, y] = pattern.center;
    return w === h && w! <= Math.min(rows.length, rows[0]!.length) / 4 && pattern.mask.length === 1 &&
      pattern.foreground_area >= 2 && pattern.foreground_area === pattern.scale ** 2 && rows[y]?.[x] === pattern.color;
  }).sort((a, b) => extent(a.bbox)[0]! - extent(b.bbox)[0]!);
  const first = compact[0], second = compact[1];
  return first && (!second || !same(extent(first.bbox), extent(second.bbox))) ? locate(first) : null;
}

function isolatedGate(local: State, rows: NativeRows) {
  const novel = local.fields.filter(field => local.history.some(sample => sample[field.id].opaque_replacement));
  if (novel.length !== 1) return null;
  const directions = fieldDirections(local.history[0]!, local.history[1]!);
  const other = local.fields.filter(field => field !== novel[0] && directions[field.id] === directions[novel[0]!.id]);
  if (other.length !== 1) return null;
  const gate = linkedControl(other[0]!, pairedControls(rows)) as Target | null;
  return gate ? { gate, other: other[0]!.id as string } : null;
}

export function createSicFieldIsolation(family = fieldIsolationId): NativeFamily<Proposal> {
  const learns = family === learnFieldIsolationId;
  let state: State | null = null;
  return {
    id: family,
    async propose(observation, rows, _inputs, remaining, execution) {
      if (remaining < 1 || observation.available_action_refs.some(action => /^ACTION[1-5]$/.test(action)) ||
        !observation.available_action_refs.includes('ACTION6')) return null;
      const prior = state?.epoch === observation.level_epoch ? state : null;
      if (prior?.stopped || (prior?.count ?? 0) >= 20) return null;
      const click = learns && !prior ? execution?.readClickFields?.() : null;
      if (learns && !prior && (click?.afterRef !== observation.observation_ref || click.levelEpoch !== observation.level_epoch)) return null;
      const patterns = framedPatterns(rows, geometricComponents(rows));
      const forward = prior?.forward ?? firstControl(patterns, rows);
      if (!forward || !patterns.some(pattern => same(pattern.bbox, forward.bbox) && same(pattern.center, forward.point))) return null;
      if (click && !click.point.every((value, axis) => value >= forward.bbox[axis]! && value <= forward.bbox[axis + 2]!)) return null;
      if (click && !matches(fieldStates(rows, click.fields), click.after)) return null;
      const local: State = prior ?? { epoch: observation.level_epoch, phase: click ? 'repeat' : 'discover', forward, inverse: null, gate: null,
        fields: click ? [...click.fields] : [], history: click ? [click.before, click.after] : [], other: null, count: 0, stopped: false,
        evidence: click ? [click.beforeRef, click.afterRef] : [] };
      const { phase } = local;
      const contrast = phase === 'discover' || phase === 'reverse' ? patterns.filter(pattern => !same(pattern.bbox, forward.bbox) &&
        same(extent(pattern.bbox), extent(forward.bbox)) && pattern.mask.length > 1) : [];
      if (phase === 'discover' && (contrast.length !== 1 || pairedControls(rows).length < 2)) return null;
      const target = phase === 'isolate' ? local.gate : phase === 'reverse' ? contrast.length === 1 ? locate(contrast[0]!) : null
        : phase === 'restore' ? local.inverse : forward;
      if (!target) return null;
      const [x, y] = target.point, command = { action_ref: 'ACTION6', data: { x, y } };
      const ref = observation.observation_ref, evidence: [string, ...string[]] = [ref, ...local.evidence.filter(value => value !== ref)];
      const { selected, entries } = resolveStrategyGraph({ graph, mode: 'active', facts: {
        discover: { value: phase === 'discover', evidence }, repeat: { value: phase === 'repeat', evidence },
        reverse: { value: phase === 'reverse' || phase === 'restore', evidence }, isolate: { value: phase === 'isolate', evidence },
        serve: { value: phase === 'serve', evidence },
      }, planners: { test_compact_control: () => command, compare_repeated_field_effect: () => command, test_inverse_field_effect: () => command,
        isolate_noncontributing_branch: () => command, repeat_isolated_field_effect: () => command } });
      if (!selected) return null;
      const strategy = selected.id, label = fieldIsolationStrategies[strategy], parent = 'G_official_completion';
      const objective = { kind: 'change_one_linked_field', scope: ref.split(':revision:', 1)[0]!, subjects: ['framed_controls', 'observed_fields'],
        parentObjective: parent, satisfactionContract: 'official_progress_after_preserving_the_isolated_field' };
      const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence }, id = `${learns ? family : 'field-isolation'}:${need.id}`;
      const actions = [command], binding = await ObservedInputDomain.makeLocusWitness(observation, rows, target.point, { reason: label, evidence });
      return { status: 'proposed', kind: family, actions, local, target, needId: need.id,
        steps: [{ action: command, expected_after: null, point_binding: binding }], binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        sicSituationCard: { strategy, need: 'Change the useful field while preserving the other field',
          mode: phase === 'serve' ? 'solving' : 'exploration', situation: label, agenda: entries, evidence, control: target.bbox,
          fields: local.fields.map(field => field.bbox), ...(click ? { clickSource: click.family, observedPoint: click.point } : {}) },
        question: { reason: label, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: label, relations: [`contributes_to:${parent}`] }],
        sicLocalDecision: { strategy, objective: { id, label, parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: label,
          preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
    },
    before(proposal, index, _packet, observation) {
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref;
      return { admitted, reason: admitted ? 'field_control_bound' : 'field_control_changed' };
    },
    after(proposal, _index, before, after, _first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true, reason: 'official_boundary',
        sic_need: { id: proposal.needId, status: 'satisfied' } };
      const { local } = proposal;
      const measured = fieldStates(second, local.fields);
      const matched = local.phase === 'serve' ? measured[local.other!]?.appearance_digest === local.history.at(-1)![local.other!]?.appearance_digest : null;
      return { matched, seal_prefix: true, reason: 'compare_linked_fields_and_control' };
    },
    record(before, after, _command, first, second, proposal) {
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const { local, target } = proposal, { phase } = local;
      const evidence = [...local.evidence.slice(-4), after.observation_ref];
      const next = { ...local, count: local.count + 1, evidence };
      if (phase === 'discover') {
        const fields = acquireFields(first, second, [before.observation_ref, after.observation_ref]);
        if (fields.length < 2 || fields.length > 6) next.stopped = true;
        else Object.assign(next, { fields, history: [fieldStates(first, fields), fieldStates(second, fields)], phase: 'repeat' });
      } else {
        const present = fieldStates(second, local.fields), history = [...local.history, present];
        next.history = history;
        if (phase === 'repeat') {
          const initial = fieldDirections(history[0]!, history[1]!), repeated = fieldDirections(history[1]!, present);
          next.stopped = !Object.values(repeated).some(Boolean) || Object.keys(initial).some(id => repeated[id] !== 0 && repeated[id] !== initial[id] && !present[id]?.opaque_replacement);
          next.phase = 'reverse';
        } else if (phase === 'reverse') {
          next.stopped = !matches(present, history[1]!);
          next.inverse = target;
          next.phase = 'restore';
        } else if (phase === 'restore') {
          const isolated = matches(present, history[0]!) && isolatedGate(next, second);
          if (isolated) Object.assign(next, isolated, { phase: 'isolate' });
          else next.stopped = true;
        } else if (phase === 'isolate') {
          const toggled = pairedControls(second).filter(gate => same(gate.point, target.point) && gate.orientation !== target.orientation);
          next.stopped = toggled.length !== 1 || !matches(present, local.history.at(-1)!);
          next.phase = 'serve';
        } else {
          const previous = local.history.at(-1)!;
          next.stopped = matches(present, previous) || present[local.other!]?.appearance_digest !== previous[local.other!]?.appearance_digest;
        }
      }
      state = next;
      return { events: [] };
    },
    state: () => ({ state }),
    restore(value: NativeRecord) { state = structuredClone(value.state as State | null); },
  };
}
