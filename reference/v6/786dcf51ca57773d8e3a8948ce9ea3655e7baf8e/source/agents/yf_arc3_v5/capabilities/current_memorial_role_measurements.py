"""Read-only joins between current relocated bearers and point candidates.

No role is selected here. Every current compatible binding and its canonical
proof is preserved; DRM decides whether a revisable experiment is appropriate.
"""

from agents.yf_arc3_v5.logos.types import FrozenMap


def measure_current_memorial_role_candidates(value, agenda):
    rows = {}
    for candidate in agenda.candidates:
        matched = []
        for binding in value.canonical_current_memorial_role_binding_facts:
            if (value.current_observation_ref is None
                    or binding.get("observation_ref") != value.current_observation_ref
                    or binding.get("binding_operational") is not True
                    or binding.get("unresolved_context_fields") != ()
                    or not binding.get("current_binding_claim_refs")):
                continue
            bearer = binding.get("bearer_ref")
            component = value.current_entity_component_refs.get(bearer, bearer)
            if candidate.component_ref is not None and candidate.component_ref == component:
                matched.append(binding)
        rows[candidate.candidate_ref] = FrozenMap({
            "candidate_current_memorial_role_refs": tuple(sorted({
                b["role_ref"] for b in matched if b.get("role_ref")})),
            "candidate_current_memorial_binding_refs": tuple(sorted({b["term_ref"] for b in matched})),
            "candidate_current_memorial_role_premise_claim_refs": tuple(sorted({
                ref for b in matched for ref in (
                    *b.get("current_binding_claim_refs", ()), *b.get("role_premise_claim_refs", ()))})),
            "candidate_current_memorial_role_falsifier_refs": tuple(sorted({
                ref for b in matched for ref in b.get("falsifier_refs", ())})),
            "candidate_current_memorial_role_match_count": len(matched),
            "candidate_current_memorial_role_premise_count": len({
                ref for b in matched for ref in b.get("current_binding_claim_refs", ())}),
        })
    return FrozenMap(rows)
