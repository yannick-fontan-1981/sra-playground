/** Public hypotheses, rather than the identity of the current hidden world. */
export type AccessOutcome<State> = { observation: string; state: State };
export type AccessChoice<State, Action> = { action: Action; outcomes: AccessOutcome<State>[] };
export type ConditionalAccessProblem<State, Action> = {
  initial: State;
  key: (state: State) => string;
  goal: (state: State) => boolean;
  choices: (state: State) => Iterable<AccessChoice<State, Action>>;
  budget: { commands: number; states: number };
};
export type ConditionalAccessPolicy<Action> = {
  action: Action;
  branches: Record<string, ConditionalAccessPolicy<Action> | null>;
};
export type ConditionalAccessResult<Action> = {
  policy: ConditionalAccessPolicy<Action> | null;
  explored: number;
  discovered: number;
  worstCommands: number | null;
  status: 'solved' | 'no-policy' | 'state-budget';
};

/**
 * Build a bounded observation-contingent access policy. Every outcome must admit a
 * continuation; optimistic reachability of a single hidden world never closes a goal.
 * A solved policy describes a proposal only. An executed return must establish access.
 */
export function planConditionalAccess<State, Action>(
  problem: ConditionalAccessProblem<State, Action>
): ConditionalAccessResult<Action> {
  type Arc = { action: Action; outcomes: { observation: string; node: Node }[] };
  type Node = { state: State; depth: number; cost: number; selected?: Arc; incoming: { owner: Node; arc: Arc }[] };
  const frontier: Node[] = [], nodes = new Map<string, Node>();
  let limited = false, explored = 0;
  const obtain = (state: State, depth: number): Node | undefined => {
    const key = problem.key(state), prior = nodes.get(key);
    if (prior) return prior;
    if (nodes.size >= problem.budget.states) { limited = true; return undefined; }
    const node: Node = { state, depth, cost: problem.goal(state) ? 0 : Infinity, incoming: [] };
    nodes.set(key, node);
    frontier.push(node);
    return node;
  };
  const root = obtain(problem.initial, 0);
  if (!root) return { policy: null, explored: 0, discovered: 0, worstCommands: null, status: 'state-budget' };
  const propagate = (owner: Node, arc: Arc) => {
    const changes: { owner: Node; arc: Arc }[] = [{ owner, arc }];
    for (let index = 0; index < changes.length; index++) {
      const change = changes[index]!;
      const cost = 1 + Math.max(...change.arc.outcomes.map(outcome => outcome.node.cost));
      if (cost > problem.budget.commands || cost >= change.owner.cost) continue;
      change.owner.cost = cost;
      change.owner.selected = change.arc;
      changes.push(...change.owner.incoming);
    }
  };
  for (let index = 0; index < frontier.length && explored < problem.budget.states; index++) {
    if (Number.isFinite(root.cost)) break;
    const node = frontier[index]!;
    explored++;
    if (node.cost === 0 || node.depth >= problem.budget.commands) continue;
    for (const choice of problem.choices(node.state)) {
      if (!choice.outcomes.length) continue;
      const outcomes = choice.outcomes.map(outcome => ({ observation: outcome.observation,
        node: obtain(outcome.state, node.depth + 1) }));
      if (outcomes.some(outcome => !outcome.node)) continue;
      const arc: Arc = { action: choice.action, outcomes: outcomes as Arc['outcomes'] };
      for (const outcome of arc.outcomes) outcome.node.incoming.push({ owner: node, arc });
      propagate(node, arc);
    }
  }
  if (!Number.isFinite(root.cost)) return { policy: null, explored, discovered: nodes.size,
    worstCommands: null, status: limited ? 'state-budget' : 'no-policy' };
  const cache = new Map<Node, ConditionalAccessPolicy<Action> | null>();
  const emit = (node: Node): ConditionalAccessPolicy<Action> | null => {
    if (node.cost === 0) return null;
    if (cache.has(node)) return cache.get(node)!;
    const selected = node.selected!;
    const result: ConditionalAccessPolicy<Action> = { action: selected.action, branches: {} };
    cache.set(node, result);
    for (const outcome of selected.outcomes) result.branches[outcome.observation] = emit(outcome.node);
    return result;
  };
  return { policy: emit(root), explored, discovered: nodes.size, worstCommands: root.cost, status: 'solved' };
}
