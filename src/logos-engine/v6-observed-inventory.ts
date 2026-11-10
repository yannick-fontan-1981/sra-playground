/** Source-owned V6 observed inventory composition. Historical methods and
 * displayed correspondences remain conditional on the current public scene. */
import { targets as local_contact_targets, reconcile as reconcile_local_contact,
  departure_support as endpoint_departure_support, equivalent_current_contact_offers } from './v6-inventory-local-contact.ts';
import { capture as capture_boundary, revalidate as revalidate_boundary,
  complements as remembered_complements, current_goal_witnesses } from './v6-inventory-boundary.ts';
import { endpoint_measurements, retained_method_targets } from './v6-inventory-endpoints.ts';
import { access_measurements, capacity_targets } from './v6-inventory-continuation.ts';
import { recall as recall_effect_scope, retain as retain_effect_scope, contrast as contrast_effect_scope } from './v6-inventory-effect-scope.ts';
import { targets as context_targets, record as record_context_intervention, decorate as decorate_context_question } from './v6-inventory-context-intervention.ts';
import { CellProjection } from './v6-inventory-project.ts';
import { world_complements, display_matches } from './v6-inventory-contrast.ts';
import { measured_dependencies, recalled_gain_targets, frontier_target } from './v6-inventory-dependencies.ts';
import { provisional_scenes } from './v6-inventory-initial.ts';
import { measured_paths } from './v6-inventory-routing.ts';
import { digest, find_body, locate, moved_core } from './v6-inventory-measurements.ts';
import { InventoryPolicy, INVENTORY_WORKFLOW, inventoryReceipt } from './v6-inventory-policy.ts';
import { InventoryCallerContext, ObservedMeter, CollectionEvidence } from './v6-inventory-caller-context.ts';
import { NativeSrcProgram } from './v6-src-program.ts';
import { checkPreservation } from './v6-transition-learning.ts';
import { pythonEqual as same, pythonTruthy as truth } from './v6-operations.ts';
import { retainNativeJson } from './v6-native-owned.ts';
import { captureWorkingWitness, matchesWorkingWitness, type NativeWorkingWitness } from './v6-native-working-witness.ts';
import { isJsonObject } from './canonical.ts';
import type { JsonObject, Primitive } from './ir.ts';
import type { NativeFamily, NativeRows, NativeRecord, NativeObservation, NativePublicObservation,
  NativeBeforeResult, NativeAfterResult, NativeRecordResult, NativeCommand, NativeProgramHandle, NativeProgramRegistry } from './v6-native-types.ts';
type R = Record<string, any>;
const clone = <T>(value: T): T => structuredClone(value);
const FIELDS = ['tracker', 'seen_pairs', 'failed', 'access_returns', 'endpoint_memory', 'boundary_memory', 'pending_access', 'retained_effect_scope'] as const;
const WORKING_FIELDS = [...FIELDS, 'callerContext'] as const;
const FORMAT = 'native.public_observed_inventory.v1';
const core = (entity: R): R => ({ signature: entity.signature, palette_value: entity.palette_value, area: entity.area, offsets: clone(entity.mask) });

/** Resolve a data method without invoking a replacement accessor. A customized
 * projection remains on the ordinary source serialization/validation path. */
function dataMethod(value: unknown, name: string): unknown {
  for (let owner = value; owner !== null && (typeof owner === 'object' || typeof owner === 'function'); owner = Object.getPrototypeOf(owner)) {
    const descriptor = Object.getOwnPropertyDescriptor(owner, name);
    if (descriptor) return 'value' in descriptor ? descriptor.value : undefined;
  }
  return undefined;
}

const cellStateProjection = CellProjection.prototype.state;
const cellRestoreProjection = CellProjection.prototype.restore;
const contextStateProjection = InventoryCallerContext.prototype.state;
const meterStateProjection = ObservedMeter.prototype.state;
const collectionStateProjection = CollectionEvidence.prototype.retained_state;

function retainedSourceState(value: R): R {
  const state = retainNativeJson(value);
  if (Object.keys(state).length !== FIELDS.length || FIELDS.some(k => !Object.hasOwn(state, k))
    || !isJsonObject(state.tracker) || ['seen_pairs', 'access_returns', 'endpoint_memory'].some(k => !Array.isArray(state[k]) || !state[k].every(isJsonObject))
    || !Array.isArray(state.failed) || !state.failed.every(v => typeof v === 'string')
    || ['boundary_memory', 'pending_access', 'retained_effect_scope'].some(k => state[k] !== null && !isJsonObject(state[k]))) {
    throw new TypeError('Invalid observed inventory source state');
  }
  return state;
}

function validatedState(value: R): R {
  const state = retainedSourceState(value);
  const tracker = new CellProjection(); tracker.restore(clone(state.tracker));
  return state;
}

interface PreparedInventoryState {
  tracker: CellProjection;
  fields: readonly (readonly [string, unknown])[];
}

/** CellProjection.restore already detaches its input. Keep that validated
 * working tracker, and detach every other field before publishing any owner. */
function prepareSourceState(value: R): PreparedInventoryState {
  const state = retainedSourceState(value), tracker = new CellProjection();
  tracker.restore(state.tracker);
  const fields = FIELDS.filter(key => key !== 'tracker').map(key => [key, clone(state[key])] as const);
  return { tracker, fields };
}

export class ObservedInventory implements NativeFamily<any> {
  readonly id = 'public_observed_inventory';
  readonly policy: InventoryPolicy;
  readonly config: R;
  tracker = new CellProjection();
  seen_pairs: R[] = [];
  failed: string[] = [];
  selected: R | null = null;
  access_returns: R[] = [];
  endpoint_memory: R[] = [];
  boundary_memory: R | null = null;
  pending_access: R | null = null;
  retained_effect_scope: R | null = null;
  context: any[] = [];
  measured: R = { options: [] };
  private program!: NativeProgramHandle;
  private readonly callbacks: Readonly<Record<string, Primitive>>;
  private checkpoint: R | null = null;
  private checkpointWitness: readonly NativeWorkingWitness[] | null = null;
  private revision = 0;
  private callerContext: InventoryCallerContext | null = null;
  private goalModels: (() => readonly R[]) | null = null;

  private constructor(policy: InventoryPolicy) {
    this.policy = policy; this.config = policy.config;
    this.callbacks = Object.freeze({
      'inventory.measure': () => this.measured as JsonObject,
      'inventory.interpret': args => this.select(args.measured as R) as JsonObject,
    });
  }
  static async create(): Promise<ObservedInventory> {
    const family = new ObservedInventory(await InventoryPolicy.create());
    family.program = await NativeSrcProgram.create(INVENTORY_WORKFLOW, family.callbacks); return family;
  }
  async attachPrograms(registry: NativeProgramRegistry): Promise<void> { this.program = await registry.registerProgram(INVENTORY_WORKFLOW, this.callbacks); }
  enableCallerContext(goalModels: () => readonly R[]): void {
    // A retained owner may be reattached to a new Kernel caller during restore.
    this.goalModels = goalModels; this.callerContext ??= new InventoryCallerContext();
  }
  callerContextState(): R | null { return this.callerContext?.state() ?? null; }
  /** Read the already acquired common meter. Planning does not observe a frame. */
  callerMeterForecast(): R | null { return this.callerContext?.meter.forecast() ?? null; }
  /** Borrow the existing common collection owner; morphology never acquires or copies it. */
  callerCollectionEvidence(): CollectionEvidence | null { return this.callerContext?.collection ?? null; }
  observeCallerContext(obs: R, rows: NativeRows): void { this.callerContext?.observePlanning(obs, rows); }
  recordCallerContext(before: NativeObservation, after: NativeObservation, command: R, first: NativeRows, second: NativeRows, proposal: R, index: number): R[] {
    return this.callerContext?.record(before, after, command, first, second, proposal, index) ?? [];
  }
  get nativeRevision(): number { this.nativeState(); return this.revision; }
  /** The public source containers intentionally remain mutable. These exact
   * witnesses cover the entire persisted tracker, eight source fields and caller
   * context, including nested maps/sets/arrays; a version alone is insufficient. */
  private workingValues(): readonly unknown[] | null {
    const values: unknown[] = [];
    for (const key of WORKING_FIELDS) {
      const descriptor = Object.getOwnPropertyDescriptor(this, key);
      if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) return null;
      values.push(descriptor.value);
    }
    const tracker = values[0], context = values.at(-1);
    if (dataMethod(this, 'state') !== inventoryStateProjection
      || dataMethod(this, 'callerContextState') !== inventoryContextProjection
      || dataMethod(tracker, 'state') !== cellStateProjection
      || dataMethod(this, 'restore') !== inventoryRestoreProjection
      || dataMethod(CellProjection.prototype, 'restore') !== cellRestoreProjection) return null;
    if (context !== null) {
      const meter = Object.getOwnPropertyDescriptor(context, 'meter');
      const collection = Object.getOwnPropertyDescriptor(context, 'collection');
      if (!meter || !('value' in meter) || !collection || !('value' in collection)
        || dataMethod(context, 'state') !== contextStateProjection
        || dataMethod(meter.value, 'state') !== meterStateProjection
        || dataMethod(collection.value, 'retained_state') !== collectionStateProjection) return null;
    }
    return values;
  }
  private captureCheckpointWitness(): void {
    // Unsupported working containers keep their previous source behavior;
    // optional memoization never introduces an additional acceptance or refusal.
    try { this.checkpointWitness = this.workingValues()?.map(value => captureWorkingWitness(value)) ?? null; }
    catch { this.checkpointWitness = null; }
  }
  private unchangedCheckpointWorkingState(): boolean {
    if (!this.checkpointWitness) return false;
    try {
      const values = this.workingValues();
      return values !== null && values.every((value, index) => matchesWorkingWitness(this.checkpointWitness![index]!, value));
    } catch { return false; }
  }
  state(): R {
    return { tracker: this.tracker.state(), ...clone(Object.fromEntries(FIELDS.filter(k => k !== 'tracker').map(k => [k, this[k]]))) };
  }
  sourceState(): R { return this.state(); }
  private publishSourceState(next: PreparedInventoryState): void {
    this.tracker = next.tracker;
    for (const [key, value] of next.fields) (this as unknown as R)[key] = value;
    this.checkpointWitness = null;
  }
  restore(value: NativeRecord): void {
    const source = { tracker: value.tracker, seen_pairs: value.seen_pairs ?? [], failed: value.failed ?? [],
      access_returns: value.access_returns ?? [], endpoint_memory: value.endpoint_memory ?? [], boundary_memory: value.boundary_memory ?? null,
      pending_access: value.pending_access ?? null, retained_effect_scope: value.retained_effect_scope ?? null };
    if (dataMethod(CellProjection.prototype, 'restore') === cellRestoreProjection) {
      this.publishSourceState(prepareSourceState(source)); return;
    }
    // A customized source restore retains the original calls and their order.
    const next = validatedState(source);
    const tracker = new CellProjection(); tracker.restore(clone(next.tracker));
    this.tracker = tracker;
    for (const k of FIELDS) if (k !== 'tracker') (this as unknown as R)[k] = clone(next[k]);
    this.checkpointWitness = null;
  }
  nativeState(): NativeRecord {
    if (this.checkpoint && this.unchangedCheckpointWorkingState()) return this.checkpoint;
    const value = { format: FORMAT, source_state: validatedState(this.state()), caller_context: this.callerContextState() };
    if (!this.checkpoint || !same(this.checkpoint, value)) { this.checkpoint = retainNativeJson(value); this.revision++; }
    this.captureCheckpointWitness();
    return this.checkpoint;
  }
  restoreNative(value: Readonly<NativeRecord>): void {
    if (value === this.checkpoint && this.unchangedCheckpointWorkingState()) return;
    if (value === this.checkpoint && same(this.state(), this.checkpoint!.source_state)
      && same(this.callerContextState(), this.checkpoint!.caller_context)) { this.captureCheckpointWitness(); return; }
    const supplied = retainNativeJson(value);
    if (!isJsonObject(supplied) || supplied.format !== FORMAT || Object.keys(supplied).length !== 3
      || !isJsonObject(supplied.source_state) || (supplied.caller_context === null) !== (this.callerContext === null)) {
      throw new TypeError('Invalid native observed inventory checkpoint');
    }
    let context: InventoryCallerContext | null;
    if (dataMethod(this, 'restore') === inventoryRestoreProjection
      && dataMethod(CellProjection.prototype, 'restore') === cellRestoreProjection) {
      const next = prepareSourceState(supplied.source_state);
      context = this.callerContext ? new InventoryCallerContext() : null;
      if (context) context.restore(supplied.caller_context as R);
      this.publishSourceState(next);
    } else {
      const next = validatedState(supplied.source_state);
      context = this.callerContext ? new InventoryCallerContext() : null;
      if (context) context.restore(supplied.caller_context as R);
      this.restore(next);
    }
    this.callerContext = context;
    const changed = !this.checkpoint || !same(this.checkpoint, supplied); this.checkpoint = supplied; if (changed) this.revision++;
    // Source restorers may add defaults or normalize duplicate Map entries.
    // The incoming value is not yet a projection of those working owners.
    // Only a subsequent source projection may certify checkpoint reuse.
    this.checkpointWitness = null;
  }
  preservationObligations(obs: NativeObservation, rows: NativeRows): R[] { return this.preservation_obligations(obs, rows); }
  preservation_obligations(obs: R, rows: NativeRows): R[] {
    let held = this.tracker.epoch === obs.level_epoch ? this.tracker.displayed : null;
    const recall = revalidate_boundary(this.boundary_memory, obs, rows, this.tracker.transfer_methods);
    if (!truth(held) && recall.status === 'revalidated_hypothesis') held = recall.record;
    if (!truth(held)) return [];
    const recalled = truth(held!.visibility);
    if (!recalled && (this.tracker.epoch !== obs.level_epoch || !display_matches(held!, rows))) return [];
    const [l, t] = held!.display_bbox, pixels = recalled ? held!.current_indicator_pixels : held!.source_mask.map(([x, y]: number[]) => [l + x!, t + y!, held!.source_value]);
    const revision_inputs = [held!.action.action_ref], bodySignature = recalled ? recall.body_signature : this.tracker.core, body = find_body(obs, bodySignature);
    let pairs = this.seen_pairs;
    if (recalled) {
      const measured = this.tracker.epoch === obs.level_epoch ? this.tracker.measure(obs, rows) : {};
      const scenes = measured.status === 'measured' ? [measured] : provisional_scenes(obs, rows);
      pairs = scenes.filter((scene: R) => scene.body_signature === bodySignature).flatMap((scene: R) => remembered_complements(scene, rows, held!));
    }
    if (body) {
      const cx = (body.bbox[0] + body.bbox[2]) / 2, cy = (body.bbox[1] + body.bbox[3]) / 2;
      for (const pair of pairs) {
        if (pair.level_epoch !== obs.level_epoch || pair.source_value !== held!.source_value) continue;
        const [tl, tt, tr, tb] = pair.target_bbox, tx = (tl + tr) / 2, ty = (tt + tb) / 2;
        for (const [cmd, vector] of Object.entries(this.config.interface_prior.directions) as [string, number[]][]) {
          const delta = this.tracker.controls[cmd]?.delta ?? [vector[0]! * (tr - tl + 1), vector[1]! * (tb - tt + 1)];
          if (same([cx + delta[0], cy + delta[1]], [tx, ty])) revision_inputs.push(cmd);
        }
      }
    }
    return [{ id: 'preserve:displayed_signature:' + digest(held!.evidence), meaning: 'Preserve the current observed indicator until the bound access or allocation experiment; its hidden content remains a hypothesis.',
      pixels, revision_inputs, evidence: held!.evidence }];
  }
  remember(facts: R, rows: NativeRows): R[] {
    const pairs = world_complements(facts, rows);
    for (const pair of pairs) {
      const key = digest([pair.level_epoch, pair.source_value, pair.source_cell, pair.target_cell]);
      if (!this.seen_pairs.some(x => x.key === key)) this.seen_pairs.push({ key, ...clone(pair) });
    }
    return pairs;
  }
  project(_request: R): R {
    const [obs, rows, inputs, remaining, forecast, goal_models, collection] = this.context;
    const available = new Set<string>(inputs.filter((a: R) => !truth(a.data)).map((a: R) => a.action_ref));
    const [facts, probe_input] = this.tracker.measure_with_input(obs, rows);
    const scenes = facts.status === 'measured' ? [facts] : this.tracker.core === null ? provisional_scenes(obs, rows) : [];
    const options: R[] = [];
    for (const scene of scenes) {
      if (!truth(scene.support_effect_scope)) scene.support_effect_scope = recall_effect_scope(this.retained_effect_scope, scene, obs, rows);
      scene.conditional_departure_support = endpoint_departure_support(scene, obs, rows, this.endpoint_memory, this.config.equivalent_departure_witnesses);
      let pairs = this.remember(scene, rows), display = scene.displayed_candidate ?? null;
      const targets: any[] = [], recall = revalidate_boundary(this.boundary_memory, obs, rows, this.tracker.transfer_methods);
      if (!truth(display) && recall.status === 'revalidated_hypothesis' && scene.body_signature === recall.body_signature) {
        const witnesses = current_goal_witnesses(scene, rows, goal_models);
        if (truth(witnesses)) { display = recall.record; scene.displayed_candidate = display; scene.display_complements = remembered_complements(scene, rows, display); scene.goal_revalidation = witnesses; }
      }
      let dependency: R | null = null;
      const held = truth(display) ? display : this.pending_access && this.pending_access.level_epoch === obs.level_epoch ? this.pending_access.held : null;
      if (truth(held)) {
        const dep_pairs = truth(display) ? scene.display_complements ?? [] : remembered_complements(scene, rows, held);
        const found = measured_dependencies(scene, rows, pairs, dep_pairs, this.config.interface_prior.directions, available);
        if (found.length === 1) dependency = found[0]!;
      }
      if (dependency) {
        if (truth(display)) { const candidate = frontier_target(scene, dependency, display); if (candidate) targets.push(candidate); }
        else pairs = pairs.filter((p: R) => same(p.source_cell, dependency!.supplier.source_cell) && same(p.target_cell, dependency!.supplier.target_cell)).map((p: R) => ({ ...p, dependency }));
        targets.push(...recalled_gain_targets(scene, obs, collection, dependency));
      }
      if (truth(display)) {
        for (const pair of scene.display_complements ?? []) if (pair.display_component_ref === display.display_component_ref) {
          const recalled = truth(display.visibility), flags = { display_transfer_current: !recalled,
            display_complement_unique: !recalled && scene.display_complements.length === 1,
            remembered_correspondence_unique: recalled && scene.display_complements.length === 1,
            prior_boundary_target_revalidated: truth(scene.goal_revalidation), world_complement_unique: false, local_source_retained: false };
          targets.push([[pair.target_row, pair.target_col], flags, { ...pair, goal_revalidation: scene.goal_revalidation ?? [] }]);
        }
      } else {
        for (const pair of pairs) targets.push([pair.source_cell, { display_transfer_current: false, display_complement_unique: false,
          world_complement_unique: pairs.length === 1, local_source_retained: false }, pair]);
        const under = scene.underlay_evidence ?? {};
        if (truth(scene.retained_underlay_value_count) && truth(under.cell_bbox)) {
          const [l, t, r, b] = under.cell_bbox, grid = scene.grids[0];
          for (const pair of this.seen_pairs) {
            if (dependency && (!same(pair.source_cell, dependency.supplier.source_cell) || !same(pair.target_cell, dependency.supplier.target_cell))) continue;
            if (pair.level_epoch !== obs.level_epoch) continue;
            const [sr, sc] = pair.source_cell, cell = grid.cells.find((c: R) => c.row === sr && c.col === sc);
            if (!cell || !same(['left', 'top', 'right', 'bottom'].map(k => cell.bbox[k]), [l, t, r, b])) continue;
            const [tl, tt, tr, tb] = pair.target_bbox, value = pair.source_value, shape = new Set(pair.source_mask.map((q: number[]) => q.join(','))), [dx, dy] = pair.offset;
            let contradicted = false;
            for (let y = 0; y < tb - tt + 1; y++) for (let x = 0; x < tr - tl + 1; x++) if ((rows[tt + y][tl + x] === value) === shape.has([x - dx, y - dy].join(','))) contradicted = true;
            if (contradicted) continue;
            targets.push([pair.source_cell, { display_transfer_current: false, display_complement_unique: false, world_complement_unique: true, local_source_retained: true }, pair]);
          }
        }
      }
      const returned = [...this.access_returns].reverse().find(z => z.level_epoch === obs.level_epoch && truth(z.active)) ?? null;
      targets.push(...capacity_targets(scene, obs, forecast, returned));
      const endpoints = endpoint_measurements(scene, probe_input, obs, rows, forecast, returned, this.tracker.underlays, this.config.interface_prior.directions);
      for (const [, , item] of endpoints) {
        const key = [item.level_epoch, item.source_cell, item.source_entity ? item.source_entity.signature : null];
        this.endpoint_memory = this.endpoint_memory.filter(old => !same([old.level_epoch, old.source_cell, old.source_entity ? old.source_entity.signature : null], key));
        this.endpoint_memory.push(item); this.endpoint_memory = this.endpoint_memory.slice(-32);
      }
      targets.push(...endpoints, ...local_contact_targets(scene, obs, rows, this.endpoint_memory, this.tracker.transfer_methods, this.config.interface_prior),
        ...retained_method_targets(scene, obs, rows, this.endpoint_memory, this.tracker.transfer_methods, returned));
      targets.push(...context_targets(scene, obs, rows, this.endpoint_memory, this.tracker.transfer_methods, targets));
      for (const [target, flags, pair] of targets) {
        const interpretations = this.policy.interpret({ current_scope_and_observation: true, ...flags });
        if (interpretations.status !== 'unique') continue;
        const meaning = interpretations.conclusions[0], kind = meaning.status;
        const paths = measured_paths(scene, rows, [target], this.config.interface_prior.directions, available, Math.min(16, remaining));
        for (const route of paths) {
          let steps: R[];
          if (!route.path.length) {
            const action = clone(truth(pair.method_action) ? pair.method_action : { action_ref: this.config.interface_prior.interaction });
            if (!['acquisition_probe_candidate', 'method_probe_candidate', 'allocation_probe_candidate', 'local_contact_probe_candidate', 'local_contact_recall_candidate', 'context_reconfiguration_candidate'].includes(kind) || !available.has(action.action_ref)) continue;
            steps = [{ action, from_cell: route.start_cell, to_cell: route.start_cell, control: { status: 'interaction_hypothesis' }, surface_status: 'unknown_transaction' }];
          } else steps = route.prefix;
          if (!steps.length || steps.length > remaining) continue;
          const entity = find_body(obs, scene.body_signature); if (!entity) continue;
          const key = digest([obs.level_epoch, scene.body_signature, scene.body, target, steps[0]!.action, truth(display), rows.slice(scene.body[1], scene.body[3] + 1)]);
          if (this.failed.includes(key)) continue;
          const current_forecast = truth(forecast) && forecast.observation_ref === obs.observation_ref && forecast.level_epoch === obs.level_epoch;
          const minimum_cost = route.length + (['approach_candidate', 'acquisition_probe_candidate', 'endpoint_approach_candidate', 'method_probe_candidate', 'local_contact_probe_candidate', 'local_contact_recall_candidate', 'context_reconfiguration_candidate'].includes(kind) ? 1 : 0);
          const financing = { minimum_composition_primitives: minimum_cost, prefix_primitives: steps.length,
            remaining_steps_before_empty: current_forecast ? forecast.steps_before_empty : null, final_margin: 1,
            status: current_forecast ? minimum_cost + 1 <= forecast.steps_before_empty ? 'lower_bound_inside_margin' : 'lower_bound_exceeds_margin' : 'unmeasured',
            unknown: ['full_future_continuation_cost', 'recharge_or_exhaustion_law'] };
          options.push({ scene, target: pair, conclusions: meaning, kind, steps, path_length: route.length, primitive_count: steps.length, route, core: core(entity), key, forecast, financing });
        }
      }
    }
    return { options };
  }
  select(measured: R): R {
    const options = measured.options.filter((o: R) => this.config.admitted_financing_statuses.includes(o.financing.status)); this.selected = null;
    if (options.length) {
      const rank = (o: R): number[] => [this.config.choice_order.indexOf(o.kind), ...this.config.choice_fields.map((k: string) => o[k])];
      const compare = (a: number[], b: number[]): number => { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i]! - b[i]!; return 0; };
      if (options.some((o: R) => rank(o)[0] === -1)) throw new TypeError('Inventory choice kind absent from source priority');
      const best = options.map(rank).sort(compare)[0], pool = equivalent_current_contact_offers(options.filter((o: R) => same(rank(o), best)), this.config.equivalent_contact_offers ?? {}, digest);
      const groups = new Map<string, R>();
      for (const o of pool) groups.set(digest([o.scene.body_signature, o.target, o.steps.map((s: R) => s.action)]), o);
      if (groups.size === 1) this.selected = groups.values().next().value!;
      if (this.selected && truth(this.selected.target.dependency) && truth(this.selected.scene.displayed_candidate)) {
        this.pending_access = { level_epoch: this.context[0].level_epoch, dependency: clone(this.selected.target.dependency), held: clone(this.selected.scene.displayed_candidate) };
      }
    }
    return { selected: this.selected !== null, alternatives: options.length };
  }
  async propose(obs: NativeObservation, rows: NativeRows, inputs: readonly NativeCommand[], remaining: number): Promise<any | null> {
    if (this.callerContext) {
      return this.proposeSource(obs, rows, inputs, remaining, this.callerContext.meter.forecast(), this.goalModels!(), this.callerContext.collection);
    }
    return this.proposeSource(obs, rows, inputs, remaining);
  }
  async proposeInSubquestion(group: string, question: string, obs: NativeObservation, rows: NativeRows,
    inputs: readonly NativeCommand[], remaining: number): Promise<any | null> {
    if (group !== 'factored_material_return' || question !== 'observed_inventory_composition') throw new TypeError('Unknown observed inventory entry');
    const proposal = await this.propose(obs, rows, inputs, remaining);
    if (proposal) proposal.material_access_subquestion = question;
    return proposal;
  }
  async proposeSource(obs: R, rows: NativeRows, inputs: readonly R[], remaining: number,
    forecast: R | null = null, goal_models: readonly R[] = [], collection: any = null): Promise<any | null> {
    if (remaining < 1) return null;
    this.tracker.observe_scope(obs, rows);
    const recall = revalidate_boundary(this.boundary_memory, obs, rows, this.tracker.transfer_methods);
    if (recall.status === 'contradicted') {
      this.boundary_memory!.active = false; this.boundary_memory!.refutation = { observation_ref: obs.observation_ref, reason: recall.reason };
    }
    if (this.tracker.core === null && recall.status === 'revalidated_hypothesis') this.tracker.core = recall.body_signature;
    this.context = [obs, rows, inputs, remaining, forecast, truth(goal_models) ? goal_models : [], collection];
    this.measured = this.project({ observation_ref: obs.observation_ref });
    if (!this.measured.options.length) return null;
    const { result, receipt } = await this.program.run({ request: { observation_ref: obs.observation_ref } });
    if (!isJsonObject(result) || !result.selected) return null;
    const plan = clone(this.selected!), scene = plan.scene, grid = scene.grids[0], [l, t, r, b] = scene.body, steps: R[] = [];
    for (const [i, step] of plan.steps.entries()) {
      const dr = step.to_cell[0] - plan.route.start_cell[0], dc = step.to_cell[1] - plan.route.start_cell[1];
      const expected = [l + dc * grid.col_pitch, t + dr * grid.row_pitch, r + dc * grid.col_pitch, b + dr * grid.row_pitch];
      const prior_dr = step.from_cell[0] - plan.route.start_cell[0], prior_dc = step.from_cell[1] - plan.route.start_cell[1];
      const before_box = [l + prior_dc * grid.col_pitch, t + prior_dr * grid.row_pitch, r + prior_dc * grid.col_pitch, b + prior_dr * grid.row_pitch];
      steps.push({ action: step.action, body_before: before_box, to_cell: [...step.to_cell],
        expected_after: step.control.status === 'interaction_hypothesis' ? null : { body_bbox: expected, qualification: 'conditional_body_and_step_prediction' },
        seal_after: step.control.status !== 'observed_translation' || i === plan.steps.length - 1 });
    }
    const actions = steps.map(s => s.action), focus = 'composition:inventory:' + digest([obs.observation_ref, plan.target, plan.kind]);
    const facts = { current_inventory_composition_bound: true }, evidence = [obs.observation_ref, ...(scene.displayed_candidate ?? {}).evidence ?? []];
    const meaning = plan.conclusions;
    evidence.push(...(plan.target.goal_revalidation ?? []).map((w: R) => w.boundary_before),
      ...(plan.target.dependency_return ?? {}).evidence ?? [], ...(plan.target.method ?? {}).evidence ?? [], ...plan.target.evidence ?? []);
    const control_revalidation = Object.fromEntries(Object.entries(scene.controls ?? {}).filter(([, record]: [string, any]) => truth(record.parameter_revalidation))
      .map(([cmd, record]: [string, any]) => [cmd, clone(record.parameter_revalidation)]));
    for (const record of Object.values(control_revalidation) as R[]) for (const ref of [...record.evidence, ...record.prior_scope_method.evidence.flat()]) if (!evidence.includes(ref)) evidence.push(ref);
    const unresolved_controls = clone(scene.unresolved_current_controls ?? {});
    for (const record of Object.values(unresolved_controls) as R[]) for (const ref of [...record.evidence, ...record.prior_scope_method.evidence.flat()]) if (!evidence.includes(ref)) evidence.push(ref);
    const scope = scene.support_effect_scope ?? null;
    if (truth(scope)) for (const ref of scope.evidence) if (!evidence.includes(ref)) evidence.push(ref);
    const departure = plan.route.conditional_departure_support ?? null;
    if (truth(departure)) for (const ref of departure.evidence) if (!evidence.includes(ref)) evidence.push(ref);
    const material_entries = [...plan.route.conditional_material_entries ?? []], dependency = plan.target.dependency || {};
    for (const route_name of ['frontier_route', 'supplier_route']) material_entries.push(...(dependency[route_name] ?? {}).conditional_material_entries ?? []);
    for (const entry of material_entries) for (const ref of entry.evidence ?? []) if (!evidence.includes(ref)) evidence.push(ref);
    const proposal: R = { status: 'proposed', kind: 'public_inventory_composition', actions, steps, facts,
      binding: Object.fromEntries(['observation_ref', 'level_epoch', 'levels_completed', 'frame_hash'].map(k => [k, obs[k]])),
      inventory_plan: { offer: plan, workflow: inventoryReceipt(receipt), drm_hash: digest(this.config) },
      compositions: [{ id: focus, role: meaning.role, observed: false, things: [scene.body_signature], properties: {
        target: meaning.composition, conditional: true, interface_prior: this.config.interface_prior, unknown: meaning.unknown,
        composition_financing: plan.financing, dependency_return: plan.target.dependency_return ?? null,
        method_recall: truth(plan.target.method) ? plan.target.method : plan.target.method_recall ?? null,
        goal_revalidation: plan.target.goal_revalidation ?? null, unmet_access_dependency: plan.target.dependency ?? null,
        conditional_material_transit: material_entries, conditional_endpoint_departure: departure, current_control_revalidation: control_revalidation,
        unresolved_current_control_hypotheses: unresolved_controls, equivalent_contact_descriptions: plan.target.equivalent_descriptions ?? null,
        regional_continuation_equivalence: plan.target.equivalence ?? null, measured_effect_scope: scope,
        unexplained_remote_effects: truth((plan.target.arrival ?? {}).remote_effects) ? plan.target.arrival.remote_effects : (plan.target.method ?? {}).remote_effects ?? null,
        future_service: plan.target.future_consumer ?? null,
        falsifiers: ['different_current_body_or_displacement', 'source_or_display_contradiction', 'unexpected_effect_on_other_compositions', 'scope_changed'],
      }, relations: ['contributes_to:' + this.config.goal], open_question: meaning.question }],
      question: { reason: meaning.question, hypothesis_refs: [meaning.rule_ref] }, route_refs: evidence,
      bundle_template: { operation_key: meaning.operation, composition_ref: focus, objective_ref: this.config.goal, purpose: meaning.question,
        preconditions: facts, evidence, actions, preserve_refs: [], preservation_evidence: {}, outcome_guard: { path: ['value'], contains: focus } },
    };
    decorate_context_question(proposal, obs);
    if (['access_probe_candidate', 'allocation_probe_candidate'].includes(plan.kind) && steps.length === 1 && same(plan.steps.at(-1).to_cell, plan.route.target_cell)) {
      for (const obligation of this.preservation_obligations(obs, rows)) {
        proposal.preservation_changes ??= {};
        proposal.preservation_changes[obligation.id] = { observation_ref: obs.observation_ref, action_ref: actions[0].action_ref, actions,
          why: 'Use the preserved observed signature in the explicitly tested complementary access composition.',
          expected_reestablishment: 'Compare retained signature, local partition and body after this single contact; consumption remains unknown until observed.', revise_condition: true };
      }
    }
    return proposal;
  }
  bind(p: R, _domain?: unknown): void {
    if (!same(p.actions, p.steps.map((s: R) => s.action)) || p.steps.some((s: R) => !Object.hasOwn(s, 'expected_after'))) throw new TypeError('unbound inventory prefix');
  }
  before(p: R, index: number, publicPacket: NativePublicObservation, obs: NativeObservation): NativeBeforeResult {
    const box = locate(publicPacket.frame_rows, p.inventory_plan.offer.core);
    let ok = same(box, p.steps[index].body_before) && publicPacket.level === p.binding.level_epoch && publicPacket.levels_completed === p.binding.levels_completed
      && publicPacket.available_action_refs.includes(p.actions[index].action_ref);
    if (index === 0) ok = ok && publicPacket.frame_hash === p.binding.frame_hash && obs.observation_ref === p.binding.observation_ref && obs.frame_hash === p.binding.frame_hash;
    return { admitted: ok, reason: ok ? 'current_scoped_inventory_composition' : 'current_binding_changed' };
  }
  after(p: R, index: number, before: R, after: R, first: NativeRows, second: NativeRows): NativeAfterResult & R {
    const step = p.steps[index], expected = step.expected_after, box = locate(second, p.inventory_plan.offer.core);
    let matched: boolean | null = expected === null ? null : same(box, expected.body_bbox);
    const body_position_matched = matched;
    const changedOutside = (cells: R[], regions: any[]): boolean => cells.some(cell => {
      const b = cell.bbox;
      for (let y = b.top; y <= b.bottom; y++) for (let x = b.left; x <= b.right; x++) if (first[y]![x] !== second[y]![x]
        && !regions.some(([l, t, r, bb]: number[]) => l! <= x && x <= r! && t! <= y && y <= bb!)) return true;
      return false;
    });
    if (matched) {
      const offer = p.inventory_plan.offer, grid = offer.scene.grids[0], regions = [step.body_before, expected.body_bbox];
      if (step.seal_after) {
        const cell = grid.cells.find((c: R) => same([c.row, c.col], step.to_cell));
        if (!cell) throw new TypeError('Inventory target cell missing');
        regions.push(['left', 'top', 'right', 'bottom'].map(k => cell.bbox[k]));
        if (offer.kind === 'access_probe_candidate' && truth(offer.scene.displayed_candidate)) regions.push(offer.scene.displayed_candidate.display_bbox);
      }
      if (changedOutside(grid.cells, regions)) matched = false;
    }
    let preservation_matched: boolean | null = null;
    if (expected === null && ['method_probe_candidate', 'allocation_probe_candidate'].includes(p.inventory_plan.offer.kind)) {
      const offer = p.inventory_plan.offer, regions = [offer.target.source_bbox, offer.target.method.display_bbox];
      preservation_matched = same(box, step.body_before);
      if (changedOutside(offer.scene.grids[0].cells, regions)) preservation_matched = false;
    }
    if (expected === null && ['local_contact_probe_candidate', 'local_contact_recall_candidate', 'context_reconfiguration_candidate'].includes(p.inventory_plan.offer.kind)) {
      const offer = p.inventory_plan.offer, region = offer.target.source_bbox;
      preservation_matched = same(box, step.body_before);
      if (changedOutside(offer.scene.grids[0].cells, [region])) preservation_matched = false;
    }
    let scoped: R | null = null;
    const offer = p.inventory_plan.offer, kind = offer.kind;
    const arrival = ['endpoint_approach_candidate', 'context_reconfiguration_candidate'].includes(kind) && same(step.to_cell, offer.route.target_cell);
    const operator = ['local_contact_probe_candidate', 'local_contact_recall_candidate'].includes(kind) || kind === 'context_reconfiguration_candidate' && expected === null;
    const control_matched = same(box, truth(expected) ? expected.body_bbox : step.body_before);
    if ((['endpoint_approach_candidate', 'context_reconfiguration_candidate'].includes(kind) || operator) && control_matched) {
      const regions = [arrival || operator ? offer.target.source_bbox : step.body_before, step.body_before, box!];
      const contrasted = contrast_effect_scope(offer.scene.support_effect_scope ?? null, before, after, first, second, regions, box!);
      if (truth(contrasted)) {
        const preservation = checkPreservation(p, second, after.level_epoch, { after: true, observation: after as any });
        const meaning = this.policy.interpret({ current_scope_and_observation: true, bound_endpoint_or_local_operator: true,
          current_control_effect_matched: true, measured_support_domain_revalidated: true, other_domain_compositions_preserved: contrasted!.unauthorized_domain_changes === 0,
          explicit_preservation_satisfied: preservation.admitted, unexplained_remote_effect_observed: true });
        scoped = { ...contrasted, explicit_preservation: preservation, interpretation: meaning };
        const admitted = meaning.status === 'unique' && meaning.conclusions[0].status === 'conditional_local_reconciliation';
        if (expected !== null && ['endpoint_approach_candidate', 'context_reconfiguration_candidate'].includes(kind)) matched = admitted;
        if (operator) preservation_matched = admitted;
      }
    }
    return { matched, body_position_matched, preservation_matched, seal_prefix: truth(step.seal_after) || !matched,
      reason: 'conditional_body_and_other_current_cells_compared', ...(scoped ? { remote_effects: scoped.remote_effects, effect_scope_reconciliation: scoped } : {}) };
  }
  recordSource(before: R, after: R, action: R, first: NativeRows, second: NativeRows, proposal: R | null = null, index = 0): R | null {
    if (before.level_epoch !== after.level_epoch) {
      if (truth(this.retained_effect_scope)) Object.assign(this.retained_effect_scope!, { active: false, refutation: { reason: 'scope_changed', observation_ref: after.observation_ref } });
      this.boundary_memory = capture_boundary(before, after, first, second, this.tracker.displayed, this.access_returns, this.tracker.core); this.pending_access = null;
    }
    const current_recall = revalidate_boundary(this.boundary_memory, before, first, this.tracker.transfer_methods);
    if (!this.seen_pairs.some(pair => pair.level_epoch === before.level_epoch) && !(proposal && truth(proposal.inventory_plan))
      && current_recall.status !== 'revalidated_hypothesis' && !this.access_returns.some(z => z.level_epoch === before.level_epoch && truth(z.active))) {
      if (!Object.hasOwn(this.config.interface_prior.directions, action.action_ref)) return null;
      const motion = moved_core(before, after, 1, 4);
      if (!motion || !((motion.delta[0] === 0) !== (motion.delta[1] === 0))) return null;
      return this.tracker.record(before, after, action, first, second, (measured: R) => this.policy.interpret(measured));
    }
    const measurements = access_measurements(proposal, index, before, after, first, second);
    let returned: R | null = null;
    if (truth(measurements) && this.after(proposal!, index, before, after, first, second).matched) {
      const meaning = this.policy.interpret(measurements!);
      if (meaning.status === 'unique' && meaning.conclusions[0].status === 'local_access_return') {
        returned = { ...measurements, status: 'local_access_return', active: true, evidence: [before.observation_ref, after.observation_ref], rule_ref: meaning.conclusions[0].rule_ref };
        this.access_returns.push(returned); this.access_returns = this.access_returns.slice(-16);
      }
    }
    const method_rejected = Boolean(proposal && ['method_probe_candidate', 'allocation_probe_candidate'].includes(proposal.inventory_plan?.offer?.kind)
      && this.after(proposal, index, before, after, first, second).preservation_matched === false);
    if (method_rejected) {
      this.failed.push(proposal!.inventory_plan.offer.key);
      return { status: 'method_context_rejected', reason: 'other_composition_or_control_changed', evidence: [before.observation_ref, after.observation_ref], method_refuted_globally: false };
    }
    const event = this.tracker.record(before, after, action, first, second, (measured: R) => this.policy.interpret(measured));
    const inventory_outcome = proposal && truth(proposal.inventory_plan) ? this.after(proposal, index, before, after, first, second) : null;
    const contact_event = proposal ? reconcile_local_contact(this.endpoint_memory, this.tracker.transfer_methods, proposal, index, before, after, first, second, inventory_outcome!, this.tracker.underlays) : null;
    const context_event = record_context_intervention(this.tracker.transfer_methods, proposal, index, before, after, first, second, this.config.maximum_context_regions);
    if (truth(inventory_outcome)) {
      const retained = retain_effect_scope(proposal!, index, before, after, second, inventory_outcome!, this.retained_effect_scope);
      if (truth(retained)) this.retained_effect_scope = retained;
    }
    if (proposal && truth(proposal.inventory_plan)) {
      const expected = proposal.steps[index].expected_after, offer = proposal.inventory_plan.offer;
      if (truth(expected) && !same(locate(second, offer.core), expected.body_bbox)) this.failed.push(offer.key);
      if (offer.kind === 'method_probe_candidate' && (!event || event.status !== 'unique_corresponding_transfer')) this.failed.push(offer.key);
      if (offer.kind === 'allocation_probe_candidate' && (!event || event.status !== 'unique_reverse_correspondence')) this.failed.push(offer.key);
    }
    if (event?.status === 'exact_observed_scene_restoration') { this.pending_access = null; for (const receipt of this.access_returns) receipt.active = false; }
    if (returned) {
      if (truth(this.boundary_memory) && this.boundary_memory!.target_epoch === after.level_epoch) {
        this.boundary_memory!.active = false; this.boundary_memory!.ended_by_local_access = after.observation_ref;
      }
      this.tracker.displayed = null; return { measurements: event, dependency_return: returned };
    }
    if (truth(context_event) && truth(contact_event)) return { ...contact_event, context_association: context_event };
    return truth(context_event) ? context_event : truth(contact_event) ? contact_event : event;
  }
  record(before: NativeObservation, after: NativeObservation, command: NativeCommand, first: NativeRows, second: NativeRows,
    proposal: R, index: number, _frames: readonly NativeRows[]): NativeRecordResult {
    return { events: [this.recordSource(before, after, command, first, second, proposal, index)] };
  }
}

// Capture the original projections once. Replaced prototype or instance
// methods are valid source customizations, but cannot certify cache reuse.
const inventoryStateProjection = ObservedInventory.prototype.state;
const inventoryContextProjection = ObservedInventory.prototype.callerContextState;
const inventoryRestoreProjection = ObservedInventory.prototype.restore;
