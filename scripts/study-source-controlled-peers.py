"""Forecast the next translated subject among stationary peers from strictly earlier public moves."""
from collections import Counter, defaultdict
from pathlib import Path
import hashlib
import json
import sys


def groups(rows):
    result = defaultdict(set)
    for _, role, x, y, *_ in rows:
        result[role].add((x, y))
    return result


def delta(a, b):
    return a[0] - b[0], a[1] - b[1]


def study(run):
    frames = {h:groups(rows) for h,rows in run['frames'].items()}
    strokes, active, distinct = defaultdict(dict), {}, set()
    counts = Counter()
    transitions = []
    for i,(h, q, z, terminal) in enumerate(run['steps']):
        if terminal or not z: break
        b, a = frames[h], frames[z]
        proposed = []
        for p,(at,rest) in active.items():
            if p not in b or b[p] != rest | {at} or not rest: continue
            training = strokes[p,q]
            if len(training)<2: continue
            histogram = Counter(training.values())
            dist, support = histogram.most_common(1)[0]
            if support * 2 <= len(training): continue
            dest = at[0]+dist[0], at[1]+dist[1]
            if dest in rest or (h,q,p) in distinct: continue
            distinct.add((h,q,p))
            proposed.append((p,at,rest,dest))
        for p,at,rest,dest in proposed:
            counts['issued'] += 1
            if rest | {dest} == a.get(p,set()):
                counts['exact'] += 1
                transitions.append([i+1,p,q,at,dest,len(rest)])
            elif rest | {at} == a.get(p,set()): counts['still'] += 1
            else: counts['other'] += 1
        for p,g in b.items():
            end=a.get(p,set())
            lost, gained = g-end, end-g
            if len(lost)==len(gained)==1:
                at, to = next(iter(lost)), next(iter(gained))
                d=delta(to,at)
                if q!='ACTION6' and not q.startswith('ACTION6:') and (d[0]==0)!=(d[1]==0):
                    strokes[p,q][h,at]=d
                active[p] = to, end-{to}
            elif g!=end: active.pop(p,None)
    return dict(code=run['code'],level=run['level'],counts=dict(counts),examples=transitions[:2])


if __name__=='__main__':
    root,dest=map(Path,sys.argv[1:])
    results=[study(run) for f in sorted(root.glob('poses20-*.json')) for run in json.loads(f.read_bytes())]
    dest.write_bytes(json.dumps(results).encode())
    total=Counter()
    for r in results: total.update(r['counts'])
    print(len(results),sum(bool(r['counts']) for r in results),sum(bool(r['counts'].get('exact')) for r in results),dict(total),hashlib.sha256(dest.read_bytes()).hexdigest())
