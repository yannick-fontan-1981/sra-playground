"""Evaluate two-input forecasts with every level of the test game held out."""
import argparse
import json
from collections import Counter, defaultdict
from pathlib import Path
from statistics import mean

FLAGS = ('contact', 'unique', 'repeated', 'moving', 'unmoved', 'turn',
         'collinear', 'sameSize', 'differentSize')


def wins_both(sample, plan):
    return plan['win'] and not sample['direct'][plan['b']]


def fraction(sample, choices):
    return mean(int(wins_both(sample, p)) for p in choices)


def learn(rows):
    """Choose one shared relational property by game-balanced lift at L1."""
    scores = {}
    for flag in FLAGS:
        effects = defaultdict(list)
        supporting = set()
        for game, sample in rows:
            all_plans = sample['choices']
            selected = [p for p in all_plans if flag in p['flags']]
            gain = fraction(sample, selected) - fraction(sample, all_plans) if selected else 0
            effects[game].append(gain)
            if gain > 0:
                supporting.add(game)
        if len(supporting) >= 2:
            scores[flag] = mean(mean(v) for v in effects.values())
    best = max(scores, key=scores.get, default=None)
    return best if best and scores[best] > 0 else None


def frequent_words(rows):
    votes = Counter()
    for _,sample in rows:
        wins = [p for p in sample['choices'] if wins_both(sample,p)]
        for p in wins:
            votes[p['a'],p['b']] += 1 / len(wins)
    return votes


def route_summary(reports):
    output = {}
    for name,upper in [('sourceL1',False),('sourceUpper',True)]:
        cohort = [r for r in reports if (r['level'] > 1) == upper]
        output[name] = {}
        for horizon in (2,6):
            arms = [a for r in cohort for a in r['arms'] if a['horizon'] == horizon]
            output[name][horizon] = dict(levels=len(cohort),withRoute=sum(bool(a['issued']) for a in arms),
                withLongRoute=sum(any(n > 2 for n in a['routeSizes']) for a in arms),
                issued=sum(a['issued'] for a in arms),matched=sum(a['matched'] for a in arms),
                checked=sum(a['checked'] for a in arms), reachedLastGesture=sum(a['completedRoutes'] for a in arms),
                wins=sum(a['won'] for a in arms))
    return output


def continuation_summary(rows):
    assert len(rows) == len({(r['code'],r['level'],r['prefix'],r['a'],r['b'],r['c']) for r in rows})
    return dict(trials=len(rows),games=len({r['code'] for r in rows}),levels=len({(r['code'],r['level']) for r in rows}),
                withControls=sum(r['controlsAvailable'] for r in rows),localChanges=sum(r['atSite'] for r in rows),
                isolatedChanges=sum(r['isolatedSite'] for r in rows),unseenLocal=sum(r['unseenLocal'] for r in rows),
                officialWins=sum(r['won'] for r in rows),
                unseenCases=[{k:r[k] for k in ('code','level','prefix','a','b','c')} for r in rows if r['unseenLocal']])


def evaluate(rows, rules, frequencies):
    counters, flags = Counter(), Counter()
    rates, examples = [], []
    for game, level, s in rows:
        counters['prefixes'] += 1
        plans = s['choices']
        if not plans:
            continue
        counters['eligible'] += 1
        counters['executedPairs'] += sum(p['feasible'] for p in plans)
        projected = [p for p in plans if p['flags']]
        counters['projectedPairs'] += len(projected)
        counters['confirmedPreparations'] += sum(p['verified'] for p in projected)
        counters['projectedWinsRequiringBoth'] += sum(wins_both(s,p) for p in projected)
        flag = rules[game]
        if not flag:
            continue
        selected = [p for p in plans if flag in p['flags']]
        if not selected or len(selected) == len(plans):
            continue
        counters['choicesRanked'] += 1
        flags[flag] += 1
        repeat = [p for p in plans if p['a'] == p['b']]
        votes = frequencies[game]
        high = max(votes[p['a'],p['b']] for p in plans)
        frequent = [p for p in plans if votes[p['a'],p['b']] == high]
        rates.append((fraction(s,selected), fraction(s,plans), fraction(s,repeat), fraction(s,frequent)))
        counters['tiedFirst'] += int(len(selected) > 1)
        counters['selectedPairs'] += len(selected)
        counters['selectedWinsRequiringBoth'] += sum(wins_both(s,p) for p in selected)
        counters['positionsWithWinningPair'] += int(any(wins_both(s,p) for p in plans))
        counters['positionsWithSelectedWin'] += int(any(wins_both(s,p) for p in selected))
        for p in selected:
            if flag not in p['verifiedFlags'] or not wins_both(s,p):
                continue
            rivals = [v['a'] for v in plans if v['b'] == p['b'] and v['feasible'] and not v['win']]
            if rivals:
                counters['selectedWinsWithVerifiedSetupAndLosingRival'] += 1
                examples.append(dict(game=game, level=level, prefix=s['prefix'], flag=flag,
                                     plan=[p['a'],p['b']], losingPreparations=rivals,
                                     tied=len(selected)))
    return dict(counts=dict(counters), properties=dict(flags), examples=examples,
                meanWinProbabilityWithUniformTies=round(mean(v[0] for v in rates),4) if rates else None,
                meanWinProbabilityForUniformPairs=round(mean(v[1] for v in rates),4) if rates else None,
                meanWinProbabilityRepeatingOneMotor=round(mean(v[2] for v in rates),4) if rates else None,
                meanWinProbabilityForFrequentWord=round(mean(v[3] for v in rates),4) if rates else None)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('output',type=Path)
    parser.add_argument('shards',type=Path,nargs='+')
    parser.add_argument('--routes',type=Path,nargs='+')
    parser.add_argument('--continuations',type=Path,nargs='+')
    args = parser.parse_args()
    levels = {}
    for f in args.shards:
        for row in json.loads(f.read_bytes()):
            levels.setdefault((row['code'],row['level']),row)
    games = sorted({g for g,l in levels})
    rows = [(g,l,s) for (g,l),row in levels.items() for s in row['samples']]
    train = [(g,s) for g,l,s in rows if l == 1 and s['atEnd'] and s['choices']]
    rules = {game:learn([(g,s) for g,s in train if g != game]) for game in games}
    frequencies = {game:frequent_words([(g,s) for g,s in train if g != game]) for game in games}
    sections = {
        'sourceL1End':[(g,l,s) for g,l,s in rows if l == 1 and s['atEnd']],
        'sourceUpperEnd':[(g,l,s) for g,l,s in rows if l > 1 and s['atEnd']],
        'fixedL1':[(g,l,s) for g,l,s in rows if l == 1 and s['fixed']],
        'fixedUpper':[(g,l,s) for g,l,s in rows if l > 1 and s['fixed']]
    }
    output = dict(levels=len(levels), games=len(games), rules=rules,
                  evaluations={key:evaluate(values,rules,frequencies) for key,values in sections.items()})
    if args.routes:
        routes = [r for f in args.routes for r in json.loads(f.read_bytes())]
        assert len(routes) == len(levels) and {(r['code'],r['level']) for r in routes} == set(levels)
        output['routes'] = route_summary(routes)
    if args.continuations:
        output['continuations'] = continuation_summary([r for f in args.continuations for r in json.loads(f.read_bytes())])
    args.output.write_text(json.dumps(output,indent=2)+'\n',encoding='utf-8')
    print('source games',len(games),'levels',len(levels),'rules',dict(Counter(rules.values())))
    for key,v in output['evaluations'].items():
        print(key,v['counts'].get('choicesRanked',0),v['counts'].get('selectedWinsRequiringBoth',0),
              v['meanWinProbabilityWithUniformTies'],v['meanWinProbabilityForUniformPairs'])


if __name__ == '__main__':
    main()
