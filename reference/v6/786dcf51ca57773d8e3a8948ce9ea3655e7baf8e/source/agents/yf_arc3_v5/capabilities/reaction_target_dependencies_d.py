"""Exact reverse closure of supplied directed edges for each requested target."""
from collections import deque
from agents.yf_arc3_v5.logos.types import FrozenMap


def reaction_target_dependencies_d(request,remaining_evaluations):
    elements=request.state.elements;edges=request.edges
    remaining=tuple(ref for ref in request.required_target_refs if ref not in request.state.acquired_target_refs)
    work=len(elements)+len(edges)+len(request.required_target_refs)
    work+=len(remaining)*(len(elements)*8+len(edges)*8+1)
    if work>remaining_evaluations:
        return FrozenMap({'target_predecessor_projection_complete':False,
            'target_predecessor_information_need_refs':('reaction_targets.reverse_closure_budget',),'evaluations':0})
    incoming={}
    for index,edge in enumerate(edges):incoming.setdefault(edge.target_ref,[]).append((index,edge))
    rows=[];missing=[];union=set()
    for ref in remaining:
        receivers=tuple(row.element_ref for row in elements if row.target_ref==ref)
        if not receivers:missing.append('reaction_targets.current_requested_target_binding');continue
        visited=set(receivers);queue=deque(receivers);edge_indices=set()
        while queue:
            receiver=queue.popleft()
            for index,edge in incoming.get(receiver,()):
                edge_indices.add(index)
                if edge.source_ref not in visited:visited.add(edge.source_ref);queue.append(edge.source_ref)
        union.update(visited)
        rows.append(FrozenMap({'target_ref':ref,'target_element_refs':receivers,
            'predecessor_element_refs':tuple(sorted(visited)),
            'directed_predecessor_edge_indices':tuple(sorted(edge_indices)),
            'relay_edge_indices':tuple(index for index in sorted(edge_indices) if edges[index].relay_cell is not None),
            'current_primed_predecessor_refs':tuple(row for row in request.state.primed_refs if row in visited)}))
    return FrozenMap({'target_predecessor_projection_complete':not missing,
        'target_predecessor_information_need_refs':tuple(dict.fromkeys(missing)),
        'remaining_requested_target_refs':remaining,'target_predecessor_rows':tuple(rows),
        'target_predecessor_refs':tuple(sorted(union)),'evaluations':work,
        'predecessor_membership_does_not_prove_event_delivery':True})
