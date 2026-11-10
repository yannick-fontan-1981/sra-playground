/** Acquisition closure consumed by LinkedPreparation.record in pinned V6.
 * The separate PhaseRelations/PhaseTransfer proposal policies are not activated
 * by the LinkedPreparation source entry and are deliberately not routed here. */
import { LinkedTemporalContact, LINKED_CONTACT_SOURCE_POLICY, type LinkedContactPolicy } from './v6-linked-temporal-contact.ts';
import { temporalBytePatch as bytePatch, temporalClone as clone, temporalCompare as compare,
  temporalCompressed as compressed, temporalContains as contains, temporalDictionary as dictionary,
  temporalDigest as digest, temporalEqual as equal, temporalKey as key, temporalMapState,
  temporalModulo as modulo, temporalOwn as own, temporalOwned as owned, temporalPixel as pixel,
  temporalPoint as point, temporalPointKey as pkey, temporalRectangle as rectangle,
  temporalRestoreMap, temporalRestoreSet, temporalSetState,
  type TemporalPoint as Point, type TemporalRecord as R, type TemporalSize as Size } from './v6-linked-temporal-common.ts';
import type { NativeRows, NativeBeforeResult, NativeAfterResult } from './v6-native-types.ts';

export interface LinkedTemporalSnapshot {
  ref: string; frame: string; poses: R; occurrences: { signature: string; position: Point; geometry: string }[]; rows: NativeRows;
}

export class LinkedTemporalPhaseRelations {
  epoch: number | null = null; states: LinkedTemporalSnapshot[] = []; commands: (string | null)[] = [];
  geometry: R = dictionary(); size: R = dictionary(); masks: R = dictionary(); portable: LinkedTemporalPhaseTransfer | null = null;
  model: R | null = null; trial: R | null = null; supported: R | null = null; remote: R | null = null;
  checked = new Set<string>(); events: R[] = []; attempts = new Map<string, number>(); missed = new Set<string>();
  linked_contact: LinkedTemporalContact;
  readonly policy: LinkedContactPolicy;
  constructor(policy: LinkedContactPolicy = LINKED_CONTACT_SOURCE_POLICY) { this.policy = policy; this.linked_contact = new LinkedTemporalContact(policy); }
  reset(): void {
    const next = new LinkedTemporalPhaseRelations(this.policy);
    for (const name of ['epoch', 'states', 'commands', 'geometry', 'size', 'masks', 'portable', 'model', 'trial', 'supported', 'remote', 'checked', 'events', 'attempts', 'missed', 'linked_contact']) (this as any)[name] = (next as any)[name];
  }
  snapshot(observation: R, rows: NativeRows): LinkedTemporalSnapshot {
    const unique = new Map<string, R>((observation.entities as R[]).filter(e => !e.identity_ambiguous).map(e => [e.signature, e]));
    const localDigests = new Map<object, string>();
    const geometryOf = (mask: any): string => { let value = localDigests.get(mask); if (value === undefined) { value = digest(mask, false); localDigests.set(mask, value); } return value; };
    for (const [signature, entity] of unique) if (!Object.hasOwn(this.geometry, signature)) {
      own(this.geometry, signature, geometryOf(entity.mask)); own(this.masks, signature, owned(entity.mask));
      const [left, top, right, bottom] = entity.bbox as number[]; own(this.size, signature, owned([right! - left! + 1, bottom! - top! + 1]));
    }
    const poses = Object.fromEntries([...unique].map(([signature, entity]) => [signature, entity.position]));
    return owned({ ref: observation.observation_ref, frame: observation.frame_hash, poses,
      occurrences: (observation.entities as R[]).map(e => ({ signature: e.signature, position: e.position, geometry: geometryOf(e.mask) })), rows });
  }
  switches(marker: string): number[] {
    const modes = this.states.map(s => s.poses[marker] ?? null), result: number[] = [];
    for (let i = 1; i < modes.length; i++) if (!equal(modes[i], modes[i - 1])) result.push(i); return result;
  }
  fit(): void {
    if (this.states.length < 6) return;
    const candidates: any[][] = [], first = this.states[0]!.poses;
    for (const marker of Object.keys(first)) {
      const modes = this.states.map(s => s.poses[marker] ?? null);
      if (modes.includes(null) || new Set(modes.map(key)).size < 2) continue;
      const changes = this.switches(marker); if (changes.length < 2) continue;
      const phaseOrder = [modes[0], ...changes.map(i => modes[i])]; if (new Set(phaseOrder.map(key)).size === phaseOrder.length) continue;
      const inputs = new Set<string | null>(changes.map(i => this.commands[i - 1] ?? null)); if (inputs.size !== 1 || inputs.has(null)) continue;
      const b = changes[0]!, c = changes[1]!, segment = this.states.slice(0, b), later = this.states.slice(b, c); if (!segment.length || !later.length) continue;
      for (const primary of Object.keys(first)) {
        const path = compressed(segment.map(s => s.poses[primary])); if (new Set(path.map(pkey)).size < 3) continue;
        const others = new Set(later.flatMap(s => Object.keys(s.poses).filter(sig => sig !== primary && this.geometry[sig] === this.geometry[primary])));
        for (const other of others) {
          const visible = compressed(later.map(s => s.poses[other])); if (new Set(visible.map(pkey)).size < 3 || !equal(visible.at(-1), path.at(-1))) continue;
          if (!later.some(s => s.poses[other] != null && s.poses[primary] != null && !equal(s.poses[other], s.poses[primary]))) continue;
          if (!path.some((_, k) => equal(path.slice(k, k + visible.length), visible))) continue;
          candidates.push([new Set(visible.map(pkey)).size, marker, primary, other, [...inputs][0], b, c, path, visible]);
        }
      }
    }
    if (!candidates.length) return;
    candidates.sort((a, b) => compare([-a[0], a[2], a[3], a[1]], [-b[0], b[2], b[3], b[1]]));
    const [, marker, primary, other, command, b, c, path, visible] = candidates[0]!;
    this.model = owned({ marker, primary, other, switch_input: command, source_mode: this.states[0]!.poses[marker], response_mode: this.states[b]!.poses[marker],
      first_endpoint: path.at(-1), formed_at: this.states.at(-1)!.ref, switch_evidence: [this.states[b]!.ref, this.states[c]!.ref], observed_source_path: path,
      matching_visible_path: visible, other_compatible_bindings: candidates.length - 1, phase_count_is_inductive: true,
      qualification: 'conditional path repetition; autonomous dynamics and phase-specific alternatives remain open' });
    this.remote = owned(this.remoteCandidate(b, c)); this.events.push({ kind: 'path_relation_candidate', model: this.model, remote_candidate: this.remote });
  }
  remoteCandidate(b: number, c: number): R | null {
    const primary: string = this.model!.primary, other: string = this.model!.other, candidates: R[] = [];
    for (let i = b + 1; i < c; i++) {
      const pos = this.states[i]!.poses[primary] as Point | undefined, previous = this.states[i - 1]!.poses[primary];
      if (!pos || previous == null || equal(previous, pos)) continue;
      let j = i + 1; while (j < c && equal(this.states[j]!.poses[primary], pos)) j++;
      if (j >= c || j === i + 1 || this.states[j]!.poses[primary] == null) continue;
      const held = this.states[j - 1]!.poses[other]; if (held == null || !equal(this.states[j]!.poses[other], held)) continue;
      const start = this.states[i - 1]!.rows, entered = this.states[i]!.rows, heldScene = this.states[j - 1]!.rows, left = this.states[j]!.rows, excluded = new Set<string>();
      for (const k of [i - 1, i, j - 1, j]) for (const sig of [primary, other]) {
        const xy = this.states[k]!.poses[sig] as Point | undefined; if (!xy) continue;
        // NumPy writes only the intersecting positive-index body rectangle.
        for (const p of rectangle(xy, this.size[sig])) excluded.add(p);
      }
      const pixels: number[][] = [];
      for (let y = 0; y < start.length; y++) for (let x = 0; x < start[y]!.length; x++) {
        const a = pixel(start, x, y), e = pixel(entered, x, y);
        if (excluded.has(pkey([x, y])) || a === e || e !== pixel(heldScene, x, y) || a !== pixel(left, x, y)) continue;
        let stayed = true; for (let k = i; k < j; k++) if (pixel(this.states[k]!.rows, x, y) !== e) { stayed = false; break; }
        if (stayed) pixels.push([x, y, a, e]);
      }
      pixels.sort(compare);
      if (pixels.length >= 2) candidates.push({ site: pos, pixels, entry_ref: this.states[i]!.ref, leaving_ref: this.states[j]!.ref,
        other_stayed_at_exit: held, persistence_steps: j - i, exclusive_cause_established: false });
    }
    if (!candidates.length) return null;
    candidates.sort((a, b) => compare([-a.pixels.length, -a.persistence_steps, a.site], [-b.pixels.length, -b.persistence_steps, b.site]));
    const best = candidates[0]!; return candidates.slice(1).some(x => x.pixels.length === best.pixels.length && !equal(x.site, best.site)) ? null : best;
  }
  record(before: R, after: R, command: R, first: NativeRows, second: NativeRows): R[] {
    if (this.epoch !== before.level_epoch) { this.reset(); this.epoch = before.level_epoch; }
    if (before.level_epoch !== after.level_epoch || before.state !== after.state) {
      const former = this.portable;
      const carry = after.levels_completed > before.levels_completed
        ? this.model && this.supported && this.remote ? LinkedTemporalPhaseTransfer.fromBoundary(this, before, command, first, after) : former : null;
      this.reset(); this.epoch = after.level_epoch; this.portable = carry; this.states = [this.snapshot(after, second)];
      if (carry) carry.resetEpoch(after.observation_ref);
      return carry ? [{ kind: 'recall_as_hypothesis', prior_scoring_boundary: carry.prior.boundary, new_epoch: this.epoch }] : [];
    }
    if (!this.states.length) this.states.push(this.snapshot(before, first));
    if (this.states.at(-1)!.ref !== before.observation_ref) throw new Error('Phase records must follow actual observations');
    this.commands.push(command.data && Object.keys(command.data).length ? null : command.action_ref); this.states.push(this.snapshot(after, second));
    this.events = []; this.linked_contact.observe(this, after); this.events.push(...this.linked_contact.events); this.linked_contact.events = [];
    if (!this.model) this.fit();
    if (this.portable) this.events.push(...this.portable.observe(this, before, after, command));
    if (!this.model) return this.events;
    const m = this.model, s = this.states.at(-1)!, prior = this.states.at(-2)!, mode = s.poses[m.marker];
    if (equal(mode, m.response_mode) && equal(prior.poses[m.marker], m.source_mode) && s.ref !== m.switch_evidence[0]) {
      const switches = this.switches(m.marker), srcStart = switches.length > 1 ? switches.at(-2)! : 0;
      const path = compressed(this.states.slice(srcStart, -1).map(st => st.poses[m.primary]));
      this.trial = { start: s.ref, source_path: path, endpoint: path.length ? path.at(-1) : null, visible: [], primary_at_endpoint: [], refuted: false };
      this.events.push({ kind: 'freeze_future_path_prediction', source: s.ref, path, model_source: m.formed_at });
    }
    const trial = this.trial;
    if (trial && equal(mode, m.response_mode) && trial.source_path.length && !trial.refuted) {
      const other = s.poses[m.other], primary = s.poses[m.primary];
      if (other != null) {
        if (!trial.visible.length || !equal(trial.visible.at(-1), other)) trial.visible.push(other);
        if (!(trial.source_path as Point[]).some((_, k) => equal(trial.source_path.slice(k, k + trial.visible.length), trial.visible))) {
          trial.refuted = true; this.events.push({ kind: 'counterexample', source: trial.start, actual: s.ref, visible: [...trial.visible] });
        } else if (equal(other, trial.endpoint) && primary != null && !equal(primary, other)) {
          if (!contains(trial.primary_at_endpoint, primary)) trial.primary_at_endpoint.push(primary);
          if (!this.supported && !equal(trial.endpoint, m.first_endpoint) && trial.primary_at_endpoint.length >= 2) {
            this.supported = owned({ freeze: trial.start, validation: s.ref, new_endpoint: trial.endpoint, source_endpoint: m.first_endpoint,
              independent_primary_positions: [...trial.primary_at_endpoint].sort(compare), qualification: 'local correlation; overlap can make an identity unobservable' });
            this.events.push({ kind: 'changed_endpoint_locally_supported', ...this.supported });
          }
        }
      }
    }
    return this.events;
  }
  conditionMeasure(state: LinkedTemporalSnapshot): R {
    if (!this.remote) return { status: 'unknown', visible: 0, occluded: 0 };
    const covered = new Set<string>();
    for (const name of ['primary', 'other']) { const sig = this.model![name], pose = state.poses[sig] as Point | undefined;
      if (pose) for (const [dx, dy] of this.masks[sig] as Point[]) covered.add(pkey([pose[0] + dx, pose[1] + dy])); }
    const visible = (this.remote.pixels as number[][]).filter(([x, y]) => !covered.has(pkey([x!, y!]))), matched = visible.filter(([x, y, , next]) => pixel(state.rows, x!, y!) === next).length;
    return { status: !visible.length ? 'unknown' : matched === visible.length ? 'visible_match' : 'visible_difference', visible: visible.length, matched, occluded: this.remote.pixels.length - visible.length };
  }
  condition(state: LinkedTemporalSnapshot): boolean { return this.conditionMeasure(state).status === 'visible_match'; }
  before(proposal: R, index: number, publicPacket: R, observation: R): NativeBeforeResult {
    if (proposal.phase_plan.bootstrap) return this.linked_contact.before(proposal, index, publicPacket, observation);
    if (proposal.phase_plan.portable) { if (!this.portable) throw new TypeError('Missing conditional phase transfer'); return this.portable.before(proposal, index, publicPacket, observation); }
    const plan = proposal.phase_plan, step = plan.steps[index], bound = proposal.binding;
    const poses = Object.fromEntries((observation.entities as R[]).filter(e => !e.identity_ambiguous).map(e => [e.signature, e.position]));
    let ok = publicPacket.level === bound.level_epoch && publicPacket.levels_completed === bound.levels_completed && publicPacket.available_action_refs.includes(step.action.action_ref)
      && equal(poses[plan.marker], plan.mode) && equal(poses[plan.primary], step.from) && (index > 0 || observation.observation_ref === bound.observation_ref);
    if (plan.details.held_remote_effect) ok = ok && equal(poses[plan.secondary], plan.goal_site) && this.condition({ rows: publicPacket.frame_rows, poses } as LinkedTemporalSnapshot);
    return { admitted: Boolean(ok), reason: ok ? 'phase_and_receiver_bound' : 'phase_receiver_or_held_effect_changed' };
  }
  after(proposal: R, index: number, before: R, after: R, first: NativeRows, second: NativeRows): NativeAfterResult {
    if (proposal.phase_plan.bootstrap) return this.linked_contact.after(proposal, index, before, after);
    if (proposal.phase_plan.portable) { if (!this.portable) throw new TypeError('Missing conditional phase transfer'); return this.portable.after(proposal, index, before, after); }
    const plan = proposal.phase_plan, step = plan.steps[index];
    if (before.level_epoch !== after.level_epoch || before.state !== after.state || before.levels_completed !== after.levels_completed) return { matched: null, seal_prefix: true, reason: 'official_boundary' };
    const poses = Object.fromEntries((after.entities as R[]).filter(e => !e.identity_ambiguous).map(e => [e.signature, e.position]));
    let ok = equal(poses[plan.marker], step.expected_mode); if (step.to !== null) ok = ok && equal(poses[plan.primary], step.to);
    if (plan.details.held_remote_effect) ok = ok && equal(poses[plan.secondary], plan.goal_site) && this.condition({ rows: second, poses } as LinkedTemporalSnapshot);
    if (index === 0) {
      const oldPoses = Object.fromEntries((before.entities as R[]).filter(e => !e.identity_ambiguous).map(e => [e.signature, e.position]));
      const k = key([plan.why, [plan.mode, step.from, plan.details.secondary, this.condition({ rows: first, poses: oldPoses } as LinkedTemporalSnapshot)], step.action.action_ref]);
      this.attempts.set(k, (this.attempts.get(k) ?? 0) + 1);
    }
    return { matched: Boolean(ok), seal_prefix: !ok || index + 1 === plan.steps.length || !step.same_mode, reason: ok ? 'projected_phase_response' : 'phase_prediction_diverged' };
  }
  sourceState(): R {
    return { epoch: this.epoch, states: this.states, commands: this.commands, geometry: this.geometry, size: this.size, masks: this.masks,
      portable: this.portable?.sourceState() ?? null, model: this.model, trial: this.trial ? { ...this.trial, primary_at_endpoint: [...this.trial.primary_at_endpoint].sort(compare) } : null,
      supported: this.supported, remote: this.remote, checked: temporalSetState(this.checked), events: this.events, attempts: temporalMapState(this.attempts),
      missed: temporalSetState(this.missed), linked_contact: this.linked_contact.sourceState() };
  }
  /** Adapter calls this only after validating the entire checkpoint. Immutable
   * historical snapshots are retained; their pixel arrays are never recopied. */
  restoreSource(value: R): void {
    this.epoch = value.epoch; this.states = value.states.map((s: LinkedTemporalSnapshot) => owned(s)); this.commands = [...value.commands];
    this.geometry = clone(value.geometry); this.size = Object.fromEntries(Object.entries(value.size).map(([k, v]) => [k, owned(v)]));
    this.masks = Object.fromEntries(Object.entries(value.masks).map(([k, v]) => [k, owned(v)]));
    this.model = owned(value.model); this.trial = clone(value.trial); this.supported = owned(value.supported); this.remote = owned(value.remote); this.events = clone(value.events);
    this.checked = temporalRestoreSet(value.checked); this.attempts = temporalRestoreMap(value.attempts); this.missed = temporalRestoreSet(value.missed);
    this.linked_contact = new LinkedTemporalContact(this.policy); this.linked_contact.restoreSource(value.linked_contact);
    this.portable = value.portable ? LinkedTemporalPhaseTransfer.restoreSource(value.portable) : null;
  }
}

/** Complete PhaseTransfer acquisition/state closure. The dormant proposal
 * alternative remains outside linked_temporal_preparation's source alias. */
export class LinkedTemporalPhaseTransfer {
  start: string | null = null; sites = new Set<string>(); exits = new Set<string>(); samples = new Map<string, R>(); pending = new Map<string, R>();
  prepared: R[] = []; mode_edges = new Map<string, Point>(); failures = new Map<string, number>(); attempted = new Map<string, number>();
  hold_observed = new Set<string>(); visited = new Map<string, Set<string>>(); cache: any = null; cycles: any[] = [];
  site_trials = new Map<string, number>(); local_vectors = new Map<string, Set<string>>(); portable_misses = new Set<string>();
  readonly prior: R;
  constructor(prior: R) { this.prior = prior; }
  static fromBoundary(memory: LinkedTemporalPhaseRelations, _before: R, command: R, rows: NativeRows, after: R): LinkedTemporalPhaseTransfer | null {
    const model = memory.model!, source = model.primary as string, size = memory.size[source] as Size, site = memory.remote!.site as Point;
    const entry = memory.states.findIndex(s => s.ref === memory.remote!.entry_ref); if (entry <= 0) return null;
    const walkable = new Set<string>(), byAction = new Map<string, Map<string, number>>();
    for (let i = 0; i < memory.commands.length; i++) {
      const cmd = memory.commands[i]!, a = memory.states[i]!, b = memory.states[i + 1]!, u = a.poses[source] as Point | undefined, v = b.poses[source] as Point | undefined;
      if (cmd === null || cmd === model.switch_input || !u || !v || equal(u, v) || !equal(a.poses[model.marker], b.poses[model.marker])) continue;
      const delta: Point = [v[0] - u[0], v[1] - u[1]]; if (delta[0] && delta[1]) continue;
      if (!byAction.has(cmd)) byAction.set(cmd, new Map()); const counts = byAction.get(cmd)!; counts.set(pkey(delta), (counts.get(pkey(delta)) ?? 0) + 1);
      const observed = bytePatch(a.rows, v, size); if (observed !== null) walkable.add(key(observed));
    }
    const vectors = dictionary(); for (const [cmd, values] of byAction) if (values.size === 1) own(vectors, cmd, point([...values.keys()][0]!));
    const p = memory.states.at(-1)!.poses[source] as Point | undefined, v = vectors[command.action_ref] as Point | undefined;
    const terminal = p && v ? bytePatch(rows, [p[0] + v[0], p[1] + v[1]], size) : null, template = bytePatch(memory.states[entry - 1]!.rows, site, size);
    return new LinkedTemporalPhaseTransfer({ marker: model.marker, primary: source, secondary: model.other, shape: memory.geometry[source], mask: memory.masks[source], size,
      switch: model.switch_input, vectors, locus_template: template, terminal_template: terminal, walkable: [...walkable].map(k => JSON.parse(k)).sort(compare),
      boundary: after.observation_ref, entry: memory.remote!.entry_ref, leave: memory.remote!.leaving_ref, source_validation: memory.supported!.validation });
  }
  resetEpoch(ref: string): void {
    this.start = ref; this.sites = new Set(); this.exits = new Set(); this.samples = new Map(); this.pending = new Map(); this.prepared = []; this.mode_edges = new Map();
    this.failures = new Map(); this.attempted = new Map(); this.hold_observed = new Set(); this.visited = new Map(); this.cache = null; this.cycles = [];
    this.site_trials = new Map(); this.local_vectors = new Map(); this.portable_misses = new Set();
  }
  roles(snapshot: LinkedTemporalSnapshot): [Point | null, Point | null] { return [snapshot.poses[this.prior.marker] ?? null, snapshot.poses[this.prior.primary] ?? null]; }
  measureSites(rows: NativeRows, position: Point): void {
    const p = this.prior, [w, h] = p.size as Size; if (rows.length < h || rows[0]!.length < w) return;
    const vectors = Object.values(p.vectors) as Point[], xs = vectors.map(v => Math.abs(v[0])).filter(Boolean), ys = vectors.map(v => Math.abs(v[1])).filter(Boolean);
    const dx = xs.length ? Math.min(...xs) : 1, dy = ys.length ? Math.min(...ys) : 1, found: Point[] = [], ends: Point[] = [];
    for (let y = modulo(position[1], dy); y <= rows.length - h; y += dy) for (let x = modulo(position[0], dx); x <= rows[0]!.length - w; x += dx) {
      const b = bytePatch(rows, [x, y], p.size); if (equal(b, p.locus_template)) found.push([x, y]); if (equal(b, p.terminal_template)) ends.push([x, y]);
    }
    if (found.length > 0 && found.length <= 8) for (const p of found) this.sites.add(pkey(p));
    if (ends.length > 0 && ends.length <= 8) for (const p of ends) this.exits.add(pkey(p));
  }
  changed(a: LinkedTemporalSnapshot, b: LinkedTemporalSnapshot, model: R, owner: LinkedTemporalPhaseRelations): number[][] {
    const covered = new Set<string>();
    for (const s of [a, b]) for (const [signature, pose] of Object.entries(s.poses) as [string, Point][]) {
      if (owner.geometry[signature] !== model.shape && signature !== model.marker) continue;
      for (const p of rectangle(pose, owner.size[signature])) covered.add(p);
    }
    const result: number[][] = [];
    for (let y = 0; y < a.rows.length; y++) for (let x = 0; x < a.rows[y]!.length; x++) {
      const old = pixel(a.rows, x, y), next = pixel(b.rows, x, y); if (old !== next && !covered.has(pkey([x, y]))) result.push([x, y, old, next]);
    }
    return result;
  }
  effect(snapshot: LinkedTemporalSnapshot, site: Point, owner: LinkedTemporalPhaseRelations): string {
    const relation = this.samples.get(pkey(site)); if (!relation) return 'unknown';
    const covered = new Set<string>();
    for (const [signature, pose] of Object.entries(snapshot.poses) as [string, Point][]) if (owner.geometry[signature] === this.prior.shape)
      for (const [x, y] of owner.masks[signature] as Point[]) covered.add(pkey([pose[0] + x, pose[1] + y]));
    const visible = (relation.pixels as number[][]).filter(([x, y]) => !covered.has(pkey([x!, y!]))); if (!visible.length) return 'unknown';
    if (visible.every(([x, y, , next]) => pixel(snapshot.rows, x!, y!) === next)) return 'present';
    if (visible.every(([x, y, old]) => pixel(snapshot.rows, x!, y!) === old)) return 'absent'; return 'partial';
  }
  observe(owner: LinkedTemporalPhaseRelations, _before: R, after: R, command: R): R[] {
    const a = owner.states.at(-2)!, b = owner.states.at(-1)!, [mode, p] = this.roles(a), [nextMode, q] = this.roles(b), events: R[] = [];
    if (!mode || !nextMode || !p || !q) return events;
    this.measureSites(a.rows, p); this.measureSites(b.rows, q); const ref = command.action_ref as string;
    if (!equal(mode, nextMode)) {
      if (ref !== this.prior.switch) { this.portable_misses.add(key('unexpected_marker_transition')); return events; }
      this.mode_edges.set(pkey(mode), nextMode); this.prepared.push({ mode, site: this.samples.has(pkey(p)) ? p : null, evidence: after.observation_ref });
      if (equal(nextMode, this.roles(owner.states[0]!)[0])) { this.cycles.push(this.prepared.map(item => item.mode)); this.prepared = []; }
      events.push({ kind: 'measured_new_epoch_phase_edge', from: mode, to: nextMode, site_before: p,
        actual_distinct_modes: new Set([...this.mode_edges.keys(), ...[...this.mode_edges.values()].map(pkey)]).size, source: after.observation_ref }); this.pending = new Map(); return events;
    }
    const vec = this.prior.vectors[ref] as Point | undefined;
    if (vec && equal(p, q)) { const k = key([mode, p, ref, bytePatch(a.rows, [p[0] + vec[0], p[1] + vec[1]], this.prior.size)]); this.failures.set(k, (this.failures.get(k) ?? 0) + 1); }
    if (vec && equal([q[0] - p[0], q[1] - p[1]], vec)) { const k = key([mode, ref]); if (!this.local_vectors.has(k)) this.local_vectors.set(k, new Set()); this.local_vectors.get(k)!.add(pkey(p)); }
    if (!equal(q, p) && this.sites.has(pkey(q))) {
      const pixels = this.changed(a, b, this.prior, owner);
      if (pixels.length >= 2) { this.pending.set(pkey(q), { pixels, entry: after.observation_ref, from: p }); const k = key([mode, q]); this.site_trials.set(k, (this.site_trials.get(k) ?? 0) + 1);
        events.push({ kind: 'portable_locus_remote_entry_candidate', locus: q, remaining_changed_pixels: pixels.length, source: after.observation_ref }); }
    }
    if (!equal(p, q) && this.pending.has(pkey(p))) {
      const x = this.pending.get(pkey(p))!; this.pending.delete(pkey(p));
      const reversed = (x.pixels as number[][]).filter(z => pixel(a.rows, z[0]!, z[1]!) === z[3] && pixel(b.rows, z[0]!, z[1]!) === z[2]);
      if (reversed.length >= 2) { this.samples.set(pkey(p), { pixels: reversed, entry: x.entry, departure: after.observation_ref });
        events.push({ kind: 'new_locus_reversal_observed', locus: p, pixels: reversed.length, source: after.observation_ref }); }
    }
    if (!this.visited.has(pkey(mode))) this.visited.set(pkey(mode), new Set()); this.visited.get(pkey(mode))!.add(pkey(p)); this.visited.get(pkey(mode))!.add(pkey(q));
    for (const item of this.prepared) if (item.site && !equal(item.site, q) && this.effect(b, item.site, owner) === 'present') this.hold_observed.add(key([mode, item.site]));
    return events;
  }
  before(proposal: R, i: number, publicPacket: R, observation: R): NativeBeforeResult {
    const plan = proposal.phase_plan, step = plan.steps[i], poses = Object.fromEntries((observation.entities as R[]).filter(e => !e.identity_ambiguous).map(e => [e.signature, e.position]));
    const ok = publicPacket.level === proposal.binding.level_epoch && publicPacket.levels_completed === proposal.binding.levels_completed && publicPacket.available_action_refs.includes(step.action_ref)
      && equal(poses[plan.marker], plan.mode) && equal(poses[plan.primary], step.from) && (i > 0 || observation.observation_ref === proposal.binding.observation_ref);
    return { admitted: Boolean(ok), reason: ok ? 'rebound_phase_and_pose' : 'rebound_witness_changed' };
  }
  after(proposal: R, i: number, before: R, after: R): NativeAfterResult {
    const plan = proposal.phase_plan, step = plan.steps[i];
    if (before.level_epoch !== after.level_epoch || before.state !== after.state || before.levels_completed !== after.levels_completed) return { matched: null, seal_prefix: true, reason: 'official_boundary' };
    const poses = Object.fromEntries((after.entities as R[]).filter(e => !e.identity_ambiguous).map(e => [e.signature, e.position])), actual = poses[plan.marker];
    const ok = step.switch ? actual != null && !equal(actual, plan.mode) && (step.expected_mode == null || equal(step.expected_mode, actual)) : equal(actual, plan.mode) && equal(poses[plan.primary], step.to);
    if (i === 0) { const k = key([plan.mode, step.from, plan.why, step.action_ref, this.prepared.map(x => x.site)]); this.attempted.set(k, (this.attempted.get(k) ?? 0) + 1); }
    return { matched: Boolean(ok), seal_prefix: !ok || i + 1 === plan.steps.length || !step.same_mode, reason: ok ? 'new_epoch_response_measured' : 'portable_hypothesis_diverged' };
  }
  sourceState(): R {
    const nested = (map: Map<string, Set<string>>) => [...map].map(([k, set]) => [JSON.parse(k), temporalSetState(set)]);
    return { prior: this.prior, start: this.start, sites: temporalSetState(this.sites), exits: temporalSetState(this.exits), samples: temporalMapState(this.samples),
      pending: temporalMapState(this.pending), prepared: this.prepared, mode_edges: temporalMapState(this.mode_edges), failures: temporalMapState(this.failures), attempted: temporalMapState(this.attempted),
      hold_observed: temporalSetState(this.hold_observed), visited: nested(this.visited), cache: this.cache, cycles: this.cycles, site_trials: temporalMapState(this.site_trials),
      local_vectors: nested(this.local_vectors), portable_misses: temporalSetState(this.portable_misses) };
  }
  static restoreSource(value: R): LinkedTemporalPhaseTransfer {
    const result = new LinkedTemporalPhaseTransfer(clone(value.prior)); result.start = value.start; result.prepared = clone(value.prepared); result.cache = clone(value.cache); result.cycles = clone(value.cycles);
    for (const field of ['sites', 'exits', 'hold_observed', 'portable_misses'] as const) result[field] = temporalRestoreSet(value[field]);
    for (const field of ['samples', 'pending', 'mode_edges', 'failures', 'attempted', 'site_trials'] as const) (result as any)[field] = temporalRestoreMap(value[field]);
    for (const field of ['visited', 'local_vectors'] as const) result[field] = new Map(value[field].map(([k, set]: [any, any[]]) => [key(k), temporalRestoreSet(set)]));
    return result;
  }
}
