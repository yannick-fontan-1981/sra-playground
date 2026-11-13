/** Native bounded conditional projection from morphology_policy/derive.py. */
import { compareUnicode } from './canonical.ts';
import { pythonTruthy as truth } from './v6-operations.ts';

export type DerivationRecord = Record<string, any>;
type Scalars = Record<string, null | boolean | number | string>;
type State = [Scalars, Record<string, number>, Scalars];
type Guard = [Scalars, Scalars, Record<string, number>];
const copy = <T>(value: T): T => structuredClone(value);
const mapping = (value: unknown): value is DerivationRecord => value !== null && typeof value === 'object' && !Array.isArray(value);
const numberKind = (value: number) => Number.isInteger(value) && !Object.is(value, -0) ? 'int' : 'float';
const kind = (value: unknown): string => value === null ? 'NoneType' : typeof value === 'boolean' ? 'bool' : typeof value === 'number' ? numberKind(value) : 'str';
function values(raw: unknown): Scalars {
  if (!mapping(raw) || Object.keys(raw).some(key => !key)) throw new TypeError('Expected a mapping of named scalar facts');
  for (const value of Object.values(raw)) if (value !== null && !['boolean', 'number', 'string'].includes(typeof value)
    || typeof value === 'number' && !Number.isFinite(value)) throw new TypeError('Facts must be finite typed scalars');
  return { ...raw };
}
function amounts(raw: unknown): Record<string, number> {
  const result = values(raw);
  if (Object.values(result).some(value => typeof value !== 'number' || numberKind(value) !== 'int')) throw new TypeError('Resource quantities must be integers');
  return result as Record<string, number>;
}
function match(actual: Scalars, required: Scalars): boolean {
  return Object.entries(required).every(([key, value]) => Object.hasOwn(actual, key) && kind(actual[key]) === kind(value) && actual[key] === value);
}
function guard(raw: unknown): Guard {
  if (!mapping(raw)) throw new TypeError('Expected preservation mapping');
  if (Object.values(raw).some(mapping)) {
    if (Object.keys(raw).some(key => !['facts', 'persistent_effects', 'minimum_resources'].includes(key))) throw new TypeError('Unknown preservation namespace');
    return [values(raw.facts ?? {}), values(raw.persistent_effects ?? {}), amounts(raw.minimum_resources ?? {})];
  }
  return [values(raw), {}, {}];
}
const preserved = (state: State, keep: Guard): boolean => match(state[0], keep[0]) && match(state[2], keep[1])
  && Object.entries(keep[2]).every(([key, value]) => Object.hasOwn(state[1], key) && state[1][key]! >= value);
function merge(a: Guard, b: Guard): Guard | null {
  for (const index of [0, 1] as const) if (!match(a[index], Object.fromEntries(Object.entries(b[index]).filter(([key]) => Object.hasOwn(a[index], key))))) return null;
  const minima = { ...a[2] };
  for (const [key, value] of Object.entries(b[2])) minima[key] = Math.max(value, minima[key] ?? value);
  return [{ ...a[0], ...b[0] }, { ...a[1], ...b[1] }, minima];
}
const stateKey = (state: readonly Scalars[]): string => JSON.stringify(state.map(row => Object.keys(row).sort(compareUnicode).map(key => [key, kind(row[key]), row[key]])));
const describe = (state: State): DerivationRecord => ({ facts: { ...state[0] }, resources: { ...state[1] }, persistent_effects: { ...state[2] } });
const refs = (value: unknown): string[] => Array.isArray(value) && value.length && value.every(item => typeof item === 'string' && item.length) ? [...new Set(value)] : [];
function attestation(rule: DerivationRecord, scope: Scalars, ledger: DerivationRecord): readonly [string[] | null, string | null] {
  const ident = rule.id, required = values(rule.scope ?? {});
  if (!Object.keys(required).length || !match(scope, required)) return [null, 'rule_scope_unbound'];
  const source = refs(rule.evidence);
  if (!source.length) return [null, 'missing_observed_transition'];
  const revalidated: string[] = [];
  for (const ref of source) {
    const row = ledger[ref] ?? {};
    if (ref === ident || row.kind !== 'observed_transition' || row.mechanism_ref !== ident
      || !refs([row.before_ref, row.after_ref]).length || row.before_ref === row.after_ref) return [null, 'unbound_observed_transition'];
    if (Object.hasOwn(row, 'scope') && !match(scope, values(row.scope))) {
      const qualified = refs(rule.revalidation_refs).filter(key => {
        const now = ledger[key] ?? {};
        return now.kind === 'current_revalidation' && now.mechanism_ref === ident && truth(now.scope)
          && match(scope, values(now.scope)) && refs(now.evidence).includes(ref);
      });
      if (!qualified.length) return [null, 'foreign_observation_requires_revalidation'];
      revalidated.push(...qualified);
    }
  }
  return [[...new Set([...source, ...revalidated])], null];
}

/** No actions are executed and no evidence is created by these projections. */
export function deriveProjection(current: DerivationRecord, target: DerivationRecord, mechanisms: readonly DerivationRecord[], options: {
  preserve: DerivationRecord; remainingActions: number; maxDepth?: number; maxStates?: number;
}): DerivationRecord {
  const { remainingActions: budget, maxDepth = 2, maxStates = 32 } = options;
  if (!Number.isSafeInteger(budget) || budget < 0 || !Number.isInteger(maxDepth) || maxDepth < 0 || maxDepth > 2
    || !Number.isInteger(maxStates) || maxStates < 1 || maxStates > 32) throw new RangeError('Require a nonnegative budget, depth 0..2 and 1..32 projected states');
  const initial: State = [values(current.facts), amounts(current.resources ?? {}), values(current.persistent_effects ?? {})];
  if (Object.values(initial[1]).some(n => n < 0)) throw new RangeError('Negative initial resource');
  const scope = values(current.scope), ledger = current.observations ?? {};
  const wanted: State = [values(target.requires ?? {}), amounts(target.resources ?? {}), values(target.persistent_effects ?? {})];
  const goalRefs = refs(target.evidence), guards = guard(options.preserve);
  const base: DerivationRecord = { offers: [], initial: describe(initial), target: target.id ?? null, target_evidence: goalRefs,
    states_explored: 1, search_complete: true, depth_limit: maxDepth, state_limit: maxStates,
    release_authority: false, ignored_mechanisms: {}, pruned: {}, scope };
  if (!truth(target.id) || !wanted.some(row => Object.keys(row).length) || !goalRefs.length
    || !match(scope, values(target.scope ?? {})) || goalRefs.some(ref => ref === target.id || !Object.hasOwn(ledger, ref)
      || !['observed_goal', 'observed_state', 'observed_transition', 'current_revalidation', 'recognized_target'].includes(ledger[ref].kind)
      || Object.hasOwn(ledger[ref], 'target_ref') && ledger[ref].target_ref !== target.id)) return { ...base, status: 'unbound_target' };
  if (!preserved(initial, guards)) return { ...base, status: 'initial_preservation_unsatisfied' };
  if (!Array.isArray(mechanisms) || mechanisms.length > 128) return { ...base, status: 'mechanism_inventory_over_bound', search_complete: false };
  const rules = new Map<string, DerivationRecord>(), seenIds = new Set<string>();
  for (const rule of mechanisms) {
    const id = rule.id;
    if (typeof id !== 'string' || !id || seenIds.has(id)) throw new TypeError('Non-unique mechanism identity');
    seenIds.add(id);
    const [evidence, why] = attestation(rule, scope, ledger);
    if (why) { base.ignored_mechanisms[id] = why; continue; }
    const { cost, actions, probe } = rule;
    if (!Number.isInteger(cost) || cost < 1) throw new TypeError('Action cost must be a positive integer');
    if (truth(actions) === truth(probe)) throw new TypeError('Supply exactly one action set or a probe to bind');
    if (truth(actions) && (!Array.isArray(actions) || actions.length !== cost)) throw new TypeError('Primitive count differs from action cost');
    if (truth(probe) && !mapping(probe)) throw new TypeError('Probe must describe its unresolved binding');
    const falsifiers = refs(rule.falsifiers);
    if (!falsifiers.length) { base.ignored_mechanisms[id] = 'no_falsifier'; continue; }
    rules.set(id, { id, pre: values(rule.preconditions ?? {}), set: values(rule.effects ?? {}), prior: values(rule.persistent_preconditions ?? {}),
      durable: values(rule.persistent_effects ?? {}), need: amounts(rule.requires_resources ?? {}), delta: amounts(rule.resource_delta ?? {}),
      guard: guard(rule.preserve ?? {}), cost, evidence, falsifiers, binding: truth(actions) ? { actions: copy(actions) } : { probe: copy(probe) } });
  }
  const holds = (state: State) => state.every((row, index) => match(row, wanted[index]!));
  const head = stateKey(initial), root = JSON.stringify([head, budget, stateKey(guards)]);
  type QueueRow = { state: State; budget: number; active: Guard; path: DerivationRecord[]; ancestors: Set<string>; met: boolean };
  const queue: QueueRow[] = [{ state: initial, budget, active: guards, path: [], ancestors: new Set([head]), met: holds(initial) }];
  const visited = new Set([root]), cuts: Record<string, number> = {}, offers: DerivationRecord[] = [];
  const cut = (reason: string) => { cuts[reason] = (cuts[reason] ?? 0) + 1; };
  let truncated = false;
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const { state, budget: left, active, path, ancestors, met } = queue[cursor]!;
    if (path.length >= maxDepth) continue;
    for (const [id, rule] of rules) {
      if (left < rule.cost) { cut('action_budget'); continue; }
      if (!match(state[0], rule.pre) || !match(state[2], rule.prior)) { cut('precondition'); continue; }
      if (!Object.entries(rule.need as Record<string, number>).every(([key, value]) => Object.hasOwn(state[1], key) && state[1][key]! >= value)) { cut('resource_precondition'); continue; }
      const combined = merge(active, rule.guard);
      if (!combined || !preserved(state, combined)) { cut('preservation'); continue; }
      if (Object.entries(rule.delta as Record<string, number>).some(([key, value]) => !Object.hasOwn(state[1], key) || state[1][key]! + value < 0)) { cut('resource_exhausted_or_unknown'); continue; }
      const inventory = { ...state[1] };
      for (const [key, value] of Object.entries(rule.delta as Record<string, number>)) inventory[key] = inventory[key]! + value;
      const projected: State = [{ ...state[0], ...rule.set }, inventory, { ...state[2], ...rule.durable }];
      if (!preserved(projected, combined) || met && !holds(projected)) { cut('preservation'); continue; }
      const key = stateKey(projected);
      if (ancestors.has(key)) { cut('cycle_or_no_observable_change'); continue; }
      const remaining = left - rule.cost, visit = JSON.stringify([key, remaining, stateKey(combined)]);
      if (visited.has(visit)) { cut('equivalent_future'); continue; }
      if (visited.size >= maxStates) { truncated = true; cut('state_limit'); continue; }
      visited.add(visit);
      const changes = Object.fromEntries(['facts', 'resources', 'persistent_effects'].map((label, index) => [label,
        Object.fromEntries(Object.entries(projected[index]!).filter(([field, value]) => !match(state[index]!, { [field]: value }))) ]));
      const step = { mechanism_ref: id, evidence: [...rule.evidence], falsifiers: [...rule.falsifiers], cost: rule.cost, changes, binding: copy(rule.binding) };
      const chain = [...path, step], satisfied = holds(projected);
      const extra = Object.keys(changes.facts!).length > 0 || Object.keys(changes.persistent_effects!).length > 0
        || Object.keys(changes.resources!).some(key => inventory[key]! > state[1][key]!);
      if (satisfied && (!met || extra)) offers.push({ relation: met ? 'extends_target' : 'reaches_target', target_ref: target.id,
        chain_refs: chain.map(step => step.mechanism_ref), chain: copy(chain), target_evidence: [...goalRefs],
        observed_evidence: [...new Set(chain.flatMap(step => step.evidence))], falsifiers: [...new Set(chain.flatMap(step => step.falsifiers))],
        remaining_actions: remaining, cost: budget - remaining, projected: describe(projected),
        preserved: { facts: { ...combined[0] }, persistent_effects: { ...combined[1] }, minimum_resources: { ...combined[2] } },
        first_obligation: copy(chain[0]), release_authority: false, qualification: 'conditional_projection' });
      queue.push({ state: projected, budget: remaining, active: combined, path: chain, ancestors: new Set([...ancestors, key]), met: satisfied });
    }
  }
  return { ...base, status: offers.length ? 'conditional_options' : truncated ? 'search_incomplete' : 'no_supported_projection', offers,
    states_explored: visited.size, pruned: cuts, search_complete: !truncated };
}
