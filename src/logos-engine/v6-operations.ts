/** Direct native transfer of laya_proto/operations.py; these queries grant no game authority. */
import { compareUnicode } from './canonical.ts';

export type SymbolicState = Record<string, any>;
export interface OperationResult extends SymbolicState {
  operation: string;
  status: 'complete_on_supplied_state' | 'incomplete';
  synthetic_scope: true;
  value: any;
}

/** Python equality for the JSON domain (including True == 1, unlike DRM typed equality). */
export function pythonEqual(left: any, right: any): boolean {
  if (left == null || right == null) return left == null && right == null;
  const numeric = (value: any) => typeof value === 'number' || typeof value === 'boolean';
  if (numeric(left) && numeric(right)) return Number(left) === Number(right);
  if (typeof left !== typeof right || Array.isArray(left) !== Array.isArray(right)) return false;
  if (Array.isArray(left)) return left.length === right.length && left.every((value, index) => pythonEqual(value, right[index]));
  if (typeof left === 'object') {
    const keys = Object.keys(left);
    return keys.length === Object.keys(right).length && keys.every(key => Object.hasOwn(right, key) && pythonEqual(left[key], right[key]));
  }
  return left === right;
}

export function pythonTruthy(value: any): boolean {
  if (value == null || value === false || value === 0 || value === '') return false;
  if (Array.isArray(value)) return value.length !== 0;
  if (typeof value === 'object') return Object.keys(value).length !== 0;
  return true;
}

/** Compact sorted ensure_ascii JSON, used for symbolic equivalence grouping. */
export function canonical(value: any): string {
  const encode = (item: any): string => {
    if (item == null) return 'null';
    if (typeof item === 'string') return JSON.stringify(item).replace(/[\u007f-\uffff]/g, c => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
    if (typeof item === 'boolean') return item ? 'true' : 'false';
    if (typeof item === 'number') {
      if (!Number.isFinite(item)) throw new TypeError('Nonfinite symbolic numbers are unsupported');
      if (Number.isInteger(item) && !Number.isSafeInteger(item)) throw new TypeError('Symbolic integer exceeds the exact native domain');
      return JSON.stringify(item);
    }
    if (Array.isArray(item)) return `[${item.map(encode).join(',')}]`;
    if (typeof item === 'object') return `{${Object.keys(item).sort(compareUnicode).map(key => `${encode(key)}:${encode(item[key])}`).join(',')}}`;
    throw new TypeError('Symbolic operations require JSON values');
  };
  return encode(value);
}

const get = (value: SymbolicState, key: string, fallback: any = null): any => Object.hasOwn(value, key) ? value[key] : fallback;
const own = (value: SymbolicState, key: string) => Object.hasOwn(value, key);
const every = (value: SymbolicState, predicate: (key: string, value: any) => boolean) => Object.entries(value).every(([key, item]) => predicate(key, item));
const collectGroups = (values: any[], signature: (value: any) => any): any[][] => {
  const groups = new Map<string, any[]>();
  for (const value of values) {
    const key = canonical(signature(value));
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(value.id);
  }
  return [...groups.values()];
};

/** The original OP01–OP31 bounded queries, with their original incomplete/unknown results. */
export function execute(key: string, state: SymbolicState): OperationResult {
  const cs: SymbolicState[] = get(state, 'compositions', []), facts = get(state, 'facts', {});
  const focus = cs.find(c => pythonEqual(c.id, get(state, 'focus'))) ?? cs[0] ?? {};
  const verdict = (c: SymbolicState) => Object.fromEntries(Object.entries(get(c, 'requires', {}))
    .map(([k, v]) => [k, !own(facts, k) ? 'unknown' : pythonEqual(facts[k], v)]));
  const ready = (c: SymbolicState) => Object.values(verdict(c)).every(v => v === true);
  const links = (c: SymbolicState) => cs.filter(d => !pythonEqual(d.id, c.id) && Object.entries(get(d, 'requires', {}))
    .some(([k, v]) => own(get(c, 'effect', {}), k) && pythonEqual(c.effect[k], v))).map(d => d.id);
  const result: OperationResult = { operation: key, status: 'complete_on_supplied_state', synthetic_scope: true, value: null };
  let value: any;
  switch (key) {
    case 'OP01': value = collectGroups(cs, c => Object.fromEntries(['kind', 'requires', 'effect', 'things', 'properties', 'relations', 'context'].map(k => [k, get(c, k)]))); break;
    case 'OP02': value = collectGroups(get(state, 'paths', []), p => {
      if (p.post_state_complete !== true) { result.status = 'incomplete'; return { unproved_equivalence: p.id }; }
      return { post_state: p.post_state, path_constraints: get(p, 'constraints_verified') };
    }); break;
    case 'OP03': value = { composition: get(focus, 'id'), preconditions: verdict(focus) }; break;
    case 'OP04': value = { composition: get(focus, 'id'), opens: links(focus) }; break;
    case 'OP05': value = collectGroups(cs, c => get(c, 'effect', {})).filter(group => group.length > 1); break;
    case 'OP06': value = get(state, 'observations', []).filter((o: SymbolicState) => pythonEqual(o.composition, get(focus, 'id')) &&
      Object.entries(get(focus, 'effect', {})).some(([k, v]) => !pythonEqual(get(get(o, 'after', {}), k), v))); break;
    case 'OP07': value = get(state, 'frontiers', []).filter((x: SymbolicState) => x.reachable === true && x.visited !== true && pythonTruthy(x.open_goal_evidence)); break;
    case 'OP08': value = cs.filter(c => links(c).some(id => pythonEqual(id, get(focus, 'id')))).map(c => c.id); break;
    case 'OP09': {
      const alternatives: any[][] = get(state, 'alternatives', []);
      if (state.alternatives_complete !== true || !alternatives.length) {
        result.status = 'incomplete'; value = { mandatory: null, reason: 'alternative domain not proven complete' };
      } else value = [...new Set(alternatives[0]!)].filter(v => alternatives.every(a => a.some(x => pythonEqual(x, v)))).sort(compareUnicode);
      break;
    }
    case 'OP10': value = get(state, 'goals', []).filter((g: SymbolicState) => pythonTruthy(g.terminal)).map((g: SymbolicState) => g.composition); break;
    case 'OP11': value = Object.fromEntries(cs.filter(c => links(c).length).map(c => [c.id, links(c)])); break;
    case 'OP12': {
      const byId = new Map(cs.map(c => [c.id, c])), todo = [get(focus, 'id')], seen = new Set<any>(), unknown: SymbolicState = {};
      while (todo.length && seen.size < 64) {
        const id = todo.pop(); if (seen.has(id) || !byId.has(id)) continue;
        seen.add(id); const c = byId.get(id)!;
        unknown[id] = Object.entries(verdict(c)).filter(([, v]) => v === 'unknown').map(([k]) => k);
        todo.push(...get(c, 'depends_on', []));
      }
      value = { unknowns: Object.fromEntries(Object.entries(unknown).filter(([, v]) => v.length)), visited: [...seen].sort(compareUnicode) };
      if (todo.length) result.status = 'incomplete';
      break;
    }
    case 'OP13': value = { observed_effects: get(state, 'observations', []).filter((o: SymbolicState) => pythonEqual(o.composition, get(focus, 'id'))).map((o: SymbolicState) => get(o, 'after')), unobserved_extent: 'unknown' }; break;
    case 'OP14': value = cs.filter(c => ready(c) && every(get(state, 'preserve', {}), (k, v) => pythonEqual(get(get(c, 'effect', {}), k, get(facts, k)), v))).map(c => c.id); break;
    case 'OP15': value = get(state, 'goals', []).filter((g: SymbolicState) => !pythonTruthy(g.terminal) && !pythonTruthy(g.completed) && every(get(g, 'requires', {}), (k, v) => pythonEqual(get(facts, k), v))).map((g: SymbolicState) => g.id); break;
    case 'OP16': value = get(state, 'deadlocks', []).filter((x: SymbolicState) => pythonTruthy(x.proof) && x.scope === 'global'); result.completeness = 'only supplied proved deadlocks; absence does not prove safety'; break;
    case 'OP17': value = get(state, 'recovery', []).filter((x: SymbolicState) => x.authorized === true && x.preserve_verified === true); break;
    case 'OP18': value = cs.filter(c => !pythonTruthy(c.observed) && pythonTruthy(c.open_question)).map(c => c.id); break;
    case 'OP19': value = []; for (const step of get(state, 'forced', [])) {
      if (!pythonTruthy(step.proof) || step.constraints_verified !== true) { result.status = 'incomplete'; break; }
      value.push(step.action);
    } break;
    case 'OP20': value = get(state, 'entities', []).filter((x: SymbolicState) => x.utility === 'unknown').map((x: SymbolicState) => ({ entity: x.id, status: 'utility_hypothesis', question: get(x, 'question') })); break;
    case 'OP21': value = get(state, 'spaces', []).filter((x: SymbolicState) => x.utility === 'unknown').map((x: SymbolicState) => ({ space: x.id, status: 'utility_hypothesis', question: get(x, 'question') })); break;
    case 'OP22': value = get(state, 'remote_effects', []).filter((x: SymbolicState) => pythonTruthy(x.observation)); break;
    case 'OP23': value = []; for (const e of get(state, 'entities', [])) {
      if (pythonTruthy(e.cycle) && pythonTruthy(e.cycle_proof)) { const index = (get(e, 'phase', 0) + 1) % e.cycle.length; value.push({ entity: e.id, next: e.cycle[(index + e.cycle.length) % e.cycle.length], evidence: e.cycle_proof }); }
      else if (pythonTruthy(e.autonomous)) value.push({ entity: e.id, next: 'unknown' });
    } break;
    case 'OP24': value = get(state, 'paths', []).filter((p: SymbolicState) => pythonEqual(p.post_state, get(state, 'desired_post_state')) && p.constraints_verified === true).map((p: SymbolicState) => p.id); break;
    case 'OP25': value = cs.filter(c => pythonTruthy(c.candidate_objective) && c.feasibility !== 'refuted').map(c => c.id); break;
    case 'OP26': value = get(state, 'accesses', []).filter((p: SymbolicState) => pythonEqual(p.target, get(focus, 'id')) && p.constraints_verified === true).map((p: SymbolicState) => p.id); break;
    case 'OP27': value = get(state, 'permutations', []).filter((p: SymbolicState) => pythonEqual(p.target, get(focus, 'id')) && p.constraints_verified === true &&
      get(state, 'preserve_refs', []).every((ref: any) => get(p, 'preserved_refs', []).some((r: any) => pythonEqual(ref, r)))).map((p: SymbolicState) => p.id); break;
    case 'OP28': value = get(state, 'bundles', []).filter((b: SymbolicState) => pythonEqual(b.composition_ref, get(focus, 'id')) && b.admitted === true && pythonTruthy(b.actions)).map((b: SymbolicState) => b.id); break;
    case 'OP29': {
      const observed = get(state, 'observed_properties', {});
      value = Object.fromEntries(Object.entries(get(state, 'expected_properties', {})).map(([k, v]) => [k, { expected: v, observed: get(observed, k), status: !own(observed, k) ? 'unknown' : pythonEqual(observed[k], v) ? 'confirmed' : 'refuted' }]));
      break;
    }
    case 'OP30': value = get(state, 'knowledge_updates', []).filter((u: SymbolicState) => pythonEqual(u.composition_ref, get(focus, 'id')) && pythonTruthy(u.evidence) && pythonEqual(get(u, 'revision'), get(state, 'observation_revision'))); break;
    case 'OP31': value = get(state, 'objective_assessments', []).map((g: SymbolicState) => ({ composition_ref: g.composition_ref, satisfied: get(g, 'satisfied', 'unknown'), feasible: get(g, 'feasible', 'unknown'), new_evidence: get(g, 'new_evidence', []) })); break;
    default: throw new RangeError(`Unknown symbolic operation: ${key}`);
  }
  result.value = value;
  return structuredClone(result);
}
