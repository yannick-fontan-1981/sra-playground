"""Finite exact identity joins; no spatial assumptions or semantic selection."""
from collections import defaultdict

from agents.yf_arc3_v5.logos.types import FrozenModel, Ref


class SubjectIdentityMeasurement(FrozenModel):
    source_refs: tuple[Ref, ...]
    candidate_refs: tuple[Ref, ...]
    missing_source_refs: tuple[Ref, ...]
    ambiguous_source_refs: tuple[Ref, ...]

    @property
    def complete(self) -> bool:
        return bool(self.source_refs) and not self.missing_source_refs and not self.ambiguous_source_refs


def measure_subject_identities(*, source_refs, identity_pairs, current_source_refs):
    identities, sources_by_identity = defaultdict(set), defaultdict(set)
    current = set(current_source_refs)
    requested = tuple(sorted(set(source_refs)))
    for source, identity in identity_pairs:
        if source in current:
            identities[source].add(identity)
            sources_by_identity[identity].add(source)
    return SubjectIdentityMeasurement(
        source_refs=requested,
        candidate_refs=tuple(sorted({identity for source in requested for identity in identities.get(source, ())})),
        missing_source_refs=tuple(source for source in requested if not identities.get(source)),
        ambiguous_source_refs=tuple(source for source in requested if identities.get(source)
            and (len(identities[source]) != 1 or any(len(sources_by_identity[identity]) != 1
                for identity in identities[source]))))
