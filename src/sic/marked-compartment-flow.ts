import { measureContextualCompartments } from '../logos-engine/v6-contextual-compartments.ts';
import { ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeCommand, NativeFamily, NativeObservation, NativePoint, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { sicNeedId } from './need-identity.ts';

export const markedCompartmentFlowId = 'sic_follow_observed_compartment_readiness';
export const markedCompartmentStrategies = {
  use_marked_compartment: 'Use the marked compartment while its contents are available',
  advance_marked_process: 'Check whether the marked process progresses after a turn',
  deliver_from_confirmed_outlet: 'Use the outlet that previously produced official progress',
} as const;

type Chamber = { box: NativeBox; point: NativePoint; filled: number; contents: [number, number][] };
type Scene = { frames: Chamber[]; marked: Chamber[]; mark: number; normal: number; background: number; key: string };
type Witness = { epoch: number; mark: number; normal: number; background: number; chambers: NativeBox[]; wins?: number;
  outlet: NativeBox; refs: [string, string]; concurrentDelivery?: true };
type Flow = { sources: NativeBox[]; used: number[]; pending?: { chamber: Chamber; waits: number } };
type Proposal = NativeProposal & { changedRegion: NativeBox; concurrentRegion?: NativeBox; attempt: string; needId: string;
  flow?: Flow; source?: number; startBatch?: true; startProcess?: Chamber; delivery?: true; wait?: true };

const boxKey = (box: NativeBox) => box.join(',');
const contains = ([left, top, right, bottom]: NativeBox, [x, y]: NativePoint) => x >= left && x <= right && y >= top && y <= bottom;

function acceptsPoint(observation: NativeObservation): boolean {
  return observation.available_action_refs.includes('ACTION6') && observation.available_action_refs.includes('ACTION5')
    && !observation.available_action_refs.some(input => /^ACTION[1-4]$/.test(input));
}

function sameChamberSite(a: NativeBox, b: NativeBox): boolean {
  const width = Math.min(a[2], b[2]) - Math.max(a[0], b[0]) + 1;
  const height = Math.min(a[3], b[3]) - Math.max(a[1], b[1]) + 1;
  const area = ([left, top, right, bottom]: NativeBox) => (right - left + 1) * (bottom - top + 1);
  return width > 0 && height > 0 && width * height * 2 >= Math.max(area(a), area(b));
}

function continuationOf(scene: Scene, memory: Witness): boolean {
  if (scene.normal !== memory.normal || scene.background !== memory.background) return false;
  const matched = new Set<NativeBox>();
  for (const chamber of scene.frames) {
    const matches = memory.chambers.filter(box => sameChamberSite(box, chamber.box));
    if (matches.length === 1) matched.add(matches[0]!);
  }
  return matched.size * 3 >= memory.chambers.length * 2;
}

function orderTowardOutlet(memory: Witness) {
  if ((memory.wins ?? 0) < 2) return null;
  const center = (box: NativeBox, axis: 0 | 1) => (box[axis] + box[axis + 2]!) / 2;
  const extent = ([0, 1] as const).map(axis => {
    const first = Math.min(...memory.chambers.map(box => box[axis]));
    const last = Math.max(...memory.chambers.map(box => box[axis + 2]!));
    const end = center(memory.outlet, axis);
    return { axis, offset: end - (first + last) / 2, span: last - first };
  }).sort((a, b) => Math.abs(b.offset) - Math.abs(a.offset));
  const strongest = extent[0]!;
  if (!strongest.span || Math.abs(strongest.offset) * 3 < strongest.span
    || Math.abs(strongest.offset) < 2 * Math.abs(extent[1]!.offset)) return null;
  return { axis: strongest.axis, sign: Math.sign(strongest.offset),
    rank: (chamber: Chamber) => Math.sign(strongest.offset) * center(chamber.box, strongest.axis) };
}

function sourcesForBatch(scene: Scene, direction: NonNullable<ReturnType<typeof orderTowardOutlet>>): Flow | null {
  const stocked = scene.marked.filter(chamber => chamber.filled > 0 && chamber.contents.length === 1)
    .sort((a, b) => direction.rank(a) - direction.rank(b));
  const first = stocked[0];
  if (!first) return null;
  const [axis, sign] = [direction.axis, direction.sign];
  const from = (box: NativeBox) => sign > 0 ? box[axis] : -box[axis + 2]!;
  const to = (box: NativeBox) => sign > 0 ? box[axis + 2]! : -box[axis];
  const sources = stocked.filter(chamber => from(chamber.box) <= to(first.box)).map(chamber => chamber.box);
  return sources.length > 1 ? { sources, used: [] } : null;
}

function readyBatch(chamber: Chamber, memory: Witness, direction: NonNullable<ReturnType<typeof orderTowardOutlet>>): boolean {
  const axis = direction.axis, cross = axis === 0 ? 1 : 0, sign = direction.sign;
  const gap = sign > 0 ? memory.outlet[axis] - chamber.box[axis + 2]! : chamber.box[axis] - memory.outlet[axis + 2]!;
  return chamber.contents.length > 1 && gap > 0 && gap <= memory.outlet[axis + 2]! - memory.outlet[axis] + 1
    && Math.min(chamber.box[cross + 2]!, memory.outlet[cross + 2]!) >= Math.max(chamber.box[cross], memory.outlet[cross]);
}

function localRegion(chamber: NativeBox, rows: NativeRows): NativeBox {
  const [left, top, right, bottom] = chamber, span = right - left + 1;
  return [Math.max(0, left - span), Math.max(0, top - 2), Math.min(rows[0]!.length - 1, right + span),
    Math.min(rows.length - 1, bottom + 2)];
}

function changed(first: NativeRows, second: NativeRows, [left, top, right, bottom]: NativeBox): boolean {
  for (let y = top; y <= bottom; y++) {
    for (let x = left; x <= right; x++) if (first[y]?.[x] !== second[y]?.[x]) return true;
  }
  return false;
}

export async function acquireMarkedOutlet(witness: Witness | null, before: NativeObservation, after: NativeObservation,
  command: NativeCommand, first: NativeRows): Promise<Witness | null> {
  if (after.levels_completed <= before.levels_completed || command.action_ref !== 'ACTION6' || !acceptsPoint(before)) return witness;
  const { x, y } = command.data;
  if (typeof x !== 'number' || typeof y !== 'number') return witness;
  const prior = witness?.epoch === before.level_epoch ? witness : null;
  const measured = await measureContextualCompartments(first) as Scene | null;
  const transferred = !measured && prior ? await measureContextualCompartments(first, prior.mark) as Scene | null : null;
  const scene = measured ?? (transferred && prior && continuationOf(transferred, prior) ? transferred : null);
  if (!scene) return witness;
  const candidates = scene.marked.filter(chamber => chamber.filled && contains(chamber.box, [x, y]));
  if (candidates.length !== 1) return witness;
  const outlet = candidates[0]!;
  const repeated = witness?.epoch === before.level_epoch && continuationOf(scene, witness) && sameChamberSite(witness.outlet, outlet.box);
  return { epoch: after.level_epoch, mark: scene.mark, normal: scene.normal, background: scene.background,
    chambers: scene.frames.map(chamber => chamber.box), outlet: outlet.box, wins: repeated ? (witness?.wins ?? 1) + 1 : 1,
    refs: [before.observation_ref, after.observation_ref], ...(scene.marked.length > 1 ? { concurrentDelivery: true } : {}) };
}

export async function projectRecalledOutlet(witness: Witness, observation: NativeObservation, rows: NativeRows, attempted: readonly string[]) {
  if (witness.epoch !== observation.level_epoch || !acceptsPoint(observation)) return null;
  const scene = await measureContextualCompartments(rows, witness.mark) as Scene | null;
  if (!scene || !continuationOf(scene, witness)) return null;
  const order = orderTowardOutlet(witness)?.rank;
  const attemptFor = (chamber: Chamber) => scene.key + ':' + boxKey(chamber.box);
  const rank = (chamber: Chamber) => Number(chamber.filled > 0)
    + 4 * Number(chamber.filled > 0 && sameChamberSite(chamber.box, witness.outlet));
  const choice = scene.marked.filter(chamber => !attempted.includes(attemptFor(chamber)))
    .sort((a, b) => rank(b) - rank(a) || (order ? order(b) - order(a) : 0) || a.box[0] - b.box[0] || a.box[1] - b.box[1])[0];
  return choice ? { choice, outlet: witness.outlet, evidence: witness.refs, region: localRegion(choice.box, rows),
    attempt: attemptFor(choice), novelty: !attempted.length && scene.marked.length > 1 } : null;
}

export function checkRecalledOutlet({ region }: NonNullable<Awaited<ReturnType<typeof projectRecalledOutlet>>>, first: NativeRows, second: NativeRows) {
  return changed(first, second, region);
}

export function createSicMarkedCompartmentFlow(): NativeFamily<Proposal> {
  let witness: Witness | null = null;
  let attempted: string[] = [];
  let flow: Flow | null = null;
  return {
    id: markedCompartmentFlowId,
    async observePublicOutcome(before, after, command, first) {
      const observed = await acquireMarkedOutlet(witness, before, after, command, first);
      if (observed === witness) return;
      witness = observed;
      attempted = [];
      flow = null;
    },
    async propose(observation, rows, _inputs, remaining) {
      const memory = witness;
      if (remaining < 1 || memory?.epoch !== observation.level_epoch || !acceptsPoint(observation)) return null;
      const scene = await measureContextualCompartments(rows, memory.mark) as Scene | null;
      if (!scene || !continuationOf(scene, memory)) return null;
      const attemptFor = (chamber: Chamber) => scene.key + ':' + boxKey(chamber.box);
      const isOutlet = (chamber: Chamber) => sameChamberSite(chamber.box, memory.outlet) && chamber.filled > 0;
      const direction = orderTowardOutlet(memory), downstream = direction?.rank;
      const batching = flow ?? (memory.concurrentDelivery && direction && scene.marked.some(chamber => readyBatch(chamber, memory, direction))
        ? sourcesForBatch(scene, direction) : null);
      const sourceAt = (chamber: Chamber) => batching?.sources.findIndex(box => sameChamberSite(box, chamber.box)) ?? -1;
      const startsBatch = (chamber: Chamber) => !!(batching && direction && readyBatch(chamber, memory, direction));
      const available = (chamber: Chamber) => chamber.filled > 0
        && (!batching || chamber.contents.some(([ink]) => ink !== scene.normal));
      const rank = (chamber: Chamber) => 4 * Number(isOutlet(chamber)) + 3 * Number(startsBatch(chamber))
        + 2 * Number(sourceAt(chamber) >= 0) + Number(available(chamber));
      const marked = scene.marked.filter(chamber => !attempted.includes(attemptFor(chamber)) && !batching?.used.includes(sourceAt(chamber)))
        .sort((a, b) => rank(b) - rank(a) || (downstream ? downstream(b) - downstream(a) : 0)
          || a.box[0] - b.box[0] || a.box[1] - b.box[1])[0];
      // A running process may temporarily cover its own highlighted outline.
      const pending = batching?.pending, wait = !marked && pending && pending.waits < 2;
      const choice = marked ?? (wait ? pending.chamber : null);
      if (!choice) return null;
      const concurrent = !wait && downstream && available(choice)
        ? scene.marked.find(chamber => !available(chamber) && downstream(chamber) > downstream(choice)) : null;
      const strategy = wait ? 'advance_marked_process' : isOutlet(choice) ? 'deliver_from_confirmed_outlet'
        : available(choice) ? 'use_marked_compartment' : 'advance_marked_process';
      const label = markedCompartmentStrategies[strategy];
      const situation = concurrent ? 'Use an available input this turn and check the downstream compartment at the same time.' : label;
      const ref = observation.observation_ref, parent = 'G_official_completion';
      const evidence: [string, ...string[]] = [ref, ...memory.refs.filter(value => value !== ref)];
      const [x, y] = choice.point;
      const action: NativeCommand = wait ? { action_ref: 'ACTION5', data: {} } : { action_ref: 'ACTION6', data: { x, y } };
      const actions = [action];
      const pointBinding = wait ? null : await ObservedInputDomain.makeLocusWitness(observation, rows, choice.point, { reason: label, evidence });
      const goal = { kind: 'maintain_flow_toward_confirmed_outlet', scope: ref.split(':revision:', 1)[0]!,
        subjects: ['marked_control', 'previous_scoring_outlet'], parentObjective: parent,
        satisfactionContract: 'confirm_local_transition_then_official_delivery' };
      const need = { ...goal, id: sicNeedId(goal), status: 'assigned', evidence };
      const id = `marked-compartment:${need.id}`;
      return { status: 'proposed', kind: markedCompartmentFlowId, actions, changedRegion: localRegion(choice.box, rows),
        ...(batching ? { flow: batching, source: sourceAt(choice),
          ...(!wait && startsBatch(choice) ? { startBatch: true } : {}),
          ...(!wait && choice.contents.filter(([ink]) => ink !== scene.normal).length > 1 ? { startProcess: choice } : {}),
          ...(isOutlet(choice) ? { delivery: true } : {}), ...(wait ? { wait: true } : {}) } : {}),
        ...(concurrent ? { concurrentRegion: concurrent.box } : {}),
        attempt: wait ? `wait:${pending.waits}:${attemptFor(choice)}` : attemptFor(choice), needId: need.id,
        steps: [{ action, ...(pointBinding ? { point_binding: pointBinding } : {}), expected_after: null }],
        binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        sicSituationCard: { strategy, need: 'Advance material toward the outlet that led to progress',
          situation, mode: strategy === 'deliver_from_confirmed_outlet' ? 'solving' : 'assimilation',
          agenda: [], evidence, chamber: choice.box, outlet: memory.outlet, ...(concurrent ? { concurrent: concurrent.box } : {}) },
        question: { reason: situation, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: label, relations: [`contributes_to:${parent}`] }],
        sicLocalDecision: { strategy, objective: { id, label, parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: label, preconditions: {},
          preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
    },
    before(proposal, index, _packet, observation) {
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref;
      return { admitted, reason: admitted ? 'marked_compartment_bound' : 'compartment_readiness_changed' };
    },
    after(proposal, _index, before, after, first, second) {
      if (after.levels_completed > before.levels_completed) {
        return { matched: true, seal_prefix: true, reason: 'official_boundary', sic_need: { id: proposal.needId, status: 'satisfied' } };
      }
      const matched = before.level_epoch === after.level_epoch && changed(first, second, proposal.changedRegion);
      const concurrent = matched && proposal.concurrentRegion && changed(first, second, proposal.concurrentRegion);
      return { matched, seal_prefix: true, reason: concurrent ? 'input_and_downstream_change_observed'
        : matched ? 'local_compartment_change_observed' : 'no_local_compartment_change' };
    },
    async record(before, after, command, first, second, proposal) {
      if (after.levels_completed > before.levels_completed) await this.observePublicOutcome!(before, after, command, first, second);
      else {
        attempted = [...attempted, proposal.attempt];
        if (proposal.flow) {
          const confirmed = changed(first, second, proposal.changedRegion);
          const used = confirmed && proposal.startBatch ? [] : confirmed && (proposal.source ?? -1) >= 0
            ? [...proposal.flow.used, proposal.source!] : proposal.flow.used;
          const previous = proposal.flow.pending;
          const pending = confirmed && proposal.delivery ? undefined : confirmed && proposal.startProcess
            ? { chamber: proposal.startProcess, waits: 0 } : proposal.wait && previous
              ? { ...previous, waits: previous.waits + 1 } : previous;
          flow = { sources: proposal.flow.sources, used, ...(pending ? { pending } : {}) };
        }
      }
      return { events: [] };
    },
    state: () => ({ witness, attempted, ...(flow ? { flow } : {}) }),
    restore(value: NativeRecord) {
      witness = structuredClone((value.witness as Witness | undefined) ?? null);
      flow = structuredClone((value.flow as Flow | undefined) ?? null);
      attempted = structuredClone((value.attempted as string[] | undefined) ?? []);
    },
  };
}
