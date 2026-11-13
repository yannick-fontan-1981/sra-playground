"""Bounded hypothetical displacement closure for a linear contact cascade."""


def measure_contact_cascade(*, frame, starts, sizes, primary, initiator,
        contact_position, delta, quantum, nominal_distance, floors, transit,
        underlay_support, goal_support, protected, contract):
    """Return a geometric prediction, never an observed or acquired mechanism.

    Each encountered body receives the same displacement quantum. Branching,
    cycles, protected participants and blocked/partial propagation are excluded.
    The primary impulse alone owns the nominal extent and clearing condition.
    """
    if not contract or not contract.get('recursive_same_quantum_hypothesis'):
        return {'complete':False}
    if len(starts)>int(contract['max_bodies']) or primary==initiator:
        return {'complete':False}
    dy,dx=delta
    if bool(dy)==bool(dx) or abs(dy)+abs(dx)!=quantum or nominal_distance%quantum:
        return {'complete':False}
    positions=list(starts);positions[initiator]=contact_position
    original=tuple(positions);edges=set();expanded=0
    def pixels(index,pos):
        h,w=sizes[index]
        return {(r,c) for r in range(pos[0],pos[0]+h) for c in range(pos[1],pos[1]+w)}
    def valid(index,pos,crossing):
        r,c=pos;h,w=sizes[index]
        if r<0 or c<0 or r+h>frame.height or c+w>frame.width:return False
        allowed=transit if crossing else floors
        return all(p in underlay_support or p in goal_support or frame.rows[p[0]][p[1]] in allowed
                   for p in pixels(index,pos))
    def advance(index,visiting):
        nonlocal expanded
        expanded+=1
        if expanded>int(contract['max_total_state_expansions']):return False
        if index in visiting or index==initiator or index in protected:return False
        if len(visiting)>=int(contract['max_contact_depth']):return False
        dest=(positions[index][0]+dy,positions[index][1]+dx)
        if not valid(index,dest,True):return False
        footprint=pixels(index,dest)
        collided=tuple(j for j,p in enumerate(positions) if j!=index and footprint & pixels(j,p))
        if len(collided)>1:return False
        for peer in collided:
            if not advance(peer,(*visiting,index)):return False
            edges.add((index,peer))
        positions[index]=dest
        return True
    maximum=nominal_distance//quantum+int(contract['max_continuation_steps'])
    for step in range(maximum+1):
        if step>=nominal_distance//quantum and valid(primary,positions[primary],False):
            affected=tuple(i for i,(a,b) in enumerate(zip(original,positions)) if a!=b)
            if len(affected)<int(contract['minimum_affected_bodies']):return {'complete':False,'expanded':expanded}
            if not all(valid(i,positions[i],False) for i in affected):return {'complete':False,'expanded':expanded}
            return {'complete':True,'positions':tuple(positions),'affected_indices':affected,
                    'contact_edges':tuple(sorted(edges)),'expanded':expanded,'hypothesis':True}
        if step==maximum or not advance(primary,()):break
    return {'complete':False,'expanded':expanded}
