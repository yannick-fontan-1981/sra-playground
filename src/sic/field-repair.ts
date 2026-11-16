import { measuredFields, periodicHypotheses, symmetryEvidence, type ConstraintTable,
  type RegularField, type SymmetryPolicy } from '../logos-engine/v6-field-constraints.ts';
import { ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeFamily, NativePoint, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { resolveStrategyGraph, compileStrategyGraph } from './strategy-agenda.ts';
import { sicNeedId } from './need-identity.ts';
import { independentPredictionSupport } from './independent-prediction.ts';
import { fieldConsensus } from './field-consensus.ts';
import { maximumCommittedActions } from './plan-step.ts';
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

type Repair = { point: NativePoint; size: NativePoint; before: number; expected: number; support: number;
  bounds: readonly [number, number, number, number]; sources: { point: NativePoint; value: number }[] };
type Fit = { table: ConstraintTable; unchanged: number };
type ObservedRepair = { point: NativePoint; before: number; expected: number; ref: string };

type FieldProposal = NativeProposal & { repair: Repair; route?: Repair[]; sicLocalDecision: {
  strategy: string; objective: { id: string; label: string; parent: string }; need: SicNeed;
} };

function repairs(fields: readonly RegularField[], policy: SymmetryPolicy) {
  const alternatives: Map<string, Repair>[] = [];
  for (const field of fields) {
    const symmetry: Fit[] = policy.isometries.flatMap(name => {
      const reading = symmetryEvidence(field, name);
      return reading ? [{ table: reading[0], unchanged: Number(reading[1].unchanged_pairs) }] : [];
    });
    const periodic: Fit[] = Array.from(periodicHypotheses(field, policy.maximum_hypothetically_omitted_values ?? 0),
      ([, table, evidence]) => ({ table, unchanged: Number(evidence.unchanged_pairs) }));
    const hypotheses = [...symmetry, ...periodic];
    const consensus: Fit[] = fieldConsensus(field, policy.isometries);
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
        const sources = [...value.sources].flatMap(address => {
          const actual = field.values.get(address);
          if (actual === undefined) return [];
          const point = address.split(',').map(Number) as [number, number];
          return [{ point, value: actual }];
        });
        const repair = { point, size: field.size, before: value.actual, expected, support: value.sources.size, bounds, sources };
        return [[JSON.stringify([point, field.size, expected]), repair]];
      })));
    }
  }
  const [first, ...others] = alternatives;
  if (!first) return [];
  return [...first].filter(([key]) => others.every(candidate => candidate.has(key))).map(([, value]) => value)
    .sort((left, right) => right.support - left.support || left.point[0] - right.point[0] || left.point[1] - right.point[1]);
}

function hasValue(rows: NativeRows, [x, y]: NativePoint, [width, height]: NativePoint, value: number): boolean {
  for (let row = y; row < y + height; row++) for (let column = x; column < x + width; column++) {
    if (rows[row]?.[column] !== value) return false;
  }
  return true;
}

const trialKey = (repair: Repair) => JSON.stringify([repair.point, repair.before, repair.expected]);

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
      const fields = measuredFields(observation);
      const findCommand = ({ point: [x, y], size: [width, height] }: Repair) => {
        const bound = inputs.filter(command => command.action_ref === 'ACTION6' && command.data.x! >= x && command.data.x! < x + width
          && command.data.y! >= y && command.data.y! < y + height);
        return bound.length === 1 ? bound[0]! : null;
      };
      for (const repair of repairs(fields, policy)) {
        if (attempted.includes(trialKey(repair))) continue;
        const command = findCommand(repair);
        if (!command) continue;
        const analogous = measured.filter(example => example.before === repair.before);
        const hypothesis = 'observed_local_rewrite';
        const support = independentPredictionSupport([hypothesis], analogous.map(example => ({
          address: example.point.join(','), ref: example.ref, expected: example.expected,
          actual: example.expected, hypotheses: [hypothesis],
        })))[0]!.matches;
        const effectKnown = support.length >= 2 && support.some(example => example.expected === repair.expected);
        const proof: [string, ...string[]] = [ref, ...support.map(example => example.ref)];
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
        const route = [repair], actions = [command], steps = [{ action: command, expected_after: { value: repair.expected }, point_binding: locus }];
        if (support.length && locus && fields.length === 1) {
          const field = fields[0]!, projected = { ...field, values: new Map(field.values) };
          const changed = new Set<string>();
          for (let index = 1; index < Math.min(remaining, maximumCommittedActions); index++) {
            const previous = route[index - 1]!, address = previous.point.join(',');
            changed.add(address);
            projected.values.set(address, previous.expected);
            const next = repairs([projected], policy).find(option => !attempted.includes(trialKey(option)) && findCommand(option));
            if (!next || next.before !== repair.before || changed.has(next.point.join(',')) || !next.sources.length
              || next.sources.some(source => changed.has(source.point.join(',')))) break;
            const action = findCommand(next)!;
            const binding = await ObservedInputDomain.makeLocusWitness(observation, rows, [action.data.x!, action.data.y!],
              { reason: label, evidence: proof });
            if (!binding) break;
            route.push(next);
            actions.push(action);
            steps.push({ action, expected_after: { value: next.expected }, point_binding: binding });
          }
        }
        return { status: 'proposed', kind: fieldRepairId, repair, actions,
          ...(route.length > 1 ? { route } : {}),
          constraint_plan: { cell_size: repair.size, projection_bbox: repair.bounds,
            selected_cells: route.map(cell => ({ p: cell.point, before: cell.before, equal: [cell.expected], expected_value: cell.expected })) },
          steps,
          facts, binding: { observation_ref: ref, level_epoch: observation.level_epoch, levels_completed: observation.levels_completed },
          compositions: [{ id, role: 'information_question', observed: false, open_question: label, relations: [`contributes_to:${objective}`] }],
          question: { reason: label, hypothesis_refs: proof }, route_refs: proof,
          sicLocalDecision: { strategy: selected.id, objective: { id, label, parent: objective }, need },
          bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: objective, preserve_refs: [], purpose: label,
            preconditions: facts, evidence: proof, actions, outcome_guard: { path: ['value'], contains: id } } };
      }
      return null;
    },
    before(proposal, index, packet, observation) {
      const cell = proposal.route?.[index];
      const admitted = index === 0 ? proposal.binding?.observation_ref === observation.observation_ref
        : !!cell && proposal.binding?.level_epoch === observation.level_epoch
          && hasValue(packet.frame_rows, cell.point, cell.size, cell.before)
          && cell.sources.every(source => hasValue(packet.frame_rows, source.point, cell.size, source.value));
      return { admitted, reason: admitted ? 'current_repair_target_bound' : 'repair_observation_changed' };
    },
    after(proposal, index, before, after, oldRows, newRows) {
      const boundary = before.level_epoch !== after.level_epoch || before.levels_completed !== after.levels_completed
        || before.state !== after.state;
      if (boundary) return { matched: null, seal_prefix: true, reason: 'official_boundary' };
      const { fieldMatched, peripheralChanges } = checkRewrite(proposal.route?.[index] ?? proposal.repair, oldRows, newRows);
      return { matched: fieldMatched, seal_prefix: !fieldMatched || index + 1 === proposal.actions.length,
        reason: fieldMatched ? 'local_correspondence_restored' : 'local_repair_prediction_contradicted',
        peripheral_changes: peripheralChanges, sic_need: { id: proposal.sicLocalDecision.need.id, status: fieldMatched ? 'satisfied' : 'refuted' } };
    },
    record(before, after, _command, oldRows, newRows, proposal, index) {
      if (level !== before.level_epoch) { level = before.level_epoch; attempts = []; known = []; }
      const repair = proposal.route?.[index] ?? proposal.repair;
      const { point, before: value, expected } = repair;
      attempts.push(trialKey(repair));
      if (before.level_epoch === after.level_epoch && before.state === after.state && checkRewrite(repair, oldRows, newRows).fieldMatched) {
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
