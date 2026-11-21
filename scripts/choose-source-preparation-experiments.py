"""Rank an experiment using its isolated effects, with every level of its game held out."""
import argparse
import json
from collections import defaultdict
from pathlib import Path


def features(window):
    def vocabulary(word):
        return tuple('point' if key.startswith('ACTION6:') else
                     'direction' if key in ('ACTION1', 'ACTION2', 'ACTION3', 'ACTION4') else
                     'interaction' for key in word)
    return (
        bool(window['added']),
        bool(window['separate']),
        bool(window['onlyA'] and window['onlyB']),
        bool(window['conflicts']),
        tuple(sorted((vocabulary(window['a']), vocabulary(window['b'])))),
        vocabulary(window['use']),
    )


def compare(rows):
    cases = defaultdict(list)
    for run in rows:
        for w in run['experiments']:
            cases[run['code']].append((features(w), bool(w.get('requiresBoth'))))
    result = []
    for code, trials in sorted(cases.items()):
        if len(trials) < 2:
            continue
        # One vote per training game. Similarity is computed before the combined
        # effect, its reversal or its score has been revealed for the held-out game.
        def prediction(query):
            votes = []
            for other, records in cases.items():
                if other == code:
                    continue
                similarities = [sum(i == j for i, j in zip(query, item)) for item, _ in records]
                best = max(similarities)
                values = [success for (_, success), match in zip(records, similarities) if match == best]
                votes.append((best, sum(values) / len(values)))
            closest = max(match for match, _ in votes)
            neighbours = [score for match, score in votes if match == closest]
            return sum(neighbours) / len(neighbours)
        scores = [prediction(query) for query, _ in trials]
        chosen = [success for (_, success), estimate in zip(trials, scores) if estimate == max(scores)]
        result.append(dict(code=code, windows=len(trials), tiedChoices=len(chosen),
                           selectedYield=sum(chosen) / len(chosen),
                           uniformYield=sum(success for _, success in trials) / len(trials)))
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('output', type=Path)
    parser.add_argument('files', type=Path, nargs='+')
    args = parser.parse_args()
    data = [r for f in args.files for r in json.loads(f.read_bytes())]
    assert len({(r['code'], r['level']) for r in data}) == len(data)
    results = compare(data)
    args.output.write_text(json.dumps(results), encoding='utf8')
    print('held-out games', len(results), 'selected yield', round(sum(r['selectedYield'] for r in results), 3),
          'uniform yield', round(sum(r['uniformYield'] for r in results), 3))
