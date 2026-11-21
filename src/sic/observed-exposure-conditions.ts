import type {
  NativeCommand,
  NativePoint,
} from "../logos-engine/v6-native-types.ts";
import {
  exposureBearing,
  exposureLayout,
  exposureMoves,
  exposureRules,
  observedExposureState,
  type ExposureScene,
  type ExposureState,
} from "./coupled-exposure.ts";

type Sample = {
  before: ExposureState;
  after: ExposureState;
  action: number;
  ref: string;
};
export type ExposureHypothesis = {
  shadow: number;
  lit: number;
  refs: string[];
};
export type ExposureObservations = {
  epoch: number;
  layout: string;
  samples: Sample[];
  directions: Record<string, NativePoint>;
  calibrated?: ExposureHypothesis;
  rejected?: boolean;
};

function samePieces(a: ExposureState, b: ExposureState) {
  return (
    a.pieces.length === b.pieces.length &&
    a.pieces.every((piece) =>
      b.pieces.some(
        (other) => other.cell === piece.cell && other.color === piece.color,
      ),
    )
  );
}

function measuredAction(
  before: ExposureScene,
  after: ExposureScene,
  command: NativeCommand,
  directions: Record<string, NativePoint>,
) {
  if (command.action_ref === "ACTION5") return 4;
  if (command.action_ref === "ACTION6") {
    const dial = after.dial.find((d) => d.active);
    const { x, y } = command.data;
    return dial &&
      x !== undefined &&
      y !== undefined &&
      Math.abs(x - dial.point[0]) < before.pitch / 2 &&
      Math.abs(y - dial.point[1]) < before.pitch / 2
      ? 5 + exposureBearing(dial.vector)
      : -1;
  }
  if (!/^ACTION[1-4]$/.test(command.action_ref)) return -1;
  const delta: NativePoint = [
    after.actor[0] - before.actor[0],
    after.actor[1] - before.actor[1],
  ];
  if (Math.abs(delta[0]) + Math.abs(delta[1]) === 1) {
    const known = directions[command.action_ref];
    if (known && (known[0] !== delta[0] || known[1] !== delta[1])) return -1;
    directions[command.action_ref] = delta;
  }
  const measured = directions[command.action_ref];
  return measured
    ? exposureMoves.findIndex(
        (d) => d[0] === measured[0] && d[1] === measured[1],
      )
    : -1;
}

export function observeExposureConditions(
  old: ExposureObservations | null,
  epoch: number,
  before: ExposureScene,
  after: ExposureScene,
  command: NativeCommand,
  ref: string,
): ExposureObservations | null {
  if (
    before.layout !== after.layout ||
    !before.bodies.length ||
    before.bodies.length > 4 ||
    before.slots.length !== before.bodies.length ||
    before.size[0] * before.size[1] > 144
  )
    return old;
  const memory: ExposureObservations =
    old?.epoch === epoch && old.layout === before.layout
      ? old
      : { epoch, layout: before.layout, samples: [], directions: {} };
  if (memory.rejected) return memory;
  const action = measuredAction(before, after, command, memory.directions);
  if (action < 0) return memory;
  const start = observedExposureState(before),
    end = observedExposureState(after);
  if (start.facing < 0 || end.facing < 0) return memory;
  if (memory.calibrated) {
    const { shadow, lit } = memory.calibrated;
    const model = exposureLayout(before, {
      shadow,
      lit,
      linked: null,
      released: null,
    });
    if (model) {
      const prediction = exposureRules(model[0]).project(start, action);
      if (
        prediction.actor !== end.actor ||
        prediction.facing !== end.facing ||
        !samePieces(prediction, end)
      )
        memory.rejected = true;
    }
    return memory;
  }
  if (
    !memory.samples.some(
      (s) =>
        s.action === action &&
        s.before.actor === start.actor &&
        s.before.facing === start.facing &&
        samePieces(s.before, start) &&
        s.after.actor === end.actor &&
        s.after.facing === end.facing &&
        samePieces(s.after, end),
    )
  ) {
    memory.samples.push({ before: start, after: end, action, ref });
    if (memory.samples.length > 32) memory.samples.shift();
  }
  const colors = [
    ...new Set(
      memory.samples.flatMap((s) =>
        [...s.before.pieces, ...s.after.pieces].map((p) => p.color),
      ),
    ),
  ];
  if (colors.length !== 2 || !Object.keys(memory.directions).length)
    return memory;
  const responses = memory.samples.filter(
    (s) => !samePieces(s.before, s.after),
  );
  if (
    !responses.some((s) =>
      s.before.pieces.some(
        (p) => !s.after.pieces.some((q) => q.color === p.color),
      ),
    ) ||
    !responses.some((s) =>
      s.before.pieces.some(
        (p) => !s.after.pieces.some((q) => q.cell === p.cell),
      ),
    )
  )
    return memory;
  const candidates: ExposureHypothesis[] = [];
  for (const [shadow, lit] of [
    [colors[0]!, colors[1]!],
    [colors[1]!, colors[0]!],
  ] as const) {
    const measured = exposureLayout(after, {
      shadow,
      lit,
      linked: null,
      released: null,
    });
    if (!measured) continue;
    const rules = exposureRules(measured[0]);
    if (
      memory.samples.every((s) => {
        const forecast = rules.project(s.before, s.action);
        return (
          forecast.actor === s.after.actor &&
          forecast.facing === s.after.facing &&
          samePieces(forecast, s.after)
        );
      })
    )
      candidates.push({
        shadow,
        lit,
        refs: [...new Set([responses[0]!.ref, responses.at(-1)!.ref, ref])],
      });
  }
  if (candidates.length === 1) memory.calibrated = candidates[0];
  return memory;
}
