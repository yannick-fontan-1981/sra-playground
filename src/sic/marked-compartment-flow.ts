import { measureContextualCompartments } from '../logos-engine/v6-contextual-compartments.ts';
import { ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeCommand, NativeFamily, NativeObservation, NativePoint, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { sicNeedId } from './need-identity.ts';
import { publicCompletionFrames } from './observed-role-completion.ts';

export const markedCompartmentFlowId = 'sic_follow_observed_compartment_readiness';
export const markedCompartmentStrategies = {
  use_marked_compartment: 'Use the marked compartment while its contents are available',
  advance_marked_process: 'Check whether the marked process progresses after a turn',
  deliver_from_confirmed_outlet: 'Use the outlet that previously produced official progress',
} as const;

type Chamber = { box: NativeBox; point: NativePoint; filled: number; contents: [number, number][] };
type Scene = { frames: Chamber[]; marked: Chamber[]; mark: number; normal: number; background: number; key: string };
type OutletControl = { box: NativeBox; offset: NativePoint; pattern: number[][] };
type OutletRelease = { box: NativeBox; pigments: number[]; empty: number[] };
type Witness = { epoch: number; mark: number; normal: number; background: number; chambers: NativeBox[]; wins?: number;
  outlet: NativeBox; refs: [string, string]; concurrentDelivery?: true; control?: OutletControl };
type Flow = { sources: NativeBox[]; used: number[]; pending?: { chamber: Chamber; waits: number } };
type Proposal = NativeProposal & { changedRegion: NativeBox; concurrentRegion?: NativeBox; attempt: string; needId: string;
  flow?: Flow; source?: number; startBatch?: true; startProcess?: Chamber; delivery?: true; wait?: true; release?: OutletRelease };

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

function continuationOf(scene: Scene, memory: Pick<Witness, 'normal' | 'background' | 'chambers'>): boolean {
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

function compartmentPattern(rows: NativeRows, [left, top, right, bottom]: NativeBox): number[][] {
  return rows.slice(top, bottom + 1).map(row => [...row.slice(left, right + 1)]);
}

// Repeated enclosed pockets distinguish a compound control's contents from its
// stable frame. The unique larger process cavity remains part of that frame.
function repeatedControlPockets(pattern: number[][], background: number, normal: number): NativeBox[] {
  const height = pattern.length, width = pattern[0]?.length ?? 0, seen = new Set<number>();
  const groups = new Map<string, NativeBox[]>();
  for (let row = 0; row < height; row++) for (let column = 0; column < width; column++) {
    const first = row * width + column;
    if (seen.has(first) || pattern[row]![column] !== background) continue;
    const pending = [first], cells: number[] = []; seen.add(first);
    while (pending.length) {
      const cell = pending.pop()!, x = cell % width, y = Math.floor(cell / width); cells.push(cell);
      for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
        const u = x + dx!, v = y + dy!, key = v * width + u;
        if (u < 0 || u >= width || v < 0 || v >= height || seen.has(key) || pattern[v]![u] !== background) continue;
        seen.add(key); pending.push(key);
      }
    }
    const xs = cells.map(cell => cell % width), ys = cells.map(cell => Math.floor(cell / width));
    const left = Math.min(...xs), right = Math.max(...xs), top = Math.min(...ys), bottom = Math.max(...ys);
    if (left === 0 || top === 0 || right === width - 1 || bottom === height - 1
      || cells.length !== (right - left + 1) * (bottom - top + 1)) continue;
    const border: number[] = [];
    for (let y = top - 1; y <= bottom + 1; y++) for (let x = left - 1; x <= right + 1; x++) {
      if (y === top - 1 || y === bottom + 1 || x === left - 1 || x === right + 1) border.push(pattern[y]![x]!);
    }
    if (!border.every(ink => ink === normal)) continue;
    const key = `${right - left + 1}:${bottom - top + 1}`, group = groups.get(key) ?? [];
    group.push([left, top, right, bottom]); groups.set(key, group);
  }
  const repeated = [...groups.values()].filter(group => group.length > 1);
  return repeated.length === 1 ? repeated[0]! : [];
}

function compoundControlBoxes(rows: NativeRows, witness: Witness, control: OutletControl): NativeBox[] {
  const pockets = repeatedControlPockets(control.pattern, witness.background, witness.normal);
  if (!pockets.length) return [];
  const width = control.box[2] - control.box[0] + 1, height = control.box[3] - control.box[1] + 1;
  const varying = new Set(pockets.flatMap(([l, t, r, b]) => {
    const cells: number[] = [];
    for (let y = t - 1; y <= b + 1; y++) for (let x = l - 1; x <= r + 1; x++) cells.push(y * width + x);
    return cells;
  }));
  const boxes: NativeBox[] = [];
  for (let top = Math.max(0, control.box[1] - height + 1); top <= Math.min(rows.length - height, control.box[3]); top++) {
    for (let left = Math.max(0, control.box[0] - width + 1); left <= Math.min(rows[0]!.length - width, control.box[2]); left++) {
      const box: NativeBox = [left, top, left + width - 1, top + height - 1];
      if (!sameChamberSite(box, control.box) || !control.pattern.every((line, y) => line.every((ink, x) =>
        varying.has(y * width + x) || rows[top + y]?.[left + x] === ink))) continue;
      const compatible = pockets.every(([l, t, r, b]) => {
        const fill = rows[top + t]?.[left + l], border = rows[top + t - 1]?.[left + l - 1];
        if (fill === undefined || fill === witness.normal || fill === witness.mark
          || border !== witness.normal && border !== witness.mark) return false;
        for (let y = t - 1; y <= b + 1; y++) for (let x = l - 1; x <= r + 1; x++) {
          const edge = y === t - 1 || y === b + 1 || x === l - 1 || x === r + 1;
          if (rows[top + y]?.[left + x] !== (edge ? border : fill)) return false;
        }
        return true;
      });
      if (compatible) boxes.push(box);
    }
  }
  return boxes;
}

function outletControl(scene: Scene, witness: Witness, choice: Chamber, rows: NativeRows) {
  const remembered = witness.control;
  if (!remembered || !choice.filled || !sameChamberSite(choice.box, witness.outlet)) return { choice, controlBox: choice.box };
  if (scene.marked.filter(chamber => sameChamberSite(chamber.box, witness.outlet)).length !== 1) return null;
  const exact = scene.frames.filter(chamber => sameChamberSite(chamber.box, remembered.box)
    && chamber.box[2] - chamber.box[0] === remembered.box[2] - remembered.box[0]
    && chamber.box[3] - chamber.box[1] === remembered.box[3] - remembered.box[1]
    && remembered.pattern.every((line, y) => line.every((value, x) => rows[chamber.box[1] + y]?.[chamber.box[0] + x] === value)))
    .map(chamber => chamber.box);
  const candidates = [...new Map([...exact, ...compoundControlBoxes(rows, witness, remembered)].map(box => [boxKey(box), box])).values()];
  if (candidates.length !== 1) return null;
  const control = candidates[0]!, point: NativePoint = [control[0] + remembered.offset[0], control[1] + remembered.offset[1]];
  return { choice: { ...choice, point }, controlBox: control,
    release: { box: choice.box, pigments: choice.contents.map(([pigment]) => pigment), empty: [scene.background, scene.normal, scene.mark] } };
}

function releaseConfirmed(first: NativeRows, second: NativeRows, release: OutletRelease): boolean {
  const [left, top, right, bottom] = release.box;
  let lost = 0, beforeCount = 0, afterCount = 0;
  for (let y = top + 1; y < bottom; y++) for (let x = left + 1; x < right; x++) {
    const before = first[y]?.[x], after = second[y]?.[x];
    if (before === undefined || after === undefined) return false;
    beforeCount += Number(release.pigments.includes(before));
    afterCount += Number(release.pigments.includes(after));
    if (before !== after && !release.pigments.includes(after) && !release.empty.includes(after)) return false;
    if (!release.pigments.includes(before) || before === after) continue;
    if (!release.empty.includes(after)) return false;
    lost++;
  }
  // The acquired remote control emptied the outlet in the public winning
  // frames. A gradual loss during some other turn is not that same effect.
  return lost > 0 && beforeCount > 0 && afterCount === 0;
}

async function releasedMarkedOutlet(scene: Scene, before: NativeObservation, after: NativeObservation,
  second: NativeRows, frames: readonly NativeRows[]) {
  const candidates = scene.marked.filter(chamber => chamber.filled > 0), released = new Set<Chamber>();
  if (!candidates.length) return null;
  const anchors = { normal: scene.normal, background: scene.background, chambers: scene.frames.map(chamber => chamber.box) };
  for (const rows of publicCompletionFrames(before, after, second, frames)) {
    const returned = await measureContextualCompartments(rows, scene.mark) as Scene | null;
    if (!returned || !continuationOf(returned, anchors)) continue;
    for (const candidate of candidates) {
      const matched = returned.frames.filter(chamber => sameChamberSite(chamber.box, candidate.box));
      if (matched.length === 1 && matched[0]!.filled === 0) released.add(candidate);
    }
  }
  return released.size === 1 ? [...released][0]! : null;
}

export async function acquireMarkedOutlet(witness: Witness | null, before: NativeObservation, after: NativeObservation,
  command: NativeCommand, first: NativeRows, second: NativeRows = first, frames: readonly NativeRows[] = []): Promise<Witness | null> {
  if (after.levels_completed <= before.levels_completed || command.action_ref !== 'ACTION6' || !acceptsPoint(before)) return witness;
  if (witness?.refs[0] === before.observation_ref && witness.refs[1] === after.observation_ref) return witness;
  const { x, y } = command.data;
  if (typeof x !== 'number' || typeof y !== 'number') return witness;
  const prior = witness?.epoch === before.level_epoch ? witness : null;
  const measured = await measureContextualCompartments(first) as Scene | null;
  const transferred = !measured && prior ? await measureContextualCompartments(first, prior.mark) as Scene | null : null;
  const scene = measured ?? (transferred && prior && continuationOf(transferred, prior) ? transferred : null);
  if (!scene) return witness;
  const candidates = scene.marked.filter(chamber => chamber.filled && contains(chamber.box, [x, y]));
  if (candidates.length > 1) return witness;
  let outlet = candidates[0], control: OutletControl | undefined;
  if (!outlet) {
    const operated = scene.frames.filter(chamber => contains(chamber.box, [x, y]));
    if (operated.length !== 1) return witness;
    outlet = await releasedMarkedOutlet(scene, before, after, second, frames) ?? undefined;
    if (!outlet || sameChamberSite(outlet.box, operated[0]!.box)) return witness;
    const box = operated[0]!.box;
    control = { box, offset: [x - box[0], y - box[1]], pattern: compartmentPattern(first, box) };
  }
  const repeated = witness?.epoch === before.level_epoch && continuationOf(scene, witness) && sameChamberSite(witness.outlet, outlet.box);
  return { epoch: after.level_epoch, mark: scene.mark, normal: scene.normal, background: scene.background,
    chambers: scene.frames.map(chamber => chamber.box), outlet: outlet.box, wins: repeated ? (witness?.wins ?? 1) + 1 : 1,
    refs: [before.observation_ref, after.observation_ref], ...(control ? { control } : {}),
    ...(scene.marked.length > 1 ? { concurrentDelivery: true } : {}) };
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
    .sort((a, b) => rank(b) - rank(a) || (order ? order(b) - order(a) : 0) || a.box[0] - b.box[0] || a.box[1] - b.box[1])
    .find(chamber => outletControl(scene, witness, chamber, rows) !== null);
  const selected = choice && outletControl(scene, witness, choice, rows);
  return selected ? { ...selected, outlet: witness.outlet, evidence: witness.refs, region: localRegion(choice!.box, rows),
    attempt: attemptFor(choice!), novelty: !attempted.length && scene.marked.length > 1 } : null;
}

export function checkRecalledOutlet({ region, release }: NonNullable<Awaited<ReturnType<typeof projectRecalledOutlet>>>, first: NativeRows, second: NativeRows) {
  return release ? releaseConfirmed(first, second, release) : changed(first, second, region);
}

export function createSicMarkedCompartmentFlow(): NativeFamily<Proposal> {
  let witness: Witness | null = null;
  let attempted: string[] = [];
  let flow: Flow | null = null;
  return {
    id: markedCompartmentFlowId,
    async observePublicOutcome(before, after, command, first, second, frames = []) {
      const observed = await acquireMarkedOutlet(witness, before, after, command, first, second, frames);
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
          || a.box[0] - b.box[0] || a.box[1] - b.box[1])
        // An unavailable outlet control does not invalidate the other ready inputs.
        .find(chamber => outletControl(scene, memory, chamber, rows) !== null);
      // A running process may temporarily cover its own highlighted outline.
      const pending = batching?.pending, wait = !marked && pending && pending.waits < 2;
      const choice = marked ?? (wait ? pending.chamber : null);
      if (!choice) return null;
      const selected = outletControl(scene, memory, choice, rows);
      if (!selected) return null;
      const concurrent = !wait && downstream && available(choice)
        ? scene.marked.find(chamber => !available(chamber) && downstream(chamber) > downstream(choice)) : null;
      const strategy = wait ? 'advance_marked_process' : isOutlet(choice) ? 'deliver_from_confirmed_outlet'
        : available(choice) ? 'use_marked_compartment' : 'advance_marked_process';
      const label = markedCompartmentStrategies[strategy];
      const situation = concurrent ? 'Use an available input this turn and check the downstream compartment at the same time.' : label;
      const ref = observation.observation_ref, parent = 'G_official_completion';
      const evidence: [string, ...string[]] = [ref, ...memory.refs.filter(value => value !== ref)];
      const [x, y] = selected.choice.point;
      const action: NativeCommand = wait ? { action_ref: 'ACTION5', data: {} } : { action_ref: 'ACTION6', data: { x, y } };
      const actions = [action];
      const pointBinding = wait ? null : await ObservedInputDomain.makeLocusWitness(observation, rows, selected.choice.point, { reason: label, evidence });
      const goal = { kind: 'maintain_flow_toward_confirmed_outlet', scope: ref.split(':revision:', 1)[0]!,
        subjects: ['marked_control', 'previous_scoring_outlet'], parentObjective: parent,
        satisfactionContract: 'confirm_local_transition_then_official_delivery' };
      const need = { ...goal, id: sicNeedId(goal), status: 'assigned', evidence };
      const id = `marked-compartment:${need.id}`;
      return { status: 'proposed', kind: markedCompartmentFlowId, actions, changedRegion: localRegion(choice.box, rows),
        ...(selected.release ? { release: selected.release } : {}),
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
          agenda: [], evidence, chamber: selected.controlBox, outlet: memory.outlet, ...(concurrent ? { concurrent: concurrent.box } : {}) },
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
      const matched = before.level_epoch === after.level_epoch && (proposal.release
        ? releaseConfirmed(first, second, proposal.release) : changed(first, second, proposal.changedRegion));
      const concurrent = matched && proposal.concurrentRegion && changed(first, second, proposal.concurrentRegion);
      return { matched, seal_prefix: true, reason: concurrent ? 'input_and_downstream_change_observed'
        : matched ? 'local_compartment_change_observed' : 'no_local_compartment_change' };
    },
    async record(before, after, command, first, second, proposal, _index, frames = []) {
      if (after.levels_completed > before.levels_completed) await this.observePublicOutcome!(before, after, command, first, second, frames);
      else {
        attempted = [...attempted, proposal.attempt];
        if (proposal.flow) {
          const confirmed = proposal.release ? releaseConfirmed(first, second, proposal.release) : changed(first, second, proposal.changedRegion);
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
