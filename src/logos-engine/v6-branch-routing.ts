/** Direct component owner for the pinned common_branch_routing.py.
 * This module is not registered in the common runtime by its component transfer.
 * record retains the original single-event result; a later caller adapter owns
 * exactly-once acquisition. A bounded record failure happens before mutation,
 * and that caller must retain the unacquired official return rather than drop it.
 */
import { compareUnicode } from './canonical.ts';
import { symbolicDigest as digest } from './v6-hash.ts';
import { projection } from './v6-native-observer.ts';
import type { ObservedInputDomain } from './v6-native-observer.ts';
import { pythonEqual as equal } from './v6-operations.ts';
import { motifRowsDigest } from './v6-motif-access-geometry.ts';
import type { NativeExecution, NativePublicObservation, NativeRows } from './v6-native-types.ts';
import {
  BranchRoutingIncomplete, boundedBranchObservedState, boundedBranchObservedStateCooperative,
  boundedBranchPlacementCooperative, branchBbox, branchLayout, branchObservedState, branchPlacement,
  branchPropagated, branchReadState, branchTupleKey, checkedBranchBounds,
} from './v6-branch-routing-geometry.ts';
import type { BranchModel, BranchPlacement, BranchPoint, BranchSearchBounds, BranchState } from './v6-branch-routing-geometry.ts';
export { BRANCH_ROUTING_NATIVE_SEARCH_BOUNDS, BranchRoutingIncomplete } from './v6-branch-routing-geometry.ts';

type R = Record<string, any>;
export interface NativeBranchRoutingOptions {
  /** Omitted only for direct complete source parity on declared small domains. */
  readonly boundedSearch?: Partial<BranchSearchBounds>;
}
const hasData = (command: R): boolean => Boolean(command.data && Object.keys(command.data).length);
const plainRecord = (value: any): value is R => value !== null && typeof value === 'object' && !Array.isArray(value)
  && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const integer = (value: any): value is number => Number.isSafeInteger(value);
// validateRows in v6-native-observer.ts admits nonempty W*H <= 65_536 public
// matrices. This is a total surface budget, not a separate budget per axis.
// The boundary test pins this retained-state derivation to that public checker.
const PUBLIC_FRAME_PIXELS = 65_536;
const validPoint = (value: any): value is BranchPoint => Array.isArray(value) && value.length === 2
  && integer(value[0]) && integer(value[1]);
const validPosition = (value: any): value is BranchPoint => validPoint(value)
  && value.every(x => x >= 0 && x < PUBLIC_FRAME_PIXELS);
const publicSurface = (width: number, height: number): boolean => integer(width) && integer(height)
  && width >= 1 && height >= 1 && width <= Math.floor(PUBLIC_FRAME_PIXELS / height);
/** A nonempty public slice contains its nonnegative origin. Its predicted box
 * may extend beyond the raster, so do not require the whole box here. */
function publicOrigins(positions: any): positions is BranchPoint[] {
  if (!Array.isArray(positions) || !positions.length || positions.length > PUBLIC_FRAME_PIXELS) return false;
  let width = 1, height = 1;
  for (const position of positions) {
    if (!validPosition(position)) return false;
    width = Math.max(width, position[0] + 1); height = Math.max(height, position[1] + 1);
  }
  return publicSurface(width, height);
}
const color = (value: any): value is number => integer(value) && value >= 0 && value <= 255;
const unique = (items: unknown[]): boolean => new Set(items.map(branchTupleKey)).size === items.length;
const exactKeys = (value: R, keys: readonly string[]): boolean => Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const validMotion = (value: any): value is Record<string, BranchPoint> => plainRecord(value)
  && Object.entries(value).every(([key, vector]) => key.length > 0 && validPoint(vector)
    && vector.every(component => Math.abs(component) < PUBLIC_FRAME_PIXELS) && ((vector[0] === 0) !== (vector[1] === 0)));
const validState = (value: any): value is BranchState => Array.isArray(value) && value.length === 2
  && publicOrigins(value[0])
  && unique(value[0]) && integer(value[1]) && value[1] >= 0 && value[1] < value[0].length;
function assertJson(value: any, active = new Set<object>()): void {
  if (value === null || typeof value === 'string' || typeof value === 'boolean' || integer(value)) return;
  if (!(Array.isArray(value) || plainRecord(value)) || active.has(value)) throw new TypeError('BranchRouting state requires acyclic integer JSON');
  active.add(value); for (const child of Object.values(value)) assertJson(child, active); active.delete(value);
}
function validModel(value: any): value is BranchModel {
  if (!plainRecord(value) || !exactKeys(value, ['axis', 'tangent', 'sign', 'unit', 'goals', 'sources', 'bars', 'active', 'highlight', 'order', 'limit', 'goal_boxes'])
    || ![0, 1].includes(value.axis) || value.tangent !== 1 - value.axis || ![-1, 1].includes(value.sign)
    || !publicSurface(value.unit, value.unit) || !integer(value.limit) || value.limit < 1
    || value.limit > Math.floor(PUBLIC_FRAME_PIXELS / value.unit) || !color(value.highlight)) return false;
  // The quotient checks precede all geometry products. Every retained bar is
  // a different measured component; its complete pixel area counts once.
  const unitArea = value.unit * value.unit;
  if (!Array.isArray(value.bars) || !value.bars.length || value.bars.length > Math.floor(PUBLIC_FRAME_PIXELS / (2 * unitArea))
    || !value.bars.every((bar: any) => plainRecord(bar)
      && exactKeys(bar, ['position', 'length', 'hue']) && validPosition(bar.position) && integer(bar.length) && bar.length >= 2
      && bar.length <= Math.floor(PUBLIC_FRAME_PIXELS / unitArea) && color(bar.hue))
    || !integer(value.active) || value.active < 0 || value.active >= value.bars.length || value.bars[value.active].hue !== value.highlight
    || !Array.isArray(value.order) || value.order.length !== value.bars.length || !unique(value.order)
    || !value.order.every((index: any) => integer(index) && index >= 0 && index < value.bars.length)
    || !Array.isArray(value.goals) || !value.goals.length || value.goals.length > value.limit
    || !value.goals.every((n: any, i: number) => integer(n) && n >= 0 && n < value.limit && (i === 0 || value.goals[i - 1] < n))
    || !Array.isArray(value.sources) || !value.sources.length || value.sources.length > Math.floor(PUBLIC_FRAME_PIXELS / unitArea)
    || !value.sources.every((n: any, i: number) => integer(n) && n >= 0 && n < value.limit && (i === 0 || value.sources[i - 1] <= n))
    || !Array.isArray(value.goal_boxes) || value.goal_boxes.length < 2 || value.goal_boxes.length > PUBLIC_FRAME_PIXELS
    || !value.goal_boxes.every((box: any) => Array.isArray(box) && box.length === 4
      && box.every((n: any) => integer(n) && n >= 0 && n < PUBLIC_FRAME_PIXELS)
      && box[2] - box[0] + 1 === value.unit && box[3] - box[1] + 1 === value.unit)) return false;
  // The source retains floor(tangentExtent / unit), not the original shape.
  // Its aligned bars/cavities fit within unit*limit. A compatible initial
  // rectangle must contain both that extent and all retained normal positions.
  const tangentExtent = value.unit * value.limit;
  let normalExtent = 1, unusedPixels = PUBLIC_FRAME_PIXELS;
  for (const bar of value.bars) {
    const area = unitArea * bar.length;
    if (area > unusedPixels || bar.position[value.tangent] + value.unit * bar.length > tangentExtent) return false;
    unusedPixels -= area; normalExtent = Math.max(normalExtent, bar.position[value.axis] + value.unit);
  }
  for (const box of value.goal_boxes) {
    if (box[value.tangent + 2] + 1 > tangentExtent) return false;
    normalExtent = Math.max(normalExtent, box[value.axis + 2] + 1);
  }
  if (!publicSurface(normalExtent, tangentExtent)) return false;
  const expectedOrder = value.bars.map((_: any, i: number) => i).sort((a: number, b: number) => value.sign * (value.bars[a].position[value.axis] - value.bars[b].position[value.axis]));
  return equal(expectedOrder, value.order)
    && value.bars.every((bar: any) => bar.position[value.tangent] % value.unit === 0)
    && new Set(value.goal_boxes.map((box: any) => box[value.axis])).size === 1
    && equal([...new Set<number>(value.goal_boxes.map((box: any) => box[value.tangent] / value.unit))].sort((a, b) => a - b), value.goals);
}
/** current is set only from complete measured identities. The public shape may
 * change within an epoch; use a separate possible rectangle from the model's. */
function publicMeasuredPositions(positions: BranchPoint[], model: BranchModel): boolean {
  let width = 1, height = 1;
  for (let i = 0; i < positions.length; i++) {
    const position = positions[i]!, length = model.bars[i]!.length;
    width = Math.max(width, position[0] + model.unit * (model.tangent === 0 ? length : 1));
    height = Math.max(height, position[1] + model.unit * (model.tangent === 1 ? length : 1));
  }
  return publicSurface(width, height);
}
const tupleCompare = (left: any, right: any): number => {
  if (Array.isArray(left) && Array.isArray(right)) {
    for (let i = 0; i < Math.min(left.length, right.length); i++) { const result = tupleCompare(left[i], right[i]); if (result) return result; }
    return left.length - right.length;
  }
  return typeof left === 'number' && typeof right === 'number' ? left - right : compareUnicode(String(left), String(right));
};
function checkedSnapshot(snapshot: R): R {
  const value = structuredClone(snapshot); assertJson(value);
  // Old events do not retain their historical models or frame dimensions.
  // Check each state's necessary public origin domain independently. These
  // checks neither authenticate provenance nor impose a total history quota.
  if (!plainRecord(value) || value.format !== 'native.branch_routing.v1' || !(value.epoch === null || integer(value.epoch))
    || !validMotion(value.motion) || !Array.isArray(value.passed) || !value.passed.every((item: any) => plainRecord(item)
      && exactKeys(item, ['score', 'ref']) && integer(item.score) && typeof item.ref === 'string')
    || !Array.isArray(value.events) || !value.events.every((event: any) => plainRecord(event)
      && exactKeys(event, ['status', 'mode', 'before', 'after', 'ref']) && event.status === 'measured_response'
      && ['calibrate', 'move', 'select', 'propagate'].includes(event.mode) && validState(event.before)
      && (event.after === null || validState(event.after)) && typeof event.ref === 'string')) {
    throw new TypeError('Incompatible BranchRouting retained state');
  }
  const cold = ['format', 'epoch', 'motion', 'passed', 'events'];
  if (!Object.hasOwn(value, 'model')) {
    if (value.epoch !== null || !exactKeys(value, cold) || Object.keys(value.motion).length || value.passed.length || value.events.length) {
      throw new TypeError('Invalid cold BranchRouting snapshot');
    }
    return value;
  }
  if (!exactKeys(value, [...cold, 'model', 'current', 'verified', 'seen', 'refs', 'finished']) || value.epoch === null
    || !(value.model === null || validModel(value.model)) || !Array.isArray(value.current) || !value.current.every(validPosition)
    || !Array.isArray(value.verified) || !unique(value.verified)
    || !value.verified.every((key: any) => typeof key === 'string' && Object.hasOwn(value.motion, key))
    || !Array.isArray(value.seen) || !unique(value.seen) || !value.seen.every((item: any) => Array.isArray(item)
      && item.length === 3 && typeof item[0] === 'string' && validState([item[1], item[2]]))
    || !plainRecord(value.refs) || !Object.entries(value.refs).every(([key, ref]) => value.verified.includes(key) && typeof ref === 'string')
    || typeof value.finished !== 'boolean') throw new TypeError('Invalid BranchRouting epoch snapshot');
  if (value.model === null) {
    if (value.current.length || value.verified.length || value.seen.length || Object.keys(value.refs).length || value.finished) throw new TypeError('BranchRouting context without a measured model');
  } else if (value.current.length !== value.model.bars.length || !unique(value.current)
    || !publicMeasuredPositions(value.current, value.model)
    || value.seen.some((item: any) => item[1].length !== value.model.bars.length)) throw new TypeError('Inconsistent BranchRouting current identities');
  return value;
}

export class BranchRouting {
  readonly id = 'branch_routing'; readonly familyId = 'branch_routing';
  private readonly boundedSearch: BranchSearchBounds | null;
  private proposalRefusal: R | null = null;
  epoch: number | null = null; motion: Record<string, BranchPoint> = {}; passed: R[] = []; events: R[] = [];
  model: BranchModel | null | undefined; current: BranchPoint[] = []; verified = new Set<string>();
  seen = new Set<string>(); refs: Record<string, string> = {}; finished = false;
  constructor(options: NativeBranchRoutingOptions = {}) {
    this.boundedSearch = options.boundedSearch === undefined ? null : checkedBranchBounds(options.boundedSearch);
  }
  state(): R {
    const value: R = { format: 'native.branch_routing.v1', epoch: this.epoch, motion: this.motion, passed: this.passed, events: this.events };
    if (this.model !== undefined) Object.assign(value, { model: this.model, current: this.current,
      verified: [...this.verified].sort(compareUnicode), seen: [...this.seen].map(key => JSON.parse(key)).sort(tupleCompare), refs: this.refs, finished: this.finished });
    return structuredClone(value);
  }
  /** Validate all detached data before replacing any owner field. Historical
   * event identities are checked independently of the current epoch model;
   * predicted seen/event poses retain the source's partial-slice semantics. */
  restore(snapshot: R): void {
    const value = checkedSnapshot(snapshot);
    this.epoch = value.epoch; this.motion = value.motion; this.passed = value.passed; this.events = value.events;
    this.model = value.model; this.current = value.current ?? []; this.verified = new Set(value.verified ?? []);
    this.seen = new Set((value.seen ?? []).map(branchTupleKey)); this.refs = value.refs ?? {}; this.finished = value.finished ?? false;
    this.proposalRefusal = null;
  }
  clearTransient(): void { this.proposalRefusal = null; }
  private ownerRef(): string { return `branch_routing_owner:${digest(this.state())}`; }
  currentProposalRefusal(o: R): R | null {
    const refusal = this.proposalRefusal;
    if (!refusal || ['observation_ref', 'level_epoch', 'frame_hash', 'revision', 'levels_completed'].some(key => refusal[key] !== o[key])
      || refusal.owner_state_ref !== this.ownerRef()) return null;
    return structuredClone(refusal);
  }
  private start(o: R, rows: NativeRows, inputs: readonly R[]): void {
    this.epoch = o.level_epoch; this.model = branchLayout(o, rows, inputs); this.verified.clear(); this.seen.clear(); this.refs = {}; this.finished = false;
    this.current = this.model ? this.model.bars.map(bar => [...bar.position]) : [];
  }
  propose(o: R, rows: NativeRows, inputs: readonly R[], remaining: number, execution?: NativeExecution): R | null | Promise<R | null> {
    this.proposalRefusal = null;
    if (!Number.isSafeInteger(remaining)) throw new TypeError('BranchRouting remaining action allowance must be integral');
    if (o.level_epoch !== this.epoch) this.start(o, rows, inputs);
    if (!this.model || this.finished) return null;
    if (this.boundedSearch) return this.proposeBounded(o, rows, inputs, remaining, execution);
    const actual = branchObservedState(o, this.model, this.current); if (!actual) return null;
    this.current = actual[0];
    const ready = new Set(Object.values(this.motion).map(branchTupleKey)).size === 4;
    const plain = inputs.filter(command => !hasData(command)).map(command => command.action_ref as string).sort(compareUnicode);
    let placement: BranchPlacement | null = null;
    if (ready) {
      if (plain.filter(key => !Object.hasOwn(this.motion, key)).length !== 1) return null;
      placement = branchPlacement(this.model, actual[0], actual[1]); if (!placement) return null;
    }
    return this.packageProposal(o, rows, inputs, remaining, actual, ready, plain, placement);
  }
  private async proposeBounded(o: R, rows: NativeRows, inputs: readonly R[], remaining: number, execution?: NativeExecution): Promise<R | null> {
    let stable = this.ownerRef();
    const unchanged = () => { if (this.ownerRef() !== stable) throw new Error('BranchRouting memory changed during cooperative enumeration'); };
    try {
      const actual = await boundedBranchObservedStateCooperative(o, this.model!, this.current, this.boundedSearch!, execution);
      unchanged(); if (!actual) return null;
      this.current = actual[0]; stable = this.ownerRef();
      const ready = new Set(Object.values(this.motion).map(branchTupleKey)).size === 4;
      const plain = inputs.filter(command => !hasData(command)).map(command => command.action_ref as string).sort(compareUnicode);
      let placement: BranchPlacement | null = null;
      if (ready) {
        if (plain.filter(key => !Object.hasOwn(this.motion, key)).length !== 1) return null;
        placement = await boundedBranchPlacementCooperative(this.model!, actual[0], actual[1], this.boundedSearch!, execution);
        unchanged(); if (!placement) return null;
      }
      return this.packageProposal(o, rows, inputs, remaining, actual, ready, plain, placement);
    } catch (error) {
      unchanged(); if (!(error instanceof BranchRoutingIncomplete)) throw error;
      this.proposalRefusal = { schema: 'logos-engine.native.bounded-search-refusal.v1', rule: 'native.bounded_branch_routing',
        provider: this.familyId, observation_ref: o.observation_ref, level_epoch: o.level_epoch, frame_hash: o.frame_hash,
        ...(o.revision === undefined ? {} : { revision: o.revision }), levels_completed: o.levels_completed, owner_state_ref: stable,
        status: 'unknown', search_status: 'resource_bound', release_authority: false, search_phase: error.phase,
        reached_bound: error.cause, examined: error.examined, bounds: this.boundedSearch,
        scope: 'The current Cartesian enumeration is incomplete. No impossibility, optimal partial placement or acquired physical effect was established.' };
      return null;
    }
  }
  private packageProposal(o: R, rows: NativeRows, inputs: readonly R[], remaining: number, actual: BranchState,
    ready: boolean, plain: string[], placement: BranchPlacement | null): R | null {
    const model = this.model!, [positions, active] = actual, steps: R[] = [];
    if (!ready) {
      const unknown = plain.filter(key => !Object.hasOwn(this.motion, key) && !this.seen.has(branchTupleKey([key, positions, active])));
      if (!unknown.length) return null;
      steps.push({ action: { action_ref: unknown[0] }, mode: 'calibrate', state: actual, expected_after: null });
    } else {
      const commits = plain.filter(key => !Object.hasOwn(this.motion, key)), delta = placement!.displacement;
      const moving = delta.map((d, index) => d !== 0 ? index : -1).filter(index => index >= 0);
      if (!moving.length) steps.push({ action: { action_ref: commits[0] }, mode: 'propagate', state: actual, expected_after: null });
      else {
        const index = moving.includes(active) ? active : moving[0]!;
        if (index !== active) {
          const box = branchBbox(positions[index]!, model.bars[index]!.length, model);
          const command = inputs.find(a => hasData(a) && box[0] <= a.data.x && a.data.x <= box[2] && box[1] <= a.data.y && a.data.y <= box[3]);
          if (!command) return null;
          steps.push({ action: command, mode: 'select', state: actual, expected_after: [positions, index], box,
            point_digest: motifRowsDigest(projection(rows, box)) });
        } else {
          const d = delta[index]!, desired: BranchPoint = model.tangent === 0 ? [model.unit * (d > 0 ? 1 : -1), 0] : [0, model.unit * (d > 0 ? 1 : -1)];
          const keys = Object.keys(this.motion).filter(key => equal(this.motion[key], desired)); if (keys.length !== 1) return null;
          const key = keys[0]!; let state = actual;
          for (let n = 0; n < Math.min(Math.floor(Math.abs(d) / model.unit), remaining, 16); n++) {
            const poses = state[0].map(p => [...p] as BranchPoint), p = poses[index]!;
            poses[index] = [p[0] + desired[0], p[1] + desired[1]]; const prediction: BranchState = [poses, index];
            steps.push({ action: { action_ref: key }, mode: 'move', state, expected_after: prediction }); state = prediction;
            if (!this.verified.has(key)) break;
          }
        }
      }
    }
    if (!steps.length) return null;
    steps.forEach((step, i) => { step.expected_before = { level_epoch: this.epoch, frame_hash: i === 0 ? o.frame_hash : null }; });
    const actions = steps.map(step => step.action), refs = [...new Set<string>([o.observation_ref, ...Object.values(this.refs)])];
    const focus = 'C_branches_' + digest([refs, actions]).slice(0, 16);
    const why = 'Align the outputs of observed straight contributors with every receiving cavity, then test propagation.';
    const info: R = { sources: model.sources, cavities: model.goals, contributor_lengths: model.bars.map(bar => bar.length), current: actual,
      unit: model.unit, direction: model.sign, scope: 'A straight contributor is hypothesized to pass incoming fronts to its two outside endpoints; all branches remain obligations.' };
    if (ready) {
      info.predicted_offscreen_obligations = branchPropagated(placement!.starts, model, true)[1];
      info.boundary_hypothesis = 'Visible branches must enter cavities; offscreen exits remain conditional on the observed official outcome.';
    }
    const facts = { source_cap_and_open_cavities: true, parallel_contributors: true, joint_terminal_branches: true };
    return structuredClone({ status: 'proposed', kind: 'parallel_branch_routing', branch_plan: info, actions, steps, facts,
      compositions: [{ id: focus, role: 'information_question', observed: false, open_question: why, properties: info, relations: ['contributes_to:G_official_completion'] }],
      question: { reason: why, hypothesis_refs: refs }, route_refs: refs,
      binding: { observation_ref: o.observation_ref, level_epoch: this.epoch, levels_completed: o.levels_completed },
      bundle_template: { operation_key: 'OP18', composition_ref: focus, objective_ref: 'G_official_completion', preserve_refs: [],
        purpose: why, preconditions: facts, evidence: refs, actions, outcome_guard: { path: ['value'], contains: focus } } });
  }
  bind(proposal: R, domain: ObservedInputDomain): void {
    const frame = proposal.steps[0].expected_before.frame_hash;
    for (const step of proposal.steps as R[]) if (hasData(step.action)) {
      const point = step.action.data, binding = domain.bindings.get(`${this.epoch}:${frame}`)?.get(`${point.x},${point.y}`);
      if (!binding) throw new TypeError('BranchRouting point absent from the current observed input domain');
      step.point_binding = { ...structuredClone(binding), projection_bbox: [...step.box], projected_rows_digest: step.point_digest };
    }
  }
  before(proposal: R, index: number, publicPacket: NativePublicObservation, o: R): R {
    const step = proposal.steps[index], bound = proposal.binding;
    const ok = publicPacket.level === bound.level_epoch && publicPacket.levels_completed === bound.levels_completed
      && publicPacket.available_action_refs.includes(step.action.action_ref) && (index !== 0 || o.observation_ref === bound.observation_ref)
      && equal(branchReadState(publicPacket.frame_rows, this.model!, step.state[0]), step.state);
    return { admitted: Boolean(ok), reason: 'bind_selected_contributor_and_all_positions' };
  }
  after(proposal: R, index: number, before: R, after: R, _first: NativeRows, second: NativeRows): R {
    if (!equal([before.level_epoch, before.state, before.levels_completed], [after.level_epoch, after.state, after.levels_completed])) {
      return { matched: null, seal_prefix: true, reason: 'official_boundary' };
    }
    const prediction = proposal.steps[index].expected_after;
    const matched = prediction !== null ? equal(branchReadState(second, this.model!, prediction[0]), prediction) : null;
    return { matched, seal_prefix: matched !== true || index + 1 === proposal.steps.length, reason: 'compare_observed_contributor_pose' };
  }
  record(before: R, after: R, command: R, _first: NativeRows, _second: NativeRows, proposal: R, index: number,
    _frames: readonly NativeRows[] = [], execution?: NativeExecution): R {
    const step = proposal.steps[index], mode = step.mode, ref = after.observation_ref as string, key = command.action_ref as string, old = step.state as BranchState;
    if (after.levels_completed > before.levels_completed) {
      this.proposalRefusal = null; this.passed.push({ score: after.levels_completed, ref }); return { status: 'official_boundary', ref };
    }
    // The bounded identity search must finish before any owner mutation. On
    // failure, the typed exception identifies a still-unacquired official return.
    const current = this.boundedSearch ? boundedBranchObservedState(after, this.model!, old[0], this.boundedSearch, execution)
      : branchObservedState(after, this.model!, old[0]);
    this.proposalRefusal = null;
    const event: R = { status: 'measured_response', mode, before: structuredClone(old), after: current, ref };
    if (mode === 'propagate') this.finished = true;
    else if (mode === 'calibrate' || mode === 'move') {
      this.seen.add(branchTupleKey([key, old[0], old[1]]));
      if (current) {
        const moved = old[0].map((pos, j) => equal(pos, current[0][j]) ? -1 : j).filter(j => j >= 0);
        if (equal(moved, [old[1]])) {
          const a = old[0][moved[0]!]!, b = current[0][moved[0]!]!, vector: BranchPoint = [b[0] - a[0], b[1] - a[1]];
          if ((vector[0] === 0) !== (vector[1] === 0)) { this.motion[key] = vector; this.verified.add(key); this.refs[key] = ref; }
        }
      }
    }
    if (current) this.current = current[0].map(position => [...position]);
    this.events.push(structuredClone(event)); return event;
  }
}
