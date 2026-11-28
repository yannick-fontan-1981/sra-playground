/** Data-only P07 protocol. Oracle and runtime may share these types, never executable semantics. */
export type Predicate =
  | { variable: string; eq: number }
  | { variable: string; min: number }
  | { variable: string; max: number }
  | { all: Predicate[] }
  | { any: Predicate[] }
  | { not: Predicate };
export type Values = Record<string, number>;
export type Update = { variable: string; set: number } | { variable: string; add: number };
export type AccessAction = {
  id: string;
  kind: 'move' | 'select' | 'contact' | 'interact' | 'observe' | 'build' | 'wait';
  requires: Predicate;
  updates: Update[];
  /** Conditional effects evaluate against the pre-command state, all apply simultaneously. */
  branches?: { when: Predicate; updates: Update[]; events?: AccessEvent[] }[];
  events?: AccessEvent[];
  /** Preconditions rechecked after timer decay, before effects (window must cover the command). */
  throughout?: Predicate;
};
export type AccessEvent =
  | { kind: 'crossing'; actor: string; from: number; to: number; dependency?: string }
  | { kind: 'observation'; subject: string; variable: string }
  | { kind: 'access'; subject: string; dependency: string }
  | { kind: 'official-win' }
  | { kind: 'invalidation'; segment: string }
  | { kind: 'support'; dependency: string };
export type AccessScenario = {
  protocol: 'sic-p07-access-v1';
  id: string;
  family: string;
  seed: number;
  /** No actual-world selector is part of the agent input. Every initial hypothesis is evaluated. */
  initial: Values[];
  variables: { id: string; role: string; hidden?: boolean; visibleWhen?: Predicate; timer?: boolean }[];
  actions: AccessAction[];
  goal: Predicate;
  invariant: Predicate;
  /** P09 must preserve this in addition to the base invariant, across every primitive command. */
  parentInvariant: Predicate;
  budget: { commands: number; states: number };
  /** Exact route/dependency structure; contains no seed, labels, rendering or presentation order. */
  structure: unknown;
  presentation: { rotation: number; offset: [number, number]; palette: number[] };
  /** Targeted interventions, applied immediately before the first consumption of this dependency. */
  ablations?: { dependency: string; kind: 'support' | 'opening' | 'route-proof'; updates?: Update[]; actions?: string[] }[];
  /** Optional public camera calibration problem: no entity identifier in the rendered observations. */
  view?: {
    revealedWhen: Predicate;
    assignment: string;
    targetBefore: [number, number];
    anchorsBefore: [number, number][];
    anchorsAfter: [number, number][];
    subjectsAfter: [number, number][];
  };
};
export type PublicObservation = {
  values: Values;
  feedback: 'initial' | 'ok' | 'blocked';
  view?: { targetBefore: [number, number]; anchorsBefore: [number, number][];
    anchorsAfter: [number, number][]; subjectsAfter: [number, number][] };
};
export type PlayedStep = {
  action: string;
  observation: PublicObservation;
  /** A coordinate correspondence claim, not a hidden subject ID. */
  identityClaim?: number;
};
export type AccessPolicy = { action: string; branches: Record<string, AccessPolicy | null>; identityClaim?: number };
