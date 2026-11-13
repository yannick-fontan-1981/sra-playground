/** Native transfer of pinned V6 facet_examples/family.py. One selected,
 * observation-bound response acquires visible effects; visual agreement alone
 * never supplies official acceptance or hidden occupancy. */
import { symbolicDigest as identity } from './v6-hash.ts';
import { pythonEqual as equal } from './v6-operations.ts';
import type { ObservedInputDomain } from './v6-native-observer.ts';
import { NativeSrcProgram, V6_DECLARATIVE_SOURCES, type NativeSrcReceipt } from './v6-src-program.ts';
import { facetBox, facetCenter, facetInside, facetLexicographic, facetProject, facetShape,
  type FacetPoint, type FacetProjection, type FacetTriple } from './v6-facet-examples-geometry.ts';
import { acquireFacetSeed, facetCompoundPlan, type FacetCompoundCache, type FacetCompoundConfiguration,
  type FacetPortableMethod } from './v6-facet-examples-compound.ts';
import type { JsonObject, JsonValue } from './ir.ts';
import type { NativeCommand, NativeObservation, NativeProgramHandle, NativeProgramRegistry, NativeProposal,
  NativePublicObservation, NativeRecord, NativeRows } from './v6-native-types.ts';

export interface FacetExampleConfiguration { question: string; compound?: FacetCompoundConfiguration }
export interface FacetLocalMethod extends NativeRecord {
  scope_ref: string; cap_shape: FacetPoint[]; cap_value: number; shift: FacetPoint; evidence: string[]; claim: string;
}
export interface FacetCompoundMethod extends NativeRecord { model_ref: string; offset: FacetPoint; evidence: string[]; scope: string }
interface FacetExampleStep extends NativeRecord {
  action: NativeCommand; expected_before: { level_epoch: number; frame_hash: string }; expected_after: null;
  point_binding: { observation_ref: string; entity_ref: string; signature: string; bbox: readonly number[];
    level_epoch: number; frame_hash: string; point: FacetPoint; palette_value: number };
}
export interface FacetExampleProposal extends NativeProposal {
  status: 'proposed'; kind: 'public_facet_example'; actions: NativeCommand[]; steps: FacetExampleStep[];
  facts: Record<string, boolean>; binding: { observation_ref: string; level_epoch: number; levels_completed: number; frame_hash: string };
  facet_plan: { projection: FacetProjection; trial: string;
    workflow: Pick<NativeSrcReceipt, 'workflow' | 'src_hash' | 'src_status' | 'executed_statements'>;
    method: FacetLocalMethod | FacetCompoundMethod | null };
  compositions: NativeRecord[]; question: { reason: string; hypothesis_refs: string[] }; route_refs: string[];
  bundle_template: { operation_key: string; composition_ref: string; objective_ref: string; preserve_refs: string[];
    purpose: string; preconditions: Record<string, boolean>; evidence: string[]; actions: NativeCommand[];
    outcome_guard: { path: string[]; contains: string } };
}
export interface FacetExampleState extends NativeRecord {
  failed: string[]; events: NativeRecord[]; method: FacetLocalMethod | null; epoch: number | null;
  portable: FacetPortableMethod | null; compound_methods: Record<string, FacetCompoundMethod>; refuted_compounds: string[];
}
const clone = <T>(value: T): T => structuredClone(value);
const json = (value: unknown): JsonValue => value as JsonValue;
const pixel = (rows: NativeRows, x: number, y: number): number => {
  const value = rows.at(y)?.at(x);
  if (value === undefined) throw new RangeError('A facet response pixel is outside the public raster');
  return value;
};
function outsidePreserved(first: NativeRows, second: NativeRows, world: readonly [number, number, number, number]): boolean {
  const [l, t, r, b] = world;
  for (let y = 0; y < first.length; y++) for (let x = 0; x < first[y]!.length; x++) {
    if ((!(l < x && x < r) || !(t < y && y < b)) && first[y]![x] !== pixel(second, x, y)) return false;
  }
  return true;
}

/** The source exposes the order of an integer set difference in side_changes.
 * This narrow table follows the same CPython probing/copy rules as the existing
 * native coordinate sets. The admitted observation palette is uint8. */
export function facetSideValues(values: readonly number[], excluded: number): number[] {
  type Table = (number | undefined)[];
  const locate = (table: Table, value: number): number => {
    const mask = table.length - 1; let index = value & mask, perturb = value;
    for (;;) {
      const probes = index + 9 <= mask ? 9 : 0;
      for (let n = 0; n <= probes; n++) if (table[index + n] === undefined || table[index + n] === value) return index + n;
      perturb = Math.floor(perturb / 32); index = (index * 5 + 1 + perturb) & mask;
    }
  };
  const capacity = (minimum: number): number => { let size = 8; while (size <= minimum) size *= 2; return size; };
  let table: Table = Array(8).fill(undefined), used = 0;
  const resize = (minimum: number): void => {
    const old = table; table = Array(capacity(minimum)).fill(undefined);
    for (const value of old) if (value !== undefined) table[locate(table, value)] = value;
  };
  const add = (value: number): void => {
    const at = locate(table, value);
    if (table[at] !== undefined) return;
    table[at] = value; used++;
    if (used * 5 >= (table.length - 1) * 3) resize(used > 50_000 ? used * 2 : used * 4);
  };
  for (const value of values) add(value);
  const original = table, originalUsed = used;
  if (Math.floor(originalUsed / 4) > 1) {
    // set.copy uses set_merge's presizing; deletion leaves a slot marker and
    // therefore preserves all remaining table positions for this iteration.
    const copiedSize = originalUsed * 5 >= 7 * 3 ? capacity(originalUsed * 2) : 8;
    if (copiedSize === original.length) return original.filter((value): value is number => value !== undefined && value !== excluded);
    const copied: Table = Array(copiedSize).fill(undefined);
    for (const value of original) if (value !== undefined) copied[locate(copied, value)] = value;
    return copied.filter((value): value is number => value !== undefined && value !== excluded);
  }
  table = Array(8).fill(undefined); used = 0;
  for (const value of original) if (value !== undefined && value !== excluded) add(value);
  return table.filter((value): value is number => value !== undefined);
}

export class NativeFacetExamples {
  readonly id = 'facet_examples';
  readonly configuration: FacetExampleConfiguration;
  private src: Promise<NativeProgramHandle>;
  private failed = new Set<string>();
  private events: NativeRecord[] = [];
  private method: FacetLocalMethod | null = null;
  private epoch: number | null = null;
  private portable: FacetPortableMethod | null = null;
  private compound_methods: Record<string, FacetCompoundMethod> = {};
  private refuted_compounds = new Set<string>();
  /** This memoized derivation is deliberately absent from state()/restore(). */
  readonly compound_cache: FacetCompoundCache = new Map();
  current: FacetProjection | null = null;
  last: null = null;
  private trial: string | null = null;
  private context: { obs: NativeObservation; rows: NativeRows; inputs: readonly NativeCommand[]; remaining: number } | null = null;

  constructor() {
    const source = (V6_DECLARATIVE_SOURCES as unknown as Record<string, { text: string }>)['agents/yf_arc3_v6/morphology_policy/facet_examples/facet_examples.drm']!;
    this.configuration = JSON.parse(source.text).declarations[0].configuration as FacetExampleConfiguration;
    this.src = NativeSrcProgram.create('v6.facet_examples.choose', this.callbacks());
  }
  private callbacks() {
    return {
      'facet.measure': (_args: JsonObject) => json(this.measure()),
      'facet.bind': (args: JsonObject) => json(this.select(args.measured as unknown as { qualified: boolean; remaining: number })),
    };
  }
  async attachPrograms(registry: NativeProgramRegistry): Promise<void> {
    this.src = registry.registerProgram('v6.facet_examples.choose', this.callbacks()); await this.src;
  }
  private measure(): { qualified: boolean; remaining: number } {
    const { obs, rows, remaining } = this.context!;
    if (this.epoch !== obs.level_epoch) {
      this.epoch = obs.level_epoch; this.method = null; this.failed = new Set(); this.compound_methods = {}; this.refuted_compounds = new Set();
    }
    this.current = facetProject(obs, rows);
    if (this.current === null && this.configuration.compound) {
      this.current = facetCompoundPlan(obs, rows, this.portable, this.compound_cache, this.configuration.compound);
      if (this.current && this.refuted_compounds.has(this.current.scope_ref)) this.current = null;
    }
    return { qualified: this.current !== null, remaining };
  }
  private select(measured: { qualified: boolean; remaining: number }): { selected: boolean } {
    const { obs, remaining } = this.context!;
    if (!measured.qualified || remaining < 1 || !obs.available_action_refs.includes('ACTION6')) return { selected: false };
    this.trial = identity([obs.level_epoch, obs.frame_hash, this.current!.offer.point]);
    return { selected: !this.failed.has(this.trial) };
  }
  async propose(obs: NativeObservation, rows: NativeRows, inputs: readonly NativeCommand[], remaining: number): Promise<FacetExampleProposal | null> {
    this.context = { obs, rows, inputs, remaining };
    const { result, receipt } = await (await this.src).run({ request: { observation_ref: obs.observation_ref } });
    if (!(result as unknown as { selected: boolean }).selected) return null;
    const current = this.current!, offer = current.offer, [x, y] = offer.point, support = offer.support;
    const action: NativeCommand = { action_ref: 'ACTION6', data: { x, y } };
    const focus = `composition:visible_contributions:${identity([obs.observation_ref, current.scope_ref]).slice(0, 20)}`;
    const evidence = [obs.observation_ref]; let method: FacetLocalMethod | FacetCompoundMethod | null = null;
    if (this.method && this.method.scope_ref === current.scope_ref && equal(this.method.cap_shape, facetShape(support))
      && this.method.cap_value === support.palette_value) { method = this.method; evidence.push(...method.evidence); }
    if (current.compound) {
      evidence.push(...this.portable!.evidence, this.portable!.boundary_ref!);
      const known = this.compound_methods[String(support.palette_value)];
      if (known && known.model_ref === current.compound.model_ref) {
        method = known; evidence.push(...known.evidence);
        current.compound.port_status = 'current_scope_stencil_extension_observed_and_current_render_revalidated';
      }
    }
    const facts: Record<string, boolean> = { facet_example_current: true, current_interior_bound: true };
    let target: NativeRecord | null = null, question = this.configuration.question;
    if (current.compound) {
      const c = current.compound; facts.recalled_stencil_current = true; question = this.configuration.compound!.question;
      target = { relative_stencil_origins: c.solution.placements, current_prefix: c.prefix, sampling_alternatives: c.solution.comparisons,
        port_status: c.port_status, preserve: 'all current visible contributions consistent with the same compound reference',
        falsifiers: c.falsifiers, model_limits: c.limits };
    }
    const workflow = { workflow: receipt.workflow, src_hash: receipt.src_hash, src_status: receipt.src_status, executed_statements: receipt.executed_statements };
    return { status: 'proposed', kind: 'public_facet_example', actions: [action],
      steps: [{ action, expected_before: { level_epoch: obs.level_epoch, frame_hash: obs.frame_hash }, expected_after: null,
        point_binding: { observation_ref: obs.observation_ref, entity_ref: support.id, signature: support.signature, bbox: support.bbox,
          level_epoch: obs.level_epoch, frame_hash: obs.frame_hash, point: [x, y], palette_value: pixel(rows, x, y) } }],
      facts, binding: { observation_ref: obs.observation_ref, level_epoch: obs.level_epoch, levels_completed: obs.levels_completed, frame_hash: obs.frame_hash },
      facet_plan: { projection: current, trial: this.trial!, workflow, method: clone(method) },
      compositions: [{ id: focus, role: 'information_question', observed: false,
        things: ['bounded_interiors', 'filled_example', 'separate_reference', 'visible_contributions'],
        properties: { offer: Object.fromEntries(Object.entries(offer).filter(([key]) => key !== 'support')),
          comparison_scale_hypothesis: current.scale_hypothesis, compound_target: target, owner: 'unknown_visible_support_only' },
        relations: ['contributes_to:G_official_completion'], open_question: question }],
      question: { reason: question, hypothesis_refs: evidence }, route_refs: evidence,
      bundle_template: { operation_key: 'OP18', composition_ref: focus, objective_ref: 'G_official_completion', preserve_refs: [],
        purpose: question, preconditions: facts, evidence, actions: [action], outcome_guard: { path: ['value'], contains: focus } } };
  }
  bind(proposal: FacetExampleProposal, _domain: ObservedInputDomain): void {
    if (proposal.actions.length !== proposal.steps.length) throw new Error('Unbound facet point');
    for (let index = 0; index < proposal.actions.length; index++) {
      const action = proposal.actions[index]!;
      if (!equal(proposal.steps[index]!.point_binding.point, [action.data.x, action.data.y])) throw new Error('Unbound facet point');
    }
  }
  before(proposal: FacetExampleProposal, index: number, publicPacket: NativePublicObservation, obs: NativeObservation) {
    const bound = proposal.binding, command = proposal.actions[index]!, step = proposal.steps[index]!, point = command.data;
    const offer = proposal.facet_plan.projection.offer;
    const ok = publicPacket.level === bound.level_epoch && publicPacket.levels_completed === bound.levels_completed
      && publicPacket.frame_hash === bound.frame_hash && obs.observation_ref === bound.observation_ref
      && equal(command, step.action) && publicPacket.available_action_refs.includes(command.action_ref)
      && equal([point.x, point.y], offer.point) && pixel(publicPacket.frame_rows, point.x!, point.y!) === step.point_binding.palette_value;
    return { admitted: ok, reason: ok ? 'current_visible_face_bound' : 'face_or_scope_changed' };
  }
  after(_proposal: FacetExampleProposal, _index: number, _before: NativeObservation, _after: NativeObservation,
    _first: NativeRows, _second: NativeRows) {
    return { matched: null, seal_prefix: true, reason: 'observe_current_face_edit_without_assuming_owner' };
  }
  record(before: NativeObservation, after: NativeObservation, command: NativeCommand, first: NativeRows, second: NativeRows,
    proposal: FacetExampleProposal, index: number): NativeRecord {
    if (!equal(command, proposal.actions[index]) || before.observation_ref !== proposal.binding.observation_ref) throw new Error('Unbound facet response');
    const old = proposal.facet_plan.projection, next = facetProject(after, second), refs = [before.observation_ref, after.observation_ref];
    let event: NativeRecord;
    if (after.levels_completed > before.levels_completed) {
      event = { status: 'official_boundary', evidence: refs, scope: 'visible-reference hypothesis corroborated, hidden occupancy not inferred' };
      if (this.portable) this.portable.boundary_ref = after.observation_ref;
    } else if (old.compound) {
      const c = old.compound, [l, t, r, b] = old.world, actual: FacetTriple[] = [];
      for (let y = t + 1; y < b; y++) for (let x = l + 1; x < r; x++) {
        const value = pixel(second, x, y); if (c.palette.includes(value)) actual.push([x, y, value]);
      }
      actual.sort(facetLexicographic);
      const preserved = outsidePreserved(first, second, old.world), matched = equal(actual, c.expected_colored_pixels) && preserved;
      event = { status: matched ? c.prefix === 0 ? 'compound_seed_effect_matched' : 'compound_extension_effect_matched' : 'compound_effect_refuted',
        prefix_before: c.prefix, expected_next_prefix: c.prefix + 1, outside_preserved: preserved,
        whole_colored_render_matched: matched, evidence: refs, claim: 'visible_stencil_change_only; hidden_voxel_count_not_inferred' };
      if (matched && c.prefix > 0) {
        const action = c.solution.actions[c.prefix - 1]!;
        this.compound_methods[String(action.port_value)] = { model_ref: c.model_ref, offset: action.offset,
          evidence: refs, scope: 'current_epoch_local_face_extrusion' };
      }
      if (matched && c.prefix + 1 === c.solution.placements.length) {
        event.status = 'compound_visual_candidate_not_accepted'; event.comparison_status = 'sampled_correspondence_insufficient_for_official_acceptance';
        this.refuted_compounds.add(old.scope_ref);
      }
      if (!matched) { this.refuted_compounds.add(old.scope_ref); this.method = null; }
    } else if (before.frame_hash === after.frame_hash) {
      event = { status: 'no_visible_effect', evidence: refs }; this.failed.add(proposal.facet_plan.trial);
    } else if (next && next.scope_ref === old.scope_ref && next.offer.kind === 'probe_visible_cap') {
      const preserved = outsidePreserved(first, second, old.world), cap = next.offer.support, previous = old.offer.support;
      const center = facetCenter(cap), previousCenter = facetCenter(previous), shift: FacetPoint = [center[0] - previousCenter[0], center[1] - previousCenter[1]];
      const sideChanges: { value: number; before: number[]; after: number[]; vertical_extension: boolean }[] = [];
      if (old.offer.kind === 'probe_visible_cap') {
        for (const value of facetSideValues(old.example_parts.map(p => p.palette_value), cap.palette_value)) {
          const a = before.entities.filter(e => e.palette_value === value && facetInside(e.bbox, old.world));
          const b = after.entities.filter(e => e.palette_value === value && facetInside(e.bbox, old.world));
          if (a.length && b.length) {
            const aa = facetBox(a), bb = facetBox(b);
            sideChanges.push({ value, before: aa, after: bb,
              vertical_extension: bb[1] < aa[1] && bb[3] === aa[3] && bb[0] === aa[0] && bb[2] === aa[2] });
          }
        }
      }
      const sidesExtended = sideChanges.length === old.example_parts.length - 1 && sideChanges.every(change => change.vertical_extension);
      event = { status: old.offer.kind === 'probe_congruent_empty_face' ? 'filled_example_correspondence'
        : sidesExtended ? 'observed_visible_cap_and_side_change' : 'cap_change_without_verified_side_extension',
      cap_shift: shift, side_changes: sideChanges, outside_preserved: preserved, evidence: refs };
      if (preserved && sidesExtended && old.offer.kind === 'probe_visible_cap' && shift[0] === 0 && shift[1] < 0) {
        this.method = { scope_ref: old.scope_ref, cap_shape: facetShape(cap), cap_value: cap.palette_value, shift, evidence: refs,
          claim: 'visible_cap_translation_after_this_interior_click; hidden_occurrence_count_unknown' };
        if (this.portable) { this.portable.up_shift = shift; this.portable.evidence = [...new Set([...this.portable.evidence, ...refs])]; }
      } else if (!preserved) { this.method = null; event.status = 'outside_contribution_changed'; }
      if (preserved && old.offer.kind === 'probe_congruent_empty_face') this.portable = acquireFacetSeed(before, after, first, second, old);
    } else { event = { status: 'effect_not_yet_explained', evidence: refs }; this.method = null; }
    this.events.push(event); return event;
  }
  state(): FacetExampleState {
    return clone({ failed: [...this.failed].sort(), events: this.events, method: this.method, epoch: this.epoch, portable: this.portable,
      compound_methods: this.compound_methods, refuted_compounds: [...this.refuted_compounds].sort() });
  }
  restore(state: NativeRecord): void {
    if (!Array.isArray(state.failed) || !state.failed.every(value => typeof value === 'string') || !Array.isArray(state.events)
      || !(state.method === null || typeof state.method === 'object' && !Array.isArray(state.method))
      || !(state.epoch === null || typeof state.epoch === 'number')) throw new TypeError('Invalid facet-example memory');
    this.failed = new Set(state.failed as string[]); this.events = clone(state.events) as NativeRecord[];
    this.method = clone(state.method) as FacetLocalMethod | null; this.epoch = state.epoch;
    this.portable = clone((state.portable ?? null) as FacetPortableMethod | null);
    this.compound_methods = clone((state.compound_methods ?? {}) as Record<string, FacetCompoundMethod>);
    this.refuted_compounds = new Set((state.refuted_compounds ?? []) as string[]);
    // Source restore does not import or erase recomputable caches/context.
    // A fresh owner still remeasures and revalidates the current example.
  }
}
