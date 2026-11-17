import { acceptsConstraint, extractFields, fieldConstraints, induceFields, type Constraint } from '../logos-engine/v6-field-constraints.ts';
import { ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeFamily, NativePoint, NativeProgramHandle, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { navigationPrimitives } from './navigation-primitives.ts';
import { sicNeedId } from './need-identity.ts';
import { maximumCommittedActions } from './plan-step.ts';
import { chooseInteraction, interactionModule } from './observed-interaction-card.ts';
import { actionFootprint, binaryChanges, followsBinaryEffect, readBinaryField, solveBinaryField, type BinaryField, type FieldChange } from './binary-field-effects.ts';

export const windowRelationId = 'sic_reconcile_observed_fields';
export const learnWindowRelationId = 'sic_learn_window_relation';
export const windowRelationStrategies = {
  P02: navigationPrimitives.P02,
  P05: navigationPrimitives.P05,
  test_inconsistent_cell: 'Test a cell that disagrees with the examples',
  apply_observed_cell_rewrite: 'Apply a change already seen on comparable cells',
} as const;

type Rule = Parameters<typeof fieldConstraints>[1];
type GroupedEffects = { marked: boolean; ordinary: boolean; stopped: boolean };
type State = { epoch: number; rule: Rule; size: NativePoint; pitch: NativePoint; rejected: string[];
  effects: { address: string; from: number; to: number }[]; firstRef: string; evidence: string[]; count: number;
  recalled?: boolean; grouped?: GroupedEffects };
type Transfer = { epoch: number; rule: Rule; evidence: string[] };
type Cell = { box: NativeBox; address: string; actual: number; expected: number | null; intermediate: boolean; sourcePoints: NativePoint[];
  binary?: { marked: boolean; changes: FieldChange[] } };
type ReferenceCell = { box: NativeBox; rows: NativeRows };
type Proposal = NativeProposal & { local: State; cell: Cell; field: NativeBox; route?: { cell: Cell; references: ReferenceCell[] }[]; needId: string };
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

function fieldBounds(field: ReturnType<typeof extractFields>[number]): NativeBox {
  const [w, h] = field.size, places = field.groups.flatMap(group => [...group.keys()].map(point));
  const xs = places.map(p => p[0]), ys = places.map(p => p[1]);
  return [Math.min(...xs) - 1, Math.min(...ys) - 1, Math.max(...xs) + w, Math.max(...ys) + h];
}

function fieldUnchangedOutside(bounds: NativeBox, cell: NativeBox, first: NativeRows, second: NativeRows): boolean {
  const [left, top, right, bottom] = bounds;
  for (let y = Math.max(0, top); y <= Math.min(bottom, first.length - 1); y++) {
    for (let x = Math.max(0, left); x <= Math.min(right, first[y]!.length - 1); x++) {
      if (!inside(cell, x, y) && first[y]![x] !== second[y]?.[x]) return false;
    }
  }
  return true;
}

function cellRows(rows: NativeRows, [l, t, r, b]: NativeBox): NativeRows | null {
  if (l < 0 || t < 0 || b >= rows.length) return null;
  const values = rows.slice(t, b + 1).map(row => row.slice(l, r + 1));
  return values.every(row => row.length === r - l + 1) ? values : null;
}

function observedSuccessors(effects: State['effects']): Map<number, number> {
  const evidence = new Map<number, { destinations: Set<number>; addresses: Set<string> }>();
  for (const { from, to, address } of effects) {
    const entry = evidence.get(from) ?? { destinations: new Set<number>(), addresses: new Set<string>() };
    entry.destinations.add(to);
    entry.addresses.add(address);
    evidence.set(from, entry);
  }
  const successors = new Map<number, number>();
  for (const [from, { destinations, addresses }] of evidence) {
    if (destinations.size === 1 && addresses.size >= 2) successors.set(from, [...destinations][0]!);
  }
  return successors;
}

function nextObservedValue(constraint: Constraint, address: string, successors: ReadonlyMap<number, number>,
  rejected: ReadonlySet<string>): number | null | undefined {
  const { actual } = constraint, expected = successors.get(actual);
  if (expected === undefined) return null;
  const seen = new Set([actual]);
  let value: number | undefined = expected;
  while (value !== undefined) {
    if (acceptsConstraint(constraint, value)) return expected;
    if (seen.has(value) || rejected.has(address + ',' + value)) return undefined;
    seen.add(value);
    value = successors.get(value);
  }
  return expected;
}

function groupedCells(field: BinaryField, effects: GroupedEffects): Cell[] {
  const solution = solveBinaryField(field);
  if (!solution?.length) return [];
  const planned = [...solution].sort((a, b) => Number(b.marked) - Number(a.marked));
  const pending = !effects.marked ? true : !effects.ordinary ? false : null;
  const choices = pending === null ? planned : [planned.find(control => control.marked === pending
    && (!pending || actionFootprint(field, control).length > 1)) ?? field.controls.find(control => control.marked === pending
    && (!pending || actionFootprint(field, control).length > 1))].filter(control => control !== undefined);
  return choices.map(control => ({ box: control.box, address: control.address, actual: control.value,
    expected: pending === null ? field.colors.find(color => color !== control.value)! : null,
    intermediate: false, binary: { marked: control.marked, changes: binaryChanges(field, control) },
    sourcePoints: [...new Set(actionFootprint(field, control).flatMap(item => [...(field.constraints.get(item.address)?.sources ?? [])]))].map(point) }));
}

export function createSicWindowRelation(family = windowRelationId): NativeFamily<Proposal> {
  const learns = family === learnWindowRelationId;
  let state: State | null = null;
  let transfer: Transfer | null = null;
  let decide: NativeProgramHandle | undefined;
  return {
    id: family,
    async attachPrograms(registry) {
      decide = await registry.registerProgram(chooseInteraction, {}, await interactionModule());
    },
    async propose(observation, rows, _inputs, remaining, execution) {
      if (remaining < 1 || !observation.available_action_refs.includes('ACTION6')) return null;
      let prior = state?.epoch === observation.level_epoch ? state : null;
      if (prior && (prior.grouped?.stopped || prior.count >= (prior.grouped ? 64 : 24))) return null;
      if (learns && !prior && !transfer) {
        const click = await execution?.readPriorClickScene?.((first, original, action) => {
          const candidates = induceFields(extractFields(original, first)).flatMap(({ field, rule }) => {
            const table = fieldConstraints(field, rule);
            if (!table?.size) return [];
            const addresses = [...table].flatMap(([address, constraint]) => {
              const box = cellBox(point(address), field.size);
              return !acceptsConstraint(constraint, constraint.actual) && inside(box, action.data.x!, action.data.y!) ? [{ address, box }] : [];
            });
            if (addresses.length !== 1) return [];
            const { address, box } = addresses[0]!, from = uniformValue(first, box), to = uniformValue(rows, box);
            if (from === null || to === null || from === to || !fieldUnchangedOutside(fieldBounds(field), box, first, rows)) return [];
            return [{ rule, size: field.size, pitch: field.pitch, effects: [{ address, from, to }], sig: constraintSignature(table) }];
          });
          const match = candidates[0];
          return match && candidates.every(c => c.sig === match.sig) ? match : null;
        });
        if (!click || click.afterRef !== observation.observation_ref || click.levelEpoch !== observation.level_epoch) return null;
        const { rule, size, pitch, effects } = click.scene;
        prior = { epoch: observation.level_epoch, rule, size, pitch, effects, rejected: [],
          firstRef: click.beforeRef, evidence: [click.afterRef], count: 1 };
      }
      const fields = extractFields(observation, rows);
      const induced = prior ? [] : induceFields(fields);
      const recalled = !prior && !induced.length && transfer?.epoch === observation.level_epoch - 1 ? transfer : null;
      const options = prior
        ? fields.filter(field => equalPoint(field.size, prior.size) && equalPoint(field.pitch, prior.pitch)).map(field => ({ field, rule: prior.rule }))
        : recalled ? fields.map(field => ({ field, rule: recalled.rule })) : induced;
      const candidates = options.flatMap(({ field, rule }) => {
        const table = fieldConstraints(field, rule);
        return table?.size ? [{ field, rule, table }] : [];
      });
      const current = candidates[0];
      const marked = !learns && (recalled || prior?.grouped) ? options.flatMap(({ field, rule }) => {
        const binary = readBinaryField(field, rule);
        return binary ? [{ field, rule, binary }] : [];
      }) : [];
      const grouped = marked.length === 1 ? marked[0] : null;
      if (!grouped && (prior?.grouped || !current
        || candidates.some(({ table }) => constraintSignature(table) !== constraintSignature(current.table)))) return null;
      const { rule, field } = grouped ?? current!;
      const local: State = prior ?? { epoch: observation.level_epoch, rule, size: field.size, pitch: field.pitch, rejected: [],
        effects: [], firstRef: observation.observation_ref, evidence: recalled?.evidence ?? [], count: 0,
        ...(recalled ? { recalled: true } : {}), ...(grouped ? { grouped: { marked: false, ordinary: false, stopped: false } } : {}) };
      const [w, h] = field.size, fieldBox = fieldBounds(field);
      const successors = observedSuccessors(local.effects), rejected = new Set(local.rejected);
      const cells: Cell[] = grouped && local.grouped ? groupedCells(grouped.binary, local.grouped) : [...current!.table].flatMap(([address, constraint]) => {
        if (acceptsConstraint(constraint, constraint.actual) || rejected.has(address + ',' + constraint.actual)) return [];
        const expected = nextObservedValue(constraint, address, successors, rejected);
        if (expected === undefined) return [];
        return [{ box: cellBox(point(address), field.size), address, actual: constraint.actual, expected,
          intermediate: expected !== null && !acceptsConstraint(constraint, expected), sourcePoints: [...constraint.sources].map(point) }];
      }).sort((a, b) => b.sourcePoints.length - a.sourcePoints.length || pointOrder(point(a.address), point(b.address)));
      const learned = cells.find(cell => cell.expected !== null);
      const probe = cells.find(cell => cell.expected === null);
      const ref = observation.observation_ref;
      const proof = [local.firstRef, ...local.evidence, ...(local.recalled ? transfer?.evidence ?? [] : [])];
      const evidence: [string, ...string[]] = [ref, ...new Set(proof.filter(value => value !== ref))];
      const mode = execution?.reasoningMode ?? 'exploration';
      const facts = { repeatSupportedInteraction: !!learned, probeNeededInteraction: !!probe, mode };
      const decision = await decide?.run({ situation: facts }, { signal: execution?.signal });
      if (decision?.result !== 'P02' && decision?.result !== 'P05') return null;
      const strategy = decision.result;
      const cell = strategy === 'P02' ? learned : probe;
      if (!cell) return null;
      const label = strategy === 'P02' ? windowRelationStrategies.apply_observed_cell_rewrite : windowRelationStrategies.test_inconsistent_cell;
      const situation = cell.binary ? strategy === 'P05' ? 'Measure which value carriers this control changes'
        : 'Apply a measured effect as part of the full field repair'
        : cell.intermediate ? 'Take the verified intermediate step and check the remaining color constraint'
        : local.recalled && cell.sourcePoints.length > 1 ? 'Reconcile the agreeing window constraints on this shared cell' : label;
      const parent = 'G_official_completion';
      const [left, top] = cell.box;
      const x = left + Math.floor(w / 2), y = top + Math.floor(h / 2);
      const pointBinding = await ObservedInputDomain.makeLocusWitness(observation, rows, [x, y], { reason: label, evidence });
      if (!pointBinding) return null;
      const action = { action_ref: 'ACTION6', data: { x, y } }, actions = [action];
      const steps = [{ action, point_binding: pointBinding, expected_after: cell.expected }];
      const referencesFor = (cell: Cell) => cell.sourcePoints.flatMap(point => {
        const box = cellBox(point, field.size), observed = cellRows(rows, box);
        return observed ? [{ box, rows: observed }] : [];
      });
      const route = [{ cell, references: referencesFor(cell) }];
      if (strategy === 'P02' && !cell.intermediate && !cell.binary?.marked) {
        for (const next of cells.slice(cells.indexOf(cell) + 1)) {
          if (next.expected === null) continue;
          if (next.binary?.marked || route.length >= Math.min(remaining, maximumCommittedActions, (local.grouped ? 64 : 24) - local.count)) break;
          const references = referencesFor(next);
          if (references.length !== next.sourcePoints.length || next.sourcePoints.some(point =>
            route.some(leg => equalPoint(point, [leg.cell.box[0], leg.cell.box[1]])))) break;
          const [l, t] = next.box, x = l + Math.floor(w / 2), y = t + Math.floor(h / 2);
          const witness = await ObservedInputDomain.makeLocusWitness(observation, rows, [x, y], { reason: label, evidence });
          const command = { action_ref: 'ACTION6', data: { x, y } };
          route.push({ cell: next, references });
          actions.push(command);
          steps.push({ action: command, point_binding: witness, expected_after: next.expected });
          if (next.intermediate) break;
        }
      }
      const objective = { kind: 'reconcile_repeated_window_examples', scope: ref.split(':revision:', 1)[0]!,
        subjects: ['example_windows', 'inconsistent_cell'], parentObjective: parent,
        satisfactionContract: 'official_progress_after_reconciling_local_constraints' };
      const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence };
      const id = 'window-relation:' + need.id;
      return { status: 'proposed', kind: family, actions, local, cell, field: fieldBox, needId: need.id,
        ...(route.length > 1 ? { route } : {}),
        binding: { observation_ref: ref, level_epoch: observation.level_epoch }, steps,
        sicSrcDecision: { workflow: decision.receipt.workflow, hash: decision.receipt.src_hash,
          instructions: decision.receipt.instructions, edited: 'edited' in decision.receipt && decision.receipt.edited === true, situation: facts },
        sicSituationCard: { strategy, need: 'Make the field agree with its repeated examples', situation, evidence, agenda: [],
          mode, cell: cell.box, triggerCard: decision.receipt.workflow,
          references: cell.sourcePoints.map(position => cellBox(position, field.size)),
          ...(cell.binary ? { affected: cell.binary.changes.map(change => change.box) } : {}) },
        question: { reason: label, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: label, relations: ['contributes_to:' + parent] }],
        sicLocalDecision: { strategy, objective: { id, label, parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: label,
          preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
    },
    before(proposal, index, packet, observation) {
      const leg = proposal.route?.[index], cell = leg?.cell ?? proposal.cell;
      const bound = index === 0 ? proposal.binding?.observation_ref === observation.observation_ref
        : proposal.local.epoch === observation.level_epoch && !!leg
          && leg.references.every(({ box, rows }) => JSON.stringify(cellRows(packet.frame_rows, box)) === JSON.stringify(rows));
      const value = cell.binary ? packet.frame_rows[cell.box[1]]?.[cell.box[0]] : uniformValue(packet.frame_rows, cell.box);
      const admitted = bound && value === cell.actual;
      return { admitted, reason: admitted ? 'current_cell_and_example_bound' : 'cell_or_example_changed' };
    },
    after(proposal, index, before, after, first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true, reason: 'official_boundary',
        sic_need: { id: proposal.needId, status: 'satisfied' } };
      const cell = proposal.route?.[index]?.cell ?? proposal.cell, expected = cell.expected;
      if (cell.binary) {
        const matched = followsBinaryEffect(proposal.field, cell.binary.changes, first, second);
        return { matched, seal_prefix: !matched || index + 1 >= proposal.actions.length,
          reason: matched ? 'observed_field_footprint_confirmed' : 'observed_field_footprint_contradicted' };
      }
      const matched = expected === null ? null : uniformValue(second, cell.box) === expected;
      return { matched, seal_prefix: !matched || index + 1 >= proposal.actions.length
        || !fieldUnchangedOutside(proposal.field, cell.box, first, second), reason: 'compare_local_cell_return' };
    },
    record(before, after, _command, first, second, proposal, index) {
      const { field } = proposal, cell = proposal.route?.[index]?.cell ?? proposal.cell;
      const local = (index > 0 && state?.epoch === before.level_epoch ? state : null) ?? proposal.local;
      if (after.levels_completed > before.levels_completed) {
        transfer = { epoch: before.level_epoch, rule: local.rule, evidence: [local.firstRef, before.observation_ref, after.observation_ref] };
        return { events: [], reviewEvidence: 'The field matched the window constraints and advanced the level.' };
      }
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      if (cell.binary && local.grouped) {
        const matched = followsBinaryEffect(field, cell.binary.changes, first, second);
        const grouped = { ...local.grouped, stopped: !matched };
        if (matched) grouped[cell.binary.marked ? 'marked' : 'ordinary'] = true;
        state = { ...local, grouped, count: local.count + 1, evidence: [...local.evidence.slice(-4), after.observation_ref] };
        return { events: [] };
      }
      const value = uniformValue(second, cell.box);
      const localRewrite = value !== null && value !== cell.actual && fieldUnchangedOutside(field, cell.box, first, second);
      state = { ...local, count: local.count + 1, evidence: [...local.evidence.slice(-4), after.observation_ref],
        rejected: localRewrite ? local.rejected : [...local.rejected, cell.address + ',' + cell.actual],
        effects: localRewrite ? [...local.effects, { address: cell.address, from: cell.actual, to: value }] : local.effects };
      return { events: [] };
    },
    state: () => ({ state, transfer }),
    restore(value: NativeRecord) {
      state = structuredClone(value.state as State | null);
      transfer = structuredClone(value.transfer as Transfer | null) ?? null;
    },
  };
}
