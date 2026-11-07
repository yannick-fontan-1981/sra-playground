"""Bounded constraint search over opened sets; no game rules or action authority."""

from heapq import heappop, heappush

from agents.yf_arc3_v5.logos.types import FrozenMap, stable_digest
from .component_network_mechanics import component_rows


def calculate_origin_set_route_words(model, contract, remaining_quantity):
    if contract['cost_measure'] != 'new_cells_then_edges':
        raise ValueError('unsupported Source route cost measure')
    geometry = model['geometry']
    columns, count = int(geometry[8]), int(geometry[7])*int(geometry[8])
    origins, demands = tuple(model['origins']), tuple(model['demands'])
    targets = {node:frozenset(values) for node,values in model['demand_origin_sets']}
    by_display = {value:targets[node] for node,value in demands}
    editable = frozenset(model['editable'])
    unacquired = frozenset(frozenset(values) for values in model['unacquired_origin_sets'])
    deltas = tuple(tuple(d) for d in contract['neighbor_deltas'])
    traversal = tuple(contract['route_descriptions'])
    if len(traversal)>3:
        raise ValueError('Source route-description bound exceeds three')
    adjacency = {}
    for node in sorted(set(model['opened'])|editable):
        row,col=divmod(node,columns)
        adjacency[node]=tuple((row+dr)*columns+col+dc for dr,dc in deltas
            if 0<=row+dr<int(geometry[7]) and 0<=col+dc<columns)
    examined,distance_expansions,bounded,words,failures=0,0,False,[],[]

    def distances(starts, allowed, opened):
        nonlocal distance_expansions,bounded
        local_expansions=0
        queue,values=[],{}
        for node in starts:
            values[node]=(0,0);heappush(queue,(0,0,node))
        while queue:
            cost,depth,node=heappop(queue)
            if values.get(node)!=(cost,depth):
                continue
            distance_expansions+=1;local_expansions+=1
            if local_expansions>int(contract['maximum_expansions']):
                bounded=True;break
            if depth>=int(contract['maximum_path_length']):
                continue
            for other in adjacency[node]:
                if other not in allowed:
                    continue
                value=cost+(other not in opened),depth+1
                if other not in values or value<values[other]:
                    values[other]=value;heappush(queue,(*value,other))
        return values

    def compatible(component, needed):
        return not (component[1]-needed) and all(by_display[v]==needed for v in component[2])

    def separation(demand):
        node,_value=demand;row,col=divmod(node,columns)
        return min(abs(row-origin//columns)+abs(col-origin%columns)
            for origin,pigment in origins if pigment in targets[node])

    for ordinal,description in enumerate(traversal):
        if description=='increasing_separation':
            order=tuple(sorted(demands,key=lambda d:(separation(d),d[0])))
        elif description=='decreasing_separation':
            order=tuple(sorted(demands,key=lambda d:(-separation(d),d[0])))
        elif description=='measurement_order':
            order=tuple(sorted(demands))
        else:
            raise ValueError('unsupported Source route description')
        if contract.get('route_dependency')=='singleton_demands_precede_unacquired_origin_union':
            order=tuple(sorted(order,key=lambda d:targets[d[0]] in unacquired))
        rejected=set()

        def search(opened, word):
            nonlocal examined,bounded
            if bounded or opened in rejected:
                return None
            examined+=1
            if examined>int(contract['maximum_opened_set_states']):
                bounded=True;return None
            components,mapping=component_rows(opened,origins,demands,columns,count,deltas)
            if any(wanted and not compatible(component,by_display[next(iter(wanted))])
                    for component in components for wanted in (component[2],)):
                rejected.add(opened);return None
            pending=tuple(d for d in order if components[mapping[d[0]]][1]!=targets[d[0]])
            if not pending:
                return tuple(word)
            if len(word)>=remaining_quantity:
                rejected.add(opened);return None
            allowed_by_set={}
            for needed in sorted(set(targets.values()),key=lambda values:tuple(sorted(values))):
                allowed=set()
                for node in sorted(opened|editable):
                    touched={mapping[node]} if node in mapping else set()
                    touched.update(mapping[other] for other in adjacency[node] if other in mapping)
                    if all(compatible(components[index],needed) for index in touched):
                        allowed.add(node)
                allowed_by_set[needed]=allowed
            lower_by_set={}
            for target,_value in pending:
                needed=targets[target]
                costs=distances(components[mapping[target]][0],allowed_by_set[needed],opened)
                required=[]
                for pigment in sorted(needed):
                    candidates=[costs[node][0] for node,value in origins
                        if value==pigment and node in costs]
                    if not candidates or bounded:
                        rejected.add(opened);return None
                    required.append(min(candidates))
                lower_by_set[needed]=max(lower_by_set.get(needed,0),max(required))
            if sum(lower_by_set.values())>remaining_quantity-len(word):
                rejected.add(opened);return None
            target,_value=pending[0];needed=targets[target]
            missing=needed-components[mapping[target]][1]
            starts=tuple(node for node,value in origins if value in missing)
            costs=distances(starts,allowed_by_set[needed],opened)
            frontier={other for node in components[mapping[target]][0]
                for other in adjacency[node]
                if other in editable and other not in opened
                and other in allowed_by_set[needed] and other in costs}
            for node in sorted(frontier,key=lambda n:(costs[n],n)):
                result=search(opened|{node},word+(node,))
                if result is not None:
                    return result
                if bounded:
                    break
            rejected.add(opened)
            return None

        word=search(frozenset(model['opened']),())
        if word:
            words.append(FrozenMap({'description_ordinal':ordinal,'description':description,
                'new_cell_indices':word,'primitive_count':len(word),
                'demand_count':len(demands),'all_prefixes_valid':True,
                'word_digest':stable_digest((geometry,word,origins,model['demand_origin_sets']))}))
        else:
            failures.append(FrozenMap({'description_ordinal':ordinal,
                'cause':'expansion_bound' if bounded else 'ordered_opened_set_search_exhausted',
                'rejected_opened_set_count':len(rejected)}))
        if bounded:
            break
    return tuple(words),FrozenMap({'examined_count':examined,'bounded':bounded,
        'distance_expansion_count':distance_expansions,
        'world_impossibility_asserted':False,'description_count':len(traversal),
        'failure_facts':tuple(failures)})
