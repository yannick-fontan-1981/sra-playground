"""Exact finite cell-reflection measurements without semantic selection.

The measurement enumerates row/column reflections, their joint closure and a
half-turn.  DRM decides whether an action-conditioned description means that a
distinctive value is repairable; this module only reports exact finite deltas.
"""

from collections import Counter
from dataclasses import dataclass
from .physical_transition_contracts import ReflectionDelta
from functools import lru_cache
from hashlib import sha256
import json
from itertools import combinations

from agents.yf_arc3_v5.capabilities.components import detect_components
from agents.yf_arc3_v5.capabilities.contracts import (
    ComponentExtractionInput,
    FrameGrid,
)
from agents.yf_arc3_v5.capabilities.periodic_correspondence import (
    PeriodicMeasurementBoundExceeded,
    UniformLattice,
    measure_uniform_lattices,
)


MAX_REFLECTION_DESCRIPTIONS = 64
TRANSFORM_REFS = (
    "measure.reflect_rows",
    "measure.reflect_columns",
    "measure.reflect_rows_and_columns",
    "measure.rotate_half_turn",
)


class ReflectionMeasurementBoundExceeded(ValueError):
    pass


@dataclass(frozen=True)
class ReflectionDescription:
    transform_ref: str
    omitted_value: int | None
    projected_values: tuple[tuple[int, ...], ...]
    concordant_relation_count: int
    exception_relation_count: int
    count_difference: int
    omitted_values: tuple[int, ...] = ()




def _digest(values: object) -> str:
    payload = json.dumps(values, sort_keys=True, separators=(",", ":"))
    return sha256(payload.encode("ascii")).hexdigest()


def _orbit(
    height: int,
    width: int,
    row: int,
    column: int,
    transform_ref: str,
) -> frozenset[tuple[int, int]]:
    if transform_ref == "measure.reflect_rows":
        return frozenset(((row, column), (height - 1 - row, column)))
    if transform_ref == "measure.reflect_columns":
        return frozenset(((row, column), (row, width - 1 - column)))
    if transform_ref == "measure.rotate_half_turn":
        return frozenset(
            ((row, column), (height - 1 - row, width - 1 - column))
        )
    if transform_ref == "measure.reflect_rows_and_columns":
        return frozenset(
            (
                (row, column),
                (height - 1 - row, column),
                (row, width - 1 - column),
                (height - 1 - row, width - 1 - column),
            )
        )
    raise ValueError(f"unsupported finite transform: {transform_ref}")


@lru_cache(maxsize=16)
def measure_reflection_descriptions(
    field: UniformLattice,
) -> tuple[ReflectionDescription, ...]:
    height = len(field.rows)
    width = len(field.columns)
    values = tuple(sorted({value for row in field.values for value in row}))
    descriptions: list[ReflectionDescription] = []
    attempts = 0
    for transform_ref in TRANSFORM_REFS:
        for omitted_value in values:
            attempts += 1
            if attempts > MAX_REFLECTION_DESCRIPTIONS:
                raise ReflectionMeasurementBoundExceeded(
                    "reflection description bound"
                )
            projected = [list(row) for row in field.values]
            visited: set[frozenset[tuple[int, int]]] = set()
            concordant = 0
            exceptions = 0
            complete = True
            for row in range(height):
                for column in range(width):
                    orbit = _orbit(
                        height, width, row, column, transform_ref
                    )
                    if orbit in visited:
                        continue
                    visited.add(orbit)
                    if len(orbit) == 1:
                        only_row, only_column = next(iter(orbit))
                        if field.values[only_row][only_column] == omitted_value:
                            complete = False
                            break
                        continue
                    retained_values = tuple(
                        field.values[other_row][other_column]
                        for other_row, other_column in sorted(orbit)
                        if field.values[other_row][other_column] != omitted_value
                    )
                    omitted_count = sum(
                        field.values[other_row][other_column] == omitted_value
                        for other_row, other_column in orbit
                    )
                    if not retained_values or len(set(retained_values)) != 1:
                        complete = False
                        break
                    measured_value = retained_values[0]
                    for other_row, other_column in orbit:
                        projected[other_row][other_column] = measured_value
                    concordant += len(retained_values) - 1
                    exceptions += omitted_count
                if not complete:
                    break
            if complete and exceptions > 0:
                descriptions.append(
                    ReflectionDescription(
                        transform_ref=transform_ref,
                        omitted_value=omitted_value,
                        projected_values=tuple(tuple(row) for row in projected),
                        concordant_relation_count=concordant,
                        exception_relation_count=exceptions,
                        count_difference=concordant - exceptions,
                    )
                )
    return tuple(descriptions)


@lru_cache(maxsize=16)
def measure_paired_reflection_descriptions(
    field: UniformLattice, vocabulary: tuple[int, ...],
) -> tuple[tuple[ReflectionDescription, ...], bool]:
    """All two-value omission maps within the existing per-family attempt bound.

    The one-value family stays independent. Source decides whether to use this
    additional counterfactual family. An oversized vocabulary reports an
    incomplete inventory instead of invalidating the existing calculation.
    """
    values = tuple(sorted(set(vocabulary)))
    total_attempts = len(TRANSFORM_REFS) * len(values)*(len(values)-1)//2
    if total_attempts > MAX_REFLECTION_DESCRIPTIONS:
        return (), False
    height, width = len(field.rows), len(field.columns)
    descriptions = []
    for transform_ref in TRANSFORM_REFS:
        for omitted in combinations(values, 2):
            projected = [list(row) for row in field.values]
            visited = set()
            concordant, exceptions, complete = 0, 0, True
            for row in range(height):
                for column in range(width):
                    orbit = _orbit(height, width, row, column, transform_ref)
                    if orbit in visited:
                        continue
                    visited.add(orbit)
                    if len(orbit) == 1:
                        if field.values[row][column] in omitted:
                            complete = False
                            break
                        continue
                    retained = tuple(field.values[r][c] for r, c in sorted(orbit)
                                     if field.values[r][c] not in omitted)
                    if not retained or len(set(retained)) != 1:
                        complete = False
                        break
                    for r, c in sorted(orbit):
                        projected[r][c] = retained[0]
                    concordant += len(retained)-1
                    exceptions += len(orbit)-len(retained)
                if not complete:
                    break
            if complete and exceptions:
                descriptions.append(ReflectionDescription(
                    transform_ref=transform_ref, omitted_value=None,
                    projected_values=tuple(tuple(row) for row in projected),
                    concordant_relation_count=concordant,
                    exception_relation_count=exceptions,
                    count_difference=concordant-exceptions,
                    omitted_values=omitted))
    return tuple(descriptions), True


def _logical_index(
    field: UniformLattice, point: tuple[int, int]
) -> tuple[int, int] | None:
    matches = tuple(
        (row, column)
        for row in range(len(field.rows))
        for column in range(len(field.columns))
        if field.point(row, column) == point
    )
    return matches[0] if len(matches) == 1 else None


def _outside_rectangular_quantities(
    frame: FrameGrid, field: UniformLattice
) -> Counter[int]:
    """Count compact filled rectangles outside one lattice, by observed value."""

    quantities: Counter[int] = Counter()
    for component in detect_components(
        ComponentExtractionInput(frame=frame)
    ).components:
        box = component.bbox
        if (
            not field.contains(box)
            and component.area == box.height * box.width
            and min(box.height, box.width) <= field.extent
        ):
            quantities[component.value] += component.area
    return quantities


@lru_cache(maxsize=8)
def measure_reflection_field_inventory(
    frame: FrameGrid,
) -> tuple[tuple[UniformLattice, ...], bool]:
    """Report an incomplete reflection domain when exact enumeration is bounded.

    No partial alternatives become a complete inventory or a transition witness.
    Other measurement domains remain independent of this optional enumeration.
    The exact lattice query still enforces and raises its original bounds.
    """
    try:
        return measure_uniform_lattices(frame, include_partitioned_fields=True), True
    except PeriodicMeasurementBoundExceeded:
        return (), False


def measure_reflection_delta(
    before: FrameGrid,
    after: FrameGrid,
    point: tuple[int, int] | None,
    prior: ReflectionDelta | None = None,
) -> ReflectionDelta | None:
    if point is None:
        return None
    # An unchanged raster and a disjoint point do not replace an existing
    # field measurement. Return the original immutable witness, including its
    # original point/hash, rather than attribute the field change to this probe.
    if (
        prior is not None
        and before.rows == after.rows
        and prior.after_frame_hash == _digest(after.rows)
        and not (
            prior.field.rows[0] <= point[0] < prior.field.rows[-1] + prior.field.extent
            and prior.field.columns[0] <= point[1] < prior.field.columns[-1] + prior.field.extent
        )
    ):
        return prior
    before_fields, before_complete = measure_reflection_field_inventory(before)
    after_fields, after_complete = measure_reflection_field_inventory(after)
    if not before_complete or not after_complete:
        return None
    field_pairs = tuple(
        (before_field, after_field)
        for before_field in before_fields
        for after_field in after_fields
        if (
            before_field.rows,
            before_field.columns,
            before_field.extent,
        )
        == (
            after_field.rows,
            after_field.columns,
            after_field.extent,
        )
        and _logical_index(before_field, point) is not None
    )
    if len(field_pairs) != 1:
        return None
    before_field, after_field = field_pairs[0]
    logical = _logical_index(before_field, point)
    if logical is None:
        return None
    row, column = logical
    before_value = before_field.values[row][column]
    after_value = after_field.values[row][column]
    descriptions = tuple(
        description
        for description in measure_reflection_descriptions(after_field)
        if description.omitted_value == before_value
        and before_value != after_value
        and description.projected_values[row][column] == after_value
    )
    # Preserve the observed vocabulary within the exact field/response scope;
    # a value disappearing after correction does not erase its measured class.
    prior_pair_values = (
        prior.pair_omitted_values if prior is not None
        and prior.after_frame_hash == _digest(before.rows)
        and (prior.field.rows, prior.field.columns, prior.field.extent)
        == (before_field.rows, before_field.columns, before_field.extent) else ()
    )
    vocabulary = tuple(sorted({v for row in before_field.values for v in row}
                              | {v for row in after_field.values for v in row}
                              | set(prior_pair_values)))
    pair_all, pair_complete = measure_paired_reflection_descriptions(after_field, vocabulary)
    pair_descriptions = tuple(d for d in pair_all
        if before_value in d.omitted_values and before_value != after_value
        and d.projected_values[row][column] == after_value)
    pair_projections = {d.projected_values for d in pair_descriptions}
    pair_projection = next(iter(pair_projections)) if len(pair_projections) == 1 else None
    pair_residual_delta = (sum(
        int(after_field.values[r][c] != pair_projection[r][c])
        - int(before_field.values[r][c] != pair_projection[r][c])
        for r in range(len(before_field.rows)) for c in range(len(before_field.columns)))
        if pair_projection is not None else 0)
    projections = {
        description.projected_values for description in descriptions
    }
    unique_projection = next(iter(projections)) if len(projections) == 1 else None
    changes = tuple(
        (other_row, other_column)
        for other_row in range(len(before_field.rows))
        for other_column in range(len(before_field.columns))
        if before_field.values[other_row][other_column]
        != after_field.values[other_row][other_column]
    )
    if unique_projection is None:
        residual_delta = 0
    else:
        before_residual = sum(
            before_field.values[other_row][other_column]
            != unique_projection[other_row][other_column]
            for other_row in range(len(before_field.rows))
            for other_column in range(len(before_field.columns))
        )
        after_residual = sum(
            after_field.values[other_row][other_column]
            != unique_projection[other_row][other_column]
            for other_row in range(len(after_field.rows))
            for other_column in range(len(after_field.columns))
        )
        residual_delta = after_residual - before_residual
    before_boundary = _outside_rectangular_quantities(before, before_field)
    after_boundary = _outside_rectangular_quantities(after, after_field)
    boundary_decreases = {
        value: before_boundary[value] - after_boundary[value]
        for value in sorted(before_boundary)
        if before_boundary[value] > after_boundary[value]
    }
    return ReflectionDelta(
        field=after_field,
        projected_values=unique_projection,
        after_frame_hash=_digest(after.rows),
        point=point,
        before_value=before_value,
        after_value=after_value,
        other_cell_changes=sum(change != logical for change in changes),
        residual_delta=residual_delta,
        exact_description_count=len(descriptions),
        distinct_projection_count=len(projections),
        minimum_concordance=min(
            (
                description.concordant_relation_count
                for description in descriptions
            ),
            default=0,
        ),
        minimum_count_difference=min(
            (description.count_difference for description in descriptions),
            default=0,
        ),
        transform_refs=tuple(
            sorted({description.transform_ref for description in descriptions})
        ),
        boundary_rectangular_decreasing_value_count=len(boundary_decreases),
        boundary_rectangular_quantity_decrease_magnitude=sum(
            boundary_decreases.values()
        ),
        boundary_rectangular_decreasing_values=tuple(boundary_decreases),
        pair_projected_values=pair_projection,
        pair_omitted_values=tuple(sorted({v for d in pair_descriptions for v in d.omitted_values})),
        pair_inventory_complete=pair_complete,
        pair_exact_description_count=len(pair_descriptions),
        pair_distinct_projection_count=len(pair_projections),
        pair_minimum_concordance=min((d.concordant_relation_count for d in pair_descriptions), default=0),
        pair_minimum_count_difference=min((d.count_difference for d in pair_descriptions), default=0),
        pair_residual_delta=pair_residual_delta,
        pair_transform_refs=tuple(sorted({d.transform_ref for d in pair_descriptions})),
    )


def measure_reflection_context(
    frame: FrameGrid,
    fields: tuple[UniformLattice, ...],
    prior: ReflectionDelta | None,
    *,
    inventory_complete: bool = True,
) -> dict[str, object]:
    current_prior = bool(
        inventory_complete
        and prior is not None and prior.after_frame_hash == _digest(frame.rows)
    )
    pair_point = _logical_index(prior.field, prior.point) if current_prior and prior else None
    return {
        "reflection_field_count": len(fields),
        "reflection_inventory_complete": inventory_complete,
        "reflection_transition_present": current_prior,
        "reflection_pair_inventory_complete": bool(current_prior and prior and prior.pair_inventory_complete),
        "reflection_pair_exact_description_count": prior.pair_exact_description_count if current_prior and prior else 0,
        "reflection_pair_distinct_projection_count": prior.pair_distinct_projection_count if current_prior and prior else 0,
        "reflection_pair_minimum_concordance": prior.pair_minimum_concordance if current_prior and prior else 0,
        "reflection_pair_minimum_count_difference": prior.pair_minimum_count_difference if current_prior and prior else 0,
        "reflection_pair_transform_measurement_refs": prior.pair_transform_refs if current_prior and prior else (),
        "reflection_pair_prior_residual_delta": prior.pair_residual_delta if current_prior and prior else 0,
        "reflection_pair_prior_point_reached_projection": bool(current_prior and prior
            and prior.pair_projected_values is not None and pair_point is not None
            and prior.after_value == prior.pair_projected_values[pair_point[0]][pair_point[1]]),
        "reflection_exact_description_count": (
            prior.exact_description_count if current_prior and prior else 0
        ),
        "reflection_distinct_projection_count": (
            prior.distinct_projection_count if current_prior and prior else 0
        ),
        "reflection_minimum_concordance": (
            prior.minimum_concordance if current_prior and prior else 0
        ),
        "reflection_minimum_count_difference": (
            prior.minimum_count_difference if current_prior and prior else 0
        ),
        "reflection_transform_measurement_refs": (
            prior.transform_refs if current_prior and prior else ()
        ),
        "reflection_prior_point_reached_projection": bool(
            current_prior
            and prior
            and prior.projected_values is not None
            and prior.after_value
            == prior.projected_values[
                _logical_index(prior.field, prior.point)[0]
            ][_logical_index(prior.field, prior.point)[1]]
        ),
        "reflection_prior_other_cell_changes": (
            prior.other_cell_changes if current_prior and prior else 0
        ),
        "reflection_prior_residual_delta": (
            prior.residual_delta if current_prior and prior else 0
        ),
        "reflection_boundary_rectangular_decreasing_value_count": (
            prior.boundary_rectangular_decreasing_value_count
            if current_prior and prior
            else 0
        ),
        "reflection_boundary_rectangular_quantity_decrease_magnitude": (
            prior.boundary_rectangular_quantity_decrease_magnitude
            if current_prior and prior
            else 0
        ),
        "reflection_boundary_rectangular_decreasing_values": (
            prior.boundary_rectangular_decreasing_values
            if current_prior and prior
            else ()
        ),
    }


def measure_reflection_candidate(
    fields: tuple[UniformLattice, ...],
    point: tuple[int, int] | None,
    prior: ReflectionDelta | None,
) -> dict[str, object]:
    facts: dict[str, object] = {
        "reflection_point_in_field": False,
        "reflection_field_distinct_value_count": 0,
        "reflection_cell_value_occurrence_count": 0,
        "reflection_field_minimum_value_occurrence_count": 0,
        "reflection_field_minimum_value_kind_count": 0,
        "reflection_cell_has_unique_strict_minimum_value_frequency": False,
        "reflection_point_matches_prior_distinct_value": False,
        "reflection_point_differs_from_projection": False,
        "reflection_point_projected_value": -1,
        "reflection_pair_point_matches_omission_class": False,
        "reflection_pair_point_differs_from_projection": False,
        "reflection_pair_point_projected_value": -1,
    }
    if point is None:
        return facts
    matching = tuple(
        (field, logical)
        for field in fields
        if (logical := _logical_index(field, point)) is not None
    )
    if len(matching) != 1:
        return facts
    field, (row, column) = matching[0]
    counts = Counter(value for values in field.values for value in values)
    occurrence_counts = tuple(counts[value] for value in sorted(counts))
    minimum = min(occurrence_counts, default=0)
    minimum_kind_count = sum(
        count == minimum for count in occurrence_counts
    )
    current_value = field.values[row][column]
    facts.update(
        {
            "reflection_point_in_field": True,
            "reflection_field_distinct_value_count": len(counts),
            "reflection_cell_value_occurrence_count": counts[current_value],
            "reflection_field_minimum_value_occurrence_count": minimum,
            "reflection_field_minimum_value_kind_count": minimum_kind_count,
            "reflection_cell_has_unique_strict_minimum_value_frequency": bool(
                len(counts) > 1
                and minimum_kind_count == 1
                and counts[current_value] == minimum
            ),
        }
    )
    if (prior is not None and prior.pair_projected_values is not None
            and (field.rows, field.columns, field.extent)
            == (prior.field.rows, prior.field.columns, prior.field.extent)):
        pair_value = prior.pair_projected_values[row][column]
        facts.update({
            "reflection_pair_point_matches_omission_class": current_value in prior.pair_omitted_values,
            "reflection_pair_point_differs_from_projection": current_value != pair_value,
            "reflection_pair_point_projected_value": pair_value,
        })
    if (
        prior is None
        or prior.projected_values is None
    ):
        return facts
    mapped_value = prior.projected_values[row][column]
    facts.update(
        {
            "reflection_point_matches_prior_distinct_value": (
                current_value == prior.before_value
            ),
            "reflection_point_differs_from_projection": (
                current_value != mapped_value
            ),
            "reflection_point_projected_value": mapped_value,
        }
    )
    return facts
