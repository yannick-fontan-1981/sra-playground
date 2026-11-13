"""Square supports, overlapping vertical bands and framed pattern geometry.

These measurements do not identify an actor, goal, instruction or topology.
Source must bind those roles before requesting a mechanical program calculation.
"""

from collections import Counter, defaultdict

from agents.yf_arc3_v5.logos.types import FrozenMap, stable_digest


def _ref(kind, value):
    return f"measurement.{kind}.{stable_digest(value)}"


def _box(component):
    b = component.bbox
    return (b.top, b.left, b.bottom, b.right)


def _pattern(points):
    top = min(r for r, _ in points)
    left = min(c for _, c in points)
    normalized = frozenset((r - top, c - left) for r, c in points)
    height = max(r for r, _ in normalized) + 1
    width = max(c for _, c in normalized) + 1
    row_counts = tuple(sum(r == i for r, _ in normalized) for i in range(height))
    col_counts = tuple(sum(c == i for _, c in normalized) for i in range(width))
    return {
        "pattern_ref": _ref("framed_pattern", tuple(sorted(normalized))),
        "height": height, "width": width, "pixel_count": len(normalized),
        "row_counts": row_counts, "column_counts": col_counts,
        "row_reflection_exact": frozenset((height - 1 - r, c) for r, c in normalized) == normalized,
        "column_reflection_exact": frozenset((r, width - 1 - c) for r, c in normalized) == normalized,
        "left_end_count": col_counts[0], "right_end_count": col_counts[-1],
        "top_end_count": row_counts[0], "bottom_end_count": row_counts[-1],
        "corner_count": len(normalized & {(0, 0), (0, width - 1),
                                           (height - 1, 0), (height - 1, width - 1)}),
    }


def measure_square_core_bands(components, *, minimum_area, maximum_cores):
    """Enumerate complete same-mask families; do not select a semantic family."""
    families = defaultdict(list)
    for component in components:
        b = component.bbox
        if (component.touches_frame_boundary or b.height != b.width
                or component.area != b.height * b.width
                or component.area < minimum_area):
            continue
        families[(b.height, b.width, tuple(component.relative_pixels))].append(component)
    records = []
    for shape, members in sorted(families.items()):
        count = len(members)
        if count < 2:
            continue
        family_ref = _ref("square_core_family", shape)
        if count > maximum_cores:
            records.append({"family_ref": family_ref, "domain_complete": False,
                            "core_count": count, "cores": (), "bands": ()})
            continue
        ordered = sorted(members, key=lambda c: (_box(c), c.component_id))
        cores = tuple({"core_ref": _ref("square_core", (shape, _box(c))),
                       "component_ref": c.component_id, "box": _box(c),
                       "palette_value": c.value} for c in ordered)
        bands = []
        for core in cores:
            top, left, bottom, right = core["box"]
            if not bands or top > bands[-1]["bottom"] + 1:
                bands.append({"top": top, "bottom": bottom, "cores": []})
            bands[-1]["bottom"] = max(bands[-1]["bottom"], bottom)
            bands[-1]["cores"].append(core)
        band_records = []
        for band in bands:
            peers = tuple(sorted(band["cores"], key=lambda c: (c["box"][1], c["box"][0])))
            band_records.append({"band_ref": _ref("vertical_overlap_band", tuple(c["core_ref"] for c in peers)),
                                 "top": band["top"], "bottom": band["bottom"],
                                 "ordered_core_refs": tuple(c["core_ref"] for c in peers),
                                 "column_gaps": tuple(b["box"][1] - a["box"][1]
                                                      for a, b in zip(peers, peers[1:]))})
        values = Counter(c["palette_value"] for c in cores)
        records.append({"family_ref": family_ref, "domain_complete": True,
                        "core_count": count, "cores": cores, "bands": tuple(band_records),
                        "palette_value_counts": tuple(sorted(values.items())),
                        "singleton_value_core_refs": tuple(c["core_ref"] for c in cores
                                                           if values[c["palette_value"]] == 1)})
    return tuple(FrozenMap(record) for record in records)


def measure_framed_patterns(frame, components, *, maximum_frames, minimum_family_count=2):
    """Enumerate exact borders and all contrasting interior masks, without OCR."""
    families = defaultdict(list)
    for component in components:
        b = component.bbox
        if b.height < 3 or b.width < 3 or component.area != 2 * (b.height + b.width) - 4:
            continue
        border = frozenset((r, c) for r in range(b.height) for c in range(b.width)
                           if r in (0, b.height - 1) or c in (0, b.width - 1))
        if frozenset(component.relative_pixels) == border:
            families[(b.height, b.width)].append(component)
    results = []
    for extent, members in sorted(families.items()):
        if len(members) < minimum_family_count:
            continue
        if len(members) > maximum_frames:
            results.append(FrozenMap({"extent": extent, "domain_complete": False,
                                      "frame_count": len(members), "frames": ()}))
            continue
        frames = []
        for component in sorted(members, key=lambda c: _box(c)):
            top, left, bottom, right = _box(component)
            masks = defaultdict(list)
            for r in range(top + 1, bottom):
                for c in range(left + 1, right):
                    masks[frame.rows[r][c]].append((r, c))
            frames.append({"frame_ref": _ref("rectangular_border", _box(component)),
                           "box": _box(component), "border_value": component.value,
                           "patterns": tuple({**_pattern(points), "palette_value": value}
                                             for value, points in sorted(masks.items()))})
        results.append(FrozenMap({"extent": extent, "domain_complete": True,
                                  "frame_count": len(frames), "frames": tuple(frames)}))
    return tuple(results)


def measure_uniform_border_activations(frame_family, packet, *, maximum_samples):
    """Record a unique changed uniform border; retain non-unique observations."""
    if not frame_family["domain_complete"] or len(packet) > maximum_samples:
        return FrozenMap({"domain_complete": False, "samples": ()})
    samples = []
    for index, grid in enumerate(packet):
        changed = []
        for descriptor in frame_family["frames"]:
            top, left, bottom, right = descriptor["box"]
            values = {grid.rows[r][c] for r in range(top, bottom + 1)
                      for c in range(left, right + 1)
                      if r in (top, bottom) or c in (left, right)}
            if len(values) == 1 and next(iter(values)) != descriptor["border_value"]:
                changed.append(descriptor["frame_ref"])
        samples.append({"frame_index": index, "changed_border_refs": tuple(changed)})
    return FrozenMap({"domain_complete": True, "samples": tuple(samples)})


def measure_small_new_palette_tracks(core_family, current_frame, packet, *, maximum_samples):
    """Measure compact new-colour masks and nearest supports, without roles.

    Missing masks and tied neighbours remain explicit; this does not establish
    control, an instruction, a disappearance cause or a successful transition.
    """
    if not core_family["domain_complete"] or len(packet) > maximum_samples:
        return FrozenMap({"domain_complete": False, "tracks": ()})
    cores = core_family["cores"]
    top = min(c["box"][0] for c in cores)
    left = min(c["box"][1] for c in cores)
    bottom = max(c["box"][2] for c in cores)
    right = max(c["box"][3] for c in cores)
    h = cores[0]["box"][2] - cores[0]["box"][0] + 1
    w = cores[0]["box"][3] - cores[0]["box"][1] + 1
    baseline_values = {current_frame.rows[r][c] for r in range(top, bottom + 1)
                       for c in range(left, right + 1)}
    tracks = defaultdict(list)
    for index, grid in enumerate(packet):
        points = defaultdict(list)
        for r in range(top, bottom + 1):
            for c in range(left, right + 1):
                value = grid.rows[r][c]
                if value not in baseline_values:
                    points[value].append((r, c))
        for value, positions in sorted(points.items()):
            if len(positions) > h * w:
                continue
            r0, r1 = min(r for r, _ in positions), max(r for r, _ in positions)
            c0, c1 = min(c for _, c in positions), max(c for _, c in positions)
            if r1 - r0 + 1 > h or c1 - c0 + 1 > w:
                continue
            distances = tuple((abs(r0 + r1 - core["box"][0] - core["box"][2])
                               + abs(c0 + c1 - core["box"][1] - core["box"][3]),
                               core["core_ref"]) for core in cores)
            distance = min(item[0] for item in distances)
            tracks[value].append({"frame_index": index, "box": (r0, c0, r1, c1),
                                  "pixel_count": len(positions),
                                  "nearest_distance_twice": distance,
                                  "nearest_core_refs": tuple(ref for d, ref in distances
                                                             if d == distance)})
    return FrozenMap({"domain_complete": True, "tracks": tuple(
        {"palette_value": value, "samples": tuple(samples)}
        for value, samples in sorted(tracks.items()))})


def measure_two_core_links(core_family, components):
    """Exact two-endpoint pigment components, without directed-edge meaning."""
    contacts = {}
    for core in core_family["cores"]:
        top, left, bottom, right = core["box"]
        boundary = {(r, c) for r in range(top - 1, bottom + 2)
                    for c in range(left - 1, right + 2)
                    if (top <= r <= bottom) != (left <= c <= right)}
        contacts[core["core_ref"]] = frozenset(
            (r + dr, c + dc) for r, c in boundary
            for dr, dc in ((0, 1), (0, -1), (1, 0), (-1, 0))) - boundary
    links = []
    for component in components:
        pixels = frozenset((r + component.bbox.top, c + component.bbox.left)
                           for r, c in component.relative_pixels)
        endpoints = tuple(ref for ref, contact in sorted(contacts.items()) if contact & pixels)
        if len(endpoints) == 2:
            links.append({"component_ref": component.component_id,
                          "palette_value": component.value, "endpoints": endpoints})
    return tuple(links)


def measure_banded_packet_context(value):
    """Only a multi-frame packet asks for these neutral relational measurements."""
    packet = value.latest_ordered_action_frames
    if len(packet) < 2:
        return FrozenMap()
    current = value.current_observed_frame or value.frame
    cores = measure_square_core_bands(value.components.components, minimum_area=2, maximum_cores=64)
    frames = measure_framed_patterns(current, value.components.components, maximum_frames=64)
    # Multiple geometric families are retained as alternatives, never ranked here.
    families = []
    for core in cores:
        if not core["domain_complete"]:
            continue
        tracks = measure_small_new_palette_tracks(core, current,
            ((value.previous_action_observed_frame,) if value.previous_action_observed_frame else ()) + packet,
            maximum_samples=130)
        for framed in frames:
            if not framed["domain_complete"]:
                continue
            families.append({"cores": core, "framed": framed,
                "activations": measure_uniform_border_activations(framed, packet, maximum_samples=129),
                "tracks": tracks,
                "track_prefix_count": int(value.previous_action_observed_frame is not None),
                "links": measure_two_core_links(core, value.components.components)})
    if not families:
        return FrozenMap()
    return FrozenMap({"families": tuple(families), "packet_frame_count": len(packet),
        "source_frame_count": value.latest_ordered_action_source_frame_count,
        "frame_ref": value.current_observation_frame_ref,
        "epoch": value.current_context_epoch,
        "parent_goal_ref": value.active_subgoal_ref,
        "action_ref": value.last_action_ref,
        "available_action_refs": value.available_action_refs})
