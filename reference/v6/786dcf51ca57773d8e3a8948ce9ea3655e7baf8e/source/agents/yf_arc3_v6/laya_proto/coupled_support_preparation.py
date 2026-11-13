"""Counterfactual support preparation around the existing joint-state calculator.

Virtual erasure is a question, never physical evidence. Point selection and a
borrowed control mapping are one-step experiments until their replies arrive.
"""
import copy
from collections import deque
from coupled_pair_observation import description,joint_route,pairs
from terminal_composition import identity

def patch(rows,b):return [list(row[b[1]:b[3]+1])for row in rows[b[0]:b[2]+1]]
def put(rows,b,content):
    for y,row in enumerate(content):
        for x,v in enumerate(row):rows[b[0]+y][b[1]+x]=v
def translate(b,d):return [b[0]+d[0],b[1]+d[1],b[2]+d[0],b[3]+d[1]]
def inside(rows,b):return b[0]>=0 and b[1]>=0 and b[2]<len(rows)and b[3]<len(rows[0])

def controls(state,available):
    moves={};signs=[set(),set()]
    for a,ss in state['samples'].items():
        ds={tuple(x['deltas'][0])for x in ss if any(x['deltas'][0])}
        if len(ds)==1 and a in available:moves[a]=next(iter(ds))
        for s in ss:
            for axis in (0,1):
                u,v=s['deltas'][0][axis],s['deltas'][1][axis]
                if u and v and abs(u)==abs(v):signs[axis].add(1 if u*v>0 else -1)
    return (moves,[next(iter(x))for x in signs])if all(len(x)==1 for x in signs)else(None,None)

def current_pair(rows,known):
    matches=[p for p in pairs(rows)if p['size']==known['size']and sorted(p['boxes'])==sorted(known['boxes'])]
    if len(matches)!=1:return None
    p=matches[0];p['boxes']=copy.deepcopy(known['boxes']);return p

def occurrences(rows,pair,floor):
    q=pair['size'];oy,ox=pair['boxes'][0][0]%q,pair['boxes'][0][1]%q;_,cs,_=description(tuple(map(tuple,rows)));out=[]
    for c in cs.components:
        if not(0<c.area<q*q and c.bbox.width<q and c.bbox.height<q and c.value!=floor):continue
        y=oy+((c.bbox.top-oy)//q)*q;x=ox+((c.bbox.left-ox)//q)*q;b=[y,x,y+q-1,x+q-1]
        if not inside(rows,b)or c.bbox.bottom>b[2]or c.bbox.right>b[3]:continue
        p=patch(rows,b);values={v for row in p for v in row}
        if values!={floor,c.value}:continue
        # The whole cell must contain just this measured compact occurrence.
        if sum(v!=floor for row in p for v in row)!=c.area:continue
        out.append({'box':b,'point':{'x':(c.bbox.left+c.bbox.right)//2,'y':(c.bbox.top+c.bbox.bottom)//2},'patch':p,'occurrence_ref':'support:'+identity([b,p])[:20]})
    return out if len(out)<=6 else []

def erased(rows,items,floor):
    result=[list(r)for r in rows]
    for item in items:
        b=item['box'];put(result,b,[[floor]*(b[3]-b[1]+1)for _ in range(b[2]-b[0]+1)])
    return result

def group_route(rows,pair,moves,signs,floor,remaining,evidence):
    return joint_route(rows,pair,moves,[floor],signs,remaining,evidence,True)

def select_question(rows,state,available,remaining,parked):
    if 'ACTION6'not in available or len(state['floors'])!=1:return None
    pair=current_pair(rows,state['pair']);moves,signs=controls(state,available)
    if not pair or not moves:return None
    floor=state['floors'][0];items=[x for x in occurrences(rows,pair,floor)if x['box']not in parked]
    if not items:return None
    virtual=erased(rows,items,floor);route=group_route(virtual,pair,moves,signs,floor,remaining,state['evidence'])
    if not route:return None
    # Select the first actually occupied support on the conditional pair path.
    ranked=[]
    for item in items:
        visits=[i for i,bs in enumerate(route['expected'])if item['box']in bs]
        if visits:ranked.append((min(visits),item['occurrence_ref'],item))
    if not ranked:return None
    item=min(ranked,key=lambda x:x[:2])[2]
    return {'item':item,'pair':pair,'moves':moves,'signs':signs,'floor':floor,'virtual_route':route,'virtual_removed':[x['occurrence_ref']for x in items],'question':'Test whether this currently visible support occurrence can be selected for preparing the conditional joint path; point meaning and control mode are unknown.'}

def parking_route(rows,state,aux,available,remaining):
    pair=current_pair(rows,state['pair']);moves,signs=controls(state,available)
    if not pair or not moves:return None
    floor=aux['floor'];q=pair['size'];start=aux['box'];body=aux['selected_patch'];all_items=occurrences(rows,pair,floor)
    others=[x for x in all_items if x['box']!=start and x['box']not in aux['parked']]
    virtual=erased(rows,others,floor);put(virtual,start,[[floor]*q for _ in range(q)])
    actual=[list(r)for r in rows];put(actual,start,[[floor]*q for _ in range(q)])
    # Reuse the joint calculator as the conditional consumer of each support pose.
    helper_moves={**moves,**{a:tuple(v['delta'])for a,v in aux.get('recalled_moves',{}).items()if a in available},**{a:tuple(d)for a,d in aux.get('measured_moves',{}).items()if a in available}}
    parent={tuple(start):None};queue=deque([tuple(start)]);max_depth=min(16,remaining);depth={tuple(start):0}
    while queue and len(parent)<=256:
        pos=queue.popleft();b=list(pos);trial=[list(r)for r in virtual];put(trial,b,body)
        route=group_route(trial,pair,moves,signs,floor,remaining,state['evidence'])
        if route:
            path=[];node=pos
            while parent[node]is not None:
                prior,action=parent[node];path.append({'action_ref':action,'from':list(prior),'to':list(node),'mapping_observed':action in aux.get('measured_moves',{})});node=prior
            return {'path':list(reversed(path)),'joint_length':len(route['actions']),'states':len(parent),'scope':'Conditional parking pose preserves an available joint route after unresolved supports are virtually prepared. Not evidence that erasure or selection is physical.'}
        if depth[pos]>=max_depth:continue
        for action,delta in helper_moves.items():
            dest=translate(b,delta);key=tuple(dest)
            if key in parent or not inside(rows,dest)or any(v!=floor for row in patch(actual,dest)for v in row):continue
            parent[key]=(pos,action);depth[key]=depth[pos]+1;queue.append(key)
    return None

def group_control_question(rows,state,aux,available):
    pair=current_pair(rows,state['pair']);moves,signs=controls(state,available)
    if not pair or not moves:return None
    for action,delta in moves.items():
        expected=[translate(pair['boxes'][0],delta),translate(pair['boxes'][1],(delta[0]*signs[0],delta[1]*signs[1]))]
        if all(inside(rows,b)and all(v==aux['floor']for row in patch(rows,b)for v in row)for b in expected):
            return {'action_ref':action,'pair_before':pair,'expected':expected,'helper_box':aux['box'],'helper_patch_before':patch(rows,aux['box']),'question':'Discriminate actual paired control from auxiliary control with a previously measured paired displacement toward two visibly free supports. Appearance alone is not evidence of control. Preserve the parked auxiliary and stop if the physical response is ambiguous.'}
    return None

def group_control_response(rows,later,detail):
    expected=detail['expected'];known=detail['pair_before'];found=[p for p in pairs(later)if p['size']==known['size']and sorted(p['boxes'])==sorted(expected)]
    allowed={(y,x)for b in known['boxes']+expected for y in range(b[0],b[2]+1)for x in range(b[1],b[3]+1)}
    extra=sum(rows[y][x]!=later[y][x]for y in range(1,len(rows)-1)for x in range(1,len(rows[0])-1)if(y,x)not in allowed)
    helper_preserved=patch(later,detail['helper_box'])==detail['helper_patch_before'];matched=len(found)==1 and not extra and helper_preserved
    pair=found[0]if matched else None
    if pair:pair['boxes']=copy.deepcopy(expected)
    return {'matched':matched,'pair_after':pair,'extra_effect_count':extra,'helper_preserved':helper_preserved,'scope':'Actual pair displacement after return attempts; no marginal causal attribution to a particular return input.'}
