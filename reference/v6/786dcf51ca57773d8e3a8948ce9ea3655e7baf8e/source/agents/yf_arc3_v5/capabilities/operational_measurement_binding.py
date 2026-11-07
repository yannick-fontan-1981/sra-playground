"""Typed transport for a fixed set of neutral physical measurements.

SRC names the target. This adapter preserves call arguments, validates the
declared signature and returns the exact value. It never chooses a calculation,
gives its result a world meaning or authorizes a subsequent operation.
"""
from __future__ import annotations

from dataclasses import dataclass, is_dataclass
from functools import lru_cache
import hashlib
import inspect
from pathlib import Path
from typing import Annotated, Any, Callable, Literal, get_args, get_type_hints

from pydantic import BeforeValidator, Field, create_model

from agents.yf_arc3_v5.logos.types import FrozenMap, FrozenModel, stable_digest, restore_nominal_dataclass_input
from .periodic_correspondence import measure_periodic_delta
from .reflection_correspondence import measure_reflection_delta
from .symbolic_diagrams import measure_diagram_transition
from .complementary_contours import advance_contour_delta
from .concentric_frames import advance_concentric_frame_additions
from .affine_glyphs import measure_point_ordered_collection_delta
from .layer_correspondence import measure_layer_transition
from .sparse_raster_transition import measure_sparse_raster_transition, measure_sparse_raster_series
from .ordered_tip_changes import measure_ordered_square_packet
from .parallel_cell_fields import measure_axial_packet
from .symbol_tiles import measure_symbol_tile_transitions
from .repeated_pairs import measure_repeated_pair_state_effect_relations
from .cell_recount import (
    delta_between_known_grid_recounts, measure_retained_grid_new_singletons,
    measure_retained_grid_motion_frontier, measure_retained_grid_initial_exploratory_frontier,
    measure_retained_grid_interaction_frontier, measure_retained_grid_point_delta_frontier,
    measure_retained_grid_terrain_route, measure_retained_grid_viewport_shift_frontier,
    measure_retained_grid_viewport_shift_sequence,
)


class OperationalConsciousnessMeasurementArguments(FrozenModel):
    """The actual call before typed validation inside its Source operation."""
    positional: tuple[Any, ...] = ()
    named: FrozenMap = Field(default_factory=FrozenMap)
    schema_version: Literal['yf_arc3_v5.operational_measurement_arguments.v1'] = 'yf_arc3_v5.operational_measurement_arguments.v1'


@dataclass(frozen=True, slots=True)
class OperationalConsciousnessMeasurementBinding:
    capability_ref: str
    function: Callable[..., object]
    signature: inspect.Signature
    request_model: type[FrozenModel]
    result_model: type[FrozenModel]
    source_file: str
    qualified_source_hash: str

    def invoke(self, arguments: OperationalConsciousnessMeasurementArguments) -> FrozenModel:
        # Argument/type failures belong to the real SRC CALL and its outcome.
        bound = self.signature.bind(*arguments.positional, **dict(arguments.named))
        bound.apply_defaults()
        request = self.request_model.model_validate(bound.arguments)
        values = {name: getattr(request, name) for name in sorted(self.signature.parameters)}
        return self.result_model(value=self.function(**values))


# Fixed code-owned targets; no runtime function-name lookup or import.
_MEASUREMENTS = (
    ('retained_grid_delta_measurement', delta_between_known_grid_recounts),
    ('retained_grid_novelty_measurement', measure_retained_grid_new_singletons),
    ('retained_grid_motion_measurement', measure_retained_grid_motion_frontier),
    ('retained_grid_initial_frontier_measurement', measure_retained_grid_initial_exploratory_frontier),
    ('retained_grid_interaction_measurement', measure_retained_grid_interaction_frontier),
    ('retained_grid_point_measurement', measure_retained_grid_point_delta_frontier),
    ('retained_grid_terrain_route_measurement', measure_retained_grid_terrain_route),
    ('retained_grid_viewport_measurement', measure_retained_grid_viewport_shift_frontier),
    ('retained_grid_viewport_sequence_measurement', measure_retained_grid_viewport_shift_sequence),
    ('point_ordered_collection_measurement', measure_point_ordered_collection_delta),
    ('layer_transition_measurement', measure_layer_transition),
    ('sparse_raster_transition_measurement', measure_sparse_raster_transition),
    ('sparse_raster_series_measurement', measure_sparse_raster_series),
    ('ordered_square_transition_measurement', measure_ordered_square_packet),
    ('axial_transition_measurement', measure_axial_packet),
    ('symbol_tile_transition_measurement', measure_symbol_tile_transitions),
    ('repeated_pair_effect_measurement', measure_repeated_pair_state_effect_relations),
    ('periodic_transition_measurement', measure_periodic_delta),
    ('reflection_transition_measurement', measure_reflection_delta),
    ('diagram_transition_measurement', measure_diagram_transition),
    ('contour_transition_measurement', advance_contour_delta),
    ('concentric_transition_measurement', advance_concentric_frame_additions),
)


def _measurement_type_source_hashes(hints: dict[str, Any]) -> dict[str, str]:
    """Include V5 nominal contract/validator sources, not only JSON schemas."""
    pending = [FrozenModel, *(hints[name] for name in sorted(hints))]
    # Keep visited annotation objects alive for this traversal. get_type_hints
    # can create temporary generic aliases: retaining only their integer ids
    # lets Python reuse one id and silently omit a later contract dependency.
    visited, hashes = {}, {}
    while pending:
        hint = pending.pop()
        if id(hint) in visited:
            continue
        visited[id(hint)] = hint
        pending.extend(get_args(hint))
        if not isinstance(hint, type) or not hint.__module__.startswith('agents.yf_arc3_v5.'):
            continue
        source_name = inspect.getsourcefile(hint)
        if source_name is None:
            raise TypeError('operational measurement type has no inspectable source')
        hashes[hint.__module__] = hashlib.sha256(Path(source_name).read_bytes()).hexdigest()
        annotations = get_type_hints(hint)
        pending.extend(annotations[name] for name in sorted(annotations))
        pending.extend(hint.__bases__)
    return hashes


def _contains_dataclass_contract(annotation):
    return (isinstance(annotation, type) and is_dataclass(annotation)) or any(
        _contains_dataclass_contract(item) for item in get_args(annotation))


def _nominal_contract_annotation(annotation):
    if _contains_dataclass_contract(annotation):
        return Annotated[annotation, BeforeValidator(restore_nominal_dataclass_input)]
    return annotation


@lru_cache(maxsize=1)
def operational_measurement_bindings() -> tuple[OperationalConsciousnessMeasurementBinding, ...]:
    """Complete annotations produce nominal contracts; gaps reject loading."""
    bindings = []
    adapter_hash = hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
    for name, function in _MEASUREMENTS:
        signature = inspect.signature(function)
        hints = get_type_hints(function)
        if 'return' not in hints or any(parameter not in hints for parameter in sorted(signature.parameters)):
            raise TypeError('operational measurement lacks a complete typed signature: ' + name)
        if 'schema_version' in signature.parameters or any(signature.parameters[parameter].kind not in (
                inspect.Parameter.POSITIONAL_OR_KEYWORD, inspect.Parameter.KEYWORD_ONLY)
                for parameter in sorted(signature.parameters)):
            raise TypeError('operational measurement has an unsupported argument form: ' + name)
        fields = {parameter: (_nominal_contract_annotation(hints[parameter]),
            ... if value.default is inspect.Parameter.empty else value.default)
            for parameter, value in sorted(signature.parameters.items())}
        class_name = 'OperationalConsciousness' + ''.join(part.title() for part in name.split('_'))
        request_schema = 'yf_arc3_v5.' + name + '_request.v1'
        result_schema = 'yf_arc3_v5.' + name + '_result.v1'
        request_model = create_model(class_name + 'Request', __base__=FrozenModel,
            __module__=__name__, schema_version=(Literal[request_schema], request_schema), **fields)
        result_model = create_model(class_name + 'Result', __base__=FrozenModel,
            __module__=__name__, value=(_nominal_contract_annotation(hints['return']), ...),
            schema_version=(Literal[result_schema], result_schema))
        source_name = inspect.getsourcefile(function)
        if source_name is None:
            raise TypeError('operational measurement has no inspectable source: ' + name)
        source = Path(source_name)
        if source.resolve().parent != Path(__file__).resolve().parent:
            raise TypeError('operational measurement source is outside the capability package')
        qualified_hash = stable_digest({
            'function_ref': function.__module__ + '.' + function.__qualname__,
            'function_source_hash': hashlib.sha256(source.read_bytes()).hexdigest(),
            'adapter_source_hash': adapter_hash,
            'type_source_hashes': _measurement_type_source_hashes(hints),
            'request_schema': request_model.model_json_schema(),
            'result_schema': result_model.model_json_schema(),
        })
        bindings.append(OperationalConsciousnessMeasurementBinding(
            'capability.' + name, function, signature, request_model, result_model,
            source.name, qualified_hash))
    return tuple(bindings)
