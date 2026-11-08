/** Pinned SingleVisitResidual D contract and trace_field_methods finite witness search. */
import { symbolicDigest as identity } from './v6-hash.ts';
import { comparePoints, pointKey, type Point } from './v6-point-set.ts';

type R = Record<string, any>;
type Clock = () => number;
type Adjacency = Map<string, [string, string][]>;
const OPERATION = 'mechanics.coverage_partition.single_visit_residual';
const compareRefs = (a: string, b: string): number => {
  const left = [...a], right = [...b];
  for (let i = 0; i < Math.min(left.length, right.length); i++) {
    const difference = left[i]!.codePointAt(0)! - right[i]!.codePointAt(0)!;
    if (difference) return difference;
  }
  return left.length - right.length;
};
const sorted = (values: Iterable<string>): string[] => [...values].sort(compareRefs);
const subset = (a: Set<string>, b: Set<string>): boolean => [...a].every(value => b.has(value));
const intersection = (a: Set<string>, b: Set<string>): Set<string> => new Set([...a].filter(value => b.has(value)));
const difference = (a: Set<string>, b: Set<string>): Set<string> => new Set([...a].filter(value => !b.has(value)));
const pairKey = (a: string, b: string): string => JSON.stringify([a, b].sort(compareRefs));

class Interrupted extends Error {
  readonly cause: string;
  readonly frontier: R;
  constructor(cause: string, frontier: R = {}) { super(cause); this.cause = cause; this.frontier = frontier; }
}
class Budget {
  examined = 0;
  private readonly started: number;
  readonly request: R;
  readonly now: Clock;
  constructor(request: R, now: Clock) { this.request = request; this.now = now; this.started = now(); }
  visit(frontier: R = {}): void {
    if (this.examined >= this.request.node_bound) throw new Interrupted('NODE_BOUND', frontier);
    if (this.now() - this.started >= this.request.time_bound_ms) throw new Interrupted('TIME_BOUND', frontier);
    this.examined++;
  }
  finish(): void { if (this.now() - this.started >= this.request.time_bound_ms) throw new Interrupted('TIME_BOUND'); }
}

function result(q: R, status: string, cause: string, values: R = {}, complete = false, examined = 0, frontier: R = {}): R {
  const facts: R = {};
  for (const key of ['request_ref', 'caller_ref', 'parent_consumer_ref', 'parent_goal_ref', 'parent_contribution_ref',
    'caller_next_item_ref', 'epoch', 'evidence_revision_ref', 'model_revision_ref', 'event_owner_ref']) facts[key] = q.scope[key];
  Object.assign(facts, { operation_ref: q.operation_ref, mode_ref: q.mode_ref, status, cause, domain_complete: complete,
    examined_count: examined, primitive_release_authorized: false, retained_model_refs: [] });
  return { schema_version: 'yf_arc3_v5.d_mechanical_result.v1', scope: structuredClone(q.scope), operation_ref: q.operation_ref,
    mode_ref: q.mode_ref, status, cause, values, domain_complete: complete, examined_count: examined, frontier,
    descriptive_facts: facts, source_disposition_ref: null, source_policy_ref: null };
}
function exactInteger(value: unknown, minimum: number, maximum = Number.MAX_SAFE_INTEGER): asserts value is number {
  if (!Number.isSafeInteger(value) || (value as number) < minimum || (value as number) > maximum) throw new TypeError('Residual mechanic requires a bounded exact integer');
}
function reference(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError('Residual mechanic requires a nonempty reference');
  return value.trim();
}
function references(values: unknown, minimum = 0, maximum = 4096): string[] {
  if (!Array.isArray(values) || values.length < minimum || values.length > maximum) throw new TypeError('Residual reference domain bounds');
  return values.map(reference);
}
function object(value: unknown): asserts value is R {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Residual descriptive mapping required');
}
function knownKeys(value: R, keys: readonly string[]): void {
  if (Object.keys(value).some(key => !keys.includes(key))) throw new TypeError('Unknown residual contract field');
}
function normalize(input: R): R {
  object(input);
  const q: R = { schema_version: 'yf_arc3_v5.single_visit_residual_request_d.v1', observations: [], resume_frontier: {},
    edges: [], remaining_node_refs: [], ordered_prefix: [], forced_edge_refs: [], forbidden_edge_refs: [], ...structuredClone(input) };
  knownKeys(q, ['schema_version', 'scope', 'operation_ref', 'mode_ref', 'requested_result_type', 'node_bound', 'depth_bound', 'domain_bound',
    'time_bound_ms', 'observations', 'resume_frontier', 'phase_ref', 'graph_revision_ref', 'node_refs', 'edges', 'head_ref', 'endpoint_ref',
    'visited_node_refs', 'remaining_node_refs', 'ordered_prefix', 'append_only_projection_certified', 'simple_path_law_supported',
    'endpoint_last_visit_law_supported', 'licensed_bipartite_parity', 'forced_edge_refs', 'forbidden_edge_refs']);
  object(q.scope); q.scope = { assumption_refs: [], ...q.scope };
  const scopeRefs = ['request_ref', 'caller_ref', 'parent_consumer_ref', 'parent_goal_ref', 'parent_contribution_ref', 'caller_next_item_ref',
    'evidence_revision_ref', 'model_revision_ref', 'model_status_ref', 'event_owner_ref'];
  knownKeys(q.scope, [...scopeRefs, 'epoch', 'input_domain_complete', 'assumption_refs']);
  for (const key of scopeRefs) q.scope[key] = reference(q.scope[key]);
  exactInteger(q.scope.epoch, 0); q.scope.assumption_refs = references(q.scope.assumption_refs, 0, 64);
  if (typeof q.scope.input_domain_complete !== 'boolean') throw new TypeError('Residual input completeness must be explicit');
  for (const key of ['schema_version', 'operation_ref', 'requested_result_type', 'graph_revision_ref', 'head_ref', 'endpoint_ref']) q[key] = reference(q[key]);
  if (q.mode_ref !== null) q.mode_ref = reference(q.mode_ref);
  for (const [key, maximum] of [['node_bound', 100000], ['depth_bound', 4096], ['domain_bound', 4096], ['time_bound_ms', 300000]] as const) exactInteger(q[key], 1, maximum);
  if (q.phase_ref !== 'RESIDUAL_GRAPH') throw new TypeError('Invalid residual phase');
  for (const key of ['append_only_projection_certified', 'simple_path_law_supported', 'endpoint_last_visit_law_supported', 'licensed_bipartite_parity']) {
    if (typeof q[key] !== 'boolean') throw new TypeError('Residual path qualification must be explicit');
  }
  for (const key of ['node_refs', 'visited_node_refs', 'remaining_node_refs', 'ordered_prefix', 'forced_edge_refs', 'forbidden_edge_refs']) {
    q[key] = references(q[key], ['node_refs', 'visited_node_refs'].includes(key) ? 1 : 0);
  }
  if (!Array.isArray(q.observations) || q.observations.length > 4096) throw new TypeError('Residual observation domain bounds');
  for (const observation of q.observations) object(observation);
  object(q.resume_frontier);
  if (!Array.isArray(q.edges) || q.edges.length > 4096) throw new TypeError('Residual edge domain bounds');
  q.edges = q.edges.map((edge: R) => {
    object(edge); knownKeys(edge, ['edge_ref', 'first_ref', 'second_ref']);
    return Object.fromEntries(['edge_ref', 'first_ref', 'second_ref'].map(key => [key, reference(edge[key])]));
  });
  const nodes = new Set<string>(q.node_refs), visited = new Set<string>(q.visited_node_refs), remaining = new Set<string>(q.remaining_node_refs);
  if (nodes.size !== q.node_refs.length || visited.size !== q.visited_node_refs.length) throw new TypeError('Duplicate residual vertex or visited identity');
  if (!visited.has(q.head_ref) || !nodes.has(q.endpoint_ref) || !subset(visited, nodes)) throw new TypeError('Head, endpoint or visited identities outside graph');
  const complement = difference(nodes, visited);
  if (remaining.size !== q.remaining_node_refs.length || remaining.size !== complement.size || !subset(remaining, complement)) throw new TypeError('Remaining domain differs from exact visited complement');
  const edgeRefs = new Set<string>(), pairs = new Set<string>();
  for (const edge of q.edges as R[]) {
    const pair = pairKey(edge.first_ref, edge.second_ref);
    if (!nodes.has(edge.first_ref) || !nodes.has(edge.second_ref) || edge.first_ref === edge.second_ref) throw new TypeError('Invalid residual edge endpoints');
    if (edgeRefs.has(edge.edge_ref) || pairs.has(pair)) throw new TypeError('Duplicate edge identity or undirected pair');
    edgeRefs.add(edge.edge_ref); pairs.add(pair);
  }
  if (!subset(new Set(q.forced_edge_refs), edgeRefs) || !subset(new Set(q.forbidden_edge_refs), edgeRefs)) throw new TypeError('Edge constraint outside supplied graph');
  if (q.ordered_prefix.length) {
    const prefix = new Set<string>(q.ordered_prefix);
    if (q.ordered_prefix.at(-1) !== q.head_ref || prefix.size !== q.ordered_prefix.length || prefix.size !== visited.size || !subset(prefix, visited)) throw new TypeError('Ordered prefix differs from head/visited projection');
    for (let i = 1; i < q.ordered_prefix.length; i++) if (!pairs.has(pairKey(q.ordered_prefix[i - 1], q.ordered_prefix[i]))) throw new TypeError('Ordered prefix includes absent physical edge');
  }
  return q;
}
function inputDigest(q: R): string {
  return identity(Object.fromEntries(Object.entries(q).filter(([key]) => !['node_bound', 'depth_bound', 'domain_bound', 'time_bound_ms', 'resume_frontier'].includes(key))));
}
function resumedRounds(frontier: R): number {
  const value: unknown = Object.hasOwn(frontier, 'completed_rounds') ? frontier.completed_rounds : 0;
  // Python int() rejects null, nonfinite numbers and nonintegral text. The
  // native JSON contract additionally requires exact safe integer transport.
  if (typeof value !== 'number' && typeof value !== 'boolean' && !(typeof value === 'string' && /^[+-]?\d+$/.test(value.trim()))) {
    throw new TypeError('Invalid residual resume round count');
  }
  const number = Number(value), rounds = Math.trunc(number);
  if (!Number.isFinite(number) || !Number.isSafeInteger(rounds)) throw new TypeError('Residual resume round count outside exact native domain');
  return rounds;
}
function components(vertices: Set<string>, adjacency: Adjacency, budget: Budget): string[][] {
  const unseen = new Set(vertices), groups: string[][] = [];
  while (unseen.size) {
    const root = sorted(unseen)[0]!, pending = [root], group: string[] = [];
    unseen.delete(root);
    while (pending.length) {
      const vertex = pending.pop()!; budget.visit({ stage: 'components', vertex_ref: vertex }); group.push(vertex);
      for (const [neighbor] of adjacency.get(vertex) ?? []) if (unseen.has(neighbor)) { unseen.delete(neighbor); pending.push(neighbor); }
    }
    groups.push(group.sort(compareRefs));
  }
  return groups;
}
function cutCounts(vertices: Set<string>, adjacency: Adjacency, budget: Budget, depthBound: number): R {
  const discovered = new Map<string, number>(), low = new Map<string, number>(), parent = new Map<string, string | null>();
  const children = new Map<string, number>(), separated = new Map<string, number>();
  let componentCount = 0, clock = 0;
  for (const root of sorted(vertices)) {
    if (discovered.has(root)) continue;
    componentCount++; discovered.set(root, clock); low.set(root, clock); clock++;
    parent.set(root, null); children.set(root, 0); separated.set(root, 0);
    const stack: { vertex: string; next: number }[] = [{ vertex: root, next: 0 }];
    while (stack.length) {
      if (stack.length > depthBound) throw new Interrupted('DEPTH_BOUND', { stage: 'cuts', vertex_ref: stack.at(-1)!.vertex });
      const top = stack.at(-1)!, vertex = top.vertex, neighbors = adjacency.get(vertex) ?? [];
      budget.visit({ stage: 'cuts', vertex_ref: vertex });
      if (top.next >= neighbors.length) {
        stack.pop(); const predecessor = parent.get(vertex)!;
        if (predecessor !== null) {
          low.set(predecessor, Math.min(low.get(predecessor)!, low.get(vertex)!));
          if (low.get(vertex)! >= discovered.get(predecessor)!) separated.set(predecessor, separated.get(predecessor)! + 1);
        }
        continue;
      }
      const [neighbor] = neighbors[top.next++]!;
      if (!discovered.has(neighbor)) {
        parent.set(neighbor, vertex); children.set(neighbor, 0); separated.set(neighbor, 0); children.set(vertex, children.get(vertex)! + 1);
        discovered.set(neighbor, clock); low.set(neighbor, clock); clock++; stack.push({ vertex: neighbor, next: 0 });
      } else if (neighbor !== parent.get(vertex)) low.set(vertex, Math.min(low.get(vertex)!, discovered.get(neighbor)!));
    }
  }
  return Object.fromEntries(sorted(vertices).map(vertex => [vertex, componentCount - 1 + (parent.get(vertex) === null ? children.get(vertex)! : separated.get(vertex)! + 1)]));
}
function parity(vertices: Set<string>, adjacency: Adjacency, head: string, endpoint: string, budget: Budget): R {
  const colors = new Map<string, number>();
  for (const root of sorted(vertices)) {
    if (colors.has(root)) continue;
    colors.set(root, 0); const pending = [root];
    while (pending.length) {
      const vertex = pending.pop()!; budget.visit({ stage: 'bipartition', vertex_ref: vertex });
      for (const [neighbor] of adjacency.get(vertex) ?? []) {
        if (!colors.has(neighbor)) { colors.set(neighbor, 1 - colors.get(vertex)!); pending.push(neighbor); }
        else if (colors.get(neighbor) === colors.get(vertex)) return { bipartite: false, count_condition: null };
      }
    }
  }
  const counts = [[...colors.values()].filter(value => value === 0).length, [...colors.values()].filter(value => value === 1).length];
  const same = colors.get(head) === colors.get(endpoint), color = colors.get(head)!;
  const valid = same ? counts[color] === counts[1 - color]! + 1 : counts[0] === counts[1];
  return { bipartite: true, partition_counts: counts, same_endpoint_partition: same, count_condition: valid };
}

export function measureSingleVisitResidual(input: R, now: Clock = () => performance.now()): R {
  const q = normalize(input);
  if (q.operation_ref !== OPERATION || !['EVALUATE', 'PROPAGATE'].includes(q.mode_ref) || q.requested_result_type !== 'DMechanicalResult') return result(q, 'NOT_APPLICABLE', 'SIGNATURE_MISMATCH');
  if (!q.scope.input_domain_complete) return result(q, 'NEEDS_EVIDENCE', 'INPUT_DOMAIN_INCOMPLETE');
  if (['evidence_revision_ref', 'model_revision_ref', 'event_owner_ref', 'caller_next_item_ref'].some(key => !q.scope[key])) return result(q, 'NEEDS_EVIDENCE', 'REQUEST_SCOPE_INCOMPLETE');
  if (Math.max(q.node_refs.length, q.edges.length) > q.domain_bound) return result(q, 'NEEDS_EVIDENCE', 'INPUT_DOMAIN_BOUND');
  if (!q.simple_path_law_supported || !q.ordered_prefix.length && !q.append_only_projection_certified) return result(q, 'NEEDS_EVIDENCE', 'PATH_OR_PROJECTED_STATE_LAW_UNQUALIFIED');
  if (q.head_ref === q.endpoint_ref && q.remaining_node_refs.length && !q.endpoint_last_visit_law_supported) return result(q, 'NEEDS_EVIDENCE', 'ENDPOINT_REENTRY_LAW_UNQUALIFIED');
  const vertices = new Set<string>([...q.remaining_node_refs, q.head_ref]), allEdges = new Map<string, R>((q.edges as R[]).map(edge => [edge.edge_ref, edge]));
  const relevant = new Set(sorted(allEdges.keys()).filter(ref => vertices.has(allEdges.get(ref)!.first_ref) && vertices.has(allEdges.get(ref)!.second_ref)));
  let forced = new Set<string>(q.forced_edge_refs), forbidden = new Set<string>(q.forbidden_edge_refs), witnesses: R[] = [], roundIndex = 0;
  const digest = inputDigest(q);
  if (Object.keys(q.resume_frontier).length) {
    const resume = q.resume_frontier;
    if (resume.input_digest !== digest || resume.request_ref !== q.scope.request_ref || resume.graph_revision_ref !== q.graph_revision_ref) return result(q, 'NEEDS_EVIDENCE', 'RESUME_SCOPE_MISMATCH');
    forced = new Set(resume.forced_edge_refs ?? []); forbidden = new Set(resume.forbidden_edge_refs ?? []);
    witnesses = [...(resume.reduction_witnesses ?? [])]; roundIndex = resumedRounds(resume);
    if (!subset(forced, relevant) || !subset(forbidden, new Set(allEdges.keys())) || !subset(new Set(q.forced_edge_refs), forced)
      || !subset(new Set(q.forbidden_edge_refs), forbidden)) return result(q, 'NEEDS_EVIDENCE', 'RESUME_EDGE_DOMAIN_MISMATCH');
  }
  const budget = new Budget(q, now), contradictions: R[] = [];
  try {
    if (!q.remaining_node_refs.length && q.head_ref === q.endpoint_ref) {
      budget.visit({ stage: 'empty_suffix' });
      return result(q, 'COMPLETE', 'EMPTY_SUFFIX_CALCULATED', { empty_suffix: true, degree_requirements: { [q.head_ref]: 0 }, contradiction_certificates: [] }, true, budget.examined);
    }
    if (!vertices.has(q.endpoint_ref) || q.head_ref === q.endpoint_ref) contradictions.push({ code: 'ENDPOINT_ALREADY_VISITED_WITH_REMAINDER', node_refs: [q.endpoint_ref] });
    const outside = difference(forced, relevant), conflicting = intersection(forced, forbidden);
    if (outside.size) contradictions.push({ code: 'FORCED_EDGE_OUTSIDE_RESIDUAL', edge_refs: sorted(outside) });
    if (conflicting.size) contradictions.push({ code: 'FORCED_AND_FORBIDDEN', edge_refs: sorted(conflicting) });
    const requirements: R = Object.fromEntries(sorted(vertices).map(vertex => [vertex, vertex === q.head_ref || vertex === q.endpoint_ref ? 1 : 2]));
    let groups: string[][] = [], cuts: R = {}, parityResult: R | null = null;
    const checkForced = (): void => {
      const adjacency: Adjacency = new Map(sorted(vertices).map(vertex => [vertex, []]));
      for (const ref of sorted(intersection(forced, relevant))) {
        const edge = allEdges.get(ref)!;
        adjacency.get(edge.first_ref)!.push([edge.second_ref, ref]); adjacency.get(edge.second_ref)!.push([edge.first_ref, ref]);
      }
      for (const group of components(vertices, adjacency, budget)) {
        if (group.length > 1 && group.every(vertex => adjacency.get(vertex)!.length === 2)) contradictions.push({ code: 'FORCED_CLOSED_SUBTOUR', node_refs: group });
        if (group.includes(q.head_ref) && group.includes(q.endpoint_ref) && group.length < vertices.size
          && group.every(vertex => adjacency.get(vertex)!.length === requirements[vertex])) contradictions.push({ code: 'SATURATED_HEAD_ENDPOINT_CHAIN_LEAVES_REMAINDER', node_refs: group });
      }
    };
    while (!contradictions.length) {
      const adjacency: Adjacency = new Map(sorted(vertices).map(vertex => [vertex, []]));
      for (const ref of sorted(difference(relevant, forbidden))) {
        budget.visit({ stage: 'edges', edge_ref: ref }); const edge = allEdges.get(ref)!;
        adjacency.get(edge.first_ref)!.push([edge.second_ref, ref]); adjacency.get(edge.second_ref)!.push([edge.first_ref, ref]);
      }
      groups = components(vertices, adjacency, budget);
      if (groups.length > 1) contradictions.push({ code: 'UNFINISHED_SUFFIX_DISCONNECTED', components: groups });
      cuts = cutCounts(vertices, adjacency, budget, q.depth_bound);
      for (const vertex of sorted(vertices)) {
        budget.visit({ stage: 'degrees', vertex_ref: vertex });
        const incident = new Set(adjacency.get(vertex)!.map(([, ref]) => ref)), fixed = intersection(incident, forced);
        if (incident.size < requirements[vertex] || fixed.size > requirements[vertex]) contradictions.push({ code: 'UNFINISHED_SUFFIX_DEGREE_CONTRADICTION',
          node_ref: vertex, available_degree: incident.size, forced_degree: fixed.size, required_degree: requirements[vertex] });
        if (cuts[vertex] > requirements[vertex]) contradictions.push({ code: 'UNFINISHED_SUFFIX_CUT_CONTRADICTION', node_ref: vertex, components_after_removal: cuts[vertex] });
      }
      if (q.licensed_bipartite_parity) {
        parityResult = parity(vertices, adjacency, q.head_ref, q.endpoint_ref, budget);
        if (parityResult.bipartite && parityResult.count_condition === false) contradictions.push({ code: 'UNFINISHED_SUFFIX_PARITY_CONTRADICTION' });
      }
      checkForced();
      if (contradictions.length || q.mode_ref === 'EVALUATE') break;
      const additions = new Set<string>(), removals = new Set<string>();
      for (const vertex of sorted(vertices)) {
        budget.visit({ stage: 'propagation', vertex_ref: vertex });
        const incident = new Set(adjacency.get(vertex)!.map(([, ref]) => ref)), fixed = intersection(incident, forced);
        if (fixed.size === requirements[vertex]) for (const ref of difference(incident, fixed)) removals.add(ref);
        if (incident.size === requirements[vertex]) for (const ref of difference(incident, forced)) additions.add(ref);
      }
      const conflict = intersection(additions, removals);
      if (conflict.size) { contradictions.push({ code: 'SIMULTANEOUS_FORCE_REMOVE', edge_refs: sorted(conflict) }); break; }
      if (!additions.size && !removals.size) break;
      for (const ref of additions) forced.add(ref);
      for (const ref of removals) forbidden.add(ref);
      witnesses.push({ round: roundIndex, forced_edges: sorted(additions), removed_edges: sorted(removals) }); roundIndex++;
      checkForced();
      if (roundIndex >= q.depth_bound) throw new Interrupted('PROPAGATION_ROUND_BOUND', { stage: 'next_round' });
    }
    budget.finish();
    return result(q, 'COMPLETE', 'RESIDUAL_CONSTRAINTS_CALCULATED', { empty_suffix: false, degree_requirements: requirements,
      components: groups, components_after_vertex_removal: cuts, parity: parityResult, forced_edge_refs: sorted(forced), forbidden_edge_refs: sorted(forbidden),
      reduction_witnesses: witnesses, contradiction_certificates: contradictions, covering_suffix_witness_present: false }, true, budget.examined);
  } catch (error) {
    if (!(error instanceof Interrupted)) throw error;
    return result(q, 'NEEDS_EVIDENCE', error.cause, {}, false, budget.examined, { request_ref: q.scope.request_ref, input_digest: digest,
      graph_revision_ref: q.graph_revision_ref, completed_rounds: roundIndex, forced_edge_refs: sorted(forced), forbidden_edge_refs: sorted(forbidden),
      reduction_witnesses: witnesses, restart_current_round: true, interrupted_stage: error.frontier });
  }
}

/** A witness in the declared experimental graph never authorizes a physical action. */
export function constructTraceField(scene: R, observation: R, remaining: number, deadlineMs: number,
  now: Clock = () => performance.now()): R | null {
  const [nx, ny] = scene.geometry.shape, nodes: Point[] = [];
  for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) nodes.push([x, y]);
  if (nodes.length > 64) return null;
  const prefix: Point[] = scene.prefix.map((point: number[]) => [point[0]!, point[1]!]), end: Point = scene.receiver_hypothesis.cell;
  if (nodes.length - prefix.length > remaining) return null;
  const edges: [Point, Point][] = scene.allowed_edges_hypothesis.map((edge: number[][]) => edge.map(point => [point[0]!, point[1]!]));
  const adjacency = new Map<string, Point[]>(nodes.map(node => [pointKey(node), []]));
  for (const [a, b] of edges) { adjacency.get(pointKey(a))!.push(b); adjacency.get(pointKey(b))!.push(a); }
  const ref = (point: Point): string => `cell:${point[0]}:${point[1]}`, visited = new Set(prefix.map(pointKey));
  const scope = { request_ref: 'trace:' + identity([observation.observation_ref, scene]), caller_ref: 'public_trace_composition',
    parent_consumer_ref: 'SRC_composition', parent_goal_ref: 'G_official_completion', parent_contribution_ref: 'experimental_simple_cover',
    caller_next_item_ref: observation.observation_ref, epoch: observation.level_epoch, evidence_revision_ref: observation.observation_ref,
    model_revision_ref: scene.geometry_ref, model_status_ref: 'conditional_visible_separator_graph', event_owner_ref: 'SRC', input_domain_complete: true,
    assumption_refs: ['finite_measured_cell_domain_only', 'simple_path_and_endpoint_last_define_requested_experiment_not_acquired_game_law',
      'thin_separator_passage_is_hypothesis', 'hollow_marker_terminal_role_unknown'] };
  const request = { scope, operation_ref: OPERATION, mode_ref: 'PROPAGATE', requested_result_type: 'DMechanicalResult', node_bound: 100000,
    depth_bound: 4096, domain_bound: 4096, time_bound_ms: Math.max(1, Math.min(300000, Math.trunc(deadlineMs - now()))), phase_ref: 'RESIDUAL_GRAPH',
    graph_revision_ref: scene.geometry_ref, node_refs: nodes.map(ref), edges: edges.map(([a, b], index) => ({ edge_ref: `e:${index}`, first_ref: ref(a), second_ref: ref(b) })),
    head_ref: ref(prefix.at(-1)!), endpoint_ref: ref(end), visited_node_refs: prefix.map(ref), remaining_node_refs: nodes.filter(node => !visited.has(pointKey(node))).map(ref),
    ordered_prefix: prefix.map(ref), append_only_projection_certified: false, simple_path_law_supported: true, endpoint_last_visit_law_supported: true,
    licensed_bipartite_parity: true };
  const receipt = measureSingleVisitResidual(request, now);
  if (receipt.status !== 'COMPLETE' || receipt.values.contradiction_certificates?.length) return null;
  const forbidden = new Set<string>(receipt.values.forbidden_edge_refs ?? []);
  for (const [index, [a, b]] of edges.entries()) if (forbidden.has(`e:${index}`)) {
    const first = adjacency.get(pointKey(a))!, second = adjacency.get(pointKey(b))!;
    first.splice(first.findIndex(point => comparePoints(point, b) === 0), 1); second.splice(second.findIndex(point => comparePoints(point, a) === 0), 1);
  }
  let count = 0;
  const allNodes = new Set(nodes.map(pointKey));
  const dfs = (path: Point[]): Point[] | null => {
    count++;
    if (count > 100000 || now() >= deadlineMs) return null;
    const unseen = difference(allNodes, new Set(path.map(pointKey))), head = path.at(-1)!, headKey = pointKey(head);
    if (!unseen.size) return comparePoints(head, end) === 0 ? path : null;
    if (comparePoints(head, end) === 0) return null;
    const residual = new Set([...unseen, headKey]), seen = new Set([headKey]), pending: Point[] = [head];
    while (pending.length) for (const point of adjacency.get(pointKey(pending.pop()!))!) {
      const key = pointKey(point);
      if (residual.has(key) && !seen.has(key)) { seen.add(key); pending.push(point); }
    }
    if (seen.size !== residual.size) return null;
    for (const key of residual) if (adjacency.get(key)!.filter(point => residual.has(pointKey(point))).length < (key === headKey || key === pointKey(end) ? 1 : 2)) return null;
    const choices = adjacency.get(headKey)!.filter(point => unseen.has(pointKey(point))).sort((a, b) =>
      adjacency.get(pointKey(a))!.filter(point => unseen.has(pointKey(point))).length - adjacency.get(pointKey(b))!.filter(point => unseen.has(pointKey(point))).length
      || comparePoints(a, b));
    for (const next of choices) { const found = dfs([...path, next]); if (found) return found; }
    return null;
  };
  const found = dfs(prefix);
  return found ? { path: found.map(point => [...point]), receipt, search_nodes: count,
    scope: 'Exact witness only in the supplied experimental graph, not an environment terminal proof.' } : null;
}
