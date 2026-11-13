"""Exact acquisition receipts and work transport; Source invokes the writers."""
from agents.yf_arc3_v5.logos.types import FrozenMap,immutable_json_data


def append_articulated_field_acquisition(value):
    prior,item,decoded,owner=value.prior,value.item,value.decoded,value.owner
    missing=list(prior.missing_refs)
    if (item not in prior.requests or decoded.get("request_ref")!=item.decoder.request_ref
            or decoded.get("field_term_ref")!=item.decoder.output_term_ref
            or decoded.get("field_support_claim_ref")!=item.decoder.output_support_claim_ref
            or decoded.get("canonical_scalar_field_current") is not True):
        missing.append("articulated.current_complete_decoder_publication")
    if owner is None or owner.request!=item.owner or not owner.canonical_owner_proof_current or owner.missing_refs:
        missing.append("articulated.current_owner_proof_publication")
    row=FrozenMap({"decoder_request_ref":item.decoder.request_ref,"field_term_ref":item.decoder.output_term_ref,
        "field_support_claim_ref":item.decoder.output_support_claim_ref,"decoder_receipt":decoded,
        "owner_receipt":immutable_json_data(owner) if owner is not None else None})
    if any(receipt["decoder_request_ref"]==item.decoder.request_ref for receipt in prior.receipts):
        missing.append("articulated.exact_unique_acquisition_receipt")
        return prior.model_copy(update={"acquisition_bound":False,"missing_refs":tuple(sorted(set(missing)))})
    return prior.model_copy(update={"receipts":(*prior.receipts,row),"acquisition_bound":not bool(missing),
        "missing_refs":tuple(sorted(set(missing)))})


def join_articulated_acquisition_publication(value):
    publication,acquisition=value.publication,value.acquisition
    missing=list((*publication.missing_refs,*acquisition.missing_refs))
    if publication.request_digest!=acquisition.request_digest:
        missing.append("articulated.exact_acquisition_and_geometry_request")
    if len(acquisition.receipts)!=len(acquisition.requests) or not acquisition.acquisition_bound:
        missing.append("articulated.all_requested_field_publications_returned")
    evidence=set()
    for receipt in acquisition.receipts:
        evidence.add(receipt["field_support_claim_ref"])
        if receipt["owner_receipt"] is not None:
            evidence.add(receipt["owner_receipt"]["request"]["proof"]["claim_ref"])
    return publication.model_copy(update={"missing_refs":tuple(sorted(set(missing))),
        "field_acquisition_receipts":acquisition.receipts,
        "accounted_evaluations":publication.accounted_evaluations+acquisition.accounted_evaluations,
        "evidence_refs":tuple(sorted(set((*publication.evidence_refs,*evidence))))})
