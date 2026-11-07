"""Requalify Source-transported admission obligations against current DRM."""
from agents.yf_arc3_v5.capabilities.experiment_frontier_c import assemble_admission_obligations
from agents.yf_arc3_v5.drm.meaning import project_declared_alternatives
from agents.yf_arc3_v5.logos.types import immutable_json_data, stable_digest


def experiment_policy_fingerprint(drm):
    return stable_digest(tuple((ref, drm.resolve(ref)[1]) for ref in (
        'policy.experiment_frontier_c', 'policy.experiment_admission_obligations_c')))


def current_admission_obligations(drm, measured):
    projected = project_declared_alternatives(drm=drm,
        selection_policy_ref='policy.experiment_admission_obligations_c',
        alternative_refs=(), descriptive_facts=measured.facts)
    return assemble_admission_obligations(measured, immutable_json_data(projected))
