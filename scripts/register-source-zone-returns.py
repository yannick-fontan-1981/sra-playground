"""Select repeated public returns in the original source traces, ahead of any alternative intervention."""
from pathlib import Path
import json
import sys

def register(run):
    seen = set()
    roots = set()
    tickets = []
    for i, (source, command, target, terminal) in enumerate(run['steps']):
        if terminal or not target:
            break
        edge = source, command, target
        if edge in seen and len({s for s, _, _ in seen}) >= 3 and target not in roots:
            tickets.append(dict(i=i + 1, root=target, repeated=command, source=source))
            roots.add(target)
            if len(tickets) == 6:
                break
        seen.add(edge)
    return dict(code=run['code'], level=run['level'], tickets=tickets)

def closed_cycles(run):
    first_seen, roots, tickets = {}, set(), []
    steps = run['steps']
    for i, (source, command, target, terminal) in enumerate(steps):
        if terminal or not target:
            break
        edge = source, command, target
        if edge in first_seen and edge not in roots:
            for start in range(i, -1, -1):
                if steps[start][0] != target:
                    continue
                if all(first_seen.get(tuple(s[:3]), i + 1) < start for s in steps[start:i + 1]):
                    roots.add(edge)
                    tickets.append(dict(i=i + 1, root=target, source=source, repeated=command, length=i + 1 - start))
                break
        first_seen.setdefault(edge, i)
        if len(tickets) == 6:
            break
    return dict(code=run['code'], level=run['level'], tickets=tickets)

if __name__ == '__main__':
    directory, output = map(Path, sys.argv[1:3])
    if len(sys.argv)>3 and sys.argv[3]!='--closed': raise ValueError('Unknown registration mode')
    select = closed_cycles if '--closed' in sys.argv[3:] else register
    groups = [select(r) for f in sorted(directory.glob('poses20-*.json')) for r in json.loads(f.read_text())]
    output.write_bytes(json.dumps(groups).encode())
    print(len(groups), sum(bool(g['tickets']) for g in groups), sum(len(g['tickets']) for g in groups))
