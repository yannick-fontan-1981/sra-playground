import type { NativeBox, NativeObservation, NativeRows } from '../logos-engine/v6-native-types.ts';
import type { Experiment } from './preparation-experiments.ts';
import { visualLayout } from './witnessed-preview-transfer.ts';
import { mechanismWalkStance } from './reconfigure-local-mechanism.ts';
import { bindWalkingSeries, type WalkingStep } from './verified-walking-series.ts';
import { maximumCommittedActions } from './plan-step.ts';

function box(centre: readonly number[], pitch: readonly number[]): NativeBox {
  const x = Math.ceil((centre[0]! - pitch[0]! / 2) / 2),
    y = Math.ceil((centre[1]! - pitch[1]! / 2) / 2);
  return [x, y, x + pitch[0]! / 2 - 1, y + pitch[1]! / 2 - 1];
}
// An oriented sprite can lose one side of its silhouette. Align its
// centre to cell edges witnessed on other full-size components.
function mechanismTile(o: NativeObservation, pitch: readonly number[]) {
  const w = pitch[0]! / 2,
    h = pitch[1]! / 2,
    votes = new Map<string, number>();
  if (!Number.isInteger(w) || !Number.isInteger(h)) return null;
  for (const {
    bbox: [l, t, r, b],
  } of o.entities) {
    if (r - l + 1 !== w || b - t + 1 !== h) continue;
    const key = [l % w, t % h].join(',');
    votes.set(key, (votes.get(key) ?? 0) + 1);
  }
  const [first, next] = [...votes].sort((a, b) => b[1] - a[1]);
  if (!first || first[1] === (next?.[1] ?? 0)) return null;
  const [x, y] = first[0].split(',').map(Number);
  return (p: readonly number[]): NativeBox => {
    const l = x! + w * Math.round((p[0]! / 2 - (w - 1) / 2 - x!) / w),
      t = y! + h * Math.round((p[1]! / 2 - (h - 1) / 2 - y!) / h);
    return [l, t, l + w - 1, t + h - 1];
  };
}
export function preparedWalk(x: Experiment, o: NativeObservation, rows: NativeRows, remaining: number) {
  const path: WalkingStep[] = [],
    count = Math.min(remaining, maximumCommittedActions);
  const t = x.contactProject,
    m = x.mechanism;
  if (t && !t.acquired) {
    const tile = (id: number) =>
      box(
        [t.origin[0] + (id % t.width) * t.pitch[0], t.origin[1] + Math.floor(id / t.width) * t.pitch[1]],
        t.pitch,
      );
    for (const s of t.project.steps.slice(0, count)) {
      if (s.role || s.boundary || s.op === t.transform || s.from === s.to) break;
      path.push({ command: { action_ref: s.op, data: {} }, from: tile(s.from), to: tile(s.to) });
    }
  } else if (m?.plan.pitch) {
    const tile = mechanismTile(o, m.plan.pitch);
    if (!tile) return undefined;
    for (const s of m.plan.steps.slice(m.index, m.index + count)) {
      if (s.stage !== 'move' || m.plan.controlEvidence?.some((c) => c.op === s.op && c.basis === 'untested'))
        break;
      path.push({ command: { action_ref: s.op, data: {} }, from: tile(s.p), to: tile(s.to) });
    }
  }
  const series = bindWalkingSeries(path, rows, remaining);
  return series && preparedStance(x, 0, o, rows, false) ? series : undefined;
}
export function preparedStance(
  x: Experiment,
  index: number,
  o: NativeObservation,
  rows: NativeRows,
  arrived: boolean,
) {
  const m = x.mechanism;
  if (m) return mechanismWalkStance(m, index, o, rows, arrived);
  const t = x.contactProject,
    s = t?.project.steps[index];
  if (!t || !s) return false;
  const l = visualLayout(o, rows);
  const cells = (role: string) =>
    (l[role] ?? []).map(
      (v) =>
        Math.round((v.at[0] - t.origin[0]) / t.pitch[0]) +
        t.width * Math.round((v.at[1] - t.origin[1]) / t.pitch[1]),
    );
  const actors = cells(t.actor);
  return actors.length === 1 && actors[0] === (arrived ? s.to : s.from);
}

// Acquisition receives the actual step, including its remaining project and
// fresh binding, even when several commands were committed by one decision.
export function preparedExperimentAt(x: Experiment, index: number, b: NativeObservation): Experiment {
  if (index === 0) return x;
  if (x.mechanism) {
    const m = x.mechanism,
      at = m.index + index,
      op = m.plan.steps[at]!.op;
    return { ...x, a: op, b: op, mechanism: { ...m, index: at } };
  }
  const t = x.contactProject!,
    steps = t.project.steps.slice(index),
    step = steps[0]!;
  const relay = t.relay
    ? {
        ...t.relay,
        expected: b.frame_hash,
        plan: { ...t.relay.plan, steps: t.relay.plan.steps.slice(index) },
      }
    : undefined;
  return {
    ...x,
    a: step.op,
    b: step.op,
    contactProject: {
      ...t,
      ref: b.observation_ref,
      step,
      project: { ...t.project, steps },
      ...(relay ? { relay } : {}),
    },
  };
}
