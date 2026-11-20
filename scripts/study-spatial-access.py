"""Find aliased positions and landmark-relative destinations in original public trajectories."""
import json
import sys
from collections import Counter, defaultdict
from pathlib import Path

def point(p):
    return tuple(p[:2])

def minus(a, b):
    return (a[0]-b[0], a[1]-b[1])

def study(game):
    scenes = game["scenes"]
    edges = list(dict.fromkeys(map(tuple, game["edges"])))
    mobile = {i for s, _, t in edges for i in scenes[s].keys() & scenes[t].keys()
              if point(scenes[s][i]) != point(scenes[t][i])}
    at = defaultdict(list)
    by_action = defaultdict(list)
    found = {}
    anchored = {}
    for s, op, t in edges:
        by_action[s, op].append(t)
        for i in mobile & scenes[s].keys() & scenes[t].keys():
            at[i, point(scenes[s][i]), op].append((s, t, point(scenes[t][i])))
    # A moves a landmark while the measured traveler stays put.
    # Both arms use exactly the same starting public scene and the same command B.
    for s, prep, ready in edges:
        if s == ready:
            continue
        shared = scenes[s].keys() & scenes[ready].keys()
        moved = {i for i in shared if point(scenes[s][i]) != point(scenes[ready][i])}
        for i in mobile & (shared - moved):
            origin = point(scenes[s][i])
            for (other, pos, op), trials in at.items():
                if (i, origin) != (other, pos):
                    continue
                for bare in by_action[s, op]:
                    for after in by_action[ready, op]:
                        if i not in scenes[bare] or i not in scenes[after]:
                            continue
                        target, control = point(scenes[after][i]), point(scenes[bare][i])
                        if target == origin or target == control:
                            continue
                        for landmark in moved:
                            key = (i, landmark, prep, op)
                            # Guard against sweeping changes for the strict positional comparison.
                            only = len(moved) == 1 and scenes[s].keys() == scenes[ready].keys()
                            row = dict(traveler=i, landmark=landmark, prep=prep, trigger=op, origin=origin,
                                       before=point(scenes[s][landmark]), placed=point(scenes[ready][landmark]),
                                       control=control, landing=target, onlyUniquePoseChanged=only,
                                       revisions=[s,ready,bare,after])
                            if key not in found or only:
                                found[key] = row
    # Prequential test: two distinct initial actor/anchor offsets imply different
    # self-vectors if the same anchor offset predicts the landing in each context.
    for s, op, t in edges:
        for i in mobile & scenes[s].keys() & scenes[t].keys():
            src, dst = point(scenes[s][i]), point(scenes[t][i])
            if src == dst:
                continue
            for j in (mobile & scenes[s].keys()) - {i}:
                ref = point(scenes[s][j])
                key = i,j,op,minus(dst,ref)
                anchored.setdefault(key,set()).add((src,ref,dst))
    repeats = []
    for (i,j,op,offset), cases in anchored.items():
        anchors = {ref for _,ref,_ in cases}
        deltas = {minus(dst,src) for src,_,dst in cases}
        if len(anchors) >= 2 and len(deltas) >= 2:
            repeats.append(dict(traveler=i,landmark=j,trigger=op,offset=offset,anchors=len(anchors),
                                deltas=len(deltas),cases=len(cases)))
    return dict(code=game['code'], contrasts=list(found.values()), anchorRules=repeats)

if __name__ == '__main__':
    rows = [study(g) for g in json.loads(Path(sys.argv[1]).read_text())]
    Path(sys.argv[2]).write_text(json.dumps(rows,separators=(',',':')))
    for k in ('contrasts','anchorRules'):
        hits = [r for r in rows if r[k]]
        print(k,len(hits),sum(len(r[k]) for r in hits),[(r['code'],len(r[k])) for r in hits][:30])
    strict=[(r['code'],sum(c['onlyUniquePoseChanged'] for c in r['contrasts'])) for r in rows]
    print('single landmark',[(g,n) for g,n in strict if n])

