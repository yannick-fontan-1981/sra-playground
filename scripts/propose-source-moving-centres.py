"""Use only public prefix poses to forecast relocation of an effect around a third, movable part."""
import json
import sys
from collections import Counter, defaultdict
from pathlib import Path


def add(a, b):
    return a[0] + b[0], a[1] + b[1]


def sub(a, b):
    return a[0] - b[0], a[1] - b[1]


def around(p, c, index):
    x, y = sub(p, c)
    return add(c, ((-x, y), (x, -y), (-x, -y), (y, x), (-y, x), (y, -x), (-y, -x))[index])


def positions(rows):
    counts = Counter(e[1] for e in rows)
    return {e[1]: tuple(e[2:4]) for e in rows if counts[e[1]] == 1}


def fit(scenes, p, r, c):
    triples = {(s[p], s[r], s[c]) for s in scenes if all(k in s for k in (p, r, c)) and s[p] != s[r]}
    if len({a for a, b, d in triples}) < 2 or len({b for a, b, d in triples}) < 2:
        return []
    models = []
    for index in range(7):
        offsets = Counter(sub(b, around(a, d, index)) for a, b, d in triples)
        offset, count = offsets.most_common(1)[0]
        if count < 2 or count * 4 < len(triples) * 3:
            continue
        support = [(a, b, d) for a, b, d in triples if add(around(a, d, index), offset) == b]
        if min(len({a for a, b, d in support}), len({b for a, b, d in support}),
               len({sub(a, d) for a, b, d in support})) < 2:
            continue
        models.append((index, offset, support))
    return models


def prefix_questions(run):
    frames = {k: positions(v) for k, v in run['frames'].items()}
    hits, coupled = defaultdict(Counter), defaultdict(set)
    seen, emitted = set(), set()
    for i,(root,op,to,_) in enumerate(run['steps']):
        if not to:
            break
        b,z = frames[root],frames[to]
        for p,r in sorted(set(hits)|set(coupled)):
            if p not in b or r not in b or b[p]==b[r]:
                continue
            if not hits[p,r] and len(coupled[p,r])<2:
                continue
            q = hits[p,r].most_common(1)[0][0] if hits[p,r] else None
            key = root,p,r,q
            if key not in emitted:
                yield dict(i=i,root=root,p=p,r=r,suggested=q)
                emitted.add(key)
        if (root,op) in seen:
            continue
        seen.add((root,op))
        moving = [p for p in b if p in z and b[p]!=z[p]]
        for p in moving:
            for r in b:
                if p!=r and b[p]!=b[r] and z[p]==b[r]:
                    hits[p,r][op]+=1
            for r in moving:
                if p!=r and sub(z[p],b[p])!=sub(z[r],b[r]):
                    coupled[p,r].add(b[p])


def proposals(run, tickets):
    frames = {k: positions(v) for k, v in run['frames'].items()}
    pool = {}
    for t in tickets:
        i, p, r = t['i'], t['p'], t['r']
        scene = frames[t['root']]
        if 'suggested' not in t or i < 2:
            continue
        u, v = scene[p], scene[r]
        prefix = run['steps'][:i]
        past = {h for f, a, g, _ in prefix for h in (f, g) if h is not None}
        examples = [frames[h] for h in sorted(past)]
        seen = {tuple(row[:2]) for row in prefix}
        # A shift of C is an intervention. Infer P's accompanying displacement at a matching stance
        # or from two separate public starting configurations with the same joint outcome.
        for c, anchor in scene.items():
            if c in (p, r) or anchor in (u, v):
                continue
            strokes = defaultdict(set)
            for fr, a, to, _ in prefix:
                if not to or (t['root'], a) in seen or a == t['suggested']:
                    continue
                b, z = frames[fr], frames[to]
                if any(k not in b or k not in z for k in (p, c)) or z[c] == b[c]:
                    continue
                strokes[a, sub(z[p], b[p]), sub(z[c], b[c])].add((b[p], b[c]))
            if not strokes:
                continue
            laws = fit(examples, p, r, c)
            for (a, dp, dc), origins in strokes.items():
                if len(origins) < 2 and all(sub(x, y) != sub(u, anchor) for x, y in origins):
                    continue
                dest_p, dest_c = add(u, dp), add(anchor, dc)
                for index, offset, support in laws:
                    if add(around(u, anchor, index), offset) != v:
                        continue
                    target = add(around(dest_p, dest_c, index), offset)
                    fixed_c = add(around(dest_p, anchor, index), offset)
                    if target in (v, dest_p, fixed_c) or min(target) < 0:
                        continue
                    novel = target not in {b for u0, b, c0 in support}
                    new_c = dest_c not in {c0 for u0, b, c0 in support}
                    varying_c = len({c0 for u0, b, c0 in support}) > 1
                    key = (p, r, c, a, dest_c, target)
                    rank = (bool(t['suggested']), novel, new_c, varying_c, offset == (0,0), len(support), len(origins))
                    value = dict(i=i, root=t['root'], p=p, r=r, c=c, before=[u,v,anchor], a=a, q=t['suggested'],
                                 after=[dest_p,target,dest_c], fixed=fixed_c, map=index, offset=offset,
                                 joint=len(origins), support=len(support), novel=novel, newCentre=new_c, varied=varying_c)
                    if key not in pool or rank > pool[key][0]:
                        pool[key] = rank, value
    return [x for _,x in sorted(pool.values(),key=lambda q:q[0],reverse=True)[:8]]


if __name__ == '__main__':
    sources, out = map(Path,sys.argv[1:])
    result = []
    for file in sorted(sources.glob('poses20-*.json')):
        for run in json.loads(file.read_text(encoding='utf8')):
            key = run['code'],run['level']
            result.append(dict(code=key[0],level=key[1],tickets=proposals(run,prefix_questions(run))))
    out.write_text(json.dumps(result),encoding='utf8')
    print('levels',len(result),'predictions',sum(len(r['tickets']) for r in result))
