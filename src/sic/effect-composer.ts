export type Condition<State> = {
  relation: string;
  holds: (state: State) => boolean;
};

export type ComposableEffect<State, Action> = {
  action: Action;
  after: State;
  requires?: readonly Condition<State>[];
  maintains?: readonly Condition<State>[];
  ensures?: readonly Condition<State>[];
  during?: readonly State[];
  evidence?: readonly string[];
};

export type CompositionProblem<State, Action> = {
  initial: State;
  key: (state: State) => string | number;
  goal: Condition<State>;
  choices: (state: State) => Iterable<ComposableEffect<State, Action>>;
  /** States counts examined positions, including the initial position. */
  budget: { commands: number; states: number };
};

export type Composition<State, Action> = {
  end: State;
  effects: ComposableEffect<State, Action>[];
  explored: number;
};

type Entry<State, Action> = {
  state: State;
  depth: number;
  effect?: ComposableEffect<State, Action>;
  previous?: Entry<State, Action>;
};

function accepts<State, Action>(before: State, effect: ComposableEffect<State, Action>): boolean {
  if (effect.requires?.some(condition => !condition.holds(before))) return false;
  if (effect.maintains?.some(condition => !condition.holds(before) || !condition.holds(effect.after)
    || effect.during?.some(state => !condition.holds(state)))) return false;
  return !effect.ensures?.some(condition => !condition.holds(effect.after));
}

/** Finds the first shortest admissible composition in the caller's choice order. */
export function composePlan<State, Action>(problem: CompositionProblem<State, Action>): Composition<State, Action> | undefined {
  const { initial, key, goal, choices, budget } = problem;
  const frontier: Entry<State, Action>[] = [{ state: initial, depth: 0 }];
  const seen = new Set([key(initial)]);
  for (let index = 0; index < frontier.length && index < budget.states; index++) {
    const entry = frontier[index]!;
    if (goal.holds(entry.state)) {
      const effects: ComposableEffect<State, Action>[] = [];
      for (let node: Entry<State, Action> | undefined = entry; node?.effect; node = node.previous) {
        effects.push(node.effect);
      }
      return { end: entry.state, effects: effects.reverse(), explored: index + 1 };
    }
    if (entry.depth >= budget.commands || index + 1 >= budget.states) continue;
    for (const effect of choices(entry.state)) {
      if (!accepts(entry.state, effect)) continue;
      const identity = key(effect.after);
      if (seen.has(identity)) continue;
      seen.add(identity);
      frontier.push({ state: effect.after, depth: entry.depth + 1, effect, previous: entry });
    }
  }
}
