"""Rank two orders of competing preparations against a supplied use, holding out whole games."""
import argparse
import json
from collections import defaultdict
from pathlib import Path
from statistics import mean


def shape(action):
    if action.startswith("ACTION6:"):
        return "point"
    return (
        "move" if action in {"ACTION1", "ACTION2", "ACTION3", "ACTION4"} else "interact"
    )


def point(action):
    return tuple(map(int, action.split(":")[1].split(",")))


def relations(a, b, use):
    kinds = tuple(map(shape, (a, b, use)))
    repeated = (a == use, b == use)
    if kinds != ("point",) * 3:
        return (kinds, repeated)
    p, q, t = map(point, (a, b, use))
    distance = lambda u, v: abs(u[0] - v[0]) + abs(u[1] - v[1])
    du, dv = distance(p, t), distance(q, t)
    relative = (du > dv) - (du < dv)
    aligned = tuple(u[0] == v[0] or u[1] == v[1] for u, v in ((p, q), (p, t), (q, t)))
    return (kinds, repeated, relative, aligned)


def paired_input(forecasts, outcomes):
    fs = list(map(json.loads, forecasts.read_bytes().splitlines()))
    rs = list(map(json.loads, outcomes.read_bytes().splitlines()))
    for f, r in zip(fs, rs, strict=True):
        if f.get("reason"):
            assert f == r
            continue
        checksum = f.pop("forecastDigest")
        assert (
            checksum == r["forecastDigest"]
        )  # The JS summarizer verifies the original byte representation.
        assert (f["code"], f["level"], f["prefix"]) == (
            r["code"],
            r["level"],
            r["prefix"],
        )
        window = []
        for offer, result in zip(f["offers"], r["results"], strict=True):
            a, b, u = (offer[k] for k in ("a", "b", "use"))
            assert (a, b, u) == tuple(result[k] for k in ("a", "b", "use"))
            for x, y, order in ((a, b, "forward"), (b, a, "reverse")):
                won = result[order]
                window.append(
                    dict(
                        word=(x, y, u),
                        features=relations(x, y, u),
                        effectRank=offer["score"],
                        win=won,
                        necessary=won and result.get("joint", False),
                    )
                )
        if window:
            yield f["code"], window


def per_game_votes(choices, objective):
    """Vote on the excess over this game's own success rate, with one neutral prior example."""
    groups = defaultdict(list)
    base = mean(row[objective] for row in choices)
    for row in choices:
        for depth in range(1, len(row["features"]) + 1):
            groups[row["features"][:depth]].append(row[objective])
    return {
        key: (sum(values) - len(values) * base) / (1 + len(values))
        for key, values in groups.items()
    }


def relational_score(features, others):
    # More detailed relations get a vote only when witnessed in two other games.
    for depth in range(len(features), 0, -1):
        pool = [v[features[:depth]] for v in others if features[:depth] in v]
        if len(pool) >= 2:
            return mean(pool)
    return 0.0


def compare(windows, objective):
    votes = {
        code: per_game_votes(choices, objective) for code, choices in windows.items()
    }
    reports = []
    for code, choices in windows.items():
        others = [v for k, v in votes.items() if k != code]
        scores = [relational_score(row["features"], others) for row in choices]

        def assess(scores):
            top = max(scores)
            best = [row for row, score in zip(choices, scores) if score == top]
            return dict(
                first=bool(best[0][objective]),
                tiedMean=mean(row[objective] for row in best),
                ties=len(best),
            )

        reports.append(
            dict(
                code=code,
                options=len(choices),
                possible=any(row[objective] for row in choices),
                uniform=mean(row[objective] for row in choices),
                geometry=assess(scores),
                effects=assess([row["effectRank"] for row in choices]),
            )
        )
    return dict(
        games=len(reports),
        possible=sum(r["possible"] for r in reports),
        options=sum(r["options"] for r in reports),
        uniform=mean(r["uniform"] for r in reports),
        **{
            k: dict(
                first=sum(r[k]["first"] for r in reports),
                meanTied=mean(r[k]["tiedMean"] for r in reports),
            )
            for k in ("effects", "geometry")
        }
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path)
    parser.add_argument("pairs", nargs="+", type=Path)
    args = parser.parse_args()
    windows = {}
    for f, r in zip(args.pairs[::2], args.pairs[1::2], strict=True):
        for game, w in paired_input(f, r):
            assert game not in windows
            windows[game] = w
    result = {k: compare(windows, k) for k in ("win", "necessary")}
    args.output.write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(json.dumps(result))
