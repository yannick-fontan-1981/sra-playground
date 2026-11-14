import { acceptsConstraint, extractFields, fieldConstraints, induceFields, type Constraint } from '../logos-engine/v6-field-constraints.ts';
import { ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeFamily, NativePoint, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { sicNeedId } from './need-identity.ts';
import { compileStrategyGraph, resolveStrategyGraph } from './strategy-agenda.ts';

export const windowRelationId = 'sic_window_relation';
export const windowRelationStrategies = {
  test_inconsistent_cell: 'Test a cell that disagrees with the examples',
  apply_observed_cell_rewrite: 'Apply a change already seen on comparable cells',
} as const;

const graph = compileStrategyGraph({
  id: 'reconcile_repeated_window_examples', version: 1, order: 'FALLBACK',
  priorities: ['apply_observed_cell_rewrite', 'test_inconsistent_cell'],
  strategies: {
    apply_observed_cell_rewrite: [{ fact: 'learned', expected: true, label: 'At least two cells show the same change, which would make this cell agree with the examples' }],
    test_inconsistent_cell: [{ fact: 'probe', expected: true, label: 'Repeated windows imply the same constraint at a visible cell, whose response is still uncertain' }],
  },
}, ['learned', 'probe']);

type Rule = Parameters<typeof fieldConstraints>[1];
type State = { epoch: number; rule: Rule; size: NativePoint; pitch: NativePoint; rejected: string[];
  effects: { address: string; from: number; to: number }[]; firstRef: string; evidence: string[]; count: number };
type Cell = { box: NativeBox; address: string; actual: number; expected: number | null; sourcePoints: NativePoint[] };
type Proposal = NativeProposal & { local: State; cell: Cell; field: NativeBox; needId: string };
const point = (key: string): NativePoint => { const [x, y] = key.split(',').map(Number); return [x!, y!]; };
const pointOrder = (a: NativePoint, b: NativePoint) => a[0] - b[0] || a[1] - b[1];
const cellBox = ([x, y]: NativePoint, [w, h]: NativePoint): NativeBox => [x, y, x + w - 1, y + h - 1];
const equalPoint = (a: NativePoint, b: NativePoint) => pointOrder(a, b) === 0;
const inside = ([l, t, r, b]: NativeBox, x: number, y: number) => l <= x && x <= r && t <= y && y <= b;
function uniformValue(rows: NativeRows, [l, t, r, b]: NativeBox): number | null {
  const value = rows[t]?.[l];
  return value !== undefined && rows.slice(t, b + 1).every(row => row.slice(l, r + 1).every(sample => sample === value)) ? value : null;
}
function constraintSignature(table: ReadonlyMap<string, Constraint>): string {
  return JSON.stringify([...table].sort(([a], [b]) => pointOrder(point(a), point(b))).map(([p, c]) => [p, [...c.eq].sort(), [...c.ne].sort()]));
}

export function createSicWindowRelation(): NativeFamily<Proposal> {
  let state: State | null = null;
  return {
    id: windowRelationId,
    async propose(observation, rows, _inputs, remaining) {
      if (remaining < 1 || !observation.available_action_refs.includes('ACTION6')) return null;
      const prior = state?.epoch === observation.level_epoch ? state : null;
      if (prior && prior.count >= 24) return null;
      const fields = extractFields(observation, rows);
      const options = prior
        ? fields.filter(field => equalPoint(field.size, prior.size) && equalPoint(field.pitch, prior.pitch)).map(field => ({ field, rule: prior.rule }))
        : induceFields(fields);
      const candidates = options.flatMap(({ field, rule }) => {
        const table = fieldConstraints(field, rule);
        return table?.size ? [{ field, rule, table }] : [];
      });
      const current = candidates[0];
      if (!current || candidates.some(({ table }) => constraintSignature(table) !== constraintSignature(current.table))) return null;
      const { table, rule, field } = current;
      const local: State = prior ?? { epoch: observation.level_epoch, rule, size: field.size, pitch: field.pitch, rejected: [],
        effects: [], firstRef: observation.observation_ref, evidence: [], count: 0 };
      const [w, h] = field.size, places = field.groups.flatMap(group => [...group.keys()].map(point));
      const xs = places.map(p => p[0]), ys = places.map(p => p[1]);
      const fieldBox: NativeBox = [Math.min(...xs) - 1, Math.min(...ys) - 1, Math.max(...xs) + w, Math.max(...ys) + h];
      const cells = [...table].flatMap(([address, constraint]) => {
        if (acceptsConstraint(constraint, constraint.actual) || local.rejected.includes(address + ',' + constraint.actual)) return [];
        const known = local.effects.filter(effect => effect.from === constraint.actual);
        const outcomes = new Set(known.map(effect => effect.to));
        const expected = outcomes.size === 1 && new Set(known.map(effect => effect.address)).size >= 2 ? known[0]!.to : null;
        if (expected !== null && !acceptsConstraint(constraint, expected)) return [];
        return [{ box: cellBox(point(address), field.size), address, actual: constraint.actual, expected, sourcePoints: [...constraint.sources].map(point) }];
      }).sort((a, b) => b.sourcePoints.length - a.sourcePoints.length || pointOrder(point(a.address), point(b.address)));
      const learned = cells.find(cell => cell.expected !== null);
      const probe = cells.find(cell => cell.expected === null);
      const ref = observation.observation_ref;
      const evidence: [string, ...string[]] = [ref, ...new Set([local.firstRef, ...local.evidence].filter(value => value !== ref))];
      const { selected, entries } = resolveStrategyGraph({
        graph, mode: 'active',
        facts: { learned: { value: !!learned, evidence }, probe: { value: !!probe, evidence } },
        planners: { apply_observed_cell_rewrite: () => learned ?? null, test_inconsistent_cell: () => probe ?? null },
      });
      if (!selected) return null;
      const strategy = selected.id, cell = selected.plan, label = windowRelationStrategies[strategy], parent = 'G_official_completion';
      const [left, top] = cell.box;
      const x = left + Math.floor(w / 2), y = top + Math.floor(h / 2);
      const pointBinding = await ObservedInputDomain.makeLocusWitness(observation, rows, [x, y], { reason: label, evidence });
      if (!pointBinding) return null;
      const action = { action_ref: 'ACTION6', data: { x, y } }, actions = [action];
      const objective = { kind: 'reconcile_repeated_window_examples', scope: ref.split(':revision:', 1)[0]!,
        subjects: ['example_windows', 'inconsistent_cell'], parentObjective: parent,
        satisfactionContract: 'official_progress_after_reconciling_local_constraints' };
      const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence };
      const id = 'window-relation:' + need.id;
      return { status: 'proposed', kind: windowRelationId, actions, local, cell, field: fieldBox, needId: need.id,
        binding: { observation_ref: ref, level_epoch: observation.level_epoch }, steps: [{ action, point_binding: pointBinding, expected_after: cell.expected }],
        sicSituationCard: { strategy, need: 'Make the field agree with its repeated examples', situation: label, evidence, agenda: entries,
          mode: cell.expected === null ? 'exploration' : 'assimilation', cell: cell.box,
          references: cell.sourcePoints.map(position => cellBox(position, field.size)) },
        question: { reason: label, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: label, relations: ['contributes_to:' + parent] }],
        sicLocalDecision: { strategy, objective: { id, label, parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: label,
          preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
    },
    before(proposal, index, packet, observation) {
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref
        && uniformValue(packet.frame_rows, proposal.cell.box) === proposal.cell.actual;
      return { admitted, reason: admitted ? 'current_cell_and_example_bound' : 'cell_or_example_changed' };
    },
    after(proposal, _index, before, after, _first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true, reason: 'official_boundary',
        sic_need: { id: proposal.needId, status: 'satisfied' } };
      const expected = proposal.cell.expected;
      const matched = expected === null ? null : uniformValue(second, proposal.cell.box) === expected;
      return { matched, seal_prefix: true, reason: 'compare_local_cell_return' };
    },
    record(before, after, _command, first, second, proposal) {
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const { local, cell, field } = proposal;
      const value = uniformValue(second, cell.box);
      const [left, top, right, bottom] = field;
      let outsideChanged = false;
      for (let y = Math.max(0, top); y <= Math.min(bottom, first.length - 1); y++) {
        for (let x = Math.max(0, left); x <= Math.min(right, first[y]!.length - 1); x++) {
          if (!inside(cell.box, x, y) && first[y]![x] !== second[y]?.[x]) outsideChanged = true;
        }
      }
      const localRewrite = value !== null && value !== cell.actual && !outsideChanged;
      state = { ...local, count: local.count + 1, evidence: [...local.evidence.slice(-4), after.observation_ref],
        rejected: localRewrite ? local.rejected : [...local.rejected, cell.address + ',' + cell.actual],
        effects: localRewrite ? [...local.effects, { address: cell.address, from: cell.actual, to: value }] : local.effects };
      return { events: [] };
    },
    state: () => ({ state }),
    restore(value: NativeRecord) { state = structuredClone(value.state as State | null); },
  };
}
