"""Measured graph changes as instrumental subgoals; no supplied reaction order."""
from collections import Counter,deque
from alternating_graph_observation import description,histogram,overlays

def topology(rows,actor,calibration):
    q=actor['size'];pitch=calibration['alternating_material_full_step_pitch'];first=calibration['alternating_material_first_value'];links=set(calibration['alternating_material_connector_values']);r,c=actor['bbox'][:2]
    if pitch!=2*q:return None
    _,components,scene=description(tuple(map(tuple,rows)));nodes=set();connectors=[];targets=[]
    for s in scene.sprites:
        b=s.bbox
        if b.height==q and b.width==q and not s.touches_frame_boundary and (b.top-r)%pitch==0 and (b.left-c)%pitch==0:
            h=histogram(rows,[b.top,b.left,b.bottom,b.right]);pos=(b.top,b.left)
            if len(h)>1:nodes.add(pos)
            elif h[0][0]==first:nodes.add(pos)
            elif h[0][0]not in links:nodes.add(pos);targets.append(pos)
    for s in components.components:
        b=s.bbox
        if b.width!=q or b.height!=q or s.area!=q*q or s.touches_frame_boundary:continue
        pos=(b.top,b.left)
        if s.value==first and (pos[0]-r)%pitch==0 and (pos[1]-c)%pitch==0:nodes.add(pos)
        elif s.value in links:connectors.append(pos)
    edges={n:set()for n in nodes}
    for y,x in connectors:
        pairs=[]
        if (y-r)%pitch==0 and (x-c-q)%pitch==0:pairs.append(((y,x-q),(y,x+q)))
        if (y-r-q)%pitch==0 and (x-c)%pitch==0:pairs.append(((y-q,x),(y+q,x)))
        for a,b in pairs:
            if a in nodes and b in nodes:edges[a].add(b);edges[b].add(a)
    if len(nodes)<4 or len(set(targets))!=1:return None
    guards=[]
    for a in overlays(rows):
        if a['bbox']==actor['bbox']or a['size']!=q:continue
        pos=tuple(a['bbox'][:2])
        if pos not in nodes:continue
        singular=[v for v,n in a['histogram']if n==1]
        offsets=[(2*y-q+1,2*x-q+1)for y in range(q)for x in range(q)if len(a['histogram'])==2 and len(singular)==1 and rows[pos[0]+y][pos[1]+x]==singular[0]]
        if len(offsets)!=1 or not((offsets[0][0]==0)!=(offsets[0][1]==0)):return None
        dy,dx=offsets[0];front=(pos[0]+(1 if dy>0 else -1 if dy<0 else 0)*pitch,pos[1]+(1 if dx>0 else -1 if dx<0 else 0)*pitch)
        guards.append({'position':pos,'front':front,'histogram':a['histogram'],'bbox':a['bbox']})
    return {'nodes':nodes,'edges':edges,'target':targets[0],'guards':guards,'pitch':pitch,'first':first}

def instrumental_contact(rows,actor,controls,calibration,removals,remaining):
    graph=topology(rows,actor,calibration)
    if not graph or not graph['guards']:return None
    compatible=[g for g in graph['guards']if any(r['guard_histogram']==g['histogram']and r['size']==actor['size']for r in removals)]
    if not compatible:return None
    guards=graph['guards'];indices={g['position']:i for i,g in enumerate(guards)};can_remove={i for i,g in enumerate(guards)if g in compatible};start=(tuple(actor['bbox'][:2]),0);queue=deque([start]);parents={start:None};depth={start:0};final=None;examined=0
    while queue and examined<512:
        state=queue.popleft();pos,removed=state;examined+=1
        if pos==graph['target']:final=state;break
        if depth[state]>=remaining:continue
        for action,delta in sorted(controls.items()):
            dest=(pos[0]+delta[0],pos[1]+delta[1])
            if dest not in graph['edges'].get(pos,()):continue
            if any(dest==g['front']and not removed&(1<<i)for i,g in enumerate(guards)):continue
            changed=removed;i=indices.get(dest)
            if i is not None and not removed&(1<<i):
                if i not in can_remove:continue
                changed|=1<<i
            nxt=(dest,changed)
            if nxt in parents:continue
            parents[nxt]=(state,action,i if changed!=removed else None);depth[nxt]=depth[state]+1;queue.append(nxt)
    if final is None:return None
    path=[];s=final
    while parents[s]is not None:
        old,action,contact=parents[s];path.append({'action_ref':action,'from':list(old[0]),'to':list(s[0]),'contact_index':contact});s=old
    path.reverse();first=next((i for i,s in enumerate(path)if s['contact_index']is not None),None)
    if first is None:return None
    guard=guards[path[first]['contact_index']]
    return {'prefix':path[:first+1],'guard':guard,'counterfactual_complete_length':len(path),'examined':examined,'node_count':len(graph['nodes']),'edge_count':sum(map(len,graph['edges'].values()))//2,'evidence':[e for r in removals if r['guard_histogram']==guard['histogram']for e in r['evidence']],'scope':'Conditional graph-change path. Removal is supported only by a previous contact followed by revealed ordinary support; transfer of side/rear applicability is a hypothesis. Prefix ends at first contact; no unobserved full reactive order supplied.'}
