"""Deterministic JSON-value evaluation for compiled SRC expressions and bindings."""

from __future__ import annotations

from collections.abc import Callable, Mapping
from enum import Enum
from functools import lru_cache
import weakref
from types import UnionType
from typing import Annotated, Any, Union, get_args, get_origin

from pydantic import BaseModel

from agents.yf_arc3_v5.logos.types import (
    FrozenMap,
    FrozenModel,
    canonical_json,
    ensure_nominal_json_serializer,
    freeze_json,
)
from agents.yf_arc3_v5.src.ast import ExpressionKind
from agents.yf_arc3_v5.src.compiler import IrExpression
from agents.yf_arc3_v5.src.symbols import TypeSpec
from agents.yf_arc3_v5.logos.source_completion import SourceRuntimeTypeMismatch


class ExpressionEvaluationError(ValueError):
    """An expression could not be evaluated from declared runtime values."""


class RuntimeTypeError(TypeError):
    """A JSON-compatible runtime value violates its compiled binding type."""

    def __init__(self, *, location: str, expected_type: str, observed_type: str):
        self.mismatch = SourceRuntimeTypeMismatch(
            location=location, expected_type=expected_type, observed_type=observed_type,
        )
        super().__init__(f"{location} requires {expected_type}, got {observed_type}")


@lru_cache(maxsize=512)
def _canonical_model_field_names(model_type: type[FrozenModel]) -> tuple[str, ...]:
    """The schema fixes field names; never sort them for each model instance."""

    return tuple(sorted(model_type.model_fields))


@lru_cache(maxsize=512)
def _model_field_index(model_type):
    return frozenset(_canonical_model_field_names(model_type))


_UNPROJECTED_FIELD = object()


# Declarative workflow frames reuse many immutable tuple bindings during one
# reflection.  Keep the cache bounded, but large enough not to churn through
# the same raster/route tuples before the next checkpoint.
_RUNTIME_TUPLE_CACHE_LIMIT = 512
_RUNTIME_TUPLE_CACHE: dict[int, tuple[tuple[object, ...], tuple[object, ...]]] = {}
_RUNTIME_MODEL_MAP_CACHE_LIMIT = 1024
_RUNTIME_MODEL_MAP_CACHE: dict[int, weakref.ReferenceType["RuntimeModelMap"]] = {}


def _runtime_tuple(value: tuple[object, ...]) -> tuple[object, ...]:
    identity = id(value)
    cached = _RUNTIME_TUPLE_CACHE.get(identity)
    if cached is not None and cached[0] is value:
        return cached[1]
    # A tuple of exact JSON scalar leaves is already recursively immutable.
    # Preserve its identity instead of rebuilding large raster/pixel sequences
    # and visiting every scalar through the general model projection walker.
    if all(item is None or type(item) in (str, bool, int)
           or isinstance(item, FrozenMap) for item in value):
        converted = value
    else:
        changed = None
        for index, item in enumerate(value):
            child = runtime_value(item)
            if changed is not None:
                changed.append(child)
            elif child is not item:
                changed = list(value[:index])
                changed.append(child)
        converted = value if changed is None else tuple(changed)
    # Keep this optimization restricted to small immutable scalar vectors.
    # Caching tuples of typed models/maps retained whole obsolete scene graphs.
    if (converted is value and len(value) <= 128 and all(
            item is None or type(item) is bool
            or type(item) is int and item.bit_length() <= 64
            or type(item) is str and len(item) <= 128 for item in value)):
        if len(_RUNTIME_TUPLE_CACHE) >= _RUNTIME_TUPLE_CACHE_LIMIT:
            _RUNTIME_TUPLE_CACHE.pop(next(iter(_RUNTIME_TUPLE_CACHE)))
        _RUNTIME_TUPLE_CACHE[identity] = (value, converted)
    return converted


def _direct_runtime_json_type(annotation, seen=frozenset()) -> bool:
    """Certify nominal fields whose raw JSON shape equals runtime transport.

    This is only a serializer plan, never an argument/authority validation cache.
    Unknown or recursive types use the exact generic transport walker below.
    """
    if annotation in (str, bool, int, float, type(None), FrozenMap):
        return True
    origin = get_origin(annotation)
    args = get_args(annotation)
    if origin is Annotated:
        return _direct_runtime_json_type(args[0], seen)
    if origin in (tuple, list, Union, UnionType):
        return bool(args) and all(arg is Ellipsis or _direct_runtime_json_type(arg, seen) for arg in args)
    if isinstance(annotation, type):
        if issubclass(annotation, Enum):
            return bool(annotation.__members__) and all(
                type(item.value) in (str, bool, int, float, type(None)) for item in annotation)
        if issubclass(annotation, FrozenModel):
            # A validated base-typed field can contain a subclass with a
            # different canonical archive shape. Inspect its actual class in
            # the transport walker; never certify it from the annotation alone.
            return False
    return False


@lru_cache(maxsize=512)
def _runtime_json_fields(model_type):
    return tuple((name, _direct_runtime_json_type(model_type.model_fields[name].annotation,
                                                 frozenset({model_type})))
                 for name in _canonical_model_field_names(model_type))


def _runtime_json_data(value):
    """Encode exact transport fields without constructing runtime-view mirrors."""
    kind = type(value)
    if value is None or kind in (str, bool, int):
        return value
    if kind is float:
        return freeze_json(value)
    if kind is tuple or kind is list:
        # Exact sequences cannot be nominal models, enums or maps. Preserve
        # traversal and validation while avoiding those unrelated checks.
        return tuple(item if item is None or type(item) in (str, bool, int)
                     else _runtime_json_data(item) for item in value)
    if isinstance(value, FrozenMap):
        return value
    if isinstance(value, Enum):
        return _runtime_json_data(value.value)
    if isinstance(value, FrozenModel):
        plan = _runtime_json_fields(type(value))
        if (type(value).canonical_field_names is FrozenModel.canonical_field_names
                and all(direct for _, direct in plan)):
            # Pydantic's Any serializer cannot activate a deferred MockValSer
            # on a nominal child. Build only when this JSON export needs it.
            return ensure_nominal_json_serializer(value)
        return {name: getattr(value, name) if direct else _runtime_json_data(getattr(value, name))
                for name, direct in plan}
    if isinstance(value, (tuple, list)):
        # Keep subclasses on the general classification path.
        return tuple(item if item is None or type(item) in (str, bool, int)
                     else _runtime_json_data(item) for item in value)
    if isinstance(value, BaseModel):
        return _runtime_json_data(value.model_dump(mode="json"))
    if isinstance(value, Mapping):
        return {str(key): _runtime_json_data(item) for key, item in sorted(value.items())}
    return freeze_json(value)


class _RuntimeModelFields(dict[str, object]):
    """C-level hits; only a missing declared field enters the lazy projector."""

    __slots__ = ("model", "names", "field_index")

    def __init__(self, model: FrozenModel) -> None:
        super().__init__()
        self.model = model
        self.names = _canonical_model_field_names(type(model))
        self.field_index = _model_field_index(type(model))

    @property
    def projected_count(self):
        return dict.__len__(self)

    def __iter__(self):
        return iter(self.names)

    def __len__(self):
        return len(self.names)

    def __contains__(self, name):
        return name in self.field_index

    # Preserve the complete Mapping shape even when an overlay/guard aliases
    # this private storage. Only subscript hits use the native dict path.
    keys = Mapping.keys
    items = Mapping.items
    values = Mapping.values
    get = Mapping.get

    def __missing__(self, name: str) -> object:
        if name not in self.field_index:
            raise KeyError(name)
        value = runtime_value(getattr(self.model, name))
        self[name] = value
        return value


class RuntimeModelMap(FrozenMap):
    """Lazy immutable JSON view owning its already-validated local model.

    The model only weakly remembers this view. Reading or serializing a model
    never installs a strong owner/view cycle or a mirrored history tree.
    """

    __slots__ = ("_item_cache",)

    def __iter__(self):
        return iter(self._data.names)

    def __len__(self):
        return len(self._data.names)

    @property
    def source_model(self):
        return self._data.model

    @property
    def _digest(self):
        # Preserve the useful cached SHA when an unconsumed view disappears,
        # without retaining its projected fields or any model/view cycle.
        return self.source_model.__dict__.get("_runtime_transport_digest")

    @_digest.setter
    def _digest(self, value):
        if value is not None:
            self.source_model.__dict__["_runtime_transport_digest"] = value

    @property
    def _items(self):
        cached = self._item_cache
        if cached is None:
            cached = tuple((name, self._data[name]) for name in self._data.names)
            self._item_cache = cached
        return cached

    def _canonical_json_items(self):
        storage = _runtime_json_data(self.source_model)
        # Direct nominal JSON records go through the existing encoder below.
        # They are not mappings and must not be forced into a retained view.
        return tuple(sorted(storage.items())) if isinstance(storage, Mapping) else ()

    def _canonical_json_storage(self):
        # Hash/export the full, unchanged transport shape, without retaining
        # fields which no Source consumer actually requested. Nested views
        # created for this encoder invocation die with its temporary dicts.
        return _runtime_json_data(self.source_model)

    def __repr__(self):
        # Explicit representation retains the historical data shape. The
        # operational view itself must never leak a process-local address.
        return f"FrozenMap({self.to_shallow_dict()!r})"

    @classmethod
    def from_model(
        cls,
        *,
        source_model: FrozenModel,
    ) -> "RuntimeModelMap":
        frozen = object.__new__(cls)
        frozen._data = _RuntimeModelFields(source_model)
        frozen._item_cache = None
        frozen._hash = None
        return frozen


def restore_runtime_model_refs(value: FrozenMap) -> FrozenMap:
    """Restore direct typed children without walking their immutable payloads."""

    # Keep an already immutable argument map when no nominal child changes.
    # Lazy/virtual maps and overriding subclasses retain Mapping semantics.
    items = (value._data.items()
             if type(value) is FrozenMap and type(value._data) is dict
             else value.items())
    restored: dict[str, object] | None = None
    for name, item in items:
        item_type = type(item)
        if (item is None or item_type is int or item_type is str
                or item_type is bool or item_type is float or item_type is FrozenMap):
            continue
        if isinstance(item, RuntimeModelMap):
            replacement = item.source_model
        elif isinstance(item, tuple):
            members: list[object] | None = None
            for index, member in enumerate(item):
                member_type = type(member)
                if (member is None or member_type is int or member_type is str
                        or member_type is bool or member_type is float
                        or member_type is FrozenMap):
                    continue
                if isinstance(member, RuntimeModelMap):
                    if members is None:
                        members = list(item)
                    members[index] = member.source_model
            if members is None:
                continue
            replacement = tuple(members)
        else:
            continue
        if restored is None:
            restored = value.to_shallow_dict()
        restored[name] = replacement
    if restored is None:
        return value if type(value) is FrozenMap else FrozenMap.from_frozen_items(value)
    if type(value) is FrozenMap and type(value._data) is dict:
        # Only existing values changed; retain the canonical key order of the
        # shallow copy without sorting/copying this argument index a second time.
        frozen = object.__new__(FrozenMap)
        frozen._data = restored
        frozen._entries = None
        frozen._hash = None
        frozen._digest = None
        return frozen
    return FrozenMap.from_frozen_items(restored)


def runtime_value(value: object) -> Any:
    """Convert typed immutable results into recursively immutable JSON data."""

    # Raster and delta payloads are overwhelmingly primitive leaves and tuples.
    # Check those concrete built-in types before Pydantic/ABC-backed classes;
    # the former ordering performed millions of costly negative isinstance
    # checks while recursively transporting an otherwise unchanged frame.
    value_type = type(value)
    if value is None or value_type in {str, bool, int}:
        return value
    if value_type is float:
        return freeze_json(value)
    if value_type is tuple:
        return _runtime_tuple(value)
    if value_type is list:
        return tuple(runtime_value(item) for item in value)
    # FrozenMap is the dominant already-validated binding value.  The exact
    # type check avoids an ABC instance check on every expression leaf while
    # preserving the subclass path below for RuntimeModelMap and extensions.
    if value_type is FrozenMap:
        return value
    if isinstance(value, FrozenMap):
        return value
    if isinstance(value, tuple):
        return _runtime_tuple(tuple(value))
    if isinstance(value, list):
        return tuple(runtime_value(item) for item in value)
    if isinstance(value, Enum):
        return runtime_value(value.value)
    if isinstance(value, FrozenModel):
        identity = id(value)
        owned = value.__dict__.get("_runtime_projection_memo")
        projected = owned() if isinstance(owned, weakref.ReferenceType) else None
        if projected is not None and projected.source_model is value:
            return projected
        cached = _RUNTIME_MODEL_MAP_CACHE.get(identity)
        projected = cached() if cached is not None else None
        if projected is not None and projected.source_model is value:
            return projected
        converted = RuntimeModelMap.from_model(source_model=value)
        if len(_RUNTIME_MODEL_MAP_CACHE) >= _RUNTIME_MODEL_MAP_CACHE_LIMIT:
            _RUNTIME_MODEL_MAP_CACHE.pop(next(iter(_RUNTIME_MODEL_MAP_CACHE)))
        # The projected binding owns its validated model while in use. The
        # memo must not itself keep either an abandoned projection or model
        # alive; checkpoints and other actual consumers own their lifetimes.
        def discard(reference, key=identity):
            current = _RUNTIME_MODEL_MAP_CACHE.get(key)
            if current is reference:
                _RUNTIME_MODEL_MAP_CACHE.pop(key, None)

        reference = weakref.ref(converted, discard)
        value.__dict__["_runtime_projection_memo"] = reference
        _RUNTIME_MODEL_MAP_CACHE[identity] = reference
        return converted
    if isinstance(value, BaseModel):
        value = value.model_dump(mode="json")
    if isinstance(value, Mapping):
        return FrozenMap.from_frozen_items(
            {str(key): runtime_value(item) for key, item in sorted(value.items())}
        )
    return freeze_json(value)


def validate_runtime_type(value: object, type_spec: TypeSpec, description: str) -> None:
    if value is None:
        if type_spec.optional:
            return
        raise RuntimeTypeError(
            location=description, expected_type=type_spec.display(), observed_type="null",
        )
    # Optionality has already been handled for None. Copying TypeSpec merely
    # to clear that flag rebuilt immutable Pydantic metadata on every check.
    name = type_spec.name
    valid = True
    if name == "Any":
        return
    if name == "Boolean":
        valid = isinstance(value, bool)
    elif name == "Integer":
        valid = isinstance(value, int) and not isinstance(value, bool)
    elif name in {"String", "Ref"}:
        valid = isinstance(value, str)
    elif name in {"List", "Set"}:
        valid = isinstance(value, (list, tuple))
        sequence = value if isinstance(value, (list, tuple)) else ()
        if valid and name == "Set":
            identities = tuple(canonical_json(item) for item in sequence)
            valid = len(identities) == len(set(identities))
        if valid and type_spec.arguments:
            element_type = type_spec.arguments[0]
            primitive = {"Integer": int, "Boolean": bool, "String": str, "Ref": str}.get(element_type.name)
            if primitive is not None and all(type(item) is primitive or
                    (item is None and element_type.optional) for item in sequence):
                return
            for index, item in enumerate(sequence):
                validate_runtime_type(
                    item,
                    element_type,
                    f"{description}[{index}]",
                )
    elif name == "Map":
        valid = isinstance(value, Mapping)
    else:
        # Domain values are source-typed opaque references or serialized records.
        valid = isinstance(value, (str, Mapping, FrozenMap))
    if not valid:
        raise RuntimeTypeError(
            location=description, expected_type=type_spec.display(),
            observed_type=type(value).__name__,
        )


def evaluate_expression(
    expression: IrExpression,
    bindings: Mapping[str, object],
    *,
    call: Callable[[str, tuple[object, ...], FrozenMap], object] | None = None,
) -> Any:
    kind = expression.kind
    if kind is ExpressionKind.REFERENCE:
        reference = str(expression.value)
        if reference in bindings:
            return bindings[reference]
        root, separator, remainder = reference.partition(".")
        if separator and root in bindings:
            current = bindings[root]
            for member in remainder.split("."):
                if isinstance(current, Mapping) and member in current:
                    current = current[member]
                else:
                    raise ExpressionEvaluationError(
                        f"runtime reference {reference} has no member {member}"
                    )
            return current
        return reference
    if kind in {
        ExpressionKind.STRING,
        ExpressionKind.INTEGER,
        ExpressionKind.BOOLEAN,
    }:
        return runtime_value(expression.value)
    if kind is ExpressionKind.NULL:
        return None
    if kind is ExpressionKind.EMPTY_SET:
        return ()
    if kind is ExpressionKind.LIST:
        return tuple(
            evaluate_expression(item, bindings, call=call) for item in expression.items
        )
    if kind is ExpressionKind.CALL:
        if call is None:
            raise ExpressionEvaluationError(
                f"no pure function registry for expression call {expression.value}"
            )
        positional: list[object] = []
        named: dict[str, object] = {}
        for argument in expression.arguments:
            value = evaluate_expression(argument.value, bindings, call=call)
            if argument.name is None:
                positional.append(value)
            else:
                named[argument.name] = value
        return runtime_value(
            call(str(expression.value), tuple(positional), FrozenMap(named))
        )
    raise ExpressionEvaluationError(f"unsupported expression kind: {kind.value}")
