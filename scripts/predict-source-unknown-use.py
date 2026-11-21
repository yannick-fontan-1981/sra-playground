"""Commit three-action forecasts with a free choice of the final command."""
import argparse
import hashlib
import importlib.util
import itertools
import json
import random
from collections import Counter
from pathlib import Path
from statistics import mean

spec = importlib.util.spec_from_file_location(
    "orders", Path(__file__).with_name("rank-source-preparation-orders.py")
)
orders = importlib.util.module_from_spec(spec)
spec.loader.exec_module(orders)


def command(step):
    if step["a"] == 6:
        return f"ACTION6:{step['data']['x']},{step['data']['y']}"
    return f"ACTION{step['a']}"


def use_context(past, use):
    last = past[-1] if past else ""
    context = (
        orders.shape(use),
        orders.shape(last) if last else "start",
        use == last,
        use in past,
    )
    if not (use.startswith("ACTION6:") and last.startswith("ACTION6:")):
        return context
    x, y = orders.point(use)
    u, v = orders.point(last)
    return (*context, x == u or y == v)


def terminal_votes(episode):
    # The question is posed two preparations before the use, in positives and controls alike.
    tape = [command(s) for s in episode["steps"]]
    labels = [use_context(tape[: i - 2], tape[i]) for i in range(2, len(tape))]
    if len(labels) < 2:
        return {}
    votes = {}
    for depth in range(1, max(map(len, labels)) + 1):
        comparisons = Counter(f[:depth] for f in labels[:-1] if len(f) >= depth)
        terminal = labels[-1][:depth]
        for key in {*comparisons, terminal}:
            if len(key) == depth:
                votes[key] = float(key == terminal) - comparisons[key] / (
                    len(labels) - 1
                )
    return votes


def expected_use(features, peers):
    for depth in range(len(features), 0, -1):
        key = features[:depth]
        votes = [v[key] for v in peers if key in v]
        if len(votes) >= 5:
            return mean(votes)
    return 0


def predict(origin, inputs, peers, terminal=None):
    programs = [(a, b, u) for a, b in itertools.permutations(inputs, 2) for u in inputs]
    if not programs:
        return None
    cache = {}

    def score(program):
        features = orders.relations(*program)
        if features not in cache:
            cache[features] = orders.relational_score(features, peers)
        return cache[features]

    rng = random.Random(origin)
    # Shared random ordering removes the arbitrary preference for the first API action.
    rng.shuffle(programs)
    best = max(programs, key=score)
    result = dict(
        proposed=best,
        reference=programs[:16],
        options=len(programs),
        equallyRanked=sum(score(word) == score(best) for word in programs),
    )
    if terminal:
        past, models = terminal
        weights = {u: expected_use(use_context(past, u), models) for u in inputs}
        result["inferredUse"] = max(programs, key=lambda w: (weights[w[-1]], score(w)))
    return result


if __name__ == "__main__":
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument("output", type=Path)
    cli.add_argument("--training", nargs="+", type=Path, required=True)
    cli.add_argument("--origins", nargs="+", type=Path, required=True)
    cli.add_argument("--episodes", nargs="+", type=Path)
    args = cli.parse_args()
    votes = {}
    for f, r in zip(args.training[::2], args.training[1::2], strict=True):
        for code, choices in orders.paired_input(f, r):
            assert code not in votes
            votes[code] = orders.per_game_votes(choices, "win")
    sealed = []
    episodes = {}
    models = {}
    for f in args.episodes or []:
        for line in f.read_bytes().splitlines():
            ep = json.loads(line)
            assert (
                ep["start"] == ep["finish"] and not ep["resets"] and not ep.get("error")
            )
            episodes[(ep["code"], ep["start"])] = ep
            if ep["start"] == 1 and ep["levels"][0]["won"]:
                models[ep["code"]] = terminal_votes(ep)
    for f in args.origins:
        for line in f.read_bytes().splitlines():
            source = json.loads(line)
            if "reason" in source:
                continue
            # Inputs were generated without the use. Discard all labelled offers.
            assert source.get("setting") == "analogous" or source["mode"] == "stalled"
            code = source["code"]
            row = {k: source[k] for k in ("code", "level", "prefix", "origin")}
            terminal = None
            if episodes:
                ep = episodes[(code, row["level"])]
                prefix = ep["steps"][: row["prefix"]]
                assert row["origin"].startswith(
                    prefix[-1]["to"] if prefix else ep["initial"]
                )
                terminal = (
                    [command(s) for s in prefix],
                    [v for k, v in models.items() if k != code],
                )
            choice = predict(
                row["origin"],
                source["inputs"],
                [v for k, v in votes.items() if k != code],
                terminal,
            )
            if choice:
                sealed.append(dict(**row, **choice))
    payload = "".join(json.dumps(row, separators=(",", ":")) + "\n" for row in sealed)
    with args.output.open("xb") as dest:
        dest.write(payload.encode())
    print(
        "forecasts", len(sealed), "sha256", hashlib.sha256(payload.encode()).hexdigest()
    )
