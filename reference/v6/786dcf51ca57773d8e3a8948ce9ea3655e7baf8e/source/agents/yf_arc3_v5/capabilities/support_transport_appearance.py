"""Exact cell overlays for a Source-declared, revisable transport assignment.

These calculations neither infer roles from palette values nor select a model.
They measure signatures and all their current occurrences on the supplied cells.
"""
from agents.yf_arc3_v5.logos.types import FrozenMap


def cell_pixels(frame, cell):
    box = cell.bbox
    return tuple(tuple(row[box.left:box.right + 1])
        for row in frame.rows[box.top:box.bottom + 1])


def measure_overlay_template(frame, cell, substrates):
    pixels = cell_pixels(frame, cell)
    height, width = len(pixels), len(pixels[0])
    alternatives = set()
    for substrate in substrates:
        if len(substrate) != height or any(len(row) != width for row in substrate):
            continue
        differences = tuple((r, c, pixels[r][c])
            for r in range(height) for c in range(width)
            if pixels[r][c] != substrate[r][c])
        # Preserve a complete matching peripheral substrate. An overhanging
        # or edge-touching sprite needs a different declared measurement model.
        if differences and all(0 < r < height - 1 and 0 < c < width - 1
                for r, c, _ in differences):
            alternatives.add(differences)
    if len(alternatives) != 1:
        return None
    return FrozenMap({"height": height, "width": width,
        "pixels": next(iter(alternatives))})


def measure_template_cells(frame, cells, template, substrates):
    """Enumerate exact patch plus substrate matches, retaining every tie."""
    height, width = int(template["height"]), int(template["width"])
    patch = {(int(r), int(c)): int(v) for r, c, v in template["pixels"]}
    if not patch or height * width > 1024 or any(
        not (0 <= r < height and 0 <= c < width) for r, c in sorted(patch)
    ):
        return ()
    matches = []
    for cell in cells:
        pixels = cell_pixels(frame, cell)
        if len(pixels) != height or any(len(row) != width for row in pixels):
            continue
        if any(len(substrate) == height
            and all(len(row) == width for row in substrate)
            and all(pixels[r][c] == patch.get((r, c), substrate[r][c])
                for r in range(height) for c in range(width))
            for substrate in substrates):
            matches.append(cell)
    return tuple(matches)
