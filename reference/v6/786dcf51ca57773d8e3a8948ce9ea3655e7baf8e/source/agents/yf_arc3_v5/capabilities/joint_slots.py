"""Bounded slot geometry, exact permutation matching and requested finite search.

No role, goal, operator or route is selected here. Callers supply constraints
and traversal orders; the result preserves bounds and ambiguity explicitly.
"""
from __future__ import annotations

from collections import deque
from collections.abc import Mapping, Sequence

from agents.yf_arc3_v5.logos.types import stable_digest
from .contracts import BlockGridSceneDescription, ComponentDescription, VisualSceneDescription
from .distributed_square_tracks import measure_distributed_square_structure


def measure_enclosed_linear_slot_rotation(
    before_scene: VisualSceneDescription | BlockGridSceneDescription,
    after_scene: VisualSceneDescription | BlockGridSceneDescription,
) -> dict[str, object]:
    """Exact value permutations inside one unchanged linear multi-hole support.

    Anonymous geometry only: no palette role, action, target or slot count is
    presumed. Incomplete hole enumeration and unrelated simultaneous changes
    cannot establish this pure internal-permutation variant.
    """
    if before_scene.frame.height != after_scene.frame.height or before_scene.frame.width != after_scene.frame.width:
        return {}

    def supports(scene):
        if not hasattr(scene, 'sprites') or getattr(scene, 'hole_sprite_enumeration_truncated', True):
            return {}
        components = scene.blocks.components
        holes = getattr(scene, 'hole_sprites', ())
        if len(components) > 256 or len(holes) > 64:
            return {}
        grouped = {}
        for hole in holes:
            grouped.setdefault(hole.enclosing_component_ref, []).append(hole)
        result = {}
        for component in components:
            if (component.touches_frame_boundary
                or component.area == component.bbox.height * component.bbox.width):
                continue
            # Filled apertures can be omitted from hole projections when a
            # periodic cell partition already represents their contents.
            # Recover only complete rectangular cores with an exact enclosing
            # rim in this component, never from bbox containment alone.
            outline = frozenset(component.pixels)
            members_by_box = {
                (h.bbox.top,h.bbox.left,h.bbox.bottom,h.bbox.right):h
                for h in grouped.get(component.component_id, ())
                if h.value_count == 1 and len(h.pixels) == h.bbox.height*h.bbox.width
            }
            for core in components:
                box=core.bbox
                if (core.value == component.value or core.area != box.height*box.width
                    or not (component.bbox.top < box.top <= box.bottom < component.bbox.bottom
                            and component.bbox.left < box.left <= box.right < component.bbox.right)):
                    continue
                rim = ((r,c) for r in range(box.top-1,box.bottom+2)
                       for c in range(box.left-1,box.right+2)
                       if r in (box.top-1,box.bottom+1) or c in (box.left-1,box.right+1))
                if all(p in outline for p in rim):
                    members_by_box[(box.top,box.left,box.bottom,box.right)] = core
            members = [member for _box,member in sorted(members_by_box.items())]
            if not 2 <= len(members) <= 64:
                continue
            extent = (members[0].bbox.height, members[0].bbox.width)
            if any((h.bbox.height,h.bbox.width) != extent for h in members):
                continue
            centers = tuple((h.bbox.top+h.bbox.bottom,h.bbox.left+h.bbox.right) for h in members)
            deltas = tuple((b[0]-a[0],b[1]-a[1]) for a,b in zip(centers,centers[1:]))
            if len(set(deltas)) != 1 or not ((deltas[0][0] == 0) ^ (deltas[0][1] == 0)):
                continue
            slots = tuple((h.bbox.top,h.bbox.left,h.bbox.bottom,h.bbox.right) for h in members)
            key = (component.value, component.bbox.top, component.bbox.left,
                   component.bbox.bottom, component.bbox.right, component.relative_pixels, slots)
            result[key] = (centers, tuple(scene.frame.rows[h.bbox.top][h.bbox.left] for h in members),
                           frozenset(p for h in members for p in h.pixels))
        return result

    old_supports, new_supports = supports(before_scene), supports(after_scene)
    matches = []
    for key,(centers,old,pixels) in sorted(old_supports.items()):
        if key not in new_supports:
            continue
        new = new_supports[key][1]
        if old == new:
            continue
        if any(before_scene.frame.rows[r][c] != after_scene.frame.rows[r][c]
               for r in range(before_scene.frame.height) for c in range(before_scene.frame.width)
               if (r,c) not in pixels):
            continue
        for shift in range(1,len(old)):
            if tuple(old[(i-shift)%len(old)] for i in range(len(old))) == new:
                signed = shift if shift <= len(old)//2 else shift-len(old)
                matches.append((centers,old,new,signed,key))
    facts = {'closed_support_permutation_match_count':len(matches)}
    if matches:
        facts.update(closed_support_signed_shift_matches=tuple(m[3] for m in matches[:3]),
                     closed_support_permutation_matches_truncated=len(matches)>3)
    if len(matches) == 1:
        centers,old,new,shift,key=matches[0]
        facts.update(unique_closed_support_permutation=True,
            unique_closed_support_signed_slot_quantum=shift,
            closed_support_one_slot_quantum=abs(shift)==1,
            closed_support_nonzero_permutation=True,
            closed_support_slot_count=len(old), closed_support_slot_centers_twice=centers,
            closed_support_rim_value=key[0], closed_support_rim_relative_pixels=key[5],
            closed_support_before_value_sequence=old, closed_support_after_value_sequence=new,
            closed_support_before_state_digest=stable_digest(old)[:16],
            closed_support_after_state_digest=stable_digest(new)[:16],
            closed_support_measurement_kind='enclosed_linear_slots')
    return facts


def measure_joint_slot_geometry(
    components: Sequence[ComponentDescription],
) -> dict[str, object]:
    if len(components) > 256:
        return {}
    # Bound the family before the rectangular description enumeration.
    counts: dict[int, int] = {}
    for c in components:
        if c.bbox.height == c.bbox.width and c.area == c.bbox.height ** 2:
            counts[c.area] = counts.get(c.area, 0) + 1
    if any(count > 64 for count in sorted(counts.values())):
        return {}
    measured = measure_distributed_square_structure(None, components)
    structures = tuple(measured.get("structures", ()))
    markers = tuple(measured.get("markers", ()))
    associations = tuple(measured.get("associations", ()))
    if not (2 <= len(structures) <= 3 and 2 <= len(markers) <= 8
            and 2 <= len(associations) <= 16
            and measured.get("shared_slot_centers_twice")):
        return {}
    if any(m["component_count"] != 4 for m in markers):
        return {}
    slots = {tuple(p) for s in structures for p in s["slot_centers_twice"]}
    if len(slots) != measured["carrier_count"] or len(slots) > 64:
        return {}
    # A morphology correspondence is reported only when the same number of
    # complete marked positions and square occurrences carries each value.
    values = {tuple(p): v for s in structures
              for p, v in zip(s["slot_centers_twice"], s["slot_values"])}
    marker_values = {m["visual_value"] for m in markers}
    if any(sum(v == value for v in sorted(values.values())) !=
           sum(m["visual_value"] == value for m in markers) for value in marker_values):
        return {}
    return {
        **measured,
        "geometry_ref": "measurement.joint_slots." + stable_digest(
            (structures, markers, associations)
        )[:16],
        "slot_values_by_position": tuple((p, values[p]) for p in sorted(values)),
    }


def measure_supported_slot_rotation(
    before: Mapping[str, object], after: Mapping[str, object],
) -> dict[str, object]:
    """Match a nonzero unit rotation and unchanged complement on all slots."""
    old = {tuple(p): v for p, v in before.get("slot_values_by_position", ())}
    new = {tuple(p): v for p, v in after.get("slot_values_by_position", ())}
    if not old or set(old) != set(new):
        return {}
    matches = []
    for item in before.get("structures", ()):
        slots = tuple(tuple(p) for p in item["slot_centers_twice"])
        if any(old[p] != new[p] for p in old if p not in slots):
            continue
        if all(old[p] == new[p] for p in slots):
            continue
        for offset in (-1, 1):
            if all(new[slots[(i + offset) % len(slots)]] == old[p]
                   for i, p in enumerate(slots)):
                matches.append((slots, offset))
    if len(matches) != 1:
        return {"closed_support_permutation_match_count": len(matches)}
    slots, offset = matches[0]
    prior = tuple(old[p] for p in slots)
    current = tuple(new[p] for p in slots)
    return {
        "closed_support_permutation_match_count": 1,
        "unique_closed_support_permutation": True,
        "unique_closed_support_signed_slot_quantum": offset,
        "closed_support_one_slot_quantum": True,
        "closed_support_nonzero_permutation": True,
        "closed_support_slot_count": len(slots),
        "closed_support_slot_centers_twice": slots,
        "closed_support_before_value_sequence": prior,
        "closed_support_after_value_sequence": current,
        "closed_support_before_state_digest": stable_digest(prior)[:16],
        "closed_support_after_state_digest": stable_digest(current)[:16],
    }


def search_slot_permutations(
    *, slot_values_by_position: Sequence, requirements: Sequence,
    operators: Sequence[Mapping], traversal_orders: Sequence[Sequence[str]],
    maximum_depth: int, maximum_states: int,
    state_equivalence: str = "exact_values",
) -> dict[str, object]:
    """One shortest witness per supplied order, with at most three witnesses."""
    if not (0 < maximum_depth <= 40 and 0 < maximum_states <= 16384
            and 0 < len(traversal_orders) <= 3 and 0 < len(operators) <= 16):
        raise ValueError("slot search requires explicit finite bounds")
    values = {tuple(p): int(v) for p, v in slot_values_by_position}
    slots = tuple(sorted(values))
    index = {p: i for i, p in enumerate(slots)}
    if not 0 < len(slots) <= 64 or not 0 < len(requirements) <= 8:
        raise ValueError("slot search domain exceeds its bound")
    constraints = tuple((index[tuple(p)], int(v)) for p, v in requirements)
    maps = {}
    for op in operators:
        domain = tuple(index[tuple(p)] for p in op["slot_centers_twice"])
        if len(set(domain)) != len(domain) or not domain:
            raise ValueError("slot operator must have a bijective domain")
        mapping = list(range(len(slots)))
        for i, source in enumerate(domain):
            mapping[source] = domain[(i + int(op["signed_slot_quantum"])) % len(domain)]
        ref = str(op["candidate_ref"])
        if ref in maps:
            raise ValueError("slot operators must have distinct identities")
        maps[ref] = tuple(mapping)
    routes = []
    counts = []
    if state_equivalence not in {"exact_values", "terminal_value_membership"}:
        raise ValueError("slot search requires a declared state equivalence")
    full_initial = tuple(values[p] for p in slots)
    required_values = frozenset(v for _, v in constraints)
    initial = (tuple(v if v in required_values else None for v in full_initial)
               if state_equivalence == "terminal_value_membership" else full_initial)
    for order in traversal_orders:
        if len(order) != len(maps) or set(order) != set(maps):
            raise ValueError("traversal must list each declared operator once")
        queue = deque([(initial, ())])
        visited = {initial}
        found = None
        while queue:
            state, path = queue.popleft()
            if all(state[i] == v for i, v in constraints):
                found = path
                break
            if len(path) == maximum_depth:
                continue
            for ref in order:
                successor = list(state)
                for source, destination in enumerate(maps[ref]):
                    successor[destination] = state[source]
                successor = tuple(successor)
                if successor in visited:
                    continue
                if len(visited) >= maximum_states:
                    return {"routes": (), "bound_reached": True,
                            "visited_counts": (*counts, len(visited))}
                visited.add(successor)
                queue.append((successor, (*path, ref)))
        counts.append(len(visited))
        if found is not None and found not in routes:
            # Check the witness on the complete original field. The quotient
            # never weakens a terminal requirement or invents an operator.
            verified = full_initial
            for ref in found:
                successor = list(verified)
                for source, destination in enumerate(maps[ref]):
                    successor[destination] = verified[source]
                verified = tuple(successor)
            if not all(verified[i] == v for i, v in constraints):
                raise ValueError("projected slot witness fails full-state requirements")
            routes.append(found)
    return {"routes": tuple(routes), "bound_reached": False,
            "visited_counts": tuple(counts)}
