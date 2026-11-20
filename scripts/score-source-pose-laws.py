"""Prequential tests of public motion hypotheses. Coordinates are doubled pixel centres."""
import json,sys
from pathlib import Path
from collections import Counter,defaultdict
def add(p,q):return p[0]+q[0],p[1]+q[1]
def sub(p,q):return p[0]-q[0],p[1]-q[1]
def mapping(p,r,i):
 x,y=sub(p,r)
 d=((x,y),(-x,y),(x,-y),(-x,-y),(y,x),(-y,x),(y,-x),(-y,-x))
 return add(r,d[i])
def unique(frame,kind):
 counts=Counter(c[kind] for c in frame)
 return {c[kind]:tuple(c[2:4]) for c in frame if counts[c[kind]]==1}
def best_count(values):
 return Counter(values).most_common(1)[0]
def rank(tally,residuals):
 # Fraction of all distinct past states explained. Penalize fitting one extra vector.
 return (tally-0.5*residuals)
def study(r,kind):
 frames={k:unique(v,kind) for k,v in r['frames'].items()};samples=defaultdict(list)
 used=set();counts=Counter();examples=[]; groups=defaultdict(Counter)
 for i,(fr,op,to,_) in enumerate(r['steps']):
  if to is None or (fr,op) in used:continue
  used.add((fr,op));now=frames[fr];after=frames[to]
  for actor,p in now.items():
   hist=samples[op,actor];observed=after.get(actor)
   # The observed return is opened for scoring only after the forecast.
   if len(hist)>=2 and sum(a!=z for f,a,z in hist)>=2:
    ds=[sub(z,a) for f,a,z in hist];ds0,nd=best_count(ds);w,nw=best_count(z for f,a,z in hist)
    baseline=add(p,ds0) if nd>=nw else w;best=None
    for peer,at in now.items():
     if peer==actor:continue
     rows=[(a,frames[f][peer],z) for f,a,z in hist if peer in frames[f]]
     if len(rows)<2 or len({(a,q) for a,q,z in rows if a!=z})<2:continue
     # Direct observation of a new joint arrangement is required for the evaluation.
     if any((a,q)==(p,at) for a,q,z in rows):continue
     for mi in range(1,9):
      value=at if mi==8 else mapping(p,at,mi)
      bases=[q if mi==8 else mapping(a,q,mi) for a,q,z in rows]
      offsets=[sub(z,base) for base,(a,q,z) in zip(bases,rows)]
      offset,votes=best_count(offsets)
      support=[(a,q,z) for (a,q,z),err in zip(rows,offsets) if err==offset and z!=a]
      if len(set(support))<2 or len({z for a,q,z in support})<2 or len({sub(z,a) for a,q,z in support})<2:continue
      if mi==8 and len({q for a,q,z in support})<2:continue
      score=rank(votes,int(offset!=(0,0)))-max(nw,nd)
      if score<=0 or votes*3<len(hist)*2:continue
      predicted=add(value,offset)
      if predicted==baseline or predicted==p:continue
      priority=(score,votes,len(set(support)),offset==(0,0),mi==8)
      if best is None or priority>best[0]:best=(priority,predicted,mi,peer,offset,support)
    if best:
     pr,target,mi,peer,offset,support=best
     c=groups['copy' if mi==8 else 'isometry'];c['sealed']+=1
     if observed is not None:
      unused=observed not in [z for _,_,z in hist]
      for k,v in {'read':True,'exact':observed==target,'baseline':observed==baseline,'motion':observed!=p,'newLanding':unused and observed==target,'silent':observed==p}.items():c[k]+=int(v)
      if len(examples)<8 and observed==target:examples.append(dict(i=i,op=op,mi=mi,p=p,r=now[peer],offset=offset,predicted=target,actual=observed,baseline=baseline,new=unused,support=len(support)))
   if observed is not None: hist.append((fr,p,observed))
 return {k:dict(v) for k,v in groups.items()},examples
p=Path(sys.argv[1]);out=Path(sys.argv[2]);result=[]
for f in sorted(p.glob('poses20-*.json')):
 for r in json.loads(f.read_text()):
  laws={};examples={}
  for k,name in [(0,'exact'),(1,'rigid')]:
   laws[name],examples[name]=study(r,k)
  result.append(dict(code=r['code'],level=r['level'],laws=laws,examples=examples))
out.write_text(json.dumps(result),'utf-8')

