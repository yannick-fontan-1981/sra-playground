"""Bounded raster class/position contrasts, with no actor or food assignment."""
from collections import defaultdict
from agents.yf_arc3_v5.logos.types import FrozenMap, stable_digest


class _BoundReached(Exception):
    pass


def measure_inset_reaction_relations(before_frame, before_components, frame,
                                     components, insets, carried, contract):
    """Return per-locus incidences, never a selected locus or a causal law.

    Material labels are opaque. Class conservation and replacement at an old
    position do not establish an individual's identity or consumption.
    """
    limit = int(contract.get('maximum_work', 0))
    max_area = int(contract.get('maximum_compact_area', 0))
    max_groups = int(contract.get('maximum_groups', 0))
    max_pixels = int(contract.get('maximum_frame_pixels', 0))
    max_components = int(contract.get('maximum_components', 0))
    work = 0
    if min(limit, max_area, max_groups, max_pixels, max_components) <= 0 or before_frame is None:
        return FrozenMap(), False, work
    if (frame.height != before_frame.height or frame.width != before_frame.width
            or frame.height*frame.width > max_pixels
            or max(len(components), len(before_components)) > max_components):
        return FrozenMap(), False, work

    def charge(count=1):
        nonlocal work
        work += count
        if work > limit:
            raise _BoundReached

    def describe(items):
        groups = defaultdict(list)
        index = {}
        for c in items:
            charge(len(c.pixels))
            for p in c.pixels:
                if not (0 <= p[0] < frame.height and 0 <= p[1] < frame.width):
                    raise _BoundReached
                index[p] = c.component_id
            if c.area > max_area:
                continue
            top = min(p[0] for p in c.pixels)
            left = min(p[1] for p in c.pixels)
            shape = tuple(sorted((p[0]-top, p[1]-left) for p in c.pixels))
            # The location remains the complete mask, not a guessed cell.
            groups[(c.value, shape)].append(c)
        if len(groups) > max_groups or len(index) != frame.height*frame.width:
            raise _BoundReached
        return groups, index

    def masks(items):
        return {frozenset(c.pixels): c for c in items}

    def adjacent(c, index):
        refs = set()
        for r, col in c.pixels:
            charge(4)
            for p in ((r-1, col), (r+1, col), (r, col-1), (r, col+1)):
                ref = index.get(p)
                if ref is not None and ref != c.component_id:
                    refs.add(ref)
        return refs

    try:
        old, _ = describe(before_components)
        now, index = describe(components)
        now_digest = stable_digest(frame.rows)
        before_digest = stable_digest(before_frame.rows)
        adjacency = {c.component_id: adjacent(c, index)
                     for _key, group in sorted(now.items()) for c in group}
        prior_position_refs = {}
        for _key, group in sorted(old.items()):
            for c in group:
                refs = adjacent(c, index)
                charge(len(c.pixels))
                refs.update(index[p] for p in c.pixels)
                prior_position_refs[c.component_id] = refs
        contrasts = []
        for (material, shape), all_prior_members in sorted(old.items()):
            charge()
            all_current_members = now.get((material, shape), ())
            if len(all_prior_members) < 2 or not all_current_members:
                continue
            # Equal-looking bodies in disconnected regions are not one cohort.
            # Locate old masks on the CURRENT raster, without carrying stale
            # component identifiers across the changed topology.
            regions = set().union(*(adjacency[c.component_id] for c in all_current_members))
            for region in sorted(regions):
                charge(len(all_prior_members)+len(all_current_members))
                prior_members = tuple(c for c in all_prior_members
                    if region in prior_position_refs[c.component_id])
                current_members = tuple(c for c in all_current_members
                    if region in adjacency[c.component_id])
                n = len(prior_members)
                if n < 2 or len(current_members) != n-1:
                    continue
                current_masks = masks(current_members)
                for (new_material, new_shape), changed in sorted(now.items()):
                    charge()
                    if (new_material == material or new_shape != shape or len(changed) != 1
                            or old.get((new_material, new_shape))
                            or region not in adjacency[changed[0].component_id]):
                        continue
                    for (other_material, other_shape), prior_other in sorted(old.items()):
                        charge()
                        if other_material in (material, new_material) or other_shape != shape:
                            continue
                        before_masks = masks(prior_other)
                        after_masks = masks(now.get((other_material, other_shape), ()))
                        removed = set(before_masks)-set(after_masks)
                        if (not set(after_masks) <= set(before_masks) or not 0 < len(removed) < n
                                or not removed <= set(current_masks)):
                            continue
                        snapshot = FrozenMap({'observed_frame_digest': now_digest,
                            'source_material': material, 'changed_material': new_material,
                            'replaced_material': other_material, 'shape': shape,
                            'source_count_before': n, 'source_count_after': n-1,
                            'replaced_position_count': len(removed),
                            'changed_component_ref': changed[0].component_id,
                            'current_component_refs': tuple(c.component_id for c in (*current_members, *changed)),
                            'common_adjacent_component_refs': (region,)})
                        remaining = tuple(now.get((other_material, other_shape), ()))
                        contrasts.append((snapshot, {region}, remaining))

        growths = []
        carried_snapshot = carried.get('separator_reaction_snapshot') or {}
        if carried_snapshot.get('observed_frame_digest') == before_digest:
            prior_key = (carried_snapshot.get('changed_material'),
                         tuple(tuple(p) for p in carried_snapshot.get('shape', ())))
            prior_changed = old.get(prior_key, ())
            if len(prior_changed) == 1 and not now.get(prior_key):
                prior_c = prior_changed[0]
                for key, appeared in sorted(now.items()):
                    charge()
                    if len(appeared) != 1 or old.get(key) or appeared[0].area <= prior_c.area:
                        continue
                    grown = appeared[0]
                    same_extent_peers = []
                    for peer_key, peers in sorted(now.items()):
                        charge()
                        if peer_key == key or peer_key[1] != key[1]:
                            continue
                        old_masks = masks(old.get(peer_key, ()))
                        for peer in peers:
                            charge()
                            if frozenset(peer.pixels) in old_masks:
                                same_extent_peers.append((peer, peer_key[0] == carried_snapshot.get('replaced_material')))
                    growths.append((grown, prior_c, same_extent_peers))

        result = {}
        for inset in insets:
            charge()
            side_refs = set(inset['side_component_refs'])
            observed = []
            for snapshot, common, remaining in contrasts:
                charge()
                if not side_refs & common:
                    continue
                peers = tuple(c.component_id for c in remaining
                    if adjacency[c.component_id] & (side_refs-common))
                if peers:
                    observed.append((snapshot, peers))
            grown_matches = []
            for grown, prior_c, peers in growths:
                charge()
                group_side = adjacency[grown.component_id] & side_refs
                if not group_side:
                    continue
                other_side = side_refs-group_side
                matching = tuple(p.component_id for p, former_kind in peers
                    if not former_kind and adjacency[p.component_id] & other_side)
                if matching:
                    grown_matches.append((grown, prior_c, matching))
            facts = {'separator_reaction_same_kind_opportunity_count': 0,
                     'separator_reaction_grown_same_shape_peer_count': 0}
            context = {}
            if len(observed) == 1:
                snapshot, peers = observed[0]
                facts['separator_reaction_same_kind_opportunity_count'] = len(peers)
                context = {'separator_reaction_snapshot': snapshot,
                           'separator_reaction_adjacent_same_kind_refs': peers}
            if len(grown_matches) == 1:
                grown, prior_c, peers = grown_matches[0]
                facts['separator_reaction_grown_same_shape_peer_count'] = len(peers)
                context.update({'separator_reaction_snapshot': FrozenMap(carried_snapshot),
                    'separator_reaction_growth_before_ref': prior_c.component_id,
                    'separator_reaction_growth_after_ref': grown.component_id,
                    'separator_reaction_growth_before_area': prior_c.area,
                    'separator_reaction_growth_after_area': grown.area,
                    'separator_reaction_equal_shape_peer_refs': peers,
                    'separator_reaction_carried_frame_digest_matches': True})
            facts['separator_reaction_target_context'] = FrozenMap(context)
            result[inset['geometry_token']] = FrozenMap(facts)
        return FrozenMap(result), True, work
    except _BoundReached:
        return FrozenMap(), False, work
