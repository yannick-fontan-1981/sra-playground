/**
 * Supported acquisition closure of the original ObservedCompositionConstraint.
 *
 * The source calls the inherited record chain before record_packet. At this
 * migration stage that chain contains occurrence recall and the unconditional
 * coupled-pair epoch anchor. Other providers, pair evidence and pair planning
 * remain pending. The retained digest describes this native closure, not the
 * original full ObservedCompositionConstraint inheritance chain.
 */
import { OccurrenceRecallAccess, OccurrenceRecallConstraint, asNativeOccurrenceRecallFamily } from './v6-occurrence-recall.ts';
import type { OccurrenceRecallPolicy } from './v6-occurrence-recall.ts';
import { CoupledPairEpochAnchorMemory } from './v6-coupled-pair-epoch-anchor.ts';
import type { OccurrenceRecord as R } from './v6-occurrence-scene.ts';
import type { NativeFamily, NativeRows } from './v6-native-types.ts';

export const SHARED_SERIES_DIGEST_SCOPE = 'native_recall_ancestors_and_coupled_pair_epoch_anchors_v1';

/** One journal is owned by the already registered public-occurrence provider. */
export class SharedSeriesConstraint extends OccurrenceRecallConstraint {
  anchors = new CoupledPairEpochAnchorMemory();

  override record(before: R, after: R, command: R, first: NativeRows, second: NativeRows,
    proposal: R, index: number, frames: readonly NativeRows[] = []): R {
    const events = this.memory.record(before, command, after, first, second, proposal, index);
    // In the source this precedes the epoch-boundary return, with no geometry,
    // selected-provider, action-success or coupled-plan eligibility condition.
    events.push(...this.anchors.record({ level_epoch: before.level_epoch, levels_completed: before.levels_completed,
      observation_ref: before.observation_ref }, first));
    events.push(...this.memory.recordPacket(before, command, after, first, frames));
    this.events.push(...events);
    return { status: after.levels_completed > before.levels_completed ? 'official_boundary_witness' : 'measured_series_or_insertion_response',
      events, transfer_authority: 'hypothesis_only' };
  }

  override state(): R {
    return { events: structuredClone(this.events), digest: this.anchors.retainedDigest(this.memory.retainedDigest()) };
  }

  override restore(state: R): void {
    if (!Array.isArray(state.events) || typeof state.digest !== 'string') throw new TypeError('Incomplete shared series memory');
    const events = structuredClone(state.events), memory = new OccurrenceRecallAccess(), anchors = new CoupledPairEpochAnchorMemory();
    for (const event of events) {
      if (event.kind === 'coupled_pair_epoch_anchor') anchors.applyEvent(event);
      else memory.applyEvent(event);
    }
    if (anchors.retainedDigest(memory.retainedDigest()) !== state.digest) throw new TypeError('Shared series memory changed during recall');
    // Only publish the reconstructed working copies after the complete journal
    // has passed integrity checks. A rejected edit cannot clear learned state.
    this.memory = memory; this.anchors = anchors; this.events = events;
  }
}

export function createNativeSharedSeriesFamily(config: OccurrenceRecallPolicy): NativeFamily {
  return asNativeOccurrenceRecallFamily(new SharedSeriesConstraint(config));
}
