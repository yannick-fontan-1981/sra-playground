import type { NativeObservation } from "../logos-engine/v6-native-types.ts";
import { add, diff, size } from "./access-terrain.ts";
import { spatialControls } from "./calibrate-spatial-controls.ts";
import type {
  PreviewLearning,
  VisualLayout,
} from "./witnessed-preview-transfer.ts";
import type { Edge, Experiment, Memory } from "./preparation-experiments.ts";

export type CueProducer = { before: string; after: string; command: string };
type BlockedCue = { from: string; to: string; frame: string };
export type CueSearchMemory = {
  preceding?: CueProducer & { appeared: string[] };
  blocked: Record<string, BlockedCue[]>;
  seeking?: string;
};
export type CueTest = {
  binding: string;
  actor: string;
  indicator: string;
  operation: string;
  producer: CueProducer;
  blocked: BlockedCue[];
  target: number;
  probe: string;
  routing: boolean;
  evidence: string[];
};
const directional = (op: string) => /^ACTION[1-4]$/.test(op);

// A public step created a missing mark. A subsequent operation actually took the
// named actor to it. Keep the preparation with the witnessed binding across levels.
export function observeCueCondition(
  learn: PreviewLearning,
  b: NativeObservation,
  a: NativeObservation,
  before: VisualLayout,
  after: VisualLayout,
  op: string,
) {
  const memory = (learn.cueSearch ??= { blocked: {} });
  const previous = memory.preceding;
  if (previous?.after === b.observation_ref)
    for (const binding of Object.values(learn.bindings)) {
      const witness = binding.witnesses.at(-1);
      if (
        witness?.after === a.observation_ref &&
        witness.before === b.observation_ref &&
        op !== previous.command &&
        before[binding.actor]?.length === 1 &&
        previous.appeared.includes(binding.indicator)
      ) {
        binding.producer = {
          command: previous.command,
          before: previous.before,
          after: previous.after,
        };
      }
    }
  delete memory.preceding;
  if (directional(op) && a.frame_hash !== b.frame_hash) {
    const appeared = Object.keys(after).filter((role) => !before[role]?.length);
    if (appeared.length)
      memory.preceding = {
        before: b.observation_ref,
        after: a.observation_ref,
        command: op,
        appeared,
      };
  }
  if (b.frame_hash !== a.frame_hash) return;
  for (const [key, binding] of Object.entries(learn.bindings)) {
    if (
      !binding.producer ||
      binding.gesture.point ||
      binding.gesture.op !== op ||
      !binding.witnesses.every((w) => w.epoch !== b.level_epoch) ||
      before[binding.actor]?.length !== 1 ||
      before[binding.indicator]?.length
    )
      continue;
    const failed = (memory.blocked[key] ??= []);
    if (failed.length < 2 && !failed.some((v) => v.frame === b.frame_hash))
      failed.push({
        frame: b.frame_hash,
        from: b.observation_ref,
        to: a.observation_ref,
      });
    if (failed.length === 2 && !memory.seeking) memory.seeking = key;
  }
}

export function searchForMissingCue(
  m: Memory,
  scene: number,
  o: NativeObservation,
  layout: VisualLayout,
  available: Set<string>,
  routes: Map<number, { first: Edge | null; length: number }>,
): Experiment | null {
  const learn = m.previewLearning,
    memory = learn?.cueSearch,
    key = memory?.seeking;
  if (!key || !learn || !memory) return null;
  const binding = learn.bindings[key],
    producer = binding?.producer;
  if (
    !binding ||
    !producer ||
    layout[binding.actor]?.length !== 1 ||
    layout[binding.indicator]?.length ||
    !available.has(binding.gesture.op)
  )
    return null;
  const tried = new Map<number, Set<string>>();
  for (const edge of m.edges) {
    const set = tried.get(edge.s) ?? new Set<string>();
    set.add(edge.cmd);
    tried.set(edge.s, set);
  }
  const moves = [...available]
    .filter(directional)
    .sort(
      (l, r) => Number(r === producer.command) - Number(l === producer.command),
    );
  const here = layout[binding.actor]![0]!.at,
    motion = learn.partMotion?.[binding.actor];
  const contacts = (learn.terminal ?? [])
    .filter((w) => w.actor === binding.actor)
    .flatMap((w) =>
      (layout[w.marker] ?? []).map((site) => diff(site.at, w.offset)),
    );
  const motors =
    motion && contacts.length
      ? spatialControls(motion, available, "", {}, o.frame_hash, binding.actor)
          ?.motors
      : undefined;
  const improvement = (id: string) => {
    const measured = motors?.find(
      (s) => s.op === id && s.basis === "observed" && s.support > 0,
    );
    if (!measured) return 0;
    const gap = (p: typeof here) =>
      Math.min(...contacts.map((site) => size(diff(p, site))));
    return gap(here) - gap(add(here, measured.d));
  };
  const localOrder = motors
    ? [...moves].sort((l, r) => improvement(r) - improvement(l))
    : moves;
  for (const [target, route] of routes) {
    if (route.first && !available.has(route.first.cmd)) continue;
    const probe = (target === scene ? localOrder : moves).find(
      (id) => !tried.get(target)?.has(id),
    );
    if (!probe) continue;
    const op = route.first?.cmd ?? probe,
      blocked = memory.blocked[key] ?? [],
      last = binding.witnesses.at(-1)!;
    const cue: CueTest = {
      binding: key,
      actor: binding.actor,
      indicator: binding.indicator,
      operation: binding.gesture.op,
      producer,
      blocked,
      target,
      probe,
      routing: !!route.first,
      evidence: [
        last.before,
        last.after,
        producer.before,
        producer.after,
        ...blocked.flatMap((v) => [v.from, v.to]),
      ],
    };
    return {
      phase: "seekMissingCue",
      origin: scene,
      a: op,
      b: op,
      refs: [],
      rule: "seek_the_missing_cue_after_the_witnessed_operation_failed_in_distinct_positions",
      cue,
    };
  }
  return null;
}
