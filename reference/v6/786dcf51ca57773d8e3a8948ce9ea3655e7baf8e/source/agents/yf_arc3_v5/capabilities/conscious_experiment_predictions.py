"""Exact observable compatibility sets, including overlapping/open predictions.

No probabilities, experimental choice, or causal model is inferred here.
An enumerated response is a possibility; only a declared closed outcome domain
permits an unlisted observation to contradict the model for this interval.
"""
from agents.yf_arc3_v5.logos.types import FrozenMap, stable_digest


def observable_outcomes(prediction):
    rows = {stable_digest(row): row for row in
        (prediction.observable_signature, *prediction.alternative_observable_signatures)}
    return tuple(row for _, row in sorted(rows.items()))


def measure_observable_compatibility(predictions, model_refs, field_refs):
    models = {row.model_ref: row for row in predictions}
    coverage = bool(models) and len(models) == len(predictions) and set(models) == set(model_refs) and len(set(model_refs)) == len(model_refs)
    outcomes = {ref: {stable_digest(row): row for row in observable_outcomes(prediction)}
        for ref, prediction in sorted(models.items())}
    fields_complete = bool(models) and bool(field_refs) and all(set(row) == set(field_refs)
        for _, rows in sorted(outcomes.items()) for _, row in sorted(rows.items()))
    open_refs = tuple(sorted(ref for ref, prediction in sorted(models.items()) if not prediction.observable_outcomes_complete))
    signatures = {key: row for _, rows in sorted(outcomes.items()) for key, row in sorted(rows.items())}
    compatible = {key: tuple(sorted(ref for ref, rows in sorted(outcomes.items()) if key in rows or ref in open_refs))
        for key in sorted(signatures)}
    # The complement is an explicit unknown outcome class, not a fabricated
    # observed signature or an evidence reference.
    classes = tuple(rows for _, rows in sorted(compatible.items())) + ((open_refs,) if open_refs else ())
    complete = coverage and fields_complete
    possible = complete and any(0 < len(rows) < len(models) for rows in classes)
    guaranteed = possible and all(0 < len(rows) < len(models) for rows in classes)
    return FrozenMap({'coverage_complete': coverage, 'observable_contract_complete': fields_complete,
        'observable_signatures_by_digest': FrozenMap(signatures),
        'compatible_models_by_signature': FrozenMap(compatible),
        'unlisted_outcome_model_refs': open_refs, 'observation_classes': classes,
        'discrimination_possible': possible, 'discrimination_guaranteed_within_models': guaranteed,
        'unique_model_for_every_outcome': complete and bool(classes) and all(len(rows) == 1 for rows in classes),
        'outcome_domains_complete': bool(models) and not open_refs})


def classify_observed_response(predictions, model_refs, signature):
    by_model = {row.model_ref: row for row in predictions}
    actual = stable_digest(signature)
    matching, mismatching, unassessed, open_refs = [], [], [], []
    for ref in model_refs:
        prediction = by_model[ref]
        if not prediction.observable_outcomes_complete:
            open_refs.append(ref)
        if actual in {stable_digest(row) for row in observable_outcomes(prediction)}:
            matching.append(ref)
        elif prediction.observable_outcomes_complete:
            mismatching.append(ref)
        else:
            unassessed.append(ref)
    return FrozenMap({'matching_model_refs': tuple(matching), 'mismatching_model_refs': tuple(mismatching),
        'unassessed_model_refs': tuple(unassessed), 'open_prediction_model_refs': tuple(open_refs)})
