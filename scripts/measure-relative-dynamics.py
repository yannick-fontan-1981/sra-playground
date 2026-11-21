"""Offline tests of relations between a subject and other moving pieces.
The runtime never imports this program or its graph. The split uses distinct
physical arrangements so repeated images of a training pose stay together.
"""
import argparse
import collections
import hashlib
import json
import math
from pathlib import Path


def read(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def evaluate(graph, receipt):
    poses = graph["projections"]
    edges = graph["edges"]
    root = poses[graph["initial"]]
    witness = next(
        x["terminalContact"]["trial"]["witness"]
        for x in receipt["preparation"]
        if x.get("terminalContact")
    )
    actor, pitch = witness["actor"], witness["pitch"][0]
    assert all(len(surface.get(actor, [])) == 1 for surface in poses.values())

    def phase(role):
        return [
            collections.Counter(
                p[axis] % pitch for state in poses.values() for p in state.get(role, [])
            ).most_common(1)[0][0]
            for axis in range(2)
        ]

    def sites(surface, role, lattice):
        return tuple(
            sorted(
                tuple(math.floor((v - d) / pitch + 0.5) for v, d in zip(point, lattice))
                for point in surface.get(role, [])
            )
        )

    carrier = phase(actor)
    candidates = [
        role
        for role, members in root.items()
        if role != actor
        and 1 <= len(members) <= 8
        and all(len(s.get(role, [])) == len(members) for s in poses.values())
    ]
    outputs = []
    for role in candidates:
        lattice = phase(role)
        states = {
            h: (sites(s, actor, carrier)[0], sites(s, role, lattice))
            for h, s in poses.items()
        }
        if any(p in pieces for p, pieces in states.values()):
            continue
        transitions = [
            (states[e["from"]], e["id"], states[e["to"]])
            for e in edges
            if 1 <= e["id"] <= 4 and e["to"] in poses
        ]
        if not any(pieces != out for (_, pieces), _, (_, out) in transitions):
            continue

        def fold(pose):
            return hashlib.sha256(repr(pose).encode()).digest()[0] % 3

        train = [e for e in transitions if fold(e[0]) != 0]
        test = [e for e in transitions if fold(e[0]) == 0]
        moveCounts = collections.defaultdict(collections.Counter)
        free = set()
        for (p, bs), action, (q, ts) in train:
            free.update([p, *bs, q, *ts])
            delta = (q[0] - p[0], q[1] - p[1])
            if sum(map(abs, delta)) == 1:
                moveCounts[action][delta] += 1
        dirs = {op: c.most_common(1)[0][0] for op, c in moveCounts.items()}
        if not dirs:
            continue

        def length(v, metric):
            return max(map(abs, v)) if metric == "square" else sum(map(abs, v))

        def distance(p, q, metric):
            return length((p[0] - q[0], p[1] - q[1]), metric)

        plus = lambda p, d: (p[0] + d[0], p[1] + d[1])

        def predict(s, action, law):
            p, bs = s
            if action not in dirs:
                return s
            d = dirs[action]
            n = plus(p, d)
            current = set(bs)
            for b in sorted(bs, key=lambda xy: -sum(x * y for x, y in zip(xy, d))):
                q = plus(b, d)
                if law[0] != "global" and distance(p, b, law[0]) > law[1]:
                    continue
                if q in free and q not in current:
                    current.remove(b)
                    current.add(q)
            return (n, tuple(sorted(current))) if n in free and n not in current else s

        laws = [("global", 0)]
        for metric in ("square", "diamond"):
            laws.extend(
                (metric, r)
                for r in sorted(
                    {distance(p, b, metric) for (p, bs), _, _ in train for b in bs}
                )
            )

        def agreement(records, law):
            return sum(predict(s, op, law) == q for s, op, q in records)

        law = max(laws, key=lambda candidate: agreement(train, candidate))
        distinct = collections.defaultdict(set)
        coarse = collections.defaultdict(set)
        for s, op, q in transitions:
            distinct[s, op].add(q)
            coarse[s[0], op].add(q[0])
        start = states[graph["initial"]]
        goalSites = (
            {sites(root, witness["marker"], carrier)[0]}
            if len(root.get(witness["marker"], [])) == 1
            else set()
        )
        winRecord = next((e for e in edges if e["won"]), None)
        if winRecord and winRecord["id"] in dirs:
            final = plus(states[winRecord["from"]][0], dirs[winRecord["id"]])
            goalMatches = final in goalSites
        else:
            goalMatches = False
        bareBlocks = {
            plus(p, dirs[op])
            for (p, bs), op, (q, ts) in train
            if op in dirs and p == q and plus(p, dirs[op]) not in bs
        }
        verifiedWalls = bareBlocks - free
        # Traverse observed physical edges subject to counterfactual restrictions.
        # The visited set uses full images. Unknown views are included in the report.
        outgoing = collections.defaultdict(list)
        for e in edges:
            outgoing[e["from"]].append(e)

        def bounded(mode):
            queue = collections.deque([(graph["initial"], 0)])
            seen = {graph["initial"]}
            unexpanded = set()
            while queue:
                h, depth = queue.popleft()
                if h not in outgoing:
                    unexpanded.add(h)
                    continue
                for e in outgoing[h]:
                    if e["id"] not in dirs:
                        continue
                    s = states[h]
                    p, bs = s
                    d = dirs[e["id"]]
                    z = states.get(e["to"])
                    if z is None and not e["won"]:
                        unexpanded.add(e["to"])
                        continue
                    z = z if z is not None else predict(s, e["id"], law)
                    if (
                        mode == "rigid"
                        and z[0] != p
                        and tuple(sorted(plus(b, d) for b in bs)) != z[1]
                    ):
                        continue
                    if mode == "without_terrain_arrest" and z[0] != p:
                        if any(
                            plus(b, d) in verifiedWalls
                            and b in z[1]
                            and (law[0] == "global" or distance(p, b, law[0]) <= law[1])
                            for b in bs
                        ):
                            continue
                    if mode == "without_wall_arrest" and z[0] != p:
                        simultaneously = tuple(
                            sorted(
                                plus(b, d)
                                if law[0] == "global"
                                or distance(p, b, law[0]) <= law[1]
                                else b
                                for b in bs
                            )
                        )
                        if simultaneously != z[1]:
                            continue
                    if e["won"]:
                        return {
                            "depth": depth + 1,
                            "visited": len(seen),
                            "unexpanded": len(unexpanded),
                        }
                    if e["to"] not in seen:
                        seen.add(e["to"])
                        queue.append((e["to"], depth + 1))
            return {"depth": None, "visited": len(seen), "unexpanded": len(unexpanded)}

        outputs.append(
            dict(
                members=len(start[1]),
                arrangements=len(set(states.values())),
                actorSites=len({p for p, _ in states.values()}),
                ambiguousSubjectControls=sum(len(v) > 1 for v in coarse.values()),
                observedTransitions=len(distinct),
                ambiguousJointControls=sum(len(v) > 1 for v in distinct.values()),
                law=law,
                train=[agreement(train, law), len(train)],
                heldOut=[agreement(test, law), len(test)],
                globalHeldOut=[agreement(test, ("global", 0)), len(test)],
                goalMatches=goalMatches,
                search={
                    mode: bounded(mode)
                    for mode in (
                        "unrestricted",
                        "rigid",
                        "without_wall_arrest",
                        "without_terrain_arrest",
                    )
                },
            )
        )
    return outputs


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    for name in ["graph", "receipt", "output"]:
        parser.add_argument(name)
    args = parser.parse_args()
    result = evaluate(read(args.graph), read(args.receipt))
    Path(args.output).write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(
        [
            (x["members"], x["law"], x["heldOut"], x["globalHeldOut"], x["search"])
            for x in result
        ]
    )
