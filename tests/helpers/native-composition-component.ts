/** Contract fixtures start from a cold component replay of public returns. */
import assert from 'node:assert/strict';
import { SharedSeriesConstraint } from '../../src/logos-engine/v6-shared-series.ts';
import { AttentionMemory } from '../../src/logos-engine/v6-attention-memory.ts';
import { ObservedInputDomain, measureNativeObservation, publicFrameHash } from '../../src/logos-engine/v6-native-observer.ts';
import { commonTypedMaterialProposal } from '../../src/logos-engine/v6-typed-material-access.ts';
import { rotatedTypedMarks } from '../../src/logos-engine/v6-typed-material-observation.ts';
import { retainTypedMaterialParent, consumeTypedMaterialParent, recordTypedMaterialParent } from '../../src/logos-engine/v6-typed-material-composition.ts';
import { copy, materialComponent as probe, materialPolicy as policy, type R } from './native-composition-loop.ts';
import type { NativePublicObservation, NativeRows } from '../../src/logos-engine/v6-native-types.ts';
import type { NativeAuthorityTransition } from '../../src/logos-engine/v6-native-authority.ts';

type Seed = { state: R; packetIndex: number; proposal: R };
let seeds: Promise<Seed[]> | undefined;
export function acquiredPoseSeeds(): Promise<Seed[]> {
  return seeds ??= (async () => {
    const family = new SharedSeriesConstraint(policy.occurrence_recall), result: Seed[] = [];
    let packetIndex = 0;
    for (const prefix of probe.prefixes) {
      const row = probe.packets[packetIndex], domain = new ObservedInputDomain(4096);
      const proposal = await family.materialPropose(row.observation, row.packet.frame_rows, domain.candidates(row.observation), 600, policy.typed_material_flow);
      assert.ok(proposal); assert.deepEqual(proposal.actions, prefix.proposal.actions);
      family.bind(proposal, domain);
      if (proposal.material_pose_plan?.mode === 'select') result.push({ state: copy(family.nativeState()), packetIndex, proposal: copy(proposal) });
      for (const [index, command] of proposal.actions.entries()) {
        const before = probe.packets[packetIndex], after = probe.packets[++packetIndex];
        assert.deepEqual(command, after.command);
        family.record(before.observation, after.observation, copy(command), before.packet.frame_rows, after.packet.frame_rows,
          proposal, index, after.packet.frame_packet);
      }
    }
    assert.equal(result.length, 2); return result;
  })();
}

export async function changedPacket(packet: NativePublicObservation, rows: NativeRows): Promise<NativePublicObservation> {
  return { ...copy(packet), step_index: packet.step_index + 1, frame_rows: copy(rows), frame_packet: [copy(rows)], frame_hash: await publicFrameHash(rows) };
}
export async function rotatedReturn(packet: NativePublicObservation, child: R, turns: number): Promise<NativePublicObservation> {
  const rows = copy(packet.frame_rows) as number[][], [cx, cy] = child.center;
  for (const [, dx, dy] of child.marks) rows[cy + dy]![cx + dx] = child.body_palette;
  for (const [palette, dx, dy] of rotatedTypedMarks(child.marks, turns)) rows[cy + dy]![cx + dx] = palette;
  return changedPacket(packet, rows);
}

export class ComponentParent {
  family: SharedSeriesConstraint;
  attention = new AttentionMemory();
  row!: R;
  proposal!: R;
  records: R[] = [];
  private constructor(family: SharedSeriesConstraint) { this.family = family; }
  static async selected(seedIndex = 0): Promise<ComponentParent> {
    const seed = (await acquiredPoseSeeds())[seedIndex]!;
    const family = new SharedSeriesConstraint(policy.occurrence_recall); family.restoreNative(copy(seed.state));
    const value = new ComponentParent(family); value.row = copy(probe.packets[seed.packetIndex]); value.proposal = copy(seed.proposal);
    const retained = await retainTypedMaterialParent(value.attention, family.material.currentState(), value.proposal, value.row.observation, value.row.packet.frame_rows);
    assert.equal(retained?.admitted, true);
    assert.equal(consumeTypedMaterialParent(value.attention, family.material.currentState(), value.proposal, value.row.observation, value.row.packet.frame_rows)?.admitted, true);
    await value.acquire(copy(probe.packets[seed.packetIndex + 1].packet));
    await value.offer(); return value;
  }
  state(): R { return this.family.material.currentState(); }
  async offer(): Promise<R | null> {
    const domain = new ObservedInputDomain(4096);
    const proposal = await commonTypedMaterialProposal(this.family.material, this.row.observation, this.row.packet.frame_rows,
      domain.candidates(this.row.observation), 600, policy.typed_material_flow, this.attention.composition!.binding);
    if (proposal) {
      this.family.bind(proposal, domain);
      const consumed = consumeTypedMaterialParent(this.attention, this.state(), proposal, this.row.observation, this.row.packet.frame_rows);
      assert.equal(consumed?.admitted, true, consumed?.reason); this.proposal = proposal;
    }
    return proposal;
  }
  async acquire(packet: NativePublicObservation, index = 0): Promise<R | null> {
    const before = this.row, observation = await measureNativeObservation(packet, before.observation.revision + 1, 'lot1-controlled-public-return');
    const transition = { command: copy(this.proposal.actions[index]), before: before.observation, after: observation,
      first: before.packet, second: packet, index,
      outcome: this.family.after(this.proposal, index, before.observation, observation, before.packet.frame_rows, packet.frame_rows) } as NativeAuthorityTransition;
    const record = this.family.record(before.observation, observation, transition.command,
      before.packet.frame_rows, packet.frame_rows, this.proposal, index, packet.frame_packet);
    const returned = recordTypedMaterialParent(this.attention, this.state(), this.proposal, transition, record);
    this.records.push({ transition, record, returned }); this.row = { packet, observation }; return returned;
  }
}
