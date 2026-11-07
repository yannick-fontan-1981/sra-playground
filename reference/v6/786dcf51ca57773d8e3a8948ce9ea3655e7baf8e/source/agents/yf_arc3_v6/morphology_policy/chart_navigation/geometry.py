from collections import Counter,deque
from hashlib import sha256
import json
from types import SimpleNamespace
from agents.yf_arc3_v5.capabilities.inventory_gated_navigation import ChartNode,ChartLink,ChartFragment,_chart_decode
from agents.yf_arc3_v5.capabilities.mechanical_family_contracts_a import MechanicalFamilyScope

def digest(x):return sha256(json.dumps(x,sort_keys=True,separators=(",",":")).encode()).hexdigest()
def rectangles(rows):
 h=len(rows);w=len(rows[0]);out=[]
 for n in range(5,min(12,h,w),2):
  for y in range(h-n+1):
   for x in range(w-n+1):
    v=rows[y][x+1]
    if any(rows[yy][xx]!=v for xx,yy in[(x+i,y)for i in range(1,n-1)]+[(x+i,y+n-1)for i in range(1,n-1)]+[(x,y+i)for i in range(1,n-1)]+[(x+n-1,y+i)for i in range(1,n-1)]):continue
    corners=[rows[yy][xx]for yy in(y,y+n-1)for xx in(x,x+n-1)]
    if len(set(corners))!=1:continue
    cx,cy=x+n//2,y+n//2;inside=[rows[yy][xx]for yy in range(y+1,y+n-1)for xx in range(x+1,x+n-1)if(xx,yy)!=(cx,cy)]
    if all(p==v for p in inside):continue
    out.append({'center':[cx,cy],'bbox':[x,y,x+n-1,y+n-1],'size':n,'edge':v,'corner':corners[0],'inside':inside[0]if len(set(inside))==1 else None,'center_value':rows[cy][cx]})
 return out

def measure(rows,obs):
 rect=rectangles(rows);markers=[r for r in rect if r['corner']!=r['edge']and r['center_value']==r['corner']and r['inside']is not None]
 charts=[]
 for marker in markers:
  ns=[r for r in rect if r['size']==marker['size']and r['edge']==marker['edge']];deltas=[abs(a['center'][i]-b['center'][i])for a in ns for b in ns for i in(0,1)if a['center'][1-i]==b['center'][1-i]and abs(a['center'][i]-b['center'][i])>marker['size']]
  if not deltas:continue
  pitch=min(deltas);links=[]
  for a in ns:
   for b in ns:
    dx=b['center'][0]-a['center'][0];dy=b['center'][1]-a['center'][1]
    if abs(dx)+abs(dy)!=pitch or(dx and dy):continue
    sx=(dx>0)-(dx<0);sy=(dy>0)-(dy<0);half=a['size']//2;gap=[rows[a['center'][1]+sy*i][a['center'][0]+sx*i]for i in range(half+1,pitch-half)]
    if not gap or len(set(gap))!=1 or gap[0]==a['edge']:continue
    links.append({'from':a['center'],'to':b['center'],'delta':[sx,sy],'annotation':gap[0]})
  reached={tuple(marker['center'])}
  for _ in ns:
   reached|={tuple(l['to'])for l in links if tuple(l['from'])in reached}
  nodes=[n for n in ns if tuple(n['center'])in reached];edges=[l for l in links if tuple(l['from'])in reached and tuple(l['to'])in reached]
  if len(nodes)<3 or len([n for n in nodes if n['corner']!=n['edge']])!=1:continue
  slots=[r for r in rect if r['size']!=marker['size']and r['edge']==marker['edge']and r['corner']==r['edge']and r['bbox'][1]>max(n['bbox'][3]for n in nodes)]
  groups={}
  for r in slots:groups.setdefault((r['size'],r['edge'],r['bbox'][1]),[]).append(r)
  candidates=[g for g in groups.values()if len(g)>=2]
  if len(candidates)!=1:continue
  slots=candidates[0];bottom=min(r['bbox'][1]for r in slots);bg=Counter(rows[y][x]for s in slots for y in range(s['bbox'][1]+1,s['bbox'][3])for x in range(s['bbox'][0]+1,s['bbox'][2])).most_common(1)[0][0]
  chart={'nodes':nodes,'links':edges,'current':marker['center'],'origin':marker['center'],'pitch':pitch,'goal_annotation_hypothesis':marker['inside'],'slots':slots,'slot_background':bg,'field_bottom':bottom,'evidence':[obs['observation_ref']],'epoch':obs['level_epoch']}
  charts.append(chart)
 return charts[0]if len(charts)==1 else None

def inventory(rows,chart):
 return sorted({rows[y][x]for s in chart['slots']for y in range(s['bbox'][1]+1,s['bbox'][3])for x in range(s['bbox'][0]+1,s['bbox'][2])if rows[y][x]not in(chart['slot_background'],s['edge'])})
def scene(rows,chart):return digest(rows[:chart['field_bottom']])
def decoded(chart,obs):
 ref=lambda p:'chart-node:'+digest(p)
 frag=ChartFragment(chart_ref='chart:'+digest(chart['evidence']),lattice_ref='current-measured-pitch',measured_origin=tuple(chart['origin']),measured_pitch=(chart['pitch'],chart['pitch']),nodes=tuple(ChartNode(chart_node_ref=ref(n['center']),point=tuple(n['center']),signature_refs=('appearance:'+digest(n),),static_key_type_refs=(),static_door_refs=(),disclosed=True)for n in chart['nodes']),links=tuple(ChartLink(from_ref=ref(l['from']),to_ref=ref(l['to']),direction_ref='delta:'+str(l['delta']),supported_evidence_ref=obs['observation_ref'])for l in chart['links']),current_marker_alternatives=(ref(chart['current']),),corner_anchor_refs=(obs['observation_ref'],))
 scope=MechanicalFamilyScope(request_ref='decode-current-chart',caller_ref='chart-navigation',parent_goal_ref='level-composition',parent_contribution_ref='measured-chart',epoch=obs['level_epoch'],evidence_revision_ref=obs['observation_ref'],model_revision_ref=obs['frame_hash'],model_status_ref='geometry_only',event_owner_ref=obs['observation_ref'],input_domain_complete=False,assumption_refs=('chart-is-navigation-hypothesis',))
 req=SimpleNamespace(charts=(frag,),maximum_evaluations=4096,scope=scope,operation_ref='mechanics.charted_room_navigation.decode_chart',mode='MEASURE')
 return _chart_decode(req).model_dump(mode='json')

def route(chart,start,target,excluded,blocked):
 queue=deque([(start,[])]);seen={tuple(start)}
 while queue:
  node,path=queue.popleft()
  if node==target:return path
  for e in chart['links']:
   nxt=tuple(e['to'])
   if e['from']!=node or nxt in seen or(str(e['from'])+'>'+str(e['to']))in blocked or(nxt in excluded and e['to']!=target):continue
   seen.add(nxt);queue.append((e['to'],path+[e]))
 return None
