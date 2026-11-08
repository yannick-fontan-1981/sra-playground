/**
 * Supported acquisition closure of the original ObservedCompositionConstraint.
 *
 * The source calls the inherited record chain before record_packet. At this
 * migration stage that chain contains occurrence recall, coupled-pair epoch
 * anchors and measured pair-response evidence. Other providers and pair
 * planning remain pending. The retained digest describes this native closure, not the
 * original full ObservedCompositionConstraint inheritance chain.
 */
import { OccurrenceRecallAccess, OccurrenceRecallConstraint, asNativeOccurrenceRecallFamily } from './v6-occurrence-recall.ts';
import type { OccurrenceRecallPolicy } from './v6-occurrence-recall.ts';
import { CoupledPairEvidenceMemory } from './v6-coupled-pair-evidence.ts';
import type { OccurrenceRecord as R } from './v6-occurrence-scene.ts';
import type { NativeFamily, NativeRows } from './v6-native-types.ts';

export const SHARED_SERIES_DIGEST_SCOPE = 'native_recall_ancestors_and_coupled_pair_acquisition_v2';

/** One journal is owned by the already registered public-occurrence provider. */
export class SharedSeriesConstraint extends OccurrenceRecallConstraint {
  pairs = new CoupledPairEvidenceMemory();

  override record(before: R, after: R, command: R, first: NativeRows, second: NativeRows,
    proposal: R, index: number, frames: readonly NativeRows[] = []): R {
    const events = this.memory.record(before, command, after, first, second, proposal, index);
    // The source pair layer first acquires the before-epoch anchor, then its
    // measured response evidence. Packet observation follows the whole chain.
    events.push(...this.pairs.record(before, command, after, first, second, proposal, index));
    events.push(...this.memory.recordPacket(before, command, after, first, frames));
    this.events.push(...events);
    return { status: after.levels_completed > before.levels_completed ? 'official_boundary_witness' : 'measured_series_or_insertion_response',
      events, transfer_authority: 'hypothesis_only' };
  }

  override state(): R {
    return { events: structuredClone(this.events), digest: this.pairs.retainedDigest(this.memory.retainedDigest()) };
  }

  override restore(state: R): void {
    if (!Array.isArray(state.events) || typeof state.digest !== 'string') throw new TypeError('Incomplete shared series memory');
    const events = structuredClone(state.events), memory = new OccurrenceRecallAccess(), pairs = new CoupledPairEvidenceMemory();
    for (const event of events) {
      if (event.kind === 'coupled_pair_epoch_anchor' || event.kind === 'coupled_pair_evidence') pairs.applyEvent(event);
      else memory.applyEvent(event);
    }
    if (pairs.retainedDigest(memory.retainedDigest()) !== state.digest) throw new TypeError('Shared series memory changed during recall');
    // Only publish the reconstructed working copies after the complete journal
    // has passed integrity checks. A rejected edit cannot clear learned state.
    this.memory = memory; this.pairs = pairs; this.events = events;
  }
}

export function createNativeSharedSeriesFamily(config: OccurrenceRecallPolicy): NativeFamily {
  return asNativeOccurrenceRecallFamily(new SharedSeriesConstraint(config));
}
