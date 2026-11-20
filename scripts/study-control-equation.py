"""Predict a missing response from the effect of other controls, using source forks only."""

import argparse
import json
from collections import Counter
from pathlib import Path


def subtract(x, y):
    return (x[0] - y[0], x[1] - y[1])


def plus(x, y):
    return (x[0] + y[0], x[1] + y[1])


def symmetries(point):
    x, y = point
    return ((x, y), (-y, x), (-x, -y), (y, -x), (x, -y), (-x, y), (y, x), (-y, -x))


def predict(pairs, missing):
    # A rigid change of reference frame preserves the shape of an action repertoire.
    # Keep every solution of the equations; predict only a consequence shared by all.
    if len({before for before, _ in pairs}) < 2 or len({after for _, after in pairs}) < 2:
        return None
    transforms = []
    for index in range(8):
        offsets = {subtract(after, symmetries(before)[index]) for before, after in pairs}
        if len(offsets) == 1:
            transforms.append((index, offsets.pop()))
    candidates = {plus(symmetries(missing)[index], offset) for index, offset in transforms}
    if len(candidates) != 1:
        return None
    return candidates.pop(), transforms


def audit(data):
    root, setups, matrix = data["root"], data["setups"], data["matrix"]
    controls = data["buttons"]
    once = set()
    rows = []
    wins = set(map(tuple, data["essential"]))
    for a, prepared in enumerate(setups):
        if not prepared or data["images"][a] == data["origin"]:
            continue
        for b in range(len(controls)):
            if not setups[b]:
                continue
            for actor, origin in enumerate(root):
                key = data["images"][a], b, actor
                if not origin or not prepared[actor] or not setups[b][actor] or key in once:
                    continue
                once.add(key)
                p, bare = prepared[actor], subtract(setups[b][actor], origin)
                before_menu = {subtract(r[actor], origin) for r in setups if r and r[actor]}
                known = [(d,subtract(setups[d][actor], origin),subtract(matrix[a][d][actor], p))
                         for d in range(len(controls)) if d % 2 != b % 2 and setups[d] and setups[d][actor]
                         and matrix[a][d] and matrix[a][d][actor]]
                prediction = predict([(old, new) for _, old, new in known], bare)
                if not prediction:
                    continue
                expected, transforms = prediction
                if expected == bare:
                    continue
                ends = matrix[a][b]
                actual = subtract(ends[actor], p) if ends and ends[actor] else None
                predicted = plus(p, expected)
                row = {
                    "code": data["code"], "level": data["level"], "a": controls[a], "b": controls[b],
                    "role": data["roles"][actor], "origin": origin, "prepared": p, "bare": bare,
                    "predicted": predicted, "actual": plus(p,actual) if actual is not None else None,
                    "measured": actual is not None, "exact": actual == expected, "baselineExact": actual == bare,
                    "newVector": expected not in before_menu,
                    "unprobedEndpoint": expected not in {new for _, _, new in known},
                    "activated": bare == (0,0) and expected != (0,0), "predictedMotion": expected != (0,0),
                    "reoriented": all(i != 0 for i, _ in transforms), "necessaryWin": (a,b) in wins,
                    "calibrations":[controls[d] for d,_,_ in known],
                    "changedPartner": any(i!=actor and v and prepared[i] and v!=prepared[i] for i,v in enumerate(root)),
                }
                rows.append(row)
    return rows


def summary(rows):
    keys = ("measured","exact","baselineExact","necessaryWin")
    return {"forecasts":len(rows), **{k:sum(r[k] for r in rows) for k in keys},
            "games":len(set(r["code"] for r in rows))}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("tables", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    groups = {"lower": [], "upper": []}
    counts = Counter()
    for file in sorted(args.tables.glob("*.json")):
        data = json.loads(file.read_text(encoding="utf8"))
        cohort = "lower" if data["level"] == 1 else "upper"
        counts[cohort] += 1
        groups[cohort].extend(audit(data))
    result = {}
    for name, rows in groups.items():
        successful = [r for r in rows if r["exact"] and r["predictedMotion"] and r["unprobedEndpoint"]]
        fresh = [r for r in rows if r["unprobedEndpoint"] and r["predictedMotion"]]
        result[name] = {"entries":counts[name], "discordant":summary(rows), "freshMovingResponse":summary(fresh),
            "outsideBareMenu":summary([r for r in fresh if r["newVector"]]),
            "awakened":summary([r for r in fresh if r["activated"]]),
            "reoriented":summary([r for r in fresh if r["reoriented"]]),
            "byGame":{code:summary([r for r in fresh if r["code"]==code]) for code in sorted(set(r["code"] for r in fresh))},
            "examples": sorted(successful,key=lambda r:(not r["necessaryWin"],not r["activated"],not r["changedPartner"]))[:6]}
    args.output.write_text(json.dumps(result,indent=2)+"\n",encoding="utf8")


if __name__ == "__main__":
    main()
