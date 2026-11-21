"""Bounded offline search for cooperating subjects on disjoint floor regions.

The scene is inferred from public probes. A move is credited only by replaying
the resulting path in the official engine. The search considers one-cell gaps
between regions and supports either subjects or pieces as the marking operands.
"""

import json, sys, heapq, itertools

s = json.load(open(sys.argv[1]))
pitch = s["pitch"]
mode = sys.argv[3] if len(sys.argv) > 3 else "subjects"
stride = 2 + max(
    p[0] // pitch
    for p in s["floor"] + s["liquid"] + s["pieces"] + s["actors"] + s["goals"]
)


def code(p):
    return (p[1] // pitch) * stride + p[0] // pitch


def point(p):
    return [(p % stride) * pitch, (p // stride) * pitch]


def md(p, q):
    return abs(p % stride - q % stride) + abs(p // stride - q // stride)


ops = {int(q): d[0] // pitch + stride * (d[1] // pitch) for q, d in s["dirs"].items()}
A, B = map(code, s["actors"])
tokens = tuple(sorted(map(code, s["pieces"])))
goals = set(map(code, s["goals"]))
holes = set(map(code, s["liquid"]))
floor = set(map(code, s["floor"])) | goals | {A, B} | set(tokens)
initial = (A, B, tokens, tuple(map(code, s["bridges"])), s["active"])
core = set(goals)
q = list(goals)
for p in q:
    for d in ops.values():
        j = p + d
        if j in floor and j not in core:
            core.add(j)
            q.append(j)
cross = [
    (t - d * 2, t - d, t)
    for t in holes
    for d in ops.values()
    if t + d in core and t - d in floor - core and t - 2 * d in floor - core
]
print(
    "one bridge access",
    [(point(p), point(o), point(t)) for p, o, t in cross],
    flush=True,
)
rays = {}
for p in floor | holes:
    for op, d in ops.items():
        a = p + d
        z = []
        while a in floor or a in holes:
            z.append(a)
            a += d
        rays[p, op] = z


def scoring(state):
    a, b, bs, bridges, _ = state
    x, y = sorted(goals)
    if mode == "pieces":
        g = min((md(p, x) + md(q, y) for p in bs for q in bs if p != q), default=50)
    else:
        g = min(md(a, x) + md(b, y), md(a, y) + md(b, x))
    if g == 0:
        return 0
    if any(t in bridges for _, _, t in cross):
        return 2 + g + min(md(a, p) for p in core) * 0.6
    if not bs:
        return 200 + g
    best = min(
        3 * min(md(k, obj) for k in bs)
        + min(md(a, p), md(a, b) + md(b, p))
        + 0.16 * md(b, p)
        for p, obj, t in cross
    )
    return 18 + best + 0.1 * g


def edges(st):
    a, b, bs, bridges, active = st
    walk = floor | set(bridges)
    for op, d in ops.items():
        t = a + d
        if t != b:
            if t in bs:
                n = t + d
                if n != b and n not in bs:
                    if n in walk:
                        yield (
                            (t, b, tuple(sorted((set(bs) - {t}) | {n})), bridges, 0),
                            (0, op),
                        )
                    elif n in holes and any(n == h for _, _, h in cross):
                        yield (
                            (
                                t,
                                b,
                                tuple(x for x in bs if x != t),
                                tuple(sorted((*bridges, n))),
                                0,
                            ),
                            (0, op),
                        )
            elif t in walk:
                yield (t, b, bs, bridges, 0), (0, op)
        hit = next((v for v in rays[b, op] if v == a or v in bs), None)
        if hit == a:
            yield (b, a, bs, bridges, 1), (1, op)
        elif hit is not None:
            yield (a, hit, tuple(sorted((set(bs) - {hit}) | {b})), bridges, 1), (1, op)
        elif b + d in walk:
            yield (a, b + d, bs, bridges, 1), (1, op)


parents = {initial: None}
cost = {initial: 0}
seq = itertools.count()
pq = [(scoring(initial), 0, next(seq), initial)]
best = 100
limit = 500000
while pq and len(parents) < limit:
    _, dist, _, st = heapq.heappop(pq)
    if dist != cost[st]:
        continue
    score = scoring(st)
    if score < best:
        best = score
    if score == 0:
        break
    for end, act in edges(st):
        n = dist + 1 + (act[0] != st[4])
        old = cost.get(end)
        if old is not None and n >= old:
            continue
        parents[end] = (st, act)
        cost[end] = n
        heapq.heappush(pq, (n + 4.5 * scoring(end), n, next(seq), end))
else:
    print("no plan", len(parents), best)
    sys.exit(2)


def short(st):
    return {
        "a": point(st[0]),
        "b": point(st[1]),
        "boxes": list(map(point, st[2])),
        "bridges": list(map(point, st[3])),
        "active": st[4],
    }


path = []
while parents[st]:
    prev, act = parents[st]
    path.append(
        {"before": short(prev), "side": act[0], "op": act[1], "after": short(st)}
    )
    st = prev
path.reverse()
json.dump(path, open(sys.argv[2], "w"))
print(
    "plan",
    len(path),
    len(parents),
    "cost",
    cost[next(st for st in cost if scoring(st) == 0)],
)
