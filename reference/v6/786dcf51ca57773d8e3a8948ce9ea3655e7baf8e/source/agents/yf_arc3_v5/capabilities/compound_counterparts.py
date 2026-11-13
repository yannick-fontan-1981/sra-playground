"""Exact repeated compound-mask correspondences; no role or action selection."""
from collections import Counter


def bind_compound_group_observation_scope(measurements, *, frame_ref, context_epoch, component_refs):
    """Bind requested raw measurements to their current typed observation.

    Keep cache children immutable. Participant membership is a mechanical check;
    Source/DRM remains responsible for roles, interpretation and action release.
    """
    current = frozenset(component_refs)
    bound = {}
    for ref, facts in sorted(measurements.items()):
        groups = facts.get('compound_observed_unframed_groups')
        if groups is None:
            bound[ref] = facts
            continue
        participants = tuple(part[0] for group in groups for part in group['parts'])
        scope_bound = bool(frame_ref) and context_epoch >= 0 and ref in current and bool(participants) and all(
            participant in current for participant in participants)
        bound[ref] = {
            **facts,
            'compound_observed_unframed_measurement_frame_ref': frame_ref,
            'compound_observed_unframed_context_epoch': context_epoch,
            'compound_observed_unframed_participant_refs': participants,
            'compound_observed_unframed_scope_bound': scope_bound,
        }
    return bound


def _visible_edit_measurements(parts, members, boundary, components, previous_components, last_point):
    """Compare uniquely corresponding visible parts, never infer voxel counts.

    A prior upper mask must lie in the same measured enclosure and column.
    Ambiguous prior occurrences return no fit, rather than choose by distance.
    """
    anchor = parts[0]
    first = members[0]
    def mask(c):
        return (c.bbox.height, c.bbox.width, c.relative_pixels)
    before_groups = []
    for prior in previous_components:
        if (prior.value != first.value or mask(prior) != mask(anchor)
                or prior.bbox.left != first.bbox.left
                or not (boundary.bbox.top < prior.bbox.top
                        and prior.bbox.bottom < boundary.bbox.bottom)):
            continue
        dr, dc = prior.bbox.top-anchor.bbox.top, prior.bbox.left-anchor.bbox.left
        group = []
        for p in parts:
            matches = tuple(c for c in previous_components if c.value == p.value
                and c.bbox.top == p.bbox.top+dr and c.bbox.left == p.bbox.left+dc
                and c.bbox.width == p.bbox.width and c.bbox.height >= p.bbox.height)
            if len(matches) != 1:
                break
            group.append(matches[0])
        if len(group) == len(parts):
            before_groups.append(tuple(group))
    if len(before_groups) != 1:
        return {}
    prior_upper = before_groups[0][0]
    values = frozenset(p.value for p in parts)
    def cluster(seed, domain):
        retained = list(seed)
        pending = [c for c in domain if c.value in values and c not in retained
            and boundary.bbox.top < c.bbox.top and c.bbox.bottom < boundary.bbox.bottom
            and boundary.bbox.left < c.bbox.left and c.bbox.right < boundary.bbox.right]
        while True:
            adjacent = [c for c in pending if any(
                c.bbox.top <= p.bbox.bottom+1 and p.bbox.top <= c.bbox.bottom+1
                and c.bbox.left <= p.bbox.right+1 and p.bbox.left <= c.bbox.right+1
                for p in retained)]
            if not adjacent:
                return tuple(retained)
            retained.extend(adjacent)
            pending = [c for c in pending if c not in adjacent]
    prior = cluster(before_groups[0], previous_components)
    current_group = cluster(members, components)
    def pixels(group):
        return {(c.bbox.top+r, c.bbox.left+col): c.value for c in group
                for r, col in c.relative_pixels}
    old, current = pixels(prior), pixels(current_group)
    dr, dc = first.bbox.top-prior_upper.bbox.top, first.bbox.left-prior_upper.bbox.left
    translated = {(r+dr, col+dc): v for (r, col), v in sorted(old.items())}
    common = tuple(sorted(old.keys() & current.keys()))
    return {
        'compound_prior_visible_part_count': len(prior),
        'compound_current_visible_part_count': len(current_group),
        'compound_prior_colored_pixel_count': len(old),
        'compound_current_colored_pixel_count': len(current),
        'compound_current_colored_extent_height': max(r for r, _ in current)-min(r for r, _ in current)+1,
        'compound_current_colored_extent_width': max(c for _, c in current)-min(c for _, c in current)+1,
        'compound_colored_pixel_count_delta': len(current)-len(old),
        'compound_upper_part_row_delta': dr,
        'compound_upper_part_row_decrease': -dr,
        'compound_upper_part_column_delta': dc,
        'compound_lower_extent_row_delta': max(r for r, _ in current)-max(r for r, _ in old),
        'compound_preserved_colored_pixel_count': sum(old[p] == current[p] for p in common),
        'compound_recolored_pixel_count': sum(old[p] != current[p] for p in common),
        'compound_whole_translation_exact_match': translated == current,
        'compound_silhouette_exact_match': old.keys() == current.keys(),
        'compound_last_point_on_prior_upper_mask': last_point in pixels((prior_upper,)),
        'compound_last_point_on_current_upper_mask': last_point in pixels((first,)),
    }


def measure_compound_counterparts(components, configuration, last_point=None, previous_rows=None):
    """Return per-component measurements for one enclosed multivalue exemplar.

    Same-valued counterparts must preserve every part mask and relative origin.
    Peer enclosures remain measured, not silently discarded as interface objects.
    Bounds are request limits, not claims that an absent domain is impossible.
    """
    empty = {}
    contour_value = configuration.get('contour_palette_value')
    minimum = configuration.get('minimum_part_count')
    maximum = configuration.get('maximum_part_count')
    bound = configuration.get('maximum_component_count')
    if any(v is None for v in (contour_value,minimum,maximum,bound)):
        return empty
    if len(components)>int(bound):
        return empty
    counts=Counter()
    for c in components:
        counts[c.value]+=c.area
    if not counts:
        return empty
    peak=max(counts.values())
    dominant=tuple(v for v,n in sorted(counts.items()) if n==peak)
    if len(dominant)!=1:
        return empty
    background=dominant[0]
    def mask(c):
        return (c.bbox.height,c.bbox.width,c.relative_pixels)
    def contains(outer,inner):
        return (outer.bbox.top<inner.bbox.top and outer.bbox.left<inner.bbox.left
            and outer.bbox.bottom>inner.bbox.bottom and outer.bbox.right>inner.bbox.right)
    def rectangle(c):
        h,w=c.bbox.height,c.bbox.width
        if min(h,w)<3:
            return False
        pixels=frozenset(c.relative_pixels)
        return all((r,col) in pixels for r in (0,h-1) for col in range(w)) and all(
            (r,col) in pixels for col in (0,w-1) for r in range(h))
    rects=tuple(c for c in components if c.value!=background and rectangle(c))
    uniform=tuple(c for c in components if c.value==background)
    enclosing_values=frozenset(r.value for r in rects
        if any(contains(r,c) for c in uniform))
    uniform_shapes=frozenset(mask(c) for c in uniform)
    exemplars=[]
    for outer in rects:
        if outer.value!=contour_value:
            continue
        parts=tuple(sorted((c for c in components if contains(outer,c)
            and c.value not in enclosing_values and c.value!=background),
            key=lambda c:(c.bbox.top,c.bbox.left,c.component_id)))
        if (int(minimum)<=len(parts)<=int(maximum)
            and len({c.value for c in parts})>1
            and all(mask(c) in uniform_shapes for c in parts)):
            exemplars.append((outer,parts))
    if len(exemplars)!=1:
        return empty
    outer,parts=exemplars[0]
    anchor=parts[0]
    values=frozenset(p.value for p in parts)
    outside=tuple(c for c in components if c.value in values
        and not any(contains(r,c) for r in rects))
    groups=[]
    pending=set(range(len(outside)))
    while pending:
        todo=[min(pending)]
        pending.remove(todo[0])
        group=[]
        while todo:
            i=todo.pop()
            c=outside[i]
            group.append(c)
            adjacent=tuple(j for j in sorted(pending)
                if c.bbox.top<=outside[j].bbox.bottom+1
                and outside[j].bbox.top<=c.bbox.bottom+1
                and c.bbox.left<=outside[j].bbox.right+1
                and outside[j].bbox.left<=c.bbox.right+1)
            for j in adjacent:
                pending.remove(j)
                todo.append(j)
        if frozenset(c.value for c in group)==values:
            groups.append(tuple(group))
    ph=max(c.bbox.bottom for c in parts)-min(c.bbox.top for c in parts)+1
    pw=max(c.bbox.right for c in parts)-min(c.bbox.left for c in parts)+1
    # Expose a bounded raw domain only when Source requests it explicitly.
    # Overall extent of a multi-part figure is independent of unit extent.
    observed_group_domain = None
    if configuration.get('expose_unframed_group_domain') is True:
        limit = int(configuration.get('maximum_unframed_group_count', 0))
        if not 1 <= limit <= int(bound):
            raise ValueError('bounded unframed group domain required')
        observed_group_domain = {
            'compound_observed_unframed_group_count': len(groups),
            'compound_observed_unframed_group_domain_complete': len(groups) <= limit,
            'compound_observed_unframed_groups': tuple({
                'top': min(c.bbox.top for c in group),
                'left': min(c.bbox.left for c in group),
                'height': max(c.bbox.bottom for c in group)-min(c.bbox.top for c in group)+1,
                'width': max(c.bbox.right for c in group)-min(c.bbox.left for c in group)+1,
                'parts': tuple((c.component_id, c.value, c.bbox.top, c.bbox.left,
                    c.bbox.height, c.bbox.width, c.area) for c in group),
            } for group in groups[:limit]),
        }
    if observed_group_domain is not None and len(groups) == 1:
        group = groups[0]
        top = min(c.bbox.top for c in group)
        observed_group_domain.update({
            'compound_observed_unique_unframed_part_refs': tuple(c.component_id for c in group),
            'compound_observed_unique_unframed_part_count': len(group),
            'compound_observed_unique_unframed_part_count_exceeds_exemplar': len(group) > len(parts),
            'compound_observed_unique_unframed_apex_unit_smaller': any(
                c.value == anchor.value and c.bbox.top == top
                and c.bbox.width < anchor.bbox.width and c.bbox.height < anchor.bbox.height
                for c in group),
        })
    reference_groups=tuple(g for g in groups
        if max(c.bbox.right for c in g)-min(c.bbox.left for c in g)+1<pw)
    vertical=False
    upper_value=False
    previous_components = ()
    if previous_rows is not None and (len(previous_rows) != max(c.bbox.bottom for c in components)+1
            or any(len(row) != max(c.bbox.right for c in components)+1 for row in previous_rows)):
        previous_rows = None
    if previous_rows is not None:
        from .components import detect_components
        from .contracts import ComponentExtractionInput, FrameGrid
        previous_components = detect_components(ComponentExtractionInput(
            frame=FrameGrid(rows=previous_rows))).components
    if len(reference_groups)==1:
        g=reference_groups[0]
        top=min(c.bbox.top for c in g)
        rh=max(c.bbox.bottom for c in g)-top+1
        rw=max(c.bbox.right for c in g)-min(c.bbox.left for c in g)+1
        vertical=rh*pw>rw*ph
        upper_value=any(c.value==anchor.value and c.bbox.top==top for c in g)
    lookup={(mask(c),c.bbox.top,c.bbox.left):c for c in uniform}
    copies=[]
    for first in uniform:
        if mask(first)!=mask(anchor):
            continue
        dr,dc=first.bbox.top-anchor.bbox.top,first.bbox.left-anchor.bbox.left
        members=tuple(lookup.get((mask(p),p.bbox.top+dr,p.bbox.left+dc)) for p in parts)
        if any(c is None for c in members):
            continue
        peer=any(r.bbox.height==outer.bbox.height and r.bbox.width==outer.bbox.width
            and all(contains(r,c) for c in members) for r in rects)
        boundaries=tuple(r for r in rects if all(contains(r,c) for c in members))
        area=min((r.bbox.height*r.bbox.width for r in boundaries),default=0)
        nearest=tuple(r for r in boundaries if r.bbox.height*r.bbox.width==area)
        margin=(min(c.bbox.top for c in members)-nearest[0].bbox.top
            if len(nearest)==1 else -1)
        copies.append((members,peer,margin,len(nearest)))
    if not copies:
        return empty
    free=tuple(copy for copy in copies if not copy[1] and copy[3]==1)
    if not free:
        return empty
    upper_max=max(copy[2] for copy in free)
    last_inside=bool(last_point is not None and outer.bbox.top<=last_point[0]<=outer.bbox.bottom
        and outer.bbox.left<=last_point[1]<=outer.bbox.right)
    result={}
    for members,peer,margin,boundary_count in copies:
        for i,c in enumerate(members):
            result[c.component_id]={
                'compound_counterpart_exemplar_count':1,
                'compound_counterpart_part_count':len(parts),
                'compound_uniform_copy_count':len(copies),
                'compound_uniform_copy_in_peer_enclosure':peer,
                'compound_uniform_copy_upper_margin':margin,
                'compound_uniform_copy_upper_margin_is_maximum':margin==upper_max,
                'compound_uniform_copy_boundary_count':boundary_count,
                'compound_counterpart_part_is_uppermost':i==0,
                'last_point_inside_compound_exemplar_contour':last_inside,
                **(observed_group_domain or {}),
                'compound_unframed_reference_count':len(reference_groups),
                'compound_reference_vertical_aspect_exceeds_exemplar':vertical,
                'compound_reference_exemplar_upper_value_at_apex':upper_value,
            }
    # A current upper part may retain its exact mask while adjacent parts grow.
    # Record this correspondence and action-conditioned pixel change only;
    # it does not establish ownership, an edit law or a terminal equivalence.
    if len(reference_groups)==1:
        for first in components:
            if first.value!=anchor.value or mask(first)!=mask(anchor):
                continue
            if any(r.value==contour_value and contains(r,first) for r in rects):
                continue
            dr,dc=first.bbox.top-anchor.bbox.top,first.bbox.left-anchor.bbox.left
            members=[]
            for p in parts:
                matches=tuple(c for c in components if c.value==p.value
                    and c.bbox.top==p.bbox.top+dr and c.bbox.left==p.bbox.left+dc
                    and c.bbox.width==p.bbox.width and c.bbox.height>=p.bbox.height)
                if len(matches)!=1:
                    break
                members.append(matches[0])
            if len(members)!=len(parts):
                continue
            boundaries=tuple(r for r in rects if all(contains(r,c) for c in members))
            area=min((r.bbox.height*r.bbox.width for r in boundaries),default=0)
            nearest=tuple(r for r in boundaries if r.bbox.height*r.bbox.width==area)
            if len(nearest)!=1 or nearest[0].value==contour_value:
                continue
            top=min(c.bbox.top for c in members)
            left=min(c.bbox.left for c in members)
            bottom=max(c.bbox.bottom for c in members)
            right=max(c.bbox.right for c in members)
            changed=(sum(previous_rows[first.bbox.top+r][first.bbox.left+c]!=first.value
                for r,c in first.relative_pixels) if previous_rows is not None else 0)
            point_inside=bool(last_point is not None and top<=last_point[0]<=bottom
                and left<=last_point[1]<=right)
            result[first.component_id]={
                'compound_counterpart_exemplar_count':1,
                'compound_counterpart_part_is_uppermost':True,
                'compound_current_colored_upper_part_correspondence':True,
                'compound_current_upper_part_changed_pixel_count':changed,
                'compound_last_point_inside_current_colored_extent':point_inside,
                'compound_current_upper_margin':top-nearest[0].bbox.top,
                'compound_unframed_reference_count':1,
                'compound_reference_exemplar_upper_value_at_apex':upper_value,
                'compound_reference_vertical_aspect_exceeds_current':
                    rh*(right-left+1)>rw*(bottom-top+1),
            }
            result[first.component_id].update(_visible_edit_measurements(
                parts, members, nearest[0], components, previous_components, last_point))
            current_facts = result[first.component_id]
            if 'compound_current_colored_extent_height' in current_facts:
                current_facts['compound_reference_vertical_aspect_exceeds_current'] = (
                    rh*current_facts['compound_current_colored_extent_width']
                    > rw*current_facts['compound_current_colored_extent_height'])
    return result
