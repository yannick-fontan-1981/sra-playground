import { planConditionalAccess } from './access-policy.ts';
import { composePlan, type ComposableEffect } from './effect-composer.ts';
import { p05ConditionsHold, type P05AcquisitionLedger, type P05Observation } from './p05-acquisition.ts';
import type { TemporalPrediction } from './temporal-evidence.ts';

export type TimedAccessEdge = { command: string; from: string; to: string; duration: number; timed: boolean };

export type ObservedTimedAccess = {
  observation: P05Observation;
  position: string;
  target: string;
  activation: { command: string; from: string };
  /** Set by the caller only after the ticket for activation has returned. */
  pendingUntil?: number;
  wait: string;
  enabled: readonly string[];
  edges: readonly TimedAccessEdge[];
  ledger: P05AcquisitionLedger;
  windowAt: (tick: number) => TemporalPrediction | undefined;
  budget: { commands: number; states: number; lastTick: number };
  chargeState?: () => boolean;
};

type State = { position: string; tick: number; readyAt: number | null; reserve: number };
type Step = { command: string; destination: string; end: number; openingTicks: number[] };

/** Proposes only a first step. A new public return must justify the next decision. */
export function composeObservedTimedAccess(input: ObservedTimedAccess) {
  const { observation, budget, activation } = input;
  const initial: State = { position: input.position, tick: observation.tick, reserve: observation.reserve,
    readyAt: observation.remote > 0 ? observation.tick
      : input.pendingUntil !== undefined && input.pendingUntil > observation.tick ? input.pendingUntil : null };
  const claim = input.ledger.claims().find(effect => effect.command === activation.command && effect.remoteDelta > 0
    && effect.resourceCost >= 0 && effect.supportingReturnIds.length > 0 && p05ConditionsHold(effect.conditions, observation));
  let explored = 0;
  function charge() {
    if (explored >= budget.states || input.chargeState && !input.chargeState()) return false;
    explored++;
    return true;
  }
  const key = (state: State) => JSON.stringify([state.position, state.tick, state.readyAt, state.reserve]);
  const goal = (state: State) => state.position === input.target;
  const enabled = (state: State, command: string) => state !== initial || input.enabled.includes(command);
  function* choices(state: State): Generator<ComposableEffect<State, Step>> {
    if (state.tick >= budget.lastTick) return;
    const end = state.tick + 1;
    if (claim && state.position === activation.from && state.readyAt === null && state.reserve >= claim.resourceCost
      && enabled(state, activation.command)) {
      yield { action: { command: activation.command, destination: state.position, end, openingTicks: [] },
        after: { ...state, tick: end, reserve: state.reserve - claim.resourceCost, readyAt: end + claim.delay },
        evidence: claim.supportingReturnIds };
    }
    for (const edge of input.edges) {
      if (edge.from !== state.position || !enabled(state, edge.command) || edge.duration < 1
        || !Number.isSafeInteger(edge.duration) || state.tick + edge.duration > budget.lastTick) continue;
      const ticks = edge.timed ? Array.from({ length: edge.duration }, (_, index) => state.tick + index + 1) : [];
      if (edge.timed && (state.readyAt === null || ticks[0]! < state.readyAt
        || state === initial && observation.remote <= 0)) continue;
      const proofs = ticks.map(input.windowAt);
      if (proofs.some(proof => proof?.value !== 1 || !proof.evidence.length)) continue;
      const arrival = state.tick + edge.duration;
      yield { action: { command: edge.command, destination: edge.to, end: arrival, openingTicks: ticks },
        after: { ...state, tick: arrival, position: edge.to }, evidence: [...new Set(proofs.flatMap(proof => proof!.evidence))],
        requires: edge.timed ? [{ relation: 'activation_and_window_cover_every_crossing_tick', holds: before =>
          before.readyAt !== null && before.readyAt <= ticks[0]! && ticks.every(tick => input.windowAt(tick)?.value === 1) }] : [],
        ensures: [{ relation: 'access_destination', holds: after => after.position === edge.to }] };
    }
    if (enabled(state, input.wait)) yield { action: { command: input.wait, destination: state.position, end, openingTicks: [] },
      after: { ...state, tick: end } };
  }
  const access = planConditionalAccess({ initial, key, goal, budget, chargeState: charge,
    choices: function* (state) {
      for (const effect of choices(state)) {
        yield { action: effect.action, outcomes: [{ observation: key(effect.after), state: effect.after }] };
      }
    } });
  if (!access.policy) return { step: null, explored, evidence: [] };
  const first = access.policy.action;
  // The unmodified P09 checks its goal exactly once at each dequeued state.
  const exhausted = Symbol('search quota');
  let composition;
  try {
    composition = composePlan({ initial, key, budget,
      goal: { relation: 'reach_goal_in_measured_window', holds(state) {
        if (!charge()) throw exhausted;
        return goal(state);
      } },
      choices(state) {
        return state === initial ? [...choices(state)].filter(effect => effect.action.command === first.command
          && effect.action.destination === first.destination && effect.action.end === first.end) : choices(state);
      },
    });
  } catch (error) {
    if (error !== exhausted) throw error;
    return { step: null, explored, evidence: [] };
  }
  if (!composition?.effects[0]) return { step: null, explored, evidence: [] };
  return { step: composition.effects[0].action, explored,
    evidence: [...new Set(composition.effects.flatMap(effect => effect.evidence ?? []))] };
}
