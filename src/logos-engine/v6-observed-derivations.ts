/** Native observed_derivations.py: only witnessed feature effects support projection. */
import { v6Digest } from './v6-native-observer.ts';
import { pythonEqual as same, pythonTruthy as truth } from './v6-operations.ts';
import { deriveProjection } from './v6-derive.ts';
import type { DerivationRecord as R } from './v6-derive.ts';

export type ContactEntries = readonly (readonly [readonly [number, string], R])[] | ReadonlyMap<readonly [number, string], R>;
const get = (r: R, k: string, fallback: any = null): any => Object.hasOwn(r, k) ? r[k] : fallback;
const or = <T>(value: T, fallback: T): T => truth(value) ? value : fallback;
const mod4 = (value: number): number => (value % 4 + 4) % 4;
const integer = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value);
const keyOf = (value: unknown) => JSON.stringify(value);
const comparePoints = (a: readonly number[], b: readonly number[]): number => {
  for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i]! - b[i]!;
  return a.length - b.length;
};
const sortedSites = (sites: readonly (readonly number[])[]) => [...sites].sort(comparePoints);
function bound(facts: R, plan: R | undefined, key: string): R[] | null {
  const route = facts.routes?.[key];
  if (!truth(plan) || !truth(route) || !truth(route.actions) || plan!.contact_in_prefix !== true) return null;
  for (const k of ['level_epoch', 'observation_ref']) if (get(plan!, k) !== facts[k] || get(route, k) !== facts[k]) return null;
  const steps: R[] = plan!.steps ?? [], commands = steps.map(step => ({ action_ref: step.action_ref }));
  if (!same(commands, route.actions) || commands.length < 1 || commands.length > 16
    || !same(steps[0]!.from, or(facts.controlled_xy, [])) || !same(steps.at(-1)!.to, or(plan!.goal_xy, []))
    || !same(steps.at(-1)!.to, or(route.end_xy, []))) return null;
  return commands;
}

export async function observedDerivations(facts: R, plans: R, contacts: ContactEntries | null, featureTrials: R,
  stationMethod: R | null, remaining: number, limits: R = {}): Promise<R> {
  const envelope = Object.fromEntries(['observation_ref', 'level_epoch', 'pair_ref'].map(k => [k, get(facts, k)]));
  const no = (status: string, extra: R = {}) => ({ status, offers: [], rules_count: 0, release_authority: false, ...envelope, ...extra });
  if (!integer(remaining) || remaining < 1) return no('no_remaining_actions');
  const epoch = get(facts, 'level_epoch'), ref = get(facts, 'observation_ref'), pairRef = get(facts, 'pair_ref');
  if (!truth(ref) || !truth(pairRef) || !truth(facts.control_attested)) return no('current_pair_or_control_unbound');
  const visible = or(facts.feature_residuals, {});
  let pair: R | null = null;
  for (const plan of Object.values(plans) as R[]) if (truth(plan.pair) && plan.observation_ref === ref
    && await v6Digest([epoch, await v6Digest(sortedSites(plan.pair.sites))]) === pairRef) { pair = plan.pair; break; }
  if (pair === null && truth(visible.sites) && await v6Digest([epoch, await v6Digest(sortedSites(visible.sites))]) === pairRef) {
    const alternatives = or(visible.orientation_alternatives, []);
    pair = { sites: visible.sites, shape_class: get(visible, 'shape_class'), palette_values: or(get(visible, 'palette_values'), get(visible, 'observed_colors')),
      quarter_turns: alternatives.length === 1 ? alternatives[0] : null };
  }
  if (!truth(pair)) return no('no_bound_current_pair_plan');
  const shape = or(get(visible, 'shape_class'), get(pair!, 'shape_class'));
  let peer = get(visible, 'possible_peer');
  const contactRows = [...(contacts ?? [])], sitesId = await v6Digest(sortedSites(pair!.sites));
  const localContact = contactRows.find(([key]) => key[0] === epoch && key[1] === sitesId)?.[1] ?? {};
  if (get(localContact, 'peer') !== null) {
    if (peer !== null && !same(localContact.peer, peer)) return no('competing_peer_bindings');
    peer = localContact.peer;
  }
  if (!truth(shape) || peer === null || !pair!.sites.some((site: number[]) => same(site, peer))) return no('shape_or_peer_not_revalidated');
  const index = pair!.sites.findIndex((site: number[]) => same(site, peer));
  const colors = or(pair!.palette_values, or(visible.observed_colors, [])), turns = get(pair!, 'quarter_turns');
  if (!integer(turns) || colors.length !== 2) return no('pose_or_palette_unmeasured');
  const pose = index === 0 ? turns : mod4(-turns), mobile = colors[1 - index], reference = colors[index];
  const scope = { level_epoch: epoch, observation_ref: ref, pair: pairRef };
  const initial = { pair: pairRef, shape, orientation: pose, mobile_color: mobile, peer_color: reference, projected_from: 'current' };
  const meter = facts.meter_forecast;
  const quantified = meter !== null && typeof meter === 'object' && !Array.isArray(meter) && meter.observation_ref === ref
    && meter.level_epoch === epoch && integer(meter.steps_before_empty);
  const resources = quantified ? { meter_steps: meter.steps_before_empty } : {};
  const ledger: R = { [ref]: { kind: 'observed_state', scope } };
  const current = { facts: initial, resources, persistent_effects: {}, scope, observations: ledger };
  const preserve: R = { facts: { pair: pairRef, shape, peer_color: reference }, minimum_resources: quantified ? { meter_steps: get(limits, 'minimum_meter_after', 0) } : {} };
  if (pose === 0) preserve.facts.orientation = 0;
  if (same(mobile, reference)) preserve.facts.mobile_color = reference;
  const mechanisms: R[] = [], originById: R = {}, rejected: string[] = [], sources: R[] = [];
  const modifier = plans.modifier ?? {}, commands = bound(facts, modifier, 'modifier');
  const startSurface = truth(modifier.steps) ? get(modifier.steps.at(-1), 'surface_sha') : null;
  const localSites = Object.values(localContact.stations ?? {}) as R[], candidates: [R, boolean][] = localSites.map(site => [site, false]);
  if (!localSites.length && truth(commands) && truth(stationMethod) && stationMethod!.after === visible.prior_method_ref
    && stationMethod!.source_epoch !== epoch && stationMethod!.site_surface === startSurface
    && same([...new Set(stationMethod!.role_refs ?? [])].sort(), [...new Set(modifier.role_refs ?? [])].sort())
    && same(stationMethod!.size ?? [], or(modifier.size, []))) {
    for (const [[oldEpoch], contact] of contactRows) {
      if (oldEpoch !== stationMethod!.source_epoch) continue;
      for (const old of Object.values(contact.stations ?? {}) as R[]) {
        const rows = (old.entries ?? []).filter((row: R) => row.after === stationMethod!.after);
        if (rows.length && old.site_surface === startSurface) candidates.push([{ ...old, site: modifier.goal_xy, entries: rows, departures: [] }, true]);
      }
    }
  }
  for (const [station, transferred] of candidates) {
    const entries: R[] = station.entries ?? [], key = get(station, 'site_surface'), site = get(station, 'site');
    if (!truth(site) || !truth(key) || !entries.length) continue;
    if (entries.some(e => !truth(e.before) || !truth(e.after) || e.before === e.after || !truth(e.peer_preserved) || !integer(e.delta) || !e.delta)) {
      rejected.push('missing_or_conflicting_rotation_observation'); continue;
    }
    const increments = new Set(entries.map(entry => mod4(entry.delta)));
    if (increments.size !== 1) { rejected.push('conflicting_observed_rotations'); continue; }
    const distinct = [...new Map(entries.map(entry => [entry.after, entry])).values()], delta = [...increments][0]!;
    if (delta === 0) continue;
    const boundCommands = same(site, modifier.goal_xy) && key === startSurface ? commands : null;
    const poses = new Set<number>(distinct.map(entry => entry.before_pose.residual));
    const permitted = poses.size >= 2 ? [0, 1, 2, 3] : [...poses];
    const colorsMeasured = distinct.every(e => ['mobile_color', 'peer_color'].every(k => Object.hasOwn(e.before_pose ?? {}, k)
      && Object.hasOwn(e.after_pose ?? {}, k) && same(e.before_pose[k], e.after_pose[k])));
    const exitProof = (station.departures ?? []).find((e: R) => truth(e.preserved) && truth(e.before) && truth(e.after)
      && distinct.some(z => same(z.from ?? [], e.to ?? []))) ?? null;
    for (const q of permitted.sort((a, b) => a - b)) {
      const exact = distinct.filter(e => e.before_pose.residual === q), support = (exact.length ? exact : distinct.slice(-2)).slice(-2);
      const updates: R = { orientation: mod4(q + delta) }; if (!colorsMeasured) updates.mobile_color = null;
      sources.push({ method: `observed_rotation:${key}`, route: 'modifier', site: [...site], bound: boundCommands,
        requires: { orientation: q }, effects: updates, proofs: support,
        status: transferred ? 'revalidated_prior_site_and_input' : exact.length ? 'observed_at_this_pose' : 'observed_increment_at_two_source_poses',
        proof_epoch: transferred ? stationMethod!.source_epoch : epoch, rearm: exitProof,
        expected: 'pose changes by the observed increment; peer stays fixed',
        falsifiers: ['different_orientation_after_entry', 'peer_changes', 'source_shape_or_scope_lost'] });
    }
  }
  const colorGroups = new Map<string, { site: number[]; color: any; group: [R, R, R][] }>();
  for (const trial of Object.values(featureTrials ?? {}) as R[]) {
    const delta = or(trial.outcome, {});
    if (!truth(trial.arrived) || !truth(trial.before_ref) || !truth(trial.after_ref) || trial.before_ref === trial.after_ref || delta.status !== 'measured' || !truth(trial.site)) continue;
    const observedPair = await v6Digest([epoch, await v6Digest(sortedSites((delta.sites ?? []).map((row: R) => row.bbox)))]);
    if (observedPair !== pairRef) continue;
    const explicit = get(trial, 'epoch', get(trial, 'level_epoch'));
    if (explicit !== null) { if (explicit !== epoch || get(trial, 'pair_ref', pairRef) !== pairRef) continue; }
    else if (localContact.observed !== trial.after_ref) continue;
    const mobileRow = delta.sites.find((row: R) => !same(row.bbox, peer));
    if (!truth(mobileRow) || !same(mobileRow.before.shape, shape)) continue;
    const key = keyOf([trial.site, mobileRow.before.color]);
    if (!colorGroups.has(key)) colorGroups.set(key, { site: [...trial.site], color: mobileRow.before.color, group: [] });
    colorGroups.get(key)!.group.push([trial, mobileRow, delta]);
  }
  for (const { site, color, group } of colorGroups.values()) {
    if (!group.every(([, row, delta]) => truth(delta.color_only_at_one_site) && truth(delta.orientation_preserved)
      && truth(delta.shape_preserved) && same(row.changed, ['color']))) { rejected.push('mixed_or_unconfirmed_color_effect'); continue; }
    const yields = new Set(group.map(([, row]) => row.after.color));
    if (yields.size !== 1) { rejected.push('competing_color_effects'); continue; }
    const plan = plans.feature_probe ?? {};
    let boundCommands = same(plan.goal_xy ?? [], site) ? bound(facts, plan, 'feature_probe') : null;
    const signature = group.at(-1)![0].site_surface;
    if (truth(signature) && truth(plan.steps) && plan.steps.at(-1).surface_sha !== signature) boundCommands = null;
    sources.push({ method: `observed_selective_color:${await v6Digest([site, shape])}`, route: 'feature_probe', site, bound: boundCommands,
      requires: { mobile_color: color }, effects: { mobile_color: [...yields][0] },
      proofs: group.slice(-2).map(([e]) => ({ before: e.before_ref, after: e.after_ref })), status: 'observed_at_this_input_color', rearm: null,
      expected: 'only the mobile palette changes after a physically verified entry',
      falsifiers: ['different_palette_or_unchanged_color', 'mask_or_pose_changes', 'peer_changes'] });
  }
  if (!sources.length) return no('no_applicable_observed_effects', { rejections: rejected });
  const locations = new Map<string, number[]>();
  for (const source of sources) locations.set(await v6Digest(source.site), source.site);
  const speed = Math.max(0, ...Object.values(facts.motion_examples ?? {}).map(value => Math.abs((value as number[])[0]!) + Math.abs((value as number[])[1]!)));
  for (const source of sources) {
    const plan = plans[source.route];
    if (truth(plan) && (get(plan, 'observation_ref') !== ref || get(plan, 'level_epoch') !== epoch)) return no('stale_current_route', { rejections: rejected });
  }
  for (const source of sources) {
    const destination = await v6Digest(source.site);
    const possible: [string, R[] | null][] = truth(source.bound) || speed && get(facts, 'controlled_xy') !== null ? [['current', source.bound]] : [];
    if (get(source, 'proof_epoch', epoch) === epoch) for (const origin of locations.keys()) if (origin !== destination || truth(source.rearm)) possible.push([origin, null]);
    for (const [origin, actions] of possible) {
      const id = source.method + ':' + (await v6Digest([source.requires, origin])).slice(0, 16);
      const requirements = { ...source.requires, projected_from: origin };
      const proofs: R[] = origin === destination ? [...source.proofs, source.rearm] : source.proofs;
      const evidence: string[] = [], revalidated: string[] = [];
      for (const proof of proofs) {
        const rid = `${id}@${proof.after}`, proofEpoch = get(source, 'proof_epoch', epoch);
        ledger[rid] = { kind: 'observed_transition', mechanism_ref: id, scope: proofEpoch === epoch ? scope : { level_epoch: proofEpoch }, before_ref: proof.before, after_ref: proof.after };
        evidence.push(rid);
        if (proofEpoch !== epoch) {
          const key = `rebind:${id}@${ref}`;
          ledger[key] = { kind: 'current_revalidation', mechanism_ref: id, scope, evidence: [rid] }; revalidated.push(key);
        }
      }
      let cost: number, binding: R;
      if (truth(actions)) { cost = actions!.length; binding = { actions }; }
      else {
        const a = origin === 'current' ? facts.controlled_xy : locations.get(origin), b = source.site;
        if (origin !== destination && !speed) continue;
        cost = same(a, b) ? 2 : Math.max(1, Math.ceil((Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1])) / speed));
        binding = { probe: { route_key: source.route, site: [...source.site], condition: 'revalidate the occurrence and bind a route from the measured state', cost_kind: 'optimistic_lower_bound' } };
      }
      mechanisms.push({ id, scope, preconditions: requirements, effects: { ...source.effects, projected_from: destination }, evidence,
        revalidation_refs: revalidated, cost, preserve: { pair: pairRef, shape, peer_color: reference }, resource_delta: quantified ? { meter_steps: -cost } : {}, falsifiers: source.falsifiers, ...binding });
      originById[id] = { source, proofs };
    }
  }
  const goals: [string, R][] = [['joint_feature_agreement', { orientation: 0, mobile_color: reference }]];
  if (truth(pose)) goals.push(['orientation_component', { orientation: 0 }]);
  if (!same(mobile, reference)) goals.push(['palette_component', { mobile_color: reference }]);
  const baseGoal = 'preserve_correspondence_extend_features'; goals.push([baseGoal, { ...preserve.facts }]);
  const options: R[] = [], seen = new Set<string>(); let complete = true;
  for (const [goal, requires] of goals) {
    if (goal !== baseGoal && Object.entries(requires).every(([key, value]) => same(get(initial, key), value))) continue;
    const result = deriveProjection(current, { id: goal, requires, evidence: [ref] }, mechanisms,
      { preserve, remainingActions: remaining, maxDepth: get(limits, 'max_depth', 2), maxStates: get(limits, 'max_states', 32) });
    complete = complete && result.search_complete;
    for (const proposed of result.offers as R[]) {
      const chain: R[] = proposed.chain_refs.map((key: string) => originById[key]), projected = proposed.projected.facts, advance: string[] = [];
      if (truth(pose) && projected.orientation !== pose) {
        const increments = new Set<number>(chain.flatMap(row => row.proofs.filter((proof: R) => integer(proof.delta) && mod4(proof.delta)).map((proof: R) => proof.delta)));
        const distance = (q: number, delta: number): number | null => [0, 1, 2, 3].find(i => mod4(q + i * delta) === 0) ?? null;
        if ([...increments].some(delta => distance(pose, delta) !== null && distance(projected.orientation, delta) !== null
          && distance(projected.orientation, delta)! < distance(pose, delta)!)) advance.push('orientation');
      }
      if (!same(mobile, reference) && same(projected.mobile_color, reference)) advance.push('color');
      if (goal === baseGoal && (proposed.relation !== 'extends_target' || !advance.length)) continue;
      const methods = chain.map(row => row.source.method), mark = keyOf([goal, proposed.chain_refs]);
      if (seen.has(mark)) continue; seen.add(mark);
      const evidence = chain.map(row => ({ method_ref: row.source.method, status: row.source.status,
        transitions: row.proofs.map((proof: R) => ({ before: proof.before, after: proof.after })) }));
      const first = chain[0]!.source, boundFirst = Object.hasOwn(proposed.first_obligation.binding, 'actions');
      options.push({ ...proposed, ...envelope, first_route_key: boundFirst ? first.route : null, unresolved_route_key: boundFirst ? null : first.route,
        method_ref: methods[0], method_chain: methods, first_actions: first.bound, method_evidence: evidence, requires, motif: shape,
        reason: `observed_mechanisms_project_${goal}`, source_observation: ref, improved_features: advance,
        base_target_currently_satisfied: goal === baseGoal,
        cost_scope: !boundFirst ? 'optimistic_lower_bound_pending_route' : chain.length > 1 ? 'bound_first_set_only; later cost is a lower bound' : 'current_bound_set' });
    }
  }
  return { status: options.length ? 'conditional_options' : 'no_goal_witness_under_current_constraints', offers: options, ...envelope,
    rules_count: mechanisms.length, search_complete: complete, rejections: rejected, station_template_only: truth(stationMethod) && !localSites.length, release_authority: false };
}
