import type { NativeObservation } from "../logos-engine/v6-native-types.ts";
import { diff, same, size, type XY } from "./access-terrain.ts";
import { spatialControls } from "./calibrate-spatial-controls.ts";
import type {
  PreviewLearning,
  VisualLayout,
} from "./witnessed-preview-transfer.ts";

export type SituatedWitness = {
  basis: "positioned_preparation";
  actor: string;
  marker: string;
  offset: XY;
  operation: string;
  support: number;
  before: string;
  after: string;
  stride: number;
  completionRef?: string;
};

// A prior movement identifies a possible actor. The scalar operation leaves
// that actor in place and changes a separately localizable visible feature.
export function observedSituatedOperations(
  learn: PreviewLearning,
  b: NativeObservation,
  a: NativeObservation,
  before: VisualLayout,
  after: VisualLayout,
  op: string,
): SituatedWitness[] {
  if (
    b.frame_hash === a.frame_hash ||
    !/^ACTION\d+$/.test(op) ||
    b.level_epoch !== a.level_epoch ||
    b.levels_completed !== a.levels_completed ||
    b.state !== a.state
  )
    return [];
  const available = new Set(b.available_action_refs);
  const witnesses: SituatedWitness[] = [];
  for (const [actor, motion] of Object.entries(learn.partMotion ?? {})) {
    const p = learn.lastActor[actor];
    if (
      !p ||
      !before[actor]?.some((body) => same(p, body.at)) ||
      !after[actor]?.some((body) => same(p, body.at))
    )
      continue;
    const motor = spatialControls(
      motion,
      available,
      "",
      {},
      b.frame_hash,
      actor,
    );
    if (!motor || motor.motors.some((m) => m.op === op && m.support > 0))
      continue;
    const measured = motor.motors.filter(
      (m) => m.support > 0 && m.basis === "observed",
    );
    if (!measured.length) continue;
    const stride = motor.pitch[0];
    for (const [marker, parts] of Object.entries(before)) {
      if (marker === actor || parts.length > 12) continue;
      for (const part of parts) {
        if (after[marker]?.some((x) => same(x.at, part.at))) continue;
        const offset = diff(part.at, p);
        // An independent landmark occupies a different site on the observed lattice.
        if (size(offset) < stride / 2) continue;
        witnesses.push({
          basis: "positioned_preparation",
          actor,
          marker,
          offset,
          operation: op,
          stride,
          support: measured.reduce((n, m) => n + m.support, 0),
          before: b.observation_ref,
          after: a.observation_ref,
        });
      }
    }
  }
  witnesses.sort(
    (l, r) =>
      size(l.offset) / l.stride - size(r.offset) / r.stride ||
      r.support - l.support,
  );
  return witnesses;
}

export function retainSituatedOperations(
  learn: PreviewLearning,
  rows: SituatedWitness[],
) {
  if (!rows.length) return;
  const byCondition = new Map<string, SituatedWitness>();
  for (const w of [...rows, ...(learn.recentPreparations ?? [])]) {
    const key = JSON.stringify([w.actor, w.marker, w.offset, w.operation]);
    if (!byCondition.has(key)) byCondition.set(key, w);
    if (byCondition.size === 24) break;
  }
  learn.recentPreparations = [...byCondition.values()];
}
