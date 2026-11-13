/**
 * Pure V5 piercing kernel consumed by V6 rooted_line_plan.
 * Literal non-staged subgraph of piercing_plan.py and piercing_rooted_order.py,
 * pinned at 786dcf51ca57773d8e3a8948ce9ea3655e7baf8e. Geometry, support laws,
 * command effects and bounds are supplied inputs; overlap never proves support.
 *
 * The only search extension is the optional native interruption budget. It
 * produces an explicit bound.native_interruption and an open, truncated search.
 * Staged profiles/continuations are rejected rather than silently approximated.
 */
import { compareUnicode } from './canonical.ts';
import { symbolicDigest } from './v6-hash.ts';
import { normalizePiercingConfiguration, normalizePiercingCommandEffect, normalizePiercingConditionalModel,
  normalizePiercingRod, normalizePiercingPiece, normalizePiercingStepInput, normalizePiercingSearchInput,
  piercingObject, piercingArray, piercingRef, piercingInteger } from './v5-piercing-contracts.ts';
import type { PiercingRecord as R, Position, RefPair, PiercingConfiguration, PiercingRodState,
  PiercingCommandEffect, PiercingConditionalModel, PiercingStepInput } from './v5-piercing-contracts.ts';
export { normalizePiercingConfiguration, normalizePiercingCommandEffect, normalizePiercingConditionalModel };
export type { PiercingConfiguration, PiercingCommandEffect, PiercingConditionalModel };

export interface PiercingNativeBudget {
  deadlineMs?: number;
  now?: () => number;
  shouldStop?: () => boolean;
}
const nativeInterruption = Symbol('native piercing interruption');
class WorkBudget {
  interrupted = false;
  private readonly budget?: PiercingNativeBudget;
  constructor(budget?: PiercingNativeBudget) {
    this.budget = budget;
    if (budget?.deadlineMs !== undefined && typeof budget.deadlineMs !== 'number') throw new TypeError('Invalid native piercing deadline');
    if (Number.isNaN(budget?.deadlineMs)) throw new TypeError('Invalid native piercing deadline');
  }
  stopped(): boolean {
    if (this.interrupted) return true;
    if (!this.budget) return false;
    const { shouldStop, deadlineMs, now } = this.budget;
    this.interrupted = !!shouldStop?.() || (deadlineMs !== undefined && (now ?? (() => performance.now()))() >= deadlineMs);
    return this.interrupted;
  }
  check(): void { if (this.stopped()) throw nativeInterruption; }
}
function tupleCompare(a: any, b: any): number {
  if (Array.isArray(a) && Array.isArray(b)) {
    for (let i = 0; i < Math.min(a.length, b.length); i++) { const c = tupleCompare(a[i], b[i]); if (c) return c; }
    return a.length - b.length;
  }
  return typeof a === 'string' ? compareUnicode(a, b) : a < b ? -1 : a > b ? 1 : 0;
}
const sorted = <T>(values: Iterable<T>): T[] => [...values].sort(tupleCompare);
const positionKey = (p: Position): string => JSON.stringify(p);
const pairKey = (p: RefPair): string => JSON.stringify(p);
const positionSet = (p: Position[]): Set<string> => new Set(p.map(positionKey));
const pairSet = (p: RefPair[]): Set<string> => new Set(p.map(pairKey));
const sortedPairs = (p: Iterable<string>): RefPair[] => sorted([...p].map(k => JSON.parse(k) as RefPair));
const sortedPositions = (p: Iterable<string>): Position[] => sorted([...p].map(k => JSON.parse(k) as Position));
const hasOverlap = (positions: Position[], mask: Set<string>): boolean => positions.some(p => mask.has(positionKey(p)));
const overlap = (a: Position[], b: Position[]): boolean => hasOverlap(a, positionSet(b));
const translated = (positions: Position[], delta: Position): Position[] => positions.map(([r, c]) => [piercingInteger(r + delta[0]), piercingInteger(c + delta[1])]);
const rodMask = (rod: PiercingRodState): Position[] => rod.rod_footprint_positions ?? rod.root_to_tip_positions;
const translateRod = (rod: PiercingRodState, delta: Position): PiercingRodState => ({ ...rod,
  root_to_tip_positions: translated(rod.root_to_tip_positions, delta),
  rod_footprint_positions: rod.rod_footprint_positions === null ? null : translated(rod.rod_footprint_positions, delta) });
const project = (position: Position, axis: Position): number => position[0] * axis[0] + position[1] * axis[1];
const nonzero = (p: Position): boolean => p[0] !== 0 || p[1] !== 0;
function supportPairs(configuration: PiercingConfiguration): Set<string> {
  return pairSet(configuration.pieces.flatMap(p => p.support_refs.map(r => [r, p.piece_ref] as RefPair)));
}
function cost(effects: PiercingCommandEffect[]): [number, number | null] {
  const lower = piercingInteger(effects.reduce((sum, e) => sum + (e.resource_cost ?? 0), 0), 0);
  return [lower, effects.every(e => e.resource_cost !== null) ? lower : null];
}
function physicalKey(c: PiercingConfiguration): string {
  return JSON.stringify([
    sorted(c.rods.map(r => [r.rod_ref, r.root_ref, r.root_to_tip_positions, rodMask(r)])),
    sorted(c.pieces.map(p => [p.piece_ref, p.type_ref, sorted(p.occupied_positions), sorted(p.support_refs)])),
    sorted(c.root_footprints.map(([ref, pos]) => [ref, sorted(pos)])), sorted(c.possible_support_pairs),
    sorted(c.hypothetical_support_pairs), sorted(c.entry_pending_pairs), sorted(c.entry_stopped_pairs),
  ]);
}

function intersections(rods: PiercingRodState[], pieces: PiercingConfiguration['pieces'], root: string, order: string[]): R {
  piercingArray(rods, 1, 16); piercingArray(pieces, 0, 128); piercingArray(order, 0, 128);
  const result: R[] = [], orderedByRod: [string, string[]][] = [];
  const piecesByRef = new Map(pieces.map(p => [p.piece_ref, p]));
  for (const rod of rods) {
    const indexes = new Map<string, number>();
    for (const p of rodMask(rod)) {
      let best = 0, distance = Infinity;
      rod.root_to_tip_positions.forEach((station, index) => {
        const d = Math.abs(p[0] - station[0]) + Math.abs(p[1] - station[1]);
        if (d < distance) { distance = d; best = index; }
      });
      indexes.set(positionKey(p), best);
    }
    const intersected: [number, string][] = [];
    for (const piece of pieces) {
      const mask = positionSet(piece.occupied_positions), positions = rodMask(rod).filter(p => mask.has(positionKey(p)));
      if (!positions.length) continue;
      const first = Math.min(...positions.map(p => indexes.get(positionKey(p))!));
      result.push({ rod_ref: rod.rod_ref, piece_ref: piece.piece_ref, intersection_positions: positions, first_root_index: first });
      intersected.push([first, piece.piece_ref]);
    }
    orderedByRod.push([rod.rod_ref, sorted(intersected).map(([, ref]) => ref)]);
  }
  const requestedRod = rods.find(r => r.root_ref === root);
  const requestedRefs = (orderedByRod.find(([r]) => requestedRod && r === requestedRod.rod_ref)?.[1] ?? [])
    .filter(ref => requestedRod && piecesByRef.get(ref)!.support_refs.includes(requestedRod.rod_ref));
  const requestedTypes = requestedRefs.map(ref => piecesByRef.get(ref)!.type_ref), constrained = new Set(requestedRefs);
  return { intersections: result, ordered_piece_refs_by_rod: orderedByRod, requested_support_ref: requestedRod?.rod_ref ?? null,
    requested_support_piece_refs: requestedRefs, requested_support_type_order: requestedTypes,
    rooted_match: requestedRod !== undefined && tupleCompare(requestedTypes, order) === 0,
    remaining_unconstrained_piece_refs: pieces.filter(p => !constrained.has(p.piece_ref)).map(p => p.piece_ref),
    schema_version: 'yf_arc3_v5.piercing_intersection_measurements.v1' };
}
export function measurePiercingIntersections(value: unknown): R {
  const v = piercingObject(value, ['rods', 'pieces', 'requested_root_ref', 'requested_type_order', 'schema_version']);
  if (v.schema_version !== undefined) piercingRef(v.schema_version);
  return intersections(piercingArray(v.rods, 1, 16).map(normalizePiercingRod), piercingArray(v.pieces, 0, 128).map(normalizePiercingPiece),
    piercingRef(v.requested_root_ref), piercingArray(v.requested_type_order, 0, 128).map(piercingRef));
}
function goal(configuration: PiercingConfiguration, root: string, order: string[]): R {
  const unresolved = sorted(new Set([...configuration.missing_piece_refs,
    ...configuration.possible_support_pairs.map(([, p]) => p), ...configuration.hypothetical_support_pairs.map(([, p]) => p)]));
  if (!configuration.rods.length) return { requested_root_ref: root, requested_support_ref: null, ordered_piece_refs: [], measured_type_order: [],
    rooted_match: false, predicted_rooted_match: false, coordinate_scope_ref: configuration.coordinate_scope_ref, unresolved_piece_refs: unresolved,
    remaining_piece_refs: sorted(configuration.pieces.map(p => p.piece_ref)), schema_version: 'yf_arc3_v5.piercing_goal_measurements.v1' };
  const measured = intersections(configuration.rods, configuration.pieces, root, order);
  return { requested_root_ref: root, requested_support_ref: measured.requested_support_ref, ordered_piece_refs: measured.requested_support_piece_refs,
    measured_type_order: measured.requested_support_type_order,
    rooted_match: measured.rooted_match && !unresolved.length && !configuration.is_predicted_configuration,
    predicted_rooted_match: measured.rooted_match && !configuration.missing_piece_refs.length && !configuration.possible_support_pairs.length,
    coordinate_scope_ref: configuration.coordinate_scope_ref, unresolved_piece_refs: unresolved,
    remaining_piece_refs: measured.remaining_unconstrained_piece_refs, schema_version: 'yf_arc3_v5.piercing_goal_measurements.v1' };
}
export function measurePiercingGoal(value: unknown): R {
  const v = piercingObject(value, ['configuration', 'requested_root_ref', 'requested_type_order', 'schema_version']);
  if (v.schema_version !== undefined) piercingRef(v.schema_version);
  return goal(normalizePiercingConfiguration(v.configuration), piercingRef(v.requested_root_ref), piercingArray(v.requested_type_order).map(piercingRef));
}

function simulateModel(request: PiercingStepInput, model: PiercingConditionalModel, budget: WorkBudget): R {
  const effect = request.effect;
  let current = { ...request.configuration, is_predicted_configuration: true };
  if (effect.coordinate_scope_ref === 'coordinate.scene_conditioned') current = { ...current, coordinate_scope_ref: effect.coordinate_scope_ref };
  let rods = new Map(current.rods.map(r => [r.rod_ref, r])), rod = rods.get(effect.rod_ref);
  const n = Math.max(Math.abs(effect.root_translation[0]), Math.abs(effect.root_translation[1]), Math.abs(effect.extent_delta));
  const contacts = new Set<string>(), blockers = new Set<string>(), pushed = new Set<string>(), stopped = new Set<string>();
  const traversed = new Set<string>(), pierced = new Set<string>(), unresolved = new Set(current.missing_piece_refs), missing = new Set<string>();
  const intermediate: PiercingConfiguration[] = [];
  if (rod === undefined) { missing.add('premise.commanded_rod_pose'); unresolved.add(effect.rod_ref); }
  else if (rod.root_to_tip_positions.slice(1).some((b, i) => {
    const a = rod!.root_to_tip_positions[i]!; return b[0] - a[0] !== effect.axis_direction[0] || b[1] - a[1] !== effect.axis_direction[1];
  })) { unresolved.add(effect.rod_ref); missing.add('premise.ordered_axial_rod_pose'); }
  if (rod && rod.root_to_tip_positions.length + Math.max(0, effect.extent_delta) > 512) { unresolved.add(effect.rod_ref); missing.add('bound.rod_position_contract'); }
  if (current.domain_positions === null && request.require_finite_domain) missing.add('premise.finite_motion_domain');
  if (rod && !new Map(current.root_footprints).has(rod.root_ref)) missing.add('premise.full_root_footprint');
  if (current.possible_support_pairs.length) {
    const assignments = new Map(model.support_assignments.map(([r, p, mode]) => [pairKey([r, p]), mode]));
    const possiblePairs = pairSet(current.possible_support_pairs);
    const explicitIncomplete = assignments.size > 0 && [...possiblePairs].some(p => !assignments.has(p));
    if (explicitIncomplete || (!assignments.size && model.possible_support_mode === null)) {
      for (const [, p] of current.possible_support_pairs) unresolved.add(p);
      missing.add(explicitIncomplete ? 'premise.complete_possible_support_assignment' : 'premise.supplied_possible_support_hypothesis');
    } else {
      const available = new Set(current.pieces.map(p => p.piece_ref));
      for (const [r, p] of sortedPairs(possiblePairs)) if (!rods.has(r) || !available.has(p)) { unresolved.add(p); missing.add('premise.possible_support_body_pose'); }
      const pieces = current.pieces.map(p => ({ ...p, support_refs: sorted(new Set([...p.support_refs,
        ...sortedPairs(possiblePairs).filter(([r, member]) => member === p.piece_ref &&
          (assignments.size ? assignments.get(pairKey([r, member])) : model.possible_support_mode) === 'carried').map(([r]) => r)])) }));
      current = { ...current, pieces, possible_support_pairs: [], hypothetical_support_pairs: sortedPairs(new Set([...pairSet(current.hypothetical_support_pairs), ...possiblePairs])) };
    }
  }
  for (const piece of current.pieces) if (piece.support_refs.some(r => !rods.has(r))) { unresolved.add(piece.piece_ref); missing.add('premise.support_rod_pose'); }
  const pending = pairSet(current.entry_pending_pairs), stoppedEntries = pairSet(current.entry_stopped_pairs);
  const domain = current.domain_positions === null ? null : positionSet(current.domain_positions);
  const obstacles = new Map(current.obstacles.map(o => [o.obstacle_ref, positionSet(o.occupied_positions)]));
  const movingRodRefs = new Set(current.rods.filter(r => rod && r.root_ref === rod.root_ref).map(r => r.rod_ref));
  for (const other of current.rods) if (!movingRodRefs.has(other.rod_ref)) obstacles.set(other.rod_ref, positionSet(rodMask(other)));
  for (const [rootRef, footprint] of current.root_footprints) if (rod && rootRef !== rod.root_ref) obstacles.set(rootRef, positionSet(footprint));
  const rootDomains = new Map(current.root_admissible_positions.map(([ref, pos]) => [ref, positionSet(pos)]));
  let previousDelta: Position = [0, 0], previousExtent = 0, executed = 0, interrupted = false;
  function outside(positions: Position[]): string[] {
    const result = sorted(obstacles.entries()).filter(([, mask]) => hasOverlap(positions, mask)).map(([ref]) => ref);
    if (domain !== null && positions.some(p => !domain.has(positionKey(p)))) {
      if (current.domain_boundary_is_known) result.push('boundary.supplied_domain');
      else { unresolved.add('boundary.unconfirmed_domain'); missing.add('premise.unknown_domain_exit_outcome'); }
    }
    return result;
  }
  // BigInt preserves the source floor division even for portable translations
  // whose multiplication by the current microstep exceeds Number.MAX_SAFE_INTEGER.
  const cumulative = (value: number, index: number): number => Number(BigInt(Math.abs(value)) * BigInt(index) / BigInt(n)) * (value >= 0 ? 1 : -1);
  try {
    for (let index = 1; index <= Math.min(n, request.max_microsteps); index++) {
      budget.check();
      if (!rod || unresolved.size) break;
      const total: Position = [cumulative(effect.root_translation[0], index), cumulative(effect.root_translation[1], index)];
      const delta: Position = [total[0] - previousDelta[0], total[1] - previousDelta[1]];
      const totalExtent = cumulative(effect.extent_delta, index), extent = totalExtent - previousExtent;
      previousDelta = total; previousExtent = totalExtent;
      const oldRod = rod;
      let positions = translated(rod.root_to_tip_positions, delta), material = translated(rodMask(rod), delta);
      if (extent > 0) {
        const tip = positions.at(-1)!, newTip: Position = [piercingInteger(tip[0] + effect.axis_direction[0]), piercingInteger(tip[1] + effect.axis_direction[1])];
        let offsets = effect.extent_cross_section_offsets;
        if (offsets === null && rodMask(rod).some(p => !positionSet(rod!.root_to_tip_positions).has(positionKey(p)))) {
          unresolved.add(rod.rod_ref); missing.add('premise.source_extent_cross_section'); break;
        }
        offsets ??= [[0, 0]];
        positions = [...positions, newTip];
        material = sortedPositions(new Set([...positionSet(material), ...positionSet(translated(offsets, newTip))]));
      } else if (extent < 0) {
        if (positions.length <= 1) { blockers.add(rod.root_ref); break; }
        positions = positions.slice(0, -1);
        const tipProjection = project(positions.at(-1)!, effect.axis_direction);
        material = material.filter(p => project(p, effect.axis_direction) <= tipProjection);
      }
      const explicitMaterial = rod.rod_footprint_positions !== null || effect.extent_cross_section_offsets !== null;
      const candidateRod: PiercingRodState = { ...rod, root_to_tip_positions: positions, rod_footprint_positions: explicitMaterial ? material : null };
      const candidateRods = new Map(sorted(rods.entries()).map(([ref, r]) => [ref, movingRodRefs.has(ref) ? translateRod(r, delta) : r]));
      candidateRods.set(rod.rod_ref, candidateRod);
      const roots = new Map(current.root_footprints);
      roots.set(rod.root_ref, translated(roots.get(rod.root_ref) ?? [], delta));
      const toolPositions = [...sorted(candidateRods.entries()).flatMap(([ref, r]) => movingRodRefs.has(ref) ? rodMask(r) : []), ...roots.get(rod.root_ref)!];
      const sweptTool = positionSet(toolPositions);
      if (delta[0] && delta[1]) {
        const oldPositions = [...sorted(rods.entries()).flatMap(([ref, r]) => movingRodRefs.has(ref) ? rodMask(r) : []), ...(new Map(current.root_footprints).get(rod.root_ref) ?? [])];
        for (const p of [...translated(oldPositions, [delta[0], 0]), ...translated(oldPositions, [0, delta[1]])]) sweptTool.add(positionKey(p));
      }
      const obstacleHits = outside(sortedPositions(sweptTool)), rootDomain = rootDomains.get(rod.root_ref);
      if (rootDomain && roots.get(rod.root_ref)!.some(p => !rootDomain.has(positionKey(p)))) obstacleHits.push('boundary.supplied_root_domain');
      if (obstacleHits.length) { for (const ref of obstacleHits) blockers.add(ref); break; }
      const pieces = new Map(current.pieces.map(p => [p.piece_ref, p])), candidatePieces = new Map(pieces);
      const attached = new Set(current.pieces.filter(p => p.support_refs.some(r => movingRodRefs.has(r))).map(p => p.piece_ref));
      const movingMasks = new Map<string, Position[]>(), reverseStopped = new Set<string>();
      const withdrawingDelta: Position = [-effect.axis_direction[0] || 0, -effect.axis_direction[1] || 0];
      function movableChain(ref: string, displacement: Position, visiting: Set<string>): boolean {
        budget.check();
        if (visiting.has(ref)) return true;
        const body = pieces.get(ref)!;
        if (!current.movable_piece_refs.includes(ref) || body.support_refs.length) return false;
        const proposed = translated(body.occupied_positions, displacement);
        if (outside(proposed).length) return false;
        visiting.add(ref);
        for (const [other, otherBody] of sorted(pieces.entries())) {
          if (other !== ref && !attached.has(other) && overlap(proposed, otherBody.occupied_positions) && !movableChain(other, displacement, visiting)) {
            visiting.delete(ref); return false;
          }
        }
        visiting.delete(ref); return true;
      }
      for (const ref of sorted(attached)) {
        budget.check();
        const piece = pieces.get(ref)!;
        let carryDelta = delta;
        if (nonzero(delta)) {
          if (model.carry_on_root_translation === null) { unresolved.add(ref); missing.add('premise.carry_on_root_translation'); continue; }
          if (model.carry_on_root_translation === false) carryDelta = [0, 0];
        }
        if (extent < 0 && piece.support_refs.includes(rod.rod_ref)) {
          if (model.retain_on_retraction === null || model.withdraw_requires_reverse_stop === null) { unresolved.add(ref); missing.add('premise.conditional_withdrawal'); continue; }
          if (model.retain_on_retraction) {
            carryDelta = [carryDelta[0] + withdrawingDelta[0], carryDelta[1] + withdrawingDelta[1]];
            const proposed = translated(piece.occupied_positions, carryDelta), fixedHits = outside(proposed);
            const otherHits = sorted(pieces.entries()).some(([other, p]) => other !== ref && !attached.has(other) && overlap(proposed, p.occupied_positions) && !movableChain(other, carryDelta, new Set()));
            if (fixedHits.length || otherHits) {
              if (model.withdraw_requires_reverse_stop) { carryDelta = delta; reverseStopped.add(ref); stopped.add(ref); }
              else for (const hit of fixedHits.length ? fixedHits : [ref]) blockers.add(hit);
            }
          } else if (model.withdraw_requires_reverse_stop) { unresolved.add(ref); missing.add('premise.retention_with_reverse_stop'); }
        }
        if (nonzero(carryDelta) && piece.support_refs.some(r => !movingRodRefs.has(r))) { unresolved.add(ref); missing.add('premise.multiple_support_motion_compatibility'); }
        const newPositions = translated(piece.occupied_positions, carryDelta);
        if (nonzero(carryDelta)) movingMasks.set(ref, newPositions);
        candidatePieces.set(ref, { ...piece, occupied_positions: newPositions });
      }
      if (unresolved.size || blockers.size) break;
      const oldTool = positionSet([...sorted(rods.entries()).flatMap(([ref, r]) => movingRodRefs.has(ref) ? rodMask(r) : []), ...(new Map(current.root_footprints).get(rod.root_ref) ?? [])]);
      const movingUnion = new Set([...positionSet(toolPositions), ...sweptTool].filter(p => !oldTool.has(p)));
      if (nonzero(delta)) for (const p of oldTool) movingUnion.add(p);
      for (const [, mask] of sorted(movingMasks.entries())) for (const p of mask) movingUnion.add(positionKey(p));
      const freeContacts = new Set(sorted(pieces.entries()).filter(([ref, p]) => !attached.has(ref) && hasOverlap(p.occupied_positions, movingUnion)).map(([ref]) => ref));
      for (const ref of freeContacts) contacts.add(ref);
      const motionDelta = nonzero(delta) ? delta : extent > 0 ? effect.axis_direction : withdrawingDelta;
      let pushSet = new Set<string>();
      const penetrate = new Set<string>();
      function collectPush(ref: string, visiting: Set<string>): boolean {
        budget.check();
        if (visiting.has(ref) || pushSet.has(ref)) return true;
        const p = pieces.get(ref)!;
        if (!current.movable_piece_refs.includes(ref) || p.support_refs.length) return false;
        const proposed = translated(p.occupied_positions, motionDelta);
        if (outside(proposed).length) return false;
        visiting.add(ref);
        for (const [other, otherPiece] of sorted(pieces.entries())) {
          if (other === ref) continue;
          if (overlap(proposed, otherPiece.occupied_positions) && (attached.has(other) || !collectPush(other, visiting))) { visiting.delete(ref); return false; }
        }
        visiting.delete(ref); pushSet.add(ref); return true;
      }
      for (const ref of sorted(freeContacts)) {
        budget.check();
        const piece = pieces.get(ref)!;
        let axialEntry = extent > 0 && !nonzero(delta) && material.some(p => hasOverlap([p], positionSet(piece.occupied_positions)) && project(p, effect.axis_direction) === project(positions.at(-1)!, effect.axis_direction));
        const oldTip = project(oldRod.root_to_tip_positions.at(-1)!, effect.axis_direction), face = Math.min(...piece.occupied_positions.map(p => project(p, effect.axis_direction)));
        axialEntry = axialEntry && (oldTip <= face || pending.has(pairKey([rod.rod_ref, ref])));
        if (axialEntry && model.entry_enabled === true && model.entry_requires_stop === false) penetrate.add(ref);
        else {
          if (model.push_enabled === null) { unresolved.add(ref); missing.add('premise.push_enabled'); continue; }
          const priorPushSet = new Set(pushSet), physicallyMovable = collectPush(ref, new Set()), canPush = model.push_enabled && physicallyMovable;
          if (!canPush) {
            pushSet = priorPushSet;
            if (!physicallyMovable) stopped.add(ref);
            if (axialEntry) {
              if (model.entry_enabled === null || model.entry_requires_stop === null) { unresolved.add(ref); missing.add('premise.conditional_axial_entry'); }
              else if (model.entry_enabled && (!model.entry_requires_stop || !physicallyMovable)) {
                penetrate.add(ref); if (!physicallyMovable) stoppedEntries.add(pairKey([rod.rod_ref, ref]));
              } else blockers.add(ref);
            } else blockers.add(ref);
          }
        }
      }
      if (unresolved.size || blockers.size) break;
      for (const ref of sorted(pushSet)) if (!penetrate.has(ref)) candidatePieces.set(ref, { ...pieces.get(ref)!, occupied_positions: translated(pieces.get(ref)!.occupied_positions, motionDelta) });
      for (const ref of sorted(penetrate)) pending.add(pairKey([rod.rod_ref, ref]));
      const newlyTraversed = new Set<string>(), newlyPierced = new Set<string>();
      for (const [rodRef, ref] of sortedPairs(pending)) {
        budget.check();
        if (rodRef !== rod.rod_ref || !candidatePieces.has(ref)) continue;
        const piece = candidatePieces.get(ref)!, farFace = Math.max(...piece.occupied_positions.map(p => project(p, effect.axis_direction)));
        const complete = project(positions.at(-1)!, effect.axis_direction) >= farFace && overlap(material, piece.occupied_positions);
        if (complete) {
          newlyTraversed.add(ref);
          if (model.entry_attaches === null) { unresolved.add(ref); missing.add('premise.entry_attaches'); }
          else if (model.entry_attaches) { candidatePieces.set(ref, { ...piece, support_refs: sorted(new Set([...piece.support_refs, rod.rod_ref])) }); newlyPierced.add(ref); }
          pending.delete(pairKey([rodRef, ref]));
        }
      }
      if (unresolved.size) break;
      for (const ref of sorted(attached)) {
        const piece = candidatePieces.get(ref)!;
        if (piece.support_refs.includes(rod.rod_ref) && !overlap(material, piece.occupied_positions)) {
          const releasePermitted = extent < 0 && ((model.retain_on_retraction === false && model.withdraw_requires_reverse_stop === false) || reverseStopped.has(ref));
          if (releasePermitted) candidatePieces.set(ref, { ...piece, support_refs: piece.support_refs.filter(s => s !== rod!.rod_ref) });
          else { unresolved.add(ref); missing.add('premise.support_exit_law'); }
        }
      }
      if (unresolved.size) break;
      for (const [ref] of sorted(movingMasks.entries())) for (const hit of outside(candidatePieces.get(ref)!.occupied_positions)) blockers.add(hit);
      if (blockers.size) break;
      rods = candidateRods; rod = candidateRod;
      current = { ...current,
        configuration_ref: 'configuration:predicted:' + symbolicDigest({ before_configuration_ref: request.configuration.configuration_ref, effect_ref: effect.effect_ref, model_ref: model.model_ref, microstep: index }),
        rods: sorted(rods.entries()).map(([, r]) => r), pieces: sorted(candidatePieces.entries()).map(([, p]) => p),
        root_footprints: sorted(roots.entries()), entry_pending_pairs: sortedPairs(pending), entry_stopped_pairs: sortedPairs(stoppedEntries) };
      intermediate.push(current);
      for (const ref of pushSet) if (!penetrate.has(ref)) pushed.add(ref);
      for (const ref of newlyTraversed) traversed.add(ref);
      for (const ref of newlyPierced) pierced.add(ref);
      executed++;
    }
  } catch (error) { if (error !== nativeInterruption) throw error; interrupted = true; missing.add('bound.native_interruption'); }
  if (n > request.max_microsteps) missing.add('bound.max_microsteps');
  const before = supportPairs(request.configuration), after = supportPairs(current), [low, high] = cost([effect]);
  const assigned = new Set(model.support_assignments.map(([r, p]) => pairKey([r, p])));
  return { model_ref: model.model_ref, configuration: current, intermediate_configurations: intermediate,
    contacted_piece_refs: sorted(contacts), blocking_refs: sorted(blockers), pushed_piece_refs: sorted(pushed), stopped_piece_refs: sorted(stopped),
    entry_traversal_piece_refs: sorted(traversed), pierced_piece_refs: sorted(pierced),
    retained_support_pairs: sortedPairs([...before].filter(p => after.has(p))), released_support_pairs: sortedPairs([...before].filter(p => !after.has(p))),
    unresolved_refs: sorted(unresolved), missing_premise_refs: sorted(missing),
    hypothesis_coverage_gap_refs: current.hypothetical_support_pairs.length > 1 && current.hypothetical_support_pairs.some(p => !assigned.has(pairKey(p))) ? ['gap.mixed_possible_support_assignments_not_enumerated'] : [],
    completed: !unresolved.size && !missing.size && n <= request.max_microsteps, truncated: n > request.max_microsteps || interrupted,
    executed_microsteps: executed, requested_microsteps: n, require_finite_domain: request.require_finite_domain,
    action_ref: effect.action_ref, resource_cost_lower_bound: low, resource_cost_upper_bound: high };
}
export function simulatePiercingModel(request: unknown, model: unknown, nativeBudget?: PiercingNativeBudget): R {
  return simulateModel(normalizePiercingStepInput(request), normalizePiercingConditionalModel(model), new WorkBudget(nativeBudget));
}

export function searchPiercingPlans(value: unknown, nativeBudget?: PiercingNativeBudget): R {
  const request = normalizePiercingSearchInput(value), budget = new WorkBudget(nativeBudget);
  type Row = [PiercingConditionalModel, PiercingConfiguration, PiercingCommandEffect[], R[]];
  let queue: Row[] = [...request.models].sort((a, b) => compareUnicode(a.model_ref, b.model_ref)).map(m => [m, request.configuration, [], []]);
  const initialKey = physicalKey(request.configuration), visited = new Set(request.models.map(m => JSON.stringify([m.model_ref, initialKey])));
  const plans: R[] = [], witnessPathKeys = new Set<string>(), unresolvedModels = new Set<string>(), openModels = new Set<string>();
  const missing = new Set<string>(), bounds = new Set<string>();
  let expanded = 0, openCount = 0;
  const effects = [...request.effects].sort((a, b) => tupleCompare([a.effect_ref, a.action_ref], [b.effect_ref, b.action_ref]));
  search: while (queue.length && expanded < request.max_nodes) {
    if (budget.stopped()) { bounds.add('bound.native_interruption'); missing.add('bound.native_interruption'); break; }
    const [model, configuration, path, steps] = queue.shift()!;
    expanded++;
    const measuredGoal = goal(configuration, request.goal_requested_root_ref, request.goal_requested_type_order);
    if (measuredGoal.predicted_rooted_match) {
      const pathKey = symbolicDigest(path);
      if (witnessPathKeys.has(pathKey) || witnessPathKeys.size < request.max_plans) {
        witnessPathKeys.add(pathKey);
        const [low, high] = cost(path);
        plans.push({ model_ref: model.model_ref, effects: path, action_refs: path.map(e => e.action_ref), steps, configuration,
          goal: measuredGoal, resource_cost_lower_bound: low, resource_cost_upper_bound: high, search_profile_ref: null, stage_witnesses: [], falsifier_refs: [] });
      } else { bounds.add('bound.max_plans'); openCount++; openModels.add(model.model_ref); }
      queue = queue.filter(row => row[0].model_ref !== model.model_ref);
      continue;
    }
    if (path.length >= request.max_depth) { bounds.add('bound.max_depth'); openCount++; openModels.add(model.model_ref); continue; }
    for (const effect of effects) {
      if (budget.stopped()) { bounds.add('bound.native_interruption'); missing.add('bound.native_interruption'); openCount++; openModels.add(model.model_ref); break search; }
      const step = simulateModel({ configuration, effect, models: [model], max_microsteps: request.max_microsteps, require_finite_domain: true }, model, budget);
      if (step.unresolved_refs.length || step.missing_premise_refs.length || step.truncated) {
        for (const ref of step.missing_premise_refs) missing.add(ref);
        if (step.missing_premise_refs.includes('bound.max_microsteps')) bounds.add('bound.max_microsteps');
        unresolvedModels.add(model.model_ref); openModels.add(model.model_ref); openCount++;
        if (step.missing_premise_refs.includes('bound.native_interruption')) { bounds.add('bound.native_interruption'); break search; }
        continue;
      }
      const key = JSON.stringify([model.model_ref, physicalKey(step.configuration)]);
      if (visited.has(key)) continue;
      visited.add(key); queue.push([model, step.configuration, [...path, effect], [...steps, step]]);
    }
  }
  openCount += queue.length;
  if (queue.length && expanded >= request.max_nodes) bounds.add('bound.max_nodes');
  if (queue.length && plans.length >= request.max_plans) bounds.add('bound.max_plans');
  for (const [model] of queue) openModels.add(model.model_ref);
  return { plans, expanded_node_count: expanded, truncated: !!queue.length || openCount > 0, open_frontier_count: openCount,
    open_frontier_model_refs: sorted(openModels), unresolved_model_refs: sorted(unresolvedModels), model_refs: sorted(request.models.map(m => m.model_ref)),
    missing_premise_refs: sorted(missing), exhausted_bound_refs: sorted(bounds), stage_frontiers: [], rejected_invariant_transition_count: 0,
    continuation: null, continuation_rejected_refs: [], slice_expanded_node_count: 0, schema_version: 'yf_arc3_v5.piercing_plan_search_measurements.v1' };
}
