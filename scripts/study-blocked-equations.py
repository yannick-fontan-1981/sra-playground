"""Index paired public evidence of a blocked and a working spatial operator at one pose."""
import json
import sys
from collections import defaultdict, Counter
from pathlib import Path

def collect(g):
    graph=defaultdict(list)
    for s,op,t in dict.fromkeys(map(tuple,g['edges'])):
        graph[s].append((op,t))
    scenes=g['scenes']
    mobile={i for s,edges in graph.items() for _,t in edges for i in scenes[s].keys() & scenes[t].keys()
            if scenes[s][i][:2]!=scenes[t][i][:2]}
    pairs=defaultdict(lambda: {'stopped': [],'moved': []})
    for s,edges in graph.items():
        for op,t in edges:
            for i in mobile & scenes[s].keys() & scenes[t].keys():
                a,b=scenes[s][i][:2],scenes[t][i][:2]
                pairs[i,op,tuple(a)]['stopped' if a==b else 'moved'].append((s,t,b))
    results=[]
    for (actor,op,origin),v in pairs.items():
        if not v['stopped'] or not v['moved']:continue
        for start,_,_ in v['stopped']:
            todo=[(start,[])];visited={start}
            for s,path in todo:
                for a,t in graph[s]:
                    if t in visited or len(path)>=6 or tuple(scenes[t].get(actor,[])[:2])!=origin:continue
                    visited.add(t);todo.append((t,path+[a]))
            for ready,_,dest in v['moved']:
                witness=next((p for s,p in todo if s==ready),None)
                if witness:
                    results.append(dict(actor=actor,op=op,start=start,origin=origin,dest=dest,solution=witness))
    return dict(game=g['code'],equations=results)
rows=[collect(g) for g in json.loads(Path(sys.argv[1]).read_text())]
Path(sys.argv[2]).write_text(json.dumps(rows,separators=(',',':')))
print('solutions',sum(len(r['equations']) for r in rows),[(r['game'],len(r['equations'])) for r in rows if r['equations']])
print('lengths',dict(Counter(len(e['solution']) for r in rows for e in r['equations'])))
