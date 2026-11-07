"""Bounded raster incidence and conditional calls to existing prefix services.

No labels, palette roles, goal selection or action release are inferred here.
The caller's DRM contract declares the unary-count/prefix interpretation.
Admit disjoint simple paths with one distinctly wider endpoint as root;
turns preserve graph order, while ambiguous roots and branches are rejected.
"""
from collections import Counter, deque

from agents.yf_arc3_v5.logos.types import FrozenMap, stable_digest
from .mechanical_family_contracts_d import DMechanicalScope
from .rooted_prefix_marginals_d import (
    PrefixLengthDomainD, RootedPrefixMarginalsRequestD, measure_rooted_prefix_marginals_d,
)
from .indexed_prefix_primitive_d import (
    PrefixCellD, PrefixQuotaD, RootedPrefixD, IndexedPrefixPrimitiveRequestD,
    measure_indexed_prefix_primitive_d,
)


def _unary_count(components, bounds, horizontal):
    top, left, bottom, right = bounds
    within = tuple(c for c in components if top <= c.bbox.top <= c.bbox.bottom <= bottom
                   and left <= c.bbox.left <= c.bbox.right <= right)
    bars = tuple(c for c in within if c.area == c.bbox.width * c.bbox.height
                 and (c.bbox.height, c.bbox.width) in (((1, 2), (1, 3)) if horizontal else ((2, 1), (3, 1))))
    rings = tuple(c for c in within if c.bbox.width == c.bbox.height == 3 and c.area == 8)
    if rings and not bars and len(rings) == 1:
        return 0
    if not bars or rings or len({(c.value, c.bbox.height, c.bbox.width) for c in bars}) != 1:
        return None
    # Parallel congruent strokes must share one perpendicular anchor.
    if len({c.bbox.left if horizontal else c.bbox.top for c in bars}) != 1:
        return None
    return len(bars)


def _geometry(frame, components, contract):
    rows = frame.rows
    found = []
    for component in components:
        b, value = component.bbox, component.value
        if b.width != b.height or b.width < 7 or b.width >= frame.width:
            continue
        lines = tuple(x for x in range(b.left, b.right + 1)
                      if sum(rows[y][x] == value for y in range(b.top, b.bottom + 1)) * 2 >= b.height)
        if len(lines) < 3 or len(lines) > contract['maximum_side_cells'] + 1:
            continue
        gaps = {v - u for u, v in zip(lines, lines[1:])}
        if len(gaps) != 1 or lines[0] != b.left or lines[-1] != b.right:
            continue
        pitch = next(iter(gaps))
        if pitch < 6 or (b.bottom - b.top) % pitch:
            continue
        n = (b.bottom - b.top) // pitch
        if not 2 <= n <= contract['maximum_side_cells']:
            continue
        if any(sum(rows[y][x] == value for x in range(b.left, b.right + 1)) * 2 < b.width
               for y in range(b.top, b.bottom + 1, pitch)):
            continue
        background = Counter(v for row in rows for v in row).most_common(1)[0][0]
        centers, masks, widths = {}, {}, {}
        for r in range(n):
            for c in range(n):
                y, x = b.top + r * pitch + pitch // 2, b.left + c * pitch + pitch // 2
                centers[r, c] = (y, x)
                interior = tuple(rows[yy][xx] for yy in range(b.top + r * pitch + 1, b.top + (r+1)*pitch)
                                 for xx in range(b.left+c*pitch+1, b.left+(c+1)*pitch))
                modal = Counter(interior).most_common(1)[0][0]
                support = {(yy, xx) for yy in range(b.top+r*pitch+1, b.top+(r+1)*pitch)
                           for xx in range(b.left+c*pitch+1, b.left+(c+1)*pitch) if rows[yy][xx] != modal}
                seen, queue = {(y, x)}, deque(((y, x),))
                while queue:
                    yy, xx = queue.popleft()
                    for p in ((yy-1,xx),(yy+1,xx),(yy,xx-1),(yy,xx+1)):
                        if p in support and p not in seen:
                            seen.add(p)
                            queue.append(p)
                masks[r,c] = seen if (y,x) in support else set()
                widths[r,c] = (sum((y,xx) in seen for xx in range(x-pitch//2+1,x+pitch//2)),
                               sum((yy,x) in seen for yy in range(y-pitch//2+1,y+pitch//2)))
        if any(not masks[cell] for cell in sorted(masks)):
            continue
        adjacency = {cell: set() for cell in centers}
        for cell, (y,x) in sorted(centers.items()):
            r,c = cell
            for other in ((r+1,c),(r,c+1)):
                if other not in centers:
                    continue
                yy,xx = centers[other]
                my,mx = (y+yy)//2,(x+xx)//2
                if rows[my][mx] != value:
                    adjacency[cell].add(other)
                    adjacency[other].add(cell)
        unseen, chains = set(centers), []
        while unseen:
            start = min(unseen)
            group, queue = {start}, deque((start,))
            while queue:
                for p in adjacency[queue.popleft()]:
                    if p not in group:
                        group.add(p)
                        queue.append(p)
            unseen -= group
            ends = tuple(p for p in group if len(adjacency[p]) == 1)
            if len(group) < 2 or len(ends) != 2 or any(len(adjacency[p]) not in (1,2) for p in group):
                break
            # Compare endpoint thickness normal to each endpoint's own edge.
            # A turn changes the local tangent, not the graph's path order.
            # Interior corners can be wider than either endpoint along a row,
            # so they cannot define the root of a bent chain.
            endpoint_widths = {}
            for endpoint in ends:
                neighbor = next(iter(adjacency[endpoint]))
                normal_dimension = 0 if endpoint[0] != neighbor[0] else 1
                endpoint_widths[endpoint] = widths[endpoint][normal_dimension]
            widest = max(endpoint_widths.values())
            roots = tuple(p for p in ends if endpoint_widths[p] == widest)
            if len(roots) != 1 or widest <= min(endpoint_widths.values()):
                break
            order, prior = [roots[0]], None
            while len(order) < len(group):
                options = adjacency[order[-1]] - ({prior} if prior is not None else set())
                if len(options) != 1:
                    break
                prior, next_cell = order[-1], next(iter(options))
                order.append(next_cell)
            if len(order) != len(group):
                break
            states = tuple(rows[centers[p][0]][centers[p][1]] != background for p in order)
            length = sum(states)
            if states != (True,)*length + (False,)*(len(states)-length):
                break
            chains.append((tuple(order), length))
        else:
            counts_r = tuple(_unary_count(components, (b.top+r*pitch+1,max(0,b.left-pitch),
                             b.top+(r+1)*pitch-1,b.left-1),False) for r in range(n))
            counts_c = tuple(_unary_count(components, (max(0,b.top-pitch),b.left+c*pitch+1,
                             b.top-1,b.left+(c+1)*pitch-1),True) for c in range(n))
            if any(q is None for q in counts_r+counts_c) or sum(counts_r) != sum(counts_c):
                continue
            found.append({'box':(b.top,b.left,b.bottom,b.right), 'pitch':pitch, 'side':n,
                          'component_ref':component.component_id, 'centers':centers,
                          'chains':tuple(chains), 'counts':counts_r+counts_c})
    return found


def measure_rooted_prefix_loci(v, frame, components, contract):
    """All singleton-domain edits under a caller-declared revisable model.

    Unsupported, non-singleton, ambiguous, interrupted or contradicted results
    produce no executable witness. A complete empty result is not impossibility.
    """
    if (not contract or frame.width*frame.height > contract['maximum_frame_pixels']
            or len(components)>contract['maximum_components']):
        return ()
    geometries = _geometry(frame, components, contract)
    if len(geometries) != 1 or not v.current_observation_frame_ref:
        return ()
    g = geometries[0]
    token = stable_digest((g['box'],g['pitch'],tuple(order for order,_ in g['chains']),g['counts']))
    evidence = v.current_observation_frame_ref
    carried = v.canonical_dispatched_goal_continuity_facts.get('dispatched_composition_target_context') or {}
    prior_matches = None
    if carried.get('rooted_prefix_geometry_token') == token:
        if (v.previous_action_observed_frame is None or
                carried.get('rooted_prefix_source_frame_digest') != stable_digest(v.previous_action_observed_frame.rows)):
            return ()
        prior_matches = tuple(carried.get('rooted_prefix_expected_lengths',())) == tuple(length for _,length in g['chains'])
        if not prior_matches:
            return ()
    scope = DMechanicalScope(**dict(contract['scope']), request_ref='measurement.prefix.'+token,
        evidence_revision_ref=evidence, model_revision_ref=token, epoch=v.current_context_epoch or 0,
        input_domain_complete=True)
    n = g['side']
    chains = tuple(PrefixLengthDomainD(chain_ref='measurement.chain.'+str(i),
        cells=tuple(PrefixCellD(cell_ref=f'measurement.cell.{r}.{c}',
            marginal_refs=(f'measurement.row.{r}',f'measurement.column.{c}')) for r,c in order),
        length_domain=tuple(range(len(order)+1)), evaluated_length=length)
        for i,(order,length) in enumerate(g['chains']))
    quotas = tuple(PrefixQuotaD(marginal_ref=(f'measurement.row.{i}' if i<n else f'measurement.column.{i-n}'),
                                required_count=count) for i,count in enumerate(g['counts']))
    common = dict(scope=scope, requested_result_type='DMechanicalResult', **dict(contract['bounds']))
    result = measure_rooted_prefix_marginals_d(RootedPrefixMarginalsRequestD(**common,
        operation_ref=contract['marginal_operation_ref'], mode_ref='PROPAGATE',
        phase_ref='INTEGER_QUOTA_CONSTRAINTS', chains=chains, quotas=quotas))
    domains = tuple(tuple(d) for d in result.values.get('retained_domains',()))
    if not result.domain_complete or len(domains) != len(chains) or any(len(d)!=1 for d in domains):
        return ()
    desired = tuple(d[0] for d in domains)
    current = tuple(length for _,length in g['chains'])
    # Recall carries only the extension schema and its real witnesses. Current
    # paths, roots, quotas, rank and payload are always measured afresh.
    extension_laws = tuple(row for row in v.canonical_rooted_prefix_extension_memory_facts
        if row.get('profile_ref') == contract['profile_ref']
        and row.get('relation_ref') == contract['relation_ref']
        and row.get('operator_ref') == contract['point_action_ref']
        and row.get('epistemic_status') == 'supported'
        and row.get('commitment') == 'revisable'
        and row.get('requires_current_revalidation') is True
        and row.get('other_paths_preserved') is True
        and row.get('cut_law_learned') is False
        and row.get('source_claim_ref')
        and 2 <= row.get('support_transition_count', 0) <= 8
        and len(set(row.get('support_transition_refs', ()))) == row.get('support_transition_count'))
    loci = []
    for i,chain in enumerate(chains):
        if current[i] == desired[i]:
            continue
        for rank, cell in enumerate(chain.cells):
            step = measure_indexed_prefix_primitive_d(IndexedPrefixPrimitiveRequestD(**common,
                operation_ref=contract['edit_operation_ref'], mode_ref='STEP', phase_ref='EXTERNAL_COMMAND',
                chains=tuple(RootedPrefixD(chain_ref=ch.chain_ref,cells=ch.cells,filled_length=current[j])
                             for j,ch in enumerate(chains)), quotas=quotas,
                channel='CLICK',bound_chain_ref=chain.chain_ref,bound_rank=rank,
                native_focus_chain_ref=None,native_focus_rank=None,
                inclusive_fill_exclusive_cut_supported=contract['conditional_inclusive_fill_exclusive_cut'],
                focus_initial_selection_supported=False,focus_boundary_rule='REFUSE',focus_delta=0,
                submitted_cost=1,selection_cost=0,mutation_cost=0,quota_acceptance_supported=False))
            expected = tuple(step.values.get('filled_lengths',()))
            if not step.domain_complete or len(expected)!=len(current) or expected[i]!=desired[i]:
                continue
            recalled_extension = bool(extension_laws and current[i] < rank+1 == expected[i]
                and all(a == b for j, (a, b) in enumerate(zip(current, expected)) if j != i))
            point = g['centers'][g['chains'][i][0][rank]]
            loci.append(FrozenMap({'point':point,'component_ref':g['component_ref'],
                'rooted_prefix_geometry_token':token,'rooted_prefix_complete_singleton_count':len(domains),
                'rooted_prefix_chain_count':len(chains),'rooted_prefix_joint_target_lengths':desired,
                'rooted_prefix_current_lengths':current,'rooted_prefix_expected_lengths':expected,
                'rooted_prefix_quota_counts':g['counts'],'rooted_prefix_chain_index':i,
                'rooted_prefix_rank':rank,'rooted_prefix_previous_prediction_matches':prior_matches,
                'rooted_prefix_source_frame_ref':evidence,'rooted_prefix_conditional_model':True,
                'rooted_prefix_source_frame_digest':stable_digest(frame.rows),
                'rooted_prefix_search_examined_count':result.examined_count,
                'rooted_prefix_extension_memory_revalidated':recalled_extension,
                'rooted_prefix_extension_premise_refs':tuple(sorted({law['source_claim_ref'] for law in extension_laws})) if recalled_extension else (),
                'rooted_prefix_extension_support_transition_refs':tuple(sorted({ref for law in extension_laws for ref in law['support_transition_refs']})) if recalled_extension else (),
                'rooted_prefix_cut_law_learned':False,
                'rooted_prefix_geometry_bbox':g['box'],'rooted_prefix_geometry_pitch':g['pitch']}))
    return tuple(loci) if len(loci)<=contract['maximum_loci'] else ()
