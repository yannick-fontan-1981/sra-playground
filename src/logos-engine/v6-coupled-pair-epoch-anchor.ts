/**
 * The epoch-anchor projection of CoupledPairAccess, source
 * 786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/coupled_pair_access.py.
 *
 * This acquires and replays only coupled_pair_epoch_anchor. It does not
 * implement pair evidence, paired-control planning, or the full inherited
 * ObservedCompositionConstraint digest. A caller supplies its actual parent
 * digest to retain this source layer within an explicitly scoped closure.
 */
import { symbolicDigest } from './v6-hash.ts';
import type { NativeRows } from './v6-native-types.ts';

type R = Record<string, any>;

export interface CoupledPairEpochAnchorObservation {
  readonly level_epoch: number;
  readonly levels_completed: number;
  readonly observation_ref: string;
}

export interface CoupledPairEpochAnchorState {
  readonly pair_state: null;
  readonly pair_events: readonly R[];
  readonly pair_initials: Readonly<Record<string, R>>;
}

export class CoupledPairEpochAnchorMemory {
  private pairEvents: R[] = [];
  private pairInitials = new Map<string, R>();

  /** Source record order: inherited record, this anchor, then record_packet. */
  record(before: CoupledPairEpochAnchorObservation, rows: NativeRows): R[] {
    if (this.pairInitials.has(String(before.level_epoch))) return [];
    const event = {
      kind: 'coupled_pair_epoch_anchor',
      epoch: before.level_epoch,
      score: before.levels_completed,
      observation_ref: before.observation_ref,
      frame_digest: symbolicDigest(rows),
      interior_digest: symbolicDigest(rows.slice(1, -1).map(row => row.slice(1, -1))),
    };
    this.applyEvent(event);
    return [event];
  }

  /** Replay preserves every event, including repeated anchors for one epoch. */
  applyEvent(event: R): void {
    if (event.kind !== 'coupled_pair_epoch_anchor') {
      throw new TypeError(`Outside epoch-anchor closure: ${String(event.kind)}`);
    }
    if (!Object.hasOwn(event, 'epoch')) throw new TypeError('Epoch anchor lacks its epoch');
    // The source takes two independent deep copies. Neither the returned event
    // nor a public checkpoint can mutate the retained journal or initial map.
    const initial = structuredClone(event), retained = structuredClone(event);
    this.pairInitials.set(String(event.epoch), initial);
    this.pairEvents.push(retained);
  }

  state(): CoupledPairEpochAnchorState {
    return structuredClone({
      pair_state: null,
      pair_events: this.pairEvents,
      pair_initials: Object.fromEntries(this.pairInitials),
    });
  }

  /** Exact CoupledPairAccess digest formula for its anchor-only projection. */
  retainedDigest(parentDigest: string): string {
    return symbolicDigest([parentDigest, null, this.pairEvents, Object.fromEntries(this.pairInitials)]);
  }

  /** Build and verify the complete projection before replacing live memory. */
  restore(state: CoupledPairEpochAnchorState): void {
    if (!state || state.pair_state !== null || !Array.isArray(state.pair_events)
      || !state.pair_initials || typeof state.pair_initials !== 'object'
      || Array.isArray(state.pair_initials)) {
      throw new TypeError('Incomplete epoch-anchor memory');
    }
    const rebuilt = new CoupledPairEpochAnchorMemory();
    for (const event of state.pair_events) rebuilt.applyEvent(event);
    if (symbolicDigest(rebuilt.state()) !== symbolicDigest(state)) {
      throw new TypeError('Epoch-anchor initial map differs from its complete event journal');
    }
    this.pairEvents = rebuilt.pairEvents;
    this.pairInitials = rebuilt.pairInitials;
  }
}
