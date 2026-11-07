"""Finite simple-cover construction; the requested cover is an experimental goal."""
import time
from agents.yf_arc3_v5.capabilities.single_visit_residual_d import SingleVisitResidualRequestD,measure_single_visit_residual_d
from rooted_quota_methods import plain
from terminal_composition import identity

def construct(scene,obs,remaining,deadline):
    nx,ny=scene['geometry']['shape'];nodes=[(x,y)for y in range(ny)for x in range(nx)]
    if len(nodes)>64:return None
    prefix=[tuple(c)for c in scene['prefix']];end=tuple(scene['receiver_hypothesis']['cell'])
    if len(nodes)-len(prefix)>remaining:return None
    edges=[tuple(map(tuple,e))for e in scene['allowed_edges_hypothesis']];adj={n:[]for n in nodes}
    for a,b in edges:adj[a].append(b);adj[b].append(a)
    ref=lambda n:f'cell:{n[0]}:{n[1]}'
    scope={'request_ref':'trace:'+identity([obs['observation_ref'],scene]),'caller_ref':'public_trace_composition','parent_consumer_ref':'SRC_composition','parent_goal_ref':'G_official_completion','parent_contribution_ref':'experimental_simple_cover','caller_next_item_ref':obs['observation_ref'],'epoch':obs['level_epoch'],'evidence_revision_ref':obs['observation_ref'],'model_revision_ref':scene['geometry_ref'],'model_status_ref':'conditional_visible_separator_graph','event_owner_ref':'SRC','input_domain_complete':True,'assumption_refs':['finite_measured_cell_domain_only','simple_path_and_endpoint_last_define_requested_experiment_not_acquired_game_law','thin_separator_passage_is_hypothesis','hollow_marker_terminal_role_unknown']}
    request=SingleVisitResidualRequestD(scope=scope,operation_ref='mechanics.coverage_partition.single_visit_residual',mode_ref='PROPAGATE',requested_result_type='DMechanicalResult',node_bound=100000,depth_bound=4096,domain_bound=4096,time_bound_ms=max(1,min(300000,int((deadline-time.perf_counter())*1000))),phase_ref='RESIDUAL_GRAPH',graph_revision_ref=scene['geometry_ref'],node_refs=[ref(n)for n in nodes],edges=[{'edge_ref':f'e:{i}','first_ref':ref(a),'second_ref':ref(b)}for i,(a,b)in enumerate(edges)],head_ref=ref(prefix[-1]),endpoint_ref=ref(end),visited_node_refs=[ref(n)for n in prefix],remaining_node_refs=[ref(n)for n in nodes if n not in prefix],ordered_prefix=[ref(n)for n in prefix],append_only_projection_certified=False,simple_path_law_supported=True,endpoint_last_visit_law_supported=True,licensed_bipartite_parity=True)
    receipt=plain(measure_single_visit_residual_d(request).model_dump())
    if receipt['status']!='COMPLETE'or receipt['values'].get('contradiction_certificates'):return None
    forbidden=set(receipt['values'].get('forbidden_edge_refs',[]))
    for i,(a,b)in enumerate(edges):
        if f'e:{i}'in forbidden:adj[a].remove(b);adj[b].remove(a)
    count=0;allnodes=set(nodes)
    def dfs(path):
        nonlocal count
        count+=1
        if count>100000 or time.perf_counter()>=deadline:return None
        unseen=allnodes-set(path);head=path[-1]
        if not unseen:return path if head==end else None
        if head==end:return None
        residual=unseen|{head};seen={head};todo=[head]
        while todo:
            for v in adj[todo.pop()]:
                if v in residual and v not in seen:seen.add(v);todo.append(v)
        if seen!=residual:return None
        if any(sum(q in residual for q in adj[v])<(1 if v in(head,end)else 2)for v in residual):return None
        for q in sorted((q for q in adj[head]if q in unseen),key=lambda q:(sum(v in unseen for v in adj[q]),q)):
            result=dfs(path+[q])
            if result:return result
        return None
    result=dfs(prefix)
    return {'path':[list(n)for n in result],'receipt':receipt,'search_nodes':count,'scope':'Exact witness only in the supplied experimental graph, not an environment terminal proof.'}if result else None
