/** Finite public projection and conditional product search from V6 morphology.
 * These measurements own no acquired state and release no physical action.
 */
import { compareUnicode } from './canonical.ts';
import { symbolicDigest as identity } from './v6-hash.ts';
import { motionFootprint } from './v6-motion-contrast.ts';
import { pythonEqual as same, pythonTruthy as truth } from './v6-operations.ts';
import type { Snapshot } from './v6-composition-memory.ts';
import type { NativeCommand, NativePoint } from './v6-native-types.ts';

type R = Record<string, any>;
const key = (value: unknown): string => JSON.stringify(value);
const mod = (n: number, modulus: number): number => ((n % modulus) + modulus) % modulus;
function lex(a: any, b: any): number {
  if (Array.isArray(a) && Array.isArray(b)) {
    for (let i = 0; i < Math.min(a.length, b.length); i++) { const c = lex(a[i], b[i]); if (c) return c; }
    return a.length - b.length;
  }
  return typeof a === 'string' && typeof b === 'string' ? compareUnicode(a, b) : a < b ? -1 : a > b ? 1 : 0;
}
function point(value: unknown): NativePoint {
  if (!Array.isArray(value) || value.length !== 2 || !value.every(Number.isSafeInteger)) throw new TypeError('Expected an integer position or displacement');
  return [value[0], value[1]];
}
const difference = <T>(first: ReadonlySet<T> | undefined, second: ReadonlySet<T> | undefined): T[] => [...(first ?? [])].filter(x => !second?.has(x));

export interface MorphologyCollectionEvidence {
  pending: R;
  history: R;
  evidence_for(signature: string): R;
}
export interface ManagedLayoutInput {
  current: Snapshot;
  pair: R | null;
  origin: readonly number[] | null;
  size: readonly number[];
  motions: Record<string, readonly number[]>;
  /** Canonical JSON encodings of measured footprint arrays. */
  surfaces: ReadonlySet<string>;
  /** Canonical JSON of [from, command, to, footprint]. */
  unresolvedEdges: ReadonlyMap<string, R>;
  marks: readonly (readonly number[] | R)[];
  stations: ReadonlyMap<string, R> | readonly R[];
  stationMethod: R | null;
  roleRefs: readonly string[];
  available: readonly (string | NativeCommand)[];
  collectionEvidence: MorphologyCollectionEvidence | null;
  observation: R;
  weakMoves?: R | null;
  /** Canonical JSON encodings of current footprint origins. */
  featureSites?: ReadonlyMap<string, R> | null;
}

/** Exact managed_projection.project_layout on its public, finite input domain. */
export function projectManagedLayout(input: ManagedLayoutInput): [R | null, R | null] {
  const { current, pair, motions, surfaces, unresolvedEdges, marks, stationMethod: method,
    roleRefs, available, collectionEvidence, observation, weakMoves, featureSites } = input;
  if (!truth(pair) || !truth(motions) || !truth(input.origin) || !truth(method)
    || observation.level_epoch !== current.epoch || observation.observation_ref !== current.ref) return [null, null];
  const origin = point(input.origin), size = point(input.size), sites = pair!.sites ?? [], scales = pair!.scales ?? [];
  const stations = Array.isArray(input.stations) ? input.stations : [...input.stations.values()];
  const ref = method!.after;
  if (!truth(ref) || !truth(method!.site_surface) || !same(method!.size ?? [], size)) return [null, null];
  if (!same([...new Set(method!.role_refs ?? [])].sort(lex), [...new Set(roleRefs)].sort(lex))) return [null, null];
  const peerIndices = scales.flatMap((scale: unknown, index: number) => same(scale, method!.peer_scale) ? [index] : []);
  if (sites.length !== 2 || scales.length !== 2 || peerIndices.length !== 1) return [null, null];
  const peerIndex = peerIndices[0];
  if (!same([...scales].sort(lex), [...(method!.observed_scales ?? [])].sort(lex))) return [null, null];
  const peer = [...sites[peerIndex]], pairId = identity([...sites].sort(lex));
  const residual = peerIndex === 0 ? pair!.quarter_turns : mod(-pair!.quarter_turns, 4);
  const entries: R[] = stations.filter(s => s.site_surface === method!.site_surface).flatMap(s => s.entries ?? []);
  if (entries.some(entry => !truth(entry.peer_preserved))) return [null, null];
  const deltas = new Set(entries.map(entry => entry.delta ?? null));
  if (deltas.size > 1 || deltas.has(0) || deltas.has(null)) return [null, null];
  let witnessed: string[], turn: number, status: string;
  if (entries.length) {
    witnessed = [...new Set(entries.map(entry => entry.after as string))].sort(compareUnicode);
    turn = [...deltas][0]; status = witnessed.length >= 2 ? 'current_repeat' : 'current_witness';
  } else { turn = method!.delta; status = 'revalidated_transfer_hypothesis'; witnessed = [ref]; }
  if (!Number.isSafeInteger(turn) || mod(turn, 4) === 0) return [null, null];
  const orientation = { level_epoch: current.epoch, observation_ref: current.ref, modulus: 4, entry_delta: turn,
    residual, status, evidence: [current.ref, ...witnessed], basis: 'peer_to_mobile_measured_quarter_turns', pair_ref: pairId };
  const commands = new Set(available.filter(item => typeof item === 'string' || !truth(item.data))
    .map(item => typeof item === 'string' ? item : item.action_ref));
  const moves = Object.fromEntries(Object.entries(motions).filter(([cmd, vector]) => commands.has(cmd) && !same(vector, [0, 0]))
    .map(([cmd, vector]) => [cmd, [...vector]]));
  if (!Object.keys(moves).length) return [null, null];
  const vectors = new Set(Object.values(moves).map(key)), opposite = new Set(Object.values(moves).map(([x, y]) => key([-x!, -y!])));
  const guesses: R[] = [];
  for (const vector of [...opposite].filter(v => !vectors.has(v)).map(v => JSON.parse(v) as number[]).sort(lex)) {
    let rivals = [...commands].filter(cmd => !Object.hasOwn(moves, cmd)).sort(compareUnicode);
    if (weakMoves !== undefined && weakMoves !== null) rivals = rivals.filter(cmd => !Object.hasOwn(weakMoves, cmd) || !truth(weakMoves[cmd]) || same(weakMoves[cmd], vector));
    if (rivals.length) guesses.push({ delta: vector, test_commands: rivals, evidence: [current.ref] });
  }
  const possible = [...new Set([...vectors, ...guesses.map(h => key(h.delta))])].map(v => point(JSON.parse(v)));
  const footprint = (at: readonly number[]) => motionFootprint(current.rows, point(at), size);
  const queue = [origin], lattice = new Map([[key(origin), origin]]);
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const [x, y] = queue[cursor]!;
    for (const [dx, dy] of possible) {
      const p: NativePoint = [x + dx, y + dy], encoded = key(p);
      if (!lattice.has(encoded) && footprint(p) !== null) { lattice.set(encoded, p); queue.push(p); }
    }
  }
  const signatures = new Map((observation.entities as R[]).map(e => [key(e.bbox), e.signature]));
  const chargeShapes = new Map<string, string>();
  for (const item of marks) {
    const box = Array.isArray(item) ? item : (item as R).bbox;
    const signature = !Array.isArray(item) && truth((item as R).signature) ? (item as R).signature : signatures.get(key(box));
    if (truth(signature)) chargeShapes.set(key(box), signature);
  }
  const cells = new Map([[key(origin), origin]]), modifiers = new Map<string, R>(), charges = new Map<string, R>();
  const peerCells: number[][] = [], conditionalRim = new Map<string, NativePoint>(), features = new Map<string, R>();
  const decodedSurfaces = [...surfaces].map(s => JSON.parse(s) as number[]), hashes = new Map<string, string>();
  const hash = (patch: readonly number[] | null) => { const encoded = key(patch); if (!hashes.has(encoded)) hashes.set(encoded, identity(patch)); return hashes.get(encoded)!; };
  for (const p of [...lattice.values()].sort(lex)) {
    const patch = footprint(p)!, [x, y] = p, [width, height] = size, center = [2 * x + width - 1, 2 * y + height - 1];
    let atMod = hash(patch) === method!.site_surface;
    const remembered = stations.filter(s => same(s.site ?? [], p) && same(s.size ?? [], size) && s.site_surface === method!.site_surface);
    if (same(p, origin) && remembered.some(s => s.footprint === hash(patch))) atMod = true;
    const atPeer = same(center, [peer[0] + peer[2], peer[1] + peer[3]]);
    const inMarks = [...chargeShapes].map(([encoded, signature]) => [JSON.parse(encoded) as number[], signature] as const)
      .filter(([box]) => same(center, [box[0]! + box[2]!, box[1]! + box[3]!])
        && x <= box[0]! && box[0]! <= box[2]! && box[2]! < x + width && y <= box[1]! && box[1]! <= box[3]! && box[3]! < y + height);
    const colorSite = featureSites?.get(key(p));
    if (truth(colorSite)) { if (atMod || atPeer || inMarks.length) return [null, null]; features.set(colorSite!.id, colorSite!); }
    if (inMarks.length > 1 || atMod && (atPeer || inMarks.length) || atPeer && inMarks.length) return [null, null];
    const outside: number[] = [];
    for (let j = 0; j < height; j++) for (let i = 0; i < width; i++) {
      if (!(peer[0] <= x + i && x + i <= peer[2] && peer[1] <= y + j && y + j <= peer[3])) outside.push(j * width + i);
    }
    const rim = !atPeer && outside.length > 0 && outside.length < width * height && !surfaces.has(key(patch))
      && decodedSurfaces.some(surface => outside.every(i => patch[i] === surface[i]));
    if (rim) conditionalRim.set(key(p), p);
    if (surfaces.has(key(patch)) || atPeer || atMod || inMarks.length || rim || truth(colorSite)) cells.set(key(p), p);
    if (atPeer) peerCells.push([...p]);
    if (atMod) {
      const id = 'modifier:' + identity([current.epoch, p, method!.site_surface]);
      modifiers.set(id, { id, sites: [[...p]], evidence: [current.ref, ...witnessed], status, signature: method!.site_surface });
    }
    for (const [box, signature] of inMarks) {
      const saved = collectionEvidence?.evidence_for(signature) ?? {}, confirmed = [...(saved.confirmed ?? [])], counter = [...(saved.counterexamples ?? [])];
      const id = 'charge:' + identity([current.epoch, box, signature]);
      charges.set(id, { id, sites: [[...p]], bbox: [...box], signature, status: confirmed.length && !counter.length ? 'observed' : 'hypothesis',
        evidence: [current.ref, ...confirmed], counterexamples: counter });
    }
  }
  if (!peerCells.length || !modifiers.size) return [null, null];
  const peerId = 'peer:' + identity([current.epoch, peer, pairId]), bad: R[] = [];
  for (const [encoded, witness] of unresolvedEdges) {
    const [p, _cmd, q, patch] = JSON.parse(encoded);
    if (cells.has(key(p)) && cells.has(key(q)) && same(footprint(q), patch)) bad.push({ from: [...p], to: [...q], evidence: [witness.before, witness.after] });
  }
  const existing = new Set(bad.map(row => key([row.from, row.to])));
  for (const q of [...conditionalRim.values()].sort(lex)) for (const [dx, dy] of possible) {
    const p: NativePoint = [q[0] - dx, q[1] - dy];
    if (cells.has(key(p)) && !existing.has(key([p, q]))) bad.push({ from: [...p], to: [...q], kind: 'partially_occluded_peer_approach', evidence: [current.ref, ref] });
  }
  const layout: R = { level_epoch: current.epoch, observation_ref: current.ref, start: [...origin], cells: [...cells.values()].sort(lex).map(p => [...p]),
    moves, speculative_moves: guesses, modifiers: [...modifiers.values()], charges: [...charges.values()], edge_exclusions: [], uncertain_edges: bad,
    peers: [{ id: peerId, sites: peerCells, status: 'revalidated_shape_correspondence', evidence: [current.ref, ref] }],
    geometry: { size: [...size], role_refs: [...roleRefs], pair_ref: pairId, peer_bbox: peer,
      positions_examined: lattice.size, eligible_positions: cells.size } };
  const pigments = pair!.palette_values ?? [];
  if (pigments.length === 2 && features.size) layout.color_state = { initial: pigments[1 - peerIndex], wanted: pigments[peerIndex],
    mobile_site: pair!.sites[1 - peerIndex], features: [...features.values()] };
  return [layout, orientation];
}

interface SearchOptions { actionBudget: number; maxPrefix?: number; maxStates?: number }
type State = [NativePoint, number, number, string[], any];
type Edge = [string | null, NativePoint, R | null, R | null];
/** Exact managed_capacity.search_managed_access; exhausted bounds stay incomplete. */
export function searchManagedAccess(layout: R, meter: R | null, orientation: R | null,
  { actionBudget, maxPrefix = 16, maxStates = 100000 }: SearchOptions): R {
  const bound = [layout.level_epoch, layout.observation_ref];
  const empty = { status: 'abstained', options: [], release_authority: false, observation_ref: bound[1], level_epoch: bound[0] };
  const abstain = (reason: string): R => ({ ...empty, reason });
  if (!truth(bound[1]) || !truth(meter) || !truth(orientation)
    || !same([orientation!.level_epoch ?? null, orientation!.observation_ref ?? null], bound)
    || !same([Object.hasOwn(meter!, 'level_epoch') ? meter!.level_epoch : bound[0], meter!.observation_ref ?? null], bound)) return abstain('unbound_or_stale_measurements');
  if (!truth(orientation!.evidence) || !['current_repeat', 'current_witness', 'revalidated_transfer_hypothesis'].includes(orientation!.status)) return abstain('no_current_orientation_effect_hypothesis');
  const { modulus, residual, entry_delta: turn } = orientation!, fuel = meter!.steps_before_empty, capacity = meter!.capacity_steps;
  if (![fuel, capacity, modulus, residual, turn, actionBudget, maxPrefix, maxStates].every(Number.isSafeInteger)
    || !(0 <= fuel && fuel <= capacity && 0 <= residual && residual < modulus) || modulus < 2 || mod(turn, modulus) === 0
    || actionBudget < 1 || maxPrefix < 1 || maxPrefix > 16 || maxStates < 1) return abstain('invalid_finite_domain');
  const start = point(layout.start), cells = new Map<string, NativePoint>((layout.cells as unknown[]).map(value => { const p = point(value); return [key(p), p]; }));
  if (!cells.has(key(start))) return abstain('participant_not_bound');
  function occurrences(group: string): Map<string, R> {
    const records: R[] = layout[group] ?? [];
    if (records.some(row => !truth(row.evidence) || !truth(row.sites))) throw new TypeError('Occurrence requires a current site and evidence');
    const result = new Map(records.map(row => [row.id, row]));
    if (records.length !== result.size) throw new TypeError('Duplicate occurrence identities');
    return result;
  }
  const mods = occurrences('modifiers'), peers = occurrences('peers'), charges = occurrences('charges');
  if ([...charges.values()].some(c => !['hypothesis', 'observed', 'consumed'].includes(c.status))) throw new TypeError('Unqualified charge status');
  if (!mods.size || !peers.size) return abstain('missing_current_goal_or_modifier');
  function membership(records: ReadonlyMap<string, R>): Map<string, Set<string>> {
    const result = new Map<string, Set<string>>();
    for (const [id, row] of records) for (const value of row.sites) {
      const p = key(point(value)); if (!cells.has(p)) throw new TypeError('Effect site outside the projected motion graph');
      if (!result.has(p)) result.set(p, new Set()); result.get(p)!.add(id);
    }
    return result;
  }
  const rot = membership(mods), targets = membership(peers), usable = new Map([...charges].filter(([, row]) => row.status !== 'consumed')), supply = membership(usable);
  const palette = layout.color_state, initialColor = truth(palette) ? palette.initial : null, wantedColor = truth(palette) ? palette.wanted : null;
  const colorSites = new Map<string, R>();
  for (const site of truth(palette) ? palette.features as R[] : []) for (const xy of site.sites) {
    const p = key(point(xy));
    if (!cells.has(p) || rot.has(p) || supply.has(p) || targets.has(p) || colorSites.has(p)) return abstain('ambiguous_palette_site');
    colorSites.set(p, site);
  }
  if ([...rot.values(), ...supply.values()].some(ids => ids.size > 1) || [...rot.keys()].some(p => supply.has(p))) return abstain('ambiguous_effect_site');
  if (usable.size > 12) return abstain('charge_occurrence_inventory_too_large');
  const excluded = new Set((layout.edge_exclusions ?? []).map((edge: R) => key([point(edge.from), point(edge.to)])));
  const uncertain = new Map<string, R>((layout.uncertain_edges ?? []).map((edge: R) => [key([point(edge.from), point(edge.to)]), edge]));
  type Move = [string | null, NativePoint, R | null];
  const known: Move[] = Object.entries(layout.moves as R).sort(([a], [b]) => compareUnicode(a, b)).map(([cmd, delta]) => [cmd, point(delta), null]);
  if (!known.length || known.some(([, vector]) => same(vector, [0, 0]))) return abstain('no_bound_translation');
  const predictions: Move[] = [];
  for (const hypothesis of layout.speculative_moves ?? []) {
    const vector = point(hypothesis.delta), rivals = [...new Set(hypothesis.test_commands as string[])].filter(cmd => !Object.hasOwn(layout.moves, cmd)).sort(compareUnicode);
    if (!truth(hypothesis.evidence) || !rivals.length || known.some(([, delta]) => same(delta, vector))) continue;
    if (!known.some(([, delta]) => same(delta, [-vector[0], -vector[1]]))) continue;
    predictions.push([null, vector, { ...hypothesis, test_commands: rivals }]);
  }
  const modes = [known, ...predictions.map(h => [...known, h])], counters: Record<string, number> = {}, options = new Map<string, R>();
  let examined = 0, truncated = false;
  const count = (reason: string): void => { counters[reason] = (counters[reason] ?? 0) + 1; };
  for (const mode of modes) {
    const edges = new Map<string, Edge[]>();
    for (const p of [...cells.values()].sort(lex)) {
      const outgoing: Edge[] = []; edges.set(key(p), outgoing);
      for (const [cmd, vector, hypothesis] of mode) {
        const dest: NativePoint = [p[0] + vector[0], p[1] + vector[1]], edgeKey = key([p, dest]);
        if (cells.has(key(dest)) && !excluded.has(edgeKey)) outgoing.push([cmd, dest, hypothesis, uncertain.get(edgeKey) ?? null]);
      }
    }
    const initial: State = [start, residual, fuel, [], initialColor];
    const parents = new Map<string, [State, R] | null>([[key(initial), null]]), best = new Map([[key([start, residual, [], initialColor]), fuel]]);
    const queue: [State, number][] = [[initial, 0]], matches = new Map<string, { peer: string; order: string[]; value: [number, number, State, R] }>();
    for (let cursor = 0; cursor < queue.length; cursor++) {
      const [state, depth] = queue[cursor]!;
      if (examined >= maxStates) { truncated = true; break; } examined++;
      const [pos, beforeTurn, remaining, used, currentColor] = state;
      if (remaining <= 0) { count('meter_empty'); continue; }
      if (depth >= actionBudget) { count('action_budget'); continue; }
      for (const [cmd, dest, hypothesis, adverse] of edges.get(key(pos))!) {
        let afterTurn = beforeTurn, balance = remaining - 1, consumed = used, nextColor = currentColor;
        const modifier = difference(rot.get(key(dest)), rot.get(key(pos)))[0] ?? null;
        let charge = difference(supply.get(key(dest)), supply.get(key(pos)))[0] ?? null;
        if (truth(modifier)) afterTurn = mod(beforeTurn + turn, modulus);
        if (charge !== null && used.includes(charge)) charge = null;
        if (truth(charge)) {
          if (used.length === 2) { count('more_than_two_independent_charges'); continue; }
          consumed = [...used, charge!]; balance = capacity;
        }
        let feature = colorSites.get(key(dest)) ?? null;
        if (feature && colorSites.get(key(pos)) !== feature) {
          const outcomes = new Map<string, any>((feature.effects as R[]).filter(row => same(row.from_color, currentColor) && same(row.mobile_site, palette.mobile_site))
            .map(row => [key(row.to_color), row.to_color]));
          if ((feature.uncertain_sources as any[]).some(value => same(value, currentColor)) || outcomes.size !== 1) { count('unmeasured_palette_entry'); continue; }
          nextColor = [...outcomes.values()][0];
          if (same(currentColor, wantedColor) && !same(nextColor, wantedColor)) { count('would_undo_acquired_color'); continue; }
        } else feature = null;
        const peerHits = difference(targets.get(key(dest)), targets.get(key(pos)));
        if (peerHits.length && (truth(afterTurn) || !same(nextColor, wantedColor))) { count('unaligned_peer_contact'); continue; }
        const nextState: State = [dest, afterTurn, balance, consumed, nextColor];
        const cause: R = { command: cmd, from: [...pos], to: [...dest], remaining_before: remaining, remaining_after: balance,
          orientation_before: beforeTurn, orientation_after: afterTurn };
        if (truth(modifier)) cause.modifier = modifier;
        if (truth(charge)) cause.charge = charge;
        if (truth(palette)) Object.assign(cause, { color_before: currentColor, color_after: nextColor });
        if (feature) cause.feature = feature.id;
        if (truth(hypothesis)) cause.unidentified_control = { predicted_delta: hypothesis!.delta, test_commands: hypothesis!.test_commands, evidence: hypothesis!.evidence };
        if (truth(adverse)) cause.conditional_crossing = adverse;
        if (truth(charge) && truth(palette) && !same(initialColor, wantedColor) && same(currentColor, wantedColor)) {
          const peer = 'recovery/' + charge, encoded = key([peer, consumed]);
          if (!matches.has(encoded)) matches.set(encoded, { peer, order: consumed, value: [depth + 1, balance, state, cause] });
        }
        if (peerHits.length && afterTurn === 0 && same(nextColor, wantedColor)) {
          for (const peer of peerHits.sort(compareUnicode)) {
            const encoded = key([peer, consumed]), prior = matches.get(encoded);
            if (!prior || depth + 1 === prior.value[0] && balance > prior.value[1]) matches.set(encoded, { peer, order: consumed, value: [depth + 1, balance, state, { ...cause, peer }] });
          }
          continue;
        }
        const domainKey = key([dest, afterTurn, consumed, nextColor]);
        if ((best.get(domainKey) ?? -1) >= balance) continue;
        best.set(domainKey, balance); parents.set(key(nextState), [state, cause]); queue.push([nextState, depth + 1]);
      }
    }
    for (const { peer, order, value } of matches.values()) {
      const [_depth, balance, lastState, final] = value, reversed = [final]; let state = lastState;
      while (parents.get(key(state))) { const prior = parents.get(key(state))!; state = prior[0]; reversed.push(prior[1]); }
      const path = reversed.reverse(), speculative = path.some(step => Object.hasOwn(step, 'unidentified_control'));
      const encoded = key([peer, order, speculative ? mode.at(-1)![1] : null]);
      if (options.has(encoded)) continue;
      const prefix: R[] = [];
      for (const step of path.slice(0, maxPrefix)) {
        prefix.push({ ...step });
        if (['unidentified_control', 'conditional_crossing', 'charge', 'modifier', 'feature', 'peer'].some(k => Object.hasOwn(step, k))) break;
      }
      const end = prefix.at(-1)!;
      let first: string;
      if (Object.hasOwn(end, 'unidentified_control')) { first = 'discriminate_opposite_control'; end.test_command = end.unidentified_control.test_commands[0]; }
      else if (Object.hasOwn(end, 'conditional_crossing')) first = 'revalidate_conditional_crossing';
      else if (Object.hasOwn(end, 'charge')) first = 'test_or_collect_capacity';
      else if (Object.hasOwn(end, 'modifier')) first = 'test_or_rearm_orientation';
      else if (Object.hasOwn(end, 'feature')) first = 'test_observed_palette_entry';
      else if (Object.hasOwn(end, 'peer')) first = 'test_aligned_peer';
      else first = 'advance_to_intermediate_access';
      const goalIndex = path.findIndex(step => ['modifier', 'charge', 'peer', 'feature'].some(k => Object.hasOwn(step, k)));
      const goalStep = goalIndex < 0 ? path.length - 1 : goalIndex, nextGoal = path[goalStep]!;
      const obligation = { ...Object.fromEntries(['modifier', 'charge', 'peer', 'feature', 'to'].filter(k => Object.hasOwn(nextGoal, k)).map(k => [k, nextGoal[k]])), steps_to_obligation: goalStep + 1 };
      const recovery = peer.startsWith('recovery/');
      options.set(encoded, { peer: recovery ? null : peer, recovery: recovery ? peer.slice(9) : null,
        objective: recovery ? 'feature_then_recovery' : 'aligned_peer', charge_order: [...order], primitive_count: path.length,
        remaining_at_peer: recovery ? null : balance, remaining_at_goal: balance, next_composition: obligation,
        first_obligation: first, prefix, conditional_path: path, speculative_control_required: speculative,
        hypotheses: { charge_roles: Object.fromEntries(order.map(id => [id, usable.get(id)!.status])), entry_effect: orientation!.status,
          capacity: Object.hasOwn(meter!, 'capacity_status') ? meter!.capacity_status : 'conditional',
          peer: recovery ? null : Object.hasOwn(peers.get(peer)!, 'status') ? peers.get(peer)!.status : 'hypothesis' },
        falsifiers: ['wrong_translation', 'gain_or_consumption_absent', 'rotation_or_preserved_peer_differs', 'capacity_projection_diverges', 'unaligned_or_unconfirmed_boundary'],
        release_authority: false });
    }
    if (truncated) break;
  }
  const ids = [...usable.keys()].sort(compareUnicode), orders: string[][] = [[], ...ids.map(id => [id]), ...ids.flatMap(a => ids.filter(b => b !== a).map(b => [a, b]))];
  const variants = new Set([...options.values()].map(option => key(option.charge_order)));
  return { ...empty, status: options.size ? 'conditional_options' : truncated ? 'search_incomplete' : 'no_complete_conditional_route',
    search_complete: !truncated, states: examined, pruning: counters, orders_without_witness: orders.filter(order => !variants.has(key(order))),
    options: [...options.values()].sort((a, b) => lex([a.objective !== 'aligned_peer', a.primitive_count, a.speculative_control_required, a.peer || '', a.charge_order],
      [b.objective !== 'aligned_peer', b.primitive_count, b.speculative_control_required, b.peer || '', b.charge_order])) };
}
