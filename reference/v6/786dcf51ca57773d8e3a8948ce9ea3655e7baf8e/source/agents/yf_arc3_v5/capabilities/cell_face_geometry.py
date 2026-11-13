"""Exact finite comparison of a raster cell's four triangular quarters.

No role, interaction direction or physical law is selected here. Each face
is rotated into the same coordinate system before its raster is compared.
"""
from fractions import Fraction
from functools import lru_cache


@lru_cache(maxsize=4096)
def triangular_face_patterns(rows, maximum_samples):
    height = len(rows)
    width = len(rows[0]) if height else 0
    if not width or any(len(row) != width for row in rows):
        return (), 0, False
    # Overlay the exact row and column boundaries. This preserves rectangular
    # cell detail under quarter turns without an expansive LCM-sized raster.
    cuts = sorted({Fraction(2 * i, height) - 1 for i in range(height + 1)}
                  | {Fraction(2 * i, width) - 1 for i in range(width + 1)}
                  | {Fraction(0)})
    samples = []
    for y0, y1 in zip(cuts, cuts[1:]):
        if y0 >= 0:
            continue
        for x0, x1 in zip(cuts, cuts[1:]):
            minimum_abs_x = 0 if x0 <= 0 <= x1 else min(abs(x0), abs(x1))
            # Positive-area intersection with the triangle y < -abs(x).
            # Values are constant in every overlay rectangle, so its centre
            # represents the whole intersecting portion, including edge pixels.
            if y0 >= -minimum_abs_x:
                continue
            if 4 * (len(samples) + 1) > maximum_samples:
                return (), 4 * len(samples), False
            samples.append(((x0 + x1) / 2, (y0 + y1) / 2))
    patterns = [[], [], [], []]
    for x, y in samples:
        for i, (source_x, source_y) in enumerate(((x, y), (-y, x), (-x, -y), (y, -x))):
            col = int((source_x + 1) * width / 2)
            row = int((source_y + 1) * height / 2)
            patterns[i].append(rows[row][col])
    faces = ((-1, 0), (0, 1), (1, 0), (0, -1))
    return tuple((face, tuple(pattern)) for face, pattern in zip(faces, patterns)), 4 * len(samples), True


def measure_cell_faces(rows, contract):
    if contract.get('geometry') != 'CENTER_TO_ADJACENT_SIDE_CORNERS':
        return {'complete': False, 'sample_count': 0, 'different_pairs': ()}
    patterns, count, complete = triangular_face_patterns(
        tuple(tuple(row) for row in rows), int(contract.get('maximum_samples', 0)))
    pairs = tuple((a, b) for i, (a, first) in enumerate(patterns)
                  for b, second in patterns[i + 1:] if first != second)
    return {'complete': complete, 'sample_count': count, 'different_pairs': pairs}
