export function findCompositionFrontier<Pose, Action>(options: {
  start: Pose;
  key: (pose: Pose) => string;
  successors: (pose: Pose) => Iterable<{ action: Action; after: Pose }>;
  isComposition: (before: Pose, after: Pose) => boolean;
  depth: number;
  limit: number;
  onLimit?: () => void;
}): { action: Action; after: Pose }[] | undefined {
  type Step = { action: Action; after: Pose };
  type Node = { pose: Pose; depth: number; trail?: { step: Step; previous: Node } };
  const queue: Node[] = [{ pose: options.start, depth: 0 }];
  const seen = new Set([options.key(options.start)]);
  for (let index = 0; index < queue.length && index < options.limit; index++) {
    const node = queue[index]!;
    if (node.depth >= options.depth) {
      options.onLimit?.();
      continue;
    }
    for (const step of options.successors(node.pose)) {
      if (options.isComposition(node.pose, step.after)) {
        const path = [step];
        for (let current = node; current.trail; current = current.trail.previous) path.push(current.trail.step);
        return path.reverse();
      }
      const key = options.key(step.after);
      if (seen.has(key)) continue;
      if (queue.length >= options.limit) {
        options.onLimit?.();
        continue;
      }
      seen.add(key);
      queue.push({ pose: step.after, depth: node.depth + 1, trail: { step, previous: node } });
    }
  }
}
