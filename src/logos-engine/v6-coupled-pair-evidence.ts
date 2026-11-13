/**
 * CoupledPairAccess acquisition closure from the unchanged pinned V6.
 * This transfers record, the outcome check that record uses, event reduction
 * and reconstruction. It does not create coupled-pair proposals or routes.
 * Other ancestors and auxiliary producers retain their separate coverage.
 */
import { symbolicDigest as identity } from './v6-hash.ts';
import { retainNativeJson } from './v6-native-owned.ts';
import { pythonEqual as equal, pythonTruthy as truth } from './v6-operations.ts';
import { coupledPairEpochAnchor } from './v6-coupled-pair-epoch-anchor.ts';
import { measureCoupledPairs, matchCoupledPair } from './v6-coupled-pair-observation.ts';
import type { CoupledPairBox } from './v6-coupled-pair-observation.ts';
import type { NativeRows } from './v6-native-types.ts';

type R = Record<string, any>;
export interface CoupledPairEvidenceState {
  readonly pair_state: R | null;
  readonly pair_events: readonly R[];
  readonly pair_initials: Readonly<Record<string, R>>;
}

function pixels(box: CoupledPairBox): [number, number][] {
  const result: [number, number][] = [];
  for (let row = box[0]; row <= box[2]; row++) for (let column = box[1]; column <= box[3]; column++) result.push([row, column]);
  return result;
}
const key = (row: number, column: number): string => `${row},${column}`;
function pixel(rows: NativeRows, row: number, column: number): number {
  const value = rows.at(row)?.at(column);
  if (value === undefined) throw new RangeError('Coupled-pair observation index is outside its public frame');
  return value;
}
function present(rows: NativeRows, box: CoupledPairBox, value: number): boolean {
  return pixels(box).every(([row, column]) => pixel(rows, row, column) === value);
}

/** The pair-plan branch of source after(); no ancestral fallback is implied. */
export function coupledPairAfter(proposal: R, index: number, rows: NativeRows, later: NativeRows,
  meta: { epoch: number; score: number; state: string }): R {
  const plan = proposal.pair_access_plan;
  if (!truth(plan)) throw new TypeError('Coupled-pair outcome requires a pair_access_plan');
  if (!equal([meta.epoch, meta.score], [plan.epoch, plan.score]) || ['WIN', 'GAME_OVER'].includes(meta.state)) {
    return { matched: null, seal_prefix: true, reason: 'official_boundary_or_terminal' };
  }
  const before: CoupledPairBox[] = index === 0 ? plan.pair.boxes : plan.expected[index - 1], after: CoupledPairBox[] = plan.expected[index];
  const allowed = new Set([...before, ...after].flatMap(box => pixels(box).map(([row, column]) => key(row, column))));
  let extra = 0;
  for (let row = 1; row < rows.length - 1; row++) for (let column = 1; column < rows[0]!.length - 1; column++) {
    if (!allowed.has(key(row, column)) && pixel(rows, row, column) !== pixel(later, row, column)) extra++;
  }
  const matched = after.every(box => present(later, box, plan.pair.value)) && extra === 0;
  return { matched, seal_prefix: !matched, reason: matched ? 'conditional_joint_displacement' : 'joint_displacement_or_extra_effect_diverged',
    extra_effect_count: extra };
}

/** The journal, latest pair state and epoch map are one source-owned layer. */
export class CoupledPairEvidenceMemory {
  private pairState: R | null = null;
  private pairEvents: R[] = [];
  private pairInitials = new Map<string, R>();
  private version = 0;

  /** Public reducers/restores invalidate the owner's native checkpoint too. */
  get nativeRevision(): number { return this.version; }

  applyEvent(event: R): void {
    const owned = retainNativeJson(event);
    if (owned.kind === 'coupled_pair_epoch_anchor') {
      if (!Object.hasOwn(owned, 'epoch')) throw new TypeError('Epoch anchor lacks its epoch');
      this.version++; this.pairInitials.set(String(owned.epoch), owned);
    } else if (owned.kind === 'coupled_pair_evidence') {
      if (!Object.hasOwn(owned, 'state')) throw new TypeError('Coupled-pair evidence lacks its state');
      this.version++; this.pairState = owned.state;
    } else throw new TypeError(`Outside coupled-pair acquisition closure: ${String(owned.kind)}`);
    // record() already copies its current state before changing it. The retained
    // event and its state can therefore share one validated immutable tree.
    this.pairEvents.push(owned);
  }

  record(before: R, command: R, after: R, rows: NativeRows, later: NativeRows, proposal: R, index: number): R[] {
    const events: R[] = [];
    if (!this.pairInitials.has(String(before.level_epoch))) {
      const event = coupledPairEpochAnchor({ level_epoch: before.level_epoch, levels_completed: before.levels_completed,
        observation_ref: before.observation_ref }, rows);
      this.applyEvent(event); events.push(event);
    }
    if (before.level_epoch !== after.level_epoch) return events;

    const beforePairs = measureCoupledPairs(rows), afterPairs = measureCoupledPairs(later);
    let state = structuredClone(this.pairState);
    const hasPlan = truth(proposal.pair_access_plan);
    if (truth(state) && state!.epoch === before.level_epoch && hasPlan) {
      const outcome = coupledPairAfter(proposal, index, rows, later,
        { epoch: after.level_epoch, score: after.levels_completed, state: after.state });
      if (outcome.matched === false) {
        const anchor = this.pairInitials.get(String(before.level_epoch))!;
        state!.refused.push(proposal.pair_access_plan.trial);
        state!.unresolved = {
          kind: 'joint_projection_refuted', evidence: [before.observation_ref, after.observation_ref],
          whole_scene_initial_equal: identity(later) === anchor.frame_digest,
          interior_initial_equal: identity(later.slice(1, -1).map(row => row.slice(1, -1))) === anchor.interior_digest,
          initial_observation_ref: anchor.observation_ref,
          scope: 'No teleport/reset law or arbitrary member reassignment. Exact full-scene return and interior-only return remain distinct; supplied collision projection is unavailable pending a discriminating causal question.',
        };
        const event = { kind: 'coupled_pair_evidence', state, evidence: state!.unresolved.evidence };
        this.applyEvent(event); events.push(event); return events;
      }
    }

    if (!truth(state) || state!.epoch !== before.level_epoch) {
      const candidates = beforePairs.filter(pair => afterPairs.some(next => {
        if (next.value !== pair.value || next.size !== pair.size) return false;
        const match = matchCoupledPair(pair, next);
        return match !== null && match.deltas.some(delta => delta.some(value => value !== 0));
      }));
      if (candidates.length !== 1) return events;
      state = { epoch: before.level_epoch, pair: structuredClone(candidates[0]!), samples: {}, floors: [], evidence: [], refused: [] };
    }
    const retained = state!, pair = retained.pair;
    const candidates = afterPairs.filter(next => next.value === pair.value && next.size === pair.size);
    if (candidates.length !== 1) return events;
    const match = matchCoupledPair(pair, candidates[0]!);
    if (!match) return events;

    const refs = [before.observation_ref, after.observation_ref], sample = { deltas: match.deltas, evidence: refs };
    const samples: R[] = retained.samples[command.action_ref] ??= [];
    if (!samples.some(existing => equal(existing, sample))) samples.push(sample);
    const occupied = new Set(match.boxes.flatMap(box => pixels(box).map(([row, column]) => key(row, column))));
    for (let member = 0; member < Math.min(pair.boxes.length, match.boxes.length); member++) {
      const old = pair.boxes[member], next = match.boxes[member]!;
      if (!equal(old, next)) {
        const revealed = new Set(pixels(old).filter(([row, column]) => !occupied.has(key(row, column)))
          .map(([row, column]) => pixel(later, row, column)));
        if (revealed.size === 1) {
          const floor = [...revealed][0]!;
          if (!retained.floors.includes(floor)) retained.floors.push(floor);
        }
      }
    }
    retained.pair.boxes = match.boxes; retained.evidence.push(...refs);
    if (hasPlan) {
      const outcome = coupledPairAfter(proposal, index, rows, later,
        { epoch: after.level_epoch, score: after.levels_completed, state: after.state });
      if (outcome.matched === false) retained.refused.push(proposal.pair_access_plan.trial);
    }
    const event = { kind: 'coupled_pair_evidence', state: retained, evidence: refs };
    this.applyEvent(event); events.push(event); return events;
  }

  state(): CoupledPairEvidenceState {
    // Public projection fields were independently owned in the source port.
    // Do not expose the internal sharing as aliases inside a mutable snapshot.
    return { pair_state: structuredClone(this.pairState), pair_events: structuredClone(this.pairEvents),
      pair_initials: structuredClone(Object.fromEntries(this.pairInitials)) };
  }
  /** Planning reads the current measured model without copying old journal entries. */
  currentState(): R | null { return structuredClone(this.pairState); }
  retainedDigest(parentDigest: string): string {
    return identity([parentDigest, this.pairState, this.pairEvents, Object.fromEntries(this.pairInitials)]);
  }
  restore(state: CoupledPairEvidenceState): void {
    if (!state || !Object.hasOwn(state, 'pair_state') || !Array.isArray(state.pair_events)
      || !state.pair_initials || typeof state.pair_initials !== 'object' || Array.isArray(state.pair_initials)) {
      throw new TypeError('Incomplete coupled-pair acquisition memory');
    }
    const rebuilt = new CoupledPairEvidenceMemory();
    for (const event of state.pair_events) rebuilt.applyEvent(event);
    if (identity(rebuilt.state()) !== identity(state)) throw new TypeError('Coupled-pair state differs from its complete event journal');
    this.pairState = rebuilt.pairState; this.pairEvents = rebuilt.pairEvents; this.pairInitials = rebuilt.pairInitials;
    this.version++;
  }
}
