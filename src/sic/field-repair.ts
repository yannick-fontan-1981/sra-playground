import { correspondences, measuredFields, periodicHypotheses, symmetryEvidence, type ConstraintTable,
  type RegularField, type SymmetryPolicy } from '../logos-engine/v6-field-constraints.ts';
import { ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeFamily, NativePoint, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { resolveStrategyGraph, compileStrategyGraph } from './strategy-agenda.ts';
import { sicNeedId } from './need-identity.ts';
import type { SicNeed } from './need-registry.ts';

export const fieldRepairId = 'sic_field_repair';
const objective = 'G_official_completion';
const needKind = 'verify_local_correspondence';
const graph = compileStrategyGraph({
  id: needKind, version: 1, order: 'FALLBACK', priorities: ['test_local_repair', 'apply_local_repair'],
  strategies: {
    test_local_repair: [{ fact: 'unanimousTarget', expected: true, label: 'Supported correspondences agree on a target value' },
      { fact: 'effectKnown', expected: false, label: 'The local command effect needs testing' }],
    apply_local_repair: [{ fact: 'unanimousTarget', expected: true, label: 'Supported correspondences agree on a target value' },
      { fact: 'effectKnown', expected: true, label: 'This local effect has been witnessed at distinct sites' }],
  },
}, ['unanimousTarget', 'effectKnown']);

type Repair = { point: NativePoint; size: NativePoint; before: number; expected: number; support: number; bounds: readonly [number, number, number, number] };
type Fit = { table: ConstraintTable; unchanged: number };
type ObservedRepair = { point: NativePoint; before: number; expected: number; ref: string };

function repeatedValues(field: RegularField, groups: Iterable<string[]>): Fit | null {
  const table: ConstraintTable = new Map();
  const targetValues = new Set<number>();
  let unchanged = 0;
  for (const cells of groups) {
    const values = new Map<number, string[]>();
    for (const cell of cells) {
      const value = field.values.get(cell)!;
      const matching = values.get(value) ?? [];
      matching.push(cell);
      values.set(value, matching);
    }
    const majority = [...values].find(([, sites]) => sites.length >= 2 && sites.length * 2 > cells.length);
    if (!majority) return null;
    const [expected, sites] = majority;
    unchanged += sites.length;
    targetValues.add(expected);
    for (const cell of cells) {
      const actual = field.values.get(cell)!;
      if (actual !== expected) table.set(cell, { actual, eq: new Set([expected]), ne: new Set(), sources: new Set(sites) });
    }
  }
  return table.size > 0 && targetValues.size > 1 && table.size * 3 < unchanged ? { table, unchanged } : null;
}

function periodicConsensus(field: RegularField): Fit[] {
  const options: Fit[] = [];
  for (let width = 1; width * 2 <= field.xs.length; width++) {
    for (let height = 1; height * 2 <= field.ys.length; height++) {
      const groups = new Map<string, string[]>();
      for (const [xIndex, x] of field.xs.entries()) {
        for (const [yIndex, y] of field.ys.entries()) {
          const key = [xIndex % width, yIndex % height].join(',');
          const group = groups.get(key) ?? [];
          group.push([x, y].join(','));
          groups.set(key, group);
        }
      }
      const fit = repeatedValues(field, groups.values());
      if (fit) options.push(fit);
    }
  }
  return options;
}

function reflectionConsensus(field: RegularField, isometries: readonly string[]): Fit[] {
  const { xs, ys, values } = field;
  const key = ([x, y]: NativePoint) => [xs[x], ys[y]].join(',');
  const supported = isometries.map(name => correspondences(xs.length, ys.length, name).map(([a, b]) => [key(a), key(b)]))
    .filter(pairs => pairs.length && pairs.filter(([a, b]) => values.get(a!) !== values.get(b!)).length * 3 < pairs.length);
  const options: Fit[] = [];
  for (const [index, first] of supported.entries()) {
    for (const second of supported.slice(index + 1)) {
      const orbits = new Map([...values.keys()].map(cell => [cell, [cell]]));
      for (const [a, b] of [...first, ...second]) {
        const left = orbits.get(a!)!, right = orbits.get(b!)!;
        if (left === right) continue;
        left.push(...right);
        for (const cell of right) orbits.set(cell, left);
      }
      // A point fixed by both transformations contributes no independent observation.
      const groups = [...new Set(orbits.values())].filter(group => group.length > 1);
      const fit = repeatedValues(field, groups);
      if (fit) options.push(fit);
    }
  }
  return options;
}
type FieldProposal = NativeProposal & { repair: Repair; sicLocalDecision: {
  strategy: string; objective: { id: string; label: string; parent: string }; need: SicNeed;
} };

function repairs(observation: Parameters<NativeFamily['propose']>[0], policy: SymmetryPolicy) {
  const alternatives: Map<string, Repair>[] = [];
  for (const field of measuredFields(observation)) {
    const symmetry: Fit[] = policy.isometries.flatMap(name => {
      const reading = symmetryEvidence(field, name);
      return reading ? [{ table: reading[0], unchanged: Number(reading[1].unchanged_pairs) }] : [];
    });
    const periodic: Fit[] = Array.from(periodicHypotheses(field, policy.maximum_hypothetically_omitted_values ?? 0),
      ([, table, evidence]) => ({ table, unchanged: Number(evidence.unchanged_pairs) }));
    const hypotheses = [...symmetry, ...periodic];
    const consensus = [...periodicConsensus(field), ...reflectionConsensus(field, policy.isometries)];
    const fits = hypotheses.length ? [...hypotheses, ...consensus.filter(fit => hypotheses.every(other =>
      fit.table.size < other.table.size))] : consensus;
    const undominated = fits.filter(fit => !fits.some(other => other !== fit && other.table.size < fit.table.size
      && (consensus.includes(other) || !symmetry.includes(fit) && other.unchanged > fit.unchanged)));
    const bounds = [field.xs[0]!, field.ys[0]!, field.xs.at(-1)! + field.size[0], field.ys.at(-1)! + field.size[1]] as const;
    for (const { table } of undominated) {
      alternatives.push(new Map([...table].flatMap(([cell, value]) => {
        if (value.eq.size !== 1 || value.eq.has(value.actual)) return [];
        const expected = [...value.eq][0]!;
        const point = cell.split(',').map(Number) as [number, number];
        const repair = { point, size: field.size, before: value.actual, expected, support: value.sources.size, bounds };
        return [[JSON.stringify([point, field.size, expected]), repair]];
      })));
    }
  }
  const [first, ...others] = alternatives;
  if (!first) return [];
  return [...first].filter(([key]) => others.every(candidate => candidate.has(key))).map(([, value]) => value)
    .sort((left, right) => right.support - left.support || left.point[0] - right.point[0] || left.point[1] - right.point[1]);
}

function checkRewrite(repair: Repair, before: NativeRows, after: NativeRows) {
  const [x, y] = repair.point, [width, height] = repair.size;
  const [left, top, right, bottom] = repair.bounds;
  let fieldMatched = before.length === after.length;
  let peripheralChanges = 0;
  before.forEach((row, yy) => row.forEach((value, xx) => {
    const returned = after[yy]?.[xx];
    if (xx < left || right <= xx || yy < top || bottom <= yy) {
      if (returned !== value) peripheralChanges++;
      return;
    }
    const target = x <= xx && xx < x + width && y <= yy && yy < y + height;
    if (returned !== (target ? repair.expected : value)) fieldMatched = false;
  }));
  return { fieldMatched, peripheralChanges };
}

export function createSicFieldRepair(policy: SymmetryPolicy): NativeFamily<FieldProposal> {
  let level: number | null = null;
  let attempts: string[] = [];
  let known: ObservedRepair[] = [];
  return {
    id: fieldRepairId,
    async propose(observation, rows, inputs, remaining) {
      if (remaining < 1 || !observation.available_action_refs.includes('ACTION6')) return null;
      const ref = observation.observation_ref;
      const attempted = level === observation.level_epoch ? attempts : [];
      const measured = level === observation.level_epoch ? known : [];
      for (const repair of repairs(observation, policy)) {
        const [x, y] = repair.point, [width, height] = repair.size;
        if (attempted.includes(JSON.stringify([repair.point, repair.before, repair.expected]))) continue;
        const bound = inputs.filter(command => command.action_ref === 'ACTION6' && command.data.x! >= x && command.data.x! < x + width
          && command.data.y! >= y && command.data.y! < y + height);
        if (bound.length !== 1) continue;
        const command = bound[0]!;
        const analogous = measured.filter(example => example.before === repair.before);
        const effectKnown = new Set(analogous.map(example => example.point.join(','))).size >= 2
          && analogous.some(example => example.expected === repair.expected);
        const proof: [string, ...string[]] = [ref, ...analogous.map(example => example.ref)];
        const { selected } = resolveStrategyGraph({ graph, mode: 'active',
          facts: { unanimousTarget: { value: true, evidence: [ref] }, effectKnown: { value: effectKnown, evidence: proof } },
          planners: { test_local_repair: () => command, apply_local_repair: () => command } });
        if (!selected) continue;
        const goal = { kind: needKind, scope: ref.split(':revision:', 1)[0]!, subjects: [JSON.stringify(repair.point)],
          parentObjective: objective, satisfactionContract: 'observe_expected_local_value_and_preserve_the_other_field_cells' };
        const need: SicNeed = { ...goal, id: sicNeedId(goal), status: 'assigned', evidence: proof };
        const id = `repair:${need.id}`;
        const label = effectKnown ? 'Restore a correspondence using an effect observed at other sites'
          : 'Test whether this command restores the correspondence in the selected cell';
        const facts = { unanimous_target: true, local_command_bound: true };
        const locus = await ObservedInputDomain.makeLocusWitness(observation, rows, [command.data.x!, command.data.y!], { reason: label, evidence: proof });
        return { status: 'proposed', kind: fieldRepairId, repair, actions: [command],
          constraint_plan: { cell_size: repair.size, projection_bbox: repair.bounds,
            selected_cells: [{ p: repair.point, before: repair.before, equal: [repair.expected], expected_value: repair.expected }] },
          steps: [{ action: command, expected_after: { value: repair.expected }, point_binding: locus }],
          facts, binding: { observation_ref: ref, level_epoch: observation.level_epoch, levels_completed: observation.levels_completed },
          compositions: [{ id, role: 'information_question', observed: false, open_question: label, relations: [`contributes_to:${objective}`] }],
          question: { reason: label, hypothesis_refs: proof }, route_refs: proof,
          sicLocalDecision: { strategy: selected.id, objective: { id, label, parent: objective }, need },
          bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: objective, preserve_refs: [], purpose: label,
            preconditions: facts, evidence: proof, actions: [command], outcome_guard: { path: ['value'], contains: id } } };
      }
      return null;
    },
    before(proposal, index, _packet, observation) {
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref;
      return { admitted, reason: admitted ? 'current_repair_target_bound' : 'repair_observation_changed' };
    },
    after(proposal, _index, before, after, oldRows, newRows) {
      const boundary = before.level_epoch !== after.level_epoch || before.levels_completed !== after.levels_completed
        || before.state !== after.state;
      if (boundary) return { matched: null, seal_prefix: true, reason: 'official_boundary' };
      const { fieldMatched, peripheralChanges } = checkRewrite(proposal.repair, oldRows, newRows);
      return { matched: fieldMatched, seal_prefix: true, reason: fieldMatched ? 'local_correspondence_restored' : 'local_repair_prediction_contradicted',
        peripheral_changes: peripheralChanges, sic_need: { id: proposal.sicLocalDecision.need.id, status: fieldMatched ? 'satisfied' : 'refuted' } };
    },
    record(before, after, _command, oldRows, newRows, proposal) {
      if (level !== before.level_epoch) { level = before.level_epoch; attempts = []; known = []; }
      const { point, before: value, expected } = proposal.repair;
      attempts.push(JSON.stringify([point, value, expected]));
      if (before.level_epoch === after.level_epoch && before.state === after.state && checkRewrite(proposal.repair, oldRows, newRows).fieldMatched) {
        known.push({ point, before: value, expected, ref: after.observation_ref });
      }
      return { events: [] };
    },
    state: () => ({ level, attempts, known }),
    restore(state: NativeRecord) {
      level = state.level as number | null;
      attempts = [...state.attempts as string[]];
      known = structuredClone(state.known as ObservedRepair[]);
    },
  };
}
