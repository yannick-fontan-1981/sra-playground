"""Bounded terrain-only contact counts, independent of service-actor availability."""
from collections import deque


def measure_transfer_lower_bounds(frame, starts, sizes, goals, floors, transit,
                                 quantum, distance, contract, *, known_support=()):
    """0/1 graph: ordinary translation costs zero, a recalled impulse costs one.

    Other movable bodies are transparent for this lower bound. A path does not
    attest that a launcher can reach its required contact. Current service
    witnesses must establish that separately before DRM can select an action.
    """
    minimum_shapes=int(contract.get('minimum_distinct_body_shapes',0))
    if not minimum_shapes or len(set(sizes))<minimum_shapes:
        return {'complete':False,'reason':'shape_scope_absent'}
    if not starts or quantum<=0 or distance<=0 or distance%quantum:
        return {'complete':False,'reason':'incomplete_contact_geometry'}
    def pixels(pos,size):
        return {(r,c) for r in range(pos[0],pos[0]+size[0])
                      for c in range(pos[1],pos[1]+size[1])}
    current_support=set(known_support).union(*(pixels(p,s) for p,s in zip(starts,sizes)))
    goal_support=set().union(*(pixels((p[0]-1,p[1]-1),(s[0]+2,s[1]+2))
                              for p,s in zip(goals,sizes)))
    expanded=0;counts=[]
    for start,size,goal in zip(starts,sizes,goals):
        def valid(pos,crossing=False):
            r,c=pos;h,w=size
            if r<0 or c<0 or r+h>frame.height or c+w>frame.width:return False
            allowed=transit if crossing else floors
            return all(p in current_support or p in goal_support or frame.rows[p[0]][p[1]] in allowed
                       for p in pixels(pos,size))
        costs={start:0};pending=deque(((start,0),));result=None
        while pending:
            if len(costs)>int(contract['max_states_per_body']):
                return {'complete':False,'reason':'body_state_bound','expanded':expanded}
            pos,cost=pending.popleft()
            if costs[pos]!=cost:continue
            expanded+=1
            if expanded>int(contract['max_total_state_expansions']):
                return {'complete':False,'reason':'state_expansion_bound','expanded':expanded}
            if pos==goal:result=cost;break
            for dy,dx in ((-quantum,0),(quantum,0),(0,-quantum),(0,quantum)):
                dest=(pos[0]+dy,pos[1]+dx)
                if valid(dest) and cost<costs.get(dest,10**9):
                    costs[dest]=cost;pending.appendleft((dest,cost))
                uy,ux=dy//quantum,dx//quantum
                if not all(valid((pos[0]+uy*n,pos[1]+ux*n),True)
                           for n in range(quantum,distance+quantum,quantum)):continue
                landing=(pos[0]+uy*distance,pos[1]+ux*distance)
                for _ in range(int(contract['max_continuation_steps'])):
                    if valid(landing):break
                    landing=(landing[0]+dy,landing[1]+dx)
                    if not valid(landing,True):break
                if valid(landing) and cost+1<costs.get(landing,10**9):
                    costs[landing]=cost+1;pending.append((landing,cost+1))
                if len(costs)>int(contract['max_states_per_body']):
                    return {'complete':False,'reason':'body_state_bound','expanded':expanded}
        if result is None:
            return {'complete':False,'reason':'goal_outside_recalled_model','expanded':expanded}
        counts.append(result)
    return {'complete':True,'minimum_transfers':tuple(counts),'expanded':expanded,
            'actor_contact_feasibility_proved':False}
