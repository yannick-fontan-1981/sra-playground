"""Representation-neutral path/pattern measurements; no goal or action authority."""
from collections.abc import Mapping

from agents.yf_arc3_v5.logos.types import FrozenMap, FrozenModel, Ref, stable_digest


class ObservedFieldPatternComparison(FrozenModel):
    subject_path: tuple[str | int, ...]
    subject_present: bool
    subject_is_mapping: bool
    expected_field_refs: tuple[Ref, ...]
    missing_field_refs: tuple[Ref, ...]
    different_field_refs: tuple[Ref, ...]
    matching_field_refs: tuple[Ref, ...]
    expected_value_digests: FrozenMap
    observed_value_digests: FrozenMap
    required_fields_present: bool
    exact_pattern_match: bool


def observed_content_at_path(payload, path):
    """Presence is independent of the value, including None, False and zero."""
    value = payload
    for part in path:
        if isinstance(part, str) and isinstance(value, Mapping) and part in value:
            value = value[part]
        elif type(part) is int and isinstance(value, tuple) and 0 <= part < len(value):
            value = value[part]
        else:
            return False, None
    return True, value


def compare_observed_field_pattern(payload, path, expected):
    """Compare an explicitly supplied partial pattern with actual supplied fields.

    Evidence ownership/currentness belongs to the caller. This function never
    substitutes an expected value for a missing observation or treats an empty
    expectation as an observed success.
    """
    present, subject = observed_content_at_path(payload, path)
    subject_is_mapping = present and isinstance(subject, Mapping)
    fields = tuple(sorted(expected)) if isinstance(expected, Mapping) else ()
    absent, different, matching, observed_digests, expected_digests = [], [], [], {}, {}
    for key in fields:
        expected_digests[key] = stable_digest(expected[key])
        if not subject_is_mapping or key not in subject:
            absent.append(key)
            continue
        observed_digests[key] = stable_digest(subject[key])
        if observed_digests[key] == expected_digests[key]:
            matching.append(key)
        else:
            different.append(key)
    complete = bool(fields) and subject_is_mapping and not absent
    return ObservedFieldPatternComparison(subject_path=tuple(path), subject_present=present,
        subject_is_mapping=subject_is_mapping, expected_field_refs=fields,
        missing_field_refs=tuple(absent), different_field_refs=tuple(different),
        matching_field_refs=tuple(matching), expected_value_digests=FrozenMap(expected_digests),
        observed_value_digests=FrozenMap(observed_digests), required_fields_present=complete,
        exact_pattern_match=complete and not different)
