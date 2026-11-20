import { wordCursorPath, wordEditPath, wordVisitPlan, type WordState } from '../logos-engine/v6-word-interface.ts';
import { composeRuleAssignments, type RuleSynthesis } from './rule-synthesis.ts';

type Edge = [before: string, after: string];
export type RuleEditor = {
  epoch: number; layout: RuleSynthesis; goals: string[][]; edits: Record<string, Record<string, Edge[]>>;
  directions: Record<string, number>; mutations: string[]; groups: string[]; attempted: string[];
  evidence: string[]; count: number;
};
type Graph = Map<string, Map<string, string>>;
export type RuleEditChoice = { actions: string[]; goal: string[]; exploration: boolean; dictionaries?: number };
const identity = (type: number, glyph: string) => JSON.stringify([type, glyph]);
const context = (type: number, arity: number, glyph: string, action: string) => JSON.stringify([type, arity, glyph, action]);
const groupKey = (type: number, arity: number) => JSON.stringify([type, arity]);
const modulo = (value: number, n: number) => (value % n + n) % n;
const known = (local: RuleEditor, type: number, keys: readonly string[]): Graph => new Map(keys.flatMap(action => {
  const edges = local.edits[type]?.[action];
  return edges ? [[action, new Map(edges)] as const] : [];
}));

function applyEdit(local: RuleEditor, type: number, arity: number, value: string, action: string): string | null {
  if (!local.groups.includes(groupKey(type, arity))) return null;
  const edges = local.edits[type]?.[action];
  if (local.layout.middleType === undefined) return edges?.find(([from]) => from === value)?.[1] ?? null;
  const symbols = JSON.parse(value) as string[];
  const next = symbols.map(glyph => edges?.find(([from]) => from === glyph)?.[1]);
  return next.every(glyph => glyph !== undefined) ? JSON.stringify(next) : null;
}

export function projectRuleEdit(local: RuleEditor, current: WordState, action: string): WordState | null {
  const [word, at] = current, { type, arity } = local.layout.sides[at]!;
  const movement = local.directions[action];
  if (movement) return [word, modulo(at + movement, word.length)];
  const value = applyEdit(local, type, arity, word[at]!, action);
  return value !== null ? [word.map((glyph, i) => i === at ? value : glyph), at] : null;
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
  if (local.layout.middleType !== undefined) return chooseComposedEdits(local, current, keys);
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

function chooseComposedEdits(local: RuleEditor, current: WordState, keys: readonly string[]): RuleEditChoice | null {
  const [word, focused] = current, { sides } = local.layout;
  const directions = new Map(Object.entries(local.directions).filter(([key]) => keys.includes(key)));
  const mutations = local.mutations.filter(action => keys.includes(action));
  const probes: string[][] = [];
  const domains = word.map((value, i) => {
    const { type, arity } = sides[i]!, paths = new Map<string, string[]>([[value, []]]);
    const queue = [value], travel = wordCursorPath(directions, focused, i, word.length);
    for (const token of queue) for (const action of mutations) {
      const next = applyEdit(local, type, arity, token, action), path = [...paths.get(token)!, action];
      if (next !== null) {
        if (!paths.has(next)) { paths.set(next, path); queue.push(next); }
      } else if (travel && !local.attempted.includes(context(type, arity, token, action))) probes.push([...travel, ...path]);
    }
    return paths;
  });
  const goals = composeRuleAssignments(local.layout, word, domains.map(paths => [...paths.keys()]));
  if (goals.some(goal => goal.every((value, i) => value === word[i]))) return null;
  const walks = new Map<string, string[] | null>();
  let best: RuleEditChoice | null = null;
  for (const goal of goals) {
    const edits = new Map(goal.flatMap((value, i) => value !== word[i] ? [[i, domains[i]!.get(value)!] as const] : []));
    const signature = [...edits.keys()].join(',');
    if (!walks.has(signature)) walks.set(signature, walkRuleRing(edits.keys(), directions, focused, word.length));
    const walk = walks.get(signature);
    if (!walk) continue;
    const cost = walk.length + [...edits.values()].reduce((sum, path) => sum + path.length, 0);
    if (best && cost >= best.actions.length) continue;
    const actions = [...(edits.get(focused) ?? [])];
    edits.delete(focused);
    let at = focused;
    for (const step of walk) {
      at = modulo(at + directions.get(step)!, word.length);
      actions.push(step, ...(edits.get(at) ?? []));
      edits.delete(at);
    }
    best = { actions, goal, exploration: false, dictionaries: goals.length };
  }
  if (best) return best;
  const survey = keys.find(action => !directions.has(action) && !mutations.includes(action) && !local.attempted.includes(action));
  const actions = survey ? [survey] : probes.sort((a, b) => a.length - b.length)[0];
  return actions ? { actions, goal: [...word], exploration: actions.length === 1, dictionaries: goals.length } : null;
}

function walkRuleRing(targets: Iterable<number>, directions: ReadonlyMap<string, number>, start: number, size: number): string[] | null {
  const needed = new Set(targets);
  needed.delete(start);
  if (!needed.size) return [];
  let best: string[] | null = null;
  // A shortest walk on a ring goes in one direction or reverses once.
  for (const [command, direction] of directions) {
    const reverse = [...directions].find(([, step]) => step === -direction)?.[0];
    for (let length = 0; length < size; length++) {
      const remaining = new Set(needed), route: string[] = [];
      let at = start;
      for (let i = 0; i < length && remaining.size; i++) {
        at = modulo(at + direction, size);
        remaining.delete(at);
        route.push(command);
      }
      if (reverse) for (let i = 0; i < size - 1 && remaining.size; i++) {
        at = modulo(at - direction, size);
        remaining.delete(at);
        route.push(reverse);
      }
      if (!remaining.size && (!best || route.length < best.length)) best = route;
    }
  }
  return best;
}

export function acquireRuleEdit(local: RuleEditor, before: WordState, after: WordState | null, action: string, ref: string): RuleEditor {
  const [word, at] = before, { type, arity } = local.layout.sides[at]!;
  const mutation = context(type, arity, word[at]!, action), directions = { ...local.directions }, edits = { ...local.edits };
  let groups = local.groups, mutations = local.mutations;
  if (after) {
    const [observed, focus] = after;
    const changed = word.flatMap((glyph, i) => observed[i] !== glyph ? [i] : []);
    if (at === focus && changed.length === 1 && changed[0] === at) {
      const typeGraph = { ...edits[type] };
      const unpack = (value: string) => local.layout.middleType === undefined ? [value] : JSON.parse(value) as string[];
      const originals = unpack(word[at]!), outputs = unpack(observed[at]!);
      const measured = originals.map((glyph, i) => [glyph, outputs[i]!] as const);
      if (new Map(measured).size !== new Set(measured.map(pair => JSON.stringify(pair))).size) {
        return { ...local, groups: local.groups.filter(group => group !== groupKey(type, arity)),
          attempted: [...new Set([...local.attempted, action, mutation])], count: local.count + 1 };
      }
      const edges = new Map(typeGraph[action]);
      if (local.layout.middleType !== undefined && measured.some(([a, b]) => edges.has(a) && edges.get(a) !== b)) {
        edges.clear();
        groups = groups.filter(group => (JSON.parse(group) as number[])[0] !== type);
      }
      for (const [a, b] of measured) edges.set(a, b);
      typeGraph[action] = [...edges];
      for (const [other, material] of Object.entries(typeGraph)) {
        if (other === action || !material.some(([from, to]) => measured.some(([a, b]) => from === b && to === a))) continue;
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
      const originals = local.layout.middleType === undefined ? [word[at]!] : JSON.parse(word[at]!) as string[];
      for (const glyph of originals) edges.delete(glyph);
      typeGraph[action] = [...edges];
      edits[type] = typeGraph;
    }
  }
  return { ...local, edits, directions, groups, mutations, attempted: [...new Set([...local.attempted, action, mutation])],
    evidence: [...new Set([...local.evidence.slice(-5), ref])], count: local.count + 1 };
}
