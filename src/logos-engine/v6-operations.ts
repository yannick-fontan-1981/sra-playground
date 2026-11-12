export type OperationKey = `OP${string}`;
export type SymbolicRecord = Record<string, any>;

export interface OperationResult {
  operation: OperationKey;
  status: 'complete_on_supplied_state' | 'incomplete';
  synthetic_scope: true;
  completeness?: string;
  value: any;
}

function normalize(value: any): any {
  if (value === undefined) return null;
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, normalize(value[key])]));
  }
  return value;
}

export function canonical(value: any): string {
  return JSON.stringify(normalize(value));
}

function sameValue(a: any, b: any): boolean {
  return canonical(a) === canonical(b);
}

/** Match Python container truthiness used by the V6 donor implementation. */
export function pythonGet(record: SymbolicRecord | undefined, key: string, fallback: any = null): any {
  if (!record || !Object.hasOwn(record, key)) return fallback;
  return record[key];
}

export function pythonTruthy(value: any): boolean {
  if (value === null || value === undefined || value === false) return false;
  if (typeof value === 'number' || typeof value === 'bigint') return value !== 0;
  if (typeof value === 'string' || Array.isArray(value)) return value.length > 0;
  if (value instanceof Map || value instanceof Set) return value.size > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return Boolean(value);
}

export function executeOperation(key: OperationKey, state: SymbolicRecord): OperationResult {
  const cs = (state.compositions ?? []) as SymbolicRecord[];
  const facts = (state.facts ?? {}) as SymbolicRecord;
  const focus = cs.find(c => c.id === state.focus) ?? cs[0] ?? {};

  const verdict = (composition: SymbolicRecord): SymbolicRecord => Object.fromEntries(
    Object.entries(composition.requires ?? {}).map(([name, expected]) => [
      name,
      Object.hasOwn(facts, name) ? sameValue(facts[name], expected) : 'unknown',
    ]),
  );
  const ready = (composition: SymbolicRecord): boolean => Object.values(verdict(composition)).every(value => value === true);
  const links = (composition: SymbolicRecord): string[] => cs
    .filter(other => other.id !== composition.id)
    .filter(other => Object.entries(other.requires ?? {}).some(([name, expected]) =>
      Object.hasOwn(composition.effect ?? {}, name) && sameValue(composition.effect[name], expected)))
    .map(other => String(other.id));

  const result: OperationResult = {
    operation: key,
    status: 'complete_on_supplied_state',
    synthetic_scope: true,
    value: undefined,
  };

  switch (key) {
    case 'OP01': {
      const groups = new Map<string, string[]>();
      for (const composition of cs) {
        const signature = canonical(Object.fromEntries(
          ['kind', 'requires', 'effect', 'things', 'properties', 'relations', 'context']
            .map(name => [name, pythonGet(composition, name, null)]),
        ));
        const group = groups.get(signature) ?? [];
        group.push(String(composition.id));
        groups.set(signature, group);
      }
      result.value = [...groups.values()];
      break;
    }
    case 'OP02': {
      const groups = new Map<string, string[]>();
      for (const path of (state.paths ?? []) as SymbolicRecord[]) {
        let signature: any;
        if (path.post_state_complete !== true) {
          result.status = 'incomplete';
          signature = { unproved_equivalence: path.id };
        } else {
          signature = { post_state: pythonGet(path, 'post_state', null), path_constraints: pythonGet(path, 'constraints_verified', null) };
        }
        const key2 = canonical(signature);
        const group = groups.get(key2) ?? [];
        group.push(String(path.id));
        groups.set(key2, group);
      }
      result.value = [...groups.values()];
      break;
    }
    case 'OP03':
      result.value = { composition: focus.id, preconditions: verdict(focus) };
      break;
    case 'OP04':
      result.value = { composition: focus.id, opens: links(focus) };
      break;
    case 'OP05': {
      const groups = new Map<string, string[]>();
      for (const composition of cs) {
        const signature = canonical(composition.effect ?? {});
        const group = groups.get(signature) ?? [];
        group.push(String(composition.id));
        groups.set(signature, group);
      }
      result.value = [...groups.values()].filter(group => group.length > 1);
      break;
    }
    case 'OP06': {
      const expected = focus.effect ?? {};
      result.value = ((state.observations ?? []) as SymbolicRecord[]).filter(observation =>
        observation.composition === focus.id && Object.entries(expected).some(([name, value]) =>
          !sameValue(pythonGet(observation.after, name, null), value)));
      break;
    }
    case 'OP07':
      result.value = ((state.frontiers ?? []) as SymbolicRecord[]).filter(frontier =>
        frontier.reachable === true && frontier.visited !== true && pythonTruthy(frontier.open_goal_evidence));
      break;
    case 'OP08':
      result.value = cs.filter(composition => links(composition).includes(String(focus.id))).map(composition => composition.id);
      break;
    case 'OP09': {
      const alternatives = (state.alternatives ?? []) as any[][];
      if (state.alternatives_complete !== true || alternatives.length === 0) {
        result.status = 'incomplete';
        result.value = { mandatory: null, reason: 'alternative domain not proven complete' };
      } else {
        const [first, ...rest] = alternatives;
        const mandatory = (first ?? []).filter(value => rest.every(items => items.some(item => sameValue(item, value))));
        result.value = [...mandatory].sort();
      }
      break;
    }
    case 'OP10':
      result.value = ((state.goals ?? []) as SymbolicRecord[]).filter(goal => pythonTruthy(goal.terminal)).map(goal => goal.composition);
      break;
    case 'OP11':
      result.value = Object.fromEntries(cs.map(composition => [composition.id, links(composition)]).filter(([, opened]) => opened.length > 0));
      break;
    case 'OP12': {
      const byId = new Map(cs.map(composition => [String(composition.id), composition]));
      const todo = [String(focus.id)];
      const seen = new Set<string>();
      const unknown: Record<string, string[]> = {};
      while (todo.length > 0 && seen.size < 64) {
        const id = todo.pop();
        if (!id || seen.has(id) || !byId.has(id)) continue;
        seen.add(id);
        const composition = byId.get(id)!;
        const missing = Object.entries(verdict(composition)).filter(([, value]) => value === 'unknown').map(([name]) => name);
        if (missing.length > 0) unknown[id] = missing;
        todo.push(...((composition.depends_on ?? []) as any[]).map(String));
      }
      result.value = { unknowns: unknown, visited: [...seen].sort() };
      if (todo.length > 0) result.status = 'incomplete';
      break;
    }
    case 'OP13':
      result.value = {
        observed_effects: ((state.observations ?? []) as SymbolicRecord[])
          .filter(observation => observation.composition === focus.id)
          .map(observation => pythonGet(observation, 'after', null)),
        unobserved_extent: 'unknown',
      };
      break;
    case 'OP14':
      result.value = cs.filter(composition => ready(composition) && Object.entries(state.preserve ?? {}).every(([name, expected]) =>
        sameValue(Object.hasOwn(composition.effect ?? {}, name) ? composition.effect[name] : pythonGet(facts, name, null), expected))).map(c => c.id);
      break;
    case 'OP15':
      result.value = ((state.goals ?? []) as SymbolicRecord[]).filter(goal => !pythonTruthy(goal.terminal) && !pythonTruthy(goal.completed) &&
        Object.entries(goal.requires ?? {}).every(([name, expected]) => sameValue(pythonGet(facts, name, null), expected))).map(goal => goal.id);
      break;
    case 'OP16':
      result.value = ((state.deadlocks ?? []) as SymbolicRecord[]).filter(deadlock => pythonTruthy(deadlock.proof) && deadlock.scope === 'global');
      result.completeness = 'only supplied proved deadlocks; absence does not prove safety';
      break;
    case 'OP17':
      result.value = ((state.recovery ?? []) as SymbolicRecord[]).filter(recovery => recovery.authorized === true && recovery.preserve_verified === true);
      break;
    case 'OP18':
      result.value = cs.filter(composition => !pythonTruthy(composition.observed) && pythonTruthy(composition.open_question)).map(composition => composition.id);
      break;
    case 'OP19': {
      const actions: any[] = [];
      for (const step of (state.forced ?? []) as SymbolicRecord[]) {
        if (!pythonTruthy(step.proof) || step.constraints_verified !== true) {
          result.status = 'incomplete';
          break;
        }
        actions.push(step.action);
      }
      result.value = actions;
      break;
    }
    case 'OP20':
      result.value = ((state.entities ?? []) as SymbolicRecord[]).filter(entity => entity.utility === 'unknown')
        .map(entity => ({ entity: entity.id, status: 'utility_hypothesis', question: pythonGet(entity, 'question', null) }));
      break;
    case 'OP21':
      result.value = ((state.spaces ?? []) as SymbolicRecord[]).filter(space => space.utility === 'unknown')
        .map(space => ({ space: space.id, status: 'utility_hypothesis', question: pythonGet(space, 'question', null) }));
      break;
    case 'OP22':
      result.value = ((state.remote_effects ?? []) as SymbolicRecord[]).filter(effect => pythonTruthy(effect.observation));
      break;
    case 'OP23':
      result.value = ((state.entities ?? []) as SymbolicRecord[]).flatMap(entity => {
        if (pythonTruthy(entity.cycle) && pythonTruthy(entity.cycle_proof)) {
          const cycle = entity.cycle as any[];
          return [{ entity: entity.id, next: cycle[((entity.phase ?? 0) + 1) % cycle.length], evidence: entity.cycle_proof }];
        }
        if (pythonTruthy(entity.autonomous)) return [{ entity: entity.id, next: 'unknown' }];
        return [];
      });
      break;
    case 'OP24':
      result.value = ((state.paths ?? []) as SymbolicRecord[]).filter(path =>
        sameValue(path.post_state, state.desired_post_state) && path.constraints_verified === true).map(path => path.id);
      break;
    case 'OP25':
      result.value = cs.filter(composition => pythonTruthy(composition.candidate_objective) && composition.feasibility !== 'refuted').map(c => c.id);
      break;
    case 'OP26':
      result.value = ((state.accesses ?? []) as SymbolicRecord[]).filter(access =>
        access.target === focus.id && access.constraints_verified === true).map(access => access.id);
      break;
    case 'OP27': {
      const protectedRefs = new Set((state.preserve_refs ?? []) as any[]);
      result.value = ((state.permutations ?? []) as SymbolicRecord[]).filter(permutation =>
        permutation.target === focus.id && permutation.constraints_verified === true &&
        [...protectedRefs].every(ref => (permutation.preserved_refs ?? []).some((value: any) => sameValue(value, ref)))).map(permutation => permutation.id);
      break;
    }
    case 'OP28':
      result.value = ((state.bundles ?? []) as SymbolicRecord[]).filter(bundle =>
        bundle.composition_ref === focus.id && bundle.admitted === true && Array.isArray(bundle.actions) && bundle.actions.length > 0).map(bundle => bundle.id);
      break;
    case 'OP29': {
      const expected = (state.expected_properties ?? {}) as SymbolicRecord;
      const observed = (state.observed_properties ?? {}) as SymbolicRecord;
      result.value = Object.fromEntries(Object.entries(expected).map(([name, value]) => [name, {
        expected: value,
        observed: pythonGet(observed, name, null),
        status: !Object.hasOwn(observed, name) ? 'unknown' : sameValue(observed[name], value) ? 'confirmed' : 'refuted',
      }]));
      break;
    }
    case 'OP30':
      result.value = ((state.knowledge_updates ?? []) as SymbolicRecord[]).filter(update =>
        update.composition_ref === focus.id && pythonTruthy(update.evidence) && update.revision === state.observation_revision);
      break;
    case 'OP31':
      result.value = ((state.objective_assessments ?? []) as SymbolicRecord[]).map(assessment => ({
        composition_ref: assessment.composition_ref,
        satisfied: pythonGet(assessment, 'satisfied', 'unknown'),
        feasible: pythonGet(assessment, 'feasible', 'unknown'),
        new_evidence: pythonGet(assessment, 'new_evidence', []),
      }));
      break;
    default:
      throw new RangeError(`Unknown Logos operation: ${key}`);
  }
  return result;
}
