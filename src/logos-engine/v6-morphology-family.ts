/** Current V6 morphology producer and base probe adapter.
 *
 * Contacts belong here; motion history belongs to the common GoalAccess owner,
 * meter/collection to the existing InventoryCallerContext. The current decision
 * lives for one caller selection only; remembered station/entry methods remain open.
 */
import { NativeMorphologyPolicy } from './v6-morphology-policy.ts';
import { CompositionTargetTree } from './v6-target-binding.ts';
import type { ContactEntries } from './v6-observed-derivations.ts';
import { measureMorphologyRoutes, morphologyPairs, morphologyPairKey,
  observedMorphologySelectiveChange, morphologyCompareFeatures, MorphologyMeasurementDomainError,
  morphologyOrientation as orientation } from './v6-morphology-measurements.ts';
import { motionFootprint } from './v6-motion-contrast.ts';
import { compositionIdentity } from './v6-composition-memory.ts';
import type { GoalAccessMemory } from './v6-composition-memory.ts';
import { pythonEqual as same, pythonTruthy as truth } from './v6-operations.ts';
import { symbolicDigest } from './v6-hash.ts';
import { retainNativeJson } from './v6-native-owned.ts';
import { isJsonObject } from './canonical.ts';
import type { NativeCommand, NativeExecution, NativeFamily, NativeObservation, NativePoint,
  NativeProgramRegistry, NativeProposal, NativePublicObservation, NativeRecord, NativeRows } from './v6-native-types.ts';

type R = Record<string, any>;
const FORMAT = 'native.current_morphology.v1';
const copy = <T>(v: T): T => structuredClone(v);
const key = (epoch: number, pair: string): string => JSON.stringify([epoch, pair]);
const footprint = (rows: NativeRows, at: number[], size: number[]) => motionFootprint(rows, at as unknown as NativePoint, size as unknown as NativePoint);
const sourceIdentity = symbolicDigest;

interface Context {
  goal: () => GoalAccessMemory;
  forecast: () => R | null;
  observe: (obs: NativeObservation, rows: NativeRows) => void;
  collection: () => { pending: R; history: R } | null;
}

export class NativeMorphologyFamily implements NativeFamily<any> {
  readonly id = 'morphology';
  readonly policy: NativeMorphologyPolicy;
  private readonly targetTree = new CompositionTargetTree();
  private context: Context | null = null;
  private contacts = new Map<string, R>();
  private tried = new Set<string>();
  private featureTrials: R = {};
  private journal: R[] = [];
  private eventIds = new Map<string, string>();
  private checkpoint: R | null = null;
  private measurement: R | null = null;
  private refusal: R | null = null;
  private last: { observation: string; epoch: number; score: number; frame: string; decision: R } | null = null;

  private constructor(policy: NativeMorphologyPolicy) { this.policy = policy; }
  static async create(): Promise<NativeMorphologyFamily> { return new NativeMorphologyFamily(await NativeMorphologyPolicy.create()); }
  enableCallerContext(context: Context): void { this.context = context; }
  async attachPrograms(registry: NativeProgramRegistry): Promise<void> { await this.policy.attachPrograms(registry); }
  /** Source StrategyRouter resets morph.last before visiting any provider. */
  beginDecision(): void { this.last = null; this.measurement = null; this.refusal = null; }
  currentDecision(obs: NativeObservation): R | null {
    const last = this.last;
    return last && last.observation === obs.observation_ref && last.epoch === obs.level_epoch
      && last.score === obs.levels_completed && last.frame === obs.frame_hash ? copy(last.decision) : null;
  }
  currentMeasurementReceipt(obs: NativeObservation): R | null {
    return this.measurement?.observation_ref === obs.observation_ref ? copy(this.measurement) : null;
  }
  currentProposalRefusal(obs: NativeObservation): R | null {
    return this.refusal?.observation_ref === obs.observation_ref ? copy(this.refusal) : null;
  }
  async propose(obs: NativeObservation, rows: NativeRows, inputs: readonly NativeCommand[], remaining: number,
    execution?: NativeExecution): Promise<NativeProposal | null> {
    this.beginDecision();
    if (!this.context) throw new Error('Morphology requires the existing common observation owners');
    if (execution?.signal?.aborted) throw new DOMException('Native reasoning cancelled', 'AbortError');
    const goal = this.context.goal(), current = goal.snapshot(obs, rows);
    // Same observation is idempotent in the existing meter. No second meter exists.
    this.context.observe(obs, rows);
    const forecast = this.context.forecast(), available = inputs.filter(a => !truth(a.data)).map(a => a.action_ref);
    let measured;
    try {
      measured = await measureMorphologyRoutes({ history: goal.episode, current,
        limit: Math.min(16, remaining), contacts: this.contacts, tried: this.tried, available,
        actionBudget: remaining, meterForecast: forecast, collectionEvidence: this.context.collection(), observation: obs,
        featureTrials: this.featureTrials });
    } catch (error) {
      if (!(error instanceof MorphologyMeasurementDomainError)) throw error;
      this.refusal = { rule: 'current_morphology_measurement_domain', observation_ref: obs.observation_ref,
        level_epoch: obs.level_epoch, frame_hash: obs.frame_hash, status: 'unknown', release_authority: false,
        reason: error.message };
      return null;
    }
    const { facts, plans, receipt } = measured;
    for (const name of Object.keys(facts.routes)) {
      if (!plans[name] || plans[name].steps.some((s: R) => !available.includes(s.action_ref))) delete facts.routes[name];
    }
    facts.meter_forecast = forecast;
    // Reuse the already transferred target derivation so current residuals
    // retain their source priority. Remembered entry/rearm producers remain open.
    const extension = await this.targetTree.extendTarget(facts, plans,
      [...this.contacts].map(([encoded, row]) => [JSON.parse(encoded), row]) as ContactEntries,
      this.featureTrials, null, remaining);
    facts.extension_route = extension?.currently_bound ? extension.first_route_key : null;
    facts.extension_kind = extension?.proposed.kind ?? null;
    const decision = await this.policy.evaluate(facts);
    this.measurement = { observation_ref: obs.observation_ref, level_epoch: obs.level_epoch,
      producer: receipt, facts_digest: sourceIdentity(facts), framed_pair: facts.framed_pair,
      pair_ref: facts.pair_ref ?? null, control_attested: facts.control_attested,
      routes: Object.keys(facts.routes), meter_observation_ref: forecast?.observation_ref ?? null,
      decision: Object.fromEntries(['status', 'reason', 'route_key', 'operation', 'workflow', 'src_hash', 'executed_statements'].map(k => [k, decision[k] ?? null])),
      release_authority: false };
    if (receipt.status === 'deferred_source_branch') {
      this.refusal = { rule: 'current_morphology_producer_scope', observation_ref: obs.observation_ref,
        level_epoch: obs.level_epoch, frame_hash: obs.frame_hash, status: 'unknown', release_authority: false,
        reason: 'morphology_source_branch_not_transferred', producer: receipt };
      return null;
    }
    // A covered measurement can retain a composition without offering a route.
    // Later source providers consume that decision in this same selection.
    // A deferred producer above cannot supply an untransferred control premise.
    const bound: R = { ...decision, target_extension: extension, measured_facts: facts };
    this.last = { observation: obs.observation_ref, epoch: obs.level_epoch, score: obs.levels_completed,
      frame: obs.frame_hash, decision: bound };
    if (!decision.route_key) return null;
    const plan = plans[String(decision.route_key)];
    if (!plan || !facts.routes[plan.route_key]) throw new TypeError('Morphology decision lacks its current measured route');
    bound.access_phase = plan.access_phase ?? 'probe_access';
    bound.contact_in_prefix = plan.contact_in_prefix ?? false;
    plan.facts = facts;
    const actions = facts.routes[plan.route_key].actions, steps = actions.map((action: R, i: number) => ({ action,
      expected_after: i + 1 === actions.length && (plan.last_effect_unknown ?? true) ? null : { position: plan.steps[i].to } }));
    const prediction = plan.known_effectful_site?.hypothesis;
    if (prediction && plan.contact_in_prefix) steps.at(-1)!.expected_after = prediction;
    const ref = 'composition:morphology:' + await compositionIdentity([facts.pair_ref, decision.composition]);
    const evidence = [current.ref, ...(decision.projection_refs as string[]), ...(decision.principle_refs as string[]), ...(plan.evidence ?? [])];
    const premises = { correspondence_current: true, bound_access_current: true };
    return { status: 'proposed', kind: 'morphology_probe', proposal_id: plan.trial, actions, steps, facts: premises,
      compositions: [{ id: ref, role: decision.role, observed: false, properties: { hypothesis: decision.composition,
        feature_residuals: facts.feature_residuals ?? null, preserve_features: facts.preserve_features ?? [],
        route_key: plan.route_key, falsifiers: decision.falsifiers }, things: plan.role_refs,
        relations: ['contributes_to:G_official_completion'], open_question: decision.reason }],
      morphology_plan: plan, morphology: bound, morphology_measurement_receipt: copy(this.measurement),
      question: { reason: decision.reason, hypothesis_refs: [ref], falsifiers: decision.falsifiers }, route_refs: evidence,
      binding: { observation_ref: current.ref, level_epoch: current.epoch, levels_completed: current.score },
      bundle_template: { operation_key: decision.operation, composition_ref: ref, objective_ref: 'G_official_completion',
        preserve_refs: [], purpose: decision.reason, actions, preconditions: premises, evidence,
        outcome_guard: { path: ['value'], contains: ref } } } as NativeProposal;
  }
  bind(proposal: R): void {
    if (!same(proposal.actions, proposal.steps.map((s: R) => s.action))
      || !same(proposal.actions, proposal.morphology_plan.steps.map((s: R) => ({ action_ref: s.action_ref })))) {
      throw new TypeError('Morphology actions differ from the measured route');
    }
  }
  before(proposal: R, index: number, packet: NativePublicObservation, live: NativeObservation) {
    const plan = proposal.morphology_plan, step = plan.steps[index];
    let ok = !!step && packet.level === plan.level_epoch && packet.levels_completed === plan.score
      && (index !== 0 || live.observation_ref === plan.observation_ref)
      && packet.available_action_refs.includes(step.action_ref)
      && same(proposal.actions[index], { action_ref: step.action_ref })
      && sourceIdentity(footprint(packet.frame_rows, step.from, plan.size)) === plan.footprint_sha
      && sourceIdentity(footprint(packet.frame_rows, step.to, plan.size)) === step.surface_sha;
    if (plan.partial_correspondence) {
      const support = plan.partial_correspondence;
      ok = ok && support.after === plan.observation_ref && support.epoch === packet.level
        && support.visible_pixels.every(([x, y, value]: number[]) => packet.frame_rows[y!]?.[x!] === value);
    }
    return { admitted: ok, reason: ok ? 'current_geometry_bound' : 'geometric_premise_changed' };
  }
  async after(proposal: R, index: number, _before: NativeObservation, after: NativeObservation, _first: NativeRows, second: NativeRows) {
    const plan = proposal.morphology_plan;
    const predicted = plan.known_effectful_site?.hypothesis;
    if (predicted && plan.contact_in_prefix && index + 1 === plan.steps.length
      && after.level_epoch === plan.level_epoch && after.levels_completed === plan.score) {
      const pairKey = await morphologyPairKey(plan.pair), contact = this.contacts.get(key(after.level_epoch, pairKey));
      const pose = contact?.peer ? await orientation(second, pairKey, contact.peer) : null;
      return { matched: pose ? pose.peer_pose === predicted.expected_peer_pose && pose.residual === predicted.expected_residual : null,
        seal_prefix: true, reason: 'compare_selective_entry_prediction', measured_pose: pose };
    }
    if (after.level_epoch !== plan.level_epoch || after.levels_completed !== plan.score
      || ['GAME_OVER', 'WIN'].includes(after.state) || index + 1 === plan.steps.length && (plan.last_effect_unknown ?? true)) {
      return { matched: null, seal_prefix: true, reason: 'measure_terminal_contact_or_boundary' };
    }
    const matched = sourceIdentity(footprint(second, plan.steps[index].to, plan.size)) === plan.footprint_sha;
    return { matched, seal_prefix: !matched, reason: 'compare_predicted_position' };
  }
  private applyEvent(event: R): void {
    if (event.feature_effect) this.featureTrials[event.observation_ref] = copy(event.feature_effect);
    const at = key(event.epoch, event.pair_key);
    if (event.kind === 'departure') {
      const station = this.contacts.get(at)?.stations?.[event.station_key];
      if (!station) throw new TypeError('Morphology departure has no acquired station');
      if (!station.departures.some((e: R) => e.after === event.after)) station.departures.push(copy(event));
      return;
    }
    this.tried.add(event.trial);
    if (event.unchanged_peer !== null) this.contacts.set(at, { ...(this.contacts.get(at) ?? {}), peer: copy(event.unchanged_peer), observed: event.observation_ref });
    const row = event.station_entry, contact = this.contacts.get(at);
    if (row && contact) {
      const stations = contact.stations ??= {}, stationKey = sourceIdentity([row.site, row.site_surface, row.size]);
      if (row.delta || stations[stationKey]) {
        const station = stations[stationKey] ??= { ...Object.fromEntries(['site', 'site_surface', 'size', 'footprint', 'role_refs'].map(k => [k, copy(row[k])])), entries: [], departures: [] };
        if (!station.entries.some((e: R) => e.after === row.after)) station.entries.push(copy(row));
      }
    }
  }
  private retainEvent(id: string, event: R): boolean {
    const digest = sourceIdentity(event), prior = this.eventIds.get(id);
    if (prior) { if (prior !== digest) throw new TypeError('Conflicting morphology acquisition'); return false; }
    this.applyEvent(event); this.eventIds.set(id, digest); this.journal.push(retainNativeJson({ id, digest, event }));
    this.checkpoint = null; return true;
  }
  async record(before: NativeObservation, after: NativeObservation, _command: NativeCommand,
    first: NativeRows, second: NativeRows, proposal: R, index: number) {
    const plan = proposal.morphology_plan;
    if (index + 1 !== plan.steps.length || plan.access_phase === 'approach') return { events: [] };
    const effect = plan.physical_effect ?? plan.route_key, pairKey = await morphologyPairKey(plan.pair);
    let unchanged: number[] | null = null;
    if (before.level_epoch === after.level_epoch && effect === 'modifier') unchanged = await observedMorphologySelectiveChange(first, second, plan.pair);
    const event: R = { trial: plan.trial, epoch: before.level_epoch, pair_key: pairKey, unchanged_peer: unchanged,
      before: before.frame_hash, after: after.frame_hash, observation_ref: after.observation_ref, contact_action: proposal.actions[index] };
    if (before.level_epoch === after.level_epoch && effect === 'modifier') {
      const s = plan.steps.at(-1), known = this.contacts.get(key(before.level_epoch, pairKey));
      const peer = unchanged ?? known?.peer;
      event.station_entry = null;
      if (peer && !same(s.from, s.to) && before.levels_completed === after.levels_completed
        && sourceIdentity(footprint(first, s.from, plan.size)) === plan.footprint_sha
        && sourceIdentity(footprint(first, s.to, plan.size)) === s.surface_sha
        && sourceIdentity(footprint(second, s.to, plan.size)) === plan.footprint_sha) {
        const a = await orientation(first, pairKey, peer), b = await orientation(second, pairKey, peer);
        if (a && b) event.station_entry = { site: s.to, site_surface: s.surface_sha, footprint: plan.footprint_sha,
          size: plan.size, role_refs: plan.role_refs, from: s.from, command: s.action_ref, before: before.observation_ref,
          after: after.observation_ref, before_pose: a, after_pose: b, delta: (b.residual - a.residual + 4) % 4,
          peer_preserved: a.peer_pose === b.peer_pose && a.peer_color === b.peer_color,
          peer_scale: plan.pair.scales[plan.pair.sites.findIndex((p: number[]) => same(p, peer))],
          observed_scales: [...plan.pair.scales].sort((a, b) => a - b) };
      }
    }
    if (effect === 'feature_probe' && plan.contact_in_prefix) {
      const [old] = await morphologyPairs(first), [next] = await morphologyPairs(second), site = plan.steps.at(-1).to;
      const arrived = before.level_epoch === after.level_epoch && before.levels_completed === after.levels_completed
        && sourceIdentity(footprint(second, site, plan.size)) === plan.footprint_sha;
      const delta = morphologyCompareFeatures(old.length === 1 ? old[0]! : null, next.length === 1 ? next[0]! : null);
      event.feature_effect = { arrived, site, outcome: delta, epoch: before.level_epoch, pair_ref: plan.facts.pair_ref,
        site_surface: plan.steps.at(-1).surface_sha, before_ref: before.observation_ref, after_ref: after.observation_ref,
        scope: 'conditional_contact_witness' };
      if (arrived && delta.color_only_at_one_site) event.unchanged_peer = delta.sites.find((r: R) => !r.changed.length).bbox;
    }
    const id = JSON.stringify(['selected', plan.trial, index, before.observation_ref, after.observation_ref]);
    return { events: this.retainEvent(id, event) ? [event] : [] };
  }
  /** Passive witnessed departures follow selected acquisition and precede Goal. */
  async observeDepartures(before: NativeObservation, after: NativeObservation, first: NativeRows, second: NativeRows, command: NativeCommand): Promise<R[]> {
    if (before.level_epoch !== after.level_epoch || before.levels_completed !== after.levels_completed) return [];
    const result: R[] = [];
    const position = (obs: NativeObservation, station: R): number[] | null => {
      const roles = Object.fromEntries(obs.entities.filter(e => !e.identity_ambiguous).map(e => [e.signature, e.bbox]));
      return station.role_refs.every((s: string) => roles[s]) ? [0, 1].map(i => Math.min(...station.role_refs.map((s: string) => roles[s]![i]!))) : null;
    };
    for (const [at, contact] of this.contacts) {
      const [epoch, pairKey] = JSON.parse(at);
      if (epoch !== before.level_epoch || !contact.peer) continue;
      for (const [stationKey, station] of Object.entries(contact.stations ?? {}) as [string, R][]) {
        const a = position(before, station), b = position(after, station);
        if (!same(a, station.site) || !b || same(a, b)
          || sourceIdentity(footprint(first, station.site, station.size)) !== station.footprint
          || sourceIdentity(footprint(second, b, station.size)) !== station.footprint
          || sourceIdentity(footprint(second, station.site, station.size)) !== station.site_surface) continue;
        const old = await orientation(first, pairKey, contact.peer), next = await orientation(second, pairKey, contact.peer);
        if (!old || !next) continue;
        const event = { kind: 'departure', epoch, pair_key: pairKey, station_key: stationKey, from: [...station.site], to: b,
          command: command.action_ref, before: before.observation_ref, after: after.observation_ref, preserved: same(old, next), before_pose: old, after_pose: next };
        if (this.retainEvent(JSON.stringify(['departure', at, stationKey, before.observation_ref, after.observation_ref]), event)) result.push(event);
      }
    }
    return result;
  }
  state(): R { return copy(this.nativeState()); }
  nativeState(): R {
    return this.checkpoint ??= retainNativeJson({ format: FORMAT, journal: this.journal,
      contacts: [...this.contacts], tried: [...this.tried].sort(), feature_trials: this.featureTrials });
  }
  restore(value: NativeRecord): void { this.restoreNative(value); }
  restoreNative(value: Readonly<NativeRecord>): void {
    this.beginDecision();
    if (value === this.checkpoint) return;
    const v = retainNativeJson(value) as R;
    if (!isJsonObject(v) || Object.keys(v).length !== 5 || v.format !== FORMAT || !Array.isArray(v.journal)
      || !Array.isArray(v.contacts) || !Array.isArray(v.tried) || !isJsonObject(v.feature_trials)) throw new TypeError('Invalid morphology checkpoint');
    const staged = new NativeMorphologyFamily(this.policy);
    for (const row of v.journal) {
      if (!isJsonObject(row) || typeof row.id !== 'string' || row.digest !== sourceIdentity(row.event)
        || !isJsonObject(row.event) || !staged.retainEvent(row.id, row.event)) throw new TypeError('Invalid or repeated morphology event');
    }
    if (!same(staged.nativeState(), v)) throw new TypeError('Morphology evidence differs from its acquired projection');
    this.contacts = staged.contacts; this.tried = staged.tried; this.featureTrials = staged.featureTrials;
    this.journal = staged.journal; this.eventIds = staged.eventIds; this.checkpoint = v;
  }
}
