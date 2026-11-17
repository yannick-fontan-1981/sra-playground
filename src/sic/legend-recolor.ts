import { measure } from '../logos-engine/v6-topological-recolor-geometry.ts';
import { isJsonObject } from '../logos-engine/canonical.ts';
import { ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeFamily, NativePoint, NativeProgramHandle, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { sicNeedId } from './need-identity.ts';
import { compileStrategyGraph, resolveStrategyGraph } from './strategy-agenda.ts';
import { checkExampleWorkflow, matchExampleModule, matchExampleOperations, matchExampleWorkflow } from './legend-recolor-card.ts';

export const legendRecolorId = 'sic_legend_recolor';
export const matchExampleId = 'sic_match_visible_example';
export const legendRecolorStrategies = {
  acquire_legend_pigment: 'Select the color indicated by the legend',
  apply_legend_pigment: 'Apply the selected color to the matching region',
} as const;
const graph = compileStrategyGraph({ id: 'match_region_topology_to_visible_legend', version: 1, order: 'FALLBACK',
  priorities: ['apply_legend_pigment', 'acquire_legend_pigment'],
  strategies: {
    acquire_legend_pigment: [{ fact: 'needsColor', expected: true, label: 'The region has a matching example and its color is not selected yet' }],
    apply_legend_pigment: [{ fact: 'ready', expected: true, label: 'The selected color matches the example for this region' }],
  },
}, ['needsColor', 'ready']);

type Region = { bbox: NativeBox; cells: NativePoint[]; value: number };
type Body = Region & { target: number; partial_topology: boolean; relation_kind: 'shell' | 'surround' | 'pocket';
  pocket_count: number | null; example?: NativeBox };
type Scene = { field: NativeBox; legend: NativeBox; wells: Region[]; bodies: Body[]; reduced_examples?: true };
type State = { epoch: number; scene: Scene; active: number | null; count: number; stopped: boolean; evidence: string[] };
type Proposal = NativeProposal & { local: State; body: Body; selecting: boolean; needId: string };
const samePoint = (a: NativePoint, b: NativePoint) => a[0] === b[0] && a[1] === b[1];
const at = (rows: NativeRows, [x, y]: NativePoint) => rows[y]?.[x];

function visibleColors(rows: NativeRows, body: Body) {
  return new Set(body.cells.map(point => at(rows, point)));
}

function activePigment(rows: NativeRows, wells: Region[]) {
  const borders = wells.map(({ bbox: [l, t, r, b] }) => {
    const values = new Set<number | undefined>();
    for (let y = t - 1; y <= b + 1; y++) for (let x = l - 1; x <= r + 1; x++) {
      if (x === l - 1 || x === r + 1 || y === t - 1 || y === b + 1) values.add(rows[y]?.[x]);
    }
    return values.size === 1 ? [...values][0] : null;
  });
  const active = wells.filter((_, i) => borders[i] != null && borders.filter(value => value === borders[i]).length === 1
    && new Set(borders.filter((_, j) => i !== j)).size === 1);
  return active.length === 1 ? active[0]!.value : null;
}

export function createSicLegendRecolor(family = legendRecolorId): NativeFamily<Proposal> {
  const declarative = family === matchExampleId;
  let state: State | null = null;
  let choose: NativeProgramHandle | undefined;
  let verify: NativeProgramHandle | undefined;
  let lastVerified: { ref: string; matched: boolean } | undefined;
  return {
    id: family,
    async attachPrograms(registry) {
      if (!declarative) return;
      const module = await matchExampleModule();
      choose = await registry.registerProgram(matchExampleWorkflow, matchExampleOperations, module);
      verify = await registry.registerProgram(checkExampleWorkflow, matchExampleOperations, module);
    },
    async propose(observation, rows, _inputs, remaining, execution) {
      if (remaining < 1 || !observation.available_action_refs.includes('ACTION6')) return null;
      const prior = state?.epoch === observation.level_epoch ? state : null;
      if (prior?.stopped || (prior?.count ?? 0) >= 32) return null;
      const scene = prior?.scene ?? (measure(rows, observation, [], { examples: true }) as Scene | null);
      if (!scene || scene.bodies.length > 32 || scene.bodies.filter(body => body.relation_kind !== 'pocket').length > 12) return null;
      const active = activePigment(rows, scene.wells);
      const local = prior ?? { epoch: observation.level_epoch, scene, active, count: 0, stopped: false, evidence: [] };
      const unfinished = scene.bodies.filter(body => !body.cells.every(point => at(rows, point) === body.target));
      if (unfinished.some(body => visibleColors(rows, body).size !== 1)) return null;
      const shells = unfinished.filter(body => body.relation_kind === 'shell'), pending = shells.length ? shells : unfinished;
      let body: Body | undefined;
      let strategy: keyof typeof legendRecolorStrategies;
      let srcDecision: NativeRecord | undefined;
      if (declarative) {
        if (!choose || !pending.length) return null;
        const candidates = pending.map(candidate => ({ index: scene.bodies.indexOf(candidate), color: candidate.target }));
        const ready = candidates.filter(candidate => candidate.color === active);
        const { result, receipt } = await choose.run({ situation: { hasReadyRegion: ready.length > 0, ready, pending: candidates } },
          { signal: execution?.signal });
        if (!isJsonObject(result) || !isJsonObject(result.candidate)) return null;
        const requested = result.candidate.index;
        const selected = pending.find(candidate => scene.bodies.indexOf(candidate) === requested);
        if (!selected || result.strategy !== 'apply_legend_pigment' && result.strategy !== 'acquire_legend_pigment') return null;
        body = selected;
        strategy = result.strategy;
        if (strategy === 'apply_legend_pigment' && active !== body.target) return null;
        srcDecision = { workflow: receipt.workflow, hash: receipt.src_hash, instructions: receipt.instructions, edited: 'edited' in receipt && receipt.edited === true };
      } else {
        body = pending.find(body => body.target === local.active && active === local.active) ?? pending[0];
        if (!body) return null;
        strategy = local.active !== body.target || active !== body.target ? 'acquire_legend_pigment' : 'apply_legend_pigment';
      }
      const selecting = strategy === 'acquire_legend_pigment';
      const site = selecting ? scene.wells.find(well => well.value === body.target) : body;
      if (!site || !site.cells.length) return null;
      const [l, t, r, b] = site.bbox;
      const center: NativePoint = [Math.floor((l + r) / 2), Math.floor((t + b) / 2)];
      const point = site.cells.find(point => samePoint(point, center)) ?? site.cells[0]!;
      const [x, y] = point, command = { action_ref: 'ACTION6', data: { x, y } };
      const ref = observation.observation_ref;
      const evidence: [string, ...string[]] = [ref, ...local.evidence.filter(value => value !== ref)];
      const entries = declarative ? [] : resolveStrategyGraph({ graph, mode: 'active', facts: {
        needsColor: { value: selecting, evidence }, ready: { value: !selecting, evidence },
      }, planners: { acquire_legend_pigment: () => command, apply_legend_pigment: () => command } }).entries;
      const label = legendRecolorStrategies[strategy], parent = 'G_official_completion';
      const topology = body.relation_kind === 'pocket' ? 'The corresponding example shows a single color inside its pockets.'
        : body.relation_kind === 'surround' ? 'The surrounding regions of the example and the field correspond.'
        : body.partial_topology ? `${body.pocket_count} closed pockets are visible. The contour meets the field edge.`
          : `The region has ${body.pocket_count} enclosed pockets.`;
      const layout = scene.reduced_examples ? 'The smaller matching examples mark the legend. ' : '';
      const goal = { kind: 'match_visible_legend_colors', scope: ref.split(':revision:', 1)[0]!, subjects: ['legend_and_regions'],
        parentObjective: parent, satisfactionContract: 'observe_official_progress_after_matching_regions' };
      const need = { ...goal, id: sicNeedId(goal), status: 'assigned', evidence };
      const id = `legend-recolor:${need.id}`, actions = [command];
      const binding = await ObservedInputDomain.makeLocusWitness(observation, rows, point, { reason: label, evidence });
      return { status: 'proposed', kind: family, actions, local, body, selecting, needId: need.id,
        steps: [{ action: command, expected_after: null, point_binding: binding }],
        binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        ...(srcDecision ? { sicSrcDecision: srcDecision } : {}),
        sicSituationCard: { strategy, need: 'Give each region the color of its matching example',
          mode: selecting || body.partial_topology || body.relation_kind !== 'shell' ? 'exploration' : 'solving',
          situation: `${layout}${topology} ${label}.`, agenda: entries, evidence,
          region: body.bbox, legend: scene.legend, example: body.example ?? null, swatch: selecting ? site.bbox : null },
        question: { reason: label, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: label, relations: [`contributes_to:${parent}`] }],
        sicLocalDecision: { strategy, objective: { id, label, parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: label,
          preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
    },
    before(proposal, index, _packet, observation) {
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref;
      return { admitted, reason: admitted ? 'legend_recolor_bound' : 'legend_recolor_changed' };
    },
    async after(proposal, _index, before, after, first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true,
        reason: 'official_boundary', sic_need: { id: proposal.needId, status: 'satisfied' } };
      const facts = measureReturn(proposal, first, second);
      const checked = await verify?.run({ outcome: facts });
      const matched = checked ? checked.result === true : facts.preserved && facts.expectedValueObserved;
      lastVerified = { ref: after.observation_ref, matched };
      return { matched, seal_prefix: true, reason: matched ? 'legend_color_effect_observed' : 'legend_color_effect_contradicted',
        ...(checked ? { src_check: { workflow: checked.receipt.workflow, hash: checked.receipt.src_hash, ...facts } } : {}) };
    },
    record(before, after, _command, first, second, proposal) {
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const { local, body } = proposal;
      const matched = lastVerified?.ref === after.observation_ref ? lastVerified.matched : returned(proposal, first, second);
      lastVerified = undefined;
      state = { ...local, active: body.target, count: local.count + 1, stopped: !matched,
        evidence: [...local.evidence.slice(-4), after.observation_ref] };
      return { events: [] };
    },
    state: () => ({ state }),
    restore(value: NativeRecord) { state = structuredClone(value.state as State | null); },
  };
}

function measureReturn({ local, body, selecting }: Proposal, first: NativeRows, second: NativeRows) {
  const [l, t, r, b] = local.scene.field;
  const painted = new Set(selecting ? [] : body.cells.map(point => point.join(',')));
  let preserved = true, expectedValueObserved = selecting
    ? activePigment(second, local.scene.wells) === body.target : true;
  for (let y = t; y <= b; y++) for (let x = l; x <= r; x++) {
    if (painted.has(`${x},${y}`)) expectedValueObserved &&= second[y]?.[x] === body.target;
    else preserved &&= second[y]?.[x] === first[y]![x];
  }
  return { preserved, expectedValueObserved };
}

function returned(proposal: Proposal, first: NativeRows, second: NativeRows) {
  const facts = measureReturn(proposal, first, second);
  return facts.preserved && facts.expectedValueObserved;
}
