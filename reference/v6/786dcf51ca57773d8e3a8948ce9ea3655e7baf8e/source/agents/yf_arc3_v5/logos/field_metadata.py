"""Bounded sharing of immutable schema-name metadata, never model values."""
from collections import deque
from functools import lru_cache
import sys
from threading import RLock


class _SharedFieldNames(set):
    """A real PySet for Pydantic's serializer, immutable through its methods."""

    __slots__ = ("_declaring_model_type",)

    def __init__(self, model_type, names):
        from agents.yf_arc3_v5.logos.types import FrozenModel
        if hasattr(self, "_declaring_model_type"):
            raise TypeError("Shared field-name metadata cannot be reinitialized")
        if (not isinstance(model_type, type) or not issubclass(model_type, FrozenModel)
                or type(names) not in (tuple, set, frozenset) or len(names) > 512):
            raise TypeError("Shared field names require a bounded declared model schema")
        if any(type(name) is not str for name in names):
            raise TypeError("Only declared schema field names may be shared")
        if any(name not in model_type.model_fields for name in sorted(names)):
            raise TypeError("Only declared schema field names may be shared")
        set.__init__(self, names)
        object.__setattr__(self, "_declaring_model_type", model_type)

    def __setattr__(self, name, value):
        raise TypeError("Shared field-name metadata is immutable")

    def _refuse(self, *args, **kwargs):
        raise TypeError("Shared field-name metadata is immutable")

    add = clear = discard = pop = remove = update = _refuse
    difference_update = intersection_update = symmetric_difference_update = _refuse
    __ior__ = __iand__ = __ixor__ = __isub__ = _refuse

    def __copy__(self):
        # BaseModel.model_copy updates the copied set before our final sharing.
        return set(self)

    def __deepcopy__(self, memo):
        return set(self)

    def __reduce_ex__(self, protocol):
        return type(self), (self._declaring_model_type, tuple(sorted(self)))


_POOL = {}
_POOL_KEYS = deque()
_POOL_LOCK = RLock()
_POOL_BYTES = 0
_POOL_BYTE_LIMIT = 2 * 1024 * 1024
_POOL_ENTRY_LIMIT = 1024


@lru_cache(maxsize=512)
def _declared_names(model_type):
    return frozenset(sorted(model_type.model_fields))


def share_model_field_metadata(model):
    """Share only declared names after normal construction/copy has finished."""
    global _POOL_BYTES
    current = model.__pydantic_fields_set__
    if type(current) is _SharedFieldNames:
        return
    # Preserve unsupported/foreign construct metadata on its original path.
    if type(current) is not set or len(current) > 512:
        return
    key = frozenset(current)
    if not key.issubset(_declared_names(type(model))):
        return
    with _POOL_LOCK:
        shared = _POOL.get(key)
        if shared is None:
            shared = _SharedFieldNames(type(model), key)
            size = sys.getsizeof(key) + sys.getsizeof(shared)
            if size > _POOL_BYTE_LIMIT:
                return
            while _POOL and (len(_POOL) >= _POOL_ENTRY_LIMIT
                            or _POOL_BYTES + size > _POOL_BYTE_LIMIT):
                old_key = _POOL_KEYS.popleft()
                old_value = _POOL.pop(old_key)
                _POOL_BYTES -= sys.getsizeof(old_key) + sys.getsizeof(old_value)
            _POOL[key] = shared
            _POOL_KEYS.append(key)
            _POOL_BYTES += size
        object.__setattr__(model, "__pydantic_fields_set__", shared)


def field_metadata_pool_summary():
    with _POOL_LOCK:
        return dict(entries=len(_POOL), shallow_key_and_set_bytes=_POOL_BYTES,
                    entry_limit=_POOL_ENTRY_LIMIT, byte_limit=_POOL_BYTE_LIMIT,
                    schema_index_entries=_declared_names.cache_info().currsize,
                    contains_model_values=False)
