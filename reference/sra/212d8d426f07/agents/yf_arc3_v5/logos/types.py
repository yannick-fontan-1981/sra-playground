"""Shared immutable value types for the V5 cognitive core."""

from __future__ import annotations

import hashlib
import json
import math
import weakref
from json.encoder import encode_basestring_ascii
from collections.abc import ItemsView, Iterator, Mapping
from dataclasses import fields as dataclass_fields, is_dataclass
from enum import Enum
from functools import lru_cache
from threading import RLock
from typing import Annotated, Any, TypeAlias

from pydantic import BaseModel, ConfigDict, Field, StringConstraints
from pydantic_core import core_schema

from agents.yf_arc3_v5.logos.field_metadata import (
    _SharedFieldNames,
)

Ref: TypeAlias = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]
NonNegativeRevision: TypeAlias = Annotated[int, Field(strict=True, ge=0)]
PositiveSequence: TypeAlias = Annotated[int, Field(strict=True, ge=1)]


class TermKind(str, Enum):
    ENTITY = "entity"
    EVENT = "event"
    SCHEMA = "schema"
    PROCEDURE = "procedure"
    GOAL = "goal"
    VALUE = "value"


class RelationFamily(str, Enum):
    STRUCTURAL = "structural"
    DYNAMIC = "dynamic"
    EPISTEMIC = "epistemic"
    CONTROL = "control"


class RelationDimension(str, Enum):
    """Closed generic dimensions whose links must remain independently revisable."""

    IDENTITY_COMPOSITION = "identity_composition"
    MATERIAL_TOPOLOGY = "material_topology"
    AGENCY_CONTROL = "agency_control"
    CORRESPONDENCE_LOCATION = "correspondence_location"
    SUPPORT_OCCUPANCY = "support_occupancy"
    TRANSFORMATION_INVARIANT = "transformation_invariant"
    TEMPORAL_TIMELINE = "temporal_timeline"
    RESOURCE_RECOVERY = "resource_recovery"


class RoleKind(str, Enum):
    """Generic revisable roles; morphology alone never establishes one."""

    SURFACE = "surface"
    SEPARATOR = "separator"
    COMPACT_BODY = "compact_body"
    REPEATED_STRUCTURE = "repeated_structure"
    AXIS_LIKE_BAND = "axis_like_band"
    ENCLOSURE = "enclosure"
    BORDER_DISPLAY = "border_display"
    INTERFACE_CANDIDATE = "interface_candidate"
    CONTROLLED_SOURCE = "controlled_source"
    DEPENDENT_BODY = "dependent_body"
    FIXED_REFERENCE = "fixed_reference"
    TARGET_CANDIDATE = "target_candidate"
    SELECTION_CARRIER = "selection_carrier"
    ACTUATOR = "actuator"
    RESOURCE_INDICATOR = "resource_indicator"
    SUPPORT_SURFACE = "support_surface"
    TEMPORAL_INSTANCE = "temporal_instance"
    WORLD_VIEWPORT_ANCHOR = "world_viewport_anchor"


class GoalKind(str, Enum):
    """Extensible generic goal vocabulary licensed by current claims."""

    ALIGN_POSITION_ROW = "align.position.row"
    ALIGN_POSITION_COLUMN = "align.position.column"
    ALIGN_POSITION_BOTH = "align.position.both"
    ALIGN_CONTACT_EDGE = "align.contact.edge"
    ALIGN_CONTACT_OVERLAP = "align.contact.overlap"
    ALIGN_CONTAINMENT = "align.containment"
    ALIGN_OFFSET_CONSTANT = "align.offset.constant"
    ALIGN_SEPARATION = "align.separation"
    MATCH_SHAPE_EXACT = "match.shape_exact"
    MATCH_SHAPE_TOPOLOGY = "match.shape_topology"
    MATCH_COLOR_AND_SHAPE = "match.color_and_shape"
    MATCH_ORIENTATION = "match.orientation"
    MATCH_SCALE = "match.scale"
    MATCH_NORMALIZED_PATTERN = "match.pattern.normalized"
    MATCH_MARKER_OR_SUBCOMPONENT = "match.marker_or_subcomponent"
    MATCH_BY_EFFECT = "match.by_effect"
    MOVE_DEPENDENT_ONTO_TARGET = "goal.move_dependent_onto_target"
    MOVE_SOURCE_TO_MARKER = "goal.move_source_to_marker"
    QUANTITY_CAPACITY_TRANSFER = "goal.quantity_capacity_transfer"
    DISCRETE_STATE_OR_PERMUTATION_OFFSET = (
        "goal.discrete_state_or_permutation_offset"
    )
    CONNECTIVITY_TRAVERSABILITY_SUPPORT = (
        "goal.connectivity_traversability_support"
    )
    REACH_NEW_INFORMATIVE_ELEMENT = "goal.reach_new_informative_element"
    REACH_SCROLL_TERMINAL_FRONTIER = "goal.reach_scroll_terminal_frontier"
    OPEN_REQUIRED_PASSAGE = "goal.open_required_passage"
    MOVE_TOWARD_OPENED_PASSAGE = "goal.move_toward_opened_passage"
    PREREQUISITE_MECHANISM = "goal.prerequisite_mechanism"
    TEMPORAL_OCCUPANCY_OR_CONCURRENCY = "goal.temporal_occupancy_or_concurrency"
    SAFE_WORLD_REVELATION = "goal.safe_world_revelation"
    LEARNED_TERMINAL_CARDINALITY = "goal.learned_terminal_cardinality"
    CONJUNCTION = "goal.conjunction"
    SUBGOAL_ASSIGNMENT = "goal.subgoal_assignment"


class GoalNodeKind(str, Enum):
    """Generic node families for the declarative exploration graph."""

    OFFICIAL_COMPLETION = "official_completion"
    SAFETY_INVARIANT = "safety_invariant"
    WORLD_ACHIEVEMENT = "world_achievement"
    REQUIRED_PREREQUISITE = "required_prerequisite"
    ACCESS = "access"
    MECHANISM_DISCRIMINATION = "mechanism_discrimination"
    EFFECT_CALIBRATION = "effect_calibration"
    CONFIGURATION_DISCOVERY = "configuration_discovery"
    RECOVERY = "recovery"


class GoalEdgeKind(str, Enum):
    """Declared dependency/revision relations between goal nodes."""

    REQUIRES = "requires"
    ENABLES = "enables"
    REFINES = "refines"
    ALTERNATIVE_TO = "alternative_to"
    CONFLICTS_WITH = "conflicts_with"
    PROTECTS = "protects"
    RESTORES = "restores"
    FALSIFIES = "falsifies"
    ACHIEVED_BY = "achieved_by"


class ObligationKind(str, Enum):
    """Canonical generic meanings carried by the priority dependency graph."""

    TERMINAL = "terminal"
    ENABLING = "enabling"
    PRESERVATION = "preservation"
    INFORMATION = "information"
    REPAIR = "repair"


class ObligationStatus(str, Enum):
    """Lifecycle declared by DRM for one current obligation."""

    PROPOSED = "proposed"
    BLOCKED = "blocked"
    READY = "ready"
    PURSUING = "pursuing"
    AWAITING_EVIDENCE = "awaiting_evidence"
    SATISFIED = "satisfied"
    FALSIFIED = "falsified"
    INVALIDATED = "invalidated"


class ObligationEdgeKind(str, Enum):
    """Typed semantic relations between canonical obligations."""

    REQUIRES = "requires"
    PROVIDES = "provides"
    PRESERVES = "preserves"
    BLOCKS = "blocks"
    CONFLICTS_WITH = "conflicts_with"
    FALSIFIES = "falsifies"
    BENEFITS = "benefits"


class PrioritySafetyGate(str, Enum):
    """Small global safety machine preceding local objective selection."""

    CAUSAL_DEBT = "causal_debt"
    PROTECTION = "protection"
    COMMITMENT = "commitment"
    OBJECTIVE_FRONTIER = "objective_frontier"
    INFORMATION = "information"
    ABSTENTION = "abstention"


class PriorityShadowDisposition(str, Enum):
    """Declared explanation of a shadow comparison with legacy dispatch."""

    EXACT_MATCH = "exact_match"
    LEGACY_OBLIGATION_BLOCKED = "legacy_obligation_blocked"
    DECLARED_ALTERNATIVE = "declared_alternative"


class StaticKnowledgeNodeKind(str, Enum):
    """Generic, scene-independent knowledge-tree node families."""

    PRINCIPLE = "principle"
    QUESTION = "question"
    ACTIVATION_CONDITION = "activation_condition"
    EXPECTED_EFFECT = "expected_effect"
    FALSIFIER = "falsifier"
    DEPENDENCY = "dependency"
    PRIORITY = "priority"


class StaticKnowledgeEdgeKind(str, Enum):
    """Relations inside the reusable knowledge tree."""

    REFINES = "refines"
    REQUIRES = "requires"
    ACTIVATES = "activates"
    PREDICTS = "predicts"
    FALSIFIES = "falsifies"


class EffectSignatureNovelty(str, Enum):
    NONE = "none"
    KNOWN = "known"
    NOVEL = "novel"


class ObservableChangeScope(str, Enum):
    NONE = "none"
    RESOURCE_ONLY = "resource_only"
    KNOWN_CYCLIC_POSE_ONLY = "known_cyclic_pose_only"
    WORLD_SPATIAL_CONFIGURATION = "world_spatial_configuration"
    WORLD_NONSPATIAL_STATE = "world_nonspatial_state"
    GOAL_RELATION = "goal_relation"
    SCORE_OR_LEVEL_BOUNDARY = "score_or_level_boundary"
    MIXED = "mixed"


class DeclaredCausalClass(str, Enum):
    OBSERVABLE_KNOWN = "observable_known"
    EFFECTFUL_KNOWN = "effectful_known"
    EFFECTFUL_NOVEL = "effectful_novel"
    EXPERIMENTAL_UNKNOWN = "experimental_unknown"
    CONTEXTUAL_NO_EFFECT = "contextual_no_effect"


class GoalLifecycleStatus(str, Enum):
    PROPOSED = "proposed"
    ENABLED = "enabled"
    BLOCKED_BY_PREREQUISITE = "blocked_by_prerequisite"
    DISABLED_WITH_REASON = "disabled_with_reason"
    ACCESSIBLE = "accessible"
    PURSUING = "pursuing"
    LOCALLY_SATISFIED = "locally_satisfied"
    AXIS_SATISFIED = "axis_satisfied"
    AXIS_EXHAUSTED_MISSING_SUBGOAL = "axis_exhausted_missing_subgoal"
    FAILED_PARTIAL = "failed_partial"
    FALSIFIED = "falsified"
    ABANDONED_EXACT_VARIANT = "abandoned_exact_variant"
    REOPENED_AFTER_CONTEXT_CHANGE = "reopened_after_context_change"
    LEVEL_ACHIEVED = "level_achieved"


class PeriodicCycleWorkflowStatus(str, Enum):
    """Lifecycle of one observed periodic/cyclic mechanism workflow."""

    SUPPOSED = "supposed"
    IN_PROGRESS = "in_progress"
    CYCLE_UNDERSTOOD = "cycle_understood"


class MechanismGateStatus(str, Enum):
    COMMIT_REVISABLE_MECHANISM = "commit_revisable_mechanism"
    SELECT_DISCRIMINATING_EXPERIMENT = "select_discriminating_experiment"
    EXTEND_SCOPED_ONTOLOGY = "extend_scoped_ontology"
    FAIL_CLOSED_NAMED_GAP = "fail_closed_named_gap"


class DerivedGeometryStateStatus(str, Enum):
    AFFINE_RELATION_FALSIFIED = "affine_relation_falsified"
    AFFINE_AND_CLOSED_ORBIT_SUPPORTED = "affine_and_closed_orbit_supported"
    AFFINE_RELATION_SUPPORTED = "affine_relation_supported"
    CLOSED_ORBIT_SUPPORTED = "closed_orbit_supported"
    TRANSITION_ORDER_ONLY = "transition_order_only"
    INSUFFICIENT_EVIDENCE = "insufficient_evidence"


class ViewportSupportTerrainStatus(str, Enum):
    INCOHERENT_VIEWPORT_OBSERVATIONS = "incoherent_viewport_observations"
    LAYERED_SUPPORT_SUSPENSION = "layered_support_suspension"
    DYNAMIC_TERRAIN_WITH_SUPPORT_CHANGE = "dynamic_terrain_with_support_change"
    DYNAMIC_TRAVERSABILITY = "dynamic_traversability"
    SUPPORT_CHANGE_ONLY = "support_change_only"
    COHERENT_VIEWPORT_RELATION = "coherent_viewport_relation"
    STATIC_CONFIGURATION = "static_configuration"
    INSUFFICIENT_EVIDENCE = "insufficient_evidence"


class InteractionTopologyStatus(str, Enum):
    CONNECTIVITY_CHANGE_WITH_VALID_LANDING = "connectivity_change_with_valid_landing"
    CONNECTIVITY_CHANGE = "connectivity_change"
    ADJACENCY_CHANGE_ONLY = "adjacency_change_only"
    VALID_LANDING_ONLY = "valid_landing_only"
    UNCHANGED_TOPOLOGY = "unchanged_topology"
    INSUFFICIENT_EVIDENCE = "insufficient_evidence"


class EliminationViabilityStatus(str, Enum):
    DECLARED_TERMINAL_REACHED = "declared_terminal_reached"
    VIABLE_TO_DECLARED_TERMINAL = "viable_to_declared_terminal"
    EXACT_DEAD_END = "exact_dead_end"
    SEARCH_INCOMPLETE_BOUND = "search_incomplete_bound"


class TemporalConcurrencyStatus(str, Enum):
    ACTION_CONDITIONED_OCCUPANCY_CONFLICT = "action_conditioned_occupancy_conflict"
    ACTION_CONDITIONED_COEVOLUTION = "action_conditioned_coevolution"
    ACTION_CONDITIONED_DUPLICATION = "action_conditioned_duplication"
    ACTION_CONDITIONED_STATE_RETURN = "action_conditioned_state_return"
    ORDERED_TIMELINE_ONLY = "ordered_timeline_only"
    INSUFFICIENT_EVIDENCE = "insufficient_evidence"


class GoalGapDimension(str, Enum):
    """Exact dimensions Python may measure only after DRM declares them."""

    ROW = "row"
    COLUMN = "column"
    POSITION = "position"
    OFFSET = "offset"
    DISTANCE = "distance"
    CONTACT = "contact"
    SEPARATION = "separation"
    OVERLAP = "overlap"
    CONTAINMENT = "containment"
    SHAPE = "shape"
    TOPOLOGY = "topology"
    COLOR = "color"
    SCALE = "scale"
    ROTATION = "rotation"
    NORMALIZED_PATTERN = "normalized_pattern"
    MARKER_CORRESPONDENCE = "marker_correspondence"
    QUANTITY = "quantity"
    CAPACITY = "capacity"
    CONSERVED_TRANSFER = "conserved_transfer"
    DISCRETE_STATE = "discrete_state"
    PERMUTATION_OFFSET = "permutation_offset"
    CONNECTIVITY = "connectivity"
    TRAVERSABILITY = "traversability"
    SUPPORT = "support"
    MECHANISM_STATE = "mechanism_state"
    TEMPORAL_OCCUPANCY = "temporal_occupancy"
    CONCURRENCY = "concurrency"
    WORLD_REVELATION = "world_revelation"
    CARDINALITY = "cardinality"
    CONJUNCTION_ASSIGNMENT = "conjunction_assignment"


class Polarity(str, Enum):
    POSITIVE = "positive"
    NEGATIVE = "negative"


class EpistemicStatus(str, Enum):
    PROPOSED = "proposed"
    SUPPORTED = "supported"
    ESTABLISHED = "established"
    DEFEATED = "defeated"


class Disposition(str, Enum):
    ACTIVE = "active"
    DEFERRED = "deferred"
    REJECTED = "rejected"


class Cardinality(str, Enum):
    SINGULAR = "singular"
    SPECIAL = "special"


class OperatorName(str, Enum):
    OBSERVE = "OBSERVE"
    ACT = "ACT"
    DISTINGUISH = "DISTINGUISH"
    RELATE = "RELATE"
    PROPOSE = "PROPOSE"
    DERIVE = "DERIVE"
    COMPARE = "COMPARE"
    UPDATE = "UPDATE"
    SELECT = "SELECT"


class EffectClass(str, Enum):
    PURE = "pure"
    OBSERVATION_ADAPTER = "observation_adapter"
    COGNITIVE_UPDATE_ADAPTER = "cognitive_update_adapter"
    ENVIRONMENT_ADAPTER = "environment_adapter"


def _canonical_mapping_keys(keys: frozenset[Any]) -> tuple[Any, ...]:
    """Reuse small schema shapes without retaining growing state-key histories."""

    if len(keys) > 128 or any(type(key) is not str or len(key) > 128 for key in keys):
        return tuple(sorted(keys))
    return _small_canonical_mapping_keys(keys)


@lru_cache(maxsize=256)
def _small_canonical_mapping_keys(keys: frozenset[Any]) -> tuple[Any, ...]:

    return tuple(sorted(keys))


@lru_cache(maxsize=1024)
def _frozen_mapping_keys(keys: frozenset[Any]) -> tuple[str, ...]:
    """Validate each immutable key shape once, without caching its values."""

    ordered = _canonical_mapping_keys(keys)
    if any(not isinstance(key, str) or not key.strip() for key in ordered):
        raise TypeError("FrozenMap keys must be non-empty strings")
    return ordered


_IMMUTABLE_JSON_DIGEST_CONTEXT = object()


@lru_cache(maxsize=256)
def _canonical_field_plan(names):
    """Bounded schema names/index only; never instance values or decisions."""
    return tuple(sorted(names)), {name: index for index, name in enumerate(names)}


class _CanonicalFieldData(Mapping[str, Any]):
    """Captured immutable field values with one shared schema index."""

    __slots__ = ("names", "field_values", "plan")

    def __init__(self, names, values):
        self.names = names
        self.field_values = values
        self.plan = _canonical_field_plan(names)

    def __len__(self):
        return len(self.names)

    def __iter__(self):
        return iter(self.plan[0])

    def __getitem__(self, name):
        return self.field_values[self.plan[1][name]]

    def canonical_storage(self):
        # JSON sorts these fields itself; no permanent dictionary is retained.
        return dict(zip(self.names, self.field_values))

    def __reduce_ex__(self, protocol):
        # Portable JSON mapping, without a new prepared-loader global/type.
        return FrozenMap, (self.canonical_storage(),)


class FrozenMap(Mapping[str, Any]):
    """A recursively immutable JSON-like mapping with deterministic ordering."""

    __slots__ = ("_data", "_entries", "_hash", "_digest", "__weakref__")

    def __init__(self, value: Mapping[str, Any] | None = None) -> None:
        if isinstance(value, FrozenMap):
            self._data = value._data
            # Aliasing an immutable mapping must not request all fields from
            # a lazy nominal view or materialize an overlay's complete index.
            self._entries = getattr(value, "_entries", None)
            self._hash = getattr(value, "_hash", None)
            self._digest = getattr(value, "_digest", None)
            return
        raw = {} if value is None else value
        if not isinstance(raw, Mapping):
            raise TypeError("FrozenMap requires a mapping")
        data: dict[str, Any] = {}
        for key in _frozen_mapping_keys(frozenset(raw)):
            data[key] = freeze_json(raw[key])
        self._data = data
        self._entries = None
        self._hash: int | None = None
        self._digest: str | None = None

    def __getitem__(self, key: str) -> Any:
        return self._data[key]

    def __iter__(self) -> Iterator[str]:
        return iter(self._data)

    def __len__(self) -> int:
        return len(self._data)

    def items(self):
        # Public aliases of an overlay must use the same full-traversal path.
        # An overriding subclass keeps Mapping's original lookup semantics.
        if (type(self) in (FrozenMap, _FrozenOverlayMap)
                and type(self._data) is _FrozenOverlayData):
            return _FrozenOverlayItemsView(self)
        return super().items()

    @property
    def _items(self):
        cached = self._entries
        if cached is None:
            cached = tuple(sorted(self._data.items()))
            self._entries = cached
        return cached

    @_items.setter
    def _items(self, value):
        # Accept the former private slot when reading qualified old pickles.
        self._entries = value

    def canonical_items(self) -> tuple[tuple[str, Any], ...]:
        """Return the immutable, already key-sorted entries without re-sorting."""

        # Most overlays are intermediate fact indexes. Materialize the second
        # tuple index only for a reader that actually needs ordered entries.
        items = self._items
        if items is None:
            items = tuple(self._data.items())
            self._items = items
        return items

    def _canonical_json_items(self):
        # Canonical storage is already ordered; do not retain a second index
        # merely because an explicit encoder visited this immutable mapping.
        return self._data.items()

    def _canonical_json_storage(self) -> Any:
        """Expose this immutable map at an actual serialization boundary."""

        # CPython's JSON/dict fast paths bypass virtual fields of dict
        # subclasses. Only an actual serialization may expand such an alias.
        if type(self._data) is _CanonicalFieldData:
            return self._data.canonical_storage()
        return (self._data if type(self._data) is dict
                else {key: value for key, value in sorted(self._data.items())})

    def __eq__(self, other: object) -> bool:
        # Mapping.__eq__ copies both items views into temporary dictionaries.
        # Exact FrozenMap instances already own those immutable indexes. Keep
        # the Mapping protocol for foreign mappings and overriding subclasses.
        if (type(self) is FrozenMap and type(other) is FrozenMap
                and type(self._data) is dict and type(other._data) is dict):
            return self._data == other._data
        return super().__eq__(other)

    def __hash__(self) -> int:
        # Hash the already frozen structure only when it is used as a key.
        # Canonical JSON remains reserved for a real serialization boundary.
        # Python's salted string hash is not used, so cache layout is stable
        # across processes. Equal numeric values (True/1/1.0) share a hash.
        cached = getattr(self, "_hash", None)
        if cached is None:
            digest = hashlib.sha256()
            _update_frozen_hash(digest, self, root=True)
            raw = digest.digest()
            value = int.from_bytes(raw[:8], byteorder="big", signed=True)
            cached = -2 if value == -1 else value
            self._hash = cached
        return cached


    def __repr__(self) -> str:
        if type(self._data) is _CanonicalFieldData:
            return f"FrozenMap({self.to_shallow_dict()!r})"
        return f"FrozenMap({self._data!r})"

    def to_dict(self) -> dict[str, Any]:
        return {key: thaw_json(value) for key, value in sorted(self._data.items())}

    def to_shallow_dict(self) -> dict[str, Any]:
        """Copy only the mapping index while preserving immutable child values."""

        return (self._data.copy() if type(self._data) is dict
                else {key: value for key, value in sorted(self._data.items())})

    @classmethod
    def from_frozen_items(cls, value: Mapping[str, Any]) -> "FrozenMap":
        """Index values already recursively frozen by a trusted local walker."""

        data: dict[str, Any] = {}
        for key in _frozen_mapping_keys(frozenset(value)):
            data[key] = value[key]
        frozen = object.__new__(cls)
        frozen._data = data
        frozen._entries = None
        frozen._hash = None
        frozen._digest = None
        return frozen

    @classmethod
    def overlay(
        cls,
        primary: Mapping[str, Any],
        fallback: "FrozenMap",
    ) -> "FrozenMap":
        """Compose immutable facts without recursively refreezing shared context."""

        primary_frozen = primary if isinstance(primary, cls) else cls(primary)
        if primary_frozen is fallback or not primary_frozen:
            return fallback
        if not fallback:
            return primary_frozen
        # Reuse an immutable map only when every overwritten value is the
        # identical object. Equality alone would conflate JSON-distinct values
        # such as 1 and True, or 0.0 and -0.0.
        if all(
            key in fallback and value is fallback[key]
            for key, value in sorted(primary_frozen._data.items())
        ):
            return fallback
        if len(primary_frozen) >= len(fallback) and all(key in primary_frozen for key in fallback):
            # A complete replacement has no remaining dependency on its old
            # context. Do not pin that obsolete graph behind an empty overlay.
            return primary_frozen
        return _FrozenOverlayMap.from_parts(primary_frozen, fallback)

    @classmethod
    def _validate(cls, value: Any) -> "FrozenMap":
        if isinstance(value, cls):
            return value
        return cls(value)

    @classmethod
    def __get_pydantic_core_schema__(
        cls,
        _source_type: Any,
        _handler: Any,
    ) -> core_schema.CoreSchema:
        return core_schema.no_info_plain_validator_function(
            cls._validate,
            # Describe the JSON envelope without replacing recursive freezing.
            # Nominal contract qualification also hashes this validator source.
            json_schema_input_schema=core_schema.dict_schema(
                keys_schema=core_schema.str_schema(min_length=1),
                values_schema=core_schema.any_schema(),
            ),
            serialization=core_schema.plain_serializer_function_ser_schema(
                # The private digest path only encodes JSON; it can read
                # immutable children directly. Python/public dumps retain
                # their independent recursively thawed representation.
                lambda value, info: (
                    value._canonical_json_storage()
                    if info.mode == 'json' and info.context is _IMMUTABLE_JSON_DIGEST_CONTEXT
                    else value.to_dict()
                ),
                info_arg=True,
                return_schema=core_schema.dict_schema(),
                when_used="always",
            ),
        )


class _CanonicalFieldMap(FrozenMap):
    """Ordinary FrozenMap ABI; eager value capture, compact field index."""

    __slots__ = ()

    @classmethod
    def from_fields(cls, names, values):
        result = object.__new__(cls)
        result._data = _CanonicalFieldData(names, values)
        result._entries = result._hash = result._digest = None
        return result

    def __repr__(self):
        return f"FrozenMap({self.to_shallow_dict()!r})"

    def __reduce_ex__(self, protocol):
        return FrozenMap, (self._data.canonical_storage(),)


class _FrozenOverlayItemsView(ItemsView[str, Any]):
    """Traverse an explicit full overlay view without recursive key lookup.

    The temporary index retains the same immutable child objects, only for this
    traversal. Lazy single-field reads and the ordinary ItemsView API remain
    unchanged; no second full index is retained by every alternative.
    """

    def __iter__(self):
        layers = []
        base = (self._mapping._data
                if type(self._mapping) in (FrozenMap, _FrozenOverlayMap)
                else self._mapping)
        while type(base) is _FrozenOverlayData:
            if type(base.primary) not in (dict, _CanonicalFieldData):
                yield from super().__iter__()
                return
            layers.append(base.primary)
            base = base.fallback
        if type(base) not in (dict, _CanonicalFieldData):
            # A foreign Mapping or an overriding subclass keeps its original
            # lookup semantics; only known immutable storage takes this path.
            yield from super().__iter__()
            return
        values = dict(base)
        for layer in reversed(layers):
            values.update(layer)
        for key in self._mapping:
            yield key, values[key]


class _FrozenOverlayData(Mapping[str, Any]):
    """A bounded immutable lookup layer; unchanged fields stay in the base."""

    __slots__ = ("primary", "fallback", "depth", "size", "names")

    def __init__(self, primary, fallback):
        self.primary = primary
        self.fallback = fallback
        self.depth = 1 + (fallback.depth if isinstance(fallback, _FrozenOverlayData) else 0)
        self.size = len(fallback) + sum(key not in fallback for key in primary)
        self.names = None

    def __getitem__(self, key):
        return self.primary[key] if key in self.primary else self.fallback[key]

    def __contains__(self, key):
        return key in self.primary or key in self.fallback

    def items(self):
        return _FrozenOverlayItemsView(self)

    def __len__(self):
        return self.size

    def __iter__(self):
        if self.names is None:
            self.names = _canonical_mapping_keys(frozenset(self.primary) | frozenset(self.fallback))
        return iter(self.names)


class _FrozenOverlayMap(FrozenMap):
    """The ordinary FrozenMap contract backed by a small physical delta."""

    __slots__ = ()

    @classmethod
    def from_parts(cls, primary, fallback):
        base = fallback._data
        if isinstance(base, _FrozenOverlayData) and base.depth >= 8:
            base = fallback.to_shallow_dict()
        delta = (primary.to_shallow_dict() if isinstance(primary._data, _FrozenOverlayData)
                 else primary._data)
        result = object.__new__(cls)
        result._data = _FrozenOverlayData(delta, base)
        result._hash = None
        result._digest = None
        return result

    @property
    def _items(self):
        # Full traversal is an explicit consumer operation. Never retain a
        # second tuple/dictionary of every inherited fact on each alternative.
        return tuple(self._data.items())

    def _canonical_json_storage(self):
        return dict(self._data.items())

    def __repr__(self):
        return f"FrozenMap({self.to_shallow_dict()!r})"

    def __getstate__(self):
        # Preserve nominal immutable children, without serializing the virtual
        # full-items property or changing an opaque child into a JSON mapping.
        return None, {"_data": self._data, "_hash": self._hash, "_digest": self._digest}


@lru_cache(maxsize=512)
def _encoded_integer_tuple(value: tuple[int, ...]) -> bytes:
    """Bounded exact hash bytes for short immutable integer sequences."""
    parts = [b"T", len(value).to_bytes(8, "big")]
    for child in value:
        numerator = str(child).encode("ascii")
        parts.extend((b"N", len(numerator).to_bytes(8, "big"), numerator,
                      (1).to_bytes(8, "big"), b"1"))
    return b"".join(parts)


def _update_frozen_hash(digest: Any, value: Any, *, root: bool = False) -> None:
    """Feed one immutable value without encoding or sorting its whole tree."""

    if isinstance(value, FrozenMap):
        if not root:
            digest.update(b"M")
            digest.update(FrozenMap.__hash__(value).to_bytes(8, "big", signed=True))
            return
        digest.update(b"M")
        digest.update(len(value).to_bytes(8, "big"))
        for key, child in sorted(value._data.items()):
            key_bytes = key.encode("utf-8")
            digest.update(len(key_bytes).to_bytes(8, "big"))
            digest.update(key_bytes)
            _update_frozen_hash(digest, child)
    elif isinstance(value, tuple):
        # Raster rows and coordinate vectors recur inside distinct immutable
        # facts. Reuse their exact existing encoding, without changing hashes.
        # At most 128 signed 64-bit integers per key and 512 cached keys.
        if len(value) <= 128 and all(
            type(child) is int and child.bit_length() <= 63 for child in value
        ):
            digest.update(_encoded_integer_tuple(value))
            return
        digest.update(b"T")
        digest.update(len(value).to_bytes(8, "big"))
        for child in value:
            _update_frozen_hash(digest, child)
    elif value is None:
        digest.update(b"Z")
    elif type(value) in {bool, int, float}:
        digest.update(b"N")
        numerator, denominator = (
            value.as_integer_ratio() if type(value) is float else (int(value), 1)
        )
        numerator_bytes = str(numerator).encode("ascii")
        denominator_bytes = str(denominator).encode("ascii")
        digest.update(len(numerator_bytes).to_bytes(8, "big"))
        digest.update(numerator_bytes)
        digest.update(len(denominator_bytes).to_bytes(8, "big"))
        digest.update(denominator_bytes)
    elif isinstance(value, str):
        encoded = value.encode("utf-8")
        digest.update(b"S")
        digest.update(len(encoded).to_bytes(8, "big"))
        digest.update(encoded)
    else:
        raise TypeError(f"unsupported frozen hash value: {type(value).__name__}")


_FROZEN_TUPLE_CACHE_LIMIT = 4096
_FROZEN_TUPLE_CACHE: dict[int, tuple[tuple[Any, ...], tuple[Any, ...]]] = {}


def _frozen_dataclass_items(value: Any) -> tuple[tuple[str, Any], ...] | None:
    """Expose declared immutable record fields without asdict/deepcopy."""
    if isinstance(value, type) or not is_dataclass(value):
        return None
    if not value.__dataclass_params__.frozen:
        raise TypeError('mutable dataclass is not a canonical immutable value')
    return tuple((field.name, getattr(value, field.name)) for field in dataclass_fields(value))


def freeze_json(value: Any) -> Any:
    value_type = type(value)
    if value is None or value_type in {str, bool, int}:
        return value
    if value_type is float:
        if not math.isfinite(value):
            raise ValueError("non-finite floats are not canonical JSON values")
        return value
    if value_type is tuple:
        identity = id(value)
        cached = _FROZEN_TUPLE_CACHE.get(identity)
        if cached is not None and cached[0] is value:
            return cached[1]
        # Exact scalar tuples are already canonical immutable JSON.  Avoid a
        # second walk through every pixel/coordinate when a validated raster
        # or scene model crosses another workflow binding boundary.
        if all(item is None or type(item) in (str, bool, int)
               or isinstance(item, FrozenMap) for item in value):
            frozen = value
        else:
            changed = None
            for index, item in enumerate(value):
                child = freeze_json(item)
                if changed is not None:
                    changed.append(child)
                elif child is not item:
                    changed = list(value[:index])
                    changed.append(child)
            frozen = value if changed is None else tuple(changed)
        # A count-limited cache must not pin arbitrary model/map payload graphs
        # or mutable children through a tuple. Only bounded scalar vectors live
        # here; other immutable values are owned by their actual consumers.
        if (frozen is value and len(value) <= 128 and all(
                item is None or type(item) is bool
                or type(item) is int and item.bit_length() <= 64
                or type(item) is str and len(item) <= 128 for item in value)):
            if len(_FROZEN_TUPLE_CACHE) >= _FROZEN_TUPLE_CACHE_LIMIT:
                _FROZEN_TUPLE_CACHE.pop(next(iter(_FROZEN_TUPLE_CACHE)))
            _FROZEN_TUPLE_CACHE[identity] = (value, frozen)
        return frozen
    if value_type is list:
        return tuple(freeze_json(item) for item in value)
    if isinstance(value, FrozenMap):
        return value
    if isinstance(value, Enum):
        return freeze_json(value.value)
    if isinstance(value, tuple):
        return tuple(freeze_json(item) for item in value)
    if isinstance(value, list):
        return tuple(freeze_json(item) for item in value)
    if isinstance(value, Mapping):
        return FrozenMap(value)
    if isinstance(value, BaseModel) and isinstance(value, FrozenModel):
        # A typed immutable contract crosses JSON transport through its exact
        # canonical fields, just as it does at journal/hash boundaries. Keep
        # mutable Pydantic models unsupported; consumers still validate the
        # declared concrete contract after reading the transported mapping.
        return immutable_json_data(value)
    record_items = _frozen_dataclass_items(value)
    if record_items is not None:
        return FrozenMap.from_frozen_items({name: freeze_json(item) for name, item in record_items})
    raise TypeError(f"unsupported immutable JSON value: {type(value).__name__}")


def thaw_json(value: Any) -> Any:
    if isinstance(value, FrozenMap):
        return value.to_dict()
    if isinstance(value, tuple):
        return [thaw_json(item) for item in value]
    if isinstance(value, Enum):
        return value.value
    return value


class FrozenModel(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        frozen=True,
        str_strip_whitespace=True,
        validate_default=True,
        # Build validation/serialization machinery only for types actually used.
        # First use still validates; this never disables any model validator.
        defer_build=True,
    )

    def canonical_field_names(self):
        """Fields contributing to the model's declared archive shape."""
        return self.__class__.model_fields

    @property
    def model_fields_set(self) -> set[str]:
        metadata = self.__pydantic_fields_set__
        # Existing runtime consumers only read this property. Mutation of a
        # returned pooled set must never change another frozen model. Foreign
        # or unpooled metadata keeps Pydantic's former path unchanged.
        return set(metadata) if type(metadata) is _SharedFieldNames else metadata

    def model_copy(self, *, update=None, deep=False):
        copied = super().model_copy(update=update, deep=deep)
        # An in-process projection belongs to this exact immutable instance.
        # Pydantic copies __dict__ extras too; never transport an old model's
        # projection (and its owner) into a new version.
        copied.__dict__.pop("_runtime_projection_memo", None)
        copied.__dict__.pop("_runtime_transport_digest", None)
        return copied


_LIVE_MODEL_PROJECTIONS: dict[int, tuple[weakref.ReferenceType[FrozenModel], FrozenMap]] = {}


def immutable_json_data(value: Any) -> Any:
    """Project typed values without thawing already immutable payloads.

    This is an in-process representation, not an encoder. Canonical JSON is
    still produced at the archive boundary. Shared FrozenMap subtrees retain
    their exact identity; no traversal, sorting or copying of them is needed.
    """
    kind = type(value)
    if value is None or kind in (str, bool, int):
        return value
    if kind is float:
        return freeze_json(value)
    if isinstance(value, FrozenMap):
        return value
    if isinstance(value, FrozenModel):
        names = tuple(value.canonical_field_names())
        if (len(names) <= 128 and len(set(names)) == len(names)
                and all(type(name) is str and name.strip() and len(name) <= 128 for name in names)):
            # Preserve the former evaluation order and eager descendant capture.
            # No producer/model owner survives behind this mapping. Mutable or
            # unsupported descendants are frozen/refused before returning.
            values = tuple(immutable_json_data(getattr(value, name)) for name in names)
            return _CanonicalFieldMap.from_fields(names, values)
        return FrozenMap.from_frozen_items({
            name: immutable_json_data(getattr(value, name)) for name in names
        })
    if isinstance(value, (tuple, list)):
        if kind is not tuple:
            return tuple(immutable_json_data(item) for item in value)
        changed = None
        for index, item in enumerate(value):
            child = immutable_json_data(item)
            if changed is not None:
                changed.append(child)
            elif child is not item:
                changed = list(value[:index])
                changed.append(child)
        return value if changed is None else tuple(changed)
    if isinstance(value, Mapping):
        return FrozenMap.from_frozen_items({
            key: immutable_json_data(item) for key, item in sorted(value.items())
        })
    return freeze_json(value)


def canonical_data(value: Any) -> Any:
    # Primitive leaves dominate frame and delta payloads.  Reject them before
    # Pydantic's metaclass-backed isinstance check, which is materially more
    # expensive and cannot match an exact built-in scalar type.
    if value is None or type(value) in (str, bool, int, float):
        return value
    if isinstance(value, FrozenMap):
        return {key: canonical_data(item) for key, item in sorted(value.items())}
    if isinstance(value, BaseModel):
        # Frozen V5 models are already validated immutable values.  Reading
        # their declared fields directly avoids Pydantic materializing a second
        # deep object tree before this canonical walker immediately traverses
        # it again.  Field names and values are unchanged, so hashes remain
        # byte-for-byte compatible with the prior model_dump path.
        return {
            key: canonical_data(getattr(value, key))
            for key in (value.canonical_field_names() if isinstance(value, FrozenModel) else value.__class__.model_fields)
        }
    if isinstance(value, Enum):
        return value.value
    if isinstance(value, (list, tuple)):
        if all(
            item is None or isinstance(item, (str, bool, int, float))
            for item in value
        ):
            return value
        if value and all(
            isinstance(row, tuple)
            and all(
                item is None or isinstance(item, (str, bool, int, float))
                for item in row
            )
            for row in value
        ):
            return value
        return [canonical_data(item) for item in value]
    if isinstance(value, Mapping):
        return {str(key): canonical_data(value[key]) for key in sorted(value)}
    record_items = _frozen_dataclass_items(value)
    if record_items is not None:
        return {name: canonical_data(item) for name, item in record_items}
    return value


class _CanonicalImmutableJsonEncoder(json.JSONEncoder):
    """Expose validated immutable storage directly to CPython's JSON encoder."""

    def default(self, value: Any) -> Any:
        if isinstance(value, FrozenMap):
            return value._canonical_json_storage()
        if isinstance(value, BaseModel):
            return {
                key: getattr(value, key)
                for key in (value.canonical_field_names() if isinstance(value, FrozenModel) else value.__class__.model_fields)
            }
        if isinstance(value, Enum):
            return value.value
        if isinstance(value, Mapping):
            return {str(key): value[key] for key in sorted(value)}
        record_items = _frozen_dataclass_items(value)
        if record_items is not None:
            return dict(record_items)
        return super().default(value)


_CANONICAL_MAP_JSON_LIMIT = 64 * 1024 * 1024
_CANONICAL_MAP_JSON: dict[int, tuple[weakref.ReferenceType[FrozenMap], str]] = {}
_canonical_map_json_bytes = 0
_CANONICAL_TUPLE_JSON_LIMIT = 1024 * 1024
_CANONICAL_TUPLE_JSON: dict[int, tuple[tuple[Any, ...], str]] = {}
_canonical_tuple_json_bytes = 0
_CANONICAL_NON_MAP_TYPES = frozenset({str, bool, int, float, tuple, list, dict, type(None)})


def canonical_json(value: Any) -> str:
    # Only exact scalar roots bypass the custom encoder.  The encoder handles
    # nested plain tuples/lists/dicts itself; recursively certifying them here
    # walked large immutable scene payloads once *before* every actual encode.
    if value is None:
        return 'null'
    kind = type(value)
    if kind is str:
        return encode_basestring_ascii(value)
    if kind is bool:
        return 'true' if value else 'false'
    if kind is int:
        return str(value)
    if kind is float:
        return json.dumps(
            value,
            ensure_ascii=True,
            allow_nan=False,
            separators=(",", ":"),
            sort_keys=True,
        )
    # Cache only exact immutable mapping roots. Ownership is weak and the
    # byte/entry bounds prevent this transport cache retaining scene history.
    global _canonical_map_json_bytes, _canonical_tuple_json_bytes
    tuple_root = kind is tuple
    if tuple_root:
        identity = id(value)
        cached_tuple = _CANONICAL_TUPLE_JSON.get(identity)
        if cached_tuple is not None and cached_tuple[0] is value:
            return cached_tuple[1]
        tuple_root = all(item is None or type(item) in {str, bool, int, float}
                         for item in value)
    frozen_root = isinstance(value, FrozenMap)
    if frozen_root:
        identity = id(value)
        cached = _CANONICAL_MAP_JSON.get(identity)
        if cached is not None and cached[0]() is value:
            return cached[1]
    items = value._canonical_json_items() if frozen_root else (
        tuple((key, value[key]) for key in _canonical_mapping_keys(frozenset(value)))
        if kind is dict and all(type(key) is str for key in value) else ()
    )
    if any(type(child) not in _CANONICAL_NON_MAP_TYPES and isinstance(child, FrozenMap)
           for _, child in items):
        # Split only envelopes containing immutable map children. Their exact
        # cached JSON can be reused under a new parent; primitive raster/tuple
        # payloads still use the C encoder, not a Python walk per pixel.
        encoded = '{' + ','.join(
            _canonical_json_key(key) + canonical_json(child)
            for key, child in items
        ) + '}'
    else:
        encoded = json.dumps(
            value,
            cls=_CanonicalImmutableJsonEncoder,
            ensure_ascii=True,
            allow_nan=False,
            separators=(",", ":"),
            sort_keys=True,
        )
    if frozen_root and len(encoded) <= _CANONICAL_MAP_JSON_LIMIT:
        def discard(reference, key=identity):
            global _canonical_map_json_bytes
            current = _CANONICAL_MAP_JSON.get(key)
            if current is not None and current[0] is reference:
                _canonical_map_json_bytes -= len(current[1])
                _CANONICAL_MAP_JSON.pop(key, None)

        while _CANONICAL_MAP_JSON and (
            len(_CANONICAL_MAP_JSON) >= 512
            or _canonical_map_json_bytes + len(encoded) > _CANONICAL_MAP_JSON_LIMIT
        ):
            evicted = _CANONICAL_MAP_JSON.pop(next(iter(_CANONICAL_MAP_JSON)))
            _canonical_map_json_bytes -= len(evicted[1])
        _CANONICAL_MAP_JSON[identity] = (weakref.ref(value, discard), encoded)
        _canonical_map_json_bytes += len(encoded)
    if tuple_root and len(encoded) <= 64 * 1024:
        # Scalar tuples cannot own a mutable scene/model. Pin exact identities
        # only within both bounds; never conflate equal bool/int or signed zero.
        while _CANONICAL_TUPLE_JSON and (
            len(_CANONICAL_TUPLE_JSON) >= 1024
            or _canonical_tuple_json_bytes + len(encoded) > _CANONICAL_TUPLE_JSON_LIMIT
        ):
            evicted_tuple = _CANONICAL_TUPLE_JSON.pop(next(iter(_CANONICAL_TUPLE_JSON)))
            _canonical_tuple_json_bytes -= len(evicted_tuple[1])
        _CANONICAL_TUPLE_JSON[identity] = (value, encoded)
        _canonical_tuple_json_bytes += len(encoded)
    return encoded


@lru_cache(maxsize=4096)
def _canonical_json_key(key: str) -> str:
    return encode_basestring_ascii(key) + ':'


_LIVE_MODEL_DIGESTS: dict[int, tuple[weakref.ReferenceType[FrozenModel], str]] = {}

# A state after an immutable leading child, never a replacement child digest.
# The original canonical byte stream (including every current envelope field)
# is still hashed. Weak ownership and hard bounds exclude abandoned history.
_CANONICAL_DIGEST_PREFIXES: dict[int, tuple[weakref.ReferenceType[FrozenMap], tuple[bytes, bool], Any]] = {}


def _canonical_digest_json(value: Any, encoder_storage: bool) -> str:
    if not encoder_storage:
        return canonical_json(value)
    return json.dumps(value, cls=_CanonicalImmutableJsonEncoder, ensure_ascii=True,
                      allow_nan=False, separators=(",", ":"), sort_keys=True)


def _canonical_digest_state(value: Any, prefix: bytes = b"", depth: int = 0,
                            encoder_storage: bool = False):
    if prefix and isinstance(value, FrozenMap):
        identity = id(value)
        context = (prefix, encoder_storage)
        cached = _CANONICAL_DIGEST_PREFIXES.get(identity)
        if cached is not None and cached[0]() is value and cached[1] == context:
            return cached[2].copy()
        encoded = _canonical_digest_json(value, encoder_storage)
        state = hashlib.sha256(prefix)
        state.update(encoded.encode("utf-8"))
        if len(encoded) >= 64 * 1024 and len(prefix) <= 4096:
            def discard(reference, key=identity):
                current = _CANONICAL_DIGEST_PREFIXES.get(key)
                if current is not None and current[0] is reference:
                    _CANONICAL_DIGEST_PREFIXES.pop(key, None)

            while len(_CANONICAL_DIGEST_PREFIXES) >= 512:
                _CANONICAL_DIGEST_PREFIXES.pop(next(iter(_CANONICAL_DIGEST_PREFIXES)))
            _CANONICAL_DIGEST_PREFIXES[identity] = (weakref.ref(value, discard), context, state.copy())
        return state

    if type(value) is dict and all(type(key) is str for key in value):
        names = _canonical_mapping_keys(frozenset(value))
        read = value.__getitem__
        # canonical_json splits dict roots only for direct FrozenMap children.
        # Otherwise its C encoder owns every nested subtree's storage shape.
        encoder_storage = encoder_storage or not any(isinstance(value[name], FrozenMap) for name in names)
    elif isinstance(value, FrozenModel):
        # This is exactly the field shape used by the canonical JSON encoder,
        # rather than model_dump or its potentially different nominal schema.
        names = tuple(sorted(value.canonical_field_names()))
        read = lambda name: getattr(value, name)
        encoder_storage = True
    else:
        names = ()
    if names and depth < 8 and isinstance(read(names[0]), (FrozenMap, FrozenModel)):
        first = names[0]
        child_prefix = prefix + b"{" + _canonical_json_key(first).encode("utf-8")
        state = _canonical_digest_state(read(first), child_prefix, depth + 1, encoder_storage)
        for name in names[1:]:
            state.update(b"," + _canonical_json_key(name).encode("utf-8"))
            state.update(_canonical_digest_json(read(name), encoder_storage).encode("utf-8"))
        state.update(b"}")
        return state
    state = hashlib.sha256(prefix)
    state.update(_canonical_digest_json(value, encoder_storage).encode("utf-8"))
    return state


def _stable_immutable_digest(value: FrozenModel) -> str:
    """Reuse an exact model digest without retaining abandoned model versions.

    Identity is private memoization only. The public hash remains the SHA of
    canonical bytes, and a copied model gets a fresh entry. A weak reference
    avoids both retaining large historical contexts and recursively hashing
    the model merely to look up its already computed digest.
    """
    identity = id(value)
    cached = _LIVE_MODEL_DIGESTS.get(identity)
    if cached is not None and cached[0]() is value:
        return cached[1]
    digest = _canonical_digest_state(value).hexdigest()

    def discard(reference, key=identity):
        current = _LIVE_MODEL_DIGESTS.get(key)
        if current is not None and current[0] is reference:
            _LIVE_MODEL_DIGESTS.pop(key, None)

    _LIVE_MODEL_DIGESTS[identity] = (weakref.ref(value, discard), digest)
    return digest


_LIVE_MODEL_SCHEMA_DIGESTS: dict[int, tuple[weakref.ReferenceType[FrozenModel], str]] = {}


def restore_nominal_dataclass_input(value: Any) -> Any:
    """Restore Source maps only when a caller declares a dataclass field boundary."""
    if isinstance(value, FrozenMap):
        return value.to_dict()
    if isinstance(value, (tuple, list)):
        restored = tuple(restore_nominal_dataclass_input(item) for item in value)
        return value if all(a is b for a, b in zip(value, restored)) else restored
    return value


def _schema_json_fallback(value: Any) -> Any:
    """Preserve FrozenMap's nominal encoding when an Any field hides its schema."""
    if isinstance(value, FrozenMap):
        return value._canonical_json_storage()
    raise TypeError(f"unsupported schema-ordered JSON value: {type(value).__name__}")


_NOMINAL_JSON_COMPLETION_LOCK = RLock()


def ensure_nominal_json_serializer(value: FrozenModel) -> FrozenModel:
    """Complete a deferred nominal schema only when its JSON is requested."""

    model_type = type(value)
    if not model_type.__pydantic_complete__:
        with _NOMINAL_JSON_COMPLETION_LOCK:
            if not model_type.__pydantic_complete__:
                # Resolve the declaring module, without capturing caller data.
                model_type.model_rebuild(_parent_namespace_depth=0)
    return value


def schema_ordered_digest(value: FrozenModel) -> str:
    """Hash one validated immutable contract through Pydantic's fast JSON path.

    This digest is for bounded runtime cache identity, not canonical archives or
    reducer state.  Frozen model field order and FrozenMap key order are stable,
    while Rust-side serialization avoids rebuilding a large Python object tree.
    """

    identity = id(value)
    cached = _LIVE_MODEL_SCHEMA_DIGESTS.get(identity)
    if cached is not None and cached[0]() is value:
        return cached[1]
    ensure_nominal_json_serializer(value)
    digest = hashlib.sha256(value.model_dump_json(
        context=_IMMUTABLE_JSON_DIGEST_CONTEXT,
        fallback=_schema_json_fallback,
    ).encode("utf-8")).hexdigest()

    def discard(reference, key=identity):
        current = _LIVE_MODEL_SCHEMA_DIGESTS.get(key)
        if current is not None and current[0] is reference:
            _LIVE_MODEL_SCHEMA_DIGESTS.pop(key, None)

    _LIVE_MODEL_SCHEMA_DIGESTS[identity] = (weakref.ref(value, discard), digest)
    return digest


def stable_digest(value: Any) -> str:
    if isinstance(value, FrozenMap):
        cached = getattr(value, "_digest", None)
        if cached is None:
            cached = hashlib.sha256(canonical_json(value).encode("utf-8")).hexdigest()
            value._digest = cached
        return cached
    if isinstance(value, FrozenModel):
        return _stable_immutable_digest(value)
    if type(value) is dict:
        return _canonical_digest_state(value).hexdigest()
    return hashlib.sha256(canonical_json(value).encode("utf-8")).hexdigest()


def require_unique(values: tuple[Ref, ...], field_name: str) -> None:
    if len(values) != len(set(values)):
        raise ValueError(f"{field_name} must contain unique references")
