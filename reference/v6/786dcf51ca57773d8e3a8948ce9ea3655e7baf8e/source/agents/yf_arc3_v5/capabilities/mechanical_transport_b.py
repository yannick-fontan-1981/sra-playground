"""Explicit DTO field projections across B's immutable JSON fact boundaries.

The existing immutable_json_data representation handles nested declared fields.
No model_dump, new serializer, normalizer or change to FrozenMap is introduced.
"""
from agents.yf_arc3_v5.logos.types import FrozenMap,immutable_json_data
from collections.abc import Mapping


def _fields(value,names):
    if isinstance(value,Mapping):
        return FrozenMap({name:immutable_json_data(value[name]) for name in names})
    return FrozenMap({name:immutable_json_data(getattr(value,name)) for name in names})


def provider_request_payload(value):
    if value is None:return None
    return _fields(value,('schema_version','request_ref','caller_ref','parent_contribution_ref',
        'epoch','input_revision_ref','event_owner_ref','operation_ref','mode','expected_return_type',
        'model_ref','state','model','data','observations','evidence_refs','model_alternatives',
        'bounds','requested_domain_ref'))


def provider_result_payload(value):
    return _fields(value,('schema_version','request','source_status','cause','values',
        'examined_count','domain_size','domain_exhausted','frontier','missing_refs'))


def request_identity_payload(value):
    return _fields(value,('request_ref','kernel_ref','operation_ref','mode','caller_ref',
        'parent_contribution_ref','epoch','input_revision_ref','model_assignments','immutable_inputs',
        'actual_bounds','expected_return_type','requested_domain_ref'))


def candidate_payload(value):
    return _fields(value,('candidate_ref','result','dependency_revisions','assignments',
        'resource_provenance','rationale','preservation_refs'))


def join_request_payload(value):
    if value is None:return None
    return _fields(value,('schema_version','request_ref','parent_goal_ref','episode_ref','level_scope_ref',
        'epoch','groups','max_pairs','max_candidates'))


def binding_payload(value):
    return _fields(value,('ref','status','value','epoch','input_revision_ref','evidence_refs',
        'model_ref','falsifier_ref'))


def demand_payload(value):
    return _fields(value,('request','parent_goal_ref','descriptive_domain_ref','consumer_ref',
        'scope_ref','episode_ref','level_scope_ref','dependency_revisions','prerequisite_request_refs'))


def receipt_payload(value):
    return _fields(value,('receipt_ref','demand','result'))
