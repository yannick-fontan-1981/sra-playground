import { chartEdgeKey, chartInventory, chartPointKey, chartScene, measureChart, routeChart,
  type ChartEdge, type ChartPoint, type MeasuredChart } from '../logos-engine/v6-chart-navigation-geometry.ts';
import type { NativeCommand, NativeFamily, NativeObservation, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { sicNeedId } from './need-identity.ts';
import { compileStrategyGraph, resolveStrategyGraph } from './strategy-agenda.ts';

export const chartRouteId = 'sic_chart_route';
export const chartRouteStrategies = {
  visit_visible_prerequisite: 'Test the node whose color matches a link',
  follow_shared_chart_direction: 'Take the direction shared by the remaining chart routes',
} as const;
const graph = compileStrategyGraph({ id: 'route_by_visible_links_and_prerequisites', version: 1, order: 'FALLBACK',
  priorities: ['visit_visible_prerequisite', 'follow_shared_chart_direction'],
  strategies: {
    visit_visible_prerequisite: [{ fact: 'prerequisite', expected: true, label: 'A reachable annotated node matches a link we cannot yet explain' }],
    follow_shared_chart_direction: [{ fact: 'destination', expected: true, label: 'The remaining plausible positions agree on the next direction' }],
  },
}, ['prerequisite', 'destination']);
const directions = { ACTION1: [0, -1], ACTION2: [0, 1], ACTION3: [-1, 0], ACTION4: [1, 0] } as const;
type Local = { chart: MeasuredChart; positions: ChartPoint[]; open: string[]; visited: string[]; attempts: string[];
  evidence: string[]; frame: string };
type Proposal = NativeProposal & { local: Local; edges: ChartEdge[]; attempt: string; needId: string };
const same = (a: ChartPoint, b: ChartPoint) => a[0] === b[0] && a[1] === b[1];

function boundaryAdmission(edge: ChartEdge, color: number, chart: MeasuredChart, frames: readonly NativeRows[], final: NativeRows) {
  const [dx, dy] = edge.delta, width = final[0]!.length, height = chart.field_bottom, thickness = 2 * chart.nodes[0]!.size;
  const onSide = (x: number, y: number) => dx > 0 ? x >= width - thickness : dx < 0 ? x < thickness
    : dy > 0 ? y >= height - thickness : y < thickness;
  return frames.some(frame => {
    if (frame.length !== final.length || frame.some((row, y) => row.length !== final[y]!.length)) return false;
    let removed = false;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      if (frame[y]![x] === final[y]![x]) continue;
      if (!onSide(x, y)) return false;
      if (frame[y]![x] === color) removed = true;
    }
    return removed;
  });
}

export function createSicChartRoute(): NativeFamily<Proposal> {
  let state: Local | null = null;
  return {
    id: chartRouteId,
    async propose(observation, rows, _inputs, remaining) {
      if (remaining < 1 || !Object.keys(directions).some(action => observation.available_action_refs.includes(action))) return null;
      const retained = state?.chart.epoch === observation.level_epoch && state.frame === observation.frame_hash ? state : null;
      const fresh = retained ? null : measureChart(rows, observation);
      const local = retained ?? (fresh && { chart: fresh, positions: [fresh.origin], open: [], visited: [], attempts: [],
        evidence: [observation.observation_ref], frame: observation.frame_hash });
      if (!local || local.attempts.length >= 36 || local.positions.length > 4) return null;
      const { chart, positions, visited } = local;
      const goals = chart.nodes.filter(node => !same(node.center, chart.origin) && node.inside === chart.goal_annotation_hypothesis);
      if (goals.length !== 1) return null;
      const held = chartInventory(rows, chart), annotations = new Set(chart.links.map(link => link.annotation));
      const dependencies = chart.nodes.filter(node => node.inside !== null && annotations.has(node.inside) && node.inside !== chart.goal_annotation_hypothesis);
      const blocked = chart.links.filter(edge => !held.includes(edge.annotation) && !local.open.includes(chartEdgeKey(edge))
        && dependencies.some(node => node.inside === edge.annotation)).map(chartEdgeKey);
      const targets = [...dependencies.filter(node => !held.includes(node.inside!) && !visited.includes(chartPointKey(node.center))), goals[0]!];
      const offers = targets.flatMap(target => {
        const excluded = new Set(chart.nodes.filter(node => node.inside !== null && node !== target
          && !same(node.center, chart.origin) && !positions.some(point => same(node.center, point))
          && !visited.includes(chartPointKey(node.center))).map(node => chartPointKey(node.center)));
        const routes = positions.map(point => routeChart(chart, point, target.center, excluded, blocked));
        if (routes.some(path => !path?.length)) return [];
        const edges = routes.map(path => path![0]!);
        if (!edges.every(edge => same(edge.delta, edges[0]!.delta))) return [];
        const match = Object.entries(directions).find(([action, delta]) => same(delta, edges[0]!.delta) && observation.available_action_refs.includes(action));
        if (!match) return [];
        const attempt = JSON.stringify([observation.frame_hash, positions, match[0], local.open, held]);
        if (local.attempts.includes(attempt)) return [];
        return [{ target, edges, action: { action_ref: match[0], data: {} } satisfies NativeCommand, attempt,
          distance: Math.max(...routes.map(path => path!.length)) }];
      }).sort((a, b) => a.distance - b.distance);
      const prerequisite = offers.find(offer => offer.target !== goals[0]);
      const destination = offers.find(offer => offer.target === goals[0]);
      const ref = observation.observation_ref, evidence: [string, ...string[]] = [ref, ...local.evidence.filter(value => value !== ref)];
      const { selected, entries } = resolveStrategyGraph({ graph, mode: 'active', facts: {
        prerequisite: { value: !!prerequisite, evidence }, destination: { value: !!destination, evidence },
      }, planners: { visit_visible_prerequisite: () => prerequisite ?? null, follow_shared_chart_direction: () => destination ?? null } });
      if (!selected) return null;
      const strategy = selected.id, offer = selected.plan, label = chartRouteStrategies[strategy], parent = 'G_official_completion';
      const goal = { kind: 'reach_corresponding_chart_marker', scope: chart.evidence[0]!, subjects: ['linked_nodes', 'matching_marker'],
        parentObjective: parent, satisfactionContract: 'official_progress_after_following_visible_links' };
      const need = { ...goal, id: sicNeedId(goal), status: 'assigned', evidence };
      const id = `chart-route:${need.id}`, actions = [offer.action];
      return { status: 'proposed', kind: chartRouteId, actions, local, edges: offer.edges, attempt: offer.attempt, needId: need.id,
        steps: [{ action: offer.action, expected_after: null }], binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        sicSituationCard: { strategy, need: 'Reach the marker that matches the starting one',
          mode: strategy === 'visit_visible_prerequisite' ? 'exploration' : 'solving', agenda: entries, evidence, distance: offer.distance,
          situation: fresh ? label : [
            positions.length === 1 ? 'The next move uses the inferred map location.' : `The return leaves ${positions.length} plausible map locations.`,
            held.length ? 'A visible slot now contains a matching color.' : local.open.length ? 'An animation showed the matching color disappear at a boundary.' : '',
            label + '.',
          ].filter(Boolean).join(' '),
          marker: fresh ? offer.target.bbox : null, slots: chart.slots.map(slot => slot.bbox) },
        question: { reason: label, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: label, relations: [`contributes_to:${parent}`] }],
        sicLocalDecision: { strategy, objective: { id, label, parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: label,
          preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
    },
    before(proposal, index, _packet, observation) {
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref;
      return { admitted, reason: admitted ? 'measured_chart_route_bound' : 'measured_chart_route_changed' };
    },
    after(proposal, _index, before, after) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true,
        reason: 'official_boundary', sic_need: { id: proposal.needId, status: 'satisfied' } };
      return { matched: null, seal_prefix: true, reason: 'compare_chart_scene_inventory_and_returned_boundary' };
    },
    record(before, after, _command, first, second, proposal, _index, frames) {
      const { local, edges } = proposal, { chart } = local;
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const from = chartInventory(first, chart), to = chartInventory(second, chart);
      const changed = chartScene(first, chart) !== chartScene(second, chart);
      const anchor = measureChart(second, after);
      const positions = anchor ? [anchor.current] : [...new Map([...(changed ? [] : local.positions), ...edges.map(edge => edge.to)]
        .map(point => [chartPointKey(point), point])).values()];
      const open = [...local.open], visited = [...local.visited];
      if (positions.length === 1) {
        const point = positions[0]!, gained = to.filter(value => !from.includes(value)), lost = from.filter(value => !to.includes(value));
        const node = chart.nodes.find(candidate => same(candidate.center, point));
        if (node?.inside != null && gained.includes(node.inside)) visited.push(chartPointKey(point));
        for (const color of lost) {
          const links = chart.links.filter(edge => same(edge.from, point) && edge.annotation === color);
          if (links.length === 1 && boundaryAdmission(links[0]!, color, chart, [first, ...frames], second)) {
            open.push(chartEdgeKey(links[0]!));
          }
        }
      }
      state = { ...local, positions, open: [...new Set(open)], visited: [...new Set(visited)], frame: after.frame_hash,
        attempts: [...local.attempts, proposal.attempt], evidence: [...new Set([chart.evidence[0]!, ...local.evidence.slice(-3), after.observation_ref])] };
      return { events: [] };
    },
    state: () => ({ state }),
    restore(value: NativeRecord) { state = structuredClone(value.state as Local | null); },
  };
}
