"""Test whether a changed visible mark retargets the same command at the identical subject origin."""
from collections import Counter, defaultdict
from pathlib import Path
import json
import sys

def unique(parts):
    multiplicity = Counter(e[1] for e in parts)
    return {e[1]: tuple(e[2:4]) for e in parts if multiplicity[e[1]] == 1}

def questions(run):
    layouts = {h: unique(parts) for h, parts in run['frames'].items()}
    arrivals, motors, contacts = defaultdict(list), defaultdict(set), defaultdict(list)
    tried, proposed = set(), {}
    for i, (root, command, after, terminal) in enumerate(run['steps']):
        b, z = layouts[root], layouts.get(after, {})
        # All access to the new outcome is below the construction of this step's tickets.
        for p, origin in b.items():
            for witness, old, r, q in arrivals.get((p, origin), []):
                target = b.get(r)
                if target is None or target == origin or target == old or (root, q) in tried:
                    continue
                original = layouts[run['steps'][witness][0]]
                changed = [c for c in b if c not in (p, r) and c in original and b[c] != original[c]]
                pushed = [c for c in changed if any(witness < n < i for n in contacts[(p, c)])]
                k = p, origin, r, q, target
                rank = bool(pushed), bool(changed), len(motors[p]) > 1
                ticket = dict(i=i, root=root, p=p, r=r, to=target, suggested=q, motor=sorted(motors[p]),
                              newCue=True, witness=witness, oldTarget=old, changed=changed, pushed=pushed)
                ticket['from'] = origin
                if k not in proposed or rank > proposed[k][0]:
                    proposed[k] = rank,ticket
        tried.add((root, command))
        if terminal:continue
        for p, origin in b.items():
            end = z.get(p)
            if end is None or origin == end:continue
            motors[p].add(command)
            for r, site in b.items():
                if r == p or site != end:continue
                if not command.startswith('ACTION6:'):
                    item=(i,site,r,command)
                    if not any((site,r,command)==w[1:] for w in arrivals[p,origin]):
                        arrivals[p,origin].append(item)
                partner = z.get(r)
                if partner and (partner[0]-site[0],partner[1]-site[1]) == (end[0]-origin[0],end[1]-origin[1]):
                    contacts[p,r].append(i)
    counts, selected = Counter(), []
    for rank, t in sorted(proposed.values(),key=lambda v:v[0],reverse=True):
        k=t['p'],t['r'],t['suggested']
        if counts[k]>=2:continue
        selected.append(t);counts[k]+=1
        if len(selected)>=8:break
    return dict(code=run['code'],level=run['level'],tickets=selected)

if __name__=='__main__':
    directory, output = map(Path,sys.argv[1:])
    result = [questions(r) for f in sorted(directory.glob('poses20-*.json')) for r in json.loads(f.read_text())]
    output.write_bytes(json.dumps(result).encode())
    tickets=[t for r in result for t in r['tickets']]
    print(len(result),len(tickets),sum(bool(t['changed']) for t in tickets),sum(bool(t['pushed']) for t in tickets))
