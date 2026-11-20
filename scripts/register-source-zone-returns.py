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

if __name__ == '__main__':
    directory, output = map(Path, sys.argv[1:])
    groups = [register(r) for f in sorted(directory.glob('poses20-*.json')) for r in json.loads(f.read_text())]
    output.write_bytes(json.dumps(groups).encode())
    print(len(groups), sum(bool(g['tickets']) for g in groups), sum(len(g['tickets']) for g in groups))
