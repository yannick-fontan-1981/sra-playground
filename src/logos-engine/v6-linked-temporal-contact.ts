/** Consumed common_linked_contact.py from immutable V6 786dcf51.
 * Prepared effects and replay remain public, conditional hypotheses. */
import { temporalAdd as add, temporalClone as clone, temporalCompare as compare, temporalContains as contains,
  temporalDigest as digest, temporalEqual as equal, temporalKey as key, temporalModulo as modulo,
  temporalPatch as patch, temporalPixel as pixel, temporalPoint as point, temporalPointKey as pkey,
  temporalRectangle as rectangle, temporalRestoreSet, temporalSetState,
  type TemporalPoint as Point, type TemporalRecord as R, type TemporalRouteStep as RouteStep,
  type TemporalSize as Size, type LinkedTemporalWork } from './v6-linked-temporal-common.ts';
import type { LinkedTemporalPhaseRelations } from './v6-linked-temporal-phase.ts';
import type { NativeRows, NativeBeforeResult, NativeAfterResult } from './v6-native-types.ts';
import { bindMissingControlTrial, unmeasuredControls } from '../sic/missing-control-strategy.ts';

export interface LinkedContactPolicy extends R { enabled: boolean }
export const LINKED_CONTACT_SOURCE_POLICY: Readonly<LinkedContactPolicy> = Object.freeze({
  enabled: true,
  applicability: 'A measured translated receiver, an aligned same-material open enclosure and two dense occurrences connected by a thin extended component.',
  contact_hypothesis: 'The smaller linked occurrence may change the larger distant support. Seek a measured floor route and compare frozen peer pixels on entry, departure and reentry.',
  alternatives: Object.freeze(['decoration', 'persistent activation', 'reversible occupancy', 'autonomous change']),
  phase_question: 'After reversible occupancy is locally supported, test a single remaining unbound input at that site. A return to the initial pose supplies a replay question, without proving autonomous replay or its duration.',
  goal_hypothesis: 'Test containment in the observed open enclosure; only official completion confirms progress.',
  release: 'Bind observed input vectors and receiver poses, cap a conditional visible-access prefix at16, stop at the first uncharacterized contact or any divergent response. A bounded wait at the previously changed region may test delayed accessibility.',
  transfer: 'Reacquire local applicability and effects in each epoch. No terminal equivalence or universal mechanism is asserted.',
});
const allFloor = (rows: NativeRows, floor: number): boolean => rows.every(row => row.every(value => value === floor));
const subset = (a: ReadonlySet<string>, b: ReadonlySet<string>): boolean => [...a].every(p => b.has(p));
const intersects = (a: ReadonlySet<string>, b: ReadonlySet<string>): boolean => [...a].some(p => b.has(p));

export function linkedOpenEnclosures(observation: R, body: R, quantum: number, work?: LinkedTemporalWork): Point[] {
  const [w, h] = body.size as Size, [sx, sy] = body.start as Point, result: Point[] = [];
  for (const entity of observation.entities as R[]) {
    work?.tick(); if (entity.palette_value !== body.palette) continue;
    const [left, top, right, bottom] = entity.bbox as number[];
    if (right! - left! + 1 !== w + 2 || bottom! - top! + 1 !== h + 2) continue;
    const support = new Set<string>((entity.mask as Point[]).map(pkey));
    const sides: Point[][] = [Array.from({ length: w + 2 }, (_, x) => [x, 0]), Array.from({ length: w + 2 }, (_, x) => [x, h + 1]),
      Array.from({ length: h + 2 }, (_, y) => [0, y]), Array.from({ length: h + 2 }, (_, y) => [w + 1, y])];
    if (sides.filter(side => side.every(p => support.has(pkey(p)))).length !== 3) continue;
    const cavity: Point = [left! + 1, top! + 1];
    if (modulo(cavity[0] - sx, quantum) || modulo(cavity[1] - sy, quantum)) continue;
    let filled = false;
    for (let y = 1; y < h + 1; y++) for (let x = 1; x < w + 1; x++) { work?.tick(); if (support.has(pkey([x, y]))) filled = true; }
    if (!filled) result.push(cavity);
  }
  return result;
}

export function linkedNodes(observation: R, body: R, quantum: number, work?: LinkedTemporalWork): R[] {
  const [w, h] = body.size as Size, [sx, sy] = body.start as Point, result: R[] = [];
  for (const entity of observation.entities as R[]) {
    work?.tick(); const [left, top, right, bottom] = entity.bbox as number[];
    if (entity.palette_value === body.palette || entity.palette_value === body.floor) continue;
    if (right! - left! <= 2 * w && bottom! - top! <= 2 * h) continue;
    const support = new Set<string>((entity.mask as Point[]).map(([x, y]) => pkey([left! + x, top! + y]))), nodes: R[] = [];
    for (let y = modulo(sy, quantum); y <= bottom!; y += quantum) for (let x = modulo(sx, quantum); x <= right!; x += quantum) {
      work?.tick(); const inside = new Set([...rectangle([x, y], body.size)].filter(p => support.has(p)));
      if (![...inside].some(p => { const [a, b] = point(p); return inside.has(pkey([a + 1, b])) && inside.has(pkey([a, b + 1])) && inside.has(pkey([a + 1, b + 1])); })) continue;
      nodes.push({ position: [x, y], pixels: inside.size, support: [...inside].map(point).sort(compare) });
    }
    if (nodes.length < 2) continue;
    const covered = new Set<string>(nodes.flatMap(node => (node.support as Point[]).map(pkey))), wire = new Set([...support].filter(p => !covered.has(p)));
    if (!wire.size || [...wire].some(p => { const [a, b] = point(p); return wire.has(pkey([a + 1, b])) && wire.has(pkey([a, b + 1])) && wire.has(pkey([a + 1, b + 1])); })) continue;
    const largest = Math.max(...nodes.map(node => node.pixels as number));
    for (const node of nodes) {
      if (node.pixels >= largest) continue;
      const own = new Set<string>((node.support as Point[]).map(pkey));
      result.push({ ...node, component: entity.signature, palette: entity.palette_value,
        peer_support: [...covered].filter(p => !own.has(p)).map(point).sort(compare), wire_pixels: wire.size, larger_peer_pixels: largest });
    }
  }
  return result;
}

export function linkedPhaseSlots(observation: R, body: R, details = false): number | number[][] | null {
  const groups = new Map<string, R[]>();
  for (const entity of observation.entities as R[]) {
    const [left, top, right, bottom] = entity.bbox as number[], width = right! - left! + 1, height = bottom! - top! + 1;
    if (width !== height || !(1 < width && width < Math.min(...body.size))) continue;
    if (entity.area < width * height - 1) continue;
    const k = key([top, width]); if (!groups.has(k)) groups.set(k, []); groups.get(k)!.push(entity);
  }
  const candidates: number[][][] = [];
  for (const [group, entries] of groups) {
    const [, width] = JSON.parse(group) as [number, number]; entries.sort((a, b) => a.position[0] - b.position[0]);
    const pitches = new Set(entries.slice(1).map((e, i) => e.position[0] - entries[i]!.position[0]));
    const active = entries.filter(e => e.palette_value === body.palette && e.area === width * width - 1);
    if (entries.length >= 2 && pitches.size === 1 && [...pitches][0]! > width && active.length === 1) candidates.push(entries.map(e => e.bbox));
  }
  return candidates.length === 1 ? details ? candidates[0]! : candidates[0]!.length : null;
}

export class LinkedTemporalContact {
  body: R | null = null; nodes: R[] = []; goal: Point | null = null;
  vectors = new Map<string, Point>(); tested = new Set<string>(); selected: R | null = null;
  contact: R | null = null; departure: R | null = null; reversal: R | null = null; phase_trial: R | null = null;
  phase_changed = false; replay_cursor = 0; secondary: any = null; replay_refuted = false;
  replay_motion_support: string[] = []; replay_blocked_support: string[] = []; slot_count: number | null = null;
  slot_boxes: number[][] = []; phase_context: R | null = null; phase_start = 0; history_paths: Point[][] = [];
  prepared: Point[] = []; persistent_sites = new Set<string>(); prepared_effects: R[] = [];
  phase_action: string | null = null; recording_next = false; replay_ticks = 0; waited = 0; seen = 0; events: R[] = [];
  readonly policy: LinkedContactPolicy;
  constructor(policy: LinkedContactPolicy = LINKED_CONTACT_SOURCE_POLICY) {
    if (typeof policy.enabled !== 'boolean') throw new TypeError('Linked contact policy requires enabled'); this.policy = clone(policy);
  }

  fit(phase: LinkedTemporalPhaseRelations, observation: R, work?: LinkedTemporalWork): void {
    if (!this.policy.enabled || this.body || phase.states.length < 2) return;
    const initial = phase.states[0]!, entities = new Map<string, R>((observation.entities as R[]).map(e => [e.signature, e])), options: [R, Point, R[]][] = [];
    for (const [signature, position] of Object.entries(initial.poses) as [string, Point][]) {
      work?.tick(); const current = phase.states.at(-1)!.poses[signature] as Point | undefined;
      if (!current || equal(current, position) || !entities.has(signature)) continue;
      const size = phase.size[signature] as Size, dx = current[0] - position[0], dy = current[1] - position[1];
      if (Math.min(...size) < 2 || Boolean(dx) === Boolean(dy)) continue;
      const quantum = Math.abs(dx || dy); if (quantum <= Math.max(...size)) continue;
      const uncovered = patch(phase.states.at(-1)!.rows, position, size), values = new Set(uncovered.flat()); if (values.size !== 1) continue;
      const body = { signature, size, start: position, palette: entities.get(signature)!.palette_value, floor: [...values][0], quantum, mask: entities.get(signature)!.mask };
      const goals = linkedOpenEnclosures(observation, body, quantum, work), nodes = linkedNodes(observation, body, quantum, work);
      if (goals.length === 1 && nodes.length) options.push([body, goals[0]!, nodes]);
    }
    if (options.length === 1) {
      [this.body, this.goal, this.nodes] = options[0]!;
      this.slot_count = linkedPhaseSlots(observation, this.body) as number | null;
      this.slot_boxes = linkedPhaseSlots(observation, this.body, true) as number[][] | null ?? [];
      this.events.push({ kind: 'linked_occurrence_contact_question', observation: observation.observation_ref,
        body: this.body, goal_candidate: this.goal, nodes: this.nodes, marker_slots: this.slot_count,
        qualification: 'Visual linkage and open-rim containment are hypotheses; official relevance is unknown.' });
    }
  }

  observe(phase: LinkedTemporalPhaseRelations, observation: R, work?: LinkedTemporalWork): void {
    this.fit(phase, observation, work); if (!this.body) return;
    const signature: string = this.body.signature;
    while (this.seen < phase.commands.length) {
      work?.tick(); const i = this.seen++, first = phase.states[i]!, second = phase.states[i + 1]!, action = phase.commands[i]!;
      const start = first.poses[signature] as Point | undefined, end = second.poses[signature] as Point | undefined;
      if (action === null || !start || !end) continue;
      this.tested.add(key([start, action])); const vector: Point = [end[0] - start[0], end[1] - start[1]];
      if (equal(vector.map(Math.abs).sort((a, b) => a - b), [0, this.body.quantum])) {
        const former = this.vectors.get(action); if (former === undefined || equal(former, vector)) this.vectors.set(action, vector);
      }
      if (this.phase_trial && first.ref === this.phase_trial.before_ref) {
        this.phase_changed = action === this.phase_trial.action && equal(end, this.body.start) && !equal(end, start);
        this.phase_start = i + 1; this.replay_ticks = 0; this.replay_cursor = 0;
        this.phase_context = { ref: second.ref, pixels: this.slot_boxes.flatMap(([left, top, right, bottom]) => {
          const pixels: number[][] = []; for (let y = top!; y <= bottom!; y++) for (let x = left!; x <= right!; x++) pixels.push([x, y, pixel(second.rows, x, y)]); return pixels;
        }) };
        this.events.push({ kind: 'linked_contact_phase_response', before: first.ref, after: second.ref,
          returned_to_start: this.phase_changed, replay_causality: 'unknown' }); continue;
      }
      if (this.phase_changed) {
        const path = this.phase_trial!.source_path as Point[]; this.replay_ticks += Number(!equal(start, end)); this.replay_cursor = Math.min(path.length - 1, this.replay_ticks);
        const actual = new Set<string>(second.occurrences.filter(e => e.signature !== this.body!.signature && e.geometry === phase.geometry[this.body!.signature]).map(e => pkey(e.position)));
        const expected = new Set<string>(this.history_paths.map(history => pkey(history[Math.min(history.length - 1, this.replay_ticks)]!)));
        if (actual.size) {
          if (!subset(actual, expected)) {
            this.replay_refuted = true; this.events.push({ kind: 'replay_cursor_counterexample', observation: second.ref,
              expected: [...expected].map(point).sort(compare), observed: [...actual].map(point).sort(compare), cursor: this.replay_cursor,
              alternatives: ['truncated history', 'overwritten history', 'other tick rule'] });
          } else (equal(start, end) ? this.replay_blocked_support : this.replay_motion_support).push(second.ref);
        }
      }
      if (!this.selected) continue;
      const site = this.selected.position as Point, remote = new Set<string>((this.selected.peer_support as Point[]).map(pkey));
      const changed = [...remote].map(point).sort(compare).filter(([x, y]) => pixel(first.rows, x, y) !== pixel(second.rows, x, y))
        .map(([x, y]) => [x, y, pixel(first.rows, x, y), pixel(second.rows, x, y)]);
      if (equal(end, site) && !equal(start, end) && this.contact === null) {
        this.contact = { site, before_ref: first.ref, after_ref: second.ref, from: start, pixels: changed, action };
        this.events.push({ kind: 'linked_contact_effect', ...this.contact, exclusive_cause_established: false });
      } else if (this.contact && equal(start, site) && !equal(end, site) && this.departure === null) {
        const pixels = this.contact.pixels as number[][];
        this.departure = { before_ref: first.ref, after_ref: second.ref, position: end,
          remote_restored: pixels.length > 0 && pixels.every(([x, y, old]) => pixel(second.rows, x!, y!) === old),
          remote_persisted: pixels.length > 0 && pixels.every(([x, y, , next]) => pixel(second.rows, x!, y!) === next), effect_pixels: pixels.length };
        this.events.push({ kind: 'linked_contact_departure_contrast', ...this.departure });
      } else if (this.departure && equal(end, site) && !equal(start, end) && this.reversal === null) {
        const pixels = this.contact!.pixels as number[][], returned = pixels.length > 0 && pixels.every(([x, y, , next]) => pixel(second.rows, x!, y!) === next);
        this.reversal = { after_ref: second.ref, effect_returned: returned, conditional_hold_supported: this.departure.remote_restored && returned };
        this.events.push({ kind: 'linked_contact_reentry_contrast', ...this.reversal });
      }
    }
  }

  paths(rows: NativeRows, start: Point, special: readonly Point[] = [], conditionalTransit: readonly Point[] = [], work?: LinkedTemporalWork): Map<string, RouteStep[]> {
    const q = this.body!.quantum as number, [w, h] = this.body!.size as Size, height = rows.length, width = rows[0]!.length;
    const specials = new Set(special.map(pkey)), transit = new Set(conditionalTransit.map(pkey));
    const paths = new Map<string, RouteStep[]>([[pkey(start), []]]), pending: Point[] = [start];
    for (let i = 0; i < pending.length; i++) {
      work?.node(); const origin = pending[i]!;
      for (const vector of [[0, -q], [-q, 0], [q, 0], [0, q]] as Point[]) {
        const dest = add(origin, vector), [x, y] = dest, k = pkey(dest); work?.tick();
        if (paths.has(k) || !(0 <= x && x <= width - w && 0 <= y && y <= height - h)) continue;
        const clear = allFloor(patch(rows, dest, this.body!.size), this.body!.floor);
        if (!clear && !specials.has(k) && !transit.has(k)) continue;
        paths.set(k, [...paths.get(pkey(origin))!, [origin, dest, vector]]); if (clear || transit.has(k)) pending.push(dest);
      }
    }
    return paths;
  }

  propose(phase: LinkedTemporalPhaseRelations, observation: R, suppliedRows: NativeRows, inputs: readonly R[], remaining: number, work?: LinkedTemporalWork): R | null {
    this.observe(phase, observation, work); if (!this.body || remaining <= 0) return null;
    const current = phase.states.at(-1)!, position = current.poses[this.body.signature] as Point | undefined; if (!position) return null;
    const available = inputs.filter(item => !item.data || Object.keys(item.data).length === 0).map(item => item.action_ref as string), rows = suppliedRows;
    const byVector = new Map<string, string>(); for (const [action, vector] of this.vectors) if (available.includes(action)) byVector.set(pkey(vector), action);
    const completed = this.phase_changed && this.history_paths.every(path => this.replay_ticks >= path.length - 1);
    const heldSites: Point[] = completed ? this.prepared_effects.filter(effect => effect.kind === 'reversible_occupancy'
      && (effect.pixels as number[][]).every(([x, y, , next]) => pixel(rows, x!, y!) === next)).map(e => e.site) : [];
    const paths = this.paths(rows, position, [...this.nodes.map(node => node.position), this.goal!], heldSites, work);
    let reason: string | null = null, route: RouteStep[] | undefined;
    if (this.selected === null) {
      const options = this.nodes.filter(node => paths.has(pkey(node.position)));
      if (!options.length) return null;
      options.sort((a, b) => compare([paths.get(pkey(a.position))!.length, a.position], [paths.get(pkey(b.position))!.length, b.position])); this.selected = options[0]!;
    }
    const site = this.selected.position as Point;
    if (this.contact === null) { route = paths.get(pkey(site)); reason = 'Test contact with the smaller dense occurrence linked to a distant larger support.'; }
    else if (!(this.contact.pixels as any[]).length) return null;
    else if (this.departure === null) {
      const exits: [any[], RouteStep[]][] = [];
      for (const [destKey, prefix] of paths) {
        const dest = point(destKey); if (prefix.length !== 1 || equal(dest, site) || !allFloor(patch(rows, dest, this.body.size), this.body.floor)) continue;
        const questions = this.nodes.map(node => node.position as Point).filter(p => !equal(p, site)), onward = this.paths(rows, dest, [...questions, this.goal!], [], work);
        const relevance = questions.filter(p => onward.has(pkey(p))).length + Number(onward.has(pkey(this.goal!)));
        exits.push([[-relevance, !equal(dest, this.contact.from), dest], prefix]);
      }
      exits.sort((a, b) => compare(a[0], b[0])); route = exits.length ? exits[0]![1] : paths.get(pkey(this.contact.from));
      reason = 'Leave the contacted occurrence and compare the frozen remote pixels.';
    } else if (this.departure.remote_persisted) {
      if (!this.persistent_sites.has(pkey(site))) {
        this.persistent_sites.add(pkey(site)); this.prepared_effects.push({ site, pixels: this.contact.pixels, kind: 'persistent_after_observed_departure', evidence: [this.contact.after_ref, this.departure.after_ref] });
        this.events.push({ kind: 'retain_contextual_persistent_preparation', observation: current.ref, site, pixels: this.contact.pixels,
          departure_ref: this.departure.after_ref, unresolved: ['duration', 'reentry may invert', 'phase change may restore original world'] });
      }
      const options = this.nodes.filter(node => !this.persistent_sites.has(pkey(node.position)) && !contains(this.prepared, node.position) && paths.has(pkey(node.position)));
      if (paths.has(pkey(this.goal!))) { route = paths.get(pkey(this.goal!)); reason = 'Test destination access while preserving the locally persistent preparation.'; }
      else if (options.length) {
        options.sort((a, b) => compare([paths.get(pkey(a.position))!.length, a.position], [paths.get(pkey(b.position))!.length, b.position]));
        this.selected = options[0]!; this.contact = null; this.departure = null; this.reversal = null; return this.propose(phase, observation, rows, inputs, remaining, work);
      } else return null;
    } else if (this.reversal === null) { route = paths.get(pkey(site)); reason = 'Reenter the same occurrence to distinguish reversible occupancy from a one-off change.'; }
    else if (!this.reversal.conditional_hold_supported) return null;
    else if (this.phase_trial === null || this.recording_next) {
      const unresolved = this.phase_action !== null && available.includes(this.phase_action) ? [this.phase_action]
        : available.filter(action => !this.vectors.has(action) && !this.tested.has(key([position, action])));
      if (unresolved.length !== 1 || this.slot_count === null || this.history_paths.length >= this.slot_count - 1) return null;
      const sourcePath: Point[] = [this.body.start];
      this.phase_trial = { before_ref: current.ref, action: unresolved[0]!, recorded_steps: phase.commands.length, site, source_path: sourcePath };
      for (const state of phase.states.slice(this.phase_start + 1)) { const pose = state.poses[this.body.signature] as Point | undefined; if (pose && !equal(pose, sourcePath.at(-1))) sourcePath.push(pose); }
      this.history_paths.push(sourcePath); this.prepared.push(site);
      this.prepared_effects.push({ site, pixels: this.contact.pixels, kind: 'reversible_occupancy', evidence: [this.contact.after_ref, this.reversal.after_ref] });
      this.phase_action = unresolved[0]!; this.recording_next = false;
      return this.bundle(observation, unresolved[0]!, position, null, 'Test the remaining input while a reversible remote condition is established.', 'phase');
    } else if (this.phase_changed) {
      if (this.replay_refuted) return null;
      route = paths.get(pkey(this.goal!)); reason = 'Test the visible open-rim destination while the previously contacted occurrence may be replayed.';
      const unfinished = this.history_paths.some(path => this.replay_ticks < path.length - 1);
      if (route === undefined && !unfinished && this.history_paths.length < this.slot_count! - 1) {
        const options = this.nodes.filter(node => !contains(this.prepared, node.position) && !this.persistent_sites.has(pkey(node.position)) && paths.has(pkey(node.position)));
        if (options.length) {
          options.sort((a, b) => compare([paths.get(pkey(a.position))!.length, a.position], [paths.get(pkey(b.position))!.length, b.position]));
          this.selected = options[0]!; this.contact = null; this.departure = null; this.reversal = null; this.recording_next = true;
          this.events.push({ kind: 'compose_another_linked_contribution', observation: current.ref, prepared_sites: [...this.prepared], new_site: this.selected.position,
            remaining_marker_slots: this.slot_count! - this.history_paths.length - 1, terminal_access_still_unavailable: true });
          return this.propose(phase, observation, rows, inputs, remaining, work);
        }
      }
      if (route === undefined || unfinished) {
        const remote = new Set<string>(this.prepared_effects.flatMap(effect => (effect.pixels as number[][]).map(([x, y]) => pkey([x!, y!]))));
        const currentRemote = new Set<string>((this.contact.pixels as number[][]).map(([x, y]) => pkey([x!, y!]))), candidates: [any[], RouteStep[]][] = [];
        for (const [originKey, prefix] of paths) for (const [vectorKey] of byVector) {
          work?.tick(); const origin = point(originKey), vector = point(vectorKey), dest = add(origin, vector), support = rectangle(dest, this.body.size), addressed = intersects(support, currentRemote);
          if (addressed || (!paths.has(pkey(dest)) && intersects(support, remote))) candidates.push([[!addressed, prefix.length], [...prefix, [origin, dest, vector]]]);
        }
        candidates.sort((a, b) => compare(a[0], b[0]));
        if (candidates.length && !unfinished) { route = candidates[0]![1]; reason = 'Approach the previously changed region and test whether its access becomes available.'; }
        else if (unfinished) {
          const approach = candidates.length ? candidates[0]![1].slice(0, -1) : [];
          if (approach.length) { route = approach; reason = 'Approach the remote region while comparing the secondary path with the recorded displacements.'; }
          else {
            const loops: RouteStep[][] = [];
            for (const [displacementKey] of byVector) {
              const displacement = point(displacementKey), reverse: Point = [-displacement[0], -displacement[1]], dest = add(position, displacement);
              if (!byVector.has(pkey(reverse)) || !paths.has(pkey(dest)) || paths.get(pkey(dest))!.length !== 1 || intersects(rectangle(dest, this.body.size), remote)) continue;
              loops.push([[position, dest, displacement], [dest, position, reverse]]);
            }
            if (!loops.length) return null; loops.sort((a, b) => compare(a[0]![1], b[0]![1])); route = loops[0]!;
            reason = 'Contrast accepted motion with a blocked command by a reversible observed-floor excursion.';
          }
        } else return null;
      }
    }
    if (!route?.length) return null;
    const [origin, dest, vector] = route[0]!, action = byVector.get(pkey(vector));
    if (action === undefined) {
      const unresolved = unmeasuredControls(available, available, ref => this.vectors.has(ref) || this.tested.has(key([position, ref]))).next().value;
      if (unresolved === undefined) return null;
      const proposal = this.bundle(observation, unresolved, position, null, 'Measure an unresolved input needed by the visible access path.', 'binding');
      bindMissingControlTrial(proposal as Parameters<typeof bindMissingControlTrial>[0], {
        observationRef: observation.observation_ref, availableActions: available,
        objectiveSupported: route.length > 0, effectKnown: this.vectors.has(unresolved),
        triedInContext: this.tested.has(key([position, unresolved])), evidence: proposal.question.hypothesis_refs,
      });
      return proposal;
    }
    const prefix: R[] = [];
    for (const [source, target, displacement] of route.slice(0, Math.min(16, remaining))) {
      const ref = byVector.get(pkey(displacement)); if (ref === undefined) break;
      prefix.push({ action: { action_ref: ref }, from: source, to: target, destination_before: equal(target, position)
        ? Array.from({ length: this.body.size[1] }, () => Array.from({ length: this.body!.size[0] }, () => this.body!.floor)) : patch(rows, target, this.body.size) });
      if (!allFloor(patch(rows, target, this.body.size), this.body.floor)) break;
    }
    return this.bundle(observation, action, origin, dest, reason!, 'access', prefix);
  }

  bundle(observation: R, action: string, start: Point, end: Point | null, why: string, mode: string, prefix?: R[]): R {
    const command = { action_ref: action }, ref = 'C_linked_' + digest([observation.observation_ref, command, why]).slice(0, 16), evidence = [observation.observation_ref];
    if (this.contact) evidence.push(this.contact.after_ref);
    const facts = { linked_occurrences_measured: true, receiver_bound: true, access_is_conditional: true, terminal_role_is_hypothesis: true };
    const plan: R = { bootstrap: true, primary: this.body!.signature, from: start, to: end, why, mode, site: this.selected!.position,
      remote_pixels: this.contact?.pixels ?? [], falsifiers: ['receiver displacement differs', 'linked remote region unchanged', 'condition persists on departure'],
      alternatives: ['local decoration', 'persistent activation', 'autonomous change', 'reversible occupancy'],
      retained_preparations: this.prepared_effects.map(effect => ({ site: effect.site, kind: effect.kind, evidence: effect.evidence })) };
    if (this.contact && this.departure === null && mode === 'access') plan.departure_contrast = { entry_ref: this.contact.after_ref, peer_pixels: this.contact.pixels,
      exit_choice: 'maximal count of visible accessible unresolved occurrences without recrossing the contacted site', return_obligation: false, persistence_is_unknown_until_response: true };
    const steps: R[] = prefix?.length ? prefix : [{ action: command, from: start, to: end, destination_before: null }], commands = steps.map(step => step.action);
    steps.forEach((step, index) => { step.expected_before = { frame_hash: index === 0 ? observation.frame_hash : null }; step.expected_after = step.to; }); plan.steps = steps;
    if (this.phase_changed && !this.replay_refuted && mode !== 'phase') {
      let ticks = this.replay_ticks; const path = this.phase_trial!.source_path as Point[];
      for (const step of steps) {
        step.secondary_before = path[Math.min(path.length - 1, ticks)]; step.copies_before = this.history_paths.map(history => history[Math.min(history.length - 1, ticks)]);
        ticks += Number(step.to !== null && !equal(step.to, step.from));
        step.secondary_after = path[Math.min(path.length - 1, ticks)]; step.copies_after = this.history_paths.map(history => history[Math.min(history.length - 1, ticks)]);
      }
      plan.secondary = this.secondary; plan.receiver_mask = this.body!.mask;
      plan.replay_hypothesis = 'A successful receiver displacement advances one recorded displacement; a blocked command may leave the cursor unchanged.';
      plan.replay_support = { motion: this.replay_motion_support.slice(-2), blocked: this.replay_blocked_support.slice(-2) };
    }
    const changes: R = {};
    if (mode === 'phase') for (const reference of [this.contextId(observation), ...this.prepared_effects.map(effect => this.effectId(observation, effect))])
      changes[reference] = { observation_ref: observation.observation_ref, action_ref: action, why, expected_reestablishment: { conditional_histories: this.history_paths } };
    return { status: 'proposed', kind: 'linked_contact_experiment', phase_plan: plan, preservation_changes: changes, actions: commands, steps, facts,
      compositions: [{ id: ref, role: 'information_question', observed: false, open_question: why, properties: { terminal_relevance: 'unknown' }, relations: ['contributes_to:G_official_completion'] }],
      question: { reason: why, hypothesis_refs: evidence }, route_refs: evidence,
      binding: { observation_ref: observation.observation_ref, level_epoch: observation.level_epoch, levels_completed: observation.levels_completed },
      bundle_template: { operation_key: 'OP18', composition_ref: ref, objective_ref: 'G_official_completion', preserve_refs: [], purpose: why, evidence, actions: commands,
        preconditions: facts, frozen_linked_contact: clone(plan), outcome_guard: { path: ['value'], contains: ref } } };
  }
  before(proposal: R, index: number, publicPacket: R, observation: R): NativeBeforeResult {
    const plan = proposal.phase_plan as R, step = proposal.steps[index] as R, entities = new Map<string, Point>((observation.entities as R[]).filter(e => !e.identity_ambiguous).map(e => [e.signature, e.position]));
    let ok = (index > 0 || observation.observation_ref === proposal.binding.observation_ref) && publicPacket.level === proposal.binding.level_epoch
      && publicPacket.levels_completed === proposal.binding.levels_completed && (index > 0 || publicPacket.frame_hash === step.expected_before.frame_hash)
      && publicPacket.available_action_refs.includes(step.action.action_ref) && equal(entities.get(plan.primary), step.from);
    if (step.destination_before !== null) ok = ok && equal(patch(publicPacket.frame_rows, step.to, this.body!.size), step.destination_before);
    const copies = this.secondaryPoses(observation, plan); if (copies.size && Object.hasOwn(step, 'copies_before')) ok = ok && subset(copies, new Set<string>((step.copies_before as Point[]).map(pkey)));
    return { admitted: Boolean(ok), reason: ok ? 'linked_contact_receiver_bound' : 'linked_contact_binding_changed' };
  }
  after(proposal: R, index: number, before: R, after: R): NativeAfterResult {
    if (before.level_epoch !== after.level_epoch || before.levels_completed !== after.levels_completed || before.state !== after.state)
      return { matched: null, seal_prefix: true, reason: 'official_boundary' };
    const end = proposal.steps[index].to, entities = new Map<string, Point>((after.entities as R[]).filter(e => !e.identity_ambiguous).map(e => [e.signature, e.position]));
    let matched: boolean | null = end === null ? null : equal(entities.get(proposal.phase_plan.primary), end);
    const copies = this.secondaryPoses(after, proposal.phase_plan);
    if (copies.size && Object.hasOwn(proposal.steps[index], 'copies_after')) matched = matched && subset(copies, new Set<string>((proposal.steps[index].copies_after as Point[]).map(pkey)));
    return { matched, seal_prefix: matched !== true || index + 1 === proposal.steps.length, reason: 'linked_contact_conditional_response' };
  }
  secondaryPoses(observation: R, plan: R): Set<string> {
    return !Object.hasOwn(plan, 'receiver_mask') ? new Set() : new Set<string>((observation.entities as R[]).filter(e => e.signature !== plan.primary && equal(e.mask, plan.receiver_mask)).map(e => pkey(e.position)));
  }
  contextId(observation: R): string { return 'C_prepared_context_' + digest([observation.level_epoch, this.body!.start]).slice(0, 16); }
  effectId(observation: R, effect: R): string { return 'C_prepared_effect_' + digest([observation.level_epoch, effect.site, effect.evidence]).slice(0, 16); }
  preservationObligations(observation: R, _rows: NativeRows): R[] {
    if (!this.body) return []; const result: R[] = [];
    if (this.phase_context && this.history_paths.length) result.push({ id: this.contextId(observation), meaning: 'Retain the current prepared temporal context.',
      pixels: this.phase_context.pixels, evidence: [this.phase_context.ref], revision_inputs: [this.phase_action] });
    const completed = !this.history_paths.length || this.history_paths.every(path => this.replay_ticks >= path.length - 1);
    if (completed) for (const effect of this.prepared_effects) result.push({ id: this.effectId(observation, effect), meaning: effect.kind,
      pixels: (effect.pixels as number[][]).map(([x, y, , next]) => [x, y, next]), evidence: effect.evidence, occluder_mask: this.body.mask,
      revision_inputs: this.phase_action ? [this.phase_action] : [] });
    return result;
  }
  sourceState(): R {
    const result: R = { policy: this.policy };
    for (const field of LINKED_CONTACT_FIELDS) result[field] = (this as any)[field];
    result.vectors = [...this.vectors]; result.tested = temporalSetState(this.tested); result.persistent_sites = temporalSetState(this.persistent_sites); return result;
  }
  restoreSource(value: R): void {
    if (!equal(value.policy, this.policy)) throw new TypeError('Linked contact policy differs from the checkpoint');
    for (const field of LINKED_CONTACT_FIELDS) (this as any)[field] = clone(value[field]);
    this.vectors = new Map(clone(value.vectors)); this.tested = temporalRestoreSet(value.tested); this.persistent_sites = temporalRestoreSet(value.persistent_sites);
  }
}
export const LINKED_CONTACT_FIELDS = ['body', 'nodes', 'goal', 'selected', 'contact', 'departure', 'reversal', 'phase_trial', 'phase_changed',
  'replay_cursor', 'secondary', 'replay_refuted', 'replay_motion_support', 'replay_blocked_support', 'slot_count', 'slot_boxes', 'phase_context',
  'phase_start', 'history_paths', 'prepared', 'prepared_effects', 'phase_action', 'recording_next', 'replay_ticks', 'waited', 'seen', 'events'] as const;
