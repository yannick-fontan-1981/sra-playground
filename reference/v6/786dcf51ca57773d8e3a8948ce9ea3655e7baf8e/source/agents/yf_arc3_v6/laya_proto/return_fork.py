"""Find an untried continuation after a repeated input returned to the epoch's first observation."""
def closed_return_contrast(graph,episode,index,capacity):
    if len(episode)<2 or capacity<2:return None
    entry=episode[0][0]
    if (graph.nodes[index]['protocol']['frame_hash']!=entry.frame_hash
            or episode[-1][2].frame_hash!=entry.frame_hash):return None
    path=[]
    for before,key,after in reversed(episode):
        if before.epoch!=entry.epoch or after.epoch!=entry.epoch or before.score!=after.score:return None
        path.append((before,key,after))
        if before.frame_hash==entry.frame_hash:break
    path.reverse()
    if not 2<=len(path)<=capacity or len({key for _,key,_ in path})!=1:return None
    if len({b.frame_hash for b,_,_ in path})!=len(path):return None
    edges=[]
    for before,key,after in path:
        origin=graph.observations.get(before.ref,{}).get('index');dest=graph.observations.get(after.ref,{}).get('index')
        if origin is None or dest is None:return None
        candidates=[edge for edge in graph.edges.values() if edge['source']==origin and edge['target']==dest and edge['action']['action_ref']==key and not edge['action'].get('data')]
        if len(candidates)!=1:return None
        edge=candidates[0]
        if set(graph.nodes[origin]['attempts'][edge['action_key']]['outcomes'])!={dest}:return None
        edges.append(edge)
    last=edges[-1];questions=graph._open(last['source'])
    if not questions:return None
    evidence=[edge['evidence_refs'][-1] for edge in edges]
    return edges[:-1],{**questions[0],'reason':'contrast_an_untried_continuation_at_the_last_fork_before_observed_return',
        'hypothesis_refs':evidence,'return_focus':{'entry_ref':entry.ref,'return_ref':path[-1][2].ref,'observed_repeated_command':path[-1][1],
        'access_steps':len(path)-1,'falsifier':'A different intermediate public projection cancels the suffix; the alternate input may also return without score.'}}

def closed_observed_path_return(path):
    """A closed observed projection path, including distinct pointed commands.

    This is not a reset law or an action prohibition. Consumers may contrast
    equally admissible branches; source/epoch scope is supplied by the caller.
    """
    if len(path)<2:return None
    end=path[-1]['after_key'];starts=[i for i,e in enumerate(path[:-1])if e['before_key']==end]
    for i in reversed(starts):
        cycle=path[i:]
        if len({e['before_key']for e in cycle})!=len(cycle):continue
        if any(a['after_key']!=b['before_key']for a,b in zip(cycle,cycle[1:])):continue
        return {'path':cycle,'return_key':end,'evidence_refs':[e['after_ref']for e in cycle],'scope':'Observed return of the selected public projection without score; individual actions and local effects are not refuted.'}
    return None
