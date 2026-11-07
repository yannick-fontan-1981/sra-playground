"""Mechanical receipts for requirements authored by a DRM declaration.

This module neither classifies a candidate nor releases an action. The named
DRM policy owns required fields, preservation and the use of the result.
"""
from collections.abc import Mapping

from agents.yf_arc3_v5.drm.contracts import DrmFactContract, DrmFactProjection
from agents.yf_arc3_v5.logos.types import FrozenMap, FrozenModel, Ref


class ProducedFactContract(FrozenModel):
    contract: DrmFactContract
    producer_ref: Ref
    alternative_ref: Ref
    missing_fields: tuple[Ref, ...]
    unowned_fields: tuple[Ref, ...]
    preserved_values: FrozenMap


def _present(facts: Mapping[str, object], field: str) -> bool:
    value = facts.get(field)
    return value is not None and value != "" and value != () and value != []


def capture_fact_contracts(*, projection: DrmFactProjection, contracts,
                           facts: Mapping[str, object], alternative_ref: str):
    if not projection.fact_contract_refs:
        return ()
    produced = set(projection.static_facts) | set(projection.templated_facts)
    produced.update(field for field, source in sorted(projection.bound_facts.items()) if source in facts)
    produced.update(item.output_field for item in projection.sequence_compositions)
    produced.update(item.output_field for item in projection.affine_expressions)
    return tuple(
        ProducedFactContract(
            contract=contracts[ref], producer_ref=projection.id,
            alternative_ref=alternative_ref,
            missing_fields=tuple(field for field in contracts[ref].required_fields if not _present(facts, field)),
            unowned_fields=tuple(field for field in contracts[ref].producer_owned_fields if field not in produced),
            preserved_values=FrozenMap({field: facts.get(field) for field in contracts[ref].preserved_fields}),
        ) for ref in projection.fact_contract_refs
    )


def _preserved(previous, current, mode):
    if mode == "contains_all":
        return (isinstance(previous, (tuple, list)) and isinstance(current, (tuple, list))
                and all(item in current for item in previous))
    return previous == current


def reconcile_fact_contracts(receipts, facts: Mapping[str, object]) -> dict[str, object]:
    output: dict[str, object] = {}
    grouped: dict[str, list[FrozenMap]] = {}
    for receipt in receipts:
        contract = receipt.contract
        missing = tuple(field for field in contract.required_fields if not _present(facts, field))
        changed = tuple(field for field, value in sorted(receipt.preserved_values.items())
            if not _preserved(value, facts.get(field), contract.preservation_modes.get(field, "exact")))
        valid = not (receipt.missing_fields or receipt.unowned_fields or missing or changed)
        row = FrozenMap({
            "contract_ref": contract.id, "producer_ref": receipt.producer_ref,
            "alternative_ref": receipt.alternative_ref,
            "production_missing_fields": receipt.missing_fields,
            "production_unowned_fields": receipt.unowned_fields,
            "current_missing_fields": missing, "changed_fields": changed,
            "production_preserved_values": receipt.preserved_values,
            "preserved_values": FrozenMap({field: facts.get(field) for field in contract.preserved_fields}),
            "valid": valid,
        })
        grouped.setdefault(contract.receipt_field, []).append(row)
        output[contract.validity_field] = bool(output.get(contract.validity_field, True) and valid)
    output.update({field: tuple(rows) for field, rows in sorted(grouped.items())})
    return output


def reconcile_retained_fact_contracts(*, contracts, producer_contracts, alternative_ref, facts):
    """Consume retained production receipts after an explicit Source extension.

    Original ownership/missing-field checks and production values survive;
    preservation is still evaluated by each declared DRM mode.
    """
    declared = {contract.id: contract for contract in contracts}
    receipts = []
    for field in sorted({contract.receipt_field for contract in contracts}):
        for row in facts.get(field, ()):
            if not isinstance(row, Mapping):
                raise ValueError('retained fact contract is not a nominal receipt mapping')
            contract = declared[row['contract_ref']]
            if (contract.receipt_field != field or row['alternative_ref'] != alternative_ref
                    or contract.id not in producer_contracts.get(row['producer_ref'], ())):
                raise ValueError('retained fact contract lost its declared producer or alternative')
            receipts.append(ProducedFactContract(contract=contract,
                producer_ref=row['producer_ref'], alternative_ref=row['alternative_ref'],
                missing_fields=row['production_missing_fields'],
                unowned_fields=row['production_unowned_fields'],
                preserved_values=row['production_preserved_values']))
    return reconcile_fact_contracts(tuple(receipts), facts)
