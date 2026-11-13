"""Bounded exact solid/border rectangle aspects, not instruction roles."""
from agents.yf_arc3_v5.logos.types import FrozenMap


def measure_program_instruction_shape_d(support):
    if (not isinstance(support, tuple) or not 1 <= len(support) <= 256
            or any(not isinstance(point, tuple) or len(point) != 2
                or any(type(axis) is not int for axis in point) for point in support)
            or len(set(support)) != len(support)):
        return FrozenMap({'shape_complete': False})
    rows, columns = zip(*support)
    top, left = min(rows), min(columns)
    height, width = max(rows)-top+1, max(columns)-left+1
    if height*width > 256:
        return FrozenMap({'shape_complete': False})
    normalized = tuple(sorted((row-top, column-left) for row, column in support))
    border = tuple((row, column) for row in range(height) for column in range(width)
        if row in (0, height-1) or column in (0, width-1))
    return FrozenMap({'shape_complete': True, 'normalized_support': normalized,
        'rectangle_filled': len(normalized) == height*width,
        'rectangle_border_only': height >= 3 and width >= 3 and normalized == border})
