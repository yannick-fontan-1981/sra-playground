import {
  equalPose,
  poseKey,
  vector,
  type GroupPose,
  type RelativeModel,
} from "./relative-motion-learning.ts";

export type ContactTest = {
  capacity: "cross_a_site_while_displacing_a_line";
  commonCommand: string;
  preparedAt: number;
  comparisonAt: number;
  comparisonPreparation: string[];
  selectedPreparation: string[];
  changedSite: number;
  expectedPiecesMoved: number;
  comparisonPiecesMoved: number;
  gainedSites: number;
  cellTowardGoal: number;
  previouslyObservedLength: number;
  evidence: string;
  freeWalkEvidence: string;
  verifiedUse?: string;
};
export type ContactStep = { op: string; next: GroupPose; test?: ContactTest };
type Motor = [string, number];
type SearchNode = {
  pose: GroupPose;
  parent?: SearchNode;
  steps: ContactStep[];
  depth: number;
  priority: number;
};

function accessible(
  actor: number,
  pieces: Set<number>,
  floor: Int8Array,
  motors: Motor[],
) {
  const parents = new Map<number, { from: number; op: string }>();
  const queue = [actor];
  parents.set(actor, { from: actor, op: "" });
  for (const cell of queue)
    for (const [op, d] of motors) {
      const next = cell + d;
      if (floor[next] === 1 && !pieces.has(next) && !parents.has(next)) {
        queue.push(next);
        parents.set(next, { from: cell, op });
      }
    }
  return parents;
}
function approach(
  parents: ReturnType<typeof accessible>,
  end: number,
  pieces: number[],
): ContactStep[] {
  const steps: ContactStep[] = [];
  for (let cell = end; ; ) {
    const edge = parents.get(cell)!;
    if (edge.from === cell) return steps.reverse();
    steps.push({ op: edge.op, next: { actor: cell, pieces } });
    cell = edge.from;
  }
}
function distance(m: RelativeModel, a: number, b: number) {
  const [x, y] = vector(m, a, b);
  return Math.abs(x) + Math.abs(y);
}
function reconstruct(n: SearchNode, end: ContactStep[]) {
  const parts = [end];
  for (let node: SearchNode | undefined = n; node; node = node.parent)
    parts.push(node.steps);
  return parts.reverse().flat();
}

// Compare the same command from two preparations reachable without touching
// a piece. Bound search by changes to the arrangement, including walk costs.
export function projectContactPreparation(
  m: RelativeModel,
  origin: GroupPose,
  goals: Set<number>,
  motors: Motor[],
  cells: Int8Array,
  budget: { remaining: number },
  maxDepth: number,
) {
  const contact = m.contact;
  if (
    !contact?.first ||
    !contact.freeWalk ||
    contact.contradicted ||
    !motors.length
  )
    return null;
  const near = (p: number) =>
    Math.min(...[...goals].map((g) => distance(m, p, g)));
  const frontier: SearchNode[] = [
    { pose: origin, steps: [], depth: 0, priority: 0 },
  ];
  const best = new Map<string, number>();
  let examined = 0;
  while (frontier.length && budget.remaining > 0) {
    let selected = 0;
    for (let i = 1; i < frontier.length; i++)
      if (frontier[i]!.priority < frontier[selected]!.priority) selected = i;
    const n = frontier.splice(selected, 1)[0]!,
      pieces = new Set(n.pose.pieces);
    const reach = accessible(n.pose.actor, pieces, cells, motors);
    const region = Math.min(...reach.keys()),
      key = [region, ...n.pose.pieces].join();
    if ((best.get(key) ?? Infinity) <= n.depth) continue;
    best.set(key, n.depth);
    examined++;
    budget.remaining--;
    for (const goal of goals)
      if (reach.has(goal)) {
        if (!n.parent) return null;
        const end = approach(reach, goal, n.pose.pieces);
        if (n.depth + end.length <= maxDepth)
          return { steps: reconstruct(n, end), examined, goal };
      }
    for (const at of reach.keys())
      for (const [op, d] of motors) {
        const first = at + d;
        if (!pieces.has(first)) continue;
        let end = first,
          length = 0;
        while (pieces.has(end)) {
          end += d;
          length++;
        }
        if (cells[end] !== 1) continue;
        const pose = {
          actor: first,
          pieces: n.pose.pieces
            .filter((p) => p !== first)
            .concat(end)
            .sort((a, b) => a - b),
        };
        const known =
          m.measured[poseKey({ actor: at, pieces: n.pose.pieces }) + "/" + op];
        if (known && !equalPose(known, pose)) continue;
        const path = approach(reach, at, n.pose.pieces),
          depth = n.depth + path.length + 1;
        if (depth > maxDepth) continue;
        const after = accessible(first, new Set(pose.pieces), cells, motors);
        if (
          (best.get([Math.min(...after.keys()), ...pose.pieces].join()) ??
            Infinity) <= depth
        )
          continue;
        const opened = [...after.keys()].filter((p) => !reach.has(p));
        const progressCell = [...after.keys()].reduce((a, b) =>
          near(a) <= near(b) ? a : b,
        );
        // The alternative holds the same arrangement fixed and uses the same
        // motor from a reachable stance with a free cell in front.
        const alternate = [...reach.keys()].find(
          (p) => p !== at && reach.has(p + d),
        );
        if (alternate === undefined) continue;
        const test: ContactTest = {
          capacity: "cross_a_site_while_displacing_a_line",
          commonCommand: op,
          preparedAt: at,
          comparisonAt: alternate,
          selectedPreparation: path.map((s) => s.op),
          comparisonPreparation: approach(reach, alternate, n.pose.pieces).map(
            (s) => s.op,
          ),
          changedSite: first,
          expectedPiecesMoved: length,
          comparisonPiecesMoved: 0,
          gainedSites: opened.length,
          cellTowardGoal: progressCell,
          previouslyObservedLength: contact.longest,
          evidence: contact.first,
          freeWalkEvidence: contact.freeWalk,
        };
        const priority = depth + 4 * near(progressCell);
        frontier.push({
          pose,
          parent: n,
          steps: [...path, { op, next: pose, test }],
          depth,
          priority,
        });
      }
  }
  return null;
}
