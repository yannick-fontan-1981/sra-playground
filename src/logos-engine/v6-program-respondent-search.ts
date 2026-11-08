/** Conditional composition with observed respondent order and four explicit
 * reduction/interaction hypotheses. Source: program_respondent_search.py.
 */
import { programCoordinates, programProducts } from './v6-program-compositions.ts';
import type { ProgramSearchOptions } from './v6-program-compositions.ts';

type R = Record<string, any>;
const key = (point: readonly number[]): string => `${point[0]},${point[1]}`;
const samePoint = (a: readonly number[], b: readonly number[]): boolean => a[0] === b[0] && a[1] === b[1];

export interface RespondentHypothesis {
  removed_end: 'top' | 'bottom';
  interaction_scope: 'own_bearer_only' | 'all_other_bearers';
  access_sites?: readonly (readonly number[])[];
}

export function simulateRespondentProgram(word: readonly number[], ownBase: readonly number[], targets: readonly R[], model: R, field: R,
  maxTurns: number, hypothesis: RespondentHypothesis): R[] | null {
  const moves = new Map<number, number[]>((model.moves as R[]).map(move => [move.label, move.vectors[0]])), interaction = model.interaction;
  const radius = new Set<string>((interaction.vectors as number[][]).map(key)), safe = new Set<string>((field.points as number[][]).map(key));
  const bodies = [{ base: [...ownBase], word: [...word].reverse() }, ...targets.map(target => ({ base: [...target.base] as number[], word: [...target.word] as number[] }))];
  const turns: R[] = [], seen = new Set<string>(), sites = new Set((hypothesis.access_sites ?? []).map(key));
  for (let turn = 0; turn < maxTurns; turn++) {
    const state = JSON.stringify(bodies.map(body => [body.base, body.word]));
    if (seen.has(state)) return null;
    seen.add(state);
    for (let actor = 0; actor < bodies.length; actor++) {
      const body = bodies[actor]!, program = [...body.word].reverse();
      for (const label of program) {
        if (!body.word.length) break;
        if (moves.has(label)) {
          const vector = moves.get(label)!, target = [body.base[0]! + vector[0]!, body.base[1]! + vector[1]!];
          if (bodies.some((other, index) => index !== actor && other.word.length && samePoint(other.base, target))) return null;
          if (safe.has(key(target))) body.base = target;
          else {
            const coordinate = programCoordinates(target, field.origin, field.basis);
            if (coordinate === null || coordinate.every((value, index) => field.bounds[index][0] <= value && value <= field.bounds[index][1])) return null;
          }
        } else if (label === interaction.label) {
          for (let index = 0; index < bodies.length; index++) {
            const other = bodies[index]!;
            if (index === actor || !other.word.length || actor && hypothesis.interaction_scope === 'own_bearer_only' && index) continue;
            if (radius.has(`${other.base[0]! - body.base[0]!},${other.base[1]! - body.base[1]!}`)) {
              if (index === 0) return null;
              other.word = hypothesis.removed_end === 'top' ? other.word.slice(1) : other.word.slice(0, -1);
            }
          }
        } else return null;
        if (!bodies.slice(1).some(other => other.word.length) && !sites.size) {
          turns.push({ base: [...bodies[0]!.base], targets: bodies.slice(1).map(other => ({ base: [...other.base], word: other.word })) });
          return turns;
        }
      }
    }
    turns.push({ base: [...bodies[0]!.base], targets: bodies.slice(1).map(other => ({ base: [...other.base], word: [...other.word] })) });
    if (sites.size && sites.has(key(bodies[0]!.base))) return turns;
  }
  return null;
}

export interface RespondentSearchOptions extends ProgramSearchOptions {
  max_members?: number | null;
  access_sites?: readonly (readonly number[])[];
  first_feasible?: boolean;
}

export function searchRespondentProgram(existing: readonly number[], ownBase: readonly number[], targets: readonly R[], model: R, field: R,
  options: RespondentSearchOptions): R {
  const prefix = [...existing].reverse(), labels = [...new Set<number>([...(model.moves as R[]).map(move => move.label), model.interaction.label])]
    .sort((a, b) => a - b).filter(label => options.insertable_labels === undefined || options.insertable_labels.includes(label));
  const hypotheses: RespondentHypothesis[] = (['top', 'bottom'] as const).flatMap(removed_end =>
    (['own_bearer_only', 'all_other_bearers'] as const).map(interaction_scope => ({ removed_end, interaction_scope })));
  const now = options.now ?? (() => performance.now() / 1000);
  let nodes = 0, best: R | null = null, maximum = Math.min(15, options.max_new_actions - 1);
  if (options.max_members !== undefined && options.max_members !== null) maximum = Math.min(maximum, options.max_members - existing.length);
  for (let extra = 0; extra <= maximum; extra++) {
    if (best && extra + 1 >= best.cost) break;
    for (const suffix of programProducts(labels, extra)) {
      nodes++;
      if (now() >= options.deadline) return { status: 'deadline', nodes, best };
      const word = [...prefix, ...suffix], predictions: R[] = [];
      for (const hypothesis of hypotheses) {
        const turns = simulateRespondentProgram(word, ownBase, targets, model, field, options.max_new_actions - extra,
          { ...hypothesis, access_sites: options.access_sites });
        if (turns === null) break;
        predictions.push({ hypothesis, turns });
      }
      if (predictions.length !== hypotheses.length) continue;
      const cost = extra + Math.max(...predictions.map(prediction => prediction.turns.length)), entry = { word, edits: suffix, cost, predictions };
      if (options.first_feasible ?? true) return { status: 'proposed', nodes, plan: entry,
        scope: 'First feasible composition under four explicit reduction/interaction hypotheses and observed bearer order. No optimum or official success is inferred.' };
      if (best === null || cost < best.cost) best = entry;
    }
  }
  return { status: best ? 'proposed' : 'unknown', nodes, plan: best,
    scope: 'Robust only across the explicitly enumerated reduction/interaction hypotheses and observed bearer order. Surface extent, execution order persistence, and completeness of decoded bodies remain conditional; no official success is inferred.' };
}

export function searchRespondentReplacement(existing: readonly number[], ownBase: readonly number[], targets: readonly R[], model: R, field: R,
  options: RespondentSearchOptions & { max_members: number }): R {
  let nodes = 0, best: R | null = null;
  for (let removals = 0; removals <= existing.length; removals++) {
    if (removals >= options.max_new_actions) break;
    const result = searchRespondentProgram(existing.slice(removals), ownBase, targets, model, field,
      { ...options, max_new_actions: options.max_new_actions - removals, first_feasible: false });
    nodes += result.nodes;
    if (result.status === 'proposed') {
      result.plan.removals = removals; result.plan.cost += removals;
      if (best === null || result.plan.cost < best.plan.cost) best = result;
    }
    if (result.status === 'deadline') return { ...result, nodes };
  }
  if (best) return { ...best, nodes,
    scope: best.scope + ' Conservative member-count hypothesis, not universal capacity. Access-site resemblance is an experiment, not a guaranteed permission.' };
  return { status: 'unknown', nodes, plan: null,
    scope: 'No candidate within the conservative member-count hypothesis after top-member removals; no impossibility or universal capacity claim.' };
}
