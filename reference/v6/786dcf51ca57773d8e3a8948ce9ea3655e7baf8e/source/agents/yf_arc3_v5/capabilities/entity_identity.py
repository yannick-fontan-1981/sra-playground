"""Exact description equality, independent of the number of supporting proofs.

Canonical rows remain untouched: transport may factor exact descriptions,
but equality of a bearer does not merge or select evidence.
An absent entity identity is unknown unless Source supplied the complete
bounded current member-union description. No temporal identity is invented.
"""

from collections.abc import Iterable

from agents.yf_arc3_v5.logos.types import FrozenMap, stable_digest


def compact_exact_entity_descriptions(
    rows: Iterable[FrozenMap], *, maximum_descriptions: int = 64,
    maximum_proofs_per_description: int = 64,
) -> tuple[FrozenMap, ...]:
    """Lossless transport factoring, not evidence selection or role merging.

    Only byte-equal descriptions share storage. Each original TERM identity
    retains its own premise list; unknown descriptions never establish aliases.
    Neither distinct descriptions nor support proofs may be truncated.
    """
    groups: dict[FrozenMap, list[FrozenMap]] = {}
    group_order: list[FrozenMap] = []
    for row in rows:
        if "source_term_rows" in row:
            raise ValueError("description transport already factored")
        fields = {key: value for key, value in sorted(row.items())
                  if key not in ("term_ref", "role_premise_claim_refs")}
        description = (FrozenMap.from_frozen_items(fields)
                       if isinstance(row, FrozenMap) else FrozenMap(fields))
        key = description if exact_entity_description_count((row,)) == 1 else row
        if key not in groups:
            group_order.append(key)
        group = groups.setdefault(key, [])
        group.append(row)
        if len(groups) > maximum_descriptions:
            raise ValueError("canonical description bound exceeded; no alternatives truncated")
        if len(group) > maximum_proofs_per_description:
            raise ValueError("canonical description proof bound exceeded; no proofs truncated")
    result = []
    for key in group_order:
        group = groups[key]
        if len(group) == 1:
            result.append(group[0])
            continue
        common = {key: value for key, value in sorted(group[0].items())
                  if key not in ("term_ref", "role_premise_claim_refs")}
        common["source_term_rows"] = tuple((FrozenMap.from_frozen_items if isinstance(row, FrozenMap) else FrozenMap)({
            "term_ref": row["term_ref"],
            "role_premise_claim_refs": row.get("role_premise_claim_refs", ()),
        }) for row in group)
        common["role_premise_claim_refs"] = tuple(dict.fromkeys(
            ref for row in group for ref in row.get("role_premise_claim_refs", ())))
        result.append((FrozenMap.from_frozen_items if all(isinstance(row, FrozenMap) for row in group)
                       else FrozenMap)(common))
    return tuple(result)


def declared_marker_carrier_descriptions_conjoin(rows: tuple[FrozenMap, ...]) -> bool:
    """Measure compatible partial descriptions of one current named carrier.

    Missing optional fields supply no contradiction or new proof. A current
    declared marker description and explicit partial-conjunction permission
    are required; every supplied geometric field must agree. Original rows,
    references and the strict exact-description counter remain untouched.
    """
    if not 2 <= len(rows) <= 64:
        return False
    required = ('entity_ref', 'shape_digest', 'bbox_height', 'bbox_width',
                'operational_scene_ref')
    marker_present = False
    combined = {}
    for row in rows:
        projection = row.get('control_geometry_identity_projection')
        if not isinstance(projection, (dict, FrozenMap)) or not projection:
            return False
        if any(projection.get(key) in (None, '') for key in required):
            return False
        marker = row.get('control_geometry_declared_marker_carrier') is True
        if not marker and row.get('control_geometry_partial_description_conjunction_allowed') is not True:
            return False
        if marker:
            members = row.get('marker_member_refs')
            if (not isinstance(members, (tuple, list)) or not 1 <= len(members) <= 64
                    or any(not isinstance(ref, str) or not ref for ref in members)
                    or len(set(members)) != len(members)):
                return False
            marker_present = True
        if row.get('control_support_unresolved_refs') or row.get('control_support_stale_term_refs'):
            return False
        for key, value in sorted(projection.items()):
            if value is None:
                continue
            if key in combined and combined[key] != value:
                return False
            combined[key] = value
        if len(combined) > 64:
            return False
    return marker_present


def exact_entity_description_count(rows: tuple[FrozenMap, ...]) -> int | None:
    for row in rows:
        if row.get("entity_ref"):
            continue
        members = row.get("member_refs", ())
        if (not isinstance(members, (tuple, list)) or not 2 <= len(members) <= 64
                or any(not isinstance(ref, str) or not ref for ref in members)
                or len(set(members)) != len(members)
                or not isinstance(row.get("support_digest"), str) or not row["support_digest"]
                or not isinstance(row.get("operational_scene_ref"), str) or not row["operational_scene_ref"]
                or type(row.get("bbox_height")) is not int or row["bbox_height"] <= 0
                or type(row.get("bbox_width")) is not int or row["bbox_width"] <= 0
                or row["bbox_height"] * row["bbox_width"] > 4096):
            return None
    if rows and all(row.get('control_geometry_identity_projection') for row in rows):
        # DRM declares the geometry view. Keep the complete rows and all their
        # independent proofs; differing association/provenance is not a second
        # physical footprint. Distinct extents or masks remain distinct keys.
        return len({row['control_geometry_identity_projection'] for row in rows})
    return len({stable_digest((FrozenMap.from_frozen_items if isinstance(row, FrozenMap) else FrozenMap)({
        key: tuple(sorted(value)) if key == "member_refs" else value
        for key, value in sorted(row.items())
        if key not in ("term_ref", "role_premise_claim_refs", "source_term_rows")
    })) for row in rows})


def exact_entity_descriptions_are_aliases(rows: tuple[FrozenMap, ...]) -> bool:
    return len(rows) > 1 and exact_entity_description_count(rows) == 1


def declared_entity_geometry_descriptions_are_compatible(rows: tuple[FrozenMap, ...]) -> bool:
    """Conjoin DRM-licensed partial descriptions without merging their proofs.

    A missing value is unknown; an explicitly supplied empty collection is a
    constraint. One complete current pose is required. Different actors,
    shapes, extents, scenes or supplied part inventories remain alternatives.
    """
    if exact_entity_descriptions_are_aliases(rows):
        return True
    if not 2 <= len(rows) <= 64 or not any(
        row.get('control_geometry_partial_description_conjunction_allowed') is True
        for row in rows
    ):
        return False
    required = ('entity_ref', 'shape_digest', 'bbox_height', 'bbox_width', 'operational_scene_ref')
    if any(any(row.get(key) is None or row.get(key) == '' for key in required) for row in rows):
        return False
    if not any(type(row.get('bbox_top')) is int and type(row.get('bbox_left')) is int
               and row.get('normalized_valued_pixels') for row in rows):
        return False
    fields = set(required)
    for row in rows:
        declared = row.get('control_geometry_identity_fields')
        if not isinstance(declared, (tuple, list)) or not declared:
            return False
        fields.update(declared)
    if len(fields) > 64:
        return False
    for key in fields:
        values = [row[key] for row in rows if key in row and row[key] is not None]
        if values and any(value != values[0] for value in values[1:]):
            return False
    return True
