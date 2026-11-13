"""Generic finite joint transport calculation ported from qualified donor; supplied model remains conditional."""
from collections import Counter,deque
import time
from geometric_observer import components

def measure(rows,remembered_targets=None):
    h,w=len(rows),len(rows[0]);parts=components(rows)
    squares=[p for p in parts if p['rectangular'] and p['bbox'][2]-p['bbox'][0]==p['bbox'][3]-p['bbox'][1] and 4<=p['bbox'][2]-p['bbox'][0]+1<=12]
    tally=Counter(p['bbox'][2]-p['bbox'][0]+1 for p in squares)
    if not tally:raise ValueError('No repeated macro-cell support')
    scale=max(tally,key=lambda s:(tally[s]*s*s,s));same=[p for p in squares if p['bbox'][2]-p['bbox'][0]+1==scale]
    offsets=Counter((p['bbox'][0]%scale,p['bbox'][1]%scale) for p in same);ox,oy=offsets.most_common(1)[0][0]
    hud=next((y for y,row in enumerate(rows) if y>h//2 and len(set(row))==1 and row[0]!=rows[0][0]),h)
    floors=set();walls=set();boxes=set();targets=set(remembered_targets or []);players=[];sprites={};unknown=[]
    for y in range(oy,hud-scale+1,scale):
        for x in range(ox,w-scale+1,scale):
            cell=((x-ox)//scale,(y-oy)//scale);tile=[row[x:x+scale] for row in rows[y:y+scale]]
            perimeter={tile[r][c] for r in range(scale) for c in range(scale) if r in (0,scale-1) or c in (0,scale-1)}
            if len(perimeter)!=1:walls.add(cell);continue
            substrate=next(iter(perimeter));foreground={(c,r) for r in range(scale) for c in range(scale) if tile[r][c]!=substrate}
            floors.add(cell)
            if not foreground:continue
            center=tile[scale//2][scale//2]
            if center==substrate:targets.add(cell);sprites[cell]='target';continue
            left=min(c for c,r in foreground);right=max(c for c,r in foreground);top=min(r for c,r in foreground);bottom=max(r for c,r in foreground)
            if len(foreground)==(right-left+1)*(bottom-top+1):boxes.add(cell);sprites[cell]='box'
            else:players.append(cell);sprites[cell]='controller'
    if len(players)!=1:raise ValueError(f'Controlled sprite ambiguity: {len(players)}')
    player=players[0]
    # Only the connected substrate domain around the controlled sprite belongs
    # to the play field. Blank frame margins cannot become navigation cells.
    connected={player};todo=[player]
    for p in todo:
        for dx,dy in ((0,-1),(0,1),(-1,0),(1,0)):
            q=(p[0]+dx,p[1]+dy)
            if q in floors and q not in connected:connected.add(q);todo.append(q)
    floors=connected;boxes&=floors;targets&=floors
    if not boxes or len(boxes)!=len(targets):raise ValueError(f'Occupancy composition unresolved: {len(boxes)} bodies/{len(targets)} loci')
    return {'scale':scale,'offset':(ox,oy),'floor':frozenset(floors),'boxes':frozenset(boxes),'targets':frozenset(targets),'player':player,'wall_count':len(walls),'sprite_count':len(sprites)}

def successor(state,direction,floor):
    player,boxes=state;dx,dy=direction;q=(player[0]+dx,player[1]+dy)
    if q not in floor:return None
    if q not in boxes:return (q,boxes),False
    destination=(q[0]+dx,q[1]+dy)
    if destination not in floor or destination in boxes:return None
    return (q,frozenset((boxes-{q})|{destination})),True

def exact_path(scene,directions,deadline):
    floor=scene['floor'];targets=scene['targets'];safe=set(targets);todo=list(targets)
    for p in todo:
        for dx,dy in directions.values():
            predecessor=(p[0]-dx,p[1]-dy);support=(p[0]-2*dx,p[1]-2*dy)
            if predecessor in floor and support in floor and predecessor not in safe:safe.add(predecessor);todo.append(predecessor)
    if not scene['boxes']<=safe:raise ValueError('Observed body on certified dead cell')
    start=(scene['player'],scene['boxes']);parents={start:None};queue=deque([start]);end=None
    while queue:
        if len(parents)%1024==0 and time.perf_counter()>=deadline:raise ValueError('Level deadline during finite search')
        state=queue.popleft()
        if state[1]==targets:end=state;break
        for action,d in directions.items():
            result=successor(state,d,floor)
            if result is None:continue
            nxt,push=result
            if not nxt[1]<=safe or nxt in parents:continue
            parents[nxt]=(state,action,push);queue.append(nxt)
    if end is None:raise ValueError('No feasible joint transport composition')
    path=[]
    while parents[end] is not None:
        previous,action,push=parents[end];path.append((action,push,end));end=previous
    return list(reversed(path)),len(parents),len(floor-safe)
