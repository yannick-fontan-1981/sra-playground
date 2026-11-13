"""Context filtering reuses the exact index; no appearance rank is recomputed here."""
from .recognition_boundary_contracts_c import (RecognitionBoundaryInputC, RecognitionBoundaryFactsC,
    ObservationalAliasGroupC, RecognitionBoundaryDecisionInputC, RecognitionBoundaryDecisionC)
from agents.yf_arc3_v5.logos.types import FrozenMap
from agents.yf_arc3_v5.state.appearance_index import exact_context_is_compatible


def measure_recognition_boundary(value: RecognitionBoundaryInputC) -> RecognitionBoundaryFactsC:
    current = (value.epoch == value.support_epoch and value.revision_ref == value.support_revision_ref
        and value.scope_ref == value.support_scope_ref and bool(value.current_evidence_refs))
    role_support = bool(value.compatible_role_refs) and bool(value.role_context_support_refs)
    candidate_refs = tuple(item.candidate_ref for item in value.candidates)
    candidate_refs_unique = len(set(candidate_refs)) == len(candidate_refs)
    admitted, reserved, rows, missing, aliases = [], [], [], {}, {}
    rows_well_formed = True
    tokens = []
    for item in value.candidates:
        row = item.raw_binding_row
        fields_present = all(name in row for name in ("binding_token", "role_ref", "match_rank",
            "observation_ref", "role_context_requirements", "current_binding_incompatible_claim_count"))
        requirements = row.get("role_context_requirements")
        fields_valid = (fields_present and isinstance(requirements, FrozenMap)
            and isinstance(row.get("binding_token"), str) and bool(row.get("binding_token"))
            and isinstance(row.get("role_ref"), str) and bool(row.get("role_ref"))
            and type(row.get("match_rank")) is int and row["match_rank"] >= 0
            and type(row.get("current_binding_incompatible_claim_count")) is int
            and row["current_binding_incompatible_claim_count"] >= 0)
        rows_well_formed = rows_well_formed and fields_valid
        compatible = fields_valid and exact_context_is_compatible(requirements, item.current_context_values)
        unknown_fields = (tuple(key for key in sorted(requirements) if key not in item.current_context_values)
            if isinstance(requirements, FrozenMap) else ())
        missing[item.candidate_ref] = unknown_fields
        eligible = (current and role_support and fields_valid and compatible
            and row["role_ref"] in value.compatible_role_refs
            and row["observation_ref"] == value.current_observation_ref)
        if eligible:
            admitted.append(item.candidate_ref)
            rows.append(FrozenMap.overlay({"unresolved_context_fields": unknown_fields}, row))
            tokens.append(row["binding_token"])
            if item.rendering_evidence_refs:
                key = (item.rendering_contract_ref, item.observable_signature_ref)
                aliases.setdefault(key, []).append(item)
        else:
            reserved.append(item.candidate_ref)
    alias_groups = tuple(ObservationalAliasGroupC(rendering_contract_ref=key[0], observable_signature_ref=key[1],
        candidate_refs=tuple(item.candidate_ref for item in aliases[key]),
        evidence_refs=tuple(sorted({ref for item in aliases[key] for ref in item.rendering_evidence_refs})))
        for key in sorted(aliases) if len(aliases[key]) > 1)
    independent = tuple(relation for relation in value.independent_relations
        if current and relation.epoch == value.epoch and relation.revision_ref == value.revision_ref
        and relation.scope_ref == value.scope_ref and bool(relation.evidence_refs)
        and bool(relation.candidate_refs) and set(relation.candidate_refs).issubset(admitted))
    unqualified = tuple(relation.relation_ref for relation in value.independent_relations if relation not in independent)
    return RecognitionBoundaryFactsC(recognition_input_facts=FrozenMap({"recognition_rows": tuple(rows)}),
        admitted_candidate_refs=tuple(admitted), reserved_candidate_refs=tuple(reserved),
        missing_context_fields=FrozenMap(missing), observational_alias_groups=alias_groups,
        current_independent_relations=independent, unqualified_independent_relation_refs=unqualified,
        facts=FrozenMap({"scope_current": current, "role_context_support_present": role_support,
            "candidate_refs_unique": candidate_refs_unique, "binding_tokens_unique": len(set(tokens)) == len(tokens),
            "rows_well_formed": rows_well_formed, "admitted_candidates_present": bool(admitted),
            "context_unknowns_present": any(missing[reference] for reference in admitted)}))


def assemble_recognition_boundary(value: RecognitionBoundaryDecisionInputC) -> RecognitionBoundaryDecisionC:
    relations = value.measured.current_independent_relations
    return RecognitionBoundaryDecisionC(source_disposition_ref=value.source_disposition_ref,
        source_policy_ref=value.source_policy_ref, frozen_request=value.request, frozen_measurement=value.measured,
        ranked_facts=value.ranked_facts, observational_alias_groups=value.measured.observational_alias_groups,
        existing_ranking_applied=value.ranked_facts is not None,
        identity_evidence=tuple(item for item in relations if item.kind == "IDENTITY"),
        physical_action_equivalence_evidence=tuple(item for item in relations if item.kind == "PHYSICAL_ACTION_EQUIVALENCE"),
        terminal_acceptance_evidence=tuple(item for item in relations if item.kind == "TERMINAL_ACCEPTANCE"))
