"""Predict a subject's landing by expressing its position relative to a variable reference.

Learn in chronological order from indexed public positions. Never pool coordinates, shape IDs
or commands across levels. Cases are emitted only when relocating the reference beats simpler
world-centred and subject-centred descriptions on the prefix.
"""
import argparse
import json
from collections import Counter, defaultdict
from pathlib import Path


# The first projection follows the reference. The remaining projections rotate or reflect a
# relative displacement on the square grid. The identity reduces to an ordinary fixed stride.
def transforms(x, y):
    return ((0, 0), (x, y), (-y, x), (-x, -y), (y, -x),
            (-x, y), (x, -y), (y, x), (-y, -x))


def projected(origin, reference, transform):
    x, y = origin
    a, b = reference
    dx, dy = transforms(x - a, y - b)[transform]
    return a + dx, b + dy


def point_after(origin, reference, rule):
    t, offset = rule
    p = projected(origin, reference, t)
    return p[0] + offset[0], p[1] + offset[1]


def learn(rows, reference):
    """Score every coefficient after fitting its most frequent residual on this prefix."""
    entries = [(at, refs[reference], end) for at, refs, end in rows if reference in refs]
    fits = []
    for t in range(9):
        offsets = Counter()
        for at, ref, end in entries:
            x, y = projected(at, ref, t)
            offsets[end[0] - x, end[1] - y] += 1
        if offsets:
            top = max(offsets.values())
            fits.extend((top, (t, offset)) for offset, n in offsets.items() if n == top)
    return fits


WORLD, GESTURE = -1, -2


def forecast(history, origin, references):
    if len(history) < 3:
        return None
    offers = []
    for ref in references.keys() - {WORLD}:
        # The fixed map gets exactly the same examples and candidate transformations.
        by_geometry = {}
        for at, refs, end in history:
            if ref not in refs:
                continue
            pair = at, refs[ref]
            if pair in by_geometry and by_geometry[pair][2] != end:
                break
            by_geometry[pair] = (at, refs, end)
        else:
            rows = list(by_geometry.values())
            if (len(rows) < 3 or len({e[1][ref] for e in rows}) < 2 or
                    len({e[2] for e in rows if e[2] != e[0]}) < 2 or
                    (origin, references[ref]) in by_geometry):
                continue
            # Compare against both world-fixed and fixed-stride models on the same rows.
            base = learn(rows, WORLD)
            best_base = max(score for score, _ in base)
            if best_base == len(rows):
                continue
            for hits, rule in learn(rows, ref):
                if hits != len(rows):
                    continue
                end = point_after(origin, references[ref], rule)
                base_ends = {point_after(origin, (0, 0), model)
                             for count, model in base if count == best_base}
                offers.append((len(rows), hits - best_base, ref, rule, end, base_ends))
    if not offers:
        return None
    # A tie between models is usable only when they make the same testable prediction.
    rank = max(o[:2] for o in offers)
    best = [o for o in offers if o[:2] == rank]
    if len({o[4] for o in best}) != 1:
        return None
    choice = min(best, key=lambda o: (o[2], o[3]))
    return choice


def singletons(parts):
    groups = defaultdict(list)
    for shape, _, x, y, *_ in parts:
        groups[shape].append((x, y))
    return {k: p[0] for k, p in groups.items() if len(p) == 1}


def study(run):
    scenes = {k: singletons(parts) for k, parts in run['frames'].items()}
    memory = defaultdict(list)
    moving = set()
    results = []
    for i, (h, action, z, terminal) in enumerate(run['steps']):
        before = scenes[h]
        cmd, _, xy = action.partition(':')
        refs = {**before, WORLD: (0, 0)}
        if xy:
            x, y = map(int, xy.split(','))
            refs[GESTURE] = 2 * x, 2 * y
        after = {} if terminal else scenes.get(z, {})
        for actor, origin in before.items():
            history = memory[actor, cmd]
            if (actor, cmd) in moving:
                possible = {k: p for k, p in refs.items() if k != actor}
                offer = forecast(history, origin, possible)
                if offer:
                    count, advantage, ref, rule, prediction, baseline = offer
                    results.append(dict(step=i + 1, subject=actor, action=action,
                                        source=origin, reference=ref, at=refs[ref], transform=rule[0],
                                        offset=rule[1], support=count, advantage=advantage, predicted=prediction,
                                        actual=after.get(actor), alternative=sorted(baseline), terminal=terminal))
            if actor in after:
                end = after[actor]
                if origin != end:
                    moving.add((actor, cmd))
                history.append((origin, refs, end))
                if len(history) > 24:
                    history.pop(0)
    return dict(code=run['code'], level=run['level'], predictions=results)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('output', type=Path)
    parser.add_argument('poses', nargs='+', type=Path)
    args = parser.parse_args()
    episodes = [r for f in args.poses for r in json.loads(f.read_bytes())]
    assert len({(r['code'], r['level']) for r in episodes}) == len(episodes)
    assert not any(r['code'].startswith('SS') and r['code'][2:].isdigit() for r in episodes)
    output = [study(r) for r in episodes]
    args.output.write_text(json.dumps(output), encoding='utf8')
    print('source levels', len(output), 'prospective predictions', sum(len(r['predictions']) for r in output))


if __name__ == '__main__':
    main()
