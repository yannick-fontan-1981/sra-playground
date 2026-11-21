"""Rank an experiment using its isolated effects, with every level of its game held out."""
import argparse
import json
from collections import defaultdict
from itertools import combinations_with_replacement, product
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


def training_cases(rows):
    cases = defaultdict(list)
    for run in rows:
        for w in run['experiments']:
            cases[run['code']].append((features(w), bool(w.get('requiresBoth'))))
    return cases


def game_votes(cases, query):
    votes = {}
    for code, trials in cases.items():
        similarities = [sum(i == j for i, j in zip(query, item)) for item, _ in trials]
        best = max(similarities)
        values = [success for (_, success), match in zip(trials, similarities) if match == best]
        votes[code] = best, sum(values) / len(values)
    return votes


def held_out_score(votes, code):
    other = [v for k, v in votes.items() if k != code]
    best = max(match for match, _ in other)
    neighbours = [score for match, score in other if match == best]
    return sum(neighbours) / len(neighbours)


def compare(rows):
    cases = training_cases(rows)
    result = []
    for code, trials in sorted(cases.items()):
        if len(trials) < 2:
            continue
        scores = [held_out_score(game_votes(cases, query), code) for query, _ in trials]
        chosen = [success for (_, success), estimate in zip(trials, scores) if estimate == max(scores)]
        result.append(dict(code=code, windows=len(trials), tiedChoices=len(chosen),
                           selectedYield=sum(chosen) / len(chosen),
                           uniformYield=sum(success for _, success in trials) / len(trials)))
    return result


def single_step_tables(rows):
    cases = training_cases(rows)
    tables = {code: {} for code in {r['code'] for r in rows} | {'heldOutGame'}}
    kinds = ('direction', 'interaction', 'point')
    for flags, pair, use in product(product((False, True), repeat=4), combinations_with_replacement(kinds, 2), kinds):
        query = *flags, tuple((p,) for p in pair), (use,)
        key = ''.join(str(int(v)) for v in flags) + '/' + '/'.join((*pair, use))
        votes = game_votes(cases, query)
        for code, table in tables.items():
            table[key] = held_out_score(votes, code)
    return tables


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('output', type=Path)
    parser.add_argument('files', type=Path, nargs='+')
    parser.add_argument('--single-step-tables', type=Path)
    args = parser.parse_args()
    data = [r for f in args.files for r in json.loads(f.read_bytes())]
    assert len({(r['code'], r['level']) for r in data}) == len(data)
    results = compare(data)
    if args.single_step_tables:
        args.single_step_tables.write_text(json.dumps(single_step_tables(data),sort_keys=True), encoding='utf8')
    args.output.write_text(json.dumps(results), encoding='utf8')
    print('held-out games', len(results), 'selected yield', round(sum(r['selectedYield'] for r in results), 3),
          'uniform yield', round(sum(r['uniformYield'] for r in results), 3))
