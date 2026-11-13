"""Measurements only: Source retains revisable word, flow and field questions."""
from agents.yf_arc3_v5.logos.types import FrozenMap
from .material_supposition_contracts_c import (WordTransductionSuppositionInputC,
    DirectedFlowSuppositionInputC, LocalFieldSuppositionInputC, MaterialSuppositionFactsC,
    MaterialSuppositionDecisionInputC, MaterialSuppositionDecisionC)
from .structural_supposition_c import _scope_current, _typed_relation
from .directed_accretive_flow import measure_directed_flow_collider_union
from .local_field_type_production import measure_local_field_transaction


def measure_word_transduction_supposition(value: WordTransductionSuppositionInputC) -> MaterialSuppositionFactsC:
    scope = value.scope
    current = _scope_current(scope)
    carriers = {item.carrier_ref: item for item in value.carriers}
    unique = len(carriers) == len(value.carriers)
    rows, checks, pending, alphabet_match = [], 0, False, False
    for connector in value.connectors:
        endpoints = connector.endpoint_carrier_refs
        supported = (unique and endpoints[0] != endpoints[1]
            and all(ref in carriers for ref in endpoints) and bool(connector.visible_join_evidence_refs))
        rows.append(FrozenMap({"connector_ref": connector.connector_ref,
            "endpoint_refs": endpoints, "visible_join_supported": current and supported}))
    joined = any(row["visible_join_supported"] for row in rows)
    joined_refs = {ref for row in rows if row["visible_join_supported"] for ref in row["endpoint_refs"]}
    for index, left in enumerate(value.carriers):
        for right in value.carriers[index + 1:]:
            if checks >= value.max_pair_checks:
                pending = True
                break
            checks += 1
            complete = (current and unique and left.complete and right.complete
                and None not in left.canonical_symbols and None not in right.canonical_symbols
                and bool(left.identity_evidence_refs) and bool(right.identity_evidence_refs)
                and bool(value.same_alphabet_basis_evidence_refs)
                and left.alphabet_basis_ref == right.alphabet_basis_ref)
            overlap = tuple(sorted(set(left.canonical_symbols) & set(right.canonical_symbols) - {None}))
            match = complete and left.region_ref != right.region_ref and bool(overlap) and (
                left.carrier_ref in joined_refs or right.carrier_ref in joined_refs)
            alphabet_match = alphabet_match or match
            rows.append(FrozenMap({"left_ref": left.carrier_ref, "right_ref": right.carrier_ref,
                "cross_region_shared_alphabet_supported": match, "common_symbol_refs": overlap}))
        if pending:
            break
    editable_rules, editable_outputs = set(), set()
    for edit in value.edits:
        carrier = carriers.get(edit.carrier_ref) if unique else None
        qualified = (current and carrier is not None and edit.epoch == scope.epoch
            and edit.revision_ref == scope.revision_ref and edit.scope_ref == scope.scope_ref
            and edit.observation_sealed and edit.whole_unit_complete and bool(edit.evidence_refs)
            and bool(edit.canonical_identity_evidence_refs)
            and bool(carrier.identity_evidence_refs) and carrier.complete
            and edit.after_symbols == carrier.canonical_symbols
            and None not in edit.before_symbols and None not in edit.after_symbols)
        changed = qualified and edit.before_symbols != edit.after_symbols
        role_supported = carrier is not None and bool(carrier.role_evidence_refs)
        if changed and role_supported and carrier.role == "RULE":
            editable_rules.add(edit.carrier_ref)
        if changed and role_supported and carrier.role == "OUTPUT":
            editable_outputs.add(edit.carrier_ref)
        rows.append(FrozenMap({"example_ref": edit.example_ref, "carrier_ref": edit.carrier_ref,
            "primitive_ref": edit.primitive_ref, "canonical_mutation_observed": changed,
            "focus_observed": current and edit.observation_sealed and bool(edit.focus_evidence_refs)
                and edit.epoch == scope.epoch and edit.revision_ref == scope.revision_ref
                and edit.scope_ref == scope.scope_ref and edit.focused_carrier_ref in carriers,
            "focused_carrier_ref": edit.focused_carrier_ref,
            "whole_unit_length_changed": qualified and len(edit.before_symbols) != len(edit.after_symbols),
            "changed_same_length_ordinals": tuple(index for index, (before, after)
                in enumerate(zip(edit.before_symbols, edit.after_symbols)) if before != after)
                if qualified and len(edit.before_symbols) == len(edit.after_symbols) else (),
            "role_supported": role_supported, "before_symbols": edit.before_symbols, "after_symbols": edit.after_symbols}))
    return MaterialSuppositionFactsC(measurements=tuple(rows), actual_pair_checks=checks,
        facts=FrozenMap({"scope_current": current, "visible_connector_supported": joined,
            "matching_cross_region_alphabet_supported": alphabet_match, "pair_domain_open": pending,
            "editable_rule_refs": tuple(sorted(editable_rules)), "editable_output_refs": tuple(sorted(editable_outputs)),
            "editability_observed": bool(editable_rules or editable_outputs),
            "focus_alone_confirms_editability": False, "transduction_law_confirmed": False}))


def measure_directed_flow_supposition(value: DirectedFlowSuppositionInputC) -> MaterialSuppositionFactsC:
    current = _scope_current(value.scope)
    union = measure_directed_flow_collider_union(value.colliders)
    relation, qualified = _typed_relation(value.aperture_relation, value.scope)
    aperture = (qualified and value.aperture_relation.operator == "SUBSET"
        and value.aperture_relation.required_left_kind == "OCCUPIED_BODY"
        and value.aperture_relation.required_right_kind == "RECEIVING_APERTURE"
        and value.aperture_relation.right.owner_ref == value.receptacle_ref)
    configured = (current and bool(value.configurable_collider_evidence_refs)
        and bool(value.collider_scope_evidence_refs) and bool(value.colliders.collider_masks))
    receiving = aperture and relation.geometric_relation_value is True and bool(value.oriented_concavity_evidence_refs)
    return MaterialSuppositionFactsC(collider_union=union, measurements=(FrozenMap({
        "relation_ref": value.aperture_relation.relation_ref, "aperture_scope_qualified": aperture,
        "body_aperture_subset": relation.geometric_relation_value if aperture else None,
        "actual_support_point_visits": relation.actual_input_support_point_visits,
        "receptacle_ref": value.receptacle_ref, "source_ref": value.source_ref,
        "release_actuator_ref": value.release_actuator_ref}),),
        facts=FrozenMap({"scope_current": current,
            "source_cap_seed_supported": current and bool(value.source_cap_seed_evidence_refs),
            "configurable_colliders_supported": configured, "receiving_aperture_supported": receiving,
            "release_actuator_supported": current and value.release_actuator_ref is not None
                and bool(value.release_actuator_evidence_refs),
            "boundary_color_confirms_receiving": False, "routing_or_acceptance_law_confirmed": False}))


def _field_snapshot_supported(snapshot_ref, value):
    proof = value.snapshot_support.get(snapshot_ref)
    scope = value.scope
    return (proof is not None and proof.get("epoch") == scope.epoch
        and proof.get("revision_ref") == scope.revision_ref and proof.get("scope_ref") == scope.scope_ref
        and bool(proof.get("evidence_refs")))


def measure_local_field_supposition(value: LocalFieldSuppositionInputC) -> MaterialSuppositionFactsC:
    current = _scope_current(value.scope)
    samples = {sample.sample_ref: sample for sample in value.samples}
    unique = len(samples) == len(value.samples)
    rows, checks, pending, production = [], 0, False, False
    for item in value.compatibility:
        movable, target = samples.get(item.movable_ref), samples.get(item.target_ref)
        qualified = (current and unique and movable is not None and target is not None
            and movable.role == "MOVABLE" and target.role == "TARGET"
            and bool(movable.type_evidence_refs) and bool(target.type_evidence_refs)
            and bool(movable.role_evidence_refs) and bool(target.role_evidence_refs)
            and bool(item.independent_relation_evidence_refs))
        rows.append(FrozenMap({"movable_ref": item.movable_ref, "target_ref": item.target_ref,
            "compatibility_value": item.compatible if qualified else None,
            "independently_supported": qualified}))
    compatible = any(row["compatibility_value"] is True for row in rows)
    compatible_refs = {ref for row in rows if row["compatibility_value"] is True
        for ref in (row["movable_ref"], row["target_ref"])}
    for index, left in enumerate(value.samples):
        for right in value.samples[index + 1:]:
            if checks >= value.max_pair_checks:
                pending = True
                break
            checks += 1
            supported = (current and unique and bool(left.type_evidence_refs) and bool(right.type_evidence_refs)
                and bool(left.morphology_basis_evidence_refs) and bool(right.morphology_basis_evidence_refs)
                and left.intrinsic_basis_ref == right.intrinsic_basis_ref)
            repeated = supported and left.type_ref == right.type_ref
            different = supported and set(left.morphology) != set(right.morphology)
            production = production or (repeated and different and
                (left.sample_ref in compatible_refs or right.sample_ref in compatible_refs))
            rows.append(FrozenMap({"left_ref": left.sample_ref, "right_ref": right.sample_ref,
                "same_type_supported": repeated, "different_intrinsic_morphology_supported": different}))
        if pending:
            break
    native = None
    if value.transaction is not None:
        transaction = value.transaction
        snapshot_refs = tuple(snapshot.snapshot_ref for snapshot in
            (transaction.before, transaction.transient, *transaction.after_packet))
        supported = (current and value.body_inventory_complete and bool(value.transaction_sealed_evidence_refs)
            and len(snapshot_refs) == len(set(snapshot_refs))
            and all(_field_snapshot_supported(snapshot.snapshot_ref, value) for snapshot in
                (transaction.before, transaction.transient, *transaction.after_packet)))
        if supported:
            native = measure_local_field_transaction(transaction)
    field = current and bool(value.click_centered_transient_field_evidence_refs)
    return MaterialSuppositionFactsC(measurements=tuple(rows), field_transaction=native, actual_pair_checks=checks,
        facts=FrozenMap({"scope_current": current, "click_centered_field_supported": field,
            "compatible_movable_target_supported": compatible, "repeated_type_different_morphology_supported": production,
            "pair_domain_open": pending, "production_before_transport_question_supported": field and compatible and production,
            "whole_field_transaction_qualified": native is not None,
            "transient_only_is_persistent_production": False, "production_or_acceptance_law_confirmed": False}))


def assemble_material_supposition(value: MaterialSuppositionDecisionInputC) -> MaterialSuppositionDecisionC:
    return MaterialSuppositionDecisionC(frozen_request=value.request, frozen_measurement=value.measured,
        source_disposition_ref=value.source_disposition_ref, source_policy_ref=value.source_policy_ref)
