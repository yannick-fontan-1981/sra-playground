"""Exact Source-frozen relation headers tied to values, never inferred graph meaning."""
from agents.yf_arc3_v5.logos.types import FrozenMap,immutable_json_data,stable_digest


def bind_typed_relation_domains_d(request,state,bindings,predicates):
    if not bindings and not any(predicate.relation_domain is not None for predicate in predicates):return state,()
    needs=[];headers={};fields={}
    if request.immutable_inputs.get('typed_relation_bindings_digest')!=stable_digest(immutable_json_data(bindings)):
        return state,('exact_source_typed_relation_bindings',)
    for binding in bindings:
        domain=binding.domain
        if binding.field_ref not in state:
            needs.append('typed_relation_current_value_path:'+domain.domain_ref);continue
        value=state[binding.field_ref];path_valid=True
        for part in binding.field_path:
            if isinstance(value,FrozenMap) and isinstance(part,str) and part in value:value=value[part]
            elif isinstance(value,tuple) and type(part) is int and 0<=part<len(value):value=value[part]
            else:path_valid=False;break
        if not path_valid:
            needs.append('typed_relation_current_value_path:'+domain.domain_ref);continue
        if (domain.epoch!=request.epoch or domain.evidence_revision_ref!=request.input_revision_ref
                or stable_digest(value)!=binding.expected_value_digest):
            needs.append('typed_relation_current_evidence_and_value:'+domain.domain_ref);continue
        header=immutable_json_data(domain);key=(binding.field_ref,binding.field_path)
        # One value may have several independently evidenced uses, never one shared tag.
        if domain.domain_ref in headers and (headers[domain.domain_ref]!=header or fields[domain.domain_ref]!=key):
            needs.append('typed_relation_conflicting_domain_identity:'+domain.domain_ref);continue
        headers[domain.domain_ref]=header;fields[domain.domain_ref]=key
    for predicate in predicates:
        domain=predicate.relation_domain
        if domain is not None and (headers.get(domain.domain_ref)!=immutable_json_data(domain)
                or fields.get(domain.domain_ref)!=(predicate.field_ref,predicate.field_path)):
            needs.append('typed_relation_exact_requested_graph_and_predicate_kind:'+predicate.predicate_ref)
    # The annotation is a pure evaluation view, never a world/state mutation.
    return FrozenMap.overlay({'typed_relation_domains':FrozenMap(headers)},state),tuple(dict.fromkeys(needs))
