"""Exact parallel column extents and alternating transverse marks.

No palette role, effect law, lifetime, action or terminal interpretation is
assigned here. Source may retain a question from these measured relations.
"""
from agents.yf_arc3_v5.logos.types import FrozenMap, stable_digest


def _columns(scene):
    frame = scene.frame
    components = scene.blocks.components
    columns = []
    for component in components:
        box = component.bbox
        if (box.bottom != frame.height - 1 or box.width < 3
                or box.width % 2 != 1 or box.height <= box.width
                or box.width == frame.width):
            continue
        marks = []
        for row in range(frame.height):
            pixels = frame.rows[row][box.left:box.right + 1]
            if (len(set(pixels[::2])) == 1 and len(set(pixels[1::2])) == 1
                    and pixels[0] != pixels[1]):
                marks.append((row, pixels[0]))
        if len(marks) != 2 or marks[0][1] != marks[1][1]:
            continue
        # Every pixel within the measured extent must be body or one of the
        # measured transverse masks. A sparse shape is not a filled column.
        mark_rows = {row: marker for row, marker in marks}
        exact = True
        for row in range(box.top, box.bottom + 1):
            for col in range(box.left, box.right + 1):
                expected = (mark_rows[row] if row in mark_rows
                            and (col - box.left) % 2 == 0 else component.value)
                if frame.rows[row][col] != expected:
                    exact = False
                    break
            if not exact:
                break
        if exact:
            columns.append((box.left, box.right, component.value,
                            box.height, tuple(frame.height - row for row, _ in marks),
                            marks[0][1], component.component_id))
    return tuple(sorted(columns))


def measure_banded_column_transition(*, before, after, transition_ref):
    left = _columns(before)
    right = _columns(after)
    # This bound is an observation inventory bound, never an executable route
    # or a claim that the displayed columns exhaust a mechanism's state.
    if not 2 <= len(left) <= 128 or len(left) != len(right):
        return ()
    before_keys = tuple((v[0], v[1], v[2], v[4], v[5]) for v in left)
    after_keys = tuple((v[0], v[1], v[2], v[4], v[5]) for v in right)
    if before_keys != after_keys or len({(v[3], v[4]) for v in before_keys}) != 1:
        return ()
    from .banded_chart_measurements import measure_chart
    before_chart = measure_chart(before)
    after_chart = measure_chart(after)
    geometry = tuple((v[0], v[1], v[2], v[4], v[5]) for v in right)
    return (FrozenMap({
        "chart_before": before_chart,
        "chart_after": after_chart,
        "geometry_digest": stable_digest((transition_ref, geometry)),
        "layout_digest": stable_digest(geometry),
        "transition_ref": transition_ref,
        "column_count": len(right),
        "column_values": tuple(v[2] for v in right),
        "before_component_refs": tuple(v[6] for v in left),
        "after_component_refs": tuple(v[6] for v in right),
        "filled_lengths_before": tuple(v[3] for v in left),
        "filled_lengths_after": tuple(v[3] for v in right),
        "filled_length_deltas": tuple(b[3] - a[3] for a, b in zip(left, right)),
        "transverse_offsets": right[0][4],
        "frame_height": after.frame.height,
        "glyph_inventory_measured": False,
        "operator_lifetimes_measured": False,
        "turn_phase_measured": False,
    }),)


def measure_current_banded_question_refs(value):
    """Transport a singleton current canonical question, without selecting a goal."""
    rows = tuple(row for row in value.canonical_banded_quantity_question_facts
                 if row.get("measurement_frame_ref") == value.current_observation_frame_ref
                 and row.get("context_epoch") == value.current_context_epoch
                 and row.get("claim_ref") and len(row.get("argument_refs", ())) == 2)
    measured = {"banded_quantity_question_current_count": len(rows),
        "banded_column_observation_facts": tuple(row for row in
            value.canonical_banded_quantity_observation_facts
            if row.get("context_epoch") == value.current_context_epoch),
        "banded_column_context_epoch": value.current_context_epoch}
    if len(rows) == 1:
        row = rows[0]
        measured.update({
            "banded_quantity_question_claim_ref": row["claim_ref"],
            "banded_quantity_question_goal_ref": row["argument_refs"][0],
            "banded_quantity_question_term_ref": row["argument_refs"][1],
        })
    return measured
