import { wordCursorPath, wordEditPath, wordVisitPlan, type WordState } from '../logos-engine/v6-word-interface.ts';
import type { RuleSynthesis } from './rule-synthesis.ts';

type Edge = [before: string, after: string];
export type RuleEditor = {
  epoch: number; layout: RuleSynthesis; goals: string[][]; edits: Record<string, Record<string, Edge[]>>;
  directions: Record<string, number>; mutations: string[]; groups: string[]; attempted: string[];
  evidence: string[]; count: number;
};
type Graph = Map<string, Map<string, string>>;
export type RuleEditChoice = { actions: string[]; goal: string[]; exploration: boolean };
const identity = (type: number, glyph: string) => JSON.stringify([type, glyph]);
const context = (type: number, arity: number, glyph: string, action: string) => JSON.stringify([type, arity, glyph, action]);
const groupKey = (type: number, arity: number) => JSON.stringify([type, arity]);
const modulo = (value: number, n: number) => (value % n + n) % n;
const known = (local: RuleEditor, type: number, keys: readonly string[]): Graph => new Map(keys.flatMap(action => {
  const edges = local.edits[type]?.[action];
  return edges ? [[action, new Map(edges)] as const] : [];
}));

export function projectRuleEdit(local: RuleEditor, current: WordState, action: string): WordState | null {
  const [word, at] = current, { type, arity } = local.layout.sides[at]!;
  const movement = local.directions[action];
  if (movement) return [word, modulo(at + movement, word.length)];
  if (!local.groups.includes(groupKey(type, arity))) return null;
  const edge = local.edits[type]?.[action]?.find(([from]) => from === word[at]);
  return edge ? [word.map((glyph, i) => i === at ? edge[1] : glyph), at] : null;
}

function nextMissingMutation(local: RuleEditor, type: number, arity: number, head: string, keys: readonly string[]) {
  const graph = known(local, type, keys), seen = new Set([head]);
  const queue: { glyph: string; actions: string[] }[] = [{ glyph: head, actions: [] }];
  for (let i = 0; i < queue.length; i++) {
    const { glyph, actions } = queue[i]!;
    for (const action of keys) {
      const next = graph.get(action)?.get(glyph);
      if (next === undefined) {
        if (!local.attempted.includes(context(type, arity, glyph, action))) return [...actions, action];
      } else if (!seen.has(next)) {
        seen.add(next);
        queue.push({ glyph: next, actions: [...actions, action] });
      }
    }
  }
  return null;
}

export function chooseRuleEdits(local: RuleEditor, current: WordState, keys: readonly string[]): RuleEditChoice | null {
  const { sides } = local.layout, [word, at] = current;
  const directions = new Map(Object.entries(local.directions).filter(([action]) => keys.includes(action)));
  const mutations = local.mutations.filter(action => keys.includes(action));
  const labels = new Map(keys.map(action => [action, new Map<string, string>()]));
  for (const type of new Set(sides.map(item => item.type))) {
    for (const [action, graph] of known(local, type, keys)) for (const [from, to] of graph) {
      labels.get(action)!.set(identity(type, from), identity(type, to));
    }
  }
  const typed = (glyphs: readonly string[]) => glyphs.map((glyph, i) => identity(sides[i]!.type, glyph));
  const already = local.goals.some(goal => goal.every((glyph, i) => glyph === word[i]));
  if (already) return null;
  const complete = local.goals.flatMap(goal => {
    const path = wordVisitPlan(typed(word), typed(goal), at, labels, directions);
    return path?.length ? [{ actions: path, goal, exploration: false }] : [];
  }).sort((a, b) => a.actions.length - b.actions.length);
  if (complete.length) return complete[0]!;
  const survey = keys.find(action => !directions.has(action) && !mutations.includes(action) && !local.attempted.includes(action));
  if (survey) return { actions: [survey], goal: local.goals[0]!, exploration: true };
  const candidates = local.goals.flatMap(goal => {
    let estimate = 0;
    const needed: { actions: string[]; cost: number; exploration: boolean }[] = [];
    for (let i = 0; i < goal.length; i++) {
      if (goal[i] === word[i]) continue;
      const { type, arity } = sides[i]!, graph = known(local, type, mutations);
      const edit = wordEditPath(graph, word[i]!, goal[i]!);
      const experiment = edit ? null : nextMissingMutation(local, type, arity, word[i]!, mutations);
      const travel = wordCursorPath(directions, at, i, word.length);
      if (!travel || (!edit && !experiment)) return [];
      estimate += edit?.length ?? 3 + experiment!.length;
      needed.push({ actions: [...travel, ...(edit ?? experiment!)], cost: travel.length * 2 + (edit ? 0 : 1), exploration: !edit && !travel.length });
    }
    const task = needed.sort((a, b) => a.cost - b.cost)[0];
    return task ? [{ ...task, goal, estimate }] : [];
  }).sort((a, b) => a.estimate - b.estimate || a.cost - b.cost);
  return candidates[0] ?? null;
}

export function acquireRuleEdit(local: RuleEditor, before: WordState, after: WordState | null, action: string, ref: string): RuleEditor {
  const [word, at] = before, { type, arity } = local.layout.sides[at]!;
  const mutation = context(type, arity, word[at]!, action), directions = { ...local.directions }, edits = { ...local.edits };
  let groups = local.groups, mutations = local.mutations;
  if (after) {
    const [observed, focus] = after;
    const changed = word.flatMap((glyph, i) => observed[i] !== glyph ? [i] : []);
    if (at === focus && changed.length === 1 && changed[0] === at) {
      const typeGraph = { ...edits[type] }, edges = new Map(typeGraph[action]);
      edges.set(word[at]!, observed[at]!);
      typeGraph[action] = [...edges];
      for (const [other, material] of Object.entries(typeGraph)) {
        if (other === action || !material.some(([from, to]) => from === observed[at] && to === word[at])) continue;
        const reverse = new Map(material);
        if ([...edges].some(([a, b]) => reverse.has(b) && reverse.get(b) !== a)) continue;
        for (const [a, b] of edges) reverse.set(b, a);
        if (new Set(reverse.values()).size === reverse.size) typeGraph[other] = [...reverse];
      }
      edits[type] = typeGraph;
      delete directions[action];
      groups = [...new Set([...groups, groupKey(type, arity)])];
      mutations = [...new Set([...mutations, action])].sort();
    } else if (!changed.length && focus !== at) {
      const step = modulo(focus - at, word.length);
      if (step === 1 || step === word.length - 1) directions[action] = step === 1 ? 1 : -1;
      mutations = mutations.filter(key => key !== action);
    } else {
      delete directions[action];
      const typeGraph = { ...edits[type] }, edges = new Map(typeGraph[action]);
      edges.delete(word[at]!);
      typeGraph[action] = [...edges];
      edits[type] = typeGraph;
    }
  }
  return { ...local, edits, directions, groups, mutations, attempted: [...new Set([...local.attempted, action, mutation])],
    evidence: [...new Set([...local.evidence.slice(-5), ref])], count: local.count + 1 };
}
