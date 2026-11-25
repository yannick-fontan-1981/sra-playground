export type Condition<State> = { relation: string; holds: (state: State) => boolean };

export type ComposableEffect<State, Action> = {
  action: Action;
  after: State;
  requires?: readonly Condition<State>[];
  maintains?: readonly Condition<State>[];
  ensures?: readonly Condition<State>[];
  during?: readonly State[];
  evidence?: readonly string[];
};

export type Composition<State, Action> = {
  end: State;
  effects: ComposableEffect<State, Action>[];
  explored: number;
};

export type CompositionProblem<State, Action> = {
  domain: string;
  initial: State;
  key: (state: State) => string | number;
  goal: Condition<State>;
  choices: (state: State) => Iterable<ComposableEffect<State, Action>>;
  budget: { commands: number; states: number };
  /** At equal state, a retained resource can dominate a poorer arrival. */
  reserve?: (state: State) => number;
  interrupted?: () => boolean;
};

type Entry<State, Action> = {
  state: State;
  depth: number;
  result?: ComposableEffect<State, Action>;
  predecessor?: Entry<State, Action>;
};

function accepts<State, Action>(before: State, effect: ComposableEffect<State, Action>) {
  if (effect.requires?.some(condition => !condition.holds(before))) return false;
  if (effect.maintains?.some(condition => !condition.holds(before) || !condition.holds(effect.after)
    || effect.during?.some(state => !condition.holds(state)))) return false;
  return !effect.ensures?.some(condition => !condition.holds(effect.after));
}

/** Compose admissible effects. Callers bind them to observations and verify actual returns. */
export function composePlan<State, Action>(problem: CompositionProblem<State, Action>): Composition<State, Action> | undefined {
  const { initial, key, goal, choices, budget, reserve, interrupted } = problem;
  const frontier: Entry<State, Action>[] = [{ state: initial, depth: 0 }];
  const bestReserve = new Map([[key(initial), reserve?.(initial) ?? 0]]);
  for (let cursor = 0; cursor < frontier.length; cursor++) {
    if ((cursor & 63) === 0 && interrupted?.()) return;
    const entry = frontier[cursor]!;
    if (goal.holds(entry.state)) {
      const effects: ComposableEffect<State, Action>[] = [];
      for (let node: Entry<State, Action> | undefined = entry; node?.result; node = node.predecessor) {
        effects.push(node.result);
      }
      return { end: entry.state, effects: effects.reverse(), explored: cursor + 1 };
    }
    if (entry.depth >= budget.commands || frontier.length >= budget.states) continue;
    for (const result of choices(entry.state)) {
      if (frontier.length >= budget.states) break;
      if (!accepts(entry.state, result)) continue;
      const identity = key(result.after), quantity = reserve?.(result.after) ?? 0;
      if ((bestReserve.get(identity) ?? -Infinity) >= quantity) continue;
      bestReserve.set(identity, quantity);
      frontier.push({ state: result.after, depth: entry.depth + 1, result, predecessor: entry });
    }
  }
}
