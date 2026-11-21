"""Score source interventions while retaining the distinction between effects and wins."""
import argparse
import json
from collections import Counter
from pathlib import Path
from statistics import mean


def read(files):
    return [r for f in files for r in json.loads(f.read_bytes())]


def position_wins(p):
    return p['win'] and not (p['alone'] or p['direct'] or p['reverse'])


def positioned_use(rows):
    train = [(r['code'],s['choices']) for r in rows if r['level']==1 for s in r['samples']
             if s['tail'] and s['choices']]
    flags = sorted({f for _,options in train for p in options for f in p['flags']},key=lambda f:(f.count('/'),f))
    def train_without(game):
        best,score=None,0
        for flag in flags:
            gains=[]
            for g,options in train:
                if g==game:
                    continue
                selected=[p for p in options if flag in p['flags']]
                gains.append(mean(map(position_wins,selected))-mean(map(position_wins,options)) if selected else 0)
            if sum(v>0 for v in gains)>=2 and mean(gains)>score:
                best,score=flag,mean(gains)
        return best
    rules={r['code']:train_without(r['code']) for r in rows}
    samples=[(r,s) for r in rows for s in r['samples'] if s['choices']]
    metrics={}
    for name,field,level in [('fixedLower','fixed',1),('terminalLower','tail',1),('fixedUpper','fixed',2),('terminalUpper','tail',2)]:
        all_rows=[(r,s) for r,s in samples if s[field] and ((r['level']==1)==(level==1))]
        ranked=[]
        for r,s in all_rows:
            options=s['choices'];selected=[p for p in options if rules[r['code']] in p['flags']]
            if selected and len(selected)<len(options):
                ranked.append((mean(map(position_wins,selected)),mean(map(position_wins,options))))
        metrics[name]=dict(eligible=len(all_rows),ranked=len(ranked),
            expectedSelected=round(sum(v[0] for v in ranked),4),expectedUniform=round(sum(v[1] for v in ranked),4))
    cases=[dict(code=r['code'],level=r['level'],prefix=s['i'],prepare=p['d'],use=p['c'],fixed=s['fixed'],penultimate=s['tail'])
           for r,s in samples for p in s['choices'] if position_wins(p)]
    return dict(levels=len(rows),positions=len(samples),pairs=sum(len(s['choices']) for r,s in samples),
                orderEssential=cases,chosenProperties=dict(Counter(rules.values())),crossValidation=metrics)


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('output',type=Path)
    for name in ['reuse','payoff','crossings','positioned']:
        p.add_argument('--'+name,type=Path,nargs='+',required=True)
    args=p.parse_args()
    reuse,score,cross,positions=map(read,[args.reuse,args.payoff,args.crossings,args.positioned])
    for cohort in [cross,positions]:
        assert len(cohort)==len({(r['code'],r['level']) for r in cohort})
    tests=[(r,t) for r in reuse for t in r['tests']]
    isolated=[(r,t) for r,t in tests if t['controlsAvailable'] and t['full']['matched'] and not t['controlsMatched']]
    arms=[(r,q,v) for r in cross for q in r['queries'] for v in q['arms']]
    openings=[(r,q,v) for r,q,v in arms if v['arrivedForm'] and v['directStayed'] and not v['rivalArrival']]
    out=dict(copy=dict(configurations=len(reuse),withForecast=sum(bool(r['tests']) for r in reuse),predictions=len(tests),
        matched=sum(t['full']['matched'] for _,t in tests),isolated=len(isolated),
        isolatedCases=len({(r['code'],r['level'],r['prefix'],r['a'],r['b'],r['c']) for r,_ in isolated}),
        isolatedByGame=dict(Counter(r['code'] for r,t in isolated)),isolatedAtNeighbour=sum(any(t['destinationOffset']) for _,t in isolated),
        directWins=sum(t['full']['win'] for _,t in tests)),
        payoff=dict(identicalContinuations=len(score),fullWins=sum(r['outcomes']['full']['win'] for r in score),
            fullWinsWhenEmptyLoses=sum(r['outcomes']['full']['win'] and not r['outcomes']['none']['win'] for r in score)),
        crossings=dict(levels=len(cross),trials=len(arms),apparent=sum(v['moved'] and not v['baseMoved'] for _,_,v in arms),
            withBody=sum(v['arrivedForm'] for _,_,v in arms),openings=[dict(game=r['code'],level=r['level'],prefix=q['prefix'],
                prepare=v['c'],traverse=v['d'],restoredSetup=v['setupSeen'],previouslySeenOutcome=v['resultSeen']) for r,q,v in openings],
            scoredOnlyAfterSetup=sum(v['win'] and not v['baseWin'] and not v['setupWin'] for _,_,v in arms)),
        positionedUse=positioned_use(positions))
    args.output.write_text(json.dumps(out,indent=2)+'\n',encoding='utf8')
    print('composed effects',len(isolated),'score-only-after-preparation',out['payoff']['fullWinsWhenEmptyLoses'],
          'verified crossings',len(openings),'ordered scores',len(out['positionedUse']['orderEssential']))


if __name__=='__main__':
    main()
