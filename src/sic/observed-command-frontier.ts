type Transition = { action: string; destination: string | null; evidence: string };
export type ObservedCommandGraph = Record<string, Transition[]>;

export function rememberCommandReturn(graph: ObservedCommandGraph, source: string, destination: string,
  action: string, evidence: string): void {
  if (!Object.hasOwn(graph, source)) {
    if (Object.keys(graph).length >= 384) return;
    graph[source] = [];
  }
  const edges = graph[source]!;
  const known = edges.find(edge => edge.action === action);
  if (!known) edges.push({ action, destination, evidence });
  else if (known.destination !== destination) known.destination = null;
}

/** Follow only witnessed transitions to a state with an untried command. */
export function observedCommandFrontier(graph: ObservedCommandGraph, current: string, actions: readonly string[], budget: number,
  actionsAt: (state: string) => readonly string[] = () => actions, deferProbe?: string) {
  type Route = { state: string; first: Transition | null; depth: number };
  const queue: Route[] = [{ state: current, first: null, depth: 0 }];
  const seen = new Set([current]);
  const attempts = new Map(actions.map(action => [action, 0]));
  for (const edges of Object.values(graph)) for (const edge of edges) {
    attempts.set(edge.action, (attempts.get(edge.action) ?? 0) + 1);
  }
  const compareProbes = (a: string, b: string) => Number(a === deferProbe) - Number(b === deferProbe)
    || (attempts.get(a) ?? 0) - (attempts.get(b) ?? 0);
  let best: { action: string; probe: string; depth: number; first: Transition | null } | null = null;
  for (const route of queue) {
    if (route.depth >= budget || (best && route.depth > best.depth)) break;
    const edges = graph[route.state] ?? [];
    for (const action of actionsAt(route.state)) {
      const edge = edges.find(candidate => candidate.action === action);
      if (!edge) {
        if (!best || compareProbes(action, best.probe) < 0) {
          best = { action: route.first?.action ?? action, probe: action, depth: route.depth, first: route.first };
        }
      } else if (edge.destination && !seen.has(edge.destination)) {
        seen.add(edge.destination);
        queue.push({ state: edge.destination, first: route.first ?? edge, depth: route.depth + 1 });
      }
    }
  }
  return best;
}
